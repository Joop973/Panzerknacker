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
const MINE_MAX_THROW = 142; // maximale Wurfweite (Welt-px, -25 %)

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

  // Minen-Button ist ein WURFSTICK: berueren + ziehen bestimmt Richtung
  // und Weite, Loslassen wirft die Bombe.
  let mineStick = null; // { id, cx, cy, dx, dy }
  let pendingThrow = null; // { angle, dist } (Welt) -- beim Loslassen gesetzt
  const mineBtn = document.createElement('button');
  mineBtn.id = 'mineBtn';
  const mineKnob = document.createElement('div');
  mineKnob.id = 'mineKnob';
  const mineLabel = document.createElement('span');
  mineLabel.textContent = 'BOMBE';
  mineBtn.appendChild(mineLabel);
  mineBtn.appendChild(mineKnob);
  document.body.appendChild(mineBtn);

  function mineDrag() {
    if (!mineStick) return null;
    const len = Math.hypot(mineStick.dx, mineStick.dy);
    if (len < 4) return { angle: 0, dist: 0 };
    const frac = Math.min(1, len / MINE_STICK_R);
    return { angle: Math.atan2(mineStick.dy, mineStick.dx), dist: frac * MINE_MAX_THROW };
  }

  // Pointer-Events + setPointerCapture: der Zug bleibt am Button haengen,
  // auch wenn der Finger ihn verlaesst (robuster als Touch-Bubbling).
  mineBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!active) {
      active = true;
      document.body.classList.add('touch-on');
    }
    const r = mineBtn.getBoundingClientRect();
    mineStick = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, dx: 0, dy: 0 };
    mineKnob.style.transform = 'translate(-50%,-50%)';
    try {
      mineBtn.setPointerCapture(e.pointerId);
    } catch {
      /* egal */
    }
  });
  mineBtn.addEventListener('pointermove', (e) => {
    if (!mineStick || e.pointerId !== mineStick.id) return;
    e.preventDefault();
    let dx = e.clientX - mineStick.cx;
    let dy = e.clientY - mineStick.cy;
    const len = Math.hypot(dx, dy);
    if (len > MINE_STICK_R) {
      dx = (dx / len) * MINE_STICK_R;
      dy = (dy / len) * MINE_STICK_R;
    }
    mineStick.dx = dx;
    mineStick.dy = dy;
    mineKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  function endMineStick(e) {
    if (!mineStick || e.pointerId !== mineStick.id) return;
    pendingThrow = mineDrag(); // Bombe wird geworfen
    mineStick = null;
    mineKnob.style.transform = 'translate(-50%,-50%)';
  }
  mineBtn.addEventListener('pointerup', endMineStick);
  mineBtn.addEventListener('pointercancel', endMineStick);

  function showStick(el, s) {
    el.base.classList.remove('hidden');
    el.base.style.left = s.ox - STICK_R + 'px';
    el.base.style.top = s.oy - STICK_R + 'px';
    el.knob.style.left = STICK_R + s.dx - 16 + 'px';
    el.knob.style.top = STICK_R + s.dy - 16 + 'px';
  }

  function onStart(e) {
    if (e.target.closest && e.target.closest('button, input, .overlay')) return;
    e.preventDefault();
    if (!active) {
      active = true;
      document.body.classList.add('touch-on');
    }
    for (const t of e.changedTouches) {
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
    hasContact: () => left !== null || right !== null || mineStick !== null,
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
      const t = pendingThrow;
      pendingThrow = null;
      return t;
    },
    // Waehrend des Ziehens: Live-Vorschau { angle, dist } oder null.
    getMinePreview() {
      return mineStick ? mineDrag() : null;
    },
    // Sekundärslot (Phase 6): Beschriftung des Buttons, wenn die aktive
    // Sekundärwaffe wechselt (main.js ruft dies nach chooseUpgrade()/
    // Run-Start auf).
    setSecondaryLabel(text) {
      mineLabel.textContent = text;
    },
  };
}
