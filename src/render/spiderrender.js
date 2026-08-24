// Rendering fuer den Spinnenboss (Akt 3). Eigene Datei statt effects.js
// weiter wachsen zu lassen (Muster: mine.js/mortar.js sind ebenfalls schon
// eigenstaendige Module). Alle Funktionen folgen derselben Signatur wie
// effects.js: export function drawX(ctx, state[, alpha]).
//
// WICHTIG (Abschnitt 3 der Vorgabe): die drei beigefuegten Referenzbilder
// (Spinnenpanzer-Turm+-Koerper mit acht nummerierten Beinen, Spinnenmine
// mit acht nummerierten Beinen, Spinnennetz) sind Schachbrett-Hintergrund-
// JPEGs MIT eingebrannten Text-Labels ("Bein 1" usw.) -- keine fertigen,
// freigestellten Transparent-PNGs. Sie waeren so, wie geliefert, NICHT
// spielbar (Schachbrettmuster + Beschriftung wuerden im echten Spiel
// erscheinen). Diese Datei zeichnet deshalb eine erkennbare PROZEDURALE
// Darstellung, die Form/Proportionen/Gelenkreihenfolge/Ausrichtung der
// Referenzbilder so genau wie moeglich nachbildet (Uhr-Zuordnung, obere
// Beine nach aussen+oben, Gelenkpunkt am Koerper) -- exakt der Fallback,
// den Abschnitt 3 selbst fuer diesen Fall vorschreibt ("erkennbare
// prozedurale Uebergangsdarstellung ... dokumentieren, welche Bilddateien
// fehlen"). Echte body_t_spider.png/turret_t_spider.png/
// spider_boss_leg_0N.png/body_spider_mine.png/spider_mine_leg_0N.png/
// spider_web.png liegen NICHT in assets/sprites/ -- s. CLAUDE.md.
import { LEG_SLOTS, JOINT_DEG, FOOT_DEG, deg2rad } from '../game/spider.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawBar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.round(w * frac)), h);
}

// Ein Bein: Gelenk -> Knie (leicht nach aussen gebogen) -> Fuss, als
// zweisegmentige Linie -- ein top-down-taugliches Aequivalent zu einem
// mehrteiligen Sprite (Abschnitt 5: "muss die Bewegung trotzdem ueber den
// korrekten inneren Drehpunkt ... dargestellt werden", wenn kein
// segmentiertes Sprite vorliegt).
function drawOneLeg(ctx, jx, jy, fx, fy, color, width) {
  const mx = (jx + fx) / 2;
  const my = (jy + fy) / 2;
  // Knie leicht senkrecht zur Gelenk-Fuss-Achse nach aussen versetzt.
  const dx = fx - jx;
  const dy = fy - jy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = len * 0.18;
  const kx = mx + nx * bend;
  const ky = my + ny * bend;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(jx, jy);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  // Gelenkpunkt am Koerper -- entspricht dem weissen Punkt der
  // Referenzbilder (Abschnitt 4: "zeigt zur Koerpermitte").
  ctx.fillStyle = '#d8d4c8';
  ctx.beginPath();
  ctx.arc(jx, jy, width * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

// ---- Boss: acht Beine + eigene Lebensbalken (Abschnitt 7/10) --------------
export function drawSpiderBossLegs(ctx, state) {
  const tank = state.spiderBoss;
  if (!tank || !tank.alive || !tank.spiderLegs) return;
  // Legs tragen bereits absolute Weltkoordinaten, die spider.js JEDEN
  // Physiktick neu berechnet (updateLegGeometry) -- keine eigene
  // Render-Interpolation noetig, die naechste Tick-Aktualisierung liegt bei
  // 60 Hz ohnehin nur 16 ms auseinander.
  for (const leg of tank.spiderLegs) {
    if (!leg.alive) continue;
    drawOneLeg(ctx, leg.jointX, leg.jointY, leg.footX, leg.footY, '#2a2730', 7);
    // Eigener Lebensbalken JE Bein (Abschnitt 7/10) -- IMMER sichtbar
    // (nicht nur bei Schaden), sonst waere "acht separate Lebensbalken"
    // nicht erkennbar von einer gewoehnlichen Gegner-Leiste.
    const midX = (leg.jointX + leg.footX) / 2;
    const midY = (leg.jointY + leg.footY) / 2 - 8;
    const frac = Math.max(0, leg.hp / leg.maxHp);
    drawBar(ctx, midX - 12, midY, 24, 3, frac, frac > 0.3 ? '#c9a6ff' : '#e05a4a');
  }
}

// ---- Boss: Koerper + Gesamt-Lebensbalken (Abschnitt 7/11) -----------------
export function drawSpiderBossBody(ctx, state, alpha) {
  const tank = state.spiderBoss;
  if (!tank || !tank.alive) return;
  const x = lerp(tank.prevX, tank.x, alpha);
  const y = lerp(tank.prevY, tank.y, alpha);
  const r = tank.cfg.radius * 2.4; // deutlich groesser als die kleine Kollisionshuelle -- soll wie ein Boss wirken
  const vulnerable = tank.spiderVulnerableTimer > 0 || tank.spiderLegsAlive === 0;
  // Koerper: dunkler, fast schwarzer Panzerkoerper (Referenzbild-Farbwelt).
  ctx.fillStyle = '#201e26';
  ctx.strokeStyle = vulnerable ? '#e05a4a' : '#3a3542';
  ctx.lineWidth = vulnerable ? 3 : 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Weisses Spinnen-Icon (Referenzbild "Spinnenpanzer-Turm"): acht kleine
  // Beinstriche + Koerper, rein dekorativ auf dem Turm.
  ctx.strokeStyle = 'rgba(232,228,216,0.85)';
  ctx.lineWidth = 2;
  for (const slot of LEG_SLOTS) {
    const a = tank.heading + deg2rad(JOINT_DEG[slot]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(232,228,216,0.9)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  // Verwundbarkeits-/Schutz-Ring (Abschnitt 10, sichtbares Gegenstueck fuer
  // "Koerper ist gerade verwundbar" vs. "geschuetzt"): rot pulsierend bei
  // Verwundbarkeit, sonst ein ruhiger violetter Schild-Schimmer.
  ctx.beginPath();
  ctx.arc(x, y, r + 6, 0, Math.PI * 2);
  if (vulnerable) {
    ctx.strokeStyle = `rgba(224,90,74,${(0.4 + 0.35 * Math.sin(state.time * 8)).toFixed(3)})`;
  } else {
    ctx.strokeStyle = 'rgba(138,106,216,0.35)';
  }
  ctx.lineWidth = 2;
  ctx.stroke();

  // Gesamt-Lebensbalken, prominent ueber dem Koerper (Abschnitt 7: "gut
  // sichtbarer Boss-Lebensbalken"). Zeigt zusaetzlich die 30%-Schutzschwelle
  // (Abschnitt 11) als Strich, solange noch Beine leben.
  const w = 140;
  const barY = y - r - 20;
  const frac = Math.max(0, tank.hp / tank.cfg.maxHp);
  drawBar(ctx, x - w / 2, barY, w, 7, frac, '#c9a6ff');
  if (tank.spiderLegsAlive > 0) {
    const pct = state.data.balance?.boss?.spider?.phase3ProtectHpPct ?? 0.3;
    const tickX = x - w / 2 + w * pct;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tickX, barY - 1);
    ctx.lineTo(tickX, barY + 8);
    ctx.stroke();
  }
}

// ---- Spinnenminen (Abschnitt 3/15/16) --------------------------------------
export function drawSpiderMines(ctx, state) {
  const mines = state.spiderMines;
  if (!mines || !mines.length) return;
  for (const m of mines) {
    if (m.dead) continue;
    const wiggle = Math.sin(state.time * 10 + m.id) * 8; // leichte, deterministische Gangwirkung
    for (const slot of LEG_SLOTS) {
      const jr = deg2rad(JOINT_DEG[slot] + wiggle * 0.3);
      const fr = deg2rad(FOOT_DEG[slot] + wiggle);
      const jx = m.x + Math.cos(jr) * (m.radius + 3);
      const jy = m.y + Math.sin(jr) * (m.radius + 3);
      const fx = m.x + Math.cos(fr) * (m.radius + 12);
      const fy = m.y + Math.sin(fr) * (m.radius + 12);
      drawOneLeg(ctx, jx, jy, fx, fy, '#241f2c', 2.5);
    }
    const spawning = m.spiderState === 'spawn';
    ctx.fillStyle = spawning ? '#5a3a6a' : '#2a2432';
    ctx.strokeStyle = '#8a6ad8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Spawnphase: gedaempfter Puls zeigt "schon beschiessbar, aber am Boss
    // gebunden" -- Abschnitt 15.
    if (spawning) {
      ctx.strokeStyle = `rgba(200,166,255,${(0.4 + 0.4 * Math.sin(state.time * 12)).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ---- Spinnennetze (Abschnitt 18) -------------------------------------------
export function drawSpiderWebs(ctx, state) {
  const webs = state.spiderWebs;
  if (!webs || !webs.length) return;
  for (const w of webs) {
    if (w.dead) continue;
    const frac = Math.max(0, w.hp / w.maxHp);
    const R = state.data.balance.boss.spider.web.hitRadiusPx * (0.6 + 0.4 * frac);
    ctx.strokeStyle = `rgba(232,228,216,${(0.25 + 0.45 * frac).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    // Acht Speichen + drei konzentrische Ringe -- entspricht der Form des
    // Referenzbilds "Spinnennetz" (Radialnetz).
    for (const slot of LEG_SLOTS) {
      const a = deg2rad(JOINT_DEG[slot]);
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.x + Math.cos(a) * R, w.y + Math.sin(a) * R);
      ctx.stroke();
    }
    for (let ring = 1; ring <= 3; ring++) {
      ctx.beginPath();
      ctx.arc(w.x, w.y, (R * ring) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
