// Spielbare Panzerklassen (PLAN-STARTMENU Phase 2).
//
// Die Klassen liegen in data/tanks.json (types mit `player: true`) -- es gibt
// KEIN eigenes data/tank-classes.json (siehe STARTMENU-BESTAND.md). Dieses
// Modul buendelt die drei Dinge, die Klassenwahl (main.js) und spaeter der
// Codex (Phase 8) gemeinsam brauchen: die Klassenliste, die Freischalt-Regel
// und die (testbare) Erzeugung eines Klassen-Knopfs.

export function playerClassEntries(data) {
  return Object.entries(data.types || {}).filter(([, t]) => t && t.player);
}

// Eine Klasse ist WAEHLBAR, wenn sie freigeschaltet ist. `unlocked` steht
// statisch in den Klassendaten (Testphase: alle true); der Debug-Schalter
// unlockAll (?debug=1&unlockAll) hebt die Sperre pauschal auf. Fehlt das Feld
// ganz, gilt die Klasse als frei -- Rueckwaertskompatibilitaet mit Alt-Daten
// und mit der Standard-Klasse (`player`), die nie gesperrt sein darf.
export function isClassUnlocked(def, { unlockAll = false } = {}) {
  return !!(unlockAll || !def || def.unlocked !== false);
}

// Erzeugt einen Klassen-Knopf (Name/Werte/Beschreibung). Bewusst hier statt
// inline in main.js, damit die drei Zustaende (gewaehlt / frei / gesperrt)
// headless mit einem Fake-DOM pruefbar sind. Ein gesperrter Knopf ist
// `disabled` (die Fokus-Navigation ueberspringt ihn) und traegt `.locked`
// fuer die Optik -- sichtbar, aber nicht waehlbar (Phase-2-Testschritt 5).
export function createClassButton(doc, id, def, opts = {}) {
  const { selected = false, unlocked = true, fmtStats = null } = opts;
  const b = doc.createElement('button');
  b.dataset.class = id;
  if (selected) b.classList.add('active');
  if (!unlocked) {
    b.classList.add('locked');
    b.disabled = true;
  }
  const name = doc.createElement('div');
  name.className = 'cl-name';
  name.textContent = def.label || id;
  const stats = doc.createElement('div');
  stats.className = 'cl-stats';
  stats.textContent = fmtStats ? fmtStats(def) : '';
  const desc = doc.createElement('div');
  desc.className = 'cl-desc';
  desc.textContent = def.desc || '';
  b.append(name, stats, desc);
  return b;
}
