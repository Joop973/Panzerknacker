// Raumgenerator, Kachelsystem (Spec Abschnitt 6).
//
// Ein Raum = 3x2 Kacheln a 8x8 Zellen, pro Slot zufaellig gewaehlt,
// optional rotiert (0/90/180/270) und/oder gespiegelt. Aussenrand immer
// geschlossene solid-Wand. Danach Pflicht-Validierung:
//   1. Flood-Fill: alle Gegner-Spawns vom Spieler aus erreichbar
//   2. Mindestabstand Spieler <-> naechster Gegner-Spawn: 200 px
//   3. keine direkte Sichtlinie Spieler <-> irgendein Gegner-Spawn
//   4. Wandanteil (Innenbereich) zwischen 15 % und 35 %
// Schlaegt ein Versuch fehl -> neu wuerfeln; nach 10 Fehlversuchen wird
// das fest hinterlegte Notfall-Layout geladen. Nie haengen bleiben.
//
// Aller Zufall laeuft ueber den uebergebenen (Seed-)RNG.

import { CELL, COLS, ROWS } from '../config.js';

const TILE = 8; // Kachelkante in Zellen
const MIN_SPAWN_DIST = 200; // px
const MAX_TRIES = 10;
const WALL_MIN = 0.15;
const WALL_MAX = 0.35;

function rot90(rows) {
  const out = [];
  for (let r = 0; r < TILE; r++) {
    let line = '';
    for (let c = 0; c < TILE; c++) line += rows[TILE - 1 - c][r];
    out.push(line);
  }
  return out;
}

function mirror(rows) {
  return rows.map((r) => r.split('').reverse().join(''));
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Baut das 24x16-Rohlayout aus 3x2 zufaelligen Kacheln.
function buildGrid(tilesData, rng) {
  const names = Object.keys(tilesData.tiles);
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill('.'));
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 3; tx++) {
      let rows = tilesData.tiles[pick(rng, names)].rows;
      const rot = Math.floor(rng() * 4);
      for (let i = 0; i < rot; i++) rows = rot90(rows);
      if (rng() < 0.5) rows = mirror(rows);
      for (let r = 0; r < TILE; r++) {
        for (let c = 0; c < TILE; c++) {
          grid[ty * TILE + r][tx * TILE + c] = rows[r][c];
        }
      }
    }
  }
  // Geschlossener Aussenrand.
  for (let c = 0; c < COLS; c++) {
    grid[0][c] = '#';
    grid[ROWS - 1][c] = '#';
  }
  for (let r = 0; r < ROWS; r++) {
    grid[r][0] = '#';
    grid[r][COLS - 1] = '#';
  }
  return grid;
}

function wallShare(grid) {
  // Anteil ueber den GANZEN Raum inkl. Rand (Spec: 15-35 %).
  let walls = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== '.') walls++;
    }
  }
  return walls / (ROWS * COLS);
}

// Flood-Fill ueber panzerbefahrbare Zellen ('.'); 'o' blockiert Panzer.
function reachableCells(grid, startC, startR) {
  const seen = new Set([startR * COLS + startC]);
  const queue = [[startC, startR]];
  while (queue.length) {
    const [c, r] = queue.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const key = nr * COLS + nc;
      if (seen.has(key) || grid[nr][nc] !== '.') continue;
      seen.add(key);
      queue.push([nc, nr]);
    }
  }
  return seen;
}

// Sichtlinie zwischen zwei Zellzentren; '#' und 'b' blockieren
// (Geschosse fliegen ueber 'o' hinweg, also blockiert 'o' NICHT).
function hasLos(grid, c0, r0, c1, r1) {
  const x0 = c0 * CELL + CELL / 2;
  const y0 = r0 * CELL + CELL / 2;
  const x1 = c1 * CELL + CELL / 2;
  const y1 = r1 * CELL + CELL / 2;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist / 4);
  for (let i = 1; i < steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = y0 + ((y1 - y0) * i) / steps;
    const cell = grid[Math.floor(y / CELL)][Math.floor(x / CELL)];
    if (cell === '#' || cell === 'b') return false;
  }
  return true;
}

function cellDist(c0, r0, c1, r1) {
  return Math.hypot((c1 - c0) * CELL, (r1 - r0) * CELL);
}

// Versucht, Spieler- und Gegner-Spawns regelkonform zu platzieren.
function placeSpawns(grid, rng, enemyCount) {
  const free = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] === '.') free.push([c, r]);
    }
  }
  if (free.length < enemyCount + 1) return null;
  const player = pick(rng, free);
  const reach = reachableCells(grid, player[0], player[1]);
  // Kandidaten: erreichbar, weit genug weg, keine Sichtlinie.
  const candidates = free.filter(
    ([c, r]) =>
      reach.has(r * COLS + c) &&
      cellDist(player[0], player[1], c, r) >= MIN_SPAWN_DIST &&
      !hasLos(grid, player[0], player[1], c, r),
  );
  if (candidates.length < enemyCount) return null;
  // Deterministisch mischen (Fisher-Yates ueber den Seed-RNG).
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return { player, enemies: candidates.slice(0, enemyCount) };
}

function toSpawn([c, r]) {
  return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
}

// Festes Layout (Finalraum / Notfall) in das Ergebnisformat bringen.
export function buildFixedRoom(roomDef, enemyCount) {
  const grid = roomDef.map.map((row) => row.split(''));
  return {
    grid,
    playerSpawn: toSpawn(roomDef.playerSpawn),
    enemySpawns: roomDef.enemySpawns.slice(0, enemyCount).map(toSpawn),
    emergency: false,
  };
}

// Hauptfunktion: generiert einen validierten Raum.
export function generateRoom(tilesData, rng, enemyCount) {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const grid = buildGrid(tilesData, rng);
    const share = wallShare(grid);
    if (share < WALL_MIN || share > WALL_MAX) continue;
    const spawns = placeSpawns(grid, rng, enemyCount);
    if (!spawns) continue;
    return {
      grid,
      playerSpawn: toSpawn(spawns.player),
      enemySpawns: spawns.enemies.map(toSpawn),
      emergency: false,
    };
  }
  // Notfall-Layout: darf nie fehlen und nie haengen.
  const room = buildFixedRoom(tilesData.emergencyRoom, enemyCount);
  room.emergency = true;
  return room;
}
