// Spiel-Zustand und Spiellogik-Schritt (Spec Abschnitt 3: game/state.js).
//
// Phase 2: hartcodierte Testarena, Spielerpanzer, Geschosse mit
// Abprallern. Kein Generator, kein JSON -- das kommt ab Phase 6.

import {
  CELL,
  COLS,
  ROWS,
  BULLET_SPEED,
  FIRE_COOLDOWN,
  PLAYER_MAGAZINE,
  PLAYER_RICOCHETS,
  SHOOTER_GRACE,
  RESPAWN_DELAY,
} from '../config.js';
import { createPlayer, updatePlayer } from './tank.js';
import { createBullet, updateBullet } from './bullet.js';
import { circlesOverlap } from './collision.js';

// Hartcodierte Testarena: 24x16 Zellen.
//   '#' = solid-Wand (unzerstoerbar, blockiert)
//   '.' = frei
// Aussenrand ist geschlossen; die inneren Cluster dienen als Testfaelle
// fuer Kanten- und Ecken-Sliding sowie Abpraller.
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

const SPAWN = { col: 3, row: 13 };

// Wandeln die ASCII-Karte in eine Liste von AABBs (exakt 32x32) um.
function buildWalls(map) {
  const walls = [];
  for (let row = 0; row < ROWS; row++) {
    const line = map[row];
    for (let col = 0; col < COLS; col++) {
      if (line[col] === '#') {
        walls.push({
          x: col * CELL,
          y: row * CELL,
          w: CELL,
          h: CELL,
          type: 'solid',
        });
      }
    }
  }
  return walls;
}

export function createState() {
  const walls = buildWalls(ARENA_MAP);
  const player = createPlayer(
    SPAWN.col * CELL + CELL / 2,
    SPAWN.row * CELL + CELL / 2,
  );
  return {
    walls,
    player,
    bullets: [],
    respawnTimer: 0, // > 0 waehrend der Spieler tot ist
  };
}

function liveBulletsOf(state, owner) {
  let n = 0;
  for (const b of state.bullets) {
    if (!b.dead && b.owner === owner) n++;
  }
  return n;
}

function tryFire(state) {
  const p = state.player;
  // Epsilon: 0.25 ist als Summe von 1/60-Schritten nicht exakt
  // darstellbar; ohne Toleranz feuert man einen Tick zu spaet.
  if (p.cooldown > 1e-9) return;
  if (liveBulletsOf(state, p) >= PLAYER_MAGAZINE) return;
  // Muendung: Spitze des Rohrs.
  const muzzle = p.radius + 8;
  state.bullets.push(
    createBullet(
      p.x + Math.cos(p.turret) * muzzle,
      p.y + Math.sin(p.turret) * muzzle,
      p.turret,
      { speed: BULLET_SPEED, ricochets: PLAYER_RICOCHETS, owner: p },
    ),
  );
  p.cooldown = FIRE_COOLDOWN;
}

function killPlayer(state) {
  state.player.alive = false;
  state.respawnTimer = RESPAWN_DELAY;
}

function respawn(state) {
  const fresh = createPlayer(
    SPAWN.col * CELL + CELL / 2,
    SPAWN.row * CELL + CELL / 2,
  );
  state.player = fresh;
  state.bullets = [];
  state.respawnTimer = 0;
}

// Ein fester Physikschritt. cmd = { move: {x,y}, aim: {x,y}, fire: bool }.
export function stepState(state, cmd, dt) {
  const p = state.player;

  if (!p.alive) {
    state.respawnTimer -= dt;
    if (state.respawnTimer <= 0) respawn(state);
  } else {
    updatePlayer(p, cmd.move, state.walls, dt);
    p.turret = Math.atan2(cmd.aim.y - p.y, cmd.aim.x - p.x);
    p.cooldown = Math.max(0, p.cooldown - dt);
    if (cmd.fire) tryFire(state);
  }

  for (const b of state.bullets) updateBullet(b, state.walls, dt);

  // Geschosse zerstoeren sich gegenseitig bei Kollision.
  const bullets = state.bullets;
  for (let i = 0; i < bullets.length; i++) {
    const a = bullets[i];
    if (a.dead) continue;
    for (let j = i + 1; j < bullets.length; j++) {
      const b = bullets[j];
      if (b.dead) continue;
      if (circlesOverlap(a.x, a.y, a.radius, b.x, b.y, b.radius)) {
        a.dead = true;
        b.dead = true;
      }
    }
  }

  // Geschoss gegen Spieler: toedlich, auch das eigene -- ausser
  // innerhalb der Schuetzen-Schutzzeit direkt nach dem Abschuss.
  if (state.player.alive) {
    for (const b of state.bullets) {
      if (b.dead) continue;
      if (b.owner === state.player && b.age < SHOOTER_GRACE) continue;
      if (circlesOverlap(b.x, b.y, b.radius, p.x, p.y, p.radius)) {
        b.dead = true;
        killPlayer(state);
        break;
      }
    }
  }

  state.bullets = state.bullets.filter((b) => !b.dead);
}
