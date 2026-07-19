// Minimal-Audio via WebAudio (Spec Abschnitt 5: t_white-Toene).
//
// Phase 5 braucht nur zwei Piepser: hoher Ton (t_white wird offensiv),
// tiefer Ton (t_white wird defensiv). Vollstaendiger Sound kommt in
// Phase 10. Browser erlauben Audio erst nach einer Nutzergeste --
// unlock() haengt an den ersten Eingaben (main.js).

export function createAudio() {
  let ctx = null;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function beep(freq, dur = 0.12, vol = 0.12, type = 'square', slideTo = null) {
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(t0 + dur);
  }

  // Rauschen fuer Explosionen.
  function noise(dur = 0.3, vol = 0.2) {
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  return {
    unlock,
    // Benannte Spiel-Ereignisse -> Toene (aus state.sounds).
    play(name) {
      if (name === 'tone_high') beep(880, 0.12);
      else if (name === 'tone_low') beep(220, 0.16);
      else if (name === 'shoot') beep(480, 0.07, 0.06, 'square', 220);
      else if (name === 'bounce') beep(300, 0.05, 0.05, 'triangle');
      else if (name === 'boom') {
        noise(0.35, 0.22);
        beep(90, 0.3, 0.15, 'sawtooth', 40);
      } else if (name === 'death') beep(500, 0.28, 0.12, 'sawtooth', 60);
      else if (name === 'mine') beep(700, 0.06, 0.08, 'square');
    },
  };
}
