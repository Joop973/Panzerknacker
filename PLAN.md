# PLAN.md — Beta zu fertigem Spiel (v2)

Verbindliche Roadmap. Ersetzt v1 vollständig.
Alle in der Review gefundenen Widersprüche sind eingearbeitet.

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
| Meta-Progression | Bewusst zurückgestellt, nicht verworfen. Entscheidung nach Stufe 3 |

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

## Phase 2 — Upgrade-Schema
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
`maxStacks: 3`, 3 Ladungen nach E2 mit Verfall nach 3 Räumen.

## Phase 3 — Schrott als Währung
**Aufwand:** 1 Session

Muss vor Stufe 1 stehen, weil die Trickshot-Belohnung Schrott ausschüttet.

`scrap.perRoom: [1,3]`, `eliteBonus: 3`, `cost.reroll: 2`, `cost.ban: 1`,
`cost.fourthCard: 3`, `cost.shieldCharge: 4`.

Vier Aktionen im Upgrade-Screen mit sichtbarem Preis: neu würfeln, verbannen,
vierte Karte, Schildladung. Schrottstand permanent im HUD.

---

# STUFE 1 — Der USP

## Phase 4 — Gerichtete Panzerung
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

## Phase 5 — Abprallen belohnen
**Aufwand:** 1–2 Sessions

**Trickshot-Belohnung:** Kill mit `ricochets >= 1` gibt +1 Schrott, 0,15 s
Zeitlupe, eigener Sound. Bei `ricochets >= 2` deutlicher.

**Spiegelwände:** Kacheltyp in `tiles.json`, verbraucht keinen Abpraller,
optisch klar unterscheidbar. Generator platziert 2–4 Segmente pro Raum,
bevorzugt an Außenwänden.

**Powershot** — als Upgrade, nicht als Grundmechanik. Kein Halten, kein Laden,
keine zusätzliche Eingabe.

`powershot`, Tag `weapon`, rare, `maxStacks: 3`. Beim Betreten eines Raums sind
`powershot.perRoom: 1` Schuss geladen (pro Stack einer mehr). Der **erste
abgefeuerte Schuss** im Raum ist automatisch der Powershot:
`powershot.bonusRicochets: 2`, `powershot.speedFactor: 2.0`, Reichweite
unverändert (E4).

Der geladene Schuss ist am Rohr sichtbar, solange er vorhanden ist.

**Ehrliche Einordnung:** Mit reinem Autofire (E1) lässt sich der Powershot
nicht aufsparen — er geht raus, sobald der Stick das erste Mal ausgelenkt
wird. Er ist damit ein passiver Eröffnungsbonus, keine taktische Entscheidung.
Das ist in Ordnung, aber er trägt weniger zum Spielgefühl bei als geplant.
Entsprechend niedrig einstufen: rare, nicht legendary.

Bewusst **nicht** über Kills oder Feuerpausen nachladbar. Eine Aufladung durch
Feuerpause wäre der Ladungsschuss durch die Hintertür.

## Phase 6 — Sekundärslot
**Aufwand:** 2 Sessions

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

## Phase 7 — Geisterpanzer
**Aufwand:** 1 Session
(Rammen gestrichen, siehe E5.)

Getötete Gegner kämpfen `ghost.duration: 3.0` s als durchscheinender
Verbündeter weiter und zielen automatisch auf den nächsten Gegner. Jeder Kill
des Geistes verlängert um `ghost.killBonus: 1.0`. Kettenreaktionen sind das
Ziel. Geister blockieren keine Kugeln, sind nicht tötbar,
`ghost.maxActive: 4`.

Upgrade `ghost_crew`, Tag `reactive`, legendary.

## Phase 7b — Audio
**Aufwand:** 1 Session
**Neu in v2. Steht hier, weil Phase 5 auf einem Sound beruht.**

Keine Dateien: **prozedurale Synthese mit WebAudio** — Oszillator, Rauschen,
Hüllkurve. Definitionen in `data/sounds.json` (Wellenform, Frequenzverlauf,
Dauer, Filter), also vom Handy tunbar.

Reihenfolge nach Informationswert:
1. Eigener Abpraller-Tick — ab hier ist die Kugel gefährlich
2. Prisma-Reflexion
3. Gegnerschuss mit Stereopanning nach Position
4. Minen-Warnpuls
5. Trickshot-Kill, deutlich anders als normaler Kill
6. Leben verloren und Schild verloren — zwingend zwei verschiedene Sounds
7. Raum geräumt, Upgrade gewählt

WebAudio-Unlock nach erster Berührung nicht vergessen.
**Jede Information per Ton braucht ein sichtbares Gegenstück** — viele spielen
stumm. Der Abpraller-Tick hat es bereits, die Prisma-Reflexion braucht einen
Blitz.

---

# STUFE 2 — Wiederspielbarkeit

## Phase 8 — Gegner-Rollen statt Gegner-Typen
**Aufwand:** 2 Sessions

Rolle plus Werte in `tanks.json`, nicht pro Gegner neu programmiert. Rolle und
Panzerung sind frei kombinierbar.

- `hunter` — sucht Nähe, schießt direkt
- `sieger` — hält Distanz, schießt **ausschließlich** Bankshots
- `sapper` — legt Minen, flieht vor dir
- `guardian` — verlässt seine Zone nie, schießt weit

Je Rolle: `aggression`, `preferredRange`, `fireRate`, `accuracy`.

## Phase 9 — Elite-Affixe, Wellen, Elite-Belohnung
**Aufwand:** 2 Sessions

**Affixe** als Modifikatoren auf beliebige Gegner, sichtbar als Farbring:
`swift`, `armored_elite`, `minelayer`, `twinshot`. Kombinierbar. Ab Raum 8
einer pro Raum, ab Raum 14 zwei.

`regenerating_shield` **nur als Elite-Affix und nur auf dem billigsten und dem
teuersten Panzer** der KI-Auswahl. Als Ladung mit sichtbarem Ring, nicht als
verstecktes Lebenspolster — sonst widerspricht er der Kernentscheidung gegen
Lebenspunkte.

**Elite-Belohnung ohne Karte:** Ein Raum mit mindestens einem Affix-Gegner
zählt als Eliteraum und gibt zusätzlich zur normalen Dreierauswahl eine
garantierte Karte aus dem Tag `elite`, separat dargestellt. In Phase 12 ändert
sich nur der Auslöser auf "Knotentyp ist `elite`". Damit liegt der Tag nicht
drei Phasen lang tot im Pool.

Elite-Karten: `beutepanzer`, `trophaee`, `kriegsmaschine`.

**Wellen:** große Räume spawnen in zwei Schüben, zweite Welle bei 50 %
Restgegnern, Spawnpunkte mit 1 s Vorwarnung.

## Phase 10 — Raum-Modifikatoren
**Aufwand:** 1 Session, höchster Ertrag pro Aufwand

Vor dem Betreten sichtbar, `data/modifiers.json`, ab Raum 3, einer pro Raum.

`fog`, `jammer` (Kugeln 30 % langsamer), `overpressure` (+1 Abpraller für
alle), `darkness`, `slippery`, `crowded` (+50 % Gegner, −30 % Aggression),
`sniper_alley` (alle Gegner `sieger`), `no_secondary`, `mirror_hall` (alle
Wände sind Spiegelwände).

## Phase 11 — Zerstörbare Wände
**Aufwand:** 1 Session

`wall.destructible.hits: 3`. Die Arena verändert sich im Kampf. Anteil pro Raum
aus `difficulty.json`. Flood-Fill muss auch nach Zerstörung gelten — Wände,
deren Wegfall den Raum unlösbar macht, sind nicht zerstörbar.

## Phase 11b — Performance-Budget
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

---

# STUFE 3 — Struktur

## Phase 12 — Roguelike-Karte
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

## Phase 13 — Shop
**Aufwand:** 1 Session

Schrott ausgeben für: Karte aus fünf kaufen, gewähltes Upgrade ablegen,
Schildladungen, Sekundärwaffe tauschen, Leben (teuer, einmal pro Shop).

## Phase 14 — Bosse
**Aufwand:** 2–3 Sessions
Nutzt die Arena-Weiche aus Phase 0. Alle 5 Räume.

- **Der Reaktor**: unverwundbarer Turm in der Mitte, stirbt nur, wenn vier
  Generatoren in den Ecken per Bankshot getroffen werden
- **Der Spiegel**: kopiert deine Bewegungen gespiegelt, stirbt nur an deiner
  eigenen zurückgeprallten Kugel
- **Die Phalanx**: fünf `armored`-Panzer in Formation, drehen sich gemeinsam,
  Lücke nur für Sekundenbruchteile

---

# STUFE 4 — Kür

## Phase 15 — Bewegliche Wände und Gefahren
**Aufwand:** 1–2 Sessions
Wandsegmente verschieben sich alle 8 s. Ölpfützen, Laserbarrieren (blocken
Kugeln, nicht Panzer), Förderbänder. **Ein** Element pro Raum.

## Phase 16 — Deckungs-KI
**Aufwand:** 1–2 Sessions
Gegner mit niedriger `aggression` brechen die Sichtlinie, wenn du zielst.
**Performance-Auflage:** Sichtlinien mit 15 Hz statt pro Frame, höchstens vier
Gegner pro Frame im Reihum-Verfahren. Für Deckungsverhalten reicht das.

## Phase 17 — Transformationen
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

## Phase 18 — Kartenwellen
**Aufwand:** laufend, je 1 Session

Neue Upgrades in Wellen zu 5–8. **Jede Welle beginnt mit einer
Telemetrie-Auswertung**: Welche Karten wurden angeboten und nie gewählt?
Höchstens ein Drittel reine Statwerte im Pool.
Waffen-Karten (`weapon`) frühestens hier, zuerst nur `doppelrohr` und `flak`,
weil jede weitere ein eigenes Physikverhalten ist.

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
