// Gegner-KI, Dispatcher + gemeinsame Helfer (Spec Abschnitt 5).
//
// Phase 8: Gegner-Rollen statt Gegner-Typen. Eine ROLLE (guardian/sapper/
// hunter/sieger, siehe ai_drives.js) bestimmt das Fahrverhalten,
// ai_turrets.js liefert dazu eine einzige, accuracy-parametrisierte
// Turmfunktion -- beides datengetrieben ueber tank.cfg (aus
// data/tanks.json), keine eigene Funktion mehr pro Gegnertyp. Panzerung
// (armor.js) und Minenlegen (miner-Eintrag) bleiben orthogonal dazu.
//
// Aller Zufall laeuft ueber den Seed-RNG (state.rng).

import { range } from '../core/rng.js';
import { roleTurret } from './ai_turrets.js';
import { DRIVES } from './ai_drives.js';

export function angleDiff(a, b) {
  // Kleinste Differenz b - a, gewrappt auf [-PI, PI].
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

// Ray-March: ist die Strecke (x0,y0)->(x1,y1) frei von Waenden?
export function clearLine(state, x0, y0, x1, y1) {
  const step = state.data.ai.raycastStepPx;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  if (dist < 1) return true;
  const dx = ((x1 - x0) / dist) * step;
  const dy = ((y1 - y0) / dist) * step;
  let x = x0;
  let y = y0;
  for (let d = 0; d < dist; d += step) {
    if (state.blocksSight(x, y)) return false;
    x += dx;
    y += dy;
  }
  return true;
}

// Ray-March vom Rohrende entlang der Turmrichtung: trifft der Strahl
// den Spieler, bevor er in einer Wand endet?
export function playerInSight(tank, state) {
  const p = state.player;
  if (!p.alive) return false;
  const { raycastStepPx, raycastMaxPx } = state.data.ai;
  const cos = Math.cos(tank.turret);
  const sin = Math.sin(tank.turret);
  const hitR = p.cfg.radius + tank.cfg.bulletRadius;
  let x = tank.x + cos * (tank.cfg.radius + 8);
  let y = tank.y + sin * (tank.cfg.radius + 8);
  for (let d = 0; d < raycastMaxPx; d += raycastStepPx) {
    if (state.blocksSight(x, y)) return false;
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < hitR * hitR) return true;
    x += cos * raycastStepPx;
    y += sin * raycastStepPx;
  }
  return false;
}

// Liegt innerhalb von clearPx vor der Muendung eine Wand? (Verhindert
// staendige Punktblank-Selbsttreffer beim Schiessen direkt an der Wand.)
export function muzzleBlocked(tank, state, clearPx) {
  const step = state.data.ai.raycastStepPx;
  const cos = Math.cos(tank.turret);
  const sin = Math.sin(tank.turret);
  let x = tank.x + cos * (tank.cfg.radius + 8);
  let y = tank.y + sin * (tank.cfg.radius + 8);
  for (let d = 0; d < clearPx; d += step) {
    if (state.isSolid(x, y)) return true;
    x += cos * step;
    y += sin * step;
  }
  return false;
}

// Abstossung von liegenden Minen (t_yellow laut Spec; alle Minenleger
// zusaetzlich, damit sie nicht regelmaessig in die eigenen Minen fahren).
function mineRepulsion(tank, state) {
  const R = state.data.ai.mineAvoidRadiusPx;
  let rx = 0;
  let ry = 0;
  let any = false;
  for (const m of state.mines) {
    if (m.dead) continue;
    // Gegner meiden nur ihre EIGENEN Minen (t_yellow-Selbstsperre bleibt).
    // Spieler-Minen werden NICHT gemieden -> sie treffen zuverlaessig.
    if (m.owner !== tank) continue;
    const dx = tank.x - m.x;
    const dy = tank.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d >= R || d < 0.001) continue;
    const w = 1 - d / R;
    rx += (dx / d) * w;
    ry += (dy / d) * w;
    any = true;
  }
  return any ? { x: rx, y: ry } : null;
}

// Gemeinsame Fahr-Basis: weich auf targetAngle zulenken; bei Blockade
// (kaum Fortschritt trotz Fahrbefehl) fuer escapeHoldS von der Wand
// wegpivotieren. Fahrende Panzer bleiben dadurch NIE stehen.
export function steer(tank, state, dt, targetAngle, cfg) {
  const ai = tank.ai;

  // Minen-Ausweichen ueberlagert das Wunschziel aller Fahrverhalten.
  // Stark gewichtet: nahe einer Mine dominiert die Flucht das Ziel.
  if (tank.cfg.avoidMines) {
    const rep = mineRepulsion(tank, state);
    if (rep) {
      targetAngle = Math.atan2(
        Math.sin(targetAngle) + rep.y * 2.5,
        Math.cos(targetAngle) + rep.x * 2.5,
      );
    }
  }
  if (ai.driveAngle === undefined) {
    ai.driveAngle = targetAngle;
    ai.blockedTime = 0;
    ai.overrideTimer = 0;
    ai.overrideAngle = 0;
  }
  const moved = Math.hypot(tank.x - tank.prevX, tank.y - tank.prevY);
  const expected = tank.cfg.speed * dt;
  if (expected > 0 && moved < expected * 0.3) {
    ai.blockedTime += dt;
  } else {
    ai.blockedTime = 0;
  }
  if (ai.blockedTime >= cfg.blockedRetargetS) {
    ai.overrideAngle =
      ai.driveAngle + Math.PI + range(state.rng, -cfg.escapeSpreadRad, cfg.escapeSpreadRad);
    ai.overrideTimer = cfg.escapeHoldS;
    ai.driveAngle = ai.overrideAngle; // Pivot auf der Stelle
    ai.blockedTime = 0;
  }
  if (ai.overrideTimer > 0) {
    ai.overrideTimer -= dt;
    targetAngle = ai.overrideAngle;
  }
  ai.driveAngle = turnToward(ai.driveAngle, targetAngle, cfg.turnSpeed * dt);
  return { x: Math.cos(ai.driveAngle), y: Math.sin(ai.driveAngle) };
}

// Phasenwechsel (t_white): alterniert periodisch zwischen zwei Rollen
// (Muster wie das fruehere white_phase-Fahrverhalten, inkl. Ton-Signal
// beim Wechsel). Gibt die gerade aktive Rolle zurueck.
function activeRole(tank, state, dt) {
  const pt = tank.cfg.phaseToggle;
  if (!pt) return tank.cfg.role;
  const ai = tank.ai;
  if (ai.phaseIdx === undefined) {
    ai.phaseIdx = 0;
    ai.phaseTimer = range(state.rng, pt.switchMinS, pt.switchMaxS);
  }
  ai.phaseTimer -= dt;
  if (ai.phaseTimer <= 0) {
    ai.phaseIdx = 1 - ai.phaseIdx;
    ai.phaseTimer = range(state.rng, pt.switchMinS, pt.switchMaxS);
    state.sounds.push(ai.phaseIdx === 1 ? 'tone_high' : 'tone_low');
  }
  return pt.roles[ai.phaseIdx];
}

// Ein KI-Schritt fuer einen Gegner. Gibt { move, fire, mine } zurueck;
// die Anwendung (Bewegung, Schuss, Minenlegen) macht state.js.
export function updateEnemy(tank, state, dt) {
  const role = activeRole(tank, state, dt);
  const move = DRIVES[role](tank, state, dt);
  // EMP-Mine (Phase 6): betaeubte Gegner drehen den Turm nicht und feuern
  // nicht -- eigenes Feld turretStunTimer, damit die bestehende Krallenfalle
  // (stunTimer allein) den Turm weiter benutzbar laesst (siehe PLAN.md).
  const fire = tank.turretStunTimer > 0 ? false : roleTurret(tank, state, dt);

  // Dritte Achse: Minenleger (t_yellow "ohne taktischen Grund" per
  // Zufallstimer -- das beabsichtigte Sich-selbst-Einsperren entsteht
  // von allein; t_purple/t_white/t_black seltener).
  let mine = false;
  if (tank.cfg.miner) {
    const ai = tank.ai;
    if (ai.mineTimer === undefined) {
      ai.mineTimer = range(state.rng, tank.cfg.miner.intervalMinS, tank.cfg.miner.intervalMaxS);
    }
    ai.mineTimer -= dt;
    if (ai.mineTimer <= 0) {
      // Nur bei freier Fahrt legen: ein blockierter Panzer wuerde die
      // Mine unter sich scharf werden lassen und sich selbst sprengen.
      const actualSpeed = Math.hypot(tank.vx, tank.vy);
      if (actualSpeed >= tank.cfg.speed * 0.5) {
        mine = true;
        ai.mineTimer = range(state.rng, tank.cfg.miner.intervalMinS, tank.cfg.miner.intervalMaxS);
      }
      // sonst: Timer bleibt abgelaufen, naechste freie Fahrt legt sofort
    }
  }
  return { move, fire, mine };
}
