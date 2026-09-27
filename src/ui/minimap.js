// Minimap (AUFTRAG-UMBAU-V2 Phase D4, ersetzt den alten Kartenscreen aus
// Phase 12/mapscreen.js komplett -- Aufgabe 5: "Der alte Kartenbildschirm
// entfaellt."). Zeigt NICHT mehr die gesamte Akt-Karte "vollstaendig vorab
// einsehbar" (das alte Design-Prinzip), sondern nur noch:
//   - bereits BETRETENE Raeume (voll sichtbar, mit Symbol+Farbe gefuellt),
//   - vom aktuellen Raum aus ERREICHBARE, noch nicht betretene Raeume als
//     Umriss MIT Symbol (Aufgabe 4, woertlich).
// Alles andere (Raeume ausserhalb der naechsten Wahlmoeglichkeit) wird gar
// nicht erst gerendert -- kein Fog-of-War-Overlay auf vorhandenen Knoten,
// sondern schlicht kein DOM-Element dafuer.
//
// Der zugrunde liegende Graph (map.layers/map.byId/node.next) ist bewusst
// UNVERAENDERT (Nutzerentscheidung "Vorwaerts-Graph mit Gitter-Optik"):
// generateMap() in run.js liefert weiterhin dieselbe Struktur wie vor D4,
// nur die Anzeige hier ist neu. run.js: chooseMapNode() bleibt die einzige
// Navigations-/Gueltigkeitspruefung (reine Anzeige + Callback wie zuvor).

export function createMinimapScreen() {
  const el = document.createElement('div');
  el.className = 'overlay hidden';
  el.id = 'map';
  document.body.appendChild(el);

  function drawEdges(svg, rowsEl) {
    svg.innerHTML = '';
    svg.setAttribute('width', rowsEl.scrollWidth);
    svg.setAttribute('height', rowsEl.scrollHeight);
    for (const btn of rowsEl.querySelectorAll('button.mapnode')) {
      const nextIds = (btn.dataset.next || '').split(',').filter(Boolean).map(Number);
      const x0 = btn.offsetLeft + btn.offsetWidth / 2;
      const y0 = btn.offsetTop + btn.offsetHeight / 2;
      for (const nid of nextIds) {
        // Nur zeichnen, wenn das Ziel ebenfalls gerendert ist (sichtbar) --
        // ein Ziel ausserhalb von visited/reachable existiert im DOM nicht.
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
    // opts: { map, currentId, visited (Set/Array), lives, treasureLifeCost,
    //         typeInfo, actIndex, actTotal, onChoose }
    show(opts) {
      const { map, currentId, visited, lives, treasureLifeCost, typeInfo, actIndex, actTotal, onChoose } = opts;
      const current = map.byId.get(currentId);
      const reachable = new Set(current?.next || []);
      const visitedSet = visited instanceof Set ? visited : new Set(visited || []);

      el.innerHTML = '';
      const h = document.createElement('h1');
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
        // Aufgabe 4/5: nur betretene ODER vom aktuellen Raum erreichbare
        // Knoten werden ueberhaupt angezeigt -- eine Ebene ohne sichtbaren
        // Knoten bekommt gar keine Zeile (kein leerer Platzhalter).
        const visibleNodes = layerNodes.filter((n) => visitedSet.has(n.id) || reachable.has(n.id));
        if (!visibleNodes.length) continue;
        const row = document.createElement('div');
        row.className = 'maprow';
        for (const node of visibleNodes) {
          const info = typeInfo[node.type] || { name: node.type, symbol: '?', desc: '' };
          const btn = document.createElement('button');
          btn.className = 'mapnode';
          btn.dataset.id = node.id;
          btn.dataset.next = node.next.join(',');
          btn.title = `${info.name} (Raum ${node.layer})`;
          btn.innerHTML = `<span class="mapnode-symbol">${node.isBoss ? '☠️👑' : info.symbol}</span>`;

          const isCurrent = node.id === currentId;
          const isVisited = visitedSet.has(node.id) && !isCurrent;
          const isReachable = reachable.has(node.id) && !isVisited && !isCurrent;
          const lockedByLives = node.type === 'treasure' && lives <= treasureLifeCost;

          if (isCurrent) {
            btn.classList.add('current');
            btn.disabled = true;
          } else if (isVisited) {
            // Betreten, aber nicht mehr anwaehlbar (der Weg zurueck existiert
            // in diesem Vorwaerts-Graph-Modell nicht) -- gefuellt gezeigt,
            // nur zur Orientierung ueber den bisherigen Pfad.
            btn.classList.add('visited');
            btn.disabled = true;
          } else if (isReachable && !lockedByLives) {
            // Aufgabe 4: "angrenzende Raeume als Umriss mit Symbol" -- Symbol
            // ist bekannt (der Raumtyp steht fest), aber nur als Umriss
            // (durchsichtiger Hintergrund, gestrichelter Rand) statt gefuellt.
            btn.classList.add('reachable', 'outline');
            btn.addEventListener('click', () => {
              if (onChoose(node.id) !== false) el.classList.add('hidden');
            });
          } else {
            btn.classList.add('outline', 'unreachable');
            if (isReachable && lockedByLives) btn.classList.add('locked');
            btn.disabled = true;
          }
          row.appendChild(btn);
        }
        rows.appendChild(row);
        if (visibleNodes.some((n) => n.id === currentId)) currentRowEl = row;
      }
      wrap.appendChild(rows);
      el.appendChild(wrap);

      const hint = document.createElement('p');
      hint.className = 'maphint';
      hint.textContent =
        current?.next.length > 1
          ? 'Wähle den nächsten Raum.'
          : 'Weiter geht es automatisch.';
      el.appendChild(hint);

      el.classList.remove('hidden');
      drawEdges(svg, rows);
      currentRowEl?.scrollIntoView({ block: 'center' });
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
