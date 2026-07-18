// Einstiegspunkt (Spec Abschnitt 3: main.js).
//
// Verdrahtet Fixed-Timestep-Loop, Eingabe, Zustand und Renderer.
// Phase 1: Spielerpanzer faehrt mit Sliding-Kollision durch eine
// hartcodierte Testarena. Kein Schiessen, keine Gegner.

import { STEP } from './config.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createState } from './game/state.js';
import { updatePlayer } from './game/tank.js';
import { createRenderer } from './render/renderer.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const input = createInput(window);
const state = createState();
const renderer = createRenderer(ctx);

function update(dt) {
  const axis = input.getMoveAxis();
  updatePlayer(state.player, axis, state.walls, dt);
}

function render(alpha) {
  renderer.render(state, alpha);
}

const loop = createLoop({ update, render, step: STEP });

// Auto-Pause bei Tab-Wechsel (Spec Abschnitt 9). Verhindert zusaetzlich,
// dass sich nach langer Inaktivitaet Aufholschritte stauen.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

loop.start();
