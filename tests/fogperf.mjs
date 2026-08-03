// P11-Test: additive Lichtmaske (Nebel/Dunkelheit) -- Korrektheit +
// Renderzeit (Playwright, optional).
//
//   node tests/fogperf.mjs
//
// Warum getrennt von tests/regression.mjs: renderer.js legt beim Aufbau
// (createRenderer()) ein echtes Offscreen-Canvas an (fogCanvas) und ruft
// createRadialGradient()/drawImage() darauf auf -- das braucht eine echte
// Canvas-2D-Implementierung, die tests/domstub.mjs bewusst nicht bietet
// (dieselbe Grenze wie bei tests/uilayout.mjs/viewport.mjs).
//
// Prueft:
//  1. Korrektheit: an der Position des dem Spieler NAECHSTEN Gegners ist
//     die Nebelflaeche tatsaechlich heller (durchscheinender) als an einer
//     entfernten, unbeleuchteten Stelle -- die additive Lichtmaske wirkt
//     also wirklich, nicht nur der Spieler-Kreis wie vorher. (Bewusst der
//     naechste, nicht ein beliebiger Gegner: seit dem Leistungsbudget
//     unten werden nur die maxLightSources naechsten Quellen gezeichnet.)
//  2. Nachtsicht-Upgrade (cfg.ignoreFog) schaltet die Maske weiterhin
//     komplett ab (Regressionsschutz -- P11 aendert drawFog() vollstaendig).
//  3. Leistung im Worst Case: enemiesAlive (12) + Minen (8) +
//     enemyBullet.maxActive (24) gleichzeitige Lichtquellen-KANDIDATEN
//     (das Render-Budget aus data/modifiers.json: lightSources.
//     maxLightSources deckelt, wie viele davon tatsaechlich gezeichnet
//     werden).
//
//     Messmethode: NICHT der drittgroesste Wert (wie beim Bankshot-Solver
//     in tests/regression.mjs) -- dort reichen 2160 Messungen mit hoechstens
//     1-2 seltenen GC-Ausreissern. Hier hat schon eine reine Nebel-freie
//     Basismessung (modifier: null, praktisch Nullkosten) in ~5 % der
//     Frames einen ~50-ms-Aussetzer gezeigt, unabhaengig von jeder eigenen
//     Aenderung -- offenbar eine Eigenheit dieser (sandboxed) Umgebung
//     (vermutlich Chromium/V8-GC unter Ressourcendruck), nicht des Codes.
//     Gegengeprueft: identische Aussetzer bei vollstaendig geladenen
//     Sprites UND bei rohen Canvas-Aufrufen ganz ohne Spielcode -- also
//     kein Sprite-Ladeeffekt. Bei einer Ausreisserquote von ~5 % waere
//     "drittgroesster Wert" nur eine Zufallsziehung aus denselben
//     Aussetzern. p90 ueber viele Messungen ist hier das ehrliche Mass:
//     es toleriert bis zu 10 % Aussetzer, bevor es sie mitzaehlt.
//     Zweiter Fund beim Stabilisieren: die Aussetzer clustern gelegentlich
//     so, dass ein EINZELNER 500-Frame-Durchlauf ueber 10 % verliert (in
//     einer Gegenprobe 7,7 ms p90 statt der ueblichen ~4-5 ms). Deshalb
//     misst measureRun() jetzt DREIMAL unabhaengig und der Test wertet den
//     MEDIAN der drei p90-Werte -- ein einzelner Ausreisser-Durchlauf
//     verliert gegen die anderen zwei, eine echte Regression zeigt sich
//     dagegen in allen dreien.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8124;
const CHROMIUM = '/opt/pw-browsers/chromium';
const PW = '/opt/node22/lib/node_modules/playwright/index.mjs';

let chromium;
try {
  ({ chromium } = await import(PW));
} catch {
  console.log('Playwright nicht gefunden -- Nebel-Test uebersprungen.');
  process.exit(0);
}

const limits = JSON.parse(readFileSync(join(root, 'data/limits.json'), 'utf8'));
const balance = JSON.parse(readFileSync(join(root, 'data/balance.json'), 'utf8'));

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch({ executablePath: CHROMIUM });
const problems = [];
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
  page.on('pageerror', (e) => problems.push('Seitenfehler: ' + e.message));
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('#startBtn');
  await page.waitForTimeout(500);

  const result = await page.evaluate(
    async ({ enemyCap, mineCap, bulletCap }) => {
      const { createRun } = await import('/src/game/run.js');
      const { createRenderer } = await import('/src/render/renderer.js');
      const { createTracks } = await import('/src/render/tracks.js');
      const { createMine } = await import('/src/game/mine.js');
      const { createBullet } = await import('/src/game/bullet.js');

      const j = async (n) => (await fetch('/data/' + n + '.json')).json();
      const [tanks, tiles, diff, ups, bal, ev, inp, opt, ar, tr, sec, mod, lim, snd] = await Promise.all(
        ['tanks', 'tiles', 'difficulty', 'upgrades', 'balance', 'events', 'input', 'options', 'arenas',
          'transformations', 'secondaries', 'modifiers', 'limits', 'sounds'].map(j),
      );
      Object.assign(tanks, { balance: bal, events: ev, arenas: ar, transformations: tr, secondaries: sec,
        modifiers: mod, limits: lim, sounds: snd, input: inp });

      const run = createRun(tanks, tiles, diff, ups, 42);
      const st = run.state;
      // Worst Case erzwingen: Dunkelheit (kleinster Radius -> haerteste
      // Bewertung) + maximale Anzahl aller vier Lichtquellenarten.
      st.modifier = { id: 'darkness', visionRadiusPx: 150, fogColor: 'rgba(4,5,9,0.9)' };
      st.player.cfg.ignoreFog = false;

      // Zufallsposition auf OFFENEM Boden -- nicht nur "nicht solide"
      // (isSolid() ist fuer Loecher bewusst false, "fliegen drueber" gilt
      // nur fuer Geschosse). Ein Licht mitten in einem Loch waere visuell
      // ein dunkler Schacht, egal wie gut die Lichtmaske arbeitet -- die
      // Helligkeitspruefung braucht echten Boden als Vergleichsbasis.
      const CELL = 32;
      function randomFloorPos() {
        for (let tries = 0; tries < 200; tries++) {
          const x = 80 + Math.random() * 600;
          const y = 80 + Math.random() * 350;
          const col = Math.floor(x / CELL);
          const row = Math.floor(y / CELL);
          if (!st.walls.some((w) => w.col === col && w.row === row)) return { x, y };
        }
        return { x: 400, y: 250 }; // Notausweg, sollte praktisch nie greifen
      }

      const canvas = document.createElement('canvas');
      canvas.width = 768;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      const renderer = createRenderer(ctx);
      const tracks = createTracks();

      // Helligkeit ueber ein kleines Fenster mitteln statt einen einzelnen
      // Pixel zu lesen: das Boden-SPRITE (sobald geladen) hat eigene
      // Textur-Variation (Risse/Schattierung), ein Einzelpixel kann darauf
      // zufaellig auf eine dunkle Stelle treffen, ganz ohne Nebel. Ein
      // 12x12-Fenster gleicht das aus, ohne die eigentliche Nebelwirkung
      // (Radius >> 12 px) zu verwaschen.
      function avgBrightness(cx, cy, size = 12) {
        const half = Math.floor(size / 2);
        const data = ctx.getImageData(Math.round(cx) - half, Math.round(cy) - half, size, size).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
        return sum / (data.length / 4);
      }

      // Ausgiebiger Warmlauf: Sprite-Decode (erster Zeichenaufruf pro Bild)
      // und JIT-Aufwaermen duerfen die eigentliche Messung nicht verfaelschen.
      for (let i = 0; i < 300; i++) renderer.render(st, 0.5, tracks, null, null);

      // --- 1. Korrektheit: EIN gezielt platzierter Test-Gegner ("Sonde"),
      // NICHT der naechste einer zufaelligen Massenszene. Umsetzungsfund
      // beim Haerten dieses Tests: bei 44 zufaellig verteilten Quellen in
      // der Arena liegt der naechste Nachbar im Mittel nur ~35 px vom
      // Spieler entfernt (2D-Poisson-Abschaetzung) -- also so gut wie immer
      // SCHON innerhalb des Spieler-eigenen Lichtradius (150 px im
      // haertesten Fall). Ein "naechster Nachbar"-Test haette additive
      // Fremdlicht-Quellen also nie wirklich pruefen koennen, selbst wenn
      // NUR der Spieler-Kreis gezeichnet wuerde (Gegenprobe bestaetigt das
      // unten). Die Sonde steht deshalb VOR den Massenszene-Fuellern allein
      // in der Arena, garantiert ausserhalb des Spieler-Radius (> 150 px)
      // und garantiert Rang 0 (naechste Quelle ueberhaupt) -- damit sicher
      // innerhalb jedes sinnvollen Render-Budgets.
      const p = st.player;
      const d2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
      function findProbePos(dist) {
        for (let i = 0; i < 32; i++) {
          const ang = (i / 32) * Math.PI * 2;
          const x = p.x + Math.cos(ang) * dist;
          const y = p.y + Math.sin(ang) * dist;
          if (x < 20 || x > 748 || y < 20 || y > 492) continue;
          const col = Math.floor(x / CELL);
          const row = Math.floor(y / CELL);
          if (!st.walls.some((w) => w.col === col && w.row === row)) return { x, y };
        }
        return null;
      }
      const probe = findProbePos(220) || findProbePos(200) || findProbePos(180) || findProbePos(165);
      if (!probe) throw new Error('Kein Testpunkt fuer die Lichtsonde gefunden (Arena zu klein/verwinkelt?)');
      // WICHTIG: drawFog() interpoliert Gegnerpositionen ueber
      // lerp(t.prevX, t.x, alpha) (Render-Interpolation zwischen Ticks).
      // Ein reiner {...proto, x, y}-Klon erbt proto.prevX/prevY -- also die
      // ALTE Position des Prototyps, nicht die neue. Bei alpha=0 wuerde das
      // Licht dadurch an der falschen Stelle gepuncht (Gegenprobe zeigte
      // genau das: die Sonde blieb dunkel). prevX/prevY muessen deshalb
      // explizit mitgesetzt werden.
      const proto = st.tanks.find((t) => t !== st.player);
      st.tanks.push({ ...proto, x: probe.x, y: probe.y, prevX: probe.x, prevY: probe.y, alive: true });

      // Dunkle Vergleichsstelle: ebenfalls offener Boden (sonst faellt der
      // Helligkeitsvergleich auf eine Wandkachel statt auf Nebel-vs-Boden
      // hinaus), weit genug vom Spieler UND von der Sonde weg, dass sie
      // garantiert ausserhalb jeder Lichtquelle liegt.
      let darkPos = null;
      for (let tries = 0; tries < 500; tries++) {
        const pos = randomFloorPos();
        if (d2(pos.x, pos.y, p.x, p.y) > 300 * 300 && d2(pos.x, pos.y, probe.x, probe.y) > 150 * 150) {
          darkPos = pos;
          break;
        }
      }
      if (!darkPos) darkPos = { x: p.x, y: p.y }; // Notausweg, sollte nie greifen

      renderer.render(st, 0, tracks, null, null);
      // Nebel ist dunkel/blaeulich -- an der Sonde muss der Boden (deutlich
      // heller) durchscheinen, obwohl sie ausserhalb des Spieler-Lichtkreises
      // liegt -- das ist genau die additive Wirkung, die P11 einfuehrt.
      const litBrightness = avgBrightness(probe.x, probe.y);
      const darkBrightness = avgBrightness(darkPos.x, darkPos.y);

      // --- 2. Nachtsicht schaltet die Maske komplett ab. ---
      st.player.cfg.ignoreFog = true;
      renderer.render(st, 0, tracks, null, null);
      const ignoreFogBrightness = avgBrightness(darkPos.x, darkPos.y);
      st.player.cfg.ignoreFog = false;

      // --- Erst JETZT die Massenszene fuer den Leistungstest auffuellen
      // (die Sonde zaehlt als einer der enemyCap Gegner). ---
      while (st.tanks.filter((t) => t !== st.player && t.alive).length < enemyCap) {
        const pos = randomFloorPos();
        st.tanks.push({ ...proto, x: pos.x, y: pos.y, prevX: pos.x, prevY: pos.y, alive: true });
      }
      for (let i = 0; i < mineCap; i++) {
        const pos = randomFloorPos();
        st.mines.push(createMine(pos.x, pos.y, st.player, 51, false));
      }
      for (let i = 0; i < bulletCap; i++) {
        const pos = randomFloorPos();
        const b = createBullet(pos.x, pos.y, Math.random() * 6.28, {
          speed: 200, radius: 3, ricochets: 1, owner: st.player, kind: 'bullet',
        });
        st.bullets.push(b);
      }

      // --- 3. Leistung: viele Frames, p90 zaehlt (Begruendung siehe oben). ---
      // Umsetzungsfund: ein EINZELNER 500-Messungen-Durchlauf reicht nicht --
      // die Aussetzer dieser Umgebung clustern gelegentlich so, dass mehr als
      // 10 % eines Durchlaufs betroffen sind (in einer Gegenprobe: 7,7 ms
      // p90 statt der ueblichen ~4 ms). Ein einzelner unglueklicher Durchlauf
      // wuerde dann eine Umgebungs-Laune als Regression melden. Drei
      // unabhaengige Durchlaufe + der MEDIAN ihrer p90-Werte filtert genau
      // das: eine echte Regression zeigt sich in allen drei Durchlaufen,
      // ein einzelner Ausreisser-Durchlauf verliert gegen die anderen zwei.
      function measureRun() {
        const samples = [];
        for (let i = 0; i < 500; i++) {
          // Positionen leicht variieren, sonst optimiert nichts im Test,
          // aber realistischer als exakt statische Quellen.
          for (const t of st.tanks) {
            if (t !== st.player) { t.x += Math.sin(i + t.x) * 0.5; t.prevX = t.x; t.prevY = t.y; }
          }
          for (const b of st.bullets) { b.x += 1; b.prevX = b.x - 1; }
          const t0 = performance.now();
          renderer.render(st, 0.5, tracks, null, null);
          samples.push(performance.now() - t0);
        }
        samples.sort((a, b) => a - b);
        const q = (f) => samples[Math.min(samples.length - 1, Math.floor(samples.length * f))];
        return { medianMs: q(0.5), p90Ms: q(0.9), worstMs: samples[samples.length - 1] };
      }
      const runs = [measureRun(), measureRun(), measureRun()];
      const p90s = runs.map((r) => r.p90Ms).sort((a, b) => a - b);

      return {
        litBrightness,
        darkBrightness,
        ignoreFogBrightness,
        medianMs: runs[0].medianMs,
        p90Ms: p90s[1], // Median der drei p90-Werte
        p90All: p90s,
        worstMs: Math.max(...runs.map((r) => r.worstMs)),
        enemyCount: st.tanks.filter((t) => t !== st.player && t.alive).length,
      };
    },
    {
      enemyCap: limits.enemiesAlive,
      mineCap: limits.mines,
      bulletCap: balance.enemyBullet.maxActive,
    },
  );

  console.log(
    `Quellen (Kandidaten): ${result.enemyCount} Gegner + ${limits.mines} Minen + ${balance.enemyBullet.maxActive} Geschosse`,
  );
  console.log(`Helligkeit: naechster Gegner ${result.litBrightness}, dunkle Ecke ${result.darkBrightness}`);
  console.log(
    `Renderzeit: ${result.medianMs.toFixed(2)} ms Median, ${result.p90Ms.toFixed(2)} ms p90-Median ` +
      `(3 Durchlaeufe: ${result.p90All.map((v) => v.toFixed(2)).join(' / ')} ms, Maximum ${result.worstMs.toFixed(2)} ms)`,
  );

  if (!(result.litBrightness > result.darkBrightness + 30)) {
    problems.push(
      `Additive Lichtmaske wirkt nicht: am naechsten Gegner (${result.litBrightness}) kaum heller als im ` +
        `Dunkeln (${result.darkBrightness})`,
    );
  }
  if (!(result.ignoreFogBrightness > result.darkBrightness + 30)) {
    problems.push('Nachtsicht (cfg.ignoreFog) hebt den Nebel nicht mehr vollstaendig auf');
  }
  if (result.p90Ms >= 6) {
    problems.push(`Renderzeit im Worst Case zu hoch: ${result.p90Ms.toFixed(2)} ms p90 (Budget 6 ms, Phase 11b)`);
  }
} finally {
  await browser.close();
  server.kill();
}

if (problems.length) {
  console.error('\nP11-NEBEL FEHLGESCHLAGEN:\n' + problems.map((p) => ' - ' + p).join('\n'));
  process.exit(1);
}
console.log('\nAdditive Lichtmaske korrekt und im Frame-Budget.');
