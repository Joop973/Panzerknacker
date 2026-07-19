// Fixed-Timestep-Game-Loop mit Akkumulator (Spec Abschnitt 4: Zeitschritt).
//
// - Physik/Logik laeuft in festen Schritten (STEP = 1/60 s).
// - Rendering ist entkoppelt und bekommt ein Interpolations-Alpha (0..1),
//   das den Bruchteil bis zum naechsten Physikschritt angibt.
// - Der Frame-Delta wird geclamped, damit ein langer Tab-Wechsel keine
//   "Spirale des Todes" (endlose Aufholschritte) ausloest.

const MAX_FRAME = 0.25; // s: maximaler Delta pro echtem Frame

export function createLoop({ update, render, step }) {
  let running = false;
  let rafId = 0;
  let lastTime = 0;
  let accumulator = 0;

  function frame(nowMs) {
    if (!running) return;
    const now = nowMs / 1000;
    let delta = now - lastTime;
    lastTime = now;
    if (delta > MAX_FRAME) delta = MAX_FRAME;

    accumulator += delta;
    while (accumulator >= step) {
      update(step);
      accumulator -= step;
    }

    render(accumulator / step);
    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now() / 1000;
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    isRunning() {
      return running;
    },
  };
}
