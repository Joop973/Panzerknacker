// Upgrade-Auswahlpool (Phase 2, erweitert in Phase 3).
//
// Zieht die Angebote fuer den Upgrade-Screen aus data/upgrades.json unter
// Beachtung des Schemas (tag/rarity/maxStacks/requires/minRoom).
// Regeln:
//  - N Karten (Standard 3), NIE zwei mit demselben Tag.
//  - Seltenheitsgewichte aus balance.json (rarity.common/rare/legendary).
//  - Legendaries erst ab balance.legendary.minRoom (global).
//  - Erreichte maxStacks / unerfuellte requires / zu frueher Raum -> raus.
//  - Tags `weapon` und `elite` sind hier ausgeschlossen (spaetere Phasen).
//  - Verbannte ids (Phase 3, Schrott-Aktion) werden uebersprungen.
//  - Reichen die gueltigen Karten nicht fuer N, wird mit stat-Fallback
//    ("+1 Leben") aufgefuellt, statt zu crashen.
//
// Determinismus: verbraucht ausschliesslich den uebergebenen rng-Strom
// (run.genRng), damit derselbe Seed denselben Verlauf ergibt.

const EXCLUDED_TAGS = new Set(['weapon', 'elite']);

function weightedPick(list, rng, weights) {
  let total = 0;
  for (const d of list) total += weights[d.rarity] || 1;
  let r = rng() * total;
  for (const d of list) {
    r -= weights[d.rarity] || 1;
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
    } else if (EXCLUDED_TAGS.has(def.tag)) continue;
    if (onlyRarity && def.rarity !== onlyRarity) continue;
    if (bannedSet.has(id)) continue;
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
