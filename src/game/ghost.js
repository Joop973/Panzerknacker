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
// schrumpfender Ring) und ein Champion.
//
// Champion-Ueberarbeitung (Auftrag "Nekromanten-/Champion-/Verschmelzungs-
// system"): der Champion ist jetzt eine EIGENSTAENDIGE, dauerhafte Einheit
// statt einer dynamisch neu bewerteten Markierung. isChampion ist STICKY --
// wird genau EINMAL ueber promoteToChampion() gesetzt (Auftrag Abschnitt 2.1)
// und bleibt bestehen, bis der Traeger stirbt. KEINE per-Tick-Neubewertung
// mehr: ein bereits lebender Champion wird NIE durch einen anderen Geist
// ersetzt, nur weil sich Werte veraendern (loest Abschnitt 6s Bug "Champion-
// Boni springen zwischen Einheiten" strukturell, nicht durch Aufraeum-Logik).
// Ausloeser fuer eine Befoerderung (ensureChampion(), aufgerufen von
// pushGhost() nach einem erfolgreichen Spawn und von killGhost() nach jedem
// Tod): existiert kein lebender Champion, wird der staerkste lebende
// GEWOEHNLICHE Geist (Staerke = aktuelle LP + Schaden * 5, Gleichstand =
// aelterer) zum Champion. Basiswerte (Abschnitt 2.2): 70 % von Spieler-
// maxHp/-Schaden zum Befoerderungszeitpunkt, NICHT vom geerbten Gegnertyp.
// Der Champion belegt KEINEN normalen Geisterplatz (occupiedGhostSlots()
// schliesst isChampion explizit aus) und hat standardmaessig KEINE
// Lebensdauer (ueberlebt bis zum Tod oder Raumende, s. updateGhosts()).
// NICHT zu verwechseln mit dem folgenden, aelteren, kartengebundenen
// `isCommander`-Mechanismus (aktuell tot, s. u.).
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
import { resolveCfg, isBossCfg } from './cfg.js';
import { explodeAt } from './mine.js';
import { onGhostRemoved, addNecroStack, getNecroStack, addNecroTimedStack, fireRateFactor } from './necro.js';
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
  const g = {
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
    // Nekromant-V2 Phase 8 (Alpha und Verschmelzung): "Getrennte Buchfuehrung
    // dreier Bonusarten am Champion" (Auftrag Abschnitt "Phase 8") --
    // Basiswerte (baseMaxHp/baseDamage/baseFireCooldown, oben, seit Phase 3),
    // Kronenboni (necroCrown*, STATELESS -- live gegen isChampion ausgewertet,
    // brauchen deshalb kein eigenes Feld hier AUSSER den beiden folgenden
    // Ausnahmen, die als einmalige Uebergaenge gelten), Fusionsboni (die
    // sechs fusion*-Felder unten -- die einzigen, die ghost_080 an einen
    // Nachfolger uebertragen muss).
    crownBonusesApplied: false, // promoteToChampion(): permanente Kroenungsboni nur EINMAL je Champion-Instanz
    // Fusionsboni (Auftrag Abschnitt 5, KORRIGIERT): ABSOLUTE, aufaddierte
    // Betraege -- NICHT mehr Raten, die gegen den EIGENEN Basiswert des
    // Champions multipliziert werden (der urspruengliche Fehler). Jede
    // Verschmelzung berechnet ihren Zuwachs aus den BASISWERTEN DES
    // VERSCHMOLZENEN Geistes und addiert ihn hier drauf -- s. applyFusionTransfer().
    fusionHpBonus: 0, // Summe der uebertragenen Basis-LP-Betraege (071/072/085/098)
    fusionDamageBonus: 0, // Summe der uebertragenen Basis-Schadens-Betraege
    fusionFireRateBonus: 0, // Summe der uebertragenen Basis-Feuerraten (1/Nachladezeit-Einheiten)
    fusionCount: 0, // Anzahl absorbierter Untertanen (ghost_077/074 zaehlen darauf)
    fusionBulletSizeBonus: 0, // ghost_074 "mit Einziger Thron": +X% je Verschmelzung
    shotCount: 0, // ghost_076/078: "jeder N-te Schuss"
    anchored: false, // ghost_081 "Seelenmonolith": verankert nach necroCrownAnchorAfterS Stillstand
    anchorTimer: 0,
    unassailableUsed: false, // ghost_079: einmal pro Raum
    invulnUntil: 0, // ghost_079/084: kurzzeitige Unverwundbarkeit nach einem toedlichen Treffer
    immortalKingReadyAt: 0, // ghost_084: eigene Abklingzeit
    // Nekromant-V2 Phase 9 (Hybride und Aktivkarten): weitere Felder je
    // Geist-Instanz.
    hybridBuffPct: 0, // ghost_086: zeitlich befristeter Schadensbonus
    hybridBuffUntil: 0,
    isReplacement: false, // ghost_090: der Ersatz darf sich nicht selbst ersetzen
    isAncestor: false, // ghost_105: nur DIESER Untertan loest den Tod-/Fusionsbuff aus
    championKills: 0, // ghost_093: Abschuesse NUR waehrend dieser Geist Champion war
    crownMassHpBonus: 0, // ghost_103: live nachgefuehrter, delta-basierter Bonus
  };
  // ghost_080 "Kronenerbe" (Nekromant-V2 Phase 8): stirbt der Champion, merkt
  // killGhost() 60% seiner Fusionsboni (state.necroCrownHeir) fuer ein
  // 10-Sekunden-Fenster vor -- der NAECHSTE erscheinende Untertan (gleich
  // welcher Erzeugungsstelle) erbt sie hier, EINMAL pro Raum ("Einmal pro
  // Raum" -- necroCrownHeirUsed sperrt weitere Erbschaften). Kronenboni
  // muessen NICHT uebertragen werden -- der Erbe liest sie automatisch aus
  // demselben Spieler-cfg, sobald ER selbst isChampion wird.
  const heir = state.necroCrownHeir;
  if (heir && !state.necroCrownHeirUsed && state.time <= heir.deadline) {
    state.necroCrownHeirUsed = true;
    grantFusionBonus(g, heir.fusionHpBonus, heir.fusionDamageBonus, heir.fusionFireRateBonus);
    g.fusionCount += heir.fusionCount;
    g.hp = g.cfg.maxHp;
  }
  return g;
}

// Champion-Beforderung (Auftrag Abschnitt 2.1/2.2, NEU): wandelt einen
// bereits existierenden, GEWOEHNLICHEN Geist in-place in den eigenstaendigen
// Champion um -- keine neue Einheit, keine zusaetzliche Ressource, laeuft
// ausschliesslich ueber die bestehende Geistermechanik (ensureChampion()
// ruft diese Funktion nur nach einem regulaeren Spawn/Tod auf). Die
// Basiswerte werden NICHT vom geerbten Gegnertyp abgeleitet, sondern frisch
// aus den AKTUELLEN Spielerwerten berechnet (Abschnitt 2.2) -- ersetzt
// vollstaendig, was resolveGhostCfg() dem Geist bisher an maxHp/damage
// mitgegeben hatte. Alle anderen geerbten Eigenschaften (Waffe, Rolle,
// Tempo, Panzerung, Geschosstempo ...) bleiben unveraendert bestehen, dazu
// macht der Auftrag keine Vorgabe.
function promoteToChampion(state, g) {
  const playerCfg = state.player?.cfg;
  const pct = state.data.balance?.ghost?.championStatPct ?? 0.7;
  const maxHp = Math.max(1, Math.round((playerCfg?.maxHp || 0) * pct));
  const damage = Math.max(1, Math.round((playerCfg?.damage || 0) * pct));
  g.isChampion = true;
  g.cfg.maxHp = maxHp;
  g.cfg.damage = damage;
  g.hp = maxHp; // "startet mit seinen vollen eigenen Lebenspunkten"
  // Basiswerte auf den frischen Champion-Wert setzen -- ab hier rechnen
  // applyFusionTransfer()/die Delta-Messungen (094/100) IMMER gegen DIESE
  // Basis, nicht mehr gegen den alten, typgeerbten Wert des Vorlebens als
  // gewoehnlicher Geist.
  g.baseMaxHp = maxHp;
  g.baseDamage = damage;
  // Champion hat standardmaessig KEINE Lebensdauer (Abschnitt 2.4) -- ein
  // frueheres Vorleben als gewoehnlicher Geist hatte ggf. schon eine
  // laufende Lebenszeit, die hier ausdruecklich aufgehoben wird.
  g.lifetime = Infinity;
  g.lifetimeMax = Infinity;
  // Fusionsboni beginnen bei Null -- ein Vorleben als gewoehnlicher Geist
  // konnte selbst nie Gewinner einer Verschmelzung sein (nur Champions
  // verschmelzen andere in sich), es gibt also nichts zu uebernehmen.
  g.fusionHpBonus = 0;
  g.fusionDamageBonus = 0;
  g.fusionFireRateBonus = 0;
  g.fusionCount = 0;
  // Permanente Kroenungsboni (ghost_061/063/068/083): genau EINMAL je
  // Champion-Instanz, direkt bei der Befoerderung -- unter dem neuen
  // stickyen Modell gibt es kein "erneutes Kroenen" derselben Instanz mehr,
  // die alte crownBonusesApplied-Wiederholungssperre entfaellt dadurch von
  // selbst (die Funktion wird pro Instanz nur einmal aufgerufen).
  if (playerCfg?.necroCrownDamagePct) g.cfg.damage = Math.round(g.cfg.damage * (1 + playerCfg.necroCrownDamagePct));
  if (playerCfg?.necroCrownHpPct) {
    const oldMax = g.cfg.maxHp;
    g.cfg.maxHp = Math.round(g.cfg.maxHp * (1 + playerCfg.necroCrownHpPct));
    g.hp += g.cfg.maxHp - oldMax;
  }
  if (playerCfg?.necroCrownResist) g.cfg.resist = (g.cfg.resist || 0) + playerCfg.necroCrownResist;
  // ghost_067 "Kronenschild": Schild "sobald ein Untertan zum Champion wird"
  // -- unter dem stickyen Modell ist das exakt die Befoerderung hier, kein
  // wiederholtes Ereignis mehr.
  if (playerCfg?.necroCrownShieldOnCrownPct) {
    g.shield = (g.shield || 0) + g.cfg.maxHp * playerCfg.necroCrownShieldOnCrownPct;
  }
  g.crownBonusesApplied = true;
  return g;
}

// Sucht einen neuen Champion, falls gerade keiner lebt -- aufgerufen nach
// jedem erfolgreichen Geister-Spawn (pushGhost()) und nach jedem Geistertod
// (killGhost(), damit ein sterbender Champion sofort ersetzt wird, sofern
// noch gewoehnliche Geister leben). Kandidaten sind ausschliesslich
// LEBENDE, GEWOEHNLICHE Geister (kein doppelter Champion moeglich). Staerke-
// formel + Gleichstandsregel unveraendert aus dem alten dynamischen Modell
// uebernommen (Auftrag Abschnitt 2.1): hp + Schaden*5, bei Gleichstand
// gewinnt der AELTERE (kleinere id, da nextGhostId streng aufsteigend
// vergeben wird UND state.ghosts in Erzeugungsreihenfolge steht -- die
// erste Fundstelle mit maximaler Staerke ist dadurch automatisch die
// aelteste).
export function ensureChampion(state) {
  if (state.ghosts.some((g) => g.alive && g.isChampion)) return;
  const weights = state.data.balance?.ghost?.strengthWeights || {};
  let best = null;
  let bestStrength = -Infinity;
  for (const g of state.ghosts) {
    if (!g.alive || g.isChampion) continue;
    const strength = g.hp * (weights.hp ?? 0) + g.cfg.damage * (weights.damage ?? 0);
    if (strength > bestStrength) {
      bestStrength = strength;
      best = g;
    }
  }
  if (best) promoteToChampion(state, best);
}

// Traegt einen bereits BERECHNETEN, ABSOLUTEN Bonus (nicht mehr eine Rate)
// auf den Champion auf -- gemeinsamer Endpunkt fuer applyFusionTransfer()
// (direkte Verschmelzung) UND den Kronenerbe-Zweig (createGhost() oben,
// Nachfolger-Uebertragung eines bereits vom toten Champion angesammelten
// Betrags). hp wird NICHT hier veraendert (der Aufrufer entscheidet, ob
// volle Auffuellung oder nur der neue Zuwachs sinnvoll ist).
function grantFusionBonus(champion, hpBonus, dmgBonus, rateBonus) {
  champion.fusionHpBonus = (champion.fusionHpBonus || 0) + (hpBonus || 0);
  champion.fusionDamageBonus = (champion.fusionDamageBonus || 0) + (dmgBonus || 0);
  champion.fusionFireRateBonus = (champion.fusionFireRateBonus || 0) + (rateBonus || 0);
  champion.cfg.maxHp = champion.baseMaxHp + champion.fusionHpBonus;
  champion.cfg.damage = champion.baseDamage + champion.fusionDamageBonus;
  // Feuerrate ist ein KEHRWERT (Nachladezeit), kein additiver Punktewert --
  // "X % der Basis-Feuerrate des Verschmolzenen" wird deshalb als absoluter
  // RATEN-Zuwachs (1 / dessen Basis-Nachladezeit * Anteil) auf die eigene,
  // aufaddierte Rate des Champions gerechnet, dann zurueck in eine
  // Nachladezeit umgewandelt -- dieselbe additive "Basiswert des
  // Verschmolzenen"-Logik wie bei LP/Schaden, nur in Raten- statt
  // Punkte-Einheiten (eine direkte Prozent-Subtraktion der Zeit waere
  // dimensional falsch UND kann bei grossen Werten negativ/durch-Null werden
  // -- die Kehrwert-Summe bleibt fuer jede endliche Rate > 0 immer positiv,
  // "mathematisch stabil, unbegrenzt skalierend" ohne kuenstlichen Deckel).
  const baseRate = champion.baseFireCooldown > 0 ? 1 / champion.baseFireCooldown : 0;
  const totalRate = baseRate + champion.fusionFireRateBonus;
  champion.cfg.fireCooldown = totalRate > 0 ? 1 / totalRate : champion.baseFireCooldown;
}

// Rechnet den Zuwachs EINER Verschmelzung aus den BASISWERTEN DES
// VERSCHMOLZENEN Geistes (Auftrag Abschnitt 5, Fehlerkorrektur): die alte
// Fassung multiplizierte die Uebertragungsrate faelschlich mit den
// Basiswerten des EMPFAENGERS (Champion) statt des Verschmolzenen --
// Beispiel aus dem Auftrag: 25 Champion-Basisleben, 10 Basisleben des
// Verschmolzenen, 30 % Rate -> korrekt 25+3=28, die alte Fassung lieferte
// 25+7,5(gerundet 8)=33. Der berechnete, EINMALIGE Betrag wird ueber
// grantFusionBonus() dauerhaft auf den Champion addiert -- kein erneutes
// Einrechnen bereits uebertragener Boni, also kein exponentielles Wachstum.
function applyFusionTransfer(champion, loser, hpFrac, dmgFrac, frFrac) {
  const hpGain = Math.round((loser.baseMaxHp || 0) * (hpFrac || 0));
  const dmgGain = Math.round((loser.baseDamage || 0) * (dmgFrac || 0));
  const loserRate = loser.baseFireCooldown > 0 ? 1 / loser.baseFireCooldown : 0;
  const rateGain = loserRate * (frFrac || 0);
  grantFusionBonus(champion, hpGain, dmgGain, rateGain);
  return hpGain;
}

// ghost_071 "Einziger Thron" (Nekromant-V2 Phase 8): "Sobald ein zweiter
// Untertanenpanzer erscheinen wuerde, verschmilzt der SCHWAECHERE sofort mit
// dem [staerkeren, also] Champion." winner behaelt seine Existenz und waechst
// um einen Anteil der BASISWERTE des loser (Auftrag: Basiswerte, nicht
// aktuelle Werte -- verhindert exponentielles Aufschaukeln). "Verschmelzung
// ist KEIN Geistertod" (Auslöser 'fusion' aus Phase 5, countsAsGhostDeath()
// schliesst ihn explizit aus) -- onGhostRemoved() wird trotzdem aufgerufen
// (fuer eine kuenftige, ausdruecklich auf 'fusion' lauschende Karte), nur
// OHNE die _deaths-Buchfuehrung/Stapel-Effekte der death_*-Grunde.
// `overrideFrac` (Nekromant-V2 Phase 9, ghost_098 "Auslese der Legion"):
// eine EIGENSTAENDIGE Uebertragungsrate, unabhaengig von 071/072/085 --
// 098 loest gar nicht am Geisterlimit-Bypass von 071 aus (necroUniqueThrone),
// sondern nur, wenn das Limit bereits VOLL ist (s. pushGhost()). Mit
// overrideFrac gesetzt werden 071/072/085 komplett uebersprungen, damit
// sich zwei unabhaengige Verschmelzungs-Karten nicht gegenseitig verzerren.
export function fuseGhost(state, winner, loser, overrideFrac) {
  const pc = state.player?.cfg;
  let hpFrac = overrideFrac?.hpFrac ?? pc?.necroFusionHpPct ?? 0.3;
  let dmgFrac = overrideFrac?.dmgFrac ?? pc?.necroFusionDamagePct ?? 0.3;
  let frFrac = overrideFrac?.frFrac ?? pc?.necroFusionFireRatePct ?? 0.12;
  if (!overrideFrac) {
    // ghost_072 "Seelenauslese" (requires ghost_071): zusaetzlicher Anteil JE
    // Verschmelzung, additiv zur Grundrate von 071.
    hpFrac += pc?.necroFusionHpPctBonus || 0;
    dmgFrac += pc?.necroFusionDamagePctBonus || 0;
    frFrac += pc?.necroFusionFireRatePctBonus || 0;
    // ghost_085 "Seelenkoloss" ERSETZT die Uebertragungswerte von 071/072,
    // statt zu addieren -- eigenes `replaces`-Datenfeld auf der Karte selbst
    // (core.necroFusionReplace), sonst wuerden sich beide Karten gleichzeitig
    // stumm verdoppeln.
    if (pc?.necroFusionReplace) {
      hpFrac = pc.necroFusionReplaceHpPct ?? 0.5;
      dmgFrac = pc.necroFusionReplaceDamagePct ?? 0.5;
      frFrac = pc.necroFusionReplaceFireRatePct ?? 0.2;
    }
  }
  const gainedHp = applyFusionTransfer(winner, loser, hpFrac, dmgFrac, frFrac);
  winner.hp = Math.min(winner.cfg.maxHp, winner.hp + gainedHp);
  winner.fusionCount = (winner.fusionCount || 0) + 1;
  // ghost_074 "Verdichtete Geschosse" (mit Einziger Thron): +2% Projektilgroesse
  // JE Verschmelzung, bis Raumende -- akkumuliert direkt am winner.
  if (pc?.necroFusionBulletSizePctPerFusion) {
    winner.fusionBulletSizeBonus = (winner.fusionBulletSizeBonus || 0) + pc.necroFusionBulletSizePctPerFusion;
  }
  // ghost_073 "Endloser Anspruch" (requires 071, ANGEPASST -- der Champion
  // hat seit der Champion-Ueberarbeitung standardmaessig KEINE Lebensdauer
  // mehr, die alte "Restlebenszeit verlaengern"-Wirkung waere wirkungslos.
  // Neuer, nicht willkuerlich erfundener Effekt derselben Karte: JEDE
  // Verschmelzung gewaehrt dem Champion stattdessen einen Schild --
  // wiederverwendet den ueberall im Kartenpool vorhandenen generischen
  // Schild-Gewaehrungs-Mechanismus, nur an das bestehende Verschmelzungs-
  // Ereignis dieser Karte gehaengt statt an einen neuen Ausloeser).
  if (pc?.necroFusionShieldOnFusionPct) {
    winner.shield = (winner.shield || 0) + winner.cfg.maxHp * pc.necroFusionShieldOnFusionPct;
  }
  // ghost_065 "Seelenheilung": "Ablauf der Lebenszeit UND Verschmelzung loesen
  // ebenfalls aus" -- der Champion (i. d. R. = winner selbst) heilt sich beim
  // Verlust eines ANDEREN Untertanen. loser !== winner ist hier immer wahr.
  healChampionOnAllyDeath(state, loser);
  loser.alive = false;
  // ghost_105 "Herrschaft ueber den Tod": "Stirbt ODER VERSCHMILZT er" -- der
  // Urahnenuntertan kann auch als Verschmelzungs-Verlierer enden.
  const pc105 = state.player?.cfg;
  if (loser.isAncestor && pc105?.necroAncestorBuffOnDeath) {
    addNecroTimedStack(state, '_timedAncestorDmg', pc105.necroAncestorBuffDmgPct || 0, pc105.necroAncestorBuffDurationS || 0);
    addNecroTimedStack(state, '_timedAncestorFR', pc105.necroAncestorBuffFRPct || 0, pc105.necroAncestorBuffDurationS || 0);
  }
  onGhostRemoved(state, loser, 'fusion');
  // Sichtbarkeit (Auftrag: "Verschmelzung mit kurzem Effekt, sonst ist das
  // System unlesbar"): kurzer Partikelstoss + Text am Winner, eigener Ton
  // (Wiederverwendung von 'combo' -- selbe "besonderes Ereignis"-Bedeutung
  // wie beim Transformations-Unlock).
  state.spawnParticles?.(winner.x, winner.y, '#e8b44a', 14, 130);
  state.texts.push({ x: winner.x, y: winner.y - 20, text: 'Verschmolzen!', age: 0, life: 0.7, color: '#e8b44a' });
  state.sounds.push({ name: 'combo', x: winner.x });
  // Nekromant-V2 Phase 10 (Telemetrie): "verschmolzen" -- EINZIGER Ort, an
  // dem eine Verschmelzung wirklich stattfindet (pushGhost() ruft immer
  // diese Funktion, nie direkt).
  state.necroGhostsFused = (state.necroGhostsFused || 0) + 1;
}

// ghost_065 "Seelenheilung": der aktuelle Champion heilt sich um einen Anteil
// seines maximalen Lebens, sobald ein ANDERER Untertan das Zeitliche segnet
// -- ausdruecklich auf allen DREI Wegen (Schaden/Ablauf/Verschmelzung),
// deshalb ein eigener, direkter Aufruf aus killGhost() UND fuseGhost() statt
// des necro.js-Listener-Systems (dessen countsAsGhostDeath() Verschmelzung
// bewusst NICHT mitzaehlt, s. Phase 5).
function healChampionOnAllyDeath(state, diedGhost) {
  const pc = state.player?.cfg?.necroCrownHealOnAllyDeathPct;
  if (!pc) return;
  const champ = state.ghosts.find((g) => g.alive && g.isChampion && g !== diedGhost);
  if (champ) champ.hp = Math.min(champ.cfg.maxHp, champ.hp + champ.cfg.maxHp * pc);
}

// Zentraler Erzeugungs-Hook (Nekromant-V2 Phase 8): ALLE sechs Erzeugungs-
// stellen (state.js: killTank()s Wiederbelebungs-Block x3, der ghost_033-
// Raumstart-Hook; tank.js: spawnGhostBomb()) rufen ab jetzt DIESE Funktion
// statt direkt state.ghosts.push(createGhost(...)) -- so ist "Einziger
// Thron" EIN einziger Mechanismus statt sechsmal dupliziert. Ohne
// necroUniqueThrone unveraendertes Verhalten (reiner Push). g ist ein bereits
// fertig konstruierter Geist (aus createGhost()).
//
// Nekromant-V2 Phase 10 (Lesbarkeit und Telemetrie): "Wiederbelebung ... ein
// kurzer, unterscheidbarer Effekt" -- bis dahin erschien ein Untertan (egal
// ob per Kill-Wuerfel, Geisterbombe oder Raumstart) OHNE jedes sichtbare
// oder hoerbare Zeichen. Ein neuer, EIGENER Ton (ghost_rise, aufsteigend,
// unterscheidbar von 'combo'/Verschmelzung und 'shield'/Schild) + ein
// heller Partikelstoss + der necroGhostsCreated-Zaehler sitzen an genau EINER
// Stelle -- den beiden echten "g erscheint wirklich"-Ausgaengen von
// pushGhost() (normaler Pfad + der Gewinner-Zweig von necroUniqueThrone).
// Die beiden Verwerfungs-Zweige (existing gewinnt, necroCapFusion am
// vollen Limit) loesen ihn bewusst NICHT aus -- dort erscheint g nie.
function spawnGhostAppearEffect(state, g) {
  state.necroGhostsCreated = (state.necroGhostsCreated || 0) + 1;
  state.spawnParticles?.(g.x, g.y, '#7fe6c8', 10, 90);
  state.sounds.push({ name: 'ghost_rise', x: g.x });
}

export function pushGhost(state, g) {
  const pc = state.player?.cfg;
  // ghost_071 "Einziger Thron" (ANGEPASST an die Champion-Ueberarbeitung,
  // Auftrag Abschnitt 3): der eigenstaendige Champion bleibt IMMER bestehen
  // -- er ist nicht mehr "der aktuell staerkste", sondern eine sticky
  // Identitaet, die niemals durch einen neu ankommenden Geist ersetzt wird.
  // JEDER weitere Geist verschmilzt deshalb bedingungslos mit dem Champion,
  // g erscheint dabei selbst nie (kein Gewinner-/Verlierer-Vergleich mehr
  // noetig -- der Champion gewinnt per Konstruktion immer). Existiert noch
  // gar kein Champion (allererster Spawn), faellt g unten durch den
  // normalen Pfad und wird selbst zum ersten Champion (ensureChampion()).
  if (pc?.necroUniqueThrone) {
    const champion = state.ghosts.find((x) => x.alive && x.isChampion);
    if (champion) {
      fuseGhost(state, champion, g);
      recomputeLegionCache(state);
      return;
    }
  }
  // ghost_098 "Auslese der Legion" (Nekromant-V2 Phase 9, BUGFIX Auftrag
  // Abschnitt 4): "Wuerde bei VOLLEM Geisterlimit ein weiterer gewoehnlicher
  // Untertan erscheinen, verschmilzt der SCHWAECHSTE gewoehnliche Geist in
  // den Champion." Der Champion selbst zaehlt NIE gegen das Limit
  // (occupiedGhostSlots() schliesst ihn aus) und wird hier ausdruecklich NIE
  // als zu opferndes "schwaechstes" Ziel ausgewaehlt (isChampion-Filter,
  // KEIN Fallback mehr auf "irgendeinen lebenden Geist" -- unter dem
  // stickyen Modell existiert immer entweder ein echter Champion oder gar
  // kein Geist, ein Fallback wuerde sonst faelschlich einen gewoehnlichen
  // Geist wie einen Champion behandeln). Der neu ankommende Geist `g`
  // erscheint dabei selbst NICHT (er wird verworfen) -- "es waere einer
  // erschienen" loest nur die Verschmelzung eines bereits VORHANDENEN
  // schwaechsten Untertanen aus.
  if (pc?.necroCapFusion) {
    const cap = (state.data.balance?.ghost?.maxActive ?? 3) + (pc.ghostMaxAdd || 0);
    if (occupiedGhostSlots(state) >= cap) {
      const champion = state.ghosts.find((x) => x.alive && x.isChampion);
      let weakest = null;
      for (const x of state.ghosts) {
        if (!x.alive || x.isChampion) continue;
        if (!weakest || x.hp < weakest.hp) weakest = x;
      }
      if (champion && weakest) {
        fuseGhost(state, champion, weakest, { hpFrac: pc.necroCapFusionHpPct, dmgFrac: pc.necroCapFusionDamagePct, frFrac: 0 });
        recomputeLegionCache(state);
      }
      return;
    }
  }
  state.ghosts.push(g);
  spawnGhostAppearEffect(state, g);
  recomputeLegionCache(state);
  // Befoerdert bei Bedarf sofort einen Champion (Auftrag Abschnitt 2.1:
  // "Sobald ein Geisterpanzer entsteht und noch kein Champion existiert,
  // wird der staerkste verfuegbare gewoehnliche Geist zum eigenstaendigen
  // Champion") -- deckt sowohl den allerersten Spawn im Raum als auch den
  // Fall ab, dass der bisherige Champion gerade erst gestorben ist und ein
  // neuer regulaerer Spawn eintrifft, BEVOR killGhost()s eigener
  // ensureChampion()-Aufruf schon einen Ersatz gefunden haette.
  ensureChampion(state);
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
  // ghost_065 "Seelenheilung" (Nekromant-V2 Phase 8): der Champion heilt sich,
  // wenn ein ANDERER Untertan hier ueber Schaden/Ablauf stirbt (der dritte
  // Weg, Verschmelzung, hat seinen eigenen Aufruf in fuseGhost() oben).
  healChampionOnAllyDeath(state, g);
  // ghost_080 "Kronenerbe" (Nekromant-V2 Phase 8): stirbt GENAU der Champion
  // (nicht irgendein Untertan), merkt sich der Raum 60% seiner bisher
  // angesammelten FUSIONSBONI fuer ein Zeitfenster -- der naechste
  // erscheinende Untertan erbt sie in createGhost() oben. Kronenboni
  // (necroCrown*) brauchen keine Uebertragung, s. dort. "Einmal pro Raum".
  if (g.isChampion && cfg?.necroCrownHeirPct && !state.necroCrownHeirUsed) {
    state.necroCrownHeir = {
      deadline: state.time + (state.data.balance?.ghost?.crownHeirWindowS ?? 10),
      fusionHpBonus: (g.fusionHpBonus || 0) * cfg.necroCrownHeirPct,
      fusionDamageBonus: (g.fusionDamageBonus || 0) * cfg.necroCrownHeirPct,
      fusionFireRateBonus: (g.fusionFireRateBonus || 0) * cfg.necroCrownHeirPct,
      fusionCount: Math.floor((g.fusionCount || 0) * cfg.necroCrownHeirPct),
    };
  }
  // ghost_094 "Erbe des Herrschers" (Nekromant-V2 Phase 9): stirbt der
  // Champion, erhaelt der HAUPTPANZER (nicht ein anderer Untertan) einen
  // Anteil seines ANGESAMMELTEN Bonus -- gemessen als Delta zum eigenen
  // Basiswert (g.cfg.damage - g.baseDamage bzw. maxHp), das erfasst
  // Kronen- UND Fusionsboni gemeinsam, ohne beide Quellen getrennt
  // nachrechnen zu muessen. Direkter, EINMALIGER Zuschlag auf cfg.damage
  // (haelt bis Raumende, da cfg fuer den Rest des Raums nicht neu aufgeloest
  // wird) + Schild aus dem Lebensbonus-Anteil.
  if (g.isChampion && cfg?.necroCrownDeathDmgTransferPct && state.player?.alive) {
    const dmgBonus = Math.max(0, g.cfg.damage - g.baseDamage);
    const hpBonus = Math.max(0, g.cfg.maxHp - g.baseMaxHp);
    state.player.cfg.damage = Math.round(state.player.cfg.damage + dmgBonus * cfg.necroCrownDeathDmgTransferPct);
    // Auftrag Abschnitt 9: kein Schild-Deckel (weiterer, im Kartentext nie
    // erwaehnter versteckter Cap).
    state.player.shield = (state.player.shield || 0) + hpBonus * (cfg.necroCrownDeathHpShieldPct || 0);
  }
  // ghost_100 "Ersatzkoerper" (Nekromant-V2 Phase 9): stirbt der Champion,
  // WAEHREND ein weiterer Untertan aktiv ist, uebernimmt der GESUENDESTE
  // Ueberlebende (nicht der naechste Neuling wie bei 080) die Haelfte der
  // raumweiten Kronen- und Fusionsboni -- dieselbe Delta-Messung wie 094,
  // aber additiv auf die cfg des Ueberlebenden statt auf den Spieler.
  // "Einmal pro Raum".
  if (g.isChampion && cfg?.necroSuccessionPct && !state.necroSuccessionUsed) {
    const survivors = state.ghosts.filter((x) => x.alive && x !== g);
    if (survivors.length) {
      state.necroSuccessionUsed = true;
      let healthiest = survivors[0];
      for (const s of survivors) if (s.hp > healthiest.hp) healthiest = s;
      const dmgBonus = Math.max(0, g.cfg.damage - g.baseDamage);
      const hpBonus = Math.max(0, g.cfg.maxHp - g.baseMaxHp);
      healthiest.cfg.damage = Math.round(healthiest.cfg.damage + dmgBonus * cfg.necroSuccessionPct);
      const gained = Math.round(hpBonus * cfg.necroSuccessionPct);
      healthiest.cfg.maxHp += gained;
      healthiest.hp += gained;
    }
  }
  // ghost_105 "Herrschaft ueber den Tod": stirbt der Urahnenuntertan (Schaden
  // ODER Ablauf), erhaelt der Hauptpanzer einen zeitlich befristeten Buff.
  if (g.isAncestor && cfg?.necroAncestorBuffOnDeath) {
    addNecroTimedStack(state, '_timedAncestorDmg', cfg.necroAncestorBuffDmgPct || 0, cfg.necroAncestorBuffDurationS || 0);
    addNecroTimedStack(state, '_timedAncestorFR', cfg.necroAncestorBuffFRPct || 0, cfg.necroAncestorBuffDurationS || 0);
  }
  // Nekromant-V2 Phase 5 (Ereignis-/Stapelschicht): zentrales Ereignis fuer
  // JEDEN echten Geistertod -- NACH den beiden obigen "ueberlebt doch"-
  // Zweigen, ein geretteter Geist ist kein Geistertod. cause ('damage'/
  // 'expire') ist 1:1 die Auslöser-Tabelle aus dem Auftrag.
  // Nekromant-V2 Phase 9: 'sacrifice' (ghost_031/089/096, "Die Opferung
  // zaehlt als Geistertod") ist die dritte moegliche cause -- NECRO_REASONS/
  // countsAsGhostDeath() unterstuetzen den Grund seit Phase 5, bisher hat
  // ihn nur nie ein Aufrufer erzeugt. Wie 'expire' oben ohne Wiederkehr/
  // Phylakterium/Todeszone (eine ABSICHTLICHE Opferung soll nicht "durch
  // Glueck ueberleben").
  const reason = cause === 'expire' ? 'death_expire' : cause === 'sacrifice' ? 'sacrifice' : 'death_damage';
  // Nekromant-V2 Phase 10 (Telemetrie): "gestorben (nach Grund
  // aufgeschluesselt)" -- derselbe reason-Wert, den onGhostRemoved() gleich
  // bekommt, EINMAL berechnet statt zweimal dupliziert.
  state.necroGhostsDiedByReason[reason] = (state.necroGhostsDiedByReason[reason] || 0) + 1;
  onGhostRemoved(state, g, reason);
  // Nekromant-V2 Phase 7 (Legion): killGhost() ist der EINZIGE Entfernungs-
  // Trichter (Schaden UND Ablauf) -- die "bei Spawn UND Entfernen neu
  // berechnen, NICHT pro Frame"-Vorgabe des Auftrags braucht deshalb nur
  // hier UND an den (zwei) Erzeugungsstellen einen Aufruf.
  recomputeLegionCache(state);
  // Champion-Nachfolge (Auftrag Abschnitt 2.1): stirbt GENAU der Champion
  // und existieren noch gewoehnliche Geister, wird sofort der staerkste
  // davon zum neuen Champion. Existieren keine, passiert hier nichts --
  // der naechste Champion entsteht erst wieder beim naechsten regulaeren
  // Spawn (pushGhost()s eigener ensureChampion()-Aufruf). Bei einem
  // gewoehnlichen Geistertod ist dieser Aufruf ein reines No-op (es lebt ja
  // schon ein Champion).
  ensureChampion(state);
}

// Nekromant-V2 Phase 7 (Legion, ghost_056 "Elite-Reaktivierung"): Summe
// belegter Geisterplaetze statt der reinen Anzahl -- ein wiederbelebter
// Elite-Untertan belegt 2 (g.slotCost), jeder andere 1. Der Champion (Auftrag
// Abschnitt 2.3) belegt NIEMALS einen Platz -- explizit ausgeschlossen
// (nicht ueber slotCost:0, das waere gegen JS-Falsy-Tuecken (`0 || 1` ergaebe
// wieder 1) nicht robust genug -- der Auftrag verlangt ausdruecklich eine
// robuste, nicht zufaellige Trennung).
export function occupiedGhostSlots(state) {
  let n = 0;
  for (const g of state.ghosts) if (g.alive && !g.isChampion) n += g.slotCost || 1;
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

// ghost_066 "Vorrang des Staerkeren" (Nekromant-V2 Phase 8): der Champion
// bevorzugt den Gegner mit dem HOECHSTEN MAXIMALEN Leben (nicht dem aktuellen
// -- "hoechstes maximales Leben" ist eine stabile, nicht durch bisherigen
// Beschuss verzerrte Zielwahl).
function strongestEnemyByMaxHp(state) {
  let best = null;
  let bestMax = -Infinity;
  for (const t of state.tanks) {
    if (t === state.player || !t.alive) continue;
    if ((t.cfg.maxHp || 0) > bestMax) {
      bestMax = t.cfg.maxHp || 0;
      best = t;
    }
  }
  return best;
}

export function updateGhosts(state, dt) {
  const playerCfg = state.player?.cfg;
  // Nachschliff ("Champion muss ein eigenstaendiger Geisterpanzer sein"):
  // ensureChampion() ist idempotent (tut nichts, wenn schon einer lebt) --
  // ein Aufruf JEDEN Tick ist reines Sicherheitsnetz fuer den seltenen Fall,
  // dass ein Geist ausserhalb von pushGhost()/killGhost() ins Array gelangt
  // (z. B. altes Testfixture), NICHT der normale Befoerderungsweg (der
  // laeuft ueber pushGhost(), s. dort).
  ensureChampion(state);
  // Rudelgeist/Armee der Toten (Phase 8) + ghost_039 "Rudelfeuer" (Phase 7):
  // wird seit Phase 7 NICHT mehr hier neu berechnet ("Zaehlerbasierte
  // Skalierung ... nicht pro Frame") -- state.necroPackMult kommt aus
  // recomputeLegionCache(), aufgerufen an den Spawn-/Entfernen-Stellen.
  const packMult = state.necroPackMult ?? 1;
  const aliveGhosts = state.ghosts.filter((x) => x.alive);

  // ---- Champion (ANGEPASST an die Champion-Ueberarbeitung) ----------------
  // isChampion ist jetzt STICKY (s. promoteToChampion()/ensureChampion() weiter
  // oben) -- hier nur noch ein einfacher Lookup, KEINE Neubewertung/Neu-
  // vergabe mehr. Kronen-/Anker-/Aura-Karten unten lesen weiterhin `champion`
  // als lokale Variable, unveraendert.
  //
  // ghost_071 "Einziger Thron": der Champion bleibt Alleinherrscher -- deckt
  // den seltenen Fall ab, dass die Karte aktiviert wird, WAEHREND bereits
  // mehrere gewoehnliche Geister neben ihm existieren (Auftrag Abschnitt 3,
  // "bereits vorhandene Geister werden nach Aktivierung korrekt beruecksichtigt").
  // pushGhost() deckt den haeufigen Fall (neu ankommende Geister) bereits ab;
  // dieser Sweep faengt nur den Rand-/Uebergangsfall.
  const champion = aliveGhosts.find((g) => g.isChampion) || null;
  if (champion && playerCfg?.necroUniqueThrone) {
    for (const g of aliveGhosts) {
      if (g === champion || g.isChampion) continue;
      fuseGhost(state, champion, g);
    }
  }
  // Nekromant-V2 Phase 10 (Telemetrie): "durchschnittliche Championstaerke"
  // -- eine ZEITGEWICHTETE Stichprobe (jeder Tick mit lebendem Champion
  // zaehlt einmal), kein einmaliger Schnappschuss am Raumende. main.js
  // teilt necroChampionStrengthSum/Samples am Ende, nicht hier.
  if (champion) {
    const weights = state.data.balance?.ghost?.strengthWeights || {};
    const strength = champion.hp * (weights.hp ?? 0) + champion.cfg.damage * (weights.damage ?? 0);
    state.necroChampionStrengthSum = (state.necroChampionStrengthSum || 0) + strength;
    state.necroChampionStrengthSamples = (state.necroChampionStrengthSamples || 0) + 1;
  }

  // ghost_070 "Herrscheraura": Gegner in necroCrownAuraRadius um den Champion
  // verursachen weniger Schaden und nehmen von Untertanen mehr Schaden --
  // markiert hier als Flag auf dem Gegner selbst (Muster wie t.aimingAtPlayer),
  // gelesen von state.js an den beiden Schadensberechnungsstellen.
  for (const t of state.tanks) t.necroAuraWeakened = false;
  if (champion && playerCfg?.necroCrownAuraRadius) {
    for (const t of state.tanks) {
      if (t === state.player || !t.alive) continue;
      if (Math.hypot(t.x - champion.x, t.y - champion.y) <= playerCfg.necroCrownAuraRadius) t.necroAuraWeakened = true;
    }
  }

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
  // ghost_102 "Kronengarde" (Nekromant-V2 Phase 9, nur Champion): +Resistenz
  // JE ANDEREM aktivem Untertan -- additiv auf legionAuraResist (bereits die
  // "gesammelte" Naeheresistenz-Ablage). Ist der Champion ALLEIN, gibt es
  // stattdessen alle necroCrownGuardSoloIntervalS Sekunden einen Schild-Schub
  // -- eigener Timer je Geist-Instanz (g.crownGuardShieldTimer), tickt nur,
  // solange der Champion tatsaechlich allein ist (kein Fortlaufen im
  // Hintergrund).
  if (playerCfg?.necroCrownGuardResistPerAlly) {
    const champ = aliveGhosts.find((g) => g.isChampion);
    if (champ) {
      if (aliveGhosts.length > 1) {
        champ.legionAuraResist = (champ.legionAuraResist || 0) + playerCfg.necroCrownGuardResistPerAlly * (aliveGhosts.length - 1);
      } else if (playerCfg.necroCrownGuardSoloShieldPct) {
        champ.crownGuardShieldTimer = (champ.crownGuardShieldTimer || 0) + dt;
        if (champ.crownGuardShieldTimer >= (playerCfg.necroCrownGuardSoloIntervalS || 5)) {
          champ.crownGuardShieldTimer = 0;
          champ.shield = (champ.shield || 0) + champ.cfg.maxHp * playerCfg.necroCrownGuardSoloShieldPct;
        }
      }
    }
  }
  // ghost_103 "Massenkrone" (nur Champion, live): +maxHp JE Geisterplatz
  // ueber dem Schwellenwert -- delta-basiert nachgefuehrt (Muster wie
  // Veteranen-Befoerderung), damit hp konsistent zum gewachsenen/
  // geschrumpften Deckel bleibt, wenn sich die Platzzahl aendert.
  if (playerCfg?.necroCrownMassHpPerSlot) {
    const champ = aliveGhosts.find((g) => g.isChampion);
    if (champ) {
      const overSlots = Math.max(0, occupiedGhostSlots(state) - (playerCfg.necroCrownMassSlotThreshold || 3));
      const targetBonus = Math.round(champ.baseMaxHp * playerCfg.necroCrownMassHpPerSlot * overSlots);
      const prevBonus = champ.crownMassHpBonus || 0;
      if (targetBonus !== prevBonus) {
        champ.cfg.maxHp += targetBonus - prevBonus;
        champ.hp += targetBonus - prevBonus;
        champ.crownMassHpBonus = targetBonus;
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
    // Champion (Auftrag Abschnitt 2.4, BASELINE seit der Champion-
    // Ueberarbeitung, kein Kartengate mehr noetig): "besitzt standardmaessig
    // KEINE normale Geister-Lebenszeit... bleibt bestehen, bis er im Kampf
    // stirbt oder der Raum endet." Gewoehnliche Geister zerfallen weiterhin
    // normal.
    if (!g.isChampion) {
      g.lifetime -= dt;
      if (g.lifetime <= 0) {
        killGhost(state, g, 'expire');
        continue;
      }
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
    // ghost_081 "Seelenmonolith" (Nekromant-V2 Phase 8): bewegt sich der
    // Champion necroCrownAnchorAfterS Sekunden lang nicht, verankert er sich
    // -- gemessen an der VORHERIGEN Tick-Geschwindigkeit (g.vx/vy, unten am
    // Ende jedes Durchlaufs neu gesetzt), nicht am aktuellen Bewegungswunsch.
    if (g.isChampion && playerCfg?.necroCrownAnchorAfterS) {
      const stillNow = Math.hypot(g.vx || 0, g.vy || 0) < 1;
      g.anchorTimer = stillNow ? (g.anchorTimer || 0) + dt : 0;
      g.anchored = g.anchorTimer >= playerCfg.necroCrownAnchorAfterS;
    } else {
      g.anchored = false;
      g.anchorTimer = 0;
    }
    g.prevX = g.x;
    g.prevY = g.y;

    // ghost_041 "Geteiltes Ziel" (Nekromant-V2 Phase 7) / ghost_066 "Vorrang
    // des Staerkeren" (Nekromant-V2 Phase 8, nur der Champion): alle
    // Untertanen greifen das zuletzt vom SPIELER getroffene Ziel an, solange
    // es lebt; der Champion bevorzugt darueber hinaus den Gegner mit dem
    // hoechsten maximalen Leben; sonst der normale naechstgelegene Gegner.
    const target =
      g.isChampion && playerCfg?.necroCrownTargetStrongest && strongestEnemyByMaxHp(state)
        ? strongestEnemyByMaxHp(state)
        : playerCfg?.necroSharedTarget && state.necroLastPlayerHitTarget?.alive
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
    const wantsFlank =
      playerCfg?.ghostFlankSeek ||
      playerCfg?.necroSharedTarget ||
      (g.isChampion && playerCfg?.necroCrownTargetStrongest);
    if (wantsFlank && typeof target.heading === 'number') {
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
    // ghost_066/074 (necroCrownRangePct) und ghost_081 (necroCrownAnchorRangePct,
    // nur solange verankert): Champion-Reichweitenboni auf die Feuer-Schwelle.
    const rangeBonusPct =
      (g.isChampion ? playerCfg?.necroCrownRangePct || 0 : 0) +
      (g.anchored ? playerCfg?.necroCrownAnchorRangePct || 0 : 0);
    const effFireRangePx = g.cfg.fireRangePx * (1 + rangeBonusPct);
    const distToTarget = Math.hypot(target.x - g.x, target.y - g.y);
    if (
      g.cooldown <= 0 &&
      distToTarget <= effFireRangePx &&
      Math.abs(angleDiff(g.turret, angleToTarget)) < FIRE_CONE &&
      clearLine(state, g.x, g.y, target.x, target.y)
    ) {
      const muzzle = g.cfg.radius + 8;
      g.shotCount = (g.shotCount || 0) + 1;
      // ghost_078 "Alpha-Schuss": jeder N-te Schuss des Champions traegt
      // eigenen Bonusschaden + zusaetzlichen Durchschlag.
      const isAlphaShot =
        g.isChampion && playerCfg?.necroCrownAlphaShotEvery && g.shotCount % playerCfg.necroCrownAlphaShotEvery === 0;
      // ghost_007 "Totenpraezision" (Nekromant-V2 Phase 6) + ghost_069
      // "Kritische Krone" (Nekromant-V2 Phase 8, nur Champion): eigener
      // Krit-Wurf fuer Geistergeschosse.
      const critChanceEff = (g.cfg.critChance || 0) + (g.isChampion ? playerCfg?.necroCrownCritChanceAdd || 0 : 0);
      const ghostCrit = critChanceEff > 0 && state.rng() < critChanceEff;
      const crownCritMultAdd = g.isChampion ? playerCfg?.necroCrownCritMultAdd || 0 : 0;
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
      // ghost_062 "Einsamer Waechter" (Nekromant-V2 Phase 8): +12% Schaden
      // UND +12% Feuerrate, solange GENAU 1 Untertan aktiv ist (per
      // Konstruktion dann automatisch auch der Champion).
      const soloMult = aliveGhosts.length === 1 ? 1 + (playerCfg?.necroSoloDamagePct || 0) : 1;
      // ghost_064 "Jagdinstinkt" (nur Champion): +Schaden gegen Elite/Boss-Ziele.
      const targetIsEliteOrBoss = (target.affixes && target.affixes.length > 0) || isBossCfg(target.cfg);
      const eliteBossMult =
        g.isChampion && targetIsEliteOrBoss ? 1 + (playerCfg?.necroCrownEliteBossDamagePct || 0) : 1;
      // ghost_081 "Seelenmonolith": +Schaden, solange verankert.
      const anchorMult = g.anchored ? 1 + (playerCfg?.necroCrownAnchorDamagePct || 0) : 1;
      // ghost_077 "Seelenverdichtung" (mit Einziger Thron zusaetzlich): +X %
      // Schaden JE 3 Verschmelzungen dieses Untertanen, bis Raumende.
      const fusionStackMult =
        g.isChampion && playerCfg?.necroUniqueThrone && playerCfg?.necroCrownFusionDamagePer3
          ? 1 + Math.floor((g.fusionCount || 0) / 3) * playerCfg.necroCrownFusionDamagePer3
          : 1;
      // ghost_078 "Alpha-Schuss": jeder N-te Schuss macht +X % Schaden.
      const alphaMult = isAlphaShot ? playerCfg?.necroCrownAlphaShotDamageMult || 1 : 1;
      // ghost_086 "Totenmarsch" (Nekromant-V2 Phase 9): zeitlich befristeter
      // Bonus auf JEDEM Untertanen nach einem Geistertod (nicht nur Champion).
      const hybridMult = (g.hybridBuffUntil || 0) > state.time ? 1 + (g.hybridBuffPct || 0) : 1;
      // ghost_099 "Kroenungszug" (nur Champion, live): +X% je ANDEREM
      // aktivem Untertan, ZUSAETZLICH zum halb-permanenten Anteil aus
      // necro.js (state.necroCoronationPermDmgPct, auf Toden gesammelt).
      const crownProcMult =
        g.isChampion && playerCfg?.necroCrownProcPerAllyPct
          ? 1 + playerCfg.necroCrownProcPerAllyPct * Math.max(0, aliveGhosts.length - 1) + (state.necroCoronationPermDmgPct || 0)
          : g.isChampion
            ? 1 + (state.necroCoronationPermDmgPct || 0)
            : 1;
      // ghost_103 "Massenkrone" (keystone, nur Champion, live): +X% Schaden
      // je Geisterplatz UEBER dem Schwellenwert.
      const massMult =
        g.isChampion && playerCfg?.necroCrownMassDmgPerSlot
          ? 1 +
            playerCfg.necroCrownMassDmgPerSlot *
              Math.max(0, occupiedGhostSlots(state) - (playerCfg.necroCrownMassSlotThreshold || 3))
          : 1;
      // ghost_060 "Armee der Toten"/allgemeine ghostDamageMult-Karten wirken
      // bereits ueber g.cfg.damage (resolveGhostCfg()) -- hier nur die
      // dynamischen, NICHT in die cfg gebackenen Legion-/Champion-Multiplikatoren.
      let dmg = Math.round(
        g.cfg.damage *
          packMult *
          officerDmgMult *
          stormDmgMult *
          kernMult *
          soloMult *
          eliteBossMult *
          anchorMult *
          fusionStackMult *
          alphaMult *
          hybridMult *
          crownProcMult *
          massMult,
      );
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
      // ghost_074 "Verdichtete Geschosse" (+ Fusionsstapel, mit Einziger
      // Thron) und ghost_066 "Vorrang des Staerkeren" (nur Champion):
      // Projektilgroesse/-tempo-Boni.
      const sizePct = g.isChampion ? (playerCfg?.necroCrownBulletSizePct || 0) + (g.fusionBulletSizeBonus || 0) : 0;
      const spdPct = g.isChampion ? playerCfg?.necroCrownBulletSpeedPct || 0 : 0;
      // ghost_077 "Seelenverdichtung"/ghost_078 "Alpha-Schuss": Durchschlag.
      const pierceAdd =
        (g.isChampion ? playerCfg?.necroCrownPierceAdd || 0 : 0) + (isAlphaShot ? playerCfg?.necroCrownAlphaShotPierceAdd || 0 : 0);
      state.bullets.push(
        createBullet(g.x + aimDx * muzzle, g.y + aimDy * muzzle, g.turret, {
          speed: g.cfg.bulletSpeed * (1 + spdPct) * (overwhelm ? playerCfg.necroOverwhelmBulletSpeedMult || 1 : 1),
          radius:
            state.data.physics.bulletRadius * (1 + sizePct) * (overwhelm ? playerCfg.necroOverwhelmBulletSizeMult || 1 : 1),
          owner: g,
          kind: g.cfg.weapon,
          damage: dmg,
          damageType: g.cfg.damageType,
          crit: ghostCrit,
          // ghost_069 "Kritische Krone": eigener additiver Krit-Schaden-Bonus
          // NUR fuer den Champion, EIGENES Feld (nicht g.cfg.critMultBonus) --
          // die dortige Doppel-Zaehl-Falle betrifft nur die Dauer-cfg des
          // Geistes selbst, nicht diesen einmaligen Kroenen-Zuschlag.
          critMultBonus: crownCritMultAdd,
          pierce: g.cfg.pierce ? g.cfg.pierce + pierceAdd : pierceAdd || undefined,
        }),
      );
      // ghost_076 "Erbgeschuetz": jeder dritte Schuss des Champions feuert
      // ein ZUSAETZLICHES Geschoss mit reduziertem Schaden -- in dieselbe
      // Richtung, keine eigene Feuerrate/Cooldown-Kosten.
      if (
        g.isChampion &&
        playerCfg?.necroCrownEveryNShots &&
        g.shotCount % playerCfg.necroCrownEveryNShots === 0
      ) {
        state.bullets.push(
          createBullet(g.x + aimDx * muzzle, g.y + aimDy * muzzle, g.turret, {
            speed: g.cfg.bulletSpeed,
            radius: state.data.physics.bulletRadius,
            owner: g,
            kind: g.cfg.weapon,
            damage: Math.round(dmg * (playerCfg.necroCrownExtraShotDamagePct || 0)),
            damageType: g.cfg.damageType,
          }),
        );
      }
      // Feuerrate: Zaehler-Cache (040) + Offizier-Aura (049) additiv als
      // Prozentsaetze summiert, dann EIN Cooldown-Faktor -- fireRateFactor()
      // (1/(1+pct)) statt der alten, bei pct>=0.9 gedeckelten Formel, damit
      // die Feuerrate ohne Obergrenze weiter waechst (Auftrag Abschnitt 9).
      // ghost_050 "Munitionsaustausch" erhoeht danach den raumweiten Stapel
      // OHNE Deckel fuer den NAECHSTEN Schuss (wirkt erst auf folgende
      // Schuesse).
      const ammoExchangePct = getNecroStack(state, 'room', '_legionAmmoExchange');
      // ghost_062 "Einsamer Waechter": +Feuerrate solange allein.
      const soloFireRatePct = aliveGhosts.length === 1 ? playerCfg?.necroSoloFireRatePct || 0 : 0;
      // ghost_103 "Massenkrone": ist AUSSER dem Champion kein Platz belegt,
      // zusaetzlich +X% Feuerrate.
      const massSoloFireRatePct =
        g.isChampion && occupiedGhostSlots(state) <= (g.slotCost || 1) ? playerCfg?.necroCrownMassSoloFireRatePct || 0 : 0;
      const fireRatePct =
        (state.necroLegionFireRatePct || 0) + officerFireRatePct + ammoExchangePct + soloFireRatePct + massSoloFireRatePct;
      g.cooldown = g.cfg.fireCooldown * fireRateFactor(fireRatePct);
      if (playerCfg?.necroAmmoExchangePerShot) {
        addNecroStack(state, 'room', '_legionAmmoExchange', playerCfg.necroAmmoExchangePerShot);
      }
      // Geister kaempfen auf Spielerseite -> der freundliche Schuss-Ton.
      state.sounds.push({ name: 'shoot', x: g.x });
    }
  }
  // Champion-Bestimmung ist seit Nekromant-V2 Phase 8 an den ANFANG der
  // Funktion gewandert (s. dort) -- nur noch das Aufraeumen toter Geister
  // bleibt hier am Ende.
  state.ghosts = state.ghosts.filter((g) => g.alive);
}
