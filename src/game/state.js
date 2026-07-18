// Spiel-Zustand (Spec Abschnitt 3: game/state.js).
//
// Phase 1: eine hartcodierte Testarena aus solid-Waenden plus der
// Spielerpanzer. Kein Generator, kein JSON -- das kommt ab Phase 6.

import { CELL, COLS, ROWS } from '../config.js';
import { createPlayer } from './tank.js';

// Hartcodierte Testarena: 24x16 Zellen.
//   '#' = solid-Wand (unzerstoerbar, blockiert)
//   '.' = frei
// Aussenrand ist geschlossen; die inneren Cluster dienen als Testfaelle
// fuer Kanten- und Ecken-Sliding.
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
  // Spawn in einem offenen Bereich unten links.
  const player = createPlayer(3 * CELL + CELL / 2, 13 * CELL + CELL / 2);
  return { walls, player };
}
