// Fahrverhalten der Gegner (Spec Abschnitt 5) -- die zweite KI-Achse.
//
// Phase 8: statt neun eigenen Fahrfunktionen (eine pro Gegnertyp) gibt es
// genau vier ROLLEN (guardian/sapper/hunter/sieger), parametrisiert ueber
// tank.cfg.aggression/preferredRange aus data/tanks.json. Rolle und
// Panzerung bleiben frei kombinierbar (Phase 4 unveraendert). Basis ist
// weiterhin steer() aus ai.js (weiches Lenken + Blockade-Pivot, fahrende
// Panzer bleiben NIE stehen).

import { range } from '../core/rng.js';
import { steer, clearLine } from './ai.js';

// Naechstes anfliegendes Fremd-Geschoss im Gefahrenradius (fuer
// Ausweichverhalten von hunter/sieger).
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

// aggression (0..1) ersetzt die frueheren, pro Fahrverhalten fast
// identisch duplizierten turnSpeed-Werte (1.1 bis 4.5) durch einen
// einzigen, kontinuierlichen Drehfreudigkeits-Regler je Typ.
function turnSpeedFor(aggression) {
  return 1.5 + (aggression ?? 0.5) * 3.0;
}

// steer()-Aufrufparameter: gemeinsames Blockade-Freikommen (frueher pro
// Fahrverhalten fast identisch dupliziert) + rollenspezifischer Zusatz.
function driveCfg(state, tank, extra) {
  return { ...state.data.ai.escape, turnSpeed: turnSpeedFor(tank.cfg.aggression), ...extra };
}

// guardian (t_brown, t_green): verlaesst seine Zone nie -- bewegt sich
// grundsaetzlich nicht (Turm/Feuerverhalten ist Sache von ai_turrets.js).
function guardianDrive() {
  return { x: 0, y: 0 };
}

// sapper (t_grey, t_yellow, t_prism): ziellos wandernd; kommt der Spieler
// naeher als preferredRange, uebernimmt aktive Flucht das Wandern ("flieht
// vor dir"). Minen-Ausweichen (t_yellow) uebernimmt steer() zentral.
function sapperDrive(tank, state, dt) {
  const cfg = state.data.ai.roles.sapper;
  const ai = tank.ai;
  const p = state.player;
  if (ai.wanderTimer === undefined) {
    ai.wanderTimer = 0;
    ai.wanderTarget = range(state.rng, -Math.PI, Math.PI);
  }
  ai.wanderTimer -= dt;
  if (ai.wanderTimer <= 0) {
    ai.wanderTarget = range(state.rng, -Math.PI, Math.PI);
    ai.wanderTimer = range(state.rng, cfg.retargetMinS, cfg.retargetMaxS);
  }
  let target = ai.wanderTarget;
  if (p.alive && tank.cfg.preferredRange > 0) {
    const d = Math.hypot(p.x - tank.x, p.y - tank.y);
    if (d < tank.cfg.preferredRange) target = Math.atan2(tank.y - p.y, tank.x - p.x);
  }
  return steer(tank, state, dt, target, driveCfg(state, tank, cfg));
}

// hunter (t_pink, t_purple, t_white, t_armored): sucht Naehe, weicht dabei
// anfliegenden Geschossen seitlich aus. t_purple (packFlank): ohne
// Sichtlinie flankieren mehrere Panzer aus zwei Richtungen statt
// aufeinander aufzulaufen.
function hunterDrive(tank, state, dt) {
  const cfg = state.data.ai.roles.hunter;
  const p = state.player;
  const threat = nearestThreat(tank, state, cfg.bulletDangerPx);
  let target;
  if (threat) {
    const ba = Math.atan2(threat.vy, threat.vx);
    const cross = threat.vx * (tank.y - threat.y) - threat.vy * (tank.x - threat.x);
    target = ba + ((cross >= 0 ? 1 : -1) * Math.PI) / 2;
  } else if (p.alive) {
    target = Math.atan2(p.y - tank.y, p.x - tank.x);
    if (tank.cfg.packFlank && !clearLine(state, tank.x, tank.y, p.x, p.y)) {
      const pack = state.tanks.filter((t) => t.cfg.packFlank && t.alive);
      const side = pack.indexOf(tank) % 2 === 0 ? 1 : -1;
      const base = Math.atan2(tank.y - p.y, tank.x - p.x);
      const flank = base + side * cfg.flankAngleRad;
      const standoff = tank.cfg.preferredRange || cfg.flankStandoffPx;
      const gx = p.x + Math.cos(flank) * standoff;
      const gy = p.y + Math.sin(flank) * standoff;
      target = Math.atan2(gy - tank.y, gx - tank.x);
    }
  } else {
    target = tank.ai.driveAngle ?? 0;
  }
  return steer(tank, state, dt, target, driveCfg(state, tank, cfg));
}

// sieger (t_teal, t_black): haelt preferredRange, weicht Geschossen aus,
// orbitiert bei passendem Abstand. Firing-Stil (direkt/Vorhalt/Bankshot
// only) ist Sache von ai_turrets.js -- die Rolle bestimmt nur die Position.
function siegerDrive(tank, state, dt) {
  const cfg = state.data.ai.roles.sieger;
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
    const ba = Math.atan2(threat.vy, threat.vx);
    const cross = threat.vx * (tank.y - threat.y) - threat.vy * (tank.x - threat.x);
    const side = cross >= 0 ? 1 : -1;
    target = ba + (side * Math.PI) / 2;
  } else if (p.alive) {
    const toP = Math.atan2(p.y - tank.y, p.x - tank.x);
    const d = Math.hypot(p.x - tank.x, p.y - tank.y);
    const preferred = tank.cfg.preferredRange || cfg.defaultRangePx;
    if (d < preferred - cfg.rangeTolerancePx) target = toP + Math.PI;
    else if (d > preferred + cfg.rangeTolerancePx) target = toP;
    else target = toP + (ai.orbitDir * Math.PI) / 2;
  } else {
    target = ai.driveAngle ?? 0;
  }
  return steer(tank, state, dt, target, driveCfg(state, tank, cfg));
}

export const DRIVES = {
  guardian: guardianDrive,
  sapper: sapperDrive,
  hunter: hunterDrive,
  sieger: siegerDrive,
};
