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
    iceVx: 0, // Raum-Modifikator "Glatteis" (Phase 10): nachgleitende Geschwindigkeit
    iceVy: 0,
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
    // Powershot-Ladungen (Phase 5): frisch pro Raum, weil createTank() bei
    // jedem neuen Raum (und Respawn) ohnehin neu aufgerufen wird -- kein
    // eigener "Raum betreten"-Hook noetig.
    powershotCharges: (cfg && cfg.powershotPerRoom) || 0,
    // Sekundärslot (Phase 6): frisch pro Raum, aus demselben Grund.
    secondaryMineCount: 0, // fuer "jede 4. Mine ist EMP" (emp_mine)
    secondaryCooldown: 0, // Abklingzeit fuer hook/deflector/smoke/trap_wall
    hookTimer: 0, // > 0: wird gerade zur Wand gezogen (Enterhaken)
    hookTarget: null,
    deflectorTimer: 0, // Restzeit des aktiven Deflektor-Fensters
    deflectorCharges: 0, // > 0: naechster Treffer wird reflektiert
    turretStunTimer: 0, // > 0: EMP-Mine -- Turm dreht sich nicht (stunTimer bleibt fuer Bewegung)
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

  // Sekundärslot "Enterhaken" (Phase 6): waehrend des Zugs ignoriert die
  // Bewegung jede Eingabe komplett und naehert sich stattdessen dem
  // Zielpunkt an der getroffenen Wand.
  if (tank.hookTimer > 0) {
    const scfg = state.data.secondaries?.hook || {};
    const speed = scfg.pullSpeedPx ?? 520;
    const tx = tank.hookTarget.x - tank.x;
    const ty = tank.hookTarget.y - tank.y;
    const dist = Math.hypot(tx, ty);
    const step = speed * dt;
    if (dist <= step || dist < 1) {
      tank.x = tank.hookTarget.x;
      tank.y = tank.hookTarget.y;
      tank.hookTimer = 0;
    } else {
      tank.x += (tx / dist) * step;
      tank.y += (ty / dist) * step;
      tank.heading = Math.atan2(ty, tx);
    }
    resolveCircleWalls(tank, tank.cfg.radius, state.walls);
    resolveTankBlocking(tank, state.tanks);
    resolveCircleWalls(tank, tank.cfg.radius, state.walls);
    tank.vx = (tank.x - tank.prevX) / dt;
    tank.vy = (tank.y - tank.prevY) / dt;
    return;
  }

  // Krallenfalle: gefangene Panzer koennen nicht fahren (Turm geht).
  let dx = tank.stunTimer > 0 ? 0 : axis.x;
  let dy = tank.stunTimer > 0 ? 0 : axis.y;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    // Normalisieren, damit Diagonale nicht schneller ist.
    dx /= len;
    dy /= len;
  }
  // Effektives Tempo: Basis * Berserker * Nachbrenner * Blutrausch.
  const boost = tank.boostTimer > 0 ? tank.cfg.afterburnerMult || 1 : 1;
  const blood = tank.bloodTimer > 0 ? tank.cfg.bloodlustSpeed || 1 : 1;
  const spd = tank.cfg.speed * (tank.berserkerSpeed || 1) * boost * blood;
  const mod = state.modifier;
  if (mod?.slippery) {
    // Glatteis (Phase 10): die tatsaechliche Geschwindigkeit naehert sich der
    // Eingabe nur allmaehlich an (Grip statt Sofort-Stopp/-Start) -- betrifft
    // ALLE Panzer gleich, gilt daher generisch in moveTank() statt in einem
    // der vier KI-Verhalten.
    const grip = mod.gripPerSec ?? 3;
    const t = Math.min(1, grip * dt);
    tank.iceVx += (dx * spd - tank.iceVx) * t;
    tank.iceVy += (dy * spd - tank.iceVy) * t;
    tank.x += tank.iceVx * dt;
    tank.y += tank.iceVy * dt;
    if (len > 0) tank.heading = Math.atan2(dy, dx);
  } else if (len > 0) {
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

  // Powershot (Phase 5): solange Ladungen da sind, ist JEDER Abzug ein
  // Powershot (nicht nur der allererste) -- ein Abzug verbraucht genau
  // eine Ladung, unabhaengig davon, wie viele Kugeln er erzeugt (Doppelrohr
  // o. ae. bekommen den Bonus dann auf beide Kugeln).
  const boosted = tank.powershotCharges > 0;

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
    const baseRicochets = explosiveShot ? Math.max(1, tank.cfg.ricochets) : tank.cfg.ricochets;
    state.bullets.push(
      createBullet(mx, my, a, {
        speed: boosted ? tank.cfg.bulletSpeed * tank.cfg.powershotSpeedFactor : tank.cfg.bulletSpeed,
        radius: tank.cfg.bulletRadius,
        ricochets: boosted ? baseRicochets + tank.cfg.powershotBonusRicochets : baseRicochets,
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
  if (boosted) {
    tank.powershotCharges--;
    if (tank === state.player) state.powershotsFired++;
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
  // Sekundärslot "EMP-Mine" (Phase 6): teilt sich die Legemechanik mit
  // der normalen Mine -- jede vierte gelegte Mine ist EMP (kein Schaden,
  // betaeubt stattdessen). Gegner setzen cfg.secondary nie -> immer false.
  let isEmp = false;
  if (tank.cfg.secondary === 'emp_mine') {
    tank.secondaryMineCount = (tank.secondaryMineCount || 0) + 1;
    const everyNth = state.data.secondaries?.emp_mine?.everyNth ?? 4;
    isEmp = tank.secondaryMineCount % everyNth === 0;
  }
  state.mines.push(createMine(lx, ly, tank, state.data.mine.radiusPx, isEmp));
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

// Sekundärslot (Phase 6): generischer Dispatch fuer die aktive
// Sekundärwaffe des Spielers. mine/emp_mine laufen weiter ueber layMine()
// (teilen sich Zuend-/Wurfmechanik); die vier neuen teilen sich stattdessen
// eine Abklingzeit (tank.secondaryCooldown), da sie Aktionen statt Vorraete
// sind. Gibt true zurueck, wenn tatsaechlich etwas ausgeloest wurde.
export function useSecondary(tank, state, throwOverride) {
  // Raum-Modifikator "Ausruestungssperre" (Phase 10): Sekundärwaffe fuer
  // diesen Raum komplett gesperrt (nicht ueber cfg.secondary=null geloest,
  // weil `sec = tank.cfg.secondary || 'mine'` sonst wieder auf Mine faellt).
  if (tank.cfg.secondaryDisabled) return false;
  const sec = tank.cfg.secondary || 'mine';
  if (sec === 'mine' || sec === 'emp_mine') return layMine(tank, state, throwOverride);
  if (tank.secondaryCooldown > 0) return false;
  const scfg = state.data.secondaries?.[sec] || {};
  let used = false;
  if (sec === 'hook') {
    used = fireHook(tank, state, scfg);
  } else if (sec === 'deflector') {
    tank.deflectorTimer = scfg.activeS ?? 1.5;
    tank.deflectorCharges = 1;
    state.sounds.push('shield');
    used = true;
  } else if (sec === 'smoke') {
    state.smokeClouds.push({
      x: tank.x,
      y: tank.y,
      radius: scfg.radiusPx ?? 90,
      age: 0,
      life: scfg.durationS ?? 4,
    });
    state.sounds.push('mine');
    state.spawnParticles?.(tank.x, tank.y, '#9aa0a8', 12, 70);
    used = true;
  } else if (sec === 'trap_wall') {
    used = placeTrapWall(tank, state, scfg);
  }
  if (used) tank.secondaryCooldown = scfg.cooldownS ?? 4;
  return used;
}

// Enterhaken: Raymarch in Blickrichtung bis maxRangePx. Trifft er eine
// Wand, wird der Panzer ueber mehrere Ticks dorthin gezogen (moveTank()
// uebernimmt den eigentlichen Zug via tank.hookTimer/hookTarget).
function fireHook(tank, state, scfg) {
  const step = state.data.ai.raycastStepPx;
  const maxRange = scfg.maxRangePx ?? 260;
  const cos = Math.cos(tank.turret);
  const sin = Math.sin(tank.turret);
  let x = tank.x;
  let y = tank.y;
  for (let d = 0; d < maxRange; d += step) {
    const nx = x + cos * step;
    const ny = y + sin * step;
    if (state.isSolid(nx, ny)) {
      tank.hookTarget = { x: nx - cos * tank.cfg.radius, y: ny - sin * tank.cfg.radius };
      tank.hookTimer = 1;
      state.sounds.push('dash');
      return true;
    }
    x = nx;
    y = ny;
  }
  return false; // keine Wand in Reichweite -> kein Cooldown verbraucht
}

// Sperrmauer: entsteht auf der Kachel vor dem Panzer, wenn diese begehbar
// und panzerfrei ist (Details/Haltbarkeit in state.placeTrapWall()).
function placeTrapWall(tank, state, scfg) {
  const dist = scfg.placeDistPx ?? 48;
  const x = tank.x + Math.cos(tank.turret) * dist;
  const y = tank.y + Math.sin(tank.turret) * dist;
  return state.placeTrapWall(x, y, scfg.hits ?? 3);
}
