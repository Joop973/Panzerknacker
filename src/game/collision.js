// Kollisionsroutinen (Spec Abschnitt 4: Kollision).
//
// Phase 1 braucht nur: Panzer (Kreis) gegen Wand (AABB) mit Sliding.
// Sliding = an der Wand entlanggleiten statt hart blockieren. Erreicht,
// indem der Kreis nur entlang der Durchdringungs-Normalen aus der Box
// herausgeschoben wird; die tangentiale Bewegung bleibt erhalten.

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Schiebt den Kreis (Objekt mit x, y) aus einer einzelnen AABB heraus,
// falls er sie ueberlappt. Gibt true zurueck, wenn korrigiert wurde.
function resolveCircleAABB(circle, r, wall) {
  const wx2 = wall.x + wall.w;
  const wy2 = wall.y + wall.h;

  // Naechster Punkt der Box zum Kreismittelpunkt.
  const nearestX = clamp(circle.x, wall.x, wx2);
  const nearestY = clamp(circle.y, wall.y, wy2);

  let dx = circle.x - nearestX;
  let dy = circle.y - nearestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= r * r) return false; // kein Kontakt

  if (distSq > 1e-9) {
    // Regelfall: Mittelpunkt liegt ausserhalb der Box -> entlang der
    // Verbindungslinie (Normalen) herausschieben.
    const dist = Math.sqrt(distSq);
    const overlap = r - dist;
    circle.x += (dx / dist) * overlap;
    circle.y += (dy / dist) * overlap;
  } else {
    // Sonderfall: Mittelpunkt steckt exakt in der Box. Entlang der
    // Achse mit der geringsten Eindringtiefe herausdruecken.
    const toLeft = circle.x - wall.x;
    const toRight = wx2 - circle.x;
    const toTop = circle.y - wall.y;
    const toBottom = wy2 - circle.y;
    const minX = Math.min(toLeft, toRight);
    const minY = Math.min(toTop, toBottom);
    if (minX < minY) {
      circle.x += toLeft < toRight ? -(minX + r) : minX + r;
    } else {
      circle.y += toTop < toBottom ? -(minY + r) : minY + r;
    }
  }
  return true;
}

// Loest den Kreis gegen alle Waende auf. Zwei Durchgaenge, damit ein
// Kreis, der in einer Ecke zwischen zwei Boxen steckt, sauber
// herausgeschoben wird (der erste Durchgang gegen Box A kann ihn in Box B
// druecken).
export function resolveCircleWalls(circle, r, walls) {
  for (let pass = 0; pass < 2; pass++) {
    let anyHit = false;
    for (let i = 0; i < walls.length; i++) {
      if (resolveCircleAABB(circle, r, walls[i])) anyHit = true;
    }
    if (!anyHit) break;
  }
}
