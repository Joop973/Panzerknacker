// Einheitliche Eingabe-Abstraktion (Phase 0a).
//
// Diese Schicht ist die EINZIGE Stelle, die Geraete-Events liest. Die
// Spiellogik ruft nur getState() auf und weiss nicht, ob der Zustand von
// Touch, Maus/Tastatur oder Gamepad kommt.
//
// Einheitlicher Zustand:
//   move      {x,y}  Fahrtrichtung (roh, -1..1 je Achse)
//   aim       {x,y}  Zielpunkt in Arena-Koordinaten
//   firing    bool   Dauerfeuer-Wunsch (Cooldown/Magazin gelten in der Logik)
//   secondary bool   Sekundaerwaffe (Mine), FLANKENGETRIGGERT
// Zusatzkanaele des Projekts (bestehende Features, gleiche Schicht):
//   secondaryThrow {angle,dist}|null  Touch-Wurfstick (Wurfweite)
//   dash      bool   Ausweich-Dash (flankengetriggert)
//
// Quellen-Erkennung laeuft automatisch: die zuletzt benutzte Eingabeart
// gewinnt (source), damit das HUD die virtuellen Sticks nur bei Touch zeigt.
//
// Werte aus data/input.json: stick.deadzone, stick.twoZone,
// stick.fireThreshold, player.fireRate.

export function createInput(target, canvas, opts = {}) {
  // Alle Stellwerte kommen aus data/input.json. Die ?? -Werte sind reine
  // Absturzsicherungen, falls die Datei fehlt -- kein Tuning-Ort.
  const cfg = opts.inputCfg || {};
  const touch = opts.touch || null; // Touch-Treiber (ui/touchcontrols.js)
  const stickCfg = cfg.stick || {};
  const deadzone = stickCfg.deadzone ?? 0.15;

  const pressed = new Set();
  const aim = { x: canvas.width / 2, y: 0 }; // Mauszeiger in Arena-Koordinaten
  let mouseHeld = false; // Linksklick gehalten -> firing
  let secondaryQueued = false;
  let pauseQueued = false;
  let dashQueued = false;
  let debug = false;
  let source = 'keyboard'; // 'touch' | 'keyboard' | 'gamepad'

  function markSource(s) {
    source = s;
  }

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onKeyDown(e) {
    if (e.code === 'F1') {
      e.preventDefault(); // F1 oeffnet sonst die Browser-Hilfe
      if (!e.repeat) debug = !debug;
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault(); // Leertaste scrollt sonst die Seite
      if (!e.repeat) {
        secondaryQueued = true;
        markSource('keyboard');
      }
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) pauseQueued = true;
      return;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (!e.repeat) dashQueued = true;
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
    mouseHeld = false;
  }
  function onMouseMove(e) {
    const p = toCanvas(e);
    aim.x = p.x;
    aim.y = p.y;
    markSource('keyboard');
  }
  function onMouseDown(e) {
    if (e.button !== 0) return;
    // Klicks auf UI-Elemente (Buttons, Overlays) sind keine Schuesse.
    if (e.target.closest && e.target.closest('button, input, .overlay')) return;
    const p = toCanvas(e);
    aim.x = p.x;
    aim.y = p.y;
    mouseHeld = true; // gehalten = Dauerfeuer
    markSource('keyboard');
  }
  function onMouseUp(e) {
    if (e.button === 0) mouseHeld = false;
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  target.addEventListener('mousemove', onMouseMove);
  target.addEventListener('mousedown', onMouseDown);
  target.addEventListener('mouseup', onMouseUp);

  // ---- Gamepad (gepollt, Flankenerkennung fuer Tasten) ----
  let gpSecondaryWasDown = false;
  let gpStartWasDown = false;
  let gpDashWasDown = false;

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
      gpSecondaryWasDown = false;
      return null;
    }
    const dz = (v) => (Math.abs(v) < deadzone ? 0 : v);
    const move = { x: dz(gp.axes[0] || 0), y: dz(gp.axes[1] || 0) };
    const ax = dz(gp.axes[2] || 0);
    const ay = dz(gp.axes[3] || 0);
    const aimLen = Math.hypot(ax, ay);
    const aimDir = aimLen > deadzone ? { x: ax, y: ay } : null;
    const fireHeld = !!gp.buttons[7]?.pressed; // rechter Trigger
    // Sekundaerwaffe: linker Trigger (Spec 0a) ODER A/X (Altbelegung).
    const secDown = !!gp.buttons[6]?.pressed || !!gp.buttons[0]?.pressed;
    const secondaryPressed = secDown && !gpSecondaryWasDown;
    gpSecondaryWasDown = secDown;
    const startDown = !!gp.buttons[9]?.pressed; // Start/Options -> Pause
    const pausePressed = startDown && !gpStartWasDown;
    gpStartWasDown = startDown;
    const dashDown = !!gp.buttons[1]?.pressed; // B / Circle -> Dash
    const dashPressed = dashDown && !gpDashWasDown;
    gpDashWasDown = dashDown;
    if (move.x || move.y || aimDir || fireHeld || secDown) markSource('gamepad');
    return { move, aimDir, aimLen, fireHeld, secondaryPressed, pausePressed, dashPressed };
  }

  function keyboardMove() {
    let x = 0;
    let y = 0;
    if (pressed.has('KeyA') || pressed.has('ArrowLeft')) x -= 1;
    if (pressed.has('KeyD') || pressed.has('ArrowRight')) x += 1;
    if (pressed.has('KeyW') || pressed.has('ArrowUp')) y -= 1;
    if (pressed.has('KeyS') || pressed.has('ArrowDown')) y += 1;
    return { x, y };
  }

  return {
    // Einheitlicher Eingabezustand. player = { x, y } (fuer stickbasiertes
    // Zielen, das relativ zum Panzer arbeitet).
    getState(player) {
      const gp = pollGamepad();
      if (touch && touch.isActive()) {
        // Touch meldet sich selbst als Quelle, sobald ein Finger liegt.
        if (touch.hasContact && touch.hasContact()) markSource('touch');
      }

      // --- move: Tastatur > Gamepad > Touch (aktive Quelle gewinnt) ---
      const kb = keyboardMove();
      const tMove = touch ? touch.getMove() : { x: 0, y: 0 };
      const gpMove = gp && (gp.move.x || gp.move.y) ? gp.move : null;
      const move = kb.x || kb.y ? kb : gpMove || tMove;

      // --- aim + firing: Gamepad-Stick > Touch-Stick > Maus ---
      let aimPt;
      let firing = false;
      const tAim = touch ? touch.getAimVector() : null; // { x, y, mag } normalisiert
      if (gp && gp.aimDir) {
        aimPt = { x: player.x + gp.aimDir.x * 120, y: player.y + gp.aimDir.y * 120 };
        firing = true; // rechter Stick ausgelenkt -> Autofire
      } else if (tAim) {
        aimPt = { x: player.x + tAim.x * 120, y: player.y + tAim.y * 120 };
        // Reines Autofire ab Deadzone. Bei twoZone erst ab fireThreshold
        // (darunter wird nur gezielt).
        firing = stickCfg.twoZone ? tAim.mag >= (stickCfg.fireThreshold ?? 0.6) : true;
      } else {
        aimPt = { x: aim.x, y: aim.y };
        firing = mouseHeld; // Linksklick gehalten
      }
      if (gp && gp.fireHeld) firing = true; // rechter Trigger ueberschreibt

      // --- secondary (flankengetriggert) aus allen Quellen ---
      const tThrow = touch ? touch.consumeThrow() : null;
      const secondary =
        secondaryQueued ||
        !!(gp && gp.secondaryPressed) ||
        (touch ? touch.consumeSecondary() : false) ||
        !!tThrow;
      secondaryQueued = false;

      const dash = dashQueued || !!(gp && gp.dashPressed);
      dashQueued = false;

      return { move, aim: aimPt, firing, secondary, secondaryThrow: tThrow || null, dash, source };
    },
    // Esc / P / Gamepad-Start (einmal pro Druck).
    consumePause() {
      const p = pauseQueued;
      pauseQueued = false;
      return p;
    },
    queueDash() {
      dashQueued = true;
    },
    // Nur bei Touch werden die virtuellen Sticks eingeblendet.
    getSource() {
      return source;
    },
    // Live-Vorschau des Bombenwurfs (Rendering); null ohne Touch-Zug.
    getMinePreview() {
      return touch ? touch.getMinePreview() : null;
    },
    isDebug() {
      return debug;
    },
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      target.removeEventListener('mousemove', onMouseMove);
      target.removeEventListener('mousedown', onMouseDown);
      target.removeEventListener('mouseup', onMouseUp);
    },
  };
}
