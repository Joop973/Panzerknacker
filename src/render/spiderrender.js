// Rendering fuer den Spinnenboss (Akt 3). Eigene Datei statt effects.js
// weiter wachsen zu lassen (Muster: mine.js/mortar.js sind ebenfalls schon
// eigenstaendige Module). Alle Funktionen folgen derselben Signatur wie
// effects.js: export function drawX(ctx, state[, alpha]).
//
// Nutzergrafik-Nachtrag: der Boss zeichnet jetzt echte Sprites
// (body_t_spider.png/turret_t_spider.png/spider_leg.png/
// body_spider_mine.png/spider_web.png, s. CLAUDE.md "Spinnenboss-Sprites").
// Jede Zeichenfunktion prueft zuerst per `sprite()`, ob ihr Bild geladen
// ist, und faellt sonst auf die urspruengliche PROZEDURALE Darstellung
// zurueck (dasselbe Muster wie ueberall sonst im Renderer, z. B. Champion-
// Sprite) -- das Spiel bleibt also auch ohne/waehrend des Ladens spielbar.
// Ein Bein-Sprite (`spider_leg.png`) wird fuer BEIDE Groessen (Boss UND
// Minen) wiederverwendet: es traegt seinen Gelenkpunkt am LINKEN Bildrand
// (statt Bildmitte wie body/turret) und wird wie ein Zeiger vom Gelenk zum
// Fuss rotiert+skaliert -- Boss und Mine unterscheiden sich nur in der
// Zielentfernung (`bcfg.legReachPx` vs. `m.radius`), kein zweites Sprite
// noetig.
import { LEG_SLOTS, JOINT_DEG, FOOT_DEG, deg2rad } from '../game/spider.js';
import { sprite } from './sprites.js';

// Bein-Sprite als Zeiger vom Gelenk (jx,jy) zum Fuss (fx,fy): der
// Gelenkpunkt sitzt im Sprite am linken Bildrand (vertikal zentriert,
// `LEG_PIVOT_MARGIN_PX` vom echten Inhaltsrand, s. Aufbereitungsskript) --
// `ctx.rotate()` + eine Skalierung auf die tatsaechliche Gelenk-Fuss-
// Distanz genuegen, kein zweites Koordinatensystem noetig.
const LEG_PIVOT_MARGIN_PX = 6;

function drawLegSprite(ctx, img, jx, jy, fx, fy) {
  const dist = Math.hypot(fx - jx, fy - jy);
  if (dist < 1) return;
  const angle = Math.atan2(fy - jy, fx - jx);
  const nativeReach = Math.max(1, img.naturalWidth - LEG_PIVOT_MARGIN_PX);
  const scale = dist / nativeReach;
  ctx.save();
  ctx.translate(jx, jy);
  ctx.rotate(angle);
  ctx.drawImage(img, 0, -(img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
  ctx.restore();
}

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
  const legImg = sprite('spider', 'leg');
  for (const leg of tank.spiderLegs) {
    if (!leg.alive) continue;
    if (legImg) drawLegSprite(ctx, legImg, leg.jointX, leg.jointY, leg.footX, leg.footY);
    else drawOneLeg(ctx, leg.jointX, leg.jointY, leg.footX, leg.footY, '#2a2730', 7);
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
  const bodyImg = sprite('body', 't_spider');
  const turretImg = sprite('turret', 't_spider');
  if (bodyImg && turretImg) {
    // Body: Front (Mandibel-Unterseite im Quellbild) zeigt nach UNTEN, nicht
    // nach oben wie bei der allgemeinen Panzer-Konvention -- deshalb
    // `heading - PI/2` statt des sonst ueblichen `+ PI/2` (s. CLAUDE.md,
    // Abschnitt "Spinnenboss-Sprites"). Der Turmpivot (das runde Loch im
    // Koerperbild) liegt bereits in Bildmitte (Aufbereitungsskript), beide
    // Sprites werden deshalb an DERSELBEN Stelle zentriert wie body/turret
    // bei jedem anderen Panzer.
    const bodyScale = (r * 2.15) / bodyImg.naturalHeight;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tank.heading - Math.PI / 2);
    ctx.drawImage(bodyImg, (-bodyImg.naturalWidth * bodyScale) / 2, (-bodyImg.naturalHeight * bodyScale) / 2, bodyImg.naturalWidth * bodyScale, bodyImg.naturalHeight * bodyScale);
    ctx.restore();
    const turretScale = (r * 1.5) / turretImg.naturalHeight;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tank.turret || 0);
    ctx.drawImage(turretImg, (-turretImg.naturalWidth * turretScale) / 2, (-turretImg.naturalHeight * turretScale) / 2, turretImg.naturalWidth * turretScale, turretImg.naturalHeight * turretScale);
    ctx.restore();
  } else {
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
  }
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
  const legImg = sprite('spider', 'leg');
  const mineBodyImg = sprite('spider', 'mineBody');
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
      if (legImg) drawLegSprite(ctx, legImg, jx, jy, fx, fy);
      else drawOneLeg(ctx, jx, jy, fx, fy, '#241f2c', 2.5);
    }
    const spawning = m.spiderState === 'spawn';
    if (mineBodyImg) {
      const scale = (m.radius * 2.1) / mineBodyImg.naturalHeight;
      ctx.drawImage(mineBodyImg, m.x - (mineBodyImg.naturalWidth * scale) / 2, m.y - (mineBodyImg.naturalHeight * scale) / 2, mineBodyImg.naturalWidth * scale, mineBodyImg.naturalHeight * scale);
    } else {
      ctx.fillStyle = spawning ? '#5a3a6a' : '#2a2432';
      ctx.strokeStyle = '#8a6ad8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Spawnphase: gedaempfter Puls zeigt "schon beschiessbar, aber am Boss
    // gebunden" -- Abschnitt 15. Gilt fuer Sprite UND prozeduralen Zweig
    // gleichermassen -- ein reiner Ring obendrauf, unabhaengig vom Koerper.
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
  const webImg = sprite('spider', 'web');
  for (const w of webs) {
    if (w.dead) continue;
    const frac = Math.max(0, w.hp / w.maxHp);
    const R = state.data.balance.boss.spider.web.hitRadiusPx * (0.6 + 0.4 * frac);
    if (webImg) {
      // Nicht rotiert (das Quellbild ist bereits ein symmetrisches
      // Radialnetz) -- nur Groesse (nach Restleben) und Deckkraft skalieren.
      const scale = (R * 2.3) / webImg.naturalHeight;
      ctx.globalAlpha = 0.35 + 0.55 * frac;
      ctx.drawImage(webImg, w.x - (webImg.naturalWidth * scale) / 2, w.y - (webImg.naturalHeight * scale) / 2, webImg.naturalWidth * scale, webImg.naturalHeight * scale);
      ctx.globalAlpha = 1;
      continue;
    }
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
