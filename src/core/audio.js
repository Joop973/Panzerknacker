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

  function beep(freq, dur = 0.12, vol = 0.12) {
    if (!ctx || ctx.state !== 'running') return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  return {
    unlock,
    // Benannte Spiel-Ereignisse -> Toene (aus state.sounds).
    play(name) {
      if (name === 'tone_high') beep(880, 0.12);
      else if (name === 'tone_low') beep(220, 0.16);
    },
  };
}
