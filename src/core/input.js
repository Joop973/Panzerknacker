// Tastatur-Eingabe fuer Phase 1 (Spec Abschnitt 9: Desktop).
//
// WASD / Pfeiltasten = fahren. Touch und Gamepad kommen in spaeteren Phasen
// (Phase 9) dazu; die Schnittstelle (getMoveAxis) bleibt dabei erhalten.

export function createInput(target = window) {
  const pressed = new Set();

  function onKeyDown(e) {
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

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
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
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
