// Renderer (Spec Abschnitt 3: render/renderer.js).
//
// Phase 2: Boden, solid-Waende, Spielerpanzer (Rumpf + getrennter Turm)
// und Geschosse. Positionen werden zwischen zwei Physikschritten
// interpoliert (alpha), damit die Bewegung bei entkoppeltem Rendering
// fluessig bleibt. Reifenspuren, Kamera und Effekte folgen spaeter.

import { WIDTH, HEIGHT, CELL } from '../config.js';

const COLORS = {
  floor: '#1b1b22',
  grid: '#22222c',
  wall: '#4a4a5a',
  wallEdge: '#5e5e72',
  tankBody: '#c8b24a',
  tankOutline: '#2a2410',
  barrel: '#2a2410',
  bullet: '#e8e4d8',
  bulletOutline: '#8a8578',
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function createRenderer(ctx) {
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

  function drawPlayer(player, alpha) {
    if (!player.alive) return;
    const x = lerp(player.prevX, player.x, alpha);
    const y = lerp(player.prevY, player.y, alpha);
    const r = player.radius;

    // Rumpf.
    ctx.fillStyle = COLORS.tankBody;
    ctx.strokeStyle = COLORS.tankOutline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rohr in Turm-Richtung (unabhaengig vom Rumpf).
    ctx.strokeStyle = COLORS.barrel;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(player.turret) * (r + 8),
      y + Math.sin(player.turret) * (r + 8),
    );
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
      drawWalls(state.walls);
      drawPlayer(state.player, alpha);
      drawBullets(state.bullets, alpha);
    },
  };
}
