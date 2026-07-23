// Debug-Overlay, Taste F1 (Spec Abschnitt 12).
//
// Zeigt: FPS, Entity-Zahl, Kollisionsformen (Kreise + Wand-AABBs),
// Geschossbahnen und den Abpraller-Zaehler jedes Geschosses.
// Ab Phase 2 dauerhaft mitzupflegen.

const COLORS = {
  shape: '#00e5ff',
  trail: 'rgba(255, 120, 0, 0.7)',
  text: '#00e5ff',
  panelBg: 'rgba(0, 0, 0, 0.6)',
};

export function createDebugOverlay(ctx) {
  function drawWallBoxes(walls) {
    ctx.strokeStyle = COLORS.shape;
    ctx.lineWidth = 1;
    for (const wall of walls) {
      ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
    }
  }

  function drawCircle(x, y, r) {
    ctx.strokeStyle = COLORS.shape;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawTrails(bullets) {
    ctx.strokeStyle = COLORS.trail;
    ctx.lineWidth = 1;
    for (const b of bullets) {
      if (b.trail.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(b.trail[0].x, b.trail[0].y);
      for (let i = 1; i < b.trail.length; i++) {
        ctx.lineTo(b.trail[i].x, b.trail[i].y);
      }
      ctx.stroke();
    }
  }

  function drawRicochetCounters(bullets) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (const b of bullets) {
      ctx.fillText(String(b.ricochetsLeft), b.x, b.y - 8);
    }
    ctx.textAlign = 'left';
  }

  // Zuendradius scharfer Minen als gestrichelter Kreis.
  function drawMineRadii(state) {
    const mcfg = state.data.mine;
    ctx.strokeStyle = COLORS.trail;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const R = state.data.balance.mine.radius;
    for (const m of state.mines) {
      if (m.age < mcfg.armDelayS) continue;
      ctx.beginPath();
      ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawPanel(state, fps) {
    const liveTanks = state.tanks.filter((t) => t.alive).length;
    const entities = liveTanks + state.bullets.length + state.mines.length;
    const lines = [
      `FPS ${fps.toFixed(0)}`,
      `Entities ${entities}`,
      `Tanks ${liveTanks}/${state.tanks.length}`,
      `Bullets ${state.bullets.length}`,
      `Mines ${state.mines.length}`,
      `Cooldown ${state.player.cooldown.toFixed(2)}s`,
    ];
    ctx.fillStyle = COLORS.panelBg;
    ctx.fillRect(4, 4, 120, 14 * lines.length + 8);
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px monospace';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 10, 18 + i * 14);
    }
  }

  return {
    render(state, fps) {
      drawWallBoxes(state.walls);
      for (const t of state.tanks) {
        if (t.alive) drawCircle(t.x, t.y, t.cfg.radius);
      }
      for (const b of state.bullets) drawCircle(b.x, b.y, b.radius);
      for (const m of state.mines) drawCircle(m.x, m.y, m.radius);
      drawMineRadii(state);
      drawTrails(state.bullets);
      drawRicochetCounters(state.bullets);
      drawPanel(state, fps);
    },
  };
}
