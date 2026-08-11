// Screen-State-Machine fuer die Menue-Overlays (PLAN-STARTMENU Phase 1).
//
// Verwaltet, WELCHES Menue-Overlay sichtbar ist (Hauptmenue, Klassenwahl,
// Schwierigkeit, Einstellungen, Codex, Post-Run) plus einen Zurueck-Stack
// und die Anbindung an die Browser-History. Das Fokus-System selbst ist
// nicht neu -- jeder Screen bekommt eine createMenuNav-Instanz (ui/menunav.js),
// die die Tastatur-/Gamepad-Navigation macht.
//
// Die IN-RUN-Overlays (Upgrade/Karte/Shop/Event/Vorschau) laufen bewusst
// NICHT ueber diese Maschine -- sie haengen am Spielzustand (run.phase) und
// haben in main.js ihre eigene, davon getrennte Navigation (runOverlayNav).
//
// History-Modell (eine Quelle der Wahrheit): Vorwaerts-Navigation pusht einen
// Zustand (show -> pushState). JEDE Rueckwaertsnavigation -- Zurueck-Knopf,
// ESC, Controller-B ODER die Browser-Zurueck-Geste -- laeuft ueber
// history.back(); die eigentliche Anzeigeaenderung macht ausschliesslich der
// popstate-Handler (onPopState). So koennen Stack und History nie auseinander
// laufen.

import { createMenuNav } from './menunav.js';

export function createMenu({ history = (typeof window !== 'undefined' ? window.history : null) } = {}) {
  const screens = new Map(); // name -> { el, nav }
  let stack = []; // Namen, unterste = Wurzel
  let active = null; // aktuell sichtbarer Screen, null = Menues verborgen (Run laeuft)

  function showOnly(name) {
    for (const [n, s] of screens) s.el.classList.toggle('hidden', n !== name);
    active = name;
    const s = screens.get(name);
    // Fokus auf den Anfang -- sonst haengt die Hervorhebung auf einem
    // Element des zuletzt gezeigten Screens.
    s?.nav.reset();
  }

  return {
    // Einen Overlay-Screen anmelden. getFocusables: () => Element[] (nur
    // sichtbare, aktive Bedienelemente), genau wie in main.js fuer den
    // Startbildschirm.
    register(name, el, getFocusables) {
      screens.set(name, { el, nav: createMenuNav(getFocusables) });
      return this;
    },

    // Wurzel setzen (Erstanzeige oder Ruecksprung ins Hauptmenue nach einem
    // Run). Ersetzt den Stack, KEIN pushState -- ersetzt den aktuellen
    // History-Eintrag, damit die erste Zurueck-Geste nicht sofort die Seite
    // verlaesst.
    root(name) {
      stack = [name];
      showOnly(name);
      history?.replaceState?.({ menuDepth: 0 }, '');
      return this;
    },

    // Einen Screen oeffnen (Vorwaerts). Legt einen History-Eintrag an.
    show(name) {
      if (!screens.has(name) || name === active) return this;
      stack.push(name);
      history?.pushState?.({ menuDepth: stack.length - 1 }, '');
      showOnly(name);
      return this;
    },

    // Einen Schritt zurueck. Laeuft ueber history.back() -> popstate macht
    // die Anzeige. Gibt false zurueck, wenn wir schon an der Wurzel stehen.
    back() {
      if (stack.length <= 1) return false;
      if (history?.back) history.back();
      else this.onPopState(); // ohne echte History (Tests): direkt aufloesen
      return true;
    },

    // Vom popstate-Handler gerufen. Gibt zurueck, ob ein Menue-Screen
    // zurueckgezogen wurde (false = Menues gerade nicht sichtbar).
    onPopState() {
      if (!active) return false; // Run laeuft -> main.js behandelt das (Pause)
      if (stack.length <= 1) {
        // An der Wurzel nicht die Seite verlassen: Eintrag neu anlegen.
        history?.pushState?.({ menuDepth: 0 }, '');
        return true;
      }
      stack.pop();
      showOnly(stack[stack.length - 1]);
      return true;
    },

    // Alle Menue-Overlays verstecken (ein Run startet). Der Stack bleibt
    // erhalten -- root('main') nach dem Run stellt ihn ohnehin frisch her.
    hideAll() {
      for (const [, s] of screens) s.el.classList.add('hidden');
      active = null;
      return this;
    },

    current() {
      return active;
    },

    depth() {
      return stack.length;
    },

    // Jeden Logikschritt aufrufen, solange ein Menue sichtbar ist. menuState
    // kommt aus input.getMenuState(). menuBack (ESC / Controller-B) geht
    // einen Schritt zurueck, sonst navigiert der Fokus.
    update(menuState, dt) {
      if (!active) return;
      if (menuState.menuBack) {
        this.back();
        return;
      }
      screens.get(active)?.nav.update(menuState, dt);
    },
  };
}
