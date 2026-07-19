// Einstiegspunkt (Spec Abschnitt 3: main.js).
//
// Laedt die Balancing-Daten aus /data/*.json, verdrahtet dann
// Fixed-Timestep-Loop, Eingabe, Zustand, Renderer, Reifenspuren und
// Debug-Overlay. Phase 3: Gegner (t_brown, t_grey) mit KI.

import { STEP } from './config.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createAudio } from './core/audio.js';
import { createState, stepState } from './game/state.js';
import { createRenderer } from './render/renderer.js';
import { createTracks } from './render/tracks.js';
import { createDebugOverlay } from './render/debug.js';

async function init() {
  const [tanksData, tilesData] = await Promise.all([
    fetch('data/tanks.json').then((r) => r.json()),
    fetch('data/tiles.json').then((r) => r.json()),
  ]);

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const input = createInput(window, canvas);
  const audio = createAudio();
  // Browser geben Audio erst nach einer Nutzergeste frei.
  window.addEventListener('pointerdown', audio.unlock);
  window.addEventListener('keydown', audio.unlock);
  // Seed: bis zur Seed-Eingabe im UI (Phase 7) einfach aus der Uhr.
  const state = createState(tanksData, tilesData, Date.now() >>> 0);
  const tracks = createTracks();
  const renderer = createRenderer(ctx, tracks);
  const debugOverlay = createDebugOverlay(ctx);

  // FPS-Messung fuers Debug-Overlay: Render-Frames pro halber Sekunde.
  let fps = 0;
  let frameCount = 0;
  let fpsWindowStart = performance.now();

  function update(dt) {
    stepState(
      state,
      {
        move: input.getMoveAxis(),
        aim: input.getAim(),
        fire: input.consumeFire(),
        mine: input.consumeMine(),
      },
      dt,
    );
    tracks.stamp(state.tanks);
    // Von der Spiellogik gemeldete Audio-Ereignisse abspielen.
    for (const name of state.sounds.splice(0)) audio.play(name);
  }

  function render(alpha) {
    renderer.render(state, alpha);
    if (input.isDebug()) debugOverlay.render(state, fps);

    frameCount++;
    const now = performance.now();
    if (now - fpsWindowStart >= 500) {
      fps = (frameCount * 1000) / (now - fpsWindowStart);
      frameCount = 0;
      fpsWindowStart = now;
    }
  }

  const loop = createLoop({ update, render, step: STEP });

  // Auto-Pause bei Tab-Wechsel (Spec Abschnitt 9). Verhindert zusaetzlich,
  // dass sich nach langer Inaktivitaet Aufholschritte stauen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) loop.stop();
    else loop.start();
  });

  loop.start();
}

init();
