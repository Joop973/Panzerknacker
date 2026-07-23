// Upgrade-Screen (Spec Abschnitt 8): 3 Optionen, 1 wird gewaehlt.
// HTML-Overlay; die Angebote kommen fertig gewuerfelt aus run.js
// (Seed-deterministisch). Der Screen kann nie leer sein -- run.js
// fuellt fehlende Slots mit "+1 Leben" auf.

export function createUpgradeScreen() {
  const el = document.createElement('div');
  el.className = 'overlay hidden';
  el.id = 'upgrade';
  document.body.appendChild(el);

  return {
    show(offers, onPick) {
      el.innerHTML = '';
      const h = document.createElement('h1');
      h.textContent = 'Upgrade wählen';
      el.appendChild(h);
      const row = document.createElement('div');
      row.className = 'cards';
      const RARITY = { common: 'Gewöhnlich', rare: 'Selten', legendary: 'Legendär' };
      offers.forEach((o, i) => {
        const btn = document.createElement('button');
        btn.className = 'card';
        btn.dataset.rarity = o.rarity || 'common';
        btn.dataset.tag = o.tag || '';
        const lvl = o.fallback ? '' : ` (Stufe ${o.level}/${o.maxStacks})`;
        const meta = o.fallback
          ? ''
          : `<span class="cardmeta">${o.tag} · ${RARITY[o.rarity] || o.rarity}</span>`;
        btn.innerHTML = `<strong>${o.name}${lvl}</strong><span>${o.description}</span>${meta}`;
        btn.addEventListener('click', () => {
          el.classList.add('hidden');
          onPick(i);
        });
        row.appendChild(btn);
      });
      el.appendChild(row);
      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
