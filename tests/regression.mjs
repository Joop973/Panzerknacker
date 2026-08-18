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
{
  const numericFields = [
    'speed', 'bulletSpeed', 'fireCooldown', 'magazine', 'mines',
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
      if (cfg.powershotPerRoom) {
        check(
          Number.isFinite(cfg.powershotSpeedFactor),
          `Karte "${id}" Stufe ${lvl}: vergibt Powershot-Ladungen ohne speedFactor`,
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
  const BOSSE = ['t_reactor', 't_mirror', 't_phalanx'];

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
        else break;
      }
    }
    console.log(`Phase 28 Raumdauer: schlimmster Raum >=10 = ${worst.toFixed(1)} s Mindest-Räumzeit (Budget ${BUDGET} s) -- ${worstInfo}`);
    check(worst > 0, 'Phase 28: kein Kampfraum >=10 gemessen (Test-Setup)');
    check(worst <= BUDGET, `Phase 28: Raum >=10 braucht mindestens ${worst.toFixed(1)} s (Budget ${BUDGET} s) -- ${worstInfo}`);
  }
}

// ---- 37. Upgradepool-v2 Phase 1: fuenf Seltenheitsstufen -----------------
// Sprung von drei (common/rare/legendary) auf fuenf Stufen (common/rare/
// epic/unique/legendary). Common/rare bleiben unveraendert, die alten 71
// legendary-Karten sind auf epic/unique/legendary umgestuft (Umstufungs-
// tabelle im PR). Diese Sektion prueft die neuen Strukturregeln, die
// vorherigen Abschnitte (10, 11-16, 18-27, 36) pruefen bereits, dass die
// gezogene Verteilung je Pool und ueber den echten Pool stimmt.
{
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const VALID_RARITIES = new Set(['common', 'rare', 'epic', 'unique', 'legendary']);

  // (a) Struktur: jede Karte hat eine der fuenf gueltigen Stufen; unique/
  //     legendary erzwingen maxStacks 1 (sonst waere eine "einzigartige"
  //     Karte mehrfach stapelbar -- Widerspruch zur Definition).
  {
    const U = upgradesData.upgrades;
    let badRarity = 0;
    let badMaxStacks = 0;
    for (const id in U) {
      const d = U[id];
      if (!VALID_RARITIES.has(d.rarity)) badRarity++;
      if ((d.rarity === 'unique' || d.rarity === 'legendary') && d.maxStacks !== 1) badMaxStacks++;
    }
    check(badRarity === 0, `Phase 1 (Upgradepool-v2): ${badRarity} Karte(n) mit ungueltiger rarity`);
    check(badMaxStacks === 0, `Phase 1 (Upgradepool-v2): ${badMaxStacks} unique/legendary-Karte(n) mit maxStacks != 1`);
  }

  // (b) MECHANISMUS der Raum-Gates (rarityGates): mit einem SYNTHETISCHEN
  //     Gate-Wert (5), nicht dem echten balance.json-Wert -- sonst waere der
  //     Test bei der naechsten Balance-Anpassung grundlos rot oder faelschlich
  //     gruen. Ein einzelner Kandidat + count:1 macht das Ergebnis
  //     deterministisch: vor dem Gate ist der Pool leer (Grundsteinumbau
  //     Phase 4: kein Fallback-Auffuellen mehr, s. upgradepool.js), ab dem
  //     Gate erscheint die echte Karte.
  {
    const { mulberry32 } = await import('../src/core/rng.js');
    const fakeData = {
      offersPerScreen: 1,
      upgrades: {
        gated_card: {
          id: 'gated_card', name: 'Testkarte', description: 'x', tag: 'testtag',
          rarity: 'unique', maxStacks: 1, requires: [], minRoom: 1,
        },
      },
    };
    const balance = { rarity: { unique: 100 }, rarityGates: { unique: { minRoom: 5 } } };
    const before = rollOffers(fakeData, {
      chosen: {}, roomIndex: 4, rng: mulberry32(1), balance, count: 1, banned: new Set(),
    });
    check(before.length === 0, 'Phase 1 (Upgradepool-v2): rarityGate laesst die Karte VOR ihrem Mindestraum durch');
    const after = rollOffers(fakeData, {
      chosen: {}, roomIndex: 5, rng: mulberry32(1), balance, count: 1, banned: new Set(),
    });
    check(after[0]?.id === 'gated_card', 'Phase 1 (Upgradepool-v2): rarityGate haelt die Karte auch AB ihrem Mindestraum noch zurueck');
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
  const { createRun, stepRun: sr, chooseUpgrade: cu, enterRoom: er, leaveWorkshop: lw, chooseEventOption: ceo } = await import('../src/game/run.js');
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
  const { createGhost, updateGhosts } = await import('../src/game/ghost.js');
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
    const g = createGhost(st, 300, 48);
    st.ghosts.push(g);

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
    check(st.ghosts.length === 0, 'Phase 5 (Zielsystem): ein toedlicher Treffer entfernt den Geist nicht');
  }
}

// ---- 42. Upgradepool-v2 Phase 6: Nekromant -- Klassenidentitaet ---------
// Die Geistermechanik ist ab Klassenwahl aktiv (kein Upgrade noetig): Kill
// durch den Nekromanten 50 % Geist, Kill durch einen Geist 33 % --
// deterministisch ueber state.rng. Kill-Zuordnung (meta.killer) haengt an
// applyDamage()/killTank() und muss auch fuer Minen-, Explosions- und
// Kettenblitz-Kills stimmen. Geisterbombe ersetzt den Bombenslot komplett.
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { useSecondary } = await import('../src/game/tank.js');
  const { createBullet } = await import('../src/game/bullet.js');
  const { createMine, updateMines } = await import('../src/game/mine.js');
  const { resolveCfg } = await import('../src/game/cfg.js');
  const { rollOffers } = await import('../src/game/upgradepool.js');
  const { hashSeed, rngFor, mulberry32 } = await import('../src/core/rng.js');

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

  // (b) Spawn-Wuerfel: deterministisch ueber state.rng, korrekt je
  // Verursacher (Nekromant 50 %, Geist 33 %, alle anderen 0 %).
  {
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
    check(rollKill('c_necro', 'player', 0.49) === 1, 'Phase 6: Nekromant-Kill unter der 50%-Schwelle erzeugt keinen Geist');
    check(rollKill('c_necro', 'player', 0.51) === 0, 'Phase 6: Nekromant-Kill ueber der 50%-Schwelle erzeugt trotzdem einen Geist');
    check(rollKill('c_necro', 'ghost', 0.32) === 1, 'Phase 6: Geist-Kill unter der 33%-Schwelle erzeugt keinen Geist');
    check(rollKill('c_necro', 'ghost', 0.34) === 0, 'Phase 6: Geist-Kill ueber der 33%-Schwelle erzeugt trotzdem einen Geist');
    check(rollKill('player', 'player', 0) === 0, 'Phase 6: eine Nicht-Nekromant-Klasse erzeugt trotzdem einen Geist (Chance ist 0)');
    check(rollKill('c_necro', 'none', 0) === 0, 'Phase 6: ein Kill ohne bekannten Killer (z. B. Statuseffekt-Tick) erzeugt trotzdem einen Geist');
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
    // weiter unten).
    st.player.ghostBombCooldown = 0;
    useSecondary(st.player, st, null);
    st.player.ghostBombCooldown = 0;
    useSecondary(st.player, st, null);
    check(st.ghosts.length === 3, 'Phase 6: Vorbedingung Geisterbomben-Limit (nicht auf 3 gekommen)');
    st.player.ghostBombCooldown = 0;
    check(useSecondary(st.player, st, null) === false, 'Phase 6: die Geisterbombe loest am Limit trotzdem aus');
    check(st.ghosts.length === 3, 'Phase 6: das Geistlimit wird per Geisterbombe ueberschritten');

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

// ---- 43. Upgradepool-v2 Phase 7: Geisterpanzer neu gebaut ----------------
// Anhang B S18/S20: eigener, fester Basiseinheiten-Typ `ghost_tank`. Ersetzt
// ghost.js komplett -- ab hier haben ALLE Geister exakt dieselben, vom
// getoeteten Gegner UNABHAENGIGEN Basiswerte (S8), keinen Lebensdauer-Timer
// mehr (S6) und schiessen erst innerhalb einer Feuer-Schwelle (S7).
{
  const { createState, stepState } = await import('../src/game/state.js');
  const { createGhost, updateGhosts, killGhost } = await import('../src/game/ghost.js');
  const { useSecondary } = await import('../src/game/tank.js');
  const { resolveCfg } = await import('../src/game/cfg.js');
  const { hashSeed, rngFor } = await import('../src/core/rng.js');

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
    // KEIN st.ghosts.length = 0 hier (anders als bullets/mines) -- Test (i)
    // soll pruefen, dass createState() selbst ein frisches Array liefert,
    // nicht dass dieser Testhelfer eins erzwingt (sonst waere die Aussage
    // "Raumwechsel entfernt alle Geister" trivial wahr durch den Helfer,
    // nicht durch die produktive Logik -- per Gegenprobe gefunden).
    return st;
  };

  // (a) Einheitlicher Unit-Typ: JEDER Erzeugungsweg (Kill-Wuerfel UND
  // Geisterbombe) liefert denselben 'ghost_tank' (Anhang B Kernregel 4).
  {
    const st = necroRoom();
    const e = st.tanks.find((t) => t !== st.player);
    e.protect = 0;
    st.rng = () => 0; // garantierter Spawnwurf
    st.killTank(e, 'test', { killer: st.player });
    check(st.ghosts[0]?.type === 'ghost_tank', `Phase 7: Kill-Spawn erzeugt Typ ${st.ghosts[0]?.type} statt ghost_tank`);

    useSecondary(st.player, st, null); // Geisterbombe (2. Slot, Kappe noch nicht erreicht)
    check(st.ghosts[1]?.type === 'ghost_tank', `Phase 7: Geisterbombe erzeugt Typ ${st.ghosts[1]?.type} statt ghost_tank`);
  }

  // (b) Feste Basiswerte gegen die Anhang-B-Zahlen (S7): 60 LP, 8 Schaden,
  // 2,0 s Schussintervall, keine Ruestung. ("0 Abpraller" aus Anhang B ist
  // mit dem Bandenschuss gegenstandslos, Grundsteinumbau Phase 1 -- es gibt
  // das Konzept fuer niemanden mehr.) Tempo/Kugeltempo/Reichweite als
  // Prozentsatz der STANDARDKLASSE player (nicht des Nekromanten) --
  // ausdruecklich gegen resolveCfg(tanksData,'player') nachgerechnet, nicht
  // gegen einen zweiten hartkodierten Wert.
  {
    const st = necroRoom();
    const g = createGhost(st, 0, 0);
    const p = resolveCfg(tanksData, 'player');
    check(g.cfg.maxHp === 60, `Phase 7: Geist-LP ${g.cfg.maxHp} statt 60`);
    check(g.cfg.damage === 8, `Phase 7: Geist-Schaden ${g.cfg.damage} statt 8`);
    check(g.cfg.fireCooldown === 2.0, `Phase 7: Geist-Schussintervall ${g.cfg.fireCooldown} statt 2,0 s`);
    check(g.cfg.armor === null, 'Phase 7: Geist hat eine Panzerung');
    check(
      Math.abs(g.cfg.speed - p.speed * 0.7) < 1e-9,
      `Phase 7: Geist-Tempo ${g.cfg.speed} statt 70 % von ${p.speed} (Standardklasse player)`,
    );
    check(
      Math.abs(g.cfg.bulletSpeed - p.bulletSpeed * 0.8) < 1e-9,
      `Phase 7: Geist-Kugeltempo ${g.cfg.bulletSpeed} statt 80 % von ${p.bulletSpeed}`,
    );
    check(
      Math.abs(g.cfg.fireRangePx - tanksData.balance.bullet.maxDistance * 0.65) < 1e-9,
      `Phase 7: Geist-Feuerschwelle ${g.cfg.fireRangePx} statt 65 % von balance.bullet.maxDistance`,
    );
  }

  // (c) Mechanismus statt Datenlage: die drei Prozentsaetze wirklich MULTI-
  // PLIKATIV gegen die player-Baseline, nicht hartkodiert -- mit einem
  // synthetischen Wert veraendert, der von den echten 0.7/0.8/0.65 abweicht.
  {
    const orig = { ...tanksData.types.ghost_tank };
    tanksData.types.ghost_tank.speedPct = 0.4;
    tanksData.types.ghost_tank.bulletSpeedPct = 0.3;
    tanksData.types.ghost_tank.rangePct = 0.2;
    try {
      const st = necroRoom();
      const g = createGhost(st, 0, 0);
      const p = resolveCfg(tanksData, 'player');
      check(Math.abs(g.cfg.speed - p.speed * 0.4) < 1e-9, 'Phase 7: speedPct wirkt nicht multiplikativ');
      check(Math.abs(g.cfg.bulletSpeed - p.bulletSpeed * 0.3) < 1e-9, 'Phase 7: bulletSpeedPct wirkt nicht multiplikativ');
      check(
        Math.abs(g.cfg.fireRangePx - tanksData.balance.bullet.maxDistance * 0.2) < 1e-9,
        'Phase 7: rangePct wirkt nicht multiplikativ',
      );
    } finally {
      Object.assign(tanksData.types.ghost_tank, orig);
    }
  }

  // (d) KEIN Stat-Erbe vom getoeteten Gegner (Anhang B Kernregel 5, S8):
  // ein sehr schwacher UND ein kuenstlich sehr starker Gegner erzeugen
  // IDENTISCHE Geister.
  {
    const leicht = necroRoom(['t_pink']);
    const eLeicht = leicht.tanks.find((t) => t !== leicht.player);
    eLeicht.protect = 0;
    eLeicht.cfg.maxHp = 5; // synthetisch sehr schwach
    leicht.rng = () => 0;
    leicht.killTank(eLeicht, 'test', { killer: leicht.player });

    const schwer = necroRoom(['t_pink']);
    const eSchwer = schwer.tanks.find((t) => t !== schwer.player);
    eSchwer.protect = 0;
    eSchwer.cfg.maxHp = 99999; // synthetisch "Boss"-stark
    schwer.rng = () => 0;
    schwer.killTank(eSchwer, 'test', { killer: schwer.player });

    const gL = leicht.ghosts[0];
    const gS = schwer.ghosts[0];
    check(!!gL && !!gS, 'Phase 7: Vorbedingung -- nicht beide Kills haben einen Geist erzeugt');
    check(
      gL.cfg.maxHp === gS.cfg.maxHp && gL.cfg.damage === gS.cfg.damage && gL.cfg.speed === gS.cfg.speed,
      `Phase 7: Geister aus unterschiedlich starken Gegnern unterscheiden sich (leicht: ${gL.cfg.maxHp} LP, schwer: ${gS.cfg.maxHp} LP)`,
    );
  }

  // (e) KEIN Lebensdauer-Timer (Anhang B S6): ein Geist ohne Ziel bleibt
  // ueber eine lange simulierte Zeit hinweg am Leben. Im alten System (vor
  // Phase 7) waere er nach balance.ghost.duration (Fallback 3 s) verfallen.
  {
    const st = necroRoom([]);
    st.tanks.length = 1; // nur der Spieler -- kein Ziel fuer den Geist
    const g = createGhost(st, 300, 300);
    st.ghosts.push(g);
    for (let i = 0; i < 60 * 20; i++) updateGhosts(st, 1 / 60); // 20 simulierte Sekunden
    check(st.ghosts.length === 1 && g.alive, 'Phase 7: ein Geist ohne Ziel verfaellt trotzdem nach einiger Zeit');
  }

  // (f) Feuer-Schwelle: ausserhalb von fireRangePx wird trotz freier Sicht
  // und exakter Ausrichtung NICHT geschossen, das Verfolgen (Bewegung)
  // bleibt aber unbegrenzt aktiv (Anhang B S7: "das Verfolgen bleibt
  // unbegrenzt"). Eigene, kuenstlich verkleinerte rangePct statt der echten
  // 780 px -- die Arena (768x512) laesst innerhalb einer Zeile keine 780 px
  // Abstand zu, ausserdem misst das so den MECHANISMUS statt der aktuellen
  // Datenlage (CLAUDE.md-Pflicht).
  {
    const origRangePct = tanksData.types.ghost_tank.rangePct;
    tanksData.types.ghost_tank.rangePct = 0.05; // fireRangePx = 0.05 * 1200 = 60
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
      const g = createGhost(st, 100, 48); // Abstand 300 > fireRangePx (60)
      check(g.cfg.fireRangePx === 60, `Phase 7: Vorbedingung -- fireRangePx ist ${g.cfg.fireRangePx} statt 60`);
      check(
        Math.hypot(e.x - g.x, e.y - g.y) > g.cfg.fireRangePx,
        'Phase 7: Vorbedingung -- das Ziel liegt bereits innerhalb der Feuer-Schwelle',
      );
      st.ghosts.push(g);
      const xVor = g.x;
      for (let i = 0; i < 90; i++) updateGhosts(st, 1 / 60);
      check(st.bullets.length === 0, 'Phase 7: der Geist schiesst trotz Ziel ausserhalb der Feuer-Schwelle');
      check(g.x > xVor, 'Phase 7: der Geist bewegt sich nicht auf ein zu weit entferntes Ziel zu (Verfolgen ist nicht unbegrenzt)');

      // Jetzt nah genug heranholen -- derselbe Geist schiesst jetzt.
      g.x = e.x - 50;
      g.y = e.y;
      g.turret = 0; // schon ausgerichtet, damit der Schuss nicht am Winkel scheitert
      updateGhosts(st, 1 / 60);
      check(st.bullets.length === 1, 'Phase 7: der Geist schiesst innerhalb der Feuer-Schwelle trotzdem nicht');
    } finally {
      tanksData.types.ghost_tank.rangePct = origRangePct;
    }
  }

  // (g) killGhost(): der Basistod hat KEINEN Zusatzeffekt (Anhang B S13/S17)
  // -- nur alive wird false, sonst nichts; idempotent bei doppeltem Aufruf.
  {
    const st = necroRoom();
    const g = createGhost(st, 10, 20);
    const vorher = { ...g };
    killGhost(st, g);
    check(g.alive === false, 'Phase 7: killGhost() setzt alive nicht auf false');
    for (const k of Object.keys(vorher)) {
      if (k === 'alive') continue;
      check(g[k] === vorher[k], `Phase 7: killGhost() veraendert Feld "${k}" (Basistod haette keinen Zusatzeffekt)`);
    }
    killGhost(st, g); // zweiter Aufruf darf nicht werfen oder etwas doppelt tun
    check(g.alive === false, 'Phase 7: ein zweiter killGhost()-Aufruf ist nicht idempotent');
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
    check(st.ghosts.length === 1, 'Phase 7: Vorbedingung -- der erste Kill erzeugt keinen Geist');
    killGhost(st, st.ghosts[0]);
    st.ghosts = st.ghosts.filter((g) => g.alive);
    check(st.ghosts.length === 0, 'Phase 7: Vorbedingung -- der Geist ist nach killGhost() noch da');
    st.killTank(e2, 'test', { killer: st.player });
    check(st.ghosts.length === 1, 'Phase 7: nach dem Tod des ersten Geistes entsteht kein neuer mehr');
  }

  // (i) Raumwechsel entfernt alle Geister (Anhang B S15, Testschritt 4) --
  // ueber die echte createState()-Frischzelle, nicht nur behauptet.
  {
    const st1 = necroRoom();
    const e = st1.tanks.find((t) => t !== st1.player);
    e.protect = 0;
    st1.rng = () => 0;
    st1.killTank(e, 'test', { killer: st1.player });
    check(st1.ghosts.length === 1, 'Phase 7: Vorbedingung -- kein Geist im ersten Raum');
    const st2 = necroRoom(); // simuliert den naechsten Raum (frisches createState)
    check(st2.ghosts.length === 0, 'Phase 7: Geister ueberleben einen Raumwechsel');
  }

  // (j) Regressionsschutz: ghost_tank ist keine purchasable Gegnerkarte
  // (fehlt in difficulty.json: danger) und zaehlt nicht gegen den
  // enemiesAlive-Deckel (Geister stehen nie in state.tanks).
  {
    check(!diffData.danger?.ghost_tank, 'Phase 7: ghost_tank ist als purchasable Gegner in difficulty.json gelistet');
    const st = necroRoom();
    const e = st.tanks.find((t) => t !== st.player);
    e.protect = 0;
    st.rng = () => 0;
    st.killTank(e, 'test', { killer: st.player });
    check(
      !st.tanks.includes(st.ghosts[0]),
      'Phase 7: ein Geist steckt in state.tanks (wuerde gegen limits.enemiesAlive zaehlen)',
    );
  }
}

// ---- 44. Upgradepool-v2 Phase 8: Signaturtopf Nekromant (18 Karten) -- archiviert
// Struktur/Filter/Applier-Arithmetik + Mechanismus-Nachweise (Rudelbonus,
// Seelensog, Seelenketten, Letzter Wille, Wiederkehr-Familie, Geister-
// kommandant, Phylakterium, NaN/Infinity-Check) fuer die 18 sig_necro_*-
// Karten. Mit Grundsteinumbau Phase 4 ist der gesamte Signaturpool nach
// archive/upgrades-v1.json ausgelagert (data/upgrades.json: 5-Karten-
// Sockel) -- jede dieser Pruefungen waere seitdem strukturell rot. Die
// zugrundeliegende Basiseinheit (ghost_tank, ghost.js: resolveGhostCfg())
// bleibt unangetastet gebaut und wird weiterhin von Abschnitt 43 bewacht;
// die 16 ghost*-core-Schluessel in cfg.js selbst sind ohne eine Karte, die
// sie setzt, aktuell unerreichbar. Details/Wiederanschlusspunkt: ARCHIV.md,
// archive/upgrades-v1.json.


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
  const { createGhost, updateGhosts, killGhost } = await import('../src/game/ghost.js');
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

  // (a) Punkt 2: die Spawnquoten sind nicht nur an der Schwelle richtig
  // (das prueft 42(b) mit gestelltem rng), sondern auch STATISTISCH ueber
  // viele Kills mit einem echten geseedeten Strom. Bewusst gegen die
  // balance.json-Sollwerte gemessen -- der Auftrag nennt sie ausdruecklich
  // ("50 % / 33 % Spawnchance, mit festem Seed ueber viele Kills gemessen"),
  // eine Balance-Aenderung SOLL diesen Test also mitziehen.
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
    const soll = tanksData.balance.ghost.spawnChance;
    const qn = quote('necro');
    const qg = quote('ghost');
    check(
      Math.abs(qn - soll.necro) <= TOLERANZ,
      `Phase 9: Nekromant-Spawnquote ${(qn * 100).toFixed(1)} % statt ${(soll.necro * 100).toFixed(0)} % (${N} Kills)`,
    );
    check(
      Math.abs(qg - soll.ghost) <= TOLERANZ,
      `Phase 9: Geist-Spawnquote ${(qg * 100).toFixed(1)} % statt ${(soll.ghost * 100).toFixed(0)} % (${N} Kills)`,
    );
  }

  // (b) Punkt 3: auch ein BOSS-Kill erzeugt denselben Basistyp mit denselben
  // Werten -- Anhang B S8 nennt den Boss ausdruecklich ("Boss ->
  // Geisterpanzer"). 43(d) prueft das nur mit synthetisch aufgeblasenen
  // Gegnern, hier mit einem echten Boss aus tanks.json.
  {
    const st = arenaRoom(['t_mirror'], 'boss_mirror');
    const boss = st.tanks.find((t) => t !== st.player);
    check(boss.cfg.maxHp >= 500, `Phase 9: Vorbedingung -- Boss hat nur ${boss.cfg.maxHp} LP`);
    boss.protect = 0;
    st.rng = () => 0; // garantierter Spawnwurf
    st.killTank(boss, 'test', { killer: st.player });
    const g = st.ghosts[0];
    check(!!g && g.type === 'ghost_tank', `Phase 9: Boss-Kill erzeugt Typ ${g?.type} statt ghost_tank`);
    // Gegenprobe zum Erben: der Geist darf NICHTS vom Boss uebernehmen.
    const vergleich = createGhost(necroRoom(), 0, 0);
    check(
      g.cfg.maxHp === vergleich.cfg.maxHp && g.cfg.damage === vergleich.cfg.damage,
      `Phase 9: Boss-Geist (${g.cfg.maxHp} LP / ${g.cfg.damage} Schaden) weicht vom Basistyp ab`,
    );
  }

  // (c) Punkt 4: am Limit wird NICHTS verdraengt -- die Geist-IDs vor und
  // nach einem weiteren garantierten Kill sind identisch. 42(c) prueft nur
  // die ANZAHL (die bliebe auch bei einer FIFO-Verdraengung gleich!), was
  // genau den Fehler durchlassen wuerde, den Anhang B S5 verbietet.
  {
    const st = necroRoom(['t_pink', 't_pink', 't_pink', 't_pink']);
    st.rng = () => 0; // garantierter Wurf
    const gegner = st.tanks.filter((t) => t !== st.player);
    for (const e of gegner) e.protect = 0;
    for (let i = 0; i < 3; i++) st.killTank(gegner[i], 'test', { killer: st.player });
    check(st.ghosts.length === 3, `Phase 9: Vorbedingung -- ${st.ghosts.length} statt 3 Geister am Limit`);
    const idsVorher = st.ghosts.map((g) => g.id);
    st.killTank(gegner[3], 'test', { killer: st.player }); // 4. Kill am Limit
    const idsNachher = st.ghosts.map((g) => g.id);
    check(st.ghosts.length === 3, `Phase 9: das Geistlimit wird ueberschritten (${st.ghosts.length})`);
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
  // maxStacks und requires koennen ihre Wirkung erst zeigen, wenn ein Run
  // ueberhaupt Karten besitzt.
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
            if ((chosen[o.id] || 0) >= d.maxStacks) vMax++;
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
    check(vMax === 0, `Phase 9 (Punkt 19): ${vMax}x eine Karte angeboten, deren maxStacks schon erreicht war`);
    check(vReq === 0, `Phase 9 (Punkt 20): ${vReq}x eine Karte mit unerfuelltem requires angeboten`);
    check(vDup === 0, `Phase 9 (Punkt 21): ${vDup}x dieselbe Karte mehrfach im selben Angebot`);
  }

  // (k) Punkt 24: JEDE Karte des Pools (nicht nur die 18 neuen aus 44(o))
  // loest sich sauber in ein Spieler-cfg auf. Gegen die UPGRADE-LOSE Basis
  // derselben Klasse verglichen: `role`/`miner` sind bei jeder Spielerklasse
  // von Haus aus undefined -- ein pauschaler undefined-Test waere dadurch
  // dauerhaft rot und haette gar nichts geprueft.
  {
    const basisCache = {};
    const basis = (k) => (basisCache[k] ||= applyUpgrades(resolveCfg(tanksData, k), {}, upgradesData, 'mine', null));
    let schlecht = 0;
    let geprueft = 0;
    for (const id in U) {
      const def = U[id];
      const chosen = { [id]: def.maxStacks };
      for (const r of def.requires || []) chosen[r] = U[r].maxStacks;
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
  {
    const st = necroRoom(['t_pink', 't_pink', 't_pink']);
    st.rng = () => 0;
    for (const e of st.tanks.filter((t) => t !== st.player)) {
      e.protect = 0;
      st.killTank(e, 'test', { killer: st.player });
    }
    check(st.ghosts.length === 3, 'Nekromant-Bombe: Vorbedingung -- Limit nicht erreicht');
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
        getOffers: () => [],
        getEquippedSecondary: () => null,
        lifeBought: () => false,
        onBuyCard: () => false,
        onBuyShield: () => false,
        onBuySecondary: () => false,
        onBuyLife: () => false,
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

if (failures) {
  console.error(`\n${failures} Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Regressionstests bestanden.');
