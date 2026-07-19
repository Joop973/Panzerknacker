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
import { updateMines } from './mine.js';
import { updateEnemy } from './ai.js';
import { circlesOverlap } from './collision.js';
import { generateRoom, buildFixedRoom } from './generator.js';

// Zelltyp -> Wandtyp. 'hole' blockiert Panzer, Geschosse fliegen drueber.
const WALL_TYPES = { '#': 'solid', b: 'breakable', o: 'hole' };

// Truemmerfarben fuer Partikel (Politur, Phase 10).
const DEBRIS_COLORS = {
  player: '#c8b24a',
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

// Loest einen Typnamen aus tanks.json in ein flaches cfg-Objekt auf.
function resolveCfg(data, type) {
  const t = data.types[type];
  return {
    radius: data.physics.tankRadius,
    bulletRadius: data.physics.bulletRadius,
    fireCooldown: data.physics.fireCooldownS,
    speed: data.speeds[t.speed],
    magazine: t.magazine,
    ricochets: t.ricochets,
    mines: t.mines,
    weapon: t.weapon,
    bulletSpeed: data.bulletSpeeds[t.weapon],
    turret: t.turret,
    drive: t.drive,
    avoidMines: t.avoidMines || false,
    miner: t.miner,
    trackStampPx: t.trackStampPx || 3,
  };
}

// Upgrade-Level auf das Spieler-cfg anwenden (Spec Abschnitt 8).
function applyUpgrades(cfg, ups) {
  if (!ups) return cfg;
  const l = (k) => ups[k] || 0;
  cfg.magazine += 2 * l('magazin');
  cfg.ricochets += l('abpraller'); // Basis 1, max +1 => harte Grenze 2
  cfg.bulletSpeed *= Math.pow(1.2, l('ladung'));
  cfg.mines += l('kettenglied');
  cfg.mineRadiusMult = Math.pow(1.3, l('sprengkraft'));
  cfg.speed *= Math.pow(1.12, l('kettenantrieb'));
  cfg.tungsten = l('wolframkern') > 0;
  return cfg;
}

// Baut den Zustand fuer EINEN Raum.
// opts: { genRng      -- Seed-RNG-Strom fuer den Raumbau (Pflicht)
//         enemyTypes  -- Typliste der Gegner dieses Raums
//         aiSeed      -- Seed fuer den KI-RNG-Strom
//         fixedRoom   -- optionales festes Layout (Finalraum)
//         weights     -- optionale Kachelgewichte (Raumcharakter)
//         playerUpgrades -- Upgrade-Level {id: stufe} }
export function createState(data, tiles, opts) {
  const { genRng, enemyTypes, aiSeed, fixedRoom, weights, playerUpgrades } = opts;
  const room = fixedRoom
    ? buildFixedRoom(fixedRoom, enemyTypes.length)
    : generateRoom(tiles, genRng, enemyTypes.length, weights);
  const grid = room.grid;
  const walls = buildWalls(grid);

  const player = createTank(
    'player',
    applyUpgrades(resolveCfg(data, 'player'), playerUpgrades),
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
    rng: mulberry32((aiSeed ^ 0x9e3779b9) >>> 0), // KI-Strom, getrennt
    playerSpawn: room.playerSpawn,
    emergencyRoom: room.emergency,
    enemyKills: 0, // in diesem Raum getoetete Gegner
    playerDeaths: 0, // Tode des Spielers in diesem Raum
    walls,
    tanks,
    player,
    bullets: [],
    mines: [],
    explosions: [],
    flashes: [],
    sounds: [],
    particles: [],
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
    killTank(tank) {
      tank.alive = false;
      state.sounds.push('death');
      state.addShake(4);
      state.spawnParticles(tank.x, tank.y, DEBRIS_COLORS[tank.type] || '#fff', 10, 120);
      if (tank === state.player) {
        state.playerDeaths++;
        state.respawnTimer = RESPAWN_DELAY;
      } else {
        state.enemyKills++;
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
    applyUpgrades(resolveCfg(state.data, 'player'), state.playerUpgrades),
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
    if (t.alive) t.cooldown = Math.max(0, t.cooldown - dt);
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

  // Geschosse zerstoeren sich gegenseitig bei Kollision.
  const bullets = state.bullets;
  for (let i = 0; i < bullets.length; i++) {
    if (bullets[i].dead) continue;
    for (let j = i + 1; j < bullets.length; j++) {
      if (bullets[j].dead) continue;
      const a = bullets[i];
      const b = bullets[j];
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
        state.killTank(t);
        break;
      }
    }
  }

  updateMines(state, dt);

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
  state.shake = Math.max(0, state.shake - state.shake * 4 * dt - 0.5 * dt);

  state.bullets = state.bullets.filter((b) => !b.dead);
}
