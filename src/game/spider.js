// Spinnenboss (Akt 3, Spinnenboss-Auftrag). Zentrales Modul fuer den
// eigentlichen Bosskoerper: acht angreifbare Beine, die Geschwindigkeits-
// formel, die Betaeubung/Verwundbarkeit nach Beinverlust und die drei
// Kampfphasen (inkl. des Wandumbaus + der zwei Saeulen + der Bullet-Hell-
// Wellen in Phase 3). Bewegung/Wandklettern folgt exakt dem Muster von
// bossai.js (stepMirrorBoss/stepPhalanxBoss): eine reine Sonderbewegung, die
// DRIVES/updateEnemy() komplett umgeht, waehrend das Feuern in Phase 1/2 die
// normale roleTurret()-Logik weiterverwendet. Minen/Netze/Wandumbau sind
// bewusst in eigene, kleine Funktionen bzw. Dateien ausgelagert (Muster wie
// mine.js/mortar.js/ghost.js) statt alles in eine Monsterfunktion zu pressen.
import { CELL, COLS, ROWS, WIDTH, HEIGHT } from '../config.js';
import { fireBullet } from './tank.js';
import { roleTurret } from './ai_turrets.js';
import { createBullet } from './bullet.js';
import { circlesOverlap } from './collision.js';
import { spawnSpiderMine } from './spidermine.js';

// Uhr-Position -> Weltwinkel in Grad (Abschnitt 4): 0 Grad = "rechts" (3
// Uhr) in Canvas-Konvention (y waechst nach unten), 90 = unten, 180 = links,
// 270 = oben. jointDeg ist der reine Uhr-Winkel (Formel: uhrGrad - 90);
// footDeg zieht bei den vier OBEREN Beinen (1,2,7,8) die Fussspitze
// zusaetzlich Richtung "oben" (270), damit sie sichtbar "nach aussen UND
// oben" zeigt (Abschnitt 4) -- Beine 3-6 bleiben unveraendert rein
// radial nach aussen (mittlere/untere Koerperposition).
const LEG_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8];
const JOINT_DEG = { 1: 300, 2: 330, 3: 0, 4: 30, 5: 150, 6: 180, 7: 210, 8: 240 };
const FOOT_DEG = { 1: 280, 2: 320, 3: 0, 4: 30, 5: 150, 6: 180, 7: 220, 8: 260 };
// Zwei diagonal versetzte Gangschritt-Gruppen (Abschnitt 5).
const GAIT_GROUP_A = new Set([8, 6, 2, 4]);
const GAIT_GROUP_B = new Set([1, 3, 7, 5]);
const SWING_FRACTION = 0.4; // Anteil der Gruppen-Phase, der wirklich "in der Luft" ist

function deg2rad(d) {
  return (d * Math.PI) / 180;
}

// Exportiert fuer die Spinnenminen-Darstellung (spiderrender.js): Minen
// tragen keine eigenen, einzeln zerstoerbaren Beine (kein Bein-HP-Objekt
// noetig), sollen aber dieselbe Uhr-Zuordnung/Ausrichtung zeigen wie der
// Boss (Abschnitt 4: "gelten sowohl fuer den Spinnenboss als auch fuer die
// Spinnenminen") -- EINE Quelle fuer die Winkeltabelle statt einer zweiten
// Kopie der Zahlen im Renderer.
export { LEG_SLOTS, JOINT_DEG, FOOT_DEG, deg2rad };

// Acht frische Beine (voller LP, angeheftet an der aktuellen Position) --
// aufgerufen EINMALIG beim ersten stepSpiderBoss()-Tick dieses Panzers
// (lazy statt an der generischen Gegner-Erzeugungsstelle in state.js, um
// deren Schleife nicht um einen Spinnen-Sonderfall zu erweitern).
function initSpiderLegs(tank, bcfg) {
  tank.spiderLegs = LEG_SLOTS.map((slot) => {
    const jointRad = deg2rad(JOINT_DEG[slot]);
    const footRad = deg2rad(FOOT_DEG[slot]);
    const jointX = tank.x + Math.cos(jointRad) * bcfg.legJointPx;
    const jointY = tank.y + Math.sin(jointRad) * bcfg.legJointPx;
    const footX = tank.x + Math.cos(footRad) * bcfg.legReachPx;
    const footY = tank.y + Math.sin(footRad) * bcfg.legReachPx;
    return {
      slot,
      alive: true,
      hp: bcfg.legHp,
      maxHp: bcfg.legHp,
      jointDeg: JOINT_DEG[slot],
      footDeg: FOOT_DEG[slot],
      jointX,
      jointY,
      footX,
      footY,
      // Fussplanzung fuer den Gangzyklus (Abschnitt 5): groundX/Y ist die
      // WELTPOSITION, an der der Fuss gerade steht/zuletzt aufgesetzt hat --
      // bleibt waehrend der Standphase fest, damit er nicht sichtbar rutscht.
      groundX: footX,
      groundY: footY,
      swinging: false,
      swingT: 0,
      swingFromX: footX,
      swingFromY: footY,
      lastGroupPhase: 0,
    };
  });
  tank.spiderLegsAlive = LEG_SLOTS.length;
  tank.spiderPhase = 1;
  tank.spiderVulnerableTimer = 0;
  tank.spiderFireTimer = 0;
  tank.spiderMineTimer = bcfg.phases['1'].mineEveryS * 0.5; // erste Aktion nicht sofort
  tank.spiderWebTimer = bcfg.phases['1'].webEveryS * 0.5;
  tank.spiderGaitPhase = 0;
  tank.spiderTransitionT = 0;
  tank.spiderBulletHellState = 'pause';
  tank.spiderBulletHellT = 0;
  tank.spiderBulletHellAngle = 0;
}

function aliveLegs(tank) {
  return tank.spiderLegs.filter((l) => l.alive);
}

// Geschwindigkeitsformel (Abschnitt 8): EXAKT 48 * verbleibendeBeine / 8,
// jeden Tick neu gesetzt -- greift dadurch unmittelbar nach jedem
// Beinverlust, ganz ohne eigenen Uebergangs-Tween (so verlangt es die
// Vorgabe woertlich, keine sanfte Rampe).
function applySpiderSpeed(tank, bcfg) {
  tank.cfg.speed = bcfg.baseSpeedPxS * (tank.spiderLegsAlive / bcfg.legCount);
}

// ---- Gangzyklus (Abschnitt 5) ---------------------------------------------
function updateLegGeometry(tank, state, bcfg, dt) {
  const stunned = tank.spiderVulnerableTimer > 0;
  const moving = tank.spiderPhase !== 3 && !stunned;
  if (moving) {
    // Schrittgeschwindigkeit an der TATSAECHLICHEN Bewegung orientiert:
    // eine volle Gangphase entspricht einer festen "Schrittlaenge" in
    // Pixeln, nicht in Sekunden -- schneller Panzer = schnellerer Zyklus,
    // Stillstand (Bewegungstempo 0) haelt die Animation komplett an.
    const speed = Math.hypot(tank.vx || 0, tank.vy || 0) || tank.cfg.speed || 0;
    const strideLenPx = Math.max(1, bcfg.legReachPx * 1.6);
    tank.spiderGaitPhase = (tank.spiderGaitPhase + (speed / strideLenPx) * dt) % 1;
  }
  for (const leg of tank.spiderLegs) {
    if (!leg.alive) continue;
    const jointRad = tank.heading + deg2rad(leg.jointDeg);
    leg.jointX = tank.x + Math.cos(jointRad) * bcfg.legJointPx;
    leg.jointY = tank.y + Math.sin(jointRad) * bcfg.legJointPx;
    const footRad = tank.heading + deg2rad(leg.footDeg);
    const idealX = tank.x + Math.cos(footRad) * bcfg.legReachPx;
    const idealY = tank.y + Math.sin(footRad) * bcfg.legReachPx;
    if (!moving) {
      // Stillstand/Betaeubung/Phase 3 ohne Beine: Fuesse bleiben, wo sie
      // sind -- "endet in einer natuerlichen Ruheposition" (Abschnitt 5),
      // eine Betaeubung stoppt die Animation komplett.
      leg.footX = leg.groundX;
      leg.footY = leg.groundY;
      continue;
    }
    const group = GAIT_GROUP_A.has(leg.slot) ? 0 : GAIT_GROUP_B.has(leg.slot) ? 0.5 : 0;
    // Winzige, deterministische Streuung innerhalb einer Gruppe (Abschnitt
    // 5: "kleine zeitliche Abweichungen"), aus der Beinnummer abgeleitet --
    // kein RNG-Verbrauch noetig.
    const jitter = ((leg.slot * 37) % 10) / 10 * 0.04;
    const localPhase = (tank.spiderGaitPhase + group + jitter) % 1;
    if (localPhase < SWING_FRACTION) {
      // In der Schwungfensterphase: beim ERSTEN Eintritt (Phase kam gerade
      // von "davor") einen frischen Schwung von der alten Standposition zur
      // neuen Idealposition beginnen.
      if (!leg.swinging) {
        leg.swinging = true;
        leg.swingFromX = leg.groundX;
        leg.swingFromY = leg.groundY;
      }
      const t = localPhase / SWING_FRACTION;
      // Leichtes Einziehen zur Mitte des Schwungs (top-down-taugliche
      // "Anheben"-Andeutung ohne Z-Achse, s. Abschnitt 5).
      const lift = Math.sin(t * Math.PI) * 0.35;
      const curX = leg.swingFromX + (idealX - leg.swingFromX) * t;
      const curY = leg.swingFromY + (idealY - leg.swingFromY) * t;
      const toBodyX = tank.x - curX;
      const toBodyY = tank.y - curY;
      const toBodyLen = Math.hypot(toBodyX, toBodyY) || 1;
      leg.footX = curX + (toBodyX / toBodyLen) * bcfg.legReachPx * lift * 0.3;
      leg.footY = curY + (toBodyY / toBodyLen) * bcfg.legReachPx * lift * 0.3;
      leg.groundX = idealX;
      leg.groundY = idealY;
    } else {
      // Standphase: Fuss bleibt exakt an der zuletzt geplanten Position.
      leg.swinging = false;
      leg.footX = leg.groundX;
      leg.footY = leg.groundY;
    }
  }
}

// ---- Beinschaden / -zerstoerung (Abschnitt 10) ----------------------------
function damageLeg(state, tank, leg, dmg) {
  if (!leg.alive) return;
  leg.hp -= dmg;
  if (leg.hp > 0) return;
  leg.alive = false;
  tank.spiderLegsAlive = aliveLegs(tank).length;
  const bcfg = state.data.balance.boss.spider;
  applySpiderSpeed(tank, bcfg);
  // Neuer Beinverlust ERNEUERT das Fenster auf volle legStunS (Abschnitt 10:
  // "kann das aktuelle Betaeubungsfenster erneuern"), addiert sich nicht.
  tank.spiderVulnerableTimer = bcfg.legStunS;
  state.sounds.push({ name: 'boom', x: leg.jointX });
  state.addShake(5);
  state.spawnParticles(leg.footX, leg.footY, '#3a3540', 14, 150);
}

// Bullet-vs-Bein-Kollision (Abschnitt 26): eigene, kleine Schleife statt
// Legs in die grosse Panzer-Trefferschleife zu pressen (dieselbe
// Begruendung wie bei der Geister-Kollisionsschleife in state.js) -- Beine
// sind keine state.tanks-Eintraege. Nur SPIELER-/GEISTER-/CHAMPION-Geschosse
// zaehlen (Abschnitt 25/26); Flaechenschaden (Minen) laeuft separat ueber
// damageLegsInRadius().
export function updateSpiderLegHits(state) {
  const tank = state.spiderBoss;
  if (!tank || !tank.alive || !tank.spiderLegs) return;
  const bcfg = state.data.balance.boss.spider;
  for (const b of state.bullets) {
    if (b.dead) continue;
    const friendly = b.owner === state.player || b.owner?.isGhost;
    if (!friendly) continue;
    for (const leg of tank.spiderLegs) {
      if (!leg.alive) continue;
      const midX = (leg.jointX + leg.footX) / 2;
      const midY = (leg.jointY + leg.footY) / 2;
      if (circlesOverlap(midX, midY, bcfg.legHitRadiusPx, b.x, b.y, b.radius)) {
        b.dead = true;
        damageLeg(state, tank, leg, b.damage ?? 1);
        break;
      }
    }
  }
}

// Flaechenschaden (Spinnenminen) gegen mehrere Beine gleichzeitig
// (Abschnitt 26: "Flaechenschaden kann mehrere tatsaechlich betroffene
// Beine treffen").
export function damageSpiderLegsInRadius(state, x, y, R, dmg) {
  const tank = state.spiderBoss;
  if (!tank || !tank.alive || !tank.spiderLegs) return;
  const bcfg = state.data.balance.boss.spider;
  for (const leg of tank.spiderLegs) {
    if (!leg.alive) continue;
    const midX = (leg.jointX + leg.footX) / 2;
    const midY = (leg.jointY + leg.footY) / 2;
    if (circlesOverlap(midX, midY, bcfg.legHitRadiusPx, x, y, R)) {
      damageLeg(state, tank, leg, dmg);
    }
  }
}

// Aim-Punkt fuer Geisterpanzer/Champion (ghost.js: updateGhosts()): solange
// der Koerper geschuetzt ist, soll ein Untertan lieber auf ein vorhandenes
// Bein zielen statt wirkungslos auf den Koerper zu schiessen (Abschnitt 25).
export function spiderAimPoint(target, gx, gy) {
  if (!target?.cfg?.spiderBoss || !target.spiderLegs) return target;
  if (!(target.spiderLegsAlive > 0) || target.spiderVulnerableTimer > 0) return target;
  let best = null;
  let bestD = Infinity;
  for (const leg of target.spiderLegs) {
    if (!leg.alive) continue;
    const d = Math.hypot(leg.footX - gx, leg.footY - gy);
    if (d < bestD) {
      bestD = d;
      best = leg;
    }
  }
  return best ? { x: best.footX, y: best.footY, heading: target.heading } : target;
}

// ---- Spinnennetze (Abschnitt 18/19) ---------------------------------------
function spawnSpiderWeb(state, x, y) {
  const wcfg = state.data.balance.boss.spider.web;
  state.spiderWebs.push({ x, y, hp: wcfg.maxHp, maxHp: wcfg.maxHp, age: 0 });
  state.sounds.push({ name: 'mine', x });
}

export function updateSpiderWebs(state, dt) {
  const webs = state.spiderWebs;
  if (!webs || !webs.length) return;
  const wcfg = state.data.balance.boss.spider.web;
  for (const w of webs) {
    if (w.dead) continue;
    w.age += dt;
    w.hp -= wcfg.decayPerS * dt;
    if (w.age >= wcfg.maxLifeS || w.hp <= 0) {
      w.dead = true;
      continue;
    }
    // Geschosse von Spieler/Geist/Champion zerstoeren das Netz -- HP-basiert
    // (Abschnitt 18, wortgetreu die vorgerechneten Beispiele: ein frisches
    // Netz braucht 2 Treffer mit Spielerschaden 10 bzw. 3 Treffer mit
    // Nekromant-Schaden 8, nicht EINEN beliebigen Treffer). Der Aufschlag
    // zieht b.damage von w.hp ab -- derselbe Wert, der auch gegen einen
    // Panzer ziehen wuerde -- statt das Netz pauschal beim ersten Kontakt
    // zu loeschen.
    for (const b of state.bullets) {
      if (b.dead) continue;
      if (!(b.owner === state.player || b.owner?.isGhost)) continue;
      if (circlesOverlap(w.x, w.y, wcfg.hitRadiusPx, b.x, b.y, b.radius)) {
        b.dead = true;
        w.hp -= b.damage ?? 1;
        if (w.hp <= 0) {
          w.dead = true;
          state.spawnParticles(w.x, w.y, '#e8e4d8', 8, 90);
        } else {
          state.spawnParticles(w.x, w.y, '#e8e4d8', 4, 60);
        }
        break;
      }
    }
    if (w.dead) continue;
    // Beruehrung: Hauptpanzer, Geisterpanzer, Champion -- Abschnitt 19.
    // Verwendet ausdruecklich das bestehende Statussystem (status.js), das
    // updateStatus()-Schleife ist dafuer auf state.ghosts erweitert (s.
    // status.js). Netz verschwindet SOFORT bei Beruehrung.
    const candidates = [state.player, ...state.ghosts.filter((g) => g.alive)];
    for (const t of candidates) {
      if (!t || !t.alive) continue;
      if (circlesOverlap(w.x, w.y, wcfg.hitRadiusPx, t.x, t.y, t.cfg?.radius ?? 12)) {
        state.applyStatus(t, 'web', 1, {});
        w.dead = true;
        state.spawnParticles(w.x, w.y, '#e8e4d8', 10, 100);
        state.sounds.push({ name: 'shield', x: w.x });
        break;
      }
    }
  }
  state.spiderWebs = webs.filter((w) => !w.dead);
}

// ---- Saeulen (Phase 3, Abschnitt 22) ---------------------------------------
function initPillars(state, tank, bcfg) {
  state.spiderPillars = bcfg.pillars.map((p, i) => ({
    col: p.col,
    row: p.row,
    solid: false,
    timer: i === 0 ? 0 : bcfg.pillarOffsetS, // zeitversetzt (Abschnitt 22)
    warned: false,
  }));
}

function updatePillars(state, bcfg, dt) {
  const pillars = state.spiderPillars;
  if (!pillars) return;
  for (const p of pillars) {
    p.timer -= dt;
    const dur = p.solid ? bcfg.pillarUpS : bcfg.pillarCycleS - bcfg.pillarUpS;
    // Kurzer sichtbarer Hinweis (Abschnitt 22), bevor die Saeule
    // verschwindet bzw. hochfaehrt -- niemals ohne Vorwarnung.
    if (!p.warned && p.timer <= bcfg.pillarWarnS) p.warned = true;
    if (p.timer <= 0) {
      p.solid = !p.solid;
      p.warned = false;
      p.timer = p.solid ? bcfg.pillarUpS : bcfg.pillarCycleS - bcfg.pillarUpS;
      state.setWallSolid(p.col, p.row, p.solid);
      state.sounds.push({ name: 'mine', x: p.col * CELL + CELL / 2 });
    }
  }
}

// ---- Phase-3-Uebergang (Abschnitt 21) --------------------------------------
function beginTransition(state, tank, bcfg) {
  tank.spiderPhase = 'transition';
  tank.spiderTransitionT = 0;
  // Alle inneren Waende weg, Aussenrand bleibt (Abschnitt 21 Punkt 3/4).
  for (const w of [...state.walls]) {
    if (w.type !== 'solid') continue;
    if (w.row === 0 || w.row === ROWS - 1 || w.col === 0 || w.col === COLS - 1) continue;
    state.setWallSolid(w.col, w.row, false);
  }
  // Keine unvermeidbaren Treffer waehrend des Umbaus (Abschnitt 21 Punkt
  // 8-11): eigene Bossgeschosse/Minen/Netze kontrolliert abraeumen.
  for (const b of state.bullets) if (b.owner === tank) b.dead = true;
  for (const m of state.spiderMines) m.dead = true;
  for (const w of state.spiderWebs) w.dead = true;
  state.spiderMines = [];
  state.spiderWebs = [];
  state.sounds.push({ name: 'kill', x: tank.x });
  state.addShake(8);
}

function finishTransition(state, tank, bcfg) {
  tank.spiderPhase = 3;
  tank.x = bcfg.stationaryPos.x;
  tank.y = bcfg.stationaryPos.y;
  tank.prevX = tank.x;
  tank.prevY = tank.y;
  tank.vx = 0;
  tank.vy = 0;
  tank.heading = Math.PI / 2; // schaut nach unten in die Arena
  initPillars(state, tank, bcfg);
  tank.spiderBulletHellState = 'pause';
  tank.spiderBulletHellT = bcfg.phases['3'].pauseS * 0.5; // erste Welle nicht sofort
  tank.spiderMineTimer = bcfg.phases['3'].mineEveryS * 0.5;
  tank.spiderWebTimer = bcfg.phases['3'].webEveryS * 0.5;
  state.sounds.push({ name: 'clear', x: tank.x });
}

// ---- Bullet Hell (Phase 3, Abschnitt 23) -----------------------------------
function updateBulletHell(state, tank, bcfg, dt) {
  const pcfg = bcfg.phases['3'];
  tank.spiderBulletHellT -= dt;
  if (tank.spiderBulletHellState === 'pause') {
    if (tank.spiderBulletHellT <= 0) {
      tank.spiderBulletHellState = 'warn';
      tank.spiderBulletHellT = pcfg.warnS;
    }
    return;
  }
  if (tank.spiderBulletHellState === 'warn') {
    if (tank.spiderBulletHellT <= 0) {
      tank.spiderBulletHellState = 'wave';
      tank.spiderBulletHellT = pcfg.waveS;
    }
    return;
  }
  // 'wave': rotierender Geschossfaecher mit breiten Luecken -- immer nur
  // EIN klar erkennbares Muster gleichzeitig (Abschnitt 23).
  const spokeCount = 5;
  const gapDeg = 360 / spokeCount / 2; // Luecke zwischen den Speichen
  tank.spiderBulletHellAngle += dt * 1.1; // Rotationsgeschwindigkeit des Faechers
  if (Math.floor(tank.spiderBulletHellT / 0.35) !== Math.floor((tank.spiderBulletHellT + dt) / 0.35)) {
    // Seed-Determinismus (Abschnitt 30): kein Math.random() -- die Mitte des
    // konfigurierten Geschwindigkeitsbands reicht, echte Varianz kommt
    // ohnehin schon aus dem rotierenden Faecher (spiderBulletHellAngle).
    const speed = (pcfg.bulletHellSpeedMinPxS + pcfg.bulletHellSpeedMaxPxS) / 2;
    for (let i = 0; i < spokeCount; i++) {
      const a = tank.spiderBulletHellAngle + (i * 360) / spokeCount + gapDeg * 0.5;
      const rad = deg2rad(a);
      state.bullets.push(
        createBullet(tank.x + Math.cos(rad) * (tank.cfg.radius + 8), tank.y + Math.sin(rad) * (tank.cfg.radius + 8), rad, {
          speed,
          radius: state.data.physics.bulletRadius,
          owner: tank,
          damage: pcfg.bulletHellDamage,
        }),
      );
    }
    state.sounds.push({ name: 'shoot_enemy', x: tank.x });
  }
  if (tank.spiderBulletHellT <= 0) {
    tank.spiderBulletHellState = 'pause';
    tank.spiderBulletHellT = pcfg.pauseS;
  }
}

// ---- Hauptfunktion ----------------------------------------------------------
export function stepSpiderBoss(tank, state, dt) {
  const bcfg = state.data.balance.boss.spider;
  if (!tank.spiderLegs) initSpiderLegs(tank, bcfg);
  tank.prevX = tank.x;
  tank.prevY = tank.y;

  if (tank.spiderPhase === 'transition') {
    tank.spiderTransitionT += dt;
    if (tank.spiderTransitionT >= bcfg.transitionS) finishTransition(state, tank, bcfg);
    updateLegGeometry(tank, state, bcfg, dt); // fuer die Rendering-Konsistenz, laeuft aber nicht mehr (Beine alle weg)
    return;
  }

  if (tank.spiderPhase === 3) {
    updatePillars(state, bcfg, dt);
    updateLegGeometry(tank, state, bcfg, dt);
    updateBulletHell(state, tank, bcfg, dt);
    stepSpiderSupport(state, tank, bcfg, bcfg.phases['3'], dt);
    return;
  }

  // Phase 1/2: Betaeubungsfenster laeuft ab (Abschnitt 10) -- WAEHREND
  // dieser Zeit: keine Bewegung, kein Feuer, keine neuen Minen/Netze
  // (Timer werden bewusst NICHT dekrementiert, s. u. -- "keine unfaire
  // Sofortsalve", nichts staut sich auf).
  const stunned = tank.spiderVulnerableTimer > 0;
  if (stunned) {
    tank.spiderVulnerableTimer -= dt;
    if (tank.spiderVulnerableTimer <= 0 && tank.spiderLegsAlive === 0) {
      beginTransition(state, tank, bcfg);
      return;
    }
  } else if (tank.spiderLegsAlive === 0) {
    // Randfall: alle Beine schon vor Ablauf eines (kuenstlichen) Timers weg.
    beginTransition(state, tank, bcfg);
    return;
  } else {
    // Bewegung: verfolgt geradlinig den HAUPTPANZER (Abschnitt 9), ignoriert
    // dabei innere Waende komplett -- nur die Aussenwand bleibt unueber-
    // windbar (harte Pixel-Klammer statt Wandkollision).
    const p = state.player;
    if (p.alive) {
      const dx = p.x - tank.x;
      const dy = p.y - tank.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const step = tank.cfg.speed * dt;
        tank.x += (dx / dist) * Math.min(step, dist);
        tank.y += (dy / dist) * Math.min(step, dist);
        tank.heading = Math.atan2(dy, dx);
      }
    }
    const r = tank.cfg.radius;
    tank.x = Math.max(r, Math.min(WIDTH - r, tank.x));
    tank.y = Math.max(r, Math.min(HEIGHT - r, tank.y));

    // Phase-2-Schwelle (Abschnitt 13, 50% Boss-LP) -- einmalig, kein
    // Zurueckfallen auf Phase 1, wenn hp durch die Bodenklammer wieder
    // steigt (die Klammer HEBT hp nur an, senkt sie nie).
    if (tank.spiderPhase === 1 && tank.hp <= tank.cfg.maxHp * bcfg.phase2AtHpPct) {
      tank.spiderPhase = 2;
    }
    const pcfg = bcfg.phases[String(tank.spiderPhase)];
    stepSpiderSupport(state, tank, bcfg, pcfg, dt);

    // Normaler Schuss (Abschnitt 12/13): dieselbe roleTurret()-Logik wie
    // jeder andere Gegner -- accuracy/Sichtlinie/Kegel unveraendert, nur
    // Schadenswert/Feuerrate/Geschosstempo kommen aus dem Phasenprofil.
    tank.cfg.damage = pcfg.bossDamage;
    tank.cfg.fireCooldown = pcfg.fireRateS;
    tank.cfg.bulletSpeed = pcfg.bulletSpeedPxS;
    if (roleTurret(tank, state, dt)) fireBullet(tank, state);
  }
  applySpiderSpeed(tank, bcfg);
  updateLegGeometry(tank, state, bcfg, dt);
}

// Minen-/Netz-Ausloesetimer, geteilt zwischen Phase 1/2 (bewegt) und Phase 3
// (stationaer) -- nur das Phasenprofil (pcfg) unterscheidet sich.
function stepSpiderSupport(state, tank, bcfg, pcfg, dt) {
  tank.spiderMineTimer -= dt;
  if (tank.spiderMineTimer <= 0) {
    tank.spiderMineTimer = pcfg.mineEveryS;
    // spiderPhaseCfg haengt am BOSS (Verfolgungstempo der aktuellen Phase),
    // spidermine.js liest es ueber m.owner.spiderPhaseCfg -- einmal je
    // Ausbringung setzen reicht, alle Minen desselben Bosses teilen es sich.
    tank.spiderPhaseCfg = pcfg;
    const activeCount = (state.spiderMines || []).filter((m) => !m.dead).length;
    for (let i = 0; i < pcfg.mineCount && activeCount + i < pcfg.maxMines; i++) {
      spawnSpiderMine(state, tank);
    }
  }
  tank.spiderWebTimer -= dt;
  if (tank.spiderWebTimer <= 0) {
    tank.spiderWebTimer = pcfg.webEveryS;
    const p = state.player;
    if (p?.alive) spawnSpiderWeb(state, p.x, p.y);
  }
}
