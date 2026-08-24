// Spinnenminen (Spinnenboss-Auftrag, Abschnitte 14-17). Baut bewusst AUF
// src/game/mine.js AUF statt eines zweiten Explosionssystems: createMine()
// liefert das gemeinsame Objekt (id/x/y/radius/owner), explodeAt() bleibt
// die EINE Stelle, die tatsaechlich zuendet (Partikel/Ton/Wandschaden/
// Kettenreaktion normaler Minen unveraendert). Nur die LEBENSZYKLUS- und
// BEWEGUNGSlogik ist eigenstaendig -- eine normale Mine kennt weder eine
// 1,5s-Spawnphase am Boss noch eine 12s-Verfolgung durch ein Labyrinth,
// das in die bestehende updateMines()-Schleife zu pressen haette diese
// fuer JEDE normale Mine verkompliziert (Abschnitt 30: bestehende Minen
// duerfen nicht angefasst werden). state.spiderMines ist deshalb ein
// EIGENES Array, getrennt von state.mines -- keine ungewollte Kettenreaktion
// mit normalen Minen in beide Richtungen.
import { CELL, COLS, ROWS } from '../config.js';
import { createMine, explodeAt } from './mine.js';
import { circlesOverlap } from './collision.js';
import { damageSpiderLegsInRadius } from './spider.js';

// Gemeinsames Distanzfeld vom SPIELER aus (Abschnitt 17: "Da mehrere Minen
// haeufig dasselbe Ziel verfolgen, ist ein gemeinsames Distanzfeld eine
// sinnvolle Loesung"). 4-direktionale BFS -- schneidet dadurch von selbst
// keine diagonal gesperrten Ecken. Neu gebaut hoechstens alle repathS
// Sekunden ODER sofort, wenn der Spieler die Rasterzelle gewechselt hat.
function rebuildFlowField(state) {
  const p = state.player;
  const startCol = Math.max(0, Math.min(COLS - 1, Math.floor(p.x / CELL)));
  const startRow = Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / CELL)));
  const dist = new Int16Array(COLS * ROWS).fill(-1);
  const idx = (c, r) => r * COLS + c;
  dist[idx(startCol, startRow)] = 0;
  const queue = [[startCol, startRow]];
  let head = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < queue.length) {
    const [c, r] = queue[head++];
    const d = dist[idx(c, r)];
    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      if (dist[idx(nc, nr)] !== -1) continue;
      if (state.isSolid(nc * CELL + CELL / 2, nr * CELL + CELL / 2)) continue;
      dist[idx(nc, nr)] = d + 1;
      queue.push([nc, nr]);
    }
  }
  state.spiderFlowField = { dist, startCol, startRow, timer: 0 };
  return state.spiderFlowField;
}

function ensureFlowField(state, repathS) {
  const p = state.player;
  const col = Math.max(0, Math.min(COLS - 1, Math.floor(p.x / CELL)));
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / CELL)));
  const ff = state.spiderFlowField;
  if (!ff || ff.timer <= 0 || ff.startCol !== col || ff.startRow !== row) {
    return rebuildFlowField(state);
  }
  return ff;
}

// Naechste, im Feld erreichbare freie Zelle -- Abschnitt 17: eine Mine darf
// beim Uebergang in die aktive Phase nicht in einer Wand/unerreichbar
// erscheinen, falls der Boss sie ueber einer inneren Wand ausgesetzt hat
// (er kann selbst ueber Waende klettern, die Mine nicht).
function nearestFreeCell(state, ff, px, py) {
  const col0 = Math.max(0, Math.min(COLS - 1, Math.floor(px / CELL)));
  const row0 = Math.max(0, Math.min(ROWS - 1, Math.floor(py / CELL)));
  if (!state.isSolid(col0 * CELL + CELL / 2, row0 * CELL + CELL / 2)) return { x: px, y: py };
  let best = null;
  let bestD = Infinity;
  for (let r = Math.max(0, row0 - 3); r <= Math.min(ROWS - 1, row0 + 3); r++) {
    for (let c = Math.max(0, col0 - 3); c <= Math.min(COLS - 1, col0 + 3); c++) {
      const idx = r * COLS + c;
      if (ff.dist[idx] < 0) continue; // nicht erreichbar
      const dc = c - col0;
      const dr = r - row0;
      const d2 = dc * dc + dr * dr;
      if (d2 < bestD) {
        bestD = d2;
        best = { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
      }
    }
  }
  return best || { x: px, y: py };
}

// Bewegungsrichtung: der Nachbar mit dem kleinsten Feldwert gewinnt, Ziel
// ist dessen Zellmitte (nicht nur die reine Achsenrichtung) -- das ergibt
// eine optisch weiche, leicht diagonale Bewegung zwischen Rasterpunkten,
// statt hart von Zellmitte zu Zellmitte zu springen.
function stepDirection(state, ff, m) {
  const col = Math.max(0, Math.min(COLS - 1, Math.floor(m.x / CELL)));
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(m.y / CELL)));
  const idx = (c, r) => r * COLS + c;
  const here = ff.dist[idx(col, row)];
  // Zielzelle selbst erreicht: direkt auf den Spieler zu, kein Zellwechsel-
  // Gezappel mehr am Ziel.
  if (col === ff.startCol && row === ff.startRow) {
    const p = state.player;
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }
  let bestC = col;
  let bestR = row;
  let bestD = here < 0 ? Infinity : here;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dc, dr] of dirs) {
    const nc = col + dc;
    const nr = row + dr;
    if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
    const d = ff.dist[idx(nc, nr)];
    if (d >= 0 && d < bestD) {
      bestD = d;
      bestC = nc;
      bestR = nr;
    }
  }
  const tx = bestC * CELL + CELL / 2;
  const ty = bestR * CELL + CELL / 2;
  const dx = tx - m.x;
  const dy = ty - m.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

// Einfache Achsen-getrennte Wandaufloesung (Minen sind klein -- kein
// Panzer-Kollisionsradius noetig): erst voll versuchen, sonst je Achse.
function moveAvoidingWalls(state, m, dx, dy) {
  const nx = m.x + dx;
  const ny = m.y + dy;
  if (!state.isSolid(nx, ny)) {
    m.x = nx;
    m.y = ny;
    return;
  }
  if (!state.isSolid(nx, m.y)) {
    m.x = nx;
    return;
  }
  if (!state.isSolid(m.x, ny)) {
    m.y = ny;
  }
}

// Neue Spinnenmine in der Spawnphase -- bleibt bis mine.spawnS am Boss
// (Abschnitt 15), von Anfang an beschiessbar.
export function spawnSpiderMine(state, owner) {
  const mcfg = state.data.balance.boss.spider.mine;
  const m = createMine(owner.x, owner.y, owner, mcfg.spawnRadiusPx);
  m.isSpiderMine = true;
  m.spiderState = 'spawn';
  m.spawnAge = 0;
  m.chaseAge = 0;
  state.spiderMines = state.spiderMines || [];
  state.spiderMines.push(m);
  return m;
}

function friendlyBulletHitsMine(state, m) {
  for (const b of state.bullets) {
    if (b.dead) continue;
    if (b.owner === m.owner || b.owner?.type === 't_spider') continue; // eigenes Team trifft die Mine nicht aus Versehen
    if (circlesOverlap(m.x, m.y, m.radius, b.x, b.y, b.radius)) {
      b.dead = true;
      return true;
    }
  }
  return false;
}

function touchesLivingTarget(state, m) {
  const targets = [state.player, ...state.ghosts.filter((g) => g.alive)];
  for (const t of targets) {
    if (!t || !t.alive) continue;
    if (circlesOverlap(m.x, m.y, m.radius, t.x, t.y, t.cfg?.radius ?? 12)) return true;
  }
  return false;
}

export function updateSpiderMines(state, dt) {
  const mines = state.spiderMines;
  if (!mines || !mines.length) return;
  const mcfg = state.data.balance.boss.spider.mine;
  let ff = null;
  for (const m of mines) {
    if (m.dead) continue;
    if (m.spiderState === 'spawn') {
      // Folgt dem Boss, bis die Spawnphase abgelaufen ist (Abschnitt 15).
      if (m.owner?.alive) {
        m.x = m.owner.x;
        m.y = m.owner.y;
      }
      m.spawnAge += dt;
      if (friendlyBulletHitsMine(state, m)) {
        detonateSpiderMine(state, m, true);
        continue;
      }
      if (m.spawnAge >= mcfg.spawnS) {
        ff = ff || ensureFlowField(state, mcfg.repathS);
        const free = nearestFreeCell(state, ff, m.x, m.y);
        m.x = free.x;
        m.y = free.y;
        m.spiderState = 'active';
        m.chaseAge = 0;
      }
      continue;
    }
    // Aktive Verfolgungsphase (Abschnitt 16/17).
    ff = ff || ensureFlowField(state, mcfg.repathS);
    m.chaseAge += dt;
    if (m.chaseAge >= mcfg.chaseDurationS) {
      detonateSpiderMine(state, m, false);
      continue;
    }
    if (friendlyBulletHitsMine(state, m)) {
      detonateSpiderMine(state, m, false);
      continue;
    }
    if (touchesLivingTarget(state, m)) {
      detonateSpiderMine(state, m, false);
      continue;
    }
    const speed = m.owner?.spiderPhaseCfg?.mineChaseSpeedPxS ?? 85;
    const dir = stepDirection(state, ff, m);
    moveAvoidingWalls(state, m, dir.x * speed * dt, dir.y * speed * dt);
  }
  if (ff) ff.timer = mcfg.repathS;
  else if (state.spiderFlowField) state.spiderFlowField.timer -= dt;
  state.spiderMines = mines.filter((m) => !m.dead);
}

// Zuendet eine Spinnenmine ueber den bestehenden explodeAt()-Helfer.
// isSpawnPhase=true traegt meta.code='spider_spawn_mine' -- die EINE
// ausdrueckliche Ausnahme, die den sonst geschuetzten Bosskoerper trifft
// (state.js: applyDamage()s spiderBoss-Gatter laesst genau diesen Code
// durch, Abschnitt 15/26).
export function detonateSpiderMine(state, m, isSpawnPhase) {
  if (m.dead) return;
  m.dead = true;
  const mcfg = state.data.balance.boss.spider.mine;
  const R = isSpawnPhase ? mcfg.spawnRadiusPx : mcfg.activeRadiusPx;
  const dmg = isSpawnPhase ? mcfg.spawnDamage : mcfg.activeDamage;
  const meta = { code: isSpawnPhase ? 'spider_spawn_mine' : 'spider_mine', killer: m.owner };
  explodeAt(state, m.x, m.y, R, null, meta, dmg);
  // explodeAt() iteriert nur state.tanks (Spieler + echte Gegner) -- Geister
  // und der Champion leben getrennt in state.ghosts (Abschnitt 16 verlangt
  // ausdruecklich, dass eine Explosion auch SIE trifft). state.js stellt dafuer
  // einen kleinen, eigenen Helfer bereit, der dieselbe Resistenz-/Schildpool-
  // Kette wie die bestehende Geist-Kollisionsschleife nutzt.
  state.damageGhostsInRadius?.(m.x, m.y, R, dmg);
  // Abschnitt 26 ("Flaechenschaden kann mehrere tatsaechlich betroffene
  // Beine treffen"): eine Spawnphasen-Mine detoniert direkt am Boss und
  // trifft dadurch fast immer mehrere Beine gleichzeitig.
  damageSpiderLegsInRadius(state, m.x, m.y, R, dmg);
}
