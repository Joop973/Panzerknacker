// Renderer (Spec Abschnitt 3: render/renderer.js).
//
// Phase 3: Boden, Reifenspuren-Schicht, Waende, alle Panzer (Spieler +
// Gegner, farbcodiert) und Geschosse. Positionen werden zwischen zwei
// Physikschritten interpoliert (alpha).

import { WIDTH, HEIGHT, CELL } from '../config.js';

const COLORS = {
  floor: '#1b1b22',
  grid: '#22222c',
  wall: '#4a4a5a',
  wallEdge: '#5e5e72',
  bullet: '#e8e4d8',
  bulletOutline: '#8a8578',
  outline: '#1a1408',
};

// Rumpffarben je Panzertyp (eigene Pixel-Art kommt in Phase 10).
const TANK_COLORS = {
  player: '#c8b24a',
  t_brown: '#8a5a33',
  t_grey: '#9aa0a8',
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createRenderer(ctx, tracks) {
  function drawFloor() {
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Dezentes Zellraster als Orientierung.
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = CELL; x < WIDTH; x += CELL) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, HEIGHT);
    }
    for (let y = CELL; y < HEIGHT; y += CELL) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(WIDTH, y + 0.5);
    }
    ctx.stroke();
  }

  function drawWalls(walls) {
    for (const wall of walls) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = COLORS.wallEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
    }
  }

  function drawTank(t, alpha) {
    if (!t.alive) return;
    const x = lerp(t.prevX, t.x, alpha);
    const y = lerp(t.prevY, t.y, alpha);
    const r = t.cfg.radius;

    // Rumpf.
    ctx.fillStyle = TANK_COLORS[t.type] || '#ffffff';
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rohr in Turm-Richtung (unabhaengig vom Rumpf).
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(t.turret) * (r + 8), y + Math.sin(t.turret) * (r + 8));
    ctx.stroke();
  }

  function drawBullets(bullets, alpha) {
    for (const b of bullets) {
      const x = lerp(b.prevX, b.x, alpha);
      const y = lerp(b.prevY, b.y, alpha);
      ctx.fillStyle = COLORS.bullet;
      ctx.strokeStyle = COLORS.bulletOutline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  return {
    render(state, alpha) {
      drawFloor();
      tracks.draw(ctx);
      drawWalls(state.walls);
      for (const t of state.tanks) drawTank(t, alpha);
      drawBullets(state.bullets, alpha);
    },
  };
}
