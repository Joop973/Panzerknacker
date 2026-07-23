// Minen + Kettenreaktion (Spec Abschnitt 4: Minen).
//
// Ablauf einer Mine:
// 1. Legen am Ort des Panzers.
// 2. Zuendverzoegerung (armDelayS, 1 s): die Mine verletzt niemanden
//    und reagiert auf nichts -- das Fluchtfenster.
// 3. Scharf: explodiert bei Kontakt mit einem beliebigen Panzer (auch
//    dem Leger), bei Treffer durch ein Geschoss oder durch die
//    Explosion einer anderen Mine (Kettenreaktion, balance.mine.chainDelay
//    pro Glied). Nach balance.mine.fuse Sekunden zuendet die Mine von
//    selbst.
// 4. Explosion (balance.mine.radius): toetet jeden Panzer im Radius
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
    stuckTo: null, // Klebemine: Panzer, an dem die Mine haftet
    dead: false,
  };
}

export function isArmed(mine, mcfg) {
  // Annaeherungsmine: Leger-eigene, kuerzere Scharfschalt-Zeit.
  const arm = mine.owner?.cfg?.mineArmS ?? mcfg.armDelayS;
  return mine.age >= arm;
}

// Allgemeine Explosion an einer Position (Minen, Sprengschuss-Upgrade):
// toetet Panzer im Radius, zerstoert breakable-Waende, zuendet scharfe
// Minen als Kettenreaktion.
export function explodeAt(state, x, y, R, spare, meta) {
  const mcfg = state.data.mine;
  state.explosions.push({ x, y, age: 0 });
  state.sounds.push('boom');
  state.addShake?.(6);
  state.spawnParticles?.(x, y, '#ffb347', 14, 160);

  for (const t of state.tanks) {
    if (!t.alive || t.protect > 0 || t === spare) continue;
    if (circlesOverlap(x, y, R, t.x, t.y, t.cfg.radius)) {
      state.killTank(t, 'eine Explosion', meta);
    }
  }

  for (const wall of [...state.walls]) {
    if (wall.type === 'breakable' && circleOverlapsAABB(x, y, R, wall)) {
      state.destroyWall(wall);
    }
  }

  // Kettenreaktion: getroffene scharfe Minen zuenden mit chainDelay
  // Verzoegerung pro Glied (nicht im selben Frame).
  for (const other of state.mines) {
    if (other.dead || other.fuse !== null) continue;
    if (!isArmed(other, mcfg)) continue;
    if (circlesOverlap(x, y, R, other.x, other.y, other.radius)) {
      other.fuse = state.data.balance.mine.chainDelay;
    }
  }
}

function explode(mine, state) {
  if (mine.dead) return;
  mine.dead = true;
  // Sprengkraft-Upgrade: Radius-Multiplikator des Legers.
  const R = state.data.balance.mine.radius * (mine.owner?.cfg?.mineRadiusMult || 1);
  // Todesursache fuer die Telemetrie: eigene vs. gegnerische Mine.
  const own = mine.owner === state.player;
  const meta = { code: own ? 'own_mine' : 'enemy_mine', enemyType: own ? null : mine.owner?.type || null };
  explodeAt(state, mine.x, mine.y, R, null, meta);
  // Streumine-Upgrade: schleudert kleine Splitterminen (die nicht
  // weiter splittern -> keine Endloskette).
  const sub = mine.owner?.cfg?.clusterMine;
  if (sub && !mine.isSub) {
    const arm = mine.owner?.cfg?.mineArmS ?? state.data.mine.armDelayS;
    for (let i = 0; i < sub; i++) {
      const a = (i / sub) * Math.PI * 2;
      const m = createMine(
        mine.x + Math.cos(a) * 26,
        mine.y + Math.sin(a) * 26,
        mine.owner,
        mine.radius,
      );
      m.isSub = true;
      m.age = arm; // Splitterminen sind sofort scharf
      state.mines.push(m);
    }
  }
}

export function updateMines(state, dt) {
  const mcfg = state.data.mine;

  for (const m of state.mines) {
    if (m.dead) continue;
    m.age += dt;

    // Laufende Ketten-/Klebe-Zuendschnur hat Vorrang.
    if (m.fuse !== null) {
      // Klebemine: haftet am Ziel und folgt ihm bis zur Zuendung.
      if (m.stuckTo) {
        if (!m.stuckTo.alive) {
          explode(m, state);
          continue;
        }
        m.x = m.stuckTo.x;
        m.y = m.stuckTo.y;
      }
      m.fuse -= dt;
      if (m.fuse <= 0) explode(m, state);
      continue;
    }

    if (!isArmed(m, mcfg)) continue;

    // Fernzuender: diese Minen reagieren NICHT von selbst (kein
    // Kontakt-, kein Zeitzuender) -- sie warten auf die Sprengtaste.
    // Splitterminen (isSub) sind davon ausgenommen.
    const remote = m.owner?.cfg?.remoteDetonate && !m.isSub;
    if (remote) continue;

    // Selbstzuendung nach Ablauf der Lebenszeit (balance.mine.fuse).
    if (m.age >= state.data.balance.mine.fuse) {
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

    // Kontakt mit einem beliebigen Panzer (auch dem Leger). Die
    // Annaeherungsmine loest schon aus groesserer Entfernung aus.
    const trig = m.owner?.cfg?.mineTriggerRadius ?? m.radius;
    const sticky = m.owner?.cfg?.stickyMine;
    for (const t of state.tanks) {
      if (!t.alive) continue;
      if (circlesOverlap(m.x, m.y, trig, t.x, t.y, t.cfg.radius)) {
        // Klebemine: haftet am Gegner statt sofort zu zuenden
        // (verschont den Leger als Klebeziel).
        if (sticky && t !== m.owner) {
          m.stuckTo = t;
          m.fuse = sticky;
          state.sounds.push('mine');
        } else {
          explode(m, state);
        }
        break;
      }
    }
  }

  state.mines = state.mines.filter((m) => !m.dead);
}
