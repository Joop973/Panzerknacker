// Einstiegspunkt (Spec Abschnitt 3: main.js).
//
// Laedt die Daten aus /data/*.json, zeigt den Start-Screen mit
// Seed-Eingabe und verdrahtet Loop, Eingabe, Run-Controller, Renderer,
// Reifenspuren, HUD und Debug-Overlay.

import { STEP } from './config.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createAudio } from './core/audio.js';
import { createRun, stepRun, chooseUpgrade } from './game/run.js';
import { createUpgradeScreen } from './ui/upgradescreen.js';
import { createRenderer } from './render/renderer.js';
import { createTracks } from './render/tracks.js';
import { createDebugOverlay } from './render/debug.js';
import { createHud } from './ui/hud.js';

async function init() {
  const [tanksData, tilesData, diffData, upgradesData] = await Promise.all([
    fetch('data/tanks.json').then((r) => r.json()),
    fetch('data/tiles.json').then((r) => r.json()),
    fetch('data/difficulty.json').then((r) => r.json()),
    fetch('data/upgrades.json').then((r) => r.json()),
  ]);

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const startOverlay = document.getElementById('start');
  const seedInput = document.getElementById('seedInput');
  const startBtn = document.getElementById('startBtn');

  const input = createInput(window, canvas);
  const audio = createAudio();
  window.addEventListener('pointerdown', audio.unlock);
  window.addEventListener('keydown', audio.unlock);

  const tracks = createTracks();
  const renderer = createRenderer(ctx);
  const debugOverlay = createDebugOverlay(ctx);
  const hud = createHud(ctx);
  const upgradeScreen = createUpgradeScreen();

  let run = null;
  let lastRoomState = null;
  let upgradeShown = false;

  let fps = 0;
  let frameCount = 0;
  let fpsWindowStart = performance.now();

  function startRun() {
    const raw = seedInput.value.trim();
    const seed = raw === '' ? Date.now() >>> 0 : Number(raw) >>> 0;
    seedInput.value = String(seed);
    run = createRun(tanksData, tilesData, diffData, upgradesData, seed);
    startOverlay.classList.add('hidden');
    upgradeScreen.hide();
    upgradeShown = false;
  }

  function update(dt) {
    if (!run) return;
    stepRun(
      run,
      {
        move: input.getMoveAxis(),
        aim: input.getAim(),
        fire: input.consumeFire(),
        mine: input.consumeMine(),
      },
      dt,
    );
    // Raumwechsel erkennen -> Reifenspuren-Buffer leeren.
    if (run.state !== lastRoomState) {
      tracks.clear();
      lastRoomState = run.state;
    }
    if (run.phase === 'playing') tracks.stamp(run.state.tanks);
    for (const name of run.state.sounds.splice(0)) audio.play(name);

    // Upgrade-Screen genau einmal pro Angebot einblenden.
    if (run.phase === 'upgrade' && !upgradeShown) {
      upgradeShown = true;
      upgradeScreen.show(run.pendingOffers, (idx) => {
        chooseUpgrade(run, idx);
        upgradeShown = false;
      });
    }
  }

  function render(alpha) {
    if (!run) return;
    renderer.render(run.state, alpha, tracks);
    if (input.isDebug() && run.phase === 'playing') {
      debugOverlay.render(run.state, fps);
    }
    hud.render(run);

    frameCount++;
    const now = performance.now();
    if (now - fpsWindowStart >= 500) {
      fps = (frameCount * 1000) / (now - fpsWindowStart);
      frameCount = 0;
      fpsWindowStart = now;
    }
  }

  const loop = createLoop({ update, render, step: STEP });

  startBtn.addEventListener('click', startRun);
  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startRun();
  });
  // Enter auf Endscreens: zurueck zum Start-Screen (Seed vorbefuellt).
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !run) return;
    if (run.phase === 'gameover' || run.phase === 'victory') {
      startOverlay.classList.remove('hidden');
      seedInput.select();
      run = null;
    }
  });

  // Auto-Pause bei Tab-Wechsel (Spec Abschnitt 9).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loop.stop();
    else loop.start();
  });

  loop.start();
}

init();
