// Touch-Steuerung (Spec Abschnitt 9), Vollbild-Variante:
// Die Sticks entstehen ueberall dort, wo der Daumen aufsetzt -- auch in
// den leeren Flaechen NEBEN dem Canvas (Nutzer-Wunsch: ganzer
// Bildschirm). Deshalb DOM-basiert statt Canvas-gezeichnet:
// - Linke Bildschirmhaelfte: floating Stick -> fahren.
// - Rechte Haelfte: floating Stick -> zielen; solange ausgelenkt wird
//   automatisch geschossen (Cooldown + Magazin gelten in der Logik).
// - Minen-Button: fester runder Button unten rechts (eigenes
//   DOM-Element = natuerliche Exklusionszone, dort entsteht nie ein Stick).
// - Doppeltipp auf den linken Stick legt ebenfalls eine Mine.

const STICK_R = 48; // maximale Auslenkung in px (Bildschirm)
const DOUBLE_TAP_MS = 300;
const MINE_STICK_R = 54; // Zugweg des Minen-Wurfsticks (Bildschirm-px)
const MINE_MAX_THROW = 114; // maximale Wurfweite (Welt-px)

function makeStickEl() {
  const base = document.createElement('div');
  base.className = 'stick-base hidden';
  const knob = document.createElement('div');
  knob.className = 'stick-knob';
  base.appendChild(knob);
  document.body.appendChild(base);
  return { base, knob };
}

// cfg = data/input.json (stick.deadzone, stick.twoZone, stick.fireThreshold).
export function createTouchControls(cfg = {}) {
  const stickCfg = cfg.stick || {};
  const deadzone = stickCfg.deadzone ?? 0.15; // normalisiert (0..1)
  const twoZone = !!stickCfg.twoZone;
  const fireThreshold = stickCfg.fireThreshold ?? 0.6;

  let active = false;
  let left = null; // { id, ox, oy, dx, dy }
  let right = null;
  let mineQueued = false;
  let lastLeftTap = 0;

  const leftEl = makeStickEl();
  const rightEl = makeStickEl();
  // Zwei-Zonen-Modus: Ring auf dem Zielstick markiert die Feuergrenze.
  // Wird nur eingeblendet, wenn stick.twoZone in data/input.json wahr ist.
  const fireRing = document.createElement('div');
  fireRing.className = 'stick-firering hidden';
  rightEl.base.appendChild(fireRing);
  if (twoZone) {
    const d = fireThreshold * STICK_R * 2;
    fireRing.style.width = d + 'px';
    fireRing.style.height = d + 'px';
  }

  // Wurfstick-Fabrik (P4): Bombe UND Gadget sind derselbe Bedienbaustein --
  // beruehren + ziehen bestimmt Richtung und Weite, Loslassen loest aus.
  // Vorher stand das nur einmal fuer die Bombe da; beim zweiten Slot waere
  // Kopieren die schlechtere Wahl gewesen (der pointercancel-Fix aus P3
  // muesste dann an zwei Stellen stimmen).
  function makeThrowStick(id, label) {
    let stick = null; // { id, cx, cy, dx, dy }
    let pending = null; // { angle, dist } (Welt) -- beim Loslassen gesetzt
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'throwstick';
    const knob = document.createElement('div');
    knob.className = 'throwknob';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    btn.appendChild(labelEl);
    btn.appendChild(knob);
    document.body.appendChild(btn);

    function drag() {
      if (!stick) return null;
      const len = Math.hypot(stick.dx, stick.dy);
      if (len < 4) return { angle: 0, dist: 0 };
      const frac = Math.min(1, len / MINE_STICK_R);
      return { angle: Math.atan2(stick.dy, stick.dx), dist: frac * MINE_MAX_THROW };
    }

    // Pointer-Events + setPointerCapture: der Zug bleibt am Button haengen,
    // auch wenn der Finger ihn verlaesst (robuster als Touch-Bubbling).
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // Ein zweiter Finger darf den laufenden Zug NICHT uebernehmen: sonst
      // zeigt stick.id auf den neuen Finger und das Loslassen des ersten
      // wird wegen der id-Pruefung stillschweigend verworfen (P3).
      if (stick) return;
      if (!active) {
        active = true;
        document.body.classList.add('touch-on');
      }
      const r = btn.getBoundingClientRect();
      stick = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, dx: 0, dy: 0 };
      knob.style.transform = 'translate(-50%,-50%)';
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* egal */
      }
    });
    btn.addEventListener('pointermove', (e) => {
      if (!stick || e.pointerId !== stick.id) return;
      e.preventDefault();
      let dx = e.clientX - stick.cx;
      let dy = e.clientY - stick.cy;
      const len = Math.hypot(dx, dy);
      if (len > MINE_STICK_R) {
        dx = (dx / len) * MINE_STICK_R;
        dy = (dy / len) * MINE_STICK_R;
      }
      stick.dx = dx;
      stick.dy = dy;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });

    // Stick zuruecksetzen -- OHNE ueber das Ausloesen zu entscheiden.
    function reset(e) {
      stick = null;
      knob.style.transform = 'translate(-50%,-50%)';
      try {
        if (e && btn.hasPointerCapture?.(e.pointerId)) btn.releasePointerCapture(e.pointerId);
      } catch {
        /* Zeiger schon weg -- egal */
      }
    }
    // Loslassen = ausloesen. Der EINZIGE Weg, auf dem etwas fliegt.
    btn.addEventListener('pointerup', (e) => {
      if (!stick || e.pointerId !== stick.id) return;
      pending = drag();
      reset(e);
    });
    // pointercancel = das System hat den Touch abgebrochen (Anruf,
    // System-Geste, zu viele Finger). Der Spieler hat nie bestaetigt --
    // es darf NICHT ausgeloest werden (PLAN-INPUT.md, Bug P3).
    btn.addEventListener('pointercancel', (e) => {
      if (!stick || e.pointerId !== stick.id) return;
      reset(e);
    });

    return {
      el: btn,
      isHeld: () => !!stick,
      preview: () => (stick ? drag() : null),
      consume() {
        const t = pending;
        pending = null;
        return t;
      },
      setLabel(text) {
        labelEl.textContent = text;
      },
      setVisible(on) {
        btn.classList.toggle('slot-empty', !on);
      },
    };
  }

  const mine = makeThrowStick('mineBtn', 'BOMBE');
  const gadget = makeThrowStick('gadgetBtn', 'GADGET');
  gadget.setVisible(false); // Start: kein Gadget ausgeruestet

  function showStick(el, s) {
    el.base.classList.remove('hidden');
    el.base.style.left = s.ox - STICK_R + 'px';
    el.base.style.top = s.oy - STICK_R + 'px';
    el.knob.style.left = STICK_R + s.dx - 16 + 'px';
    el.knob.style.top = STICK_R + s.dy - 16 + 'px';
  }

  // Bedienelemente (Bomben-/Dash-/Pause-Button, Eingabefelder, Overlays)
  // sind natuerliche Sperrzonen -- dort entsteht nie ein Stick.
  // Bewusst PRO BERUEHRUNG geprueft: e.target gilt nur fuer die erste
  // Beruehrung eines Ereignisses. Wer gleichzeitig den Bombenknopf und die
  // Fahrflaeche antippt, hat sonst BEIDE Beruehrungen verworfen -- der
  // Fahrstick waere stumm geblieben.
  const inBlockedZone = (target) => !!(target && target.closest && target.closest('button, input, .overlay'));

  function onStart(e) {
    const usable = [...e.changedTouches].filter((t) => !inBlockedZone(t.target));
    if (!usable.length) return;
    e.preventDefault();
    if (!active) {
      active = true;
      document.body.classList.add('touch-on');
    }
    for (const t of usable) {
      if (t.clientX < window.innerWidth / 2 && left === null) {
        const now = performance.now();
        if (now - lastLeftTap < DOUBLE_TAP_MS) mineQueued = true; // Doppeltipp
        lastLeftTap = now;
        left = { id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
        showStick(leftEl, left);
      } else if (t.clientX >= window.innerWidth / 2 && right === null) {
        right = { id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
        showStick(rightEl, right);
        if (twoZone) fireRing.classList.remove('hidden');
      }
    }
  }

  function updateStick(stick, el, t) {
    let dx = t.clientX - stick.ox;
    let dy = t.clientY - stick.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    stick.dx = dx;
    stick.dy = dy;
    showStick(el, stick);
  }

  function onMove(e) {
    if (!left && !right) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (left && t.identifier === left.id) updateStick(left, leftEl, t);
      if (right && t.identifier === right.id) updateStick(right, rightEl, t);
    }
  }

  function onEnd(e) {
    for (const t of e.changedTouches) {
      if (left && t.identifier === left.id) {
        left = null;
        leftEl.base.classList.add('hidden');
      }
      if (right && t.identifier === right.id) {
        right = null;
        rightEl.base.classList.add('hidden');
        fireRing.classList.add('hidden');
      }
    }
  }

  window.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
  window.addEventListener('touchcancel', onEnd);

  // Dieser Treiber wird ausschliesslich von src/core/input.js gelesen --
  // die Spiellogik sieht ihn nie direkt.
  return {
    isActive: () => active,
    // Liegt gerade ein Finger? (Quellen-Erkennung in input.js)
    hasContact: () => left !== null || right !== null || mine.isHeld() || gadget.isHeld(),
    getMove() {
      if (!left) return { x: 0, y: 0 };
      return { x: left.dx / STICK_R, y: left.dy / STICK_R };
    },
    // Normalisierte Zielrichtung { x, y, mag } (mag 0..1) oder null,
    // wenn der Stick innerhalb der Deadzone liegt.
    getAimVector() {
      if (!right) return null;
      const len = Math.hypot(right.dx, right.dy);
      const mag = len / STICK_R;
      if (mag < deadzone) return null;
      return { x: right.dx / len, y: right.dy / len, mag: Math.min(1, mag) };
    },
    // Doppeltipp-Mine (flankengetriggert).
    consumeSecondary() {
      const m = mineQueued;
      mineQueued = false;
      return m;
    },
    // Wurfstick losgelassen -> { angle, dist } (Welt-px) oder null.
    consumeThrow() {
      return mine.consume();
    },
    // Waehrend des Ziehens: Live-Vorschau { angle, dist } oder null.
    // Bombe und Gadget haben BEWUSST getrennte Abfragen: sie zeichnen
    // unterschiedliche Vorschauen (Wurfbogen vs. Hakenlinie), ein
    // gemeinsamer Rueckgabewert wuerde beim Zielen mit dem Gadget die
    // Bombenvorschau zeigen.
    getMinePreview() {
      return mine.preview();
    },
    // --- Gadgetslot (P4): zweiter, baugleicher Wurfstick ----------------
    consumeGadgetThrow() {
      return gadget.consume();
    },
    isGadgetHeld() {
      return gadget.isHeld();
    },
    getGadgetPreview() {
      return gadget.preview();
    },
    // Knopf nur zeigen, wenn ueberhaupt ein Gadget ausgeruestet ist.
    setGadgetLabel(text) {
      gadget.setLabel(text || 'GADGET');
      gadget.setVisible(!!text);
    },
    // Liegt der Finger gerade auf dem Wurfstick? (PLAN-INPUT.md P1:
    // `secondaryHeld` im Aktionsmodell -- "wird gerade gezielt", getrennt
    // vom Ausloesen beim Loslassen.)
    isSecondaryHeld() {
      return mine.isHeld();
    },
    // Sekundärslot (Phase 6): Beschriftung des Buttons, wenn die aktive
    // Sekundärwaffe wechselt (main.js ruft dies nach chooseUpgrade()/
    // Run-Start auf).
    setSecondaryLabel(text) {
      mine.setLabel(text);
    },
  };
}
