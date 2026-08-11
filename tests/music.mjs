// Hintergrundmusik-Test (dependency-frei, Node).
//
// Nutzerwunsch: die Hintergrundmusik ist jetzt ein echtes Audio-Asset
// (data/sounds.json: music.track), das als ENDLOSSCHLEIFE laeuft -- statt
// des bisherigen rein prozeduralen Loops. Der prozedurale Loop bleibt als
// Fallback, falls das Asset nicht laedt (Netzfehler) oder gar kein Track
// konfiguriert ist.
//
// Prueft src/core/audio.js mit gestubbtem AudioContext + fetch (kein echter
// Browser/keine echte Datei noetig). Gegenprobe (bestanden): setzt man
// `src.loop = true` im Code auf `false` zurueck oder entfernt den
// music.track-Zweig, wird Pruefung A bzw. C rot.

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    console.error('FEHLER: ' + msg);
    failures++;
  }
}

const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Gestubbtes WebAudio -----------------------------------------------
function makeFakeCtx({ decodeShouldFail = false } = {}) {
  const calls = { bufferSources: [], gains: [], oscillators: [] };
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain() {
      const g = {
        gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
      calls.gains.push(g);
      return g;
    },
    createBufferSource() {
      const src = { buffer: null, loop: false, started: false, connect() {}, start() { src.started = true; } };
      calls.bufferSources.push(src);
      return src;
    },
    createOscillator() {
      const o = {
        type: '',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
      calls.oscillators.push(o);
      return o;
    },
    createBiquadFilter() {
      return { type: '', frequency: { value: 0 }, connect() {} };
    },
    createStereoPanner: undefined, // wie in aelteren Browsern -- Panning wird eh nicht getestet
    createBuffer() {
      return { getChannelData: () => new Float32Array(4) };
    },
    // Promise-basierte Fassung (moderne Browser) -- decodeAudioDataCompat
    // deckt zusaetzlich die Callback-Fassung ab, hier reicht eine Form.
    decodeAudioData() {
      return decodeShouldFail
        ? Promise.reject(new Error('kaputte Datei'))
        : Promise.resolve({ fakeBuffer: true });
    },
    resume() {},
  };
  return { ctx, calls };
}

async function withStubbedEnv({ fetchFails = false, decodeFails = false }, fn) {
  const { ctx, calls } = makeFakeCtx({ decodeShouldFail: decodeFails });
  const fetchCalls = [];
  const prevWindow = globalThis.window;
  const prevFetch = globalThis.fetch;
  globalThis.window = {
    AudioContext: function () {
      return ctx;
    },
  };
  globalThis.fetch = async (url) => {
    fetchCalls.push(url);
    if (fetchFails) throw new Error('Netz down');
    return { arrayBuffer: async () => new ArrayBuffer(8) };
  };
  try {
    await fn({ calls, fetchCalls });
  } finally {
    globalThis.window = prevWindow;
    globalThis.fetch = prevFetch;
  }
}

const { createAudio } = await import('../src/core/audio.js');

const soundsData = (track) => ({
  pan: { maxAbs: 0.75 },
  limits: {},
  music: {
    ...(track ? { track: 'assets/audio/theme.mp3', trackVol: 0.35 } : {}),
    stepS: 0.22,
    bass: { notes: [55, 0], dur: 0.2, vol: 0.05, wave: 'sawtooth' },
    lead: { notes: [220, 0], dur: 0.12, vol: 0.028, wave: 'triangle' },
  },
  sounds: {},
});

// --- A. Track laedt -> echte Loop-Wiedergabe ------------------------------
await withStubbedEnv({}, async ({ calls }) => {
  const audio = createAudio();
  audio.setData(soundsData(true));
  audio.startMusic();
  await flush(10);

  check(calls.bufferSources.length === 1, `Musik-Track: ${calls.bufferSources.length} BufferSource(n) statt 1`);
  const src = calls.bufferSources[0];
  check(src?.loop === true, 'Musik-Track: loop ist nicht true -- laeuft nicht als Endlosschleife');
  check(src?.buffer?.fakeBuffer === true, 'Musik-Track: falscher/kein dekodierter Buffer gesetzt');
  check(src?.started === true, 'Musik-Track: start() wurde nicht aufgerufen');
  // trackVol aus sounds.json muss auf einem eigenen Gain-Knoten landen.
  const trackGain = calls.gains.find((g) => g.gain.value === 0.35);
  check(!!trackGain, `Musik-Track: kein Gain-Knoten mit trackVol 0.35 (Werte: ${calls.gains.map((g) => g.gain.value)})`);

  // Idempotenz: ein zweiter startMusic()-Aufruf (main.js ruft ihn bei JEDER
  // Eingabe-Geste erneut auf) darf keine zweite Wiedergabe starten.
  audio.startMusic();
  await flush(5);
  check(calls.bufferSources.length === 1, 'Musik-Track: zweiter startMusic()-Aufruf startet eine zweite Wiedergabe');
});

// --- B. Ladefehler (Netz) -> prozeduraler Fallback ------------------------
await withStubbedEnv({ fetchFails: true }, async ({ calls }) => {
  const audio = createAudio();
  audio.setData(soundsData(true));
  audio.startMusic();
  await flush(10);
  await wait(80); // der Fallback-Loop tickt per echtem setInterval (60ms)

  check(calls.bufferSources.length === 0, 'Fallback (Netzfehler): trotzdem eine BufferSource erzeugt');
  check(calls.oscillators.length > 0, 'Fallback (Netzfehler): kein prozeduraler Ton erklungen -- Spiel bliebe stumm');
});

// --- C. Dekodierfehler -> ebenfalls prozeduraler Fallback -----------------
await withStubbedEnv({ decodeFails: true }, async ({ calls }) => {
  const audio = createAudio();
  audio.setData(soundsData(true));
  audio.startMusic();
  await flush(10);
  await wait(80);

  check(calls.bufferSources.length === 0, 'Fallback (Dekodierfehler): trotzdem eine BufferSource erzeugt');
  check(calls.oscillators.length > 0, 'Fallback (Dekodierfehler): kein prozeduraler Ton erklungen');
});

// --- D. Kein Track konfiguriert -> sofort prozedural, ohne Netzaufruf -----
await withStubbedEnv({}, async ({ calls, fetchCalls }) => {
  const audio = createAudio();
  audio.setData(soundsData(false));
  audio.startMusic();
  await flush(10);
  await wait(80);

  check(fetchCalls.length === 0, `Ohne music.track: es wurde trotzdem ein fetch() ausgeloest (${fetchCalls})`);
  check(calls.oscillators.length > 0, 'Ohne music.track: kein prozeduraler Ton erklungen');
});

if (failures) {
  console.error(`\n${failures} Musik-Pruefung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log('Alle Musik-Tests bestanden.');
process.exit(0); // hart beenden -- der prozedurale Fallback laesst ggf. einen setInterval offen
