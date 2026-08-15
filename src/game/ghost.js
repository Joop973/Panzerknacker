// Geisterpanzer -- Anhang B (Upgradepool-v2 Phase 7): eigener, fester
// Basiseinheiten-Typ. ERSETZT das Vorgaengermodul komplett, nicht nur den
// Ausloeser: bis hierher erbte ein Geist die aufgeloeste cfg des GETOETETEN
// Panzers (Phase 5/6, ausdruecklich als Interimswert dokumentiert) -- ab
// jetzt haben ALLE Geister exakt dieselben, vom Ziel UNABHAENGIGEN
// Basiswerte (Anhang B S8: "kein Stat-Erbe vom getoeteten Gegner", gilt
// ausdruecklich auch fuer einen Boss). Die beiden Erzeuger aus Phase 6
// (state.js: killTank()s Spawnwuerfel, tank.js: useSecondary()s
// Geisterbombe) reichen deshalb nur noch Position/Ausrichtung durch, nicht
// mehr die cfg des Ausloesers -- s. dortige Aufrufstellen.

import { angleDiff, turnToward, clearLine } from './ai.js';
import { resolveCircleWalls } from './collision.js';
import { createBullet } from './bullet.js';
import { resolveCfg } from './cfg.js';

const TURN_SPEED = 4; // rad/s -- Drehen von Rumpf UND Turm Richtung Ziel
const FIRE_CONE = 0.15; // rad -- muss so genau ausgerichtet sein, um zu feuern

let nextGhostId = 1;

// Feste cfg des Geisterpanzer-Basistyps (Anhang B S7/S18, Werte in
// data/tanks.json: types.ghost_tank). speedPct/bulletSpeedPct/rangePct
// beziehen sich AUSDRUECKLICH auf die STANDARDKLASSE `player` (Anhang B S7:
// "70 % der Basisbewegung EINES NORMALEN SPIELERPANZERS"), NICHT auf die
// aktuellen Werte des spielenden Nekromanten -- resolveCfg(data,'player')
// liefert genau diese ungeupgradete Baseline und wird wiederverwendet statt
// dupliziert (Anhang A S16 "keine Parallelsysteme": ein zweites,
// eigenstaendiges Stat-Aufloesungssystem nur fuer Geister waere genau das).
// Reine Konstantenrechnung (data mutiert nie) -- bewusst nicht gecacht, bei
// hoechstens 3-4 Geistern und seltenen Spawns lohnt sich das nicht.
function resolveGhostCfg(data) {
  const g = data.types.ghost_tank || {};
  const p = resolveCfg(data, 'player'); // Standardklasse, OHNE Nekromant-Werte
  return {
    radius: data.physics.tankRadius,
    bulletRadius: data.physics.bulletRadius,
    maxHp: g.maxHp ?? 60,
    damage: g.damage ?? 8,
    damageType: g.damageType ?? 'physical',
    fireCooldown: g.fireRate ?? 2.0,
    speed: p.speed * (g.speedPct ?? 0.7),
    bulletSpeed: p.bulletSpeed * (g.bulletSpeedPct ?? 0.8),
    // Feuer-SCHWELLE, nicht die Geschossreichweite selbst (die bleibt der
    // normale Wegbudget-Wert aus balance.bullet.maxDistance) -- ein Geist
    // schiesst erst innerhalb dieser Distanz, verfolgt sein Ziel aber
    // unbegrenzt weit (Anhang B S7: "das Verfolgen bleibt unbegrenzt").
    fireRangePx: (data.balance?.bullet?.maxDistance ?? 1200) * (g.rangePct ?? 0.65),
    ricochets: g.ricochets ?? 0,
    weapon: g.weapon ?? 'bullet',
    armor: null, // Ruestung 0 (Anhang B S7)
  };
}

// x, y, heading = wo/wie der Geist entsteht (Kill-Position des getoeteten
// Gegners bzw. Position/Blickrichtung des Nekromanten bei der
// Geisterbombe). KEIN tank-Parameter mehr fuer die cfg -- die kommt
// ausschliesslich aus resolveGhostCfg(), s. Kopfkommentar.
export function createGhost(state, x, y, heading = 0) {
  const cfg = resolveGhostCfg(state.data);
  return {
    id: nextGhostId++,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    heading,
    turret: heading,
    type: 'ghost_tank',
    cfg,
    hp: cfg.maxHp,
    cooldown: 0,
    isGhost: true,
    alive: true,
  };
}

// Einziger Tod-Trichter (Anhang B S13/S17): "der Basistod besitzt keinen
// zusaetzlichen Spezialeffekt" -- die Funktion existiert trotzdem als fester
// Anschlusspunkt, damit Phase 8 (Signaturkarten wie Letzter-Wille/Wiederkehr)
// an GENAU EINER Stelle andocken kann, statt den Tod an den zwei
// Aufrufstellen (Zeitablauf hier in updateGhosts(), Geschoss-Kollision in
// state.js) getrennt zu behandeln. Idempotent wie killTank() (Doppeltod im
// selben Frame moeglich: Kettenreaktionen, gleichzeitige Treffer).
export function killGhost(g) {
  if (!g.alive) return;
  g.alive = false;
}

// Naechster gueltiger Gegner (Anhang B S9/S10: "Basissystem: Primaerziel =
// naechstgelegener gueltiger Gegner" -- bewusst KEINE speziellen Zielregeln
// in der Basiseinheit, die sind fuer spaetere Upgrades vorgesehen).
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
    // Anhang B S6: KEIN Lebensdauer-Timer -- ein Geist lebt bis zum Tod oder
    // bis der Raum endet (state.ghosts wird bei jedem neuen Raum ohnehin
    // frisch mit [] angelegt, s. state.js: createState()). Nur noch die
    // hp<=0-Pruefung bleibt (Kollisionstreffer setzen alive direkt ueber
    // killGhost(), diese Zeile faengt den seltenen Fall ab, dass ein
    // Statuseffekt-Tick o. ae. die hp zwischen zwei Kollisionsschleifen
    // unter 0 gedrueckt hat).
    if (!g.alive) continue;
    if (g.hp <= 0) {
      killGhost(g);
      continue;
    }
    g.prevX = g.x;
    g.prevY = g.y;

    const target = nearestEnemy(state, g);
    if (g.cooldown > 0) g.cooldown -= dt;
    if (!target) {
      g.vx = 0;
      g.vy = 0;
      continue; // kein Gegner mehr im Raum
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
    // vx/vy wie bei einem echten Panzer (tank.js: moveTank) -- fuer
    // Vorhaltezielen (t_black) gegen einen Geist.
    g.vx = dt > 0 ? (g.x - g.prevX) / dt : 0;
    g.vy = dt > 0 ? (g.y - g.prevY) / dt : 0;

    // Feuer-Schwelle (Anhang B S7): erst schiessen, wenn das Ziel innerhalb
    // fireRangePx liegt -- das Verfolgen selbst (oben) bleibt unbegrenzt.
    const distToTarget = Math.hypot(target.x - g.x, target.y - g.y);
    if (
      g.cooldown <= 0 &&
      distToTarget <= g.cfg.fireRangePx &&
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
