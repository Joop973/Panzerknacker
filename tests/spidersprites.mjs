// Spinnenboss-Sprite-Test (dependency-frei, Node) -- Nutzergrafik-Nachtrag.
//
// Prueft die fuenf neuen Spinnenboss-Sprites (body_t_spider.png/
// turret_t_spider.png/spider_leg.png/body_spider_mine.png/spider_web.png,
// s. CLAUDE.md "Spinnenboss-Sprites"): sprites.js laedt sie mit den
// erwarteten Dateinamen, und spiderrender.js zeichnet bei ECHT geladenen
// Sprites tatsaechlich `drawImage(...)` statt der alten prozeduralen
// Linien/Kreise -- Muster wie tests/championsprite.mjs (der Fallback-Pfad
// bei FEHLENDEN Sprites ist bereits ueber tests/regression.mjs Abschnitt 66
// abgedeckt, dessen domstub-Image-Stub immer fehlschlaegt).
//
// tests/domstub.mjs installiert normalerweise einen ABSICHTLICH
// FEHLSCHLAGENDEN Image-Stub -- hier wie bei championsprite.mjs ein EIGENER,
// ERFOLGREICHER Stub VOR dem ersten Import von renderer.js/sprites.js
// (initSprites() laeuft nur einmal als Modul-Seiteneffekt).
//
// Gegenprobe (bestanden, je einzeln): 't_spider' aus TANK_TYPES entfernt ->
// Struktur-Check UND Body/Turret-Renderpfad-Checks rot; die
// sprite('spider','leg')-Abfrage in drawLegSprite()/drawSpiderBossLegs()
// durch `null` ersetzt -> Bein-Renderpfad-Check rot (faellt zurueck auf
// stroke()); dieselbe Ersetzung fuer 'mineBody' -> Minen-Koerper-Check rot;
// fuer 'web' -> Netz-Check rot; die Body-Rotationsformel `heading - PI/2`
// auf `heading + PI/2` geaendert -> der Winkel-Check unter (c) rot.

import { installDom } from './domstub.mjs';

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    console.error('FEHLER: ' + msg);
    failures++;
  }
}

const restore = installDom();

const loadedSrcs = [];
globalThis.Image = class {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
  }
  set src(v) {
    this._src = v;
    loadedSrcs.push(v);
    this.complete = true;
    // Realistische Seitenverhaeltnisse statt eines Quadrats: die
    // Bein-Skalierung (drawLegSprite) haengt an naturalWidth/-Height
    // getrennt, ein Quadrat wuerde einen Seitenverhaeltnis-Bug verstecken.
    if (v.includes('spider_leg')) {
      this.naturalWidth = 374;
      this.naturalHeight = 249;
    } else if (v.includes('turret_t_spider')) {
      this.naturalWidth = 473;
      this.naturalHeight = 233;
    } else if (v.includes('body_t_spider')) {
      this.naturalWidth = 369;
      this.naturalHeight = 521;
    } else if (v.includes('body_spider_mine')) {
      this.naturalWidth = 316;
      this.naturalHeight = 316;
    } else if (v.includes('spider_web')) {
      this.naturalWidth = 420;
      this.naturalHeight = 413;
    } else {
      this.naturalWidth = 64;
      this.naturalHeight = 64;
    }
    if (typeof this.onload === 'function') this.onload();
  }
  get src() {
    return this._src;
  }
};

const { sprite, SPRITES } = await import('../src/render/sprites.js');
// renderer.js loest initSprites() als Modul-SEITENEFFEKT beim Import aus
// (Muster wie tests/championsprite.mjs) -- spiderrender.js selbst ruft es
// nicht auf, importiert aber dieselbe sprites.js-Instanz.
await import('../src/render/renderer.js');
const { drawSpiderBossBody, drawSpiderBossLegs, drawSpiderMines, drawSpiderWebs } = await import('../src/render/spiderrender.js');
const { readFileSync } = await import('node:fs');
const { dirname, join } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (n) => JSON.parse(readFileSync(join(root, 'data', n + '.json'), 'utf8'));
const balance = load('balance');

// ---- (a) Struktur: sprites.js fordert die fuenf erwarteten Dateinamen an,
//      und sprite()/SPRITES liefern fuer alle fuenf ein geladenes Bild -----
{
  check(!!sprite('body', 't_spider'), 'Struktur: sprite("body","t_spider") liefert kein geladenes Bild');
  check(!!sprite('turret', 't_spider'), 'Struktur: sprite("turret","t_spider") liefert kein geladenes Bild');
  check(!!sprite('spider', 'leg'), 'Struktur: sprite("spider","leg") liefert kein geladenes Bild');
  check(!!sprite('spider', 'mineBody'), 'Struktur: sprite("spider","mineBody") liefert kein geladenes Bild');
  check(!!sprite('spider', 'web'), 'Struktur: sprite("spider","web") liefert kein geladenes Bild');
  check(
    loadedSrcs.some((s) => s.includes('body_t_spider.png')) &&
      loadedSrcs.some((s) => s.includes('turret_t_spider.png')) &&
      loadedSrcs.some((s) => s.includes('spider_leg.png')) &&
      loadedSrcs.some((s) => s.includes('body_spider_mine.png')) &&
      loadedSrcs.some((s) => s.includes('spider_web.png')),
    'Struktur: sprites.js fordert nicht alle fuenf erwarteten Spinnenboss-Dateinamen an',
  );
  check(Object.keys(SPRITES.spider).length === 3, `Struktur: SPRITES.spider hat ${Object.keys(SPRITES.spider).length} Eintraege statt 3`);
}

function makeSpiderTank() {
  return {
    alive: true,
    x: 300,
    y: 200,
    prevX: 300,
    prevY: 200,
    heading: 0,
    turret: 0,
    hp: 1800,
    cfg: { radius: 40, maxHp: 1800 },
    spiderVulnerableTimer: 0,
    spiderLegsAlive: 8,
    spiderLegs: [
      { slot: 1, alive: true, jointX: 330, jointY: 170, footX: 380, footY: 140, hp: 150, maxHp: 150 },
      { slot: 5, alive: true, jointX: 270, jointY: 230, footX: 220, footY: 260, hp: 80, maxHp: 150 },
      { slot: 3, alive: false, jointX: 0, jointY: 0, footX: 0, footY: 0, hp: 0, maxHp: 150 },
    ],
  };
}

// ---- (b) drawSpiderBossBody(): zeichnet body_t_spider/turret_t_spider ----
{
  const ctx = document.createElement('canvas').getContext('2d');
  const state = { time: 0, data: { balance }, spiderBoss: makeSpiderTank() };
  drawSpiderBossBody(ctx, state, 1);
  const drawn = ctx.calls.filter((c) => c.fn === 'drawImage').map((c) => c.args[0]);
  check(drawn.includes(sprite('body', 't_spider')), 'Renderpfad: drawSpiderBossBody() zeichnet nicht body_t_spider.png');
  check(drawn.includes(sprite('turret', 't_spider')), 'Renderpfad: drawSpiderBossBody() zeichnet nicht turret_t_spider.png');
  // Bei geladenem Sprite darf NICHT zusaetzlich noch der prozedurale
  // schwarze Kreiskoerper gezeichnet werden (arc() mit radius r, nicht der
  // duenne Verwundbarkeits-Ring bei r+6 -- den gibt es unveraendert weiter).
  const bodyArcCalls = ctx.calls.filter((c) => c.fn === 'arc' && Math.abs(c.args[2] - state.spiderBoss.cfg.radius * 2.4) < 0.01);
  check(bodyArcCalls.length === 0, 'Renderpfad: drawSpiderBossBody() zeichnet trotz geladenem Sprite noch den prozeduralen Koerperkreis');
}

// ---- (c) Body-Rotation: "heading - PI/2" (Front zeigt im Quellbild nach
//      unten), NICHT die allgemeine "+PI/2"-Konvention -------------------
{
  const ctx = document.createElement('canvas').getContext('2d');
  const tank = makeSpiderTank();
  tank.heading = 1.234;
  const state = { time: 0, data: { balance }, spiderBoss: tank };
  drawSpiderBossBody(ctx, state, 1);
  const rotateCalls = ctx.calls.filter((c) => c.fn === 'rotate').map((c) => c.args[0]);
  const expected = tank.heading - Math.PI / 2;
  check(
    rotateCalls.some((a) => Math.abs(a - expected) < 1e-9),
    `Rotation: kein rotate(heading-PI/2=${expected.toFixed(4)}) fuer den Koerper gefunden (gesehen: ${rotateCalls.map((a) => a.toFixed(4))})`,
  );
  // Der Turm rotiert dagegen direkt mit tank.turret (Standardkonvention
  // "Rohr zeigt nach rechts = Winkel 0"), nicht mit einem Offset.
  tank.turret = 0.55;
  ctx.calls.length = 0;
  drawSpiderBossBody(ctx, state, 1);
  const rotateCalls2 = ctx.calls.filter((c) => c.fn === 'rotate').map((c) => c.args[0]);
  check(
    rotateCalls2.some((a) => Math.abs(a - tank.turret) < 1e-9),
    `Rotation: kein rotate(turret=${tank.turret}) fuer den Turm gefunden (gesehen: ${rotateCalls2.map((a) => a.toFixed(4))})`,
  );
}

// ---- (d) drawSpiderBossLegs(): zeichnet spider_leg.png je LEBENDEM Bein,
//      keins fuer ein totes -----------------------------------------------
{
  const ctx = document.createElement('canvas').getContext('2d');
  const state = { time: 0, data: { balance }, spiderBoss: makeSpiderTank() };
  drawSpiderBossLegs(ctx, state);
  const drawn = ctx.calls.filter((c) => c.fn === 'drawImage').map((c) => c.args[0]);
  const legImg = sprite('spider', 'leg');
  const aliveCount = state.spiderBoss.spiderLegs.filter((l) => l.alive).length;
  check(drawn.filter((img) => img === legImg).length === aliveCount, `Renderpfad: drawSpiderBossLegs() zeichnet ${drawn.filter((img) => img === legImg).length} Bein-Sprites statt ${aliveCount} (lebende Beine)`);
  // Kein prozeduraler stroke() mehr fuer die Beinlinien selbst (die
  // Lebensbalken nutzen fillRect, nicht stroke -- ein reiner stroke()-Check
  // bleibt also eindeutig).
  check(ctx.calls.filter((c) => c.fn === 'stroke').length === 0, 'Renderpfad: drawSpiderBossLegs() zeichnet trotz geladenem Sprite noch prozedurale Bein-Linien (stroke())');
}

// ---- (e) drawSpiderMines(): zeichnet body_spider_mine.png + acht
//      spider_leg.png je Mine ----------------------------------------------
{
  const ctx = document.createElement('canvas').getContext('2d');
  const state = {
    time: 0,
    data: { balance },
    spiderMines: [{ id: 1, dead: false, x: 100, y: 100, radius: 12, spiderState: 'active' }],
  };
  drawSpiderMines(ctx, state);
  const drawn = ctx.calls.filter((c) => c.fn === 'drawImage').map((c) => c.args[0]);
  check(drawn.includes(sprite('spider', 'mineBody')), 'Renderpfad: drawSpiderMines() zeichnet nicht body_spider_mine.png');
  check(drawn.filter((img) => img === sprite('spider', 'leg')).length === 8, `Renderpfad: drawSpiderMines() zeichnet ${drawn.filter((img) => img === sprite('spider', 'leg')).length} Bein-Sprites statt 8`);
}

// ---- (f) drawSpiderWebs(): zeichnet spider_web.png statt der acht
//      prozeduralen Speichen ------------------------------------------------
{
  const ctx = document.createElement('canvas').getContext('2d');
  const state = {
    time: 0,
    data: { balance },
    spiderWebs: [{ dead: false, x: 150, y: 150, hp: 15, maxHp: 20 }],
  };
  drawSpiderWebs(ctx, state);
  const drawn = ctx.calls.filter((c) => c.fn === 'drawImage').map((c) => c.args[0]);
  check(drawn.includes(sprite('spider', 'web')), 'Renderpfad: drawSpiderWebs() zeichnet nicht spider_web.png');
  check(ctx.calls.filter((c) => c.fn === 'stroke').length === 0, 'Renderpfad: drawSpiderWebs() zeichnet trotz geladenem Sprite noch prozedurale Speichen/Ringe (stroke())');
}

if (failures) {
  console.error(`\n${failures} Spinnenboss-Sprite-Pruefung(en) fehlgeschlagen.`);
  restore();
  process.exit(1);
}
restore();
console.log('Alle Spinnenboss-Sprite-Tests bestanden.');
