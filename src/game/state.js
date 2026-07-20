// Spiel-Zustand und Spiellogik-Schritt (Spec Abschnitt 3: game/state.js).
//
// Phase 6: Raeume kommen aus dem Generator (Kachelsystem, data/tiles.json).
// Zwei getrennte RNG-Stroeme: genRng (Raumbau -- muss unabhaengig vom
// Spielverlauf deterministisch sein, Spec Abschnitt 6) und aiRng
// (Gegner-KI). Alle Balancing-Werte kommen aus data/*.json.

import { CELL, COLS, ROWS, RESPAWN_DELAY } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import { createTank, moveTank, fireBullet, layMine } from './tank.js';
import { updateBullet } from './bullet.js';
import { updateMines, explodeAt } from './mine.js';
import { updateTraps } from './trap.js';
import { updateEnemy } from './ai.js';
import { circlesOverlap } from './collision.js';
import { generateRoom, buildFixedRoom } from './generator.js';
import { resolveCfg, applyUpgrades } from './cfg.js';

// Zelltyp -> Wandtyp. 'hole' blockiert Panzer, Geschosse fliegen drueber.
const WALL_TYPES = { '#': 'solid', b: 'breakable', o: 'hole' };

// Truemmerfarben fuer Partikel (Politur, Phase 10).
const DEBRIS_COLORS = {
  player: '#3d8ef0',
  t_brown: '#8a5a33',
  t_grey: '#9aa0a8',
  t_teal: '#3aa8a0',
  t_yellow: '#d4c23a',
  t_pink: '#d47ba6',
  t_green: '#5a9e4a',
  t_purple: '#8a5ad4',
  t_white: '#e8e8e8',
  t_black: '#33333c',
};

function buildWalls(grid) {
  const walls = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const type = WALL_TYPES[grid[row][col]];
      if (type) {
        walls.push({ x: col * CELL, y: row * CELL, w: CELL, h: CELL, type, col, row });
      }
    }
  }
  return walls;
}

// Baut den Zustand fuer EINEN Raum.
// opts: { genRng      -- Seed-RNG-Strom fuer den Raumbau (Pflicht)
//         enemyTypes  -- Typliste der Gegner dieses Raums
//         aiSeed      -- Seed fuer den KI-RNG-Strom
//         fixedRoom   -- optionales festes Layout (Finalraum)
//         weights     -- optionale Kachelgewichte (Raumcharakter)
//         playerUpgrades -- Upgrade-Level {id: stufe}
//         upgradesData -- Inhalt von upgrades.json (Stellwerte) }
export function createState(data, tiles, opts) {
  const { genRng, enemyTypes, aiSeed, fixedRoom, weights, playerUpgrades, upgradesData } = opts;
  const room = fixedRoom
    ? buildFixedRoom(fixedRoom, enemyTypes.length)
    : generateRoom(tiles, genRng, enemyTypes.length, weights);
  const grid = room.grid;
  const walls = buildWalls(grid);

  const player = createTank(
    'player',
    applyUpgrades(resolveCfg(data, 'player'), playerUpgrades, upgradesData),
    room.playerSpawn.x,
    room.playerSpawn.y,
  );
  const tanks = [player];
  enemyTypes.forEach((type, i) => {
    const s = room.enemySpawns[i];
    const t = createTank(type, resolveCfg(data, type), s.x, s.y);
    t.spawnX = s.x;
    t.spawnY = s.y;
    tanks.push(t);
  });

  const state = {
    data,
    tiles,
    playerUpgrades,
    upgradesData,
    rng: mulberry32((aiSeed ^ 0x9e3779b9) >>> 0), // KI-Strom, getrennt
    playerSpawn: room.playerSpawn,
    emergencyRoom: room.emergency,
    enemyKills: 0, // in diesem Raum getoetete Gegner
    playerDeaths: 0, // Tode des Spielers in diesem Raum
    playerShots: 0, // Spieler-Abzuege in diesem Raum (Trefferquote)
    walls,
    tanks,
    player,
    bullets: [],
    mines: [],
    traps: [],
    explosions: [],
    flashes: [],
    sounds: [],
    particles: [],
    texts: [], // schwebende Kurztexte { x, y, text, age, life, color }
    killLog: [], // Typen der in diesem Raum getoeteten Gegner (Statistik)
    damageFlash: 0, // roter Bildschirm-Flash nach eigenem Tod (Rendering)
    shake: 0, // Screenshake-Staerke (nur Rendering)
    time: 0,
    respawnTimer: 0,
    // Solid-Test fuer Geschosse/Sichtlinien: 'o' (hole) blockiert NICHT.
    isSolid(px, py) {
      const col = Math.floor(px / CELL);
      const row = Math.floor(py / CELL);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
      const cell = grid[row][col];
      return cell === '#' || cell === 'b';
    },
    destroyWall(wall) {
      const i = state.walls.indexOf(wall);
      if (i >= 0) state.walls.splice(i, 1);
      grid[wall.row][wall.col] = '.';
      state.spawnParticles(wall.x + wall.w / 2, wall.y + wall.h / 2, '#8a7355', 6, 90);
    },
    killTank(tank, cause) {
      tank.alive = false;
      state.sounds.push('death');
      state.addShake(4);
      state.spawnParticles(tank.x, tank.y, DEBRIS_COLORS[tank.type] || '#fff', 10, 120);
      if (tank === state.player) {
        state.playerDeaths++;
        state.lastDeathCause = cause || 'Unbekannt';
        state.damageFlash = 0.5;
        state.respawnTimer = RESPAWN_DELAY;
      } else {
        state.enemyKills++;
        state.killLog.push(tank.type);
      }
    },
    addShake(amount) {
      state.shake = Math.min(10, state.shake + amount);
    },
    spawnParticles(x, y, color, n, speed) {
      if (state.particles.length > 280) return; // Deckel
      for (let i = 0; i < n; i++) {
        const ang = state.rng() * Math.PI * 2;
        const v = speed * (0.4 + state.rng() * 0.8);
        state.particles.push({
          x,
          y,
          vx: Math.cos(ang) * v,
          vy: Math.sin(ang) * v,
          age: 0,
          life: 0.3 + state.rng() * 0.35,
          size: 1.5 + state.rng() * 2,
          color,
        });
      }
    },
  };
  return state;
}

// Raum-Neustart nach Spielertod (Spec Abschnitt 8): identisches Layout,
// getoetete Gegner bleiben tot, lebende starten auf ihren urspruenglichen
// Spawns; Geschosse und Minen werden entfernt; zerstoerte Waende bleiben
// zerstoert.
function respawnPlayer(state) {
  const fresh = createTank(
    'player',
    applyUpgrades(resolveCfg(state.data, 'player'), state.playerUpgrades, state.upgradesData),
    state.playerSpawn.x,
    state.playerSpawn.y,
  );
  state.tanks[0] = fresh;
  state.player = fresh;
  for (const t of state.tanks) {
    if (t === fresh || !t.alive) continue;
    t.x = t.spawnX;
    t.y = t.spawnY;
    t.prevX = t.spawnX;
    t.prevY = t.spawnY;
    t.vx = 0;
    t.vy = 0;
    t.cooldown = 0;
    t.turret = -Math.PI / 2;
    t.heading = -Math.PI / 2;
    t.ai = {};
  }
  state.bullets = [];
  state.mines = [];
  state.traps = [];
  state.explosions = [];
  state.flashes = [];
  state.respawnTimer = 0;
}

// Ein fester Physikschritt.
// cmd = { move: {x,y}, aim: {x,y}, fire: bool, mine: bool }.
export function stepState(state, cmd, dt) {
  const p = state.player;
  state.time += dt;

  for (const t of state.tanks) {
    if (!t.alive) continue;
    t.cooldown = Math.max(0, t.cooldown - dt);
    t.stunTimer = Math.max(0, t.stunTimer - dt);
  }

  if (!p.alive) {
    state.respawnTimer -= dt;
    if (state.respawnTimer <= 0) respawnPlayer(state);
  } else {
    moveTank(p, cmd.move, state, dt);
    p.turret = Math.atan2(cmd.aim.y - p.y, cmd.aim.x - p.x);
    if (cmd.fire) fireBullet(p, state);
    if (cmd.mine) layMine(p, state);
  }

  // Gegner: getrennte Turm-/Fahr-KI liefert Bewegung, Schuss- und
  // Minenwunsch.
  for (const t of state.tanks) {
    if (t === state.player || !t.alive) continue;
    const { move, fire, mine } = updateEnemy(t, state, dt);
    moveTank(t, move, state, dt);
    if (fire) fireBullet(t, state);
    if (mine) layMine(t, state);
  }

  for (const b of state.bullets) updateBullet(b, state, dt);

  // Geschosse zerstoeren sich gegenseitig bei Kollision. Ausnahme:
  // Doppelrohr-Zwillinge -- Kugeln derselben Salve (gleicher Schuetze,
  // gleiches Alter) starten ueberlappend und ignorieren sich, bis die
  // Spreizung sie getrennt hat.
  const bullets = state.bullets;
  for (let i = 0; i < bullets.length; i++) {
    if (bullets[i].dead) continue;
    for (let j = i + 1; j < bullets.length; j++) {
      if (bullets[j].dead) continue;
      const a = bullets[i];
      const b = bullets[j];
      if (a.owner === b.owner && a.age < 0.3 && Math.abs(a.age - b.age) < 1e-6) continue;
      if (circlesOverlap(a.x, a.y, a.radius, b.x, b.y, b.radius)) {
        a.dead = true;
        b.dead = true;
      }
    }
  }

  // Geschoss gegen Panzer: toedlich fuer JEDEN, auch den Schuetzen --
  // ausser innerhalb dessen Schutzzeit direkt nach dem Abschuss.
  const grace = state.data.physics.shooterGraceS;
  for (const b of state.bullets) {
    if (b.dead) continue;
    for (const t of state.tanks) {
      if (!t.alive) continue;
      if (b.owner === t && b.age < grace) continue;
      if (circlesOverlap(b.x, b.y, b.radius, t.x, t.y, t.cfg.radius)) {
        b.dead = true;
        // Banden-Kill-Feedback: Gegner mit abgeprallter Kugel erwischt.
        if (t !== state.player && b.ricochetsLeft < b.ricochetsStart) {
          state.texts.push({ x: t.x, y: t.y - 18, text: 'Abpraller!', age: 0, life: 0.9, color: '#8ecae6' });
        }
        // Todesursache fuer den Game-Over-Screen.
        const WEAPON_LABEL = { bullet: 'Kugel', rocket: 'Rakete', bounce_rocket: 'Bounce-Rakete' };
        const cause =
          b.owner === state.player
            ? 'die eigene Kugel'
            : `${state.data.types[b.owner?.type]?.label || '?'} (${WEAPON_LABEL[b.kind] || b.kind})`;
        state.killTank(t, cause);
        break;
      }
    }
  }

  updateMines(state, dt);
  updateTraps(state, dt);

  // Sprengschuss-Upgrade: markierte Geschosse explodieren beim Tod
  // (Wandkontakt, Panzertreffer, Geschoss-gegen-Geschoss, Minenzuendung).
  for (const b of state.bullets) {
    if (b.dead && b.explosive && !b.detonated) {
      b.detonated = true;
      explodeAt(state, b.x, b.y, b.explosionRadius);
    }
  }

  // Kurzlebige Render-Effekte altern lassen.
  for (const e of state.explosions) e.age += dt;
  state.explosions = state.explosions.filter((e) => e.age < 0.4);
  for (const f of state.flashes) f.age += dt;
  state.flashes = state.flashes.filter((f) => f.age < 0.08);
  for (const pt of state.particles) {
    pt.age += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
  }
  state.particles = state.particles.filter((pt) => pt.age < pt.life);
  for (const tx of state.texts) tx.age += dt;
  state.texts = state.texts.filter((tx) => tx.age < tx.life);
  state.damageFlash = Math.max(0, state.damageFlash - dt);
  state.shake = Math.max(0, state.shake - state.shake * 4 * dt - 0.5 * dt);

  state.bullets = state.bullets.filter((b) => !b.dead);
}
