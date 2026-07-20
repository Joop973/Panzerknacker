// Renderer (Spec Abschnitt 3: render/renderer.js).
//
// Phase 3: Boden, Reifenspuren-Schicht, Waende, alle Panzer (Spieler +
// Gegner, farbcodiert) und Geschosse. Positionen werden zwischen zwei
// Physikschritten interpoliert (alpha).

import { WIDTH, HEIGHT, CELL } from '../config.js';
import {
  drawMines,
  drawTraps,
  drawRadar,
  drawFlashes,
  drawParticles,
  drawExplosions,
  drawTexts,
  drawThreatLines,
} from './effects.js';

// Optionen (von main.js gesetzt): reduzierte Bewegung schaltet
// Screenshake ab; Bedrohungslinien sind optional.
export const renderOpts = { reduceMotion: false, threatLines: true };

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

// Rumpffarben je Panzertyp (auch von der Raumvorschau genutzt).
export const TANK_COLORS = {
  player: '#3d8ef0', // einzige blaue Wanne -- unverwechselbar

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

export function createRenderer(ctx) {
  // Boden einmalig in ein Offscreen-Canvas backen (Politur: dezentes
  // Schachbrett statt reiner Rasterlinien, ohne Frame-Kosten).
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = WIDTH;
  floorCanvas.height = HEIGHT;
  {
    const f = floorCanvas.getContext('2d');
    f.fillStyle = COLORS.floor;
    f.fillRect(0, 0, WIDTH, HEIGHT);
    f.fillStyle = 'rgba(255,255,255,0.02)';
    for (let r = 0; r < HEIGHT / CELL; r++) {
      for (let c = 0; c < WIDTH / CELL; c++) {
        if ((r + c) % 2 === 0) f.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    f.strokeStyle = COLORS.grid;
    f.lineWidth = 1;
    f.beginPath();
    for (let x = CELL; x < WIDTH; x += CELL) {
      f.moveTo(x + 0.5, 0);
      f.lineTo(x + 0.5, HEIGHT);
    }
    for (let y = CELL; y < HEIGHT; y += CELL) {
      f.moveTo(0, y + 0.5);
      f.lineTo(WIDTH, y + 0.5);
    }
    f.stroke();
  }

  function drawFloor() {
    ctx.drawImage(floorCanvas, 0, 0);
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

    // Spawn-Schutz: schnelles Blinken (jede zweite Blinkphase unsichtbar).
    if (t.protect > 0 && Math.sin(t.protect * 30) < 0) return;

    ctx.globalAlpha = bodyAlpha;
    const body = TANK_COLORS[t.type] || '#ffffff';
    const isPlayer = t.type === 'player';
    const edge = t.type === 't_black' ? '#8a8a99' : isPlayer ? '#eaf2ff' : COLORS.outline;

    // Spieler: sanfter Glow + pulsierender Ring, damit er in jedem
    // Getuemmel sofort ins Auge springt.
    if (isPlayer) {
      ctx.fillStyle = 'rgba(80,160,255,0.14)';
      ctx.beginPath();
      ctx.arc(x, y, r + 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,200,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4 + 0.25 * Math.sin(state.time * 4);
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = bodyAlpha;
    }

    // Wanne mit Ketten, rotiert in Fahrtrichtung (Politur, Phase 10).
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t.heading);
    ctx.fillStyle = edge;
    ctx.fillRect(-r + 1, -r + 1, 2 * r - 2, 5); // Kette oben
    ctx.fillRect(-r + 1, r - 6, 2 * r - 2, 5); // Kette unten
    ctx.fillStyle = body;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.fillRect(-r + 2, -r + 5, 2 * r - 4, 2 * r - 10);
    ctx.strokeRect(-r + 2, -r + 5, 2 * r - 4, 2 * r - 10);
    ctx.restore();

    // Ziellinie des Spielers mit EINEM Abpraller-Vorgriff: Ray-March
    // wie ein Geschoss (achsweise Reflexion) -- man sieht die erste
    // Bande. Wichtig fuer Touch/Gamepad ohne Cursor.
    if (t.type === 'player') {
      let dx = Math.cos(t.turret);
      let dy = Math.sin(t.turret);
      let lx = x + dx * (r + 10);
      let ly = y + dy * (r + 10);
      const pts = [[lx, ly]];
      let bounced = false;
      for (let d = 0; d < 320; d += 6) {
        const nx = lx + dx * 6;
        const ny = ly + dy * 6;
        if (state.isSolid(nx, ny)) {
          if (bounced) break;
          const sx = state.isSolid(nx, ly);
          const sy = state.isSolid(lx, ny);
          if (sx) dx = -dx;
          if (sy) dy = -dy;
          if (!sx && !sy) {
            dx = -dx;
            dy = -dy;
          }
          bounced = true;
          pts.push([lx, ly]);
          continue;
        }
        lx = nx;
        ly = ny;
      }
      pts.push([lx, ly]);
      ctx.strokeStyle = 'rgba(140,200,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Turm + Rohr, unabhaengig vom Rumpf rotiert.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t.turret);
    ctx.fillStyle = edge;
    ctx.fillRect(4, -2.5, r + 4, 5); // Rohr
    ctx.fillStyle = body;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Krallenfalle: gefangener Panzer bekommt einen pulsierenden Ring.
    if (t.stunTimer > 0) {
      ctx.strokeStyle = '#c25a4a';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(x, y, r + 5 + Math.sin(t.stunTimer * 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
  }

  function drawBullets(bullets, alpha) {
    for (const b of bullets) {
      const x = lerp(b.prevX, b.x, alpha);
      const y = lerp(b.prevY, b.y, alpha);
      // Wolframkern-Kugeln kalt-blau eingefaerbt (durchschlagen breakable).
      const c = b.tungsten
        ? { fill: '#d9e2ff', edge: '#6a7adf' }
        : BULLET_COLORS[b.kind] || BULLET_COLORS.bullet;

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

      // Sprengschuss: oranger Glimmer um die Kugel.
      if (b.explosive) {
        ctx.strokeStyle = '#ff9a4a';
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, b.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
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

  return {
    render(state, alpha, tracks) {
      // Screenshake: deterministisches Wackeln aus der Spielzeit.
      const sh = renderOpts.reduceMotion ? 0 : state.shake || 0;
      ctx.save();
      if (sh > 0.1) {
        ctx.translate(Math.sin(state.time * 47) * sh, Math.cos(state.time * 53) * sh * 0.7);
      }
      drawFloor();
      tracks.draw(ctx);
      drawMines(ctx, state);
      drawTraps(ctx, state);
      if (renderOpts.threatLines) drawThreatLines(ctx, state);
      drawWalls(state.walls);
      for (const t of state.tanks) drawTank(state, t, alpha);
      drawRadar(ctx, state);
      drawBullets(state.bullets, alpha);
      drawFlashes(ctx, state);
      drawParticles(ctx, state);
      drawExplosions(ctx, state);

      drawTexts(ctx, state);
      ctx.restore();

      // Roter Flash nach eigenem Tod (ungeschuettelt, ueber allem).
      if (state.damageFlash > 0) {
        const a = state.damageFlash * (renderOpts.reduceMotion ? 0.18 : 0.35);
        ctx.fillStyle = `rgba(255,60,40,${a})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
    },
  };
}
