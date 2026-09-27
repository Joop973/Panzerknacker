// Tueren und Raumsperre (AUFTRAG-UMBAU-V2 Phase D3) -- bewusst OHNE echte
// Dungeon-Erzeugung (die ersetzt erst D4 src/game/run.js: generateMap()).
// Dieses Modul ist deshalb komplett EIGENSTAENDIG: es haengt an keiner
// bestehenden Raum-/Run-Orchestrierung (state.js/run.js bleiben unangetastet),
// sondern baut zwei fest verdrahtete Testraeume und die Mechanik, zwischen
// ihnen ueber Tueren hin- und herzufahren -- exakt wie von der Phase verlangt.
//
// Architektur (bewusste Vereinfachung gegenueber einer echten Mehrraum-Welt):
// nur EIN Raum ist je "aktiv" (simuliert/kollidiert) -- Spielerposition ist
// immer LOKAL zum aktiven Raum (0..WIDTH x 0..HEIGHT), exakt wie ueberall
// sonst im Spiel. Ein Raumwechsel ist ein Teleport an die Eintrittsstelle des
// Zielraums, kein durchgaengiger Weltraum -- D4 kann diesen Baustein spaeter
// zu einem echten Raumgitter erweitern, ohne dass diese Phase das vorwegnimmt.
//
// Physik-Wiederverwendung: eine Tuer ist -- offen -- schlicht NICHT im
// walls[]-Array vorhanden (voll passierbar), -- geschlossen -- ein normales
// {x,y,w,h,type:'door'}-Wandobjekt darin (Aufgabe 5: Geschosse/Panzer
// blockieren dadurch automatisch ueber die BESTEHENDE, generische
// Kreis-gegen-AABB-Kollision (collision.js: resolveCircleWalls) bzw.
// Geschoss-Wand-Kollision (bullet.js: moveAxis) -- keine zweite Physik.

import { CELL, COLS, ROWS } from '../config.js';
import { resetCamera } from '../core/camera.js';
import { circleOverlapsAABB } from './collision.js';

// Tuersymbole fuer alle acht Raumtypen (Aufgabe 3). Sieben davon decken sich
// mit run.js: ROOM_TYPE_INFO (kein Import -- D3 ist bewusst eigenstaendig,
// s. Kopfkommentar); der achte ("boss") existiert dort nicht als eigener
// Eintrag (der Bossraum ist heute ein type:'combat'-Knoten mit isBoss:true),
// bekommt hier aber ein eigenes, optisch unterscheidbares Symbol. Farbe +
// Symbol zusammen (statt nur Emoji) sind aus der Distanz auf dem Handy
// zuverlaessiger erkennbar als Emoji allein.
export const DOOR_ROOM_TYPES = {
  combat: { symbol: '⚔', color: '#c0392b' },
  elite: { symbol: '★', color: '#e0a030' },
  treasure: { symbol: '◆', color: '#3fa7d6' },
  workshop: { symbol: '⚙', color: '#4caf50' },
  event: { symbol: '?', color: '#9b59b6' },
  cursed: { symbol: '☠', color: '#6c3483' },
  rest: { symbol: '⛺', color: '#8d6e63' },
  boss: { symbol: '♛', color: '#ffd23c' },
};

// Nur Raumtypen mit Gegnern sperren beim Betreten (Aufgabe 2: "im Kampf") --
// deckt sich mit run.js: ROOM_TYPE_INFO ("Keine Gegner" bei
// treasure/workshop/event/rest).
const LOCKING_TYPES = new Set(['combat', 'elite', 'cursed']);
export function roomLocks(type) {
  return LOCKING_TYPES.has(type);
}

function makeGrid() {
  const grid = [];
  for (let row = 0; row < ROWS; row++) {
    const line = [];
    for (let col = 0; col < COLS; col++) {
      const border = row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1;
      line.push(border ? '#' : '.');
    }
    grid.push(line);
  }
  return grid;
}

function buildBorderWalls(grid, doorCells) {
  const walls = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row][col] !== '#') continue;
      if (doorCells.has(row * 1000 + col)) continue; // Tuerzelle: kein Randwand-Objekt
      walls.push({ x: col * CELL, y: row * CELL, w: CELL, h: CELL, type: 'solid', col, row });
    }
  }
  return walls;
}

// Erzeugt eine Tuer -- physisch zunaechst OFFEN (kein Wandobjekt). `to*`
// beschreibt Zielraum + lokalen Eintrittspunkt im Zielraum (ein paar Zellen
// von dessen eigener Tuer entfernt, damit ein Rueckwechsel nicht sofort die
// Gegentuer erneut ausloest).
function makeDoor(col, row, roomType, toRoomId, toX, toY) {
  return {
    col,
    row,
    x: col * CELL,
    y: row * CELL,
    w: CELL,
    h: CELL,
    type: 'door',
    roomType,
    open: true,
    toRoomId,
    toX,
    toY,
  };
}

function setDoorOpen(room, door, open) {
  door.open = open;
  const idx = room.walls.findIndex((w) => w.type === 'door' && w.col === door.col && w.row === door.row);
  if (open) {
    if (idx >= 0) room.walls.splice(idx, 1);
  } else if (idx < 0) {
    room.walls.push({ x: door.x, y: door.y, w: door.w, h: door.h, type: 'door', col: door.col, row: door.row });
  }
}

// Aufgabe 2: alle Tueren EINES Raums sperren/freigeben.
export function lockRoom(room) {
  if (room.locked) return;
  room.locked = true;
  for (const d of room.doors) setDoorOpen(room, d, false);
}

export function clearRoom(room) {
  room.cleared = true;
  room.locked = false;
  for (const d of room.doors) setDoorOpen(room, d, true);
}

// Aufgabe 2: Betreten eines Raums -- sperrt (falls Kampfraum + nicht schon
// geraeumt) und setzt die Kamera auf volle Arenasicht. Ein bereits geraeumter
// Kampfraum sperrt beim erneuten Betreten NICHT wieder (Konvention: einmal
// geraeumt bleibt offen, wie beim bestehenden Kartengraphen auch).
export function enterRoom(world, roomId) {
  const room = world.rooms[roomId];
  world.currentRoomId = roomId;
  if (roomLocks(room.type) && !room.cleared) lockRoom(room);
  resetCamera();
  return room;
}

// Aufgabe 4: Durchfahren einer offenen Tuer wechselt den Raum. Eine
// geschlossene Tuer loest hier nichts aus (sie blockiert den Spieler ohnehin
// schon physisch ueber resolveCircleWalls, dies ist nur ein zusaetzliches
// Sicherheitsnetz gegen "durch die geschlossene Tuer geklickt"). Gibt die
// neue Raum-id zurueck, oder null, wenn kein Wechsel stattfand.
export function tickDoorCrossing(world, player) {
  const room = world.rooms[world.currentRoomId];
  const r = player.radius ?? 12;
  for (const d of room.doors) {
    if (!d.open) continue;
    if (!circleOverlapsAABB(player.x, player.y, r, d)) continue;
    player.x = d.toX;
    player.y = d.toY;
    enterRoom(world, d.toRoomId);
    return d.toRoomId;
  }
  return null;
}

// Baut die zwei fest verdrahteten Testraeume: A (Kampf, sperrt) und B
// (Rastplatz, sperrt nie) -- deckt damit in einem einzigen Testaufbau beide
// Verhalten ab (sperrender vs. nie sperrender Raumtyp). Tuer A liegt auf dem
// rechten, Tuer B auf dem linken Rand, mittig -- Eintrittspunkte liegen
// je zwei Zellen hinter der jeweiligen Gegentuer.
export function buildTestDungeon() {
  const doorRow = Math.floor(ROWS / 2);
  const aCol = COLS - 1;
  const bCol = 0;
  const entryIntoA = { x: (aCol - 2) * CELL + CELL / 2, y: doorRow * CELL + CELL / 2 };
  const entryIntoB = { x: (bCol + 2) * CELL + CELL / 2, y: doorRow * CELL + CELL / 2 };

  const gridA = makeGrid();
  const gridB = makeGrid();
  gridA[doorRow][aCol] = '.';
  gridB[doorRow][bCol] = '.';

  const doorA = makeDoor(aCol, doorRow, 'rest', 'B', entryIntoB.x, entryIntoB.y);
  const doorB = makeDoor(bCol, doorRow, 'combat', 'A', entryIntoA.x, entryIntoA.y);

  const roomA = {
    id: 'A',
    type: 'combat',
    grid: gridA,
    walls: buildBorderWalls(gridA, new Set([doorRow * 1000 + aCol])),
    doors: [doorA],
    locked: false,
    cleared: false,
  };
  const roomB = {
    id: 'B',
    type: 'rest',
    grid: gridB,
    walls: buildBorderWalls(gridB, new Set([doorRow * 1000 + bCol])),
    doors: [doorB],
    locked: false,
    cleared: false,
  };

  return { rooms: { A: roomA, B: roomB }, currentRoomId: 'A' };
}

// Zeichnet ein Tuersymbol (Aufgabe 3) -- gefuellter Kreis in der Raumtyp-
// Farbe + Symbol, Rahmen signalisiert offen (duenn, hell) vs. geschlossen
// (dick, dunkel) zusaetzlich zur Fuellung des Zellhintergrunds.
export function drawDoor(ctx, door) {
  const info = DOOR_ROOM_TYPES[door.roomType] || DOOR_ROOM_TYPES.combat;
  const cx = door.x + door.w / 2;
  const cy = door.y + door.h / 2;
  ctx.save();
  ctx.fillStyle = door.open ? '#2a2a2a' : '#111111';
  ctx.fillRect(door.x, door.y, door.w, door.h);
  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = door.open ? 2 : 4;
  ctx.strokeStyle = door.open ? '#ffffff' : '#555555';
  ctx.stroke();
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(info.symbol, cx, cy + 1);
  ctx.restore();
}
