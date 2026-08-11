// Controller-/Gamepad-Eingabetest (dependency-frei, Node).
//
// Prueft src/core/input.js mit einem gestubbten Standard-Gamepad (Xbox).
// Hintergrund: Der Controller "reagierte gar nicht" im Menue, weil die
// Menue-Richtung nur aus der D-Pad-FLANKE kam -- der linke Stick navigierte
// gar nicht und ein gehaltenes D-Pad wiederholte nicht. getMenuState() liefert
// jetzt eine GEHALTENE Richtung aus Stick ODER D-Pad (menuAxis); die
// Wiederholung macht menunav.js. In-Game (Fahren/Feuern) war korrekt und wird
// hier mitbewacht.
//
// Gegenprobe (bestanden): stellt man in input.js wieder die alte edge-basierte
// menuDir her, wird "linker Stick -> menuDir.y" rot.

import fs from 'fs';

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    console.error('FEHLER: ' + msg);
    failures++;
  }
}

// --- Umgebung stubben, BEVOR input.js importiert wird -------------------
const pad = { axes: [0, 0, 0, 0], buttons: new Array(17).fill(0) };
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    getGamepads: () => [
      {
        index: 0,
        id: 'Xbox 360 Controller (STANDARD GAMEPAD)',
        connected: true,
        mapping: 'standard',
        timestamp: 1,
        axes: pad.axes.slice(),
        buttons: pad.buttons.map((v) => ({ pressed: v > 0.5, touched: v > 0, value: v })),
      },
      null,
      null,
      null,
    ],
  },
});
const noopTarget = { addEventListener() {}, removeEventListener() {} };
globalThis.window = { addEventListener() {}, removeEventListener() {}, innerWidth: 768 };
globalThis.document = { addEventListener() {}, removeEventListener() {} };
const fakeCanvas = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 768, height: 512 }),
  addEventListener() {},
  removeEventListener() {},
};

const inputCfg = JSON.parse(fs.readFileSync(new URL('../data/input.json', import.meta.url)));
const { createInput } = await import('../src/core/input.js');
const input = createInput(noopTarget, fakeCanvas, { inputCfg });
const player = { x: 100, y: 100 };

// Alle Achsen/Knoepfe zuruecksetzen (frischer Ausgangszustand pro Fall).
function releaseAll() {
  pad.axes = [0, 0, 0, 0];
  pad.buttons = new Array(17).fill(0);
  input.getMenuState(); // Flanken/gpPrev einmal glaetten
  input.getMenuState();
}

// --- 1. In-Game: linker Stick faehrt --------------------------------------
{
  releaseAll();
  pad.axes[0] = 1; // rechts
  let st = input.getState(player);
  check(st.move.x === 1 && st.move.y === 0, `Gamepad: linker Stick rechts -> move ${JSON.stringify(st.move)} statt {x:1,y:0}`);
  check(st.source === 'gamepad', `Gamepad: Quelle ${st.source} statt gamepad bei Stick-Bewegung`);
  pad.axes[0] = 0;
  pad.axes[1] = -1; // hoch
  st = input.getState(player);
  check(st.move.y === -1, `Gamepad: linker Stick hoch -> move.y ${st.move.y} statt -1`);
}

// --- 2. In-Game: RT feuert (manuell), unter Deadzone kein Fahren ----------
{
  releaseAll();
  const rt = inputCfg.gamepad.primaryFire; // 7
  pad.buttons[rt] = 1;
  const st = input.getState(player);
  check(st.firing === true, 'Gamepad: RT -> firing nicht true');
  check(st.primaryPressed === true, 'Gamepad: RT (frischer Druck) -> primaryPressed nicht true');
  // Zielen NUR mit dem rechten Stick, kein Autofire: ohne RT kein Feuer.
  pad.buttons[rt] = 0;
  pad.axes[2] = 1; // rechter Stick ausgelenkt
  const st2 = input.getState(player);
  check(st2.firing === false, 'Gamepad: rechter Stick allein feuert (Autofire) -- darf auf dem Controller nicht');
  check(st2.aimActive === true, 'Gamepad: rechter Stick setzt aimActive nicht');
}

// --- 3. Menue: GEHALTENE Richtung aus linkem Stick (der eigentliche Fix) ---
{
  releaseAll();
  const thr = inputCfg.stick.menuThreshold ?? 0.5;
  // knapp unter der Menue-Schwelle -> keine Menue-Bewegung
  pad.axes[1] = thr - 0.1;
  let m = input.getMenuState();
  check(m.menuDir.y === 0, `Gamepad: Stick unter menuThreshold bewegt das Menue (${m.menuDir.y})`);
  // deutlich darueber -> Richtung nach unten, und zwar GEHALTEN (mehrere Polls)
  pad.axes[1] = 1;
  m = input.getMenuState();
  check(m.menuDir.y === 1, `Gamepad: linker Stick unten -> menuDir.y ${m.menuDir.y} statt 1 (Stick navigiert Menue nicht)`);
  const m2 = input.getMenuState();
  check(m2.menuDir.y === 1, 'Gamepad: Menue-Richtung ist nicht GEHALTEN (kein Auto-Repeat moeglich)');
  // horizontale Achse fuer Regler (Lautstaerke)
  releaseAll();
  pad.axes[0] = 1;
  const mx = input.getMenuState();
  check(mx.menuDir.x === 1, `Gamepad: linker Stick rechts -> menuDir.x ${mx.menuDir.x} statt 1`);
}

// --- 4. Menue: D-Pad navigiert ebenfalls (gehalten) -----------------------
{
  releaseAll();
  const down = inputCfg.gamepad.dpad.down; // 13
  pad.buttons[down] = 1;
  const m = input.getMenuState();
  check(m.menuDir.y === 1, `Gamepad: D-Pad unten -> menuDir.y ${m.menuDir.y} statt 1`);
  const m2 = input.getMenuState();
  check(m2.menuDir.y === 1, 'Gamepad: D-Pad-Richtung nicht gehalten (kein Auto-Repeat)');
}

// --- 5. Menue: A bestaetigt ------------------------------------------------
{
  releaseAll();
  const a = inputCfg.gamepad.menuConfirm; // 0
  pad.buttons[a] = 1;
  const m = input.getMenuState();
  check(m.menuConfirm === true, 'Gamepad: A -> menuConfirm nicht true');
  // nur EINE Flanke -- der zweite Poll bei gehaltenem A darf nicht erneut
  // bestaetigen (sonst rattert die Auswahl durch).
  const m2 = input.getMenuState();
  check(m2.menuConfirm === false, 'Gamepad: gehaltenes A bestaetigt mehrfach (keine Flanke)');
}

// --- 6. Menue: B geht zurueck (PLAN-STARTMENU Phase 1) --------------------
{
  releaseAll();
  const b = inputCfg.gamepad.menuBack; // 1
  check(b != null, 'input.json: gamepad.menuBack fehlt');
  pad.buttons[b] = 1;
  const m = input.getMenuState();
  check(m.menuBack === true, 'Gamepad: B -> menuBack nicht true');
  // Nur EINE Flanke -- gehaltenes B darf nicht mehrfach zurueckspringen.
  const m2 = input.getMenuState();
  check(m2.menuBack === false, 'Gamepad: gehaltenes B loest mehrfach aus (keine Flanke)');
}

if (failures) {
  console.error(`\n${failures} Gamepad-Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('Alle Gamepad-Tests bestanden.');
