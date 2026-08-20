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
import { onGhostRemoved, addNecroStack, getNecroStack } from './necro.js';
import { flankZone } from './armor.js';

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
  // Nekromant-V2 Phase 7 Fund: ghostHpMult/ghostDamageMult wurden seit
  // Upgradepool-v2 Phase 8 in cfg.js gesammelt, aber NIE hier gelesen -- ein
  // reiner Blindgaenger, unbemerkt, weil die einzigen Karten, die sie
  // setzten (sig_necro_*), seit Grundsteinumbau Phase 4 archiviert sind.
  // ghost_060 "Armee der Toten" ist die erste seither wieder ERREICHBARE
  // Karte, die ghostDamageMult setzt -- Fix: additiv (Add), DANACH
  // multiplikativ (Mult), wie beim generischen Applier-Muster ueberall sonst.
  const maxHp = Math.round((Math.round(base.maxHp * pct) + (playerCfg?.ghostHpAdd || 0)) * (playerCfg?.ghostHpMult || 1));
  const damage = Math.round((Math.round(base.damage * pct) + (playerCfg?.ghostDamageAdd || 0)) * (playerCfg?.ghostDamageMult || 1));
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
    // gleich, unabhaengig von dessen eigener Waffenreichweite. ghost_006
    // "Grabesoptik" (Nekromant-V2 Phase 6) skaliert BEIDE Werte gleichzeitig.
    fireRangePx: (data.balance?.bullet?.maxDistance ?? 1200) * (gbal.rangePct ?? 0.65) * (playerCfg?.ghostRangeMult || 1),
    // Nekromant-V2 Phase 6: weitere ghost*-core-Schluessel, additiv/
    // multiplikativ genau wie die vier obigen aus Upgradepool-v2 Phase 8.
    bulletSpeed: base.bulletSpeed * (playerCfg?.ghostBulletSpeedMult || 1),
    critChance: (base.critChance || 0) + (playerCfg?.ghostCritChanceAdd || 0),
    critMultBonus: playerCfg?.ghostCritMultAdd || 0,
    resist: (base.resist || 0) + (playerCfg?.ghostResistAdd || 0),
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
// `overrides` (Nekromant-V2 Phase 7, NEU): { baseStatPctOverride?, slotCost? }
// -- ghost_052/056/060 erzeugen Kopien mit einem ANDEREN Basiswert-Anteil als
// dem normalen `balance.ghost.baseStatPct` (Auftrag: "60/65/50 % Basiswert-
// Anteil"), ohne die ganze resolveGhostCfg()-Rechnung ein zweites Mal zu
// implementieren -- dieselbe Skalierungs-Ratio wie ghost_033 (Phase 6):
// `neuerPct / normalerPct` auf die bereits aufgeloesten maxHp/damage.
export function createGhost(state, x, y, heading = 0, sourceType, overrides) {
  const playerCfg = state.player?.cfg;
  const cfg = resolveGhostCfg(state.data, sourceType, playerCfg);
  const gbal0 = state.data.balance?.ghost || {};
  if (overrides?.baseStatPctOverride) {
    const scale = overrides.baseStatPctOverride / (gbal0.baseStatPct ?? 0.5);
    cfg.maxHp = Math.max(1, Math.round(cfg.maxHp * scale));
    cfg.damage = Math.max(1, Math.round(cfg.damage * scale));
  }
  const isCommander =
    !!playerCfg?.ghostCommander && !state.ghosts.some((g) => g.alive && g.isCommander);
  if (isCommander) {
    const bal = state.data.balance?.ghost || {};
    const bonus = playerCfg.ghostCommanderMultBonus || 0;
    cfg.maxHp = Math.round(cfg.maxHp * ((bal.commanderHpMult ?? 2.5) + bonus));
    cfg.damage = Math.round(cfg.damage * ((bal.commanderDamageMult ?? 2) + bonus));
  }
  // ghost_005 "Laengerer Eid" (Nekromant-V2 Phase 6): additiv zur festen
  // Basislebenszeit -- direkt hier statt in resolveGhostCfg(), weil
  // lifetime/lifetimeMax keine cfg-Felder sind, sondern eigene Ghost-Felder.
  const lifetimeMax = (state.data.balance?.ghost?.lifetimeS ?? 12) + (playerCfg?.ghostLifetimeAdd || 0);
  // ghost_059 "Grabfeld" (Nekromant-V2 Phase 7): erscheint ein Untertan an
  // einem der letzten 3 gemerkten Sterbeorte (state.necroGraveyardSpots,
  // raumweit, befuellt von necro.js: buildNecroListeners()), wird er staerker.
  // Radius in data/balance.json (kein Kartentextwert -- "dort" ist vage).
  let graveMaxHp = cfg.maxHp;
  let graveDamage = cfg.damage;
  if (playerCfg?.necroGraveyardBonus && state.necroGraveyardSpots?.length) {
    const r = gbal0.graveyardRadiusPx ?? 40;
    const near = state.necroGraveyardSpots.some((s) => Math.hypot(s.x - x, s.y - y) <= r);
    if (near) {
      graveMaxHp = Math.round(cfg.maxHp * (1 + playerCfg.necroGraveyardBonus));
      graveDamage = Math.round(cfg.damage * (1 + playerCfg.necroGraveyardBonus));
    }
  }
  cfg.maxHp = graveMaxHp;
  cfg.damage = graveDamage;
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
    // startet voll (shieldMax). ghost_008 "Schattenschild" (Phase 6) legt
    // zusaetzlich einen EINMALIGEN Spawn-Schild oben drauf (kann den
    // shieldMax-Deckel ueberschreiten -- regeneriert dann nur bis shieldMax
    // zurueck, sobald verbraucht).
    shield: (cfg.shieldMax || 0) + (playerCfg?.ghostShieldOnSpawnPct ? cfg.maxHp * playerCfg.ghostShieldOnSpawnPct : 0),
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
    // Nekromant-V2 Phase 7 (Legion): wie viele Geisterplaetze dieser Untertan
    // belegt -- normal 1, ghost_056 (wiederbelebte Elite) setzt 2. Ueberall,
    // wo gegen das Geisterlimit geprueft wird, zaehlt die SUMME dieses Feldes
    // (occupiedGhostSlots()), nicht mehr die reine Anzahl.
    slotCost: overrides?.slotCost || 1,
    isVeteran: false, // ghost_046: einmalige Befoerderung nach necroVeteranAfterS
    hullUsed: false, // ghost_053: ignoriert einmal je Leben einen grossen Treffer
    lastDamageAt: -1e9, // ghost_048: Schildwall laedt erst X s nach dem letzten Treffer
    legionBulletBuffs: [], // ghost_051: "naechste 5 Schuesse" je Untertan, analog player.necroBulletBuffs
    isOfficer: false, // ghost_049: dynamisch (aeltester lebender Untertan), jeden Tick neu
    legionAuraResist: 0, // ghost_038/042: dynamisch aus der Legion-Neuberechnung/Naehe-Aura
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
  // Nekromant-V2 Phase 5 (Ereignis-/Stapelschicht): zentrales Ereignis fuer
  // JEDEN echten Geistertod -- NACH den beiden obigen "ueberlebt doch"-
  // Zweigen, ein geretteter Geist ist kein Geistertod. cause ('damage'/
  // 'expire') ist 1:1 die Auslöser-Tabelle aus dem Auftrag.
  onGhostRemoved(state, g, cause === 'expire' ? 'death_expire' : 'death_damage');
  // Nekromant-V2 Phase 7 (Legion): killGhost() ist der EINZIGE Entfernungs-
  // Trichter (Schaden UND Ablauf) -- die "bei Spawn UND Entfernen neu
  // berechnen, NICHT pro Frame"-Vorgabe des Auftrags braucht deshalb nur
  // hier UND an den (zwei) Erzeugungsstellen einen Aufruf.
  recomputeLegionCache(state);
}

// Nekromant-V2 Phase 7 (Legion, ghost_056 "Elite-Reaktivierung"): Summe
// belegter Geisterplaetze statt der reinen Anzahl -- ein wiederbelebter
// Elite-Untertan belegt 2 (g.slotCost), jeder andere 1.
export function occupiedGhostSlots(state) {
  let n = 0;
  for (const g of state.ghosts) if (g.alive) n += g.slotCost || 1;
  return n;
}

// Nekromant-V2 Phase 7 (Legion): "Zaehlerbasierte Skalierung ... neu
// berechnen bei Spawn und Entfernen, NICHT pro Frame" -- diese Funktion ist
// der EINZIGE Ort, der die reinen ZAEHLER-Karten (038/039/040/045) neu
// bewertet, aufgerufen ausschliesslich von den Erzeugungs-/Entfernungs-
// Stellen (killGhost() oben, tank.js: spawnGhostBomb(), state.js:
// killTank()s Wiederbelebungs-Block, state.js: der ghost_033-Raumstart-Hook).
// Abstandsauren (042/048/049) sind bewusst NICHT hier -- die haengen von
// Positionen ab, die sich JEDEN Tick aendern, und werden deshalb weiterhin
// live in updateGhosts() bewertet.
export function recomputeLegionCache(state) {
  const pc = state.player?.cfg;
  const aliveCount = state.ghosts.reduce((n, g) => n + (g.alive ? 1 : 0), 0);
  state.necroActiveGhostCount = aliveCount;
  // ghost_038 "Gemeinsame Ruestung": Schwellenwert-Resistenz fuer ALLE.
  state.necroLegionResistBonus =
    pc?.necroLegionResistThreshold && aliveCount >= pc.necroLegionResistThreshold ? pc.necroLegionResistAmount || 0 : 0;
  // ghost_039 "Rudelfeuer": reine Wiederverwendung von ghostPackDamagePerAlly
  // (Upgradepool-v2 Phase 8) -- war bisher JEDEN Tick in updateGhosts()
  // berechnet, jetzt hierher verschoben (Auftrag: "nicht pro Frame").
  state.necroPackMult = 1 + (pc?.ghostPackDamagePerAlly || 0) * Math.max(0, aliveCount - 1);
  // ghost_040 "Synchronverschluss": +X % Feuerrate JE aktivem Untertan
  // (sich selbst eingeschlossen) -- als reiner PROZENTSATZ gespeichert (nicht
  // schon als Multiplikator), weil updateGhosts() ihn mit weiteren additiven
  // Feuerraten-Quellen (Seelenoffizier/Munitionsaustausch) summieren muss,
  // bevor daraus EIN Cooldown-Faktor wird.
  state.necroLegionFireRatePct = (pc?.necroFireRatePerAlly || 0) * aliveCount;
  // ghost_045 "Ueberzahl": Schwellenwert-Boost auf Geschossgroesse/-tempo.
  state.necroOverwhelmActive = !!(pc?.necroOverwhelmThreshold && aliveCount >= pc.necroOverwhelmThreshold);
  // ghost_057 "Gemeinsamer Wille": Schwellenwert fuer Schadensverteilung +
  // Resistenz -- ebenfalls reine Zaehler-Bedingung, deshalb hier statt live
  // in der Kollisionsschleife neu bewertet.
  state.necroSharedWillActive = !!(pc?.necroSharedWillThreshold && aliveCount >= pc.necroSharedWillThreshold);
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
  // Rudelgeist/Armee der Toten (Phase 8) + ghost_039 "Rudelfeuer" (Phase 7):
  // wird seit Phase 7 NICHT mehr hier neu berechnet ("Zaehlerbasierte
  // Skalierung ... nicht pro Frame") -- state.necroPackMult kommt aus
  // recomputeLegionCache(), aufgerufen an den Spawn-/Entfernen-Stellen.
  const packMult = state.necroPackMult ?? 1;
  const aliveGhosts = state.ghosts.filter((x) => x.alive);

  // ---- Positions-Auren (Nekromant-V2 Phase 7) ------------------------------
  // Haengen von LIVE-Positionen ab (Geister bewegen sich jeden Tick) --
  // bewusst NICHT im Spawn/Entfernen-Cache, sondern hier jeden Tick neu
  // bewertet. Der Auftrag nennt ausdruecklich nur die reinen ZAEHLER-Karten
  // (038/039/040/045) als "nicht pro Frame" -- Auren sind etwas anderes.
  // ghost_042 "Phalanx": +Resistenz, solange ein ANDERER Untertan nahe ist.
  const phalanxR = playerCfg?.necroPhalanxRadius;
  for (const g of aliveGhosts) {
    g.legionAuraResist = 0;
    g.phalanxRingActive = false;
    if (!phalanxR) continue;
    for (const other of aliveGhosts) {
      if (other === g) continue;
      if (Math.hypot(other.x - g.x, other.y - g.y) <= phalanxR) {
        g.legionAuraResist = playerCfg.necroPhalanxResist || 0;
        g.phalanxRingActive = true;
        break;
      }
    }
  }
  // ghost_049 "Seelenoffizier": der AELTESTE lebende Untertan (kleinste id,
  // da nextGhostId streng aufsteigend vergeben wird) traegt den Ring.
  let officer = null;
  if (playerCfg?.necroOfficerRadius) {
    for (const g of aliveGhosts) if (!officer || g.id < officer.id) officer = g;
  }
  for (const g of aliveGhosts) g.isOfficer = g === officer;
  // ghost_048 "Schildwall": Naehe zum SPIELER (nicht zu anderen Untertanen).
  const wallR = playerCfg?.necroWallRadius;
  const pTank = state.player;
  for (const g of aliveGhosts) {
    g.wallInRange = !!(wallR && pTank?.alive && Math.hypot(pTank.x - g.x, pTank.y - g.y) <= wallR);
  }

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
    // ghost_048 "Schildwall" (Nekromant-V2 Phase 7): naeher als necroWallRadius
    // am Spieler UND seit necroWallRegenDelayS unbeschadet -> Schild laedt
    // Richtung necroWallShieldPct des maximalen Lebens nach.
    if (g.wallInRange && playerCfg?.necroWallShieldPct) {
      const cap = g.cfg.maxHp * playerCfg.necroWallShieldPct;
      if (g.shield < cap && state.time - (g.lastDamageAt ?? -1e9) >= (playerCfg.necroWallRegenDelayS || 0)) {
        g.shield = Math.min(cap, (g.shield || 0) + g.cfg.maxHp * (playerCfg.necroWallRegenPerS || 0) * dt);
      }
    }
    // ghost_046 "Veteranen": EINMALIGE Befoerderung nach necroVeteranAfterS
    // Sekunden Ueberleben -- lifetimeMax aendert sich nach der Erzeugung nie,
    // "verstrichene Zeit" ist deshalb einfach lifetimeMax - lifetime.
    if (playerCfg?.necroVeteranAfterS && !g.isVeteran && g.lifetimeMax - g.lifetime >= playerCfg.necroVeteranAfterS) {
      g.isVeteran = true;
      g.cfg.damage = Math.round(g.cfg.damage * (playerCfg.necroVeteranDamageMult || 1));
      const oldMax = g.cfg.maxHp;
      g.cfg.maxHp = Math.round(g.cfg.maxHp * (playerCfg.necroVeteranHpMult || 1));
      g.hp = Math.min(g.cfg.maxHp, g.hp + (g.cfg.maxHp - oldMax));
    }
    g.prevX = g.x;
    g.prevY = g.y;

    // ghost_041 "Geteiltes Ziel" (Nekromant-V2 Phase 7): alle Untertanen
    // greifen das zuletzt vom SPIELER getroffene Ziel an, solange es lebt --
    // sonst der normale naechstgelegene Gegner.
    const target =
      playerCfg?.necroSharedTarget && state.necroLastPlayerHitTarget?.alive
        ? state.necroLastPlayerHitTarget
        : nearestEnemy(state, g);
    if (g.cooldown > 0) g.cooldown -= dt;
    if (!target) {
      g.vx = 0;
      g.vy = 0;
      continue; // kein Gegner mehr im Raum
    }

    const angleToTarget = Math.atan2(target.y - g.y, target.x - g.x);
    g.turret = turnToward(g.turret, angleToTarget, TURN_SPEED * dt);
    g.heading = g.turret; // Rohr zeigt immer aufs Ziel, unabhaengig vom Bewegungskurs unten

    // ghost_010 "Jenseitsziel" (Phase 6) UND ghost_041 "Geteiltes Ziel"
    // (Phase 7, "...und umfahren es zur ungeschuetzten Seite"): beide teilen
    // sich denselben Flankier-Bewegungspfad. Fester Seitenwert je Geist
    // (g.id), damit er nicht jeden Tick die Seite wechselt. Nur die
    // BEWEGUNGSrichtung weicht ab, das Rohr bleibt oben wie gehabt auf
    // angleToTarget ausgerichtet (Feuer-Kegel unveraendert).
    let moveAngle = g.heading;
    if ((playerCfg?.ghostFlankSeek || playerCfg?.necroSharedTarget) && typeof target.heading === 'number') {
      const side = g.id % 2 === 0 ? 1 : -1;
      const flankX = target.x + Math.cos(target.heading + Math.PI / 2) * side * 70 - Math.cos(target.heading) * 40;
      const flankY = target.y + Math.sin(target.heading + Math.PI / 2) * side * 70 - Math.sin(target.heading) * 40;
      moveAngle = Math.atan2(flankY - g.y, flankX - g.x);
    }
    const dx = Math.cos(moveAngle);
    const dy = Math.sin(moveAngle);
    // Fuer den Mündungspunkt/die Feuerrichtung zaehlt weiterhin g.heading
    // (Turmrichtung), NICHT die (bei ghost_010 abweichende) Bewegungsrichtung.
    const aimDx = Math.cos(g.heading);
    const aimDy = Math.sin(g.heading);
    // ghost_047 "Sturmformation" (Nekromant-V2 Phase 7, isUnique): solange
    // ein Untertan sein Ziel verfolgt (praktisch immer -- Basisverhalten ist
    // reine Verfolgung), gilt der Anflug-Tempobonus.
    const stormSpeedMult = playerCfg?.necroStormApproachSpeedMult || 1;
    g.x += dx * g.cfg.speed * stormSpeedMult * dt;
    g.y += dy * g.cfg.speed * stormSpeedMult * dt;
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
      // ghost_007 "Totenpraezision" (Nekromant-V2 Phase 6): eigener Krit-Wurf
      // fuer Geistergeschosse -- g.cfg.critChance/critMultBonus kommen aus
      // resolveGhostCfg() (playerCfg.ghostCritChanceAdd/-MultAdd).
      const ghostCrit = g.cfg.critChance > 0 && state.rng() < g.cfg.critChance;
      // ghost_049 "Seelenoffizier": Schaden-/Feuerratenbonus fuer ALLE
      // ANDEREN Untertanen innerhalb des Radius (nicht fuer den Offizier selbst).
      let officerDmgMult = 1;
      let officerFireRatePct = 0;
      if (officer && g !== officer && Math.hypot(officer.x - g.x, officer.y - g.y) <= (playerCfg?.necroOfficerRadius || 0)) {
        officerDmgMult = playerCfg.necroOfficerDamageMult || 1;
        officerFireRatePct = playerCfg.necroOfficerFireRateBonus || 0;
      }
      // ghost_047 "Sturmformation": zusaetzlicher Bonus, sobald der Untertan
      // die Seite/das Heck des Ziels erreicht hat (dieselbe flankZone()-
      // Geometrie wie die Spieler-Trefferschleife in state.js, hier gegen
      // die ZIEL-Ausrichtung gemessen).
      let stormDmgMult = playerCfg?.necroStormApproachDamageMult || 1;
      if (playerCfg?.necroStormFlankBonus && typeof target.heading === 'number') {
        const flankCfg = state.data.balance?.flank;
        if (flankCfg && flankZone(target, g.x, g.y, flankCfg) !== 'front') {
          stormDmgMult *= 1 + playerCfg.necroStormFlankBonus;
        }
      }
      // ghost_054 "Legionskern": +X % Schaden bis Raumende fuer ALLE
      // Untertanen, sobald der Effekt einmal ausgeloest wurde.
      const kernMult = state.necroLegionKernActive ? 1 + (playerCfg?.necroCoreDamageBonus || 0) : 1;
      // ghost_060 "Armee der Toten"/allgemeine ghostDamageMult-Karten wirken
      // bereits ueber g.cfg.damage (resolveGhostCfg()) -- hier nur die
      // dynamischen, NICHT in die cfg gebackenen Legion-Multiplikatoren.
      let dmg = Math.round(g.cfg.damage * packMult * officerDmgMult * stormDmgMult * kernMult);
      // ghost_051 "Erbmunition": "naechste 5 Schuesse" je Untertan, analog
      // player.necroBulletBuffs -- konsumiert EINMAL pro Abzug.
      if (g.legionBulletBuffs?.length) {
        let buffMult = 1;
        for (const buff of g.legionBulletBuffs) if (buff.damageMult) buffMult *= buff.damageMult;
        dmg = Math.round(dmg * buffMult);
        for (const buff of g.legionBulletBuffs) buff.shotsLeft--;
        g.legionBulletBuffs = g.legionBulletBuffs.filter((b) => b.shotsLeft > 0);
      }
      // ghost_045 "Ueberzahl": groessere/schnellere Geschosse ab der Schwelle.
      const overwhelm = state.necroOverwhelmActive;
      state.bullets.push(
        createBullet(g.x + aimDx * muzzle, g.y + aimDy * muzzle, g.turret, {
          speed: g.cfg.bulletSpeed * (overwhelm ? playerCfg.necroOverwhelmBulletSpeedMult || 1 : 1),
          radius: state.data.physics.bulletRadius * (overwhelm ? playerCfg.necroOverwhelmBulletSizeMult || 1 : 1),
          owner: g,
          kind: g.cfg.weapon,
          damage: dmg,
          damageType: g.cfg.damageType,
          crit: ghostCrit,
          // KEIN critMultBonus hier: g.cfg.critMultBonus wird bereits ueber
          // oc?.critMultBonus (b.owner.cfg) in state.js gelesen -- ein
          // weiteres Feld auf der Kugel wuerde denselben Bonus doppelt
          // zaehlen. Das Kugel-Feld ist nur fuer den SPIELER da (dessen
          // Krit-Bonus ist eine Einmal-Ladung, nicht Teil der Dauer-cfg).
        }),
      );
      // Feuerrate: Zaehler-Cache (040) + Offizier-Aura (049) additiv als
      // Prozentsaetze summiert, dann EIN Cooldown-Faktor. ghost_050
      // "Munitionsaustausch" erhoeht danach den raumweiten, gedeckelten
      // Stapel fuer den NAECHSTEN Schuss (wirkt erst auf folgende Schuesse).
      const ammoExchangePct = getNecroStack(state, 'room', '_legionAmmoExchange');
      const fireRatePct = (state.necroLegionFireRatePct || 0) + officerFireRatePct + ammoExchangePct;
      g.cooldown = g.cfg.fireCooldown * Math.max(0.1, 1 - fireRatePct);
      if (playerCfg?.necroAmmoExchangePerShot) {
        const cap = playerCfg.necroAmmoExchangeCap || 0;
        const cur = getNecroStack(state, 'room', '_legionAmmoExchange');
        if (cur < cap) addNecroStack(state, 'room', '_legionAmmoExchange', Math.min(playerCfg.necroAmmoExchangePerShot, cap - cur));
      }
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
