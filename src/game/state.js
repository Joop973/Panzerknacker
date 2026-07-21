// Spiel-Zustand und Spiellogik-Schritt (Spec Abschnitt 3: game/state.js).
//
// Phase 6: Raeume kommen aus dem Generator (Kachelsystem, data/tiles.json).
// Zwei getrennte RNG-Stroeme: genRng (Raumbau -- muss unabhaengig vom
// Spielverlauf deterministisch sein, Spec Abschnitt 6) und aiRng
// (Gegner-KI). Alle Balancing-Werte kommen aus data/*.json.

import { CELL, COLS, ROWS, RESPAWN_DELAY } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import { createTank, moveTank, fireBullet, layMine, dashTank } from './tank.js';
import { updateBullet, createBullet } from './bullet.js';
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
      // Schild faengt genau einen toedlichen Treffer ab (laedt pro Leben).
      if (tank === state.player && tank.shieldReady) {
        tank.shieldReady = false;
        tank.protect = Math.max(tank.protect, 0.6);
        state.sounds.push('shield');
        state.spawnParticles(tank.x, tank.y, '#8ecaf0', 12, 130);
        // Konterschild: feuert beim Bruch einen Kugelkranz.
        if (tank.cfg.counterShield) {
          spawnRadialBullets(state, tank, tank.x, tank.y, tank.cfg.counterShieldCount, 150);
        }
        return;
      }
      tank.alive = false;
      state.sounds.push('death');
      state.addShake(4);
      state.spawnParticles(tank.x, tank.y, DEBRIS_COLORS[tank.type] || '#fff', 10, 120);
      if (tank === state.player) {
        // Kamikaze: der Spieler explodiert beim Sterben.
        if (tank.cfg.kamikazeRadius) {
          explodeAt(state, tank.x, tank.y, tank.cfg.kamikazeRadius);
        }
        state.playerDeaths++;
        state.lastDeathCause = cause || 'Unbekannt';
        state.damageFlash = 0.5;
        state.respawnTimer = RESPAWN_DELAY;
      } else {
        state.enemyKills++;
        state.killLog.push(tank.type);
        const pc = state.player.cfg;
        if (state.player.alive) {
          // Aasgeier: Abschuss laedt die Spielerwaffe sofort nach.
          if (pc.scavenger) state.player.cooldown = 0;
          // Blutrausch: kurz unverwundbar und schneller.
          if (pc.bloodlust) {
            state.player.protect = Math.max(state.player.protect, pc.bloodlust);
            state.player.bloodTimer = pc.bloodlust;
          }
        }
        // Kettenblitz: kleine Explosion am Ort des Kills (verschont den
        // Spieler) -> kann weitere Gegner mitreissen (Kettenkills).
        if (pc.chainLightning) {
          explodeAt(state, tank.x, tank.y, pc.chainLightning, state.player);
        }
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

// Feuert count Kugeln gleichmaessig im Kreis (Schrapnell/Konterschild).
function spawnRadialBullets(state, owner, x, y, count, speed) {
  const sp = speed || owner.cfg.schrapnellSpeed || 150;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    state.bullets.push(
      createBullet(x + Math.cos(a) * 10, y + Math.sin(a) * 10, a, {
        speed: sp,
        radius: state.data.physics.bulletRadius,
        ricochets: 0,
        owner,
        kind: 'bullet',
      }),
    );
  }
}

// Nahkampf: Rammklinge (Kontakt in Fahrt toetet) + Klingenkranz
// (rotierende Klingen toeten bei Beruehrung).
function applyMelee(state, dt) {
  const p = state.player;
  if (!p.alive) return;
  // Rammklinge: nur bei nennenswerter Fahrt.
  if (p.cfg.ram && Math.hypot(p.vx, p.vy) > p.cfg.speed * 0.4) {
    for (const t of state.tanks) {
      if (t === p || !t.alive) continue;
      if (circlesOverlap(p.x, p.y, p.cfg.radius + 2, t.x, t.y, t.cfg.radius)) {
        p.protect = Math.max(p.protect, p.cfg.ram); // kurz geschuetzt
        state.killTank(t, 'die Rammklinge');
      }
    }
  }
  // Klingenkranz: n Klingen umkreisen den Spieler.
  if (p.cfg.blades) {
    p.bladeAngle = (p.bladeAngle || 0) + p.cfg.bladeSpin * dt;
    for (let i = 0; i < p.cfg.blades; i++) {
      const a = p.bladeAngle + (i / p.cfg.blades) * Math.PI * 2;
      const bx = p.x + Math.cos(a) * p.cfg.bladeOrbit;
      const by = p.y + Math.sin(a) * p.cfg.bladeOrbit;
      for (const t of state.tanks) {
        if (t === p || !t.alive) continue;
        if (circlesOverlap(bx, by, 6, t.x, t.y, t.cfg.radius)) {
          state.killTank(t, 'der Klingenkranz');
        }
      }
    }
  }
}

// Kampfdrohne: umkreist den Spieler und feuert selbst auf den naechsten
// Gegner (deterministisch: fester Drehwinkel, naechstes Ziel nach Distanz).
function updateDrone(state, dt) {
  const p = state.player;
  const d = p.cfg.drone;
  if (!d || !p.alive) return;
  if (p.droneAngle === undefined) {
    p.droneAngle = 0;
    p.droneCd = d.intervalS;
  }
  p.droneAngle += 1.5 * dt;
  const dx = p.x + Math.cos(p.droneAngle) * d.orbitPx;
  const dy = p.y + Math.sin(p.droneAngle) * d.orbitPx;
  p.droneX = dx;
  p.droneY = dy;
  p.droneCd -= dt;
  if (p.droneCd > 0) return;
  let best = null;
  let bestDist = Infinity;
  for (const t of state.tanks) {
    if (t === p || !t.alive) continue;
    const dd = (t.x - dx) ** 2 + (t.y - dy) ** 2;
    if (dd < bestDist) {
      bestDist = dd;
      best = t;
    }
  }
  if (!best) return;
  p.droneCd = d.intervalS;
  const a = Math.atan2(best.y - dy, best.x - dx);
  state.bullets.push(
    createBullet(dx, dy, a, {
      speed: d.bulletSpeed,
      radius: state.data.physics.bulletRadius,
      ricochets: 0,
      owner: p,
      kind: 'bullet',
    }),
  );
  state.flashes.push({ x: dx, y: dy, age: 0 });
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
  fresh.protect = state.data.physics.respawnProtectS; // kurzer Spawn-Schutz
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
    if (t.protect > 0) t.protect = Math.max(0, t.protect - dt);
    if (t.boostTimer > 0) t.boostTimer = Math.max(0, t.boostTimer - dt);
    if (t.bloodTimer > 0) t.bloodTimer = Math.max(0, t.bloodTimer - dt);
    if (t.dashCd > 0) t.dashCd = Math.max(0, t.dashCd - dt);
  }

  if (!p.alive) {
    state.respawnTimer -= dt;
    if (state.respawnTimer <= 0) respawnPlayer(state);
  } else {
    // Uebermacht: Magazin waechst mit lebenden Gegnern (dynamisch).
    if (p.cfg.magazinePerEnemy && !p.cfg.singleShot) {
      let live = 0;
      for (const t of state.tanks) if (t !== p && t.alive) live++;
      p.magazineBonus = p.cfg.magazinePerEnemy * live;
    }
    if (cmd.dash) dashTank(p, state, cmd.move); // vor der Bewegung
    moveTank(p, cmd.move, state, dt);
    p.turret = Math.atan2(cmd.aim.y - p.y, cmd.aim.x - p.x);
    if (cmd.fire) fireBullet(p, state);
    if (cmd.mine) layMine(p, state, cmd.mineThrow);
    applyMelee(state, dt); // Rammklinge + Klingenkranz
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
      if (t.protect > 0) continue; // Spawn-Schutz
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

  updateDrone(state, dt);
  updateMines(state, dt);
  updateTraps(state, dt);

  // Sprengschuss-Upgrade: markierte Geschosse explodieren beim Tod
  // (Wandkontakt, Panzertreffer, Geschoss-gegen-Geschoss, Minenzuendung).
  for (const b of state.bullets) {
    if (b.dead && b.explosive && !b.detonated) {
      b.detonated = true;
      explodeAt(state, b.x, b.y, b.explosionRadius);
      // Schrapnell: Splitterkugeln in alle Richtungen.
      const n = b.owner?.cfg?.schrapnell;
      if (n && b.owner.alive) spawnRadialBullets(state, b.owner, b.x, b.y, n);
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
