// Upgrade-Auswahlpool (Phase 2).
//
// Zieht die Angebote fuer den Upgrade-Screen aus data/upgrades.json unter
// Beachtung des neuen Schemas (tag/rarity/maxStacks/requires/minRoom).
// Regeln:
//  - N Karten (Standard 3), NIE zwei mit demselben Tag.
//  - Seltenheitsgewichte aus balance.json (rarity.common/rare/legendary).
//  - Legendaries erst ab balance.legendary.minRoom (global).
//  - Erreichte maxStacks / unerfuellte requires / zu frueher Raum -> raus.
//  - Tags `weapon` und `elite` sind hier ausgeschlossen (spaetere Phasen).
//  - Verbannte ids (Phase 3) werden uebersprungen.
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

// opts: { chosen {id:level}, roomIndex, rng, balance, count, banned:Set }
export function rollOffers(upgradesData, opts) {
  const { chosen = {}, roomIndex = 1, rng, balance, count, banned } = opts;
  const weights = balance.rarity;
  const legMinRoom = balance.legendary?.minRoom ?? 0;
  const bannedSet = banned || new Set();
  const n = count || upgradesData.offersPerScreen || 3;

  const defs = upgradesData.upgrades;
  const candidates = [];
  for (const id in defs) {
    const def = defs[id];
    if (EXCLUDED_TAGS.has(def.tag)) continue;
    if (bannedSet.has(id)) continue;
    if ((chosen[id] || 0) >= def.maxStacks) continue;
    if (roomIndex < (def.minRoom || 1)) continue;
    if (def.rarity === 'legendary' && roomIndex < legMinRoom) continue;
    if (def.requires && def.requires.some((req) => (chosen[req] || 0) <= 0)) continue;
    candidates.push(def);
  }

  const offers = [];
  const usedTags = new Set();
  let pool = candidates.slice();
  while (offers.length < n && pool.length) {
    const eligible = pool.filter((d) => !usedTags.has(d.tag));
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
