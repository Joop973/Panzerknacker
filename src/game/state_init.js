// Reine Datenfeld-Initialisierung des `state`-Objekts: aus state.js
// ausgelagert (AUFTRAG-FERTIGSTELLUNG Phase A2), damit die Datei unter der
// ~300-Zeilen-Konvention bleibt. `buildInitialFields()` liefert GENAU den
// Objektliteral-Teil von createState() -- keine Methode, keine Logik ausser
// den schon in der Original-Datei vorhandenen Default-Ausdruecken
// (`|| []`, `?? 1` usw.). Die drei Methoden-Factories (createWorldMethods/
// createDamageMethods/createFxMethods) werden per Object.assign() DANACH auf
// den zurueckgegebenen `state` gemischt -- diese Funktion selbst kennt keine
// Methoden.
//
// opts ist dasselbe rohe Optionsobjekt, das createState() bekommt --
// dieselbe Destrukturierung wie dort, keine zweite Quelle der Wahrheit.
// `room`/`grid`/`walls`/`tanks`/`player`/`pendingWave` sind die schon in
// createState() berechneten Lokalvariablen; `hazard`/`movingWalls`/
// `oilCells`/`conveyor`/`laserWalls` ebenso (reine Ableitungen aus
// room/walls, bleiben in createState(), um diese Funktion nicht mit noch
// mehr Berechnungslogik zu belasten).

import { mulberry32 } from '../core/rng.js';

export function buildInitialFields(data, tiles, room, grid, walls, tanks, player, pendingWave, hazardBundle, opts) {
  const { genRng, enemyTypes, aiSeed, fixedRoom, weights, playerUpgrades, upgradesData, shieldCharges,
    roomSpec, arenas, transform, equippedSecondary, equippedGadget, waveSplit, waveCfg, eliteAffixes, modifier,
    destructibleWalls, hazardType, roomContext, hpScale, hpSkipBosses, upgradeLevels, levelBalance,
    makelRemoved, makelUmgepolt, makelSchwereOverride, makelNarbenCount,
    starterTank = 'player', starterScrap = 0, actEnemyPool, necroRunStacksBase,
    necroRunDmgBonus = 0, necroRunHpBonus = 0 } = opts;
  const { hazard, movingWalls, oilCells, conveyor, laserWalls } = hazardBundle;

  return {
    data,
    tiles,
    playerUpgrades,
    upgradesData,
    upgradeLevels, // Grundsteinumbau Phase 7: fuer respawnPlayer()
    levelBalance,
    makelRemoved, // Phase M3 (AUFTRAG-UMBAU-V2.md): fuer respawnPlayer()
    makelUmgepolt, // Phase M4: dito, fuer respawnPlayer()
    makelSchwereOverride, // Phase M4: dito, fuer respawnPlayer()
    makelNarbenCount, // Phase M4: dito, fuer respawnPlayer()
    equippedSecondary: equippedSecondary || 'mine', // Phase 6: fuer respawnPlayer()
    equippedGadget: equippedGadget || null, // P4: zweiter Slot, ebenfalls fuer respawnPlayer()
    starterTank, // Phase 9: gewaehlte Klasse -- respawnPlayer() baut denselben Panzer
    starterScrap, // Phase 9: Schrottstand fuer das Schrottpanzer-Passiv (pro Raum gebacken)
    necroRunDmgBonus, // Nekromant-V2 Phase 6: respawnPlayer() baut denselben Bonus nach
    necroRunHpBonus,
    // Nekromant-V2 Phase 3: Gegnertypen, die zum jetzigen Zeitpunkt des Akts
    // freigeschaltet sind -- tank.js: spawnGhostBomb() zieht daraus einen
    // zufaelligen Typ. run.js: buildCombatRoom() liefert die echte Liste;
    // Fallback [] fuer isolierte Test-/Debug-Raeume ohne Akt-Kontext.
    actEnemyPool: actEnemyPool || [],
    // Nekromant-V2 Phase 5 (Ereignis-/Stapelschicht): reine Infrastruktur,
    // aktuell hoert keine Karte zu (necroListeners bleibt leer, Phase 6+
    // fuellt ihn beim Roomaufbau). necroStacks/necroTimedStacks/
    // necroCooldownReadyAt sind raumweit und brauchen keinen expliziten
    // reset() -- state wird bei jedem Raumwechsel ohnehin frisch angelegt.
    // necroRunStackGain ist der raumlokale, monoton wachsende Anteil eines
    // runweiten Stapels -- run.js: stepRun() synchronisiert ihn per Delta
    // (Muster wie bonusScrap/seenBonusScrap) in run.necroStacks;
    // necroRunStacksBase ist der zu Raumbeginn kopierte Stand DIESES
    // Speichers, damit ein Lesezugriff waehrend des Raums den korrekten
    // Gesamtwert sieht (s. necro.js: getNecroStack()).
    necroListeners: [],
    // ghost_025 "Letzte Deckung": einmal pro Raum -- state ist pro Raum
    // frisch, also genuegt ein einfaches false hier (kein reset() noetig).
    necroLastStandUsed: false,
    // Nekromant-V2 Phase 7 (Legion): Cache-Defaults fuer die zaehlerbasierte
    // Skalierung (recomputeLegionCache() in ghost.js) -- gueltig, bis der
    // erste Spawn/Entfernen-Aufruf sie neu setzt (bei 0 Untertanen ohnehin
    // die richtigen Neutralwerte).
    necroActiveGhostCount: 0,
    necroLegionResistBonus: 0,
    necroPackMult: 1,
    necroLegionFireRatePct: 0,
    necroOverwhelmActive: false,
    necroSharedWillActive: false,
    // ghost_059 "Grabfeld": die letzten 3 Sterbeorte VON UNTERTANEN, raumweit
    // (kein reset() noetig, state ist pro Raum frisch).
    necroGraveyardSpots: [],
    // ghost_041 "Geteiltes Ziel": das zuletzt vom SPIELER getroffene Ziel.
    necroLastPlayerHitTarget: null,
    // ghost_054 "Legionskern": bis Raumende aktiver Schadensbonus fuer ALLE
    // Untertanen, sobald eine Wiederbelebungsprobe am vollen Limit gelingt.
    necroLegionKernActive: false,
    necroCoreCooldownUntil: 0,
    // ghost_080 "Kronenerbe" (Nekromant-V2 Phase 8): merkt sich beim Tod des
    // Champions ein Zeitfenster + einen Anteil seiner Fusionsboni fuer den
    // naechsten erscheinenden Untertan (ghost.js: createGhost()). "Einmal pro
    // Raum" -- necroCrownHeirUsed sperrt weitere Erbschaften (state ist pro
    // Raum frisch, kein reset() noetig).
    necroCrownHeir: null,
    necroCrownHeirUsed: false,
    // Nekromant-V2 Phase 9: ghost_089/104 garantieren "die naechste
    // Wiederbelebungsprobe" -- Fenster (089) bzw. Einmal-Flag (104), beide
    // sofort nach Verbrauch zurueckgesetzt (s. killTank()s Revive-Block).
    necroGuaranteedReviveUntil: 0,
    necroCircleGuaranteedRevive: false,
    necroCircleReviveStatPct: 0,
    // ghost_099 "Kroenungszug": raumweiter, dauerhafter Schadensbonus NUR
    // fuer den CHAMPION (ghost.js liest ihn, necro.js: necroDamagePct()
    // wirkt bewusst NICHT darauf -- das ist der Hauptpanzer-Kanal).
    necroCoronationPermDmgPct: 0,
    // ghost_100 "Ersatzkoerper": einmal pro Raum.
    necroSuccessionUsed: false,
    necroStacks: {},
    necroRunStackGain: {},
    necroRunStacksBase: necroRunStacksBase || {},
    necroTimedStacks: {},
    necroCooldownReadyAt: {},
    necroEventLog: [],
    // Nekromant-V2 Phase 10 (Lesbarkeit und Telemetrie): raumweite Rohzaehler
    // fuer main.js/telemetry.js -- werden dort nur ABGELESEN (nie
    // zurueckgeschrieben), wie ghostKills/playerShots weiter unten. Erzeugt
    // in ghost.js: pushGhost() (created)/fuseGhost() (fused)/killGhost()
    // (diedByReason), Wiederbelebungsquote in killTank()s Revive-Block,
    // Championstaerke jeden updateGhosts()-Tick, Bossschuesse in bossai.js.
    necroGhostsCreated: 0,
    necroGhostsFused: 0,
    necroGhostsDiedByReason: { death_damage: 0, death_expire: 0, sacrifice: 0 },
    necroReviveRolls: 0,
    necroReviveHits: 0,
    necroChampionStrengthSum: 0,
    necroChampionStrengthSamples: 0,
    bossShotsAtPlayer: 0,
    bossShotsAtGhost: 0,
    roomContext: roomContext || null, // { elite, boss } -- raumabhaengige Karten
    // LP-Skalierung dieses Raums (Phase 2) -- gemerkt, damit die zweite
    // Welle (updateWave) dieselben Werte bekommt wie die erste.
    // Blitzketten-Bogen (Phase 6): reine Anzeige, altert in stepState().
    lightningArcs: [],
    hpScale: hpScale ?? 1,
    hpSkipBosses: !!hpSkipBosses,
    rng: mulberry32((aiSeed ^ 0x9e3779b9) >>> 0), // KI-Strom, getrennt
    playerSpawn: room.playerSpawn,
    emergencyRoom: room.emergency,
    enemyKills: 0, // in diesem Raum getoetete Gegner
    playerDeaths: 0, // Tode des Spielers in diesem Raum
    playerShots: 0, // Spieler-Abzuege in diesem Raum (Trefferquote)
    // Grundsteinumbau Phase 2: Kampfkern-Telemetrie (Entscheidung I -- erst
    // messen, dann an LP/Balance drehen). playerHits zaehlt Treffer auf
    // Panzer (nicht Waende), magBlockedTime die Sekunden, in denen ein
    // gehaltener Feuerbefehl am vollen Magazin scheiterte (nicht am
    // Nachladen -- das ist normale Kadenz, kein Blockieren).
    playerHits: 0,
    magBlockedTime: 0,
    // Heck-Kill-Zeitlupe (Ersatz fuer den alten Trickshot-Moment, s.
    // stepRun() in run.js): laeuft wie blockedShotTimer unten in stepState()
    // herunter.
    rearKillTimer: 0,
    // UMBAUPLAN-LP Phase 8: Schaden je Schadenstyp, den der SPIELER an Gegnern
    // anrichtet -- die neue Telemetrie-Grundlage, die die ausgemusterten
    // USP-Kennzahlen (u. a. die freiwilligen Bankshots) ersetzt.
    damageByType: { physical: 0, explosive: 0, fire: 0, frost: 0, poison: 0, lightning: 0 },
    secondaryUses: 0,
    gadgetUses: 0, // P4: Nutzungen des zweiten Slots (Telemetrie)
    powershotsFired: 0,
    ghostKills: 0, // Phase 7: Kills durch Geister-Kugeln (nicht dem Spieler zugerechnet)
    // Beutejagd-Upgrade (Phase 18): eigener Raum-Zaehler fuer Schrott-Boni
    // ausserhalb des (mit dem Bandenschuss entfallenen) Trickshot-Systems --
    // run.js liest ihn per Sync-Delta wie bisher.
    bonusScrap: 0,
    firstKillGiven: false, // pro Raum einmalig, NICHT bei respawnPlayer() zuruecksetzen
    // Notschild-Ladungen als Liste: jede Ladung altert EINZELN (E2).
    // Eintrag = verbleibende geraeumte Raeume bis zum Verfall.
    shieldCharges: (shieldCharges || []).slice(),
    transform: transform || {}, // Phase 5: freigeschaltete Transformations-Effekte
    smokeClouds: [], // Phase 6: Rauchgranate -- blockiert nur KI-Sichtlinien
    pendingWave, // Phase 9: zurueckgehaltene zweite Welle (oder null)
    eliteAffixes: eliteAffixes || null, // Phase 9: fuer spaeter nachspawnende Welle
    modifier: modifier || null, // Phase 10: Raum-Modifikator (data/modifiers.json)
    // Deckungs-KI (Phase 16): 15-Hz-Takt + Reihum-Cursor fuer
    // updateCoverPerception() -- siehe ai.js.
    coverTimer: 0,
    coverCursor: 0,
    // Sperre fuer die "Magazin voll"-Rueckmeldung (tank.js:
    // signalBlockedShot) -- sonst klickt es bei gehaltenem Abzug dauernd.
    blockedShotTimer: 0,
    // Reaktor-Boss (Phase 14): Anzahl noch stehender Generatoren -- solange
    // > 0, faengt killTank() jeden Treffer auf t.cfg.bossInvincible ab.
    // Aus den Wandobjekten gezaehlt (nicht aus room.markers -- die Generator-
    // Waende sind bereits normale, aus dem Grid gebaute WALL_TYPES-Eintraege).
    bossGeneratorsLeft: walls.filter((w) => w.type === 'generator').length,
    // Raum-Gefahr (Phase 15): hoechstens EINE davon ist je Raum aktiv, der
    // Rest bleibt leer/null. `hazard` selbst nur fuer Vorschau/Rendering.
    hazard,
    movingWalls,
    movingWallTimer: hazard?.type === 'movingWall' ? hazard.intervalS : 0,
    oilCells, // Set<"col,row"> | null -- tank.js: Grip-Physik pro Kachel
    conveyor, // {cells:Set<"col,row">, dir:{x,y}, pushPx} | null
    laserWalls, // NIE in `walls`: blockt nur Geschosse (bullet.js), keine Panzer
    walls,
    // G5 (t_mason): das rohe Grid-Zeichen-Array. War bis dahin komplett
    // Closure-lokal (nur ueber Methoden wie isSolid()/placeTrapWall()
    // erreichbar) -- t_masons Zellenwahl braucht Lesezugriff auf EXAKT das
    // aktuelle Zeichen ('.' = frei), nicht nur ein Boolean. Muster wie
    // `walls` direkt oben: dieselbe Referenz, kein zweites Grid.
    grid,
    tanks,
    player,
    bullets: [],
    mines: [],
    // Spinnenboss-Auftrag: spiderBoss ist eine bequeme direkte Referenz auf
    // die t_spider-Tankinstanz (falls dieser Raum einer ist) -- erspart ein
    // wiederholtes state.tanks.find(...) an mehreren Stellen (Geschossbudget,
    // Rendering, Leg-Hit-Schleife). spiderMines/spiderWebs/spiderFlowField
    // sind eigene, von state.mines GETRENNTE Arrays (s. spidermine.js).
    spiderBoss: tanks.find((t) => t.cfg.spiderBoss) || null,
    spiderMines: [],
    spiderWebs: [],
    spiderFlowField: null,
    spiderPillars: null,
    // Amboss-Auftrag: bequeme direkte Referenz (Muster wie spiderBoss oben)
    // -- src/game/anvil.js, mine.js und die Trefferschleife weiter unten
    // lesen sie, statt jedes Mal state.tanks zu durchsuchen. anvilShockwaves/
    // anvilTrails sind eigene, von state.mines GETRENNTE Arrays fuer die
    // beiden ueberdauernden Angriffs-Gefahrenflaechen (Hammerschlag/
    // Schleifspur, s. src/game/anvil.js).
    anvilBoss: tanks.find((t) => t.cfg.anvilBoss) || null,
    anvilShockwaves: [],
    anvilTrails: [],
    // Gegner-Umbau Baustein B (Verbindungslinien, G1): EIN geteiltes Array
    // fuer alle fuenf Linienarten (Heilstrahl/Lichtfaden/Fahnenlinie/Kette/
    // Leine), von der jeweiligen Gegner-Stepfunktion jeden Tick neu befuellt
    // (Muster wie anvilShockwaves/anvilTrails oben) und von
    // effects.js: drawTankLinks() generisch gezeichnet. Populiert seit G3
    // (t_relay: Lichtfaden) und G5 (t_medic: Heilstrahl).
    tankLinks: [],
    // G8 (t_metronom): die lebenden Taktgeber dieses Ticks, einmal pro Tick
    // von updateMetronomes() gesetzt -- metronomeHolds() liest nur noch sie.
    metronomes: [],
    deathFuses: [], // G2: verzoegerte Todesexplosion (t_dud), s. killTank()/updateDeathFuses()
    // G5 (t_mason): 0,8-s-Geruest-Telegraph pro Bauversuch, eigener kleiner
    // Renderer (effects.js: drawMasonScaffolds) -- kein Baustein C (das ist
    // eine wachsende Kreisflaeche, hier ein statisches Quadrat).
    masonScaffolds: [],
    traps: [],
    mortars: [], // Grundsteinumbau Phase 3: fliegende Moerser-Granaten (t_green)
    ghosts: [], // Phase 7: Geisterpanzer (kein Eintrag in tanks -- s. ghost.js)
    explosions: [],
    flashes: [],
    sounds: [],
    particles: [],
    texts: [], // schwebende Kurztexte { x, y, text, age, life, color }
    killLog: [], // Typen der in diesem Raum getoeteten Gegner (Statistik)
    damageFlash: 0, // roter Bildschirm-Flash nach eigenem Tod (Rendering)
    shake: 0, // Screenshake-Staerke (nur Rendering)
    time: 0,
    respawnTimer: 0,
  };
}
