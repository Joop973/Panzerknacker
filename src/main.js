// Einstiegspunkt (Spec Abschnitt 3: main.js).
//
// Laedt die Daten aus /data/*.json, zeigt den Start-Screen mit
// Seed-Eingabe und verdrahtet Loop, Eingabe, Run-Controller, Renderer,
// Reifenspuren, HUD und Debug-Overlay.

import { STEP } from './config.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createAudio } from './core/audio.js';
import {
  createRun,
  stepRun,
  chooseUpgrade,
  enterRoom,
  totalRooms,
  continueEndless,
  rerollOffers,
  banOffer,
  buyFourthCard,
  buyShieldCharge,
} from './game/run.js';
import { createUpgradeScreen } from './ui/upgradescreen.js';
import { createPreview } from './ui/preview.js';
import { createTouchControls } from './ui/touchcontrols.js';
import { createPause } from './ui/pause.js';
import { createTutorial } from './ui/hud.js';
import { getFlag, setFlag, loadStats, getPref, setPref, resetStats } from './core/storage.js';
import { createRenderer, renderOpts } from './render/renderer.js';
import { createTracks } from './render/tracks.js';
import { createDebugOverlay } from './render/debug.js';
import { createHud } from './ui/hud.js';
import * as telemetry from './core/telemetry.js';

async function loadData() {
  const names = ['tanks', 'tiles', 'difficulty', 'upgrades', 'balance'];
  const out = [];
  for (const n of names) {
    let res;
    try {
      res = await fetch('data/' + n + '.json');
    } catch (e) {
      throw new Error(
        `Konnte data/${n}.json nicht laden (${e.message}).\n\n` +
          'Wird die Seite per Datei geöffnet (file://)? Dann bitte über ' +
          'einen Webserver oder die veröffentlichte URL starten.',
      );
    }
    if (!res.ok) throw new Error(`data/${n}.json: HTTP ${res.status}`);
    try {
      out.push(await res.json());
    } catch {
      throw new Error(`data/${n}.json ist beschädigt (kein gültiges JSON).`);
    }
  }
  return out;
}

async function init() {
  const [tanksData, tilesData, diffData, upgradesData, balanceData] = await loadData();
  // Balance-Werte (data/balance.json) an das Datenobjekt haengen, damit
  // sie ueber state.data.balance ueberall in der Spiellogik verfuegbar
  // sind (Geschoss-Lifetime/Cap/Immunitaet, Minen-Radius/Fuse/Kette).
  tanksData.balance = balanceData;
  // Debug-Ansicht der Telemetrie nur bei ?debug=1 aufbauen.
  telemetry.mountDebugView();

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
    const combo = s.bestCombo ? ` · Combo ×${s.bestCombo}` : '';
    el.textContent = `${s.runs} Runs · beste Räume ${s.mostRooms} · ${s.totalKills} Kills${combo}${win}`;
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

  // ---- Telemetrie-Tracking (nur beobachtend, keine Spiellogik) ----
  let teleRoom = 0; // aktuell getimter Raum-Index
  let teleRoomStart = 0; // run.playTime beim Betreten dieses Raums
  let teleEnded = true; // schon abgeschlossen? (verhindert Doppel-Eintrag)
  // Setzt das Tracking fuer einen frisch erstellten Run auf und startet
  // den Telemetrie-Sammelpuffer.
  function beginTelemetry() {
    teleRoom = run.roomIndex;
    teleRoomStart = run.playTime;
    teleEnded = false;
    telemetry.beginRun({ seed: run.seed, mode: run.mode });
  }
  // Wird jeden Tick nach stepRun aufgerufen: Raumwechsel + Run-Ende.
  function updateTelemetry() {
    if (!run || teleEnded) return;
    // Raum abgeschlossen -> Dauer + Leben + verdienter Schrott festhalten.
    if (run.roomIndex !== teleRoom) {
      telemetry.recordRoom({
        room: teleRoom,
        durationS: run.playTime - teleRoomStart,
        lives: run.lives,
        scrapEarned: run.scrapThisRoom,
      });
      run.scrapThisRoom = 0;
      teleRoom = run.roomIndex;
      teleRoomStart = run.playTime;
    }
    if (run.phase === 'gameover' || run.phase === 'victory') {
      // Letzten (evtl. unvollstaendigen) Raum noch mitschreiben.
      telemetry.recordRoom({
        room: teleRoom,
        durationS: run.playTime - teleRoomStart,
        lives: run.lives,
        scrapEarned: run.scrapThisRoom,
      });
      run.scrapThisRoom = 0;
      const st = run.state;
      telemetry.endRun({
        won: run.phase === 'victory',
        roomReached: run.roomIndex,
        deathCause: st.lastDeathCauseCode || null,
        deathCauseLabel: st.lastDeathCause || null,
        enemyType: st.lastDeathEnemyType || null,
      });
      teleEnded = true;
    }
  }

  // Darstellungs-Optionen (gespeichert).
  renderOpts.threatLines = getPref('threatLines', true);
  renderOpts.reduceMotion = getPref('reduceMotion', false);
  const optThreat = document.getElementById('optThreat');
  const optMotion = document.getElementById('optMotion');
  optThreat.checked = renderOpts.threatLines;
  optMotion.checked = renderOpts.reduceMotion;
  optThreat.addEventListener('change', () => {
    renderOpts.threatLines = optThreat.checked;
    setPref('threatLines', optThreat.checked);
  });
  optMotion.addEventListener('change', () => {
    renderOpts.reduceMotion = optMotion.checked;
    setPref('reduceMotion', optMotion.checked);
  });

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
    beginTelemetry();
    startOverlay.classList.add('hidden');
    upgradeScreen.hide();
    preview.hide();
    upgradeShown = false;
    previewShown = false;
    pause.set(false); // frischer Run startet NIE pausiert (Portrait-Altlast)
    goFullscreen();
    requestWakeLock();
  }

  // Touch-Geraete: echtes Vollbild (Adressleiste weg) + Landscape-Lock
  // versuchen (Android; iOS unterstuetzt Element-Vollbild nicht -- dort
  // haelt viewport-fit=cover + 100dvh die Leiste klein, sonst hilft nur
  // "Zum Startbildschirm hinzufuegen"). Nur anfordern, wenn wir nicht
  // ohnehin schon im Vollbild sind, damit kein Fehler geworfen wird.
  function goFullscreen() {
    if (navigator.maxTouchPoints === 0 || document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.().then(
      () => screen.orientation?.lock?.('landscape').catch(() => {}),
      () => {},
    );
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
    const mineThrow = touch.consumeMineThrow(); // Touch-Wurfstick losgelassen
    const cmd = {
      move,
      aim,
      // Rechter Trigger = manuelles Schiessen (ueberschreibt Auto-Fire).
      fire: input.consumeFire() || autoFire || !!(gp && gp.fireHeld),
      mine: input.consumeMine() || touch.consumeMine() || !!(gp && gp.minePressed) || !!mineThrow,
      mineThrow: mineThrow || null,
      dash: input.consumeDash() || !!(gp && gp.dashPressed),
    };
    // Dash-Button nur zeigen, wenn das Upgrade aktiv ist.
    dashBtn.classList.toggle('hidden', !(p.cfg.dash && touch.isActive()));
    stepRun(run, cmd, dt);
    updateTelemetry();
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
      const costs = run.data.balance.scrap.cost;
      const cardOf = (o) => ({ id: o.fallback ? null : o.id, name: o.name, tag: o.tag, rarity: o.rarity });
      upgradeScreen.show({
        costs,
        getOffers: () => run.pendingOffers,
        getScrap: () => run.scrap,
        canFourth: () => run.pendingOffers.length < 4,
        onPick: (idx) => {
          // Telemetrie: gewaehlte Karte + abgelehnte Alternativen (id + tag).
          const offers = run.pendingOffers;
          telemetry.recordUpgrade({
            chosen: cardOf(offers[idx]),
            rejected: offers.filter((_, i) => i !== idx).map(cardOf),
          });
          chooseUpgrade(run, idx);
          upgradeShown = false;
        },
        onReroll: () => {
          const ok = rerollOffers(run);
          if (ok) telemetry.recordScrapSpend({ room: run.roomIndex, type: 'reroll', amount: costs.reroll });
          return ok;
        },
        onBan: (idx) => {
          const offer = run.pendingOffers[idx];
          const ok = banOffer(run, idx);
          if (ok) {
            telemetry.recordScrapSpend({ room: run.roomIndex, type: 'ban', amount: costs.ban });
            telemetry.recordBan({ room: run.roomIndex, id: offer.id });
          }
          return ok;
        },
        onFourth: () => {
          const ok = buyFourthCard(run);
          if (ok) telemetry.recordScrapSpend({ room: run.roomIndex, type: 'fourthCard', amount: costs.fourthCard });
          return ok;
        },
        onShield: () => {
          const ok = buyShieldCharge(run);
          if (ok) telemetry.recordScrapSpend({ room: run.roomIndex, type: 'shieldCharge', amount: costs.shieldCharge });
          return ok;
        },
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
    renderer.render(run.state, alpha, tracks, run.phase === 'playing' ? touch.getMinePreview() : null);
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
  const dashBtn = document.getElementById('dashBtn');
  dashBtn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.queueDash();
    },
    { passive: false },
  );
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
        beginTelemetry();
        previewShown = false;
        upgradeShown = false;
        pause.set(false);
      } else if (e.code === 'KeyM') {
        pause.set(false);
        backToStart();
      }
    }
  });
  // Endscreens: nur ein NEU auf dem Endscreen begonnener Tipp fuehrt zum
  // Start-Screen zurueck. Der Tipp, der das Spiel gewinnt/verliert, darf das
  // nicht ausloesen -- sonst wird beim Sieg der Endlos-Button uebersprungen
  // (dessen Finger-Hoch faellt sonst schon in die Victory-Phase und schickt
  // direkt ins Menue).
  let endScreenTapArmed = false;
  const onEndScreen = () => run && (run.phase === 'gameover' || run.phase === 'victory');
  canvas.addEventListener('pointerdown', () => {
    endScreenTapArmed = onEndScreen();
  });
  canvas.addEventListener('pointerup', () => {
    if (endScreenTapArmed && onEndScreen()) backToStart();
    endScreenTapArmed = false;
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
  // Zurueck ins Querformat -> automatisch fortsetzen, sonst bleibt das
  // Spiel faelschlich pausiert und man muss erst "Pause" druecken.
  const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  const onPortrait = () => {
    if (portrait.matches) pause.set(true);
    else if (run && run.phase === 'playing') pause.set(false);
  };
  portrait.addEventListener?.('change', onPortrait);
  // Bei Init nur pausieren wenn tatsaechlich Portrait -- nie beim Start
  // haengen lassen.
  if (portrait.matches) pause.set(true);

  // Faellt das Vollbild raus (Zurueck-Geste, System-Overlay), holt der
  // naechste Fingertipp es zurueck -- so bleibt die Adressleiste weg.
  window.addEventListener(
    'pointerdown',
    () => {
      if (run && run.phase === 'playing') goFullscreen();
    },
    { passive: true },
  );

  loop.start();
}

// Offline-Faehigkeit: Service Worker cached alle Dateien beim ersten
// Besuch (braucht HTTPS oder localhost).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Startfehler sichtbar machen statt schwarzem Bildschirm.
init().catch((err) => {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'padding:24px;background:#14141a;color:#e8e4d8;font-family:monospace;font-size:15px;' +
    'text-align:center;white-space:pre-wrap;z-index:99;line-height:1.5';
  box.textContent = 'PANZERKNACKER konnte nicht starten:\n\n' + (err?.message || err);
  document.body.appendChild(box);
});
