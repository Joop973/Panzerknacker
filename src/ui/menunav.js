// P9: Tastatur-/Gamepad-Fokusnavigation fuer Overlays (SPEC.md 9:
// "Menü navigieren"). Touch braucht das nicht -- dort tippt man Knoepfe
// direkt an, deshalb liest dieses Modul nie den Touch-Treiber.
//
// Scope von P9 ist der Startbildschirm; die Funktion ist bewusst generisch
// (nimmt nur eine Liste von Elementen entgegen), damit spaetere Overlays
// (Pause, Upgrade-Screen) sie ohne Umbau mitbenutzen koennen.
//
// Bedienmodell: NUR die Y-Achse (hoch/runter) bewegt den Fokus durch die
// Liste -- passend zur senkrechten Anordnung der Knoepfe. Die X-Achse ist
// dem FOKUSSIERTEN Element vorbehalten, falls es horizontal einstellbar
// ist (nur der Lautstaerkeregler); sonst tut sie nichts. Auswahlreihen wie
// Schwierigkeit/Eingabeprofil sind bewusst normale Knopf-Reihen (Muster
// `#modeSelect`) und keine <select> -- jeder Knopf ist ein eigener
// Fokusstopp, das braucht keine Sonderbehandlung.

const REPEAT_FIRST_S = 0.35; // Verzoegerung bis zur ersten Wiederholung
const REPEAT_S = 0.12; // danach, solange die Richtung gehalten wird

// opts.bothAxes: In-Run-Overlays (Upgrade-Karten nebeneinander, Kartenknoten
// nebeneinander) sollen auch mit LINKS/RECHTS am Stick durch die Liste
// wandern, nicht nur hoch/runter -- dort gibt es keinen Regler, mit dem sich
// die X-Achse beissen koennte. Ohne die Option (Start-/Einstellungsseite)
// bleibt es beim reinen Y-Durchlauf, X nur fuer den Lautstaerkeregler.
export function createMenuNav(getFocusables, opts = {}) {
  const bothAxes = !!opts.bothAxes;
  let index = 0;
  let heldY = 0;
  let timer = 0;
  let heldX = 0; // eigener Flankenspeicher fuer die X-Achse (kein Wiederholen)

  function highlight(list) {
    for (const el of list) el.classList.remove('menu-focus');
    const el = list[index];
    el?.classList.add('menu-focus');
    return el;
  }

  // Nur der Regler reagiert auf die X-Achse -- ohne das waere er per
  // Tastatur/Gamepad gar nicht bedienbar (Enter allein kann keinen
  // Zwischenwert anwaehlen).
  function adjustRange(el, dir) {
    if (!el || el.tagName !== 'INPUT' || el.type !== 'range') return;
    const step = Number(el.step) || 1;
    const min = el.min !== undefined && el.min !== '' ? Number(el.min) : 0;
    const max = el.max !== undefined && el.max !== '' ? Number(el.max) : 100;
    const next = Math.max(min, Math.min(max, Number(el.value) + dir * step));
    if (next !== Number(el.value)) {
      el.value = String(next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Enter/A: Checkbox togglen (mit expliziten Events -- .click() allein
  // bildet ein natives Checkbox-Toggle nicht in jeder Umgebung nach),
  // sonst klicken.
  function activate(el) {
    if (!el) return;
    if (el.tagName === 'INPUT' && el.type === 'checkbox') {
      el.checked = !el.checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.click?.();
    }
  }

  return {
    // Setzt den Fokus auf das erste Element zurueck -- beim (Wieder-)Oeffnen
    // eines Overlays aufrufen, sonst haengt der Fokus auf einem Element,
    // das gerade gar nicht mehr sichtbar ist.
    reset() {
      index = 0;
      heldY = 0;
      timer = 0;
      heldX = 0;
    },
    // Vom Aufrufer jeden Logikschritt aufgerufen, waehrend das Overlay
    // aktiv ist. menuState kommt aus input.js: getMenuState().
    update(menuState, dt) {
      const list = getFocusables();
      if (!list.length) return;
      if (index >= list.length) index = list.length - 1;
      highlight(list);

      const focused = list[index];
      const isRange = focused && focused.tagName === 'INPUT' && focused.type === 'range';
      // Durchlauf-Richtung: immer Y; bei bothAxes zusaetzlich X, ausser das
      // fokussierte Element ist ein Regler (dann bleibt X fuer den Regler).
      const dirY = menuState.menuDir.y;
      const dirX = menuState.menuDir.x;
      const step = dirY || (bothAxes && !isRange ? dirX : 0);
      let fire = false;
      if (step !== heldY) {
        heldY = step;
        timer = REPEAT_FIRST_S;
        if (step !== 0) fire = true;
      } else if (step !== 0) {
        timer -= dt;
        if (timer <= 0) {
          fire = true;
          timer = REPEAT_S;
        }
      }
      if (fire) {
        index = (index + (step > 0 ? 1 : -1) + list.length) % list.length;
        highlight(list);
      }

      // X-Achse fuer den Regler -- nur wenn sie nicht schon fuer den Durchlauf
      // verbraucht wurde (bothAxes ohne Regler). X wird bewusst NICHT
      // wiederholt wie Y: ein Regler soll pro D-Pad-Schlag einen Schritt
      // machen, nicht durchlaufen.
      if (isRange || !bothAxes) {
        if (dirX !== heldX) {
          heldX = dirX;
          if (dirX !== 0) adjustRange(focused, dirX > 0 ? 1 : -1);
        }
      }

      if (menuState.menuConfirm) activate(list[index]);
    },
  };
}
