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

// Gewichtete Kachelwahl nach Kategorie (Raumcharakter, Spec Abschnitt 7B).
function pickTile(tilesData, rng, weights) {
  const names = Object.keys(tilesData.tiles);
  if (!weights) return tilesData.tiles[pick(rng, names)];
  let total = 0;
  const w = names.map((n) => {
    const v = weights[tilesData.tiles[n].category] ?? 1;
    total += v;
    return v;
  });
  let roll = rng() * total;
  for (let i = 0; i < names.length; i++) {
    roll -= w[i];
    if (roll <= 0) return tilesData.tiles[names[i]];
  }
  return tilesData.tiles[names[names.length - 1]];
}

// Spiegelwaende (Phase 5): ersetzt 2-4 Aussenrand-Zellen (ohne Ecken) durch
// 'r' (Reflekt-Wandtyp). Nur der Aussenrand ist bereits geschlossene Wand,
// also aendert das weder den Wandanteil noch die Erreichbarkeit -- kein
// Risiko fuer Flood-Fill/Spawn-Platzierung.
function placeReflectWalls(grid, rng, count) {
  const border = [];
  for (let c = 1; c < COLS - 1; c++) {
    border.push([c, 0]);
    border.push([c, ROWS - 1]);
  }
  for (let r = 1; r < ROWS - 1; r++) {
    border.push([0, r]);
    border.push([COLS - 1, r]);
  }
  for (let i = border.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [border[i], border[j]] = [border[j], border[i]];
  }
  for (let i = 0; i < count && i < border.length; i++) {
    const [c, r] = border[i];
    grid[r][c] = 'r';
  }
}

// Zerstoerbare Waende (Phase 11): markiert einen Anteil der INNEREN
// soliden Zellen (kein Aussenrand -- der bleibt immer geschlossen) als
// eigenes Zeichen 'd'. Physisch identisch zu '#' (blockiert, keine
// Sichtlinie), bis state.js sie ueber destroyWall() abbaut. Der
// Gesamt-Wandanteil aendert sich dadurch NICHT (nur Umetikettierung
// vorhandener solid-Zellen), die Reihenfolge relativ zu wallShare() ist
// also egal.
function placeDestructibleWalls(grid, rng, cfg) {
  if (!cfg || !cfg.share) return;
  const candidates = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] === '#') candidates.push([c, r]);
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const n = Math.round(candidates.length * cfg.share);
  for (let i = 0; i < n; i++) {
    const [c, r] = candidates[i];
    grid[r][c] = 'd';
  }
}

// Baut das 24x16-Rohlayout aus 3x2 zufaelligen Kacheln.
function buildGrid(tilesData, rng, weights, destructibleWalls) {
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill('.'));
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 3; tx++) {
      let rows = pickTile(tilesData, rng, weights).rows;
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
  const mirrorCfg = tilesData.mirror || { minPerRoom: 2, maxPerRoom: 4 };
  const span = mirrorCfg.maxPerRoom - mirrorCfg.minPerRoom;
  const count = mirrorCfg.minPerRoom + Math.floor(rng() * (span + 1));
  placeReflectWalls(grid, rng, count);
  placeDestructibleWalls(grid, rng, destructibleWalls);
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

// Sichtlinie zwischen zwei Zellzentren; '#', 'b', 'r' (Spiegelwand,
// Phase 5) und 'd' (zerstoerbare Wand, Phase 11 -- bis zur Zerstoerung
// physisch eine normale Wand) blockieren (Geschosse fliegen ueber 'o'
// hinweg, also blockiert 'o' NICHT).
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
    if (cell === '#' || cell === 'b' || cell === 'r' || cell === 'd') return false;
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

// --- Feste Layouts aus data/arenas.json (Phase 0b) ----------------------
//
// Enthaelt ein Raumspec das Feld `fixedLayout: "<name>"`, wird das Layout
// geladen statt generiert. Der Renderer aendert sich dadurch NICHT: feste
// Layouts erzeugen exakt dieselbe Kachelstruktur (dasselbe grid-Format) wie
// generierte Raeume.
//
// Legende -> Rasterzeichen der Engine. Phase 14 aktiviert die beiden
// Sonderfelder: 'mirror' wird zur bereits bestehenden Spiegelwand ('r',
// Phase 5 -- Der Spiegel-Boss braucht keine eigene Wandmechanik dafuer),
// 'generator' zu einem neuen, eigenen Wandtyp mit Bankshot-Haltbarkeit
// (state.js: WALL_TYPES.g, bullet.js: nur Treffer mit wallBounces>0
// beschaedigen ihn). Beide werden trotzdem weiter als Marker gemeldet
// (siehe arenaCells()) -- ungenutzt fuer diese zwei Kinds, aber offen fuer
// spaetere Spezialfaelle.
const LEGEND_TO_CELL = {
  wall: '#',
  breakable: 'b',
  hole: 'o',
  floor: '.',
  spawn: '.',
  enemy: '.',
  mirror: 'r',
  generator: 'g',
};

function arenaCells(def, name) {
  const grid = [];
  const markers = []; // { type, col, row } fuer mirror/generator (Phase 14)
  let player = null;
  const enemies = [];
  for (let r = 0; r < def.grid.length; r++) {
    const line = def.grid[r];
    const row = [];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      const kind = def.legend[ch];
      if (!kind) {
        throw new Error(
          `Arena "${name}": unbekanntes Zeichen "${ch}" in Zeile ${r + 1}, Spalte ${c + 1} ` +
            '(fehlt in der legend).',
        );
      }
      const cell = LEGEND_TO_CELL[kind];
      if (cell === undefined) {
        throw new Error(`Arena "${name}": Legenden-Typ "${kind}" ist der Engine unbekannt.`);
      }
      row.push(cell);
      if (kind === 'spawn') player = [c, r];
      else if (kind === 'enemy') enemies.push([c, r]);
      else if (kind === 'mirror' || kind === 'generator') markers.push({ type: kind, col: c, row: r });
    }
    grid.push(row);
  }
  return { grid, markers, player, enemies };
}

// Einmalige Validierung beim Laden. Wirft mit klarer Meldung, wenn ein
// Layout unbrauchbar ist -- zur Laufzeit wird dann nicht mehr geprueft.
export function validateArenas(arenasData) {
  const arenas = (arenasData && arenasData.arenas) || arenasData || {};
  for (const name of Object.keys(arenas)) {
    const def = arenas[name];
    if (!def || !Array.isArray(def.grid) || !def.legend) {
      throw new Error(`Arena "${name}": braucht die Felder "grid" (Array) und "legend".`);
    }
    if (def.grid.length !== ROWS) {
      throw new Error(`Arena "${name}": ${def.grid.length} Zeilen, erwartet ${ROWS}.`);
    }
    def.grid.forEach((line, i) => {
      if (typeof line !== 'string' || line.length !== COLS) {
        throw new Error(
          `Arena "${name}": Zeile ${i + 1} ist ${String(line).length} Zeichen breit, erwartet ${COLS}.`,
        );
      }
    });
    const { grid, player, enemies } = arenaCells(def, name);
    if (!player) throw new Error(`Arena "${name}": kein Spieler-Spawn ("spawn") im Raster.`);
    if (!enemies.length) throw new Error(`Arena "${name}": kein Gegner-Spawn ("enemy") im Raster.`);
    // Flood-Fill EINMALIG hier: sind alle Gegner-Spawns erreichbar?
    const reach = reachableCells(grid, player[0], player[1]);
    const blocked = enemies.filter(([c, r]) => !reach.has(r * COLS + c));
    if (blocked.length) {
      const list = blocked.map(([c, r]) => `(${c},${r})`).join(', ');
      throw new Error(
        `Arena "${name}" ist unloesbar: Gegner-Spawn ${list} vom Spieler-Spawn ` +
          `(${player[0]},${player[1]}) aus nicht erreichbar.`,
      );
    }
  }
  return true;
}

// Anzahl der 'enemy'-markierten Zellen eines festen Layouts (Phase 14):
// run.js braucht das VOR createState(), um Boss + eingekaufte Unterstuetzung
// auf die tatsaechlich vorhandenen Spawnpunkte zu kuerzen -- wiederverwendet
// dieselbe arenaCells()-Zaehlung statt sie zu duplizieren.
export function arenaEnemySpawnCount(arenasData, name) {
  const arenas = (arenasData && arenasData.arenas) || arenasData || {};
  const def = arenas[name];
  if (!def) return 0;
  return arenaCells(def, name).enemies.length;
}

// Baut einen Raum aus einem festen Layout (Weiche fuer `fixedLayout`).
export function buildArenaRoom(arenasData, name, enemyCount) {
  const arenas = (arenasData && arenasData.arenas) || arenasData || {};
  const def = arenas[name];
  if (!def) throw new Error(`Unbekanntes fixedLayout "${name}" (nicht in data/arenas.json).`);
  const { grid, markers, player, enemies } = arenaCells(def, name);
  // Mehr Gegner als Spawns -> die vorhandenen Spawns reihum nutzen.
  const spots = [];
  for (let i = 0; i < enemyCount; i++) spots.push(enemies[i % enemies.length]);
  return {
    grid,
    markers,
    playerSpawn: toSpawn(player),
    enemySpawns: spots.map(toSpawn),
    emergency: false,
    fixedLayout: name,
  };
}

function pickCells(grid, matchChar) {
  const cells = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] === matchChar) cells.push([c, r]);
    }
  }
  return cells;
}

function sampleN(rng, list, n) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// Raum-Gefahren (Phase 15): GENAU EIN Element pro Raum (ab
// tilesData.hazards.minRoom, Wahl + Raumnummer-Gate laufen in run.js --
// hier kommt nur der bereits gewuerfelte `type`). Wird NACHTRAEGLICH auf
// das schon validierte Layout aufgesetzt -- braucht deshalb KEINE zweite
// Flood-Fill-Pruefung:
//  - Oel/Foerderband/Laser etikettieren nur vorhandene BODEN-Zellen um
//    (keine Wandaenderung, Erreichbarkeit unveraendert).
//  - Eine bewegliche Wand macht eine vorhandene SOLIDE Zelle reversibel;
//    ihr geschlossener Ausgangszustand ist identisch zum validierten
//    Layout, ihr offener Zustand kann die erreichbare Flaeche nur
//    VERGROESSERN (derselbe Beweis wie bei zerstoerbaren Waenden, Phase 11).
// `exclude` (Set von "col,row") haelt Spieler-/Gegner-Spawns frei, damit
// niemand mitten in einer Gefahr startet.
export function placeRoomHazard(grid, rng, hazardsCfg, type, exclude) {
  if (!hazardsCfg || !type) return null;
  const skip = exclude || new Set();
  if (type === 'movingWall') {
    const cfg = hazardsCfg.movingWall || {};
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    // Nur solide Zellen mit mind. einem Boden-Nachbarn -- sonst aendert
    // das Oeffnen nichts (mitten in einem massiven Block).
    const candidates = pickCells(grid, '#').filter(
      ([c, r]) => !skip.has(`${c},${r}`) && dirs.some(([dc, dr]) => grid[r + dr][c + dc] === '.'),
    );
    const picked = sampleN(rng, candidates, cfg.count ?? 1);
    if (!picked.length) return null;
    return { type, cells: picked.map(([c, r]) => ({ col: c, row: r })), intervalS: cfg.intervalS ?? 8 };
  }
  if (type === 'oil' || type === 'conveyor' || type === 'laser') {
    const cfg = hazardsCfg[type] || {};
    const candidates = pickCells(grid, '.').filter(([c, r]) => !skip.has(`${c},${r}`));
    const picked = sampleN(rng, candidates, cfg.count ?? 2);
    if (!picked.length) return null;
    const cells = picked.map(([c, r]) => ({ col: c, row: r }));
    if (type === 'conveyor') {
      const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
      const dir = dirs[Math.floor(rng() * dirs.length)];
      return { type, cells, dir, pushPx: cfg.pushPx ?? 90 };
    }
    if (type === 'oil') return { type, cells, gripPerSec: cfg.gripPerSec ?? 1.5 };
    return { type, cells }; // laser
  }
  return null;
}

// Hauptfunktion: generiert einen validierten Raum -- oder laedt ein festes
// Layout, wenn das Raumspec `fixedLayout` setzt (Weiche, Phase 0b).
export function generateRoom(tilesData, rng, enemyCount, weights, spec, arenasData, destructibleWalls, hazardType) {
  if (spec && spec.fixedLayout) {
    return buildArenaRoom(arenasData, spec.fixedLayout, enemyCount);
  }
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const grid = buildGrid(tilesData, rng, weights, destructibleWalls);
    const share = wallShare(grid);
    if (share < WALL_MIN || share > WALL_MAX) continue;
    const spawns = placeSpawns(grid, rng, enemyCount);
    if (!spawns) continue;
    const exclude = new Set(
      [spawns.player, ...spawns.enemies].map(([c, r]) => `${c},${r}`),
    );
    const hazard = placeRoomHazard(grid, rng, tilesData.hazards, hazardType, exclude);
    return {
      grid,
      playerSpawn: toSpawn(spawns.player),
      enemySpawns: spawns.enemies.map(toSpawn),
      emergency: false,
      hazard,
    };
  }
  // Notfall-Layout: darf nie fehlen und nie haengen.
  const room = buildFixedRoom(tilesData.emergencyRoom, enemyCount);
  room.emergency = true;
  return room;
}
