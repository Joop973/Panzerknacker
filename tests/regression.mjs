// Eingecheckte Regressionssuite (ersetzt die frueheren, nur session-lokalen
// phase*.mjs-Dateien, die nie im Repo lagen).
//
// Aufruf:  node tests/regression.mjs
//
// Prueft:
//  1. Ziellinie (traceTrajectory) crasht nicht an Sperrmauer/zerstoerbarer
//     Wand/Generator-Wand (Bugfix: Schatten-State hat kein destroyWall).
//  2. Fuenf Seeds laufen deterministisch ueber alle 16 Raeume bis zum Sieg
//     (Cheat-Kill, wie die frueheren Suiten) -- inklusive Karte, Shop,
//     Events, Boss (Generatoren werden vorher abgeraeumt).
//  3. Ein Raum gilt NIE als geraeumt, solange eine zweite Welle aussteht
//     (Bugfix: Kill der letzten Welle-1-Gegner waehrend der Vorwarnung).
//  4. Determinismus: gleicher Seed -> gleiche Karte und gleiches Raumlayout.
//  5. Audio (Phase 7b): jeder im Code gemeldete Sound-Name hat einen Eintrag
//     in data/sounds.json (sonst ist das Ereignis stumm), jede Meldung ist
//     wohlgeformt, und der Minen-Warnpuls tickt im vorgesehenen Takt.
//  6. Kartenpool (Phase 17/18): jede Transformation ist mit den vorhandenen
//     Karten ueberhaupt freischaltbar, und jede einzelne Karte laesst sich
//     ohne NaN/undefined in ein Spieler-cfg aufloesen.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRun, stepRun, chooseUpgrade, enterRoom, chooseMapNode, leaveWorkshop, chooseEventOption } from '../src/game/run.js';
import { traceTrajectory } from '../src/game/bullet.js';
import { validateArenas } from '../src/game/generator.js';
import { createMine, updateMines } from '../src/game/mine.js';
import { resolveCfg, applyUpgrades } from '../src/game/cfg.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (n) => JSON.parse(readFileSync(join(root, 'data', n + '.json'), 'utf8'));

const tanksData = load('tanks');
const tilesData = load('tiles');
const diffData = load('difficulty');
const upgradesData = load('upgrades');
tanksData.balance = load('balance');
tanksData.events = load('events');
tanksData.arenas = load('arenas');
tanksData.transformations = load('transformations');
tanksData.secondaries = load('secondaries');
tanksData.modifiers = load('modifiers');
tanksData.limits = load('limits');
tanksData.sounds = load('sounds');

let failures = 0;
function check(ok, msg) {
  if (ok) return;
  failures++;
  console.error('FEHLER:', msg);
}

// ---- 1. Ziellinie gegen alle Spezial-Wandtypen (Schatten-State) ----------
{
  const mkState = (wallType) => ({
    walls: [{ x: 200, y: 0, w: 32, h: 384, type: wallType, col: 6, row: 0 }],
    laserWalls: [],
    data: tanksData,
    tanks: [],
  });
  const cfg = { bulletSpeed: 200, bulletRadius: 3 };
  for (const type of ['solid', 'breakable', 'destructible', 'trap', 'generator', 'reflect']) {
    try {
      const pts = traceTrajectory(mkState(type), 50, 100, 0, cfg, {});
      check(pts.length > 1, `Ziellinie an ${type}-Wand liefert keine Punkte`);
    } catch (e) {
      check(false, `Ziellinie crasht an ${type}-Wand: ${e.message}`);
    }
  }
}

// ---- 5a. Sound-Namen im Code haben einen Eintrag in sounds.json ---------
// Statischer Scan aller sounds.push(...)-Aufrufe: ein Tippfehler oder ein
// vergessener sounds.json-Eintrag macht das Ereignis sonst lautlos, ohne
// dass irgendwo ein Fehler auftaucht.
{
  const defined = new Set(Object.keys(tanksData.sounds.sounds || {}));
  const srcFiles = [];
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js')) srcFiles.push(p);
    }
  })(join(root, 'src'));

  for (const file of srcFiles) {
    const text = readFileSync(file, 'utf8');
    // Erfasst 'name' und { name: 'a' } sowie cond ? 'a' : 'b' innerhalb
    // eines sounds.push(...)-Aufrufs.
    for (const m of text.matchAll(/sounds\??\.push\(([^;]*?)\)\s*;/gs)) {
      for (const lit of m[1].matchAll(/'([a-z_0-9]+)'/g)) {
        check(
          defined.has(lit[1]),
          `${file.slice(root.length + 1)}: Sound "${lit[1]}" fehlt in data/sounds.json`,
        );
      }
    }
  }

  // Wohlgeformtheit der Definitionen (audio.js liest genau diese Felder).
  for (const [name, def] of Object.entries(tanksData.sounds.sounds || {})) {
    const steps = def.steps || [];
    check(steps.length > 0 || def.noise, `sounds.json: "${name}" hat weder steps noch noise`);
    for (const s of steps) {
      check(
        typeof s.freq === 'number' && typeof s.dur === 'number' && typeof s.vol === 'number',
        `sounds.json: "${name}" hat einen Step ohne freq/dur/vol`,
      );
    }
  }
}

// ---- 5b. Minen-Warnpuls tickt im vorgesehenen Takt -----------------------
{
  const bmine = tanksData.balance.mine;
  const pulseS = tanksData.sounds.mine.warnPulseS;
  const st = {
    data: tanksData,
    mines: [createMine(100, 100, null, tanksData.mine.radiusPx, false)],
    bullets: [],
    tanks: [],
    sounds: [],
    explosions: [],
    addShake() {},
    spawnParticles() {},
    walls: [],
    killTank() {},
  };
  // Bis kurz vor die Selbstzuendung altern lassen, dabei Toene zaehlen.
  let pulses = 0;
  for (let t = 0; t < bmine.fuse - 1e-6; t += 1 / 60) {
    st.sounds.length = 0;
    updateMines(st, 1 / 60);
    pulses += st.sounds.filter((s) => s.name === 'mine_warn').length;
  }
  const expected = Math.floor(bmine.warningTime / pulseS) + 1;
  check(
    pulses === expected,
    `Minen-Warnpuls: ${pulses} Toene, erwartet ${expected} (warningTime ${bmine.warningTime}s / Takt ${pulseS}s)`,
  );
}

// ---- 6a. Jede Transformation ist ueberhaupt freischaltbar ---------------
// Phase 17 schaltet einen Bonus frei, sobald tagCounts[tag] die Schwelle
// erreicht -- und tagCounts zaehlt STACKS, nicht Karten. Gibt es im Pool
// eines Tags weniger Stacks als die Schwelle, ist die Transformation
// mathematisch tot (so war `terrain`/Pionier mit 2 von 3 nach Welle 2).
// Die Minen-Karten zaehlen dabei nur mit, solange mine/emp_mine ausgeruestet
// ist (upgradepool.js: MINE_ONLY_IDS) -- deshalb beide Faelle pruefen.
{
  const MINE_ONLY = new Set([
    'kettenglied', 'sprengkraft', 'fernzuender', 'schockwelle',
    'annaeherungsmine', 'klebemine', 'streumine',
  ]);
  const T = tanksData.transformations;
  const threshold = T.threshold ?? 3;
  const defs = Object.values(upgradesData.upgrades);
  for (const tf of Object.values(T.transformations)) {
    const cards = defs.filter((c) => c.tag === tf.tag);
    const all = cards.reduce((s, c) => s + c.maxStacks, 0);
    const noMine = cards
      .filter((c) => !MINE_ONLY.has(c.id))
      .reduce((s, c) => s + c.maxStacks, 0);
    check(
      all >= threshold,
      `Transformation "${tf.name}" (${tf.tag}) ist nicht freischaltbar: nur ${all} Stacks im Pool, ${threshold} nötig`,
    );
    check(
      noMine >= threshold,
      `Transformation "${tf.name}" (${tf.tag}) ist ohne Minen-Sekundärwaffe nicht freischaltbar: nur ${noMine} Stacks, ${threshold} nötig`,
    );
  }
}

// ---- 6b. Jede Karte loest sauber in ein Spieler-cfg auf -----------------
// Fängt Karten, die ein Feld benutzen, das eine ANDERE Karte setzt (z. B.
// Doppelschlag ohne Powershot -> bulletSpeed * undefined = NaN).
{
  const numericFields = [
    'speed', 'bulletSpeed', 'fireCooldown', 'magazine', 'ricochets', 'mines',
    'radius', 'bulletRadius',
  ];
  for (const id of Object.keys(upgradesData.upgrades)) {
    const def = upgradesData.upgrades[id];
    for (let lvl = 1; lvl <= def.maxStacks; lvl++) {
      const cfg = applyUpgrades(
        resolveCfg(tanksData, 'player'),
        { [id]: lvl },
        upgradesData,
        'mine',
      );
      for (const f of numericFields) {
        check(
          Number.isFinite(cfg[f]),
          `Karte "${id}" Stufe ${lvl}: cfg.${f} ist ${cfg[f]} (erwartet endliche Zahl)`,
        );
      }
      // Powershot-Verstaerker duerfen nie halb gesetzt sein -- sonst rechnet
      // tank.js: fireBullet() mit undefined weiter.
      const boostable = cfg.powershotPerRoom || cfg.trickshotPowershot;
      if (boostable) {
        check(
          Number.isFinite(cfg.powershotSpeedFactor) && Number.isFinite(cfg.powershotBonusRicochets),
          `Karte "${id}" Stufe ${lvl}: vergibt Powershot-Ladungen ohne speedFactor/bonusRicochets`,
        );
      }
    }
  }
}

// ---- 6b2. Jede Karte ist ueberhaupt ziehbar ----------------------------
// `doppelrohr` stand zwei Phasen lang in upgrades.json, war aber vom Pool
// ausgeschlossen und damit unerreichbar. Dieser Test faengt genau das:
// jede Karte muss -- unter fuer sie guenstigen Bedingungen -- im Pool
// auftauchen. Ausnahmen sind nur Tag `elite` (kommt ausschliesslich ueber
// die Elite-Belohnung) und Waffenkarten ausserhalb der Allowlist.
{
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');
  const defs = upgradesData.upgrades;
  // Alle requires-Ziele einmal auf Stufe 1 -- damit sind Karten wie
  // feuerleitzentrale/nachladeschild/erschuetterungsdash ueberhaupt gueltig.
  const reqTargets = {};
  for (const id in defs) {
    for (const r of defs[id].requires || []) {
      // Ein requires auf eine nicht existierende id macht die Karte tot:
      // chosen[r] bleibt fuer immer 0, der Pool filtert sie immer weg.
      check(!!defs[r], `Karte "${id}" verlangt "${r}" -- diese Karte gibt es nicht`);
      reqTargets[r] = 1;
    }
  }

  const drawAll = (chosen) =>
    rollOffers(upgradesData, {
      chosen,
      roomIndex: 99, // alle minRoom-Gates offen
      rng: mulberry32(12345),
      balance: tanksData.balance,
      count: 300, // zieht den Pool leer, danach Fallback
      ignoreTagRule: true,
      equippedSecondary: 'mine',
      banned: new Set(),
    }).filter((o) => !o.fallback).map((o) => o.id);

  // Tag `weapon` ist grundsaetzlich gesperrt; Welle 1 hat genau diese zwei
  // namentlich freigegeben (upgradepool.js: WEAPON_ALLOWLIST). Sie hier
  // explizit einzufordern ist der Sinn des Tests -- eine pauschale
  // "weapon darf fehlen"-Ausnahme haette ihn fuer genau die Fehlerklasse
  // wirkungslos gemacht, gegen die er gebaut ist.
  const WEAPON_FREIGEGEBEN = new Set(['doppelrohr', 'flak']);
  const reachable = new Set([...drawAll({}), ...drawAll(reqTargets)]);
  for (const id in defs) {
    if (defs[id].tag === 'elite') continue; // nur ueber Elite-Belohnung
    if (defs[id].tag === 'weapon' && !WEAPON_FREIGEGEBEN.has(id)) continue;
    check(reachable.has(id), `Karte "${id}" (${defs[id].tag}) ist im normalen Pool nicht ziehbar`);
  }
  // Die sechs Karten dieser Welle namentlich, damit ein Tippfehler in der
  // id auffaellt statt still zu einer nie gezogenen Karte zu werden.
  for (const id of ['sappeur', 'steinbruch', 'minenspuerer', 'gefahrensinn', 'abprallschock', 'doppelschlag']) {
    check(reachable.has(id), `Welle-3-Karte "${id}" erscheint nicht im Pool`);
  }
}

// ---- 6c. Die Effekte der Welle-3-Karten wirken tatsaechlich -------------
// "Karte gebaut, aber wirkungslos" war in diesem Projekt die haeufigste
// Fehlerklasse (doppelrohr nie im Pool, pionier mit totem Tag) -- deshalb
// fuer jede mechanische Karte ein direkter Wirkungsnachweis.
{
  const mkState = (playerCfgExtra, walls = []) => {
    const player = {
      x: 100, y: 100, alive: true, stunTimer: 0, powershotCharges: 0,
      cfg: { radius: 12, ...playerCfgExtra },
    };
    return {
      data: tanksData,
      player,
      tanks: [player],
      walls,
      bullets: [],
      bonusScrap: 0,
      transform: {},
      spawnParticles() {},
      addShake() {},
      sounds: [],
      texts: [],
      explosions: [],
    };
  };

  // Sappeur: rissige Wand (3 Treffer) faellt mit Stufe 1 schon nach zweien.
  {
    const { createState } = await import('../src/game/state.js');
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const wall = st.walls.find((w) => w.type === 'destructible');
    check(!!wall, 'Kein destructible-Wandtyp im Testraum gefunden');
    if (wall) {
      const hits = wall.destructibleHits;
      st.player.cfg.wallHitsReduction = 1;
      for (let i = 0; i < hits - 1; i++) st.destroyWall(wall);
      check(
        !st.walls.includes(wall),
        `Sappeur wirkt nicht: Wand mit ${hits} Treffern steht nach ${hits - 1} Treffern noch`,
      );
      // Steinbruch: dieselbe Zerstoerung fuellt den Bonus-Schrott-Zaehler.
      const wall2 = st.walls.find((w) => w.type === 'destructible');
      if (wall2) {
        st.player.cfg.scrapPerWall = 2;
        const before = st.bonusScrap;
        for (let i = 0; i < 5; i++) if (st.walls.includes(wall2)) st.destroyWall(wall2);
        check(st.bonusScrap === before + 2, `Steinbruch wirkt nicht: bonusScrap ${before} -> ${st.bonusScrap}`);
      }
      // ... aber NICHT fuer die eigene Sperrmauer (waere eine Schrottquelle).
      const st2 = createRun(tanksData, tilesData, diffData, upgradesData, 7).state;
      st2.player.cfg.scrapPerWall = 2;
      st2.placeTrapWall(st2.player.x + 40, st2.player.y, 1);
      const trapWall = st2.walls.find((w) => w.type === 'trap');
      if (trapWall) {
        const before = st2.bonusScrap;
        st2.destroyWall(trapWall);
        check(st2.bonusScrap === before, 'Steinbruch gibt Schrott für die eigene Sperrmauer (Exploit)');
      }
    }
  }

  // Abprallschock: Kugel prallt an einer Wand ab -> Gegner daneben betaeubt.
  {
    const { updateBullet, createBullet } = await import('../src/game/bullet.js');
    const st = mkState({ bounceStunRadius: 60, bounceStunS: 0.7 }, [
      { x: 200, y: 0, w: 32, h: 400, type: 'solid', col: 6, row: 0 },
    ]);
    const enemy = { x: 180, y: 100, alive: true, stunTimer: 0, cfg: { radius: 12 } };
    st.tanks.push(enemy);
    const b = createBullet(150, 100, 0, {
      speed: 400, radius: 3, ricochets: 2, owner: st.player, kind: 'bullet',
    });
    st.bullets.push(b);
    for (let i = 0; i < 30 && b.wallBounces === 0; i++) updateBullet(b, st, 1 / 60);
    check(b.wallBounces > 0, 'Abprallschock-Test: Kugel ist gar nicht abgeprallt');
    check(enemy.stunTimer > 0, 'Abprallschock wirkt nicht: Gegner neben dem Abprallpunkt ist nicht betäubt');
  }

  // Doppelschlag: ein Trickshot-Kill laedt eine Powershot-Ladung nach.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1337);
    const st = run.state;
    const enemy = st.tanks.find((t) => t !== st.player && t.alive);
    check(!!enemy, 'Doppelschlag-Test: kein Gegner im Raum');
    if (enemy) {
      Object.assign(st.player.cfg, {
        trickshotPowershot: 1, trickshotPowershotMax: 3,
        powershotSpeedFactor: 2, powershotBonusRicochets: 2,
      });
      st.player.powershotCharges = 0;
      run.phase = 'playing'; // frischer Run steht auf 'preview' -- stepRun stiege sonst sofort aus
      enemy.cfg.armor = null;
      enemy.cfg.requiresRicochet = false;
      enemy.protect = 0;
      // Kugel des Spielers, bereits abgeprallt, direkt auf dem Gegner.
      st.bullets.push({
        x: enemy.x, y: enemy.y, prevX: enemy.x, prevY: enemy.y, vx: 10, vy: 0,
        radius: 3, owner: st.player, kind: 'bullet', age: 5, distance: 10,
        wallBounces: 2, ricochetsLeft: 0, ricochetsStart: 2, dead: false,
        reflected: false, reflectImmune: null, reflectImmuneT: 0, trail: [],
      });
      // CMD/STEP stehen erst weiter unten (const) -- hier lokal.
      stepRun(run, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false }, 1 / 60);
      check(
        st.player.powershotCharges === 1,
        `Doppelschlag wirkt nicht: powershotCharges = ${st.player.powershotCharges} (erwartet 1)`,
      );
      // USP-Kennzahl 3 (PLAN.md): derselbe Kill zaehlt als FREIWILLIGER
      // Bankshot -- der Gegner war ja auch direkt toetbar.
      check(
        st.voluntaryRicochetKills === 1 && st.ricochetKills === 1,
        `Kennzahl 3: freiwilliger Abpraller-Kill nicht gezählt (voluntary=${st.voluntaryRicochetKills}, ricochet=${st.ricochetKills})`,
      );
    }
  }

  // Gegenprobe zu Kennzahl 3: an einem Prisma ist der Bankshot ERZWUNGEN
  // und darf die Freiwilligen-Quote nicht aufblaehen.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1337);
    const st = run.state;
    const enemy = st.tanks.find((t) => t !== st.player && t.alive);
    if (enemy) {
      run.phase = 'playing';
      enemy.cfg.armor = null;
      enemy.cfg.requiresRicochet = true; // Prisma-Verhalten erzwingen
      enemy.protect = 0;
      st.bullets.push({
        x: enemy.x, y: enemy.y, prevX: enemy.x, prevY: enemy.y, vx: 10, vy: 0,
        radius: 3, owner: st.player, kind: 'bullet', age: 5, distance: 10,
        wallBounces: 2, ricochetsLeft: 0, ricochetsStart: 2, dead: false,
        reflected: false, reflectImmune: null, reflectImmuneT: 0, trail: [],
      });
      stepRun(run, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false }, 1 / 60);
      check(
        st.ricochetKills === 1 && st.voluntaryRicochetKills === 0,
        `Kennzahl 3: Bankshot auf ein Prisma wurde als freiwillig gezählt (voluntary=${st.voluntaryRicochetKills})`,
      );
    }
  }
}

// ---- 6d. Der Effekt-Renderpfad crasht nicht ----------------------------
// Blinder Fleck der bisherigen Suite: Headless-Tests fuehren den Renderer
// nie aus -- genau deshalb blieb der Ziellinien-Crash (destroyWall im
// Schattenzustand) so lange unentdeckt. `effects.js` importiert nichts aus
// render/ und laesst sich daher mit einem Fake-Canvas direkt aufrufen.
// Alle Anzeige-Upgrades werden dabei eingeschaltet.
{
  const effects = await import('../src/render/effects.js');
  const fakeCtx = new Proxy(
    { canvas: { width: 768, height: 512 } },
    {
      get: (t, k) => (k in t ? t[k] : () => {}),
      set: () => true,
    },
  );
  const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
  const st = run.state;
  // Alle Anzeige-Schalter der Informations-Karten aktiv.
  Object.assign(st.player.cfg, {
    radar: true, mineSense: true, threatSense: true, aimPreviewBounces: 2, ignoreFog: false,
  });
  // Je eine eigene und eine gegnerische Mine, kurz vor der Zuendung.
  const enemy = st.tanks.find((t) => t !== st.player);
  for (const owner of [st.player, enemy]) {
    const m = createMine(st.player.x + 40, st.player.y, owner, tanksData.mine.radiusPx, false);
    m.age = tanksData.balance.mine.fuse - 0.2; // im Warnfenster
    st.mines.push(m);
  }
  if (enemy) enemy.aimingAtPlayer = true;
  const { traceTrajectory: trace } = await import('../src/game/bullet.js');
  for (const [name, fn, args] of [
    ['drawMines', effects.drawMines, [fakeCtx, st]],
    ['drawTraps', effects.drawTraps, [fakeCtx, st]],
    ['drawRadar', effects.drawRadar, [fakeCtx, st]],
    ['drawThreatRings', effects.drawThreatRings, [fakeCtx, st]],
    ['drawThreatLines', effects.drawThreatLines, [fakeCtx, st]],
    ['drawFlashes', effects.drawFlashes, [fakeCtx, st]],
    ['drawParticles', effects.drawParticles, [fakeCtx, st]],
    ['drawExplosions', effects.drawExplosions, [fakeCtx, st]],
    ['drawTexts', effects.drawTexts, [fakeCtx, st]],
    ['drawMinePreview', effects.drawMinePreview, [fakeCtx, st, { angle: 0.5, dist: 70 }]],
    ['drawAimLine', effects.drawAimLine, [fakeCtx, st, trace]],
  ]) {
    try {
      fn(...args);
    } catch (e) {
      check(false, `Renderpfad: ${name}() wirft (${e.message})`);
    }
  }
}

// ---- Hilfen fuer den Auto-Durchlauf --------------------------------------
const CMD = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
const STEP = 1 / 60;

function cheatKillAll(st) {
  // Reaktor-Generatoren zuerst abraeumen (killTank ist sonst ein No-op).
  for (const w of [...st.walls]) {
    if (w.type === 'generator') {
      while (st.walls.includes(w)) st.destroyWall(w);
    }
  }
  for (const t of st.tanks) {
    if (t !== st.player && t.alive) st.killTank(t, 'test');
  }
}

function pickMapNode(run) {
  const current = run.map.byId.get(run.mapCurrentId);
  for (const id of current?.next || []) {
    if (chooseMapNode(run, id)) return true;
  }
  return false;
}

// ---- 2.-4. Fuenf Seeds bis zum Sieg + Wellen-/Trace-Pruefungen -----------
validateArenas(tanksData.arenas);
const SEEDS = [1, 7, 42, 1337, 20260729];

const soundNamesSeen = new Set();

for (const seed of SEEDS) {
  const run = createRun(tanksData, tilesData, diffData, upgradesData, seed);
  let guard = 200000;
  let tracedRoom = -1;
  let waveRoomsSeen = 0;

  while (run.phase !== 'victory' && run.phase !== 'gameover' && guard-- > 0) {
    if (run.phase === 'preview') {
      enterRoom(run);
    } else if (run.phase === 'transition') {
      stepRun(run, CMD, STEP);
    } else if (run.phase === 'playing') {
      const st = run.state;
      // Regression 1 im echten Raum: Ziellinie einmal pro Raum rundum tracen
      // (trifft dabei zerstoerbare Waende/Spiegelwaende/Generatoren).
      if (tracedRoom !== run.roomIndex) {
        tracedRoom = run.roomIndex;
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          try {
            traceTrajectory(st, st.player.x, st.player.y, a, { bulletSpeed: 200, bulletRadius: 3 }, {});
          } catch (e) {
            check(false, `Seed ${seed}, Raum ${run.roomIndex}: Ziellinie crasht (${e.message})`);
            break;
          }
        }
        if (st.pendingWave) waveRoomsSeen++;
      }
      cheatKillAll(st);
      const hadWave = !!st.pendingWave;
      stepRun(run, CMD, STEP);
      // Phase 7b: jede Meldung ist entweder ein reiner Name (globales
      // Ereignis) oder { name, x } (ortsgebunden, wird gepannt).
      for (const ev of st.sounds.splice(0)) {
        const name = typeof ev === 'string' ? ev : ev?.name;
        check(typeof name === 'string', `Seed ${seed}: unförmige Sound-Meldung ${JSON.stringify(ev)}`);
        if (typeof ev === 'object') {
          check(typeof ev.x === 'number' && Number.isFinite(ev.x), `Seed ${seed}: Sound "${name}" ohne gültige x-Position`);
        }
        soundNamesSeen.add(name);
      }
      // Regression 3: solange eine Welle aussteht, darf der Raum nicht enden.
      if (hadWave && run.state === st && st.pendingWave) {
        check(run.phase === 'playing', `Seed ${seed}, Raum ${run.roomIndex}: Raum endete trotz ausstehender Welle (${run.phase})`);
      }
    } else if (run.phase === 'upgrade') {
      check(!run.state?.pendingWave, `Seed ${seed}, Raum ${run.roomIndex}: Belohnung trotz ausstehender Welle`);
      chooseUpgrade(run, 0);
    } else if (run.phase === 'map') {
      check(pickMapNode(run), `Seed ${seed}: kein waehlbarer Kartenknoten (Raum ${run.roomIndex})`);
    } else if (run.phase === 'workshop') {
      leaveWorkshop(run);
    } else if (run.phase === 'event') {
      chooseEventOption(run, 0);
    } else {
      check(false, `Seed ${seed}: unbekannte Phase "${run.phase}"`);
      break;
    }
  }
  check(guard > 0, `Seed ${seed}: Haenger (Iterationslimit erreicht in Phase "${run.phase}", Raum ${run.roomIndex})`);
  check(run.phase === 'victory', `Seed ${seed}: kein Sieg (Phase "${run.phase}", Raum ${run.roomIndex})`);
  if (run.phase === 'victory') {
    console.log(`Seed ${seed}: Sieg nach ${run.roomsCleared} geraeumten Raeumen (${waveRoomsSeen} Wellen-Raeume gesehen)`);
  }
}

// ---- 5c. Im echten Lauf beobachtete Sound-Namen -------------------------
{
  const defined = new Set(Object.keys(tanksData.sounds.sounds || {}));
  for (const name of soundNamesSeen) {
    check(defined.has(name), `Im Lauf gemeldeter Sound "${name}" fehlt in data/sounds.json`);
  }
  check(soundNamesSeen.has('kill'), 'Gegner-Kill meldet keinen "kill"-Sound');
  check(!soundNamesSeen.has('death'), 'Alter Sammel-Sound "death" wird noch gemeldet (Phase 7b trennt player_death/kill)');
}

// ---- 7. USP-Kennzahl 1 aus PLAN.md haelt den Zielwert -------------------
// "Erzwungene Bankshots -- Anteil der Raeume ab Raum 5 mit mindestens einem
// nicht direkt toetbaren Gegner. Zielwert 60 %." Die Messung ist ueber feste
// Seeds deterministisch, also ein echter Waechter: faellt der Wert (z. B.
// weil jemand difficulty.json: bankshotGuarantee anfasst oder t_prism
// teurer macht), wird die Suite rot statt dass der USP still verwaessert.
{
  const { measure } = await import('./uspcheck.mjs');
  const s = measure(40);
  const share = s.withBankshot / s.rooms;
  check(
    share >= 0.6,
    `USP-Kennzahl 1 verfehlt: nur ${(100 * share).toFixed(1)} % der Kampfräume ab Raum 5 ` +
      `erzwingen einen Bankshot (Zielwert 60 %, siehe PLAN.md Prüfpunkte / tests/uspcheck.mjs)`,
  );
  console.log(`USP-Kennzahl 1: ${(100 * share).toFixed(1)} % erzwungene Bankshots (Ziel 60 %)`);
}

// ---- 4. Determinismus: gleiche Karte + gleicher Raum bei gleichem Seed ---
{
  const a = createRun(tanksData, tilesData, diffData, upgradesData, 4242);
  const b = createRun(tanksData, tilesData, diffData, upgradesData, 4242);
  const mapOf = (r) => JSON.stringify(r.map.layers.map((l) => l.map((n) => [n.id, n.type, n.next])));
  check(mapOf(a) === mapOf(b), 'Karte ist bei gleichem Seed nicht deterministisch');
  const gridOf = (r) => r.state.walls.map((w) => `${w.col},${w.row},${w.type}`).join(';');
  check(gridOf(a) === gridOf(b), 'Raum 1 ist bei gleichem Seed nicht deterministisch');
}

if (failures) {
  console.error(`\n${failures} Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Regressionstests bestanden.');
