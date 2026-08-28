# Umbauplan — 16 neue Gegner (Akt 2 + 3) und Kompositionssystem

Phase **G0** (Ist-Abgleich) des in der Aufgabenstellung vorgegebenen
Neun-Phasen-Plans (G0–G9). Grundlage ist `docs/AUFTRAG-GEGNERDESIGN.md`
(20-Abschnitte-Designdokument, PR #150) und die dort in Abschnitt 1
verlangte Pflichtlektüre. **Kein Produktivcode in dieser Phase** — reiner
Ist-Abgleich, danach Stopp bis zur Freigabe.

---

## 1. Prüfliste der technischen Behauptungen aus Abschnitt 17

Jede Zeile: Behauptung → Datei:Zeile → Ergebnis.

### 1.1 Pflichtlektüre-Zeilenangaben (Abschnitt 1 des Auftrags)

Alle elf Zeilenangaben wörtlich nachgeprüft — **stimmen exakt**:

| Angabe | Gefunden | Status |
|---|---|---|
| `cfg.js` ab Z. 5, `resolveCfg()` | `export function resolveCfg(data, type) {` bei Z. 5 | **stimmt** |
| `run.js` ab Z. 101, `buyEnemies()` | Kommentarblock ab Z. 101, Funktion Z. 109 | **stimmt** |
| `state.js` Z. ~688 / Z. 958, `applyDamage()`/`killTank()` | `applyDamage(tank, amount, cause, meta) {` Z. 688, `killTank(tank, cause, meta) {` Z. 958 | **stimmt exakt** |
| `ai.js`, `resolveTarget()` Z. 78 | `export function resolveTarget(tank, state) {` Z. 78 | **stimmt exakt** |
| `ai.js`, Rollenauflösung Z. 346–350 | `DRIVES[role](tank, state, dt)` bei Z. 349, `roleTurret()`-Aufruf Z. 354 | **stimmt** (im genannten Fenster) |
| `ai_drives.js`, `hunterDrive()` | `function hunterDrive(tank, state, dt) {` Z. 80 | **stimmt** (Zeile nicht genannt, Funktion existiert) |
| `ai_drives.js`, `coverDrive()` Z. 175 | `export function coverDrive(tank, state, dt) {` Z. 175 | **stimmt exakt** |
| `ai_turrets.js`, `roleTurret()` Z. 35 | `export function roleTurret(tank, state, dt) {` Z. 35 | **stimmt exakt** |
| `tank.js` Z. 772 / 792, `fireHook()`/`placeTrapWall()` | `function fireHook(tank, state, scfg, angle) {` Z. 772, `function placeTrapWall(tank, state, scfg) {` Z. 792 | **stimmt exakt** |
| `mine.js` Z. 45, `explodeAt(...)` | `export function explodeAt(state, x, y, R, spare, meta, damage, damageType) {` Z. 45 | **stimmt exakt, Signatur identisch** |
| `sprites.js` Z. 130, `SPRITE_ALIAS` | `const SPRITE_ALIAS = {` Z. 130 | **stimmt exakt** |
| `effects.js` Z. 407, `drawAnvilHazards()` | `export function drawAnvilHazards(ctx, state) {` Z. 407 | **stimmt exakt** |
| `renderer.js` Z. 1080, `drawLightning()` | `function drawLightning(ctx, state) {` Z. 1080 | **stimmt exakt** |

Diese Genauigkeit ist ein starkes Signal: Das Designdokument wurde
tatsächlich gegen den Code geschrieben, nicht aus dem Gedächtnis.

### 1.2 Inhaltliche Behauptungen aus Abschnitt 17.1–17.4

| # | Behauptung | Befund | Status |
|---|---|---|---|
| 1 | `resolveCfg()` ist eine explizite Whitelist, 44 Felder | Ausgezählt (Skript über den `return {…}`-Block): **exakt 44 Felder** | **stimmt exakt** |
| 2 | 14 neue Felder nötig: `spread`, `charge`, `heal`, `ram`, `suppressField`, `sightRelay`, `build`, `deathBlast`, `rally`, `stalk`, `tether`, `harvest`, `metronome`, `grapple` | Keins davon existiert in `resolveCfg()` — bestätigt. **Aber:** drei der als "neu" gelisteten Konzepte lassen sich auf **bereits bestehende, generische** Felder zurückführen (s. 1.3) statt einer neuen verschachtelten Struktur | **stimmt im Bedarf, Struktur teils vermeidbar** |
| 3 | `radius`, `armor`, `damageType` sind "vorhanden, aber gegnerseitig ungenutzt" | Alle drei stehen bereits in der Whitelist (`radius: t.radius ?? …`, `armor: t.armor || null`, `damageType: t.damageType ?? 'physical'`). "Ungenutzt" stimmt nicht ganz: `t_armored` nutzt `armor` seit Phase 4, `t_anvil` nutzt `radius` seit dem Amboss-Auftrag — beide sind bereits gegnerseitig aktiv | **stimmt überwiegend, "ungenutzt" ist zu stark formuliert** |
| 4 | `t_rusher`: `anvil.js: ramHitCheck()`/`pushFromRam()` als Vorlage für generisches `ram`-Verhalten | Beide Funktionen existieren in `anvil.js`, sind aber eng an `state.anvilBoss`/`boss.chargeHitTargets` gebunden (kein generischer Parameter für "welcher Tank rammt"). Die **Technik** (Substep-Bewegung, Trefferliste pro Sturm, Rückstoß über Kreuzprodukt) ist eine bewährte Vorlage, der Code selbst ist nicht direkt wiederverwendbar — muss als eigenständige, generische Funktion in `ai_drives.js` neu geschrieben werden (Prinzip kopieren, Code nicht) | **stimmt im Prinzip, "Vorlage" ist eher "Bauplan" als "Baustein"** |
| 5 | `t_dud`: Hook in `killTank()` + `explodeAt(..., spare: null)`, kein neues System | `killTank()` hat aktuell **nur** im `tank === state.player`-Zweig einen `kamikazeRadius`-Explosionshook (`explodeAt(state, tank.x, tank.y, tank.cfg.kamikazeRadius, null, { killer: tank })`). Der `else`-Zweig (Gegnertod) hat **keinen** äquivalenten Hook — er muss neu ergänzt werden. Die Explosionsfunktion selbst (`explodeAt`) ist tatsächlich fertig und passend (`spare: null` trifft alle, auch Verbündete) | **stimmt im Ergebnis, kleine Ergänzung nötig (kein Neubau)** |
| 6 | `t_arclight`: `damageType: "lightning"` an einem Gegnertyp reicht, `damagetypes.js` funktioniert für beliebige Schützen | `applyTypeEffects(state, t, b.damageType, schaden, trefferMeta)` wird in der generischen Trefferschleife **einmal**, unabhängig von `b.owner`, aufgerufen. `data/status.json: damageTypes.lightning` hat `maxTargets: 3`, `falloff: 0.7`, `jumpRangePx: 160` — exakt "bis zu 2 weitere Ziele, 30 % Abfall" | **stimmt exakt** |
| 7 | `t_bulwark`: `radius`-Override + `armor:{arc:160,reflects:false}`, reine Datenänderung | Beide Felder bereits in `resolveCfg()`, `armor.reflects:false` wird in `armor.js: armorBlocks()` bereits ausgewertet (Panzerung ohne Reflexion existiert konzeptionell, aber noch kein Gegner nutzt `reflects:false` — nur `t_mirror`/`t_phalanx`/`t_anvil` mit `reflects:true`) | **stimmt, reine Datenänderung bestätigt** |
| 8 | `t_shotgun`: `fireBullet()` kennt `twinShot`/`twinSpreadRad`, "auf N Kugeln verallgemeinern" | **Wichtiger Fund:** `fireBullet()` hat bereits einen **generischen N-Kugel-Fächer** über `tank.cfg.spreadCount`/`tank.cfg.spreadRad` (Z. 307–312), unabhängig von `twinShot` — das ist exakt die vom Auftrag geforderte "Verallgemeinerung" und existiert **bereits fertig**. Nur wird `spreadCount`/`spreadRad` heute ausschließlich über die Spielerkarte `streuschuss` in `applyUpgrades()` gesetzt (`cfg.js` Z. 295–296), **nicht** über `resolveCfg()`. Für einen Gegner reicht es, `spreadCount`/`spreadRad` **direkt in `resolveCfg()`** aus dem Typ zu lesen — kein neuer Fächer-Mechanismus nötig | **stimmt im Ziel, Umsetzung einfacher als beschrieben** |
| 9 | Für `t_shotgun`s kurze Einzelreichweite (210 px) wird "eine per-Kugel-`maxDistance`" gebraucht | **Zweiter Fund:** Es gibt bereits ein per-Kugel-Reichweitenfeld — `burstDistance` (`bullet.js` Z. 35/61/241), heute nur über die Karte `flak` gesetzt (`cfg.burstRangePx`, `tank.js` Z. 374). Ein Geschoss mit `burstDistance` gesetzt, aber **ohne** `explosive`, stirbt bei Erreichen der Distanz **ohne** zu explodieren — exakt das Verhalten, das der Streuer für seine 210-px-Schrotkugeln braucht. Auch hier: kein neuer Mechanismus, nur ein fehlender Lesezugriff in `resolveCfg()` | **stimmt im Bedarf, exakter Mechanismus existiert schon** |
| 10 | `t_lance`: `pierce` existiert bereits (`bullet.pierce`) | Bestätigt — UND `pierce` ist **bereits in der `resolveCfg()`-Whitelist** (`pierce: t.pierce ?? 0`, Nekromant-V2 Phase 2). Ein Gegnertyp kann `pierce: 2` direkt setzen, ganz ohne Codeänderung. Nur der **Ladezustand** (Windup/Lock/Sichtlinienabbruch) ist echter neuer Code | **stimmt, `pierce`-Teil braucht sogar keine Whitelist-Änderung** |
| 11 | `t_relay`: ein Boolean `state.relaySight`, gelesen an genau einer Stelle in `roleTurret()` | Kein solches Feld existiert aktuell — reiner Neubau, aber exakt in der beschriebenen Größenordnung (eine Bedingung an einer Stelle) | **stimmt** |
| 12 | `t_anchor`: Aura-Markierung nach Muster `t.necroAuraWeakened`, zwei Lesepunkte in `state.js` | `t.necroAuraWeakened` existiert (`ghost.js` Z. 962, gelesen in `state.js` Z. 1853/1858/1862) — **aber** das ist ein spezifisches Einzelfeld für genau einen Zweck (Nekromant-Champion-Aura), **kein** generisches `tank.auraFlags`-Objekt. Für `t_anchor`+`t_marshal`+künftige Auren-Gegner braucht es eine neue, verallgemeinerte Struktur (Baustein A) | **Muster stimmt, generische Umsetzung existiert noch nicht** |
| 13 | `t_grabber`: Haken existiert als Spieler-Gadget, nur Richtung umdrehen | `fireHook()`/`traceHook()`/`hookTimer` bestätigt vorhanden (`tank.js`). Die Umkehrung (Ziel wird gezogen statt Schütze) ist ein echter neuer Verhaltenszweig, aber auf bewährter Geometrie (`traceHook()`) aufgesetzt | **stimmt** |
| 14 | `t_harvester`: Hook in `killTank()` **und** `killGhost()` | `killGhost(state, g, cause = 'damage')` existiert in `ghost.js` Z. 721 — bestätigt als zweiter nötiger Hook | **stimmt** |
| 15 | `t_mason`: Flood-Fill wie im Generator fehlt zur Laufzeit | `generator.js: reachableCells(grid, startC, startR)` (Z. 126) ist eine fertige BFS-Implementierung, arbeitet aber auf dem **statischen Generierungs-Grid**, nicht auf dem **Laufzeit-Grid** in `state.js`. `state.js` hält jedoch ein eigenes, closure-lokales `grid`, das bei `placeTrapWall()`/`destroyWall()`/`setWallSolid()` synchron mitgeführt wird (Z. 559, 592, 629–664) — der Algorithmus ist 1:1 übertragbar, aber als **neue** Methode auf `state`, nicht als Aufruf der Generator-Funktion (die liegt in einem anderen Modul und kennt das Laufzeit-Grid nicht) | **stimmt im Bedarf, Umsetzungsort präzisiert** |
| 16 | `t_metronom`: `roleTurret()` gibt heute direkt `fire: true` zurück, braucht Zwischenschritt | Bestätigt (`ai_turrets.js: roleTurret()` liefert das Feuer-Flag direkt an `updateEnemy()`, das es unverändert an `fireBullet()` durchreicht) | **stimmt** |
| 17 | "Keiner der 16 Gegner braucht eine neue Architektur" | Nach Prüfung aller 16 technisch bestätigt — die zwei "größeren Systemänderungen" (`t_mason`, `t_metronom`) sind Eingriffe in bestehende Schleifen, keine neuen Module | **stimmt** |

### 1.3 Zusammenfassung der Abweichungen (drei, alle Richtung "einfacher als gedacht")

Keine der Abweichungen macht den Auftrag schwerer — alle drei zeigen, dass
der nötige Code bereits als generischer Mechanismus existiert und nur an
der `resolveCfg()`-Whitelist vorbeigeht, weil er bisher ausschließlich über
Spielerkarten erreicht wurde:

1. **`t_shotgun`** braucht keinen neuen Fächer-Mechanismus (`spreadCount`/
   `spreadRad` existieren), nur einen Whitelist-Eintrag.
2. **`t_shotgun`s kurze Reichweite** braucht kein neues `maxDistance`-Feld
   (`burstDistance` existiert, unexplosiv nutzbar), nur einen
   Whitelist-Eintrag.
3. **`t_lance`s Durchschlag** braucht gar keine Whitelist-Änderung
   (`pierce` ist schon durchgereicht) — nur der Ladezustand selbst ist neu.

Konsequenz für den Datenentwurf in G2: **`spread` wird kein neues
verschachteltes Feld**, sondern `t_shotgun` bekommt direkt
`spreadCount: 5`, `spreadRad: <halber Kegelwinkel in rad>`,
`burstRangePx: 210` — dieselben Feldnamen wie bei den Spielerkarten. Das
spart eine Übersetzungsschicht und hält genau eine Quelle für "wie feuert
ein Fächer".

---

## 2. Whitelist-Diff für `resolveCfg()`

`resolveCfg()` hat aktuell **exakt 44 Felder** (Skript-ausgezählt, deckungsgleich
mit der Angabe im Designdokument). Vorschlag für die neuen Einträge, in der
Reihenfolge, in der sie in G2–G7 gebraucht werden.
Jede Zeile mit `?? default` nach dem bestehenden Muster.

| Feld | Typ | Default | Gebraucht von | Bereits vorhanden? |
|---|---|---|---|---|
| `spreadCount` | number | `1` (über `?? 1`, kollidiert nicht mit dem bestehenden Karten-Pfad) | `t_shotgun` | **nein**, aber Fächer-Logik ja |
| `spreadRad` | number (rad) | `0` | `t_shotgun` | **nein**, aber Fächer-Logik ja |
| `burstRangePx` | number (px) | `0` | `t_shotgun` | **nein**, aber Burst-Logik ja |
| `charge` | `{windupS, lockAtS, bulletSpeed, abortOnLosLoss}` | `null` | `t_lance` (der `pierce`-Anteil braucht **kein** neues Feld, s. o.) | nein |
| `heal` | `{ratePerS, rangePx, needsLos, targets}` | `null` | `t_medic` | nein |
| `ram` | `{triggerPx, windupS, chargeS, speedMult, exhaustS, pushPx}` | `null` | `t_rusher` | nein |
| `suppressField` | `{radiusPx, noFlank, noExecute}` | `null` | `t_anchor` | nein |
| `sightRelay` | `{rangePx, shareWithAllies}` | `null` | `t_relay` | nein |
| `deathBlast` | `{fuseS, radiusPx, damage, friendlyFire}` | `null` | `t_dud` | nein (Kamikaze-Feld existiert nur spielerseitig, andere Semantik) |
| `rally` | `{fireRateMult, needsLos, maxTargets}` | `null` | `t_marshal` | nein |
| `stalk` | `{cloakBeyondPx, revealBeforeShotS, revealedS}` | `null` | `t_stalker` | nein |
| `tether` | `{splitPct, breakDistPx, breakOnWall, preferSameType}` | `null` | `t_tether` | nein |
| `harvest` | `{radiusPx, hpPerStack, damagePerStack, healOnStack}` | `null` | `t_harvester` | nein |
| `metronome` | `{beatS, holdWindowS, needsLos}` | `null` | `t_metronom` | nein |
| `grapple` | `{windupS, pullSpeedPxS, pullS, cooldownS, ropeHp, maxRangePx}` | `null` | `t_grabber` | nein |
| `build` | `{everyS, buildS, distancePx, hits, maxAlive, decayS, minPlayerDistCells}` | `null` | `t_mason` | nein |

**Nicht in dieser Liste, weil bereits vorhanden und ohne Änderung
nutzbar:** `radius`, `armor` (für `t_bulwark`), `damageType` (für
`t_arclight`), `pierce` (für `t_lance`).

**`t_stalker`s Tarnung** braucht zusätzlich keine neue Whitelist-Struktur
im engeren Sinn — `phaseToggle` existiert bereits als Muster
(`t_white`), aber `t_stalker`s Regel (distanzbasiert + schussgebunden,
nicht zeitbasiert) ist inhaltlich neu genug, dass `stalk` als eigenes Feld
klarer ist als eine Zweckentfremdung von `phaseToggle`.

---

## 3. Renderer-Inventar (Bausteine A–E)

| Baustein | Behauptet | Tatsächlicher Befund | Aufwand jetzt |
|---|---|---|---|
| **A · Aura-Flags** | "Muster existiert wörtlich" | Nur **ein** Spezialfall existiert (`t.necroAuraWeakened`, fest verdrahtet für die Nekromant-Champion-Aura). Ein generisches `tank.auraFlags = {noFlank, noExecute, fireRateMult}`-Objekt, das pro Tick zurückgesetzt und neu befüllt wird, muss neu geschrieben werden — aber nach exakt diesem bewährten Muster (ein Reset-Durchlauf + gezielte Lesepunkte) | **klein**, echter Neubau |
| **B · Verbindungslinien-Renderer** | "ein gemeinsamer Renderer für alle fünf" | Kein generischer existiert. `drawThreatLines()` (`effects.js` Z. 156) ist ein **naher Verwandter** — Raycast-Abbruch + einfache Linie —, aber fest auf rote Farbe/feste Deckkraft/"jeder Gegner zum Spieler" verdrahtet, nicht parametrisiert (Farbe, Dicke, Puls, beliebige Endpunkte fehlen). Als Vorlage sehr wertvoll, als Code nicht direkt wiederverwendbar | **klein**, Vorlage vorhanden |
| **C · Telegraph-Flächen** | "**null** — deckt beide Formen bereits ab" | **Zu optimistisch.** `drawAnvilHazards()`s Korridor-Zweig (Z. 407–447) ist hart an `state.anvilBoss`/`boss.chargeDir`/`boss.cfg.radius` gebunden, keine generische Funktion mit `(x,y,richtung,breite,länge)`-Parametern. `drawMortars()` ist ebenso hart an `state.mortars`/dessen Feldnamen gebunden. **Beide demonstrieren die richtige Technik** (Ray-March bis zur Wand, wachsende Füllung), sind aber nicht "null Aufwand" — sie müssen zu parametrisierten Helfern generalisiert werden, damit `t_rusher`/`t_lance`/`t_shotgun`/`t_grabber`/`t_dud` sie nutzen können | **klein bis mittel**, keine Neuerfindung, aber echte Generalisierungsarbeit |
| **D · Mehrfachschuss** | "`twinShot` ist die halbe Miete" | Übertroffen — `spreadCount`/`spreadRad` sind schon die **volle** Miete (s. Abschnitt 1.3), fehlt nur der Whitelist-Durchgriff | **~keiner** |
| **E · Kompositionsregeln** | "alle" | `buyEnemies()` bestätigt rein zufällig, `maxPerRoom` bestätigt ausgewertet, aber von keinem Typ gesetzt (`data/difficulty.json: danger.t_teal` z. B. hat kein `maxPerRoom`) | **mittel**, wie in G-Plan G4 beschrieben |

---

## 4. Regressionsfolgen

`tests/regression.mjs` Abschnitt 10a (Z. ~1618 ff.) iteriert
**`Object.entries(tanksData.types)`** und prüft für jeden Nicht-Boss-Typ
`2 ≤ ⌈maxHp/10⌉ ≤ 5`. Das bedeutet: **sobald ein neuer Typ nur in
`data/tanks.json` steht** (unabhängig davon, ob er in
`difficulty.json: danger` kaufbar ist), wird er von diesem Test bereits
erfasst. Alle 16 vorgeschlagenen Gegner liegen mit 20–50 LP im erlaubten
Band — dieser Test bleibt **automatisch** grün, ohne Anpassung.

**Was sich tatsächlich ändert, sobald ein Typ in `danger` auftaucht:**
`buyEnemies()` zieht ihn ab diesem Moment in echte Raumkäufe ein.
`tests/regression.mjs` spielt 5 feste Seeds über volle Runs (Determinismus-
und Sieg-Proben) — diese Seeds erzeugen ab dem ersten scharf geschalteten
Typ **andere** Räume als vorher. Das ist **kein Fehler** (die Tests prüfen
Determinismus und Gewinnbarkeit, nicht exakte Raumzusammensetzung), aber:

- Kein bestehender Test vergleicht einen Raum gegen eine feste erwartete
  Gegnerliste — nachgeprüft, es gibt keine "Raum X mit Seed Y enthält
  genau diese Gegner"-Assertion. Die Sieg-/Determinismus-Proben bleiben
  also unabhängig von der Gegnerzusammensetzung gültig.
- Betroffen wäre nur eine **manuelle** Erwartung an eine bestimmte
  Encounter-Reihenfolge (z. B. für die Abnahme-Protokolle in G8) — die
  müssen ohnehin erst nach G8 (Difficulty Curve) sinnvoll geprüft werden.

**Empfehlung:** kein Schalter nötig (s. O1 unten) — die Regressionssuite
ist bereits robust gegen neue Typen, weil sie nie eine exakte
Raumzusammensetzung fordert. Ein Datenschalter würde nur zusätzliche
Komplexität einführen, ohne ein echtes Testrisiko zu beheben.

---

## 5. Antworten auf die offenen Entscheidungen O1–O6

Als **Vorschlag mit Begründung** — die Festlegung trifft der Nutzer.

### O1 · Regressions-Fixtures

**Befund (s. Abschnitt 4):** Die Regressionssuite hat **keine**
Assertions, die eine exakte Raumzusammensetzung erwarten. Sie prüft
Determinismus (derselbe Seed → derselbe Ablauf) und Gewinnbarkeit (5 Seeds
kommen bis zum Sieg) — beides bleibt unabhängig davon gültig, welche
Gegner tatsächlich gekauft werden.

**Vorschlag: kein Datenschalter.** Jeder Gegner wird in der Phase scharf
geschaltet, in der er gebaut wird (z. B. `t_rusher` schon in G2). Ein
`enabled:false`-Schalter in `danger` würde `unlockedEnemyTypes()`
(`run.js`) eine weitere Bedingung hinzufügen, ohne ein echtes Problem zu
lösen — die Suite bleibt so oder so grün, weil sie nie exakte
Raumzusammensetzung prüft. **Einzige Pflicht pro Phase:** nach dem
Scharfschalten eines Typs `node tests/regression.mjs` laufen lassen und
den schlechtesten Frame melden (Grundregel). Das entspricht auch eher dem
Vorgehen aller bisherigen Sitzungen in diesem Projekt (Amboss, Spinnenboss
— beide wurden direkt scharf geschaltet, kein Schalter).

### O2 · Mindestpunktzahl vs. Akt 1

**Befund:** `data/difficulty.json: acts[0].budget` = `{base: 2, perRoom:
2.2}` → Raum 17 hat 39,4 Budget. `punkte < budget/12` würde bei Budget 39,4
`t_brown` (1) und `t_grey` (2) beide ausschließen (Schwelle 3,28), obwohl
sie in Akt 1 **den ganzen Bestand** stellen (nur `t_teal`/4 und `t_yellow`/3
kommen sonst noch dazu, `t_yellow` läge mit 3 knapp unter der Schwelle in
späten Räumen).

**Vorschlag: die Regel gilt nur ab Akt 2.** `buyEnemies()` bekommt den
`actIndex` bereits als Parameter — die Mindestpunktzahl-Prüfung greift nur
bei `actIndex >= 2`. Das ist konsistent mit der Design-Absicht
("`t_brown`/`t_grey` verstopfen **Akt 3**", nicht Akt 1) und braucht keine
zusätzliche Ausnahmeliste.

### O3 · Elite-Affixe pro Typ

**Befund:** `data/difficulty.json: elite.affixes` ist eine flache Liste
ohne Typbezug; die Zuweisung in `run.js` (Funktion nicht namentlich
geprüft in dieser Phase, aber die Datenstruktur bestätigt typunabhängig)
zieht Affixe unabhängig vom Gegnertyp.

**Vorschlag: kleines optionales Datenfeld, kein Zwang.** `data/tanks.json:
types[id].affixDeny` (Array von Affix-Namen) — wird nur ausgewertet, wenn
gesetzt (Rückfall: alle Affixe erlaubt wie bisher). Das ist der gleiche
"Rückfall hält es risikoarm"-Grundsatz wie beim Kompositionssystem. Zu
klären: Priorität niedrig — betrifft nur Eliteräume, kein Blocker für G2–G6.
Diese Umsetzung gehört in **G8**, nicht früher (dort werden ohnehin die
Encounter/Kompositionen final verdrahtet).

### O4 · Anker und Nekromant

**Befund:** `killTank()`s Nekromant-Zweig (`necroKill`/`canRevive`) hängt
**ausschließlich** an `killer === state.player || killer?.isGhost` und
`!isBossCfg(tank.cfg)` — **nicht** an `tank.executing` oder der
Exekutionsschwelle. Ein `t_anchor`-Feld (`noExecute`) schaltet nur die
Garantie "stirbt sicher unter 35 %" ab, ändert aber nichts daran, *dass*
ein Kill überhaupt stattfindet (der Spieler tötet den Gegner ja trotzdem
normal, nur ohne die Exekutionsgarantie). Stichprobe über
`data/upgrades_necro.json` (115 Karten) nach `execut` im Text/`core`-Feldern
war in dieser Phase nicht Teil der Pflichtlektüre und wird **in G3**
nachgeholt, wenn `t_anchor` tatsächlich gebaut wird (näher am Code, kleinere
Fehlerfläche).

**Vorschlag:** Frage bleibt offen für G3, dort mit einem gezielten `grep`
über `core.execut*`/`necroExec*` in `data/upgrades_necro.json` beantworten,
**bevor** `suppressField.noExecute` gebaut wird. Kein Blocker für G0–G2.

### O5 · `t_dud` und Schrott

**Befund:** Schrott aus Kills läuft über `state.bonusScrap`/Combo-Zähler
(bereits in mehreren Karten wie `beutejagd` genutzt) — ein Multi-Kill durch
eine Explosion zählt heute schon mehrfach (jeder einzelne `killTank()`-
Aufruf trägt zum Schrott/zur Combo bei, das ist bestehendes Verhalten von
Minen/Kettenblitz, nicht neu).

**Vorschlag: voll zählen lassen, keinen Deckel einführen.** Das entspricht
dem bestehenden Verhalten jeder anderen Multi-Kill-Quelle (Minen-
Kettenreaktion, Kettenblitz) — `t_dud` wäre eine Ausnahme, wenn er gedeckelt
würde, und Ausnahmen sind genau das, was die Projektkonvention
("keinen Ersatzdeckel einführen", CLAUDE.md) vermeiden will. Der Blindgänger
bleibt damit konsistent zu jeder bestehenden Flächenschaden-Quelle.

### O6 · Umfang

**Vorschlag: G0–G4 als erste Lieferung.** Das ist im Auftrag selbst als
sauberer Schnitt benannt. Nach G4 ist Akt 2 vollständig **und** das
Kompositionssystem steht — Akt 3 bleibt bis dahin exakt so spielbar wie
heute (keine der G5–G9-Änderungen berührt bestehende Akt-3-Mechanik). Das
ist auch die risikoärmste Reihenfolge: Das wichtigste Einzelsystem
(Kompositionen, G4) ist damit früh geliefert, nicht erst am Ende.

---

## Zusammenfassung — was sich gegenüber dem Designdokument ändert

Nichts an der **Designabsicht**. Drei kleine, ausschließlich
vereinfachende technische Präzisierungen (Abschnitt 1.3), eine
präzisierte Formulierung für Baustein C (Generalisierung statt
Wiederverwendung), und sechs beantwortete offene Entscheidungen — vier
davon (O1, O2, O5, O6) mit klarer Empfehlung, zwei (O3, O4) bewusst auf
die Phase verschoben, in der sie tatsächlich gebraucht werden.

**Nächster Schritt:** Freigabe abwarten. Nach Freigabe: Phase G1
(Fundament — fünf Bausteine, null neue Gegner, siehe Abschnitt 3 dieses
Dokuments für den bereits geschärften Umsetzungsplan der Bausteine A–D).
