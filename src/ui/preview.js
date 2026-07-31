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

  return {
    // opts: { title, character (Raumtyp-Text),
    //         upgrades: [{ name, level, description }] (eigene Ausruestung) }
    show(opts, enemyTypes, tanksData, onGo) {
      const { title, character, upgrades, dangerByType, modifierLine, hazardLine } = opts;
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

      // Eigene Ausruestung: dieselben antippbaren Chips wie bei den Gegnern
      // oben -- Hover bzw. Tipp zeigt, WAS die Karte tut. Vorher stand hier
      // nur eine Namensliste ohne Wirkung (Nutzerwunsch).
      if (upgrades && upgrades.length) {
        const own = document.createElement('p');
        own.className = 'pv-own';
        own.textContent = 'Deine Upgrades:';
        el.appendChild(own);

        const upRow = document.createElement('div');
        upRow.className = 'pv-chips';
        const upDesc = document.createElement('p');
        upDesc.className = 'pv-desc';
        upDesc.textContent = 'Tippe ein Upgrade für Details.';
        // Nur Symbol + Stufe: mit einem Dutzend Karten waeren ausgeschriebene
        // Namen mehrere Zeilen hoch und haben den "Weiter"-Knopf aus dem
        // sichtbaren Bereich geschoben (Nutzer-Meldung). Name und Wirkung
        // stehen im Detailtext darunter.
        for (const u of upgrades) {
          const chip = document.createElement('button');
          chip.className = 'pv-chip pv-chip-sm pv-chip-up';
          chip.innerHTML =
            `<span class="pv-sym">${u.symbol || '•'}</span>` +
            (u.level > 1 ? `<span class="pv-x">×${u.level}</span>` : '');
          chip.title = u.name;
          const show = () => {
            upDesc.textContent = `${u.symbol || ''} ${u.name}${u.level > 1 ? ` (Stufe ${u.level})` : ''}: ${u.description || ''}`;
          };
          chip.addEventListener('mouseenter', show);
          chip.addEventListener('click', show);
          upRow.appendChild(chip);
        }
        el.appendChild(upRow);
        el.appendChild(upDesc);
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
    },
  };
}
