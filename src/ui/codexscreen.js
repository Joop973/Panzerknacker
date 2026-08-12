// Codex-Hauptscreen (PLAN-STARTMENU Phase 7): Kategorie-Buttons mit
// Fortschrittsanzeige ("12/48"). Die eigentlichen Listenansichten je
// Kategorie (Panzer/Upgrades/Gegner/Bosse) kommen erst in den Phasen 8-11 --
// diese Phase baut nur die Uebersicht + den Mechanismus dahinter.

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
