// Effekt-Zeichnungen (aus renderer.js ausgelagert): Minen, Fallen,
// Radar-Marker, Muendungsblitze, Partikel, Explosionen, Schwebetexte.

export function drawMines(ctx, state) {
  const mcfg = state.data.mine;
  for (const m of state.mines) {
    ctx.fillStyle = '#3c4038';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fill();
    // Blinklicht: aus im Fluchtfenster, langsam wenn scharf,
    // schnell + rot kurz vor der Selbstzuendung.
    const armed = m.age >= mcfg.armDelayS;
    if (!armed) continue;
    const hot = mcfg.selfDetonateS - m.age < 2;
    const freq = hot ? 8 : 3;
    if (Math.sin(m.age * freq * Math.PI * 2) > 0) {
      ctx.fillStyle = hot ? '#ff5030' : '#ffd23c';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Krallenfallen: dunkelrote Kralle; gedimmt bis zur Scharfschaltung.
export function drawTraps(ctx, state) {
  for (const tr of state.traps) {
    const armed = tr.age >= tr.armS;
    ctx.globalAlpha = armed ? 0.9 : 0.4;
    ctx.strokeStyle = '#c25a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, tr.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
      ctx.moveTo(tr.x, tr.y);
      ctx.lineTo(tr.x + Math.cos(a) * tr.radius, tr.y + Math.sin(a) * tr.radius);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Radar-Upgrade: markiert alle lebenden Gegner -- auch t_white und
// hinter Waenden.
export function drawRadar(ctx, state) {
  if (!state.player.cfg.radar || !state.player.alive) return;
  ctx.strokeStyle = '#8ecae6';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(state.time * 5);
  for (const t of state.tanks) {
    if (t === state.player || !t.alive) continue;
    const r = t.cfg.radius + 6;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - r);
    ctx.lineTo(t.x + r, t.y);
    ctx.lineTo(t.x, t.y + r);
    ctx.lineTo(t.x - r, t.y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawFlashes(ctx, state) {
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

export function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    ctx.globalAlpha = 1 - pt.age / pt.life;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

export function drawExplosions(ctx, state) {
  const R = state.data.mine.explosionRadiusPx;
  for (const e of state.explosions) {
    const t = Math.min(e.age / 0.35, 1);
    ctx.strokeStyle = '#ffb347';
    ctx.globalAlpha = 1 - t;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, R * t, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Schwebende Kurztexte ("Abpraller!").
export function drawTexts(ctx, state) {
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  for (const tx of state.texts) {
    ctx.globalAlpha = 1 - tx.age / tx.life;
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, tx.x, tx.y - tx.age * 22);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
