// Einstellungs-Screen als wiederverwendbare Komponente (PLAN-STARTMENU
// Phase 4). Buendelt die INHALTE des #settings-Overlays (Sound, Eingabeprofil,
// Vollbild, Bestwerte zuruecksetzen, Spiel beenden) an einer Stelle, damit
// derselbe Screen sowohl aus dem Hauptmenue als auch aus dem Pause-Menue
// dient.
//
// Der Zurueck-PFAD ("from"-Kontext des Plans) wird NICHT hier entschieden,
// sondern vom Menue-Stack (ui/menu.js): wer den Screen per menu.show('settings')
// oeffnet, landet bei menu.back() automatisch wieder dort (Hauptmenue ODER
// Pause). Das kann per Konstruktion nicht auseinanderlaufen -- deshalb kein
// manueller from-Parameter. Diese Komponente kuemmert sich nur um den Inhalt.
//
// Sofortige Persistenz: jede Aenderung schreibt sofort in die Prefs (kein
// Gameplay aktiv), Musik/Effekte getrennt (audio.js: Master/Musik/SFX-Busse).

export function createSettings(deps) {
  const {
    doc,
    audio,
    input,
    getPref,
    setPref,
    resetStats,
    resetAllPrefs, // Phase 6: "auch Einstellungen zuruecksetzen"
    clearCurrentRun, // Phase 6: ein "Fortschritt zuruecksetzen" darf keinen alten Run anbieten
    onStatsReset, // Callback: Bestwerte-Anzeige neu zeichnen
    viewport, // fuer die Canvasgroesse nach Vollbildwechsel
    renderOpts, // Phase 6: Performance-Modus (render-seitig, siehe renderer.js)
    optionsData, // liefert den Standardwert fuer particleDrawFraction
    win = window,
  } = deps;

  // --- Sound: Gesamt / Musik / Effekte -----------------------------------
  // Regler liefern 0..100 (wie im DOM), Audio erwartet 0..1. 10%-Schritte.
  function wireVolume(id, prefKey, apply) {
    const el = doc.getElementById(id);
    if (!el) return;
    const initial = getPref(prefKey, 100);
    el.value = String(initial);
    apply(initial / 100);
    el.addEventListener('input', () => {
      const v = Number(el.value);
      apply(v / 100);
      setPref(prefKey, v);
    });
  }
  wireVolume('volMaster', 'volume', (v) => audio.setVolume(v));
  wireVolume('volMusic', 'musicVolume', (v) => audio.setMusicVolume(v));
  wireVolume('volSfx', 'sfxVolume', (v) => audio.setSfxVolume(v));

  // --- Eingabeprofil-Override (Knopfreihe, gleiches Muster wie P9) --------
  const profileRow = doc.getElementById('profileSelect');
  if (profileRow) {
    const profileBtns = [...profileRow.children];
    const setProfileUI = (name) => {
      input.setProfile(name || null);
      setPref('inputProfile', name || '');
      for (const b of profileBtns) b.classList.toggle('active', (b.dataset.profile || '') === (name || ''));
    };
    for (const b of profileBtns) b.addEventListener('click', () => setProfileUI(b.dataset.profile));
    setProfileUI(getPref('inputProfile', ''));
  }

  // --- Vollbild (nur wenn der Browser Element-Vollbild kann; iOS nicht) ---
  const fullscreenBtn = doc.getElementById('fullscreenBtn');
  const canFullscreen = !!doc.documentElement.requestFullscreen;
  const refreshFullscreenBtn = () => {
    if (fullscreenBtn) fullscreenBtn.textContent = doc.fullscreenElement ? 'Vollbild verlassen' : 'Vollbild';
  };
  if (fullscreenBtn && canFullscreen) {
    fullscreenBtn.classList.remove('hidden');
    refreshFullscreenBtn();
    fullscreenBtn.addEventListener('click', () => {
      if (doc.fullscreenElement) doc.exitFullscreen?.();
      else doc.documentElement.requestFullscreen?.().catch(() => {});
    });
    doc.addEventListener('fullscreenchange', () => {
      refreshFullscreenBtn();
      viewport?.update?.();
    });
  }

  // --- Grafik: Performance-Modus ------------------------------------------
  // Rein render-seitig (renderOpts.particleDrawFraction, effects.js:
  // drawParticles) -- laesst nur einen Teil der Partikel aus, die Simulation
  // (state.js: spawnParticles) bleibt unangetastet. Siehe Kommentar dort:
  // state.rng() ist derselbe Strom wie KI-Entscheidungen, ein Aendern der
  // SPAWN-Anzahl wuerde Seeds geraeteabhaengig machen.
  const perfCheckbox = doc.getElementById('optPerformance');
  if (perfCheckbox && renderOpts) {
    const lowFraction = optionsData?.performance?.particleDrawFraction ?? 0.3;
    const applyPerf = (on) => {
      renderOpts.particleDrawFraction = on ? lowFraction : 1;
    };
    const initial = getPref('performanceMode', false);
    perfCheckbox.checked = initial;
    applyPerf(initial);
    perfCheckbox.addEventListener('change', () => {
      setPref('performanceMode', perfCheckbox.checked);
      applyPerf(perfCheckbox.checked);
    });
  }

  // --- Fortschritt zuruecksetzen (zweistufig) ------------------------------
  // Erster Klick zeigt nur die Bestaetigungszeile, loescht nichts. Erst der
  // zweite, bewusste Klick auf "Ja, alles löschen" wirkt. "auch
  // Einstellungen" ist ein separater Haken (Default aus) -- die Plan-Vorgabe
  // "optional auch Einstellungen".
  const resetBtn = doc.getElementById('resetBtn');
  const resetConfirm = doc.getElementById('resetConfirm');
  const resetIncludeSettings = doc.getElementById('resetIncludeSettings');
  const resetYes = doc.getElementById('resetConfirmYes');
  const resetNo = doc.getElementById('resetConfirmNo');
  function showResetConfirm() {
    resetBtn?.classList.add('hidden');
    resetConfirm?.classList.remove('hidden');
  }
  function hideResetConfirm() {
    resetConfirm?.classList.add('hidden');
    resetBtn?.classList.remove('hidden');
    if (resetIncludeSettings) resetIncludeSettings.checked = false;
  }
  resetBtn?.addEventListener('click', showResetConfirm);
  resetNo?.addEventListener('click', hideResetConfirm);
  resetYes?.addEventListener('click', () => {
    resetStats();
    clearCurrentRun?.();
    if (resetIncludeSettings?.checked) resetAllPrefs?.();
    onStatsReset?.();
    // Ein voller Reload zeigt zuverlaessig den frischen Stand (Testschritt 5:
    // "laedt fehlerfrei mit frischem Save") -- ohne ihn muessten alle
    // Regler/Anzeigen einzeln von Hand auf ihre Defaults zurueckgesetzt
    // werden, mit demselben Fehlerrisiko wie bei der Init-Reihenfolge selbst.
    win.location?.reload?.();
  });

  // --- Spiel beenden (window.close wirkt nur auf per Skript geoeffnete
  //     Tabs / installierte PWAs; sonst passiert bewusst nichts Sichtbares) -
  const quitBtn = doc.getElementById('quitBtn');
  quitBtn?.addEventListener('click', () => {
    if (win.confirm('Spiel wirklich beenden?')) win.close();
  });

  return {
    el: doc.getElementById('settings'),
  };
}
