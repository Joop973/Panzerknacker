// USP-Kennzahl 1 aus PLAN.md ("Pruefpunkte") messen:
//
//   "Erzwungene Bankshots -- Anteil der Raeume ab Raum 5 mit mindestens
//    einem nicht direkt toetbaren Gegner. Zielwert 60 %."
//
// Der Plan notiert dazu "Design-Kontrolle ueber den Generator, keine
// Messung" -- tatsaechlich ist die Zahl aber ohne einen einzigen gespielten
// Run bestimmbar: Gegnerauswahl und Raumfolge haengen nur am Seed. Dieses
// Werkzeug spielt N Runs mit dem Cheat-Kill durch (wie die Regressionssuite)
// und zaehlt, was in den Raeumen tatsaechlich steht.
//
// Aufruf:  node tests/uspcheck.mjs [seeds]
//
// "Nicht direkt toetbar" = requiresRicochet (Prisma, Spiegel-Boss): stirbt
// ausschliesslich an einer Kugel mit Wandabpraller. Der Gepanzerte
// (armor.arc) ist bewusst NICHT mitgezaehlt -- er erzwingt ein Flankier-
// manoever, aber keinen Bankshot; er wird separat ausgewiesen.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRun, stepRun, chooseUpgrade, enterRoom, chooseMapNode, leaveWorkshop, chooseEventOption } from '../src/game/run.js';

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

const FROM_ROOM = 5; // PLAN.md: "ab Raum 5"
const TARGET = 0.6; // PLAN.md: Zielwert 60 %

const types = tanksData.types;
const needsBankshot = (ty) => !!types[ty]?.requiresRicochet;
const hasArmor = (ty) => !!types[ty]?.armor?.arc;

const CMD = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, mine: false, dash: false };
const STEP = 1 / 60;

function cheatKillAll(st) {
  for (const w of [...st.walls]) {
    if (w.type === 'generator') while (st.walls.includes(w)) st.destroyWall(w);
  }
  for (const t of st.tanks) if (t !== st.player && t.alive) st.killTank(t, 'usp');
}

export function measure(seedCount = 40) {
  const stats = {
    rooms: 0, // Kampfraeume ab FROM_ROOM
    withBankshot: 0, // davon mit mind. 1 requiresRicochet-Gegner
    withArmor: 0, // davon mit mind. 1 gepanzerten Gegner
    withEither: 0,
    byRoom: {}, // Raumnummer -> { total, bankshot }
    typeCount: {},
    runsFinished: 0,
  };

  for (let seed = 1; seed <= seedCount; seed++) {
    const run = createRun(tanksData, tilesData, diffData, upgradesData, seed);
    let guard = 200000;
    let seenRoom = -1;
    while (run.phase !== 'victory' && run.phase !== 'gameover' && guard-- > 0) {
      if (run.phase === 'preview') enterRoom(run);
      else if (run.phase === 'transition') stepRun(run, CMD, STEP);
      else if (run.phase === 'playing') {
        const st = run.state;
        if (seenRoom !== run.roomIndex) {
          seenRoom = run.roomIndex;
          // Volle Gegnerliste des Raums: schon gespawnte + zurueckgehaltene
          // zweite Welle (Phase 9) -- sonst faellt die halbe Besetzung weg.
          const all = [
            ...st.tanks.slice(1).map((t) => t.type),
            ...(st.pendingWave?.types || []),
          ];
          for (const ty of all) stats.typeCount[ty] = (stats.typeCount[ty] || 0) + 1;
          if (run.roomIndex >= FROM_ROOM && all.length) {
            stats.rooms++;
            const bank = all.some(needsBankshot);
            const armor = all.some(hasArmor);
            if (bank) stats.withBankshot++;
            if (armor) stats.withArmor++;
            if (bank || armor) stats.withEither++;
            const r = (stats.byRoom[run.roomIndex] ||= { total: 0, bankshot: 0 });
            r.total++;
            if (bank) r.bankshot++;
          }
        }
        cheatKillAll(st);
        stepRun(run, CMD, STEP);
      } else if (run.phase === 'upgrade') chooseUpgrade(run, 0);
      else if (run.phase === 'map') {
        const cur = run.map.byId.get(run.mapCurrentId);
        let moved = false;
        for (const id of cur?.next || []) if (chooseMapNode(run, id)) { moved = true; break; }
        if (!moved) break;
      } else if (run.phase === 'workshop') leaveWorkshop(run);
      else if (run.phase === 'event') chooseEventOption(run, 0);
      else break;
    }
    if (run.phase === 'victory') stats.runsFinished++;
  }
  return stats;
}

// Direkt aufgerufen -> Bericht ausgeben.
if (import.meta.url === `file://${process.argv[1]}`) {
  const seeds = Number(process.argv[2]) || 40;
  const s = measure(seeds);
  const pct = (n) => `${((100 * n) / s.rooms).toFixed(1)} %`;
  console.log(`USP-Kennzahl 1 -- ${seeds} Runs, ${s.rooms} Kampfräume ab Raum ${FROM_ROOM}\n`);
  console.log(`  mit erzwungenem Bankshot (requiresRicochet): ${s.withBankshot}  (${pct(s.withBankshot)})`);
  console.log(`  Zielwert laut PLAN.md:                       ${(TARGET * 100).toFixed(0)} %`);
  console.log(`  ${s.withBankshot / s.rooms >= TARGET ? 'ERREICHT' : 'VERFEHLT'}\n`);
  console.log(`  nachrichtlich, mit gepanzertem Gegner:       ${s.withArmor}  (${pct(s.withArmor)})`);
  console.log(`  mit Bankshot ODER Panzerung:                 ${s.withEither}  (${pct(s.withEither)})\n`);
  console.log('  Verteilung nach Raumnummer (Bankshot/gesamt):');
  for (const r of Object.keys(s.byRoom).map(Number).sort((a, b) => a - b)) {
    const b = s.byRoom[r];
    const bar = '#'.repeat(Math.round((20 * b.bankshot) / b.total));
    console.log(`    Raum ${String(r).padStart(2)}: ${String(b.bankshot).padStart(3)}/${String(b.total).padStart(3)}  ${bar}`);
  }
  console.log('\n  Gegnertypen insgesamt:');
  for (const [ty, n] of Object.entries(s.typeCount).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${ty.padEnd(12)} ${n}`);
  }
}
