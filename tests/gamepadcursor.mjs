// End-to-End-Test des Gamepad-Cursors (Playwright, selbstueberspringend).
//
// Nutzermeldung: mit dem Controller liessen sich einzelne Upgrades nicht
// anwaehlen -- gewuenscht ist ein FREIER Maus-Cursor, den der linke Stick
// ueber die Overlays faehrt und A klickt. Dieser Test beweist im echten
// Browser (mit injiziertem Standard-Gamepad), dass:
//   1. der Cursor erscheint und sich mit dem linken Stick bewegt,
//   2. A das Element UNTER dem Cursor wirklich klickt (echtes click-Ereignis).
//
// Getestet wird auf dem Startbildschirm (Menue-Kontext ohne laufenden Run):
// dort greift dieselbe gamepadCursor()-Logik wie in den In-Run-Overlays
// (Upgrade-Screen), ohne dass der Test erst einen Kampfraum gewinnen muss.
//
// Bringt einen eigenen statischen Server mit (kein externer :8099 noetig).

import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

let chromium;
try {
  ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'));
} catch {
  console.log('Playwright nicht installiert -- Gamepad-Cursor-Test uebersprungen.');
  process.exit(0);
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    console.error('FEHLER: ' + msg);
    failures++;
  }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));

  // Standard-Gamepad injizieren, BEVOR die Seite laedt: navigator.getGamepads
  // liest window.__pad, das der Test pro Frame steuert.
  await page.addInitScript(() => {
    window.__pad = { axes: [0, 0, 0, 0], buttons: new Array(17).fill(0) };
    navigator.getGamepads = () => [
      {
        index: 0,
        id: 'Test (STANDARD GAMEPAD)',
        connected: true,
        mapping: 'standard',
        timestamp: performance.now(),
        axes: window.__pad.axes.slice(),
        buttons: window.__pad.buttons.map((v) => ({ pressed: v > 0.5, touched: v > 0, value: v })),
      },
      null,
      null,
      null,
    ];
  });

  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('#startBtn');
  await page.waitForTimeout(400);

  // Klick-Sonde am Startknopf (unabhaengig vom echten Start-Handler).
  await page.evaluate(() => {
    window.__startClicked = false;
    document.getElementById('startBtn').addEventListener('click', () => (window.__startClicked = true));
  });

  // (1) Linker Stick nach rechts -> Cursor erscheint und wandert nach rechts.
  const before = await page.evaluate(() => {
    const c = document.getElementById('gpCursor');
    return { left: parseFloat(c.style.left) || window.innerWidth / 2 };
  });
  await page.evaluate(() => {
    window.__pad.axes = [1, 0, 0, 0];
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const c = document.getElementById('gpCursor');
    return { hidden: c.classList.contains('hidden'), left: parseFloat(c.style.left) || 0 };
  });
  check(!after.hidden, 'Cursor: bleibt unsichtbar, obwohl der linke Stick ausgelenkt ist');
  check(after.left > before.left + 80, `Cursor: bewegt sich nicht mit dem Stick (${before.left} -> ${after.left})`);

  // (2) Cursor auf den Startknopf steuern (Regelkreis: Stick jeden Frame in
  // Richtung Knopfmitte), dann A -> Klick auf den Knopf.
  const rect = await page.evaluate(() => {
    const b = document.getElementById('startBtn').getBoundingClientRect();
    return { cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
  });
  let reached = false;
  for (let i = 0; i < 90; i++) {
    const st = await page.evaluate(({ cx, cy }) => {
      const c = document.getElementById('gpCursor');
      const x = parseFloat(c.style.left) || 0;
      const y = parseFloat(c.style.top) || 0;
      const dx = cx - x;
      const dy = cy - y;
      const len = Math.hypot(dx, dy) || 1;
      window.__pad.axes = [dx / len, dy / len, 0, 0];
      const el = document.elementFromPoint(x, y);
      const overBtn = !!(el && (el.id === 'startBtn' || (el.closest && el.closest('#startBtn'))));
      return { dist: Math.hypot(dx, dy), overBtn };
    }, rect);
    if (st.overBtn || st.dist < 6) {
      reached = true;
      break;
    }
    await page.waitForTimeout(25);
  }
  check(reached, 'Cursor: erreicht den Startknopf nicht (Stick-Steuerung)');

  // Stick loslassen, A druecken (frische Flanke) -> Klick.
  await page.evaluate(() => {
    window.__pad.axes = [0, 0, 0, 0];
    window.__pad.buttons[0] = 1;
  });
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    window.__pad.buttons[0] = 0;
  });
  await page.waitForTimeout(60);
  const clicked = await page.evaluate(() => window.__startClicked);
  check(clicked, 'Cursor: A klickt das Element unter dem Cursor nicht (Startknopf)');

  check(errs.length === 0, `Seitenfehler: ${errs.join(' | ')}`);
} finally {
  await browser.close();
  server.close();
}

if (failures) {
  console.error(`\n${failures} Gamepad-Cursor-Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('Alle Gamepad-Cursor-Tests bestanden.');
