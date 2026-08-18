# Weitere Systeme (archiviert Phase 0, Grundsteinumbau v3)

Archiviert am 2026-08-17. Fünf Systeme, die im Grundsteinumbau in
verschiedenen Phasen entfallen — hier gebündelt dokumentiert, weil sie zu
klein/verstreut für eigene Dateien sind, aber zu wichtig für einen reinen
`ARCHIV.md`-Einzeiler. Jeder Abschnitt nennt die entfernende Phase, den
Grund und die tragenden Codestellen (verifiziert am Stand vom 2026-08-17).

> **Update (Phase 4, gemergt):** Abschnitte 1-4 sind wie unten geplant
> umgesetzt, mit zwei kleinen Abweichungen: (a) der `elements`-Filter in
> `buildCandidates()` (Abschnitt 3) ist **entfernt**, nicht nur inert stehen
> gelassen (leerer Code ohne Zweck ist im Projekt sonst nirgends Konvention);
> (b) der 5-Karten-Sockel bekam zusätzlich zwei proaktive Sicherheitsnetze,
> die nicht im Auftragstext stehen: `rollOffers()`/`drawOne()` füllen ein
> erschöpftes Angebot seither mit `null`/einem kürzeren Array statt der
> alten Fallback-Karte auf (der Sockel hat nur 20 Gesamtstufen — ein langer
> Run kann ihn leerziehen), und `run.js` weicht bei leerem Angebot sofort auf
> `afterRoomDone()` aus statt mit 0 Karten im Upgrade-Screen hängen zu
> bleiben (dieselbe Fehlerklasse wie „Bugfix: Kartenscreen blockierte den
> Run", CLAUDE.md). Details/Testabdeckung: `tests/regression.mjs`.

## 1. Transformationen (entfällt mit Phase 4)

`data/transformations.json`: drei Karten desselben Tags (Schwelle
`threshold: 3`, gezählt in `run.tagCounts`) schalten einen dauerhaften Bonus
frei. Fünf Einträge: **Pionier** (terrain, doppelte Wandhaltbarkeit + eigene
Minen harmlos), **Kavallerie** (mobility, halbierter Dash-Cooldown +
Unverwundbarkeit während der Aufladung), **Taktiker** (information,
Zeitlupe bei naher Kugel), **Bollwerk** (defense, Notschild-Ladungen
verfallen nicht), **Saboteur** (control, betäubte Gegner explodieren beim
Aufwachen).

Fällt mit Phase 4, weil `run.tagCounts` an den 246/251 alten Karten-Tags
hängt, die komplett archiviert werden — der Sockel (5 Karten, je eigener
Tag) kann die geforderten "drei Karten desselben Tags" strukturell nicht
mehr erreichen. Trägt: `run.js: unlockTransformation()` (aus
`applyUpgradeChoice()`), `run.transform`/`state.transform`
(`transformEffects(run)`, einmal pro Raumaufbau gebacken),
`src/ui/upgradescreen.js` (Fortschrittsanzeige "Aktiv: …"/"Fortschritt: …").
Zum Zurückholen: `data/transformations.json` unverändert lassen (bleibt im
Repo stehen, wird nicht gelöscht) und die o. g. Codepfade reaktivieren,
sobald ein neues Kartensystem wieder Tags mit ≥3 Karten trägt.

## 2. Zweitelement (entfällt mit Phase 4)

UMBAUPLAN-LP Phase 17: jede Klasse zieht zusätzlich zu ihrem Primärelement
ein zufälliges, seedgetriebenes Zweitelement mit halber Angebotsgewichtung.

- `run.js: drawSecondElement(seed, primary, idx)`, `elementsOf(run)`
  (Zeile ~946), `run.secondElement`/`run.elementRerolls`
  (im Snapshot persistiert).
- `upgradepool.js: makeElementWeight()` (Zeile ~71–78): Faktor
  `d.damageType === second ? secondWeight : 1`, verrechnet in
  `weightedPick` zusammen mit der Synergie-Gewichtung.
- `run.js: rerollSecondElement()` (Zeile ~956), Preis
  `balance.scrap.cost.rerollElement: 4`.
- `balance.upgrades.secondElementWeight: 0.5`.

Fällt mit Phase 4, weil es keine `damageType`-Karten mehr gibt (die sechs
Elementtöpfe sind Teil der 251 archivierten Karten) — ein Zweitelement ohne
Karten, die es nutzen, ist wirkungslos. Zum Zurückholen: erst den
Klassenpool mit `damageType`-Karten wiederherstellen (s.
`archive/klassen-v1.json`), dann diese Codepfade.

**Nachtrag (Grundsteinumbau Phase 8):** ein letztes Fragment stand noch in
`roomscreens.js: createShopScreen()` — ein `if (ctx.onRerollElement)`-Zweig,
der seit Phase 4 nie mehr auslöste (`main.js` setzt `onRerollElement`/
`getSecondElement` nicht mehr). Toter, unerreichbarer Code, jetzt entfernt.

## 3. Schadenstypen-Angebot / Element-Filter (entfällt mit Phase 4)

Der `elements`-Filter in `upgradepool.js: buildCandidates()` (Zeile ~180):
`if (elements && def.damageType && !elements.includes(def.damageType))
continue;` — lässt eine Karte mit `damageType` nur zu, wenn ihr Typ zum
Element-Set der Klasse gehört (Primär- + Zweitelement). Karten OHNE
`damageType` (Kernpool/Sockel) bleiben davon unberührt.

Zusammen mit dem Zweitelement-System (s. o.) obsolet, sobald keine
`damageType`-Karten mehr existieren — der Filter selbst (die Codezeile)
kann technisch stehen bleiben (er tut dann nichts, weil `def.damageType`
nie gesetzt ist), wird aber der Vollständigkeit halber mit archiviert, weil
er ohne Zweck sonst als totes Feature im Code hinge. **Nicht identisch mit
dem `signatureClass`-Filter** (klassengebundene, nicht elementgebundene
Karten) — der bleibt als Pipeline-Baustein bestehen (nur mit dem Sockel
vorerst ungenutzt, da keine Sockelkarte `signatureClass` trägt).

## 4. Schatzraum-Legendär-Belohnung (Übergangslösung ab Phase 4)

`run.js` (Zeile ~978–981): bei `run.rewardKind === 'treasure' ||
'cursed'` zieht `rollReward()` mit `onlyRarity: 'legendary'` (Tag-Regel
und Raumgrenzen-Filter ausgeschaltet) — "1 Legendär" für 1 Leben Kosten
(`difficulty.treasure.lifeCost: 1`).

Bricht mit Phase 4, weil der 5-Karten-Sockel keine `legendary`-Karte
enthält (nur die zukünftigen Klassenpools werden welche haben). Phase 4
ersetzt die Belohnung übergangsweise durch ein Schrottpaket
(`balance.scrap.treasure`); der `onlyRarity: 'legendary'`-Codepfad selbst
bleibt technisch bestehen (wird nur nicht mehr erreicht, solange kein Pool
Legendaries führt) — erst wieder scharf, sobald ein Klassenpool (laut Plan:
der künftige Nekromanten-Pool) Legendaries hat. **Nicht löschen, nur
umleiten** — anders als die übrigen vier Punkte dieses Dokuments ist das
kein reiner Codeabbau, sondern ein Wiederanschlusspunkt.

## 5. Alter Extra-Leben-Mechanismus (entfällt mit Phase 6)

`data/difficulty.json: extraLifeEveryClearedRooms: 5`, ausgewertet in
`run.js` (Zeile ~888): `if (run.roomsCleared %
run.difficulty.extraLifeEveryClearedRooms === 0) { … }` — +1 Leben alle
fünf geräumten Räume, ohne Deckel-Bezug zu einem Akt-Ereignis.

War für die alte 16-Raum-Struktur gedacht (~3 Extra-Leben pro Run). Bei
~50 Räumen über drei Akte (Grundsteinumbau Phase 6) wären das bis zu **+8
bis +10 Leben** — der Tod wäre praktisch abgeschafft. Ersetzt durch
`acts[].lifeReward`: genau +1 Leben nach Aktboss 1 und 2 (0 nach Boss 3,
der Run ist danach vorbei), gedeckelt auf `run.maxLives` (das Deckel-Feld
existiert bereits seit vor diesem Umbau, `run.js` Zeile ~672, unverändert).
Zum Zurückholen: `extraLifeEveryClearedRooms` steht unverändert in
`data/difficulty.json` (wird nicht gelöscht, nur der auswertende Codepfad
in `run.js` entfernt) — der Wert kann direkt wiederverwendet werden, falls
der Akt-Mechanismus je zurückgebaut wird.

## 6. `everyNRooms` (entfällt mit Phase 9)

`data/upgrades.json: everyNRooms: 1` — sollte laut Namen/Kommentar steuern,
nach wie vielen Räumen ein Kartenangebot erscheint ("nach jedem Raum").

War aber bereits vor Phase 9 **totes Datenfeld**: keine Stelle in `src/`
liest `everyNRooms` (per `grep -rn` verifiziert). Die tatsächliche Steuerung
war schon immer strukturell — der `enemiesLeft === 0`-Block in
`run.js: stepRun()`, der überhaupt erst ein Angebot auslöst, existiert nur
für Räume, die einen echten Kampfzustand mit Panzern bauen (`combat`/
`elite`/`cursed`, über `buildCombatRoom()`). Nicht-Kampfräume (`event`/
`workshop`/`rest`/`treasure`) laufen nie durch diesen Codepfad. Phase 9
macht diese bereits bestehende Regel nur explizit (Auftrag: "Kartenangebot
nach Kampf-, Elite- und Fluchräumen") und entfernt das nie gelesene Feld.
Zum Zurückholen: reine Datenfeld-Wiederherstellung in `data/upgrades.json`,
ein tatsächlicher "alle N Räume"-Mechanismus müsste komplett neu gebaut
werden (gab es so nie).
