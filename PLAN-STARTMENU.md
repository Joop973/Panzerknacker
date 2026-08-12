# PLAN-STARTMENU.md

Phasenplan für Hauptmenü, Panzerklassenwahl, Schwierigkeitsgrad, Einstellungen, Codex-Galerie und Post-Run-Screen (Panzerknacker).

Format: Eine Phase pro Claude-Code-Session, konkrete Datei-Änderungen, 5 phone-testbare Schritte pro Phase.

> **Ist-Abgleich:** Vor dem Bau die Bestandsaufnahme `STARTMENU-BESTAND.md`
> lesen. Der Plan nennt mehrere Dateien falsch oder als „neu", obwohl sie
> existieren (u. a. `data/difficulty.json`, das Fokus-System `menunav.js`,
> die Klassen in `data/tanks.json`). Bei Widerspruch gilt `STARTMENU-BESTAND.md`.

---

## Grundsatzentscheidungen (gelten für alle Phasen)

**Menü-Navigation auf allen Geräten**
Alle Menüs nutzen ein einheitliches Fokus-System (`focusIndex` über eine Liste fokussierbarer Elemente pro Screen):
- Touch: direktes Antippen setzt Fokus + aktiviert
- Controller: D-Pad bewegt Fokus, A bestätigt, B zurück
- Tastatur: Pfeiltasten/WASD bewegen Fokus, Enter bestätigt, ESC zurück
- Maus: Hover setzt Fokus, Klick aktiviert

Kein Screen darf ausschließlich per Touch bedienbar sein. Regler (Sound, Sensitivität) brauchen ebenfalls Links/Rechts-Bedienung, nicht nur Drag.

**Browser-Zurück-Geste**
Auf dem Handy löst die Zurück-Wischgeste sonst das Verlassen der Seite aus. Menü-Screens pushen einen History-State; `popstate` wird auf `goBack()` gemappt. Im laufenden Run öffnet die Geste stattdessen das Pause-Menü.

**Zwei getrennte Panzer-Kategorien**
- *Spielbare Panzer* (Normal, Eis, Blitz, Feuer, Nekromant, …): zwei Flags — `seen` (im Codex sichtbar) und `unlocked` (in Klassenwahl wählbar). Aktuell alle `unlocked: true` für Testphase.
- *Gegner-Panzer* (generische Feinde, Eliten, Bosse): nur `seen`. Keine Freischaltung.

**Codex-Kategorien (4 Buttons)**
1. Eigene Panzer (spielbare Klassen)
2. Upgrades
3. Gegner (generische Feindpanzer + Eliten)
4. Bosse

Falls Eliten eine eigene Kategorie bekommen sollen: in Phase 7 entscheiden, dann 5 Buttons.

**Element-Varianten im Codex**
Karten aus Shared Damage Pools zählen pro Element als eigener Eintrag. „Feuerschlag" und „Eisschlag" sind zwei Codex-Einträge, zwei separate `seen`-Flags, zwei Zähler in der Fortschrittsanzeige.

**Speicher-Timing**
`markSeen` schreibt NICHT sofort in localStorage. Änderungen werden in-memory gesammelt und gebündelt beim Raumwechsel und am Run-Ende geschrieben, um Frame-Drops auf dem Handy zu vermeiden. Einstellungen dagegen werden sofort geschrieben (kein Gameplay aktiv).

**Save-Versionierung**
Save bekommt ein `version`-Feld. Beim Laden greift eine Migrationsfunktion, die fehlende Felder mit Defaults auffüllt, statt den Save zu verwerfen.

**Settings-Screen als wiederverwendbare Komponente**
Der Settings-Screen wird so gebaut, dass er sowohl aus dem Hauptmenü als auch aus einem Pause-Menü aufrufbar ist. Aufrufkontext wird als Parameter übergeben und steuert nur den Zurück-Pfad, nicht den Inhalt.

**Debug-Flags**
Ein `debug`-Objekt (z.B. in `data/debug.json` oder als URL-Parameter `?debug=1`) mit mindestens:
- `codexRevealAll` — alle Einträge als gesehen darstellen
- `unlockAll` — alle Klassen freigeschaltet
- `skipToRun` — Menü überspringen, direkt in den Run

---

## Phase 0: Bestandsaufnahme & Vorbereitung

**Ziel:** Reale Projektstruktur erfassen, bevor irgendetwas gebaut wird. Verhindert falsche Dateipfade in allen Folgephasen.

**Änderungen:**
- Keine funktionalen Änderungen
- Neu: `STARTMENU-BESTAND.md` — Ergebnis der Bestandsaufnahme

**Zu klären und im Dokument festhalten:**
- Wo liegt der aktuelle Save-Code, welche Struktur hat er, gibt es schon ein `version`-Feld
- Existiert ein Pause-Menü, und wenn ja, wo
- Wie werden Panzer gerendert: Sprites oder Canvas-Zeichnung (entscheidet die Silhouetten-Lösung für Phase 8)
- IDs/Datenquellen für: spielbare Klassen, Gegner, Eliten, Bosse, Upgrade-Karten inkl. Element-Varianten
- Wo endet ein Run aktuell im Code (Einstiegspunkt für Post-Run-Screen)
- Welche Werte werden aktuell noch hardcodiert statt aus JSON gelesen

**Testschritte:**
1. `STARTMENU-BESTAND.md` existiert und listet alle konkreten Dateipfade
2. Save-Struktur ist als JSON-Beispiel im Dokument abgebildet
3. Render-Methode der Panzer ist eindeutig benannt (Sprite oder Canvas)
4. Alle vier Codex-Datenquellen sind mit Dateipfad und ID-Feld dokumentiert
5. Spiel läuft unverändert wie vorher (keine Regression durch die Session)

---

## Phase 1: Screen-Grundgerüst & Fokus-System

**Ziel:** Screen-State-Machine (main, class-select, difficulty, settings, codex, post-run, game) plus geräteübergreifendes Fokus-System plus Browser-Zurück-Handling.

**Änderungen:**
- Neu: `menu.js` — Screen-State, `showScreen(name)`, Screen-Stack für Zurück-Navigation
- Neu: `menu-focus.js` — `focusIndex`, `moveFocus(dir)`, `activateFocused()`, `goBack()`
- History-API: `pushState` bei Screen-Wechsel, `popstate` → `goBack()`
- Debug-Flags einlesen (`?debug=1`, `skipToRun`)
- Anbindung an die drei Control-Profile aus PLAN_ERWEITERUNG_INPUT_REWORK.md
- `index.html` — Menü-Overlay-Container

**Testschritte:**
1. Seite öffnen → Hauptmenü erscheint statt direktem Spielstart
2. Touch: Antippen eines Buttons wechselt Screen
3. Tastatur: Pfeiltasten bewegen sichtbaren Fokus-Rahmen, Enter aktiviert, ESC geht zurück
4. Handy-Zurück-Geste führt einen Screen zurück statt die Seite zu verlassen
5. `?debug=1&skipToRun` startet direkt einen Run ohne Menü

---

## Phase 2: Panzerklassenwahl-Screen

**Änderungen:**
- `data/tank-classes.json` — Felder `unlocked` und `seen` ergänzen
- `menu.js` — Klassenwahl-Screen mit Fokus-System, Auswahl-Highlight, Bestätigung
- Übergabe der gewählten Klasse an Spielstart
- Debug-Flag `unlockAll` berücksichtigen

**Testschritte:**
1. Alle spielbaren Klassen werden angezeigt
2. Auswahl markiert Klasse visuell eindeutig, unterscheidbar vom reinen Fokus-Rahmen
3. Gewählte Klasse wird im Run verwendet (Stats prüfen)
4. Navigation per D-Pad/Pfeiltasten funktioniert inkl. Zeilenumbruch im Grid
5. Testweise `unlocked: false` gesetzte Klasse ist sichtbar, aber nicht wählbar

---

## Phase 3: Schwierigkeitsgrad-Auswahl

**Änderungen:**
- Neu: `data/difficulty.json` — je Stufe: Gegner-HP-Multiplikator, Gegner-Schadensmultiplikator, ggf. Spawn-Rate
- `menu.js` — Schwierigkeits-Screen zwischen Klassenwahl und Spielstart
- Anbindung an Gegner-Spawn und Schadensberechnung

**Testschritte:**
1. Alle 3 Stufen auswählbar, mit Kurzbeschreibung der Auswirkung
2. Leicht vs. Schwer im Run messbar unterschiedlich (Gegner-HP prüfen)
3. Normal ist vorbelegt
4. Auswahl per Tastatur/Controller möglich
5. Auswahl bleibt bei Zurück-Navigation erhalten

---

## Phase 4: Einstellungen — Grundgerüst & Sound

**Ziel:** Settings-Screen als wiederverwendbare Komponente, Sound-Bereich fertig.

**Änderungen:**
- Neu: `settings.js` — Screen mit Kontext-Parameter (`from: 'mainmenu' | 'pause'`)
- Sound-Bereich: Master/Musik/SFX, Regler mit Links/Rechts-Bedienung in 10%-Schritten
- Sofortige Persistenz über bestehendes Save-System

**Testschritte:**
1. Regler verändern Lautstärke in Echtzeit hörbar
2. Bedienung per Touch-Drag UND per Pfeiltasten/D-Pad möglich
3. Werte bleiben nach Reload erhalten
4. Musik und SFX getrennt auf 0 setzbar
5. Screen mit `from: 'pause'` aufgerufen führt beim Zurück ins Pause-Menü, nicht ins Hauptmenü

---

## Phase 5: Einstellungen — Steuerung

> **Erledigt, Sensitivität auf Nutzerentscheidung ersatzlos gestrichen**
> (Muster `PLAN-INPUT.md` P5/Schild). Ist-Abgleich: der Turm zielt bei jedem
> Gerät instant (kein Turn-Speed-Wert im Code) — ein „spürbarer"
> Sensitivitäts-Regler hätte eine neue Dreh-Geschwindigkeitsbegrenzung
> gebraucht, die das Kernzielgefühl für alle Profile ändert. Phase 5 bleibt
> bei der Verifikation der bestehenden Profil-Wahl (Testschritte 1/3/4/5).
> Details in `CLAUDE.md`.

**Änderungen:**
- ~~`settings.js` — Steuerung-Bereich~~ (Profil-Wahl existierte schon seit
  P1/P9, seit Phase 4 in `settings.js` verdrahtet)
- ~~Profil-Wahl (Touch/Controller/Tastatur) + Sensitivität~~ — Sensitivität
  gestrichen, Profil-Wahl verifiziert (`regression.mjs` 8n)
- ~~Verknüpfung mit PLAN_ERWEITERUNG_INPUT_REWORK.md~~ (heißt real
  `PLAN-INPUT.md`, war bereits verknüpft)

**Testschritte:**
1. ✅ Profilwechsel ändert tatsächliches Eingabeverhalten im Spiel
2. ❌ *entfällt* (Sensitivitäts-Regler gestrichen)
3. ✅ Manuelle Wahl überschreibt Auto-Erkennung dauerhaft
4. ✅ Einstellung übersteht Reload
5. ✅ Wechsel ohne Seiten-Neuladen möglich, Menü bleibt danach bedienbar

---

## Phase 6: Einstellungen — Grafik & Fortschritt zurücksetzen

> **Erledigt.** Ist-Abgleich vor dem Bau: `state.js: spawnParticles()`
> verbraucht `state.rng()`, denselben Strom wie KI-Entscheidungen — ein
> Performance-Modus, der die Spawn-Anzahl ändert, würde Seeds
> geräteabhängig machen. Deshalb rein render-seitig gelöst
> (`effects.js: drawParticles(ctx, state, drawFraction)`), Simulation
> unangetastet. Codex/Freischaltungen (Reset-Vorgabe) existieren erst ab
> Phase 7 — „Fortschritt" ist bis dahin die Bestwerte-Statistik. Testschritt
> 2 ehrlich gemessen statt behauptet: bei der realistischen Kappung (300
> Partikel) unter der Messschwelle, bei 10× der Kappung klar nachweisbar
> (97 % Ersparnis). Details in `CLAUDE.md`.

**Änderungen:**
- `settings.js` — Grafik-Bereich: Partikeldichte/Performance-Modus
- Flag an Rendering-Code übergeben
- „Fortschritt zurücksetzen"-Button mit zweistufiger Bestätigungsabfrage (löscht Codex + Freischaltungen, optional auch Einstellungen)

**Testschritte:**
1. ✅ Performance-Modus reduziert sichtbar Partikel/Effekte
2. ✅ (gemessen, nicht nur behauptet — s. o.) FPS-Unterschied bei vielen aktiven Bullets messbar
3. ✅ Standard ist volle Grafik, Einstellung übersteht Reload
4. ✅ Reset-Button verlangt eine Bestätigung und löscht danach den Fortschritt vollständig
5. ✅ Nach Reset lädt das Spiel fehlerfrei mit frischem Save

---

## Phase 7: Codex — Grundgerüst & Datenstruktur

> **Erledigt.** Eigenes Modul `src/game/codex.js` statt einer Erweiterung
> des bestehenden `stats`-Saves — eigener Schlüssel `panzerknacker_codex`
> (Muster `currentRun`). Eliten-Entscheidung: **keine eigene Kategorie**
> (Eliten sind Laufzeit-Affixe, `STARTMENU-BESTAND.md`). Noch keine echten
> `markSeen()`-Aufrufstellen — die kommen mit den Listenansichten in Phase
> 8–11. Details in `CLAUDE.md`.

**Änderungen:**
- Save-System erweitern: `version`-Feld, `codex.seen = { playerTanks: {}, upgrades: {}, enemies: {}, bosses: {} }`
- Migrationsfunktion für alte Saves
- Gebündeltes Schreiben: `markSeen()` setzt nur in-memory, `flushCodex()` schreibt bei Raumwechsel und Run-Ende
- `menu.js` — Codex-Hauptscreen mit Kategorie-Buttons und Fortschrittsanzeige („12/48")
- Debug-Flag `codexRevealAll`
- Entscheidung fixieren: Eliten eigene Kategorie oder nicht

**Testschritte:**
1. ✅ Codex-Screen zeigt Kategorie-Buttons mit Fortschrittszählern
2. ✅ Neuer Save initialisiert alle `seen`-Flags auf `false`
3. ✅ Alter Save lädt fehlerfrei und bekommt Codex-Struktur ergänzt
4. ✅ `markSeen` während eines Runs erzeugt keinen sofortigen localStorage-Write (in Konsole prüfbar)
5. ✅ Nach Raumwechsel ist der Fortschritt tatsächlich persistiert (Reload-Test)

---

## Phase 8: Codex — Eigene Panzer

> **Erledigt.** Silhouette ohne Sprite-Umbau: alle zehn Klassen teilen das
> `player`-Sprite (`STARTMENU-BESTAND.md`), eine „eingefärbte Sprite-Kopie"
> wäre also für alle identisch gewesen — stattdessen ein generisches,
> nach Schadenstyp eingefärbtes CSS-Icon. `fmtClassStats` aus `main.js`
> nach `src/game/classes.js` verschoben (eine Quelle für Klassenwahl UND
> Codex). Details in `CLAUDE.md`.

**Änderungen:**
- `menu.js` — Ansicht für spielbare Klassen
- Silhouetten-Lösung gemäß Phase-0-Ergebnis: bei Sprites eingefärbte Kopie, bei Canvas-Rendering einfarbige Zeichnung oder generisches Platzhalter-Icon
- Drei Zustände: ungesehen, gesehen aber gesperrt, gesehen und freigeschaltet

**Testschritte:**
1. ✅ Ungesehene Klassen als Silhouette mit „???"
2. ✅ Gesehene Klassen zeigen Name, Icon, Kurzstats, Passiv-Beschreibung
3. ✅ Klassenwahl markiert die gewählte Klasse als gesehen
4. ✅ Gesperrt-aber-gesehen visuell von freigeschaltet unterscheidbar
5. ✅ `codexRevealAll` zeigt alle Einträge vollständig an

---

## Phase 9: Codex — Upgrades

> **Erledigt.** Kein Filter/Untertab gebaut — nicht nötig für die fünf
> Testschritte, `.overlay { overflow-y: auto }` reicht bei 246 Einträgen.
> „Element-Varianten" gibt es laut `STARTMENU-BESTAND.md` nicht als
> Konzept (jede Element-Karte hat schon eine eigene `id`) — Testschritt 2/3
> reduzieren sich dadurch auf „die erhaltene id wird markiert, alle anderen
> bleiben unberührt", ohne Sonderlogik. `menunav.js` global um
> Scroll-Follow-Fokus erweitert (Testschritt 5). Details in `CLAUDE.md`.

**Änderungen:**
- `menu.js` — Upgrade-Ansicht
- Element-Varianten als separate Einträge
- Filter oder Untertabs nach Rarity/Element, falls die Liste zu lang wird

**Testschritte:**
1. ✅ Ungesehene Upgrades erscheinen als „???"
2. ✅ Erhalt eines Upgrades markiert genau die richtige Element-Variante als gesehen
3. ✅ Andere Element-Varianten derselben Basis-Karte bleiben ungesehen
4. ✅ Gesamtzahl der Einträge stimmt mit tatsächlicher Pool-Größe inkl. Varianten überein
5. ✅ Scroll-Position folgt dem Fokus bei Tastatur/Controller

---

## Phase 10: Codex — Gegner (generische Panzer + Eliten)

> **Erledigt.** Elite-Frage gelöst: Elite ist ein reiner Laufzeit-Affix ohne
> eigene `id` in `tanks.json` — statt neuer Typdaten ein zweiter,
> synthetischer Codex-Schlüssel je Typ (`t_grey::elite`), 22 statt 11
> Einträge. `markSeen` läuft weiterhin in `main.js` (keine neue Datei in
> `state.js`/`ai.js`) — eine reine Funktion `markVisibleEnemies()` nutzt die
> bereits bestehende Pro-Tick-Abtastung von Phase 1 (`teleEnemies`) mit.
> Details in `CLAUDE.md`.

**Änderungen:**
- `menu.js` — Gegner-Ansicht
- `markSeen` bei erstem Kontakt, nicht erst bei Kill
- Eliten visuell abgesetzt

**Testschritte:**
1. ✅ Ungesehene Gegner als „???"
2. ✅ Erstkontakt markiert Gegner als gesehen, auch wenn der Spieler stirbt
3. ✅ Elite-Varianten sind eigene Einträge
4. ✅ Liste vollständig, keine Duplikate
5. ✅ Navigation und Scrolling mit allen Eingabearten

---

## Phase 11: Codex — Bosse

**Änderungen:**
- `menu.js` — Boss-Ansicht
- `markSeen` bei Boss-Spawn

**Testschritte:**
1. Ungesehene Bosse als „???"
2. Erstkontakt markiert Boss als gesehen, auch bei Niederlage
3. Gesehene Bosse zeigen Name, Icon, Kurzinfo zu Angriffsmustern
4. Liste vollständig
5. Layout konsistent mit den anderen Kategorien

---

## Phase 12: Post-Run-Screen

**Ziel:** Auswertungsscreen nach Run-Ende (Brotato-Stil).

**Änderungen:**
- Neu: `post-run.js`
- `runStats`-Objekt einführen, das während des Runs mitschreibt
- Inhalte: Sieg/Niederlage, erreichter Raum, Klasse, Schwierigkeit, Laufzeit, finale Stats, alle gesammelten Upgrades als Grid, Kill-Zähler, Gesamtschaden
- Buttons: „Zurück zum Hauptmenü", „Nochmal (gleiche Klasse + Schwierigkeit)"
- `flushCodex()` beim Betreten des Screens auslösen

**Testschritte:**
1. Nach Tod erscheint der Auswertungsscreen statt direktem Menü-Sprung
2. Alle gesammelten Upgrades werden vollständig angezeigt
3. Finale Stats stimmen mit dem Spielzustand kurz vor Tod überein
4. „Nochmal" startet direkt mit gleicher Klasse und Schwierigkeit
5. Auf dem Handy ohne Abschneiden lesbar, mit allen Eingabearten bedienbar

---

## Phase 13: Freischalt-Notification-System

**Änderungen:**
- Neu: `notification.js` — Toast (Icon, Name, kurze Einblendzeit, Queue)
- Hooks bei Upgrade-Erhalt, Gegner-/Elite-/Boss-Erstsichtung, Klassen-Freischaltung
- Toast blockiert keine Eingaben, pausiert das Spiel nicht

**Testschritte:**
1. Neues Upgrade löst sichtbaren Toast aus
2. Neuer Boss/Elite bei Erstsichtung löst Toast aus
3. Bereits gesehene Inhalte lösen keinen erneuten Toast aus
4. Mehrere gleichzeitige Freischaltungen laufen als Queue nacheinander
5. Toast verschwindet automatisch, Gameplay läuft ununterbrochen weiter

---

## Phase 14: Integration & Polish

**Änderungen:**
- Übergänge zwischen Screens abrunden
- Tote Platzhalter aus früheren Phasen entfernen
- Save-Migration final testen
- Debug-Flags standardmäßig deaktiviert prüfen

**Testschritte:**
1. Kompletter Durchlauf: Hauptmenü → Klasse → Schwierigkeit → Run → Post-Run → Hauptmenü
2. Einstellungen bleiben über mehrere Sessions korrekt erhalten
3. Codex zeigt nach mehreren Runs plausiblen Fortschritt in allen Kategorien
4. Save-Migration: manuell ein Feld aus dem Save löschen, Spiel lädt trotzdem fehlerfrei
5. Ohne `?debug=1` sind keine Debug-Funktionen aktiv

---

## Offene Punkte für spätere Phasen
- Scharfschaltung der Klassen-Freischaltung (`unlocked: false` + Bedingungen definieren)
- Detailansicht einzelner Codex-Einträge über Kurzstats hinaus
- Persistente Meta-Statistiken über alle Runs hinweg (Gesamt-Kills, beste Welle pro Klasse)
- Telemetrie-Export für den itch.io-Release (kann auf `runStats` aus Phase 12 aufbauen)
