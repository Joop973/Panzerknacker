// Geschosse + Abpraller-Physik (Spec Abschnitt 4: Geschosse).
//
// Bewegung geradlinig mit konstanter Geschwindigkeit. Wandkontakt:
// Reflexion an der Normalen der getroffenen Flaeche. Die Bewegung wird
// pro Achse aufgeloest -- trifft ein Geschoss im selben Schritt auf
// beiden Achsen (Eckenfall), wird auf beiden Achsen reflektiert und
// trotzdem nur EIN Abpraller abgezogen.

import { circleOverlapsAABB } from './collision.js';

const TRAIL_MAX = 60; // Ticks Bahnhistorie fuers Debug-Overlay

let nextId = 1;

export function createBullet(x, y, angle, { speed, radius, ricochets, owner, kind }) {
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
    ricochetsLeft: ricochets,
    owner, // Referenz auf den Schuetzen (fuer den 80-ms-Schutz)
    age: 0, // s seit Abschuss
    dead: false,
    trail: [], // letzte Positionen, nur fuers Debug-Overlay
  };
}

// Bewegt das Geschoss auf einer Achse und reflektiert an solid-Waenden.
// Gibt true zurueck, wenn eine Wand getroffen wurde.
function moveAxis(b, walls, axis, dt) {
  b[axis] += (axis === 'x' ? b.vx : b.vy) * dt;
  let hit = false;
  for (const wall of walls) {
    if (wall.type === 'hole') continue; // Geschosse fliegen ueber Loecher
    if (!circleOverlapsAABB(b.x, b.y, b.radius, wall)) continue;
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

export function updateBullet(b, walls, dt) {
  if (b.dead) return;
  b.prevX = b.x;
  b.prevY = b.y;
  b.age += dt;

  const hitX = moveAxis(b, walls, 'x', dt);
  const hitY = moveAxis(b, walls, 'y', dt);

  if (hitX || hitY) {
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
