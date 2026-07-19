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
const DEADZONE = 10;
const DOUBLE_TAP_MS = 300;

function makeStickEl() {
  const base = document.createElement('div');
  base.className = 'stick-base hidden';
  const knob = document.createElement('div');
  knob.className = 'stick-knob';
  base.appendChild(knob);
  document.body.appendChild(base);
  return { base, knob };
}

export function createTouchControls() {
  let active = false;
  let left = null; // { id, ox, oy, dx, dy }
  let right = null;
  let mineQueued = false;
  let lastLeftTap = 0;

  const leftEl = makeStickEl();
  const rightEl = makeStickEl();

  const mineBtn = document.createElement('button');
  mineBtn.id = 'mineBtn';
  mineBtn.textContent = 'MINE';
  document.body.appendChild(mineBtn);
  mineBtn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      mineQueued = true;
    },
    { passive: false },
  );

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
      }
    }
  }

  window.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
  window.addEventListener('touchcancel', onEnd);

  return {
    isActive: () => active,
    getMove() {
      if (!left) return { x: 0, y: 0 };
      return { x: left.dx / STICK_R, y: left.dy / STICK_R };
    },
    // Zielrichtung in Bildschirm-Pixeln; null wenn nicht ausgelenkt.
    getAimDir() {
      if (!right) return null;
      if (Math.hypot(right.dx, right.dy) < DEADZONE) return null;
      return { x: right.dx, y: right.dy };
    },
    isAutoFire() {
      return this.getAimDir() !== null;
    },
    consumeMine() {
      const m = mineQueued;
      mineQueued = false;
      return m;
    },
  };
}
