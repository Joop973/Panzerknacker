// Einstiegspunkt (Spec Abschnitt 3: main.js).
//
// Laedt die Daten aus /data/*.json, zeigt den Start-Screen mit
// Seed-Eingabe und verdrahtet Loop, Eingabe, Run-Controller, Renderer,
// Reifenspuren, HUD und Debug-Overlay.

import { STEP } from './config.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createAudio } from './core/audio.js';
import { createRun, stepRun, chooseUpgrade, enterRoom, totalRooms, continueEndless } from './game/run.js';
import { createUpgradeScreen } from './ui/upgradescreen.js';
import { createPreview } from './ui/preview.js';
import { createTouchControls } from './ui/touchcontrols.js';
import { createPause } from './ui/pause.js';
import { createTutorial } from './ui/hud.js';
import { getFlag, setFlag, loadStats, getPref, setPref, resetStats } from './core/storage.js';
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
  audio.setMuted(getPref('muted', false));
  const unlockAll = () => {
    audio.unlock();
    audio.startMusic();
  };
  window.addEventListener('pointerdown', unlockAll);
  window.addEventListener('keydown', unlockAll);

  const tracks = createTracks();
  const renderer = createRenderer(ctx);
  const debugOverlay = createDebugOverlay(ctx);
  const hud = createHud(ctx);
  const upgradeScreen = createUpgradeScreen();
  const preview = createPreview();
  const touch = createTouchControls();
  const pause = createPause();
  const tutorial = createTutorial(getFlag('tutorial_seen'));

  let run = null;
  let lastRoomState = null;
  let upgradeShown = false;
  let previewShown = false;
  let toast = null;
  let lastSeed = 0;
  let mode = getPref('mode', 'normal');

  // Schwierigkeits-Auswahl (Segment-Buttons).
  const modeSelect = document.getElementById('modeSelect');
  modeSelect.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      setPref('mode', mode);
      modeSelect.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  let fps = 0;
  let frameCount = 0;
  let fpsWindowStart = performance.now();

  function startRun() {
    const raw = seedInput.value.trim();
    const seed = raw === '' ? Date.now() >>> 0 : Number(raw) >>> 0;
    seedInput.value = String(seed);
    run = createRun(tanksData, tilesData, diffData, upgradesData, seed, mode);
    lastSeed = seed;
    startOverlay.classList.add('hidden');
    upgradeScreen.hide();
    preview.hide();
    upgradeShown = false;
    previewShown = false;
    // Touch-Geraete: Vollbild + Landscape-Lock versuchen (Android;
    // iOS ignoriert es -- dort greift das Portrait-Overlay).
    if (navigator.maxTouchPoints > 0) {
      document.documentElement.requestFullscreen?.().then(
        () => screen.orientation?.lock?.('landscape').catch(() => {}),
        () => {},
      );
    }
    requestWakeLock();
  }

  // Display-Wachsperre: beim Gamepad-Spielen fasst man den Touchscreen
  // nicht an -- ohne Wake Lock dimmt das Handy mitten im Gefecht.
  async function requestWakeLock() {
    try {
      await navigator.wakeLock?.request('screen');
    } catch {
      /* nicht unterstuetzt oder verweigert -> egal */
    }
  }

  function update(dt) {
    if (!run) return;
    const gp = input.pollGamepad();
    if (input.consumePause() || (gp && gp.pausePressed)) pause.toggle();
    if (pause.isPaused()) return;

    // Tastatur/Maus, Gamepad und Touch zusammenfuehren: die gerade
    // aktive Quelle gewinnt (Fahren: Tastatur > Gamepad > Touch;
    // Zielen: Gamepad-Stick > Touch-Stick > Maus).
    const kbMove = input.getMoveAxis();
    const gpMove = gp && (gp.move.x || gp.move.y) ? gp.move : null;
    const tMove = touch.getMove();
    const move = kbMove.x || kbMove.y ? kbMove : gpMove || tMove;

    const p = run.state.player;
    const tAim = touch.getAimDir();
    let aim;
    let autoFire = false;
    if (gp && gp.aimDir) {
      aim = { x: p.x + gp.aimDir.x * 120, y: p.y + gp.aimDir.y * 120 };
      autoFire = true; // rechter Stick ausgelenkt -> Auto-Fire
    } else if (tAim) {
      aim = { x: p.x + tAim.x * 4, y: p.y + tAim.y * 4 };
      autoFire = true;
    } else {
      aim = input.getAim();
    }
    const cmd = {
      move,
      aim,
      // Rechter Trigger = manuelles Schiessen (ueberschreibt Auto-Fire).
      fire: input.consumeFire() || autoFire || !!(gp && gp.fireHeld),
      mine: input.consumeMine() || touch.consumeMine() || !!(gp && gp.minePressed),
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
    for (const name of run.state.sounds.splice(0)) {
      audio.play(name);
      // Haptik: Touch-Vibration (Android) und Gamepad-Rumble.
      if (touch.isActive() && navigator.vibrate) {
        if (name === 'boom') navigator.vibrate(60);
        else if (name === 'death') navigator.vibrate(40);
      }
      if (gp && (name === 'boom' || name === 'death')) {
        for (const pad of navigator.getGamepads?.() || []) {
          pad?.vibrationActuator
            ?.playEffect?.('dual-rumble', {
              duration: name === 'boom' ? 180 : 100,
              strongMagnitude: 0.7,
              weakMagnitude: 0.4,
            })
            .catch?.(() => {});
        }
      }
    }

    // Upgrade-Screen genau einmal pro Angebot einblenden.
    if (run.phase === 'upgrade' && !upgradeShown) {
      upgradeShown = true;
      upgradeScreen.show(run.pendingOffers, (idx) => {
        chooseUpgrade(run, idx);
        upgradeShown = false;
      });
    }

    // Raumvorschau: Gegnerliste + "Weiter"-Button.
    if (run.phase === 'preview' && !previewShown) {
      previewShown = true;
      const ups = Object.entries(run.upgrades)
        .filter(([, l]) => l > 0)
        .map(([id, l]) => `${upgradesData.upgrades[id]?.name || id} ${l}`)
        .join(' · ');
      const dangerByType = {};
      for (const [ty, d] of Object.entries(diffData.danger)) dangerByType[ty] = d.points;
      preview.show(
        {
          title: run.endless
            ? `Endlos-Raum ${run.roomIndex}`
            : `Raum ${run.roomIndex}/${totalRooms(run.difficulty)}`,
          character: run.roomCharacter,
          upgradesLine: ups ? `Deine Upgrades: ${ups}` : null,
          dangerByType,
        },
        run.state.tanks.slice(1).map((t) => t.type),
        tanksData,
        () => {
          enterRoom(run);
          previewShown = false;
        },
      );
    }
  }

  function render(alpha) {
    if (!run) return;
    renderer.render(run.state, alpha, tracks);
    if (input.isDebug() && run.phase === 'playing') {
      debugOverlay.render(run.state, fps);
    }
    hud.render(run, { paused: pause.isPaused(), toast });
    endlessBtn.classList.toggle('hidden', run.phase !== 'victory');

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
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (window.confirm('Bestwerte wirklich löschen?')) {
      resetStats();
      refreshBestStats();
    }
  });
  // Tages-Seed: fuer alle Spieler am selben Tag derselbe Run.
  document.getElementById('dailyBtn').addEventListener('click', () => {
    const d = new Date();
    seedInput.value = String(
      d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(),
    );
    startRun();
  });
  seedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startRun();
  });
  // Endscreens: Enter ODER Tipp/Klick auf das Spielfeld fuehrt zurueck
  // zum Start-Screen (Seed vorbefuellt) -> neuer Run.
  function backToStart() {
    refreshBestStats();
    startOverlay.classList.remove('hidden');
    seedInput.select();
    preview.hide();
    upgradeScreen.hide();
    endlessBtn.classList.add('hidden');
    run = null;
  }
  const endlessBtn = document.getElementById('endlessBtn');
  endlessBtn.addEventListener('click', () => {
    if (run && run.phase === 'victory') {
      continueEndless(run);
      previewShown = false;
      endlessBtn.classList.add('hidden');
    }
  });
  window.addEventListener('keydown', (e) => {
    if (!run) return;
    if (e.key === 'Enter' && (run.phase === 'gameover' || run.phase === 'victory')) {
      backToStart();
    }
    // Pause-Menue: R = Run mit gleichem Seed neu starten, M = Hauptmenue.
    if (pause.isPaused() && run.phase === 'playing') {
      if (e.code === 'KeyR') {
        run = createRun(tanksData, tilesData, diffData, upgradesData, lastSeed, mode);
        previewShown = false;
        upgradeShown = false;
        pause.set(false);
      } else if (e.code === 'KeyM') {
        pause.set(false);
        backToStart();
      }
    }
  });
  canvas.addEventListener('pointerup', () => {
    if (run && (run.phase === 'gameover' || run.phase === 'victory')) backToStart();
  });

  // Pause-Button oben mittig, Mute daneben.
  document.getElementById('pauseBtn').addEventListener('click', () => pause.toggle());
  const muteBtn = document.getElementById('muteBtn');
  muteBtn.classList.toggle('muted', audio.isMuted());
  muteBtn.addEventListener('click', () => {
    const m = audio.toggleMute();
    muteBtn.classList.toggle('muted', m);
    setPref('muted', m);
  });

  // Auto-Pause bei Tab-Wechsel (Spec Abschnitt 9) -- Pflicht, sonst
  // stirbt man bei einem eingehenden Anruf. Beim Zurueckkommen bleibt
  // das Spiel pausiert.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause.set(true);
      loop.stop();
    } else {
      loop.start();
      requestWakeLock(); // Wake Lock erlischt bei Tab-Wechsel
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

// Offline-Faehigkeit: Service Worker cached alle Dateien beim ersten
// Besuch (braucht HTTPS oder localhost).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
