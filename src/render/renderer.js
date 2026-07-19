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
  breakable: '#6e5a41',
  breakableEdge: '#8a7355',
  bullet: '#e8e4d8',
  bulletOutline: '#8a8578',
  outline: '#1a1408',
  mineBody: '#3c4038',
  mineLight: '#ffd23c',
  mineLightHot: '#ff5030',
  explosion: '#ffb347',
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
      const breakable = wall.type === 'breakable';
      ctx.fillStyle = breakable ? COLORS.breakable : COLORS.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = breakable ? COLORS.breakableEdge : COLORS.wallEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x + 1, wall.y + 1, wall.w - 2, wall.h - 2);
      if (breakable) {
        // Riss-Andeutung, bis eigene Pixel-Art kommt (Phase 10).
        ctx.beginPath();
        ctx.moveTo(wall.x + 6, wall.y + 24);
        ctx.lineTo(wall.x + 14, wall.y + 14);
        ctx.lineTo(wall.x + 12, wall.y + 8);
        ctx.moveTo(wall.x + 14, wall.y + 14);
        ctx.lineTo(wall.x + 24, wall.y + 18);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  function drawMines(state) {
    const mcfg = state.data.mine;
    for (const m of state.mines) {
      ctx.fillStyle = COLORS.mineBody;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();

      // Blinklicht: aus im Fluchtfenster, langsam wenn scharf,
      // schnell + rot kurz vor der Selbstzuendung.
      const armed = m.age >= mcfg.armDelayS;
      if (!armed) continue;
      const remaining = mcfg.selfDetonateS - m.age;
      const hot = remaining < 2;
      const freq = hot ? 8 : 3;
      if (Math.sin(m.age * freq * Math.PI * 2) > 0) {
        ctx.fillStyle = hot ? COLORS.mineLightHot : COLORS.mineLight;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawExplosions(state) {
    const R = state.data.mine.explosionRadiusPx;
    for (const e of state.explosions) {
      const t = Math.min(e.age / 0.35, 1);
      ctx.strokeStyle = COLORS.explosion;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * t, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
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
      drawMines(state);
      drawWalls(state.walls);
      for (const t of state.tanks) drawTank(t, alpha);
      drawBullets(state.bullets, alpha);
      drawExplosions(state);
    },
  };
}
