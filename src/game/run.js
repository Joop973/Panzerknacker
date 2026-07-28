// Run-Struktur (Spec Abschnitt 8): 15 generierte Raeume + Finalraum,
// Leben, Gefahrenbudget mit Freischaltkurve, Raum-Neustart bei Tod
// (getoetete Gegner bleiben tot), Raumuebergangs-Einblendung,
// Victory/Game-Over mit Statistik und Seed.
//
// RNG (Phase 0b): Der Run haelt KEINEN fortlaufenden Zufallszustand mehr.
// Pro Raum werden benannte Stroeme aus hash(seed, roomIndex, label)
// abgeleitet (siehe makeRoomStreams). Damit ist ein Run allein aus
// Seed + Raumnummer reproduzierbar (Fortsetzen, geteilte Seeds, Replays),
// und eine Aenderung an einem System verschiebt die anderen nicht.

import { rngFor, rngForRun, hashSeed } from '../core/rng.js';
import { recordRun, loadStats, saveCurrentRun, clearCurrentRun } from '../core/storage.js';
import { createState, stepState } from './state.js';
import { rollOffers as rollFromPool, drawOne } from './upgradepool.js';

const TRANSITION_S = 1.5;
const COMBO_WINDOW = 2.5; // s: Zeitfenster fuer die naechste Combo-Kill

// Raumtyp -> Anzeige (Raumvorschau + Kartenscreen, Phase 12). Symbole sind
// DOM-Emojis. War bis Phase 12 nur in der Vorschau sichtbar (der Raumtyp
// selbst wurde unsichtbar automatisch gewuerfelt) -- jetzt zusaetzlich fuer
// die Knoten der Kartenanzeige wiederverwendet.
export const ROOM_TYPE_INFO = {
  combat: { name: 'Kampf', symbol: '⚔️', desc: 'Ein normaler Gefechtsraum.' },
  elite: { name: 'Elite', symbol: '★', desc: 'Härtere Gegner mit Affix · doppelter Schrott · Elite-Belohnung.' },
  treasure: { name: 'Schatz', symbol: '💎', desc: 'Keine Gegner · 1 Legendär — kostet 1 Leben.' },
  workshop: { name: 'Shop', symbol: '🛒', desc: 'Keine Gegner · Karten, Schild, Sekundärwaffe, Leben kaufen · Upgrade ablegen.' },
  event: { name: 'Ereignis', symbol: '❓', desc: 'Keine Gegner · eine Entscheidung.' },
  cursed: { name: 'Verflucht', symbol: '☠️', desc: 'Gegner mit zusätzlichem Affix · garantiertes Legendär.' },
};

// Kauft Gegner vom Gefahrenbudget (nur freigeschaltete Typen, max. 8).
// `maxPerRoom` in difficulty.json deckelt einzelne Typen zusaetzlich
// (Phase 4: hoechstens ein Prisma pro Raum).
function buyEnemies(diff, genRng, roomIndex, budget) {
  const unlocked = Object.entries(diff.danger).filter(
    ([, d]) => roomIndex >= d.unlockRoom,
  );
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

function totalRooms(diff) {
  return diff.roomsBeforeFinal + 1; // 15 + Finalraum
}

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

// Kartengenerierung (Phase 12): einmalig deterministisch aus dem Seed
// (eigener Run-weiter Strom statt eines pro-Raum-Stroms, siehe
// core/rng.js: rngForRun) -- die Karte steht komplett fest, bevor der Run
// beginnt ("vollstaendig vorab einsehbar", PLAN.md). Raum 1-2 sind je ein
// einzelner Kampf-Knoten (data/difficulty.json: map.forcedCombatLayers),
// danach 2-3 Knoten je Reihe mit Typ aus denselben Gewichten, die vorher
// die unsichtbare Automatik gesteuert haben (doors.weights) -- die
// Raumtyp-Logik selbst aendert sich durch die Karte nicht (Fund beim
// v3-Review). Letzte Reihe ist immer der Finalraum (ein Boss-Knoten).
function generateMap(seed, diff) {
  const rng = rngForRun(seed, 'map');
  const mapCfg = diff.map || {};
  const weights = diff.doors.weights;
  const types = Object.keys(weights);
  const forcedLayers = mapCfg.forcedCombatLayers ?? 2;
  const minN = mapCfg.minNodesPerLayer ?? 2;
  const maxN = mapCfg.maxNodesPerLayer ?? 3;
  const extraEdgeChance = mapCfg.extraEdgeChance ?? 0.4;
  const finalIdx = diff.roomsBeforeFinal + 1;

  const layers = [];
  for (let layer = 1; layer <= diff.roomsBeforeFinal; layer++) {
    const forced = layer <= forcedLayers;
    const count = forced ? 1 : minN + Math.floor(rng() * (maxN - minN + 1));
    const nodes = [];
    for (let col = 0; col < count; col++) {
      const type = forced ? 'combat' : weightedType(types, weights, rng);
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

  // Sicherheitsnetz: `treasure` ist bei zu wenig Leben nicht waehlbar
  // (chooseMapNode()). Fuehren ALLE Kanten eines Knotens ausschliesslich zu
  // Schatzkammern, waere der Weg dort bei 1 Leben eine Sackgasse -- die
  // zufaellige Typwahl kann das (selten) erzeugen. Faerbt in diesem Fall
  // die erste Alternative auf 'combat' um (immer waehlbar).
  for (const layer of layers) {
    for (const node of layer) {
      if (node.next.length && node.next.every((id) => byId.get(id).type === 'treasure')) {
        byId.get(node.next[0]).type = 'combat';
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

// Benannte RNG-Stroeme fuer den aktuellen Raum neu ableiten. Getrennte
// Labels sorgen dafuer, dass z. B. eine geaenderte Upgrade-Logik die
// Raumlayouts nicht verschiebt.
function makeRoomStreams(run) {
  const s = run.seed;
  const i = run.roomIndex;
  run.rng = {
    rooms: rngFor(s, i, 'rooms'), // Layout, Kachelwahl, Spawns
    enemies: rngFor(s, i, 'enemies'), // Gegner-Einkauf + Elite-Affix
    upgrades: rngFor(s, i, 'upgrades'), // Upgrade-Angebote (inkl. Rerolls)
    scrap: rngFor(s, i, 'scrap'), // Schrottmenge
    events: rngFor(s, i, 'events'), // Ereignis-Auswahl
    modifiers: rngFor(s, i, 'modifiers'), // Raum-Modifikator (Phase 10)
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
    roomIndex: run.roomIndex,
    roomType: run.roomType,
    mapCurrentId: run.mapCurrentId, // Phase 12: Position auf der Karte (Wahl, nicht ableitbar)
    lives: run.lives,
    shieldCharges: run.shieldCharges.slice(), // mit Restlaufzeit je Ladung
    scrap: run.scrap,
    upgrades: { ...run.upgrades },
    equippedSecondary: run.equippedSecondary,
    banned: [...run.bannedUpgrades],
    tagCounts: { ...run.tagCounts },
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
  run.seenTrickshotScrap = 0;
  run.combo = 0; // Combo gilt nur innerhalb eines Raums
  run.comboTimer = 0;
}

// Baut einen Raum vom gegebenen Typ (Phase 4). Kampf-/Eliteraeume bauen
// eine Arena; Nicht-Kampf-Raeume (treasure/workshop/event) behalten den
// geraeumten Vorraum als Kulisse und starten ihre Interaktion.
function startRoom(run, type = 'combat') {
  const diff = run.difficulty;
  const finalIdx = diff.roomsBeforeFinal + 1;
  const isFinal = !run.endless && run.roomIndex === finalIdx;
  // Der Finalraum ist immer Kampf (Sicherheitsnetz -- die Karte markiert die
  // letzte Reihe ohnehin schon als 'combat'-Boss-Knoten, siehe generateMap()).
  if (isFinal) type = 'combat';
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
  // Raum-Modifikator (Phase 10): ab data/modifiers.json.minRoom einer pro
  // Kampf-/Eliteraum, sichtbar in der Vorschau. Der Finalraum bleibt davon
  // ausgenommen -- handgebaute Encounter sollen wie geplant bleiben, gleiches
  // Prinzip wie der Wellen-Ausschluss (`!isFinal`) in Phase 9.
  const modifier = isFinal ? null : rollRoomModifier(run);
  let enemyTypes;
  let fixedRoom = null;
  let weights = null;
  if (isFinal) {
    // Handgebauter Finalraum: 2x t_black plus eingekaufte Unterstuetzung.
    fixedRoom = run.tiles.finalRoom;
    enemyTypes = [
      ...diff.finalRoom.fixed,
      ...buyEnemies(diff, run.rng.enemies, run.roomIndex, diff.finalRoom.supportBudget),
    ].slice(0, run.tiles.finalRoom.enemySpawns.length);
    run.roomCharacter = 'Finale';
  } else {
    const eliteMult = type === 'elite' ? diff.elite.budgetMult : 1;
    // Modifikator "Ueberfuellt" (Phase 10): 50 % mehr Gefahrenbudget -> mehr
    // (bzw. staerkere) Gegner, kompensiert durch aggressionMult in cfg.js.
    const crowdedMult = modifier?.enemyBudgetMult || 1;
    const budget =
      (diff.budget.base + run.roomIndex * diff.budget.perRoom) * run.budgetMult * eliteMult * crowdedMult;
    enemyTypes = buyEnemies(diff, run.rng.enemies, run.roomIndex, budget);
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
    aiSeed: hashSeed(run.seed, run.roomIndex, 'ai'),
    fixedRoom,
    weights,
    playerUpgrades: run.upgrades,
    upgradesData: run.upgradesData,
    equippedSecondary: run.equippedSecondary,
    shieldCharges: run.shieldCharges, // raumuebergreifende Notschild-Ladungen
    // Weiche (Phase 0b): setzt das Raumspec `fixedLayout`, kommt das Layout
    // aus data/arenas.json statt aus dem Kachelgenerator.
    roomSpec: run.roomSpec,
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

// Nicht-Kampf-Raum: kein neuer Arena-Zustand -- der Vorraum bleibt Kulisse.
function startNonCombatRoom(run, type) {
  if (type === 'treasure') {
    // Kostet beim Betreten Leben (nie toedlich -- Tuer war ab 1 Leben gesperrt).
    run.lives = Math.max(1, run.lives - run.difficulty.treasure.lifeCost);
    run.rewardKind = 'treasure';
    run.pendingOffers = rollReward(run);
    run.phase = 'upgrade';
  } else if (type === 'workshop') {
    // Shop (Phase 13): Kartenregal EINMAL beim Betreten ziehen, damit es
    // sich beim Neu-Rendern nach jeder Aktion nicht neu mischt. Beim
    // Fortsetzen entsteht dasselbe Regal automatisch neu (gleicher Seed +
    // gleiche Raumnummer -> gleicher `upgrades`-Strom), deshalb steht es
    // NICHT im runSnapshot -- selbes Prinzip wie roomModifier in Phase 10.
    run.shopOffers = rollFromPool(run.upgradesData, {
      ...poolOpts(run),
      count: run.data.balance.shop?.cardChoices ?? 5,
    });
    run.shopLifeBought = false; // "Leben: einmal pro Shop"
    run.phase = 'workshop';
  } else if (type === 'event') {
    const evs = run.data.events.events;
    run.currentEvent = evs[Math.floor(run.rng.events() * evs.length)];
    run.phase = 'event';
  }
}

// Tatsaechlich zum Zielknoten wechseln: naechster Raum, Kartenposition
// nachziehen.
function advanceToMapNode(run, node) {
  run.roomIndex = node.layer;
  run.mapCurrentId = node.id;
  startRoom(run, node.type);
}

// Nach einem erledigten Raum (Belohnung gewaehlt bzw. Interaktion beendet):
// Kartennavigation (Phase 12) statt der fruehren unsichtbaren Automatik.
// Endlos-Modus bleibt bewusst AUSSERHALB der Karte -- reiner Kampf-
// Nachschub mit wachsendem Budget, wie schon vor Phase 12.
function afterRoomDone(run) {
  if (run.endless) {
    run.roomIndex++;
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
  afterRoomDone(run);
  return { event: evId, option: index };
}

// Vom "Weiter"-Button der Raumvorschau aufgerufen.
export function enterRoom(run) {
  if (run.phase !== 'preview') return;
  run.phase = 'transition';
  run.transitionTimer = TRANSITION_S;
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
    upgrades: { mine: 1 }, // gewaehlte Upgrade-Level {id: stufe} -- Mine ist Startbelegung
    equippedSecondary: 'mine', // Phase 6: aktive Sekundärwaffe (austauschbar per Upgrade)
    upgradeChoices: 0,
    // Notschild-Ladungen als Liste (E2): Eintrag = verbleibende geraeumte
    // Raeume bis zum Verfall. Jede Ladung altert einzeln.
    shieldCharges: [],
    scrap: 0, // Schrott-Waehrung (Run-State, Phase 3)
    scrapThisRoom: 0, // im aktuellen Raum verdienter Schrott (Telemetrie)
    bannedUpgrades: new Set(), // im Run verbannte Upgrade-ids (nicht persistent)
    pendingOffers: null,
    shopOffers: null, // Phase 13: Kartenregal des aktuellen Shops
    shopLifeBought: false, // Phase 13: Leben nur einmal pro Shop-Besuch
    // --- Phase 4: Raumtypen + Tuerwahl ---
    // --- Phase 5: Transformationen ---
    tagCounts: {}, // {tag: Anzahl gewaehlter Upgrades} -- Stacks zaehlen einzeln
    transformations: new Set(), // freigeschaltete Transformations-ids
    roomSpec: opts.roomSpec || null, // { fixedLayout } -> Arena-Weiche
    roomType: 'combat', // Typ des aktuellen Raums
    currentEvent: null, // aktives Event waehrend phase 'event'
    rewardKind: null, // 'normal' | 'elite' | 'treasure' | 'cursed' fuer den Belohnungspool
    roomAffix: null, // Name(n) des Elite-Affix, "A + B" bei zweien (nur Eliteraeume)
    roomAffixes: [], // dieselben Affixe als Namensliste (Phase 9: 0-2 kombinierbar)
    roomModifier: null, // Raum-Modifikator-Objekt aus data/modifiers.json (Phase 10)
    killsByType: {}, // Statistik fuer die Endscreens
    shotsFired: 0, // Spieler-Abzuege ueber den ganzen Run (Trefferquote)
    combo: 0, // laufende Kill-Combo
    comboTimer: 0, // s bis die Combo verfaellt
    bestCombo: 0, // hoechste Combo im Run
    seed: seed >>> 0,
    roomIndex: 1,
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
  // Karte (Phase 12): einmalig deterministisch aus dem Seed erzeugt (eigener
  // Run-weiter Strom statt eines pro-Raum-Stroms) und bleibt fuer den
  // GANZEN Run unveraendert -- "vollstaendig vorab einsehbar" (PLAN.md).
  run.map = generateMap(run.seed, difficulty);
  run.mapCurrentId = run.map.layers[0][0].id; // Startknoten (Raum 1)
  // Fortsetzen: Zustand vor dem Raumbau einspielen, damit startRoom()
  // denselben Raum wie beim Abbruch erzeugt (Seed + Raumnummer genuegen).
  if (opts.resume) {
    const r = opts.resume;
    run.roomIndex = r.roomIndex;
    run.lives = r.lives;
    run.shieldCharges = (r.shieldCharges || []).slice();
    run.scrap = r.scrap || 0;
    run.upgrades = { ...(r.upgrades || {}) };
    run.equippedSecondary = r.equippedSecondary || 'mine';
    run.bannedUpgrades = new Set(r.banned || []);
    run.tagCounts = { ...(r.tagCounts || {}) };
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
  startRoom(run);
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
  // Trickshot-Belohnung (Phase 5): kurze Zeitlupe nach einem Abpraller-Kill.
  // Kombiniert sich mit Taktiker -- der staerkere (kleinere) Wert gewinnt.
  if (st.trickshotTimer > 0) {
    scale = Math.min(scale, run.data.balance.trickshot.slowMoScale);
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
  // Trickshot-Schrott (Phase 5) genauso ueberfuehren wie andere
  // Raum-Zaehler -- state.js kennt nur `run`-unabhaengige Rohwerte.
  if (st.trickshotScrap > run.seenTrickshotScrap) {
    const gained = st.trickshotScrap - run.seenTrickshotScrap;
    run.seenTrickshotScrap = st.trickshotScrap;
    run.scrap += gained;
    run.scrapThisRoom += gained;
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

  // Raum geschafft: alle Gegner tot, Spieler lebt.
  const enemiesLeft = st.tanks.filter((t) => t !== st.player && t.alive).length;
  if (enemiesLeft === 0 && st.player.alive) {
    run.roomsCleared++;
    st.sounds.push('clear');
    // Schrott fuer den geraeumten Raum (deterministisch ueber genRng);
    // Eliteraeume geben das eliteMult-Fache.
    const sc = run.data.balance.scrap;
    let earned = sc.perRoom[0] + Math.floor(run.rng.scrap() * (sc.perRoom[1] - sc.perRoom[0] + 1));
    if (run.roomType === 'elite') earned *= sc.eliteMult;
    run.scrap += earned;
    run.scrapThisRoom += earned;
    ageShieldCharges(run); // E2: Schildladungen altern pro geraeumtem Raum
    st.texts.push({
      x: st.player.x,
      y: st.player.y - 30,
      text: `+${earned} Schrott`,
      age: 0,
      life: 1.2,
      color: '#e0c860',
    });
    // Extraleben alle 5 geschaffte Raeume.
    if (run.roomsCleared % run.difficulty.extraLifeEveryClearedRooms === 0) {
      run.lives++;
    }
    if (!run.endless && run.roomIndex >= totalRooms(run.difficulty)) {
      finishRun(run, true);
      return;
    }
    // Belohnung: Eliteraeume ziehen aus dem Elite-Pool, Verflucht (Phase 12)
    // gibt ein garantiertes Legendaer wie eine Schatzkammer, sonst normal.
    run.rewardKind = run.roomType === 'elite' ? 'elite' : run.roomType === 'cursed' ? 'cursed' : 'normal';
    run.pendingOffers = rollReward(run);
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
    equippedSecondary: run.equippedSecondary,
  };
}

// Belohnungs-Angebote je nach Raumtyp (Seed-RNG -> deterministisch):
//   normal   = Standardpool (Tag-Regel, Rarity, maxStacks/requires/minRoom)
//   elite    = normale Dreierauswahl BLEIBT, zusaetzlich automatisch (ohne
//              Schrottkosten) eine 4. Karte aus Tag 'elite' (Phase 9,
//              v3-Review-Korrektur: die alte Variante ERSETZTE die normale
//              Auswahl komplett -- bei nur 2-3 Elite-Karten die schlechtere
//              Wahl als eine normale Runde)
//   treasure = nur Legendaries (Tag-Regel aus, Raumgrenzen aus)
//   cursed   = dieselbe Nur-Legendaries-Regel wie treasure (Phase 12) --
//              der garantierte Fund ist der Ausgleich fuer den erzwungenen
//              Affix, kostet aber (anders als treasure) kein Leben
// Fehlende Slots fuellt der Pool mit "+1 Leben" auf.
function rollReward(run) {
  const base = poolOpts(run);
  if (run.rewardKind === 'treasure' || run.rewardKind === 'cursed') {
    return rollFromPool(run.upgradesData, {
      ...base,
      onlyRarity: 'legendary',
      bypassRoomGate: true,
      ignoreTagRule: true,
    });
  }
  if (run.rewardKind === 'elite') {
    const offers = rollFromPool(run.upgradesData, base);
    const avoidTags = new Set(offers.filter((o) => !o.fallback).map((o) => o.tag));
    const avoidIds = new Set(offers.filter((o) => !o.fallback).map((o) => o.id));
    const eliteCard = drawOne(
      run.upgradesData,
      { ...base, includeTag: 'elite', bypassRoomGate: true },
      avoidTags,
      avoidIds,
    );
    // Elite-Pool erschoepft (alle 3 Karten maxStacks erreicht) -> keine
    // 4. Karte statt eines redundanten zweiten Fallbacks.
    if (!eliteCard.fallback) offers.push(eliteCard);
    return offers;
  }
  return rollFromPool(run.upgradesData, base);
}

// --- Phase-3-Schrott-Aktionen im Upgrade-Screen ---
// Alle geben true zurueck, wenn tatsaechlich (genug Schrott) ausgefuehrt.

// Neu wuerfeln: frische 3 Karten (Tag-Regel + Verbannungen gelten weiter).
export function rerollOffers(run) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return false;
  const cost = run.data.balance.scrap.cost.reroll;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.pendingOffers = rollReward(run); // gleicher Belohnungs-Typ
  return true;
}

// Verbannen: Karte fuer den Rest des Runs aus dem Pool nehmen und durch
// eine neue ersetzen (deren Tag sich von den anderen Karten unterscheidet).
export function banOffer(run, index) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return false;
  const offer = run.pendingOffers[index];
  if (!offer || offer.fallback) return false; // Fallback ist nicht verbannbar
  const cost = run.data.balance.scrap.cost.ban;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.bannedUpgrades.add(offer.id);
  const kept = run.pendingOffers.filter((_, i) => i !== index);
  const avoidTags = new Set(kept.filter((o) => !o.fallback).map((o) => o.tag));
  const avoidIds = new Set(kept.filter((o) => !o.fallback).map((o) => o.id));
  run.pendingOffers[index] = drawOne(run.upgradesData, poolOpts(run), avoidTags, avoidIds);
  return true;
}

// Vierte Karte: eine zusaetzliche Karte aufdecken (Tag-Regel gilt weiter).
// Nur von 3 auf 4 -- nicht beliebig stapelbar.
export function buyFourthCard(run) {
  if (run.phase !== 'upgrade' || !run.pendingOffers) return false;
  if (run.pendingOffers.length >= 4) return false;
  const cost = run.data.balance.scrap.cost.fourthCard;
  if (run.scrap < cost) return false;
  const avoidTags = new Set(run.pendingOffers.filter((o) => !o.fallback).map((o) => o.tag));
  const avoidIds = new Set(run.pendingOffers.filter((o) => !o.fallback).map((o) => o.id));
  const extra = drawOne(run.upgradesData, poolOpts(run), avoidTags, avoidIds);
  if (extra.fallback) return false; // nichts Sinnvolles mehr -> kein Kauf
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
  const cost = run.data.balance.scrap.cost.shopCard;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  offer.sold = true;
  applyUpgradeChoice(run, offer);
  return true;
}

// Sekundaerwaffe tauschen (setzt Phase 6 voraus). Der Eintrag in
// run.upgrades wird mitgesetzt, damit dieselbe Waffe spaeter nicht noch
// einmal als Karte im Pool auftaucht -- genau wie beim Kartenwechsel.
export function buyShopSecondary(run, id) {
  if (run.phase !== 'workshop') return false;
  if (!run.data.secondaries || !run.data.secondaries[id]) return false;
  if (id === run.equippedSecondary) return false; // schon ausgeruestet
  const cost = run.data.balance.scrap.cost.shopSecondary;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.equippedSecondary = id;
  run.upgrades[id] = Math.max(1, run.upgrades[id] || 0);
  return true;
}

// Leben kaufen: teuer und nur EINMAL pro Shop-Besuch (run.shopLifeBought
// wird beim Betreten des Raums zurueckgesetzt).
export function buyShopLife(run) {
  if (run.phase !== 'workshop' || run.shopLifeBought) return false;
  const cost = run.data.balance.scrap.cost.shopLife;
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.lives++;
  run.shopLifeBought = true;
  return true;
}

// Effekte EINER angenommenen Karte anwenden (Upgrade-Screen wie Shop).
// Bewusst ohne Raumfluss/Kosten -- die Aufrufer entscheiden, was danach
// passiert: chooseUpgrade() zieht weiter, buyShopCard() (Phase 13) bleibt
// im Shop. So gibt es die Sonderfaelle (Sekundärslot, Glaskanone,
// Notschild, Trophäe, Kriegsbeute) nur EINMAL im Code.
function applyUpgradeChoice(run, offer) {
  if (offer.fallback) {
    run.lives++;
  } else {
    run.upgrades[offer.id] = (run.upgrades[offer.id] || 0) + 1;
    // Sekundärslot (Phase 6): eine neue Sekundärkarte ersetzt die aktive
    // Sekundärwaffe -- die alte Karte bleibt in run.upgrades stehen
    // (maxStacks 1 verhindert ein erneutes Ziehen), ist aber nicht mehr aktiv.
    if (offer.tag === 'secondary') run.equippedSecondary = offer.id;
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
  }
  run.upgradeChoices++;
  // Tags weiter zaehlen (Telemetrie + spaeter Phase 17). Die Freischaltung
  // selbst ist nach PLAN.md v2 auf Phase 17 verschoben und hier stillgelegt.
  if (!offer.fallback && offer.tag) {
    run.tagCounts[offer.tag] = (run.tagCounts[offer.tag] || 0) + 1;
  }
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
