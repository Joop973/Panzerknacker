// Einstiegspunkt (Spec Abschnitt 3: main.js).
//
// Laedt die Daten aus /data/*.json, zeigt den Start-Screen mit
// Seed-Eingabe und verdrahtet Loop, Eingabe, Run-Controller, Renderer,
// Reifenspuren, HUD und Debug-Overlay.

import { STEP, WIDTH } from './config.js';
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
  const names = ['tanks', 'tiles', 'difficulty', 'upgrades', 'balance', 'events', 'input', 'options', 'arenas', 'transformations', 'secondaries', 'modifiers', 'limits', 'sounds'];
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
  const [tanksData, tilesData, diffData, upgradesData, balanceData, eventsData, inputCfg, optionsData, arenasData, transformData, secondariesData, modifiersData, limitsData, soundsData] =
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
  // Feste Layouts EINMALIG beim Laden pruefen (Flood-Fill etc.). Ein
  // unloesbares Layout meldet sich hier mit klarer Meldung statt spaeter
  // im laufenden Spiel.
  validateArenas(arenasData);
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
  let teleRic = 0;
  let teleDir = 0;
  let teleVol = 0; // USP-Kennzahl 3: freiwillige Abpraller-Kills
  let teleSec = 0;
  let telePowershots = 0;
  let teleSecondary = 'mine';
  let teleGhosts = 0;
  let teleModifier = null;
  let teleHazard = null;
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
    teleRic = 0;
    teleDir = 0;
    teleVol = 0;
    teleSec = 0;
    telePowershots = 0;
    worstLogicMs = 0;
    worstRenderMs = 0;
    teleGhosts = 0;
    teleModifier = null;
    teleHazard = null;
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
    teleRic = st.ricochetKills;
    teleDir = st.directKills;
    teleVol = st.voluntaryRicochetKills;
    teleSec = st.secondaryUses;
    telePowershots = st.powershotsFired;
    teleGhosts = st.ghostKills;
    teleModifier = st.modifier?.id || null;
    teleHazard = st.hazard?.type || null;
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
      ricochetKills: teleRic,
      directKills: teleDir,
      voluntaryRicochetKills: teleVol,
      secondaryUses: teleSec,
      powershotsFired: telePowershots,
      secondary: teleSecondary,
      ghostKills: teleGhosts,
      modifier: teleModifier,
      hazard: teleHazard,
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
          bulletRicochets: st.lastDeathBulletRicochets ?? null,
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
  }

  function launchRun(seed, modeKey, resume) {
    run = createRun(tanksData, tilesData, diffData, upgradesData, seed, modeKey, {
      roomSpec: arenaSpec,
      resume: resume || null,
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
    if (input.consumePause()) pause.toggle();
    if (pause.isPaused()) return;

    // EINZIGE Eingabequelle der Spiellogik: der vereinheitlichte Zustand.
    // Welches Geraet ihn erzeugt hat, ist hier bewusst nicht sichtbar.
    const p = run.state.player;
    const st = input.getState(p);
    const cmd = {
      move: st.move,
      aim: st.aim,
      fire: st.firing,
      mine: st.secondary,
      mineThrow: st.secondaryThrow,
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
        getEquippedSecondary: () => run.equippedSecondary,
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
          return { name: def?.name || id, level: l, description: def?.description || '' };
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
    renderer.render(run.state, alpha, tracks, run.phase === 'playing' ? input.getMinePreview() : null);
    if (input.isDebug() && run.phase === 'playing') {
      // Timing-Werte sind eine Frame-Anzeigeverzoegerung alt (timedRender()
      // aktualisiert sie erst NACH diesem Aufruf) -- fuer eine Debug-Anzeige
      // voellig ausreichend genau.
      debugOverlay.render(run.state, fps, { logicMs: lastFrameLogicMs, renderMs: lastFrameRenderMs, worstLogicMs, worstRenderMs });
    }
    hud.render(run, { paused: pause.isPaused(), toast });
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
    refreshResumeBtn(); // abgebrochener Run bleibt fortsetzbar
    startOverlay.classList.remove('hidden');
    seedInput.select();
    hideRoomScreens();
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
        clearCurrentRun();
        launchRun(lastSeed, mode);
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
