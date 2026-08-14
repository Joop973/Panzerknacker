// Fahrverhalten der Gegner (Spec Abschnitt 5) -- die zweite KI-Achse.
//
// Phase 8: statt neun eigenen Fahrfunktionen (eine pro Gegnertyp) gibt es
// genau vier ROLLEN (guardian/sapper/hunter/sieger), parametrisiert ueber
// tank.cfg.aggression/preferredRange aus data/tanks.json. Rolle und
// Panzerung bleiben frei kombinierbar (Phase 4 unveraendert). Basis ist
// weiterhin steer() aus ai.js (weiches Lenken + Blockade-Pivot, fahrende
// Panzer bleiben NIE stehen).

import { range } from '../core/rng.js';
import { steer, clearLine, resolveTarget } from './ai.js';

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

// sapper (t_grey, t_yellow, t_prism): ziellos wandernd; kommt das Ziel
// naeher als preferredRange, uebernimmt aktive Flucht das Wandern ("flieht
// vor dir"). Minen-Ausweichen (t_yellow) uebernimmt steer() zentral.
// Upgradepool-v2 Phase 5: "der Spieler" ist jetzt das aufgeloeste Ziel
// (resolveTarget) -- meist der Spieler, kann aber ein Geist sein.
function sapperDrive(tank, state, dt) {
  const cfg = state.data.ai.roles.sapper;
  const ai = tank.ai;
  const target = resolveTarget(tank, state);
  if (ai.wanderTimer === undefined) {
    ai.wanderTimer = 0;
    ai.wanderTarget = range(state.rng, -Math.PI, Math.PI);
  }
  ai.wanderTimer -= dt;
  if (ai.wanderTimer <= 0) {
    ai.wanderTarget = range(state.rng, -Math.PI, Math.PI);
    ai.wanderTimer = range(state.rng, cfg.retargetMinS, cfg.retargetMaxS);
  }
  let angle = ai.wanderTarget;
  if (target.alive && tank.cfg.preferredRange > 0) {
    const d = Math.hypot(target.x - tank.x, target.y - tank.y);
    if (d < tank.cfg.preferredRange) angle = Math.atan2(tank.y - target.y, tank.x - target.x);
  }
  return steer(tank, state, dt, angle, driveCfg(state, tank, cfg));
}

// hunter (t_pink, t_purple, t_white, t_armored): sucht Naehe zum aufgeloesten
// Ziel, weicht dabei anfliegenden Geschossen seitlich aus. t_purple
// (packFlank): ohne Sichtlinie flankieren mehrere Panzer aus zwei
// Richtungen statt aufeinander aufzulaufen.
function hunterDrive(tank, state, dt) {
  const cfg = state.data.ai.roles.hunter;
  const target = resolveTarget(tank, state);
  const threat = nearestThreat(tank, state, cfg.bulletDangerPx);
  let angle;
  if (threat) {
    const ba = Math.atan2(threat.vy, threat.vx);
    const cross = threat.vx * (tank.y - threat.y) - threat.vy * (tank.x - threat.x);
    angle = ba + ((cross >= 0 ? 1 : -1) * Math.PI) / 2;
  } else if (target.alive) {
    angle = Math.atan2(target.y - tank.y, target.x - tank.x);
    if (tank.cfg.packFlank && !clearLine(state, tank.x, tank.y, target.x, target.y)) {
      const pack = state.tanks.filter((t) => t.cfg.packFlank && t.alive);
      const side = pack.indexOf(tank) % 2 === 0 ? 1 : -1;
      const base = Math.atan2(tank.y - target.y, tank.x - target.x);
      const flank = base + side * cfg.flankAngleRad;
      const standoff = tank.cfg.preferredRange || cfg.flankStandoffPx;
      const gx = target.x + Math.cos(flank) * standoff;
      const gy = target.y + Math.sin(flank) * standoff;
      angle = Math.atan2(gy - tank.y, gx - tank.x);
    }
  } else {
    angle = tank.ai.driveAngle ?? 0;
  }
  return steer(tank, state, dt, angle, driveCfg(state, tank, cfg));
}

// sieger (t_teal, t_black): haelt preferredRange zum aufgeloesten Ziel,
// weicht Geschossen aus, orbitiert bei passendem Abstand. Firing-Stil
// (direkt/Vorhalt/Bankshot only) ist Sache von ai_turrets.js -- die Rolle
// bestimmt nur die Position.
function siegerDrive(tank, state, dt) {
  const cfg = state.data.ai.roles.sieger;
  const ai = tank.ai;
  const target = resolveTarget(tank, state);
  if (ai.orbitDir === undefined) {
    ai.orbitDir = state.rng() < 0.5 ? -1 : 1;
    ai.orbitTimer = range(state.rng, cfg.orbitFlipMinS, cfg.orbitFlipMaxS);
  }
  ai.orbitTimer -= dt;
  if (ai.orbitTimer <= 0) {
    ai.orbitDir = -ai.orbitDir;
    ai.orbitTimer = range(state.rng, cfg.orbitFlipMinS, cfg.orbitFlipMaxS);
  }
  let angle;
  const threat = nearestThreat(tank, state, cfg.bulletDangerPx);
  if (threat) {
    const ba = Math.atan2(threat.vy, threat.vx);
    const cross = threat.vx * (tank.y - threat.y) - threat.vy * (tank.x - threat.x);
    const side = cross >= 0 ? 1 : -1;
    angle = ba + (side * Math.PI) / 2;
  } else if (target.alive) {
    const toTarget = Math.atan2(target.y - tank.y, target.x - tank.x);
    const d = Math.hypot(target.x - tank.x, target.y - tank.y);
    const preferred = tank.cfg.preferredRange || cfg.defaultRangePx;
    if (d < preferred - cfg.rangeTolerancePx) angle = toTarget + Math.PI;
    else if (d > preferred + cfg.rangeTolerancePx) angle = toTarget;
    else angle = toTarget + (ai.orbitDir * Math.PI) / 2;
  } else {
    angle = ai.driveAngle ?? 0;
  }
  return steer(tank, state, dt, angle, driveCfg(state, tank, cfg));
}

// Deckungssuche (Phase 16): samplet Punkte im Ring um den Panzer (kein
// Pathfinding -- "fuer Deckungsverhalten reicht das", PLAN.md) und waehlt
// den naechsten, der begehbar ist UND die Sichtlinie zum Spieler bricht.
// Gibt null zurueck, wenn keiner der Kandidaten Deckung bietet (z. B. der
// Panzer steht schon frei in der Raummitte) -- der Aufrufer faellt dann auf
// das normale Rollen-Verhalten zurueck.
function findCoverPoint(tank, state, cfg) {
  const p = state.player;
  const n = cfg.searchAngles ?? 8;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const cx = tank.x + Math.cos(a) * cfg.searchRadiusPx;
    const cy = tank.y + Math.sin(a) * cfg.searchRadiusPx;
    if (state.isSolid(cx, cy)) continue;
    if (clearLine(state, cx, cy, p.x, p.y)) continue; // von dort noch sichtbar
    const d = (cx - tank.x) ** 2 + (cy - tank.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

// Deckungsfahrt (Phase 16): ersetzt die normale Rollen-Fahrfunktion fuer
// EINEN Tick, wenn ai.js (updateCoverPerception) den Panzer als "im Ziel
// des Spielers" erkannt hat. Gibt null zurueck, wenn kein Deckungspunkt
// gefunden wurde -- der Aufrufer (ai.js: updateEnemy) ruft dann die normale
// DRIVES[role]-Funktion auf, damit der Panzer nie einfach stehen bleibt.
export function coverDrive(tank, state, dt) {
  const cfg = state.data.ai.cover;
  const cover = findCoverPoint(tank, state, cfg);
  if (!cover) return null;
  const target = Math.atan2(cover.y - tank.y, cover.x - tank.x);
  return steer(tank, state, dt, target, driveCfg(state, tank, {}));
}

export const DRIVES = {
  guardian: guardianDrive,
  sapper: sapperDrive,
  hunter: hunterDrive,
  sieger: siegerDrive,
};
