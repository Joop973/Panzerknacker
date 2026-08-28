// Turmverhalten der Gegner (Spec Abschnitt 5) -- eine Achse der KI.
//
// Phase 8: statt sechs benannter Turmfunktionen gibt es eine einzige,
// generische Funktion, die tank.cfg.accuracy (0..1) kontinuierlich statt
// diskreter Stufen (random_seek/weak_aim/aim/strong_aim) verwendet:
//   accuracy === 0  -> rein zufaellig schwenkender Turm, kein Spieler-
//                      Tracking (frueher t_brown: random_seek).
//   accuracy < 0.3  -> zielt auf den Spieler mit grobem Fehlerwinkel,
//                      feuert auch ohne Sichtlinie (frueher: weak_aim).
//   accuracy >= 0.3 -> zielt praezise, braucht freie Sichtlinie
//                      (frueher: aim/strong_aim).
// Ein orthogonales Sonderverhalten (wie armor/miner): leadAim (Vorhalte-
// zielen, frueher t_black: predict).
//
// Grundsteinumbau Phase 1: der Abpraller-Rechner (frueher requiresBounceShot/
// solveBounce/bounceShot, einziger Nutzer t_green) ist mit dem Bandenschuss
// vollstaendig entfernt -- Details in ARCHIV.md (archive/bandenschuss.md).
// Grundsteinumbau Phase 3: t_green ist jetzt ein Moerserschuetze
// (cfg.weapon === 'mortar', src/game/mortar.js) -- die Zielaufloesung/Kegel-
// /Sichtlinienpruefung unten bleibt unveraendert (dieselbe generische
// Turmlogik wie jeder andere Typ mit accuracy 0.9), nur der minRangePx-Gate
// ganz unten ist mörserspezifisch.

import { range } from '../core/rng.js';
import { angleDiff, turnToward, targetInSight, muzzleBlocked, clearLine, resolveTarget } from './ai.js';

function turnSpeedFor(accuracy) {
  return 1.6 + accuracy * 2.4;
}

function jitterFor(accuracy) {
  return 0.4 * (1 - accuracy);
}

// G2-Falle (weapon:null): t_rusher/t_dud haben keine Waffe, wuerden aber
// ueber den zufaellig schwenkenden Turm unten (acc<=0) trotzdem "feuern"
// signalisieren (targetInSight() kennt kein Waffenfeld) -- state.js riefe
// dann fireBullet() mit einer per resolveCfg()-Rueckfall geratenen
// Kugelgeschwindigkeit auf. Turmdrehung bleibt kosmetisch erhalten, nur der
// Feuerwunsch wird unterdrueckt.
function resetFireWindup(tank) {
  if (tank.ai) tank.ai.windupTimer = 0;
}

// Ladeschuss (t_lance, G2): eigener Zustandsautomat statt der generischen
// Feuerentscheidung unten. Verfolgt das Ziel normal, bis es aufgeloest+
// sichtbar ist, laedt dann `windupS` lang auf -- die letzten `lockAtS`
// Sekunden friert die Richtung ein ("locks with X s remaining", turret dreht
// nicht mehr nach). Sichtverlust bricht in JEDER Ladephase sofort ab (kein
// Schuss, keine Pause). Nach vollem Aufladen feuert es GENAU EINMAL (normaler
// fireBullet()-Pfad -- bulletSpeed/pierce kommen direkt aus tank.cfg) und
// pausiert danach `pauseS` lang.
function chargeTurret(tank, state, dt, cfg, p, turnSpeed) {
  const ai = tank.ai;
  if (!ai.lance) ai.lance = { mode: 'idle', timer: 0 };
  const lance = ai.lance;

  if (lance.mode === 'pause') {
    lance.timer -= dt;
    if (lance.timer <= 0) lance.mode = 'idle';
    return false;
  }

  const target = Math.atan2(p.y - tank.y, p.x - tank.x);
  if (lance.mode !== 'locked') {
    tank.turret = turnToward(tank.turret, target, turnSpeed * dt);
  }
  const sighted = clearLine(state, tank.x, tank.y, p.x, p.y);

  if (lance.mode === 'idle') {
    const inCone = Math.abs(angleDiff(tank.turret, target)) < 0.1;
    if (inCone && sighted) {
      lance.mode = 'charging';
      lance.timer = 0;
      state.sounds.push({ name: 'wave', x: tank.x });
    }
    return false;
  }

  // charging/locked: einzige Abbruchbedingung ist Sichtverlust (Auftragstext).
  if (!sighted) {
    lance.mode = 'idle';
    lance.timer = 0;
    return false;
  }
  lance.timer += dt;
  const lockAt = (cfg.charge.windupS ?? 0) - (cfg.charge.lockAtS ?? 0);
  if (lance.mode === 'charging' && lance.timer >= lockAt) lance.mode = 'locked';
  if (lance.timer >= (cfg.charge.windupS ?? 0)) {
    lance.mode = 'pause';
    lance.timer = cfg.charge.pauseS ?? 0;
    return true;
  }
  return false;
}

export function roleTurret(tank, state, dt) {
  const cfg = tank.cfg;
  // Upgradepool-v2 Phase 5: p ist das aufgeloeste Ziel (Spieler oder Geist),
  // nicht mehr fest state.player. Bosse ueberschreiben tank.ai.target vor
  // diesem Aufruf selbst (bossai.js: Fixierung).
  const p = resolveTarget(tank, state);
  if (!p.alive) {
    resetFireWindup(tank);
    return false;
  }

  const acc = cfg.accuracy ?? 0.5;
  const turnSpeed = turnSpeedFor(acc);
  const muzzleClearPx = state.data.ai.muzzleClearPx;

  // Ladeschuss (t_lance) ersetzt die ganze Feuerentscheidung unten.
  if (cfg.charge) return chargeTurret(tank, state, dt, cfg, p, turnSpeed);

  // Rein zufaellig schwenkender Turm (frueher t_brown: random_seek) --
  // kein Ziel-Tracking, feuert nur bei zufaelliger freier Sicht.
  if (acc <= 0 && !cfg.leadAim) {
    const ai = tank.ai;
    if (ai.seekTimer === undefined) ai.seekTimer = 0;
    ai.seekTimer -= dt;
    if (ai.seekTimer <= 0) {
      ai.seekTarget = range(state.rng, -Math.PI, Math.PI);
      ai.seekTimer = range(state.rng, 0.8, 2.2);
    }
    tank.turret = turnToward(tank.turret, ai.seekTarget, turnSpeed * dt);
    if (!cfg.weapon) return false; // t_rusher/t_dud: Turm dreht kosmetisch, feuert nie
    return targetInSight(tank, state, p);
  }

  // Vorhaltezielen (frueher t_black: predict): zielt auf die
  // VORHERGESAGTE Spielerposition (Position + Geschwindigkeit *
  // Geschossflugzeit, iterativ verfeinert) -- kein Fehlerwinkel, seitliches
  // Ausweichen hilft dagegen kaum.
  let targetX = p.x;
  let targetY = p.y;
  if (cfg.leadAim) {
    for (let i = 0; i < 2; i++) {
      const t = Math.hypot(targetX - tank.x, targetY - tank.y) / cfg.bulletSpeed;
      targetX = p.x + p.vx * t;
      targetY = p.y + p.vy * t;
    }
  }

  const ai = tank.ai;
  if (ai.jitterTimer === undefined) ai.jitterTimer = 0;
  ai.jitterTimer -= dt;
  const jitterMag = cfg.leadAim ? 0 : jitterFor(acc);
  if (ai.jitterTimer <= 0) {
    ai.jitter = jitterMag > 0 ? range(state.rng, -jitterMag, jitterMag) : 0;
    ai.jitterTimer = 0.5;
  }
  const target = Math.atan2(targetY - tank.y, targetX - tank.x) + ai.jitter;
  tank.turret = turnToward(tank.turret, target, turnSpeed * dt);
  const fireConeRad = 0.13 - acc * 0.05;
  if (Math.abs(angleDiff(tank.turret, target)) >= fireConeRad) {
    resetFireWindup(tank);
    return false;
  }
  if (muzzleBlocked(tank, state, muzzleClearPx)) {
    resetFireWindup(tank);
    return false;
  }
  // Grober Fehlerwinkel feuert auch blind (frueher: weak_aim); ab
  // praezisem Zielen wird eine freie Sichtlinie verlangt (frueher: aim/
  // strong_aim). Vorhaltezielen verlangt sie immer.
  const needSight = acc >= 0.3 || cfg.leadAim;
  if (needSight && !clearLine(state, tank.x, tank.y, targetX, targetY)) {
    resetFireWindup(tank);
    return false;
  }
  // Mörser (Grundsteinumbau Phase 3, t_green): unter minRangePx feuert er
  // nicht -- sonst bombt er sich selbst weg und ist im Nahkampf absurd
  // (er ist ein Distanzgegner). Die Sichtlinien-Pflicht oben ("braucht
  // Sichtlinie im Moment des Abschusses") gilt unverändert mit.
  if (cfg.weapon === 'mortar') {
    const minRangePx = state.data.balance.mortar?.minRangePx ?? 0;
    if (Math.hypot(p.x - tank.x, p.y - tank.y) < minRangePx) {
      resetFireWindup(tank);
      return false;
    }
  }
  if (!cfg.weapon) return false; // Trap-1-Sicherheitsnetz: weapon:null feuert nie
  // Feuer-Vorwarnung (t_shotgun, G2): Ziel/Sicht/Kegel stehen bereits fest --
  // statt sofort zu feuern, laeuft erst ein `fireWindupS`-Timer ab (0,35s
  // Salvenankuendigung). Bricht die Bedingung mittendrin weg, setzt einer der
  // resetFireWindup()-Aufrufe oben den Timer zurueck -- kein "aufgestauter"
  // Schuss aus einer laengst verlassenen Ausrichtung.
  if (cfg.fireWindupS) {
    ai.windupTimer = (ai.windupTimer || 0) + dt;
    if (ai.windupTimer < cfg.fireWindupS) return false;
    ai.windupTimer = 0;
    return true;
  }
  return true;
}
