// P2-Test: Aufloesung und Zielkoordinaten ueber mehrere devicePixelRatio.
//
// Braucht eine echte Layout-Engine (Playwright) und ist deshalb -- wie
// tests/uilayout.mjs -- von der abhaengigkeitsfreien Node-Suite getrennt.
// Ohne Playwright ueberspringt sich der Test selbst.
//
// Geprueft wird das, was headless nicht sichtbar ist:
//   1. Der Backing-Store waechst mit dem DPR, gedeckelt auf maxPixelRatio.
//   2. Die CSS-Groesse (Layout) bleibt davon unberuehrt.
//   3. Ein Mausklick landet trotz DPR-Skalierung an derselben ARENA-Stelle.
//      Das ist die eigentliche Falle: toCanvas() rechnete frueher gegen
//      canvas.width, das seit P2 ein Vielfaches der Arenabreite ist.
//   4. Kein horizontales Scrollen trotz position:fixed auf html/body.

import { readFileSync } from 'fs';

let chromium;
try {
  ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'));
} catch {
  console.log('Playwright nicht installiert -- P2-Viewport-Test uebersprungen.');
  process.exit(0);
}

const options = JSON.parse(readFileSync(new URL('../data/options.json', import.meta.url), 'utf8'));
const MAX_DPR = options.maxPixelRatio ?? 2;
const WIDTH = 768;
const HEIGHT = 512;

const problems = [];
const cssSizes = []; // Layoutgroesse je DPR -- muss ueber alle gleich sein
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const dpr of [1, 2, 3]) {
  const ctxBrowser = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: dpr,
  });
  ctxBrowser.__dpr = dpr;
  const page = await ctxBrowser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
  await page.waitForSelector('#startBtn');
  await page.waitForTimeout(1200);

  const expected = Math.min(dpr, MAX_DPR);

  // 1 + 2: Backing-Store skaliert, CSS-Groesse bleibt Layoutgroesse.
  const geo = await page.evaluate(() => {
    const c = document.querySelector('#canvas');
    const r = c.getBoundingClientRect();
    return { w: c.width, h: c.height, cssW: r.width, cssH: r.height };
  });
  if (geo.w !== Math.round(WIDTH * expected)) {
    problems.push(`DPR ${dpr}: Backing-Store ${geo.w} px breit, erwartet ${Math.round(WIDTH * expected)}`);
  }
  if (geo.h !== Math.round(HEIGHT * expected)) {
    problems.push(`DPR ${dpr}: Backing-Store ${geo.h} px hoch, erwartet ${Math.round(HEIGHT * expected)}`);
  }
  if (Math.abs(geo.cssW / geo.cssH - WIDTH / HEIGHT) > 0.02) {
    problems.push(`DPR ${dpr}: Seitenverhaeltnis verzerrt (${(geo.cssW / geo.cssH).toFixed(3)})`);
  }
  // Die CSS-Groesse ist LAYOUT und darf sich mit dem DPR NICHT aendern.
  // Ohne explizite CSS-Masse leitet der Browser die intrinsische Groesse
  // eines Canvas aus den width/height-ATTRIBUTEN ab -- ein groesserer
  // Backing-Store haette den Canvas also auch im Layout wachsen lassen
  // (gemessen: 768x512 bei DPR 1, aber 972x648 bei DPR 2).
  cssSizes.push({ dpr, w: geo.cssW, h: geo.cssH });

  // 3: Die eigentliche Falle. Die Eingabeschicht wird im echten Browser mit
  // echtem DPR gegen den echten Canvas instanziiert und bekommt ein
  // Mausereignis an einer bekannten Bildschirmposition. Ihr Zielpunkt muss
  // in ARENA-Koordinaten herauskommen. Bewusst ueber das Modul selbst statt
  // ueber eine Test-Sonde im Spielcode -- so braucht die Produktion keine
  // Zeile Testcode, und geprueft wird exakt die Funktion, die den Fehler
  // haette (toCanvas rechnete gegen canvas.width).
  const aim = await page.evaluate(async ([fx, fy]) => {
    const { createInput } = await import('/src/core/input.js');
    const cfg = await fetch('/data/input.json').then((r) => r.json());
    const canvas = document.querySelector('#canvas');
    const probe = createInput(window, canvas, { inputCfg: cfg });
    const r = canvas.getBoundingClientRect();
    const clientX = r.left + r.width * fx;
    const clientY = r.top + r.height * fy;
    window.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }));
    const st = probe.getState({ x: 0, y: 0 });
    probe.destroy();
    return { x: st.aim.x, y: st.aim.y, clientX, clientY };
  }, [0.75, 0.25]);

  const targetArena = { x: WIDTH * 0.75, y: HEIGHT * 0.25 };
  const dx = Math.abs(aim.x - targetArena.x);
  const dy = Math.abs(aim.y - targetArena.y);
  // 2 px Toleranz: Bildschirmkoordinaten liegen auf ganzen Geraetepixeln.
  if (dx > 2 || dy > 2) {
    problems.push(
      `DPR ${dpr}: Zielpunkt verrutscht -- gemessen (${aim.x.toFixed(1)}, ${aim.y.toFixed(1)}), ` +
        `erwartet (${targetArena.x}, ${targetArena.y})`,
    );
  }
  // Gegen einen stillen Fehlschlag: der Zielpunkt muss ueberhaupt in der
  // Arena liegen (ein DPR-Fehler schiebt ihn um ein Vielfaches hinaus).
  if (aim.x < 0 || aim.x > WIDTH || aim.y < 0 || aim.y > HEIGHT) {
    problems.push(`DPR ${dpr}: Zielpunkt liegt ausserhalb der Arena (${aim.x.toFixed(0)}, ${aim.y.toFixed(0)})`);
  }

  // 4: keine horizontale Scrollstrecke.
  const scroll = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  if (scroll.x > 1) problems.push(`DPR ${dpr}: Seite scrollt horizontal (${scroll.x} px)`);
  if (scroll.y > 1) problems.push(`DPR ${dpr}: Seite scrollt vertikal (${scroll.y} px)`);

  for (const e of errs) problems.push(`DPR ${dpr}: Seitenfehler -- ${e}`);
  console.log(
    `${problems.length ? '  ' : 'OK'}  DPR ${dpr} -> Backing-Store ${geo.w}x${geo.h}` +
      ` (gedeckelt auf ${MAX_DPR}), CSS ${Math.round(geo.cssW)}x${Math.round(geo.cssH)}`,
  );
  await ctxBrowser.close();
}

// Handy-Querformat: hier greift max-height tatsaechlich und klemmt den
// Canvas kleiner als die Logikgroesse. Genau dort faellt eine verzerrte
// Darstellung an -- im Desktop-Fenster oben greift die Grenze gar nicht,
// deshalb reicht die Seitenverhaeltnis-Pruefung dort allein nicht aus.
// (Gemessener Fehlerfall: feste CSS-Breite UND -Hoehe ergaben 768x390
// statt 585x390, also ein um ein Drittel zu breites Bild.)
for (const [name, w, h, dpr] of [
  ['iPhone quer', 844, 390, 3],
  ['kleines Handy quer', 667, 375, 2],
  ['Tablet quer', 1180, 820, 2],
]) {
  const c = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: dpr,
    hasTouch: true,
    isMobile: true,
  });
  const page = await c.newPage();
  await page.goto('http://localhost:8099/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const g = await page.evaluate(() => {
    const r = document.querySelector('#canvas').getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  const ratio = g.w / g.h;
  const ok = Math.abs(ratio - WIDTH / HEIGHT) <= 0.02;
  if (!ok) {
    problems.push(
      `${name} (${w}x${h}, DPR ${dpr}): Canvas verzerrt -- ${Math.round(g.w)}x${Math.round(g.h)} ` +
        `= ${ratio.toFixed(2)}:1 statt 1.50:1`,
    );
  }
  if (g.w > WIDTH + 1 || g.h > HEIGHT + 1) {
    problems.push(`${name}: Canvas groesser als die Logikgroesse (${Math.round(g.w)}x${Math.round(g.h)})`);
  }
  console.log(
    `${ok ? 'OK' : '  '}  ${name.padEnd(19)} ${w}x${h} DPR ${dpr} -> Canvas ` +
      `${Math.round(g.w)}x${Math.round(g.h)} (${ratio.toFixed(2)}:1)`,
  );
  await c.close();
}

await browser.close();

// Layoutgroesse ueber alle DPR vergleichen (gleiche Fenstergroesse!).
const base = cssSizes[0];
for (const s of cssSizes.slice(1)) {
  if (Math.abs(s.w - base.w) > 1 || Math.abs(s.h - base.h) > 1) {
    problems.push(
      `Layoutgroesse haengt am DPR: ${Math.round(base.w)}x${Math.round(base.h)} bei DPR ${base.dpr}, ` +
        `aber ${Math.round(s.w)}x${Math.round(s.h)} bei DPR ${s.dpr}`,
    );
  }
}

if (problems.length) {
  console.error('\nP2-VIEWPORT FEHLGESCHLAGEN:\n' + problems.map((p) => ' - ' + p).join('\n'));
  process.exit(1);
}
console.log('\nAufloesung skaliert, Zielkoordinaten bleiben in Arena-Massen.');
