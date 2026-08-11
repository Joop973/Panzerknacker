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

// --- 6. In-Game: Bombe zielen (rechter Stick) + werfen (LT loslassen) ------
// Nutzermeldung: der Controller legte die Bombe nur unter den Panzer, ohne
// Richtung/Weite. Jetzt zielt der rechte Stick waehrend LT gehalten wird, und
// beim Loslassen fliegt die Bombe dorthin -- wie der Handy-Wurfstick.
{
  releaseAll();
  const lt = inputCfg.gamepad.secondary; // 6
  const maxThrow = inputCfg.aim.throwMaxPx; // 114
  // LT halten + rechten Stick nach rechts (voller Ausschlag).
  pad.buttons[lt] = 1;
  pad.axes[2] = 1; // aimX rechts
  pad.axes[3] = 0; // aimY
  let st = input.getState(player);
  check(st.secondaryHeld === true, 'Gamepad: LT gehalten -> secondaryHeld nicht true');
  check(st.secondaryRelease === false, 'Gamepad: LT gehalten darf noch nicht werfen');
  check(
    st.secondaryAim && Math.abs(st.secondaryAim.angle - 0) < 1e-6 && Math.abs(st.secondaryAim.dist - maxThrow) < 1e-6,
    `Gamepad: Bomben-Zielvorgabe beim Halten ${JSON.stringify(st.secondaryAim)} statt {angle:0,dist:${maxThrow}}`,
  );
  // Live-Vorschau muss dieselbe Zielvorgabe liefern (Rendering).
  const prev = input.getMinePreview();
  check(
    prev && Math.abs(prev.dist - maxThrow) < 1e-6,
    `Gamepad: getMinePreview beim Zielen ${JSON.stringify(prev)} statt Wurfvorschau`,
  );
  // Halber Ausschlag -> halbe Weite (Weite ist dosierbar, nicht fest).
  pad.axes[2] = 0.5;
  st = input.getState(player);
  check(
    st.secondaryAim && Math.abs(st.secondaryAim.dist - maxThrow * 0.5) < 1e-6,
    `Gamepad: halber Stick -> Weite ${st.secondaryAim?.dist} statt ${maxThrow * 0.5}`,
  );
  // LT loslassen (Stick zentriert): jetzt wirft es -- mit der GEMERKTEN
  // Richtung/Weite (auf der fallenden Flanke ist der Stick schon los).
  pad.buttons[lt] = 0;
  pad.axes[2] = 0;
  st = input.getState(player);
  check(st.secondaryRelease === true, 'Gamepad: LT loslassen -> secondaryRelease nicht true');
  check(
    st.secondaryAim && Math.abs(st.secondaryAim.dist - maxThrow * 0.5) < 1e-6,
    `Gamepad: Wurf uebernimmt die gemerkte Zielvorgabe nicht (${JSON.stringify(st.secondaryAim)})`,
  );
  // Nach dem Wurf ist die Vorschau wieder leer.
  check(input.getMinePreview() == null, 'Gamepad: Vorschau nach dem Wurf nicht zurueckgesetzt');
}

// --- 7. In-Game: LT ohne Stick -> Sichtlinie/Wurf am Panzer (dist 0) -------
// Wie der Handy-Wurfstick beim blossen Antippen: sofort eine Sichtlinie + ein
// Explosionsradius AM Panzer, kein "unsichtbares" Ablegen.
{
  releaseAll();
  const lt = inputCfg.gamepad.secondary; // 6
  pad.buttons[lt] = 1; // nur LT, rechter Stick zentriert
  let st = input.getState(player);
  check(st.secondaryHeld === true, 'Gamepad: LT ohne Stick -> secondaryHeld nicht true');
  check(
    st.secondaryAim && st.secondaryAim.dist === 0,
    `Gamepad: LT ohne Stick -> Zielvorgabe ${JSON.stringify(st.secondaryAim)} statt {dist:0} (Vorschau am Panzer)`,
  );
  const prev = input.getMinePreview();
  check(
    prev && prev.dist === 0,
    `Gamepad: Sichtlinie am Panzer fehlt beim Halten ohne Stick (${JSON.stringify(prev)})`,
  );
  pad.buttons[lt] = 0;
  st = input.getState(player);
  check(st.secondaryRelease === true, 'Gamepad: LT loslassen -> secondaryRelease nicht true');
  check(
    st.secondaryAim && st.secondaryAim.dist === 0,
    'Gamepad: Wurf ohne Stick legt nicht am Panzer ab (dist 0)',
  );
}

// --- 8. Menue/Overlay: analoger linker Stick fuer den Gamepad-Cursor -------
// getMenuState liefert den ROHEN linken Stick, mit dem main.js den freien
// Maus-Cursor ueber die Overlays faehrt (menuDir bleibt fuer die diskrete
// Tastatur-Navigation).
{
  releaseAll();
  pad.axes[0] = 0.5; // linker Stick halb rechts
  pad.axes[1] = -1; // ganz hoch
  const m = input.getMenuState();
  check(m.stick && Math.abs(m.stick.x - 0.5) < 1e-6, `Gamepad: getMenuState.stick.x ${m.stick?.x} statt 0.5 (Cursor-Analogwert)`);
  check(m.stick && m.stick.y === -1, `Gamepad: getMenuState.stick.y ${m.stick?.y} statt -1`);
  // unter der Fahr-Deadzone -> 0 (kein Cursor-Zittern im Stillstand)
  releaseAll();
  pad.axes[0] = 0.05;
  const m2 = input.getMenuState();
  check(m2.stick.x === 0, `Gamepad: getMenuState.stick unter Deadzone ${m2.stick?.x} statt 0`);
}

if (failures) {
  console.error(`\n${failures} Gamepad-Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('Alle Gamepad-Tests bestanden.');
