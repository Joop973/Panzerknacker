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

// ---------------------------------------------------------------------------
// DG2: Tueren im echten Raumzustand (state.doors). Jede Tuer sitzt mittig an
// einer der vier Aussenwaende (zwei Zellen breit). Eine Tuer ist -- wie oben
// beschrieben -- schlicht eine feste Wand (geschlossen) bzw. Boden (offen);
// die Aussenwand-Zellen werden dafuer beim Raumaufbau freigeschnitten.
// ---------------------------------------------------------------------------
export const DOOR_OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const MID_C = [COLS / 2 - 1, COLS / 2];
const MID_R = [ROWS / 2 - 1, ROWS / 2];

// cells = die beiden Tuerzellen in der Aussenwand, pocket = die zwei Zellen
// dahinter (werden freigeraeumt, damit hinter der Tuer nie eine Innenwand steht).
export function doorGeometry(dir) {
  if (dir === 'n') return { cells: MID_C.map((c) => [c, 0]), pocket: MID_C.flatMap((c) => [[c, 1], [c, 2]]) };
  if (dir === 's') return { cells: MID_C.map((c) => [c, ROWS - 1]), pocket: MID_C.flatMap((c) => [[c, ROWS - 2], [c, ROWS - 3]]) };
  if (dir === 'w') return { cells: MID_R.map((r) => [0, r]), pocket: MID_R.flatMap((r) => [[1, r], [2, r]]) };
  return { cells: MID_R.map((r) => [COLS - 1, r]), pocket: MID_R.flatMap((r) => [[COLS - 2, r], [COLS - 3, r]]) };
}

// Baut state.doors aus den Tueren eines Dungeon-Raums und schneidet die
// Oeffnungen frei. locked=true schliesst sie sofort.
export function installDoors(state, room, dungeon, locked) {
  state.doors = [];
  for (const dir of ['n', 'e', 's', 'w']) {
    const toId = room.doors[dir];
    if (toId === null || toId === undefined) continue;
    const to = dungeon.byId.get(toId);
    const g = doorGeometry(dir);
    for (const [c, r] of g.pocket) state.setWallSolid(c, r, false);
    for (const [c, r] of g.cells) state.setWallSolid(c, r, false);
    state.doors.push({ dir, toId, roomType: to.isBoss ? 'boss' : to.type, cells: g.cells, open: true });
  }
  setDoorsLocked(state, locked);
}

export function setDoorsLocked(state, locked) {
  for (const d of state.doors || []) {
    d.open = !locked;
    for (const [c, r] of d.cells) state.setWallSolid(c, r, !!locked);
  }
}

// Richtung der Tuer, durch die der Spieler gerade hinausfaehrt (oder null).
// Nur offene Tueren: eine geschlossene ist eine Wand, der Spieler erreicht sie nie.
export function doorCrossing(state) {
  const p = state.player;
  if (!p || !p.alive) return null;
  for (const d of state.doors || []) {
    if (!d.open) continue;
    const [c0, r0] = d.cells[0];
    const [c1, r1] = d.cells[1];
    const inX = p.x >= Math.min(c0, c1) * CELL && p.x <= (Math.max(c0, c1) + 1) * CELL;
    const inY = p.y >= Math.min(r0, r1) * CELL && p.y <= (Math.max(r0, r1) + 1) * CELL;
    if (d.dir === 'n' && p.y < CELL && inX) return 'n';
    if (d.dir === 's' && p.y > (ROWS - 1) * CELL && inX) return 's';
    if (d.dir === 'w' && p.x < CELL && inY) return 'w';
    if (d.dir === 'e' && p.x > (COLS - 1) * CELL && inY) return 'e';
  }
  return null;
}

// Spieler knapp hinter die Tuer `dir` des neuen Raums stellen.
export function placePlayerAtDoor(state, dir) {
  const p = state.player;
  const W = COLS * CELL;
  const H = ROWS * CELL;
  if (dir === 'n') { p.x = W / 2; p.y = 1.6 * CELL; }
  else if (dir === 's') { p.x = W / 2; p.y = H - 1.6 * CELL; }
  else if (dir === 'w') { p.x = 1.6 * CELL; p.y = H / 2; }
  else { p.x = W - 1.6 * CELL; p.y = H / 2; }
  p.prevX = p.x;
  p.prevY = p.y;
  p.vx = 0;
  p.vy = 0;
}

// Zeichnet alle Tueren eines Raumzustands (Symbol des Zielraums).
export function drawStateDoors(ctx, state) {
  for (const d of state.doors || []) {
    const [c0, r0] = d.cells[0];
    const [c1, r1] = d.cells[1];
    const x = Math.min(c0, c1) * CELL;
    const y = Math.min(r0, r1) * CELL;
    const w = (Math.abs(c1 - c0) + 1) * CELL;
    const h = (Math.abs(r1 - r0) + 1) * CELL;
    drawDoor(ctx, { x, y, w, h, roomType: d.roomType, open: d.open });
  }
}
