// Effekt-Zeichnungen (aus renderer.js ausgelagert): Minen, Fallen,
// Radar-Marker, Muendungsblitze, Partikel, Explosionen, Schwebetexte.

import { traceHook } from '../game/tank.js';

export function drawMines(ctx, state) {
  const mcfg = state.data.mine;
  const bmine = state.data.balance.mine;
  for (const m of state.mines) {
    // EMP-Mine (Phase 6, Sekundärslot): blauer statt gruen-brauner Koerper --
    // "jede 4. Mine ist blau" (kein Schaden, betaeubt stattdessen).
    ctx.fillStyle = m.isEmp ? '#1c4a5a' : '#3c4038';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fill();
    // Blinklicht: aus im Fluchtfenster, langsam wenn scharf,
    // schnell + rot kurz vor der Selbstzuendung.
    const armed = m.age >= mcfg.armDelayS;
    if (!armed) continue;
    const remaining = bmine.fuse - m.age; // s bis Selbstzuendung
    // Eigene Minen: duenner Ring zeigt die Restzeit bis zur
    // Selbstzuendung (laeuft im Uhrzeigersinn ab). Minenspuerer-Upgrade
    // (Phase 18, Welle 3): dieselbe Anzeige auch fuer gegnerische Minen --
    // rein optisch, die Minen selbst verhalten sich unveraendert.
    if (m.owner === state.player || state.player.cfg.mineSense) {
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
      ctx.fillStyle = m.isEmp ? '#5ad4f0' : hot ? '#ff5030' : '#ffd23c';
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

// Gefahrensinn-Upgrade (Phase 18, Welle 3): pulsierender Warnring um jeden
// Gegner, der den Spieler gerade im Rohr hat. Liest NUR das Flag, das die
// KI in stepState() ohnehin schon gesetzt hat (state.js: t.aimingAtPlayer)
// -- kein eigener Sichtlinien-Raycast im Renderpfad.
export function drawThreatRings(ctx, state) {
  const p = state.player;
  if (!p.cfg.threatSense || !p.alive) return;
  const pulse = 0.5 + 0.5 * Math.sin(state.time * 9);
  ctx.lineWidth = 2;
  for (const t of state.tanks) {
    if (t === p || !t.alive || !t.aimingAtPlayer) continue;
    ctx.strokeStyle = `rgba(255,90,60,${(0.35 + 0.45 * pulse).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.cfg.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawFlashes(ctx, state) {
  for (const f of state.flashes) {
    const t = 1 - f.age / 0.08;
    // P1: `dim` markiert einen Blitz, bei dem NICHTS passiert ist --
    // gesperrter Schuss (Magazin voll ausgeflogen). Grau und kleiner statt
    // gelb, damit man ihn nie mit einem echten Muendungsblitz verwechselt.
    ctx.fillStyle = f.dim ? '#9aa4ad' : '#fff2b0';
    ctx.globalAlpha = f.dim ? t * 0.55 : t;
    ctx.beginPath();
    ctx.arc(f.x, f.y, (f.dim ? 2 : 3) + (f.dim ? 2 : 4) * (1 - t), 0, Math.PI * 2);
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

// P6: Zielvorschau des Enterhakens. Nutzt traceHook() -- also GENAU die
// Funktion, mit der auch geschossen wird. Vorschau und Wirkung koennen
// dadurch nicht auseinanderlaufen (dasselbe Prinzip wie bei der Ziellinie
// unten, die die echte Geschossphysik aufruft).
// `angle` ist bei Touch der Winkel des Gadget-Wurfsticks, sonst die
// Blickrichtung.
export function drawHookPreview(ctx, state, angle) {
  const p = state.player;
  if (!p.alive || p.cfg.gadget !== 'hook') return;
  // Waehrend eines laufenden Zugs waere die Vorschau sinnlos.
  if (p.hookTimer > 0) return;
  const scfg = state.data.secondaries?.hook || {};
  const t = traceHook(p, state, scfg, angle);
  // Auf Abklingzeit: gedaempft zeichnen statt ausblenden -- der Spieler
  // soll die Reichweite auch dann einschaetzen koennen.
  const ready = (p.gadgetCooldown || 0) <= 0;
  const hit = t.hit;
  // Trifft der Haken, ist die Linie durchgezogen und der Ankerpunkt
  // markiert; geht er ins Leere, gestrichelt und ohne Anker -- der
  // Unterschied muss VOR dem Ausloesen erkennbar sein, weil ein Fehlschuss
  // seit P6 die Abklingzeit kostet.
  const a = ready ? (hit ? 0.85 : 0.4) : 0.25;
  ctx.strokeStyle = hit ? `rgba(120,220,255,${a})` : `rgba(150,160,170,${a})`;
  ctx.lineWidth = hit ? 2 : 1.5;
  ctx.setLineDash(hit ? [] : [5, 6]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(t.x, t.y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (hit) {
    ctx.strokeStyle = `rgba(120,220,255,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 7, 0, Math.PI * 2);
    ctx.stroke();
    // Kleines Kreuz im Anker -- auch bei viel Bildbewegung eindeutig.
    ctx.beginPath();
    ctx.moveTo(t.x - 4, t.y);
    ctx.lineTo(t.x + 4, t.y);
    ctx.moveTo(t.x, t.y - 4);
    ctx.lineTo(t.x, t.y + 4);
    ctx.stroke();
  }
}

// Dauerhafte Ziellinie (Phase 0a, Grundspiel -- kein Upgrade):
// duenne Linie vom Rohr bis zur ersten Wand. Nutzt die ECHTE
// Geschossphysik (traceTrajectory ruft updateBullet auf), damit Anzeige
// und Realitaet nicht auseinanderdriften. Abschaltbar ueber
// data/options.json (aimLine).
//
// Grundsteinumbau Phase 1: kein Abpraller-Vorgriff mehr -- ohne
// Bandenschuss stirbt die Kugel an der ersten Wand, die Vorschau zeigt
// deshalb nur noch die eine gerade Strecke bis dahin.
export function drawAimLine(ctx, state, trace) {
  const p = state.player;
  if (!p.alive) return;
  const muzzle = p.cfg.radius + 8;
  const x = p.x + Math.cos(p.turret) * muzzle;
  const y = p.y + Math.sin(p.turret) * muzzle;
  const pts = trace(state, x, y, p.turret, p.cfg);
  if (pts.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(200,225,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

// Mörser-Granaten (Grundsteinumbau Phase 3, t_green): IMMER sichtbar, kein
// Schalter -- die Fairness-Regel des Auftrags ist, dass der Spieler von
// Gegner-Umbau Baustein C (Telegraph-Flaechen, G1, UMBAUPLAN-GEGNER.md
// Abschnitt 3): der Ist-Abgleich fand die Ray-March-/Wachs-Technik der
// bestehenden Moerser-/Amboss-Telegraphen bewaehrt, aber hart an ihre
// jeweilige Datenstruktur gebunden ("null Aufwand" war zu optimistisch) --
// hier zu zwei generischen Helfern extrahiert. drawMortars()/
// drawAnvilHazards() rufen sie unten selbst auf (reiner Refactor, exakt
// dieselben Farben/Breiten als Vorgabewerte -- PIXEL-IDENTISCHES Ergebnis,
// keine Verhaltensaenderung). Fuer G2 gedacht: drawGrowingRingTelegraph()
// fuer t_duds Zuendschnur-Ring, drawCorridorTelegraph() fuer t_rushers
// Sturm-/t_grabbers Wurfkorridor.

// Wachsender Ring: gestrichelter Aussenring beim vollen Radius (sofort
// sichtbar), Fuellflaeche waechst mit frac (0..1, z. B. Flugzeit-Fortschritt).
export function drawGrowingRingTelegraph(ctx, x, y, radiusPx, frac, opts = {}) {
  const [rr, rg, rb] = opts.ringColor ?? [255, 90, 50];
  const ringAlpha = opts.ringAlpha ?? 0.5;
  ctx.strokeStyle = `rgba(${rr},${rg},${rb},${ringAlpha})`;
  ctx.lineWidth = opts.ringWidth ?? 1.5;
  ctx.setLineDash(opts.dash ?? [5, 5]);
  ctx.beginPath();
  ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const [fr, fg, fb] = opts.fillColor ?? [255, 60, 40];
  const fillMinA = opts.fillMinA ?? 0.15;
  const fillRangeA = opts.fillRangeA ?? 0.35;
  ctx.fillStyle = `rgba(${fr},${fg},${fb},${(fillMinA + fillRangeA * frac).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(x, y, radiusPx * frac, 0, Math.PI * 2);
  ctx.fill();
}

// Warnkorridor: Rechteckflaeche von (x,y) in Richtung dir, Breite
// 2*halfWidth, Laenge bis zur ersten Wand (Ray-March, gedeckelt bei maxLen)
// -- plus eine deutlich abgesetzte Endkante, die zeigt, wie weit der
// Korridor reicht. Gibt die tatsaechliche Laenge zurueck (ein G2-Erzeuger
// kann sie fuer eigene Trefferlogik brauchen, ohne den Ray-March zu wiederholen).
export function drawCorridorTelegraph(ctx, state, x, y, dir, halfWidth, opts = {}) {
  const maxLen = opts.maxLen ?? 900;
  const step = opts.step ?? 8;
  const perp = dir + Math.PI / 2;
  let len = maxLen;
  for (let d = step; d < len; d += step) {
    if (state.isSolid(x + Math.cos(dir) * d, y + Math.sin(dir) * d)) {
      len = d;
      break;
    }
  }
  const px = Math.cos(perp) * halfWidth;
  const py = Math.sin(perp) * halfWidth;
  const ex = x + Math.cos(dir) * len;
  const ey = y + Math.sin(dir) * len;
  ctx.save();
  ctx.fillStyle = opts.fillStyle ?? 'rgba(255,90,50,0.22)';
  ctx.beginPath();
  ctx.moveTo(x + px, y + py);
  ctx.lineTo(x - px, y - py);
  ctx.lineTo(ex - px, ey - py);
  ctx.lineTo(ex + px, ey + py);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = opts.edgeStyle ?? 'rgba(255,150,100,0.65)';
  ctx.lineWidth = opts.edgeWidth ?? 2;
  ctx.beginPath();
  ctx.moveTo(ex - px, ey - py);
  ctx.lineTo(ex + px, ey + py);
  ctx.stroke();
  ctx.restore();
  return len;
}

// Abschuss an sieht, wohin es fällt, und herauslaufen kann. Gestrichelter
// Umriss zeigt sofort den vollen Explosionsradius, die gefüllte Fläche
// wächst mit der verstreichenden Flugzeit (bei Einschlag komplett gefüllt);
// ein kleiner dunkler Schatten deutet die Granate selbst im Flug an
// (linear vom Abschussort zum Ziel interpoliert -- kein physischer Bogen,
// die Granate fliegt ohnehin "über" jede Wand).
// G1: nutzt jetzt drawGrowingRingTelegraph() (Baustein C) statt eigener
// Ring-/Fuell-Zeichnung -- pixelidentisch, Vorgabewerte = die alten
// hartkodierten Farben (s. o.).
export function drawMortars(ctx, state) {
  for (const m of state.mortars) {
    if (m.exploded) continue;
    const frac = Math.min(1, m.age / m.flightTimeS);
    drawGrowingRingTelegraph(ctx, m.tx, m.ty, m.radiusPx, frac);
    const sx = m.x0 + (m.tx - m.x0) * frac;
    const sy = m.y0 + (m.ty - m.y0) * frac;
    ctx.fillStyle = 'rgba(20,20,24,0.55)';
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Anker-Bodenfeld (G3, t_anchor): ein PERMANENTER, deutlich abgesetzter
// Bodenring -- bewusst NICHT pulsierend ("er aendert sich nie", Designtabelle
// 7.5) und deshalb bewusst KEIN drawGrowingRingTelegraph()-Wiederverwendung
// (das ist fuer wachsende/abklingende Gefahr gedacht, ein Anker-Feld ist eine
// statische Zonenmarkierung). Gezeichnet auf Bodenebene, VOR allen Panzern.
export function drawAnchorFields(ctx, state) {
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.suppressField) continue;
    const r = t.cfg.suppressField.radiusPx;
    ctx.save();
    ctx.fillStyle = 'rgba(120,96,168,0.10)';
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(168,156,216,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Fressradius (G7, t_harvester): "deutlich gezeichneter Fressradius auf dem
// Boden (dunkelrot, halbtransparent)" -- reiner statischer Bodenring wie
// drawAnchorFields() (dieselbe Begruendung: die Zone selbst aendert sich
// nie, nur die Stapelzahl am Panzer waechst -- s. drawTank()).
export function drawHarvestFields(ctx, state) {
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.harvest) continue;
    const r = t.cfg.harvest.radiusPx;
    ctx.save();
    ctx.fillStyle = 'rgba(140,20,20,0.10)';
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,60,50,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Rammler-Sturmkorridor (G2, t_rusher): waehrend des Windups (Richtung
// bereits eingefroren, ai_drives.js: ramDrive()) zeigt drawCorridorTelegraph
// (Baustein C) den Sturmweg -- IMMER sichtbar, dieselbe Fairness-Regel wie
// Moerser/Amboss. Waehrend des eigentlichen Sturms selbst kein Korridor mehr
// (der Panzer bewegt sich ja schon sichtbar sehr schnell) -- nur die
// Vorwarnung braucht die Flaeche.
export function drawRamTelegraphs(ctx, state) {
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.ram) continue;
    const ram = t.ai?.ram;
    if (!ram || ram.mode !== 'windup') continue;
    drawCorridorTelegraph(ctx, state, t.x, t.y, ram.dir, t.cfg.radius, {
      fillStyle: 'rgba(200,160,40,0.22)',
      edgeStyle: 'rgba(255,220,120,0.65)',
      maxLen: t.cfg.ram.triggerPx + 40,
    });
  }
}

// Blindgaenger-Zuendschnur (G2, t_dud): wachsender Ring an der Sterbeposition
// -- giftgruen statt des Moerser-Orange, damit ein Spieler die beiden
// Gefahrenflaechen auf einen Blick unterscheidet. IMMER sichtbar (kein
// Schalter), dieselbe Fairness-Regel wie beim Moerser.
export function drawDeathFuses(ctx, state) {
  for (const f of state.deathFuses) {
    if (f.dead) continue;
    const frac = Math.min(1, f.age / f.fuseS);
    drawGrowingRingTelegraph(ctx, f.x, f.y, f.radiusPx, frac, {
      ringColor: [200, 220, 60],
      fillColor: [170, 200, 50],
    });
  }
}

// Streuer-Reichweitenring + Salven-Vorwarnung (G2, t_shotgun): dieselbe
// Ring-Funktion wie oben, aber zweckentfremdet -- der gestrichelte Aussenring
// zeigt die feste Reichweite (burstRangePx, s. bullet.js: burstDistance)
// DAUERHAFT an, solange das Ziel nahe genug ist ("nur sichtbar, wenn der
// Spieler in Reichweite ist"), die Fuellflaeche waechst mit dem
// fireWindupS-Fortschritt (ai_turrets.js: roleTurret()) und ist damit
// zugleich die "gleich feuert die Salve"-Ankuendigung.
export function drawFireWindups(ctx, state) {
  const p = state.player;
  if (!p.alive) return;
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.fireWindupS || !t.cfg.burstRangePx) continue;
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d > t.cfg.burstRangePx * 1.4) continue;
    const frac = Math.min(1, (t.ai?.windupTimer || 0) / t.cfg.fireWindupS);
    drawGrowingRingTelegraph(ctx, t.x, t.y, t.cfg.burstRangePx, frac, {
      ringColor: [255, 190, 60],
      fillColor: [255, 170, 40],
      fillMinA: 0,
      fillRangeA: 0.3,
    });
  }
}

// Speertraeger-Ziellinie (G2, t_lance): IMMER sichtbar (nicht ueber
// data/options.json: aimLine abschaltbar) -- dieselbe Fairness-Regel wie der
// Moerser-Telegraph, weil ein Fehlschuss hier eine erzwungene Pause kostet
// (roleTurret(): chargeTurret()). Gestrichelt waehrend des Aufladens (Ziel
// verfolgt noch), durchgezogen + kraeftiger sobald die Richtung eingefroren
// ist ("locked" -- ai_turrets.js).
export function drawLanceAim(ctx, state) {
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.charge) continue;
    const lance = t.ai?.lance;
    if (!lance || lance.mode === 'idle' || lance.mode === 'pause') continue;
    const locked = lance.mode === 'locked';
    const len = state.data.balance?.bullet?.maxDistance ?? 900;
    const ex = t.x + Math.cos(t.turret) * len;
    const ey = t.y + Math.sin(t.turret) * len;
    ctx.save();
    ctx.strokeStyle = locked ? 'rgba(255,60,40,0.85)' : 'rgba(255,150,60,0.5)';
    ctx.lineWidth = locked ? 2 : 1.5;
    if (!locked) ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// Greifer-Wurfkorridor (G8, t_grabber): waehrend des Windups (Richtung
// bereits eingefroren, state.js: updateGrapples()) zeigt drawCorridorTelegraph
// (Baustein C) die Wurfrichtung -- IMMER sichtbar, dieselbe Fairness-Regel
// wie Moerser/Rammler/Amboss. Die gespannte, beschiessbare Leine selbst
// laeuft NICHT hier, sondern ueber Baustein B (state.tankLinks, gepusht in
// state.js: updateGrappleRopes()) -- drawTankLinks() zeichnet sie generisch
// mit, wie Heilstrahl/Lichtfaden/Fahnenlinie/Kette.
export function drawGrapples(ctx, state) {
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.grapple) continue;
    const gs = t.grappleState;
    if (!gs || gs.mode !== 'windup') continue;
    drawCorridorTelegraph(ctx, state, t.x, t.y, gs.dir, 10, {
      fillStyle: 'rgba(220,190,40,0.22)',
      edgeStyle: 'rgba(255,230,120,0.7)',
      maxLen: t.cfg.grapple.maxRangePx + 40,
    });
  }
}

// Taktgeber-Ring (G8, t_metronom): ein Ring, der ueber holdWindowS sichtbar
// zusammenzieht (radius max -> 0) und "auf dem Schlag" (state.js:
// updateMetronomes()s justBeat-Uebergang) kurz am vollen Radius aufblitzt --
// Auftrag Abschnitt 8.7: "zwei unabhaengige Sinneskanaele" (der Ton ist der
// zweite, s. state.js). Bewusst KEIN Baustein-C-Wiederverwendung: die dort
// gebotene Form ("fester Aussenring + wachsende FUELLFLAECHE") ist das
// Gegenteil von "ein Ring, der selbst schrumpft".
export function drawMetronomeRings(ctx, state) {
  const maxR = 46;
  for (const t of state.tanks) {
    if (!t.alive || !t.cfg.metronome) continue;
    const ms = t.metronomeState;
    if (!ms) continue;
    const holdW = t.cfg.metronome.holdWindowS ?? 0;
    const held = ms.elapsed < holdW;
    const radius = held && holdW > 0 ? maxR * (1 - ms.elapsed / holdW) : 0;
    ctx.save();
    ctx.strokeStyle = 'rgba(210,180,60,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, Math.max(4, radius), 0, Math.PI * 2);
    ctx.stroke();
    if (ms.justBeat) {
      ctx.strokeStyle = 'rgba(255,250,200,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, maxR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Maurer-Geruest (G5, t_mason): 0,8-s-Telegraph VOR dem eigentlichen
// Wandaufbau -- ein durchscheinendes, gestricheltes Quadrat, das mit dem
// Baufortschritt sichtbar dichter wird. Bewusst KEINE Wiederverwendung von
// Baustein C (drawGrowingRingTelegraph/drawCorridorTelegraph): das sind
// wachsende KREIS-/KORRIDOR-Gefahrenflaechen, hier ist es ein statisches
// Quadrat auf genau einer Zelle -- eine andere Form fuer eine andere
// Aussage ("hier entsteht bald eine feste Wand", keine Schadenszone).
export function drawMasonScaffolds(ctx, state) {
  for (const s of state.masonScaffolds) {
    const frac = Math.min(1, s.age / s.life);
    ctx.save();
    ctx.strokeStyle = `rgba(255,210,90,${0.35 + 0.45 * frac})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
    ctx.fillStyle = `rgba(255,210,90,${0.08 + 0.18 * frac})`;
    ctx.fillRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
    ctx.restore();
  }
}

// Vorhaltemarkierung (Grundsteinumbau Phase 2): auf jedem bewegten Gegner
// ein kleiner Punkt an der Position, an der er beim Einschlag einer JETZT
// abgefeuerten Kugel waere -- eine iterative Naeherung (2-3 Schritte ueber
// Distanz/Kugeltempo, klassischer "Lead-Punkt"-Trick) statt eines echten
// Loesers. Kein Einrasten, keine Zielhilfe: nur ehrliche Information, die
// vorher fehlte (die gestrichelte Ziellinie zeigt nur, wohin die KUGEL
// fliegt, nicht wo ein bewegtes Ziel beim Einschlag steht). Abschaltbar
// ueber data/options.json (leadMarker), Muster wie aimLine.
export function drawLeadMarkers(ctx, state) {
  const p = state.player;
  if (!p.alive || !p.cfg.bulletSpeed) return;
  const speed = p.cfg.bulletSpeed;
  for (const t of state.tanks) {
    if (t === p || !t.alive) continue;
    const spd = Math.hypot(t.vx || 0, t.vy || 0);
    if (spd < 4) continue; // praktisch stillstehend -- Punkt waere nur Unruhe
    let ex = t.x;
    let ey = t.y;
    for (let i = 0; i < 3; i++) {
      const dist = Math.hypot(ex - p.x, ey - p.y);
      const travelT = dist / speed;
      ex = t.x + (t.vx || 0) * travelT;
      ey = t.y + (t.vy || 0) * travelT;
    }
    ctx.strokeStyle = 'rgba(255,220,120,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex - 6, ey);
    ctx.lineTo(ex + 6, ey);
    ctx.moveTo(ex, ey - 6);
    ctx.lineTo(ex, ey + 6);
    ctx.stroke();
  }
}

// Schwebende Kurztexte ("Abpraller!").
export function drawTexts(ctx, state) {
  ctx.textAlign = 'center';
  for (const tx of state.texts) {
    // Amboss-Auftrag (Abschnitt 18): einmalige Lernhinweise brauchen einen
    // eigenen Look -- deutlich groesser, FEST ueber der Arena (keine
    // Aufwaertsdrift wie ein normaler Trefferschwebetext, der sonst nach
    // 3,5 s laengst aus dem Bild gewandert waere) + dunkler Kontrast-
    // hintergrund, sonst auf einem Handydisplay neben den vielen kleinen
    // Zorn-/Flankentexten kaum lesbar.
    if (tx.hint) {
      ctx.globalAlpha = 1 - tx.age / tx.life;
      ctx.font = 'bold 15px monospace';
      const w = ctx.measureText(tx.text).width;
      ctx.fillStyle = 'rgba(10,10,14,0.75)';
      ctx.fillRect(tx.x - w / 2 - 10, tx.y - 14, w + 20, 22);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y + 2);
      continue;
    }
    ctx.font = 'bold 12px monospace';
    ctx.globalAlpha = 1 - tx.age / tx.life;
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, tx.x, tx.y - tx.age * 22);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// Gegner-Umbau Baustein B (Verbindungslinien, G1, UMBAUPLAN-GEGNER.md
// Abschnitt 3): EINE generische Funktion fuer alle fuenf Linienarten
// (Heilstrahl/Lichtfaden/Fahnenlinie/Kette/Leine, G2-G6) statt fuenf fast
// gleicher Zeichenbloecke. Naher Verwandter ist drawThreatLines() oben --
// dieselbe simple Linie, hier aber parametrisiert statt fest verdrahtet
// (Farbe/Dicke/Strich/Puls/Endpunkte), weil fuenf unterschiedliche Gegner
// fuenf unterschiedlich aussehende Verbindungen brauchen. Reine Anzeige:
// jede Erzeuger-Stepfunktion (t_medic/t_relay/t_marshal/t_tether/t_grabber,
// G2-G6) entscheidet selbst pro Tick, OB ein Eintrag in state.tankLinks
// steht -- drawTankLinks() zeichnet nur, was schon da ist, ohne eigene
// Sichtlinien-/Distanzpruefung (Prinzip wie bei drawMines/drawTraps: die
// Zeichenfunktion bewertet nie selbst, sie zeigt nur den Spielzustand).
//
// link = { x0, y0, x1, y1, color: [r,g,b], width, baseAlpha, pulseAlpha,
//          pulseHz, dash }. Nur x0/y0/x1/y1/color sind Pflicht, der Rest
// hat Vorgabewerte -- ein Erzeuger kann also einen Eintrag mit nur den
// Endpunkten + Farbe pushen und bekommt trotzdem einen ruhigen Standardstrich.
export function drawTankLinks(ctx, state) {
  if (!state.tankLinks?.length) return;
  for (const link of state.tankLinks) {
    const [r, g, b] = link.color;
    const baseAlpha = link.baseAlpha ?? 0.55;
    const pulseAlpha = link.pulseAlpha ?? 0.15;
    const pulseHz = link.pulseHz ?? 3;
    const alpha = baseAlpha + pulseAlpha * (0.5 + 0.5 * Math.sin(state.time * pulseHz));
    ctx.save();
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    ctx.lineWidth = link.width ?? 2;
    if (link.dash) ctx.setLineDash(link.dash);
    ctx.beginPath();
    ctx.moveTo(link.x0, link.y0);
    ctx.lineTo(link.x1, link.y1);
    ctx.stroke();
    ctx.restore();
  }
}

// Amboss-Auftrag (Abschnitt 17, Darstellung): Rammwarnkorridor, Schockwellen
// mit deutlich erkennbaren Sicherheitsluecken und die verblassende
// Schleifspur -- alle drei ueberdauern bzw. kuendigen sich unabhaengig vom
// normalen Panzer-Rendering an, deshalb ein eigener Zeichenblock (Muster:
// drawMortars/drawHazards). Bewusst NUR Darstellung -- die eigentliche
// Trefferlogik (Sicherheitsluecken, Wandblockade) lebt komplett in
// src/game/anvil.js, hier wird nur nachgezeichnet, was dort schon gilt.
export function drawAnvilHazards(ctx, state) {
  const boss = state.anvilBoss;
  const acfg = state.data.balance?.boss?.anvil;
  if (!acfg) return;

  // Rammwarnkorridor: nur waehrend der Zielaufnahme sichtbar (normaler
  // Windup UND die kurze Raserei-Zielphase), verschwindet GENAU wenn der
  // Sprint beginnt -- kein uebrig bleibendes unsichtbares Gefahrenfeld.
  // Breite = Amboss- + Spielerradius (die tatsaechliche Kollisionsbreite,
  // keine duenne Linie). G1: nutzt jetzt drawCorridorTelegraph() (Baustein
  // C) statt eigener Ray-March-/Fuell-Zeichnung -- pixelidentisch, alle
  // Vorgabewerte (900/8/Farben) entsprechen exakt den alten Konstanten.
  if (boss && boss.alive && (boss.mode === 'charge_windup' || boss.mode === 'frenzy_aim')) {
    const halfWidth = boss.cfg.radius + (state.player?.cfg?.radius || 14);
    drawCorridorTelegraph(ctx, state, boss.x, boss.y, boss.chargeDir, halfWidth);
  }

  // Schockwellen (Hammerschlag): gefaehrlicher Ring rot, jede sichere Luecke
  // ein deutlich abgesetzter, andersfarbiger Keil -- Treffer/sicher muessen
  // auch auf einem kleinen Handydisplay ohne Nachdenken unterscheidbar sein.
  if (state.anvilShockwaves?.length) {
    const gapHalfRad = ((acfg.shockwaveGapDeg ?? 80) * Math.PI) / 360;
    const offsets = (acfg.shockwaveGapOffsetsDeg ?? [0]).map((d) => (d * Math.PI) / 180);
    const width = Math.max(2, acfg.shockwaveWidthPx ?? 12);
    for (const w of state.anvilShockwaves) {
      const r = Math.max(1, w.radius);
      ctx.save();
      ctx.lineWidth = width;
      ctx.strokeStyle = 'rgba(255,110,60,0.72)';
      ctx.beginPath();
      ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(110,235,180,0.9)';
      for (const off of offsets) {
        const gc = w.heading + Math.PI + off;
        ctx.beginPath();
        ctx.arc(w.x, w.y, r, gc - gapHalfRad, gc + gapHalfRad);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Schleifspur: gluehende Splitter, verblassen sichtbar VOR dem
  // Verschwinden (endTrailAttack() gibt allen noch lebenden Segmenten
  // dieselbe Restlebensdauer, hier nur ausgelesen).
  if (state.anvilTrails?.length) {
    const R = acfg.trailRadiusPx ?? 13;
    const fadeWindow = acfg.trailFadeAfterAttackS ?? 0.8;
    for (const seg of state.anvilTrails) {
      let alpha = 0.55;
      if (seg.expireAt != null) {
        const remain = Math.max(0, seg.expireAt - state.time);
        alpha = 0.55 * Math.min(1, remain / fadeWindow);
      }
      ctx.fillStyle = `rgba(255,140,70,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,205,130,${(alpha * 0.9).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}
