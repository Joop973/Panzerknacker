// Minimal-Audio via WebAudio (Spec Abschnitt 5: t_white-Toene).
//
// Phase 5 braucht nur zwei Piepser: hoher Ton (t_white wird offensiv),
// tiefer Ton (t_white wird defensiv). Vollstaendiger Sound kommt in
// Phase 10. Browser erlauben Audio erst nach einer Nutzergeste --
// unlock() haengt an den ersten Eingaben (main.js).

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Ton zu einem bestimmten Zeitpunkt (fuer den Musik-Scheduler).
  function beepAt(freq, t0, dur, vol, type, slideTo = null) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  function beep(freq, dur = 0.12, vol = 0.12, type = 'square', slideTo = null) {
    if (!ctx || ctx.state !== 'running') return;
    beepAt(freq, ctx.currentTime, dur, vol, type, slideTo);
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
    gain.connect(master);
    src.start();
  }

  // --- Prozedurale Hintergrundmusik: karger 16-Step-Loop in a-Moll,
  // Bass + sparsames Arpeggio. Laeuft ueber den Master (Mute wirkt).
  const BASS = [55, 0, 55, 0, 65.4, 0, 82.4, 0, 55, 0, 55, 0, 98, 0, 82.4, 0];
  const LEAD = [220, 0, 262, 0, 330, 0, 0, 392, 0, 330, 0, 262, 0, 0, 440, 0];
  const STEP_S = 0.22;
  let musicTimer = null;
  let nextNote = 0;
  let stepIdx = 0;

  function startMusic() {
    unlock();
    if (!ctx || musicTimer) return;
    nextNote = ctx.currentTime + 0.1;
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      while (nextNote < ctx.currentTime + 0.15) {
        const b = BASS[stepIdx];
        const l = LEAD[stepIdx];
        if (b) beepAt(b, nextNote, 0.2, 0.05, 'sawtooth');
        if (l) beepAt(l, nextNote, 0.12, 0.028, 'triangle');
        stepIdx = (stepIdx + 1) % 16;
        nextNote += STEP_S;
      }
    }, 60);
  }

  return {
    unlock,
    startMusic,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 1;
      return muted;
    },
    setMuted(v) {
      muted = v;
      if (master) master.gain.value = muted ? 0 : 1;
    },
    isMuted: () => muted,
    // Benannte Spiel-Ereignisse -> Toene (aus state.sounds).
    play(name) {
      if (muted) return;
      if (name === 'tone_high') beep(880, 0.12);
      else if (name === 'tone_low') beep(220, 0.16);
      else if (name === 'shoot') beep(480, 0.07, 0.06, 'square', 220);
      else if (name === 'bounce') beep(300, 0.05, 0.05, 'triangle');
      else if (name === 'boom') {
        noise(0.35, 0.22);
        beep(90, 0.3, 0.15, 'sawtooth', 40);
      } else if (name === 'death') beep(500, 0.28, 0.12, 'sawtooth', 60);
      else if (name === 'mine') beep(700, 0.06, 0.08, 'square');
      else if (name === 'trap') beep(160, 0.25, 0.12, 'sawtooth');
      else if (name === 'combo') beep(660, 0.1, 0.08, 'square', 990);
      else if (name === 'clear' && ctx) {
        // Raum geschafft: kurzes aufsteigendes Jingle.
        [392, 523, 659].forEach((f, i) => beepAt(f, ctx.currentTime + i * 0.09, 0.12, 0.1, 'triangle'));
      } else if (name === 'fanfare' && ctx) {
        [523, 659, 784, 1047].forEach((f, i) => beepAt(f, ctx.currentTime + i * 0.13, 0.22, 0.12, 'square'));
      }
    },
  };
}
