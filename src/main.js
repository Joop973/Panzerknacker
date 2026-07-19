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
import { createTouchControls } from './ui/touchcontrols.js';
import { createPause } from './ui/pause.js';
import { createTutorial } from './ui/hud.js';
import { getFlag, setFlag, loadStats } from './core/storage.js';
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

  // Bestwerte auf dem Start-Screen.
  function refreshBestStats() {
    const s = loadStats();
    const el = document.getElementById('beststats');
    if (!s.runs) {
      el.textContent = '';
      return;
    }
    const win = s.fastestWinS
      ? ` · schnellster Sieg ${Math.floor(s.fastestWinS / 60)}:${String(Math.floor(s.fastestWinS % 60)).padStart(2, '0')}`
      : '';
    el.textContent = `${s.runs} Runs · beste Räume ${s.mostRooms} · ${s.totalKills} Kills${win}`;
  }
  refreshBestStats();

  const input = createInput(window, canvas);
  const audio = createAudio();
  window.addEventListener('pointerdown', audio.unlock);
  window.addEventListener('keydown', audio.unlock);

  const tracks = createTracks();
  const renderer = createRenderer(ctx);
  const debugOverlay = createDebugOverlay(ctx);
  const hud = createHud(ctx);
  const upgradeScreen = createUpgradeScreen();
  const touch = createTouchControls(canvas);
  const pause = createPause();
  const tutorial = createTutorial(getFlag('tutorial_seen'));

  let run = null;
  let lastRoomState = null;
  let upgradeShown = false;
  let toast = null;

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
    if (input.consumePause()) pause.toggle();
    if (pause.isPaused()) return;

    // Tastatur/Maus und Touch zusammenfuehren (Touch hat Vorrang, wenn
    // aktiv ausgelenkt).
    const kbMove = input.getMoveAxis();
    const tMove = touch.getMove();
    const move = kbMove.x || kbMove.y ? kbMove : tMove;
    const aimDir = touch.getAimDir();
    const p = run.state.player;
    const aim = aimDir ? { x: p.x + aimDir.x * 4, y: p.y + aimDir.y * 4 } : input.getAim();
    const cmd = {
      move,
      aim,
      fire: input.consumeFire() || touch.isAutoFire(),
      mine: input.consumeMine() || touch.consumeMine(),
    };
    stepRun(run, cmd, dt);
    toast = tutorial.update(run, cmd, touch.isActive(), dt);
    if (tutorial.isDone() && !getFlag('tutorial_seen')) setFlag('tutorial_seen');
    // Raumwechsel erkennen -> Reifenspuren-Buffer leeren.
    if (run.state !== lastRoomState) {
      tracks.clear();
      lastRoomState = run.state;
    }
    if (run.phase === 'playing') {
      tracks.stamp(run.state.tanks);
      tracks.fade(dt);
    }
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
    hud.render(run, { paused: pause.isPaused(), toast });
    touch.render(ctx);

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
      refreshBestStats();
      startOverlay.classList.remove('hidden');
      seedInput.select();
      run = null;
    }
  });

  // Pause-Button oben mittig.
  document.getElementById('pauseBtn').addEventListener('click', () => pause.toggle());

  // Auto-Pause bei Tab-Wechsel (Spec Abschnitt 9) -- Pflicht, sonst
  // stirbt man bei einem eingehenden Anruf. Beim Zurueckkommen bleibt
  // das Spiel pausiert.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause.set(true);
      loop.stop();
    } else {
      loop.start();
    }
  });

  // Portrait: Overlay kommt per CSS; zusaetzlich pausieren (Touch-Geraete).
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  const onPortrait = () => {
    if (portrait.matches) pause.set(true);
  };
  portrait.addEventListener?.('change', onPortrait);
  onPortrait();

  loop.start();
}

init();
