// Champion-Sprite/-Aura-Test (dependency-frei, Node).
//
// Prueft die Nutzergrafik fuer den Champion (body_champion.png/
// turret_champion.png + 12-Frame-Aura-Loop champion_aura_00..11.png,
// Nachtrag zum Champion-Nachschliff): src/render/sprites.js laedt genau 12
// Aura-Frames + das Champion-Sprite-Paar, championAuraFrame() indiziert mit
// Wraparound, und renderer.js: drawGhosts() zeichnet fuer g.isChampion=true
// tatsaechlich das Champion-Sprite + einen loopenden Aura-Frame statt des
// gemeinsamen Geister-Sprites -- inklusive des dauerhaften Loops (Auftrag:
// "die Animation soll dauerhaft im Loop laufen").
//
// tests/domstub.mjs installiert normalerweise einen ABSICHTLICH
// FEHLSCHLAGENDEN Image-Stub (kein Netz im Test) -- sprites.js faellt dann
// ueberall auf die prozeduralen Formen zurueck, das ist fuer DIESEN Test
// aber gerade der blinde Fleck: ob die Sprites bei ECHTEM Laden wirklich
// gezeichnet werden, war bislang nirgends geprueft. Deshalb hier ein
// EIGENER, ERFOLGREICHER Image-Stub -- und weil src/render/renderer.js
// initSprites() als Modul-SEITENEFFEKT beim ersten Import ausloest (danach
// bleibt sprites.js wegen eines internen "started"-Deckels stumm), muss
// dieser Stub VOR dem ersten Import von renderer.js stehen. Deshalb ein
// EIGENES Testfile statt eines Abschnitts in regression.mjs (dort waeren
// renderer.js/sprites.js laengst mit dem fehlschlagenden Stub geladen).
//
// Gegenprobe (bestanden, je einzeln): CHAMPION_AURA_FRAME_COUNT auf 6
// gesetzt -> Struktur-Check rot; useChampionSprite-Bedingung in
// drawGhosts() auf "immer false" gesetzt -> Sprite-Wahl-Checks rot;
// CHAMPION_AURA_FPS auf 0 gesetzt -> Loop-Check rot (immer derselbe Frame).

import { installDom } from './domstub.mjs';

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    console.error('FEHLER: ' + msg);
    failures++;
  }
}

const restore = installDom();

// Domstub installiert einen Image-Stub, der IMMER onerror auslöst (kein
// Netz im Test). Wir ersetzen ihn hier durch einen ERFOLGREICHEN Stub,
// BEVOR renderer.js zum ersten Mal importiert wird -- initSprites() läuft
// dann mit diesem Stub und lädt "erfolgreich".
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
    this.naturalWidth = 64;
    this.naturalHeight = 64;
    if (typeof this.onload === 'function') this.onload();
  }
  get src() {
    return this._src;
  }
};

const { sprite, championAuraFrame, SPRITES, CHAMPION_AURA_FRAME_COUNT } = await import('../src/render/sprites.js');
const { createRenderer } = await import('../src/render/renderer.js');
const { createTracks } = await import('../src/render/tracks.js');
const { createState } = await import('../src/game/state.js');
const { createGhost, pushGhost } = await import('../src/game/ghost.js');
const { rngFor, hashSeed } = await import('../src/core/rng.js');
const { readFileSync } = await import('node:fs');
const { dirname, join } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (n) => JSON.parse(readFileSync(join(root, 'data', n + '.json'), 'utf8'));
const tanksData = load('tanks');
const tilesData = load('tiles');
const upgradesData = load('upgrades');
tanksData.balance = load('balance');
tanksData.arenas = load('arenas');
tanksData.limits = load('limits');
tanksData.sounds = load('sounds');
tanksData.status = load('status');
tanksData.modifiers = load('modifiers');

// ---- (a) Struktur: sprites.js laedt genau 12 Aura-Frames + das
//      Champion-Sprite-Paar -------------------------------------------------
{
  check(CHAMPION_AURA_FRAME_COUNT === 12, `Struktur: CHAMPION_AURA_FRAME_COUNT ist ${CHAMPION_AURA_FRAME_COUNT} statt 12`);
  const auraKeys = Object.keys(SPRITES.championAura);
  check(auraKeys.length === 12, `Struktur: ${auraKeys.length} Aura-Frames geladen statt 12`);
  for (let i = 0; i < 12; i++) {
    const key = String(i).padStart(2, '0');
    check(auraKeys.includes(key), `Struktur: Aura-Frame "${key}" fehlt`);
    check(!!championAuraFrame(i), `Struktur: championAuraFrame(${i}) liefert kein geladenes Bild`);
  }
  check(!!sprite('body', 'champion'), 'Struktur: sprite("body","champion") liefert kein geladenes Bild');
  check(!!sprite('turret', 'champion'), 'Struktur: sprite("turret","champion") liefert kein geladenes Bild');
  check(
    loadedSrcs.some((s) => s.includes('champion_aura_00.png')) &&
      loadedSrcs.some((s) => s.includes('body_champion.png')) &&
      loadedSrcs.some((s) => s.includes('turret_champion.png')),
    'Struktur: sprites.js fordert nicht die erwarteten Champion-Dateinamen an',
  );
}

// ---- (b) championAuraFrame() indiziert mit Wraparound ---------------------
{
  check(championAuraFrame(0) === championAuraFrame(12), 'Wraparound: Frame 12 ist nicht Frame 0');
  check(championAuraFrame(5) === championAuraFrame(17), 'Wraparound: Frame 17 ist nicht Frame 5');
  check(championAuraFrame(-1) === championAuraFrame(11), 'Wraparound: Frame -1 ist nicht Frame 11 (negativer Index)');
  check(championAuraFrame(0) !== championAuraFrame(1), 'Wraparound: Frame 0 und 1 liefern dasselbe Bild (keine echten 12 Frames?)');
}

// ---- (c)+(d) Renderpfad: drawGhosts() nutzt fuer g.isChampion=true das
//      Champion-Sprite + einen Aura-Frame -- NICHT das gemeinsame
//      Geister-Sprite. Fuer g.isChampion=false weiterhin das Geister-Sprite,
//      KEIN Aura-Frame. Beides ueber den ECHTEN renderer.js: render()
//      geprueft (dieselbe Fehlerklasse wie beim Ziellinien-Crash: ein reiner
//      "crasht nicht"-Test haette das hier nicht gefangen).
{
  const ctx = document.createElement('canvas').getContext('2d');
  const renderer = createRenderer(ctx);
  const tracks = createTracks();
  const st = createState(tanksData, tilesData, {
    genRng: rngFor(1, 3, 'rooms'),
    enemyTypes: ['t_pink'],
    aiSeed: hashSeed(1, 3, 'ai'),
    playerUpgrades: {},
    upgradesData,
    equippedSecondary: 'mine',
    transform: {},
    starterTank: 'c_necro',
    actEnemyPool: ['t_pink'],
  });
  const g = createGhost(st, 100, 100, 0, 't_pink');
  pushGhost(st, g);

  const drawImageArgsFor = (isChampion, time) => {
    st.time = time;
    g.isChampion = isChampion;
    ctx.calls.length = 0;
    renderer.render(st, 0, tracks, null, null);
    return ctx.calls.filter((c) => c.fn === 'drawImage').map((c) => c.args[0]);
  };

  const champBody = sprite('body', 'champion');
  const champTur = sprite('turret', 'champion');
  const ghostBody = sprite('body', 'ghost');
  const ghostTur = sprite('turret', 'ghost');
  const aura0 = championAuraFrame(0);

  const withChampion = drawImageArgsFor(true, 0);
  check(withChampion.includes(champBody), 'Renderpfad: isChampion=true zeichnet nicht body_champion.png');
  check(withChampion.includes(champTur), 'Renderpfad: isChampion=true zeichnet nicht turret_champion.png');
  check(withChampion.includes(aura0), 'Renderpfad: isChampion=true zeichnet keinen Aura-Frame');
  check(!withChampion.includes(ghostBody), 'Renderpfad: isChampion=true zeichnet trotzdem noch body_ghost.png');
  check(!withChampion.includes(ghostTur), 'Renderpfad: isChampion=true zeichnet trotzdem noch turret_ghost.png');

  const withoutChampion = drawImageArgsFor(false, 0);
  check(withoutChampion.includes(ghostBody), 'Renderpfad: isChampion=false zeichnet nicht body_ghost.png');
  check(withoutChampion.includes(ghostTur), 'Renderpfad: isChampion=false zeichnet nicht turret_ghost.png');
  check(!withoutChampion.includes(champBody), 'Renderpfad: isChampion=false zeichnet trotzdem body_champion.png');
  check(!withoutChampion.some((img) => Object.values(SPRITES.championAura).includes(img)), 'Renderpfad: isChampion=false zeichnet trotzdem einen Aura-Frame');

  // ---- (e) die Aura-Animation LOOPT dauerhaft: unterschiedliche
  //      Zeitpunkte innerhalb einer Sekunde zeigen unterschiedliche Frames,
  //      und nach einer vollen Sekunde (12 Frames bei 12 fps) wiederholt sich
  //      exakt derselbe Frame wie zu Beginn dieser Sekunde -- "dauerhaft im
  //      Loop" heisst auch: es bleibt nicht irgendwann auf einem Frame
  //      stehen. Zeitpunkte bewusst auf Frame-MITTE gelegt (i+0.5)/12 statt
  //      exakt auf die Grenze i/12, sonst koennte Gleitkomma-Rundung
  //      (11/12*12 wird nicht exakt 11.0) den falschen Frame-Index treffen.
  const frameAt = (t) => drawImageArgsFor(true, t).find((img) => Object.values(SPRITES.championAura).includes(img));
  const f0 = frameAt(0.5 / 12);
  const f1 = frameAt(1.5 / 12);
  const f6 = frameAt(6.5 / 12);
  const f11 = frameAt(11.5 / 12);
  check(new Set([f0, f1, f6, f11]).size === 4, 'Loop: vier ueber die Sekunde verteilte Zeitpunkte zeigen nicht vier verschiedene Aura-Frames');
  const f0Wrapped = frameAt(1 + 0.5 / 12);
  const f1Wrapped = frameAt(1 + 1.5 / 12);
  check(f0 === f0Wrapped, 'Loop: eine volle Sekunde spaeter ist nicht wieder derselbe Frame wie zu Beginn (Frame 0)');
  check(f1 === f1Wrapped, 'Loop: eine volle Sekunde spaeter ist nicht wieder derselbe Frame wie zu Beginn (Frame 1)');
}

if (failures) {
  console.error(`\n${failures} Champion-Sprite-Pruefung(en) fehlgeschlagen.`);
  restore();
  process.exit(1);
}
restore();
console.log('Alle Champion-Sprite-Tests bestanden.');
