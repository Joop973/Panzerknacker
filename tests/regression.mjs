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
tanksData.status = load('status'); // UMBAUPLAN-LP Phase 5
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
        // Seit dem LP-Umbau (Phase 2) haben Gegner 20-50 LP: die Kugel muss
        // ausdruecklich toedlich sein, sonst zaehlt kein Kill. Frueher war
        // jeder Treffer toedlich, deshalb stand hier gar kein Schaden.
        damage: enemy.cfg.maxHp,
      });
      // CMD/STEP stehen erst weiter unten (const) -- hier lokal.
      stepRun(run, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false }, 1 / 60);
      check(
        st.player.powershotCharges === 1,
        `Doppelschlag wirkt nicht: powershotCharges = ${st.player.powershotCharges} (erwartet 1)`,
      );
      // Der Kill zaehlt als Abpraller-Kill (die freiwilligen Bankshots aus
      // USP-Kennzahl 3 sind mit Phase 8 ausgemustert).
      check(
        st.ricochetKills === 1,
        `Abpraller-Kill nicht gezählt (ricochet=${st.ricochetKills})`,
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

// ---- 10. UMBAUPLAN-LP Phase 2: Gegner-LP, Skalierung, Lebensleiste ------
{
  const { applyHpScaling, isBossCfg } = await import('../src/game/cfg.js');
  const T = tanksData.types;
  const dmg = T.player.damage;
  const BOSSE = ['t_reactor', 't_mirror', 't_phalanx'];

  // (a) Trefferzahl je Gegnertyp gegen den Standardpanzer. Genau der Test,
  // den Plan-Phase 28 verlangt ("Weicht sie von der Tabelle in Phase 2 ab
  // -> Fehler"). Bewusst als BAND geprueft, nicht als Einzelwert: die
  // Festlegungstabelle des Plans sagt "Gegnerhaerte 2-5 Treffer, Elite 10,
  // Boss 50" -- das ist die Design-Zusage, nicht die einzelne Zahl.
  {
    // Spielbare Klassen (player:true, Phase 9) sind KEINE Gegner und fallen
    // aus der Gegnerhaerte-Pruefung heraus.
    for (const [id, t] of Object.entries(T)) {
      if (t.player || BOSSE.includes(id)) continue;
      const treffer = Math.ceil(t.maxHp / dmg);
      check(
        treffer >= 2 && treffer <= 5,
        `Phase 2: ${id} braucht ${treffer} Treffer (${t.maxHp} LP), erlaubt sind 2-5`,
      );
    }
    // Elite verdoppelt -> hoechstens 10 Treffer.
    const haertester = Math.max(
      ...Object.entries(T).filter(([id, t]) => !t.player && !BOSSE.includes(id)).map(([, t]) => t.maxHp),
    );
    check(
      Math.ceil((haertester * diffData.elite.hpMult) / dmg) === 10,
      `Phase 2: haertester Elitegegner braucht ${Math.ceil((haertester * diffData.elite.hpMult) / dmg)} Treffer, erwartet 10`,
    );
    // Boss: 50 Treffer -- bei der Phalanx zaehlt die FORMATION (5 Panzer),
    // nicht der einzelne. 500 LP je Phalanx-Wache waeren 250 Treffer.
    check(
      Math.ceil(T.t_reactor.maxHp / dmg) === 50 && Math.ceil(T.t_mirror.maxHp / dmg) === 50,
      'Phase 2: Reaktor/Spiegel brauchen nicht 50 Treffer',
    );
    check(
      Math.ceil((T.t_phalanx.maxHp * 5) / dmg) === 50,
      `Phase 2: die 5er-Phalanx braucht zusammen ${Math.ceil((T.t_phalanx.maxHp * 5) / dmg)} Treffer, erwartet 50`,
    );
  }

  // (b) Skalierungsformel: maxHp * (1 + perRoom * (raum - 1)).
  {
    const perRoom = diffData.hpScaling.perRoom;
    for (const raum of [1, 5, 11, 15]) {
      const cfg = { maxHp: 20 };
      applyHpScaling(cfg, 1 + perRoom * (raum - 1), true);
      check(
        cfg.maxHp === Math.round(20 * (1 + perRoom * (raum - 1))),
        `Phase 2: Skalierung in Raum ${raum} falsch (${cfg.maxHp})`,
      );
    }
    // Raum 1 skaliert nicht.
    const c1 = { maxHp: 20 };
    applyHpScaling(c1, 1, true);
    check(c1.maxHp === 20, 'Phase 2: Raum 1 skaliert bereits');
  }

  // (c) Bosse sind von der Raumskalierung ausgenommen -- sonst waere der
  // Boss in der letzten Raumreihe rund 87 statt der geplanten 50 Treffer.
  {
    const boss = { maxHp: 500, bossInvincible: true };
    applyHpScaling(boss, 1.75, true);
    check(boss.maxHp === 500, `Phase 2: Boss wurde mitskaliert (${boss.maxHp} LP)`);
    check(isBossCfg({ mirrorBoss: true }) && isBossCfg({ phalanx: true }), 'Phase 2: isBossCfg erkennt nicht alle Bosse');
    check(!isBossCfg({ maxHp: 20 }), 'Phase 2: isBossCfg haelt einen normalen Gegner fuer einen Boss');
    // Ohne die Ausnahme muss die Skalierung dagegen greifen.
    const boss2 = { maxHp: 500, bossInvincible: true };
    applyHpScaling(boss2, 1.75, false);
    check(boss2.maxHp === 875, `Phase 2: skipBosses=false wirkt nicht (${boss2.maxHp})`);
  }

  // (d) Panzerung blockt weiterhin GANZ -- kein Teilschaden. Mit
  // Lebenspunkten waere "Panzerung zieht nur einen Teil ab" ein naheliegender
  // Umbau, den Phase 2 ausdruecklich NICHT will.
  {
    const { armorBlocks } = await import('../src/game/armor.js');
    const { createBullet } = await import('../src/game/bullet.js');
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const e = st.tanks.find((t) => t !== st.player && t.alive);
    if (e) {
      e.cfg.armor = { arc: 120, reflects: true };
      e.cfg.maxHp = 50;
      e.hp = 50;
      e.heading = 0;
      const b = createBullet(e.x + 40, e.y, Math.PI, {
        speed: 100, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet', damage: 10,
      });
      check(armorBlocks(e, b), 'Phase 2: Frontpanzerung blockt den Frontaltreffer nicht mehr');
      check(e.hp === 50, `Phase 2: Frontpanzerung laesst Teilschaden durch (hp=${e.hp})`);
    }
  }

  // (e) Eine Mine muss auch mit Lebenspunkten noch etwas ausrichten. Ohne
  // diesen Waechter faellt balance.damage.explosion still auf einen Wert
  // zurueck, bei dem Minen (und alle sieben Minen-Karten) wirkungslos sind,
  // ohne dass irgendetwas kaputtgeht -- ein lautloser Totalausfall.
  {
    const expl = tanksData.balance.damage.explosion;
    const schwaechster = Math.min(
      ...Object.entries(T).filter(([id]) => id !== 'player' && !BOSSE.includes(id)).map(([, t]) => t.maxHp),
    );
    check(
      expl >= schwaechster,
      `Phase 2: Explosionsschaden ${expl} toetet nicht einmal den schwaechsten Gegner (${schwaechster} LP) -- Minen waeren wirkungslos`,
    );
  }

  // (f) Lebensleiste: erscheint NUR am angeschlagenen Panzer. Laeuft ueber
  // den echten Renderpfad (renderer.js) mit aufzeichnendem Canvas aus
  // tests/domstub.mjs -- bis hierher hat die Node-Suite renderer.js nie
  // ausgefuehrt, genau die Luecke, aus der seinerzeit der Ziellinien-Crash kam.
  {
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    try {
      const { createRenderer } = await import('../src/render/renderer.js');
      const { createTracks } = await import('../src/render/tracks.js');
      const ctx = document.createElement('canvas').getContext('2d');
      const renderer = createRenderer(ctx);
      const tracks = createTracks();
      const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
      const st = run.state;
      const e = st.tanks.find((t) => t !== st.player && t.alive);
      // Die Leiste ist der einzige 3 px hohe fillRect im Renderpfad.
      const balken = () => {
        ctx.calls.length = 0;
        renderer.render(st, 0, tracks, null, null);
        return ctx.calls.filter((c) => c.fn === 'fillRect' && c.args[3] === 3).length;
      };
      // Der Spieler zeigt seine Leiste seit Phase 3 IMMER (siehe unten) --
      // die Gegner-Leisten sind also alles darueber hinaus.
      const SPIELER = 1;
      if (e) {
        e.cfg.maxHp = 40;
        e.hp = 40;
        check(balken() === SPIELER + 0, 'Phase 2: unbeschaedigter Gegner zeigt bereits eine Lebensleiste');
        e.hp = 20;
        check(balken() === SPIELER + 1, 'Phase 2: angeschlagener Gegner zeigt keine Lebensleiste');
        // Zweiter angeschlagener Gegner -> zwei Leisten.
        const e2 = st.tanks.find((t) => t !== st.player && t !== e && t.alive);
        if (e2) {
          e2.cfg.maxHp = 40;
          e2.hp = 10;
          check(balken() === SPIELER + 2, 'Phase 2: zweiter angeschlagener Gegner bekommt keine eigene Leiste');
        }
      }
    } finally {
      restore();
    }
  }
}

// ---- 11. UMBAUPLAN-LP Phase 3: Spieler-LP, Heilung, Schadenszahlen ------
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { explodeAt } = await import('../src/game/mine.js');
  const { stepState } = await import('../src/game/state.js');
  const T = tanksData.types;
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  // Frischer Raum ohne jeden Schutz -- Spawnschutz und Schilde wuerden die
  // Schadenspruefung sonst verschlucken.
  const blank = () => {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    st.player.protect = 0;
    st.player.shieldReady = false;
    st.shieldCharges = [];
    return { run, st };
  };
  // Einen Treffer zustellen: Kugel des Schuetzen direkt auf dem Spieler.
  // BEWUSST ohne Wandabpraller (wallBounces bleibt 0) -- seit Phase 4
  // verdoppelt ein Wandkontakt den Schaden, die Grundwerte dieser Phase
  // liessen sich damit gar nicht mehr messen. Fuer die eigene Kugel wird
  // stattdessen `reflected` gesetzt: das macht sie fuer den Schuetzen scharf
  // (isLive), zaehlt aber bewusst NICHT als Wandkontakt -- eine vom Prisma
  // zurueckgeworfene eigene Kugel trifft also mit dem Grundwert 15, eine an
  // der Wand gebandete mit 30 (Phase 4, eigener Test in Abschnitt 12).
  const treffer = (st, owner, dmg) => {
    const p = st.player;
    p.protect = 0;
    const b = createBullet(p.x, p.y, 0, {
      speed: 1, radius: 3, ricochets: 1, owner, kind: 'bullet', damage: dmg ?? owner.cfg.damage,
    });
    b.age = 5;
    if (owner === p) b.reflected = true;
    st.bullets.length = 0;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
  };

  // (a) Vier Gegnertreffer toeten den Spieler -- der vierte, nicht frueher.
  // Wertepruefung: die Tabelle in Phase 3 IST hier die Zusage. (Plan-Phase 9
  // gibt den Klassen 90-115 LP, dann wird daraus ein Band von 4-5 Treffern.)
  {
    const { st } = blank();
    const e = st.tanks.find((t) => t !== st.player && t.alive);
    if (e) {
      for (let i = 1; i <= 3; i++) {
        treffer(st, e);
        check(st.player.alive, `Phase 3: Spieler stirbt schon am ${i}. Gegnertreffer (hp=${st.player.hp})`);
      }
      treffer(st, e);
      check(!st.player.alive, `Phase 3: Spieler ueberlebt den 4. Gegnertreffer (hp=${st.player.hp})`);
    }
  }

  // (b) Die eigene, zurueckgekommene Kugel tut weniger weh als ein
  // Gegnerschuss und ist aus voller Gesundheit NIE toedlich -- der Kern der
  // Phase ("der Bankschuss bleibt eine Entscheidung, wird aber kein
  // Todesurteil mehr").
  {
    const { st } = blank();
    const p = st.player;
    const voll = p.hp;
    treffer(st, p);
    const eigen = voll - p.hp;
    check(p.alive, 'Phase 3: die eigene Kugel toetet aus voller Gesundheit');
    check(
      eigen === tanksData.balance.damage.ownBullet,
      `Phase 3: eigene Kugel macht ${eigen} statt ${tanksData.balance.damage.ownBullet} Schaden`,
    );
    check(
      eigen < T.t_brown.damage,
      `Phase 3: die eigene Kugel (${eigen}) tut nicht weniger weh als ein Gegnerschuss (${T.t_brown.damage})`,
    );
    check(
      eigen < T.player.maxHp,
      'Phase 3: die eigene Kugel ist aus voller Gesundheit toedlich',
    );
  }

  // (c) Minenexplosion. Geprueft wird beides: dass der Wert aus balance.json
  // beim Spieler ankommt UND die beiden Design-Aussagen des Plans, die von
  // der konkreten Zahl unabhaengig sind -- eine Mine ist der haerteste
  // Einzelschlag (haerter als ein Gegnerschuss), toetet aus voller
  // Gesundheit aber nicht. Ohne die zweite Haelfte wuerde der Test nur den
  // Code gegen die JSON vergleichen und jede Wertaenderung mitmachen.
  {
    const { st } = blank();
    const p = st.player;
    const voll = p.hp;
    explodeAt(st, p.x, p.y, 60, null, { code: 'own_mine' });
    const mine = voll - p.hp;
    check(
      mine === tanksData.balance.damage.explosion,
      `Phase 3: Minenexplosion macht ${mine} statt ${tanksData.balance.damage.explosion} Schaden`,
    );
    check(
      mine > T.t_brown.damage,
      `Phase 3: die Mine (${mine}) trifft nicht haerter als ein Gegnerschuss (${T.t_brown.damage})`,
    );
    check(p.alive, 'Phase 3: eine einzelne Mine toetet aus voller Gesundheit');
  }

  // (d) Bossangriff trifft haerter als ein normaler Gegner.
  {
    check(
      T.t_reactor.damage > T.t_brown.damage,
      `Phase 3: Bossangriff (${T.t_reactor.damage}) trifft nicht haerter als ein normaler Gegner (${T.t_brown.damage})`,
    );
    const { st } = blank();
    const e = st.tanks.find((t) => t !== st.player && t.alive);
    if (e) {
      let n = 0;
      while (st.player.alive && n < 10) {
        treffer(st, e, T.t_reactor.damage);
        n++;
      }
      check(n === 3, `Phase 3: Boss toetet nach ${n} statt 3 Treffern`);
    }
  }

  // (e) Heilung: JEDER neue Raum startet mit vollen LP -- ohne eigenen Hook,
  // weil createTank() (das hp = cfg.maxHp setzt) bei jedem Raumaufbau,
  // Respawn und Wellen-Spawn ohnehin laeuft. Genau die Ersparnis, die
  // Phase 1 angelegt hat.
  {
    // Raumwechsel.
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    enterRoom(run);
    let g = 0;
    while (run.phase !== 'playing' && g++ < 300) stepRun(run, CMD0, 1 / 60);
    run.state.player.hp = 20; // angeschlagen in den naechsten Raum
    const st = run.state;
    for (const t of st.tanks) if (t !== st.player && t.alive) st.killTank(t, 'test');
    g = 0;
    while (run.phase !== 'upgrade' && run.phase !== 'map' && g++ < 900) stepRun(run, CMD0, 1 / 60);
    if (run.phase === 'upgrade') chooseUpgrade(run, 0);
    if (run.phase === 'map') {
      const c = run.map.byId.get(run.mapCurrentId);
      for (const id of c?.next || []) if (chooseMapNode(run, id)) break;
    }
    if (run.phase === 'preview') enterRoom(run);
    g = 0;
    while (run.phase !== 'playing' && g++ < 300) stepRun(run, CMD0, 1 / 60);
    check(
      run.state.player.hp === run.state.player.cfg.maxHp,
      `Phase 3: neuer Raum startet mit ${run.state.player.hp}/${run.state.player.cfg.maxHp} LP statt voll`,
    );

    // Respawn nach dem Tod.
    const r2 = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    r2.phase = 'playing';
    r2.state.player.hp = 5;
    r2.state.killTank(r2.state.player, 'test');
    g = 0;
    while (g++ < 600 && !r2.state.player.alive) stepRun(r2, CMD0, 1 / 60);
    check(r2.state.player.alive, 'Phase 3: Spieler ist nach dem Respawn-Fenster nicht zurueck');
    check(
      r2.state.player.hp === r2.state.player.cfg.maxHp,
      `Phase 3: Respawn mit ${r2.state.player.hp} statt vollen LP`,
    );
  }

  // (f) Die Lebensleiste des Spielers ist IMMER sichtbar, auch unbeschaedigt
  // (anders als bei Gegnern, siehe Abschnitt 10). Ohne sie muesste man
  // waehrend des Zielens in die Bildschirmecke schauen -- genau das, was der
  // Plan mit "am Panzer, nicht nur am Bildschirmrand" ausschliesst.
  {
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    try {
      const { createRenderer } = await import('../src/render/renderer.js');
      const { createTracks } = await import('../src/render/tracks.js');
      const ctx = document.createElement('canvas').getContext('2d');
      const renderer = createRenderer(ctx);
      const tracks = createTracks();
      const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
      const st = run.state;
      // Alle Gegner unbeschaedigt -> jede gezeichnete Leiste ist die des Spielers.
      for (const t of st.tanks) t.hp = t.cfg.maxHp;
      const balken = () => {
        ctx.calls.length = 0;
        renderer.render(st, 0, tracks, null, null);
        return ctx.calls.filter((c) => c.fn === 'fillRect' && c.args[3] === 3).length;
      };
      check(balken() === 1, 'Phase 3: unbeschaedigter Spieler zeigt keine Lebensleiste');
      st.player.hp = Math.round(st.player.cfg.maxHp / 2);
      check(balken() === 1, 'Phase 3: angeschlagener Spieler zeigt keine Lebensleiste');
    } finally {
      restore();
    }
  }
}

// ---- 12. UMBAUPLAN-LP Phase 4: Abprall-Bonus ----------------------------
// "Der Abprall bleibt relevant, ohne erzwungen zu sein": eine Kugel mit
// Wandkontakt richtet doppelten Schaden an -- kein Upgrade, keine
// Klassenregel, und ausdruecklich fuer BEIDE Seiten.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { stepState } = await import('../src/game/state.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
  const MULT = tanksData.balance.bullet.wallBounceDamageMult;

  const blank = () => {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    st.player.protect = 0;
    st.player.shieldReady = false;
    st.shieldCharges = [];
    return st;
  };
  // Einen Treffer zustellen und den tatsaechlich abgezogenen Schaden melden.
  const schadenAn = (st, ziel, owner, opt = {}) => {
    ziel.protect = 0;
    ziel.shieldReady = false;
    if (ziel !== st.player) {
      ziel.cfg.armor = null;
      ziel.cfg.requiresRicochet = false;
    }
    const vorher = ziel.hp;
    const b = createBullet(ziel.x, ziel.y, 0, {
      speed: 1, radius: 3, ricochets: 1, owner, kind: 'bullet',
      damage: opt.damage ?? owner.cfg.damage,
      explosive: !!opt.explosive,
      explosionRadius: opt.explosive ? 60 : 0,
    });
    b.age = 5;
    b.wallBounces = opt.bounces ?? 0;
    b.reflected = !!opt.reflected;
    st.bullets.length = 0;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
    return vorher - ziel.hp;
  };
  const gegner = (st) => st.tanks.find((t) => t !== st.player && t.alive);

  // (a) Gegen einen Gegner: Wandkontakt verdoppelt.
  {
    const st1 = blank();
    const e1 = gegner(st1);
    e1.cfg.maxHp = 500;
    e1.hp = 500; // hoch genug, dass beide Varianten ueberlebt werden
    const direkt = schadenAn(st1, e1, st1.player);
    const st2 = blank();
    const e2 = gegner(st2);
    e2.cfg.maxHp = 500;
    e2.hp = 500;
    const gebandet = schadenAn(st2, e2, st2.player, { bounces: 1 });
    check(direkt > 0, 'Phase 4: direkter Treffer richtet gar keinen Schaden an');
    check(
      gebandet === Math.round(direkt * MULT),
      `Phase 4: Abpraller macht ${gebandet} statt ${Math.round(direkt * MULT)} Schaden (direkt ${direkt}, Faktor ${MULT})`,
    );
  }

  // (b) Die Auflage des Plans: der Bonus gilt AUCH fuer gegnerische
  // Geschosse. "Sonst lernt der Spieler, dass gebandete Kugeln nur fuer ihn
  // gefaehrlich sind." Das ist die Pruefung, die eine einseitige Umsetzung
  // (nur Spielerkugeln) auffliegen laesst.
  {
    const st1 = blank();
    st1.player.cfg.maxHp = 500;
    st1.player.hp = 500;
    const direkt = schadenAn(st1, st1.player, gegner(st1));
    const st2 = blank();
    st2.player.cfg.maxHp = 500;
    st2.player.hp = 500;
    const gebandet = schadenAn(st2, st2.player, gegner(st2), { bounces: 1 });
    check(
      gebandet === Math.round(direkt * MULT),
      `Phase 4: gegnerischer Bankschuss macht ${gebandet} statt ${Math.round(direkt * MULT)} (direkt ${direkt})`,
    );
  }

  // (c) Eine REFLEXION (Prisma/Panzerung, E3) ist kein Wandkontakt und
  // verdoppelt deshalb nicht. Der Code zaehlt Reflexionen bewusst nicht in
  // wallBounces (sonst liessen sich zwei Prismen gegeneinander ausspielen,
  // ohne je eine Bande zu spielen) -- diese Trennung muss auch beim Schaden
  // gelten, sonst waere sie an einer Stelle unterlaufen.
  {
    const st1 = blank();
    st1.player.cfg.maxHp = 500;
    st1.player.hp = 500;
    const reflektiert = schadenAn(st1, st1.player, st1.player, { reflected: true });
    const st2 = blank();
    st2.player.cfg.maxHp = 500;
    st2.player.hp = 500;
    const gebandet = schadenAn(st2, st2.player, st2.player, { bounces: 1 });
    check(
      reflektiert === tanksData.balance.damage.ownBullet,
      `Phase 4: reflektierte eigene Kugel macht ${reflektiert} statt ${tanksData.balance.damage.ownBullet} (Grundwert)`,
    );
    check(
      gebandet === Math.round(reflektiert * MULT),
      `Phase 4: gebandete eigene Kugel macht ${gebandet} statt ${Math.round(reflektiert * MULT)}`,
    );
  }

  // (d) Nur der AUFSCHLAG wird verdoppelt, nicht die Explosion eines
  // gebandeten Sprenggeschosses -- sonst wuerde ein einziger Wandkontakt
  // gleich zwei Schadensquellen verdoppeln.
  {
    const st1 = blank();
    const e1 = gegner(st1);
    e1.cfg.maxHp = 900;
    e1.hp = 900;
    const direkt = schadenAn(st1, e1, st1.player, { explosive: true });
    const st2 = blank();
    const e2 = gegner(st2);
    e2.cfg.maxHp = 900;
    e2.hp = 900;
    const gebandet = schadenAn(st2, e2, st2.player, { explosive: true, bounces: 1 });
    const aufschlag = st1.player.cfg.damage;
    check(
      gebandet - direkt === aufschlag,
      `Phase 4: gebandetes Sprenggeschoss macht ${gebandet - direkt} mehr statt ${aufschlag} -- die Explosion wurde mitverdoppelt`,
    );
  }

  // (e) Der Faktor kommt aus balance.json, ist also kein hartkodiertes 2.
  {
    const alt = tanksData.balance.bullet.wallBounceDamageMult;
    tanksData.balance.bullet.wallBounceDamageMult = 3;
    const st = blank();
    const e = gegner(st);
    e.cfg.maxHp = 500;
    e.hp = 500;
    const dreifach = schadenAn(st, e, st.player, { bounces: 1 });
    tanksData.balance.bullet.wallBounceDamageMult = alt;
    check(
      dreifach === st.player.cfg.damage * 3,
      `Phase 4: Faktor wird nicht aus balance.json gelesen (${dreifach} statt ${st.player.cfg.damage * 3})`,
    );
  }
}

// ---- 13. UMBAUPLAN-LP Phase 5: Statuseffekt-System ----------------------
// Das gemeinsame Regelwerk fuer Effekte ueber Zeit, gebaut BEVOR es die
// Elemente gibt. In dieser Phase haengt bewusst keine Quelle daran --
// erreichbar ist es nur ueber state.applyStatus().
{
  const { stepState } = await import('../src/game/state.js');
  const { statusSpeedMult, visibleStatus, hasStatus } = await import('../src/game/status.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
  const S = tanksData.status;

  // Isolierter Raum: nur Spieler + EIN Gegner, keine Geschosse, keine Minen.
  // Ohne das messen die Tests unbeabsichtigt gegnerisches Eigenfeuer mit
  // (in der Vorabmessung sah eine Bildraten-Probe deshalb 74 statt 24
  // Schaden -- ein zweiter Gegner hatte dazwischengefunkt).
  const isoliert = () => {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const e = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player, e);
    st.bullets.length = 0;
    st.mines.length = 0;
    st.player.protect = 0;
    st.player.shieldReady = false;
    st.shieldCharges = [];
    e.protect = 0;
    e.shieldReady = false;
    e.cfg.maxHp = 9999;
    e.hp = 9999;
    return { st, e };
  };
  const laufe = (st, sek, fps = 60) => {
    for (let i = 0; i < Math.round(sek * fps); i++) stepState(st, CMD0, 1 / fps);
  };

  // (a) Ein Effekt macht genau durationS / tickS Ticks -- und zwar
  // unabhaengig von der Bildrate. Der Takt wird GEZAEHLT statt
  // heruntergezaehlt; zwei unabhaengige Countdowns driften bei 1/60-Schritten
  // sonst gegeneinander (gemessen: erster Tick einen Frame zu spaet).
  {
    for (const id of ['fire', 'poison']) {
      const def = S.effects[id];
      if (!def.damagePerTick) continue;
      const erwarteteTicks = Math.round(def.durationS / S.tickS);
      for (const fps of [30, 60, 144]) {
        const { st, e } = isoliert();
        st.applyStatus(e, id, 1);
        const vor = e.hp;
        laufe(st, def.durationS + 2, fps);
        check(
          vor - e.hp === erwarteteTicks * def.damagePerTick,
          `Phase 5: ${id} macht bei ${fps} FPS ${vor - e.hp} statt ${erwarteteTicks * def.damagePerTick} Schaden (${erwarteteTicks} Ticks a ${def.damagePerTick})`,
        );
        check(!hasStatus(e), `Phase 5: ${id} laeuft nach ${def.durationS}s nicht ab`);
      }
    }
  }

  // (b) Stapeln vervielfacht den Schaden je Takt, der Deckel haelt, und die
  // Dauer erneuert sich auch am Deckel ("bleibt bei 3 Stufen, Dauer startet
  // neu").
  {
    const def = S.effects.fire;
    const { st, e } = isoliert();
    st.applyStatus(e, 'fire', def.maxStacks);
    const vor = e.hp;
    laufe(st, S.tickS + 0.02);
    check(
      vor - e.hp === def.damagePerTick * def.maxStacks,
      `Phase 5: ${def.maxStacks} Stufen machen ${vor - e.hp} statt ${def.damagePerTick * def.maxStacks} Schaden je Takt`,
    );
    // Ueber den Deckel hinaus auftragen: Stufen bleiben, Dauer startet neu.
    laufe(st, 1.0);
    const restVor = e.status.fire.timeLeft;
    for (let i = 0; i < 3; i++) st.applyStatus(e, 'fire', 1);
    check(e.status.fire.stacks === def.maxStacks, `Phase 5: Stufen ueber den Deckel (${e.status.fire.stacks})`);
    check(
      e.status.fire.timeLeft > restVor,
      `Phase 5: erneutes Auftragen erneuert die Dauer nicht (${restVor.toFixed(2)} -> ${e.status.fire.timeLeft.toFixed(2)})`,
    );
  }

  // (c) Eine schnell feuernde Quelle darf den Tick nicht endlos
  // hinausschieben. Deshalb wird beim Auftragen NUR die Dauer erneuert,
  // nicht die Takt-Buchhaltung -- sonst waere ein dauerhaft nachgeladener
  // Effekt komplett schadlos.
  {
    const { st, e } = isoliert();
    const vor = e.hp;
    for (let i = 0; i < Math.round(60 * (S.effects.fire.durationS + 1)); i++) {
      st.applyStatus(e, 'fire', 1); // jeden Frame nachlegen
      stepState(st, CMD0, 1 / 60);
    }
    check(
      vor - e.hp > 0,
      'Phase 5: dauerhaft nachgelegter Effekt macht gar keinen Schaden (Takt wird beim Auftragen zurueckgesetzt)',
    );
  }

  // (d) Frost: verlangsamt, macht keinen Schaden, und die Erstarrung loest
  // NUR beim Uebergang auf den Deckel aus. Loeste sie bei jedem weiteren
  // Auftragen erneut aus, waere ein Gegner mit einer Frostquelle dauerhaft
  // handlungsunfaehig (Stunlock).
  {
    const def = S.effects.frost;
    const { st, e } = isoliert();
    check(statusSpeedMult(st, e) === 1, 'Phase 5: Tempo ist ohne Frost nicht 1');
    st.applyStatus(e, 'frost', 1);
    check(
      statusSpeedMult(st, e) === def.speedMult,
      `Phase 5: Frost verlangsamt nicht (${statusSpeedMult(st, e)})`,
    );
    const vor = e.hp;
    laufe(st, S.tickS + 0.02);
    check(vor === e.hp, 'Phase 5: Frost macht Schaden (soll nur verlangsamen)');

    const { st: st2, e: e2 } = isoliert();
    e2.stunTimer = 0;
    for (let i = 1; i < def.freezeAtStacks; i++) {
      st2.applyStatus(e2, 'frost', 1);
      check(e2.stunTimer === 0, `Phase 5: Frost erstarrt schon bei ${i} Stufen`);
    }
    st2.applyStatus(e2, 'frost', 1);
    check(e2.stunTimer === def.freezeS, `Phase 5: Frost erstarrt bei ${def.freezeAtStacks} Stufen nicht`);
    // Erneut auf vollem Deckel: KEIN neuer Freeze (der Timer laeuft nur ab).
    e2.stunTimer = 0.1;
    st2.applyStatus(e2, 'frost', 1);
    check(
      e2.stunTimer === 0.1,
      `Phase 5: erneutes Frost auf vollem Deckel erstarrt erneut (Stunlock, stun=${e2.stunTimer})`,
    );
  }

  // (e) Schaden ueber Zeit umgeht Panzerung UND Schilde, respektiert aber
  // die Boss-Unverwundbarkeit.
  {
    // Panzerung: ein Gegner mit Frontpanzerung nimmt Giftschaden.
    const { st, e } = isoliert();
    e.cfg.armor = { arc: 360, reflects: true }; // rundum gepanzert
    st.applyStatus(e, 'poison', 1);
    const vor = e.hp;
    laufe(st, S.tickS + 0.02);
    check(vor - e.hp === S.effects.poison.damagePerTick, `Phase 5: Panzerung blockt Giftschaden (${vor - e.hp})`);

    // Schilde: ein 4-Punkte-Brandtick darf keine Schildladung verbrauchen.
    const { st: st2 } = isoliert();
    const p = st2.player;
    st2.shieldCharges = [3, 3];
    p.shieldReady = true;
    st2.applyStatus(p, 'fire', 1);
    const hpVor = p.hp;
    laufe(st2, S.tickS + 0.02);
    check(hpVor - p.hp === S.effects.fire.damagePerTick, `Phase 5: Brandtick kommt nicht durch (${hpVor - p.hp})`);
    check(st2.shieldCharges.length === 2, `Phase 5: Brandtick hat eine Schildladung verbraucht (${st2.shieldCharges.length})`);
    check(p.shieldReady, 'Phase 5: Brandtick hat das Schild verbraucht');

    // Boss-Unverwundbarkeit gilt weiter -- sonst waere das Generator-
    // Raetsel mit einem Brandpfeil umgehbar.
    const { st: st3, e: e3 } = isoliert();
    e3.cfg.bossInvincible = true;
    st3.bossGeneratorsLeft = 1;
    st3.applyStatus(e3, 'fire', 1);
    const bossVor = e3.hp;
    laufe(st3, S.tickS + 0.02);
    check(bossVor === e3.hp, `Phase 5: unverwundbarer Reaktorkern nimmt Brandschaden (${bossVor - e3.hp})`);
  }

  // (f) Ein Effekt kann toeten, und der Tod laeuft durch killTank().
  {
    const { st, e } = isoliert();
    e.cfg.maxHp = 8;
    e.hp = 8;
    const kills = st.enemyKills;
    st.applyStatus(e, 'fire', 1);
    laufe(st, S.effects.fire.durationS + 1);
    check(!e.alive, `Phase 5: Brand toetet nicht (hp=${e.hp})`);
    check(st.enemyKills === kills + 1, 'Phase 5: Tod durch Statuseffekt laeuft nicht durch killTank()');
  }

  // (g) Anzeige: hoechstens maxIcons Effekte, nach Dominanz sortiert.
  {
    const { st, e } = isoliert();
    st.applyStatus(e, 'fire', 1);
    st.applyStatus(e, 'poison', 3);
    st.applyStatus(e, 'frost', 2);
    const sicht = visibleStatus(st, e);
    check(sicht[0]?.id === 'poison', `Phase 5: dominanter Effekt ist ${sicht[0]?.id} statt poison (meiste Stufen)`);
    // Den Deckel mit EIGENER Zahl pruefen: es gibt aktuell genau drei
    // Effekte und maxIcons steht auf 3 -- "hoechstens 3 von 3" waere trivial
    // wahr, ein ausgebauter Deckel wuerde glatt durchrutschen (in der
    // Gegenprobe genau so passiert). Mit einem temporaeren Deckel von 1
    // misst der Test den Mechanismus statt der aktuellen Datenlage.
    const echt = S.maxIcons;
    S.maxIcons = 1;
    const gedeckelt = visibleStatus(st, e);
    S.maxIcons = echt;
    check(gedeckelt.length === 1, `Phase 5: Symbol-Deckel greift nicht (${gedeckelt.length} statt 1)`);
    check(gedeckelt[0]?.id === 'poison', 'Phase 5: bei Deckel 1 wird nicht der dominante Effekt gezeigt');
  }

  // (h) Ein frischer Raum bringt keinen Status mit (createTank() legt ein
  // neues Panzerobjekt an -- kein eigener Aufraeum-Hook noetig).
  {
    const { st, e } = isoliert();
    st.applyStatus(e, 'fire', 2);
    check(hasStatus(e), 'Phase 5: Status wurde gar nicht aufgetragen (Vorbedingung)');
    const frisch = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    check(
      frisch.tanks.every((t) => !hasStatus(t)),
      'Phase 5: ein frischer Raum bringt bereits Statuseffekte mit',
    );
  }
}

// ---- 14. UMBAUPLAN-LP Phase 6: die sechs Schadenstypen ------------------
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { explodeAt } = await import('../src/game/mine.js');
  const { stepState } = await import('../src/game/state.js');
  const { statusOf } = await import('../src/game/damagetypes.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
  const DT = tanksData.status.damageTypes;

  // Testraum mit n Zielen in einer Reihe, alle unverwundbar hoch, ohne
  // Panzerung/Schild -- so misst jede Pruefung nur den Schadenstyp.
  const raum = (n, abstand = 60) => {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const ziele = [];
    for (let i = 0; i < n; i++) {
      const z = {
        ...proto,
        x: 200 + i * abstand, y: 250, prevX: 200 + i * abstand, prevY: 250,
        alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
        cfg: { ...proto.cfg, maxHp: 9999, armor: null, requiresRicochet: false },
      };
      st.tanks.push(z);
      ziele.push(z);
    }
    st.bullets.length = 0;
    st.mines.length = 0;
    return { st, ziele };
  };
  const schuss = (st, ziel, typ, opt = {}) => {
    const b = createBullet(ziel.x, ziel.y, 0, {
      speed: 1, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet',
      damage: st.player.cfg.damage, damageType: typ,
    });
    b.age = 5;
    b.wallBounces = opt.bounces ?? 0;
    st.bullets.length = 0;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
  };

  // (a) Struktur: es gibt genau die sechs Typen des Plans, und jeder
  // `status`-Verweis zeigt auf einen existierenden Effekt. Faengt einen
  // Tippfehler, der den Statuseffekt sonst lautlos verschluckt.
  {
    for (const id of ['physical', 'explosive', 'fire', 'frost', 'poison', 'lightning']) {
      check(!!DT[id], `Phase 6: Schadenstyp "${id}" fehlt in status.json`);
    }
    for (const [id, def] of Object.entries(DT)) {
      if (!def.status) continue;
      check(
        !!tanksData.status.effects[def.status],
        `Phase 6: Schadenstyp "${id}" verweist auf unbekannten Statuseffekt "${def.status}"`,
      );
    }
  }

  // (b) Ein Treffer traegt den Statuseffekt seines Typs auf -- und die
  // Sofort-Typen (physisch/Sprengstoff/Blitz) hinterlassen nichts.
  {
    for (const [typ, erwartet] of Object.entries(DT).map(([k, v]) => [k, v.status || null])) {
      const { st, ziele } = raum(1);
      schuss(st, ziele[0], typ);
      const aktiv = Object.keys(ziele[0].status).filter((k) => ziele[0].status[k].stacks > 0);
      if (erwartet) {
        check(aktiv.includes(erwartet), `Phase 6: ${typ} traegt "${erwartet}" nicht auf (aktiv: ${aktiv})`);
      } else {
        check(aktiv.length === 0, `Phase 6: ${typ} hinterlaesst einen Status (${aktiv}), soll aber sofort wirken`);
      }
      check(statusOf(st, typ) === erwartet, `Phase 6: statusOf("${typ}") stimmt nicht`);
    }
  }

  // (c) Blitzkette: maxTargets Ziele insgesamt, jeder Sprung mit falloff.
  {
    const L = DT.lightning;
    const { st, ziele } = raum(L.maxTargets + 1, Math.round(L.jumpRangePx * 0.5));
    const vor = ziele.map((z) => z.hp);
    schuss(st, ziele[0], 'lightning');
    const schaden = ziele.map((z, i) => vor[i] - z.hp);
    const grund = st.player.cfg.damage;
    check(schaden[0] === grund, `Phase 6: Blitz-Aufschlag ${schaden[0]} statt ${grund}`);
    for (let i = 1; i < L.maxTargets; i++) {
      const erwartet = Math.max(1, Math.round(schaden[i - 1] * L.falloff));
      check(schaden[i] === erwartet, `Phase 6: Blitzsprung ${i} macht ${schaden[i]} statt ${erwartet}`);
    }
    check(
      schaden[L.maxTargets] === 0,
      `Phase 6: Blitz trifft ${L.maxTargets + 1} Ziele statt ${L.maxTargets} (Deckel greift nicht)`,
    );
  }

  // (d) Ein einzelner Gegner: kein Sprung, voller Schaden, kein Bogen.
  {
    const { st, ziele } = raum(1);
    const vor = ziele[0].hp;
    schuss(st, ziele[0], 'lightning');
    check(vor - ziele[0].hp === st.player.cfg.damage, 'Phase 6: Blitz auf einzelnen Gegner nicht voller Schaden');
    check(st.lightningArcs.length === 0, 'Phase 6: Blitz zeichnet einen Bogen ohne zweites Ziel');
  }

  // (e) Die Kette springt vom ZULETZT getroffenen Panzer weiter, nicht vom
  // Einschlagpunkt. Aufbau: Ziel 3 liegt ausserhalb der Sprungreichweite um
  // Ziel 1, aber innerhalb um Ziel 2 -- eine Kette "um den Einschlag herum"
  // wuerde es nie erreichen.
  {
    const L = DT.lightning;
    const { st, ziele } = raum(3, Math.round(L.jumpRangePx * 0.7));
    const abstand13 = Math.abs(ziele[2].x - ziele[0].x);
    check(abstand13 > L.jumpRangePx, `Phase 6: Testaufbau untauglich -- Ziel 3 liegt nur ${abstand13} px von Ziel 1`);
    const vor = ziele.map((z) => z.hp);
    schuss(st, ziele[0], 'lightning');
    check(
      vor[2] - ziele[2].hp > 0,
      'Phase 6: die Blitzkette springt vom Einschlagpunkt statt vom zuletzt getroffenen Panzer',
    );
  }

  // (f) Der Abprall-Bonus (Phase 4) verdoppelt den AUFSCHLAG, nicht die
  // Statusstufen -- "gebandetes Feuergeschoss: doppelter Aufschlagschaden,
  // Brand unveraendert".
  {
    const a = raum(1);
    schuss(a.st, a.ziele[0], 'fire');
    const direktAufschlag = 9999 - a.ziele[0].hp;
    const direktStufen = a.ziele[0].status.fire.stacks;
    const b = raum(1);
    schuss(b.st, b.ziele[0], 'fire', { bounces: 1 });
    const bankAufschlag = 9999 - b.ziele[0].hp;
    const bankStufen = b.ziele[0].status.fire.stacks;
    check(
      bankAufschlag === direktAufschlag * tanksData.balance.bullet.wallBounceDamageMult,
      `Phase 6: gebandetes Feuergeschoss macht ${bankAufschlag} statt ${direktAufschlag * tanksData.balance.bullet.wallBounceDamageMult} Aufschlag`,
    );
    check(bankStufen === direktStufen, `Phase 6: der Abprall verdoppelt die Brandstufen (${direktStufen} -> ${bankStufen})`);
  }

  // (g) Standard ist physisch: ein Geschoss ohne Angabe traegt nichts auf.
  {
    const { st, ziele } = raum(1);
    const b = createBullet(ziele[0].x, ziele[0].y, 0, {
      speed: 1, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet', damage: 10,
    });
    check(b.damageType === 'physical', `Phase 6: Standard-Schadenstyp ist "${b.damageType}" statt "physical"`);
    b.age = 5;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
    check(
      Object.keys(ziele[0].status).every((k) => ziele[0].status[k].stacks === 0),
      'Phase 6: ein physisches Geschoss traegt einen Status auf',
    );
  }

  // (h) Explosionen tragen einen Typ und koennen einen eigenen bekommen.
  {
    const { st, ziele } = raum(1);
    explodeAt(st, ziele[0].x, ziele[0].y, 60, null, {}, 20, 'fire');
    check(ziele[0].status.fire?.stacks > 0, 'Phase 6: eine Feuer-Explosion entzuendet nicht');
    const { st: st2, ziele: z2 } = raum(1);
    explodeAt(st2, z2[0].x, z2[0].y, 60, null, {}, 20); // ohne Angabe -> explosive
    check(
      Object.keys(z2[0].status).every((k) => z2[0].status[k].stacks === 0),
      'Phase 6: eine normale Explosion hinterlaesst einen Status',
    );
  }
}

// ---- 15. UMBAUPLAN-LP Phase 7: Krit-Umbau --------------------------------
// Prueft den MECHANISMUS mit eigenen Zahlen (nicht die aktuellen JSON-Werte):
// Roll (spielerseitig), Nachlade-Reset, Schadensmultiplikation, Deckel,
// hoer-/sichtbares Feedback. Gegenprobe fuer jeden Punkt bestanden.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { stepState } = await import('../src/game/state.js');
  const { fireBullet } = await import('../src/game/tank.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
  const CRIT = tanksData.balance.crit;

  check(CRIT && CRIT.cap < 1, 'Phase 7: balance.crit fehlt oder cap ist nicht < 1 (Deckeltest untauglich)');

  // Frischer, spielbereiter Spieler in einem echten Raum. critChance und der
  // RNG werden gestellt, damit der Krit deterministisch schaltbar ist.
  const spieler = (critChance) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    st.player.cooldown = 0;
    st.player.cfg.critChance = critChance;
    return st;
  };

  // (a) Krit garantiert (Chance 1, rng klein): der Schuss ist kritisch UND das
  //     Nachladen ist sofort zurueckgesetzt (Testschritt 1).
  {
    const st = spieler(1);
    st.rng = () => 0;
    check(st.player.cfg.fireCooldown > 0, 'Phase 7: Vorbedingung -- fireCooldown ist 0, Reset-Test untauglich');
    check(fireBullet(st.player, st, true), 'Phase 7: Schuss ging nicht raus');
    check(st.bullets.length > 0 && st.bullets.every((b) => b.crit), 'Phase 7: garantierter Krit setzt b.crit nicht');
    check(st.player.cooldown === 0, `Phase 7: Krit setzt das Nachladen nicht zurueck (cooldown ${st.player.cooldown})`);
  }

  // (b) Krit unmoeglich (Chance 0): normaler Schuss, normales Nachladen
  //     (Testschritt 2).
  {
    const st = spieler(0);
    st.rng = () => 0;
    fireBullet(st.player, st, true);
    check(st.bullets.every((b) => !b.crit), 'Phase 7: bei Chance 0 ist ein Schuss kritisch');
    check(st.player.cooldown > 0, 'Phase 7: bei Chance 0 wird das Nachladen zurueckgesetzt');
  }

  // (c) Der Deckel greift: eine Chance ueber cap wird auf cap geklemmt. Bei
  //     rng zwischen cap und Chance darf KEIN Krit fallen (Testschritt 4).
  {
    const st = spieler(1);
    st.rng = () => (CRIT.cap + 1) / 2; // zwischen cap und 1
    fireBullet(st.player, st, true);
    check(
      st.bullets.every((b) => !b.crit),
      `Phase 7: der Deckel greift nicht -- rng ${(CRIT.cap + 1) / 2} liegt ueber cap ${CRIT.cap}, loeste aber Krit aus`,
    );
    const st2 = spieler(1);
    st2.rng = () => Math.max(0, CRIT.cap - 0.01); // knapp unter cap
    fireBullet(st2.player, st2, true);
    check(st2.bullets.every((b) => b.crit), 'Phase 7: knapp unter dem Deckel faellt kein Krit');
  }

  // (d) Schadensmultiplikation im Treffer. Ein Ziel exakt unter der Kugel,
  //     unverwundbar hoch, ohne Panzerung/Schild -- so misst der hp-Abfall nur
  //     die Faktoren. Krit und Bankschuss MULTIPLIZIEREN sich (Testschritt 3).
  const treffer = (opt) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const z = {
      ...proto, x: 200, y: 250, prevX: 200, prevY: 250,
      alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
      cfg: { ...proto.cfg, maxHp: 9999, armor: null, requiresRicochet: false },
    };
    st.tanks.push(z);
    const b = createBullet(z.x, z.y, 0, {
      speed: 1, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet', damage: 10, crit: opt.crit,
    });
    b.age = 5;
    b.wallBounces = opt.bounces ?? 0;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    const vor = z.hp;
    stepState(st, CMD0, 1 / 60);
    return vor - z.hp;
  };
  {
    const grund = 10;
    const bounce = tanksData.balance.bullet.wallBounceDamageMult;
    check(treffer({ crit: false, bounces: 0 }) === grund, 'Phase 7: Vorbedingung -- Grundtreffer nicht 10');
    check(treffer({ crit: true, bounces: 0 }) === Math.round(grund * CRIT.mult), 'Phase 7: Krit verdoppelt den Aufschlag nicht');
    check(treffer({ crit: false, bounces: 1 }) === Math.round(grund * bounce), 'Phase 7: Vorbedingung -- Bankschuss-Bonus stimmt nicht');
    check(
      treffer({ crit: true, bounces: 1 }) === Math.round(grund * CRIT.mult * bounce),
      `Phase 7: Krit und Bankschuss multiplizieren sich nicht (${grund}x${CRIT.mult}x${bounce})`,
    );
  }

  // (e) Feedback: der Krit spielt einen eigenen Ton, ruettelt den Bildschirm
  //     und zeigt Text -- der Normaltreffer nichts davon (Testschritt 5).
  {
    const st = spieler(1);
    st.rng = () => 0;
    st.sounds.length = 0;
    st.texts.length = 0;
    st.shake = 0;
    fireBullet(st.player, st, true);
    const namen = st.sounds.map((s) => (typeof s === 'string' ? s : s.name));
    check(namen.includes('crit'), 'Phase 7: Krit spielt keinen eigenen Ton');
    check(st.shake > 0, 'Phase 7: Krit ohne Bildschirmausschlag');
    check(st.texts.some((t) => /KRIT/i.test(t.text)), 'Phase 7: Krit ohne sichtbaren Text');

    const st2 = spieler(0);
    st2.rng = () => 0;
    st2.sounds.length = 0;
    st2.shake = 0;
    fireBullet(st2.player, st2, true);
    const namen2 = st2.sounds.map((s) => (typeof s === 'string' ? s : s.name));
    check(!namen2.includes('crit'), 'Phase 7: Normaltreffer spielt den Krit-Ton');
    check(st2.shake === 0, 'Phase 7: Normaltreffer loest Bildschirmausschlag aus');
  }

  // (f) Gegner kritten (vorerst) nicht -- der Roll haengt an tank ===
  //     state.player. Sonst wuerde resetsReload zu Doppelfeuer fuehren.
  {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const gegner = st.tanks.find((t) => t !== st.player && t.alive);
    gegner.cooldown = 0;
    gegner.cfg.critChance = 1;
    st.rng = () => 0;
    st.bullets.length = 0;
    fireBullet(gegner, st, true);
    check(st.bullets.length > 0, 'Phase 7: Vorbedingung -- Gegner hat nicht gefeuert');
    check(st.bullets.every((b) => !b.crit), 'Phase 7: ein Gegnerschuss ist kritisch (Krit soll spielerseitig sein)');
  }
}

// ---- 16. UMBAUPLAN-LP Phase 8: Altlasten abbauen -------------------------
// Prisma nimmt normalen Direktschaden, aber 3x aus Bankshots; Schild ist ein
// 40-Punkte-Absorber statt eines Ein-Treffer-Blocks. Mechanismus mit eigenen
// Zahlen geprueft; Gegenprobe fuer jeden Punkt bestanden.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { stepState } = await import('../src/game/state.js');
  const { resolveCfg } = await import('../src/game/cfg.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  // Treffer auf ein Ziel mit gegebenem cfg; misst den hp-Abfall. Ziel
  // unverwundbar hoch, ohne Schild -- so zaehlt nur der Abprall-Faktor.
  const trefferAuf = (cfgTarget, opt) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const z = {
      ...proto, x: 200, y: 250, prevX: 200, prevY: 250,
      alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
      cfg: { ...cfgTarget, maxHp: 9999 },
    };
    st.tanks.push(z);
    const b = createBullet(z.x, z.y, 0, {
      speed: 1, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet', damage: 10,
    });
    b.age = 5;
    b.wallBounces = opt.bounces ?? 0;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    const vor = z.hp;
    stepState(st, CMD0, 1 / 60);
    return vor - z.hp;
  };

  // (a) Struktur: t_prism hat weder Panzerung noch requiresRicochet, dafuer
  //     den 3x-Abprallschaden. Der Spiegel-Boss behaelt requiresRicochet --
  //     der Mechanismus darf nicht mitentfernt worden sein.
  {
    const P = tanksData.types.t_prism;
    check(!P.armor && !P.requiresRicochet, 'Phase 8: t_prism traegt noch Panzerung/requiresRicochet');
    check(P.bounceDamageTakenMult === 3, `Phase 8: t_prism hat bounceDamageTakenMult ${P.bounceDamageTakenMult} statt 3`);
    check(tanksData.types.t_mirror.requiresRicochet === true, 'Phase 8: der Spiegel-Boss hat requiresRicochet verloren (Mechanismus kaputt)');
    check(diffData.bankshotGuarantee.chance === 0, 'Phase 8: bankshotGuarantee.chance ist nicht 0 (Bankshot-Zwang noch aktiv)');
  }

  // (b) Prisma: direkter Schuss nimmt NORMALEN Schaden (Testschritt 2),
  //     gebandeter Schuss den DREIFACHEN (Testschritt 3). Zum Vergleich ein
  //     normaler Gegner: gebandet nur das Doppelte.
  {
    const prism = resolveCfg(tanksData, 't_prism');
    const normal = resolveCfg(tanksData, 't_brown');
    check(trefferAuf(prism, { bounces: 0 }) === 10, 'Phase 8: Prisma nimmt keinen normalen Direktschaden');
    check(trefferAuf(prism, { bounces: 1 }) === 30, 'Phase 8: Prisma nimmt aus dem Bankshot nicht 3x (30)');
    check(trefferAuf(normal, { bounces: 1 }) === 20, 'Phase 8: normaler Gegner nimmt aus dem Bankshot nicht 2x (20)');
    check(trefferAuf(normal, { bounces: 0 }) === 10, 'Phase 8: normaler Direktschaden nicht 10');
  }

  // (c) Schild-Absorber (Testschritt 4): faengt die naechsten `absorb` Punkte
  //     ab, Rest geht durch. absorb+20 Schaden -> 20 durch.
  {
    const A = tanksData.balance.shield.absorb;
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const p = st.player;
    p.shieldReady = true;
    p.shieldHp = A;
    p.hp = 100;
    p.protect = 0;
    st.applyDamage(p, A + 20, 'test', {});
    check(p.hp === 80, `Phase 8: Schild-Absorber -- hp ${p.hp} statt 80 (${A} abgefangen, 20 durch)`);
    check(!p.shieldReady, 'Phase 8: der erschoepfte Absorber sollte den Schild brechen');
  }

  // (d) Kleiner Treffer wird ganz abgefangen, der Absorber behaelt seinen
  //     Rest -- kein Ein-Treffer-Verbrauch mehr.
  {
    const A = tanksData.balance.shield.absorb;
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const p = st.player;
    p.shieldReady = true;
    p.shieldHp = A;
    p.hp = 100;
    p.protect = 0;
    st.applyDamage(p, 25, 'test', {});
    check(p.hp === 100, `Phase 8: kleiner Treffer nicht ganz abgefangen (hp ${p.hp})`);
    check(p.shieldReady && p.shieldHp === A - 25, `Phase 8: Absorber-Rest ${p.shieldHp} statt ${A - 25}`);
  }

  // (e) Schaden je Schadenstyp: ein Feuertreffer des Spielers landet im
  //     damageByType-Zaehler (die neue Telemetrie-Grundlage).
  {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const z = {
      ...proto, x: 200, y: 250, prevX: 200, prevY: 250,
      alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
      cfg: { ...proto.cfg, maxHp: 9999, armor: null, requiresRicochet: false },
    };
    st.tanks.push(z);
    const b = createBullet(z.x, z.y, 0, {
      speed: 1, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet', damage: 10, damageType: 'fire',
    });
    b.age = 5;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
    check(st.damageByType.fire === 10, `Phase 8: Feuerschaden nicht im Zaehler (fire=${st.damageByType.fire})`);
    check(st.damageByType.physical === 0, 'Phase 8: physischer Zaehler faelschlich erhoeht');
  }
}

// ---- 17. UMBAUPLAN-LP Phase 9: die zehn Klassen als Werte -----------------
// Blocker-Fix (Player-Defaults per player:true), Klassenwerte, Passive,
// Seed-Wiedergabe. Mechanismus mit eigenen Zahlen; Gegenprobe bestanden.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { stepState } = await import('../src/game/state.js');
  const { resolveCfg, applyUpgrades, applyScrapDamage } = await import('../src/game/cfg.js');
  const { applyTypeEffects } = await import('../src/game/damagetypes.js');
  const { runSnapshot } = await import('../src/game/run.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
  const T = tanksData.types;

  // (a) Struktur: genau zehn spielbare Klassen (player:true), jede mit
  //     LP/Schaden; 'player' IST die Standard-Klasse.
  {
    const klassen = Object.entries(T).filter(([, t]) => t.player);
    check(klassen.length === 10, `Phase 9: ${klassen.length} Klassen statt 10`);
    check(T.player.player === true, 'Phase 9: Standard-Klasse (player) nicht als player markiert');
    for (const [id, t] of klassen) {
      check(typeof t.maxHp === 'number' && typeof t.damage === 'number', `Phase 9: Klasse ${id} ohne LP/Schaden`);
    }
  }

  // (b) Blocker-Fix: Magazin/Deckel/Kugeltempo einer Klasse kommen aus den
  //     Player-Defaults (balance.json), NICHT aus dem undefinierten Typwert;
  //     speedMult skaliert das Basistempo; crit/damageType aus dem Typ.
  {
    const bb = tanksData.balance.bullet;
    const cfg = resolveCfg(tanksData, 'c_tesla');
    check(cfg.magazine === bb.maxActive, `Phase 9: Klassenmagazin ${cfg.magazine} statt Player-Default ${bb.maxActive}`);
    check(cfg.magazineCap === bb.maxActiveCap, `Phase 9: Magazindeckel ${cfg.magazineCap} statt ${bb.maxActiveCap}`);
    check(cfg.bulletSpeed === bb.speed, `Phase 9: Kugeltempo ${cfg.bulletSpeed} statt ${bb.speed}`);
    check(Math.abs(cfg.speed - tanksData.speeds.normal * 1.05) < 1e-6, `Phase 9: speedMult greift nicht (speed ${cfg.speed})`);
    check(cfg.critChance === 0.05, `Phase 9: Klassen-Krit ${cfg.critChance} statt 0.05`);
    check(cfg.damageType === 'lightning', `Phase 9: Teslapanzer schiesst ${cfg.damageType} statt lightning`);
  }

  // (c) Abprallpanzer: +1 Abpraller auf die Basis.
  {
    check(resolveCfg(tanksData, 'c_ricochet').ricochets === 2, 'Phase 9: Abprallpanzer nicht 2 Abpraller');
    check(resolveCfg(tanksData, 'player').ricochets === 1, 'Phase 9: Standard nicht 1 Abpraller');
  }

  // (d) Sprengpanzer: +20 % Bombenradius, in mineRadiusMult gefaltet (Test-
  //     schritt 2). Mit eigenen Zahlen, nicht dem aktuellen JSON-Wert allein.
  {
    const cfg = applyUpgrades(resolveCfg(tanksData, 'c_blast'), {}, upgradesData, 'mine', null);
    check(Math.abs(cfg.mineRadiusMult - 1.2) < 1e-6, `Phase 9: Sprengpanzer mineRadiusMult ${cfg.mineRadiusMult} statt 1.2`);
    const std = applyUpgrades(resolveCfg(tanksData, 'player'), {}, upgradesData, 'mine', null);
    check(Math.abs(std.mineRadiusMult - 1) < 1e-6, `Phase 9: Standard mineRadiusMult ${std.mineRadiusMult} statt 1`);
  }

  // Testraum mit n Zielen in einer Reihe (Spieler weit weg geparkt, damit er
  // nicht selbst in eine Blitzkette geraet).
  const reihe = (n, abstand) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.player.x = 2000;
    st.player.y = 2000;
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const ziele = [];
    for (let i = 0; i < n; i++) {
      const z = {
        ...proto, x: 200 + i * abstand, y: 250, prevX: 200 + i * abstand, prevY: 250,
        alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
        cfg: { ...proto.cfg, maxHp: 9999, armor: null, requiresRicochet: false },
      };
      st.tanks.push(z);
      ziele.push(z);
    }
    st.bullets.length = 0;
    st.mines.length = 0;
    return { st, ziele };
  };

  // (e) Teslapanzer: Blitz springt auf 4 statt 3 Ziele (Testschritt 3).
  {
    const L = tanksData.status.damageTypes.lightning;
    const { st, ziele } = reihe(5, Math.round(L.jumpRangePx * 0.5));
    st.player.cfg.lightningBonusTargets = 1;
    const b = createBullet(ziele[0].x, ziele[0].y, 0, {
      speed: 1, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet', damage: 10, damageType: 'lightning',
    });
    b.age = 5;
    st.bullets.push(b);
    const vor = ziele.map((z) => z.hp);
    stepState(st, CMD0, 1 / 60);
    const getroffen = ziele.filter((z, i) => vor[i] - z.hp > 0).length;
    check(getroffen === 4, `Phase 9: Teslapanzer trifft ${getroffen} statt 4 Ziele`);
  }

  // (f) Flammen-/Radioaktiv-Panzer: Status haelt laenger. Frostpanzer:
  //     staerkere Verlangsamung. Mit eigenen Faktoren geprueft.
  {
    const { st, ziele } = reihe(1, 60);
    const fire = tanksData.status.effects.fire;
    applyTypeEffects(st, ziele[0], 'fire', 10, { ownerCfg: { fireDurationMult: 1.25 } });
    check(Math.abs(ziele[0].status.fire.timeLeft - fire.durationS * 1.25) < 1e-6, `Phase 9: Branddauer ${ziele[0].status.fire.timeLeft} statt ${fire.durationS * 1.25}`);

    const { ziele: z2 } = reihe(1, 60);
    applyTypeEffects(st, z2[0], 'fire', 10, {});
    check(Math.abs(z2[0].status.fire.timeLeft - fire.durationS) < 1e-6, 'Phase 9: Branddauer ohne Passiv verlaengert');

    const { st: st3, ziele: z3 } = reihe(1, 60);
    const frostBase = tanksData.status.effects.frost.speedMult;
    applyTypeEffects(st3, z3[0], 'frost', 10, { ownerCfg: { frostSlowBonus: 0.2 } });
    const erwartet = 1 - (1 - frostBase) * 1.2;
    check(Math.abs(z3[0].status.frost.speedMult - erwartet) < 1e-6, `Phase 9: Frost-Verlangsamung ${z3[0].status.frost.speedMult} statt ${erwartet}`);
  }

  // (g) Nekromant: reviveChance ueberlebt einen toedlichen Treffer (RNG < c),
  //     stirbt bei Fehlwurf; ohne das Passiv wird kein RNG verbraucht.
  {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const p = st.player;
    p.cfg.reviveChance = 0.25;
    p.cfg.maxHp = 100;
    p.hp = 10;
    p.protect = 0;
    p.shieldReady = false;
    st.shieldCharges.length = 0;
    st.rng = () => 0; // < 0.25 -> Wiederbelebung
    st.applyDamage(p, 50, 'test', {});
    check(p.alive && p.hp === 100, `Phase 9: Nekromant wiederbelebt nicht (alive=${p.alive}, hp=${p.hp})`);

    const st2 = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const p2 = st2.player;
    p2.cfg.reviveChance = 0.25;
    p2.hp = 10;
    p2.protect = 0;
    p2.shieldReady = false;
    st2.shieldCharges.length = 0;
    st2.rng = () => 0.9; // >= 0.25 -> stirbt
    st2.applyDamage(p2, 50, 'test', {});
    check(!p2.alive, 'Phase 9: Nekromant ueberlebt trotz Fehlwurf');
  }

  // (h) Schrottpanzer: +5 % Schaden je 100 Schrott, pro Raum gebacken.
  {
    const cfg = resolveCfg(tanksData, 'c_scrap');
    const grund = cfg.damage;
    applyScrapDamage(cfg, 250); // floor(250/100)=2 -> *1.10
    check(cfg.damage === Math.round(grund * (1 + 0.05 * 2)), `Phase 9: Schrottpanzer-Schaden ${cfg.damage} statt ${Math.round(grund * 1.1)}`);
    const std = resolveCfg(tanksData, 'player');
    applyScrapDamage(std, 250);
    check(std.damage === 10, `Phase 9: Standard skaliert faelschlich mit Schrott (${std.damage})`);
  }

  // (i) Seed-Wiedergabe: die Klasse steht im Run UND im Snapshot und ueberlebt
  //     das Fortsetzen (Testschritt 4/5).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42, 'normal', { starterTank: 'c_tesla' });
    check(run.starterTank === 'c_tesla', 'Phase 9: starterTank nicht im Run gesetzt');
    const snap = runSnapshot(run);
    check(snap.starterTank === 'c_tesla', 'Phase 9: starterTank fehlt im Snapshot');
    const resumed = createRun(tanksData, tilesData, diffData, upgradesData, 42, 'normal', { resume: snap });
    check(resumed.starterTank === 'c_tesla', 'Phase 9: Klasse geht beim Fortsetzen verloren');
    check(resumed.state.starterTank === 'c_tesla', 'Phase 9: state.starterTank nicht gesetzt (Respawn baut falsche Klasse)');
  }
}

// ---- 18. UMBAUPLAN-LP Phase 10: Kernpool + Verteilungs-Fix ----------------
// 30 klassenunabhaengige Kernkarten (10/10/10) + weightedPick liefert die
// konfigurierte Seltenheitsverteilung unabhaengig von der Poolgroesse.
{
  const { resolveCfg, applyUpgrades } = await import('../src/game/cfg.js');
  const { weightedPick, rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');
  const U = upgradesData.upgrades;
  // Kernkarten = generischer Effekt (core) OHNE Element (damageType) -- die
  // Element-Toepfe ab Phase 11 tragen ebenfalls ein core-Objekt, sind aber
  // typgebunden und gehoeren nicht in den Kern.
  const core = Object.entries(U).filter(([, d]) => d.core && !d.damageType);

  // (a) Struktur: genau 30 Kernkarten, 10/10/10 nach Seltenheit, 10 verschiedene
  //     Tags (sonst begrenzt die Tag-Regel den Kern auf 1 Karte pro Angebot).
  {
    check(core.length === 30, `Phase 10: ${core.length} Kernkarten statt 30`);
    const rar = { common: 0, rare: 0, legendary: 0 };
    for (const [, d] of core) rar[d.rarity]++;
    check(rar.common === 10 && rar.rare === 10 && rar.legendary === 10, `Phase 10: Seltenheitsverteilung ${JSON.stringify(rar)} statt 10/10/10`);
    const tags = new Set(core.map(([, d]) => d.tag));
    check(tags.size === 10, `Phase 10: ${tags.size} Kern-Tags statt 10 (Tag-Regel wuerde den Kern sonst zusammenfalten)`);
  }

  // (b) Der eigentliche Fix: weightedPick zieht die SELTENHEIT mit dem
  //     konfigurierten Gewicht (60/30/10), egal wie viele Karten je Seltenheit
  //     ziehbar sind. Bewusst mit einer UNGLEICHEN Liste geprueft -- genau da
  //     lag der Bug. Gegenprobe: die alte Pro-Karte-Summierung ergaebe ~88/11/1.
  {
    const weights = tanksData.balance.rarity; // 60/30/10
    const liste = [];
    for (let i = 0; i < 20; i++) liste.push({ rarity: 'common' });
    for (let i = 0; i < 5; i++) liste.push({ rarity: 'rare' });
    for (let i = 0; i < 2; i++) liste.push({ rarity: 'legendary' });
    const rng = mulberry32(12345);
    const zieh = { common: 0, rare: 0, legendary: 0 };
    const N = 60000;
    for (let i = 0; i < N; i++) zieh[weightedPick(liste, rng, weights).rarity]++;
    const pct = (k) => (100 * zieh[k]) / N;
    check(Math.abs(pct('common') - 60) < 2, `Phase 10: common ${pct('common').toFixed(1)} % statt ~60 %`);
    check(Math.abs(pct('rare') - 30) < 2, `Phase 10: rare ${pct('rare').toFixed(1)} % statt ~30 %`);
    check(Math.abs(pct('legendary') - 10) < 2, `Phase 10: legendary ${pct('legendary').toFixed(1)} % statt ~10 %`);
  }

  // (c) Schadenskarte (Testschritt 2): +damageAdd pro Stufe, nachgerechnet mit
  //     eigenen Zahlen (nicht dem aktuellen JSON-Wert allein).
  {
    const base = resolveCfg(tanksData, 'player').damage;
    const cfg = applyUpgrades(resolveCfg(tanksData, 'player'), { core_damage_c: 3, core_damage_r: 2 }, upgradesData, 'mine', null);
    const erwartet = base + U.core_damage_c.core.damageAdd * 3 + U.core_damage_r.core.damageAdd * 2;
    check(cfg.damage === erwartet, `Phase 10: Schadenskarte ergibt ${cfg.damage} statt ${erwartet}`);
    // Treffer gegen den Braunen (20 LP): ceil(20/Schaden).
    const brownHp = tanksData.types.t_brown.maxHp;
    check(Math.ceil(brownHp / cfg.damage) === Math.ceil(brownHp / erwartet), 'Phase 10: Trefferzahl gegen den Braunen stimmt nicht');
  }

  // (d) Kritkarte (Testschritt 3): stapelt critChance ueber den Deckel, der
  //     Roll klemmt trotzdem am Cap (die Klemme sitzt in tank.js).
  {
    const cap = tanksData.balance.crit.cap;
    const cfg = applyUpgrades(resolveCfg(tanksData, 'player'), { core_crit_c: 3, core_crit_r: 2, core_crit_l: 1 }, upgradesData, 'mine', null);
    check(cfg.critChance > cap, `Phase 10: Kernkritkarten treiben critChance nicht ueber den Cap (${cfg.critChance} <= ${cap})`);
    check(Math.min(cap, cfg.critChance) === cap, 'Phase 10: der Deckel klemmt die gestapelte Kritchance nicht');
  }

  // (e) Ausweichen-Kernkarte schaltet den Dash frei und verkuerzt die
  //     Abklingzeit (multiplikativ), ohne die alte dash-Karte.
  {
    const cfg = applyUpgrades(resolveCfg(tanksData, 'player'), { core_dodge_r: 1 }, upgradesData, 'mine', null);
    check(!!cfg.dash, 'Phase 10: Ausweichen-Kernkarte schaltet den Dash nicht frei');
    const baseCd = U.dash.cooldownS;
    check(Math.abs(cfg.dash.cooldown - baseCd * U.core_dodge_r.core.dashCdMult) < 1e-6, `Phase 10: Dash-Abklingzeit ${cfg.dash.cooldown} statt ${baseCd * U.core_dodge_r.core.dashCdMult}`);
  }

  // (f) Ersatzeintrag (Testschritt 4): ist der ganze Pool ausgereizt, liefert
  //     rollOffers Fallback-Karten statt zu crashen.
  {
    const allChosen = {};
    for (const id in U) allChosen[id] = U[id].maxStacks;
    const offers = rollOffers(upgradesData, {
      chosen: allChosen, roomIndex: 20, rng: mulberry32(7), balance: tanksData.balance, count: 3, banned: new Set(),
    });
    check(offers.length === 3 && offers.every((o) => o.fallback), 'Phase 10: der Ersatzeintrag greift nicht bei erschoepftem Pool');
  }
}

// ---- 19. UMBAUPLAN-LP Phase 11: Physisch-Topf + Element-Filter ------------
// 12 physische Karten (4/4/4), Angebotsfilterung nach damageType, plus die
// physischen Trefferregeln. Mechanismus mit eigenen Zahlen; Gegenprobe best.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { stepState } = await import('../src/game/state.js');
  const { resolveCfg, applyUpgrades } = await import('../src/game/cfg.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
  const U = upgradesData.upgrades;
  const phys = Object.entries(U).filter(([, d]) => d.damageType === 'physical');

  // (a) Struktur: 12 physische Karten, 4/4/4, alle Tag+damageType 'physical'.
  {
    check(phys.length === 12, `Phase 11: ${phys.length} physische Karten statt 12`);
    const rar = { common: 0, rare: 0, legendary: 0 };
    for (const [, d] of phys) rar[d.rarity]++;
    check(rar.common === 4 && rar.rare === 4 && rar.legendary === 4, `Phase 11: Verteilung ${JSON.stringify(rar)} statt 4/4/4`);
    check(phys.every(([, d]) => d.tag === 'physical'), 'Phase 11: nicht alle physischen Karten tragen Tag physical');
  }

  // (b) Angebotsfilter (Testschritt 5): eine physische Klasse sieht physische
  //     Karten, eine Frostklasse NICHT.
  {
    const sieht = (element) => {
      const rng = mulberry32(1);
      for (let i = 0; i < 300; i++) {
        const offers = rollOffers(upgradesData, {
          chosen: {}, roomIndex: 10, rng, balance: tanksData.balance, count: 3, banned: new Set(), elements: [element],
        });
        if (offers.some((o) => String(o.id || '').startsWith('phys_'))) return true;
      }
      return false;
    };
    check(sieht('physical'), 'Phase 11: physische Klasse sieht keine physischen Karten');
    check(!sieht('frost'), 'Phase 11: Frostklasse sieht physische Karten (Element-Filter greift nicht)');
  }

  // (c) Applier: Stat-Karten (Testschritt 1/2), mit eigenen Zahlen.
  {
    const base = resolveCfg(tanksData, 'player').damage;
    const ap = applyUpgrades(resolveCfg(tanksData, 'player'), { phys_ap: 3 }, upgradesData, 'mine', null);
    check(ap.damage === base + 6, `Phase 11: Panzerbrechend x3 ergibt ${ap.damage} statt ${base + 6}`);
    const rg = applyUpgrades(resolveCfg(tanksData, 'player'), { phys_railgun: 1 }, upgradesData, 'mine', null);
    check(rg.magazine === 1, `Phase 11: Railgun-Magazin ${rg.magazine} statt 1`);
    check(rg.damage === Math.round(base * 3), `Phase 11: Railgun-Schaden ${rg.damage} statt ${Math.round(base * 3)}`);
  }

  // Feuert eine physische Kugel vom Spieler (mit gesetzten cfg-Feldern) auf ein
  // Ziel; misst den hp-Abfall. Ziel ohne Panzerung/Schild.
  const treffer = (ownerFields, { damage = 10, bounces = 0, crit = false, hp = 9999, maxHp = 9999 } = {}) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    Object.assign(st.player.cfg, ownerFields);
    const z = {
      ...proto, x: 200, y: 250, prevX: 200, prevY: 250,
      alive: true, hp, protect: 0, shieldReady: false, status: {},
      cfg: { ...proto.cfg, maxHp, armor: null, requiresRicochet: false, bounceDamageTakenMult: null },
    };
    st.tanks.push(z);
    const b = createBullet(z.x, z.y, 0, {
      speed: 1, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet', damage, damageType: 'physical', crit,
    });
    b.age = 5;
    b.wallBounces = bounces;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    const vor = z.hp;
    stepState(st, CMD0, 1 / 60);
    return { dmg: vor - z.hp, tot: !z.alive };
  };

  // (d) Kaltschütze: gebandeter Schuss ist kritisch (×2) trotz crit=false.
  //     Testschritt 3 (Zusammenspiel mit dem Bankschuss-Faktor).
  {
    const plain = treffer({}, { damage: 10, bounces: 1 }).dmg; // Abprall ×2 = 20
    const cold = treffer({ critOnBounce: true }, { damage: 10, bounces: 1 }).dmg; // ×2 Abprall × ×2 Krit = 40
    check(plain === 20, `Phase 11: Vorbedingung Bankschaden ${plain} statt 20`);
    check(cold === 40, `Phase 11: Kaltschütze macht gebandeten Schuss nicht kritisch (${cold} statt 40)`);
  }

  // (e) Splittergeschoss: Krit-Faktor +0,5 -> ×2,5.
  {
    const base = treffer({}, { damage: 10, crit: true }).dmg; // ×2 = 20
    const boost = treffer({ critMultBonus: 0.5 }, { damage: 10, crit: true }).dmg; // ×2,5 = 25
    check(base === 20 && boost === 25, `Phase 11: Splittergeschoss ${boost} statt 25 (Basis ${base})`);
  }

  // (f) Fangschuss: +40 % gegen Ziele unter 30 % LP, sonst nichts.
  {
    const low = treffer({ executeThreshold: 0.3, executeMult: 1.4 }, { damage: 10, hp: 20, maxHp: 100 }).dmg;
    const high = treffer({ executeThreshold: 0.3, executeMult: 1.4 }, { damage: 10, hp: 90, maxHp: 100 }).dmg;
    check(low === 14, `Phase 11: Fangschuss gegen angeschlagenes Ziel ${low} statt 14`);
    check(high === 10, `Phase 11: Fangschuss trifft volles Ziel faelschlich haerter (${high} statt 10)`);
  }

  // (g) Abprallkönig: gebandet Abprall ×2 UND Bonus ×2 = ×4.
  {
    const king = treffer({ bounceDamageBonus: 1.0 }, { damage: 10, bounces: 1 }).dmg;
    check(king === 40, `Phase 11: Abprallkönig gebandet ${king} statt 40`);
  }

  // (h) Kopfschuss: ein Krit tötet einen Nicht-Boss sofort.
  {
    const r = treffer({ critExecute: true }, { damage: 10, crit: true, hp: 300, maxHp: 300 });
    check(r.tot, `Phase 11: Kopfschuss tötet den Nicht-Boss nicht (Schaden ${r.dmg} bei 300 LP)`);
  }
}

// ---- 20. UMBAUPLAN-LP Phase 12: Sprengstoff-Topf -------------------------
// 12 explosive Karten (4/4/4), Explosionsradius/-schaden-Effekte + der
// Explosionsschaden-Multiplikator im Zuendpfad. Gegenprobe bestanden.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { stepState } = await import('../src/game/state.js');
  const { resolveCfg, applyUpgrades } = await import('../src/game/cfg.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
  const U = upgradesData.upgrades;
  const expl = Object.entries(U).filter(([, d]) => d.damageType === 'explosive');

  // (a) Struktur: 12 explosive Karten, 4/4/4, Tag+damageType explosive.
  {
    check(expl.length === 12, `Phase 12: ${expl.length} explosive Karten statt 12`);
    const rar = { common: 0, rare: 0, legendary: 0 };
    for (const [, d] of expl) rar[d.rarity]++;
    check(rar.common === 4 && rar.rare === 4 && rar.legendary === 4, `Phase 12: Verteilung ${JSON.stringify(rar)} statt 4/4/4`);
    check(expl.every(([, d]) => d.tag === 'explosive'), 'Phase 12: nicht alle explosiven Karten tragen Tag explosive');
  }

  // (b) Filter: der Sprengpanzer (Element explosive) sieht sie, ein physischer
  //     Panzer NICHT.
  {
    const sieht = (element) => {
      const rng = mulberry32(3);
      for (let i = 0; i < 300; i++) {
        const offers = rollOffers(upgradesData, {
          chosen: {}, roomIndex: 10, rng, balance: tanksData.balance, count: 3, banned: new Set(), elements: [element],
        });
        if (offers.some((o) => String(o.id || '').startsWith('expl_'))) return true;
      }
      return false;
    };
    check(sieht('explosive'), 'Phase 12: Sprengpanzer sieht keine explosiven Karten');
    check(!sieht('physical'), 'Phase 12: physische Klasse sieht explosive Karten (Filter greift nicht)');
  }

  // (c) Applier: Explosiv-Schalter setzt Radius; explosionRadiusMult wirkt auf
  //     Schuss UND Mine; explosionDamageMult + Schrapnell landen im cfg.
  {
    const cfg = applyUpgrades(resolveCfg(tanksData, 'c_blast'), { expl_shots: 1, expl_radius: 3, expl_power: 3 }, upgradesData, 'mine', null);
    check(cfg.allExplosive === true, 'Phase 12: Sprengmunition schaltet allExplosive nicht');
    const rmult = Math.pow(1.12, 3);
    check(Math.abs(cfg.shotExplosionRadius - 50 * rmult) < 1e-6, `Phase 12: Schussradius ${cfg.shotExplosionRadius} statt ${50 * rmult}`);
    // c_blast-Passiv (classMineRadiusMult 1.2) * explosionRadiusMult:
    check(Math.abs(cfg.mineRadiusMult - 1.2 * rmult) < 1e-6, `Phase 12: mineRadiusMult ${cfg.mineRadiusMult} statt ${1.2 * rmult}`);
    check(Math.abs(cfg.explosionDamageMult - Math.pow(1.12, 3)) < 1e-6, `Phase 12: explosionDamageMult ${cfg.explosionDamageMult}`);
    const clu = applyUpgrades(resolveCfg(tanksData, 'c_blast'), { expl_clusterbomb: 1 }, upgradesData, 'mine', null);
    check(clu.schrapnell === 8, `Phase 12: Streubombe setzt Schrapnell ${clu.schrapnell} statt 8`);
  }

  // (d) Zündpfad: ein Sprenggeschoss mit explosionDamageMult richtet den
  //     skalierten Explosionsschaden an (Testschritt 2, am Ziel gemessen). Der
  //     Bankschuss-Faktor beruehrt die EXPLOSION bewusst nicht (Testschritt 3).
  const explDmg = (fields, bounces = 0) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    Object.assign(st.player.cfg, fields);
    const z = {
      ...proto, x: 300, y: 250, prevX: 300, prevY: 250,
      alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
      cfg: { ...proto.cfg, maxHp: 9999, armor: null, requiresRicochet: false },
    };
    st.tanks.push(z);
    // Bereits totes Sprenggeschoss GENAU am Ziel -> nur die Explosion wirkt.
    const b = createBullet(z.x, z.y, 0, { speed: 1, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet', damage: 10, damageType: 'explosive' });
    b.explosive = true;
    b.explosionRadius = 60;
    b.dead = true;
    b.wallBounces = bounces;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    const vor = z.hp;
    stepState(st, CMD0, 1 / 60);
    return vor - z.hp;
  };
  {
    const base = tanksData.balance.damage.explosion; // 40
    check(explDmg({}) === base, `Phase 12: Standard-Explosionsschaden ${explDmg({})} statt ${base}`);
    check(explDmg({ explosionDamageMult: 1.5 }) === Math.round(base * 1.5), `Phase 12: skalierter Explosionsschaden ${explDmg({ explosionDamageMult: 1.5 })} statt ${Math.round(base * 1.5)}`);
    // Der Bankschuss verdoppelt den AUFSCHLAG, nicht die Explosion:
    check(explDmg({ explosionDamageMult: 1.5 }, 2) === Math.round(base * 1.5), 'Phase 12: der Abpraller verdoppelt faelschlich die Explosion');
  }
}

// ---- 21. UMBAUPLAN-LP Phase 13: Feuer-Topf -------------------------------
// 12 Feuerkarten (4/4/4), Brand-Skalierung (Stufen/Dauer/Tickschaden/Deckel)
// + Ausbreitung. Mechanismus mit eigenen Zahlen; Gegenprobe bestanden.
{
  const { resolveCfg, applyUpgrades } = await import('../src/game/cfg.js');
  const { applyTypeEffects } = await import('../src/game/damagetypes.js');
  const { updateStatus } = await import('../src/game/status.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');
  const U = upgradesData.upgrades;
  const fire = Object.entries(U).filter(([, d]) => d.damageType === 'fire');
  const FX = tanksData.status.effects.fire; // damagePerTick 4, durationS 3, maxStacks 3

  // (a) Struktur: 12 Feuerkarten, 4/4/4, Tag+damageType fire.
  {
    check(fire.length === 12, `Phase 13: ${fire.length} Feuerkarten statt 12`);
    const rar = { common: 0, rare: 0, legendary: 0 };
    for (const [, d] of fire) rar[d.rarity]++;
    check(rar.common === 4 && rar.rare === 4 && rar.legendary === 4, `Phase 13: Verteilung ${JSON.stringify(rar)} statt 4/4/4`);
    check(fire.every(([, d]) => d.tag === 'fire'), 'Phase 13: nicht alle Feuerkarten tragen Tag fire');
  }

  // (b) Filter: Flammenpanzer (Element fire) sieht sie, physische Klasse NICHT.
  {
    const sieht = (element) => {
      const rng = mulberry32(5);
      for (let i = 0; i < 300; i++) {
        const offers = rollOffers(upgradesData, {
          chosen: {}, roomIndex: 10, rng, balance: tanksData.balance, count: 3, banned: new Set(), elements: [element],
        });
        if (offers.some((o) => String(o.id || '').startsWith('fire_'))) return true;
      }
      return false;
    };
    check(sieht('fire'), 'Phase 13: Flammenpanzer sieht keine Feuerkarten');
    check(!sieht('physical'), 'Phase 13: physische Klasse sieht Feuerkarten (Filter greift nicht)');
  }

  // (c) Applier: die Status-Boosts landen im cfg; das Klassen-Passiv
  //     (fireDurationMult) bleibt getrennt von statusDurationMult.
  {
    const nap = applyUpgrades(resolveCfg(tanksData, 'c_flame'), { fire_napalm: 2 }, upgradesData, 'mine', null);
    check(nap.statusStackBonus === 2, `Phase 13: Napalm statusStackBonus ${nap.statusStackBonus} statt 2`);
    const hell = applyUpgrades(resolveCfg(tanksData, 'c_flame'), { fire_hellfire: 1 }, upgradesData, 'mine', null);
    check(hell.statusMaxStacksBonus === 2, `Phase 13: Höllenglut statusMaxStacksBonus ${hell.statusMaxStacksBonus} statt 2`);
    const dur = applyUpgrades(resolveCfg(tanksData, 'c_flame'), { fire_dur: 3 }, upgradesData, 'mine', null);
    check(Math.abs(dur.statusDurationMult - Math.pow(1.2, 3)) < 1e-6, `Phase 13: statusDurationMult ${dur.statusDurationMult}`);
    check(dur.fireDurationMult === 1.25, `Phase 13: Klassen-Passiv fireDurationMult ${dur.fireDurationMult} (soll unveraendert 1.25)`);
    const spread = applyUpgrades(resolveCfg(tanksData, 'c_flame'), { fire_spread: 1 }, upgradesData, 'mine', null);
    check(spread.fireSpreadRadius === 70, `Phase 13: fireSpreadRadius ${spread.fireSpreadRadius} statt 70`);
  }

  // Isolierter Raum mit n Zielen in einer Reihe.
  const reihe = (n, abstand = 60) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.player.x = 2000;
    st.player.y = 2000;
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const ziele = [];
    for (let i = 0; i < n; i++) {
      const z = {
        ...proto, x: 200 + i * abstand, y: 250, prevX: 200 + i * abstand, prevY: 250,
        alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
        cfg: { ...proto.cfg, maxHp: 9999 },
      };
      st.tanks.push(z);
      ziele.push(z);
    }
    return { st, ziele };
  };

  // (d) Brandstufen: Grundtreffer 1 Stufe; Napalm (+1) => 2; Deckel greift.
  {
    const { st, ziele } = reihe(1);
    applyTypeEffects(st, ziele[0], 'fire', 10, { ownerCfg: {} });
    check(ziele[0].status.fire.stacks === FX.stacksPerHit, `Phase 13: Grundtreffer ${ziele[0].status.fire.stacks} statt ${FX.stacksPerHit}`);

    const a = reihe(1);
    applyTypeEffects(a.st, a.ziele[0], 'fire', 10, { ownerCfg: { statusStackBonus: 1 } });
    check(a.ziele[0].status.fire.stacks === FX.stacksPerHit + 1, `Phase 13: Napalm ${a.ziele[0].status.fire.stacks} statt ${FX.stacksPerHit + 1}`);

    // Deckel: 5 Stufen auf einmal, Standard-Deckel 3.
    const b = reihe(1);
    applyTypeEffects(b.st, b.ziele[0], 'fire', 10, { ownerCfg: { statusStackBonus: 4 } });
    check(b.ziele[0].status.fire.stacks === FX.maxStacks, `Phase 13: Deckel greift nicht (${b.ziele[0].status.fire.stacks} statt ${FX.maxStacks})`);
    // Höllenglut hebt ihn auf 5.
    const c = reihe(1);
    applyTypeEffects(c.st, c.ziele[0], 'fire', 10, { ownerCfg: { statusStackBonus: 4, statusMaxStacksBonus: 2 } });
    check(c.ziele[0].status.fire.stacks === FX.maxStacks + 2, `Phase 13: angehobener Deckel (${c.ziele[0].status.fire.stacks} statt ${FX.maxStacks + 2})`);
  }

  // (e) Dauer und Tickschaden skalieren (mit eigenen Faktoren).
  {
    const { st, ziele } = reihe(1);
    applyTypeEffects(st, ziele[0], 'fire', 10, { ownerCfg: { statusDurationMult: 2 } });
    check(Math.abs(ziele[0].status.fire.timeLeft - FX.durationS * 2) < 1e-6, `Phase 13: Branddauer ${ziele[0].status.fire.timeLeft} statt ${FX.durationS * 2}`);

    // Tickschaden: 1 Stufe, ×1,5 -> ein 0,5-s-Tick = 4*1*1,5 = 6.
    const a = reihe(1);
    applyTypeEffects(a.st, a.ziele[0], 'fire', 10, { ownerCfg: { statusTickMult: 1.5 } });
    const vor = a.ziele[0].hp;
    updateStatus(a.st, 0.5);
    check(a.ziele[0].hp === vor - FX.damagePerTick * 1.5, `Phase 13: Brandtick ${vor - a.ziele[0].hp} statt ${FX.damagePerTick * 1.5}`);
  }

  // (f) Ausbreitung: ein Treffer entzündet einen nahen Gegner mit.
  {
    const { st, ziele } = reihe(2, 50); // 50 px < fireSpreadRadius 70
    applyTypeEffects(st, ziele[0], 'fire', 10, { ownerCfg: { fireSpreadRadius: 70 } });
    check(ziele[1].status.fire?.stacks > 0, 'Phase 13: Brandherd entzündet den nahen Gegner nicht');

    const b = reihe(2, 200); // 200 px > 70 -> keine Ausbreitung
    applyTypeEffects(b.st, b.ziele[0], 'fire', 10, { ownerCfg: { fireSpreadRadius: 70 } });
    check(!(b.ziele[1].status.fire?.stacks > 0), 'Phase 13: Brand breitet sich über die Reichweite hinaus aus');
  }
}

// ---- 22. UMBAUPLAN-LP Phase 14: Frost-Topf -------------------------------
// 12 Frostkarten (4/4/4): stärkere Verlangsamung, früheres/längeres Einfrieren,
// Schaden gegen erstarrte Ziele. Gegenprobe bestanden.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { stepState } = await import('../src/game/state.js');
  const { resolveCfg, applyUpgrades } = await import('../src/game/cfg.js');
  const { applyTypeEffects } = await import('../src/game/damagetypes.js');
  const { statusSpeedMult } = await import('../src/game/status.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
  const U = upgradesData.upgrades;
  const frost = Object.entries(U).filter(([, d]) => d.damageType === 'frost');
  const FR = tanksData.status.effects.frost; // speedMult 0.6, freezeAtStacks 3, freezeS 1, maxStacks 3

  // (a) Struktur: 12 Frostkarten, 4/4/4, Tag+damageType frost.
  {
    check(frost.length === 12, `Phase 14: ${frost.length} Frostkarten statt 12`);
    const rar = { common: 0, rare: 0, legendary: 0 };
    for (const [, d] of frost) rar[d.rarity]++;
    check(rar.common === 4 && rar.rare === 4 && rar.legendary === 4, `Phase 14: Verteilung ${JSON.stringify(rar)} statt 4/4/4`);
    check(frost.every(([, d]) => d.tag === 'frost'), 'Phase 14: nicht alle Frostkarten tragen Tag frost');
  }

  // (b) Filter: Frostpanzer sieht sie, physische Klasse NICHT.
  {
    const sieht = (element) => {
      const rng = mulberry32(9);
      for (let i = 0; i < 300; i++) {
        const offers = rollOffers(upgradesData, {
          chosen: {}, roomIndex: 10, rng, balance: tanksData.balance, count: 3, banned: new Set(), elements: [element],
        });
        if (offers.some((o) => String(o.id || '').startsWith('frost_'))) return true;
      }
      return false;
    };
    check(sieht('frost'), 'Phase 14: Frostpanzer sieht keine Frostkarten');
    check(!sieht('physical'), 'Phase 14: physische Klasse sieht Frostkarten (Filter greift nicht)');
  }

  // (c) Applier: frostSlowBonus ADDITIV zum Klassen-Passiv; Freeze-Hebel +
  //     Splittern landen im cfg.
  {
    const slow = applyUpgrades(resolveCfg(tanksData, 'c_frost'), { frost_slow: 3 }, upgradesData, 'mine', null);
    // c_frost-Passiv 0.2 + 0.1*3 = 0.5
    check(Math.abs(slow.frostSlowBonus - 0.5) < 1e-6, `Phase 14: frostSlowBonus ${slow.frostSlowBonus} statt 0.5 (Passiv additiv)`);
    const deep = applyUpgrades(resolveCfg(tanksData, 'c_frost'), { frost_deep: 1 }, upgradesData, 'mine', null);
    check(deep.frostFreezeReduction === 1, `Phase 14: frostFreezeReduction ${deep.frostFreezeReduction} statt 1`);
    const shatter = applyUpgrades(resolveCfg(tanksData, 'c_frost'), { frost_shatter: 2 }, upgradesData, 'mine', null);
    check(Math.abs(shatter.shatterMult - 1.0) < 1e-6, `Phase 14: shatterMult ${shatter.shatterMult} statt 1.0`);
  }

  const reihe = (n, abstand = 60) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.player.x = 2000;
    st.player.y = 2000;
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const ziele = [];
    for (let i = 0; i < n; i++) {
      const z = {
        ...proto, x: 200 + i * abstand, y: 250, prevX: 200 + i * abstand, prevY: 250,
        alive: true, hp: 9999, protect: 0, shieldReady: false, status: {}, stunTimer: 0,
        cfg: { ...proto.cfg, maxHp: 9999 },
      };
      st.tanks.push(z);
      ziele.push(z);
    }
    return { st, ziele };
  };

  // (d) Stärkere Verlangsamung: der Eintrag traegt den berechneten speedMult.
  {
    const { st, ziele } = reihe(1);
    applyTypeEffects(st, ziele[0], 'frost', 10, { ownerCfg: { frostSlowBonus: 0.2 } });
    const erwartet = 1 - (1 - FR.speedMult) * 1.2; // 0.52
    check(Math.abs(ziele[0].status.frost.speedMult - erwartet) < 1e-6, `Phase 14: Frost-speedMult ${ziele[0].status.frost.speedMult} statt ${erwartet}`);
    check(Math.abs(statusSpeedMult(st, ziele[0]) - erwartet) < 1e-6, 'Phase 14: statusSpeedMult nutzt den Eintrags-Override nicht');
  }

  // (e) Frueheres Einfrieren: bei 2 Stufen mit Reduktion 1 friert es ein,
  //     ohne Reduktion (Schwelle 3) nicht.
  {
    const a = reihe(1);
    applyTypeEffects(a.st, a.ziele[0], 'frost', 10, { ownerCfg: { statusStackBonus: 1, frostFreezeReduction: 1 } });
    check(a.ziele[0].status.frost.stacks === 2, `Phase 14: Vorbedingung ${a.ziele[0].status.frost.stacks} Stufen statt 2`);
    check(a.ziele[0].stunTimer > 0, 'Phase 14: Tiefkühlung friert bei 2 Stufen nicht ein');

    const b = reihe(1);
    applyTypeEffects(b.st, b.ziele[0], 'frost', 10, { ownerCfg: { statusStackBonus: 1 } });
    check(b.ziele[0].stunTimer === 0, 'Phase 14: friert schon bei 2 Stufen OHNE Reduktion ein');
  }

  // (f) Längeres Einfrieren: 3 Stufen -> stunTimer = freezeS + Bonus.
  {
    const { st, ziele } = reihe(1);
    applyTypeEffects(st, ziele[0], 'frost', 10, { ownerCfg: { statusStackBonus: 2, frostFreezeDurationBonus: 1.0 } });
    check(ziele[0].status.frost.stacks === FR.freezeAtStacks, `Phase 14: Vorbedingung ${ziele[0].status.frost.stacks} Stufen statt ${FR.freezeAtStacks}`);
    check(Math.abs(ziele[0].stunTimer - (FR.freezeS + 1.0)) < 1e-6, `Phase 14: Einfrierdauer ${ziele[0].stunTimer} statt ${FR.freezeS + 1.0}`);
  }

  // (g) Splittern: +Schaden gegen ein bereits erstarrtes (betaeubtes) Ziel.
  {
    const schaden = (shatter, stun) => {
      const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
      const proto = st.tanks.find((t) => t !== st.player && t.alive);
      st.tanks.length = 0;
      st.tanks.push(st.player);
      if (shatter) st.player.cfg.shatterMult = shatter;
      const z = {
        ...proto, x: 200, y: 250, prevX: 200, prevY: 250,
        alive: true, hp: 9999, protect: 0, shieldReady: false, status: {}, stunTimer: stun,
        cfg: { ...proto.cfg, maxHp: 9999, armor: null, requiresRicochet: false },
      };
      st.tanks.push(z);
      const b = createBullet(z.x, z.y, 0, { speed: 1, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet', damage: 10, damageType: 'frost' });
      b.age = 5;
      st.bullets.length = 0;
      st.mines.length = 0;
      st.bullets.push(b);
      const vor = z.hp;
      stepState(st, CMD0, 1 / 60);
      return vor - z.hp;
    };
    check(schaden(0.5, 1) === 15, `Phase 14: Splittern gegen erstarrtes Ziel ${schaden(0.5, 1)} statt 15`);
    check(schaden(0.5, 0) === 10, `Phase 14: Splittern trifft ein NICHT erstarrtes Ziel faelschlich haerter (${schaden(0.5, 0)})`);
  }
}

// ---- 23. UMBAUPLAN-LP Phase 15: Gift-Topf --------------------------------
// 12 Giftkarten (4/4/4): Gift tickt (wie Feuer) mit hohem Deckel; Karten nutzen
// die generischen Status-Boosts + eine Gift-Ausbreitung. Gegenprobe bestanden.
{
  const { resolveCfg, applyUpgrades } = await import('../src/game/cfg.js');
  const { applyTypeEffects } = await import('../src/game/damagetypes.js');
  const { updateStatus } = await import('../src/game/status.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');
  const U = upgradesData.upgrades;
  const poison = Object.entries(U).filter(([, d]) => d.damageType === 'poison');
  const PO = tanksData.status.effects.poison; // damagePerTick 2, durationS 6, maxStacks 5

  // (a) Struktur: 12 Giftkarten, 4/4/4, Tag+damageType poison.
  {
    check(poison.length === 12, `Phase 15: ${poison.length} Giftkarten statt 12`);
    const rar = { common: 0, rare: 0, legendary: 0 };
    for (const [, d] of poison) rar[d.rarity]++;
    check(rar.common === 4 && rar.rare === 4 && rar.legendary === 4, `Phase 15: Verteilung ${JSON.stringify(rar)} statt 4/4/4`);
    check(poison.every(([, d]) => d.tag === 'poison'), 'Phase 15: nicht alle Giftkarten tragen Tag poison');
  }

  // (b) Filter: Radioaktiv-Panzer (Element poison) sieht sie, physische Klasse NICHT.
  {
    const sieht = (element) => {
      const rng = mulberry32(11);
      for (let i = 0; i < 300; i++) {
        const offers = rollOffers(upgradesData, {
          chosen: {}, roomIndex: 10, rng, balance: tanksData.balance, count: 3, banned: new Set(), elements: [element],
        });
        if (offers.some((o) => String(o.id || '').startsWith('poison_'))) return true;
      }
      return false;
    };
    check(sieht('poison'), 'Phase 15: Radioaktiv-Panzer sieht keine Giftkarten');
    check(!sieht('physical'), 'Phase 15: physische Klasse sieht Giftkarten (Filter greift nicht)');
  }

  // (c) Applier: Status-Boosts + Ausbreitung; Klassen-Passiv (poisonDurationMult)
  //     bleibt getrennt von statusDurationMult.
  {
    const st = applyUpgrades(resolveCfg(tanksData, 'c_toxic'), { poison_stack: 2 }, upgradesData, 'mine', null);
    check(st.statusStackBonus === 2, `Phase 15: Nervengift statusStackBonus ${st.statusStackBonus} statt 2`);
    const cap = applyUpgrades(resolveCfg(tanksData, 'c_toxic'), { poison_cap: 1 }, upgradesData, 'mine', null);
    check(cap.statusMaxStacksBonus === 2, `Phase 15: Überdosis statusMaxStacksBonus ${cap.statusMaxStacksBonus} statt 2`);
    const spr = applyUpgrades(resolveCfg(tanksData, 'c_toxic'), { poison_plaguecard: 1 }, upgradesData, 'mine', null);
    check(spr.poisonSpreadRadius === 70, `Phase 15: Seuche poisonSpreadRadius ${spr.poisonSpreadRadius} statt 70`);
    const dur = applyUpgrades(resolveCfg(tanksData, 'c_toxic'), { poison_dur: 3 }, upgradesData, 'mine', null);
    check(dur.poisonDurationMult === 1.25, `Phase 15: Klassen-Passiv poisonDurationMult ${dur.poisonDurationMult} (soll 1.25)`);
    check(Math.abs(dur.statusDurationMult - Math.pow(1.2, 3)) < 1e-6, `Phase 15: statusDurationMult ${dur.statusDurationMult}`);
  }

  const reihe = (n, abstand = 60) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.player.x = 2000;
    st.player.y = 2000;
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const ziele = [];
    for (let i = 0; i < n; i++) {
      const z = {
        ...proto, x: 200 + i * abstand, y: 250, prevX: 200 + i * abstand, prevY: 250,
        alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
        cfg: { ...proto.cfg, maxHp: 9999 },
      };
      st.tanks.push(z);
      ziele.push(z);
    }
    return { st, ziele };
  };

  // (d) Deckel + Dauer + Tickschaden (mit eigenen Zahlen).
  {
    // Deckel: viele Stufen auf einmal, Standard-Deckel 5.
    const a = reihe(1);
    applyTypeEffects(a.st, a.ziele[0], 'poison', 10, { ownerCfg: { statusStackBonus: 6 } });
    check(a.ziele[0].status.poison.stacks === PO.maxStacks, `Phase 15: Deckel greift nicht (${a.ziele[0].status.poison.stacks} statt ${PO.maxStacks})`);
    // Überdosis hebt ihn auf 7.
    const b = reihe(1);
    applyTypeEffects(b.st, b.ziele[0], 'poison', 10, { ownerCfg: { statusStackBonus: 6, statusMaxStacksBonus: 2 } });
    check(b.ziele[0].status.poison.stacks === PO.maxStacks + 2, `Phase 15: angehobener Deckel (${b.ziele[0].status.poison.stacks} statt ${PO.maxStacks + 2})`);

    // Dauer: Klassen-Passiv 1,25 (poisonDurationMult) -> timeLeft 6 * 1,25.
    const c = reihe(1);
    applyTypeEffects(c.st, c.ziele[0], 'poison', 10, { ownerCfg: { poisonDurationMult: 1.25 } });
    check(Math.abs(c.ziele[0].status.poison.timeLeft - PO.durationS * 1.25) < 1e-6, `Phase 15: Giftdauer ${c.ziele[0].status.poison.timeLeft} statt ${PO.durationS * 1.25}`);

    // Tickschaden: 1 Stufe, ×1,5 -> ein 0,5-s-Tick = 2*1*1,5 = 3.
    const e = reihe(1);
    applyTypeEffects(e.st, e.ziele[0], 'poison', 10, { ownerCfg: { statusTickMult: 1.5 } });
    const vor = e.ziele[0].hp;
    updateStatus(e.st, 0.5);
    check(e.ziele[0].hp === vor - PO.damagePerTick * 1.5, `Phase 15: Gifttick ${vor - e.ziele[0].hp} statt ${PO.damagePerTick * 1.5}`);
  }

  // (e) Ausbreitung (Seuche): ein Treffer vergiftet einen nahen Gegner mit,
  //     aber nicht über die Reichweite hinaus.
  {
    const { st, ziele } = reihe(2, 50);
    applyTypeEffects(st, ziele[0], 'poison', 10, { ownerCfg: { poisonSpreadRadius: 70 } });
    check(ziele[1].status.poison?.stacks > 0, 'Phase 15: Seuche vergiftet den nahen Gegner nicht');

    const b = reihe(2, 200);
    applyTypeEffects(b.st, b.ziele[0], 'poison', 10, { ownerCfg: { poisonSpreadRadius: 70 } });
    check(!(b.ziele[1].status.poison?.stacks > 0), 'Phase 15: Gift breitet sich über die Reichweite hinaus aus');
  }
}

// ---- 24. UMBAUPLAN-LP Phase 16: Blitz-Topf -------------------------------
// 12 Blitzkarten (4/4/4): Kette (mehr Ziele, weitere Sprünge, schwächerer
// Abfall) + Betäubung. Mechanismus mit eigenen Zahlen; Gegenprobe bestanden.
{
  const { resolveCfg, applyUpgrades } = await import('../src/game/cfg.js');
  const { applyTypeEffects } = await import('../src/game/damagetypes.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');
  const U = upgradesData.upgrades;
  const light = Object.entries(U).filter(([, d]) => d.damageType === 'lightning');
  const L = tanksData.status.damageTypes.lightning; // maxTargets 3, jumpRangePx 160, falloff 0.7

  // (a) Struktur: 12 Blitzkarten, 4/4/4, Tag+damageType lightning.
  {
    check(light.length === 12, `Phase 16: ${light.length} Blitzkarten statt 12`);
    const rar = { common: 0, rare: 0, legendary: 0 };
    for (const [, d] of light) rar[d.rarity]++;
    check(rar.common === 4 && rar.rare === 4 && rar.legendary === 4, `Phase 16: Verteilung ${JSON.stringify(rar)} statt 4/4/4`);
    check(light.every(([, d]) => d.tag === 'lightning'), 'Phase 16: nicht alle Blitzkarten tragen Tag lightning');
  }

  // (b) Filter: Teslapanzer sieht sie, physische Klasse NICHT.
  {
    const sieht = (element) => {
      const rng = mulberry32(13);
      for (let i = 0; i < 300; i++) {
        const offers = rollOffers(upgradesData, {
          chosen: {}, roomIndex: 10, rng, balance: tanksData.balance, count: 3, banned: new Set(), elements: [element],
        });
        if (offers.some((o) => String(o.id || '').startsWith('light_'))) return true;
      }
      return false;
    };
    check(sieht('lightning'), 'Phase 16: Teslapanzer sieht keine Blitzkarten');
    check(!sieht('physical'), 'Phase 16: physische Klasse sieht Blitzkarten (Filter greift nicht)');
  }

  // (c) Applier: Kettenziele ADDITIV zum Klassen-Passiv; Reichweite/Abfall/
  //     Betäubung landen im cfg.
  {
    const ch = applyUpgrades(resolveCfg(tanksData, 'c_tesla'), { light_chain: 2 }, upgradesData, 'mine', null);
    check(ch.lightningBonusTargets === 3, `Phase 16: Kettenziele ${ch.lightningBonusTargets} statt 3 (Passiv 1 + 2)`);
    const rg = applyUpgrades(resolveCfg(tanksData, 'c_tesla'), { light_range: 3 }, upgradesData, 'mine', null);
    check(rg.lightningRangeBonus === 90, `Phase 16: lightningRangeBonus ${rg.lightningRangeBonus} statt 90`);
    const am = applyUpgrades(resolveCfg(tanksData, 'c_tesla'), { light_amp: 1 }, upgradesData, 'mine', null);
    check(Math.abs(am.lightningFalloffBonus - 0.2) < 1e-6, `Phase 16: lightningFalloffBonus ${am.lightningFalloffBonus} statt 0.2`);
    const su = applyUpgrades(resolveCfg(tanksData, 'c_tesla'), { light_stun: 1 }, upgradesData, 'mine', null);
    check(Math.abs(su.lightningStun - 0.4) < 1e-6, `Phase 16: lightningStun ${su.lightningStun} statt 0.4`);
  }

  const reihe = (n, abstand) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.player.x = 4000;
    st.player.y = 4000;
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const ziele = [];
    for (let i = 0; i < n; i++) {
      const z = {
        ...proto, x: 200 + i * abstand, y: 250, prevX: 200 + i * abstand, prevY: 250,
        alive: true, hp: 9999, protect: 0, shieldReady: false, status: {}, stunTimer: 0,
        cfg: { ...proto.cfg, maxHp: 9999, armor: null, requiresRicochet: false },
      };
      st.tanks.push(z);
      ziele.push(z);
    }
    return { st, ziele };
  };
  // Blitz mit gesetzten Owner-cfg-Feldern auslösen. Wie in der echten
  // Trefferschleife wird ERST der Aufschlag am Einschlagziel angewandt, DANN
  // die Kette (applyTypeEffects schaedigt das Einschlagziel selbst nicht).
  const blitz = (st, ziel, oc, dmg = 20) => {
    st.applyDamage(ziel, dmg, 'test', {});
    applyTypeEffects(st, ziel, 'lightning', dmg, { lightningBonus: oc.lightningBonusTargets || 0, ownerCfg: oc });
  };

  // (d) Mehr Kettenziele: Basis 3, mit +2 -> 5 von 6 getroffen.
  {
    const abstand = Math.round(L.jumpRangePx * 0.5);
    const a = reihe(6, abstand);
    const vorA = a.ziele.map((z) => z.hp);
    blitz(a.st, a.ziele[0], {});
    check(a.ziele.filter((z, i) => vorA[i] - z.hp > 0).length === L.maxTargets, `Phase 16: Basis-Kette trifft nicht ${L.maxTargets}`);

    const b = reihe(6, abstand);
    const vorB = b.ziele.map((z) => z.hp);
    blitz(b.st, b.ziele[0], { lightningBonusTargets: 2 });
    check(b.ziele.filter((z, i) => vorB[i] - z.hp > 0).length === L.maxTargets + 2, `Phase 16: +2 Kettenziele greifen nicht (${b.ziele.filter((z, i) => vorB[i] - z.hp > 0).length})`);
  }

  // (e) Weitere Sprünge: Ziel jenseits der Basisreichweite wird erst mit
  //     Reichweiten-Bonus erreicht.
  {
    const a = reihe(2, L.jumpRangePx + 40); // 200 > 160
    const vorA = a.ziele[1].hp;
    blitz(a.st, a.ziele[0], {});
    check(a.ziele[1].hp === vorA, `Phase 16: Vorbedingung -- Blitz erreicht das ferne Ziel schon ohne Bonus`);

    const b = reihe(2, L.jumpRangePx + 40);
    const vorB = b.ziele[1].hp;
    blitz(b.st, b.ziele[0], { lightningRangeBonus: 80 });
    check(b.ziele[1].hp < vorB, 'Phase 16: Reichweiten-Bonus erreicht das ferne Ziel nicht');
  }

  // (f) Schwächerer Abfall: der erste Sprung macht mehr Schaden.
  {
    const abstand = Math.round(L.jumpRangePx * 0.5);
    const a = reihe(2, abstand);
    const vorA = a.ziele[1].hp;
    blitz(a.st, a.ziele[0], {}, 20);
    const basisSprung = vorA - a.ziele[1].hp; // round(20 * 0.7) = 14

    const b = reihe(2, abstand);
    const vorB = b.ziele[1].hp;
    blitz(b.st, b.ziele[0], { lightningFalloffBonus: 0.2 }, 20); // falloff 0.9 -> 18
    const starkSprung = vorB - b.ziele[1].hp;
    check(basisSprung === Math.round(20 * L.falloff), `Phase 16: Basis-Sprungschaden ${basisSprung} statt ${Math.round(20 * L.falloff)}`);
    check(starkSprung === Math.round(20 * (L.falloff + 0.2)), `Phase 16: Verstärker-Sprungschaden ${starkSprung} statt ${Math.round(20 * (L.falloff + 0.2))}`);
  }

  // (g) Überschlag: das Kettenglied wird betäubt.
  {
    const abstand = Math.round(L.jumpRangePx * 0.5);
    const { st, ziele } = reihe(2, abstand);
    blitz(st, ziele[0], { lightningStun: 0.4 });
    check(ziele[1].stunTimer >= 0.4, `Phase 16: Überschlag betäubt das Kettenglied nicht (${ziele[1].stunTimer})`);
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
