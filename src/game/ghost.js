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
//
// Upgradepool-v2 Phase 8 (Signaturtopf Nekromant): die 18 sig_necro_*-Karten
// wirken NICHT auf den Spieler selbst, sondern ueber neue ghost*-core-
// Schluessel (cfg.js) auf die Geistereinheit -- resolveGhostCfg() liest sie
// aus dem aufgeloesten Spieler-cfg. killGhost() ist seit Phase 7 als
// einziger Tod-Trichter angelegt und haengt jetzt Phylakterium (Kommandant-
// Schutz), Wiederkehr/Unsterbliche-Seele/Ewige-Wiederkehr (Wiederbelebung)
// und Letzter Wille (Todeszone) dort ein -- Anhang B S13: "der Basistod hat
// keinen Zusatzeffekt", die Erweiterungen kommen ausschliesslich ueber
// Karten.

import { angleDiff, turnToward, clearLine } from './ai.js';
import { resolveCircleWalls } from './collision.js';
import { createBullet } from './bullet.js';
import { resolveCfg } from './cfg.js';
import { explodeAt } from './mine.js';

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
// `playerCfg` (Phase 8, optional) ist das AUFGELOESTE cfg des spielenden
// Nekromanten -- dessen ghostHpAdd/ghostDamageAdd/ghostSpeedMult/
// ghostFireMult-Felder (aus den Signaturkarten) werden hier additiv/
// multiplikativ oben draufgelegt. Reine Konstantenrechnung -- bewusst nicht
// gecacht, bei hoechstens 3-6 Geistern und seltenen Spawns lohnt sich das
// nicht.
function resolveGhostCfg(data, playerCfg) {
  const g = data.types.ghost_tank || {};
  const p = resolveCfg(data, 'player'); // Standardklasse, OHNE Nekromant-Werte
  const maxHp = (g.maxHp ?? 60) + (playerCfg?.ghostHpAdd || 0);
  const damage = (g.damage ?? 8) + (playerCfg?.ghostDamageAdd || 0);
  return {
    radius: data.physics.tankRadius,
    bulletRadius: data.physics.bulletRadius,
    maxHp,
    damage,
    damageType: g.damageType ?? 'physical',
    fireCooldown: (g.fireRate ?? 2.0) * (playerCfg?.ghostFireMult || 1),
    speed: p.speed * (g.speedPct ?? 0.7) * (playerCfg?.ghostSpeedMult || 1),
    bulletSpeed: p.bulletSpeed * (g.bulletSpeedPct ?? 0.8),
    // Feuer-SCHWELLE, nicht die Geschossreichweite selbst (die bleibt der
    // normale Wegbudget-Wert aus balance.bullet.maxDistance) -- ein Geist
    // schiesst erst innerhalb dieser Distanz, verfolgt sein Ziel aber
    // unbegrenzt weit (Anhang B S7: "das Verfolgen bleibt unbegrenzt").
    fireRangePx: (data.balance?.bullet?.maxDistance ?? 1200) * (g.rangePct ?? 0.65),
    weapon: g.weapon ?? 'bullet',
    armor: null, // Ruestung 0 (Anhang B S7)
  };
}

// x, y, heading = wo/wie der Geist entsteht (Kill-Position des getoeteten
// Gegners bzw. Position/Blickrichtung des Nekromanten bei der
// Geisterbombe). KEIN tank-Parameter mehr fuer die cfg -- die kommt
// ausschliesslich aus resolveGhostCfg(), s. Kopfkommentar.
//
// Geisterkommandant (Phase 8): IMMER genau EIN lebender Geist ist der
// Kommandant -- die Zuweisung passiert hier bei der Erzeugung (nicht
// nachtraeglich), gedeckelt ueber die state.ghosts-Pruefung. Lich-Panzer
// erhoeht denselben Multiplikator additiv (ghostCommanderMultBonus).
export function createGhost(state, x, y, heading = 0) {
  const playerCfg = state.player?.cfg;
  const cfg = resolveGhostCfg(state.data, playerCfg);
  const isCommander =
    !!playerCfg?.ghostCommander && !state.ghosts.some((g) => g.alive && g.isCommander);
  if (isCommander) {
    const bal = state.data.balance?.ghost || {};
    const bonus = playerCfg.ghostCommanderMultBonus || 0;
    cfg.maxHp = Math.round(cfg.maxHp * ((bal.commanderHpMult ?? 2.5) + bonus));
    cfg.damage = Math.round(cfg.damage * ((bal.commanderDamageMult ?? 2) + bonus));
  }
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
    isCommander, // Phase 8: Geisterkommandant
    commanderShieldUsed: false, // Phase 8: Phylakterium (einmal pro Raum)
    reviveUsesLeft: null, // Phase 8: Wiederkehr/Unsterbliche Seele (lazy init)
    reviveGrowthStacks: 0, // Phase 8: Ewige Wiederkehr
  };
}

// Wiederkehr/Unsterbliche Seele/Ewige Wiederkehr (Phase 8): Wiederbelebungs-
// Chance beim Tod. reviveUsesLeft wird beim ERSTEN Tod aus dem aktuellen cfg
// gelesen (Unsterbliche Seele erhoeht ghostReviveMaxUses ueber 1) -- danach
// zaehlt es unabhaengig vom cfg weiter, ein spaeter verlorenes Upgrade kann
// eine schon laufende Wiederbelebungskette nicht mehr aendern (es gibt keinen
// Weg, ein Upgrade zu verlieren, aber die Reihenfolge ist damit robust).
// Ewige Wiederkehr macht den WIEDERBELEBTEN Geist dauerhaft staerker --
// skaliert vom urspruenglichen Basiswert, nicht kumulativ vom letzten Stand,
// sonst waere es exponentielles statt lineares Wachstum je Wiedergeburt.
function tryReviveGhost(state, g) {
  const cfg = state.player?.cfg;
  if (!cfg?.ghostReviveChance) return false;
  if (g.reviveUsesLeft == null) g.reviveUsesLeft = cfg.ghostReviveMaxUses ?? 1;
  if (g.reviveUsesLeft <= 0) return false;
  const chance = Math.min(0.9, cfg.ghostReviveChance);
  if (state.rng() >= chance) return false;
  g.reviveUsesLeft--;
  if (cfg.ghostReviveGrowth) {
    if (g.reviveBaseMaxHp == null) {
      g.reviveBaseMaxHp = g.cfg.maxHp;
      g.reviveBaseDamage = g.cfg.damage;
    }
    g.reviveGrowthStacks++;
    const mult = 1 + cfg.ghostReviveGrowth * g.reviveGrowthStacks;
    g.cfg.maxHp = Math.round(g.reviveBaseMaxHp * mult);
    g.cfg.damage = Math.round(g.reviveBaseDamage * mult);
  }
  g.hp = g.cfg.maxHp;
  return true;
}

// Letzter Wille (Phase 8): ein sterbender Geist reisst Gegner in seiner Naehe
// mit -- reine Wiederverwendung von mine.js: explodeAt() (dieselbe Explosion
// wie eine Mine/ein Sprengschuss), `spare: state.player` haelt den
// Nekromanten selbst aus seiner eigenen Todeszone heraus.
function spawnDeathZone(state, g) {
  const cfg = state.player?.cfg;
  if (!cfg?.ghostDeathZoneRadius) return;
  explodeAt(
    state,
    g.x,
    g.y,
    cfg.ghostDeathZoneRadius,
    state.player,
    { code: 'ghost_death_zone', killer: state.player },
    cfg.ghostDeathZoneDamage || 0,
    'explosive',
  );
}

// Einziger Tod-Trichter (Anhang B S13/S17): "der Basistod besitzt keinen
// zusaetzlichen Spezialeffekt" -- der reine Basistod bleibt ein simpler
// alive=false-Setter, Phase 8 haengt die drei Signatur-Todes-Mechaniken
// (Phylakterium, Wiederkehr-Familie, Letzter Wille) genau hier ein, statt
// sie an den beiden Aufrufstellen (Zeitablauf hier, Geschoss-Kollision in
// state.js) getrennt zu behandeln. Idempotent wie killTank() (Doppeltod im
// selben Frame moeglich: Kettenreaktionen, gleichzeitige Treffer).
export function killGhost(state, g) {
  if (!g.alive) return;
  const cfg = state.player?.cfg;
  // Phylakterium: der Kommandant uebersteht EINMAL pro Raum einen toedlichen
  // Treffer -- eigener, von Wiederkehr unabhaengiger Schutz (verbraucht
  // keine Wiederbelebungs-Ladung).
  if (g.isCommander && cfg?.ghostCommanderShield && !g.commanderShieldUsed) {
    g.commanderShieldUsed = true;
    const frac = state.data.balance?.ghost?.commanderShieldHealFraction ?? 0.5;
    g.hp = Math.max(1, Math.round(g.cfg.maxHp * frac));
    return;
  }
  if (tryReviveGhost(state, g)) return;
  g.alive = false;
  spawnDeathZone(state, g);
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
  const playerCfg = state.player?.cfg;
  // Rudelgeist/Armee der Toten (Phase 8): dynamischer Rudelbonus -- haengt
  // von der AKTUELLEN Anzahl lebender Geister ab, wird deshalb NICHT in die
  // cfg gebacken (die aendert sich sonst nie nach der Erzeugung), sondern
  // je Schuss neu berechnet.
  const aliveCount = state.ghosts.reduce((n, x) => n + (x.alive ? 1 : 0), 0);
  const packMult = 1 + (playerCfg?.ghostPackDamagePerAlly || 0) * Math.max(0, aliveCount - 1);
  for (const g of state.ghosts) {
    // Anhang B S6: KEIN Lebensdauer-Timer -- ein Geist lebt bis zum Tod oder
    // bis der Raum endet (state.ghosts wird bei jedem neuen Raum ohnehin
    // frisch mit [] angelegt, s. state.js: createState()). Nur noch die
    // hp<=0-Pruefung bleibt (Kollisionstreffer rufen killGhost() direkt,
    // diese Zeile faengt den seltenen Fall ab, dass ein Statuseffekt-Tick
    // o. ae. die hp zwischen zwei Kollisionsschleifen unter 0 gedrueckt hat).
    if (!g.alive) continue;
    if (g.hp <= 0) {
      killGhost(state, g);
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
          owner: g,
          kind: g.cfg.weapon,
          damage: Math.round(g.cfg.damage * packMult),
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
