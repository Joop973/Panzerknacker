// 2D-Dungeon-Generator (Phase DG1): ein Akt ist ein Raster aus Raeumen
// (jeder Raum eine 24x16-Arena), verbunden ueber Tueren N/O/S/W. Reine
// Funktion (seed/diff/actIndex -> Dungeon), kein Run-Objekt noetig; noch an
// keinen Spielablauf angeschlossen (kommt in DG2). Eigener RNG-Strom pro Akt.
import { rngForRun } from '../core/rng.js';

const DIRS = [
  { k: 'n', dx: 0, dy: -1, opp: 's' },
  { k: 'e', dx: 1, dy: 0, opp: 'w' },
  { k: 's', dx: 0, dy: 1, opp: 'n' },
  { k: 'w', dx: -1, dy: 0, opp: 'e' },
];
const EARLY_EXCLUDED = new Set(['elite', 'cursed', 'workshop']);

// Stabiler RNG-Schluessel eines Raums (ersetzt die lineare Raumnummer
// run.js: actRoomKey() fuer die Strom-Ableitung).
export function dungeonRoomKey(actIndex, room) {
  return (actIndex - 1) * 1000 + room.id + 1;
}

function pickWeighted(list, weights, rng) {
  let total = 0;
  for (const t of list) total += weights[t] || 0;
  let r = rng() * total;
  for (const t of list) {
    r -= weights[t] || 0;
    if (r < 0) return t;
  }
  return list[list.length - 1];
}

function bfs(rooms, fromId) {
  const dist = new Map([[fromId, 0]]);
  const prev = new Map();
  const queue = [fromId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const n of rooms.get(id).links) {
      if (!dist.has(n)) {
        dist.set(n, dist.get(id) + 1);
        prev.set(n, id);
        queue.push(n);
      }
    }
  }
  return { dist, prev };
}

// Ein Versuch; null, wenn eine harte Garantie nicht erfuellbar war.
function attempt(rng, diff, cfg, total) {
  const { cols, rows } = cfg;
  const idOf = (x, y) => y * cols + x;
  const rooms = new Map();
  const add = (x, y) => {
    const id = idOf(x, y);
    rooms.set(id, { id, x, y, links: new Set(), type: null, isBoss: false, isStart: false });
    return id;
  };
  // Start am linken Rand, Wachstum als Zufallsbaum.
  const startId = add(0, Math.floor(rng() * rows));
  const freeNeighbors = (r) => DIRS
    .map((d) => ({ d, x: r.x + d.dx, y: r.y + d.dy }))
    .filter((c) => c.x >= 0 && c.y >= 0 && c.x < cols && c.y < rows && !rooms.has(idOf(c.x, c.y)));
  let guard = 0;
  while (rooms.size < total && guard++ < 5000) {
    const list = [...rooms.values()];
    const from = list[Math.floor(rng() * list.length)];
    const free = freeNeighbors(from);
    if (!free.length) continue;
    const c = free[Math.floor(rng() * free.length)];
    const nid = add(c.x, c.y);
    from.links.add(nid);
    rooms.get(nid).links.add(from.id);
  }
  if (rooms.size < total) return null;

  // Boss: weitester Raum, der eine Sackgasse ist (ein Nachbar).
  const fromStart = bfs(rooms, startId);
  let bossId = null;
  for (const [id, d] of fromStart.dist) {
    if (id === startId || rooms.get(id).links.size !== 1) continue;
    if (bossId === null || d > fromStart.dist.get(bossId) || (d === fromStart.dist.get(bossId) && rng() < 0.5)) bossId = id;
  }
  if (bossId === null || fromStart.dist.get(bossId) < cfg.minBossDist) return null;

  // Zusatzkanten (Schleifen) zwischen benachbarten Raeumen, nie am Boss/Start.
  for (const r of rooms.values()) {
    for (const d of DIRS.slice(0, 2)) { // n/e reicht, jede Kante einmal
      const o = rooms.get(idOf(r.x + d.dx, r.y + d.dy));
      if (!o || r.links.has(o.id) || r.id === bossId || o.id === bossId) continue;
      if (rng() < cfg.extraEdgeChance) {
        r.links.add(o.id);
        o.links.add(r.id);
      }
    }
  }

  const { dist, prev } = bfs(rooms, startId);
  // Nach den Schleifen neu pruefen: Boss muss weiterhin der weiteste Raum sein.
  const maxD = Math.max(...dist.values());
  if (dist.get(bossId) < maxD || dist.get(bossId) < cfg.minBossDist) return null;
  const bossRoom = rooms.get(bossId);
  const preBossId = [...bossRoom.links][0];
  // Kuerzester Weg Start->Boss.
  const onPath = new Set([bossId]);
  for (let c = bossId; c !== startId; c = prev.get(c)) onPath.add(prev.get(c));
  if (rooms.size - onPath.size < cfg.minOffPath) return null;

  rooms.get(startId).isStart = true;
  rooms.get(startId).type = 'start';
  bossRoom.isBoss = true;
  bossRoom.type = 'combat';
  const pre = rooms.get(preBossId);
  pre.type = 'rest';

  // Schatzkammer: Sackgasse (nicht Start/Boss/Vor-Boss), sonst neuer Versuch.
  const mid = [...rooms.values()].filter((r) => r.type === null);
  const tPool = mid.filter((r) => r.links.size === 1);
  if (!tPool.length) return null;
  const treasure = tPool[Math.floor(rng() * tPool.length)];
  treasure.type = 'treasure';

  // Shop: Tiefe > earlyDepth, bevorzugt abseits des Wegs.
  const shopCands = mid.filter((r) => r.type === null && dist.get(r.id) > cfg.earlyDepth);
  if (!shopCands.length) return null;
  const offPath = shopCands.filter((r) => !onPath.has(r.id));
  const sPool = offPath.length ? offPath : shopCands;
  sPool[Math.floor(rng() * sPool.length)].type = 'workshop';

  // Rest: ein weiterer Rastplatz abseits von Nachbarn mit Rast.
  const restCands = mid.filter((r) => r.type === null && dist.get(r.id) > cfg.earlyDepth
    && ![...r.links].some((n) => rooms.get(n).type === 'rest'));
  if (restCands.length) restCands[Math.floor(rng() * restCands.length)].type = 'rest';

  // Rest: gewichtete Zufallstypen.
  const weights = diff.map.nodeWeights;
  const typeKeys = Object.keys(weights).filter((t) => t !== 'rest' && t !== 'workshop');
  const early = typeKeys.filter((t) => !EARLY_EXCLUDED.has(t));
  for (const r of rooms.values()) {
    if (r.type !== null) continue;
    r.type = pickWeighted(dist.get(r.id) <= cfg.earlyDepth ? early : typeKeys, weights, rng);
  }

  // Ausgabe: Tueren je Richtung.
  const out = [];
  for (const r of rooms.values()) {
    const doors = { n: null, e: null, s: null, w: null };
    for (const d of DIRS) {
      const o = rooms.get(idOf(r.x + d.dx, r.y + d.dy));
      if (o && r.links.has(o.id)) doors[d.k] = o.id;
    }
    out.push({ id: r.id, x: r.x, y: r.y, type: r.type, isBoss: r.isBoss, isStart: r.isStart, dist: dist.get(r.id), doors });
  }
  return { cols, rows, rooms: out, startId, bossId };
}

export function generateDungeon(seed, diff, actIndex) {
  const rng = rngForRun(seed, `dungeon_act${actIndex}`);
  const cfg = { cols: 6, rows: 4, extraEdgeChance: 0.25, minOffPath: 3, minBossDist: 6, earlyDepth: 2, maxAttempts: 60, ...(diff.dungeon || {}) };
  const total = diff.acts[actIndex - 1].rooms + 1;
  for (let i = 0; i < cfg.maxAttempts; i++) {
    const d = attempt(rng, diff, cfg, total);
    if (d) {
      d.byId = new Map(d.rooms.map((r) => [r.id, r]));
      d.attempts = i + 1;
      return d;
    }
  }
  throw new Error(`generateDungeon: keine gueltige Anordnung (seed ${seed}, Akt ${actIndex})`);
}
