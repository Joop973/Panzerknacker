// Einheitliche Eingabe-Abstraktion (Phase 0a, erweitert in PLAN-INPUT.md P1).
//
// Diese Schicht ist die EINZIGE Stelle, die Geraete-Events liest. Die
// Spiellogik ruft nur getState() auf und weiss nicht, ob der Zustand von
// Touch, Maus/Tastatur oder Gamepad kommt.
//
// --- Aktionsmodell (InputState) ---------------------------------------
//   move            {x,y}   Fahrtrichtung (roh, -1..1 je Achse)
//   aim             {x,y}   Zielpunkt in Arena-Koordinaten
//   aimActive       bool    wird gerade aktiv gezielt (Stick ausgelenkt /
//                           Maus bewegt)? -- fuer Anzeigen, nicht fuers Feuern
//   primaryFire     bool    Dauerfeuer-Wunsch (Cooldown/Magazin gelten in
//                           der Spiellogik)
//   primaryPressed  bool    NEUE Flanke des Feuerwunsches (ein Frame lang).
//                           Nur damit laesst sich "Tastendruck ins volle
//                           Magazin" von gehaltenem Autofire unterscheiden
//                           (SPEC.md Abschnitt 9, Konflikt D).
//   secondaryHeld   bool    Sekundaerwaffe wird gerade gezielt (Halten)
//   secondaryRelease bool   Sekundaerwaffe ausloesen (EIN Frame)
//   secondaryAim    {angle,dist}|null  Zielvorgabe des Wurfsticks
//   gadgetHeld      bool    Gadget wird gerade gezielt (Halten)
//   gadgetRelease   bool    Gadget ausloesen (EIN Frame)
//   gadgetAim       {angle,dist}|null  Zielvorgabe des Gadget-Wurfsticks
//   detonate        bool    Bombe zuenden (EIN Frame)
//   dash            bool    Ausweich-Dash (EIN Frame)
//   menuDir         {x,y}   Menue-Navigation (D-Pad/Pfeiltasten, EIN Frame)
//   menuConfirm     bool    Menue bestaetigen (EIN Frame)
//   source          'touch' | 'keyboard' | 'gamepad'
//
// Alle "EIN Frame"-Flags werden beim Auslesen in getState() verbraucht.
//
// --- Drei Profile ------------------------------------------------------
// profileTouch / profileGamepad / profileKeyboardMouse schreiben JEDES nur
// in denselben InputState. Welches gewinnt, entscheidet die zuletzt benutzte
// Quelle (source) bzw. ein manueller Override (setProfile).
//
// Belegungen, Deadzones und Reichweiten kommen aus data/input.json.

import { WIDTH, HEIGHT } from '../config.js';

const EMPTY_AIM = null;

export function createInput(target, canvas, opts = {}) {
  // Alle Stellwerte aus data/input.json. Die ?? -Werte sind reine
  // Absturzsicherungen, falls die Datei fehlt -- kein Tuning-Ort.
  const cfg = opts.inputCfg || {};
  const touch = opts.touch || null; // Touch-Treiber (ui/touchcontrols.js)
  const stickCfg = cfg.stick || {};
  const keys = cfg.keyboard || {};
  const pad = cfg.gamepad || {};
  const padAxes = pad.axes || { moveX: 0, moveY: 1, aimX: 2, aimY: 3 };
  const deadzone = stickCfg.deadzone ?? 0.15;
  const reachPx = cfg.aim?.reachPx ?? 120;

  const has = (list, code) => Array.isArray(list) && list.includes(code);

  const pressed = new Set();
  const mouse = { x: WIDTH / 2, y: 0, held: false, moved: false };
  let manualProfile = null; // 'touch'|'keyboard'|'gamepad' -- Override aus den Einstellungen
  let source = 'keyboard';
  let debug = false;
  let stats = false; // P7: Werte-Anzeige eingeblendet?
  let wasFiring = false; // fuer die Feuer-Flanke (primaryPressed)

  // Flankengetriggerte Wuensche, die zwischen zwei getState()-Aufrufen
  // anfallen. Werden beim Auslesen verbraucht.
  const queued = {
    secondary: false,
    gadget: false,
    detonate: false,
    dash: false,
    pause: false,
    menuConfirm: false,
    menuX: 0,
    menuY: 0,
  };

  function markSource(s) {
    if (!manualProfile) source = s;
  }

  // Bildschirm- in ARENA-Koordinaten (768x512). Bewusst gegen die festen
  // Logikmasse gerechnet, NICHT gegen canvas.width/height: seit P2 ist der
  // Backing-Store devicePixelRatio-fach groesser, canvas.width waere also
  // je nach Geraet das 2-fache der Arenabreite -- der Zielpunkt laege dann
  // weit ausserhalb des Raums.
  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (WIDTH / rect.width),
      y: (e.clientY - rect.top) * (HEIGHT / rect.height),
    };
  }

  // ---- Rohe Geraete-Events (nur hier!) --------------------------------
  function onKeyDown(e) {
    if (has(keys.debug, e.code)) {
      e.preventDefault(); // F1 oeffnet sonst die Browser-Hilfe
      if (!e.repeat) debug = !debug;
      return;
    }
    if (has(keys.secondary, e.code)) {
      e.preventDefault(); // Leertaste scrollt sonst die Seite
      if (!e.repeat) {
        queued.secondary = true;
        markSource('keyboard');
      }
      return;
    }
    if (has(keys.gadget, e.code)) {
      if (!e.repeat) {
        queued.gadget = true;
        markSource('keyboard');
      }
      return;
    }
    if (has(keys.detonate, e.code)) {
      if (!e.repeat) {
        queued.detonate = true;
        markSource('keyboard');
      }
      return;
    }
    if (has(keys.pause, e.code)) {
      if (!e.repeat) queued.pause = true;
      return;
    }
    if (has(keys.menuConfirm, e.code)) {
      if (!e.repeat) queued.menuConfirm = true;
      return;
    }
    // P7: Werte-Anzeige umschalten. Tab wuerde sonst den Fokus wandern
    // lassen -- der Wechsel gehoert ins Spiel, nicht in die Seite.
    if (has(keys.stats, e.code)) {
      e.preventDefault();
      if (!e.repeat) stats = !stats;
      return;
    }
    if (has(keys.dash, e.code)) {
      if (!e.repeat) queued.dash = true;
      return;
    }
    pressed.add(e.code);
    markSource('keyboard');
    if (e.code.startsWith('Arrow')) e.preventDefault(); // sonst scrollt die Seite
  }
  function onKeyUp(e) {
    pressed.delete(e.code);
  }
  function onBlur() {
    // Fokusverlust: alle Tasten loslassen, sonst "klebt" der Panzer.
    pressed.clear();
    mouse.held = false;
  }
  function onMouseMove(e) {
    const p = toCanvas(e);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.moved = true;
    markSource('keyboard');
  }
  function onMouseDown(e) {
    // Klicks auf UI-Elemente (Buttons, Overlays) sind keine Schuesse.
    if (e.target.closest && e.target.closest('button, input, .overlay')) return;
    const p = toCanvas(e);
    mouse.x = p.x;
    mouse.y = p.y;
    if (e.button === 0) mouse.held = true; // links gehalten = Dauerfeuer
    if (e.button === 2) queued.secondary = true; // rechts = Sekundaerwaffe
    markSource('keyboard');
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.held = false;
  }
  function onContextMenu(e) {
    // Rechtsklick ist die Sekundaerwaffe -- kein Browser-Menue darueber.
    if (e.target.closest && e.target.closest('canvas')) e.preventDefault();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  target.addEventListener('mousemove', onMouseMove);
  target.addEventListener('mousedown', onMouseDown);
  target.addEventListener('mouseup', onMouseUp);
  target.addEventListener('contextmenu', onContextMenu);

  // ---- Gamepad: gepollt, nicht eventbasiert ---------------------------
  const gpPrev = {}; // Button-Index -> war im letzten Frame gedrueckt?
  function pollGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    let gp = null;
    for (const p of navigator.getGamepads()) {
      if (p && p.connected) {
        gp = p;
        break;
      }
    }
    if (!gp) {
      for (const k in gpPrev) gpPrev[k] = false;
      return null;
    }
    const down = (idx) => idx != null && !!gp.buttons[idx]?.pressed;
    // Flanke: jetzt gedrueckt, im letzten Frame nicht.
    // Das Ergebnis wird PRO POLL gemerkt (edgeSeen): derselbe Knopf darf
    // zwei Aktionen belegen (A = Sekundaer im Spiel, Bestaetigen im Menue).
    // Ohne den Cache wuerde der zweite edge()-Aufruf false liefern, weil der
    // erste gpPrev schon aktualisiert hat.
    const edgeSeen = {};
    const edge = (idx) => {
      if (idx == null) return false;
      if (idx in edgeSeen) return edgeSeen[idx];
      const now = down(idx);
      const was = !!gpPrev[idx];
      gpPrev[idx] = now;
      edgeSeen[idx] = now && !was;
      return edgeSeen[idx];
    };
    const dz = (v) => (Math.abs(v) < deadzone ? 0 : v);
    const move = { x: dz(gp.axes[padAxes.moveX] || 0), y: dz(gp.axes[padAxes.moveY] || 0) };
    const ax = dz(gp.axes[padAxes.aimX] || 0);
    const ay = dz(gp.axes[padAxes.aimY] || 0);
    const aimLen = Math.hypot(ax, ay);
    const dpad = pad.dpad || {};
    const out = {
      move,
      aimDir: aimLen > deadzone ? { x: ax, y: ay } : null,
      // Doktrin (SPEC.md 9): Auf dem Controller zielt der Stick NUR --
      // gefeuert wird ausschliesslich mit dem Trigger, kein Autofire.
      fireHeld: down(pad.primaryFire),
      firePressed: edge(pad.primaryFire),
      secondaryHeld: down(pad.secondary),
      // A-Knopf als Zweitbelegung: kurzer Druck loest sofort aus (kein
      // Zielen ueber Halten). Deckt die alte Belegung aus Phase 0a ab.
      secondaryAlt: edge(pad.secondaryAlt),
      secondaryRelease: false, // unten aus der Flanke abgeleitet
      gadgetHeld: down(pad.gadget),
      gadgetRelease: false,
      detonate: edge(pad.detonate),
      dash: edge(pad.dash),
      pause: edge(pad.pause),
      menuConfirm: edge(pad.menuConfirm),
      menuDir: {
        x: (edge(dpad.right) ? 1 : 0) - (edge(dpad.left) ? 1 : 0),
        y: (edge(dpad.down) ? 1 : 0) - (edge(dpad.up) ? 1 : 0),
      },
      dpadMove: {
        x: (down(dpad.right) ? 1 : 0) - (down(dpad.left) ? 1 : 0),
        y: (down(dpad.down) ? 1 : 0) - (down(dpad.up) ? 1 : 0),
      },
    };
    // Menue-Navigation: GEHALTENE Richtung aus D-Pad ODER linkem Stick (nicht
    // nur die Flanke). menunav.js macht daraus die Wiederholung (erst ein
    // Schritt, dann Auto-Repeat, solange gehalten) -- so wie die Tastatur.
    // Die Doktrin (SPEC.md 9) nennt fuer Menues das D-Pad; der Stick kommt
    // bewusst als Zusatz dazu, weil praktisch jeder Controller-Nutzer Menues
    // mit dem linken Stick bedient. Eigene, hoehere Schwelle als die
    // Fahr-Deadzone, damit ein leicht ausgelenkter Stick nicht scrollt.
    const mt = stickCfg.menuThreshold ?? 0.5;
    const q = (v) => (v > mt ? 1 : v < -mt ? -1 : 0);
    out.menuAxis = {
      x: (down(dpad.right) ? 1 : 0) - (down(dpad.left) ? 1 : 0) || q(move.x),
      y: (down(dpad.down) ? 1 : 0) - (down(dpad.up) ? 1 : 0) || q(move.y),
    };
    // Release = die fallende Flanke der Halte-Tasten (Doktrin: zielen und
    // ausloesen sind auf dem Controller getrennt, ausgeloest wird beim
    // Loslassen wie auf dem Handy).
    out.secondaryRelease = !out.secondaryHeld && !!gpPrev._secHeld;
    out.gadgetRelease = !out.gadgetHeld && !!gpPrev._gadHeld;
    gpPrev._secHeld = out.secondaryHeld;
    gpPrev._gadHeld = out.gadgetHeld;
    if (move.x || move.y || out.aimDir || out.fireHeld || out.secondaryHeld || out.dpadMove.x || out.dpadMove.y) {
      markSource('gamepad');
    }
    return out;
  }

  function keyboardMove() {
    let x = 0;
    let y = 0;
    if ([...pressed].some((c) => has(keys.left, c))) x -= 1;
    if ([...pressed].some((c) => has(keys.right, c))) x += 1;
    if ([...pressed].some((c) => has(keys.up, c))) y -= 1;
    if ([...pressed].some((c) => has(keys.down, c))) y += 1;
    return { x, y };
  }

  // ---- Die drei Profile ------------------------------------------------
  // Jedes schreibt NUR in den uebergebenen InputState. Reihenfolge in
  // getState(): Touch < Gamepad < Tastatur/Maus -- die zuletzt tatsaechlich
  // benutzte Quelle setzt sich durch.

  function profileTouch(st, player) {
    if (!touch || !touch.isActive()) return;
    if (touch.hasContact && touch.hasContact()) markSource('touch');
    const tMove = touch.getMove();
    if (tMove.x || tMove.y) st.move = tMove;
    const tAim = touch.getAimVector(); // { x, y, mag } normalisiert
    if (tAim) {
      st.aim = { x: player.x + tAim.x * reachPx, y: player.y + tAim.y * reachPx };
      st.aimActive = true;
      // Mobil: Zielen und Feuern sind derselbe Vorgang (Doktrin, Punkt 1).
      // Reines Autofire ab Deadzone; bei twoZone erst ab fireThreshold.
      st.primaryFire = stickCfg.twoZone ? tAim.mag >= (stickCfg.fireThreshold ?? 0.6) : true;
    }
    // Wurfstick: Halten zielt, Loslassen loest aus (consumeThrow liefert
    // den Wurf genau einmal, beim Loslassen).
    const thrown = touch.consumeThrow();
    if (thrown) {
      st.secondaryRelease = true;
      st.secondaryAim = thrown;
    }
    if (touch.isSecondaryHeld && touch.isSecondaryHeld()) st.secondaryHeld = true;
    if (touch.consumeSecondary()) st.secondaryRelease = true;
    // P4: der Gadget-Wurfstick ist baugleich -- Halten zielt, Loslassen
    // loest aus.
    const gThrown = touch.consumeGadgetThrow?.();
    if (gThrown) {
      st.gadgetRelease = true;
      st.gadgetAim = gThrown;
    }
    if (touch.isGadgetHeld?.()) st.gadgetHeld = true;
  }

  function profileGamepad(st, player, gp) {
    if (!gp) return;
    // D-Pad faehrt im Raum (Doktrin, Punkt 4) -- der linke Stick hat Vorrang.
    if (gp.move.x || gp.move.y) st.move = gp.move;
    else if (gp.dpadMove.x || gp.dpadMove.y) st.move = gp.dpadMove;
    if (gp.aimDir) {
      st.aim = { x: player.x + gp.aimDir.x * reachPx, y: player.y + gp.aimDir.y * reachPx };
      st.aimActive = true;
    }
    if (gp.fireHeld) st.primaryFire = true;
    if (gp.firePressed) st.primaryPressed = true;
    if (gp.secondaryHeld) st.secondaryHeld = true;
    if (gp.secondaryRelease || gp.secondaryAlt) st.secondaryRelease = true;
    if (gp.gadgetHeld) st.gadgetHeld = true;
    if (gp.gadgetRelease) st.gadgetRelease = true;
    if (gp.detonate) st.detonate = true;
    if (gp.dash) st.dash = true;
    if (gp.menuConfirm) st.menuConfirm = true;
    if (gp.menuDir.x || gp.menuDir.y) st.menuDir = gp.menuDir;
    // Start/Options: dieselbe Warteschlange wie die Tastatur-Pause, damit
    // consumePause() nur eine Quelle kennt.
    if (gp.pause) queued.pause = true;
  }

  function profileKeyboardMouse(st) {
    const kb = keyboardMove();
    if (kb.x || kb.y) st.move = kb;
    // Die Maus zielt nur, wenn nicht schon ein Stick aktiv gezielt hat --
    // sonst wuerde der (immer vorhandene) Zeiger Touch und Gamepad
    // ueberschreiben. Prioritaet damit wie bisher: Gamepad > Touch > Maus.
    if (!st.aimActive) {
      st.aim = { x: mouse.x, y: mouse.y };
      if (mouse.moved) st.aimActive = true;
    }
    if (mouse.held) st.primaryFire = true;
    // Menue-Navigation ueber dieselben Pfeiltasten, die auch fahren.
    if (kb.x || kb.y) st.menuDir = { x: kb.x, y: kb.y };
  }

  return {
    // Einheitlicher Eingabezustand. player = { x, y } (fuer stickbasiertes
    // Zielen, das relativ zum Panzer arbeitet).
    getState(player) {
      const gp = pollGamepad();

      const st = {
        move: { x: 0, y: 0 },
        aim: { x: mouse.x, y: mouse.y },
        aimActive: false,
        primaryFire: false,
        primaryPressed: false,
        secondaryHeld: false,
        secondaryRelease: false,
        secondaryAim: EMPTY_AIM,
        gadgetHeld: false,
        gadgetRelease: false,
        gadgetAim: EMPTY_AIM,
        detonate: false,
        dash: false,
        menuDir: { x: 0, y: 0 },
        menuConfirm: false,
        source,
      };

      // Reihenfolge: die spaetere Quelle ueberschreibt nur, was sie
      // tatsaechlich meldet (jedes Profil schreibt nur bei echtem Input).
      profileTouch(st, player);
      profileGamepad(st, player, gp);
      profileKeyboardMouse(st);

      // Flankengetriggerte Wuensche aus den Event-Handlern einmischen und
      // verbrauchen (Ein-Frame-Flags).
      if (queued.secondary) st.secondaryRelease = true;
      if (queued.gadget) st.gadgetRelease = true;
      if (queued.detonate) st.detonate = true;
      if (queued.dash) st.dash = true;
      if (queued.menuConfirm) st.menuConfirm = true;
      queued.secondary = false;
      queued.gadget = false;
      queued.detonate = false;
      queued.dash = false;
      queued.menuConfirm = false;

      // Feuer-Flanke fuer Maus/Touch nachziehen (der Gamepad-Zweig setzt sie
      // selbst). Braucht die Spiellogik, um einen frischen Tastendruck ins
      // volle Magazin von gehaltenem Dauerfeuer zu unterscheiden.
      if (st.primaryFire && !wasFiring) st.primaryPressed = true;
      wasFiring = st.primaryFire;

      st.source = source;

      // --- Rueckwaertskompatible Aliase --------------------------------
      // Die Spiellogik (main.js -> stepRun) nutzt weiterhin diese Namen.
      // Bewusst beibehalten, damit P1 keine Verhaltensaenderung ist.
      st.firing = st.primaryFire;
      st.secondary = st.secondaryRelease;
      st.secondaryThrow = st.secondaryAim;
      return st;
    },
    // P9: Menue-Navigation OHNE Spieler (Startbildschirm, vor dem ersten
    // Run). getState() braucht ein player-Objekt fuer stickbasiertes Zielen
    // -- Menuenavigation nicht, deshalb ein eigener, schlanker Poll.
    // Tastatur liefert menuDir ueber dieselben Pfeiltasten/WASD-Codes wie
    // die Fahrsteuerung (data/input.json), Gamepad ueber das D-Pad.
    // SPEC.md 9: "Menü navigieren: Touch = Touch (direktes Antippen),
    // Controller = D-Pad, PC = Maus/Pfeiltasten" -- Touch tippt Knoepfe
    // direkt an und braucht diesen Kanal nicht.
    getMenuState() {
      const gp = pollGamepad();
      const kb = keyboardMove();
      // GEHALTENE Gamepad-Richtung (Stick + D-Pad, menuAxis) hat Vorrang, sonst
      // die Tastatur. Beide sind gehalten -> menunav.js macht die Wiederholung.
      const gpDir = gp?.menuAxis;
      const menuDir = gpDir && (gpDir.x || gpDir.y) ? gpDir : kb;
      const menuConfirm = !!(queued.menuConfirm || gp?.menuConfirm);
      queued.menuConfirm = false;
      return { menuDir, menuConfirm };
    },
    // Esc / P / Gamepad-Start (einmal pro Druck). Die Gamepad-Flanke legt
    // profileGamepad() in dieselbe Warteschlange -- hier nur auslesen.
    consumePause() {
      const p = queued.pause;
      queued.pause = false;
      return p;
    },
    queueDash() {
      queued.dash = true;
    },
    // Manueller Profil-Override aus den Einstellungen (P9 verdrahtet die UI).
    // null = automatische Erkennung.
    setProfile(name) {
      manualProfile = name || null;
      if (manualProfile) source = manualProfile;
    },
    getProfile() {
      return manualProfile;
    },
    // Nur bei Touch werden die virtuellen Sticks eingeblendet.
    getSource() {
      return source;
    },
    // Live-Vorschau des Bombenwurfs (Rendering); null ohne Touch-Zug.
    getMinePreview() {
      return touch ? touch.getMinePreview() : null;
    },
    // P6: getrennte Vorschau des Gadgetslots -- der Haken zeichnet eine
    // Linie, die EMP-Bombe einen Wurfbogen.
    getGadgetPreview() {
      return touch ? touch.getGadgetPreview?.() : null;
    },
    // Wird gerade auf das Gadget gezielt? Auf Touch das Halten des
    // Wurfsticks; auf PC/Controller gibt es keine Zielphase, dort zeigt die
    // Vorschau dauerhaft (siehe main.js).
    isGadgetAiming() {
      return !!touch?.isGadgetHeld?.();
    },
    isDebug() {
      return debug;
    },
    // P7: Werte-Anzeige (Tab). Auf dem Handy uebernimmt die Pause diese
    // Rolle -- dort ist die Anzeige immer eingeblendet (siehe hud.js).
    isStats() {
      return stats;
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('mousemove', onMouseMove);
      target.removeEventListener('mousedown', onMouseDown);
      target.removeEventListener('mouseup', onMouseUp);
      target.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
