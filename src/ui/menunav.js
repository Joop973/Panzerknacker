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

export function createMenuNav(getFocusables) {
  let index = 0;
  let heldY = 0;
  let timer = 0;
  let heldX = 0; // eigener Flankenspeicher fuer die X-Achse (kein Wiederholen)
  let lastScrolled = null; // Phase 9: nur bei echtem Fokuswechsel scrollen

  function highlight(list) {
    for (const el of list) el.classList.remove('menu-focus');
    const el = list[index];
    el?.classList.add('menu-focus');
    // Phase 9 (Codex-Upgrades, Testschritt 5 "Scroll-Position folgt dem
    // Fokus"): highlight() laeuft pro update()-Tick bis zu zweimal, auch
    // wenn sich nichts bewegt hat -- nur bei einem ECHTEN Wechsel scrollen,
    // sonst waere es auf jedem Tick ein (wirkungsloses, aber unnoetiges)
    // scrollIntoView. Gilt fuer JEDEN Screen mit menunav (nicht nur lange
    // Listen), weil sonst auch ein normaler Knopf ausserhalb eines kurzen
    // Overlays haengen bleiben koennte.
    if (el && el !== lastScrolled) {
      el.scrollIntoView?.({ block: 'nearest' });
      lastScrolled = el;
    }
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
      lastScrolled = null;
    },
    // Vom Aufrufer jeden Logikschritt aufgerufen, waehrend das Overlay
    // aktiv ist. menuState kommt aus input.js: getMenuState().
    update(menuState, dt) {
      const list = getFocusables();
      if (!list.length) return;
      if (index >= list.length) index = list.length - 1;
      highlight(list);

      const y = menuState.menuDir.y;
      let fire = false;
      if (y !== heldY) {
        heldY = y;
        timer = REPEAT_FIRST_S;
        if (y !== 0) fire = true;
      } else if (y !== 0) {
        timer -= dt;
        if (timer <= 0) {
          fire = true;
          timer = REPEAT_S;
        }
      }
      if (fire) {
        index = (index + (y > 0 ? 1 : -1) + list.length) % list.length;
        highlight(list);
      }

      const x = menuState.menuDir.x;
      // X wird bewusst NICHT wiederholt wie Y -- ein Regler soll pro
      // Tastendruck/D-Pad-Schlag einen Schritt machen, nicht durchlaufen.
      if (x !== heldX) {
        heldX = x;
        if (x !== 0) adjustRange(list[index], x > 0 ? 1 : -1);
      }

      if (menuState.menuConfirm) activate(list[index]);
    },
  };
}
