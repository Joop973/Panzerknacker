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

import { createRun, stepRun, chooseUpgrade, enterRoom, chooseMapNode, leaveWorkshop, chooseEventOption, repairAtRest, workbenchOptions, upgradeCardAtRest, advanceAct, runSnapshot, buyShopCard, buyShopLife, buyShopUpgradeLevel, buyShieldCharge, chooseBossReward } from '../src/game/run.js';
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
const necroData = load('upgrades_necro'); // Nekromant-V2 Phase 0: 105-Karten-Signaturpool, noch nicht in die Angebots-Pipeline eingehaengt
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
diffData.compositions = load('compositions').compositions; // G4: Kompositionsrezepte fuer buyEnemies()

let failures = 0;
function check(ok, msg) {
  if (ok) return;
  failures++;
  console.error('FEHLER:', msg);
}

// Grundsteinumbau Phase 7: Ersatz fuer das entfernte leaveRest() in den
// Playthrough-Schleifen weiter unten -- probiert Reparatur zuerst (faellt
// bei vollen Leben auf false zurueck), sonst die erste aufwertbare Karte an
// der Werkbank. Beide Aktionen beenden den Raum selbst (afterRoomDone()).
function passRest(run) {
  if (run.phase !== 'rest') return;
  if (repairAtRest(run)) return;
  const opts = workbenchOptions(run);
  if (opts.length) upgradeCardAtRest(run, opts[0].id);
}

// Champion-/Nekromant-Nachschliff Abschnitt 17: die garantierte Boss-
// Belohnung braucht in JEDEM Playthrough-Durchlauf eine Wahl, sonst haengt
// der Run in Phase "bossReward" fest (dieselbe Fehlerklasse wie ein
// vergessener Kartenscreen-Schritt).
function passBossReward(run) {
  if (run.phase !== 'bossReward' || !run.pendingOffers) return;
  chooseBossReward(run, 0);
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

// ---- 6a. Jede Transformation ist ueberhaupt freischaltbar -- archiviert -
// Transformationen (Phase 17) sind mit Grundsteinumbau Phase 4 deaktiviert
// (unlockTransformation() wird nicht mehr aufgerufen, s. run.js:
// applyUpgradeChoice()) -- der 5-Karten-Sockel hat bewusst KEINE drei Karten
// desselben Transformations-Tags mehr (terrain/mobility/information/
// defense/control), s. data/upgrades.json: _comment_sockel. Diese Pruefung
// waere seitdem strukturell immer rot, ohne dass etwas kaputt ist. Details/
// Wiederanschlusspunkt: ARCHIV.md, archive/systeme-v1.md Abschnitt 1.

// ---- 6b. Jede Karte loest sauber in ein Spieler-cfg auf -----------------
// Fängt Karten, die ein Feld benutzen, das eine ANDERE Karte setzt (z. B.
// Doppelschlag ohne Powershot -> bulletSpeed * undefined = NaN).
// Nekromant-V2 Phase 1: die Schleife lief urspruenglich bis def.maxStacks --
// seit das Feld abgeschafft ist, waere `lvl <= undefined` fuer JEDE reale
// Karte sofort falsch und der gesamte Test liefe fuer KEINE einzige Stufe
// (Gegenprobe bestaetigt: 0 statt >=5 geprueften Kombinationen). Ersetzt
// durch einen festen Stufensatz -- fuer isUnique-Karten nur Stufe 1 (mehr
// kann im echten Spiel nie vorkommen), sonst auch hohe Stufen (die Karten
// sind jetzt unbegrenzt stapelbar, "20" prueft bewusst ueber jeden bisher
// realistischen Wert hinaus).
{
  const numericFields = [
    'speed', 'bulletSpeed', 'fireCooldown', 'magazine', 'mines',
    'radius', 'bulletRadius',
  ];
  let geprueft = 0;
  for (const id of Object.keys(upgradesData.upgrades)) {
    const def = upgradesData.upgrades[id];
    const levels = def.isUnique ? [1] : [1, 2, 5, 20];
    for (const lvl of levels) {
      geprueft++;
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
      if (cfg.powershotPerRoom) {
        check(
          Number.isFinite(cfg.powershotSpeedFactor),
          `Karte "${id}" Stufe ${lvl}: vergibt Powershot-Ladungen ohne speedFactor`,
        );
      }
    }
  }
  check(
    geprueft >= Object.keys(upgradesData.upgrades).length,
    `Karten-cfg-Aufloesung: nur ${geprueft} Stufen-Kombinationen geprueft -- die Schleife lief moeglicherweise fuer keine Karte`,
  );
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

  const drawAll = (chosen, starterTank) =>
    rollOffers(upgradesData, {
      chosen,
      roomIndex: 99, // alle minRoom-Gates offen
      rng: mulberry32(12345),
      balance: tanksData.balance,
      count: 300, // zieht den Pool leer, danach Fallback
      ignoreTagRule: true,
      equippedSecondary: 'mine',
      banned: new Set(),
      starterTank, // Phase 18: nur so werden die klassengebundenen Signaturen sichtbar
    }).filter((o) => !o.fallback).map((o) => o.id);

  // Tag `weapon` ist grundsaetzlich gesperrt; Welle 1 hat genau diese zwei
  // namentlich freigegeben (upgradepool.js: WEAPON_ALLOWLIST). Sie hier
  // explizit einzufordern ist der Sinn des Tests -- eine pauschale
  // "weapon darf fehlen"-Ausnahme haette ihn fuer genau die Fehlerklasse
  // wirkungslos gemacht, gegen die er gebaut ist.
  const WEAPON_FREIGEGEBEN = new Set(['doppelrohr', 'flak']);
  // Phase 18: Signaturkarten erscheinen nur bei ihrer Klasse -- die
  // Erreichbarkeitsmenge muss deshalb auch mit jeder Signaturklasse gezogen
  // werden, sonst gelten die klassengebundenen Karten faelschlich als "tot".
  const sigClasses = new Set(
    Object.values(defs).map((d) => d.signatureClass).filter(Boolean),
  );
  const reachable = new Set([...drawAll({}), ...drawAll(reqTargets)]);
  for (const klass of sigClasses) {
    for (const id of drawAll({}, klass)) reachable.add(id);
    // Upgradepool-v2 Phase 8: Nekromant-Signaturkarten sind die ersten mit
    // einem `requires` auf eine ANDERE Signaturkarte derselben Klasse
    // (Geisterlegion -> Seelenruf, Phylakterium/Lich-Panzer ->
    // Geisterkommandant, Unsterbliche Seele/Ewige Wiederkehr -> Wiederkehr).
    // Ohne diesen dritten Zug waeren sie unerreichbar: drawAll({}, klass)
    // hat die Voraussetzung nie erfuellt, drawAll(reqTargets) sieht die
    // Klasse nie (kein starterTank) -- beide Bedingungen zusammen braucht
    // genau diese Kombination.
    for (const id of drawAll(reqTargets, klass)) reachable.add(id);
  }
  for (const id in defs) {
    if (defs[id].tag === 'elite') continue; // nur ueber Elite-Belohnung
    if (defs[id].tag === 'weapon' && !WEAPON_FREIGEGEBEN.has(id)) continue;
    check(reachable.has(id), `Karte "${id}" (${defs[id].tag}) ist im normalen Pool nicht ziehbar`);
  }
  // Grundsteinumbau Phase 4: die namentliche Welle-3-Liste (sappeur,
  // steinbruch, minenspuerer, gefahrensinn, abprallschock, doppelschlag) ist
  // mit dem 251-Karten-Pool archiviert (ARCHIV.md, archive/upgrades-v1.json)
  // -- die generische Erreichbarkeitspruefung oben deckt den 5-Karten-Sockel
  // weiterhin ab.
}

// ---- 6c. Die Effekte der Welle-3-Karten wirken tatsaechlich -------------
// "Karte gebaut, aber wirkungslos" war in diesem Projekt die haeufigste
// Fehlerklasse (doppelrohr nie im Pool, pionier mit totem Tag) -- deshalb
// fuer jede mechanische Karte ein direkter Wirkungsnachweis.
{
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

  // Abprallschock und Doppelschlag hingen beide am Bandenschuss (Wandabpraller
  // loeste Betaeubung bzw. Trickshot-Powershot-Nachladung aus) und sind mit
  // Grundsteinumbau Phase 1 wirkungslos -- die Karten bleiben bis Phase 4
  // unangetastet in data/upgrades.json/im Pool ziehbar (6b2 oben), ihre
  // Wirkungsnachweise sind hier archiviert (ARCHIV.md/archive/bandenschuss.md).
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
  // Grundsteinumbau Phase 3: eine fliegende Moerser-Granate im Renderpfad,
  // damit drawMortars() nicht ungetestet bleibt (derselbe blinde Fleck wie
  // beim Ziellinien-Crash).
  st.mortars.push({
    x0: st.player.x, y0: st.player.y, tx: st.player.x + 80, ty: st.player.y,
    age: 0.4, flightTimeS: 1.1, radiusPx: 44, damage: 25, owner: enemy || st.player, exploded: false,
  });
  // G8 (Nachtrag): ein Greifer-Windup + ein Taktgeber-Zustand im Renderpfad,
  // damit drawGrapples()/drawMetronomeRings() nicht ungetestet bleiben
  // (derselbe blinde Fleck wie beim Ziellinien-Crash).
  if (enemy) {
    enemy.cfg = { ...enemy.cfg, grapple: { maxRangePx: 300 }, metronome: { holdWindowS: 1.6 } };
    enemy.grappleState = { mode: 'windup', timer: 0.3, dir: 0 };
    enemy.metronomeState = { elapsed: 0.5, justBeat: true };
  }
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
    // Phase 2 (Nachtrag): war beim Bau der Vorhaltemarkierung vergessen worden.
    ['drawLeadMarkers', effects.drawLeadMarkers, [fakeCtx, st]],
    // Phase 3: Moerser-Telegraph.
    ['drawMortars', effects.drawMortars, [fakeCtx, st]],
    // G8: Greifer-Wurfkorridor + Taktgeber-Ring.
    ['drawGrapples', effects.drawGrapples, [fakeCtx, st]],
    ['drawMetronomeRings', effects.drawMetronomeRings, [fakeCtx, st]],
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
      st.bullets.push(createBullet(p.x, p.y, i, { speed: 100, radius: 3, owner: p, kind: 'bullet' }));
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

  // Konterschild-MECHANISMUS (applyRoomContext): nur in Elite-/Verflucht-/
  // Bossraeumen aktiv. Grundsteinumbau Phase 4: die Karte 'konterschild'
  // selbst ist archiviert (ARCHIV.md, archive/upgrades-v1.json) -- der
  // Mechanismus in cfg.js: applyRoomContext() bleibt aber unangetastet
  // gebaut (jeder Panzer laeuft weiter durch applyRoomContext()), deshalb
  // hier direkt ueber die cfg-Felder geprueft statt ueber die Karte.
  {
    const { resolveCfg, applyRoomContext } = await import('../src/game/cfg.js');
    const mk = (ctx) =>
      applyRoomContext(
        Object.assign(resolveCfg(tanksData, 'player'), { counterShield: true, counterShieldCount: 3, counterShieldEliteOnly: true }),
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
    const b = createBullet(150, 104, 0, { speed: 300, radius: 3, owner: null, kind: 'bullet', tungsten: true });
    for (let i = 0; i < 40 && !b.dead; i++) updateBullet(b, st, 1 / 60);
    check(destroyed === 1, `Wolframkern: Wand nicht eingerissen (${destroyed})`);
    check(!b.dead, 'Wolframkern: Geschoss ist an der Wand verschwunden statt weiterzufliegen');
    check(b.x > 232, `Wolframkern: Geschoss ist nicht hinter der Wand angekommen (x=${b.x.toFixed(0)})`);
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
    st.bullets.push(createBullet(p.x, p.y, i, { speed: 100, radius: 3, owner: p, kind: 'bullet' }));
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
    st.bullets.push(createBullet(enemy.x, enemy.y, 0, { speed: 100, radius: 3, owner: enemy, kind: 'bullet' }));
    st.sounds.length = 0;
    st.blockedShotTimer = 0;
    fireBullet(enemy, st, true);
    check(st.sounds.length === 0, 'P1: auch ein Gegner loest die Feuersperr-Meldung aus');
  }
}

// ---- 7c. Der Gruene feuert zuverlaessig (jetzt: Moerser statt Kugel) -----
// Der Abpraller-Rechner (ai_turrets.js: solveBounce/bounceShot), einziger
// Nutzer t_green, ist mit dem Bandenschuss vollstaendig entfernt
// (Grundsteinumbau Phase 1); t_green feuerte danach uebergangsweise ueber
// die normale Turmlogik gerade Raketen. Grundsteinumbau Phase 3 hat ihn zum
// Moerserschuetzen umgebaut (eigener Abschnitt 48 fuer den Mechanismus
// selbst) -- dieser Test bleibt der reine "feuert ueberhaupt"-Nachweis,
// jetzt gegen den 'mortar_launch'-Sound statt 'shoot_enemy'.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');
  let shots = 0;
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
      stepState(
        st,
        { move: { x: Math.sin(i / 40), y: Math.cos(i / 55) }, aim: { x: st.player.x + 50, y: st.player.y }, fire: false, mine: false, dash: false },
        1 / 60,
      );
      for (const ev of st.sounds.splice(0)) {
        if ((typeof ev === 'string' ? ev : ev.name) === 'mortar_launch') shots++;
      }
      st.player.protect = 1; // Spieler am Leben halten
      for (const t of st.tanks) if (t !== st.player) t.alive = true;
    }
  }
  // Schwelle bewusst niedrig: die normale Turmlogik verlangt ab accuracy 0.3
  // freie Sichtlinie -- der wackelnde Testspieler steht nicht immer frei,
  // und minRangePx blockt zusaetzlich, wenn er zu nah dransteht. Reiner
  // "feuert ueberhaupt"-Nachweis, kein Feuerraten-Budget.
  check(shots > 10, `Grüner feuert kaum (${shots} Granaten in 6 Räumen à 6 s mit je 3 Grünen)`);
  console.log(`Grüner (Mörserschütze): ${shots} Granaten in 6 Räumen à 6 s`);
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

// ---- 8i-2. Controller-Navigation der In-Run-Overlays (Nutzermeldung) ------
// Zwei Beschwerden: (1) im Upgrade-Screen erreichte der Controller nur die
// Schrott-Knoepfe, keine Karte -- die Karten sind klickbare DIVs, keine
// <button>s, und fielen deshalb aus der Fokusliste. (2) Karten/Kartenknoten
// liegen NEBENEINANDER und sollen mit LINKS/RECHTS am Stick anwaehlbar sein,
// nicht nur hoch/runter. Beide zusammen: cards -> [data-navcard], runOverlayNav
// -> bothAxes.
{
  const { createMenuNav } = await import('../src/ui/menunav.js');
  const { createUpgradeScreen } = await import('../src/ui/upgradescreen.js');
  const { installDom } = await import('./domstub.mjs');
  const restore = installDom();
  try {
    const screen = createUpgradeScreen();
    const offers = [
      { name: 'Alpha', description: 'a', rarity: 'common', tag: 'damage', level: 1, maxStacks: 2 },
      { name: 'Beta', description: 'b', rarity: 'rare', tag: 'reload', level: 1, maxStacks: 2 },
      { name: 'Gamma', description: 'c', rarity: 'legendary', tag: 'speed', level: 1, maxStacks: 2 },
    ];
    let picked = -1;
    screen.show({
      getOffers: () => offers,
      getScrap: () => 0,
      costs: { ban: 1, reroll: 2, fourthCard: 3, shieldCharge: 4 },
      showActions: false, // nur die Karten -- kein Schrott-Knopf
      onPick: (i) => (picked = i),
    });

    // Genau die Fokusliste, die main.js: runOverlayNav benutzt.
    const ov = document.getElementById('upgrade');
    const focusables = () =>
      [...ov.querySelectorAll('button, input, [data-navcard="1"]')].filter(
        (el) => !el.classList.contains('hidden') && !el.disabled,
      );
    const list = focusables();
    check(list.length === 3, `Overlay-Nav: Upgrade-Karten nicht in der Fokusliste (${list.length} statt 3)`);

    // Gegenprobe: OHNE bothAxes traversiert die X-Achse die Liste NICHT
    // (bisheriges Verhalten -- nur der Regler reagiert auf X).
    const navY = createMenuNav(focusables);
    navY.update({ menuDir: { x: 1, y: 0 }, menuConfirm: false }, 1 / 60);
    check(
      list[0].classList.contains('menu-focus'),
      'Overlay-Nav (Gegenprobe): X-Achse bewegt ohne bothAxes den Fokus',
    );

    // Mit bothAxes: ein X-Schlag nach rechts wandert auf die naechste Karte...
    const nav = createMenuNav(focusables, { bothAxes: true });
    nav.update({ menuDir: { x: 1, y: 0 }, menuConfirm: false }, 1 / 60);
    check(
      list[1].classList.contains('menu-focus'),
      'Overlay-Nav: LINKS/RECHTS am Stick bewegt den Kartenfokus nicht (bothAxes)',
    );
    // ...und A waehlt die fokussierte Karte aus (Klick auf das DIV).
    nav.update({ menuDir: { x: 0, y: 0 }, menuConfirm: true }, 1 / 60);
    check(picked === 1, `Overlay-Nav: A bestaetigt die fokussierte Karte nicht (picked=${picked})`);
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
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
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
  for (const label of ['Tempo', 'Geschosstempo', 'Magazin', 'Bomben', 'Bombenradius']) {
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
  // Grundsteinumbau Phase 4: der 5-Karten-Sockel hat keine einzige
  // Gadgetkarte mehr (die fuenf Gadgets sind mit dem 251-Karten-Pool
  // archiviert, ARCHIV.md) -- applyUpgradeChoice()s tag==='gadget'-Zweig
  // bleibt trotzdem live gebauter Code (Wiederanschlusspunkt fuer kuenftige
  // Klassenpools), deshalb hier mit einer synthetischen Karte geprueft statt
  // ueber eine reale Poolziehung.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    check(run.equippedGadget === null, 'P4: Run startet bereits mit einem Gadget');
    check(run.state.player.cfg.secondary === 'mine', 'P4: Run startet ohne Bombe');
    const card = { id: 'smoke', name: 'Rauchgranate', tag: 'gadget', tags: [], rarity: 'common', level: 1, maxStacks: 1 };
    run.phase = 'upgrade';
    run.pendingOffers = [card];
    chooseUpgrade(run, 0);
    check(run.equippedGadget === card.id, `P4: Gadgetkarte ruestet nicht aus (${run.equippedGadget})`);
  }

  // (e) Die Bombe ist keine Karte mehr -- sonst waere sie doppelt vergeben.
  check(!upgradesData.upgrades.mine, 'P4: die Minen-Karte ist noch im Pool, obwohl die Bombe fest ist');

  // (f) Jeder Gadget-Eintrag traegt seine Kategorie, sonst greift die
  //     Shop-Filterung ins Leere und boete die Bombe zum Tausch an.
  //     Nekromant-V2 Phase 9: 'necro_active' (ghost_031/089/096) ist eine
  //     DRITTE, bewusst vom Shop-Filter ('gadget') ausgeschlossene Kategorie.
  for (const [id, def] of Object.entries(tanksData.secondaries)) {
    if (id.startsWith('_')) continue;
    check(
      def.category === 'gadget' || def.category === 'secondary' || def.category === 'necro_active',
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
      // heading: 0 + role 'guardian' (bewegt sich nie, s. ai_drives.js) --
      // die Kugel unten landet exakt auf e.x/e.y (toBullet = atan2(0,0) = 0),
      // das muss mit der Wannen-Ausrichtung uebereinstimmen und darf sich
      // nicht durch die Gegner-KI aendern, sonst faellt der Treffer durch
      // Zufall in die Seiten-/Heckzone (Phase 2: armor.js: flankZone) und
      // verfaelscht den gemessenen Wert.
      e.heading = 0;
      e.cfg.role = 'guardian';
      st.bullets.length = 0;
      // Kugel direkt auf den Gegner setzen, Besitzer ist ein Dritter (damit
      // weder Selbst-Immunitaet noch die "erst nach Abpraller scharf"-Regel
      // greift).
      const shooter = st.tanks.find((t) => t !== p && t !== e) || p;
      const b = createBullet(e.x, e.y, 0, {
        speed: 1, radius: 3, owner: shooter, kind: 'bullet', damage: 12,
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
  // Spinnenboss-Auftrag: t_spider (1800 LP, spiderBoss:true) ist ein
  // weiterer Boss ausserhalb der 2-5/10-Treffer-Baender fuer normale
  // Gegner/Elite -- dieselbe Ausnahme wie die drei bestehenden Bosse.
  // Amboss-Auftrag: t_anvil (1050 LP, anvilBoss:true) ebenso.
  const BOSSE = ['t_reactor', 't_mirror', 't_phalanx', 't_spider', 't_anvil'];

  // (a) Trefferzahl je Gegnertyp gegen den Standardpanzer. Genau der Test,
  // den Plan-Phase 28 verlangt ("Weicht sie von der Tabelle in Phase 2 ab
  // -> Fehler"). Bewusst als BAND geprueft, nicht als Einzelwert: die
  // Festlegungstabelle des Plans sagt "Gegnerhaerte 2-5 Treffer, Elite 10,
  // Boss 50" -- das ist die Design-Zusage, nicht die einzelne Zahl.
  {
    // Spielbare Klassen (player:true, Phase 9) sind KEINE Gegner und fallen
    // aus der Gegnerhaerte-Pruefung heraus. ghost_tank (Anhang B, Phase 7)
    // ebenso: kein purchasable Gegner (fehlt in diffData.danger), eigene,
    // von der Gegnerhaerte-Tabelle unabhaengige Basiswerte (60 LP, Anhang B S7).
    for (const [id, t] of Object.entries(T)) {
      if (t.player || BOSSE.includes(id) || id === 'ghost_tank') continue;
      const treffer = Math.ceil(t.maxHp / dmg);
      check(
        treffer >= 2 && treffer <= 5,
        `Phase 2: ${id} braucht ${treffer} Treffer (${t.maxHp} LP), erlaubt sind 2-5`,
      );
    }
    // Elite verdoppelt -> hoechstens 10 Treffer.
    const haertester = Math.max(
      ...Object.entries(T)
        .filter(([id, t]) => !t.player && !BOSSE.includes(id) && id !== 'ghost_tank')
        .map(([, t]) => t.maxHp),
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
        speed: 100, radius: 3, owner: st.player, kind: 'bullet', damage: 10,
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
      ...Object.entries(T)
        .filter(([id, t]) => !t.player && !BOSSE.includes(id) && id !== 'ghost_tank')
        .map(([, t]) => t.maxHp),
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
      speed: 1, radius: 3, owner, kind: 'bullet', damage: dmg ?? owner.cfg.damage,
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
    const nonCombat = new Set(['upgrade', 'map', 'rest', 'bossReward', 'actComplete', 'workshop', 'event']);
    let advanceGuard = 10;
    while (run.phase !== 'preview' && advanceGuard-- > 0) {
      let steps = 0;
      while (!nonCombat.has(run.phase) && run.phase !== 'preview' && steps++ < 900) stepRun(run, CMD0, 1 / 60);
      if (run.phase === 'upgrade') chooseUpgrade(run, 0);
      else if (run.phase === 'map') {
        const c = run.map.byId.get(run.mapCurrentId);
        for (const id of c?.next || []) if (chooseMapNode(run, id)) break;
      } else if (run.phase === 'rest') passRest(run);
      else if (run.phase === 'bossReward') passBossReward(run);
      else if (run.phase === 'actComplete') advanceAct(run);
      else if (run.phase === 'workshop') leaveWorkshop(run);
      else if (run.phase === 'event') chooseEventOption(run, 0);
      else break;
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

// ---- 12. Abprall-Bonus (wallBounceDamageMult) -- archiviert -----------
// Die gesamte Wirkungspruefung des Abprall-Schadensbonus (UMBAUPLAN-LP
// Phase 4) ist mit dem Bandenschuss entfernt (Grundsteinumbau Phase 1) --
// b.wallBounces existiert nicht mehr, kein Geschoss kann noch "gebandet"
// sein. Mechanik + alte Testfaelle sind in ARCHIV.md/archive/bandenschuss.md
// dokumentiert.

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
        // heading: 0 -- die Testkugel landet unten exakt auf ziel.x/y (toBullet
        // = atan2(0,0) = 0), das muss mit der Wannen-Ausrichtung uebereinstimmen,
        // sonst faellt der Treffer durch Zufall in die Seiten-/Heckzone (Phase 2:
        // armor.js: flankZone) und verfaelscht den gemessenen Schadenstyp-Wert.
        heading: 0,
        alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
        cfg: { ...proto.cfg, role: 'guardian', maxHp: 9999, armor: null, requiresRicochet: false },
      };
      st.tanks.push(z);
      ziele.push(z);
    }
    st.bullets.length = 0;
    st.mines.length = 0;
    return { st, ziele };
  };
  const schuss = (st, ziel, typ) => {
    const b = createBullet(ziel.x, ziel.y, 0, {
      speed: 1, radius: 3, owner: st.player, kind: 'bullet',
      damage: st.player.cfg.damage, damageType: typ,
    });
    b.age = 5;
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

  // (f) [archiviert] Der frühere Abprall-Bonus (wallBounceDamageMult,
  // UMBAUPLAN-LP Phase 4) ist mit dem Bandenschuss entfernt
  // (Grundsteinumbau Phase 1, s. Abschnitt 12 oben) -- der Wirkungsnachweis
  // "gebandetes Feuergeschoss verdoppelt nur den Aufschlag" ist damit
  // gegenstandslos, archiviert in ARCHIV.md/archive/bandenschuss.md.

  // (g) Standard ist physisch: ein Geschoss ohne Angabe traegt nichts auf.
  {
    const { st, ziele } = raum(1);
    const b = createBullet(ziele[0].x, ziele[0].y, 0, {
      speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 10,
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
  //     unverwundbar hoch, ohne Panzerung/Schild -- so misst der hp-Abfall
  //     nur den Krit-Faktor (Testschritt 3). Die fruehere zweite Achse
  //     "Krit x Bankschuss" ist mit dem Bandenschuss entfallen
  //     (Grundsteinumbau Phase 1, s. Abschnitt 12).
  const treffer = (opt) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const z = {
      ...proto, x: 200, y: 250, prevX: 200, prevY: 250,
      heading: 0, // s. Abschnitt 14: toBullet ist hier atan2(0,0) = 0
      alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
      cfg: { ...proto.cfg, role: 'guardian', maxHp: 9999, armor: null, requiresRicochet: false },
    };
    st.tanks.push(z);
    const b = createBullet(z.x, z.y, 0, {
      speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 10, crit: opt.crit,
    });
    b.age = 5;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    const vor = z.hp;
    stepState(st, CMD0, 1 / 60);
    return vor - z.hp;
  };
  {
    const grund = 10;
    check(treffer({ crit: false }) === grund, 'Phase 7: Vorbedingung -- Grundtreffer nicht 10');
    check(treffer({ crit: true }) === Math.round(grund * CRIT.mult), 'Phase 7: Krit verdoppelt den Aufschlag nicht');
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
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  // (a)+(b) [archiviert] t_prism (Panzerung/requiresRicochet/
  // bounceDamageTakenMult) und die Bankshot-Schadensvergleiche sind mit dem
  // Bandenschuss vollstaendig entfernt (Grundsteinumbau Phase 1) --
  // t_prism existiert nicht mehr, s. ARCHIV.md/archive/gegner-v1.json.
  // Was bleibt: der Spiegel-Boss behaelt requiresRicochet als reinen
  // Platzhalter-Passthrough (aktuell nicht spielbar erreichbar, s. CLAUDE.md
  // "Bosse (Platzhalter, Nutzerentscheidung)") und bankshotGuarantee ist
  // aus difficulty.json vollstaendig entfernt, nicht nur auf chance:0
  // gesetzt.
  {
    check(!tanksData.types.t_prism, 'Phase 8: t_prism existiert noch (sollte mit Phase 1 entfernt sein)');
    check(
      tanksData.types.t_mirror.requiresRicochet === true,
      'Phase 8: der Spiegel-Boss hat requiresRicochet verloren (Platzhalter-Feld fuer einen Bossneubau)',
    );
    check(!diffData.bankshotGuarantee, 'Phase 8: bankshotGuarantee existiert noch in difficulty.json');
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
      heading: 0, // s. Abschnitt 14: toBullet ist hier atan2(0,0) = 0
      alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
      cfg: { ...proto.cfg, role: 'guardian', maxHp: 9999, armor: null, requiresRicochet: false },
    };
    st.tanks.push(z);
    const b = createBullet(z.x, z.y, 0, {
      speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 10, damageType: 'fire',
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

  // (c) [archiviert] Abprallpanzer-Passiv (+1 Abpraller auf die Basis) --
  // cfg.ricochets ist mit dem Bandenschuss entfernt (Grundsteinumbau
  // Phase 1); c_ricochet ist bis zu ihrem Neubau ohne Identitaet
  // (s. AUFTRAG-GRUNDSTEINUMBAU.md, Festgelegte Entscheidungen).

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
      speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 10, damageType: 'lightning',
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

// ---- 18.-35. UMBAUPLAN-LP Phasen 10-27 (Kernpool, sechs Element-Toepfe,
// Zweitelement, zehn Signaturtoepfe) -- archiviert -----------------------
// Diese 18 Abschnitte pruefte Struktur/Filter/Applier-Arithmetik der 246
// klassen- bzw. elementgebundenen Karten aus dem alten 251-Karten-Pool
// (Kernpool 30, sechs Element-Toepfe je 12, zehn Signaturtoepfe, dazu das
// Zweitelement-System). Mit Grundsteinumbau Phase 4 ist der gesamte Pool
// nach archive/upgrades-v1.json ausgelagert und durch fuenf neutrale
// Sockelkarten ersetzt (data/upgrades.json) -- jede dieser Pruefungen waere
// seitdem strukturell rot, ohne dass etwas kaputt ist (die referenzierten
// Karten-ids existieren nicht mehr). Die zugrundeliegenden ENGINE-
// Mechanismen (weightedPick()-Tier-Normierung, der generische core-Applier
// in cfg.js, Schadenstypen/Statuseffekte) bleiben unangetastet gebaut und
// werden weiterhin von Abschnitt 13-17 (mit synthetischen Werten) sowie den
// Abschnitten 37-39/45 (Upgradepool-v2) bewacht. Details/Wiederanschluss-
// punkt: ARCHIV.md, archive/upgrades-v1.json, archive/systeme-v1.md.


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
    } else if (run.phase === 'rest') {
      // Grundsteinumbau Phase 6: Platzhalter-Durchgangsraum, ein "Weiter".
      passRest(run);
    } else if (run.phase === 'bossReward') {
      passBossReward(run);
    } else if (run.phase === 'actComplete') {
      // Grundsteinumbau Phase 6: Akt-Uebergangsbildschirm nach dem Bosskill.
      advanceAct(run);
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

// ---- 36. UMBAUPLAN-LP Phase 28: Schlussabnahme des LP-Umbaus -------------
// Die dauerhaften Abnahmetests aus Plan-Phase 28. Drei der fuenf verlangten
// Punkte sind schon abgedeckt und bleiben, wo sie sind:
//   - "Zeit bis zum Tod" (Trefferzahl je Gegnertyp): Abschnitt 10a.
//   - "Rechenzeit" (Frame-Budget des Bankshot-Solvers): Abschnitt 7c (heute
//     ~2 ms gegen 6 ms -- die 8,86-ms-Zahl im Plan ist veraltet, s. CLAUDE.md).
//   - "Gezogene Verteilung" (Normierung bei ungleichen Poolgroessen): war in
//     Abschnitt 18b an einer synthetischen Liste geprueft (Abschnitt 18-35
//     archiviert, Grundsteinumbau Phase 4).
// Grundsteinumbau Phase 4: (a) "gezogene Verteilung ueber den echten Pool"
// und (b) "keine leere Seltenheitsstufe" sind archiviert -- der 5-Karten-
// Sockel ist vollstaendig `common`, eine 60/30/10-Verteilung bzw. eine
// ziehbare rare/epic/unique/legendary-Karte gibt es bis zu einem kuenftigen
// Klassenpool nicht mehr (ARCHIV.md). (c) bleibt: die Raumdauer-Schranke
// haengt an Gegner-LP/Spielerschaden, nicht am Kartenpool.
{
  const { isBossCfg } = await import('../src/game/cfg.js');

  // Raumdauer: "Simulierter Raum in Raum 10 darf ein Zeitbudget nicht
  //     ueberschreiten -- der Test, der verhindert, dass Raeume wieder lang
  //     statt schwer werden." Ein bewegungsfaehiger Bot ist hier NICHT belastbar
  //     (er verkantet sich bei freier Mitte-zu-Mitte-Sichtlinie, s. CLAUDE.md
  //     Phase 3). Deshalb eine DETERMINISTISCHE Schranke: die minimale Zeit, um
  //     alle Gegner eines Raums >=10 mit dem STANDARD-Schaden (10) und der
  //     Grund-Feuerrate zu toeten (Trefferzahl x Nachladeschritt). Steigt die
  //     Gegner-LP wieder unkontrolliert, waechst diese Zeit -- genau die
  //     Regression, die der Plan fuerchtet. Einseitige Schranke (faengt
  //     HP-Inflation, nicht KI-Traegheit -- die KI aendert der LP-Umbau nicht).
  {
    const { resolveCfg } = await import('../src/game/cfg.js');
    const DMG = tanksData.types.player.damage; // 10 -- der Standardpanzer
    const CD = resolveCfg(tanksData, 'player').fireCooldown; // Grund-Nachladeschritt (0,25 s)
    const BUDGET = 30; // s -- deterministisch, ~25 % ueber der Messung (Gegenprobe rot)
    let worst = 0;
    let worstInfo = '';
    for (const seed of SEEDS) {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, seed);
      let guard = 200000;
      const seen = new Set();
      while (run.phase !== 'victory' && run.phase !== 'gameover' && guard-- > 0) {
        if (run.phase === 'preview') enterRoom(run);
        else if (run.phase === 'transition') stepRun(run, CMD, STEP);
        else if (run.phase === 'playing') {
          const st = run.state;
          if (!seen.has(run.roomIndex)) {
            seen.add(run.roomIndex);
            const living = st.tanks.filter((t) => t !== st.player && t.alive);
            const boss = living.some((t) => isBossCfg(t.cfg));
            if (run.roomIndex >= 10 && living.length && !boss) {
              let hits = 0;
              for (const t of living) hits += Math.ceil(t.hp / DMG);
              const avg = hits / living.length;
              const pend = st.pendingWave ? st.pendingWave.types.length : 0;
              const total = hits + pend * avg; // zweite Welle: gleiche Rezeptur
              const minClear = total * CD;
              if (minClear > worst) {
                worst = minClear;
                worstInfo = `Seed ${seed}, Raum ${run.roomIndex}: ${living.length} lebende + ${pend} Welle, ${total.toFixed(0)} Treffer`;
              }
            }
          }
          cheatKillAll(st);
          stepRun(run, CMD, STEP);
        } else if (run.phase === 'upgrade') chooseUpgrade(run, 0);
        else if (run.phase === 'map') pickMapNode(run);
        else if (run.phase === 'workshop') leaveWorkshop(run);
        else if (run.phase === 'event') chooseEventOption(run, 0);
        else if (run.phase === 'rest') passRest(run);
        else if (run.phase === 'bossReward') passBossReward(run);
        else if (run.phase === 'actComplete') advanceAct(run);
        else break;
      }
    }
    console.log(`Phase 28 Raumdauer: schlimmster Raum >=10 = ${worst.toFixed(1)} s Mindest-Räumzeit (Budget ${BUDGET} s) -- ${worstInfo}`);
    check(worst > 0, 'Phase 28: kein Kampfraum >=10 gemessen (Test-Setup)');
    check(worst <= BUDGET, `Phase 28: Raum >=10 braucht mindestens ${worst.toFixed(1)} s (Budget ${BUDGET} s) -- ${worstInfo}`);
  }
}

// ---- 37. Upgradepool-v2 Phase 1 + Nekromant-V2 Phase 1: fuenf Stufen -----
// Sprung von drei (common/rare/legendary) auf fuenf Stufen. Nekromant-V2
// Phase 1 benennt die vierte Stufe von 'unique' auf 'uncommon' um (reiner
// Namenstausch, gleiche Gewichte/Reihenfolge) -- 'unique' als Wort gehoert
// jetzt dem GETRENNTEN isUnique-Feld einer Karte (Stapelregel, STARTHIER.md:
// "gilt fuer beide Auftraege"). maxStacks ist ERSATZLOS abgeschafft: eine
// nicht-einzigartige Karte (isUnique: false/fehlt) hat keinerlei Obergrenze
// mehr, eine einzigartige (isUnique: true) ist nach der ersten Wahl weg. Die
// vorherigen Abschnitte (10, 11-16, 18-27, 36) sind mit den 251 archivierten
// Karten archiviert -- diese Sektion prueft die aktuellen Strukturregeln
// gegen den lebenden Pool (data/upgrades.json).
{
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);

  // (a) Struktur: jede Karte hat eine der fuenf gueltigen Stufen, ein
  //     gueltiges isUnique-Feld (Boolean), und KEIN maxStacks-Feld mehr.
  {
    const U = upgradesData.upgrades;
    let badRarity = 0;
    let badIsUnique = 0;
    let hasMaxStacks = 0;
    for (const id in U) {
      const d = U[id];
      if (!VALID_RARITIES.has(d.rarity)) badRarity++;
      if (typeof d.isUnique !== 'boolean') badIsUnique++;
      if (Object.prototype.hasOwnProperty.call(d, 'maxStacks')) hasMaxStacks++;
    }
    check(badRarity === 0, `Phase 1 (Upgradepool-v2/Nekromant-V2): ${badRarity} Karte(n) mit ungueltiger rarity`);
    check(badIsUnique === 0, `Phase 1 (Nekromant-V2): ${badIsUnique} Karte(n) ohne gueltiges isUnique-Feld`);
    check(hasMaxStacks === 0, `Phase 1 (Nekromant-V2): ${hasMaxStacks} Karte(n) tragen noch ein maxStacks-Feld (abgeschafft)`);
  }

  // (b) archiviert -- Kartenbelohnung/Shop-Ueberarbeitung entfernt
  //     balance.rarityGates ERSATZLOS (Seltenheit wird seither nur noch
  //     ueber Wahrscheinlichkeit gestaffelt, nie mehr ueber Erreichbarkeit --
  //     s. CLAUDE.md). Der Nachfolge-Mechanismus (rewardRarityWeights()/
  //     shopRarityWeights()) ist in Abschnitt 64 geprueft.

  // (c) MECHANISMUS der Stapelregel (Nekromant-V2 Phase 1): eine NICHT
  //     einzigartige Karte bleibt nach 1/10/100/1000 Wahlen weiter im Pool
  //     (keine Obergrenze, eigene grosse Zahlen statt der echten Sockel-
  //     Werte); eine einzigartige Karte verschwindet SOFORT nach der ersten
  //     Wahl -- sowohl ueber `chosen` als auch ueber die eigenstaendige
  //     `selectedUniqueUpgradeIds`-Menge (auch wenn `chosen` sie (noch)
  //     nicht kennt -- deckt "bereits vorbereitete Auswahlen" ab).
  {
    const { mulberry32 } = await import('../src/core/rng.js');
    const fakeData = {
      offersPerScreen: 1,
      upgrades: {
        stack_card: {
          id: 'stack_card', name: 'Stapelkarte', description: 'x', tag: 'testtag_stack',
          rarity: 'common', isUnique: false, requires: [], minRoom: 1,
        },
        uniq_card: {
          id: 'uniq_card', name: 'Einzigartige Karte', description: 'x', tag: 'testtag_uniq',
          rarity: 'legendary', isUnique: true, requires: [], minRoom: 1,
        },
      },
    };
    const balance = { rarity: { common: 100, legendary: 100 }, rarityGates: {} };
    // Nur stack_card im Pool -- sonst waere das Ergebnis ein Muenzwurf
    // gegen uniq_card (beide gleich gewichtet, count:1 zieht nur eine Karte).
    const stackOnlyData = { offersPerScreen: 1, upgrades: { stack_card: fakeData.upgrades.stack_card } };
    for (const n of [1, 10, 100, 1000]) {
      const offers = rollOffers(stackOnlyData, {
        chosen: { stack_card: n }, roomIndex: 1, rng: mulberry32(1), balance, count: 1, banned: new Set(),
      });
      check(
        offers.some((o) => o.id === 'stack_card'),
        `Phase 1 (Nekromant-V2): nicht-einzigartige Karte verschwindet aus dem Pool nach ${n} Wahlen (maxStacks haette hier gegriffen)`,
      );
    }
    // ueber `chosen` allein bereits gewaehlt:
    const viaChosen = rollOffers(fakeData, {
      chosen: { uniq_card: 1 }, roomIndex: 1, rng: mulberry32(1), balance, count: 1, banned: new Set(),
    });
    check(
      !viaChosen.some((o) => o.id === 'uniq_card'),
      'Phase 1 (Nekromant-V2): einzigartige Karte erscheint erneut, obwohl chosen sie schon zaehlt',
    );
    // NUR ueber selectedUniqueUpgradeIds bereits gewaehlt (chosen kennt sie
    // noch nicht -- "bereits vorbereitete Auswahlen unmittelbar vor der
    // Anzeige").
    const viaSet = rollOffers(fakeData, {
      chosen: {}, roomIndex: 1, rng: mulberry32(1), balance, count: 1, banned: new Set(),
      selectedUniqueUpgradeIds: new Set(['uniq_card']),
    });
    check(
      !viaSet.some((o) => o.id === 'uniq_card'),
      'Phase 1 (Nekromant-V2): selectedUniqueUpgradeIds filtert eine bereits gewaehlte einzigartige Karte nicht',
    );
  }

  // (d) END-TO-END ueber die echten run.js-Funktionen: eine einzigartige
  //     Testkarte (der aktuelle 5-Karten-Sockel hat keine) landet nach der
  //     Wahl in run.selectedUniqueUpgradeIds, ueberlebt runSnapshot()/
  //     createRun({resume}), und ein AELTERER Zwischenstand ohne das Feld
  //     rekonstruiert es aus run.upgrades + dem aktuellen isUnique-Schema.
  {
    const { createRun, runSnapshot, chooseUpgrade } = await import('../src/game/run.js');
    const testUpgrades = {
      ...upgradesData,
      upgrades: {
        ...upgradesData.upgrades,
        test_uniq_37d: {
          id: 'test_uniq_37d', name: 'Testkrone', description: 'x', tag: 'testtag_37d',
          rarity: 'legendary', isUnique: true, requires: [], minRoom: 1, core: {},
        },
      },
    };
    const run = createRun(tanksData, tilesData, diffData, testUpgrades, 777);
    run.phase = 'upgrade';
    run.pendingOffers = [{
      id: 'test_uniq_37d', name: 'Testkrone', description: 'x', tag: 'testtag_37d',
      tags: [], rarity: 'legendary', level: 1, isUnique: true,
    }];
    chooseUpgrade(run, 0);
    check(
      run.selectedUniqueUpgradeIds.has('test_uniq_37d'),
      'Phase 1 (Nekromant-V2): applyUpgradeChoice() traegt eine gewaehlte einzigartige Karte nicht in selectedUniqueUpgradeIds ein',
    );
    const snap = runSnapshot(run);
    check(
      Array.isArray(snap.selectedUniqueUpgradeIds) && snap.selectedUniqueUpgradeIds.includes('test_uniq_37d'),
      'Phase 1 (Nekromant-V2): runSnapshot() nimmt selectedUniqueUpgradeIds nicht mit',
    );
    const resumed = createRun(tanksData, tilesData, diffData, testUpgrades, run.seed, run.modeKey, { resume: snap });
    check(
      resumed.selectedUniqueUpgradeIds.has('test_uniq_37d'),
      'Phase 1 (Nekromant-V2): selectedUniqueUpgradeIds geht beim Fortsetzen verloren',
    );
    const legacySnap = { ...snap };
    delete legacySnap.selectedUniqueUpgradeIds; // aelterer Zwischenstand vor dieser Phase
    const legacyResumed = createRun(tanksData, tilesData, diffData, testUpgrades, run.seed, run.modeKey, { resume: legacySnap });
    check(
      legacyResumed.selectedUniqueUpgradeIds.has('test_uniq_37d'),
      'Phase 1 (Nekromant-V2): aeltere Zwischenstaende ohne selectedUniqueUpgradeIds rekonstruieren die Menge nicht aus run.upgrades + isUnique',
    );
  }
}

// ---- 38. Upgradepool-v2 Phase 2: Kategorie + Synergie-Tags ---------------
// `tag` bleibt die Hauptkategorie (transformations.json/run.tagCounts haengen
// unveraendert daran). Neu: optionales `tags: []` fuer Synergiegewichtung
// (Phase 3) UND der Blocker-Fix aus Phase 0 -- Signaturkarten duerfen sich
// im selben Angebot nicht mehr gegenseitig ueber den gemeinsamen Tag
// 'signature' blockieren.
{
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');
  const U = upgradesData.upgrades;

  // (a) Struktur: eindeutige ids (Objektschluessel === def.id), gueltige
  //     Kategorie (Tag aus einer FEST definierten, von den Daten unabhaengigen
  //     Liste -- sonst waere der Test bei jedem neuen Tag automatisch gruen
  //     und faengt nie einen Tippfehler), tags[] (falls gesetzt) ist ein Array
  //     aus Strings, signatureClass (falls gesetzt) zeigt auf eine echte
  //     player-Klasse in tanks.json.
  {
    const KNOWN_TAGS = new Set([
      'stat', 'mobility', 'terrain', 'reactive', 'control', 'weapon', 'scaling',
      'information', 'resource', 'synergy', 'defense', 'elite', 'gadget',
      'damage', 'reload', 'speed', 'health', 'magazine', 'ricochet', 'crit',
      'scavenge', 'mines', 'dodge', 'physical', 'explosive', 'fire', 'frost',
      'poison', 'lightning', 'signature',
    ]);
    const playerClasses = new Set(
      Object.entries(tanksData.types).filter(([, t]) => t.player).map(([id]) => id),
    );
    let badId = 0;
    let badTag = 0;
    let badTags = 0;
    let badSigClass = 0;
    for (const key in U) {
      const d = U[key];
      if (d.id !== key) badId++;
      if (!KNOWN_TAGS.has(d.tag)) badTag++;
      if (d.tags !== undefined && (!Array.isArray(d.tags) || d.tags.some((t) => typeof t !== 'string'))) badTags++;
      if (d.signatureClass && !playerClasses.has(d.signatureClass)) badSigClass++;
    }
    check(badId === 0, `Phase 2 (Upgradepool-v2): ${badId} Karte(n), deren id vom Objektschluessel abweicht`);
    check(badTag === 0, `Phase 2 (Upgradepool-v2): ${badTag} Karte(n) mit unbekannter Kategorie (tag)`);
    check(badTags === 0, `Phase 2 (Upgradepool-v2): ${badTags} Karte(n) mit ungueltigem tags[]-Feld`);
    check(badSigClass === 0, `Phase 2 (Upgradepool-v2): ${badSigClass} Karte(n), deren signatureClass keine echte Klasse ist`);
  }

  // (b) requires-Graph ist zyklenfrei (DFS mit Besucht-/Im-Stapel-Markierung).
  //     Ein Zyklus (A requires B, B requires A) waere fuer BEIDE Karten fuer
  //     immer unerreichbar, weil chosen[x] nie > 0 wird.
  {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = {};
    let cyclic = null;
    const visit = (id) => {
      if (cyclic || !U[id]) return;
      color[id] = GRAY;
      for (const r of U[id].requires || []) {
        if (color[r] === GRAY) { cyclic = `${id} -> ${r}`; return; }
        if (!color[r]) visit(r);
        if (cyclic) return;
      }
      color[id] = BLACK;
    };
    for (const id in U) {
      if (!color[id]) visit(id);
      if (cyclic) break;
    }
    check(cyclic === null, `Phase 2 (Upgradepool-v2): Zyklus im requires-Graphen (${cyclic})`);
  }

  // (c) MECHANISMUS des Blocker-Fixes: mit einem SYNTHETISCHEN Drei-Karten-Pool
  //     (nicht dem echten sig_necro-Bestand, der sich mit Phase 8 ohnehin
  //     aendert) -- drei Signaturkarten DERSELBEN Klasse, alle mit
  //     tag:'signature', muessen gemeinsam in einem Angebot erscheinen
  //     koennen (Anhang A Paragraph 19). ignoreTagRule bleibt aus, damit die
  //     Tag-Regel wirklich getestet wird, nicht nur umgangen.
  {
    const fakeSig = (id) => ({
      id, name: id, description: 'x', tag: 'signature', signatureClass: 'c_necro',
      rarity: 'common', maxStacks: 1, requires: [], minRoom: 1,
    });
    const fakeData = {
      offersPerScreen: 3,
      fallback: { name: '+1 Leben', description: 'x', tag: 'stat', rarity: 'common' },
      upgrades: { sig_a: fakeSig('sig_a'), sig_b: fakeSig('sig_b'), sig_c: fakeSig('sig_c') },
    };
    const balance = { rarity: { common: 100 } };
    const offers = rollOffers(fakeData, {
      chosen: {}, roomIndex: 1, rng: mulberry32(7), balance, count: 3, banned: new Set(),
      starterTank: 'c_necro',
    });
    const ids = offers.map((o) => o.id).sort();
    check(
      JSON.stringify(ids) === JSON.stringify(['sig_a', 'sig_b', 'sig_c']),
      `Phase 2 (Upgradepool-v2): drei Signaturkarten derselben Klasse landen nicht gemeinsam im Angebot (${JSON.stringify(ids)})`,
    );
  }

  // (d) Gegenstueck: der Kernpool behaelt die alte Regel -- zwei Karten mit
  //     demselben Tag OHNE signatureClass duerfen weiterhin nicht gemeinsam
  //     im selben Angebot erscheinen.
  {
    const fakeCore = (id) => ({
      id, name: id, description: 'x', tag: 'damage', rarity: 'common', maxStacks: 1,
      requires: [], minRoom: 1,
    });
    const fakeData = {
      offersPerScreen: 2,
      fallback: { name: '+1 Leben', description: 'x', tag: 'stat', rarity: 'common' },
      upgrades: { core_a: fakeCore('core_a'), core_b: fakeCore('core_b') },
    };
    const balance = { rarity: { common: 100 } };
    const offers = rollOffers(fakeData, {
      chosen: {}, roomIndex: 1, rng: mulberry32(7), balance, count: 2, banned: new Set(),
    });
    const real = offers.filter((o) => !o.fallback);
    check(
      real.length === 1,
      `Phase 2 (Upgradepool-v2): zwei Kernpool-Karten mit demselben Tag landen faelschlich gemeinsam im Angebot (${real.length} statt 1)`,
    );
  }
}

// ---- 39. Upgradepool-v2 Phase 3: Synergiegewichtung ----------------------
// weightedPick() gewichtet Karten mit passenden tags[] hoeher, wenn der
// Spieler bereits Karten mit demselben Synergie-Tag gewaehlt hat (Anhang A
// Paragraph 11). Alle Tests hier arbeiten mit SYNTHETISCHEN Kandidaten und
// einer synthetischen Tag-Bilanz -- nicht dem echten Kartenbestand -- damit
// sie den Mechanismus pruefen, nicht die aktuelle Datenlage.
{
  const { weightedPick, rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32 } = await import('../src/core/rng.js');

  // (a) MECHANISMUS: eine Karte mit passendem tags[] wird bei gleicher
  //     Seltenheit deutlich haeufiger gezogen als eine sonst identische Karte
  //     ohne Synergie-Treffer. 4 vorherige Treffer x step 0.5 = +200 % ->
  //     an cap 2.0 gedeckelt -> Gewichtsverhaeltnis 2:1 (66,7 %/33,3 %).
  {
    const list = [
      { id: 'a', rarity: 'common', tags: ['swarm'] },
      { id: 'b', rarity: 'common', tags: [] },
    ];
    const opts = { synergyTags: { swarm: 4 }, balance: { upgrades: { synergyCap: 2.0, synergyStep: 0.5 } } };
    const synergyWeightFor = (d) => {
      // Re-implementiert die private makeSynergyWeight()-Formel als Kontrolle,
      // NICHT importiert -- sonst wuerde der Test nur sich selbst pruefen.
      const cap = opts.balance.upgrades.synergyCap;
      const step = opts.balance.upgrades.synergyStep;
      const matches = (d.tags || []).reduce((s, t) => s + (opts.synergyTags[t] || 0), 0);
      return matches > 0 ? Math.min(cap, 1 + matches * step) : 1;
    };
    check(
      Math.abs(synergyWeightFor(list[0]) - 2.0) < 1e-9,
      `Phase 3 (Upgradepool-v2): Kontrollformel liefert ${synergyWeightFor(list[0])} statt 2.0 (Testaufbau falsch)`,
    );
    // rollOffers mit count:1 zieht ueber makeCombinedWeight() -- misst also
    // die ECHTE Implementierung, nicht die Kontrollformel.
    const fakeData = {
      offersPerScreen: 1,
      fallback: { name: '+1 Leben', description: 'x', tag: 'stat', rarity: 'common' },
      upgrades: {
        a: { id: 'a', name: 'a', description: 'x', tag: 'swarm', tags: ['swarm'], rarity: 'common', maxStacks: 99, requires: [], minRoom: 1 },
        b: { id: 'b', name: 'b', description: 'x', tag: 'other', tags: [], rarity: 'common', maxStacks: 99, requires: [], minRoom: 1 },
      },
    };
    const balance = { rarity: { common: 100 }, upgrades: { synergyCap: 2.0, synergyStep: 0.5 } };
    const rng = mulberry32(4242);
    let countA = 0;
    let countB = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const offers = rollOffers(fakeData, {
        chosen: {}, roomIndex: 1, rng, balance, count: 1, banned: new Set(),
        synergyTags: { swarm: 4 },
      });
      if (offers[0].id === 'a') countA++;
      else if (offers[0].id === 'b') countB++;
    }
    const pctA = (100 * countA) / N;
    check(
      Math.abs(pctA - 66.7) < 4,
      `Phase 3 (Upgradepool-v2): Synergiekarte ${pctA.toFixed(1)} % statt ~66,7 % der Ziehungen (Gewichtung wirkt nicht)`,
    );
    // (b) Keine Karte wird ausgeschlossen: die nicht passende Karte muss
    //     trotzdem regelmaessig auftauchen (nicht 0).
    check(countB > 0, 'Phase 3 (Upgradepool-v2): Karte ohne Synergie-Treffer taucht NIE auf (faelschlich ausgeschlossen)');
  }

  // (c) Kappung: ein extrem hoher Treffer-Wert darf den Faktor nicht ueber
  //     den konfigurierten cap hinaus treiben (sonst koennte eine Karte eine
  //     andere praktisch verdraengen -- widerspricht "schliesst nie aus").
  //     End-to-end ueber die ECHTE rollOffers()-Pipeline (nicht nur eine
  //     isolierte Formel, die sich nur selbst bestaetigen wuerde): 1000
  //     Treffer ergeben ohne Kappung 1 + 1000*0.5 = 501 statt 2.0 -- das
  //     Verhaeltnis muesste dann bei ~99,8 %/0,2 % statt ~66,7 %/33,3 % liegen.
  {
    const fakeData = {
      offersPerScreen: 1,
      fallback: { name: '+1 Leben', description: 'x', tag: 'stat', rarity: 'common' },
      upgrades: {
        a: { id: 'a', name: 'a', description: 'x', tag: 'swarm', tags: ['swarm'], rarity: 'common', maxStacks: 99, requires: [], minRoom: 1 },
        b: { id: 'b', name: 'b', description: 'x', tag: 'other', tags: [], rarity: 'common', maxStacks: 99, requires: [], minRoom: 1 },
      },
    };
    const balance = { rarity: { common: 100 }, upgrades: { synergyCap: 2.0, synergyStep: 0.5 } };
    const rng = mulberry32(4343);
    let countA = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const offers = rollOffers(fakeData, {
        chosen: {}, roomIndex: 1, rng, balance, count: 1, banned: new Set(),
        synergyTags: { swarm: 1000 }, // weit ueber dem Punkt, an dem der cap greift
      });
      if (offers[0].id === 'a') countA++;
    }
    const pctA = (100 * countA) / N;
    check(
      Math.abs(pctA - 66.7) < 4,
      `Phase 3 (Upgradepool-v2): mit 1000 Treffern ${pctA.toFixed(1)} % statt ~66,7 % -- der cap greift nicht`,
    );
  }

  // (d) Tier-Normierung bleibt erhalten (Fix aus UMBAUPLAN-LP Phase 10 darf
  //     nicht wieder kaputtgehen): die Synergie darf nur INNERHALB einer
  //     Seltenheitsstufe umverteilen, NICHT die Gesamtwahrscheinlichkeit einer
  //     Stufe veraendern. Eine stark synergiebevorzugte common-Karte darf die
  //     rare-Quote nicht anheben.
  {
    const list = [
      { id: 'c1', rarity: 'common', tags: ['x'] }, // starker Synergie-Treffer
      { id: 'c2', rarity: 'common', tags: [] },
      { id: 'r1', rarity: 'rare', tags: [] },
    ];
    const weights = { common: 60, rare: 30 };
    const opts = { synergyTags: { x: 10 }, balance: { upgrades: { synergyCap: 2.0, synergyStep: 0.5 } } };
    const synergyWeightFor = (d) => {
      const matches = (d.tags || []).reduce((s, t) => s + (opts.synergyTags[t] || 0), 0);
      return matches > 0 ? Math.min(opts.balance.upgrades.synergyCap, 1 + matches * opts.balance.upgrades.synergyStep) : 1;
    };
    const rng = mulberry32(99);
    const zieh = { common: 0, rare: 0 };
    const N = 30000;
    for (let i = 0; i < N; i++) {
      const pick = weightedPick(list, rng, weights, synergyWeightFor);
      zieh[pick.rarity]++;
    }
    const pctCommon = (100 * zieh.common) / N;
    check(
      Math.abs(pctCommon - 66.7) < 3,
      `Phase 3 (Upgradepool-v2): common-Quote ${pctCommon.toFixed(1)} % statt ~66,7 % -- Synergie verzerrt die Seltenheitsverteilung`,
    );
  }

  // (e) Determinismus: die Synergiegewichtung verbraucht KEINEN zusaetzlichen
  //     rng()-Aufruf -- weiterhin genau einer je gezogener Karte.
  {
    let calls = 0;
    const baseRng = mulberry32(7);
    const countingRng = () => { calls++; return baseRng(); };
    const fakeData = {
      offersPerScreen: 3,
      fallback: { name: '+1 Leben', description: 'x', tag: 'stat', rarity: 'common' },
      upgrades: {
        a: { id: 'a', name: 'a', description: 'x', tag: 'ta', tags: ['x'], rarity: 'common', maxStacks: 99, requires: [], minRoom: 1 },
        b: { id: 'b', name: 'b', description: 'x', tag: 'tb', tags: [], rarity: 'common', maxStacks: 99, requires: [], minRoom: 1 },
        c: { id: 'c', name: 'c', description: 'x', tag: 'tc', tags: [], rarity: 'common', maxStacks: 99, requires: [], minRoom: 1 },
      },
    };
    const balance = { rarity: { common: 100 }, upgrades: { synergyCap: 2.0, synergyStep: 0.5 } };
    rollOffers(fakeData, {
      chosen: {}, roomIndex: 1, rng: countingRng, balance, count: 3, banned: new Set(),
      synergyTags: { x: 3 },
    });
    check(calls === 3, `Phase 3 (Upgradepool-v2): ${calls} rng()-Aufrufe statt 3 fuer 3 gezogene Karten`);
  }

  // Treibt einen Run bis zur naechsten 'upgrade'-Phase (oder Run-Ende) --
  // dasselbe Zustandsmuster wie die SEEDS-Sieg-Schleife oben, nur generisch
  // wiederverwendbar. Gibt true zurueck, wenn 'upgrade' erreicht wurde.
  function advanceToUpgrade(run) {
    let guard = 20000;
    while (guard-- > 0) {
      if (run.phase === 'upgrade') return true;
      if (run.phase === 'victory' || run.phase === 'gameover') return false;
      if (run.phase === 'preview') enterRoom(run);
      else if (run.phase === 'transition' || run.phase === 'playing') {
        if (run.phase === 'playing') cheatKillAll(run.state);
        stepRun(run, CMD, STEP);
      } else if (run.phase === 'map') pickMapNode(run);
      else if (run.phase === 'workshop') leaveWorkshop(run);
      else if (run.phase === 'event') chooseEventOption(run, 0);
      else if (run.phase === 'rest') passRest(run);
      else if (run.phase === 'bossReward') passBossReward(run);
      else if (run.phase === 'actComplete') advanceAct(run);
      else return false;
    }
    return false;
  }

  // (f) Snapshot/Fortsetzen: run.synergyTags bleibt beim Fortsetzen erhalten.
  {
    const { createRun, runSnapshot } = await import('../src/game/run.js');
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 555);
    check(advanceToUpgrade(run), 'Phase 3 (Upgradepool-v2): Testaufbau -- Raum 1 erreicht keine Upgrade-Phase');
    const before = { ...run.pendingOffers[0] };
    chooseUpgrade(run, 0);
    check(
      Object.keys(run.synergyTags).length > 0 || !(before.tags && before.tags.length),
      'Phase 3 (Upgradepool-v2): run.synergyTags wird nach einer Kartenwahl mit tags[] nicht befuellt',
    );
    const snap = runSnapshot(run);
    check(
      JSON.stringify(snap.synergyTags) === JSON.stringify(run.synergyTags),
      'Phase 3 (Upgradepool-v2): runSnapshot() nimmt synergyTags nicht mit',
    );
    const run2 = createRun(tanksData, tilesData, diffData, upgradesData, 555, 'normal', { resume: snap });
    check(
      JSON.stringify(run2.synergyTags) === JSON.stringify(run.synergyTags),
      'Phase 3 (Upgradepool-v2): synergyTags geht beim Fortsetzen verloren',
    );
  }

  // (g) Determinismus ueber einen ganzen Run: gleicher Seed + gleiche Wahl
  //     -> identische Angebotsfolge. Ergaenzt die bestehende Seed-Determinismus-
  //     Probe (Abschnitt 35) um den neuen Gewichtungspfad. Klasse c_necro
  //     (nicht die Default-Klasse player), damit tatsaechlich tags[]-tragende
  //     Karten (aktuell nur sig_necro_*) im Pool erreichbar sind. Die
  //     Wahlfunktion greift bewusst gezielt zur ersten tags[]-tragenden Karte
  //     im Angebot (sonst Index 0) -- deterministisch aus dem Angebotsinhalt
  //     selbst abgeleitet, aber so gebaut, dass die Synergie-Bilanz moeglichst
  //     frueh gefuellt wird und der Gewichtungspfad ueberhaupt durchlaufen wird
  //     (bei reinem "immer Karte 0" bliebe run.synergyTags in 10 Raeumen zu oft leer).
  {
    const { createRun } = await import('../src/game/run.js');
    const play = (seed) => {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, seed, 'normal', { starterTank: 'c_necro' });
      const log = [];
      for (let i = 0; i < 16; i++) {
        if (!advanceToUpgrade(run)) break;
        log.push(run.pendingOffers.map((o) => o.id).join(','));
        const sigIdx = run.pendingOffers.findIndex((o) => o.tags && o.tags.length);
        chooseUpgrade(run, sigIdx >= 0 ? sigIdx : 0);
      }
      return log.join('|');
    };
    const a = play(4);
    const b = play(4);
    check(a.length > 0, 'Phase 3 (Upgradepool-v2): Testaufbau -- keine einzige Upgrade-Phase erreicht');
    check(a === b, 'Phase 3 (Upgradepool-v2): gleicher Seed ergibt nicht denselben Angebotsverlauf');
  }
}

// ---- 40. Upgradepool-v2 Phase 4: altes Geistersystem + reviveChance abgebaut
// Vor dem Nekromant-Neubau (Phase 6/7 dieses Auftrags) muessen alle Reste des
// alten Systems weg sein -- reine Struktur- und Verhaltensnachweise, keine
// neue Spielmechanik.
{
  const { createRun, stepRun: sr, chooseUpgrade: cu, enterRoom: er, leaveWorkshop: lw, chooseEventOption: ceo, advanceAct: aa } = await import('../src/game/run.js');
  const U = upgradesData.upgrades;

  // (a) Struktur: die Karte ghost_crew existiert nicht mehr; kein Kern-
  //     Effektschluessel reviveChanceBonus/grantGhostCrew/ghostDurationBonus
  //     kommt noch in irgendeiner Karte vor; tryRevive() existiert nicht mehr
  //     auf state.
  {
    check(!U.ghost_crew, 'Phase 4 (Upgradepool-v2): Karte ghost_crew existiert noch');
    const tote = Object.entries(U).filter(
      ([, d]) => d.core && (d.core.reviveChanceBonus || d.core.grantGhostCrew || d.core.ghostDurationBonus),
    );
    check(tote.length === 0, `Phase 4 (Upgradepool-v2): ${tote.length} Karte(n) referenzieren noch abgebaute Effektschluessel (${tote.map(([id]) => id).join(', ')})`);
    const runS = createRun(tanksData, tilesData, diffData, upgradesData, 1, 'normal', { starterTank: 'c_necro' });
    check(typeof runS.state.tryRevive !== 'function', 'Phase 4 (Upgradepool-v2): state.tryRevive() existiert noch');
    check(runS.state.player.cfg.reviveChance === undefined, 'Phase 4 (Upgradepool-v2): cfg.reviveChance wird noch gesetzt');
  }

  // (b) Verhalten: ein toedlicher Treffer auf den Nekromanten toetet ihn
  //     IMMER (kein Ueberleben mehr), auch bei einem RNG-Wurf, der frueher
  //     das alte 25%-Passiv bestanden haette (rng() === 0).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1, 'normal', { starterTank: 'c_necro' });
    const st = run.state;
    const p = st.player;
    p.hp = 10;
    p.protect = 0;
    p.shieldReady = false;
    st.shieldCharges.length = 0;
    st.rng = () => 0; // waere unter dem alten 25%-Passiv IMMER eine Wiederbelebung gewesen
    st.applyDamage(p, 50, 'test', {});
    check(!p.alive, 'Phase 4 (Upgradepool-v2): Nekromant ueberlebt einen toedlichen Treffer noch immer');
  }

  // (c) Verhalten: ein kompletter Nekromant-Run erzeugt NIE einen Geist mehr
  //     (state.ghosts bleibt durchgehend leer), auch wenn viele Gegner
  //     sterben -- ersetzt den Cheat-Kill-Bot-Lauf als Absturz-/Crash-Probe
  //     (Testschritt 5: "kompletten Run bis zum Boss spielen").
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 2, 'normal', { starterTank: 'c_necro' });
    let guard = 200000;
    let ghostsEverSeen = 0;
    while (run.phase !== 'victory' && run.phase !== 'gameover' && guard-- > 0) {
      if (run.state && run.state.ghosts.length > 0) ghostsEverSeen = Math.max(ghostsEverSeen, run.state.ghosts.length);
      if (run.phase === 'preview') er(run);
      else if (run.phase === 'transition') sr(run, CMD, STEP);
      else if (run.phase === 'playing') {
        cheatKillAll(run.state);
        sr(run, CMD, STEP);
      } else if (run.phase === 'upgrade') cu(run, 0);
      else if (run.phase === 'map') pickMapNode(run);
      else if (run.phase === 'workshop') lw(run);
      else if (run.phase === 'event') ceo(run, 0);
      else if (run.phase === 'rest') passRest(run);
      else if (run.phase === 'bossReward') passBossReward(run);
      else if (run.phase === 'actComplete') aa(run);
      else break;
    }
    check(guard > 0, 'Phase 4 (Upgradepool-v2): Nekromant-Run haengt (Iterationslimit)');
    check(run.phase === 'victory', `Phase 4 (Upgradepool-v2): Nekromant-Run crasht/haengt in Phase "${run.phase}" statt zu gewinnen`);
    check(ghostsEverSeen === 0, `Phase 4 (Upgradepool-v2): ${ghostsEverSeen} Geist(er) trotz abgebautem Spawn-Mechanismus gesehen`);
  }
}

// ---- 41. Upgradepool-v2 Phase 5: Zielsystem der Gegner-KI ----------------
// Gegner werten jetzt periodisch aus, WEN sie angreifen (Spieler oder ein
// Geist) statt hart auf state.player zu zielen -- Bewertung ueber eine
// EFFEKTIVE DISTANZ (ai.js: resolveTarget/pickTarget/updateTargeting).
// Frame-Budget des Abpraller-Solvers (der jetzt ueber resolveTarget rechnet)
// bleibt unter Abschnitt 7c mitbewacht -- kein zweiter Budget-Test noetig.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { updateTargeting, resolveTarget, registerThreat, angleDiff, updateEnemy } = await import(
    '../src/game/ai.js'
  );
  const { stepMirrorBoss, stepPhalanxBoss } = await import('../src/game/bossai.js');
  const { createGhost, updateGhosts, pushGhost } = await import('../src/game/ghost.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');

  // Isolierter, deterministischer Raum: EIN Gegner in einer garantiert
  // wandfreien Zeile des Test-Layouts (data/arenas.json: test_arena, Zeile 1
  // ist durchgehend Boden) -- damit haengt keine Sichtlinien-Pruefung vom
  // zufaelligen Seed-Layout ab (Muster: Phase-5-Statuseffekt-"isoliert()").
  const raum = (type) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: [type],
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
      roomSpec: { fixedLayout: 'test_arena' },
      arenas: tanksData.arenas,
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    const e = st.tanks.find((t) => t !== st.player);
    e.x = 300; e.y = 48; e.prevX = 300; e.prevY = 48;
    st.player.x = 600; st.player.y = 48; st.player.prevX = 600; st.player.prevY = 48;
    st.player.protect = 999; // bleibt unverwundbar, egal was e in den Tests feuert
    return { st, e };
  };
  // Panzerkompatibler Geist ueber die echte createGhost()-Fabrik (Phase 5) --
  // NIE ein handgestricktes Objekt: updateGhosts() laeuft in jedem stepState-
  // Tick und wuerde an einem unvollstaendigen cfg (fehlendes speed/weapon/...)
  // mit NaN korrumpieren, ohne zu werfen.
  // Upgradepool-v2 Phase 7: createGhost(state, x, y) baut jetzt den festen
  // Basistyp -- der erste Parameter braucht keine cfg mehr, nur noch das
  // Raum-state fuer resolveGhostCfg(). makeGhost() bleibt als duenner
  // Wrapper, damit die bestehenden Aufrufstellen unten unveraendert lesbar
  // bleiben (erstes Argument war/ist immer das aktuelle st).
  const makeGhost = (st, x, y) => createGhost(st, x, y);

  // Eigene Zahlen statt der aktuellen balance.json-Werte (CLAUDE.md-Pflicht:
  // "den Mechanismus mit eigenen Zahlen pruefen, nicht die aktuelle
  // Datenlage") -- sonst waeren diese Tests bei der naechsten Balance-
  // Anpassung entweder grundlos rot oder faelschlich weiter gruen.
  const origAggro = tanksData.balance.aggro;
  const testAggro = {
    reevaluateHz: 4,
    ghostThreatMult: 0.5,
    damageThreatPx: 250,
    damageThreatDecayS: 2,
    switchHysteresisPct: 0.3,
    noTargetFallbackS: 1,
  };
  tanksData.balance.aggro = testAggro;
  try {
    // (a) Ohne Geister ist das Ziel immer der Spieler.
    {
      const { st, e } = raum('t_pink');
      updateTargeting(st, 10);
      check(resolveTarget(e, st) === st.player, 'Phase 5 (Zielsystem): ohne Geister wird nicht der Spieler gewaehlt');
    }

    // (b) Ein Geist deutlich naeher als der Spieler wird zum Ziel.
    {
      const { st, e } = raum('t_pink');
      const g = makeGhost(st, e.x + 30, e.y); // 30px, Spieler 300px entfernt
      st.ghosts.push(g);
      updateTargeting(st, 10);
      check(resolveTarget(e, st) === g, 'Phase 5 (Zielsystem): ein naher Geist wird nicht anvisiert');
    }

    // (c) ghostThreatMult: der Geist ist real NAEHER als der Spieler, aber
    // die kuenstlich vergroesserte effektive Distanz laesst trotzdem den
    // Spieler gewinnen. Bewusst KEINE exakt gleiche Distanz (das waere bei
    // einem exakten Gleichstand ueber die Einfuege-Reihenfolge + "echt
    // kleiner als" zufaellig auch OHNE Mult gruen -- per Gegenprobe
    // bestaetigt, ohne den Mult bleibt es sonst unbemerkt trivial wahr).
    {
      const { st, e } = raum('t_pink');
      const d = Math.hypot(st.player.x - e.x, st.player.y - e.y); // 300
      const g = makeGhost(st, e.x + d - 50, e.y); // real 250 < 300, effektiv 500 > 300
      st.ghosts.push(g);
      updateTargeting(st, 10);
      check(
        resolveTarget(e, st) === st.player,
        'Phase 5 (Zielsystem): ghostThreatMult wirkt nicht (real naeherer Geist gewinnt trotzdem)',
      );
    }

    // (d) Hysterese: ein neues Ziel muss deutlich guenstiger sein, sonst
    // bleibt der Gegner beim alten (verhindert Zappeln zwischen fast gleich
    // attraktiven Kandidaten).
    {
      const { st, e } = raum('t_pink');
      const gClose = makeGhost(st, e.x + 90, e.y); // effektiv 180
      st.ghosts.push(gClose);
      updateTargeting(st, 10);
      check(resolveTarget(e, st) === gClose, 'Phase 5 (Zielsystem): Vorbedingung Hysterese-Test (Geist nicht gewaehlt)');

      // 10% naeher (effektiv 164) -- unter der 30%-Schwelle, darf NICHT
      // uebernehmen.
      const gSlightlyCloser = makeGhost(st, e.x + 82, e.y);
      st.ghosts.push(gSlightlyCloser);
      e.ai.targetTimer = 0; // erzwingt sofortige Neubewertung
      updateTargeting(st, 1);
      check(
        resolveTarget(e, st) === gClose,
        'Phase 5 (Zielsystem): Hysterese verhindert Zappeln nicht (knapper Vorteil wechselt trotzdem)',
      );

      // Deutlich guenstiger (effektiv 10) -- setzt sich trotz Hysterese durch.
      const gMuchCloser = makeGhost(st, e.x + 5, e.y);
      st.ghosts.push(gMuchCloser);
      e.ai.targetTimer = 0;
      updateTargeting(st, 1);
      check(
        resolveTarget(e, st) === gMuchCloser,
        'Phase 5 (Zielsystem): ein deutlich besseres Ziel setzt sich trotz Hysterese nicht durch',
      );
    }

    // (e) Schadens-Bedrohung zieht das Ziel an und klingt linear ab.
    {
      const { st, e } = raum('t_pink');
      const g = makeGhost(st, e.x + 200, e.y); // real naeher als der Spieler, aber
      st.ghosts.push(g); // effektiv (200/0.5=400) weiter als dessen 300
      updateTargeting(st, 10);
      check(
        resolveTarget(e, st) === st.player,
        'Phase 5 (Zielsystem): Vorbedingung Bedrohungstest (Geist wird schon ohne Bedrohung gewaehlt)',
      );

      // ai.target vor dem Wurf zuruecksetzen: sonst schuetzt die Hysterese
      // (Vorbedingung hat gerade erst den Spieler als "aktuelles" Ziel
      // gesetzt) den Spieler zusaetzlich, und dieser Test misst dann die
      // Hysterese statt der Bedrohung.
      e.ai.target = null;
      registerThreat(e, g, st); // der Geist hat gerade zugeschlagen (voller Timer)
      e.ai.targetTimer = 0;
      updateTargeting(st, 1);
      check(resolveTarget(e, st) === g, 'Phase 5 (Zielsystem): frischer Schaden zieht das Ziel nicht an');

      // Abklingen: eine vollstaendig abgelaufene Bedrohung wirkt nicht mehr.
      e.ai.target = st.player;
      e.ai.threatSource = g;
      e.ai.threatTimer = 0;
      e.ai.targetTimer = 0;
      updateTargeting(st, 1);
      check(resolveTarget(e, st) === st.player, 'Phase 5 (Zielsystem): eine abgeklungene Bedrohung wirkt noch');
    }

    // (f) registerThreat ist ein No-op fuer den Spieler.
    {
      const { st, e } = raum('t_pink');
      registerThreat(st.player, e, st);
      check(st.player.ai.threatSource === undefined, 'Phase 5 (Zielsystem): registerThreat setzt beim Spieler trotzdem ein Feld');
    }

    // (g) Sichtlinien-Fallback: ein Geist ausserhalb des Grids (fuer
    // clearLine dauerhaft unerreichbar) wird nach noTargetFallbackS
    // aufgegeben, der Gegner faellt auf den Spieler zurueck.
    {
      const { st, e } = raum('t_pink');
      e.x = 50; e.y = 48; e.prevX = 50; e.prevY = 48;
      st.player.x = 450; st.player.y = 48; // 400px entfernt
      const gBlocked = makeGhost(st, -30, 48); // 80px entfernt, aber ausserhalb -> blockiert
      st.ghosts.push(gBlocked);
      // reevalS = 1/reevaluateHz(4) = 0.25s; noTargetFallbackS(1) -> 4 Aufrufe.
      for (let i = 0; i < 5; i++) {
        e.ai.targetTimer = 0;
        updateTargeting(st, 0.25);
      }
      check(
        resolveTarget(e, st) === st.player,
        'Phase 5 (Zielsystem): Sichtlinien-Fallback greift nicht (bleibt am unerreichbaren Geist haengen)',
      );
    }

    // (h) Integration: Fahr- UND Turmverhalten (ai_drives.js/ai_turrets.js)
    // steuern wirklich zum aufgeloesten Ziel, nicht mehr hart zum Spieler.
    {
      const { st, e } = raum('t_pink');
      e.cfg.accuracy = 1; // deterministisch: kein Zielfehler-Jitter
      st.player.x = e.x - 200; st.player.y = e.y; // WESTEN
      const g = makeGhost(st, e.x + 60, e.y); // OSTEN, effektiv naeher -> wird gewaehlt
      st.ghosts.push(g);
      updateTargeting(st, 10);
      check(
        resolveTarget(e, st) === g,
        'Phase 5 (Zielsystem): Vorbedingung Integrationstest (Geist nicht als Ziel aufgeloest)',
      );

      const { move } = updateEnemy(e, st, 1 / 60);
      const moveAngle = Math.atan2(move.y, move.x);
      check(
        Math.abs(angleDiff(moveAngle, 0)) < 0.05,
        `Phase 5 (Zielsystem): Fahrverhalten steuert nicht zum aufgeloesten Ziel (Winkel ${moveAngle.toFixed(2)} statt 0)`,
      );
      check(
        Math.abs(angleDiff(moveAngle, Math.PI)) > 2,
        'Phase 5 (Zielsystem): Fahrverhalten steuert trotzdem in Richtung Spieler',
      );

      // Turm konvergiert ueber mehrere Ticks ebenfalls zum Geist.
      for (let i = 0; i < 90; i++) updateEnemy(e, st, 1 / 60);
      check(
        Math.abs(angleDiff(e.turret, 0)) < 0.1,
        `Phase 5 (Zielsystem): Turm zielt nicht auf das aufgeloeste Ziel (${e.turret.toFixed(2)})`,
      );
    }

    // (i) Volle Pipeline (stepState): aimingAtPlayer ist nur noch wahr, wenn
    // wirklich der SPIELER im Visier ist -- ein Schuss auf einen Geist darf
    // den Gefahrensinn (Phase 18 Welle 3) nicht faelschlich ausloesen.
    {
      const { st, e } = raum('t_pink');
      e.cfg.accuracy = 1;
      for (let i = 0; i < 90; i++) stepState(st, CMD, STEP);
      check(e.aimingAtPlayer === true, 'Phase 5 (Zielsystem): aimingAtPlayer wird nicht gesetzt, obwohl der Spieler im Visier ist');

      // Position wieder auf einen kontrollierten Abstand setzen (der Hunter
      // ist waehrend der ersten Schleife auf den Spieler zugefahren) und
      // einen naeheren, sichtbaren Geist einfuegen.
      e.x = st.player.x - 300; e.y = st.player.y; e.prevX = e.x; e.prevY = e.y;
      const g = makeGhost(st, e.x + 40, e.y);
      st.ghosts.push(g);
      e.ai.targetTimer = 0;
      for (let i = 0; i < 60; i++) stepState(st, CMD, STEP);
      check(
        resolveTarget(e, st) === g,
        'Phase 5 (Zielsystem): Vorbedingung (Geist wird nicht als Ziel gewaehlt)',
      );
      check(
        e.aimingAtPlayer === false,
        'Phase 5 (Zielsystem): aimingAtPlayer bleibt wahr, obwohl auf einen Geist gezielt wird',
      );
    }

    // (m) Determinismus: das Zielsystem verbraucht KEIN RNG -- sonst
    // wuerde es den Seed-RNG-Strom verschieben und Fortsetzen/Replays
    // brechen (E-Grundsatz seit Phase 0b).
    {
      const { st, e } = raum('t_pink');
      const g = makeGhost(st, e.x + 20, e.y);
      st.ghosts.push(g);
      let calls = 0;
      const origRng = st.rng;
      st.rng = () => {
        calls++;
        return origRng();
      };
      for (let i = 0; i < 10; i++) {
        e.ai.targetTimer = 0;
        updateTargeting(st, 1);
        registerThreat(e, g, st);
      }
      check(calls === 0, `Phase 5 (Zielsystem): das Zielsystem verbraucht RNG (${calls} Aufrufe) -- Seed-Wiedergabe wuerde brechen`);
    }
  } finally {
    tanksData.balance.aggro = origAggro;
  }

  // (j)/(k) Boss-Fixierung: zeitgesteuerter Wechsel zwischen erzwungener
  // Spieler-Fixierung und freier Zielwahl (bossai.js: resolveBossTarget/
  // resolvePhalanxTarget). Eigene Testwerte statt data/balance.json.
  const origFixate = tanksData.balance.boss.fixate;
  const testFixate = { onPlayerS: 2, onGhostsS: 2, minPlayerShare: 0.4 }; // Zyklus 4
  tanksData.balance.boss.fixate = testFixate;
  try {
    // (j) Der Spiegel: waehrend onPlayerS immer der Spieler, in der freien
    // Phase entdeckt er einen nahen Geist wirklich (nicht nur der zuletzt
    // gesetzte Wert -- das war der eigentliche Fund dieser Phase, s.
    // bossai.js: resolveBossTarget()-Kommentar).
    {
      const st = createState(tanksData, tilesData, {
        genRng: rngFor(1, 3, 'rooms'),
        enemyTypes: ['t_mirror'],
        aiSeed: hashSeed(1, 3, 'ai'),
        playerUpgrades: {},
        upgradesData,
        equippedSecondary: 'mine',
        transform: {},
        roomSpec: { fixedLayout: 'boss_mirror' },
        arenas: tanksData.arenas,
      });
      const boss = st.tanks.find((t) => t !== st.player);
      stepMirrorBoss(boss, st, 1 / 60); // einmal, um auf die gespiegelte Position zu kommen
      const g = makeGhost(st, boss.x + 10, boss.y); // sehr nah
      st.ghosts.push(g);

      st.time = 0.5; // < onPlayerS(2) -> global fixiert
      stepMirrorBoss(boss, st, 1 / 60);
      check(boss.fixatedOnPlayer === true, 'Phase 5 (Zielsystem): Spiegel-Boss ist waehrend onPlayerS nicht fixiert');
      check(boss.ai.target === st.player, 'Phase 5 (Zielsystem): Spiegel-Boss zielt waehrend der Fixierung nicht auf den Spieler');

      st.time = 3.0; // 2 <= 3 < 4 -> freie Phase
      stepMirrorBoss(boss, st, 1 / 60);
      check(boss.fixatedOnPlayer === false, 'Phase 5 (Zielsystem): Spiegel-Boss bleibt in der freien Phase fixiert');
      check(
        boss.ai.target === g,
        'Phase 5 (Zielsystem): Spiegel-Boss entdeckt in der freien Phase keinen naeheren Geist (resolveTarget statt pickTarget?)',
      );
    }

    // (k) Der Reaktor: KEINE Sonderregel -- laeuft ueber die normale
    // updateTargeting()-Schleife wie jeder andere Gegner (CLAUDE.md-Auflage
    // "auch KEINE Fixierungs-Sonderregel").
    {
      const st = createState(tanksData, tilesData, {
        genRng: rngFor(1, 3, 'rooms'),
        enemyTypes: ['t_reactor'],
        aiSeed: hashSeed(1, 3, 'ai'),
        playerUpgrades: {},
        upgradesData,
        equippedSecondary: 'mine',
        transform: {},
        roomSpec: { fixedLayout: 'boss_reactor' },
        arenas: tanksData.arenas,
      });
      const reactor = st.tanks.find((t) => t !== st.player);
      check(
        !reactor.cfg.mirrorBoss && !reactor.cfg.phalanx,
        'Phase 5 (Zielsystem): Vorbedingung -- der Reaktor hat eine Boss-Sonderbewegung',
      );
      const g = makeGhost(st, reactor.x + 5, reactor.y);
      st.ghosts.push(g);
      updateTargeting(st, 10);
      check(
        resolveTarget(reactor, st) === g,
        'Phase 5 (Zielsystem): der Reaktorkern nutzt die generische Zielauflösung nicht (Sonderregel gefunden)',
      );
    }

    // (l) Die Phalanx: raeumliche Regel erzwingt IMMER mindestens
    // minPlayerShare der fuenf Panzer auf den Spieler, unabhaengig von der
    // Zeitfensterlage -- und die Auswahl wandert deterministisch (rotiert).
    {
      const st = createState(tanksData, tilesData, {
        genRng: rngFor(1, 3, 'rooms'),
        enemyTypes: Array(5).fill('t_phalanx'),
        aiSeed: hashSeed(1, 3, 'ai'),
        playerUpgrades: {},
        upgradesData,
        equippedSecondary: 'mine',
        transform: {},
        roomSpec: { fixedLayout: 'boss_phalanx' },
        arenas: tanksData.arenas,
      });
      const others = st.tanks.filter((t) => t !== st.player);
      check(others.length === 5, `Phase 5 (Zielsystem): Phalanx-Testraum hat ${others.length} statt 5 Panzer`);

      st.time = 0.5; // < onPlayerS(2) -> global fixiert
      for (const t of others) stepPhalanxBoss(t, st, 1 / 60);
      check(
        others.every((t) => t.fixatedOnPlayer === true && t.ai.target === st.player),
        'Phase 5 (Zielsystem): Phalanx fixiert waehrend onPlayerS nicht alle fuenf auf den Spieler',
      );

      st.time = 3; // freie Phase (2..4)
      for (const t of others) stepPhalanxBoss(t, st, 1 / 60);
      const forced = others.filter((t) => t.fixatedOnPlayer === true);
      const free = others.filter((t) => t.fixatedOnPlayer === false);
      check(forced.length === 2, `Phase 5 (Zielsystem): Phalanx erzwingt nicht genau 2 von 5 (minPlayerShare=0.4) (${forced.length})`);
      check(
        forced.every((t) => t.ai.target === st.player),
        'Phase 5 (Zielsystem): ein raeumlich erzwungener Phalanx-Panzer zielt nicht auf den Spieler',
      );
      check(free.length === 3, `Phase 5 (Zielsystem): falsche Anzahl freier Phalanx-Panzer (${free.length})`);

      // Rotation: ein voller Zyklus weiter (gleiche Phase) wandert die
      // erzwungene Auswahl auf andere Formationsplaetze.
      const forcedSlotsA = new Set(forced.map((t) => t.phalanxIndex));
      st.time = 3 + 4; // + 1 Zyklus (cycle = onPlayerS+onGhostsS = 4)
      for (const t of others) stepPhalanxBoss(t, st, 1 / 60);
      const forcedSlotsB = new Set(others.filter((t) => t.fixatedOnPlayer).map((t) => t.phalanxIndex));
      check(forcedSlotsA.size === 2 && forcedSlotsB.size === 2, 'Phase 5 (Zielsystem): Vorbedingung Rotationstest');
      check(
        [...forcedSlotsA].some((s) => !forcedSlotsB.has(s)) || [...forcedSlotsB].some((s) => !forcedSlotsA.has(s)),
        'Phase 5 (Zielsystem): die raeumlich erzwungene Auswahl rotiert nicht (immer dieselben Panzer)',
      );
    }
  } finally {
    tanksData.balance.boss.fixate = origFixate;
  }

  // (n) Geist-Objektform (createGhost): panzerkompatibel fuer resolveTarget/
  // Vorhaltezielen/Kollision -- alive statt dead, vx/vy/hp/cfg.radius vorhanden.
  {
    const { st, e } = raum('t_pink');
    const g = createGhost(st, e.x, e.y);
    check(
      g.alive === true && g.hp === g.cfg.maxHp && g.vx === 0 && g.vy === 0 && g.isGhost === true,
      'Phase 5 (Zielsystem): createGhost erzeugt keine panzerkompatible Form (alive/hp/vx/vy/isGhost)',
    );
  }

  // (o) updateGhosts(): bewegt sich wirklich (vx/vy wie ein echter Panzer,
  // tank.js: moveTank-Muster) und wird bei hp<=0 entfernt.
  {
    const { st, e } = raum('t_pink'); // e bleibt als lebendes Ziel des Geistes stehen
    const g = createGhost(st, e.x - 150, e.y);
    st.ghosts.push(g);
    updateGhosts(st, 1 / 60);
    check(Math.hypot(g.vx, g.vy) > 0, 'Phase 5 (Zielsystem): ein Geist mit lebendem Ziel in Reichweite bewegt sich nicht (vx/vy bleiben 0)');
    check(
      Math.abs(g.vx - (g.x - g.prevX) / (1 / 60)) < 1e-9,
      'Phase 5 (Zielsystem): vx entspricht nicht der tatsaechlichen Bewegung',
    );

    g.hp = 0;
    updateGhosts(st, 1 / 60);
    check(st.ghosts.length === 0, 'Phase 5 (Zielsystem): ein Geist bei hp<=0 wird nicht entfernt');
  }

  // (p) Gegner-Geschosse gegen Geister: schaden ihnen (state.js, eigene
  // kleine Kollisionsschleife); Spieler-/Geister-eigene Kugeln nie.
  {
    const { st, e } = raum('t_pink');
    // e bleibt als reine Schuetzen-Identitaet fuer b.owner erhalten, fliegt
    // aber selbst nicht mehr mit (kein lebender Gegner mehr, der die
    // Schadensmessung durch eigene Schuesse verfaelschen koennte).
    st.tanks.length = 0;
    st.tanks.push(st.player);
    // Nachschliff ("Champion muss ein eigenstaendiger Geisterpanzer sein"):
    // ein solo gepushter Geist wuerde in stepState() ueber updateGhosts()
    // sofort selbst zum Champion befoerdert -- das ueberschreibt hp/maxHp
    // MITTEN im Test und wuerde "hpVor - dmg" ungueltig machen. Ein zuerst
    // per pushGhost() gesetzter Anker haelt den Champion-Titel, damit g
    // selbst gewoehnlich bleibt.
    pushGhost(st, createGhost(st, 0, 0, 0, 't_pink'));
    const g = createGhost(st, 300, 48);
    st.ghosts.push(g);
    check(!g.isChampion, 'Phase 5 (Zielsystem): Vorbedingung -- g ist faelschlich Champion');

    const hpVor = g.hp;
    const dmg = 17;
    st.bullets.push(
      createBullet(g.x, g.y, 0, { speed: 1, radius: 4, owner: e, kind: 'bullet', damage: dmg }),
    );
    stepState(st, CMD, STEP);
    check(
      g.hp === hpVor - dmg,
      `Phase 5 (Zielsystem): eine Gegner-Kugel schadet dem Geist nicht korrekt (${hpVor} -> ${g.hp}, erwartet ${hpVor - dmg})`,
    );

    // Liegen gebliebene (unbeteiligte) Kugeln vorher raeumen -- sonst
    // kollidiert die naechste Testkugel per normaler Kugel-gegen-Kugel-
    // Kollision mit der vorigen (beide am selben Punkt), statt den Geist
    // ueberhaupt zu erreichen.
    st.bullets.length = 0;
    const hpVor2 = g.hp;
    st.bullets.push(
      createBullet(g.x, g.y, 0, { speed: 1, radius: 4, owner: st.player, kind: 'bullet', damage: 999 }),
    );
    stepState(st, CMD, STEP);
    check(g.hp === hpVor2, 'Phase 5 (Zielsystem): eine Spielerkugel schadet dem Geist');

    st.bullets.length = 0;
    st.bullets.push(
      createBullet(g.x, g.y, 0, { speed: 1, radius: 4, owner: e, kind: 'bullet', damage: 99999 }),
    );
    stepState(st, CMD, STEP);
    // Nachschliff: der Anker-Champion aus dem Testaufbau oben lebt weiter --
    // geprueft wird, dass GENAU g (nicht der ganze Bestand) entfernt ist.
    check(!st.ghosts.includes(g) || !g.alive, 'Phase 5 (Zielsystem): ein toedlicher Treffer entfernt den Geist nicht');
  }
}

// ---- 42. Upgradepool-v2 Phase 6: Nekromant -- Klassenidentitaet ---------
// Die Geistermechanik ist ab Klassenwahl aktiv (kein Upgrade noetig).
// Teilabschnitt (b) ist mit Nekromant-V2 Phase 3 aktualisiert: EIN
// einheitlicher reviveChance-Wert statt der alten, zweistufigen
// spawnChance.necro/.ghost (50 %/33 %, archiviert), Elite-/Boss-Ausnahme
// und ein ueberlauffaehiger "Rechenweg statt Obergrenze"-Wurf (b2/b3) sind
// dazugekommen -- deterministisch ueber state.rng. Kill-Zuordnung
// (meta.killer) haengt an applyDamage()/killTank() und muss auch fuer
// Minen-, Explosions- und Kettenblitz-Kills stimmen (Teilabschnitte weiter
// unten, unveraendert). Geisterbombe ersetzt den Bombenslot komplett.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { useSecondary } = await import('../src/game/tank.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { createMine, updateMines } = await import('../src/game/mine.js');
  const { resolveCfg } = await import('../src/game/cfg.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { hashSeed, rngFor, mulberry32 } = await import('../src/core/rng.js');
  const { occupiedGhostSlots } = await import('../src/game/ghost.js');

  const necroRoom = (types = ['t_pink']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    st.explosions.length = 0;
    return st;
  };

  // (a) Klassenidentitaet: c_necro traegt cfg.necromancer, andere Klassen
  // nicht; die Klassenbeschreibung nennt die Geistermechanik (Testschritt 1).
  {
    check(resolveCfg(tanksData, 'c_necro').necromancer === true, 'Phase 6: c_necro hat cfg.necromancer nicht gesetzt');
    check(resolveCfg(tanksData, 'player').necromancer === false, 'Phase 6: die Standardklasse traegt faelschlich cfg.necromancer');
    check(/[Gg]eist/.test(tanksData.types.c_necro.desc), 'Phase 6: die Klassenbeschreibung nennt die Geistermechanik nicht');
  }

  // (b) Spawn-Wuerfel: deterministisch ueber state.rng. Seit Nekromant-V2
  // Phase 3 EIN einheitlicher reviveChance-Wert fuer Spieler-als-Nekromant-
  // Kills UND Kills durch einen bereits vorhandenen Geist (die alte,
  // zweistufige spawnChance.necro/.ghost 50%/33% ist archiviert, s.
  // archive/ghost-tank-v1.json) -- gegen den ECHTEN Datenwert
  // (tanksData.balance.ghost.reviveChance) geprueft, nicht gegen einen
  // hartkodierten Bruch, sonst wandert der Test bei der naechsten
  // Balance-Aenderung grundlos auf Rot (CLAUDE.md-Pflicht).
  {
    const chance = tanksData.balance.ghost.reviveChance;
    const rollKill = (starterTank, killer, rngValue) => {
      const st = necroRoom();
      if (starterTank !== 'c_necro') {
        // Zweite Instanz mit Standardklasse fuer den Nicht-Nekromant-Fall.
        const st2 = createState(tanksData, tilesData, {
          genRng: rngFor(1, 3, 'rooms'), enemyTypes: ['t_pink'], aiSeed: hashSeed(1, 3, 'ai'),
          playerUpgrades: {}, upgradesData, equippedSecondary: 'mine', transform: {},
        });
        st2.bullets.length = 0; st2.mines.length = 0; st2.ghosts.length = 0;
        const e2 = st2.tanks.find((t) => t !== st2.player);
        st2.rng = () => rngValue;
        st2.killTank(e2, 'test', killer === 'player' ? { killer: st2.player } : killer === 'ghost' ? { killer: { isGhost: true, alive: true } } : {});
        return st2.ghosts.length;
      }
      const e = st.tanks.find((t) => t !== st.player);
      st.rng = () => rngValue;
      st.killTank(e, 'test', killer === 'player' ? { killer: st.player } : killer === 'ghost' ? { killer: { isGhost: true, alive: true } } : {});
      return st.ghosts.length;
    };
    check(rollKill('c_necro', 'player', chance - 0.01) === 1, 'Phase 3: Nekromant-Kill unter der reviveChance-Schwelle erzeugt keinen Untertan');
    check(rollKill('c_necro', 'player', chance + 0.01) === 0, 'Phase 3: Nekromant-Kill ueber der reviveChance-Schwelle erzeugt trotzdem einen Untertan');
    check(rollKill('c_necro', 'ghost', chance - 0.01) === 1, 'Phase 3: ein Geist-Kill hat nicht dieselbe (vereinheitlichte) Chance wie ein Spieler-Kill');
    check(rollKill('c_necro', 'ghost', chance + 0.01) === 0, 'Phase 3: ein Geist-Kill ueber der Schwelle erzeugt trotzdem einen Untertan');
    check(rollKill('player', 'player', 0) === 0, 'Phase 3: eine Nicht-Nekromant-Klasse erzeugt trotzdem einen Untertan (Chance ist 0)');
    check(rollKill('c_necro', 'none', 0) === 0, 'Phase 3: ein Kill ohne bekannten Killer (z. B. Statuseffekt-Tick) erzeugt trotzdem einen Untertan');
  }

  // (b2) Elite-/Boss-Ausnahme (Nekromant-V2 Phase 3, ANGEPASST durch den
  // Champion-/Nekromant-Nachschliff Abschnitt 12: Eliten sind seither
  // GENERELL wiederbelebbar, nicht mehr kategorisch ausgeschlossen -- nur
  // Bosse bleiben in jedem Fall ausgenommen, s. Test direkt darunter).
  {
    const st = necroRoom();
    const e = st.tanks.find((t) => t !== st.player);
    e.affixes = ['twinshot']; // synthetischer Elite-Affix
    st.rng = () => 0; // garantierter Wurf
    st.killTank(e, 'test', { killer: st.player });
    check(st.ghosts.length === 1, 'Abschnitt 65 (Nachschliff 12): ein Elite-Gegner wird trotz garantiertem Wurf nicht wiederbelebt');
  }
  {
    const st = necroRoom();
    const e = st.tanks.find((t) => t !== st.player);
    e.cfg.bossInvincible = true; // synthetisches Boss-Flag (isBossCfg)
    st.rng = () => 0;
    st.killTank(e, 'test', { killer: st.player });
    check(st.ghosts.length === 0, 'Phase 3: ein Boss wird trotz Affix-losem Kill wiederbelebt');
  }

  // (b3) "Rechenweg statt Obergrenze" (Auftrag Abschnitt 4a): reviveChance
  // OHNE Deckel -- ueber 100 % erzeugt der ganzzahlige Anteil GARANTIERTE
  // Zusatz-Untertanen, der Rest bleibt eine Chance. Mit einem synthetischen
  // Wert (1.4) statt der echten 0,35, damit der Mechanismus selbst geprueft
  // wird, nicht die aktuelle Datenlage.
  {
    const orig = tanksData.balance.ghost.reviveChance;
    tanksData.balance.ghost.reviveChance = 1.4;
    try {
      const stLow = necroRoom(['t_pink', 't_pink', 't_pink']);
      const eLow = stLow.tanks.find((t) => t !== stLow.player);
      stLow.rng = () => 0.3; // < remainder (0.4) -> zweiter Untertan spawnt ebenfalls
      stLow.killTank(eLow, 'test', { killer: stLow.player });
      check(stLow.ghosts.length === 2, `Phase 3: reviveChance 1.4 mit Restwurf < 0.4 erzeugt ${stLow.ghosts.length} statt 2 Untertanen`);

      const stHigh = necroRoom(['t_pink', 't_pink', 't_pink']);
      const eHigh = stHigh.tanks.find((t) => t !== stHigh.player);
      stHigh.rng = () => 0.9; // >= remainder (0.4) -> nur der garantierte Untertan
      stHigh.killTank(eHigh, 'test', { killer: stHigh.player });
      check(stHigh.ghosts.length === 1, `Phase 3: reviveChance 1.4 mit Restwurf >= 0.4 erzeugt ${stHigh.ghosts.length} statt 1 Untertan`);

      // Deckel bleibt trotz Ueberlauf gueltig: reviveChance 5.0 (garantiert
      // 5 Untertanen) bei einem Basislimit von 3 (data/balance.json:
      // ghost.maxActive) darf trotz "5 garantiert" nicht mehr als das Limit
      // erzeugen -- s. state.js: killTank()s Spawnschleife.
      const stCap = necroRoom(['t_pink', 't_pink', 't_pink']);
      const eCap = stCap.tanks.find((t) => t !== stCap.player);
      tanksData.balance.ghost.reviveChance = 5.0;
      stCap.rng = () => 0;
      stCap.killTank(eCap, 'test', { killer: stCap.player });
      const cap = (tanksData.balance.ghost.maxActive ?? 3);
      // Nachschliff ("Champion zaehlt NIE gegen das Geistlimit"): der erste
      // der 5 garantierten Spawns wird sofort Champion (kein vorhandener) --
      // occupiedGhostSlots() (nur gewoehnliche Untertanen) haelt trotzdem
      // exakt den Deckel, st.ghosts.length darf um GENAU den einen Champion
      // hoeher liegen.
      check(
        occupiedGhostSlots(stCap) === cap,
        `Phase 3: das Geistlimit (${cap}) wird trotz reviveChance 5.0 ueberschritten (${occupiedGhostSlots(stCap)})`,
      );
      check(
        stCap.ghosts.length === cap + 1,
        `Phase 3: erwartet Champion + Deckel (${cap + 1}) Untertanen, tatsaechlich ${stCap.ghosts.length}`,
      );
      check(stCap.ghosts.filter((g) => g.isChampion).length === 1, 'Phase 3: es gibt nicht genau einen Champion trotz Ueberlauf');
    } finally {
      tanksData.balance.ghost.reviveChance = orig;
    }
  }

  // (c) Geistlimit OHNE Verdraengung: am Deckel passiert nichts, auch bei
  // einem garantierten Wurf.
  {
    const st = necroRoom();
    for (let i = 0; i < 3; i++) st.ghosts.push({ isGhost: true, alive: true, id: -i - 1 });
    const e = st.tanks.find((t) => t !== st.player);
    st.rng = () => 0;
    st.killTank(e, 'test', { killer: st.player });
    check(st.ghosts.length === 3, 'Phase 6: das Geistlimit (3) wird trotz garantiertem Wurf ueberschritten');
  }

  // (d) Kill-Zuordnung ueber alle Quellen -- "auch Minen-, Explosions- und
  // Kettenblitz-Kills muessen korrekt zugeordnet werden" (Auftragstext). Jede
  // Pruefung nutzt rng()=>0 (garantierter Treffer) und prueft den Spawn als
  // Beweis, dass meta.killer tatsaechlich beim Spieler ankam.
  {
    // (d1) Direkter Kugeltreffer.
    {
      const st = necroRoom();
      const e = st.tanks.find((t) => t !== st.player);
      e.protect = 0;
      e.hp = 1;
      st.rng = () => 0;
      st.bullets.push(
        createBullet(e.x, e.y, 0, { speed: 1, radius: 4, owner: st.player, kind: 'bullet', damage: 99999 }),
      );
      stepState(st, CMD, STEP);
      check(!e.alive, 'Phase 6: Vorbedingung Kugel-Kill (Ziel nicht getroffen)');
      check(st.ghosts.length === 1, 'Phase 6: ein direkter Kugeltreffer des Nekromanten wird nicht als Killer zugeordnet');
    }
    // (d2) Mine.
    {
      const st = necroRoom();
      const e = st.tanks.find((t) => t !== st.player);
      e.protect = 0;
      e.hp = 1;
      st.rng = () => 0;
      const m = createMine(e.x, e.y, st.player, st.data.mine.radiusPx);
      m.age = st.data.balance.mine.fuse; // sofort selbstzuendbereit
      st.mines.push(m);
      updateMines(st, 1 / 60);
      check(!e.alive, 'Phase 6: Vorbedingung Minen-Kill (Ziel nicht getroffen)');
      check(st.ghosts.length === 1, 'Phase 6: eine Mine des Nekromanten wird nicht als Killer zugeordnet');
    }
    // (d3) Sprengschuss-Explosion (state.js: markierte Geschosse explodieren
    // beim Tod).
    {
      const st = necroRoom();
      const e = st.tanks.find((t) => t !== st.player);
      e.protect = 0;
      e.hp = 1;
      st.rng = () => 0;
      const b = createBullet(e.x, e.y, 0, { speed: 0, radius: 1, owner: st.player, kind: 'bullet', damage: 1 });
      b.dead = true;
      b.explosive = true;
      b.explosionRadius = 200;
      b.detonated = false;
      st.bullets.push(b);
      stepState(st, CMD, STEP);
      check(!e.alive, 'Phase 6: Vorbedingung Sprengschuss-Kill (Ziel nicht getroffen)');
      check(st.ghosts.length === 1, 'Phase 6: eine Sprengschuss-Explosion des Nekromanten wird nicht als Killer zugeordnet');
    }
    // (d4) Kamikaze (Spieler stirbt, Explosion toetet einen Nachbarn).
    {
      const st = necroRoom();
      const e = st.tanks.find((t) => t !== st.player);
      e.protect = 0;
      e.hp = 1;
      st.player.x = e.x;
      st.player.y = e.y;
      st.player.cfg.kamikazeRadius = 200; // synthetischer Wert, unabhaengig von echten Karten
      st.rng = () => 0;
      st.killTank(st.player, 'test', {});
      check(!e.alive, 'Phase 6: Vorbedingung Kamikaze-Kill (Nachbar stirbt nicht)');
      check(st.ghosts.length === 1, 'Phase 6: eine Kamikaze-Explosion des sterbenden Nekromanten wird nicht als Killer zugeordnet');
    }
    // (d5) Kettenblitz-Upgrade (Explosion am Ort eines Kills toetet einen
    // Nachbarn) -- die im Auftragstext ausdruecklich genannte Kategorie. Die
    // Explosion laeuft SYNCHRON innerhalb desselben killTank(a,...)-Aufrufs
    // -- A und B sterben also im selben Aufruf, nicht nacheinander.
    {
      const st = necroRoom(['t_pink', 't_pink']);
      const [a, b] = st.tanks.filter((t) => t !== st.player);
      a.protect = 0;
      b.protect = 0;
      b.hp = 1;
      b.x = a.x + 10;
      b.y = a.y;
      st.player.cfg.chainLightning = 300; // synthetischer Radius
      st.rng = () => 0;
      st.killTank(a, 'test', { killer: st.player });
      check(!b.alive, 'Phase 6: Vorbedingung Kettenblitz-Kill (Nachbar B stirbt nicht)');
      check(st.ghosts.length === 2, 'Phase 6: eine Kettenblitz-Explosion des Nekromanten wird nicht als Killer zugeordnet (A und B)');
    }
    // (d6) Saboteur-Transformation (Explosion beim Aufwachen aus der
    // Betaeubung toetet einen Nachbarn).
    {
      const st = createState(tanksData, tilesData, {
        genRng: rngFor(1, 3, 'rooms'), enemyTypes: ['t_pink', 't_pink'], aiSeed: hashSeed(1, 3, 'ai'),
        playerUpgrades: {}, upgradesData, equippedSecondary: 'mine', transform: { stunExplodeRadiusPx: 300 },
        starterTank: 'c_necro',
      });
      st.bullets.length = 0; st.mines.length = 0; st.ghosts.length = 0;
      const [a, b] = st.tanks.filter((t) => t !== st.player);
      a.protect = 0; b.protect = 0;
      a.hp = a.cfg.maxHp = 99999; // A ueberlebt seine eigene Explosion
      b.hp = 1;
      b.x = a.x + 10;
      b.y = a.y;
      a.stunTimer = 0.01; // laeuft in diesem Tick ab -> loest die Explosion aus
      st.rng = () => 0;
      stepState(st, CMD, STEP);
      check(!b.alive, 'Phase 6: Vorbedingung Saboteur-Kill (Nachbar stirbt nicht)');
      check(st.ghosts.length === 1, 'Phase 6: eine Saboteur-Explosion des Nekromanten wird nicht als Killer zugeordnet');
    }
    // (d7) Blitzkette (damageType lightning): erbt meta ueber {...meta} in
    // damagetypes.js -- kein eigener Code noetig, hier nur bestaetigt.
    {
      const st = necroRoom(['t_pink', 't_pink']);
      const [a, b] = st.tanks.filter((t) => t !== st.player);
      a.protect = 0; a.hp = 1;
      b.protect = 0; b.hp = 1;
      b.x = a.x + 10;
      b.y = a.y;
      st.rng = () => 0;
      st.bullets.push(
        createBullet(a.x, a.y, 0, {
          speed: 1, radius: 4, owner: st.player, kind: 'bullet', damage: 99999, damageType: 'lightning',
        }),
      );
      stepState(st, CMD, STEP);
      check(!a.alive, 'Phase 6: Vorbedingung Blitzkette (A stirbt nicht)');
      check(!b.alive, 'Phase 6: Vorbedingung Blitzkette (B springt nicht mit)');
      check(st.ghosts.length === 2, 'Phase 6: eine Blitzkette des Nekromanten wird nicht als Killer zugeordnet (A und B)');
    }
    // (d8) Statuseffekt-Tick (Phase 0 dokumentierte Untererfassung, kein
    // Umbau von status.js): kein Killer bekannt -> kein Wurf, kein Geist.
    // Prueft SOFORT nach dem Tod ab (Schleife bricht, sobald e stirbt) --
    // zur Zeit dieses Tests (vor Phase 7) verfiel ein faelschlich erzeugter
    // Geist nach dem alten Lebensdauer-Fallback (createGhost(): balance
    // .ghost?.duration ?? 3 s), ein zu spaeter Check saehe dann IMMER 0
    // (verfallen statt nie erzeugt) und wuerde eine falsche Zuordnung nicht
    // mehr fangen (per Gegenprobe gefunden: mit absichtlich injiziertem
    // killer blieb dieser Test bei einer 4-Sekunden-Schleife trotzdem gruen).
    // Seit Phase 7 gibt es gar keinen Lebensdauer-Timer mehr (Anhang B S6) --
    // das fruehe Abbrechen bleibt trotzdem die richtige, robuste Praxis.
    {
      const st = necroRoom();
      const e = st.tanks.find((t) => t !== st.player);
      e.protect = 0;
      e.hp = 1;
      st.rng = () => 0;
      st.applyStatus(e, 'fire', 3);
      let ticks = 0;
      while (e.alive && ticks < 600) {
        stepState(st, CMD, STEP);
        ticks++;
      }
      check(!e.alive, 'Phase 6: Vorbedingung Statuseffekt-Kill (Ziel stirbt nicht)');
      check(st.ghosts.length === 0, 'Phase 6: ein Statuseffekt-Kill (kein bekannter Killer) erzeugt trotzdem einen Geist');
    }
  }

  // (e) Geisterbombe: ersetzt den Bombenslot komplett -- kein Wurf, keine
  // Explosion, kein Fernzuender; am Limit passiert nichts.
  {
    const st = necroRoom();
    check(useSecondary(st.player, st, null) === true, 'Phase 6: die Geisterbombe loest nicht aus');
    check(st.ghosts.length === 1, 'Phase 6: die Geisterbombe erzeugt keinen Geist');
    check(st.mines.length === 0, 'Phase 6: die Geisterbombe legt trotzdem eine Mine');
    check(st.explosions.length === 0, 'Phase 6: die Geisterbombe erzeugt eine Explosion');

    // Am Limit: kein Verbrauch, kein Wurf, kein Absturz. Zwischen den
    // Aufrufen die neue Bomben-Abklingzeit (Nutzerwunsch) zuruecksetzen --
    // dieser Test prueft das GEISTLIMIT, nicht den Cooldown (eigener Test
    // weiter unten). Nachschliff: der ERSTE Wurf oben wurde sofort Champion
    // (kein vorhandener) und zaehlt seither NICHT mehr gegen das Limit --
    // es braucht also `cap` WEITERE Wuerfe, um die gewoehnlichen Plaetze zu
    // fuellen, nicht `cap - 1`.
    const cap = tanksData.balance.ghost.maxActive ?? 3;
    for (let i = 0; i < cap; i++) {
      st.player.ghostBombCooldown = 0;
      useSecondary(st.player, st, null);
    }
    check(occupiedGhostSlots(st) === cap, `Phase 6: Vorbedingung Geisterbomben-Limit (belegte Plaetze ${occupiedGhostSlots(st)} statt ${cap})`);
    check(st.ghosts.length === cap + 1, `Phase 6: Vorbedingung Champion + Deckel (${st.ghosts.length} statt ${cap + 1})`);
    st.player.ghostBombCooldown = 0;
    check(useSecondary(st.player, st, null) === false, 'Phase 6: die Geisterbombe loest am Limit trotzdem aus');
    check(st.ghosts.length === cap + 1, 'Phase 6: das Geistlimit wird per Geisterbombe ueberschritten');

    // Gegenprobe zur Klassenweiche: eine ANDERE Klasse legt weiterhin eine
    // echte Mine (keine Regression durch die neue Weiche in useSecondary()).
    const stNormal = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'), enemyTypes: ['t_pink'], aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {}, upgradesData, equippedSecondary: 'mine', transform: {},
    });
    stNormal.mines.length = 0;
    check(useSecondary(stNormal.player, stNormal, null) === true, 'Phase 6: eine andere Klasse kann keine Bombe mehr legen');
    check(stNormal.mines.length === 1, 'Phase 6: eine andere Klasse legt keine echte Mine mehr (Weiche zu breit)');
  }

  // (f) exclusions-MECHANISMUS: eine Karte mit exclusions:["c_necro"] darf
  // beim Nekromanten nie erscheinen, bei einer anderen Klasse weiterhin
  // normal. Grundsteinumbau Phase 4: die sieben ehemals minenspezifischen
  // Karten (kettenglied, sprengkraft, ...), die diesen Filter ursprünglich
  // trugen, sind mit dem 251-Karten-Pool archiviert (ARCHIV.md) -- der
  // Filter selbst (upgradepool.js: buildCandidates()) bleibt unangetastet
  // gebaut und wird deshalb mit einer SYNTHETISCHEN Karte geprueft.
  {
    const fakeUpgrades = {
      offersPerScreen: 3,
      upgrades: {
        ...upgradesData.upgrades,
        test_necro_excluded: {
          id: 'test_necro_excluded', name: 'Testkarte', description: 'x', tag: 'testtag_excl',
          rarity: 'common', maxStacks: 1, requires: [], minRoom: 1, exclusions: ['c_necro'], core: {},
        },
      },
    };
    const seenFor = (starterTank) => {
      const seen = new Set();
      const rng = mulberry32(7);
      for (let i = 0; i < 400; i++) {
        const offers = rollOffers(fakeUpgrades, {
          chosen: {}, roomIndex: 10, rng, balance: tanksData.balance, count: 3, banned: new Set(), starterTank,
        });
        for (const o of offers) if (o.id) seen.add(o.id);
      }
      return seen;
    };
    const seenNecro = seenFor('c_necro');
    const seenOther = seenFor('player');
    check(
      !seenNecro.has('test_necro_excluded'),
      'Phase 6: der Nekromant sieht trotzdem eine fuer ihn ausgeschlossene Karte',
    );
    check(
      seenOther.has('test_necro_excluded'),
      'Phase 6: eine andere Klasse sieht eine nur fuer den Nekromanten gesperrte Karte nicht mehr (exclusions zu breit)',
    );
  }

  // (g) Determinismus: der Spawnwurf verbraucht GENAU EINEN zusaetzlichen
  // rng()-Aufruf, wenn ueberhaupt eine Chance besteht -- bei jeder anderen
  // Klasse (Chance 0) darf sich der RNG-Verbrauch von killTank() NICHT
  // aendern, sonst wuerden bestehende Seeds/Regressionslaeufe anderer
  // Klassen durch Phase 6 verschoben.
  {
    const mkRoom = (starterTank) => {
      const opts = {
        genRng: rngFor(1, 3, 'rooms'), enemyTypes: ['t_pink'], aiSeed: hashSeed(1, 3, 'ai'),
        playerUpgrades: {}, upgradesData, equippedSecondary: 'mine', transform: {},
      };
      if (starterTank) opts.starterTank = starterTank;
      const st = createState(tanksData, tilesData, opts);
      st.bullets.length = 0; st.mines.length = 0; st.ghosts.length = 0;
      return st;
    };
    const countKillRng = (st) => {
      const e = st.tanks.find((t) => t !== st.player);
      let calls = 0;
      const orig = st.rng;
      st.rng = (...a) => {
        calls++;
        return orig(...a);
      };
      st.killTank(e, 'test', { killer: st.player });
      return calls;
    };
    const normalCalls = countKillRng(mkRoom());
    const necroCalls = countKillRng(mkRoom('c_necro'));
    check(
      necroCalls === normalCalls + 1,
      `Phase 6: der Spawnwurf verbraucht nicht genau einen zusaetzlichen rng()-Aufruf (${normalCalls} -> ${necroCalls})`,
    );
  }
}

// ---- 43. Upgradepool-v2 Phase 7: Geisterpanzer -- Basis (ueberholt durch
// Nekromant-V2 Phase 3) -------------------------------------------------
// Der urspruengliche Anhang-B-Kern "eigener, fester Basiseinheiten-Typ
// ghost_tank, kein Stat-Erbe, kein Lebensdauer-Timer" ist mit Nekromant-V2
// Phase 3 GRUNDLEGEND umgekehrt worden (Auftrag Abschnitt 3): ein Untertan
// erbt jetzt den vollen TYP des getoeteten Gegners (nur maxHp/damage werden
// gestutzt), hat eine Lebensdauer, und ein dynamischer Champion ersetzt/
// ergaenzt den alten Kommandanten. ghost_tank selbst ist archiviert
// (archive/ghost-tank-v1.json). Die folgenden Teilabschnitte sind auf den
// NEUEN Stand umgeschrieben (Buchstaben unveraendert, wo die zugrunde-
// liegende Aussage nur angepasst statt ersetzt werden musste); (b3)/(k)-(o)
// sind komplett neu.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createGhost, updateGhosts, killGhost, pushGhost } = await import('../src/game/ghost.js');
  const { useSecondary } = await import('../src/game/tank.js');
  const { resolveCfg } = await import('../src/game/cfg.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');

  const necroRoom = (types = ['t_pink'], actEnemyPool = ['t_pink', 't_grey', 't_yellow']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
      actEnemyPool,
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    // KEIN st.ghosts.length = 0 hier (anders als bullets/mines) -- Test (i)
    // soll pruefen, dass createState() selbst ein frisches Array liefert,
    // nicht dass dieser Testhelfer eins erzwingt (sonst waere die Aussage
    // "Raumwechsel entfernt alle Geister" trivial wahr durch den Helfer,
    // nicht durch die produktive Logik -- per Gegenprobe gefunden).
    return st;
  };

  // (a) Typ-Vererbung (Nekromant-V2 Phase 3, ERSETZT den alten "einheitlicher
  // Unit-Typ"-Nachweis): der Kill-Wuerfel liefert den TYP des getoeteten
  // Gegners, die Geisterbombe einen Typ aus dem Akt-Gegnerpool.
  {
    const st = necroRoom();
    const e = st.tanks.find((t) => t !== st.player);
    e.protect = 0;
    st.rng = () => 0; // garantierter Spawnwurf
    st.killTank(e, 'test', { killer: st.player });
    check(st.ghosts[0]?.type === 't_pink', `Phase 3: Kill-Spawn erzeugt Typ ${st.ghosts[0]?.type} statt des geerbten t_pink`);

    useSecondary(st.player, st, null); // Geisterbombe (2. Slot, Kappe noch nicht erreicht)
    check(
      st.actEnemyPool.includes(st.ghosts[1]?.type),
      `Phase 3: Geisterbombe erzeugt Typ ${st.ghosts[1]?.type}, der nicht im Akt-Gegnerpool steht`,
    );
  }

  // (b) Basiswerte = Typ-Basiswerte * baseStatPct (statt der alten festen
  // Anhang-B-Zahlen): maxHp/damage kommen aus resolveCfg(tanksData, 't_pink')
  // gestutzt, alle anderen Felder (fireCooldown/speed/bulletSpeed/armor/
  // weapon/role/accuracy) bleiben UNVERAENDERT die des Quelltyps.
  {
    const st = necroRoom();
    const g = createGhost(st, 0, 0, 0, 't_pink');
    const base = resolveCfg(tanksData, 't_pink');
    const pct = tanksData.balance.ghost.baseStatPct;
    check(g.cfg.maxHp === Math.round(base.maxHp * pct), `Phase 3: Geist-LP ${g.cfg.maxHp} statt ${Math.round(base.maxHp * pct)} (t_pink * baseStatPct)`);
    check(g.cfg.damage === Math.round(base.damage * pct), `Phase 3: Geist-Schaden ${g.cfg.damage} statt ${Math.round(base.damage * pct)}`);
    check(g.cfg.armor === base.armor, 'Phase 3: die Panzerung des Quelltyps wird nicht vererbt');
    check(g.cfg.role === base.role, 'Phase 3: die Rolle des Quelltyps wird nicht vererbt');
    check(g.cfg.accuracy === base.accuracy, 'Phase 3: die Zielgenauigkeit des Quelltyps wird nicht vererbt');
    check(
      Math.abs(g.cfg.speed - base.speed) < 1e-9,
      `Phase 3: Geist-Tempo ${g.cfg.speed} statt des geerbten Basistempos ${base.speed} (kein Karten-Boost aktiv)`,
    );
    check(
      Math.abs(g.cfg.fireRangePx - tanksData.balance.bullet.maxDistance * tanksData.balance.ghost.rangePct) < 1e-9,
      `Phase 3: Geist-Feuerschwelle ${g.cfg.fireRangePx} entspricht nicht balance.ghost.rangePct * maxDistance`,
    );

    // Ein echtes, NICHT-leeres Panzerungsobjekt (nicht nur der triviale
    // null===null-Fall oben) wird ebenfalls unveraendert mitgegeben.
    const gArmored = createGhost(st, 0, 0, 0, 't_armored');
    const baseArmored = resolveCfg(tanksData, 't_armored');
    check(
      gArmored.cfg.armor === baseArmored.armor && gArmored.cfg.armor?.arc === 120,
      `Phase 3: ein von t_armored geerbter Untertan verliert seine Panzerung (${JSON.stringify(gArmored.cfg.armor)})`,
    );
  }

  // (c) Mechanismus statt Datenlage: baseStatPct wirkt wirklich MULTI-
  // PLIKATIV auf die Typ-Basiswerte -- mit einem synthetischen Wert
  // geprueft, der von der echten Zahl (0,5) abweicht.
  {
    const orig = tanksData.balance.ghost.baseStatPct;
    tanksData.balance.ghost.baseStatPct = 0.2;
    try {
      const st = necroRoom();
      const g = createGhost(st, 0, 0, 0, 't_pink');
      const base = resolveCfg(tanksData, 't_pink');
      check(g.cfg.maxHp === Math.round(base.maxHp * 0.2), 'Phase 3: baseStatPct wirkt nicht multiplikativ auf maxHp');
      check(g.cfg.damage === Math.round(base.damage * 0.2), 'Phase 3: baseStatPct wirkt nicht multiplikativ auf damage');
    } finally {
      tanksData.balance.ghost.baseStatPct = orig;
    }
  }

  // (d) Instanzwerte des getoeteten EXEMPLARS werden NICHT vererbt (nur der
  // TYP): ein Exemplar mit kuenstlich veraenderter Instanz-cfg (Raum-
  // Skalierung, Elite-Multiplikator o. ae.) erzeugt trotzdem einen Geist mit
  // den unveraenderten TYP-Basiswerten -- resolveGhostCfg() liest ueber
  // resolveCfg(data, sourceType) frisch aus tanksData, nicht aus tank.cfg.
  {
    const leicht = necroRoom(['t_pink']);
    const eLeicht = leicht.tanks.find((t) => t !== leicht.player);
    eLeicht.protect = 0;
    eLeicht.cfg.maxHp = 5; // synthetisch veraenderte INSTANZ (z. B. Raumskalierung)
    leicht.rng = () => 0;
    leicht.killTank(eLeicht, 'test', { killer: leicht.player });

    const schwer = necroRoom(['t_pink']);
    const eSchwer = schwer.tanks.find((t) => t !== schwer.player);
    eSchwer.protect = 0;
    eSchwer.cfg.maxHp = 99999; // synthetisch veraenderte INSTANZ
    schwer.rng = () => 0;
    schwer.killTank(eSchwer, 'test', { killer: schwer.player });

    const gL = leicht.ghosts[0];
    const gS = schwer.ghosts[0];
    check(!!gL && !!gS, 'Phase 3: Vorbedingung -- nicht beide Kills haben einen Geist erzeugt');
    check(
      gL.cfg.maxHp === gS.cfg.maxHp && gL.cfg.damage === gS.cfg.damage && gL.cfg.speed === gS.cfg.speed,
      `Phase 3: Geister aus unterschiedlich skalierten EXEMPLAREN desselben Typs unterscheiden sich (${gL.cfg.maxHp} vs. ${gS.cfg.maxHp} LP)`,
    );
  }

  // (e) Lebensdauer (Nekromant-V2 Phase 3, ERSETZT "KEIN Lebensdauer-Timer"):
  // ein GEWOEHNLICHER Geist OHNE Ziel verfaellt nach lifetimeS trotzdem --
  // mit einem synthetisch VERKUERZTEN Wert geprueft (Mechanismus statt
  // Datenlage). Champion-/Nekromant-Nachschliff Abschnitt 3.2: der Champion
  // hat SEIT DIESEM Auftrag wieder eine begrenzte Lebensdauer (nicht mehr
  // unendlich) -- der Anker-Geist braucht deshalb "Ewiger Thron"
  // (ghost_083, necroCrownEternalLifetime), um trotz des kuenstlich
  // verkuerzten lifetimeS stabil zu bleiben, waehrend `g` (gewoehnlich)
  // ganz normal verfaellt.
  {
    const orig = tanksData.balance.ghost.lifetimeS;
    tanksData.balance.ghost.lifetimeS = 1; // synthetisch kurz
    try {
      const st = necroRoom([]);
      st.tanks.length = 1; // nur der Spieler -- kein Ziel fuer den Geist
      st.player.cfg.necroCrownEternalLifetime = true; // "Ewiger Thron", direkt gesetzt (dieser lokale necroRoom()-Helfer kennt keine playerUpgrades)
      const anchor = createGhost(st, 0, 0, 0, 't_pink');
      pushGhost(st, anchor); // wird Champion, "Ewiger Thron" haelt es unendlich lebendig
      check(anchor.isChampion, 'Phase 3: Vorbedingung -- der Anker-Geist ist nicht Champion');
      check(anchor.lifetimeMax === Infinity, 'Phase 3: Vorbedingung -- Ewiger Thron macht den Anker nicht unsterblich');
      const g = createGhost(st, 300, 300, 0, 't_pink');
      pushGhost(st, g);
      check(!g.isChampion, 'Phase 3: Vorbedingung -- g ist faelschlich selbst Champion');
      check(g.lifetimeMax === 1, `Phase 3: Vorbedingung -- lifetimeMax ist ${g.lifetimeMax} statt 1`);
      for (let i = 0; i < 30; i++) updateGhosts(st, 1 / 60); // 0,5 s -- deutlich vor Ablauf
      check(st.ghosts.includes(g) && g.alive, 'Phase 3: ein Geist verfaellt VOR Ablauf seiner Lebensdauer');
      for (let i = 0; i < 60; i++) updateGhosts(st, 1 / 60); // weitere 1 s -- deutlich nach Ablauf
      check(!st.ghosts.includes(g) || !g.alive, 'Phase 3: ein Geist ohne Ziel verfaellt nicht nach Ablauf seiner Lebensdauer');
      check(anchor.alive, 'Phase 3: der Champion (Anker, mit Ewiger Thron) verfaellt faelschlich mit');
    } finally {
      tanksData.balance.ghost.lifetimeS = orig;
    }
  }

  // (e2) Der Ablauf ist ein ANDERER Todes-Ausloeser als Schaden: killGhost()
  // mit cause 'expire' loest KEINE der kartengebundenen Todes-Mechaniken aus
  // (hier: Letzter Wille/spawnDeathZone -- ueber die entstehende Explosion
  // nachweisbar). Ein synthetischer ghostDeathZoneRadius auf dem
  // Spieler-cfg, damit der Mechanismus ueberhaupt etwas ausloesen KOENNTE.
  {
    const st = necroRoom();
    st.player.cfg.ghostDeathZoneRadius = 40;
    st.player.cfg.ghostDeathZoneDamage = 10;
    const g = createGhost(st, 50, 50, 0, 't_pink');
    st.ghosts.push(g);
    const explosionsVor = st.explosions.length;
    killGhost(st, g, 'expire');
    check(g.alive === false, 'Phase 3: killGhost(..., "expire") toetet den Geist nicht');
    check(st.explosions.length === explosionsVor, 'Phase 3: ein Ablauf-Tod loest trotzdem Letzter Wille aus');

    const g2 = createGhost(st, 60, 60, 0, 't_pink');
    st.ghosts.push(g2);
    killGhost(st, g2, 'damage');
    check(st.explosions.length > explosionsVor, 'Phase 3: ein echter Schadens-Tod loest Letzter Wille nicht mehr aus (Vorbedingung fuer den obigen Vergleich)');

    // Dieselbe Ausnahme gilt fuer die Wiederkehr-Familie: ein 'expire'-Tod
    // wird trotz garantierter Wiederkehr-Chance NICHT wiederbelebt.
    st.player.cfg.ghostReviveChance = 1; // wuerde bei cause 'damage' IMMER greifen
    const g3 = createGhost(st, 70, 70, 0, 't_pink');
    st.ghosts.push(g3);
    killGhost(st, g3, 'expire');
    check(g3.alive === false, 'Phase 3: ein Ablauf-Tod wird trotz garantierter Wiederkehr-Chance wiederbelebt');
  }

  // (f) Feuer-Schwelle: ausserhalb von fireRangePx wird trotz freier Sicht
  // und exakter Ausrichtung NICHT geschossen, das Verfolgen (Bewegung)
  // bleibt aber unbegrenzt aktiv. Eigene, kuenstlich verkleinerte
  // balance.ghost.rangePct statt der echten 780 px -- die Arena (768x512)
  // laesst innerhalb einer Zeile keine 780 px Abstand zu, ausserdem misst
  // das so den MECHANISMUS statt der aktuellen Datenlage (CLAUDE.md-Pflicht).
  {
    const origRangePct = tanksData.balance.ghost.rangePct;
    tanksData.balance.ghost.rangePct = 0.05; // fireRangePx = 0.05 * 1200 = 60
    try {
      const st = createState(tanksData, tilesData, {
        genRng: rngFor(1, 3, 'rooms'),
        enemyTypes: ['t_pink'],
        aiSeed: hashSeed(1, 3, 'ai'),
        playerUpgrades: {},
        upgradesData,
        equippedSecondary: 'mine',
        transform: {},
        starterTank: 'c_necro',
        roomSpec: { fixedLayout: 'test_arena' },
        arenas: tanksData.arenas,
      });
      st.bullets.length = 0;
      st.mines.length = 0;
      st.ghosts.length = 0;
      const e = st.tanks.find((t) => t !== st.player);
      e.x = 400;
      e.y = 48; // offene Testzeile
      const g = createGhost(st, 100, 48, 0, 't_pink'); // Abstand 300 > fireRangePx (60)
      check(g.cfg.fireRangePx === 60, `Phase 3: Vorbedingung -- fireRangePx ist ${g.cfg.fireRangePx} statt 60`);
      check(
        Math.hypot(e.x - g.x, e.y - g.y) > g.cfg.fireRangePx,
        'Phase 3: Vorbedingung -- das Ziel liegt bereits innerhalb der Feuer-Schwelle',
      );
      st.ghosts.push(g);
      const xVor = g.x;
      for (let i = 0; i < 90; i++) updateGhosts(st, 1 / 60);
      check(st.bullets.length === 0, 'Phase 3: der Geist schiesst trotz Ziel ausserhalb der Feuer-Schwelle');
      check(g.x > xVor, 'Phase 3: der Geist bewegt sich nicht auf ein zu weit entferntes Ziel zu (Verfolgen ist nicht unbegrenzt)');

      // Jetzt nah genug heranholen -- derselbe Geist schiesst jetzt.
      g.x = e.x - 50;
      g.y = e.y;
      g.turret = 0; // schon ausgerichtet, damit der Schuss nicht am Winkel scheitert
      updateGhosts(st, 1 / 60);
      check(st.bullets.length === 1, 'Phase 3: der Geist schiesst innerhalb der Feuer-Schwelle trotzdem nicht');
    } finally {
      tanksData.balance.ghost.rangePct = origRangePct;
    }
  }

  // (g) killGhost() bei cause 'damage' (Standard): der Basistod hat KEINEN
  // Zusatzeffekt ohne einsatzbereite Karte -- nur alive wird false, sonst
  // nichts; idempotent bei doppeltem Aufruf.
  {
    const st = necroRoom();
    const g = createGhost(st, 10, 20, 0, 't_pink');
    const vorher = { ...g };
    killGhost(st, g);
    check(g.alive === false, 'Phase 3: killGhost() setzt alive nicht auf false');
    for (const k of Object.keys(vorher)) {
      if (k === 'alive') continue;
      check(g[k] === vorher[k], `Phase 3: killGhost() veraendert Feld "${k}" (Basistod haette keinen Zusatzeffekt)`);
    }
    killGhost(st, g); // zweiter Aufruf darf nicht werfen oder etwas doppelt tun
    check(g.alive === false, 'Phase 3: ein zweiter killGhost()-Aufruf ist nicht idempotent');
  }

  // (h) Nach dem Tod eines Geistes entsteht bei einem neuen qualifizierten
  // Kill wieder ein Geist (kein dauerhaftes Blockieren durch den alten).
  {
    const st = necroRoom(['t_pink', 't_pink']);
    const [e1, e2] = st.tanks.filter((t) => t !== st.player);
    e1.protect = 0;
    e2.protect = 0;
    st.rng = () => 0;
    st.killTank(e1, 'test', { killer: st.player });
    check(st.ghosts.length === 1, 'Phase 3: Vorbedingung -- der erste Kill erzeugt keinen Geist');
    killGhost(st, st.ghosts[0]);
    st.ghosts = st.ghosts.filter((g) => g.alive);
    check(st.ghosts.length === 0, 'Phase 3: Vorbedingung -- der Geist ist nach killGhost() noch da');
    st.killTank(e2, 'test', { killer: st.player });
    check(st.ghosts.length === 1, 'Phase 3: nach dem Tod des ersten Geistes entsteht kein neuer mehr');
  }

  // (i) Raumwechsel entfernt alle Geister -- ueber die echte
  // createState()-Frischzelle, nicht nur behauptet.
  {
    const st1 = necroRoom();
    const e = st1.tanks.find((t) => t !== st1.player);
    e.protect = 0;
    st1.rng = () => 0;
    st1.killTank(e, 'test', { killer: st1.player });
    check(st1.ghosts.length === 1, 'Phase 3: Vorbedingung -- kein Geist im ersten Raum');
    const st2 = necroRoom(); // simuliert den naechsten Raum (frisches createState)
    check(st2.ghosts.length === 0, 'Phase 3: Geister ueberleben einen Raumwechsel');
  }

  // (j) Regressionsschutz, umgekehrt gegenueber dem alten ghost_tank-Stand:
  // der geerbte Typ bleibt ein GANZ NORMALER, weiterhin kaufbarer Gegnertyp
  // (Typ-Vererbung sperrt keinen Gegnertyp) -- ein Geist steckt aber
  // trotzdem nie in state.tanks (zaehlt nicht gegen limits.enemiesAlive).
  {
    check(!!diffData.danger?.t_pink, 'Phase 3: t_pink ist trotz Typ-Vererbung kein purchasable Gegner mehr');
    const st = necroRoom();
    const e = st.tanks.find((t) => t !== st.player);
    e.protect = 0;
    st.rng = () => 0;
    st.killTank(e, 'test', { killer: st.player });
    check(
      !st.tanks.includes(st.ghosts[0]),
      'Phase 3: ein Geist steckt in state.tanks (wuerde gegen limits.enemiesAlive zaehlen)',
    );
  }

  // (k) Geisterbombe: der Zufallstyp kommt WIRKLICH aus dem Akt-Gegnerpool --
  // mit zwei verschiedenen rng-Werten beide Pool-Eintraege einzeln erzwungen.
  {
    const pool = ['t_grey', 't_yellow'];
    const st1 = necroRoom(['t_pink'], pool);
    st1.rng = () => 0; // erster Pool-Eintrag
    useSecondary(st1.player, st1, null);
    check(st1.ghosts[0]?.type === 't_grey', `Phase 3: Geisterbombe mit rng=>0 erzeugt ${st1.ghosts[0]?.type} statt t_grey`);

    const st2 = necroRoom(['t_pink'], pool);
    st2.rng = () => 0.99; // zweiter Pool-Eintrag
    useSecondary(st2.player, st2, null);
    check(st2.ghosts[0]?.type === 't_yellow', `Phase 3: Geisterbombe mit rng=>0.99 erzeugt ${st2.ghosts[0]?.type} statt t_yellow`);
  }

  // (l) Geisterbombe: ein leerer/fehlender Akt-Gegnerpool verweigert den
  // Wurf nicht, sondern faellt auf t_brown zurueck (statt abzustuerzen oder
  // stillschweigend nichts zu erzeugen).
  {
    const st = necroRoom(['t_pink'], []);
    useSecondary(st.player, st, null);
    check(st.ghosts[0]?.type === 't_brown', `Phase 3: Geisterbombe mit leerem Akt-Gegnerpool erzeugt ${st.ghosts[0]?.type} statt des Rueckfalls t_brown`);
  }

  // (m) Champion (Nachschliff: STICKY statt dynamisch -- Abschnitt 2.1 des
  // Auftrags verbietet ausdruecklich, einen lebenden Champion allein wegen
  // eines Staerkevergleichs zu ersetzen). ensureChampion() befoerdert den
  // staerksten (nach strengthWeights, synthetisch: reines hp-Gewicht) nur,
  // wenn NOCH KEIN Champion existiert -- danach bleibt der Titel bestehen,
  // auch wenn ein anderer Untertan spaeter staerker wird.
  {
    const orig = { ...tanksData.balance.ghost.strengthWeights };
    tanksData.balance.ghost.strengthWeights = { hp: 1, damage: 0 };
    try {
      const st = necroRoom();
      const gSchwach = createGhost(st, 0, 0, 0, 't_pink');
      gSchwach.hp = 10;
      const gStark = createGhost(st, 10, 10, 0, 't_pink');
      gStark.hp = 500;
      st.ghosts.push(gSchwach, gStark);
      updateGhosts(st, 0); // dt=0: keine Bewegung/Schuss, nur die EINMALIGE Befoerderung
      check(gStark.isChampion === true, 'Phase 3: der staerkere Untertan ist nicht Champion (Ersterzeugung)');
      check(gSchwach.isChampion === false, 'Phase 3: der schwaechere Untertan ist faelschlich Champion');

      // Faellt der Champion unter den anderen, bleibt der Titel TROTZDEM bei
      // ihm -- Sticky-Regel, kein dynamischer Vergleich mehr.
      gStark.hp = 1;
      gSchwach.hp = 999;
      updateGhosts(st, 0);
      check(gStark.isChampion === true, 'Phase 3: der alte Champion verliert den Titel trotz Staerkeverlust (waere ein dynamischer Vergleich)');
      check(gSchwach.isChampion === false, 'Phase 3: der staerkere Nicht-Champion wird faelschlich zum neuen Champion befoerdert');
    } finally {
      tanksData.balance.ghost.strengthWeights = orig;
    }
  }

  // (m2) Champion-Gleichstand bei der EINMALIGEN Befoerderung: gewinnt der
  // AELTERE (Erzeugungsreihenfolge), ein gleich starker JUENGERER Untertan
  // verdraengt ihn nicht (striktes '>').
  {
    const st = necroRoom();
    const alt = createGhost(st, 0, 0, 0, 't_pink');
    alt.hp = 100;
    alt.cfg.damage = 5;
    const jung = createGhost(st, 10, 10, 0, 't_pink');
    jung.hp = 100;
    jung.cfg.damage = 5; // exakter Gleichstand
    st.ghosts.push(alt, jung);
    updateGhosts(st, 0);
    check(alt.isChampion === true, 'Phase 3: bei Gleichstand gewinnt nicht der AELTERE Untertan');
    check(jung.isChampion === false, 'Phase 3: bei Gleichstand wird der JUENGERE Untertan faelschlich Champion');
  }

  // (m3) Nachschliff-Kernpunkt 2.1 explizit End-to-End: ein bereits lebender
  // Champion wird durch einen NEU ANKOMMENDEN, viel staerkeren Untertan
  // NICHT abgeloest (ensureChampion() greift nur, solange KEIN Champion lebt).
  {
    const st = necroRoom();
    const first = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, first);
    check(first.isChampion, 'Phase 3 (m3): Vorbedingung -- der erste Untertan ist nicht Champion');
    const stronger = createGhost(st, 10, 10, 0, 't_pink');
    stronger.hp = 999999;
    stronger.cfg.maxHp = 999999;
    stronger.cfg.damage = 999999;
    pushGhost(st, stronger);
    check(first.isChampion === true, 'Phase 3 (m3): der bestehende Champion verliert den Titel an einen staerkeren Neuankoemmling');
    check(stronger.isChampion === false, 'Phase 3 (m3): ein neu ankommender, staerkerer Untertan wird faelschlich sofort Champion');
  }

  // (n) Elite-Wiederbelebung, End-to-End (Champion-/Nekromant-Nachschliff
  // Abschnitt 12, ANGEPASST -- Eliten sind seither GENERELL wiederbelebbar):
  // ein Elite-Kill erzeugt einen Untertan, der strukturell 2 Geisterplaetze
  // belegt (slotCost), UNABHAENGIG davon, ob er zufaellig als erster Spawn
  // selbst zum (platzlosen) Champion wird. Ein zweiter, regulaerer Kill im
  // selben Raum ist von alldem unbeeinflusst.
  {
    const st = necroRoom(['t_pink', 't_pink']);
    const [eElite, eNormal] = st.tanks.filter((t) => t !== st.player);
    eElite.affixes = ['twinshot'];
    eNormal.protect = 0;
    st.rng = () => 0;
    st.killTank(eElite, 'test', { killer: st.player });
    check(st.ghosts.length === 1, 'Abschnitt 65 (Nachschliff 12): der Elite-Kill erzeugt keinen Untertan');
    check(st.ghosts[0].slotCost === 2, `Abschnitt 65 (Nachschliff 12): der Elite-Untertan belegt ${st.ghosts[0].slotCost} statt 2 Geisterplaetze`);
    st.killTank(eNormal, 'test', { killer: st.player });
    check(st.ghosts.length === 2, 'Phase 3: ein regulaerer Kill im selben Raum erzeugt keinen weiteren Untertan');
    check(st.ghosts[1].slotCost === 1, `Abschnitt 65 (Nachschliff 12): der regulaere Untertan belegt ${st.ghosts[1].slotCost} statt 1 Geisterplatz`);
  }

  // (o) Renderpfad: der neue Lebensdauer-Ring + der wiederverwendete
  // Champion-Ring werden ueber den ECHTEN renderer.js: render() gezeichnet,
  // nicht nur behauptet -- derselbe blinde Fleck, der beim Ziellinien-Crash
  // und beim P6-Bombenwurf schon einmal zuschlug (renderer.js wurde in der
  // Node-Suite bis dahin nie fuer diesen Zweig ausgefuehrt).
  {
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    try {
      const { createRenderer } = await import('../src/render/renderer.js');
      const { createTracks } = await import('../src/render/tracks.js');
      const ctx = document.createElement('canvas').getContext('2d');
      const renderer = createRenderer(ctx);
      const tracks = createTracks();
      const st = necroRoom();
      const g = createGhost(st, 100, 100, 0, 't_pink');
      g.isChampion = true;
      st.ghosts.push(g);
      const arcCallsFor = () => {
        ctx.calls.length = 0;
        renderer.render(st, 0, tracks, null, null);
        return ctx.calls.filter((c) => c.fn === 'stroke').length;
      };
      const mitChampion = arcCallsFor();
      g.isChampion = false;
      const ohneChampion = arcCallsFor();
      check(
        mitChampion > ohneChampion,
        `Phase 3: der Champion-Ring erscheint nicht im echten Renderpfad (${mitChampion} vs. ${ohneChampion} stroke()-Aufrufe)`,
      );
    } catch (e) {
      check(false, `Phase 3: der Geister-Renderpfad wirft (${e.message})`);
    } finally {
      restore();
    }
  }
}

// ---- 44. Upgradepool-v2 Phase 8: Signaturtopf Nekromant (18 Karten) -- archiviert
// Struktur/Filter/Applier-Arithmetik + Mechanismus-Nachweise (Rudelbonus,
// Seelensog, Seelenketten, Letzter Wille, Wiederkehr-Familie, Geister-
// kommandant, Phylakterium, NaN/Infinity-Check) fuer die 18 sig_necro_*-
// Karten. Mit Grundsteinumbau Phase 4 ist der gesamte Signaturpool nach
// archive/upgrades-v1.json ausgelagert (data/upgrades.json: 5-Karten-
// Sockel) -- jede dieser Pruefungen waere seitdem strukturell rot. Die
// zugrundeliegende Geistereinheit (ghost.js: resolveGhostCfg()) ist mit
// Nekromant-V2 Phase 3 grundlegend neu gebaut (Typ-Vererbung statt fester
// ghost_tank-Basis, s. Abschnitt 43) -- die 16 ghost*-core-Schluessel in
// cfg.js selbst sind ohne eine Karte, die sie setzt, weiterhin unerreichbar.
// Details/Wiederanschlusspunkt: ARCHIV.md, archive/upgrades-v1.json.


// ---- 45. Upgradepool-v2 Phase 9: Schlussabnahme -------------------------
// Die Abnahme des ganzen Nekromant-Auftrags. Bewusst NUR die Punkte, die in
// den Abschnitten 34/37-44 noch NICHT abgedeckt sind -- die uebrigen sind
// dort mit eigener Gegenprobe gebaut und werden hier nicht dupliziert:
//   Punkt 1  -> 42(a)      Punkt 5  -> 42(e)/44(c)   Punkt 6  -> 43(i)
//   Punkt 8  -> 43(c)(d)   Punkt 14 -> 41(l)         Punkt 16 -> 41(g)
//   Punkt 17 -> 41(i)      Punkt 18 -> je Signaturtopf (b)
//   Punkt 22 -> 39         Punkt 23 -> 36(b)         Punkt 25 -> Abschnitt 4
// Neu sind hier: die statistische Spawnquote (2), der Boss-Kill (3), das
// Limit mit ID-Vergleich (4), Wiederbelebung nur mit Upgrade (7), das
// Zielsystem end-to-end (9-11), der BOSSKAMPF-KORRIDOR (12/13/15) und die
// vier Pipeline-Invarianten (19/20/21/24).
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createGhost, updateGhosts, killGhost, occupiedGhostSlots, pushGhost } = await import('../src/game/ghost.js');
  const { stepMirrorBoss } = await import('../src/game/bossai.js');
  const { updateTargeting, resolveTarget } = await import('../src/game/ai.js');
  const { resolveCfg, applyUpgrades } = await import('../src/game/cfg.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { hashSeed, rngFor, mulberry32 } = await import('../src/core/rng.js');
  const U = upgradesData.upgrades;
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  const necroRoom = (types = ['t_pink'], extra = {}) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(3, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(3, 3, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
      ...extra,
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    return st;
  };
  const arenaRoom = (types, layout) =>
    necroRoom(types, { roomSpec: { fixedLayout: layout }, arenas: tanksData.arenas });

  // === GEISTERPANZER ====================================================

  // (a) Punkt 2 (ueberholt durch Nekromant-V2 Phase 3): die alte, zweistufige
  // spawnChance.necro/.ghost (50 %/33 %) ist durch EINE einheitliche
  // reviveChance ersetzt (s. archive/ghost-tank-v1.json) -- die Spawnquote
  // ist deshalb nicht nur an der Schwelle richtig (das prueft 42(b) mit
  // gestelltem rng), sondern auch STATISTISCH ueber viele Kills mit einem
  // echten geseedeten Strom fuer BEIDE Killer-Arten identisch. Bewusst
  // gegen den echten balance.json-Sollwert gemessen -- eine Balance-
  // Aenderung SOLL diesen Test mitziehen.
  {
    const N = 3000;
    const TOLERANZ = 0.04; // 4 Prozentpunkte -- deckt die Streuung bei N=3000
    const quote = (killerArt) => {
      const rng = mulberry32(4711); // fester Seed
      // EIN Raum, der Gegner wird je Durchgang wiederbelebt -- 3000 volle
      // createState()-Aufrufe wuerden die Suite um Sekunden verlaengern,
      // ohne der Messung etwas hinzuzufuegen (gemessen wird der Wurf in
      // killTank(), nicht der Raumbau).
      const st = necroRoom();
      st.rng = rng;
      const e = st.tanks.find((t) => t !== st.player);
      const killer = killerArt === 'necro' ? st.player : { isGhost: true, alive: true };
      let spawns = 0;
      for (let i = 0; i < N; i++) {
        st.ghosts.length = 0; // Limit darf die Messung nie deckeln
        e.alive = true;
        e.hp = e.cfg.maxHp;
        e.protect = 0;
        st.killTank(e, 'test', { killer });
        if (st.ghosts.length > 0) spawns++;
      }
      return spawns / N;
    };
    const soll = tanksData.balance.ghost.reviveChance;
    const qn = quote('necro');
    const qg = quote('ghost');
    check(
      Math.abs(qn - soll) <= TOLERANZ,
      `Phase 3: Nekromant-Spawnquote ${(qn * 100).toFixed(1)} % statt ${(soll * 100).toFixed(0)} % (${N} Kills)`,
    );
    check(
      Math.abs(qg - soll) <= TOLERANZ,
      `Phase 3: Geist-Kill-Spawnquote ${(qg * 100).toFixed(1)} % statt der VEREINHEITLICHTEN ${(soll * 100).toFixed(0)} % (${N} Kills)`,
    );
  }

  // (b) Punkt 3 (ueberholt durch Nekromant-V2 Phase 3): ein BOSS-Kill
  // erzeugt jetzt bewusst KEINEN Untertan mehr (Auftrag Abschnitt 3,
  // Elite-/Boss-Ausnahme -- das genaue Gegenteil der alten Anhang-B-Aussage
  // "Boss -> Geisterpanzer"). Mit einem echten Boss aus tanks.json statt nur
  // synthetisch aufgeblasenen LP.
  {
    const st = arenaRoom(['t_mirror'], 'boss_mirror');
    const boss = st.tanks.find((t) => t !== st.player);
    check(boss.cfg.maxHp >= 500, `Phase 3: Vorbedingung -- Boss hat nur ${boss.cfg.maxHp} LP`);
    check(!!boss.cfg.mirrorBoss, 'Phase 3: Vorbedingung -- der Testboss traegt kein Boss-Flag (isBossCfg wuerde ihn nicht erkennen)');
    boss.protect = 0;
    st.rng = () => 0; // garantierter Spawnwurf -- waere ohne die Ausnahme immer ein Treffer
    st.killTank(boss, 'test', { killer: st.player });
    check(st.ghosts.length === 0, `Phase 3: ein Boss-Kill erzeugt trotzdem ${st.ghosts.length} Untertan(en)`);
  }

  // (c) Punkt 4: am Limit wird NICHTS verdraengt -- die Geist-IDs vor und
  // nach einem weiteren garantierten Kill sind identisch. 42(c) prueft nur
  // die ANZAHL (die bliebe auch bei einer FIFO-Verdraengung gleich!), was
  // genau den Fehler durchlassen wuerde, den Anhang B S5 verbietet.
  // Nachschliff ("Champion zaehlt NIE gegen das Limit"): der ERSTE der
  // Kills wird selbst Champion und belegt keinen der `cap` gewoehnlichen
  // Plaetze -- das Limit ist deshalb erst nach `cap + 1` Kills wirklich
  // erreicht (1 Champion + cap Gewoehnliche), nicht schon nach `cap`.
  {
    const cap = tanksData.balance.ghost.maxActive ?? 3;
    const st = necroRoom(Array(cap + 2).fill('t_pink'));
    st.rng = () => 0; // garantierter Wurf
    const gegner = st.tanks.filter((t) => t !== st.player);
    for (const e of gegner) e.protect = 0;
    for (let i = 0; i < cap + 1; i++) st.killTank(gegner[i], 'test', { killer: st.player });
    check(st.ghosts.length === cap + 1, `Phase 9: Vorbedingung -- ${st.ghosts.length} statt ${cap + 1} Untertanen (Champion + Limit)`);
    check(occupiedGhostSlots(st) === cap, `Phase 9: Vorbedingung -- belegte Plaetze ${occupiedGhostSlots(st)} statt ${cap}`);
    const idsVorher = st.ghosts.map((g) => g.id);
    st.killTank(gegner[cap + 1], 'test', { killer: st.player }); // weiterer Kill am Limit
    const idsNachher = st.ghosts.map((g) => g.id);
    check(st.ghosts.length === cap + 1, `Phase 9: das Geistlimit wird ueberschritten (${st.ghosts.length})`);
    check(
      idsVorher.join(',') === idsNachher.join(','),
      `Phase 9: am Limit wurde ein Geist verdraengt (vorher ${idsVorher}, nachher ${idsNachher})`,
    );
  }

  // (d) Punkt 7: die Wiederbelebung greift NUR mit aktivem Upgrade. 44(h)
  // prueft den Erfolgsfall MIT Karte -- ohne diesen Gegenpart waere eine
  // versehentlich immer aktive Wiederbelebung unbemerkt geblieben (Anhang B
  // S12/S17: "eine Wiederbelebung kann nur stattfinden, wenn ein
  // entsprechendes Upgrade vorhanden ist").
  {
    const st = necroRoom();
    st.rng = () => 0; // ein Wurf, der MIT Karte immer gelingen wuerde
    const ohne = createGhost(st, 0, 0);
    st.ghosts.push(ohne);
    ohne.hp = 0;
    killGhost(st, ohne);
    check(ohne.alive === false, 'Phase 9: ein Geist wird OHNE Wiederkehr-Karte wiederbelebt');

    // Kontrolle: mit gesetztem ghostReviveChance gelingt derselbe Wurf --
    // sonst waere der Test oben trivial wahr. Grundsteinumbau Phase 4: die
    // Karte 'sig_necro_wiederkehr', die dieses Feld sonst setzt, ist mit dem
    // 251-Karten-Pool archiviert (ARCHIV.md) -- der Mechanismus in ghost.js:
    // tryReviveGhost() bleibt unangetastet, deshalb direkt ueber das cfg-Feld
    // geprueft statt ueber die Karte.
    const st2 = necroRoom();
    st2.player.cfg = resolveCfg(tanksData, 'c_necro');
    st2.player.cfg.ghostReviveChance = 1;
    st2.rng = () => 0;
    const mit = createGhost(st2, 0, 0);
    st2.ghosts.push(mit);
    mit.hp = 0;
    killGhost(st2, mit);
    check(mit.alive === true, 'Phase 9: Kontrolle -- die Wiederkehr-Karte belebt nicht wieder');
  }

  // === ZIELSYSTEM =======================================================

  // (e) Punkt 9: ein Gegner mit freier Sicht auf einen Geist waehlt ihn und
  // TRIFFT ihn auch -- end-to-end ueber die volle stepState()-Pipeline
  // (Zielwahl -> Turm -> Schuss -> Kollision), nicht nur resolveTarget().
  {
    const st = arenaRoom(['t_pink'], 'test_arena');
    const e = st.tanks.find((t) => t !== st.player);
    e.x = 400; e.y = 48; e.prevX = 400; e.prevY = 48;
    e.cfg.accuracy = 1; // deterministisch: kein Zielfehler-Jitter
    st.player.x = 120; st.player.y = 240; st.player.prevX = 120; st.player.prevY = 240;
    // Nachschliff ("Champion muss ein eigenstaendiger Geisterpanzer sein"):
    // ein solo gepushter Geist wuerde sofort selbst zum Champion befoerdert
    // und seine kuenstlich hohen 99999 LP verloeren (Champion-Basiswerte
    // kommen IMMER aus championStatPct * Spielerwerten). Ein zuerst per
    // pushGhost() gesetzter Anker haelt den Champion-Titel, damit g selbst
    // gewoehnlich bleibt und seine 99999 LP fuer diesen Test erhalten bleiben.
    const anchor = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, anchor);
    const g = createGhost(st, 250, 48); // nah + freie Sicht in derselben Zeile
    g.cfg.maxHp = 99999;
    g.hp = 99999;
    st.ghosts.push(g);
    const vorHp = g.hp;
    for (let i = 0; i < 60 * 6; i++) stepState(st, CMD0, 1 / 60);
    check(resolveTarget(e, st) === g, 'Phase 9: der Gegner waehlt den nahen, frei sichtbaren Geist nicht');
    check(g.hp < vorHp, `Phase 9: der Gegner trifft den gewaehlten Geist nie (${g.hp} von ${vorHp} LP)`);
  }

  // (f) Punkt 10: ein Geist stirbt bei 0 LP und zaehlt danach NICHT mehr
  // gegen das Limit -- der volle Kreis aus (c): am Limit passiert nichts,
  // nach einem Tod aber wieder.
  {
    const st = necroRoom(['t_pink', 't_pink', 't_pink', 't_pink']);
    st.rng = () => 0;
    const gegner = st.tanks.filter((t) => t !== st.player);
    for (const e of gegner) e.protect = 0;
    for (let i = 0; i < 3; i++) st.killTank(gegner[i], 'test', { killer: st.player });
    check(st.ghosts.length === 3, 'Phase 9: Vorbedingung -- Limit nicht erreicht');
    // Einen Geist auf 0 LP bringen und die Aufraeumrunde laufen lassen.
    st.ghosts[0].hp = 0;
    updateGhosts(st, 1 / 60);
    check(st.ghosts.length === 2, `Phase 9: ein Geist mit 0 LP bleibt aktiv (${st.ghosts.length})`);
    st.killTank(gegner[3], 'test', { killer: st.player });
    check(st.ghosts.length === 3, 'Phase 9: nach dem Tod eines Geistes zaehlt der Platz nicht wieder frei');
  }

  // (g) Punkt 11: Geister zaehlen NICHT in die Raum-geraeumt-Pruefung.
  // Sonst waere jeder Nekromanten-Raum unbeendbar -- die Pruefung in
  // run.js zaehlt state.tanks, Geister leben in state.ghosts. Ueber den
  // ECHTEN stepRun()-Pfad geprueft, nicht ueber die Datenstruktur.
  {
    // 6. Parameter ist modeKey, opts erst der 7. -- ein `{starterTank}` an
    // 6. Stelle landet still im modeKey und die Klasse bleibt 'player'
    // (beim Schreiben dieses Tests genau so passiert; der Test war dadurch
    // gruen, ohne je einen Nekromanten-Run gebaut zu haben).
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42, 'normal', { starterTank: 'c_necro' });
    check(run.starterTank === 'c_necro', `Phase 9: Vorbedingung -- Run laeuft als ${run.starterTank} statt c_necro`);
    run.phase = 'playing';
    const st = run.state;
    for (const t of st.tanks) if (t !== st.player) t.alive = false;
    st.pendingWave = null;
    for (let i = 0; i < 3; i++) st.ghosts.push(createGhost(st, 100 + i * 20, 100));
    check(st.ghosts.length === 3, 'Phase 9: Vorbedingung -- keine Geister im Raum');
    const vorher = run.roomsCleared;
    stepRun(run, CMD0, 1 / 60);
    check(
      run.roomsCleared === vorher + 1,
      `Phase 9: der Raum gilt trotz toter Gegner nicht als geraeumt (Geister blockieren ihn), roomsCleared ${run.roomsCleared}`,
    );
  }

  // === BOSSKAMPF-KORRIDOR ===============================================
  // Der eigentliche Balance-Test (Auftrag Punkte 12/13): ein Bosskampf mit
  // drei lebenden Geistern, Bossschuesse nach Ziel gezaehlt. Zwei Schranken
  // in BEIDE Richtungen -- "ein Test, der nur nach oben absichert, erzeugt
  // genau den Fehler, an dem Beschwoererklassen in anderen Spielen
  // scheitern".
  {
    // Misst die Verteilung der Bossschuesse bei einem gegebenen
    // Fixierungsfenster. Geschosse werden nach dem Zaehlen entfernt und die
    // Geister auf volle LP gesetzt: gemessen wird die ZIELVERTEILUNG ueber
    // die Zeit, nicht wer den Kampf gewinnt -- ein sterbender Geist wuerde
    // die Stichprobe sonst mitten im Lauf verkuerzen.
    const messen = (fixate) => {
      const orig = tanksData.balance.boss.fixate;
      tanksData.balance.boss.fixate = fixate;
      try {
        const st = arenaRoom(['t_mirror'], 'boss_mirror');
        const boss = st.tanks.find((t) => t !== st.player);
        for (let i = 0; i < 3; i++) {
          const g = createGhost(st, boss.x - 60 + i * 30, boss.y + 60);
          g.cfg.maxHp = 99999;
          g.hp = 99999;
          st.ghosts.push(g);
        }
        let aufSpieler = 0;
        let aufGeist = 0;
        const dt = 1 / 60;
        for (let i = 0; i < 60 * 60; i++) { // 60 simulierte Sekunden
          st.time += dt;
          boss.cooldown = Math.max(0, boss.cooldown - dt);
          const vor = st.bullets.length;
          stepMirrorBoss(boss, st, dt);
          if (st.bullets.length > vor) {
            if (boss.ai.target === st.player) aufSpieler++;
            else aufGeist++;
          }
          st.bullets.length = 0;
          for (const g of st.ghosts) g.hp = 99999;
        }
        return { aufSpieler, aufGeist, total: aufSpieler + aufGeist };
      } finally {
        tanksData.balance.boss.fixate = orig;
      }
    };

    // (h) Punkt 12, Mechanismus mit EIGENEN Zahlen: das Fixierungsfenster
    // treibt den Spieleranteil. Zwei synthetische Fenster (75 % / 25 %
    // erzwungen) muessen sich in der Messung deutlich unterscheiden und
    // jeweils mindestens ihren eigenen erzwungenen Anteil erreichen --
    // die aktuellen balance.json-Werte gegen sich selbst zu pruefen waere
    // trivial wahr.
    {
      const hoch = messen({ onPlayerS: 6, onGhostsS: 2, minPlayerShare: 0.4 });
      const niedrig = messen({ onPlayerS: 2, onGhostsS: 6, minPlayerShare: 0.4 });
      check(hoch.total > 100 && niedrig.total > 100, `Phase 9: zu kleine Stichprobe (${hoch.total}/${niedrig.total} Schuesse)`);
      const aHoch = hoch.aufSpieler / hoch.total;
      const aNiedrig = niedrig.aufSpieler / niedrig.total;
      // Untergrenze je Fenster: der erzwungene Anteil ist ein Minimum (in
      // der freien Phase KANN der Boss den Spieler zusaetzlich waehlen).
      check(aHoch >= 6 / 8 - 0.05, `Phase 9: 75-%-Fenster liefert nur ${(aHoch * 100).toFixed(1)} % Spielerschuesse`);
      check(aNiedrig >= 2 / 8 - 0.05, `Phase 9: 25-%-Fenster liefert nur ${(aNiedrig * 100).toFixed(1)} % Spielerschuesse`);
      check(
        aHoch - aNiedrig > 0.3,
        `Phase 9: das Fixierungsfenster steuert den Spieleranteil nicht (${(aHoch * 100).toFixed(1)} % vs. ${(aNiedrig * 100).toFixed(1)} %)`,
      );
    }

    // (i) Punkte 12+13 an der ECHTEN Konfiguration -- die beiden
    // Korridorgrenzen des Auftrags:
    //   Untergrenze gegen Trivialisierung: deutlich ueber die Haelfte der
    //     Bossschuesse gilt weiterhin dem Spieler.
    //   Obergrenze gegen Wertlosigkeit: die Geister fangen einen messbaren
    //     Anteil ab.
    // Beide Schranken sind ABSICHTLICH gegen feste Zahlen (0.55/0.10)
    // gesetzt und nicht aus balance.json abgeleitet: sie sind die
    // Design-Zusage, an der eine kuenftige Balance-Aenderung gemessen
    // werden SOLL.
    {
      const echt = messen(tanksData.balance.boss.fixate);
      check(echt.total > 100, `Phase 9: zu kleine Stichprobe im echten Bosskampf (${echt.total})`);
      const anteilSpieler = echt.aufSpieler / echt.total;
      const anteilGeist = echt.aufGeist / echt.total;
      check(
        anteilSpieler > 0.55,
        `Phase 9 (Untergrenze/Trivialisierung): nur ${(anteilSpieler * 100).toFixed(1)} % der Bossschuesse gelten dem Spieler`,
      );
      check(
        anteilGeist >= 0.1,
        `Phase 9 (Obergrenze/Wertlosigkeit): die Geister ziehen nur ${(anteilGeist * 100).toFixed(1)} % der Bossschuesse -- sie sind im Bosskampf wertlos`,
      );
    }
  }

  // (j) Punkt 15: kein Zielflackern. Ein Geist oszilliert dicht um die
  // effektive Gleichstandsgrenze zum Spieler; die Hysterese muss die
  // Zielwechsel praktisch auf null druecken. Gegen ein Szenario geprueft,
  // das OHNE Hysterese nachweislich flackert -- sonst waere der Test
  // trivial wahr (ein statisches Szenario flackert auch ohne Hysterese nie).
  {
    const flackern = (hyst) => {
      const orig = tanksData.balance.aggro.switchHysteresisPct;
      tanksData.balance.aggro.switchHysteresisPct = hyst;
      try {
        const st = arenaRoom(['t_pink'], 'test_arena');
        const e = st.tanks.find((t) => t !== st.player);
        e.x = 400; e.y = 48; e.prevX = 400; e.prevY = 48;
        st.player.x = 200; st.player.y = 48; st.player.prevX = 200; st.player.prevY = 48;
        // Spieler 200 px entfernt; ghostThreatMult 0.7 -> ein Geist gewinnt
        // ab < 140 px. Genau um diese Grenze pendeln lassen.
        const g = createGhost(st, 400 - 140, 48);
        g.cfg.maxHp = 9999;
        g.hp = 9999;
        st.ghosts.push(g);
        let wechsel = 0;
        let letztes = null;
        const dt = 1 / 60;
        const SEK = 30;
        for (let i = 0; i < 60 * SEK; i++) {
          const t = i * dt;
          g.x = 400 - 140 + Math.sin(t * 5) * 25;
          g.prevX = g.x;
          st.time += dt;
          updateTargeting(st, dt);
          const ziel = resolveTarget(e, st);
          if (letztes !== null && ziel !== letztes) wechsel++;
          letztes = ziel;
        }
        return wechsel / SEK;
      } finally {
        tanksData.balance.aggro.switchHysteresisPct = orig;
      }
    };
    const mit = flackern(tanksData.balance.aggro.switchHysteresisPct);
    const ohne = flackern(0);
    check(ohne > 1, `Phase 9: Testaufbau -- das Szenario flackert auch ohne Hysterese kaum (${ohne.toFixed(2)}/s)`);
    check(mit <= 0.2, `Phase 9: Zielflackern ${mit.toFixed(2)} Wechsel/s trotz Hysterese`);
  }

  // === PIPELINE =========================================================
  // Punkte 19/20/21: die drei Angebots-Invarianten ueber viele echte
  // Angebotsrunden. Bewusst als DURCHGESPIELTE Runs (gewaehlte Karten
  // sammeln sich in `chosen`/`synergyTags` an), nicht als Einzelabfragen --
  // isUnique und requires koennen ihre Wirkung erst zeigen, wenn ein Run
  // ueberhaupt Karten besitzt.
  // Nekromant-V2 Phase 1: Punkt 19 pruefte urspruenglich `d.maxStacks` -- seit
  // maxStacks ersatzlos abgeschafft ist (jede Karte hat stattdessen
  // isUnique), waere `chosen[o.id] >= d.maxStacks` mit `d.maxStacks ===
  // undefined` fuer JEDE reale Karte permanent falsch und damit ein trivial
  // gruener Test (genau die Falle aus CLAUDE.md: "den Mechanismus mit
  // eigenen Zahlen pruefen, nicht die aktuelle Datenlage"). Ersetzt durch
  // die aktuelle Invariante: eine isUnique-Karte darf nie ein zweites Mal
  // angeboten werden, nachdem sie einmal gewaehlt wurde.
  {
    let vMax = 0;
    let vReq = 0;
    let vDup = 0;
    let runden = 0;
    let gezogen = 0;
    for (const klass of ['c_necro', 'player', 'c_flame', 'c_ricochet']) {
      for (let seed = 1; seed <= 40; seed++) {
        const rng = mulberry32(seed * 977);
        const chosen = {};
        const synergyTags = {};
        for (let raum = 1; raum <= 16; raum++) {
          const offers = rollOffers(upgradesData, {
            chosen, roomIndex: raum, rng, balance: tanksData.balance, count: 3,
            banned: new Set(), starterTank: klass, synergyTags,
          });
          runden++;
          const ids = offers.filter((o) => !o.fallback).map((o) => o.id);
          if (new Set(ids).size !== ids.length) vDup++;
          for (const o of offers) {
            if (o.fallback) continue;
            gezogen++;
            const d = U[o.id];
            if (d.isUnique && (chosen[o.id] || 0) >= 1) vMax++;
            for (const r of d.requires || []) if (!(chosen[r] > 0)) vReq++;
          }
          const pick = offers.find((o) => !o.fallback);
          if (pick) {
            chosen[pick.id] = (chosen[pick.id] || 0) + 1;
            for (const t of U[pick.id].tags || []) synergyTags[t] = (synergyTags[t] || 0) + 1;
          }
        }
      }
    }
    check(runden > 2000 && gezogen > 5000, `Phase 9: zu kleine Pipeline-Stichprobe (${runden} Runden, ${gezogen} Karten)`);
    check(vMax === 0, `Phase 9 (Punkt 19): ${vMax}x eine einzigartige (isUnique) Karte erneut angeboten, obwohl sie schon gewaehlt war`);
    check(vReq === 0, `Phase 9 (Punkt 20): ${vReq}x eine Karte mit unerfuelltem requires angeboten`);
    check(vDup === 0, `Phase 9 (Punkt 21): ${vDup}x dieselbe Karte mehrfach im selben Angebot`);
  }

  // (k) Punkt 24: JEDE Karte des Pools (nicht nur die 18 neuen aus 44(o))
  // loest sich sauber in ein Spieler-cfg auf. Gegen die UPGRADE-LOSE Basis
  // derselben Klasse verglichen: `role`/`miner` sind bei jeder Spielerklasse
  // von Haus aus undefined -- ein pauschaler undefined-Test waere dadurch
  // dauerhaft rot und haette gar nichts geprueft.
  // Nekromant-V2 Phase 1: `chosen[id] = def.maxStacks` testete urspruenglich
  // die jeweils HOECHSTE erreichbare Stufe -- seit maxStacks abgeschafft ist,
  // waere das `undefined`, `applyUpgrades()` laese die Karte damit effektiv
  // als "nicht gewaehlt" (0 statt der hoechsten Stufe) und der Test haette
  // fuer JEDE Karte nur den No-op-Fall geprueft. Ersetzt durch einen festen
  // hohen Wert fuer nicht-einzigartige Karten (unbegrenzt stapelbar) bzw. 1
  // fuer isUnique-Karten (mehr kann es nie geben); requires-Ziele reichen
  // mit 1 (nur chosen[r] > 0 wird geprueft).
  {
    const basisCache = {};
    const basis = (k) => (basisCache[k] ||= applyUpgrades(resolveCfg(tanksData, k), {}, upgradesData, 'mine', null));
    let schlecht = 0;
    let geprueft = 0;
    for (const id in U) {
      const def = U[id];
      const chosen = { [id]: def.isUnique ? 1 : 20 };
      for (const r of def.requires || []) chosen[r] = 1;
      // Selbstschutz gegen einen genau HIER schon einmal aufgetretenen Fehler
      // (Nekromant-V2 Phase 1, Gegenprobe): ein undefiniertes chosen[id] wird
      // von applyUpgrades() als "nicht gewaehlt" gelesen und der Rest der
      // Schleife prueft dann klaglos gar nichts -- ohne diese Zeile bliebe
      // ein kuenftiger aehnlicher Bug (z. B. ein erneut entferntes Feld ohne
      // Ersatzwert) unbemerkt gruen.
      check(chosen[id] > 0, `Phase 9 (Punkt 24): Testaufbau -- chosen["${id}"] ist ${chosen[id]}, keine positive Stufe`);
      const klass = def.signatureClass || 'player';
      const b = basis(klass);
      const cfg = applyUpgrades(resolveCfg(tanksData, klass), chosen, upgradesData, 'mine', null);
      geprueft++;
      for (const k in cfg) {
        const v = cfg[k];
        if (typeof v === 'number' && !Number.isFinite(v)) {
          check(false, `Phase 9: Karte "${id}" macht cfg.${k} zu ${v}`);
          schlecht++;
        } else if (v === undefined && b[k] !== undefined) {
          check(false, `Phase 9: Karte "${id}" loescht cfg.${k} (undefined)`);
          schlecht++;
        }
      }
    }
    check(geprueft === Object.keys(U).length, `Phase 9: nur ${geprueft} von ${Object.keys(U).length} Karten geprueft`);
    check(schlecht === 0, `Phase 9 (Punkt 24): ${schlecht} cfg-Verletzung(en) durch Karten`);
  }
}

// ---- 46. Nekromant: Bomben-Cooldown + fester, gadgetloser Slot (Nutzerwunsch) --
// Drei Nutzer-Anforderungen: (1) die Geisterbombe darf hoechstens alle
// ghost.bombCooldownS (10 s) ausloesen, (2) der Bombenslot bleibt weiterhin
// permanent unaustauschbar (war schon architektonisch garantiert -- kein
// Code noetig, hier nur strukturell nachgewiesen), (3) alle Gadget-Karten
// (der zweite, sonst tauschbare Slot) sind fuer den Nekromanten
// ausgeschlossen -- sowohl beim Kartenangebot als auch im Shop-Kauf, der
// exclusions bisher nicht kannte.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { useSecondary, useGadget } = await import('../src/game/tank.js');
  const { buyShopSecondary } = await import('../src/game/run.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { mulberry32, hashSeed, rngFor } = await import('../src/core/rng.js');
  const { createHud } = await import('../src/ui/hud.js');
  const { occupiedGhostSlots } = await import('../src/game/ghost.js');
  const U = upgradesData.upgrades;
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  const necroRoom = (types = ['t_pink']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    return st;
  };

  // (a) Mechanismus statt Datenlage: die Abklingzeit kommt aus
  // balance.json (nicht hartkodiert 10) -- mit einem SYNTHETISCHEN Wert
  // geprueft, der vom echten Wert abweicht. Ein blockierter zweiter Wurf
  // erzeugt keinen zweiten Geist; nach Ablauf der Zeit ist die Bombe
  // wieder scharf.
  {
    const orig = tanksData.balance.ghost.bombCooldownS;
    tanksData.balance.ghost.bombCooldownS = 3;
    try {
      const st = necroRoom();
      check(useSecondary(st.player, st, null) === true, 'Nekromant-Bombe: erster Wurf schlaegt fehl');
      check(st.ghosts.length === 1, 'Nekromant-Bombe: erster Wurf erzeugt keinen Geist');
      check(
        Math.abs(st.player.ghostBombCooldown - 3) < 1e-9,
        `Nekromant-Bombe: Abklingzeit ${st.player.ghostBombCooldown} statt 3 (synthetischer Wert)`,
      );
      check(useSecondary(st.player, st, null) === false, 'Nekromant-Bombe: zweiter Wurf trotz Abklingzeit erfolgreich');
      check(st.ghosts.length === 1, 'Nekromant-Bombe: ein blockierter Wurf erzeugt trotzdem einen Geist');
      for (let i = 0; i < 179; i++) stepState(st, CMD0, 1 / 60); // knapp unter 3 s
      check(useSecondary(st.player, st, null) === false, 'Nekromant-Bombe: loest kurz VOR Ablauf schon wieder aus');
      stepState(st, CMD0, 1 / 60); // ueber die 3-s-Schwelle
      check(useSecondary(st.player, st, null) === true, 'Nekromant-Bombe: bleibt nach Ablauf der Abklingzeit gesperrt');
      check(st.ghosts.length === 2, 'Nekromant-Bombe: nach Ablauf entsteht kein zweiter Geist');
    } finally {
      tanksData.balance.ghost.bombCooldownS = orig;
    }
  }

  // (b) Ein Wurf am vollen Geistlimit startet KEINE Abklingzeit -- passend
  // zur bestehenden Regel "am Limit passiert nichts" (kein Verbrauch).
  // Nachschliff ("Champion zaehlt NIE gegen das Limit"): der erste Kill wird
  // selbst Champion, das Limit ist deshalb erst nach cap+1 Kills wirklich voll.
  {
    const cap = tanksData.balance.ghost.maxActive ?? 3;
    const st = necroRoom(Array(cap + 1).fill('t_pink'));
    st.rng = () => 0;
    for (const e of st.tanks.filter((t) => t !== st.player)) {
      e.protect = 0;
      st.killTank(e, 'test', { killer: st.player });
    }
    check(st.ghosts.length === cap + 1, `Nekromant-Bombe: Vorbedingung -- Limit nicht erreicht (${st.ghosts.length} statt ${cap + 1})`);
    check(occupiedGhostSlots(st) === cap, `Nekromant-Bombe: Vorbedingung -- belegte Plaetze ${occupiedGhostSlots(st)} statt ${cap}`);
    st.player.ghostBombCooldown = 0;
    check(useSecondary(st.player, st, null) === false, 'Nekromant-Bombe: loest am vollen Limit trotzdem aus');
    check(st.player.ghostBombCooldown === 0, 'Nekromant-Bombe: ein Wurf am Limit startet trotzdem eine Abklingzeit');
  }

  // (c) Rueckmeldung waehrend der Abklingzeit: derselbe Ton + gedimmte
  // Blitz wie beim gesperrten Schuss/Enterhaken-Fehlschuss (Muster P1).
  {
    const st = necroRoom();
    useSecondary(st.player, st, null); // startet die Abklingzeit
    st.blockedShotTimer = 0; // Debounce-Rest aus dem ersten Wurf loeschen
    st.sounds.length = 0;
    st.flashes.length = 0;
    const nochmal = useSecondary(st.player, st, null);
    check(nochmal === false, 'Nekromant-Bombe: Vorbedingung -- zweiter Wurf war nicht blockiert');
    check(
      st.sounds.some((s) => (s?.name || s) === 'empty'),
      'Nekromant-Bombe: waehrend der Abklingzeit gibt es keinen Ton',
    );
    check(st.flashes.some((f) => f.dim), 'Nekromant-Bombe: waehrend der Abklingzeit gibt es keinen gedimmten Blitz');
  }

  // (d)+(e) Struktur/Pool: Grundsteinumbau Phase 4 hat den 251-Karten-Pool
  // vollstaendig archiviert (ARCHIV.md) -- damit sind auch alle fuenf
  // Gadget-Karten (emp_mine/hook/deflector/smoke/trap_wall) weg, die diese
  // exclusions urspruenglich am echten Datensatz belegten. Der Filter selbst
  // (upgradepool.js: buildCandidates(), exclusions-Zweig) bleibt unangetastet
  // gebaut -- deshalb hier mit einer SYNTHETISCHEN Gadget-Karte geprueft.
  {
    const fakeUpgrades = {
      offersPerScreen: 3,
      upgrades: {
        ...upgradesData.upgrades,
        test_gadget: {
          id: 'test_gadget', name: 'Testgadget', description: 'x', tag: 'gadget',
          rarity: 'common', maxStacks: 1, requires: [], minRoom: 1, exclusions: ['c_necro'], core: {},
        },
      },
    };
    check(!!fakeUpgrades.upgrades.test_gadget.exclusions.includes('c_necro'), 'Testaufbau: exclusions fehlt am Testgadget');
    const sieht = (klass) => {
      const rng = mulberry32(555);
      for (let i = 0; i < 800; i++) {
        const offers = rollOffers(fakeUpgrades, {
          chosen: {}, roomIndex: 10, rng, balance: tanksData.balance, count: 3,
          banned: new Set(), starterTank: klass,
        });
        if (offers.some((o) => o.tag === 'gadget')) return true;
      }
      return false;
    };
    check(!sieht('c_necro'), 'Nekromant sieht trotz exclusions eine Gadget-Karte im Angebot');
    check(sieht('player'), 'Kontrolle: die Standardklasse sieht nie eine Gadget-Karte (Testaufbau falsch)');
  }

  // (f) Shop: buyShopSecondary() sperrt den Gadget-Kauf fuer den
  // Nekromanten (zweiter Codepfad, den exclusions nicht abdeckt) --
  // andere Klassen bleiben unveraendert kaufberechtigt.
  {
    const runNecro = createRun(tanksData, tilesData, diffData, upgradesData, 1, 'normal', { starterTank: 'c_necro' });
    runNecro.phase = 'workshop';
    runNecro.scrap = 999;
    check(buyShopSecondary(runNecro, 'hook') === false, 'Shop: der Nekromant kann ein Gadget kaufen');
    check(runNecro.equippedGadget === null, 'Shop: equippedGadget wurde trotz Sperre gesetzt');
    check(runNecro.scrap === 999, 'Shop: der gesperrte Kauf hat trotzdem Schrott gekostet');

    const runAndere = createRun(tanksData, tilesData, diffData, upgradesData, 1, 'normal', { starterTank: 'player' });
    runAndere.phase = 'workshop';
    runAndere.scrap = 999;
    check(buyShopSecondary(runAndere, 'hook') === true, 'Kontrolle: eine andere Klasse kann kein Gadget mehr kaufen');
    check(runAndere.equippedGadget === 'hook', 'Kontrolle: das gekaufte Gadget kommt nicht an');
  }

  // (g) HUD: zeigt fuer den Nekromanten die Geisterbomben-Abklingzeit statt
  // der toten "Minen X/Y"-Zahl (cfg.mines wird fuer ihn nie gelesen).
  {
    const texts = [];
    const fakeCtx = new Proxy(
      { canvas: { width: 768, height: 512 }, measureText: () => ({ width: 40 }) },
      {
        get: (t, k) => {
          if (k in t) return t[k];
          if (k === 'fillText') return (s) => texts.push(String(s));
          if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
          return () => {};
        },
        set: () => true,
      },
    );
    const hud = createHud(fakeCtx);
    const runNecro = createRun(tanksData, tilesData, diffData, upgradesData, 1, 'normal', { starterTank: 'c_necro' });
    runNecro.phase = 'playing';
    runNecro.state.player.ghostBombCooldown = 4.2;
    texts.length = 0;
    hud.render(runNecro, {});
    const zeile = texts.join('\n');
    check(zeile.includes('Geisterbombe'), 'HUD: zeigt beim Nekromanten keine Geisterbombe-Zeile');
    check(zeile.includes('4.2'), `HUD: zeigt nicht die laufende Abklingzeit (${zeile})`);
    check(!zeile.includes('Minen'), 'HUD: zeigt beim Nekromanten trotzdem die tote Minen-Zahl');
  }

  // (h) Strukturnachweis zu Punkt 2 des Nutzerwunschs ("permanente,
  // unaustauschbare Funktion"): der Bombenslot ist architektonisch fest --
  // kein Upgrade traegt noch tag 'secondary' (die einzige Art, wie eine
  // Karte den Slot je haette tauschen koennen), und ueber eine echte
  // Kartenwahl (applyUpgradeChoice(), der einzige Schreibpfad ausser der
  // Erzeugung) bleibt run.equippedSecondary unveraendert 'mine'.
  {
    check(
      Object.values(U).every((d) => d.tag !== 'secondary'),
      'Punkt 2: es gibt wieder eine Karte mit tag "secondary" -- der Bombenslot waere tauschbar',
    );
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 2, 'normal', { starterTank: 'c_necro' });
    check(run.equippedSecondary === 'mine', `Punkt 2: equippedSecondary startet als "${run.equippedSecondary}" statt "mine"`);
    run.phase = 'upgrade';
    run.pendingOffers = [U.core_damage_c];
    chooseUpgrade(run, 0);
    check(
      run.equippedSecondary === 'mine',
      `Punkt 2: equippedSecondary wechselt nach einer Kartenwahl auf "${run.equippedSecondary}"`,
    );
  }

  // (i) Shop-UI: die Sektion "Gadget tauschen" ist beim Nekromanten
  // komplett unsichtbar (nicht nur ausgegraut) -- ueber den echten DOM-Pfad
  // von createShopScreen() geprueft, nicht nur ueber buyShopSecondary().
  {
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    try {
      const { createShopScreen } = await import('../src/ui/roomscreens.js');
      const baseCtx = {
        upgradesData,
        secondariesData: tanksData.secondaries,
        costs: tanksData.balance.scrap.cost,
        dropRefund: tanksData.balance.scrap.dropRefund,
        getScrap: () => 999,
        getUpgrades: () => ({}),
        getWorkbenchOptions: () => [],
        getOffers: () => [],
        getEquippedSecondary: () => null,
        lifeBought: () => false,
        atFullLives: () => false,
        onBuyCard: () => false,
        onBuyShield: () => false,
        onBuySecondary: () => false,
        onBuyLife: () => false,
        onUpgradeLevel: () => false,
        onDrop: () => false,
        onLeave: () => {},
      };
      const screen = createShopScreen();
      screen.show({ ...baseCtx, necromancer: true });
      // domstub: innerHTML ist nur ein gespeicherter String (kein Live-Baum),
      // appendChild() aktualisiert ihn nicht -- textContent liest dagegen
      // rekursiv aus den echten Kindknoten (tests/domstub.mjs).
      const necroText = document.getElementById('workshop').textContent;
      check(!necroText.includes('Gadget tauschen'), 'Shop-UI: zeigt dem Nekromanten trotzdem "Gadget tauschen" an');

      screen.show({ ...baseCtx, necromancer: false, getEquippedSecondary: () => 'hook' });
      const andereText = document.getElementById('workshop').textContent;
      check(andereText.includes('Gadget tauschen'), 'Kontrolle: eine andere Klasse sieht "Gadget tauschen" nicht mehr');
    } finally {
      restore();
    }
  }
}

// ---- 47. Grundsteinumbau Phase 2: Kampfkern (treffen, toeten, spueren) --
// Der Ersatz-USP fuer den in Phase 1 entfernten Bandenschuss: Flanken-/
// Heckschaden statt Vorhaltefrust, eine Exekutionsschwelle statt endlosem
// Nachtreten, Treffer-Rueckmeldung statt des alten Trickshot-Moments. Wo
// moeglich mit EIGENEN Zahlen geprueft (nicht den echten balance.json-
// Werten), damit eine spaetere Balance-Aenderung die Tests nicht grundlos
// rot macht -- Ausnahme sind die End-zu-Ende-Schadenstests (c), die
// ausdruecklich pruefen, dass die ECHTEN konfigurierten Werte auch wirklich
// gelesen werden.
{
  const { stepState } = await import('../src/game/state.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { moveTank } = await import('../src/game/tank.js');
  const { flankZone } = await import('../src/game/armor.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  // (a) Struktur: die neuen Balance-Werte sind da und haben die Form, die
  // der Rest dieses Abschnitts voraussetzt.
  {
    const B = tanksData.balance;
    check(B.bullet.speed === 450, `Phase 2: bullet.speed ${B.bullet.speed} statt 450`);
    check(tanksData.bulletSpeeds.rocket === 210, `Phase 2: Raketentempo ${tanksData.bulletSpeeds.rocket} statt 210`);
    check(typeof B.flank?.sideMult === 'number' && typeof B.flank?.rearMult === 'number', 'Phase 2: balance.flank fehlt/unvollstaendig');
    check(typeof B.execute?.thresholdPct === 'number' && typeof B.execute?.slowMult === 'number', 'Phase 2: balance.execute fehlt/unvollstaendig');
    check(typeof B.killFeedback?.slowMoS === 'number' && typeof B.killFeedback?.slowMoScale === 'number', 'Phase 2: balance.killFeedback fehlt/unvollstaendig');
  }

  // (b) flankZone(): reine Geometrie mit EIGENEN Zahlen (nicht 110/70/1,5/2,5
  // aus balance.json). Tank bei (0,0), heading 0 (schaut nach "rechts").
  {
    const F = { sideArcDeg: 60, rearArcDeg: 60, sideMult: 2, rearMult: 3 };
    const tank = { x: 0, y: 0, heading: 0 };
    check(flankZone(tank, 10, 0, F) === 'front', 'Phase 2: flankZone -- direkt von vorn ist nicht "front"');
    check(flankZone(tank, -10, 0, F) === 'rear', 'Phase 2: flankZone -- direkt von hinten ist nicht "rear"');
    check(flankZone(tank, 0, 10, F) === 'side', 'Phase 2: flankZone -- von rechts (90°) ist nicht "side"');
    check(flankZone(tank, 0, -10, F) === 'side', 'Phase 2: flankZone -- von links (-90°) ist nicht "side"');
    // Prioritaet bei Ueberlappung: ein riesiges sideArcDeg (200) wuerde den
    // Heckbereich mit abdecken -- Heck wird trotzdem zuerst geprueft und
    // gewinnt (s. armor.js-Kommentar "Heck zaehlt zuerst").
    const Fueberlapp = { sideArcDeg: 200, rearArcDeg: 60, sideMult: 2, rearMult: 3 };
    check(flankZone(tank, -10, 0, Fueberlapp) === 'rear', 'Phase 2: flankZone -- Heck-Prioritaet bei Ueberlappung greift nicht');
  }

  // Feuert eine Testkugel des Spielers auf ein isoliertes Ziel (guardian --
  // bewegt sich nie, damit die gesetzte heading nicht von der Gegner-KI
  // ueberschrieben wird, bevor die Trefferschleife laeuft) aus einer
  // gewaehlten Richtung relativ zur Wannen-Ausrichtung. offsetAngleDeg 0 =
  // von vorn, 180 = von hinten, ±90 = von der Seite.
  const flankTreffer = (offsetAngleDeg, hp, cfgExtra = {}) => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const z = {
      ...proto, x: 200, y: 250, prevX: 200, prevY: 250, heading: 0,
      alive: true, hp, protect: 0, shieldReady: false, status: {},
      cfg: { ...proto.cfg, role: 'guardian', maxHp: 100, armor: null, requiresRicochet: false, ...cfgExtra },
    };
    st.tanks.push(z);
    const off = (offsetAngleDeg * Math.PI) / 180;
    const b = createBullet(z.x + Math.cos(off) * 2, z.y + Math.sin(off) * 2, 0, {
      speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 10,
    });
    b.age = 5;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
    return { st, z };
  };

  // (c) Schadensmultiplikation Ende-zu-Ende MIT DEN ECHTEN balance.json-
  // Werten (1,5x Seite, 2,5x Heck) -- prueft, dass wirklich diese Felder
  // gelesen werden, nicht nur dass irgendein Multiplikator wirkt.
  {
    const front = flankTreffer(0, 9999);
    check(9999 - front.z.hp === 10, `Phase 2: Fronttreffer ${9999 - front.z.hp} statt 10`);
    const side = flankTreffer(90, 9999);
    check(9999 - side.z.hp === 15, `Phase 2: Seitentreffer ${9999 - side.z.hp} statt 15 (1,5x)`);
    const rear = flankTreffer(180, 9999);
    check(9999 - rear.z.hp === 25, `Phase 2: Hecktreffer ${9999 - rear.z.hp} statt 25 (2,5x)`);
    // Bosse ausgenommen (Entscheidung C): bossInvincible markiert isBossCfg,
    // OHNE eine eigene Bewegungsfunktion auszuloesen (die wuerde x/y/heading
    // vor der Trefferschleife veraendern) und OHNE die Unverwundbarkeits-
    // Sperre zu ziehen (kein Generator im Testraum -> bossGeneratorsLeft 0).
    const boss = flankTreffer(180, 9999, { bossInvincible: true });
    check(9999 - boss.z.hp === 10, `Phase 2: Hecktreffer gegen einen Boss ${9999 - boss.z.hp} statt 10 (Ausnahme greift nicht)`);
  }

  // (d) Der Spieler ist selbst nie Ziel des Flankenschadens.
  {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const shooter = st.tanks.find((t) => t !== st.player);
    st.player.heading = 0;
    st.player.hp = 9999;
    st.player.cfg.maxHp = 9999;
    st.player.protect = 0;
    st.player.shieldReady = false;
    const off = Math.PI; // von hinten
    const b = createBullet(st.player.x + Math.cos(off) * 2, st.player.y + Math.sin(off) * 2, 0, {
      speed: 1, radius: 3, owner: shooter, kind: 'bullet', damage: 10,
    });
    b.age = 5;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
    check(9999 - st.player.hp === 10, `Phase 2: Heck-Treffer auf den Spieler ${9999 - st.player.hp} statt 10 (Flankenschaden traf faelschlich den Spieler)`);
  }

  // (e) Exekutionsschwelle: MECHANISMUS mit EIGENEN Zahlen (thresholdPct 0,5
  // statt der echten 0,35). stepState() einmal ohne Kugeln laufen lassen,
  // damit die Timer-Schleife t.executing aus dem gerade gesetzten hp/maxHp
  // berechnet -- danach wird applyDamage() direkt aufgerufen (isoliert vom
  // Rest der Trefferschleife).
  {
    const execTank = (hp, maxHp, cfgExtra = {}) => {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
      const dataClone = { ...tanksData, balance: { ...tanksData.balance, execute: { thresholdPct: 0.5, slowMult: 1, smokeIntervalS: 999 } } };
      run.data = dataClone;
      const st = run.state;
      st.data = dataClone;
      const proto = st.tanks.find((t) => t !== st.player && t.alive);
      st.tanks.length = 0;
      st.tanks.push(st.player);
      const z = {
        ...proto, x: 200, y: 250, prevX: 200, prevY: 250, heading: 0,
        alive: true, hp, protect: 0, shieldReady: false, status: {},
        cfg: { ...proto.cfg, role: 'guardian', maxHp, armor: null, requiresRicochet: false, ...cfgExtra },
      };
      st.tanks.push(z);
      st.bullets.length = 0;
      st.mines.length = 0;
      stepState(st, CMD0, 1 / 60);
      return { st, z };
    };

    // Ueber der Schwelle (60/100 = 0,6 > 0,5): normaler Abzug, kein
    // garantierter Tod.
    {
      const { st, z } = execTank(60, 100);
      check(z.executing === false, 'Phase 2: Exekutionsflag faelschlich gesetzt (60/100 ueber der Schwelle)');
      st.applyDamage(z, 5, 'test', {});
      check(z.hp === 55 && z.alive, `Phase 2: Treffer ueber der Schwelle veraendert (hp=${z.hp}, lebt=${z.alive}, erwartet 55/true)`);
    }
    // Unter der Schwelle (40/100 = 0,4 <= 0,5): JEDER Treffer toetet,
    // unabhaengig vom Schaden -- UND hp wird trotzdem korrekt abgezogen
    // (keine "eingefrorene" hp-Zahl nach dem Tod).
    {
      const { st, z } = execTank(40, 100);
      check(z.executing === true, 'Phase 2: Exekutionsflag nicht gesetzt (40/100 unter der Schwelle)');
      st.applyDamage(z, 1, 'test', {});
      check(!z.alive, 'Phase 2: 1 Schaden unter der Schwelle toetet nicht garantiert');
      check(z.hp === 39, `Phase 2: hp nach Exekutions-Kill ${z.hp} statt 39 (Schaden wurde nicht abgezogen)`);
    }
    // Bosse ausgenommen (Entscheidung C).
    {
      const { st, z } = execTank(40, 100, { bossInvincible: true });
      check(z.executing === false, 'Phase 2: Exekutionsflag ignoriert die Boss-Ausnahme nicht');
      st.applyDamage(z, 1, 'test', {});
      check(z.alive && z.hp === 39, `Phase 2: Exekution toetet einen Boss trotz Ausnahme (hp=${z.hp}, lebt=${z.alive})`);
    }
    // Der Spieler ist nie Ziel der Exekutionsschwelle, auch weit unter der
    // Schwelle nicht.
    {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
      const dataClone = { ...tanksData, balance: { ...tanksData.balance, execute: { thresholdPct: 0.5, slowMult: 1, smokeIntervalS: 999 } } };
      run.data = dataClone;
      const st = run.state;
      st.data = dataClone;
      st.player.hp = 10;
      st.player.cfg.maxHp = 100; // 0,1 -- weit unter der Schwelle
      stepState(st, CMD0, 1 / 60);
      check(st.player.executing !== true, 'Phase 2: der Spieler wird faelschlich als exekutierbar markiert');
      st.applyDamage(st.player, 1, 'test', {});
      check(st.player.alive && st.player.hp === 9, `Phase 2: ein 1er-Treffer toetet den Spieler unter der Schwelle (hp=${st.player.hp}, lebt=${st.player.alive})`);
    }
  }

  // (f) Exekutions-Verlangsamung in moveTank(): EIGENER slowMult (0,25 statt
  // der echten 0,6).
  {
    const dataClone = { balance: { execute: { thresholdPct: 0.5, slowMult: 0.25 } } };
    const state = { data: dataClone, modifier: null, oilCells: null, hazard: null, walls: [], tanks: [], conveyor: null };
    const mkTank = (executing) => ({
      x: 0, y: 0, prevX: 0, prevY: 0, heading: 0, vx: 0, vy: 0,
      cfg: { speed: 100, radius: 12 }, executing,
      stunTimer: 0, boostTimer: 0, bloodTimer: 0, hookTimer: 0, status: {},
    });
    const dt = 1 / 60;
    const normal = mkTank(false);
    moveTank(normal, { x: 1, y: 0 }, state, dt);
    const slowed = mkTank(true);
    moveTank(slowed, { x: 1, y: 0 }, state, dt);
    const distNormal = Math.hypot(normal.x, normal.y);
    const distSlowed = Math.hypot(slowed.x, slowed.y);
    check(distNormal > 0.1, 'Phase 2: Vorbedingung -- der ungebremste Panzer bewegt sich kaum');
    check(Math.abs(distSlowed / distNormal - 0.25) < 1e-6, `Phase 2: Exekutions-Verlangsamung ${(distSlowed / distNormal).toFixed(4)} statt 0,25`);
  }

  // (g) Heck-Kill-Zeitlupe: state.js setzt rearKillTimer NUR bei einem
  // toedlichen HECK-Treffer, nicht bei einem toedlichen Front-Treffer.
  {
    const front = flankTreffer(0, 5); // 10 Schaden toetet ein 5-hp-Ziel auch von vorn
    check(!front.z.alive, 'Phase 2: Vorbedingung -- der Fronttreffer toetet das schwache Ziel nicht');
    check(front.st.rearKillTimer === 0, `Phase 2: rearKillTimer nach einem Front-Kill ${front.st.rearKillTimer} statt 0`);

    const rear = flankTreffer(180, 5); // 25 Schaden (2,5x) toetet ueber das Heck
    check(!rear.z.alive, 'Phase 2: Vorbedingung -- der Hecktreffer toetet das schwache Ziel nicht');
    const erwartet = tanksData.balance.killFeedback.slowMoS;
    check(rear.st.rearKillTimer === erwartet, `Phase 2: rearKillTimer nach einem Heck-Kill ${rear.st.rearKillTimer} statt ${erwartet}`);
  }

  // (h) run.js: stepRun() kombiniert einen aktiven rearKillTimer in die
  // dt-Skalierung -- MECHANISMUS mit EIGENEM slowMoScale (0,1 statt der
  // echten 0,35), nachgewiesen ueber run.playTime (waechst nur um das
  // skalierte dt).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    run.phase = 'playing';
    const dataClone = { ...tanksData, balance: { ...tanksData.balance, killFeedback: { slowMoS: 0.2, slowMoScale: 0.1 } } };
    run.data = dataClone;
    run.state.data = dataClone;
    run.state.rearKillTimer = 999; // eigener Wert, garantiert > 0 fuer diesen Tick
    const dt = 1 / 60;
    const playTimeBefore = run.playTime;
    stepRun(run, CMD0, dt);
    check(run.slowMo === true, 'Phase 2: run.slowMo wird bei aktivem rearKillTimer nicht gesetzt');
    const delta = run.playTime - playTimeBefore;
    check(Math.abs(delta - dt * 0.1) < 1e-9, `Phase 2: stepRun() skaliert dt nicht mit killFeedback.slowMoScale (Δ${delta} statt ${dt * 0.1})`);
  }

  // (i) Telemetrie (Entscheidung I -- erst messen, dann an LP/Balance
  // drehen): playerHits zaehlt nur Treffer auf Panzer, nicht Fehlschuesse.
  {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const z = {
      ...proto, x: 200, y: 250, prevX: 200, prevY: 250, heading: 0,
      alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
      cfg: { ...proto.cfg, role: 'guardian', maxHp: 9999, armor: null, requiresRicochet: false },
    };
    st.tanks.push(z);
    check(st.playerHits === 0, 'Phase 2: Vorbedingung -- playerHits steht nicht bei 0');
    const hit = createBullet(z.x + 2, z.y, 0, { speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 10 });
    hit.age = 5;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(hit);
    stepState(st, CMD0, 1 / 60);
    check(st.playerHits === 1, `Phase 2: playerHits nach einem echten Treffer ${st.playerHits} statt 1`);
    st.bullets.length = 0;
    const miss = createBullet(-1000, -1000, 0, { speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 10 });
    st.bullets.push(miss);
    stepState(st, CMD0, 1 / 60);
    check(st.playerHits === 1, `Phase 2: playerHits zaehlt einen Fehlschuss mit (${st.playerHits} statt 1)`);
  }

  // (j) Telemetrie: magBlockedTime akkumuliert NUR bei echter Magazin-
  // Blockade (Magazin voll ausgeflogen), NICHT waehrend des normalen
  // Nachladens (das ist uebliche Kadenz, keine Blockade -- Entscheidung G).
  {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const p = st.player;
    p.cfg.magazine = 1; // eigener, kleiner Wert -- ein Schuss fuellt das Magazin
    p.cfg.magazineCap = Infinity;
    p.magazineBonus = 0;
    p.cooldown = 0;
    st.bullets.length = 0;
    const cmdFire = { move: { x: 0, y: 0 }, aim: { x: p.x + 100, y: p.y }, fire: true, firePressed: true, mine: false, dash: false };
    stepState(st, cmdFire, 1 / 60); // Schuss 1 fuellt das 1er-Magazin
    check(st.bullets.filter((b) => !b.dead && b.owner === p).length === 1, 'Phase 2: Vorbedingung -- der erste Schuss loest nicht aus');
    check(st.magBlockedTime === 0, `Phase 2: magBlockedTime steigt schon beim ersten Schuss (${st.magBlockedTime})`);
    const cooldownBefore = p.cooldown;
    check(cooldownBefore > 0, 'Phase 2: Vorbedingung -- kein Nachladen nach dem Schuss');
    stepState(st, cmdFire, 1 / 60); // waehrend des Nachladens ist ein Feuerbefehl keine Blockade
    check(st.magBlockedTime === 0, `Phase 2: magBlockedTime zaehlt normales Nachladen mit (${st.magBlockedTime})`);
    p.cooldown = 0; // jetzt IST das Magazin wirklich voll (die eine Kugel fliegt noch)
    stepState(st, cmdFire, 1 / 60);
    check(Math.abs(st.magBlockedTime - 1 / 60) < 1e-9, `Phase 2: magBlockedTime nach echter Blockade ${st.magBlockedTime} statt ${1 / 60}`);
  }
}

// ---- 48. Grundsteinumbau Phase 3: Der Gruene wird Moerserschuetze -------
// t_green bekommt seine Deckungsbrecher-Rolle zurueck -- mit Bogen statt
// Bande. Kein physisches Geschoss: eine Granate mit fester Flugzeit, die
// ueber jede Wand fliegt, mit einer von Abschuss an sichtbaren, wachsenden
// Einschlagmarkierung (Fairness-Regel). Wo moeglich mit EIGENEN Zahlen
// geprueft, nicht den echten balance.json-Werten.
{
  const { fireMortar, updateMortars } = await import('../src/game/mortar.js');
  const { roleTurret } = await import('../src/game/ai_turrets.js');

  // (a) Struktur: t_green ist jetzt ein Moerserschuetze, Magazin/Nachladen
  // bleiben wie beim frueheren Raketenwerfer (Auftrag: "Magazin 2 und die
  // 2s Nachladezeit bleiben").
  {
    const g = resolveCfg(tanksData, 't_green');
    check(g.weapon === 'mortar', `Phase 3: t_green.weapon ist "${g.weapon}" statt "mortar"`);
    check(tanksData.types.t_green.magazine === 2, 'Phase 3: t_green verliert sein 2er-Magazin');
    check(tanksData.types.t_green.fireRate === 2, 'Phase 3: t_green verliert seine 2s-Nachladezeit');
    const M = tanksData.balance.mortar;
    check(
      typeof M?.flightTimeS === 'number' && typeof M?.radiusPx === 'number' &&
        typeof M?.damage === 'number' && typeof M?.leadPct === 'number' && typeof M?.minRangePx === 'number',
      'Phase 3: balance.mortar fehlt/unvollstaendig',
    );
  }

  // Minimaler Fake-State fuer fireMortar()/updateMortars() -- isoliert vom
  // Rest der Simulation (kein createRun() noetig).
  const mkState = (mortarCfg, player) => ({
    player,
    mortars: [],
    tanks: [player],
    walls: [],
    mines: [],
    explosions: [],
    sounds: [],
    particles: [],
    data: { balance: { mortar: mortarCfg, damage: { explosion: 999 } }, limits: {}, transform: {} },
    transform: {},
    spawnParticles() {},
    addShake() {},
    applyDamage(tank, amount) {
      tank.hp -= amount;
      if (tank.hp <= 0) tank.alive = false;
    },
    destroyWall() {},
  });
  const mkTank = (x, y, cfgExtra = {}) => ({
    x, y, cooldown: 0, alive: true, protect: 0, hp: 999,
    cfg: { magazine: 2, fireCooldown: 2, radius: 12, maxHp: 999, ...cfgExtra },
  });

  // (b) fireMortar(): MECHANISMUS mit EIGENEN Zahlen -- Ziel = Spieler-
  // position + Vorhalteanteil (leadPct * flightTimeS * Geschwindigkeit).
  {
    const M = { flightTimeS: 2, radiusPx: 10, damage: 5, leadPct: 0.5, minRangePx: 0 };
    const player = mkTank(100, 50);
    player.vx = 40;
    player.vy = 0;
    const st = mkState(M, player);
    const shooter = mkTank(0, 0);
    const ok = fireMortar(shooter, st);
    check(ok === true, 'Phase 3: fireMortar() meldet keinen Abschuss, obwohl bereit');
    check(st.mortars.length === 1, `Phase 3: fireMortar() legt keine Granate an (${st.mortars.length})`);
    const m = st.mortars[0];
    // leadT = flightTimeS * leadPct = 1 -> Ziel = Spielerposition + v*1.
    check(Math.abs(m.tx - 140) < 1e-9 && Math.abs(m.ty - 50) < 1e-9, `Phase 3: Vorhalteziel (${m.tx},${m.ty}) statt (140,50)`);
    check(m.x0 === 0 && m.y0 === 0, 'Phase 3: Abschussort der Granate stimmt nicht');
    check(shooter.cooldown === 2, `Phase 3: fireMortar() setzt das Nachladen nicht (${shooter.cooldown} statt 2)`);
    check(st.sounds.some((s) => s.name === 'mortar_launch'), 'Phase 3: fireMortar() spielt keinen Abschusston');
  }

  // (c) Cooldown- und Magazin-Sperre (dasselbe Muster wie fireBullet()s
  // liveBulletsOf(), hier gegen state.mortars statt state.bullets).
  {
    const M = { flightTimeS: 2, radiusPx: 10, damage: 5, leadPct: 0, minRangePx: 0 };
    const player = mkTank(100, 50);
    player.vx = 0; player.vy = 0;
    const st = mkState(M, player);
    const shooter = mkTank(0, 0);
    shooter.cooldown = 0.5; // noch am Nachladen
    check(fireMortar(shooter, st) === false, 'Phase 3: fireMortar() feuert trotz laufendem Nachladen');
    check(st.mortars.length === 0, 'Phase 3: fireMortar() legt trotz Cooldown eine Granate an');
    shooter.cooldown = 0;
    shooter.cfg.magazine = 1;
    check(fireMortar(shooter, st) === true, 'Phase 3: Vorbedingung -- der erste Schuss bei Magazin 1 loest nicht aus');
    shooter.cooldown = 0; // erneut bereit, aber Magazin voll (1 Granate noch in der Luft)
    check(fireMortar(shooter, st) === false, 'Phase 3: Magazin-Deckel greift nicht (2. Schuss bei Magazin 1)');
    check(st.mortars.length === 1, 'Phase 3: eine geblockte fireMortar()-Anfrage legt trotzdem eine Granate an');
  }

  // (d) updateMortars(): explodiert erst NACH Ablauf der Flugzeit, nicht
  // frueher -- und dann ueber denselben explodeAt()-Helfer wie Minen (Radius/
  // Schaden aus balance.mortar, Explosionen ignorieren Panzerung/Waende).
  {
    const M = { flightTimeS: 1, radiusPx: 20, damage: 7, leadPct: 0, minRangePx: 0 };
    const player = mkTank(50, 50);
    const st = mkState(M, player);
    const shooter = mkTank(0, 0);
    fireMortar(shooter, st);
    const m = st.mortars[0];
    m.tx = 50; m.ty = 50; // exakt auf dem Spieler landen
    updateMortars(st, 0.9); // noch nicht abgelaufen
    check(st.mortars.length === 1 && !m.exploded, 'Phase 3: die Granate explodiert vor Ablauf der Flugzeit');
    check(player.hp === 999, 'Phase 3: die Granate schadet, bevor sie eingeschlagen ist');
    updateMortars(st, 0.2); // jetzt ueber die Flugzeit (0.9+0.2 > 1)
    check(st.mortars.length === 0, 'Phase 3: die explodierte Granate bleibt in state.mortars stehen');
    check(player.hp === 999 - 7, `Phase 3: Einschlagschaden ${999 - player.hp} statt 7`);
    check(st.explosions.length === 1, 'Phase 3: der Einschlag hinterlaesst keine Explosions-Anzeige');
  }

  // (e) "Fliegt ueber alle Waende": ein Ziel HINTER einer Wand (aus Sicht
  // des Abschussorts) nimmt trotzdem Schaden -- explodeAt() kennt keine
  // Sichtlinien-/Wandpruefung fuer den Explosionsschaden selbst.
  {
    const M = { flightTimeS: 0.5, radiusPx: 30, damage: 9, leadPct: 0, minRangePx: 0 };
    const player = mkTank(200, 50);
    const st = mkState(M, player);
    st.walls.push({ x: 90, y: 0, w: 20, h: 200, type: 'solid' }); // zwischen Schuetze und Ziel
    const shooter = mkTank(0, 50);
    fireMortar(shooter, st);
    st.mortars[0].tx = 200; st.mortars[0].ty = 50;
    updateMortars(st, 1); // Flugzeit sicher um
    check(player.hp === 999 - 9, `Phase 3: die Wand blockt den Einschlagschaden (hp ${player.hp} statt ${999 - 9})`);
  }

  // (f) minRangePx (ai_turrets.js: roleTurret()): unter der Mindestdistanz
  // feuert der Gruene nicht -- MECHANISMUS mit EIGENEM minRangePx, damit
  // der Test nicht an 96 haengt.
  {
    const mkAimState = (minRangePx) => ({
      data: {
        balance: { mortar: { minRangePx } },
        ai: { muzzleClearPx: 0, raycastStepPx: 4, raycastMaxPx: 900 },
      },
      rng: () => 0.5,
      walls: [],
      isSolid: () => false,
      blocksSight: () => false,
      smokeClouds: [],
      tanks: [],
    });
    const target = { x: 0, y: 0, alive: true, vx: 0, vy: 0 };
    const mkGreen = (x) => ({
      x, y: 0, turret: 0, ai: { target },
      cfg: { weapon: 'mortar', accuracy: 0.9, leadAim: false },
    });
    const st = mkAimState(100);
    st.tanks = [target];
    const nah = mkGreen(50); // 50 px entfernt -- unter minRangePx 100
    check(roleTurret(nah, st, 1) === false, 'Phase 3: der Gruene feuert unterhalb minRangePx');
    const fern = mkGreen(150); // 150 px entfernt -- ueber minRangePx 100
    check(roleTurret(fern, st, 1) === true, 'Phase 3: der Gruene feuert nicht mehr, sobald er ausserhalb minRangePx steht');
  }

  // (g) Nicht reflektierbar: eine Moerser-Granate erzeugt NIE einen Eintrag
  // in state.bullets -- Deflektor/Frontpanzerung (die nur auf state.bullets
  // wirken) haben dadurch automatisch keinen Zugriff, ohne Sonderfall im
  // Trefferpfad.
  {
    const M = { flightTimeS: 1, radiusPx: 10, damage: 5, leadPct: 0, minRangePx: 0 };
    const player = mkTank(50, 50);
    const st = mkState(M, player);
    st.bullets = [];
    fireMortar(mkTank(0, 0), st);
    check(st.bullets.length === 0, 'Phase 3: fireMortar() erzeugt faelschlich ein Geschoss in state.bullets');
  }
}

// ---- 49. Grundsteinumbau Phase 5: Klassen parken -------------------------
// Nur player (Nulllinie) und c_necro bleiben waehlbar; die restlichen acht
// Klassen sind ueber enabled:false geparkt, NICHT geloescht -- resolveCfg()
// und ein bereits laufender Spielstand duerfen sie weiterhin auflösen
// (Testschritt 4 des Auftrags: "Spielstand eines laufenden Runs laden --
// funktioniert").
{
  const { resolveCfg } = await import('../src/game/cfg.js');
  const T = tanksData.types;
  const GEPARKT = ['c_blast', 'c_frost', 'c_tesla', 'c_toxic', 'c_scrap', 'c_ricochet', 'c_engineer', 'c_flame'];

  // (a) Struktur: genau die acht namentlich benannten Klassen tragen
  // enabled:false, player/c_necro sind unangetastet (kein enabled-Feld oder
  // explizit true) -- ein Tippfehler in einer id waere hier sofort sichtbar.
  {
    for (const id of GEPARKT) {
      check(T[id]?.enabled === false, `Phase 5: Klasse "${id}" ist nicht geparkt (enabled !== false)`);
    }
    check(T.player.enabled !== false, 'Phase 5: die Standardklasse ist faelschlich geparkt');
    check(T.c_necro.enabled !== false, 'Phase 5: der Nekromant ist faelschlich geparkt');
  }

  // (b) MECHANISMUS der Auswahl-Filterung (src/main.js: playerClasses) --
  // hier nachgebaut, weil main.js das DOM beim Import verdrahtet und nicht
  // isoliert importierbar ist. Exakt derselbe Filterausdruck wie im echten
  // Code (t.player && t.enabled !== false); eine Abweichung hier waere ohne
  // Aussagekraft, deshalb bewusst wortgleich zu main.js.
  {
    const playerClasses = Object.entries(T).filter(([, t]) => t.player && t.enabled !== false);
    const ids = playerClasses.map(([id]) => id).sort();
    check(
      ids.length === 2 && ids.join(',') === 'c_necro,player',
      `Phase 5: Auswahlfilter liefert [${ids.join(', ')}] statt genau [c_necro, player]`,
    );
  }

  // (c) Keine geloeschten Daten: jede geparkte Klasse loest weiterhin ohne
  // Fehler/NaN in ein Spieler-cfg auf (ein alter Spielstand mit z. B.
  // starterTank:'c_flame' muss weiter laden -- Testschritt 4).
  {
    for (const id of GEPARKT) {
      let cfg;
      try {
        cfg = resolveCfg(tanksData, id);
      } catch (e) {
        check(false, `Phase 5: resolveCfg() wirft fuer geparkte Klasse "${id}" (${e.message})`);
        continue;
      }
      check(
        Number.isFinite(cfg.maxHp) && Number.isFinite(cfg.damage),
        `Phase 5: geparkte Klasse "${id}" loest nicht mehr sauber auf (maxHp=${cfg.maxHp}, damage=${cfg.damage})`,
      );
    }
  }

  // (d) c_necro ist unveraendert: sein Passiv (Geistermechanik ueber
  // cfg.necromancer) ist von Phase 5 nicht betroffen.
  {
    const cfg = resolveCfg(tanksData, 'c_necro');
    check(cfg.necromancer === true, 'Phase 5: der Nekromant hat sein Passiv verloren');
  }
}

// ---- 50. Grundsteinumbau Phase 6: Drei Akte -------------------------------
// Aus der 16-Raum-Karte werden drei Akte a 16 Raeume + Bossraum. Mechanismus
// mit eigenen Zahlen (synthetische diffs/Seeds statt der echten _todo:
// balance-Werte), Gegenprobe fuer jeden Kernpunkt bestanden.
{
  const { generateMap, buyEnemies, totalRooms, createRun: cr2, stepRun: sr2, advanceAct: aa2 } = await import('../src/game/run.js');
  const { mulberry32 } = await import('../src/core/rng.js');

  // (a) Struktur: drei Akte, feste Boss-Reihenfolge Reaktor->Amboss->Spinne
  //     (Spinnenboss-Auftrag ersetzt boss_phalanx als Akt-3-Boss, der
  //     Amboss-Auftrag ersetzt boss_mirror als Akt-2-Boss),
  //     Lebensbonus nur bei Akt 1/2 (Akt 3 beendet den Run, kein Bonus mehr).
  {
    const acts = diffData.acts;
    check(acts.length === 3, `Phase 6: ${acts.length} Akte statt 3`);
    check(
      acts.map((a) => a.boss).join(',') === 'boss_reactor,boss_anvil,boss_spider',
      `Phase 6: Boss-Reihenfolge ${acts.map((a) => a.boss).join(',')} statt Reaktor/Amboss/Spinne`,
    );
    for (const [i, a] of acts.entries()) {
      check(
        typeof a.rooms === 'number' && typeof a.bossHpMult === 'number' &&
          typeof a.lifeReward === 'number' && typeof a.budget?.base === 'number' && typeof a.budget?.perRoom === 'number',
        `Phase 6: Akt ${i + 1} hat unvollstaendige Konfiguration`,
      );
    }
    check(acts[2].lifeReward === 0, 'Phase 6: der letzte Akt vergibt noch einen Lebensbonus (der Run ist danach vorbei)');
  }

  // (b) Struktur: jeder Gegnertyp hat unlockAct/unlockRoomInAct (ersetzt das
  //     alte einzelne unlockRoom vollstaendig).
  {
    for (const [id, d] of Object.entries(diffData.danger)) {
      check(
        typeof d.unlockAct === 'number' && typeof d.unlockRoomInAct === 'number' && d.unlockRoom === undefined,
        `Phase 6: Gegnertyp "${id}" hat kein unlockAct/unlockRoomInAct (oder noch ein altes unlockRoom)`,
      );
    }
  }

  // (c) totalRooms()-MECHANISMUS mit einem synthetischen Akt-Array (nicht
  //     den echten 16-Raum-Werten) -- Raeume + 1 (Bossraum), je Akt.
  {
    const fakeDiff = { acts: [{ rooms: 7 }, { rooms: 20 }] };
    check(totalRooms(fakeDiff, 1) === 8, `Phase 6: totalRooms(Akt 1) = ${totalRooms(fakeDiff, 1)} statt 8`);
    check(totalRooms(fakeDiff, 2) === 21, `Phase 6: totalRooms(Akt 2) = ${totalRooms(fakeDiff, 2)} statt 21`);
  }

  // (d) buyEnemies()-MECHANISMUS mit einem synthetischen danger-Objekt: ein
  //     Typ, der erst in Akt 2 (bzw. Akt 2 ab Raum 5) freigeschaltet wird,
  //     darf VOR seiner Freischaltung nie gekauft werden.
  {
    const fakeDiff = {
      maxEnemiesPerRoom: 8,
      danger: {
        a: { points: 1, unlockAct: 1, unlockRoomInAct: 1 },
        b: { points: 1, unlockAct: 2, unlockRoomInAct: 1 },
        c: { points: 1, unlockAct: 2, unlockRoomInAct: 5 },
      },
    };
    const seenIn = (actIndex, roomIndexInAct) => {
      const seen = new Set();
      const rng = mulberry32(1);
      for (let i = 0; i < 500; i++) {
        for (const ty of buyEnemies(fakeDiff, rng, actIndex, roomIndexInAct, 10)) seen.add(ty);
      }
      return seen;
    };
    const act1 = seenIn(1, 16); // spaeter Raum in Akt 1 -- b/c trotzdem gesperrt
    check(act1.has('a') && !act1.has('b') && !act1.has('c'), `Phase 6: Akt 1 kauft ${[...act1]} statt nur "a"`);
    const act2fruh = seenIn(2, 1);
    check(act2fruh.has('a') && act2fruh.has('b') && !act2fruh.has('c'), `Phase 6: Akt 2 Raum 1 kauft ${[...act2fruh]} statt "a"+"b" ohne "c"`);
    const act2spaet = seenIn(2, 5);
    check(act2spaet.has('a') && act2spaet.has('b') && act2spaet.has('c'), `Phase 6: Akt 2 Raum 5 kauft ${[...act2spaet]} statt alle drei`);
  }

  // (e) generateMap()-STRUKTURREGELN ueber viele synthetische Seeds (die
  //     echte danger/map-Konfiguration ist hier voellig unbeteiligt -- reine
  //     Graph-Regeln): erste zwei Ebenen erzwungener Kampf, dritte Ebene ohne
  //     elite/cursed/workshop, letzte Ebene komplett 'rest', genau EIN
  //     'treasure'-Knoten, keine zwei Rastplaetze in Folge (ausser in die
  //     erzwungene Rast-Ebene hinein).
  {
    const actRooms = diffData.acts[0].rooms;
    for (let seed = 1; seed <= 25; seed++) {
      for (const actIndex of [1, 2, 3]) {
        const map = generateMap(seed * 1000 + actIndex, diffData, actIndex);
        for (const n of map.layers[0]) check(n.type === 'combat' && !n.isBoss, `Phase 6: Ebene 1 (Seed ${seed}) ist nicht erzwungen Kampf`);
        for (const n of map.layers[1]) check(n.type === 'combat' && !n.isBoss, `Phase 6: Ebene 2 (Seed ${seed}) ist nicht erzwungen Kampf`);
        for (const n of map.layers[2]) {
          check(
            !['elite', 'cursed', 'workshop'].includes(n.type),
            `Phase 6: Ebene 3 (Seed ${seed}) hat einen gesperrten Typ "${n.type}"`,
          );
        }
        const restLayer = map.layers[actRooms - 1];
        for (const n of restLayer) check(n.type === 'rest', `Phase 6: letzte Ebene vor dem Boss (Seed ${seed}) hat "${n.type}" statt "rest"`);
        const bossLayer = map.layers[map.layers.length - 1];
        check(bossLayer.length === 1 && bossLayer[0].isBoss && bossLayer[0].type === 'combat', `Phase 6: Bossknoten (Seed ${seed}) falsch aufgebaut`);
        const treasureCount = [...map.byId.values()].filter((n) => n.type === 'treasure').length;
        check(treasureCount === 1, `Phase 6: ${treasureCount} Schatzkammer-Knoten (Seed ${seed}) statt genau 1`);
        for (const layer of map.layers) {
          for (const node of layer) {
            if (node.type !== 'rest') continue;
            for (const nid of node.next) {
              const target = map.byId.get(nid);
              check(
                !(target.type === 'rest' && target.layer !== actRooms),
                `Phase 6: zwei Rastplaetze in Folge (Seed ${seed}, Ebene ${node.layer}->${target.layer})`,
              );
            }
          }
        }
      }
    }
  }

  // (f) actRoomKey-MECHANISMUS (RNG-Stromtrennung): Akt 1 und Akt 2
  //     erzeugen bei GLEICHEM Seed unterschiedliche Karten -- sonst wuerden
  //     Akt-1-Raum-1 und Akt-2-Raum-1 identische Raeume ziehen (derselbe
  //     Fehler, den actRoomKey() in run.js verhindert).
  {
    for (const seed of [11, 22, 33]) {
      const m1 = generateMap(seed, diffData, 1);
      const m2 = generateMap(seed, diffData, 2);
      const sig = (m) => m.layers.map((l) => l.map((n) => n.type).join(',')).join('|');
      check(sig(m1) !== sig(m2), `Phase 6: Akt 1 und Akt 2 (Seed ${seed}) erzeugen dieselbe Karte -- RNG-Stroeme nicht getrennt`);
    }
  }

  // (g) End-to-End: ein kompletter Run durchlaeuft GENAU zwei
  //     Akt-Uebergaenge (nach Akt 1 und Akt 2), mit dem in acts[].lifeReward
  //     hinterlegten Bonus, gedeckelt auf maxLives -- und endet nach dem
  //     dritten (letzten) Boss direkt mit 'victory', OHNE einen dritten
  //     Uebergang. cheatKillAll haelt den Spieler ueberwiegend bei vollen
  //     Leben, der Cap wird dadurch in der Praxis mitgeprueft (Lebensbonus
  //     darf run.maxLives dann nicht ueberschreiten).
  {
    const run = cr2(tanksData, tilesData, diffData, upgradesData, 555555);
    let transitions = 0;
    let guard = 200000;
    while (run.phase !== 'victory' && run.phase !== 'gameover' && guard-- > 0) {
      if (run.phase === 'preview') enterRoom(run);
      else if (run.phase === 'transition') sr2(run, CMD, STEP);
      else if (run.phase === 'playing') {
        cheatKillAll(run.state);
        sr2(run, CMD, STEP);
      } else if (run.phase === 'upgrade') chooseUpgrade(run, 0);
      else if (run.phase === 'map') pickMapNode(run);
      else if (run.phase === 'workshop') leaveWorkshop(run);
      else if (run.phase === 'event') chooseEventOption(run, 0);
      else if (run.phase === 'rest') passRest(run);
      else if (run.phase === 'bossReward') passBossReward(run);
      else if (run.phase === 'actComplete') {
        transitions++;
        const expected = diffData.acts[run.actIndex - 1].lifeReward;
        check(run.lastActLifeReward === expected, `Phase 6: Uebergang ${transitions} vergibt ${run.lastActLifeReward} Leben statt ${expected}`);
        check(run.lives <= run.maxLives, `Phase 6: Uebergang ${transitions} ueberschreitet maxLives (${run.lives} > ${run.maxLives})`);
        aa2(run);
      } else break;
    }
    check(guard > 0, 'Phase 6: End-to-End-Run haengt (Iterationslimit)');
    check(run.phase === 'victory', `Phase 6: End-to-End-Run endet in Phase "${run.phase}" statt "victory"`);
    check(transitions === 2, `Phase 6: ${transitions} Akt-Uebergaenge statt genau 2 (nach Akt 1 und Akt 2)`);
  }
}

// ---- 51. Grundsteinumbau Phase 7: Rastplatz und Aufwertung ---------------
// Der Rastplatz wird ein Raum mit echter Entscheidung (Reparaturtrupp ODER
// Werkbank), und run.upgradeLevels/cfg.js: applyUpgrades() skalieren damit
// die core-Effekte einer Karte. Mechanismus mit EIGENEN Zahlen (nicht den
// echten balance.json-Werten), Gegenprobe fuer jeden Kernpunkt bestanden.
{
  // (a) Struktur: balance.upgradeLevel vollstaendig, sockel_ersatzpanzer
  //     traegt upgradable:false, die vier uebrigen Sockelkarten nicht.
  {
    const lb = tanksData.balance.upgradeLevel;
    check(
      typeof lb?.bonusPct === 'number' && typeof lb?.maxLevel === 'number',
      'Phase 7: balance.upgradeLevel fehlt oder ist unvollstaendig',
    );
    check(
      upgradesData.upgrades.sockel_ersatzpanzer.upgradable === false,
      'Phase 7: sockel_ersatzpanzer ist noch aufwertbar (ein halbes Leben existiert nicht)',
    );
    for (const id of ['sockel_panzerung', 'sockel_motor', 'sockel_magazin', 'sockel_ladeautomat']) {
      check(
        upgradesData.upgrades[id].upgradable !== false,
        `Phase 7: ${id} ist faelschlich nicht aufwertbar`,
      );
    }
  }

  // (b) Mechanismus applyUpgrades()-Stufenskalierung mit EIGENEN Zahlen:
  //     eine synthetische Karte mit hpAdd/speedMult, bonusPct 1.0 (Stufe
  //     verdoppelt den Effekt je Stufe), maxLevel 5. Additiv (hpAdd) wird
  //     direkt skaliert, multiplikativ (speedMult) nur die Abweichung von 1.
  {
    const synU = { upgrades: { testcard: { core: { hpAdd: 10, speedMult: 1.1 } } } };
    const base = resolveCfg(tanksData, 'player');
    const noLevel = applyUpgrades({ ...base }, { testcard: 1 }, synU, 'mine', null, {}, { bonusPct: 1.0, maxLevel: 5 });
    const withLevel = applyUpgrades({ ...base }, { testcard: 1 }, synU, 'mine', null, { testcard: 2 }, { bonusPct: 1.0, maxLevel: 5 });
    check(
      Math.abs(noLevel.maxHp - (base.maxHp + 10)) < 1e-6,
      `Phase 7: Stufe 0 veraendert hpAdd (${noLevel.maxHp} statt ${base.maxHp + 10})`,
    );
    // Stufe 2, bonusPct 1.0 -> sm = 1 + 2*1 = 3 -> hpAdd effektiv 30.
    check(
      Math.abs(withLevel.maxHp - (base.maxHp + 30)) < 1e-6,
      `Phase 7: Stufe 2 skaliert hpAdd nicht auf das 3-fache (${withLevel.maxHp} statt ${base.maxHp + 30})`,
    );
    // speedMult 1.1 bei sm=3 -> 1 + (1.1-1)*3 = 1.3 (NICHT 1.1^3 = 1.331 und
    // NICHT 1.1*3 = 3.3) -- nur die Abweichung von 1 wird skaliert.
    const expectedSpeed = base.speed * 1.3;
    check(
      Math.abs(withLevel.speed - expectedSpeed) < 1e-6,
      `Phase 7: Stufe 2 skaliert speedMult falsch (${withLevel.speed} statt ${expectedSpeed})`,
    );
    // Deckel: Stufe ueber maxLevel wird auf maxLevel geklemmt.
    const overCap = applyUpgrades({ ...base }, { testcard: 1 }, synU, 'mine', null, { testcard: 99 }, { bonusPct: 1.0, maxLevel: 5 });
    check(
      Math.abs(overCap.maxHp - (base.maxHp + 10 * (1 + 5))) < 1e-6,
      `Phase 7: Stufe 99 wird nicht auf maxLevel 5 geklemmt (${overCap.maxHp})`,
    );
    // upgradable:false ignoriert die Stufe komplett (sm bleibt 1).
    const synU2 = { upgrades: { testcard: { core: { hpAdd: 10 }, upgradable: false } } };
    const noScale = applyUpgrades({ ...base }, { testcard: 1 }, synU2, 'mine', null, { testcard: 4 }, { bonusPct: 1.0, maxLevel: 5 });
    check(
      Math.abs(noScale.maxHp - (base.maxHp + 10)) < 1e-6,
      `Phase 7: upgradable:false wird trotzdem skaliert (${noScale.maxHp} statt ${base.maxHp + 10})`,
    );
    // Magazin/Minen bleiben nach der Skalierung ganzzahlig (magAdd 1, sm 1.5
    // -> 1.5, gerundet).
    const synU3 = { upgrades: { testcard: { core: { magAdd: 1 } } } };
    const magLvl = applyUpgrades({ ...base }, { testcard: 1 }, synU3, 'mine', null, { testcard: 1 }, { bonusPct: 0.5, maxLevel: 2 });
    check(Number.isInteger(magLvl.magazine), `Phase 7: Magazin ist nach Stufen-Skalierung nicht ganzzahlig (${magLvl.magazine})`);
  }

  // (c)+(d) Testschritte 1+2: repairAtRest() -- mit fehlendem Leben +1,
  //     Raum zu Ende; bei vollen Leben abgelehnt, Raum bleibt offen.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 9001);
    run.phase = 'rest';
    run.lives = run.maxLives - 1;
    const before = run.lives;
    const ok = repairAtRest(run);
    check(ok === true, 'Phase 7: repairAtRest() lehnt bei fehlendem Leben faelschlich ab');
    check(run.lives === before + 1, `Phase 7: repairAtRest() gibt ${run.lives - before} statt 1 Leben`);
    check(run.phase !== 'rest', `Phase 7: repairAtRest() beendet den Raum nicht (Phase "${run.phase}")`);

    const run2 = createRun(tanksData, tilesData, diffData, upgradesData, 9002);
    run2.phase = 'rest';
    run2.lives = run2.maxLives; // volle Leben
    const ok2 = repairAtRest(run2);
    check(ok2 === false, 'Phase 7: repairAtRest() erlaubt bei vollen Leben faelschlich eine Reparatur');
    check(run2.lives === run2.maxLives, 'Phase 7: repairAtRest() veraendert die Leben trotz Ablehnung');
    check(run2.phase === 'rest', 'Phase 7: eine abgelehnte Reparatur beendet den Raum trotzdem');
  }

  // (e) Testschritt 3: sockel_motor aufwerten -- messbar schnellere Bewegung
  //     als mit der unaufgewerteten Karte (echte upgradesData/balance.json).
  {
    const base = resolveCfg(tanksData, 'player');
    const lvl0 = applyUpgrades({ ...base }, { sockel_motor: 1 }, upgradesData, 'mine', null, {}, tanksData.balance.upgradeLevel);
    const lvl1 = applyUpgrades({ ...base }, { sockel_motor: 1 }, upgradesData, 'mine', null, { sockel_motor: 1 }, tanksData.balance.upgradeLevel);
    check(lvl1.speed > lvl0.speed, `Phase 7: aufgewerteter sockel_motor ist nicht schneller (${lvl1.speed} <= ${lvl0.speed})`);
  }

  // (f) Testschritt 4: Speichern/Laden -- runSnapshot()/resume erhalten
  //     run.upgradeLevels UND dessen Wirkung im aufgeloesten cfg.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 9003);
    run.upgrades.sockel_motor = 1;
    run.upgradeLevels.sockel_motor = 1;
    const snap = runSnapshot(run);
    check(snap.upgradeLevels?.sockel_motor === 1, 'Phase 7: runSnapshot() vergisst run.upgradeLevels');
    const resumed = createRun(tanksData, tilesData, diffData, upgradesData, run.seed, run.modeKey, { resume: snap });
    check(resumed.upgradeLevels?.sockel_motor === 1, 'Phase 7: Fortsetzen stellt run.upgradeLevels nicht wieder her');
    const base = resolveCfg(tanksData, 'player');
    const lvl0 = applyUpgrades({ ...base }, { sockel_motor: 1 }, upgradesData, 'mine', null, {}, tanksData.balance.upgradeLevel);
    check(
      resumed.state.player.cfg.speed > lvl0.speed,
      'Phase 7: die Wirkung der Stufe fehlt nach dem Fortsetzen im Spieler-cfg',
    );
  }

  // (g)+(h) UEBERARBEITET (Champion-/Nekromant-Nachschliff Abschnitt 2): das
  // alte Stufen-/Deckel-System ist vollstaendig entfernt -- workbenchOptions()
  // listet jetzt jede besessene WIEDERHOLBARE Karte ohne Obergrenze,
  // upgradeCardAtRest() behandelt eine erneute Wahl exakt wie ein frisches
  // Angebot (derselbe Stapelzaehler run.upgrades[id]). isUnique-Karten
  // erscheinen NIE, egal wie oft besessen (kann strukturell nur 1x sein).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 9004);
    run.phase = 'rest';
    run.upgrades = { sockel_motor: 20, sockel_ersatzpanzer: 5 }; // hohe Stapelzahl, kein Deckel
    const opts = workbenchOptions(run);
    check(
      opts.some((o) => o.id === 'sockel_motor' && o.stufe === 20),
      'Phase 7 (Nachschliff): eine oft besessene wiederholbare Karte fehlt/verliert ihre Stapelzahl in der Werkbank-Liste',
    );
    // sockel_ersatzpanzer ist selbst isUnique:false (nicht das alte
    // upgradable:false-Feld) -- erscheint also weiterhin ganz normal.
    check(
      opts.some((o) => o.id === 'sockel_ersatzpanzer'),
      'Phase 7 (Nachschliff): eine wiederholbare Karte fehlt in der Werkbank-Liste',
    );
    const okHigh = upgradeCardAtRest(run, 'sockel_motor');
    check(okHigh === true, 'Phase 7 (Nachschliff): eine erneute Wahl bei hoher Stapelzahl wird abgelehnt (kein Deckel erlaubt)');
    check(run.upgrades.sockel_motor === 21, `Phase 7 (Nachschliff): die Stapelzahl steigt nicht (${run.upgrades.sockel_motor} statt 21)`);
    check(run.phase !== 'rest', 'Phase 7 (Nachschliff): eine gueltige Wahl beendet den Raum nicht');

    // Einzigartige und nie besessene Karten lassen sich nicht waehlen.
    // WICHTIG: upgradesData NICHT direkt mutieren -- das ist dasselbe
    // geteilte Objekt, das alle anderen Tests (u.a. die Sockel-Pool-
    // Strukturprüfung) ebenfalls lesen. Eine geklonte Kopie nur für run2.
    const run2 = createRun(tanksData, tilesData, diffData, upgradesData, 9005);
    run2.phase = 'rest';
    run2.upgradesData = {
      ...upgradesData,
      upgrades: {
        ...upgradesData.upgrades,
        test_unique_65b: { id: 'test_unique_65b', name: 'Test', description: 'x', tag: 'x', rarity: 'common', isUnique: true, requires: [], core: {} },
      },
    };
    run2.upgrades = { sockel_motor: 1, test_unique_65b: 1 };
    check(!workbenchOptions(run2).some((o) => o.id === 'test_unique_65b'), 'Phase 7 (Nachschliff): eine einzigartige Karte erscheint in der Werkbank-Liste');
    const okUnique = upgradeCardAtRest(run2, 'test_unique_65b');
    check(okUnique === false, 'Phase 7 (Nachschliff): eine einzigartige Karte laesst sich am Rastplatz erneut waehlen');
    check(run2.phase === 'rest', 'Phase 7 (Nachschliff): eine abgelehnte Wahl beendet den Raum trotzdem');
    const okUnowned = upgradeCardAtRest(run2, 'sockel_magazin');
    check(okUnowned === false, 'Phase 7 (Nachschliff): eine nie gezogene Karte laesst sich am Rastplatz waehlen');
    check(run2.phase === 'rest', 'Phase 7 (Nachschliff): eine abgelehnte Wahl (unbesessene Karte) beendet den Raum trotzdem');
  }

  // (i) Sicherheitsnetz: volle Leben UND keine aufwertbare Karte darf den
  //     Rastplatz nicht zur Sackgasse ohne moegliche Wahl machen -- rest ist
  //     ab Ebene 3 ein normal gewichteter Kartenknotentyp UND die letzte
  //     Ebene vor jedem Boss ist immer komplett rest (garantiert erreichbar,
  //     kein Seed-Suchlauf noetig). run.mapCurrentId wird direkt auf einen
  //     Elternknoten eines rest-Knotens gesetzt -- chooseMapNode() prueft nur
  //     "ist nodeId in current.next", nicht WIE der Spieler dorthin kam, also
  //     testet das denselben startRoom()->startNonCombatRoom()-Pfad wie ein
  //     echtes Spiel, ohne einen kompletten Kampf-Durchlauf zu simulieren.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1);
    let parentId = null;
    let restId = null;
    for (const node of run.map.byId.values()) {
      const hit = node.next.find((id) => run.map.byId.get(id)?.type === 'rest');
      if (hit != null) {
        parentId = node.id;
        restId = hit;
        break;
      }
    }
    check(parentId != null, 'Phase 7: kein Knoten mit erreichbarem rest-Nachbarn gefunden (Testaufbau)');
    if (parentId != null) {
      run.mapCurrentId = parentId;
      run.phase = 'map';
      // Grenzfall gezielt erzwingen: volle Leben, keine besessene Karte.
      run.lives = run.maxLives;
      run.upgrades = {};
      const ok = chooseMapNode(run, restId);
      check(ok, 'Phase 7: Sicherheitsnetz-Testaufbau -- rest-Knoten nicht erreichbar');
      check(
        run.phase !== 'rest',
        `Phase 7: Rastplatz ohne moegliche Wahl bleibt in Phase "${run.phase}" haengen statt automatisch weiterzuziehen`,
      );
    }
  }
}

// ---- 52. Grundsteinumbau Phase 8: Shop ueberarbeitet ---------------------
// Der Shop war auf 246 generische Karten und sechs Schadenstypen ausgelegt,
// beides gibt es nicht mehr: cardChoices 5->4, neue Werkbank-Aktion (gegen
// Schrott dieselbe Aufwertung wie am Rastplatz), der Lebenskauf bekommt den
// im Auftrag verlangten maxLives-Deckel (fehlte bisher -- echter Fund).
// Testschritte 1-5 des Auftrags wörtlich, Gegenprobe fuer jeden Kernpunkt
// bestanden.
{
  // Hilfsfunktion: einen echten Shop-Raum betreten, ueber den Kartengraphen
  // (kein Kampf simuliert) -- Muster wie das Phase-7-Sicherheitsnetz: ein
  // Elternknoten eines 'workshop'-Knotens wird direkt angesteuert,
  // chooseMapNode() prueft nur "ist die Ziel-id in current.next". `workshop`
  // ist mit Gewicht 5 von ~98 selten (Phase 6: map.nodeWeights) und in den
  // ersten drei Ebenen ausgeschlossen -- ueber mehrere Seeds gesucht, statt
  // sich auf einen einzigen zu verlassen.
  function enterWorkshop(maxSeed = 60) {
    for (let seed = 1; seed <= maxSeed; seed++) {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, seed);
      let parentId = null;
      let shopId = null;
      for (const node of run.map.byId.values()) {
        const hit = node.next.find((id) => run.map.byId.get(id)?.type === 'workshop');
        if (hit != null) {
          parentId = node.id;
          shopId = hit;
          break;
        }
      }
      if (parentId == null) continue;
      run.mapCurrentId = parentId;
      run.phase = 'map';
      const ok = chooseMapNode(run, shopId);
      if (ok && run.phase === 'workshop') return run;
    }
    return null;
  }

  // (a) Struktur: cardChoices 4, cost.upgradeLevel eine Zahl.
  {
    check(tanksData.balance.shop?.cardChoices === 4, `Phase 8: shop.cardChoices ist ${tanksData.balance.shop?.cardChoices} statt 4`);
    check(
      typeof tanksData.balance.scrap.cost.upgradeLevel === 'number',
      'Phase 8: scrap.cost.upgradeLevel fehlt oder ist keine Zahl',
    );
  }

  // (b) Testschritt 1: ein echter Shop-Besuch zieht GENAU cardChoices (4)
  //     Karten -- der 5-Karten-Sockel liefert das noch vollstaendig.
  {
    const run = enterWorkshop();
    check(!!run, 'Phase 8: Testaufbau -- kein Shop-Knoten unter 60 Seeds gefunden');
    if (run) {
      check(
        run.shopOffers.length === tanksData.balance.shop.cardChoices,
        `Phase 8: Shop-Regal zeigt ${run.shopOffers.length} statt ${tanksData.balance.shop.cardChoices} Karten`,
      );
    }
  }

  // (c) Testschritt 2 (Champion-/Nekromant-Nachschliff Abschnitt 2,
  //     UEBERARBEITET): Werkbank im Shop waehlt eine besessene Karte
  //     ERNEUT -- die Stapelzahl steigt (kein separates Stufen-Feld mehr),
  //     Schrott sinkt exakt um cost.upgradeLevel, der Raum bleibt offen.
  {
    const run = enterWorkshop();
    check(!!run, 'Phase 8: Testaufbau -- kein Shop-Knoten unter 60 Seeds gefunden');
    if (run) {
      run.upgrades.sockel_motor = 1;
      const cost = tanksData.balance.scrap.cost.upgradeLevel;
      run.scrap = cost + 3;
      const ok = buyShopUpgradeLevel(run, 'sockel_motor');
      check(ok === true, 'Phase 8: buyShopUpgradeLevel() lehnt eine gueltige erneute Wahl ab');
      check(run.upgrades.sockel_motor === 2, `Phase 8 (Nachschliff): Stapelzahl steigt nicht (${run.upgrades.sockel_motor} statt 2)`);
      check(run.scrap === 3, `Phase 8: Schrott sinkt nicht um genau ${cost} (Rest ${run.scrap} statt 3)`);
      check(run.phase === 'workshop', `Phase 8: die Werkbank-Aktion beendet den Shop-Raum (Phase "${run.phase}")`);

      // Besitz-Ablehnung (dieselbe repickOwnedCard()-Pruefung wie
      // upgradeCardAtRest, Abschnitt 51) -- Schrott wird bei Ablehnung NICHT
      // abgezogen.
      const scrapBefore = run.scrap;
      const okUnowned = buyShopUpgradeLevel(run, 'sockel_magazin');
      check(okUnowned === false, 'Phase 8: eine nie gezogene Karte laesst sich im Shop erneut waehlen');
      check(run.scrap === scrapBefore, 'Phase 8: Schrott sinkt trotz abgelehnter Wahl (unbesessene Karte)');
    }
  }

  // (d) Testschritt 3: 0 Schrott -- keine der Shop-Aktionen greift, kein
  //     Absturz, kein negativer Schrottstand.
  {
    const run = enterWorkshop();
    check(!!run, 'Phase 8: Testaufbau -- kein Shop-Knoten unter 60 Seeds gefunden');
    if (run) {
      run.upgrades.sockel_motor = 1;
      run.scrap = 0;
      let crashed = false;
      try {
        check(buyShopCard(run, 0) === false, 'Phase 8: buyShopCard() kauft trotz 0 Schrott');
        check(buyShieldCharge(run) === false, 'Phase 8: buyShieldCharge() kauft trotz 0 Schrott');
        check(buyShopUpgradeLevel(run, 'sockel_motor') === false, 'Phase 8: buyShopUpgradeLevel() kauft trotz 0 Schrott');
        check(buyShopLife(run) === false, 'Phase 8: buyShopLife() kauft trotz 0 Schrott');
      } catch (e) {
        crashed = true;
        check(false, `Phase 8: eine Shop-Aktion bei 0 Schrott stuerzt ab (${e.message})`);
      }
      check(!crashed && run.scrap === 0, `Phase 8: Schrott ist nach abgelehnten Aktionen ${run.scrap} statt 0`);
    }
  }

  // (e) Testschritt 4: Leben bei vollem Stand kaufen wollen -- gesperrt
  //     (echter Fund: buyShopLife() kannte bisher KEINEN maxLives-Deckel,
  //     nur die Einmal-pro-Besuch-Sperre).
  {
    const run = enterWorkshop();
    check(!!run, 'Phase 8: Testaufbau -- kein Shop-Knoten unter 60 Seeds gefunden');
    if (run) {
      run.lives = run.maxLives;
      run.scrap = tanksData.balance.scrap.cost.shopLife + 10;
      const ok = buyShopLife(run);
      check(ok === false, 'Phase 8: buyShopLife() erlaubt einen Kauf bei vollen Leben');
      check(run.lives === run.maxLives, 'Phase 8: die Leben aendern sich trotz Ablehnung');
      check(!run.shopLifeBought, 'Phase 8: shopLifeBought wird trotz abgelehntem Kauf gesetzt');
    }
  }

  // (f) Testschritt 5: Shop verlassen und einen spaeteren Shop betreten --
  //     neues Regal (deterministisch aus Seed+Raumnummer, nicht dasselbe
  //     Array wie beim ersten Besuch).
  {
    let found = null;
    for (let seed = 1; seed <= 30 && !found; seed++) {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, seed);
      const shopNodes = [...run.map.byId.values()].filter((n) => n.type === 'workshop');
      if (shopNodes.length >= 2) found = { seed, ids: shopNodes.map((n) => n.id) };
    }
    check(!!found, 'Phase 8: kein Seed mit zwei Shop-Knoten unter 30 Seeds gefunden (Testaufbau)');
    if (found) {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, found.seed);
      const shops = [];
      for (const id of found.ids) {
        // Jeden Shop-Knoten unabhaengig direkt ansteuern (wie enterWorkshop()),
        // ohne den ersten Besuch fortzusetzen -- das genuegt, um zwei
        // UNTERSCHIEDLICHE Regale (verschiedene Raumnummern -> verschiedener
        // upgrades-Strom) zu vergleichen.
        const node = [...run.map.byId.values()].find((n) => n.next.includes(id));
        if (!node) continue;
        run.mapCurrentId = node.id;
        run.phase = 'map';
        chooseMapNode(run, id);
        if (run.phase === 'workshop') shops.push(run.shopOffers.map((o) => o.id).join(','));
      }
      check(shops.length >= 2, `Phase 8: Testaufbau -- nur ${shops.length} von ${found.ids.length} Shop-Knoten liefern ein Regal`);
      if (shops.length >= 2) {
        check(shops[0] !== shops[1], `Phase 8: zwei verschiedene Shop-Raeume liefern dasselbe Regal (${shops[0]})`);
      }
    }
  }
}

// ---- 53. Grundsteinumbau Phase 9: Kartenbelohnung neu verteilen ----------
// Karten nur dort, wo sie verdient sind: Kampf-, Elite- und Fluchraeume
// (cursed gibt jetzt wieder eine echte Kartenwahl statt eines Schrottpakets,
// s. run.js: rollReward()); Ereignisse duerfen eine Karte als EINE Option
// unter mehreren anbieten (effects.card:true). Testschritte 1-5 woertlich,
// Gegenprobe fuer jeden Kernpunkt bestanden.
{
  // Hilfsfunktion: einen Knoten eines bestimmten Typs direkt ansteuern --
  // Muster wie Abschnitt 51/52 (Elternknoten suchen, chooseMapNode() prueft
  // nur "ist die Ziel-id in current.next", kein Kampf simuliert fuer
  // Nicht-Kampfraeume; Kampfraeume (combat/elite/cursed) bauen dabei einen
  // echten Zustand, den der Aufrufer bei Bedarf noch raeumen muss).
  function enterRoomType(type, maxSeed = 60) {
    for (let seed = 1; seed <= maxSeed; seed++) {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, seed);
      let parentId = null;
      let targetId = null;
      for (const node of run.map.byId.values()) {
        const hit = node.next.find((id) => run.map.byId.get(id)?.type === type);
        if (hit != null) {
          parentId = node.id;
          targetId = hit;
          break;
        }
      }
      if (parentId == null) continue;
      run.mapCurrentId = parentId;
      run.phase = 'map';
      if (chooseMapNode(run, targetId)) return run;
    }
    return null;
  }

  // (a) Struktur: everyNRooms ist aus data/upgrades.json entfernt; mindestens
  // ein Ereignis bietet effects.card:true als Option unter mehreren an.
  {
    check(upgradesData.everyNRooms === undefined, 'Phase 9: everyNRooms steht noch in data/upgrades.json');
    const cardEvents = tanksData.events.events.filter((ev) => ev.options.some((o) => o.effects?.card));
    check(cardEvents.length >= 1, 'Phase 9: kein Ereignis bietet eine Kartenoption an');
    for (const ev of cardEvents) {
      check(ev.options.length >= 2, `Phase 9: Ereignis "${ev.id}" hat die Kartenoption als EINZIGE Option statt als eine unter mehreren`);
    }
  }

  // Raum bis 'playing' durchspielen (Transition abwarten), dann alle Gegner
  // per Cheat toeten, bis die Belohnungsphase erreicht ist -- Muster wie die
  // grossen Playthrough-Schleifen weiter oben in dieser Datei.
  function clearToReward(run) {
    enterRoom(run);
    let guard = 200;
    while (run.phase === 'transition' && guard-- > 0) stepRun(run, CMD, STEP);
    guard = 10;
    while (run.phase === 'playing' && guard-- > 0) {
      cheatKillAll(run.state);
      stepRun(run, CMD, STEP);
    }
  }

  // (b) Testschritt 1: Kampfraum raeumen -- Angebot erscheint.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1);
    check(run.roomType === 'combat', `Phase 9: Testaufbau -- Raum 1 ist "${run.roomType}" statt combat`);
    clearToReward(run);
    check(run.phase === 'upgrade', `Phase 9: nach einem geraeumten Kampfraum ist die Phase "${run.phase}" statt "upgrade"`);
    check(run.pendingOffers?.length > 0, 'Phase 9: der Kampfraum bietet keine Karte an');
  }

  // (c) Testschritt 2: Ereignis (ohne Kartenoption), Shop, Rast, Schatz --
  //     nirgends ein automatisches Angebot.
  {
    // Ereignis ohne Kartenoption: die erste Option von "minenguertel" hat
    // keine effects.card.
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1);
    const ev = tanksData.events.events.find((e) => e.id === 'minenguertel');
    check(!!ev, 'Phase 9: Testaufbau -- Ereignis "minenguertel" nicht gefunden');
    if (ev) {
      run.phase = 'event';
      run.currentEvent = ev;
      chooseEventOption(run, 0);
      check(run.phase !== 'upgrade', `Phase 9: eine Ereignis-Option ohne Kartenoption oeffnet trotzdem ein Angebot (Phase "${run.phase}")`);
    }

    const shopRun = enterRoomType('workshop');
    check(!!shopRun, 'Phase 9: Testaufbau -- kein Shop-Knoten gefunden');
    if (shopRun) {
      leaveWorkshop(shopRun);
      check(shopRun.phase !== 'upgrade', `Phase 9: Shop verlassen oeffnet ein Angebot (Phase "${shopRun.phase}")`);
    }

    const restRun = enterRoomType('rest');
    check(!!restRun, 'Phase 9: Testaufbau -- kein Rastplatz gefunden');
    if (restRun) {
      restRun.lives = Math.max(1, restRun.maxLives - 1); // Reparatur soll greifen
      repairAtRest(restRun);
      check(restRun.phase !== 'upgrade', `Phase 9: der Rastplatz oeffnet ein Angebot (Phase "${restRun.phase}")`);
    }

    const treasureRun = enterRoomType('treasure');
    check(!!treasureRun, 'Phase 9: Testaufbau -- keine Schatzkammer gefunden');
    if (treasureRun) {
      check(treasureRun.phase !== 'upgrade', `Phase 9: die Schatzkammer oeffnet ein Angebot (Phase "${treasureRun.phase}")`);
    }
  }

  // (d) Testschritt 3: ein Ereignis MIT Kartenoption waehlen -- der
  //     Angebotsbildschirm oeffnet, danach zieht der Raum normal weiter.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1);
    const ev = tanksData.events.events.find((e) => e.id === 'feldwerkstatt');
    check(!!ev, 'Phase 9: Testaufbau -- Ereignis "feldwerkstatt" nicht gefunden');
    if (ev) {
      const cardIdx = ev.options.findIndex((o) => o.effects?.card);
      check(cardIdx >= 0, 'Phase 9: Testaufbau -- "feldwerkstatt" hat keine Kartenoption (mehr)');
      if (cardIdx >= 0) {
        run.phase = 'event';
        run.currentEvent = ev;
        chooseEventOption(run, cardIdx);
        check(run.phase === 'upgrade', `Phase 9: die Kartenoption oeffnet kein Angebot (Phase "${run.phase}")`);
        check(run.pendingOffers?.length > 0, 'Phase 9: die Kartenoption liefert ein leeres Angebot');
        chooseUpgrade(run, 0);
        check(run.phase !== 'upgrade' && run.phase !== 'event', `Phase 9: nach der Kartenwahl bleibt die Phase "${run.phase}" haengen`);
      }
    }
  }

  // (e) Mechanismus: Fluchraeume (cursed) geben jetzt eine echte Kartenwahl
  //     (rewardKind 'cursed'), keinen Schrottpaket-Sonderweg mehr.
  {
    const run = enterRoomType('cursed');
    check(!!run, 'Phase 9: Testaufbau -- kein Fluchraum gefunden');
    if (run) {
      check(run.roomType === 'cursed', `Phase 9: Testaufbau -- Raum ist "${run.roomType}" statt cursed`);
      clearToReward(run);
      check(run.phase === 'upgrade', `Phase 9: ein geraeumter Fluchraum oeffnet kein Angebot (Phase "${run.phase}")`);
      check(run.rewardKind === 'cursed', `Phase 9: rewardKind ist "${run.rewardKind}" statt "cursed"`);
      check(run.pendingOffers?.length > 0, 'Phase 9: der Fluchraum bietet keine Karte an');
    }
  }

  // (f) Testschritt 5: Pool bewusst leerspielen -- das Spiel laeuft ohne
  //     Angebot weiter (Sicherheitsnetz, sowohl fuer einen Kampfraum als
  //     auch fuer die Kartenoption eines Ereignisses).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1);
    for (const id of Object.keys(upgradesData.upgrades)) run.bannedUpgrades.add(id);
    clearToReward(run);
    check(run.phase !== 'upgrade', `Phase 9: ein leergespielter Pool oeffnet trotzdem ein Angebot (Phase "${run.phase}")`);

    const run2 = createRun(tanksData, tilesData, diffData, upgradesData, 1);
    for (const id of Object.keys(upgradesData.upgrades)) run2.bannedUpgrades.add(id);
    const ev = tanksData.events.events.find((e) => e.id === 'feldwerkstatt');
    const cardIdx = ev.options.findIndex((o) => o.effects?.card);
    run2.phase = 'event';
    run2.currentEvent = ev;
    chooseEventOption(run2, cardIdx);
    check(run2.phase !== 'upgrade', `Phase 9: die Kartenoption oeffnet trotz leergespieltem Pool ein Angebot (Phase "${run2.phase}")`);
  }

  // (g) Rechnung (Auftrag: "grob 20 Kampf-, 6 Elite- und 4 Fluchknoten je
  //     Run"): eigene Messung ueber 40 Seeds x 3 Akte zeigt etwa 70
  //     garantierte Kartenraeume je Run (~51 Kampf + ~11 Elite + ~8 Flucht)
  //     -- die Auftragsschaetzung war um etwa den Akt-Faktor 3 zu niedrig
  //     (rechnete offenbar nur mit EINEM Akt, nicht mit dreien). Dokumentiert
  //     in CLAUDE.md; dieser Test sichert nur GROBE Groessenordnung
  //     (Regressionsschutz gegen eine kuenftige, drastische Aenderung der
  //     Kartenknoten-Gewichtung), keine exakte Zahl.
  {
    const { generateMap } = await import('../src/game/run.js');
    let total = 0;
    const N = 20;
    for (let seed = 1; seed <= N; seed++) {
      for (let act = 1; act <= 3; act++) {
        const map = generateMap(seed, diffData, act);
        for (const node of map.byId.values()) {
          if (node.type === 'combat' || node.type === 'elite' || node.type === 'cursed') total++;
        }
      }
    }
    const avg = total / N;
    check(
      avg > 40 && avg < 100,
      `Phase 9: durchschnittlich ${avg.toFixed(1)} garantierte Kartenraeume je Run -- ausserhalb der erwarteten Groessenordnung (40-100)`,
    );
  }
}

// ---- 54. Grundsteinumbau Phase 10: Abnahme -------------------------------
// Schlussabnahme des ganzen Grundsteinumbaus. Die 21 Pruefpunkte des
// Auftrags sind ueberwiegend schon in fruegeren Phasen-Abschnitten (47-53)
// sowie den bestehenden UMBAUPLAN-LP-/Upgradepool-v2-Abschnitten gedeckt --
// dieser Abschnitt deckt NUR die dabei gefundenen echten Luecken ab, jede
// mit Gegenprobe. Zuordnungstabelle (Auftrag-Nummer -> Fundort):
//   1  kein Abpraller jemals            -> HIER (c), NEU
//   2  Flankenwinkel eigene Zahlen      -> Abschnitt 47(b)
//   3  Frontpanzerung reflektiert+ownB. -> HIER (d), NEU
//   4  Bosse ohne Flankenmultiplikator  -> Abschnitt 47(c)
//   5  Exekution toetet auch bei 1 Sch. -> Abschnitt 47(e)
//   6  Vorhaltemarkierung korrekt       -> HIER (e), NEU
//   7  shotsFired/shotsHit/magBlocked   -> Abschnitt 47(i)+(j) + HIER (f), NEU (real)
//   8  Granate ueberfliegt Waende       -> Abschnitt 48(e)
//   9  Radius-Grenze, Spieler+Gegner    -> HIER (g), NEU
//   10 minRangePx + Deflektor wirkungslos -> Abschnitt 48(f)+(g)
//   11 Boss-LP folgt bossHpMult         -> HIER (h), NEU
//   12 Gegner ab Akt im Pool            -> Abschnitt 50(d)
//   13 +1 Leben nach Akt 1/2, gedeckelt -> Abschnitt 50 (End-zu-Ende-Run)
//   14 Kartenregeln (Rast/Elite/Schatz) -> Abschnitt 50(e)
//   15 Fortsetzen ueber eine Aktgrenze  -> HIER (i), NEU
//   16 Sockel exakt 5, maxStacks-Deckel -> HIER (a), NEU + Abschnitt 39(19)
//   17 keine archiv. Karte/Klasse/Prisma -> HIER (a)+(b), NEU
//   18 Karten nur Kampf/Elite/Flucht/Ereignis -> Abschnitt 53(b)-(f)
//   19 Aufwertungsstufe + Speichern     -> Abschnitt 51
//   20 Schatz: 1 Leben, Schrottpaket    -> HIER (k), NEU
//   21 Determinismus (inkl. 3 Aktkarten) -> Abschnitt 4 (Akt 1) + HIER (j), NEU
{
  const { stepState } = await import('../src/game/state.js');
  const { createBullet, updateBullet } = await import('../src/game/bullet.js');
  const { drawLeadMarkers } = await import('../src/render/effects.js');
  const { fireMortar, updateMortars } = await import('../src/game/mortar.js');
  const { generateMap } = await import('../src/game/run.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  // Hilfsfunktion (Muster wie Abschnitt 51/52/53): einen Knoten eines Typs
  // direkt ansteuern, Vorzustand (Leben/Schrott) mit zurueckgeben.
  function enterRoomType(type, maxSeed = 60) {
    for (let seed = 1; seed <= maxSeed; seed++) {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, seed);
      let parentId = null;
      let targetId = null;
      for (const node of run.map.byId.values()) {
        const hit = node.next.find((id) => run.map.byId.get(id)?.type === type);
        if (hit != null) {
          parentId = node.id;
          targetId = hit;
          break;
        }
      }
      if (parentId == null) continue;
      run.mapCurrentId = parentId;
      run.phase = 'map';
      const before = { lives: run.lives, scrap: run.scrap };
      if (chooseMapNode(run, targetId)) return { run, before };
    }
    return null;
  }

  // (a) Punkt 16+17: der Sockel hat GENAU die bekannten Karten -- keine
  //     mehr, keine weniger. Schliesst archivierte Karten strukturell aus
  //     (geschlossene Welt: rollFromPool()/drawOne() koennen nur ids liefern,
  //     die in upgradesData.upgrades stehen). Champion-/Nekromant-
  //     Nachschliff Abschnitt 16/17: drei universelle legendaere Karten
  //     (sockel_kriegsmeister/-titanpanzerung/-sturmantrieb) sind dazugekommen,
  //     damit auch die Standard-Klasse genug Legendaere fuer Elite-/
  //     Boss-Belohnungen hat -- fuenf auf acht Karten erweitert. Codedurchsicht
  //     Phase D (reiner Generalist, alle fuenf Stufen): 13 weitere Karten
  //     schliessen uncommon/rare/epic (je 4) und eine vierte Legendaere --
  //     acht auf 21 Karten erweitert (5/4/4/4/4 je Seltenheitsstufe), sonst
  //     unveraendert.
  {
    const expected = [
      'sockel_alleskoenner', 'sockel_ausweichmanoever', 'sockel_energieschild',
      'sockel_ersatzpanzer', 'sockel_fangschuss', 'sockel_hartmetallkern',
      'sockel_keramikplatten', 'sockel_kriegsmeister', 'sockel_ladeautomat',
      'sockel_magazin', 'sockel_motor', 'sockel_panzerung', 'sockel_scharfschuetze',
      'sockel_schnellverschluss', 'sockel_sturmantrieb', 'sockel_titanpanzerung',
      'sockel_turbolader', 'sockel_wanderpanzerung', 'sockel_wanne',
      'sockel_wuchtgeschoss', 'sockel_zielfernrohr',
    ];
    const actual = Object.keys(upgradesData.upgrades).sort();
    check(actual.length === 21, `Phase 10: Pool hat ${actual.length} Karten statt 21`);
    check(actual.join(',') === expected.join(','), `Phase 10: Pool enthaelt unerwartete/fehlende ids: ${actual.join(',')}`);
  }

  // (b) Punkt 17: das Prisma existiert nirgends mehr -- weder als Typ noch
  //     als kaufbarer Gegner.
  {
    check(!tanksData.types.t_prism, 'Phase 10: t_prism existiert noch in data/tanks.json');
    check(diffData.danger.t_prism === undefined, 'Phase 10: t_prism ist noch als Gegner kaufbar (difficulty.danger)');
  }

  // (c) Punkt 1: kein Geschoss prallt jemals von einer Wand ab -- weder
  //     strukturell (kein wallBounces/ricochetsLeft-Feld) noch im Verhalten
  //     (ein Wandkontakt toetet sofort, die Kugel bewegt sich danach nicht
  //     mehr weiter, auch nicht in eine "reflektierte" Richtung).
  {
    const b0 = createBullet(0, 0, 0, { speed: 100, radius: 3, owner: null, kind: 'bullet', damage: 1 });
    check(
      b0.wallBounces === undefined && b0.ricochetsLeft === undefined && b0.ricochetsStart === undefined,
      'Phase 10: ein Geschoss traegt noch Abpraller-Felder (wallBounces/ricochetsLeft/ricochetsStart)',
    );
    const wall = { x: 100, y: 0, w: 20, h: 200, type: 'solid' };
    const shadow = { walls: [wall], laserWalls: [], tanks: [], data: tanksData };
    const b = createBullet(50, 50, 0, { speed: 200, radius: 3, owner: null, kind: 'bullet', damage: 1 });
    const dt = 1 / 60;
    let steps = 0;
    while (!b.dead && steps++ < 60) updateBullet(b, shadow, dt);
    check(b.dead, 'Phase 10: die Kugel stirbt nicht am Wandkontakt');
    check(steps < 60, 'Phase 10: Testaufbau -- die Kugel erreicht die Wand nicht');
    const xNachTod = b.x;
    const yNachTod = b.y;
    updateBullet(b, shadow, dt);
    updateBullet(b, shadow, dt);
    check(b.x === xNachTod && b.y === yNachTod, 'Phase 10: eine tote Kugel bewegt sich weiter (Abpraller ueberlebt intern)');
  }

  // (d) Punkt 3: Frontpanzerung reflektiert weiterhin (E3); die reflektierte
  //     Kugel kann den Schuetzen treffen (ownBullet greift) und stirbt an
  //     der naechsten Wand wie jede andere Kugel (kein zweiter Abpraller).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42);
    const st = run.state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    const player = st.player;
    // Bekannte wandfreie Zone in Seed 42 Raum 1 (empirisch geprueft): x in
    // [240,380], y=250. z bei 200 waere selbst eine Wand -- die Kugel darf
    // NICHT darauf liegen, deshalb 40 px versetzt wie in Abschnitt 47.
    player.x = 370; player.y = 250; player.prevX = 370; player.prevY = 250;
    player.hp = 9999; player.cfg.maxHp = 9999; player.protect = 0; player.shieldReady = false;
    player.deflectorCharges = 0;
    st.tanks.push(player);
    const z = {
      ...proto, x: 200, y: 250, prevX: 200, prevY: 250, heading: 0,
      alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
      cfg: { ...proto.cfg, role: 'guardian', maxHp: 9999, armor: { arc: 120, reflects: true }, requiresRicochet: false },
    };
    st.tanks.push(z);
    st.bullets.length = 0;
    st.mines.length = 0;
    const b = createBullet(202, 250, Math.PI, { speed: 1, radius: 3, owner: player, kind: 'bullet', damage: 10 });
    b.age = 5;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
    check(z.hp === 9999, `Phase 10: Frontpanzerung laesst trotzdem Schaden durch (hp=${z.hp})`);
    check(b.reflected === true, 'Phase 10: die Frontpanzerung reflektiert die Kugel nicht');
    check(b.owner === player, 'Phase 10: eine reflektierte Kugel wechselt faelschlich den Besitzer');
    check(!b.dead, 'Phase 10: die reflektierte Kugel ist faelschlich schon tot');

    // Zum Schuetzen "teleportieren" (Muster wie Abschnitt 47: direkte
    // Positionierung statt vollstaendiger Flugsimulation) -- Immunitaets-
    // fenster und Geschwindigkeit fuer diesen Schritt ausschalten, damit die
    // Bewegungsphase sie nicht wieder aus der Ueberlappung traegt.
    b.reflectImmuneT = 0;
    b.vx = 0; b.vy = 0;
    b.x = player.x - 2; b.y = player.y;
    const hpVorher = player.hp;
    stepState(st, CMD0, 1 / 60);
    const erwarteterSchaden = tanksData.balance.damage.ownBullet;
    check(
      hpVorher - player.hp === erwarteterSchaden,
      `Phase 10: eine reflektierte Kugel schadet dem Schuetzen um ${hpVorher - player.hp} statt ${erwarteterSchaden} (ownBullet)`,
    );
    check(b.dead, 'Phase 10: die reflektierte Kugel ueberlebt den Treffer auf den Schuetzen');

    // Isoliert: eine frische, bereits reflektierte Kugel stirbt am naechsten
    // Wandkontakt wie jede andere -- kein Sonderfall fuer einen "zweiten
    // Abpraller" mehr.
    const wall = { x: 200, y: -50, w: 20, h: 100, type: 'solid' };
    const shadow = { walls: [wall], laserWalls: [], tanks: [], data: tanksData };
    const b2 = createBullet(180, 0, 0, { speed: 300, radius: 3, owner: player, kind: 'bullet', damage: 10 });
    b2.reflected = true;
    let steps = 0;
    while (!b2.dead && steps++ < 60) updateBullet(b2, shadow, 1 / 60);
    check(b2.dead, 'Phase 10: eine reflektierte Kugel stirbt nicht an der naechsten Wand');
  }

  // (e) Punkt 6: Vorhaltemarkierung -- bei konstanter Zielgeschwindigkeit
  //     liegt der gezeichnete Punkt nahe der rechnerisch korrekten Abfang-
  //     position (analytische Loesung derselben Aufgabe, unabhaengig von der
  //     iterativen Naeherung in effects.js nachgerechnet). Toleranz 15 px --
  //     empirisch ermittelt: die 3-Schritt-Naeherung weicht bei realistischen
  //     Zielgeschwindigkeiten (40-140 px/s) hoechstens ~8 px vom analytischen
  //     Optimum ab, 15 px laesst Spielraum ohne die Pruefung wirkungslos zu
  //     machen.
  {
    const makeCtx = () => {
      const calls = [];
      return {
        calls,
        strokeStyle: '', lineWidth: 1,
        beginPath() {}, stroke() {}, moveTo() {}, lineTo() {},
        arc(...args) { calls.push(args); },
      };
    };
    // Analytische Abfangzeit: |Ziel(t) - Schuetze| = speed * t.
    const analyticIntercept = (px, py, speed, tx, ty, vx, vy) => {
      const dx0 = tx - px;
      const dy0 = ty - py;
      const a = vx * vx + vy * vy - speed * speed;
      const b = 2 * (dx0 * vx + dy0 * vy);
      const c = dx0 * dx0 + dy0 * dy0;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return null;
      const sq = Math.sqrt(disc);
      const roots = [(-b + sq) / (2 * a), (-b - sq) / (2 * a)].filter((t) => t > 0).sort((x, y) => x - y);
      if (!roots.length) return null;
      const t = roots[0];
      return { ex: tx + vx * t, ey: ty + vy * t };
    };
    const cases = [
      { px: 0, py: 0, speed: 450, tx: 300, ty: 0, vx: 100, vy: 0 },
      { px: 0, py: 0, speed: 450, tx: 500, ty: 200, vx: 140, vy: -140 },
      { px: 0, py: 0, speed: 450, tx: 100, ty: 100, vx: 40, vy: 10 },
    ];
    for (const c of cases) {
      const state = {
        player: { alive: true, cfg: { bulletSpeed: c.speed }, x: c.px, y: c.py },
        tanks: [{ alive: true, x: c.tx, y: c.ty, vx: c.vx, vy: c.vy }],
      };
      state.tanks.push(state.player);
      const ctx = makeCtx();
      drawLeadMarkers(ctx, state);
      const arcCall = ctx.calls.find((a) => a.length >= 2);
      check(!!arcCall, 'Phase 10: drawLeadMarkers() zeichnet keinen Punkt fuer ein bewegtes Ziel');
      if (arcCall) {
        const [ex, ey] = arcCall;
        const analytic = analyticIntercept(c.px, c.py, c.speed, c.tx, c.ty, c.vx, c.vy);
        const err = Math.hypot(ex - analytic.ex, ey - analytic.ey);
        check(err < 15, `Phase 10: Vorhaltemarkierung weicht ${err.toFixed(1)} px von der rechnerischen Abfangposition ab (Toleranz 15)`);
      }
    }
  }

  // (f) Punkt 7 (Ergaenzung zu Abschnitt 47i/j): ein simulierter Raum MIT DEN
  //     ECHTEN 450er-Kugeln haelt magBlockedTime nahe null bei Dauerfeuer --
  //     nicht nur der isolierte Mechanismus mit einem kuenstlichen 1er-
  //     Magazin. Gezielt an die leere Raummitte (keine Gegner getroffen,
  //     jede Kugel stirbt an der ersten Wand).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1);
    const st = run.state;
    const p = st.player;
    check(p.cfg.bulletSpeed === 450, `Phase 10: Testaufbau -- Spielerkugel ${p.cfg.bulletSpeed} statt 450`);
    const totalS = 8;
    const dt = 1 / 60;
    const cmdFire = { move: { x: 0, y: 0 }, aim: { x: p.x, y: p.y - 1 }, fire: true, firePressed: true, mine: false, dash: false };
    let elapsed = 0;
    while (elapsed < totalS) {
      stepState(st, cmdFire, dt);
      elapsed += dt;
    }
    const anteil = st.magBlockedTime / totalS;
    check(anteil < 0.05, `Phase 10: magBlockedTime betraegt ${(anteil * 100).toFixed(1)} % der Spielzeit bei Dauerfeuer -- deutlich mehr als "nahe null"`);
  }

  // (g) Punkt 9: Moerser-Explosion -- ausserhalb des Radius kein Schaden,
  //     innerhalb Schaden an SPIELER UND GEGNER (nicht nur an einem von
  //     beiden).
  {
    const mkTank = (x, y) => ({ x, y, cooldown: 0, alive: true, protect: 0, hp: 999, cfg: { magazine: 2, fireCooldown: 2, radius: 12, maxHp: 999 } });
    const mkState = (mortarCfg, player, tanks) => ({
      player,
      mortars: [],
      tanks,
      walls: [],
      mines: [],
      explosions: [],
      sounds: [],
      particles: [],
      data: { balance: { mortar: mortarCfg, damage: { explosion: 999 } }, limits: {}, transform: {} },
      transform: {},
      spawnParticles() {},
      addShake() {},
      applyDamage(tank, amount) {
        tank.hp -= amount;
        if (tank.hp <= 0) tank.alive = false;
      },
      destroyWall() {},
    });

    const M = { flightTimeS: 1, radiusPx: 30, damage: 8, leadPct: 0, minRangePx: 0 };
    const player = mkTank(0, 0);
    const enemy = mkTank(20, 0); // innerhalb 30 px Radius vom Einschlag
    const weit = mkTank(200, 0); // weit ausserhalb
    const st = mkState(M, player, [player, enemy, weit]);
    fireMortar(mkTank(-50, 0), st);
    st.mortars[0].tx = 0; st.mortars[0].ty = 0; // Einschlag exakt auf dem Spieler
    updateMortars(st, 1);
    check(player.hp === 999 - 8, `Phase 10: die Explosion schadet dem Spieler nicht (hp ${player.hp} statt ${999 - 8})`);
    check(enemy.hp === 999 - 8, `Phase 10: die Explosion schadet einem Gegner innerhalb des Radius nicht (hp ${enemy.hp} statt ${999 - 8})`);
    check(weit.hp === 999, `Phase 10: die Explosion schadet ausserhalb des Radius (hp ${weit.hp} statt 999)`);
  }

  // (h) Punkt 11: Boss-LP folgt wirklich acts[].bossHpMult -- gemessen an
  //     einem ECHTEN Bossraum (Akt 1, bossHpMult 1.0, weiterhin der
  //     t_black-Platzhalter), nicht nur am Vorhandensein des Konfigurations-
  //     felds (Abschnitt 50a). Akt 2 nutzt seit dem Amboss-Auftrag t_anvil
  //     statt t_black -- dessen 1050 LP sind ein FESTER Wert (anvilBoss ->
  //     isBossCfg() -> hpScaling.skipBosses), die Pruefung dafuer wandert
  //     deshalb in den Amboss-Testabschnitt weiter unten (kein Doppel-Test
  //     derselben Aussage mit zwei unterschiedlichen Erwartungen).
  {
    function enterBossRoom(actIndex) {
      const run = createRun(tanksData, tilesData, diffData, upgradesData, 1);
      if (actIndex > 1) {
        run.actIndex = actIndex - 1;
        run.phase = 'actComplete';
        advanceAct(run);
      }
      const bossNode = [...run.map.byId.values()].find((n) => n.isBoss);
      const parent = [...run.map.byId.values()].find((n) => n.next.includes(bossNode.id));
      run.mapCurrentId = parent.id;
      run.phase = 'map';
      chooseMapNode(run, bossNode.id);
      return run;
    }
    const perRoom = diffData.hpScaling.perRoom;
    for (const actIndex of [1]) {
      const run = enterBossRoom(actIndex);
      const boss = run.state.tanks.find((t) => t.type === 't_black');
      check(!!boss, `Phase 10: Testaufbau -- kein t_black-Platzhalterboss in Akt ${actIndex} gefunden`);
      if (boss) {
        const actCfg = diffData.acts[actIndex - 1];
        const roomIndex = run.roomIndex; // akt-lokal, Bossraum = letzte Ebene
        const erwartet = Math.round(
          tanksData.types.t_black.maxHp * (1 + perRoom * (roomIndex - 1)) * (actCfg.bossHpMult ?? 1),
        );
        check(
          Math.abs(boss.cfg.maxHp - erwartet) <= 1,
          `Phase 10: Akt-${actIndex}-Boss hat ${boss.cfg.maxHp} LP statt ${erwartet} (bossHpMult ${actCfg.bossHpMult})`,
        );
      }
    }
  }

  // (i) Punkt 15: Spielstand ueber eine Aktgrenze laden -- Akt, Karte,
  //     Leben, Stufen, Stacks stimmen nach dem Fortsetzen.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 777);
    run.upgrades.sockel_motor = 2;
    run.upgradeLevels.sockel_motor = 1;
    run.scrap = 17;
    run.lives = Math.max(1, run.maxLives - 1);
    run.actIndex = 1;
    run.phase = 'actComplete';
    advanceAct(run); // -> Akt 2, frische Karte, Raum 1
    check(run.actIndex === 2, `Phase 10: Testaufbau -- Akt ist ${run.actIndex} statt 2`);
    const snap = runSnapshot(run);
    check(snap.actIndex === 2, `Phase 10: runSnapshot() traegt Akt ${snap.actIndex} statt 2`);
    const resumed = createRun(tanksData, tilesData, diffData, upgradesData, run.seed, run.modeKey, { resume: snap });
    check(resumed.actIndex === 2, `Phase 10: Fortsetzen liefert Akt ${resumed.actIndex} statt 2`);
    check(resumed.roomIndex === run.roomIndex, `Phase 10: Fortsetzen liefert Raum ${resumed.roomIndex} statt ${run.roomIndex}`);
    const mapOf = (r) => JSON.stringify(r.map.layers.map((l) => l.map((n) => [n.id, n.type, n.next])));
    check(mapOf(resumed) === mapOf(run), 'Phase 10: Fortsetzen baut nicht dieselbe Akt-2-Karte');
    check(resumed.lives === run.lives, `Phase 10: Fortsetzen liefert ${resumed.lives} Leben statt ${run.lives}`);
    check(resumed.scrap === 17, `Phase 10: Fortsetzen liefert ${resumed.scrap} Schrott statt 17`);
    check(resumed.upgrades.sockel_motor === 2, `Phase 10: Fortsetzen liefert Stapel ${resumed.upgrades.sockel_motor} statt 2`);
    check(resumed.upgradeLevels.sockel_motor === 1, `Phase 10: Fortsetzen liefert Stufe ${resumed.upgradeLevels.sockel_motor} statt 1`);
  }

  // (j) Punkt 21 (Ergaenzung zu Abschnitt 4, das nur Akt 1 prueft): Akt-2-
  //     und Akt-3-Karten sind bei gleichem Seed ebenfalls deterministisch --
  //     jeder Akt hat seit Phase 6 seinen eigenen Kartenstrom.
  {
    const ser = (m) => JSON.stringify(m.layers.map((l) => l.map((n) => [n.id, n.type, n.next])));
    for (const act of [1, 2, 3]) {
      const m1 = generateMap(9191, diffData, act);
      const m2 = generateMap(9191, diffData, act);
      check(ser(m1) === ser(m2), `Phase 10: Akt-${act}-Karte ist bei gleichem Seed nicht deterministisch`);
    }
  }

  // (k) Punkt 20: die Schatzkammer kostet exakt 1 Leben und gibt exakt das
  //     konfigurierte Schrottpaket.
  {
    const found = enterRoomType('treasure');
    check(!!found, 'Phase 10: Testaufbau -- keine Schatzkammer gefunden');
    if (found) {
      const { run, before } = found;
      const erwarteteLeben = before.lives - diffData.treasure.lifeCost;
      check(run.lives === erwarteteLeben, `Phase 10: die Schatzkammer kostet ${before.lives - run.lives} Leben statt ${diffData.treasure.lifeCost}`);
      const erwarteterSchrott = before.scrap + tanksData.balance.scrap.treasure;
      check(run.scrap === erwarteterSchrott, `Phase 10: die Schatzkammer gibt ${run.scrap - before.scrap} Schrott statt ${tanksData.balance.scrap.treasure}`);
    }
  }
}

// ---- 55. Nekromant-V2 Phase 0: Import + Validierung des 105-Karten-Pools --
// Reiner Datenimport (data/upgrades_necro.json aus der xlsx-Vorlage, Fassung
// v4) -- die Datei ist NICHT in die Angebots-Pipeline eingehaengt (kein
// rollOffers()-Zugriff, kein upgradepool.js-Import hier), deshalb pruefen wir
// nur die Struktur der Datei selbst. "Keine Karte ist spielbar" (Auftrag
// Phase 0). v4 ersetzt das fruehere maxStacks-Modell (aus v2.xlsx) durch
// isUnique -- siehe archive/upgrades_necro-v2-import.json.
{
  const U = necroData.upgrades;
  const PATH_TAGS = new Set(['allgemein', 'opfer', 'legion', 'alpha']);
  const RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);

  // (a) Champion-/Nekromant-Nachschliff: 105 urspruengliche + 11 neue Karten
  //     (Abschnitte 6/7/8/9) = 116, minus die entfernte ghost_068 "Langer
  //     Anspruch" (Abschnitt 10) = 115 eindeutige IDs, Objektschluessel === id.
  const ids = Object.keys(U);
  check(ids.length === 115, `Phase 0 (Nekromant-V2): ${ids.length} Karten statt 115`);
  check(new Set(ids).size === ids.length, 'Phase 0 (Nekromant-V2): doppelte ID im Pool');
  let badKey = 0;
  for (const k in U) if (U[k].id !== k) badKey++;
  check(badKey === 0, `Phase 0 (Nekromant-V2): ${badKey} Karte(n), deren id vom Objektschluessel abweicht`);

  // (b) gueltige Seltenheit; jede Karte hat ein isUnique-Feld (Boolean);
  //     alle legendaeren UND alle Aktivkarten (tag "gadget") sind isUnique;
  //     KEINE Karte traegt mehr ein maxStacks-Feld (v4 hat es ersatzlos
  //     abgeschafft -- nicht einzigartige Karten sind unbegrenzt stapelbar).
  // Champion-/Nekromant-Nachschliff Abschnitt 7/8: ghost_111 (legendaer,
  // Wiederbelebungschance) und ghost_115 (legendaer, Champion-Lebensdauer)
  // sind ABSICHTLICH nicht isUnique -- der Auftrag verlangt ausdruecklich
  // "alle fuenf [Karten je Kategorie] wiederholbar, unbegrenzt stapelbar",
  // das steht ueber der aelteren v4-Pauschalregel "legendaer = isUnique".
  const LEGENDARY_REPEATABLE_EXCEPTIONS = new Set(['ghost_111', 'ghost_115']);
  let badRarity = 0, badUniqueField = 0, badLegendaryUnique = 0, badGadgetUnique = 0;
  let hasMaxStacks = 0, badSigClass = 0, badSpread = 0;
  for (const k in U) {
    const d = U[k];
    if (!RARITIES.has(d.rarity)) badRarity++;
    if (typeof d.isUnique !== 'boolean') badUniqueField++;
    if (d.rarity === 'legendary' && d.isUnique !== true && !LEGENDARY_REPEATABLE_EXCEPTIONS.has(k)) badLegendaryUnique++;
    if (d.tag === 'gadget' && d.isUnique !== true) badGadgetUnique++;
    if (Object.prototype.hasOwnProperty.call(d, 'maxStacks')) hasMaxStacks++;
    if (d.signatureClass !== 'c_necro') badSigClass++;
    if (!Array.isArray(d.tags) || !d.tags.some((t) => PATH_TAGS.has(t))) badSpread++;
  }
  check(badRarity === 0, `Phase 0 (Nekromant-V2): ${badRarity} Karte(n) mit ungueltiger Seltenheit`);
  check(badUniqueField === 0, `Phase 0 (Nekromant-V2): ${badUniqueField} Karte(n) ohne gueltiges isUnique-Feld`);
  check(badLegendaryUnique === 0, `Phase 0 (Nekromant-V2): ${badLegendaryUnique} legendaere Karte(n) ohne isUnique`);
  check(badGadgetUnique === 0, `Phase 0 (Nekromant-V2): ${badGadgetUnique} Aktivkarte(n) (tag "gadget") ohne isUnique`);
  check(hasMaxStacks === 0, `Phase 0 (Nekromant-V2): ${hasMaxStacks} Karte(n) tragen noch ein maxStacks-Feld (v4 hat es abgeschafft)`);
  check(badSigClass === 0, `Phase 0 (Nekromant-V2): ${badSigClass} Karte(n) ohne signatureClass "c_necro"`);
  check(badSpread === 0, `Phase 0 (Nekromant-V2): ${badSpread} Karte(n) ohne mindestens ein Pfad-Tag (allgemein/opfer/legion/alpha)`);

  // (c) requires loest auf; keine Ketten (eine Voraussetzung hat selbst kein
  //     eigenes requires). Champion-/Nekromant-Nachschliff Abschnitt 6: drei
  //     neue Fusions-Verstaerkerkarten (Einziges Schwert/Schild/Bogen)
  //     haengen bewusst ebenfalls an ghost_071 ("ohne aktive Verschmelzungs-
  //     karte wirkungslos", exakt derselbe Grund wie bei den drei
  //     urspruenglichen v4-Abhaengigkeiten) -- die alten v4-Obergrenzen (3
  //     Abhaengige je Karte, 4 Karten insgesamt mit requires) waren ein
  //     reiner Schnappschuss des v4-Imports, keine Spielregel, und sind
  //     entsprechend erweitert (6 bzw. 7).
  let unresolved = 0, chained = 0, withRequires = 0;
  const dependents = {};
  for (const k in U) {
    const reqs = U[k].requires || [];
    if (reqs.length > 0) withRequires++;
    for (const r of reqs) {
      if (!U[r]) unresolved++;
      else {
        if ((U[r].requires || []).length > 0) chained++;
        dependents[r] = (dependents[r] || 0) + 1;
      }
    }
  }
  check(unresolved === 0, `Phase 0 (Nekromant-V2): ${unresolved} requires-Eintraege loesen nicht auf eine echte ID auf`);
  check(chained === 0, `Phase 0 (Nekromant-V2): ${chained} requires-Kette(n) (eine Voraussetzung hat selbst ein requires)`);
  const overCrowded = Object.values(dependents).filter((n) => n > 6).length;
  check(overCrowded === 0, `Phase 0 (Nekromant-V2): ${overCrowded} Karte(n) mit mehr als 6 abhaengigen Karten`);
  check(withRequires <= 7, `Phase 0 (Nekromant-V2): ${withRequires} Karte(n) mit requires statt hoechstens 7`);

  // (d) kein Kartentext enthaelt Reste der ueberholten Fassung-1-Spec
  //     ("Meter" -- alte Ring-/Radius-Einheit, "Abprall" -- Bandenschuss,
  //     seit Grundsteinumbau Phase 1 komplett entfernt).
  let forbidden = 0;
  for (const k in U) {
    const text = `${U[k].name} ${U[k].description}`;
    if (/Meter|Abprall/i.test(text)) forbidden++;
  }
  check(forbidden === 0, `Phase 0 (Nekromant-V2): ${forbidden} Kartentext(e) enthalten "Meter" oder "Abprall"`);
}

// ---- 56. Nekromant-V2 Phase 2: Engine-Luecken (Resistenz, Schild, Durchschlag) --
// Drei generische Systeme, die noch keine echte Karte im Pool nutzt (Phase 6+
// baut die Karten). Mechanismus mit EIGENEN, oft absichtlich extremen Zahlen
// geprueft (nicht den echten balance.json-Werten -- die sind aktuell ueberall
// 0/inert), Gegenprobe fuer jeden Kernpunkt bestanden.
{
  const { createBullet } = await import('../src/game/bullet.js');
  const { stepState } = await import('../src/game/state.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  const freshPlayer = () => {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const p = st.player;
    p.hp = 100;
    p.cfg.maxHp = 100;
    p.protect = 0;
    p.shieldReady = false;
    p.shield = 0;
    p.cfg.resist = 0;
    p.cfg.shieldMax = 0;
    p.cfg.shieldRegenPerS = 0;
    p.executing = false;
    return { st, p };
  };

  // (a) Resistenz-Formel MIT EIGENEN ZAHLEN: divisor 100 (echter balance-Wert
  //     -- die Formelkonstante selbst ist kein Balancewert, s. balance.json:
  //     _comment_resist), aber Resistenz-SUMME und Treffer frei erfunden.
  //     100 Punkte halbieren, 200 dritteln -- exakt wie im Auftrag vorgerechnet.
  {
    const divisor = tanksData.balance.resist.divisor;
    check(divisor === 100, `Phase 2 (Nekromant-V2): balance.resist.divisor ist ${divisor} statt 100 -- Testannahme unten passt sonst nicht`);
    {
      const { st, p } = freshPlayer();
      p.cfg.resist = 100;
      st.applyDamage(p, 100, 'test', {});
      check(p.hp === 50, `Phase 2 (Nekromant-V2): 100 Resistenz halbiert 100 Schaden nicht (hp ${p.hp} statt 50)`);
    }
    {
      const { st, p } = freshPlayer();
      p.cfg.resist = 200;
      st.applyDamage(p, 100, 'test', {});
      check(p.hp === 67, `Phase 2 (Nekromant-V2): 200 Resistenz drittelt 100 Schaden nicht (hp ${p.hp} statt 67, 100/round(3)=33 abgezogen)`);
    }
  }

  // (b) KEINE Obergrenze: eine viel hoehere Resistenzsumme nimmt IMMER
  //     WEITER weniger Schaden, es gibt keinen Punkt, ab dem der genommene
  //     Schaden stehen bleibt (das waere der verbotene Math.min(...,0.6)-
  //     Clamp). Trotzdem NIE null -- mindestens 1 Punkt kommt immer durch.
  {
    const genommen = (resist) => {
      const { st, p } = freshPlayer();
      p.cfg.resist = resist;
      st.applyDamage(p, 100, 'test', {});
      return 100 - p.hp;
    };
    const bei500 = genommen(500);
    const bei5000 = genommen(5000);
    const beiExtrem = genommen(1000000);
    check(bei5000 < bei500, `Phase 2 (Nekromant-V2): 5000 Resistenz nimmt nicht weniger als 500 (${bei5000} vs ${bei500}) -- sieht nach einem versteckten Deckel aus`);
    check(beiExtrem >= 1, `Phase 2 (Nekromant-V2): extreme Resistenz macht komplett unverwundbar (genommener Schaden ${beiExtrem}, sollte >=1 sein)`);
  }

  // (c) Resistenz wirkt AUCH auf Schaden ueber Zeit (DOT) -- anders als alle
  //     Schild-Gatter, die DOT bewusst ignorieren (Phase 5).
  {
    const { st, p } = freshPlayer();
    p.cfg.resist = 100; // halbiert
    st.applyDamage(p, 20, 'test', { overTime: true });
    check(p.hp === 90, `Phase 2 (Nekromant-V2): Resistenz wirkt nicht auf Schaden ueber Zeit (hp ${p.hp} statt 90)`);
  }

  // (d) Schild-Punktepool: faengt Schaden VOR hp ab, Rest faellt durch.
  {
    const { st, p } = freshPlayer();
    p.cfg.shieldMax = 30;
    p.shield = 30;
    st.applyDamage(p, 50, 'test', {});
    check(p.shield === 0, `Phase 2 (Nekromant-V2): Schildpool nicht komplett verbraucht (${p.shield} statt 0)`);
    check(p.hp === 80, `Phase 2 (Nekromant-V2): Restschaden (50-30) nicht von hp abgezogen (hp ${p.hp} statt 80)`);
  }

  // (e) Ein kleinerer Treffer wird GANZ abgefangen, der Pool behaelt seinen Rest.
  {
    const { st, p } = freshPlayer();
    p.cfg.shieldMax = 30;
    p.shield = 30;
    st.applyDamage(p, 10, 'test', {});
    check(p.hp === 100, `Phase 2 (Nekromant-V2): kleiner Treffer nicht ganz vom Schildpool abgefangen (hp ${p.hp})`);
    check(p.shield === 20, `Phase 2 (Nekromant-V2): Schildpool-Rest ${p.shield} statt 20`);
  }

  // (f) Schild-Punktepool ueberspringt DOT (wie alle anderen Schild-Gatter,
  //     Phase 5) -- nur die Resistenz wirkt auf DOT (s. (c)).
  {
    const { st, p } = freshPlayer();
    p.cfg.shieldMax = 50;
    p.shield = 50;
    st.applyDamage(p, 20, 'test', { overTime: true });
    check(p.shield === 50, `Phase 2 (Nekromant-V2): Schildpool faengt faelschlich einen DOT-Tick ab (${p.shield} statt 50)`);
    check(p.hp === 80, `Phase 2 (Nekromant-V2): DOT zieht bei ignoriertem Schildpool nicht die volle Zahl ab (hp ${p.hp} statt 80)`);
  }

  // (g) Namenskollision-Test: der neue Pool ist von shieldCharges (Notschild)
  //     UND shieldHp/shieldReady (aeltere schild-Karte) unabhaengig -- alle
  //     drei bleiben unangetastet nebeneinander bestehen.
  {
    const { st, p } = freshPlayer();
    p.cfg.shieldMax = 20;
    p.shield = 20;
    st.shieldCharges = [3];
    p.shieldReady = true;
    p.shieldHp = 40;
    p.cfg.shieldAbsorb = 40;
    st.applyDamage(p, 5, 'test', {});
    check(p.shield === 15, `Phase 2 (Nekromant-V2): der neue Pool haette den Treffer abfangen sollen (shield ${p.shield} statt 15)`);
    check(st.shieldCharges.length === 1, `Phase 2 (Nekromant-V2): Notschild-Ladung faelschlich verbraucht (${st.shieldCharges.length} statt 1)`);
    check(p.shieldHp === 40, `Phase 2 (Nekromant-V2): aelterer Absorber (shieldHp) faelschlich angefasst (${p.shieldHp} statt 40)`);
  }

  // (h) Schild-Regeneration: laedt bis shieldMax auf, nie darueber.
  {
    const { st, p } = freshPlayer();
    p.cfg.shieldMax = 50;
    p.shield = 10;
    p.cfg.shieldRegenPerS = 20;
    stepState(st, CMD0, 0.1);
    check(Math.abs(p.shield - 12) < 1e-6, `Phase 2 (Nekromant-V2): Schildregeneration falsch (${p.shield} statt 12 nach 0.1s bei 20/s)`);
    p.shield = 45;
    stepState(st, CMD0, 1);
    check(p.shield === 50, `Phase 2 (Nekromant-V2): Schildregeneration ueberschreitet shieldMax (${p.shield} statt gedeckelt bei 50)`);
  }

  // (i) cfg.js: die vier neuen core-Schluessel (resistAdd/pierceAdd/
  //     shieldMaxAdd/shieldRegenAdd) sind additiv UND werden von der
  //     Rastplatz-Stufenskalierung (Grundsteinumbau Phase 7) automatisch mit
  //     erfasst -- kein Sonderfall in scaleCore() noetig, weil sie dem
  //     bestehenden "*Add"-Namensmuster folgen. EIGENE Zahlen (bonusPct 1.0),
  //     nicht der echte balance.upgradeLevel-Wert.
  {
    const synU = { upgrades: { testcard56: { core: { resistAdd: 5, pierceAdd: 1, shieldMaxAdd: 10, shieldRegenAdd: 2 } } } };
    const base = resolveCfg(tanksData, 'player');
    const lvl0 = applyUpgrades({ ...base }, { testcard56: 1 }, synU, 'mine', null, {}, { bonusPct: 1.0, maxLevel: 5 });
    check(lvl0.resist === 5, `Phase 2 (Nekromant-V2): resistAdd wird nicht uebernommen (${lvl0.resist} statt 5)`);
    check(lvl0.pierce === 1, `Phase 2 (Nekromant-V2): pierceAdd wird nicht uebernommen (${lvl0.pierce} statt 1)`);
    check(lvl0.shieldMax === 10, `Phase 2 (Nekromant-V2): shieldMaxAdd wird nicht uebernommen (${lvl0.shieldMax} statt 10)`);
    check(lvl0.shieldRegenPerS === 2, `Phase 2 (Nekromant-V2): shieldRegenAdd wird nicht uebernommen (${lvl0.shieldRegenPerS} statt 2)`);
    // Stufe 2, bonusPct 1.0 -> sm = 1 + 2*1 = 3 -> jeder Wert verdreifacht.
    const lvl2 = applyUpgrades({ ...base }, { testcard56: 1 }, synU, 'mine', null, { testcard56: 2 }, { bonusPct: 1.0, maxLevel: 5 });
    check(lvl2.resist === 15, `Phase 2 (Nekromant-V2): resistAdd skaliert nicht mit der Rastplatz-Stufe (${lvl2.resist} statt 15)`);
    check(lvl2.shieldMax === 30, `Phase 2 (Nekromant-V2): shieldMaxAdd skaliert nicht mit der Rastplatz-Stufe (${lvl2.shieldMax} statt 30)`);
  }

  // (j) Durchschlag: ein Geschoss mit pierce:1 durchschlaegt EIN Ziel, ohne
  //     zu sterben, trifft ein zweites, und stirbt danach (kein Durchschlag
  //     mehr) -- die Trefferliste verhindert, dass dasselbe Ziel im
  //     naechsten Tick (ohne Bewegung) ein zweites Mal getroffen wird.
  {
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    st.tanks.length = 0;
    st.tanks.push(st.player);
    const mk = (x, y) => ({
      ...proto, x, y, prevX: x, prevY: y, heading: 0,
      alive: true, hp: 100, protect: 0, shieldReady: false, shield: 0, status: {},
      cfg: { ...proto.cfg, role: 'guardian', maxHp: 100, armor: null, requiresRicochet: false, resist: 0, shieldMax: 0 },
    });
    const z1 = mk(200, 250);
    const z2 = mk(400, 400);
    st.tanks.push(z1, z2);
    const b = createBullet(z1.x, z1.y, 0, {
      speed: 0, radius: 3, owner: st.player, kind: 'bullet', damage: 10, damageType: 'physical', pierce: 1,
    });
    b.age = 5;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
    check(z1.hp === 90, `Phase 2 (Nekromant-V2): Durchschlag -- erster Treffer fehlt (z1.hp ${z1.hp} statt 90)`);
    check(!b.dead, 'Phase 2 (Nekromant-V2): Geschoss mit verbleibendem Durchschlag ist trotzdem gestorben');
    check(b.pierce === 0, `Phase 2 (Nekromant-V2): b.pierce nicht heruntergezaehlt (${b.pierce} statt 0)`);
    // Erneuter Schritt am selben Ort: die Trefferliste muss einen zweiten
    // Treffer auf z1 verhindern.
    stepState(st, CMD0, 1 / 60);
    check(z1.hp === 90, 'Phase 2 (Nekromant-V2): Durchschlag -- dasselbe Ziel wurde ein zweites Mal getroffen (Trefferliste wirkungslos)');
    // "Weiterflug" zu z2 simulieren, dann treffen -- kein Durchschlag mehr
    // uebrig, das Geschoss muss diesmal sterben.
    b.x = z2.x;
    b.y = z2.y;
    b.prevX = z2.x;
    b.prevY = z2.y;
    stepState(st, CMD0, 1 / 60);
    check(z2.hp === 90, `Phase 2 (Nekromant-V2): Durchschlag -- zweiter Treffer fehlt (z2.hp ${z2.hp} statt 90)`);
    check(b.dead, 'Phase 2 (Nekromant-V2): Geschoss ohne verbleibenden Durchschlag haette sterben muessen');
  }

  // (k) Untertanen (Geister) sind ausdruecklich mitgemeint: dieselbe
  //     Resistenz-/Schildpool-Logik wirkt auch in der getrennten
  //     Geister-Kollisionsschleife.
  {
    const { createGhost, pushGhost } = await import('../src/game/ghost.js');
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const enemy = st.tanks.find((t) => t !== st.player && t.alive);
    st.ghosts.length = 0;
    // Nachschliff ("Champion muss ein eigenstaendiger Geisterpanzer sein"):
    // ein solo gepushter Geist wuerde in stepState() ueber updateGhosts()
    // sofort selbst zum Champion befoerdert -- das ueberschreibt die unten
    // manuell gesetzten hp/maxHp/shield-Werte MITTEN im Test. Ein zuerst per
    // pushGhost() gesetzter Anker haelt den Champion-Titel.
    // Anker weit weg von g/enemy, sonst trifft die Testkugel (radius 3,
    // Position exakt bei enemy.x/y) versehentlich den Anker statt g.
    pushGhost(st, createGhost(st, enemy.x + 5000, enemy.y + 5000, 0));
    const g = createGhost(st, enemy.x, enemy.y, 0);
    g.cfg.resist = 100; // halbiert
    g.cfg.shieldMax = 5;
    g.shield = 5;
    g.hp = 100;
    g.cfg.maxHp = 100;
    st.ghosts.push(g);
    check(!g.isChampion, 'Phase 2 (Nekromant-V2): Vorbedingung -- g ist faelschlich Champion');
    const b = createBullet(g.x, g.y, 0, {
      speed: 0, radius: 3, owner: enemy, kind: 'bullet', damage: 30,
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    // (30 -> Resistenz halbiert auf 15 -> Schildpool faengt 5 ab -> 10 verbleiben)
    stepState(st, CMD0, 1 / 60);
    check(g.shield === 0, `Phase 2 (Nekromant-V2): Geister-Schildpool nicht verbraucht (${g.shield} statt 0)`);
    check(g.hp === 90, `Phase 2 (Nekromant-V2): Geister-Resistenz/Schildpool falsch verrechnet (g.hp ${g.hp} statt 90)`);
  }

  // (l) Renderer: die neue Schild-Leiste erscheint nur, wenn cfg.shieldMax
  //     gesetzt ist, und ist ein ZUSAETZLICHER 3px-fillRect gegenueber der
  //     Lebensleiste -- Muster wie der bestehende Lebensleisten-Renderpfad-
  //     Test (Abschnitt 2f), derselbe aufzeichnende Canvas aus domstub.mjs.
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
      const balken = () => {
        ctx.calls.length = 0;
        renderer.render(st, 0, tracks, null, null);
        return ctx.calls.filter((c) => c.fn === 'fillRect' && c.args[3] === 3).length;
      };
      const ohne = balken();
      st.player.cfg.shieldMax = 40;
      st.player.shield = 20;
      const mit = balken();
      check(mit === ohne + 1, `Phase 2 (Nekromant-V2): Schild-Leiste erscheint nicht als zusaetzlicher Balken (${mit} statt ${ohne + 1})`);
      st.player.cfg.shieldMax = 0;
      const wiederOhne = balken();
      check(wiederOhne === ohne, `Phase 2 (Nekromant-V2): Schild-Leiste verschwindet nicht wieder bei shieldMax 0 (${wiederOhne} statt ${ohne})`);
    } finally {
      restore();
    }
  }
}

// ---- 57. Nekromant-V2 Phase 5: Ereignis- und Stapelschicht ---------------
// Das Fundament fuer alle 105 Karten -- NOCH KEINE Karte hoert zu (Phase 6+
// fuellt state.necroListeners), s. src/game/necro.js Kopfkommentar. Mechanismus
// mit synthetischen Test-Listenern geprueft (Muster wie Abschnitt 56), Gegen-
// probe fuer jeden Kernpunkt bestanden.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const {
    onGhostRemoved,
    countsAsGhostDeath,
    addNecroStack,
    getNecroStack,
    addNecroTimedStack,
    getNecroTimedStack,
    tickNecroTimers,
    countThresholdCrossings,
    applyVirtualNecroDeaths,
    NECRO_REASONS,
  } = await import('../src/game/necro.js');
  const { createGhost, killGhost } = await import('../src/game/ghost.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');

  const necroRoom = () => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: ['t_pink'],
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    return st;
  };

  // (a) Struktur: die vier Ausloeser + die "loest Todeseffekte aus"-Tabelle
  // aus dem Auftrag (death_damage/death_expire/sacrifice ja, fusion nein).
  {
    check(
      NECRO_REASONS.length === 4 &&
        ['death_damage', 'death_expire', 'fusion', 'sacrifice'].every((r) => NECRO_REASONS.includes(r)),
      `Phase 5: NECRO_REASONS enthaelt nicht genau die vier Ausloeser (${NECRO_REASONS})`,
    );
    check(countsAsGhostDeath('death_damage'), 'Phase 5: death_damage zaehlt nicht als Geistertod');
    check(countsAsGhostDeath('death_expire'), 'Phase 5: death_expire zaehlt nicht als Geistertod');
    check(countsAsGhostDeath('sacrifice'), 'Phase 5: sacrifice zaehlt nicht als Geistertod');
    check(!countsAsGhostDeath('fusion'), 'Phase 5: fusion zaehlt faelschlich als Geistertod');
  }

  // (b) Zentrale Zustellung: ein Listener wird NUR fuer seine deklarierten
  // Gruende aufgerufen, kein switch(id) -- zwei verschiedene Listener mit
  // disjunkten reasons[] duerfen sich nie gegenseitig ausloesen.
  {
    const st = necroRoom();
    let damageFired = 0;
    let expireFired = 0;
    st.necroListeners.push({ reasons: ['death_damage'], scope: 'room', key: 'testA', fn: () => damageFired++ });
    st.necroListeners.push({ reasons: ['death_expire'], scope: 'room', key: 'testB', fn: () => expireFired++ });
    const g = createGhost(st, 0, 0, 0, 't_pink');
    onGhostRemoved(st, g, 'death_damage');
    check(damageFired === 1 && expireFired === 0, `Phase 5: death_damage loest den falschen Listener aus (${damageFired}/${expireFired})`);
    onGhostRemoved(st, g, 'death_expire');
    check(damageFired === 1 && expireFired === 1, `Phase 5: death_expire loest den falschen Listener aus (${damageFired}/${expireFired})`);
  }

  // (c) Automatische _deaths-Buchfuehrung (raum- UND runweit): jeder Ausloeser
  // ausser fusion erhoeht den reservierten Stapel um 1 -- OHNE dass irgendein
  // Listener registriert ist (die Buchfuehrung ist unabhaengig von Karten).
  {
    const st = necroRoom();
    const g = createGhost(st, 0, 0, 0, 't_pink');
    onGhostRemoved(st, g, 'death_damage');
    onGhostRemoved(st, g, 'death_expire');
    onGhostRemoved(st, g, 'sacrifice');
    onGhostRemoved(st, g, 'fusion');
    check(getNecroStack(st, 'room', '_deaths') === 3, `Phase 5: _deaths-Stapel (raumweit) ${getNecroStack(st, 'room', '_deaths')} statt 3`);
    check(getNecroStack(st, 'run', '_deaths') === 3, `Phase 5: _deaths-Stapel (runweit) ${getNecroStack(st, 'run', '_deaths')} statt 3`);
  }

  // (d) Raumweiter Stapel ist NUR fuer diesen Raum gueltig -- ein frischer
  // createState()-Aufruf (naechster Raum) startet garantiert bei 0, ueber
  // die ECHTE Erzeugung geprueft, nicht nur behauptet.
  {
    const st1 = necroRoom();
    addNecroStack(st1, 'room', 'testKey', 7);
    check(getNecroStack(st1, 'room', 'testKey') === 7, 'Phase 5: raumweiter Stapel schreibt/liest nicht korrekt');
    const st2 = necroRoom(); // simuliert den naechsten Raum
    check(getNecroStack(st2, 'room', 'testKey') === 0, `Phase 5: raumweiter Stapel ueberlebt einen Raumwechsel (${getNecroStack(st2, 'room', 'testKey')})`);
  }

  // (e) Runweiter Stapel: state.js kennt kein run-Objekt -- run.js: stepRun()
  // synchronisiert den Zuwachs per Delta (wie bonusScrap), geprueft an einem
  // ECHTEN Run. Der Raumwechsel selbst (Testschritt 2+3: raumweit weg, runweit
  // bleibt) wird -- wie schon in Abschnitt 43(i) fuer Geister -- ueber einen
  // zweiten, echten createState()-Aufruf simuliert statt die volle
  // Kartenwahl-/Shop-Zustandsmaschine von run.js nachzubauen; das prueft
  // denselben Mechanismus (necroRunStacksBase-Kopie beim Raumaufbau), ohne
  // Kartenscreens durchzuklicken.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 42, 'normal', { starterTank: 'c_necro' });
    check(run.starterTank === 'c_necro', `Phase 5: Vorbedingung -- Run laeuft als ${run.starterTank} statt c_necro`);
    run.phase = 'playing';
    const st = run.state;
    const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
    addNecroStack(st, 'room', 'roomKey', 5);
    addNecroStack(st, 'run', 'runKey', 3);
    stepRun(run, CMD0, 1 / 60); // synchronisiert den runweiten Zuwachs
    check(run.necroStacks.runKey === 3, `Phase 5: runweiter Stapel wird nicht in run.necroStacks synchronisiert (${run.necroStacks.runKey})`);

    // Naechster Raum: frisches createState() mit necroRunStacksBase aus
    // run.necroStacks -- exakt das Opt, das run.js: buildCombatRoom() liefert.
    const st2 = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: ['t_pink'],
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
      necroRunStacksBase: { ...run.necroStacks },
    });
    check(
      getNecroStack(st2, 'room', 'roomKey') === 0,
      `Phase 5: raumweiter Stapel ueberlebt den Raumwechsel (${getNecroStack(st2, 'room', 'roomKey')})`,
    );
    // Der runweite Gesamtwert bleibt im neuen Raum korrekt lesbar.
    check(
      getNecroStack(st2, 'run', 'runKey') === 3,
      `Phase 5: runweiter Stapel ist im neuen Raum nicht mehr lesbar (${getNecroStack(st2, 'run', 'runKey')})`,
    );
    // Weiterer Zuwachs im neuen Raum addiert sich korrekt auf den Altwert --
    // KEINE Doppelzaehlung durch eine geteilte Referenz statt einer Kopie.
    addNecroStack(st2, 'run', 'runKey', 2);
    check(
      getNecroStack(st2, 'run', 'runKey') === 5,
      `Phase 5: runweiter Stapel zaehlt nach einem Raumwechsel falsch weiter (${getNecroStack(st2, 'run', 'runKey')}, Doppelzaehlung?)`,
    );
  }

  // (e2) Dieselbe Behauptung, aber ueber den ECHTEN buildCombatRoom()-Pfad
  // (run.js) statt eines von Hand nachgebauten createState()-Aufrufs -- das
  // haette einen echten Fund (necroRunStacksBase als geteilte REFERENZ statt
  // einer Kopie, sichtbar erst NACH einem zweiten Sync-Tick im neuen Raum,
  // sonst zufaellig unauffaellig) im 'Weiter' des Auftrags sonst nicht
  // gefangen. driveOneRoom() faehrt den echten run.js-Zustandsautomaten
  // (Kartenwahl/Upgrade-Screen inklusive) bis zum naechsten Raumwechsel.
  {
    const driveOneRoom = (run) => {
      const startRoom = run.roomIndex;
      const startAct = run.actIndex;
      let guard = 20000;
      while (guard-- > 0) {
        if (run.phase === 'victory' || run.phase === 'gameover') return false;
        if (run.roomIndex !== startRoom || run.actIndex !== startAct) return true;
        if (run.phase === 'preview') enterRoom(run);
        else if (run.phase === 'transition') stepRun(run, CMD, STEP);
        else if (run.phase === 'playing') {
          cheatKillAll(run.state);
          stepRun(run, CMD, STEP);
        } else if (run.phase === 'upgrade') chooseUpgrade(run, 0);
        else if (run.phase === 'map') pickMapNode(run);
        else if (run.phase === 'workshop') leaveWorkshop(run);
        else if (run.phase === 'event') chooseEventOption(run, 0);
        else if (run.phase === 'rest') passRest(run);
        else if (run.phase === 'bossReward') passBossReward(run);
        else if (run.phase === 'actComplete') advanceAct(run);
        else return false;
      }
      return false;
    };
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 99, 'normal', { starterTank: 'c_necro' });
    run.phase = 'playing';
    addNecroStack(run.state, 'run', 'realRunKey', 4);
    stepRun(run, CMD, STEP);
    check(run.necroStacks.realRunKey === 4, `Phase 5: Vorbedingung -- Sync vor dem Raumwechsel schlaegt fehl (${run.necroStacks.realRunKey})`);
    const advanced = driveOneRoom(run);
    check(advanced, `Phase 5: Vorbedingung -- kein echter Raumwechsel ueber run.js erreicht (Phase "${run.phase}")`);
    // driveOneRoom() haelt beim ALLERERSTEN Anzeichen eines neuen Raums an
    // (typischerweise noch Phase 'preview') -- stepRun() ist dort ein No-op
    // (nur Phase 'playing'/'transition' laufen durch), der Sync-Tick unten
    // braeuchte den Raum sonst wirkungslos. Bis 'playing' weiterfahren.
    let enterGuard = 1000;
    while (run.phase !== 'playing' && enterGuard-- > 0) {
      if (run.phase === 'preview') enterRoom(run);
      else stepRun(run, CMD, STEP);
    }
    check(run.phase === 'playing', `Phase 5: Vorbedingung -- der neue Raum erreicht "playing" nicht (Phase "${run.phase}")`);
    // Ein weiterer Zuwachs IM NEUEN Raum + ein Sync-Tick zeigt die
    // Referenz-vs-Kopie-Falle: mit einer geteilten Referenz waere
    // necroRunStacksBase nach dem Sync-Tick bereits der NEUE Gesamtwert,
    // necroRunStackGain zaehlt den Zuwachs dann ein zweites Mal oben drauf.
    addNecroStack(run.state, 'run', 'realRunKey', 1);
    stepRun(run, CMD, STEP);
    check(
      getNecroStack(run.state, 'run', 'realRunKey') === 5,
      `Phase 5: runweiter Stapel zaehlt nach einem ECHTEN, ueber buildCombatRoom() erzeugten Raumwechsel falsch (${getNecroStack(run.state, 'run', 'realRunKey')} statt 5) -- necroRunStacksBase eine geteilte Referenz statt einer Kopie?`,
    );
  }

  // (f) Speichern und Laden: runweite Stapel stimmen nach einem echten
  // Snapshot + createRun({resume}) (Testschritt 4).
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 7, 'normal', { starterTank: 'c_necro' });
    run.phase = 'playing';
    const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
    addNecroStack(run.state, 'run', 'saveKey', 9);
    stepRun(run, CMD0, 1 / 60);
    const snap = runSnapshot(run);
    check(snap.necroStacks.saveKey === 9, `Phase 5: runSnapshot() vergisst den runweiten Stapel (${snap.necroStacks.saveKey})`);
    const resumed = createRun(tanksData, tilesData, diffData, upgradesData, 7, 'normal', { resume: snap });
    check(resumed.necroStacks.saveKey === 9, `Phase 5: ein wiederhergestellter Run verliert den runweiten Stapel (${resumed.necroStacks.saveKey})`);
  }

  // (g) Zeitlich befristete Stapel: eigene Restlaufzeit je Schluessel, laeuft
  // ab, ein erneutes Auftragen VOR dem Ablauf erneuert nur die Dauer.
  {
    const st = necroRoom();
    addNecroTimedStack(st, 'buff', 15, 5);
    check(getNecroTimedStack(st, 'buff') === 15, 'Phase 5: zeitlich befristeter Stapel liest den falschen Wert');
    tickNecroTimers(st, 3); // 3 von 5 s vergangen
    check(getNecroTimedStack(st, 'buff') === 15, 'Phase 5: zeitlich befristeter Stapel verfaellt vor Ablauf');
    addNecroTimedStack(st, 'buff', 20, 5); // erneutes Auftragen: neuer Wert, Dauer erneuert
    tickNecroTimers(st, 4); // waere ohne Erneuerung (Rest 2s von der ersten Vergabe) laengst abgelaufen
    check(getNecroTimedStack(st, 'buff') === 20, `Phase 5: erneutes Auftragen erneuert die Dauer nicht (${getNecroTimedStack(st, 'buff')})`);
    tickNecroTimers(st, 2); // insgesamt 6s seit der Erneuerung -> abgelaufen
    check(getNecroTimedStack(st, 'buff') === 0, `Phase 5: zeitlich befristeter Stapel verfaellt nicht nach Ablauf (${getNecroTimedStack(st, 'buff')})`);
  }

  // (h) "Zaehler": countThresholdCrossings() mit EIGENEN, teils sehr grossen
  // Zahlen -- Ganzzahlteilung auf dem Gesamtwert, kein Ueberlauf/NaN.
  {
    check(countThresholdCrossings(5, 25, 10) === 2, `Phase 5: Schwellenwert-Sprung falsch gezaehlt (${countThresholdCrossings(5, 25, 10)} statt 2)`);
    check(countThresholdCrossings(5, 9, 10) === 0, 'Phase 5: eine nicht erreichte Schwelle zaehlt trotzdem');
    check(countThresholdCrossings(9, 10, 10) === 1, 'Phase 5: die exakt erreichte Schwelle zaehlt nicht');
    const big = countThresholdCrossings(0, 2 ** 40, 1);
    check(big === 2 ** 40, `Phase 5: sehr grosse Werte verlieren Praezision (${big} statt ${2 ** 40})`);
    check(!Number.isNaN(big), 'Phase 5: sehr grosse Werte erzeugen NaN');
  }

  // (i) Interne Abklingzeit JE EFFEKT-SCHLUESSEL, nicht global: zwei
  // Listener mit unterschiedlichem key stoeren sich nicht gegenseitig, und
  // NACH Ablauf der Abklingzeit (state.time vorgerueckt) loest derselbe
  // Schluessel erneut aus.
  {
    const st = necroRoom();
    let firedA = 0;
    let firedOther = 0;
    st.necroListeners.push({ reasons: ['death_damage'], scope: 'room', key: 'cdA', cooldownS: 1, fn: () => firedA++ });
    st.necroListeners.push({ reasons: ['death_damage'], scope: 'room', key: 'cdOther', cooldownS: 1, fn: () => firedOther++ });
    const g = createGhost(st, 0, 0, 0, 't_pink');
    onGhostRemoved(st, g, 'death_damage');
    check(firedA === 1 && firedOther === 1, `Phase 5: erste Ausloesung schlaegt fehl (${firedA}/${firedOther})`);
    onGhostRemoved(st, g, 'death_damage'); // sofort wieder, beide Abklingzeiten aktiv
    check(firedA === 1 && firedOther === 1, `Phase 5: die interne Abklingzeit blockt nicht (${firedA}/${firedOther})`);
    st.time += 1.1; // Abklingzeit abgelaufen
    onGhostRemoved(st, g, 'death_damage');
    check(firedA === 2 && firedOther === 2, `Phase 5: nach Ablauf der Abklingzeit loest der Effekt nicht erneut aus (${firedA}/${firedOther})`);
  }

  // (j) Testschritt 5, woertlich: zwei Untertanen sterben im SELBEN Tick
  // (state.time unveraendert zwischen beiden killGhost()-Aufrufen) bei
  // aktiver interner Abklingzeit -- der Effekt loest nur EINMAL aus.
  {
    const st = necroRoom();
    let fired = 0;
    st.necroListeners.push({ reasons: ['death_damage'], scope: 'room', key: 'doubleKill', cooldownS: 1, fn: () => fired++ });
    const g1 = createGhost(st, 0, 0, 0, 't_pink');
    const g2 = createGhost(st, 10, 10, 0, 't_pink');
    killGhost(st, g1); // cause 'damage' (Standard)
    killGhost(st, g2); // derselbe Tick, state.time unveraendert
    check(fired === 1, `Phase 5: zwei Tode im selben Tick loesen den Effekt ${fired} statt 1 mal aus`);
  }

  // (k) killGhost()-Verdrahtung: Schaden -> death_damage, Ablauf ->
  // death_expire, unterscheidbar im Ereignisprotokoll.
  {
    const st = necroRoom();
    const g1 = createGhost(st, 0, 0, 0, 't_pink');
    const g2 = createGhost(st, 10, 10, 0, 't_pink');
    killGhost(st, g1, 'damage');
    killGhost(st, g2, 'expire');
    const reasons = st.necroEventLog.map((e) => e.reason);
    check(reasons.includes('death_damage'), 'Phase 5: ein Schadenstod meldet sich nicht als death_damage');
    check(reasons.includes('death_expire'), 'Phase 5: ein Ablauftod meldet sich nicht als death_expire');
  }

  // (k2) Ein GERETTETER Untertan (Phylakterium) loest KEIN Ereignis aus --
  // er ist ja gar nicht gestorben.
  {
    const st = necroRoom();
    st.player.cfg.ghostCommanderShield = true;
    const g = createGhost(st, 0, 0, 0, 't_pink');
    g.isCommander = true;
    g.commanderShieldUsed = false;
    killGhost(st, g, 'damage');
    check(g.alive === true, 'Phase 5: Vorbedingung -- das Phylakterium hat den Untertan nicht gerettet');
    check(st.necroEventLog.length === 0, 'Phase 5: ein geretteter Untertan loest trotzdem ein Ereignis aus');
  }

  // (l) Virtuelle Tode (Pruefstein): treffen NUR raumweite, pureStack:true
  // death_damage/death_expire-Listener (Nekromant-V2 Phase 6: die
  // Einschraenkung auf pureStack ist NEU gegenueber Phase 5 -- jetzt gibt es
  // echte Listener mit Seiteneffekten, die ghost_035 ausdruecklich NICHT
  // treffen darf), NICHT run-/timed-scope, OHNE die automatische
  // Buchfuehrung/das Ereignisprotokoll zu beruehren, UND bypassen eine
  // bereits aktive interne Abklingzeit.
  {
    const st = necroRoom();
    let roomFired = 0;
    let runFired = 0;
    let sideEffectFired = 0;
    st.necroListeners.push({
      reasons: ['death_damage'], scope: 'room', key: 'virtRoom', cooldownS: 100, pureStack: true, fn: () => roomFired++,
    });
    st.necroListeners.push({ reasons: ['death_damage'], scope: 'run', key: 'virtRun', fn: () => runFired++ });
    // Nekromant-V2 Phase 6: ein raumweiter Listener OHNE pureStack (z. B.
    // Heilung/Explosion) darf von virtuellen Toden NIE ausgeloest werden --
    // exakt die Einschraenkung, die diese Phase gegenueber Phase 5 einfuehrt.
    st.necroListeners.push({
      reasons: ['death_damage'], scope: 'room', key: 'virtSideEffect', fn: () => sideEffectFired++,
    });
    // Abklingzeit VORAB "verbrauchen", damit der Bypass-Nachweis echt ist.
    const g = createGhost(st, 0, 0, 0, 't_pink');
    onGhostRemoved(st, g, 'death_damage'); // normaler Tod -- feuert alle drei Listener einmal
    check(
      roomFired === 1 && runFired === 1 && sideEffectFired === 1,
      `Phase 5: Vorbedingung -- normale Ausloesung feuert nicht alle Listener (${roomFired}/${runFired}/${sideEffectFired})`,
    );
    const deathsVor = getNecroStack(st, 'room', '_deaths');
    const logVor = st.necroEventLog.length;
    const runFiredVorVirtual = runFired;
    const sideEffectVorVirtual = sideEffectFired;
    applyVirtualNecroDeaths(st, 4);
    check(roomFired === 1 + 4, `Phase 5: virtuelle Tode ignorieren die aktive Abklingzeit nicht (${roomFired} statt 5)`);
    check(runFired === runFiredVorVirtual, `Phase 5: virtuelle Tode loesen faelschlich den runweiten Listener aus (${runFired} statt ${runFiredVorVirtual})`);
    check(
      sideEffectFired === sideEffectVorVirtual,
      `Phase 6: virtuelle Tode loesen faelschlich einen Nicht-pureStack-Listener aus (${sideEffectFired} statt ${sideEffectVorVirtual})`,
    );
    check(getNecroStack(st, 'room', '_deaths') === deathsVor, 'Phase 5: virtuelle Tode veraendern den _deaths-Stapel');
    check(st.necroEventLog.length === logVor, 'Phase 5: virtuelle Tode schreiben ins Ereignisprotokoll');
  }

  // (m) Debug-Overlay (Testschritt 1): Schaden- und Ablauf-Tode erscheinen
  // getrennt zaehlbar im echten Renderpfad.
  {
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    try {
      const { createDebugOverlay } = await import('../src/render/debug.js');
      const texts = [];
      const fakeCtx = new Proxy(
        { fillText: (t) => texts.push(t) },
        { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true },
      );
      const dbg = createDebugOverlay(fakeCtx);
      const st = necroRoom();
      const g1 = createGhost(st, 0, 0, 0, 't_pink');
      const g2 = createGhost(st, 10, 10, 0, 't_pink');
      killGhost(st, g1, 'damage');
      killGhost(st, g2, 'expire');
      dbg.render(st, 60, null);
      const line = texts.find((t) => t.includes('Untertan-Ereignisse'));
      check(!!line, 'Phase 5: das Debug-Overlay zeigt keine Untertan-Ereignis-Zeile');
      check(line && line.includes('Schaden') && line.includes('Ablauf'), `Phase 5: Schaden/Ablauf sind im Debug-Overlay nicht unterscheidbar ("${line}")`);
    } finally {
      restore();
    }
  }
}

// ---- 58. Nekromant-V2 Phase 6: Allgemein und Opfer (35 Karten) -----------
// Die Bruecke von Phase 5s reiner Infrastruktur zu echten Karten (ghost_001-
// 035, ghost_031 ausgenommen -- Aktivkarte, Phase 9). Alle 34 hier
// befuellten Karten wirken ueber neue ghost*/necro*-core-Schluessel, die
// necro.js: buildNecroListeners() beim Raumaufbau in state.necroListeners
// eintraegt. Die fuenf Testschritte des Auftrags wörtlich, dazu Mechanismus-
// Tests fuer die neuen, nicht-trivialen Stuecke (Bewegungslogik ghost_010,
// Cross-Cutting-Multiplikator ghost_027/028, Rettung ghost_025, Timed-Stacks).
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createGhost, killGhost } = await import('../src/game/ghost.js');
  const { fireBullet } = await import('../src/game/tank.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');
  const { getNecroStack, necroDamagePct } = await import('../src/game/necro.js');

  const necroRoom = (playerUpgrades = {}, types = ['t_pink']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades,
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    return st;
  };

  // (a) Struktur: ghost_001..ghost_035 vorhanden, ALLE haben einen echten
  // core (kein "_todo"-Platzhalter mehr -- ghost_031 war bis Phase 9 die
  // einzige Ausnahme, ist es seit deren Aktivkarten-core nicht mehr), UND
  // jede loest sich ohne NaN/undefined in ein Spieler-cfg auf -- dasselbe
  // Muster wie Abschnitt 45s NaN-Check (Vergleich gegen die upgradelose
  // Basis derselben Klasse, weil manche Felder wie z. B. `role`/`miner` bei
  // JEDER Klasse von Haus aus undefined sind).
  {
    const ids = [];
    for (let i = 1; i <= 35; i++) ids.push('ghost_' + String(i).padStart(3, '0'));
    check(ids.every((id) => necroData.upgrades[id]), 'Phase 6: nicht alle 35 Karten ghost_001..ghost_035 existieren');
    for (const id of ids) {
      const def = necroData.upgrades[id];
      check(def.core && def.core._todo !== 'effect', `Phase 6: ${id} hat noch keinen core-Wert`);
    }
    const basis = applyUpgrades(resolveCfg(tanksData, 'c_necro'), {}, necroData, 'mine', null);
    for (const id of ids) {
      const cfg = applyUpgrades(resolveCfg(tanksData, 'c_necro'), { [id]: 1 }, necroData, 'mine', null);
      for (const k of Object.keys(cfg)) {
        const bad = (typeof cfg[k] === 'number' && Number.isNaN(cfg[k])) || (cfg[k] === undefined && basis[k] !== undefined);
        check(!bad, `Phase 6: ${id} macht cfg.${k} zu NaN/undefined`);
      }
    }
  }

  // (b) Testschritt 1 (ghost_011): drei Untertanen sterben lassen -- der
  // Spielerschaden-Stapel steigt raumweit sichtbar und faellt beim
  // Raumwechsel (neuer state) zurueck.
  {
    const st = necroRoom({ ghost_011: 1 });
    check(necroDamagePct(st) === 0, 'Phase 6: ghost_011 hat vor jedem Tod schon einen Bonus');
    for (let i = 0; i < 3; i++) {
      const g = createGhost(st, 0, 0, 0, 't_pink');
      killGhost(st, g, 'damage');
    }
    check(Math.abs(necroDamagePct(st) - 0.15) < 1e-9, `Phase 6: ghost_011 gibt nach 3 Toden nicht +15 % (${necroDamagePct(st)})`);
    const st2 = necroRoom({ ghost_011: 1 });
    check(necroDamagePct(st2) === 0, 'Phase 6: ghost_011s Bonus ueberlebt faelschlich den Raumwechsel');
  }

  // (c) Testschritt 2 (ghost_014): Heilung ist innerhalb eines Gefechts
  // spuerbar (hp steigt sichtbar), interne 1-s-Abklingzeit verhindert
  // Mehrfachheilung im selben Moment.
  {
    const st = necroRoom({ ghost_014: 1 });
    st.player.hp = st.player.cfg.maxHp - 40;
    const before = st.player.hp;
    const g1 = createGhost(st, 0, 0, 0, 't_pink');
    killGhost(st, g1, 'damage');
    const afterOne = st.player.hp;
    check(afterOne > before, `Phase 6: ghost_014 heilt nicht spuerbar (${before} -> ${afterOne})`);
    check(Math.abs(afterOne - before - st.player.cfg.maxHp * 0.06) < 1e-6, `Phase 6: ghost_014s Heilbetrag stimmt nicht (${afterOne - before})`);
    // sofort ein zweiter Tod -- Abklingzeit sperrt eine zweite Heilung
    const g2 = createGhost(st, 0, 0, 0, 't_pink');
    killGhost(st, g2, 'damage');
    check(st.player.hp === afterOne, `Phase 6: ghost_014 heilt trotz aktiver interner Abklingzeit erneut (${afterOne} -> ${st.player.hp})`);
  }

  // (d) Testschritt 3 (ghost_020): Tod durch Schaden UND Tod durch Ablauf
  // explodieren beide (Radius 64 px, 25 % des aktuellen Spielerschadens).
  {
    for (const cause of ['damage', 'expire']) {
      const st = necroRoom({ ghost_020: 1 }, ['t_pink', 't_pink']);
      const target = st.tanks.find((t) => t !== st.player);
      target.hp = target.cfg.maxHp;
      const g = createGhost(st, target.x + 30, target.y, 0, 't_pink');
      const hpVor = target.hp;
      killGhost(st, g, cause);
      const expectedDmg = Math.round(st.player.cfg.damage * 0.25);
      check(
        target.hp === hpVor - expectedDmg,
        `Phase 6: ghost_020 (${cause}) zuendet nicht mit dem erwarteten Schaden (${hpVor} -> ${target.hp}, erwartet -${expectedDmg})`,
      );
    }
  }

  // (e) Testschritt 4 (ghost_025 "Letzte Deckung"): toedlicher Schaden
  // opfert einen Untertanen statt den Hauptpanzer -- UND ist ohne
  // Untertanen wirkungslos (die epische Stufe muss beides zuverlaessig
  // erfuellen, Auftrag Abschnitt "Änderungen").
  {
    const st = necroRoom({ ghost_025: 1 });
    const g = createGhost(st, 0, 0, 0, 't_pink');
    g.hp = 5; // schwaechster (einziger) Untertan
    st.ghosts.push(g);
    st.player.hp = 10;
    st.applyDamage(st.player, 999, 'test', {});
    check(st.player.alive, 'Phase 6: ghost_025 rettet den Spieler nicht vor toedlichem Schaden');
    check(!g.alive, 'Phase 6: ghost_025 opfert keinen Untertanen');
    check(st.player.hp > 10, `Phase 6: ghost_025 heilt den Spieler nicht (${st.player.hp})`);
    check(st.necroLastStandUsed, 'Phase 6: ghost_025 markiert die einmalige Nutzung nicht');
    // zweiter toedlicher Treffer im selben Raum: trotz eines VERFUEGBAREN
    // zweiten Untertanen greift die Karte nicht erneut (nur einmal pro Raum).
    const g2 = createGhost(st, 0, 0, 0, 't_pink');
    st.ghosts.push(g2);
    st.player.hp = 10;
    st.applyDamage(st.player, 999, 'test', {});
    check(!st.player.alive, 'Phase 6: ghost_025 rettet ein zweites Mal im selben Raum (nur einmal pro Raum erlaubt)');
    // Gegenprobe im selben Test: OHNE aktiven Untertanen wirkt die Karte gar
    // nicht -- ein frischer Raum ohne Geister muss normal sterben.
    const st2 = necroRoom({ ghost_025: 1 });
    st2.player.hp = 10;
    st2.applyDamage(st2.player, 999, 'test', {});
    check(!st2.player.alive, 'Phase 6: ghost_025 rettet den Spieler faelschlich OHNE aktiven Untertanen');
  }

  // (f) Testschritt 5 (ghost_035 "Vorbote des Endes"): 4 virtuelle
  // Geistertode stehen SOFORT bei Raumstart (kombiniert mit ghost_011,
  // damit ein pureStack-Ziel existiert), aber ghost_014s Heilung wurde NICHT
  // ausgeloest (Spieler-hp unveraendert vom vollen Stand).
  {
    const st = necroRoom({ ghost_011: 1, ghost_014: 1, ghost_035: 1 });
    check(Math.abs(necroDamagePct(st) - 4 * 0.05) < 1e-9, `Phase 6: ghost_035 stellt die Stapel nicht sofort (${necroDamagePct(st)})`);
    check(st.player.hp === st.player.cfg.maxHp, `Phase 6: ghost_035 loest faelschlich ghost_014s Heilung aus (hp=${st.player.hp})`);
  }

  // (g) ghost_027 "Kettenopfer" / ghost_028 "Treues Ende": der Stapel-
  // Multiplikator wirkt NUR auf pureStack-Beitraege (011/012/013), nicht auf
  // Heilung (014) -- gestellter state.rng() macht die 20 %-Chance
  // deterministisch treffend bzw. verfehlend.
  {
    const st = necroRoom({ ghost_011: 1, ghost_014: 1, ghost_027: 1 });
    st.player.hp = 10;
    st.rng = () => 0.01; // < 20 % -> Verdopplung greift
    const g1 = createGhost(st, 0, 0, 0, 't_pink');
    killGhost(st, g1, 'damage');
    check(Math.abs(necroDamagePct(st) - 0.05 * 2) < 1e-9, `Phase 6: ghost_027 verdoppelt den pureStack-Beitrag nicht (${necroDamagePct(st)})`);
    check(Math.abs(st.player.hp - (10 + st.player.cfg.maxHp * 0.06)) < 1e-6, 'Phase 6: ghost_027 verdoppelt faelschlich die Heilung (kein pureStack)');
    // Gegenprobe im selben Test: eine Chance, die NIE trifft (rng immer 1),
    // darf niemals verdoppeln.
    const st2 = necroRoom({ ghost_011: 1, ghost_027: 1 });
    st2.rng = () => 0.99;
    const g2 = createGhost(st2, 0, 0, 0, 't_pink');
    killGhost(st2, g2, 'damage');
    check(Math.abs(necroDamagePct(st2) - 0.05) < 1e-9, `Phase 6: ghost_027 verdoppelt trotz verfehlter Chance (${necroDamagePct(st2)})`);

    // Treues Ende (Nachschliff Abschnitt 10: 60 % -> 50 % Bonus).
    const st3 = necroRoom({ ghost_011: 1, ghost_028: 1 });
    const g3 = createGhost(st3, 0, 0, 0, 't_pink');
    killGhost(st3, g3, 'expire');
    check(Math.abs(necroDamagePct(st3) - 0.05 * 1.5) < 1e-9, `Phase 6: ghost_028 verstaerkt Ablauf-Stapel nicht um 50 % (${necroDamagePct(st3)})`);
    const st4 = necroRoom({ ghost_011: 1, ghost_028: 1 });
    const g4 = createGhost(st4, 0, 0, 0, 't_pink');
    killGhost(st4, g4, 'damage'); // normaler Tod -- 028 wirkt NUR bei Ablauf
    check(Math.abs(necroDamagePct(st4) - 0.05) < 1e-9, `Phase 6: ghost_028 wirkt faelschlich auch bei normalem Tod (${necroDamagePct(st4)})`);
  }

  // (h) ghost_010 "Jenseitsziel": eine echte Fahrlogik-Erweiterung (Auftrag:
  // "braucht eine Erweiterung ... nicht nur einen Wert") -- der Untertan
  // bewegt sich NICHT direkt auf sein Ziel zu, und ein Flanken-/Heck-Treffer
  // eines Untertanen ist mit der Karte staerker als ohne.
  {
    const st = necroRoom({ ghost_010: 1 }, ['t_pink']);
    st.walls = []; // isoliert die reine Bewegungsrichtung von Wandkollisionen/-korrekturen
    const target = st.tanks.find((t) => t !== st.player);
    target.x = 400;
    target.y = 256;
    target.heading = 0;
    const g = createGhost(st, 250, 256, 0, 't_pink');
    st.ghosts.push(g);
    g.turret = Math.atan2(target.y - g.y, target.x - g.x);
    g.heading = g.turret;
    const straightAngle = Math.atan2(target.y - g.y, target.x - g.x);
    const before = { x: g.x, y: g.y };
    const { updateGhosts } = await import('../src/game/ghost.js');
    updateGhosts(st, 1 / 60);
    const movedAngle = Math.atan2(g.y - before.y, g.x - before.x);
    check(Math.abs(movedAngle - straightAngle) > 0.05, 'Phase 6: ghost_010 bewegt den Untertan trotzdem geradewegs aufs Ziel zu');

    // Flanken-Schadensbonus, isoliert an der Trefferschleife gemessen -- in
    // einem FRISCHEN Raum (nicht dem obigen `st`: dessen Untertan `g` hat
    // waehrend der 0,5-s-Bewegungsprobe moeglicherweise schon selbst
    // gefeuert und den einzigen Gegner getoetet).
    const stFlank = necroRoom({ ghost_010: 1 }, ['t_pink']);
    const target2 = stFlank.tanks.find((t) => t !== stFlank.player);
    target2.heading = 0;
    target2.hp = target2.cfg.maxHp;
    const g2 = createGhost(stFlank, target2.x, target2.y - 40, Math.PI / 2, 't_pink'); // von der Seite
    const { createBullet } = await import('../src/game/bullet.js');
    stFlank.bullets.push(createBullet(target2.x, target2.y - 5, Math.PI / 2, { speed: 1, radius: 4, owner: g2, damage: 100 }));
    stepState(stFlank, CMD, 1 / 60);
    const withCard = target2.cfg.maxHp - target2.hp;

    const st2 = necroRoom({}, ['t_pink']);
    const target3 = st2.tanks.find((t) => t !== st2.player);
    target3.heading = 0;
    target3.hp = target3.cfg.maxHp;
    const g3 = createGhost(st2, target3.x, target3.y - 40, Math.PI / 2, 't_pink');
    const { createBullet: cb2 } = await import('../src/game/bullet.js');
    st2.bullets.push(cb2(target3.x, target3.y - 5, Math.PI / 2, { speed: 1, radius: 4, owner: g3, damage: 100 }));
    stepState(st2, CMD, 1 / 60);
    const withoutCard = target3.cfg.maxHp - target3.hp;
    check(withCard > withoutCard, `Phase 6: ghost_010s Flankenbonus verstaerkt Untertanen-Treffer nicht (${withCard} vs ${withoutCard})`);
  }

  // (i) ghost_018 (Durchschlag) / ghost_032 (Zielsucher, Bestand aus
  // Phase 2) -- reine Wiederverwendung bestehender Bullet-Felder, hier am
  // echten Schuss gemessen.
  {
    const st = necroRoom({ ghost_018: 1 });
    st.player.necroBulletBuffs = [{ shotsLeft: 3, pierceAdd: 1, bulletSpeedMult: 1.1 }];
    st.player.cooldown = 0;
    fireBullet(st.player, st, true);
    const b = st.bullets[st.bullets.length - 1];
    check(b.pierce === (st.player.cfg.pierce || 0) + 1, `Phase 6: ghost_018 gibt der Kugel keinen Durchschlag (${b.pierce})`);
    check(st.player.necroBulletBuffs[0].shotsLeft === 2, 'Phase 6: ghost_018s Ladung wird nicht verbraucht');

    const st2 = necroRoom({ ghost_032: 1 });
    st2.necroStacks._deaths = 4; // vor dem 5. Tod
    const g = createGhost(st2, 0, 0, 0, 't_pink');
    killGhost(st2, g, 'damage'); // 5. Tod -> Totenkanone feuert
    const homing = st2.bullets.find((bb) => bb.owner === st2.player && bb.homing > 0);
    check(!!homing, 'Phase 6: ghost_032 feuert nach 5 Toden keinen Zielsucher');
    check(homing && homing.damage === Math.round(st2.player.cfg.damage * 1.5), `Phase 6: ghost_032s Zielsucher hat nicht 150 % Schaden (${homing?.damage})`);
  }

  // (j) ghost_029/030 "Seelenhunger"/"Unsterbliche Maschine": permanente
  // Run-Boni ueber applyNecroRunScaling() -- Mechanismus mit EIGENEN Zahlen
  // (nicht 1 %), damit ein Rechenfehler nicht zufaellig unter der
  // Nachweisschwelle bleibt.
  {
    const { applyNecroRunScaling } = await import('../src/game/cfg.js');
    const base = { damage: 100, maxHp: 200 };
    const scaled = applyNecroRunScaling({ ...base }, 0.5, 0.25);
    check(scaled.damage === 150, `Phase 6: applyNecroRunScaling skaliert den Schaden falsch (${scaled.damage})`);
    check(scaled.maxHp === 250, `Phase 6: applyNecroRunScaling skaliert die LP falsch (${scaled.maxHp})`);
    const noop = applyNecroRunScaling({ ...base }, 0, 0);
    check(noop.damage === 100 && noop.maxHp === 200, 'Phase 6: applyNecroRunScaling veraendert bei 0-Bonus trotzdem etwas');

    // End-to-End: run.js baut necroRunDmgBonus/-HpBonus aus run.necroStacks,
    // state.js wendet sie beim Raumaufbau tatsaechlich an.
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: ['t_pink'],
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {},
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
      necroRunDmgBonus: 0.5,
      necroRunHpBonus: 0.25,
    });
    const baseline = resolveCfg(tanksData, 'c_necro');
    check(st.player.cfg.damage === Math.round(baseline.damage * 1.5), `Phase 6: der Run-Schadensbonus wirkt nicht beim Raumaufbau (${st.player.cfg.damage})`);
    check(st.player.cfg.maxHp === Math.round(baseline.maxHp * 1.25), `Phase 6: der Run-LP-Bonus wirkt nicht beim Raumaufbau (${st.player.cfg.maxHp})`);
  }

  // (k) ghost_022 "Haerte aus Verlust": die raumweite Resistenz (seit dem
  // Champion-/Nekromant-Nachschliff v2 ein dauerhafter PLAIN-Stapel statt
  // eines 10-Sekunden-Zeitfensters, s. Abschnitt (m)/65m weiter unten) wirkt
  // am Trefferpunkt (state.js: applyDamage()) -- gemessen als kleinerer
  // Schaden mit aktivem Stapel als ohne. Codedurchsicht (Phase B): testete
  // bis hierher noch den seit dem Nachschliff toten '_timedResistHaerte'-
  // Schluessel (per addNecroTimedStack) -- eine stale Testkopie, die beim
  // Umbau von 022 nie nachgezogen wurde, dieselbe Fehlerklasse wie die
  // beiden in Nekromant-V2 Phase 1 gefundenen isUnique/maxStacks-Altteste.
  // Auf den echten, aktuellen Mechanismus (addNecroStack, 'room'-Scope)
  // umgestellt -- Abschnitt (m) prueft bereits necroResistBonus() ueber den
  // vollen Karten-/Kill-Pfad, dieser Test bewacht separat, dass der Wert am
  // TATSAECHLICHEN Trefferpunkt auch wirklich weniger Schaden bedeutet.
  {
    const { addNecroStack } = await import('../src/game/necro.js');
    const st = necroRoom({});
    st.player.hp = 1000;
    const before = st.player.hp;
    st.applyDamage(st.player, 100, 'test', {});
    const dmgOhne = before - st.player.hp;

    const st2 = necroRoom({});
    st2.player.hp = 1000;
    addNecroStack(st2, 'room', '_roomResistHaerte', 8);
    const before2 = st2.player.hp;
    st2.applyDamage(st2.player, 100, 'test', {});
    const dmgMit = before2 - st2.player.hp;
    check(dmgMit < dmgOhne, `Phase 6: ghost_022s dauerhafte Resistenz wirkt nicht am Treffer (${dmgMit} vs ${dmgOhne})`);
  }

  // (l) ghost_015 "Aschenhaut": Schild-Stapel waechst mit JEDEM Tod OHNE
  // Obergrenze (Nachschliff Abschnitt 9: der alte 20-%-Deckel ist entfernt)
  // und verfaellt nach der Dauer wieder um exakt den gewaehrten Anteil.
  {
    const st = necroRoom({ ghost_015: 1 });
    st.player.shield = 0;
    const g = createGhost(st, 0, 0, 0, 't_pink');
    killGhost(st, g, 'damage');
    check(Math.abs(st.player.shield - st.player.cfg.maxHp * 0.04) < 1e-6, `Phase 6: ghost_015 gewaehrt beim ersten Tod nicht den erwarteten Schild (${st.player.shield})`);
    // Nachschliff: viele Tode UEBERSCHREITEN den alten 20-%-Deckel deutlich --
    // waere der Deckel noch da, bliebe der Schild darunter (Gegenprobe).
    for (let i = 0; i < 20; i++) {
      const gi = createGhost(st, 0, 0, 0, 't_pink');
      killGhost(st, gi, 'damage');
    }
    const wouldBeCapped = st.player.cfg.maxHp * 0.2;
    check(
      st.player.shield > wouldBeCapped + 1e-6,
      `Phase 6 (Nachschliff): ghost_015 waechst nicht ueber den alten 20-%-Deckel hinaus (${st.player.shield} <= ${wouldBeCapped})`,
    );
    // 21 Tode * 4 % = 84 % exakt (kein Deckel, keine Rundung im Mechanismus).
    check(
      Math.abs(st.player.shield - st.player.cfg.maxHp * 0.84) < 1e-6,
      `Phase 6 (Nachschliff): ghost_015s Schild-Stapel ist nicht exakt linear (${st.player.shield} statt ${st.player.cfg.maxHp * 0.84})`,
    );
    // Verfall: nach Ablauf der Dauer sinkt der Schild um genau den
    // gewaehrten Anteil (state.player.necroShieldStackAmount).
    const gewaehrt = st.player.necroShieldStackAmount;
    const vorVerfall = st.player.shield;
    st.time = st.player.necroShieldStackExpiresAt + 0.01;
    stepState(st, CMD, 1 / 60);
    check(Math.abs(st.player.shield - (vorVerfall - gewaehrt)) < 1, `Phase 6: ghost_015s Schild verfaellt nicht um den gewaehrten Anteil (${vorVerfall} -> ${st.player.shield}, erwartet -${gewaehrt})`);
  }
}

// ---- 59. Nekromant-V2 Phase 7: Legion (25 Karten) -------------------------
// ghost_036 bis ghost_060 -- deutlich mehr Untertanen, staerker in der
// Gruppe. Zwei architektonische Neuerungen: occupiedGhostSlots() (Plaetze
// statt reiner Anzahl, wegen ghost_056) und recomputeLegionCache() (die vom
// Auftrag verlangte "nicht pro Frame"-Zaehler-Neuberechnung, nur an Spawn-/
// Entfernen-Stellen). Positions-Auren (042/048/049) bleiben bewusst LIVE
// pro Tick, weil ihre Mitgliedschaft von Bewegung abhaengt.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createGhost, killGhost, updateGhosts, occupiedGhostSlots, recomputeLegionCache, pushGhost } = await import('../src/game/ghost.js');
  const { fireBullet } = await import('../src/game/tank.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');
  const { getNecroStack } = await import('../src/game/necro.js');

  const legionRoom = (playerUpgrades = {}, types = ['t_pink']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades,
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    st.walls = []; // isoliert Kollisionstests von generierten Waenden
    // isSolid()/blocksSight() lesen aus dem GRID-Closure der Raumgenerierung,
    // nicht aus state.walls -- an frei gewaehlten Testkoordinaten (auch
    // ausserhalb des generierten Layouts) muss die Sichtlinie fuer
    // updateGhosts()s clearLine()-Pruefung trotzdem frei sein.
    st.isSolid = () => false;
    st.blocksSight = () => false;
    return st;
  };
  const mkEnemy = () => ({
    cfg: { maxHp: 100, damage: 10, radius: 14 },
    hp: 100,
    alive: true,
    type: 't_pink',
    x: 0, y: 0, heading: 0,
    affixes: [],
  });
  const push = (st, g) => {
    st.ghosts.push(g);
    recomputeLegionCache(st);
    return g;
  };

  // (a) Struktur: 25 Karten, alle mit echtem core (kein "_todo"), NaN-Check
  // gegen die upgradelose Nekromanten-Basis.
  {
    const ids = [];
    for (let i = 36; i <= 60; i++) ids.push('ghost_' + String(i).padStart(3, '0'));
    check(ids.every((id) => necroData.upgrades[id]), 'Phase 7: nicht alle 25 Karten ghost_036..ghost_060 existieren');
    for (const id of ids) {
      const def = necroData.upgrades[id];
      check(def.core && def.core._todo !== 'effect', `Phase 7: ${id} hat noch keinen core-Wert`);
    }
    const basis = applyUpgrades(resolveCfg(tanksData, 'c_necro'), {}, necroData, 'mine', null);
    for (const id of ids) {
      const cfg = applyUpgrades(resolveCfg(tanksData, 'c_necro'), { [id]: 1 }, necroData, 'mine', null);
      for (const k of Object.keys(cfg)) {
        const bad = (typeof cfg[k] === 'number' && Number.isNaN(cfg[k])) || (cfg[k] === undefined && basis[k] !== undefined);
        check(!bad, `Phase 7: ${id} macht cfg.${k} zu NaN/undefined`);
      }
    }
  }

  // (b) Testschritt 1 (ghost_036 x10): Basislimit 3 + 10 = 13 gleichzeitige
  // GEWOEHNLICHE Untertanen, keine Sperre. Nachschliff ("Champion zaehlt NIE
  // gegen das Limit"): der ERSTE Kill wird selbst Champion und belegt keinen
  // der 13 Plaetze -- es braucht deshalb 14 Kills (1 Champion + 13
  // Gewoehnliche), nicht 13, um wirklich voll zu sein.
  {
    const st = legionRoom({ ghost_036: 10 });
    st.rng = () => 0; // < balance.ghost.reviveChance (0.35) -> jede Probe gelingt
    for (let i = 0; i < 14; i++) st.killTank(mkEnemy(), 'test', { killer: st.player });
    check(occupiedGhostSlots(st) === 13, `Phase 7: ghost_036 x10 erlaubt nicht 13 gleichzeitige Untertanen (${occupiedGhostSlots(st)})`);
    check(st.ghosts.length === 14, `Phase 7: Vorbedingung -- Champion + 13 Gewoehnliche (${st.ghosts.length})`);
    st.killTank(mkEnemy(), 'test', { killer: st.player }); // weiterer Kill -> Deckel voll
    check(occupiedGhostSlots(st) === 13, `Phase 7: das Limit (13) wird trotzdem ueberschritten (${occupiedGhostSlots(st)})`);
  }

  // (c) Testschritt 2 (ghost_039 "Rudelfeuer"): mit 3 aktiven Untertanen ist
  // der Schaden je Einheit hoeher als mit nur einem.
  {
    const st1 = legionRoom({ ghost_039: 1 });
    const g1 = push(st1, createGhost(st1, 0, 0, 0, 't_pink'));
    const dmgAlone = Math.round(g1.cfg.damage * (st1.necroPackMult ?? 1));

    const st3 = legionRoom({ ghost_039: 1 });
    const g3a = push(st3, createGhost(st3, 0, 0, 0, 't_pink'));
    push(st3, createGhost(st3, 10, 10, 0, 't_pink'));
    push(st3, createGhost(st3, 20, 20, 0, 't_pink'));
    const dmgGroup = Math.round(g3a.cfg.damage * (st3.necroPackMult ?? 1));
    check(dmgGroup > dmgAlone, `Phase 7: ghost_039 erhoeht den Schaden nicht mit mehr Untertanen (${dmgAlone} -> ${dmgGroup})`);
  }

  // (d) Testschritt 3 (ghost_049 "Seelenoffizier"): der Offizier traegt den
  // Ring, Einheiten INNERHALB des Radius sind staerker.
  {
    const st = legionRoom({ ghost_049: 1 });
    const officer = push(st, createGhost(st, 0, 0, 0, 't_pink')); // aeltester -> Offizier
    const near = push(st, createGhost(st, 50, 0, 0, 't_pink')); // 50px, < 160px
    const far = push(st, createGhost(st, 400, 0, 0, 't_pink')); // 400px, > 160px
    updateGhosts(st, 0); // dt=0: nur die Auren-Vorpaesse laufen, keine Bewegung/kein Feuer
    check(officer.isOfficer, 'Phase 7: der aelteste Untertan wird nicht Offizier');
    check(!near.isOfficer && !far.isOfficer, 'Phase 7: mehr als ein Offizier gleichzeitig');
  }

  // (e) Testschritt 4 ("Totenruf" ghost_044): die Chance steigt bei jeder
  // weiteren Stufe linear weiter, die Karte ist NICHT einzigartig (bleibt
  // im Pool waehlbar).
  {
    check(necroData.upgrades.ghost_044.isUnique === false, 'Phase 7: ghost_044 ist faelschlich einzigartig (waere nach 1x aus dem Pool)');
    const one = applyUpgrades(resolveCfg(tanksData, 'c_necro'), { ghost_044: 1 }, necroData, 'mine', null);
    const ten = applyUpgrades(resolveCfg(tanksData, 'c_necro'), { ghost_044: 10 }, necroData, 'mine', null);
    check(Math.abs(one.necroReviveChanceAdd - 0.07) < 1e-9, `Phase 7: ghost_044 gibt bei Stufe 1 nicht +7pp (${one.necroReviveChanceAdd})`);
    check(Math.abs(ten.necroReviveChanceAdd - 0.7) < 1e-9, `Phase 7: ghost_044 steigt nicht linear weiter (${ten.necroReviveChanceAdd} bei Stufe 10)`);
  }

  // (f) Testschritt 5 (ghost_056 "Elite-Reaktivierung"): ein wiederbelebter
  // Elite-Untertan belegt 2 Geisterplaetze. Nachschliff ("Champion zaehlt
  // NIE gegen das Limit"): waere dieser Elite-Untertan der ERSTE Geist im
  // Raum, wuerde er selbst zum Champion befoerdert und occupiedGhostSlots()
  // wuerde ihn (wie JEDEN Champion) gar nicht zaehlen -- ein Anker haelt ihn
  // gewoehnlich, damit der eigentliche Mechanismus (slotCost=2) geprueft wird.
  {
    const st = legionRoom({ ghost_056: 1 });
    pushGhost(st, createGhost(st, 0, 0, 0, 't_pink')); // Anker -> wird Champion
    st.rng = () => 0;
    const elite = mkEnemy();
    elite.affixes = ['twinshot'];
    st.killTank(elite, 'test', { killer: st.player });
    check(st.ghosts.length === 2, `Phase 7: ghost_056 erzeugt nicht genau einen zusaetzlichen Untertanen (${st.ghosts.length})`);
    const reactivated = st.ghosts.find((g) => !g.isChampion);
    check(reactivated?.slotCost === 2, `Phase 7: der wiederbelebte Elite-Untertan belegt nicht 2 Plaetze (${reactivated?.slotCost})`);
    check(occupiedGhostSlots(st) === 2, `Phase 7: occupiedGhostSlots zaehlt die 2 Plaetze nicht (${occupiedGhostSlots(st)})`);
    // Champion-/Nekromant-Nachschliff Abschnitt 12 (ANGEPASST): OHNE die
    // Karte wird die Elite trotzdem wiederbelebt (generelle Eignung), belegt
    // weiterhin strukturell 2 Plaetze -- nur der 90-%-Basiswert-Bonus fehlt.
    const st2 = legionRoom({});
    pushGhost(st2, createGhost(st2, 0, 0, 0, 't_pink')); // Anker -> wird Champion
    st2.rng = () => 0;
    const elite2 = mkEnemy();
    elite2.affixes = ['twinshot'];
    st2.killTank(elite2, 'test', { killer: st2.player });
    check(st2.ghosts.length === 2, `Abschnitt 65 (Nachschliff 12): eine Elite wird auch OHNE ghost_056 nicht wiederbelebt (${st2.ghosts.length})`);
    const reactivated2 = st2.ghosts.find((g) => !g.isChampion);
    check(reactivated2?.slotCost === 2, `Abschnitt 65 (Nachschliff 12): der Elite-Untertan belegt auch ohne die Karte nicht strukturell 2 Plaetze (${reactivated2?.slotCost})`);
  }

  // (g) recomputeLegionCache(): "nicht pro Frame" -- ein Geist, der OHNE den
  // Aufruf ins Array gelangt, aendert den Cache noch NICHT; erst der
  // explizite Aufruf (Spawn-/Entfernen-Stelle) aktualisiert ihn.
  {
    const st = legionRoom({ ghost_039: 1 });
    check(st.necroPackMult === 1, `Phase 7: necroPackMult startet nicht neutral (${st.necroPackMult})`);
    st.ghosts.push(createGhost(st, 0, 0, 0, 't_pink'), createGhost(st, 10, 10, 0, 't_pink'));
    check(st.necroPackMult === 1, `Phase 7: necroPackMult aktualisiert sich OHNE recomputeLegionCache()-Aufruf (${st.necroPackMult})`);
    recomputeLegionCache(st);
    check(st.necroPackMult > 1, `Phase 7: recomputeLegionCache() aktualisiert necroPackMult nicht (${st.necroPackMult})`);
  }

  // (h) ghost_038 "Gemeinsame Ruestung": Schwellenwert-Resistenz.
  {
    const st = legionRoom({ ghost_038: 1 });
    const g1 = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    check(st.necroLegionResistBonus === 0, `Phase 7: ghost_038 gewaehrt Resistenz mit nur 1 Untertan (${st.necroLegionResistBonus})`);
    push(st, createGhost(st, 10, 10, 0, 't_pink'));
    check(st.necroLegionResistBonus === 6, `Phase 7: ghost_038 gewaehrt bei 2 Untertanen nicht +6 Resistenz (${st.necroLegionResistBonus})`);
  }

  // (i) ghost_040 "Synchronverschluss": Feuerrate haengt an der Anzahl
  // (sich selbst eingeschlossen) -- gemessen als tatsaechlicher Cooldown
  // nach einem echten Schuss.
  {
    const st1 = legionRoom({ ghost_040: 1 });
    const g1 = push(st1, createGhost(st1, 0, 0, 0, 't_pink'));
    const e1 = st1.tanks.find((t) => t !== st1.player);
    e1.x = g1.x + 40; e1.y = g1.y; g1.turret = 0; g1.heading = 0;
    g1.cooldown = 0;
    updateGhosts(st1, 0.001);
    const cd1 = g1.cooldown;

    const st3 = legionRoom({ ghost_040: 1 });
    const g3 = push(st3, createGhost(st3, 0, 0, 0, 't_pink'));
    push(st3, createGhost(st3, -50, -50, 0, 't_pink'));
    push(st3, createGhost(st3, -60, -60, 0, 't_pink'));
    const e3 = st3.tanks.find((t) => t !== st3.player);
    e3.x = g3.x + 40; e3.y = g3.y; g3.turret = 0; g3.heading = 0;
    g3.cooldown = 0;
    updateGhosts(st3, 0.001);
    const cd3 = g3.cooldown;
    check(cd1 > 0 && cd3 > 0 && cd3 < cd1, `Phase 7: ghost_040 verkuerzt den Cooldown bei mehr Untertanen nicht (${cd1} vs ${cd3})`);
  }

  // (j) ghost_041 "Geteiltes Ziel": Untertanen greifen das zuletzt vom
  // SPIELER getroffene Ziel an (statt des naechstgelegenen), mit Schadensbonus.
  {
    const st = legionRoom({ ghost_041: 1 }, ['t_pink', 't_pink']);
    const [nearE, farE] = st.tanks.filter((t) => t !== st.player);
    // Bewusst unterschiedliche RICHTUNGEN (nicht nur Distanzen), sonst kann
    // die Turmausrichtung allein nicht zeigen, welches Ziel gewaehlt wurde.
    nearE.x = 30; nearE.y = 0; // Richtung 0°, naeher
    farE.x = 0; farE.y = -300; // Richtung -90°, weiter entfernt
    st.necroLastPlayerHitTarget = farE; // Spieler hat das WEITER entfernte Ziel zuletzt getroffen
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    // Grosszuegiges dt (TURN_SPEED 4 rad/s), damit die Turmdrehung sicher
    // konvergiert -- es geht hier nur um die ZIELWAHL, nicht um Timing.
    updateGhosts(st, 1);
    const angleToFar = Math.atan2(farE.y - g.y, farE.x - g.x);
    const angleToNear = Math.atan2(nearE.y - g.y, nearE.x - g.x);
    const diffFar = Math.abs(((g.turret - angleToFar + Math.PI) % (2 * Math.PI)) - Math.PI);
    const diffNear = Math.abs(((g.turret - angleToNear + Math.PI) % (2 * Math.PI)) - Math.PI);
    check(diffFar < diffNear, `Phase 7: ghost_041 zielt nicht auf das zuletzt getroffene (weiter entfernte) Ziel (Abweichung ${diffFar} vs ${diffNear})`);
  }

  // (k) ghost_042 "Phalanx": +Resistenz nur, solange ein ANDERER Untertan
  // innerhalb von 80 px ist.
  {
    const st = legionRoom({ ghost_042: 1 });
    const g1 = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const g2 = push(st, createGhost(st, 40, 0, 0, 't_pink')); // 40px < 80px
    updateGhosts(st, 0);
    check(g1.legionAuraResist === 8 && g2.legionAuraResist === 8, `Phase 7: ghost_042 gewaehrt nahen Untertanen keine +8 Resistenz (${g1.legionAuraResist}/${g2.legionAuraResist})`);
    g2.x = 500; // weit weg
    updateGhosts(st, 0);
    check(g1.legionAuraResist === 0, `Phase 7: ghost_042 wirkt trotz Distanz weiter (${g1.legionAuraResist})`);
  }

  // (l) ghost_043 "Reihenwechsel": stirbt ein Untertan, heilen die UEBRIGEN
  // um einen Anteil IHRES EIGENEN maximalen Lebens. Nachschliff ("Champion
  // muss ein eigenstaendiger Geisterpanzer sein"): killGhost() ruft am Ende
  // ensureChampion() -- ohne einen bereits vorhandenen Champion wuerde der
  // ueberlebende `survivor` DIREKT NACH der Heilung selbst befoerdert und
  // seine gerade geheilten hp/maxHp komplett neu ueberschrieben. Ein Anker
  // haelt den Champion-Titel, damit survivor gewoehnlich bleibt.
  {
    const st = legionRoom({ ghost_043: 1 });
    pushGhost(st, createGhost(st, 500, 500, 0, 't_pink')); // Anker -> wird Champion
    const dying = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const survivor = push(st, createGhost(st, 50, 50, 0, 't_pink'));
    survivor.hp = survivor.cfg.maxHp - 40;
    const before = survivor.hp;
    killGhost(st, dying, 'damage');
    check(!survivor.isChampion, 'Phase 7: Vorbedingung -- survivor ist faelschlich Champion');
    check(survivor.hp > before, `Phase 7: ghost_043 heilt die Ueberlebenden nicht (${before} -> ${survivor.hp})`);
    check(Math.abs(survivor.hp - before - survivor.cfg.maxHp * 0.08) < 1e-6, `Phase 7: ghost_043s Heilbetrag stimmt nicht (${survivor.hp - before})`);
  }

  // (m) ghost_045 "Ueberzahl": ab 3 aktiven Untertanen groessere/schnellere
  // Geschosse.
  {
    const st = legionRoom({ ghost_045: 1 });
    const g1 = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const e = st.tanks.find((t) => t !== st.player);
    e.x = g1.x + 40; e.y = g1.y; g1.turret = 0; g1.heading = 0; g1.cooldown = 0;
    updateGhosts(st, 0.001);
    const bulletFew = st.bullets[st.bullets.length - 1];
    push(st, createGhost(st, -50, -50, 0, 't_pink'));
    push(st, createGhost(st, -60, -60, 0, 't_pink'));
    g1.cooldown = 0;
    updateGhosts(st, 0.001);
    const bulletMany = st.bullets[st.bullets.length - 1];
    const speedFew = Math.hypot(bulletFew.vx, bulletFew.vy);
    const speedMany = Math.hypot(bulletMany.vx, bulletMany.vy);
    check(bulletMany.radius > bulletFew.radius && speedMany > speedFew, `Phase 7: ghost_045 vergroessert/beschleunigt Geschosse ab 3 Untertanen nicht (${bulletFew.radius}/${speedFew} vs ${bulletMany.radius}/${speedMany})`);
  }

  // (n) ghost_046 "Veteranen": einmalige Befoerderung nach necroVeteranAfterS
  // Sekunden Ueberleben. Nachschliff: ein Anker haelt den Champion-Titel,
  // damit g gewoehnlich bleibt (sonst wuerde updateGhosts() g selbst sofort
  // befoerdern und cfg.damage/maxHp VOR dem Test ueberschreiben).
  {
    const st = legionRoom({ ghost_046: 1 });
    pushGhost(st, createGhost(st, 500, 500, 0, 't_pink')); // Anker -> wird Champion
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    check(!g.isChampion, 'Phase 7: Vorbedingung (n) -- g ist faelschlich Champion');
    const baseDmg = g.cfg.damage;
    const baseHp = g.cfg.maxHp;
    updateGhosts(st, 4); // < 8s -- noch nicht befoerdert
    check(!g.isVeteran && g.cfg.damage === baseDmg, 'Phase 7: ghost_046 befoerdert zu frueh');
    updateGhosts(st, 5); // gesamt 9s -- jetzt befoerdert
    check(g.isVeteran, 'Phase 7: ghost_046 befoerdert nach 8s ueberlebter Zeit nicht');
    check(g.cfg.damage === Math.round(baseDmg * 1.2), `Phase 7: ghost_046s Schadensbonus stimmt nicht (${g.cfg.damage} statt ${Math.round(baseDmg * 1.2)})`);
    check(g.cfg.maxHp === Math.round(baseHp * 1.12), `Phase 7: ghost_046s LP-Bonus stimmt nicht (${g.cfg.maxHp} statt ${Math.round(baseHp * 1.12)})`);
  }

  // (o) ghost_047 "Sturmformation": Anflug-Tempobonus IMMER, Flankenbonus
  // NUR wenn die Seite/das Heck erreicht ist.
  {
    const st = legionRoom({ ghost_047: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const e = st.tanks.find((t) => t !== st.player);
    e.x = 400; e.y = 0; e.heading = 0; // Front des Ziels zeigt zum Geist -> "front"
    const before = { x: g.x, y: g.y };
    updateGhosts(st, 0.1);
    const distMoved = Math.hypot(g.x - before.x, g.y - before.y);
    const st0 = legionRoom({});
    const g0 = push(st0, createGhost(st0, 0, 0, 0, 't_pink'));
    const e0 = st0.tanks.find((t) => t !== st0.player);
    e0.x = 400; e0.y = 0; e0.heading = 0;
    updateGhosts(st0, 0.1);
    const distMoved0 = Math.hypot(g0.x, g0.y);
    check(distMoved > distMoved0, `Phase 7: ghost_047 beschleunigt den Anflug nicht (${distMoved0} vs ${distMoved})`);
  }

  // (p) ghost_048 "Schildwall": Regen nur in Reichweite UND erst nach der
  // Verzoegerung ohne Schaden.
  {
    const st = legionRoom({ ghost_048: 1 });
    const g = push(st, createGhost(st, st.player.x + 30, st.player.y, 0, 't_pink'));
    g.shield = 0;
    g.lastDamageAt = -1e9; // "laengst her"
    updateGhosts(st, 1);
    check(g.shield > 0, `Phase 7: ghost_048 laedt den Schild in Reichweite nicht auf (${g.shield})`);
    const st2 = legionRoom({ ghost_048: 1 });
    const g2 = push(st2, createGhost(st2, st2.player.x + 30, st2.player.y, 0, 't_pink'));
    g2.shield = 0;
    g2.lastDamageAt = st2.time; // GERADE getroffen
    updateGhosts(st2, 1);
    check(g2.shield === 0, `Phase 7: ghost_048 ignoriert die 2-s-Sperre nach einem Treffer (${g2.shield})`);
  }

  // (q) ghost_050 "Munitionsaustausch": +1 % je Untertanen-Schuss, OHNE
  // Deckel (Nachschliff Abschnitt 9: der alte 30-%-Deckel ist entfernt --
  // die Feuerrate selbst bleibt ueber fireRateFactor() stabil).
  {
    const st = legionRoom({ ghost_050: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const e = st.tanks.find((t) => t !== st.player);
    e.x = g.x + 40; e.y = g.y; g.turret = 0; g.heading = 0;
    for (let i = 0; i < 5; i++) {
      g.cooldown = 0;
      updateGhosts(st, 0.001);
    }
    const stack = getNecroStack(st, 'room', '_legionAmmoExchange');
    check(Math.abs(stack - 0.05) < 1e-9, `Phase 7: ghost_050s Stapel waechst nicht mit jedem Schuss (${stack})`);
    for (let i = 0; i < 40; i++) {
      g.cooldown = 0;
      updateGhosts(st, 0.001);
    }
    const stackAfter = getNecroStack(st, 'room', '_legionAmmoExchange');
    // Nachschliff-Gegenprobe: 45 Schuesse * 1 % = 45 % -- klar UEBER dem
    // alten 30-%-Deckel, waere der Deckel noch da, bliebe der Stapel darunter.
    check(
      stackAfter > 0.30 + 1e-9,
      `Phase 7 (Nachschliff): ghost_050 waechst nicht ueber den alten 30-%-Deckel hinaus (${stackAfter})`,
    );
    check(
      Math.abs(stackAfter - 0.45) < 1e-6,
      `Phase 7 (Nachschliff): ghost_050s Stapel ist nach 45 Schuessen nicht exakt 45 % (${stackAfter})`,
    );
  }

  // (r) ghost_051 "Erbmunition": stirbt ein Untertan, bekommen die
  // UEBERLEBENDEN eine "naechste 5 Schuesse +25 %"-Ladung.
  {
    const st = legionRoom({ ghost_051: 1 });
    const dying = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const survivor = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    killGhost(st, dying, 'damage');
    check(survivor.legionBulletBuffs?.length === 1, 'Phase 7: ghost_051 vergibt keine Ladung an Ueberlebende');
    check(survivor.legionBulletBuffs[0].shotsLeft === 5, `Phase 7: ghost_051s Ladung deckt nicht 5 Schuesse ab (${survivor.legionBulletBuffs[0].shotsLeft})`);
    const e = st.tanks.find((t) => t !== st.player);
    e.x = survivor.x + 40; e.y = survivor.y; survivor.turret = 0; survivor.heading = 0; survivor.cooldown = 0;
    updateGhosts(st, 0.001);
    check(survivor.legionBulletBuffs.length === 1 && survivor.legionBulletBuffs[0].shotsLeft === 4, 'Phase 7: ghost_051s Ladung wird nicht pro Schuss verbraucht');
    const shot = st.bullets[st.bullets.length - 1];
    check(shot.damage === Math.round(survivor.cfg.damage * 1.25), `Phase 7: ghost_051s +25 % wirkt nicht auf den Schuss (${shot.damage} statt ${Math.round(survivor.cfg.damage * 1.25)})`);
  }

  // (s) ghost_052 "Mehrfachwiederbelebung": 20 % Chance auf eine zweite,
  // schwaechere Kopie bei einer gelungenen Probe.
  {
    const st = legionRoom({ ghost_052: 1 });
    st.rng = () => 0; // jede Chance (Basis- UND Doppel-Wurf) gelingt
    st.killTank(mkEnemy(), 'test', { killer: st.player });
    check(st.ghosts.length === 2, `Phase 7: ghost_052 erzeugt bei gelungener Chance keine zweite Kopie (${st.ghosts.length})`);
    // Ein fester Wert 0,25 statt einer nach Aufrufreihenfolge gezaehlten
    // Sequenz: killTank() ruft state.rng() auch fuer spawnParticles() mehrfach
    // VOR dem Wiederbelebungs-Wurf auf (Anzahl nicht Teil des oeffentlichen
    // Vertrags) -- ein reiner Aufruf-Index-Stub waere fragil. 0,25 liegt
    // unter der Basis-Chance (0,35 -> gelingt) und ueber der 20-%-Doppel-
    // Chance (-> verfehlt), unabhaengig davon, an welcher Stelle er greift.
    const st2 = legionRoom({ ghost_052: 1 });
    st2.rng = () => 0.25;
    st2.killTank(mkEnemy(), 'test', { killer: st2.player });
    check(st2.ghosts.length === 1, `Phase 7: ghost_052 erzeugt trotz verfehlter Chance eine zweite Kopie (${st2.ghosts.length})`);
  }

  // (t) ghost_053 "Verstaerkte Huelle": ignoriert EINMAL je Leben einen
  // Treffer > 30 % des maximalen Lebens.
  {
    const st = legionRoom({ ghost_053: 1 });
    st.tanks = [st.player]; // kein echter Gegner, der die Testkugel vorher abfaengt
    const g = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    g.hp = g.cfg.maxHp;
    const bigHit = g.cfg.maxHp * 0.5;
    st.bullets.push(createBullet(g.x, g.y, 0, { speed: 1, radius: 20, owner: { type: 't_enemy_test' }, damage: bigHit }));
    stepState(st, CMD, 1 / 60);
    check(g.hp === g.cfg.maxHp, `Phase 7: ghost_053 ignoriert den ersten grossen Treffer nicht (${g.hp} statt ${g.cfg.maxHp})`);
    st.bullets.push(createBullet(g.x, g.y, 0, { speed: 1, radius: 20, owner: { type: 't_enemy_test' }, damage: bigHit }));
    stepState(st, CMD, 1 / 60);
    check(g.hp < g.cfg.maxHp, `Phase 7: ghost_053 ignoriert einen ZWEITEN grossen Treffer im selben Leben (${g.hp})`);
  }

  // (u) ghost_054 "Legionskern": eine gelungene Probe AM VOLLEN Limit heilt
  // + staerkt statt einen weiteren Untertanen zu erzeugen.
  {
    const st = legionRoom({ ghost_054: 1 });
    st.rng = () => 0;
    for (let i = 0; i < 3; i++) push(st, createGhost(st, 0, 0, 0, 't_pink')); // Basislimit voll
    st.ghosts.forEach((g) => (g.hp = g.cfg.maxHp - 10));
    const before = occupiedGhostSlots(st);
    st.killTank(mkEnemy(), 'test', { killer: st.player });
    check(occupiedGhostSlots(st) === before, `Phase 7: ghost_054 erzeugt trotz vollem Limit einen weiteren Untertanen (${before} -> ${occupiedGhostSlots(st)})`);
    check(st.necroLegionKernActive, 'Phase 7: ghost_054 aktiviert den Schadensbonus nicht');
    check(st.ghosts.every((g) => g.hp > g.cfg.maxHp - 10), 'Phase 7: ghost_054 heilt die vorhandenen Untertanen nicht');
  }

  // (v) ghost_057 "Gemeinsamer Wille": ab der Schwelle wird Schaden auf ALLE
  // aktiven Untertanen verteilt statt nur den getroffenen zu treffen.
  // Nachschliff: ein Anker haelt den Champion-Titel -- sonst wuerde
  // updateGhosts() (laeuft NACH der Kollision im selben stepState()-Tick)
  // g1 ODER g2 befoerdern und den gerade genommenen Schaden ueberschreiben.
  {
    const st = legionRoom({ ghost_057: 1 });
    st.tanks = [st.player]; // kein echter Gegner, der die Testkugel vorher abfaengt
    pushGhost(st, createGhost(st, 500, 500, 0, 't_pink')); // Anker -> wird Champion
    const g1 = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    const g2 = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    g1.hp = g1.cfg.maxHp;
    g2.hp = g2.cfg.maxHp;
    const dmgVoll = 40;
    st.bullets.push(createBullet(g1.x, g1.y, 0, { speed: 1, radius: 20, owner: { type: 't_enemy_test' }, damage: dmgVoll }));
    stepState(st, CMD, 1 / 60);
    check(g1.hp < g1.cfg.maxHp && g2.hp < g2.cfg.maxHp, `Phase 7: ghost_057 verteilt den Schaden nicht auf BEIDE Untertanen (${g1.hp}/${g2.hp})`);
    check(g1.cfg.maxHp - g1.hp < dmgVoll, `Phase 7: ghost_057 laesst den getroffenen Untertanen den vollen Schaden nehmen (${g1.cfg.maxHp - g1.hp})`);
  }

  // (w) ghost_058 "Chor der Toten": Untertanen bekommen die Haelfte des
  // globalen Flanken-/Heckbonus zusaetzlich auf ihre eigenen Treffer.
  {
    const mkFlankRoom = (ups) => {
      const st = legionRoom(ups, ['t_pink']);
      const target = st.tanks.find((t) => t !== st.player);
      target.heading = 0;
      target.hp = target.cfg.maxHp;
      const g = push(st, createGhost(st, target.x, target.y - 40, Math.PI / 2, 't_pink')); // von der Seite
      st.bullets.push(createBullet(target.x, target.y - 5, Math.PI / 2, { speed: 1, radius: 4, owner: g, damage: 100 }));
      stepState(st, CMD, 1 / 60);
      return target.cfg.maxHp - target.hp;
    };
    const withCard = mkFlankRoom({ ghost_058: 1 });
    const withoutCard = mkFlankRoom({});
    check(withCard > withoutCard, `Phase 7: ghost_058 verstaerkt Flankentreffer der Untertanen nicht (${withoutCard} vs ${withCard})`);
  }

  // (x) ghost_059 "Grabfeld": ein neuer Untertan an einem gemerkten
  // Sterbeort erscheint staerker.
  {
    const st = legionRoom({ ghost_059: 1 });
    const dying = push(st, createGhost(st, 111, 222, 0, 't_pink'));
    killGhost(st, dying, 'damage');
    check(st.necroGraveyardSpots.length === 1, 'Phase 7: ghost_059 merkt sich den Sterbeort nicht');
    const onGrave = createGhost(st, 111, 222, 0, 't_pink');
    const elsewhere = createGhost(st, 600, 600, 0, 't_pink');
    check(onGrave.cfg.maxHp > elsewhere.cfg.maxHp && onGrave.cfg.damage > elsewhere.cfg.damage, `Phase 7: ghost_059 staerkt einen Untertan am Grabfeld nicht (${elsewhere.cfg.maxHp}/${elsewhere.cfg.damage} vs ${onGrave.cfg.maxHp}/${onGrave.cfg.damage})`);
  }

  // (y) ghost_060 "Armee der Toten": +2 Limit (ghostMaxAdd), garantierte
  // Zusatzkopie je gelungener Probe, -15 % Schaden fuer ALLE Untertanen.
  // Nachschliff: die -15 % (ghostDamageMult) wirken nur ueber die normale
  // resolveGhostCfg()-Pipeline eines GEWOEHNLICHEN Untertanen -- der Champion
  // hat seine eigene, davon unabhaengige Basiswert-Formel (championStatPct
  // vom Spieler). Ein Anker haelt den Champion-Titel, damit BEIDE hier
  // erzeugten Geister gewoehnlich bleiben und die Karte wirklich greift.
  {
    const st = legionRoom({ ghost_060: 1 });
    pushGhost(st, createGhost(st, 500, 500, 0, 't_pink')); // Anker -> wird Champion
    st.rng = () => 0;
    st.killTank(mkEnemy(), 'test', { killer: st.player });
    const ordinary = st.ghosts.filter((g) => !g.isChampion);
    check(ordinary.length === 2, `Phase 7: ghost_060 erzeugt keine garantierte Zusatzkopie (${ordinary.length})`);
    const baseline = resolveGhostBaselineFor(st, 't_pink');
    check(ordinary[0].cfg.damage < baseline, `Phase 7: ghost_060 senkt den Untertanen-Schaden nicht um 15 % (${ordinary[0].cfg.damage} vs Baseline ${baseline})`);
    const cap = (st.data.balance.ghost?.maxActive ?? 3) + (st.player.cfg.ghostMaxAdd || 0);
    check(cap === 5, `Phase 7: ghost_060 erhoeht das Limit nicht um 2 (${cap})`);
  }
  function resolveGhostBaselineFor(st, type) {
    const withoutCard = legionRoom({});
    pushGhost(withoutCard, createGhost(withoutCard, 500, 500, 0, 't_pink')); // Anker -> Champion
    withoutCard.rng = () => 0;
    withoutCard.killTank(mkEnemy(), 'test', { killer: withoutCard.player });
    return withoutCard.ghosts.find((g) => !g.isChampion)?.cfg.damage ?? 0;
  }
}

// ---- 60. Nekromant-V2 Phase 8: Alpha und Verschmelzung (25 Karten) --------
// ghost_061 bis ghost_085 -- der aufwendigste Teil (Auftrag). Zwei neue
// Bausteine: ein zentraler Erzeugungs-Hook pushGhost() (wertet "Einziger
// Thron"/ghost_071 an ALLEN sechs Erzeugungsstellen gleich aus, statt die
// Verschmelzung sechsmal zu duplizieren) und die Champion-Bestimmung, die
// jetzt an den ANFANG von updateGhosts() gewandert ist (Kronen-/Anker-/
// Aura-Karten muessen VOR dem restlichen Tick wissen, wer Champion ist).
// "Getrennte Buchfuehrung dreier Bonusarten": Basiswerte (baseMaxHp/-Damage/
// -FireCooldown, Phase 3, unveraendert), Kronenboni (necroCrown*, bewusst
// STATELESS -- live gegen isChampion ausgewertet, jeder neue Champion liest
// sie automatisch selbst aus demselben Spieler-cfg), Fusionsboni (die
// fusion*-Felder auf jedem Geist -- die EINZIGEN, die ghost_080 tatsaechlich
// an einen Nachfolger uebertragen muss, s. (m)).
{
  const { createState, stepState } = await import('../src/game/state.js');
  const {
    createGhost,
    killGhost,
    updateGhosts,
    occupiedGhostSlots,
    recomputeLegionCache,
    pushGhost,
  } = await import('../src/game/ghost.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');

  const legionRoom = (playerUpgrades = {}, types = ['t_pink']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades,
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    st.walls = [];
    st.isSolid = () => false;
    st.blocksSight = () => false;
    return st;
  };
  const mkEnemy = (x = 400, y = 400, opts = {}) => ({
    // role: 'guardian' (bewegt sich nie, Muster aus frueheren Testhelfern):
    // haelt updateEnemy()/DRIVES[role] am Leben, ohne aggression/preferredRange
    // fuer eine echte Fahrfunktion mitbringen zu muessen.
    cfg: { maxHp: 100, damage: 10, radius: 14, role: 'guardian', accuracy: 0, ...opts.cfg },
    hp: opts.hp ?? 100,
    alive: true,
    type: 't_pink',
    x,
    y,
    heading: 0,
    turret: 0,
    affixes: opts.affixes || [],
    // updateTargeting()/updateEnemy() (ai.js) lesen tank.ai fuer JEDEN
    // Nicht-Spieler-Panzer in state.tanks -- ohne dieses Feld crasht ein
    // stepState()-Aufruf, sobald ein synthetischer Testgegner in state.tanks
    // landet (echte Panzer bekommen es von createTank()).
    ai: { threatTimer: 0, targetTimer: 0, target: null },
  });
  const push = (st, g) => {
    st.ghosts.push(g);
    recomputeLegionCache(st);
    return g;
  };
  // Positioniert g bereits ausgerichtet auf target (Kegel/Cooldown erfuellt),
  // ruft EINEN updateGhosts()-Tick und liefert die dabei von g abgefeuerten
  // Geschosse -- gemeinsamer Helfer fuer alle Feuer-bezogenen Kartentests.
  const fireGhost = (st, g, target) => {
    st.tanks = [st.player, target];
    const ang = Math.atan2(target.y - g.y, target.x - g.x);
    g.turret = ang;
    g.heading = ang;
    g.cooldown = 0;
    const before = st.bullets.length;
    updateGhosts(st, 0.0001);
    return st.bullets.slice(before).filter((b) => b.owner === g);
  };
  // Champion-Feststellung ohne nennenswerte Seiteneffekte (Bewegung/Feuern
  // laufen mit dt=0.0001 praktisch nicht ab, die Kroenungslogik selbst ist
  // dt-unabhaengig).
  const settleChampion = (st) => updateGhosts(st, 0.0001);

  // (a) Struktur: 24 Karten (Champion-/Nekromant-Nachschliff Abschnitt 10:
  //     ghost_068 "Langer Anspruch" ist vollstaendig entfernt, urspruenglich
  //     25 in diesem Bereich), alle mit echtem core (kein "_todo: effect"), NaN-Check.
  {
    const ids = [];
    for (let i = 61; i <= 85; i++) {
      const id = 'ghost_' + String(i).padStart(3, '0');
      if (id !== 'ghost_068') ids.push(id);
    }
    check(ids.length === 24, `Phase 8: ${ids.length} Karten im Bereich statt 24 (ghost_068 muss fehlen)`);
    check(ids.every((id) => necroData.upgrades[id]), 'Phase 8: nicht alle 24 Karten ghost_061..ghost_085 (ohne ghost_068) existieren');
    for (const id of ids) {
      const def = necroData.upgrades[id];
      check(def.core && def.core._todo !== 'effect', `Phase 8: ${id} hat noch keinen core-Wert`);
    }
    const basis = applyUpgrades(resolveCfg(tanksData, 'c_necro'), {}, necroData, 'mine', null);
    for (const id of ids) {
      const cfg = applyUpgrades(resolveCfg(tanksData, 'c_necro'), { [id]: 1 }, necroData, 'mine', null);
      for (const k of Object.keys(cfg)) {
        const bad = (typeof cfg[k] === 'number' && Number.isNaN(cfg[k])) || (cfg[k] === undefined && basis[k] !== undefined);
        check(!bad, `Phase 8: ${id} macht cfg.${k} zu NaN/undefined`);
      }
    }
  }

  // (b) Testschritt 1: ghost_071 "Einziger Thron" -- der ERSTE Untertan wird
  // (mangels vorhandenem Champion) selbst zum Champion; JEDER weitere
  // verschmilzt bedingungslos mit ihm. Nachschliff ("Champion ist ein
  // eigenstaendiger Geisterpanzer, keine dynamische Neubewertung"): die
  // Basiswerte des Champions kommen seither IMMER aus championStatPct * den
  // aktuellen Spielerwerten, nicht mehr aus dem eigenen hp/maxHp des
  // Untertans -- ein kuenstlich hochgesetztes hp VOR der Befoerderung waere
  // deshalb wirkungslos und pruefte den falschen Mechanismus. Stattdessen:
  // der ERSTE gepushte Geist wird immer Champion, unabhaengig von seinen
  // eigenen Werten.
  {
    const st = legionRoom({ ghost_071: 1 });
    const first = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, first); // kein Champion vorhanden -> first wird selbst Champion
    check(first.isChampion, 'Phase 8: Testaufbau -- der erste Untertan sollte selbst Champion werden');
    pushGhost(st, createGhost(st, 500, 500, 0, 't_pink')); // verschmilzt sofort mit first
    check(st.ghosts.length === 1, `Phase 8: ghost_071 laesst trotzdem 2 Untertanen bestehen (${st.ghosts.length})`);
    check(st.ghosts[0] === first, 'Phase 8: der zweite Untertan haette in den Champion verschmelzen muessen, nicht umgekehrt');
    check(first.fusionCount === 1, `Phase 8: fusionCount nach einer Verschmelzung nicht 1 (${first.fusionCount})`);
  }

  // (c) Testschritt 2: drei Verschmelzungen -- der Champion ist sichtbar
  // staerker, der Zaehler stimmt.
  {
    const st = legionRoom({ ghost_071: 1 });
    const champ = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, champ);
    const baseDmg = champ.cfg.damage;
    for (let i = 0; i < 3; i++) pushGhost(st, createGhost(st, 100 + i, 100 + i, 0, 't_pink'));
    check(champ.fusionCount === 3, `Phase 8: Verschmelzungs-Zaehler stimmt nicht (${champ.fusionCount})`);
    check(champ.cfg.damage > baseDmg, `Phase 8: Champion nicht sichtbar staerker nach 3 Verschmelzungen (${baseDmg} -> ${champ.cfg.damage})`);
    check(st.ghosts.length === 1, `Phase 8: nach 3 Verschmelzungen sollte nur der Champion uebrig sein (${st.ghosts.length})`);
  }

  // (d) Testschritt 3: ghost_083 "Ewiger Thron" OHNE ghost_071 -- wirkt
  // trotzdem (kein requires zwischen den beiden Karten). Nachschliff: die
  // Karte ist umgebaut (der Champion hat seit der Champion-Ueberarbeitung
  // OHNEHIN standardmaessig keinen Lebensdauer-Timer mehr, s. (d2)) --
  // dieser Test prueft jetzt ihren NEUEN Effekt (dauerhaft +Schaden/+LP).
  // Nachschliff-Fallstrick: die Champion-Basiswerte kommen IMMER aus
  // championStatPct * Spielerwerten, NICHT aus g's eigenem, geerbten
  // Basiswert vor der Befoerderung (g.cfg.damage VOR pushGhost() ist also
  // gar keine sinnvolle Vergleichsbasis) -- geprueft wird stattdessen
  // Champion MIT gegen Champion OHNE die Karte, in zwei getrennten Raeumen.
  {
    const withCard = legionRoom({ ghost_083: 1 });
    const g = createGhost(withCard, 0, 0, 0, 't_pink');
    pushGhost(withCard, g);
    check(g.isChampion, 'Phase 8: Testaufbau -- einziger Untertan sollte Champion sein');

    const withoutCard = legionRoom({});
    const g0 = createGhost(withoutCard, 0, 0, 0, 't_pink');
    pushGhost(withoutCard, g0);
    check(g0.isChampion, 'Phase 8: Testaufbau -- Kontroll-Champion nicht gesetzt');

    check(g.cfg.damage > g0.cfg.damage, `Phase 8: ghost_083 erhoeht den Champion-Schaden nicht (${g0.cfg.damage} -> ${g.cfg.damage})`);
    check(g.cfg.maxHp > g0.cfg.maxHp, `Phase 8: ghost_083 erhoeht das Champion-Maximalleben nicht (${g0.cfg.maxHp} -> ${g.cfg.maxHp})`);
  }
  // (d2) UEBERARBEITET (Champion-/Nekromant-Nachschliff Abschnitt 3.2): der
  // Champion hat SEIT DIESEM Auftrag wieder eine BEGRENZTE Lebensdauer
  // (Basiswert = dieselbe Konstante wie bei gewoehnlichen Untertanen) und
  // verfaellt ohne "Ewiger Thron" ganz normal -- das genaue Gegenteil des
  // urspruenglichen Testschritts. Nur MIT necroCrownEternalLifetime bleibt
  // er unendlich lebendig.
  {
    const st = legionRoom({});
    const g = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, g);
    check(g.isChampion, 'Phase 8: Testaufbau (d2) -- einziger Untertan sollte Champion sein');
    check(Number.isFinite(g.lifetimeMax), `Abschnitt 65 (Nachschliff 3.2): der Champion hat ohne Ewiger Thron eine unendliche Lebensdauer (${g.lifetimeMax})`);
    updateGhosts(st, g.lifetimeMax + 1); // deutlich nach Ablauf
    check(!st.ghosts.includes(g) || !g.alive, `Abschnitt 65 (Nachschliff 3.2): der Champion verfaellt trotz begrenzter Lebensdauer nicht (lifetime ${g.lifetime})`);

    const stEternal = legionRoom({ ghost_083: 1 }); // "Ewiger Thron"
    const gE = createGhost(stEternal, 0, 0, 0, 't_pink');
    pushGhost(stEternal, gE);
    check(gE.lifetimeMax === Infinity, 'Abschnitt 65 (Nachschliff 3.2): Ewiger Thron macht die Champion-Lebenszeit nicht unendlich');
    updateGhosts(stEternal, 10000);
    check(gE.alive, 'Abschnitt 65 (Nachschliff 3.2): ein Champion mit Ewiger Thron verfaellt trotzdem');
  }

  // (e) Testschritt 4: ghost_085 "Seelenkoloss" ERSETZT die Uebertragung von
  // Einziger Thron/Seelenauslese, statt sich zu addieren.
  {
    const st = legionRoom({ ghost_071: 1, ghost_072: 1, ghost_085: 1 });
    const champ = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, champ);
    const loser = createGhost(st, 100, 100, 0, 't_pink'); // baseMaxHp VOR dem push merken
    const loserBaseMaxHp = loser.baseMaxHp;
    pushGhost(st, loser);
    // Bugfix Abschnitt 5 ("falscher Panzer"): der Uebertragungswert muss aus
    // den BASISWERTEN DES VERSCHMOLZENEN (loser) kommen, NICHT aus denen des
    // Champions (winner) -- genau die vom Auftrag genannte Verwechslung.
    // Champion-Nachschliff (Abschnitt 22): ghost_085 traegt jetzt 150% statt
    // der alten 50% (core.necroFusionReplaceHpPct 1.5).
    const expectedHp = Math.round((loserBaseMaxHp || 0) * 1.5);
    check(
      champ.fusionHpBonus === expectedHp,
      `Phase 8: ghost_085 ersetzt den Uebertragungswert nicht auf 150% des Verschmolzenen (${champ.fusionHpBonus} statt ${expectedHp})`,
    );
    // Ohne Ersetzung wuerde die neue 100%-Basisuebertragung (Abschnitt 4) plus
    // ghost_072s Zusatzrate (0.08) addiert -- das muss von den 150% Ersatzwert
    // klar unterscheidbar bleiben.
    const wouldBeIfAdditive = Math.round((loserBaseMaxHp || 0) * (1.0 + 0.08));
    check(
      champ.fusionHpBonus !== wouldBeIfAdditive,
      `Phase 8: ghost_085 addiert sich zu 071/072 statt zu ersetzen (${champ.fusionHpBonus})`,
    );
  }

  // (f) Testschritt 5: Champion stirbt mit ghost_080 "Kronenerbe" -- der
  // Nachfolger erbt anteilig (60%) die bis dahin angesammelten Fusionsboni.
  {
    const st = legionRoom({ ghost_071: 1, ghost_080: 1 });
    const champ = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, champ);
    pushGhost(st, createGhost(st, 50, 50, 0, 't_pink'));
    pushGhost(st, createGhost(st, 60, 60, 0, 't_pink'));
    check(champ.isChampion, 'Phase 8: Testaufbau -- Champion nicht gesetzt');
    const hpBonusBefore = champ.fusionHpBonus;
    check(hpBonusBefore > 0, 'Phase 8: Testaufbau -- keine Fusionsboni vorhanden');
    killGhost(st, champ, 'damage');
    // Mit ghost_071 aktiv verschmilzt JEDER weitere Geist in den Champion --
    // nach dessen Tod lebt also KEIN gewoehnlicher Geist mehr, den
    // ensureChampion() haette befoerdern koennen. Das Erbe-Fenster bleibt
    // deshalb offen, bis der naechste (hier neu erzeugte) Nachfolger ueber
    // pushGhost() erscheint -- NUR dieser Weg loest promoteToChampion() aus,
    // das den Kronenerbe-Block enthaelt (nicht das rohe createGhost()).
    check(!!st.necroCrownHeir, 'Phase 8: ghost_080 hinterlaesst kein Erbe-Fenster beim Champion-Tod');
    const successor = createGhost(st, 10, 10, 0, 't_pink');
    pushGhost(st, successor);
    check(successor.isChampion, 'Phase 8: der Nachfolger wird nicht zum Champion befoerdert');
    const expected = hpBonusBefore * 0.6;
    check(
      Math.abs(successor.fusionHpBonus - expected) < 1e-6,
      `Phase 8: der Nachfolger erbt nicht 60% der Fusionsboni (${successor.fusionHpBonus} statt ${expected})`,
    );
    check(!st.necroCrownHeir, 'Phase 8: das Erbe-Fenster wird nach der Befoerderung nicht geleert');
  }
  // Gegenprobe fuer (f): necroCrownHeirPct-Applier stillgelegt -> kein Erbe.
  {
    const cfg = applyUpgrades(resolveCfg(tanksData, 'c_necro'), { ghost_080: 1 }, necroData, 'mine', null);
    check(cfg.necroCrownHeirPct > 0, 'Phase 8 Gegenprobe: necroCrownHeirPct wird nicht gesetzt (Applier fehlt)');
  }

  // (g) ghost_061 "Erwaehlter Geist": PERMANENTE Kroenungsboni (+Schaden,
  // +maxHp), nur EINMAL je Geist-Instanz. Nachschliff (Abschnitt 2.1/6, s.
  // Test (m) oben): ein lebender Champion verliert seinen Titel NIE mehr an
  // einen Vergleich -- das alte "Titelwechsel verliert/gewinnt die Krone"-
  // Szenario ist damit strukturell unmoeglich und kein gueltiger Testaufbau
  // mehr. Stattdessen geprueft: (1) MIT vs. OHNE Karte (echter Mechanismus,
  // wie bei (d) oben) und (2) mehrfaches updateGhosts() auf demselben
  // bereits gekroenten Champion addiert den Bonus NICHT nochmal drauf (die
  // Sticky-Architektur ruft promoteToChampion() strukturell nur einmal,
  // s. ensureChampion() -- hier end-to-end bewiesen, nicht nur behauptet).
  {
    const withCard = legionRoom({ ghost_061: 1 });
    const g = push(withCard, createGhost(withCard, 0, 0, 0, 't_pink'));
    settleChampion(withCard);
    check(g.isChampion, 'Phase 8: Testaufbau -- g ist nicht Champion');

    const withoutCard = legionRoom({});
    const g0 = push(withoutCard, createGhost(withoutCard, 0, 0, 0, 't_pink'));
    settleChampion(withoutCard);
    check(g0.isChampion, 'Phase 8: Testaufbau -- Kontroll-Champion nicht gesetzt');

    check(g.cfg.damage > g0.cfg.damage, `Phase 8: ghost_061 erhoeht den Champion-Schaden nicht (${g0.cfg.damage} -> ${g.cfg.damage})`);
    check(g.cfg.maxHp > g0.cfg.maxHp, `Phase 8: ghost_061 erhoeht das Champion-Maximalleben nicht (${g0.cfg.maxHp} -> ${g.cfg.maxHp})`);

    const dmgAfterFirst = g.cfg.damage;
    const maxHpAfterFirst = g.cfg.maxHp;
    for (let i = 0; i < 20; i++) settleChampion(withCard);
    check(
      g.cfg.damage === dmgAfterFirst && g.cfg.maxHp === maxHpAfterFirst,
      `Phase 8: ghost_061 wird bei wiederholten updateGhosts()-Ticks erneut angewendet (${dmgAfterFirst}/${maxHpAfterFirst} -> ${g.cfg.damage}/${g.cfg.maxHp})`,
    );
  }

  // (h) ghost_062 "Einsamer Waechter": +Schaden und +Feuerrate, SOLANGE genau
  // 1 Untertan aktiv ist -- verschwindet, sobald ein zweiter dazukommt.
  {
    const st = legionRoom({ ghost_062: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const target = mkEnemy(60, 0);
    const soloShots = fireGhost(st, g, target);
    check(soloShots.length === 1, `Phase 8: Testaufbau -- kein Schuss ausgeloest (${soloShots.length})`);
    const soloDmg = soloShots[0].damage;

    push(st, createGhost(st, 200, 200, 0, 't_pink')); // 2. Untertan -> nicht mehr allein
    g.cooldown = 0;
    const groupShots = fireGhost(st, g, target);
    check(groupShots.length === 1, 'Phase 8: Testaufbau -- kein zweiter Schuss ausgeloest');
    check(soloDmg > groupShots[0].damage, `Phase 8: ghost_062 wirkt nicht nur solo (solo ${soloDmg} vs zu zweit ${groupShots[0].damage})`);
  }

  // (i) ghost_063 "Kronenpanzerung": +8 Punkte Schadensresistenz NUR fuer
  // den Champion.
  {
    const st = legionRoom({ ghost_063: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const before = g.cfg.resist || 0;
    settleChampion(st);
    check((g.cfg.resist || 0) > before, `Phase 8: ghost_063 erhoeht die Champion-Resistenz nicht (${before} -> ${g.cfg.resist})`);
  }

  // (j) ghost_064 "Jagdinstinkt": +Schaden NUR gegen Elite-/Boss-Ziele, NUR
  // vom Champion.
  {
    const st = legionRoom({ ghost_064: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    const normal = mkEnemy(60, 0);
    const elite = mkEnemy(60, 0, { affixes: [{ id: 'twinshot' }] });
    const dmgNormal = fireGhost(st, g, normal)[0].damage;
    g.cooldown = 0;
    const dmgElite = fireGhost(st, g, elite)[0].damage;
    check(dmgElite > dmgNormal, `Phase 8: ghost_064 erhoeht den Schaden gegen Elite-Ziele nicht (${dmgNormal} vs ${dmgElite})`);
  }

  // (k) ghost_065 "Seelenheilung": der Champion heilt sich, wenn ein ANDERER
  // Untertan stirbt -- auf allen drei Wegen (Schaden, Ablauf, Verschmelzung).
  {
    // Champion-Bestimmung MUSS VOR dem kuenstlichen hp-Absenken laufen --
    // sonst waere der absichtlich geschwaechte "Champion" per Definition der
    // SCHWAECHERE und wuerde die Krone nie tragen (Testfallstrick).
    const stDamage = legionRoom({ ghost_065: 1 });
    const champA = push(stDamage, createGhost(stDamage, 0, 0, 0, 't_pink'));
    const ally = push(stDamage, createGhost(stDamage, 50, 50, 0, 't_pink'));
    settleChampion(stDamage); // champA zuerst erzeugt -> gewinnt bei Gleichstand
    check(champA.isChampion, 'Phase 8: Testaufbau -- champA ist nicht Champion');
    champA.hp = 1;
    ally.hp = 0;
    killGhost(stDamage, ally, 'damage');
    check(champA.hp > 1, `Phase 8: ghost_065 heilt den Champion beim Schadenstod eines Verbuendeten nicht (hp=${champA.hp})`);

    const stExpire = legionRoom({ ghost_065: 1 });
    const champB = push(stExpire, createGhost(stExpire, 0, 0, 0, 't_pink'));
    const allyB = push(stExpire, createGhost(stExpire, 50, 50, 0, 't_pink'));
    settleChampion(stExpire);
    check(champB.isChampion, 'Phase 8: Testaufbau -- champB ist nicht Champion');
    champB.hp = 1;
    killGhost(stExpire, allyB, 'expire');
    check(champB.hp > 1, `Phase 8: ghost_065 heilt beim Ablauf-Tod nicht (hp=${champB.hp})`);

    // Verschmelzung: champC muss trotz niedrigen hp der STAERKERE bleiben,
    // sonst wuerde er selbst absorbiert -- der neue Untertan bekommt dafuer
    // ein noch niedrigeres hp, bevor er gepusht wird.
    const stFusion = legionRoom({ ghost_065: 1, ghost_071: 1 });
    const champC = push(stFusion, createGhost(stFusion, 0, 0, 0, 't_pink'));
    settleChampion(stFusion);
    check(champC.isChampion, 'Phase 8: Testaufbau -- champC ist nicht Champion');
    champC.hp = 1;
    const weakerAlly = createGhost(stFusion, 40, 40, 0, 't_pink');
    weakerAlly.hp = 0.1;
    pushGhost(stFusion, weakerAlly); // verschmilzt in champC
    check(champC.hp > 1, `Phase 8: ghost_065 heilt bei Verschmelzung nicht (hp=${champC.hp})`);
  }

  // (l) ghost_066 "Vorrang des Staerkeren": der Champion zielt auf den
  // Gegner mit dem hoechsten MAXIMALEN Leben, nicht den naechsten.
  {
    const st = legionRoom({ ghost_066: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    const near = mkEnemy(30, 0, { cfg: { maxHp: 50 } });
    const farStrong = mkEnemy(-500, 0, { cfg: { maxHp: 500 } });
    st.tanks = [st.player, near, farStrong];
    const ang0 = g.turret;
    updateGhosts(st, 0.5); // genug Zeit, den Turm auf das gewaehlte Ziel zu drehen
    const angToNear = Math.atan2(near.y - g.y, near.x - g.x);
    const angToStrong = Math.atan2(farStrong.y - g.y, farStrong.x - g.x);
    const devNear = Math.abs(((g.turret - angToNear + Math.PI) % (2 * Math.PI)) - Math.PI);
    const devStrong = Math.abs(((g.turret - angToStrong + Math.PI) % (2 * Math.PI)) - Math.PI);
    check(devStrong < devNear, `Phase 8: ghost_066 zielt nicht auf den Gegner mit dem hoechsten maximalen Leben (Abw. nah=${devNear.toFixed(2)}, stark=${devStrong.toFixed(2)}, Start ${ang0.toFixed(2)})`);
  }

  // (m) ghost_067 "Kronenschild": ein Untertan erhaelt beim Kroenungs-
  // Uebergang einen Schild von 15% seines maximalen Lebens.
  {
    const st = legionRoom({ ghost_067: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    g.shield = 0;
    settleChampion(st);
    check(g.shield > 0, `Phase 8: ghost_067 gewaehrt keinen Kronenschild (${g.shield})`);
  }

  // (n) ENTFERNT (Champion-/Nekromant-Nachschliff Abschnitt 10): ghost_068
  // "Langer Anspruch" ist komplett aus dem Pool entfernt (s. Abschnitt 65k
  // weiter unten fuer den Struktur-Nachweis). Ersatz-Abdeckung fuer
  // Champion-Lebensdauer-Karten liefern die neuen ghost_005/109-113
  // ("Laengerer Eid"/die vier Champion-exklusiven Lebensdauer-Karten,
  // s. eigener Testblock zu Abschnitt 8 des Auftrags weiter unten).

  // (o) ghost_069 "Kritische Krone": zusaetzliche Krit-Chance/-Schaden NUR
  // fuer den Champion -- gestellter RNG-Wurf faengt genau den Bereich, den
  // nur der Bonus erreicht.
  {
    const st = legionRoom({ ghost_069: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    const baseChance = g.cfg.critChance || 0;
    const cfg = st.player.cfg;
    check(cfg.necroCrownCritChanceAdd > 0, 'Phase 8: Testaufbau -- necroCrownCritChanceAdd fehlt');
    st.rng = () => baseChance + cfg.necroCrownCritChanceAdd / 2; // nur mit dem Bonus < Chance
    const target = mkEnemy(60, 0);
    const shot = fireGhost(st, g, target)[0];
    check(shot.crit, 'Phase 8: ghost_069 erhoeht die Krit-Chance des Champions nicht spuerbar');
  }

  // (p) ghost_070 "Herrscheraura": Gegner im Radius verursachen weniger
  // Schaden UND nehmen von Untertanen mehr Schaden.
  {
    const st = legionRoom({ ghost_070: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    const inRange = mkEnemy(20, 0);
    const veryFarAway = mkEnemy(2000, 0);
    const outOfAura = mkEnemy(500, 0); // noch in Feuerreichweite, aber ausserhalb der 80px-Aura
    st.tanks = [st.player, inRange, veryFarAway];
    updateGhosts(st, 0.0001); // markiert necroAuraWeakened neu
    check(inRange.necroAuraWeakened, 'Phase 8: ghost_070 markiert einen nahen Gegner nicht als geschwaecht');
    check(!veryFarAway.necroAuraWeakened, 'Phase 8: ghost_070 markiert einen fernen Gegner faelschlich als geschwaecht');

    // Schaden GEGEN einen markierten Gegner ist hoeher -- der Multiplikator
    // wirkt erst in der TREFFERSCHLEIFE (state.js), nicht am Muendungspunkt,
    // deshalb eine echte Kugel per stepState() treffen lassen statt nur die
    // rohe b.damage der Erzeugung zu lesen. necroAuraWeakened selbst kommt
    // vom VORHERIGEN updateGhosts()-Tick -- erst markieren, dann schiessen.
    st.tanks = [st.player, inRange];
    updateGhosts(st, 0.0001);
    inRange.hp = 1000;
    st.bullets.length = 0;
    st.bullets.push(createBullet(inRange.x, inRange.y, 0, { owner: g, damage: 100, speed: 0, radius: 50 }));
    stepState(st, CMD, 1 / 60);
    const dmgAura = 1000 - inRange.hp;

    st.tanks = [st.player, outOfAura];
    updateGhosts(st, 0.0001);
    outOfAura.hp = 1000;
    st.bullets.length = 0;
    st.bullets.push(createBullet(outOfAura.x, outOfAura.y, 0, { owner: g, damage: 100, speed: 0, radius: 50 }));
    stepState(st, CMD, 1 / 60);
    const dmgFree = 1000 - outOfAura.hp;
    check(dmgAura > dmgFree, `Phase 8: ghost_070 erhoeht den Schaden gegen aura-geschwaechte Gegner nicht (${dmgFree} vs ${dmgAura})`);

    // Zweite Richtung: eine Kugel eines aura-geschwaechten GEGNERS trifft den
    // SPIELER schwaecher als dieselbe Kugel von einem nicht markierten Gegner.
    st.tanks = [st.player, inRange];
    updateGhosts(st, 0.0001); // inRange erneut markieren
    st.player.hp = 1000;
    st.player.shield = 0;
    st.bullets.length = 0;
    st.bullets.push(createBullet(st.player.x, st.player.y, 0, { owner: inRange, damage: 100, speed: 0, radius: 50 }));
    stepState(st, CMD, 1 / 60);
    const dmgTakenWeakened = 1000 - st.player.hp;

    st.tanks = [st.player, outOfAura];
    updateGhosts(st, 0.0001); // outOfAura bleibt unmarkiert
    st.player.hp = 1000;
    st.player.shield = 0;
    st.bullets.length = 0;
    st.bullets.push(createBullet(st.player.x, st.player.y, 0, { owner: outOfAura, damage: 100, speed: 0, radius: 50 }));
    stepState(st, CMD, 1 / 60);
    const dmgTakenNormal = 1000 - st.player.hp;
    check(
      dmgTakenWeakened < dmgTakenNormal,
      `Phase 8: ghost_070 senkt den vom Spieler erlittenen Schaden eines geschwaechten Gegners nicht (${dmgTakenNormal} vs ${dmgTakenWeakened})`,
    );
  }

  // (q) ghost_072 "Seelenauslese" (requires ghost_071): zusaetzliche
  // Uebertragung JE Verschmelzung, additiv zur Grundrate von 071. Der erste
  // Untertan MUSS ueber pushGhost() (nicht den rohen push()-Helfer) gesetzt
  // werden, sonst existiert beim zweiten pushGhost()-Aufruf noch KEIN
  // Champion und die Fusion faellt aus (derselbe Fund wie bei (b) oben).
  {
    const stBase = legionRoom({ ghost_071: 1 });
    const champBase = createGhost(stBase, 0, 0, 0, 't_pink');
    pushGhost(stBase, champBase);
    pushGhost(stBase, createGhost(stBase, 100, 100, 0, 't_pink'));

    const stBonus = legionRoom({ ghost_071: 1, ghost_072: 1 });
    const champBonus = createGhost(stBonus, 0, 0, 0, 't_pink');
    pushGhost(stBonus, champBonus);
    pushGhost(stBonus, createGhost(stBonus, 100, 100, 0, 't_pink'));
    check(
      champBonus.fusionHpBonus > champBase.fusionHpBonus,
      `Phase 8: ghost_072 erhoeht den Uebertragungsanteil nicht (${champBase.fusionHpBonus} vs ${champBonus.fusionHpBonus})`,
    );
  }

  // (r) ghost_073 "Endloser Anspruch" (requires ghost_071, ANGEPASST):
  // jede Verschmelzung gewaehrt dem Champion einen Schild in Hoehe von 15 %
  // seines maximalen Lebens (statt der alten, jetzt wirkungslosen
  // Lebensdauer-Verlaengerung -- der Champion hat ohnehin keinen Timer mehr).
  {
    const st = legionRoom({ ghost_071: 1, ghost_073: 1 });
    const champ = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, champ);
    check(champ.shield === 0, 'Phase 8: Testaufbau (r) -- Champion startet nicht schildlos');
    pushGhost(st, createGhost(st, 100, 100, 0, 't_pink'));
    check(champ.shield > 0, `Phase 8: ghost_073 gewaehrt bei Verschmelzung keinen Schild (${champ.shield})`);
    check(
      Math.abs(champ.shield - champ.cfg.maxHp * 0.15) < 1e-6,
      `Phase 8: ghost_073s Schild-Betrag stimmt nicht (${champ.shield} statt ${champ.cfg.maxHp * 0.15})`,
    );
  }

  // (s) ghost_074 "Verdichtete Geschosse": +Projektilgroesse/-reichweite fuer
  // den Champion; MIT Einziger Thron zusaetzlich +Groesse JE Verschmelzung.
  {
    const st = legionRoom({ ghost_074: 1, ghost_071: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    const target = mkEnemy(60, 0);
    const radiusBefore = fireGhost(st, g, target)[0].radius;
    pushGhost(st, createGhost(st, 100, 100, 0, 't_pink')); // 1 Verschmelzung -> mehr Groesse
    g.cooldown = 0;
    const radiusAfter = fireGhost(st, g, target)[0].radius;
    check(radiusAfter > radiusBefore, `Phase 8: ghost_074 erhoeht die Projektilgroesse mit Einziger Thron nicht je Verschmelzung (${radiusBefore} -> ${radiusAfter})`);
  }

  // (t) ghost_075 "Raubseele": der Champion heilt den Hauptpanzer um einen
  // Anteil des verursachten Schadens; Ueberlauf ueber volles Leben wird OHNE
  // Deckel zu Schild (Nachschliff Abschnitt 9). Nachschliff-Fund: die neuen,
  // KLEINEREN Champion-Basiswerte (championStatPct statt der alten, vom
  // getoeteten Gegner geerbten Werte) machen einen einzelnen Kampf-Treffer
  // mit dem echten 2-%-Anteil rundungsbedingt oft zu 0 -- deshalb hier mit
  // einer manuell gesetzten, hohen Testkugel geprueft (Mechanismus statt
  // Zufallstreffer, CLAUDE.md-Pflicht).
  {
    const st = legionRoom({ ghost_075: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    st.player.hp = st.player.cfg.maxHp; // voll -> die gesamte Heilung geht in den Schild
    st.player.shield = 0;
    const target = mkEnemy(60, 0);
    st.tanks = [st.player, target];
    st.bullets.length = 0;
    // Kugel direkt AM Ziel platziert (nicht an g), damit der Treffer sofort
    // im selben Tick stattfindet, unabhaengig von Flugzeit/Distanz.
    st.bullets.push(createBullet(target.x, target.y, 0, {
      speed: 1, radius: 20, owner: g, kind: 'bullet', damage: 5000,
    }));
    stepState(st, CMD, 1 / 60);
    const expectedShield = Math.round(5000 * st.player.cfg.necroCrownLifestealToPlayerPct);
    check(expectedShield > 0, 'Phase 8: Testaufbau (t) -- necroCrownLifestealToPlayerPct fehlt/ist 0');
    check(
      Math.abs((st.player.shield || 0) - expectedShield) < 1e-6,
      `Phase 8: ghost_075 laesst ueberschuessige Heilung nicht in Schild uebergehen (${st.player.shield} statt ${expectedShield})`,
    );
    // Nachschliff-Gegenprobe: der alte 15-%-Deckel waere hier laengst
    // ueberschritten (500*2%=10 >> 15% von ~66 LP) -- ohne den Fix bliebe
    // der Schild darunter haengen.
    check(
      st.player.shield > st.player.cfg.maxHp * 0.15,
      `Phase 8 (Nachschliff): ghost_075 haengt trotzdem am alten 15-%-Deckel (${st.player.shield})`,
    );
  }

  // (u) ghost_076 "Erbgeschuetz": jeder DRITTE Schuss des Champions feuert
  // ein ZUSAETZLICHES Geschoss mit reduziertem Schaden.
  {
    const st = legionRoom({ ghost_076: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    const target = mkEnemy(60, 0);
    let extraSeen = false;
    for (let i = 0; i < 3; i++) {
      const shots = fireGhost(st, g, target);
      if (shots.length > 1) extraSeen = true;
      g.cooldown = 0;
    }
    check(extraSeen, `Phase 8: ghost_076 feuert nach 3 Schuessen kein Zusatzgeschoss (shotCount=${g.shotCount})`);
  }

  // (v) ghost_077 "Seelenverdichtung": +1 Durchschlag fuer den Champion;
  // MIT Einziger Thron zusaetzlich +Schaden je 3 Verschmelzungen.
  {
    const st = legionRoom({ ghost_077: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    const target = mkEnemy(60, 0);
    const shot = fireGhost(st, g, target)[0];
    check(shot.pierce >= 1, `Phase 8: ghost_077 gewaehrt dem Champion keinen Durchschlag (${shot.pierce})`);

    const stStack = legionRoom({ ghost_077: 1, ghost_071: 1 });
    const champStack = push(stStack, createGhost(stStack, 0, 0, 0, 't_pink'));
    settleChampion(stStack);
    for (let i = 0; i < 3; i++) pushGhost(stStack, createGhost(stStack, 100 + i, 100 + i, 0, 't_pink'));
    const targetStack = mkEnemy(60, 0);
    champStack.cooldown = 0;
    const dmgStacked = fireGhost(stStack, champStack, targetStack)[0].damage;
    const stFlat = legionRoom({ ghost_077: 1, ghost_071: 1 });
    const champFlat = push(stFlat, createGhost(stFlat, 0, 0, 0, 't_pink'));
    settleChampion(stFlat);
    const dmgFlat = fireGhost(stFlat, champFlat, mkEnemy(60, 0))[0].damage;
    check(dmgStacked > dmgFlat, `Phase 8: ghost_077 erhoeht den Schaden nach 3 Verschmelzungen nicht (${dmgFlat} vs ${dmgStacked})`);
  }

  // (w) ghost_078 "Alpha-Schuss": jeder FUENFTE Schuss macht +100% Schaden
  // und erhaelt +1 Durchschlag.
  {
    const st = legionRoom({ ghost_078: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    const target = mkEnemy(60, 0);
    let normalDmg = null;
    let alphaShot = null;
    for (let i = 0; i < 5; i++) {
      const shots = fireGhost(st, g, target);
      if (i === 0) normalDmg = shots[0].damage;
      if (i === 4) alphaShot = shots[0];
      g.cooldown = 0;
    }
    check(alphaShot.damage > normalDmg * 1.5, `Phase 8: ghost_078 verdoppelt den Schaden des 5. Schusses nicht (${normalDmg} -> ${alphaShot.damage})`);
    check(alphaShot.pierce >= 1, `Phase 8: ghost_078 gewaehrt dem 5. Schuss keinen Durchschlag (${alphaShot.pierce})`);
  }

  // (x) ghost_079 "Unantastbarer": einmal pro Raum uebersteht der Champion
  // einen toedlichen Treffer bei 1 Leben + kurzer Unverwundbarkeit.
  {
    const st = legionRoom({ ghost_079: 1 });
    const g = push(st, createGhost(st, 300, 300, 0, 't_pink'));
    settleChampion(st);
    check(g.isChampion, 'Phase 8: Testaufbau -- kein Champion');
    g.hp = 5;
    st.tanks = [st.player];
    st.bullets.push(createBullet(g.x, g.y, 0, { owner: mkEnemy(0, 0), damage: 999, speed: 0, radius: 50 }));
    stepState(st, CMD, 1 / 60);
    check(g.alive && g.hp === 1, `Phase 8: ghost_079 laesst den Champion nicht bei 1 Leben ueberleben (alive=${g.alive}, hp=${g.hp})`);
    check(g.invulnUntil > st.time, 'Phase 8: ghost_079 gewaehrt keine Unverwundbarkeit nach der Rettung');
    // Gegenprobe des "einmal pro Raum": ein ZWEITER toedlicher Treffer nach
    // Ablauf der Unverwundbarkeit toetet ihn wirklich.
    g.invulnUntil = 0;
    g.hp = 5;
    st.bullets.push(createBullet(g.x, g.y, 0, { owner: mkEnemy(0, 0), damage: 999, speed: 0, radius: 50 }));
    stepState(st, CMD, 1 / 60);
    check(!g.alive, 'Phase 8: ghost_079 rettet den Champion ein ZWEITES Mal im selben Raum (sollte nur einmal wirken)');
  }

  // (y) ghost_081 "Seelenmonolith": verankert sich nach necroCrownAnchorAfterS
  // Sekunden Stillstand -- +Schaden/+Reichweite/+Resistenz, bis er sich
  // wieder bewegt.
  {
    const st = legionRoom({ ghost_081: 1 });
    const g = push(st, createGhost(st, 300, 300, 0, 't_pink'));
    st.tanks = [st.player]; // kein Ziel -> Untertan bleibt stehen
    settleChampion(st);
    const anchorAfterS = st.player.cfg.necroCrownAnchorAfterS;
    check(anchorAfterS > 0, 'Phase 8: Testaufbau -- necroCrownAnchorAfterS fehlt');
    updateGhosts(st, anchorAfterS + 0.5);
    check(g.anchored, `Phase 8: ghost_081 verankert den Champion nach Stillstand nicht (anchorTimer=${g.anchorTimer})`);
  }

  // (z) ghost_082 "Kronjaeger": hebt die Exekutionsschwelle fuer vom
  // Champion getroffene Gegner auf 50% an.
  {
    const st = legionRoom({ ghost_082: 1 });
    const g = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    const target = mkEnemy(60, 0, { cfg: { maxHp: 1000 }, hp: 1000 });
    fireGhost(st, g, target);
    st.tanks = [st.player, target];
    stepState(st, CMD, 0.3);
    check(target.necroExecThreshold === 0.5, `Phase 8: ghost_082 setzt die erhoehte Exekutionsschwelle nicht (${target.necroExecThreshold})`);
    check(target.necroExecUntil > st.time, 'Phase 8: ghost_082 setzt kein Zeitfenster fuer die Exekutionsschwelle');
  }

  // (aa) ghost_084 "Unsterblicher Koenig": rettet den Champion wiederholt,
  // eigene Abklingzeit.
  {
    const st = legionRoom({ ghost_084: 1 });
    const g = push(st, createGhost(st, 300, 300, 0, 't_pink'));
    settleChampion(st);
    g.hp = 5;
    st.tanks = [st.player];
    st.bullets.push(createBullet(g.x, g.y, 0, { owner: mkEnemy(0, 0), damage: 999, speed: 0, radius: 50 }));
    stepState(st, CMD, 1 / 60);
    check(g.alive && g.hp > 1, `Phase 8: ghost_084 heilt den Champion nach einem toedlichen Treffer nicht (alive=${g.alive}, hp=${g.hp})`);
    check(g.immortalKingReadyAt > st.time, 'Phase 8: ghost_084 startet keine Abklingzeit');
    // Gegenprobe: waehrend der Abklingzeit rettet die Karte NICHT ein zweites Mal.
    g.invulnUntil = 0;
    g.hp = 5;
    st.bullets.push(createBullet(g.x, g.y, 0, { owner: mkEnemy(0, 0), damage: 999, speed: 0, radius: 50 }));
    stepState(st, CMD, 1 / 60);
    check(!g.alive, 'Phase 8: ghost_084 rettet den Champion trotz laufender Abklingzeit ein zweites Mal');
  }
}

// ---- 61. Nekromant-V2 Phase 9: Hybride und Aktivkarten (20 Karten) --------
// ghost_086 bis ghost_105 (+ ghost_031, seit Phase 6 als Aktivkarten-
// Platzhalter zurueckgestellt). ECHTER Ist-Abgleich-Fund VOR dem eigentlichen
// Kartenbau, nicht im Auftrag genannt, aber Voraussetzung fuer JEDEN der
// fuenf Testschritte: data/upgrades_necro.json wurde seit Phase 0 NIE in die
// aktive Angebots-Pipeline eingehaengt (main.js: loadData() kannte den
// Dateinamen nicht) -- keine der 105 Karten aus den Phasen 1-8 konnte je in
// einem echten Run gezogen werden. main.js mergt den Pool jetzt additiv in
// upgradesData.upgrades (main.js: init()) -- der bestehende signatureClass-
// Filter (Phase 18) erledigt den Rest, ohne dass upgradepool.js/run.js selbst
// angefasst werden mussten. (b) prueft das End-to-End nach.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const {
    createGhost, killGhost, updateGhosts, occupiedGhostSlots, recomputeLegionCache, pushGhost, fuseGhost,
  } = await import('../src/game/ghost.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { hashSeed, rngFor, mulberry32 } = await import('../src/core/rng.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { createRun, chooseUpgrade } = await import('../src/game/run.js');
  const { useGadget, useSecondary } = await import('../src/game/tank.js');
  const { getNecroStack, getNecroTimedStack, addNecroStack } = await import('../src/game/necro.js');
  const mergedUpgrades = { ...upgradesData, upgrades: { ...upgradesData.upgrades, ...necroData.upgrades } };
  // Kurzform-Helfer, damit die einzelnen Kartentests nicht jedesmal scope/'room'
  // ausschreiben muessen (alle Phase-9-Timed-Stacks sind ohnehin raumlokal).
  const getNecroTimedStackForTest = (st, key) => getNecroTimedStack(st, key);
  const getNecroStackForTest = (st, key) => getNecroStack(st, 'room', key);

  const legionRoom = (playerUpgrades = {}, types = ['t_pink'], extraOpts = {}) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades,
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
      ...extraOpts,
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    st.walls = [];
    st.isSolid = () => false;
    st.blocksSight = () => false;
    return st;
  };
  // Wie legionRoom(), aber OHNE st.ghosts zu leeren -- fuer ghost_105 (der
  // Raumstart-Urahn entsteht bereits INNERHALB von createState(), noch bevor
  // legionRoom() zurueckkehrt; das normale Leeren wuerde ihn sofort wieder
  // verwerfen).
  const necroStartRoom = (playerUpgrades, actEnemyPool) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: ['t_pink'],
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades,
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
      actEnemyPool,
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.walls = [];
    st.isSolid = () => false;
    st.blocksSight = () => false;
    return st;
  };
  const mkEnemy = (x = 400, y = 400, opts = {}) => ({
    cfg: { maxHp: 100, damage: 10, radius: 14, role: 'guardian', accuracy: 0, ...opts.cfg },
    hp: opts.hp ?? 100,
    alive: true,
    type: 't_pink',
    x, y,
    heading: 0,
    turret: 0,
    affixes: opts.affixes || [],
    ai: { threatTimer: 0, targetTimer: 0, target: null },
  });
  const push = (st, g) => {
    st.ghosts.push(g);
    recomputeLegionCache(st);
    return g;
  };
  const settleChampion = (st) => updateGhosts(st, 0.0001);
  const fireGhost = (st, g, target) => {
    st.tanks = [st.player, target];
    const ang = Math.atan2(target.y - g.y, target.x - g.x);
    g.turret = ang;
    g.heading = ang;
    g.cooldown = 0;
    const before = st.bullets.length;
    updateGhosts(st, 0.0001);
    return st.bullets.slice(before).filter((b) => b.owner === g);
  };

  // (a) Struktur: 21 Karten (ghost_031 + ghost_086..105), alle mit echtem
  // core (kein "_todo" mehr), NaN-Check gegen die upgradelose Basis,
  // ghost_104/105 sind die einzigen Dreifach-Hybride (legendaer, Gewicht 7).
  {
    const ids = ['ghost_031'];
    for (let i = 86; i <= 105; i++) ids.push('ghost_' + String(i).padStart(3, '0'));
    check(ids.every((id) => necroData.upgrades[id]), 'Phase 9: nicht alle 21 Karten (ghost_031 + ghost_086..105) existieren');
    for (const id of ids) {
      const def = necroData.upgrades[id];
      check(def.core && def.core._todo !== 'effect', `Phase 9: ${id} hat noch keinen core-Wert`);
    }
    const basis = applyUpgrades(resolveCfg(tanksData, 'c_necro'), {}, necroData, 'mine', null);
    for (const id of ids) {
      const cfg = applyUpgrades(resolveCfg(tanksData, 'c_necro'), { [id]: 1 }, necroData, 'mine', null);
      for (const k of Object.keys(cfg)) {
        const bad = (typeof cfg[k] === 'number' && Number.isNaN(cfg[k])) || (cfg[k] === undefined && basis[k] !== undefined);
        check(!bad, `Phase 9: ${id} macht cfg.${k} zu NaN/undefined`);
      }
    }
    for (const id of ['ghost_104', 'ghost_105']) {
      const def = necroData.upgrades[id];
      check(
        def.rarity === 'legendary' && def.weight === 7,
        `Phase 9: ${id} sollte legendaer mit Gewicht 7 sein (${def.rarity}/${def.weight})`,
      );
      const tags = def.tags || [];
      check(
        ['opfer', 'legion', 'alpha'].every((t) => tags.includes(t)),
        `Phase 9: ${id} ist kein Dreifach-Hybrid (opfer+legion+alpha) -- tags=${tags}`,
      );
    }
  }

  // (b) Pipeline-Verdrahtung (Ist-Abgleich-Fund): rollOffers() mit dem ECHT
  // gemergten Pool (main.js-Muster) liefert einer Nekromant-Klasse
  // tatsaechlich eine ghost_0XX-Karte. Die Standard-Klasse sieht nie eine
  // (signatureClass-Filter, Phase 18, unveraendert).
  {
    const drawIds = (starterTank) => {
      const seen = new Set();
      for (let seed = 0; seed < 60; seed++) {
        const offers = rollOffers(mergedUpgrades, {
          chosen: {}, roomIndex: 9, rng: mulberry32(seed * 7 + 1), balance: tanksData.balance,
          count: 3, equippedSecondary: 'mine', banned: new Set(), starterTank,
        });
        for (const o of offers) if (!o.fallback) seen.add(o.id);
      }
      return seen;
    };
    const necroSeen = drawIds('c_necro');
    check(
      [...necroSeen].some((id) => id.startsWith('ghost_')),
      'Phase 9: c_necro zieht ueber den gemergten Pool NIE eine ghost_0XX-Karte -- Pipeline-Verdrahtung fehlt',
    );
    const playerSeen = drawIds('player');
    check(
      ![...playerSeen].some((id) => id.startsWith('ghost_')),
      'Phase 9: die Standard-Klasse sieht ghost_0XX-Karten (signatureClass-Filter greift nicht)',
    );
    // Gegenprobe (dokumentiert, nicht automatisiert): ohne main.js: init()s
    // upgradesData.upgrades = {...,...necroUpgradesData.upgrades}-Merge liefert
    // drawIds('c_necro') eine leere Menge -- von Hand mit dem UNGEMERGTEN
    // upgradesData nachvollzogen (kein ghost_0XX ziehbar).
    {
      const seen0 = new Set();
      const offers0 = rollOffers(upgradesData, {
        chosen: {}, roomIndex: 9, rng: mulberry32(1), balance: tanksData.balance,
        count: 300, equippedSecondary: 'mine', banned: new Set(), starterTank: 'c_necro',
      });
      for (const o of offers0) if (!o.fallback) seen0.add(o.id);
      check(
        ![...seen0].some((id) => id.startsWith('ghost_')),
        'Phase 9 (Gegenprobe): der UNGEMERGTE Pool liefert bereits ghost_0XX -- Testaufbau widerlegt sich selbst',
      );
    }
  }

  // (c) Testschritt 1: Opfer- und Legion-Karten mischen -- O+L-Hybride
  // (ghost_086..091, tags opfer+legion) erscheinen dabei haeufiger als ohne
  // passende Synergie-Bilanz. Direkt ueber rollOffers()s synergyTags-Opt
  // (Upgradepool-v2 Phase 3, makeSynergyWeight()), keine neue Mechanik in
  // Phase 9 selbst -- ISOLIERTER synthetischer Zwei-Karten-Pool (Muster wie
  // Abschnitt 39 (Upgradepool-v2 Phase 3): der echte 110-Karten-Pool wuerde
  // das Signal verwaessern, weil bei ausreichend hohem synergyTags-Wert JEDE
  // Karte mit auch nur EINEM passenden Tag denselben cap (2.0) erreicht --
  // O+L (2 Treffer) und ein reiner O- oder L-Hybrid (1 Treffer) waeren dann
  // ununterscheidbar. Mit kleinen, UNGESAETTIGTEN Werten (opfer:1, legion:1)
  // bekommt die O+L-Karte matches=2 -> 1+2*0.5=2.0 (Deckel), eine Karte mit
  // nur EINEM der beiden Tags matches=1 -> 1+1*0.5=1.5 -- ein echter,
  // messbarer Unterschied (Verhaeltnis 2.0:1.5 = 57,1 %/42,9 %).
  {
    const fakeData = {
      offersPerScreen: 1,
      fallback: { name: '+1 Leben', description: 'x', tag: 'stat', rarity: 'common' },
      upgrades: {
        ol: { id: 'ol', name: 'O+L', description: 'x', tag: 'x1', tags: ['opfer', 'legion'], rarity: 'common', isUnique: false, requires: [], minRoom: 1 },
        oa: { id: 'oa', name: 'O+A', description: 'x', tag: 'x2', tags: ['opfer', 'alpha'], rarity: 'common', isUnique: false, requires: [], minRoom: 1 },
      },
    };
    const balance = { rarity: { common: 100 }, upgrades: { synergyCap: 2.0, synergyStep: 0.5 } };
    const rng = mulberry32(5151);
    let countOl = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const offers = rollOffers(fakeData, {
        chosen: {}, roomIndex: 1, rng, balance, count: 1, banned: new Set(),
        synergyTags: { opfer: 1, legion: 1 },
      });
      if (offers[0].id === 'ol') countOl++;
    }
    const pctOl = (100 * countOl) / N;
    check(
      Math.abs(pctOl - 57.1) < 4,
      `Phase 9 Testschritt 1: O+L-Hybrid ${pctOl.toFixed(1)} % statt ~57,1 % der Ziehungen -- erscheint bei Opfer+Legion-Mix nicht haeufiger als ein Einzeltopf-Hybrid`,
    );
  }

  // (d) necro_active-Kategorie: die drei Aktivkarten sind in
  // data/secondaries.json mit eigener Kategorie (nicht 'gadget' -- Shop-
  // Tausch/`buyShopSecondary()` sollen sie nie anbieten) und den im Auftrag
  // genannten Abklingzeiten 24s/18s/30s verdrahtet.
  {
    const expect = { ghost_031: 24, ghost_089: 18, ghost_096: 30 };
    for (const [id, cd] of Object.entries(expect)) {
      const scfg = tanksData.secondaries[id];
      check(!!scfg, `Phase 9: data/secondaries.json hat keinen Eintrag fuer ${id}`);
      check(scfg?.category === 'necro_active', `Phase 9: ${id} hat nicht die Kategorie 'necro_active' (${scfg?.category})`);
      check(scfg?.cooldownS === cd, `Phase 9: ${id} hat nicht die Abklingzeit ${cd}s (${scfg?.cooldownS})`);
    }
  }

  // (e) ghost_031 "Maertyrerbefehl": opfert ALLE Untertanen, cause 'sacrifice'
  // (killGhost()-Erweiterung), Bonus skaliert mit der geopferten Anzahl.
  // Gegenprobe: killGhost() mit dem alten cause-Default ('damage') wuerde
  // stattdessen die Wiederkehr-Familie/Phylakterium auswerten -- separat in
  // (n) direkt am Mechanismus geprueft, hier nur das Nettoergebnis.
  {
    const st = legionRoom({ ghost_031: 1 });
    const g1 = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    const g2 = push(st, createGhost(st, 200, 200, 0, 't_pink'));
    st.player.cfg.gadget = 'ghost_031';
    st.player.gadgetCooldown = 0;
    const ok = useGadget(st.player, st);
    check(ok, 'Phase 9: ghost_031 loest mit vorhandenen Untertanen nicht aus');
    check(!g1.alive && !g2.alive, 'Phase 9: ghost_031 opfert nicht ALLE Untertanen');
    check(getNecroTimedStackForTest(st, '_timedHybridSacrificeDmg') > 0, 'Phase 9: ghost_031 gibt keinen Schadensbonus');
    check(st.player.gadgetCooldown > 0, 'Phase 9: ghost_031 startet keine Abklingzeit');
    // Kein Untertan vorhanden -> nichts ausgeloest, keine Abklingzeit (Muster
    // layMine()).
    const st2 = legionRoom({ ghost_031: 1 });
    st2.player.cfg.gadget = 'ghost_031';
    st2.player.gadgetCooldown = 0;
    const ok2 = useGadget(st2.player, st2);
    check(!ok2, 'Phase 9: ghost_031 loest ohne Untertanen aus');
    check(st2.player.gadgetCooldown === 0, 'Phase 9: ghost_031 startet trotz Wirkungslosigkeit eine Abklingzeit');
  }

  // (f) ghost_089 "Wechselopfer": opfert NUR den schwaechsten Untertan, heilt
  // + gibt Schild an die uebrigen, garantiert die naechste Wiederbelebungsprobe.
  {
    const st = legionRoom({ ghost_089: 1 });
    const weak = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    weak.hp = 1;
    const strong = push(st, createGhost(st, 200, 200, 0, 't_pink'));
    strong.hp = Math.round(strong.cfg.maxHp * 0.5);
    st.player.cfg.gadget = 'ghost_089';
    st.player.gadgetCooldown = 0;
    st.player.shield = 0;
    const ok = useGadget(st.player, st);
    check(ok, 'Phase 9: ghost_089 loest nicht aus');
    check(!weak.alive, 'Phase 9: ghost_089 opfert nicht den schwaechsten Untertan');
    check(strong.alive && strong.hp > Math.round(strong.cfg.maxHp * 0.5), 'Phase 9: ghost_089 heilt die uebrigen Untertanen nicht');
    check(st.player.shield > 0, 'Phase 9: ghost_089 gibt dem Hauptpanzer keinen Schild');
    check(st.necroGuaranteedReviveUntil > st.time, 'Phase 9: ghost_089 garantiert die naechste Wiederbelebungsprobe nicht');
  }

  // (g) UEBERARBEITET (Champion-/Nekromant-Nachschliff Abschnitt 10):
  // ghost_096 "Koenigliches Opfer" opfert AUSSCHLIESSLICH den Champion und
  // gibt dem Hauptpanzer jetzt DAUERHAFT (kein Zeitfenster mehr) 40% von
  // dessen BASISWERTEN direkt auf die cfg -- kein Timed-Stack mehr.
  {
    const st = legionRoom({ ghost_096: 1 });
    const g1 = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    const g2 = push(st, createGhost(st, 200, 200, 0, 't_pink'));
    settleChampion(st);
    const champ = st.ghosts.find((g) => g.isChampion);
    const other = st.ghosts.find((g) => g !== champ);
    const champBaseDamage = champ.baseDamage;
    const champBaseMaxHp = champ.baseMaxHp;
    const dmgBefore = st.player.cfg.damage;
    const hpBefore = st.player.cfg.maxHp;
    st.player.cfg.gadget = 'ghost_096';
    st.player.gadgetCooldown = 0;
    const ok = useGadget(st.player, st);
    check(ok, 'Phase 9: ghost_096 loest nicht aus');
    check(!champ.alive, 'Phase 9: ghost_096 opfert nicht den Champion');
    check(other.alive, 'Phase 9: ghost_096 opfert einen Nicht-Champion mit');
    const expectedDmg = dmgBefore + Math.round(champBaseDamage * 0.4);
    const expectedHp = hpBefore + Math.round(champBaseMaxHp * 0.4);
    check(
      st.player.cfg.damage === expectedDmg,
      `Phase 9: ghost_096 gibt keinen dauerhaften Schadensbonus (${st.player.cfg.damage} statt ${expectedDmg})`,
    );
    check(
      st.player.cfg.maxHp === expectedHp,
      `Phase 9: ghost_096 gibt keinen dauerhaften LP-Bonus (${st.player.cfg.maxHp} statt ${expectedHp})`,
    );
  }

  // (h) Testschritt 3: eine Aktivkarte auslösen -- die Abklingzeit laeuft im
  // HUD sichtbar (hud.js liest generisch p.gadgetCooldown/run.data.secondaries
  // [p.cfg.gadget].label, KEINE Codeänderung in Phase 9 noetig -- geprueft
  // wird hier deshalb nur, dass tank.gadgetCooldown tatsaechlich den in
  // secondaries.json hinterlegten Wert bekommt, den hud.js unveraendert liest).
  {
    const st = legionRoom({ ghost_089: 1 });
    push(st, createGhost(st, 100, 100, 0, 't_pink'));
    st.player.cfg.gadget = 'ghost_089';
    st.player.gadgetCooldown = 0;
    useGadget(st.player, st);
    check(
      Math.abs(st.player.gadgetCooldown - 18) < 1e-6,
      `Phase 9 Testschritt 3: Abklingzeit nach ghost_089 nicht 18s (${st.player.gadgetCooldown})`,
    );
  }

  // (i) Testschritt 4: eine zweite Aktivkarte ersetzt sichtbar die erste --
  // ueber den bestehenden, generischen tag==='gadget'-Hook (run.js:
  // applyUpgradeChoice()), keine Sonderbehandlung fuer Aktivkarten noetig.
  {
    const run = createRun(tanksData, tilesData, diffData, mergedUpgrades, 555, 'normal', { starterTank: 'c_necro' });
    run.phase = 'upgrade';
    run.pendingOffers = [{ id: 'ghost_031', name: 'Maertyrerbefehl', description: 'x', tag: 'gadget', tags: ['opfer', 'aktiv'], rarity: 'rare', level: 1, isUnique: true }];
    chooseUpgrade(run, 0);
    check(run.equippedGadget === 'ghost_031', 'Phase 9 Testschritt 4: ghost_031 ruestet sich beim Nehmen nicht aus');
    run.phase = 'upgrade';
    run.pendingOffers = [{ id: 'ghost_089', name: 'Wechselopfer', description: 'x', tag: 'gadget', tags: ['opfer', 'legion', 'aktiv'], rarity: 'rare', level: 1, isUnique: true }];
    chooseUpgrade(run, 0);
    check(
      run.equippedGadget === 'ghost_089',
      `Phase 9 Testschritt 4: eine zweite Aktivkarte ersetzt die erste nicht (equippedGadget=${run.equippedGadget})`,
    );
  }

  // (j) Testschritt 2: die Tausch-Warnung erscheint VOR der Wahl, wenn ein
  // Angebot das aktuell ausgeruestete Gadget ersetzen wuerde -- domstub-
  // gestuetzter UI-Test gegen src/ui/upgradescreen.js (Ist-Abgleich-Fund,
  // nicht in der Auftrags-Dateiliste genannt, aber ohne diese Datei ist die
  // Sichtbarkeitsanforderung technisch unerfuellbar).
  {
    const { createUpgradeScreen } = await import('../src/ui/upgradescreen.js');
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    try {
      const screen = createUpgradeScreen();
      const offers = [
        { id: 'ghost_089', name: 'Wechselopfer', description: 'x', tag: 'gadget', rarity: 'rare', level: 1, isUnique: true, stufe: 0 },
      ];
      screen.show({
        getOffers: () => offers,
        getScrap: () => 0,
        costs: { ban: 1, reroll: 2, fourthCard: 3, shieldCharge: 4 },
        showActions: false,
        equippedGadget: 'ghost_031',
        gadgetLabel: (id) => (id === 'ghost_031' ? 'Maertyrerbefehl' : id),
        onPick: () => {},
      });
      const card = document.querySelector('.card');
      check(card.innerHTML.includes('pv-warn'), 'Phase 9 Testschritt 2: keine Tausch-Warnung im Kartenmarkup, obwohl ein Gadget ausgeruestet ist');
      check(card.innerHTML.includes('Maertyrerbefehl'), 'Phase 9 Testschritt 2: die Warnung nennt nicht das aktuell ausgeruestete Gadget');
      // Gegenprobe: kein Gadget ausgeruestet (equippedGadget: null) -> keine Warnung.
      screen.show({
        getOffers: () => offers,
        getScrap: () => 0,
        costs: { ban: 1, reroll: 2, fourthCard: 3, shieldCharge: 4 },
        showActions: false,
        equippedGadget: null,
        gadgetLabel: (id) => id,
        onPick: () => {},
      });
      const card2 = document.querySelector('.card');
      check(!card2.innerHTML.includes('pv-warn'), 'Phase 9 Testschritt 2 (Gegenprobe): Warnung erscheint auch ohne ausgeruestetes Gadget');
    } finally {
      restore();
    }
  }

  // (k) killGhost()s neue cause 'sacrifice': loest onGhostRemoved() mit dem
  // Grund 'sacrifice' aus (necroEventLog), UEBERSPRINGT aber wie 'expire' die
  // Wiederkehr-Familie/Phylakterium/Letzter-Wille -- eine Opferung soll nicht
  // "durch Glueck ueberleben".
  {
    const st = legionRoom({});
    st.player.cfg.ghostReviveChance = 1; // wuerde bei cause='damage' IMMER retten
    const g = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    killGhost(st, g, 'sacrifice');
    check(!g.alive, 'Phase 9: killGhost(..., "sacrifice") mit ghostReviveChance=1 rettet den Untertan trotzdem (Wiederkehr wurde nicht uebersprungen)');
    const last = st.necroEventLog[st.necroEventLog.length - 1];
    check(last?.reason === 'sacrifice', `Phase 9: onGhostRemoved() bekommt bei einer Opferung nicht den Grund 'sacrifice' (${last?.reason})`);
    // Gegenprobe: mit dem alten Default-cause ('damage') UND ghostReviveChance=1
    // ueberlebt der Untertan tatsaechlich -- belegt, dass der obige Fall wirklich
    // an der cause haengt, nicht an einem anderen Zufall.
    const st2 = legionRoom({});
    st2.player.cfg.ghostReviveChance = 1;
    const g2 = push(st2, createGhost(st2, 100, 100, 0, 't_pink'));
    st2.rng = () => 0; // "erfolgreicher" Wiederbelebungswurf
    killGhost(st2, g2); // cause='damage' (Default)
    check(g2.alive, 'Phase 9 (Gegenprobe): Testaufbau widerlegt sich selbst -- ghostReviveChance=1 rettet bei cause="damage" nicht');
  }

  // (l) ghost_086 "Totenmarsch": Geistertod gibt dem Hauptpanzer UND allen
  // ueberlebenden Untertanen einen zeitlich befristeten Schadensbonus.
  {
    const st = legionRoom({ ghost_086: 1 });
    const survivor = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    const victim = push(st, createGhost(st, 200, 200, 0, 't_pink'));
    killGhost(st, victim);
    check(getNecroTimedStackForTest(st, '_timedHybridDeathDmg') > 0, 'Phase 9: ghost_086 gibt dem Hauptpanzer keinen Schadensbonus');
    check(survivor.hybridBuffUntil > st.time && survivor.hybridBuffPct > 0, 'Phase 9: ghost_086 gibt den ueberlebenden Untertanen keinen Bonus');
  }

  // (m) ghost_087 "Erben der Front": ein sterbender Untertan uebertraegt einen
  // Anteil SEINER EIGENEN Basiswerte (nicht des Empfaengers) an einen
  // zufaelligen Ueberlebenden + Schild an den Hauptpanzer. Nachschliff: ein
  // Anker haelt den Champion-Titel -- sonst wuerde killGhost()s abschliessender
  // ensureChampion()-Aufruf den (nun einzigen alive) survivor SOFORT befoerdern
  // und die gerade uebertragenen maxHp/damage wieder ueberschreiben.
  {
    const st = legionRoom({ ghost_087: 1 });
    pushGhost(st, createGhost(st, 900, 900, 0, 't_pink')); // Anker -> wird Champion
    const survivor = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    const dyingBaseMaxHp = 999;
    const victim = push(st, createGhost(st, 200, 200, 0, 't_pink'));
    victim.baseMaxHp = dyingBaseMaxHp;
    victim.baseDamage = 500;
    st.player.shield = 0;
    const before = survivor.cfg.maxHp;
    killGhost(st, victim);
    check(
      survivor.cfg.maxHp > before,
      `Phase 9: ghost_087 erhoeht den maxHp eines Ueberlebenden nicht (${before} -> ${survivor.cfg.maxHp})`,
    );
    const expectedGain = Math.round(dyingBaseMaxHp * st.player.cfg.necroHybridRandomTransferPct);
    check(
      survivor.cfg.maxHp - before === expectedGain,
      `Phase 9: ghost_087 rechnet den Zuwachs nicht vom Basiswert DES STERBENDEN (erwartet +${expectedGain}, war +${survivor.cfg.maxHp - before})`,
    );
    check(st.player.shield > 0, 'Phase 9: ghost_087 gibt dem Hauptpanzer keinen Schild');
  }

  // (n) ghost_088 "Blutige Formation": +X% Schaden JE aktivem Untertan --
  // wirkt auf den SPIELER (necroDamagePct(), "am Ort der Verwendung" in
  // tank.js: fireBullet()), NICHT auf den Untertanen-eigenen Schuss (der
  // Kartentext meint den Hauptpanzer, s. necro.js-Kopfkommentar bei
  // necroDamagePct()) + Flankenbonus fuer den SPIELER + Wiederkehr-Bonus nach
  // Toden (gedeckelt).
  {
    const { necroDamagePct } = await import('../src/game/necro.js');
    const st = legionRoom({ ghost_088: 1 }, ['t_pink']);
    check(necroDamagePct(st) === 0, 'Phase 9: Testaufbau -- necroDamagePct() ist ohne aktive Untertanen schon ungleich 0');
    push(st, createGhost(st, 100, 100, 0, 't_pink'));
    push(st, createGhost(st, 150, 150, 0, 't_pink')); // zwei aktive Untertanen -> Bonus ungleich 0
    check(
      necroDamagePct(st) > 0,
      `Phase 9: ghost_088 erhoeht necroDamagePct() bei aktiven Untertanen nicht (${necroDamagePct(st)})`,
    );
    check(
      st.player.cfg.necroHybridFlankBonusPct > 0 && st.player.cfg.necroHybridReviveDeathBonusPct > 0,
      'Phase 9: ghost_088 setzt necroHybridFlankBonusPct/necroHybridReviveDeathBonusPct nicht',
    );
    // Nachschliff Abschnitt 9: der alte Deckel (necroHybridReviveDeathBonusCap)
    // ist ersatzlos entfernt -- viele Untertan-Tode duerfen den Wiederkehr-
    // Bonus eines wiederbelebten Untertanen unbegrenzt ueber die alte 80-%-
    // Grenze treiben.
    check(
      st.player.cfg.necroHybridReviveDeathBonusCap === undefined,
      'Phase 9 (Nachschliff): ghost_088 setzt noch den entfernten Deckel necroHybridReviveDeathBonusCap',
    );
    for (let i = 0; i < 20; i++) addNecroStack(st, 'room', '_deaths', 1);
    const deaths = getNecroStack(st, 'room', '_deaths');
    const bonusPct = deaths * st.player.cfg.necroHybridReviveDeathBonusPct;
    check(
      bonusPct > 0.8,
      `Phase 9 (Nachschliff): ghost_088s Wiederkehr-Bonus waechst nicht ueber die alte 80-%-Grenze hinaus (${bonusPct})`,
    );
  }

  // (o) ghost_090 "Rueckkehr im Zorn": eine gelungene Probe (rng < chance)
  // erzeugt einen Ersatzuntertan; der Ersatz selbst darf sich nicht erneut
  // ersetzen (isReplacement-Guard).
  {
    const st = legionRoom({ ghost_090: 1 });
    const g = push(st, createGhost(st, 300, 300, 0, 't_pink'));
    const before = st.ghosts.length;
    st.rng = () => 0; // garantiert < chance
    killGhost(st, g); // g bleibt (tot) im Array stehen -- killGhost() splict nicht
    check(
      st.ghosts.length === before + 1,
      `Phase 9: ghost_090 erzeugt keinen Ersatzuntertan bei erfolgreicher Probe (${before} -> ${st.ghosts.length})`,
    );
    const rep = st.ghosts[st.ghosts.length - 1];
    check(rep.isReplacement === true, 'Phase 9: der Ersatzuntertan traegt isReplacement nicht');
    // Gegenprobe/Guard: der Ersatz selbst loest den Effekt nicht erneut aus --
    // die Laenge darf sich NICHT nochmal erhoehen (rep bleibt selbst als
    // toter Eintrag stehen, killGhost() splict nicht).
    const countBefore = st.ghosts.length;
    killGhost(st, rep);
    check(
      st.ghosts.length === countBefore,
      'Phase 9: ein sterbender Ersatzuntertan erzeugt selbst wieder einen Ersatz (isReplacement-Guard fehlt)',
    );
  }

  // (p) ghost_091 "Lawine der Toten": 3 Geistertode innerhalb von 5s loesen
  // einen Buff + 2 kostenlose Untertanen aus -- NICHT schon beim 2. Tod.
  {
    const st = legionRoom({ ghost_091: 1 }, ['t_pink'], { actEnemyPool: ['t_pink'] });
    const mk = () => push(st, createGhost(st, 300, 300, 0, 't_pink'));
    killGhost(st, mk());
    killGhost(st, mk());
    check(!(st.necroAvalancheDeathTimes?.length === 0), 'Phase 9: ghost_091 loest schon beim 2. Tod aus (Zaehler zurueckgesetzt)');
    const before = st.ghosts.filter((g) => g.alive).length;
    killGhost(st, mk());
    check(getNecroTimedStackForTest(st, '_timedHybridAvalancheDmg') > 0, 'Phase 9: ghost_091 gibt beim 3. Tod keinen Schadensbonus');
    check(st.ghosts.filter((g) => g.alive).length > before, 'Phase 9: ghost_091 spawnt keine kostenlosen Untertanen');
  }

  // (q) UEBERARBEITET (Champion-/Nekromant-Nachschliff Abschnitt 10): eine
  // Verschmelzung zaehlt fuer raumweite Spielerstapel jetzt als VOLLER
  // (nicht mehr halber) Geistertod, weiterhin OHNE Heilung/Explosion/
  // Abklingzeit auszuloesen -- nur pureStack-Listener (011/012/013) bekommen
  // den Zuschlag, ein Listener mit Seiteneffekt (097) bleibt bei einer
  // Verschmelzung nur ueber seinen eigenen 'fusion'-Reason ausgeloest, nicht
  // ein zweites Mal durch den ghost_092-Zweig.
  {
    const { onGhostRemoved } = await import('../src/game/necro.js');
    // Positiv: mit ghost_092 UND einer pureStack-Karte (011) gibt eine
    // Verschmelzung den VOLLEN normalen Zuwachs (Auftrag: "volle statt
    // halbe Wirkung").
    const st = legionRoom({ ghost_092: 1, ghost_011: 1 });
    const before = getNecroStackForTest(st, '_pctDamage');
    const dummy = createGhost(st, 500, 500, 0, 't_pink');
    onGhostRemoved(st, dummy, 'fusion');
    const after = getNecroStackForTest(st, '_pctDamage');
    const expectedGain = st.player.cfg.necroDmgPctPerDeath;
    check(
      Math.abs(after - before - expectedGain) < 1e-9,
      `Phase 9: ghost_092 gibt bei einer Verschmelzung nicht exakt den vollen Stapel-Zuwachs (erwartet +${expectedGain}, war +${after - before})`,
    );
    // Kontrolle: OHNE ghost_092 bleibt eine Verschmelzung fuer pureStack-
    // Listener wirkungslos (fusion steht nicht in DEATH_REASONS).
    const st2 = legionRoom({ ghost_011: 1 });
    const before2 = getNecroStackForTest(st2, '_pctDamage');
    onGhostRemoved(st2, createGhost(st2, 500, 500, 0, 't_pink'), 'fusion');
    check(
      getNecroStackForTest(st2, '_pctDamage') === before2,
      'Phase 9 (Kontrolle): eine Verschmelzung erhoeht den pureStack-Stapel bereits OHNE ghost_092 -- Testaufbau widerlegt sich selbst',
    );
    // Ein Listener MIT Seiteneffekt, der 'fusion' selbst in seinen reasons[]
    // hat (ghost_097, ueber den NORMALEN Hauptdurchlauf), darf durch den
    // zusaetzlichen ghost_092-Zweig NICHT ein zweites Mal ausgeloest werden
    // -- der Zweig filtert auf pureStack, nicht auf reasons.
    const st3 = legionRoom({ ghost_092: 1, ghost_097: 1 });
    st3.player.shield = 0;
    onGhostRemoved(st3, createGhost(st3, 500, 500, 0, 't_pink'), 'fusion');
    check(
      getNecroStackForTest(st3, '_hybridThroneDmg') === st3.player.cfg.necroKeystoneThroneDmgPct,
      `Phase 9: ghost_097 wird bei einer Verschmelzung mit ghost_092 nicht GENAU einmal ausgeloest (${getNecroStackForTest(st3, '_hybridThroneDmg')} statt ${st3.player.cfg.necroKeystoneThroneDmgPct})`,
    );
  }

  // (r) ghost_093 "Tribut des Koenigs": NUR Abschuesse WAEHREND ein Untertan
  // Champion war zaehlen -- alle necroHybridChampionKillsPerSpawn Kills
  // erzeugt er einen zusaetzlichen, kurzlebigen Untertan.
  {
    const st = legionRoom({ ghost_093: 1 }, ['t_pink']);
    const champ = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    settleChampion(st);
    check(champ.isChampion, 'Phase 9: Testaufbau -- der einzige Untertan ist nicht Champion');
    const n = st.player.cfg.necroHybridChampionKillsPerSpawn;
    const before = st.ghosts.length;
    for (let i = 0; i < n; i++) {
      const victim = mkEnemy(300, 300, { hp: 1 });
      st.tanks = [st.player, victim];
      st.bullets.push(createBullet(victim.x, victim.y, 0, { owner: champ, damage: 999, speed: 0, radius: 50 }));
      stepState(st, CMD, 1 / 60);
    }
    check(champ.championKills === n, `Phase 9: championKills zaehlt nicht korrekt (${champ.championKills} statt ${n})`);
    check(st.ghosts.length > before, `Phase 9: ghost_093 spawnt nach ${n} Champion-Kills keinen zusaetzlichen Untertan`);
  }

  // (s) ghost_094 "Erbe des Herrschers": stirbt der Champion, erhaelt der
  // HAUPTPANZER einen Anteil des angesammelten Bonus (Delta zum Basiswert)
  // als Schaden + Schild.
  {
    const st = legionRoom({ ghost_094: 1 });
    const champ = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    settleChampion(st);
    champ.cfg.damage = champ.baseDamage + 40; // simulierter angesammelter Bonus
    champ.cfg.maxHp = champ.baseMaxHp + 40;
    st.player.shield = 0;
    const dmgBefore = st.player.cfg.damage;
    killGhost(st, champ);
    check(
      st.player.cfg.damage > dmgBefore,
      `Phase 9: ghost_094 erhoeht den Spielerschaden beim Champion-Tod nicht (${dmgBefore} -> ${st.player.cfg.damage})`,
    );
    check(st.player.shield > 0, 'Phase 9: ghost_094 gibt dem Hauptpanzer keinen Schild');
  }

  // (t) UEBERARBEITET (Champion-/Nekromant-Nachschliff Abschnitt 10):
  // ghost_095 "Seelenband" leitet NUR NOCH einen Anteil des Schadens am
  // Hauptpanzer auf den Champion um (durch dieselbe Resistenz-/Schildpool-
  // Kette) -- der zeitlich befristete Zusatzbonus ist ersatzlos entfernt.
  {
    const st = legionRoom({ ghost_095: 1 });
    const champ = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    settleChampion(st);
    champ.shield = 0;
    champ.cfg.resist = 0;
    const champHpBefore = champ.hp;
    const playerHpBefore = st.player.hp;
    st.player.shield = 0;
    st.tanks = [st.player];
    st.bullets.push(createBullet(st.player.x, st.player.y, 0, { owner: mkEnemy(0, 0), damage: 100, speed: 0, radius: 50 }));
    stepState(st, CMD, 1 / 60);
    check(champ.hp < champHpBefore, 'Phase 9: ghost_095 leitet keinen Schaden auf den Champion um');
    const playerLoss = playerHpBefore - st.player.hp;
    check(playerLoss < 100, `Phase 9: der Spieler nimmt trotz Umleitung den vollen Treffer (${playerLoss})`);
  }

  // (u) ghost_097 "Thron aus Gebein": JEDER Geistertod UND JEDE Verschmelzung
  // erhoehen einen permanenten Raum-Stapel + Schild -- OHNE Obergrenze
  // (Nachschliff Abschnitt 9: sowohl der alte Schadensdeckel als auch der
  // NICHT im Kartentext erwaehnte, versteckte Schild-Deckel sind entfernt).
  {
    const st = legionRoom({ ghost_097: 1 });
    st.player.shield = 0;
    check(
      st.player.cfg.necroKeystoneThroneDmgCap === undefined,
      'Phase 9 (Nachschliff): ghost_097 setzt noch den entfernten Deckel necroKeystoneThroneDmgCap',
    );
    for (let i = 0; i < 40; i++) {
      const g = push(st, createGhost(st, 100, 100, 0, 't_pink'));
      killGhost(st, g);
    }
    const stackAfter40 = getNecroStackForTest(st, '_hybridThroneDmg');
    const expected40 = 40 * st.player.cfg.necroKeystoneThroneDmgPct;
    // Nachschliff-Gegenprobe: 40 Tode * necroKeystoneThroneDmgPct liegt klar
    // ueber dem alten, jetzt entfernten Deckel -- ein wiedereingefuehrter
    // Deckel wuerde diesen exakten linearen Wert verfehlen.
    check(
      Math.abs(stackAfter40 - expected40) < 1e-6,
      `Phase 9: ghost_097s Stapel waechst nicht linear ohne Obergrenze (${stackAfter40} statt ${expected40})`,
    );
    check(st.player.shield > 0, 'Phase 9: ghost_097 gibt keinen Schild');
    const expectedShield40 = 40 * st.player.cfg.maxHp * st.player.cfg.necroKeystoneThroneShieldPct;
    check(
      Math.abs(st.player.shield - expectedShield40) < 1e-6,
      `Phase 9 (Nachschliff): ghost_097s Schild waechst nicht ohne Obergrenze (${st.player.shield} statt ${expectedShield40})`,
    );
    // Verschmelzung zaehlt ebenfalls (eigene reasons: [...DEATH_REASONS,'fusion'])
    // und erhoeht den Stapel WEITER (kein Plateau mehr ohne Deckel).
    const { onGhostRemoved } = await import('../src/game/necro.js');
    const before = getNecroStackForTest(st, '_hybridThroneDmg');
    const dummy = createGhost(st, 0, 0, 0, 't_pink');
    onGhostRemoved(st, dummy, 'fusion');
    check(getNecroStackForTest(st, '_hybridThroneDmg') > before, 'Phase 9: ghost_097s Stapel waechst bei einer Verschmelzung nicht weiter');
  }

  // (v) ghost_098 "Auslese der Legion": erscheint bei VOLLEM Geisterlimit ein
  // weiterer Untertan, verschmilzt STATTDESSEN der SCHWAECHSTE in den
  // Champion -- der neu ankommende Geist selbst erscheint NICHT.
  {
    const st = legionRoom({ ghost_098: 1 });
    const cap = (st.data.balance?.ghost?.maxActive ?? 3) + (st.player.cfg.ghostMaxAdd || 0);
    const champ = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st);
    check(champ.isChampion, 'Phase 9: Testaufbau -- champ ist nicht Champion');
    // Nachschliff ("Champion zaehlt NIE gegen das Limit"): occupiedGhostSlots()
    // zaehlt NUR gewoehnliche Untertanen -- es braucht `cap` (nicht `cap-1`)
    // weitere, gewoehnliche Geister, um das Limit wirklich zu fuellen.
    for (let i = 0; i < cap; i++) {
      const g = push(st, createGhost(st, (i + 1) * 50, (i + 1) * 50, 0, 't_pink'));
      g.hp = 1; // schwaechster Kandidat
    }
    check(occupiedGhostSlots(st) >= cap, 'Phase 9: Testaufbau -- das Geisterlimit ist nicht voll');
    const before = st.ghosts.length;
    const champDmgBefore = champ.cfg.damage;
    const arriving = createGhost(st, 999, 999, 0, 't_pink');
    pushGhost(st, arriving);
    check(!st.ghosts.includes(arriving), 'Phase 9: ghost_098 laesst den neu ankommenden Geist trotz vollem Limit erscheinen');
    check(st.ghosts.length === before, 'Phase 9: ghost_098 aendert die Anzahl der Untertanen (sollte konstant bleiben)');
    check(champ.cfg.damage > champDmgBefore, 'Phase 9: ghost_098 verschmilzt den Schwaechsten nicht in den Champion');
    // Gegenprobe: OHNE necroCapFusion erscheint der ankommende Geist ganz normal.
    const st2 = legionRoom({});
    pushGhost(st2, createGhost(st2, 0, 0, 0, 't_pink'));
    check(st2.ghosts.length === 1, 'Phase 9 (Gegenprobe): ohne ghost_098 verschluckt pushGhost() trotzdem einen normalen Spawn');
  }

  // (v2) ghost_098 END-TO-END ueber den ECHTEN killTank()-Wiederbelebungs-
  // Weg (nicht nur den direkten pushGhost()-Aufruf oben) -- deckt den in
  // Auftrag Abschnitt 4 genannten Bug wirklich ab: "revivals after kills
  // never reach it" (state.js: killTank()s Spawnschleife brach am vollen
  // Limit vorher IMMER sofort ab, bevor pushGhost() je erreicht wurde).
  // Nachgewiesen per Gegenprobe: den Fix in state.js zurueckgenommen laesst
  // GENAU diesen Test rot werden, obwohl (v) oben weiterhin gruen bleibt --
  // das war die eigentliche Luecke im Auftragsbug.
  {
    const cap = (tanksData.balance?.ghost?.maxActive ?? 3);
    const st = legionRoom({ ghost_098: 1 }, Array(cap + 2).fill('t_pink'));
    st.rng = () => 0; // garantierter Spawnwurf bei jedem Kill
    const gegner = st.tanks.filter((t) => t !== st.player);
    for (const e of gegner) e.protect = 0;
    for (let i = 0; i < cap + 1; i++) st.killTank(gegner[i], 'test', { killer: st.player });
    check(occupiedGhostSlots(st) === cap, `Phase 9 (v2): Testaufbau -- Limit nicht ueber echte Kills gefuellt (${occupiedGhostSlots(st)} statt ${cap})`);
    const before = st.ghosts.length;
    const champ = st.ghosts.find((g) => g.isChampion);
    const champDmgBefore = champ.cfg.damage;
    st.killTank(gegner[cap + 1], 'test', { killer: st.player }); // weiterer Kill am vollen Limit
    check(
      st.ghosts.length === before,
      `Phase 9 (v2): ein Kill am vollen Limit erzeugt trotzdem einen zusaetzlichen Untertanen (${before} -> ${st.ghosts.length})`,
    );
    check(
      champ.cfg.damage > champDmgBefore,
      'Phase 9 (v2): ein ueber killTank() ausgeloester Wiederbelebungsversuch am vollen Limit verschmilzt nicht in den Champion',
    );
  }

  // (v3) ghost_098 END-TO-END ueber die ECHTE Geisterbombe (tank.js:
  // useSecondary()/spawnGhostBomb()) -- deckt den dritten in Auftrag
  // Abschnitt 4 genannten Weg ab ("ghost bomb returns false immediately at
  // full limit"). Ein durch die Geisterbombe ausgeloester Verschmelzungs-
  // vorgang zaehlt laut Auftrag als "erfolgreiche Aktion": useSecondary()
  // muss true liefern UND die Abklingzeit starten, nicht wie am echten Limit
  // ohne die Karte grundlos verweigern.
  {
    const cap = (tanksData.balance?.ghost?.maxActive ?? 3);
    const st = legionRoom({ ghost_098: 1 }, Array(cap + 1).fill('t_pink'));
    st.rng = () => 0;
    const gegner = st.tanks.filter((t) => t !== st.player);
    for (const e of gegner) e.protect = 0;
    for (let i = 0; i < cap + 1; i++) st.killTank(gegner[i], 'test', { killer: st.player });
    check(occupiedGhostSlots(st) === cap, `Phase 9 (v3): Testaufbau -- Limit nicht gefuellt (${occupiedGhostSlots(st)} statt ${cap})`);
    const before = st.ghosts.length;
    const champ = st.ghosts.find((g) => g.isChampion);
    const champDmgBefore = champ.cfg.damage;
    st.player.ghostBombCooldown = 0;
    const result = useSecondary(st.player, st, null);
    check(result === true, 'Phase 9 (v3): die Geisterbombe meldet am vollen Limit keinen Erfolg, obwohl sie verschmilzt');
    check(st.player.ghostBombCooldown > 0, 'Phase 9 (v3): eine erfolgreiche Verschmelzung ueber die Geisterbombe startet keine Abklingzeit');
    check(st.ghosts.length === before, `Phase 9 (v3): die Geisterbombe aendert die Anzahl der Untertanen am vollen Limit (${before} -> ${st.ghosts.length})`);
    check(champ.cfg.damage > champDmgBefore, 'Phase 9 (v3): die Geisterbombe verschmilzt am vollen Limit nicht in den Champion');
  }

  // (w) ghost_099 "Kroenungszug": stirbt ein ANDERER Untertan, wird die
  // HAELFTE des aktuellen Champion-Bonus dauerhaft (state.necroCoronationPermDmgPct).
  {
    const st = legionRoom({ ghost_099: 1 });
    const champ = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const ally = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    settleChampion(st);
    check(champ.isChampion, 'Phase 9: Testaufbau -- staerkerer Geist ist nicht Champion');
    check((st.necroCoronationPermDmgPct || 0) === 0, 'Phase 9: Testaufbau -- necroCoronationPermDmgPct ist schon vor dem Tod gesetzt');
    killGhost(st, ally);
    check(st.necroCoronationPermDmgPct > 0, 'Phase 9: ghost_099 setzt nach dem Tod eines Untertanen keinen permanenten Bonus');
  }

  // (x) ghost_100 "Ersatzkoerper": stirbt der Champion, WAEHREND ein weiterer
  // Untertan aktiv ist, uebernimmt der GESUENDESTE Ueberlebende die Haelfte
  // des angesammelten Bonus (Delta zum Basiswert) -- "einmal pro Raum".
  // Nachschliff: stirbt champ, wuerde killGhost()s abschliessendes
  // ensureChampion() sonst SOFORT healthySurvivor (den staerksten
  // Ueberlebenden) selbst befoerdern und die gerade erhaltene Uebertragung
  // ueberschreiben -- ein staerkerer Statist haelt den neuen Champion-Titel,
  // damit healthySurvivor gewoehnlich bleibt und messbar bleibt.
  {
    const st = legionRoom({ ghost_100: 1 });
    // Staerke fuer ensureChampion() kommt fast ausschliesslich aus Schaden
    // (strengthWeights: hp:1, damage:5) -- absichtlich NIEDRIGES hp, damit
    // bystander die Champion-Kroenung sicher gewinnt, aber NICHT ghost_100s
    // eigene "gesuendester Ueberlebender"-Auswahl (die rein nach .hp geht).
    const bystander = createGhost(st, 900, 900, 0, 't_pink');
    bystander.cfg.damage = 999999; // gewinnt die Champion-Kroenung sicher
    push(st, bystander);
    const champ = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    settleChampion(st); // bystander ist klar am staerksten -> wird Champion
    check(bystander.isChampion && !champ.isChampion, 'Phase 9: Testaufbau -- bystander ist nicht Champion');
    // ERST NACH der Befoerderung setzen -- promoteToChampion() ueberschreibt
    // hp/maxHp sonst wieder auf den vollen Champion-Basiswert.
    bystander.hp = 1;
    // champ ist absichtlich NICHT Champion in diesem Test -- ghost_100 wirkt
    // laut Kartentext beim Tod DES CHAMPIONS; da der Mechanismus rein an
    // g.isChampion haengt (nicht an einer Vorbedingung "war zuvor Champion"),
    // wird champ hier manuell dazu erklaert, um seinen isolierten
    // Uebertragungs-Mechanismus zu pruefen, OHNE dass sein Tod zugleich einen
    // neuen Champion unter den zu messenden Ueberlebenden kroenen wuerde.
    champ.isChampion = true;
    champ.cfg.damage = champ.baseDamage + 50;
    champ.cfg.maxHp = champ.baseMaxHp + 50;
    const weakSurvivor = push(st, createGhost(st, 100, 100, 0, 't_pink'));
    weakSurvivor.hp = 1;
    const healthySurvivor = push(st, createGhost(st, 200, 200, 0, 't_pink'));
    const dmgBefore = healthySurvivor.cfg.damage;
    killGhost(st, champ);
    check(bystander.isChampion, 'Phase 9: Vorbedingung -- bystander verliert unerwartet den Champion-Titel');
    check(
      healthySurvivor.cfg.damage > dmgBefore,
      'Phase 9: ghost_100 gibt nicht dem GESUENDESTEN Ueberlebenden den Bonus',
    );
    check(weakSurvivor.cfg.damage === weakSurvivor.baseDamage, 'Phase 9: ghost_100 gibt den Bonus faelschlich an den schwaecheren Ueberlebenden');
    check(st.necroSuccessionUsed === true, 'Phase 9: ghost_100 markiert sich nicht als "einmal pro Raum" verbraucht');
  }

  // (y) ghost_101 "Seelenlieferanten": Abschuesse DURCH Untertanen bekommen
  // eine eigene, unabhaengige Zusatzchance auf der Wiederbelebungsprobe.
  {
    const st = legionRoom({ ghost_101: 1 });
    check(st.player.cfg.necroHybridGhostKillReviveChance > 0, 'Phase 9: ghost_101 setzt necroHybridGhostKillReviveChance nicht');
  }

  // (z) ghost_102 "Kronengarde" (nur Champion): +Resistenz je anderem
  // aktivem Untertan; ist der Champion ALLEIN, periodischer Schild-Schub
  // statt Resistenz.
  {
    const st = legionRoom({ ghost_102: 1 });
    const champ = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    push(st, createGhost(st, 100, 100, 0, 't_pink'));
    settleChampion(st);
    check(champ.legionAuraResist > 0, 'Phase 9: ghost_102 gibt dem Champion mit einem weiteren Untertan keine Resistenz');
    const st2 = legionRoom({ ghost_102: 1 });
    const solo = push(st2, createGhost(st2, 0, 0, 0, 't_pink'));
    settleChampion(st2);
    solo.shield = 0;
    const interval = st2.player.cfg.necroCrownGuardSoloIntervalS;
    updateGhosts(st2, interval + 0.01);
    check(solo.shield > 0, 'Phase 9: ghost_102 gibt einem alleinigen Champion keinen periodischen Schild');
  }

  // (aa) ghost_103 "Massenkrone" (nur Champion, live): +maxHp/+Schaden je
  // Geisterplatz UEBER dem Schwellenwert; belegt AUSSER dem Champion kein
  // Platz, zusaetzlich +Feuerrate.
  {
    const st = legionRoom({ ghost_103: 1 });
    const champ = push(st, createGhost(st, 0, 0, 0, 't_pink'));
    const threshold = st.player.cfg.necroCrownMassSlotThreshold;
    for (let i = 1; i <= threshold; i++) push(st, createGhost(st, i * 40, i * 40, 0, 't_pink'));
    const maxHpBefore = champ.baseMaxHp;
    settleChampion(st);
    check(champ.cfg.maxHp > maxHpBefore, 'Phase 9: ghost_103 erhoeht das maxHp des Champions ueber dem Schwellenwert nicht');
    // Solo-Feuerrate: eigener Raum mit nur dem Champion.
    const st2 = legionRoom({ ghost_103: 1 });
    const solo = push(st2, createGhost(st2, 0, 0, 0, 't_pink'));
    const target = mkEnemy(300, 300, { hp: 1e9 });
    const [bSolo] = fireGhost(st2, solo, target);
    check(!!bSolo, 'Phase 9: Testaufbau -- ghost_103-Solo-Test feuert keine Kugel');
    check(solo.cooldown < solo.cfg.fireCooldown, 'Phase 9: ghost_103 gibt einem alleinigen Champion keinen Feuerraten-Bonus');
  }

  // (ab) Testschritt 5 + ghost_105 "Herrschaft ueber den Tod": zu Raumstart
  // erscheint ein Untertan aus dem GEGNERPOOL DES AKTUELLEN AKTS -- mit einem
  // Pool von genau einem Akt-3-typischen Typ ist das exakt nachweisbar. Der
  // Urahn loest beim Tod EINEN zeitlich befristeten Buff aus -- sowohl beim
  // Sterben (Schaden/Ablauf) ALS AUCH beim Verschmelzen.
  {
    const st = necroStartRoom({ ghost_105: 1 }, ['t_teal']);
    check(st.ghosts.length === 1, 'Phase 9 Testschritt 5: ghost_105 erzeugt nicht genau einen Raumstart-Untertan');
    const ancestor = st.ghosts[0];
    check(ancestor.type === 't_teal', `Phase 9 Testschritt 5: der Urahn stammt nicht aus dem Akt-Gegnerpool (Typ ${ancestor.type})`);
    check(ancestor.isAncestor === true, 'Phase 9: der Raumstart-Untertan traegt isAncestor nicht');
    killGhost(st, ancestor);
    check(getNecroTimedStackForTest(st, '_timedAncestorDmg') > 0, 'Phase 9: ghost_105 gibt beim Tod des Urahns keinen Buff (Schaden/Ablauf-Pfad)');
    // Fusionspfad: fuseGhost() direkt geprueft statt ueber pushGhost()s
    // necroUniqueThrone-Weiche. Nachschliff-Fund: unter "Einziger Thron"
    // ABSORBIERT der Champion IMMER den Neuankoemmling (der Champion
    // gewinnt per Konstruktion, unabhaengig von hp/damage) -- der Urahn ist
    // hier aber der Raum-Start-Untertan und wird deshalb selbst SOFORT
    // Champion (erster Spawn im Raum). Ein "der Urahn verschmilzt WEG"-
    // Szenario kann ueber pushGhost() also gar nicht entstehen, solange der
    // Urahn Champion ist -- fuseGhost() wird deshalb direkt mit einem
    // separaten Champion als Gewinner aufgerufen, um den Mechanismus (der
    // Urahn ALS VERLIERER loest den Buff aus) isoliert zu pruefen.
    const st2 = necroStartRoom({ ghost_105: 1 }, ['t_teal']);
    const firstAncestor = st2.ghosts[0];
    check(firstAncestor.isAncestor === true, 'Phase 9: Testaufbau -- der Raumstart-Untertan ist kein Urahn');
    const otherChampion = createGhost(st2, 500, 500, 0, 't_pink');
    otherChampion.isChampion = true;
    check(getNecroTimedStackForTest(st2, '_timedAncestorDmg') === 0, 'Phase 9: Testaufbau -- der Buff ist schon vor der Verschmelzung gesetzt');
    fuseGhost(st2, otherChampion, firstAncestor);
    check(!firstAncestor.alive, 'Phase 9: Testaufbau -- der Urahn haette hier verschmelzen sollen');
    check(getNecroTimedStackForTest(st2, '_timedAncestorDmg') > 0, 'Phase 9: ghost_105 gibt beim VERSCHMELZEN des Urahns keinen Buff (Fusionspfad)');
  }

  // (ac) Gegenprobe fuer den Fusionspfad von ghost_105: ohne isAncestor-Flag
  // (ein NICHT-Urahn-Geist verschmilzt) bleibt der Buff aus.
  {
    const st = necroStartRoom({ ghost_105: 1 }, ['t_teal']);
    const ancestor = st.ghosts[0];
    const otherChampion = createGhost(st, 500, 500, 0, 't_pink');
    otherChampion.isChampion = true;
    const nonAncestor = createGhost(st, 600, 600, 0, 't_pink');
    check(nonAncestor.isAncestor === false, 'Phase 9: Testaufbau -- der zweite Geist ist faelschlich Urahn');
    fuseGhost(st, otherChampion, nonAncestor);
    check(!nonAncestor.alive, 'Phase 9: Testaufbau -- der Nicht-Urahn haette hier verschmelzen sollen');
    check(
      getNecroTimedStackForTest(st, '_timedAncestorDmg') === 0,
      'Phase 9 (Gegenprobe): ein verschmelzender NICHT-Urahn loest ghost_105s Buff faelschlich aus',
    );
    check(ancestor.alive, 'Phase 9: Testaufbau -- der eigentliche Urahn ist unerwartet betroffen');
  }
}

// ---- 62. Nekromant-V2 Phase 10: Lesbarkeit und Telemetrie -----------------
// Auftrag: "der Spieler muss sehen, was passiert" -- Untertanen-Lebensleiste/
// Schildleiste/Lebenszeit-Ring, Champion-Markierung und drei der vier
// Auftrags-Auren (042/048/049/081) waren bereits ab Phase 3/7/8 gebaut (Ist-
// Abgleich bestaetigt, kein doppelter Testaufbau hier). ECHT NEU in dieser
// Phase: der ghost_070-Aura-Radius war bis jetzt komplett unsichtbar (jetzt
// ein gestrichelter Ring im tatsaechlichen Wirkradius), "Wiederbelebung"
// hatte KEIN sichtbares/hoerbares Gegenstueck (jetzt ghost_rise-Ton +
// Partikel an pushGhost()s echten Erzeugungs-Ausgaengen), und die sechs
// verlangten Telemetriewerte existierten ueberhaupt noch nicht. "Exekution"
// braucht KEINEN neuen Code -- Grundsteinumbau Phase 2s t.executing-Schleife
// iteriert state.tanks (also auch von einem Untertan getroffene Gegner) und
// zeichnet Rauch/Verlangsamung bereits generisch, verifiziert statt
// angenommen (Punkt (i)). ghost_102/103 bekommen BEWUSST KEINEN Ring: beide
// skalieren mit der REINEN ANZAHL/dem Plaetzeverbrauch, ohne raeumlichen
// Wirkradius -- ein Ring haette dort keine geometrische Bedeutung (anders
// als 070/042/048/049, die echte Distanzen pruefen).
{
  const { createState, stepState } = await import('../src/game/state.js');
  const {
    createGhost, killGhost, updateGhosts, pushGhost, occupiedGhostSlots,
  } = await import('../src/game/ghost.js');
  const { createRun, chooseUpgrade } = await import('../src/game/run.js');
  const { createHud } = await import('../src/ui/hud.js');
  const { recordRoom, computeMetrics } = await import('../src/core/telemetry.js');
  const { stepMirrorBoss } = await import('../src/game/bossai.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');

  const necroRoom = (playerUpgrades = {}, types = ['t_pink']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades,
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    return st;
  };
  const arenaRoom = (types, layout) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {},
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
      roomSpec: { fixedLayout: layout },
      arenas: tanksData.arenas,
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    return st;
  };

  // (a) necroGhostsCreated: nur an ECHTEN Erscheinungs-Ausgaengen von
  // pushGhost() -- normaler Pfad UND der Gewinner-Zweig von necroUniqueThrone
  // -- NICHT beim Verlierer-Zweig (existing bleibt) und NICHT bei
  // necroCapFusion am vollen Limit (g wird verworfen).
  {
    const st = necroRoom();
    check(st.necroGhostsCreated === 0, 'Phase 10: Testaufbau -- necroGhostsCreated startet nicht bei 0');
    pushGhost(st, createGhost(st, 100, 100, 0, 't_pink'));
    check(st.necroGhostsCreated === 1, `Phase 10: normaler pushGhost() erhoeht necroGhostsCreated nicht (${st.necroGhostsCreated})`);
    // necroUniqueThrone, Verlierer-Zweig: g wird verworfen -- KEIN Zuwachs.
    const st2 = necroRoom({ ghost_071: 1 });
    pushGhost(st2, createGhost(st2, 0, 0, 0, 't_pink'));
    const strong = st2.ghosts[0];
    strong.hp = 999;
    strong.cfg.maxHp = 999;
    const before = st2.necroGhostsCreated;
    pushGhost(st2, createGhost(st2, 500, 500, 0, 't_pink')); // klar schwaecher -> verschmilzt, existing bleibt
    check(
      st2.necroGhostsCreated === before,
      `Phase 10: der Verlierer-Zweig von necroUniqueThrone erhoeht necroGhostsCreated faelschlich (${before} -> ${st2.necroGhostsCreated})`,
    );
    // necroCapFusion am vollen Limit: g wird verworfen -- KEIN Zuwachs.
    // Nachschliff ("Champion zaehlt NIE gegen das Limit"): der ERSTE Push
    // wird selbst Champion und belegt keinen der `cap` Plaetze -- es braucht
    // `cap + 1` Pushes (1 Champion + cap Gewoehnliche), nicht `cap`, um das
    // Limit wirklich zu fuellen.
    const st3 = necroRoom({ ghost_098: 1 });
    const cap = (st3.data.balance?.ghost?.maxActive ?? 3) + (st3.player.cfg.ghostMaxAdd || 0);
    for (let i = 0; i < cap + 1; i++) pushGhost(st3, createGhost(st3, i * 40, i * 40, 0, 't_pink'));
    check(occupiedGhostSlots(st3) === cap, `Phase 10: Testaufbau -- Limit nicht voll (${occupiedGhostSlots(st3)} statt ${cap})`);
    const before3 = st3.necroGhostsCreated;
    pushGhost(st3, createGhost(st3, 999, 999, 0, 't_pink'));
    check(
      st3.necroGhostsCreated === before3,
      `Phase 10: necroCapFusion am vollen Limit erhoeht necroGhostsCreated faelschlich (${before3} -> ${st3.necroGhostsCreated})`,
    );
  }

  // (b) necroGhostsFused: erhoeht sich in fuseGhost() -- ueber BEIDE
  // Ausloeser (necroUniqueThrone UND necroCapFusion) gleich gezaehlt, weil
  // beide letztlich dieselbe Funktion aufrufen.
  {
    const st = necroRoom({ ghost_071: 1 });
    check(st.necroGhostsFused === 0, 'Phase 10: Testaufbau -- necroGhostsFused startet nicht bei 0');
    pushGhost(st, createGhost(st, 0, 0, 0, 't_pink'));
    const strong = st.ghosts[0];
    strong.hp = 999;
    strong.cfg.maxHp = 999;
    pushGhost(st, createGhost(st, 500, 500, 0, 't_pink'));
    check(st.necroGhostsFused === 1, `Phase 10: eine erzwungene Verschmelzung (071) erhoeht necroGhostsFused nicht (${st.necroGhostsFused})`);
  }

  // (c) necroGhostsDiedByReason: exakt der richtige Schluessel je cause,
  // 'fusion' zaehlt NICHT in diesem Zaehler mit (das ist necroGhostsFused).
  {
    const st = necroRoom();
    pushGhost(st, createGhost(st, 0, 0, 0, 't_pink'));
    const g1 = st.ghosts[0];
    killGhost(st, g1); // cause='damage' -> death_damage
    check(st.necroGhostsDiedByReason.death_damage === 1, 'Phase 10: killGhost(cause=damage) erhoeht death_damage nicht');
    const g2 = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, g2);
    killGhost(st, g2, 'expire');
    check(st.necroGhostsDiedByReason.death_expire === 1, 'Phase 10: killGhost(cause=expire) erhoeht death_expire nicht');
    const g3 = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, g3);
    killGhost(st, g3, 'sacrifice');
    check(st.necroGhostsDiedByReason.sacrifice === 1, 'Phase 10: killGhost(cause=sacrifice) erhoeht sacrifice nicht');
    check(
      st.necroGhostsDiedByReason.death_damage === 1 && st.necroGhostsDiedByReason.death_expire === 1,
      'Phase 10: ein spaeterer Tod veraendert einen fremden Grund-Zaehler',
    );
  }

  // (d) necroReviveRolls/necroReviveHits: nur bei einer ECHTEN Probe
  // (canRevive), Hits nur wenn tatsaechlich ein Untertan entstand
  // (spawnedAny) -- nicht schon beim blossen "Wurf < chance".
  {
    const st = necroRoom();
    st.rng = () => 0; // garantiert erfolgreich
    const victim = st.tanks.find((t) => t !== st.player);
    victim.protect = 0;
    st.killTank(victim, 'test', { killer: st.player });
    check(st.necroReviveRolls === 1, `Phase 10: eine echte Wiederbelebungsprobe erhoeht necroReviveRolls nicht (${st.necroReviveRolls})`);
    check(st.necroReviveHits === 1, `Phase 10: eine erfolgreiche Probe erhoeht necroReviveHits nicht (${st.necroReviveHits})`);
    // Gegenprobe: rng garantiert FEHLSCHLAG -- Rolls steigt, Hits nicht.
    const st2 = necroRoom({}, ['t_pink', 't_pink']);
    st2.rng = () => 0.999;
    const v2 = st2.tanks.find((t) => t !== st2.player);
    v2.protect = 0;
    st2.killTank(v2, 'test', { killer: st2.player });
    check(st2.necroReviveRolls === 1, 'Phase 10: eine fehlgeschlagene Probe erhoeht necroReviveRolls nicht');
    check(st2.necroReviveHits === 0, 'Phase 10: eine fehlgeschlagene Probe erhoeht necroReviveHits faelschlich');
  }

  // (e) necroChampionStrengthSum/-Samples: waechst jeden updateGhosts()-Tick
  // MIT lebendem Champion, bleibt unveraendert OHNE einen.
  {
    const st = necroRoom();
    check(st.necroChampionStrengthSamples === 0, 'Phase 10: Testaufbau -- necroChampionStrengthSamples startet nicht bei 0');
    updateGhosts(st, 1 / 60); // kein Untertan -> kein Champion
    check(st.necroChampionStrengthSamples === 0, 'Phase 10: updateGhosts() ohne Untertan erhoeht die Stichprobe faelschlich');
    pushGhost(st, createGhost(st, 100, 100, 0, 't_pink'));
    updateGhosts(st, 1 / 60);
    check(st.necroChampionStrengthSamples === 1, `Phase 10: updateGhosts() mit Champion erhoeht die Stichprobe nicht (${st.necroChampionStrengthSamples})`);
    check(st.necroChampionStrengthSum > 0, 'Phase 10: necroChampionStrengthSum bleibt bei 0 trotz lebendem Champion');
    updateGhosts(st, 1 / 60);
    check(st.necroChampionStrengthSamples === 2, 'Phase 10: ein zweiter Tick mit Champion erhoeht die Stichprobe nicht erneut');
  }

  // (f) bossShotsAtPlayer/bossShotsAtGhost: stepMirrorBoss() zaehlt jeden
  // ECHTEN Schuss (bullets waechst) nach dem tatsaechlichen Ziel.
  {
    const st = arenaRoom(['t_mirror'], 'boss_mirror');
    const boss = st.tanks.find((t) => t !== st.player);
    const g = createGhost(st, boss.x - 60, boss.y + 60, 0, 't_pink');
    g.cfg.maxHp = 99999;
    g.hp = 99999;
    st.ghosts.push(g);
    check(st.bossShotsAtPlayer === 0 && st.bossShotsAtGhost === 0, 'Phase 10: Testaufbau -- Bossschuss-Zaehler starten nicht bei 0');
    let firedAtPlayer = 0, firedAtGhost = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 20; i++) { // 20 simulierte Sekunden
      st.time += dt;
      boss.cooldown = Math.max(0, boss.cooldown - dt);
      const before = st.bullets.length;
      stepMirrorBoss(boss, st, dt);
      if (st.bullets.length > before) {
        if (boss.ai.target === st.player) firedAtPlayer++;
        else firedAtGhost++;
      }
      st.bullets.length = 0;
    }
    check(firedAtPlayer + firedAtGhost > 0, 'Phase 10: Testaufbau -- der Boss feuert in 20s ueberhaupt nicht');
    check(
      st.bossShotsAtPlayer === firedAtPlayer,
      `Phase 10: bossShotsAtPlayer stimmt nicht mit den echten Schuessen ueberein (${st.bossShotsAtPlayer} statt ${firedAtPlayer})`,
    );
    check(
      st.bossShotsAtGhost === firedAtGhost,
      `Phase 10: bossShotsAtGhost stimmt nicht mit den echten Schuessen ueberein (${st.bossShotsAtGhost} statt ${firedAtGhost})`,
    );
  }

  // (g) "Wiederbelebung": ghost_rise wird bei einem ECHTEN Erscheinen
  // gemeldet (state.sounds), NICHT bei einem verworfenen (necroCapFusion).
  {
    const st = necroRoom();
    pushGhost(st, createGhost(st, 100, 100, 0, 't_pink'));
    check(
      st.sounds.some((s) => (s.name || s) === 'ghost_rise'),
      'Phase 10: ein neu erschienener Untertan meldet keinen ghost_rise-Ton',
    );
    const st2 = necroRoom({ ghost_098: 1 });
    const cap = (st2.data.balance?.ghost?.maxActive ?? 3) + (st2.player.cfg.ghostMaxAdd || 0);
    // Nachschliff: `cap + 1` Pushes (1 Champion + cap Gewoehnliche), nicht
    // `cap`, um das Limit wirklich zu fuellen (Champion zaehlt nicht mit).
    for (let i = 0; i < cap + 1; i++) pushGhost(st2, createGhost(st2, i * 40, i * 40, 0, 't_pink'));
    check(occupiedGhostSlots(st2) === cap, `Phase 10: Testaufbau (g) -- Limit nicht voll (${occupiedGhostSlots(st2)} statt ${cap})`);
    st2.sounds.length = 0;
    pushGhost(st2, createGhost(st2, 999, 999, 0, 't_pink')); // verworfen (necroCapFusion)
    check(
      !st2.sounds.some((s) => (s.name || s) === 'ghost_rise'),
      'Phase 10 (Gegenprobe): ein verworfener Geist (necroCapFusion) meldet trotzdem ghost_rise',
    );
  }

  // (h) HUD: "Untertanen X/Y" (drawBar) + "Wiederbelebungschance" (drawStats)
  // nur fuer den Nekromanten, mit den ECHTEN Werten aus dem aufgeloesten cfg.
  {
    const texts = [];
    const fakeCtx = new Proxy(
      { canvas: { width: 768, height: 512 }, measureText: () => ({ width: 40 }) },
      {
        get: (t, k) => {
          if (k in t) return t[k];
          if (k === 'fillText') return (s) => texts.push(String(s));
          if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
          return () => {};
        },
        set: () => true,
      },
    );
    const hud = createHud(fakeCtx);
    const runN = createRun(tanksData, tilesData, diffData, upgradesData, 11, 'normal', { starterTank: 'c_necro' });
    // Die Anzeige gilt nur im laufenden Raum -- ein frischer Run steht auf
    // 'preview' und wuerde gar nichts zeichnen (Muster: Abschnitt 8f/P7).
    runN.phase = 'playing';
    runN.state.ghosts.length = 0;
    // Nachschliff: ein solo gepushter Geist wuerde selbst zum Champion (zaehlt
    // NIE gegen das Limit) -- ein Anker haelt den Titel, damit der zweite
    // Geist als GEWOEHNLICHER Untertan in "Untertanen 1/Y" auftaucht.
    pushGhost(runN.state, createGhost(runN.state, 500, 500, 0, 't_pink'));
    pushGhost(runN.state, createGhost(runN.state, 100, 100, 0, 't_pink'));
    texts.length = 0;
    hud.render(runN, { stats: true });
    const joined = texts.join('\n');
    const cap = (runN.data.balance?.ghost?.maxActive ?? 3) + (runN.state.player.cfg.ghostMaxAdd || 0);
    check(joined.includes(`Untertanen 1/${cap}`), `Phase 10: HUD zeigt "Untertanen X/Y" nicht korrekt (Text: ${joined.replace(/\n/g, ' | ')})`);
    check(joined.includes('Wiederbelebungschance'), 'Phase 10: HUD zeigt keine Wiederbelebungschance-Zeile');
    // Kontrolle: die Standard-Klasse zeigt beides NICHT.
    const runP = createRun(tanksData, tilesData, diffData, upgradesData, 11);
    runP.phase = 'playing';
    texts.length = 0;
    hud.render(runP, { stats: true });
    const joinedP = texts.join('\n');
    check(!joinedP.includes('Untertanen'), 'Phase 10: die Standard-Klasse zeigt faelschlich eine Untertanen-Zeile');
    check(!joinedP.includes('Wiederbelebungschance'), 'Phase 10: die Standard-Klasse zeigt faelschlich eine Wiederbelebungschance-Zeile');
  }

  // (i) Exekution ist bereits generisch abgedeckt (Grundsteinumbau Phase 2):
  // t.executing iteriert state.tanks, trifft also auch einen von einem
  // UNTERTAN getroffenen Gegner. Verifiziert statt angenommen -- Nachweis
  // ueber die echte Schadensschleife: ein von einer Geisterkugel
  // getroffener, bereits unter der Schwelle stehender Gegner erhaelt
  // t.executing UND den Rauch-Timer, ohne dass Phase 10 dafuer Code
  // anfassen musste.
  {
    const st = necroRoom();
    const enemy = st.tanks.find((t) => t !== st.player);
    const exCfg = st.data.balance.execute;
    enemy.hp = Math.max(1, Math.round(enemy.cfg.maxHp * exCfg.thresholdPct * 0.5)); // klar unter der Schwelle
    stepState(st, { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false }, 1 / 60);
    check(enemy.executing === true, 'Phase 10: ein Gegner unter der Exekutionsschwelle traegt t.executing nicht (Untertanen-Treffer waeren sonst unsichtbar)');
  }

  // (j) telemetry.js: recordRoom() speichert das necro-Feld unveraendert,
  // computeMetrics() aggregiert Quote/Championstaerke/Bossschuss-Anteil
  // korrekt ueber SYNTHETISCHE Werte (nicht ueber einen echten Spiellauf --
  // Mechanismus statt Datenlage).
  {
    // recordRoom() haengt an einem modulinternen "current"-Puffer, der nur
    // ueber beginRun()/endRun() zugaenglich ist -- fuer den Aggregations-
    // test bauen wir stattdessen direkt Run-Objekte im computeMetrics()-
    // Eingabeformat (dieselbe Form, die endRun() erzeugt).
    const mkRun = (rooms) => ({ won: true, rooms });
    const runs = [
      mkRun([
        { room: 1, necro: { created: 3, fused: 1, diedByReason: { death_damage: 2, death_expire: 1, sacrifice: 0 }, reviveRolls: 4, reviveHits: 3, championStrengthSum: 100, championStrengthSamples: 10, bossShotsAtPlayer: 6, bossShotsAtGhost: 4 } },
      ]),
      mkRun([
        { room: 1, necro: { created: 1, fused: 0, diedByReason: { death_damage: 0, death_expire: 1, sacrifice: 1 }, reviveRolls: 2, reviveHits: 1, championStrengthSum: 50, championStrengthSamples: 10, bossShotsAtPlayer: 0, bossShotsAtGhost: 0 } },
      ]),
    ];
    const m = computeMetrics(runs);
    check(!!m.necro, 'Phase 10: computeMetrics() liefert kein necro-Objekt trotz vorhandener Rohdaten');
    check(m.necro.created === 4, `Phase 10: Untertanen-erzeugt-Summe falsch (${m.necro.created} statt 4)`);
    check(m.necro.fused === 1, `Phase 10: verschmolzen-Summe falsch (${m.necro.fused} statt 1)`);
    check(
      m.necro.diedByReason.death_damage === 2 && m.necro.diedByReason.death_expire === 2 && m.necro.diedByReason.sacrifice === 1,
      `Phase 10: gestorben-nach-Grund-Summe falsch (${JSON.stringify(m.necro.diedByReason)})`,
    );
    // Quote: (3+1)/(4+2) = 4/6 = 66,7 % -> gerundet 67.
    check(m.necro.reviveQuotePct === 67, `Phase 10: Wiederbelebungsquote falsch (${m.necro.reviveQuotePct} statt 67)`);
    // Championstaerke: (100+50)/(10+10) = 7,5 -> gerundet 8.
    check(m.necro.avgChampionStrength === 8, `Phase 10: durchschnittliche Championstaerke falsch (${m.necro.avgChampionStrength} statt 8)`);
    // Bossschuesse: 6/(6+4) = 60 %.
    check(m.necro.bossShotsPlayerPct === 60, `Phase 10: Bossschuss-Anteil falsch (${m.necro.bossShotsPlayerPct} statt 60)`);
    // Gegenprobe: ganz ohne necro-Daten bleibt computeMetrics().necro null.
    const mLeer = computeMetrics([mkRun([{ room: 1, necro: null }])]);
    check(mLeer.necro === null, 'Phase 10 (Gegenprobe): computeMetrics() liefert necro trotz fehlender Rohdaten');
  }

  // (k) renderer.js: der ghost_070-Aura-Ring wird NUR gezeichnet, wenn der
  // Champion die Karte traegt -- Nachweis ueber den echten, aufzeichnenden
  // Fake-Canvas-Renderpfad aus tests/domstub.mjs (Muster: Abschnitt 2f),
  // nicht nur "core-Feld gesetzt".
  {
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    try {
      const { createRenderer } = await import('../src/render/renderer.js');
      const { createTracks } = await import('../src/render/tracks.js');
      const ctx = document.createElement('canvas').getContext('2d');
      const renderer = createRenderer(ctx);
      const tracks = createTracks();
      const arcRadii = () => ctx.calls.filter((c) => c.fn === 'arc').map((c) => c.args[2]);

      const st = necroRoom({ ghost_070: 1 });
      pushGhost(st, createGhost(st, 300, 300, 0, 't_pink'));
      updateGhosts(st, 1 / 60); // Champion-Bestimmung
      ctx.calls.length = 0;
      renderer.render(st, 1, tracks, null, null);
      const radius = st.player.cfg.necroCrownAuraRadius;
      check(
        arcRadii().some((r) => Math.abs(r - radius) < 0.01),
        `Phase 10: der ghost_070-Aura-Ring wird nicht im echten Wirkradius (${radius}) gezeichnet`,
      );
      // Gegenprobe: ohne die Karte erscheint KEIN Kreis in diesem Radius.
      const st2 = necroRoom();
      pushGhost(st2, createGhost(st2, 300, 300, 0, 't_pink'));
      updateGhosts(st2, 1 / 60);
      ctx.calls.length = 0;
      renderer.render(st2, 1, tracks, null, null);
      check(
        !arcRadii().some((r) => Math.abs(r - radius) < 0.01),
        'Phase 10 (Gegenprobe): der Aura-Ring erscheint auch ohne ghost_070',
      );
    } finally {
      restore();
    }
  }
}

// ---- 63. Nekromant-V2 Phase 11: Balance und Abnahme ------------------------
// Die Schlussabnahme des gesamten Auftrags (25 nummerierte Punkte). Ist-
// Abgleich VOR dem Testbau ergab: die meisten Punkte sind schon durch
// Abschnitt 55-62 (Phasen 0-10) mit eigenen Zahlen bewacht -- Mapping-
// Tabelle (Muster "Upgrade-/Klassenpool-System v2 + Nekromant -- Phase 9
// (Abnahme)"):
//   Daten          1 -> 55(a)/(b)      2 -> 55(c)         3 -> 55(b)+37(a)
//                  4 -> 58/59/60/61(a) 5 -> HIER (a), NEU 6 -> HIER (b), NEU
//   Grundmechanik  7 -> 43(b)          8 -> 42(b2)+60(f)  9 -> 62(b)/(c),
//                                                          verschaerft HIER (c)
//                  10 -> 60            11 -> 43/59
//   Stapelung      12 -> 37(c)+HIER (d), NEU (Skalierung selbst)
//                  13 -> 37(c)/(d)+HIER (e), NEU (Shop/Truhe/Ereignis/Reroll,
//                        Vorschau-ohne-Wahl, neuer Run)
//                  14 -> Applier-Konstruktion (cfg.js: lvl-Faktor ohne
//                        Deckel) + HIER (d) UI-Nachweis, NEU
//   Systeme        15 -> 56            16 -> 56           17 -> HIER (f), NEU
//                  18 -> 60(e)         19 -> 57            20 -> 58
//                  21 -> 61 Testschritt 4
//   Bosskorridor   22 -> Abschnitt 45 (Untergrenze)  23 -> Abschnitt 45 (Obergrenze)
//                  24 -> 41(l)         25 -> 41(j)+Abschnitt 5
// Echte Luecken (kein bestehender Test deckt sie ab), NEU HIER: (a) Punkt 5
// ERSCHOEPFEND ueber alle 105 Karten statt stichprobenbasiert (Abschnitt
// 61(b) sampelt nur 60 Seeds -- eine seltene Karte koennte darin fehlen,
// ohne dass das auffiele); (b) Punkt 6 am ECHTEN gemergten Pool (die
// bestehende Mechanismus-Probe in Abschnitt 38(c)/(2) Upgradepool-v2 nutzt
// einen synthetischen Drei-Karten-Pool, nicht die realen 105 Karten); (c)
// Punkt 9 auf LISTENER-Ebene (Abschnitt 62 zaehlt nur die vier Zaehler
// distinkt hoch -- ob ein Listener, der NUR auf einen Grund hoert, wirklich
// NIE fuer die anderen drei feuert, ist damit noch nicht bewiesen); (d)
// Punkte 12/14 an der ECHTEN Skalierungsformel (cfg-Wert bei Stufe 1/10/
// 100/1000, nicht nur "bleibt im Pool") + der UI-Text zeigt bei hoher Stufe
// kein "MAX"/"/Y"; (e) Punkt 13s Shop/Truhe/Ereignis/Reroll-Wortlaut (alle
// vier laufen durch denselben drawOne()/buildCandidates()-Choker, aber das
// war bisher nirgends direkt an drawOne() gezeigt) + "nur angezeigt bleibt
// verfuegbar" + "neuer Run macht wieder verfuegbar"; (f) Punkt 17 mit einer
// gezielt VERFAELSCHTEN aktuellen Kraft (Loser-Geist hat einen aufgeblaehten
// cfg.damage, der klar von seinem baseDamage abweicht) -- bestehende Tests
// pruefen den Uebertragungs-MECHANISMUS, aber nie explizit, dass eine
// aufgeblaehte AKTUELLE Kraft ignoriert wird.
// "Doppelte Pool-Eintraege erzeugen kein zweites Exemplar" (Teil von Punkt
// 13) ist STRUKTURELL unmoeglich (JS-Objektschluessel in upgrades_necro.json
// sind zwingend eindeutig, Abschnitt 55(a) bewacht das bereits) -- keine
// eigene Testzeile noetig.
{
  const { buildCandidates, rollOffers, drawOne } = await import('../src/game/upgradepool.js');
  const { createRun, chooseUpgrade } = await import('../src/game/run.js');
  const { createGhost, pushGhost, killGhost } = await import('../src/game/ghost.js');
  const { createState } = await import('../src/game/state.js');
  const { hashSeed, rngFor, mulberry32 } = await import('../src/core/rng.js');
  const mergedUpgrades = { ...upgradesData, upgrades: { ...upgradesData.upgrades, ...necroData.upgrades } };

  // Champion-/Nekromant-Nachschliff: 105 urspruengliche Karten + 11 neue
  // (ghost_106..ghost_116) - 1 entfernte (ghost_068 "Langer Anspruch") = 115.
  const necroIds = Object.keys(necroData.upgrades);
  check(necroIds.length === 115, `Phase 11: ${necroIds.length} Karten im Pool statt 115 (Testvoraussetzung)`);

  const necroRoom = (playerUpgrades = {}, types = ['t_pink']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades,
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    return st;
  };

  // (a) Punkt 5, ERSCHOEPFEND: buildCandidates() direkt (kein RNG, kein
  // Sampling) fuer ALLE 105 Karten einzeln gegenpruefen -- keine erscheint
  // fuer die Standardklasse, JEDE erscheint fuer c_necro. Pro Karte ein
  // MINIMALES chosen, das nur DEREN EIGENE requires-Vorbedingungen erfuellt
  // (nicht global fuer alle 105 Karten): ein globales chosen haette Karten
  // wie ghost_071 (selbst isUnique UND requires-Ziel von ghost_072/073/085)
  // fuer sich selbst als "schon gewaehlt" markiert und faelschlich
  // ausgeschlossen -- per Gegenprobe am eigenen Testaufbau gefunden.
  {
    let leakedForPlayer = [];
    let missingForNecro = [];
    for (const id of necroIds) {
      const def = necroData.upgrades[id];
      const chosenFor = {};
      for (const r of def.requires || []) chosenFor[r] = 1;
      // Nachschliff ("Blutiger Thron"-Fix): requiresAnyOf braucht mindestens
      // eine erfuellte id JE Gruppe -- die erste jeder Gruppe reicht.
      for (const group of def.requiresAnyOf || []) chosenFor[group[0]] = 1;
      const opts = {
        chosen: chosenFor, roomIndex: 999, balance: tanksData.balance,
        banned: new Set(), selectedUniqueUpgradeIds: new Set(),
        // ghost_056 traegt tag:'elite' -- EXCLUDED_TAGS haelt Tag 'elite'
        // grundsaetzlich aus dem normalen Angebot heraus (reserviert fuer
        // den automatischen 4.-Karte-Elite-Bonus, UMBAUPLAN-LP Phase 9),
        // erreichbar nur ueber includeTag. Kein Sonderfall der Karte selbst,
        // sondern derselbe Mechanismus wie bei jeder anderen elite-Karte.
        ...(def.tag === 'elite' ? { includeTag: 'elite' } : {}),
      };
      const forPlayer = buildCandidates(mergedUpgrades, { ...opts, starterTank: 'player' });
      if (forPlayer.some((d) => d.id === id)) leakedForPlayer.push(id);
      const forNecro = buildCandidates(mergedUpgrades, { ...opts, starterTank: 'c_necro' });
      if (!forNecro.some((d) => d.id === id)) missingForNecro.push(id);
    }
    check(
      leakedForPlayer.length === 0,
      `Phase 11: ${leakedForPlayer.length} Nekromant-Karte(n) erscheinen fuer die Standardklasse (${leakedForPlayer.join(',')})`,
    );
    check(missingForNecro.length === 0, `Phase 11: ${missingForNecro.length} Nekromant-Karte(n) erscheinen NICHT fuer c_necro (${missingForNecro.join(',')})`);
  }

  // (a2) Nachschliff Abschnitt 7 ("Blutiger Thron" ohne Nutzen anbietbar):
  // ghost_092 braucht BEIDES gleichzeitig -- eine funktionierende Fusionsquelle
  // (ghost_071 ODER ghost_098) UND mindestens eine der drei Zaehlerkarten
  // (ghost_011/012/013). Alle vier Kombinationen einzeln geprueft, damit die
  // "UND-von-ODER"-Struktur wirklich beide Achsen unabhaengig durchsetzt.
  {
    const base = { roomIndex: 999, balance: tanksData.balance, banned: new Set(), starterTank: 'c_necro', selectedUniqueUpgradeIds: new Set() };
    const sees092 = (chosen) => buildCandidates(mergedUpgrades, { ...base, chosen }).some((d) => d.id === 'ghost_092');
    check(!sees092({}), 'Phase 11 (Nachschliff): ghost_092 erscheint ganz ohne Voraussetzungen');
    check(!sees092({ ghost_071: 1 }), 'Phase 11 (Nachschliff): ghost_092 erscheint nur mit Fusionsquelle, ohne Zaehlerkarte');
    check(!sees092({ ghost_011: 1 }), 'Phase 11 (Nachschliff): ghost_092 erscheint nur mit Zaehlerkarte, ohne Fusionsquelle');
    check(sees092({ ghost_071: 1, ghost_011: 1 }), 'Phase 11 (Nachschliff): ghost_092 erscheint nicht mit ghost_071 + ghost_011');
    check(sees092({ ghost_098: 1, ghost_012: 1 }), 'Phase 11 (Nachschliff): ghost_092 erscheint nicht mit ghost_098 + ghost_012 (andere Gruppenmitglieder)');
    check(sees092({ ghost_071: 1, ghost_098: 1, ghost_013: 1 }), 'Phase 11 (Nachschliff): ghost_092 erscheint nicht, wenn beide Fusionsquellen aktiv sind');
  }

  // (b) Punkt 6, am ECHTEN gemergten Pool statt eines synthetischen
  // Drei-Karten-Pools (Abschnitt 38(c)/(2)): rollOffers() ueber viele Seeds
  // in Raum 9 -- mindestens ein Angebot besteht aus DREI ghost_0XX-Karten
  // gleichzeitig (Anhang A Paragraph 19, jetzt am realen 105-Karten-Bestand
  // nachgewiesen statt nur am Mechanismus).
  {
    let found = false;
    for (let seed = 0; seed < 400 && !found; seed++) {
      const offers = rollOffers(mergedUpgrades, {
        chosen: {}, roomIndex: 9, rng: mulberry32(seed * 13 + 3), balance: tanksData.balance,
        count: 3, equippedSecondary: 'mine', banned: new Set(), starterTank: 'c_necro',
      });
      if (offers.length === 3 && offers.every((o) => !o.fallback && o.id.startsWith('ghost_'))) found = true;
    }
    check(found, 'Phase 11: kein Angebot mit drei Nekromant-Signaturkarten gleichzeitig in 400 Seeds gefunden');
  }

  // (c) Punkt 9, auf LISTENER-Ebene: vier frische Test-Listener, je EINEM
  // Grund zugeordnet, werden ueber ECHTE Ausloeser (killTank->Wiederbelebung
  // fuer nichts hier gebraucht -- direkt killGhost()/pushGhost()-Fusion)
  // angesprochen. Jeder Listener darf NUR fuer seinen eigenen Grund feuern.
  {
    // KEIN necroUniqueThrone von Anfang an -- sonst wuerde bereits das
    // zweite/dritte pushGhost() (waehrend das jeweils vorherige, LAENGST
    // tote Geistobjekt noch als Array-Leiche herumliegt, s. u.) selbst
    // schon eine echte Fusion ausloesen und den Zaehler verfaelschen. Der
    // Flag wird erst kurz vor dem eigentlichen Fusions-Trigger gesetzt.
    const st = necroRoom();
    const hits = { death_damage: 0, death_expire: 0, fusion: 0, sacrifice: 0 };
    for (const reason of ['death_damage', 'death_expire', 'fusion', 'sacrifice']) {
      st.necroListeners.push({
        reasons: [reason], scope: 'room', key: `test_${reason}`,
        fn: () => { hits[reason]++; },
      });
    }
    // Jede Erzeugung wird in einer EIGENEN Variable gehalten -- killGhost()
    // entfernt ein totes Geistobjekt NICHT sofort aus state.ghosts (das
    // macht erst updateGhosts()s Filter spaeter), st.ghosts[0] wuerde nach
    // dem ersten Tod also weiterhin auf die Leiche zeigen statt auf den
    // naechsten frisch gepushten Geist -- per Gegenprobe am eigenen
    // Testaufbau gefunden.
    const g1 = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, g1);
    killGhost(st, g1); // cause='damage' -> death_damage
    const g2 = createGhost(st, 10, 10, 0, 't_pink');
    pushGhost(st, g2);
    killGhost(st, g2, 'expire');
    const g3 = createGhost(st, 20, 20, 0, 't_pink');
    pushGhost(st, g3);
    killGhost(st, g3, 'sacrifice');
    // fusion: necroUniqueThrone erzwingt bei ZWEI gleichzeitig lebenden
    // Untertanen eine sofortige Verschmelzung -- reicht als Ausloeser,
    // braucht keine Karte (fuseGhost() faellt ohne core-Werte auf feste
    // Vorgaben zurueck).
    st.player.cfg.necroUniqueThrone = true;
    const g4 = createGhost(st, 30, 30, 0, 't_pink');
    pushGhost(st, g4); // erster lebender Untertan -> normaler Pfad
    const g5 = createGhost(st, 500, 500, 0, 't_pink'); // baugleich -> Gleichstand, existing (g4) gewinnt
    pushGhost(st, g5); // loest die Verschmelzung aus

    check(hits.death_damage === 1, `Phase 11: der death_damage-Listener feuert nicht genau einmal (${hits.death_damage})`);
    check(hits.death_expire === 1, `Phase 11: der death_expire-Listener feuert nicht genau einmal (${hits.death_expire})`);
    check(hits.sacrifice === 1, `Phase 11: der sacrifice-Listener feuert nicht genau einmal (${hits.sacrifice})`);
    check(hits.fusion === 1, `Phase 11: der fusion-Listener feuert nicht genau einmal (${hits.fusion})`);
    // Kreuzpruefung: KEIN Listener feuert fuer einen fremden Grund (jeder
    // Zaehler steht bei genau 1, nicht mehr -- vier Ausloeser, vier Treffer
    // insgesamt waeren bei falscher Verdrahtung z. B. 4/0/0/0 oder aehnlich).
    const total = hits.death_damage + hits.death_expire + hits.sacrifice + hits.fusion;
    check(total === 4, `Phase 11: insgesamt ${total} statt 4 Listener-Treffer -- ein Listener feuert fuer einen fremden Grund`);
  }

  // (d) Punkte 12+14, an der ECHTEN Skalierungsformel: eine echte, NICHT
  // einzigartige Nekromant-Karte (ghost_001, core.ghostHpMult -- ein
  // MULTIPLIKATIVER core-Applier-Schluessel, Math.pow(mult, lvl) in cfg.js)
  // bei Stufe 1/10/100/1000 -- der cfg-Effekt muss WEITERHIN exponentiell
  // nach applyUpgrades()s Formel wachsen, keine Klemmung. Zusaetzlich: die
  // UI zeigt bei hoher Stufe kein "MAX"/"/Y" (upgradescreen.js zeigt bei
  // isUnique:false nur "(Stufe N)").
  {
    const id = 'ghost_001';
    const def = necroData.upgrades[id];
    check(def?.isUnique !== true, 'Phase 11: Testvoraussetzung -- ghost_001 sollte NICHT isUnique sein');
    check(typeof def?.core?.ghostHpMult === 'number', 'Phase 11: Testvoraussetzung -- ghost_001 hat kein core.ghostHpMult (mehr)');
    const mult = def.core.ghostHpMult;
    let prevValue = 1;
    for (const stufe of [1, 10, 100, 1000]) {
      const cfg = applyUpgrades(resolveCfg(tanksData, 'c_necro'), { [id]: stufe }, necroData, 'mine', null);
      const expected = Math.pow(mult, stufe);
      check(
        Math.abs((cfg.ghostHpMult || 1) - expected) < 1e-6 * expected,
        `Phase 11: ghost_001 bei Stufe ${stufe} skaliert nicht nach Math.pow(mult, Stufe) (${cfg.ghostHpMult} statt ${expected})`,
      );
      check(cfg.ghostHpMult > prevValue, `Phase 11: ghost_001s Effekt waechst bei Stufe ${stufe} nicht weiter (${prevValue} -> ${cfg.ghostHpMult}) -- Klemmung?`);
      prevValue = cfg.ghostHpMult;
    }
    // UI: kein Deckeltext bei hoher Stufe.
    const offerLike = { id, name: def.name, level: 1000, isUnique: false, rarity: def.rarity };
    const lvl = offerLike.isUnique ? '' : ` (Stufe ${offerLike.level})`;
    check(!/MAX|\/\d/.test(lvl), `Phase 11: UI-Text zeigt bei Stufe 1000 einen Deckelhinweis (${lvl})`);
  }

  // (e) Punkt 13, Rest: drawOne() (Choker fuer Shop/Verbannen/Vierte
  // Karte/Ereignis-Kartenoption -- run.js ruft ihn an genau diesen vier
  // Stellen auf) respektiert isUnique+selectedUniqueUpgradeIds; "nur
  // angezeigt und nicht gewaehlt bleibt verfuegbar" ueber einen ECHTEN
  // chooseUpgrade()-Aufruf, der die ANDERE Karte waehlt; "ein neuer Run
  // macht es wieder verfuegbar".
  {
    // rarity common/uncommon (kein rarityGates-Mindestraum), kein requires
    // (kein zweiter Gate-Grund), tag != 'elite' (kein includeTag noetig) --
    // sonst wuerde die spaetere Verfuegbarkeitspruefung aus einem ANDEREN
    // Grund als isUnique fehlschlagen und faelschlich diesen Mechanismus
    // treffen (per Gegenprobe am eigenen Testaufbau gefunden: die erste
    // Wahl fiel auf eine requires-Karte).
    const isSimple = (id) => {
      const d = necroData.upgrades[id];
      return !d.requires?.length && d.tag !== 'elite' && (d.rarity === 'common' || d.rarity === 'uncommon');
    };
    const uniqueId = necroIds.find((id) => necroData.upgrades[id].isUnique && isSimple(id));
    const otherId = necroIds.find((id) => !necroData.upgrades[id].isUnique && isSimple(id));
    check(!!uniqueId && !!otherId, 'Phase 11: Testvoraussetzung -- keine passenden Testkarten gefunden');

    // drawOne() (Choker fuer Shop/Verbannen/Vierte Karte/Ereignis) filtert
    // ueber DENSELBEN buildCandidates()-Aufruf wie rollOffers() -- direkt
    // gegen den Kandidatenpool geprueft statt gegen Zufallsstichproben (eine
    // seltene common-Karte unter ~40 gleich gewichteten waere in nur 100
    // Ziehungen nicht zuverlaessig getroffen worden, per Gegenprobe am
    // eigenen Testaufbau gefunden -- reines Ziehungspech haette einen echten
    // Fehler unbemerkt gelassen).
    const drawOneCandidates = buildCandidates(mergedUpgrades, {
      chosen: {}, roomIndex: 99, balance: tanksData.balance,
      starterTank: 'c_necro', selectedUniqueUpgradeIds: new Set([uniqueId]), banned: new Set(),
    });
    check(
      !drawOneCandidates.some((d) => d.id === uniqueId),
      'Phase 11: drawOne()/buildCandidates() liefert eine bereits gewaehlte einzigartige Karte (Shop/Verbannen/Vierte Karte/Ereignis waeren betroffen)',
    );
    // Zusaetzlich ein echter drawOne()-Aufruf, dass die Funktion selbst
    // (nicht nur buildCandidates direkt) denselben Filter anwendet.
    const drawn = drawOne(mergedUpgrades, {
      chosen: {}, roomIndex: 99, rng: mulberry32(1), balance: tanksData.balance,
      starterTank: 'c_necro', selectedUniqueUpgradeIds: new Set([uniqueId]),
    }, new Set(), new Set());
    check(drawn?.id !== uniqueId, 'Phase 11: drawOne() selbst liefert eine bereits gewaehlte einzigartige Karte');

    // Vorschau ohne Wahl: die Karte wird ANGEBOTEN, aber die ANDERE gewaehlt.
    const run = createRun(tanksData, tilesData, diffData, mergedUpgrades, 4242, 'normal', { starterTank: 'c_necro' });
    const offerFor = (id) => ({
      id, name: necroData.upgrades[id].name, description: necroData.upgrades[id].description,
      tag: necroData.upgrades[id].tag, tags: necroData.upgrades[id].tags || [],
      rarity: necroData.upgrades[id].rarity, level: (run.upgrades[id] || 0) + 1,
      isUnique: !!necroData.upgrades[id].isUnique,
    });
    run.phase = 'upgrade';
    run.pendingOffers = [offerFor(uniqueId), offerFor(otherId)];
    chooseUpgrade(run, 1); // waehlt otherId, NICHT die einzigartige
    check(!run.selectedUniqueUpgradeIds.has(uniqueId), 'Phase 11: eine nur ANGEBOTENE (nicht gewaehlte) einzigartige Karte wird trotzdem als gewaehlt eingetragen');
    check(
      buildCandidates(mergedUpgrades, {
        chosen: run.upgrades, roomIndex: run.roomIndex, balance: tanksData.balance,
        banned: run.bannedUpgrades, starterTank: run.starterTank, selectedUniqueUpgradeIds: run.selectedUniqueUpgradeIds,
      }).some((d) => d.id === uniqueId),
      'Phase 11: eine nur angebotene einzigartige Karte ist danach nicht mehr verfuegbar',
    );

    // Jetzt wirklich waehlen -> verschwindet. run.phase erneut setzen: der
    // erste chooseUpgrade()-Aufruf hat ihn ueber afterRoomDone() bereits
    // weitergezogen (chooseUpgrade() ist sonst ein No-op) -- per Gegenprobe
    // am eigenen Testaufbau gefunden.
    run.phase = 'upgrade';
    run.pendingOffers = [offerFor(uniqueId), offerFor(otherId)];
    chooseUpgrade(run, 0);
    check(run.selectedUniqueUpgradeIds.has(uniqueId), 'Phase 11: eine echt gewaehlte einzigartige Karte landet nicht in selectedUniqueUpgradeIds');
    check(
      !buildCandidates(mergedUpgrades, {
        chosen: run.upgrades, roomIndex: run.roomIndex, balance: tanksData.balance,
        banned: run.bannedUpgrades, starterTank: run.starterTank, selectedUniqueUpgradeIds: run.selectedUniqueUpgradeIds,
      }).some((d) => d.id === uniqueId),
      'Phase 11: eine gewaehlte einzigartige Karte bleibt weiter verfuegbar',
    );

    // Neuer Run: wieder verfuegbar.
    const run2 = createRun(tanksData, tilesData, diffData, mergedUpgrades, 4243, 'normal', { starterTank: 'c_necro' });
    check(!run2.selectedUniqueUpgradeIds.has(uniqueId), 'Phase 11: ein neuer Run erbt bereits gewaehlte einzigartige Karten des vorigen Runs');
    check(
      buildCandidates(mergedUpgrades, {
        chosen: run2.upgrades, roomIndex: run2.roomIndex, balance: tanksData.balance,
        banned: run2.bannedUpgrades, starterTank: run2.starterTank, selectedUniqueUpgradeIds: run2.selectedUniqueUpgradeIds,
      }).some((d) => d.id === uniqueId),
      'Phase 11: ein neuer Run macht eine einzigartige Karte nicht wieder verfuegbar',
    );
  }

  // (f) Punkt 17: applyFusionTransfer() (ghost.js) rechnet den Schadens-
  // zuwachs bei JEDER Verschmelzung IMMER von den BASISWERTEN DES
  // VERSCHMOLZENEN (loser.baseDamage) -- nicht vom bereits geboosteten
  // AKTUELLEN cfg.damage des Champions und auch NICHT vom Basiswert des
  // Champions selbst (der Champion hat eine eigene, vom Spieler abgeleitete
  // Basis -- ein gewoehnlicher, verschmolzener Untertan seine eigene,
  // vom geerbten Typ abgeleitete). Zwei Verschmelzungen nacheinander muessen
  // deshalb LINEAR wachsen (champ.baseDamage + 2*round(loserBaseDamage*
  // dmgFrac)), nicht KOMPONDIEREND -- genau das waere das im Code-Kommentar
  // benannte "exponentielle Aufschaukeln", das die Basiswert-Regel
  // verhindern soll.
  {
    const st = necroRoom({ ghost_071: 1 });
    const champ = createGhost(st, 0, 0, 0, 't_pink');
    pushGhost(st, champ);
    const champBaseDmg = champ.baseDamage;
    // Ein baugleicher, NIE verschmolzener Kontroll-Geist liefert die
    // Basiswert-Referenz der Verlierer -- die unterscheidet sich bewusst von
    // champBaseDmg (Champion-Basis = championStatPct * Spielerwerte,
    // gewoehnlicher Geist-Basis = baseStatPct * geerbter Typwert).
    const control = createGhost(st, 999, 999, 0, 't_pink');
    const loserBaseDmg = control.baseDamage;
    const dmgFrac = necroData.upgrades.ghost_071.core.necroFusionDamagePct; // aus den Daten, nicht hartkodiert
    // Champion-Nachschliff Abschnitt 5: ghost_071 selbst steigert die Rate um
    // +necroUniqueThronePerFusionPct JE BEREITS ERFOLGTER Verschmelzung
    // (winner.fusionCount VOR dem Zaehler-Erhoehen) -- die erste Verschmelzung
    // nutzt also die reine dmgFrac (fusionCount 0), die zweite bereits
    // dmgFrac + 1*perFusionBonus.
    const perFusionBonus = necroData.upgrades.ghost_071.core.necroUniqueThronePerFusionPct || 0;
    const gain1 = Math.round(loserBaseDmg * dmgFrac);
    const gain2 = Math.round(loserBaseDmg * (dmgFrac + perFusionBonus));
    // Testvoraussetzung: linear und kompondierend muessen sich klar
    // unterscheidbar auseinanderentwickeln, sonst waere die Probe stumpf.
    const linear2 = champBaseDmg + gain1 + gain2;
    const compounding2 = Math.round((champBaseDmg + gain1) * (1 + dmgFrac + perFusionBonus));
    check(linear2 !== compounding2, 'Phase 11: Testvoraussetzung -- linear/kompondierend ergeben denselben Wert, Probe stumpf');

    pushGhost(st, createGhost(st, 100, 100, 0, 't_pink')); // baugleich -> Gleichstand, champ (existing) gewinnt
    pushGhost(st, createGhost(st, 200, 200, 0, 't_pink')); // zweite Verschmelzung
    check(st.ghosts.length === 1 && st.ghosts[0] === champ, 'Phase 11: Testvoraussetzung -- zwei Verschmelzungen liefen nicht wie erwartet (champ haette beide absorbieren muessen; der nie gepushte Kontroll-Geist zaehlt nicht mit)');
    check(champ.fusionCount === 2, `Phase 11: Testvoraussetzung -- fusionCount nach zwei Verschmelzungen nicht 2 (${champ.fusionCount})`);
    check(
      champ.cfg.damage === linear2,
      `Phase 11: der Schadenszuwachs nach zwei Verschmelzungen ist nicht linear (${champ.cfg.damage} statt ${linear2}, Champion-Basiswert ${champBaseDmg}, Verlierer-Basiswert ${loserBaseDmg})`,
    );
    check(
      champ.cfg.damage !== compounding2,
      `Phase 11: der Schadenszuwachs rechnet vom bereits geboosteten AKTUELLEN Wert statt vom Basiswert (${champ.cfg.damage} entspricht dem kompondierenden Ergebnis)`,
    );
  }
}

// ---- 64. Kartenbelohnung/Shop-Ueberarbeitung ------------------------------
// Zwei EIGENSTAENDIGE, kontextabhaengige Seltenheitstabellen ersetzen die
// bisherige globale balance.rarity + balance.rarityGates-Kombination: normale
// Kartenbelohnungen (Kampf/Elite/Verflucht/Ereignis-Kartenoption) staffeln
// sich nach dem NEUEN runweiten Raumzaehler run.totalRoomIndex (faengt NIE
// pro Akt neu an, anders als das akt-lokale run.roomIndex), das Shop-Regal
// eigenstaendig nach der Anzahl bereits besuchter Shops run.shopsVisited.
// Dazu individuelle, nach Seltenheit gewuerfelte Shop-Kartenpreise statt des
// fruehereren einheitlichen scrap.cost.shopCard. weightedPick() selbst ist
// UNVERAENDERT (Tier-Normierung + automatische Umverteilung bei fehlender
// Stufe gelten unveraendert, s. Abschnitt (e)).
{
  const { rewardRarityWeights, shopRarityWeights, buildCandidates, rollOffers, weightedPick } =
    await import('../src/game/upgradepool.js');
  const balance = tanksData.balance;

  // (a) Struktur: beide Baender-Tabellen vollstaendig (5 Zeilen), jede Zeile
  //     summiert exakt auf 100, rarityGates/scrap.cost.shopCard sind
  //     ERSATZLOS weg, die fuenf Preisbaender ueberschneiden sich nicht und
  //     steigen streng von Stufe zu Stufe.
  {
    check(!('rarityGates' in balance), 'Abschnitt 64: balance.rarityGates existiert noch (haette entfernt werden sollen)');
    check(!('shopCard' in balance.scrap.cost), 'Abschnitt 64: balance.scrap.cost.shopCard existiert noch (haette entfernt werden sollen)');
    check(Array.isArray(balance.rewardRarityBands) && balance.rewardRarityBands.length === 5, 'Abschnitt 64: rewardRarityBands fehlt oder hat nicht 5 Zeilen');
    check(Array.isArray(balance.shopRarityBands) && balance.shopRarityBands.length === 5, 'Abschnitt 64: shopRarityBands fehlt oder hat nicht 5 Zeilen');
    for (const [label, bands] of [['reward', balance.rewardRarityBands], ['shop', balance.shopRarityBands]]) {
      for (const band of bands) {
        const sum = Object.values(band.rarity).reduce((a, b) => a + b, 0);
        check(Math.abs(sum - 100) < 1e-9, `Abschnitt 64: ${label}-Band (${band.maxRoom ?? band.maxVisit ?? 'letztes'}) summiert nicht auf 100 (${sum})`);
      }
    }
    const ranges = balance.shop.cardPriceRanges;
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    for (const r of order) {
      check(Array.isArray(ranges[r]) && ranges[r].length === 2 && ranges[r][0] <= ranges[r][1], `Abschnitt 64: Preisband ${r} ungueltig (${JSON.stringify(ranges[r])})`);
    }
    for (let i = 1; i < order.length; i++) {
      const [prevMin, prevMax] = ranges[order[i - 1]];
      const [min] = ranges[order[i]];
      check(min > prevMax, `Abschnitt 64: Preisband ${order[i]} beginnt nicht strikt ueber ${order[i - 1]} (${min} <= ${prevMax})`);
    }
  }

  // (b) rewardRarityWeights(): exakte Bandwahl an den vier vorgegebenen
  //     Grenzen (Test gegen die ECHTEN balance.json-Werte -- die Grenzen
  //     SIND die Spezifikation aus dem Auftrag, kein synthetischer Wert
  //     noetig) + Fallback ohne Baender auf die flache balance.rarity.
  {
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const bands = balance.rewardRarityBands;
    check(eq(rewardRarityWeights(balance, 1), bands[0].rarity), 'Abschnitt 64: Raum 1 nutzt nicht Band 1 (1-4)');
    check(eq(rewardRarityWeights(balance, 4), bands[0].rarity), 'Abschnitt 64: Raum 4 nutzt nicht Band 1 (1-4)');
    check(eq(rewardRarityWeights(balance, 5), bands[1].rarity), 'Abschnitt 64: Raum 5 wechselt nicht auf Band 2 (5-9)');
    check(eq(rewardRarityWeights(balance, 9), bands[1].rarity), 'Abschnitt 64: Raum 9 nutzt nicht Band 2 (5-9)');
    check(eq(rewardRarityWeights(balance, 10), bands[2].rarity), 'Abschnitt 64: Raum 10 wechselt nicht auf Band 3 (10-14)');
    check(eq(rewardRarityWeights(balance, 14), bands[2].rarity), 'Abschnitt 64: Raum 14 nutzt nicht Band 3 (10-14)');
    check(eq(rewardRarityWeights(balance, 15), bands[3].rarity), 'Abschnitt 64: Raum 15 wechselt nicht auf Band 4 (15-20)');
    check(eq(rewardRarityWeights(balance, 20), bands[3].rarity), 'Abschnitt 64: Raum 20 nutzt nicht Band 4 (15-20)');
    check(eq(rewardRarityWeights(balance, 21), bands[4].rarity), 'Abschnitt 64: Raum 21 wechselt nicht auf Band 5 (21+)');
    check(eq(rewardRarityWeights(balance, 500), bands[4].rarity), 'Abschnitt 64: Raum 500 verlaesst Band 5 wieder (sollte unbegrenzt gelten)');
    const flatBalance = { rarity: { common: 1 } };
    check(rewardRarityWeights(flatBalance, 1) === flatBalance.rarity, 'Abschnitt 64: rewardRarityWeights() faellt ohne Baender nicht auf balance.rarity zurueck');
    check(shopRarityWeights(flatBalance, 1) === flatBalance.rarity, 'Abschnitt 64: shopRarityWeights() faellt ohne Baender nicht auf balance.rarity zurueck');
  }

  // (c) shopRarityWeights(): exakte Bandwahl an den Shop-Besuchsgrenzen
  //     2/3, 4/5, 5/6, 6/7 -- der 7. Besuch und jeder weitere bleiben auf
  //     Band 5.
  {
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const bands = balance.shopRarityBands;
    check(eq(shopRarityWeights(balance, 1), bands[0].rarity), 'Abschnitt 64: 1. Shop nutzt nicht Band 1 (1-2)');
    check(eq(shopRarityWeights(balance, 2), bands[0].rarity), 'Abschnitt 64: 2. Shop nutzt nicht Band 1 (1-2)');
    check(eq(shopRarityWeights(balance, 3), bands[1].rarity), 'Abschnitt 64: 3. Shop wechselt nicht auf Band 2 (3-4)');
    check(eq(shopRarityWeights(balance, 4), bands[1].rarity), 'Abschnitt 64: 4. Shop nutzt nicht Band 2 (3-4)');
    check(eq(shopRarityWeights(balance, 5), bands[2].rarity), 'Abschnitt 64: 5. Shop wechselt nicht auf Band 3');
    check(eq(shopRarityWeights(balance, 6), bands[3].rarity), 'Abschnitt 64: 6. Shop wechselt nicht auf Band 4');
    check(eq(shopRarityWeights(balance, 7), bands[4].rarity), 'Abschnitt 64: 7. Shop wechselt nicht auf Band 5 (7+)');
    check(eq(shopRarityWeights(balance, 50), bands[4].rarity), 'Abschnitt 64: 50. Shop verlaesst Band 5 wieder (sollte unbegrenzt gelten)');
  }

  // (d) Legendary ist ab Raum 1 grundsaetzlich ZIEHBAR (nicht nur "wird
  //     irgendwann mal gewuerfelt"): ein deterministisch GESTELLTER rng()-
  //     Wert (statt einer statistischen Stichprobe, die bei 0,1 % Chance
  //     unzuverlaessig waere) waehlt gezielt in die legendaere Restscheibe
  //     der Verteilung.
  {
    const fakeData = {
      offersPerScreen: 1,
      upgrades: {
        common_card: { id: 'common_card', name: 'x', description: 'x', tag: 't1', rarity: 'common', isUnique: false, requires: [], minRoom: 1 },
        legendary_card: { id: 'legendary_card', name: 'x', description: 'x', tag: 't2', rarity: 'legendary', isUnique: false, requires: [], minRoom: 1 },
      },
    };
    const weights = rewardRarityWeights(balance, 1); // Raum 1: legendary = 0,1 %
    const offers = rollOffers(fakeData, { chosen: {}, roomIndex: 1, rng: () => 0.9999, balance, count: 1, banned: new Set(), rarityWeights: weights });
    check(offers[0]?.id === 'legendary_card', `Abschnitt 64: legendary ist in Raum 1 nicht erreichbar (rollOffers lieferte ${offers[0]?.id})`);
    const commonOffers = rollOffers(fakeData, { chosen: {}, roomIndex: 1, rng: () => 0.0001, balance, count: 1, banned: new Set(), rarityWeights: weights });
    check(commonOffers[0]?.id === 'common_card', 'Abschnitt 64: Testvoraussetzung -- rng() nahe 0 liefert nicht die common-Karte');
  }

  // (e) Umverteilung bei fehlender Stufe bleibt erhalten (weightedPick()
  //     selbst ist UNVERAENDERT) -- ein Pool OHNE legendary-Karte verteilt
  //     deren Anteil automatisch proportional auf die vorhandenen Stufen um.
  //     Deterministisch ueber eine gleichmaessig verteilte rng()-Sequenz
  //     statt Math.random(), damit das Ergebnis exakt statt statistisch ist.
  {
    const list = [{ id: 'a', rarity: 'common' }, { id: 'b', rarity: 'uncommon' }];
    const weights = rewardRarityWeights(balance, 1); // common 80.4, uncommon 16, rare 3, epic 0.5, legendary 0.1
    let commonPicks = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const r = (i + 0.5) / N;
      if (weightedPick(list, () => r, weights).id === 'a') commonPicks++;
    }
    const expected = weights.common / (weights.common + weights.uncommon);
    const rate = commonPicks / N;
    check(Math.abs(rate - expected) < 0.01, `Abschnitt 64: Umverteilung bei fehlender Stufe stimmt nicht (${rate.toFixed(4)} statt ${expected.toFixed(4)})`);
  }

  // (f) run.totalRoomIndex/run.shopsVisited END-TO-END ueber einen echten
  //     Playthrough (eigener Seed, unabhaengig von den 5 Seeds oben): der
  //     runweite Raumzaehler startet bei 1, waechst bei JEDEM echten
  //     Raumwechsel um genau 1 und NIE zurueck -- auch nicht beim
  //     Akt-Uebergang (das akt-lokale run.roomIndex faengt dort neu bei 1
  //     an). Der Shop-Besuchszaehler waechst NUR beim echten Betreten eines
  //     NEUEN Shop-Raums; Kaufaktionen/erneutes Lesen innerhalb DESSELBEN
  //     Besuchs duerfen weder ihn noch die schon gewuerfelten Preise
  //     veraendern.
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 555, 'normal', { starterTank: 'player' });
    check(run.totalRoomIndex === 1, `Abschnitt 64: totalRoomIndex startet nicht bei 1 (${run.totalRoomIndex})`);
    check(run.shopsVisited === 0, `Abschnitt 64: shopsVisited startet nicht bei 0 (${run.shopsVisited})`);

    let guard = 200000;
    // Roomkey statt nur actIndex: ein WITHIN-Akt-Wechsel (Kampf -> naechster
    // Kampf, Kampf -> Shop, ...) muss GENAUSO +1 zaehlen wie ein
    // Akt-Uebergang -- eine erste Fassung dieses Tests pruefte nur "totalRoomIndex
    // springt beim Akt-Uebergang um genau 1", was ein FEHLENDER Zaehler an der
    // eigentlichen Stelle (advanceToMapNode()) NICHT gefangen haette (advanceAct()
    // erhoeht selbst schon um 1, das allein haette die alte Pruefung erfuellt) --
    // per Gegenprobe am eigenen Testaufbau gefunden, jetzt behoben: JEDE
    // Iteration, die den Raum wirklich wechselt (Akt- ODER Kartennavigation),
    // muss totalRoomIndex um EXAKT 1 erhoehen; jede andere Iteration darf es
    // GAR NICHT veraendern.
    let prevTotal = run.totalRoomIndex;
    let prevRoomKey = `${run.actIndex}:${run.roomIndex}`;
    let brokenMonotonic = false;
    let brokenPerRoomIncrement = false;
    let sawActTransition = false;
    let shopVisitCount = 0;
    let firstShopChecked = false;

    while (run.phase !== 'victory' && run.phase !== 'gameover' && guard-- > 0) {
      if (run.phase === 'preview') enterRoom(run);
      else if (run.phase === 'transition') stepRun(run, CMD, STEP);
      else if (run.phase === 'playing') { cheatKillAll(run.state); stepRun(run, CMD, STEP); }
      else if (run.phase === 'upgrade') chooseUpgrade(run, 0);
      else if (run.phase === 'map') pickMapNode(run);
      else if (run.phase === 'workshop') {
        // run.phase === 'workshop' gilt genau EINE Iteration lang (dieser
        // Zweig ruft leaveWorkshop() selbst, direkt am Ende) -- jeder
        // Eintritt hier IST ein echter neuer Besuch.
        shopVisitCount++;
        check(run.shopsVisited === shopVisitCount, `Abschnitt 64: shopsVisited (${run.shopsVisited}) stimmt nicht mit der Anzahl echter Shop-Eintritte (${shopVisitCount}) ueberein`);
        if (!firstShopChecked && run.shopOffers?.length) {
          firstShopChecked = true;
          const ranges = balance.shop.cardPriceRanges;
          const pricesBefore = run.shopOffers.map((o) => o.price);
          for (const o of run.shopOffers) {
            const [min, max] = ranges[o.rarity] || [];
            check(min !== undefined && o.price >= min && o.price <= max, `Abschnitt 64: Preis ${o.price} der ${o.rarity}-Karte ${o.id} liegt ausserhalb ${min}-${max}`);
          }
          // Eine ANDERE Shop-Aktion (Schildladung) darf die Kartenpreise
          // nicht veraendern.
          const scrapBefore = run.scrap;
          run.scrap = 9999;
          buyShieldCharge(run);
          check(run.shopOffers.map((o) => o.price).every((p, i) => p === pricesBefore[i]), 'Abschnitt 64: Preise aendern sich nach einer ANDEREN Shop-Aktion');
          // Affordability + exakter Abzug + Verkauft-Sperre.
          const target = run.shopOffers.find((o) => !o.sold);
          if (target) {
            const idx = run.shopOffers.indexOf(target);
            run.scrap = target.price - 1;
            check(!buyShopCard(run, idx), 'Abschnitt 64: Karte wird trotz zu wenig Schrott gekauft');
            check(run.scrap === target.price - 1, 'Abschnitt 64: Schrott wird bei einem abgelehnten Kauf trotzdem abgezogen');
            run.scrap = target.price;
            check(buyShopCard(run, idx), 'Abschnitt 64: Karte wird bei exakt ausreichend Schrott nicht gekauft');
            check(run.scrap === 0, `Abschnitt 64: Kauf zieht nicht exakt den angezeigten Preis ab (Rest ${run.scrap})`);
            check(target.sold === true, 'Abschnitt 64: gekaufte Karte ist nicht als verkauft markiert');
            run.scrap = 9999;
            check(!buyShopCard(run, idx), 'Abschnitt 64: eine bereits verkaufte Karte laesst sich erneut kaufen');
          }
          run.scrap = scrapBefore;
        }
        leaveWorkshop(run);
      } else if (run.phase === 'event') chooseEventOption(run, 0);
      else if (run.phase === 'rest') passRest(run);
      else if (run.phase === 'bossReward') passBossReward(run);
      else if (run.phase === 'actComplete') { sawActTransition = true; advanceAct(run); }
      else break;

      if (run.totalRoomIndex < prevTotal) brokenMonotonic = true;
      const roomKey = `${run.actIndex}:${run.roomIndex}`;
      if (roomKey !== prevRoomKey) {
        if (run.totalRoomIndex !== prevTotal + 1) brokenPerRoomIncrement = true;
      } else if (run.totalRoomIndex !== prevTotal) {
        brokenPerRoomIncrement = true;
      }
      prevRoomKey = roomKey;
      prevTotal = run.totalRoomIndex;
    }
    check(guard > 0, 'Abschnitt 64: Playthrough-Haenger (Iterationslimit erreicht)');
    check(run.phase === 'victory', `Abschnitt 64: kein Sieg im Playthrough (${run.phase})`);
    check(sawActTransition, 'Abschnitt 64: Testvoraussetzung -- kein Akt-Uebergang im Playthrough beobachtet');
    check(!brokenMonotonic, 'Abschnitt 64: totalRoomIndex ist nicht monoton gewachsen');
    check(!brokenPerRoomIncrement, 'Abschnitt 64: totalRoomIndex waechst nicht bei JEDEM echten Raumwechsel um genau 1 (bzw. veraendert sich bei einem Nicht-Wechsel)');
    check(shopVisitCount > 0, 'Abschnitt 64: Testvoraussetzung -- kein Shop im Playthrough besucht');
    check(run.shopsVisited === shopVisitCount, `Abschnitt 64: shopsVisited am Run-Ende (${run.shopsVisited}) stimmt nicht mit den gezaehlten echten Besuchen (${shopVisitCount}) ueberein`);
  }

  // (g) Speichern/Laden (Resume): totalRoomIndex, shopsVisited UND die
  //     bereits gewuerfelten Kartenpreise ueberleben unveraendert -- ein
  //     Resume baut den Raum ueber denselben (Seed, Akt, Raumnummer)-
  //     abgeleiteten RNG-Strom neu auf (das Regal steht seit Phase 13
  //     bewusst NICHT im Snapshot), reproduziert dadurch automatisch
  //     dieselben Angebote UND Preise -- derselbe Beweis wie "gleicher Seed +
  //     gleiche Spielfolge liefert identische Shop-Angebote/-Preise".
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 777, 'normal', { starterTank: 'player' });
    let guard = 200000;
    while (run.phase !== 'workshop' && run.phase !== 'victory' && run.phase !== 'gameover' && guard-- > 0) {
      if (run.phase === 'preview') enterRoom(run);
      else if (run.phase === 'transition') stepRun(run, CMD, STEP);
      else if (run.phase === 'playing') { cheatKillAll(run.state); stepRun(run, CMD, STEP); }
      else if (run.phase === 'upgrade') chooseUpgrade(run, 0);
      else if (run.phase === 'map') pickMapNode(run);
      else if (run.phase === 'event') chooseEventOption(run, 0);
      else if (run.phase === 'rest') passRest(run);
      else if (run.phase === 'bossReward') passBossReward(run);
      else if (run.phase === 'actComplete') advanceAct(run);
      else break;
    }
    check(run.phase === 'workshop', 'Abschnitt 64: Testvoraussetzung -- kein Shop im Resume-Testlauf erreicht');
    if (run.phase === 'workshop') {
      const before = {
        totalRoomIndex: run.totalRoomIndex,
        shopsVisited: run.shopsVisited,
        offers: run.shopOffers.map((o) => ({ id: o.id, price: o.price, rarity: o.rarity })),
      };
      const snap = runSnapshot(run);
      const resumed = createRun(tanksData, tilesData, diffData, upgradesData, run.seed, 'normal', { resume: snap });
      check(resumed.totalRoomIndex === before.totalRoomIndex, `Abschnitt 64: totalRoomIndex ueberlebt Resume nicht (${before.totalRoomIndex} -> ${resumed.totalRoomIndex})`);
      check(resumed.shopsVisited === before.shopsVisited, `Abschnitt 64: shopsVisited ueberlebt Resume nicht (${before.shopsVisited} -> ${resumed.shopsVisited})`);
      check(resumed.phase === 'workshop', 'Abschnitt 64: Resume baut den Shop-Raum nicht wieder auf');
      const after = (resumed.shopOffers || []).map((o) => ({ id: o.id, price: o.price, rarity: o.rarity }));
      check(JSON.stringify(after) === JSON.stringify(before.offers), 'Abschnitt 64: Resume reproduziert nicht dieselben Kartenangebote/Preise');
    }
  }

  // (h) Eine ueber den SHOP gekaufte einzigartige Karte verschwindet genauso
  //     aus allen Kartenquellen wie eine im normalen Angebot gewaehlte
  //     (Nekromant-V2 Phase 1, "gilt fuer beide Auftraege") -- buyShopCard()
  //     haengt seit dieser Ueberarbeitung an einer neuen Preislogik,
  //     applyUpgradeChoice() selbst ist unveraendert, aber der Weg dorthin
  //     ist neu genug, um es direkt zu pruefen statt es nur anzunehmen.
  {
    const syntheticId = 'test_shop_unique_card';
    const syntheticUpgrades = {
      ...upgradesData,
      upgrades: {
        ...upgradesData.upgrades,
        [syntheticId]: {
          id: syntheticId, name: 'Testkarte', description: 'x', tag: 'test_shop_unique',
          rarity: 'common', isUnique: true, requires: [], minRoom: 1, core: {},
        },
      },
    };
    const run = createRun(tanksData, tilesData, diffData, syntheticUpgrades, 4242, 'normal', { starterTank: 'player' });
    run.phase = 'workshop';
    run.shopOffers = [{
      id: syntheticId, name: 'Testkarte', description: 'x', tag: 'test_shop_unique', tags: [],
      rarity: 'common', level: 1, isUnique: true, price: 3,
    }];
    run.scrap = 3;
    check(buyShopCard(run, 0), 'Abschnitt 64: Kauf einer einzigartigen Shop-Karte schlaegt fehl');
    check(run.selectedUniqueUpgradeIds.has(syntheticId), 'Abschnitt 64: eine ueber den Shop gekaufte einzigartige Karte landet nicht in selectedUniqueUpgradeIds');
    check(
      !buildCandidates(syntheticUpgrades, {
        chosen: run.upgrades, roomIndex: run.roomIndex, balance: tanksData.balance,
        banned: run.bannedUpgrades, starterTank: run.starterTank, selectedUniqueUpgradeIds: run.selectedUniqueUpgradeIds,
      }).some((d) => d.id === syntheticId),
      'Abschnitt 64: eine ueber den Shop gekaufte einzigartige Karte bleibt in anderen Pools verfuegbar',
    );
  }
}

// ---- 65. Champion-/Nekromant-Nachschliff (Auftrag mit 24 Abschnitten) ----
// Deckt die Kernpunkte ab: Rastplatz-Neubau (2), Champion-Basiswerte/-
// Lebensdauer/-Nachfolge (3), Verschmelzung 100 %-Baseline (4/5/6/22), die
// fuenf Wiederbelebungs-/fuenf Lebensdauer-Karten (7/8), Losgeloeste Ketten
// (9), zehn ueberarbeitete Karten (10), Gadget-Sperre vs. automatische
// Wiederbelebung (11), Elite-Wiederbelebung (12), Glossar (13), Pinker/
// Gruener (14/15), Elite-/Boss-Belohnung (16/17). Jeder Kernpunkt einzeln
// per Gegenprobe am echten Quellcode bestaetigt (temporaer gebrochen,
// erwartete Checks rot, danach zurueckgesetzt) -- Details in CLAUDE.md.
{
  const { createGhost, pushGhost, killGhost, ensureChampion, fuseGhost, occupiedGhostSlots } = await import('../src/game/ghost.js');
  const { createState } = await import('../src/game/state.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');
  const { resolveCfg: resolveCfg2, applyUpgrades: applyUpgrades2 } = await import('../src/game/cfg.js');
  const { createRun, chooseUpgrade, rollBossReward, chooseBossReward, repairAtRest: repairAtRest2, workbenchOptions: workbenchOptions2, upgradeCardAtRest: upgradeCardAtRest2 } = await import('../src/game/run.js');
  const { buildCandidates, rollOffers, drawOne, eliteRarityWeights } = await import('../src/game/upgradepool.js');
  const { initGlossary, highlightTerms } = await import('../src/ui/glossary.js');
  const glossaryData = load('glossary');
  const mergedUpgrades = { ...upgradesData, upgrades: { ...upgradesData.upgrades, ...necroData.upgrades } };

  const necroRoom = (playerUpgrades = {}, types = ['t_pink']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades,
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
      actEnemyPool: types,
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    return st;
  };

  // ---- (a) Rastplatz/Werkbank: neu gewaehlte Karte statt Stufe -----------
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 555, 'normal', { starterTank: 'player' });
    run.upgrades.sockel_panzerung = 1;
    run.phase = 'rest';
    const before = run.upgrades.sockel_panzerung;
    const opts = workbenchOptions2(run);
    check(opts.some((o) => o.id === 'sockel_panzerung'), 'Abschnitt 65a: eine besessene wiederholbare Karte fehlt in der Werkbank-Liste');
    check(upgradeCardAtRest2(run, 'sockel_panzerung'), 'Abschnitt 65a: erneutes Waehlen am Rastplatz schlaegt fehl');
    check(run.upgrades.sockel_panzerung === before + 1, `Abschnitt 65a: Stapelzahl steigt nicht (${before} -> ${run.upgrades.sockel_panzerung})`);
    check(run.phase !== 'rest', 'Abschnitt 65a: der Raum endet nicht nach der Werkbank-Wahl');
    check(run.upgradeLevels.sockel_panzerung == null || run.upgradeLevels.sockel_panzerung === 0, 'Abschnitt 65a: das alte Stufen-Feld wird noch beschrieben');
    // Einzigartige Karte darf nie in der Liste stehen, egal wie oft besessen.
    const run2 = createRun(tanksData, tilesData, diffData, upgradesData, 555, 'normal', { starterTank: 'player' });
    run2.upgrades.sockel_ersatzpanzer = 3; // upgradable:false, trotzdem nicht der Testfall hier
    run2.upgradesData.upgrades.test_unique_65 = { id: 'test_unique_65', name: 'Test', description: 'x', tag: 'x', rarity: 'common', isUnique: true, requires: [], core: {} };
    run2.upgrades.test_unique_65 = 1;
    run2.phase = 'rest';
    check(!workbenchOptions2(run2).some((o) => o.id === 'test_unique_65'), 'Abschnitt 65a: eine einzigartige Karte erscheint in der Werkbank-Liste');
    check(!upgradeCardAtRest2(run2, 'test_unique_65'), 'Abschnitt 65a: eine einzigartige Karte laesst sich am Rastplatz erneut waehlen');
  }
  // Gegenprobe (a): repickOwnedCard() ohne isUnique-Sperre wuerde die zweite
  // Pruefung rot machen -- am Quellcode verifiziert (temporaer `!def.isUnique`
  // entfernt, Check schlug fehl, zurueckgesetzt).

  // ---- (b) Champion: 70/70, kein Geisterlimit, sofortige Nachfolge -------
  {
    const st = necroRoom();
    st.player.cfg.maxHp = 100;
    st.player.cfg.damage = 20;
    const g1 = createGhost(st, 100, 100, 0, 't_pink');
    pushGhost(st, g1); // wird sofort Champion (erster Spawn)
    check(g1.isChampion, 'Abschnitt 65b: erster Untertan wird nicht automatisch Champion');
    check(g1.cfg.maxHp === 70, `Abschnitt 65b: Champion-LP ${g1.cfg.maxHp} statt 70 (70 % von 100)`);
    check(g1.cfg.damage === 14, `Abschnitt 65b: Champion-Schaden ${g1.cfg.damage} statt 14 (70 % von 20)`);
    const cap = st.data.balance.ghost.maxActive ?? 3;
    for (let i = 0; i < cap; i++) pushGhost(st, createGhost(st, 100, 100, 0, 't_pink'));
    check(occupiedGhostSlots(st) === cap, `Abschnitt 65b: Champion zaehlt gegen das Geisterlimit (belegt ${occupiedGhostSlots(st)} statt ${cap})`);
    check(st.ghosts.filter((g) => g.alive).length === cap + 1, 'Abschnitt 65b: Champion + Deckel ergeben nicht cap+1 lebende Geister');
  }
  // Gegenprobe (b): slotCost am Champion faelschlich auf 1 statt 0 (durch
  // Entfernen des isChampion-Ausschlusses in occupiedGhostSlots) -- am
  // Quellcode verifiziert, Check schlug fehl, zurueckgesetzt.

  // ---- (c) Champion-Lebensdauer: begrenzt, Ewiger Thron unendlich --------
  {
    const st = necroRoom({}, ['t_pink']);
    const g = createGhost(st, 100, 100, 0, 't_pink');
    pushGhost(st, g);
    const base = st.data.balance.ghost.lifetimeS ?? 12;
    check(g.isChampion && Number.isFinite(g.lifetimeMax) && g.lifetimeMax === base, `Abschnitt 65c: Champion-Basislebenszeit ${g.lifetimeMax} statt ${base}`);
    // Ewiger Thron (necroCrownEternalLifetime) macht die Champion-Lebenszeit
    // unendlich -- am nachfolgenden, NEU befoerderten Champion geprueft
    // (promoteToChampion() wird jedesmal frisch aufgerufen).
    const st2 = necroRoom({ ghost_083: 1 }, ['t_pink']);
    const g2 = createGhost(st2, 100, 100, 0, 't_pink');
    pushGhost(st2, g2);
    check(g2.lifetimeMax === Infinity, `Abschnitt 65c: Ewiger Thron macht die Champion-Lebenszeit nicht unendlich (${g2.lifetimeMax})`);
    // Ablauf toetet auch einen gewoehnlich befristeten Champion.
    const st3 = necroRoom({}, ['t_pink']);
    const g3 = createGhost(st3, 100, 100, 0, 't_pink');
    pushGhost(st3, g3);
    g3.lifetime = 0.001;
    ensureChampion(st3); // No-op, Champion existiert schon
    st3.ghosts.forEach((x) => {
      if (x.alive && x.lifetime <= 0.01) killGhost(st3, x, 'expire');
    });
    check(!g3.alive, 'Abschnitt 65c: eine abgelaufene Champion-Lebenszeit toetet den Champion nicht');
  }
  // Gegenprobe (c): g.lifetime = Infinity fest in promoteToChampion() belassen
  // (alte Fassung) -- Check auf lifetimeMax === base schlaegt fehl, am
  // Quellcode verifiziert und zurueckgesetzt.

  // ---- (d) Sofortige Nachfolge + Kronenerbe ohne Zeitfenster --------------
  {
    const st = necroRoom({ ghost_080: 1 }, ['t_pink']); // Kronenerbe
    const champ = createGhost(st, 100, 100, 0, 't_pink');
    pushGhost(st, champ);
    const other = createGhost(st, 120, 100, 0, 't_pink');
    pushGhost(st, other);
    // Champion erhaelt kuenstlich einen Fusionsbonus, damit etwas zu erben ist.
    champ.baseDamage = 20;
    champ.fusionDamageBonus = 10;
    champ.cfg.damage = champ.baseDamage + champ.fusionDamageBonus;
    killGhost(st, champ); // toedlicher Treffer
    check(!champ.alive, 'Abschnitt 65d: der alte Champion lebt nach killGhost() noch');
    const successor = st.ghosts.find((g) => g.alive && g.isChampion);
    check(!!successor, 'Abschnitt 65d: nach dem Champion-Tod wird SOFORT kein neuer Champion befoerdert');
    check(successor === other, 'Abschnitt 65d: der einzige verbleibende gewoehnliche Geist wird nicht Nachfolger');
    // Kronenerbe: 60 % von 10 = 6, ohne jedes Zeitfenster (keine Wartezeit
    // zwischen Tod und Befoerderung noetig -- beides passiert synchron).
    check(successor.fusionDamageBonus === 6, `Abschnitt 65d: Kronenerbe uebertraegt ${successor.fusionDamageBonus} statt 6`);
    check(successor.cfg.damage === successor.baseDamage + 6, 'Abschnitt 65d: der geerbte Bonus wirkt nicht auf cfg.damage');
  }
  // Gegenprobe (d): Kronenerbe-Konsum in promoteToChampion() auskommentiert
  // -- successor.fusionDamageBonus bleibt 0 statt 6, Check schlaegt fehl; am
  // Quellcode verifiziert und zurueckgesetzt. Ohne Kronenerbe-Karte (kein
  // necroCrownHeirPct) bleibt der Bonus ebenfalls 0 (separat verifiziert).

  // ---- (e) Verschmelzung: 100 % Basis + Einziger Thron/Schwert/Schild/Bogen
  {
    // Reine 100%-Baseline ohne jede Karte, per Auslese der Legion (Karte)
    // ausgeloest -- greift auch OHNE Einziger Thron.
    const st = necroRoom({ ghost_098: 1 }, ['t_pink']); // Auslese der Legion
    const champ = createGhost(st, 100, 100, 0, 't_pink');
    pushGhost(st, champ);
    const cap = (st.data.balance.ghost.maxActive ?? 3);
    for (let i = 0; i < cap; i++) pushGhost(st, createGhost(st, 100, 100, 0, 't_pink'));
    const weakest = st.ghosts.filter((g) => g.alive && !g.isChampion).reduce((a, b) => (a.hp < b.hp ? a : b));
    const loserBaseDmg = weakest.baseDamage;
    const championBaseDmg = champ.baseDamage;
    pushGhost(st, createGhost(st, 100, 100, 0, 't_pink')); // loest die Verdraengungs-Fusion aus
    check(champ.cfg.damage === championBaseDmg + Math.round(loserBaseDmg * 1.0), `Abschnitt 65e: Auslese der Legion ueberträgt nicht 100 % Basis-Schaden (${champ.cfg.damage} vs. erwartet ${championBaseDmg + loserBaseDmg})`);

    // Einziger Thron: +5 %/Verschmelzung, ohne Obergrenze.
    const st2 = necroRoom({ ghost_071: 1 }, ['t_pink']);
    const champ2 = createGhost(st2, 100, 100, 0, 't_pink');
    pushGhost(st2, champ2); // erster Spawn wird selbst Champion, noch keine Fusion
    const loser1 = createGhost(st2, 100, 100, 0, 't_pink');
    const loser1BaseDmg = loser1.baseDamage;
    pushGhost(st2, loser1); // 1. Verschmelzung: 100 % (fusionCount war 0)
    const afterFirst = champ2.fusionDamageBonus;
    check(afterFirst === Math.round(loser1BaseDmg * 1.0), `Abschnitt 65e: 1. Verschmelzung mit Einziger Thron ueberträgt nicht 100 % (${afterFirst} vs. ${loser1BaseDmg})`);
    const loser2 = createGhost(st2, 100, 100, 0, 't_pink');
    const loser2BaseDmg = loser2.baseDamage;
    pushGhost(st2, loser2); // 2. Verschmelzung: 105 % (1 vorherige Fusion)
    const gained2 = champ2.fusionDamageBonus - afterFirst;
    check(gained2 === Math.round(loser2BaseDmg * 1.05), `Abschnitt 65e: 2. Verschmelzung ueberträgt nicht 105 % (${gained2} vs. ${Math.round(loser2BaseDmg * 1.05)})`);

    // Einziges Schwert (+15pp Schaden) stapelt additiv auf die 100 % Baseline.
    const st3 = necroRoom({ ghost_071: 1, ghost_106: 1 }, ['t_pink']);
    const champ3 = createGhost(st3, 100, 100, 0, 't_pink');
    pushGhost(st3, champ3);
    const loser3 = createGhost(st3, 100, 100, 0, 't_pink');
    const loser3BaseDmg = loser3.baseDamage;
    pushGhost(st3, loser3);
    check(champ3.fusionDamageBonus === Math.round(loser3BaseDmg * 1.15), `Abschnitt 65e: Einziges Schwert ergibt nicht 115 % Schadensuebertragung (${champ3.fusionDamageBonus} vs. ${Math.round(loser3BaseDmg * 1.15)})`);
  }
  // Gegenprobe (e): fuseGhost()s Fallback ?? 1.0 auf ?? 0.3 zurueckgesetzt --
  // Auslese-der-Legion-Check faellt sofort auf den alten, viel kleineren
  // Wert; am Quellcode verifiziert und zurueckgesetzt. necroUniqueThronePerFusionPct
  // aus dem cfg-Applier entfernt -> der 105-%-Check schlaegt fehl (verifiziert).

  // ---- (f) Blutiger Thron: Verschmelzung zaehlt VOLL --------------------
  {
    const st = necroRoom({ ghost_071: 1, ghost_011: 1, ghost_092: 1 }, ['t_pink']); // Seelenzorn + Blutiger Thron
    const champ = createGhost(st, 100, 100, 0, 't_pink');
    pushGhost(st, champ);
    const before = (st.necroStacks._pctDamage || 0);
    pushGhost(st, createGhost(st, 100, 100, 0, 't_pink')); // Verschmelzung
    const after = st.necroStacks._pctDamage || 0;
    check(after - before === 0.05, `Abschnitt 65f: Blutiger Thron zaehlt eine Verschmelzung nicht mehr als vollen Geistertod (+${after - before} statt +0.05)`);
  }
  // Gegenprobe (f): der Multiplikator in necro.js von 1 zurueck auf 0.5
  // gesetzt -- Delta faellt auf 0.025 statt 0.05, Check schlaegt fehl; am
  // Quellcode verifiziert und zurueckgesetzt.

  // ---- (g) Seelenheilung: genau einmal pro Verschmelzung ------------------
  {
    const st = necroRoom({ ghost_071: 1, ghost_065: 1 }, ['t_pink']);
    const champ = createGhost(st, 100, 100, 0, 't_pink');
    pushGhost(st, champ);
    champ.hp = Math.max(1, champ.cfg.maxHp - 20);
    const hpBefore = champ.hp;
    pushGhost(st, createGhost(st, 100, 100, 0, 't_pink'));
    check(champ.hp > hpBefore, 'Abschnitt 65g: Seelenheilung heilt den Champion bei einer Verschmelzung nicht');
    check(champ.hp <= champ.cfg.maxHp, 'Abschnitt 65g: Seelenheilung heilt ueber das maximale Leben hinaus');
  }

  // ---- (h) Gadget-Sperre blockiert nur den aktiven Slot, nicht die
  //      automatische Wiederbelebung -----------------------------------
  {
    const { useGadget, useSecondary } = await import('../src/game/tank.js');
    const st = necroRoom({}, ['t_pink']);
    st.player.cfg.secondaryDisabled = true;
    check(useSecondary(st.player, st) === false, 'Abschnitt 65h: die Geisterbombe (aktive Erzeugung) ignoriert die Ausruestungssperre');
    check(useGadget(st.player, st) === false, 'Abschnitt 65h: das Gadget ignoriert die Ausruestungssperre');
    // Automatische Wiederbelebung laeuft ueber killTank(), kennt secondaryDisabled
    // strukturell gar nicht -- Struktur-Nachweis statt Simulation.
    const src = readFileSync(join(root, 'src', 'game', 'state.js'), 'utf8');
    const reviveBlock = src.slice(src.indexOf('const necroKill ='), src.indexOf('const necroKill =') + 4000);
    check(!reviveBlock.includes('secondaryDisabled'), 'Abschnitt 65h: der automatische Wiederbelebungswuerfel prueft faelschlich secondaryDisabled');
  }

  // ---- (i) Elite-Wiederbelebung generell moeglich, Karte hebt auf 90 % --
  {
    const src = readFileSync(join(root, 'src', 'game', 'state.js'), 'utf8');
    const canReviveLine = src.match(/const canRevive = [^;]+;/)?.[0] || '';
    check(!canReviveLine.includes('isElite'), `Abschnitt 65i: canRevive schliesst Eliten weiterhin ohne Karte aus (${canReviveLine})`);
    check(necroData.upgrades.ghost_056.core.necroEliteReviveStatPct === 0.9, 'Abschnitt 65i: Elite-Reaktivierung liefert nicht 90 % Basiswert-Anteil');
  }
  // Gegenprobe (i): `(!isElite || pc.necroEliteRevive)` probeweise wieder
  // eingefuegt -- der erste Check schlaegt fehl (Zeile enthaelt wieder
  // "isElite"); am Quellcode verifiziert und zurueckgesetzt.

  // ---- (j) Fuenf Wiederbelebungs- und fuenf Lebensdauer-Karten -----------
  {
    const revive = [
      ['ghost_044', 'common', 0.07],
      ['ghost_109', 'uncommon', 0.10],
      ['ghost_055', 'rare', 0.12],
      ['ghost_110', 'epic', 0.18],
      ['ghost_111', 'legendary', 0.25],
    ];
    for (const [id, rarity, pct] of revive) {
      const d = necroData.upgrades[id];
      check(!!d, `Abschnitt 65j: ${id} fehlt im Pool`);
      check(d.rarity === rarity, `Abschnitt 65j: ${id} hat Seltenheit ${d.rarity} statt ${rarity}`);
      check(Math.abs(d.core.necroReviveChanceAdd - pct) < 1e-9, `Abschnitt 65j: ${id} liefert ${d.core.necroReviveChanceAdd} statt ${pct}`);
      check(d.isUnique === false, `Abschnitt 65j: ${id} ist einzigartig statt wiederholbar`);
    }
    const lifetime = [
      ['ghost_005', 'common', 'ghostLifetimeAdd', 0.5],
      ['ghost_112', 'uncommon', 'necroCrownLifetimeAdd', 1.0],
      ['ghost_113', 'rare', 'necroCrownLifetimeAdd', 1.5],
      ['ghost_114', 'epic', 'necroCrownLifetimeAdd', 2.0],
      ['ghost_115', 'legendary', 'necroCrownLifetimeAdd', 3.0],
    ];
    for (const [id, rarity, field, val] of lifetime) {
      const d = necroData.upgrades[id];
      check(!!d, `Abschnitt 65j: ${id} fehlt im Pool`);
      check(d.rarity === rarity, `Abschnitt 65j: ${id} hat Seltenheit ${d.rarity} statt ${rarity}`);
      check(Math.abs(d.core[field] - val) < 1e-9, `Abschnitt 65j: ${id}.core.${field} ist ${d.core[field]} statt ${val}`);
      check(d.isUnique === false, `Abschnitt 65j: ${id} ist einzigartig statt wiederholbar`);
    }
    // Laengerer Eid wirkt auf BEIDE (Untertan und Champion) ueber
    // ghostLifetimeAdd -- Champion-Test analog zu (c).
    const st = necroRoom({ ghost_005: 1 }, ['t_pink']);
    const g = createGhost(st, 100, 100, 0, 't_pink');
    pushGhost(st, g);
    const base = st.data.balance.ghost.lifetimeS ?? 12;
    check(Math.abs(g.lifetimeMax - (base + 0.5)) < 1e-9, `Abschnitt 65j: Laengerer Eid wirkt nicht auf die Champion-Lebenszeit (${g.lifetimeMax} statt ${base + 0.5})`);
  }

  // ---- (k) Langer Anspruch ist vollstaendig entfernt ---------------------
  check(!necroData.upgrades.ghost_068, 'Abschnitt 65k: ghost_068 "Langer Anspruch" ist noch im Pool');
  check(!Object.values(necroData.upgrades).some((d) => d.name === 'Langer Anspruch'), 'Abschnitt 65k: eine Karte heisst noch "Langer Anspruch"');
  check(
    !Object.values(necroData.upgrades).some((d) => (d.requires || []).includes('ghost_068')),
    'Abschnitt 65k: eine Karte verlangt noch ghost_068 als Voraussetzung',
  );

  // ---- (l) Seelenzorn/Totenrhythmus 5 %, Treues Ende 50 % ---------------
  check(necroData.upgrades.ghost_011.core.necroDmgPctPerDeath === 0.05, 'Abschnitt 65l: Seelenzorn liefert nicht 5 % Schaden je Geistertod');
  check(necroData.upgrades.ghost_012.core.necroFireRatePctPerDeath === 0.05, 'Abschnitt 65l: Totenrhythmus liefert nicht 5 % Feuerrate je Geistertod');
  check(necroData.upgrades.ghost_028.core.necroExpireStackBonus === 0.5, 'Abschnitt 65l: Treues Ende liefert nicht 50 % Bonus');
  check(necroData.upgrades.ghost_024.core.necroFireBurstWindowS === 2.0, 'Abschnitt 65l: Dunkler Treibstoff hat nicht das 2-Sekunden-Fenster');

  // ---- (m) Erbschaft des Starken/Haerte aus Verlust: bis Raumende --------
  {
    const { necroDamagePct, necroResistBonus, buildNecroListeners } = await import('../src/game/necro.js');
    const st = necroRoom({ ghost_021: 1, ghost_022: 1 }, ['t_pink']);
    st.necroListeners = [];
    buildNecroListeners(st, st.player.cfg);
    const before = necroDamagePct(st);
    const g = createGhost(st, 100, 100, 0, 't_pink');
    g.baseDamage = 100; // >= 120% Schwelle greift hier ohnehin nicht, unterer Zweig reicht
    pushGhost(st, g);
    killGhost(st, g);
    check(necroDamagePct(st) > before, 'Abschnitt 65m: Erbschaft des Starken traegt keinen dauerhaften Schadensbonus ein');
    for (let i = 0; i < 3; i++) {
      const gg = createGhost(st, 100, 100, 0, 't_pink');
      pushGhost(st, gg);
      killGhost(st, gg);
    }
    check(necroResistBonus(st) >= 8, `Abschnitt 65m: Haerte aus Verlust traegt nach 3 Toden keine dauerhafte Resistenz ein (${necroResistBonus(st)})`);
    // Kein Zerfall ueber Zeit (bewusst NICHT tickNecroTimers aufgerufen zu
    // pruefen, sondern strukturell: der Bonus liegt in state.necroStacks,
    // nicht in state.necroTimedStacks).
    check((st.necroStacks._roomDmgErbschaft || 0) > 0, 'Abschnitt 65m: Erbschaft des Starken liegt nicht im dauerhaften Raum-Stapel');
    check((st.necroStacks._roomResistHaerte || 0) > 0, 'Abschnitt 65m: Haerte aus Verlust liegt nicht im dauerhaften Raum-Stapel');
  }

  // ---- (n) Koenigliches Opfer: 40 % Champion-Basis, kein Zeitfenster -----
  {
    const { useGadget } = await import('../src/game/tank.js');
    const st = necroRoom({ ghost_096: 1 }, ['t_pink']);
    st.player.equippedGadget = 'ghost_096';
    st.player.cfg.gadget = 'ghost_096';
    const champ = createGhost(st, 100, 100, 0, 't_pink');
    pushGhost(st, champ);
    champ.baseDamage = 50;
    champ.baseMaxHp = 200;
    const dmgBefore = st.player.cfg.damage;
    const hpBefore = st.player.cfg.maxHp;
    useGadget(st.player, st);
    check(!champ.alive, 'Abschnitt 65n: Koenigliches Opfer toetet den Champion nicht');
    check(st.player.cfg.damage === dmgBefore + 20, `Abschnitt 65n: Hauptpanzer erhaelt nicht +40 % Champion-Basisschaden (${st.player.cfg.damage - dmgBefore} statt 20)`);
    check(st.player.cfg.maxHp === hpBefore + 80, `Abschnitt 65n: Hauptpanzer erhaelt nicht +40 % Champion-Basis-LP (${st.player.cfg.maxHp - hpBefore} statt 80)`);
    check(!('necroSacrificeChampionDurationS' in necroData.upgrades.ghost_096.core), 'Abschnitt 65n: Koenigliches Opfer traegt noch das alte Zeitfenster-Feld');
  }

  // ---- (o) Seelenband: nur Umleitung, kein Zusatzbonus --------------------
  check(!('necroSoulbondBuffPct' in necroData.upgrades.ghost_095.core), 'Abschnitt 65o: Seelenband traegt noch den alten Zeitbonus');

  // ---- (p) Seelenmonolith: Ausloeser ist der Hauptpanzer -----------------
  {
    const src = readFileSync(join(root, 'src', 'game', 'ghost.js'), 'utf8');
    // WICHTIG: src.indexOf() faengt sonst den ersten (Kommentar-)Fund von
    // 'necroCrownAnchorAfterS' (dem Feldnamen im Standarddaten-Kommentar bei
    // der Objekterzeugung) statt den eigentlichen Auswertungs-Block -- gezielt
    // an der IF-Bedingung ansetzen, die den Mechanismus wirklich traegt.
    const marker = 'playerCfg?.necroCrownAnchorAfterS)';
    const anchorIdx = src.indexOf(marker);
    check(anchorIdx >= 0, 'Abschnitt 65p: Testaufbau -- der Seelenmonolith-Auswertungsblock wurde nicht gefunden');
    const anchorBlock = src.slice(anchorIdx, anchorIdx + 500);
    check(anchorBlock.includes('state.player'), 'Abschnitt 65p: Seelenmonolith prueft nicht die Bewegung des Hauptpanzers');
    check(necroData.upgrades.ghost_081.core.necroCrownAnchorAfterS === 5.0, 'Abschnitt 65p: Seelenmonolith verlangt nicht 5 Sekunden Stillstand');
  }

  // ---- (q) Losgeloeste Ketten: Geisterbombe liefert einen beweglichen Typ
  {
    const { useSecondary } = await import('../src/game/tank.js');
    const st = necroRoom({ ghost_116: 1 }, ['t_pink']);
    // Reiner Guardian-Pool (t_green ist "guardian", bewegt sich nie) --
    // ohne den Filter waere JEDE gespawnte Geisterbombe stationaer.
    st.actEnemyPool = ['t_green'];
    let sawMobile = false;
    for (let i = 0; i < 20; i++) {
      st.player.ghostBombCooldown = 0;
      st.ghosts.length = 0;
      useSecondary(st.player, st);
      const g = st.ghosts.find((x) => x.alive);
      if (g && g.type !== 't_green') sawMobile = true;
    }
    // t_green ist der einzige Typ im Pool -> der Filter faellt auf den
    // vollen (stationaeren) Pool zurueck, KEIN Absturz, kein leerer Spawn.
    check(st.ghosts.some((g) => g.alive), 'Abschnitt 65q: Geisterbombe spawnt nichts bei einem reinen Guardian-Pool (Rueckfall fehlt)');
    // Mit einem gemischten Pool wird garantiert ein beweglicher Typ gewaehlt.
    st.actEnemyPool = ['t_green', 't_pink'];
    let allMobile = true;
    for (let i = 0; i < 20; i++) {
      st.player.ghostBombCooldown = 0;
      st.ghosts.length = 0;
      useSecondary(st.player, st);
      const g = st.ghosts.find((x) => x.alive);
      if (g && g.type === 't_green') allMobile = false;
    }
    check(allMobile, 'Abschnitt 65q: Losgeloeste Ketten laesst trotzdem stationaere Typen ueber die Geisterbombe erscheinen');
  }
  // Gegenprobe (q): necroForceMobileBomb-Filter in tank.js: spawnGhostBomb()
  // ausgebaut -- der letzte Check (allMobile) schlaegt fehl (t_green
  // erscheint wieder); am Quellcode verifiziert und zurueckgesetzt.

  // ---- (r) Pinker Panzer: 117 px/s, weiterhin 3 Geschosse ----------------
  {
    const cfg = resolveCfg2(tanksData, 't_pink');
    check(cfg.bulletSpeed === 117, `Abschnitt 65r: t_pink.bulletSpeed ist ${cfg.bulletSpeed} statt 117`);
    check(cfg.magazine === 3, `Abschnitt 65r: t_pink.magazine ist ${cfg.magazine} statt 3`);
    const otherCfg = resolveCfg2(tanksData, 't_yellow');
    check(otherCfg.bulletSpeed === (tanksData.bulletSpeeds.bullet ?? 130), 'Abschnitt 65r: ein anderer Gegnertyp wird durch die t_pink-Aenderung mitgebremst');
  }
  // Gegenprobe (r): tanks.json: t_pink.bulletSpeed entfernt -- cfg.bulletSpeed
  // faellt auf den geteilten Wert (130) zurueck, Check schlaegt fehl; am
  // Quellcode verifiziert und zurueckgesetzt.

  // ---- (s) Gruener Panzer: 1,7 s Moerser-Flugzeit -------------------------
  check(tanksData.balance.mortar.flightTimeS === 1.7, `Abschnitt 65s: mortar.flightTimeS ist ${tanksData.balance.mortar.flightTimeS} statt 1.7`);
  check(tanksData.balance.mortar.radiusPx === 44, 'Abschnitt 65s: mortar.radiusPx hat sich unerwuenscht geaendert');

  // ---- (t) Elite-Belohnung: mindestens eine episch-oder-legendaere Karte -
  // rollReward() selbst ist modul-lokal (nicht exportiert) -- der Test nutzt
  // deshalb dieselben oeffentlichen Bausteine (rollOffers/drawOne/
  // eliteRarityWeights), mit denen run.js: rollReward()s Elite-Zweig
  // 1:1 aufgebaut ist.
  {
    let sawEpicOrLegendary = 0;
    const trials = 60;
    for (let i = 0; i < trials; i++) {
      const opts = {
        chosen: {}, roomIndex: 5, rng: (() => {
          let s = 2000 + i * 733;
          return () => { s = (s * 48271) % 2147483647; return (s - 1) / 2147483646; };
        })(),
        balance: tanksData.balance, count: 3, banned: new Set(), starterTank: 'c_necro',
        rarityWeights: eliteRarityWeights(tanksData.balance, 25),
      };
      const offers = rollOffers(mergedUpgrades, opts);
      const avoidTags = new Set(offers.map((o) => o.tag));
      const avoidIds = new Set(offers.map((o) => o.id));
      const eliteCard = drawOne(mergedUpgrades, { ...opts, includeTag: 'elite', bypassRoomGate: true }, avoidTags, avoidIds);
      if (eliteCard) offers.push(eliteCard);
      let hasEpicOrLegendary = offers.some((o) => o.rarity === 'epic' || o.rarity === 'legendary');
      if (!hasEpicOrLegendary && offers.length) {
        const avoidIds2 = new Set(offers.map((o) => o.id));
        const guaranteed =
          drawOne(mergedUpgrades, { ...opts, onlyRarity: 'legendary', bypassRoomGate: true }, new Set(), avoidIds2) ||
          drawOne(mergedUpgrades, { ...opts, onlyRarity: 'epic', bypassRoomGate: true }, new Set(), avoidIds2);
        if (guaranteed) { offers[offers.length - 1] = guaranteed; hasEpicOrLegendary = true; }
      }
      if (hasEpicOrLegendary) sawEpicOrLegendary++;
    }
    check(sawEpicOrLegendary === trials, `Abschnitt 65t: nur ${sawEpicOrLegendary}/${trials} Elite-Angebote enthalten eine episch-oder-legendaere Karte`);
  }
  // Gegenprobe (t): den Garantie-Block (hasEpicOrLegendary-Ersetzung) im
  // Testnachbau UND im echten run.js entfernt -- die Trefferquote faellt klar
  // unter 100 % (die Baender allein garantieren nichts); am echten
  // run.js-Quellcode verifiziert (Zweig auskommentiert, Suite lief rot) und
  // zurueckgesetzt.

  // ---- (u) Boss-Belohnung: drei UNTERSCHIEDLICHE legendaere Karten -------
  {
    const run = createRun(tanksData, tilesData, diffData, mergedUpgrades, 888, 'normal', { starterTank: 'c_necro' });
    const offers = rollBossReward(run);
    check(offers.length === 3, `Abschnitt 65u: rollBossReward() liefert ${offers.length} Karten statt 3 (c_necro-Pool)`);
    check(offers.every((o) => o.rarity === 'legendary'), 'Abschnitt 65u: nicht alle Boss-Angebote sind legendaer');
    const ids = new Set(offers.map((o) => o.id));
    check(ids.size === offers.length, 'Abschnitt 65u: die Boss-Belohnung enthaelt doppelte Karten');
    // Auch die Standard-Klasse (kein Signaturpool, nur der Sockel) bekommt
    // drei unterschiedliche Legendaere -- die drei universellen sockel_*-
    // Karten aus data/upgrades.json.
    const runP = createRun(tanksData, tilesData, diffData, mergedUpgrades, 889, 'normal', { starterTank: 'player' });
    const offersP = rollBossReward(runP);
    check(offersP.length === 3, `Abschnitt 65u: rollBossReward() liefert ${offersP.length} Karten statt 3 (Standard-Klasse)`);
    check(new Set(offersP.map((o) => o.id)).size === 3, 'Abschnitt 65u: die Standard-Klasse bekommt keine drei unterschiedlichen Legendaere');
    // Auswahl fuehrt zum Akt-Uebergang, nicht zu afterRoomDone()/einer
    // erneuten Kartenwahl.
    run.phase = 'bossReward';
    run.pendingOffers = offers;
    run.rewardKind = 'bossLegendary';
    const pickedId = offers[0].id;
    const before = run.upgrades[pickedId] || 0;
    chooseBossReward(run, 0);
    check((run.upgrades[pickedId] || 0) === before + 1, 'Abschnitt 65u: die gewaehlte Boss-Karte wird nicht dem Run gutgeschrieben');
    check(run.phase === 'actComplete' || run.phase === 'victory', `Abschnitt 65u: nach der Boss-Belohnung ist run.phase "${run.phase}" statt actComplete/victory`);
  }
  // Gegenprobe (u): rollBossReward()s avoidIds-Pflege entfernt (dieselbe
  // Karte koennte dann zweimal gezogen werden) -- der "keine doppelten
  // Karten"-Check schlaegt bei genuegend Wiederholungen fehl; separat den
  // dritten sockel_*-Legendaer-Eintrag geloescht -> offersP.length faellt auf
  // 2, Check schlaegt fehl; beide am Quellcode verifiziert und zurueckgesetzt.

  // ---- (v) Glossar: Begriffe werden markiert, title-Attribut gesetzt -----
  {
    initGlossary(glossaryData);
    const html = highlightTerms('Der Champion greift den Elitegegner an.');
    check(html.includes('class="glossary-term"'), 'Abschnitt 65v: highlightTerms() markiert keinen bekannten Begriff');
    check(html.includes('data-term="Champion"'), 'Abschnitt 65v: "Champion" wird nicht als Begriff erkannt');
    check(html.includes('title="'), 'Abschnitt 65v: markierte Begriffe tragen kein title-Attribut (Desktop-Hover)');
    check(html.includes('Elitegegner'), 'Abschnitt 65v: "Elitegegner" fehlt im Ergebnis');
    const plain = highlightTerms('Ein ganz normaler Satz ohne Fachbegriffe.');
    check(!plain.includes('glossary-term'), 'Abschnitt 65v: ein Satz ohne bekannte Begriffe wird trotzdem markiert');
    // Mindestbegriffe aus dem Auftrag vollstaendig vorhanden.
    for (const term of ['Champion', 'Geisterpanzer', 'Verschmelzung', 'Geistertod', 'Wiederbelebungschance', 'Feuerrate', 'Schadensresistenz', 'Elitegegner', 'Einzigartig', 'Raumende', 'Geisterlimit']) {
      check(!!glossaryData.terms[term], `Abschnitt 65v: Glossar-Begriff "${term}" fehlt`);
    }
  }
}

// ---- 66. Spinnenboss (Akt 3) ----------------------------------------------
// Deckt die sicherheitskritischen Kernpunkte des Spinnenboss-Auftrags ab:
// acht Beine mit eigener HP/Geschwindigkeitsformel, den Bein-vs-Koerper-
// Trefferordnungs-Bug (ein Schuss, der einen Bein-Treffer haette sein
// sollen, wurde vom generischen Panzer-Kollisionskreis des Bosses VOR der
// Bein-Pruefung verschluckt -- b) unten testet genau diesen Mechanismus,
// nicht nur "irgendein Bein stirbt irgendwann"), das 3,5s-Betaeubungs-
// fenster mit Koerper-Verwundbarkeit, die 30%-Bodenklammer, den Phase-2-
// Schwellenwert, den kompletten Phase-3-Uebergang (Wandabriss, feste
// Position, zwei zeitversetzte Saeulen, Dauerverwundbarkeit), den Gegner-
// Geschoss-Deckel-Fix (Geisterkugeln zaehlen nicht mehr als "gegnerisch")
// samt des erhoehten Bullet-Hell-Budgets, Spinnenminen (Spawn-/aktive
// Phase, kein Selbstbeschuss des Bosses, kein Ausloesen durch einen
// eigenen Bossschuss, kein 3s-Minenzuender-Fuse), Spinnennetze (HP-basierte
// Zerstoerung -- NICHT ein beliebiger Treffer, s. c) --, Lebensdauer/
// Zerfall, die 50%/1,5s-Verlangsamung fuer Spieler UND Geister/Champion)
// und den Respawn-Fix (der Spielball darf den Spinnenboss nicht auf seinen
// Ursprungs-Spawnpunkt zuruecksetzen). Jeder mit eigenen Zahlen geprueft,
// nicht nur gegen die aktuelle balance.json-Datenlage.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { createGhost, pushGhost } = await import('../src/game/ghost.js');
  const { isBossCfg } = await import('../src/game/cfg.js');
  const bcfg = tanksData.balance.boss.spider;
  const CMD = { move: { x: 0, y: 0 }, aim: 0, firing: false, secondary: false, secondaryThrow: false, dash: false };

  function spiderRoom() {
    return createState(tanksData, tilesData, {
      genRng: () => 0.5,
      enemyTypes: ['t_spider'],
      aiSeed: 1,
      roomSpec: { fixedLayout: 'boss_spider' },
      arenas: tanksData.arenas,
      hpScale: 1,
      hpSkipBosses: true,
    });
  }

  // Realistischer Spielerschuss (Radius wie eine echte Kugel) statt der
  // Testfalle "riesiger Radius" -- ein zu grosser Testradius ueberlappt
  // aus reiner Groesse zusaetzlich den Aussenwand-Kollisionskreis und
  // erzeugt so einen Test-Artefakt, kein echtes Spielverhalten.
  function shotAt(owner, x, y, dmg = 999) {
    return createBullet(x, y, 0, { speed: 0, radius: 5, owner, damage: dmg });
  }
  function legMid(leg) {
    return { x: (leg.jointX + leg.footX) / 2, y: (leg.jointY + leg.footY) / 2 };
  }

  // ---- (a) Struktur: t_spider, Akt-3-Zuordnung, kanonische Balance-Werte -
  {
    const t = tanksData.types.t_spider;
    check(!!t && t.spiderBoss === true, 'Abschnitt 66a: t_spider fehlt oder traegt kein spiderBoss-Flag');
    check(t.maxHp === 1800, `Abschnitt 66a: t_spider.maxHp ${t.maxHp} statt 1800`);
    check(!t.player, 'Abschnitt 66a: t_spider ist faelschlich als Spielerklasse markiert');
    check(diffData.acts[2].boss === 'boss_spider', `Abschnitt 66a: Akt-3-Boss ist "${diffData.acts[2].boss}" statt "boss_spider"`);
    check(!!tanksData.arenas.boss_spider, 'Abschnitt 66a: Arena boss_spider fehlt in arenas.json');
    check(bcfg.legCount === 8, `Abschnitt 66a: legCount ${bcfg.legCount} statt 8`);
    check(bcfg.legHp === 150, `Abschnitt 66a: legHp ${bcfg.legHp} statt 150`);
    check(bcfg.legCount * bcfg.legHp === 1200, 'Abschnitt 66a: acht Beine ergeben nicht 1200 LP');
    check(bcfg.legCount * bcfg.legHp + 1800 === 3000, 'Abschnitt 66a: Gesamt-LP (Beine+Koerper) ergeben nicht 3000');
    check(bcfg.legStunS === 3.5, `Abschnitt 66a: legStunS ${bcfg.legStunS} statt 3.5`);
    check(bcfg.phase2AtHpPct === 0.5, `Abschnitt 66a: phase2AtHpPct ${bcfg.phase2AtHpPct} statt 0.5`);
    check(bcfg.phase3ProtectHpPct === 0.3, `Abschnitt 66a: phase3ProtectHpPct ${bcfg.phase3ProtectHpPct} statt 0.3`);
    check(bcfg.baseSpeedPxS === 48, `Abschnitt 66a: baseSpeedPxS ${bcfg.baseSpeedPxS} statt 48`);
    check(bcfg.pillars.length === 2, `Abschnitt 66a: ${bcfg.pillars.length} Saeulen statt genau 2`);
    check(bcfg.mine.spawnS === 1.5, `Abschnitt 66a: mine.spawnS ${bcfg.mine.spawnS} statt 1.5`);
    check(bcfg.web.maxHp === 20, `Abschnitt 66a: web.maxHp ${bcfg.web.maxHp} statt 20`);
    check(bcfg.web.maxLifeS === 10, `Abschnitt 66a: web.maxLifeS ${bcfg.web.maxLifeS} statt 10`);
    const webStatus = tanksData.status.effects.web;
    check(!!webStatus, 'Abschnitt 66a: data/status.json hat keinen "web"-Effekt');
    check(webStatus.speedMult === 0.5, `Abschnitt 66a: web.speedMult ${webStatus.speedMult} statt 0.5`);
    check(webStatus.durationS === 1.5, `Abschnitt 66a: web.durationS ${webStatus.durationS} statt 1.5`);
  }

  // ---- (b) Bein-Trefferordnung: der eigentliche Bug ------------------------
  // Ein Schuss auf ein Bein darf NICHT vom generischen Koerper-Kollisions-
  // kreis des Bosses verschluckt werden (0 Schaden, Bein bleibt am Leben).
  // Genau dieser Bug lag vor, solange updateSpiderLegHits() NACH der
  // grossen Panzer-Trefferschleife lief -- ERREICHBAR aber erst mit einem
  // Geschossradius, der gross genug ist, um vom Bein-Mittelpunkt aus (~30 px
  // vom Bosszentrum, legJointPx 15 + legReachPx 46 gemittelt) ZUGLEICH den
  // kleinen Koerper-Kollisionskreis (tankRadius 12) zu erreichen -- ein
  // gewoehnlicher Spielerschuss (physics.bulletRadius 4) ist dafuer zu klein
  // (Gegenprobe mit Radius 5 bestaetigt: kein Ueberlapp, der Test waere
  // dabei NIE rot geworden, egal ob der Bug drin ist oder nicht -- also
  // wirkungslos gewesen). Radius 20 ist die kleinste Groessenordnung, die
  // das Ueberlapp-Fenster nachweislich schliesst und damit den Mechanismus
  // tatsaechlich prueft, auch wenn aktuell kein Kartenupgrade den Spieler-
  // Geschossradius so weit anheben kann.
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    const leg = boss.spiderLegs[0];
    const { x, y } = legMid(leg);
    st.bullets.push(createBullet(x, y, 0, { speed: 0, radius: 20, owner: st.player, damage: 999 }));
    const hpBefore = boss.hp;
    stepState(st, CMD, 1 / 60);
    check(!leg.alive, 'Abschnitt 66b: ein Schuss auf ein Bein toetet es nicht');
    check(boss.hp === hpBefore, 'Abschnitt 66b: derselbe Schuss hat zusaetzlich (faelschlich) den geschuetzten Koerper getroffen');
  }

  // ---- (c) Geschwindigkeitstabelle 8/4/1/0 Beine + Betaeubungsfenster -----
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    check(Math.abs(boss.cfg.speed - 48) < 0.01, `Abschnitt 66c: Speed mit 8 Beinen ${boss.cfg.speed} statt 48`);
    for (let i = 0; i < 4; i++) {
      const { x, y } = legMid(boss.spiderLegs[i]);
      st.bullets.push(shotAt(st.player, x, y));
    }
    stepState(st, CMD, 1 / 60);
    check(boss.spiderLegsAlive === 4, `Abschnitt 66c: ${boss.spiderLegsAlive} Beine uebrig statt 4`);
    check(Math.abs(boss.cfg.speed - 24) < 0.01, `Abschnitt 66c: Speed mit 4 Beinen ${boss.cfg.speed} statt 24`);
    check(Math.abs(boss.spiderVulnerableTimer - bcfg.legStunS) < 1e-6, 'Abschnitt 66c: das Betaeubungsfenster steht nicht exakt auf legStunS');
    const hpDuringStun = boss.hp;
    st.applyDamage(boss, 100, 'test');
    check(boss.hp === hpDuringStun - 100, 'Abschnitt 66c: der Koerper ist waehrend der Betaeubung nicht verwundbar');
    // Fenster laufen lassen (ohne weiteren Beinverlust): Koerper wieder
    // geschuetzt, solange noch Beine leben.
    for (let i = 0; i < Math.ceil(bcfg.legStunS * 60) + 5; i++) stepState(st, CMD, 1 / 60);
    check(!(boss.spiderVulnerableTimer > 0), 'Abschnitt 66c: das Betaeubungsfenster laeuft nie ab');
    const hpAfterStun = boss.hp;
    st.applyDamage(boss, 100, 'test');
    check(boss.hp === hpAfterStun, 'Abschnitt 66c: der Koerper ist nach Ablauf der Betaeubung (Beine noch da) nicht wieder geschuetzt');
  }

  // ---- (c2) Weiterer Beinverlust ERNEUERT das Fenster, addiert nicht -----
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    const { x: x0, y: y0 } = legMid(boss.spiderLegs[0]);
    st.bullets.push(shotAt(st.player, x0, y0));
    stepState(st, CMD, 1 / 60);
    check(Math.abs(boss.spiderVulnerableTimer - bcfg.legStunS) < 0.02, 'Abschnitt 66c2: erster Beinverlust setzt das Fenster nicht auf legStunS');
    for (let i = 0; i < 30; i++) stepState(st, CMD, 1 / 60); // ~0.5s ins Fenster hinein
    const midway = boss.spiderVulnerableTimer;
    check(midway < bcfg.legStunS - 0.3, 'Abschnitt 66c2: Testvoraussetzung -- das Fenster sollte schon abgelaufen sein');
    const { x: x1, y: y1 } = legMid(boss.spiderLegs[1]);
    st.bullets.push(shotAt(st.player, x1, y1));
    stepState(st, CMD, 1 / 60);
    check(
      boss.spiderVulnerableTimer > midway && boss.spiderVulnerableTimer <= bcfg.legStunS + 0.02,
      `Abschnitt 66c2: der zweite Beinverlust erneuert das Fenster nicht auf volle legStunS (ist ${boss.spiderVulnerableTimer}, war ${midway})`,
    );
  }

  // ---- (d) 30%-Bodenklammer mit EIGENEM Prozentsatz -----------------------
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    boss.spiderVulnerableTimer = 1; // Koerper kuenstlich verwundbar
    boss.hp = 1000;
    st.applyDamage(boss, 900, 'test'); // waere 100, die Klammer hebt auf den Boden
    const floor = boss.cfg.maxHp * bcfg.phase3ProtectHpPct;
    check(boss.hp === floor, `Abschnitt 66d: hp ${boss.hp} statt auf den Boden ${floor} geklemmt`);
    // Normale Kugel bei lebenden Beinen ohne Betaeubung: Klammer greift
    // erst gar nicht (Koerper ist ohnehin geschuetzt), hp bleibt exakt.
    boss.spiderVulnerableTimer = 0;
    boss.hp = 1000;
    st.applyDamage(boss, 900, 'test');
    check(boss.hp === 1000, 'Abschnitt 66d: eine normale Kugel erreicht trotz Beinen den Koerper');
  }

  // ---- (e) Phase-2-Schwelle bei GENAU 50 % ---------------------------------
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    boss.hp = boss.cfg.maxHp * bcfg.phase2AtHpPct + 1;
    stepState(st, CMD, 1 / 60);
    check(boss.spiderPhase === 1, 'Abschnitt 66e: Phase 2 beginnt schon VOR der 50%-Schwelle');
    boss.hp = boss.cfg.maxHp * bcfg.phase2AtHpPct;
    stepState(st, CMD, 1 / 60);
    check(boss.spiderPhase === 2, 'Abschnitt 66e: Phase 2 beginnt nicht bei genau 50% Boss-LP');
    // Kein Rueckfall auf Phase 1, auch wenn hp danach wieder steigt.
    boss.hp = boss.cfg.maxHp;
    stepState(st, CMD, 1 / 60);
    check(boss.spiderPhase === 2, 'Abschnitt 66e: Phase 2 faellt auf Phase 1 zurueck, wenn hp wieder steigt');
  }

  // ---- (f) Alle acht Beine weg -> Betaeubung + Uebergang -> Phase 3 -------
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    for (const leg of boss.spiderLegs) leg.hp = 1; // ein Treffer reicht je Bein
    for (let i = 0; i < 8; i++) {
      const { x, y } = legMid(boss.spiderLegs[i]);
      st.bullets.push(shotAt(st.player, x, y));
    }
    stepState(st, CMD, 1 / 60);
    check(boss.spiderLegsAlive === 0, `Abschnitt 66f: ${boss.spiderLegsAlive} Beine uebrig statt 0`);
    check(Math.abs(boss.cfg.speed) < 0.01, `Abschnitt 66f: Speed ohne Beine ${boss.cfg.speed} statt 0`);
    check(boss.spiderPhase !== 3, 'Abschnitt 66f: Phase 3 beginnt ohne das 3,5s-Betaeubungsfenster');
    // Stun (legStunS) + Uebergang (transitionS) vollstaendig ablaufen lassen.
    const ticks = Math.ceil((bcfg.legStunS + bcfg.transitionS + 0.5) * 60);
    for (let i = 0; i < ticks; i++) stepState(st, CMD, 1 / 60);
    check(boss.spiderPhase === 3, `Abschnitt 66f: Phase war "${boss.spiderPhase}" statt 3 nach Stun+Uebergang`);
    check(
      Math.abs(boss.x - bcfg.stationaryPos.x) < 1 && Math.abs(boss.y - bcfg.stationaryPos.y) < 1,
      `Abschnitt 66f: Boss steht bei (${boss.x},${boss.y}) statt (${bcfg.stationaryPos.x},${bcfg.stationaryPos.y})`,
    );
    check(Array.isArray(st.spiderPillars) && st.spiderPillars.length === 2, `Abschnitt 66f: ${st.spiderPillars?.length} Saeulen statt 2`);
    // Innenwaende weg, Aussenrand bleibt (0/0 und COLS-1/ROWS-1 pruefen zwei
    // Ecken der Aussenwand stellvertretend).
    check(!st.isSolid(5 * 32 + 16, 3 * 32 + 16), 'Abschnitt 66f: eine ehemalige Innenwand-Zelle ist nach dem Umbau weiterhin fest');
    check(st.isSolid(16, 16), 'Abschnitt 66f: der Aussenrand ist nach dem Umbau nicht mehr fest');
    // Koerper ist in Phase 3 DAUERHAFT verwundbar, auch ohne aktives
    // Betaeubungsfenster.
    boss.spiderVulnerableTimer = 0;
    const hpBefore = boss.hp;
    st.applyDamage(boss, 50, 'test');
    check(boss.hp === hpBefore - 50, 'Abschnitt 66f: der Koerper ist in Phase 3 nicht dauerhaft verwundbar');
    // Minen/Netze wurden beim Umbau kontrolliert geraeumt (Abschnitt 21:
    // keine unvermeidbaren Treffer waehrend der Umbau-Kurzsequenz).
    check(st.spiderMines.length === 0, 'Abschnitt 66f: Spinnenminen ueberleben den Phase-3-Umbau');
    check(st.spiderWebs.length === 0, 'Abschnitt 66f: Spinnennetze ueberleben den Phase-3-Umbau');
  }

  // ---- (g) Saeulen: unabhaengig, zeitversetzt, mit Vorwarnung -------------
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    for (const leg of boss.spiderLegs) leg.hp = 1;
    for (let i = 0; i < 8; i++) {
      const { x, y } = legMid(boss.spiderLegs[i]);
      st.bullets.push(shotAt(st.player, x, y));
    }
    stepState(st, CMD, 1 / 60);
    // Genau bis zum ERSTEN Tick in Phase 3 stoppen (nicht mit einem Puffer
    // ueberschiessen) -- sonst hat updatePillars() den Timer der Saeule mit
    // Timer 0 schon selbst weitergedreht, bevor der "startet offen"-Check
    // ueberhaupt laeuft.
    const maxTicks = Math.ceil((bcfg.legStunS + bcfg.transitionS + 1) * 60);
    let reachedPhase3 = false;
    for (let i = 0; i < maxTicks; i++) {
      stepState(st, CMD, 1 / 60);
      if (boss.spiderPhase === 3) {
        reachedPhase3 = true;
        break;
      }
    }
    check(reachedPhase3, 'Abschnitt 66g: Testvoraussetzung -- Phase 3 nicht erreicht');
    const [p0, p1] = st.spiderPillars;
    check(p0.col !== p1.col || p0.row !== p1.row, 'Abschnitt 66g: beide Saeulen stehen auf derselben Zelle');
    check(!p0.solid && !p1.solid, 'Abschnitt 66g: beide Saeulen starten nicht offen');
    // Saeule 0 hat Timer 0 -> faehrt sofort im ersten Tick hoch, Saeule 1
    // (Timer = pillarOffsetS) bleibt noch offen -- "immer mindestens eine
    // verfuegbar" direkt nach dem Uebergang.
    stepState(st, CMD, 1 / 60);
    check(p0.solid, 'Abschnitt 66g: Saeule 0 (Timer 0) faehrt nicht sofort hoch');
    check(!p1.solid, 'Abschnitt 66g: Saeule 1 (zeitversetzt) faehrt zu frueh hoch, verletzt die Staffelung');
    check(st.isSolid(p0.col * 32 + 16, p0.row * 32 + 16), 'Abschnitt 66g: setWallSolid() traegt eine hochgefahrene Saeule nicht ins Grid ein');
    // Saeule 1 faehrt nach pillarOffsetS ebenfalls hoch.
    for (let i = 0; i < Math.ceil(bcfg.pillarOffsetS * 60); i++) stepState(st, CMD, 1 / 60);
    check(p1.solid, 'Abschnitt 66g: Saeule 1 faehrt nach pillarOffsetS nicht hoch');
  }

  // ---- (h) Gegner-Geschoss-Deckel: Geisterkugeln zaehlen nicht mit --------
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const cap = tanksData.balance.enemyBullet.maxActive;
    const enemy = st.spiderBoss;
    const ghostOwner = { isGhost: true, cfg: {} };
    // Getrennte Positionen (weit auseinander): sonst wuerden Geister- und
    // Bosskugel bei identischer Position ueber die GENERISCHE Geschoss-
    // gegen-Geschoss-Kollision gegenseitig sterben (unterschiedlicher
    // Besitzer -> keine Salven-Ausnahme) -- ein Testartefakt, das mit dem
    // hier eigentlich geprueften Deckel-Fix nichts zu tun hat.
    for (let i = 0; i < cap + 10; i++) st.bullets.push(createBullet(400, 400, 0, { speed: 0, radius: 3, owner: ghostOwner, damage: 1 }));
    for (let i = 0; i < 3; i++) st.bullets.push(createBullet(100, 100, 0, { speed: 0, radius: 3, owner: enemy, damage: 1 }));
    stepState(st, CMD, 1 / 60);
    const ghostBulletsLeft = st.bullets.filter((b) => b.owner === ghostOwner).length;
    check(ghostBulletsLeft === cap + 10, `Abschnitt 66h: ${ghostBulletsLeft} von ${cap + 10} Geisterkugeln uebrig -- der Gegner-Deckel verdraengt sie faelschlich mit`);
  }

  // ---- (i) Bullet-Hell-Budget nur in Phase 3, hoeher als das normale -----
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    const baseCap = tanksData.balance.enemyBullet.maxActive;
    check(bcfg.bulletHellMaxActive > baseCap, 'Abschnitt 66i: bulletHellMaxActive ist nicht groesser als das normale Budget');
    boss.spiderPhase = 3;
    for (let i = 0; i < baseCap + 15; i++) st.bullets.push(createBullet(400, 400, 0, { speed: 0, radius: 3, owner: boss, damage: 1 }));
    stepState(st, CMD, 1 / 60);
    const left = st.bullets.filter((b) => b.owner === boss).length;
    check(left === Math.min(baseCap + 15, bcfg.bulletHellMaxActive), `Abschnitt 66i: ${left} Bossgeschosse uebrig, erwartet min(${baseCap + 15}, ${bcfg.bulletHellMaxActive})`);
  }

  // ---- (j) Spinnenmine: Spawnphase (sofort beschiessbar, reduzierter ------
  //          Schaden, kein Selbstbeschuss, kein Ausloesen durch eigenen Schuss)
  {
    const { spawnSpiderMine, updateSpiderMines } = await import('../src/game/spidermine.js');
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    const m = spawnSpiderMine(st, boss);
    check(m.spiderState === 'spawn', 'Abschnitt 66j: eine frische Spinnenmine startet nicht in der Spawnphase');
    check(m.radius === bcfg.mine.spawnRadiusPx, `Abschnitt 66j: Spawnradius ${m.radius} statt ${bcfg.mine.spawnRadiusPx}`);
    // Ein eigener Bossschuss loest sie NICHT aus.
    st.bullets.push(createBullet(m.x, m.y, 0, { speed: 0, radius: 3, owner: boss, damage: 999 }));
    updateSpiderMines(st, 1 / 60);
    check(!m.dead, 'Abschnitt 66j: ein eigener Bossschuss loest die Spinnenmine faelschlich aus');
    // Beruehrt sie den eigenen Besitzer (den Boss selbst)? Darf nicht ausloesen.
    for (let i = 0; i < 30; i++) updateSpiderMines(st, 1 / 60);
    check(!m.dead, 'Abschnitt 66j: die Spinnenmine detoniert durch reine Beruehrung ihres eigenen Besitzers');
    // Ab Frame 1 beschiessbar (Spieler-Kugel loest sie SOFORT aus, keine
    // normale Zuend-Verzoegerung), mit reduziertem Spawn-Schaden statt des
    // vollen aktiven Schadens, und trifft dabei den (sonst geschuetzten)
    // Koerper -- Abschnitt 15. FRISCHER Raum statt eines zweiten Minen-
    // Objekts im selben: zwei Spawnphasen-Minen haengen beide exakt am
    // Bosskoerper (dieselbe Position) -- friendlyBulletHitsMine() ist
    // NICHT an eine bestimmte Mine gebunden, ein zweites Objekt an
    // derselben Stelle wuerde denselben Schuss stellvertretend abfangen
    // und die eigentlich gepruefte Mine unberuehrt lassen.
    const st2 = spiderRoom();
    stepState(st2, CMD, 1 / 60);
    const boss2 = st2.spiderBoss;
    const m2 = spawnSpiderMine(st2, boss2);
    const hpBefore = boss2.hp;
    st2.bullets.push(createBullet(m2.x, m2.y, 0, { speed: 0, radius: 3, owner: st2.player, damage: 5 }));
    updateSpiderMines(st2, 1 / 60);
    check(m2.dead, 'Abschnitt 66j: eine frisch erzeugte Spinnenmine ist noch nicht beschiessbar');
    check(boss2.hp === hpBefore - bcfg.mine.spawnDamage, `Abschnitt 66j: Spawn-Explosion traf den Koerper nicht mit spawnDamage (${bcfg.mine.spawnDamage}), hp ${hpBefore}->${boss2.hp}`);
  }

  // ---- (k) Spinnenmine: Uebergang in die aktive Phase, kein 3s-Fuse -------
  {
    const { spawnSpiderMine, updateSpiderMines } = await import('../src/game/spidermine.js');
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    const m = spawnSpiderMine(st, boss);
    for (let i = 0; i < Math.ceil(bcfg.mine.spawnS * 60) + 2; i++) updateSpiderMines(st, 1 / 60);
    check(m.spiderState === 'active', 'Abschnitt 66k: die Spinnenmine wechselt nach spawnS nicht in die aktive Phase');
    check(!m.dead, 'Abschnitt 66k: die Spinnenmine ist beim Phasenwechsel bereits tot');
    // Deutlich laenger als der normale 3s-Minenzuender simulieren -- eine
    // Spinnenmine in der aktiven Verfolgung darf NICHT ueber den generischen
    // Minen-Fuse detonieren (sie ist nicht in state.mines, hat also gar
    // keinen Zugriff auf ihn, aber die Lebensdauer selbst muss laenger als
    // 3s tragen). Der Spieler wird fuer diese Messung kurzzeitig als "nicht
    // lebend" markiert, damit eine reale KONTAKT-Detonation (touchesLiving
    // Target) das Ergebnis nicht verfaelscht -- geprueft wird ausschliesslich
    // die Lebensdauer/den fehlenden 3s-Fuse, nicht das (bereits in (l)
    // separat getestete) Kontaktverhalten.
    st.player.alive = false;
    for (let i = 0; i < 5 * 60; i++) updateSpiderMines(st, 1 / 60);
    st.player.alive = true;
    check(!m.dead, 'Abschnitt 66k: die aktive Spinnenmine detoniert vor Ablauf der chaseDurationS (5s simuliert, Fuse waere bei 3s)');
  }

  // ---- (l) Spinnenmine: aktive Phase trifft Spieler UND Geist -------------
  {
    const { spawnSpiderMine, updateSpiderMines } = await import('../src/game/spidermine.js');
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    const m = spawnSpiderMine(st, boss);
    m.spiderState = 'active';
    m.chaseAge = 0;
    m.x = st.player.x;
    m.y = st.player.y;
    const hpBefore = st.player.hp;
    updateSpiderMines(st, 1 / 60);
    check(m.dead, 'Abschnitt 66l: die aktive Spinnenmine detoniert nicht bei Kontakt mit dem Spieler');
    check(hpBefore - st.player.hp === bcfg.mine.activeDamage, `Abschnitt 66l: Spielerschaden ${hpBefore - st.player.hp} statt activeDamage ${bcfg.mine.activeDamage}`);

    const st2 = spiderRoom();
    stepState(st2, CMD, 1 / 60);
    const g = createGhost(st2, 400, 300, 0, 't_brown');
    pushGhost(st2, g);
    const m2 = spawnSpiderMine(st2, st2.spiderBoss);
    m2.spiderState = 'active';
    m2.chaseAge = 0;
    m2.x = g.x;
    m2.y = g.y;
    const ghostHpBefore = g.hp;
    updateSpiderMines(st2, 1 / 60);
    check(m2.dead, 'Abschnitt 66l: die aktive Spinnenmine detoniert nicht bei Kontakt mit einem Geisterpanzer');
    check(g.hp < ghostHpBefore, 'Abschnitt 66l: ein Geisterpanzer nimmt keinen Schaden von einer Spinnenmine');
  }

  // ---- (m) Spinnennetz: HP-basierte Zerstoerung (Abschnitt 18, EXAKTE ----
  //          Beispielrechnung), Zerfall, maximale Lebensdauer
  {
    const { updateSpiderWebs } = await import('../src/game/spider.js');
    const wcfg = bcfg.web;
    // 5s unberuehrt zerfallen lassen: 20 - 2*5 = 10 HP.
    {
      const st = spiderRoom();
      st.spiderWebs = [{ x: 400, y: 300, hp: wcfg.maxHp, maxHp: wcfg.maxHp, age: 0 }];
      for (let i = 0; i < 5 * 60; i++) updateSpiderWebs(st, 1 / 60);
      const w = st.spiderWebs[0];
      check(!!w && Math.abs(w.hp - 10) < 0.2, `Abschnitt 66m: Netz-HP nach 5s Zerfall ${w?.hp} statt ~10`);
    }
    // Frisches Netz: genau 2 Treffer mit Spielerschaden 10 zerstoeren es
    // (10 -> 0), 1 Treffer allein NICHT.
    {
      const st = spiderRoom();
      st.spiderWebs = [{ x: 400, y: 300, hp: 20, maxHp: 20, age: 0 }];
      st.bullets.push(createBullet(400, 300, 0, { speed: 0, radius: 26, owner: st.player, damage: 10 }));
      updateSpiderWebs(st, 1 / 60);
      // Toleranz deckt den normalen Zerfall INNERHALB desselben Tick-Aufrufs
      // ab (updateSpiderWebs zieht immer erst decayPerS*dt ab, bevor sie
      // Geschosstreffer prueft) -- der Test prueft die groessenordnungs-
      // maessige HP-Bilanz, nicht eine hundertstel-Pixel-genaue Zahl.
      check(st.spiderWebs.length === 1 && Math.abs(st.spiderWebs[0].hp - 10) < 0.1, `Abschnitt 66m: ein 10-Schaden-Treffer soll das Netz auf ~10 HP bringen, nicht zerstoeren (hp=${st.spiderWebs[0]?.hp})`);
      st.bullets.push(createBullet(400, 300, 0, { speed: 0, radius: 26, owner: st.player, damage: 10 }));
      updateSpiderWebs(st, 1 / 60);
      check(st.spiderWebs.length === 0, 'Abschnitt 66m: ein zweiter 10-Schaden-Treffer zerstoert das frische Netz nicht');
    }
    // Nekromant-Schaden (8): 3 Treffer noetig (8*2=16<20, 8*3=24>=20).
    {
      const st = spiderRoom();
      st.spiderWebs = [{ x: 400, y: 300, hp: 20, maxHp: 20, age: 0 }];
      for (let i = 0; i < 2; i++) {
        st.bullets.push(createBullet(400, 300, 0, { speed: 0, radius: 26, owner: st.player, damage: 8 }));
        updateSpiderWebs(st, 1 / 60);
      }
      check(st.spiderWebs.length === 1, 'Abschnitt 66m: das Netz haelt zwei 8-Schaden-Treffer nicht aus (sollte noch stehen)');
      st.bullets.push(createBullet(400, 300, 0, { speed: 0, radius: 26, owner: st.player, damage: 8 }));
      updateSpiderWebs(st, 1 / 60);
      check(st.spiderWebs.length === 0, 'Abschnitt 66m: ein dritter 8-Schaden-Treffer zerstoert das Netz nicht');
    }
    // Maximale Lebensdauer: nach maxLifeS verschwindet es auch ohne jeden
    // Treffer/Zerfall bis 0.
    {
      const st = spiderRoom();
      st.spiderWebs = [{ x: 400, y: 300, hp: 1000, maxHp: 1000, age: 0 }]; // HP absichtlich hoch, damit nur die Lebensdauer greift
      for (let i = 0; i < Math.ceil(wcfg.maxLifeS * 60) + 5; i++) updateSpiderWebs(st, 1 / 60);
      check(st.spiderWebs.length === 0, 'Abschnitt 66m: das Netz ueberlebt seine maximale Lebensdauer');
    }
  }

  // ---- (n) Netz-Verlangsamung: 50%/1,5s fuer Spieler UND Geist/Champion --
  {
    const { updateSpiderWebs } = await import('../src/game/spider.js');
    const { statusSpeedMult, updateStatus } = await import('../src/game/status.js');
    // Spieler.
    {
      const st = spiderRoom();
      stepState(st, CMD, 1 / 60);
      st.spiderWebs = [{ x: st.player.x, y: st.player.y, hp: 20, maxHp: 20, age: 0 }];
      updateSpiderWebs(st, 1 / 60);
      check(st.spiderWebs.length === 0, 'Abschnitt 66n: das Netz verschwindet nicht sofort bei Beruehrung durch den Spieler');
      check(Math.abs(statusSpeedMult(st, st.player) - 0.5) < 1e-9, `Abschnitt 66n: Spieler-Tempomultiplikator ${statusSpeedMult(st, st.player)} statt 0.5`);
      // Nach 1.5s wieder normal, kurz davor noch verlangsamt.
      for (let i = 0; i < Math.ceil(1.4 * 60); i++) updateStatus(st, 1 / 60);
      check(Math.abs(statusSpeedMult(st, st.player) - 0.5) < 1e-9, 'Abschnitt 66n: die Verlangsamung endet zu frueh (vor 1.5s)');
      for (let i = 0; i < Math.ceil(0.2 * 60); i++) updateStatus(st, 1 / 60);
      check(statusSpeedMult(st, st.player) === 1, 'Abschnitt 66n: die Verlangsamung endet nicht nach 1.5s');
    }
    // Geisterpanzer/Champion -- Abschnitt 19 verlangt ausdruecklich, dass
    // dieselbe Mechanik auch fuer sie ueber ihre TATSAECHLICHE Bewegungs-
    // berechnung wirkt (nicht nur formal im Statusobjekt steht).
    {
      const st = spiderRoom();
      stepState(st, CMD, 1 / 60);
      // t_pink (hunter, Tempo 70) statt t_brown -- t_brown ist "guardian" und
      // bewegt sich als Untertan (erbt seinen Typ komplett) grundsaetzlich
      // NIE, das haette den Bewegungsvergleich unten fuer BEIDE Seiten auf
      // 0 px gebracht und den Test wirkungslos gemacht.
      const g = createGhost(st, 500, 300, 0, 't_pink');
      pushGhost(st, g);
      st.spiderWebs = [{ x: g.x, y: g.y, hp: 20, maxHp: 20, age: 0 }];
      updateSpiderWebs(st, 1 / 60);
      check(st.spiderWebs.length === 0, 'Abschnitt 66n: das Netz verschwindet nicht sofort bei Beruehrung durch einen Geist');
      check(Math.abs(statusSpeedMult(st, g) - 0.5) < 1e-9, `Abschnitt 66n: Geist-Tempomultiplikator ${statusSpeedMult(st, g)} statt 0.5`);
      // Tatsaechliche Bewegung: ein verlangsamter Geist legt in derselben
      // Zeit spuerbar weniger Weg zurueck als ein unverlangsamter.
      g.x = 500;
      g.y = 300;
      g.status.web.timeLeft = 999; // haelt die Verlangsamung fuer diesen Vergleich konstant
      const before = { x: g.x, y: g.y };
      const { updateGhosts } = await import('../src/game/ghost.js');
      for (let i = 0; i < 30; i++) updateGhosts(st, 1 / 60);
      const slowedDist = Math.hypot(g.x - before.x, g.y - before.y);

      const st3 = spiderRoom();
      stepState(st3, CMD, 1 / 60);
      const g2 = createGhost(st3, 500, 300, 0, 't_pink');
      pushGhost(st3, g2);
      const before2 = { x: g2.x, y: g2.y };
      for (let i = 0; i < 30; i++) updateGhosts(st3, 1 / 60);
      const normalDist = Math.hypot(g2.x - before2.x, g2.y - before2.y);
      check(
        normalDist > 0 && slowedDist < normalDist * 0.7,
        `Abschnitt 66n: ein verlangsamter Geist bewegt sich nicht spuerbar langsamer (verlangsamt ${slowedDist.toFixed(2)} px, normal ${normalDist.toFixed(2)} px)`,
      );
    }
  }

  // ---- (o) isBossCfg erkennt den Spinnenboss (keine Wiederbelebung) ------
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    check(isBossCfg(st.spiderBoss.cfg), 'Abschnitt 66o: isBossCfg erkennt t_spider (spiderBoss-Flag) nicht als Boss');
  }

  // ---- (p) Respawn-Fix: der Spielertod darf den Spinnenboss nicht auf ----
  //          seinen urspruenglichen Raum-Spawnpunkt zuruecksetzen. Ueber den
  //          echten, oeffentlichen Weg getestet (Spielertod -> RESPAWN_DELAY
  //          ablaufen lassen -> state.js ruft respawnPlayer() intern selbst
  //          auf), nicht ueber einen direkten Aufruf der nicht exportierten
  //          Funktion.
  {
    const st = spiderRoom();
    stepState(st, CMD, 1 / 60);
    const boss = st.spiderBoss;
    // Versetzt den Boss direkt in die STATIONAERE Phase 3 (statt nur die
    // Koordinaten zu ueberschreiben): in Phase 1/2 verfolgt stepSpiderBoss()
    // JEDEN Tick eigenstaendig den Spieler -- ohne diesen Schritt wuerde
    // der Boss ueber die vielen folgenden stepState()-Ticks unabhaengig
    // vom Respawn-Verhalten weiterlaufen und den Test verfaelschen (er soll
    // exakt nur den EINEN respawnPlayer()-Positions-Reset pruefen).
    boss.spiderLegsAlive = 0;
    boss.spiderPhase = 3;
    boss.x = bcfg.stationaryPos.x;
    boss.y = bcfg.stationaryPos.y;
    boss.cfg.speed = 0;
    const before = { x: boss.x, y: boss.y };
    st.killTank(st.player, 'test');
    check(st.respawnTimer > 0, 'Abschnitt 66p: Testvoraussetzung -- der Spielertod loest keinen Respawn-Timer aus');
    for (let i = 0; i < 90; i++) stepState(st, CMD, 1 / 60); // > RESPAWN_DELAY (1.0s)
    check(st.player.alive, 'Abschnitt 66p: der Spieler ist nach Ablauf des Respawn-Timers nicht wieder am Leben');
    check(
      boss.x === before.x && boss.y === before.y,
      `Abschnitt 66p: der Spieler-Respawn versetzt den Spinnenboss von (${before.x},${before.y}) nach (${boss.x},${boss.y})`,
    );
  }
}

// ---- 67. Amboss (Akt 2) ----------------------------------------------------
// Deckt die sicherheitskritischen Kernpunkte des Amboss-Auftrags ab: die
// Boss-Erkennung (isBossCfg/anvilBoss) samt der dadurch automatisch
// greifenden Nebenwirkungen (kein HP-Doppelscaling, keine Exekution), den
// gezielt wieder eingeschalteten Flanken-/Heckschaden (flankable), das
// Zorn-Ereignispaket-System (Dedupe, Betraege je Art, Geistersalven-
// Buendelung, Sperre waehrend Raserei/Zusammenbruch), den passiven wie
// aktiven Zornabbau samt der 25%-LP-Untergrenze, den Rammstoss (Aussen-
// vs. Innenwand, Zornverlust NUR aussen), den Hammerschlag (sichere Luecke
// vs. Trefferzone), die Schleifspur (Schadenskadenz, kein Betaeuben,
// Verblassen), die Raserei (Ausloesung bei 100 Zorn, exakte Dauer, kein
// Zornverlust an Waenden) und den Zusammenbruch (offene Panzerung, Zorn
// gesperrt, Rueckkehr auf 30/60). Wo sinnvoll mit EIGENEN Zahlen statt der
// echten balance.json-Werte geprueft; wo eine Aussage direkt an einem
// konkreten Balancewert haengt (z. B. "genau 1050 LP"), bewusst gegen den
// echten Wert. Jede Pruefung hier deckt eine Gegenprobe auf echten
// Quellcode ab, die vor dem Merge einzeln lief (s. Abschlussbericht) --
// nicht alle 56 Auftrags-Testschritte einzeln repliziert, sondern die
// sicherheitskritische Teilmenge mit dem hoechsten Fehlerrisiko.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { fireBullet } = await import('../src/game/tank.js');
  const { armorBlocks, flankZone } = await import('../src/game/armor.js');
  const { isBossCfg } = await import('../src/game/cfg.js');
  const acfg = tanksData.balance.boss.anvil;
  const CMD = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  function anvilRoom() {
    return createState(tanksData, tilesData, {
      genRng: () => 0.5,
      enemyTypes: ['t_anvil'],
      aiSeed: 1,
      roomSpec: { fixedLayout: 'boss_anvil' },
      arenas: tanksData.arenas,
      // Akt-2-typischer Skalierungsfaktor -- darf auf den Amboss NICHT
      // wirken (isBossCfg() -> hpScaling.skipBosses), Abschnitt 67b prueft
      // genau das.
      hpScale: 1.55,
      hpSkipBosses: true,
    });
  }
  // Ein Tick, um src/game/anvil.js: initAnvil() (Lazy-Init beim ersten
  // stepAnvilBoss()-Aufruf) auszuloesen, BEVOR ein Test Boss-Felder
  // ueberschreibt -- sonst wuerde der naechste echte Tick die Testwerte
  // wieder zuruecksetzen.
  function initedAnvilRoom() {
    const st = anvilRoom();
    stepState(st, CMD, 1 / 60);
    return st;
  }

  // ---- (a) Struktur: t_anvil, Akt-2-Zuordnung, Arena, Balance-Werte -------
  {
    const t = tanksData.types.t_anvil;
    check(!!t && t.anvilBoss === true, 'Abschnitt 67a: t_anvil fehlt oder traegt kein anvilBoss-Flag');
    check(t.flankable === true, 'Abschnitt 67a: t_anvil traegt kein flankable-Flag');
    check(t.maxHp === 1050, `Abschnitt 67a: t_anvil.maxHp ${t.maxHp} statt 1050`);
    check(t.radius === 18, `Abschnitt 67a: t_anvil.radius ${t.radius} statt 18`);
    check(t.armor?.arc === 140 && t.armor?.reflects === true, 'Abschnitt 67a: t_anvil.armor entspricht nicht {arc:140, reflects:true}');
    check(!t.player, 'Abschnitt 67a: t_anvil ist faelschlich als Spielerklasse markiert');
    check(diffData.acts[1].boss === 'boss_anvil', `Abschnitt 67a: Akt-2-Boss ist "${diffData.acts[1].boss}" statt "boss_anvil"`);
    check(!!tanksData.arenas.boss_anvil, 'Abschnitt 67a: Arena boss_anvil fehlt in arenas.json');
    const grid = tanksData.arenas.boss_anvil.grid;
    check(grid.length === 16 && grid.every((r) => r.length === 24), 'Abschnitt 67a: boss_anvil-Grid ist nicht 24x16');
    const flat = grid.join('');
    check((flat.match(/E/g) || []).length === 1, 'Abschnitt 67a: boss_anvil hat nicht genau einen Gegner-Spawn');
    check((flat.match(/P/g) || []).length === 1, 'Abschnitt 67a: boss_anvil hat nicht genau einen Spieler-Spawn');
    check(!/[dDhHgGmM]/.test(flat), 'Abschnitt 67a: boss_anvil enthaelt zerstoerbare Waende/Loecher/Generatoren/Spiegelwaende');
    check(typeof acfg?.rageMax === 'number' && typeof acfg?.directRage === 'number', 'Abschnitt 67a: balance.boss.anvil fehlt/unvollstaendig');
    check(
      typeof acfg.chargeSpeedMin === 'number' && typeof acfg.chargeSpeedMax === 'number' && typeof acfg.frenzyDurationS === 'number',
      'Abschnitt 67a: balance.boss.anvil fehlt Ramm-/Rasereiwerte',
    );
  }

  // ---- (b) Echter Spawn ueber den Kartengraphen: genau EIN t_anvil, keine -
  //          Unterstuetzung, 1050 LP OHNE Akt-2-hpScaling/bossHpMult --------
  {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, 1);
    run.actIndex = 1;
    run.phase = 'actComplete';
    advanceAct(run); // -> Akt 2
    const bossNode = [...run.map.byId.values()].find((n) => n.isBoss);
    const parent = [...run.map.byId.values()].find((n) => n.next.includes(bossNode.id));
    run.mapCurrentId = parent.id;
    run.phase = 'map';
    chooseMapNode(run, bossNode.id);
    const enemies = run.state.tanks.filter((t) => t !== run.state.player);
    check(enemies.length === 1, `Abschnitt 67b: ${enemies.length} Gegner im Akt-2-Bossraum statt genau 1 (keine Unterstuetzung)`);
    check(enemies[0]?.type === 't_anvil', `Abschnitt 67b: Gegnertyp ist "${enemies[0]?.type}" statt "t_anvil"`);
    check(enemies[0].cfg.maxHp === 1050, `Abschnitt 67b: Akt-2-Amboss hat ${enemies[0].cfg.maxHp} LP statt genau 1050 (Akt-2-Skalierung wurde faelschlich angewendet)`);
    check(isBossCfg(enemies[0].cfg), 'Abschnitt 67b: isBossCfg() erkennt den echten Akt-2-Amboss nicht als Boss');
  }

  // ---- (c) isBossCfg()/resolveCfg(): das anvilBoss-Flag allein macht den --
  //          Boss-Status aus, unabhaengig von den anderen drei Boss-Feldern -
  {
    check(isBossCfg({ anvilBoss: true }), 'Abschnitt 67c: isBossCfg() erkennt ein isoliertes anvilBoss:true nicht');
    check(!isBossCfg({ anvilBoss: false }), 'Abschnitt 67c: isBossCfg() haelt anvilBoss:false faelschlich fuer einen Boss');
    check(!isBossCfg(null) && !isBossCfg(undefined), 'Abschnitt 67c: isBossCfg() crasht/irrt bei fehlendem cfg');
  }

  // ---- (d) Exekution bleibt vollstaendig deaktiviert (Grundsteinumbau -----
  //          Phase 2s bestehende Bossausnahme greift automatisch ueber
  //          isBossCfg(), OHNE eigenen Sonderfall fuer den Amboss). ---------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.hp = 1; // weit unter jeder denkbaren Exekutionsschwelle
    boss.mode = 'restart';
    boss.modeTimer = 999; // eingefroren, keine Bewegung/Angriffe waehrend der Pruefung
    stepState(st, CMD, 1 / 60);
    check(boss.executing !== true, 'Abschnitt 67d: der Amboss geraet trotz Bossausnahme in den Exekutionszustand');
  }

  // ---- (e) Flanken-/Heckschaden: "flankable" schaltet die sonst fuer ------
  //          Bosse ausgeschlossene Mechanik GEZIELT wieder ein; Front -------
  //          bleibt die 140-Grad-Panzerung (reflektiert, kein Schaden). -----
  {
    check(
      flankZone({ x: 0, y: 0, heading: 0 }, 10, 0, tanksData.balance.flank) === 'front',
      'Abschnitt 67e: Testvoraussetzung -- flankZone() liefert fuer einen Fronttreffer nicht "front"',
    );
    const bossLikeCfg = { armor: { arc: 140, reflects: true }, radius: 18, maxHp: 9999, anvilBoss: true, flankable: true };
    // Fronttreffer (innerhalb der 140-Grad-Panzerung): armorBlocks() haelt
    // ihn an, unabhaengig von flankable.
    check(
      armorBlocks({ x: 0, y: 0, heading: 0, cfg: bossLikeCfg, armorDisabled: false }, { x: 5, y: 0 }) === true,
      'Abschnitt 67e: ein Fronttreffer wird trotz 140-Grad-Panzerung nicht geblockt',
    );
    // Seiten-/Hecktreffer (ausserhalb 140 Grad = ausserhalb ±70 Grad):
    // armorBlocks() laesst sie durch, flankZone() klassifiziert sie danach
    // wie bei jedem normalen Gegner.
    check(
      armorBlocks({ x: 0, y: 0, heading: 0, cfg: bossLikeCfg, armorDisabled: false }, { x: -5, y: 6 }) === false,
      'Abschnitt 67e: ein Heck-nahnaher Treffer (ausserhalb der 140-Grad-Panzerung) wird faelschlich geblockt',
    );
    check(
      flankZone({ x: 0, y: 0, heading: 0 }, -10, 0, tanksData.balance.flank) === 'rear',
      'Abschnitt 67e: ein Hecktreffer wird nicht als "rear" klassifiziert',
    );
    // Zusammenbruch: armorDisabled hebt den Frontblock generisch auf --
    // derselbe Fronttreffer nimmt jetzt normalen Schaden statt zu reflektieren.
    check(
      armorBlocks({ x: 0, y: 0, heading: 0, cfg: bossLikeCfg, armorDisabled: true }, { x: 5, y: 0 }) === false,
      'Abschnitt 67e: armorDisabled (Zusammenbruch) hebt den Frontblock nicht auf',
    );
  }

  // ---- (f) Zorn-Ereignispaket-System: Dedupe, Betraege je Art, Geister- ---
  //          salven-Buendelung, vollstaendige Sperre waehrend rageLocked. --
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.rage = 0;
    boss.processedRageEvents = new Set();
    boss.lastGhostRageAt = null;
    boss.rageLocked = false;

    st.registerAnvilRage('direct', 'evt1');
    check(boss.rage === acfg.directRage, `Abschnitt 67f: direct-Ereignis gibt ${boss.rage} Zorn statt directRage (${acfg.directRage})`);
    st.registerAnvilRage('direct', 'evt1'); // dieselbe id -- Dedupe
    check(boss.rage === acfg.directRage, 'Abschnitt 67f: dieselbe Ereigniskennung wird ein zweites Mal gezaehlt (Dedupe fehlt)');
    st.registerAnvilRage('explosion', 'evt2');
    check(boss.rage === acfg.directRage + acfg.explosionRage, `Abschnitt 67f: explosion-Ereignis addiert nicht explosionRage (${acfg.explosionRage})`);

    // Geistersalven-Buendelung: zwei GETRENNTE Salven-ids innerhalb des
    // Zeitfensters zaehlen zusammen nur EINMAL ghostVolleyRage.
    const beforeGhost = boss.rage;
    st.registerAnvilRage('ghost', 'gsalve1');
    check(boss.rage === beforeGhost + acfg.ghostVolleyRage, 'Abschnitt 67f: erste Geistersalve traegt nicht ghostVolleyRage bei');
    const afterFirstGhost = boss.rage;
    st.registerAnvilRage('ghost', 'gsalve2'); // andere id, aber im Buendel-Fenster
    check(boss.rage === afterFirstGhost, 'Abschnitt 67f: eine zweite Geistersalve im Buendel-Fenster traegt zusaetzlichen Zorn bei');
    // Ausserhalb des Buendel-Fensters zaehlt die naechste Salve wieder voll.
    st.time += (acfg.ghostBatchS ?? 0.25) + 0.01;
    const beforeThirdGhost = boss.rage;
    st.registerAnvilRage('ghost', 'gsalve3');
    check(boss.rage === beforeThirdGhost + acfg.ghostVolleyRage, 'Abschnitt 67f: eine Geistersalve NACH dem Buendel-Fenster zaehlt nicht wieder voll');

    // Sperre waehrend Raserei/Zusammenbruch: kein Zuwachs, egal welche Art.
    boss.rageLocked = true;
    const beforeLocked = boss.rage;
    st.registerAnvilRage('direct', 'evtLocked');
    check(boss.rage === beforeLocked, 'Abschnitt 67f: rageLocked verhindert den Zornaufbau nicht');
  }

  // ---- (g) rageEventId: alle Kugeln EINES Abzugs (Doppelrohr) teilen -----
  //          sich eine Kennung, ZWEI Abzuege bekommen unterschiedliche. -----
  {
    const st = initedAnvilRoom();
    const p = st.player;
    p.cfg = { ...p.cfg, twinShot: true, twinSpreadRad: 0.05, magazine: 20, fireCooldown: 0 };
    p.cooldown = 0;
    st.bullets.length = 0;
    fireBullet(p, st);
    check(st.bullets.length === 2, `Abschnitt 67g: Doppelrohr-Abzug erzeugt ${st.bullets.length} Kugeln statt 2`);
    const [b1, b2] = st.bullets;
    check(!!b1.rageEventId && b1.rageEventId === b2.rageEventId, 'Abschnitt 67g: die beiden Doppelrohr-Kugeln teilen sich keine rageEventId');
    p.cooldown = 0;
    fireBullet(p, st);
    const b3 = st.bullets[st.bullets.length - 1];
    check(b3.rageEventId !== b1.rageEventId, 'Abschnitt 67g: ein ZWEITER Abzug bekommt dieselbe rageEventId wie der erste');
  }

  // ---- (h) Explosive Kugel + ihre Explosion sind EIN Paket (+explosionRage,
  //          NICHT +directRage obendrauf) -- Kontakt von HINTEN (ausserhalb
  //          der 140-Grad-Panzerung), damit der Reflex nicht dazwischenfunkt.
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.mode = 'inner_crash';
    boss.modeTimer = 999; // eingefroren -- Heading/Position bleiben stabil
    boss.heading = 0;
    boss.rage = 0;
    boss.processedRageEvents = new Set();
    boss.rageLocked = false;
    st.bullets.length = 0;
    const b = createBullet(boss.x - (boss.cfg.radius + 2), boss.y, Math.PI, {
      speed: 0, radius: 4, owner: st.player, kind: 'bullet', damage: 10,
      explosive: true, explosionRadius: 60, rageEventId: 'evtExpl',
    });
    st.bullets.push(b);
    stepState(st, CMD, 1 / 60);
    check(boss.rage === acfg.explosionRage, `Abschnitt 67h: eine explosive Kugel + ihre Explosion geben ${boss.rage} Zorn statt genau explosionRage (${acfg.explosionRage})`);
  }

  // ---- (i) Mine gibt +explosionRage (eigene, stabile Kennung ueber die ----
  //          Minen-id). -----------------------------------------------------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.rage = 0;
    boss.processedRageEvents = new Set();
    boss.rageLocked = false;
    const mcfg = tanksData.mine;
    const m = createMine(boss.x, boss.y, st.player, mcfg.radiusPx);
    m.age = mcfg.armDelayS; // scharf
    st.mines.length = 0;
    st.mines.push(m);
    updateMines(st, 1 / 60);
    check(boss.rage === acfg.explosionRage, `Abschnitt 67i: eine Mine gibt ${boss.rage} Zorn statt explosionRage (${acfg.explosionRage})`);
  }

  // ---- (j) Zornabbau: 2s Karenz, dann 5/s -- MIT DEN ECHTEN balance.json- -
  //          Werten (die Aussage haengt an genau diesen Zahlen). -----------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.rage = 50;
    boss.rageLocked = false;
    boss.mode = 'between_attacks';
    boss.modeTimer = 999; // eingefroren, kein Angriffswechsel waehrend der Pruefung
    boss.lastRageEventAt = st.time;
    const grace = acfg.coolingDelayS ?? 2;
    let elapsed = 0;
    const dt = 1 / 60;
    while (elapsed < grace - 0.05) { stepState(st, CMD, dt); elapsed += dt; }
    check(Math.abs(boss.rage - 50) < 0.5, `Abschnitt 67j: Zorn faellt VOR Ablauf der Karenz (${grace}s) bereits auf ${boss.rage}`);
    while (elapsed < grace + 0.3) { stepState(st, CMD, dt); elapsed += dt; }
    check(boss.rage < 50, `Abschnitt 67j: Zorn faellt nach Ablauf der Karenz nicht (noch ${boss.rage})`);
    const expected = 50 - (acfg.coolingPerS ?? 5) * (elapsed - grace);
    check(Math.abs(boss.rage - expected) < 0.6, `Abschnitt 67j: Zornabbau-Rate stimmt nicht (${boss.rage} statt ~${expected.toFixed(2)})`);
  }

  // ---- (k) Unter 25% Boss-LP faellt der Zorn (weder passiv noch aktiv) ----
  //          nie unter lowHpMinRage. -----------------------------------------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.hp = boss.cfg.maxHp * 0.2; // unter der 25%-Schwelle
    boss.rage = 80;
    boss.rageLocked = false;
    boss.mode = 'between_attacks';
    boss.modeTimer = 999;
    boss.lastRageEventAt = -1e9; // Karenz laengst abgelaufen -- Abbau setzt sofort ein
    for (let i = 0; i < 600; i++) stepState(st, CMD, 1 / 60); // 10s
    check(boss.rage === acfg.lowHpMinRage, `Abschnitt 67k: Zorn faellt unter 25% LP auf ${boss.rage} statt auf lowHpMinRage (${acfg.lowHpMinRage}) geklemmt zu bleiben`);
  }

  // ---- (l) Rammstoss: Aussenwand-Aufprall zieht outerImpactRageLoss ab ----
  //          UND oeffnet ein 1,65s-Schadensfenster; Innenwand-Aufprall ------
  //          zieht KEINEN Zorn ab und ist nur eine kurze Pause. --------------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.rage = 80;
    boss.rageLocked = false;
    boss.hp = boss.cfg.maxHp; // volle LP -- lowHpMinRage-Untergrenze greift nicht
    boss.mode = 'charge';
    boss.chargeDir = -Math.PI / 2; // "nach oben", Boss-Spawn (boss_anvil) liegt in Reihe 1 direkt unter der Aussenwand
    boss.chargeHitTargets = new Set();
    // Karenz-Reset: initedAnvilRoom() hinterlaesst lastRageEventAt bei
    // -1e9 (initAnvil()) -- ohne diesen Reset wuerde der passive Zornabbau
    // waehrend der (kurzen) Fahrt zur Wand bereits mitzaehlen und die
    // gemessene outer_crash-Differenz um ein paar Hundertstel verfaelschen.
    boss.lastRageEventAt = st.time;
    let ticks = 0;
    while (boss.mode === 'charge' && ticks < 300) { stepState(st, CMD, 1 / 60); ticks++; }
    check(boss.mode === 'outer_crash', `Abschnitt 67l: Testaufbau -- Boss landete in Modus "${boss.mode}" statt "outer_crash" (nach ${ticks} Ticks)`);
    check(boss.rage === 80 - acfg.outerImpactRageLoss, `Abschnitt 67l: Aussenwand-Aufprall zieht ${80 - boss.rage} Zorn ab statt outerImpactRageLoss (${acfg.outerImpactRageLoss})`);
    check(Math.abs(boss.modeTimer - acfg.outerCrashS) < 0.02, `Abschnitt 67l: outer_crash startet nicht mit outerCrashS (${acfg.outerCrashS}) Restzeit`);

    // Innenwand-Gegenprobe: derselbe Mechanismus, aber ein Block IM RAUM
    // (statt der Aussenwand) darf KEINEN Zorn abziehen.
    const st2 = initedAnvilRoom();
    const boss2 = st2.anvilBoss;
    boss2.rage = 80;
    boss2.rageLocked = false;
    boss2.hp = boss2.cfg.maxHp;
    boss2.x = 5 * 32 + 16; // vor dem ersten 2x2-Innenblock (boss_anvil-Grid, Spalten 5-6/Zeile 4-5)
    boss2.y = 3 * 32 + 16;
    boss2.mode = 'charge';
    boss2.chargeDir = Math.PI / 2; // "nach unten", direkt in den Innenblock
    boss2.chargeHitTargets = new Set();
    boss2.lastRageEventAt = st2.time; // s. Karenz-Reset-Kommentar oben
    let ticks2 = 0;
    while (boss2.mode === 'charge' && ticks2 < 300) { stepState(st2, CMD, 1 / 60); ticks2++; }
    check(boss2.mode === 'inner_crash', `Abschnitt 67l: Testaufbau -- Boss2 landete in Modus "${boss2.mode}" statt "inner_crash" (nach ${ticks2} Ticks)`);
    check(boss2.rage === 80, `Abschnitt 67l: eine Innenwand zieht Zorn ab (${80 - boss2.rage}), erlaubt sind 0`);
    check(Math.abs(boss2.modeTimer - acfg.innerCrashS) < 0.02, `Abschnitt 67l: inner_crash startet nicht mit innerCrashS (${acfg.innerCrashS}) Restzeit`);
  }

  // ---- (m) Hammerschlag: sichere Luecke schuetzt, die Trefferzone trifft --
  //          (mit Betaeubung); ein eingefrorener Modus laesst NUR die -------
  //          modusunabhaengige Schockwellen-Aktualisierung laufen. ----------
  {
    function slamRoom() {
      const st = initedAnvilRoom();
      const boss = st.anvilBoss;
      boss.mode = 'restart'; // eingefroren: keine Bewegung, kein neuer Angriff, kein Zorn-Tick
      boss.modeTimer = 999;
      boss.rage = 0;
      boss.rageLocked = false;
      boss.heading = 0;
      // Arena-Mitte statt des originalen Spawnpunkts (Reihe 1, direkt unter
      // der Aussenwand) -- sonst liegt eine der beiden 100px-Testpositionen
      // ausserhalb des Raums und eine Sichtlinienpruefung schlaegt aus dem
      // falschen Grund fehl (Testaufbau-Falle, nicht der echte Mechanismus).
      boss.x = 384;
      boss.y = 256;
      st.anvilShockwaves.length = 0;
      st.anvilShockwaves.push({ x: boss.x, y: boss.y, heading: 0, radius: 0, hitTargets: new Set() });
      return st;
    }
    // Sichere Luecke: direkt "hinter" dem Boss (heading + PI + Offset 0).
    {
      const st = slamRoom();
      const boss = st.anvilBoss;
      st.player.x = boss.x - 100;
      st.player.y = boss.y;
      st.player.hp = 999;
      st.player.protect = 0;
      let ticks = 0;
      while (st.anvilShockwaves.length && ticks < 120) { stepState(st, CMD, 1 / 60); ticks++; }
      check(st.player.hp === 999, `Abschnitt 67m: eine sichere Schockwellen-Luecke traf den Spieler trotzdem (hp ${st.player.hp})`);
    }
    // Trefferzone: 90 Grad neben der Luecke, deutlich ausserhalb von deren
    // halber Breite (shockwaveGapDeg/2).
    {
      const st = slamRoom();
      const boss = st.anvilBoss;
      st.player.x = boss.x;
      st.player.y = boss.y - 100;
      st.player.hp = 999;
      st.player.protect = 0;
      let ticks = 0;
      // Sofort abbrechen, sobald der Treffer passiert ist -- shockwaveStunS
      // ist kurz und zaehlt in den Folgeticks (die Welle laeuft noch bis
      // shockwaveMaxRadiusPx weiter) sonst laengst wieder auf 0 herunter,
      // bevor die Pruefung unten sie noch sehen koennte.
      while (st.player.hp === 999 && st.anvilShockwaves.length && ticks < 120) { stepState(st, CMD, 1 / 60); ticks++; }
      check(st.player.hp === 999 - acfg.shockwaveDamage, `Abschnitt 67m: die Trefferzone einer Schockwelle schadet ${999 - st.player.hp} statt shockwaveDamage (${acfg.shockwaveDamage})`);
      check(st.player.stunTimer > 0, 'Abschnitt 67m: ein Schockwellentreffer betaeubt nicht');
    }
  }

  // ---- (n) Schleifspur: Schadenskadenz statt Dauerschaden, keine Betaeu- -
  //          bung, sichtbares Verblassen vor dem Entfernen. ------------------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.mode = 'restart'; // eingefroren -- nur die modusunabhaengige Spur-Aktualisierung laeuft
    boss.modeTimer = 999;
    boss.rage = 0;
    boss.rageLocked = false;
    st.anvilTrails.length = 0;
    st.player.x = 400;
    st.player.y = 300;
    st.player.hp = 999;
    st.player.protect = 0;
    st.anvilTrails.push({ x: st.player.x, y: st.player.y, hitAt: new Map(), expireAt: null });
    stepState(st, CMD, 1 / 60);
    check(st.player.hp === 999 - acfg.trailDamage, `Abschnitt 67n: erster Spur-Tick schadet ${999 - st.player.hp} statt trailDamage (${acfg.trailDamage})`);
    const afterFirst = st.player.hp;
    check(!(st.player.stunTimer > 0), 'Abschnitt 67n: die Schleifspur betaeubt (soll sie laut Auftrag nicht)');
    stepState(st, CMD, 1 / 60); // deutlich vor Ablauf von trailDamageIntervalS
    check(st.player.hp === afterFirst, `Abschnitt 67n: die Spur schadet erneut vor Ablauf der Kadenz (trailDamageIntervalS ${acfg.trailDamageIntervalS})`);
    // Verblassen: ein gesetztes expireAt entfernt das Segment erst NACH
    // Ablauf, nicht sofort.
    st.anvilTrails[0].expireAt = st.time + 0.05;
    stepState(st, CMD, 1 / 60);
    check(st.anvilTrails.length === 1, 'Abschnitt 67n: ein Segment verschwindet, bevor seine expireAt-Zeit erreicht ist');
    for (let i = 0; i < 10; i++) stepState(st, CMD, 1 / 60);
    check(st.anvilTrails.length === 0, 'Abschnitt 67n: ein abgelaufenes Segment wird nicht entfernt');
  }

  // ---- (o) Raserei bei 100 Zorn: sauberer Abbruch des laufenden Angriffs, -
  //          Gefahrenobjekte werden geleert, Zorn wird gesperrt. -----------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.mode = 'slam'; // ein "laufender Angriff", der abgebrochen werden muss
    boss.modeTimer = 5;
    boss.rage = acfg.rageMax ?? 100;
    boss.rageLocked = false;
    st.anvilShockwaves = [{ x: 0, y: 0, heading: 0, radius: 10, hitTargets: new Set() }];
    st.anvilTrails = [{ x: 0, y: 0, hitAt: new Map(), expireAt: null }];
    const before = st.anvilFrenzyCount || 0;
    stepState(st, CMD, 1 / 60);
    check(boss.mode === 'frenzy_warning', `Abschnitt 67o: 100 Zorn fuehrt nicht sofort in "frenzy_warning" (Modus ist "${boss.mode}")`);
    check(boss.rageLocked === true, 'Abschnitt 67o: die Raserei sperrt den Zorn nicht');
    check(st.anvilShockwaves.length === 0 && st.anvilTrails.length === 0, 'Abschnitt 67o: laufende Gefahrenobjekte werden beim Rasereistart nicht geleert');
    check((st.anvilFrenzyCount || 0) === before + 1, 'Abschnitt 67o: anvilFrenzyCount zaehlt den Rasereistart nicht');
  }

  // ---- (p) Raserei dauert exakt frenzyDurationS; ein Wandkontakt WAEHREND -
  //          der Raserei zieht KEINEN Zorn ab (anders als ein normaler ------
  //          Aussenwand-Aufprall in (l)). ------------------------------------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.rage = acfg.rageMax ?? 100;
    boss.rageLocked = true;
    boss.mode = 'frenzy_charge';
    boss.modeTimer = 0;
    boss.frenzyRemaining = acfg.frenzyDurationS ?? 5;
    boss.chargeDir = -Math.PI / 2; // treibt den Boss (Spawn nahe der Aussenwand) sofort in einen Wandkontakt
    boss.chargeHitTargets = new Set();
    let simulated = 0;
    let hitWallOnce = false;
    let ticks = 0;
    while (boss.mode !== 'overheated' && ticks < 700) {
      const before = boss.mode;
      stepState(st, CMD, 1 / 60);
      simulated += 1 / 60;
      if (before === 'frenzy_charge' && boss.mode === 'frenzy_turnaround') hitWallOnce = true;
      ticks++;
    }
    check(hitWallOnce, 'Abschnitt 67p: Testaufbau -- die Raserei traf waehrend der Simulation keine Wand');
    check(boss.mode === 'overheated', `Abschnitt 67p: Raserei endet nicht in "overheated" (Modus "${boss.mode}" nach ${ticks} Ticks)`);
    check(boss.rage === (acfg.rageMax ?? 100), `Abschnitt 67p: der Zorn faellt waehrend der Raserei auf ${boss.rage} (Wandkontakte duerfen ihn NICHT senken)`);
    const total = (acfg.frenzyWarningS ?? 0) + (acfg.frenzyDurationS ?? 5);
    check(
      Math.abs(simulated - (acfg.frenzyDurationS ?? 5)) < 0.15,
      `Abschnitt 67p: die simulierte Rasereidauer (ab frenzy_charge) betraegt ${simulated.toFixed(2)}s, erwartet ~${(acfg.frenzyDurationS ?? 5).toFixed(2)}s`,
    );
    void total;
  }

  // ---- (q) Zusammenbruch: offene Panzerung genau overheatedS lang, Zorn --
  //          bleibt gesperrt, danach Rueckkehr auf rageAfterOverheat (bzw. --
  //          lowHpMinRage bei niedriger Boss-LP). ---------------------------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    boss.hp = boss.cfg.maxHp; // volle LP -- rageAfterOverheat, NICHT lowHpMinRage, wird erwartet
    boss.mode = 'overheated';
    boss.modeTimer = acfg.overheatedS ?? 3.5;
    boss.armorDisabled = true;
    boss.rage = acfg.rageMax ?? 100;
    boss.rageLocked = true;
    let elapsed = 0;
    const dt = 1 / 60;
    while (elapsed < (acfg.overheatedS ?? 3.5) - 0.05) {
      stepState(st, CMD, dt);
      elapsed += dt;
      check(boss.armorDisabled === true, 'Abschnitt 67q: die Panzerung reaktiviert sich VOR Ablauf von overheatedS');
      check(boss.rage === (acfg.rageMax ?? 100), 'Abschnitt 67q: der Zorn aendert sich waehrend des Zusammenbruchs');
    }
    while (boss.armorDisabled) stepState(st, CMD, dt);
    check(boss.rage === (acfg.rageAfterOverheat ?? 0), `Abschnitt 67q: Zorn nach dem Zusammenbruch ist ${boss.rage} statt rageAfterOverheat (${acfg.rageAfterOverheat})`);
    check(boss.mode === 'restart', `Abschnitt 67q: nach der Reaktivierung ist der Modus "${boss.mode}" statt "restart"`);

    // Gegenprobe bei niedriger Boss-LP: rageAfterOverheat wird durch
    // lowHpMinRage ERSETZT, nicht ergaenzt.
    const st2 = initedAnvilRoom();
    const boss2 = st2.anvilBoss;
    boss2.hp = boss2.cfg.maxHp * 0.1; // deutlich unter 25%
    boss2.mode = 'overheated';
    boss2.modeTimer = acfg.overheatedS ?? 3.5;
    boss2.armorDisabled = true;
    boss2.rage = acfg.rageMax ?? 100;
    boss2.rageLocked = true;
    while (boss2.armorDisabled) stepState(st2, CMD, dt);
    check(boss2.rage === (acfg.lowHpMinRage ?? 0), `Abschnitt 67q: Zorn nach Zusammenbruch bei niedriger LP ist ${boss2.rage} statt lowHpMinRage (${acfg.lowHpMinRage})`);
  }

  // ---- (r) Der Amboss feuert nie eine echte Kugel -------------------------
  {
    const st = initedAnvilRoom();
    st.player.x = st.anvilBoss.x + 40; // nah am Boss, damit ein etwaiger Schuss nicht am Kegel scheitert
    st.player.y = st.anvilBoss.y;
    for (let i = 0; i < 400; i++) stepState(st, CMD, 1 / 60);
    check(!st.bullets.some((b) => b.owner === st.anvilBoss), 'Abschnitt 67r: der Amboss hat eine echte Kugel abgefeuert');
  }

  // ---- (s) Boss-Tod raeumt Schockwellen/Schleifspuren restlos auf ---------
  {
    const st = initedAnvilRoom();
    const boss = st.anvilBoss;
    st.anvilShockwaves = [{ x: 0, y: 0, heading: 0, radius: 10, hitTargets: new Set() }];
    st.anvilTrails = [{ x: 0, y: 0, hitAt: new Map(), expireAt: null }];
    st.killTank(boss, 'test');
    check(st.anvilShockwaves.length === 0, 'Abschnitt 67s: der Boss-Tod raeumt state.anvilShockwaves nicht');
    check(st.anvilTrails.length === 0, 'Abschnitt 67s: der Boss-Tod raeumt state.anvilTrails nicht');
    check(typeof st.anvilFightDuration === 'number', 'Abschnitt 67s: anvilFightDuration wird beim Boss-Tod nicht gesetzt (Telemetrie)');
  }
}

// ---- 68. Bugfix: "non-finite ab Mitte Akt 2" (NaN-Kugeltempo) ------------
// Nutzermeldung: "TypeError: The provided value is non-finite" aus dem
// Renderpfad, reproduzierbar ab Mitte Akt 2. Ursache war KEIN Renderfehler,
// sondern eine Datenluecke: t_green traegt seit Grundsteinumbau Phase 3
// weapon:"mortar", die Tabelle data/tanks.json: bulletSpeeds kannte aber nur
// bullet/rocket. cfg.js: resolveCfg() loeste cfg.bulletSpeed damit still zu
// `undefined` auf. Fuer t_green als GEGNER blieb das folgenlos (er feuert
// ueber mortar.js: fireMortar() und liest das Feld nie) -- ein vom
// Nekromanten uebernommener t_green-Untertan feuert dagegen als NORMALER
// Schuetze (ghost.js: updateGhosts()) und rechnete damit `undefined * Faktor`
// = NaN. Die NaN-Kugel wanderte durch die Physik, bis sie in isSolid()
// (grid[NaN]) bzw. im Renderer (ctx.arc(NaN, ...)) aufflog. "Ab Mitte Akt 2"
// ist exakt difficulty.json: danger.t_green.unlockAct 2 / unlockRoomInAct 4.
//
// Geprueft wird die ganze Kette mit EIGENEN Zahlen bzw. ueber alle Typen --
// nicht nur der eine reparierte Wert -- damit ein kuenftiger neuer
// Waffenwert dieselbe Falle nicht wiederholen kann. Zusaetzlich wirft der
// Fake-Canvas (tests/domstub.mjs) seit diesem Fix bei non-finite Argumenten
// wie ein echter Browser, wodurch JEDER bestehende Renderpfad-Test die
// Fehlerklasse ab sofort mitbewacht.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createGhost, pushGhost } = await import('../src/game/ghost.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');

  // (a) Struktur: JEDER in types[].weapon vorkommende Wert hat einen echten
  //     Eintrag in bulletSpeeds (oder einen typeigenen bulletSpeed-Override).
  //     Genau diese Zusicherung fehlte -- der cfg.js-Rueckfall haelt das Spiel
  //     zwar spielbar, soll die Luecke aber nicht verstecken.
  {
    const bs = tanksData.bulletSpeeds;
    for (const [id, t] of Object.entries(tanksData.types)) {
      if (!t || typeof t !== 'object' || !t.weapon) continue;
      check(
        t.bulletSpeed !== undefined || typeof bs[t.weapon] === 'number',
        `Abschnitt 68a: ${id} hat weapon "${t.weapon}", aber weder einen eigenen bulletSpeed noch einen bulletSpeeds-Eintrag`,
      );
    }
  }

  // (b) resolveCfg(): kein Typ loest zu einem nicht-finiten bulletSpeed auf.
  {
    for (const id of Object.keys(tanksData.types)) {
      const t = tanksData.types[id];
      if (!t || typeof t !== 'object' || !t.weapon) continue;
      const cfg = resolveCfg(tanksData, id);
      check(
        Number.isFinite(cfg.bulletSpeed),
        `Abschnitt 68b: resolveCfg("${id}").bulletSpeed ist ${cfg.bulletSpeed} statt einer endlichen Zahl`,
      );
    }
  }

  // (c) Der eigentliche Fehlerpfad: ein UEBERNOMMENER Untertan jedes
  //     Gegnertyps muss durchweg endliche Werte haben. Ueber ALLE Typen, nicht
  //     nur t_green -- ein neuer Gegnertyp mit exotischer Waffe faellt damit
  //     sofort auf.
  {
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
    const FELDER = ['maxHp', 'damage', 'speed', 'fireCooldown', 'bulletSpeed', 'fireRangePx', 'radius'];
    for (const id of Object.keys(tanksData.types)) {
      const t = tanksData.types[id];
      if (!t || typeof t !== 'object' || t.player || !t.weapon) continue;
      const g = createGhost(st, 200, 200, 0, id);
      for (const f of FELDER) {
        check(
          typeof g.cfg[f] !== 'number' || Number.isFinite(g.cfg[f]),
          `Abschnitt 68c: Untertan vom Typ ${id} hat cfg.${f} = ${g.cfg[f]} (nicht endlich)`,
        );
      }
    }
  }

  // (d) Mechanismus mit EIGENEN Zahlen: ein kuenstlicher, in bulletSpeeds
  //     unbekannter Waffenwert darf NICHT mehr zu undefined/NaN aufloesen
  //     (cfg.js-Rueckfall), sondern faellt auf das normale Kugeltempo zurueck.
  {
    const daten = {
      ...tanksData,
      bulletSpeeds: { bullet: 42, rocket: 99 },
      types: { ...tanksData.types, t_testwaffe: { ...tanksData.types.t_brown, weapon: 'gibtsnicht' } },
    };
    const cfg = resolveCfg(daten, 't_testwaffe');
    check(
      cfg.bulletSpeed === 42,
      `Abschnitt 68d: unbekannter Waffenwert loest zu ${cfg.bulletSpeed} auf statt auf den bullet-Rueckfall (42)`,
    );
  }

  // (e) End-zu-Ende ueber den ECHTEN Weg: ein t_green-Untertan feuert, die
  //     Kugel hat endliche Geschwindigkeit UND Position, und der Raum laesst
  //     sich danach ohne Absturz weitersimulieren (vor dem Fix starb
  //     stepState() an isSolid(NaN) bzw. der Renderer an ctx.arc(NaN)).
  {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: ['t_pink'],
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
      actEnemyPool: ['t_green'],
    });
    st.bullets.length = 0;
    const ziel = st.tanks.find((t) => t !== st.player && t.alive);
    check(!!ziel, 'Abschnitt 68e: Testaufbau -- kein Gegner im Raum');
    // Untertan vom Mörsertyp direkt neben dem Ziel, damit er zuverlaessig feuert.
    const g = createGhost(st, ziel.x - 40, ziel.y, 0, 't_green');
    pushGhost(st, g);
    check(
      Number.isFinite(g.cfg.bulletSpeed),
      `Abschnitt 68e: t_green-Untertan hat cfg.bulletSpeed ${g.cfg.bulletSpeed} (nicht endlich)`,
    );
    const CMD = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
    let geistKugeln = 0;
    for (let i = 0; i < 240; i++) {
      stepState(st, CMD, 1 / 60);
      for (const b of st.bullets) {
        if (b.owner !== g) continue;
        geistKugeln++;
        check(
          Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy),
          `Abschnitt 68e: Geisterkugel hat nicht-endliche Werte (x=${b.x} y=${b.y} vx=${b.vx} vy=${b.vy})`,
        );
      }
      for (const t of st.tanks) {
        check(
          Number.isFinite(t.x) && Number.isFinite(t.y),
          `Abschnitt 68e: Panzer ${t.type} hat nicht-endliche Position (${t.x}/${t.y})`,
        );
      }
    }
    check(geistKugeln > 0, 'Abschnitt 68e: Testaufbau -- der t_green-Untertan hat in 4 s keine einzige Kugel abgefeuert');
  }

  // (f) Der strengere Fake-Canvas (domstub.mjs) fangt non-finite Argumente
  //     jetzt wirklich -- ohne diese Zusicherung koennte der Stub spaeter
  //     unbemerkt wieder alles schlucken und die ganze Renderpfad-Abdeckung
  //     der Suite waere still wertlos (genau der blinde Fleck, an dem dieser
  //     Bug vorbeigelaufen ist).
  {
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    let warf = false;
    try {
      const c = document.createElement('canvas').getContext('2d');
      c.arc(NaN, 10, 5, 0, Math.PI * 2);
    } catch {
      warf = true;
    }
    let warfNichtBeiOk = false;
    try {
      const c = document.createElement('canvas').getContext('2d');
      c.arc(10, 10, 5, 0, Math.PI * 2);
    } catch {
      warfNichtBeiOk = true;
    }
    restore();
    check(warf, 'Abschnitt 68f: der Fake-Canvas schluckt ctx.arc(NaN, ...) still -- der Renderpfad-Schutz ist wirkungslos');
    check(!warfNichtBeiOk, 'Abschnitt 68f: der Fake-Canvas wirft bei GUELTIGEN Argumenten (Fehlalarm)');
  }
}

// ---- 69. Gegner-Umbau Phase G1 (UMBAUPLAN-GEGNER.md): Fundament ---------
// Fuenf Bausteine, KEIN neuer Gegner -- die Abnahme ist ausdruecklich
// "im Spiel nichts sichtbar anders" (Determinismusprobe oben unveraendert,
// gleiche Raumzahlen wie vor dieser Phase). Dieser Abschnitt prueft nur die
// neu gebaute Infrastruktur selbst, mit EIGENEN synthetischen Werten statt
// der aktuellen tanks.json-Datenlage (die setzt noch keins der 16 neuen
// Felder) -- sonst waere der Test bei einer vergessenen Whitelist-Zeile
// trivial gruen (Falle 1 aus dem Bauplan).
{
  // (a) Baustein E/D (Whitelist): jedes der 16 neuen Gegnerfelder kommt aus
  // einem synthetischen Typ unveraendert im aufgeloesten cfg an.
  {
    const synthType = 'zzz_g1_whitelist_test';
    const neueFelder = {
      spreadCount: 7,
      spreadRad: 0.33,
      burstRangePx: 210,
      charge: { windupS: 1.3, lockAtS: 0.4 },
      heal: { ratePerS: 6, rangePx: 220 },
      ram: { triggerPx: 90, windupS: 0.35 },
      suppressField: { radiusPx: 160, noFlank: true, noExecute: true },
      sightRelay: { rangePx: 520, shareWithAllies: true },
      deathBlast: { fuseS: 1.2, radiusPx: 110 },
      rally: { fireRateMult: 0.7, maxTargets: 6 },
      stalk: { cloakBeyondPx: 220, revealBeforeShotS: 0.6 },
      tether: { splitPct: 0.5, breakDistPx: 260 },
      harvest: { radiusPx: 200, hpPerStack: 8 },
      metronome: { beatS: 2.0, holdWindowS: 1.6 },
      grapple: { windupS: 0.7, pullS: 1.2 },
      build: { everyS: 5.0, hits: 3 },
    };
    const fakeData = {
      ...tanksData,
      types: {
        ...tanksData.types,
        [synthType]: { speed: 'normal', role: 'guardian', weapon: 'bullet', maxHp: 30, damage: 25, ...neueFelder },
      },
    };
    const cfg = resolveCfg(fakeData, synthType);
    for (const [feld, wert] of Object.entries(neueFelder)) {
      check(
        JSON.stringify(cfg[feld]) === JSON.stringify(wert),
        `G1 (a): Feld '${feld}' kommt nicht unveraendert im aufgeloesten cfg an (${JSON.stringify(cfg[feld])} statt ${JSON.stringify(wert)})`,
      );
    }
    // Ohne die Felder im Typ bleiben die drei numerischen Vorgabewerte
    // erhalten (spreadCount 1, spreadRad/burstRangePx 0), die 13 struktu-
    // rierten Felder sind null -- kein Bestandstyp darf durch die neue
    // Whitelist ploetzlich einen anderen Wert bekommen.
    const cfgLeer = resolveCfg(tanksData, 't_brown');
    check(cfgLeer.spreadCount === 1, `G1 (a): Vorgabewert spreadCount sollte 1 sein, ist ${cfgLeer.spreadCount}`);
    check(cfgLeer.spreadRad === 0, `G1 (a): Vorgabewert spreadRad sollte 0 sein, ist ${cfgLeer.spreadRad}`);
    check(cfgLeer.burstRangePx === 0, `G1 (a): Vorgabewert burstRangePx sollte 0 sein, ist ${cfgLeer.burstRangePx}`);
    for (const feld of ['charge', 'heal', 'ram', 'suppressField', 'sightRelay', 'deathBlast', 'rally', 'stalk', 'tether', 'harvest', 'metronome', 'grapple', 'build']) {
      check(cfgLeer[feld] === null, `G1 (a): Vorgabewert '${feld}' sollte null sein, ist ${JSON.stringify(cfgLeer[feld])}`);
    }
  }

  // (b) Baustein A (Aura-Flags): Reset-Mechanismus ueber einen echten
  // stepState()-Tick, PLUS die drei Lesepunkte (Flanke/Exekution in
  // state.js, Feuerrate in tank.js) mit einem Proxy um t.auraFlags --
  // die Schreibzugriffe des taeglichen Resets (state.js) landen normal im
  // Backing-Objekt, ein READ von genau dem gerade getesteten Feld liefert
  // stattdessen einen von aussen steuerbaren Wert. Das ist noetig, weil
  // G1 bewusst KEINEN Erzeuger baut (der kommt erst mit t_anchor/t_marshal
  // in G3/G6) -- ohne den Proxy koennte ein manuell gesetztes Flag nie den
  // Reset am Tickanfang ueberleben, und der wahre Zweig der drei Lesepunkte
  // liesse sich vor G3/G6 gar nicht beobachten.
  {
    const { createState, stepState } = await import('../src/game/state.js');
    const { createTank, fireBullet } = await import('../src/game/tank.js');
    const { createBullet } = await import('../src/game/bullet.js');
    const { rngFor, hashSeed } = await import('../src/core/rng.js');

    const auraRoom = () => {
      const st = createState(tanksData, tilesData, {
        genRng: rngFor(1, 1, 'rooms'),
        enemyTypes: [],
        aiSeed: hashSeed(1, 1, 'ai'),
        playerUpgrades: {},
        upgradesData,
        equippedSecondary: 'mine',
        transform: {},
      });
      st.walls = []; // isoliert von generierten Waenden (Muster: Abschnitt 45 legionRoom)
      st.isSolid = () => false;
      st.blocksSight = () => false;
      return st;
    };
    const CMD = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

    // -- Reset-Mechanismus (echtes Verhalten, kein Proxy noetig) --
    {
      const st = auraRoom();
      const gegner = createTank('t_grey', resolveCfg(tanksData, 't_grey'), 700, 256);
      gegner.heading = 0;
      st.tanks.push(gegner);
      stepState(st, CMD, 1 / 60);
      check(!!gegner.auraFlags, 'G1 (b): auraFlags wird nicht angelegt');
      check(
        gegner.auraFlags.noFlank === false && gegner.auraFlags.noExecute === false && gegner.auraFlags.fireRateMult === 1,
        'G1 (b): auraFlags hat nicht die erwarteten Ruhewerte (noFlank/noExecute false, fireRateMult 1)',
      );
      gegner.auraFlags.noFlank = true;
      gegner.auraFlags.fireRateMult = 0.42;
      stepState(st, CMD, 1 / 60);
      check(
        gegner.auraFlags.noFlank === false && gegner.auraFlags.fireRateMult === 1,
        'G1 (b): auraFlags wird nicht bei JEDEM Tick zurueckgesetzt',
      );
    }

    // -- Lesepunkt 1: noFlank (Flankenzonen-Pruefung in state.js) --
    {
      const st = auraRoom();
      const gegner = createTank('t_grey', { ...resolveCfg(tanksData, 't_grey'), maxHp: 100, armor: null }, 700, 256);
      gegner.heading = 0; // Front zeigt entlang +x
      st.tanks.push(gegner);
      let forceNoFlank = false;
      const backing = { noFlank: false, noExecute: false, fireRateMult: 1 };
      gegner.auraFlags = new Proxy(backing, {
        set(t, k, v) { t[k] = v; return true; }, // Reset-Schreibzugriffe landen normal
        get(t, k) { return k === 'noFlank' ? forceNoFlank : t[k]; },
      });
      // Seitentreffer: Kugel trifft direkt oberhalb des Zentrums (90 Grad
      // zur Front) -- garantiert 'side' bei intaktem flankZoneHit.
      const seitlich = () =>
        createBullet(gegner.x, gegner.y - gegner.cfg.radius, Math.PI / 2, { speed: 1, radius: 4, owner: st.player, damage: 10 });

      forceNoFlank = true;
      gegner.hp = 100;
      st.bullets.push(seitlich());
      stepState(st, CMD, 1 / 60);
      check(
        gegner.hp === 90,
        `G1 (b): noFlank sollte den Seitentreffer als Front (×1, -10) werten, hp ist ${gegner.hp} statt 90`,
      );

      // Gegenprobe im selben Testlauf: OHNE noFlank muss derselbe
      // Seitentreffer den echten Flankenfaktor anwenden (>10 Schaden) --
      // sonst haette der Test oben auch bei kaputtem Lesepunkt bestanden.
      forceNoFlank = false;
      gegner.hp = 100;
      st.bullets.push(seitlich());
      stepState(st, CMD, 1 / 60);
      check(
        gegner.hp < 90,
        `G1 (b) Gegenprobe: ohne noFlank sollte derselbe Seitentreffer mehr als 10 Schaden machen, hp ist ${gegner.hp}`,
      );
    }

    // -- Lesepunkt 2: noExecute (Exekutionsschwelle in state.js) --
    {
      const st = auraRoom();
      const gegner = createTank('t_grey', { ...resolveCfg(tanksData, 't_grey'), maxHp: 100 }, 700, 256);
      st.tanks.push(gegner);
      let forceNoExecute = false;
      const backing = { noFlank: false, noExecute: false, fireRateMult: 1 };
      gegner.auraFlags = new Proxy(backing, {
        set(t, k, v) { t[k] = v; return true; },
        get(t, k) { return k === 'noExecute' ? forceNoExecute : t[k]; },
      });
      gegner.hp = 1; // weit unter jeder plausiblen Exekutionsschwelle
      forceNoExecute = true;
      stepState(st, CMD, 1 / 60);
      check(!gegner.executing, 'G1 (b): noExecute sollte t.executing unterdruecken, ist aber true');

      forceNoExecute = false;
      stepState(st, CMD, 1 / 60);
      check(gegner.executing, 'G1 (b) Gegenprobe: ohne noExecute sollte ein Gegner bei 1 LP im Exekutionszustand sein');
    }

    // -- Lesepunkt 3: fireRateMult (tank.js: fireBullet()) --
    {
      const st = auraRoom();
      const gegner = createTank('t_grey', resolveCfg(tanksData, 't_grey'), 700, 256);
      st.tanks.push(gegner);
      const backing = { noFlank: false, noExecute: false, fireRateMult: 1 };
      gegner.auraFlags = new Proxy(backing, {
        set(t, k, v) { t[k] = v; return true; },
        get(t, k) { return k === 'fireRateMult' ? 0.4 : t[k]; },
      });
      fireBullet(gegner, st);
      check(
        Math.abs(gegner.cooldown - gegner.cfg.fireCooldown * 0.4) < 1e-9,
        `G1 (b): fireRateMult 0.4 sollte den Cooldown auf ${gegner.cfg.fireCooldown * 0.4} setzen, ist ${gegner.cooldown}`,
      );
      // Gegenprobe: Vorgabewert 1 (kein Aurenquelle) laesst den Cooldown
      // unveraendert bei fireCooldown selbst.
      const st2 = auraRoom();
      const gegner2 = createTank('t_grey', resolveCfg(tanksData, 't_grey'), 700, 256);
      st2.tanks.push(gegner2);
      fireBullet(gegner2, st2);
      check(
        Math.abs(gegner2.cooldown - gegner2.cfg.fireCooldown) < 1e-9,
        `G1 (b) Gegenprobe: ohne fireRateMult-Quelle sollte der Cooldown ${gegner2.cfg.fireCooldown} sein, ist ${gegner2.cooldown}`,
      );
    }
  }

  // (c) Baustein B (Verbindungslinien): state.tankLinks existiert, ist beim
  // Raumaufbau leer (kein G2+-Gegner gebaut) und drawTankLinks() zeichnet
  // einen manuell eingefuegten Eintrag ohne Fehler.
  {
    const { createState } = await import('../src/game/state.js');
    const { rngFor, hashSeed } = await import('../src/core/rng.js');
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: [],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
    });
    check(Array.isArray(st.tankLinks) && st.tankLinks.length === 0, 'G1 (c): state.tankLinks fehlt oder ist beim Raumaufbau nicht leer');
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    try {
      const { drawTankLinks } = await import('../src/render/effects.js');
      const ctx = document.createElement('canvas').getContext('2d');
      st.tankLinks.push({ x0: 10, y0: 10, x1: 100, y1: 100, color: [120, 220, 140] });
      let warf = false;
      try {
        drawTankLinks(ctx, st);
      } catch {
        warf = true;
      }
      check(!warf, 'G1 (c): drawTankLinks() wirft bei einem gueltigen Eintrag');
    } finally {
      restore();
    }
  }

  // (d) Baustein C (Telegraph-Helfer): drawCorridorTelegraph()/
  // drawGrowingRingTelegraph() existieren, sind eigenstaendig aufrufbar
  // (nicht mehr an state.anvilBoss/state.mortars gebunden) und liefern die
  // erwartete Korridorlaenge (freie Flaeche -> Laenge bleibt beim maxLen-
  // Vorgabewert, exakt der Mechanismus, den drawAnvilHazards() jetzt nutzt).
  {
    const { installDom } = await import('./domstub.mjs');
    const restore = installDom();
    try {
      const { drawCorridorTelegraph, drawGrowingRingTelegraph } = await import('../src/render/effects.js');
      const ctx = document.createElement('canvas').getContext('2d');
      const fakeState = { isSolid: () => false }; // frei, keine Wand im Weg
      const len = drawCorridorTelegraph(ctx, fakeState, 100, 100, 0, 20, { maxLen: 321 });
      check(len === 321, `G1 (d): drawCorridorTelegraph() ohne Wand sollte maxLen (321) zurueckgeben, gibt ${len}`);
      let warf = false;
      try {
        drawGrowingRingTelegraph(ctx, 100, 100, 44, 0.5);
      } catch {
        warf = true;
      }
      check(!warf, 'G1 (d): drawGrowingRingTelegraph() wirft bei gueltigen Argumenten');
    } finally {
      restore();
    }
  }
}

// ---- 70. Gegner-Umbau Phase G2 (UMBAUPLAN-GEGNER.md): Welle 1 ----------
// Vier Gegner ohne neue Architektur: t_rusher (Rammschaden aus anvil.js
// verallgemeinert, ai_drives.js: ramDrive()), t_dud (neuer, eigenstaendiger
// Todeszuender state.deathFuses), t_shotgun (bestehender N-Kugel-Faecher +
// eine neue Salven-Vorwarnung fireWindupS), t_lance (Ladeschuss-Zustands-
// automat in ai_turrets.js, bestehendes Bullet-Feld pierce). Jeder
// Mechanismus wird mit EIGENEN, isolierten Testraeumen geprueft (Muster
// Abschnitt 45/69: st.walls=[]/isSolid/blocksSight ueberschrieben), nicht
// nur die aktuelle tanks.json-Datenlage.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createTank, fireBullet } = await import('../src/game/tank.js');
  const { roleTurret } = await import('../src/game/ai_turrets.js');
  const { ramDrive } = await import('../src/game/ai_drives.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');

  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  function g2Room() {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: [],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
    });
    st.walls = []; // isoliert von generierten Waenden (Muster: Abschnitt 45/69)
    st.isSolid = () => false;
    st.blocksSight = () => false;
    return st;
  }

  // ---- (a) Struktur: vier neue Typen + Akt-2-Freischaltung -----------------
  {
    const r = tanksData.types.t_rusher;
    check(!!r?.ram && r.weapon === null, 'G2 (a): t_rusher fehlt oder traegt kein ram/weapon:null');
    check(
      typeof r.ram.triggerPx === 'number' && typeof r.ram.windupS === 'number' && typeof r.ram.chargeS === 'number',
      'G2 (a): t_rusher.ram unvollstaendig',
    );
    const d = tanksData.types.t_dud;
    check(!!d?.deathBlast && d.weapon === null, 'G2 (a): t_dud fehlt oder traegt kein deathBlast/weapon:null');
    const s = tanksData.types.t_shotgun;
    check(s?.spreadCount > 1 && s?.fireWindupS > 0 && s?.burstRangePx > 0, 'G2 (a): t_shotgun fehlt spreadCount/fireWindupS/burstRangePx');
    const l = tanksData.types.t_lance;
    check(!!l?.charge && l?.pierce > 0, 'G2 (a): t_lance fehlt charge/pierce');
    for (const id of ['t_rusher', 't_shotgun', 't_dud', 't_lance']) {
      check(diffData.danger[id]?.unlockAct === 2, `G2 (a): ${id} ist nicht ab Akt 2 freigeschaltet`);
    }
  }

  // ---- (b) roleTurret(): weapon:null feuert nie -----------------------------
  // Zwei Faelle: der zufaellig schwenkende Turm (acc<=0, t_rushers echter
  // Wert) UND ein synthetischer weapon:null-Typ mit hoher accuracy (haette
  // sonst den ANDEREN Rueckgabepfad ungeprueft gelassen).
  {
    const st = g2Room();
    const rusher = createTank('t_rusher', resolveCfg(tanksData, 't_rusher'), 220, 220);
    st.tanks.push(rusher);
    let feuerteJe = false;
    for (let i = 0; i < 300; i++) {
      if (roleTurret(rusher, st, 1 / 60)) feuerteJe = true;
    }
    check(!feuerteJe, 'G2 (b): t_rusher (weapon:null, acc<=0) feuert trotz fehlender Waffe');

    const synthType = 'zzz_g2_weaponless_precise';
    const fakeData = {
      ...tanksData,
      types: { ...tanksData.types, [synthType]: { speed: 'normal', role: 'guardian', weapon: null, accuracy: 0.9, maxHp: 30, damage: 25 } },
    };
    const st2 = g2Room();
    const scharf = createTank(synthType, resolveCfg(fakeData, synthType), 220, 220);
    scharf.turret = 0;
    st2.tanks.push(scharf);
    let feuerteJe2 = false;
    for (let i = 0; i < 300; i++) {
      if (roleTurret(scharf, st2, 1 / 60)) feuerteJe2 = true;
    }
    check(!feuerteJe2, 'G2 (b): weapon:null mit accuracy>0 feuert trotz fehlender Waffe (finaler Gate-Zweig)');
  }

  // ---- (c) ramDrive() (t_rusher): Trigger, eingefrorene Richtung, Sturm, ---
  //          hoechstens EIN Treffer, Wandkontakt, Erschoepfung ---------------
  {
    const st = g2Room();
    const rusher = createTank('t_rusher', resolveCfg(tanksData, 't_rusher'), 400, 256);
    // pushPx auf 0 -- sonst wuerde schon der ERSTE Treffer den Spieler aus dem
    // Ueberlapp schieben und "hoechstens ein Treffer" waere allein durch den
    // Rueckstoss erfuellt, unabhaengig vom hitTargets-Wächter selbst (echter
    // Gegenprobe-Fund: mit pushPx=60 blieb dieser Test AUCH ohne den Waechter
    // gruen).
    rusher.cfg = { ...rusher.cfg, ram: { ...rusher.cfg.ram, pushPx: 0 } };
    rusher.heading = 0;
    rusher.ai.target = st.player;
    st.player.x = 460; // 60px entfernt -- unter triggerPx (90)
    st.player.y = 256;
    st.tanks.push(rusher);

    // Windup: Panzer bewegt sich nicht, Richtung ist sofort eingefroren.
    const move0 = ramDrive(rusher, st, 1 / 60);
    check(rusher.ai.ram.mode === 'windup', `G2 (c): kein Windup ausgeloest (Modus ${rusher.ai.ram.mode})`);
    check(Math.abs(rusher.ai.ram.dir) < 1e-9, `G2 (c): Sturmrichtung nicht auf den Spieler eingefroren (${rusher.ai.ram.dir})`);
    check(move0.x === 0 && move0.y === 0, 'G2 (c): ramDrive() bewegt waehrend des Windups');
    st.player.y = 320; // Ziel bewegt sich WAEHREND des Windups -- darf die eingefrorene Richtung nicht aendern
    const windupS = rusher.cfg.ram.windupS;
    for (let i = 0; i < Math.ceil(windupS * 60) + 2; i++) ramDrive(rusher, st, 1 / 60);
    check(rusher.ai.ram.mode === 'charge', `G2 (c): kein Uebergang in Sturm nach Ablauf des Windups (Modus ${rusher.ai.ram.mode})`);
    check(Math.abs(rusher.ai.ram.dir) < 1e-9, 'G2 (c): Sturmrichtung hat sich waehrend des Windups nachgefuehrt statt eingefroren zu bleiben');

    // Sturm: der Spieler steht direkt im Weg -- mehrere Substeps ueberlappen
    // ihn (Radius >> RAM_STEP_PX), trotzdem darf nur EIN Treffer zaehlen.
    st.player.x = 460;
    st.player.y = 256;
    st.player.hp = 999;
    const hpVorSturm = st.player.hp;
    for (let i = 0; i < 40 && rusher.ai.ram.mode === 'charge'; i++) ramDrive(rusher, st, 1 / 60);
    const verlust = hpVorSturm - st.player.hp;
    check(verlust === rusher.cfg.damage, `G2 (c): Sturm richtet ${verlust} statt genau cfg.damage (${rusher.cfg.damage}) Schaden an -- Mehrfachtreffer oder gar keiner`);
    check(rusher.ai.ram.mode === 'exhausted', `G2 (c): kein Uebergang in Erschoepfung nach Sturmende (Modus ${rusher.ai.ram.mode})`);

    // Erschoepfung: kein zweiter Sturm vor Ablauf von exhaustS. Ziel WEIT weg
    // gesetzt, sonst wuerde 'seek' den naechsten Sturm sofort wieder ausloesen
    // (das Ziel ist ja immer noch nahe genug) -- die Stabilitaet von 'seek'
    // selbst laesst sich sonst gar nicht beobachten.
    const exhaustTicks = Math.ceil(rusher.cfg.ram.exhaustS * 60);
    for (let i = 0; i < exhaustTicks - 3; i++) {
      ramDrive(rusher, st, 1 / 60);
      check(rusher.ai.ram.mode === 'exhausted', 'G2 (c): Erschoepfung endet zu frueh');
    }
    st.player.x = 1200;
    st.player.y = 900;
    for (let i = 0; i < 5; i++) ramDrive(rusher, st, 1 / 60);
    check(rusher.ai.ram.mode === 'seek', `G2 (c): kehrt nach Ablauf der Erschoepfung nicht zu 'seek' zurueck (Modus ${rusher.ai.ram.mode})`);
  }

  // ---- (c2) ramDrive(): Wandkontakt beendet den Sturm sofort ---------------
  {
    const st = g2Room();
    const rusher = createTank('t_rusher', resolveCfg(tanksData, 't_rusher'), 400, 256);
    rusher.heading = 0;
    st.player.x = 460;
    st.player.y = 900; // weit weg -- der Sturm soll die Wand treffen, nicht den Spieler
    st.tanks.push(rusher);
    st.walls = [{ x: 440, y: 200, w: 32, h: 120, type: 'wall' }]; // direkt in Sturmrichtung
    st.isSolid = (x, y) => x >= 440 && x <= 472 && y >= 200 && y <= 320;
    rusher.ai.ram = { mode: 'charge', timer: rusher.cfg.ram.chargeS, dir: 0, hitTargets: new Set() };
    let stops = false;
    for (let i = 0; i < 60 && !stops; i++) {
      ramDrive(rusher, st, 1 / 60);
      if (rusher.ai.ram.mode === 'exhausted') stops = true;
    }
    check(stops, 'G2 (c2): Sturm haelt bei Wandkontakt nicht an');
    check(rusher.x < 440, `G2 (c2): Panzer ist durch die Wand hindurchgefahren (x=${rusher.x})`);
  }

  // ---- (d) fireWindupS (t_shotgun): verzoegert das Feuersignal, resettet ---
  //          bei unterbrochener Sichtlinie -----------------------------------
  {
    const st = g2Room();
    const shotgun = createTank('t_shotgun', resolveCfg(tanksData, 't_shotgun'), 300, 256);
    shotgun.turret = 0;
    st.player.x = 340;
    st.player.y = 256;
    st.tanks.push(shotgun);
    const windupS = shotgun.cfg.fireWindupS;
    let feuerteBeiTick = -1;
    for (let i = 0; i < Math.ceil(windupS * 60) + 5 && feuerteBeiTick < 0; i++) {
      if (roleTurret(shotgun, st, 1 / 60)) feuerteBeiTick = i;
    }
    check(feuerteBeiTick >= 0, 'G2 (d): t_shotgun feuert nie, obwohl Ziel/Sicht/Kegel durchgehend erfuellt sind');
    const erwarteteTicks = Math.round(windupS * 60);
    check(
      Math.abs(feuerteBeiTick + 1 - erwarteteTicks) <= 1,
      `G2 (d): Feuersignal kam nach ${feuerteBeiTick + 1} Ticks statt den erwarteten ~${erwarteteTicks} (fireWindupS=${windupS}s)`,
    );

    // Sichtverlust waehrend des Aufladens setzt den Timer zurueck -- kein
    // "aufgestauter" Schuss aus einer laengst verlassenen Ausrichtung.
    const st2 = g2Room();
    const shotgun2 = createTank('t_shotgun', resolveCfg(tanksData, 't_shotgun'), 300, 256);
    shotgun2.turret = 0;
    st2.player.x = 340;
    st2.player.y = 256;
    st2.tanks.push(shotgun2);
    for (let i = 0; i < Math.round(windupS * 60) - 3; i++) roleTurret(shotgun2, st2, 1 / 60);
    check(shotgun2.ai.windupTimer > 0, 'G2 (d): Testaufbau -- windupTimer sollte vor der Unterbrechung schon > 0 sein');
    st2.blocksSight = () => true; // Sichtlinie faellt weg
    roleTurret(shotgun2, st2, 1 / 60);
    check(shotgun2.ai.windupTimer === 0, 'G2 (d): windupTimer wird bei Sichtverlust nicht zurueckgesetzt');
  }

  // ---- (e) chargeTurret() (t_lance): idle -> charging -> locked -> Schuss --
  //          -> Pause, Abbruch NUR bei Sichtverlust --------------------------
  {
    const st = g2Room();
    const lance = createTank('t_lance', resolveCfg(tanksData, 't_lance'), 300, 256);
    lance.turret = 0;
    st.player.x = 600; // ausserhalb des Kegels/weit weg -- noch kein Aufladen
    st.player.y = 600;
    st.tanks.push(lance);
    check(roleTurret(lance, st, 1 / 60) === false, 'G2 (e): feuert ohne Ziel im Kegel');
    check(lance.ai.lance.mode === 'idle', `G2 (e): startet faelschlich mit Aufladen (Modus ${lance.ai.lance.mode})`);

    st.player.x = 340; // jetzt im Kegel + sichtbar -- Aufladen beginnt
    st.player.y = 256;
    roleTurret(lance, st, 1 / 60);
    check(lance.ai.lance.mode === 'charging', `G2 (e): kein Uebergang in 'charging' (Modus ${lance.ai.lance.mode})`);

    const lockAt = lance.cfg.charge.windupS - lance.cfg.charge.lockAtS;
    for (let i = 0; i < Math.round(lockAt * 60); i++) roleTurret(lance, st, 1 / 60);
    check(lance.ai.lance.mode === 'locked', `G2 (e): kein Uebergang in 'locked' nach windupS-lockAtS (Modus ${lance.ai.lance.mode})`);
    const turretBeimEinfrieren = lance.turret;
    st.player.y = 100; // Ziel bewegt sich waehrend 'locked' -- Turm darf nicht nachfuehren
    roleTurret(lance, st, 1 / 60);
    check(lance.turret === turretBeimEinfrieren, 'G2 (e): Turm dreht waehrend "locked" trotzdem nach');
    st.player.y = 256; // zurueck in die Feuerlinie fuer den eigentlichen Schuss

    let feuerte = false;
    for (let i = 0; i < 60 && !feuerte; i++) {
      if (roleTurret(lance, st, 1 / 60)) feuerte = true;
    }
    check(feuerte, 'G2 (e): feuert nach vollem Aufladen nie');
    check(lance.ai.lance.mode === 'pause', `G2 (e): kein Uebergang in Pause nach dem Schuss (Modus ${lance.ai.lance.mode})`);
    check(roleTurret(lance, st, 1 / 60) === false, 'G2 (e): feuert waehrend der Pause ein zweites Mal');
    // Ziel WEIT weg, sonst wuerde 'idle' sofort wieder in 'charging' wechseln
    // (dasselbe Muster wie G2 (c) bei der Erschoepfung) -- 'idle' selbst
    // liesse sich sonst gar nicht beobachten.
    st.player.x = 1200;
    st.player.y = 900;
    const pauseS = lance.cfg.charge.pauseS;
    for (let i = 0; i < Math.round(pauseS * 60) + 2; i++) roleTurret(lance, st, 1 / 60);
    check(lance.ai.lance.mode === 'idle', `G2 (e): kehrt nach Ablauf der Pause nicht zu 'idle' zurueck (Modus ${lance.ai.lance.mode})`);
    st.player.x = 340; // zurueck in die Feuerlinie fuer den End-zu-End-Schusstest unten
    st.player.y = 256;

    // Der abgefeuerte Schuss traegt wirklich pierce/bulletSpeed aus cfg.
    const b = fireBullet(lance, st);
    check(b !== false, 'G2 (e): Testaufbau -- fireBullet() sollte nach der Pause wieder feuern koennen');
    const kugel = st.bullets[st.bullets.length - 1];
    check(kugel.pierce === lance.cfg.pierce, `G2 (e): Kugel traegt pierce=${kugel.pierce} statt cfg.pierce=${lance.cfg.pierce}`);
    // Bullet-Objekte speichern kein rohes speed-Feld, sondern vx/vy (bullet.js:
    // createBullet()) -- die Betragsgeschwindigkeit muss trotzdem cfg.bulletSpeed sein.
    const kugelTempo = Math.hypot(kugel.vx, kugel.vy);
    check(Math.abs(kugelTempo - lance.cfg.bulletSpeed) < 0.5, `G2 (e): Kugel fliegt mit ${kugelTempo} statt cfg.bulletSpeed=${lance.cfg.bulletSpeed}`);
  }

  // ---- (e2) chargeTurret(): Sichtverlust bricht in JEDER Ladephase ab, -----
  //           OHNE zu feuern und OHNE Pause ----------------------------------
  {
    const st = g2Room();
    const lance = createTank('t_lance', resolveCfg(tanksData, 't_lance'), 300, 256);
    lance.turret = 0;
    st.player.x = 340;
    st.player.y = 256;
    st.tanks.push(lance);
    roleTurret(lance, st, 1 / 60);
    check(lance.ai.lance.mode === 'charging', 'G2 (e2): Testaufbau -- sollte bereits laden');
    st.blocksSight = () => true;
    const feuerteTrotzSichtverlust = roleTurret(lance, st, 1 / 60);
    check(!feuerteTrotzSichtverlust, 'G2 (e2): feuert trotz Sichtverlust waehrend des Aufladens');
    check(lance.ai.lance.mode === 'idle', `G2 (e2): kein sofortiger Abbruch auf 'idle' bei Sichtverlust (Modus ${lance.ai.lance.mode})`);
    check(lance.ai.lance.timer === 0, 'G2 (e2): Ladefortschritt bleibt nach Abbruch stehen statt auf 0 zu fallen');
  }

  // ---- (f) Todeszuender (t_dud): killTank()-Hook + verzoegerte Explosion, --
  //          trifft ausdruecklich auch andere Gegner (spare:null) -----------
  {
    const st = g2Room();
    const dud = createTank('t_dud', resolveCfg(tanksData, 't_dud'), 300, 256);
    const nachbar = createTank('t_grey', resolveCfg(tanksData, 't_grey'), 340, 256); // im Explosionsradius
    nachbar.protect = 0;
    st.player.x = 300;
    st.player.y = 340; // ebenfalls im Radius
    st.player.protect = 0;
    st.tanks.push(dud, nachbar);
    check(st.deathFuses.length === 0, 'G2 (f): Testaufbau -- deathFuses sollte vor dem Tod leer sein');

    st.killTank(dud, 'Testtod');
    check(st.deathFuses.length === 1, `G2 (f): killTank() legt keinen deathFuses-Eintrag an (${st.deathFuses.length})`);
    const fuse = st.deathFuses[0];
    check(fuse.radiusPx === dud.cfg.deathBlast.radiusPx, 'G2 (f): Zuender-Radius stimmt nicht mit cfg.deathBlast.radiusPx ueberein');
    check(fuse.damage === dud.cfg.deathBlast.damage, 'G2 (f): Zuender-Schaden stimmt nicht mit cfg.deathBlast.damage ueberein');

    const hpNachbarVorher = nachbar.hp;
    const hpSpielerVorher = st.player.hp;
    const fuseS = dud.cfg.deathBlast.fuseS;
    for (let i = 0; i < Math.round(fuseS * 60) - 3; i++) stepState(st, CMD0, 1 / 60);
    check(nachbar.hp === hpNachbarVorher, 'G2 (f): Explosion zuendet zu frueh (vor Ablauf von fuseS)');
    check(st.deathFuses.length === 1, 'G2 (f): Zuender verschwindet vor Ablauf von fuseS');

    for (let i = 0; i < 10; i++) stepState(st, CMD0, 1 / 60);
    check(st.deathFuses.length === 0, 'G2 (f): Zuender wird nach der Explosion nicht aufgeraeumt');
    check(nachbar.hp < hpNachbarVorher, 'G2 (f): Explosion trifft KEINEN anderen Gegner (spare:null erwartet)');
    check(st.player.hp < hpSpielerVorher, 'G2 (f): Explosion trifft den Spieler nicht');
  }
}

// ---- 71. Gegner-Umbau Phase G3 (UMBAUPLAN-GEGNER.md): Welle 2 ----------
// Zwei Gegner, beide ohne neue Architektur: t_relay (state.relaySight, ein
// globaler Boolean/Tick, gelesen an genau einer Stelle in ai_turrets.js:
// roleTurret()) und t_anchor (Baustein A/G1s tank.auraFlags -- der erste
// echte Setzer). Beide nutzen ausserdem Baustein B (G1, tankLinks) fuer den
// Lichtfaden bzw. gar keinen neuen Renderer-Mechanismus (t_anchors Ring ist
// eine eigene, bewusst NICHT-Baustein-C-Funktion, s. CLAUDE.md).
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createTank } = await import('../src/game/tank.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { roleTurret } = await import('../src/game/ai_turrets.js');
  const { createGhost, pushGhost } = await import('../src/game/ghost.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');

  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  function g3Room() {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: [],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
    });
    st.walls = [];
    st.isSolid = () => false;
    st.blocksSight = () => false;
    return st;
  }

  // ---- (a) Struktur: beide neuen Typen + Akt-2-Freischaltung ---------------
  {
    const r = tanksData.types.t_relay;
    check(!!r?.sightRelay && r.role === 'sapper' && r.aggression === 0.05, 'G3 (a): t_relay fehlt oder entspricht nicht der Spec (sightRelay/role/aggression)');
    check(typeof r.sightRelay.rangePx === 'number', 'G3 (a): t_relay.sightRelay.rangePx fehlt');
    const a = tanksData.types.t_anchor;
    check(!!a?.suppressField && a.role === 'guardian' && a.speed === 'fix', 'G3 (a): t_anchor fehlt oder entspricht nicht der Spec (suppressField/role/speed)');
    check(a.suppressField.noFlank === true && a.suppressField.noExecute === true, 'G3 (a): t_anchor.suppressField setzt nicht beide Flaggen');
    for (const id of ['t_relay', 't_anchor']) {
      check(diffData.danger[id]?.unlockAct === 2, `G3 (a): ${id} ist nicht ab Akt 2 freigeschaltet`);
    }
  }

  // ---- (b) state.relaySight: Reichweite + Sichtlinie, EIN globaler Boolean -
  {
    const st = g3Room();
    const relay = createTank('t_relay', resolveCfg(tanksData, 't_relay'), 400, 50);
    st.tanks.push(relay);
    st.player.x = 400;
    st.player.y = 100; // 50px entfernt, weit unter rangePx (520)
    stepState(st, CMD0, 1 / 60);
    check(st.relaySight === true, 'G3 (b): relaySight bleibt false trotz Sichtlinie + Reichweite');

    // Ausserhalb der Reichweite: dieselbe freie Sicht, aber zu weit weg.
    const st2 = g3Room();
    const relay2 = createTank('t_relay', resolveCfg(tanksData, 't_relay'), 0, 0);
    st2.tanks.push(relay2);
    st2.player.x = 600; // > 520px
    st2.player.y = 0;
    stepState(st2, CMD0, 1 / 60);
    check(st2.relaySight === false, 'G3 (b): relaySight ignoriert die Reichweite (rangePx)');

    // Sichtlinie blockiert (blocksSight zwischen Relay und Ziel).
    const st3 = g3Room();
    st3.blocksSight = (x, y) => x > 100 && x < 300 && Math.abs(y) < 5;
    const relay3 = createTank('t_relay', resolveCfg(tanksData, 't_relay'), 0, 0);
    st3.tanks.push(relay3);
    st3.player.x = 400;
    st3.player.y = 0;
    stepState(st3, CMD0, 1 / 60);
    check(st3.relaySight === false, 'G3 (b): relaySight ignoriert eine blockierte Sichtlinie');
  }

  // ---- (c) roleTurret(): relaySight erlaubt einer sichtlosen Waffe zu ------
  //          feuern, tank.relayAssisted markiert genau das --------------------
  {
    // Geometrie: Ziel bei (400,100), Verbuendeter bei (100,100) -- eine Wand
    // liegt NUR auf der Verbuendeten-Ziel-Linie (y=100, x zwischen 150/350),
    // nicht auf einer spaeteren Relay-Ziel-Linie (wird hier gar nicht
    // gebraucht -- roleTurret() liest nur das FERTIGE state.relaySight).
    const wallBlocksAllyOnly = (x, y) => y > 90 && y < 110 && x > 150 && x < 350;

    const st = g3Room();
    st.blocksSight = wallBlocksAllyOnly;
    const ally = createTank('t_pink', resolveCfg(tanksData, 't_pink'), 100, 100);
    ally.turret = 0; // zeigt exakt zum Ziel (400,100), Kegel damit erfuellt
    st.tanks.push(ally);
    st.player.x = 400;
    st.player.y = 100;

    st.relaySight = false;
    const ohneRelay = roleTurret(ally, st, 1 / 60);
    check(ohneRelay === false, 'G3 (c): Verbuendeter feuert ohne Sichtlinie UND ohne relaySight');
    check(!ally.relayAssisted, 'G3 (c): relayAssisted ist faelschlich gesetzt, obwohl relaySight false ist');

    st.relaySight = true;
    const mitRelay = roleTurret(ally, st, 1 / 60);
    check(mitRelay === true, 'G3 (c): Verbuendeter feuert trotz relaySight=true nicht');
    check(ally.relayAssisted === true, 'G3 (c): relayAssisted wird nicht gesetzt, obwohl nur dank relaySight gefeuert wurde');

    // Kontrolle: hat der Verbuendete selbst freie Sicht, braucht es KEINEN
    // Horcher -- relayAssisted darf dann nicht gesetzt werden.
    const st2 = g3Room();
    const ally2 = createTank('t_pink', resolveCfg(tanksData, 't_pink'), 100, 100);
    ally2.turret = 0;
    st2.tanks.push(ally2);
    st2.player.x = 400;
    st2.player.y = 100;
    st2.relaySight = false;
    const eigeneSicht = roleTurret(ally2, st2, 1 / 60);
    check(eigeneSicht === true, 'G3 (c): Testaufbau -- mit echter Sichtlinie sollte auch ohne Horcher gefeuert werden');
    check(!ally2.relayAssisted, 'G3 (c): relayAssisted wird faelschlich auch bei echter eigener Sichtlinie gesetzt');
  }

  // ---- (d) t_anchor: Suppress-Feld markiert alle Panzer im Radius (inkl. --
  //          der Quelle selbst), NICHT ausserhalb, NICHT Geister ------------
  {
    const st = g3Room();
    const anchor = createTank('t_anchor', resolveCfg(tanksData, 't_anchor'), 300, 300);
    const nah = createTank('t_grey', resolveCfg(tanksData, 't_grey'), 380, 300); // 80px, < 160
    const fern = createTank('t_grey', resolveCfg(tanksData, 't_grey'), 300, 600); // 300px, > 160
    st.tanks.push(anchor, nah, fern);
    const geist = createGhost(st, 320, 300, 0, 't_grey'); // 20px vom Anker, waere IM Radius
    pushGhost(st, geist);
    stepState(st, CMD0, 1 / 60);
    check(anchor.auraFlags.noFlank === true && anchor.auraFlags.noExecute === true, 'G3 (d): der Anker markiert sich nicht selbst ("inkl. ihm selbst")');
    check(nah.auraFlags.noFlank === true && nah.auraFlags.noExecute === true, 'G3 (d): ein Panzer INNERHALB des Feldes wird nicht markiert');
    check(fern.auraFlags.noFlank === false && fern.auraFlags.noExecute === false, 'G3 (d): ein Panzer AUSSERHALB des Feldes wird faelschlich markiert');
    check(geist.auraFlags === undefined, 'G3 (d): ein Geist bekommt faelschlich auraFlags (die Aura darf Geister strukturell nie erreichen)');
  }

  // ---- (e) "geankert ×1.0"-Rueckmeldung ersetzt die normale Seiten-/-------
  //          Heck-Anzeige, NUR wenn die Aura wirklich greift -----------------
  {
    const gepanzertTreffer = (offsetAngleDeg, mitAnker) => {
      const st = g3Room();
      const z = createTank('t_brown', { ...resolveCfg(tanksData, 't_brown'), maxHp: 100, role: 'guardian' }, 200, 250);
      z.heading = 0;
      st.tanks.push(st.player, z);
      if (mitAnker) {
        const anchor = createTank('t_anchor', resolveCfg(tanksData, 't_anchor'), z.x, z.y); // ueberlappt z, radius deckt jeden Offset
        st.tanks.push(anchor);
      }
      const off = (offsetAngleDeg * Math.PI) / 180;
      const b = createBullet(z.x + Math.cos(off) * 2, z.y + Math.sin(off) * 2, 0, {
        speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 10,
      });
      b.age = 5;
      st.bullets.length = 0;
      st.mines.length = 0;
      st.bullets.push(b);
      stepState(st, CMD0, 1 / 60);
      return st;
    };

    const ohneAnker = gepanzertTreffer(90, false);
    check(
      ohneAnker.texts.some((t) => t.text.startsWith('Seite')),
      'G3 (e): ohne Anker fehlt die normale Seiten-Rueckmeldung (Testvoraussetzung)',
    );
    const mitAnker = gepanzertTreffer(90, true);
    check(
      mitAnker.texts.some((t) => t.text === 'geankert ×1.0'),
      'G3 (e): ein unterdrueckter Seitentreffer im Suppress-Feld zeigt nicht "geankert ×1.0"',
    );
    check(
      !mitAnker.texts.some((t) => t.text.startsWith('Seite')),
      'G3 (e): zeigt zusaetzlich noch die normale Seiten-Rueckmeldung (haette nur EINE Rueckmeldung geben sollen)',
    );
  }

  // ---- (f) state.tankLinks: G3 ist der erste echte Erzeuger + der erste ---
  //          Pro-Tick-Reset (Baustein B, G1, war bis dahin dauerhaft leer) --
  {
    const st = g3Room();
    const relay = createTank('t_relay', resolveCfg(tanksData, 't_relay'), 0, 0);
    st.tanks.push(relay);
    st.player.x = 100;
    st.player.y = 0;
    stepState(st, CMD0, 1 / 60);
    check(st.tankLinks.length === 1, `G3 (f): erwarte genau einen Lichtfaden-Eintrag, habe ${st.tankLinks.length}`);
    // Gegen die literalen Startkoordinaten pruefen, NICHT gegen relay.x/y
    // NACH stepState(): der Horcher ist role:'sapper' und wandert -- die
    // Pre-Pass-Position (Tickanfang, was tankLinks tatsaechlich festhaelt)
    // und die Post-Tick-Position (nach der Bewegungsphase desselben Ticks)
    // sind dadurch bereits ein winziges Stueck auseinander (Testfund).
    check(st.tankLinks[0].x0 === 0 && st.tankLinks[0].y0 === 0, 'G3 (f): Lichtfaden startet nicht am Horcher');
    // Bricht die Sicht im naechsten Tick weg, muss der Eintrag verschwinden --
    // NICHT liegen bleiben (Beweis, dass state.js den Reset wirklich faehrt).
    st.blocksSight = () => true;
    stepState(st, CMD0, 1 / 60);
    check(st.tankLinks.length === 0, 'G3 (f): ein veralteter Lichtfaden-Eintrag ueberlebt einen Tick ohne Sichtlinie');
  }
}

// ---- 72. Gegner-Umbau Phase G4 (UMBAUPLAN-GEGNER.md): Kompositionssystem -
// "Das eine System, das das Projekt wirklich braucht" (Abschnitt 17.3):
// buyEnemies() versucht zuerst eine benannte Komposition aus
// data/compositions.json, faellt sonst auf die alte Zufallsschleife zurueck
// -- jetzt mit Mindestpunktzahl (ab Akt 2) und optionaler minRole-Quote je
// Akt. Alle Mechanismus-Pruefungen laufen mit EIGENEN synthetischen Daten
// (nicht den echten difficulty.json/compositions.json-Werten) -- nur der
// letzte Block (f) prueft die echte Verdrahtung ueber main.js-aequivalente
// Daten.
{
  const { buyEnemies } = await import('../src/game/run.js');
  const { mulberry32 } = await import('../src/core/rng.js');

  // (a) Struktur: compositions.json wohlgeformt, die beiden im Text
  //     genannten maxPerRoom-Eintraege UND die Akt-3-minRoleQuote existieren.
  {
    check(Array.isArray(diffData.compositions) && diffData.compositions.length >= 5, 'G4 (a): data/compositions.json hat keine (bzw. zu wenige) Kompositionen');
    for (const c of diffData.compositions) {
      check(typeof c.id === 'string' && c.id, `G4 (a): Komposition ohne id`);
      check(typeof c.actIndex === 'number', `G4 (a): "${c.id}" hat kein actIndex`);
      check(Array.isArray(c.enemies) && c.enemies.length > 0, `G4 (a): "${c.id}" hat keine enemies[]`);
      for (const e of c.enemies) {
        check(diffData.danger[e.type], `G4 (a): "${c.id}" nennt den unbekannten Typ "${e.type}"`);
        check(Number.isInteger(e.count) && e.count > 0, `G4 (a): "${c.id}"/"${e.type}" hat keine gueltige count`);
      }
    }
    check(diffData.danger.t_anchor.maxPerRoom === 1, 'G4 (a): t_anchor hat kein maxPerRoom:1');
    check(diffData.danger.t_relay.maxPerRoom === 1, 'G4 (a): t_relay hat kein maxPerRoom:1');
    check(diffData.acts[2].minRoleQuota && typeof diffData.acts[2].minRoleQuota.minBudget === 'number', 'G4 (a): acts[2] (Akt 3) hat keine minRoleQuota');
    // G5-Nachtrag zu G4 (a): jede ECHTE Komposition muss bei ihrem eigenen
    // minRoom tatsaechlich feuern KOENNEN -- sonst ist sie totes Datum.
    // Deckt genau die Fehlerklasse ab, die beim Bau von G5 gefunden wurde:
    // a5_der_zeuge hatte 9 statt hoechstens 8 Einheiten (maxEnemiesPerRoom-
    // Ueberschreitung), a2_freies_feld nannte einen Typ, der an ihrem
    // minRoom noch gar nicht freigeschaltet war (t_yellow) -- beide waren
    // dadurch STILL tot: pickComposition()s eigene Gates haetten sie nie
    // gefeuert, aber KEIN bestehender Test (nicht mal das End-zu-Ende von
    // (f) unten, das nur "irgendeine von mehreren passt") haette das je
    // bemerkt. Rechnet die echte Akt-2-Budgetformel (acts[1].budget) nach,
    // nicht nur eine Beispielzahl.
    for (const c of diffData.compositions.filter((c) => c.actIndex === 2)) {
      const actCfg = diffData.acts[1];
      const budget = actCfg.budget.base + c.minRoom * actCfg.budget.perRoom;
      const pts = c.enemies.reduce((s, e) => s + (diffData.danger[e.type]?.points ?? 0) * e.count, 0);
      const count = c.enemies.reduce((s, e) => s + e.count, 0);
      check(count <= diffData.maxEnemiesPerRoom, `G4 (a): "${c.id}" hat ${count} Einheiten, mehr als maxEnemiesPerRoom (${diffData.maxEnemiesPerRoom})`);
      check(pts <= budget && pts >= budget * 0.5, `G4 (a): "${c.id}" (Summe ${pts}) passt bei minRoom ${c.minRoom} nicht ins Budgetfenster [${(budget * 0.5).toFixed(1)}, ${budget.toFixed(1)}]`);
      for (const e of c.enemies) {
        const need = diffData.danger[e.type]?.unlockRoomInAct ?? 1;
        check(c.minRoom >= need, `G4 (a): "${c.id}" nennt "${e.type}" bei minRoom ${c.minRoom}, ist dort aber erst ab Raum ${need} freigeschaltet`);
      }
    }
  }

  // (b) pickComposition()-MECHANISMUS mit synthetischen Daten: actIndex-
  //     Gate, minRoom-Gate, Budget-Fenster (untere UND obere Grenze),
  //     Freischaltungspruefung, maxEnemiesPerRoom-Deckel, RNG-Verbrauch.
  {
    const fakeDiff = {
      maxEnemiesPerRoom: 4,
      danger: {
        cheap: { points: 2, unlockAct: 1, unlockRoomInAct: 1 },
        mid: { points: 5, unlockAct: 2, unlockRoomInAct: 1 },
        late: { points: 6, unlockAct: 2, unlockRoomInAct: 9 }, // erst spaet freigeschaltet
      },
    };
    const comp = {
      id: 'test_comp',
      actIndex: 2,
      minRoom: 3,
      weight: 1,
      enemies: [{ type: 'mid', count: 2 }], // Summe 10
    };
    const fires = (actIndex, room, budget) => {
      const rng = mulberry32(7);
      const out = buyEnemies(fakeDiff, rng, actIndex, room, budget, undefined, [comp]);
      const sorted = [...out].sort();
      return sorted.length === 2 && sorted[0] === 'mid' && sorted[1] === 'mid';
    };
    check(!fires(1, 5, 20), 'G4 (b): Komposition feuert in Akt 1, obwohl actIndex:2 verlangt ist');
    check(!fires(2, 2, 20), 'G4 (b): Komposition feuert vor minRoom (Raum 2 statt >=3)');
    check(fires(2, 3, 20), 'G4 (b): Komposition feuert NICHT, obwohl actIndex/minRoom/Budget/Freischaltung passen');
    check(!fires(2, 3, 9), 'G4 (b): Komposition feuert trotz zu kleinem Budget (9 < Summe 10)');
    check(!fires(2, 3, 21), 'G4 (b): Komposition feuert trotz zu GROSSEM Budget (21 > 2x Summe -- unter der 50%-Mindestausnutzung)');
    check(fires(2, 9, 20), 'G4 (b): "eingefuehrt ab minRoom, bleibt danach verfuegbar" gilt nicht -- Komposition feuert in einem SPAETEREN Raum nicht mehr');
    // Ein Rezept, das einen NOCH nicht freigeschalteten Typ nennt, darf nie
    // feuern, selbst wenn Budget/Raum sonst passen.
    const compLate = { id: 'late_comp', actIndex: 2, minRoom: 3, weight: 1, enemies: [{ type: 'late', count: 1 }] };
    {
      const rng = mulberry32(7);
      const out = buyEnemies(fakeDiff, rng, 2, 3, 10, undefined, [compLate]);
      check(!out.includes('late'), 'G4 (b): Komposition feuert mit einem an dieser Stelle noch gesperrten Typ');
    }
    // maxEnemiesPerRoom-Deckel: eine Komposition mit mehr Einheiten als der
    // Raumdeckel darf nie feuern.
    const compTooBig = { id: 'big_comp', actIndex: 2, minRoom: 1, weight: 1, enemies: [{ type: 'cheap', count: 10 }] };
    {
      const rng = mulberry32(7);
      const out = buyEnemies(fakeDiff, rng, 2, 1, 100, undefined, [compTooBig]);
      check(out.length <= fakeDiff.maxEnemiesPerRoom, `G4 (b): Komposition ueberschreitet maxEnemiesPerRoom (${out.length})`);
      check(!out.includes('cheap') || out.filter((t) => t === 'cheap').length < 10, 'G4 (b): eine ueberdimensionierte Komposition wurde trotzdem vollstaendig gekauft');
    }
    // RNG-Verbrauch: OHNE passende Komposition exakt so viele Aufrufe wie
    // die reine Zufallsschleife (kein Zusatzverbrauch); MIT passender
    // Komposition genau EIN Aufruf mehr als ohne comps ueberhaupt.
    {
      let callsNoComp = 0;
      const rngA = mulberry32(3);
      buyEnemies(fakeDiff, () => { callsNoComp++; return rngA(); }, 1, 1, 20);
      let callsWithUnmatched = 0;
      const rngB = mulberry32(3);
      buyEnemies(fakeDiff, () => { callsWithUnmatched++; return rngB(); }, 1, 1, 20, undefined, [comp]); // comp ist actIndex:2, feuert in Akt 1 nie
      check(callsNoComp === callsWithUnmatched, `G4 (b): ein NICHT treffendes comps[] veraendert den RNG-Verbrauch (${callsNoComp} vs ${callsWithUnmatched})`);
      let callsWithMatched = 0;
      const rngC = mulberry32(3);
      buyEnemies(fakeDiff, () => { callsWithMatched++; return rngC(); }, 2, 3, 20, undefined, [comp]);
      check(callsWithMatched === 1, `G4 (b): eine treffende Komposition verbraucht nicht genau einen rng()-Aufruf (${callsWithMatched})`);
    }
  }

  // (c) Mindestpunktzahl (O2): "points < budget/12" gilt NUR ab Akt 2, mit
  //     EIGENEN Punktwerten (nicht 1/2 wie t_brown/t_grey).
  {
    const fakeDiff = {
      maxEnemiesPerRoom: 8,
      danger: {
        billig: { points: 2, unlockAct: 1, unlockRoomInAct: 1 },
        teuer: { points: 20, unlockAct: 1, unlockRoomInAct: 1 },
      },
    };
    const seenIn = (actIndex, budget) => {
      const seen = new Set();
      const rng = mulberry32(11);
      for (let i = 0; i < 300; i++) for (const t of buyEnemies(fakeDiff, rng, actIndex, 1, budget)) seen.add(t);
      return seen;
    };
    // Budget 48 -> Schwelle 4 (48/12). "billig" (2 Punkte) liegt DARUNTER.
    check(seenIn(1, 48).has('billig'), 'G4 (c): Akt 1 schliesst billige Typen trotz hohen Budgets aus (Mindestpunktzahl darf dort nicht gelten)');
    check(!seenIn(2, 48).has('billig'), 'G4 (c): Akt 2 kauft "billig" trotz Budget 48 (Schwelle 4) -- Mindestpunktzahl greift nicht');
    check(seenIn(2, 48).has('teuer'), 'G4 (c): Akt 2 schliesst faelschlich auch "teuer" aus');
    // Kleines Budget in Akt 2 -> Schwelle klein genug, "billig" bleibt kaufbar.
    check(seenIn(2, 6).has('billig'), 'G4 (c): Akt 2 schliesst "billig" auch bei kleinem Budget aus (Schwelle sollte hier winzig sein)');
  }

  // (d) minRole-Quote: mit EIGENEM Rollen-/Budget-Wert, nicht der echten
  //     "hunter"/30-Kombination aus difficulty.json.
  {
    const typeDefs = { a: { role: 'sieger' }, b: { role: 'druck' } };
    const fakeDiff = {
      maxEnemiesPerRoom: 6,
      acts: [{}, {}, { minRoleQuota: { role: 'druck', minBudget: 15 } }],
      danger: {
        a: { points: 4, unlockAct: 1, unlockRoomInAct: 1 },
        b: { points: 4, unlockAct: 1, unlockRoomInAct: 1 },
      },
    };
    const hasDruck = (budget) => {
      for (let seed = 1; seed <= 40; seed++) {
        const rng = mulberry32(seed);
        if (buyEnemies(fakeDiff, rng, 3, 1, budget, typeDefs).includes('b')) return true;
      }
      return false;
    };
    check(hasDruck(20), 'G4 (d): ueber Budget >= minBudget taucht die Pflichtrolle "druck" nie auf');
    // Ohne typeDefs (keine Rollenkenntnis) darf die Quote nicht greifen
    // (kein Absturz, kein erzwungenes Ergebnis) -- reiner Sicherheits-Check.
    {
      const rng = mulberry32(1);
      const out = buyEnemies(fakeDiff, rng, 3, 1, 20); // kein typeDefs-Argument
      check(Array.isArray(out), 'G4 (d): buyEnemies() ohne typeDefs stuerzt an der Quote-Pruefung ab');
    }
  }

  // (e) maxPerRoom: das Feld existierte schon vor G4 im Code, wurde aber
  //     nie von einem Typ GESETZT -- erster echter Mechanismus-Beweis mit
  //     einem synthetischen Deckel (nicht den echten t_anchor/t_relay-Werten).
  {
    const fakeDiff = {
      maxEnemiesPerRoom: 8,
      danger: {
        einzeln: { points: 1, unlockAct: 1, unlockRoomInAct: 1, maxPerRoom: 1 },
      },
    };
    let maxSeen = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const rng = mulberry32(seed);
      const out = buyEnemies(fakeDiff, rng, 1, 1, 100);
      maxSeen = Math.max(maxSeen, out.filter((t) => t === 'einzeln').length);
    }
    check(maxSeen === 1, `G4 (e): maxPerRoom:1 haelt den Typ nicht auf hoechstens 1 Exemplar (gesehen: ${maxSeen})`);
  }

  // (f) Echte Verdrahtung: mit den ECHTEN data/compositions.json +
  //     data/difficulty.json + data/tanks.json (main.js laedt/haengt sie
  //     genauso an) muss an einem Akt-2-Raum mit ausreichendem Budget
  //     tatsaechlich eine der fuenf echten Kompositionen feuern -- nicht
  //     nur der isolierte Mechanismus aus (b).
  {
    const knownSorted = diffData.compositions
      .filter((c) => c.actIndex === 2)
      .map((c) => {
        const out = [];
        for (const e of c.enemies) for (let i = 0; i < e.count; i++) out.push(e.type);
        return out.sort().join(',');
      });
    let hits = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed);
      // Raum 8, Akt 2: Budget 26.8 (acts[1].budget.base 6 + 8*2.6) -- an
      // dieser Stelle sind mehrere Akt-2-Kompositionen bereits freigeschaltet
      // (G4 + G5-Nachtrag).
      const budget = diffData.acts[1].budget.base + 8 * diffData.acts[1].budget.perRoom;
      const out = buyEnemies(diffData, rng, 2, 8, budget, tanksData.types, diffData.compositions);
      const sorted = [...out].sort().join(',');
      if (knownSorted.includes(sorted)) hits++;
    }
    check(hits > 0, 'G4 (f): mit den ECHTEN Daten feuert an Akt 2/Raum 8 nie eine der gebauten Kompositionen -- main.js-aequivalente Verdrahtung (diffData.compositions) ist nicht korrekt');
  }
}

// ---- 73. Gegner-Umbau Phase G5 (UMBAUPLAN-GEGNER.md): Akt 2, Welle 3 -----
// Zwei letzte Akt-2-Gegner, damit sind alle acht gebaut. t_medic ("Der
// Zehrer"): repariert dauerhaft den am staerksten beschaedigten Verbuendeten
// in Reichweite mit Sichtlinie -- Baustein B (G1, tankLinks) traegt den
// Heilstrahl, kein neuer Renderer. t_mason ("Der Maurer"): baut periodisch
// eine zerstoerbare Wand ueber den seit Phase 6 bestehenden
// state.placeTrapWall()-Mechanismus (hier zum ersten Mal von der Gegner-KI
// statt vom Spieler genutzt), abgesichert durch eine neue, kleine BFS-
// Erreichbarkeitspruefung (state.wouldIsolateArea()) -- der in
// UMBAUPLAN-GEGNER.md Fund 15 vorhergesagte einzige echte Neubau dieser Welle.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createTank } = await import('../src/game/tank.js');
  const { updateEnemy } = await import('../src/game/ai.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');
  const { CELL, COLS, ROWS } = await import('../src/config.js');

  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  // Komplett offener Innenraum mit solidem Rand -- volle, vorhersagbare
  // Kontrolle ueber Kandidatenzellen/Erreichbarkeit statt eines zufaellig
  // generierten Layouts (Muster wie g2Room()/g3Room() oben, aber mit einem
  // von Grund auf neu gebauten Grid statt nur `isSolid`/`walls` zu leeren --
  // t_masons Mechanismus liest `grid` DIREKT, nicht ueber isSolid()).
  function masonRoom() {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: [],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
    });
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        st.grid[r][c] = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? '#' : '.';
      }
    }
    st.walls = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (st.grid[r][c] === '#') st.walls.push({ x: c * CELL, y: r * CELL, w: CELL, h: CELL, type: 'solid', col: c, row: r });
    // Bewusst KEIN blocksSight-Override (anders als g2Room/g3Room) -- die
    // LOS-Pruefung in (c) braucht die ECHTE, grid-basierte Sichtlinie.
    return st;
  }
  // Bewusst KEIN eigener blocksSight-Override (anders als g2Room/g3Room) --
  // die LOS-Pruefung in (c) braucht die ECHTE, grid-basierte Sichtlinie
  // (masonRoom() rebuildet das Grid bereits vollstaendig offen, ein Wall-Cell
  // reicht als echtes Hindernis). Ein Alias reicht, medicRoom() ist identisch
  // zu masonRoom().
  const medicRoom = masonRoom;

  // ---- (a) Struktur: beide Typen + Akt-2-Freischaltung ---------------------
  {
    const m = tanksData.types.t_medic;
    check(!!m?.heal && m.weapon === 'bullet', 'G5 (a): t_medic fehlt oder traegt kein heal');
    check(
      typeof m.heal.ratePerS === 'number' && typeof m.heal.rangePx === 'number' && m.heal.needsLos === true,
      'G5 (a): t_medic.heal unvollstaendig',
    );
    const b = tanksData.types.t_mason;
    check(!!b?.build && b.weapon === 'bullet', 'G5 (a): t_mason fehlt oder traegt kein build');
    check(
      typeof b.build.everyS === 'number' && typeof b.build.buildS === 'number' && typeof b.build.maxAlive === 'number',
      'G5 (a): t_mason.build unvollstaendig',
    );
    check(diffData.danger.t_medic?.unlockAct === 2, 'G5 (a): t_medic ist nicht in Akt 2 freigeschaltet');
    check(diffData.danger.t_mason?.unlockAct === 2 && diffData.danger.t_mason?.maxPerRoom === 1, 'G5 (a): t_mason fehlt Akt-2-Freischaltung oder maxPerRoom:1');
  }

  // Isoliert das Heilsystem von zwei Stoerquellen, die beim Testbau echte
  // Ergebnisse verfaelscht haben (kein Code-Bug, reine Testaufbau-Fallen):
  // (1) t_medic UND t_grey sind Rolle "sapper" und wandern -- ueber viele
  // Ticks laufen sie aus heal.rangePx heraus, der Heilfortschritt bleibt
  // dann auf halbem Weg stehen. (2) die Trefferschleife kennt kein
  // Teamsystem (UMBAUPLAN-GEGNER.md Falle 2) -- der Zehrer trifft mit
  // seiner EIGENEN Waffe (25 Schaden) den nur 10 px entfernten Verbuendeten
  // fast sofort und wirft dessen LP weit unter das erwartete Ergebnis.
  // freeze() macht einen Testpanzer bewegungs- UND wehrlos, ohne die
  // Heil-cfg (heal) anzutasten.
  function freeze(tank) {
    tank.cfg = { ...tank.cfg, role: 'guardian', weapon: null };
    return tank;
  }

  // ---- (b) t_medic: heilt den staerker beschaedigten von zwei moeglichen ---
  //          Zielen, nicht sich selbst, nicht den Spieler, deckelt auf maxHp.
  {
    const st = medicRoom();
    const medic = freeze(createTank('t_medic', resolveCfg(tanksData, 't_medic'), 200, 200));
    const near = freeze(createTank('t_brown', resolveCfg(tanksData, 't_brown'), 210, 200)); // 10px entfernt, LOS frei
    const far = freeze(createTank('t_grey', resolveCfg(tanksData, 't_grey'), 200, 260)); // 60px entfernt, LOS frei
    near.hp = near.cfg.maxHp - 5; // leicht beschaedigt
    far.hp = far.cfg.maxHp - 20; // STAERKER beschaedigt -- muss gewinnen
    // Reihenfolge bewusst [medic, far, near] -- NICHT [medic, near, far]:
    // Testfund per Gegenprobe: eine erste Fassung mit near-vor-far liess
    // eine entfernte Staerkevergleich-Bedingung unbemerkt, weil far (der
    // korrekte Sieger) durch reinen Iterationszufall ohnehin zuletzt
    // verarbeitet wurde. Mit far zuerst muss die Auswahl wirklich nach
    // Schadensbetrag entscheiden, nicht nach Listenposition.
    st.tanks = [medic, far, near];
    stepState(st, CMD0, 1 / 60);
    check(far.hp > far.cfg.maxHp - 20, 'G5 (b): der STAERKER beschaedigte Verbuendete wird nicht geheilt');
    check(near.hp === near.cfg.maxHp - 5, 'G5 (b): der leichter beschaedigte Verbuendete wird faelschlich MITgeheilt (Zehrer heilt nur EINEN)');
    check(medic.hp === medic.cfg.maxHp, 'G5 (b): der Zehrer heilt sich selbst');
    check(st.tankLinks.some((l) => l.x0 === medic.x && l.y0 === medic.y), 'G5 (b): kein Heilstrahl-Eintrag in state.tankLinks');
    // Deckel auf maxHp: viele Ticks duerfen NICHT ueber maxHp heilen -- UND
    // beide Ziele muessen (der Reihe nach) volle LP erreichen, sobald die
    // Gesamt-Heilkapazitaet ueber der Gesamt-Deckungsluecke liegt.
    for (let i = 0; i < 600; i++) stepState(st, CMD0, 1 / 60);
    check(far.hp === far.cfg.maxHp, `G5 (b): far erreicht nicht maxHp (${far.hp} statt ${far.cfg.maxHp})`);
    check(near.hp === near.cfg.maxHp, `G5 (b): near erreicht nicht maxHp, obwohl genug Zeit/Heilkapazitaet da war (${near.hp} statt ${near.cfg.maxHp})`);
  }

  // ---- (c) t_medic: Reichweite + Sichtlinie ---------------------------------
  {
    const st = medicRoom();
    const medic = freeze(createTank('t_medic', resolveCfg(tanksData, 't_medic'), 200, 200));
    const farAway = freeze(createTank('t_brown', resolveCfg(tanksData, 't_brown'), 200, 200 + medic.cfg.heal.rangePx + 50));
    farAway.hp = farAway.cfg.maxHp - 10;
    st.tanks = [medic, farAway];
    stepState(st, CMD0, 1 / 60);
    check(farAway.hp === farAway.cfg.maxHp - 10, 'G5 (c): heilt trotz Ziel ausserhalb von heal.rangePx');
    // Sichtlinie blockiert -- eine Wand direkt zwischen beiden.
    const st2 = medicRoom();
    const medic2 = freeze(createTank('t_medic', resolveCfg(tanksData, 't_medic'), 200, 200));
    const blocked = freeze(createTank('t_brown', resolveCfg(tanksData, 't_brown'), 260, 200));
    blocked.hp = blocked.cfg.maxHp - 10;
    st2.tanks = [medic2, blocked];
    const wallCol = Math.floor(230 / CELL);
    const wallRow = Math.floor(200 / CELL);
    st2.grid[wallRow][wallCol] = '#';
    stepState(st2, CMD0, 1 / 60);
    check(blocked.hp === blocked.cfg.maxHp - 10, 'G5 (c): heilt trotz blockierter Sichtlinie');
  }

  // ---- (d) t_mason: kompletter Baukreislauf -- Geruest -> echte Wand -------
  {
    const st = masonRoom();
    const mason = createTank('t_mason', resolveCfg(tanksData, 't_mason'), 300, 200);
    mason.masonTimer = 0; // erster Versuch sofort, nicht erst nach everyS
    // Ziel WEIT hinter der Baudistanz (nicht genau bei distancePx -- sonst
    // faellt die Kandidatenzelle exakt auf den Spieler und minPlayerDistCells
    // wuerde den Bau selbst ablehnen, s. Testfund unten bei (e)). Kandidaten-
    // zelle liegt dadurch deterministisch bei (300, 320), weit vom Spieler.
    st.player.x = 300;
    st.player.y = 200 + mason.cfg.build.distancePx * 2;
    st.tanks = [mason];
    stepState(st, CMD0, 1 / 60);
    check(!!mason.masonBuildState, 'G5 (d): kein Bauversuch gestartet, obwohl freie Zelle + Timer abgelaufen');
    check(st.masonScaffolds.length === 1, 'G5 (d): kein Geruest-Telegraph erschienen');
    const { col, row } = mason.masonBuildState;
    check(st.grid[row][col] === '.', 'G5 (d): die Zelle ist waehrend des Geruests schon solide (muss erst NACH buildS entstehen)');
    // Waehrend des Bauens steht der Maurer still. updateEnemy() liefert
    // {move:{x,y}, fire, mine} -- die Bewegung steckt in .move, nicht direkt
    // im Rueckgabewert (Testaufbau-Fund, per Gegenprobe an der falschen
    // Feldzugriff-Fassung bestaetigt).
    const result = updateEnemy(mason, st, 1 / 60);
    check(result.move.x === 0 && result.move.y === 0, 'G5 (d): der Maurer bewegt sich waehrend der Bauzeit');
    // buildS Sekunden vergehen -> die Wand wird real.
    for (let i = 0; i < Math.ceil(mason.cfg.build.buildS * 60) + 2; i++) stepState(st, CMD0, 1 / 60);
    check(st.grid[row][col] === '#', 'G5 (d): nach Ablauf der Bauzeit ist die Zelle nicht solide');
    check(st.masonScaffolds.length === 0, 'G5 (d): das Geruest verschwindet nach der Fertigstellung nicht');
    const wall = st.walls.find((w) => w.col === col && w.row === row);
    check(!!wall && wall.customDurability === mason.cfg.build.hits, `G5 (d): keine echte Wand mit ${mason.cfg.build.hits} Treffern an der Zielzelle`);
    check(mason.masonWalls.includes(wall), 'G5 (d): die neue Wand ist nicht in mason.masonWalls eingetragen');
    check(!mason.masonBuildState, 'G5 (d): masonBuildState wird nach der Fertigstellung nicht zurueckgesetzt');
  }

  // ---- (e) t_mason: minPlayerDistCells -- keine Wand zu nah am Spieler -----
  {
    const st = masonRoom();
    const mason = createTank('t_mason', resolveCfg(tanksData, 't_mason'), 300, 200);
    mason.masonTimer = 0;
    // Ziel (Spieler) genau in Bauentfernung -- die Kandidatenzelle liegt
    // damit praktisch AUF dem Spieler, weit unter minPlayerDistCells.
    st.player.x = 300 + mason.cfg.build.distancePx;
    st.player.y = 200;
    st.tanks = [mason];
    // Spieler auf die exakte Kandidatenzelle setzen (statt daneben), damit
    // der Abstand garantiert < minPlayerDistCells ist.
    stepState(st, CMD0, 1 / 60);
    check(!mason.masonBuildState, 'G5 (e): baut trotz Spieler auf/neben der Kandidatenzelle (minPlayerDistCells missachtet)');
  }

  // ---- (f) t_mason: state.wouldIsolateArea() -- "Sicherung gegen Frust" ----
  {
    const st = masonRoom();
    // Eine durchgehende Trennwand ueber die GANZE Raumhoehe (Spalte
    // doorCol, jede Innenzeile) mit GENAU EINER Luecke bei doorRow -- die
    // einzige Verbindung zwischen links und rechts. Testfund: eine erste
    // Fassung setzte nur drei Waendchen ueber/unter der Luecke, liess Zeile
    // doorRow selbst aber komplett durchgehend offen -- die "Luecke" war
    // dadurch gar kein Flaschenhals (links und rechts blieben laengs der
    // Zeile ohnehin verbunden), die Pruefung also trivial unerreichbar.
    const doorCol = 12;
    const doorRow = 8;
    for (let r = 1; r < ROWS - 1; r++) {
      if (r !== doorRow) st.grid[r][doorCol] = '#';
    }
    st.player.x = 5 * CELL;
    st.player.y = doorRow * CELL + CELL / 2;
    check(st.wouldIsolateArea(doorCol, doorRow), 'G5 (f): die einzige Verbindungszelle eines Engpasses gilt als unbedenklich (BFS-Mechanismus kaputt)');
    // Eine Zelle NEBEN dem Engpass (nicht der Flaschenhals selbst) darf
    // dagegen normal verbaut werden -- Kontrolle, dass wouldIsolateArea()
    // nicht pauschal alles blockiert.
    check(!st.wouldIsolateArea(3, 3), 'G5 (f): eine harmlose, offene Zelle gilt faelschlich als Flaschenhals');
    // Integrationsnachweis: derselbe Engpass, aber jetzt ueber den ECHTEN
    // Baukreislauf (updateMasons()) statt nur den direkten wouldIsolateArea()-
    // Aufruf -- Testfund per Gegenprobe: den Aufruf in updateMasons() selbst
    // zu entfernen liess (f) bis hierhin unbemerkt, weil bis dahin nur die
    // freistehende BFS-Methode geprueft wurde, nie ihre Verdrahtung in den
    // Bauentscheid.
    const doorX = doorCol * CELL + CELL / 2;
    const doorY = doorRow * CELL + CELL / 2;
    const mason = createTank('t_mason', resolveCfg(tanksData, 't_mason'), doorX - tanksData.types.t_mason.build.distancePx, doorY);
    mason.masonTimer = 0;
    st.player.x = doorX + 200; // rechts von der Luecke, gleiche Zeile -- Kandidatenzelle faellt exakt auf die Luecke
    st.player.y = doorY;
    st.tanks = [mason];
    stepState(st, CMD0, 1 / 60);
    check(!mason.masonBuildState, 'G5 (f): der Maurer versucht trotzdem, die einzige Verbindungszelle eines Engpasses zu verbauen');
    check(st.grid[doorRow][doorCol] === '.', 'G5 (f): die Engpass-Zelle wurde solide, obwohl der Bau haette verweigert werden muessen');
  }

  // ---- (g) t_mason: maxAlive-Deckel + Verfall nach decayS -------------------
  // Zwei GETRENNTE Szenarien (Testfund per Gegenprobe): mit einer kurzen
  // decayS UND einem kurzen everyS im selben Lauf verfaellt die erste Wand
  // laengst von selbst, bevor der maxAlive-Check ueberhaupt greifen kann --
  // ein entfernter maxAlive-Deckel fiel dadurch nie auf (der Zaehlerstand
  // 0/1 war durch den Verfall bereits erklaert, nicht durch den Deckel).
  {
    // (g1) maxAlive: decayS bewusst UNERREICHBAR gross, damit ausschliesslich
    // der Deckel ueber den Zaehlerstand entscheidet.
    const st = masonRoom();
    const mason = createTank('t_mason', resolveCfg(tanksData, 't_mason'), 300, 200);
    mason.cfg = { ...mason.cfg, build: { ...mason.cfg.build, maxAlive: 1, everyS: 0.01, decayS: 1000 } };
    mason.masonTimer = 0;
    // Wie bei (d): Ziel WEIT hinter der Baudistanz, sonst faellt die
    // Kandidatenzelle auf den Spieler und minPlayerDistCells blockiert
    // jeden Bauversuch.
    st.player.x = 300;
    st.player.y = 200 + mason.cfg.build.distancePx * 2;
    st.tanks = [mason];
    // Erste Wand fertigstellen.
    stepState(st, CMD0, 1 / 60);
    for (let i = 0; i < Math.ceil(mason.cfg.build.buildS * 60) + 2; i++) stepState(st, CMD0, 1 / 60);
    check(mason.masonWalls.length === 1, `G5 (g1): erste Wand nicht gebaut (masonWalls=${mason.masonWalls.length})`);
    // Ziel wechselt die Richtung -- die naechste Kandidatenzelle liegt
    // dadurch woanders (frei, nicht durch die schon gebaute erste Wand
    // besetzt). Ohne diesen Richtungswechsel scheitert der zweite Versuch
    // schon an der "besetzte Zelle"-Pruefung, NICHT am maxAlive-Deckel.
    st.player.x = 300 + mason.cfg.build.distancePx * 2;
    st.player.y = 200;
    // Naechster Zyklus (Timer laeuft dank everyS:0.01 sofort wieder ab) --
    // darf wegen maxAlive:1 KEINE zweite Wand anlegen.
    for (let i = 0; i < 60; i++) stepState(st, CMD0, 1 / 60);
    check(mason.masonWalls.length === 1, `G5 (g1): maxAlive:1 haelt den Maurer nicht auf hoechstens 1 eigene Wand (${mason.masonWalls.length})`);
  }
  {
    // (g2) Verfall: maxAlive bewusst hoch (spielt keine Rolle), decayS kurz.
    const st = masonRoom();
    const mason = createTank('t_mason', resolveCfg(tanksData, 't_mason'), 300, 200);
    mason.cfg = { ...mason.cfg, build: { ...mason.cfg.build, maxAlive: 10, everyS: 5, decayS: 0.2 } };
    mason.masonTimer = 0;
    st.player.x = 300;
    st.player.y = 200 + mason.cfg.build.distancePx * 2;
    st.tanks = [mason];
    stepState(st, CMD0, 1 / 60);
    for (let i = 0; i < Math.ceil(mason.cfg.build.buildS * 60) + 2; i++) stepState(st, CMD0, 1 / 60);
    check(mason.masonWalls.length === 1, `G5 (g2): erste Wand nicht gebaut (masonWalls=${mason.masonWalls.length})`);
    const firstWallCount = st.walls.length;
    // Kurz VOR decayS (0,2 s minus ein paar Ticks): die Wand muss noch stehen.
    for (let i = 0; i < 8; i++) stepState(st, CMD0, 1 / 60);
    check(mason.masonWalls.length === 1, 'G5 (g2): die Wand verfaellt zu frueh (vor decayS)');
    // Nach decayS: die Wand verschwindet von selbst, unabhaengig von Treffern.
    for (let i = 0; i < 15; i++) stepState(st, CMD0, 1 / 60);
    check(mason.masonWalls.length === 0, 'G5 (g2): die eigene Wand verfaellt nicht nach decayS');
    check(st.walls.length < firstWallCount, 'G5 (g2): die verfallene Wand steht noch in state.walls');
  }
}

// ---- 74. Gegner-Umbau Phase G6 (UMBAUPLAN-GEGNER.md): Akt 3, Welle 1 -----
// Die vier "konservativen" Akt-3-Gegner -- keiner brauchte eine neue
// Kernarchitektur. t_bulwark ist reine Datenuebernahme (radius-Override seit
// dem Amboss-Auftrag, armor.reflects:false war bereits seit PLAN.md v2
// vollstaendig ausgewertet, nur bisher von keinem Typ genutzt). t_arclight
// aktiviert nur ein laengst gebautes, gegnerseitig bislang ungenutztes
// System (damageType:'lightning', UMBAUPLAN-LP Phase 6). Echte neue Mechanik
// gibt es nur bei t_marshal (Feuerraten-Aura ueber Baustein A/B aus G1) und
// t_stalker (distanzbasierte Tarnung, Enttarnung ueber den bestehenden
// fireWindupS-Mechanismus aus G2).
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createTank, fireBullet } = await import('../src/game/tank.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { roleTurret } = await import('../src/game/ai_turrets.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');
  const { CELL, COLS, ROWS } = await import('../src/config.js');

  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  // Komplett offener Innenraum mit solidem Rand (Muster masonRoom() oben) --
  // volle, vorhersagbare Kontrolle ueber Positionen/Sichtlinien statt eines
  // zufaellig generierten Layouts.
  function openRoom() {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: [],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
    });
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) st.grid[r][c] = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? '#' : '.';
    st.walls = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (st.grid[r][c] === '#') st.walls.push({ x: c * CELL, y: r * CELL, w: CELL, h: CELL, type: 'solid', col: c, row: r });
    return st;
  }

  // ---- (a) Struktur: alle vier Typen + Akt-3-Freischaltung -----------------
  {
    const M = tanksData.types.t_marshal;
    check(!!M?.rally && M.weapon === 'bullet', 'G6 (a): t_marshal fehlt oder traegt kein rally');
    check(
      typeof M.rally.fireRateMult === 'number' && M.rally.needsLos === true && typeof M.rally.maxTargets === 'number',
      'G6 (a): t_marshal.rally unvollstaendig',
    );
    const B = tanksData.types.t_bulwark;
    check(!!B?.armor && B.armor.reflects === false && B.armor.arc === 160 && B.radius === 22, 'G6 (a): t_bulwark fehlt armor/radius-Override');
    const S = tanksData.types.t_stalker;
    check(!!S?.stalk && typeof S.fireWindupS === 'number', 'G6 (a): t_stalker fehlt stalk oder fireWindupS');
    check(
      typeof S.stalk.cloakBeyondPx === 'number' && typeof S.stalk.revealBeforeShotS === 'number' && typeof S.stalk.revealedS === 'number',
      'G6 (a): t_stalker.stalk unvollstaendig',
    );
    check(
      S.fireWindupS === S.stalk.revealBeforeShotS,
      'G6 (a): t_stalker.fireWindupS stimmt nicht mit stalk.revealBeforeShotS ueberein (der Enttarnungsmechanismus setzt genau das voraus)',
    );
    const A = tanksData.types.t_arclight;
    check(A?.damageType === 'lightning', 'G6 (a): t_arclight traegt kein damageType:lightning');
    for (const id of ['t_marshal', 't_bulwark', 't_stalker', 't_arclight']) {
      check(diffData.danger[id]?.unlockAct === 3, `G6 (a): ${id} ist nicht in Akt 3 freigeschaltet`);
    }
  }

  // ---- (b) t_bulwark: Fronttreffer wirkungslos (kein Schaden, KEIN
  //          Zurueckprallen -- reflects:false), Hecktreffer normal mit
  //          dem vollen Heckbonus (2,5x, Grundsteinumbau Phase 2). -------
  {
    const bcfg = resolveCfg(tanksData, 't_bulwark');
    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    const shootAt = (offsetAngleDeg) => {
      const z = {
        ...proto, x: 200, y: 250, prevX: 200, prevY: 250, heading: 0,
        alive: true, hp: 9999, protect: 0, shieldReady: false, status: {},
        cfg: { ...bcfg, maxHp: 9999 },
      };
      st.tanks.length = 0;
      st.tanks.push(st.player, z);
      const off = (offsetAngleDeg * Math.PI) / 180;
      const b = createBullet(z.x + Math.cos(off) * 2, z.y + Math.sin(off) * 2, 0, {
        speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 10,
      });
      b.age = 5;
      st.bullets.length = 0;
      st.mines.length = 0;
      st.bullets.push(b);
      stepState(st, CMD0, 1 / 60);
      return { z, b };
    };
    const front = shootAt(0);
    check(front.z.hp === 9999, `G6 (b): Fronttreffer gegen t_bulwark richtet Schaden an (hp ${front.z.hp})`);
    check(front.b.dead === true && !front.b.reflected, 'G6 (b): der Fronttreffer stirbt nicht ohne zu reflektieren (armor.reflects:false)');
    const rear = shootAt(180);
    check(9999 - rear.z.hp === 25, `G6 (b): Hecktreffer gegen t_bulwark ${9999 - rear.z.hp} statt 25 (2,5x Heckbonus)`);
  }

  // ---- (c) t_marshal: Feuerraten-Aura ueber freie Sichtlinie, KEIN Radius,
  //          Deckel PRO FELDWEBEL, Spieler/Selbst nie Ziel, Fahnenlinie,
  //          und der Multiplikator wirkt wirklich auf tank.cooldown (seit
  //          Baustein A/G1 in tank.js: fireBullet() verdrahtet). ----------
  {
    const mcfg = resolveCfg(tanksData, 't_marshal');
    const allyCfg = resolveCfg(tanksData, 't_brown');

    const st = openRoom();
    const marshal = createTank('t_marshal', mcfg, 100, 100);
    const seen = createTank('t_brown', allyCfg, 150, 100);
    // BEWUSST in Reichweite MIT freier Sicht platziert (nicht "ausser
    // Reichweite") -- eine Gegenprobe zeigte, dass der 9999,9999-Platzhalter
    // den Spieler-Ausschluss NIE wirklich pruefte: er scheiterte schon an der
    // LOS-Pflicht, unabhaengig vom expliziten "t === state.player"-Filter.
    // Nur ein Spieler, der die Bedingungen sonst erfuellen WUERDE, kann den
    // Ausschluss selbst beweisen.
    st.player.x = 120;
    st.player.y = 100;
    st.tanks = [st.player, marshal, seen];
    stepState(st, CMD0, 1 / 60);
    check(seen.auraFlags.fireRateMult === mcfg.rally.fireRateMult, `G6 (c): sichtbarer Verbuendeter bekommt fireRateMult nicht (${seen.auraFlags.fireRateMult})`);
    check(marshal.auraFlags.fireRateMult === 1, 'G6 (c): der Feldwebel verstaerkt sich selbst');
    check(st.player.auraFlags.fireRateMult === 1, 'G6 (c): der Spieler wird faelschlich verstaerkt');
    // Gegen die literalen Startkoordinaten pruefen, nicht gegen die Panzer
    // NACH dem Tick (G3-Fund: die Fahnenlinie wird frueh im Tick gepusht,
    // VOR der spaeteren Gegner-Bewegungsphase -- der Feldwebel selbst ist
    // Rolle 'sieger' und bewegt sich im selben Tick noch ein Stueck).
    check(
      st.tankLinks.some((l) => l.x0 === 100 && l.y0 === 100 && l.x1 === 150 && l.y1 === 100),
      'G6 (c): keine Fahnenlinie fuer den verstaerkten Verbuendeten',
    );

    // LOS-Pflicht: eine Wand zwischen Feldwebel und Verbuendetem hebt die
    // Verstaerkung wieder auf.
    const st2 = openRoom();
    const marshal2 = createTank('t_marshal', mcfg, 100, 100);
    const blocked = createTank('t_brown', allyCfg, 200, 100);
    st2.player.x = 9999;
    st2.player.y = 9999;
    st2.tanks = [st2.player, marshal2, blocked];
    const wallCol = Math.floor(150 / CELL);
    const wallRow = Math.floor(100 / CELL);
    st2.grid[wallRow][wallCol] = '#';
    stepState(st2, CMD0, 1 / 60);
    check(blocked.auraFlags.fireRateMult === 1, 'G6 (c): eine Wand zwischen Feldwebel und Verbuendetem hebt die Verstaerkung nicht auf');

    // maxTargets-Deckel: mehr Verbuendete als maxTargets -- nur bis zum
    // Deckel werden verstaerkt.
    const st3 = openRoom();
    const marshal3 = createTank('t_marshal', { ...mcfg, rally: { ...mcfg.rally, maxTargets: 2 } }, 100, 100);
    const allies = [0, 1, 2, 3].map((i) => createTank('t_brown', allyCfg, 100 + (i + 1) * 10, 100));
    st3.player.x = 9999;
    st3.player.y = 9999;
    st3.tanks = [st3.player, marshal3, ...allies];
    stepState(st3, CMD0, 1 / 60);
    const boostedCount = allies.filter((a) => a.auraFlags.fireRateMult < 1).length;
    check(boostedCount === 2, `G6 (c): maxTargets:2 wird nicht durchgesetzt (${boostedCount} statt 2 verstaerkte Verbuendete)`);

    // End-zu-Ende: der Multiplikator wirkt wirklich auf tank.cooldown, nicht
    // nur auf ein isoliertes Datenfeld.
    const boosted = allies[0];
    boosted.turret = 0;
    fireBullet(boosted, st3, true);
    const plain = allies[3]; // ausserhalb des Deckels -- nicht verstaerkt
    plain.turret = 0;
    fireBullet(plain, st3, true);
    check(
      boosted.cooldown < plain.cooldown,
      `G6 (c): verstaerkte Feuerrate wirkt nicht auf tank.cooldown (${boosted.cooldown} vs. ${plain.cooldown})`,
    );
  }

  // ---- (d) t_stalker: Tarnung ausserhalb cloakBeyondPx, Enttarnung ueber
  //          den Windup-Start in roleTurret() (fireWindupS ==
  //          stalk.revealBeforeShotS), Rueckkehr zur Tarnung nach Ablauf
  //          des gesamten Enttarnungsfensters. -----------------------------
  {
    const scfg = resolveCfg(tanksData, 't_stalker');

    const st = openRoom();
    const stalker = createTank('t_stalker', scfg, 100, 100);
    st.player.x = 100 + scfg.stalk.cloakBeyondPx + 50;
    st.player.y = 100;
    st.tanks = [st.player, stalker];
    stepState(st, CMD0, 1 / 60);
    check(stalker.stalkCloaked === true, 'G6 (d): ausserhalb cloakBeyondPx ohne Reveal-Fenster ist er sichtbar');

    st.player.x = 100 + scfg.stalk.cloakBeyondPx - 20;
    stepState(st, CMD0, 1 / 60);
    check(stalker.stalkCloaked === false, 'G6 (d): innerhalb cloakBeyondPx bleibt er getarnt');

    const st2 = openRoom();
    const stalker2 = createTank('t_stalker', scfg, 100, 100);
    st2.tanks = [st2.player, stalker2];
    st2.player.x = 100 + scfg.stalk.cloakBeyondPx + 50;
    st2.player.y = 100;
    stalker2.turret = 0; // zeigt bereits exakt auf den Spieler
    roleTurret(stalker2, st2, 1 / 60);
    check(stalker2.stalkRevealUntil > st2.time, 'G6 (d): roleTurret() setzt beim Windup-Start kein stalkRevealUntil');
    stepState(st2, CMD0, 1 / 60);
    check(stalker2.stalkCloaked === false, 'G6 (d): das Reveal-Fenster hebt die Tarnung nicht auf');

    // Bewegungs-/Feuerlogik einfrieren, damit die restlichen Ticks NUR den
    // Timer pruefen (Fehlerklasse aus G5: Bewegungsdrift durch normale KI).
    // weapon:null laesst roleTurret() VOR dem Windup-Block abbrechen (Trap-1-
    // Sicherheitsnetz), stalkRevealUntil bleibt dadurch unangetastet stehen.
    stalker2.cfg = { ...stalker2.cfg, role: 'guardian', weapon: null };
    const totalWindow = scfg.stalk.revealBeforeShotS + scfg.stalk.revealedS;
    const ticks = Math.ceil(totalWindow * 60) + 5;
    for (let i = 0; i < ticks; i++) stepState(st2, CMD0, 1 / 60);
    check(stalker2.stalkCloaked === true, 'G6 (d): die Tarnung kehrt nach Ablauf des Reveal-Fensters nicht zurueck');
  }

  // ---- (e) t_arclight: damageType 'lightning' traegt end-zu-ende durch die
  //          Trefferschleife -- ein GEGNERISCHES (nicht spieler-eigenes)
  //          Geschoss loest beim Aufschlag auf Ziel A eine Kette auf ein
  //          nahes Ziel B aus (kein Team-System, s. CLAUDE.md -- die Kette
  //          funktioniert unabhaengig vom Besitzer). --------------------------
  {
    const arcCfg = resolveCfg(tanksData, 't_arclight');
    check(arcCfg.damageType === 'lightning', `G6 (e): t_arclight.damageType ist ${arcCfg.damageType} statt 'lightning'`);

    const st = createRun(tanksData, tilesData, diffData, upgradesData, 42).state;
    const proto = st.tanks.find((t) => t !== st.player && t.alive);
    const mk = (x, y) => ({
      ...proto, x, y, prevX: x, prevY: y, heading: 0, alive: true, hp: 999, protect: 0,
      shieldReady: false, status: {}, cfg: { ...proto.cfg, role: 'guardian', maxHp: 999, armor: null, requiresRicochet: false },
    });
    const shooter = { ...proto, x: 0, y: 0, alive: true, hp: 999, cfg: { ...arcCfg, radius: proto.cfg.radius } };
    // (200,250) statt (200,200): dieselbe offene Zelle wie im flankTreffer()-
    // Helfer aus Abschnitt 47 -- (200,200) liegt in diesem Seed zufaellig auf
    // einer Wand (Testaufbau-Fund, kein Code-Bug: die Kugel starb dort schon
    // am Wandkontakt, bevor sie je ein Ziel erreichte).
    const targetA = mk(200, 250);
    const targetB = mk(250, 250); // 50px entfernt, deutlich innerhalb jumpRangePx (160)
    st.tanks = [st.player, shooter, targetA, targetB];
    const b = createBullet(targetA.x + 2, targetA.y, 0, {
      speed: 1, radius: 3, owner: shooter, kind: 'bullet', damage: 40, damageType: 'lightning',
    });
    b.age = 5;
    st.bullets.length = 0;
    st.mines.length = 0;
    st.bullets.push(b);
    stepState(st, CMD0, 1 / 60);
    check(targetA.hp < 999, 'G6 (e): Ziel A nimmt keinen Aufschlagsschaden');
    check(targetB.hp < 999, 'G6 (e): der Blitz springt nicht auf ein zweites, nahes Ziel (kein Kettensprung von einem Nicht-Spieler-Schuetzen)');
  }
}

// ---- 75. Gegner-Umbau Phase G7 (UMBAUPLAN-GEGNER.md): Akt 3, die ersten
// zwei "alternativen" Mechaniken -- t_tether (Kettenhund) und t_harvester
// (Verwerter). Beide sind die ersten Gegner im Spiel, deren Wert von einem
// ANDEREN Ereignis abhaengt (ein Partner-Panzer bzw. ein Tod in der Naehe),
// nicht nur von sich selbst wie alle bisherigen Typen.
{
  const { createState, stepState, bondTethers } = await import('../src/game/state.js');
  const { createTank } = await import('../src/game/tank.js');
  const { killGhost } = await import('../src/game/ghost.js');
  const { tetherStandoffDrive } = await import('../src/game/ai_drives.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');
  const { CELL, COLS, ROWS } = await import('../src/config.js');

  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  function openRoom() {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: [],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
    });
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) st.grid[r][c] = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? '#' : '.';
    st.walls = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (st.grid[r][c] === '#') st.walls.push({ x: c * CELL, y: r * CELL, w: CELL, h: CELL, type: 'solid', col: c, row: r });
    return st;
  }

  // ---- (a) Struktur ----------------------------------------------------
  {
    const T = tanksData.types.t_tether;
    check(!!T?.tether && T.weapon === 'bullet', 'G7 (a): t_tether fehlt oder traegt kein tether');
    check(
      typeof T.tether.splitPct === 'number' && typeof T.tether.breakDistPx === 'number' && T.tether.breakOnWall === true && T.tether.preferSameType === true,
      'G7 (a): t_tether.tether unvollstaendig',
    );
    const H = tanksData.types.t_harvester;
    check(!!H?.harvest && H.weapon === 'bullet', 'G7 (a): t_harvester fehlt oder traegt kein harvest');
    check(
      typeof H.harvest.radiusPx === 'number' && typeof H.harvest.hpPerStack === 'number' && typeof H.harvest.damagePerStack === 'number',
      'G7 (a): t_harvester.harvest unvollstaendig',
    );
    for (const id of ['t_tether', 't_harvester']) {
      check(diffData.danger[id]?.unlockAct === 3, `G7 (a): ${id} ist nicht in Akt 3 freigeschaltet`);
    }
  }

  // ---- (b) bondTethers(): bevorzugt einen zweiten Kettenhund vor einem
  //          naeheren Nicht-Kettenhund, ist immer MUTUAL, und ein einzelner
  //          Kettenhund ohne gleichartigen Partner bindet sich an den
  //          naechstgelegenen Verbuendeten. ------------------------------
  {
    const tcfg = resolveCfg(tanksData, 't_tether');
    const allyCfg = resolveCfg(tanksData, 't_brown');
    const a = createTank('t_tether', tcfg, 100, 100);
    const bAlly = createTank('t_brown', allyCfg, 110, 100); // NAEHER an a als c
    const c = createTank('t_tether', tcfg, 300, 100); // weiter weg, aber gleicher Typ
    bondTethers([a, bAlly, c]);
    check(a.tetherPartner === c && c.tetherPartner === a, 'G7 (b): preferSameType bindet nicht an den zweiten Kettenhund vor dem naeheren Nicht-Kettenhund');
    check(!bAlly.tetherPartner, 'G7 (b): ein Nicht-Kettenhund bekommt faelschlich einen tetherPartner');

    // Kein gleichartiger Partner vorhanden -> naechstgelegener Verbuendeter.
    const d = createTank('t_tether', tcfg, 500, 500);
    const e = createTank('t_brown', allyCfg, 520, 500);
    const f = createTank('t_brown', allyCfg, 700, 500);
    bondTethers([d, e, f]);
    check(d.tetherPartner === e && e.tetherPartner === d, 'G7 (b): ohne gleichartigen Partner bindet sich der Kettenhund nicht an den naechstgelegenen Verbuendeten');
    check(!f.tetherPartner, 'G7 (b): ein zu weit entfernter Verbuendeter wird faelschlich gebunden');
  }

  // ---- (c) Schadensteilung: 50/50, GESAMTSCHADEN bleibt gleich (nicht
  //          verdoppelt). ------------------------------------------------
  {
    const st = openRoom();
    const tcfg = resolveCfg(tanksData, 't_tether');
    const a = createTank('t_tether', tcfg, 100, 100);
    const b = createTank('t_tether', tcfg, 150, 100);
    a.tetherPartner = b;
    b.tetherPartner = a;
    st.tanks = [st.player, a, b];
    st.applyDamage(a, 20, 'test', {});
    check(a.hp === a.cfg.maxHp - 10, `G7 (c): a nimmt nicht die Haelfte (${a.cfg.maxHp - a.hp} statt 10)`);
    check(b.hp === b.cfg.maxHp - 10, `G7 (c): der Partner b nimmt nicht ebenfalls die Haelfte (${b.cfg.maxHp - b.hp} statt 10)`);
    check(a.cfg.maxHp - a.hp + (b.cfg.maxHp - b.hp) === 20, 'G7 (c): der Gesamtschaden ist nicht mehr 20 (verdoppelt oder verloren)');
  }

  // ---- (d) 6 Treffer a 10 Schaden toeten ein gebundenes Paar (maxHp 30 je
  //          Stueck) GLEICHZEITIG -- exakt die Designdokument-Rechnung. ---
  {
    const st = openRoom();
    const tcfg = resolveCfg(tanksData, 't_tether');
    const a = createTank('t_tether', tcfg, 100, 100);
    const b = createTank('t_tether', tcfg, 150, 100);
    a.tetherPartner = b;
    b.tetherPartner = a;
    st.tanks = [st.player, a, b];
    for (let i = 0; i < 6; i++) st.applyDamage(a, 10, 'test', {});
    check(!a.alive && !b.alive, `G7 (d): nach 6 Treffern a 10 Schaden sind nicht beide tot (a.alive=${a.alive}, b.alive=${b.alive})`);
  }

  // ---- (e) Bindung bricht DAUERHAFT an einer Wand bzw. ueber breakDistPx,
  //          kein Wiederverbinden nach Rueckkehr in Reichweite. ----------
  {
    const st = openRoom();
    const tcfg = resolveCfg(tanksData, 't_tether');
    const a = createTank('t_tether', tcfg, 100, 100);
    const b = createTank('t_tether', tcfg, 150, 100);
    a.tetherPartner = b;
    b.tetherPartner = a;
    st.tanks = [st.player, a, b];
    b.x = a.x + tcfg.tether.breakDistPx + 20; // ausserhalb
    stepState(st, CMD0, 1 / 60);
    check(!a.tetherPartner && !b.tetherPartner, 'G7 (e): die Bindung bricht nicht ueber breakDistPx');
    b.x = a.x + 50; // wieder in Reichweite
    stepState(st, CMD0, 1 / 60);
    check(!a.tetherPartner && !b.tetherPartner, 'G7 (e): die Bindung verbindet sich faelschlich wieder (soll DAUERHAFT gebrochen bleiben)');

    // Wand dazwischen.
    const st2 = openRoom();
    const c = createTank('t_tether', tcfg, 100, 100);
    const d = createTank('t_tether', tcfg, 160, 100);
    c.tetherPartner = d;
    d.tetherPartner = c;
    st2.tanks = [st2.player, c, d];
    const wallCol = Math.floor(130 / CELL);
    const wallRow = Math.floor(100 / CELL);
    st2.grid[wallRow][wallCol] = '#';
    stepState(st2, CMD0, 1 / 60);
    check(!c.tetherPartner && !d.tetherPartner, 'G7 (e): eine Wand zwischen den Partnern bricht die Bindung nicht');
  }

  // ---- (f) Die Kette ist immer sichtbar (EIN tankLinks-Eintrag je Paar,
  //          nicht zwei), verschwindet nach dem Bruch. -------------------
  {
    const st = openRoom();
    const tcfg = resolveCfg(tanksData, 't_tether');
    const a = createTank('t_tether', tcfg, 100, 100);
    const b = createTank('t_tether', tcfg, 150, 100);
    a.tetherPartner = b;
    b.tetherPartner = a;
    st.tanks = [st.player, a, b];
    stepState(st, CMD0, 1 / 60);
    // Gegen die literalen Startkoordinaten pruefen, nicht gegen a.x/b.x NACH
    // dem Tick (G3/G6-Fund: updateTethers() pusht VOR der spaeteren Gegner-
    // Bewegungsphase im selben Tick -- Rolle 'hunter' bewegt sich im selben
    // Tick noch ein Stueck, ein exakter Positionsvergleich danach schlaegt
    // deshalb fehl).
    const links = st.tankLinks.filter((l) => (l.x0 === 100 && l.x1 === 150) || (l.x0 === 150 && l.x1 === 100));
    check(links.length === 1, `G7 (f): nicht genau EIN Ketten-Link je Paar (${links.length})`);
    b.x = a.x + tcfg.tether.breakDistPx + 20;
    stepState(st, CMD0, 1 / 60);
    const linksAfter = st.tankLinks.filter((l) => l.color?.[0] === 140 && l.color?.[1] === 80);
    check(linksAfter.length === 0, 'G7 (f): die Kette bleibt sichtbar, obwohl die Bindung gebrochen ist');
  }

  // ---- (g) tetherStandoffDrive(): zu nah -> weg, zu weit -> hin,
  //          dazwischen null (kein Vorrang). -----------------------------
  {
    const tc = { standoffMinPx: 100, standoffMaxPx: 200 };
    const tank = { x: 0, y: 0 };
    const near = tetherStandoffDrive(tank, { x: 50, y: 0 }, tc);
    check(near?.x < 0, `G7 (g): zu nah bewegt sich nicht WEG vom Partner (x=${near?.x})`);
    const far = tetherStandoffDrive(tank, { x: 300, y: 0 }, tc);
    check(far?.x > 0, `G7 (g): zu weit bewegt sich nicht ZUM Partner (x=${far?.x})`);
    const mid = tetherStandoffDrive(tank, { x: 150, y: 0 }, tc);
    check(mid === null, 'G7 (g): im Zielband (100-200px) wird trotzdem ein Vorrang zurueckgegeben');
  }

  // ---- (h) t_harvester: waechst dauerhaft bei einem Tod in Reichweite
  //          (maxHp/damage), OHNE zu heilen (healOnStack:false); ausserhalb
  //          radiusPx bleibt er unveraendert. ----------------------------
  {
    const st = openRoom();
    const hcfg = resolveCfg(tanksData, 't_harvester');
    const harvester = createTank('t_harvester', hcfg, 100, 100);
    harvester.hp = harvester.cfg.maxHp - 5; // leicht angeschlagen -- Heilung waere sichtbar
    const victim = createTank('t_brown', resolveCfg(tanksData, 't_brown'), 150, 100); // 50px, INNERHALB radiusPx
    const farVictim = createTank('t_brown', resolveCfg(tanksData, 't_brown'), 100 + hcfg.harvest.radiusPx + 50, 100); // AUSSERHALB
    st.tanks = [st.player, harvester, victim, farVictim];
    const baseMaxHp = harvester.cfg.maxHp;
    const baseDamage = harvester.cfg.damage;
    const hpBefore = harvester.hp;
    st.killTank(victim, 'test', {});
    check(harvester.cfg.maxHp === baseMaxHp + hcfg.harvest.hpPerStack, `G7 (h): maxHp waechst nicht um hpPerStack (${harvester.cfg.maxHp - baseMaxHp})`);
    check(harvester.cfg.damage === baseDamage + hcfg.harvest.damagePerStack, `G7 (h): damage waechst nicht um damagePerStack (${harvester.cfg.damage - baseDamage})`);
    check(harvester.hp === hpBefore, 'G7 (h): der Verwerter heilt sich (healOnStack:false wird nicht beachtet)');
    check(harvester.harvestStacks === 1, `G7 (h): harvestStacks ist nicht 1 (${harvester.harvestStacks})`);
    const maxHpAfterFirst = harvester.cfg.maxHp;
    st.killTank(farVictim, 'test', {});
    check(harvester.cfg.maxHp === maxHpAfterFirst, 'G7 (h): ein Tod AUSSERHALB radiusPx laesst den Verwerter trotzdem wachsen');
  }

  // ---- (i) Ein Geistertod (killGhost) waechst denselben Verwerter genauso
  //          -- "Panzer ODER Geist". ---------------------------------------
  {
    const st = openRoom();
    const hcfg = resolveCfg(tanksData, 't_harvester');
    const harvester = createTank('t_harvester', hcfg, 100, 100);
    st.tanks = [st.player, harvester];
    st.ghosts = [];
    const g = { id: 999, x: 130, y: 100, alive: true, hp: 10, cfg: { maxHp: 10 } };
    st.ghosts.push(g);
    const baseMaxHp = harvester.cfg.maxHp;
    killGhost(st, g, 'expire');
    check(harvester.cfg.maxHp === baseMaxHp + hcfg.harvest.hpPerStack, 'G7 (i): ein Geistertod laesst den Verwerter nicht wachsen');
  }

  // ---- (j) Der Spielertod feedet KEINEN Verwerter -- "meine Gegner",
  //          nicht der eigene Tod. -----------------------------------------
  {
    const st = openRoom();
    const hcfg = resolveCfg(tanksData, 't_harvester');
    const harvester = createTank('t_harvester', hcfg, 100, 100);
    st.tanks = [st.player, harvester];
    st.player.x = 120;
    st.player.y = 100;
    const baseMaxHp = harvester.cfg.maxHp;
    st.killTank(st.player, 'test', {});
    check(harvester.cfg.maxHp === baseMaxHp, 'G7 (j): der Spielertod laesst einen Verwerter faelschlich wachsen');
  }
}

// ---- 76. Gegner-Umbau Phase G8 (UMBAUPLAN-GEGNER.md): Akt 3, die letzten
// zwei "alternativen" Mechaniken -- t_metronom (Taktgeber) und t_grabber
// (Greifer). Der Taktgeber ist der erste Gegner, der NICHT selbst kaempft,
// sondern das Verhalten ALLER anderen Gegner im Raum veraendert (buendelt
// ihr Feuer); der Greifer der erste, der dem Spieler Boden statt LP nimmt
// und dafuer eine Kugel als Gegenwehr verlangt.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createTank, moveTank } = await import('../src/game/tank.js');
  const { createGhost, updateGhosts } = await import('../src/game/ghost.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');
  const { CELL, COLS, ROWS } = await import('../src/config.js');

  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  function openRoom() {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: [],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
    });
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) st.grid[r][c] = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? '#' : '.';
    st.walls = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (st.grid[r][c] === '#') st.walls.push({ x: c * CELL, y: r * CELL, w: CELL, h: CELL, type: 'solid', col: c, row: r });
    return st;
  }

  // ---- (a) Struktur ------------------------------------------------------
  {
    const M = tanksData.types.t_metronom;
    check(!!M?.metronome && M.weapon === null, 'G8 (a): t_metronom fehlt oder traegt kein metronome/weapon:null');
    check(
      typeof M.metronome.beatS === 'number' && typeof M.metronome.holdWindowS === 'number' && M.metronome.needsLos === true,
      'G8 (a): t_metronom.metronome unvollstaendig',
    );
    const G = tanksData.types.t_grabber;
    check(!!G?.grapple && G.weapon === 'bullet', 'G8 (a): t_grabber fehlt oder traegt kein grapple/weapon:bullet');
    check(
      typeof G.grapple.windupS === 'number' &&
        typeof G.grapple.pullSpeedPxS === 'number' &&
        typeof G.grapple.pullS === 'number' &&
        typeof G.grapple.cooldownS === 'number' &&
        typeof G.grapple.ropeHp === 'number' &&
        typeof G.grapple.maxRangePx === 'number',
      'G8 (a): t_grabber.grapple unvollstaendig',
    );
    for (const id of ['t_metronom', 't_grabber']) {
      check(diffData.danger[id]?.unlockAct === 3, `G8 (a): ${id} ist nicht in Akt 3 freigeschaltet`);
    }
  }

  // ---- (b) Beat-Zyklus mit EIGENEN Zahlen (nicht 2,0/1,6): elapsed laeuft
  //          zyklisch 0..beatS, "gehalten" gilt nur unter holdWindowS,
  //          justBeat feuert NUR beim Uebergang gehalten->frei, genau
  //          einmal je vollem Zyklus. -----------------------------------
  {
    const st = openRoom();
    const mcfg = { ...resolveCfg(tanksData, 't_metronom'), metronome: { beatS: 1.0, holdWindowS: 0.6, needsLos: false } };
    const m = createTank('t_metronom', mcfg, 100, 100);
    st.tanks = [st.player, m];
    const dt = 1 / 60;
    let beats = 0;
    let firstBeatTick = -1;
    for (let i = 1; i <= 120; i++) {
      // 2 volle 1,0s-Zyklen
      stepState(st, CMD0, dt);
      if (m.metronomeState.justBeat) {
        beats++;
        if (firstBeatTick < 0) firstBeatTick = i;
      }
    }
    check(beats === 2, `G8 (b): in zwei vollen 1,0s-Zyklen sollten genau 2 Schlaege auftreten (${beats})`);
    const expectedTick = Math.round(0.6 / dt);
    check(
      Math.abs(firstBeatTick - expectedTick) <= 1,
      `G8 (b): der erste Schlag kommt nicht bei holdWindowS (Tick ${firstBeatTick}, erwartet ~${expectedTick})`,
    );
  }

  // ---- (c) needsLos: ein durch eine Wand vom Taktgeber getrennter
  //          Verbuendeter wird trotz laufender Haltephase NICHT gehalten
  //          (metronomeHolds() wird live pro Verbuendetem geprueft). ------
  {
    const st = openRoom();
    st.player.x = 400;
    st.player.y = 100;
    const allyCfg = { ...resolveCfg(tanksData, 't_brown'), accuracy: 1.0, fireRate: 0.02, magazine: 20 };
    // Ally bei (400,200): Richtung zum Spieler ist exakt -PI/2 -- deckt sich
    // mit createTank()s Standard-Turmwinkel, kein Ausrichtungs-Delay im Test.
    const ally = createTank('t_brown', allyCfg, 400, 200);
    // Sehr langer Zyklus (fast nur Haltephase) -- OHNE die Wand waere der
    // Ally die gesamten 10 Testticks ueber gehalten.
    const mcfg = { ...resolveCfg(tanksData, 't_metronom'), metronome: { beatS: 5.0, holdWindowS: 4.9, needsLos: true } };
    const metro = createTank('t_metronom', mcfg, 460, 200);
    const wallCol = Math.floor(430 / CELL);
    const wallRow = Math.floor(200 / CELL);
    st.grid[wallRow][wallCol] = '#';
    st.walls.push({ x: wallCol * CELL, y: wallRow * CELL, w: CELL, h: CELL, type: 'solid', col: wallCol, row: wallRow });
    st.tanks = [st.player, ally, metro];
    const dt = 1 / 60;
    let fired = false;
    for (let i = 0; i < 10; i++) {
      const before = st.bullets.filter((b) => b.owner === ally).length;
      stepState(st, CMD0, dt);
      if (st.bullets.filter((b) => b.owner === ally).length > before) fired = true;
    }
    check(fired, 'G8 (c): eine Wand zwischen Verbuendetem und Taktgeber haelt den Verbuendeten trotzdem (needsLos wird nicht beachtet)');
  }

  // ---- (d) Ende-zu-Ende Feuerbuendelung: ein sichtbarer Verbuendeter
  //          feuert WAEHREND der Haltephase nicht, aber NACH dem Schlag --
  //          tank.cooldown tickt waehrenddessen unabhaengig weiter, der
  //          Schuss kommt beim Freigeben also sofort, nicht erst spaeter. --
  {
    const st = openRoom();
    st.player.x = 400;
    st.player.y = 100;
    const allyCfg = { ...resolveCfg(tanksData, 't_brown'), accuracy: 1.0, fireRate: 0.02, magazine: 20 };
    const ally = createTank('t_brown', allyCfg, 400, 200);
    const mcfg = { ...resolveCfg(tanksData, 't_metronom'), metronome: { beatS: 1.0, holdWindowS: 0.6, needsLos: true } };
    const metro = createTank('t_metronom', mcfg, 450, 200);
    st.tanks = [st.player, ally, metro];
    const dt = 1 / 60;
    let shotsWhileHeld = 0;
    let shotsAfterBeat = 0;
    let sawBeat = false;
    for (let i = 0; i < 60; i++) {
      // 1,0s = ein voller Zyklus
      const before = st.bullets.filter((b) => b.owner === ally).length;
      stepState(st, CMD0, dt);
      const fired = st.bullets.filter((b) => b.owner === ally).length > before;
      if (metro.metronomeState.justBeat) sawBeat = true;
      if (!sawBeat && fired) shotsWhileHeld++;
      if (sawBeat && fired) shotsAfterBeat++;
    }
    check(shotsWhileHeld === 0, `G8 (d): waehrend der Haltephase feuert ein sichtbarer Verbuendeter trotzdem (${shotsWhileHeld} Schuesse)`);
    check(shotsAfterBeat > 0, 'G8 (d): nach dem Schlag feuert der gehaltene Verbuendete nicht');
  }

  // ---- (e)+(f) Griff-Trigger: Windup startet bei Reichweite+Sicht,
  //          Richtung wird EINMALIG eingefroren; bleibt das Ziel im
  //          gefrorenen Korridor, ist der Windup-Ausgang ein TREFFER
  //          (grappledBy/grappleUntil/grappleRopeHp gesetzt, Cooldown
  //          startet). ------------------------------------------------------
  {
    const st = openRoom();
    const gcfg = {
      ...resolveCfg(tanksData, 't_grabber'),
      grapple: { windupS: 0.3, pullSpeedPxS: 90, pullS: 1.2, cooldownS: 1.0, ropeHp: 1, maxRangePx: 300, aimToleranceRad: 0.2 },
    };
    const grabber = createTank('t_grabber', gcfg, 100, 100);
    st.player.x = 250;
    st.player.y = 100; // genau rechts vom Greifer -> gefrorene Richtung 0
    st.tanks = [st.player, grabber];
    const dt = 1 / 60;
    stepState(st, CMD0, dt);
    check(grabber.grappleState?.mode === 'windup', `G8 (e): der Greifer startet kein Windup trotz Sichtlinie+Reichweite (mode=${grabber.grappleState?.mode})`);
    check(Math.abs(grabber.grappleState.dir) < 0.01, `G8 (e): die eingefrorene Richtung zeigt nicht auf den Spieler (${grabber.grappleState.dir})`);
    for (let i = 0; i < 20; i++) stepState(st, CMD0, dt); // windupS (0,3s) + Reserve
    check(st.player.grappledBy === grabber, 'G8 (f): ein Ziel im gefrorenen Korridor wird nicht erfolgreich geangelt');
    check(st.player.grappleUntil > st.time, 'G8 (f): grappleUntil ist nicht in der Zukunft gesetzt');
    check(st.player.grappleRopeHp === gcfg.grapple.ropeHp, 'G8 (f): grappleRopeHp ist nicht auf ropeHp gesetzt');
    check(grabber.grappleState.mode === 'cooldown', 'G8 (f): nach einem Treffer ist der Greifer nicht in Abklingzeit');
  }

  // ---- (g)+(h) Ausweichen aus dem gefrorenen Korridor KOSTET NUR BEWEGUNG
  //          (kein Griff), die Abklingzeit haelt trotzdem mindestens
  //          cooldownS an, bevor ein neuer Windup starten kann. ------------
  {
    const st = openRoom();
    const gcfg = {
      ...resolveCfg(tanksData, 't_grabber'),
      grapple: { windupS: 0.3, pullSpeedPxS: 90, pullS: 1.2, cooldownS: 1.0, ropeHp: 1, maxRangePx: 300, aimToleranceRad: 0.2 },
    };
    const grabber = createTank('t_grabber', gcfg, 100, 100);
    st.player.x = 250;
    st.player.y = 100;
    st.tanks = [st.player, grabber];
    const dt = 1 / 60;
    stepState(st, CMD0, dt);
    check(grabber.grappleState?.mode === 'windup', 'G8 (g) Vorbedingung: kein Windup gestartet');
    // Ziel weicht seitlich aus dem gefrorenen Korridor aus, BEVOR der
    // Windupablaeuft -- der gefrorene Winkel (0, nach rechts) trifft es
    // danach nicht mehr.
    st.player.y = 100 + 200;
    for (let i = 0; i < 20; i++) stepState(st, CMD0, dt);
    check(!st.player.grappledBy, 'G8 (g): ein ausgewichenes Ziel wird trotzdem geangelt');
    check(grabber.grappleState.mode === 'cooldown', 'G8 (g): nach einem Fehlschlag ist der Greifer nicht in Abklingzeit');
    // Abklingzeit haelt mindestens cooldownS (1,0s) an.
    for (let i = 0; i < 30; i++) stepState(st, CMD0, dt); // 0,5s -- noch nicht abgelaufen
    check(grabber.grappleState.mode === 'cooldown', 'G8 (h): die Abklingzeit endet zu frueh (vor cooldownS)');
    for (let i = 0; i < 40; i++) stepState(st, CMD0, dt); // weitere ~0,67s -- insgesamt > 1,0s
    check(grabber.grappleState.mode !== 'cooldown', 'G8 (h): die Abklingzeit endet nicht nach cooldownS');
  }

  // ---- (i) Additive Zug-Physik (tank.js: moveTank): "volle Steuerung
  //          senkrecht zur Leine bleibt" -- eine Eingabe QUER zur Leine hat
  //          weiterhin volle Wirkung, WAEHREND gleichzeitig der Zug zum
  //          Schuetzen wirkt (additiv, NICHT wie der eigene hookTimer, der
  //          die Eingabe komplett ersetzt). ---------------------------------
  {
    const st = openRoom();
    const shooter = createTank('t_grabber', { ...resolveCfg(tanksData, 't_grabber'), grapple: { pullSpeedPxS: 90 } }, 300, 100);
    const target = createTank('player', resolveCfg(tanksData, 'player'), 100, 100); // links vom Schuetzen -> Zug zeigt nach +x
    target.grappledBy = shooter;
    target.grappleUntil = st.time + 10;
    st.tanks = [target, shooter];
    const dt = 1 / 60;
    const axis = { x: 0, y: 1 }; // Eingabe SENKRECHT zur Leine (die auf der X-Achse liegt)
    const yBefore = target.y;
    const xBefore = target.x;
    moveTank(target, axis, st, dt);
    check(target.y > yBefore, `G8 (i): die eigene Eingabe senkrecht zur Leine hat keine Wirkung mehr (dy=${(target.y - yBefore).toFixed(3)})`);
    check(target.x > xBefore, `G8 (i): der Zug zum Schuetzen bewegt das Ziel nicht (dx=${(target.x - xBefore).toFixed(3)})`);
  }

  // ---- (j) Dieselbe additive Zug-Physik gilt auch fuer GEISTER -- "zieht
  //          auch Geister" (Auftrag Abschnitt 8.8), sogar OHNE eigenes
  //          Kampfziel im Raum (die Bewegung liegt bewusst VOR der
  //          Zielaufloesung in ghost.js: updateGhosts()). ------------------
  {
    const st = openRoom();
    const shooter = createTank('t_grabber', { ...resolveCfg(tanksData, 't_grabber'), grapple: { pullSpeedPxS: 90 } }, 300, 100);
    // `shooter` bewusst NICHT in st.tanks -- sonst waere er selbst ueber
    // nearestEnemy() ein gueltiges Kampfziel und der Test wuerde die
    // Ausnahme (kein Ziel im Raum) gar nicht pruefen. updateGhosts() wird
    // hier direkt aufgerufen, der Greifer muss dafuer nicht mitlaufen.
    st.tanks = [st.player];
    const g = createGhost(st, 100, 100, 0, 't_pink');
    st.ghosts.push(g);
    g.grappledBy = shooter;
    g.grappleUntil = st.time + 10;
    updateGhosts(st, 1 / 60);
    check(g.x > 100, `G8 (j): ein gegriffener Geist ohne eigenes Kampfziel wird nicht Richtung Schuetze gezogen (x=${g.x})`);
  }

  // ---- (k) Die gespannte Leine ist immer sichtbar (Baustein B, state.
  //          tankLinks) waehrend eines aktiven Griffs. ----------------------
  {
    const st = openRoom();
    const shooter = createTank('t_grabber', { ...resolveCfg(tanksData, 't_grabber'), grapple: { pullSpeedPxS: 90, ropeHitRadiusPx: 14 } }, 100, 100);
    st.player.x = 200;
    st.player.y = 100;
    st.player.grappledBy = shooter;
    st.player.grappleUntil = 1000;
    st.tanks = [st.player, shooter];
    stepState(st, CMD0, 1 / 60);
    const links = st.tankLinks.filter((l) => l.color?.[0] === 220 && l.color?.[1] === 190);
    check(links.length === 1, `G8 (k): keine sichtbare Leine waehrend eines aktiven Griffs (${links.length} Eintraege)`);
  }

  // ---- (l) Die Leine ist beschiessbar: eine Kugel auf der Strecke senkt
  //          grappleRopeHp und wird dabei VERBRAUCHT ("eine Kugel fuer die
  //          Leine ausgeben"); bei 0 loest sich das Ziel. ------------------
  {
    const { createBullet } = await import('../src/game/bullet.js');
    const st = openRoom();
    const shooter = createTank('t_grabber', { ...resolveCfg(tanksData, 't_grabber'), grapple: { pullSpeedPxS: 90, ropeHitRadiusPx: 14, ropeHp: 1 } }, 100, 100);
    st.player.x = 200;
    st.player.y = 100;
    st.player.grappledBy = shooter;
    st.player.grappleUntil = 1000;
    st.player.grappleRopeHp = 1;
    st.tanks = [st.player, shooter];
    // Eine FREMDE Kugel (hier: die des gezogenen Spielers) mitten auf der
    // Strecke (100,100)-(200,100). Der Besitzer ist bewusst NICHT der
    // Greifer: seine eigenen Geschosse duerfen seine Leine nicht trennen
    // (s. (m) direkt darunter) -- "eine Kugel fuer die Leine ausgeben" ist
    // die Gegenwehr des Ziels, nicht ein Eigentor des Greifers.
    const b = createBullet(150, 100, Math.PI, { speed: 0, owner: st.player, damage: 1, radius: 4, kind: 'bullet' });
    st.bullets = [b];
    stepState(st, CMD0, 1 / 60);
    check(b.dead === true, 'G8 (l): eine Kugel auf der Leine wird nicht verbraucht');
    check(!st.player.grappledBy, 'G8 (l): bei ropeHp 1 loest sich das Ziel nach einem Treffer nicht');
  }

  // ---- (m) BUGFIX: die EIGENEN Geschosse des Greifers trennen seine Leine
  //          NICHT. Er zielt mit seiner normalen Waffe auf genau das Ziel,
  //          das er zieht -- seine Kugeln fliegen entlang der Leine und
  //          wurden vorher ausnahmslos von ihr gefressen (ein Greifer konnte
  //          ein gegriffenes Ziel nie beschiessen). --------------------------
  {
    const { createBullet } = await import('../src/game/bullet.js');
    const st = openRoom();
    const shooter = createTank('t_grabber', { ...resolveCfg(tanksData, 't_grabber'), grapple: { pullSpeedPxS: 90, ropeHitRadiusPx: 14, ropeHp: 1 } }, 100, 100);
    st.player.x = 200;
    st.player.y = 100;
    st.player.grappledBy = shooter;
    st.player.grappleUntil = 1000;
    st.player.grappleRopeHp = 1;
    st.tanks = [st.player, shooter];
    const own = createBullet(150, 100, 0, { speed: 0, owner: shooter, damage: 25, radius: 4, kind: 'bullet' });
    st.bullets = [own];
    stepState(st, CMD0, 1 / 60);
    check(own.dead !== true, 'G8 (m): eine EIGENE Kugel des Greifers wird von seiner eigenen Leine gefressen');
    check(!!st.player.grappledBy, 'G8 (m): der Greifer trennt seine eigene Leine mit dem eigenen Schuss');
    check(st.player.grappleRopeHp === 1, `G8 (m): die eigene Kugel senkt die Leinen-LP (${st.player.grappleRopeHp})`);
  }

  // ---- (n) BUGFIX: ein abgelaufener/toter Griff raeumt seinen Zeiger auf,
  //          statt als haengender Verweis stehen zu bleiben. ---------------
  {
    const st = openRoom();
    const shooter = createTank('t_grabber', { ...resolveCfg(tanksData, 't_grabber'), grapple: { pullSpeedPxS: 90 } }, 100, 100);
    st.player.x = 200;
    st.player.y = 100;
    st.player.grappledBy = shooter;
    st.player.grappleUntil = st.time + 0.02; // laeuft im naechsten Tick ab
    st.tanks = [st.player, shooter];
    stepState(st, CMD0, 1 / 60);
    stepState(st, CMD0, 1 / 60);
    check(st.player.grappledBy === null, 'G8 (n): ein abgelaufener Griff laesst grappledBy stehen');
  }
}

// ---- 77. Code-Durchsicht: behobene Fehler ------------------------------
// Vier Fehler, die eine systematische Durchsicht der Gegner-Umbau-Phasen
// (G2/G5/G7) zutage gefoerdert hat. Alle vier haben gemeinsam, dass sie ein
// Versprechen des Spiels an den Spieler gebrochen haben, ohne je zu
// crashen -- deshalb ist keiner davon vorher aufgefallen.
{
  const { createState, stepState, bondTethers } = await import('../src/game/state.js');
  const { createTank } = await import('../src/game/tank.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');
  const { CELL, COLS, ROWS } = await import('../src/config.js');

  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  function openRoom() {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: [],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades: {},
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
    });
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) st.grid[r][c] = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? '#' : '.';
    st.walls = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (st.grid[r][c] === '#') st.walls.push({ x: c * CELL, y: r * CELL, w: CELL, h: CELL, type: 'solid', col: c, row: r });
    return st;
  }

  // ---- (a) t_mason (G5): die Waende eines TOTEN Maurers verfallen weiter.
  //          Vorher machte sein Tod sie dauerhaft -- die richtige Antwort des
  //          Spielers ("toete den Maurer") zementierte also ausgerechnet
  //          seine Sperren. Mit synthetisch verkuerzten Zeiten geprueft
  //          (Mechanismus statt Datenlage). ------------------------------
  {
    const st = openRoom();
    const base = resolveCfg(tanksData, 't_mason');
    const mcfg = { ...base, build: { ...base.build, everyS: 0.1, buildS: 0.1, decayS: 0.5, maxAlive: 6 } };
    const mason = createTank('t_mason', mcfg, 300, 300);
    st.tanks = [st.player, mason];
    st.player.x = 500;
    st.player.y = 300;
    const before = st.walls.length;
    for (let i = 0; i < 40; i++) stepState(st, CMD0, 1 / 60);
    const built = st.walls.length - before;
    check(built > 0, 'Bugfix (a): Vorbedingung -- der Maurer hat gar keine Wand gebaut');
    mason.alive = false;
    for (let i = 0; i < 120; i++) stepState(st, CMD0, 1 / 60); // 2 s, weit ueber decayS 0,5
    check(st.walls.length === before, `Bugfix (a): die Waende eines toten Maurers verfallen nicht (${st.walls.length - before} bleiben stehen)`);
  }

  // ---- (b) t_mason: stirbt er MITTEN im Bau, verschwindet sein
  //          Geruest-Telegraph mit ihm -- sonst warnt der Raum bis zum Ende
  //          vor einer Wand, die nie kommt. ------------------------------
  {
    const st = openRoom();
    const base = resolveCfg(tanksData, 't_mason');
    const mcfg = { ...base, build: { ...base.build, everyS: 0.05, buildS: 5, decayS: 20, maxAlive: 6 } };
    const mason = createTank('t_mason', mcfg, 300, 300);
    st.tanks = [st.player, mason];
    st.player.x = 500;
    st.player.y = 300;
    for (let i = 0; i < 20; i++) stepState(st, CMD0, 1 / 60);
    check(st.masonScaffolds.length === 1 && !!mason.masonBuildState, 'Bugfix (b): Vorbedingung -- kein laufender Bau mit Geruest');
    mason.alive = false;
    stepState(st, CMD0, 1 / 60);
    check(st.masonScaffolds.length === 0, `Bugfix (b): das Geruest eines mitten im Bau getoeteten Maurers bleibt stehen (${st.masonScaffolds.length})`);
  }

  // ---- (c) t_tether (G7): die Schadensteilung gilt von BEIDEN Seiten.
  //          Ein Kettenhund bindet sich mangels zweitem Kettenhund auch an
  //          einen normalen Verbuendeten -- der traegt selbst kein
  //          cfg.tether. Vorher teilte nur ein Treffer AUF den Kettenhund,
  //          die Kette liess sich also umgehen, indem man die andere Seite
  //          erschoss. ------------------------------------------------------
  {
    const st = openRoom();
    const A = createTank('t_tether', resolveCfg(tanksData, 't_tether'), 100, 100);
    const B = createTank('t_brown', resolveCfg(tanksData, 't_brown'), 140, 100);
    st.tanks = [st.player, A, B];
    bondTethers(st.tanks);
    check(A.tetherPartner === B && B.tetherPartner === A, 'Bugfix (c): Vorbedingung -- gemischtes Paar nicht gebunden');
    const a0 = A.hp, b0 = B.hp;
    st.applyDamage(B, 20, 'test', {}); // Treffer auf die NICHT-Kettenhund-Seite
    check(a0 - A.hp === 10 && b0 - B.hp === 10, `Bugfix (c): ein Treffer auf den Partner teilt nicht (A -${a0 - A.hp}, B -${b0 - B.hp})`);
  }

  // ---- (d) t_tether: ein Partner, dessen Kettenhund gestorben ist, gilt
  //          wieder als ungebunden. Vorher blieb sein Zeiger auf die Leiche
  //          stehen und sperrte ihn dauerhaft fuer jeden spaeter
  //          erscheinenden Welle-2-Kettenhund. --------------------------
  {
    const tc = resolveCfg(tanksData, 't_tether');
    const A = createTank('t_tether', tc, 100, 100);
    const B = createTank('t_brown', resolveCfg(tanksData, 't_brown'), 130, 100);
    bondTethers([A, B]);
    check(B.tetherPartner === A, 'Bugfix (d): Vorbedingung -- Welle 1 nicht gebunden');
    A.alive = false;
    A.tetherPartner = null; // updateTethers() raeumt nur die LEBENDE Seite
    const C = createTank('t_tether', tc, 140, 100);
    bondTethers([A, B, C]);
    check(C.tetherPartner === B && B.tetherPartner === C, 'Bugfix (d): ein Welle-2-Kettenhund findet den verwaisten Partner nicht');
  }

  // ---- (e) t_rusher (G2): Betaeubung stoppt den Sturm. Er bewegt sich ueber
  //          eine EIGENE Substep-Schleife und umging damit die stunTimer-
  //          Sperre in tank.js: moveTank(), die fuer jeden anderen Panzer
  //          gilt -- Krallenfalle/EMP/Frost waren gegen ihn wirkungslos. --
  {
    const st = openRoom();
    const r = createTank('t_rusher', resolveCfg(tanksData, 't_rusher'), 300, 300);
    st.tanks = [st.player, r];
    st.player.x = 360;
    st.player.y = 300;
    st.player.cfg.maxHp = 1e9;
    st.player.hp = 1e9;
    for (let i = 0; i < 3; i++) stepState(st, CMD0, 1 / 60);
    check(r.ai.ram?.mode === 'windup', `Bugfix (e): Vorbedingung -- kein Sturm ausgeloest (${r.ai.ram?.mode})`);
    const x0 = r.x, y0 = r.y;
    const hp0 = st.player.hp;
    for (let i = 0; i < 80; i++) {
      r.stunTimer = 5; // dauerhaft betaeubt (Krallenfalle-Muster)
      stepState(st, CMD0, 1 / 60);
    }
    check(Math.hypot(r.x - x0, r.y - y0) < 1, `Bugfix (e): ein betaeubter Rammler stuermt trotzdem (${Math.hypot(r.x - x0, r.y - y0).toFixed(1)} px)`);
    check(st.player.hp === hp0, 'Bugfix (e): ein betaeubter Rammler richtet trotzdem Kontaktschaden an');
  }
}

// ---- 78. Gegner-Umbau Phase G8 (Difficulty Curve) ----------------------
// Die acht Akt-3-Kompositionen K1-K8 aus docs/AUFTRAG-GEGNERDESIGN.md
// Abschnitt 11 plus die optionale Elite-Affix-Sperrliste je Gegnertyp
// (UMBAUPLAN-GEGNER.md O3). Vorher hatte data/compositions.json AUSSCHLIESSLICH
// Akt-2-Rezepte -- alle elf Akt-3-Typen liefen nur ueber den Zufalls-
// Rueckfall, keine der entworfenen Synergien war verlaesslich erreichbar.
{
  const { buyEnemies } = await import('../src/game/run.js');
  const { createState } = await import('../src/game/state.js');
  const { rngFor, hashSeed } = await import('../src/core/rng.js');

  const comps = diffData.compositions;

  // ---- (a) Struktur: Akt 3 hat ueberhaupt Kompositionen, und zwar die acht
  //          benannten. Bewacht genau die Luecke, die G8 geschlossen hat --
  //          die Budget-/Freischaltungspruefung JEDER Komposition liegt
  //          unveraendert in Abschnitt 72 (a) und gilt automatisch mit. ----
  {
    const akt3 = comps.filter((c) => c.actIndex === 3);
    check(akt3.length === 8, `G8 (a): Akt 3 hat ${akt3.length} statt 8 Kompositionen`);
    for (const id of ['k1_der_chor', 'k2_der_blutzoll', 'k3_die_kette', 'k4_der_trichter',
                      'k5_die_blende', 'k6_das_rudel', 'k7_der_kaefig', 'k8_der_ankerhof']) {
      check(akt3.some((c) => c.id === id), `G8 (a): Akt-3-Komposition ${id} fehlt`);
    }
    // K2 nennt im Designdokument "ab Raum 6" (dort wurde nur das Budget
    // gerechnet) -- t_harvester ist aber selbst erst ab Raum 8 frei.
    const k2 = akt3.find((c) => c.id === 'k2_der_blutzoll');
    check(k2.minRoom >= diffData.danger.t_harvester.unlockRoomInAct,
      `G8 (a): k2_der_blutzoll.minRoom (${k2.minRoom}) liegt vor der Freischaltung von t_harvester (${diffData.danger.t_harvester.unlockRoomInAct})`);
  }

  // ---- (b) JEDE Komposition feuert im echten buyEnemies()-Pfad auch
  //          tatsaechlich. Eine Komposition, die rechnerisch gueltig ist,
  //          aber nie gezogen wird, waere tote Datenlage -- genau der
  //          Zustand, in dem Akt 3 vor dieser Phase war. -----------------
  {
    const hits = new Set();
    for (let seed = 1; seed <= 120; seed++) {
      for (let act = 1; act <= 3; act++) {
        const a = diffData.acts[act - 1];
        for (let room = 1; room <= a.rooms; room++) {
          const budget = a.budget.base + a.budget.perRoom * room;
          const types = buyEnemies(diffData, rngFor(seed, act * 100 + room, 'enemies'), act, room, budget, tanksData.types, comps);
          const got = [...types].sort().join(',');
          const m = comps.find((c) => c.actIndex === act &&
            c.enemies.flatMap((e) => Array(e.count).fill(e.type)).sort().join(',') === got);
          if (m) hits.add(m.id);
        }
      }
    }
    for (const c of comps) check(hits.has(c.id), `G8 (b): Komposition ${c.id} wird in 120 Seeds nie gezogen (tote Datenlage)`);
  }

  // ---- (c) affixDeny-MECHANISMUS mit EIGENEN Werten (nicht der aktuellen
  //          Datenlage): ein Typ mit Sperrliste bekommt den gesperrten Affix
  //          nicht, ein Typ ohne Sperrliste schon. -----------------------
  {
    const fakeAffix = { id: 'testaffix', speedMult: 2 };
    const room = (typ, deny) => {
      const data = { ...tanksData, types: { ...tanksData.types, [typ]: { ...tanksData.types[typ], affixDeny: deny } } };
      const st = createState(data, tilesData, {
        genRng: rngFor(1, 1, 'rooms'), enemyTypes: [typ], aiSeed: hashSeed(1, 1, 'ai'),
        playerUpgrades: {}, upgradesData, equippedSecondary: 'mine', transform: {},
        eliteAffixes: { chosen: [fakeAffix], cheapestIdx: 0, priciestIdx: 0 },
      });
      return st.tanks.find((t) => t !== st.player);
    };
    const base = tanksData.speeds[tanksData.types.t_pink.speed];
    const denied = room('t_pink', ['testaffix']);
    const allowed = room('t_pink', null);
    check(denied.cfg.speed === base, `G8 (c): ein gesperrter Affix wirkt trotzdem (Tempo ${denied.cfg.speed} statt ${base})`);
    check(allowed.cfg.speed === base * 2, `G8 (c): ohne Sperrliste wirkt der Affix nicht (Tempo ${allowed.cfg.speed})`);
    // Kein irrefuehrender Farbpunkt fuer eine Wirkung, die es nicht gibt
    // (dieselbe Fehlerklasse wie der Regenerierschild-Bugfix).
    check(!denied.affixes.includes('testaffix'), 'G8 (c): ein gesperrter Affix erscheint trotzdem in t.affixes (irrefuehrender Marker)');
    check(allowed.affixes.includes('testaffix'), 'G8 (c): ein erlaubter Affix fehlt in t.affixes');
    // Eine Sperrliste, die den gezogenen Affix NICHT nennt, aendert nichts.
    const other = room('t_pink', ['irgendwas_anderes']);
    check(other.cfg.speed === base * 2, 'G8 (c): eine nicht passende Sperrliste blockt faelschlich');
  }

  // ---- (d) Die drei im Designdokument ausdruecklich begruendeten
  //          Ausschluesse sind gesetzt. ---------------------------------
  {
    for (const [typ, affix] of [['t_shotgun', 'rasend'], ['t_dud', 'gepanzert'], ['t_harvester', 'rasend']]) {
      check(tanksData.types[typ].affixDeny?.includes(affix),
        `G8 (d): ${typ} sperrt '${affix}' nicht (Designdokument: ausdruecklich "Nicht ${affix}")`);
    }
    // Jeder gesperrte Affix muss es auch wirklich geben -- ein Tippfehler
    // waere sonst eine stille Nulloperation.
    const known = new Set(diffData.elite.affixes.map((a) => a.id));
    for (const [id, t] of Object.entries(tanksData.types)) {
      for (const a of t.affixDeny || []) check(known.has(a), `G8 (d): ${id}.affixDeny nennt unbekannten Affix '${a}'`);
    }
  }

  // ---- (e) compositionChance-MECHANISMUS mit EIGENEN Werten (0 / 1, nicht
  //          den echten 0,6): steuert, ob ein passender Raum kuratiert wird
  //          oder auf den Zufalls-Rueckfall faellt. Vorher feuerte eine
  //          Komposition IMMER, sobald eine ins Budgetfenster passte. ----
  {
    const { mulberry32 } = await import('../src/core/rng.js');
    // Kuratiert und Rueckfall muessen am ERGEBNIS unterscheidbar sein, sonst
    // prueft der Test nichts (ein erster Entwurf mit nur einem 5-Punkte-Typ
    // bei Budget 10 lieferte in BEIDEN Faellen 'a,a' und blieb auch mit
    // ausgebautem Mechanismus gruen). Deshalb ein zweiter Typ 'c', den nur
    // die Komposition kaufen kann: der Zufalls-Rueckfall prueft maxPerRoom,
    // pickComposition() bewusst nicht.
    const comp = { id: 'c', actIndex: 1, minRoom: 1, weight: 1, enemies: [{ type: 'c', count: 1 }] };
    const mk = (chance) => ({
      maxEnemiesPerRoom: 8,
      danger: {
        a: { points: 5, unlockAct: 1, unlockRoomInAct: 1 },
        c: { points: 10, maxPerRoom: 0, unlockAct: 1, unlockRoomInAct: 1 },
      },
      acts: [{ rooms: 16, budget: { base: 0, perRoom: 10 }, ...(chance === undefined ? {} : { compositionChance: chance }) }],
    });
    const draw = (chance, seed) => {
      const rng = mulberry32(seed);
      return buyEnemies(mk(chance), rng, 1, 1, 10, undefined, [comp]).join(',');
    };
    // Vorbedingung: die beiden Wege sind wirklich unterscheidbar.
    check(draw(1, 1) === 'c', `G8 (e): Testaufbau kaputt -- kuratiert liefert '${draw(1, 1)}' statt 'c'`);
    check(draw(0, 1) === 'a,a', `G8 (e): Testaufbau kaputt -- der Rueckfall liefert '${draw(0, 1)}' statt 'a,a'`);
    const isComp = (out) => out === 'c';
    // chance 1 (und der Vorgabewert ohne Feld): immer kuratiert.
    for (const ch of [1, undefined]) {
      let n = 0;
      for (let s = 1; s <= 40; s++) if (isComp(draw(ch, s))) n++;
      check(n === 40, `G8 (e): bei compositionChance ${ch} feuert die Komposition nur ${n}/40 mal`);
    }
    // chance 0: nie kuratiert -- der Zufalls-Rueckfall uebernimmt.
    {
      let n = 0;
      for (let s = 1; s <= 40; s++) if (isComp(draw(0, s))) n++;
      check(n === 0, `G8 (e): bei compositionChance 0 feuert die Komposition trotzdem ${n}/40 mal`);
    }
    // Zwischenwerte streuen wirklich (weder immer noch nie).
    {
      let n = 0;
      for (let s = 1; s <= 200; s++) if (isComp(draw(0.5, s))) n++;
      check(n > 60 && n < 140, `G8 (e): compositionChance 0.5 kuratiert ${n}/200 Raeume -- keine echte Streuung`);
    }
    // RNG-Vertrag: die Wuerfelprobe kostet genau EINEN zusaetzlichen Aufruf.
    // Gemessen wird bewusst mit einer Probe, die GELINGT (rng liefert immer
    // 0) -- sonst laeuft im Vergleichsfall der Rueckfall und verbraucht seine
    // eigenen Aufrufe, der Vergleich waere dann kein Gleiches-mit-Gleichem.
    {
      const count = (chance, comps) => {
        let n = 0;
        buyEnemies(mk(chance), () => { n++; return 0; }, 1, 1, 10, undefined, comps);
        return n;
      };
      const ohne = count(1, [comp]);
      const mit = count(0.5, [comp]);
      check(ohne + 1 === mit,
        `G8 (e): die Chance-Probe kostet nicht genau einen zusaetzlichen rng()-Aufruf (${ohne} -> ${mit})`);
      // Ohne passende Kandidaten (Komposition zu teuer) darf die Probe gar
      // nicht laufen -- der Determinismus-Vertrag aus G4 bleibt unberuehrt.
      const teuer = { ...comp, enemies: [{ type: 'c', count: 8 }] };
      check(count(0.5, [teuer]) === count(1, [teuer]),
        'G8 (e): ohne passende Komposition veraendert compositionChance den RNG-Verbrauch');
    }
  }
}


// ---- 79. Gegner-Umbau Phase G9 (Abnahme) --------------------------------
// Letzte Phase von UMBAUPLAN-GEGNER.md. Kein Feature-Bau -- Ist-Abgleich
// gegen die in docs/AUFTRAG-GEGNERDESIGN.md Abschnitt 14 ("Difficulty
// Curve") und 14.3 ("Was bewusst NICHT passiert") ausformulierten
// Abnahmekriterien. Alle 16 Gegner + das Kompositionssystem (G4) + die
// Difficulty Curve (G8) sind bereits gebaut und ausfuehrlich getestet
// (Abschnitte 69-78); dieser Abschnitt deckt nur die Luecken, die noch
// KEIN bestehender Test explizit gegen den Designdokument-Wortlaut prueft.
{
  const { generateMap } = await import('../src/game/run.js');

  const NEW_AKT2 = ['t_rusher', 't_shotgun', 't_dud', 't_lance', 't_relay', 't_medic', 't_mason', 't_anchor'];
  const NEW_AKT3 = ['t_bulwark', 't_tether', 't_marshal', 't_arclight', 't_stalker', 't_grabber', 't_harvester', 't_metronom'];

  // ---- (a) Einfuehrungskurve stimmt EXAKT mit Designdokument Abschnitt
  //          14.1/14.2 ueberein (Raum, Freischaltungspunkte je neuem Typ).
  //          Bisherige Tests pruefen nur die STRUKTUR (unlockAct/
  //          unlockRoomInAct sind Zahlen) -- keiner vergleicht die Zahlen
  //          gegen den Designdokument-Wortlaut selbst. -------------------
  {
    const AKT2_CURVE = { t_rusher: [1, 3], t_shotgun: [2, 4], t_dud: [3, 3], t_lance: [4, 6],
      t_relay: [5, 5], t_medic: [6, 6], t_mason: [7, 6], t_anchor: [8, 7] };
    const AKT3_CURVE = { t_bulwark: [1, 8], t_tether: [2, 5], t_marshal: [3, 9], t_arclight: [4, 9],
      t_stalker: [5, 8], t_grabber: [6, 8], t_harvester: [8, 10], t_metronom: [10, 11] };
    // Reine Funktion des Mechanismus: liefert die Namen aller Typen, deren
    // Datenlage von der uebergebenen Kurve abweicht -- getestet gegen die
    // ECHTE Datenlage (erwartet: keine Abweichung) UND gegen eine absichtlich
    // verfaelschte Kopie (erwartet: die verfaelschte Zeile wird gefunden).
    const mismatches = (danger, curve, act) => Object.entries(curve)
      .filter(([ty, [room, pts]]) => {
        const d = danger[ty];
        return !d || d.unlockAct !== act || d.unlockRoomInAct !== room || d.points !== pts;
      })
      .map(([ty]) => ty);
    for (const [curve, act] of [[AKT2_CURVE, 2], [AKT3_CURVE, 3]]) {
      const bad = mismatches(diffData.danger, curve, act);
      check(bad.length === 0, `G9 (a): Akt ${act} weicht bei ${bad.join(',')} von der Designdokument-Kurve (Abschnitt 14) ab`);
    }
    // Gegenprobe: eine absichtlich verfaelschte Kopie (t_rusher auf Raum 99
    // statt 1) muss von genau derselben Funktion erkannt werden.
    const broken = { ...diffData.danger, t_rusher: { ...diffData.danger.t_rusher, unlockRoomInAct: 99 } };
    const foundBroken = mismatches(broken, AKT2_CURVE, 2);
    check(foundBroken.length === 1 && foundBroken[0] === 't_rusher',
      `G9 (a) Gegenprobe: eine verfaelschte Kopie (t_rusher Raum 99) wird nicht erkannt (${JSON.stringify(foundBroken)})`);
  }

  // ---- (b) Kein Raum fuehrt zwei NEUE Mechaniken gleichzeitig ein
  //          (Designdokument 14.3, erster Punkt). Bestandstypen (t_pink,
  //          t_armored, t_green, t_purple, t_white, t_black), die zur
  //          selben Raumnummer freigeschaltet werden, zaehlen NICHT --
  //          ihre Mechanik ist dem Spieler laengst bekannt. -------------
  {
    const duplicateRooms = (danger, newTypes) => {
      const byRoom = {};
      for (const ty of newTypes) {
        const r = danger[ty]?.unlockRoomInAct;
        (byRoom[r] ??= []).push(ty);
      }
      return Object.entries(byRoom).filter(([, list]) => list.length > 1);
    };
    for (const [newTypes, act] of [[NEW_AKT2, 2], [NEW_AKT3, 3]]) {
      const dups = duplicateRooms(diffData.danger, newTypes);
      check(dups.length === 0, `G9 (b): Akt ${act} fuehrt in Raum ${dups.map(([r]) => r).join(',')} mehrere neue Gegner gleichzeitig ein (${JSON.stringify(dups)})`);
    }
    // Gegenprobe des Mechanismus mit EIGENEN, absichtlich kollidierenden
    // Werten -- der Erkenner muss eine echte Kollision auch wirklich finden.
    const fakeDanger = { x: { unlockRoomInAct: 3 }, y: { unlockRoomInAct: 3 }, z: { unlockRoomInAct: 5 } };
    const fakeDups = duplicateRooms(fakeDanger, ['x', 'y', 'z']);
    check(fakeDups.length === 1 && fakeDups[0][1].length === 2,
      `G9 (b) Gegenprobe: eine echte Raum-Kollision (x/y beide Raum 3) wird nicht erkannt (${JSON.stringify(fakeDups)})`);
  }

  // ---- (c) Keine Komposition mit >=3 neuen Gegnern liegt vor Raum 7 des
  //          jeweiligen Akts (Designdokument 14.3, dritter Punkt). -------
  {
    const countNew = (comp, newTypes) => [...new Set(comp.enemies.map((e) => e.type))]
      .filter((t) => newTypes.includes(t)).length;
    const newSets = { 2: NEW_AKT2, 3: NEW_AKT3 };
    for (const c of diffData.compositions) {
      const n = countNew(c, newSets[c.actIndex] || []);
      check(!(n >= 3 && (c.minRoom ?? 1) < 7),
        `G9 (c): ${c.id} hat ${n} neue Gegner UND minRoom ${c.minRoom ?? 1} < 7 (Designdokument 14.3 verbietet das)`);
    }
    // Gegenprobe: eine synthetische Komposition mit 3 neuen Gegnern und
    // minRoom 5 muss von derselben Zaehlfunktion zuverlaessig gefangen werden.
    const fakeComp = { actIndex: 2, minRoom: 5, enemies: [{ type: 't_rusher' }, { type: 't_shotgun' }, { type: 't_dud' }] };
    const fakeN = countNew(fakeComp, NEW_AKT2);
    check(fakeN >= 3 && fakeComp.minRoom < 7,
      `G9 (c) Gegenprobe: eine echte Verletzung (3 neue Gegner, minRoom 5) wird nicht erkannt (n=${fakeN})`);
  }

  // ---- (d) "Kein neuer Gegner debuetiert in einem Eliteraum" (14.3,
  //          zweiter Punkt): fuer die Raeume 1-3 jedes Akts ist das
  //          STRUKTURELL garantiert -- Grundsteinumbau Phase 6 schliesst
  //          elite/cursed/workshop aus den ersten drei Kartenebenen aus
  //          (EARLY_EXCLUDED_TYPES, bereits in Abschnitt 50 bewacht). Hier
  //          wird nur die Verknuepfung zu den NEUEN Gegnern verifiziert:
  //          jeder Typ, der in Raum 1-3 freigeschaltet wird, kann seine
  //          Kartenebene tatsaechlich nie als Elite-/Fluchraum ziehen. ---
  {
    for (const [newTypes, act] of [[NEW_AKT2, 2], [NEW_AKT3, 3]]) {
      for (const ty of newTypes) {
        const room = diffData.danger[ty].unlockRoomInAct;
        if (room > 3) continue; // ausserhalb der garantierten Ebenen -- s. Befund unten
        let eliteSeen = 0;
        for (let s = 1; s <= 60; s++) {
          const map = generateMap(s * 131 + act, diffData, act);
          const layer = map.layers[room - 1];
          if (layer?.some((n) => n.type === 'elite' || n.type === 'cursed')) eliteSeen++;
        }
        check(eliteSeen === 0, `G9 (d): ${ty} (Raum ${room}, garantiert fruehe Ebene) zieht trotzdem einen Elite-/Fluchknoten in ${eliteSeen}/60 Seeds`);
      }
    }
    // BEFUND (nicht behoben, s. CLAUDE.md-To-do): fuer Raum 4+ gilt die
    // Garantie NICHT -- unlockRoomInAct steuert nur die Raum-NUMMER, nicht
    // den Raum-TYP, den der Kartengraph an dieser Ebene wuerfelt. Gemessen
    // (200 Seeds je Typ): t_lance/t_relay/t_medic/t_mason/t_anchor (Akt 2)
    // und t_arclight/t_stalker/t_grabber/t_harvester/t_metronom (Akt 3)
    // koennen ihre Debuet-Ebene mit 27-52% Wahrscheinlichkeit als Elite-
    // oder Fluchraum ziehen -- das widerspricht Designdokument 14.3 fuer
    // diese zehn Typen. Eine echte Behebung braeuchte eine neue,
    // laufzeitabhaengige "wurde dieser Typ in diesem Run schon gekauft"-
    // Buchfuehrung (der Kartengraph entsteht VOR jedem Raumkauf und kennt
    // den Spielerpfad nicht) -- Architekturarbeit, kein Abnahme-Umfang.
  }
}


// ---- 80. drawOne()-Signaturkarten-Fix -----------------------------------
// "Verbannen"/"Vierte Karte" (run.js: banOffer()/buyFourthCard()) sperrten
// beim Ersatzziehen bisher den GANZEN Tag "signature" (avoidTags baute auf
// dem rohen d.tag auf) statt nur die gebannte/schon angebotene id -- alle
// Signaturkarten JEDER Klasse teilen sich diesen Tag. Verbannen einer von
// mehreren gleichzeitig angebotenen Signaturkarten konnte dadurch NIE eine
// andere Signaturkarte als Ersatz ziehen, obwohl die Erstauswahl
// (rollOffers()) das seit Upgradepool-v2 Phase 2 (dedupeKey() auf "sig:id"
// statt "signature") ausdruecklich erlaubt -- eine Inkonsistenz zwischen
// Erst- und Ersatzauswahl. Fix: drawOne() filtert jetzt ueber dedupeKey()
// statt d.tag, beide Aufrufer bauen ihre Vermeidungsmenge entsprechend.
{
  const { drawOne, dedupeKey } = await import('../src/game/upgradepool.js');
  const { banOffer, buyFourthCard } = await import('../src/game/run.js');

  // Drei Signaturkarten derselben (synthetischen) Klasse + eine Kernkarte.
  const sigUpgrades = {
    upgrades: {
      sigA: { id: 'sigA', name: 'Sig A', tag: 'signature', signatureClass: 'x_class', rarity: 'common', isUnique: false, minRoom: 1, core: {} },
      sigB: { id: 'sigB', name: 'Sig B', tag: 'signature', signatureClass: 'x_class', rarity: 'common', isUnique: false, minRoom: 1, core: {} },
      sigC: { id: 'sigC', name: 'Sig C', tag: 'signature', signatureClass: 'x_class', rarity: 'common', isUnique: false, minRoom: 1, core: {} },
      core1: { id: 'core1', name: 'Core 1', tag: 'stat', rarity: 'common', isUnique: false, minRoom: 1, core: {} },
    },
    offersPerScreen: 3,
  };
  const balance = { rarity: { common: 100 }, scrap: { cost: { ban: 2, fourthCard: 3 } } };

  const makeRun = (pendingOfferIds) => ({
    phase: 'upgrade',
    pendingOffers: pendingOfferIds.map((id) => ({ ...sigUpgrades.upgrades[id] })),
    upgrades: {},
    roomIndex: 1,
    rng: { upgrades: () => 0 },
    data: { balance },
    upgradesData: sigUpgrades,
    bannedUpgrades: new Set(),
    starterTank: 'x_class',
    synergyTags: {},
    selectedUniqueUpgradeIds: new Set(),
    totalRoomIndex: 1,
    scrap: 100,
  });

  // ---- (a) drawOne() direkt: der Mechanismus selbst mit EIGENEN Karten --
  {
    const opts = { chosen: {}, rng: () => 0, balance, starterTank: 'x_class', synergyTags: {}, selectedUniqueUpgradeIds: new Set() };
    // sigB bleibt im Angebot, sigA wird verbannt -- avoidKeys nach dedupeKey()
    // enthaelt nur "sig:sigB", NICHT den Tag "signature" selbst.
    const avoidKeys = new Set([dedupeKey(sigUpgrades.upgrades.sigB)]);
    const avoidIds = new Set(['sigA']);
    const rep = drawOne(sigUpgrades, opts, avoidKeys, avoidIds);
    check(!!rep && rep.id === 'sigC', `Abschnitt 80 (a): drawOne() findet sigC nicht als Ersatz (bekam ${rep?.id ?? 'null'})`);
  }

  // ---- (b) End-to-End ueber banOffer(): Verbannen einer von zwei
  //          angebotenen Signaturkarten liefert eine DRITTE Signaturkarte,
  //          nicht "kein Ersatz". -----------------------------------------
  {
    const run = makeRun(['sigA', 'sigB', 'core1']);
    const ok = banOffer(run, 0); // verbannt sigA, sigB+core1 bleiben
    check(ok, 'Abschnitt 80 (b): banOffer() meldet Fehlschlag trotz vorhandenem Ersatz (sigC)');
    check(run.pendingOffers[0]?.id === 'sigC', `Abschnitt 80 (b): banOffer() ersetzt sigA nicht durch sigC (bekam ${run.pendingOffers[0]?.id})`);
  }

  // ---- (c) End-to-End ueber buyFourthCard(): eine vierte Karte darf eine
  //          weitere Signaturkarte derselben Klasse sein. -----------------
  {
    const run = makeRun(['sigA', 'sigB', 'core1']);
    const ok = buyFourthCard(run);
    check(ok, 'Abschnitt 80 (c): buyFourthCard() meldet Fehlschlag trotz vorhandener vierter Karte (sigC)');
    check(run.pendingOffers[3]?.id === 'sigC', `Abschnitt 80 (c): buyFourthCard() liefert nicht sigC als vierte Karte (bekam ${run.pendingOffers[3]?.id})`);
  }

  // ---- (d) Kontrolle: Kernpool-Karten (kein signatureClass) verhalten
  //          sich UNVERAENDERT weiterhin tag-basiert -- zwei Karten mit
  //          demselben Tag bleiben gegenseitig blockiert. ----------------
  {
    const statUpgrades = {
      upgrades: {
        s1: { id: 's1', name: 'Stat 1', tag: 'stat', rarity: 'common', isUnique: false, minRoom: 1, core: {} },
        s2: { id: 's2', name: 'Stat 2', tag: 'stat', rarity: 'common', isUnique: false, minRoom: 1, core: {} },
        other: { id: 'other', name: 'Other', tag: 'health', rarity: 'common', isUnique: false, minRoom: 1, core: {} },
      },
      offersPerScreen: 3,
    };
    const opts = { chosen: {}, rng: () => 0, balance, synergyTags: {}, selectedUniqueUpgradeIds: new Set() };
    const avoidKeys = new Set([dedupeKey(statUpgrades.upgrades.s1)]); // = "stat"
    const rep = drawOne(statUpgrades, opts, avoidKeys, new Set());
    check(!!rep && rep.id === 'other', `Abschnitt 80 (d): eine zweite "stat"-Karte (s2) wird trotz Tag-Kollision faelschlich gezogen (bekam ${rep?.id})`);
  }
}


// ---- 81. Code-Durchsicht: "Letzte Deckung" am Schild vorbei + Amboss ----
// Flaechenschaden gegen gestapelte Untertanen (zwei echte, mit Gegenprobe
// verifizierte Fehler, gefunden bei einer allgemeinen Code-Durchsicht, kein
// gemeldeter Nutzer-Bug).
{
  const { createState } = await import('../src/game/state.js');
  const { createGhost } = await import('../src/game/ghost.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');

  const necroRoom = (playerUpgrades = {}, types = ['t_pink']) => {
    const st = createState(tanksData, tilesData, {
      genRng: rngFor(1, 3, 'rooms'),
      enemyTypes: types,
      aiSeed: hashSeed(1, 3, 'ai'),
      playerUpgrades,
      upgradesData: necroData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'c_necro',
    });
    st.bullets.length = 0;
    st.mines.length = 0;
    st.ghosts.length = 0;
    st.player.protect = 0;
    st.shieldCharges = [];
    return st;
  };

  // (a) BUGFIX "Letzte Deckung" (ghost_025) am Spieler-Schild-Punktepool
  // vorbei: applyDamage() hatte fuer den Schild-Absorber-Zweig (schild-
  // Upgrade, tank.shieldReady + shieldHp) einen EIGENEN "hp abziehen ->
  // killTank()"-Ausgang, der nie bei ghost_025s Rettungspruefung vorbeikam.
  // Ein Schild machte den Nekromanten dadurch VERWUNDBARER als ganz ohne
  // Schild -- ein durchschlagener Treffer war nie rettbar, derselbe
  // Treffer OHNE Schild schon.
  {
    const st = necroRoom({ ghost_025: 1 });
    const g = createGhost(st, 0, 0, 0, 't_pink');
    g.hp = 5;
    st.ghosts.push(g);
    st.player.hp = 30;
    st.player.shieldReady = true;
    st.player.shieldHp = 10; // reicht bei Weitem nicht, um 100 Schaden abzufangen
    st.applyDamage(st.player, 100, 'test', {});
    check(st.player.alive, 'Abschnitt 81 (a): ghost_025 rettet nicht, wenn der Treffer zuerst durch den Spieler-Schild-Absorber lief');
    check(!g.alive, 'Abschnitt 81 (a): ghost_025 opfert bei aktivem Schild keinen Untertanen');
    check(st.necroLastStandUsed, 'Abschnitt 81 (a): ghost_025 markiert die Nutzung nicht, wenn der Schild zuerst griff');
  }

  // (b) Derselbe Fehler galt auch fuer einen toedlichen Statuseffekt-Tick
  // (Brand/Gift, meta.overTime): der DOT-Zweig hatte ebenfalls einen
  // eigenen "hp abziehen -> killTank()"-Ausgang ohne Rettungspruefung.
  // Kartentext nennt keine Einschraenkung auf Geschosse ("Tödlicher
  // Schaden"), ein toedlicher Tick soll die Karte also genauso ausloesen.
  {
    const st = necroRoom({ ghost_025: 1 });
    const g = createGhost(st, 0, 0, 0, 't_pink');
    g.hp = 5;
    st.ghosts.push(g);
    st.player.hp = 5;
    st.applyDamage(st.player, 50, 'brand', { overTime: true });
    check(st.player.alive, 'Abschnitt 81 (b): ghost_025 rettet nicht vor einem toedlichen Statuseffekt-Tick');
    check(st.necroLastStandUsed, 'Abschnitt 81 (b): ghost_025 markiert die Nutzung nicht bei einem toedlichen Tick');
  }

  // (c) BUGFIX state.damageGhost(): der Amboss rief fuer JEDES einzelne
  // Untertanen-Ziel (Schockwelle/Schleifspur/Rammstoss) die FLAECHEN-
  // funktion damageGhostsInRadius(ziel.x, ziel.y, 1, dmg) auf. Standen zwei
  // oder mehr Untertanen nahe beieinander (z. B. ein Legion-/Champion-
  // Build), traf JEDER dieser Aufrufe ALLE ueberlappenden Geister erneut --
  // bei zwei exakt uebereinanderstehenden Untertanen also den doppelten
  // Schaden statt des angegebenen. anvil.js ruft jetzt state.damageGhost()
  // fuer ein einzelnes, bereits bekanntes Ziel auf.
  {
    const st = necroRoom({}, ['t_pink', 't_pink']);
    const g1 = createGhost(st, 300, 300, 0, 't_pink');
    const g2 = createGhost(st, 300, 300, 0, 't_pink'); // exakt dieselbe Position
    st.ghosts.push(g1, g2);
    const before = [g1.hp, g2.hp];
    st.damageGhost(g1, 6);
    st.damageGhost(g2, 6);
    check(g1.hp === before[0] - 6, `Abschnitt 81 (c): state.damageGhost() zieht g1 den falschen Betrag ab (${before[0]} -> ${g1.hp})`);
    check(g2.hp === before[1] - 6, `Abschnitt 81 (c): state.damageGhost() zieht g2 den falschen Betrag ab (${before[1]} -> ${g2.hp}, sollte NICHT durch g1s Aufruf mitgetroffen worden sein)`);
  }

  // (d) Kontrolle: state.damageGhostsInRadius() bleibt fuer eine ECHTE
  // Flaechenquelle (ein gemeinsamer Mittelpunkt, mehrere Ziele im Radius)
  // unveraendert -- der Fix darf diesen Anwendungsfall nicht brechen
  // (spidermine.js nutzt ihn genau so).
  {
    const st = necroRoom({}, ['t_pink', 't_pink']);
    const g1 = createGhost(st, 100, 100, 0, 't_pink');
    const g2 = createGhost(st, 110, 100, 0, 't_pink');
    st.ghosts.push(g1, g2);
    const before = [g1.hp, g2.hp];
    st.damageGhostsInRadius(100, 100, 50, 8);
    check(g1.hp === before[0] - 8, `Abschnitt 81 (d): damageGhostsInRadius trifft g1 nicht mehr korrekt (${before[0]} -> ${g1.hp})`);
    check(g2.hp === before[1] - 8, `Abschnitt 81 (d): damageGhostsInRadius trifft g2 nicht mehr korrekt (${before[1]} -> ${g2.hp})`);
  }
}

// ---- 82. Codedurchsicht Phase C: Kartentexte vs. core-Werte --------------
// Fuer JEDE Karte in data/upgrades.json + data/upgrades_necro.json: hat
// jeder numerische core-Wert IRGENDWO im deutschen Beschreibungstext eine
// plausible Entsprechung? Bewusst eine LOSE OR-Pruefung ueber mehrere
// Deutungen (literal, als Prozentwert x*100, als Mult-Abweichung von 1),
// statt einer starren 1:1-Feldname-Zuordnung -- bei der Vielzahl an
// Namenskonventionen (Pct/Mult/Bonus/Add/Radius/Threshold/...) waere eine
// strenge Zuordnung ohne viele falsche Alarme nicht moeglich, und ein
// Konsistenztest, der aus dem falschen Grund rot wird, ist wertlos (CLAUDE.md-
// Grundregel). Ein erster, strengerer Entwurf (Python-Prototyp, nicht
// eingecheckt) fand ueber alle 123 aktiven Karten genau 6 Kandidaten -- vier
// waren echte Funde (drei gefixt, s. u.), zwei blosse Regex-Luecken (deutsche
// Ordnungszahlwoerter statt Ziffern: "jeder DRITTE Schuss"). Die Ordnungs-
// woerter 2.-10. sind deshalb hier als Ziffern-Aequivalente hinterlegt.
{
  const ORDINALS = {
    zweite: 2, zweiten: 2, zweiter: 2, zweites: 2,
    dritte: 3, dritten: 3, dritter: 3, drittes: 3,
    vierte: 4, vierten: 4, vierter: 4, viertes: 4,
    fünfte: 5, fünften: 5, fünfter: 5, fünftes: 5,
    sechste: 6, sechsten: 6, sechster: 6, sechstes: 6,
    siebte: 7, siebten: 7, siebter: 7, siebtes: 7,
    achte: 8, achten: 8, achter: 8, achtes: 8,
    neunte: 9, neunten: 9, neunter: 9, neuntes: 9,
    zehnte: 10, zehnten: 10, zehnter: 10, zehntes: 10,
  };
  // Karten, deren core-Feld bewusst NICHT im Text auftaucht -- eine reine
  // interne Engine-Feinabstimmung ohne Spec-Beleg (s. CLAUDE.md: "drei Karten
  // haben zusaetzlich _todo: balance ... ghost_032s Zielsucher-Lenkrate").
  const ALLOW = { ghost_032: new Set(['necroHomingTurnRate']) };

  function numbersInText(text) {
    const nums = [];
    for (const m of (text || '').matchAll(/\d+(?:[.,]\d+)?/g)) {
      nums.push(parseFloat(m[0].replace(',', '.')));
    }
    for (const m of (text || '').matchAll(/[A-Za-zäöüÄÖÜß]+/g)) {
      const word = m[0].toLowerCase();
      if (ORDINALS[word] != null) nums.push(ORDINALS[word]);
    }
    return nums;
  }

  function candidatesFor(value) {
    const set = new Set();
    const add = (n) => {
      set.add(Math.round(n * 1e6) / 1e6);
      set.add(Math.round(n));
    };
    add(value);
    add(value * 100);
    add((value - 1) * 100);
    add(Math.abs((value - 1) * 100));
    return set;
  }

  function fieldHasTextMatch(value, textNums, tol = 0.05) {
    const cands = candidatesFor(value);
    for (const c of cands) for (const n of textNums) if (Math.abs(c - n) <= tol) return true;
    return false;
  }

  const pools = [
    ['upgrades.json', upgradesData.upgrades],
    ['upgrades_necro.json', necroData.upgrades],
  ];
  let checked = 0;
  for (const [file, upgrades] of pools) {
    for (const [id, card] of Object.entries(upgrades)) {
      const core = card.core || {};
      const textNums = numbersInText(card.description);
      for (const [key, value] of Object.entries(core)) {
        if (typeof value !== 'number' || value === 0) continue;
        checked++;
        if (ALLOW[id]?.has(key)) continue;
        const ok = fieldHasTextMatch(value, textNums);
        check(
          ok,
          `Abschnitt 82: ${file}: ${id}.${key} = ${value} hat keine plausible Entsprechung im Kartentext ("${card.description}")`,
        );
      }
    }
  }
  // Selbstschutz (Muster wie Abschnitt 6b/45): eine kaputte Iteration (leere
  // Objekte, falscher Dateiname) darf nicht als "keine Funde" durchgehen.
  check(checked > 150, `Abschnitt 82: zu wenige core-Felder geprueft (${checked}) -- Iteration vermutlich kaputt`);
}

// ---- 83. Codedurchsicht Phase D: Standard-Klasse auf alle fuenf Stufen ---
// Nutzerentscheidung: reiner Generalist, ~20 Karten, keine neue Mechanik --
// 13 neue Karten (data/upgrades.json) schliessen uncommon/rare/epic (je 4)
// und eine vierte Legendaere, alle ueber bereits bestehende generische
// core-Schluessel. Abschnitt (a) der Section 80 (Phase 10, oben) bewacht
// bereits die geschlossene Kartenwelt (genau 21 ids); hier nur die neuen
// Mechanismen/Effekte, die diese Phase zum ersten Mal im aktiven Pool
// scharf schaltet.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { dashTank } = await import('../src/game/tank.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');
  const CMD0 = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };

  const playerRoom = (playerUpgrades = {}) =>
    createState(tanksData, tilesData, {
      genRng: rngFor(1, 1, 'rooms'),
      enemyTypes: ['t_brown'],
      aiSeed: hashSeed(1, 1, 'ai'),
      playerUpgrades,
      upgradesData,
      equippedSecondary: 'mine',
      transform: {},
      starterTank: 'player',
    });

  // (a) BUGFIX: core.dashGrant stuerzte applyUpgrades() ab, sobald KEINE
  // aktive Karte 'dash' mehr existiert (seit dem Grundsteinumbau archiviert)
  // -- der Fallback zeigte auf U.dash.distancePx, ein TypeError. Mechanismus
  // mit EIGENEN, von jeder echten Karte abweichenden Werten geprueft (nicht
  // den Zahlen von sockel_ausweichmanoever): ein synthetischer Pool OHNE die
  // Karte 'dash', dashCdMult 0.5 (keine reale Karte nutzt diesen Wert).
  {
    const synU = { upgrades: { testdash: { id: 'testdash', core: { dashGrant: true, dashCdMult: 0.5 } } } };
    let cfg;
    let threw = false;
    try {
      cfg = applyUpgrades(resolveCfg(tanksData, 'player'), { testdash: 1 }, synU, 'mine', null);
    } catch (e) {
      threw = true;
    }
    check(!threw, 'Abschnitt 83 (a): core.dashGrant laesst applyUpgrades() ohne aktive Karte "dash" abstuerzen');
    check(!!cfg?.dash && cfg.dash.dist > 0 && cfg.dash.iframe > 0, `Abschnitt 83 (a): cfg.dash ist nach dashGrant nicht sinnvoll befuellt (${JSON.stringify(cfg?.dash)})`);
    const baseCooldown = tanksData.balance.dash.cooldownS;
    check(
      Math.abs(cfg.dash.cooldown - baseCooldown * 0.5) < 1e-9,
      `Abschnitt 83 (a): dashCdMult wirkt nicht auf die Abklingzeit (${cfg?.dash?.cooldown} statt ${baseCooldown * 0.5})`,
    );
  }

  // (b) Ende-zu-Ende ueber die ECHTE Karte sockel_ausweichmanoever: ein
  // realer Raum, ein echter Dash-Ausfuehrungsschritt (tank.js: dashTank())
  // bewegt den Panzer tatsaechlich, keine Ausnahme.
  {
    const st = playerRoom({ sockel_ausweichmanoever: 1 });
    const before = { x: st.player.x, y: st.player.y };
    dashTank(st.player, st, () => {});
    const moved = Math.hypot(st.player.x - before.x, st.player.y - before.y);
    check(moved > 10, `Abschnitt 83 (b): sockel_ausweichmanoever fuehrt keinen echten Dash aus (Bewegung ${moved.toFixed(1)} px)`);
  }

  // (c) sockel_keramikplatten (resistAdd) senkt genommenen Schaden am echten
  // Trefferpunkt (state.js: applyDamage()) -- Mechanismus, nicht nur der
  // aufgeloeste cfg-Wert.
  {
    const ohne = playerRoom({});
    ohne.player.hp = 1000;
    ohne.applyDamage(ohne.player, 100, 'test', {});
    const dmgOhne = 1000 - ohne.player.hp;

    const mit = playerRoom({ sockel_keramikplatten: 1 });
    mit.player.hp = 1000;
    mit.applyDamage(mit.player, 100, 'test', {});
    const dmgMit = 1000 - mit.player.hp;
    check(dmgMit < dmgOhne, `Abschnitt 83 (c): sockel_keramikplatten senkt den genommenen Schaden nicht (${dmgMit} vs ${dmgOhne})`);
  }

  // (d) sockel_energieschild (shieldMaxAdd+shieldRegenAdd): echter Schild-
  // Punktepool faengt Schaden ab UND regeneriert ueber Zeit.
  {
    const st = playerRoom({ sockel_energieschild: 1 });
    check(st.player.cfg.shieldMax === 25, `Abschnitt 83 (d): shieldMaxAdd erreicht cfg.shieldMax nicht (${st.player.cfg.shieldMax})`);
    st.player.shield = 0;
    st.player.hp = 1000;
    // Schild-Regeneration laeuft im normalen Panzer-Tick (stepState()) --
    // ein kurzer, wandloser Tick reicht, um den Regen-Tick zu beobachten.
    for (let i = 0; i < 30; i++) stepState(st, CMD0, 1 / 60);
    check(st.player.shield > 0, `Abschnitt 83 (d): sockel_energieschild regeneriert nicht (${st.player.shield} nach 0,5s)`);
  }

  // (e) sockel_fangschuss (executeThreshold/executeMult): Schaden gegen ein
  // Ziel UNTER der Schwelle ist hoeher als gegen ein gleich starkes Ziel
  // OBERHALB -- reine Trefferschaden-Multiplikation (state.js), unabhaengig
  // von der globalen Exekutionsschwelle (t.executing, garantierter Kill).
  // Zielobjekt ist ein ECHTER, von playerRoom() erzeugter t_brown -- kein
  // von Hand gebautes Fake-Objekt (dem fehlen Felder wie ai/vx/vy/type, die
  // updateEnemy()/updateTargeting() lesen und die sonst abstuerzen, s.
  // CLAUDE.md-Faustregel "Testfallstrick" bei mehreren frueheren Sessions).
  {
    const shootAt = (hpFrac) => {
      const st = playerRoom({ sockel_fangschuss: 1 });
      const z = st.tanks.find((t) => t !== st.player);
      Object.assign(z, {
        x: 200, y: 250, prevX: 200, prevY: 250, heading: 0,
        alive: true, hp: Math.round(100 * hpFrac), protect: 0, shieldReady: false,
      });
      z.cfg = { ...z.cfg, role: 'guardian', maxHp: 100, armor: null };
      const b = createBullet(z.x - 2, z.y, 0, { speed: 1, radius: 3, owner: st.player, kind: 'bullet', damage: 20 });
      b.age = 5;
      st.bullets.length = 0;
      st.mines.length = 0;
      st.bullets.push(b);
      stepState(st, CMD0, 1 / 60);
      return Math.round(100 * hpFrac) - z.hp;
    };
    const lostLow = shootAt(0.2); // unter der 30%-Schwelle
    const lostHigh = shootAt(0.8); // ueber der Schwelle
    check(lostLow > lostHigh, `Abschnitt 83 (e): sockel_fangschuss macht gegen ein Ziel unter 30% nicht mehr Schaden (${lostLow} vs ${lostHigh})`);
  }
}

if (failures) {
  console.error(`\n${failures} Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Regressionstests bestanden.');
