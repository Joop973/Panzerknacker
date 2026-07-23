// Telemetrie (Phase 1, Teil A).
//
// Erfasst pro Run einen kompakten Datensatz und legt ihn in
// localStorage unter dem Key `runs` ab (Array, max. 100 Eintraege,
// aelteste fallen raus). Das Modul enthaelt KEINE Spiellogik und wird
// ausschliesslich ueber Funktionsaufrufe an bestehenden Stellen
// (main.js) angebunden. Die Spiellogik liest niemals Telemetriedaten
// zurueck -- der Datenfluss ist strikt einseitig (nur schreiben).
//
// Debug-Ansicht: nur bei ?debug=1 in der URL. Ohne diesen Parameter
// ist nichts davon sichtbar oder aktiv.

const KEY = 'runs';
const MAX_RUNS = 100;

let current = null; // Sammelpuffer des laufenden Runs (null = keiner aktiv)

function store() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Alle gespeicherten Runs laden (aeltester zuerst).
export function loadRuns() {
  const ls = store();
  if (!ls) return [];
  try {
    const arr = JSON.parse(ls.getItem(KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist(runs) {
  const ls = store();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify(runs));
  } catch {
    /* voll oder gesperrt -> egal, Telemetrie ist unkritisch */
  }
}

// Neuen Run beginnen. Verwirft einen evtl. nicht beendeten Vorlauf
// (abgebrochene Runs werden nicht gespeichert).
export function beginRun({ seed, mode }) {
  current = {
    seed: seed >>> 0,
    mode: mode || null,
    startedAt: Date.now(),
    rooms: [], // { room, durationS, lives, scrapEarned }
    upgrades: [], // { chosen, rejected: [] }
    scrapSpends: [], // { room, type, amount }
    bans: [], // { room, id }
  };
}

// Einen abgeschlossenen (oder letzten, gescheiterten) Raum festhalten.
export function recordRoom({ room, durationS, lives, scrapEarned }) {
  if (!current) return;
  current.rooms.push({
    room,
    durationS: Math.round((durationS || 0) * 100) / 100,
    lives,
    scrapEarned: scrapEarned || 0,
  });
}

// Eine Schrott-Ausgabe im Upgrade-Screen (Typ + Raumnummer).
export function recordScrapSpend({ room, type, amount }) {
  if (!current) return;
  current.scrapSpends.push({ room, type, amount });
}

// Eine im Run verbannte Upgrade-id (mit Raumnummer).
export function recordBan({ room, id }) {
  if (!current) return;
  current.bans.push({ room, id });
}

// Eine Upgrade-Wahl festhalten (gewaehlt + abgelehnte Alternativen).
// chosen und jedes Element von rejected sind Karten-Objekte
// { id, name, tag, rarity } (Phase 2: mit id + tag).
export function recordUpgrade({ chosen, rejected }) {
  if (!current) return;
  current.upgrades.push({
    chosen: chosen || null,
    rejected: rejected || [],
  });
}

// Run beenden: Datensatz zusammenbauen, anhaengen, deckeln, speichern.
// deathCause ist einer von: enemy_bullet, own_bullet, own_mine,
// enemy_mine (oder null bei Sieg).
export function endRun({ won, roomReached, deathCause, deathCauseLabel, enemyType }) {
  if (!current) return null;
  const entry = {
    seed: current.seed,
    mode: current.mode,
    timestamp: new Date(current.startedAt).toISOString(),
    endedAt: new Date().toISOString(),
    won: !!won,
    roomReached: roomReached ?? null,
    deathCause: won ? null : deathCause || null,
    deathCauseLabel: won ? null : deathCauseLabel || null,
    enemyType: won ? null : enemyType || null,
    rooms: current.rooms,
    upgrades: current.upgrades,
    scrapSpends: current.scrapSpends,
    bans: current.bans,
  };
  const runs = loadRuns();
  runs.push(entry);
  while (runs.length > MAX_RUNS) runs.shift();
  persist(runs);
  current = null;
  refreshDebugView();
  return entry;
}

// ---- Debug-Ansicht (nur bei ?debug=1) ----------------------------------

export function isDebugEnabled() {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

let debugBody = null; // <tbody> der Debug-Tabelle (null = nicht montiert)

function fmtRooms(rooms) {
  return rooms
    .map((r) => `R${r.room}: ${r.durationS}s / ${r.lives}❤ / +${r.scrapEarned || 0}⚙`)
    .join('  ·  ');
}

function fmtScrap(r) {
  const earned = (r.rooms || []).reduce((s, x) => s + (x.scrapEarned || 0), 0);
  const spends = r.scrapSpends || [];
  const spent = spends.reduce((s, x) => s + (x.amount || 0), 0);
  const byType = {};
  for (const s of spends) byType[s.type] = (byType[s.type] || 0) + 1;
  const detail = Object.entries(byType).map(([t, n]) => `${t}×${n}`).join(', ');
  return `+${earned} / -${spent}${detail ? ` (${detail})` : ''}`;
}

function fmtBans(r) {
  return (r.bans || []).map((b) => b.id).join(', ') || '–';
}

function fmtCard(c) {
  if (!c) return '?';
  if (c.id) return `${c.id}[${c.tag}]`;
  return c.name || '+1 Leben';
}

function fmtUpgrades(ups) {
  return ups
    .map((u) => {
      const chosen = fmtCard(u.chosen);
      const rej = (u.rejected || []).map(fmtCard).join(', ');
      return rej ? `${chosen} (statt ${rej})` : chosen;
    })
    .join('  →  ');
}

function refreshDebugView() {
  if (!debugBody) return;
  const runs = loadRuns().slice().reverse(); // neueste zuerst
  debugBody.innerHTML = '';
  for (const r of runs) {
    const tr = document.createElement('tr');
    const cells = [
      new Date(r.timestamp).toLocaleString('de-DE'),
      String(r.seed),
      r.mode || '–',
      r.won ? '🏆 Sieg' : '💀 Tod',
      String(r.roomReached ?? '–'),
      r.won ? '–' : r.deathCause || '–',
      r.won ? '–' : r.enemyType || '–',
      fmtUpgrades(r.upgrades),
      fmtScrap(r),
      fmtBans(r),
      fmtRooms(r.rooms),
    ];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      td.style.cssText = 'border:1px solid #333;padding:3px 6px;vertical-align:top;';
      tr.appendChild(td);
    }
    debugBody.appendChild(tr);
  }
}

function exportJson() {
  const data = JSON.stringify(loadRuns(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'panzerknacker-runs.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Baut das Debug-Overlay (Tabelle + Export-Button). Tut nichts, wenn
// ?debug=1 fehlt.
export function mountDebugView() {
  if (!isDebugEnabled() || typeof document === 'undefined') return;

  const panel = document.createElement('div');
  panel.id = 'telemetryDebug';
  panel.style.cssText =
    'position:fixed;left:0;bottom:0;max-height:45vh;width:100%;overflow:auto;z-index:9999;' +
    'background:rgba(10,10,14,0.94);color:#e8e4d8;font:11px/1.4 monospace;' +
    'border-top:2px solid #4a5a7a;box-shadow:0 -4px 16px rgba(0,0,0,0.6);';

  const bar = document.createElement('div');
  bar.style.cssText =
    'position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:6px 8px;' +
    'background:#1a1e28;border-bottom:1px solid #333;';
  const title = document.createElement('strong');
  title.textContent = 'TELEMETRIE (?debug=1)';

  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText =
      'font:11px monospace;padding:3px 8px;background:#2a3a5a;color:#fff;border:0;' +
      'border-radius:4px;cursor:pointer;';
    b.addEventListener('click', fn);
    return b;
  };
  const exportBtn = mkBtn('Als JSON exportieren', exportJson);
  const refreshBtn = mkBtn('Aktualisieren', refreshDebugView);
  const toggleBtn = mkBtn('Ein-/Ausklappen', () => {
    tableWrap.style.display = tableWrap.style.display === 'none' ? '' : 'none';
  });

  bar.append(title, exportBtn, refreshBtn, toggleBtn);

  const tableWrap = document.createElement('div');
  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;width:100%;';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const cols = [
    'Zeit',
    'Seed',
    'Modus',
    'Ergebnis',
    'Raum',
    'Todesursache',
    'Gegnertyp',
    'Upgrades (gewählt / abgelehnt)',
    'Schrott (verd. / ausg.)',
    'Verbannt',
    'Räume (Dauer / Leben / Schrott)',
  ];
  for (const c of cols) {
    const th = document.createElement('th');
    th.textContent = c;
    th.style.cssText =
      'border:1px solid #333;padding:4px 6px;background:#222a38;text-align:left;position:sticky;top:0;';
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  debugBody = document.createElement('tbody');
  table.append(thead, debugBody);
  tableWrap.appendChild(table);

  panel.append(bar, tableWrap);
  document.body.appendChild(panel);
  refreshDebugView();
}
