// Tastatur-/Maus- und Gamepad-Eingabe (Spec Abschnitt 9).
//
// Desktop: WASD/Pfeile = fahren, Maus = zielen, Linksklick = schiessen
// (kein Auto-Fire), Leertaste = Mine, Esc/P = Pause, F1 = Debug.
// Gamepad: linker Stick = fahren, rechter Stick = zielen + Auto-Fire,
// rechter Trigger = schiessen (manuell), A/X = Mine. Der Feuerraten-
// Cooldown gilt auf allen Wegen in der Spiellogik.
// (Touch liegt in ui/touchcontrols.js.)

export function createInput(target, canvas) {
  const pressed = new Set();
  // Zielposition in Canvas-Koordinaten (Arena-Pixel).
  const aim = { x: canvas.width / 2, y: 0 };
  let fireQueued = false;
  let mineQueued = false;
  let pauseQueued = false;
  let debug = false;

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onKeyDown(e) {
    if (e.code === 'F1') {
      // F1 oeffnet sonst die Browser-Hilfe.
      e.preventDefault();
      if (!e.repeat) debug = !debug;
      return;
    }
    if (e.code === 'Space') {
      // Leertaste scrollt sonst die Seite; kein Auto-Repeat.
      e.preventDefault();
      if (!e.repeat) mineQueued = true;
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) pauseQueued = true;
      return;
    }
    pressed.add(e.code);
    // Pfeiltasten scrollen sonst die Seite.
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }
  function onKeyUp(e) {
    pressed.delete(e.code);
  }
  function onBlur() {
    // Fokusverlust: alle Tasten loslassen, damit der Panzer nicht
    // "klebt" und weiterfaehrt.
    pressed.clear();
  }
  function onMouseMove(e) {
    const p = toCanvas(e);
    aim.x = p.x;
    aim.y = p.y;
  }
  function onMouseDown(e) {
    if (e.button !== 0) return;
    // Klicks auf UI-Elemente (Buttons, Overlays) sind keine Schuesse.
    if (e.target.closest && e.target.closest('button, input, .overlay')) return;
    const p = toCanvas(e);
    aim.x = p.x;
    aim.y = p.y;
    fireQueued = true;
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  target.addEventListener('mousemove', onMouseMove);
  target.addEventListener('mousedown', onMouseDown);

  // ---- Gamepad (gepollt, Edge-Erkennung fuer die Minen-Taste) ----
  let gpMineWasDown = false;

  function pollGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    let gp = null;
    for (const p of navigator.getGamepads()) {
      if (p && p.connected) {
        gp = p;
        break;
      }
    }
    if (!gp) {
      gpMineWasDown = false;
      return null;
    }
    const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    const move = { x: dz(gp.axes[0] || 0), y: dz(gp.axes[1] || 0) };
    const ax = dz(gp.axes[2] || 0);
    const ay = dz(gp.axes[3] || 0);
    // Rechter Stick ausgelenkt -> zielen + Auto-Fire.
    const aimDir = Math.hypot(ax, ay) > 0.25 ? { x: ax, y: ay } : null;
    const fireHeld = !!gp.buttons[7]?.pressed; // rechter Trigger (manuell)
    const mineDown = !!gp.buttons[0]?.pressed; // A (Xbox) / X (PlayStation)
    const minePressed = mineDown && !gpMineWasDown;
    gpMineWasDown = mineDown;
    return { move, aimDir, autoFire: aimDir !== null, fireHeld, minePressed };
  }

  return {
    pollGamepad,
    // Roher Bewegungsvektor (nicht normalisiert) aus den gedrueckten Tasten.
    getMoveAxis() {
      let x = 0;
      let y = 0;
      if (pressed.has('KeyA') || pressed.has('ArrowLeft')) x -= 1;
      if (pressed.has('KeyD') || pressed.has('ArrowRight')) x += 1;
      if (pressed.has('KeyW') || pressed.has('ArrowUp')) y -= 1;
      if (pressed.has('KeyS') || pressed.has('ArrowDown')) y += 1;
      return { x, y };
    },
    getAim() {
      return { x: aim.x, y: aim.y };
    },
    // Liefert genau einmal true pro Klick (wird beim Lesen konsumiert).
    consumeFire() {
      const f = fireQueued;
      fireQueued = false;
      return f;
    },
    // Liefert genau einmal true pro Leertasten-Druck.
    consumeMine() {
      const m = mineQueued;
      mineQueued = false;
      return m;
    },
    // Esc / P (einmal pro Druck).
    consumePause() {
      const p = pauseQueued;
      pauseQueued = false;
      return p;
    },
    isDebug() {
      return debug;
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('mousemove', onMouseMove);
      target.removeEventListener('mousedown', onMouseDown);
    },
  };
}
