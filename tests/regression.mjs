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
tanksData.input = load('input'); // P9: Tastencodes fuer getMenuState()-Tests

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
// Die frueher noetige Zusatzpruefung "auch OHNE Minen-Sekundärwaffe" ist
// mit P4 entfallen: die Bombe liegt im eigenen, festen Slot und ist immer
// ausgeruestet, MINE_ONLY_IDS gibt es nicht mehr. Stattdessen wird jetzt
// geprueft, dass genau das auch stimmt -- keine Karte darf noch an eine
// ausgeruestete Sekundaerwaffe gebunden sein.
{
  const T = tanksData.transformations;
  const threshold = T.threshold ?? 3;
  const defs = Object.values(upgradesData.upgrades);
  for (const tf of Object.values(T.transformations)) {
    const cards = defs.filter((c) => c.tag === tf.tag);
    const all = cards.reduce((s, c) => s + c.maxStacks, 0);
    check(
      all >= threshold,
      `Transformation "${tf.name}" (${tf.tag}) ist nicht freischaltbar: nur ${all} Stacks im Pool, ${threshold} nötig`,
    );
  }
  // P4-Zusicherung: der Pool haengt an keiner Ausruestung mehr. Gegenprobe
  // gegen ein Wiedereinschleichen der alten Sperre.
  // Gesucht ist eine echte VERWENDUNG, kein Kommentar -- deshalb auf den
  // Aufruf gemustert und Kommentarzeilen vorher entfernt.
  const poolSrc = readFileSync(new URL('../src/game/upgradepool.js', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  check(
    !/MINE_ONLY_IDS\s*\.\s*has/.test(poolSrc),
    'P4: MINE_ONLY_IDS wird wieder benutzt -- Karten haengen an der ausgeruesteten Waffe',
  );
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
    // P6: sonst steigt drawHookPreview() sofort wieder aus und der Zweig
    // bliebe ungetestet -- genau der blinde Fleck, den dieser Block schliesst.
    gadget: 'hook',
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
    // P6: beide Zweige der Haken-Vorschau (Treffer und Fehlschuss) --
    // der Renderpfad war schon zweimal der blinde Fleck.
    ['drawHookPreview', effects.drawHookPreview, [fakeCtx, st, 0]],
    ['drawHookPreview(quer)', effects.drawHookPreview, [fakeCtx, st, Math.PI / 3]],
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

// ---- 8h. P9: Lautstaerkeregler (audio.js) --------------------------------
// setVolume/getVolume laufen VOR unlock() (kein AudioContext vorhanden) --
// muessen also auch mit master === null funktionieren, statt zu werfen.
{
  const { createAudio } = await import('../src/core/audio.js');
  const audio = createAudio();
  check(audio.getVolume() === 1, `P9: Standardlautstaerke ist nicht 1 (${audio.getVolume()})`);
  audio.setVolume(0.4);
  check(audio.getVolume() === 0.4, 'P9: setVolume/getVolume verlieren den Wert');
  check(!audio.isMuted(), 'P9: setVolume mutet nebenbei');
  // Mute gewinnt ueber den Reglerwert -- beide wirken auf denselben Gain-
  // Knoten, Stumm darf den Reglerwert nicht loeschen (er muss nach dem
  // Entstummen wieder gelten).
  audio.setMuted(true);
  check(audio.isMuted(), 'P9: setMuted(true) mutet nicht');
  check(audio.getVolume() === 0.4, 'P9: Mute loescht den Reglerwert');
  audio.setMuted(false);
  check(audio.getVolume() === 0.4, 'P9: Regler verliert seinen Wert nach dem Entstummen');
}

// ---- 8i. P9: Menue-Navigation (Tastatur/Gamepad, Startbildschirm) -------
{
  const { createMenuNav } = await import('../src/ui/menunav.js');
  const { installDom } = await import('./domstub.mjs');
  const restore = installDom();
  try {
    const btnA = document.createElement('button');
    const btnB = document.createElement('button');
    const range = document.createElement('input');
    range.tagName = 'INPUT';
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.step = '5';
    range.value = '50';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false;
    const list = [btnA, btnB, range, checkbox];
    const nav = createMenuNav(() => list);

    // (a) Y bewegt den Fokus, mit sofortigem ersten Schritt.
    nav.update({ menuDir: { x: 0, y: 1 }, menuConfirm: false }, 1 / 60);
    check(btnB.classList.contains('menu-focus'), 'P9: erster Y-Schlag bewegt den Fokus nicht');
    check(!btnA.classList.contains('menu-focus'), 'P9: altes Fokuselement bleibt markiert');

    // (b) Gehaltene Richtung wiederholt NICHT vor REPEAT_FIRST_S (0,35 s).
    nav.update({ menuDir: { x: 0, y: 1 }, menuConfirm: false }, 0.1);
    check(range.classList.contains('menu-focus') === false, 'P9: Fokus wiederholt zu frueh');
    // ... aber danach schon.
    nav.update({ menuDir: { x: 0, y: 1 }, menuConfirm: false }, 0.3);
    check(range.classList.contains('menu-focus'), 'P9: Fokus wiederholt gar nicht');

    // (c) X passt NUR den Regler an, keinen anderen Elementtyp.
    let inputFired = false;
    range.addEventListener('input', () => (inputFired = true));
    nav.update({ menuDir: { x: 1, y: 0 }, menuConfirm: false }, 1 / 60);
    check(range.value === '55', `P9: X-Achse aendert den Regler nicht (${range.value})`);
    check(inputFired, 'P9: Regler feuert kein input-Ereignis');
    // Kein Wiederholen bei gehaltenem X (ein Schritt pro Tastendruck).
    nav.update({ menuDir: { x: 1, y: 0 }, menuConfirm: false }, 1);
    check(range.value === '55', 'P9: X-Achse wiederholt trotz gehaltener Richtung');
    // Deckel bei max.
    range.value = '100';
    nav.update({ menuDir: { x: 0, y: 0 }, menuConfirm: false }, 1 / 60); // Flanke zuruecksetzen
    nav.update({ menuDir: { x: 1, y: 0 }, menuConfirm: false }, 1 / 60);
    check(range.value === '100', `P9: Regler ueberschreitet sein Maximum (${range.value})`);

    // (d) X auf einem Knopf bewegt weder Fokus noch loest es etwas aus --
    // insbesondere darf die Regler-Logik nicht versuchen, einen Knopf wie
    // einen Regler zu behandeln (el.value waere dort undefined -> NaN).
    nav.update({ menuDir: { x: 0, y: -1 }, menuConfirm: false }, 1); // zurueck auf btnA
    nav.update({ menuDir: { x: 0, y: -1 }, menuConfirm: false }, 1);
    check(btnA.classList.contains('menu-focus'), 'P9: Testaufbau (Fokus nicht auf btnA)');
    let btnAClicked = false;
    let btnAInputFired = false;
    btnA.addEventListener('click', () => (btnAClicked = true));
    btnA.addEventListener('input', () => (btnAInputFired = true));
    nav.update({ menuDir: { x: 1, y: 0 }, menuConfirm: false }, 1 / 60);
    check(!btnAClicked, 'P9: X-Achse loest auf einem Knopf etwas aus');
    check(!btnAInputFired, 'P9: X-Achse behandelt einen Knopf wie einen Regler (input-Ereignis)');
    check(btnA.value === undefined, `P9: X-Achse haengt einen Wert an den Knopf (value=${btnA.value})`);

    // (e) Bestaetigen klickt einen Knopf.
    nav.update({ menuDir: { x: 0, y: 0 }, menuConfirm: true }, 1 / 60);
    check(btnAClicked, 'P9: Bestaetigen klickt den fokussierten Knopf nicht');

    // (f) Bestaetigen togglet eine Checkbox MIT change-Ereignis (nicht nur
    // .checked stumm umschalten -- main.js haengt an 'change').
    let changed = false;
    checkbox.addEventListener('change', () => (changed = true));
    for (let i = 0; i < 3; i++) nav.update({ menuDir: { x: 0, y: 1 }, menuConfirm: false }, 1); // auf die Checkbox
    check(checkbox.classList.contains('menu-focus'), 'P9: Testaufbau (Fokus nicht auf der Checkbox)');
    nav.update({ menuDir: { x: 0, y: 0 }, menuConfirm: true }, 1 / 60);
    check(checkbox.checked === true, 'P9: Bestaetigen togglet die Checkbox nicht');
    check(changed, 'P9: Checkbox-Toggle feuert kein change-Ereignis');

    // (g) reset() springt zurueck auf den Anfang der Liste.
    nav.reset();
    nav.update({ menuDir: { x: 0, y: 0 }, menuConfirm: false }, 1 / 60);
    check(btnA.classList.contains('menu-focus'), 'P9: reset() springt nicht zum Listenanfang zurueck');
  } finally {
    restore();
  }
}

// ---- 8j. P9: getMenuState() braucht keinen Spieler -----------------------
// Der Startbildschirm existiert vor dem ersten Run -- getState(player)
// wuerde dort abstuerzen (kein Spieler). getMenuState() ist der eigens
// dafuer gebaute schlanke Pfad.
{
  const { installDom } = await import('./domstub.mjs');
  const restore = installDom();
  try {
    const { createInput } = await import('../src/core/input.js');
    const canvas = document.createElement('canvas');
    const input = createInput(window, canvas, { inputCfg: tanksData.input });
    const before = input.getMenuState();
    check(
      before && typeof before.menuDir === 'object' && typeof before.menuConfirm === 'boolean',
      'P9: getMenuState() liefert keine sinnvolle Struktur',
    );
    // Pfeiltaste runter -> menuDir.y > 0 (dieselben Codes wie data/input.json).
    window.emit('keydown', { code: 'ArrowDown', repeat: false, preventDefault() {} });
    const st = input.getMenuState();
    check(st.menuDir.y > 0, `P9: ArrowDown erzeugt kein menuDir.y (${JSON.stringify(st.menuDir)})`);
    window.emit('keyup', { code: 'ArrowDown' });
    // Enter -> menuConfirm EINMAL (danach wieder false, Ein-Frame-Flag).
    window.emit('keydown', { code: 'Enter', repeat: false, preventDefault() {} });
    check(input.getMenuState().menuConfirm === true, 'P9: Enter setzt menuConfirm nicht');
    check(input.getMenuState().menuConfirm === false, 'P9: menuConfirm wird nicht verbraucht (Ein-Frame-Flag)');
  } finally {
    restore();
  }
}

// ---- 8g. P8: Ausruestung auf eigener Vollbild-Seite ---------------------
// Die Upgrade-Chips lagen im Hauptbereich der Raumvorschau und haben dort
// bei vielen Karten den "Weiter"-Knopf aus dem Bild geschoben (Nutzer-
// Meldung). P8 verschiebt sie auf eine eigene Seite -- der Hauptbereich
// bleibt dadurch kurz. Geprueft wird beides: dass sie WEG sind und dass
// man ueberhaupt noch hinkommt.
{
  const { installDom } = await import('./domstub.mjs');
  // preview.js zieht ueber renderer.js die Sprite-Initialisierung mit --
  // dafuer muss das DOM (inkl. Image-Stub) schon beim IMPORT stehen.
  const restoreForImport = installDom();
  const { createPreview } = await import('../src/ui/preview.js');
  restoreForImport();
  const upgrades = Array.from({ length: 14 }, (_, i) => ({
    name: `Karte ${i}`,
    level: (i % 3) + 1,
    description: `Wirkung ${i}`,
    symbol: '★',
  }));
  const withPreview = (fn) => {
    const restore = installDom();
    try {
      fn(createPreview());
    } finally {
      restore();
    }
  };

  // (a) Hauptbereich: keine Upgrade-Chips mehr, stattdessen EIN Knopf.
  withPreview((pv) => {
    let started = false;
    pv.show({ title: 'Raum 5', character: 'Kampf', upgrades }, ['t_brown'], tanksData, () => {
      started = true;
    });
    const main = document.getElementById('preview');
    check(!main.classList.contains('hidden'), 'P8: Vorschau ist gar nicht offen');
    check(
      main.querySelectorAll('.pv-chip-up').length === 0,
      'P8: die Upgrade-Chips stehen weiterhin im Hauptbereich',
    );
    const open = document.getElementById('previewUpOpen');
    check(!!open, 'P8: kein Zugang zur Ausruestungsseite');
    check(/14/.test(open.textContent), `P8: Knopf nennt die Kartenzahl nicht ("${open.textContent}")`);
    // Der "Weiter"-Knopf funktioniert weiterhin.
    document.getElementById('previewGo').click();
    check(started, 'P8: "Weiter" startet den Raum nicht mehr');
    check(main.classList.contains('hidden'), 'P8: Vorschau bleibt nach "Weiter" offen');
  });

  // (b) Die Seite listet JEDE Karte mit Name und Wirkung -- auf der eigenen
  // Seite ist Platz, der Tipp-zum-Aufdecken entfaellt.
  withPreview((pv) => {
    pv.show({ title: 'Raum 5', upgrades }, ['t_brown'], tanksData, () => {});
    document.getElementById('previewUpOpen').click();
    const page = document.getElementById('previewUpgrades');
    check(!page.classList.contains('hidden'), 'P8: Ausruestungsseite oeffnet nicht');
    check(
      document.getElementById('preview').classList.contains('hidden'),
      'P8: Vorschau bleibt unter der Ausruestungsseite liegen (fangt Klicks ab)',
    );
    const rows = page.querySelectorAll('.pv-uprow');
    check(rows.length === upgrades.length, `P8: nicht alle Karten gelistet (${rows.length}/${upgrades.length})`);
    const txt = [...rows].map((r) => r.innerHTML).join('\n');
    check(txt.includes('Karte 0') && txt.includes('Wirkung 0'), 'P8: Name oder Wirkung fehlt auf der Seite');
    check(txt.includes('Stufe'), 'P8: die Stufe wird nicht ausgewiesen');
  });

  // (c) "Zurueck" fuehrt in die Vorschau, nicht in den Raum -- sonst waere
  // der Blick auf die Ausruestung eine Einbahnstrasse.
  withPreview((pv) => {
    let started = false;
    pv.show({ title: 'Raum 5', upgrades }, ['t_brown'], tanksData, () => {
      started = true;
    });
    document.getElementById('previewUpOpen').click();
    document.getElementById('previewUpBack').click();
    check(
      document.getElementById('previewUpgrades').classList.contains('hidden'),
      'P8: Ausruestungsseite schliesst nicht (blockiert die Eingabe)',
    );
    check(!document.getElementById('preview').classList.contains('hidden'), 'P8: Vorschau kommt nicht zurueck');
    check(!started, 'P8: "Zurueck" hat den Raum gestartet');
  });

  // (d) Ohne Upgrades gibt es auch keinen Knopf (frischer Run).
  withPreview((pv) => {
    pv.show({ title: 'Raum 1', upgrades: [] }, ['t_brown'], tanksData, () => {});
    check(!document.getElementById('previewUpOpen'), 'P8: Ausruestungs-Knopf erscheint ohne Karten');
  });

  // (e) hide() raeumt BEIDE Seiten weg -- sonst haengt die
  // Ausruestungsseite ueber dem Spiel (dieselbe Fehlerklasse wie der
  // Kartenscreen-Blocker).
  withPreview((pv) => {
    pv.show({ title: 'Raum 5', upgrades }, ['t_brown'], tanksData, () => {});
    document.getElementById('previewUpOpen').click();
    pv.hide();
    check(
      document.getElementById('previewUpgrades').classList.contains('hidden'),
      'P8: hide() laesst die Ausruestungsseite offen',
    );
  });
}

// ---- 8f. P7: Werte-Anzeige ---------------------------------------------
// Die Anzeige leitet ALLE Zahlen aus dem aufgeloesten cfg ab -- kein neues
// Feld. Geprueft wird deshalb (1) dass sie ohne Absturz zeichnet, (2) dass
// sie tatsaechlich Text ausgibt (sonst waere eine leere Box gruen) und
// (3) dass Upgrades die ausgegebenen Zahlen veraendern.
{
  const { createHud } = await import('../src/ui/hud.js');
  // Fake-Canvas, das jeden fillText mitschreibt.
  const texts = [];
  const fakeCtx = new Proxy(
    { canvas: { width: 768, height: 512 }, measureText: () => ({ width: 40 }) },
    {
      get: (t, k) => {
        if (k in t) return t[k];
        if (k === 'fillText') return (s) => texts.push(String(s));
        return () => {};
      },
      set: () => true,
    },
  );
  const hud = createHud(fakeCtx);

  const draw = (run) => {
    texts.length = 0;
    try {
      hud.render(run, { stats: true });
    } catch (e) {
      check(false, `P7: Werte-Anzeige wirft (${e.message})`);
    }
    return texts.join('\n');
  };

  const plain = createRun(tanksData, tilesData, diffData, upgradesData, 42);
  // Die Anzeige gilt nur im laufenden Raum -- ein frischer Run steht auf
  // 'preview' und wuerde gar nichts zeichnen.
  plain.phase = 'playing';
  const outPlain = draw(plain);
  check(/WERTE/.test(outPlain), 'P7: Werte-Anzeige zeichnet keine Ueberschrift');
  for (const label of ['Tempo', 'Geschosstempo', 'Abpraller', 'Magazin', 'Bomben', 'Bombenradius']) {
    check(outPlain.includes(label), `P7: Zeile "${label}" fehlt in der Werte-Anzeige`);
  }
  // Ohne Upgrades darf keine Abweichung ausgewiesen sein.
  check(!/\(\+\d+ %\)/.test(outPlain), 'P7: frischer Run zeigt bereits Upgrade-Abweichungen');

  // Mit Tempo-Upgrade muss sich die Tempo-Zeile messbar aendern.
  {
    const boosted = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const speedCard = upgradesData.upgrades.turbo;
    if (speedCard) {
      // Den Raum MIT dem Upgrade neu bauen -- run.upgrades nachtraeglich zu
      // setzen wirkt erst im naechsten Raum (Upgrades werden pro Raumbau
      // aufgeloest).
      const { createState } = await import('../src/game/state.js');
      const { rngFor, hashSeed } = await import('../src/core/rng.js');
      boosted.phase = 'playing';
      boosted.upgrades = { turbo: 1 };
      boosted.state = createState(tanksData, tilesData, {
        genRng: rngFor(42, 1, 'rooms'),
        enemyTypes: ['t_brown'],
        aiSeed: hashSeed(42, 1, 'ai'),
        playerUpgrades: { turbo: 1 },
        upgradesData,
        equippedSecondary: 'mine',
        equippedGadget: null,
        transform: {},
      });
      const before = plain.state.player.cfg.speed;
      const after = boosted.state.player.cfg.speed;
      check(after > before, `P7: Turbo aendert das Tempo nicht (${before} -> ${after}, Testaufbau)`);
      const out = draw(boosted);
      check(/\(\+\d+ %\)/.test(out), 'P7: Werte-Anzeige weist die Upgrade-Abweichung nicht aus');
    }
  }

  // Die Anzeige erscheint auch in der Pause (einziger Weg auf dem Handy).
  {
    texts.length = 0;
    hud.render(plain, { paused: true });
    check(texts.join('\n').includes('WERTE'), 'P7: Werte-Anzeige fehlt in der Pause (Handy-Weg)');
  }
  // ... und NICHT unaufgefordert im normalen Spiel.
  {
    texts.length = 0;
    hud.render(plain, {});
    check(!texts.join('\n').includes('WERTE'), 'P7: Werte-Anzeige ist dauerhaft eingeblendet');
  }
}

// ---- 8e. P6: Enterhaken ------------------------------------------------
// Fuenf Zusagen der Phase: Zielrichtung steuerbar, Ausloesen beim
// Loslassen (kommt aus P4), Zug an ALLEN Wandtypen, Abklingzeit AUCH ohne
// Treffer, waehrend des Zugs steuerlos. Dazu die Zielvorschau.
{
  const { createState } = await import('../src/game/state.js');
  const { useGadget, traceHook, moveTank } = await import('../src/game/tank.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');
  const hookCfg = tanksData.secondaries.hook;

  const mkRoom = () =>
    createState(tanksData, tilesData, {
      genRng: rngFor(3, 2, 'rooms'),
      enemyTypes: ['t_brown'],
      aiSeed: hashSeed(3, 2, 'ai'),
      playerUpgrades: { hook: 1 },
      upgradesData,
      equippedSecondary: 'mine',
      equippedGadget: 'hook',
      transform: {},
    });

  // (a) Vorschau und Schuss rechnen dasselbe. Das ist die eigentliche
  // Zusicherung: beide rufen traceHook() -- wuerde der Schuss eine eigene
  // Kopie benutzen, koennten sie auseinanderlaufen.
  {
    const st = mkRoom();
    const p = st.player;
    let geprueft = 0;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const t = traceHook(p, st, hookCfg, angle);
      if (!t.hit) continue;
      const px = p.x;
      const py = p.y;
      p.gadgetCooldown = 0;
      p.hookTimer = 0;
      p.hookTarget = null;
      useGadget(p, st, { angle, dist: 0 });
      check(
        !!p.hookTarget &&
          Math.abs(p.hookTarget.x - t.x) < 1e-9 &&
          Math.abs(p.hookTarget.y - t.y) < 1e-9,
        `P6: Vorschau und Schuss weichen ab (Winkel ${angle.toFixed(2)})`,
      );
      p.x = px;
      p.y = py;
      geprueft++;
    }
    check(geprueft >= 4, `P6: zu wenige Treffer-Richtungen geprueft (${geprueft})`);
  }

  // (b) Die Zielrichtung steuert den Haken -- nicht die Blickrichtung.
  // Vorher nutzte fireHook() immer tank.turret, der Wurfstick war wirkungslos.
  {
    const st = mkRoom();
    const p = st.player;
    // Zwei Richtungen suchen, die zu verschiedenen Ankern fuehren.
    let a1 = null;
    let a2 = null;
    for (let i = 0; i < 32 && (a1 === null || a2 === null); i++) {
      const ang = (i / 32) * Math.PI * 2;
      const t = traceHook(p, st, hookCfg, ang);
      if (!t.hit) continue;
      if (a1 === null) a1 = { ang, t };
      else if (Math.hypot(t.x - a1.t.x, t.y - a1.t.y) > 40) a2 = { ang, t };
    }
    check(!!a2, 'P6: keine zwei unterschiedlichen Ankerpunkte gefunden (Testaufbau)');
    if (a2) {
      p.turret = a1.ang; // Blickrichtung auf den EINEN Anker
      p.gadgetCooldown = 0;
      useGadget(p, st, { angle: a2.ang, dist: 0 }); // Zielstick auf den ANDEREN
      check(
        Math.hypot(p.hookTarget.x - a2.t.x, p.hookTarget.y - a2.t.y) < 1e-9,
        'P6: der Haken folgt der Blickrichtung statt der Zielvorgabe',
      );
    }
  }

  // (c) Fehlschuss kostet trotzdem die Abklingzeit -- und meldet sich.
  {
    const st = mkRoom();
    const p = st.player;
    // Richtung ohne Wand in Reichweite suchen.
    let miss = null;
    for (let i = 0; i < 64 && miss === null; i++) {
      const ang = (i / 64) * Math.PI * 2;
      if (!traceHook(p, st, hookCfg, ang).hit) miss = ang;
    }
    if (miss !== null) {
      st.sounds.length = 0;
      st.flashes.length = 0;
      p.gadgetCooldown = 0;
      const used = useGadget(p, st, { angle: miss, dist: 0 });
      check(used === true, 'P6: Fehlschuss gilt als nicht ausgeloest');
      check(p.gadgetCooldown > 0, 'P6: Fehlschuss kostet keine Abklingzeit');
      check(!p.hookTarget, 'P6: Fehlschuss zieht den Panzer trotzdem');
      check(
        st.sounds.some((s) => (s?.name || s) === 'empty'),
        'P6: Fehlschuss bleibt stumm',
      );
      check(st.flashes.some((f) => f.dim), 'P6: Fehlschuss ohne sichtbares Gegenstueck');
    }
  }

  // (d) Der Zug greift an allen Wandtypen, an denen sich etwas festmachen
  // laesst. Geprueft ueber isSolid(), das fireHook benutzt.
  {
    const st = mkRoom();
    const p = st.player;
    const { CELL } = await import('../src/config.js');
    for (const type of ['breakable', 'reflect', 'destructible']) {
      const w = st.walls.find((x) => x.type === type);
      if (!w) continue;
      check(
        st.isSolid(w.x + CELL / 2, w.y + CELL / 2),
        `P6: Haken findet an Wandtyp "${type}" keinen Halt`,
      );
    }
    // Die eigene Sperrmauer ebenfalls (sie schreibt ins Grid).
    const before = st.walls.length;
    p.turret = 0;
    st.placeTrapWall(p.x + CELL, p.y, 3);
    if (st.walls.length > before) {
      const tw = st.walls[st.walls.length - 1];
      check(st.isSolid(tw.x + CELL / 2, tw.y + CELL / 2), 'P6: Haken findet an der Sperrmauer keinen Halt');
    }
  }

  // (e) Waehrend des Zugs ignoriert die Bewegung jede Eingabe.
  {
    const st = mkRoom();
    const p = st.player;
    let ang = null;
    for (let i = 0; i < 32 && ang === null; i++) {
      const a = (i / 32) * Math.PI * 2;
      if (traceHook(p, st, hookCfg, a).hit) ang = a;
    }
    if (ang !== null) {
      p.gadgetCooldown = 0;
      useGadget(p, st, { angle: ang, dist: 0 });
      check(p.hookTimer > 0, 'P6: Zug startet nicht');
      const target = { ...p.hookTarget };
      // Gegenrichtung druecken -- darf den Zug nicht beeinflussen.
      const gegen = { x: -Math.cos(ang), y: -Math.sin(ang) };
      for (let i = 0; i < 30 && p.hookTimer > 0; i++) moveTank(p, gegen, st, 1 / 60);
      check(
        Math.hypot(p.x - target.x, p.y - target.y) < 24,
        `P6: Eingabe hat den Zug abgelenkt (${Math.hypot(p.x - target.x, p.y - target.y).toFixed(1)} px vom Ziel)`,
      );
    }
  }
}

// ---- 8d. P4: Bombenslot und Gadgetslot sind getrennt --------------------
// Kernzusage der Phase: die Bombe kann NIE verloren gehen (eigener, fester
// Slot), das Gadget ist der tauschbare zweite Slot. Vorher lagen beide in
// einem Slot -- wer eine Gadgetkarte nahm, verlor die Bombe.
{
  const { createState } = await import('../src/game/state.js');
  const { resolveCfg, applyUpgrades } = await import('../src/game/cfg.js');
  const { useGadget, useSecondary } = await import('../src/game/tank.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');

  const mkRoom = (upgrades, gadget) =>
    createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: ['t_brown'],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades: upgrades,
      upgradesData,
      equippedSecondary: 'mine',
      equippedGadget: gadget,
      transform: {},
    });

  // (a) Ohne jede Karte: Bombe da, Gadget leer.
  {
    const st = mkRoom({}, null);
    check(st.player.cfg.secondary === 'mine', 'P4: Bombe ist ohne Karten nicht ausgeruestet');
    check(st.player.cfg.gadget === null, 'P4: es ist ohne Karte schon ein Gadget ausgeruestet');
    check(useSecondary(st.player, st, null) === true, 'P4: Bombe laesst sich ohne Karten nicht legen');
    check(useGadget(st.player, st, null) === false, 'P4: leerer Gadgetslot loest trotzdem aus');
  }

  // (b) Mit Gadget: beide Slots unabhaengig nutzbar, Gadget mit Abklingzeit.
  {
    const st = mkRoom({ smoke: 1 }, 'smoke');
    check(st.player.cfg.gadget === 'smoke', 'P4: ausgeruestetes Gadget kommt nicht im cfg an');
    check(useGadget(st.player, st, null) === true, 'P4: Gadget loest nicht aus');
    check(st.smokeClouds.length === 1, 'P4: Gadget-Wirkung bleibt aus');
    check(st.player.gadgetCooldown > 0, 'P4: Gadget hat keine Abklingzeit gesetzt');
    check(useGadget(st.player, st, null) === false, 'P4: Gadget ignoriert die eigene Abklingzeit');
    // Die Bombe ist davon voellig unberuehrt -- das ist der Kern der Phase.
    check(useSecondary(st.player, st, null) === true, 'P4: Gadget-Abklingzeit blockiert auch die Bombe');
  }

  // (c) EMP kommt jetzt aus dem Gadgetslot, nicht mehr als "jede 4. Bombe".
  {
    const st = mkRoom({ emp_mine: 1 }, 'emp_mine');
    check(useGadget(st.player, st, null) === true, 'P4: EMP-Gadget loest nicht aus');
    const emp = st.mines.filter((m) => m.isEmp);
    check(emp.length === 1, `P4: EMP-Gadget legt keine EMP-Mine (${emp.length})`);
    // Die normale Bombe darf dadurch NICHT blau werden.
    useSecondary(st.player, st, null);
    check(st.mines.filter((m) => m.isEmp).length === 1, 'P4: die normale Bombe ist ebenfalls EMP geworden');
  }

  // (d) Die Kartenwahl ruestet das Gadget aus (echter Weg ueber
  //     pendingOffers, nicht ueber ein direkt gesetztes Feld).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    check(run.equippedGadget === null, 'P4: Run startet bereits mit einem Gadget');
    check(run.state.player.cfg.secondary === 'mine', 'P4: Run startet ohne Bombe');
    const card = Object.values(upgradesData.upgrades).find((u) => u.tag === 'gadget');
    check(!!card, 'P4: es gibt gar keine Gadgetkarte im Pool');
    run.phase = 'upgrade';
    run.pendingOffers = [card];
    chooseUpgrade(run, 0);
    check(run.equippedGadget === card.id, `P4: Gadgetkarte ruestet nicht aus (${run.equippedGadget})`);
  }

  // (e) Die Bombe ist keine Karte mehr -- sonst waere sie doppelt vergeben.
  check(!upgradesData.upgrades.mine, 'P4: die Minen-Karte ist noch im Pool, obwohl die Bombe fest ist');

  // (f) Jeder Gadget-Eintrag traegt seine Kategorie, sonst greift die
  //     Shop-Filterung ins Leere und boete die Bombe zum Tausch an.
  for (const [id, def] of Object.entries(tanksData.secondaries)) {
    if (id.startsWith('_')) continue;
    check(
      def.category === 'gadget' || def.category === 'secondary',
      `P4: secondaries.json "${id}" hat keine gueltige category`,
    );
  }
  check(tanksData.secondaries.mine.category === 'secondary', 'P4: die Bombe ist nicht als fester Slot markiert');
}

// ---- 8c. P3: Touch-Wurfstick der Sekundaerwaffe -------------------------
// Der Wurfstick loest NUR beim Loslassen aus. Bricht das System die
// Beruehrung ab (pointercancel: eingehender Anruf, System-Geste, zu viele
// Finger), darf keine Bombe fliegen -- vorher hing dieselbe Funktion an
// pointerup UND pointercancel, die Bombe flog also an eine Position, die der
// Spieler nie bestaetigt hatte.
{
  const { installDom } = await import('./domstub.mjs');
  const { createTouchControls } = await import('../src/ui/touchcontrols.js');
  // Mitte des Buttons laut domstub-Layout (offsetLeft/Top 10, 40x40).
  const CX = 30;
  const CY = 30;
  // JEDER Fall bekommt ein frisches DOM: createTouchControls() haengt einen
  // weiteren #mineBtn in den Body und weitere Listener an window -- ohne
  // Isolation wuerde der naechste Fall die Instanz des vorigen bedienen.
  const withTouch = (fn) => {
    const restore = installDom();
    try {
      const tc = createTouchControls({});
      fn(tc, document.getElementById('mineBtn'));
    } finally {
      restore();
    }
  };

  // (a) Normalfall: ziehen und loslassen wirft.
  withTouch((tc, btn) => {
    btn.emit('pointerdown', { pointerId: 1, clientX: CX, clientY: CY });
    btn.emit('pointermove', { pointerId: 1, clientX: CX + 40, clientY: CY });
    btn.emit('pointerup', { pointerId: 1, clientX: CX + 40, clientY: CY });
    const thrown = tc.consumeThrow();
    check(!!thrown, 'P3: Loslassen wirft die Bombe nicht mehr');
    check(thrown && thrown.dist > 0, 'P3: gezogener Wurf hat keine Weite');
    check(Math.abs(thrown?.angle ?? 9) < 1e-6, `P3: Wurfwinkel falsch (${thrown?.angle})`);
  });

  // (b) Der Fehlerfall: Abbruch durch das System wirft NICHT.
  withTouch((tc, btn) => {
    btn.emit('pointerdown', { pointerId: 2, clientX: CX, clientY: CY });
    btn.emit('pointermove', { pointerId: 2, clientX: CX + 40, clientY: CY });
    btn.emit('pointercancel', { pointerId: 2, clientX: CX + 40, clientY: CY });
    check(tc.consumeThrow() === null, 'P3: pointercancel wirft die Bombe trotzdem (Bug P3)');
    check(!tc.isSecondaryHeld(), 'P3: nach dem Abbruch gilt der Stick noch als gehalten');
    check(!btn.hasPointerCapture(2), 'P3: Pointer-Capture nach dem Abbruch nicht freigegeben');
  });

  // (c) Nach einem Abbruch muss der naechste Wurf wieder gehen -- ein
  // haengengebliebener Stick waere schlimmer als der urspruengliche Fehler.
  withTouch((tc, btn) => {
    btn.emit('pointerdown', { pointerId: 3, clientX: CX, clientY: CY });
    btn.emit('pointercancel', { pointerId: 3, clientX: CX, clientY: CY });
    btn.emit('pointerdown', { pointerId: 4, clientX: CX, clientY: CY });
    btn.emit('pointermove', { pointerId: 4, clientX: CX, clientY: CY + 40 });
    btn.emit('pointerup', { pointerId: 4, clientX: CX, clientY: CY + 40 });
    check(!!tc.consumeThrow(), 'P3: nach einem Abbruch laesst sich nicht mehr werfen');
  });

  // (d) Ein zweiter Finger auf dem Button uebernimmt den Zug nicht.
  // Sonst zeigt die gemerkte pointerId auf den neuen Finger und das
  // Loslassen des ERSTEN wird stillschweigend verworfen.
  withTouch((tc, btn) => {
    btn.emit('pointerdown', { pointerId: 5, clientX: CX, clientY: CY });
    btn.emit('pointermove', { pointerId: 5, clientX: CX + 40, clientY: CY });
    btn.emit('pointerdown', { pointerId: 6, clientX: CX, clientY: CY }); // zweiter Finger
    btn.emit('pointerup', { pointerId: 5, clientX: CX + 40, clientY: CY });
    check(!!tc.consumeThrow(), 'P3: zweiter Finger schluckt den Wurf des ersten');
  });

  // (e) Sperrzone pro Beruehrung: Bombenknopf und Fahrflaeche gleichzeitig
  // angetippt -- der Fahrstick muss trotzdem entstehen. Frueher pruefte
  // onStart nur e.target (die ERSTE Beruehrung) und verwarf dadurch beide.
  withTouch((tc, btn) => {
    const arena = document.createElement('canvas');
    document.body.appendChild(arena);
    window.emit('touchstart', {
      target: btn,
      changedTouches: [
        { identifier: 1, target: btn, clientX: CX, clientY: CY },
        { identifier: 2, target: arena, clientX: 100, clientY: 200 },
      ],
    });
    check(tc.hasContact(), 'P3: gleichzeitiger Knopfdruck schluckt den Fahrstick');
    // Ein frischer Stick hat noch keine Auslenkung -- erst die Bewegung
    // ergibt einen Fahrwert.
    window.emit('touchmove', {
      changedTouches: [{ identifier: 2, target: arena, clientX: 140, clientY: 200 }],
    });
    const mv = tc.getMove();
    check(mv.x > 0, `P3: Fahrstick liefert keine Bewegung (x=${mv.x})`);
  });

  // (f) Die Sperrzone gilt weiterhin: eine Beruehrung AUF dem Knopf allein
  // erzeugt keinen Fahrstick (sonst waere (e) auf Kosten der Sperrzone
  // erkauft).
  withTouch((tc, btn) => {
    window.emit('touchstart', {
      target: btn,
      changedTouches: [{ identifier: 1, target: btn, clientX: CX, clientY: CY }],
    });
    check(!tc.hasContact(), 'P3: Beruehrung auf dem Bombenknopf erzeugt einen Fahrstick');
  });
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

// ---- 9. UMBAUPLAN-LP Phase 1: Schadensmodell ----------------------------
// Der Umbau von "ein Treffer toetet" auf Lebenspunkte. Diese Pruefungen
// testen bewusst den MECHANISMUS mit eigenen Zahlen, nicht die aktuellen
// Werte aus tanks.json (die stehen in Phase 1 noch ueberall auf 1 und
// werden in Phase 2/3 planmaessig ersetzt) -- sonst waere der Test schon
// durch die naechste Phase wieder rot, ohne dass etwas kaputt ist.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { explodeAt } = await import('../src/game/mine.js');
  const { fireBullet } = await import('../src/game/tank.js');
  const { stepState } = await import('../src/game/state.js');

  // (a) Struktur: jeder Panzertyp hat maxHp und damage. Das ist der Waechter
  // dafuer, dass Phase 2 keinen Typ vergisst -- ein Gegner ohne maxHp faellt
  // sonst still auf den Fallback 1 zurueck und stirbt mitten im
  // Lebenspunkte-Spiel weiter am ersten Treffer.
  {
    const fehlend = Object.entries(tanksData.types)
      .filter(([, t]) => typeof t.maxHp !== 'number' || typeof t.damage !== 'number')
      .map(([id]) => id);
    check(fehlend.length === 0, `Phase 1: Typen ohne maxHp/damage in tanks.json: ${fehlend.join(', ')}`);
    const ungueltig = Object.entries(tanksData.types)
      .filter(([, t]) => t.maxHp <= 0)
      .map(([id]) => id);
    check(ungueltig.length === 0, `Phase 1: Typen mit maxHp <= 0 (waeren sofort tot): ${ungueltig.join(', ')}`);
  }

  // (b) Panzer starten mit vollen Lebenspunkten aus dem cfg.
  // WICHTIG mit einem cfg.maxHp != 1 geprueft: solange in tanks.json ueberall
  // 1 steht, waere "hp === cfg.maxHp" im echten Raum trivial erfuellt -- ein
  // hartkodiertes `hp: 1` in createTank() wuerde glatt durchrutschen (in der
  // Gegenprobe genau so passiert). Der Raum-Durchlauf darunter wird erst ab
  // Phase 2 aussagekraeftig und bleibt als Waechter fuer dann stehen.
  {
    const { createTank } = await import('../src/game/tank.js');
    const t = createTank('player', { maxHp: 42, radius: 10 }, 0, 0);
    check(t.hp === 42, `Phase 1: createTank() uebernimmt cfg.maxHp nicht (hp=${t.hp})`);
    const ohne = createTank('player', { radius: 10 }, 0, 0);
    check(ohne.hp === 1, `Phase 1: createTank() ohne maxHp faellt nicht auf 1 zurueck (hp=${ohne.hp})`);

    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    for (const tk of run.state.tanks) {
      check(tk.hp === tk.cfg.maxHp, `Phase 1: ${tk.type} startet mit hp ${tk.hp} statt maxHp ${tk.cfg.maxHp}`);
    }
  }

  // (c) Der Kern: applyDamage zieht ab und toetet ERST bei hp <= 0.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const e = st.tanks.find((t) => t !== st.player && t.alive);
    check(!!e, 'Phase 1: kein Gegner fuer den Schadenstest');
    if (e) {
      e.cfg.maxHp = 10;
      e.hp = 10;
      e.shieldReady = false;
      st.applyDamage(e, 4, 'test');
      check(e.hp === 6 && e.alive, `Phase 1: Teilschaden toetet oder rechnet falsch (hp=${e.hp}, alive=${e.alive})`);
      st.applyDamage(e, 4, 'test');
      check(e.hp === 2 && e.alive, `Phase 1: zweiter Teilschaden falsch (hp=${e.hp}, alive=${e.alive})`);
      const kills = st.enemyKills;
      st.applyDamage(e, 2, 'test');
      check(!e.alive, 'Phase 1: hp auf 0 hat den Panzer nicht getoetet');
      check(st.enemyKills === kills + 1, 'Phase 1: der Tod lief nicht durch killTank() (Statistik zaehlt nicht)');
    }
  }

  // (d) Die Abwehr-Gatter sitzen in applyDamage, nicht mehr in killTank:
  // ein Schild faengt den TREFFER ab, es wird also gar kein Schaden gezogen.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const e = st.tanks.find((t) => t !== st.player && t.alive);
    if (e) {
      e.cfg.maxHp = 10;
      e.hp = 10;
      e.shieldReady = true;
      st.applyDamage(e, 4, 'test');
      check(e.hp === 10, `Phase 1: Gegnerschild hat den Schaden nicht abgefangen (hp=${e.hp})`);
      check(!e.shieldReady, 'Phase 1: Gegnerschild wurde nicht verbraucht');
      check(e.alive, 'Phase 1: Gegner mit Schild ist trotzdem gestorben');
    }
    // Spieler-Schildladung (raumuebergreifend) genauso.
    const p = st.player;
    p.cfg.maxHp = 100;
    p.hp = 100;
    p.shieldReady = false;
    st.shieldCharges = [3];
    st.applyDamage(p, 25, 'test');
    check(p.hp === 100, `Phase 1: Schildladung hat den Schaden nicht abgefangen (hp=${p.hp})`);
    check(st.shieldCharges.length === 0, 'Phase 1: Schildladung wurde nicht verbraucht');
  }

  // (e) Der unverwundbare Reaktorkern (Phase 14) nimmt weiterhin keinen
  // Schaden, solange Generatoren stehen -- und ist danach normal verwundbar.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const e = st.tanks.find((t) => t !== st.player && t.alive);
    if (e) {
      e.cfg.bossInvincible = true;
      e.cfg.maxHp = 50;
      e.hp = 50;
      e.shieldReady = false;
      st.bossGeneratorsLeft = 1;
      st.applyDamage(e, 20, 'test');
      check(e.hp === 50, `Phase 1: Reaktorkern nimmt trotz stehender Generatoren Schaden (hp=${e.hp})`);
      st.bossGeneratorsLeft = 0;
      st.applyDamage(e, 20, 'test');
      check(e.hp === 30, `Phase 1: Reaktorkern nimmt ohne Generatoren keinen Schaden (hp=${e.hp})`);
    }
  }

  // (f) Geschosse tragen den Schaden ihres Schuetzen -- und zwar den Wert,
  // der beim ABSCHUSS galt (nicht den, der beim Treffer gilt).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const p = st.player;
    p.cfg.damage = 7;
    p.cooldown = 0;
    st.bullets.length = 0;
    fireBullet(p, st, true);
    const b = st.bullets.find((x) => x.owner === p);
    check(b?.damage === 7, `Phase 1: Geschoss traegt den Schaden des Schuetzen nicht (${b?.damage})`);
    p.cfg.damage = 99; // nachtraegliche Aenderung darf die fliegende Kugel nicht ruecknwirkend staerken
    check(b?.damage === 7, 'Phase 1: eine fliegende Kugel aendert rueckwirkend ihren Schaden');
  }

  // (g) Ein Geschosstreffer wendet den Geschossschaden an (nicht pauschal 1).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const p = st.player;
    const e = st.tanks.find((t) => t !== p && t.alive);
    if (e) {
      e.cfg.maxHp = 30;
      e.hp = 30;
      e.shieldReady = false;
      e.cfg.armor = null;
      e.cfg.requiresRicochet = false;
      e.protect = 0;
      st.bullets.length = 0;
      // Kugel direkt auf den Gegner setzen, Besitzer ist ein Dritter (damit
      // weder Selbst-Immunitaet noch die "erst nach Abpraller scharf"-Regel
      // greift).
      const shooter = st.tanks.find((t) => t !== p && t !== e) || p;
      const b = createBullet(e.x, e.y, 0, {
        speed: 1, radius: 3, ricochets: 1, owner: shooter, kind: 'bullet', damage: 12,
      });
      b.age = 5;
      st.bullets.push(b);
      stepState(st, { move: { x: 0, y: 0 }, aim: { x: e.x, y: e.y }, fire: false, mine: false, dash: false }, 1 / 60);
      check(e.hp === 18, `Phase 1: Geschosstreffer zieht nicht den Geschossschaden ab (hp=${e.hp}, erwartet 18)`);
      check(e.alive, 'Phase 1: 12 Schaden auf 30 LP haben getoetet');
    }
  }

  // (h) Explosionen ziehen den Explosionsschaden aus balance.json.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const e = st.tanks.find((t) => t !== st.player && t.alive);
    if (e) {
      e.cfg.maxHp = 100;
      e.hp = 100;
      e.shieldReady = false;
      e.protect = 0;
      explodeAt(st, e.x, e.y, 40, null, {}, 35);
      check(e.hp === 65, `Phase 1: Explosion zieht den uebergebenen Schaden nicht ab (hp=${e.hp})`);
      const erwartet = 65 - (tanksData.balance?.damage?.explosion ?? 1);
      explodeAt(st, e.x, e.y, 40, null, {});
      check(e.hp === erwartet, `Phase 1: Explosion ohne Angabe nutzt nicht balance.damage.explosion (hp=${e.hp})`);
    }
  }

  // (i) killTank() bleibt der Trichter fuer den Tod und ist direkt
  // aufrufbar -- unabhaengig von den Lebenspunkten (Tests/Cheats raeumen
  // damit Raeume ab). Doppelaufruf darf die Statistik nicht doppelt zaehlen.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const e = st.tanks.find((t) => t !== st.player && t.alive);
    if (e) {
      e.cfg.maxHp = 999;
      e.hp = 999;
      const kills = st.enemyKills;
      st.killTank(e, 'test');
      check(!e.alive, 'Phase 1: killTank() toetet nicht mehr direkt');
      check(st.enemyKills === kills + 1, 'Phase 1: killTank() zaehlt den Kill nicht');
      st.killTank(e, 'test');
      check(st.enemyKills === kills + 1, 'Phase 1: doppelter killTank() zaehlt den Kill zweimal');
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
