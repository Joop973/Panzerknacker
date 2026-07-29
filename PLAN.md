# PLAN.md — Beta zu fertigem Spiel (v3)

Verbindliche Roadmap. Ersetzt v1 vollständig.
Alle in der Review gefundenen Widersprüche sind eingearbeitet.

**v3-Hinweis:** Konsistenz-Pass nach dem Bau der Phasen 0–4. Korrigiert tote
Verweise auf gelöschten/umbenannten Code, löst Widersprüche zwischen Text und
tatsächlichem Stand auf und ergänzt jeder noch offenen Phase, welche Dateien
sie wirklich betrifft. Ändert v2 inhaltlich nicht, sondern macht die noch
offenen Phasen (5–18) direkt umsetzbar, ohne dass der Programmierer zuerst
selbst den Code-Stand gegenprüfen muss.

---

## Leitprinzip

Das Alleinstellungsmerkmal ist **Abprallen**. In fast jedem Twin-Stick-Shooter
zielt man auf den Gegner. Hier zielt man auf eine Wand. Das ist ein anderer
Denkvorgang: Geometrie unter Zeitdruck statt Reaktionsgeschwindigkeit.

Jede Entscheidung wird daran gemessen:

> Macht diese Änderung den Abprallschuss notwendiger, lesbarer oder
> befriedigender?

---

## Aufbau

| Stufe | Bedeutung | Wenn du hier aufhörst |
|-------|-----------|----------------------|
| 0 | Fundament | Nichts danach ist sauber baubar |
| 1 | Der USP | Das Spiel hat einen Existenzgrund |
| 2 | Wiederspielbarkeit | Run 20 spielt sich anders als Run 3 |
| 3 | Struktur | Ein Run bekommt einen Bogen und Entscheidungen |
| 4 | Kür | Politur, nicht notwendig |

Aufwand in Abendsessions am Handy.

---

## Grundregeln (gelten für jede Session)

- Alle Balancing-Werte in `/data/*.json`. Niemals eine tunbare Zahl im Code.
- Kein Build-Step, kein npm, keine externen Libraries, **keine Asset-Dateien**.
  `index.html` läuft durch bloßes Öffnen.
- Pro Session genau eine Phase. Keine Vorgriffe.
- Jede Phase endet mit manuellen Prüfschritten ohne Programmierkenntnisse.
- Jede Phase, die Entitäten hinzufügt, meldet den schlechtesten Frame vorher
  und nachher.
- Vor jeder Phase an Physik oder Generator: Stand sichern.

---

# Vorabentscheidungen

Diese Punkte waren offen und sind jetzt festgelegt. Sie stehen hier, weil
mehrere Phasen von ihnen abhängen.

## E1 — Eingabekonzept

**Mobile: reines Autofire.** Zielstick ausgelenkt heißt schießen.
`stick.deadzone: 0.15`, `player.fireRate: 1.2` Schuss/s. Keine Schwelle, keine
Zonen, kein Feuerknopf. Sekundärwaffe auf eigenem Knopf.

**Desktop: WASD + Maus**, Linksklick feuert (gehalten = Autofire).
**Controller: linker Stick fahren, rechter Stick zielen, Trigger feuert.**

### Die Asymmetrie, die daraus folgt

Desktop und Controller können zielen, ohne zu schießen — Mobile nicht. Damit
kann ein Desktop-Spieler einen Bankshot in Ruhe anlegen, ein Handy-Spieler
muss ihn im Feuern finden. Das ist kein Detail, sondern ein Unterschied im
Kernvorgang des Spiels, und es gibt keine Lösung, die beides gleich macht,
ohne einer Seite etwas wegzunehmen.

**Umgang damit:**
- Alle Schwierigkeitswerte werden **gegen Mobile** balanciert. Desktop ist
  damit etwas leichter. Das ist die richtige Richtung — die schwächere
  Steuerung darf nicht auch noch bestraft werden.
- `stick.twoZone: false` bleibt als Datenflag im Code erhalten. Der
  Zwei-Zonen-Stick ist damit jederzeit ohne Umbau testbar, falls sich das
  Zielen auf dem Handy in Phase 4 gegen die Prisma-Panzer als zu grob erweist.
- **Dauerhafte Ziellinie im Grundspiel** (nicht als Upgrade): dünne Linie vom
  Rohr bis zur ersten Wand plus Winkelvorschau des ersten Abprallers. Auf
  Mobile ist sie der Ersatz für das ruhige Zielen; auf Desktop reine
  Hilfestellung. Abschaltbar in den Optionen.
  Der Ballistikrechner aus Phase 18 zeigt dann zwei Abpraller statt einen und
  bleibt dadurch ein sinnvolles Upgrade.

### Powershot und Autofire

Ohne Zielzone gibt es keinen Moment, in dem man zielt, ohne zu feuern. Der
Powershot kann deshalb **nicht** aufgespart werden — er geht mit dem ersten
Schuss raus, sobald der Stick ausgelenkt wird. Er ist damit ein passiver
Bonus, keine Entscheidung. Siehe Phase 5.

## E2 — Überlebens-Ökonomie

Ein Schaden, zwei Puffer, klar getrennt:

- **Leben**: dauerhaft, 3 zum Start, Extraleben alle 5 Räume. Verlust setzt
  den Raum zurück.
- **Schildladung**: verbraucht sich beim Treffer und **verfällt nach
  `shield.roomLifetime: 3` geräumten Räumen**. Kein unbegrenztes Bunkern, aber
  genug Reichweite, um einen Vorsprung wirklich zu nutzen. Ladungen altern
  einzeln, jede mit eigenem Zähler.

Anzeige: Leben als Symbole im HUD, Schildladungen als Ringe **am Panzer**, mit
verblassender Farbe bei nahendem Verfall. Zwei verschiedene Sounds bei
Verlust — sonst weiß niemand, was gerade passiert ist.

## E3 — Reflektierte Geschosse

Von `armored` oder `prism` zurückgeworfene Spielergeschosse gelten weiter als
`owner: player`, **verlieren aber alle Abpraller und despawnen beim nächsten
Wandkontakt**. Sie können dich töten, aber nur auf direktem Weg und damit
sichtbar. Der Unfairness-Fix aus Phase 1 bleibt intakt.
Optisch: reflektierte Kugeln wechseln die Farbe.

## E4 — Geschossbudget

**Weg statt Zeit.** `bullet.maxDistance: 1200` px (Arenadiagonale × ~1,3).
Grund: Bei Zeitbudget bekäme der doppelt so schnelle Powershot (Phase 5) die
doppelte Reichweite geschenkt. Beim Wegbudget fliegt er schneller, nicht
weiter — genau das ist gewollt.

Drei unabhängige Grenzen gegen Überfüllung:
- `bullet.maxActive: 5` — **harte Feuersperre, kein FIFO.** Sind fünf eigene
  Kugeln unterwegs, pausiert das Autofire, bis eine verschwindet.
- `enemyBullet.maxActive: 24` pro Raum, älteste zuerst
- Abprallerzahl bleibt der eigentliche Regler; das Wegbudget ist Sicherheitsnetz

**Warum keine FIFO-Verdrängung:** Mit Autofire wäre der Spieler dauerhaft am
Limit. Würde beim sechsten Schuss die älteste Kugel gelöscht, würde
ausgerechnet der sorgfältig gelegte Abprallschuss von den eigenen
Verlegenheitsschüssen aus dem Raum geräumt. Das würde den USP direkt
sabotieren. Die Sperre macht die Feuerrate stattdessen selbstregulierend und
gibt dem Spieler einen Grund, nicht dauerzufeuern.

In den letzten 15 % des Budgets blinkt die Kugel.

## E5 — Verworfen

| Was | Warum |
|-----|-------|
| Rammen / Kontaktschaden | Optimale Strategie wäre im Kreis fahren und abstreifen. Macht Winkel und Panzerung überflüssig, widerspricht der Blockier-Regel aus SPEC.md |
| Begleiter (Drohne, Geschützturm) | Automatischer Schaden entwertet das Zielen |
| Paktkarten, Tag `pact` | Waren Kosmetik statt Trade-off. Tag fliegt aus dem Schema |
| Modifikator `sudden_death` | Spiel ist bereits One-Hit-Kill, der Modifikator ändert nichts |
| Gegner mit mehreren Lebenspunkten | Macht Räume zäh statt schwer. Ersetzt durch gerichtete Panzerung |
| Türwahl mit zwei Türen | Bot nur Vorteile, war keine Entscheidung. Ersetzt durch Karte |
| Hälfte der reinen Stat-Upgrades | Karten, die man beim Ziehen nicht liest, sind verschwendete Auswahl |
| Meta-Progression | Bewusst zurückgestellt, nicht verworfen. → Kandidat **Phase 19** (noch nicht eingeplant), Entscheidung nach Stufe 3 |

---

# STUFE 0 — Fundament

## Phase 0 — Eingabe und Weichen  ✅ erledigt
**Aufwand:** 1–2 Sessions
**Neu in v2. Muss zuerst gebaut werden, weil drei spätere Phasen daran hängen.**

**Eingabe für alle drei Plattformen** nach E1, gleichzeitig gebaut — nicht
Mobile zuerst und Desktop später nachgerüstet, sonst wächst der Code an einer
Steuerung fest.

- Mobile: reines Autofire, `stick.deadzone: 0.15`, `player.fireRate: 1.2`
- Desktop: WASD + Maus, Linksklick gehalten = Autofire, Sekundärwaffe auf
  Leertaste
- Controller: Gamepad-API, zwei Sticks, rechter Trigger feuert, linker Trigger
  Sekundärwaffe
- `stick.twoZone: false` als Datenflag anlegen, Logik implementieren, aber
  ausgeschaltet lassen. Kostet jetzt zwanzig Minuten und später einen Umbau.
- Auflösungsskalierung und Pause-Funktion für Desktop

**Dauerhafte Ziellinie** nach E1: Linie vom Rohr bis zur ersten Wand plus
Vorschau des ersten Abprallwinkels. Grundspiel, abschaltbar in den Optionen.
Auf Mobile ist sie der Ersatz für ruhiges Zielen.

**Boss-Arena-Weiche** in `generator.js`: Ein Raumspec mit
`fixedLayout: "<name>"` lädt aus `data/arenas.json`, alles andere geht durch
den Kachelgenerator. Format als ASCII-Raster, 24 Zeichen × 16 Zeilen:

```json
"reactor_01": {
  "grid": ["########################", "#G....................G#", "..."],
  "legend": { "#": "wall", "M": "mirror", "G": "generator", "P": "spawn" }
}
```

Vom Handy editierbar, kein Editor nötig, Renderer bleibt unverändert. Inhalte
kommen erst in Phase 14 — jetzt wird nur die Weiche gebaut, weil sie später ein
Refactor wäre.

**RNG umstellen:** kein fortlaufender Zustand mehr. Pro Raum ein eigener
Generator aus `hash(seed, roomIndex)`. Zustandslos, korrekt fortsetzbar,
ermöglicht später geteilte Seeds und Replays.

**Fertig, wenn:** Zielen ohne Schießen funktioniert, ein `fixedLayout`-Testraum
lädt, zwei Runs mit gleichem Seed identische Räume erzeugen.

## Phase 1 — Telemetrie, Lesbarkeit, Speicherung  ✅ erledigt
**Aufwand:** 2 Sessions

**Telemetrie v2** (`src/core/telemetry.js`), `localStorage.runs`, max. 100
Einträge, Debug-Ansicht über `?debug=1`.

Run-Ebene: `schemaVersion` (int, hochzählen bei jeder Bedeutungsänderung),
`gameVersion`, Gerät, Auflösung, Seed, Zeitstempel, erreichter Raum,
Sekundärwaffe, gewählte und abgelehnte Upgrades in Reihenfolge.

Raum-Ebene: Dauer, verbleibende Leben, Schildladungen, `modifier`,
Gegnerzusammensetzung mit Affixen, `minFps`, `ricochetKills`, `directKills`,
`ghostKills`, `powershotsFired`, `secondaryUses`.

Tod: `cause`, `bulletOwner`, `bulletRicochets`, `bulletDistanceTravelled`,
Gegnertyp. Damit ist beantwortbar, ob ein ungesehener Querschläger getötet hat
oder ein sauberer Gegnerschuss — die Frage, an der diese Phase hängt.

**Die Debug-Ansicht rechnet die Kennzahlen selbst aus** und zeigt sie als
Tabelle. Ein JSON-Export, den du am Handy nirgends öffnen kannst, ist wertlos.
Export bleibt zusätzlich drin.

**Werte nach `data/balance.json`:**
- `bullet.speed: 200`, `bullet.maxDistance: 1200`
- `bullet.maxActive: 5`, `bullet.maxActiveCap: 8`, `enemyBullet.maxActive: 24`
- `bullet.selfImmunity: 0.35`
- `mine.fuse: 3.0`, `mine.radius: 64`, `mine.chainDelay: 0.15`,
  `mine.warningTime: 0.5`

**Darstellung:** Kugel nach erstem Abpraller sichtbar heller. Eigene Minen mit
pulsierendem Ring vor der Zündung.

**Run-Speicherung** unter `localStorage.currentRun`, geschrieben **beim
Betreten** eines Raums, nie mitten im Kampf: Seed, Raumindex, Leben,
Schildladungen mit Restlaufzeit, Schrott, Upgrade-`id`s, verbannte `id`s,
Sekundärslot, Kartenpfad, aktueller Knoten. Bei Tod löschen. Beim Start
"Run fortsetzen?" anbieten. Abbruch mitten im Raum startet den Raum neu.

## Phase 2 — Upgrade-Schema  ✅ erledigt (durch v1-Phase 2 abgedeckt)
**Aufwand:** 1 Session

Struktur, keine neuen Effekte.

Jeder Eintrag in `upgrades.json`: `id`, `tag`, `rarity`, `maxStacks`,
`requires`, `minRoom`, `description`.

Tags: `stat`, `weapon`, `secondary`, `defense`, `mobility`, `terrain`,
`control`, `information`, `scaling`, `synergy`, `reactive`, `resource`,
`elite`. (`pact` gestrichen.)

**Auswahllogik** (`src/game/upgradepool.js`): drei Karten, nie zwei mit
demselben Tag. Gewichte common 60 / rare 30 / legendary 10, Legendary ab
Raum 5. `maxStacks` und `requires` werden respektiert. Tags `weapon` und
`elite` außerhalb des normalen Pools. Kein Crash bei zu kleinem Pool — mit
`stat` auffüllen.

**Einziges neues Upgrade:** `emergency_shield`, Tag `defense`, rare,
`maxStacks: 3`. Insgesamt **3 Ladungen bei vollem Ausbau**
(`chargesPerStack: 1` × `maxStacks: 3`, mit Verfall nach `shield.roomLifetime`
geräumten Räumen laut E2) — v1 hatte hier noch 3 Ladungen *pro* Stufe (9
insgesamt), auf Nutzerwunsch auf 1 pro Stufe abgeschwächt.

**Tote Taxonomie-Einträge (Fund beim v3-Review):** Tag `resource` wird von
keiner der 39 Karten benutzt, `requires` ist bei allen 39 Karten `[]`. Beides
ist kein Bug — der Pool-Code (`upgradepool.js`) respektiert beide Felder
bereits, kostet also nichts, liegt nur brach. Erste Belegung: `resource` und
die erste `requires`-Kombo-Karte kommen sinnvollerweise mit der ersten
Kartenwelle in Phase 18 (siehe dort).

## Phase 3 — Schrott als Währung  ✅ erledigt (durch v1-Phase 3 abgedeckt)
**Aufwand:** 1 Session

Muss vor Stufe 1 stehen, weil die Trickshot-Belohnung Schrott ausschüttet.

`scrap.perRoom: [1,3]`, `eliteMult: 2` (multiplikativ auf den Raum-Schrott,
nicht additiv — im ursprünglichen Entwurf stand hier `eliteBonus: 3`, das
Feld heißt in `data/balance.json` aber `eliteMult`), `cost.reroll: 2`,
`cost.ban: 1`, `cost.fourthCard: 3`, `cost.shieldCharge: 4`.

Vier Aktionen im Upgrade-Screen mit sichtbarem Preis: neu würfeln, verbannen,
vierte Karte, Schildladung. Schrottstand permanent im HUD.

---

# STUFE 1 — Der USP

## Phase 4 — Gerichtete Panzerung  ✅ erledigt
**Aufwand:** 2 Sessions
**Die wichtigste Phase des Plans.**

Keine zusätzlichen Lebenspunkte. Die Trefferrichtung entscheidet.

**Frontpanzerung** (`armored`): `armor.arc: 120` Grad, sichtbar als dicker
Balken. Direkte Treffer prallen ab und folgen E3. Treffer von Seite oder hinten
töten. Ab Raum 4.

**Prisma-Panzer** (`prism`): reflektiert jeden Schuss zurück, stirbt nur an
Kugeln mit `ricochets >= 1`. Der Gegner, der dem Spieler das Spiel beibringt.
Ab Raum 6, anfangs höchstens einer pro Raum. Eigene Silhouette, nicht nur eine
andere Farbe.

Werte in `tanks.json`: `armor.arc`, `armor.reflects`, `requiresRicochet`.

**Die Panzerungsrichtung muss auf einem Handydisplay in einer Sekunde
erkennbar sein.** Lieber zu deutlich als zu elegant.

**Fertig, wenn:** ein Raum mit zwei Prisma-Panzern ohne Abprallschuss
nachweislich nicht lösbar ist.

## Phase 5 — Abprallen belohnen  ✅ erledigt
**Aufwand:** 1–2 Sessions

**Trickshot-Belohnung:** Kill mit `ricochets >= 1` gibt +1 Schrott, 0,15 s
Zeitlupe, eigener Sound. Bei `ricochets >= 2` deutlicher.

**Spiegelwände:** Kacheltyp in `tiles.json`, verbraucht keinen Abpraller,
optisch klar unterscheidbar. Generator platziert 2–4 Segmente pro Raum,
bevorzugt an Außenwänden.

**Powershot** — als Upgrade, nicht als Grundmechanik. Kein Halten, kein Laden,
keine zusätzliche Eingabe.

`powershot`, Tag `reactive` (**nicht** `weapon`, siehe unten), rare,
`maxStacks: 3`. Beim Betreten eines Raums sind `powershot.perRoom: 1` Schuss
geladen (pro Stack einer mehr). Der **erste abgefeuerte Schuss** im Raum ist
automatisch der Powershot: `powershot.bonusRicochets: 2`,
`powershot.speedFactor: 2.0`, Reichweite unverändert (E4).

**Umsetzungsfund:** Tag `weapon` ist in `upgradepool.js` explizit vom Pool
ausgeschlossen (reserviert für Phase 18, siehe PLAN.md v3 Fund #4) — mit
`weapon` wäre Powershot in dieser Phase für Spieler unerreichbar gewesen.
Deshalb Tag `reactive`, passt inhaltlich (automatischer Bonus bei Trigger,
wie `sprengschuss`/`zielsucher`).

Der geladene Schuss ist am Rohr sichtbar, solange er vorhanden ist.

**Ehrliche Einordnung:** Mit reinem Autofire (E1) lässt sich der Powershot
nicht aufsparen — er geht raus, sobald der Stick das erste Mal ausgelenkt
wird. Er ist damit ein passiver Eröffnungsbonus, keine taktische Entscheidung.
Das ist in Ordnung, aber er trägt weniger zum Spielgefühl bei als geplant.
Entsprechend niedrig einstufen: rare, nicht legendary.

Bewusst **nicht** über Kills oder Feuerpausen nachladbar. Eine Aufladung durch
Feuerpause wäre der Ladungsschuss durch die Hintertür.

**Betroffene Dateien:** `data/balance.json` (Trickshot-Werte), `data/tiles.json`
+ `src/game/generator.js` (Spiegelwand-Kacheltyp + Platzierung), `data/upgrades.json`
(`powershot`), `src/game/tank.js` (`fireBullet` — erster Schuss im Raum markieren),
`src/game/cfg.js` (Powershot-Effekt anwenden), `src/render/renderer.js`
(geladener Schuss am Rohr sichtbar), `src/core/telemetry.js` (`powershotsFired`
ist als Feld schon vorbereitet).

## Phase 6 — Sekundärslot  ✅ erledigt
**Aufwand:** 2 Sessions

**Umsetzungsfunde** (Abweichungen von der Ausgangsbeschreibung, siehe
`CLAUDE.md` für Details): Turm-Einfrieren braucht ein NEUES Feld
(`turretStunTimer`), nicht das bestehende `stunTimer` — sonst hätte das
die bewusste Krallenfalle-Eigenschaft "Turm bleibt nutzbar" gebrochen.
Ausrüsten läuft über ein explizites `run.equippedSecondary`-Feld (nicht
über einen Level-Scan der sechs Karten), da mehrere Sekundärkarten
gleichzeitig Level > 0 haben können. `emp_mine` teilt sich die
Legemechanik 1:1 mit `mine` (kein zweiter Button), die vier neuen
Sekundärwaffen teilen sich stattdessen einen generischen
`secondaryCooldown`. `trap_wall` nutzt die bestehende
`destroyWall()`-Haltbarkeit wieder (neues Feld `wall.customDurability`),
statt eine zweite Zähllogik zu bauen.

Die Mine wird von der festen Zweitwaffe zu einer Option von sechs. Ein Slot,
per Upgrade austauschbar, eigener Cooldown, bestehender Knopf.
Alle Werte in `data/secondaries.json`. Tag `secondary`, `maxStacks: 1`.

- `mine` — Startbelegung
- `emp_mine` — jede 4. Mine ist blau: kein Schaden, `stunRadius: 96`,
  `stunDuration: 1.5`. Betäubte Gegner drehen den Turm nicht, blockieren aber
  weiter Geschosse. Nimmt an Kettenreaktionen nicht teil. Zähler im HUD.
- `hook` — Enterhaken, zieht dich zur getroffenen Wand
- `deflector` — 1,5 s aktiv, reflektiert einen Treffer in Blickrichtung, zählt
  als Abprallschuss gegen Prisma-Panzer
- `smoke` — unterbricht Sichtlinien für 4 s
- `trap_wall` — Wand, die 3 Schüsse hält, erzeugt eigene Bankshot-Winkel

**Betroffene Dateien:** `data/secondaries.json` (neu), `src/game/tank.js`
(`layMine` wird zum generischen Sekundär-Dispatch), `src/core/input.js`
(`secondary`/`secondaryThrow` sind bereits Teil des Eingabezustands, keine
Änderung nötig), `data/upgrades.json` (Tag `secondary`, `maxStacks: 1`),
`src/render/renderer.js` + `src/render/effects.js` (je Sekundärwaffe eigenes
Overlay). **Hinweis für Phase 4:** `deflector` reflektiert einen Treffer und
soll gegen Prisma-Panzer als Abprallschuss zählen — dafür `b.wallBounces`
erhöhen (nicht `b.reflected` setzen), sonst greift `requiresRicochet` nicht.

## Phase 7 — Geisterpanzer  ✅ erledigt
**Aufwand:** 1 Session
(Rammen gestrichen, siehe E5.)

Getötete Gegner kämpfen `ghost.duration: 3.0` s als durchscheinender
Verbündeter weiter und zielen automatisch auf den nächsten Gegner. Jeder Kill
des Geistes verlängert um `ghost.killBonus: 1.0`. Kettenreaktionen sind das
Ziel. Geister blockieren keine Kugeln, sind nicht tötbar,
`ghost.maxActive: 4`.

Upgrade `ghost_crew`, Tag `reactive`, legendary.

**Betroffene Dateien:** `data/balance.json` (`ghost.duration`,
`ghost.killBonus`, `ghost.maxActive`), `src/game/state.js` (Geister-Liste,
`killTank`-Hook), `src/game/ai.js`/`ai_turrets.js` (automatisches Zielen des
Geistes auf den nächsten Gegner), `src/render/renderer.js` (durchscheinende
Darstellung), `src/core/telemetry.js` (`ghostKills` ist als Feld schon
vorbereitet).

**Umsetzungsfund:** Geister sind bewusst KEINE Einträge in `state.tanks`,
sondern ein eigenes `src/game/ghost.js`-Modul mit eigenem `state.ghosts`-
Array (Muster wie `mine.js`/`trap.js`) — dadurch erfüllen sie "blockieren
keine Kugeln, sind nicht tötbar" automatisch durch Konstruktion, ohne
Sonderfälle in der bestehenden Treffer-Schleife. `ai_turrets.js`/
`ai_drives.js` bleiben unangetastet (die zielen strukturell fest auf
`state.player`); ein Geist zielt stattdessen über eine eigene, einfache
"nächster lebender Gegner"-Suche in `ghost.js`, die `angleDiff`/`turnToward`/
`clearLine` aus `ai.js` wiederverwendet.

## Phase 7b — Audio
**Aufwand:** 1 Session
**Neu in v2.**

**Korrektur (v3-Review):** Die Begründung "steht hier, weil Phase 5 auf einem
Sound beruht" stimmt nicht — die prozedurale WebAudio-Synthese
(`src/core/audio.js`, `beep`/`noise`, kein Asset, Unlock nach erster
Berührung) läuft schon seit Phase 0 und wächst seither einfach mit: jede neue
Phase hängt ihren Sound in den bestehenden `play(name)`-Switch ein (Phase 4
hat für die Prisma-Reflexion genau das getan — Wiederverwendung von
`'shield'`, kein Warten auf diese Phase). Phase 5 kann seinen Trickshot-Sound
genauso ergänzen. Diese Phase ist der Zeitpunkt, an dem der gewachsene
`if/else`-Switch in eine echte `data/sounds.json` überführt wird (Wellenform,
Frequenzverlauf, Dauer, Filter — vom Handy tunbar), keine Blockade davor.

Reihenfolge nach Informationswert:
1. Eigener Abpraller-Tick — ab hier ist die Kugel gefährlich (schon da: `'tick'`)
2. Prisma-Reflexion (schon da: reflectBullet() spielt `'shield'`)
3. Gegnerschuss mit Stereopanning nach Position (neu — aktuell nur ein
   Mono-Kanal über `master`)
4. Minen-Warnpuls (neu — aktuell nur ein `'mine'`-Sound beim Legen, kein
   wiederholter Puls vor der Zündung)
5. Trickshot-Kill, deutlich anders als normaler Kill (neu, siehe Phase 5)
6. Leben verloren und Schild verloren — zwingend zwei verschiedene Sounds
7. Raum geräumt, Upgrade gewählt (schon da: `'clear'`, kein eigener
   Upgrade-Sound)

**Bekannter Fehler, der hier als Abnahmekriterium gehört:** `killTank()` in
`src/game/state.js` spielt aktuell für JEDEN Tod denselben `'death'`-Sound —
ein Gegner-Kill klingt identisch zum eigenen Tod. Schild-Verlust hat schon
einen eigenen Sound (`'shield'`, die drei frühen `return`-Zweige in
`killTank`), Leben-Verlust vs. Gegner-Kill aber nicht. Erst wenn diese beiden
unterscheidbar sind, gilt Punkt 6 der Liste als erledigt.

WebAudio-Unlock nach erster Berührung nicht vergessen (schon vorhanden).
**Jede Information per Ton braucht ein sichtbares Gegenstück** — viele spielen
stumm. Der Abpraller-Tick hat es bereits, die Prisma-Reflexion braucht einen
Blitz.

**Betroffene Dateien:** `data/sounds.json` (neu), `src/core/audio.js`
(`play()`-Switch durch datengetriebenen Aufruf ersetzen, `StereoPannerNode`
ergänzen), `src/game/state.js` (`killTank` — Todesursache statt pauschal
`'death'` an den Sound-Namen übergeben).

---

# STUFE 2 — Wiederspielbarkeit

## Phase 8 — Gegner-Rollen statt Gegner-Typen  ✅ erledigt
**Aufwand:** 2 Sessions

Rolle plus Werte in `tanks.json`, nicht pro Gegner neu programmiert. Rolle und
Panzerung sind frei kombinierbar.

- `hunter` — sucht Nähe, schießt direkt
- `sieger` — hält Distanz, schießt **ausschließlich** Bankshots
- `sapper` — legt Minen, flieht vor dir
- `guardian` — verlässt seine Zone nie, schießt weit

Je Rolle: `aggression`, `preferredRange`, `fireRate`, `accuracy`.

**Größtenteils ein Refactor, kein Neubau (Fund beim v3-Review):**
`src/game/ai_drives.js` deckt die vier Rollen schon verhaltensähnlich ab —
`evade` ≈ `sieger` (hält Distanz), `wander` + `miner` ≈ `sapper` (legt Minen,
weicht aus), `none` ≈ `guardian` (verlässt die Zone nie), `hunt`/`pursue` ≈
`hunter` (sucht Nähe). Phase 8 konsolidiert das in ein datengetriebenes
Rollen-Schema statt pro Typ eigenen Code zu behalten — kein neues Verhalten.
Panzerung (`armor`/`requiresRicochet`) bleibt orthogonal dazu, wie schon bei
`t_armored`/`t_prism`.

**Betroffene Dateien:** `data/tanks.json` (Rolle statt `turret`+`drive` pro
Typ), `src/game/ai_drives.js` + `ai_turrets.js` (auf Rollenparameter
umstellen), `src/game/ai.js` (Dispatch).

**Umsetzungsfunde:**
- `bounce_solver` (Abpraller-Rechner) war in `ai_turrets.js` bereits gebaut,
  aber von KEINEM Typ referenziert — die "sieger schießt ausschließlich
  Bankshots"-Fähigkeit ist jetzt als orthogonales Sonderverhalten
  `requiresBounceShot` erhalten (funktioniert, testweise geprüft), aber
  bewusst keinem aktuellen Typ zugewiesen: t_teal/t_black (≈ sieger laut
  v3-Review) schießen heute direkt bzw. mit Vorhalt, nicht ausschließlich per
  Bankshot — das umzustellen wäre echtes neues Verhalten gewesen.
- `accuracy` (0–1) ersetzt die vier diskreten Turm-Stufen
  (`random_seek`/`weak_aim`/`aim`/`strong_aim`) durch einen Regler:
  `accuracy 0` = rein zufälliger Schwenk ohne Spieler-Tracking (t_brown),
  `< 0.3` = zielt mit grobem Fehler, feuert auch ohne Sichtlinie (frühere
  `weak_aim`-Typen), `≥ 0.3` = präzise, braucht Sichtlinie (frühere
  `aim`/`strong_aim`-Typen). `leadAim` (Vorhaltezielen, früher `predict`,
  nur t_black) und `packFlank` (Rudel-Flankierung ohne Sichtlinie, früher
  `purple_pack`, nur t_purple) bleiben als eigene, orthogonale
  Sonderverhalten erhalten — echte Algorithmen, keine Regler-Werte.
- t_white (`white_phase`) wechselt jetzt generisch zwischen zwei ganzen
  ROLLEN (`phaseToggle: { roles: ["sieger","hunter"] }`) statt zwischen zwei
  hartkodierten Fahrfunktionen — dieselbe Umschalt-/Ton-Logik, aber als
  wiederverwendbarer Mechanismus für künftige Typen.
- Validiert über die bestehende 40-Seed-Regressionssuite (`phase4.mjs`):
  40/40 Siege, 0 Hänger — die Konsolidierung ändert die Gewinnbarkeit nicht.

## Phase 9 — Elite-Affixe, Wellen, Elite-Belohnung  ✅ erledigt
**Aufwand:** 2 Sessions

**Baut auf einem bereits bestehenden System auf (Fund beim v3-Review) —
nicht neu erfinden:** Elite-Affixe gibt es schon
(`data/difficulty.json: elite.affixes`, angewendet in `applyEliteAffix()` in
`run.js`): `gepanzert` (Schild-Ladung), `rasend` (+35 % Tempo),
`brandstifter` (+2 Minen). Das deckt `armored_elite`, `swift` und `minelayer`
inhaltlich bereits ab — **nicht umbenennen oder duplizieren.** Wirklich neu
hinzuzufügen sind nur:

- `twinshot` — Gegner feuert zwei Kugeln gleichzeitig statt einer
- `regenerating_shield` — **nur als Elite-Affix und nur auf dem billigsten und
  dem teuersten Panzer** der KI-Auswahl. Als Ladung mit sichtbarem Ring, nicht
  als verstecktes Lebenspolster — sonst widerspricht er der Kernentscheidung
  gegen Lebenspunkte. (Einziger Affix, der wirklich neuen Code braucht: eine
  Ladung, die sich zwischen Räumen regeneriert statt zu verfallen — das
  Gegenstück zu Schild-Verfall bei E2.)

Kombinierbar, sichtbar als Farbring. Ab Raum 8 einer pro Raum, ab Raum 14 zwei.

**Elite-Belohnung — Korrektur (v3-Review):** Der bereits gebaute Code
(`rollReward()` in `run.js`) ERSETZT die normale Dreierauswahl komplett durch
den Elite-Pool, sobald `rewardKind === 'elite'`. Bei nur zwei bis drei
Elite-Karten ist das die schlechtere Wahl (weniger Auswahl als eine normale
Runde, ständiger `stat`-Fallback für den fehlenden dritten Slot). **Auf ein
additives Modell umstellen:** Die normale Dreierauswahl bleibt unverändert,
zusätzlich wird automatisch (ohne Schrottkosten) eine vierte Karte aus dem
Tag `elite` gezogen — dieselbe `upgradepool.drawOne()`-Funktion, die
`buyFourthCard` schon nutzt, nur mit `includeTag: 'elite'` statt Schrottpreis.
In Phase 12 ändert sich nur der Auslöser auf "Knotentyp ist `elite`".

Elite-Karten: `trophaee`, `kriegsmaschine`. **`beutepanzer` (aus v1) existiert
nicht mehr** — der Begleitpanzer wurde im E5-Rückbau komplett gestrichen
(`cfg.drone`, `updateDrone`, Rendering). Mit nur zwei Karten wiederholt sich
die Elite-Belohnung ab Raum 4 (erster möglicher Eliteraum) schnell — **vor
dieser Phase mindestens eine dritte Elite-Karte ergänzen.**

**Wellen:** große Räume spawnen in zwei Schüben, zweite Welle bei 50 %
Restgegnern, Spawnpunkte mit 1 s Vorwarnung.

**Betroffene Dateien:** `data/difficulty.json` (`elite.affixes` um
`twinshot`/`regenerating_shield` erweitern), `data/upgrades.json` (dritte
Elite-Karte), `src/game/run.js` (`applyEliteAffix`, `rollReward` auf additiv
umstellen), `src/game/tank.js` (Twinshot-Feuerlogik), `src/game/state.js`
(Wellen-Spawn), `src/render/effects.js` (Farbring je Affix).

**Umsetzungsfunde:**
- `twinshot` braucht in `tank.js` **keine neue Feuerlogik** — die
  bestehenden Felder `cfg.twinShot`/`cfg.twinSpreadRad` (Spieler-Upgrade
  "Doppelrohr") werden in `fireBullet()` bereits generisch von `tank.cfg`
  gelesen, ohne Spieler-Sonderfall. Für den Affix genügt es, dieselben
  Felder auf dem betroffenen Gegner zu setzen; einzige echte Ergänzung war
  ein Magazin-Mindestwert von 2 (sonst wäre nach der ersten der beiden
  Kugeln schon kein Platz mehr für die zweite).
- Farbring-Darstellung liegt bewusst in `renderer.js` (nicht
  `effects.js`) — Muster wie `drawSmoke`/`drawGhosts` aus Phase 6/7: kleine
  Farbpunkte im Bogen über dem Panzer, ein Punkt pro aktivem Affix (auch
  bei zwei kombinierten ab Raum 14).
- Die Affix-**Rezeptur** (gewürfelte Affixe + Index des günstigsten/
  teuersten Gegners) wird in `run.js` **vor** `createState()` über die
  Typliste bestimmt und unverändert an `state.js` durchgereicht
  (`eliteAffixes`), statt sie direkt auf die erzeugten Tank-Objekte
  anzuwenden — sonst hätte die per Welle (siehe unten) später
  nachspawnende zweite Hälfte des Raums keinen Affix bekommen.
- Wellen sind ebenfalls index-basiert gebaut: `generateRoom()` erzeugt
  weiter die volle Spawnpunkt-Zahl, `createState()` instanziiert nur die
  erste Hälfte (`waveSplit`) und hält den Rest in `state.pendingWave`
  zurück (Typen + bereits vorhandene Spawnpunkte). `updateWave()` in
  `state.js` löst bei ≤50 % lebender Welle-1-Gegner die 1-s-Vorwarnung aus
  und spawnt danach die zweite Welle — mit derselben Affix-Rezeptur.
- `regenerating_shield` lädt sich nach `regenS` Sekunden neu auf (neues
  Feld `regenShieldTimer`, gestartet beim Verbrauch der Ladung in
  `killTank()`, herunterzählend im bestehenden Tank-Tick-Loop) — echtes
  Gegenstück zum Schild-Verfall des Spielers (E2), kein Neubau einer
  zweiten Ladungs-Verwaltung.
- Dritte Elite-Karte: `kriegsbeute` (sofort +5 Schrott) — bewusst eine rein
  ökonomische Belohnung statt einer weiteren Kampfstat, um nicht mit
  bestehenden harten Obergrenzen (z. B. Abpraller-Deckel 2) zu kollidieren.
- Neuer Sound `'wave'` in `audio.js` (zwei kurze, drohende Töne) statt des
  bestehenden `'clear'`-Jingles — Letzteres wäre am Ankunftspunkt einer
  zweiten Welle das falsche Signal (klingt nach "Raum geschafft").

## Phase 10 — Raum-Modifikatoren  ✅ erledigt
**Aufwand:** 1 Session, höchster Ertrag pro Aufwand

Vor dem Betreten sichtbar, `data/modifiers.json`, ab Raum 3, einer pro Raum.

`fog`, `jammer` (Kugeln 30 % langsamer), `overpressure` (+1 Abpraller für
alle), `darkness`, `slippery`, `crowded` (+50 % Gegner, −30 % Aggression),
`sniper_alley` (alle Gegner `sieger`), `no_secondary`, `mirror_hall` (alle
Wände sind Spiegelwände).

**Betroffene Dateien:** `data/modifiers.json` (neu), `src/game/run.js`
(Modifikator pro Raum ziehen + in die Vorschau reichen), `src/ui/preview.js`
(vor dem Betreten sichtbar), `src/game/state.js`/`cfg.js` (Modifikator auf
Kugeltempo/Aggression/Sichtfeld anwenden).

**Umsetzungsfunde:**
- Eigener RNG-Strom `modifiers` (`hash(seed, roomIndex, 'modifiers')`) in
  `makeRoomStreams()` — Muster wie bei allen anderen Strömen: eine Änderung
  am Modifikator-System verschiebt keinen anderen Raumaufbau.
- Der Finalraum bleibt bewusst ohne Modifikator (`isFinal ? null :
  rollRoomModifier(run)`), gleiches Prinzip wie der Wellen-Ausschluss in
  Phase 9 — der handgebaute 2×t_black-Encounter soll wie geplant bleiben.
- `jammer`/`overpressure` wirken über eine neue, symmetrische Funktion
  `applyRoomModifier(cfg, modifier, isPlayer)` in `cfg.js` **auf Spieler UND
  Gegner gleichermaßen** (nach `resolveCfg()`/`applyUpgrades()`, in
  `createState()`, `respawnPlayer()` UND `updateWave()` — überall dort, wo
  ein Tank-cfg neu aufgelöst wird). `crowded` (Aggression) und
  `sniper_alley` (Rollen-Override) betreffen dagegen nur Gegner-cfgs
  (`isPlayer=false`-Zweig), `no_secondary` nur den Spieler.
- `no_secondary` setzt `cfg.secondaryDisabled = true` statt
  `cfg.secondary = null` — sonst würde `useSecondary()`s
  `tank.cfg.secondary || 'mine'`-Fallback die Sperre wieder aufheben.
  `useSecondary()` prüft das Flag als allererstes und gibt `false` zurück.
- `mirror_hall` konvertiert in `createState()` nach `buildWalls()` nur
  Wände vom Typ `solid` zu `reflect` — **durchschießbare (`breakable`)
  Wände bleiben unangetastet**, sonst wäre die Wandzerstörungs-Mechanik im
  ganzen Raum entwertet. Nutzt exakt denselben `wall.type === 'reflect'`-
  Mechanismus wie die Spiegelwände aus Phase 5 (`bullet.js` unverändert).
- `slippery` (Glatteis) ist keine reine Renderer-Kosmetik, sondern echte
  Bewegungsphysik: `moveTank()` in `tank.js` bekommt einen neuen Zweig, der
  bei `state.modifier?.slippery` die tatsächliche Geschwindigkeit
  (`tank.iceVx/iceVy`, neue Felder) nur allmählich der Eingabe angleicht
  (`gripPerSec` aus `data/modifiers.json`) statt sie pro Tick hart zu
  setzen — betrifft dadurch automatisch ALLE Panzer (Spieler + Gegner),
  ohne die vier KI-Verhalten in `ai_drives.js` anfassen zu müssen.
- `fog`/`darkness` sind bewusst **rein optisch** (neue Funktion `drawFog()`
  in `renderer.js`: Radialgradient um den interpolierten Spielerort,
  transparent im Kern → `fogColor` am Rand, in `render()` ganz zuletzt
  gezeichnet). Die KI-Sichtprüfungen (`clearLine()`/`blocksSight()`) bleiben
  unverändert — die beiden Modifikatoren sollen die Sicht des SPIELERS
  einschränken, nicht die Zielgenauigkeit der Gegner-KI verändern (dafür
  gibt es mit `accuracy` aus Phase 8 bereits einen eigenen Regler).
- Vorschau-Zeile analog zum Elite-Affix: `preview.js` bekommt ein neues
  `opts.modifierLine` (eigener Absatz `.pv-mod`), von `main.js` aus
  `run.roomModifier.name`/`.desc` gebaut — sichtbar, bevor der Raum
  betreten wird, wie in `PLAN.md` gefordert.
- `run.roomModifier` landet NICHT in `runSnapshot()` (wie schon
  `roomAffix`/`roomAffixes` vorher nicht) — beim Fortsetzen erzeugt
  derselbe Seed + dieselbe Raumnummer über den `modifiers`-Stream
  deterministisch wieder denselben Modifikator, ein Persistieren wäre
  redundant.
- Telemetrie-Feld `modifier` war bereits seit Phase 3 als Platzhalter in
  `telemetry.js: recordRoom()` vorbereitet (`r.modifier || null`) — nur
  `main.js` musste es tatsächlich befüllen (`teleModifier`, gleiches Muster
  wie `teleGhosts`/`teleSecondary`).

## Phase 11 — Zerstörbare Wände  ✅ erledigt
**Aufwand:** 1 Session

`wall.destructible.hits: 3`. Die Arena verändert sich im Kampf. Anteil pro Raum
aus `difficulty.json`. Flood-Fill muss auch nach Zerstörung gelten — Wände,
deren Wegfall den Raum unlösbar macht, sind nicht zerstörbar.

**Wiederverwendung (Fund beim v3-Review):** `state.destroyWall()` in
`src/game/state.js` trägt bereits einen `wall.hits`/`durability`-Zähler
(gebaut für die Baumeister-Transformation, Phase 17). Phase 11 muss
`durability` nur generisch aus `wall.destructible.hits` lesen, statt
ausschließlich aus `state.transform.wallDurability` — kein Parallelsystem
bauen.

**Betroffene Dateien:** `data/difficulty.json` (Anteil zerstörbarer Wände pro
Raum), `src/game/generator.js` (Flood-Fill-Check nach Zerstörung), `src/game/state.js`
(`destroyWall` generalisieren).

**Umsetzungsfunde:**
- Kein separater "Wegfall macht unlösbar"-Check nötig: Zerstörbare Zellen
  sind vor dem Zerstören exakt so blockierend wie eine normale `solid`-Wand
  (gleiche `isSolid()`/`hasLos()`-Behandlung), die bestehende Flood-Fill-
  Prüfung beim Raumbau (`placeSpawns()`) gilt also bereits FÜR den Zustand
  "alle zerstörbaren Wände noch intakt". Da Zerstören eine Wandzelle immer
  nur in Boden verwandelt (nie umgekehrt), kann Erreichbarkeit dadurch nur
  gleich bleiben oder besser werden, nie schlechter — kein zweiter,
  laufzeitgeprüfter Check nötig (per Test in `phase11walls.mjs` verifiziert:
  Fläche nach dem Abbau ALLER zerstörbaren Wände eines Raums ist immer ≥
  vorher, alle Gegner-Spawns bleiben erreichbar).
- Neues Grid-Zeichen `'d'` (state.js: `WALL_TYPES` bekommt
  `d: 'destructible'`) statt eines Flags auf `'#'` — physisch identisch zu
  `solid` (`isSolid()`, `hasLos()` in `generator.js` behandeln `'d'` genauso
  wie `'#'`), aber ein eigener `type`, damit `bullet.js`/`mine.js` sie gezielt
  ansprechen können, ohne jede `solid`-Wand plötzlich beschießbar zu machen.
- Platzierung lebt in `generator.js: placeDestructibleWalls()`, direkt neben
  `placeReflectWalls()` in `buildGrid()` — reine Umetikettierung
  vorhandener innerer `solid`-Zellen (Rand bleibt immer geschlossen), ändert
  den Gesamt-Wandanteil (`wallShare()`-Prüfung 15–35 %) nicht.
- `destroyWall()` (schon für Baumeister-Transformation/Sperrmauer gebaut)
  liest die Haltbarkeit jetzt über eine dritte Quelle:
  `wall.customDurability || wall.destructibleHits || state.transform
  .wallDurability || 1` — kein Parallelsystem, exakt wie im Fund notiert.
- **Explosionen zählen als EIN Treffer**, keine Sonderregel für mehr
  Schaden: `mine.js: explodeAt()` ruft für `destructible`-Wände dieselbe
  `destroyWall()` wie für einen einzelnen Kugeltreffer auf (genau wie
  `breakable`-Wände es für Tungsten-Kugeln schon tun) — konsistent statt
  eigens balanciert.
- **Run.js musste zusätzlich angefasst werden** (im Plan nicht in
  "Betroffene Dateien" gelistet): `buildCombatRoom()` reicht
  `difficulty.destructibleWalls` als neuen `createState()`-Opt durch, exakt
  nach demselben Muster wie `modifier`/`eliteAffixes`/`waveCfg` in Phase
  9/10. Kein `isFinal`-Sonderfall nötig — `generateRoom()`s
  `fixedLayout`-Zweig und der direkte `buildFixedRoom()`-Aufruf für den
  Finalraum ignorieren den Parameter ohnehin (kein `buildGrid()`-Aufruf).
- Darstellung: eigener Rissе-Overlay wie bei der Sperrmauer (Phase 6), aber
  schon im unbeschädigten Zustand schwach sichtbar (kein `frac === 1`-
  Unsichtbarkeits-Fall wie bei der Sperrmauer) — sonst wäre die ganze
  Mechanik unentdeckbar, da zerstörbare Wände sonst wie normale Wände
  aussehen.

## Phase 11b — Performance-Budget  ✅ erledigt
**Aufwand:** 1 Session
**Neu in v2.**

Feste Obergrenzen in `data/limits.json`, im Debug-Modus sichtbar:

| Entität | Cap |
|---|---|
| Gegner gleichzeitig | 12 |
| Spielergeschosse | 5 |
| Gegnergeschosse | 24 |
| Minen | 8 |
| Geister | 4 |
| Partikel | 300 |

Frame-Budget 16,6 ms: Logik ≤ 6 ms, Rendering ≤ 6 ms, Rest Puffer.
FPS-Zähler und schlechtester Frame pro Raum im Debug-Modus, `minFps` in die
Telemetrie.

Kollision ist unkritisch (30 Kugeln × 12 Panzer = 360 Prüfungen pro Frame).
Der Risikopunkt ist die Sichtlinien-KI aus Phase 16.

**Umsetzungsfunde:**
- **Drei der sechs Zeilen waren schon durchgesetzt, bevor diese Phase begann**
  (`balance.json: bullet.maxActiveCap` 8, `enemyBullet.maxActive` 24,
  `ghost.maxActive` 4 aus Phase 1/7) — `data/limits.json` (neu) enthält
  deshalb bewusst NUR die drei wirklich neuen Deckel (`enemiesAlive: 12`,
  `mines: 8`, `particles: 300`). Die Debug-Tabelle liest die anderen drei
  Werte direkt aus `balance.json` mit — kein Parallelsystem, jeder Wert hat
  genau eine Quelle. ("Spielergeschosse: 5" aus der PLAN-Tabelle ist der
  Basis-Magazinwert `bullet.maxActive`, nicht die Performance-Obergrenze;
  die tatsaechlich harte Sicherheitsgrenze ist `bullet.maxActiveCap` 8 --
  in der Debug-Zeile steht deshalb der Cap-Wert.)
- **`particles`-Deckel war schon vorhanden, aber hartcodiert** (`if (state
  .particles.length > 280) return;` in `state.js: spawnParticles()`) --
  jetzt `state.data.limits?.particles ?? 300` (Fallback fuer Aufrufe ohne
  geladene `limits`-Daten, z. B. isolierte Tests).
- **`enemiesAlive`-Deckel ist ein reines Sicherheitsnetz**, kein aktives
  Gameplay-Element: Budget-Kauf (`maxEnemiesPerRoom: 8`) und der
  Finalraum (6 Spawnpunkte) bleiben schon unter 12. Guard in
  `createState()`s Spawn-Schleife und `updateWave()`s Welle-2-Schleife
  (`if (tanks.length - 1 >= enemyCap) return;`) -- greift im normalen
  Spiel nie, verhindert aber unbegrenztes Wachstum, falls ein kuenftiges
  System (neuer Raumtyp, Bug) das je aushebeln wuerde.
- **`mines`-Deckel ist als EIN gemeinsames Budget** (Spieler- + Gegner-Minen
  zusammen) umgesetzt, nicht wie beim Gegner-Geschoss-Deckel als reiner
  Gegner-Teilmengen-Deckel -- PLAN.md fuehrt Minen als eine einzige Tabellen-
  zeile statt (wie bei Geschossen) getrennt nach Spieler/Gegner. Verdraengt
  wird trotzdem nur von GEGNER-Minen (aeltestes zuerst); eigene
  (Spieler-)Minen werden nie entfernt, dieselbe Asymmetrie wie beim
  Gegner-Geschoss-Deckel seit Phase 1 ("Feuersperre statt Verdraengung").
- **Logik-/Render-Zeitmessung ohne Eingriff in `core/loop.js`**: `main.js`
  wickelt `update`/`render` in `timedUpdate`/`timedRender` (Summe aller
  `update()`-Aufrufe pro echtem Frame plus ein `render()`-Aufruf, je per
  `performance.now()`), haelt `worstLogicMs`/`worstRenderMs` als raum-
  lokales Maximum (Reset in `resetRoomTelemetry()`, analog zu `teleMinFps`
  seit Phase 1). Bewusst NICHT Teil der Telemetrie -- die hat mit `minFps`
  schon ihre eigene, persistierte FPS-Kennzahl; die neuen Werte sind reine
  Debug-Anzeige (`?debug=1` UND F1-Overlay).
- **FPS-Zaehler + `minFps` in der Telemetrie existierten schon seit Phase 1**
  (`main.js`s 500-ms-Fenster + `telemetry.recordRoom()`), diese Phase hat
  daran nichts geaendert -- nur `debug.js`s F1-Overlay bekam die neue
  Deckel-Tabelle + die beiden Logik-/Render-ms-Zeilen dazu.

---

# STUFE 3 — Struktur

## Phase 12 — Roguelike-Karte  ✅ erledigt
**Aufwand:** 2–3 Sessions

12–15 Knoten, 3 Pfade, sichtbare Symbole, Zusammenläufe, Boss am Ende. Seeded,
vollständig vorab einsehbar.

**Regel für jeden Knoten: sichtbares Risiko und sichtbare Belohnung.** Ein
Pfad, der nicht wehtun kann, ist Dekoration.

- `combat` — Standard
- `elite` — höheres Budget, garantierter Affix, doppelter Schrott, einzige
  Quelle für Tag `elite`
- `treasure` — keine Gegner, garantiertes Legendary, **kostet 1 Leben**;
  nicht wählbar bei einem verbleibenden Leben
- `shop` — Phase 13
- `event` — Textentscheidung mit zwei Optionen aus `data/events.json`
- `cursed` — Gegner bekommen einen zusätzlichen Affix, dafür garantiertes
  Legendary

Raum 1–2 immer `combat`.

**Größtenteils Navigation, kein Raumtyp-Neubau (Fund beim v3-Review):** Die
Knotentypen `combat`/`elite`/`treasure`/`workshop`(≙ zukünftig `shop`,
Phase 13)/`event` sind inhaltlich bereits fertig und laufen seit den
v1-Phasen — `rollNextType()` in `run.js` wählt heute nur unsichtbar und
automatisch den nächsten Raumtyp (inkl. der Regeln "kein `treasure` bei 1
Leben", "kein `event`/`workshop` zweimal hintereinander"). Phase 12 ersetzt
**ausschließlich** diese Automatik durch eine sichtbare, wählbare Knotenkarte
— die Raumlogik jedes Typs bleibt unverändert. Wirklich neu ist nur `cursed`
(und `shop` als Erweiterung der Werkstatt, siehe Phase 13). Der Aufwand liegt
damit überwiegend in Kartenlayout/Generator/UI, nicht in neuer Spiellogik.

**Betroffene Dateien:** `src/game/run.js` (`rollNextType`/`afterRoomDone`
durch Kartennavigation ersetzen, restliche Raumlogik unverändert lassen),
neue `src/ui/mapscreen.js` (Kartenanzeige + Knotenwahl), `src/core/rng.js`
(zusätzlicher `map`-Strom für die Kartengenerierung).

**Umsetzungsfunde:**
- **Karte ist ein DAG aus Reihen** (`generateMap()` in `run.js`): Reihe 1+2
  je ein einzelner erzwungener `combat`-Knoten (`data/difficulty.json:
  map.forcedCombatLayers`), Reihen 3–15 mit 2–3 Knoten (`map.minNodesPerLayer`
  /`maxNodesPerLayer`), letzte Reihe ein einzelner Boss-Knoten
  (`isBoss: true`, Typ trotzdem `combat` — der Finalraum-Sonderfall in
  `buildCombatRoom()` bleibt unverändert). Kantenaufbau (`connectLayers()`):
  1-Knoten-Reihen verbinden sich mit ALLEN Knoten der Nachbarreihe
  (Fächer-aus/-ein, deckt Raum 1→2, 2→3 UND die geforderten "Zusammenläufe"
  vor dem Boss ab); sonst je Knoten eine proportionale Hauptkante plus mit
  `map.extraEdgeChance` (40 %) eine Nebenkante, danach ein Nachreich-Pass für
  Zielknoten ohne eingehende Kante — kein Knoten bleibt je isoliert
  (verifiziert über 20 Seeds in `phase12map.mjs`).
- **Eigener Run-weiter RNG-Strom statt eines pro-Raum-Stroms**: neue
  Funktion `rngForRun(seed, label)` in `core/rng.js` (Gegenstück zu
  `rngFor(seed, roomIndex, label)`, aber ohne Raumnummer) — die Karte
  entsteht EINMAL bei `createRun()` und bleibt für den ganzen Run fix,
  anders als alle anderen, pro Raum neu abgeleiteten Ströme.
- **Sicherheitsnetz gegen Schatzkammer-Sackgassen**: `treasure` ist bei
  ≤ `treasure.lifeCost` Leben nicht wählbar (`chooseMapNode()`). Führen
  ALLE Kanten eines Knotens zufällig ausschließlich zu `treasure`-Knoten,
  waere der Pfad dort bei 1 Leben blockiert — `generateMap()` färbt in
  diesem (seltenen) Fall die erste Alternative auf `combat` um (immer
  wählbar). Ohne dieses Sicherheitsnetz schlug die 40-Seed-Gewinnbarkeits-
  probe in `phase4.mjs` bei genau einem Seed fehl.
- **Kartenscreen nur bei echter Verzweigung** (`current.next.length > 1`):
  Reihen mit nur einem erreichbaren Ziel (Raum 1→2, 2→3, letzte Reihe→Boss)
  ziehen automatisch weiter, kein zusätzlicher Klick — deckungsgleich mit
  dem alten "erzwungenen Kampf" vor Phase 12.
- **`cursed` bypasst die normale Elite-Affix-Raumstaffelung bewusst**:
  `rollEliteAffixes(run, enemyTypes, forceCount)` bekommt einen neuen
  optionalen dritten Parameter — `cursed` erzwingt IMMER genau 1 Affix,
  auch weit vor `affixRules.minRoomForOne` (Raum 8), weil der Preis ja
  schon auf der Karte sichtbar ist, nicht von der Raumnummer abhängt.
  Belohnung teilt sich exakt den `treasure`-Zweig in `rollReward()`
  (nur Legendaries), aber ohne dessen Lebenspreis — `cursed` ist ein
  Kampfraum wie jeder andere, der Preis ist der Affix, nicht ein Leben.
- **`prevRoomType` komplett entfernt**: dessen einziger Zweck war die alte
  "kein `event`/`workshop` zweimal hintereinander"-Regel aus `rollNextType()`.
  Diese Regel lässt sich auf einem verzweigten Kartengraphen nicht mehr
  sauber durchsetzen (dieselbe Reihe kann von Vorgängern unterschiedlichen
  Typs erreicht werden) und wird bewusst fallengelassen — dokumentiert statt
  stillschweigend kaputt zu sein.
- **`doors.firstDoorRoom` (4) ersetzt durch `map.forcedCombatLayers` (2)**:
  PLAN.md nennt für die Karte explizit "Raum 1–2 immer combat" (nicht mehr
  1–3 wie vorher) — das alte Feld ist ersatzlos entfernt, nichts referenziert
  es mehr.
- **Kartenanzeige ist SVG-Kanten + DOM-Knoten** (`mapscreen.js`): Knotenkreise
  per Button (wiederverwendet `ROOM_TYPE_INFO` aus `run.js`, das seit dem
  v2-Rückbau der Türwahl ungenutzt im Code lag), Kantenlinien per `<svg>`
  nach dem Einblenden anhand `offsetLeft`/`offsetTop` gezeichnet (das
  Overlay muss sichtbar sein, sonst liefert das Layout nur Nullen).
  Erreichbare Knoten hell + klickbar, aktueller Knoten grün, gesperrte
  Schatzkammern (zu wenig Leben) rot umrandet und deaktiviert, alles
  andere sichtbar, aber gedimmt — "vollständig vorab einsehbar" gilt für
  die GANZE Karte, nicht nur die nächste Wahl.
- **Bestehende Regressionstests brauchten reihenweise einen neuen
  `map`-Phasen-Zweig** (u. a. `phase4.mjs`, `phase9elite.mjs`,
  `phase10modifiers.mjs`, `phase11walls.mjs`, `cleanup.mjs`, `phase0b.mjs`,
  `phase4armor.mjs`): jede "spiel den Run automatisch durch"-Testschleife,
  die vorher nie auf eine Zwischen-Phase warten musste, blieb sonst in
  `run.phase === 'map'` hängen. Testet jetzt zusätzlich, dass eine
  abgelehnte Wahl (Schatzkammer, zu wenig Leben) die nächste Option
  probiert statt in einer Endlosschleife zu bleiben.

## Phase 13 — Shop  ✅ erledigt
**Aufwand:** 1 Session

Schrott ausgeben für: Karte aus fünf kaufen, gewähltes Upgrade ablegen,
Schildladungen, Sekundärwaffe tauschen, Leben (teuer, einmal pro Shop).

**Wiederverwendung (Fund beim v3-Review):** Keine Neuentwicklung — baut
direkt auf der bestehenden Werkstatt auf (`workshop`-Raumtyp,
`createWorkshopScreen()` in `src/ui/roomscreens.js`,
`buyShieldCharge`/`dropUpgrade` in `run.js`). Neu sind nur Kartenkauf
(`upgradepool.drawOne()` wiederverwenden), Sekundärtausch (setzt Phase 6
voraus) und Lebenskauf.

**Betroffene Dateien:** `src/ui/roomscreens.js` (`createWorkshopScreen` um
drei Aktionen erweitern oder zu `createShopScreen` umbenennen), `src/game/run.js`
(neue Aktionen neben `buyShieldCharge`/`dropUpgrade`).

**Umsetzungsfunde:**
- **Nur die Oberfläche heißt jetzt "Shop", die interne Kennung bleibt
  `workshop`.** Umbenannt wurden Screen-Titel, `ROOM_TYPE_INFO.workshop`
  (Name/Symbol/Beschreibung) und die UI-Fabrik (`createWorkshopScreen` →
  `createShopScreen`, importiert nur von `main.js`). Der Raumtyp-Schlüssel,
  die Run-Phase (`run.phase === 'workshop'`) und `leaveWorkshop()` behalten
  ihren Namen — ein Durchbenennen hätte `doors.weights`, gespeicherte
  Zwischenstände (`roomType` im `runSnapshot`), den Telemetrie-Wert
  `roomType` (dessen Bedeutungsänderung laut `telemetry.js` einen
  `SCHEMA_VERSION`-Bump nach sich zöge) und acht Regressionstests berührt —
  viel Migrationsrisiko für reine Vokabelkosmetik.
- **Kein zweiter Karteneffekt-Pfad**: die Sonderfälle beim Annehmen einer
  Karte (Sekundärslot-Wechsel, Glaskanone, Notschild, Trophäe, Kriegsbeute,
  `tagCounts`) standen bisher inline in `chooseUpgrade()`. Sie sind jetzt in
  `applyUpgradeChoice(run, offer)` extrahiert, das sich Upgrade-Screen und
  Shop teilen — sonst hätte der Kartenkauf eine zweite, driftende Kopie
  gebraucht. `chooseUpgrade()` ergänzt danach nur noch Raumfluss
  (`afterRoomDone`), `buyShopCard()` nur die Schrottkosten.
- **Kartenregal wird EINMAL beim Betreten gezogen** (`startNonCombatRoom()`),
  nicht bei jedem Rendern — der Screen rendert nach jeder Aktion neu, ein
  Ziehen im Renderpfad würde das Regal jedes Mal neu mischen. Es steht
  bewusst NICHT im `runSnapshot()`: Seed + Raumnummer erzeugen denselben
  `upgrades`-Strom, das Regal entsteht beim Fortsetzen identisch neu
  (gleiches Prinzip wie `roomModifier` in Phase 10, per Test verifiziert).
- **Mehrfachkauf erlaubt**: gekaufte Karten werden als `sold` markiert
  statt aus dem Regal entfernt (stabile Slot-Positionen beim Neu-Rendern);
  wer genug Schrott hat, kann alle fünf kaufen. "Karte aus fünf kaufen"
  ist damit ein Regal, kein Einmal-Angebot.
- **`buyShopSecondary()` setzt zusätzlich `run.upgrades[id] = 1`**, damit
  die gekaufte Waffe später nicht noch einmal als Karte aus dem Pool
  gezogen wird — dieselbe Wirkung wie beim Kartenwechsel in Phase 6.
- **Der Lebenskauf ist die einzige Shop-Aktion mit Besuchs-Gedächtnis**
  (`run.shopLifeBought`, zurückgesetzt beim Betreten) — alle anderen
  Aktionen sind allein durch den Schrottvorrat begrenzt.
- Der Shop hat als einziges Overlay mehr Inhalt als eine Bildschirmhöhe:
  `#workshop` bekommt `overflow-y: auto` + `justify-content: flex-start`
  (Muster wie der Kartenscreen aus Phase 12).

## Phase 14 — Bosse  ✅ erledigt
**Aufwand:** 2–3 Sessions
Nutzt die Arena-Weiche aus Phase 0.

- **Der Reaktor**: unverwundbarer Turm in der Mitte, stirbt nur, wenn vier
  Generatoren in den Ecken per Bankshot getroffen werden
- **Der Spiegel**: kopiert deine Bewegungen gespiegelt, stirbt nur an deiner
  eigenen zurückgeprallten Kugel
- **Die Phalanx**: fünf `armored`-Panzer in Formation, drehen sich gemeinsam,
  Lücke nur für Sekundenbruchteile

**Betroffene Dateien:** `data/arenas.json` (3 Boss-Layouts), `data/tanks.json`
(3 Boss-Typen), `data/difficulty.json` (`finalRoom.bosses` statt `fixed`),
`data/balance.json` (`boss`-Block), `src/game/generator.js` (Marker →
Grid-Zeichen), `src/game/state.js` (Generator-Wandtyp, Invincibility-Gate,
Boss-Dispatch), `src/game/bossai.js` (neu: Spiegel-Bewegung,
Phalanx-Formation), `src/game/bullet.js`/`mine.js` (Bankshot-Regel),
`src/game/cfg.js` (Boss-Flags durchreichen), `src/game/run.js`
(Boss-Auswahl + Finalraum-Umbau), `src/render/renderer.js`/`sprites.js`
(Generator-Optik, Alias-Sprites).

**Umsetzungsfunde:**
- **„Alle 5 Räume" war veraltete Formulierung** aus der Zeit vor Phase 12:
  seit der Roguelike-Karte gibt es strukturell genau EINEN Boss-Knoten am
  Ende des Runs (letzte Kartenreihe, immer `combat`-Typ), keine periodischen
  Mini-Bosse alle 5 Räume. Umgesetzt wurde genau ein Bossraum, 1 von 3
  Arenen wird dort deterministisch gewürfelt (`run.rng.enemies()`,
  `diff.finalRoom.bosses`). `data/tiles.json`s alter, handgebauter
  `finalRoom` (fixes Kachel-Layout) ist komplett entfernt — die
  Arena-Weiche aus Phase 0b übernimmt seine Rolle vollständig.
- **`resolveCfg()` ist eine explizite Whitelist**, kein Durchreichen aller
  `tanks.json`-Felder (Fund während der Tests: `bossInvincible`/
  `mirrorBoss`/`phalanx` kamen ohne expliziten Eintrag nie im aufgelösten
  `cfg` an, alle drei Bosse verhielten sich wie stumpfe `guardian`-Panzer).
  Jetzt wie `armor`/`requiresRicochet` als reine Datenübernahme ergänzt.
- **Reaktor und Phalanx brauchen keine neue Turm-/Trefferlogik**: der
  Reaktorkern nutzt die bestehende Rolle `guardian` unverändert (steht
  fest, `roleTurret()` zielt/feuert normal) — nur seine Unverwundbarkeit
  ist neu (`killTank()`-Gate auf `cfg.bossInvincible && state
  .bossGeneratorsLeft > 0`, kein Verbrauch, kein Verfall). Der Spiegel
  wiederverwendet `requiresRicochet`/`armor.reflects` 1:1 vom Prisma (Phase
  4) — stirbt nur an einer Kugel mit `wallBounces > 0`. Die Phalanx
  wiederverwendet `armor.arc`/`reflects` ebenfalls vom Prisma/Gepanzerten;
  neu ist nur der Bogen-Wert (60°, enger als die 72° Formationsabstand,
  damit die Lücke zwischen zwei Panzerungen kontinuierlich um die rotierende
  Formation wandert statt fest zu stehen).
- **Zwei echte Sonderbewegungen bypassen DRIVES/updateEnemy() komplett**
  (neues `src/game/bossai.js`, `stepMirrorBoss`/`stepPhalanxBoss`): beides
  ist reine Funktion von Zeit/Spielerposition, keine steer()-Physik. Turm-
  /Feuerentscheidung bleibt trotzdem die normale `roleTurret()`-Logik — nur
  die Fahrfunktion ist ersetzt. `state.js: stepState()` prüft
  `t.cfg.mirrorBoss`/`t.cfg.phalanx` VOR dem normalen `updateEnemy()`-Aufruf.
  `tank.phalanxIndex` (0–4) wird einmalig beim Erzeugen vergeben
  (`createState()`), Formationsplatz und -winkel folgen aus
  `state.time * rotationSpeedRad + phalanxIndex * 72°` um die feste
  Raummitte (`WIDTH/2, HEIGHT/2`).
- **`boss_mirror`-Arena ist bewusst punktsymmetrisch gebaut** (Wände UND
  Layout spiegeln sich exakt durch die Raummitte) — dadurch spiegelt jede
  erreichbare Spielerposition automatisch auf eine ebenso begehbare
  Bodenzelle, ohne eigene Kollisionsprüfung für den Spiegel-Panzer.
- **`mirror`-Marker wird zur bestehenden Spiegelwand** (`r`, Phase 5)
  statt zu einer neuen Mechanik — „Der Spiegel"-Arena kann sie dekorativ
  nutzen, ist aber nicht Pflicht. `generator`-Marker wird zu einem neuen,
  eigenen Wandtyp (`g` → `state.js: WALL_TYPES.generator`), der wie
  `destructible` (Phase 11) über `destroyWall()` läuft, aber nur zählt,
  wenn die treffende Kugel bereits `wallBounces > 0` hat (`bullet.js:
  moveAxis()`) — ein direkter Treffer prallt wirkungslos ab. Explosionen
  (Minen, Kettenblitz) sind bewusst NICHT in der Lage, Generatoren zu
  beschädigen (`mine.js: explodeAt()`), sonst wäre die Bankshot-Hürde
  umgehbar — Muster wie „Explosionen ignorieren die Panzerung" (Phase 4).
- **`arenaEnemySpawnCount()`** (neu, `generator.js`) lässt `run.js` VOR
  `createState()` wissen, wie viele Panzer eine feste Arena aufnehmen kann,
  ohne die Grid-Scan-Logik zu duplizieren — Boss-Typ(en) + gekaufte
  Unterstützung (`diff.finalRoom.supportBudget`, wie vorher) werden darauf
  gekürzt.
- **Bestehende Gewinnbarkeits-Tests mit dem „alle Gegner sofort töten"-Muster
  brauchten eine Ergänzung**: `killTank()` ist jetzt für den Reaktorkern ein
  No-op, solange Generatoren stehen — 12 Testdateien (u. a. `phase4.mjs`,
  `phase9elite.mjs`, `phase12map.mjs`) bekamen vor jedem Cheat-Kill eine
  zusätzliche Zeile, die alle `generator`-Wände direkt über `destroyWall()`
  abräumt (Muster wie der bestehende Kill-Cheat selbst).

---

# STUFE 4 — Kür

## Phase 15 — Bewegliche Wände und Gefahren  ✅ erledigt
**Aufwand:** 1–2 Sessions
Wandsegmente verschieben sich alle 8 s. Ölpfützen, Laserbarrieren (blocken
Kugeln, nicht Panzer), Förderbänder. **Ein** Element pro Raum.

**Betroffene Dateien:** `data/tiles.json` (neuer `hazards`-Block),
`src/game/generator.js` (`placeRoomHazard()`), `src/game/state.js`
(Laufzeit-Verdrahtung + `tickMovingWalls()`), `src/game/tank.js` (Oel-Grip +
Foerderband-Schub), `src/game/bullet.js` (Laser-Bankshot), `src/game/run.js`
(`rollRoomHazard()` + Vorschau), `src/ui/preview.js`, `src/core/telemetry.js`,
`src/render/renderer.js` (`drawHazards()`).

**Umsetzungsfunde:**
- **Nachtraeglich statt in den Generator eingewoben** (Fund waehrend des
  Designs): alle vier Gefahren werden ERST nach der normalen, bereits
  validierten Raumgenerierung (`buildGrid()`/`placeSpawns()`) aufgesetzt,
  statt in `buildGrid()` mitzulaufen wie Spiegelwaende/zerstoerbare Waende.
  Das macht eine zweite Flood-Fill-Pruefung ("Platzierung + Flood-Fill
  ueber die Zeit" laut PLAN) unnoetig: Oel/Foerderband/Laser etikettieren
  nur vorhandene BODEN-Zellen um (keine Wandaenderung), und eine bewegliche
  Wand macht nur eine vorhandene SOLIDE Zelle reversibel -- ihr offener
  Zustand kann die erreichbare Flaeche nur VERGROESSERN, nie verkleinern
  (derselbe Beweis wie bei zerstoerbaren Waenden, Phase 11; im Test
  `phase15hazards.mjs` empirisch verifiziert: reachable(offen) ⊇
  reachable(zu)). Spieler-/Gegner-Spawns werden beim Wuerfeln der Zellen
  bewusst ausgeschlossen.
- **Bewegliche Wand braucht KEINEN neuen Grid-Charakter**: sie bleibt eine
  ganz normale `'solid'`-Wand (aus einer bereits vorhandenen `#`-Zelle
  ausgewaehlt) -- `state.tickMovingWalls()` haengt das Wandobjekt nur
  periodisch aus/in `state.walls` + Grid-Zeichen `'#'`/`'.'` aus. `isSolid()`
  kennt beide Zeichen schon, keine Aenderung dort noetig.
- **Laserbarriere ist bewusst NICHT in `state.walls`**: ein eigenes Array
  `state.laserWalls`, das NUR `bullet.js: moveAxis()` (und die
  Ziellinien-Vorschau `traceTrajectory()`) zusaetzlich abfragt --
  `tank.js: resolveCircleWalls()` bekommt nur `state.walls` und sieht sie
  nie. So "blockt Kugeln, nicht Panzer" ohne Sonderfall in der
  Kollisionsroutine selbst.
- **Oelpfuetze teilt sich die Grip-Physik mit dem raumweiten Glatteis-
  Modifikator** (Phase 10) statt einer zweiten Implementierung: `tank.js:
  moveTank()` prueft jetzt `mod?.slippery || onOil` und liest
  `mod?.gripPerSec ?? state.hazard?.gripPerSec`. Modifikator (Phase 10) und
  Gefahr (Phase 15) sind unabhaengige Systeme mit je eigenem RNG-Strom und
  koennen daher theoretisch im selben Raum aktiv sein, ohne sich zu
  behindern.
- **Zwei Whitelist-Fallen aus Phase 14 vorsorglich mitgeprueft**: sowohl
  `cfg.js: resolveCfg()` (Phase-14-Fund) als auch `telemetry.js:
  recordRoom()` sind explizite Feld-Whitelists. Fuer Phase 15 war das
  Kern-Feature nicht betroffen (Oel/Foerderband/Laser haengen an
  `state`/`tank.cfg`, nicht an neuen `tanks.json`-Feldern) -- ein neues
  Telemetrie-Feld `hazard` (Muster `modifier`) wurde trotzdem gleich mit
  explizitem Whitelist-Eintrag ergaenzt, um denselben Fehler nicht zu
  wiederholen.

## Phase 16 — Deckungs-KI  ✅ erledigt
**Aufwand:** 1–2 Sessions
Gegner mit niedriger `aggression` brechen die Sichtlinie, wenn du zielst.
**Performance-Auflage:** Sichtlinien mit 15 Hz statt pro Frame, höchstens vier
Gegner pro Frame im Reihum-Verfahren. Für Deckungsverhalten reicht das.

**Betroffene Dateien:** `data/tanks.json` (neuer `ai.cover`-Block),
`src/game/ai.js` (Sichtlinien-Takt + Reihum-Auswahl), `src/game/ai_drives.js`
(Deckungs-Zielpunkt suchen), `src/game/state.js` (Verdrahtung).

**Umsetzungsfunde:**
- **Kein neuer Grid-/Rollen-Mechanismus, sondern ein Dispatch-Override**:
  `ai.js: updateEnemy()` ruft bei niedriger `aggression` UND erkanntem
  "im Ziel" (`tank.ai.threatened`) statt `DRIVES[role]` die neue
  `ai_drives.js: coverDrive()` auf — Rolle, Panzerung, Minenlegen bleiben
  komplett unangetastet, es wird nur EIN Tick lang die Fahrfunktion
  ersetzt. Findet `coverDrive()` keinen Punkt, fällt es auf `DRIVES[role]`
  zurück, damit ein Panzer nie stehen bleibt.
- **"Im Ziel" ist bewusst grob**: `ai.js: isPlayerAiming()` prüft nur engen
  Kegel (`aimConeRad`) + Reichweite (`aimRangePx`) + freie Sichtlinie zum
  Spielerturm — kein exaktes Trefferbild, das reicht als Auslöser zum
  Ducken, spart aber die teure Berechnung.
- **15 Hz + Reihum-Verfahren wie im Plan gefordert**: `updateCoverPerception()`
  läuft mit einem eigenen Timer (`state.coverTimer`, zurückgesetzt auf
  `1/checkHz`) und prüft pro Aufruf höchstens `checksPerTick` (4) Gegner,
  ausgehend von einem wandernden `state.coverCursor` — bei mehr Gegnern
  dauert es also mehrere Aufrufe, bis alle einmal geprüft wurden. Das
  Ergebnis (`tank.ai.threatened`) bleibt bis zum nächsten Check stehen
  (max. ~67 ms alt) — für ein Ausweichverhalten unmerklich.
- **`findCoverPoint()` ist bewusst kein Pathfinding**: samplet 8 Punkte im
  Ring (`searchRadiusPx`) um den Panzer und wählt den nächsten begehbaren,
  der die Sichtlinie zum Spieler bricht — "für Deckungsverhalten reicht
  das" (PLAN.md). Kein Kandidat gefunden → `null`, Aufrufer fährt normal
  weiter.
- **`guardian` bleibt explizit ausgenommen** (verlässt seine Zone laut
  Spec nie, Phase 8) — `aggression` ist für Guardian-Typen ohnehin nicht
  gesetzt und fällt in `cfg.js: resolveCfg()` auf den Standardwert 0.5
  zurück (über der Schwelle), der Rollen-Ausschluss dokumentiert die
  Absicht aber explizit statt sich nur auf den Default zu verlassen.
  `aggressionThreshold: 0.3` trifft aktuell `t_grey`/`t_yellow`/`t_prism`
  (Sapper, 0.17) und `t_armored` (Hunter, 0) — Sapper hatte laut Phase 8
  ohnehin schon ein dormantes Flucht-Feld (`preferredRange`, bisher von
  keinem Typ genutzt); die Deckungssuche ist ihr erstes echtes defensives
  Verhalten.

## Phase 17 — Transformationen ✅ erledigt
**Aufwand:** 1 Session

Drei Upgrades desselben Tags schalten einen Bonus frei. Fortschritt als Zähler
(2/3) im Upgrade-Screen, sonst verpufft die Mechanik.
**Nur Tags, die dreimal stapelbar sind** — das war in v1 kaputt.

- `defense` → **Bollwerk**: Schildladungen verfallen nicht mehr
- `mobility` → **Kavallerie**: Boost-Cooldown halbiert, während des Boosts
  unverwundbar
- `information` → **Taktiker**: Zeit auf 40 %, solange eine Kugel näher als
  64 px ist
- `terrain` → **Pionier**: eigene Wände doppelt so haltbar, eigene
  Sekundärwaffe schadet dir nicht mehr
- `control` → **Saboteur**: betäubte Gegner explodieren beim Aufwachen

**Migration von `data/transformations.json` (Fund beim v3-Review) — die Datei
existiert schon (Freischaltung seit E5 stillgelegt, `run.tagCounts` zählt
aber schon mit):**

| Transformation | Zustand | Aktion für diese Phase |
|---|---|---|
| **Taktiker** (`information`) | Effekt (`slowMoScale: 0.4`, `slowMoRadiusPx: 64`) entspricht bereits 1:1 dem Plan | Unverändert übernehmen, nur den Freischalt-Trigger reaktivieren |
| **Saboteur** (`control`) | Effekt (`stunExplodeRadiusPx`) entspricht bereits dem Plan | Unverändert übernehmen |
| **Baumeister/Pionier → Pionier** (`terrain`) | Zwei getrennte Einträge: `baumeister` (`wallDurability: 2`, Tag `terrain`, gültig) und `pionier` (`ownMinesHarmless`, Tag **`mine`** — dieser Tag wurde beim v2-Umbau aus dem Schema gestrichen, keine Karte trägt ihn mehr, `pionier` kann so nie freigeschaltet werden) | Beide Effekte unter einem Eintrag (Tag `terrain`) zusammenführen, den verwaisten zweiten Eintrag auflösen |
| **Kavallerie** (`mobility`) | Aktueller Effekt (`ramKillsNonElite`, `ramProtectS`) basiert auf Rammen — nach E5 komplett gestrichen | Effekt vollständig neu schreiben: `dashCooldownMult: 0.5` + Unverwundbarkeit für die gesamte Boost-Dauer, verdrahtet gegen das bestehende `cfg.dash = {dist, iframe, cooldown}` (`tank.js`/`cfg.js`). Wirkt nur mit dem `dash`-Upgrade — im Upgrade-Screen als Hinweis anzeigen |
| **Bollwerk** (`defense`) | Existiert noch gar nicht | Neuer Eintrag: Schildladungen altern nicht mehr (`ageShieldCharges()` in `run.js` bei aktiver Transformation überspringen) |

**Betroffene Dateien:** `data/transformations.json` (Migration + `bollwerk`),
`src/game/run.js` (Freischalt-Trigger bei `chooseUpgrade` reaktivieren —
Zähler existiert bereits in `run.tagCounts`; `ageShieldCharges` für Bollwerk),
`src/game/cfg.js`/`tank.js` (Kavallerie-Dash-Interaktion), `src/ui/upgradescreen.js`
(Fortschrittsanzeige "2/3" reaktivieren).

**Umsetzungsfunde:**
- **`cfg.js` musste am Ende NICHT angefasst werden**, obwohl es in der
  "Betroffene Dateien"-Zeile stand: Kavallerie liest ihren Effekt (wie alle
  anderen Transformationen auch) live aus `state.transform` an der einzigen
  Stelle, die ihn braucht (`tank.js: dashTank()`), statt ihn als weiteren
  aufgelösten `cfg`-Wert zu führen — konsistent mit `slowMoScale`
  (Taktiker) und `wallDurability`/`ownMinesHarmless` (Pionier), die genauso
  nie über `cfg.js` laufen.
- **`applyUpgradeChoice()` ist der einzige Freischalt-Hook** (nicht
  `chooseUpgrade()` direkt) — er wird bereits sowohl vom Upgrade-Screen als
  auch von `buyShopCard()` (Phase 13) aufgerufen, ein neuer
  `unlockTransformation(run, tag)`-Aufruf an dieser einen Stelle deckt damit
  automatisch auch im Shop gekaufte Karten ab.
- **Transformationseffekte werden einmal pro Raum in `state.transform`
  gebacken** (`buildCombatRoom()` → `transform: transformEffects(run)`),
  nicht live pro Tick neu gelesen — eine mitten im Raum frisch
  freigeschaltete Transformation wirkt daher erst ab dem nächsten
  Raumaufbau. Dasselbe Verhalten wie Raum-Modifikatoren (Phase 10) und
  Raum-Gefahren (Phase 15), hier nur erstmals für den laufenden Raum selbst
  relevant (Auswahl passiert im selben Raum, in dem gezählt wird).
- **`run.shieldCharges` ist zur Laufzeit nicht die Quelle der Wahrheit**:
  `stepRun()` synchronisiert jeden Tick `run.shieldCharges = st.shieldCharges`
  (Raum-Zustand → Run-Objekt, nicht umgekehrt) — Bollwerks
  `ageShieldCharges()`-Sperre muss also am Zustand hängen, der tatsächlich
  gealtert wird (`state.shieldCharges`), sonst würde jeder Tick den
  gewünschten Testzustand sofort wieder überschreiben.
- **Kavallerie-Hinweistext** ("nur mit Dash-Karte") erscheint im
  Upgrade-Screen sowohl bei "Fortschritt" als auch bei "Aktiv", solange
  `run.upgrades.dash` noch 0 ist — sonst wäre eine freigeschaltete, aber
  wirkungslose Transformation für den Spieler unsichtbar unklar.

## Phase 18 — Kartenwellen
**Aufwand:** laufend, je 1 Session
**Welle 1 ✅ erledigt** (doppelrohr/flak freigeben, Ballistikrechner,
Pluenderer, Feuerleitzentrale) — weitere Wellen folgen in eigenen Sessions.

Neue Upgrades in Wellen zu 5–8. **Jede Welle beginnt mit einer
Telemetrie-Auswertung**: Welche Karten wurden angeboten und nie gewählt?
Höchstens ein Drittel reine Statwerte im Pool.

**Korrektur (v3-Review):** `doppelrohr` (Tag `weapon`, `minRoom: 3`) steht
bereits in `data/upgrades.json`, ist aber vom Pool ausgeschlossen
(`upgradepool.js` schließt Tag `weapon` explizit aus) — diese Phase muss den
Ausschluss nur aufheben, nicht `doppelrohr` neu bauen. Zuerst nur `doppelrohr`
und `flak` (neu) freigeben, weil jede weitere Waffenkarte ein eigenes
Physikverhalten ist.

**Ballistikrechner (Fund beim v3-Review — E1 kündigt dieses Upgrade an, keine
Phase listet es bisher):** Tag `information`, zeigt in der Ziellinie
(`traceTrajectory()` in `bullet.js`) zwei Abpraller statt einen. Die Funktion
hat dafür bereits einen `opts.maxBounces`-Parameter — das Upgrade ist im Kern
`maxBounces: 2` statt `1`, wenn es aktiv ist. Gehört in die erste Welle dieser
Phase.

**Erste Belegung der toten Taxonomie aus Phase 2:** erste Karte mit Tag
`resource` (z. B. höherer `scrap.perRoom`) und erste Karte mit echtem
`requires` (z. B. eine `doppelrohr`-Erweiterung, die `magazin` voraussetzt).

**Betroffene Dateien:** `data/upgrades.json` (neue Karten + Wellen-Metadaten),
`src/game/upgradepool.js` (Tag-`weapon`-Ausschluss aufheben, sobald die erste
Waffenkarte regulär gezogen werden soll), `src/render/effects.js`/`bullet.js`
(Ballistikrechner-Anbindung an `traceTrajectory`).

**Umsetzungsfunde (Welle 1):**
- **`WEAPON_ALLOWLIST` statt Tag-Freigabe**: `upgradepool.js` oeffnet den Tag
  `weapon` NICHT komplett, sondern nur fuer die beiden namentlich gelisteten
  Karten (`doppelrohr`, `flak`) — genau wie im Plan gefordert ("jede weitere
  Waffenkarte bekommt ihr eigenes Physikverhalten"). Eine dritte Waffenkarte
  braucht denselben bewussten Freischalt-Schritt, nicht nur einen neuen
  `upgrades.json`-Eintrag.
- **Flak bekam eine eigene Physik statt eines weiteren `allExplosive`-Klons**:
  neues Bullet-Feld `burstDistance` (`bullet.js`) laesst eine Kugel nach einer
  kurzen, festen Reichweite in der Luft zuenden — unabhaengig von Wand- oder
  Zielkontakt, ueber denselben `explosive`-Sterbe-Mechanismus wie
  Sprengmunition/Glaskanone (`state.js`, unveraendert). Das ist der
  Unterschied zu den bestehenden Explosiv-Karten, die immer bis zur Wand
  oder zum vollen Wegbudget fliegen.
  `traceTrajectory()` (Ziellinie) uebernimmt `cfg.burstRangePx` automatisch,
  damit die Vorschau nicht laenger wirkt als der echte Schuss.
- **Feuerleitzentrale ist die erste echte `requires`-Karte**: der Filter in
  `upgradepool.js` (`def.requires.some(...)`) existierte seit Phase 2 bereits,
  wurde aber nie von einer Karte genutzt. Tag `scaling` (nicht `weapon`),
  damit sie unabhaengig von der Waffen-Allowlist normal im Pool erscheint,
  sobald `doppelrohr` gewaehlt wurde.
- **Ballistikrechner ist reine Anzeige**, keine neue Physik: `effects.js:
  drawAimLine()` markiert jetzt ALLE Abpraller-Punkte in `pts` statt nur den
  ersten und braucht dafuer ein laengeres `tailSteps`-Vorschaufenster (90 statt
  45 Schritte), sonst reicht das kurze Standard-Tail nie bis zum zweiten
  Wandkontakt.
- **Pluenderer** wirkt NACH dem Elite-Multiplikator (`run.js`), als flacher
  Bonus — wie die einmalige Kriegsbeute-Belohnung auch kein Vielfaches ist.

---

# Prüfpunkte

**USP-Kennzahlen** (ersetzen die erfundene 30-Prozent-Regel):

1. **Erzwungene Bankshots** — Anteil der Räume ab Raum 5 mit mindestens einem
   nicht direkt tötbaren Gegner. Zielwert 60 %. Design-Kontrolle über den
   Generator, keine Messung.
2. **Prisma-Ersttrefferquote** — Anteil der Prisma-Panzer, die innerhalb der
   ersten drei auf sie gezielten Schüsse sterben. Zielbereich 40–70 %.
   Darunter unlesbar, darüber trivial.
3. **Freiwillige Bankshots** — Anteil der Abpraller-Kills an Gegnern, die auch
   direkt tötbar gewesen wären. Die einzige Zahl, die wirklich misst, ob der
   USP trägt. Soll über die ersten zehn Runs eines Spielers **steigen**.
   Bleibt sie flach, ist der Bankshot nicht befriedigend genug — dann hilft
   kein weiterer Content.

**Weitere Abbruchkriterien:**
- Nach Stufe 2: Sind 20 aufeinanderfolgende Runs in der Telemetrie
  unterscheidbar (Todesursachen, Builds, Raumnummern)? Wenn nein, fehlt
  Varianz, nicht Content.
- Nach Stufe 1: **Blindtest.** Spiele einen Run, in dem du bewusst nie auf eine
  Wand zielst. Kommst du über Raum 10, ist der USP nicht erzwungen und Phase 4
  ist zu schwach eingestellt.
- Nach Stufe 2: **Kaltstart.** Sieben Tage nicht spielen, dann einen Run mit
  eingeschaltetem Debug-Modus. Alles, was du in der ersten Minute selbst nicht
  mehr sofort verstehst, ist für einen fremden Spieler unlesbar. Das ist der
  beste verfügbare Ersatz für frische Augen.
- Nach Stufe 3: **Fremde Spieler beschaffen.** Ohne Testpersonen ist nicht
  beantwortbar, ob jemand freiwillig einen zweiten Run spielt — und das ist die
  einzige Frage, die am Ende zählt. Ein Build auf itch.io mit
  Telemetrie-Export, dazu ein Devlog-Post in einem Roguelike-Forum oder
  -Discord, kostet nichts und braucht keine Bekannten. Sobald fremde Runs in
  der Telemetrie liegen, ersetzt der Median-Todesraum fremder Spieler alle
  Selbsteinschätzungen.
- Durchgehend: Median-Todesraum zwischen 8 und 14.
- Durchgehend: `minFps` nie unter 50.

---

# Realistische Einschätzung

Stufe 0 bis 1 sind etwa 10–12 Sessions. Dieser Block entscheidet über die
Existenz des Spiels.

Der vollständige Plan sind grob 32 Sessions, also mehrere Monate Abendarbeit.
Nach Stufe 1 innehalten und prüfen, ob das Fundament trägt.

Der häufigste Fehler ab hier wäre, Stufe 3 vorzuziehen, weil Karte und Bosse
sichtbarer sind als Panzerungswinkel. Eine schöne Karte über einem
austauschbaren Kern ist verlorene Zeit.
