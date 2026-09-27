// Tueren-/Raumsperre-Test (AUFTRAG-UMBAU-V2 Phase D3, dependency-frei).
//
// Prueft src/game/dungeon.js: zwei fest verdrahtete Testraeume (A: Kampf,
// sperrt beim Betreten; B: Rastplatz, sperrt nie), Tuersymbole fuer alle
// acht Raumtypen, Kamera-Reset bei Raumbetreten, und -- der Kern der
// Aufgabe -- dass eine GESCHLOSSENE Tuer sowohl Panzer (resolveCircleWalls)
// als auch Geschosse (bullet.js: updateBullet/moveAxis) ueber die
// BESTEHENDE, generische Wandkollision blockiert (keine zweite Physik).
//
// Gegenprobe (bestanden, danach zurueckgesetzt): setDoorOpen()'s
// Wandobjekt-Push beim Schliessen entfernt -> "geschlossene Tuer blockt
// Panzer" UND "geschlossene Tuer blockt Geschoss" wurden rot, alles andere
// blieb gruen (Struktur/Kamera/Raumwechsel sind davon unabhaengig).

import {
  DOOR_ROOM_TYPES,
  roomLocks,
  buildTestDungeon,
  enterRoom,
  lockRoom,
  clearRoom,
  tickDoorCrossing,
  drawDoor,
} from '../src/game/dungeon.js';
import { camera, resetCamera } from '../src/core/camera.js';
import { resolveCircleWalls } from '../src/game/collision.js';
import { createBullet, updateBullet } from '../src/game/bullet.js';
import { CELL, COLS, ROWS, WIDTH, HEIGHT } from '../src/config.js';

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    console.error('FEHLER: ' + msg);
    failures++;
  }
}

const bulletData = { balance: { bullet: { maxDistance: 5000 } } };

function fireAt(x, y, angle, walls) {
  const b = createBullet(x, y, angle, { speed: 400, radius: 4, owner: null, kind: 'bullet' });
  const state = { walls, laserWalls: [], sounds: [], data: bulletData };
  for (let i = 0; i < 30 && !b.dead; i++) updateBullet(b, state, 1 / 60);
  return b;
}

// --- (a) Struktur: acht Raumtypen, Sperr-Regel -------------------------
{
  const keys = Object.keys(DOOR_ROOM_TYPES);
  check(keys.length === 8, `DOOR_ROOM_TYPES hat ${keys.length} statt 8 Eintraege`);
  for (const k of keys) {
    const info = DOOR_ROOM_TYPES[k];
    check(typeof info.symbol === 'string' && info.symbol.length > 0, `${k}: kein Symbol`);
    check(typeof info.color === 'string' && info.color.startsWith('#'), `${k}: keine Farbe`);
  }
  check(roomLocks('combat') === true, 'combat sollte sperren');
  check(roomLocks('elite') === true, 'elite sollte sperren');
  check(roomLocks('cursed') === true, 'cursed sollte sperren');
  check(roomLocks('rest') === false, 'rest sollte NICHT sperren');
  check(roomLocks('workshop') === false, 'workshop sollte NICHT sperren');
  check(roomLocks('treasure') === false, 'treasure sollte NICHT sperren');
  check(roomLocks('event') === false, 'event sollte NICHT sperren');
}

// --- (b) buildTestDungeon(): zwei Raeume, je eine offene Tuer ----------
{
  const world = buildTestDungeon();
  check(Object.keys(world.rooms).length === 2, 'buildTestDungeon sollte genau zwei Raeume liefern');
  check(world.currentRoomId === 'A', 'Start sollte Raum A sein');
  const a = world.rooms.A;
  const b = world.rooms.B;
  check(a.type === 'combat', 'Raum A sollte Kampfraum sein');
  check(b.type === 'rest', 'Raum B sollte Rastplatz sein');
  check(a.doors.length === 1 && b.doors.length === 1, 'je genau eine Tuer je Raum');
  check(a.doors[0].open === true, 'Tuer A sollte anfangs offen sein');
  check(b.doors[0].open === true, 'Tuer B sollte anfangs offen sein');
  // Die Tuerzelle selbst darf KEIN Randwand-Objekt sein (sonst waere sie
  // physisch nie passierbar, auch nicht im offenen Zustand).
  const doorCellHasWall = (room, door) => room.walls.some((w) => w.col === door.col && w.row === door.row);
  check(!doorCellHasWall(a, a.doors[0]), 'Tuerzelle A hat faelschlich ein Randwand-Objekt');
  check(!doorCellHasWall(b, b.doors[0]), 'Tuerzelle B hat faelschlich ein Randwand-Objekt');
  // Ansonsten voller Rand: (COLS*2 + ROWS*2 - 4) Randzellen minus die eine Tuerzelle.
  const expectedBorder = COLS * 2 + ROWS * 2 - 4 - 1;
  check(a.walls.length === expectedBorder, `Raum A hat ${a.walls.length} Randwaende statt ${expectedBorder}`);
}

// --- (c) enterRoom(): Kampfraum sperrt + Kamera-Reset ------------------
{
  const world = buildTestDungeon();
  camera.x = 999;
  camera.y = 999;
  camera.zoom = 3;
  enterRoom(world, 'A');
  const a = world.rooms.A;
  check(a.locked === true, 'Raum A sollte nach dem Betreten gesperrt sein');
  check(a.doors[0].open === false, 'Tuer A sollte nach dem Sperren geschlossen sein');
  check(camera.x === WIDTH / 2 && camera.y === HEIGHT / 2 && camera.zoom === 1, 'Kamera sollte auf volle Arenasicht zurueckgesetzt sein');
  resetCamera();
}

// --- (d) enterRoom(): nicht-sperrender Raumtyp sperrt nie --------------
{
  const world = buildTestDungeon();
  enterRoom(world, 'B');
  const b = world.rooms.B;
  check(b.locked === false, 'Raum B (Rastplatz) sollte nie sperren');
  check(b.doors[0].open === true, 'Tuer B sollte offen bleiben');
}

// --- (e) Geschlossene Tuer blockt einen Panzer (Aufgabe 5, Panzerseite) ---
{
  const world = buildTestDungeon();
  enterRoom(world, 'A');
  const a = world.rooms.A;
  const door = a.doors[0];
  const radius = 12;
  // Panzer versucht, mitten durch die geschlossene Tuer zu fahren.
  const tank = { x: door.x + door.w / 2 - 4, y: door.y + door.h / 2 };
  resolveCircleWalls(tank, radius, a.walls);
  check(tank.x < door.x, `Panzer sollte an der geschlossenen Tuer stoppen (x=${tank.x}, Tuer bei ${door.x})`);
}

// --- (f) Geschlossene Tuer blockt ein gegnerisches Geschoss (Aufgabe 5) ---
{
  const world = buildTestDungeon();
  enterRoom(world, 'A');
  const a = world.rooms.A;
  const door = a.doors[0];
  const b = fireAt(door.x - 40, door.y + door.h / 2, 0, a.walls);
  check(b.dead === true, 'Geschoss sollte an der geschlossenen Tuer sterben');
  check(b.x < door.x + door.w, `Geschoss sollte die geschlossene Tuer nicht durchquert haben (x=${b.x})`);
}

// --- (g) Nach clearRoom() ist die Tuer wieder offen -- Panzer UND ------
//     Geschoss koennen passieren (Aufgabe 2 + 5, Ende-zu-Ende).
{
  const world = buildTestDungeon();
  enterRoom(world, 'A');
  const a = world.rooms.A;
  const door = a.doors[0];
  clearRoom(a);
  check(a.locked === false, 'Raum sollte nach clearRoom() entsperrt sein');
  check(a.doors[0].open === true, 'Tuer sollte nach clearRoom() offen sein');
  check(!a.walls.some((w) => w.type === 'door'), 'kein Tuer-Wandobjekt sollte nach dem Oeffnen mehr existieren');

  const tank = { x: door.x + door.w / 2 - 4, y: door.y + door.h / 2 };
  resolveCircleWalls(tank, 12, a.walls);
  check(tank.x === door.x + door.w / 2 - 4, 'Panzer sollte durch die offene Tuer fahren koennen (unveraendert)');

  const enemyBullet = fireAt(door.x - 40, door.y + door.h / 2, 0, a.walls);
  check(enemyBullet.dead === false, 'Geschoss sollte durch die offene Tuer fliegen');
  check(enemyBullet.x > door.x + door.w, 'Geschoss sollte die Tuerzelle ueberquert haben');
}

// --- (h) tickDoorCrossing(): Raumwechsel hin und zurueck ---------------
{
  const world = buildTestDungeon();
  enterRoom(world, 'A');
  clearRoom(world.rooms.A); // sonst blockt die geschlossene Tuer den Test-Spieler
  const doorA = world.rooms.A.doors[0];
  const player = { x: doorA.x + doorA.w / 2, y: doorA.y + doorA.h / 2, radius: 12 };
  const switched = tickDoorCrossing(world, player);
  check(switched === 'B', `tickDoorCrossing sollte nach B wechseln, lieferte ${switched}`);
  check(world.currentRoomId === 'B', 'currentRoomId sollte B sein');
  check(player.x === doorA.toX && player.y === doorA.toY, 'Spieler sollte am Eintrittspunkt von B stehen');
  check(world.rooms.B.locked === false, 'Raum B sollte auch nach dem Wechsel nicht sperren');

  // Zurueck nach A -- bereits geraeumt, darf NICHT wieder sperren.
  const doorB = world.rooms.B.doors[0];
  player.x = doorB.x + doorB.w / 2;
  player.y = doorB.y + doorB.h / 2;
  const switchedBack = tickDoorCrossing(world, player);
  check(switchedBack === 'A', `tickDoorCrossing sollte zurueck nach A wechseln, lieferte ${switchedBack}`);
  check(world.rooms.A.locked === false, 'ein bereits geraeumter Kampfraum sollte beim Wiederbetreten NICHT erneut sperren');
  check(world.rooms.A.doors[0].open === true, 'Tuer A sollte nach dem Wiederbetreten offen bleiben');
}

// --- (i) tickDoorCrossing() ohne Wirkung an einer geschlossenen Tuer ---
{
  const world = buildTestDungeon();
  enterRoom(world, 'A'); // sperrt (nicht geraeumt)
  const door = world.rooms.A.doors[0];
  const player = { x: door.x + door.w / 2, y: door.y + door.h / 2, radius: 12 };
  const switched = tickDoorCrossing(world, player);
  check(switched === null, 'eine geschlossene Tuer sollte keinen Raumwechsel ausloesen');
  check(world.currentRoomId === 'A', 'Raum sollte A bleiben');
}

// --- (j) drawDoor(): unterscheidbare Darstellung offen/geschlossen -----
{
  function makeRecordingCtx() {
    const calls = [];
    const state = { fillStyle: null, strokeStyle: null, lineWidth: null, font: null };
    const proxy = new Proxy(state, {
      get(t, k) {
        if (k in t) return t[k];
        return (...args) => calls.push([k, ...args]);
      },
      set(t, k, v) {
        t[k] = v;
        calls.push(['set:' + k, v]);
        return true;
      },
    });
    proxy.calls = calls;
    return proxy;
  }

  const world = buildTestDungeon();
  const door = world.rooms.A.doors[0];

  const ctxOpen = makeRecordingCtx();
  drawDoor(ctxOpen, door);
  const fillTextOpen = ctxOpen.calls.find((c) => c[0] === 'fillText');
  check(fillTextOpen && fillTextOpen[1] === DOOR_ROOM_TYPES.rest.symbol, 'offene Tuer sollte ihr Raumtyp-Symbol zeichnen');
  const lineWidthOpen = [...ctxOpen.calls].reverse().find((c) => c[0] === 'set:lineWidth');
  check(lineWidthOpen && lineWidthOpen[1] === 2, `offene Tuer sollte lineWidth 2 haben, war ${lineWidthOpen?.[1]}`);

  door.open = false;
  const ctxClosed = makeRecordingCtx();
  drawDoor(ctxClosed, door);
  const lineWidthClosed = [...ctxClosed.calls].reverse().find((c) => c[0] === 'set:lineWidth');
  check(lineWidthClosed && lineWidthClosed[1] === 4, `geschlossene Tuer sollte lineWidth 4 haben, war ${lineWidthClosed?.[1]}`);
}

// --- (k) alle acht Tuersymbole zeichnen ohne Absturz -------------------
{
  function fakeCtx() {
    return new Proxy(
      { fillStyle: null, strokeStyle: null, lineWidth: null, font: null, textAlign: null, textBaseline: null },
      { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true },
    );
  }
  for (const type of Object.keys(DOOR_ROOM_TYPES)) {
    const door = { x: 0, y: 0, w: CELL, h: CELL, roomType: type, open: true };
    drawDoor(fakeCtx(), door);
  }
}

if (failures) {
  console.error(`\n${failures} Dungeon-Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('Alle Dungeon-Tests (Phase D3) bestanden.');
