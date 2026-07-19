// Turmverhalten der Gegner (Spec Abschnitt 5) -- eine Achse der KI.
//
// Jede Funktion bekommt (tank, state, dt), stellt tank.turret und gibt
// den Schusswunsch (bool) zurueck. Stellwerte: data/tanks.json -> ai.turret.

import { range } from '../core/rng.js';
import { angleDiff, turnToward, playerInSight, muzzleBlocked, clearLine } from './ai.js';

// t_brown: Turm schwenkt zufaellig suchend; gefeuert wird nur, wenn der
// Lauf dabei zufaellig freie Sicht auf den Spieler hat.
function randomSeek(tank, state, dt) {
  const cfg = state.data.ai.turret.random_seek;
  const ai = tank.ai;
  if (ai.seekTimer === undefined) ai.seekTimer = 0;
  ai.seekTimer -= dt;
  if (ai.seekTimer <= 0) {
    ai.seekTarget = range(state.rng, -Math.PI, Math.PI);
    ai.seekTimer = range(state.rng, cfg.retargetMinS, cfg.retargetMaxS);
  }
  tank.turret = turnToward(tank.turret, ai.seekTarget, cfg.turnSpeed * dt);
  return playerInSight(tank, state);
}

// Zielendes Grundmuster: aktuelle Spielerposition plus Fehlerwinkel.
// weak_aim (t_grey): grosser Fehler, feuert auch ohne Sichtlinie (blind).
// aim (t_pink/t_purple/t_white): kleiner Fehler, braucht Sichtlinie.
// strong_aim (t_teal): minimaler Fehler, braucht Sichtlinie -- zielt auf
// die AKTUELLE Position, deshalb funktioniert seitliches Ausweichen.
function makeTrackAim(cfgKey, needSight) {
  return function trackAim(tank, state, dt) {
    const cfg = state.data.ai.turret[cfgKey];
    const ai = tank.ai;
    const p = state.player;
    if (ai.jitterTimer === undefined) ai.jitterTimer = 0;
    ai.jitterTimer -= dt;
    if (ai.jitterTimer <= 0) {
      ai.jitter = range(state.rng, -cfg.jitterRad, cfg.jitterRad);
      ai.jitterTimer = cfg.rejitterS;
    }
    if (!p.alive) return false;
    const target = Math.atan2(p.y - tank.y, p.x - tank.x) + ai.jitter;
    tank.turret = turnToward(tank.turret, target, cfg.turnSpeed * dt);
    if (Math.abs(angleDiff(tank.turret, target)) >= cfg.fireConeRad) return false;
    if (muzzleBlocked(tank, state, cfg.muzzleClearPx)) return false;
    if (needSight && !clearLine(state, tank.x, tank.y, p.x, p.y)) return false;
    return true;
  };
}

// t_black: Vorhaltezielen -- zielt auf die VORHERGESAGTE Spielerposition
// (Position + Geschwindigkeit * Geschossflugzeit, iterativ verfeinert).
// Deshalb funktioniert seitliches Ausweichen gegen t_black nicht.
function predict(tank, state, dt) {
  const cfg = state.data.ai.turret.predict;
  const p = state.player;
  if (!p.alive) return false;
  let tx = p.x;
  let ty = p.y;
  for (let i = 0; i < 2; i++) {
    const t = Math.hypot(tx - tank.x, ty - tank.y) / tank.cfg.bulletSpeed;
    tx = p.x + p.vx * t;
    ty = p.y + p.vy * t;
  }
  const target = Math.atan2(ty - tank.y, tx - tank.x);
  tank.turret = turnToward(tank.turret, target, cfg.turnSpeed * dt);
  return (
    Math.abs(angleDiff(tank.turret, target)) < cfg.fireConeRad &&
    !muzzleBlocked(tank, state, cfg.muzzleClearPx) &&
    clearLine(state, tank.x, tank.y, tx, ty)
  );
}

// t_green: Abpraller-Rechner. Simuliert Kandidatenwinkel als
// reflektierende Strahlen (bis zu ricochets Abpraller) und feuert NUR,
// wenn eine Ein- oder Zwei-Wand-Loesung existiert. Direkte Treffer
// werden verworfen -- t_green schiesst fast nie direkt (Spec).
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
        // Achsweise Reflexion wie bei echten Geschossen (inkl. Eckenfall).
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

function bounceSolver(tank, state, dt) {
  const cfg = state.data.ai.turret.bounce_solver;
  const ai = tank.ai;
  if (ai.solveTimer === undefined) ai.solveTimer = range(state.rng, 0, cfg.solveIntervalS);
  ai.solveTimer -= dt;
  if (ai.solveTimer <= 0) {
    ai.solution = solveBounce(tank, state, cfg);
    ai.solveTimer = cfg.solveIntervalS;
  }
  if (ai.solution == null) {
    // Keine Loesung: Turm folgt dem Spieler traege, feuert aber nie.
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

export const TURRETS = {
  random_seek: randomSeek,
  weak_aim: makeTrackAim('weak_aim', false),
  aim: makeTrackAim('aim', true),
  strong_aim: makeTrackAim('strong_aim', true),
  predict,
  bounce_solver: bounceSolver,
};
