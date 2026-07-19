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
  t_teal: '#3aa8a0',
  t_yellow: '#d4c23a',
  t_pink: '#d47ba6',
  t_green: '#5a9e4a',
  t_purple: '#8a5ad4',
  t_white: '#e8e8e8',
  t_black: '#33333c',
};

// Geschossfarben je Waffe.
const BULLET_COLORS = {
  bullet: { fill: '#e8e4d8', edge: '#8a8578' },
  rocket: { fill: '#ff9a4a', edge: '#a05620' },
  bounce_rocket: { fill: '#7ade6a', edge: '#3d8a30' },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Sichtbarkeit von t_white (Spec Abschnitt 5): unsichtbar ab 1,5 s nach
// Rundenstart; alle ~2 s flackert die Silhouette kurz auf (Schimmer).
// Rueckgabe: Alpha fuer das Zeichnen (0 = gar nicht zeichnen).
export function whiteAlpha(state) {
  const w = state.data.ai.white;
  if (state.time < w.invisibleAfterS) return 1;
  const phase = (state.time - w.invisibleAfterS) % w.shimmerIntervalS;
  return phase < w.shimmerDurationS ? 0.3 : 0;
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
      if (wall.type === 'hole') {
        // Loch: dunkle Grube, Panzer blockiert, Geschosse fliegen drueber.
        ctx.fillStyle = '#0c0c10';
        ctx.fillRect(wall.x + 2, wall.y + 2, wall.w - 4, wall.h - 4);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x + 3, wall.y + 3, wall.w - 6, wall.h - 6);
        continue;
      }
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

  function drawTank(state, t, alpha) {
    if (!t.alive) return;

    // t_white: unsichtbar bis auf den Schimmer (Muendungsblitz und
    // dicke Reifenspuren sind die anderen Tracking-Kanaele).
    let bodyAlpha = 1;
    if (t.type === 't_white') {
      bodyAlpha = whiteAlpha(state);
      if (bodyAlpha <= 0) return;
    }

    const x = lerp(t.prevX, t.x, alpha);
    const y = lerp(t.prevY, t.y, alpha);
    const r = t.cfg.radius;

    ctx.globalAlpha = bodyAlpha;

    // Rumpf. t_black bekommt einen hellen Rand, sonst verschwindet er
    // auf dem dunklen Boden.
    ctx.fillStyle = TANK_COLORS[t.type] || '#ffffff';
    ctx.strokeStyle = t.type === 't_black' ? '#8a8a99' : COLORS.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rohr in Turm-Richtung (unabhaengig vom Rumpf).
    ctx.strokeStyle = t.type === 't_black' ? '#8a8a99' : COLORS.outline;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(t.turret) * (r + 8), y + Math.sin(t.turret) * (r + 8));
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  function drawBullets(bullets, alpha) {
    for (const b of bullets) {
      const x = lerp(b.prevX, b.x, alpha);
      const y = lerp(b.prevY, b.y, alpha);
      const c = BULLET_COLORS[b.kind] || BULLET_COLORS.bullet;

      // Raketen bekommen einen kurzen Schweif entgegen der Flugrichtung.
      if (b.kind !== 'bullet') {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - (b.vx / sp) * 10, y - (b.vy / sp) * 10);
        ctx.stroke();
      }

      ctx.fillStyle = c.fill;
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawFlashes(state) {
    for (const f of state.flashes) {
      const t = 1 - f.age / 0.08;
      ctx.fillStyle = '#fff2b0';
      ctx.globalAlpha = t;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 3 + 4 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  return {
    render(state, alpha) {
      drawFloor();
      tracks.draw(ctx);
      drawMines(state);
      drawWalls(state.walls);
      for (const t of state.tanks) drawTank(state, t, alpha);
      drawBullets(state.bullets, alpha);
      drawFlashes(state);
      drawExplosions(state);
    },
  };
}
