// Amboss-Boss (Akt 2, Amboss-Auftrag). Zentrales Modul fuer den kompletten
// Zustandsautomaten des Rammbosses -- Zorn-Zustand, Bewegung/Kollision aller
// drei Angriffe (Rammstoss/Hammerschlag/Schleifspur), Raserei/Zusammenbruch
// und die einmaligen Lernhinweise. src/game/bossai.js exportiert nur die
// duenne Einstiegsfunktion stepAnvilBoss() (Auftragsvorgabe: "Implementiere
// stepAnvilBoss() in src/game/bossai.js") und ruft von hier aus in dieses
// Modul hinein -- Muster wie mine.js/mortar.js/spider.js: die eigentliche
// Kampflogik lebt in einer eigenen, fokussierten Datei statt bossai.js auf
// mehrere hundert Zeilen aufzublaehen.
//
// Bewegung/Kollision laufen bewusst KOMPLETT ausserhalb von moveTank()/DRIVES
// (Muster wie stepMirrorBoss/stepPhalanxBoss/stepSpiderBoss) -- der Amboss
// braucht substep-genaue Wandtreffer-Erkennung (welche Wand, aussen oder
// innen) und einen zeitlich gesperrten Zorn-Zustand, den die generische
// Tank-/KI-Infrastruktur nicht kennt. Der Amboss feuert NIE (weapon:'bullet'
// in tanks.json ist reine Kompatibilitaet fuer resolveCfg()) -- roleTurret()/
// fireBullet() werden hier an keiner Stelle aufgerufen.
import { COLS, ROWS, WIDTH } from '../config.js';
import { resolveCircleWalls, circleOverlapsAABB, circlesOverlap } from './collision.js';
import { angleDelta } from './armor.js';
import { statusSpeedMult } from './status.js';
import { getFlag, setFlag } from '../core/storage.js';

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
// Zorn 0..1 (Grundlage aller linearen Interpolationen aus Abschnitt 5).
function rage01(tank, acfg) {
  return clamp01((tank.rage || 0) / (acfg.rageMax || 100));
}
// Zorn faellt unter 25 % Boss-LP nie unter lowHpMinRage (Abschnitt 7).
function minRage(tank, acfg) {
  return tank.hp / tank.cfg.maxHp <= (acfg.lowHpThresholdPct ?? 0.25) ? acfg.lowHpMinRage ?? 0 : 0;
}
// Zornband 0/1/2 fuer die deterministische Angriffsauswahl (Abschnitt 9).
function bandOf(rage) {
  return rage < 40 ? 0 : rage < 70 ? 1 : 2;
}
// Feste Muster je Band -- beim Wechsel in ein neues Band beginnt der Index
// wieder bei 0 (s. stepBetweenAttacks()).
const PATTERNS = [['ram'], ['ram', 'hammer'], ['ram', 'trail', 'ram', 'hammer']];

// Einmalige Lernhinweise (Abschnitt 18): persistiert ueber storage.js
// (getFlag/setFlag, dasselbe localStorage-Flag-System wie "Tutorial
// gesehen") -- ueberlebt also Tod/Raumneustart UND einen komplett neuen Run,
// genau die geforderte "kennt der Speicherstand bereits"-Regel. Reiner
// Kampftext statt einer echten Pause (das bestehende Tutorialsystem kennt
// nur den Startbildschirm, kein In-Run-Overlay ohne groessere fachfremde
// Aenderung) -- fest ueber der Arena, gut lesbar, deutlich laenger sichtbar
// als ein normaler Trefferschwebe-Text.
export function showAnvilHint(state, flag, text) {
  if (getFlag(flag)) return;
  setFlag(flag);
  state.texts.push({ x: WIDTH / 2, y: 64, text, age: 0, life: 3.5, color: '#ffe066', hint: true });
}

// Lazy-Init beim ersten Tick dieses Panzers (Muster wie spider.js:
// initSpiderLegs) -- state.js: createState() muss die Gegner-Erzeugungs-
// schleife dafuer nicht um einen Amboss-Sonderfall erweitern.
function initAnvil(tank, acfg) {
  tank.rage = 0;
  tank.mode = 'between_attacks';
  tank.modeTimer = acfg.betweenAttackS ?? 0;
  tank.lastRageEventAt = -1e9;
  tank.attackPatternIndex = 0;
  tank.rageBand = 0;
  tank.armorDisabled = false;
  tank.rageLocked = false;
  tank.chargeDir = tank.heading;
  tank.chargeHitTargets = new Set();
  tank.trailDistance = 0;
  tank.frenzyRemaining = 0;
  tank.processedRageEvents = new Set();
  tank.lastGhostRageAt = null;
  // Externe Kontrolleffekte (Abschnitt 15): eigene, gedaempfte Buchfuehrung
  // statt tank.stunTimer direkt zu lesen.
  tank.extStunUntil = 0;
  tank.lastRawStun = 0;
  tank.hammerWaveIndex = 0;
  tank.hammerTimer = 0;
}

// Externe Kontrolleffekte (Abschnitt 15): ausserhalb von Raserei/
// Zusammenbruch gedaempft (Dauer x externalControlDurationMult, Staerke der
// Verlangsamung x slowEffectMult), waehrend Raserei/Zusammenbruch komplett
// ignoriert -- eigene Bosszustaende laufen ueber tank.modeTimer, NIE ueber
// den allgemeinen stunTimer (der bleibt unangetastet fuer die normale
// Renderer-/Statusanzeige nutzbar).
function externalControl(state, tank, acfg) {
  const locked = tank.mode.startsWith('frenzy') || tank.mode === 'overheated' || tank.mode === 'restart';
  const raw = tank.stunTimer || 0;
  if (locked) {
    tank.lastRawStun = raw;
    return { stunned: false, slowMult: 1 };
  }
  if (raw > (tank.lastRawStun || 0)) {
    tank.extStunUntil = state.time + raw * (acfg.externalControlDurationMult ?? 1);
  }
  tank.lastRawStun = raw;
  const stunned = state.time < (tank.extStunUntil || 0);
  const rawSlow = statusSpeedMult(state, tank);
  const slowMult = rawSlow < 1 ? 1 - (1 - rawSlow) * (acfg.slowEffectMult ?? 1) : 1;
  return { stunned, slowMult };
}

// Passiver Zornabbau + Rasereiausloesung -- laeuft VOR der Modus-Logik,
// jeden Tick, unabhaengig vom aktuellen Zustand.
function handleRageTicking(state, tank, acfg, dt) {
  const inFrenzyFamily =
    tank.mode === 'frenzy_warning' ||
    tank.mode === 'frenzy_aim' ||
    tank.mode === 'frenzy_charge' ||
    tank.mode === 'frenzy_turnaround' ||
    tank.mode === 'overheated' ||
    tank.mode === 'restart';
  if (!inFrenzyFamily && tank.rage >= (acfg.rageMax ?? 100)) {
    // Abschnitt 9, Punkt 1-3: laufenden Angriff sauber abbrechen, dessen
    // Gefahrenobjekte ausblenden, dann die Rasereiwarnung starten.
    state.anvilShockwaves = [];
    state.anvilTrails = [];
    tank.chargeHitTargets = new Set();
    tank.mode = 'frenzy_warning';
    tank.modeTimer = acfg.frenzyWarningS ?? 0.65;
    tank.rageLocked = true; // Abschnitt 13/14: ab hier weder Aufbau noch Abbau
    tank.frenzyRemaining = acfg.frenzyDurationS ?? 5;
    state.anvilFrenzyCount = (state.anvilFrenzyCount || 0) + 1;
    state.sounds.push({ name: 'wave', x: tank.x }); // vorhandener zweitoniger Warnsound, keine neue Audiodatei
    state.addShake(4);
    showAnvilHint(state, 'anvilHintFrenzy', 'Überlebe die Raserei – danach bricht seine Panzerung.');
    return;
  }
  if (inFrenzyFamily || tank.rageLocked) return;
  if (!(tank.rage > 0)) return;
  if (state.time - tank.lastRageEventAt < (acfg.coolingDelayS ?? 2)) return;
  const floor = minRage(tank, acfg);
  tank.rage = Math.max(floor, tank.rage - (acfg.coolingPerS ?? 5) * dt);
}

// Einfache Verfolgung ohne Pfadsuche (zwischen den Angriffen + Schleifspur-
// Anflug nutzen nur die direkte Richtung + die bestehende Wandaufloesung --
// genau wie jeder normale Panzer auch).
function chaseTowardsPlayer(state, tank, speed, dt) {
  const p = state.player;
  if (!p.alive || speed <= 0) return;
  const dx = p.x - tank.x;
  const dy = p.y - tank.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  tank.heading = Math.atan2(dy, dx);
  const step = Math.min(dist, speed * dt);
  tank.x += (dx / dist) * step;
  tank.y += (dy / dist) * step;
  resolveCircleWalls(tank, tank.cfg.radius, state.walls);
}

function stepBetweenAttacks(state, tank, acfg, dt, ec) {
  if (tank.modeTimer > 0) {
    if (!ec.stunned) {
      const speed = lerp(acfg.moveSpeedMin ?? 0, acfg.moveSpeedMax ?? 0, rage01(tank, acfg)) * ec.slowMult;
      chaseTowardsPlayer(state, tank, speed, dt);
    }
    tank.modeTimer -= dt;
    return;
  }
  // Naechsten Angriff waehlen -- KEINE Zufallsauswahl (Abschnitt 8/9): rein
  // deterministisch ueber Zornband + fortlaufenden Musterindex.
  const band = bandOf(tank.rage);
  if (band !== tank.rageBand) {
    tank.rageBand = band;
    tank.attackPatternIndex = 0;
  }
  const pattern = PATTERNS[tank.rageBand];
  const attack = pattern[tank.attackPatternIndex % pattern.length];
  tank.attackPatternIndex++;
  if (attack === 'ram') beginRamWindup(state, tank, acfg);
  else if (attack === 'hammer') beginSlamWindup(tank, acfg);
  else beginTrailWindup(tank, acfg);
}

// --- Angriff 1: Rammstoss ------------------------------------------------

function beginRamWindup(state, tank, acfg) {
  tank.mode = 'charge_windup';
  const p = state.player;
  tank.chargeDir = p.alive ? Math.atan2(p.y - tank.y, p.x - tank.x) : tank.heading;
  tank.heading = tank.chargeDir; // danach kein Nachdrehen mehr (Abschnitt 10)
  tank.modeTimer = lerp(acfg.chargeTelegraphMaxS ?? 0, acfg.chargeTelegraphMinS ?? 0, rage01(tank, acfg));
  tank.chargeHitTargets = new Set();
}
function stepChargeWindup(tank, dt) {
  tank.modeTimer -= dt;
  if (tank.modeTimer <= 0) tank.mode = 'charge';
}

const CHARGE_STEP_PX = 4; // wie ai.raycastStepPx -- fein genug, um 32-Pixel-Waende nicht zu ueberspringen

function findWallAt(state, x, y, r) {
  for (const w of state.walls) {
    if (circleOverlapsAABB(x, y, r, w)) return w;
  }
  return null;
}

// Wegschieben senkrecht zur Rammbahn + kleiner Vorwaertsschub. Findet die
// Seite ueber das Kreuzprodukt (Position relativ zum Amboss), probiert bei
// blockierter Ecke die Gegenseite, dann geradewegs zurueck (Abschnitt 10:
// "eine sichere freie Richtung verwenden"). resolveCircleWalls garantiert in
// jedem Fall eine wandfreie Endposition.
function pushFromRam(state, target, tank, lateralPx, forwardPx) {
  const startX = target.x;
  const startY = target.y;
  const dx = startX - tank.x;
  const dy = startY - tank.y;
  const cross = Math.cos(tank.chargeDir) * dy - Math.sin(tank.chargeDir) * dx;
  const side = cross >= 0 ? 1 : -1;
  const candidates = [
    tank.chargeDir + side * (Math.PI / 2),
    tank.chargeDir - side * (Math.PI / 2),
    tank.chargeDir + Math.PI,
  ];
  for (const perp of candidates) {
    target.x = startX + Math.cos(perp) * lateralPx + Math.cos(tank.chargeDir) * forwardPx;
    target.y = startY + Math.sin(perp) * lateralPx + Math.sin(tank.chargeDir) * forwardPx;
    resolveCircleWalls(target, target.cfg.radius, state.walls);
    if (Math.hypot(target.x - startX, target.y - startY) > lateralPx * 0.3) return;
  }
}

function ramHitCheck(state, tank, x, y, dmg, acfg) {
  const R = tank.cfg.radius;
  const p = state.player;
  if (p.alive && !tank.chargeHitTargets.has(p) && circlesOverlap(x, y, R, p.x, p.y, p.cfg.radius)) {
    tank.chargeHitTargets.add(p);
    state.applyDamage(p, dmg, 'ein Rammstoß', { code: 'anvil_ram', enemyType: 't_anvil' });
    p.protect = Math.max(p.protect, acfg.ramProtectS ?? 0);
    pushFromRam(state, p, tank, acfg.ramLateralPushPx ?? 0, acfg.ramForwardPushPx ?? 0);
    state.sounds.push({ name: 'boom', x: p.x });
    state.addShake(3);
    state.anvilRamHitsPlayer = (state.anvilRamHitsPlayer || 0) + 1;
  }
  for (const g of state.ghosts) {
    if (!g.alive || tank.chargeHitTargets.has(g)) continue;
    if (circlesOverlap(x, y, R, g.x, g.y, g.cfg.radius)) {
      tank.chargeHitTargets.add(g);
      state.damageGhostsInRadius(g.x, g.y, 1, dmg);
      pushFromRam(state, g, tank, acfg.ramLateralPushPx ?? 0, acfg.ramForwardPushPx ?? 0);
    }
  }
}

// Substep-Bewegung entlang `dir`: haelt bei der ERSTEN Wand an, die ein
// Substep beruehren wuerde (statt hindurchzutunneln), und meldet sie zurueck
// -- der Aufrufer entscheidet je nach Aussen-/Innenwand ueber die Folgen.
// Trifft unterwegs Spieler/Geister, wird normal weitergefahren (Abschnitt
// 10: "Boss setzt den Sprint nach erfolgreichem Wegschieben fort").
function moveChargeSubsteps(state, tank, totalDist, dir, dmg, acfg) {
  const cos = Math.cos(dir);
  const sin = Math.sin(dir);
  let remaining = totalDist;
  while (remaining > 0) {
    const step = Math.min(CHARGE_STEP_PX, remaining);
    const nx = tank.x + cos * step;
    const ny = tank.y + sin * step;
    const wall = findWallAt(state, nx, ny, tank.cfg.radius);
    if (wall) return { wall };
    tank.x = nx;
    tank.y = ny;
    ramHitCheck(state, tank, nx, ny, dmg, acfg);
    remaining -= step;
  }
  return { wall: null };
}

function stepCharge(state, tank, acfg, dt, ec) {
  if (ec.stunned) return;
  const speed = lerp(acfg.chargeSpeedMin ?? 0, acfg.chargeSpeedMax ?? 0, rage01(tank, acfg)) * ec.slowMult;
  const dmg = Math.round(lerp(acfg.ramDamageMin ?? 0, acfg.ramDamageMax ?? 0, rage01(tank, acfg)));
  const { wall } = moveChargeSubsteps(state, tank, speed * dt, tank.chargeDir, dmg, acfg);
  if (wall) finishCharge(state, tank, acfg, wall);
}

function isOuterWall(wall) {
  return wall.col === 0 || wall.row === 0 || wall.col === COLS - 1 || wall.row === ROWS - 1;
}

function finishCharge(state, tank, acfg, wall) {
  const outer = isOuterWall(wall);
  state.sounds.push({ name: 'bounce', x: tank.x }); // vorhandener Wand-Einschlag-Ton
  state.addShake(outer ? 6 : 3);
  state.spawnParticles(tank.x, tank.y, '#8a8a99', outer ? 16 : 6, outer ? 160 : 80);
  // Wannenrichtung bleibt in die Wand gerichtet -- Heck zeigt dadurch von
  // selbst in die Arena, kein zusaetzliches Drehen noetig.
  if (outer) {
    const before = tank.rage;
    tank.rage = Math.max(minRage(tank, acfg), tank.rage - (acfg.outerImpactRageLoss ?? 0));
    const lost = Math.round(before - tank.rage);
    // Abschnitt 17 (Trefferindikatoren): "-N Zorn" als sichtbares Gegenstueck
    // zum aktiven Abbau -- nur bei echtem Verlust (an der lowHpMinRage-
    // Untergrenze koennte lost 0 sein).
    if (lost > 0) {
      state.texts.push({
        x: tank.x,
        y: tank.y - tank.cfg.radius - 20,
        text: `−${lost} Zorn`,
        age: 0,
        life: 0.7,
        color: '#7fe6c8',
      });
    }
    tank.mode = 'outer_crash';
    tank.modeTimer = acfg.outerCrashS ?? 0;
    state.anvilOuterCrashes = (state.anvilOuterCrashes || 0) + 1;
    showAnvilHint(state, 'anvilHintOuter', 'Außenwände kühlen ihn ab.');
  } else {
    tank.mode = 'inner_crash';
    tank.modeTimer = acfg.innerCrashS ?? 0;
    state.anvilInnerCrashes = (state.anvilInnerCrashes || 0) + 1;
  }
}

function stepCrash(tank, acfg, dt) {
  tank.modeTimer -= dt;
  if (tank.modeTimer <= 0) {
    tank.mode = 'between_attacks';
    tank.modeTimer = acfg.betweenAttackS ?? 0;
  }
}

// --- Angriff 2: Hammerschlag (Schockwellen) ------------------------------

function beginSlamWindup(tank, acfg) {
  tank.mode = 'slam_windup';
  tank.modeTimer = acfg.slamWindupS ?? 0.7;
  // Fahrtrichtung bleibt eingefroren, wie sie gerade steht (Abschnitt 11) --
  // kein Nachdrehen zum Spieler, anders als beim Rammstoss-Windup.
  tank.hammerWaveIndex = 0;
}
function stepSlamWindup(tank, dt) {
  tank.modeTimer -= dt;
  if (tank.modeTimer <= 0) {
    tank.mode = 'slam';
    tank.hammerTimer = 0; // erste Welle sofort
  }
}
function spawnShockwave(state, tank) {
  state.anvilShockwaves.push({ x: tank.x, y: tank.y, heading: tank.heading, radius: 0, hitTargets: new Set() });
  state.sounds.push({ name: 'wave', x: tank.x });
  state.addShake(3);
}
function stepSlam(state, tank, acfg, dt) {
  tank.hammerTimer -= dt;
  if (tank.hammerTimer > 0) return;
  if (tank.hammerWaveIndex < (acfg.shockwaveCount ?? 3)) {
    spawnShockwave(state, tank);
    tank.hammerWaveIndex++;
    tank.hammerTimer = acfg.shockwaveDelayS ?? 0.55;
  } else {
    tank.mode = 'between_attacks';
    tank.modeTimer = acfg.betweenAttackS ?? 0;
  }
}

function shockwaveBlocked(state, wave, target) {
  const step = state.data.ai?.raycastStepPx ?? 8;
  const dx = target.x - wave.x;
  const dy = target.y - wave.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  for (let d = step; d < dist - (target.cfg.radius || 0); d += step) {
    if (state.isSolid(wave.x + nx * d, wave.y + ny * d)) return true;
  }
  return false;
}

function checkShockwaveHit(state, wave, target, acfg, gapHalf, offsets, halfWidth, isGhost) {
  if (!target || !target.alive || wave.hitTargets.has(target)) return;
  const dx = target.x - wave.x;
  const dy = target.y - wave.y;
  const dist = Math.hypot(dx, dy);
  if (Math.abs(dist - wave.radius) > halfWidth + (target.cfg.radius || 0)) return;
  const ang = Math.atan2(dy, dx);
  for (const off of offsets) {
    // Luecken relativ zum eingefrorenen Boss-Heading, gemessen um heading+PI
    // (Abschnitt 11: "Berechne den Mittelpunkt grundsaetzlich um heading + PI").
    const gapCenter = wave.heading + Math.PI + off;
    if (Math.abs(angleDelta(ang, gapCenter)) <= gapHalf) return; // sichere Luecke
  }
  if (shockwaveBlocked(state, wave, target)) return;
  wave.hitTargets.add(target);
  const dmg = acfg.shockwaveDamage ?? 0;
  if (isGhost) {
    state.damageGhostsInRadius(target.x, target.y, 1, dmg);
    target.stunTimer = Math.max(target.stunTimer || 0, acfg.shockwaveStunS ?? 0);
  } else {
    state.applyDamage(target, dmg, 'eine Schockwelle', { code: 'anvil_slam', enemyType: 't_anvil' });
    target.stunTimer = Math.max(target.stunTimer || 0, acfg.shockwaveStunS ?? 0);
  }
}

// Schockwellen ueberdauern das Angriffsende (der Boss zieht schon weiter,
// die Ringe laufen unabhaengig aus) -- deshalb ein eigener, vom aktuellen
// Modus unabhaengiger Tick, jeden Frame aufgerufen.
function updateAnvilShockwaves(state, dt) {
  if (!state.anvilShockwaves.length) return;
  const acfg = state.data.balance?.boss?.anvil;
  if (!acfg) return;
  const gapHalf = ((acfg.shockwaveGapDeg ?? 80) * Math.PI) / 360;
  const offsets = (acfg.shockwaveGapOffsetsDeg ?? [0]).map((d) => (d * Math.PI) / 180);
  const halfWidth = (acfg.shockwaveWidthPx ?? 12) / 2;
  for (const w of state.anvilShockwaves) {
    w.radius += (acfg.shockwaveSpeedPx ?? 0) * dt;
    if (w.radius > (acfg.shockwaveMaxRadiusPx ?? 0)) {
      w.dead = true;
      continue;
    }
    checkShockwaveHit(state, w, state.player, acfg, gapHalf, offsets, halfWidth, false);
    for (const g of state.ghosts) checkShockwaveHit(state, w, g, acfg, gapHalf, offsets, halfWidth, true);
  }
  state.anvilShockwaves = state.anvilShockwaves.filter((w) => !w.dead);
}

// --- Angriff 3: Schleifspur -----------------------------------------------

function beginTrailWindup(tank, acfg) {
  tank.mode = 'trail_windup';
  tank.modeTimer = acfg.trailWindupS ?? 0.7;
}
function stepTrailWindup(tank, acfg, dt) {
  tank.modeTimer -= dt;
  if (tank.modeTimer <= 0) {
    tank.mode = 'trail';
    tank.modeTimer = acfg.trailDurationS ?? 5.2;
    tank.trailDistance = 0;
  }
}
function spawnTrailSegment(state, tank, acfg) {
  state.anvilTrails.push({ x: tank.x, y: tank.y, hitAt: new Map(), expireAt: null });
  const cap = acfg.trailMaxSegments ?? 24;
  while (state.anvilTrails.length > cap) state.anvilTrails.shift();
  state.spawnParticles(tank.x, tank.y, '#ff9a4a', 3, 40);
}
function endTrailAttack(state, acfg) {
  // "Alle verbleibenden Segmente erhalten hoechstens noch 0,8 Sekunden
  // Restzeit" -- EIN gemeinsamer Deadline-Zeitpunkt fuer alle noch lebenden
  // Segmente, nicht individuell nach ihrem Erzeugungsalter.
  const deadline = state.time + (acfg.trailFadeAfterAttackS ?? 0);
  for (const seg of state.anvilTrails) seg.expireAt = deadline;
}
function stepTrail(state, tank, acfg, dt, ec) {
  tank.modeTimer -= dt;
  if (!ec.stunned) {
    const p = state.player;
    if (p.alive) {
      const want = Math.atan2(p.y - tank.y, p.x - tank.x);
      const diff = angleDelta(want, tank.heading);
      const maxTurn = (acfg.trailTurnSpeedRad ?? 0) * dt;
      tank.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
    }
    const speed = (acfg.trailSpeedPx ?? 0) * ec.slowMult;
    const beforeX = tank.x;
    const beforeY = tank.y;
    tank.x += Math.cos(tank.heading) * speed * dt;
    tank.y += Math.sin(tank.heading) * speed * dt;
    resolveCircleWalls(tank, tank.cfg.radius, state.walls);
    tank.trailDistance += Math.hypot(tank.x - beforeX, tank.y - beforeY);
    const spacing = acfg.trailSpacingPx ?? 18;
    while (tank.trailDistance >= spacing) {
      tank.trailDistance -= spacing;
      spawnTrailSegment(state, tank, acfg);
    }
  }
  if (tank.modeTimer <= 0) {
    endTrailAttack(state, acfg);
    tank.mode = 'between_attacks';
    tank.modeTimer = acfg.betweenAttackS ?? 0;
  }
}

function checkTrailHit(state, seg, target, R, dmg, interval, isGhost) {
  if (!target || !target.alive) return;
  if (!circlesOverlap(seg.x, seg.y, R, target.x, target.y, target.cfg.radius)) return;
  const last = seg.hitAt.get(target) ?? -Infinity;
  if (state.time - last < interval) return;
  seg.hitAt.set(target, state.time);
  if (isGhost) state.damageGhostsInRadius(target.x, target.y, 1, dmg);
  else state.applyDamage(target, dmg, 'eine Schleifspur', { code: 'anvil_trail', enemyType: 't_anvil' });
}

// Trailsegmente ueberdauern das Angriffsende (Fade-Fenster) -- eigener,
// modusunabhaengiger Tick wie bei den Schockwellen.
function updateAnvilTrails(state, dt) {
  if (!state.anvilTrails.length) return;
  const acfg = state.data.balance?.boss?.anvil;
  if (!acfg) return;
  const R = acfg.trailRadiusPx ?? 13;
  const dmg = acfg.trailDamage ?? 0;
  const interval = acfg.trailDamageIntervalS ?? 0.5;
  for (const seg of state.anvilTrails) {
    if (seg.expireAt != null && state.time >= seg.expireAt) {
      seg.dead = true;
      continue;
    }
    checkTrailHit(state, seg, state.player, R, dmg, interval, false);
    for (const g of state.ghosts) checkTrailHit(state, seg, g, R, dmg, interval, true);
  }
  state.anvilTrails = state.anvilTrails.filter((s) => !s.dead);
}

// --- Raserei + Zusammenbruch ----------------------------------------------

function retargetFrenzySequence(state, tank, acfg) {
  tank.mode = 'frenzy_aim';
  tank.modeTimer = acfg.frenzyAimS ?? 0.45;
  tank.chargeHitTargets = new Set(); // Abschnitt 13: pro Sequenz nur ein Treffer je Ziel
  const p = state.player;
  tank.chargeDir = p.alive ? Math.atan2(p.y - tank.y, p.x - tank.x) : tank.heading;
  tank.heading = tank.chargeDir;
}

function beginOverheated(state, tank, acfg) {
  tank.mode = 'overheated';
  tank.modeTimer = acfg.overheatedS ?? 3.5;
  tank.armorDisabled = true; // armor.js: armorBlocks() liest dieses Feld generisch
  state.anvilShockwaves = [];
  state.anvilTrails = [];
  tank.chargeHitTargets = new Set();
  state.sounds.push({ name: 'trickshot2', x: tank.x }); // vorhandener "grosse Struktur bricht"-Ton
  state.addShake(6);
  state.spawnParticles(tank.x, tank.y, '#5a5a5a', 16, 140);
}

function stepFrenzyWarning(state, tank, acfg, dt) {
  tank.modeTimer -= dt;
  if (tank.modeTimer <= 0) retargetFrenzySequence(state, tank, acfg);
}
function stepFrenzyAim(state, tank, acfg, dt) {
  tank.frenzyRemaining -= dt;
  if (tank.frenzyRemaining <= 0) {
    beginOverheated(state, tank, acfg);
    return;
  }
  tank.modeTimer -= dt;
  if (tank.modeTimer <= 0) tank.mode = 'frenzy_charge';
}
function stepFrenzyCharge(state, tank, acfg, dt) {
  tank.frenzyRemaining -= dt;
  if (tank.frenzyRemaining <= 0) {
    beginOverheated(state, tank, acfg);
    return;
  }
  // Raserei: IMMER volles Rammtempo/Vollschaden (Abschnitt 13) -- externe
  // Kontrolleffekte sind hier ohnehin komplett wirkungslos (s. externalControl()).
  const { wall } = moveChargeSubsteps(state, tank, (acfg.chargeSpeedMax ?? 0) * dt, tank.chargeDir, acfg.ramDamageMax ?? 0, acfg);
  if (wall) {
    // Waehrend der Raserei senkt KEIN Wandkontakt den Zorn (Abschnitt 13) --
    // nur die kurze Drehpause, kein outer_crash/inner_crash-Unterschied.
    tank.mode = 'frenzy_turnaround';
    tank.modeTimer = acfg.frenzyTurnaroundS ?? 0.18;
    state.sounds.push({ name: 'bounce', x: tank.x });
    state.addShake(3);
  }
}
function stepFrenzyTurnaround(state, tank, acfg, dt) {
  tank.frenzyRemaining -= dt;
  if (tank.frenzyRemaining <= 0) {
    beginOverheated(state, tank, acfg);
    return;
  }
  tank.modeTimer -= dt;
  if (tank.modeTimer <= 0) retargetFrenzySequence(state, tank, acfg);
}
function stepOverheated(state, tank, acfg, dt) {
  tank.modeTimer -= dt;
  if (tank.modeTimer <= 0) {
    tank.armorDisabled = false;
    const lowHp = tank.hp / tank.cfg.maxHp <= (acfg.lowHpThresholdPct ?? 0.25);
    tank.rage = lowHp ? acfg.lowHpMinRage ?? 0 : acfg.rageAfterOverheat ?? 0;
    tank.rageLocked = false;
    tank.lastRageEventAt = state.time; // keine sofortige Abbau-Karenz-Luecke
    tank.mode = 'restart';
    tank.modeTimer = acfg.restartS ?? 0.6;
    state.sounds.push({ name: 'shield', x: tank.x });
    state.spawnParticles(tank.x, tank.y, '#7fe6c8', 10, 90);
  }
}
function stepRestart(tank, acfg, dt) {
  tank.modeTimer -= dt;
  if (tank.modeTimer <= 0) {
    tank.mode = 'between_attacks';
    tank.modeTimer = acfg.betweenAttackS ?? 0;
  }
}

// --- Zentraler Einstieg ----------------------------------------------------

export function stepAnvilBoss(tank, state, dt) {
  const acfg = state.data.balance?.boss?.anvil;
  if (!acfg) return; // Sicherheitsnetz: minimale Test-/Debug-Fixtures ohne Amboss-Balancewerte
  if (!tank.processedRageEvents) initAnvil(tank, acfg);

  tank.prevX = tank.x;
  tank.prevY = tank.y;

  const ec = externalControl(state, tank, acfg);
  handleRageTicking(state, tank, acfg, dt);

  switch (tank.mode) {
    case 'between_attacks':
      stepBetweenAttacks(state, tank, acfg, dt, ec);
      break;
    case 'charge_windup':
      stepChargeWindup(tank, dt);
      break;
    case 'charge':
      stepCharge(state, tank, acfg, dt, ec);
      break;
    case 'outer_crash':
    case 'inner_crash':
      stepCrash(tank, acfg, dt);
      break;
    case 'slam_windup':
      stepSlamWindup(tank, dt);
      break;
    case 'slam':
      stepSlam(state, tank, acfg, dt);
      break;
    case 'trail_windup':
      stepTrailWindup(tank, acfg, dt);
      break;
    case 'trail':
      stepTrail(state, tank, acfg, dt, ec);
      break;
    case 'frenzy_warning':
      stepFrenzyWarning(state, tank, acfg, dt);
      break;
    case 'frenzy_aim':
      stepFrenzyAim(state, tank, acfg, dt);
      break;
    case 'frenzy_charge':
      stepFrenzyCharge(state, tank, acfg, dt);
      break;
    case 'frenzy_turnaround':
      stepFrenzyTurnaround(state, tank, acfg, dt);
      break;
    case 'overheated':
      stepOverheated(state, tank, acfg, dt);
      break;
    case 'restart':
      stepRestart(tank, acfg, dt);
      break;
    default:
      tank.mode = 'between_attacks';
      tank.modeTimer = acfg.betweenAttackS ?? 0;
  }

  // Schockwellen/Schleifspur ueberdauern das Angriffsende bewusst -- eigener,
  // vom aktuellen Modus unabhaengiger Tick (s. Kommentare an den Funktionen).
  updateAnvilShockwaves(state, dt);
  updateAnvilTrails(state, dt);

  tank.vx = dt > 0 ? (tank.x - tank.prevX) / dt : 0;
  tank.vy = dt > 0 ? (tank.y - tank.prevY) / dt : 0;

  // Telemetrie (Abschnitt 20): Zorn-Zeitreihe fuer Durchschnitt/Maximum,
  // jeden Tick gesampelt (billig, ein Vergleich + zwei Additionen).
  state.anvilRageSampleSum = (state.anvilRageSampleSum || 0) + tank.rage;
  state.anvilRageSampleCount = (state.anvilRageSampleCount || 0) + 1;
  state.anvilMaxRage = Math.max(state.anvilMaxRage || 0, tank.rage);
}
