// Pause (Spec Abschnitt 9).
//
// Ausloeser: Pause-Button oben mittig (HTML, ausserhalb der Daumen-
// zonen), Desktop Esc/P, Auto-Pause bei Tab-Fokusverlust und im
// Portrait-Modus (Overlay "Bitte Geraet drehen" kommt per CSS).

export function createPause() {
  let paused = false;
  return {
    toggle() {
      paused = !paused;
    },
    set(v) {
      paused = v;
    },
    isPaused() {
      return paused;
    },
  };
}
