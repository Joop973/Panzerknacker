# PLAN-INPUT.md — Input-Rework & Systemänderungen (v1.0)

Ergänzung zu `PLAN.md`. Phasen strikt in dieser Reihenfolge, **eine Phase
pro Session, keine Überlappung**.

Die Steuerungsdoktrin selbst steht in `SPEC.md`, Abschnitt 9 — dort, wo die
bisherige Steuerung beschrieben ist, damit es nur eine Quelle gibt.

---

**Fortschritt:** P1 ✅ · P2 ✅ gebaut · P5 ❌ gestrichen (Nutzerentscheidung) ·
P10 ✅ war schon erledigt. **Nächste Session: P3 (Touch-Bug Sekundärwaffe —
der `pointercancel`-Fehler ist unten schon diagnostiziert).**

## Ist-Abgleich (Stand: Cache v65)

Vor dem Bau geprüft, was der Code **heute schon kann**. Ergebnis: mehrere
Phasen sind ganz oder überwiegend erledigt, zwei kollidieren mit
Grundentscheidungen aus `PLAN.md`, und eine Zahlenangabe würde ihr Ziel
verfehlen. Ohne diesen Abgleich wären mindestens drei Sessions in
bereits vorhandenen Code geflossen.

| Phase | Ist-Stand | Restaufwand |
|---|---|---|
| P1 Input-Abstraktion ✅ **erledigt** | **Grundgerüst stand seit Phase 0a**: `src/core/input.js` ist die einzige Stelle, die Geräte-Events liest; `getState()` liefert ein Aktionsmodell; Gamepad wird gepollt, nicht per Event; Werte liegen in `data/input.json`. | Aktionsmodell **erweitern** (Gadget-Felder, `detonate`, Menü-Navigation, getrennte Held/Release-Flags) + die drei Profile aus `getState()` in eigene Funktionen ziehen. Kein Neubau. |
| P2 Viewport/Fullscreen ✅ **erledigt** | Meta-Viewport war **exakt** wie gefordert; `touch-action: none` und `overscroll-behavior` gesetzt; Fullscreen-Anforderung existierte. | Gebaut: `src/core/viewport.js` (DPR-Kopplung mit Deckel, `visualViewport` → `--vvh`), `position: fixed` global, Vollbild-Knopf. |
| P3 Touch-Bug Sekundär | Pointer-Events, `pointerId`-Tracking und `setPointerCapture()` sind **bereits umgesetzt**. | **Ein konkreter Bug gefunden**, siehe unten — der Rest der Phase ist bereits erfüllt. |
| P4 Gadget-Split | Ein Slot mit sechs austauschbaren Sekundärwaffen (Phase 6). | Echte Neuarbeit. Zwei Nebenwirkungen beachten, siehe unten. |
| P5 Schild-Rework ❌ **gestrichen** | Vier Schild-Karten, Verfall nach 3 Räumen, Regeneration, Nachkauf. | **Nutzerentscheidung: „Schild erstmal so lassen wie es ist."** Konflikt A ist damit erledigt, E2/Bollwerk/`nachladeschild`/`emergency_shield`/`konterschild` bleiben unangetastet. Phase entfällt. |
| P6 Haken-Rework | `hook.maxRangePx` **222** (Nutzerentscheidung), Bombenwurf `throwPx: 58`. | Reichweite ist **gesetzt** (Konflikt B entschieden). Offen bleiben nur die übrigen P6-Punkte (Zielvorschau usw.). |
| P7 Stats-Anzeige | Nicht vorhanden. | Echte Neuarbeit. |
| P8 Zwischenraum-UI | Raumvorschau zeigt Gegner **und** Upgrades als Chips. | Echte Neuarbeit; kehrt die Chip-Anzeige aus der letzten Balancerunde bewusst wieder um. |
| P9 Startbildschirm | **Existiert**: Start, Tages-Seed, Fortsetzen, Schwierigkeit, Bestwerte zurücksetzen, Optionen (Ziellinie, Bedrohungslinien, Reduzierte Bewegung), Mute. | D-Pad-Navigation, Vollbild-Button, Lautstärkeregler, „Spiel beenden". |
| P10 Grüner gefährlicher | **Bereits erledigt** (Session vor dieser): `requiresBounceShot` (Bandenrechner), 2 Abpraller, `accuracy` 0.9, Feuerrate unverändert. | Nur noch Feinschliff, falls er sich beim Spielen zu schwach anfühlt. |
| P11 Lichtquellen | `fog`/`darkness` existieren als Raum-Modifikatoren mit `visionRadiusPx`, gerendert über `drawFog()`. | Lichtquellen für Gegner/Bomben/Geschosse + additive Maske statt einer Blende um den Spieler. |

### Dateinamen im Ausgangsdokument, die es nicht gibt

`data/weapons.json` → tatsächlich **`data/secondaries.json`**;
`data/enemies.json` → **`data/tanks.json`**;
`data/rooms.json` → **`data/modifiers.json`** (Licht) bzw. `data/tiles.json`.
`input.js` liegt unter **`src/core/input.js`** und existiert bereits.

---

## Gefundene Bugs und Konflikte

### Bug P3 — `pointercancel` wirft die Bombe trotzdem

`src/ui/touchcontrols.js` hängt **dieselbe** Funktion an `pointerup` **und**
`pointercancel`:

```js
mineBtn.addEventListener('pointerup', endMineStick);
mineBtn.addEventListener('pointercancel', endMineStick);   // wirft ebenfalls!
```

`endMineStick()` setzt in beiden Fällen `pendingThrow = mineDrag()`. Bricht
das System den Touch ab (eingehender Anruf, System-Geste, Browser-Interferenz,
zu viele gleichzeitige Finger), fliegt die Bombe trotzdem — an einer Position,
die der Spieler nie bestätigt hat. Genau das verbietet die Phase:
„`pointercancel` bricht die Aktion ab, ohne auszulösen."

**Fix in P3:** `pointercancel` bekommt einen eigenen Abbruch-Pfad, der den
Stick zurücksetzt, ohne `pendingThrow` zu belegen.

### Konflikt A — P5 Schild-Rework gegen E2 und Phase 17

Der Plan verlangt: 3 Ladungen, **kein Verfall**, **keine Regeneration**,
**nicht nachkaufbar**. Dagegen steht Bestehendes:

| Bestehend | Konflikt |
|---|---|
| **E2** (`PLAN.md`, Vorabentscheidung): „Schildladung verfällt nach `shield.roomLifetime: 3` geräumten Räumen. Kein unbegrenztes Bunkern." | P5 streicht den Verfall — E2 wird damit teilweise zurückgenommen. |
| **Bollwerk** (Transformation, Tag `defense`): „Schildladungen verfallen nicht mehr." | Ohne Verfall ist die Transformation **wirkungslos** und braucht einen neuen Effekt. |
| **`nachladeschild`** (Karte, Welle 2): Schild lädt sich selbst nach. | Widerspricht „keine Regeneration" — Karte müsste raus oder umgebaut werden. |
| **`emergency_shield`** (Karte) + Shop-Aktion + Upgrade-Screen-Aktion „Schildladung" | Widerspricht „nicht nachkaufbar" — drei Kaufwege müssten entfallen. |
| **`konterschild`** (Karte) | Hängt an `shieldReady`, müsste auf das neue Ladungsmodell umgestellt werden. |

**✅ Entschieden (Nutzer): „Schild erstmal so lassen wie es ist."**
E2 bleibt, Bollwerk bleibt wirksam, `nachladeschild`, `emergency_shield`,
`konterschild` und die beiden Kaufwege bleiben unverändert. **P5 entfällt
ersatzlos** — der Konflikt ist damit geschlossen, nicht vertagt.

### Konflikt B — P6 Hakenreichweite würde den Haken halbieren

Gefordert: `hookRange = bombThrowRange * 2`.
Ist: Haken **260 px**, Bombenwurf **58 px** (nach der Wurfweiten-Senkung um
20 % in der letzten Balancerunde). Die Formel ergäbe **116 px** — also **weniger
als die Hälfte** der heutigen Reichweite, nicht mehr.

Die Absicht („Haken reicht deutlich weiter als die Bombe") ist heute schon
erfüllt (4,5-fach).

**✅ Entschieden (Nutzer): „Haken soll 222 px haben."** `hook.maxRangePx` ist
in `data/secondaries.json` von 260 auf **222** gesetzt (bereits umgesetzt).
Die Formel `hookRange = bombThrowRange * 2` wird damit **verworfen** — sie
hätte 116 px ergeben. 222 px sind das 3,8-fache der Bombenreichweite, die
Absicht der Formel bleibt also erfüllt. Konflikt B ist geschlossen.

### Konflikt C — P4 Gadget-Split, zwei Nebenwirkungen

1. **Sieben Karten hängen an „Bombe ausgerüstet"** (`upgradepool.js:
   MINE_ONLY_IDS`: kettenglied, sprengkraft, fernzuender, schockwelle,
   annaeherungsmine, klebemine, streumine). Ist die Bombe künftig **immer**
   da, sind diese Karten immer im Pool — die Pool-Gewichtung verschiebt sich
   spürbar, und der Tag `control` verliert seine bisherige Bedingtheit.
2. **`emp_mine` teilt sich die komplette Legemechanik mit `mine`**
   (`tank.js: layMine()`, jede 4. Mine ist EMP). Als eigenständiges Gadget
   braucht sie einen eigenen Auslöse- und Zielpfad.

### Konflikt D — Feuer-Stopp bei `maxActive`

Bereits im Ausgangsdokument benannt und hier bestätigt: `bullet.maxActive: 5`
sperrt das Feuern hart (E4: „Feuersperre statt Verdrängung"). Bei manuellem
Feuern (Controller/PC) wirkt ein blockierter Tastendruck wie ein Bug. Der
Fix gehört in die Phase, die manuelles Feuern einführt (P1) — mindestens ein
hörbares/sichtbares „Magazin leer"-Signal.

---

# TIER 0 — Fundament

## P1 — Input-Abstraktionsschicht ✅ gebaut

**Ziel:** Alle Eingaben laufen über ein zentrales Aktionsmodell. Die
Spiellogik kennt keine Tasten, nur Aktionen.

**Was schon steht (Phase 0a):** `src/core/input.js` ist die einzige Stelle
mit Geräte-Events, `getState(player)` liefert
`{ move, aim, firing, secondary, secondaryThrow, dash, source }`,
Gamepad wird in `getState()` gepollt (nicht eventbasiert), Profilerkennung
läuft automatisch über `source`, alle Stellwerte liegen in
`data/input.json`. `src/game/*` enthält nachweislich keinen Event-Zugriff.

**Was zu tun ist:**
- `InputState` um die fehlenden Felder erweitern: `aimActive`,
  `secondaryHeld`, `secondaryRelease`, `gadgetAim`, `gadgetHeld`,
  `gadgetRelease`, `detonate`, `menuDir`, `menuConfirm`.
- `secondaryRelease`/`gadgetRelease` als **Ein-Frame-Flags** (nach dem
  Auslesen zurücksetzen) — dasselbe Muster wie das heutige
  `secondaryQueued`.
- Die drei Profile aus den if-Zweigen in `getState()` in eigene Funktionen
  `profileTouch` / `profileGamepad` / `profileKeyboardMouse` ziehen, die je
  **nur** in `InputState` schreiben.
- Manueller Profil-Override in den Einstellungen (P9 verdrahtet die UI).
- Belegungen nach `data/input.json` (Tastencodes, Gamepad-Indizes,
  Deadzones) — heute stehen die Indizes noch im Code.
- **Konflikt D mitlösen:** blockierter Schuss bei vollem Magazin braucht ein
  Signal (Ton + kurzer Blitz am Rohr), sobald manuell gefeuert wird.

**Gadget-Felder bleiben zunächst leer** — sie bekommen erst in P4 Inhalt.
Dasselbe Muster wie die Arena-Weiche aus Phase 0b, die erst Phase 14 füllte.

**Testschritte (Handy):** unverändert wie im Ausgangsdokument.

### Umsetzung (gebaut)

- **Aktionsmodell erweitert** um `aimActive`, `primaryFire`,
  `primaryPressed`, `secondaryHeld`, `secondaryRelease`, `secondaryAim`,
  `gadgetHeld`, `gadgetRelease`, `gadgetAim`, `detonate`, `menuDir`,
  `menuConfirm`. Alle Ein-Frame-Flags werden in `getState()` verbraucht.
- **Rückwärtskompatible Aliase** (`firing`, `secondary`, `secondaryThrow`)
  bleiben bestehen — P1 ist damit bewusst **keine** Verhaltensänderung für
  die Spiellogik, nur eine Strukturänderung. Die alten Namen fallen erst,
  wenn P4 die Aufrufstellen ohnehin anfasst.
- **Drei Profilfunktionen** `profileTouch` / `profileGamepad` /
  `profileKeyboardMouse` schreiben nur noch in denselben `InputState`.
  Reihenfolge Touch < Gamepad < Tastatur/Maus; jedes Profil schreibt **nur
  bei echtem Input**, deshalb überschreibt der immer vorhandene Mauszeiger
  ein aktives Stick-Ziel nicht mehr (`if (!st.aimActive)`).
- **Belegungen komplett nach `data/input.json`**: `keyboard.*` als Listen
  von `KeyboardEvent.code`, `gamepad.*` als Button-Indizes laut Doktrin
  (RT = Primär, LT = Sekundär, RB = Gadget, LB = Zünden), `aim.reachPx`.
- **Rechte Maustaste** ist jetzt die Sekundärwaffe (`contextmenu` auf dem
  Canvas unterdrückt), `setProfile()`/`getProfile()` als manueller Override
  für P9.
- **Umsetzungsfund — geteilte Gamepad-Knöpfe:** `edge()` aktualisiert
  `gpPrev` beim Auslesen. Der A-Knopf belegt zwei Aktionen (Sekundärwaffe im
  Spiel, Bestätigen im Menü); der zweite `edge()`-Aufruf im selben Poll
  hätte deshalb immer `false` geliefert. Gelöst über einen Poll-lokalen
  Cache (`edgeSeen`), nicht durch Doppelbelegungsverbot.
- **Konflikt D gelöst:** `fireBullet(tank, state, pressed)` meldet einen
  durch `bullet.maxActive` gesperrten Schuss mit Ton (`empty` in
  `data/sounds.json`) **und** gedimmtem Blitz am Rohr
  (`state.flashes`-Eintrag mit `dim: true`, grau statt gelb in
  `effects.js: drawFlashes`) — aber **nur bei frischem Abzug** und höchstens
  alle `input.json: feedback.blockedShotCooldownS` (0,35 s), sonst würde es
  im Touch-Autofire dauerhaft klicken. Regressionstest deckt alle vier
  Fälle ab (gehalten = still, frisch = Signal, Cooldown greift, Gegner nie),
  Gegenprobe für jeden bestanden.

---

## P2 — Viewport- und Fullscreen-Fix ✅ gebaut

**Was schon steht:** Meta-Viewport exakt wie gefordert
(`width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no,
viewport-fit=cover`), `touch-action: none` auf Canvas und Stickzonen,
`overscroll-behavior` auf den Overlays, `requestFullscreen()` + Landscape-Lock
beim Run-Start.

**Was zu tun ist:**
- `html, body { position: fixed; width: 100%; height: 100%; overflow: hidden; }`
  und `overscroll-behavior: none` global (heute nur `contain` auf Overlays).
- Canvas-Größe an `visualViewport` koppeln statt an `window.innerHeight`
  (Adressleisten-Einblendung auf iOS).
- `devicePixelRatio`: Backing-Store × DPR, CSS-Größe bleibt die Logikgröße.
- Vollbild-Button auf dem Startbildschirm vorbereiten (P9 verdrahtet ihn).

### Umsetzung (gebaut)

Neues Modul **`src/core/viewport.js`** — die einzige Stelle, die Canvasgröße
und Auflösung verwaltet.

- **Auflösung an `devicePixelRatio`:** Backing-Store `WIDTH*dpr × HEIGHT*dpr`,
  Kontext bekommt `setTransform(dpr,…)` als Grundtransformation. Alle
  Zeichenbefehle bleiben dadurch **unverändert** in Arena-Koordinaten —
  `renderer.js` und `debug.js` mussten nicht angefasst werden.
- **DPR gedeckelt** (`data/options.json: maxPixelRatio: 2`). Ungedeckelt
  wären es bei DPR 3 die neunfache Pixelmenge; Füllrate ist auf Handys der
  Engpass und Phase 11b hält das Frame-Budget knapp.
- **`visualViewport`:** `--vvh`/`--vvw` als CSS-Variablen, im Stylesheet mit
  `100dvh` als Rückfall. `dvh` kennt die eingeklappte Adressleiste, aber
  **nicht** die eingeblendete Bildschirmtastatur — genau der Fall beim
  Seed-Eingabefeld.
- **`position: fixed` + `overscroll-behavior: none`** global auf html/body.
- **Vollbild-Knopf** im Startmenü, nur sichtbar, wenn der Browser
  Element-Vollbild kann (auf iOS wäre er eine Sackgasse). `fullscreenchange`
  zieht Beschriftung und Canvasgröße nach.

**Drei Fallen, alle gemessen statt vermutet:**

1. **Zielkoordinaten (`input.js: toCanvas`).** Die Funktion rechnete gegen
   `canvas.width`, das jetzt ein Vielfaches der Arenabreite ist. Ein Klick
   in der rechten Bildhälfte hätte auf **x = 1152** einer 768 px breiten
   Arena gezeigt. Jetzt gegen die festen Logikmaße aus `config.js`.
2. **Layoutgröße hing plötzlich am DPR.** Ein Canvas leitet seine
   intrinsische Größe aus den `width`/`height`-**Attributen** ab — der
   größere Backing-Store ließ ihn im Layout mitwachsen (gemessen: 768×512
   bei DPR 1, aber 972×648 bei DPR 2). Gelöst über
   `max-width: min(100%, 768px)` / `max-height: min(90vh, 512px)`.
3. **Der naheliegende Fix für (2) war falsch.** Feste CSS-Breite **und**
   -Höhe zu setzen macht beide Maße definit und setzt damit `aspect-ratio`
   außer Kraft: sobald `max-height` im Handy-Querformat greift, wurde der
   Canvas **verzerrt** (768×390 statt 585×390, also ein Drittel zu breit).
   Deshalb setzt `viewport.js` bewusst **keine** CSS-Maße.

**Neuer Test `tests/viewport.mjs`** (braucht Playwright, überspringt sich
sonst selbst): prüft über DPR 1/2/3 den Backing-Store und den Deckel, die
DPR-Unabhängigkeit der Layoutgröße, das Seitenverhältnis in drei echten
Handy-/Tablet-Querformaten und — der Kern — dass ein Mausereignis in
Arena-Koordinaten ankommt. Gegenprobe für alle drei Fallen bestanden.

---

## P3 — Touch-Bug Sekundärwaffe

**Was schon steht:** Pointer-Events, `pointerId`-Prüfung in `pointermove`
und `pointerup`, `setPointerCapture()`, Sperrzone zwischen den Stickzonen.

**Was zu tun ist:** Der oben beschriebene **`pointercancel`-Bug**: eigener
Abbruch-Pfad ohne Auslösung. Danach die fünf Testschritte des
Ausgangsdokuments durchgehen — sie decken auch die schon vorhandenen Teile ab.

---

# TIER 1 — Datenmodell & Kernmechaniken

## P4 — Waffenkategorien-Split: Sekundärwaffe und Gadget

Unverändert wie im Ausgangsdokument, **plus** die beiden Nebenwirkungen aus
Konflikt C (MINE_ONLY-Karten, `emp_mine`-Legemechanik).

Betroffene Dateien: `data/secondaries.json` (Kategorie je Eintrag),
`data/upgrades.json` (Tag/Kategorie), `src/game/upgradepool.js`
(`MINE_ONLY_IDS`, getrennte Gewichtung), `src/game/tank.js`
(`useSecondary()` → zwei Dispatches), `src/game/run.js`
(`equippedSecondary` → zusätzlich `equippedGadget`, Snapshot),
`src/ui/hud.js` (zwei Slots), `src/core/input.js` (Gadget-Kanal aus P1).

## P5 — Schild-Rework ❌ gestrichen

**Nutzerentscheidung: „Schild erstmal so lassen wie es ist."** Die Phase
entfällt ersatzlos (Konflikt A geschlossen). Das bestehende Schildmodell —
E2-Verfall nach `shield.roomLifetime`, Bollwerk, `nachladeschild`,
`emergency_shield`, `konterschild`, beide Kaufwege — bleibt unverändert.

## P6 — Haken-Rework

**Reichweite entschieden:** `hook.maxRangePx` = **222** (bereits in
`data/secondaries.json` gesetzt), die Formel aus dem Ausgangsdokument ist
verworfen. Die übrigen Punkte
(Zielphase wie die Bombe, Auslösen beim Loslassen, Zug an allen Wandtypen,
Cooldown auch ohne Treffer, während des Zugs steuerlos aber verwundbar) sind
unstrittig — der Zug selbst existiert bereits (`tank.js: fireHook()`), es
fehlt die **Zielvorschau**.

---

# TIER 2 — Information & Rahmen

## P7 — Stats-Anzeige

Unverändert. Hinweis: Alle geforderten Werte sind zur Laufzeit vorhanden
(`player.cfg.speed`, `cfg.bulletSpeed`, `balance.mine.radius *
cfg.mineRadiusMult`, `liveBulletsOf()`, `cfg.mines`) — es braucht **keine**
neuen Felder, nur eine Ableitung im HUD.

## P8 — Mobile Zwischenraum-UI

Unverändert. **Beachten:** Die Raumvorschau zeigt seit der letzten
Balancerunde Upgrade-Chips mit Symbolen; P8 nimmt sie aus dem Hauptbereich
wieder heraus und verschiebt sie auf die Vollbild-Seite. Die Symbole aus
`data/upgrades.json` werden dort weiterverwendet.

## P9 — Startbildschirm

**Was schon steht:** Startbildschirm mit Seed-Eingabe, Tages-Seed,
„Run fortsetzen", Schwierigkeitsauswahl, Bestwerte-Reset, drei
Options-Schalter (Ziellinie, Bedrohungslinien, reduzierte Bewegung), Mute.

**Was zu tun ist:** D-Pad-/Tastatur-Navigation mit sichtbarer Hervorhebung,
Vollbild-Button (Geste aus P2), Lautstärkeregler statt reinem Mute,
Eingabeprofil-Override (aus P1), „Spiel beenden" mit Bestätigung.

---

# TIER 3 — Content & Feinschliff

## P10 — Grüner Panzer gefährlicher ✅ bereits erledigt

In der Session vor dieser umgesetzt: `t_green` nutzt den Bandenrechner
(`requiresBounceShot`), hat 2 Abpraller und `accuracy` 0.9; die Feuerrate
blieb unverändert (2 s), wie die Phase es verlangt. Gemessen: 173 Schüsse in
12 Testläufen, 30 von 36 Panzern finden eine Bankshot-Lösung, schlechtester
Logikschritt 2,2 ms von 6 ms Budget.

**Offen bleibt nur** die subjektive Abnahme („fünf Runs: gefährlicher, aber
ausweichbar"). Falls er zu schwach wirkt: `solveIntervalS` senken (rechnet
öfter neu) oder `hitTolerancePx` erhöhen (findet mehr Lösungen).

## P11 — Dunkler Raum: Lichtquellen

**Was schon steht:** `fog` und `darkness` als Raum-Modifikatoren
(`data/modifiers.json`, `visionRadiusPx` 260 bzw. 150), gerendert als
Radialgradient um den Spieler (`renderer.js: drawFog()`), aufhebbar durch die
Karte `nachtsicht`.

**Was zu tun ist:** Aus der einen Blende eine **additive Lichtmaske** mit
mehreren Quellen machen (Spieler, Gegner, Bomben, Geschosse) — die Werte
gehören zu den Modifikatoren in `data/modifiers.json`, nicht in eine neue
`rooms.json`. Performance auf dem Handy nach Phase 11b messen (Renderzeit
≤ 6 ms).
