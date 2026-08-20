// Geisterpanzer/Untertanen -- Nekromant-V2 Phase 3 (Geisterpanzer-Basis):
// GRUNDLEGEND NEU gegenueber dem Vorgaengermodul (Upgradepool-v2 Phase 7,
// dort "eigener, fester Basiseinheiten-Typ ghost_tank, kein Stat-Erbe").
// Diese Phase kehrt das explizit um: ein Untertan erbt jetzt den vollen TYP
// des getoeteten Gegners (Rolle/Waffe/Panzerung/Tempo/Zielgenauigkeit --
// alles, was resolveCfg(data, sourceType) liefert), nur maxHp/damage werden
// auf einen Anteil (data/balance.json: ghost.baseStatPct) gestutzt. Der
// feste `ghost_tank`-Typ UND die alte zweistufige spawnChance sind
// archiviert (archive/ghost-tank-v1.json, ARCHIV.md). Die beiden Erzeuger
// reichen deshalb jetzt zusaetzlich den Quelltyp durch: state.js:
// killTank()s Spawnwuerfel den Typ des getoeteten Gegners, tank.js:
// spawnGhostBomb()s Geisterbombe einen zufaelligen Typ aus dem aktuellen
// Akt-Gegnerpool (state.actEnemyPool, run.js: unlockedEnemyTypes()).
//
// Zwei weitere NEUE Mechaniken dieser Phase: eine Lebensdauer
// (ghost.lifetimeS, ein ANDERER Todes-Ausloeser als Schaden -- sichtbar als
// schrumpfender Ring) und ein dynamisch berechneter "Champion" (der
// aktuell staerkste lebende Untertan nach ghost.strengthWeights, JEDEN
// updateGhosts()-Tick neu bestimmt, KEIN Kartengate) -- NICHT zu verwechseln
// mit dem folgenden, aelteren, kartengebundenen `isCommander`-Mechanismus.
//
// Upgradepool-v2 Phase 8 (Signaturtopf Nekromant): die 18 sig_necro_*-Karten
// wirkten NICHT auf den Spieler selbst, sondern ueber ghost*-core-Schluessel
// (cfg.js) auf die Geistereinheit -- resolveGhostCfg() liest sie weiterhin
// aus dem aufgeloesten Spieler-cfg. Diese Karten existieren seit dem
// Grundsteinumbau (Phase 4: "Upgrades raus, Sockel rein") nicht mehr im
// aktiven Pool -- `isCommander`/`ghostReviveChance`/`ghostDeathZoneRadius`
// und die zugehoerige Logik (tryReviveGhost/spawnDeathZone/Phylakterium)
// sind deshalb AKTUELL TOT (kein Upgrade setzt ihre cfg-Felder mehr), bleiben
// aber bewusst UNVERAENDERT stehen als Wiederanschlusspunkt fuer Phase 8
// dieses Auftrags ("Alpha und Verschmelzung") -- killGhost() bleibt ihr
// einziger Tod-Trichter, jetzt erweitert um den neuen Lebensdauer-Ablauf.

import { angleDiff, turnToward, clearLine } from './ai.js';
import { resolveCircleWalls } from './collision.js';
import { createBullet } from './bullet.js';
import { resolveCfg } from './cfg.js';
import { explodeAt } from './mine.js';

const TURN_SPEED = 4; // rad/s -- Drehen von Rumpf UND Turm Richtung Ziel
const FIRE_CONE = 0.15; // rad -- muss so genau ausgerichtet sein, um zu feuern

let nextGhostId = 1;

// Typ-Vererbung (Nekromant-V2 Phase 3, Auftrag Abschnitt 3): baut auf der
// VOLLEN aufgeloesten cfg des Quelltyps auf (resolveCfg -- dieselbe
// Funktion, die auch echte Panzer aufloest, "keine Parallelsysteme" wie
// Anhang A S16 es fuer den Vorgaenger schon verlangte). Rolle, Waffe,
// Panzerung, Zielgenauigkeit, Geschosstempo, Magazin, Nachladen usw. bleiben
// dadurch UNVERAENDERT der Wert des geerbten Typs -- nur maxHp/damage werden
// auf `baseStatPct` gestutzt (Auftrag: "ein Untertan ist eine geschwaechte
// Kopie, kein Vollwert-Klon"). `sourceType` fehlt nie (state.js/tank.js
// reichen immer einen echten Gegnertyp durch), ein Fallback ist trotzdem
// robust gegen kuenftige Aufrufer.
// `playerCfg` (aufgeloestes cfg des spielenden Nekromanten) legt die
// ghost*-core-Werte (Upgradepool-v2 Phase 8: ghostHpAdd/ghostDamageAdd/
// ghostSpeedMult/ghostFireMult) additiv/multiplikativ oben drauf --
// unveraendert seit dem Vorgaengermodul, nur die Basis darunter ist jetzt
// typabhaengig statt fest.
function resolveGhostCfg(data, sourceType, playerCfg) {
  const base = resolveCfg(data, sourceType || 'player');
  const gbal = data.balance?.ghost || {};
  const pct = gbal.baseStatPct ?? 0.5;
  const maxHp = Math.round(base.maxHp * pct) + (playerCfg?.ghostHpAdd || 0);
  const damage = Math.round(base.damage * pct) + (playerCfg?.ghostDamageAdd || 0);
  // base.armor/base.role/base.accuracy usw. wandern per Spread unveraendert
  // mit -- sie stehen im aufgeloesten cfg, werden von der Geister-eigenen
  // Kollisionsschleife (state.js, direkt vor updateGhosts()) aber bewusst
  // NICHT ausgewertet (dort seit Upgradepool-v2 Phase 5 dokumentiert: die
  // Panzerungs-/Krit-/Kopfschuss-Logik ist auf echte Panzer zugeschnitten).
  // Ein geerbter t_armored-Untertan traegt die Panzerung also sichtbar in
  // seiner cfg, ist aber (noch) nicht dadurch geschuetzt -- kein Regress,
  // dieselbe Einschraenkung galt schon fuer den alten festen ghost_tank-Typ
  // (armor:null), jetzt nur mit einem nicht-leeren, aber wirkungslosen Feld.
  return {
    ...base,
    maxHp,
    damage,
    fireCooldown: base.fireCooldown * (playerCfg?.ghostFireMult || 1),
    speed: base.speed * (playerCfg?.ghostSpeedMult || 1),
    // Feuer-SCHWELLE (nicht die Geschossreichweite selbst -- die bleibt der
    // normale Wegbudget-Wert aus balance.bullet.maxDistance): ein Geist
    // schiesst erst innerhalb dieser Distanz, verfolgt sein Ziel aber
    // unbegrenzt weit. War bis Phase 2 dieses Auftrags ein Feld des jetzt
    // archivierten ghost_tank-Typs, jetzt ein einzelner geteilter Wert
    // (data/balance.json: ghost.rangePct) -- gilt fuer jeden geerbten Typ
    // gleich, unabhaengig von dessen eigener Waffenreichweite.
    fireRangePx: (data.balance?.bullet?.maxDistance ?? 1200) * (gbal.rangePct ?? 0.65),
  };
}

// x, y, heading = wo/wie der Geist entsteht (Kill-Position des getoeteten
// Gegners bzw. Position/Blickrichtung des Nekromanten bei der
// Geisterbombe). sourceType (Nekromant-V2 Phase 3, NEU) = der geerbte
// Gegnertyp -- state.js: killTank() reicht den Typ des getoeteten Gegners
// durch, tank.js: spawnGhostBomb() einen zufaelligen Typ aus dem aktuellen
// Akt-Gegnerpool. Faellt niemals weg (beide Erzeuger liefern immer einen
// echten Typ), der Fallback 'player' in resolveGhostCfg() ist nur ein
// Sicherheitsnetz.
//
// Geisterkommandant (aelterer, kartengebundener Mechanismus, Upgradepool-v2
// Phase 8 -- s. Kopfkommentar Datei: aktuell TOT, kein Upgrade setzt
// ghostCommander mehr, bleibt aber unveraendert als Wiederanschlusspunkt).
// NICHT zu verwechseln mit dem NEUEN, dynamischen isChampion (updateGhosts(),
// jeden Tick neu berechnet, kein Kartengate).
export function createGhost(state, x, y, heading = 0, sourceType) {
  const playerCfg = state.player?.cfg;
  const cfg = resolveGhostCfg(state.data, sourceType, playerCfg);
  const isCommander =
    !!playerCfg?.ghostCommander && !state.ghosts.some((g) => g.alive && g.isCommander);
  if (isCommander) {
    const bal = state.data.balance?.ghost || {};
    const bonus = playerCfg.ghostCommanderMultBonus || 0;
    cfg.maxHp = Math.round(cfg.maxHp * ((bal.commanderHpMult ?? 2.5) + bonus));
    cfg.damage = Math.round(cfg.damage * ((bal.commanderDamageMult ?? 2) + bonus));
  }
  const lifetimeMax = state.data.balance?.ghost?.lifetimeS ?? 12;
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
    type: sourceType || 'player', // Typ-Vererbung (Phase 3) -- fuer Sprites/Telemetrie/DEBRIS_COLORS
    cfg,
    hp: cfg.maxHp,
    // Nekromant-V2 Phase 2: derselbe Schild-Punktepool wie bei echten
    // Panzern (state.js: applyResistToAmount/absorbWithShieldPool) --
    // startet voll, aktuell ueberall 0.
    shield: cfg.shieldMax || 0,
    cooldown: 0,
    isGhost: true,
    alive: true,
    // Lebensdauer (Phase 3, NEU): ein ANDERER Todes-Ausloeser als Schaden --
    // updateGhosts() zaehlt lifetime pro Tick herunter, killGhost() wird beim
    // Erreichen von 0 ueber einen eigenen 'expire'-cause aufgerufen (s. dort).
    // lifetimeMax bleibt fuer die Ring-Anzeige (renderer.js) erhalten.
    lifetime: lifetimeMax,
    lifetimeMax,
    // Basiswerte VOR jeder Wiederkehr-Skalierung (Phase 8s Ewige Wiederkehr
    // liest reviveBaseMaxHp/-Damage lazy -- die beiden hier sind zusaetzlich
    // fuer eine kuenftige Verschmelzung (Auftrag Phase 8 "Alpha und
    // Verschmelzung") vorbereitet, die mehrere Untertanen zu einem staerkeren
    // zusammenlegen wird und dafuer die UNVERAENDERTEN Ausgangswerte braucht).
    baseMaxHp: cfg.maxHp,
    baseDamage: cfg.damage,
    baseFireCooldown: cfg.fireCooldown,
    isCommander, // Phase 8 (kartengebunden, aktuell tot): Geisterkommandant
    isChampion: false, // Phase 3 (NEU, dynamisch): wird in updateGhosts() jeden Tick neu gesetzt
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
//
// `cause` (Phase 3, NEU): 'damage' (Standard) oder 'expire' (Lebensdauer
// abgelaufen, s. updateGhosts()) -- ein friedlich "verblasster" Untertan
// loest bewusst KEINE der drei kartengebundenen Todes-Mechaniken aus (ein
// Phylakterium/eine Wiederkehr wuerde sonst die Lebensdauer selbst
// bedeutungslos machen: ein Untertan waere effektiv unsterblich, solange nur
// niemand ihn erschiesst). Nur ein toedlicher TREFFER zaehlt fuer sie.
export function killGhost(state, g, cause = 'damage') {
  if (!g.alive) return;
  const cfg = state.player?.cfg;
  if (cause === 'damage') {
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
  }
  g.alive = false;
  if (cause === 'damage') spawnDeathZone(state, g);
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
    if (!g.alive) continue;
    // Lebensdauer (Phase 3, NEU -- ersetzt Anhang B S6 "KEIN Lebensdauer-
    // Timer" bewusst, s. Kopfkommentar Datei): ein ANDERER Todes-Ausloeser
    // als Schaden, deshalb ueber den eigenen 'expire'-cause statt der
    // normalen hp<=0-Pruefung darunter (killGhost() ueberspringt dabei die
    // drei kartengebundenen Todes-Mechaniken, s. dort). state.ghosts wird bei
    // jedem neuen Raum ohnehin frisch mit [] angelegt (state.js:
    // createState()) -- die Lebensdauer ist also ein zusaetzliches, kein
    // ersetzendes Limit innerhalb desselben Raums.
    g.lifetime -= dt;
    if (g.lifetime <= 0) {
      killGhost(state, g, 'expire');
      continue;
    }
    // hp<=0-Pruefung: Kollisionstreffer rufen killGhost() direkt, diese Zeile
    // faengt den seltenen Fall ab, dass ein Statuseffekt-Tick o. ae. die hp
    // zwischen zwei Kollisionsschleifen unter 0 gedrueckt hat.
    if (g.hp <= 0) {
      killGhost(state, g);
      continue;
    }
    // Nekromant-V2 Phase 2: Schild-Pool-Regeneration, dasselbe Muster wie
    // bei echten Panzern (state.js, Tank-Tick-Schleife).
    if (g.cfg.shieldRegenPerS && g.shield < g.cfg.shieldMax) {
      g.shield = Math.min(g.cfg.shieldMax, (g.shield || 0) + g.cfg.shieldRegenPerS * dt);
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
    // Typ-Vererbung (Phase 3): der Untertan feuert IMMER ein normales
    // Geschoss, unabhaengig davon, welche Waffe sein Quelltyp eigentlich
    // hat (`g.cfg.weapon`/`g.cfg.damageType` faerben nur Anzeige/Schadenstyp
    // ein). Ein geerbter Moerser (t_green) legt hier bewusst KEINE Granate --
    // fireMortar() braucht ein volles KI-Zielobjekt (resolveTarget() liest
    // tank.ai.target) und wuerde bei einem Geist ohne .ai IMMER auf den
    // Spieler zielen (sein eigener state.player-Fallback), also den
    // Nekromanten selbst beschiessen. Volle Waffen-Portierung ist bewusst
    // NICHT Teil dieser Phase (Basis), s. CLAUDE.md To-do.
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
  // Champion (Phase 3, NEU): dynamisch, JEDEN Tick ueber die tatsaechlich
  // ueberlebenden Geister neu bestimmt -- kein Kartengate, im Unterschied
  // zum aelteren isCommander oben. strengthWeights aus data/balance.json:
  // ghost (LIVE-hp*weights.hp + damage*weights.damage -- ein angeschlagener
  // Untertan kann den Titel dadurch wieder verlieren). Gleichstand gewinnt
  // der AELTERE (Array-/Erzeugungsreihenfolge, striktes '>' statt '>=': ein
  // gleich starker juengerer Untertan verdraengt den amtierenden Champion
  // nicht).
  const weights = state.data.balance?.ghost?.strengthWeights || {};
  let champion = null;
  let bestStrength = -Infinity;
  for (const g of state.ghosts) {
    const strength = g.hp * (weights.hp ?? 0) + g.cfg.damage * (weights.damage ?? 0);
    if (strength > bestStrength) {
      bestStrength = strength;
      champion = g;
    }
  }
  for (const g of state.ghosts) g.isChampion = g === champion;
}
