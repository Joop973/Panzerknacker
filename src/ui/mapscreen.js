// Kartenscreen (Phase 12): zeigt die GESAMTE Roguelike-Karte (alle Reihen,
// alle Knoten, alle Kanten) -- "vollstaendig vorab einsehbar" (PLAN.md).
// Nur die von der aktuellen Position erreichbaren Knoten der naechsten
// Reihe sind klickbar; der Rest ist sichtbar, aber nur zur Orientierung.
// Reine Anzeige + Callback, wie preview.js/roomscreens.js -- die eigentliche
// Navigation (Erreichbarkeits-/Leben-Pruefung) macht run.js: chooseMapNode().

const NODE_R = 20; // px, Kreisradius der Knoten-Buttons

export function createMapScreen() {
  const el = document.createElement('div');
  el.className = 'overlay hidden';
  el.id = 'map';
  document.body.appendChild(el);

  function drawEdges(svg, rowsEl, byId) {
    svg.innerHTML = '';
    svg.setAttribute('width', rowsEl.scrollWidth);
    svg.setAttribute('height', rowsEl.scrollHeight);
    for (const btn of rowsEl.querySelectorAll('button.mapnode')) {
      const id = Number(btn.dataset.id);
      const node = byId.get(id);
      const x0 = btn.offsetLeft + btn.offsetWidth / 2;
      const y0 = btn.offsetTop + btn.offsetHeight / 2;
      for (const nid of node.next) {
        const target = rowsEl.querySelector(`button.mapnode[data-id="${nid}"]`);
        if (!target) continue;
        const x1 = target.offsetLeft + target.offsetWidth / 2;
        const y1 = target.offsetTop + target.offsetHeight / 2;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x0);
        line.setAttribute('y1', y0);
        line.setAttribute('x2', x1);
        line.setAttribute('y2', y1);
        line.setAttribute('class', 'mapedge');
        svg.appendChild(line);
      }
    }
  }

  return {
    // opts: { map, currentId, lives, treasureLifeCost, typeInfo, actIndex,
    //         actTotal, onChoose }
    show(opts) {
      const { map, currentId, lives, treasureLifeCost, typeInfo, actIndex, actTotal, onChoose } = opts;
      const current = map.byId.get(currentId);
      const reachable = new Set(current?.next || []);

      el.innerHTML = '';
      const h = document.createElement('h1');
      // Grundsteinumbau Phase 6: "Akt X/3" -- nur angezeigt, wenn main.js die
      // Werte mitgibt (Rueckwaertskompatibilitaet fuer isolierte Aufrufer).
      h.textContent = actIndex ? `Karte — Akt ${actIndex}/${actTotal}` : 'Karte';
      el.appendChild(h);

      const wrap = document.createElement('div');
      wrap.className = 'mapwrap';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'mapedges');
      wrap.appendChild(svg);

      const rows = document.createElement('div');
      rows.className = 'maprows';
      let currentRowEl = null;

      for (const layerNodes of map.layers) {
        const row = document.createElement('div');
        row.className = 'maprow';
        for (const node of layerNodes) {
          const info = typeInfo[node.type] || { name: node.type, symbol: '?', desc: '' };
          const btn = document.createElement('button');
          btn.className = 'mapnode';
          btn.dataset.id = node.id;
          btn.title = `${info.name} (Raum ${node.layer})`;
          btn.innerHTML = `<span class="mapnode-symbol">${node.isBoss ? '☠️👑' : info.symbol}</span>`;

          const isCurrent = node.id === currentId;
          const isReachable = reachable.has(node.id);
          const lockedByLives = node.type === 'treasure' && lives <= treasureLifeCost;
          if (isCurrent) btn.classList.add('current');
          if (isReachable && !lockedByLives) {
            btn.classList.add('reachable');
            btn.addEventListener('click', () => {
              // Der Screen schliesst sich SELBST (Muster wie preview.js,
              // upgradescreen.js und roomscreens.js). Fehlte das hier, blieb
              // das Overlay nach der Knotenwahl ueber dem Spielfeld liegen
              // und fing jede weitere Eingabe ab -- der Run war nicht mehr
              // bedienbar. Nur bei gueltiger Wahl schliessen (onChoose gibt
              // false zurueck, wenn run.js den Zug ablehnt).
              if (onChoose(node.id) !== false) el.classList.add('hidden');
            });
          } else {
            btn.classList.add('unreachable');
            if (isReachable && lockedByLives) btn.classList.add('locked');
            btn.disabled = true;
          }
          row.appendChild(btn);
        }
        rows.appendChild(row);
        if (layerNodes.some((n) => n.id === currentId)) currentRowEl = row;
      }
      wrap.appendChild(rows);
      el.appendChild(wrap);

      const hint = document.createElement('p');
      hint.className = 'maphint';
      hint.textContent =
        current?.next.length > 1
          ? 'Wähle den nächsten Raum.'
          : 'Weiter geht es automatisch — hier siehst du den gesamten Weg.';
      el.appendChild(hint);

      el.classList.remove('hidden');
      // Kanten erst zeichnen, wenn das Overlay sichtbar ist (offsetLeft/-Top
      // sind sonst 0, da display:none-Elemente kein Layout bekommen).
      drawEdges(svg, rows, map.byId);
      currentRowEl?.scrollIntoView({ block: 'center' });
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
