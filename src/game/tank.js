// Panzer-Entity (Spec Abschnitt 5).
//
// Phase 3: generische Panzer fuer Spieler UND Gegner. Alle Werte kommen
// aus data/tanks.json (als aufgeloestes cfg-Objekt). Bewegung mit
// Sliding an Waenden; Panzer blockieren sich gegenseitig (kein Schieben:
// nur der sich bewegende Panzer wird herausgeschoben, der andere bleibt).

import { resolveCircleWalls } from './collision.js';
import { createBullet } from './bullet.js';
import { createMine } from './mine.js';

let nextTankId = 1;

// cfg = { radius, speed, magazine, ricochets, bulletSpeed, bulletRadius,
//         fireCooldown, turret?, drive? } -- aufgeloest in state.js.
export function createTank(type, cfg, x, y) {
  return {
    id: nextTankId++,
    type,
    cfg,
    x,
    y,
    prevX: x,
    prevY: y,
    heading: -Math.PI / 2, // Rumpf (Fahrtrichtung)
    turret: -Math.PI / 2, // Turm, unabhaengig vom Rumpf
    vx: 0, // tatsaechliche Geschwindigkeit (px/s, nach Kollisionen)
    vy: 0, // -- gebraucht vom Vorhaltezielen (t_black)
    cooldown: 0,
    protect: 0, // > 0: Spawn-Schutz (unverwundbar, blinkt)
    stunTimer: 0, // > 0: Krallenfalle -- kann nicht fahren
    shots: 0, // Schusszaehler (Sprengschuss-Upgrade)
    trapDist: 0, // gefahrene Strecke seit letzter Falle
    boostTimer: 0, // Nachbrenner-Restzeit
    bloodTimer: 0, // Blutrausch-Restzeit (Tempo + Unverwundbarkeit)
    dashCd: 0, // Dash-Cooldown
    berserkerFire: 1, // dynamischer Feuerraten-Multiplikator (Berserker)
    berserkerSpeed: 1, // dynamischer Tempo-Multiplikator (Berserker)
    magazineBonus: 0, // dynamischer Magazin-Bonus (Uebermacht)
    shieldReady: (cfg && (cfg.shield || cfg.counterShield)) || false, // Schild geladen?
    alive: true,
    ai: {}, // Zustandsspeicher der KI-Verhalten (leer beim Spieler)
  };
}

// Schiebt tank aus allen anderen lebenden Panzern heraus. Nur der Mover
// wird verschoben -- so kann kein Panzer einen anderen wegschieben.
function resolveTankBlocking(tank, tanks) {
  for (const other of tanks) {
    if (other === tank || !other.alive) continue;
    const dx = tank.x - other.x;
    const dy = tank.y - other.y;
    const rsum = tank.cfg.radius + other.cfg.radius;
    const distSq = dx * dx + dy * dy;
    if (distSq >= rsum * rsum) continue;
    if (distSq > 1e-9) {
      const dist = Math.sqrt(distSq);
      const overlap = rsum - dist;
      tank.x += (dx / dist) * overlap;
      tank.y += (dy / dist) * overlap;
    } else {
      tank.x += rsum; // deckungsgleich: deterministisch nach rechts
    }
  }
}

// Ein Bewegungsschritt. axis = roher Richtungsvektor {x, y}.
export function moveTank(tank, axis, state, dt) {
  tank.prevX = tank.x;
  tank.prevY = tank.y;

  // Krallenfalle: gefangene Panzer koennen nicht fahren (Turm geht).
  let dx = tank.stunTimer > 0 ? 0 : axis.x;
  let dy = tank.stunTimer > 0 ? 0 : axis.y;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    // Normalisieren, damit Diagonale nicht schneller ist.
    dx /= len;
    dy /= len;
    // Effektives Tempo: Basis * Berserker * Nachbrenner * Blutrausch.
    const boost = tank.boostTimer > 0 ? tank.cfg.afterburnerMult || 1 : 1;
    const blood = tank.bloodTimer > 0 ? tank.cfg.bloodlustSpeed || 1 : 1;
    const spd = tank.cfg.speed * (tank.berserkerSpeed || 1) * boost * blood;
    tank.x += dx * spd * dt;
    tank.y += dy * spd * dt;
    tank.heading = Math.atan2(dy, dx);
  }

  // Erst Waende, dann andere Panzer, dann nochmal Waende -- das
  // Herausschieben aus einem Panzer darf nicht in einer Wand enden.
  resolveCircleWalls(tank, tank.cfg.radius, state.walls);
  resolveTankBlocking(tank, state.tanks);
  resolveCircleWalls(tank, tank.cfg.radius, state.walls);

  // Tatsaechliche Geschwindigkeit nach allen Kollisionen.
  tank.vx = (tank.x - tank.prevX) / dt;
  tank.vy = (tank.y - tank.prevY) / dt;
}

function liveBulletsOf(state, owner) {
  let n = 0;
  for (const b of state.bullets) {
    if (!b.dead && b.owner === owner) n++;
  }
  return n;
}

// Effektives Magazin: Basis + dynamischer Bonus (Uebermacht), gedeckelt
// durch den harten Aktiv-Kugel-Cap (balance.bullet.maxActiveCap, nur
// Spieler -- Gegner haben cfg.magazineCap = Infinity).
function magazineOf(tank) {
  const base = tank.cfg.magazine + (tank.magazineBonus || 0);
  return Math.min(base, tank.cfg.magazineCap ?? Infinity);
}

// Schussversuch: respektiert Cooldown und Magazin-Limit.
// Doppelrohr-Upgrade: zwei Kugeln im Spreizwinkel (jede zaehlt gegen
// das Magazin). Sprengschuss-Upgrade: jeder N-te Abzug traegt eine
// Sprengladung. Gibt true zurueck, wenn tatsaechlich gefeuert wurde.
export function fireBullet(tank, state) {
  // Epsilon: der Cooldown ist als Summe von 1/60-Schritten nicht exakt
  // darstellbar; ohne Toleranz feuert man einen Tick zu spaet.
  if (tank.cooldown > 1e-9) return false;
  const mag = magazineOf(tank);
  if (liveBulletsOf(state, tank) >= mag) return false;

  tank.shots++;
  // Sprengschuss: jeder N-te Schuss ist eine ABPRALLENDE Sprengkugel.
  const explosiveShot =
    !tank.cfg.allExplosive &&
    tank.cfg.explosionEveryShots > 0 &&
    tank.shots % tank.cfg.explosionEveryShots === 0;

  // Schusswinkel: Streuschuss-Faecher > Doppelrohr > Einzelschuss.
  let angles;
  if (tank.cfg.spreadCount > 1) {
    angles = [];
    const n = tank.cfg.spreadCount;
    for (let i = 0; i < n; i++) {
      angles.push(tank.turret + (i - (n - 1) / 2) * tank.cfg.spreadRad);
    }
  } else if (tank.cfg.twinShot) {
    angles = [tank.turret - tank.cfg.twinSpreadRad, tank.turret + tank.cfg.twinSpreadRad];
  } else {
    angles = [tank.turret];
  }

  const muzzle = tank.cfg.radius + 8; // Spitze des Rohrs
  let fired = false;
  for (let i = 0; i < angles.length; i++) {
    if (liveBulletsOf(state, tank) >= mag) break;
    const a = angles[i];
    const mx = tank.x + Math.cos(a) * muzzle;
    const my = tank.y + Math.sin(a) * muzzle;
    // Sprengschuss prallt ab (mind. 1 Abpraller); Sprengmunition/
    // Glaskanone zuenden hart an der Wand (detonateOnWall).
    const isExplosive = explosiveShot || tank.cfg.allExplosive;
    state.bullets.push(
      createBullet(mx, my, a, {
        speed: tank.cfg.bulletSpeed,
        radius: tank.cfg.bulletRadius,
        ricochets: explosiveShot ? Math.max(1, tank.cfg.ricochets) : tank.cfg.ricochets,
        owner: tank,
        kind: tank.cfg.weapon,
        tungsten: tank.cfg.tungsten || false,
        explosive: isExplosive,
        detonateOnWall: isExplosive && !explosiveShot,
        explosionRadius: tank.cfg.shotExplosionRadius,
        phaseWalls: tank.cfg.phaseWalls || false,
        homing: tank.cfg.homing || 0,
      }),
    );
    // Muendungsblitz -- bei t_white der einzige immer sichtbare Kanal.
    state.flashes.push({ x: mx, y: my, age: 0 });
    fired = true;
  }
  if (!fired) {
    tank.shots--;
    return false;
  }
  if (tank === state.player) state.playerShots++;
  if (tank.cfg.afterburnerMult) tank.boostTimer = tank.cfg.afterburnerS; // Nachbrenner
  // Raketenantrieb: Rueckstoss entgegen der Schussrichtung.
  if (tank.cfg.recoilPx) {
    tank.x -= Math.cos(tank.turret) * tank.cfg.recoilPx;
    tank.y -= Math.sin(tank.turret) * tank.cfg.recoilPx;
    resolveCircleWalls(tank, tank.cfg.radius, state.walls);
  }
  state.sounds.push('shoot');
  tank.cooldown = tank.cfg.fireCooldown * (tank.berserkerFire || 1);
  return true;
}

// Ausweich-Dash: kurzer Sprung in Fahrt- bzw. Blickrichtung mit
// Unverwundbarkeit (Upgrade). Gibt true zurueck, wenn ausgefuehrt.
export function dashTank(tank, state, moveAxis) {
  if (!tank.cfg.dash || tank.dashCd > 0 || !tank.alive) return false;
  let a;
  const len = Math.hypot(moveAxis.x, moveAxis.y);
  if (len > 0) a = Math.atan2(moveAxis.y, moveAxis.x); // in Fahrtrichtung
  else a = tank.turret; // sonst in Zielrichtung
  tank.x += Math.cos(a) * tank.cfg.dash.dist;
  tank.y += Math.sin(a) * tank.cfg.dash.dist;
  resolveCircleWalls(tank, tank.cfg.radius, state.walls);
  resolveTankBlocking(tank, state.tanks);
  resolveCircleWalls(tank, tank.cfg.radius, state.walls);
  tank.protect = Math.max(tank.protect, tank.cfg.dash.iframe);
  tank.dashCd = tank.cfg.dash.cooldown;
  state.sounds.push('dash');
  state.spawnParticles?.(tank.x, tank.y, '#8ecaf0', 8, 90);
  return true;
}

// Legt eine Mine am Ort des Panzers, begrenzt durch das Minen-Limit
// (gleichzeitig liegende eigene Minen, aus tanks.json).
export function layMine(tank, state, throwOverride) {
  const own = state.mines.filter((m) => !m.dead && m.owner === tank);
  // Fernzuender: sind alle Minen draussen, sprengt die Taste sie alle.
  if (tank.cfg.remoteDetonate && own.length >= tank.cfg.mines && own.length > 0) {
    for (const m of own) if (m.fuse === null) m.fuse = 0.001;
    return true;
  }
  if (own.length >= tank.cfg.mines) return false;

  // Wurf: Richtung + Weite. Touch-Wurfstick (throwOverride) hat Vorrang,
  // sonst wirft der Spieler in Blickrichtung bis throwPx weit. An einer
  // Wand faellt die Bombe davor zu Boden.
  let angle = tank.turret;
  let maxDist = 0;
  if (throwOverride) {
    angle = throwOverride.angle;
    maxDist = throwOverride.dist;
  } else if (tank.type === 'player') {
    maxDist = state.data.mine.throwPx || 0;
  }
  let lx = tank.x;
  let ly = tank.y;
  if (maxDist > 0) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let d = 6; d <= maxDist; d += 6) {
      const nx = tank.x + cos * d;
      const ny = tank.y + sin * d;
      if (state.isSolid(nx, ny)) break;
      lx = nx;
      ly = ny;
    }
  }
  state.mines.push(createMine(lx, ly, tank, state.data.mine.radiusPx));
  state.sounds.push('mine');
  // Schockwelle: nahe Gegner um die gelegte Mine wegstossen.
  if (tank.cfg.shockwaveRadius) {
    const R = tank.cfg.shockwaveRadius;
    for (const t of state.tanks) {
      if (t === tank || !t.alive) continue;
      const dx = t.x - lx;
      const dy = t.y - ly;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < R) {
        const push = tank.cfg.shockwavePush * (1 - d / R);
        t.x += (dx / d) * push;
        t.y += (dy / d) * push;
        resolveCircleWalls(t, t.cfg.radius, state.walls);
        if (tank.cfg.shockwaveStun) t.stunTimer = Math.max(t.stunTimer, tank.cfg.shockwaveStun);
      }
    }
  }
  return true;
}
