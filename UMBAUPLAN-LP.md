# UMBAUPLAN-LP.md

Vollständiger Umbau von Ein-Treffer auf Lebenspunkte, zehn Klassen und sechs
Schadenstypen.

**Arbeitsregel: eine Phase pro Claude-Code-Sitzung, kein Überlappen.** Jede
Phase endet mit fünf Testschritten, die am Telefon ausführbar sind, und einer
Fertig-Bedingung. Alle Stellwerte gehören in JSON, nicht in den Code.

Umfang: 28 Sitzungen. Phasen 1 bis 9 sind das Fundament — solange die nicht
stehen, ist jede Karte Spekulation.

**Fortschritt:** Phase 1 ✅ gebaut. **Nächste Sitzung: Phase 2
(Gegner-Lebenspunkte, Anzeige, Skalierung).**

---

## Festgelegte Entscheidungen

| Thema | Entscheidung |
|---|---|
| Lebenspunkte | alle, Spieler und Gegner |
| Abprall | **doppelter Schaden nach Wandkontakt**, für alle Klassen |
| Abprallzwang | entfällt, wird Spielart des Abprallpanzers |
| Gegnerhärte | 2–5 Treffer, Elite 10, Boss 50 |
| Spielerhärte | 90–115 LP je Klasse, 4 Gegnertreffer bis Tod |
| Heilung | volle LP bei jedem Raumwechsel, kein Nachschub im Raum |
| Skalierung | Gegner-LP +5 % pro Raum, Gegnerschaden konstant |
| Krit | 2× Schaden **und** Nachladen wird zurückgesetzt |
| Begleiter | erlaubt (Nekromant, Ingenieur) |
| Karten | Kern 30 + 6 Typtöpfe × 12 + Signaturen ~80 |
| Zweitelement | pro Run zufällig, halbe Gewichtung, im Shop neu würfelbar |

---

## Phase 1 — Schadensmodell im Code ✅ gebaut

**Ziel: reiner Umbau. Nach dieser Sitzung spielt sich das Spiel exakt wie
vorher.** Das ist die wichtigste Phase, weil sie den Umbau von der Balance
trennt.

**Dateien:** `src/game/state.js`, `src/game/tank.js`, `src/game/bullet.js`,
`src/game/cfg.js`, `data/tanks.json`

**Änderungen:**

- `cfg.js: resolveCfg()` bekommt `maxHp` (aus `tanks.json`, Standard 1) und
  `damage` (Standard 1).
- Panzer bekommen beim Erzeugen `hp = cfg.maxHp`.
- Geschosse bekommen `damage` vom Erzeuger mit.
- `state.js:425 killTank()` wird zu `applyDamage(tank, amount, cause, meta)`.
  Sie zieht ab, prüft auf `hp <= 0` und ruft dann die bisherige Todeslogik
  auf, die unverändert als `killTank()` bestehen bleibt.
- **Alle Aufrufer, die heute direkt töten, rufen künftig `applyDamage()` mit
  einem Betrag auf.** `killTank()` bleibt der Trichter für den Tod selbst —
  Kettenreaktionen, Statistik und Telemetrie hängen daran und dürfen nicht
  angefasst werden.
- Alle Werte in `tanks.json` auf `maxHp: 1`, alle Schadensquellen auf 1.

**Fertig, wenn:** `tests/regression.mjs` unverändert durchläuft und ein
kompletter Run sich identisch anfühlt.

**Testschritte:**
1. Einen Gegner direkt treffen — er stirbt beim ersten Treffer.
2. In die eigene abgeprallte Kugel fahren — Tod wie vorher.
3. Eine Mine zünden und mehrere Gegner gleichzeitig treffen — Kettenreaktion
   funktioniert, Statistik zählt korrekt.
4. Einen Boss angreifen — `bossInvincible` fängt weiterhin ab.
5. Raum bis zum Ende spielen, Schrottbelohnung prüfen.

### Umsetzung (gebaut)

- **`applyDamage(tank, amount, cause, meta)` neu, `killTank()` bleibt.** Der
  Schnitt liegt bewusst so: **alles, was einen Treffer ABWEHRT** (Reaktorkern-
  Unverwundbarkeit, Schildladung, Gegnerschild, Spielerschild) ist von
  `killTank()` nach `applyDamage()` gewandert, danach wird abgezogen und erst
  bei `hp <= 0` die reine Todeslogik gerufen. Grund: die Gatter verhindern
  *Schaden*, nicht *den Tod* — solange `maxHp`/`damage` überall 1 sind, ist
  das exakt dasselbe Verhalten, aber mit echten Lebenspunkten wäre die alte
  Platzierung falsch (ein Schild, das nur bei tödlichen Treffern greift, wäre
  eine zweite Lebensleiste — genau das, was Phase 8 vermeiden will).
  `killTank()` bleibt als eigener, direkt aufrufbarer Trichter bestehen
  (Kettenreaktionen, Statistik, Telemetrie, Geisterpanzer) und hat neu einen
  Doppeltod-Schutz (`if (!tank.alive) return`), weil eine Kettenreaktion ihn
  sonst zweimal im selben Frame treffen kann.
- **Nur zwei echte Aufrufer** mussten umgestellt werden: die Geschoss-Treffer-
  Schleife in `state.js` und `explodeAt()` in `mine.js`. Beide prüfen `protect`
  bereits vorher selbst, `applyDamage()` braucht deshalb keine eigene
  Spawnschutz-Prüfung.
- **Geschosse tragen ihren Schaden** (`createBullet({ damage })`, Standard 1),
  mitgegeben vom Erzeuger aus `cfg.damage`. Bewusst beim Abschuss eingefroren
  statt beim Treffer aus `b.owner` gelesen: sonst würde eine noch fliegende
  Kugel rückwirkend stärker, wenn ihr Besitzer zwischendurch ein Upgrade
  bekommt — oder ins Leere greifen, wenn er stirbt.
- **Explosionsschaden steht in `balance.json: damage.explosion`**, nicht bei
  einem Panzertyp — eine Mine hat keinen `cfg.damage`. `explodeAt()` hat dafür
  einen optionalen letzten Parameter (für Phase 3: Bossangriff), alle
  Bestandsaufrufe bleiben unverändert.
- **`resolveCfg()`** liefert `maxHp`/`damage` (beide `?? 1`), `createTank()`
  setzt `hp = cfg.maxHp`. Weil `createTank()` bei jedem Raumwechsel, Respawn
  und Wellen-Spawn ohnehin läuft, braucht die „volle LP je Raum"-Regel aus
  Phase 3 später **keinen eigenen Hook**.
- **`tanks.json`**: alle 15 Typen haben jetzt explizit `maxHp: 1` und
  `damage: 1` (nicht nur den Fallback) — Phase 2 ändert damit reine Zahlen.

**Verhaltensbeweis statt „fühlt sich gleich an":** Die Fertig-Bedingung
verlangt einen identischen Run. Dafür wurde ein Wegwerf-Werkzeug gebaut, das
5 Seeds mit je 240 Ticks echter Simulation pro Raum (Gegner fahren, schießen,
Kugeln prallen ab, Minen zünden) durchspielt und **506 vollständige
Zustandsproben** protokolliert — Positionen aller Panzer auf drei
Nachkommastellen, Kugel-/Minen-/Partikelzahlen, alle Zähler, Endstand jedes
Runs. Alter und neuer Stand sind **zeilenweise identisch**. Gegenprobe: ein
einziges `t_brown: maxHp 2` erzeugt sofort 15 abweichende Zeilen — das
Werkzeug ist also nicht blind.

**Neue Dauertests** (`tests/regression.mjs`, Abschnitt 9, neun Prüfungen):
Sie testen bewusst den **Mechanismus mit eigenen Zahlen**, nicht die aktuellen
JSON-Werte — sonst wären sie schon durch Phase 2 rot, ohne dass etwas kaputt
ist. Enthalten: Strukturwächter (jeder Typ hat `maxHp`/`damage` — fängt einen
in Phase 2 vergessenen Typ), Teilschaden tötet nicht, Tod läuft durch
`killTank()`, alle drei Abwehr-Gatter fangen den Schaden statt den Tod,
Geschoss trägt den Schuss-Zeitpunkt-Schaden, Treffer/Explosion ziehen den
richtigen Betrag, Doppeltod zählt einfach.
**Gegenprobe für alle bestanden** — und dabei ein blinder Test gefunden: die
erste Fassung von „Panzer starten mit vollen LP" prüfte `hp === cfg.maxHp` im
echten Raum, was bei `maxHp: 1` überall **trivial wahr** ist. Ein hartkodiertes
`hp: 1` in `createTank()` rutschte glatt durch. Jetzt wird zusätzlich mit
einem synthetischen `cfg.maxHp = 42` geprüft.

---

## Phase 2 — Gegner-Lebenspunkte, Anzeige, Skalierung

**Dateien:** `data/tanks.json`, `data/difficulty.json`,
`src/render/renderer.js`, `src/game/state.js`

**Werte in `tanks.json`:**

| Gegner | maxHp |
|---|---|
| t_brown, t_grey | 20 |
| t_yellow, t_teal | 30 |
| t_pink, t_green | 40 |
| t_armored | 50 |
| t_prism | 40 |
| Elite (Multiplikator) | ×2 |
| Bosse | 500 |

Spielerschaden vorerst fest 10.

**Skalierung in `difficulty.json`:**

```json
"hpScaling": { "perRoom": 0.05 }
```

`gegnerLP = maxHp × (1 + 0.05 × (raum − 1))`. Raum 15 liegt bei 1,7×.
Gegnerschaden skaliert **nicht**.

**Anzeige:** Ein schmaler Balken über jedem Gegner, der nur erscheint, wenn
`hp < maxHp`. Auf einem Telefondisplay mit acht Gegnern ist ein
Dauerbalken unlesbar. Farbe folgt dem Panzer, nicht rot/grün.

**Testschritte:**
1. Einen braunen Gegner zweimal treffen — erst der zweite tötet.
2. Nach dem ersten Treffer erscheint der Balken, vorher nicht.
3. Einen gepanzerten Gegner von vorn beschießen — Panzerung blockt weiterhin
   ganz, kein Teilschaden.
4. In Raum 12 einen braunen Gegner zählen — er braucht drei Treffer.
5. Elitegegner prüfen — doppelte Leiste.

---

## Phase 3 — Spieler-Lebenspunkte, Heilung, Schadenszahlen

**Dateien:** `data/tanks.json`, `data/balance.json`, `src/game/run.js`,
`src/render/renderer.js`

**Schadenswerte gegen den Spieler:**

| Quelle | Schaden |
|---|---|
| gegnerische Kugel | 25 |
| eigene abgeprallte Kugel | 15 |
| Minenexplosion | 40 |
| Bossangriff | 34 |

Bei 100 LP sind das vier Gegnertreffer. Die eigene Kugel tut weh, ist aber aus
voller Gesundheit nie tödlich — der Bankschuss bleibt eine Entscheidung, wird
aber kein Todesurteil mehr.

**Heilung:** volle LP bei jedem Raumwechsel, kein Nachschub im Raum. Jeder Raum
ist ein abgeschlossenes Budget. Damit entfällt jede Buchhaltung zwischen
Räumen.

**Anzeige:** Lebensleiste am Panzer, nicht nur am Bildschirmrand. Auf dem
Telefon schaut niemand in die Ecke, während er zielt.

**Testschritte:**
1. Viermal von einem Gegner treffen lassen — beim vierten stirbt man.
2. Aus voller Gesundheit in die eigene Kugel fahren — man überlebt.
3. Mit 20 LP in den nächsten Raum gehen — dort startet man bei voll.
4. Ein Leben verlieren und respawnen — LP voll, Raum neu.
5. In die eigene Mine fahren — 40 Schaden.

---

## Phase 4 — Abprall-Bonus

**Ziel: der Abprall bleibt relevant, ohne erzwungen zu sein.**

**Dateien:** `src/game/state.js`, `data/balance.json`

Ein Geschoss mit `wallBounces > 0` richtet **doppelten Schaden** an. Gilt für
alle Klassen und alle Schadenstypen, ist kein Upgrade und keine Klassenregel.

```json
"bullet": { "wallBounceDamageMult": 2.0 }
```

Damit ist ein gebandeter Schuss zwei Treffer wert. Ein leichter Gegner stirbt
an einem Bankschuss statt an zwei direkten. Der Spieler entscheidet zwischen
schnell und sicher — genau das, was die alte Zwangsregel erreichen wollte,
nur ohne Zwang.

**Alternative als Datenflag offenhalten:** `perBounce: 1.5` mit Deckel bei 3,0,
falls sich der pauschale Faktor zu flach anfühlt. Nicht implementieren, nur den
Wert vorsehen.

**Wichtig:** Der Bonus gilt auch für gegnerische Geschosse. Sonst lernt der
Spieler, dass gebandete Kugeln nur für ihn gefährlich sind.

**Testschritte:**
1. Einen braunen Gegner direkt treffen — zwei Treffer nötig.
2. Denselben Gegner über eine Wand banden — ein Treffer reicht.
3. Sich selbst von einer gebandeten eigenen Kugel treffen lassen — 30 statt 15.
4. Einen gegnerischen Bankschuss kassieren — 50 statt 25.
5. Einen Boss gebandet treffen und die Leiste vergleichen.

---

## Phase 5 — Statuseffekt-System

**Ziel: ein gemeinsames Regelwerk, bevor irgendein Element existiert.**

**Dateien:** neu `src/game/status.js`, `src/game/state.js`,
`src/render/renderer.js`, neu `data/status.json`

**Ein Takt für alles: 0,5 Sekunden.**

| Typ | Wirkung | Dauer | Stapelung |
|---|---|---|---|
| Feuer | 4 Schaden je Takt | 3 s | bis 3, Dauer erneuert sich |
| Gift | 2 Schaden je Takt | 6 s | bis 5, Dauer erneuert sich |
| Frost | −40 % Tempo | 2 s | bei 3 Stufen 1 s bewegungsunfähig |

Blitz, Sprengstoff und Physisch wirken sofort und brauchen keinen Status.

Effekte über Zeit umgehen Panzerung und Prisma-Regeln — wie Explosionsschaden
in `armor.js` heute schon.

**Anzeige:** kleine Symbole unter der Lebensleiste, höchstens drei gleichzeitig.
Bei mehr wird das dominante angezeigt.

In dieser Phase wird **keine Quelle** angeschlossen. Nur das System und ein
Debugbefehl, der Status von Hand aufträgt.

**Testschritte:**
1. Debugbefehl: Feuer auf einen Gegner — sechs Ticks à 4 Schaden.
2. Feuer dreifach stapeln — 12 Schaden je Takt.
3. Feuer viermal auftragen — bleibt bei 3 Stufen, Dauer startet neu.
4. Frost dreifach — Gegner steht 1 s still.
5. Gift auf einen gepanzerten Gegner von vorn — wirkt trotz Panzerung.

---

## Phase 6 — Die sechs Schadenstypen an Quellen hängen

**Dateien:** `src/game/bullet.js`, `src/game/mine.js`, `src/game/cfg.js`,
`data/status.json`

Jedes Geschoss und jede Explosion bekommt ein Feld `damageType`. Standard ist
`physisch`. Die anderen fünf werden von Klassen und Karten gesetzt.

**Blitz:** springt auf 3 Ziele, −30 % Schaden je Sprung. Der Sprung sucht das
nächste Ziel innerhalb von 160 px, das noch nicht getroffen wurde.

**Testschritte:**
1. Ein Geschoss mit `damageType: "feuer"` per Debug abfeuern — Gegner brennt.
2. Blitzgeschoss in eine Dreiergruppe — alle drei getroffen, absteigender
   Schaden.
3. Blitzgeschoss auf einen einzelnen Gegner — kein Sprung, voller Schaden.
4. Frostgeschoss — Gegner wird langsamer, sichtbar an der Fahrspur.
5. Gebandetes Feuergeschoss — doppelter Aufschlagschaden, Brand unverändert.

---

## Phase 7 — Krit-Umbau

**Dateien:** `src/game/state.js`, `data/balance.json`

5 % auf doppelten Schaden sind +5 % Gesamtschaden und damit unsichtbar. Neu:

**Krit macht 2× Schaden und setzt dein Nachladen sofort zurück.** Damit ist ein
Krit ein Ereignis mit hörbarem und spürbarem Ausschlag, kein Rechenwert.
Aufbaubar über Karten bis 35 %.

```json
"crit": { "baseChance": 0.05, "mult": 2.0, "cap": 0.35, "resetsReload": true }
```

**Testschritte:**
1. Krit auf 100 % setzen und schießen — jeder Schuss lädt sofort nach.
2. Krit auf 0 % — normales Nachladen.
3. Krit plus Bankschuss — Faktoren multiplizieren sich (2 × 2 = 4).
4. Krit-Aufbau über Karten prüfen, Deckel bei 35 % greift.
5. Ton und Bildschirmausschlag beim Krit sind unterscheidbar vom Normaltreffer.

---

## Phase 8 — Altlasten abbauen

**Dateien:** `data/difficulty.json`, `data/tanks.json`, `data/balance.json`,
`tests/uspcheck.mjs`, `tests/regression.mjs`, `src/core/telemetry.js`

- `bankshotGuarantee.chance` auf 0. Einen Flammenpanzer in 58 % der Räume zu
  einem Gegner zu zwingen, den seine Klasse nicht spielt, ist unfair. Der Wert
  wird später eine Eigenschaft des Abprallpanzers.
- `t_prism`: `requiresRicochet` entfällt. Ersatz: **nimmt aus gebandeten
  Schüssen dreifachen statt doppelten Schaden.** Belohnen statt erzwingen.
- Schild: statt drei Ladungen ein **Schadensabsorber**, der die nächsten 40
  Punkte auffängt. Drei Ladungen wären eine zweite Lebensleiste.
- `tests/uspcheck.mjs` außer Dienst stellen. Sie misst ein Spiel, das es nicht
  mehr gibt.
- Die drei USP-Kennzahlen aus der Telemetrie entfernen und durch **Schaden je
  Schadenstyp pro Run** ersetzen. Das ist die Kennzahl, die das neue Spiel
  braucht.
- Den Bankshot-Test in `regression.mjs` streichen.

**Testschritte:**
1. Zehn Räume ab Raum 6 spielen — Prismen erscheinen nur noch zufällig.
2. Ein Prisma direkt beschießen — es nimmt Schaden.
3. Ein Prisma gebandet beschießen — dreifacher Schaden.
4. Schild aufnehmen und 60 Schaden kassieren — 40 abgefangen, 20 durch.
5. Testsuite läuft ohne Fehler durch.

---

## Phase 9 — Die zehn Klassen als Werte

**Dateien:** `data/tanks.json`, `src/game/cfg.js`, `src/game/state.js`,
`src/game/run.js`, `src/core/storage.js`, `src/render/renderer.js`

**Blocker aus dem Bestand, der zuerst weg muss:** `cfg.js` zieht für
`type === 'player'` Magazin, Magazindeckel und Kugelgeschwindigkeit fest aus
`balance.json` — die Werte im Panzertyp werden nie gelesen. Und `'player'`
steht als Zeichenkette hart in `state.js` (Zeilen 164 und 597). Beides muss
aus `run.starterTank` kommen.

**Die zehn Klassen:**

| Klasse | LP | Schaden | Tempo | Krit | Passiv |
|---|---|---|---|---|---|
| Standard | 100 | 10 | 100 % | 5 % | keine |
| Sprengpanzer | 115 | 9 | 90 % | 3 % | +20 % Explosionsradius |
| Frostpanzer | 110 | 9 | 95 % | 5 % | Verlangsamung +20 % |
| Teslapanzer | 90 | 11 | 105 % | 5 % | Blitze springen auf 4 statt 3 |
| Radioaktiv | 105 | 8 | 100 % | 5 % | Gift hält 25 % länger |
| Schrottpanzer | 95 | 8 | 100 % | 5 % | +5 % Schaden je 100 Schrott |
| Abprallpanzer | 100 | 9 | 100 % | 5 % | +1 Abpraller |
| Nekromant | 95 | 8 | 105 % | 5 % | 25 % Wiederbelebungschance |
| Ingenieur | 105 | 9 | 95 % | 5 % | Gebautes +20 % LP |
| Flammenpanzer | 100 | 9 | 100 % | 5 % | Brand hält 25 % länger |

Der gewählte Panzer gehört in die Seed-Wiedergabe. Sonst spielt derselbe Seed
mit einer anderen Klasse einen anderen Verlauf und die Regressionstests sind
nicht mehr reproduzierbar.

**Testschritte:**
1. Auswahlbildschirm: alle zehn wählbar, Werte lesbar.
2. Sprengpanzer wählen und eine Mine zünden — sichtbar größerer Radius.
3. Teslapanzer gegen fünf Gegner — vier werden getroffen.
4. Spiel schließen und neu öffnen — der laufende Run hat noch dieselbe Klasse.
5. Denselben Seed mit derselben Klasse zweimal spielen — identischer Verlauf.

---

## Phase 10 — Kernpool, 30 Karten

**Dateien:** `data/upgrades.json`, `src/game/upgradepool.js`

Karten, die jede Klasse ziehen kann: Schaden, Nachladen, Fahrtempo,
Lebenspunkte, Magazin, Abpraller, Krit, Schrott, Minen, Ausweichen.

**Zugleich der Fix aus PLAN-UPGRADES.md:** `weightedPick()` gewichtet pro Karte,
also gilt `P(Stufe) ∝ Poolgröße × Gewicht`. Damit 60/30/10 herauskommt, müssen
die ziehbaren Stufen **gleich groß** sein. Zielgröße im Kern: 10/10/10.

**Testschritte:**
1. Zehn Räume spielen und die Stufen der Angebote zählen.
2. Eine Schadenskarte nehmen und den Schaden an einem braunen Gegner nachrechnen.
3. Eine Kritkarte nehmen und den Deckel bei 35 % prüfen.
4. Alle Karten einer Stufe abgreifen — der Ersatzeintrag greift.
5. Testsuite mit dem neuen Verteilungstest aus Phase 28.

---

## Phasen 11 bis 16 — Sechs Schadenstyp-Töpfe

Eine Sitzung pro Topf, je 12 Karten in der Verteilung 4/4/4.

| Phase | Topf |
|---|---|
| 11 | Physisch |
| 12 | Sprengstoff |
| 13 | Feuer |
| 14 | Frost |
| 15 | Gift |
| 16 | Blitz |

**Muster für jede dieser Sitzungen:**

- 4 common: kleine Verstärkungen des Typs, stapelbar
- 4 rare: Regeländerungen innerhalb des Typs
- 4 legendär: zwei Abschlüsse je Spielrichtung des Typs
- Jede Karte trägt `damageType`, damit die Filterung greift
- Keine Karte darf einen anderen Typ abschalten oder überschreiben

**Testschritte je Topf:** Karte nehmen, Wirkung an einem braunen Gegner
nachmessen, Stapelung prüfen, Zusammenspiel mit dem Bankschuss-Faktor prüfen,
Angebotsfilterung prüfen (ein Frostpanzer darf keine reinen Feuerkarten sehen,
solange Feuer nicht sein Zweitelement ist).

---

## Phase 17 — Zweitelement

**Dateien:** `src/game/run.js`, `src/game/upgradepool.js`,
`src/render/renderer.js`, `data/balance.json`

Jede Klasse zieht ihren eigenen Schadenstyp voll gewichtet. Zusätzlich wird
beim Runstart **ein zufälliges zweites Element** gezogen und mit halber
Gewichtung beigemischt.

Ein Flammenpanzer mit Frost spielt anders als einer mit Blitz — bei identischen
Karten. Das erzeugt fünfzig Spielgefühle aus sechs Töpfen, ohne eine einzige
zusätzliche Karte.

Das Zweitelement wird beim Start angezeigt und darf im Shop gegen Schrott neu
gewürfelt werden.

**Testschritte:**
1. Fünf Runs starten und notieren, welches Zweitelement fällt — es variiert.
2. Als Flammenpanzer mit Frost zehn Angebote zählen — Frostkarten erscheinen
   etwa halb so oft wie Feuerkarten.
3. Karten des dritten Elements dürfen nie erscheinen.
4. Im Shop neu würfeln — der Pool ändert sich sofort für das nächste Angebot.
5. Derselbe Seed zieht dasselbe Zweitelement.

---

## Phasen 18 bis 27 — Signaturtöpfe

Eine Sitzung pro Klasse. Elementklassen bekommen 6 Karten, Mechanikklassen 12.

| Phase | Klasse | Karten |
|---|---|---|
| 18 | Standard | 6 |
| 19 | Sprengpanzer | 6 |
| 20 | Frostpanzer | 6 |
| 21 | Teslapanzer | 6 |
| 22 | Radioaktiv | 6 |
| 23 | Flammenpanzer | 6 |
| 24 | Abprallpanzer | 12 |
| 25 | Schrottpanzer | 12 |
| 26 | Nekromant | 12 |
| 27 | Ingenieur | 12 |

Die vier unteren sind Mechanikklassen ohne eigenen Schadenstyp. Ihr Charakter
kommt aus einer eigenen Regel, deshalb der doppelte Topf.

**Für Nekromant und Ingenieur zusätzlich zu klären:** Obergrenze gleichzeitiger
Begleiter. Ohne Deckel schaut der Spieler irgendwann nur noch zu. Vorschlag:
höchstens drei, Karten erhöhen die Qualität statt die Zahl.

---

## Phase 28 — Balance und neue Tests

**Dateien:** `tests/regression.mjs`, `src/core/telemetry.js`

Neue Tests, die dauerhaft absichern:

- **Stufenverteilung:** Ziehbare Poolgrößen je Stufe zählen. Abweichung um mehr
  als eine Karte → Fehler mit Angabe der zu vollen Stufe.
- **Gezogene Verteilung:** 2.000 Runs simulieren, Abweichung von
  `balance.rarity` über 5 Prozentpunkte → Fehler.
- **Zeit bis zum Tod:** Für jeden Gegnertyp die nötige Trefferzahl gegen den
  Standardpanzer prüfen. Weicht sie von der Tabelle in Phase 2 ab → Fehler.
- **Raumdauer:** Simulierter Raum in Raum 10 darf ein Zeitbudget nicht
  überschreiten. Das ist der Test, der verhindert, dass Räume wieder lang
  statt schwer werden.
- **Rechenzeit:** Der bestehende Test schlägt heute schon fehl (8,86 ms bei
  6 ms Budget, Maximum 16,29 ms). Ursache ist `solveBounce()` in
  `ai_turrets.js` mit 120 Winkeln × 300 Rasterschritten. Das muss vor dem
  Ende des Umbaus behoben sein, sonst ruckelt es mit zehn Statuseffekten
  deutlich schlimmer.

---

## Was dieser Umbau nicht löst

Der Abprall ist danach eine Belohnung, keine Regel. Ein Spieler, der nie
bandet, kann jede Klasse durchspielen — er braucht nur doppelt so viele
Treffer. Ob das reicht, um die Mechanik lebendig zu halten, entscheidet der
Kalttest: sieben Tage nicht spielen, dann einen Run machen und zählen, wie oft
man freiwillig gebandet hat. Fällt die Zahl unter ein Viertel der Schüsse, ist
der Faktor 2,0 zu niedrig und gehört auf 2,5 oder 3,0.
