// Upgrade-Auswahlpool (Phase 2, erweitert in Phase 3).
//
// Zieht die Angebote fuer den Upgrade-Screen aus data/upgrades.json unter
// Beachtung des Schemas (tag/rarity/maxStacks/requires/minRoom).
// Regeln:
//  - N Karten (Standard 3), NIE zwei mit demselben Tag.
//  - Seltenheitsgewichte aus balance.json (rarity.common/rare/legendary).
//  - Legendaries erst ab balance.legendary.minRoom (global).
//  - Erreichte maxStacks / unerfuellte requires / zu frueher Raum -> raus.
//  - Tags `weapon` und `elite` sind hier ausgeschlossen, bis auf die Karten
//    in WEAPON_ALLOWLIST (Phase 18: doppelrohr, flak).
//  - Verbannte ids (Phase 3, Schrott-Aktion) werden uebersprungen.
//  - Reichen die gueltigen Karten nicht fuer N, wird mit stat-Fallback
//    ("+1 Leben") aufgefuellt, statt zu crashen.
//
// Determinismus: verbraucht ausschliesslich den uebergebenen rng-Strom
// (run.genRng), damit derselbe Seed denselben Verlauf ergibt.

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
export function weightedPick(list, rng, weights) {
  const count = {};
  for (const d of list) count[d.rarity] = (count[d.rarity] || 0) + 1;
  const w = (d) => (weights[d.rarity] || 1) / count[d.rarity];
  let total = 0;
  for (const d of list) total += w(d);
  let r = rng() * total;
  for (const d of list) {
    r -= w(d);
    if (r < 0) return d;
  }
  return list[list.length - 1];
}

function makeOffer(def, chosen) {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    tag: def.tag,
    rarity: def.rarity,
    level: (chosen[def.id] || 0) + 1,
    maxStacks: def.maxStacks,
    fallback: false,
  };
}

function fallbackOffer(upgradesData) {
  const f = upgradesData.fallback;
  return {
    id: null,
    name: f.name,
    description: f.description,
    tag: f.tag || 'stat',
    rarity: f.rarity || 'common',
    level: 0,
    maxStacks: 0,
    fallback: true,
  };
}

// Alle aktuell gueltigen Upgrade-Definitionen (ohne Tag-/Slot-Regel).
// Zusatz-Optionen (Phase 4, Elite-/Treasure-Belohnung):
//   includeTag     -- nur dieser Tag (umgeht die EXCLUDED_TAGS, z. B. 'elite')
//   onlyRarity     -- nur diese Seltenheit (z. B. 'legendary' fuer Treasure)
//   bypassRoomGate -- minRoom + legendary.minRoom ignorieren
function buildCandidates(upgradesData, opts) {
  const { chosen = {}, roomIndex = 1, balance, banned, includeTag, onlyRarity, bypassRoomGate } = opts;
  const legMinRoom = balance.legendary?.minRoom ?? 0;
  const bannedSet = banned || new Set();
  const defs = upgradesData.upgrades;
  const candidates = [];
  for (const id in defs) {
    const def = defs[id];
    if (includeTag) {
      if (def.tag !== includeTag) continue; // nur dieser Tag (bypass EXCLUDED)
    } else if (EXCLUDED_TAGS.has(def.tag) && !(def.tag === 'weapon' && WEAPON_ALLOWLIST.has(id))) continue;
    if (onlyRarity && def.rarity !== onlyRarity) continue;
    if (bannedSet.has(id)) continue;
    // P4: Die frueher noetige Minen-Sperre (MINE_ONLY_IDS) ist entfallen.
    // Die Bombe liegt jetzt in einem eigenen, festen Slot und ist IMMER
    // ausgeruestet -- die sieben minenspezifischen Karten (kettenglied,
    // sprengkraft, fernzuender, schockwelle, annaeherungsmine, klebemine,
    // streumine) koennen deshalb nie mehr wirkungslos werden.
    // Damit loest sich zugleich Konflikt C aus PLAN-INPUT.md: der Tag
    // `control` haengt nicht mehr an der ausgeruesteten Sekundaerwaffe.
    if ((chosen[id] || 0) >= def.maxStacks) continue;
    if (!bypassRoomGate) {
      if (roomIndex < (def.minRoom || 1)) continue;
      if (def.rarity === 'legendary' && roomIndex < legMinRoom) continue;
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

  const offers = [];
  const usedTags = new Set();
  let pool = buildCandidates(upgradesData, opts).slice();
  while (offers.length < n && pool.length) {
    // Elite-/Treasure-Belohnungen ignorieren die Tag-Regel (alle Karten
    // haben denselben Tag bzw. dieselbe Seltenheit).
    const eligible = ignoreTagRule ? pool : pool.filter((d) => !usedTags.has(d.tag));
    if (!eligible.length) break; // kein neuer Tag mehr moeglich
    const pick = weightedPick(eligible, rng, weights);
    offers.push(makeOffer(pick, chosen));
    usedTags.add(pick.tag);
    pool = pool.filter((d) => d.id !== pick.id);
  }

  // Auffuellen (Crash-Schutz). Der stat-Fallback ist die dokumentierte
  // Ausnahme von der Tag-Regel -- nur wenn echte Karten fehlen.
  while (offers.length < n) offers.push(fallbackOffer(upgradesData));
  return offers;
}

// Zieht EINE zusaetzliche/ersetzende Karte, deren Tag noch nicht in
// avoidTags vorkommt und deren id nicht in avoidIds ist (Phase-3-Aktionen
// "Verbannen" und "Vierte Karte"). Kein Kandidat -> stat-Fallback.
export function drawOne(upgradesData, opts, avoidTags, avoidIds) {
  const { chosen = {}, rng, balance } = opts;
  const weights = balance.rarity;
  const at = avoidTags || new Set();
  const ai = avoidIds || new Set();
  const eligible = buildCandidates(upgradesData, opts).filter(
    (d) => !at.has(d.tag) && !ai.has(d.id),
  );
  if (!eligible.length) return fallbackOffer(upgradesData);
  return makeOffer(weightedPick(eligible, rng, weights), chosen);
}
