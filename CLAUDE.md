# PANZERKNACKER — Projektkontext für Claude

Top-down Panzer-Roguelike (Mechanik angelehnt an Wii Play „Tanks!"). Reines
HTML/CSS/JS + Canvas 2D, **kein Build-Schritt**. Läuft über einen Webserver
(nicht `file://`) bzw. auf GitHub Pages. Vollständige Spezifikation: `SPEC.md`.

## ⚠️ Dauerregel (immer befolgen)
Nach **jeder** Änderung: committen → nach `origin/main` rebasen →
`git push --force-with-lease` → **Pull Request nach `main` erstellen und
mergen** (squash). Nur so läuft GitHub Pages mit der neuesten Version.
Bei Service-Worker-relevanten Änderungen den Cache-Namen in `sw.js` erhöhen
(`panzerknacker-vNN`), sonst sehen Nutzer die alte Version offline.

- Entwicklungs-Branch: `claude/phase-1-telemetry-balance-7qpy1a`
- Repo: `Joop973/Panzerknacker`, Default-Branch `main`
- Vor dem Push testen (Node-Syntaxcheck + kurzer Playwright-Smoke, s. u.).
- Commit-/PR-Texte auf Deutsch. Kein Modell-Identifier in Commits/PRs.

## ⚠️ Diese Datei aktuell halten (Pflicht)
Am Ende **jeder** abgeschlossenen Aufgabe **diese `CLAUDE.md` mit
aktualisieren** und im selben PR mitmergen. So kann der Nutzer jederzeit den
Chat wechseln und der neue Chat kennt den echten Stand. Konkret:
- Abschnitt **„Aktueller Stand"** anpassen (neue gemergte PRs eintragen).
- **To-dos** abhaken/entfernen bzw. neu entdeckte Punkte ergänzen.
- Bei Architektur-/Datei-/Ablauf-Änderungen die betroffenen Abschnitte oben
  nachziehen (z. B. neue Datei, neues Upgrade-Feld, geänderter Testbefehl).
Kurz halten, keine Doppelungen. Änderungen an dieser Datei brauchen **keinen**
Service-Worker-Bump (kein Spiel-Asset).

## Antwortsprache
Der Nutzer schreibt Deutsch → **immer auf Deutsch antworten.**

## Aktueller Stand (Stand: 2026-07)
Alle 10 Phasen umgesetzt; deterministisch; PWA/Offline; Touch + Gamepad;
viele Upgrades. Zuletzt gemergt (PRs #9–#12):
- Startet nicht mehr fälschlich pausiert (Portrait-Auto-Pause fixt sich im Querformat).
- Echtes Handy-Vollbild im Querformat (`100dvh` + `viewport-fit=cover`).
- **Grafik-Sprites** für Panzer (Rumpf+Turm), Böden/Wände, Geschosse + neues App-Icon.
- Diese `CLAUDE.md`.

### Phase 1 (Balance & Lesbarkeit + Telemetrie) — Branch `claude/phase-1-telemetry-balance-7qpy1a`
- Neue Balance-Datei **`data/balance.json`** (aus Code referenziert, keine
  hartkodierten Zahlen): `bullet.lifetime` 3.5, `bullet.maxActive` 5,
  `bullet.maxActiveCap` 8, `bullet.selfImmunity` 0.35; `mine.fuse` 3.0,
  `mine.radius` 64, `mine.chainDelay` 0.15, `mine.warningTime` 0.5.
  (Die alten Minen-Felder `selfDetonateS/explosionRadiusPx/chainDelayS`
  aus `tanks.json` sind entfernt — jetzt in `balance.json`.)
- **Geschosse lesbarer**: hartes Despawn nach 3,5 s (unabhängig von
  Restabprallern); Kugel wird erst nach dem **ersten Abpraller** gefährlich
  für den Spieler (+ heller Glow + kurzer Tick-Sound); Selbst-Immunität
  0,35 s nach Abschuss; harter Aktiv-Kugel-Cap (8) für den Spieler.
- **Minen lesbarer**: pulsierender Warnring im Explosionsradius in den
  letzten 0,5 s vor der Selbstzündung; Kettenreaktion mit 0,15 s
  Verzögerung pro Glied.
- **Telemetrie** (`src/core/telemetry.js`): schreibt pro beendetem Run ein
  Objekt in `localStorage.runs` (Array, max. 100). Erfasst Seed, Zeit,
  erreichter Raum, Todesursache (`enemy_bullet/own_bullet/own_mine/
  enemy_mine`) + Gegnertyp, pro Raum Dauer+Leben, gewählte Upgrades in
  Reihenfolge + abgelehnte Alternativen. Verdrahtet rein beobachtend in
  `main.js`; die Spiellogik liest nie Telemetriedaten. **Debug-Tabelle +
  JSON-Export nur bei `?debug=1`** in der URL, sonst unsichtbar/inaktiv.

### Phase 2 (Upgrade-Schema) — gemergt
- **Neues Upgrade-Schema** in `data/upgrades.json`: jeder Eintrag hat `id`,
  `tag`, `rarity` (`common`/`rare`/`legendary`), `maxStacks`, `requires`,
  `minRoom`, `description`. Alle 39 Altupgrades migriert. (`desc`/`max`
  ersetzt durch `description`/`maxStacks`; Berserker-Effektfeld heißt jetzt
  `maxStacksEffect`, um mit dem Schema-`maxStacks` nicht zu kollidieren.)
- **Auswahllogik** `src/game/upgradepool.js`: 3 Karten, **nie zwei gleiche
  Tags**; Rarity-Gewichte + `legendary.minRoom` aus `balance.json`;
  `maxStacks`/`requires`/`minRoom` gefiltert; Tags `weapon`+`elite` vom
  Pool ausgeschlossen; zu wenige Karten → mit `stat`-Fallback aufgefüllt
  (kein Crash). `run.js` delegiert `rollOffers` daran (deterministisch über
  `genRng`).
- **`emergency_shield`** (Tag `defense`, `rare`, `maxStacks 3`): je Stufe
  +3 Schildladungen, raumübergreifend (`run.shieldCharges` → `state.shieldCharges`),
  keine Regen. Jede Ladung absorbiert genau einen Treffer (in `killTank` vor
  der alten Schild-Logik). Anzeige als konzentrische Ringe um den Panzer.
- **Telemetrie** protokolliert gewählte/abgelehnte Karten jetzt als Objekte
  mit `id` + `tag` (+ name/rarity).
- Upgrade-Karten zeigen Tag + Seltenheit (Rahmenfarbe nach Rarity in `style.css`).

### Phase 3 (Schrott-Währung) — gemergt
- **Schrott** als Run-State (`run.scrap`), Werte in `data/balance.json`
  (`scrap.perRoom [1,3]`, `eliteBonus 3` (erst Phase 4), `cost.reroll 2`,
  `cost.ban 1`, `cost.fourthCard 3`, `cost.shieldCharge 4`). Pro geräumtem
  Raum 1–3 Schrott (deterministisch über `genRng`) + Floating-Text
  „+N Schrott". Permanent im HUD (`⚙ N`).
- **Vier Upgrade-Screen-Aktionen** (`src/game/run.js`: `rerollOffers`,
  `banOffer`, `buyFourthCard`, `buyShieldCharge`; UI in `upgradescreen.js`,
  verdrahtet in `main.js`): Neu würfeln, Verbannen (pro Karte, ✕-Knopf),
  Vierte Karte (Deckel 4), Schildladung (+1, auch ohne Schild-Upgrade). Preis
  sichtbar, ausgegraut bei zu wenig Schrott; Screen rendert nach jeder Aktion
  neu. Schrott nie negativ (jede Aktion prüft Kosten).
- **Verbannte ids** in `run.bannedUpgrades` (Set, nicht `localStorage`); der
  Pool filtert sie. Bei Run-Ende weg (frischer `createRun`). Ban ersetzt die
  Karte durch eine neue mit anderem Tag (`upgradepool.drawOne`).
- **Telemetrie**: `scrapEarned` pro Raum, `scrapSpends` (Typ+Raum),
  `bans` (id+Raum) im Run-Objekt; Debug-Tabelle zeigt Schrott/Verbannt.
- **Blutrausch** abgeschwächt: Unverwundbarkeit pro Kill nur noch
  `iframeS 0.35` (statt 1,4 s), Tempo-Schub bleibt. Text „nach jedem
  getöteten Gegner".
- **Endlosmodus-Fix**: nur ein NEU auf dem Endscreen begonnener Tipp führt
  ins Menü (der spielbeendende Tipp löste sonst sofort `backToStart`).

### Offene Punkte / To-do (nice-to-have, nicht dringend)
- [ ] **Vor Phase 6**: 15–20 Runs spielen und `localStorage.runs` (Export
      über `?debug=1`) auswerten (meistabgelehnte Upgrades + Endraum), sonst
      wird Welle 1 blind gebaut. Siehe `PLAN.md`.
- [ ] Sprite-Look für **feste Wand** (`tile_wall`) und **Loch** (`tile_hole`)
      im Spiel noch mit eigenem Auge prüfen — Code-Pfad identisch zu
      breakable (das rendert korrekt), aber nicht separat verifiziert.
- [ ] Geschoss-Sprites wirken recht hell/groß (weißer Glow-Blob). Ggf. Größe
      (`3.6 * b.radius` in `renderer.js`) oder Glow-Matte reduzieren.
- [ ] Noch **prozedural** (keine Sprites vorhanden): Minen, Kampfdrohne,
      Klingenkranz, Fallen, Explosionen/Partikel. Bei Bedarf Grafiken liefern.
- [ ] Determinismus-Regression (5 Seeds → Sieg) nach den Render-Änderungen
      nicht erneut gelaufen (nur Rendering geändert → Logik unberührt),
      bei nächster Gelegenheit einmal bestätigen.

Wenn ein Punkt erledigt ist: Haken setzen bzw. Zeile entfernen.

## Tech / Architektur
- **ES-Module**, kein Bundler. Einstieg `src/main.js`, verdrahtet alles.
- **Fixed-Timestep-Loop** 60 Hz mit Akkumulator + Render-Interpolation (`alpha`).
  `src/core/loop.js`.
- **Deterministisch**: gesäter RNG (Mulberry32, `src/core/rng.js`), zwei Ströme
  (`genRng` = Raumbau, `aiRng` = KI). Gleicher Seed → gleicher Verlauf.
- **Datengetrieben**: ALLE Balance-Werte in `data/*.json`
  (`tanks.json`, `upgrades.json`, `tiles.json`, `difficulty.json`,
  `balance.json`). `balance.json` enthält auch Rarity-Gewichte,
  `legendary.minRoom` + die `scrap`-Werte (Phase 3).
  `src/game/cfg.js` löst Typen auf und wendet Upgrades an.
  `data/balance.json` wird in `main.js` an `tanksData.balance` gehängt und
  ist so über `state.data.balance` überall verfügbar.
- **Kollision**: Kreis-vs-AABB mit Gleiten; Panzer blockt Panzer; Abpraller-
  Physik mit Eckenfall (`src/game/bullet.js`, `collision.js`).
- **Dateien möglichst < ~300 Zeilen** halten (bei Bedarf aufsplitten, wie
  `effects.js`/`cfg.js`).

### Wichtige Dateien
- `src/game/state.js` — `stepState`, Treffer, Minen, Drohne, Melee, `killTank`.
- `src/game/tank.js` — Feuern, Minen legen/werfen.
- `src/game/cfg.js` — Panzer-cfg + alle ~39 Upgrade-Effekte.
- `src/game/upgradepool.js` — Auswahl-Pool (Tag-Regel, Rarity, maxStacks,
  requires, minRoom); von `run.js` genutzt.
- `src/render/renderer.js` — zeichnet alles (interpoliert). Nutzt Sprites,
  fällt auf prozedurale Formen zurück, falls Grafik fehlt/lädt.
- `src/render/sprites.js` — lädt die PNG-Sprites (async, mit Fallback).
- `src/ui/touchcontrols.js` — Touch: schwebende Twin-Sticks (DOM) + Minen-
  **Wurfstick** (Pointer Events + `setPointerCapture`).
- `src/core/telemetry.js` — Run-Telemetrie in `localStorage.runs` +
  Debug-Ansicht (nur `?debug=1`). Reine Beobachtung, keine Spiellogik.
- `sw.js` — Service Worker (Offline-Cache, cache-first). Cache-Version bumpen!
  (Aktuell `v29`; `data/balance.json`, `src/core/telemetry.js` +
  `src/game/upgradepool.js` im Cache.) **Bewusst KEIN `skipWaiting()`/
  `clients.claim()`** — sonst kann eine laufende Seite mitten im Start alten
  Code mit neuen `data/*.json` mischen (Upgrade-Screen zeigt dann nur
  „+1 Leben"). Update greift erst nach vollständigem Neustart (Tab/App zu).

## Grafik / Sprites
- Panzer je Typ: `assets/sprites/body_<typ>.png` (Front zeigt nach oben →
  Rotation `heading + PI/2`) + `turret_<typ>.png` (Rohr zeigt nach rechts =
  Winkel 0, Dom-Pivot zentriert → Rotation `turret`).
- Kacheln `tile_{floor,wall,breakable,hole}.png`, Geschosse
  `bullet_{normal,rocket,bounce,tungsten,explosive}.png`.
- Typen: `player`, `t_brown`, `t_grey`, `t_teal`, `t_yellow`, `t_pink`,
  `t_green`, `t_purple`, `t_white`, `t_black`.
- Spieler-Glow, Schild-Ring, Ziellinie, Betäubungs-Ring und die
  Unsichtbarkeit des Weißen sind Renderer-Overlays (nicht im Sprite).

## Mobile / PWA
- PWA (`manifest.json`), Vollbild im Querformat: `100dvh` + `viewport-fit=cover`,
  Canvas füllt die Höhe, schwarze Flanken links/rechts für Sticks/Buttons.
- Portrait → pausiert; zurück ins Querformat → automatisch fortsetzen.
- iOS: echtes Element-Vollbild nicht unterstützt → „Zum Startbildschirm
  hinzufügen" für randlos. Android: `requestFullscreen`.

## Lokal testen
```
python3 -m http.server 8099        # dann http://localhost:8099/index.html
node --check src/<datei>.js         # Syntax
```
Playwright-Browser liegt unter `/opt/pw-browsers/chromium`
(`executablePath` setzen; NICHT `playwright install`).
Regressions-Standard: 5 Seeds sollen über 16 Räume deterministisch bis zum
Sieg durchlaufen.
