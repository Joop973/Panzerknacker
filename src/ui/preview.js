// Raumvorschau (Nutzer-Erweiterung): vor jedem Raum eine Liste der
// kommenden Panzer. Hover/Tipp auf einen Panzer zeigt, was er kann
// (Beschreibungen aus tanks.json). Der Raum startet erst nach Klick
// auf "Weiter".

import { TANK_COLORS } from '../render/renderer.js';

export function createPreview() {
  const el = document.createElement('div');
  el.className = 'overlay hidden';
  el.id = 'preview';
  document.body.appendChild(el);

  // P8: Die eigene Ausruestung liegt NICHT mehr im Hauptbereich, sondern auf
  // einer eigenen Vollbild-Seite. Grund: der Hauptbereich muss auf einem
  // Handy im Querformat vollstaendig auf den Schirm passen -- mit einem
  // Dutzend Karten schob die Chipreihe den "Weiter"-Knopf sonst aus dem
  // Bild (Nutzer-Meldung). Auf der eigenen Seite ist Platz, Name und
  // Wirkung stehen dort direkt an der Karte statt hinter einem Tipp.
  const upEl = document.createElement('div');
  upEl.className = 'overlay hidden';
  upEl.id = 'previewUpgrades';
  document.body.appendChild(upEl);

  // Baut die Vollbild-Seite neu und blendet sie ein.
  function showUpgradePage(upgrades) {
    upEl.innerHTML = '';
    const h = document.createElement('h1');
    h.textContent = 'Deine Ausrüstung';
    upEl.appendChild(h);

    const list = document.createElement('div');
    list.className = 'pv-uplist';
    for (const u of upgrades) {
      const row = document.createElement('div');
      row.className = 'pv-uprow';
      // Grundsteinumbau Phase 7: "+"-Suffix je Rastplatz-Stufe direkt am
      // Namen, getrennt von der bestehenden "Stufe N"-Anzeige (die zaehlt
      // Kartenstapel, nicht die Rastplatz-Aufwertung).
      const plus = '+'.repeat(u.stufe || 0);
      row.innerHTML =
        `<span class="pv-sym">${u.symbol || '•'}</span>` +
        `<span class="pv-upname">${u.name}${plus}${u.level > 1 ? ` <em>Stufe ${u.level}</em>` : ''}</span>` +
        `<span class="pv-updesc">${u.description || ''}</span>`;
      list.appendChild(row);
    }
    upEl.appendChild(list);

    const back = document.createElement('button');
    back.id = 'previewUpBack';
    back.textContent = 'Zurück';
    back.addEventListener('click', () => {
      upEl.classList.add('hidden');
      el.classList.remove('hidden'); // zurueck in die Vorschau, nicht in den Raum
    });
    upEl.appendChild(back);
    upEl.classList.remove('hidden');
  }

  return {
    // opts: { title, character (Raumtyp-Text),
    //         upgrades: [{ name, level, description }] (eigene Ausruestung) }
    show(opts, enemyTypes, tanksData, onGo) {
      const { title, character, upgrades, dangerByType, modifierLine, hazardLine, elementLine } = opts;
      // Typen gruppieren: ["t_brown","t_brown","t_grey"] -> Brauner x2 ...
      const counts = new Map();
      for (const t of enemyTypes) counts.set(t, (counts.get(t) || 0) + 1);

      el.innerHTML = '';
      const h = document.createElement('h1');
      h.textContent = title;
      el.appendChild(h);
      const sub = document.createElement('p');
      sub.className = 'pv-sub';
      // Gesamt-Gefahr des Raums (Summe der Gefahrenpunkte).
      let threat = 0;
      if (dangerByType) for (const ty of enemyTypes) threat += dangerByType[ty] || 0;
      const threatTxt = dangerByType ? ` · Gefahr ${threat}` : '';
      sub.textContent = character
        ? `Raumtyp: ${character}${threatTxt} — diese Gegner erwarten dich:`
        : `Diese Gegner erwarten dich${threatTxt}:`;
      el.appendChild(sub);

      // Elemente (Phase 17): Primaer- + Zweitelement der Klasse -- bestimmt,
      // welche Element-Karten in den Angeboten erscheinen. Vor dem Betreten
      // sichtbar wie der Modifikator.
      if (elementLine) {
        const els = document.createElement('p');
        els.className = 'pv-mod';
        els.textContent = elementLine;
        el.appendChild(els);
      }

      const row = document.createElement('div');
      row.className = 'pv-chips';
      const desc = document.createElement('p');
      desc.className = 'pv-desc';
      desc.textContent = 'Tippe einen Panzer für Details.';

      // Kompakt: nur Farbpunkt + Anzahl. Der Name steht im Detailtext
      // darunter (Hover bzw. Tipp) und im nativen Tooltip -- bei acht
      // Gegnertypen sprengten ausgeschriebene Namen sonst die Zeile und
      // schoben den "Weiter"-Knopf aus dem Bild.
      for (const [type, n] of counts) {
        const def = tanksData.types[type] || {};
        const chip = document.createElement('button');
        chip.className = 'pv-chip pv-chip-sm';
        chip.innerHTML =
          `<span class="pv-dot" style="background:${TANK_COLORS[type] || '#fff'}"></span>` +
          (n > 1 ? `<span class="pv-x">×${n}</span>` : '');
        chip.title = def.label || type;
        const pts = dangerByType && dangerByType[type];
        const showDesc = () => {
          desc.textContent =
            `${def.label || type}${n > 1 ? ` ×${n}` : ''}${pts ? ` (Gefahr ${pts})` : ''}: ${def.desc || ''}`;
        };
        chip.addEventListener('mouseenter', showDesc);
        chip.addEventListener('click', showDesc);
        row.appendChild(chip);
      }
      el.appendChild(row);
      el.appendChild(desc);

      // Raum-Modifikator (Phase 10): eigene Zeile, sichtbar bevor der
      // Raum betreten wird -- derselbe "vorher sichtbar" Grundsatz wie beim
      // Elite-Affix, nur nicht an ein Raumtyp gebunden.
      if (modifierLine) {
        const mod = document.createElement('p');
        mod.className = 'pv-mod';
        mod.textContent = modifierLine;
        el.appendChild(mod);
      }

      // Raum-Gefahr (Phase 15): eigene Zeile, gleiches Muster wie der
      // Raum-Modifikator -- auch hier vorher sichtbar, bevor der Raum
      // betreten wird.
      if (hazardLine) {
        const haz = document.createElement('p');
        haz.className = 'pv-mod';
        haz.textContent = hazardLine;
        el.appendChild(haz);
      }

      // Eigene Ausruestung (P8): im Hauptbereich nur noch EINE Zeile --
      // ein Knopf auf die Vollbild-Seite. Die Chipreihe selbst ist dorthin
      // gewandert, damit die Vorschau kurz genug bleibt, dass "Weiter" auf
      // jedem Handy erreichbar ist.
      if (upgrades && upgrades.length) {
        const openUp = document.createElement('button');
        openUp.id = 'previewUpOpen';
        openUp.className = 'secondary';
        openUp.textContent = `Deine Ausrüstung (${upgrades.length}) ▸`;
        openUp.addEventListener('click', () => {
          el.classList.add('hidden');
          showUpgradePage(upgrades);
        });
        el.appendChild(openUp);
      }

      const go = document.createElement('button');
      go.id = 'previewGo';
      go.textContent = 'Weiter';
      go.addEventListener('click', () => {
        el.classList.add('hidden');
        onGo();
      });
      el.appendChild(go);

      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
      upEl.classList.add('hidden');
    },
  };
}
