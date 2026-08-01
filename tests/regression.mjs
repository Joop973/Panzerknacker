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

// ---- 7b. Wirkungsnachweise der Nutzer-Balancerunde ---------------------
{
  // Aasgeier: nach einem Kill zaehlen die schon fliegenden Kugeln nicht mehr
  // gegen das Magazin -- der Spieler kann sofort wieder voll feuern, die
  // alten Kugeln fliegen und toeten weiter.
  {
    const { createBullet } = await import('../src/game/bullet.js');
    const { fireBullet } = await import('../src/game/tank.js');
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const p = st.player;
    p.cfg.magazine = 3;
    p.cfg.magazineCap = 8;
    p.cfg.scavenger = true;
    p.cooldown = 0;
    // Magazin vollschiessen.
    for (let i = 0; i < 3; i++) {
      st.bullets.push(createBullet(p.x, p.y, i, { speed: 100, radius: 3, ricochets: 1, owner: p, kind: 'bullet' }));
    }
    check(fireBullet(p, st) === false, 'Aasgeier-Test: Magazin war nicht voll (Vorbedingung)');
    const enemy = st.tanks.find((t) => t !== p && t.alive);
    check(!!enemy, 'Aasgeier-Test: kein Gegner im Raum');
    if (enemy) {
      st.killTank(enemy, 'test');
      check(
        st.bullets.every((b) => b.magFreed),
        'Aasgeier: fliegende Kugeln wurden nach dem Kill nicht vom Magazin freigegeben',
      );
      p.cooldown = 0;
      check(fireBullet(p, st) === true, 'Aasgeier: Feuern nach dem Kill immer noch gesperrt');
      check(
        st.bullets.filter((b) => !b.dead).length === 4,
        'Aasgeier: die alten Kugeln sind verschwunden statt weiterzufliegen',
      );
    }
  }

  // Konterschild: nur in Elite-/Verflucht-/Bossraeumen aktiv.
  {
    const { resolveCfg, applyUpgrades, applyRoomContext } = await import('../src/game/cfg.js');
    const mk = (ctx) =>
      applyRoomContext(
        applyUpgrades(resolveCfg(tanksData, 'player'), { konterschild: 1 }, upgradesData, 'mine'),
        ctx,
      );
    check(mk({ elite: false, boss: false }).counterShield === false, 'Konterschild ist im normalen Kampfraum aktiv (soll aus sein)');
    check(mk({ elite: true, boss: false }).counterShield === true, 'Konterschild ist im Eliteraum nicht aktiv');
    check(mk({ elite: false, boss: true }).counterShield === true, 'Konterschild ist im Bossraum nicht aktiv');
  }

  // Wolframkern: reisst die Wand ein UND fliegt weiter.
  {
    const { createBullet, updateBullet } = await import('../src/game/bullet.js');
    let destroyed = 0;
    const wall = { x: 200, y: 88, w: 32, h: 32, type: 'breakable', col: 6, row: 2 };
    const st = {
      walls: [wall],
      laserWalls: [],
      data: tanksData,
      tanks: [],
      sounds: [],
      destroyWall(w) {
        destroyed++;
        st.walls.splice(st.walls.indexOf(w), 1);
      },
    };
    const b = createBullet(150, 104, 0, { speed: 300, radius: 3, ricochets: 1, owner: null, kind: 'bullet', tungsten: true });
    for (let i = 0; i < 40 && !b.dead; i++) updateBullet(b, st, 1 / 60);
    check(destroyed === 1, `Wolframkern: Wand nicht eingerissen (${destroyed})`);
    check(!b.dead, 'Wolframkern: Geschoss ist an der Wand verschwunden statt weiterzufliegen');
    check(b.x > 232, `Wolframkern: Geschoss ist nicht hinter der Wand angekommen (x=${b.x.toFixed(0)})`);
    check(b.wallBounces === 0, 'Wolframkern: Einreissen hat einen Abpraller verbraucht');
  }
}

// ---- 7d. P1: gesperrter Schuss meldet sich zurueck -----------------------
// Konflikt D aus SPEC.md Abschnitt 9: bullet.maxActive sperrt das Feuern
// (Feuersperre statt Verdraengung, Phase 0a). Auf Controller/PC wirkt das
// wie ein Defekt, wenn nichts passiert. Ein FRISCHER Abzug ins volle
// Magazin gibt deshalb Ton + gedimmten Blitz -- gehaltenes Dauerfeuer
// nicht, sonst klickt es pausenlos.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { fireBullet } = await import('../src/game/tank.js');
  const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
  const st = run.state;
  const p = st.player;
  p.cfg.magazine = 2;
  p.cooldown = 0;
  for (let i = 0; i < 2; i++) {
    st.bullets.push(createBullet(p.x, p.y, i, { speed: 100, radius: 3, ricochets: 1, owner: p, kind: 'bullet' }));
  }
  st.sounds.length = 0;
  st.flashes.length = 0;

  // (a) Gehaltener Abzug (pressed = false): kein Signal.
  check(fireBullet(p, st, false) === false, 'P1: Magazin war nicht voll (Vorbedingung)');
  check(st.sounds.length === 0, 'P1: gehaltener Abzug meldet die Feuersperre (soll still bleiben)');

  // (b) Frischer Abzug (pressed = true): Ton + gedimmter Blitz.
  fireBullet(p, st, true);
  const snd = st.sounds.find((s) => (s?.name || s) === 'empty');
  check(!!snd, 'P1: frischer Abzug ins volle Magazin gibt keinen Ton');
  check(typeof snd?.x === 'number', 'P1: der Sperr-Ton ist nicht im Stereobild platziert');
  check(
    st.flashes.some((f) => f.dim),
    'P1: kein sichtbares Gegenstueck zum Sperr-Ton (gedimmter Blitz fehlt)',
  );

  // (c) Der Cooldown verhindert Dauerklackern bei schnellem Nachdruecken.
  st.sounds.length = 0;
  fireBullet(p, st, true);
  check(st.sounds.length === 0, 'P1: Sperr-Ton ignoriert den blockedShotCooldownS');
  // ... laeuft aber nach Ablauf des Cooldowns wieder an.
  st.blockedShotTimer = 0;
  fireBullet(p, st, true);
  check(st.sounds.some((s) => (s?.name || s) === 'empty'), 'P1: Sperr-Ton kommt nach dem Cooldown nicht wieder');

  // (d) Nur der Spieler bekommt die Rueckmeldung -- Gegner nie.
  const enemy = st.tanks.find((t) => t !== p && t.alive);
  if (enemy) {
    enemy.cfg.magazine = 1;
    enemy.cooldown = 0;
    st.bullets.push(createBullet(enemy.x, enemy.y, 0, { speed: 100, radius: 3, ricochets: 1, owner: enemy, kind: 'bullet' }));
    st.sounds.length = 0;
    st.blockedShotTimer = 0;
    fireBullet(enemy, st, true);
    check(st.sounds.length === 0, 'P1: auch ein Gegner loest die Feuersperr-Meldung aus');
  }
}

// ---- 7c. Bankshot-Gegner: feuert er, und haelt er das Frame-Budget? ----
// Der Gruene (t_green) nutzt seit der Nutzer-Balancerunde den
// Abpraller-Rechner (ai_turrets.js: solveBounce). Der marched angleSamples
// Strahlen ueber die halbe Arena und ist damit die teuerste KI im Spiel:
// EIN Solver-Lauf kostete mit den urspruenglichen 180 Samples bis zu
// 4,8 ms von 6 ms Frame-Budget (PLAN.md Phase 11b). Gegengemessen wurde
// deshalb 120 Samples -- gleiche Loesungsquote (15/18), rund halbe Zeit.
// `solvesPerTick` ist zusaetzlich ein Sicherheitsnetz: die Solver-Timer
// staffeln sich zwar von selbst (gemessen: 260 Laeufe in 260 verschiedenen
// Ticks), aber bei vielen Bankshot-Gegnern koennten sie zusammenfallen.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');
  check(!!tanksData.types.t_green.requiresBounceShot, 'Der Grüne nutzt den Abpraller-Rechner nicht mehr');
  let shots = 0;
  const samplesMs = [];
  let maxSolvesInOneTick = 0;
  const budget = tanksData.ai.bounceShot.solvesPerTick ?? 1;
  for (let seed = 1; seed <= 6; seed++) {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(seed, 3, 'rooms'),
      enemyTypes: ['t_green', 't_green', 't_green'],
      aiSeed: hashSeed(seed, 3, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
    });
    for (let i = 0; i < 60 * 6; i++) {
      const t0 = process.hrtime.bigint();
      stepState(
        st,
        { move: { x: Math.sin(i / 40), y: Math.cos(i / 55) }, aim: { x: st.player.x + 50, y: st.player.y }, fire: false, mine: false, dash: false },
        1 / 60,
      );
      samplesMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
      // Budget-Buchhaltung: stepState() setzt es am Anfang, bounceShot()
      // zaehlt herunter -- es darf nie unter 0 rutschen.
      maxSolvesInOneTick = Math.max(maxSolvesInOneTick, budget - st.bounceSolveBudget);
      for (const ev of st.sounds.splice(0)) {
        if ((typeof ev === 'string' ? ev : ev.name) === 'shoot_enemy') shots++;
      }
      st.player.protect = 1; // Spieler am Leben halten
      for (const t of st.tanks) if (t !== st.player) t.alive = true;
    }
  }
  check(shots > 40, `Bankshot-Gegner feuert kaum (${shots} Schüsse in 6 Räumen à 6 s mit je 3 Grünen)`);
  check(
    maxSolvesInOneTick <= budget,
    `Abpraller-Rechner überschreitet sein Frame-Budget (${maxSolvesInOneTick} Läufe in einem Tick, erlaubt ${budget})`,
  );
  // Bewertet wird der DRITTGROESSTE Messwert, nicht der groesste.
  // Begruendung (gemessen, nicht geschaetzt): von 2160 Ticks liegen nur ~10
  // ueber 1 ms -- der Solver laeuft dank solvesPerTick + gestaffelter Timer
  // eben selten. Der rohe Maximalwert ist damit ein Einzelereignis und
  // fing prompt eine GC-Pause ein (6,39 ms in einem Lauf, 1,8-2,4 ms in
  // fuenf direkt danach). Ein Perzentil ist hier das falsche Werkzeug: p99,5
  // liegt bei 0,99 ms und verduennt genau das seltene Ereignis, um das es
  // geht. Die drittgroesste Messung (heute ~2,1 ms) behaelt das Signal --
  // eine echte Verteuerung des Solvers hebt die ganze Spitzengruppe --,
  // vertraegt aber zwei Ausreisser.
  // Gegengeprueft ueber angleSamples: 120 -> 1,1-2,1 ms (gruen),
  // 600 -> 3,9-5,4 ms (gruen, und zwar zu Recht: das Budget ist knapp
  // gehalten), 2400 -> 7,5 ms (rot). Die Schwelle misst also das Budget,
  // nicht die Zahl der Strahlen.
  samplesMs.sort((a, b) => a - b);
  const worstMs = samplesMs[samplesMs.length - 1];
  const robustMs = samplesMs[Math.max(0, samplesMs.length - 3)];
  check(
    robustMs < 6,
    `Logikschritt mit 3 Bankshot-Gegnern zu teuer: ${robustMs.toFixed(2)} ms (drittgrösster Wert, Budget 6 ms, Maximum ${worstMs.toFixed(2)} ms)`,
  );
  console.log(
    `Bankshot-Gegner: ${shots} Schüsse, Logikschritt ${robustMs.toFixed(2)} ms (drittgrösster Wert, Maximum ${worstMs.toFixed(2)} ms)`,
  );
}

// ---- 8. Overlays schliessen sich nach der Aktion -----------------------
// Vom Nutzer gemeldeter Blocker: nach dem Anklicken eines Kartenknotens blieb
// das #map-Overlay ueber dem Spielfeld liegen und fing jede weitere Eingabe
// ab -- der Run war nicht mehr bedienbar. Ursache: mapscreen.js war der
// einzige der fuenf Screens, der sich im Click-Handler NICHT selbst versteckt
// hat. Blinder Fleck: kein Test hatte die UI-Schicht je beruehrt.
{
  const { installDom } = await import('./domstub.mjs');
  const restore = installDom();
  try {
    const { createMapScreen } = await import('../src/ui/mapscreen.js');
    const ms = createMapScreen();
    const nodes = [
      { id: 10, layer: 1, col: 0, type: 'combat', isBoss: false, next: [20, 21] },
      { id: 20, layer: 2, col: 0, type: 'combat', isBoss: false, next: [] },
      { id: 21, layer: 2, col: 1, type: 'treasure', isBoss: false, next: [] },
    ];
    const map = { layers: [[nodes[0]], [nodes[1], nodes[2]]], byId: new Map(nodes.map((n) => [n.id, n])) };
    const typeInfo = {
      combat: { name: 'Kampf', symbol: 'X', desc: '' },
      treasure: { name: 'Schatz', symbol: 'D', desc: '' },
    };
    const overlay = document.getElementById('map');
    check(!!overlay, 'Kartenscreen legt kein #map-Overlay an');

    // (a) Gueltige Wahl -> Overlay muss zu sein.
    let chosen = null;
    ms.show({ map, currentId: 10, lives: 3, treasureLifeCost: 1, typeInfo, onChoose: (id) => { chosen = id; return true; } });
    check(!overlay.classList.contains('hidden'), 'Kartenscreen wird nicht sichtbar');
    const reachable = overlay.querySelectorAll('button.mapnode.reachable');
    check(reachable.length === 2, `Erwartet 2 erreichbare Knoten, gefunden ${reachable.length}`);
    reachable[0].click();
    check(chosen === 20, `onChoose wurde nicht mit der Knoten-id aufgerufen (chosen=${chosen})`);
    check(
      overlay.classList.contains('hidden'),
      'BLOCKER: Kartenscreen bleibt nach der Knotenwahl offen und blockiert jede Eingabe',
    );

    // (b) Abgelehnte Wahl -> Overlay bleibt offen (sonst haengt der Run ohne
    //     sichtbare Karte fest).
    ms.show({ map, currentId: 10, lives: 3, treasureLifeCost: 1, typeInfo, onChoose: () => false });
    overlay.querySelectorAll('button.mapnode.reachable')[0].click();
    check(
      !overlay.classList.contains('hidden'),
      'Kartenscreen schließt sich auch bei abgelehnter Wahl -- der Run wäre ohne Karte blockiert',
    );

    // (c) Schatzkammer bei zu wenig Leben ist gesperrt UND nicht klickbar.
    let clickedLocked = false;
    ms.show({ map, currentId: 10, lives: 1, treasureLifeCost: 1, typeInfo, onChoose: () => { clickedLocked = true; return true; } });
    const locked = overlay.querySelectorAll('button.mapnode.locked');
    check(locked.length === 1, `Schatzkammer bei 1 Leben nicht als gesperrt markiert (${locked.length})`);
    locked[0]?.click();
    check(!clickedLocked, 'Gesperrte Schatzkammer löst trotzdem eine Wahl aus');
  } finally {
    restore();
  }
}

// ---- 8b. Kein Kartenknoten kann in eine Sackgasse fuehren ---------------
// Zweiter Blocker-Pfad derselben Klasse: `treasure` ist bei zu wenig Leben
// nicht waehlbar (chooseMapNode). Fuehren ALLE Kanten eines Knotens nur zu
// Schatzkammern, waere der Run bei 1 Leben unbedienbar -- der Kartenscreen
// zeigte dann nur gesperrte Knoten. generateMap() hat dafuer ein
// Sicherheitsnetz; das wird hier ueber viele Seeds nachgeprueft.
{
  const bad = [];
  for (let seed = 1; seed <= 200; seed++) {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, seed);
    for (const layer of run.map.layers) {
      for (const node of layer) {
        if (!node.next.length) continue;
        if (node.next.every((id) => run.map.byId.get(id).type === 'treasure')) {
          bad.push(`Seed ${seed}, Knoten ${node.id}`);
        }
      }
    }
  }
  check(
    bad.length === 0,
    `Kartensackgasse: ${bad.length} Knoten führen ausschließlich zu Schatzkammern (${bad.slice(0, 3).join('; ')})`,
  );
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
