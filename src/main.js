// Einstiegspunkt (Spec Abschnitt 3: main.js).
//
// Laedt die Daten aus /data/*.json, zeigt den Start-Screen mit
// Seed-Eingabe und verdrahtet Loop, Eingabe, Run-Controller, Renderer,
// Reifenspuren, HUD und Debug-Overlay.

import { STEP, WIDTH } from './config.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createViewport } from './core/viewport.js';
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
  dropUpgrade,
  leaveWorkshop,
  chooseEventOption,
  chooseMapNode,
  buyShopCard,
  buyShopSecondary,
  buyShopLife,
  ROOM_TYPE_INFO,
} from './game/run.js';
import { createUpgradeScreen } from './ui/upgradescreen.js';
import { createEventScreen, createShopScreen } from './ui/roomscreens.js';
import { createMapScreen } from './ui/mapscreen.js';
import { validateArenas } from './game/generator.js';
import { createPreview } from './ui/preview.js';
import { createTouchControls } from './ui/touchcontrols.js';
import { createPause } from './ui/pause.js';
import { createMenuNav } from './ui/menunav.js';
import { createTutorial } from './ui/hud.js';
import {
  getFlag,
  setFlag,
  loadStats,
  getPref,
  setPref,
  resetStats,
  loadCurrentRun,
  clearCurrentRun,
} from './core/storage.js';
import { createRenderer, renderOpts } from './render/renderer.js';
import { createTracks } from './render/tracks.js';
import { createDebugOverlay } from './render/debug.js';
import { createHud } from './ui/hud.js';
import * as telemetry from './core/telemetry.js';

async function loadData() {
  const names = ['tanks', 'tiles', 'difficulty', 'upgrades', 'balance', 'events', 'input', 'options', 'arenas', 'transformations', 'secondaries', 'modifiers', 'limits', 'sounds', 'status'];
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
  const [tanksData, tilesData, diffData, upgradesData, balanceData, eventsData, inputCfg, optionsData, arenasData, transformData, secondariesData, modifiersData, limitsData, soundsData, statusData] =
    await loadData();
  // Balance-Werte (data/balance.json) an das Datenobjekt haengen, damit
  // sie ueber state.data.balance ueberall in der Spiellogik verfuegbar
  // sind (Geschoss-Lifetime/Cap/Immunitaet, Minen-Radius/Fuse/Kette).
  tanksData.balance = balanceData;
  tanksData.events = eventsData; // Phase 4: Event-Raeume (run.data.events)
  tanksData.arenas = arenasData; // Phase 0b: feste Layouts (Arena-Weiche)
  tanksData.transformations = transformData; // Definitionen fuer Phase 17
  tanksData.secondaries = secondariesData; // Phase 6: Sekundärslot-Stellwerte
  tanksData.modifiers = modifiersData; // Phase 10: Raum-Modifikatoren
  // Phase 11b: nur die NEUEN Deckel (Gegner gleichzeitig/Minen/Partikel) --
  // Spieler-Kugeln/Gegner-Kugeln/Geister haben ihre Obergrenze schon in
  // balance.json, die Debug-Ansicht liest die von dort (keine Duplikate).
  tanksData.limits = limitsData;
  // Phase 7b: Minen-Warnpuls braucht seinen Takt in der Spiellogik
  // (mine.js) -- der Rest von sounds.json geht direkt an das Audio-Modul.
  tanksData.sounds = soundsData;
  // UMBAUPLAN-LP Phase 5: Statuseffekte ueber Zeit (Feuer/Gift/Frost).
  tanksData.status = statusData;
  // P1: die Spiellogik braucht aus data/input.json nur den feedback-Block
  // (Rueckmeldung bei gesperrtem Schuss). Geraete-Events liest weiterhin
  // ausschliesslich src/core/input.js.
  tanksData.input = inputCfg;
  // Feste Layouts EINMALIG beim Laden pruefen (Flood-Fill etc.). Ein
  // unloesbares Layout meldet sich hier mit klarer Meldung statt spaeter
  // im laufenden Spiel.
  validateArenas(arenasData);
  // Debug-Ansicht der Telemetrie nur bei ?debug=1 aufbauen.
  telemetry.mountDebugView();

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  // P2: Backing-Store an devicePixelRatio koppeln (gedeckelt) und die
  // sichtbare Hoehe als CSS-Variable bereitstellen. Muss VOR dem ersten
  // render() laufen -- der Kontext bekommt hier seine Grundtransformation.
  const viewport = createViewport(canvas, ctx, optionsData);
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

  // Touch-Treiber zuerst: die Eingabeschicht liest ihn als eine von drei
  // Quellen. Die Spiellogik sieht nur noch input.getState().
  const touch = createTouchControls(inputCfg);
  const input = createInput(window, canvas, { inputCfg, touch });
  const audio = createAudio();
  // Phase 7b: alle Tondefinitionen kommen aus data/sounds.json, die
  // Arenabreite dient der Stereo-Zuordnung ortsgebundener Ereignisse.
  audio.setData(soundsData);
  audio.setPanWidth(WIDTH);
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
  const eventScreen = createEventScreen();
  const workshopScreen = createShopScreen();
  const preview = createPreview();
  const mapScreen = createMapScreen();
  const pause = createPause();
  const tutorial = createTutorial(getFlag('tutorial_seen'));

  let run = null;
  let lastRoomState = null;
  let upgradeShown = false;
  let eventShown = false;
  let workshopShown = false;
  let mapShown = false;
  let previewShown = false;
  let toast = null;
  let lastSeed = 0;
  let mode = getPref('mode', 'normal');
  // Phase 9: gewaehlte Klasse (Default: Standard = 'player'). Persistiert, damit
  // die Auswahl ueber Sitzungen erhalten bleibt; der laufende Run traegt sie
  // ausserdem im Snapshot (run.js), sodass "Fortsetzen" dieselbe Klasse laedt.
  let starterTank = getPref('starterTank', 'player');
  if (!tanksData.types[starterTank]?.player) starterTank = 'player';

  // ---- Telemetrie-Tracking (nur beobachtend, keine Spiellogik) ----
  let teleRoom = 0; // aktuell getimter Raum-Index
  let teleRoomStart = 0; // run.playTime beim Betreten dieses Raums
  let teleEnded = true; // schon abgeschlossen? (verhindert Doppel-Eintrag)
  // Pro Raum mitgefuehrte Kennzahlen. Sie werden jeden Tick aus dem
  // Raumzustand ABGELESEN (nie zurueckgeschrieben), weil beim Raumwechsel
  // schon der naechste Zustand haengt.
  let teleRoomType = null;
  let teleEnemies = [];
  let teleShield = 0;
  let teleMinFps = Infinity;
  let teleDmgType = null; // Phase 8: Schaden je Schadenstyp in diesem Raum
  let teleSec = 0;
  let telePowershots = 0;
  let teleSecondary = 'mine';
  let teleGhosts = 0;
  let teleModifier = null;
  let teleHazard = null;
  // Grundsteinumbau Phase 2 (Kampfkern-Telemetrie, Entscheidung I): erst
  // messen, dann an LP/Balance drehen.
  let teleShotsFired = 0;
  let teleShotsHit = 0;
  let teleMagBlocked = 0;
  // Phase 11b: schlechtester Logik-/Render-Frame IM AKTUELLEN RAUM, nur fuer
  // die Debug-Anzeige -- bewusst nicht in der Telemetrie (die hat mit
  // minFps schon ihre eigene, persistierte Kennzahl seit Phase 1).
  let worstLogicMs = 0;
  let worstRenderMs = 0;

  function resetRoomTelemetry() {
    teleRoomType = null;
    teleEnemies = [];
    teleShield = 0;
    teleMinFps = Infinity;
    teleDmgType = null;
    teleSec = 0;
    telePowershots = 0;
    worstLogicMs = 0;
    worstRenderMs = 0;
    teleGhosts = 0;
    teleModifier = null;
    teleHazard = null;
    teleShotsFired = 0;
    teleShotsHit = 0;
    teleMagBlocked = 0;
  }

  // Momentaufnahme des laufenden Raums (jeden Tick, sehr billig).
  function sampleRoomTelemetry() {
    teleRoomType = run.roomType;
    teleShield = run.shieldCharges.length;
    teleSecondary = run.equippedSecondary;
    // Nicht-Kampf-Raeume behalten den Vorraum als Kulisse -- deren Zaehler
    // gehoeren nicht diesem Raum.
    if (run.roomType !== 'combat' && run.roomType !== 'elite') return;
    const st = run.state;
    if (!st) return;
    // Jeden Tick statt einmalig sampeln (Phase 9: Wellen koennen dem
    // Raum spaeter neue Panzer hinzufuegen -- st.tanks.length ist nicht
    // mehr ueber die ganze Raumdauer konstant).
    teleEnemies = st.tanks.slice(1).map((t) => ({ type: t.type, affixes: t.affixes || [] }));
    teleDmgType = { ...st.damageByType };
    teleSec = st.secondaryUses;
    telePowershots = st.powershotsFired;
    teleGhosts = st.ghostKills;
    teleModifier = st.modifier?.id || null;
    teleHazard = st.hazard?.type || null;
    teleShotsFired = st.playerShots;
    teleShotsHit = st.playerHits;
    teleMagBlocked = st.magBlockedTime;
  }

  function flushRoomTelemetry() {
    telemetry.recordRoom({
      room: teleRoom,
      roomType: teleRoomType,
      durationS: run.playTime - teleRoomStart,
      lives: run.lives,
      shieldCharges: teleShield,
      scrapEarned: run.scrapThisRoom,
      enemies: teleEnemies,
      minFps: teleMinFps === Infinity ? null : Math.round(teleMinFps),
      damageByType: teleDmgType,
      secondaryUses: teleSec,
      powershotsFired: telePowershots,
      secondary: teleSecondary,
      ghostKills: teleGhosts,
      modifier: teleModifier,
      hazard: teleHazard,
      shotsFired: teleShotsFired,
      shotsHit: teleShotsHit,
      magBlockedTime: teleMagBlocked,
    });
    run.scrapThisRoom = 0;
  }

  // Setzt das Tracking fuer einen frisch erstellten Run auf und startet
  // den Telemetrie-Sammelpuffer.
  function beginTelemetry() {
    teleRoom = run.roomIndex;
    teleRoomStart = run.playTime;
    teleEnded = false;
    resetRoomTelemetry();
    telemetry.beginRun({ seed: run.seed, mode: run.mode, secondary: 'mine' });
  }
  // Wird jeden Tick nach stepRun aufgerufen: Raumwechsel + Run-Ende.
  function updateTelemetry() {
    if (!run || teleEnded) return;
    // Raum abgeschlossen -> Dauer + Leben + Kennzahlen des ALTEN Raums.
    if (run.roomIndex !== teleRoom) {
      flushRoomTelemetry();
      teleRoom = run.roomIndex;
      teleRoomStart = run.playTime;
      resetRoomTelemetry();
    }
    sampleRoomTelemetry();
    if (run.phase === 'gameover' || run.phase === 'victory') {
      // Letzten (evtl. unvollstaendigen) Raum noch mitschreiben.
      flushRoomTelemetry();
      const st = run.state;
      telemetry.endRun({
        won: run.phase === 'victory',
        roomReached: run.roomIndex,
        deathCause: st.lastDeathCauseCode || null,
        deathCauseLabel: st.lastDeathCause || null,
        enemyType: st.lastDeathEnemyType || null,
        death: {
          bulletOwner: st.lastDeathBulletOwner || null,
          bulletDistanceTravelled: st.lastDeathBulletDistance ?? null,
        },
      });
      teleEnded = true;
    }
  }

  // Darstellungs-Optionen (gespeichert). Die Ziellinie kommt aus
  // data/options.json (Phase 0a), lokal per Schalter uebersteuerbar.
  renderOpts.threatLines = getPref('threatLines', true);
  renderOpts.reduceMotion = getPref('reduceMotion', false);
  renderOpts.aimLine = getPref('aimLine', optionsData.aimLine !== false);
  const optAim = document.getElementById('optAim');
  if (optAim) {
    optAim.checked = renderOpts.aimLine;
    optAim.addEventListener('change', () => {
      renderOpts.aimLine = optAim.checked;
      setPref('aimLine', optAim.checked);
    });
  }
  // Vorhaltemarkierung (Grundsteinumbau Phase 2), gleiches Muster wie aimLine.
  renderOpts.leadMarker = getPref('leadMarker', optionsData.leadMarker !== false);
  const optLead = document.getElementById('optLead');
  if (optLead) {
    optLead.checked = renderOpts.leadMarker;
    optLead.addEventListener('change', () => {
      renderOpts.leadMarker = optLead.checked;
      setPref('leadMarker', optLead.checked);
    });
  }
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

  // Testweg fuer die Arena-Weiche: ?arena=<name> laesst alle Kampfraeume
  // das feste Layout aus data/arenas.json nutzen statt zu generieren.
  const arenaName = new URLSearchParams(window.location.search).get('arena');
  const arenaSpec = arenaName ? { fixedLayout: arenaName } : null;

  // Alle Raum-Overlays verstecken + Anzeige-Flags zuruecksetzen.
  function hideRoomScreens() {
    upgradeScreen.hide();
    preview.hide();
    eventScreen.hide();
    workshopScreen.hide();
    mapScreen.hide();
    upgradeShown = false;
    previewShown = false;
    eventShown = false;
    workshopShown = false;
    mapShown = false;
  }

  // Sekundärslot (Phase 6): Touch-Button-Beschriftung der aktiven
  // Sekundärwaffe nachziehen (Start, Fortsetzen, nach jeder Kartenwahl).
  function updateSecondaryLabel() {
    if (!run) return;
    const label = tanksData.secondaries?.[run.equippedSecondary]?.label || 'BOMBE';
    touch.setSecondaryLabel(label);
    // P4: der Gadget-Knopf erscheint erst, wenn ueberhaupt eines
    // ausgeruestet ist (Startzustand: keines).
    touch.setGadgetLabel(run.equippedGadget ? tanksData.secondaries?.[run.equippedGadget]?.label || 'GADGET' : '');
  }

  // "Element: Feuer" -- Primaerelement der Klasse, Anzeigename aus status.json.
  // Grundsteinumbau Phase 4: das Zweitelement-System (UMBAUPLAN-LP Phase 17)
  // ist entfernt (archive/systeme-v1.md Abschnitt 2) -- nur noch die reine
  // Primaerelement-Zeile bleibt als Info stehen.
  function elementLineFor(run) {
    const dt = tanksData.status?.damageTypes || {};
    const nameOf = (id) => dt[id]?.name || id;
    const primary = tanksData.types[run.starterTank]?.damageType || 'physical';
    return `Element: ${nameOf(primary)}`;
  }

  function launchRun(seed, modeKey, resume) {
    run = createRun(tanksData, tilesData, diffData, upgradesData, seed, modeKey, {
      roomSpec: arenaSpec,
      resume: resume || null,
      starterTank, // Phase 9: bei Resume ueberschreibt der Snapshot (run.js)
    });
    lastSeed = seed;
    updateSecondaryLabel();
    beginTelemetry();
    startOverlay.classList.add('hidden');
    hideRoomScreens();
    pause.set(false); // frischer Run startet NIE pausiert (Portrait-Altlast)
    goFullscreen();
    requestWakeLock();
  }

  function startRun() {
    const raw = seedInput.value.trim();
    const seed = raw === '' ? Date.now() >>> 0 : Number(raw) >>> 0;
    seedInput.value = String(seed);
    // Ein neuer Run verwirft den gespeicherten Zwischenstand.
    clearCurrentRun();
    refreshResumeBtn();
    launchRun(seed, mode);
  }

  // "Run fortsetzen": gespeicherter Zustand vom letzten Raumanfang. Der Raum
  // selbst wird aus Seed + Raumnummer neu erzeugt (deterministisch), ein
  // mitten im Raum abgebrochener Versuch beginnt den Raum also von vorn.
  const resumeBtn = document.getElementById('resumeBtn');
  function refreshResumeBtn() {
    const saved = loadCurrentRun();
    if (!saved) {
      resumeBtn.classList.add('hidden');
      return;
    }
    resumeBtn.textContent = `Run fortsetzen (Raum ${saved.roomIndex}, ${saved.lives} ❤)`;
    resumeBtn.classList.remove('hidden');
  }
  resumeBtn.addEventListener('click', () => {
    const saved = loadCurrentRun();
    if (!saved) {
      refreshResumeBtn();
      return;
    }
    seedInput.value = String(saved.seed >>> 0);
    launchRun(saved.seed >>> 0, saved.modeKey || mode, saved);
  });
  refreshResumeBtn();

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

  // P2: manueller Vollbild-Umschalter im Startmenue. Nur sichtbar, wenn der
  // Browser Element-Vollbild ueberhaupt kann -- auf iOS gibt es das nicht,
  // dort waere der Knopf eine Sackgasse. Der automatische Aufruf beim
  // Run-Start (goFullscreen) bleibt unveraendert; dieser Knopf ist der
  // ausdrueckliche Weg fuer Desktop und Android. P9 haengt ihn zusaetzlich
  // an die Einstellungen.
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const canFullscreen = !!document.documentElement.requestFullscreen;
  function refreshFullscreenBtn() {
    if (!canFullscreen) return;
    fullscreenBtn.textContent = document.fullscreenElement ? 'Vollbild verlassen' : 'Vollbild';
  }
  if (canFullscreen) {
    fullscreenBtn.classList.remove('hidden');
    refreshFullscreenBtn();
    fullscreenBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    // Vollbild kann auch per F11/Escape wechseln -- Beschriftung nachziehen
    // und die Canvasgroesse neu rechnen (der Viewport aendert sich dabei).
    document.addEventListener('fullscreenchange', () => {
      refreshFullscreenBtn();
      viewport.update();
    });
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
    if (!run) {
      // P9: Startbildschirm -- Controller faehrt den Maus-Cursor (gamepadCursor),
      // Tastatur die diskrete Fokusnavigation. getMenuState() braucht keinen
      // Spieler (anders als getState()), funktioniert also schon vor dem
      // ersten Run.
      const m = input.getMenuState();
      if (!gamepadCursor(m, dt)) activeMenuNav.update(m, dt);
      return;
    }
    if (input.consumePause()) pause.toggle();

    // Ist ein In-Run-Overlay sichtbar (Upgrade/Karte/Shop/Event/Vorschau), wird
    // es per Controller-Cursor bzw. Tastatur bedient und die Spiellogik
    // pausiert dahinter -- genau wie der Startbildschirm oben. Maus/Touch
    // funktionieren parallel weiter.
    const runOverlay = visibleRunOverlay();
    if (runOverlay) {
      if (runOverlay !== lastRunOverlay) {
        runOverlayNav.reset();
        lastRunOverlay = runOverlay;
      }
      const m = input.getMenuState();
      if (!gamepadCursor(m, dt)) runOverlayNav.update(m, dt);
      return;
    }
    lastRunOverlay = null;
    // Im Spiel faehrt der linke Stick den Panzer -- kein Cursor.
    gpCursor.classList.add('hidden');

    if (pause.isPaused()) return;

    // EINZIGE Eingabequelle der Spiellogik: der vereinheitlichte Zustand.
    // Welches Geraet ihn erzeugt hat, ist hier bewusst nicht sichtbar.
    const p = run.state.player;
    const st = input.getState(p);
    const cmd = {
      move: st.move,
      aim: st.aim,
      fire: st.firing,
      // Frischer Abzug (Flanke) -- nur damit meldet ein durch das volle
      // Magazin blockierter Schuss sich zurueck (SPEC.md 9, Konflikt D).
      firePressed: st.primaryPressed,
      mine: st.secondary,
      mineThrow: st.secondaryThrow,
      // P4: zweiter Slot mit eigenem Ausloeser, eigener Zielvorgabe und
      // eigenem Zuend-Knopf (Fernzuender).
      gadget: st.gadgetRelease,
      gadgetThrow: st.gadgetAim,
      detonate: st.detonate,
      dash: st.dash,
    };
    // Virtuelle Sticks + Bomben-Button nur bei Touch einblenden.
    document.body.classList.toggle('touch-on', st.source === 'touch');
    // Dash-Button nur zeigen, wenn das Upgrade aktiv ist (und Touch spielt).
    const isTouch = st.source === 'touch';
    dashBtn.classList.toggle('hidden', !(p.cfg.dash && isTouch));
    stepRun(run, cmd, dt);
    updateTelemetry();
    toast = tutorial.update(run, cmd, isTouch, dt);
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
    // Sound-Ereignisse (Phase 7b): ortsgebundene melden sich als
    // { name, x } und werden im Stereobild platziert, globale (Raum
    // geraeumt, Upgrade, Fanfare) weiterhin als reiner Name.
    for (const ev of run.state.sounds.splice(0)) {
      const name = typeof ev === 'string' ? ev : ev.name;
      audio.play(name, typeof ev === 'string' ? null : ev.x);
      // Haptik: Touch-Vibration (Android) und Gamepad-Rumble.
      if (isTouch && navigator.vibrate) {
        if (name === 'boom') navigator.vibrate(60);
        else if (name === 'player_death') navigator.vibrate(40);
      }
      if (st.source === 'gamepad' && (name === 'boom' || name === 'player_death')) {
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

    // Upgrade-Screen genau einmal pro Angebot einblenden. Elite-/Treasure-
    // Belohnungen ohne Schrott-Aktionen, mit eigenem Titel.
    if (run.phase === 'upgrade' && !upgradeShown) {
      upgradeShown = true;
      const costs = run.data.balance.scrap.cost;
      const kind = run.rewardKind;
      const cardOf = (o) => ({ id: o.fallback ? null : o.id, name: o.name, tag: o.tag, rarity: o.rarity });
      upgradeScreen.show({
        costs,
        showActions: kind === 'normal' || kind == null,
        title:
          kind === 'elite'
            ? 'Elite-Beute'
            : kind === 'treasure'
              ? 'Schatzkammer'
              : kind === 'cursed'
                ? 'Verfluchte Beute'
                : 'Upgrade wählen',
        subtitle:
          kind === 'elite'
            ? 'Wähle eine Elite-Karte.'
            : kind === 'treasure'
              ? 'Ein garantiertes Legendär (Betreten kostete 1 Leben).'
              : kind === 'cursed'
                ? 'Ein garantiertes Legendär (Gegner hatten einen zusätzlichen Affix).'
                : null,
        getOffers: () => run.pendingOffers,
        getScrap: () => run.scrap,
        canFourth: () => run.pendingOffers.length < 4,
        // Transformationen (Phase 17): Fortschrittsanzeige im Screen.
        transformDefs: run.data.transformations?.transformations,
        tagCounts: run.tagCounts,
        unlocked: run.transformations,
        threshold: run.data.transformations?.threshold,
        hasDash: (run.upgrades.dash || 0) > 0,
        onPick: (idx) => {
          // Telemetrie: gewaehlte Karte + abgelehnte Alternativen (id + tag).
          const offers = run.pendingOffers;
          telemetry.recordUpgrade({
            chosen: cardOf(offers[idx]),
            rejected: offers.filter((_, i) => i !== idx).map(cardOf),
          });
          chooseUpgrade(run, idx);
          // Frisch freigeschaltete Transformation (Phase 17) kurz einblenden --
          // sonst verpufft die Mechanik unbemerkt.
          if (run.newTransformation) {
            const t = run.newTransformation;
            if (run.state) {
              run.state.texts.push({
                x: run.state.player.x,
                y: run.state.player.y - 40,
                text: `${t.symbol} ${t.name} freigeschaltet!`,
                age: 0,
                life: 2.0,
                color: '#ffd23c',
              });
            }
            run.newTransformation = null;
          }
          updateSecondaryLabel();
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

    // Ereignis-Raum (Phase 4).
    if (run.phase === 'event' && !eventShown) {
      eventShown = true;
      eventScreen.show({
        event: run.currentEvent,
        onChoose: (idx) => {
          const room = run.roomIndex;
          const res = chooseEventOption(run, idx);
          if (res) telemetry.recordEvent({ room, event: res.event, option: res.option });
          eventShown = false;
        },
      });
    }

    // Shop-Raum (Phase 4 als Werkstatt gebaut, Phase 13 zum Shop erweitert).
    if (run.phase === 'workshop' && !workshopShown) {
      workshopShown = true;
      const costs = run.data.balance.scrap.cost;
      const refund = run.data.balance.scrap.dropRefund;
      workshopScreen.show({
        upgradesData,
        secondariesData: tanksData.secondaries,
        costs,
        dropRefund: refund,
        getScrap: () => run.scrap,
        getUpgrades: () => run.upgrades,
        getOffers: () => run.shopOffers,
        getEquippedSecondary: () => run.equippedGadget, // P4: der Shop tauscht Gadgets
        // Nutzerwunsch: der Nekromant hat keinen Gadget-Slot -- die Sektion
        // "Gadget tauschen" soll fuer ihn erst gar nicht angezeigt werden
        // (buyShopSecondary() sperrt den Kauf zusaetzlich serverseitig).
        necromancer: !!tanksData.types[run.starterTank]?.necromancer,
        lifeBought: () => run.shopLifeBought,
        onBuyCard: (idx) => {
          const offer = run.shopOffers[idx];
          const ok = buyShopCard(run, idx);
          if (ok) {
            telemetry.recordScrapSpend({ room: run.roomIndex, type: 'shopCard', amount: costs.shopCard });
            // Gekaufte Karte wie eine gewaehlte protokollieren (ohne
            // abgelehnte Alternativen -- im Shop lehnt man nichts ab).
            telemetry.recordUpgrade({
              chosen: { id: offer.fallback ? null : offer.id, name: offer.name, tag: offer.tag, rarity: offer.rarity },
              rejected: [],
            });
            updateSecondaryLabel(); // Sekundärkarten wechseln die Waffe
            // Transformationen (Phase 17): auch ein Kartenkauf im Shop
            // zaehlt gegen den Tag-Fortschritt, siehe onPick oben.
            if (run.newTransformation) {
              const t = run.newTransformation;
              if (run.state) {
                run.state.texts.push({
                  x: run.state.player.x,
                  y: run.state.player.y - 40,
                  text: `${t.symbol} ${t.name} freigeschaltet!`,
                  age: 0,
                  life: 2.0,
                  color: '#ffd23c',
                });
              }
              run.newTransformation = null;
            }
          }
          return ok;
        },
        onBuyShield: () => {
          const ok = buyShieldCharge(run);
          if (ok) telemetry.recordScrapSpend({ room: run.roomIndex, type: 'shieldCharge', amount: costs.shieldCharge });
          return ok;
        },
        onBuySecondary: (id) => {
          const ok = buyShopSecondary(run, id);
          if (ok) {
            telemetry.recordScrapSpend({ room: run.roomIndex, type: 'shopSecondary', amount: costs.shopSecondary });
            updateSecondaryLabel();
          }
          return ok;
        },
        onBuyLife: () => {
          const ok = buyShopLife(run);
          if (ok) telemetry.recordScrapSpend({ room: run.roomIndex, type: 'shopLife', amount: costs.shopLife });
          return ok;
        },
        // Grundsteinumbau Phase 4: Zweitelement-Reroll entfernt (Zweitelement-
        // System selbst ist weg, archive/systeme-v1.md Abschnitt 2) --
        // roomscreens.js zeigt die Shop-Sektion nur bei gesetztem
        // onRerollElement, ohne den Callback bleibt sie unsichtbar.
        onDrop: (id) => {
          const ok = dropUpgrade(run, id);
          if (ok) telemetry.recordScrapSpend({ room: run.roomIndex, type: 'drop', amount: -refund });
          return ok;
        },
        onLeave: () => {
          leaveWorkshop(run);
          workshopShown = false;
        },
      });
    }

    // Kartenscreen (Phase 12): nur bei echter Verzweigung; sonst zieht
    // run.js automatisch weiter (kein Overlay dazwischen, wie der
    // "erzwungene Kampf" vor Phase 12).
    if (run.phase === 'map' && !mapShown) {
      mapShown = true;
      mapScreen.show({
        map: run.map,
        currentId: run.mapCurrentId,
        lives: run.lives,
        treasureLifeCost: run.difficulty.treasure.lifeCost,
        typeInfo: ROOM_TYPE_INFO,
        // Gibt zurueck, ob der Zug gueltig war -- der Kartenscreen schliesst
        // sich nur dann selbst (siehe mapscreen.js).
        onChoose: (nodeId) => {
          const ok = chooseMapNode(run, nodeId);
          if (ok) mapShown = false;
          return ok;
        },
      });
    }

    // Raumvorschau: Gegnerliste + "Weiter"-Button.
    if (run.phase === 'preview' && !previewShown) {
      previewShown = true;
      // Eigene Ausruestung mit Wirkungstext -- die Vorschau zeigt sie als
      // antippbare Chips (preview.js), wie die Gegner darueber.
      const ups = Object.entries(run.upgrades)
        .filter(([, l]) => l > 0)
        .map(([id, l]) => {
          const def = upgradesData.upgrades[id];
          return {
            name: def?.name || id,
            level: l,
            description: def?.description || '',
            symbol: def?.symbol || '•',
          };
        });
      const dangerByType = {};
      for (const [ty, d] of Object.entries(diffData.danger)) dangerByType[ty] = d.points;
      const baseTitle = run.endless
        ? `Endlos-Raum ${run.roomIndex}`
        : `Raum ${run.roomIndex}/${totalRooms(run.difficulty)}`;
      const affixSuffix = { elite: ' ★ ELITE', cursed: ' ☠️ VERFLUCHT' }[run.roomType];
      preview.show(
        {
          title: affixSuffix ? `${baseTitle}${affixSuffix}` : baseTitle,
          character:
            (run.roomType === 'elite' || run.roomType === 'cursed') && run.roomAffix
              ? `${run.roomCharacter} · Affix: ${run.roomAffix}`
              : run.roomCharacter,
          upgrades: ups,
          dangerByType,
          modifierLine: run.roomModifier
            ? `Modifikator: ${run.roomModifier.name} — ${run.roomModifier.desc}`
            : null,
          hazardLine: run.roomHazard
            ? `Gefahr: ${run.roomHazard.name} — ${run.roomHazard.desc}`
            : null,
          elementLine: elementLineFor(run),
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
    // P6: Zielwinkel des Gadgets fuer die Haken-Vorschau. Auf Touch nur
    // waehrend des Ziehens am Gadget-Stick (echte Zielphase); auf PC und
    // Controller gibt es keine Zielphase -- dort zeigt die Vorschau
    // dauerhaft in Blickrichtung, solange der Haken ausgeruestet ist.
    let gadgetAim = null;
    if (run.phase === 'playing' && run.state.player.cfg.gadget === 'hook') {
      const gp = input.getGadgetPreview();
      if (gp) gadgetAim = gp.angle;
      else if (!input.isGadgetAiming()) gadgetAim = run.state.player.turret;
    }
    renderer.render(
      run.state,
      alpha,
      tracks,
      run.phase === 'playing' ? input.getMinePreview() : null,
      gadgetAim,
    );
    if (input.isDebug() && run.phase === 'playing') {
      // Timing-Werte sind eine Frame-Anzeigeverzoegerung alt (timedRender()
      // aktualisiert sie erst NACH diesem Aufruf) -- fuer eine Debug-Anzeige
      // voellig ausreichend genau.
      debugOverlay.render(run.state, fps, { logicMs: lastFrameLogicMs, renderMs: lastFrameRenderMs, worstLogicMs, worstRenderMs });
    }
    hud.render(run, { paused: pause.isPaused(), toast, stats: input.isStats() });
    endlessBtn.classList.toggle('hidden', run.phase !== 'victory');

    frameCount++;
    const now = performance.now();
    if (now - fpsWindowStart >= 500) {
      fps = (frameCount * 1000) / (now - fpsWindowStart);
      frameCount = 0;
      fpsWindowStart = now;
      // Telemetrie: schlechtester 0,5-s-Schnitt im laufenden Raum (Ziel >= 50).
      if (run.phase === 'playing' && !teleEnded) teleMinFps = Math.min(teleMinFps, fps);
    }
  }

  // Frame-Budget-Messung (Phase 11b): kein Eingriff in core/loop.js noetig --
  // die Logikzeit summiert sich ueber ggf. mehrere update()-Aufrufe pro
  // echtem Frame (Aufholschritte), die Renderzeit ist ein einzelner Aufruf.
  let logicMsAccum = 0;
  let lastFrameLogicMs = 0;
  let lastFrameRenderMs = 0;
  function timedUpdate(dt) {
    const t0 = performance.now();
    update(dt);
    logicMsAccum += performance.now() - t0;
  }
  function timedRender(alpha) {
    const t0 = performance.now();
    render(alpha);
    lastFrameRenderMs = performance.now() - t0;
    lastFrameLogicMs = logicMsAccum;
    logicMsAccum = 0;
    if (run && run.phase === 'playing' && !teleEnded) {
      worstLogicMs = Math.max(worstLogicMs, lastFrameLogicMs);
      worstRenderMs = Math.max(worstRenderMs, lastFrameRenderMs);
    }
  }

  const loop = createLoop({ update: timedUpdate, render: timedRender, step: STEP });

  startBtn.addEventListener('click', startRun);
  // P9: Vollbild/Lautstaerke/Eingabeprofil/Reset/Beenden liegen auf einer
  // eigenen Seite (Muster P8: Ausruestungsseite) -- alle fuenf zusaetzlich
  // auf den Hauptbildschirm gepackt liess ihn im Handy-Querformat nicht
  // mehr ohne Scrollen passen (gemessen per tests/uilayout.mjs: 6-7
  // Bedienelemente unterhalb des sichtbaren Bereichs bei 667x375).
  const settingsOverlay = document.getElementById('settings');
  document.getElementById('settingsOpen').addEventListener('click', () => {
    startOverlay.classList.add('hidden');
    settingsOverlay.classList.remove('hidden');
    activeMenuNav = settingsMenuNav;
    settingsMenuNav.reset();
  });
  document.getElementById('settingsBack').addEventListener('click', () => {
    settingsOverlay.classList.add('hidden');
    startOverlay.classList.remove('hidden');
    activeMenuNav = startMenuNav;
    startMenuNav.reset();
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (window.confirm('Bestwerte wirklich löschen?')) {
      resetStats();
      refreshBestStats();
    }
  });
  // P9: "Spiel beenden" -- window.close() wirkt nur auf Tabs/Fenster, die
  // per Skript geoeffnet wurden (Sicherheitsvorgabe der Browser) oder in
  // einer installierten PWA; sonst passiert nach der Bestaetigung bewusst
  // nichts Sichtbares, statt eine Fehlermeldung zu zeigen. Gleiches
  // Bestaetigungsmuster wie "Bestwerte zuruecksetzen" (window.confirm).
  document.getElementById('quitBtn').addEventListener('click', () => {
    if (window.confirm('Spiel wirklich beenden?')) window.close();
  });
  // P9: Lautstaerkeregler statt reinem Mute. setPref speichert 0..100 (wie
  // im DOM), audio.setVolume erwartet 0..1.
  const volumeSlider = document.getElementById('volumeSlider');
  const initialVolume = getPref('volume', 100);
  volumeSlider.value = String(initialVolume);
  audio.setVolume(initialVolume / 100);
  volumeSlider.addEventListener('input', () => {
    const v = Number(volumeSlider.value);
    audio.setVolume(v / 100);
    setPref('volume', v);
  });
  // P9: Eingabeprofil-Override -- setProfile()/getProfile() stehen seit P1.
  // Knopfreihe statt <select>, gleiches Muster wie die Schwierigkeitswahl:
  // ein Klick setzt .active um und ruft input.setProfile().
  const profileRow = document.getElementById('profileSelect');
  const profileBtns = [...profileRow.children];
  function setProfileUI(name) {
    input.setProfile(name || null);
    setPref('inputProfile', name || '');
    for (const b of profileBtns) b.classList.toggle('active', (b.dataset.profile || '') === (name || ''));
  }
  for (const b of profileBtns) {
    b.addEventListener('click', () => setProfileUI(b.dataset.profile));
  }
  setProfileUI(getPref('inputProfile', ''));
  // P9: Tastatur-/Gamepad-Navigation auf Start- UND Einstellungsseite
  // (SPEC.md 9). Fokussierbare Elemente sind alle sichtbaren, nicht
  // deaktivierten Bedienelemente IN DOKUMENTORDNUNG -- eine feste
  // ID-Liste haette bei jeder spaeteren UI-Aenderung von Hand nachgezogen
  // werden muessen. `activeMenuNav` zeigt auf die gerade sichtbare Seite;
  // update(dt) ruft immer nur die aktive auf.
  const focusablesIn = (overlay) => () =>
    [...overlay.querySelectorAll('button, input')].filter(
      (el) => !el.classList.contains('hidden') && !el.disabled,
    );
  const startMenuNav = createMenuNav(focusablesIn(startOverlay));
  const settingsMenuNav = createMenuNav(focusablesIn(settingsOverlay));
  let activeMenuNav = startMenuNav;

  // Controller-/Tastatur-Navigation der IN-RUN-Overlays (nach dem Rundenstart):
  // Upgrade-Screen, Karte, Shop, Event, Raumvorschau + Ausruestungsseite. Die
  // waren bisher nur per Maus/Touch bedienbar -- mit Controller also "nicht
  // bedienbar". Dieselbe generische menunav wie der Startbildschirm, nur ueber
  // das gerade sichtbare Overlay (Prioritaet: die oberste Ausruestungsseite vor
  // der Vorschau darunter). Die Overlays werden von ihren Modulen bei der
  // Initialisierung erzeugt, existieren hier also.
  const RUN_OVERLAY_IDS = ['previewUpgrades', 'preview', 'upgrade', 'event', 'workshop', 'map'];
  function visibleRunOverlay() {
    for (const id of RUN_OVERLAY_IDS) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) return el;
    }
    return null;
  }
  // Fokusliste GENAU wie beim Startbildschirm (focusablesIn): nur sichtbare,
  // aktive Knoepfe/Eingaben -- OHNE offsetParent-Pruefung. Die haette in der
  // Vorschau (fixed-positioniertes Overlay) faelschlich fast alle Knoepfe
  // verworfen, sodass nur einer uebrig blieb und der Fokus nie wanderte. Da
  // visibleRunOverlay() bereits das EINE sichtbare Overlay liefert, reicht der
  // hidden/disabled-Filter auf dessen eigenen Knoepfen.
  // [data-navcard]: die Upgrade-/Shop-Karten sind KLICKBARE DIVs, keine
  // <button>s -- ohne diese Aufnahme erreichte der Controller nur die
  // Schrott-Knoepfe (Nutzermeldung "kann nur den Reroll ansteuern") und keine
  // einzige Karte. bothAxes: der linke Stick navigiert die Karten/Kartenknoten
  // auch mit LINKS/RECHTS, nicht nur hoch/runter.
  const runOverlayNav = createMenuNav(
    () => {
      const ov = visibleRunOverlay();
      if (!ov) return [];
      return [...ov.querySelectorAll('button, input, [data-navcard="1"]')].filter(
        (el) => !el.classList.contains('hidden') && !el.disabled,
      );
    },
    { bothAxes: true },
  );
  let lastRunOverlay = null;

  // Gamepad-Cursor (Nutzerwunsch): der linke Stick faehrt einen FREIEN Zeiger
  // ueber die Overlays -- wie eine Maus --, A klickt das Element darunter. Das
  // loest das wiederkehrende "Controller erreicht Element X nicht" universell:
  // es wird ein echtes Klick-Ereignis an der Cursorposition ausgeloest,
  // unabhaengig von der DOM-Struktur (Karten-DIVs, Kartenknoten, Knoepfe --
  // alles klickbar). Die diskrete Fokus-Navigation (menunav) bleibt fuer die
  // TASTATUR; sobald der Controller die Quelle ist, uebernimmt der Cursor.
  const gpCursor = document.createElement('div');
  gpCursor.id = 'gpCursor';
  gpCursor.classList.add('hidden');
  document.body.appendChild(gpCursor);
  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;
  const CURSOR_SPEED = 900; // Bildschirm-px/s bei vollem Stickausschlag
  // Gibt true zurueck, wenn der Cursor die Overlay-Eingabe uebernommen hat --
  // dann laeuft die diskrete Fokus-Navigation NICHT zusaetzlich.
  function gamepadCursor(menuState, dt) {
    const active = input.getSource() === 'gamepad';
    gpCursor.classList.toggle('hidden', !active);
    if (!active) return false;
    // Eine haengende Fokus-Markierung aus einer vorigen Tastatur-Sitzung
    // entfernen -- sonst leuchten Cursor UND Fokusrahmen gleichzeitig.
    for (const e of document.querySelectorAll('.menu-focus')) e.classList.remove('menu-focus');
    const s = menuState.stick || { x: 0, y: 0 };
    const w = window.innerWidth;
    const h = window.innerHeight;
    cursorX = Math.max(0, Math.min(w, cursorX + s.x * CURSOR_SPEED * dt));
    cursorY = Math.max(0, Math.min(h, cursorY + s.y * CURSOR_SPEED * dt));
    gpCursor.style.left = `${cursorX}px`;
    gpCursor.style.top = `${cursorY}px`;
    // A klickt: der Cursor ist pointer-events:none, elementFromPoint liefert
    // also das Element DARUNTER; click() bubbelt zu dessen Handler (Karten-DIV
    // oder Knopf).
    if (menuState.menuConfirm) {
      const el = document.elementFromPoint(cursorX, cursorY);
      el?.click?.();
    }
    return true;
  }

  // Phase 9: Klassenauswahl-Seite. Fuellt sich aus tanks.json (player:true),
  // zeigt Name/Werte/Beschreibung, merkt die Wahl in den Prefs.
  const classScreen = document.getElementById('classScreen');
  const classListEl = document.getElementById('classList');
  const classOpenBtn = document.getElementById('classOpen');
  const playerClasses = Object.entries(tanksData.types).filter(([, t]) => t.player);
  const refreshClassBtn = () => {
    classOpenBtn.textContent = `Klasse: ${tanksData.types[starterTank]?.label || 'Standard'} ▸`;
  };
  const fmtClassStats = (t) =>
    `LP ${t.maxHp} · Schaden ${t.damage} · Tempo ${Math.round((t.speedMult ?? 1) * 100)} % · Krit ${Math.round((t.crit ?? 0.05) * 100)} %`;
  function buildClassList() {
    classListEl.innerHTML = '';
    for (const [id, t] of playerClasses) {
      const b = document.createElement('button');
      b.dataset.class = id;
      b.classList.toggle('active', id === starterTank);
      const name = document.createElement('div');
      name.className = 'cl-name';
      name.textContent = t.label || id;
      const stats = document.createElement('div');
      stats.className = 'cl-stats';
      stats.textContent = fmtClassStats(t);
      const desc = document.createElement('div');
      desc.className = 'cl-desc';
      desc.textContent = t.desc || '';
      b.append(name, stats, desc);
      b.addEventListener('click', () => {
        starterTank = id;
        setPref('starterTank', id);
        for (const btn of classListEl.querySelectorAll('button'))
          btn.classList.toggle('active', btn.dataset.class === id);
        refreshClassBtn();
      });
      classListEl.appendChild(b);
    }
  }
  buildClassList();
  refreshClassBtn();
  const classMenuNav = createMenuNav(focusablesIn(classScreen));
  classOpenBtn.addEventListener('click', () => {
    startOverlay.classList.add('hidden');
    classScreen.classList.remove('hidden');
    activeMenuNav = classMenuNav;
    classMenuNav.reset();
  });
  document.getElementById('classBack').addEventListener('click', () => {
    classScreen.classList.add('hidden');
    startOverlay.classList.remove('hidden');
    activeMenuNav = startMenuNav;
    startMenuNav.reset();
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
    refreshResumeBtn(); // abgebrochener Run bleibt fortsetzbar
    startOverlay.classList.remove('hidden');
    settingsOverlay.classList.add('hidden'); // P9: falls noch offen -- defensiv
    classScreen.classList.add('hidden'); // Phase 9: Klassenseite ebenfalls schliessen
    seedInput.select();
    hideRoomScreens();
    endlessBtn.classList.add('hidden');
    run = null;
    // P9: Fokus zurueck auf den Anfang -- sonst haengt die Hervorhebung
    // auf einem Element, das beim letzten Besuch fokussiert war (z. B.
    // "Run fortsetzen", das jetzt vielleicht gar nicht mehr sichtbar ist).
    activeMenuNav = startMenuNav;
    startMenuNav.reset();
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
        clearCurrentRun();
        launchRun(lastSeed, mode);
      } else if (e.code === 'KeyM') {
        pause.set(false);
        backToStart();
      }
    }
    // UMBAUPLAN-LP Phase 5: Statuseffekte von Hand auftragen (NUR bei
    // ?debug=1). In dieser Phase haengt bewusst keine Quelle am System --
    // das ist der einzige Weg, es im laufenden Spiel auszuprobieren.
    // 1 = Feuer, 2 = Gift, 3 = Frost, jeweils eine Stufe auf den dem
    // Spieler naechsten lebenden Gegner (ohne Gegner: auf den Spieler).
    if (telemetry.isDebugEnabled() && run.phase === 'playing' && !pause.isPaused()) {
      // Taste 4 schaltet den Schadenstyp des Spielers durch (Phase 6) --
      // in dieser Phase setzt ihn sonst nichts, Klassen und Karten kommen
      // erst spaeter.
      if (e.code === 'Digit4') {
        const typen = Object.keys(run.state.data.status?.damageTypes || {});
        if (typen.length) {
          const p = run.state.player;
          const next = typen[(typen.indexOf(p.cfg.damageType || 'physical') + 1) % typen.length];
          p.cfg.damageType = next;
          run.state.texts.push({
            x: p.x, y: p.y - 30,
            text: `Schadenstyp: ${run.state.data.status.damageTypes[next].name}`,
            age: 0, life: 1.2, color: run.state.data.status.damageTypes[next].color || '#fff',
          });
        }
      }
      const STATUS_KEYS = { Digit1: 'fire', Digit2: 'poison', Digit3: 'frost' };
      const id = STATUS_KEYS[e.code];
      if (id) {
        const st = run.state;
        const p = st.player;
        let ziel = null;
        let best = Infinity;
        for (const t of st.tanks) {
          if (t === p || !t.alive) continue;
          const d = (t.x - p.x) ** 2 + (t.y - p.y) ** 2;
          if (d < best) {
            best = d;
            ziel = t;
          }
        }
        st.applyStatus(ziel || p, id, 1);
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
