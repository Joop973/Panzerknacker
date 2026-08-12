// Codex-Hauptscreen (PLAN-STARTMENU Phase 7): Kategorie-Buttons mit
// Fortschrittsanzeige ("12/48"). Die eigentlichen Listenansichten je
// Kategorie (Panzer/Upgrades/Gegner/Bosse) kommen erst in den Phasen 8-11 --
// diese Phase baut nur die Uebersicht + den Mechanismus dahinter.

import { playerClassEntries, isClassUnlocked, fmtClassStats } from '../game/classes.js';

const LABELS = {
  playerTanks: 'Eigene Panzer',
  upgrades: 'Upgrades',
  enemies: 'Gegner',
  bosses: 'Bosse',
};
const ORDER = ['playerTanks', 'upgrades', 'enemies', 'bosses'];

// codex: das Objekt aus game/codex.js: createCodex(). revealAll: Debug-Flag
// (?debug=1&codexRevealAll) -- zeigt jede Kategorie als vollstaendig
// abgeschlossen, OHNE den echten gespeicherten Zustand zu veraendern (rein
// Darstellung, siehe Plan-Wortlaut: "alle Eintraege als gesehen DARSTELLEN").
// onOpen(category): optionaler Klick-Handler, den Phasen 8-11 an die
// jeweilige Listenansicht haengen -- in Phase 7 bewusst ohne Ziel.
export function renderCodexCategories(doc, container, codex, { revealAll = false, onOpen } = {}) {
  container.innerHTML = '';
  const progress = codex.progress();
  for (const cat of ORDER) {
    const p = progress[cat] || { seen: 0, total: 0 };
    const seen = revealAll ? p.total : p.seen;
    const b = doc.createElement('button');
    b.dataset.category = cat;
    const name = doc.createElement('div');
    name.className = 'codex-cat-name';
    name.textContent = LABELS[cat] || cat;
    const count = doc.createElement('div');
    count.className = 'codex-cat-count';
    count.textContent = `${seen}/${p.total}`;
    b.append(name, count);
    if (onOpen) b.addEventListener('click', () => onOpen(cat));
    container.appendChild(b);
  }
}

export const CODEX_LABELS = LABELS;
export const CODEX_ORDER = ORDER;

// Phase 8: Listenansicht "Eigene Panzer". Drei Zustaende je Eintrag:
//   1. ungesehen       -- nur "???", keine Werte, kein Name preisgegeben.
//   2. gesehen+gesperrt -- Name/Werte sichtbar, aber gedimmt + Schloss
//                          (dasselbe Vokabular wie die Klassenwahl, Phase 2).
//   3. gesehen+frei     -- volle Anzeige.
// Silhouetten-Loesung aus STARTMENU-BESTAND.md: alle zehn Klassen teilen
// dasselbe player-Sprite (SPRITE_ALIAS), eine "eingefaerbte Sprite-Kopie" waere
// also fuer alle zehn identisch. Stattdessen ein generisches Icon, eingefaerbt
// nach dem Schadenstyp der Klasse (data/status.json: damageTypes[...].color) --
// ungesehene Eintraege bleiben neutral grau.
export function renderPlayerTankList(doc, container, tanksData, codex, { revealAll = false, unlockOpts = {} } = {}) {
  container.innerHTML = '';
  for (const [id, def] of playerClassEntries(tanksData)) {
    const seen = revealAll || codex.isSeen('playerTanks', id);
    const unlocked = isClassUnlocked(def, unlockOpts);
    const el = doc.createElement('div');
    el.className = 'codex-entry';
    el.dataset.tank = id;

    const icon = doc.createElement('div');
    icon.className = 'codex-icon';
    if (seen) {
      const dt = def.damageType || 'physical';
      icon.style.background = tanksData.status?.damageTypes?.[dt]?.color || '#8a94a6';
    } else {
      el.classList.add('codex-unseen');
      icon.classList.add('codex-icon-unseen');
    }
    el.appendChild(icon);

    if (!seen) {
      const q = doc.createElement('div');
      q.className = 'codex-entry-name';
      q.textContent = '???';
      el.appendChild(q);
      container.appendChild(el);
      continue;
    }

    if (!unlocked) el.classList.add('codex-locked');
    const name = doc.createElement('div');
    name.className = 'codex-entry-name';
    name.textContent = def.label || id;
    const stats = doc.createElement('div');
    stats.className = 'codex-entry-stats';
    stats.textContent = fmtClassStats(def);
    const desc = doc.createElement('div');
    desc.className = 'codex-entry-desc';
    desc.textContent = def.desc || '';
    const textCol = doc.createElement('div');
    textCol.className = 'codex-entry-text';
    textCol.append(name, stats, desc);
    el.appendChild(textCol);
    container.appendChild(el);
  }
}
