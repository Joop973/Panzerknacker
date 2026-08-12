// Codex-Datenstruktur (PLAN-STARTMENU Phase 7).
//
// Merkt, welche Codex-Eintraege der Spieler schon "gesehen" hat -- vier
// Kategorien (Entscheidung aus STARTMENU-BESTAND.md/Nutzer: Eliten sind
// Laufzeit-Affixe auf normalen Gegnertypen, KEINE eigene Kategorie).
//
// Gebuendeltes Schreiben (Plan-Vorgabe, Frame-Drops vermeiden): markSeen()
// setzt nur den In-Memory-Zustand. Erst flush() -- vom Aufrufer bei
// Raumwechsel und Run-Ende gerufen -- schreibt tatsaechlich, und auch nur,
// wenn seit dem letzten Flush wirklich etwas markiert wurde.
//
// Diese Phase legt NUR den Mechanismus an -- echte markSeen()-Aufrufstellen
// (Klassenwahl, Upgrade-Erhalt, Gegner-/Boss-Erstkontakt) kommen in den
// Phasen 8-11.

export const CODEX_VERSION = 1;

const CATEGORIES = ['playerTanks', 'upgrades', 'enemies', 'bosses'];

function emptySeen() {
  return { playerTanks: {}, upgrades: {}, enemies: {}, bosses: {} };
}

// Migrationsfunktion: fehlende Felder werden mit Defaults aufgefuellt statt
// den Save zu verwerfen (Plan-Vorgabe). `raw` ist der rohe geladene Wert --
// kann null/undefined (kein Codex bisher), unvollstaendig oder aus einer
// aelteren Version sein. Ein einzelner kaputter Kategorie-Eintrag darf die
// anderen drei nicht mitreissen.
export function migrateCodex(raw) {
  const seen = emptySeen();
  if (raw && typeof raw === 'object' && raw.seen && typeof raw.seen === 'object') {
    for (const cat of CATEGORIES) {
      const src = raw.seen[cat];
      if (!src || typeof src !== 'object') continue;
      for (const [id, v] of Object.entries(src)) {
        if (v) seen[cat][id] = true;
      }
    }
  }
  return { version: CODEX_VERSION, seen };
}

// Boss-Typen ueber dieselben drei Schalter wie cfg.js: isBossCfg() (Phase 14),
// hier auf den ROHEN Typdaten (vor resolveCfg) -- die Felder stehen direkt in
// data/tanks.json (t_reactor: bossInvincible, t_mirror: mirrorBoss,
// t_phalanx: phalanx).
function isBossType(t) {
  return !!(t?.bossInvincible || t?.mirrorBoss || t?.phalanx);
}

// Phase 10: Elite ist ein reiner LAUFZEIT-Affix auf einem normalen
// Gegnertyp -- es gibt keine eigene "t_grey_elite"-id in data/tanks.json
// (STARTMENU-BESTAND.md). Der Plan verlangt trotzdem "Elite-Varianten sind
// eigene Eintraege" (Testschritt 3). Geloest ueber einen zweiten,
// SYNTHETISCHEN Codex-Schluessel je Basistyp (`t_grey::elite`) statt
// zusaetzlicher echter Typdaten -- `::` kollidiert nie mit einer echten id
// (die nutzen nur `a-z0-9_`).
const ELITE_SUFFIX = '::elite';
export function eliteKey(baseId) {
  return baseId + ELITE_SUFFIX;
}
export function isEliteKey(key) {
  return key.endsWith(ELITE_SUFFIX);
}
export function baseIdOf(key) {
  return isEliteKey(key) ? key.slice(0, -ELITE_SUFFIX.length) : key;
}

// Die vier Kategorie-ID-Listen kommen aus den echten Daten, nicht aus einer
// gepflegten Liste -- sonst laeuft der Codex bei der naechsten Balancerunde
// (neue Karte/neuer Gegner) lautlos aus dem Ruder.
export function categoryIds(tanksData, upgradesData) {
  const types = tanksData?.types || {};
  const playerTanks = Object.keys(types).filter((id) => types[id]?.player);
  const enemyBaseIds = Object.keys(types).filter((id) => !types[id]?.player && !isBossType(types[id]));
  const enemies = enemyBaseIds.flatMap((id) => [id, eliteKey(id)]);
  const bosses = Object.keys(types).filter((id) => isBossType(types[id]));
  const upgrades = Object.keys(upgradesData?.upgrades || {});
  return { playerTanks, upgrades, enemies, bosses };
}

export function createCodex({ tanksData, upgradesData, loadRaw, saveRaw }) {
  let state = migrateCodex(loadRaw());
  let dirty = false;
  const ids = categoryIds(tanksData, upgradesData);

  return {
    // Gibt zurueck, ob DIESER Aufruf den Eintrag neu markiert hat (true) oder
    // er schon vorher gesehen war (false) -- Phase 13 (Notification-System)
    // braucht genau dieses Signal, um einen Toast nur beim ECHTEN Erstkontakt
    // auszuloesen, nicht bei jedem erneuten markSeen() (z. B. jeden Tick fuer
    // denselben Gegner).
    markSeen(category, id) {
      if (!state.seen[category]) return false;
      if (state.seen[category][id]) return false; // schon gesehen -> kein Write noetig
      state.seen[category][id] = true;
      dirty = true;
      return true;
    },
    isSeen(category, id) {
      return !!state.seen[category]?.[id];
    },
    // Bei Raumwechsel + Run-Ende aufrufen (main.js). Schreibt NUR, wenn seit
    // dem letzten Flush tatsaechlich etwas markiert wurde -- gibt zurueck,
    // ob wirklich geschrieben wurde (fuer Tests/Debug).
    flush() {
      if (!dirty) return false;
      saveRaw(state);
      dirty = false;
      return true;
    },
    isDirty() {
      return dirty;
    },
    // Fuer den Codex-Hauptscreen: {category: {seen, total}}.
    progress() {
      const out = {};
      for (const cat of CATEGORIES) {
        const list = ids[cat] || [];
        const seenCount = list.filter((id) => state.seen[cat]?.[id]).length;
        out[cat] = { seen: seenCount, total: list.length };
      }
      return out;
    },
    categoryIds: ids,
  };
}

export const CODEX_CATEGORIES = CATEGORIES;

// Phase 10: markSeen bei ERSTEM KONTAKT, nicht erst bei Kill. Reine Funktion
// statt Inline-Code in main.js -- damit ist der eigentliche Mechanismus
// (welcher Gegner bekommt welchen Schluessel) mit EIGENEN Tank-Objekten
// testbar, ohne main.js anzufassen. `tanks` ist eine Liste einfacher
// {type, affixes}-Objekte (main.js: teleEnemies, ohnehin schon pro Tick
// abgetastet -- "auch wenn der Spieler stirbt", weil der erste simulierte
// Tick des Raums schon reicht). Boss-Typen fallen automatisch durch den
// categoryIds.enemies-Filter (die enthaelt nur echte generische Typen +
// deren Elite-Schluessel, keine Bosse).
// Gibt die Liste der Schluessel zurueck, die DIESER Aufruf neu markiert hat
// (Phase 13: main.js loest darauf einen Toast aus, ohne den Mechanismus
// selbst zu kennen -- pro-Tick-Aufrufe fuer laengst bekannte Gegner liefern
// ein leeres Array).
export function markVisibleEnemies(codex, tanks) {
  const newly = [];
  for (const t of tanks || []) {
    const type = t?.type;
    if (!type || !codex.categoryIds.enemies.includes(type)) continue;
    const key = t.affixes && t.affixes.length > 0 ? eliteKey(type) : type;
    if (codex.markSeen('enemies', key)) newly.push(key);
  }
  return newly;
}

// Phase 11: markSeen bei Boss-SPAWN -- Bosse bekommen nie Elite-Affixe
// (rollEliteAffixes laeuft nur fuer Kampf-/Eliteraeume ueber buyEnemies(),
// der Bossraum ist eine feste Arena mit deterministisch gewuerfeltem
// Typ, run.js), deshalb keine eliteKey-Verzweigung noetig -- einfacher als
// markVisibleEnemies. "Spawn" und "erster simulierter Tick" fallen in
// diesem Code strukturell zusammen (createState() erzeugt den Boss-Tank
// synchron), also dieselbe Wiederverwendung der Pro-Tick-Abtastung. Gibt
// wie markVisibleEnemies die neu markierten ids zurueck (Phase 13).
export function markVisibleBosses(codex, tanks) {
  const newly = [];
  for (const t of tanks || []) {
    const type = t?.type;
    if (!type || !codex.categoryIds.bosses.includes(type)) continue;
    if (codex.markSeen('bosses', type)) newly.push(type);
  }
  return newly;
}
