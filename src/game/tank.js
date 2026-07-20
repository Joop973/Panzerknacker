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
    stunTimer: 0, // > 0: Krallenfalle -- kann nicht fahren
    shots: 0, // Schusszaehler (Sprengschuss-Upgrade)
    trapDist: 0, // gefahrene Strecke seit letzter Falle
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
    tank.x += dx * tank.cfg.speed * dt;
    tank.y += dy * tank.cfg.speed * dt;
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

// Schussversuch: respektiert Cooldown und Magazin-Limit.
// Doppelrohr-Upgrade: zwei Kugeln im Spreizwinkel (jede zaehlt gegen
// das Magazin). Sprengschuss-Upgrade: jeder N-te Abzug traegt eine
// Sprengladung. Gibt true zurueck, wenn tatsaechlich gefeuert wurde.
export function fireBullet(tank, state) {
  // Epsilon: der Cooldown ist als Summe von 1/60-Schritten nicht exakt
  // darstellbar; ohne Toleranz feuert man einen Tick zu spaet.
  if (tank.cooldown > 1e-9) return false;
  if (liveBulletsOf(state, tank) >= tank.cfg.magazine) return false;

  tank.shots++;
  const explosive =
    tank.cfg.explosionEveryShots > 0 && tank.shots % tank.cfg.explosionEveryShots === 0;
  const angles = tank.cfg.twinShot
    ? [tank.turret - tank.cfg.twinSpreadRad, tank.turret + tank.cfg.twinSpreadRad]
    : [tank.turret];

  const muzzle = tank.cfg.radius + 8; // Spitze des Rohrs
  let fired = false;
  for (let i = 0; i < angles.length; i++) {
    if (liveBulletsOf(state, tank) >= tank.cfg.magazine) break;
    const a = angles[i];
    const mx = tank.x + Math.cos(a) * muzzle;
    const my = tank.y + Math.sin(a) * muzzle;
    state.bullets.push(
      createBullet(mx, my, a, {
        speed: tank.cfg.bulletSpeed,
        radius: tank.cfg.bulletRadius,
        ricochets: tank.cfg.ricochets,
        owner: tank,
        kind: tank.cfg.weapon,
        tungsten: tank.cfg.tungsten || false,
        explosive: explosive && i === 0, // nur die erste Kugel des Abzugs
        explosionRadius: tank.cfg.shotExplosionRadius,
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
  state.sounds.push('shoot');
  tank.cooldown = tank.cfg.fireCooldown;
  return true;
}

// Legt eine Mine am Ort des Panzers, begrenzt durch das Minen-Limit
// (gleichzeitig liegende eigene Minen, aus tanks.json).
export function layMine(tank, state) {
  let own = 0;
  for (const m of state.mines) {
    if (!m.dead && m.owner === tank) own++;
  }
  if (own >= tank.cfg.mines) return false;
  state.mines.push(createMine(tank.x, tank.y, tank, state.data.mine.radiusPx));
  state.sounds.push('mine');
  return true;
}
