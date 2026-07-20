// Geschosse + Abpraller-Physik (Spec Abschnitt 4: Geschosse).
//
// Bewegung geradlinig mit konstanter Geschwindigkeit. Wandkontakt:
// Reflexion an der Normalen der getroffenen Flaeche. Die Bewegung wird
// pro Achse aufgeloest -- trifft ein Geschoss im selben Schritt auf
// beiden Achsen (Eckenfall), wird auf beiden Achsen reflektiert und
// trotzdem nur EIN Abpraller abgezogen.

import { circleOverlapsAABB } from './collision.js';
import { WIDTH, HEIGHT } from '../config.js';

const TRAIL_MAX = 60; // Ticks Bahnhistorie fuers Debug-Overlay

let nextId = 1;

export function createBullet(
  x,
  y,
  angle,
  {
    speed,
    radius,
    ricochets,
    owner,
    kind,
    tungsten,
    explosive,
    detonateOnWall,
    explosionRadius,
    phaseWalls,
    homing,
  },
) {
  return {
    id: nextId++,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    kind: kind || 'bullet', // 'bullet' | 'rocket' | 'bounce_rocket'
    tungsten: tungsten || false, // Wolframkern-Upgrade (Spec Abschnitt 8)
    explosive: explosive || false, // explodiert beim Tod
    detonateOnWall: detonateOnWall || false, // an der Wand zuenden statt abprallen
    explosionRadius: explosionRadius || 0,
    phaseWalls: phaseWalls || false, // Durchschlag-Upgrade
    homing: homing || 0, // Zielsucher: rad/s Lenkrate (0 = aus)
    detonated: false,
    ricochetsLeft: ricochets,
    ricochetsStart: ricochets, // fuer "Abpraller-Kill"-Feedback
    owner, // Referenz auf den Schuetzen (fuer den 80-ms-Schutz)
    age: 0, // s seit Abschuss
    dead: false,
    trail: [], // letzte Positionen, nur fuers Debug-Overlay
  };
}

// Bewegt das Geschoss auf einer Achse und reflektiert an Waenden.
// Wolframkern (Spec Abschnitt 8): trifft ein Wolfram-Geschoss eine
// zerstoerbare Wand, wird die Wand zerstoert und das Geschoss
// verschwindet; solid-Waende bleiben normale Abpraller.
// Gibt true zurueck, wenn eine Wand getroffen wurde.
function moveAxis(b, state, axis, dt) {
  b[axis] += (axis === 'x' ? b.vx : b.vy) * dt;
  if (b.phaseWalls) return false; // Durchschlag: ignoriert alle Waende
  let hit = false;
  for (const wall of [...state.walls]) {
    if (wall.type === 'hole') continue; // Geschosse fliegen ueber Loecher
    if (!circleOverlapsAABB(b.x, b.y, b.radius, wall)) continue;
    if (b.tungsten && wall.type === 'breakable') {
      state.destroyWall(wall);
      b.dead = true;
      return true;
    }
    // Sprengmunition/Glaskanone: zuenden am Wandkontakt (statt
    // abzuprallen) -- so toetet die Explosion durch die Wand. Die
    // Sprengschuss-Salve hat detonateOnWall=false und prallt ab.
    if (b.explosive && b.detonateOnWall) {
      b.dead = true;
      return true;
    }
    hit = true;
    if (axis === 'x') {
      b.x = b.vx > 0 ? wall.x - b.radius : wall.x + wall.w + b.radius;
      b.vx = -b.vx;
    } else {
      b.y = b.vy > 0 ? wall.y - b.radius : wall.y + wall.h + b.radius;
      b.vy = -b.vy;
    }
  }
  return hit;
}

// Lenkt ein Zielsucher-Geschoss weich zum naechsten gegnerischen Panzer.
function applyHoming(b, state, dt) {
  const owner = b.owner;
  let best = null;
  let bestD = Infinity;
  for (const t of state.tanks) {
    if (t === owner || !t.alive) continue;
    const d = (t.x - b.x) ** 2 + (t.y - b.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (!best) return;
  const speed = Math.hypot(b.vx, b.vy) || 1;
  const cur = Math.atan2(b.vy, b.vx);
  const want = Math.atan2(best.y - b.y, best.x - b.x);
  let diff = ((want - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
  const step = Math.max(-b.homing * dt, Math.min(b.homing * dt, diff));
  const na = cur + step;
  b.vx = Math.cos(na) * speed;
  b.vy = Math.sin(na) * speed;
}

export function updateBullet(b, state, dt) {
  if (b.dead) return;
  b.prevX = b.x;
  b.prevY = b.y;
  b.age += dt;

  if (b.homing > 0) applyHoming(b, state, dt);

  const hitX = moveAxis(b, state, 'x', dt);
  if (b.dead) return;
  const hitY = moveAxis(b, state, 'y', dt);
  if (b.dead) return;

  // Durchschlag-Geschosse werden von keiner Wand gestoppt -> sonst
  // fliegen sie ewig. Sterben, sobald sie die Arena verlassen.
  if (b.phaseWalls && (b.x < 0 || b.x > WIDTH || b.y < 0 || b.y > HEIGHT)) {
    b.dead = true;
    return;
  }

  if (hitX || hitY) {
    state.sounds?.push('bounce');
    // Ein Wandkontakt pro Schritt kostet genau einen Abpraller --
    // auch im Eckenfall (hitX && hitY). Bei 0 verbleibenden
    // Abprallern verschwindet das Geschoss.
    if (b.ricochetsLeft <= 0) {
      b.dead = true;
      return;
    }
    b.ricochetsLeft--;
  }

  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > TRAIL_MAX) b.trail.shift();
}
