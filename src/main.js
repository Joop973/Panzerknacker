// Einstiegspunkt (Spec Abschnitt 3: main.js).
//
// Verdrahtet Fixed-Timestep-Loop, Eingabe, Zustand, Renderer und
// Debug-Overlay. Phase 2: Fahren + Schiessen mit Abprallern.

import { STEP } from './config.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createState, stepState } from './game/state.js';
import { createRenderer } from './render/renderer.js';
import { createDebugOverlay } from './render/debug.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const input = createInput(window, canvas);
const state = createState();
const renderer = createRenderer(ctx);
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
    },
    dt,
  );
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
