// Terrain-/Wand-Methoden des Spielzustands: aus state.js ausgelagert
// (AUFTRAG-FERTIGSTELLUNG Phase A2), damit die Datei unter der
// ~300-Zeilen-Konvention bleibt. `createWorldMethods()` liefert die Methoden,
// die createState() in den fertigen `state` mischt (Object.assign) -- jede
// Methode liest ausschliesslich `state.*` bzw. die hier explizit
// uebergebenen `grid`/`walls`-Referenzen (dieselben Arrays wie
// `state.grid`/`state.walls`, niemals neu zugewiesen -- nur zellenweise
// mutiert), nie ein sonstiges Closure-Local von createState().

import { CELL, COLS, ROWS } from '../config.js';
import { circlesOverlap } from './collision.js';

function buildWalls(grid, destructibleHits, generatorHits) {
  const walls = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const type = WALL_TYPES[grid[row][col]];
      if (type) {
        const wall = { x: col * CELL, y: row * CELL, w: CELL, h: CELL, type, col, row };
        // Phase 11: eigene Haltbarkeit statt state.transform.wallDurability --
        // dieselbe destroyWall()-Zaehllogik wie Sperrmauer/Baumeister.
        if (type === 'destructible') wall.destructibleHits = destructibleHits || 1;
        // Phase 14: Reaktor-Generator -- eigene (meist kleinere) Haltbarkeit.
        // Aktuell nie erreichbar (Bandenschuss-Vorbedingung entfallen, Boss
        // ist Platzhalter, s. bullet.js), Feld bleibt fuer den Bossneubau.
        if (type === 'generator') wall.destructibleHits = generatorHits || 1;
        walls.push(wall);
      }
    }
  }
  return walls;
}

// Zelltyp -> Wandtyp. 'hole' blockiert Panzer, Geschosse fliegen drueber.
// 'destructible' (Phase 11): physisch wie 'solid', bis sie durch
// destructibleHits Treffer (Kugel ODER Explosion) abgebaut ist.
// 'generator' (Phase 14, Reaktor-Boss): physisch wie 'solid'. Verhielt sich
// vor dem Grundsteinumbau wie eine zerstoerbare Wand, die nur ein bereits
// abgeprallter Schuss beschaedigte -- ohne Bandenschuss (Phase 1) ist das
// gegenstandslos, der Reaktor-Boss ist ohnehin aktuell ein Platzhalter
// (t_black, s. CLAUDE.md). Generatoren stehen bis zum Bossneubau als
// gewoehnliche, unzerstoerbare Waende.
const WALL_TYPES = { '#': 'solid', b: 'breakable', o: 'hole', d: 'destructible', g: 'generator' };

// G5 (t_mason): reine BFS ueber das Laufzeit-Grid, dasselbe Solid-Kriterium
// wie isSolid() ('#'/'b'/'d'/'g'). Modul-Ebene statt state-Methode, weil sie
// zweimal (vorher/nachher) mit demselben `grid` aufgerufen wird -- eine
// state-Methode wuerde dieselbe Logik nur duplizieren muessen.
// UMBAUPLAN-GEGNER.md Fund 15: generator.js: reachableCells() arbeitet auf
// dem STATISCHEN Generierungs-Grid, nicht auf diesem Laufzeit-Grid -- der
// Algorithmus ist 1:1 uebertragbar, aber als eigene, kleine Kopie hier.
function bfsReachable(grid, startCol, startRow) {
  const seen = new Set();
  const key = (c, r) => r * 1000 + c;
  if (grid[startRow]?.[startCol] === undefined) return seen;
  const stack = [[startCol, startRow]];
  seen.add(key(startCol, startRow));
  while (stack.length) {
    const [c, r] = stack.pop();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const k = key(nc, nr);
      if (seen.has(k)) continue;
      const cell = grid[nr][nc];
      if (cell === '#' || cell === 'b' || cell === 'd' || cell === 'g') continue;
      seen.add(k);
      stack.push([nc, nr]);
    }
  }
  return seen;
}

export { buildWalls, bfsReachable, WALL_TYPES };

// Faktory statt Objektliteral-Methoden direkt in createState() -- `state`
// ist zum Aufrufzeitpunkt jeder Methode bereits vollstaendig konstruiert
// (Methoden werden erst spaeter aufgerufen, nie waehrend der Konstruktion
// selbst), `grid`/`walls` sind dieselben Referenzen wie `state.grid`/
// `state.walls`.
export function createWorldMethods(state, grid, walls) {
  return {
    // Solid-Test fuer Geschosse/Sichtlinien: 'o' (hole) blockiert NICHT.
    // 'd' (zerstoerbare Wand, Phase 11) ist bis zur Zerstoerung physisch
    // normal, 'g' (Reaktor-Generator, Phase 14) ebenso (aktuell unzerstoerbar,
    // s. WALL_TYPES-Kommentar oben).
    isSolid(px, py) {
      const col = Math.floor(px / CELL);
      const row = Math.floor(py / CELL);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
      const cell = grid[row][col];
      return cell === '#' || cell === 'b' || cell === 'd' || cell === 'g';
    },
    // Sicht-Test fuer KI-Raycasts (Phase 6): zusaetzlich zu Waenden
    // blockieren aktive Rauchwolken die Sicht -- Geschossphysik/Bewegung
    // bleiben unberuehrt (isSolid() ist dafuer weiter allein zustaendig).
    blocksSight(px, py) {
      if (state.isSolid(px, py)) return true;
      for (const c of state.smokeClouds) {
        const dx = px - c.x;
        const dy = py - c.y;
        if (dx * dx + dy * dy <= c.radius * c.radius) return true;
      }
      return false;
    },
    // Sekundärslot "Sperrmauer" (Phase 6): platziert eine haltbare Wand auf
    // der Zielzelle, sofern diese begehbar und frei von Panzern ist.
    // Rueckgabe: die neu angelegte Wand (truthy, wie das alte `true`) oder
    // `false` bei Fehlschlag. G5 (t_mason) braucht die Wand-REFERENZ selbst
    // (um sie mit masonExpiresAt zu markieren) -- ein reiner Boolean genuegte
    // bis dahin nur dem Spieler-Gadget (tank.js: placeTrapWall()), das das
    // Ergebnis rein als "used"-Wahrheitswert weiterreicht und mit einem
    // Objekt statt `true` unveraendert funktioniert.
    placeTrapWall(x, y, hits) {
      const col = Math.floor(x / CELL);
      const row = Math.floor(y / CELL);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
      if (grid[row][col] !== '.') return false;
      const cx = col * CELL + CELL / 2;
      const cy = row * CELL + CELL / 2;
      for (const t of state.tanks) {
        if (t.alive && circlesOverlap(cx, cy, CELL / 2, t.x, t.y, t.cfg.radius)) return false;
      }
      const wall = { x: col * CELL, y: row * CELL, w: CELL, h: CELL, type: 'trap', col, row, customDurability: hits };
      state.walls.push(wall);
      grid[row][col] = '#';
      state.sounds.push({ name: 'mine', x: cx });
      return wall;
    },
    destroyWall(wall) {
      // Transformation "Baumeister" (Phase 5): Waende halten wallDurability
      // Treffer statt einem -- der erste Treffer beschaedigt sie nur.
      // Sperrmauer (Phase 6), zerstoerbare Waende (Phase 11) und Reaktor-
      // Generatoren (Phase 14) bringen ihre eigene Haltbarkeit mit, die
      // das ueberschreibt.
      let durability = wall.customDurability || wall.destructibleHits || state.transform.wallDurability || 1;
      // Sappeur-Upgrade (Phase 18, Welle 3): rissige Waende (Phase 11)
      // fallen frueher. Bewusst NUR fuer `destructible` -- die eigene
      // Sperrmauer (customDurability) und die Pionier-Verstaerkung sollen
      // nicht gegen den Spieler selbst wirken.
      if (wall.type === 'destructible' && state.player?.cfg?.wallHitsReduction) {
        durability = Math.max(1, durability - state.player.cfg.wallHitsReduction);
      }
      if (durability > 1) {
        wall.hits = (wall.hits || 0) + 1;
        if (wall.hits < durability) {
          state.spawnParticles(
            wall.x + wall.w / 2,
            wall.y + wall.h / 2,
            wall.type === 'generator' ? '#ffd23c' : '#8a7355',
            3,
            60,
          );
          return; // beschaedigt, aber noch da
        }
      }
      const i = state.walls.indexOf(wall);
      if (i >= 0) state.walls.splice(i, 1);
      grid[wall.row][wall.col] = '.';
      // Steinbruch-Upgrade (Phase 18, Welle 3): eingerissene Waende lassen
      // Schrott zurueck. Nur die beiden "Wand geht kaputt"-Typen -- die
      // eigene Sperrmauer waere sonst eine Schrott-Druckmaschine (legen,
      // kaputtschiessen, wiederholen), Boss-Generatoren ein Sonderfall.
      const scrapPerWall = state.player?.cfg?.scrapPerWall || 0;
      if (scrapPerWall && (wall.type === 'destructible' || wall.type === 'breakable')) {
        state.bonusScrap += scrapPerWall;
      }
      // Reaktor-Generator (Phase 14): eigener Zaehler + deutliches Feedback --
      // sobald der letzte faellt, wird der Reaktorkern verwundbar.
      if (wall.type === 'generator') {
        state.bossGeneratorsLeft = Math.max(0, state.bossGeneratorsLeft - 1);
        state.sounds.push({ name: 'trickshot2', x: wall.x + wall.w / 2 });
        state.addShake(5);
        state.spawnParticles(wall.x + wall.w / 2, wall.y + wall.h / 2, '#ffd23c', 16, 200);
        state.texts.push({
          x: wall.x + wall.w / 2,
          y: wall.y + wall.h / 2 - 10,
          text:
            state.bossGeneratorsLeft > 0
              ? `Generator zerstört! (${state.bossGeneratorsLeft} übrig)`
              : 'Reaktor entsichert!',
          age: 0,
          life: 1.2,
          color: '#ffd23c',
        });
        return;
      }
      state.spawnParticles(wall.x + wall.w / 2, wall.y + wall.h / 2, '#8a7355', 6, 90);
    },
    // Spinnenboss (Abschnitt 21/22): generischer Wand-Ein-/Ausschalter, der
    // GRID (isSolid()/KI-Sichtlinien/Renderer lesen alle dasselbe grid) UND
    // state.walls synchron haelt -- dasselbe Grundmuster wie
    // tickMovingWalls() darunter, hier aber von AUSSEN (src/game/spider.js)
    // aufrufbar: einmalig fuer den kompletten Wandabriss beim Uebergang in
    // Phase 3, wiederholt fuer die zwei auf-/abfahrenden Saeulen danach.
    setWallSolid(col, row, solid) {
      const existing = walls.find((w) => w.col === col && w.row === row);
      if (solid) {
        if (existing) return existing;
        const w = { x: col * CELL, y: row * CELL, w: CELL, h: CELL, type: 'solid', col, row };
        walls.push(w);
        grid[row][col] = '#';
        return w;
      }
      if (existing) {
        const i = walls.indexOf(existing);
        if (i >= 0) walls.splice(i, 1);
      }
      grid[row][col] = '.';
      return null;
    },
    // G5 (t_mason): "Sicherung gegen Frust" -- true, wenn eine Wand auf
    // (col,row) irgendeine aktuell vom Spieler aus erreichbare Bodenzelle
    // abschneiden wuerde (ausser der Zielzelle selbst). Rein hypothetisch:
    // setzt das Grid-Zeichen kurz auf '#', vergleicht die Erreichbarkeits-
    // menge davor/danach, macht die Aenderung sofort wieder rueckgaengig.
    wouldIsolateArea(col, row) {
      const pCol = Math.floor(state.player.x / CELL);
      const pRow = Math.floor(state.player.y / CELL);
      const before = bfsReachable(grid, pCol, pRow);
      const prevCell = grid[row][col];
      grid[row][col] = '#';
      const after = bfsReachable(grid, pCol, pRow);
      grid[row][col] = prevCell;
      for (const k of before) {
        if (k === row * 1000 + col) continue; // die Zielzelle selbst faellt erwartungsgemaess weg
        if (!after.has(k)) return true;
      }
      return false;
    },
    // Bewegliche Wand (Phase 15): togglet alle `hazard.intervalS` Sekunden
    // zwischen solid und offen -- reiner add/remove eines 'solid'-Wand-
    // objekts, kein neuer Grid-Char noetig (isSolid()/hasLos() kennen '#'
    // und '.' bereits). Reversibel, anders als destroyWall().
    tickMovingWalls(dt) {
      if (!state.movingWalls.length) return;
      state.movingWallTimer -= dt;
      if (state.movingWallTimer > 0) return;
      state.movingWallTimer = state.hazard.intervalS;
      for (const mw of state.movingWalls) {
        if (mw.solid) {
          const i = state.walls.indexOf(mw.wallRef);
          if (i >= 0) state.walls.splice(i, 1);
          grid[mw.row][mw.col] = '.';
          mw.wallRef = null;
          mw.solid = false;
        } else {
          const w = { x: mw.x, y: mw.y, w: CELL, h: CELL, type: 'solid', col: mw.col, row: mw.row };
          state.walls.push(w);
          grid[mw.row][mw.col] = '#';
          mw.wallRef = w;
          mw.solid = true;
        }
      }
      // Dumpfer Ton als Bewegungs-Cue, geortet an der ersten bewegten Wand.
      state.sounds.push({ name: 'mine', x: state.movingWalls[0].x + CELL / 2 });
      state.addShake(2);
    },
  };
}
