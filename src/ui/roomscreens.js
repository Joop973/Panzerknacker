// Raum-Overlays: Ereignis und Werkstatt.
// HTML-Overlays wie der Upgrade-Screen. Die Spiellogik (run.js) liefert
// Daten und Callbacks; diese Module rendern nur.

function makeOverlay(id) {
  const el = document.createElement('div');
  el.className = 'overlay hidden';
  el.id = id;
  document.body.appendChild(el);
  return el;
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

// ---- Shop (Phase 13, vorher "Werkstatt") -------------------------------
// Fuenf Schrott-Aktionen: Karte aus dem Regal kaufen, Schildladung, Leben
// (einmal pro Besuch), Sekundaerwaffe tauschen, Upgrade ablegen. Der
// Screen rendert nach JEDER Aktion neu; erst "Verlassen" schliesst ihn.
// Die interne Raumtyp-/Phasen-Kennung bleibt `workshop` (siehe run.js).
export function createShopScreen() {
  const el = makeOverlay('workshop');
  let ctx = null;

  // Kleiner Abschnittstitel zwischen den Bereichen.
  function sectionTitle(text) {
    const p = document.createElement('p');
    p.className = 'workshophint';
    p.textContent = text;
    return p;
  }

  function renderCards(scrap) {
    const offers = ctx.getOffers() || [];
    if (!offers.length) return;
    el.appendChild(sectionTitle(`Karte kaufen (${ctx.costs.shopCard}⚙ je Karte):`));
    const shelf = document.createElement('div');
    shelf.className = 'shopcards';
    offers.forEach((o, i) => {
      const card = document.createElement('div');
      card.className = 'shopcard';
      card.dataset.rarity = o.rarity || 'common';
      if (o.sold) {
        card.classList.add('sold');
        card.innerHTML = '<strong>Verkauft</strong>';
        shelf.appendChild(card);
        return;
      }
      const lvl = o.fallback ? '' : ` (Stufe ${o.level}/${o.maxStacks})`;
      card.innerHTML =
        `<strong>${o.name}${lvl}</strong><span>${o.description}</span>` +
        `<span class="price">${ctx.costs.shopCard}⚙</span>`;
      if (scrap < ctx.costs.shopCard) {
        card.classList.add('tooexpensive');
      } else {
        // Nur kaufbare Karten in die Controller-Fokusliste aufnehmen (main.js:
        // runOverlayNav liest [data-navcard]) -- die Karte ist ein klickbares
        // DIV, kein <button>. Verkaufte/zu teure Karten bleiben aussen vor.
        card.dataset.navcard = '1';
        card.tabIndex = 0;
        card.addEventListener('click', () => {
          if (ctx.onBuyCard(i)) render();
        });
      }
      shelf.appendChild(card);
    });
    el.appendChild(shelf);
  }

  function renderActions(scrap) {
    const actions = document.createElement('div');
    actions.className = 'scrapactions';
    const mk = (label, cost, enabled, fn) => {
      const b = document.createElement('button');
      b.className = 'scrapbtn';
      b.innerHTML = `${label} <span class="price">${cost}⚙</span>`;
      b.disabled = !enabled;
      b.addEventListener('click', () => {
        if (fn()) render();
      });
      return b;
    };
    actions.appendChild(
      mk('Schildladung', ctx.costs.shieldCharge, scrap >= ctx.costs.shieldCharge, ctx.onBuyShield),
    );
    // Zweitelement neu wuerfeln (Phase 17): aendert den Angebots-Pool sofort.
    if (ctx.onRerollElement) {
      actions.appendChild(
        mk(
          `Zweitelement (${ctx.getSecondElement()}) neu`,
          ctx.costs.rerollElement,
          scrap >= ctx.costs.rerollElement,
          ctx.onRerollElement,
        ),
      );
    }
    // Leben: teuer und nur einmal pro Shop -- danach dauerhaft ausgegraut.
    actions.appendChild(
      mk(
        ctx.lifeBought() ? '+1 Leben (gekauft)' : '+1 Leben',
        ctx.costs.shopLife,
        !ctx.lifeBought() && scrap >= ctx.costs.shopLife,
        ctx.onBuyLife,
      ),
    );
    el.appendChild(actions);
  }

  function renderSecondaries(scrap) {
    // P4: der Shop tauscht das GADGET -- die Bombe liegt im festen Slot und
    // steht nicht zum Tausch. Deshalb nur Eintraege mit category 'gadget'.
    // Nutzerwunsch: der Nekromant hat gar keinen Gadget-Slot -- die ganze
    // Sektion bleibt fuer ihn unsichtbar statt nur ausgegraut (der Kauf
    // waere ueber buyShopSecondary() ohnehin wirkungslos, s. run.js).
    if (ctx.necromancer) return;
    const equipped = ctx.getEquippedSecondary();
    const others = Object.keys(ctx.secondariesData).filter(
      (id) => ctx.secondariesData[id]?.category === 'gadget' && id !== equipped,
    );
    if (!others.length) return;
    const cur = equipped ? ctx.secondariesData[equipped]?.label || equipped : 'keines';
    el.appendChild(
      sectionTitle(`Gadget tauschen (${ctx.costs.shopSecondary}⚙, aktuell: ${cur}):`),
    );
    const list = document.createElement('div');
    list.className = 'droplist';
    for (const id of others) {
      const b = document.createElement('button');
      b.className = 'dropbtn';
      b.innerHTML =
        `${ctx.secondariesData[id]?.label || id} <span class="price">${ctx.costs.shopSecondary}⚙</span>`;
      b.disabled = scrap < ctx.costs.shopSecondary;
      b.addEventListener('click', () => {
        if (ctx.onBuySecondary(id)) render();
      });
      list.appendChild(b);
    }
    el.appendChild(list);
  }

  function renderDrops() {
    const upgrades = ctx.getUpgrades(); // { id: level }
    const defs = ctx.upgradesData.upgrades;
    const owned = Object.entries(upgrades).filter(([, l]) => l > 0);
    el.appendChild(
      sectionTitle(
        owned.length
          ? `Upgrade ablegen (+${ctx.dropRefund}⚙ je Stufe):`
          : 'Noch keine Upgrades zum Ablegen.',
      ),
    );
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
  }

  function render() {
    if (!ctx) return;
    const scrap = ctx.getScrap();
    el.innerHTML = '';

    const h = document.createElement('h1');
    h.textContent = 'Shop';
    el.appendChild(h);
    const line = document.createElement('p');
    line.className = 'scrapline';
    line.innerHTML = `Schrott: <strong>${scrap}</strong>`;
    el.appendChild(line);

    renderCards(scrap);
    renderActions(scrap);
    renderSecondaries(scrap);
    renderDrops();

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
