// Spiel-Zustand und Spiellogik-Schritt (Spec Abschnitt 3: game/state.js).
//
// Phase 3: hartcodierte Testarena, Spielerpanzer plus Gegner (t_brown,
// t_grey) mit KI. Alle Balancing-Werte kommen aus data/tanks.json und
// werden als data-Objekt injiziert (kein fetch hier -- so bleibt die
// Logik headless testbar). Raumgenerator und JSON-Kacheln ab Phase 6.

import { CELL, COLS, ROWS, RESPAWN_DELAY } from '../config.js';
import { mulberry32 } from '../core/rng.js';
import { createTank, moveTank, fireBullet } from './tank.js';
import { updateBullet } from './bullet.js';
import { updateEnemy } from './ai.js';
import { circlesOverlap } from './collision.js';

// Hartcodierte Testarena: 24x16 Zellen.
//   '#' = solid-Wand (unzerstoerbar, blockiert)
//   '.' = frei
const ARENA_MAP = [
  '########################',
  '#......................#',
  '#......................#',
  '#...####........####...#',
  '#...#..............#...#',
  '#......................#',
  '#.......######.........#',
  '#......................#',
  '#....##......##........#',
  '#......................#',
  '#.........####.........#',
  '#......................#',
  '#...####........####...#',
  '#......................#',
  '#......................#',
  '########################',
];

const PLAYER_SPAWN = { col: 3, row: 13 };

// Test-Gegner fuer Phase 3 (Spawns kommen ab Phase 6 aus dem Generator).
const ENEMY_SPAWNS = [
  { type: 't_brown', col: 12, row: 5 },
  { type: 't_brown', col: 20, row: 2 },
  { type: 't_grey', col: 18, row: 9 },
  { type: 't_grey', col: 6, row: 7 },
];

function buildWalls(map) {
  const walls = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (map[row][col] === '#') {
        walls.push({ x: col * CELL, y: row * CELL, w: CELL, h: CELL, type: 'solid' });
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
    bulletSpeed: data.bulletSpeeds[t.weapon],
    turret: t.turret,
    drive: t.drive,
  };
}

function cellCenter(col, row) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

export function createState(data, seed = 1) {
  const walls = buildWalls(ARENA_MAP);
  const p = cellCenter(PLAYER_SPAWN.col, PLAYER_SPAWN.row);
  const player = createTank('player', resolveCfg(data, 'player'), p.x, p.y);
  const tanks = [player];
  for (const s of ENEMY_SPAWNS) {
    const c = cellCenter(s.col, s.row);
    tanks.push(createTank(s.type, resolveCfg(data, s.type), c.x, c.y));
  }
  return {
    data,
    rng: mulberry32(seed),
    walls,
    tanks,
    player,
    bullets: [],
    respawnTimer: 0, // > 0 waehrend der Spieler tot ist
    // Zellgenauer Solid-Test in Pixelkoordinaten (fuer KI-Raycasts).
    isSolid(px, py) {
      const col = Math.floor(px / CELL);
      const row = Math.floor(py / CELL);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
      return ARENA_MAP[row][col] === '#';
    },
  };
}

function respawnPlayer(state) {
  const p = cellCenter(PLAYER_SPAWN.col, PLAYER_SPAWN.row);
  const fresh = createTank('player', resolveCfg(state.data, 'player'), p.x, p.y);
  state.tanks[0] = fresh;
  state.player = fresh;
  state.bullets = [];
  state.respawnTimer = 0;
}

// Ein fester Physikschritt. cmd = { move: {x,y}, aim: {x,y}, fire: bool }.
export function stepState(state, cmd, dt) {
  const p = state.player;

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
  }

  // Gegner: getrennte Turm-/Fahr-KI liefert Bewegungsvektor + Schusswunsch.
  for (const t of state.tanks) {
    if (t === state.player || !t.alive) continue;
    const { move, fire } = updateEnemy(t, state, dt);
    moveTank(t, move, state, dt);
    if (fire) fireBullet(t, state);
  }

  for (const b of state.bullets) updateBullet(b, state.walls, dt);

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
        t.alive = false;
        if (t === state.player) state.respawnTimer = RESPAWN_DELAY;
        break;
      }
    }
  }

  state.bullets = state.bullets.filter((b) => !b.dead);
}
