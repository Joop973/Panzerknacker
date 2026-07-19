// Minen + Kettenreaktion (Spec Abschnitt 4: Minen).
//
// Ablauf einer Mine:
// 1. Legen am Ort des Panzers.
// 2. Zuendverzoegerung (armDelayS, 1 s): die Mine verletzt niemanden
//    und reagiert auf nichts -- das Fluchtfenster.
// 3. Scharf: explodiert bei Kontakt mit einem beliebigen Panzer (auch
//    dem Leger), bei Treffer durch ein Geschoss oder durch die
//    Explosion einer anderen Mine (Kettenreaktion, chainDelayS pro
//    Glied). NEU (Nutzer-Entscheidung): nach selfDetonateS (10 s)
//    zuendet die Mine von selbst.
// 4. Explosion (explosionRadiusPx): toetet jeden Panzer im Radius
//    inklusive Leger und zerstoert zerstoerbare Waende im Radius.

import { circlesOverlap, circleOverlapsAABB } from './collision.js';

let nextMineId = 1;

export function createMine(x, y, owner, radius) {
  return {
    id: nextMineId++,
    x,
    y,
    radius,
    owner,
    age: 0, // s seit dem Legen
    fuse: null, // != null: Restzeit bis Ketten-Explosion
    dead: false,
  };
}

export function isArmed(mine, mcfg) {
  return mine.age >= mcfg.armDelayS;
}

// Allgemeine Explosion an einer Position (Minen, Sprengschuss-Upgrade):
// toetet Panzer im Radius, zerstoert breakable-Waende, zuendet scharfe
// Minen als Kettenreaktion.
export function explodeAt(state, x, y, R) {
  const mcfg = state.data.mine;
  state.explosions.push({ x, y, age: 0 });
  state.sounds.push('boom');
  state.addShake?.(6);
  state.spawnParticles?.(x, y, '#ffb347', 14, 160);

  for (const t of state.tanks) {
    if (!t.alive) continue;
    if (circlesOverlap(x, y, R, t.x, t.y, t.cfg.radius)) {
      state.killTank(t);
    }
  }

  for (const wall of [...state.walls]) {
    if (wall.type === 'breakable' && circleOverlapsAABB(x, y, R, wall)) {
      state.destroyWall(wall);
    }
  }

  for (const other of state.mines) {
    if (other.dead || other.fuse !== null) continue;
    if (!isArmed(other, mcfg)) continue;
    if (circlesOverlap(x, y, R, other.x, other.y, other.radius)) {
      other.fuse = mcfg.chainDelayS;
    }
  }
}

function explode(mine, state) {
  if (mine.dead) return;
  mine.dead = true;
  // Sprengkraft-Upgrade: Radius-Multiplikator des Legers.
  const R = state.data.mine.explosionRadiusPx * (mine.owner?.cfg?.mineRadiusMult || 1);
  explodeAt(state, mine.x, mine.y, R);
}

export function updateMines(state, dt) {
  const mcfg = state.data.mine;

  for (const m of state.mines) {
    if (m.dead) continue;
    m.age += dt;

    // Laufende Ketten-Zuendschnur hat Vorrang.
    if (m.fuse !== null) {
      m.fuse -= dt;
      if (m.fuse <= 0) explode(m, state);
      continue;
    }

    if (!isArmed(m, mcfg)) continue;

    // Selbstzuendung nach Ablauf der Lebenszeit.
    if (m.age >= mcfg.selfDetonateS) {
      explode(m, state);
      continue;
    }

    // Geschosstreffer zuendet sofort; das Geschoss wird verbraucht.
    let triggered = false;
    for (const b of state.bullets) {
      if (b.dead) continue;
      if (circlesOverlap(m.x, m.y, m.radius, b.x, b.y, b.radius)) {
        b.dead = true;
        explode(m, state);
        triggered = true;
        break;
      }
    }
    if (triggered) continue;

    // Kontakt mit einem beliebigen Panzer (auch dem Leger).
    for (const t of state.tanks) {
      if (!t.alive) continue;
      if (circlesOverlap(m.x, m.y, m.radius, t.x, t.y, t.cfg.radius)) {
        explode(m, state);
        break;
      }
    }
  }

  state.mines = state.mines.filter((m) => !m.dead);
}
