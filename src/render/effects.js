// Effekt-Zeichnungen (aus renderer.js ausgelagert): Minen, Fallen,
// Radar-Marker, Muendungsblitze, Partikel, Explosionen, Schwebetexte.

export function drawMines(ctx, state) {
  const mcfg = state.data.mine;
  const bmine = state.data.balance.mine;
  for (const m of state.mines) {
    ctx.fillStyle = '#3c4038';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fill();
    // Blinklicht: aus im Fluchtfenster, langsam wenn scharf,
    // schnell + rot kurz vor der Selbstzuendung.
    const armed = m.age >= mcfg.armDelayS;
    if (!armed) continue;
    const remaining = bmine.fuse - m.age; // s bis Selbstzuendung
    // Eigene Minen: duenner Ring zeigt die Restzeit bis zur
    // Selbstzuendung (laeuft im Uhrzeigersinn ab).
    if (m.owner === state.player) {
      const frac = Math.max(0, remaining / bmine.fuse);
      ctx.strokeStyle = 'rgba(140,200,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius + 3, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      // Warnring: in den letzten warningTime Sekunden pulsiert ein Ring
      // im vollen Explosionsradius -- so ist die Detonation lesbar.
      if (remaining <= bmine.warningTime) {
        const R = bmine.radius * (m.owner?.cfg?.mineRadiusMult || 1);
        const pulse = 0.5 + 0.5 * Math.sin(m.age * 18);
        ctx.strokeStyle = `rgba(255,80,48,${(0.3 + 0.45 * pulse).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const hot = remaining < bmine.warningTime * 2;
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
  const R = state.data.balance.mine.radius;
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

// Bedrohungslinien: jeder Gegner mit freier Sicht auf den Spieler zeigt
// eine schwache rote Linie -- telegraphiert Gefahr (auch der unsichtbare
// Weisse verraet sich so, sobald er zielen kann).
export function drawThreatLines(ctx, state) {
  const p = state.player;
  if (!p.alive) return;
  const step = state.data.ai.raycastStepPx;
  ctx.lineWidth = 1;
  for (const t of state.tanks) {
    if (t === p || !t.alive) continue;
    const dist = Math.hypot(p.x - t.x, p.y - t.y);
    const dx = ((p.x - t.x) / dist) * step;
    const dy = ((p.y - t.y) / dist) * step;
    let x = t.x;
    let y = t.y;
    let blocked = false;
    for (let d = step; d < dist - t.cfg.radius; d += step) {
      x += dx;
      y += dy;
      if (state.isSolid(x, y)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    ctx.strokeStyle = 'rgba(255,70,60,0.22)';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
}

// Wurf-Vorschau der Bombe: Wurflinie + Ablagepunkt mit Explosionsradius.
// preview = { angle, dist } (Welt-px), vom Touch-Wurfstick.
export function drawMinePreview(ctx, state, preview) {
  const p = state.player;
  if (!preview || !p.alive) return;
  const cos = Math.cos(preview.angle);
  const sin = Math.sin(preview.angle);
  // Landepunkt bestimmen (an einer Wand davor stoppen).
  let lx = p.x;
  let ly = p.y;
  for (let d = 6; d <= preview.dist; d += 6) {
    const nx = p.x + cos * d;
    const ny = p.y + sin * d;
    if (state.isSolid(nx, ny)) break;
    lx = nx;
    ly = ny;
  }
  // Wurflinie.
  ctx.strokeStyle = 'rgba(255,150,60,0.7)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  ctx.setLineDash([]);
  // Explosionsradius am Landepunkt.
  const R = state.data.balance.mine.radius * (p.cfg.mineRadiusMult || 1);
  ctx.strokeStyle = 'rgba(255,90,50,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(lx, ly, R, 0, Math.PI * 2);
  ctx.stroke();
  // Ablagepunkt.
  ctx.fillStyle = '#ff9a4a';
  ctx.beginPath();
  ctx.arc(lx, ly, 5, 0, Math.PI * 2);
  ctx.fill();
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
