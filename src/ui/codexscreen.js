// Codex-Hauptscreen (PLAN-STARTMENU Phase 7): Kategorie-Buttons mit
// Fortschrittsanzeige ("12/48"). Die eigentlichen Listenansichten je
// Kategorie (Panzer/Upgrades/Gegner/Bosse) kommen erst in den Phasen 8-11 --
// diese Phase baut nur die Uebersicht + den Mechanismus dahinter.

import { playerClassEntries, isClassUnlocked, fmtClassStats } from '../game/classes.js';
import { isEliteKey, baseIdOf } from '../game/codex.js';

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

// Phase 9: Listenansicht "Upgrades". Jede der 246 ids ist ein eigener
// Codex-Eintrag -- Element-Karten (Feuer/Frost/...) haben laut
// STARTMENU-BESTAND.md schon eigene ids statt einer Basis+Variante-
// Aufspaltung, also keine Sonderbehandlung noetig. Die Eintraege sind
// Knoepfe (nicht nur Divs wie bei "Eigene Panzer") -- bei 246 Stueck
// braucht die Tastatur-/Gamepad-Navigation echte Fokusziele, damit
// menunav.js sie ueberhaupt anlaufen und ins Bild scrollen kann
// (Testschritt 5).
const RARITY_LABELS = { common: 'Gewöhnlich', rare: 'Selten', legendary: 'Legendär' };

export function renderUpgradeList(doc, container, upgradesData, codex, { revealAll = false } = {}) {
  container.innerHTML = '';
  const ids = Object.keys(upgradesData?.upgrades || {});
  for (const id of ids) {
    const def = upgradesData.upgrades[id];
    const seen = revealAll || codex.isSeen('upgrades', id);
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = 'codex-entry';
    el.dataset.upgrade = id;

    if (!seen) {
      el.classList.add('codex-unseen');
      const q = doc.createElement('div');
      q.className = 'codex-entry-name';
      q.textContent = '???';
      el.appendChild(q);
      container.appendChild(el);
      continue;
    }

    el.dataset.rarity = def.rarity || 'common';
    const name = doc.createElement('div');
    name.className = 'codex-entry-name';
    name.textContent = `${def.symbol ? def.symbol + ' ' : ''}${def.name || id}`;
    const meta = doc.createElement('div');
    meta.className = 'codex-entry-stats';
    meta.textContent = `${RARITY_LABELS[def.rarity] || def.rarity || ''} · ${def.tag || ''}`;
    const desc = doc.createElement('div');
    desc.className = 'codex-entry-desc';
    desc.textContent = def.description || '';
    const textCol = doc.createElement('div');
    textCol.className = 'codex-entry-text';
    textCol.append(name, meta, desc);
    el.appendChild(textCol);
    container.appendChild(el);
  }
}

// Phase 10: Listenansicht "Gegner". Elite ist ein Laufzeit-Affix ohne eigene
// id in data/tanks.json (STARTMENU-BESTAND.md) -- `codex.categoryIds.enemies`
// enthaelt deshalb je Basistyp zwei SYNTHETISCHE Schluessel (normal +
// `::elite`, game/codex.js: eliteKey/isEliteKey/baseIdOf), hier als zwei
// eigene, unterscheidbare Zeilen dargestellt ("eigene Eintraege",
// Testschritt 3). Nur 22 Eintraege (nicht 246 wie bei Upgrades) -- plain
// Divs wie bei "Eigene Panzer" reichen, kein <button> noetig.
export function renderEnemyList(doc, container, tanksData, codex, { revealAll = false } = {}) {
  container.innerHTML = '';
  for (const key of codex.categoryIds.enemies) {
    const elite = isEliteKey(key);
    const baseId = baseIdOf(key);
    const def = tanksData.types?.[baseId];
    if (!def) continue;
    const seen = revealAll || codex.isSeen('enemies', key);
    const el = doc.createElement('div');
    el.className = 'codex-entry';
    el.dataset.enemy = key;
    if (elite) el.classList.add('codex-elite');

    const icon = doc.createElement('div');
    icon.className = 'codex-icon';
    if (seen) {
      // Eliten visuell abgesetzt (Testschritt 3): goldener statt neutraler
      // Icon-Ton -- dasselbe Gold-Vokabular wie legendaere Upgrades/Affixe.
      icon.style.background = elite ? '#d8a83a' : '#7d8794';
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

    const name = doc.createElement('div');
    name.className = 'codex-entry-name';
    name.textContent = (def.label || baseId) + (elite ? ' (Elite)' : '');
    const stats = doc.createElement('div');
    stats.className = 'codex-entry-stats';
    stats.textContent = `LP ${def.maxHp} · Schaden ${def.damage}`;
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

// Phase 11: Listenansicht "Bosse" -- letzte Codex-Kategorie, nur 3 Eintraege.
// Kein "gesperrt" (wie Upgrades/Gegner), keine Elite-Variante (Bosse
// bekommen laut run.js nie Elite-Affixe -- die laufen nur ueber
// buyEnemies()/rollEliteAffixes() fuer normale Kampf-/Eliteraeume, der
// Bossraum ist eine feste Arena mit deterministisch gewuerfeltem Typ).
// Gleiches Grundlayout wie renderEnemyList (Testschritt 5: "Layout
// konsistent mit den anderen Kategorien").
export function renderBossList(doc, container, tanksData, codex, { revealAll = false } = {}) {
  container.innerHTML = '';
  for (const id of codex.categoryIds.bosses) {
    const def = tanksData.types?.[id];
    if (!def) continue;
    const seen = revealAll || codex.isSeen('bosses', id);
    const el = doc.createElement('div');
    el.className = 'codex-entry';
    el.dataset.boss = id;

    const icon = doc.createElement('div');
    icon.className = 'codex-icon';
    if (seen) {
      icon.style.background = '#c85a3a'; // eigener, warnender Ton -- kein Boss ist "nur ein Gegner"
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

    const name = doc.createElement('div');
    name.className = 'codex-entry-name';
    name.textContent = def.label || id;
    const stats = doc.createElement('div');
    stats.className = 'codex-entry-stats';
    stats.textContent = `LP ${def.maxHp} · Schaden ${def.damage}`;
    const desc = doc.createElement('div');
    desc.className = 'codex-entry-desc';
    desc.textContent = def.desc || ''; // Kurzinfo zu Angriffsmustern (Testschritt 3)
    const textCol = doc.createElement('div');
    textCol.className = 'codex-entry-text';
    textCol.append(name, stats, desc);
    el.appendChild(textCol);
    container.appendChild(el);
  }
}
