// Statistik-Persistenz (Spec Abschnitt 8: Meta-Progression).
//
// Nur Statistik und Bestleistungen, keine Gameplay-Boni. Als eigenes
// Modul gekapselt, damit der Mechanismus (localStorage) spaeter
// austauschbar ist. Fehlt localStorage (z. B. Tests), wird still
// im Speicher gearbeitet.

const KEY = 'panzerknacker_stats_v1';
let memory = null;

function store() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStats() {
  const ls = store();
  if (!ls) return memory || {};
  try {
    return JSON.parse(ls.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function save(stats) {
  memory = stats;
  const ls = store();
  if (ls) {
    try {
      ls.setItem(KEY, JSON.stringify(stats));
    } catch {
      /* voll oder gesperrt -> egal */
    }
  }
}

// Einfache benannte Flags (z. B. Tutorial gesehen).
const FLAG_PREFIX = 'panzerknacker_flag_';
const memFlags = {};

export function getFlag(name) {
  const ls = store();
  if (!ls) return !!memFlags[name];
  try {
    return ls.getItem(FLAG_PREFIX + name) === '1';
  } catch {
    return false;
  }
}

export function setFlag(name) {
  memFlags[name] = true;
  const ls = store();
  if (ls) {
    try {
      ls.setItem(FLAG_PREFIX + name, '1');
    } catch {
      /* egal */
    }
  }
}

// Kleine benannte Einstellungen (z. B. Mute), als JSON-Werte.
const PREF_PREFIX = 'panzerknacker_pref_';
const memPrefs = {};

export function getPref(name, fallback = null) {
  const ls = store();
  if (!ls) return name in memPrefs ? memPrefs[name] : fallback;
  try {
    const raw = ls.getItem(PREF_PREFIX + name);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setPref(name, value) {
  memPrefs[name] = value;
  const ls = store();
  if (ls) {
    try {
      ls.setItem(PREF_PREFIX + name, JSON.stringify(value));
    } catch {
      /* egal */
    }
  }
}

export function resetStats() {
  memory = null;
  const ls = store();
  if (ls) {
    try {
      ls.removeItem(KEY);
    } catch {
      /* egal */
    }
  }
}

// Traegt einen beendeten Run ein und gibt die neuen Bestwerte zurueck.
export function recordRun({ won, rooms, kills, timeS, bestCombo }) {
  const s = loadStats();
  s.runs = (s.runs || 0) + 1;
  s.totalKills = (s.totalKills || 0) + kills;
  s.mostRooms = Math.max(s.mostRooms || 0, rooms);
  s.bestCombo = Math.max(s.bestCombo || 0, bestCombo || 0);
  if (won) {
    s.wins = (s.wins || 0) + 1;
    s.fastestWinS = Math.min(s.fastestWinS ?? Infinity, timeS);
  }
  save(s);
  return s;
}
