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
import { generateRoom } from './generator.js';

// Test-Zusammenstellung; ab Phase 7 kauft das Gefahrenbudget ein.
const ENEMY_TYPES = ['t_brown', 't_grey', 't_teal', 't_pink', 't_yellow', 't_green'];

// Zelltyp -> Wandtyp. 'hole' blockiert Panzer, Geschosse fliegen drueber.
const WALL_TYPES = { '#': 'solid', b: 'breakable', o: 'hole' };

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

export function createState(data, tiles, seed = 1) {
  const genRng = mulberry32(seed);
  const room = generateRoom(tiles, genRng, ENEMY_TYPES.length);
  const grid = room.grid;
  const walls = buildWalls(grid);

  const player = createTank(
    'player',
    resolveCfg(data, 'player'),
    room.playerSpawn.x,
    room.playerSpawn.y,
  );
  const tanks = [player];
  ENEMY_TYPES.forEach((type, i) => {
    const s = room.enemySpawns[i];
    const t = createTank(type, resolveCfg(data, type), s.x, s.y);
    t.spawnX = s.x;
    t.spawnY = s.y;
    tanks.push(t);
  });

  const state = {
    data,
    tiles,
    seed,
    genRng,
    rng: mulberry32((seed ^ 0x9e3779b9) >>> 0), // KI-Strom, getrennt
    playerSpawn: room.playerSpawn,
    emergencyRoom: room.emergency,
    walls,
    tanks,
    player,
    bullets: [],
    mines: [],
    explosions: [],
    flashes: [],
    sounds: [],
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
    },
    killTank(tank) {
      tank.alive = false;
      if (tank === state.player) state.respawnTimer = RESPAWN_DELAY;
    },
  };
  return state;
}

function respawnPlayer(state) {
  const fresh = createTank(
    'player',
    resolveCfg(state.data, 'player'),
    state.playerSpawn.x,
    state.playerSpawn.y,
  );
  state.tanks[0] = fresh;
  state.player = fresh;
  // Wie beim Raum-Neustart (Spec Abschnitt 8): Geschosse und Minen
  // werden entfernt; zerstoerte Waende bleiben zerstoert.
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

  state.bullets = state.bullets.filter((b) => !b.dead);
}
