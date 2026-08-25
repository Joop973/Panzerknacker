// Run-Struktur (Spec Abschnitt 8, Grundsteinumbau Phase 6): DREI AKTE mit je
// 16 generierten Raeumen + eigenem Bossraum (~51 Raeume gesamt), Leben,
// Gefahrenbudget mit Freischaltkurve, Raum-Neustart bei Tod (getoetete
// Gegner bleiben tot), Raumuebergangs-Einblendung, Akt-Uebergang mit
// Lebensbonus, Victory/Game-Over mit Statistik und Seed.
//
// RNG (Phase 0b, act-erweitert in Phase 6): Der Run haelt KEINEN
// fortlaufenden Zufallszustand mehr. Pro Raum werden benannte Stroeme aus
// hash(seed, actRoomKey, label) abgeleitet (siehe makeRoomStreams/
// actRoomKey) -- actRoomKey kombiniert Akt- und (akt-lokale) Raumnummer, weil
// run.roomIndex innerhalb jedes Akts bei 1 neu beginnt (Akt-1-Raum-1 und
// Akt-2-Raum-1 duerfen NICHT dieselben RNG-Stroeme ziehen). Damit ist ein Run
// allein aus Seed + Akt + Raumnummer reproduzierbar (Fortsetzen, geteilte
// Seeds, Replays), und eine Aenderung an einem System verschiebt die anderen
// nicht.

import { rngFor, rngForRun, hashSeed } from '../core/rng.js';
import { recordRun, loadStats, saveCurrentRun, clearCurrentRun } from '../core/storage.js';
import { createState, stepState } from './state.js';
import { rollOffers as rollFromPool, drawOne, rewardRarityWeights, shopRarityWeights, eliteRarityWeights } from './upgradepool.js';
import { arenaEnemySpawnCount } from './generator.js';

const TRANSITION_S = 1.5;
const COMBO_WINDOW = 2.5; // s: Zeitfenster fuer die naechste Combo-Kill

// Boss-Panzertypen je Arena (Phase 14) -- kommen IMMER zuerst in enemyTypes,
// die restlichen Slots (bis zur Spawnzahl der Arena) fuellt buyEnemies() wie
// bisher mit gekaufter Unterstuetzung.
//
// PLATZHALTER (Nutzerentscheidung nach Grundsteinumbau-Phase 0, 2026-08-17):
// die drei eigentlichen Bosse (t_reactor/t_mirror/t_phalanx) sind noch nicht
// ausgearbeitet und werden in einer eigenen kuenftigen Aufgabe neu gebaut --
// die alte Mechanik (Reaktor-Generatoren, Spiegelbewegung, rotierende
// Phalanx-Formation) hat "keine Bewandtnis mehr" und wird deshalb bewusst
// NICHT mehr angesteuert. Bis dahin spawnt jede der drei Boss-Arenen
// stattdessen einen einzelnen t_black als Platzhalter-Gegner; die restlichen
// Spawnpunkte der Arena (v. a. bei boss_phalanx, 5 Slots) fuellt weiterhin
// die normale Untersttuetzungs-Einkaufslogik. t_reactor/t_mirror/t_phalanx,
// bossai.js, die boss_*-Arenen (data/arenas.json) und die Panzerungslogik
// dahinter bleiben unangetastet im Code/in den Daten stehen (nichts geloescht,
// nur nicht mehr erreicht) -- siehe CLAUDE.md, Abschnitt "Bosse (Platzhalter)".
// Spinnenboss-Auftrag: Akt 3 (data/difficulty.json: acts[2].boss) zeigt
// jetzt auf 'boss_spider' statt 'boss_phalanx' -- t_spider ist kein
// Platzhalter mehr, sondern der echte, ausgearbeitete Bosstyp. Die Arena
// hat bewusst nur EINEN Gegner-Spawn (arenaEnemySpawnCount()===1), es
// spawnt also ausschliesslich der Spinnenboss, keine eingekaufte
// Unterstuetzung (Abschnitt 6/26).
// Amboss-Auftrag: Akt 2 (acts[1].boss) zeigt jetzt auf 'boss_anvil' statt
// 'boss_mirror' -- t_anvil ist wie t_spider ein echter, ausgearbeiteter
// Bosstyp (kein Platzhalter mehr). boss_anvil hat ebenfalls nur EINEN
// Gegner-Spawn (arenaEnemySpawnCount()===1), es spawnt also ausschliesslich
// der Amboss, keine eingekaufte Unterstuetzung -- supportBudget bleibt
// global unveraendert, greift hier aber durch den einzelnen Spawnplatz nie.
const BOSS_ENEMY_TYPES = {
  boss_reactor: ['t_black'],
  boss_anvil: ['t_anvil'],
  boss_phalanx: ['t_black'],
  boss_spider: ['t_spider'],
};

// Raumtyp -> Anzeige (Raumvorschau + Kartenscreen, Phase 12). Symbole sind
// DOM-Emojis. War bis Phase 12 nur in der Vorschau sichtbar (der Raumtyp
// selbst wurde unsichtbar automatisch gewuerfelt) -- jetzt zusaetzlich fuer
// die Knoten der Kartenanzeige wiederverwendet.
export const ROOM_TYPE_INFO = {
  combat: { name: 'Kampf', symbol: '⚔️', desc: 'Ein normaler Gefechtsraum.' },
  elite: { name: 'Elite', symbol: '★', desc: 'Härtere Gegner mit Affix · doppelter Schrott · Elite-Belohnung.' },
  // Grundsteinumbau Phase 4: der Sockel hat keine einzige legendaere Karte
  // mehr -- treasure gibt deshalb ein Schrottpaket statt einer Kartenwahl
  // (grantTreasureScrap()). rollReward()s onlyRarity:'legendary'-Zweig
  // bleibt als Wiederanschlusspunkt bestehen (archive/systeme-v1.md).
  // Grundsteinumbau Phase 9: cursed ist NICHT mehr Teil davon -- Fluchraeume
  // geben wieder eine normale Kartenwahl (Auftrag: "Kartenangebot nach
  // Kampf-, Elite- und Fluchraeumen").
  treasure: { name: 'Schatz', symbol: '💎', desc: 'Keine Gegner · Schrottpaket — kostet 1 Leben.' },
  workshop: { name: 'Shop', symbol: '🛒', desc: 'Keine Gegner · Karten, Schild, Sekundärwaffe, Leben kaufen · Upgrade ablegen.' },
  event: { name: 'Ereignis', symbol: '❓', desc: 'Keine Gegner · eine Entscheidung.' },
  cursed: { name: 'Verflucht', symbol: '☠️', desc: 'Gegner mit zusätzlichem Affix · Kartenwahl.' },
  // Grundsteinumbau Phase 7: Reparaturtrupp (+1 Leben) ODER Werkbank (ein
  // vorhandenes Upgrade eine Stufe aufwerten) -- genau eine der beiden
  // Aktionen, danach ist der Raum sofort zu Ende (kein Kartenscreen danach,
  // s. roomscreens.js: createRestScreen()).
  rest: { name: 'Rastplatz', symbol: '🏕️', desc: 'Eine Verschnaufpause · ein Leben zurück oder ein Upgrade verbessern.' },
};

// Welche Gegnertypen sind zum jetzigen Zeitpunkt (Akt + akt-lokale
// Raumnummer) ueberhaupt freigeschaltet -- "eingefuehrt in Akt X, bleibt
// danach verfuegbar" (Grundsteinumbau Phase 6). Exportiert und von
// buyEnemies() (Raum-Einkauf) UND der Geisterbombe (Nekromant-V2 Phase 3:
// zufaelliger Typ aus dem Gegnerpool des aktuellen Akts, s. tank.js:
// spawnGhostBomb()) gemeinsam genutzt, damit es nur EINE Freischaltungsregel
// gibt.
export function unlockedEnemyTypes(diff, actIndex, roomIndexInAct) {
  return Object.keys(diff.danger).filter((ty) => {
    const d = diff.danger[ty];
    return actIndex > d.unlockAct || (actIndex === d.unlockAct && roomIndexInAct >= (d.unlockRoomInAct ?? 1));
  });
}

// Kauft Gegner vom Gefahrenbudget (nur freigeschaltete Typen, max. 8).
// `maxPerRoom` in difficulty.json deckelt einzelne Typen zusaetzlich
// (Phase 4: hoechstens ein Prisma pro Raum).
//
// Grundsteinumbau Phase 6: Freischaltung laeuft jetzt ueber unlockAct +
// unlockRoomInAct statt eines einzigen unlockRoom ueber den ganzen Run --
// "eingefuehrt in Akt X, bleibt danach verfuegbar".
// Exportiert (wie upgradepool.js: weightedPick) fuer direkte
// Mechanismus-Tests -- buyEnemies() ist eine reine Funktion ohne Run-Objekt.
export function buyEnemies(diff, genRng, actIndex, roomIndexInAct, budget) {
  const unlocked = unlockedEnemyTypes(diff, actIndex, roomIndexInAct).map((ty) => [ty, diff.danger[ty]]);
  const types = [];
  const taken = {};
  let rest = budget;
  while (types.length < diff.maxEnemiesPerRoom) {
    const affordable = unlocked.filter(
      ([ty, d]) => d.points <= rest && (d.maxPerRoom == null || (taken[ty] || 0) < d.maxPerRoom),
    );
    if (!affordable.length) break;
    const [type, d] = affordable[Math.floor(genRng() * affordable.length)];
    types.push(type);
    taken[type] = (taken[type] || 0) + 1;
    rest -= d.points;
  }
  return types;
}

// Raeume je Akt (inkl. Bossraum) -- fuer die HUD-/Vorschau-Anzeige "Raum
// N/17". actIndex faellt auf den ersten Akt zurueck (z. B. beim allerersten
// Aufruf vor createRun()).
function totalRooms(diff, actIndex = 1) {
  const actCfg = diff.acts[(actIndex || 1) - 1];
  return actCfg.rooms + 1; // 16 + Bossraum
}

// Die alte USP-Garantie "Erzwungene Bankshots" (tauschte ab Raum 6 einen
// gekauften Gegner gegen einen Bankshot-Typ) ist mit dem Bandenschuss
// vollstaendig entfernt (Grundsteinumbau Phase 1) -- der Mechanismus
// (ensureBankshotEnemy(), data/difficulty.json: bankshotGuarantee) stand
// seit UMBAUPLAN-LP Phase 8 ohnehin nur noch als No-op-Wiederanschlusspunkt
// im Code. Details in ARCHIV.md/archive/bandenschuss.md.

function weightedType(list, weights, rng) {
  let total = 0;
  for (const t of list) total += weights[t] || 0;
  let r = rng() * total;
  for (const t of list) {
    r -= weights[t] || 0;
    if (r < 0) return t;
  }
  return list[list.length - 1];
}

// Kanten zwischen zwei aufeinanderfolgenden Kartenreihen (Phase 12).
// a===1 (z. B. Raum 1->2, 2->3): Faecher-AUS -- der einzelne Knoten
// verbindet sich mit JEDEM Knoten der naechsten Reihe (echte erste Wahl).
// b===1 (letzte Reihe -> Boss): Faecher-EIN -- Zusammenlauf, wie von
// PLAN.md gefordert. Sonst: jeder Knoten bekommt eine proportionale
// Hauptkante plus mit extraEdgeChance eine Nebenkante (Ueberkreuzungen),
// danach werden Zielknoten OHNE eingehende Kante von der naechstgelegenen
// Quelle nachverbunden -- kein Knoten bleibt isoliert.
function connectLayers(prevNodes, nextNodes, rng, extraEdgeChance) {
  const a = prevNodes.length;
  const b = nextNodes.length;
  if (a === 1) {
    for (const n of nextNodes) prevNodes[0].next.push(n.id);
    return;
  }
  if (b === 1) {
    for (const n of prevNodes) n.next.push(nextNodes[0].id);
    return;
  }
  for (let i = 0; i < a; i++) {
    const primary = Math.floor((i * b) / a);
    prevNodes[i].next.push(nextNodes[primary].id);
    if (rng() < extraEdgeChance) {
      const alt = (primary + 1) % b;
      if (alt !== primary) prevNodes[i].next.push(nextNodes[alt].id);
    }
  }
  for (let j = 0; j < b; j++) {
    const covered = prevNodes.some((n) => n.next.includes(nextNodes[j].id));
    if (!covered) {
      const nearest = prevNodes[Math.min(a - 1, Math.round((j * (a - 1)) / Math.max(1, b - 1)))];
      nearest.next.push(nextNodes[j].id);
    }
  }
}

// Grundsteinumbau Phase 6: in den ersten drei Ebenen eines Akts sind
// elite/cursed/workshop gesperrt (harte Vorgabe des Auftrags, keine
// Balance-Zahl -- deshalb hier als Konstante, nicht in difficulty.json).
const EARLY_EXCLUDED_TYPES = new Set(['elite', 'cursed', 'workshop']);
const EARLY_LAYERS = 3;

// Kartengenerierung (Phase 12, auf drei Akte erweitert in Grundsteinumbau
// Phase 6): einmalig deterministisch aus dem Seed (eigener Strom PRO AKT --
// core/rng.js: rngForRun mit dem Label 'map_act'+actIndex, damit Akt 1 und
// Akt 2 verschiedene Karten ziehen) -- die Karte eines Akts steht komplett
// fest, sobald er beginnt ("vollstaendig vorab einsehbar", PLAN.md). Die
// ersten beiden Ebenen sind je ein einzelner Kampf-Knoten
// (data/difficulty.json: map.forcedCombatLayers), die letzte Ebene vor dem
// Boss ist komplett 'rest' (garantierter Rastplatz, STS-Konvention),
// dazwischen 2-3 Knoten je Ebene mit Typ aus map.nodeWeights (elite/cursed/
// workshop in den ersten drei Ebenen gesperrt). GENAU EIN Knoten in der
// Mitteltiefe wird zusaetzlich zur Schatzkammer erzwungen (kein gewichteter
// Zufallstyp mehr, s. data/difficulty.json: _comment_map). Letzte Ebene ist
// immer der Bossraum (ein Boss-Knoten).
// Exportiert (wie buyEnemies() oben) fuer direkte Mechanismus-Tests --
// eine reine Funktion (seed/diff/actIndex -> Graph), kein Run-Objekt noetig.
export function generateMap(seed, diff, actIndex) {
  const rng = rngForRun(seed, `map_act${actIndex}`);
  const mapCfg = diff.map || {};
  const weights = mapCfg.nodeWeights;
  const types = Object.keys(weights);
  const earlyTypes = types.filter((t) => !EARLY_EXCLUDED_TYPES.has(t));
  const noRestTypes = types.filter((t) => t !== 'rest');
  const forcedLayers = mapCfg.forcedCombatLayers ?? 2;
  const minN = mapCfg.minNodesPerLayer ?? 2;
  const maxN = mapCfg.maxNodesPerLayer ?? 3;
  const extraEdgeChance = mapCfg.extraEdgeChance ?? 0.4;
  const actRooms = diff.acts[actIndex - 1].rooms;
  const finalIdx = actRooms + 1;

  const layers = [];
  for (let layer = 1; layer <= actRooms; layer++) {
    const forced = layer <= forcedLayers;
    const restLayer = layer === actRooms; // letzte Ebene vor dem Boss
    // Die Ebene direkt VOR der erzwungenen Rast-Ebene darf selbst kein
    // zufaelliges 'rest' ziehen -- sonst waere "zwei Rastplaetze in Folge"
    // an genau dieser Nahtstelle unvermeidbar (der garantierte Rastplatz vor
    // dem Boss hat Vorrang und wird von der Reparatur weiter unten bewusst
    // ausgenommen, s. dort).
    const preRestLayer = layer === actRooms - 1;
    const count = forced ? 1 : minN + Math.floor(rng() * (maxN - minN + 1));
    const nodes = [];
    for (let col = 0; col < count; col++) {
      let type;
      if (forced) type = 'combat';
      else if (restLayer) type = 'rest';
      else {
        let pool = layer <= EARLY_LAYERS ? earlyTypes : types;
        if (preRestLayer) pool = pool.filter((t) => t !== 'rest');
        type = weightedType(pool, weights, rng);
      }
      nodes.push({ id: layer * 10 + col, layer, col, type, isBoss: false, next: [] });
    }
    layers.push(nodes);
  }
  layers.push([{ id: finalIdx * 10, layer: finalIdx, col: 0, type: 'combat', isBoss: true, next: [] }]);

  for (let i = 0; i < layers.length - 1; i++) {
    connectLayers(layers[i], layers[i + 1], rng, extraEdgeChance);
  }

  const byId = new Map();
  for (const layer of layers) for (const n of layer) byId.set(n.id, n);

  // Schatzkammer (Phase 6): GENAU EIN Knoten in der Mitteltiefe wird
  // erzwungen -- deterministisch ueber denselben Strom, nach dem Aufbau der
  // Ebenen/Kanten (Reihenfolge egal, der Typ eines Knotens beeinflusst keine
  // andere Ziehung). Layer wird zwischen den erzwungenen Kampf-Ebenen und
  // der erzwungenen Rast-Ebene geklemmt, sonst koennte treasureLayerFraction
  // bei kleinen Akten auf eine bereits erzwungene Ebene fallen.
  let treasureNode = null;
  {
    const targetLayer = Math.max(
      forcedLayers + 1,
      Math.min(actRooms - 1, Math.round(actRooms * (mapCfg.treasureLayerFraction ?? 0.5))),
    );
    const candidates = layers[targetLayer - 1] || [];
    if (candidates.length) {
      treasureNode = candidates[Math.floor(rng() * candidates.length)];
      treasureNode.type = 'treasure';
    }
  }

  // Reparatur "keine zwei Rastplaetze in Folge" (Phase 6): erst NACH der
  // Kantenerzeugung moeglich (die Nachbarschaft ergibt sich aus den Kanten,
  // nicht aus der Ebenenreihenfolge). Deterministisch in fester Reihenfolge
  // (Ebene, Knoten, Kante) -- ein Folgeknoten, der durch eine bereits
  // reparierte Kante schon umgefaerbt wurde, wird nicht doppelt gewuerfelt.
  // Die erzwungene Rast-Ebene direkt vor dem Boss (restLayer, s. o.) ist
  // von der Reparatur ausgenommen -- sonst koennte sie hier wieder umgefaerbt
  // und der garantierte Rastplatz vor dem Boss gebrochen werden.
  for (const layer of layers) {
    for (const node of layer) {
      if (node.type !== 'rest') continue;
      for (const nid of node.next) {
        const target = byId.get(nid);
        if (target.type === 'rest' && target.layer !== actRooms) {
          const pool = target.layer <= EARLY_LAYERS
            ? earlyTypes.filter((t) => t !== 'rest')
            : noRestTypes;
          target.type = weightedType(pool, weights, rng);
        }
      }
    }
  }

  // Sicherheitsnetz: `treasure` ist bei zu wenig Leben nicht waehlbar
  // (chooseMapNode()) -- ein Knoten, dessen EINZIGE Kante zur Schatzkammer
  // fuehrt, waere bei 1 Leben eine Sackgasse. Anders als im alten System
  // (mehrere zufaellig verteilte Schatzkammern, "erste Alternative
  // umfaerben" war dort ein sicherer Fix) gibt es seit Phase 6 nur noch
  // GENAU EINEN Schatz-Knoten (s. o.) -- ihn umzufaerben wuerde diese
  // Zusicherung brechen. Der betroffene Knoten bekommt stattdessen eine
  // zusaetzliche Kante zu einem ANDEREN Knoten derselben Ebene (Fluchtweg
  // statt Farbwechsel) -- die Ebene hat dank map.minNodesPerLayer >= 2
  // immer mindestens einen weiteren Knoten (die Schatz-Ebene liegt nie auf
  // einer erzwungenen Ebene mit nur einem Knoten, s. Klemmung oben).
  if (treasureNode) {
    const siblings = layers[treasureNode.layer - 1].filter((n) => n.id !== treasureNode.id);
    if (siblings.length) {
      for (const layer of layers) {
        for (const node of layer) {
          if (node.next.length === 1 && node.next[0] === treasureNode.id) {
            node.next.push(siblings[0].id);
          }
        }
      }
    }
  }
  return { layers, byId };
}

// Bestwertes Fallback, falls ein aeltere Zwischenstand ohne mapCurrentId
// fortgesetzt wird (kein harter Fehlerfall -- neue Karten-Daten fehlen nur
// bei einem VOR Phase 12 gespeicherten Run).
function findMapNodeFallback(run, roomIndex, roomType) {
  const layer = run.map.layers[roomIndex - 1];
  if (!layer) return null;
  return (layer.find((n) => n.type === roomType) || layer[0])?.id ?? null;
}

// Grundsteinumbau Phase 6: run.roomIndex faengt in JEDEM Akt wieder bei 1 an
// (s. Kopfkommentar) -- ein reiner rngFor(seed, roomIndex, label)-Aufruf
// wuerde Akt-1-Raum-1 und Akt-2-Raum-1 also identische Stroeme geben. Der
// kombinierte Schluessel haelt Akt und Raum auseinander; 100 liegt sicher
// ueber der groessten moeglichen akt-lokalen Raumnummer (16 Raeume + Boss).
function actRoomKey(run) {
  return (run.actIndex - 1) * 100 + run.roomIndex;
}

// Kartenbelohnung/Shop-Ueberarbeitung: Bestwertes Fallback fuer
// run.totalRoomIndex bei einem ALTEN Zwischenstand (vor dieser Aenderung),
// der das Feld noch nicht kennt -- summiert die Raumzahl (inkl. Bossraum)
// jedes bereits ABGESCHLOSSENEN Akts vor r.actIndex plus die akt-lokale
// Raumnummer selbst. Reine Migrationshilfe fuer einen einmaligen Ladevorgang,
// beeinflusst keinen neuen Run (der startet immer bei 1, s. createRun()).
function estimateTotalRoomIndex(run, r) {
  const acts = run.difficulty.acts || [];
  let total = 0;
  for (let i = 0; i < (r.actIndex || 1) - 1; i++) total += (acts[i]?.rooms ?? 16) + 1;
  return total + (r.roomIndex || 1);
}

// Benannte RNG-Stroeme fuer den aktuellen Raum neu ableiten. Getrennte
// Labels sorgen dafuer, dass z. B. eine geaenderte Upgrade-Logik die
// Raumlayouts nicht verschiebt.
function makeRoomStreams(run) {
  const s = run.seed;
  const i = actRoomKey(run);
  run.rng = {
    rooms: rngFor(s, i, 'rooms'), // Layout, Kachelwahl, Spawns
    enemies: rngFor(s, i, 'enemies'), // Gegner-Einkauf + Elite-Affix
    upgrades: rngFor(s, i, 'upgrades'), // Upgrade-Angebote (inkl. Rerolls)
    scrap: rngFor(s, i, 'scrap'), // Schrottmenge
    events: rngFor(s, i, 'events'), // Ereignis-Auswahl
    modifiers: rngFor(s, i, 'modifiers'), // Raum-Modifikator (Phase 10)
    hazards: rngFor(s, i, 'hazards'), // Raum-Gefahr (Phase 15)
  };
}

// Neue Notschild-Ladungen mit voller Restlaufzeit (E2: shield.roomLifetime).
function addShieldCharges(run, n) {
  const life = run.data.balance.shield?.roomLifetime ?? Infinity;
  for (let i = 0; i < n; i++) run.shieldCharges.push(life);
}

// Nach einem geraeumten Raum altern alle Ladungen um eins; abgelaufene
// verfallen (E2: kein unbegrenztes Bunkern).
function ageShieldCharges(run) {
  run.shieldCharges = run.shieldCharges.map((r) => r - 1).filter((r) => r > 0);
}

// Zustand fuer "Run fortsetzen?" -- nur Werte, die den Raumanfang
// beschreiben (kein Kampfzustand). Wird beim Betreten eines Raums
// geschrieben.
export function runSnapshot(run) {
  return {
    schema: 1,
    seed: run.seed,
    modeKey: run.modeKey,
    starterTank: run.starterTank, // Phase 9: die Klasse gehoert in die Seed-Wiedergabe
    actIndex: run.actIndex, // Grundsteinumbau Phase 6: welcher Akt (1-3)
    roomIndex: run.roomIndex, // akt-lokal (1..17), faengt pro Akt neu bei 1 an
    // Kartenbelohnung/Shop-Ueberarbeitung: totalRoomIndex ist RUNWEIT (faengt
    // NIE pro Akt neu an, s. estimateTotalRoomIndex()-Kommentar oben) --
    // treibt die Seltenheitsbaender fuer normale Kartenbelohnungen.
    // shopsVisited zaehlt echte Shop-EINTRITTE (nicht Neu-Rendern/Aktionen
    // im Shop) -- treibt die eigenstaendigen Shop-Seltenheitsbaender.
    totalRoomIndex: run.totalRoomIndex,
    shopsVisited: run.shopsVisited,
    roomType: run.roomType,
    mapCurrentId: run.mapCurrentId, // Phase 12: Position auf der Karte (Wahl, nicht ableitbar)
    lives: run.lives,
    shieldCharges: run.shieldCharges.slice(), // mit Restlaufzeit je Ladung
    scrap: run.scrap,
    upgrades: { ...run.upgrades },
    upgradeLevels: { ...run.upgradeLevels }, // Grundsteinumbau Phase 7
    equippedSecondary: run.equippedSecondary,
    equippedGadget: run.equippedGadget,
    banned: [...run.bannedUpgrades],
    selectedUniqueUpgradeIds: [...run.selectedUniqueUpgradeIds], // Nekromant-V2 Phase 1
    tagCounts: { ...run.tagCounts },
    synergyTags: { ...run.synergyTags }, // Upgradepool-v2 Phase 3
    necroStacks: { ...run.necroStacks }, // Nekromant-V2 Phase 5: runweite Stapel
    transformations: [...run.transformations],
    endless: !!run.endless,
    playTime: run.playTime,
    kills: run.kills,
    deaths: run.deaths,
    roomsCleared: run.roomsCleared,
  };
}

function resetRoomCounters(run) {
  run.seenRoomKills = 0;
  run.seenRoomDeaths = 0;
  run.seenKillLog = 0;
  run.seenRoomShots = 0;
  run.seenBonusScrap = 0;
  run.seenNecroRunStackGain = {}; // Nekromant-V2 Phase 5: raumlokaler Delta-Sync-Stand
  run.combo = 0; // Combo gilt nur innerhalb eines Raums
  run.comboTimer = 0;
}

// Baut einen Raum vom gegebenen Typ (Phase 4). Kampf-/Eliteraeume bauen
// eine Arena; Nicht-Kampf-Raeume (treasure/workshop/event/rest) behalten den
// geraeumten Vorraum als Kulisse und starten ihre Interaktion.
//
// Grundsteinumbau Phase 6: "final" heisst jetzt "Bossraum DIESES Akts", nicht
// mehr zwingend das Ende des Runs -- run.isActBoss haelt das fest, stepRun()
// entscheidet anhand von run.actIndex, ob danach der naechste Akt beginnt
// oder der Run gewonnen ist (nur Akt 3).
function startRoom(run, type = 'combat') {
  const diff = run.difficulty;
  const actCfg = diff.acts[run.actIndex - 1];
  const finalIdx = actCfg.rooms + 1;
  // !run.endless ist ein reines Sicherheitsnetz: im Endlosmodus (nach Akt 3)
  // waechst run.roomIndex ueber finalIdx hinaus und traefe die Bedingung nie
  // wieder von selbst -- der explizite Ausschluss verhindert trotzdem jede
  // zukuenftige Ueberraschung, falls roomIndex je anders gefuehrt wird.
  const isFinal = !run.endless && run.roomIndex === finalIdx;
  // Der Bossraum ist immer Kampf (Sicherheitsnetz -- die Karte markiert die
  // letzte Reihe ohnehin schon als 'combat'-Boss-Knoten, siehe generateMap()).
  if (isFinal) type = 'combat';
  run.isActBoss = isFinal;
  run.roomType = type;
  run.roomAffix = null;
  run.roomAffixes = [];
  run.roomModifier = null;
  makeRoomStreams(run); // frische, aus dem Seed abgeleitete Stroeme
  resetRoomCounters(run);
  saveCurrentRun(runSnapshot(run)); // nur am Raumanfang, nie im Kampf
  if (type === 'combat' || type === 'elite' || type === 'cursed') {
    buildCombatRoom(run, type, isFinal);
  } else {
    startNonCombatRoom(run, type);
  }
}

function buildCombatRoom(run, type, isFinal) {
  const diff = run.difficulty;
  const actCfg = diff.acts[run.actIndex - 1];
  // Raum-Modifikator (Phase 10): ab data/modifiers.json.minRoom einer pro
  // Kampf-/Eliteraum, sichtbar in der Vorschau. Der Finalraum bleibt davon
  // ausgenommen -- handgebaute Encounter sollen wie geplant bleiben, gleiches
  // Prinzip wie der Wellen-Ausschluss (`!isFinal`) in Phase 9.
  const modifier = isFinal ? null : rollRoomModifier(run);
  // Raum-Gefahr (Phase 15): wie der Modifikator vom Finalraum ausgenommen
  // (handgebauter Boss-Encounter soll wie geplant bleiben).
  const hazardType = isFinal ? null : rollRoomHazard(run);
  let enemyTypes;
  let fixedRoom = null;
  let weights = null;
  let bossRoomSpec = null;
  if (isFinal) {
    // Boss (Phase 14, Grundsteinumbau Phase 6: fest statt zufaellig): jeder
    // Akt hat GENAU einen Boss (acts[i].boss) -- Reaktor->Akt1, Spiegel->Akt2,
    // Phalanx->Akt3 (Nutzerentscheidung, s. data/difficulty.json). Nutzt die
    // Arena-Weiche aus Phase 0b (fixedLayout) statt des alten handgebauten
    // run.tiles.finalRoom, das damit entfaellt.
    const bossName = actCfg.boss;
    run.bossName = bossName;
    bossRoomSpec = { fixedLayout: bossName };
    const spawnCount = arenaEnemySpawnCount(run.data.arenas, bossName);
    enemyTypes = [
      ...BOSS_ENEMY_TYPES[bossName],
      ...buyEnemies(diff, run.rng.enemies, run.actIndex, run.roomIndex, diff.finalRoom.supportBudget),
    ].slice(0, spawnCount);
    run.roomCharacter = 'Finale';
  } else {
    const eliteMult = type === 'elite' ? diff.elite.budgetMult : 1;
    // Modifikator "Ueberfuellt" (Phase 10): 50 % mehr Gefahrenbudget -> mehr
    // (bzw. staerkere) Gegner, kompensiert durch aggressionMult in cfg.js.
    const crowdedMult = modifier?.enemyBudgetMult || 1;
    // Grundsteinumbau Phase 6: budget kommt jetzt aus dem AKT-eigenen
    // Block (acts[i].budget) und laeuft akt-lokal -- Raum 1 jedes Akts
    // startet wieder bei budget.base, statt einer einzigen 51-Raum-Kurve.
    const budget =
      (actCfg.budget.base + run.roomIndex * actCfg.budget.perRoom) * run.budgetMult * eliteMult * crowdedMult;
    enemyTypes = buyEnemies(diff, run.rng.enemies, run.actIndex, run.roomIndex, budget);
    // Raumcharakter: Kachelgewichte alternieren (Spec Abschnitt 7B).
    const chars = diff.roomCharacters;
    if (chars && chars.length) {
      const ch = chars[Math.floor(run.rng.rooms() * chars.length)];
      weights = ch.weights;
      run.roomCharacter = ch.name;
    }
  }
  // Elite-Affixe (Phase 9): VOR createState() ueber die Typliste (nicht die
  // spaeter erzeugten Tank-Objekte) bestimmen -- so gilt dieselbe "Rezeptur"
  // (welche Affixe, welcher Index ist guenstigster/teuerster) unabhaengig
  // vom Wellen-Split auch fuer die spaeter nachspawnende zweite Welle.
  // Verflucht (Phase 12): erzwingt IMMER genau 1 Affix, unabhaengig von der
  // sonstigen Raumnummer-Staffelung (affixRules) -- das ist ja gerade der
  // sichtbare Preis, den der Kartenknoten schon vorher ankuendigt.
  const eliteAffixes =
    type === 'elite' ? rollEliteAffixes(run, enemyTypes) : type === 'cursed' ? rollEliteAffixes(run, enemyTypes, 1) : null;
  // Wellen (Phase 9): grosse Raeume spawnen nur die erste Haelfte sofort,
  // der Rest wartet an denselben (vom Generator ohnehin erzeugten)
  // Spawnpunkten -- deshalb bekommt generateRoom() weiter die VOLLE
  // enemyTypes.length, nur createState() instanziiert weniger Panzer
  // (waveSplit) und haelt den Rest in state.pendingWave zurueck.
  const wavesCfg = run.difficulty.waves;
  const waveSplit =
    !isFinal && wavesCfg && enemyTypes.length >= wavesCfg.minEnemiesForWaves
      ? Math.ceil(enemyTypes.length / 2)
      : null;
  run.state = createState(run.data, run.tiles, {
    genRng: run.rng.rooms,
    enemyTypes,
    aiSeed: hashSeed(run.seed, actRoomKey(run), 'ai'), // Phase 6: akt-eindeutig, s. actRoomKey()
    fixedRoom,
    weights,
    starterTank: run.starterTank, // Phase 9: gewaehlte Klasse
    starterScrap: run.scrap, // Phase 9: Schrottpanzer-Passiv (pro Raum gebacken)
    playerUpgrades: run.upgrades,
    upgradesData: run.upgradesData,
    upgradeLevels: run.upgradeLevels, // Grundsteinumbau Phase 7: am Rastplatz aufgewertete Stufen
    levelBalance: run.data.balance.upgradeLevel,
    equippedSecondary: run.equippedSecondary,
    equippedGadget: run.equippedGadget,
    shieldCharges: run.shieldCharges, // raumuebergreifende Notschild-Ladungen
    // Weiche (Phase 0b): setzt das Raumspec `fixedLayout`, kommt das Layout
    // aus data/arenas.json statt aus dem Kachelgenerator. Der Finalraum
    // (Phase 14) hat IMMER Vorrang vor einem evtl. gesetzten Test-Override
    // (?arena=..., run.roomSpec) -- der Boss soll auch im Testmodus laufen.
    roomSpec: isFinal ? bossRoomSpec : run.roomSpec,
    arenas: run.data.arenas,
    // Phase 5: aktive Transformations-Schalter (rein datengesteuert).
    transform: transformEffects(run),
    waveSplit,
    waveCfg: waveSplit != null ? wavesCfg : null,
    eliteAffixes,
    modifier,
    // Zerstoerbare Waende (Phase 11): wird nur vom prozeduralen Generator
    // ausgewertet (generateRoom()s fixedLayout-/buildFixedRoom()-Zweige
    // ignorieren den Parameter einfach) -- daher ohne isFinal-Sonderfall.
    destructibleWalls: diff.destructibleWalls,
    // Raum-Gefahr (Phase 15): ebenso nur vom prozeduralen Generator
    // ausgewertet, null im Finalraum.
    hazardType,
    // Raumkontext (Nutzer-Balancerunde): manche Karten wirken nur in
    // bestimmten Raumarten -- aktuell der Konterschild (nur Elite/Boss).
    roomContext: { elite: type === 'elite' || type === 'cursed', boss: !!isFinal },
    // LP-Skalierung (UMBAUPLAN-LP Phase 2): Raumtiefe (akt-lokal) mal
    // Elitezuschlag. Der Gegnerschaden skaliert bewusst NICHT mit --
    // spaetere Raeume werden zaeher, nicht toedlicher (Plan: "Gegnerschaden
    // konstant"). Grundsteinumbau Phase 6: im Bossraum kommt zusaetzlich
    // acts[i].bossHpMult drauf -- gilt bewusst auch fuer den t_black-
    // Platzhalter (kein isBossCfg()-Flag, hpSkipBosses greift bei ihm nicht),
    // sonst waere der Akt-3-Boss nicht haerter als der Akt-1-Boss.
    hpScale:
      (1 + (diff.hpScaling?.perRoom || 0) * (run.roomIndex - 1)) *
      (type === 'elite' || type === 'cursed' ? diff.elite?.hpMult || 1 : 1) *
      (isFinal ? actCfg.bossHpMult ?? 1 : 1),
    hpSkipBosses: diff.hpScaling?.skipBosses !== false,
    // Nekromant-V2 Phase 3: Gegnerpool des AKTUELLEN Akts (bis zur jetzigen
    // Raumnummer freigeschaltet) fuer die Geisterbombe -- "ein zufaelliger
    // Typ aus dem Gegnerpool des aktuellen Akts, damit sie mit skaliert".
    actEnemyPool: unlockedEnemyTypes(diff, run.actIndex, run.roomIndex),
    // Nekromant-V2 Phase 5: Stand der runweiten necro-Stapel bei Raumbeginn
    // (necro.js: getNecroStack() addiert den in DIESEM Raum neu gewonnenen
    // Anteil selbst dazu). BEWUSST eine flache KOPIE, keine Referenz: run
    // .necroStacks wird noch WAEHREND dieses Raums per Delta-Sync (s. o.)
    // weitergeschrieben -- eine geteilte Referenz wuerde den bereits
    // synchronisierten Zuwachs doppelt zaehlen (einmal ueber die "Basis",
    // einmal ueber necroRunStackGain).
    necroRunStacksBase: { ...run.necroStacks },
    // Nekromant-V2 Phase 6 (ghost_029/030): permanente Run-Boni, einmal pro
    // Raumaufbau aus dem synchronisierten run.necroStacks gelesen (derselbe
    // Zeitpunkt wie necroRunStacksBase oben) -- der zugrunde liegende
    // Stapel-Schluessel ('_runDmgBonus'/'_runHpBonus') wird ausschliesslich
    // von den beiden Karten selbst befuellt (necro.js: buildNecroListeners()).
    necroRunDmgBonus: run.necroStacks._runDmgBonus || 0,
    necroRunHpBonus: run.necroStacks._runHpBonus || 0,
  });
  // Vorschau: Gegnerliste + "Weiter"-Button (main.js zeigt das Overlay);
  // erst der Klick startet den 1,5-s-Uebergang.
  run.phase = 'preview';
  run.transitionTimer = TRANSITION_S;
}

// Elite-Affixe (Phase 9): vor Raum 8 keiner, ab Raum 8 einer, ab Raum 14
// zwei -- kombinierbar (mehrere Affixe auf denselben Gegnern). Ausnahme
// `regenerating_shield`: nur der guenstigste und der teuerste Panzer der
// KI-Auswahl (per Index in enemyTypes) bekommen ihn, damit er gezielt
// "besondere" Gegner auszeichnet statt den ganzen Raum. Gibt die Rezeptur
// zurueck ({chosen, cheapestIdx, priciestIdx}) statt sie direkt auf Tanks
// anzuwenden -- state.js wendet sie beim Erzeugen jedes Panzers an (auch
// bei einer spaeter nachspawnenden zweiten Welle).
function rollEliteAffixes(run, enemyTypes, forceCount) {
  const diff = run.difficulty;
  const rules = diff.elite.affixRules;
  const count =
    forceCount ?? (run.roomIndex >= rules.minRoomForTwo ? 2 : run.roomIndex >= rules.minRoomForOne ? 1 : 0);
  run.roomAffixes = [];
  run.roomAffix = null;
  if (count === 0 || !enemyTypes.length) return null;

  const pool = [...diff.elite.affixes];
  const chosen = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(run.rng.enemies() * pool.length);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  run.roomAffixes = chosen.map((a) => a.name);
  run.roomAffix = run.roomAffixes.join(' + ');

  let cheapestIdx = 0;
  let priciestIdx = 0;
  enemyTypes.forEach((ty, i) => {
    const pts = diff.danger[ty]?.points ?? 0;
    if (pts < (diff.danger[enemyTypes[cheapestIdx]]?.points ?? 0)) cheapestIdx = i;
    if (pts > (diff.danger[enemyTypes[priciestIdx]]?.points ?? 0)) priciestIdx = i;
  });
  return { chosen, cheapestIdx, priciestIdx };
}

// Raum-Modifikator (Phase 10): ab data/modifiers.json.minRoom wird pro
// Kampf-/Eliteraum GENAU einer geseedet gezogen (eigener RNG-Strom, siehe
// makeRoomStreams) und in run.roomModifier fuer die Vorschau abgelegt. Vor
// minRoom bleibt der eigene Stream einfach ungenutzt -- Streams sind je
// Label unabhaengig, das verschiebt keine anderen Systeme.
function rollRoomModifier(run) {
  const cfg = run.data.modifiers;
  run.roomModifier = null;
  if (!cfg || run.roomIndex < (cfg.minRoom ?? Infinity)) return null;
  const list = cfg.modifiers;
  if (!list || !list.length) return null;
  const mod = list[Math.floor(run.rng.modifiers() * list.length)];
  run.roomModifier = mod;
  return mod;
}

// Raum-Gefahr (Phase 15): ab data/tiles.json: hazards.minRoom wird pro
// Kampf-/Eliteraum GENAU EIN Typ geseedet gewuerfelt (eigener RNG-Strom,
// siehe makeRoomStreams) und in run.roomHazard fuer die Vorschau abgelegt.
// Die konkreten Zellen werden erst in generator.js: placeRoomHazard()
// bestimmt (braucht das schon gebaute Grid) -- hier nur der Typ + Text.
function rollRoomHazard(run) {
  const cfg = run.tiles.hazards;
  run.roomHazard = null;
  if (!cfg || run.roomIndex < (cfg.minRoom ?? Infinity)) return null;
  const types = cfg.types;
  if (!types || !types.length) return null;
  const type = types[Math.floor(run.rng.hazards() * types.length)];
  const info = cfg[type] || {};
  run.roomHazard = { type, name: info.name || type, desc: info.desc || '' };
  return type;
}

// Grundsteinumbau Phase 4: Schatzkammer/Verflucht gaben vorher ein
// garantiertes Legendaer (Tag-Regel aus). Der Sockel hat aktuell keine
// einzige legendaere Karte -- ein "Legendaer"-Angebot waere ein leeres
// Angebot mit Kartenscreen und keinem Weg, ihn zu verlassen (dieselbe
// Fehlerklasse wie der fruehere Kartenscreen-Blocker, siehe CLAUDE.md:
// "Bugfix: Kartenscreen blockierte den Run"). Bewusst NICHT geloescht:
// rollReward()s onlyRarity:'legendary'-Zweig bleibt unangetastet als
// Wiederanschlusspunkt fuer kuenftige Klassenpools mit Legendaries
// (archive/systeme-v1.md, Abschnitt 4 "Nicht loeschen, nur umleiten").
// Bis dahin gibt es ein Schrottpaket (balance.json: scrap.treasure) OHNE
// Kartenscreen.
function grantTreasureScrap(run) {
  const amount = run.data.balance.scrap.treasure ?? 0;
  run.scrap += amount;
  run.scrapThisRoom += amount;
  const st = run.state;
  if (st?.player) {
    st.texts.push({
      x: st.player.x,
      y: st.player.y - 30,
      text: `+${amount} Schrott`,
      age: 0,
      life: 1.2,
      color: '#e0c860',
    });
  }
}

// Kartenbelohnung/Shop-Ueberarbeitung: ganzzahliger, einschliesslicher Preis
// innerhalb des zur Seltenheit gehoerenden Bands (data/balance.json:
// shop.cardPriceRanges). Fehlt ein Band (aeltere/synthetische balance.json),
// faellt der Preis auf 5 Schrott zurueck (der frueher einheitliche Wert).
function rollShopPrice(run, rarity) {
  const ranges = run.data.balance.shop?.cardPriceRanges;
  const range = ranges?.[rarity];
  if (!range) return 5;
  const [min, max] = range;
  return min + Math.floor(run.rng.upgrades() * (max - min + 1));
}

// Nicht-Kampf-Raum: kein neuer Arena-Zustand -- der Vorraum bleibt Kulisse.
function startNonCombatRoom(run, type) {
  if (type === 'treasure') {
    // Kostet beim Betreten Leben (nie toedlich -- Tuer war ab 1 Leben gesperrt).
    run.lives = Math.max(1, run.lives - run.difficulty.treasure.lifeCost);
    grantTreasureScrap(run);
    afterRoomDone(run);
  } else if (type === 'workshop') {
    // Shop (Phase 13): Kartenregal EINMAL beim Betreten ziehen, damit es
    // sich beim Neu-Rendern nach jeder Aktion nicht neu mischt. Beim
    // Fortsetzen entsteht dasselbe Regal automatisch neu (gleicher Seed +
    // gleiche Raumnummer -> gleicher `upgrades`-Strom), deshalb steht es
    // NICHT im runSnapshot -- selbes Prinzip wie roomModifier in Phase 10.
    run.shopOffers = rollFromPool(run.upgradesData, {
      ...poolOpts(run),
      // Kartenbelohnung/Shop-Ueberarbeitung: eigenstaendige Seltenheits-
      // tabelle nach Shop-Besuchszahl statt der reward-Baender aus poolOpts().
      rarityWeights: shopRarityWeights(run.data.balance, run.shopsVisited),
      count: run.data.balance.shop?.cardChoices ?? 5,
    });
    // Jede angebotene Karte bekommt EINMAL, hier beim Betreten, einen nach
    // ihrer Seltenheit gewuerfelten Preis (data/balance.json:
    // shop.cardPriceRanges) -- aus demselben deterministischen
    // run.rng.upgrades-Strom wie die Kartenauswahl selbst, direkt danach
    // verbraucht. Dadurch reproduziert Seed+Raumnummer beim Fortsetzen
    // automatisch dieselben Preise (kein eigener Snapshot-Eintrag noetig,
    // gleiches Prinzip wie das Regal selbst).
    for (const offer of run.shopOffers) offer.price = rollShopPrice(run, offer.rarity);
    run.shopLifeBought = false; // "Leben: einmal pro Shop"
    run.phase = 'workshop';
  } else if (type === 'event') {
    const evs = run.data.events.events;
    run.currentEvent = evs[Math.floor(run.rng.events() * evs.length)];
    run.phase = 'event';
  } else if (type === 'rest') {
    // Grundsteinumbau Phase 7: zwei Optionen, eine Wahl (repairAtRest()/
    // upgradeCardAtRest() weiter unten) -- roomscreens.js: createRestScreen()
    // zeigt beide, keine dritte "nur verlassen"-Aktion (anders als der Shop).
    // Sicherheitsnetz (Muster: "Bugfix: Kartenscreen blockierte den Run",
    // CLAUDE.md): `rest` ist ein normal gewichteter Kartenknotentyp
    // (data/difficulty.json: map.nodeWeights) und kann mehrfach pro Akt
    // auftauchen, waehrend Stufen-Deckel (maxLevel) x aufwertbare Karten
    // begrenzt sind -- bei vollen Leben UND keiner aufwertbaren Karte waere
    // der Raum sonst ein Screen ganz ohne moegliche Wahl. Automatisch
    // weiterziehen statt darin haengenzubleiben.
    if (run.lives >= run.maxLives && workbenchOptions(run).length === 0) {
      afterRoomDone(run);
      return;
    }
    run.phase = 'rest';
  }
}

// Rastplatz, Option 1: Reparaturtrupp. +1 Leben, gedeckelt auf run.maxLives
// -- bei vollem Stand lehnt die Funktion ab (false), die UI zeigt die
// Option dafuer ausgegraut statt versteckt (Auftrag: "der Spieler soll die
// Regel lernen"). Eine gewaehlte Reparatur beendet den Raum sofort, wie
// Testschritt 1 verlangt -- anders als der Shop gibt es hier kein
// "Verlassen" danach.
export function repairAtRest(run) {
  if (run.phase !== 'rest') return false;
  if (run.lives >= run.maxLives) return false;
  run.lives += 1;
  afterRoomDone(run);
  return true;
}

// Champion-/Nekromant-Nachschliff Abschnitt 2: das alte "eine Karte bekommt
// eine separate Stufe/+-Symbol"-System (run.upgradeLevels, maxLevel-Deckel)
// ist VOLLSTAENDIG entfernt. Eine besessene, WIEDERHOLBARE (nicht
// einzigartige) Karte am Rastplatz/in der Shop-Werkbank zu waehlen wird
// jetzt EXAKT wie eine frische Kartenwahl behandelt -- derselbe Stapelzaehler
// run.upgrades[id], derselbe applyUpgradeChoice()-Hook wie beim normalen
// Angebot. Kein Stufen-Deckel mehr: eine Karte laesst sich beliebig oft
// erneut waehlen. cfg.js/state.js behalten die (jetzt dauerhaft leere)
// upgradeLevels-Infrastruktur unangetastet als reines totes Feld -- ein
// Loeschen dort waere ein reiner Aufraeum-Nebenschauplatz ohne Verhaltens-
// aenderung und riskiert unnoetig weitere Aufrufstellen.
//
// Werkbank-Vorschau fuer die UI: eigene, WIEDERHOLBARE Karten (isUnique muss
// false sein -- eine einzigartige Karte darf am Rastplatz/im Shop nie
// erneut auftauchen, Auftrag Abschnitt 1/2). "stufe" zeigt jetzt die
// tatsaechliche Stapelzahl (run.upgrades[id]), keine separate Werkbank-Stufe
// mehr.
export function workbenchOptions(run) {
  const defs = run.upgradesData.upgrades;
  return Object.keys(run.upgrades)
    .filter((id) => (run.upgrades[id] || 0) > 0)
    .map((id) => defs[id])
    .filter((def) => def && !def.isUnique)
    .map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      symbol: def.symbol,
      stufe: run.upgrades[def.id] || 0,
    }));
}

// Gemeinsamer Kern: eine bereits besessene, wiederholbare Karte "erneut
// waehlen" -- ruft denselben applyUpgradeChoice()-Hook wie eine frische
// Kartenwahl (Stapelzaehler, Tag-/Synergie-Buchfuehrung, Sonderfaelle wie
// Glaskanone/Notschild/Trophaee/Ersatzpanzer laufen automatisch mit). Weder
// Kosten noch Raumfluss -- das entscheiden die beiden Aufrufer (Rastplatz:
// kostenlos + Raum-Ende; Shop: gegen Schrott, Raum bleibt offen).
function repickOwnedCard(run, id) {
  if ((run.upgrades[id] || 0) <= 0) return false;
  const def = run.upgradesData.upgrades[id];
  if (!def || def.isUnique) return false;
  applyUpgradeChoice(run, def);
  return true;
}

// Rastplatz, Option 2 (ueberarbeitet, Champion-/Nekromant-Nachschliff
// Abschnitt 2): "Werkbank" waehlt eine besessene, wiederholbare Karte
// erneut, statt sie eine separate Stufe aufzuwerten. Beendet den Raum sofort
// (dieselbe "eine Wahl, Raum zu Ende"-Regel wie Reparatur).
export function upgradeCardAtRest(run, id) {
  if (run.phase !== 'rest') return false;
  if (!repickOwnedCard(run, id)) return false;
  afterRoomDone(run);
  return true;
}

// Tatsaechlich zum Zielknoten wechseln: naechster Raum, Kartenposition
// nachziehen.
function advanceToMapNode(run, node) {
  run.roomIndex = node.layer;
  run.mapCurrentId = node.id;
  // Kartenbelohnung/Shop-Ueberarbeitung: dies ist die EINZIGE Stelle, an der
  // der Spieler innerhalb eines Akts wirklich in einen NEUEN Raum wechselt
  // (sowohl beim automatischen Weiterzug als auch bei einer echten
  // Kartenwahl, s. chooseMapNode()/afterRoomDone()) -- der richtige Ort fuer
  // den runweiten Raumzaehler UND den Shop-Besuchszaehler. Ein Resume
  // (createRun()) laeuft NIE hier durch (direkter startRoom()-Aufruf), zaehlt
  // also nie doppelt.
  run.totalRoomIndex = (run.totalRoomIndex || 0) + 1;
  if (node.type === 'workshop') run.shopsVisited = (run.shopsVisited || 0) + 1;
  startRoom(run, node.type);
}

// Nach einem erledigten Raum (Belohnung gewaehlt bzw. Interaktion beendet):
// Kartennavigation (Phase 12) statt der fruehren unsichtbaren Automatik.
// Endlos-Modus bleibt bewusst AUSSERHALB der Karte -- reiner Kampf-
// Nachschub mit wachsendem Budget, wie schon vor Phase 12.
function afterRoomDone(run) {
  if (run.endless) {
    run.roomIndex++;
    run.totalRoomIndex = (run.totalRoomIndex || 0) + 1;
    startRoom(run, 'combat');
    return;
  }
  const current = run.map.byId.get(run.mapCurrentId);
  const nextIds = current?.next || [];
  if (nextIds.length <= 1) {
    // Kein echter Zweig (Raum 1->2, 2->3, letzte Reihe -> Boss) --
    // automatisch weiterziehen, wie der bisherige "erzwungene Kampf".
    const node = run.map.byId.get(nextIds[0]);
    advanceToMapNode(run, node);
    return;
  }
  // Echte Verzweigung: Kartenscreen zeigen (main.js), chooseMapNode() bei Klick.
  run.phase = 'map';
}

// Vom Kartenscreen aufgerufen. Gibt true zurueck, wenn der Zug gueltig war.
// Ungueltig sind: kein Knoten in Reichweite von der aktuellen Position ODER
// eine Schatzkammer bei zu wenig Leben (dieselbe Regel, die frueher schon
// die unsichtbare Tuerwahl von `treasure` ausgeschlossen hat).
export function chooseMapNode(run, nodeId) {
  if (run.phase !== 'map') return false;
  const current = run.map.byId.get(run.mapCurrentId);
  if (!current || !current.next.includes(nodeId)) return false;
  const node = run.map.byId.get(nodeId);
  if (!node) return false;
  if (node.type === 'treasure' && run.lives <= run.difficulty.treasure.lifeCost) return false;
  advanceToMapNode(run, node);
  return true;
}

// Werkstatt: ein bereits gewaehltes Upgrade gegen Schrott ablegen (eine Stufe).
export function dropUpgrade(run, id) {
  if (run.phase !== 'workshop') return false;
  if ((run.upgrades[id] || 0) <= 0) return false;
  run.upgrades[id] -= 1;
  if (run.upgrades[id] <= 0) delete run.upgrades[id];
  run.scrap += run.data.balance.scrap.dropRefund;
  return true;
}

// Werkstatt verlassen -> naechste Tuer.
export function leaveWorkshop(run) {
  if (run.phase !== 'workshop') return;
  afterRoomDone(run);
}

// Event-Option waehlen: Effekte anwenden (Leben/Schrott/Schild, geclamped)
// -> naechste Tuer. Gibt { event, option } fuer die Telemetrie zurueck.
//
// Grundsteinumbau Phase 9: eine Option kann zusaetzlich effects.card:true
// tragen -- statt direkt weiterzuziehen, oeffnet sie den normalen
// Angebotsbildschirm (rewardKind 'normal', dieselbe Pool-Logik wie ein
// Kampfraum). chooseUpgrade() ruft danach selbst afterRoomDone() auf, der
// Raum endet also erst NACH der Kartenwahl. Faellt der Pool leer aus
// (Sicherheitsnetz wie beim normalen Belohnungspfad), zieht der Raum
// trotzdem sofort weiter statt in einem leeren Screen haengenzubleiben.
export function chooseEventOption(run, index) {
  if (run.phase !== 'event' || !run.currentEvent) return null;
  const ev = run.currentEvent;
  const opt = ev.options[index];
  if (!opt) return null;
  const e = opt.effects || {};
  if (e.life) run.lives = Math.max(1, run.lives + e.life);
  if (e.scrap) run.scrap = Math.max(0, run.scrap + e.scrap);
  if (e.shield > 0) addShieldCharges(run, e.shield);
  else if (e.shield < 0) run.shieldCharges.splice(0, -e.shield);
  const evId = ev.id;
  run.currentEvent = null;
  if (e.card) {
    run.rewardKind = 'normal';
    const offers = rollReward(run);
    if (offers.length) {
      run.pendingOffers = offers;
      run.phase = 'upgrade';
      return { event: evId, option: index };
    }
    run.rewardKind = null;
  }
  afterRoomDone(run);
  return { event: evId, option: index };
}

// Vom "Weiter"-Button der Raumvorschau aufgerufen.
export function enterRoom(run) {
  if (run.phase !== 'preview') return;
  run.phase = 'transition';
  run.transitionTimer = TRANSITION_S;
}

// Grundsteinumbau Phase 6: nur die Kartengenerierung + Akt-Zuweisung, OHNE
// Seiteneffekt auf roomIndex/mapCurrentId/phase -- gebraucht sowohl fuer
// einen frischen Akt (enterAct(), s. u.) als auch beim Fortsetzen (die Karte
// muss deterministisch aus Seed+actIndex neu entstehen, roomIndex/
// mapCurrentId kommen dort aber aus dem Snapshot, nicht bei 1).
function buildActMap(run, actIndex) {
  run.actIndex = actIndex;
  run.map = generateMap(run.seed, run.difficulty, actIndex);
}

// Einen (neuen) Akt beginnen: frische Karte, Position auf den Startknoten,
// erster Raum ist wie gehabt automatisch Kampf (die ersten beiden Ebenen
// sind ohnehin forced-combat, s. generateMap()).
function enterAct(run, actIndex) {
  buildActMap(run, actIndex);
  run.roomIndex = 1;
  run.mapCurrentId = run.map.layers[0][0].id;
  startRoom(run, 'combat');
}

// Vom "Weiter"-Knopf des Akt-Uebergangsbildschirms aufgerufen (Testschritt 2
// des Auftrags: "Uebergang zur Akt-2-Karte mit Zwischenbildschirm"). Der
// Lebensbonus ist zu diesem Zeitpunkt schon vergeben (stepRun() traegt ihn
// beim Bosskill ein, s. dort) -- hier nur noch der Kartenwechsel selbst.
export function advanceAct(run) {
  if (run.phase !== 'actComplete') return;
  // Kartenbelohnung/Shop-Ueberarbeitung: Eintritt in Raum 1 des naechsten
  // Akts ist ebenfalls ein neuer Raum -- enterAct() selbst setzt roomIndex
  // zurueck auf 1, totalRoomIndex zaehlt hier unbeeinflusst weiter.
  run.totalRoomIndex = (run.totalRoomIndex || 0) + 1;
  enterAct(run, run.actIndex + 1);
}

// opts.roomSpec: optionales Raumspec, z. B. { fixedLayout: 'test_arena' }
// -> alle Kampfraeume nutzen dann das feste Layout (Testweg fuer die Weiche).
export function createRun(data, tiles, difficulty, upgradesData, seed, modeKey = 'normal', opts = {}) {
  const mode = (difficulty.modes && difficulty.modes[modeKey]) || {
    label: 'Normal',
    budgetMult: 1,
    lives: difficulty.lives,
  };
  const run = {
    data,
    tiles,
    difficulty,
    upgradesData,
    mode: mode.label,
    modeKey,
    budgetMult: mode.budgetMult,
    starterTank: opts.starterTank || 'player', // Phase 9: gewaehlte Klasse (Default: Standard). Gehoert in die Seed-Wiedergabe.
    upgrades: {}, // gewaehlte Upgrade-Stapel {id: anzahl}. Die Bombe ist seit P4 keine Karte mehr, sondern fester Slot.
    // Grundsteinumbau Phase 7 (Rastplatz: Werkbank): {id: stufe}, getrennt von
    // den Stapeln oben -- eine Karte kann mehrfach gezogen UND separat am
    // Rastplatz aufgewertet sein. cfg.js: applyUpgrades() skaliert damit die
    // core-Effekte der Karte (1 + stufe*balance.upgradeLevel.bonusPct).
    upgradeLevels: {},
    equippedSecondary: 'mine', // Phase 6/P4: fester Bombenslot, nicht tauschbar
    equippedGadget: null, // P4: zweiter, tauschbarer Slot -- Start: keines
    upgradeChoices: 0,
    // Notschild-Ladungen als Liste (E2): Eintrag = verbleibende geraeumte
    // Raeume bis zum Verfall. Jede Ladung altert einzeln.
    shieldCharges: [],
    scrap: 0, // Schrott-Waehrung (Run-State, Phase 3)
    scrapThisRoom: 0, // im aktuellen Raum verdienter Schrott (Telemetrie)
    bannedUpgrades: new Set(), // im Run verbannte Upgrade-ids (nicht persistent)
    // Nekromant-V2 Phase 1 (Stapelregel): jede tatsaechlich GEWAEHLTE Karte
    // mit isUnique:true landet hier -- gefiltert aus ALLEN Kartenquellen
    // (Angebot, Shop, Truhe, Ereignis, Reroll), s. upgradepool.js:
    // buildCandidates(). Persistiert im Snapshot (im Gegensatz zu
    // bannedUpgrades, das pro Run frisch ist).
    selectedUniqueUpgradeIds: new Set(),
    pendingOffers: null,
    shopOffers: null, // Phase 13: Kartenregal des aktuellen Shops
    shopLifeBought: false, // Phase 13: Leben nur einmal pro Shop-Besuch
    // --- Phase 4: Raumtypen + Tuerwahl ---
    // --- Phase 5: Transformationen ---
    tagCounts: {}, // {tag: Anzahl gewaehlter Upgrades} -- Stacks zaehlen einzeln
    // Upgradepool-v2 Phase 3: laufende Bilanz der SYNERGIE-Tags (tags[] aus
    // Phase 2) der gewaehlten Karten -- eigenstaendig neben tagCounts (das
    // zaehlt die Hauptkategorie `tag` fuer die Transformationen und bleibt
    // unangetastet). Speist die Angebotsgewichtung in upgradepool.js.
    synergyTags: {},
    // Nekromant-V2 Phase 5 (Ereignis-/Stapelschicht): runweite Stapel --
    // persistenter Speicher, in den state.js: stepRun() jeden Tick den
    // raumlokalen Zuwachs eintraegt (Muster wie scrap/bonusScrap). Reservierter
    // Schluessel '_deaths' zaehlt automatisch jeden echten Geistertod
    // (necro.js: onGhostRemoved()), unabhaengig von jeder Karte.
    necroStacks: {},
    seenNecroRunStackGain: {}, // Delta-Sync-Stand je Schluessel (raumlokal, reset pro Raum)
    transformations: new Set(), // freigeschaltete Transformations-ids
    newTransformation: null, // Phase 17: zuletzt freigeschaltete (fuer Text-Einblendung)
    roomSpec: opts.roomSpec || null, // { fixedLayout } -> Arena-Weiche
    roomType: 'combat', // Typ des aktuellen Raums
    currentEvent: null, // aktives Event waehrend phase 'event'
    rewardKind: null, // 'normal' | 'elite' | 'treasure' | 'cursed' fuer den Belohnungspool
    roomAffix: null, // Name(n) des Elite-Affix, "A + B" bei zweien (nur Eliteraeume)
    roomAffixes: [], // dieselben Affixe als Namensliste (Phase 9: 0-2 kombinierbar)
    roomModifier: null, // Raum-Modifikator-Objekt aus data/modifiers.json (Phase 10)
    roomHazard: null, // {type,name,desc} aus data/tiles.json: hazards (Phase 15)
    bossName: null, // Boss-Arena des Finalraums (Phase 14), erst dort gesetzt
    actIndex: 1, // Grundsteinumbau Phase 6: welcher Akt (1-3), s. enterAct()
    isActBoss: false, // true, waehrend der aktuelle Raum der Bossraum DIESES Akts ist
    lastActLifeReward: 0, // fuer den Akt-Uebergangsbildschirm (main.js)
    killsByType: {}, // Statistik fuer die Endscreens
    shotsFired: 0, // Spieler-Abzuege ueber den ganzen Run (Trefferquote)
    combo: 0, // laufende Kill-Combo
    comboTimer: 0, // s bis die Combo verfaellt
    bestCombo: 0, // hoechste Combo im Run
    seed: seed >>> 0,
    roomIndex: 1,
    // Kartenbelohnung/Shop-Ueberarbeitung: totalRoomIndex ist der RUNweite
    // Gegenstueck zu roomIndex (nie pro Akt zurueckgesetzt, s.
    // advanceToMapNode()/advanceAct()/afterRoomDone()); shopsVisited zaehlt
    // echte Shop-Eintritte. Beide treiben die neuen Seltenheitsbaender.
    totalRoomIndex: 1,
    shopsVisited: 0,
    lives: mode.lives,
    maxLives: mode.lives, // Bezug fuer Berserker (fehlende Leben)
    kills: 0, // ueber den ganzen Run
    deaths: 0,
    roomsCleared: 0,
    playTime: 0, // s aktive Spielzeit
    // 'preview'|'transition'|'playing'|'upgrade'|'workshop'|'event'|
    // 'gameover'|'victory'
    phase: 'transition',
    transitionTimer: TRANSITION_S,
    state: null,
    finalStats: null,
  };
  // Karte (Phase 12, Grundsteinumbau Phase 6: eine pro Akt): einmalig
  // deterministisch aus dem Seed erzeugt (eigener Strom PRO AKT statt eines
  // pro-Raum-Stroms) und bleibt fuer die Dauer des Akts unveraendert --
  // "vollstaendig vorab einsehbar" (PLAN.md), jetzt akt-weise statt fuer den
  // ganzen Run auf einmal (drei Akte a 16 Raeume waeren sonst eine einzige,
  // extrem lange Karte).
  // Fortsetzen: Zustand vor dem Raumbau einspielen, damit startRoom()
  // denselben Raum wie beim Abbruch erzeugt (Seed + Akt + Raumnummer
  // genuegen).
  if (opts.resume) {
    const r = opts.resume;
    run.starterTank = r.starterTank || run.starterTank; // Phase 9: Klasse aus dem Snapshot
    // Aeltere Zwischenstaende (vor Phase 6) kennen actIndex noch nicht --
    // sie waren immer "Akt 1" (es gab nur einen), bestmoegliches Fallback.
    buildActMap(run, r.actIndex || 1);
    run.roomIndex = r.roomIndex;
    // Kartenbelohnung/Shop-Ueberarbeitung: aeltere Zwischenstaende (vor
    // dieser Aenderung) kennen totalRoomIndex/shopsVisited noch nicht --
    // Fallback rekonstruiert totalRoomIndex bestmoeglich aus den bekannten
    // Akt-/Raumdaten, shopsVisited faellt neutral auf 0 zurueck (kein
    // Hinweis auf tatsaechlich schon besuchte Shops im alten Snapshot).
    run.totalRoomIndex = r.totalRoomIndex ?? estimateTotalRoomIndex(run, r);
    run.shopsVisited = r.shopsVisited ?? 0;
    run.lives = r.lives;
    run.shieldCharges = (r.shieldCharges || []).slice();
    run.scrap = r.scrap || 0;
    run.upgrades = { ...(r.upgrades || {}) };
    run.upgradeLevels = { ...(r.upgradeLevels || {}) }; // Phase 7: aeltere Zwischenstaende kennen das Feld noch nicht
    run.equippedSecondary = r.equippedSecondary || 'mine';
    run.equippedGadget = r.equippedGadget || null;
    run.bannedUpgrades = new Set(r.banned || []);
    // Nekromant-V2 Phase 1: aeltere Zwischenstaende (vor dieser Phase) kennen
    // das Feld noch nicht -- Fallback rekonstruiert es aus den bereits
    // besessenen Karten + dem AKTUELLEN isUnique-Schema (sonst waere eine
    // laengst gewaehlte, inzwischen als isUnique markierte Karte nach dem
    // Laden erneut ziehbar).
    run.selectedUniqueUpgradeIds = new Set(
      r.selectedUniqueUpgradeIds ||
        Object.keys(run.upgrades).filter((id) => upgradesData.upgrades[id]?.isUnique),
    );
    run.tagCounts = { ...(r.tagCounts || {}) };
    run.synergyTags = { ...(r.synergyTags || {}) }; // Upgradepool-v2 Phase 3
    run.necroStacks = { ...(r.necroStacks || {}) }; // Nekromant-V2 Phase 5
    run.transformations = new Set(r.transformations || []);
    run.endless = !!r.endless;
    run.playTime = r.playTime || 0;
    run.kills = r.kills || 0;
    run.deaths = r.deaths || 0;
    run.roomsCleared = r.roomsCleared || 0;
    // Aeltere Zwischenstaende (vor Phase 12) kennen mapCurrentId noch
    // nicht -- bestmoegliches Fallback statt eines harten Fehlers.
    run.mapCurrentId = r.mapCurrentId ?? findMapNodeFallback(run, r.roomIndex, r.roomType) ?? run.mapCurrentId;
    startRoom(run, r.roomType || 'combat');
    return run;
  }
  enterAct(run, 1);
  return run;
}

function finishRun(run, won) {
  run.phase = won ? 'victory' : 'gameover';
  clearCurrentRun(); // beendeter Run ist nicht mehr fortsetzbar
  // Rekord-Erkennung VOR dem Eintragen (alte Bestwerte vergleichen).
  const prev = loadStats();
  run.newRecord =
    (won && run.playTime < (prev.fastestWinS ?? Infinity)) ||
    run.roomsCleared > (prev.mostRooms || 0);
  run.finalStats = recordRun({
    won,
    rooms: run.roomsCleared,
    kills: run.kills,
    timeS: run.playTime,
    bestCombo: run.bestCombo,
  });
  if (won) run.state.sounds.push('fanfare');
}

export function stepRun(run, cmd, dt) {
  if (run.phase === 'transition') {
    run.transitionTimer -= dt;
    if (run.transitionTimer <= 1e-9) run.phase = 'playing';
    return;
  }
  if (run.phase !== 'playing') return;

  const st = run.state;
  // Berserker: Feuerrate/Tempo steigen mit fehlenden Leben (gedeckelt).
  const bcfg = st.player.cfg.berserker;
  if (bcfg) {
    const stacks = Math.min(bcfg.max, Math.max(0, run.maxLives - run.lives));
    st.player.berserkerFire = Math.pow(bcfg.fire, stacks);
    st.player.berserkerSpeed = Math.pow(bcfg.speed, stacks);
  }
  // Transformation "Taktiker" (Phase 5): Zeitlupe, solange eine Kugel
  // naeher als slowMoRadiusPx am Spieler ist. Werte aus transformations.json.
  const tx = st.transform || {};
  let scale = 1;
  if (tx.slowMoScale && st.player.alive) {
    const r2 = (tx.slowMoRadiusPx || 64) ** 2;
    for (const b of st.bullets) {
      if (b.dead) continue;
      if ((b.x - st.player.x) ** 2 + (b.y - st.player.y) ** 2 <= r2) {
        scale = tx.slowMoScale;
        break;
      }
    }
  }
  // Heck-Kill-Zeitlupe (Phase 2, Ersatz fuer den alten Trickshot-Moment):
  // dieselbe dt-Skalierungstechnik, kombiniert sich mit der Taktiker-
  // Transformation (der staerkere/kleinere Faktor gewinnt). Liest den vom
  // VORHERIGEN Tick gesetzten Wert -- stepState() unten zaehlt ihn erst
  // danach herunter.
  if (st.rearKillTimer > 0) {
    scale = Math.min(scale, run.data.balance.killFeedback?.slowMoScale ?? 1);
  }
  run.slowMo = scale < 1; // nur fuer die Anzeige
  dt *= scale;
  stepState(st, cmd, dt);
  run.playTime += dt;
  // Notschild-Ladungen aus dem Raumzustand zuruecksynchronisieren, damit
  // verbrauchte Ladungen in den naechsten Raum uebernommen werden.
  run.shieldCharges = st.shieldCharges;

  // Combo: schnell aufeinanderfolgende Kills. Faellt nach COMBO_WINDOW.
  if (run.comboTimer > 0) {
    run.comboTimer -= dt;
    if (run.comboTimer <= 0) run.combo = 0;
  }

  // Kumulative Raumzaehler abgleichen (robust, egal wo Kills passieren).
  if (st.enemyKills > run.seenRoomKills) {
    run.kills += st.enemyKills - run.seenRoomKills;
    run.seenRoomKills = st.enemyKills;
  }
  while (run.seenKillLog < st.killLog.length) {
    const ty = st.killLog[run.seenKillLog++];
    run.killsByType[ty] = (run.killsByType[ty] || 0) + 1;
    run.combo++;
    run.comboTimer = COMBO_WINDOW;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    if (run.combo >= 3) {
      st.texts.push({
        x: st.player.x,
        y: st.player.y - 26,
        text: `COMBO ×${run.combo}`,
        age: 0,
        life: 1,
        color: '#ffd23c',
      });
      st.sounds.push('combo');
    }
  }
  if (st.playerShots > run.seenRoomShots) {
    run.shotsFired += st.playerShots - run.seenRoomShots;
    run.seenRoomShots = st.playerShots;
  }
  // Beutejagd-/Steinbruch-Upgrades (Phase 18): eigener Bonus-Schrott-Zaehler
  // -- state.js kennt kein run-Objekt, deshalb dasselbe Delta-Sync-Muster
  // wie bei allen anderen Raum-Zaehlern hier.
  if (st.bonusScrap > run.seenBonusScrap) {
    const gained = st.bonusScrap - run.seenBonusScrap;
    run.seenBonusScrap = st.bonusScrap;
    run.scrap += gained;
    run.scrapThisRoom += gained;
  }
  // Nekromant-V2 Phase 5: runweite necro-Stapel (necro.js: addNecroStack()
  // mit scope 'run') werden genauso per Delta uebernommen -- state.js kennt
  // kein run-Objekt. Mehrere Schluessel gleichzeitig moeglich (jede
  // zukuenftige Karte bekommt ihren eigenen), deshalb eine Schleife statt
  // eines einzelnen Feldes wie bei scrap.
  for (const key of Object.keys(st.necroRunStackGain)) {
    const cur = st.necroRunStackGain[key];
    const seen = run.seenNecroRunStackGain[key] || 0;
    if (cur > seen) {
      run.necroStacks[key] = (run.necroStacks[key] || 0) + (cur - seen);
      run.seenNecroRunStackGain[key] = cur;
    }
  }

  // Spielertod: Leben abziehen; bei 0 ist der Run vorbei (der Raum-
  // Neustart passiert sonst automatisch ueber state.respawnTimer).
  if (st.playerDeaths > run.seenRoomDeaths) {
    const d = st.playerDeaths - run.seenRoomDeaths;
    run.seenRoomDeaths = st.playerDeaths;
    run.deaths += d;
    run.lives -= d;
    run.combo = 0; // Tod bricht die Combo
    run.comboTimer = 0;
    run.lastDeathCause = st.lastDeathCause;
    if (run.lives <= 0) {
      finishRun(run, false);
      return;
    }
  }

  // Raum geschafft: alle Gegner tot, Spieler lebt UND keine zweite Welle
  // steht mehr aus. Ohne die pendingWave-Pruefung galt der Raum als
  // geraeumt, wenn die letzten Welle-1-Gegner WAEHREND der 1-s-Vorwarnung
  // starben -- die zweite Welle wurde dann stillschweigend verschluckt.
  const enemiesLeft = st.tanks.filter((t) => t !== st.player && t.alive).length;
  if (enemiesLeft === 0 && !st.pendingWave && st.player.alive) {
    run.roomsCleared++;
    st.sounds.push('clear');
    // Schrott fuer den geraeumten Raum (deterministisch ueber genRng);
    // Eliteraeume geben das eliteMult-Fache.
    const sc = run.data.balance.scrap;
    let earned = sc.perRoom[0] + Math.floor(run.rng.scrap() * (sc.perRoom[1] - sc.perRoom[0] + 1));
    if (run.roomType === 'elite') earned *= sc.eliteMult;
    // Pluenderer-Upgrade (Phase 18, Tag resource): flacher Bonus NACH dem
    // Elite-Multiplikator, wie die einmalige Kriegsbeute-Belohnung auch
    // kein Vielfaches ist.
    earned += st.player.cfg.scrapBonusPerRoom || 0;
    run.scrap += earned;
    run.scrapThisRoom += earned;
    // E2: Schildladungen altern pro geraeumtem Raum -- Transformation
    // "Bollwerk" (Phase 17, Tag defense) setzt das komplett aus.
    if (!transformEffects(run).shieldNeverDecays) ageShieldCharges(run);
    st.texts.push({
      x: st.player.x,
      y: st.player.y - 30,
      text: `+${earned} Schrott`,
      age: 0,
      life: 1.2,
      color: '#e0c860',
    });
    // Grundsteinumbau Phase 6: das alte "Extraleben alle 5 geschaffte
    // Raeume" (extraLifeEveryClearedRooms) ist entfallen -- bei ~50 Raeumen
    // ueber drei Akte waeren das +8 bis +10 Leben gewesen (archive/
    // systeme-v1.md Abschnitt 5). Ersetzt durch acts[].lifeReward, nur beim
    // Bosskill vergeben (s. u.).
    if (run.isActBoss) {
      const actCfg = run.difficulty.acts[run.actIndex - 1];
      const reward = actCfg.lifeReward || 0;
      run.lastActLifeReward = reward;
      if (reward) run.lives = Math.min(run.maxLives, run.lives + reward);
      // Champion-/Nekromant-Nachschliff Abschnitt 17: nach JEDEM besiegten
      // Boss eine garantierte Belohnung mit drei UNTERSCHIEDLICHEN
      // legendaeren Karten, VOR dem Akt-Uebergang bzw. dem Sieg-Bildschirm
      // -- auch nach dem letzten Boss (finishBossReward() gewinnt den Run
      // erst, NACHDEM die Karte gewaehlt wurde).
      run.rewardKind = 'bossLegendary';
      const offers = rollBossReward(run);
      if (offers.length) {
        run.pendingOffers = offers;
        run.phase = 'bossReward';
        return;
      }
      // Sicherheitsnetz (Muster: der allgemeine Belohnungs-Sicherheitsnetz-
      // Zweig unten) -- ein Pool ohne genug distinkte Legendaere blockiert
      // den Run nicht, sondern zieht direkt weiter.
      run.rewardKind = null;
      finishBossReward(run);
      return;
    }
    // Belohnung: Eliteraeume ziehen aus dem Elite-Pool. Grundsteinumbau
    // Phase 9: Fluchraeume (cursed) geben jetzt wieder eine echte Kartenwahl
    // (Auftrag: "Kartenangebot nach Kampf-, Elite- und Fluchraeumen") --
    // Phase 4s Schrottpaket-Uebergangsloesung (grantTreasureScrap(), damals
    // fuer treasure UND cursed gemeinsam gebaut, weil der Sockel keine
    // Legendaere hatte) bleibt NUR fuer treasure bestehen (s. o., eigener
    // Zweig). Cursed nutzt denselben normalen Pool wie ein Kampfraum --
    // keine Sonderbehandlung mehr noetig, dieselbe Angebotslogik greift.
    run.rewardKind = run.roomType === 'elite' ? 'elite' : run.roomType === 'cursed' ? 'cursed' : 'normal';
    const offers = rollReward(run);
    if (!offers.length) {
      // Sicherheitsnetz (Grundsteinumbau Phase 4, proaktiv -- kein
      // Auftragstext dazu). Nekromant-V2 Phase 1: seit maxStacks abgeschafft
      // ist, kann eine nicht-einzigartige Karte den Pool nicht mehr durch
      // Stapeln leerziehen -- der Sockel (5 Karten, alle isUnique: false)
      // laeuft dadurch praktisch nie mehr leer. Leer bleibt trotzdem
      // MOEGLICH (minRoom/rarityGates in einem frueheren Raum,
      // signatureClass/exclusions ohne passende universelle Karte, ein
      // requires ohne erfuellte Voraussetzung) -- rollReward()/rollOffers()
      // liefern dann bewusst ein KUERZERES statt eines aufgefuellten Arrays
      // (kein Fallback mehr, s. upgradepool.js). Ohne dieses Netz bliebe
      // run.phase auf 'upgrade' mit 0 Angeboten haengen, ohne Weiter-Knopf --
      // derselbe Fehlerklasse wie der fruehere Kartenscreen-Blocker
      // (CLAUDE.md: "Bugfix: Kartenscreen blockierte den Run").
      run.rewardKind = null;
      afterRoomDone(run);
      return;
    }
    run.pendingOffers = offers;
    run.phase = 'upgrade';
  }
}

// Gemeinsame Pool-Parameter aus dem Run.
function poolOpts(run) {
  return {
    chosen: run.upgrades,
    roomIndex: run.roomIndex,
    rng: run.rng.upgrades,
    balance: run.data.balance,
    count: run.upgradesData.offersPerScreen,
    banned: run.bannedUpgrades,
    // Phase 18: Signaturkarten der gewaehlten Klasse (signatureClass-Filter,
    // bleibt als Pipeline-Baustein bestehen -- der Sockel setzt aktuell
    // keine signatureClass, s. archive/systeme-v1.md Abschnitt 3).
    starterTank: run.starterTank,
    // Upgradepool-v2 Phase 3: laufende Synergie-Tag-Bilanz fuer die
    // Angebotsgewichtung (makeSynergyWeight in upgradepool.js).
    synergyTags: run.synergyTags,
    // Nekromant-V2 Phase 1: zusaetzliche Filterquelle fuer isUnique-Karten
    // (s. upgradepool.js: buildCandidates()).
    selectedUniqueUpgradeIds: run.selectedUniqueUpgradeIds,
    // Kartenbelohnung/Shop-Ueberarbeitung: Seltenheitsgewichte fuer NORMALE
    // Belohnungen, gestaffelt nach dem runweiten Raumzaehler. Der Shop
    // ueberschreibt dies in startNonCombatRoom() mit shopRarityWeights().
    rarityWeights: rewardRarityWeights(run.data.balance, run.totalRoomIndex),
  };
}

// Grundsteinumbau Phase 4: das Zweitelement-System (UMBAUPLAN-LP Phase 17)
// und der Element-Filter (Phase 11) sind mit den damageType-Karten aus dem
// Sockel entfernt -- ELEMENTS/primaryElementOf/drawSecondElement/
// elementsOf/rerollSecondElement sind ersatzlos geloescht. Details/
// Wiederanschlusspunkt: ARCHIV.md, archive/systeme-v1.md Abschnitt 2.

// Belohnungs-Angebote je nach Raumtyp (Seed-RNG -> deterministisch):
//   normal = Standardpool (Tag-Regel, Rarity, isUnique/requires/minRoom)
//   elite  = normale Dreierauswahl BLEIBT, zusaetzlich automatisch (ohne
//            Schrottkosten) eine 4. Karte aus Tag 'elite' (Phase 9,
//            v3-Review-Korrektur: die alte Variante ERSETZTE die normale
//            Auswahl komplett -- bei nur 2-3 Elite-Karten die schlechtere
//            Wahl als eine normale Runde)
// Grundsteinumbau Phase 4: 'treasure' ruft rollReward() nicht mehr auf
// (grantTreasureScrap() ersetzt es) -- der onlyRarity:'legendary'-Zweig
// bleibt trotzdem stehen (Wiederanschlusspunkt fuer kuenftige Klassenpools
// mit Legendaeren). Grundsteinumbau Phase 9: 'cursed' ist NICHT mehr Teil
// dieses Zweigs -- Fluchraeume nutzen den normalen Pool ganz unten (kein
// eigener Fall noetig), rollOffers()/drawOne() fuellen ein erschoepftes
// Angebot seit Phase 4 nicht mehr mit einer Fallback-Karte auf -- Aufrufer
// hier vertragen ein kuerzeres/leeres Array (rerollOffers(), die
// Elite-4.-Karte hier, der Sicherheitsnetz-Zweig in stepRun()).
function rollReward(run) {
  const base = poolOpts(run);
  if (run.rewardKind === 'treasure') {
    return rollFromPool(run.upgradesData, {
      ...base,
      onlyRarity: 'legendary',
      bypassRoomGate: true,
      ignoreTagRule: true,
    });
  }
  if (run.rewardKind === 'elite') {
    // Champion-/Nekromant-Nachschliff Abschnitt 16: eigene, deutlich
    // episch/legendaer-lastigere Seltenheitstabelle statt der normalen
    // Belohnungsbaender fuer die Dreierauswahl.
    const eliteBase = { ...base, rarityWeights: eliteRarityWeights(run.data.balance, run.totalRoomIndex) };
    const offers = rollFromPool(run.upgradesData, eliteBase);
    const avoidTags = new Set(offers.map((o) => o.tag));
    const avoidIds = new Set(offers.map((o) => o.id));
    const eliteCard = drawOne(
      run.upgradesData,
      { ...base, includeTag: 'elite', bypassRoomGate: true },
      avoidTags,
      avoidIds,
    );
    // Elite-Pool erschoepft (alle einzigartigen Elite-Karten schon gewaehlt,
    // oder -- wie im Sockel aktuell -- gar keine Karte mit Tag 'elite'
    // vorhanden) -> keine 4. Karte statt eines Platzhaltereintrags.
    if (eliteCard) offers.push(eliteCard);
    // Harte Garantie: mindestens eine episch-oder-legendaere Karte, auch
    // wenn die boostete Tabelle rein zufaellig keine getroffen hat -- eine
    // legendaere Karte erfuellt die Anforderung ebenfalls. Ersetzt im
    // Zweifel die zuletzt gezogene Karte, statt das Angebot zu verlaengern
    // (Angebotsgroesse bleibt unveraendert).
    const hasEpicOrLegendary = offers.some((o) => o.rarity === 'epic' || o.rarity === 'legendary');
    if (!hasEpicOrLegendary && offers.length) {
      const avoidIds2 = new Set(offers.map((o) => o.id));
      const guaranteed =
        drawOne(run.upgradesData, { ...base, onlyRarity: 'legendary', bypassRoomGate: true }, new Set(), avoidIds2) ||
        drawOne(run.upgradesData, { ...base, onlyRarity: 'epic', bypassRoomGate: true }, new Set(), avoidIds2);
      if (guaranteed) offers[offers.length - 1] = guaranteed;
    }
    return offers;
  }
  return rollFromPool(run.upgradesData, base);
}

// Champion-/Nekromant-Nachschliff Abschnitt 17 (Boss-Belohnung): NACH jedem
// besiegten Akt-Boss werden bis zu drei UNTERSCHIEDLICHE legendaere Karten
// gezogen -- ueber drawOne() statt rollOffers(), weil rollOffers() die "kein
// doppelter Tag pro Angebot"-Regel durchsetzt (mehrere Legendaere teilen
// sich oft denselben Tag, das wuerde die Auswahl unnoetig verkleinern).
// avoidTags bleibt bewusst LEER (nur avoidIds waechst) -- Klassen-/
// Element-/isUnique-Filter aus buildCandidates() gelten trotzdem
// unveraendert. Liefert 0-3 Karten (kein Fallback/Platzhalter, Muster wie
// jede andere Kartenziehung seit Grundsteinumbau Phase 4).
export function rollBossReward(run) {
  const opts = { ...poolOpts(run), onlyRarity: 'legendary', bypassRoomGate: true };
  const offers = [];
  const avoidIds = new Set();
  for (let i = 0; i < 3; i++) {
    const card = drawOne(run.upgradesData, opts, new Set(), avoidIds);
    if (!card) break;
    offers.push(card);
    avoidIds.add(card.id);
  }
  return offers;
}

// Nach der Boss-Belohnung (gewaehlt ODER uebersprungen, falls der Pool leer
// war): derselbe Akt-Uebergang/Sieg-Pfad wie vor Abschnitt 17, nur aus dem
// Hauptfluss herausgezogen, damit ihn beide Aufrufer (chooseBossReward()
// UND das Sicherheitsnetz in stepRun()) teilen koennen.
function finishBossReward(run) {
  if (run.actIndex >= run.difficulty.acts.length) {
    // Letzter Akt (Phalanx) geschafft -> Run gewonnen, kein Uebergang mehr.
    finishRun(run, true);
    return;
  }
  // Akt 1/2 geschafft: Zwischenbildschirm statt der normalen
  // Belohnungsauswahl (der alte Finalraum bot ohnehin keine Karte an --
  // dieselbe Stelle prüfte früher direkt gegen totalRooms()).
  run.phase = 'actComplete';
}

// Boss-Belohnung waehlen: applyUpgradeChoice() wie jede andere Kartenwahl
// (Stapelzaehler, isUnique-Sperre, Tag-/Synergie-Buchfuehrung), aber
// endet NICHT in afterRoomDone() -- der Bossraum ist bereits geraeumt, der
// naechste Schritt ist der Akt-Uebergang bzw. der Sieg.
export function chooseBossReward(run, index) {
  if (run.phase !== 'bossReward' || !run.pendingOffers) return;
  const offer = run.pendingOffers[index];
  if (!offer) return;
  applyUpgradeChoice(run, offer);
  run.pendingOffers = null;
  run.rewardKind = null;
  finishBossReward(run);
}

// --- Phase-3-Schrott-Aktionen im Upgrade-Screen ---
// Alle geben true zurueck, wenn tatsaechlich (genug Schrott) ausgefuehrt.

// Neu wuerfeln: frische 3 Karten (Tag-Regel + Verbannungen gelten weiter).
export function rerollOffers(run) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return false;
  const cost = run.data.balance.scrap.cost.reroll;
  if (run.scrap < cost) return false;
  const offers = rollReward(run); // gleicher Belohnungs-Typ
  // Grundsteinumbau Phase 4: Pool erschoepft -> kein Reroll moeglich, kein
  // Schrott verloren (vor dem Abzug geprueft statt danach).
  if (!offers.length) return false;
  run.scrap -= cost;
  run.pendingOffers = offers;
  return true;
}

// Verbannen: Karte fuer den Rest des Runs aus dem Pool nehmen und durch
// eine neue ersetzen (deren Tag sich von den anderen Karten unterscheidet).
export function banOffer(run, index) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return false;
  const offer = run.pendingOffers[index];
  if (!offer) return false;
  const cost = run.data.balance.scrap.cost.ban;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.bannedUpgrades.add(offer.id);
  const kept = run.pendingOffers.filter((_, i) => i !== index);
  const avoidTags = new Set(kept.map((o) => o.tag));
  const avoidIds = new Set(kept.map((o) => o.id));
  const replacement = drawOne(run.upgradesData, poolOpts(run), avoidTags, avoidIds);
  // Grundsteinumbau Phase 4: kein Fallback mehr -- ist der Pool erschoepft,
  // faellt die verbannte Karte ersatzlos weg statt eines Platzhaltereintrags.
  if (replacement) run.pendingOffers[index] = replacement;
  else run.pendingOffers.splice(index, 1);
  return true;
}

// Vierte Karte: eine zusaetzliche Karte aufdecken (Tag-Regel gilt weiter).
// Nur von 3 auf 4 -- nicht beliebig stapelbar.
export function buyFourthCard(run) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return false;
  if (run.pendingOffers.length >= 4) return false;
  const cost = run.data.balance.scrap.cost.fourthCard;
  if (run.scrap < cost) return false;
  const avoidTags = new Set(run.pendingOffers.map((o) => o.tag));
  const avoidIds = new Set(run.pendingOffers.map((o) => o.id));
  const extra = drawOne(run.upgradesData, poolOpts(run), avoidTags, avoidIds);
  if (!extra) return false; // nichts Sinnvolles mehr -> kein Kauf
  run.scrap -= cost;
  run.pendingOffers.push(extra);
  return true;
}

// Schildladung kaufen: +1 Notschild-Ladung, auch ohne das Schild-Upgrade.
export function buyShieldCharge(run) {
  const cost = run.data.balance.scrap.cost.shieldCharge;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  addShieldCharges(run, 1);
  return true;
}

// --- Phase-13-Shop-Aktionen (nur waehrend phase 'workshop') --------------
// Alle geben true zurueck, wenn tatsaechlich ausgefuehrt. Anders als der
// Upgrade-Screen schliesst KEINE davon den Raum -- man bleibt im Shop, bis
// leaveWorkshop() gedrueckt wird.

// Karte aus dem Regal kaufen. Die Karte wirkt exakt wie eine im
// Upgrade-Screen gewaehlte (gemeinsames applyUpgradeChoice), verschwindet
// danach aber nur aus dem Regal, statt den Raum zu beenden.
export function buyShopCard(run, index) {
  if (run.phase !== 'workshop' || !run.shopOffers) return false;
  const offer = run.shopOffers[index];
  if (!offer || offer.sold) return false;
  // Kartenbelohnung/Shop-Ueberarbeitung: individueller, beim Betreten des
  // Shops einmalig gewuerfelter Preis (offer.price) statt eines
  // einheitlichen Werts -- s. startNonCombatRoom()/rollShopPrice().
  const cost = offer.price;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  offer.sold = true;
  applyUpgradeChoice(run, offer);
  return true;
}

// Gadget tauschen (P4; hiess bis dahin "Sekundaerwaffe tauschen"). Der
// Eintrag in run.upgrades wird mitgesetzt, damit dasselbe Gadget spaeter
// nicht noch einmal als Karte im Pool auftaucht -- wie beim Kartenwechsel.
// Die Bombe ist bewusst NICHT tauschbar: sie liegt seit P4 im festen
// Sekundaerslot.
export function buyShopSecondary(run, id) {
  if (run.phase !== 'workshop') return false;
  // Nutzerwunsch: der Nekromant hat gar keinen zweiten (Gadget-)Slot mehr --
  // die Geisterbombe ist seine einzige, unaustauschbare Sekundaerfunktion.
  // Die Kartenwahl sperrt Gadget-Karten bereits ueber exclusions
  // (upgradepool.js: buildCandidates()); dieser Shop-Kauf ist ein zweiter,
  // davon unabhaengiger Codepfad und braucht deshalb dieselbe Sperre hier.
  if (run.data.types[run.starterTank]?.necromancer) return false;
  const scfg = run.data.secondaries?.[id];
  if (!scfg || scfg.category !== 'gadget') return false;
  if (id === run.equippedGadget) return false; // schon ausgeruestet
  const cost = run.data.balance.scrap.cost.shopSecondary;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.equippedGadget = id;
  run.upgrades[id] = Math.max(1, run.upgrades[id] || 0);
  return true;
}

// Leben kaufen: teuer und nur EINMAL pro Shop-Besuch (run.shopLifeBought
// wird beim Betreten des Raums zurueckgesetzt).
export function buyShopLife(run) {
  if (run.phase !== 'workshop' || run.shopLifeBought) return false;
  // Grundsteinumbau Phase 8: Testschritt 4 verlangt "bei vollem Stand
  // gesperrt" -- fehlte bisher (Phase 13 kannte nur die Einmal-pro-Besuch-
  // Sperre). Reparaturtrupp am Rastplatz hat denselben Deckel schon laenger
  // (repairAtRest()).
  if (run.lives >= run.maxLives) return false;
  const cost = run.data.balance.scrap.cost.shopLife;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.lives++;
  run.shopLifeBought = true;
  return true;
}

// Werkbank im Shop (Grundsteinumbau Phase 8, ueberarbeitet Champion-/
// Nekromant-Nachschliff Abschnitt 2): dieselbe "erneut waehlen"-Mechanik wie
// am Rastplatz (repickOwnedCard()), hier gegen Schrott statt kostenlos --
// und ohne Raumfluss, man bleibt im Shop wie bei jeder anderen Aktion hier.
export function buyShopUpgradeLevel(run, id) {
  if (run.phase !== 'workshop') return false;
  const cost = run.data.balance.scrap.cost.upgradeLevel ?? 0;
  if (run.scrap < cost) return false;
  if (!repickOwnedCard(run, id)) return false;
  run.scrap -= cost;
  return true;
}

// Effekte EINER angenommenen Karte anwenden (Upgrade-Screen wie Shop).
// Bewusst ohne Raumfluss/Kosten -- die Aufrufer entscheiden, was danach
// passiert: chooseUpgrade() zieht weiter, buyShopCard() (Phase 13) bleibt
// im Shop. So gibt es die Sonderfaelle (Sekundärslot, Glaskanone,
// Notschild, Trophäe, Kriegsbeute, Ersatzpanzer) nur EINMAL im Code.
//
// Grundsteinumbau Phase 4: der fruehere `offer.fallback`-Zweig ("+1 Leben"
// ohne echte Karte) ist entfallen -- rollOffers()/drawOne() liefern seit
// dieser Phase nie mehr eine Fallback-Karte (s. upgradepool.js), jeder
// `offer` hier ist also immer eine echte Sockelkarte.
function applyUpgradeChoice(run, offer) {
  run.upgrades[offer.id] = (run.upgrades[offer.id] || 0) + 1;
  // Nekromant-V2 Phase 1: einzigartige Karten (isUnique: true) landen zentral
  // in run.selectedUniqueUpgradeIds -- gefiltert aus jeder Kartenquelle
  // (upgradepool.js: buildCandidates()). run.upgrades[id] bleibt zusaetzlich
  // stehen (Anzeige/Level), die Menge ist die maszgebliche Sperre.
  if (run.upgradesData.upgrades[offer.id]?.isUnique) {
    run.selectedUniqueUpgradeIds.add(offer.id);
  }
  // Gadgetslot (P4): eine neue Gadgetkarte ersetzt das aktive Gadget -- die
  // alte Karte bleibt in run.upgrades stehen (isUnique verhindert seit Phase 1
  // ein erneutes Ziehen derselben Karte, s. o.), ist aber nicht mehr
  // ausgeruestet. Die Bombe liegt seit P4 im eigenen, festen Slot und kann
  // nie verloren gehen.
  if (offer.tag === 'gadget') run.equippedGadget = offer.id;
  // Glaskanone: reduziert die Leben dauerhaft auf 1 (starker Trade-off).
  if (offer.id === 'glaskanone') run.lives = 1;
  // Notschild: jede Stufe gibt chargesPerStack Ladungen (raumuebergreifend).
  if (offer.id === 'emergency_shield') {
    const cps = run.upgradesData.upgrades.emergency_shield.chargesPerStack || 1;
    addShieldCharges(run, cps);
  }
  // Trophäe (Elite): +Schildladung(en), dauerhaft.
  if (offer.id === 'trophaee') {
    addShieldCharges(run, run.upgradesData.upgrades.trophaee.shieldCharges || 1);
  }
  // Kriegsbeute (Elite, Phase 9): sofortiger Schrott-Bonus.
  if (offer.id === 'kriegsbeute') {
    run.scrap += run.upgradesData.upgrades.kriegsbeute.scrapBonus || 5;
  }
  // Ersatzpanzer (Sockelkarte, Grundsteinumbau Phase 4): einzige Sockelkarte
  // ohne core-Schluessel in der generischen cfg.js-Kernpool-Schleife --
  // core.extraLifeAdd wirkt auf run.maxLives UND run.lives (echtes
  // Zusatzleben, kein Heilen bis zum bisherigen Maximum).
  const extraLife = run.upgradesData.upgrades[offer.id]?.core?.extraLifeAdd;
  if (extraLife) {
    run.maxLives += extraLife;
    run.lives += extraLife;
  }
  run.upgradeChoices++;
  // Phase 7b: eigene Bestaetigung fuer die Kartenwahl -- bis dahin war der
  // Upgrade-Screen der einzige Belohnungsmoment ganz ohne Ton.
  run.state?.sounds.push('upgrade');
  // Tags weiter zaehlen (Telemetrie). Grundsteinumbau Phase 4: die
  // Transformations-Freischaltung (unlockTransformation()) wird bewusst
  // NICHT mehr aufgerufen -- der Sockel hat keine drei Karten desselben
  // Transformations-Tags mehr (die fuenf Sockel-Tags sind absichtlich
  // andere als terrain/mobility/information/defense/control, s.
  // data/upgrades.json: _comment_sockel). unlockTransformation() selbst UND
  // data/transformations.json bleiben unangetastet stehen
  // (Wiederanschlusspunkt, archive/systeme-v1.md Abschnitt 1).
  if (offer.tag) {
    run.tagCounts[offer.tag] = (run.tagCounts[offer.tag] || 0) + 1;
  }
  // Upgradepool-v2 Phase 3: Synergie-Tags separat bilanzieren (tags[] aus
  // Phase 2, eigenstaendige Achse neben der Hauptkategorie `tag` oben).
  // Speist ausschliesslich die Angebotsgewichtung, keine Transformationen.
  if (offer.tags && offer.tags.length) {
    for (const t of offer.tags) {
      run.synergyTags[t] = (run.synergyTags[t] || 0) + 1;
    }
  }
}

// Transformationen (Phase 17): drei Karten desselben Tags schalten einen
// dauerhaften Bonus frei (nur die 5 Tags, die tatsaechlich 3x stapelbar
// sind -- data/transformations.json). run.newTransformation haelt die
// zuletzt freigeschaltete fuer eine kurze Text-Einblendung (main.js).
//
// Grundsteinumbau Phase 4: die Funktion bleibt UNANGETASTET stehen, wird
// aber von applyUpgradeChoice() nicht mehr aufgerufen -- der Sockel hat
// keine drei Karten desselben Transformations-Tags mehr (Wiederanschluss-
// punkt, archive/systeme-v1.md Abschnitt 1).
function unlockTransformation(run, tag) {
  const threshold = run.data.transformations?.threshold ?? 3;
  if (run.tagCounts[tag] < threshold) return;
  const defs = run.data.transformations?.transformations || {};
  const entry = Object.values(defs).find((t) => t.tag === tag);
  if (!entry || run.transformations.has(entry.id)) return;
  run.transformations.add(entry.id);
  run.newTransformation = entry;
}

// Auswahl anwenden und den Run fortsetzen.
export function chooseUpgrade(run, index) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return;
  const offer = run.pendingOffers[index];
  if (!offer) return;
  applyUpgradeChoice(run, offer);
  run.pendingOffers = null;
  run.rewardKind = null;
  afterRoomDone(run); // Kartenwahl oder automatischer Weiterzug
}

// Transformations-Schalter (Phase 17). Bis dahin bewusst leer -- die
// Definitionen in data/transformations.json warten dort auf ihre Phase.
export function transformEffects(run) {
  const out = {};
  for (const id of run.transformations) {
    Object.assign(out, run.data.transformations?.transformations[id]?.effects || {});
  }
  return out;
}

// Nach dem Sieg weiterspielen (Endlos-Modus): Raeume laufen mit weiter
// wachsendem Budget durch, bis der Spieler stirbt. Der Sieg bleibt in
// der Statistik gezaehlt.
export function continueEndless(run) {
  if (run.phase !== 'victory') return;
  run.endless = true;
  run.roomIndex++;
  startRoom(run, 'combat');
}

// Fuer HUD: "4/7"-Restzaehler.
export function enemyCount(run) {
  const st = run.state;
  const total = st.tanks.length - 1;
  const alive = st.tanks.filter((t) => t !== st.player && t.alive).length;
  return { alive, total };
}

export { totalRooms };
