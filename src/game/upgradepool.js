// Upgrade-Auswahlpool (Phase 2, erweitert in Phase 3 der Schrott-Waehrung UND
// in Upgradepool-v2 Phase 3, Synergiegewichtung -- zwei verschiedene "Phase 3").
//
// Zieht die Angebote fuer den Upgrade-Screen aus data/upgrades.json unter
// Beachtung des Schemas (tag/rarity/maxStacks/requires/minRoom/tags[]).
// Regeln:
//  - N Karten (Standard 3), NIE zwei mit demselben Tag -- AUSSER Signatur-
//    karten (signatureClass gesetzt) untereinander, s. dedupeKey() unten.
//  - Seltenheitsgewichte aus balance.json (rarity.common/rare/epic/unique/
//    legendary, Upgradepool-v2 Phase 1: fuenf statt drei Stufen).
//  - epic/unique/legendary zusaetzlich erst ab balance.rarityGates[stufe]
//    .minRoom (global, ersetzt das fruehere legendary.minRoom).
//  - Erreichte maxStacks / unerfuellte requires / zu frueher Raum -> raus.
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
// gewichtung aendert NICHTS an der Anzahl der rng()-Aufrufe (weiterhin genau
// einer je gezogener Karte in weightedPick()).

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

function makeOffer(def, chosen) {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    tag: def.tag,
    tags: def.tags || [],
    rarity: def.rarity,
    level: (chosen[def.id] || 0) + 1,
    maxStacks: def.maxStacks,
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
//   bypassRoomGate -- minRoom + rarityGates ignorieren
function buildCandidates(upgradesData, opts) {
  const { chosen = {}, roomIndex = 1, balance, banned, includeTag, onlyRarity, bypassRoomGate, starterTank } = opts;
  // Upgradepool-v2 Phase 1: generischer Ersatz fuer das fruehere einzelne
  // legendary.minRoom -- jede Stufe in rarityGates bekommt ihr eigenes
  // globales Mindestraum-Gate (common/rare haben keinen Eintrag -> kein Gate).
  const rarityGates = balance.rarityGates || {};
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
    if ((chosen[id] || 0) >= def.maxStacks) continue;
    if (!bypassRoomGate) {
      if (roomIndex < (def.minRoom || 1)) continue;
      const gate = rarityGates[def.rarity]?.minRoom;
      if (gate && roomIndex < gate) continue;
    }
    if (def.requires && def.requires.some((req) => (chosen[req] || 0) <= 0)) continue;
    candidates.push(def);
  }
  return candidates;
}

// opts: { chosen {id:level}, roomIndex, rng, balance, count, banned:Set,
//         includeTag?, onlyRarity?, bypassRoomGate?, ignoreTagRule? }
export function rollOffers(upgradesData, opts) {
  const { chosen = {}, rng, balance, count, ignoreTagRule } = opts;
  const weights = balance.rarity;
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
  const weights = balance.rarity;
  const at = avoidTags || new Set();
  const ai = avoidIds || new Set();
  const eligible = buildCandidates(upgradesData, opts).filter(
    (d) => !at.has(d.tag) && !ai.has(d.id),
  );
  if (!eligible.length) return null;
  return makeOffer(weightedPick(eligible, rng, weights, makeCombinedWeight(opts)), chosen);
}
