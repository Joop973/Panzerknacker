# Bandenschuss (archiviert Phase 0, Grundsteinumbau v3)

Archiviert am 2026-08-17, vor der eigentlichen Entfernung in **Phase 1**
("Bandenschuss vollständig entfernen") des Grundsteinumbaus. Dieses Dokument
ist die Mechanikbeschreibung des Systems **wie es vor Phase 1 tatsächlich
im Code stand** — verifiziert, nicht aus der Erinnerung geschrieben.
Zeilennummern können durch spätere Commits leicht wandern; die
Funktions-/Feldnamen sind der verlässliche Anker beim Wiederfinden.

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
`ricochetsLeft` zu verbrauchen (nur `wallBounces` zählt normal mit) — war
aber in `data/tiles.json`/`data/arenas.json` **null Mal** tatsächlich
platziert, existierte also nur als ungenutzter Mechanismus.

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
funktioniert nach Phase 1 weiter, nur ohne `ricochetsLeft`-Feld: die
zurückgeworfene Kugel fliegt bis zur nächsten Wand und stirbt dort (statt
weiter abzuprallen). `data/balance.json: reflect` bleibt unverändert
bestehen: `{ ricochetsLeft: 0, speedMult: 1, pushPx: 2, graceS: 0.15 }` —
`ricochetsLeft: 0` bedeutete auch VOR Phase 1 schon "stirbt am nächsten
Wandkontakt", die Reflexionsmechanik hat sich also inhaltlich nie auf
mehrfaches Abprallen verlassen.

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

## `t_mirror` (Boss "Der Spiegel") — WICHTIGER OFFENER PUNKT, nicht archiviert

`t_mirror` bleibt im Spiel (Boss von Akt 2) und nutzt weiterhin
`requiresRicochet: true` + `armor: { arc: 360, reflects: true }` — genau
der Mechanismus, den Phase 1 laut Auftrag "ersatzlos" entfernen soll
(`hasWallBounced()`/`requiresRicochet`). Mit `arc >= 360` blockt
`armor.js: armorBlocks()` **jeden** Treffer, außer `requiresRicochet` lässt
über `!hasWallBounced(b)` die Ausnahme "Kugel hat schon an einer Wand
abgeprallt" zu. Ohne Wandabpraller (Phase 1) gibt es diese Ausnahme nicht
mehr — der Spiegel würde für **jede Kugel**, direkt oder nicht, unverwundbar.
Explosionen (Minen) ignorieren die Panzerung bewusst und blieben ihm
gefährlich, aber jede Kugelwaffe würde komplett wirkungslos. **Dieser Punkt
ist im Auftrag nicht vorgesehen und muss vor/in Phase 1 entschieden werden**
(siehe `ARCHIV.md`, Abschnitt "Ist-Abgleich Phase 0").

## Reaktor-Generatoren — WICHTIGER OFFENER PUNKT, nicht archiviert

Ebenfalls kein Bandenschuss-Feature im engeren Sinn, aber direkt betroffen:
`bullet.js: moveAxis()` beschädigt eine Generator-Wand (`t_reactor`-Boss)
nur, wenn die treffende Kugel **vorher schon an einer anderen Wand
abgeprallt ist** (`b.wallBounces > 0`) — ein Direkttreffer prallt
wirkungslos ab. Ohne Wandabpraller (Phase 1) kann `b.wallBounces` nie mehr
größer 0 werden — der Reaktor-Bosskampf wäre ohne eine gezielte
Codeänderung an dieser Stelle unlösbar. Details und Fundstelle in
`ARCHIV.md`, Abschnitt "Ist-Abgleich Phase 0".
