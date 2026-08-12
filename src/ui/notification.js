// Freischalt-Notification-System (PLAN-STARTMENU Phase 13): eine Toast-
// Queue fuer "zum ersten Mal gesehen"-Ereignisse -- Upgrade-Erhalt, Gegner-/
// Elite-/Boss-Erstsichtung, Klassen-Entdeckung.
//
// Bewusst reines DOM statt Canvas (Muster preview.js), aber KEIN `.overlay`:
// ein `pointer-events: none`-Element blockiert dadurch STRUKTURELL keine
// Eingabe (Plan-Vorgabe "blockiert keine Eingaben") und haengt an keinem
// run.phase-Zustand -- main.js ruft update(dt) als ALLERERSTES in seiner
// eigenen update()-Funktion auf, noch vor jedem fruehen `return` (Menue/
// Pause/Run-Overlay/kein Run), damit ein Toast auch auf dem Startbildschirm
// (Klassenwahl) tickt und automatisch verschwindet, ohne je die Spiellogik
// zu pausieren (Testschritt 5).

export function createNotifications({ durationS = 3.0 } = {}) {
  const el = document.createElement('div');
  el.id = 'toast';
  el.className = 'toast hidden';
  document.body.appendChild(el);

  const queue = [];
  let timer = 0;

  function showNext() {
    const next = queue.shift();
    if (!next) {
      el.classList.add('hidden');
      return;
    }
    el.textContent = `${next.icon} ${next.text}`;
    el.classList.remove('hidden');
    timer = durationS;
  }

  return {
    // icon: kurzes Glyph/Emoji, text: der Freischalt-Text ("Neu: Turbo").
    push(icon, text) {
      queue.push({ icon, text });
      // Kein Toast gerade sichtbar -> sofort zeigen. Sonst wartet der neue
      // Eintrag in der Reihe, bis update() den aktuellen abraeumt (Testschritt
      // 4: mehrere gleichzeitige Freischaltungen laufen nacheinander, nicht
      // uebereinander).
      if (el.classList.contains('hidden')) showNext();
    },
    update(dt) {
      if (el.classList.contains('hidden')) return;
      timer -= dt;
      if (timer <= 0) showNext();
    },
    // Fuer Tests/Debug: aktuell sichtbarer Text bzw. Warteschlangenlaenge.
    isShowing: () => !el.classList.contains('hidden'),
    queueLength: () => queue.length,
  };
}
