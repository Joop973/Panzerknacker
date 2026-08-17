# Bandenschuss (archiviert Phase 0/1, Grundsteinumbau v3)

Ursprünglich am 2026-08-17 in Phase 0 angelegt (vor der eigentlichen
Entfernung), am selben Tag in **Phase 1** ("Bandenschuss vollständig
entfernen") um den Abgleich "was stimmte an der Phase-0-Beschreibung
tatsächlich" und die neu gefundenen Systeme ergänzt. **Status: Phase 1 ist
gemergt — die Mechanik unten existiert nicht mehr im aktiven Code**, dieses
Dokument ist die Referenz beim Zurückholen. Zeilennummern können durch
spätere Commits leicht wandern; die Funktions-/Feldnamen sind der
verlässliche Anker beim Wiederfinden.

> **Korrektur aus Phase 1 (wichtig):** Der Phase-0-Absatz unten zur
> Spiegelwand ("existierte also nur als ungenutzter Mechanismus") war
> **falsch**. `generator.js: placeReflectWalls()` wurde in JEDEM generierten
> Kampfraum aufgerufen und platzierte dort 2–4 Spiegelwände — Phase 0 hatte
> nur die STATISCHEN Dateien (`tiles.json`/`arenas.json`) auf das Zeichen
> `'r'` geprüft, nicht den Generator-Code, der es zur Laufzeit selbst
> einsetzt. Die Mechanik war also aktiv im Spiel, nicht tot. Siehe
> Abschnitt "Spiegelwand-Erzeugung" unten für die korrekte Beschreibung.

Grund der Entfernung (siehe `AUFTRAG-GRUNDSTEINUMBAU.md`, Abschnitt 1):
die langsame Spielerkugel (200 px/s), die der Bandenschuss erzwang, machte
Vorhaltewinkel unzumutbar groß (12–44°) und die Ziellinie zeigte ohnehin nur,
wohin die Kugel fliegt, nicht wohin ein bewegtes Ziel beim Einschlag
gewandert ist.

## Geschossfelder (`src/game/bullet.js: createBullet()`)

- `ricochetsLeft` — verbleibende Abpraller, Startwert `ricochets` (Parameter,
  aus `cfg.ricochets`, aufgelöst in `cfg.js: resolveCfg()` aus
  `tanks.json: <typ>.ricochets`).
- `ricochetsStart` — Kopie des Startwerts, nur für die
  "Abpraller-Kill"-Rückmeldung (Trickshot-Text/-Schrott, s. u.).
- `wallBounces` — zählt NUR Abpraller an **Wänden** (nicht an Panzern/
  Reflexionen), Zweck: Prisma-Tötbarkeit (`t_prism.bounceDamageTakenMult`,
  s. `gegner-v1.json`) und der Wandabpraller-Schadensbonus (s. u.).

Typische `ricochets`-Werte je Typ (Stand vor Phase 1, `tanks.json`):
Spieler/alle Klassen 1, die meisten Gegner 1, `t_teal`/`t_black`/`ghost_tank`
0 (keine Bande), **`t_green` 2** (sein Bankshot-Markenzeichen, s. u.).

## Physik (`bullet.js: moveAxis()`/`updateBullet()`)

Ein Wandtreffer ohne verbleibende Abpraller lässt die Kugel sterben; sonst
prallt sie ab (Vorzeichenwechsel der Geschwindigkeitskomponente),
`ricochetsLeft--`, `wallBounces++`. Eine **Spiegelwand** (Wandtyp `'r'` →
`WALL_TYPES.r = 'reflect'`, `state.js:34`) prallt IMMER ab, OHNE
`ricochetsLeft` zu verbrauchen (nur `wallBounces` zählt normal mit).

## Spiegelwand-Erzeugung (`generator.js: placeReflectWalls()`) — war AKTIV

Anders als der ursprüngliche Phase-0-Befund (s. Korrektur oben): dies war
**kein** ungenutzter Mechanismus. `buildGrid()` rief `placeReflectWalls()`
bei **jedem** generierten Kampf-/Eliteraum auf und ersetzte 2–4 zufällige
Außenrand-Zellen (ohne Ecken) durch `'r'`, Anzahl aus
`data/tiles.json: mirror.minPerRoom/maxPerRoom` (2/4). Der Fisher-Yates-
Shuffle darin verbrauchte bei jedem Raumaufbau reichlich RNG aus dem
`rooms`-Strom (Border-Array eines 24×16-Rasters, ~68 Zellen) — das Entfernen
in Phase 1 verschiebt dadurch die Ergebnisse nachfolgender `rooms`-Zufalls-
ziehungen im selben Raum gegenüber alten Seeds (akzeptiert, siehe
Auftrag: der Umbau ändert Gameplay-Determinismus bewusst). Feste Arenen
(`boss_reactor`/`boss_mirror`/`boss_phalanx`) nutzten das Legendenkürzel
`mirror` NICHT (0 Vorkommen dort — das war der Teil, den Phase 0 korrekt
gemessen hatte); nur `test_arena` (Entwickler-Testarena) hatte zwei `M`-
Zellen darüber gelegt, in Phase 1 durch normale Wände (`#`) ersetzt.

## Schadensbonus (`data/balance.json: bullet.wallBounceDamageMult`)

Ein Treffer mit `wallBounces > 0` macht **2,5× Schaden** (Startwert 2,0,
auf Nutzerwunsch nach dem LP-Umbau auf 2,5 angehoben) — gilt für **beide**
Seiten, Spieler- wie Gegnergeschosse. Angewendet in der Trefferschleife
in `state.js`.

## Bankshot-KI (`src/game/ai_turrets.js`)

- `solveBounce(tank, state, cfg)` — probiert `angleSamples` (120, aus
  `tanks.json: ai.bounceShot.angleSamples`, ursprünglich 180, aus
  Performancegründen gesenkt) Winkel durch, bis eine Bahn mit genau einem
  Wandabpraller den Spieler innerhalb `hitTolerancePx` (14 px) trifft.
  Budget: `state.bounceSolveBudget` (`state.js`, aus
  `ai.bounceShot.solvesPerTick`, 1) — ein globales Sicherheitsnetz gegen zu
  viele gleichzeitige Solver-Läufe, das Timing selbst staffelt sich über
  `solveIntervalS` (0,4 s je Gegner) von allein.
- `bounceShot(tank, state, dt)` — nutzt die gelöste Bahn, feuert danach.
- Aktiviert über `cfg.requiresBounceShot` (aus `tanks.json:
  <typ>.requiresBounceShot`), abgefragt in `roleTurret()`. **Einziger
  Nutzer vor Phase 1/3: `t_green`** ("Grüner wird Bankshot-Gegner"-Session,
  s. `CLAUDE.md`) — steht fest, rechnet Winkel, schießt fast nur Bankshots
  mit 2 Abprallern. Wird in Phase 3 zum Mörserschützen umgebaut (siehe
  `archive/gegner-v1.json` für die alte Fassung als Referenz — **kein**
  Restaurierungsziel, der Mörser-Umbau bleibt auch bei einem Rückbau
  dieses Umbaus die neue Basis).
- Komplette Konfiguration `tanks.json: ai.roles`... nein — eigener Block
  `ai.bounceShot`: `{ turnSpeed: 2.2, fireConeRad: 0.06, solveIntervalS: 0.4,
  angleSamples: 120, hitTolerancePx: 14, maxTravelPx: 1200, solvesPerTick: 1 }`.

## Erzwungener Bankshot-Gegner (`src/game/run.js: ensureBankshotEnemy()`)

USP-Garantie aus der Vor-LP-Ära: tauschte in einem Anteil der Räume ab
Raum 6 den teuersten gekauften Gegner gegen einen Bankshot-Typ
(`data/difficulty.json: bankshotGuarantee`). Mit UMBAUPLAN-LP Phase 8
bereits auf `chance: 0` gesetzt (No-op, aber Codepfad blieb als
Wiederanschlusspunkt stehen). Wert vor der endgültigen Entfernung:

```json
{ "minRoom": 6, "chance": 0, "types": ["t_prism"] }
```

Referenziert `t_prism`, das mit Phase 1 komplett aus dem Spiel fällt —
der Mechanismus selbst (`ensureBankshotEnemy()`) wird in Phase 1 mit
entfernt, nicht nur der Datenwert.

## Trickshot-Belohnung (`data/balance.json: trickshot`, `state.js`, `run.js`)

**Der einzige Belohnungsmoment des Spiels vor diesem Umbau** — deshalb wird
er in Phase 2 (direkt nach der Bandenentfernung in Phase 1) durch die neue
Treffer-Rückmeldung (Flanken-/Heck-Multiplikator-Text, Zeitlupe bei
Heck-Kills) ersetzt, nicht ersatzlos gestrichen.

```json
{ "scrap": 1, "scrapStrong": 2, "strongRicochets": 2,
  "slowMoS": 0.15, "slowMoScale": 0.35 }
```

Ablauf: ein Kill mit `wallBounces > 0` (`state.js`, Trefferschleife) löst
aus: Schrott (`scrap`, ab `strongRicochets` Wandabprallern `scrapStrong`),
`state.trickshotTimer = slowMoS` (Zeitlupe), goldener Schwebetext
"Trickshot! +N Schrott" bei Spieler-Kills, cyan "Abpraller!" sonst. Die
Zeitlupe wird in `run.js: stepRun()` verrechnet (`scale = Math.min(scale,
trickshot.slowMoScale)`, kombiniert sich mit der Taktiker-Transformation —
der kleinere/stärkere Wert gewinnt). `state.trickshotScrap` läuft wie alle
Raum-Zähler über einen Delta-Sync nach `run.scrap`.

## Reflexion durch Frontpanzerung (E3, `armor.js: reflectBullet()`) — bleibt!

**Nicht Teil dieser Archivierung** — Reflexion (nicht Bandenschuss)
funktioniert nach Phase 1 weiter: die zurückgeworfene Kugel fliegt bis zur
nächsten Wand und stirbt dort (statt weiter abzuprallen) — das ergibt sich
jetzt automatisch aus der generischen "jede Wand tötet"-Regel, kein
Sonderfall mehr nötig. `data/balance.json: reflect.ricochetsLeft` (vor
Phase 1: `0`, bedeutete schon davor "stirbt am nächsten Wandkontakt") ist
mit Phase 1 als totes Feld entfernt; `speedMult`/`pushPx`/`graceS` bleiben
unverändert in `reflect` stehen.

## Ziellinien-Vorschau (`src/render/effects.js: drawAimLine()`, Zeile 277)

**Wichtig — Abweichung von der ursprünglichen Planannahme:** die Funktion
liegt in `effects.js`, nicht in `renderer.js` (der nur importiert und in
Zeile ~1150 aufruft). Zeigte vor Phase 1 die direkte Strecke bis zur ersten
Wand plus ein gestricheltes Segment für den ersten (mit dem
Ballistikrechner-Upgrade: bis zu zwei) Abpraller, berechnet über
`bullet.js: traceTrajectory()` — dieselbe Physik wie das echte Geschoss,
damit Anzeige und Realität nie auseinanderdriften. `maxBounces`/`tailSteps`
kamen aus `p.cfg.aimPreviewBounces` (Ballistikrechner-Karte, jetzt in
`archive/upgrades-v1.json`). Nach Phase 1 bleibt nur die gerade Linie bis
zur ersten Wand.

## `t_mirror` (Boss "Der Spiegel") — GELÖST über den Boss-Platzhalter

War in Phase 0 als blockierender Fund markiert. **Aufgelöst noch vor Phase
1**, durch eine eigene Nutzerentscheidung direkt nach Phase 0 (s. CLAUDE.md
"Bosse (Platzhalter, Nutzerentscheidung)"): alle drei Bosse sind noch nicht
ausgearbeitet und werden aktuell durch `t_black` ersetzt (`run.js:
BOSS_ENEMY_TYPES`) — `t_mirror` wird im normalen Spiel gar nicht mehr
gespawnt. Phase 1 konnte `requiresRicochet`/`hasWallBounced()` deshalb wie
im Auftrag vorgesehen **ersatzlos aus `armor.js` entfernen** (die
KILL-BLOCKIERENDE Interpretation), OHNE den Spiegel spielbar unverwundbar zu
machen. Das Datenfeld `t_mirror.requiresRicochet: true` selbst bleibt
bewusst unverändert in `tanks.json` stehen (reiner Boss-Platzhalter-
Passthrough über `cfg.js: resolveCfg()`, nur noch für die Renderer-Optik
gebraucht — ein künftiger Bossneubau braucht ohnehin eine neue Regel dafür,
"jeder Treffer blockt für immer" ist mit `armor.arc: 360` und ohne
Bandenschuss keine spielbare Mechanik mehr).

## Reaktor-Generatoren — GELÖST über den Boss-Platzhalter (nicht "auf Direkttreffer umgestellt")

Ebenfalls in Phase 0 als blockierender Fund markiert, ebenfalls durch den
Boss-Platzhalter aufgelöst — **anders als der Phase-0-Vorschlag** ("auf
reinen Direkttreffer umstellen"). Da `t_reactor` aktuell nicht gespawnt wird
(Platzhalter `t_black`), hat Phase 1 die Bedingung `wall.type ===
'generator' && b.wallBounces > 0` in `bullet.js: moveAxis()` ersatzlos
entfernt statt umzustellen — Generatoren verhalten sich bis zu einem
Bossneubau wie **gewöhnliche, unzerstörbare Wände** (fallen in den
generischen "hit=true"-Pfad, kein `destroyWall()`-Aufruf mehr erreichbar).
`state.js: destroyWall()`s Generator-Zweig (Zähler `bossGeneratorsLeft`,
Sound `trickshot2`, Text "Generator zerstört!") bleibt unverändert im Code
stehen — totes, aber harmloses Boss-Feature, bis ein Bossneubau eine neue
Zerstörungsbedingung braucht.

## Raum-Modifikatoren "Überdruck"/"Spiegelsaal" (`data/modifiers.json`) — in Phase 1 gefunden und archiviert

Zwei der neun Raum-Modifikatoren (Phase 10) waren vollständig
Bandenschuss-abhängig und standen nicht im ursprünglichen Phase-0-Befund
(erst beim Umsetzen von Phase 1 entdeckt, als `state.js` einer Wand den
inzwischen ungültigen Typ `'reflect'` zuweisen wollte):

- **`overpressure`** ("Überdruck", `ricochetsBonus: 1`, "Alle Geschosse
  prallen einmal mehr ab") — `cfg.js: applyRoomModifier()` addierte den Wert
  auf `cfg.ricochets`. Mit `cfg.ricochets` entfallen ist der Modifikator
  bedeutungslos, aus dem aktiven Pool entfernt.
- **`mirror_hall`** ("Spiegelsaal", `mirrorHall: true`, "Alle festen Wände
  werfen Geschosse zurück") — `state.js: createState()` wandelte nach
  `buildWalls()` alle `solid`-Wände in `'reflect'` um. Da der Wandtyp
  `'reflect'` komplett entfernt ist, hätte der ungefixte Code eine
  ungültige Wand erzeugt; der Modifikator ist aus dem aktiven Pool entfernt.

Beide Einträge sind aus `data/modifiers.json: modifiers[]` entfernt (nicht
nur deaktiviert). Zum Zurückholen: die JSON-Blöcke stehen hier archiviert,
`cfg.js: applyRoomModifier()` bräuchte für `overpressure` einen neuen
Zielwert (kein `cfg.ricochets` mehr) und `mirror_hall` bräuchte einen neuen
Wandtyp, falls Spiegelwände je zurückkehren.

```json
{ "id": "overpressure", "name": "Ueberdruck",
  "desc": "Alle Geschosse prallen einmal mehr ab.", "ricochetsBonus": 1 }
{ "id": "mirror_hall", "name": "Spiegelsaal",
  "desc": "Alle festen Waende werfen Geschosse zurueck.", "mirrorHall": true }
```

## Telemetrie: Abpraller-/Direkt-Kill-Zähler — entfernt

`state.ricochetKills`/`state.directKills` (gezählt in der Trefferschleife
über `bounced`) und `trefferMeta.bulletRicochets` (= `b.wallBounces`) sind
mit Phase 1 vollständig entfernt — `main.js`, `telemetry.js`
(`recordRoom()`, `computeMetrics()`, die Debug-Ansicht "Abpraller-Kills
X/Y") kannten sie. Ohne Wandabpraller wäre `ricochetKills` für immer 0 und
`directKills` gleich der Gesamt-Killzahl gewesen — eine dauerhaft
bedeutungslose Kennzahl statt eines echten Signals. Historische, bereits
gespeicherte `localStorage.runs`-Einträge behalten die alten Felder (keine
Migration), neue Runs schreiben sie nicht mehr.

## Rein kosmetische Reste, ohne Funktionsverlust entfernt

- `data/tanks.json: bulletSpeeds.bounce_rocket` (200) — Geschwindigkeits-
  eintrag für eine Waffenart, die **kein** Panzertyp je nutzte (verifiziert
  in Phase 0). `bullet.js: createBullet()`s `kind`-Kommentar, `renderer.js:
  bulletSpriteKey()`/`BULLET_COLORS.bounce_rocket`, `state.js:
  WEAPON_LABEL.bounce_rocket` entsprechend bereinigt. Das Sprite-Asset
  `assets/sprites/bullet_bounce.png` bleibt unangetastet (weiterhin über
  `sprites.js: BULLET_KEYS` geladen, referenziert von keinem Code mehr,
  aber harmlos) — kein Cache-Bump nötig, kein Asset entfernt.
- Sound `data/sounds.json: trickshot` (ohne "2") — nach Wegfall der
  Trickshot-Belohnung ohne verbleibende Push-Stelle, entfernt.
  `trickshot2` bleibt (Generator-Zerstörungs-Sound, s. o.).
