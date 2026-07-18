// Panzer-Entity (Spec Abschnitt 5).
//
// Phase 2: Spielerpanzer mit Fahren (Sliding) und getrenntem Turm.
// Rumpf (heading) zeigt in Fahrtrichtung, Turm (turret) zielt zur Maus.
// Gegner und deren KI kommen ab Phase 3.

import { PLAYER_RADIUS, PLAYER_SPEED } from '../config.js';
import { resolveCircleWalls } from './collision.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    // Vorherige Position fuer die Render-Interpolation.
    prevX: x,
    prevY: y,
    radius: PLAYER_RADIUS,
    speed: PLAYER_SPEED,
    // Rumpf-Blickrichtung (rad). Zeigt in die zuletzt gefahrene Richtung.
    heading: -Math.PI / 2, // nach oben
    // Turm-Richtung (rad), unabhaengig vom Rumpf.
    turret: -Math.PI / 2,
    // Restzeit des Feuerraten-Cooldowns (s).
    cooldown: 0,
    alive: true,
  };
}

// Ein fester Physikschritt. axis = roher Eingabevektor {x, y}.
export function updatePlayer(player, axis, walls, dt) {
  player.prevX = player.x;
  player.prevY = player.y;

  let dx = axis.x;
  let dy = axis.y;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    // Normalisieren, damit Diagonale nicht schneller ist.
    dx /= len;
    dy /= len;
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    player.heading = Math.atan2(dy, dx);
  }

  // Nach der Bewegung aus allen Waenden herausschieben (Sliding).
  resolveCircleWalls(player, player.radius, walls);
}
