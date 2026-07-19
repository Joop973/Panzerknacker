# SPEC.md — PANZERKNACKER — V3

Dieses Dokument ist die verbindliche Referenz für das Projekt.
Bei Unklarheiten gilt: **erst hier nachsehen, dann fragen.** Nichts implementieren, was
hier nicht steht, ohne vorher zu fragen.

---

## 1. Projektziel

Ein Top-Down-Panzer-Roguelike im Browser. **Spielgefühl, Mechanik und Gegnerverhalten
sollen an "Tanks!" aus Wii Play (Nintendo) erinnern** — abprallende Geschosse,
One-Hit-Kills, Minen, die charakteristischen Gegnertypen — erweitert um Run-Struktur,
prozedurale Räume und Upgrade-Auswahl.

**Spielname: PANZERKNACKER.**

**Wichtig zur Abgrenzung:** "Erinnern" heißt Mechanik und Spielgefühl, nicht Kopie.
Kein Asset, kein Sound und keine Grafik aus dem Original oder einem anderen kommerziellen
Spiel. Alle Grafiken sind eigene Pixel-Art. Die Namen "Tanks!", "Wii Play" und "Nintendo"
tauchen im Spiel selbst (UI, Titel, Store-Texte) nicht auf — nur hier in der Spec als
Design-Referenz für die Entwicklung.

**Run-Länge:** 15 Räume + 1 Finalraum, Ziel ca. 15 Minuten.
**Zielplattform:** Mobile (Landscape) primär, Desktop sekundär.

---

## 2. Technischer Stack

- Reines **HTML + CSS + JavaScript (ES-Module)**, Canvas 2D
- **Kein Build-Step, kein npm, keine Framework-Abhängigkeit.** Muss durch simples Öffnen
  der `index.html` laufen.
- Keine externen Libraries. Alles selbst geschrieben.
- Ziel: läuft auf einem Mittelklasse-Smartphone mit stabilen 60 FPS.

Begründung: Das Projekt wird vom Smartphone aus entwickelt. Alles, was einen Build-Prozess
oder eine Toolchain braucht, ist disqualifiziert.

---

## 3. Ordnerstruktur

```
/
├── index.html
├── style.css
├── SPEC.md
├── src/
│   ├── main.js            # Einstiegspunkt, Game-Loop
│   ├── core/
│   │   ├── loop.js        # Fixed Timestep
│   │   ├── input.js       # Touch / Keyboard+Maus / Gamepad
│   │   ├── rng.js         # Seeded RNG (Mulberry32)
│   │   └── audio.js       # WebAudio (Minimal-Audio ab Phase 5)
│   ├── game/
│   │   ├── state.js       # Run-State, Räume, Leben, Upgrades
│   │   ├── tank.js        # Panzer-Entity (Spieler + Gegner)
│   │   ├── bullet.js      # Geschosse + Abpraller-Physik
│   │   ├── mine.js        # Minen + Kettenreaktion
│   │   ├── ai.js          # Gegner-KI (getrennt: Turm / Fahrverhalten)
│   │   ├── collision.js   # Kollisionsroutinen
│   │   └── generator.js   # Raumgenerator (Kachelsystem)
│   ├── render/
│   │   ├── renderer.js
│   │   ├── tracks.js      # Reifenspuren-Bodenschicht (persistentes Buffer-Canvas)
│   │   └── camera.js
│   └── ui/
│       ├── hud.js
│       ├── upgradescreen.js
│       ├── pause.js
│       └── touchcontrols.js
└── data/
    ├── tanks.json         # Gegnerwerte
    ├── tiles.json         # Kacheldefinitionen
    ├── upgrades.json      # Upgrade-Katalog
    └── difficulty.json    # Budgetkurve + Freischaltkurve
```

**Harte Regel:** Alle Balancing-Werte leben in `/data/*.json`. Niemals Zahlen im Code
hardcoden, die man später tunen will. Ein Balancing-Update darf nie eine Code-Änderung sein.

---

## 4. Physik und Kernregeln

### Zeitschritt
- **Fixed Timestep, 60 Hz** (`dt = 1/60`). Akkumulator-Pattern.
- Rendering entkoppelt, mit Interpolation.
- Alle Bewegungs- und Kollisionswerte sind pro Sekunde definiert, nicht pro Frame.

### Koordinaten
- Arena als Raster. **Zellgröße 32 px.**
- Arena = 3×2 Kacheln à 8×8 Zellen = **24×16 Zellen = 768×512 px**.
- Interne Logik rechnet in Pixeln (Float), nicht in Zellen.

### Kollision
- Panzer: **Kreis**, Radius 12 px.
- Wände: **AABB** (achsenparallele Boxen, exakt 32×32).
- Geschosse: **Kreis**, Radius 4 px.
- Panzer-gegen-Wand: Sliding-Kollision (an der Wand entlanggleiten, nicht blockieren).
- **Panzer-gegen-Panzer: blockieren sich gegenseitig.** Kein Schieben, kein Überlappen.

### Geschosse
- Bewegen sich geradlinig mit konstanter Geschwindigkeit.
- **Basisgeschwindigkeit Spielerkugel: 130 px/s** (bewusst langsamer als `t_black`,
  damit dieser Kugeln überholen kann; macht außerdem das Ladung-Upgrade wertvoll).
- **Feuerrate-Cooldown: 0,25 s** zwischen zwei Schüssen — gilt auf allen Plattformen
  (Mobile Auto-Fire, Desktop-Maustaste, Gamepad), damit das Balancing identisch ist.
  Das Magazin-Limit gilt zusätzlich.
- **Abprallen an Wänden**: Reflexion an der Normalen der getroffenen Fläche.
- Jedes Geschoss hat ein `ricochetsLeft`. Bei 0 verbleibenden Abprallern und Wandkontakt →
  Geschoss verschwindet.
- **Eckenfall:** Trifft ein Geschoss eine Ecke (beide Achsen im selben Schritt), wird auf
  **beiden** Achsen reflektiert und **ein** Abpraller abgezogen.
- Geschosse zerstören sich **gegenseitig** bei Kollision (beide verschwinden).
- Geschosse zünden Minen bei Kontakt.
- Geschosse töten **jeden** Panzer bei Kontakt, auch den eigenen. Kein Friendly-Fire-Schutz,
  auch nicht gegenüber dem Schützen selbst nach einem Abpraller.
- **Ausnahme:** Direkt nach dem Abschuss ist das Geschoss für ~80 ms für den Schützen
  ungefährlich (sonst tötet man sich beim Schießen an einer nahen Wand sofort selbst).

### Minen
- Werden am Ort des Panzers abgelegt.
- **Zündverzögerung nach dem Legen: 1,0 s**, in der die Mine niemanden verletzt (Fluchtfenster).
- Danach: Explosion bei Kontakt mit einem beliebigen Panzer, bei Treffer durch ein Geschoss,
  oder durch die Explosion einer anderen Mine.
- **Explosionsradius: 48 px.** Tötet jeden Panzer im Radius, inklusive dem Leger.
- Kettenreaktion mit 0,1 s Verzögerung pro Glied.
- Explosion zerstört zerstörbare Wände im Radius.

### Wandtypen
- `solid` — unzerstörbar, blockiert Panzer und Geschosse.
- `breakable` — durch Minen-Explosion zerstörbar. Für Geschosse gilt: blockiert wie `solid`
  (Abpraller), **außer** der Spieler hat das Wolframkern-Upgrade (siehe Abschnitt 8).
- `hole` — blockiert Panzer, Geschosse fliegen darüber hinweg.

### Tod
- Alles stirbt bei einem Treffer. Keine Hitpoints.

---

## 5. Panzertypen

Die KI hat **zwei getrennte Achsen**: Turmverhalten und Fahrverhalten. Diese Trennung ist
zentral und darf nicht zusammengelegt werden.

Werte in `data/tanks.json`:

| ID | Speed | Geschosse | Abpraller | Minen | Turm | Fahrverhalten | Waffe |
|---|---|---|---|---|---|---|---|
| `player` | normal | 5 | 1 | 2 | – | – | Kugel+Mine |
| `t_brown` | 0 (fix) | 1 | 1 | 0 | zufällig suchend | – | Kugel |
| `t_grey` | langsam | 1 | 1 | 0 | schwach zielend | ziellos | Kugel |
| `t_teal` | langsam | 1 | 0 | 0 | stark zielend | defensiv, weicht aus | Rakete |
| `t_yellow` | schnell | 1 | 1 | 4 | schwach zielend | ziellos, meidet Minen | Kugel+Mine |
| `t_pink` | normal | 3 | 1 | 0 | zielend | offensiv, verfolgt | Kugel |
| `t_green` | 0 (fix) | 2 | 2 | 0 | Abpraller-Rechner | – | Bounce-Rakete |
| `t_purple` | schnell | 5 | 1 | 2 | zielend | offensiv bei Sichtlinie | Kugel+Mine |
| `t_white` | normal | 5 | 1 | 2 | zielend | unsichtbar, s. Details | Kugel+Mine |
| `t_black` | sehr schnell | 2 | 0 | 2 | Vorhaltezielen | defensiv, flieht bei Beschuss | Rakete+Mine |

### Verhaltensdetails (wichtig, nicht vereinfachen)

- **Geschwindigkeiten** (px/s, Startwerte, tunebar): fix 0, langsam 40, normal 70,
  schnell 100, sehr schnell 140.
- **Geschossgeschwindigkeit** (px/s): Spielerkugel 130, Gegnerkugel 130, Rakete 300,
  Bounce-Rakete 200. `t_black` (140 px/s) kann Kugeln überholen — das ist beabsichtigt.
- **`t_teal`** zielt auf die **aktuelle** Spielerposition → seitliches Ausweichen funktioniert.
- **`t_black`** zielt auf die **vorhergesagte** Position (Vorhalten) → Ausweichen funktioniert
  nicht. Das ist der entscheidende Unterschied zwischen beiden.
- **`t_green`** schießt fast nie direkt. Es berechnet Ein- oder Zwei-Wand-Abpraller und
  feuert nur, wenn eine Lösung existiert. Braucht eine eigene Raycast-Routine.
- **`t_yellow`** legt Minen ohne taktischen Grund und sperrt sich dadurch regelmäßig selbst
  ein. Dieses Verhalten ist **beabsichtigt** und darf nicht "wegoptimiert" werden.
- **`t_purple`** koordiniert mit anderen `t_purple`: Wenn zwei existieren, nähern sie sich
  aus unterschiedlichen Winkeln. Taktik "Abpraller schießen, dann vorrücken".
- **`t_white`** wird 1,5 s nach Rundenstart unsichtbar. Tracking über drei Kanäle:
  1. **Reifenspuren** (dicker als die anderer Panzer) — Haupt-Tracking.
  2. **Schimmer-Effekt**: kurzes, schwaches Aufflackern der Silhouette alle ~2 s —
     Sicherheitsnetz für kleine Displays.
  3. **Mündungsblitz** beim Schießen ist sichtbar.
  Beim Wechsel offensiv/defensiv spielt ein hoher bzw. tiefer Ton (Minimal-Audio,
  wird in Phase 5 zusammen mit `t_white` implementiert, nicht erst in Phase 10).
- Fahrende Panzer bleiben **nie** stehen.
- **Kein Schieben:** Panzer blockieren sich gegenseitig (auch bewegliche gegen fixe).

---

## 6. Raumgenerator (Kachelsystem)

### Prinzip
- ~20 handgebaute Kacheln à **8×8 Zellen**, definiert in `data/tiles.json` als
  ASCII-Strings (`.` = frei, `#` = solid, `b` = breakable, `o` = hole).
- Ein Raum = **3×2 Kacheln**. Generator wählt pro Slot eine Kachel, optional rotiert
  (0/90/180/270) und/oder gespiegelt.
- Außenrand des Raums ist immer eine geschlossene `solid`-Wand.

### Kachel-Kategorien (je 3–5 Varianten)
`open` (fast leer), `corridor` (Gänge), `cross` (Kreuzung), `corner` (Ecken),
`pillars` (Säulenfeld), `pocket` (Nischen/Deckung)

### Pflicht-Validierung nach der Generierung
1. **Flood-Fill** von der Spielerposition: Alle Gegner-Spawns müssen erreichbar sein.
2. **Mindestabstand** Spieler-Spawn ↔ nächster Gegner-Spawn: 200 px.
3. **Keine direkte Sichtlinie** zwischen Spieler-Spawn und irgendeinem Gegner-Spawn beim Start.
4. Wandanteil zwischen 15 % und 35 %.

Schlägt ein Test fehl → neu würfeln. **Nach 10 Fehlversuchen** ein fest hinterlegtes
Notfall-Layout laden. Das Spiel darf niemals hängen.

### Seed
Jeder Run hat einen Seed. Seeded RNG (Mulberry32) für alles Zufällige. Der Seed wird im
Game-Over- und Victory-Screen angezeigt und kann beim Start eingegeben werden.

**Vollständige Determinismus-Regel:** Derselbe Seed erzeugt exakt denselben Run —
Raumlayouts, Gegnerzusammenstellungen, Spawn-Positionen **und Upgrade-Angebote**.
Alle Zufallsentscheidungen laufen über den Seed-RNG, niemals über `Math.random()`.
Damit sind Seed-Runs zwischen Spielern fair vergleichbar ("schaff du mal Seed 4711").

---

## 7. Schwierigkeitsskalierung

Zwei Achsen, beide über `data/difficulty.json` gesteuert.

### A) Gefahrenbudget
Jeder Panzertyp hat Gefahrenpunkte und einen Freischalt-Raum:

| Typ | Punkte | Freigeschaltet ab Raum |
|---|---|---|
| `t_brown` | 1 | 1 |
| `t_grey` | 2 | 1 |
| `t_teal` | 4 | 2 |
| `t_yellow` | 3 | 3 |
| `t_pink` | 5 | 4 |
| `t_green` | 6 | 5 |
| `t_purple` | 9 | 7 |
| `t_white` | 8 | 9 |
| `t_black` | 12 | 11 |

Raum N hat ein Budget. Der Generator "kauft" davon zufällig Panzer ein (nur freigeschaltete
Typen), bis das Budget aufgebraucht ist.

Startkurve (tunebar): `budget = 2 + N * 1.6`
Obergrenze: 8 Panzer gleichzeitig im Raum.

### B) Raumcharakter
Die Kachelauswahl wird gewichtet. Offene Räume sind gegen schnelle Panzer deutlich härter,
enge Korridore entschärfen sie. Der Generator alterniert bewusst, damit sich Räume
unterschiedlich anfühlen.

**Nicht in V1.0:** Elite-Affixe, neue Gegnertypen. Erst nach dem spielbaren Prototyp.

---

## 8. Run-Struktur

### Ablauf
- Ein Run besteht aus **15 generierten Räumen + Finalraum (Raum 16)**.
- Der **Finalraum ist handgebaut** (festes Layout in `tiles.json` hinterlegt) mit hohem
  Budget: 2× `t_black` plus Unterstützung. Er ist der dramaturgische Höhepunkt.
- Raum 16 geschafft → **Victory-Screen** mit Statistik (Zeit, Kills, Upgrades, Tode) und Seed.
- **Raumübergang:** Zwischen zwei Räumen eine **1,5-s-Einblendung** mit Raumnummer
  ("Raum 7/16") und aktuellem Lebensstand. Gibt Rhythmus und eine kurze Atempause.
- **HUD zeigt permanent einen Gegner-Restzähler** (z.B. "4/7") — zwingend nötig wegen
  `t_white` (unsichtbar): Der Spieler muss wissen, ob der Raum noch läuft.

### Leben und Tod
- **3 Leben** zu Beginn. **Extraleben alle 5 geschaffte Räume.**
- Tod → derselbe Raum wird neu gestartet: **identisches Layout, aber bereits getötete
  Gegner bleiben tot.** Nur die noch lebenden Gegner starten auf ihren ursprünglichen
  Spawn-Positionen. Geschosse und Minen werden entfernt; vom Spieler gesprengte
  zerstörbare Wände bleiben zerstört.
- Leben auf 0 → Run vorbei, Game-Over-Screen mit Statistik und Seed. Keine Fortsetzung.
- **Bewusste Design-Entscheidung:** Da getötete Gegner tot bleiben, kann man Leben
  opfern, um schwere Räume in Etappen zu leeren. Das ist ein legitimer Ressourcen-Trade-off
  und wird nicht unterbunden.

### Meta-Progression
- **Nur Statistik und Bestleistungen** werden über Runs hinweg gespeichert (schnellster
  Sieg, meiste Räume, Gesamt-Kills). **Keine Gameplay-Boni zwischen Runs** in V1.0.
- Hinweis Implementierung: Persistenz über eine simple Highscore-Datei/Storage-Abstraktion
  in einem eigenen Modul kapseln, damit der Mechanismus später austauschbar ist.

### Upgrades
- **Nach jedem 3. Raum** (also nach Raum 3, 6, 9, 12, 15) erscheint der Upgrade-Screen.
- **3 zufällige Optionen, davon 1 wählbar.** Ausgemaxte Upgrades werden nicht mehr angeboten.
- **Fallback:** Enthält der Pool weniger als 3 verfügbare Upgrades, werden fehlende Slots
  mit der Standard-Option **"+1 Leben"** aufgefüllt. Der Screen darf nie leer sein oder crashen.
- Ergibt 5 Upgrades pro erfolgreichem Run. Ein Run muss sich am Ende deutlich anders
  spielen als am Anfang.

### Upgrade-Katalog (`data/upgrades.json`)

| Upgrade | Effekt pro Stufe | Max |
|---|---|---|
| Magazin | +2 gleichzeitige Geschosse | +3 Stufen |
| Abpraller | +1 Abpraller pro Geschoss | **max. 2 gesamt** |
| Ladung | Geschossgeschwindigkeit +20 % | 3 |
| Kettenglied | +1 gleichzeitige Mine | 2 |
| Sprengkraft | Minen-Explosionsradius +30 % | 2 |
| Kettenantrieb | Bewegungstempo +12 % | 3 |
| Wolframkern | Geschoss zerstört eine zerstörbare Wand beim Aufprall — **das Geschoss verschwindet dabei.** Solid-Wände unverändert (Abpraller). | 1 |

**Wichtig:** Mehr Abpraller macht die eigenen Geschosse gefährlicher für den Spieler selbst.
Das ist gewolltes Risiko-Design und wird nicht abgemildert. Deshalb die harte Grenze bei 2.

---

## 9. Steuerung

### Mobile (Landscape)
- **Linke Bildschirmhälfte:** floating virtueller Stick → Fahren.
- **Rechte Bildschirmhälfte:** floating virtueller Stick → Zielen. **Solange ausgelenkt,
  wird automatisch geschossen** (Auto-Fire, begrenzt durch Feuerrate-Cooldown 0,25 s und
  Magazin).
- **Minen-Button:** fester runder Button unten rechts mit **Exklusionszone 80×80 px** —
  Touches, die dort starten, erzeugen niemals einen Stick, sondern legen die Mine.
- **Alternativ:** Doppeltipp auf den linken Stick legt ebenfalls eine Mine (rechter Daumen
  muss das Zielen nicht unterbrechen).
- "Floating" heißt: Der Stick erscheint dort, wo der Daumen aufsetzt, nicht an fester Position.
- **Portrait-Handling:** Orientation-Lock funktioniert im Browser nicht zuverlässig
  (v.a. iOS Safari). Lösung: Bei Portrait ein Overlay "Bitte Gerät drehen" anzeigen und
  das Spiel pausieren.

### Desktop
- WASD / Pfeiltasten = Fahren
- Maus = Zielen, linke Maustaste = Schießen (kein Auto-Fire, Cooldown gilt trotzdem)
- Leertaste = Mine

### Gamepad
- Linker Stick = Fahren, rechter Stick = Zielen + Auto-Fire
- Rechter Trigger = Schießen (manuell, überschreibt Auto-Fire)
- A / X = Mine

### Tutorial
Kein eigenes Tutorial-Level. Stattdessen **kontextuelle Einblendungen in den ersten Räumen**
(nur beim allerersten Run auf dem Gerät, danach abschaltbar über gespeichertes Flag):
- Raum 1: "Linker Stick: fahren" + "Rechter Stick: zielen & schießen"
  (Desktop: "WASD: fahren" + "Maus: zielen, Klick: schießen")
- Raum 2: "Button unten rechts oder Doppeltipp links: Mine legen" (Desktop: "Leertaste: Mine")
- Raum 3: "Deine Kugeln prallen ab — und können dich selbst treffen"
Einblendungen halbtransparent am oberen Rand, verschwinden nach 4 s oder bei erster
Ausführung der Aktion.

### Pause
- **Pause-Button** oben mittig (außerhalb beider Daumenzonen), Desktop: `Esc`/`P`.
- **Auto-Pause** bei Fokusverlust des Tabs (`visibilitychange`) — Pflicht, sonst stirbt
  man bei einem eingehenden Anruf.

### Layout
Arena zentriert, unten links und unten rechts bleibt je eine Daumenzone frei von wichtigen
Spielinhalten.

---

## 10. Rendering-Hinweise

### Reifenspuren (Bodenschicht)
Spuren erscheinen sichtbar auf dem Arena-Boden. Technisch werden sie **nicht** als einzelne
Entities gehalten (Performance bricht sonst nach Minuten ein), sondern auf ein
**persistentes Buffer-Canvas** gemalt, das dieselbe Größe wie die Arena hat:

1. Jeder fahrende Panzer stempelt pro Tick seine Spur in das Buffer-Canvas.
2. Das Buffer-Canvas wird jeden Frame als Bodenschicht (unter Panzern/Geschossen) in das
   sichtbare Canvas gezeichnet — eine einzige Zeichenoperation.
3. Beim Raumwechsel wird das Buffer geleert.
4. Optional (Politur): Buffer alle paar Sekunden minimal Richtung Bodenfarbe abdunkeln,
   damit alte Spuren langsam verblassen.

Ergebnis für den Spieler: identisch zu klassischen Reifenspuren im Spiel, nur ohne
Framerate-Einbruch. Muss ab Phase 3 so gebaut werden (`src/render/tracks.js`).

---

## 11. Entwicklungsphasen

Strikt der Reihe nach. **Keine Phase überspringen, jede Phase muss lauffähig und spielbar
sein, bevor die nächste beginnt.**

**Phase 1 — Fundament**
Fixed-Timestep-Loop, Canvas-Setup, statische Testarena aus einer hartcodierten Karte,
Spielerpanzer fährt mit Sliding-Kollision. Kein Schießen.

**Phase 2 — Geschossphysik**
Schießen mit Cooldown, Abpraller mit korrektem Eckenfall, Geschoss-Limit, Geschosse
zerstören sich gegenseitig, Selbsttreffer möglich (80-ms-Schutz). Debug-Overlay mit
Kollisionskreisen und Abpraller-Zählern. **Diese Phase ist die wichtigste — hier wird
nichts abgekürzt.**

**Phase 3 — Gegner-Grundgerüst**
Entity-System, `tanks.json` wird geladen, `t_brown` und `t_grey` implementiert.
Turm- und Fahr-KI als getrennte Module. Panzer-blockiert-Panzer-Kollision.
**Reifenspuren-Bodenschicht (`tracks.js`) wird hier gebaut.**

**Phase 4 — Minen**
Legen, Zündverzögerung, Explosionsradius, Kettenreaktion, zerstörbare Wände.

**Phase 5 — Restliche Gegner**
`t_teal`, `t_yellow`, `t_pink`, `t_green` (Abpraller-Raycast), `t_purple`, `t_white`
(inkl. Schimmer, Mündungsblitz und den zwei Tönen als Minimal-Audio), `t_black`.
Einzeln, jeder wird nach der Implementierung getestet.

**Phase 6 — Generator**
Kachelsystem, Validierung, Seeded RNG, Notfall-Layout, Finalraum-Layout.

**Phase 7 — Run-Struktur**
Leben, Räume, Gefahrenbudget, Freischaltkurve, Tod-Restart (getötete Gegner bleiben tot),
Raumübergangs-Einblendung, Gegner-Restzähler im HUD, Victory- und Game-Over-Screen,
Seed-Anzeige und -Eingabe (voll deterministisch inkl. Upgrades), Statistik-Persistenz.

**Phase 8 — Upgrades**
Upgrade-Screen, Katalog, Fallback "+1 Leben", Anwendung auf den Spielerpanzer.

**Phase 9 — Touch-Steuerung**
Floating Twin-Stick, Auto-Fire, Minen-Button mit Exklusionszone, Doppeltipp-Mine,
Portrait-Overlay, Pause-Button und Auto-Pause, Tutorial-Einblendungen.

**Phase 10 — Politur**
Pixel-Art-Assets, vollständiger Sound, Partikel, Screenshake, Menü, Spuren-Verblassen.

---

## 12. Arbeitsregeln für Claude Code

- **Eine Phase pro Session.** Nicht vorgreifen.
- Nach jeder Phase: kurz zusammenfassen, was gebaut wurde und was als Nächstes ansteht.
- Keine Libraries hinzufügen. Kein Build-Step einführen.
- Keine Zahl hardcoden, die ins JSON gehört.
- Bei Unsicherheit über eine Design-Entscheidung: **fragen, nicht raten.**
- Dateien klein halten. Eine Datei über 300 Zeilen ist ein Hinweis, dass etwas aufgeteilt
  gehört.
- Debug-Overlay (Taste `F1`) ab Phase 2 dauerhaft mitpflegen: FPS, Entity-Zahl,
  Kollisionsformen, Geschossbahnen.
