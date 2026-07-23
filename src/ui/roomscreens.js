// Raum-Overlays (Phase 4): Türwahl, Ereignis, Werkstatt.
// HTML-Overlays wie der Upgrade-Screen. Die Spiellogik (run.js) liefert
// Daten und Callbacks; diese Module rendern nur.

import { ROOM_TYPE_INFO } from '../game/run.js';

function makeOverlay(id) {
  const el = document.createElement('div');
  el.className = 'overlay hidden';
  el.id = id;
  document.body.appendChild(el);
  return el;
}

// ---- Türwahl ----------------------------------------------------------
export function createDoorScreen() {
  const el = makeOverlay('door');
  return {
    show({ offers, onPick }) {
      el.innerHTML = '';
      const h = document.createElement('h1');
      h.textContent = 'Wähle eine Tür';
      el.appendChild(h);
      const row = document.createElement('div');
      row.className = 'doors';
      offers.forEach((o, i) => {
        const info = ROOM_TYPE_INFO[o.type] || { name: o.type, symbol: '?', desc: '' };
        const btn = document.createElement('button');
        btn.className = 'doorcard';
        btn.dataset.type = o.type;
        btn.innerHTML =
          `<span class="doorsym">${info.symbol}</span>` +
          `<strong>${info.name}</strong><span>${info.desc}</span>`;
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

// ---- Ereignis ---------------------------------------------------------
export function createEventScreen() {
  const el = makeOverlay('event');
  return {
    show({ event, onChoose }) {
      el.innerHTML = '';
      const h = document.createElement('h1');
      h.textContent = event.title;
      el.appendChild(h);
      const p = document.createElement('p');
      p.className = 'eventtext';
      p.textContent = event.text;
      el.appendChild(p);
      const row = document.createElement('div');
      row.className = 'eventopts';
      event.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'eventbtn';
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
          el.classList.add('hidden');
          onChoose(i);
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

// ---- Werkstatt --------------------------------------------------------
export function createWorkshopScreen() {
  const el = makeOverlay('workshop');
  let ctx = null;

  function render() {
    if (!ctx) return;
    const scrap = ctx.getScrap();
    const upgrades = ctx.getUpgrades(); // { id: level }
    const defs = ctx.upgradesData.upgrades;
    el.innerHTML = '';

    const h = document.createElement('h1');
    h.textContent = 'Werkstatt';
    el.appendChild(h);
    const line = document.createElement('p');
    line.className = 'scrapline';
    line.innerHTML = `Schrott: <strong>${scrap}</strong>`;
    el.appendChild(line);

    // Aktionen: Schildladung kaufen.
    const actions = document.createElement('div');
    actions.className = 'scrapactions';
    const buy = document.createElement('button');
    buy.className = 'scrapbtn';
    buy.innerHTML = `Schildladung <span class="price">${ctx.shieldCost}⚙</span>`;
    buy.disabled = scrap < ctx.shieldCost;
    buy.addEventListener('click', () => {
      if (ctx.onBuyShield()) render();
    });
    actions.appendChild(buy);
    el.appendChild(actions);

    // Upgrades ablegen.
    const owned = Object.entries(upgrades).filter(([, l]) => l > 0);
    const dropTitle = document.createElement('p');
    dropTitle.className = 'workshophint';
    dropTitle.textContent = owned.length
      ? `Upgrade ablegen (+${ctx.dropRefund}⚙ je Stufe):`
      : 'Noch keine Upgrades zum Ablegen.';
    el.appendChild(dropTitle);

    const list = document.createElement('div');
    list.className = 'droplist';
    for (const [id, lvl] of owned) {
      const b = document.createElement('button');
      b.className = 'dropbtn';
      b.innerHTML = `${defs[id]?.name || id} ${lvl} <span class="price">+${ctx.dropRefund}⚙</span>`;
      b.addEventListener('click', () => {
        if (ctx.onDrop(id)) render();
      });
      list.appendChild(b);
    }
    el.appendChild(list);

    const leave = document.createElement('button');
    leave.className = 'leavebtn';
    leave.textContent = 'Verlassen →';
    leave.addEventListener('click', () => {
      el.classList.add('hidden');
      ctx.onLeave();
    });
    el.appendChild(leave);

    el.classList.remove('hidden');
  }

  return {
    show(context) {
      ctx = context;
      render();
    },
    hide() {
      el.classList.add('hidden');
      ctx = null;
    },
  };
}
