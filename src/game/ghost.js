// Geisterpanzer (PLAN.md v3, Phase 7) -- DERZEIT UNBENUTZT.
//
// Upgradepool-v2 Phase 4: der einzige Erzeuger (state.js: killTank()s
// ghost_crew-Zweig) ist abgebaut, `createGhost()` wird also von nirgendwo
// mehr aufgerufen. Das gesamte Modul wird von Upgradepool-v2 Phase 7
// ERSETZT (nicht ergaenzt) durch den Nekromant-Neubau -- bis dahin bleibt
// es als totes Vorbild stehen (state.ghosts bleibt in der Zwischenzeit
// immer leer, updateGhosts() iteriert dann ueber nichts).
//
// Alte Beschreibung (nicht mehr zutreffend, nur zur Einordnung): getoetete
// Gegner kaempften mit dem ghost_crew-Upgrade als durchscheinender
// Verbuendeter weiter: eigenes state.ghosts-Array (kein Eintrag in
// state.tanks) -- das erfuellt "blockieren keine Kugeln, sind nicht
// toetbar" automatisch, weil die Geschoss-vs-Panzer-Treffer-Schleife in
// state.js nur ueber state.tanks laeuft. Ein Geist behaelt die aufgeloeste
// cfg seines Ursprungs-Panzers (Tempo, Geschossgeschwindigkeit, Abpraller,
// Waffenart) -- er kaempft weiter, wie er lebte.

import { angleDiff, turnToward, clearLine } from './ai.js';
import { resolveCircleWalls } from './collision.js';
import { createBullet } from './bullet.js';

const TURN_SPEED = 4; // rad/s -- Drehen von Rumpf UND Turm Richtung Ziel
const FIRE_CONE = 0.15; // rad -- muss so genau ausgerichtet sein, um zu feuern

let nextGhostId = 1;

// tank = der soeben gestorbene Panzer (liefert Position/Ausrichtung/cfg).
// durationBonus (Phase 26, Nekromant-Signatur): verlaengert die Lebensdauer
// des Geistes ueber balance.ghost.duration hinaus ("Qualitaet statt Zahl").
// Upgradepool-v2 Phase 4: balance.ghost.duration selbst ist mit dem alten
// System entfernt -- der Fallback (?? 3) verhindert NaN, falls diese
// Funktion (derzeit unbenutzt, s. Kopfkommentar) doch aufgerufen wird.
// Upgradepool-v2 Phase 5: die Objektform ist jetzt panzerkompatibel (x/y/
// prevX/prevY/vx/vy/alive/cfg.radius/hp statt nur dead) -- Gegner-KI
// (resolveTarget), Vorhaltezielen (liest vx/vy) und die neue Geschoss-
// Kollision (state.js) behandeln einen Geist dadurch wie einen Panzer.
// `alive` ersetzt das bisherige `dead` (invertiert). hp = tank.cfg.maxHp ist
// ein INTERIMSWERT -- Anhang B (Phase 7) will feste, vom getoeteten Gegner
// UNABHAENGIGE Basiswerte; der endgueltige Wert kommt mit dem Nekromant-
// Neubau, der dieses ganze Modul ersetzt.
export function createGhost(tank, balance, durationBonus = 0) {
  return {
    id: nextGhostId++,
    x: tank.x,
    y: tank.y,
    prevX: tank.x,
    prevY: tank.y,
    vx: 0,
    vy: 0,
    heading: tank.heading,
    turret: tank.turret,
    type: tank.type,
    cfg: tank.cfg, // dieselbe aufgeloeste cfg -- kein neuer Balance-Wert noetig
    hp: tank.cfg.maxHp,
    cooldown: 0,
    timeLeft: (balance.ghost?.duration ?? 3) + durationBonus,
    isGhost: true,
    alive: true,
  };
}

function nearestEnemy(state, ghost) {
  let best = null;
  let bestD = Infinity;
  for (const t of state.tanks) {
    if (t === state.player || !t.alive) continue;
    const d = (t.x - ghost.x) ** 2 + (t.y - ghost.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function updateGhosts(state, dt) {
  for (const g of state.ghosts) {
    g.timeLeft -= dt;
    if (g.timeLeft <= 0 || g.hp <= 0) {
      g.alive = false;
      continue;
    }
    g.prevX = g.x;
    g.prevY = g.y;

    const target = nearestEnemy(state, g);
    if (g.cooldown > 0) g.cooldown -= dt;
    if (!target) {
      g.vx = 0;
      g.vy = 0;
      continue; // kein Gegner mehr -- nur der Timer laeuft weiter
    }

    const angleToTarget = Math.atan2(target.y - g.y, target.x - g.x);
    g.turret = turnToward(g.turret, angleToTarget, TURN_SPEED * dt);
    g.heading = g.turret; // faehrt in die Richtung, in die er zielt

    const dx = Math.cos(g.heading);
    const dy = Math.sin(g.heading);
    g.x += dx * g.cfg.speed * dt;
    g.y += dy * g.cfg.speed * dt;
    // Nicht durch Waende clippen, aber keine resolveTankBlocking --
    // Geister blockieren echte Panzer nicht und werden nicht von ihnen
    // blockiert (passend zu "blockieren keine Kugeln").
    resolveCircleWalls(g, g.cfg.radius, state.walls);
    // vx/vy wie bei einem echten Panzer (tank.js: moveTank) -- Phase 5
    // braucht das fuer Vorhaltezielen (t_black) gegen einen Geist.
    g.vx = dt > 0 ? (g.x - g.prevX) / dt : 0;
    g.vy = dt > 0 ? (g.y - g.prevY) / dt : 0;

    if (
      g.cooldown <= 0 &&
      Math.abs(angleDiff(g.turret, angleToTarget)) < FIRE_CONE &&
      clearLine(state, g.x, g.y, target.x, target.y)
    ) {
      const muzzle = g.cfg.radius + 8;
      state.bullets.push(
        createBullet(g.x + dx * muzzle, g.y + dy * muzzle, g.turret, {
          speed: g.cfg.bulletSpeed,
          radius: state.data.physics.bulletRadius,
          ricochets: g.cfg.ricochets,
          owner: g,
          kind: g.cfg.weapon,
          // Der Geist kaempft weiter, wie er lebte -- auch beim Schaden.
          damage: g.cfg.damage,
          damageType: g.cfg.damageType,
        }),
      );
      g.cooldown = g.cfg.fireCooldown;
      // Geister kaempfen auf Spielerseite -> der freundliche Schuss-Ton.
      state.sounds.push({ name: 'shoot', x: g.x });
    }
  }
  state.ghosts = state.ghosts.filter((g) => g.alive);
}
