# Archiv — Index

Index für alles, was der **Grundsteinumbau** (`AUFTRAG-GRUNDSTEINUMBAU.md`)
aus dem laufenden Spiel entfernt. Gilt für den gesamten Umbau (Phase 0–10):
**in diesem Umbau wird nichts gelöscht** — nur aus dem aktiven Code/den
aktiven Daten entfernt und hier abgelegt, mit genug Kontext, um es bei
Bedarf zurückzuholen.

## Regeln

1. **Erst archivieren, dann entfernen — im selben Commit.** Kein
   Auskommentieren, keine toten Codeblöcke im aktiven Code.
2. Diese Datei ist der **Index** (lesbar, Prosa). Die eigentlichen Daten
   liegen daneben in `archive/` — JSON bleibt maschinenlesbar/
   wiedereinspielbar, Mechanikbeschreibungen stehen als eigene `.md`-Dateien,
   weil sie in dieser Datei sonst unlesbar würden (`upgrades.json` allein
   hat >3.700 Zeilen).
3. Jeder Eintrag unten nennt: was entfernt wurde, in welcher Phase, warum,
   welche Datei die Daten trägt, und was beim Zurückholen zu beachten ist.
4. Nichts hier ist "totes Wissen" — mehrere Einträge sind ausdrücklich
   **Wiederanschlusspunkte** für spätere Aufträge (Klassenpools, der
   überarbeitete Nekromanten-Auftrag), keine Grabsteine.

## Index

| Was | Phase | Warum | Datei | Zurückholen |
|---|---|---|---|---|
| Bandenschuss (Abpraller-Physik, Bankshot-KI, Trickshot-Belohnung, Spiegelwand-Erzeugung, `t_prism`, `bankshotGuarantee`, Raum-Modifikatoren „Überdruck"/„Spiegelsaal", Abpraller-Telemetrie) | 1 (gemergt) | Erzwingt langsame Spielerkugel → unzumutbare Vorhaltewinkel; Ziellinie zeigt nur Kugelweg, nicht Zielposition | `archive/bandenschuss.md` | Mechanikbeschreibung lesen, betroffene Felder/Funktionen wieder einbauen. Die beiden Phase-0-Blocker (Reaktor-Generatoren, `t_mirror`) sind über den Boss-Platzhalter (`t_black`) gelöst, nicht über den ursprünglich vorgeschlagenen Direkttreffer-Umbau — siehe „Ist-Abgleich" unten und `bandenschuss.md`. |
| Alle Upgrade-Karten (aktuell 251, nicht 246 — s. u.) | 4 | Klassen bekommen künftig eigene Kartenpools statt eines gemeinsamen Generik-Pools | `archive/upgrades-v1.json` | Verbatim-Kopie von `data/upgrades.json` (Stand Phase 0) — Datei kann 1:1 zurückkopiert werden. Enthält auch alle Signaturkarten der acht geparkten Klassen und die sechs Elementtöpfe. |
| Transformationen | 4 | Hängen an `run.tagCounts` der alten Kartentags; der 5-Karten-Sockel kann „drei Karten desselben Tags" strukturell nicht erreichen | `archive/systeme-v1.md` (Abschnitt 1) | `data/transformations.json` bleibt unverändert im Repo stehen — nur die auswertenden Codepfade werden entfernt und müssten reaktiviert werden. |
| Zweitelement-System | 4 | Ohne `damageType`-Karten (die mit den 251 Karten fallen) wirkungslos | `archive/systeme-v1.md` (Abschnitt 2) | Erst Klassenpool mit `damageType`-Karten wiederherstellen, dann Codepfade. |
| Element-Filter im Angebot | 4 | Setzt Zweitelement-System voraus, s. o. | `archive/systeme-v1.md` (Abschnitt 3) | Wie Zweitelement — vom `signatureClass`-Filter unterscheiden, der bleibt bestehen. |
| Schatzraum „1 Legendär" | 4 (Übergang, kein Vollabbau) | 5-Karten-Sockel enthält keine `legendary`-Karte | `archive/systeme-v1.md` (Abschnitt 4) | Übergangslösung: Schrottpaket statt Karte. Codepfad `onlyRarity: 'legendary'` bleibt im Code stehen, wird nur nicht mehr erreicht — automatisch wieder aktiv, sobald ein Pool Legendaries führt. |
| 8 Klassen (`c_blast`/`c_frost`/`c_tesla`/`c_toxic`/`c_scrap`/`c_ricochet`/`c_engineer`/`c_flame`) | 5 | Nur `player` (Nulllinie) und `c_necro` (laufender Nekromanten-Auftrag) bleiben aktiv, bis jede Klasse einen eigenen Pool hat | `archive/klassen-v1.json` | Wird in `data/tanks.json` auf `enabled: false` gesetzt, nicht gelöscht — Datei hier ist zusätzliche Referenz-/Backup-Kopie. `c_ricochet` braucht bei Rückkehr einen Neuentwurf (Bandenschuss ist weg), die fünf Elementklassen eine Bestandsprüfung ihrer Kartenbasis. |
| `t_prism` (Gegnertyp) | 1 | Besteht nur aus `bounceDamageTakenMult` — ohne Bandenschuss ohne Wirkung | `archive/gegner-v1.json` | Eintrag zurück in `data/tanks.json:types` + `data/difficulty.json:danger`. |
| Alter Extra-Leben-Mechanismus (`extraLifeEveryClearedRooms`) | 6 | Bei ~50 Räumen über 3 Akte wären das +8 bis +10 Leben statt der gewollten 2 (je +1 nach Akt 1/2) | `archive/systeme-v1.md` (Abschnitt 5) | Wert bleibt unverändert in `data/difficulty.json` stehen, nur der auswertende Codepfad in `run.js` fällt. |

**Referenz, kein Archiveintrag:** `archive/gegner-v1.json` enthält zusätzlich
die **Vor-Phase-3-Fassung von `t_green`** (Bankshot-Schütze). Der Typ selbst
bleibt im Spiel und wird in Phase 3 zum Mörserschützen umgebaut — die
archivierte Fassung ist reine Dokumentation "wie war es vorher", kein
Wiederherstellungsziel.

## Ist-Abgleich Phase 0 (Auftrag Abschnitt 3, gegen den Code geprüft am 2026-08-17)

> **Update (2026-08-17, Nutzerentscheidung nach dieser Sitzung):** Die
> beiden unten dokumentierten Blocker (Punkt 1 und 2) waren **keine
> Blocker für Phase 1 mehr** — die Bosse sind noch nicht ausgearbeitet und
> werden in einer eigenen künftigen Aufgabe neu gebaut; `run.js:
> BOSS_ENEMY_TYPES` ersetzt alle drei Boss-Arenen durch einen
> Platzhalter-Gegner (`t_black`). Details: `CLAUDE.md`, Abschnitt "Bosse
> (Platzhalter, Nutzerentscheidung)".
>
> **Update (Phase 1, gemergt):** Beide Punkte sind jetzt umgesetzt —
> **nicht** über den unten vorgeschlagenen "Generator auf Direkttreffer
> umstellen"-Fix, sondern konsequent über den Boss-Platzhalter: da kein
> Boss im normalen Spiel mehr gespawnt wird, hat Phase 1 die
> Bandenschuss-Bedingungen bei Reaktor-Generator UND `t_mirror` ersatzlos
> entfernt, ohne ihr Verhalten zu ersetzen (Generatoren sind jetzt normale
> unzerstörbare Wände, `t_mirror` würde bei jedem Kugeltreffer weiter
> abprallen). Beide bleiben als Wiederanschlusspunkt für einen künftigen
> Bossneubau dokumentiert, Details in `archive/bandenschuss.md`.

Alle Punkte aus dem "Verifizierten Ist-Stand" wurden am aktuellen Code
nachvollzogen. Die meisten stimmen; drei sind echte Abweichungen, zwei davon
mit Konsequenz für Phase 1 — **vor Phase 1 zu entscheiden, nicht zu
übergehen:**

### 1. Reaktor-Generatoren brauchen HEUTE bereits einen Bankshot — nicht umgekehrt

Der Auftrag behauptet: "Die Generatoren … fallen per **Direkttreffer** …
**Kein Bankschuss nötig** — die 'Bankshot'-Formulierungen in den
Kommentaren sind Reste." Das ist falsch. Tatsächlicher Code
(`src/game/bullet.js:136`):

```js
else if (wall.type === 'generator' && b.wallBounces > 0) state.destroyWall?.(wall);
```

Ein Generator nimmt **nur** Schaden von einer Kugel, die vorher schon an
einer ANDEREN Wand abgeprallt ist; ein Direkttreffer "prallt wirkungslos ab
wie an jeder anderen Wand" (Codekommentar, Zeilen 131–133). Explosionen
(Minen) können Generatoren gar nicht beschädigen (`mine.js` hat keinen
`generator`-Zweig). **Mit Phase 1 (kein Wandabpraller mehr, `wallBounces`
entfällt) kann `b.wallBounces > 0` nie mehr eintreten — der
Reaktor-Bosskampf (Akt 1) wird ohne eine gezielte Codeänderung an genau
dieser Stelle unlösbar.** Vorschlag (keine Entscheidung, nur der
naheliegende Fix): die Bedingung in Phase 1 auf reinen Direkttreffer ändern
— dann stimmt nachträglich wenigstens die Absicht, die der Auftrag dem
Ist-Stand fälschlich schon unterstellt hat.

### 2. `t_mirror` (Boss "Der Spiegel", Akt 2) hängt an genau dem Mechanismus, den Phase 1 "ersatzlos" entfernt

`t_mirror` nutzt `requiresRicochet: true` **und** `armor: { arc: 360,
reflects: true }`. Bei `arc >= 360` blockt `armor.js: armorBlocks()`
**jeden** Treffer — die einzige Ausnahme ist `requiresRicochet`, das über
`!hasWallBounced(b)` durchlässt, wenn die Kugel schon an einer Wand
abgeprallt ist. Phase 1 des Auftrags verlangt ausdrücklich: "`hasWallBounced()`
und `requiresRicochet` entfallen ersatzlos." Ohne Wandabpraller gibt es die
Ausnahme nicht mehr — **jede Kugel, aus jeder Richtung, würde am Spiegel
abprallen, ohne ihn je zu verwunden.** Explosionen (Minen, permanenter
Bombenslot) ignorieren Panzerung bewusst und blieben wirksam — der Spiegel
wäre also nicht buchstäblich unbesiegbar, aber jede Kugelwaffe des Spielers
würde an ihm komplett wirkungslos. Der Auftrag adressiert das an keiner
Stelle. **Muss vor/in Phase 1 entschieden werden**, z. B.: der Spiegel
bekommt (wie einst das Prisma) einen Schadensmultiplikator statt eines
Zwangs, oder einen deutlich engeren `arc`, oder eine neue eigene Schwäche
im Rahmen des in Phase 1 ohnehin neu gebauten Flanken-/Panzerungssystems.

### 2b. `t_prism` entspricht NICHT mehr der Ist-Stand-Prosa des Auftrags — die Festgelegte Entscheidung (Abschnitt 2) ist dagegen korrekt

Abschnitt 3 des Auftrags behauptet: "`t_prism` nutzt `requiresRicochet` —
fällt mit dem Typ." Das war der Stand vor **UMBAUPLAN-LP Phase 8**
("Prisma: Zwang → Anreiz"). Der aktuelle `t_prism`-Eintrag hat **weder**
`armor` **noch** `requiresRicochet** — nur `bounceDamageTakenMult: 3` (3×
Schaden bei einem Wandabpraller, sonst normaler Schaden). `requiresRicochet`
wird im gesamten Codebestand nur noch von `t_mirror` verwendet (s. o.). Die
"Festgelegte Entscheidung" in Abschnitt 2 des Auftrags ("`t_prism` — ins
Archiv — besteht nur aus `bounceDamageTakenMult`") ist davon nicht
betroffen und **stimmt bereits mit dem Code überein** — nur die erklärende
Prosa in Abschnitt 3 ist veraltet. Keine Handlungskonsequenz, nur zur
Klarstellung, damit die beiden Aussagen im Auftrag nicht als Widerspruch
missverstanden werden.

### 3. Kleinere, folgenlose Abweichungen

- **Kartenzahl:** `data/upgrades.json` enthält aktuell **251** Karten
  (common 80 / rare 98 / epic 19 / unique 36 / legendary 18), nicht 246 wie
  im Auftrag mehrfach genannt (Phase 4, Abschnitt 6) — vermutlich, weil die
  Zahl aus einer früheren Sitzung stammt und nach der letzten Erweiterung
  (Nekromanten-Signaturpool 12→18 Karten) nicht nachgezogen wurde. Reine
  Prosa-Zahl, keine Logik betroffen; archiviert wurde die tatsächliche
  Datenlage (251).
- **`drawAimLine()` liegt in `src/render/effects.js:277`, nicht in
  `renderer.js`** (Auftrag: "`renderer.js`, `drawAimLine`-Block ab ca. Zeile
  516"). `renderer.js` importiert die Funktion nur und ruft sie in Zeile
  ~1150 auf. Für Phase 1/2 relevant: die Änderung am Abpraller-Vorgriff
  betrifft `effects.js`, nicht (nur) `renderer.js`.
- **Zeilennummern-Drift** (Inhalt/Namen stimmen, nur die Zeile ist um
  wenige bis ~15 Zeilen verschoben — normale Folge späterer Commits):
  `ai_turrets.js: solveBounce()` Zeile 34 (Auftrag: 32), `bounceShot()`
  Zeile 77 (Auftrag: 75), `state.js: state.bounceSolveBudget` Zeile 887
  (Auftrag: 875–878), `tanks.json: t_green.requiresBounceShot` Zeile 315
  (Auftrag: 314), `run.js: run.maxLives`-Zuweisung Zeile 672 (Auftrag: 666),
  `run.js: extraLifeEveryClearedRooms`-Auswertung Zeile 888 (Auftrag: 881),
  `run.js`-Schatzraum-Belohnungsblock Zeile 503 ff. (Auftrag: 502 ff., exakt).

### 4. Alles Übrige bestätigt

Ohne Abweichung nachvollzogen: `balance.bullet.speed: 200`,
`tanks.json.bulletSpeeds` (`bullet:130`/`rocket:300`/`bounce_rocket:200`,
letzteres aktuell von keinem Typ genutzt), Raketennutzer exakt
`t_teal`/`t_green`/`t_black`/`t_reactor`, `balance.bullet.wallBounceDamageMult:
2.5` (bereits auf Nutzerwunsch von 2.0 angehoben, s. `CLAUDE.md`-To-do),
`balance.bullet.selfImmunity: 0.35`, `balance.damage.ownBullet: 15`,
Wandtyp `'r'` im Code vorhanden (`state.js:34`) aber null Mal in
`tiles.json`/`arenas.json` platziert, `armor.js`-Mechanik (Frontsektor
relativ zur Wannen-`heading`, reflektierte Kugeln behalten Besitzer/
verlieren Abpraller/wechseln Farbe, Explosionen ignorieren Panzerung
bewusst), `mine.js: explodeAt(state, x, y, R, spare, meta, damage,
damageType)`-Signatur exakt wie beschrieben, Reaktor-Struktur (Rolle
guardian, `bossInvincible` bis `bossGeneratorsLeft === 0`, generatorHits: 2)
bis auf den Direkttreffer-Punkt oben, `t_phalanx`-Formation (fünf Panzer,
wandernde Panzerungslücke) unverändert wie beschrieben, Kartengraph bereits
verzweigt (`run.js`: layers/nodes/edges, `difficulty.map`: 2–3 Knoten/Ebene,
`extraEdgeChance: 0.4`), sechs Raumtypen ohne `rest`
(`ROOM_TYPE_INFO`), Schatzraum kostet 1 Leben + gibt 1 Legendär
(`difficulty.treasure.lifeCost: 1`), `run.maxLives` existiert bereits als
Deckelfeld, Kartenangebot `everyNRooms: 1`/`offersPerScreen: 3`, Shop
`cardChoices: 5`, `scrap.cost` inkl. `rerollElement: 4`,
`bankshotGuarantee` bereits No-op (`chance: 0`, `types: ["t_prism"]`,
`minRoom: 6`).
