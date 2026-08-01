# PLAN-INPUT.md — Input-Rework & Systemänderungen (v1.0)

Ergänzung zu `PLAN.md`. Phasen strikt in dieser Reihenfolge, **eine Phase
pro Session, keine Überlappung**.

Die Steuerungsdoktrin selbst steht in `SPEC.md`, Abschnitt 9 — dort, wo die
bisherige Steuerung beschrieben ist, damit es nur eine Quelle gibt.

---

**Fortschritt:** P1 ✅ · P2 ✅ · P3 ✅ · P4 ✅ · P6 ✅ · P7 ✅ · P8 ✅ ·
P9 ✅ gebaut · P5 ❌ gestrichen (Nutzerentscheidung) · P10 ✅ war schon
erledigt. **Nächste Session: P11 (Lichtquellen) — die letzte Phase, danach
ist der Ergänzungsplan abgearbeitet.**

## Ist-Abgleich (Stand: Cache v71)

Vor dem Bau geprüft, was der Code **heute schon kann**. Ergebnis: mehrere
Phasen sind ganz oder überwiegend erledigt, zwei kollidieren mit
Grundentscheidungen aus `PLAN.md`, und eine Zahlenangabe würde ihr Ziel
verfehlen. Ohne diesen Abgleich wären mindestens drei Sessions in
bereits vorhandenen Code geflossen.

| Phase | Ist-Stand | Restaufwand |
|---|---|---|
| P1 Input-Abstraktion ✅ **erledigt** | **Grundgerüst stand seit Phase 0a**: `src/core/input.js` ist die einzige Stelle, die Geräte-Events liest; `getState()` liefert ein Aktionsmodell; Gamepad wird gepollt, nicht per Event; Werte liegen in `data/input.json`. | Aktionsmodell **erweitern** (Gadget-Felder, `detonate`, Menü-Navigation, getrennte Held/Release-Flags) + die drei Profile aus `getState()` in eigene Funktionen ziehen. Kein Neubau. |
| P2 Viewport/Fullscreen ✅ **erledigt** | Meta-Viewport war **exakt** wie gefordert; `touch-action: none` und `overscroll-behavior` gesetzt; Fullscreen-Anforderung existierte. | Gebaut: `src/core/viewport.js` (DPR-Kopplung mit Deckel, `visualViewport` → `--vvh`), `position: fixed` global, Vollbild-Knopf. |
| P3 Touch-Bug Sekundär ✅ **erledigt** | Pointer-Events, `pointerId`-Tracking und `setPointerCapture()` waren **bereits umgesetzt**. | Gebaut: eigener `pointercancel`-Abbruchpfad; dazu **zwei weitere Fehler** gefunden und behoben (Zweitfinger, Sperrzone pro Berührung). |
| P4 Gadget-Split ✅ **erledigt** | Ein Slot mit sechs austauschbaren Sekundärwaffen (Phase 6). | Gebaut: fester Bombenslot + tauschbarer Gadgetslot, eigener Auslöser/Zielpfad je Slot. Konflikt C damit aufgelöst (`MINE_ONLY_IDS` entfällt). |
| P5 Schild-Rework ❌ **gestrichen** | Vier Schild-Karten, Verfall nach 3 Räumen, Regeneration, Nachkauf. | **Nutzerentscheidung: „Schild erstmal so lassen wie es ist."** Konflikt A ist damit erledigt, E2/Bollwerk/`nachladeschild`/`emergency_shield`/`konterschild` bleiben unangetastet. Phase entfällt. |
| P6 Haken-Rework ✅ **erledigt** | `hook.maxRangePx` **222** (Nutzerentscheidung), Bombenwurf `throwPx: 58`. | Gebaut: Zielrichtung aus der Zielphase, Abklingzeit auch ohne Treffer, Zielvorschau über dieselbe Funktion wie der Schuss. |
| P7 Stats-Anzeige ✅ **erledigt** | Nicht vorhanden. | Gebaut: umschaltbares Werte-Panel im HUD (Tab), in der Pause immer sichtbar (Handy-Weg). Reine Ableitung, keine neuen Felder. |
| P8 Zwischenraum-UI ✅ **erledigt** | Raumvorschau zeigt Gegner **und** Upgrades als Chips. | Gebaut: Ausrüstung auf eigener Vollbild-Seite, Hauptbereich dadurch kurz genug für jedes Handy-Querformat. |
| P9 Startbildschirm ✅ **erledigt** | Existierte: Start, Tages-Seed, Fortsetzen, Schwierigkeit, Bestwerte zurücksetzen, Optionen (Ziellinie, Bedrohungslinien, Reduzierte Bewegung), Mute. | Gebaut: `src/ui/menunav.js` (Tastatur-/Gamepad-Fokusnavigation), Lautstärkeregler, Eingabeprofil-Override, „Spiel beenden"; alles Neue auf einer eigenen Einstellungsseite (Muster P8), sonst passte der Startbildschirm im Handy-Querformat nicht mehr. |
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

**✅ In P4 aufgelöst.** Nicht durch eine neue Gewichtung, sondern weil die
Bombe seit P4 nicht mehr abwählbar ist: `MINE_ONLY_IDS` entfällt ersatzlos,
die sieben Karten können nie mehr wirkungslos werden, und `emp_mine` hat als
Gadget ihren eigenen Auslöser (`forceEmp`) bekommen.

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

## P3 — Touch-Bug Sekundärwaffe ✅ gebaut

**Was schon steht:** Pointer-Events, `pointerId`-Prüfung in `pointermove`
und `pointerup`, `setPointerCapture()`, Sperrzone zwischen den Stickzonen.

**Was zu tun ist:** Der oben beschriebene **`pointercancel`-Bug**: eigener
Abbruch-Pfad ohne Auslösung. Danach die fünf Testschritte des
Ausgangsdokuments durchgehen — sie decken auch die schon vorhandenen Teile ab.

### Umsetzung (gebaut)

Beim Durchgehen der vorhandenen Teile kamen **zwei weitere Fehler** dazu —
beide dieselbe Klasse wie der gemeldete: eine Eingabe geht still verloren.

1. **`pointercancel` löste aus** (der bekannte Bug). `pointerup` und
   `pointercancel` hingen an derselben Funktion. Jetzt zwei Pfade:
   `endMineStick` (wirft) und `abortMineStick` (setzt nur zurück), mit
   gemeinsamem `resetMineStick`, das auch das Pointer-Capture freigibt.
2. **Ein zweiter Finger auf dem Bombenknopf übernahm den Zug.** `pointerdown`
   überschrieb `mineStick.id` mit dem neuen Zeiger — das Loslassen des
   **ersten** Fingers fiel danach durch die id-Prüfung und wurde
   stillschweigend verworfen. Für den Spieler: „die Bombe kam nicht."
   Jetzt behält der erste Finger den Stick, bis er loslässt.
3. **Die Sperrzone galt pro Ereignis statt pro Berührung.** `onStart` prüfte
   nur `e.target` — das ist die Berührung, die das Ereignis ausgelöst hat.
   Wer gleichzeitig den Bombenknopf und die Fahrfläche antippte, verlor
   **beide** Berührungen, der Fahrstick entstand gar nicht. Jetzt wird jede
   Berührung einzeln gegen die Sperrzone geprüft.

**Bewusst NICHT gebaut:** ein `lostpointercapture`-Handler. Er wäre nur dann
richtig, wenn er nach `pointerup` feuert — feuert er davor, würde er jeden
regulären Wurf schlucken, also genau den Fehler erzeugen, den die Phase
beseitigt. Die Reihenfolge ließ sich hier nicht verlässlich nachmessen
(synthetisches `setPointerCapture` greift nicht), deshalb kein ungeprüfter
Pfad.

**Tests:** sechs Fälle in `tests/regression.mjs` (werfen, Abbruch wirft
nicht, nach Abbruch wieder werfbar, Zweitfinger, Sperrzone pro Berührung,
Sperrzone gilt weiterhin) — Gegenprobe für alle drei Fixes einzeln
bestanden. Dafür wurde `tests/domstub.mjs` um Pointer-Ereignisse,
`getBoundingClientRect`, Pointer-Capture und `closest()` erweitert, plus ein
`window` mit echter Listener-Verwaltung. Zusätzlich im echten Browser mit
echten `PointerEvent`s gegengeprüft.

---

# TIER 1 — Datenmodell & Kernmechaniken

## P4 — Waffenkategorien-Split: Sekundärwaffe und Gadget ✅ gebaut

Unverändert wie im Ausgangsdokument, **plus** die beiden Nebenwirkungen aus
Konflikt C (MINE_ONLY-Karten, `emp_mine`-Legemechanik).

### Umsetzung (gebaut)

**Zwei Slots statt einem.** Die Bombe liegt im festen Sekundärslot
(`category: "secondary"` in `data/secondaries.json`) und ist **immer**
ausgerüstet; die fünf übrigen Einträge sind `category: "gadget"` und teilen
sich den zweiten, tauschbaren Slot (`run.equippedGadget`, Start: keines).
Vorher lagen alle sechs in **einem** Slot — wer eine Gadgetkarte nahm,
verlor damit die Bombe.

- **`tank.js`**: `useSecondary()` ist nur noch die Bombe, `useGadget()` der
  zweite Dispatch mit eigener Abklingzeit (`tank.gadgetCooldown`). Beide
  Slots sind vollständig unabhängig — die Gadget-Abklingzeit blockiert die
  Bombe nicht (in der Regressionssuite zugesichert).
- **`emp_mine` ist jetzt ein echtes Gadget** mit eigenem Auslöser statt
  „jede 4. Bombe ist EMP". `layMine()` bekommt dafür `forceEmp`; der
  Zähler `secondaryMineCount` entfällt.
- **Der Fernzünder bekommt einen eigenen Knopf** (`cmd.detonate`, aus P1
  bereits im Aktionsmodell). Vorher löste er nur aus, wenn das Minen-Limit
  ohnehin erreicht war — praktisch unauffindbar.
- **Konflikt C ist damit aufgelöst, nicht umschifft:** `MINE_ONLY_IDS`
  entfällt **ersatzlos**. Die sieben minenspezifischen Karten können nie
  mehr wirkungslos werden, weil die Bombe nicht mehr abwählbar ist — und
  der Tag `control` hängt nicht länger an der ausgerüsteten Waffe. Die
  Minen-Karte selbst ist aus `data/upgrades.json` entfernt (eine Karte für
  einen festen Slot wäre wirkungslos).
- **Touch**: `makeThrowStick()` als Fabrik statt einer Kopie — Bombe und
  Gadget sind derselbe Bedienbaustein. Wichtig, weil der
  `pointercancel`-Fix aus P3 sonst an zwei Stellen hätte stimmen müssen.
  Der Gadget-Knopf erscheint nur, wenn eines ausgerüstet ist.
- **HUD**: zweiter Slot mit Kürzel und Restsekunden der Abklingzeit — ohne
  das wäre der einzige Hinweis auf einen kalten Slot, dass der Knopf nichts
  tut.
- **Shop** tauscht Gadgets (nach `category` gefiltert), nicht mehr die
  Bombe. Die Raum-Modifikator-„Ausrüstungssperre" sperrt seit P4 **beide**
  Slots.

**Gadgets backen pro Raum** (wie Transformationen und Raum-Modifikatoren):
eine mitten im Raum gewechselte Ausrüstung wirkt erst im nächsten Raum.

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

## P6 — Haken-Rework ✅ gebaut

**Reichweite entschieden:** `hook.maxRangePx` = **222** (bereits in
`data/secondaries.json` gesetzt), die Formel aus dem Ausgangsdokument ist
verworfen. Die übrigen Punkte
(Zielphase wie die Bombe, Auslösen beim Loslassen, Zug an allen Wandtypen,
Cooldown auch ohne Treffer, während des Zugs steuerlos aber verwundbar) sind
unstrittig — der Zug selbst existiert bereits (`tank.js: fireHook()`), es
fehlt die **Zielvorschau**.

### Umsetzung (gebaut)

Ist-Abgleich gegen die fünf Punkte: **zwei waren schon erfüllt**
(Auslösen beim Loslassen kam mit dem Gadget-Wurfstick aus P4; „steuerlos,
aber verwundbar" stimmt seit Phase 6 — `moveTank()` ignoriert die Eingabe
während `hookTimer > 0`, und der Panzer bekommt dabei keine Unverwundbarkeit).
Der **Zug an allen Wandtypen** trägt ebenfalls schon: `isSolid()` deckt
feste, durchschießbare, Spiegel-, zerstörbare und Generator-Wände ab, dazu
über das Grid auch die eigene Sperrmauer und geschlossene bewegliche Wände.
Löcher sind bewusst ausgenommen — dort ist nichts zum Festhaken.

Drei Punkte waren offen:

- **Die Zielrichtung wurde ignoriert.** `fireHook()` nutzte immer
  `tank.turret`; der Gadget-Wurfstick aus P4 war damit wirkungslos. Jetzt
  steuert die Zielvorgabe den Haken, genau wie beim Bombenwurf — auf
  PC/Controller weiterhin die Blickrichtung.
- **Ein Fehlschuss kostete gar nichts** (`return false` → keine
  Abklingzeit). Jetzt läuft sie in jedem Fall; der Griff ins Leere ist damit
  eine echte Fehlentscheidung. Hör- und sichtbar quittiert (`empty` +
  gedimmter Blitz), sonst wirkt die verbrauchte Abklingzeit wie ein Defekt —
  dieselbe Auflage wie beim gesperrten Schuss aus P1.
- **Zielvorschau** (`effects.js: drawHookPreview`): Linie bis zum
  Ankerpunkt, durchgezogen mit Ankerkreuz bei Treffer, gestrichelt bei
  Fehlschuss. Der Unterschied muss **vor** dem Auslösen erkennbar sein,
  weil ein Fehlschuss jetzt die Abklingzeit kostet.

**Eine Quelle für „wo landet der Haken":** neu `tank.js: traceHook()` —
Vorschau und Schuss rufen dieselbe Funktion, sie können nicht auseinander
laufen (dasselbe Prinzip wie die Ziellinie aus Phase 0a, die bewusst die
echte Geschossphysik nutzt). Die Regressionssuite prüft das über 16
Richtungen; Gegenprobe mit einem eigenen Raymarch im Schuss bestanden.

**Nebenbefund — ein in P4 eingebauter Fehler:** `getMinePreview()` gab dort
`mine.preview() || gadget.preview()` zurück. Beim Zielen mit dem Gadget
zeichnete das die **Bomben**-Wurfvorschau. Jetzt getrennte Abfragen
(`getMinePreview` / `getGadgetPreview`).

---

# TIER 2 — Information & Rahmen

## P7 — Stats-Anzeige ✅ gebaut

Unverändert. Hinweis: Alle geforderten Werte sind zur Laufzeit vorhanden
(`player.cfg.speed`, `cfg.bulletSpeed`, `balance.mine.radius *
cfg.mineRadiusMult`, `liveBulletsOf()`, `cfg.mines`) — es braucht **keine**
neuen Felder, nur eine Ableitung im HUD.

### Umsetzung (gebaut)

`hud.js: drawStats()` zeigt die Werte des eigenen Panzers, **wie sie nach
allen Upgrades, Raum-Modifikatoren und Transformationen tatsächlich gelten**.
Bis hierher zeigte das Spiel nur Kartennamen — welche Zahl dabei
herauskommt, war nirgends ablesbar.

- **Abweichung statt Absolutwert:** interessant ist nicht „Tempo 84", sondern
  „Tempo 84 (+20 %)". Die Basis kommt aus `resolveCfg()` **ohne** Upgrades,
  die Differenz wird daraus gerechnet — nichts wird gespeichert.
- **Zwei Wege, ein Panel:** Umschalter **Tab** (neue Aktion `stats` in
  `data/input.json`, `e.preventDefault()` sonst wandert der Fokus) und
  **immer während der Pause**. Damit ist die Anzeige auf dem Handy ohne
  einen zusätzlichen Knopf erreichbar — dort gibt es keine Tastatur, aber
  den Pausenknopf.
- Gezeigt werden Tempo, Geschosstempo, Nachladen, Abpraller, Magazin,
  Bomben, Bombenradius sowie — falls vorhanden — Gadget samt Restabklingzeit,
  Dash, Schildladungen und der aktive Raum-Modifikator (der genau diese
  Zahlen verändert und sonst nur in der Vorschau steht).
- Hinweiszeile unter dem Spielfeld auf die seit P4/P7 neuen Tasten
  aktualisiert (Q = Gadget, E = zünden, Tab = Werte).

**Test:** Fake-Canvas schreibt jeden `fillText` mit — geprüft wird, dass das
Panel überhaupt Text ausgibt (eine leere Box wäre sonst grün), dass alle
Zeilen da sind, dass ein Tempo-Upgrade die ausgewiesene Abweichung
verändert, dass die Pause es einblendet und dass es **nicht** dauerhaft im
Bild steht. Gegenprobe für alle drei Kernpunkte bestanden.

## P8 — Mobile Zwischenraum-UI ✅ gebaut

Unverändert. **Beachten:** Die Raumvorschau zeigt seit der letzten
Balancerunde Upgrade-Chips mit Symbolen; P8 nimmt sie aus dem Hauptbereich
wieder heraus und verschiebt sie auf die Vollbild-Seite. Die Symbole aus
`data/upgrades.json` werden dort weiterverwendet.

### Umsetzung (gebaut)

Die Chipreihe der eigenen Ausrüstung ist aus dem Hauptbereich der
Raumvorschau verschwunden; an ihrer Stelle steht **eine Zeile** — ein Knopf
„Deine Ausrüstung (N) ▸" auf eine eigene Vollbild-Seite
(`#previewUpgrades`).

Das **verstärkt** den Bugfix aus der letzten Balancerunde, statt ihn
zurückzunehmen: der Hauptbereich wird dadurch kürzer, nicht länger, und der
„Weiter"-Knopf rückt weiter vom Bildschirmrand weg.

- **Auf der eigenen Seite ist Platz**, deshalb stehen Symbol, Name, Stufe
  und Wirkung dort direkt nebeneinander — der „Tippe für Details"-Umweg der
  Chips entfällt. Die Symbole aus `data/upgrades.json` werden
  weiterverwendet.
- **„Zurück" führt in die Vorschau, nicht in den Raum** — sonst wäre der
  Blick auf die Ausrüstung eine Einbahnstraße.
- **`hide()` räumt beide Seiten weg.** Genau diese Fehlerklasse hat schon
  einmal einen Run blockiert (Kartenscreen, der über dem Spielfeld liegen
  blieb) — in der Suite eigens zugesichert.
- **`#previewUpBack` ist `sticky`.** Gegenprobe: ohne die Regel liegt der
  Knopf bei 12 Karten auf **1076 px** in einem 375-px-Fenster, also weit
  außerhalb — dieselbe Falle wie damals beim „Weiter"-Knopf.

**Tests:** fünf Fälle in `tests/regression.mjs` (keine Chips mehr im
Hauptbereich, Knopf nennt die Kartenzahl, Seite listet jede Karte mit Name
und Wirkung, „Zurück" startet den Raum nicht, `hide()` räumt beides weg),
Gegenprobe für drei davon bestanden. `tests/uilayout.mjs` prüft die neue
Seite über alle vier Viewports mit.

Dafür musste `tests/domstub.mjs` um einen **`Image`-Stub** erweitert werden:
`preview.js` zieht über `renderer.js` die Sprite-Initialisierung mit, die
als Modul-Seiteneffekt `new Image()` aufruft. Ohne den Stub lässt sich das
Modul headless gar nicht importieren.

## P9 — Startbildschirm ✅ gebaut

**Was schon steht:** Startbildschirm mit Seed-Eingabe, Tages-Seed,
„Run fortsetzen", Schwierigkeitsauswahl, Bestwerte-Reset, drei
Options-Schalter (Ziellinie, Bedrohungslinien, reduzierte Bewegung), Mute.

**Was zu tun ist:** D-Pad-/Tastatur-Navigation mit sichtbarer Hervorhebung,
Vollbild-Button (Geste aus P2), Lautstärkeregler statt reinem Mute,
Eingabeprofil-Override (aus P1), „Spiel beenden" mit Bestätigung.

### Umsetzung (gebaut)

- **Neues Modul `src/ui/menunav.js`** (`createMenuNav`): generische
  Tastatur-/Gamepad-Fokusnavigation für Overlays (SPEC.md 9: „Menü
  navigieren"). NUR die Y-Achse bewegt den Fokus durch eine Liste (mit
  Anlauf-/Wiederholzeit wie bei typischer Menü-Bedienung); die X-Achse ist
  dem fokussierten Element vorbehalten, wenn es ein `<input type="range">`
  ist — sonst tut sie nichts. Touch braucht das nie, dort wird direkt
  angetippt (Doktrin-Tabelle).
- **`input.js: getMenuState()`** (neu): ein schlanker Poll ohne
  Spieler-Objekt — `getState(player)` setzt eins voraus (stickbasiertes
  Zielen), Menünavigation nicht. Tastatur nutzt dieselben Codes wie die
  Fahrsteuerung (Pfeiltasten sind in `data/input.json` bereits mit
  WASD kombiniert), Gamepad das D-Pad.
- **Lautstärkeregler** (`audio.js: setVolume/getVolume`): eigener Wert
  0..1, getrennt vom `muted`-Schalter. Beide wirken auf denselben
  Gain-Knoten (`applyGain()`) — Stumm gewinnt immer, der Reglerwert bleibt
  aber erhalten und gilt wieder, sobald entstummt wird. Der In-Game-Mute-
  Knopf bleibt unverändert für den schnellen Zugriff während der Runde.
- **Eingabeprofil-Override**: Knopfreihe statt `<select>` — gleiches
  Muster wie die Schwierigkeitsauswahl, jeder Knopf ein eigener
  Fokusstopp. Ruft `input.setProfile()`/`getProfile()`, die seit P1
  bereitstehen.
- **„Spiel beenden"**: `window.confirm()` + `window.close()` — dasselbe
  Bestätigungsmuster wie „Bestwerte zurücksetzen". `window.close()` wirkt
  nur auf Tabs/Fenster, die per Skript geöffnet wurden, oder in einer
  installierten PWA; sonst passiert nach der Bestätigung bewusst nichts
  Sichtbares statt einer Fehlermeldung.
- **Umsetzungsfund — zu viel Inhalt für den Hauptbildschirm:** Vollbild,
  Lautstärke, Eingabeprofil-Reihe, Reset und Beenden zusätzlich auf den
  Startbildschirm gepackt ließ ihn im Handy-Querformat nicht mehr ohne
  Scrollen passen (`tests/uilayout.mjs` maß 6–7 Bedienelemente unterhalb
  des sichtbaren Bereichs bei 667×375 — dieselbe Fehlerklasse wie der
  „Weiter"-Knopf-Blocker). Gelöst nach dem **P8-Muster**: eine eigene
  Einstellungsseite (`#settings`), erreichbar über einen Knopf
  „Einstellungen ▸" auf dem Hauptbildschirm, mit sticky „Zurück".
  `tests/uilayout.mjs` prüft seither auch diese Seite mit.
- **Nebenfund beim Bauen** (nicht Teil der Phase, aber blockierte die
  Lesbarkeit): Die neue Eingabeprofil-Reihe erbte dieselbe
  Selektor-Spezifitäts-Gleichstand-Falle wie die bestehende
  Schwierigkeitsauswahl — `.overlay button` und `.modes button` haben
  dieselbe Spezifität, bei Gleichstand gewinnt die später im Stylesheet
  stehende Regel (`.overlay button`), wodurch aktive und inaktive Knöpfe
  gleich golden aussahen. Für `.profiles` explizit behoben; die
  bestehende Schwierigkeitsauswahl bewusst unangetastet gelassen
  (separater Fund, nicht Teil von P9).
- **Tests**: `tests/regression.mjs` prüft `createMenuNav` isoliert
  (Fokus bewegen inkl. Anlaufzeit, Reglerverstellung, Bestätigen auf
  Knopf/Checkbox, `reset()`), `audio.js`s Lautstärke/Mute-Zusammenspiel
  und `getMenuState()` ohne Spieler — Gegenprobe für alle Kernpunkte
  bestanden. `tests/uilayout.mjs` prüft Start- **und** Einstellungsseite
  über alle vier Viewports; Gegenprobe zeigt, dass die aktuelle
  Einstellungsseite bei den vier getesteten Größen auch ohne `sticky`
  passt (vorsorglich trotzdem gesetzt, gleiches Muster wie `#previewUpBack`
  aus P8 — kein nachgewiesener Fehlerfall bei diesen Abmessungen, aber
  spätere Erweiterungen könnten das ändern).

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
