// Gegner-KI (Spec Abschnitt 5).
//
// Zwei GETRENNTE Achsen -- Turmverhalten und Fahrverhalten. Diese
// Trennung ist laut Spec zentral und darf nicht zusammengelegt werden:
// jeder Gegnertyp kombiniert unabhaengig ein TURRET- und ein
// DRIVE-Verhalten (per Name aus data/tanks.json).
//
// Phase 3: random_seek (t_brown), weak_aim (t_grey), wander (t_grey).
// Alle Stellwerte kommen aus tanks.json (state.data.ai), aller Zufall
// aus dem Seed-RNG (state.rng).

import { range } from '../core/rng.js';

function angleDiff(a, b) {
  // Kleinste Differenz b - a, gewrappt auf [-PI, PI].
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

// Ray-March vom Rohrende entlang der Turmrichtung: trifft der Strahl
// den Spieler, bevor er in einer Wand endet?
function playerInSight(tank, state) {
  const p = state.player;
  if (!p.alive) return false;
  const { raycastStepPx, raycastMaxPx } = state.data.ai;
  const cos = Math.cos(tank.turret);
  const sin = Math.sin(tank.turret);
  const hitR = p.cfg.radius + tank.cfg.bulletRadius;
  let x = tank.x + cos * (tank.cfg.radius + 8);
  let y = tank.y + sin * (tank.cfg.radius + 8);
  for (let d = 0; d < raycastMaxPx; d += raycastStepPx) {
    if (state.isSolid(x, y)) return false;
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
function muzzleBlocked(tank, state, clearPx) {
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

// ---------------------------------------------------------------- Turm

const TURRETS = {
  // t_brown: Turm schwenkt zufaellig suchend; gefeuert wird nur, wenn
  // der Lauf dabei zufaellig freie Sicht auf den Spieler hat.
  random_seek(tank, state, dt) {
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
  },

  // t_grey: zielt schwach -- auf die aktuelle Spielerposition plus
  // einen periodisch neu gewuerfelten Fehlerwinkel. Feuert, sobald der
  // Turm grob ausgerichtet ist und die Muendung frei ist.
  weak_aim(tank, state, dt) {
    const cfg = state.data.ai.turret.weak_aim;
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
    return (
      Math.abs(angleDiff(tank.turret, target)) < cfg.fireConeRad &&
      !muzzleBlocked(tank, state, cfg.muzzleClearPx)
    );
  },
};

// ---------------------------------------------------------- Fahrwerk

const DRIVES = {
  // Fixe Panzer (t_brown): bewegen sich nicht.
  none() {
    return { x: 0, y: 0 };
  },

  // t_grey: ziellos. Faehrt immer (Spec: fahrende Panzer bleiben NIE
  // stehen), lenkt weich auf einen Zielwinkel zu, der periodisch oder
  // bei Blockade neu gewuerfelt wird.
  wander(tank, state, dt) {
    const cfg = state.data.ai.drive.wander;
    const ai = tank.ai;
    if (ai.driveAngle === undefined) {
      ai.driveAngle = range(state.rng, -Math.PI, Math.PI);
      ai.driveTarget = ai.driveAngle;
      ai.driveTimer = 0;
      ai.blockedTime = 0;
    }
    // Blockade: kaum vorangekommen trotz Fahrbefehl. Nach kurzer Zeit
    // sofort von der Wand wegschwenken (Pivot) -- ein zufaelliger neuer
    // Zielwinkel koennte wieder in die Wand zeigen, und fahrende Panzer
    // duerfen nie stehen bleiben.
    const moved = Math.hypot(tank.x - tank.prevX, tank.y - tank.prevY);
    const expected = tank.cfg.speed * dt;
    if (expected > 0 && moved < expected * 0.3) {
      ai.blockedTime += dt;
    } else {
      ai.blockedTime = 0;
    }
    if (ai.blockedTime >= cfg.blockedRetargetS) {
      const escape =
        ai.driveAngle + Math.PI + range(state.rng, -cfg.escapeSpreadRad, cfg.escapeSpreadRad);
      ai.driveTarget = escape;
      ai.driveAngle = escape; // Pivot auf der Stelle, dann sofort weiterfahren
      ai.driveTimer = range(state.rng, cfg.retargetMinS, cfg.retargetMaxS);
      ai.blockedTime = 0;
    }
    ai.driveTimer -= dt;
    if (ai.driveTimer <= 0) {
      ai.driveTarget = range(state.rng, -Math.PI, Math.PI);
      ai.driveTimer = range(state.rng, cfg.retargetMinS, cfg.retargetMaxS);
    }
    ai.driveAngle = turnToward(ai.driveAngle, ai.driveTarget, cfg.turnSpeed * dt);
    return { x: Math.cos(ai.driveAngle), y: Math.sin(ai.driveAngle) };
  },
};

// Ein KI-Schritt fuer einen Gegner. Gibt { move, fire } zurueck; die
// Anwendung (Bewegung, Schuss) macht state.js.
export function updateEnemy(tank, state, dt) {
  const move = DRIVES[tank.cfg.drive](tank, state, dt);
  const fire = TURRETS[tank.cfg.turret](tank, state, dt);
  return { move, fire };
}
