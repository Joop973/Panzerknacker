// Telemetrie (Phase 1, Teil A).
//
// Erfasst pro Run einen kompakten Datensatz und legt ihn in
// localStorage unter dem Key `runs` ab (Array, max. 100 Eintraege,
// aelteste fallen raus). Das Modul enthaelt KEINE Spiellogik und wird
// ausschliesslich ueber Funktionsaufrufe an bestehenden Stellen
// (main.js) angebunden. Die Spiellogik liest niemals Telemetriedaten
// zurueck -- der Datenfluss ist strikt einseitig (nur schreiben).
//
// Debug-ANSICHT: nur bei ?debug=1 in der URL. Die AUFZEICHNUNG laeuft
// dagegen immer -- man kann also ohne den Parameter spielen und die Daten
// spaeter mit ?debug=1 ansehen/exportieren.

const KEY = 'runs';
const MAX_RUNS = 100;
// Bei jeder Bedeutungsaenderung der Felder hochzaehlen -- sonst werden
// spaeter Runs verglichen, die gar nicht vergleichbar sind.
const SCHEMA_VERSION = 2;
const GAME_VERSION = 'v108'; // an den sw.js-Cache-Namen gekoppelt halten

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
export function beginRun({ seed, mode, secondary }) {
  let device = null;
  let resolution = null;
  try {
    device = navigator.maxTouchPoints > 0 ? 'touch' : 'desktop';
    resolution = `${window.innerWidth}x${window.innerHeight}`;
  } catch {
    /* egal */
  }
  current = {
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    device,
    resolution,
    secondary: secondary || 'mine',
    seed: seed >>> 0,
    mode: mode || null,
    startedAt: Date.now(),
    rooms: [], // { room, durationS, lives, scrapEarned }
    upgrades: [], // { chosen, rejected: [] }
    scrapSpends: [], // { room, type, amount }
    bans: [], // { room, id }
    doors: [], // { room, chosen, rejected: [] }  (Phase 4)
    eventChoices: [], // { room, event, option }   (Phase 4)
    transformations: [], // { room, id }          (Phase 5)
  };
}

// Einen abgeschlossenen (oder letzten, gescheiterten) Raum festhalten.
export function recordRoom(r) {
  if (!current) return;
  current.rooms.push({
    room: r.room,
    roomType: r.roomType || null,
    durationS: Math.round((r.durationS || 0) * 100) / 100,
    lives: r.lives,
    shieldCharges: r.shieldCharges || 0,
    scrapEarned: r.scrapEarned || 0,
    modifier: r.modifier || null, // Phase 10
    hazard: r.hazard || null, // Phase 15
    enemies: r.enemies || [], // [{type, affix}]
    minFps: r.minFps ?? null,
    ricochetKills: r.ricochetKills || 0,
    directKills: r.directKills || 0,
    // UMBAUPLAN-LP Phase 8: Schaden je Schadenstyp -- ersetzt die
    // ausgemusterten USP-Kennzahlen als das, was das LP-Spiel wirklich misst.
    damageByType: r.damageByType || null,
    ghostKills: r.ghostKills || 0, // Phase 7
    powershotsFired: r.powershotsFired || 0, // Phase 5
    secondaryUses: r.secondaryUses || 0,
    secondary: r.secondary || null, // Phase 6: aktive Sekundärwaffe dieses Raums
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

// Eine Tuerwahl (Phase 4): gewaehlter + abgelehnter Typ pro Raum.
export function recordDoor({ room, chosen, rejected }) {
  if (!current) return;
  current.doors.push({ room, chosen, rejected: rejected || [] });
}

// Eine freigeschaltete Transformation (Phase 5).
export function recordTransformation({ room, id }) {
  if (!current) return;
  current.transformations.push({ room, id });
}

// Eine Event-Entscheidung (Phase 4).
export function recordEvent({ room, event, option }) {
  if (!current) return;
  current.eventChoices.push({ room, event, option });
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
export function endRun({ won, roomReached, deathCause, deathCauseLabel, enemyType, death }) {
  if (!current) return null;
  const entry = {
    schemaVersion: current.schemaVersion,
    gameVersion: current.gameVersion,
    device: current.device,
    resolution: current.resolution,
    secondary: current.secondary,
    seed: current.seed,
    mode: current.mode,
    timestamp: new Date(current.startedAt).toISOString(),
    endedAt: new Date().toISOString(),
    won: !!won,
    roomReached: roomReached ?? null,
    deathCause: won ? null : deathCause || null,
    deathCauseLabel: won ? null : deathCauseLabel || null,
    enemyType: won ? null : enemyType || null,
    // Details des toedlichen Treffers: beantwortet, ob ein ungesehener
    // Querschlaeger getoetet hat oder ein sauberer Gegnerschuss.
    death: won
      ? null
      : {
          cause: deathCause || null,
          bulletOwner: death?.bulletOwner ?? null,
          bulletRicochets: death?.bulletRicochets ?? null,
          bulletDistanceTravelled: death?.bulletDistanceTravelled ?? null,
          enemyType: enemyType || null,
        },
    rooms: current.rooms,
    upgrades: current.upgrades,
    scrapSpends: current.scrapSpends,
    bans: current.bans,
    doors: current.doors,
    eventChoices: current.eventChoices,
    transformations: current.transformations,
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

function fmtDoors(r) {
  return (r.doors || [])
    .map((d) => `R${d.room}:${d.chosen}${d.rejected && d.rejected.length ? `(↯${d.rejected.join('/')})` : ''}`)
    .join('  ·  ') || '–';
}

function fmtTransforms(r) {
  return (r.transformations || []).map((t) => `R${t.room}:${t.id}`).join(', ') || '–';
}

function fmtEvents(r) {
  return (r.eventChoices || []).map((e) => `${e.event}#${e.option}`).join(', ') || '–';
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

// Kennzahlen ueber ALLE Runs -- die Debug-Ansicht rechnet sie selbst aus,
// weil ein JSON-Export am Handy nirgends zu oeffnen ist.
export function computeMetrics(runs) {
  if (!runs.length) return null;
  const n = runs.length;
  const wins = runs.filter((r) => r.won).length;
  const deathRooms = runs.filter((r) => !r.won).map((r) => r.roomReached || 0).sort((a, b) => a - b);
  const median = deathRooms.length
    ? deathRooms[Math.floor(deathRooms.length / 2)]
    : null;
  const causes = {};
  for (const r of runs) if (!r.won && r.deathCause) causes[r.deathCause] = (causes[r.deathCause] || 0) + 1;
  let ric = 0, dir = 0, minFps = Infinity;
  // UMBAUPLAN-LP Phase 8: Schaden je Schadenstyp ueber alle Runs -- die
  // Kennzahl, die das LP-Spiel braucht (welche Schadensart traegt den Run?).
  const DAMAGE_TYPES = ['physical', 'explosive', 'fire', 'frost', 'poison', 'lightning'];
  const dmgByType = Object.fromEntries(DAMAGE_TYPES.map((k) => [k, 0]));
  for (const r of runs) for (const room of r.rooms || []) {
    ric += room.ricochetKills || 0;
    dir += room.directKills || 0;
    if (room.damageByType) for (const k of DAMAGE_TYPES) dmgByType[k] += room.damageByType[k] || 0;
    if (room.minFps != null) minFps = Math.min(minFps, room.minFps);
  }
  // Durchschnitt je Run (der Plan sagt "Schaden je Schadenstyp pro Run").
  const dmgPerRun = Object.fromEntries(DAMAGE_TYPES.map((k) => [k, Math.round(dmgByType[k] / n)]));
  // Angebotene, aber nie gewaehlte Karten (Grundlage fuer Phase 18).
  const offered = {}, chosen = {};
  for (const r of runs) for (const u of r.upgrades || []) {
    if (u.chosen?.id) chosen[u.chosen.id] = (chosen[u.chosen.id] || 0) + 1;
    for (const c of [u.chosen, ...(u.rejected || [])]) if (c?.id) offered[c.id] = (offered[c.id] || 0) + 1;
  }
  const neverChosen = Object.keys(offered).filter((id) => !chosen[id]).sort();
  const mostRejected = Object.entries(offered)
    .map(([id, o]) => [id, o - (chosen[id] || 0)])
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    runs: n, wins, winRate: Math.round((100 * wins) / n),
    medianDeathRoom: median, causes,
    ricochetKills: ric, directKills: dir,
    ricochetShare: ric + dir ? Math.round((100 * ric) / (ric + dir)) : null,
    damagePerRun: dmgPerRun,
    minFps: minFps === Infinity ? null : minFps,
    neverChosen, mostRejected,
  };
}

let debugSummary = null;

function refreshSummary() {
  if (!debugSummary) return;
  const m = computeMetrics(loadRuns());
  if (!m) { debugSummary.textContent = 'Noch keine Runs aufgezeichnet.'; return; }
  const causes = Object.entries(m.causes).map(([k, v]) => `${k} ${v}`).join(' · ') || '–';
  debugSummary.innerHTML =
    `<b>${m.runs} Runs</b> · Siege ${m.wins} (${m.winRate} %) · ` +
    `Median-Todesraum <b>${m.medianDeathRoom ?? '–'}</b> (Ziel 8–14) · ` +
    `Abpraller-Kills ${m.ricochetKills}/${m.ricochetKills + m.directKills}` +
    `${m.ricochetShare != null ? ` (<b>${m.ricochetShare} %</b>)` : ''} · ` +
    `minFps ${m.minFps ?? '–'} (Ziel &ge; 50)<br>` +
    // UMBAUPLAN-LP Phase 8: Schaden je Schadenstyp pro Run -- die Kennzahl des
    // LP-Spiels (traegt der Run auf Feuer, Blitz, physisch …?).
    `<b>Schaden/Typ pro Run</b> ` +
    ['physical', 'explosive', 'fire', 'frost', 'poison', 'lightning']
      .map((k) => `${k} ${m.damagePerRun[k]}`).join(' · ') + `<br>` +
    `Todesursachen: ${causes}<br>` +
    `Nie gewaehlt: ${m.neverChosen.join(', ') || '–'}<br>` +
    `Am haeufigsten abgelehnt: ${m.mostRejected.map(([id, c]) => `${id} (${c})`).join(', ') || '–'}`;
}

function refreshDebugView() {
  refreshSummary();
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
      fmtDoors(r),
      fmtEvents(r),
      fmtTransforms(r),
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
    'position:fixed;left:0;bottom:0;width:100%;overflow:auto;z-index:9999;' +
    'background:rgba(10,10,14,0.94);color:#e8e4d8;font:11px/1.4 monospace;' +
    'border-top:2px solid #4a5a7a;box-shadow:0 -4px 16px rgba(0,0,0,0.6);';

  const bar = document.createElement('div');
  bar.style.cssText =
    'position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:6px 8px;' +
    'background:#1a1e28;border-bottom:1px solid #333;';
  const title = document.createElement('strong');
  // Hinweis, dass die Aufzeichnung NICHT an ?debug=1 haengt -- man kann also
  // ohne den Parameter (und ohne dieses Panel) spielen und die Daten spaeter
  // ansehen. Nur die ANZEIGE haengt am Parameter.
  title.textContent = 'TELEMETRIE';
  title.title = 'Die Aufzeichnung läuft immer, auch ohne ?debug=1 — dieser Parameter blendet nur diese Ansicht ein.';

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
  // Das Panel startet EINGEKLAPPT: aufgeklappt nimmt es fast die halbe
  // Bildschirmhoehe und verdeckt beim Spielen die untere Arenahaelfte.
  // Nur die schmale Leiste bleibt sichtbar, ein Klick zeigt die Daten.
  let collapsed = true;
  const toggleBtn = mkBtn('▲ Daten zeigen', () => {
    collapsed = !collapsed;
    tableWrap.style.display = collapsed ? 'none' : '';
    debugSummary.style.display = collapsed ? 'none' : '';
    toggleBtn.textContent = collapsed ? '▲ Daten zeigen' : '▼ Einklappen';
    panel.style.maxHeight = collapsed ? '' : '45vh';
  });

  bar.append(title, exportBtn, refreshBtn, toggleBtn);

  // Kennzahlen-Zusammenfassung ueber der Tabelle (rechnet selbst).
  debugSummary = document.createElement('div');
  debugSummary.style.cssText =
    'padding:6px 8px;border-bottom:1px solid #333;background:#161a22;line-height:1.6;';

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
    'Türen (gewählt ↯abgelehnt)',
    'Events',
    'Transformationen',
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

  panel.append(bar, debugSummary, tableWrap);
  // Eingeklappt starten (siehe toggleBtn): beim Spielen soll nur die schmale
  // Leiste am unteren Rand stehen, nicht die halbe Arena verdeckt sein.
  tableWrap.style.display = 'none';
  debugSummary.style.display = 'none';
  document.body.appendChild(panel);
  refreshDebugView();
}
