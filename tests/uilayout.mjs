// Layout-Test der Overlay-Screens (Playwright, optional).
//
//   node tests/uilayout.mjs
//
// Warum getrennt von tests/regression.mjs: Diese Pruefung braucht eine echte
// Layout-Engine (Elementhoehen, Scrollbereiche) -- der DOM-Stub aus
// tests/domstub.mjs kann das nicht. Die Suite bleibt dadurch
// abhaengigkeitsfrei; dieser Test laeuft nur, wenn Playwright vorhanden ist
// (im Projekt-Container unter /opt/pw-browsers/chromium, siehe CLAUDE.md).
//
// Faengt die Fehlerklasse "Bedienelement liegt ausserhalb des Bildschirms":
// Bei voller Ausruestung rutschte der "Weiter"-Knopf der Raumvorschau unter
// den Bildschirmrand, und die Schrott-Aktionen des Upgrade-Screens waren
// ohne Scrollen nicht erreichbar -- auf dem Handy im Querformat ein Blocker,
// der den Run unspielbar machte (Nutzer-Meldung).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const CHROMIUM = '/opt/pw-browsers/chromium';
const PW = '/opt/node22/lib/node_modules/playwright/index.mjs';

let chromium;
try {
  ({ chromium } = await import(PW));
} catch {
  console.log('Playwright nicht gefunden -- Layout-Test uebersprungen.');
  process.exit(0);
}

// Statischen Server starten (das Spiel laeuft nicht ueber file://).
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const upgrades = JSON.parse(readFileSync(join(root, 'data/upgrades.json'), 'utf8')).upgrades;
const tanks = JSON.parse(readFileSync(join(root, 'data/tanks.json'), 'utf8'));
// Extremfall: viele Karten auf Stufe 2, volle Gegnerliste, Modifikator + Gefahr.
const ownedUpgrades = Object.values(upgrades)
  .slice(0, 25)
  .map((c) => ({ name: c.name, level: 2, description: c.description, symbol: c.symbol || '•' }));

const VIEWPORTS = [
  [844, 390, 'iPhone quer'],
  [667, 375, 'kleines iPhone quer'],
  [740, 360, 'sehr flach'],
  [1280, 720, 'Desktop'],
];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error('FEHLER:', msg);
};

const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const [width, height, label] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });

    // --- Raumvorschau: der "Weiter"-Knopf MUSS sichtbar sein ---
    const pv = await page.evaluate(
      async ({ ups, tanksData }) => {
        const { createPreview } = await import('./src/ui/preview.js');
        createPreview().show(
          {
            title: 'Raum 12/16',
            character: 'offen',
            upgrades: ups,
            dangerByType: {},
            modifierLine: 'Modifikator: Störsender — Kugeln 30 % langsamer',
            hazardLine: 'Gefahr: Laserbarriere — blockt Kugeln, keine Panzer',
          },
          ['t_brown', 't_brown', 't_grey', 't_teal', 't_pink', 't_armored', 't_prism', 't_black'],
          tanksData,
          () => {},
        );
        const b = document.getElementById('previewGo').getBoundingClientRect();
        // P8: die Ausruestung liegt jetzt auf einer eigenen Vollbild-Seite.
        // Auch DEREN "Zurueck" muss erreichbar bleiben -- die Liste wird mit
        // vielen Karten lang, genau die Falle, die den "Weiter"-Knopf der
        // Vorschau seinerzeit aus dem Bild geschoben hat.
        let up = { sichtbar: true, unten: 0 };
        const open = document.getElementById('previewUpOpen');
        if (open) {
          open.click();
          const rb = document.getElementById('previewUpBack').getBoundingClientRect();
          up = { sichtbar: rb.top >= 0 && rb.bottom <= window.innerHeight, unten: Math.round(rb.bottom) };
        }
        return {
          sichtbar: b.top >= 0 && b.bottom <= window.innerHeight,
          unten: Math.round(b.bottom),
          hatSeite: !!open,
          up,
        };
      },
      { ups: ownedUpgrades, tanksData: tanks },
    );
    if (!pv.sichtbar) {
      fail(`${label} (${width}x${height}): "Weiter" der Raumvorschau liegt ausserhalb (Unterkante ${pv.unten}, Fenster ${height})`);
    }
    if (!pv.hatSeite) {
      fail(`${label} (${width}x${height}): kein Zugang zur Ausruestungsseite (P8)`);
    }
    if (!pv.up.sichtbar) {
      fail(`${label} (${width}x${height}): "Zurueck" der Ausruestungsseite liegt ausserhalb (Unterkante ${pv.up.unten}, Fenster ${height})`);
    }

    // --- Upgrade-Screen: alle Knoepfe im Bild ---
    const us = await page.evaluate(async () => {
      const { createUpgradeScreen } = await import('./src/ui/upgradescreen.js');
      const offers = [1, 2, 3, 4].map((i) => ({
        id: 'k' + i, name: 'Testkarte ' + i,
        description: 'Eine ausfuehrliche Beschreibung, die ueber mehrere Zeilen laufen kann und Platz braucht.',
        tag: 'stat', rarity: 'rare', level: 1, maxStacks: 3, fallback: false,
      }));
      createUpgradeScreen().show({
        costs: { reroll: 2, ban: 1, fourthCard: 3, shieldCharge: 4 },
        showActions: true, title: 'Upgrade wählen',
        getOffers: () => offers, getScrap: () => 99, canFourth: () => true,
        transformDefs: { a: { id: 'a', name: 'Bollwerk', tag: 'defense', symbol: '🛡️' } },
        tagCounts: { defense: 2 }, unlocked: new Set(), threshold: 3, hasDash: false,
        onPick: () => {}, onReroll: () => true, onBan: () => true, onFourth: () => true, onShield: () => true,
      });
      const ov = document.getElementById('upgrade');
      const out = [...ov.querySelectorAll('button')].filter((c) => {
        const r = c.getBoundingClientRect();
        return r.height > 0 && (r.top < 0 || r.bottom > window.innerHeight);
      });
      return out.map((c) => c.textContent.trim().slice(0, 20));
    });
    if (us.length) {
      fail(`${label} (${width}x${height}): Upgrade-Screen -- ${us.length} Bedienelement(e) ausserhalb: ${us.join(', ')}`);
    }

    if (pv.sichtbar && pv.up.sichtbar && !us.length) console.log(`OK  ${label.padEnd(20)} ${width}x${height}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures) {
  console.error(`\n${failures} Layout-Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('\nAlle Overlay-Bedienelemente bleiben im Bild.');
