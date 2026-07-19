// Touch-Steuerung (Spec Abschnitt 9: Mobile, Landscape).
//
// - Linke Bildschirmhaelfte: floating Stick -> fahren.
// - Rechte Haelfte: floating Stick -> zielen; solange ausgelenkt wird
//   automatisch geschossen (Auto-Fire; Cooldown + Magazin gelten in der
//   Spiellogik).
// - Minen-Button unten rechts mit Exklusionszone 80x80 px: Touches, die
//   dort starten, erzeugen NIE einen Stick, sondern legen die Mine.
// - Doppeltipp auf den linken Stick legt ebenfalls eine Mine.
// "Floating": der Stick erscheint dort, wo der Daumen aufsetzt.

import { WIDTH, HEIGHT } from '../config.js';

const STICK_R = 40; // maximale Auslenkung in px
const DEADZONE = 10; // ab hier gilt der Ziel-Stick als ausgelenkt
const EXCLUSION = 80; // Kantenlaenge der Minen-Button-Zone
const DOUBLE_TAP_MS = 300;

export function createTouchControls(canvas) {
  let active = false; // wurde je ein Touch gesehen? (Geraete-Erkennung)
  let left = null; // { id, ox, oy, dx, dy }
  let right = null;
  let mineQueued = false;
  let lastLeftTap = 0;

  function toCanvas(t) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (t.clientX - rect.left) * (canvas.width / rect.width),
      y: (t.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function inExclusion(p) {
    return p.x > WIDTH - EXCLUSION && p.y > HEIGHT - EXCLUSION;
  }

  function onStart(e) {
    if (e.target.closest && e.target.closest('button, input, .overlay')) return;
    e.preventDefault();
    active = true;
    for (const t of e.changedTouches) {
      const p = toCanvas(t);
      if (inExclusion(p)) {
        mineQueued = true;
        continue;
      }
      if (p.x < WIDTH / 2 && left === null) {
        const now = performance.now();
        if (now - lastLeftTap < DOUBLE_TAP_MS) mineQueued = true; // Doppeltipp
        lastLeftTap = now;
        left = { id: t.identifier, ox: p.x, oy: p.y, dx: 0, dy: 0 };
      } else if (p.x >= WIDTH / 2 && right === null) {
        right = { id: t.identifier, ox: p.x, oy: p.y, dx: 0, dy: 0 };
      }
    }
  }

  function updateStick(stick, p) {
    let dx = p.x - stick.ox;
    let dy = p.y - stick.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    stick.dx = dx;
    stick.dy = dy;
  }

  function onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const p = toCanvas(t);
      if (left && t.identifier === left.id) updateStick(left, p);
      if (right && t.identifier === right.id) updateStick(right, p);
    }
  }

  function onEnd(e) {
    for (const t of e.changedTouches) {
      if (left && t.identifier === left.id) left = null;
      if (right && t.identifier === right.id) right = null;
    }
  }

  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd);
  canvas.addEventListener('touchcancel', onEnd);

  function drawStick(ctx, s) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, STICK_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(s.ox + s.dx, s.oy + s.dy, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    isActive: () => active,
    getMove() {
      if (!left) return { x: 0, y: 0 };
      return { x: left.dx / STICK_R, y: left.dy / STICK_R };
    },
    // Zielrichtung (nicht normalisiert); null wenn nicht ausgelenkt.
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
    render(ctx) {
      if (!active) return;
      if (left) drawStick(ctx, left);
      if (right) drawStick(ctx, right);
      // Minen-Button (fest, unten rechts, in der Exklusionszone).
      ctx.fillStyle = 'rgba(200,178,74,0.5)';
      ctx.beginPath();
      ctx.arc(WIDTH - 44, HEIGHT - 44, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,18,8,0.9)';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MINE', WIDTH - 44, HEIGHT - 40);
      ctx.textAlign = 'left';
    },
  };
}
