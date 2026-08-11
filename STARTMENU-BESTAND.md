# STARTMENU-BESTAND.md

Bestandsaufnahme für `PLAN-STARTMENU.md` (Phase 0). Erfasst den **echten**
Projektzustand, bevor gebaut wird — der Plan wurde ohne genaue Kenntnis der
Ist-Struktur geschrieben und nennt mehrere Dateien falsch oder als „neu",
obwohl sie existieren. Diese Datei ist die verbindliche Referenz für alle
Folgephasen; bei Widerspruch gilt sie, nicht der Plan.

Stand: 2026-08-11. Branch `claude/startmenu-phasenplan-o4n0d5`.

---

## 1. Save-Code: wo, welche Struktur, `version`-Feld?

**Datei:** `src/core/storage.js` (kein zentrales „Save-Objekt", sondern
mehrere getrennte `localStorage`-Schlüssel). Fällt `localStorage` weg (Tests,
privater Modus), wird still im Speicher gehalten.

| Schlüssel | Inhalt | API |
|---|---|---|
| `panzerknacker_stats_v1` | Meta-Statistik: `runs`, `wins`, `totalKills`, `mostRooms`, `bestCombo`, `fastestWinS` | `loadStats()`, `recordRun()`, `resetStats()` |
| `panzerknacker_flag_<name>` | Boolean-Flags (z. B. `tutorial_seen`) | `getFlag()`, `setFlag()` |
| `panzerknacker_pref_<name>` | JSON-Einstellungen (`mode`, `starterTank`, `volume`, `muted`, `threatLines`, `reduceMotion`, `aimLine`, `inputProfile`) | `getPref()`, `setPref()` |
| `currentRun` | Snapshot des laufenden Runs (Seed, Raum, Leben, Upgrades …) | `saveCurrentRun()`, `loadCurrentRun()`, `clearCurrentRun()` |

**`version`-Feld: existiert NICHT** — weder in `stats` noch in einem
übergreifenden Save-Objekt. Das `_v1` im Stats-Schlüsselnamen ist nur eine
Namenskonvention, keine gelesene Zahl. Phase 7 (Save-Versionierung +
Migration) muss das von Grund auf einführen. Einstellungen liegen bereits
einzeln als Prefs vor (werden **sofort** geschrieben — passt zum Plan:
„Einstellungen sofort, Codex gebündelt").

**Save-Struktur als JSON-Beispiel (Ist-Zustand):**
```jsonc
// localStorage['panzerknacker_stats_v1']
{ "runs": 12, "wins": 3, "totalKills": 340, "mostRooms": 14,
  "bestCombo": 7, "fastestWinS": 512.3 }
// localStorage['panzerknacker_pref_mode']        -> "normal"
// localStorage['panzerknacker_pref_starterTank'] -> "c_frost"
// localStorage['panzerknacker_pref_volume']      -> 100
// localStorage['panzerknacker_flag_tutorial_seen'] -> "1"
// localStorage['currentRun'] -> { seed, roomIndex, lives, upgrades, ... }
```
Kein `codex`-Objekt vorhanden — Phase 7 legt es an.

---

## 2. Pause-Menü: existiert es?

**Nein — es gibt keinen Pause-Screen.** `src/ui/pause.js` ist nur ein
Boolean-Umschalter (`createPause()` → `toggle()`/`set()`/`isPaused()`), kein
Overlay. Der Pausezustand wird von `hud.js` als Text ins Canvas gezeichnet,
nicht als DOM-Overlay. Auslöser: `#pauseBtn` (oben mittig, HTML),
Desktop `Esc`/`P` (`input.consumePause()`), Auto-Pause bei Tab-Fokusverlust
und Portrait.

Im pausierten Zustand gibt es zwei **Tastatur**-Aktionen (`main.js`
`keydown`): `R` = Run mit gleichem Seed neu, `M` = zurück zum Hauptmenü. Auf
Touch/Controller **nicht** erreichbar. → Der Plan will Settings auch aus
einem Pause-Menü aufrufbar machen (Phase 4, `from: 'pause'`); ein echtes
Pause-Overlay muss dafür erst gebaut werden. Die Browser-Zurück-Geste soll
im Run das Pause-Menü öffnen (Grundsatz „Browser-Zurück") — aktuell gibt es
dafür nichts.

---

## 3. Render-Methode der Panzer (entscheidet Silhouetten-Lösung, Phase 8)

**Sprites mit prozeduralem Fallback.** `src/render/sprites.js` lädt
`assets/sprites/body_<typ>.png` + `turret_<typ>.png` asynchron; fehlt/lädt
eine Grafik, zeichnet `renderer.js` eine prozedurale Form. Ein
`SPRITE_ALIAS` mappt Typen ohne eigenes Sprite:
- alle zehn Spielklassen (`player`, `c_*`) → **`player`**-Sprite (identisches
  Aussehen, Unterschied nur über Overlays),
- `t_armored`→`t_grey`, `t_prism`→`t_teal`, die drei Bosse → geborgte Wannen.

**Folge für Phase 8 (Codex-Silhouetten):** Da die Klassen kein eigenes
Sprite haben, ist eine „eingefärbte Sprite-Kopie" pro Klasse **nicht** ohne
Weiteres unterscheidbar (alle nutzen dasselbe `player`-Sprite). Empfehlung:
generisches Silhouetten-Icon + Einfärbung nach `damageType`-Farbe der Klasse
(`data/status.json: damageTypes[...].color`), nicht eine je Klasse
verschiedene Sprite-Kopie. Endgültig in Phase 8 entscheiden.

---

## 4. Die vier Codex-Datenquellen (Pfad + ID-Feld)

Alle vier liegen in **`data/tanks.json`** bzw. **`data/upgrades.json`** —
**nicht** in den vom Plan genannten `data/tank-classes.json` /
`data/enemies.json` (die es nicht gibt).

| Codex-Kategorie | Datei | ID-Feld / Auswahl | Anzahl (Ist) |
|---|---|---|---|
| **1. Eigene Panzer** (Klassen) | `data/tanks.json` → `types[*]` mit `player: true` | Objektschlüssel (`player`, `c_blast`, …), Name in `label` | **10** |
| **2. Upgrades** | `data/upgrades.json` → `upgrades[*]` | `id` (= Schlüssel), `name`, `tag`, `rarity`, `damageType?` | **246** |
| **3. Gegner** (generisch) | `data/tanks.json` → `types[*]`, kein `player`, keine Boss-Flags | Schlüssel `t_*`, Name in `label`, `role` | **11** (`t_brown`, `t_grey`, `t_teal`, `t_yellow`, `t_pink`, `t_green`, `t_purple`, `t_white`, `t_armored`, `t_prism`, `t_black`) |
| **4. Bosse** | `data/tanks.json` → `types[*]` mit `bossInvincible`/`mirrorBoss`/`phalanx` | Schlüssel, Erkennung über `isBossCfg()` (`cfg.js:488`) | **3** (`t_reactor`, `t_mirror`, `t_phalanx`) |

**Zwei wichtige Abweichungen vom Plan:**

- **Eliten sind KEINE eigenen Panzertypen.** Es gibt keine Elite-Einträge in
  `tanks.json`. „Elite" ist ein zur Laufzeit auf einen normalen `t_*`-Typ
  gewürfelter **Affix** (`run.js: rollEliteAffixes`, `difficulty.json:
  elite`). Der Plan (Phasen 7/10) behandelt Eliten als eigene Codex-Einträge
  — das muss neu entschieden werden: entweder pro (Typ×Affix)-Kombination
  ein Eintrag, oder Eliten fallen als eigene Kategorie weg. **Empfehlung:
  keine eigene Elite-Kategorie** (Grundsatz „falls Eliten eigene Kategorie:
  in Phase 7 entscheiden" → Entscheidung: nein, weil datenseitig kein
  eigenes Objekt existiert).

- **„Element-Varianten derselben Basis-Karte" existieren so nicht.** Die 72
  typgebundenen Upgrades (6 Elemente × 12) sind **je eine eigene `id`** mit
  eigenem `name` (z. B. eigene Feuer-/Frost-Karten), **keine** eine Basis-ID
  mit sechs Element-Ausprägungen. Für den Codex heißt das: **jede der 246
  `id`s ist genau ein Eintrag** — der vom Plan geforderte „ein Codex-Eintrag
  pro Element" ist bereits durch die getrennten IDs erfüllt, es braucht
  keine künstliche Aufspaltung. Gesamtzahl Codex-Upgrades = **246**.

Gesamt-Codex (Ist): **10 + 246 + 11 + 3 = 270** Einträge über vier
Kategorien.

---

## 5. Wo endet ein Run im Code? (Einstiegspunkt Post-Run-Screen, Phase 12)

**`src/game/run.js: finishRun(run, won)` (Zeile 723).** Setzt
`run.phase = won ? 'victory' : 'gameover'`, ruft `clearCurrentRun()` und
`recordRun()` (Statistik), setzt `run.newRecord`.

Erkannt wird das Run-Ende in **`src/main.js`**:
- `updateTelemetry()` (`main.js:295`) schreibt bei `gameover`/`victory` den
  letzten Raum + `telemetry.endRun(...)`.
- Der Endscreen ist heute **nur ein HUD-Canvas-Text** (`hud.render` mit
  `run.phase`), **kein Overlay**. Zurück ins Menü: `Enter` oder ein neuer
  Tipp aufs Spielfeld → `backToStart()` (`main.js:1075`).

**Bereits mitgeführte Run-Statistik** (Basis für `runStats`, Phase 12):
`run.kills`, `run.playTime`, `run.roomsCleared`, `run.deaths`,
`run.roomIndex`, `run.upgrades`, `run.starterTank`, `run.modeKey`,
`run.newRecord`. Gesamtschaden/Kill-je-Typ sind **nicht** pro Run
aggregiert (nur `state.damageByType` pro Raum, in der Telemetrie) — Phase 12
muss das bei Bedarf ergänzen.

---

## 6. Was ist bereits gebaut (der Plan hält es fälschlich für „neu")?

Der Plan überschätzt, wie viel fehlt. **Vieles existiert schon:**

- **Fokus-/Menü-Navigation (Plan Phase 1 „menu-focus.js"):** existiert als
  **`src/ui/menunav.js`** (`createMenuNav(getFocusables)`), inkl.
  Auto-Repeat, Regler-Links/Rechts, `reset()`. Verdrahtet für Start-,
  Einstellungs-, Klassen-Screen **und** die In-Run-Overlays (Upgrade/Karte/
  Shop/Event/Vorschau). Touch + Maus + Tastatur + Gamepad laufen parallel
  (`input.getMenuState()`, `input.setProfile()`/`getProfile()`).
- **Startmenü:** existiert (`index.html #start`) mit Schwierigkeits-Segment,
  Seed-Eingabe, Tages-Seed, „Run fortsetzen", Optionen.
- **Klassenwahl (Plan Phase 2):** existiert (`#classScreen`, `main.js`
  `buildClassList()`), Wahl in `setPref('starterTank')`, wird im Run genutzt
  und im Snapshot gespeichert. **Fehlt:** `unlocked`/`seen`-Flags,
  Codex-Anbindung.
- **Schwierigkeit (Plan Phase 3):** existiert in `data/difficulty.json:
  modes` (`leicht`/`normal`/`schwer`) — aber **nur `budgetMult` + `lives`**,
  **kein** Gegner-HP-/Schadensmultiplikator (die will Phase 3 neu). Auswahl
  bereits im Startmenü, in `getPref('mode')` persistiert.
- **Einstellungen (Plan Phase 4–6):** eigener `#settings`-Screen mit
  Lautstärkeregler, Eingabeprofil-Reihe, Vollbild, „Bestwerte zurücksetzen",
  „Spiel beenden". **Kein** wiederverwendbares `settings.js`-Modul,
  **kein** `from`-Kontextparameter, **kein** Grafik-/Performance-Schalter,
  **kein** vollständiger „Fortschritt zurücksetzen" (nur Bestwerte).
- **Debug:** `?debug=1` (`telemetry.isDebugEnabled()`, `input.isDebug()`)
  existiert — steuert nur Telemetrie-Ansicht + Status-Debugtasten.
  **Fehlt:** `data/debug.json`, `codexRevealAll`, `unlockAll`, `skipToRun`.

**Was wirklich fehlt (echte Bau-Arbeit des Plans):** Screen-**State-Machine**
mit Stack (`menu.js`), **History-API/`popstate`** (aktuell *gar nicht*
vorhanden), echtes **Pause-Overlay**, **Codex** (Struktur + vier Ansichten +
Fortschritt), **Save-Versionierung/Migration**, **Post-Run-Screen**,
**Freischalt-Toasts** (`notification.js`), Grafik-/Reset-Einstellungen.

---

## 7. Hardcodierte Werte (statt aus JSON)

Der Codebase ist stark datengetrieben (CLAUDE.md „ALLE Balance-Werte in
`data/*.json`"). Für den Startmenü-Umbau relevant:
- **Schwierigkeit** ist datengetrieben (`difficulty.json: modes`), aber die
  **Namen/Reihenfolge der drei Modi** stehen zusätzlich hartcodiert im
  HTML (`index.html #modeSelect`). Ein vierter Modus bräuchte HTML + JSON.
- **Klassenliste** kommt aus `tanks.json` (gut), aber die
  **Default-Klasse `'player'`** ist an mehreren Stellen als String verankert
  (`main.js`, `run.js: starterTank`-Default).
- **Menü-Text/Hinweiszeile** (Steuerung) steht statisch in `index.html`.
- **Debug-Flag** ist allein `?debug=1` (URL), keine Datei.

Kein blockierendes Hardcoding gefunden — der Umbau ist additiv möglich.

---

## 8. Plan-Korrekturen (verbindliche Pfad-/Namensliste)

| Plan sagt | Realität |
|---|---|
| `data/tank-classes.json` (neu) | Klassen liegen in **`data/tanks.json` → `types[*]` (`player:true`)** |
| `data/difficulty.json` (neu) | **Existiert** bereits (`modes`, aber ohne HP/DMG-Mult) |
| `data/enemies.json` | Gibt es nicht → **`data/tanks.json`** |
| `data/rooms.json` | Gibt es nicht → **`data/modifiers.json`** (analog früherer Pläne) |
| `menu-focus.js` (neu) | **Existiert** als `src/ui/menunav.js` |
| `PLAN_ERWEITERUNG_INPUT_REWORK.md` | Heißt real **`PLAN-INPUT.md`** (vollständig abgearbeitet) |
| Eliten als eigene Panzer/Codex-Einträge | Eliten sind **Laufzeit-Affixe**, keine Typen → keine eigene Kategorie |
| „Element-Varianten derselben Basis-Karte" | Jede Element-Karte hat **eigene `id`** → 246 Einträge, keine Aufspaltung nötig |
| Pause-Menü vorhanden | **Kein** Pause-Overlay, nur `pause.js` (Boolean) + Canvas-Text |

---

## 9. Testschritte Phase 0 (erfüllt)

1. `STARTMENU-BESTAND.md` existiert und listet konkrete Dateipfade. ✓
2. Save-Struktur als JSON-Beispiel abgebildet (Abschnitt 1). ✓
3. Render-Methode eindeutig benannt: **Sprites + prozeduraler Fallback**
   (Abschnitt 3). ✓
4. Alle vier Codex-Datenquellen mit Pfad + ID-Feld dokumentiert
   (Abschnitt 4). ✓
5. Keine funktionale Änderung → Spiel läuft unverändert; `node tests/
   regression.mjs` bleibt grün (nur Doku hinzugefügt). ✓
