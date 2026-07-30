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
// Zwei orthogonale Sonderverhalten (wie armor/miner): leadAim (Vorhalte-
// zielen, frueher t_black: predict) und requiresBounceShot (Abpraller-
// Rechner, frueher t_green-Vorschlag "bounce_solver" -- aktuell von
// keinem Typ genutzt, Mechanik bleibt fuer spaetere Phasen/Typen bereit).

import { range } from '../core/rng.js';
import { angleDiff, turnToward, playerInSight, muzzleBlocked, clearLine } from './ai.js';

function turnSpeedFor(accuracy) {
  return 1.6 + accuracy * 2.4;
}

function jitterFor(accuracy) {
  return 0.4 * (1 - accuracy);
}

// Abpraller-Rechner: simuliert Kandidatenwinkel als reflektierende
// Strahlen (bis zu ricochets Abpraller) und liefert NUR eine Loesung,
// wenn ein Ein- oder Zwei-Wand-Treffer existiert. Direkte Treffer werden
// verworfen -- ein Panzer mit requiresBounceShot schiesst fast nie direkt.
function solveBounce(tank, state, cfg) {
  const p = state.player;
  if (!p.alive) return null;
  const step = state.data.ai.raycastStepPx;
  const maxB = tank.cfg.ricochets;
  const hitR = p.cfg.radius + cfg.hitTolerancePx;
  for (let i = 0; i < cfg.angleSamples; i++) {
    const ang = -Math.PI + (2 * Math.PI * i) / cfg.angleSamples;
    let dx = Math.cos(ang);
    let dy = Math.sin(ang);
    let x = tank.x + dx * (tank.cfg.radius + 8);
    let y = tank.y + dy * (tank.cfg.radius + 8);
    if (state.isSolid(x, y)) continue; // Muendung zeigt in eine Wand
    let bounces = 0;
    for (let d = 0; d < cfg.maxTravelPx; d += step) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (state.isSolid(nx, ny)) {
        const sx = state.isSolid(nx, y);
        const sy = state.isSolid(x, ny);
        if (sx) dx = -dx;
        if (sy) dy = -dy;
        if (!sx && !sy) {
          dx = -dx;
          dy = -dy;
        }
        bounces++;
        if (bounces > maxB) break;
        continue;
      }
      x = nx;
      y = ny;
      const ddx = x - p.x;
      const ddy = y - p.y;
      if (ddx * ddx + ddy * ddy < hitR * hitR) {
        if (bounces >= 1) return ang; // Ein-/Zwei-Wand-Loesung gefunden
        break; // direkter Treffer -> verwerfen
      }
    }
  }
  return null;
}

function bounceShot(tank, state, dt) {
  const cfg = state.data.ai.bounceShot;
  const ai = tank.ai;
  if (ai.solveTimer === undefined) ai.solveTimer = range(state.rng, 0, cfg.solveIntervalS);
  ai.solveTimer -= dt;
  if (ai.solveTimer <= 0) {
    // Frame-Budget (Phase 11b): solveBounce() marched angleSamples Strahlen
    // ueber die halbe Arena -- mit drei Bankshot-Gegnern im selben Frame lag
    // der schlechteste Logikschritt gemessen bei 5,7 ms (Budget 6 ms).
    // Deshalb loest hoechstens `solvesPerTick` Panzer pro Frame; die
    // uebrigen behalten ihre alte Loesung und versuchen es im naechsten
    // Frame erneut (Muster wie die Reihum-Deckungswahrnehmung aus Phase 16).
    if (state.bounceSolveBudget > 0) {
      state.bounceSolveBudget--;
      ai.solution = solveBounce(tank, state, cfg);
      ai.solveTimer = cfg.solveIntervalS;
    }
  }
  if (ai.solution == null) {
    const p = state.player;
    if (p.alive) {
      const toP = Math.atan2(p.y - tank.y, p.x - tank.x);
      tank.turret = turnToward(tank.turret, toP, cfg.turnSpeed * 0.5 * dt);
    }
    return false;
  }
  tank.turret = turnToward(tank.turret, ai.solution, cfg.turnSpeed * dt);
  return Math.abs(angleDiff(tank.turret, ai.solution)) < cfg.fireConeRad;
}

export function roleTurret(tank, state, dt) {
  const cfg = tank.cfg;
  const p = state.player;
  if (!p.alive) return false;

  if (cfg.requiresBounceShot) return bounceShot(tank, state, dt);

  const acc = cfg.accuracy ?? 0.5;
  const turnSpeed = turnSpeedFor(acc);
  const muzzleClearPx = state.data.ai.muzzleClearPx;

  // Rein zufaellig schwenkender Turm (frueher t_brown: random_seek) --
  // kein Spieler-Tracking, feuert nur bei zufaelliger freier Sicht.
  if (acc <= 0 && !cfg.leadAim) {
    const ai = tank.ai;
    if (ai.seekTimer === undefined) ai.seekTimer = 0;
    ai.seekTimer -= dt;
    if (ai.seekTimer <= 0) {
      ai.seekTarget = range(state.rng, -Math.PI, Math.PI);
      ai.seekTimer = range(state.rng, 0.8, 2.2);
    }
    tank.turret = turnToward(tank.turret, ai.seekTarget, turnSpeed * dt);
    return playerInSight(tank, state);
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
  if (Math.abs(angleDiff(tank.turret, target)) >= fireConeRad) return false;
  if (muzzleBlocked(tank, state, muzzleClearPx)) return false;
  // Grober Fehlerwinkel feuert auch blind (frueher: weak_aim); ab
  // praezisem Zielen wird eine freie Sichtlinie verlangt (frueher: aim/
  // strong_aim). Vorhaltezielen verlangt sie immer.
  const needSight = acc >= 0.3 || cfg.leadAim;
  if (needSight && !clearLine(state, tank.x, tank.y, targetX, targetY)) return false;
  return true;
}
