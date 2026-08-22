// Upgrade-Auswahlpool (Phase 2, erweitert in Phase 3 der Schrott-Waehrung,
// in Upgradepool-v2 Phase 3, Synergiegewichtung, und in Nekromant-V2 Phase 1,
// Seltenheitsachse + Stapelregel -- drei verschiedene "Phase 3"/"Phase 1").
//
// Zieht die Angebote fuer den Upgrade-Screen aus data/upgrades.json unter
// Beachtung des Schemas (tag/rarity/isUnique/requires/minRoom/tags[]).
// Regeln:
//  - N Karten (Standard 3), NIE zwei mit demselben Tag -- AUSSER Signatur-
//    karten (signatureClass gesetzt) untereinander, s. dedupeKey() unten.
//  - Seltenheitsgewichte kommen kontextabhaengig aus opts.rarityWeights
//    (Kartenbelohnung/Shop-Ueberarbeitung: rewardRarityWeights()/
//    shopRarityWeights(), je nach runweitem Raumzaehler bzw. Shop-Besuchs-
//    zaehler gestaffelt, s. dort) -- Fallback auf die flache balance.rarity,
//    falls opts.rarityWeights fehlt. Das fruehere balance.rarityGates
//    (Seltenheit erst ab Raum X UEBERHAUPT ziehbar) ist ERSATZLOS ENTFERNT:
//    alle fuenf Stufen sind ab Raum 1 grundsaetzlich moeglich, nur die
//    WAHRSCHEINLICHKEIT staffelt sich.
//  - Nekromant-V2 Phase 1 ("Stapelregel gilt fuer beide Auftraege", STARTHIER.md):
//    `maxStacks` ist ERSATZLOS abgeschafft. Eine nicht-einzigartige Karte
//    (isUnique: false/fehlt) verlaesst den Pool NIE, egal wie oft sie schon
//    gewaehlt wurde -- keine Obergrenze. Eine einzigartige Karte
//    (isUnique: true) ist nach der ersten Wahl fuer den Rest des Runs weg
//    (chosen[id] >= 1 ODER opts.selectedUniqueUpgradeIds, s. u.).
//  - unerfuellte requires / zu frueher Raum -> raus.
//  - Nachschliff ("Blutiger Thron"-Fix): optionales `requiresAnyOf`, eine
//    Liste von ODER-Gruppen -- JEDE Gruppe braucht mindestens eine bereits
//    gewaehlte id (UND ueber Gruppen, ODER innerhalb einer Gruppe). Generisch
//    zusaetzlich zu `requires` (reines UND ueber Einzel-ids), gilt fuer
//    Angebot/Shop/Truhe/Reroll gleichermassen.
//  - Tags `weapon` und `elite` sind hier ausgeschlossen, bis auf die Karten
//    in WEAPON_ALLOWLIST (Phase 18: doppelrohr, flak).
//  - Verbannte ids (Phase 3, Schrott-Aktion) werden uebersprungen.
//  - Reichen die gueltigen Karten nicht fuer N, gibt es sauber WENIGER als N
//    Angebote (Grundsteinumbau Phase 4: kein Fallback-Auffuellen mehr).
//  - Upgradepool-v2 Phase 3: Karten mit passenden tags[] (Synergie-Tags aus
//    Phase 2) werden anhand von opts.synergyTags (run.synergyTags) hoeher
//    gewichtet -- gedeckelt, schliesst nie eine Karte aus, s. makeSynergyWeight().
//
// Determinismus: verbraucht ausschliesslich den uebergebenen rng-Strom
// (run.genRng), damit derselbe Seed denselben Verlauf ergibt. Die Synergie-
// gewichtung UND die isUnique-Umstellung aendern NICHTS an der Anzahl der
// rng()-Aufrufe (weiterhin genau einer je gezogener Karte in weightedPick()).

const EXCLUDED_TAGS = new Set(['weapon', 'elite']);

// Phase 18: der Tag `weapon` bleibt grundsaetzlich ausgeschlossen (jede
// weitere Waffenkarte bekommt ihr eigenes Physikverhalten und wird bewusst
// einzeln freigegeben statt den ganzen Tag zu oeffnen) -- diese beiden
// Karten sind fertig gebaut und duerfen trotzdem erscheinen.
const WEAPON_ALLOWLIST = new Set(['doppelrohr', 'flak']);

// UMBAUPLAN-LP Phase 10: die Seltenheit soll mit dem KONFIGURIERTEN Gewicht
// gezogen werden (balance.rarity: 60/30/10), unabhaengig davon, wie viele
// Karten je Seltenheit gerade ziehbar sind. Die alte Fassung summierte das
// Gewicht PRO KARTE -> P(Stufe) ~ Poolgroesse x Gewicht, also verzerrt, sobald
// eine Seltenheit mehr Karten hat als eine andere (der Bug aus PLAN-UPGRADES).
// Fix: jede Karte bekommt Gewicht `weight[rarity] / (Karten dieser Seltenheit)`
// -> die Summe je Seltenheit ist wieder genau `weight[rarity]`, die Verteilung
// also groessenunabhaengig. Der Plan nennt als Alternative "gleich grosse
// Stufen (10/10/10)"; die Normierung erfuellt dasselbe Ziel auch bei ungleichen
// Poolgroessen (die spaeteren Element-Filter erzeugen zwangslaeufig ungleiche).
// EIN rng()-Aufruf wie bisher -- der RNG-Verbrauch je Zug bleibt unveraendert.
// elementWeight(def) (UMBAUPLAN-LP Phase 17): eine Karte des Zweitelements
// bekommt einen kleineren Faktor (0.5) -- die Normierung erfolgt PRO SELTENHEIT
// ueber die SUMME der Element-Gewichte statt der Kartenzahl, so bleibt die
// Rarity-Verteilung (60/30/10) exakt erhalten und nur INNERHALB einer Stufe
// erscheint das Zweitelement halb so oft. Ohne elementWeight (alle 1) ist die
// Summe gleich der Kartenzahl -> identisch zum Phase-10-Verhalten. Upgradepool-
// v2 Phase 3 (Synergiegewichtung) nutzt denselben Parameter fuer einen mit
// elementWeight MULTIPLIZIERTEN Faktor (s. makeCombinedWeight) -- die
// Tier-Normierung gilt dadurch automatisch auch fuer die Synergie, ohne dass
// diese Funktion selbst etwas von Synergie wissen muss.
export function weightedPick(list, rng, weights, elementWeight = () => 1) {
  const tierSum = {};
  for (const d of list) tierSum[d.rarity] = (tierSum[d.rarity] || 0) + elementWeight(d);
  const w = (d) => (elementWeight(d) * (weights[d.rarity] || 1)) / tierSum[d.rarity];
  let total = 0;
  for (const d of list) total += w(d);
  let r = rng() * total;
  for (const d of list) {
    r -= w(d);
    if (r < 0) return d;
  }
  return list[list.length - 1];
}

// Grundsteinumbau Phase 4: die Element-Gewichtung (Zweitelement,
// UMBAUPLAN-LP Phase 17) ist mit den damageType-Karten aus dem Pool
// entfernt -- ohne eine einzige damageType-Karte im 5-Karten-Sockel waere
// sie wirkungslos gewesen. Details/Wiederanschlusspunkt: ARCHIV.md,
// archive/systeme-v1.md Abschnitt 2.

// Upgradepool-v2 Phase 3: Synergiegewichtung. opts.synergyTags ist die
// laufende Tag-Bilanz der GEWAEHLTEN Karten (run.synergyTags, ueber tags[] --
// die eigenstaendige zweite Achse aus Phase 2, NICHT dasselbe wie
// run.tagCounts/die Hauptkategorie `tag`, die weiterhin nur die
// Transformationen speist). Eine Karte mit passenden tags[] bekommt einen
// Gewichtsbonus, der mit der Anzahl bereits gewaehlter Karten desselben Tags
// waechst -- gedeckelt (balance.upgrades.synergyCap), damit KEINE Karte durch
// Synergie ausgeschlossen wird (der Faktor ist immer >= 1, nie 0). Karten ohne
// tags[] bekommen keinen Bonus (Faktor 1) -- unverändertes Verhalten wie vor
// Phase 3.
function makeSynergyWeight(opts) {
  const tally = opts.synergyTags;
  if (!tally) return () => 1;
  const cap = opts.balance?.upgrades?.synergyCap ?? 2.0;
  const step = opts.balance?.upgrades?.synergyStep ?? 0.5;
  return (d) => {
    if (!d.tags || !d.tags.length) return 1;
    let matches = 0;
    for (const t of d.tags) matches += tally[t] || 0;
    return matches > 0 ? Math.min(cap, 1 + matches * step) : 1;
  };
}

// Grundsteinumbau Phase 4: hiess bis dahin makeCombinedWeight() und
// multiplizierte Element- und Synergiegewicht -- das Elementgewicht ist mit
// dem Zweitelement-System entfallen (s. o.), makeSynergyWeight() bleibt als
// alleiniger Gewichtungsfaktor bestehen. weightedPick() normiert ihn weiter
// pro Seltenheitsstufe (s. Kopfkommentar dort).
function makeCombinedWeight(opts) {
  return makeSynergyWeight(opts);
}

// Kartenbelohnung/Shop-Ueberarbeitung: zwei GETRENNTE, kontextabhaengige
// Seltenheitstabellen ersetzen die bisherige einzelne balance.rarity fuer
// Angebote -- normale Kartenbelohnungen (Kampf/Elite/Verflucht/Ereignis-
// Kartenoption) staffeln sich nach dem runWEITEN Raumzaehler
// (run.totalRoomIndex, s. run.js), das Shop-Regal eigenstaendig nach der
// Anzahl bereits besuchter Shops (run.shopsVisited). Beide Tabellen sind
// sortierte Baender in data/balance.json (rewardRarityBands/shopRarityBands),
// `key` ist 'maxRoom' bzw. 'maxVisit' -- ein Band mit `key: null` ist das
// letzte und gilt ab dort unbegrenzt weiter. weightedPick() selbst bleibt
// UNVERAENDERT: die Tier-Normierung + automatische Umverteilung bei einer an
// einer Stufe komplett fehlenden Karte gelten unabhaengig davon, WELCHE
// Gewichtstabelle hier zurueckkommt.
function pickBand(bands, n, key) {
  for (const band of bands) {
    if (band[key] == null || n <= band[key]) return band.rarity;
  }
  return bands[bands.length - 1].rarity;
}

// Fehlt data/balance.json: rewardRarityBands (z. B. ein synthetisches
// Balance-Objekt in einem Test) -> Fallback auf die flache balance.rarity,
// damit bestehende Aufrufer ohne die neuen Baender unveraendert funktionieren.
export function rewardRarityWeights(balance, totalRoomIndex) {
  const bands = balance.rewardRarityBands;
  if (!bands || !bands.length) return balance.rarity;
  return pickBand(bands, totalRoomIndex ?? 1, 'maxRoom');
}

export function shopRarityWeights(balance, shopsVisited) {
  const bands = balance.shopRarityBands;
  if (!bands || !bands.length) return balance.rarity;
  return pickBand(bands, shopsVisited ?? 1, 'maxVisit');
}

// Champion-/Nekromant-Nachschliff Abschnitt 16: eigene Seltenheitstabelle
// fuer Elite-Belohnungen, dieselbe pickBand()-Mechanik wie rewardRarityWeights
// aber mit deutlich hoeherem episch/legendaer-Anteil (data/balance.json:
// eliteRarityBands). Fehlt das Datenfeld (aeltere/synthetische balance.json),
// faellt der Aufrufer auf die normale rewardRarityWeights()-Tabelle zurueck.
export function eliteRarityWeights(balance, totalRoomIndex) {
  const bands = balance.eliteRarityBands;
  if (!bands || !bands.length) return rewardRarityWeights(balance, totalRoomIndex);
  return pickBand(bands, totalRoomIndex ?? 1, 'maxRoom');
}

function makeOffer(def, chosen) {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    tag: def.tag,
    tags: def.tags || [],
    rarity: def.rarity,
    level: (chosen[def.id] || 0) + 1,
    // Nekromant-V2 Phase 1: maxStacks entfaellt, isUnique geht mit ins Angebot
    // durch -- die UI zeigt bei isUnique keine Stufenzahl (immer 1), sonst
    // nur die Stufe selbst ohne Obergrenze (kein "X/Y", kein "MAX").
    isUnique: !!def.isUnique,
  };
}

// Upgradepool-v2 Phase 2: Dedupe-Schluessel fuer die "kein zweiter Tag im
// selben Angebot"-Regel. Alle 84 Signaturkarten tragen denselben Tag
// 'signature' (Hauptkategorie bleibt unveraendert, s. Kopfkommentar) -- die
// reine Tag-Regel liesse deshalb nie mehr als eine Signaturkarte pro Angebot
// zu, Anhang A Paragraph 19 verlangt aber ausdruecklich mehrere gleichzeitig
// (der `signatureClass`-Filter in buildCandidates() sorgt ohnehin dafuer,
// dass in einem Angebot nur Signaturkarten EINER Klasse vorkommen koennen).
// Signaturkarten dedupen deshalb auf ihre eigene id (blockieren sich also
// nur gegen sich selbst -- was `pool = pool.filter(id !== pick.id)` schon
// separat erledigt), Kernpool-Karten weiterhin auf den Tag.
function dedupeKey(d) {
  return d.signatureClass ? `sig:${d.id}` : d.tag;
}

// Alle aktuell gueltigen Upgrade-Definitionen (ohne Tag-/Slot-Regel).
// Zusatz-Optionen (Phase 4, Elite-/Treasure-Belohnung):
//   includeTag     -- nur dieser Tag (umgeht die EXCLUDED_TAGS, z. B. 'elite')
//   onlyRarity     -- nur diese Seltenheit (z. B. 'legendary' fuer Treasure)
//   bypassRoomGate -- per-Karte minRoom ignorieren (rarityGates gibt es seit
//                     der Kartenbelohnung/Shop-Ueberarbeitung nicht mehr)
// Nekromant-V2 Phase 11: exportiert (vorher modulintern) fuer einen
// erschoepfenden Abnahme-Test (Punkt 4/5: alle 105 Karten direkt gegen den
// Filter statt gegen eine seeds-basierte Stichprobe pruefen) -- reine
// Sichtbarkeitsaenderung, kein Verhaltensunterschied fuer bestehende Aufrufer.
export function buildCandidates(upgradesData, opts) {
  const {
    chosen = {},
    roomIndex = 1,
    balance,
    banned,
    includeTag,
    onlyRarity,
    bypassRoomGate,
    starterTank,
    selectedUniqueUpgradeIds,
  } = opts;
  const bannedSet = banned || new Set();
  const defs = upgradesData.upgrades;
  const candidates = [];
  for (const id in defs) {
    const def = defs[id];
    if (includeTag) {
      if (def.tag !== includeTag) continue; // nur dieser Tag (bypass EXCLUDED)
    } else if (EXCLUDED_TAGS.has(def.tag) && !(def.tag === 'weapon' && WEAPON_ALLOWLIST.has(id))) continue;
    // Grundsteinumbau Phase 4: der Element-Filter (UMBAUPLAN-LP Phase 11,
    // "typgebundene Karten nur bei passendem Klassen-Element") ist mit den
    // damageType-Karten aus dem Pool entfernt -- ARCHIV.md,
    // archive/systeme-v1.md Abschnitt 3. signatureClass (klassengebunden,
    // NICHT elementgebunden) bleibt als Pipeline-Baustein bestehen, s. u.
    // UMBAUPLAN-LP Phase 18 (Signaturtoepfe): eine Karte mit signatureClass
    // gehoert genau EINER Klasse und erscheint nur, wenn diese Klasse gespielt
    // wird. Karten OHNE signatureClass sind universell (unveraendert). Ohne
    // gesetztes starterTank (Elite-/Treasure-Belohnung laeuft ohnehin ueber
    // includeTag/onlyRarity) faellt jede Signaturkarte durch -- so kann eine
    // fremde Klassensignatur nie in einer Belohnung auftauchen.
    if (def.signatureClass && def.signatureClass !== starterTank) continue;
    // Upgradepool-v2 Phase 6, Anhang A §14 ("optional: exclusions"): eine
    // Karte kann fuer bestimmte Klassen komplett gesperrt werden -- anders
    // als signatureClass (gehoert EINER Klasse) ist das eine NEGATIVLISTE
    // (fuer alle ANDEREN Klassen weiter normal ziehbar). Erster Nutzer: die
    // sieben minenspezifischen Karten sind fuer den Nekromanten gesperrt,
    // dessen Bombenslot seit Phase 6 keine Mine mehr ist (Geisterbombe,
    // tank.js: useSecondary()) -- ohne exclusions waeren sie fuer ihn
    // wirkungslose Angebote.
    if (def.exclusions && def.exclusions.includes(starterTank)) continue;
    if (onlyRarity && def.rarity !== onlyRarity) continue;
    if (bannedSet.has(id)) continue;
    // P4: Die frueher noetige generelle Minen-Sperre (MINE_ONLY_IDS) ist
    // entfallen -- die Bombe liegt in einem eigenen, festen Slot und ist bei
    // JEDER anderen Klasse IMMER ausgeruestet. Nur beim Nekromanten (s.
    // exclusions oben) ist das nicht mehr der Fall.
    // Damit loest sich zugleich Konflikt C aus PLAN-INPUT.md: der Tag
    // `control` haengt nicht mehr an der ausgeruesteten Sekundaerwaffe.
    // Nekromant-V2 Phase 1 (Stapelregel, STARTHIER.md "gilt fuer beide
    // Auftraege"): eine NICHT einzigartige Karte hat KEINE Obergrenze mehr --
    // maxStacks ist ersatzlos abgeschafft, `chosen[id]` wird fuer sie gar
    // nicht mehr geprueft. Eine einzigartige Karte (isUnique: true) faellt
    // raus, sobald sie schon gewaehlt wurde: primaer ueber `chosen` (wird bei
    // JEDER Wahl inkrementiert, deckt Angebot/Shop/Truhe/Ereignis/Reroll ab,
    // weil alle durch buildCandidates() laufen), zusaetzlich ueber die
    // eigenstaendige run.selectedUniqueUpgradeIds-Menge (falls uebergeben) --
    // die zweite Pruefung faengt auch bereits vorbereitete Auswahlen ab,
    // deren `chosen`-Zaehler (noch) nicht aktualisiert wurde.
    if (def.isUnique && ((chosen[id] || 0) >= 1 || selectedUniqueUpgradeIds?.has(id))) continue;
    // Kartenbelohnung/Shop-Ueberarbeitung: das fruehere globale rarityGates
    // (Seltenheit selbst erst ab Raum X ZIEHBAR) ist ERSATZLOS ENTFERNT --
    // Seltenheit wird jetzt ausschliesslich ueber Wahrscheinlichkeit
    // gesteuert (rewardRarityWeights()/shopRarityWeights() weiter unten),
    // nie mehr ueber Eligibility. Der per-Karte minRoom-Gate bleibt (echte
    // Kartenvoraussetzung, aktuell bei jeder Karte minRoom:1 -- also ein
    // No-op, kein zusaetzlicher Deckel).
    if (!bypassRoomGate && roomIndex < (def.minRoom || 1)) continue;
    if (def.requires && def.requires.some((req) => (chosen[req] || 0) <= 0)) continue;
    // Nachschliff Abschnitt 7 ("Blutiger Thron kann ohne Nutzen angeboten
    // werden"): generisches UND-von-ODER-Gate, unabhaengig vom einfachen
    // `requires` (das ist reines UND ueber Einzel-ids). `requiresAnyOf` ist
    // eine Liste von Gruppen -- JEDE Gruppe muss mindestens eine bereits
    // gewaehlte id enthalten. Gilt fuer Angebot, Shop, Truhe UND Reroll
    // gleichermassen, weil alle vier Wege durch buildCandidates() laufen.
    if (
      def.requiresAnyOf &&
      def.requiresAnyOf.some((group) => !group.some((req) => (chosen[req] || 0) > 0))
    ) {
      continue;
    }
    candidates.push(def);
  }
  return candidates;
}

// opts: { chosen {id:level}, roomIndex, rng, balance, count, banned:Set,
//         includeTag?, onlyRarity?, bypassRoomGate?, ignoreTagRule? }
export function rollOffers(upgradesData, opts) {
  const { chosen = {}, rng, balance, count, ignoreTagRule } = opts;
  // Kartenbelohnung/Shop-Ueberarbeitung: opts.rarityWeights traegt die
  // kontextabhaengige Gewichtstabelle (rewardRarityWeights()/
  // shopRarityWeights(), aus run.js: poolOpts()/startNonCombatRoom()
  // durchgereicht) -- Fallback auf die flache balance.rarity fuer Aufrufer,
  // die (noch) kein rarityWeights setzen (z. B. aeltere Tests).
  const weights = opts.rarityWeights || balance.rarity;
  const n = count || upgradesData.offersPerScreen || 3;

  const combinedWeight = makeCombinedWeight(opts);
  const offers = [];
  const usedKeys = new Set();
  let pool = buildCandidates(upgradesData, opts).slice();
  while (offers.length < n && pool.length) {
    // Elite-/Treasure-Belohnungen ignorieren die Tag-Regel (alle Karten
    // haben denselben Tag bzw. dieselbe Seltenheit).
    const eligible = ignoreTagRule ? pool : pool.filter((d) => !usedKeys.has(dedupeKey(d)));
    if (!eligible.length) break; // kein neuer Tag/keine neue Signaturkarte mehr moeglich
    const pick = weightedPick(eligible, rng, weights, combinedWeight);
    offers.push(makeOffer(pick, chosen));
    usedKeys.add(dedupeKey(pick));
    pool = pool.filter((d) => d.id !== pick.id);
  }

  // Grundsteinumbau Phase 4: kein Fallback-Karten-Auffuellen mehr -- ist der
  // Pool erschoepft (5-Karten-Sockel, hoechstens 20 Gesamtstufen), gibt es
  // sauber WENIGER als n Angebote statt einer aufgefuellten "+1 Leben"-Karte
  // (ARCHIV.md). Aufrufer muessen ein leeres/kuerzeres Array vertragen --
  // run.js tut das seit dieser Phase (Sicherheitsnetz bei rollReward()).
  return offers;
}

// Zieht EINE zusaetzliche/ersetzende Karte, deren Tag noch nicht in
// avoidTags vorkommt und deren id nicht in avoidIds ist (Phase-3-Aktionen
// "Verbannen" und "Vierte Karte"). Kein Kandidat -> null (Grundsteinumbau
// Phase 4: kein Fallback mehr, s. rollOffers()).
export function drawOne(upgradesData, opts, avoidTags, avoidIds) {
  const { chosen = {}, rng, balance } = opts;
  const weights = opts.rarityWeights || balance.rarity;
  const at = avoidTags || new Set();
  const ai = avoidIds || new Set();
  const eligible = buildCandidates(upgradesData, opts).filter(
    (d) => !at.has(d.tag) && !ai.has(d.id),
  );
  if (!eligible.length) return null;
  return makeOffer(weightedPick(eligible, rng, weights, makeCombinedWeight(opts)), chosen);
}
