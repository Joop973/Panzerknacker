// Fahrverhalten der Gegner (Spec Abschnitt 5) -- die zweite KI-Achse.
//
// Jede Funktion bekommt (tank, state, dt) und gibt den Bewegungsvektor
// zurueck. Basis ist steer() aus ai.js (weiches Lenken + Blockade-Pivot,
// fahrende Panzer bleiben NIE stehen). Stellwerte: tanks.json -> ai.drive.

import { range } from '../core/rng.js';
import { steer, clearLine } from './ai.js';

// Naechstes anfliegendes Fremd-Geschoss im Gefahrenradius (fuer
// Ausweich-/Fluchtverhalten von t_teal, t_black, t_white-defensiv).
function nearestThreat(tank, state, dangerPx) {
  let best = null;
  let bestD = dangerPx;
  for (const b of state.bullets) {
    if (b.dead || b.owner === tank) continue;
    const dx = tank.x - b.x;
    const dy = tank.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d >= bestD) continue;
    if (b.vx * dx + b.vy * dy <= 0) continue; // fliegt weg -> harmlos
    best = b;
    bestD = d;
  }
  return best;
}

// Fixe Panzer (t_brown, t_green): bewegen sich nicht.
function none() {
  return { x: 0, y: 0 };
}

// t_grey / t_yellow: ziellos. Zielwinkel wird periodisch neu gewuerfelt;
// t_yellow mischt zusaetzlich die Minen-Abstossung hinein.
function wander(tank, state, dt) {
  const cfg = state.data.ai.drive.wander;
  const ai = tank.ai;
  if (ai.wanderTimer === undefined) {
    ai.wanderTimer = 0;
    ai.wanderTarget = range(state.rng, -Math.PI, Math.PI);
  }
  ai.wanderTimer -= dt;
  if (ai.wanderTimer <= 0) {
    ai.wanderTarget = range(state.rng, -Math.PI, Math.PI);
    ai.wanderTimer = range(state.rng, cfg.retargetMinS, cfg.retargetMaxS);
  }
  // Minen-Ausweichen (t_yellow) uebernimmt steer() zentral.
  return steer(tank, state, dt, ai.wanderTarget, cfg);
}

// t_pink: offensiv, verfolgt den Spieler direkt.
function pursue(tank, state, dt) {
  const cfg = state.data.ai.drive.pursue;
  const p = state.player;
  const target = p.alive
    ? Math.atan2(p.y - tank.y, p.x - tank.x)
    : (tank.ai.driveAngle ?? 0);
  return steer(tank, state, dt, target, cfg);
}

// t_teal: defensiv. Weicht anfliegenden Geschossen seitlich aus, haelt
// sonst Abstand zum Spieler und umkreist ihn.
function evade(tank, state, dt) {
  const cfg = state.data.ai.drive.evade;
  const ai = tank.ai;
  const p = state.player;
  if (ai.orbitDir === undefined) {
    ai.orbitDir = state.rng() < 0.5 ? -1 : 1;
    ai.orbitTimer = range(state.rng, cfg.orbitFlipMinS, cfg.orbitFlipMaxS);
  }
  ai.orbitTimer -= dt;
  if (ai.orbitTimer <= 0) {
    ai.orbitDir = -ai.orbitDir;
    ai.orbitTimer = range(state.rng, cfg.orbitFlipMinS, cfg.orbitFlipMaxS);
  }

  let target;
  const threat = nearestThreat(tank, state, cfg.bulletDangerPx);
  if (threat) {
    // Seitlich zur Geschossbahn, auf der vom Kurs wegzeigenden Seite.
    const ba = Math.atan2(threat.vy, threat.vx);
    const cross =
      threat.vx * (tank.y - threat.y) - threat.vy * (tank.x - threat.x);
    const side = cross >= 0 ? 1 : -1;
    target = ba + (side * Math.PI) / 2;
  } else if (p.alive) {
    const toP = Math.atan2(p.y - tank.y, p.x - tank.x);
    const d = Math.hypot(p.x - tank.x, p.y - tank.y);
    if (d < cfg.keepDistancePx) target = toP + Math.PI; // Abstand halten
    else if (d > cfg.approachDistancePx) target = toP; // rankommen
    else target = toP + (ai.orbitDir * Math.PI) / 2; // umkreisen
  } else {
    target = ai.driveAngle ?? 0;
  }
  return steer(tank, state, dt, target, cfg);
}

// t_purple: offensiv bei Sichtlinie -- direkt drauf. Ohne Sichtlinie
// koordinieren sich mehrere t_purple: jeder steuert einen seitlich
// versetzten Punkt an, sodass sie aus unterschiedlichen Winkeln kommen.
function purplePack(tank, state, dt) {
  const cfg = state.data.ai.drive.purple_pack;
  const p = state.player;
  if (!p.alive) return steer(tank, state, dt, tank.ai.driveAngle ?? 0, cfg);

  let target;
  if (clearLine(state, tank.x, tank.y, p.x, p.y)) {
    target = Math.atan2(p.y - tank.y, p.x - tank.x);
  } else {
    const purples = state.tanks.filter((t) => t.type === 't_purple' && t.alive);
    const side = purples.indexOf(tank) % 2 === 0 ? 1 : -1;
    const base = Math.atan2(tank.y - p.y, tank.x - p.x);
    const flank = base + side * cfg.flankAngleRad;
    const gx = p.x + Math.cos(flank) * cfg.standoffPx;
    const gy = p.y + Math.sin(flank) * cfg.standoffPx;
    target = Math.atan2(gy - tank.y, gx - tank.x);
  }
  return steer(tank, state, dt, target, cfg);
}

// t_black: sehr schnell, defensiv. Flieht vor anfliegenden Geschossen,
// haelt sonst ein Abstandsband zum Spieler und umkreist ihn.
function blackSkirmish(tank, state, dt) {
  const cfg = state.data.ai.drive.black_skirmish;
  const ai = tank.ai;
  const p = state.player;
  if (ai.orbitDir === undefined) {
    ai.orbitDir = state.rng() < 0.5 ? -1 : 1;
    ai.orbitTimer = range(state.rng, cfg.orbitFlipMinS, cfg.orbitFlipMaxS);
  }
  ai.orbitTimer -= dt;
  if (ai.orbitTimer <= 0) {
    ai.orbitDir = -ai.orbitDir;
    ai.orbitTimer = range(state.rng, cfg.orbitFlipMinS, cfg.orbitFlipMaxS);
  }

  let target;
  const threat = nearestThreat(tank, state, cfg.bulletDangerPx);
  if (threat) {
    // Flieht bei Beschuss: direkt vom Geschoss weg.
    target = Math.atan2(tank.y - threat.y, tank.x - threat.x);
  } else if (p.alive) {
    const toP = Math.atan2(p.y - tank.y, p.x - tank.x);
    const d = Math.hypot(p.x - tank.x, p.y - tank.y);
    if (d < cfg.minDistPx) target = toP + Math.PI;
    else if (d > cfg.maxDistPx) target = toP;
    else target = toP + (ai.orbitDir * Math.PI) / 2;
  } else {
    target = ai.driveAngle ?? 0;
  }
  return steer(tank, state, dt, target, cfg);
}

// t_white: wechselt zwischen offensiv (verfolgen) und defensiv
// (ausweichen). Beim Wechsel spielt ein hoher bzw. tiefer Ton
// (Minimal-Audio; state.sounds wird von main.js abgespielt).
function whitePhase(tank, state, dt) {
  const cfg = state.data.ai.drive.white_phase;
  const ai = tank.ai;
  if (ai.mode === undefined) {
    ai.mode = 'defensive';
    ai.modeTimer = range(state.rng, cfg.modeSwitchMinS, cfg.modeSwitchMaxS);
  }
  ai.modeTimer -= dt;
  if (ai.modeTimer <= 0) {
    ai.mode = ai.mode === 'offensive' ? 'defensive' : 'offensive';
    ai.modeTimer = range(state.rng, cfg.modeSwitchMinS, cfg.modeSwitchMaxS);
    state.sounds.push(ai.mode === 'offensive' ? 'tone_high' : 'tone_low');
  }
  return ai.mode === 'offensive'
    ? pursue(tank, state, dt)
    : evade(tank, state, dt);
}

export const DRIVES = {
  none,
  wander,
  pursue,
  evade,
  purple_pack: purplePack,
  black_skirmish: blackSkirmish,
  white_phase: whitePhase,
};
