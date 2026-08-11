// Prozedurales Audio via WebAudio (Phase 7b) + echte Musik-Loop-Datei.
//
// Alle SOUND-EFFEKTE sind weiterhin Synthese ohne Asset: jeder Ton wird zur
// Laufzeit erzeugt, JEDE Zahl kommt aus data/sounds.json (Wellenform,
// Frequenzverlauf, Dauer, Lautstaerke, Filter) -- vom Handy tunbar, ohne Code
// anzufassen. Einzige Ausnahme (Nutzerwunsch): die HINTERGRUNDMUSIK ist ein
// echtes Audio-Asset (data/sounds.json: music.track), das als Endlosschleife
// laeuft; der bisherige prozedurale 16-Step-Loop bleibt als Fallback, falls
// das Asset nicht laedt.
//
// Stereopanning: Ereignisse mit Ort (Schuss, Abpraller, Explosion, Mine,
// Tod) melden ihre x-Koordinate; play() platziert sie im Stereobild.
// Ereignisse ohne Ort (Raum geraeumt, Upgrade, Fanfare) bleiben mittig.
//
// Browser erlauben Audio erst nach einer Nutzergeste -- unlock() haengt an
// den ersten Eingaben (main.js).

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 1; // P9: Lautstaerkeregler (0..1), unabhaengig vom Mute-Schalter
  let data = null; // Inhalt von data/sounds.json (via setData)
  let panWidth = 0; // Arenabreite in px -- 0 = kein Panning

  // P9: EIN Ort fuer die tatsaechliche Gain-Berechnung -- Mute UND Regler
  // wirken auf denselben Knoten, statt zwei Zustaende gegeneinander
  // auszuspielen. Stumm gewinnt immer (0), sonst gilt der Reglerwert.
  function applyGain() {
    if (master) master.gain.value = muted ? 0 : volume;
  }

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Ausgangsknoten fuer EINEN Sound: optionaler Filter + optionaler Panner.
  // Beides pro Sound frisch, damit sich gleichzeitige Toene nicht
  // gegenseitig umpannen.
  function outputFor(def, x) {
    let head = master;
    // Panning nur, wenn das Ereignis einen Ort gemeldet hat UND der Browser
    // StereoPannerNode kennt (aeltere Safari nicht -> dann eben mittig).
    if (x != null && panWidth > 0 && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      const maxAbs = data?.pan?.maxAbs ?? 0.75;
      const rel = (x / panWidth) * 2 - 1; // -1 (links) .. +1 (rechts)
      panner.pan.value = Math.max(-1, Math.min(1, rel)) * maxAbs;
      panner.connect(head);
      head = panner;
    }
    if (def?.filter?.type && def.filter.freq) {
      const f = ctx.createBiquadFilter();
      f.type = def.filter.type;
      f.frequency.value = def.filter.freq;
      f.connect(head);
      head = f;
    }
    return head;
  }

  // Ein Ton zu einem festen Zeitpunkt.
  function toneAt(out, freq, t0, dur, vol, wave, slideTo) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  // Rauschanteil (Explosionen, eigener Tod).
  function noiseAt(out, t0, dur, vol) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(gain);
    gain.connect(out);
    src.start(t0);
  }

  // Stimmen-Deckel gegen Krach: derselbe Sound-Name wird innerhalb eines
  // Frames hoechstens maxVoicesPerName mal angespielt (eine Kettenreaktion
  // aus acht Minen soll knallen, nicht uebersteuern). Zeitfenster statt
  // Frame-Zaehler, damit main.js keinen zusaetzlichen Vertrag braucht.
  const recent = new Map(); // name -> { t, n }
  const VOICE_WINDOW_S = 0.02;
  function allowVoice(name) {
    const limit = data?.limits?.maxVoicesPerName ?? Infinity;
    const now = ctx.currentTime;
    const r = recent.get(name);
    if (!r || now - r.t > VOICE_WINDOW_S) {
      recent.set(name, { t: now, n: 1 });
      return true;
    }
    if (r.n >= limit) return false;
    r.n++;
    return true;
  }

  // --- Hintergrundmusik (Werte aus data/sounds.json: music) ---------------
  // Nutzerwunsch: ein echtes Audio-Asset (music.track) als Endlosschleife,
  // statt des bisherigen prozeduralen Loops -- die einzige Ausnahme von
  // "kein Sound-Asset" im Projekt. Der prozedurale Loop bleibt als FALLBACK,
  // falls das Asset nicht laedt (Netzfehler, Offline-Erstbesuch ohne Cache).
  let musicTimer = null; // prozeduraler Fallback-Loop
  let nextNote = 0;
  let stepIdx = 0;
  let musicBuffer = null; // dekodiertes music.track, einmal geladen
  let musicSource = null; // laufender AudioBufferSourceNode (loop:true)
  let musicLoading = null; // laufendes fetch+decode (Promise), gegen Doppel-Laden

  // decodeAudioData() ist in aelteren Implementierungen callback- statt
  // promise-basiert -- beide Formen abdecken, ohne doppelt aufzuloesen.
  function decodeAudioDataCompat(arrayBuffer) {
    return new Promise((resolve, reject) => {
      const maybePromise = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(resolve, reject);
    });
  }

  function playMusicBuffer() {
    // musicSource-Check macht wiederholte startMusic()-Aufrufe (jede
    // Eingabe-Geste ruft sie ueber unlockAll() erneut auf) idempotent.
    if (!ctx || !musicBuffer || musicSource) return;
    const src = ctx.createBufferSource();
    src.buffer = musicBuffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = data?.music?.trackVol ?? 1;
    src.connect(gain);
    gain.connect(master);
    src.start(0);
    musicSource = src;
  }

  // Prozeduraler 16-Step-Loop (Bass + sparsames Arpeggio) -- Fallback, falls
  // music.track fehlt oder nicht laedt.
  function startProceduralMusic() {
    if (musicTimer || !data?.music) return;
    const m = data.music;
    const stepS = m.stepS ?? 0.22;
    const len = Math.max(m.bass?.notes?.length || 0, m.lead?.notes?.length || 0);
    if (!len) return;
    nextNote = ctx.currentTime + 0.1;
    musicTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      while (nextNote < ctx.currentTime + 0.15) {
        for (const voice of [m.bass, m.lead]) {
          const f = voice?.notes?.[stepIdx];
          if (f) toneAt(master, f, nextNote, voice.dur, voice.vol, voice.wave, null);
        }
        stepIdx = (stepIdx + 1) % len;
        nextNote += stepS;
      }
    }, 60);
  }

  function startMusic() {
    unlock();
    if (!ctx || !data?.music) return;
    if (musicTimer || musicSource) return; // laeuft schon (Fallback oder Asset)
    const track = data.music.track;
    if (!track) {
      startProceduralMusic();
      return;
    }
    if (musicBuffer) {
      playMusicBuffer();
      return;
    }
    if (!musicLoading) {
      musicLoading = fetch(track)
        .then((r) => r.arrayBuffer())
        .then((buf) => decodeAudioDataCompat(buf))
        .then((decoded) => {
          musicBuffer = decoded;
        })
        .catch(() => {
          // Laden/Dekodieren fehlgeschlagen -> prozeduraler Fallback, damit
          // das Spiel nicht stumm bleibt.
          startProceduralMusic();
        });
    }
    musicLoading.then(() => {
      if (musicBuffer && !musicSource && !musicTimer) playMusicBuffer();
    });
  }

  return {
    unlock,
    startMusic,
    // data/sounds.json anhaengen (main.js beim Laden). Ohne Daten bleibt
    // das Modul still, statt zu werfen.
    setData(soundsData) {
      data = soundsData;
    },
    // Arenabreite fuer die Stereo-Zuordnung (main.js, aus config.js).
    setPanWidth(w) {
      panWidth = w || 0;
    },
    toggleMute() {
      muted = !muted;
      applyGain();
      return muted;
    },
    setMuted(v) {
      muted = v;
      applyGain();
    },
    isMuted: () => muted,
    // P9: Lautstaerkeregler statt reinem Mute. v ist 0..1 und wird NICHT
    // geklemmt hier (der Aufrufer -- der Regler im Startmenue -- liefert
    // bereits einen Wert in diesem Bereich).
    setVolume(v) {
      volume = v;
      applyGain();
    },
    getVolume: () => volume,
    // Benanntes Spiel-Ereignis abspielen. `x` ist die Welt-x-Koordinate des
    // Ereignisses (optional) -- damit wird der Ton im Stereobild platziert.
    play(name, x) {
      if (muted || !ctx || ctx.state !== 'running') return;
      const def = data?.sounds?.[name];
      if (!def) return; // unbekannter Name -> still (siehe Regressionstest)
      if (!allowVoice(name)) return;
      const t0 = ctx.currentTime;
      const out = outputFor(def, x);
      if (def.noise) noiseAt(out, t0, def.noise.dur, def.noise.vol);
      for (const s of def.steps || []) {
        toneAt(out, s.freq, t0 + (s.at || 0), s.dur, s.vol, s.wave, s.slideTo || null);
      }
    },
  };
}
