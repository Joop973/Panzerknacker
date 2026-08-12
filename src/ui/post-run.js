// Post-Run-Screen (PLAN-STARTMENU Phase 12): Auswertungsscreen nach jedem
// Run-Ende (Sieg/Niederlage). Ersetzt den bisherigen Canvas-Text
// (hud.js: drawEnd, Muster "Tippen oder Enter: neuer Run") durch einen
// echten DOM-Screen wie die anderen In-Run-Overlays (Upgrade/Karte/Shop/
// Event/Vorschau) -- damit er wie diese per Tastatur/Gamepad navigierbar
// ist (Testschritt 5), nicht nur per Tipp/Enter auf die ganze Kachel.
//
// Selbst erzeugte DOM-Struktur (Muster preview.js/roomscreens.js), kein
// Eintrag in index.html -- main.js haengt das Overlay als sichtbares
// Run-Overlay in RUN_OVERLAY_IDS ein (dieselbe Controller-Navigation wie
// Upgrade/Karte/Shop/Event/Vorschau).
//
// Alle Zahlen kommen unveraendert aus run.* -- keine neue Berechnung
// ausser run.damageByType (game/run.js: foldRoomDamage(), neu in dieser
// Phase), das Gleiche gilt fuer die "finale Stats stimmen mit dem
// Spielzustand ueberein"-Anforderung (Testschritt 3): dieselben Felder,
// die vorher schon im Canvas-Text standen (hud.js: drawEnd), werden hier
// nur anders dargestellt.

export function createPostRun() {
  const el = document.createElement('div');
  el.className = 'overlay hidden';
  el.id = 'postrun';
  document.body.appendChild(el);

  function statRow(label, value) {
    const row = document.createElement('div');
    row.className = 'pr-stat';
    const l = document.createElement('span');
    l.textContent = label;
    const v = document.createElement('span');
    v.textContent = value;
    row.append(l, v);
    return row;
  }

  return {
    // opts: {
    //   won, classLabel, modeLabel, roomLabel, timeLabel, kills, deaths,
    //   roomsCleared, hitRatePct, bestCombo, deathLine, killTypeLine,
    //   damageLine, newRecord, seed, bestLine,
    //   upgrades: [{symbol, name, level, description}],
    //   showEndless, onEndless, onAgain, onHome,
    // }
    show(opts) {
      el.innerHTML = '';
      // data-result faerbt Titel/Rahmen per CSS statt einer inline-Farbe
      // (style.css) -- Muster wie data-rarity bei den Upgrade-Karten.
      el.dataset.result = opts.won ? 'win' : 'loss';

      const h = document.createElement('h1');
      h.textContent = opts.won ? 'SIEG!' : 'NIEDERLAGE';
      el.appendChild(h);

      const sub = document.createElement('p');
      sub.className = 'pv-sub';
      sub.textContent = `${opts.classLabel} · ${opts.modeLabel} · ${opts.roomLabel}`;
      el.appendChild(sub);

      const stats = document.createElement('div');
      stats.className = 'pr-stats';
      stats.append(
        statRow('Zeit', opts.timeLabel),
        statRow('Kills', String(opts.kills)),
        statRow('Tode', String(opts.deaths)),
        statRow('Räume geräumt', String(opts.roomsCleared)),
        statRow('Trefferquote', `${opts.hitRatePct} %`),
        statRow('Beste Combo', `×${opts.bestCombo}`),
      );
      el.appendChild(stats);

      // Nur bei Niederlage vorhanden (run.lastDeathCause, wie im alten
      // Canvas-Text) -- eine eigene Zeile statt einer Stat-Kachel, weil der
      // Text laenger ist ("Erledigt durch ...").
      if (opts.deathLine) {
        const dl = document.createElement('p');
        dl.className = 'pv-mod';
        dl.textContent = opts.deathLine;
        el.appendChild(dl);
      }
      if (opts.killTypeLine) {
        const kt = document.createElement('p');
        kt.className = 'pv-mod';
        kt.textContent = `Kills: ${opts.killTypeLine}`;
        el.appendChild(kt);
      }
      if (opts.damageLine) {
        const dm = document.createElement('p');
        dm.className = 'pv-mod';
        dm.textContent = `Gesamtschaden: ${opts.damageLine}`;
        el.appendChild(dm);
      }
      if (opts.newRecord) {
        const rec = document.createElement('p');
        rec.className = 'pr-record';
        rec.textContent = '★ Neuer Rekord! ★';
        el.appendChild(rec);
      }

      const seedLine = document.createElement('p');
      seedLine.className = 'pv-sub';
      seedLine.textContent = `Seed: ${opts.seed}${opts.bestLine ? `   ${opts.bestLine}` : ''}`;
      el.appendChild(seedLine);

      // Upgrade-Grid (Testschritt 2: alle gesammelten Upgrades VOLLSTAENDIG,
      // nicht nur die Top 4 wie vorher im Canvas-Text).
      if (opts.upgrades && opts.upgrades.length) {
        const gh = document.createElement('h2');
        gh.className = 'pr-subhead';
        gh.textContent = `Upgrades (${opts.upgrades.length})`;
        el.appendChild(gh);
        const grid = document.createElement('div');
        grid.className = 'pr-upgrid';
        for (const u of opts.upgrades) {
          const cell = document.createElement('div');
          cell.className = 'pr-upcell';
          const head = document.createElement('div');
          head.className = 'pr-upcell-head';
          const sym = document.createElement('span');
          sym.className = 'pv-sym';
          sym.textContent = u.symbol || '•';
          const name = document.createElement('span');
          name.textContent = u.name;
          if (u.level > 1) {
            const lvl = document.createElement('em');
            lvl.textContent = ` Stufe ${u.level}`;
            name.appendChild(lvl);
          }
          head.append(sym, name);
          const desc = document.createElement('div');
          desc.className = 'pr-upcell-desc';
          desc.textContent = u.description || '';
          cell.append(head, desc);
          grid.appendChild(cell);
        }
        el.appendChild(grid);
      }

      const actions = document.createElement('div');
      actions.className = 'pr-actions';

      // Nur beim Sieg sichtbar (Muster: das alte #endlessBtn, jetzt Teil
      // dieses Screens statt eines eigenen schwebenden Knopfs).
      if (opts.showEndless) {
        const endlessBtn = document.createElement('button');
        endlessBtn.id = 'postrunEndless';
        endlessBtn.textContent = 'Endlos weiterspielen →';
        endlessBtn.addEventListener('click', () => {
          el.classList.add('hidden');
          opts.onEndless();
        });
        actions.appendChild(endlessBtn);
      }

      const again = document.createElement('button');
      again.id = 'postrunAgain';
      again.textContent = 'Nochmal (gleiche Klasse + Schwierigkeit)';
      again.addEventListener('click', () => {
        el.classList.add('hidden');
        opts.onAgain();
      });
      actions.appendChild(again);

      const home = document.createElement('button');
      home.id = 'postrunHome';
      home.className = 'secondary';
      home.textContent = 'Zurück zum Hauptmenü';
      home.addEventListener('click', () => {
        el.classList.add('hidden');
        opts.onHome();
      });
      actions.appendChild(home);

      el.appendChild(actions);
      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
