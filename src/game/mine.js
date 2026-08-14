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
import { applyTypeEffects } from './damagetypes.js';

let nextMineId = 1;

export function createMine(x, y, owner, radius, isEmp) {
  return {
    id: nextMineId++,
    x,
    y,
    radius,
    owner,
    age: 0, // s seit dem Legen
    fuse: null, // != null: Restzeit bis Ketten-Explosion
    stuckTo: null, // Klebemine: Panzer, an dem die Mine haftet
    isEmp: !!isEmp, // Sekundärslot EMP-Mine (Phase 6): betaeubt statt zu toeten
    warnPulses: 0, // Phase 7b: bereits gespielte Warntoene vor der Selbstzuendung
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
export function explodeAt(state, x, y, R, spare, meta, damage, damageType) {
  const mcfg = state.data.mine;
  // UMBAUPLAN-LP Phase 1: Explosionsschaden hat keinen Panzer als Urheber
  // (eine Mine ist kein Geschoss mit cfg.damage), deshalb ein eigener Wert
  // in balance.json. Der optionale Parameter ist fuer spaetere Quellen mit
  // abweichendem Schaden vorgesehen (Phase 3: Bossangriff), Bestandsaufrufe
  // bleiben unveraendert.
  const dmg = damage ?? state.data.balance?.damage?.explosion ?? 1;
  // Schadenstyp der Explosion (Phase 6). Standard 'explosive'; eine
  // Feuermine o. ae. reicht spaeter ihren eigenen Typ durch.
  const dtyp = damageType || 'explosive';
  state.explosions.push({ x, y, age: 0 });
  state.sounds.push({ name: 'boom', x });
  state.addShake?.(6);
  state.spawnParticles?.(x, y, '#ffb347', 14, 160);

  // Transformation "Pionier" (Phase 5): eigene Minen verletzen den Spieler
  // nicht mehr. Schalter kommt aus data/transformations.json.
  const pionier = !!state.transform?.ownMinesHarmless && meta?.code === 'own_mine';
  for (const t of state.tanks) {
    if (!t.alive || t.protect > 0 || t === spare) continue;
    if (pionier && t === state.player) continue;
    if (circlesOverlap(x, y, R, t.x, t.y, t.cfg.radius)) {
      state.applyDamage(t, dmg, 'eine Explosion', meta);
      applyTypeEffects(state, t, dtyp, dmg, meta);
    }
  }

  for (const wall of [...state.walls]) {
    // Zerstoerbare Waende (Phase 11) nehmen wie Kugeln einen Treffer --
    // dieselbe destroyWall()-Haltbarkeit, keine Extra-Regel fuer Explosionen.
    // Reaktor-Generatoren (Phase 14) BEWUSST NICHT hier aufgenommen: die
    // Bankshot-Huerde (siehe bullet.js) soll keine Explosion (Mine,
    // Kettenblitz, Kamikaze) umgehen koennen, sonst waere das Raetsel
    // trivial ausspielbar -- Muster wie "Explosionen ignorieren die
    // Panzerung" in armor.js.
    if ((wall.type === 'breakable' || wall.type === 'destructible') && circleOverlapsAABB(x, y, R, wall)) {
      state.destroyWall(wall);
    }
  }

  // Kettenreaktion: getroffene scharfe Minen zuenden mit chainDelay
  // Verzoegerung pro Glied (nicht im selben Frame). EMP-Minen (Phase 6)
  // nehmen an Kettenreaktionen nicht teil -- weder loesen sie eine aus
  // (siehe explodeEmpAt) noch werden sie durch eine externe Explosion
  // mitgezuendet.
  for (const other of state.mines) {
    if (other.dead || other.fuse !== null || other.isEmp) continue;
    if (!isArmed(other, mcfg)) continue;
    if (circlesOverlap(x, y, R, other.x, other.y, other.radius)) {
      other.fuse = state.data.balance.mine.chainDelay;
    }
  }
}

// Sekundärslot "EMP-Mine" (Phase 6): kein Schaden, kein Wandabriss, keine
// Kettenreaktion -- betaeubt Panzer im Radius (Bewegung UND Turm) statt sie
// zu toeten. Betaeubte Panzer blockieren weiterhin Geschosse (bleiben alive).
function explodeEmpAt(state, x, y, R) {
  const scfg = state.data.secondaries?.emp_mine || {};
  const dur = scfg.stunDuration ?? 1.5;
  state.sounds.push({ name: 'shield', x });
  state.spawnParticles?.(x, y, '#5ad4f0', 10, 130);
  for (const t of state.tanks) {
    if (!t.alive || t.protect > 0) continue;
    if (circlesOverlap(x, y, R, t.x, t.y, t.cfg.radius)) {
      t.stunTimer = Math.max(t.stunTimer, dur);
      t.turretStunTimer = Math.max(t.turretStunTimer || 0, dur);
    }
  }
}

function explode(mine, state) {
  if (mine.dead) return;
  mine.dead = true;
  // Sprengkraft-Upgrade: Radius-Multiplikator des Legers.
  const R = state.data.balance.mine.radius * (mine.owner?.cfg?.mineRadiusMult || 1);
  if (mine.isEmp) {
    explodeEmpAt(state, mine.x, mine.y, R);
    return; // keine Kettenreaktion, keine Streumine, keine Wandzerstoerung
  }
  // Todesursache fuer die Telemetrie: eigene vs. gegnerische Mine.
  const own = mine.owner === state.player;
  // killer (Upgradepool-v2 Phase 6): Kill-Zuordnung fuer die Nekromant-
  // Spawnchance (state.js: killTank()) -- eine Mine kennt ihren Leger.
  const meta = {
    code: own ? 'own_mine' : 'enemy_mine',
    enemyType: own ? null : mine.owner?.type || null,
    killer: mine.owner,
  };
  // Phase 12 (Sprengstoff-Topf): auch Minen skalieren mit explosionDamageMult
  // des Legers.
  const mineDmg =
    (state.data.balance?.damage?.explosion ?? 1) * (mine.owner?.cfg?.explosionDamageMult || 1);
  explodeAt(state, mine.x, mine.y, R, null, meta, mineDmg);
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

    // Warnpuls (Phase 7b): in den letzten warningTime Sekunden vor der
    // Selbstzuendung tickt die Mine im Takt warnPulseS. Ueber einen Zaehler
    // statt eines Timers gerechnet, damit der Takt unabhaengig von der
    // Framerate und (Trickshot-)Zeitlupe derselbe bleibt. Sichtbares
    // Gegenstueck ist das schnelle rote Blinken (effects.js: drawMines).
    const bmine = state.data.balance.mine;
    const remaining = bmine.fuse - m.age;
    if (remaining <= bmine.warningTime) {
      const pulseS = state.data.sounds?.mine?.warnPulseS ?? 0.16;
      const due = Math.floor((bmine.warningTime - remaining) / pulseS) + 1;
      if (m.warnPulses < due) {
        m.warnPulses = due;
        state.sounds.push({ name: 'mine_warn', x: m.x });
      }
    }

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
    const sticky = m.owner?.cfg?.stickyMine;
    // Klebemine: eigener, deutlich groesserer Haft-Radius. Vorher galt der
    // Minenradius (7 px) -- ein Gegner musste die Mine praktisch beruehren,
    // die Karte griff dadurch fast nie.
    const stickR = sticky ? m.owner?.cfg?.stickyRadius || 0 : 0;
    const trig = Math.max(m.owner?.cfg?.mineTriggerRadius ?? m.radius, stickR);
    for (const t of state.tanks) {
      if (!t.alive) continue;
      if (circlesOverlap(m.x, m.y, trig, t.x, t.y, t.cfg.radius)) {
        // Klebemine: haftet am Gegner statt sofort zu zuenden
        // (verschont den Leger als Klebeziel).
        if (sticky && t !== m.owner) {
          m.stuckTo = t;
          m.fuse = sticky;
          state.sounds.push({ name: 'mine', x: m.x });
        } else {
          explode(m, state);
        }
        break;
      }
    }
  }

  state.mines = state.mines.filter((m) => !m.dead);
}
