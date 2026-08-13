# UMBAUPLAN-GEISTER.md

Tag-Ausbau, fünf Seltenheiten, Pool-Neubau, Geisterpanzer.

**Arbeitsregel: eine Phase pro Claude-Code-Sitzung, kein Überlappen.** Jede
Phase endet mit Abnahmekriterien und Tests, jeder neue Test mit bestandener
Gegenprobe. Alle Stellwerte gehören in `data/*.json`, nicht in den Code.

**Umfang: 9 Sitzungen** (Phase 3 ist in vier Sitzungen geteilt, Begründung
unten). **Status: noch nichts gebaut — dieser Plan wartet auf Freigabe.**

---

## ⚠️ Vorbemerkung: die beiden Specs fehlen im Repo

Der Auftrag verweist durchgehend auf `docs/SPEC-UPGRADES.md` (Spec 1) und
`docs/SPEC-GEISTERPANZER.md` (Spec 2). **Beide existieren nicht** — weder auf
`main` noch auf einem der sieben anderen Remote-Branches, und ein
`docs/`-Verzeichnis gibt es nicht. Geliefert wurde nur der Prompt selbst.

Dieser Plan ist deshalb aus den **Festlegungen 1–12 und den Phasentexten des
Prompts** gebaut, die den Spec-Inhalt an den entscheidenden Stellen
ausformulieren. Wo der Prompt nur auf einen Spec-Abschnitt zeigt, ohne ihn
wiederzugeben, steht unten ausdrücklich **„aus dem Prompt abgeleitet"** und
eine Annahme. Diese Stellen sind vor dem Bau zu bestätigen oder durch die
Spec zu ersetzen:

| Spec-Verweis | im Prompt enthalten? | Umgang hier |
|---|---|---|
| Spec 1 §7 (fünf Seltenheiten) | ja, Namen + `maxStacks`-Regel | übernommen |
| Spec 1 §8 / §18 (Einstufungsregeln, Fortschrittsbogen) | ja, Phase-3-Text | zu prüfbaren Regeln R1–R6 verschärft |
| Spec 1 §10/§11 (Synergie-Tags) | nein | wird **nicht** gebaut (Festlegung 1), Konzept fehlt für `MEMORY-TAGS.md` |
| Spec 1 §12 (`requires`) | ja, „nur echte Abhängigkeiten" | übernommen |
| Spec 1 §14/§17 (Kategorien) | ja, Werteliste | übernommen |
| Spec 1 §15 (Angebotslogik) | teilweise (Schritt 8 entfällt, Schritt 10) | Schritte 1–7/9 aus dem Bestandscode abgeleitet |
| Spec 1 §3.1 (Kernkarte muss zur Klasse passen) | nur als Satz | als Mechanismus gebaut, s. Phase 3a |
| Spec 2 §14 (Geisterbombe) | ja, per Festlegung 10 überschrieben | Festlegung 10 gilt |
| Spec 2 §16 (Nekromanten-Pool) | ja, 16 Kartennamen | übernommen |
| Spec 2 §17 (drei Archetypen) | ja, Namen | übernommen |
| Spec 2 §20 (17 Kernregeln) | **nein** | aus Festlegung 9 + Phase 4/5 zu 17 Regeln rekonstruiert, s. Phase 4 |

**Für `docs/MEMORY-TAGS.md` (Festlegung 6) fehlt der Wortlaut des
Synergie-Tag-Konzepts aus Spec 1 §10/§11.** Alles andere (Karte→Tag für alle
246 Karten, Tag-Verteilung, gelöschte Tag-Regel, alte Transformations-
Verknüpfung) lässt sich per Skript aus dem Repo erzeugen. Der Konzepttext
bekommt einen leeren, klar markierten Platzhalter, bis die Spec vorliegt.

---

## Ist-Abgleich vor dem Bau (gemessen, nicht geschätzt)

Der Prompt trifft mehrere Annahmen über den Bestand, die so nicht stimmen.
Alle Zahlen unten sind aus `data/upgrades.json` und dem Quellcode gezogen.

### 1. Die Topf-Größen weichen vom Prompt ab

Der Prompt sagt: „jeder 12er-Topf (6 Element-, 10 Signaturtöpfe) → auf 15
Karten erweitert". **Nur 4 der 10 Signaturtöpfe haben 12 Karten**, die anderen
6 haben 6:

| Topf | Karten | heute C/R/L |
|---|---|---|
| Kernpool | 30 | 10/10/10 |
| 6 Element-Töpfe (`physical`…`lightning`) | je 12 | 4/4/4 |
| 4 Mechanik-Signaturtöpfe (`c_ricochet`, `c_scrap`, `c_necro`, `c_engineer`) | je 12 | 4/4/4 |
| 6 Element-Signaturtöpfe (`player`, `c_blast`, `c_frost`, `c_tesla`, `c_toxic`, `c_flame`) | je **6** | 2/2/2 |
| Altkarten (13 Alt-Tags, eigene `cfg.js`-Zweige) | 60 | — |
| **Summe** | **246** | 79/96/71 |

Die Zielgrößen unten berücksichtigen das. Blindes „alles auf 15" hieße für
die sechs kleinen Signaturtöpfe **+54 neue Karten allein dort**.

### 2. 18 reine Zahlenkarten stehen heute auf `legendary`

Genau der Fall, den Phase 3 verbietet („eine reine Zahlenkarte darf nie über
`rare` hinaus"). Gemessen über die Effektfläche (`core`-Schlüssel
ausschließlich aus `damageAdd`/`hpAdd`/`reloadMult`/`speedMult`/`magAdd`/
`critAdd`/`bulletSpeedMult`/`ricochetAdd`/`mineAdd`/`scrapAdd`/`damageMult`):

`core_damage_l`, `core_reload_l`, `core_speed_l`, `core_hp_l`, `core_mag_l`,
`core_ric_l`, `core_crit_l`, `core_scrap_l`, `core_mine_l`, `phys_railgun`,
`phys_arsenal`, `sig_std_alleskoenner`, `sig_std_gardist`, `sig_ric_kanonade`,
`sig_scrap_mogul`, `sig_scrap_juggernaut`, `sig_necro_seelenfresser`,
`sig_eng_chefingenieur`.

Insgesamt sind **76 der 186 `core`-Karten reine Zahlenkarten**. Das ist die
messbare Größe der inhaltlichen Arbeit in Phase 3 — und der Grund, warum
Phase 3 kein Umetikettieren sein darf.

### 3. `sig_std_alleskoenner` verletzt Festlegung 7 schon heute

`rarity: legendary`, `maxStacks: 2`. Einzige Karte mit diesem Widerspruch;
wird in Phase 2 mit der `maxStacks`-Regel mitgezogen.

### 4. Der Tag `gadget` ist tragend, nicht nur Beschriftung

`run.js:1113` — `if (offer.tag === 'gadget') run.equippedGadget = offer.id;`
**Ohne Ersatz verliert das Spiel den kompletten Gadget-Wechsel.** Kein neues
Feld nötig: die fünf Gadget-ids sind genau die Einträge in
`data/secondaries.json` mit `category: "gadget"` → Prüfung wird
`run.data.secondaries[offer.id]?.category === 'gadget'`. Datengetrieben, eine
Quelle.

### 5. `EXCLUDED_TAGS` deckt zwei verschiedene Fälle ab

`elite` (nie im Normalangebot, nur über die Elite-Belohnung) und `weapon`
(pauschale Sperre mit `WEAPON_ALLOWLIST` für `doppelrohr`/`flak`). Nach
Festlegung 4 bleiben beide Waffenkarten normal ziehbar — **die
`weapon`-Sperre samt Allowlist entfällt also ersatzlos**, es gibt nur diese
zwei Waffenkarten. `offerable: false` wird nur für die drei Elite-Karten
gebraucht.

### 6. `tagCounts` steht im Speicherstand

`runSnapshot()` (`run.js:266`) schreibt es, `resume` (`run.js:706`) liest es.
Nach Festlegung 5 zählt der Transformations-Fortschritt über
`transformations.cards[]` gegen `run.upgrades` — **das steht ohnehin im
Snapshot**. `tagCounts` fällt also ersatzlos weg, und das Fortsetzen wird
dabei robuster (der Fortschritt wird neu berechnet statt mitgeschleppt). Alte
Speicherstände laden weiter, das Feld wird nur ignoriert.

### 7. Telemetrie schreibt den Tag mit

`telemetry.js:246` — `` `${c.id}[${c.tag}]` ``. Der Wechsel auf `category`
ändert das gespeicherte Format → **`SCHEMA_VERSION` 2 → 3** (die Datei führt
die Version bereits, alte Runs bleiben lesbar getrennt).

### 8. `weightedPick` schluckt eine fehlende Seltenheit still

`weights[d.rarity] || 1` — trägt `balance.rarity` eine neue Stufe nicht,
bekommt sie stillschweigend Gewicht 1 (bei 46/26/15/9/4 also ~1,5 %). Genau
ein stiller Blindgänger. Phase 2 bekommt dafür einen Strukturtest.

Die Normierung selbst (`weight[rarity] / Σ ElementGewichte dieser Stufe`) ist
**stufenzahl-unabhängig** und funktioniert mit fünf Stufen unverändert. Läuft
eine Stufe leer (alle `unique` gezogen), fehlt sie schlicht in der Liste, ihr
Gewicht wird nicht verteilt und die übrigen skalieren proportional hoch — das
ist richtig und braucht keinen Sonderfall.

### 9. `c_necro`s zwölf Signaturkarten werden in Phase 6 ohnehin ersetzt

Festlegung 12. **Phase 3 darf diesen Topf deshalb nicht mitbauen** — das wäre
verworfene Arbeit. Phase 3d lässt `c_necro` aus, Phase 6 baut ihn direkt in
der Zielform.

### 10. Geister liegen bewusst nicht in `state.tanks`

`state.ghosts` ist ein eigenes Array (`state.js:301`). Das erfüllt heute
„nicht tötbar, blockieren nichts" **durch Konstruktion**, weil die
Treffer-Schleife nur über `state.tanks` läuft. Spec 2 verlangt tötbare
Geister → sie brauchen eine **eigene Trefferprüfung**, dürfen aber im eigenen
Array bleiben. Präzedenzfall im Projekt: `state.laserWalls` (Phase 15) liegt
aus genau demselben Grund neben `state.walls` statt darin.

### 11. Die Spawn-Würfe dürfen den RNG-Strom nicht verschieben

`state.rng` ist der Seed-Strom; die Suite prüft 5 Seeds über 16 Räume auf
identischen Verlauf. Ein `state.rng()`-Aufruf in `killTank()` bei **jedem**
Gegnertod würde jede Klasse betreffen und alle Seeds verschieben. Muster ist
`tryRevive()` (`state.js:544`): es kehrt **vor** dem `state.rng()`-Aufruf
zurück, wenn das Passiv fehlt. Der Geister-Wurf macht es genauso.

### 12. Aktuelle `ghost`-Werte in `balance.json`

`duration: 3`, `killBonus: 1`, `maxActive: 4`. Spec 2 kennt weder Zeitlimit
noch Kill-Bonus → beide Felder entfallen, `maxActive` wird 3.

---

## Festgelegte Entscheidungen

| Thema | Entscheidung | Quelle |
|---|---|---|
| Tags | ersatzlos gelöscht, inkl. `tagCounts`/`avoidTags`/`EXCLUDED_TAGS`/`includeTag`/`WEAPON_ALLOWLIST`/`ignoreTagRule` | Festlegung 1 |
| Synergie-Tags | werden **nicht** gebaut | Festlegung 1 |
| Ersatz | genau eine `category` je Karte, 12 erlaubte Werte | Festlegung 2 |
| Angebotsregel | drei **verschiedene Karten**, keine Kategorie-Vielfalt | Festlegung 3 |
| Elite-Karten | `category: "elite"` + `offerable: false`, Ziehung über `includeCategory` | Festlegung 4 |
| `doppelrohr`/`flak` | normal ziehbar, Waffensperre entfällt | Festlegung 4 |
| Transformationen | `cards: [ids]` statt `tag`, Schwelle bleibt 3 Stufen | Festlegung 5 |
| Seltenheiten | `common`/`rare`/`epic`/`unique`/`legendary` | Festlegung 7 |
| `unique`/`legendary` | immer `maxStacks: 1` | Festlegung 7 |
| Pool | inhaltlich neu gebaut, nicht umetikettiert | Festlegung 8 |
| Geisterpanzer | eigener Unit-Typ, feste Basiswerte, keine Stat-Übernahme | Festlegung 9 |
| Geisterlimit | 3, **ohne** Verdrängung, kein Zeitlimit | Festlegung 9 |
| Geisterbombe | nur bei `activeGhosts === 0` auslösbar | Festlegung 10 |
| `ghost_crew` | Karte + `grantGhostCrew`/`ghostDurationBonus` ausgebaut | Festlegung 11 |
| `c_necro.reviveChance` | entfällt, Wiedergeburt nur noch bei Geistern | Festlegung 12 |
| Geister-Spawn | 50 % bei Nekromanten-Kill, 33 % bei Geister-Kill, über `state.rng` | Festlegung 9 |

---

## Die drei offenen Punkte — mit Empfehlung

### O1 — Zielen Gegner auf Geister?

**Empfehlung: Gegnergeschosse treffen Geister, die KI zielt weiter nur auf
den Spieler.** (Deckt sich mit der Empfehlung im Auftrag.)

Zwei zusätzliche Gründe aus dem Code:

- `ai_drives.js` und `ai_turrets.js` zielen **strukturell** fest auf
  `state.player` (auch `bossai.js`). Ein zweites Zielobjekt zöge vier Dateien
  und die Rollen-/Deckungs-KI (Phase 8/16) mit — und die 40-Seed-Gewinnbarkeit
  müsste neu vermessen werden. Das ist ein eigener Umbau, kein Nebeneffekt.
- Ein aggro-ziehender Geist entwertet das Ausweichen und damit die
  Kernmechanik. Ein Geist, der ungezielt Treffer abbekommt, ist ein
  Zeitgewinn — keine Unverwundbarkeit.

**Folge, die mitentschieden werden muss:** ein Geist stirbt dann nur an
Streuschaden und Explosionen. Das ist beabsichtigt — Geisterverlust wird zu
einem Positionsproblem („nicht in die Schusslinie stellen"), nicht zu einem
Zielproblem der KI.

### O2 — Blockieren Geister Geschosse und Bewegung?

**Empfehlung: nein, weder noch — wie bisher.**

Der wichtige Teilaspekt, der leicht durchrutscht: Wenn ein Gegnergeschoss
einen Geist trifft und dabei **stirbt**, ist der Geist faktisch ein
mitlaufender Schild, egal was in der Spec steht. Deshalb:

> Ein Gegnergeschoss, das einen Geist trifft, richtet Schaden an und
> **fliegt weiter** (`b.dead` bleibt `false`).

Damit ein durchfliegendes Geschoss nicht in jedem Frame erneut Schaden macht,
merkt sich die Kugel die schon getroffenen Geister (`b.hitGhosts`, Set von
Geist-ids) — ein Treffer je Kugel je Geist.

Bewegung: Geister laufen weiter ohne `resolveTankBlocking` (unverändert seit
Phase 7).

### O3 — Wie werden Geisterstand und Bombensperre angezeigt?

**Empfehlung:**

- **HUD-Munitionszeile** (`hud.js:37`): beim Nekromanten ersetzt
  `👻 2/3` die `Minen n/m`-Anzeige — dieselbe Stelle, dieselbe Lesart
  („aktiv/Maximum"), kein neues Element.
- **Bombensperre**: derselbe Mechanismus wie die bestehende
  Gadget-Abklingzeit (`hud.js:41–44`). Bei `activeGhosts > 0` steht dort
  `BESCHWÖREN 🔒` statt der Restsekunden; der Touch-Knopf bekommt die
  vorhandene `.slot-empty`-Ausgrauung aus P4 und die Beschriftung
  `BESCHWÖREN` über `setSecondaryLabel()`.
- **Fehlbedienung meldet sich zurück**: ein Druck bei ≥ 1 Geist spielt
  `empty` + gedimmten Blitz — genau die Regel aus `PLAN-INPUT.md` P1
  („gesperrter Schuss meldet sich zurück") und P6 (Haken-Fehlschuss). Ohne
  das wirkt der tote Knopf wie ein Defekt.
- **Sichtbares Gegenstück zur Beschwörung**: kurzer grüner Aufblitz
  (`state.flashes`) + eigener Ton. Auflage aus Phase 7b: „jede Information
  per Ton braucht ein sichtbares Gegenstück".

### O4 — neu: Was ist die „Bombenladung", die die Beschwörung verbraucht?

Nicht im Auftrag gestellt, fällt aber beim Bauen sofort an. Festlegung 10
sagt „verbraucht wie bisher eine Bombenladung aus dem Vorrat". Der
Bomben-„Vorrat" ist heute aber kein Zähler, sondern die Zahl der **gleichzeitig
lebenden eigenen Minen** (`layMine`: `own.length >= tank.cfg.mines`). Ein Geist
ist keine Mine — die Prüfung liefe leer, die Kosten wären wirkungslos.

**Empfehlung:** Die Beschwörung hat **keine** Vorratsbuchhaltung; die
einzige Bedingung ist `activeGhosts === 0` (Festlegung 10 deckt den Fall
ohnehin strenger ab als jeder Vorrat es könnte). Dafür verliert der Nekromant
die minenbezogenen Kernkarten — und **genau das gibt der Regel aus Spec 1
§3.1 ihren ersten echten Anwendungsfall**: `core_mine_c/r/l` bekommen
`requiresMechanic: "mines"`, und der Nekromant bekommt sie nicht mehr
angeboten (heute wären sie für ihn tote Karten im Pool).

---

## Phasenübersicht

| Phase | Inhalt | Sitzung |
|---|---|---|
| 1 | Tags raus, Kategorien rein | 1 |
| 2 | Fünf Seltenheiten (technisch) | 2 |
| 3a | Einstufungsregeln + Kernpool + Altkarten | 3 |
| 3b | 6 Element-Töpfe auf 15 | 4 |
| 3c | 6 Element-Signaturtöpfe auf 12 | 5 |
| 3d | 3 Mechanik-Signaturtöpfe auf 15 (ohne `c_necro`) | 6 |
| 4 | Geisterpanzer als eigene Einheit | 7 |
| 5 | Klassenidentität + Geisterbombe | 8 |
| 6 | Signaturpool Nekromant (16 Karten) | 9 |

**Warum Phase 3 geteilt ist:** die Zielgrößen unten bedeuten **66 neu zu
schreibende Karten** plus Neueinstufung aller 246 vorhandenen. Davon sind 76
reine Zahlenkarten, deren `epic`+-Einstufungen nach Festlegung 8 **echte neue
Mechanik** brauchen, also neue `core`-Schlüssel und Code in `cfg.js`/
`state.js`. Das ist in einer Sitzung weder baubar noch mit Gegenproben
absicherbar. Die Teilung folgt der Projektregel „eine Phase pro Sitzung".

---

## Phase 1 — Tags raus, Kategorien rein

**Ziel:** `tag` verschwindet vollständig aus `src/**` und `data/**`. Das
Spielverhalten ändert sich an genau **einer** Stelle bewusst: die
Tag-Vielfaltsregel im Angebot fällt weg, ein Angebot darf jetzt drei Karten
derselben Kategorie zeigen (Festlegung 3).

**Dateien:** `data/upgrades.json`, `data/transformations.json`,
`src/game/upgradepool.js`, `src/game/run.js`, `src/ui/upgradescreen.js`,
`src/core/telemetry.js`, `src/main.js`, `docs/MEMORY-TAGS.md` (neu),
`tests/regression.mjs`, `sw.js`

**Datenfelder:**

- `upgrades.json`: jede Karte `tag` → `category` (genau ein Wert aus
  `stat`, `offensive`, `defensive`, `utility`, `mechanic`, `build`, `elite`,
  `swarm`, `resurrection`, `control`, `economy`, `class`).
- `upgrades.json`: neues optionales `offerable: false` — nur die drei
  Elite-Karten.
- `upgrades.json → fallback`: `tag` → `category: "stat"`.
- `transformations.json`: je Eintrag `tag` → `cards: [ids]`.

**Kategorie-Zuordnung** (Regel, nicht 246 Einzelurteile):

| alte Tags | neue `category` |
|---|---|
| `stat`, `damage`, `reload`, `speed`, `magazine`, `ricochet`, `crit` | `stat` |
| `health`, `defense` | `defensive` |
| `scavenge`, `resource` | `economy` |
| `physical`, `explosive`, `fire`, `weapon`, `reactive`, `mines` | `offensive` |
| `frost`, `lightning`, `poison`, `control` | `control` |
| `dodge`, `mobility`, `information`, `terrain` | `utility` |
| `scaling`, `synergy` | `build` |
| `gadget` | `mechanic` |
| `elite` | `elite` |
| `signature` | `class` |

`swarm` und `resurrection` bleiben in Phase 1 unbesetzt — sie sind für den
Nekromanten-Pool aus Phase 6 vorgesehen (Geisterzahl bzw. Wiedergeburt). Der
Strukturtest prüft nur, dass jede benutzte Kategorie **erlaubt** ist, nicht
dass jede erlaubte benutzt wird.

**Umbau im Code:**

1. `upgradepool.js`: `EXCLUDED_TAGS`, `WEAPON_ALLOWLIST` gelöscht.
   `buildCandidates` filtert stattdessen `if (!includeCategory && def.offerable === false) continue;`
   und `if (includeCategory && def.category !== includeCategory) continue;`.
2. `upgradepool.js: rollOffers`: `usedTags`/`ignoreTagRule` gelöscht. Die
   „keine zwei gleichen Karten"-Regel steckt bereits in
   `pool = pool.filter(d => d.id !== pick.id)` und bleibt.
3. `upgradepool.js: drawOne(data, opts, avoidIds)` — Parameter `avoidTags`
   entfällt.
4. `upgradepool.js: makeOffer/fallbackOffer`: `tag` → `category`.
5. `run.js: rollReward`: `includeTag: 'elite'` → `includeCategory: 'elite'`,
   `ignoreTagRule` entfällt, `avoidTags` an allen drei Stellen entfernt
   (`rollReward`, `banOffer`, `buyFourthCard`).
6. `run.js: applyUpgradeChoice`: Gadget-Erkennung über
   `run.data.secondaries[offer.id]?.category === 'gadget'` (Ist-Abgleich 4).
7. `run.js`: `tagCounts` aus `createRun`, `runSnapshot` und `resume` entfernt.
   `unlockTransformation(run)` zählt jetzt über die Kartenliste:
   `sum(tf.cards.map(id => run.upgrades[id] || 0)) >= threshold`, und wird
   nach **jeder** Kartenwahl einmal für alle Transformationen aufgerufen.
8. `upgradescreen.js`: `dataset.tag` → `dataset.category`, `cardmeta` zeigt
   die Kategorie, Fortschrittsanzeige zählt über `tf.cards`.
9. `telemetry.js`: `[${c.tag}]` → `[${c.category}]`, `SCHEMA_VERSION` 2 → 3.
10. `main.js`: `cardOf` und der `chosen`-Aufbau (`main.js:599`, `:719`)
    tragen `category` statt `tag`.
11. `sw.js`: Cache-Version bumpen, `docs/MEMORY-TAGS.md` **nicht** in
    `ASSETS` (reine Dokumentation, kein Spiel-Asset), `GAME_VERSION` in
    `telemetry.js` mitziehen.

**Transformations-Kartenlisten** (aus den heutigen Tags, Stacks in Klammern —
Schwelle 3 muss erreichbar bleiben):

| Transformation | `cards` | Stacks |
|---|---|---|
| Pionier | `wolframkern`(1), `sappeur`(2), `steinbruch`(2) | 5 |
| Kavallerie | `kettenantrieb`(3), `nachbrenner`(1), `dash`(1), `raketenantrieb`(1), `turbo`(1) | 7 |
| Taktiker | `radar`(1), `ballistikrechner`(1), `nachtsicht`(1), `minenspuerer`(1), `gefahrensinn`(1) | 5 |
| Bollwerk | `nachladeschild`(1), `schild`(1), `emergency_shield`(3), `konterschild`(1) | 6 |
| Saboteur | `krallenfalle`(1), `abprallschock`(2), `erschuetterungsdash`(1), `fernzuender`(1), `schockwelle`(1), `annaeherungsmine`(1), `klebemine`(1) | 8 |

**`docs/MEMORY-TAGS.md`** (Festlegung 6) — per Skript erzeugt, von keinem Code
gelesen: vollständige Tabelle Karte → alter `tag` (246 Zeilen), die
Tag-Verteilung (30 Tags mit Kartenzahl), der gelöschte Code der Tag-Regel im
Wortlaut, die alte Transformations-Verknüpfung über `tag`, und ein klar
markierter **Platzhalter** für das Synergie-Tag-Konzept aus Spec 1 §10/§11,
solange die Spec fehlt.

**Abnahme:**

- Kein Vorkommen von `tag`/`tags`/`Tag` in `src/**` und `data/**`
  (`docs/**` ausgenommen).
- Jede der 246 Karten trägt genau eine `category` aus der erlaubten Liste.
- Alle fünf Transformationen weiterhin freischaltbar (Bestandstest ~Z. 149
  auf `cards` umgestellt).
- Elite-Belohnung zieht weiterhin ausschließlich die drei Elite-Karten.
- Bestandstest „jede Karte ziehbar" (~Z. 272) grün **ohne** Tag-Ausnahmen —
  `doppelrohr`/`flak` gelten jetzt als normale Karten, die drei Elite-Karten
  über `offerable: false`.
- Ein Angebot enthält nie zweimal dieselbe Karte.
- Gadget-Wechsel funktioniert weiter (Regressionstest, s. u.).
- `node tests/regression.mjs` grün.

**Tests (jeder mit Gegenprobe):**

| Test | Gegenprobe |
|---|---|
| Struktur: jede Karte hat genau eine erlaubte `category` | eine Karte auf `category: "quatsch"` → rot |
| Kein `tag` mehr in `src/**`/`data/**` (Quelltext-Scan wie beim Sound-Namen-Test) | ein `def.tag` wieder einbauen → rot |
| Angebot enthält nie zweimal dieselbe id (1000 Züge) | `pool.filter(id !== pick.id)` entfernen → rot |
| Angebot **darf** zwei gleiche Kategorien zeigen (kommt in 1000 Zügen vor) | Vielfaltsregel wieder einbauen → rot (bewacht, dass sie nicht zurückkehrt) |
| Elite-Belohnung liefert nur `category: elite` | `offerable`-Filter entfernen → Elite-Karten im Normalpool → rot |
| Alle 5 Transformationen über `cards` erreichbar (Summe Stacks ≥ 3) | eine `cards`-Liste auf 2 Stacks kürzen → rot |
| Gadgetkarte setzt `run.equippedGadget` | `secondaries`-Prüfung entfernen → rot |
| Fortsetzen ohne `tagCounts` stellt den Transformations-Fortschritt korrekt her | Fortschritt aus `run.upgrades` nicht neu berechnen → rot |

**Risiken:**

- **Gadget-Wechsel** (Ist-Abgleich 4) — der eine Ort, an dem ein Tag echte
  Mechanik trägt. Ohne den Ersatz still kaputt: der Knopf tut nichts, kein
  Fehler. Deshalb ein eigener Wirkungstest.
- **Angebotsvielfalt sinkt spürbar.** Ohne Tag-Regel kann ein Angebot dreimal
  „+Schaden" zeigen. Das ist spec-konform und akzeptiert (Festlegung 3),
  fühlt sich aber bis Phase 3 schlechter an als heute, weil der Pool noch aus
  vielen fast gleichen Zahlenkarten besteht. **Erwartete Zwischenlage, in
  Phase 3 aufgelöst** — dasselbe Muster wie Phase 2/3 des LP-Umbaus.
- Telemetrie-Schemawechsel: alte `localStorage.runs` mit `schemaVersion: 2`
  müssen weiter lesbar bleiben (nur die Kartenlabels ändern sich).

---

## Phase 2 — Fünf Seltenheiten (technisch)

**Ziel:** die Stufen `epic` und `unique` existieren technisch vollständig —
Gewichte, Raumsperren, Anzeige, Normierung. Inhaltlich sind sie noch schwach
besetzt; das ist Phase 3.

**Dateien:** `data/balance.json`, `data/upgrades.json` (nur `maxStacks`-Fix),
`src/game/upgradepool.js`, `src/game/run.js`, `src/ui/upgradescreen.js`,
`style.css`, `tests/regression.mjs`, `sw.js`

**Datenfelder:**

```jsonc
"rarity":        { "common": 46, "rare": 26, "epic": 15, "unique": 9, "legendary": 4 },
"rarityMinRoom": { "epic": 3, "unique": 5, "legendary": 7 }
```

`balance.legendary.minRoom` (heute 5) wandert ersatzlos in `rarityMinRoom`.

**Begründung der Gewichte** (Vorschlag aus dem Auftrag, hier gerechnet):
Ein Run bietet über 16 Räume grob 15–20 Karten an (Raumbelohnung + Shop +
Elite). Bei 46/26/15/9/4 sind das je Run ~2,4 `unique`+`legendary`-Angebote —
genug, dass jeder Run eine Spezialisierung sieht, wenig genug, dass sie ein
Ereignis bleibt. Die Summe ist bewusst 100, damit die Zahlen als Prozent
lesbar sind; `weightedPick` normiert ohnehin.

**Raumsperren 3/5/7:** `epic` ab Raum 3 (nach den beiden erzwungenen
Kampfräumen), `unique` ab 5 (heutiger Legendary-Gate-Wert), `legendary` ab 7
(knapp vor der Hälfte des Runs). Schatz-/Verflucht-Räume umgehen die Sperre
weiterhin über `bypassRoomGate`.

**Umbau im Code:**

1. `upgradepool.js: buildCandidates` — der Sonderfall
   `def.rarity === 'legendary' && roomIndex < legMinRoom` wird generisch:
   `roomIndex < (balance.rarityMinRoom?.[def.rarity] ?? 0)`.
2. `onlyRarity` akzeptiert zusätzlich ein **Array**. Schatz-/Verflucht-Räume
   ziehen `['unique', 'legendary']` statt nur `legendary`.
   **Begründung:** mit fünf Stufen schrumpft der reine Legendary-Pool je
   Klasse auf wenige Karten; ohne diese Erweiterung zeigt jede Schatzkammer
   im selben Run dieselben zwei bis drei Karten. `unique` ist nach Spec 1 §7
   ebenfalls `maxStacks: 1` und build-definierend, passt also zum
   Schatzkammer-Versprechen.
3. `upgradescreen.js: RARITY` bekommt fünf Einträge (Gewöhnlich, Selten,
   Episch, Einzigartig, Legendär).
4. `style.css`: je fünf Regeln für `.cards .card[data-rarity]` und
   `.shopcards .shopcard[data-rarity]` (heute je drei).
5. `upgrades.json`: `sig_std_alleskoenner.maxStacks` 2 → 1 (Ist-Abgleich 3).
   Sonst keine inhaltliche Änderung in dieser Phase.

**Abnahme:**

- Gezogene Verteilung über **60 000 Züge** liegt je Stufe innerhalb
  **2 Prozentpunkten** der Konfiguration — auch an einer absichtlich
  **ungleich** großen Stufenliste.
- Raumsperren greifen: in Raum 2 keine `epic`, in Raum 4 keine `unique`, in
  Raum 6 keine `legendary`; ab 3/5/7 jeweils vorhanden.
- Keine Karte mit `rarity ∈ {unique, legendary}` hat `maxStacks > 1`.
- `unique`/`legendary` erscheinen nie zweimal im selben Run (Folge aus
  `maxStacks: 1` + `chosen`-Filter — separat geprüft, nicht nur behauptet).
- Jede in `upgrades.json` vorkommende `rarity` hat ein Gewicht in
  `balance.json`.

**Tests (jeder mit Gegenprobe):**

| Test | Gegenprobe |
|---|---|
| 60 000 Züge, je Stufe ≤ 2 pp Abweichung, an ungleich großen Stufen (z. B. 40/8/8/2/2 Karten) | alte Pro-Karte-Summierung wiederherstellen → rot (das ist der `PLAN-UPGRADES`-Bug) |
| Raumsperren je Stufe (2/4/6 leer, 3/5/7 besetzt) | eine Sperre auf 0 setzen → rot |
| `unique`/`legendary` ⇒ `maxStacks === 1` (Struktur) | `sig_std_alleskoenner` zurück auf 2 → rot |
| Eine gezogene `unique` erscheint im selben Run nicht erneut (300 Folgezüge) | `maxStacks`-Filter in `buildCandidates` entfernen → rot |
| Jede benutzte `rarity` hat ein Gewicht in `balance.json` | `epic` aus `balance.rarity` löschen → rot (heute schluckt `|| 1` das still) |
| Schatzkammer zieht `unique` **und** `legendary` | Array-Unterstützung in `onlyRarity` entfernen → rot |

**Hinweis zur Phase-28-Abnahme (Bestandstest ~Z. 4870):** die Zusicherung
„jede Klasse hat in Raum 10 in jeder Stufe eine ziehbare Karte" wird in dieser
Phase **nur auf die tatsächlich besetzten Stufen** geprüft, weil `epic` und
`unique` erst in Phase 3 gefüllt werden. Der Test bekommt dafür eine
**namentliche Liste der noch nicht scharfen Stufen** plus einen Kommentar, der
Phase 3d als Fälligkeitstermin nennt — eine stille „prüfe halt nur, was da
ist"-Schleife wäre genau der Blindgänger, vor dem `CLAUDE.md` warnt.

**Risiken:**

- Die zwei neuen Stufen sind in Phase 2 dünn besetzt → das Angebot wirkt
  vorübergehend legendärlastig, weil die 71 heutigen `legendary`-Karten noch
  alle dort stehen. Erwartete Zwischenlage.
- `onlyRarity` als Array ist ein Vertragswechsel für drei Aufrufstellen —
  Strukturtest, dass ein String weiterhin funktioniert (Rückwärtskompatibilität
  für Bestandstests).

---

## Phase 3 — Pool-Neubau (vier Sitzungen: 3a–3d)

### Zielgrößen je Topf

| Topf | heute | Soll | C/R/E/U/L | neu zu schreiben |
|---|---|---|---|---|
| Kernpool | 30 | 30 | 6/6/6/6/6 | 0 (umgebaut) |
| 6 Element-Töpfe | je 12 | je 15 | 4/4/3/2/2 | +18 |
| 6 Element-Signaturtöpfe | je 6 | je **12** | 4/3/2/2/1 | +36 |
| 3 Mechanik-Signaturtöpfe (ohne `c_necro`) | je 12 | je 15 | 4/4/3/2/2 | +9 |
| `c_necro`-Signatur | 12 | **16** | 4/4/3/3/2 | Phase 6 (+4) |
| Altkarten | 60 | 60 | frei | 0 (nur neu eingestuft) |
| **Summe** | **246** | **313** | | **+67** |

**Begründung der Abweichungen vom Ausgangsvorschlag:**

- **Element-Signaturtöpfe 12 statt 15.** Diese sechs Klassen ziehen bereits
  einen vollen 15-Karten-Element-Topf als Identität; ein zweiter 15er-Topf
  gäbe ihnen 30 klassenprägende Karten gegenüber 15 bei den Mechanikklassen,
  die keinen eigenen Element-Topf haben (ihr `damageType` ist `physical`, den
  jede Klasse ziehen kann). 12 stellt beide Seiten auf ~27 klassenprägende
  Karten und spart 18 neu zu schreibende Karten.
- **`c_necro` 16 statt 15.** Spec 2 §16 nennt namentlich **16** Karten
  (im Auftrag aufgezählt). Die Liste ist maßgeblich.
- **Kernpool bleibt bei 30.** 6/6/6/6/6 geht exakt auf; die zehn Kategorien
  behalten je drei Karten, verteilt auf fünf statt drei Stufen (s. 3a).

### Die Einstufungsregeln als prüfbare Invarianten

Damit „neu eingestuft" nicht wieder zu „umetikettiert" wird, bekommt Phase 3a
sechs Regeln, die ein Test **maschinell** durchsetzt. Das ist die
Gegenprobe-Pflicht aus `CLAUDE.md`, auf die Datenlage angewandt:

| Regel | Aussage |
|---|---|
| **R1** | Eine Karte, deren Effektfläche ausschließlich aus Zahlenschlüsseln besteht, hat `rarity ∈ {common, rare}`. |
| **R2** | `rarity ∈ {unique, legendary}` ⇒ `maxStacks === 1`. |
| **R3** | `rarity ∈ {epic, unique, legendary}` ⇒ mindestens ein **Mechanik**-Schlüssel in der Effektfläche. |
| **R4** | `rarity === legendary` ⇒ mindestens **zwei verschiedene** Mechanik-Schlüssel **oder** ein Mechanik-Schlüssel + erfülltes `requires` („Endform verbindet mehrere Mechaniken", Spec 1 §8). |
| **R5** | Jede benutzte `rarity` hat ein Gewicht in `balance.rarity` (aus Phase 2). |
| **R6** | Jede Karte hat genau eine erlaubte `category` (aus Phase 1). |

**Zahlenschlüssel** (`STAT_KEYS`): `damageAdd`, `damageMult`, `hpAdd`,
`reloadMult`, `speedMult`, `magAdd`, `critAdd`, `bulletSpeedMult`,
`ricochetAdd`, `mineAdd`, `scrapAdd`.
Alles andere ist ein **Mechanik-Schlüssel**. `magazineFixed` zählt
ausdrücklich als Mechanik (es ersetzt die Magazinregel, statt eine Zahl zu
erhöhen) — deshalb darf `phys_railgun` `epic` sein.

Altkarten ohne `core` (eigener `cfg.js`-Zweig) gelten pauschal als
mechanikführend; für sie greift R1 nicht, R2/R4 schon.

---

### Phase 3a — Regelwerk, Kernpool, Altkarten

**Ziel:** die sechs Regeln stehen und werden erzwungen; der Kernpool ist auf
6/6/6/6/6 umgebaut; die 60 Altkarten sind neu eingestuft. Danach ist jede
weitere Topf-Sitzung reine Inhaltsarbeit gegen ein festes Regelwerk.

**Dateien:** `data/upgrades.json`, `src/game/cfg.js` (neue `core`-Schlüssel),
`src/game/upgradepool.js` (Klassenfilter), `tests/regression.mjs`

**Neuer Mechanismus — Klassenfilter für Kernkarten (Spec 1 §3.1):**
neues optionales Feld `requiresMechanic: "<cfg-Schlüssel>"`. `buildCandidates`
verwirft die Karte, wenn die aufgelöste Klassen-`cfg` diesen Schlüssel nicht
positiv führt. Erster echter Nutzer sind die drei Minen-Kernkarten (O4) —
für den Nekromanten ab Phase 5 tote Karten. Zusätzlich mit einer
**synthetischen** Karte getestet (Muster: der `maxHp = 42`-Test aus
LP-Phase 1), damit der Filter nicht nur „zufällig richtig" ist.

**Kernpool — Soll (30 Karten, 6/6/6/6/6):**

Die zehn Kategorien behalten je drei Karten. Heute ist jede Kategorie
`common/rare/legendary`; künftig verteilen sich die 30 Karten so, dass jede
Stufe sechs bekommt und **keine reine Zahlenkarte über `rare` steht** (R1).
Konkret: die zehn heutigen `*_c` bleiben `common` (aber nur sechs davon —
vier rutschen zusammen, s. Tabelle), die zehn `*_r` verteilen sich auf
`common`/`rare`, und die **neun reinen Zahlen-Legendaries werden
umgeschrieben** statt herabgestuft — sonst wäre der Kernpool oberhalb `rare`
leer.

| id | heute | Soll | Maßnahme |
|---|---|---|---|
| `core_damage_c` Panzerbrechend | C | **common** | bleibt |
| `core_damage_r` Wuchtgeschoss | R | **rare** | bleibt |
| `core_damage_l` Durchschlag | L | **epic** | umgeschrieben: Schaden skaliert mit der Entfernung zum Ziel (`damageRangeRamp`) |
| `core_reload_c` Schnelllader | C | **common** | bleibt |
| `core_reload_r` Doppelhänder | R | **rare** | bleibt |
| `core_reload_l` Trommelmagazin | L | **epic** | umgeschrieben: das Magazin lädt als Ganzes nach statt Kugel für Kugel (`burstReload`) |
| `core_speed_c` Laufwerk | C | **common** | bleibt |
| `core_speed_r` Rennkette | R | **rare** | bleibt |
| `core_speed_l` Düsenantrieb | L | **epic** | umgeschrieben: Tempo steigt, solange du nicht feuerst (`momentumSpeed`) |
| `core_hp_c` Panzerplatte | C | **common** | bleibt |
| `core_hp_r` Verbundpanzerung | R | **rare** | bleibt |
| `core_hp_l` Bunkerstahl | L | **unique** | umgeschrieben: LP-Verlust unter 50 % gibt dauerhaft Schadensbonus (`lastStand`) |
| `core_mag_c` Magazin | C | **common** | bleibt |
| `core_mag_r` Doppelmagazin | R | **rare** | bleibt |
| `core_mag_l` Endlosgurt | L | **epic** | umgeschrieben: getroffene Kugeln geben ihren Magazinplatz sofort frei (`magRefundOnHit`) |
| `core_ric_c` Abpraller | C | **common** | bleibt |
| `core_ric_r` Querschläger | R | **rare** | bleibt |
| `core_ric_l` Billardkugel | L | **unique** | umgeschrieben: unbegrenzte Abpraller, dafür halbes Wegbudget (`infiniteRicochet`) |
| `core_crit_c` Zielfernrohr | C | **common** | bleibt |
| `core_crit_r` Schwachstellenscanner | R | **rare** | bleibt |
| `core_crit_l` Präzisionskern | L | **unique** | umgeschrieben: jeder Krit senkt die Kritchance auf den Grundwert, verdreifacht dafür den Faktor (`critBurst`) |
| `core_scrap_c` Sammler | C | **common** | bleibt |
| `core_scrap_r` Verwerter | R | **rare** | bleibt |
| `core_scrap_l` Schrottmagnet | L | **epic** | umgeschrieben: Schrott fällt auch bei Abprall-Kills ohne Trickshot (`scrapOnBounceKill`) |
| `core_mine_c` Minenvorrat | C | **common** | bleibt, `requiresMechanic: "mines"` |
| `core_mine_r` Minengürtel | R | **rare** | bleibt, `requiresMechanic: "mines"` |
| `core_mine_l` Minenleger | L | **legendary** | umgeschrieben: Bomben zünden in Ketten und legen sich nach Ablauf einmal selbst neu (`mineChainRefill`), `requiresMechanic: "mines"` |
| `core_dodge_c` Ausweichschritt | C | **common** | bleibt (Mechanik: `dashGrant`) |
| `core_dodge_r` Seitwärtsroller | R | **rare** | bleibt |
| `core_dodge_l` Phasensprung | L | **legendary** | erweitert: Dash durchquert Wände (`dashPhase`) + Abklingzeit −50 % → zwei Mechanikschlüssel (R4) |

Stufenverteilung daraus: **common 10, rare 10, epic 5, unique 3,
legendary 2.** Das ist noch **nicht** 6/6/6/6/6.

**Ausgleich innerhalb von 3a:** vier `common`-Karten mit `maxStacks: 3` und
vier `rare` werden zu je einer stärkeren Karte zusammengeführt bzw. auf die
oberen Stufen gehoben, bis 6/6/6/6/6 steht. Die konkrete Zuordnung gehört in
die Sitzung selbst — sie hängt davon ab, welche der acht umgeschriebenen
Mechaniken sich sauber bauen lassen. **Fester Rahmen für die Sitzung:**
Zielverteilung 6/6/6/6/6, R1–R6 grün, keine Kategorie verliert ihre
`common`-Karte (sonst fehlt der Einstieg in eine Stat).

> **Offener Punkt für die Freigabe:** Sollen es im Kernpool wirklich exakt
> 6/6/6/6/6 sein? Eine ehrlichere Alternative wäre **8/8/6/4/4** — sie
> respektiert, dass Grundwert-Karten naturgemäß häufiger sind, und spart vier
> erfundene Mechaniken. Empfehlung: **8/8/6/4/4**, weil sonst sechs
> „epische" Kernkarten entstehen, deren Mechanik nur existiert, um eine Quote
> zu füllen — genau das, was Festlegung 8 verhindern will.

**Altkarten (60) — Einstufung:**

Sie tragen fast alle echte Mechanik (eigener `cfg.js`-Zweig), R1 greift also
selten. Die Arbeit ist R2/R4 und das Anheben der stärksten auf `epic`/`unique`:

- **→ `epic`** (Untermechanik umgebaut): `sprengschuss`, `powershot`,
  `doppelrohr`, `flak`, `wolframkern`, `krallenfalle`, `aasgeier`,
  `kettenblitz`, `schrapnell`, `streumine`, `fernzuender`, `berserker`,
  `uebermacht`, `konterschild`, `nachladeschild`, `deflector`, `hook`,
  `smoke`, `trap_wall`, `emp_mine`.
- **→ `unique`** (build-definierend, `maxStacks: 1`): `sprengmunition`,
  `glaskanone`, `scharfschuetze`, `streuschuss`, `kamikaze`, `schild`.
- **bleibt `legendary`** (verbindet mehrere Mechaniken, R4 erfüllt):
  `ueberladung`, `kriegsmaschine`.
- **→ `rare`/`common` herabgestuft** (reine Zahlen): `turbo` (heute
  legendary, ist +45 % Tempo → `rare`), `magazin`, `ladung`, `kettenglied`,
  `sprengkraft`, `kettenantrieb`, `abpraller`, `pluenderer`, `beutejagd`,
  `nachbrenner`, `raketenantrieb`, `emergency_shield`, `trophaee`,
  `kriegsbeute`, `dash`, `feuerleitzentrale`, `meisterschuetze`.
- **Rest bleibt** auf heutiger Stufe: `radar`, `ballistikrechner`,
  `nachtsicht`, `minenspuerer`, `gefahrensinn`, `sappeur`, `steinbruch`,
  `abprallschock`, `doppelschlag`, `erschuetterungsdash`, `annaeherungsmine`,
  `klebemine`, `schockwelle`, `blutrausch`.
- **`ghost_crew` wird in Phase 5 gelöscht** (Festlegung 11) und in 3a nicht
  mehr angefasst.

**Abnahme 3a:** R1–R6 grün über den gesamten Pool; Kernpool in der
beschlossenen Verteilung; keine Altkarte verliert ihre Wirkung (Bestandstest
6b „jede Karte löst sauber in ein cfg auf" bleibt grün); `requiresMechanic`
filtert nachweislich.

**Tests (Gegenproben):** R1 (eine Zahlenkarte auf `epic` → rot), R4 (einer
Legendary den zweiten Mechanikschlüssel nehmen → rot), `requiresMechanic` mit
synthetischer Karte (Filter entfernen → rot), Kernpool-Verteilung
(eine Karte umstufen → rot).

---

### Phase 3b — Sechs Element-Töpfe auf je 15 (4/4/3/2/2)

Je Topf bleiben die 4 `common` und 4 `rare` erhalten; die heutigen vier
`legendary` verteilen sich auf `epic`/`unique`/`legendary`, dazu je **3 neue
Karten**.

**Fortschrittsbogen je Topf** (Spec 1 §18): `common` = Wert der
Elementmechanik hoch, `rare` = Mechanik greift in eine zweite ein, `epic` =
eine Regel des Elements wird umgebaut, `unique` = eine Spielweise wird
erzwungen, `legendary` = zwei Element-Regeln verbunden.

**`physical` (15):**

| Stufe | Karten |
|---|---|
| common | `phys_ap`, `phys_scope`, `phys_pressure`, `phys_spin` (unverändert) |
| rare | `phys_execute`, `phys_coldshot`, `phys_splinter`, `phys_heavy` (unverändert) |
| epic | `phys_railgun` (Magazin 1 / ×3 Schaden — `magazineFixed` ist Mechanik), `phys_headshot`, **neu `phys_penetrator` Durchschlagskern**: Schüsse durchdringen den ersten getroffenen Gegner |
| unique | `phys_ricochetking`, **neu `phys_marksman` Meisterschütze**: kein Abpraller mehr, dafür verdoppelter Schaden und Ziellinie bis zum Ziel |
| legendary | **umgeschrieben `phys_arsenal` → Präzisionsdoktrin**: Krit-Deckel +15 % **und** jeder Krit durchschlägt (zwei Mechaniken, R4), **neu `phys_annihilator` Vernichter**: Kopfschuss + Fangschuss-Schwelle auf 50 % |

**`explosive` (15):** common/rare unverändert; `epic` = `expl_shots`
(Schüsse zünden — Regelumbau), `expl_cluster`, **neu Kettenzünder**
(Explosionen lösen benachbarte Explosionen aus); `unique` = `expl_nuke`,
**neu Abrissbirne** (Explosionen reißen Wände ein, doppelter Radius, kein
Direktschaden); `legendary` = `expl_arsenal` (umgeschrieben auf zwei
Mechaniken), `expl_clusterbomb`.

**`fire` (15):** `epic` = `fire_hellfire` (Deckel-Umbau), `fire_spread`,
**neu Feuerspur** (der eigene Weg brennt nach); `unique` = `fire_inferno`,
**neu Verbrannte Erde** (Brand breitet sich endlos aus, dafür halber
Tickschaden); `legendary` = `fire_firestorm`, `fire_pyro`.

**`frost` (15):** `epic` = `frost_deep`, `frost_shatter`, **neu Frostrüstung**
(erstarrte Gegner geben beim Splittern Schild); `unique` = `frost_blizzard`,
**neu Ewiger Winter** (Frost verfällt nicht mehr, dafür keine Erstarrung);
`legendary` = `frost_zero`, `frost_breaker`.

**`poison` (15):** `epic` = `poison_cap`, `poison_plaguecard`, **neu
Giftwolke** (getötete vergiftete Gegner hinterlassen eine Wolke); `unique` =
`poison_pandemic`, **neu Auszehrung** (Gift skaliert mit der Maximal-LP des
Ziels statt fest); `legendary` = `poison_contagion`, `poison_bomb`.

**`lightning` (15):** `epic` = `light_chain`, `light_stun`, **neu Erdung**
(Kettenglieder geben Schrott); `unique` = `light_storm`, **neu Blitzableiter**
(Kette springt nur auf **ein** Ziel, dafür mit vollem Schaden); `legendary` =
`light_super`, `light_arsenal` (umgeschrieben).

**Abnahme 3b:** je Topf 15 Karten in 4/4/3/2/2; R1–R6 grün; jede neue Karte
wirkt nachweisbar (Wirkungstest je neuer Mechanik, nicht nur Struktur); der
Element-Filter greift weiterhin (Bestandstests der Abschnitte 19–24).

---

### Phase 3c — Sechs Element-Signaturtöpfe auf je 12 (4/3/2/2/1)

Betrifft `player`, `c_blast`, `c_frost`, `c_tesla`, `c_toxic`, `c_flame`.
Heute je 6 Karten (2/2/2), Ziel 12 → **je 6 neue Karten**.

Grundmuster je Topf: die zwei heutigen `common` bleiben, +2 neue `common`;
die zwei `rare` bleiben, +1 neue `rare`; die zwei heutigen `legendary` werden
`epic`; +2 neue `unique`; +1 neue `legendary`, die zwei Klassenmechaniken
verbindet.

**`player` (Standard) ist der Sonderfall:** die Klasse hat kein Element und
kein Passiv (`tanks.json`), ihre sechs heutigen Karten sind **alle reine
Zahlenkarten** — nach R1 darf davon keine über `rare`. Der Topf braucht
deshalb ab `epic` **vier komplett neue Mechaniken**. Vorschlag im Sinne von
„die Messlatte für alles andere": `epic` = Gefechtsbereitschaft (der erste
Schuss in jedem Raum ist immer kritisch) / Doppelrolle (Dash setzt das
Nachladen zurück); `unique` = Generalist (jede dritte gewählte Karte gibt
zusätzlich +1 Stufe auf eine zufällige eigene Karte) / Ausbilder (alle
Grundwerte +15 %, keine Element-Karten mehr ziehbar); `legendary` =
Stabschef (Generalist + Gefechtsbereitschaft verbunden).

Für die fünf Elementklassen sind die neuen Karten die jeweilige
Klassenmechanik in Reinform (Sprengradius / Erstarrung / Kette / Gift-
Ausbreitung / Brandausbreitung), gebaut auf den bereits vorhandenen
`core`-Schlüsseln aus den LP-Phasen 12–16 — dort ist kaum neuer Code nötig.

**Abnahme 3c:** je Topf 12 Karten in 4/3/2/2/1; keine Signaturkarte trägt
einen `damageType` (Bestandsregel seit LP-Phase 19: nur `signatureClass`
filtert); Filter-Test je Klasse; R1–R6 grün.

---

### Phase 3d — Drei Mechanik-Signaturtöpfe auf je 15 (4/4/3/2/2)

Betrifft `c_ricochet`, `c_scrap`, `c_engineer`. **`c_necro` bleibt außen vor**
(Ist-Abgleich 9) — er wird in Phase 6 vollständig ersetzt.

Je Topf: 4 `common` und 4 `rare` bleiben (ggf. herabgestufte Legendaries
füllen auf), die vier heutigen `legendary` verteilen sich auf 3 `epic` /
2 `unique` / 2 `legendary`, **+3 neue Karten** je Topf.

Konkret sind hier die reinen Zahlen-Legendaries zu ersetzen (Ist-Abgleich 2):
`sig_ric_kanonade`, `sig_scrap_mogul`, `sig_scrap_juggernaut`,
`sig_eng_chefingenieur` — alle vier werden zu echten Mechaniken
umgeschrieben oder auf `rare` herabgestuft.

**Am Ende von 3d wird die Phase-28-Abnahme scharf gestellt:** „jede der zehn
Klassen hat in Raum 10 in **jeder der fünf** Stufen mindestens eine ziehbare
Karte" — ohne die Ausnahmeliste aus Phase 2.

> **Achtung, Reihenfolge:** `c_necro` erfüllt diese Zusicherung erst nach
> Phase 6. Bis dahin bleibt er als **namentliche, kommentierte Ausnahme** im
> Test stehen, mit Phase 6 als Fälligkeitstermin — dieselbe Mechanik wie der
> Übergangskommentar in Phase 2, damit die Lücke nicht still ist.

---

## Phase 4 — Geisterpanzer als eigene Einheit

**Ziel:** `src/game/ghost.js` wird nach Spec 2 **ersetzt**. Der Geist ist eine
echte, tötbare Einheit mit festen Basiswerten statt einer Kopie des
getöteten Gegners mit Ablaufdatum.

**Dateien:** `src/game/ghost.js` (neu geschrieben), `src/game/state.js`,
`src/game/cfg.js`, `src/render/renderer.js`, `data/balance.json`,
`tests/regression.mjs`, `sw.js`

**Datenfelder** — `data/balance.json → ghost` komplett ersetzt:

```jsonc
"ghost": {
  "maxHp": 60,
  "damage": 8,
  "fireIntervalS": 2.0,
  "speedMult": 0.7,          // auf die BASIS-cfg der Klasse, s. u.
  "bulletSpeedMult": 0.8,
  "rangeMult": 0.65,
  "maxActive": 3,
  "spawnChanceKill": 0.5,
  "spawnChanceGhostKill": 0.33
}
```

Entfernt: `duration`, `killBonus`.

**Bezugsgröße der drei Multiplikatoren — Entscheidung:** sie wirken auf die
**un-aufgewertete Basis-cfg der gespielten Klasse**
(`resolveCfg(data, run.starterTank)` ohne Upgrades), nicht auf die aktuelle
Spieler-cfg. Grund: „keine Stat-Übernahme" (Festlegung 9) soll auch nicht
durch die Hintertür der Spieler-Upgrades passieren — sonst machte eine
Tempo-Karte nebenbei alle Geister schneller, und die Geisterstärke hinge an
unzusammenhängenden Karten. Änderungen an Geisterwerten laufen ausschließlich
über die expliziten `ghost*`-Schlüssel aus Phase 6.

**Umbau:**

1. **`createGhost(state, x, y, heading)`** baut die Einheit aus
   `balance.ghost` + Basis-cfg. Kein `tank.cfg`-Übernehmen, kein `timeLeft`.
   Felder: `hp`, `maxHp`, `damage`, `cooldown`, `fireInterval`, `speed`,
   `bulletSpeed`, `maxDistance`, `alive`.
2. **`updateGhosts`**: kein Timer mehr. Nahziel-Auswahl bleibt
   (`nearestEnemy`), Fahren/Zielen/Feuern wie bisher, aber mit den eigenen
   Werten. Reichweite über `maxDistance` am Geschoss (Wegbudget-Mechanik aus
   LP-Phase 1, kein neuer Mechanismus).
3. **Zentrale Verwaltung** in `ghost.js`:
   `canSpawnGhost(state)` (`state.ghosts.length < maxActive`),
   `spawnGhost(state, x, y, heading)`, `damageGhost(state, ghost, amount)`,
   `killGhost(state, ghost)`. Kein FIFO-`shift()` mehr — bei vollem Limit
   passiert **nichts**.
4. **Trefferprüfung** (O2): eigene Schleife nach der Panzer-Schleife in
   `state.js`. Nur Geschosse mit `b.owner !== state.player && !b.owner?.isGhost`
   treffen; `b.hitGhosts` verhindert Mehrfachschaden; die Kugel stirbt
   **nicht**. Gegnerische Minenexplosionen (`mine.js: explodeAt`) schädigen
   Geister ebenfalls, eigene Explosionen nicht.
5. **Spawn im Kill-Funnel** (`killTank`, Gegner-Zweig):

   ```js
   // Reihenfolge zwingend: erst die Klassen- und Limitprüfung, DANN der Wurf.
   // Sonst verbraucht jede Klasse bei jedem Gegnertod state.rng und alle
   // Seeds verschieben sich (Muster: tryRevive, state.js:544).
   if (pc.ghostSummoner && canSpawnGhost(state)) {
     const chance = byGhost ? g.spawnChanceGhostKill : g.spawnChanceKill;
     if (state.rng() < chance) spawnGhost(state, tank.x, tank.y, tank.heading);
   }
   ```

   `byGhost` = der tödliche Treffer kam von einem Geist (`b.owner?.isGhost`);
   dafür reicht das bereits vorhandene `meta`-Objekt der Trefferschleife.
6. **Raumwechsel**: `state.ghosts = []` steht schon in `state.js:734` — der
   Zähler ist die Array-Länge, es gibt also nichts zusätzlich
   zurückzusetzen. Ein Test sichert das ab, statt es anzunehmen.
7. **Tod ohne Zusatzeffekt**, aber mit Hook: `killGhost()` ruft
   `state.onGhostDeath?.(ghost)` — Aufhänger für die Wiedergeburts-Karten aus
   Phase 6. In Phase 4 ist der Hook leer.
8. **Lebensleiste** im Renderer, gleiche Darstellung wie beim Panzer
   (`renderer.js: drawTank`), nur bei `hp < maxHp` — Geister sind zu dritt im
   Bild, Dauerbalken wären unlesbar (dieselbe Begründung wie bei Gegnern in
   LP-Phase 2).
9. `cfg.js`: `ghostSummoner` in die `resolveCfg`-Whitelist (Phase 5 setzt es
   über `tanks.json`); `grantGhostCrew`/`ghostDurationBonus`/`ghostCrew`
   bleiben in Phase 4 noch stehen und fallen in Phase 5 (Festlegung 11) —
   sonst wäre der Geisterpanzer eine Sitzung lang gar nicht erzeugbar.

**Die 17 Kernregeln (Spec 2 §20 — rekonstruiert, s. Vorbemerkung):**

| # | Regel |
|---|---|
| 1 | Eigener Unit-Typ `ghost_tank`, kein Panzer in `state.tanks` |
| 2 | 60 LP fest |
| 3 | 8 Schaden fest |
| 4 | 2,0 s Schussintervall |
| 5 | 70 % Tempo der Klassenbasis |
| 6 | 80 % Geschosstempo |
| 7 | 65 % Reichweite |
| 8 | 0 Rüstung |
| 9 | Kein Kollisionsschaden |
| 10 | Keine Stat-Übernahme vom getöteten Gegner |
| 11 | Limit 3 gleichzeitig |
| 12 | Kein Verdrängen bei vollem Limit |
| 13 | Kein Zeitlimit |
| 14 | Ende bei Tod oder Raumwechsel |
| 15 | Autonom, keine Steuerung durch den Spieler |
| 16 | Nahziel-Auswahl |
| 17 | Spawn 50 % bei Nekromanten-Kill, 33 % bei Geister-Kill |

**Abnahme:** alle 17 einzeln geprüft; 5 Seeds über 16 Räume laufen
**bit-identisch** wie vor der Phase (Klasse `player`, kein Geister-Wurf).

**Tests (Gegenproben):** je Regel ein eigener Check; besonders —
Limit ohne Verdrängung (4. Kill bei 3 Geistern erzeugt nichts, verdrängt
nichts), kein Zeitlimit (Geist lebt nach 30 s Simulation noch), Kugel fliegt
nach Geistertreffer weiter (Gegenprobe: `b.dead = true` setzen → Geist wird
zum Schild → rot), Geist nimmt nur von Gegnergeschossen Schaden,
Determinismus (Gegenprobe: Wurf **vor** die Klassenprüfung ziehen → 5-Seed-Test
rot — das ist der wichtigste Test der Phase).

**Risiken:**

- **RNG-Drift** (Ist-Abgleich 11). Die Reihenfolge Klassenprüfung → Limit →
  Wurf ist zwingend und wird per Test bewacht.
- Die Trefferprüfung läuft über `bullets × ghosts` (max. 24 × 3 = 72
  Paare/Frame) — unkritisch gegenüber dem 6-ms-Budget aus LP-Phase 11b, aber
  im Frame-Budget-Test mitgemessen.
- `ghost.js` verliert die `cfg`-Übernahme; alles, was heute über
  `g.cfg.*` läuft (auch im Renderer), muss auf die neuen Felder umgestellt
  werden. Der Fake-Canvas-Renderpfadtest (Abschnitt 6d) fängt das.

---

## Phase 5 — Klassenidentität und Geisterbombe

**Ziel:** der Nekromant erzeugt Geister **ohne jedes Upgrade**, und die Bombe
wird zur Beschwörung.

**Dateien:** `data/tanks.json`, `data/upgrades.json`, `data/sounds.json`,
`src/game/cfg.js`, `src/game/state.js`, `src/game/tank.js`, `src/ui/hud.js`,
`src/ui/touchcontrols.js`, `src/main.js`, `tests/regression.mjs`, `sw.js`

**Datenfelder:**

- `tanks.json → c_necro`: `reviveChance` **gelöscht** (Festlegung 12), neu
  `ghostSummoner: true`. Der Klassenbezug bleibt damit datengetrieben — kein
  hartkodiertes `'c_necro'` im Code (dieselbe Lehre wie die `'player'`-Auflösung
  in LP-Phase 9).
- `upgrades.json`: `ghost_crew` **gelöscht** (Festlegung 11).
- `sounds.json`: neuer Eintrag `summon`.

**Umbau:**

1. `cfg.js`: `grantGhostCrew`, `ghostDurationBonus`, `cfg.ghostCrew` und die
   Zeile `cfg.ghostCrew = l('ghost_crew') > 0` **ausgebaut**; `ghostSummoner`
   in der Whitelist. `reviveChance`/`reviveChanceBonus` ebenfalls ausgebaut —
   keine andere Klasse nutzt sie (geprüft: nur `c_necro` und die zwölf
   `sig_necro_*`-Karten, die Phase 6 ersetzt).
2. `state.js`: `tryRevive()` **entfällt**; die drei Aufrufstellen in
   `applyDamage` rufen direkt `killTank()`. Der `createGhost`-Block in
   `killTank` weicht dem Spawn-Wurf aus Phase 4.
3. `tank.js: useSecondary()` zweigt ab:

   ```js
   if (tank.cfg.ghostSummoner) return summonGhost(tank, state);
   return layMine(tank, state, throwOverride);
   ```

   `summonGhost()` scheitert (mit `empty`-Ton + gedimmtem Blitz, s. O3), wenn
   `state.ghosts.length > 0`; sonst `spawnGhost()` vor dem Panzer,
   `summon`-Ton, grüner Blitz.
4. **Das Wurf-/Ziel-Overlay entfällt für die Klasse**: `getMinePreview()` und
   der Touch-Wurfstick liefern bei `ghostSummoner` nichts — ein Wurfbogen für
   eine Beschwörung wäre irreführend. Der Bombenknopf wird ein einfacher
   Druckknopf (`setSecondaryLabel('BESCHWÖREN')`).
5. HUD nach O3.

**Abnahme:**

- Nekromant erzeugt im **ersten** Raum ohne jedes Upgrade Geister (Kill-Wurf
  **und** Beschwörung).
- Keine normale Bombenexplosion mehr möglich — der Nekromant legt nie eine Mine.
- Bombenknopf bei 1, 2 und 3 aktiven Geistern wirkungslos, bei 0 wirksam.
- Der beschworene Geist zählt gegen das Limit von 3.
- Keine andere Klasse verliert ihre Bombe.
- `ghost_crew` ist aus Pool und Code verschwunden; keine andere Klasse kann
  Geister erzeugen.
- `reviveChance` existiert nirgends mehr.

**Tests (Gegenproben):** Beschwörung bei 0/1/2/3 Geistern (je Gegenprobe:
Sperre entfernen → bei 1 Geist entsteht ein zweiter → rot); Nekromant legt
nie eine Mine (Gegenprobe: Abzweig entfernen → Mine liegt → rot); andere
Klasse legt weiterhin Minen; Kill-Spawn ohne Upgrade; `ghost_crew` nicht mehr
ziehbar; Quelltext-Scan auf `ghostCrew`/`reviveChance` (Gegenprobe: eine
Zeile wieder einbauen → rot).

**Risiken:**

- **`tryRevive` steckt in drei Zweigen von `applyDamage`.** Ein vergessener
  Zweig hieße: der Spieler stirbt in einem Pfad nicht mehr. Der Bestandstest
  „vier Gegnertreffer töten" (Abschnitt 11) fängt den Hauptpfad, DOT und
  Schild-Restschaden brauchen je einen eigenen Check.
- Der Nekromant verliert mit `reviveChance` seine einzige Überlebensregel und
  behält nur 95 LP. Bis Phase 6 ist er **spürbar schwächer als vorher** —
  erwartete Zwischenlage, in Phase 6 durch die Wiedergeburts-Karten aufgelöst.
  (Falls das zu hart ausfällt: `c_necro.maxHp` ist eine reine Datenänderung.)

---

## Phase 6 — Signaturpool Nekromant (16 Karten)

**Ziel:** die zwölf `sig_necro_*`-Karten werden durch die 16 Karten aus
Spec 2 §16 **ersetzt**. Drei Archetypen (Spec 2 §17) sind frei kombinierbar —
es gibt keinen exklusiven Pfad.

**Dateien:** `data/upgrades.json`, `src/game/cfg.js`, `src/game/ghost.js`,
`src/game/state.js`, `tests/regression.mjs`, `sw.js`

**Verteilung: 4/4/3/3/2** (16 Karten). Alle mit
`signatureClass: "c_necro"`, **ohne** `damageType` (Bestandsregel seit
LP-Phase 19).

| Karte | Stufe | Archetyp | `core`-Wirkung | `category` |
|---|---|---|---|---|
| Geisterkern | common | – | `ghostHpAdd`, `ghostDamageAdd` | `class` |
| Seelenkanone | common | Elite | `ghostDamageAdd`, `ghostFireRateMult` | `offensive` |
| Unruhige Seelen | common | Horde | `ghostSpawnChanceAdd` (klein) | `swarm` |
| Rastlose Geister | common | – | `ghostSpeedMult`, `ghostBulletSpeedMult` | `utility` |
| Rudelgeist | rare | Horde | `ghostMaxActiveAdd: 1` | `swarm` |
| Seelensog | rare | – | Geistertod gibt dem Spieler LP (`ghostDeathHeal`) | `defensive` |
| Seelenruf | rare | Horde | `ghostSpawnChanceAdd` (groß) | `swarm` |
| Seelenketten | rare | Elite | Geisterschüsse ketten auf ein zweites Ziel (`ghostChain`) | `offensive` |
| Geisterkommandant | epic | Elite | Geister erben einen Anteil der Spieler-Werte (`ghostInheritRatio`) | `class` |
| Wiederkehr | epic | Wiedergeburt | ein gestorbener Geist kehrt einmal zurück (`ghostReviveCharges`) | `resurrection` |
| Geisterlegion | epic | Horde | `ghostMaxActiveAdd: 2`, dafür `ghostHpMult < 1` | `swarm` |
| Phylakterium | unique | Wiedergeburt | Geistertod lädt die Beschwörung sofort neu (`ghostDeathRecharge`) | `resurrection` |
| Unsterbliche Seele | unique | Wiedergeburt | ein Geist stirbt nicht, sondern erscheint nach `respawnS` neu | `resurrection` |
| Lich-Panzer | unique | Elite | **`requires: ["sig_necro_geisterkommandant"]`** — Limit auf 1, dafür Geist mit dreifachen Werten | `class` |
| Armee der Toten | legendary | Horde | `ghostMaxActiveAdd: 3` **und** Spawnchance 100 % | `swarm` |
| Ewige Wiederkehr | legendary | Wiedergeburt | jeder Geistertod beschwört sofort einen neuen **und** heilt den Spieler | `resurrection` |

**Verteilung:** common 4, rare 4, epic 3, unique 3, legendary 2 = 16. ✓
R4 ist bei beiden Legendaries erfüllt (je zwei Mechanikschlüssel), R2 bei
allen fünf `unique`/`legendary` (`maxStacks: 1`).

**Neue `core`-Schlüssel** — alle durch **dieselbe** `core`-Schleife in
`cfg.js` (harte Randbedingung: keine zweite Upgrade-Verarbeitung). `ghost.js`
und der Spawn-Pfad lesen sie ausschließlich aus der **Spieler-`cfg`**:
`ghostHpAdd`, `ghostHpMult`, `ghostDamageAdd`, `ghostFireRateMult`,
`ghostSpeedMult`, `ghostBulletSpeedMult`, `ghostMaxActiveAdd`,
`ghostSpawnChanceAdd`, `ghostChain`, `ghostInheritRatio`,
`ghostReviveCharges`, `ghostDeathHeal`, `ghostDeathRecharge`,
`ghostRespawnS`.

Der `onGhostDeath`-Hook aus Phase 4 bekommt hier seine Nutzer
(Seelensog, Phylakterium, Unsterbliche Seele, Ewige Wiederkehr, Wiederkehr).

**Abnahme:**

- Jede der 16 Karten ist ziehbar; keine erscheint bei einer fremden Klasse.
- Die eine `requires`-Kette (Lich-Panzer ← Geisterkommandant) ist erreichbar.
- `maxStacks` greift (kein `unique`/`legendary` zweimal).
- Die drei Archetypen sind **frei kombinierbar** — es existiert kein
  gegenseitiger Ausschluss und kein `requires` zwischen Archetypen.
- `c_necro` erfüllt jetzt die Phase-28-Zusicherung (alle fünf Stufen in
  Raum 10 ziehbar) → die Ausnahmeliste aus 3d wird gelöscht.

**Tests (Gegenproben):** Struktur (16, 4/4/3/3/2, alle `signatureClass`, kein
`damageType`); Filter (`c_necro` sieht sie, `player` nie); `requires`-Kette;
je ein **Wirkungsnachweis** für die vier Archetyp-tragenden Mechaniken —
Geisterlimit steigt (Gegenprobe: `ghostMaxActiveAdd` im Applier nullen →
rot), Spawnchance steigt, Geist kehrt nach dem Tod zurück (Gegenprobe: Hook
nicht aufrufen → rot), Lich-Panzer setzt Limit **und** Werte (Gegenprobe:
nur eines von beidem → rot); Archetyp-Freiheit (alle drei gleichzeitig
wählbar).

**Risiken:**

- `ghostMaxActiveAdd` hebt ein Leistungsbudget an: mit *Armee der Toten* +
  *Geisterlegion* + *Rudelgeist* wären es bis zu 9 Geister. Das kollidiert mit
  `data/limits.json` (LP-Phase 11b). **Vorschlag: harter Deckel
  `balance.ghost.maxActiveCap: 6`** — Muster wie `bullet.maxActiveCap`. Im
  Frame-Budget-Test mitmessen.
- *Geisterkommandant* (`ghostInheritRatio`) hebelt Spec-2-Regel 10 („keine
  Stat-Übernahme") teilweise aus — aber vom **Spieler**, nicht vom getöteten
  Gegner. Das ist der Punkt der Karte und mit der Regel verträglich; gehört
  trotzdem in die Karten-Beschreibung, damit es keine stille Ausnahme wird.

---

## Was dieser Plan nicht löst

- **Das Synergie-Tag-Konzept ist ersatzlos gestrichen** (Festlegung 1). Karten
  interagieren künftig nur noch über `requires` und über gemeinsam benutzte
  `cfg`-Schlüssel. `docs/MEMORY-TAGS.md` hält das alte Konzept fest, damit es
  wieder einbaubar bleibt — aber der Wortlaut fehlt, solange Spec 1 fehlt.
- **Die Angebotsvielfalt sinkt.** Ohne Tag-Regel kann ein Angebot dreimal
  dieselbe Kategorie zeigen. Das ist ausdrücklich akzeptiert (Festlegung 3),
  bleibt aber ein Spielgefühl-Risiko, das erst nach Phase 3 beurteilbar ist.
- **Telemetrie-Auswertung.** Die seit `PLAN.md` Phase 18 offene Aufgabe
  (15–20 Runs spielen und `?debug=1` auswerten) wird durch diesen Umbau
  **dringender**, nicht erledigt: 313 Karten in fünf Stufen lassen sich ohne
  echte Daten nicht mehr per Pool-Analyse ausbalancieren.
- **Der Bankshot-Faktor** (`bullet.wallBounceDamageMult`, heute 2,5) bleibt
  eine offene manuelle Entscheidung aus `UMBAUPLAN-LP.md`.
- **Geister und Bosse.** Spec 2 sagt nichts dazu, ob Geister gegen den
  Reaktor-Generator oder die Spiegel-Boss-Regel etwas ausrichten. Nach den
  Bestandsregeln (LP-Phase 8/14) können sie es nicht — Geisterschüsse tragen
  keine Wandabpraller-Historie des Spielers. Das ist konsistent, aber
  ungeprüft und sollte nach Phase 6 einmal am echten Boss angesehen werden.
