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

// Die vier Kategorie-ID-Listen kommen aus den echten Daten, nicht aus einer
// gepflegten Liste -- sonst laeuft der Codex bei der naechsten Balancerunde
// (neue Karte/neuer Gegner) lautlos aus dem Ruder.
export function categoryIds(tanksData, upgradesData) {
  const types = tanksData?.types || {};
  const playerTanks = Object.keys(types).filter((id) => types[id]?.player);
  const enemies = Object.keys(types).filter((id) => !types[id]?.player && !isBossType(types[id]));
  const bosses = Object.keys(types).filter((id) => isBossType(types[id]));
  const upgrades = Object.keys(upgradesData?.upgrades || {});
  return { playerTanks, upgrades, enemies, bosses };
}

export function createCodex({ tanksData, upgradesData, loadRaw, saveRaw }) {
  let state = migrateCodex(loadRaw());
  let dirty = false;
  const ids = categoryIds(tanksData, upgradesData);

  return {
    markSeen(category, id) {
      if (!state.seen[category]) return;
      if (state.seen[category][id]) return; // schon gesehen -> kein Write noetig
      state.seen[category][id] = true;
      dirty = true;
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
