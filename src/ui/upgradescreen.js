// Upgrade-Screen (Spec Abschnitt 8; Phase 2: Tags/Rarity; Phase 3: Schrott).
//
// HTML-Overlay. Die Angebote kommen aus run.js (Seed-deterministisch).
// Vier Schrott-Aktionen (Neu würfeln, Verbannen, Vierte Karte,
// Schildladung) mit sichtbarem Preis; ausgegraut bei zu wenig Schrott.
// Der Screen rendert sich nach jeder Aktion neu; erst die Kartenwahl
// schliesst ihn.

const RARITY = { common: 'Gewöhnlich', rare: 'Selten', legendary: 'Legendär' };

export function createUpgradeScreen() {
  const el = document.createElement('div');
  el.className = 'overlay hidden';
  el.id = 'upgrade';
  document.body.appendChild(el);

  let ctx = null; // aktueller Kontext (Getter + Callbacks aus main.js)

  function render() {
    if (!ctx) return;
    const offers = ctx.getOffers();
    const scrap = ctx.getScrap();
    const costs = ctx.costs;
    // Elite-/Treasure-Belohnungen zeigen keine Schrott-Aktionen.
    const showActions = ctx.showActions !== false;
    el.innerHTML = '';

    const h = document.createElement('h1');
    h.textContent = ctx.title || 'Upgrade wählen';
    el.appendChild(h);

    if (ctx.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'scrapline';
      sub.textContent = ctx.subtitle;
      el.appendChild(sub);
    } else if (showActions) {
      const scrapLine = document.createElement('p');
      scrapLine.className = 'scrapline';
      scrapLine.innerHTML = `Schrott: <strong>${scrap}</strong>`;
      el.appendChild(scrapLine);
    }

    // Transformationen (Phase 17): "X/3"-Fortschritt fuer Tags mit
    // mindestens einer gewaehlten Karte, die noch nicht freigeschaltet
    // sind, plus eine kurze Liste bereits aktiver Transformationen --
    // ohne sichtbaren Fortschritt verpufft die Mechanik unbemerkt.
    if (ctx.transformDefs) {
      const active = [];
      const progress = [];
      const seenTags = new Set();
      for (const t of Object.values(ctx.transformDefs)) {
        if (seenTags.has(t.tag)) continue;
        seenTags.add(t.tag);
        // Kavallerie wirkt nur mit der Dash-Karte -- ohne sie waere die
        // Freischaltung stumm wirkungslos, deshalb der Hinweis direkt hier.
        const dashHint = t.id === 'kavallerie' && !ctx.hasDash ? ' (nur mit Dash-Karte)' : '';
        if (ctx.unlocked?.has(t.id)) {
          active.push(`${t.symbol} ${t.name}${dashHint}`);
        } else {
          const count = ctx.tagCounts?.[t.tag] || 0;
          if (count > 0) progress.push(`${t.symbol} ${t.name} ${count}/${ctx.threshold ?? 3}${dashHint}`);
        }
      }
      if (active.length) {
        const p = document.createElement('p');
        p.className = 'pv-mod';
        p.textContent = `Aktiv: ${active.join(' · ')}`;
        el.appendChild(p);
      }
      if (progress.length) {
        const p = document.createElement('p');
        p.className = 'pv-mod';
        p.textContent = `Fortschritt: ${progress.join(' · ')}`;
        el.appendChild(p);
      }
    }

    const row = document.createElement('div');
    row.className = 'cards';
    offers.forEach((o, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.rarity = o.rarity || 'common';
      card.dataset.tag = o.tag || '';
      // Controller-/Tastatur-Navigation: die Karte ist ein klickbares DIV,
      // kein <button> (der Verbannen-Knopf liegt darin -- Button-in-Button
      // waere ungueltig). data-navcard nimmt sie in die Fokusliste der
      // In-Run-Overlays auf (main.js: runOverlayNav), tabindex macht sie auch
      // per Tab erreichbar.
      card.dataset.navcard = '1';
      card.tabIndex = 0;
      const lvl = o.fallback ? '' : ` (Stufe ${o.level}/${o.maxStacks})`;
      const meta = o.fallback
        ? ''
        : `<span class="cardmeta">${o.tag} · ${RARITY[o.rarity] || o.rarity}</span>`;
      card.innerHTML = `<strong>${o.name}${lvl}</strong><span>${o.description}</span>${meta}`;
      card.addEventListener('click', () => {
        el.classList.add('hidden');
        ctx.onPick(i);
      });
      // Verbannen-Knopf (nicht bei Fallback-Karten, nur mit Schrott-Aktionen).
      if (!o.fallback && showActions) {
        const ban = document.createElement('button');
        ban.className = 'banbtn';
        ban.innerHTML = `✕&nbsp;${costs.ban}`;
        ban.title = 'Diese Karte für den Rest des Runs verbannen';
        ban.disabled = scrap < costs.ban;
        ban.addEventListener('click', (e) => {
          e.stopPropagation();
          if (ctx.onBan(i)) render();
        });
        card.appendChild(ban);
      }
      row.appendChild(card);
    });
    el.appendChild(row);

    if (!showActions) {
      el.classList.remove('hidden');
      return;
    }

    const actions = document.createElement('div');
    actions.className = 'scrapactions';
    const mkAction = (label, cost, enabled, fn) => {
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
      mkAction('Neu würfeln', costs.reroll, scrap >= costs.reroll, ctx.onReroll),
    );
    actions.appendChild(
      mkAction(
        'Vierte Karte',
        costs.fourthCard,
        scrap >= costs.fourthCard && ctx.canFourth(),
        ctx.onFourth,
      ),
    );
    actions.appendChild(
      mkAction('Schildladung', costs.shieldCharge, scrap >= costs.shieldCharge, ctx.onShield),
    );
    el.appendChild(actions);

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
