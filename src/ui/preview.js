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
    show(title, enemyTypes, tanksData, onGo) {
      // Typen gruppieren: ["t_brown","t_brown","t_grey"] -> Brauner x2 ...
      const counts = new Map();
      for (const t of enemyTypes) counts.set(t, (counts.get(t) || 0) + 1);

      el.innerHTML = '';
      const h = document.createElement('h1');
      h.textContent = title;
      el.appendChild(h);
      const sub = document.createElement('p');
      sub.className = 'pv-sub';
      sub.textContent = 'Diese Gegner erwarten dich:';
      el.appendChild(sub);

      const row = document.createElement('div');
      row.className = 'pv-chips';
      const desc = document.createElement('p');
      desc.className = 'pv-desc';
      desc.textContent = 'Tippe einen Panzer für Details.';

      for (const [type, n] of counts) {
        const def = tanksData.types[type] || {};
        const chip = document.createElement('button');
        chip.className = 'pv-chip';
        chip.innerHTML =
          `<span class="pv-dot" style="background:${TANK_COLORS[type] || '#fff'}"></span>` +
          `${def.label || type}${n > 1 ? ' ×' + n : ''}`;
        const showDesc = () => {
          desc.textContent = `${def.label || type}: ${def.desc || ''}`;
        };
        chip.addEventListener('mouseenter', showDesc);
        chip.addEventListener('click', showDesc);
        row.appendChild(chip);
      }
      el.appendChild(row);
      el.appendChild(desc);

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
