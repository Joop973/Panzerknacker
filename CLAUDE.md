# PANZERKNACKER — Projektkontext für Claude

Top-down Panzer-Roguelike (Mechanik angelehnt an Wii Play „Tanks!"). Reines
HTML/CSS/JS + Canvas 2D, **kein Build-Schritt**. Läuft über einen Webserver
(nicht `file://`) bzw. auf GitHub Pages. Vollständige Spezifikation: `SPEC.md`.

## ⚠️ Dauerregel (immer befolgen)
Nach **jeder** Änderung: committen → nach `origin/main` rebasen →
`git push --force-with-lease` → **Pull Request nach `main` erstellen und
mergen** (squash). Nur so läuft GitHub Pages mit der neuesten Version.
Bei Service-Worker-relevanten Änderungen den Cache-Namen in `sw.js` erhöhen
(`panzerknacker-vNN`), sonst sehen Nutzer die alte Version offline.

- Entwicklungs-Branch: `claude/phase-1-telemetry-balance-7qpy1a`
- Repo: `Joop973/Panzerknacker`, Default-Branch `main`
- Vor dem Push testen (Node-Syntaxcheck + kurzer Playwright-Smoke, s. u.).
- Commit-/PR-Texte auf Deutsch. Kein Modell-Identifier in Commits/PRs.

## ⚠️ Gegenprobe für jeden neuen Test (Pflicht)
Ein neuer Test ist erst fertig, wenn er **nachweislich rot wird**. Also: den
Fehler, den er bewachen soll, absichtlich einbauen (Wert ändern, Zeile
auskommentieren, Bedingung umdrehen), Suite laufen lassen, Meldung prüfen,
Änderung zurücknehmen. Ein grüner Test ohne diesen Nachweis ist wertlos —
er kann aus dem falschen Grund grün sein.

Das ist keine Theorie: In diesem Projekt sind so schon mehrere stille
Blindgänger aufgefallen, u. a.
- „Panzer starten mit vollen LP" prüfte `hp === cfg.maxHp`, was bei
  `maxHp: 1` überall **trivial wahr** war — ein hartkodiertes `hp: 1`
  rutschte durch (LP-Phase 1);
- „höchstens 3 Statussymbole" bei genau drei existierenden Effekten — der
  ausgebaute Deckel rutschte durch (LP-Phase 5);
- eine Schadensmessung fing gegnerisches Eigenfeuer mit ein und zeigte 74
  statt 24 Schaden (LP-Phase 5);
- eine Minen-Prüfung verglich nur Code gegen JSON und hätte jede
  Wertänderung mitgemacht (LP-Phase 3).

Faustregel daraus: **den Mechanismus mit eigenen Zahlen prüfen, nicht die
aktuelle Datenlage** — sonst ist der Test entweder trivial wahr oder er
wandert bei der nächsten Balance-Änderung grundlos auf Rot.

## ⚠️ Diese Datei aktuell halten (Pflicht)
Am Ende **jeder** abgeschlossenen Aufgabe **diese `CLAUDE.md` mit
aktualisieren** und im selben PR mitmergen. So kann der Nutzer jederzeit den
Chat wechseln und der neue Chat kennt den echten Stand. Konkret:
- Abschnitt **„Aktueller Stand"** anpassen (neue gemergte PRs eintragen).
- **To-dos** abhaken/entfernen bzw. neu entdeckte Punkte ergänzen.
- Bei Architektur-/Datei-/Ablauf-Änderungen die betroffenen Abschnitte oben
  nachziehen (z. B. neue Datei, neues Upgrade-Feld, geänderter Testbefehl).
Kurz halten, keine Doppelungen. Änderungen an dieser Datei brauchen **keinen**
Service-Worker-Bump (kein Spiel-Asset).

## Antwortsprache
Der Nutzer schreibt Deutsch → **immer auf Deutsch antworten.**

## Aktueller Stand (Stand: 2026-07)
Spielbar und deterministisch; PWA/Offline; Touch + Desktop + Gamepad;
60 Upgrades, 6 Raumtypen, Schrott-Währung, sichtbare Roguelike-Karte statt
unsichtbarer Raumtyp-Automatik. Maßgeblich ist **`PLAN.md` v2**
(ersetzt v1 vollständig). Erledigt: **Phase 0** (Eingabe/Ziellinie/RNG/Arena-
Weiche) und **Phase 1** (Telemetrie v2, Lesbarkeit, Run-Speicherung).
v2-**Phase 2** (Upgrade-Schema) und **Phase 3** (Schrott) sind inhaltlich schon
durch die gleichnamigen v1-Phasen abgedeckt (Abweichungen auf Nutzerwunsch:
`emergency_shield` gibt 1 statt 3 Ladungen je Stufe, Elite-Schrott ist
`eliteMult: 2` statt `eliteBonus: 3`). **Phase 4** (gerichtete Panzerung),
**Phase 5** (Abprallen belohnen: Trickshot, Spiegelwände, Powershot),
**Phase 6** (Sekundärslot: Mine wird zu einer von sechs austauschbaren
Sekundärwaffen; seit `PLAN-INPUT.md` P4 in festen Bombenslot + tauschbaren
Gadgetslot getrennt), **Phase 7** (Geisterpanzer: getötete Gegner kämpfen kurz
als durchscheinender Verbündeter weiter), **Phase 8** (Gegner-Rollen statt
Gegner-Typen: vier datengetriebene Rollen statt neun eigener
Fahr-/Turmfunktionen), **Phase 9** (Elite-Affixe, Wellen, additive
Elite-Belohnung), **Phase 10** (Raum-Modifikatoren: 9 Effekte aus
`data/modifiers.json`, ab Raum 3 einer pro Kampf-/Eliteraum), **Phase 11**
(Zerstörbare Wände: ein Anteil innerer Wände pro Raum hält 3 Treffer aus,
bevor sie fallen), **Phase 11b** (Performance-Budget: feste Obergrenzen
aus `data/limits.json` + `balance.json`, im F1-Debug-Overlay sichtbar
zusammen mit Logik-/Render-Frame-Zeit), **Phase 12** (Roguelike-Karte:
sichtbarer, wählbarer Kartengraph ersetzt die unsichtbare Raumtyp-Automatik,
neuer Raumtyp `cursed`), **Phase 13** (Shop: fünf Schrott-Aktionen im
früheren Werkstatt-Raum), **Phase 14** (Bosse: Reaktor/Spiegel/Phalanx,
1 von 3 Arenen deterministisch am Ende des Runs statt des alten
handgebauten Finalraums), **Phase 15** (Raum-Gefahren: bewegliche Wand,
Ölpfütze, Laserbarriere, Förderband — genau eine pro Raum ab Raum 3) und
**Phase 16** (Deckungs-KI: Gegner mit niedriger `aggression` brechen die
Sichtlinie, wenn der Spieler zielt, 15-Hz-Reihum-Wahrnehmung statt
Pro-Frame-Prüfung) und **Phase 17** (Transformationen: drei Karten desselben
Tags schalten einen dauerhaften Bonus frei — Bollwerk/Kavallerie/Taktiker/
Pionier/Saboteur) sind gebaut. **Phase 18 — Kartenwellen** läuft (laut Plan
mehrere Wellen über mehrere Sessions): **Welle 1** (`doppelrohr`/`flak`
freigegeben, Ballistikrechner, Plünderer, Feuerleitzentrale) und **Welle 2**
(Beutejagd, Nachtsicht, Nachladeschild, Meisterschütze, Erschütterungsdash —
gezielt gegen die dünnsten Tags aus Welle 1) sind gebaut.
`PLAN.md` wurde auf **v3** konsistenzgeprüft: tote Verweise (u. a. gelöschte
Elite-Karte `beutepanzer`, doppelt gebautes Affix-System, falscher
`eliteBonus`-Feldname) entfernt, jede offene Phase bekommt jetzt eine
"Betroffene Dateien"-Zeile.
**Phase 7b — Audio** ist nachgeholt (war als einzige Phase vor 18
übersprungen worden): `data/sounds.json`, Stereopanning, getrennte Sounds
für eigenen Tod/Gegner-Kill/Schild. **Welle 3** ist gebaut (sechs Karten,
die zwei tote Transformationen reparieren).
Danach wurden die **USP-Prüfpunkte** aus `PLAN.md` operationalisiert:
Kennzahl 1 (erzwungene Bankshots) war mit 33 % statt 60 % deutlich
verfehlt — behoben über `difficulty.json: bankshotGuarantee`, jetzt 61,9 %
und in der Regressionssuite bewacht. Kennzahl 3 (freiwillige Bankshots) ist
jetzt überhaupt messbar.
`PLAN-INPUT.md` **P1 (Input-Abstraktion)**, **P2 (Viewport/DPR)**,
**P3 (Touch-Bug Sekundärwaffe)**, **P4 (Gadget-Split)**,
**P6 (Haken-Rework)**, **P7 (Werte-Anzeige)**, **P8 (Zwischenraum-UI)**,
**P9 (Startbildschirm)** und **P11 (Lichtquellen)** sind gebaut, **P5
(Schild-Rework) auf Nutzerwunsch gestrichen** („Schild erstmal so lassen
wie es ist"). **`PLAN-INPUT.md` ist damit vollständig abgearbeitet.**

**Neu eingegangen: `UMBAUPLAN-LP.md`** (Stand: dieser Eintrag) — 28-Phasen-Plan
für einen **vollständigen Umbau von Ein-Treffer-Kampf auf Lebenspunkte, zehn
Klassen und sechs Schadenstypen**. Das ist ein Identitätswechsel, kein
additiver Ausbau: er ersetzt das bisherige "ein Treffer tötet"-Modell und
zieht deshalb ab **Phase 8** bewusst mehrere Systeme zurück, die dieses
Projekt gerade erst gebaut und vermessen hat — `bankshotGuarantee` (USP-
Kennzahl 1, s. o.) wird auf `chance: 0` gesetzt, `t_prism`s `requiresRicochet`
entfällt zugunsten eines Schadensmultiplikators, `tests/uspcheck.mjs` wird
außer Dienst gestellt. Das ist im Plan selbst so entschieden (Tabelle
„Festgelegte Entscheidungen") und keine Inkonsistenz — nur wichtig, es beim
Lesen von `PLAN.md`/dieser Datei nicht als Widerspruch misszuverstehen.
**Vor dem Bau geprüft (Ist-Abgleich):** die im Plan zitierten Codestellen
stimmen (`state.js:425 killTank()`, `'player'` hartkodiert in `state.js`
Zeilen 164/597, `cfg.js` zieht Magazin/Kugeltempo für `type === 'player'`
fest aus `balance.json`, `t_prism` hat aktuell `requiresRicochet: true`,
`bankshotGuarantee.chance` steht auf 0.58) — **zwei Abweichungen
gefunden:** (1) Phase 28 behauptet, der Frame-Budget-Test schlage *aktuell*
fehl (8,86 ms/16,29 ms) — er ist seit der Session „Grüner wird
Bankshot-Gegner" grün (~2,4 ms, 120 statt 180 `angleSamples` +
`solvesPerTick`-Deckel); die Zahlen im Plan sind veraltet, an Phase 28 bei
Bedarf neu messen statt den alten Wert zu glauben. (2) Phase 7 spricht von
einem „Umbau" eines bestehenden 5-%-Krit-Systems — es gibt aktuell **gar
kein** Krit-System im Code (keine Treffer für `crit`/`critChance` in
`data/*.json` oder `src/game/*.js`); Phase 7 baut es komplett neu, nicht um.
**Phase 1–6 sind gebaut** (s. eigene Abschnitte unten): Schadensmodell,
Gegner-LP, Spieler-LP, Abprall-Bonus, Statuseffekt-System und die sechs
Schadenstypen. Damit steht das Grundgerüst — alle Panzer haben Lebenspunkte,
der Spieler hält vier Gegnertreffer aus, startet jeden Raum mit vollen LP,
ein Wandabpraller verdoppelt den Schaden (beidseitig), und jedes Geschoss
trägt einen Schadenstyp, der Feuer/Frost/Gift aufträgt bzw. als Blitz auf
drei Ziele springt. **Karten und Klassen setzen die Typen noch nicht** (Phase
9 bzw. 11–16) — Debugtaste 4 schaltet sie bei `?debug=1` durch.
**Phase 7 (Krit-Umbau) ist gebaut** (s. eigener Abschnitt unten): ein
kritischer Treffer macht 2× Schaden UND setzt das Nachladen sofort zurück —
vorerst spielerseitig, Grundchance 5 %, gedeckelt bei 35 %.
**Phase 8 (Altlasten abbauen) ist gebaut** (s. eigener Abschnitt unten): die
erzwungenen Bankshots (`bankshotGuarantee.chance`) sind auf 0, das Prisma
verliert `requiresRicochet` und nimmt stattdessen 3× Schaden aus Bankshots,
der Spieler-Schild ist ein 40-Punkte-Absorber statt eines Ein-Treffer-Blocks,
`tests/uspcheck.mjs` ist gelöscht und die USP-Kennzahlen in der Telemetrie
sind durch „Schaden je Schadenstyp pro Run" ersetzt.
**Phase 9 (Die zehn Klassen als Werte) ist gebaut** (s. eigener Abschnitt
unten): zehn spielbare Klassen mit eigenen LP/Schaden/Tempo/Krit + je einem
Passiv, wählbar über einen neuen Auswahlbildschirm; der Blocker (`'player'`
fest verdrahtet) ist über `player:true` + `run.starterTank` aufgelöst, die
Klasse steht im Snapshot (Fortsetzen/Seed-Wiedergabe).
**Phase 10 (Kernpool, 30 Karten) ist gebaut** (s. eigener Abschnitt unten):
30 klassenunabhängige Kernkarten (10 Kategorien × common/rare/legendary =
10/10/10, eigener Tag je Kategorie) mit generischem `core`-Applier in `cfg.js`,
plus der `weightedPick`-Fix aus `PLAN-UPGRADES.md` — die Seltenheitsverteilung
ist jetzt größenunabhängig 60/30/10 (gemessen: 62/29/9 in echten Angeboten).
**Phase 11 (Physisch-Topf, 12 Karten) ist gebaut** (s. eigener Abschnitt
unten): 12 physische Karten (4/4/4) plus die **Angebotsfilterung nach
`damageType`** (typgebundene Karten erscheinen nur bei passendem Klassen-
Element) und die physischen Trefferregeln (Kaltschütze/Splittergeschoss/
Fangschuss/Abprallkönig/Kopfschuss/Railgun).
**Phase 12 (Sprengstoff-Topf, 12 Karten) ist gebaut** (s. eigener Abschnitt
unten): 12 explosive Karten (4/4/4), die Schüsse zünden lassen und
Explosionsradius/-schaden/Splitter skalieren; neuer
`explosionDamageMult`-Multiplikator im Zündpfad (Schuss + Mine).
**Phase 13 (Feuer-Topf, 12 Karten) ist gebaut** (s. eigener Abschnitt unten):
12 Feuerkarten (4/4/4), die Brandstufen/-dauer/-tickschaden/-deckel skalieren
und den Brand über die generischen Status-Boosts (`statusStackBonus`/
`statusTickMult`/`statusMaxStacksBonus`/`statusDurationMult`) + eine
Ausbreitung (`fireSpreadRadius`) steuern.
**Phase 14 (Frost-Topf, 12 Karten) ist gebaut** (s. eigener Abschnitt unten):
12 Frostkarten (4/4/4) mit stärkerer Verlangsamung (`frostSlowBonus` additiv
zum Klassen-Passiv), früherem/längerem Einfrieren (`frostFreezeReduction`/
`frostFreezeDurationBonus`) und Extra-Schaden gegen erstarrte Ziele
(`shatterMult`).
**Phase 15 (Gift-Topf, 12 Karten) ist gebaut** (s. eigener Abschnitt unten):
12 Giftkarten (4/4/4) über die generischen Status-Boosts (Stufen/Dauer/Tick/
Deckel 5→7) plus eine **Gift-Ausbreitung** (`poisonSpreadRadius`); der
Feuer-Ausbreitungsblock ist zu einem status-agnostischen Zweig verallgemeinert.
**Phase 16 (Blitz-Topf, 12 Karten) ist gebaut** (s. eigener Abschnitt unten):
12 Blitzkarten (4/4/4), die die Blitzkette steuern — mehr Kettenziele
(`lightningBonusTargets` additiv zum Klassen-Passiv), weitere Sprünge
(`lightningRangeBonus`), schwächerer Abfall (`lightningFalloffBonus`) und
Betäubung je Sprung (`lightningStun`). **Damit sind alle sechs Element-Töpfe
(Phasen 11–16) fertig.**
**Phase 17 (Zweitelement) ist gebaut** (s. eigener Abschnitt unten): beim
Runstart wird deterministisch ein zufälliges zweites Element gezogen und mit
halber Gewichtung in die Angebote gemischt (`weightedPick` tier-normiert), im
Shop gegen Schrott neu würfelbar, in der Raumvorschau angezeigt.
**Phase 18 (Signaturtopf Standard) ist gebaut** (s. eigener Abschnitt unten):
sechs klassenexklusive Karten für die Standard-Klasse + der `signatureClass`-
Filter, den alle Signaturtöpfe (18–27) teilen — eine Karte mit `signatureClass`
erscheint nur, wenn genau diese Klasse gespielt wird.
**Phase 19 (Signaturtopf Sprengpanzer) ist gebaut** (s. eigener Abschnitt unten):
sechs klassenexklusive Explosiv-Karten für den Sprengpanzer (`c_blast`) über den
`signatureClass`-Filter (Phase 18) und die Explosiv-`core`-Schlüssel (Phase 12).
**Phase 20 (Signaturtopf Frostpanzer) ist gebaut** (s. eigener Abschnitt unten):
sechs klassenexklusive Frost-Karten für den Frostpanzer (`c_frost`) über den
`signatureClass`-Filter (Phase 18) und die Frost-`core`-Schlüssel (Phase 14).
**Phase 21 (Signaturtopf Teslapanzer) ist gebaut** (s. eigener Abschnitt unten):
sechs klassenexklusive Blitz-Karten für den Teslapanzer (`c_tesla`) über den
`signatureClass`-Filter (Phase 18) und die Blitz-`core`-Schlüssel (Phase 16).
**Phase 22 (Signaturtopf Radioaktiv) ist gebaut** (s. eigener Abschnitt unten):
sechs klassenexklusive Gift-Karten für den Radioaktiv-Panzer (`c_toxic`) über den
`signatureClass`-Filter (Phase 18) und die Gift-`core`-Schlüssel (Phase 15).
**Phase 23 (Signaturtopf Flammenpanzer) ist gebaut** (s. eigener Abschnitt unten):
sechs klassenexklusive Feuer-Karten für den Flammenpanzer (`c_flame`) über den
`signatureClass`-Filter (Phase 18) und die Feuer-`core`-Schlüssel (Phase 13).
**Damit sind alle fünf Element-Signaturtöpfe (Phasen 19–23) fertig.**
**Phase 24 (Signaturtopf Abprallpanzer) ist gebaut** (s. eigener Abschnitt unten):
erster Mechanikklassen-Topf mit 12 Karten (4/4/4) für den Abprallpanzer
(`c_ricochet`) — bestehende Abprall-Schlüssel plus eine **neue klassenexklusive
Regel** `bounceRampPerBounce` (Schaden je Wandabpraller).
**Phase 25 (Signaturtopf Schrottpanzer) ist gebaut** (s. eigener Abschnitt unten):
zweiter Mechanikklassen-Topf mit 12 Karten (4/4/4) für den Schrottpanzer
(`c_scrap`) — bestehender `scrapAdd` plus eine **neue klassenexklusive Regel**
`scrapDamageBonus` (stärkere „reicher = stärker"-Skalierung).
**Phase 26 (Signaturtopf Nekromant) ist gebaut** (s. eigener Abschnitt unten):
dritter Mechanikklassen-Topf mit 12 Karten (4/4/4) für den Nekromanten
(`c_necro`) — verstärkt Wiederbelebung und Geisterpanzer über drei **neue
klassenexklusive Regeln** (`reviveChanceBonus`, `grantGhostCrew`,
`ghostDurationBonus`).
**Phase 27 (Signaturtopf Ingenieur) ist gebaut** (s. eigener Abschnitt unten):
vierter und letzter Signaturtopf mit 12 Karten (4/4/4) für den Ingenieur
(`c_engineer`) — Minen-/Explosiv-Schlüssel plus eine **neue klassenexklusive
Regel** `builtHpBonus` (haltbarere Sperrmauer). **Damit sind alle zehn
Signaturtöpfe (Phasen 18–27) fertig.**
**Phase 28 (Balance + neue Tests) ist gebaut** (s. eigener Abschnitt unten):
die Schlussabnahme des LP-Umbaus — gezogene Verteilung über den echten Pool,
Zusicherung gegen leere Seltenheitsstufen und eine deterministische
Raumdauer-Schranke. **Damit ist der komplette `UMBAUPLAN-LP.md` (Phasen 1–28)
abgearbeitet — das Spiel läuft vollständig auf Lebenspunkte, zehn Klassen und
sechs Schadenstypen.**
**Nächste Sitzung: kein Pflichtthema mehr offen.** Verbleibend nur noch
manuelle/optionale Punkte (s. To-do-Liste unten): der Bankshot-Faktor-Kalttest
(2,0 → ggf. 2,5/3,0, nur nach echtem Spielgefühl) und die Telemetrie-Auswertung
echter Runs. Neue Wünsche des Nutzers abwarten.
Frühere Merges (PRs #9–#12): Portrait-Auto-Pause-Fix, echtes
Handy-Vollbild (`100dvh` + `viewport-fit=cover`), Grafik-Sprites +
App-Icon, diese `CLAUDE.md`.

### Phase 0a (Eingabe-Abstraktion + Ziellinie) — gemergt
- **`src/core/input.js` ist die EINZIGE Stelle, die Geräte-Events liest.**
  Die Spiellogik ruft nur `input.getState(player)` und bekommt
  `{move, aim, firing, secondary}` (+ `secondaryThrow`, `dash`, `source`).
  `src/game/*` enthält keinerlei Event-/Gamepad-Zugriff mehr (verifiziert).
- **Drei Quellen**, Erkennung automatisch zur Laufzeit (`source`): Touch
  (zwei Sticks, Autofire ab Deadzone), Desktop (WASD, Maus, **Linksklick
  gehalten** = Dauerfeuer, Leertaste), Gamepad (Sticks, rechter Trigger =
  `firing`, linker Trigger/A = `secondary`). `ui/touchcontrols.js` ist nur
  noch Treiber und wird ausschließlich von `input.js` gelesen.
- **`data/input.json`**: `stick.deadzone`, `stick.twoZone`,
  `stick.fireThreshold`, `player.fireRate`. **`twoZone` ist implementiert,
  aber aus** — bei `true` feuert Touch erst ab `fireThreshold` und zeigt
  einen Ring (`.stick-firering`); reine JSON-Umschaltung, kein Code.
- **Feuersperre statt Verdrängung**: bei `bullet.maxActive` aktiven Kugeln
  pausiert `fireBullet` (gibt `false`) — es wird **nie** eine eigene Kugel
  gelöscht (sonst verschwinden die eigenen Abprallschüsse).
- **Ziellinie** (`effects.js drawAimLine` + `bullet.js traceTrajectory`):
  nutzt dieselbe `updateBullet`-Physik wie das Spiel (getestet: 0,0000 px
  Abweichung), zeigt Linie bis zur ersten Wand + gestrichelte Vorschau des
  ersten Abprallers. Abschaltbar über `data/options.json` (`aimLine`) bzw.
  den Schalter „Ziellinie" im Startmenü.

### Phase 0b (RNG-Ströme + Arena-Weiche) — gemergt
- **Kein fortlaufender RNG-Zustand mehr im Run.** `run.genRng` ist weg;
  `makeRoomStreams(run)` leitet pro Raum benannte Ströme aus
  `hash(seed, roomIndex, label)` ab (`core/rng.js`: `hashSeed`, `rngFor`).
  Ströme: **rooms** (Layout/Kachelwahl/Spawns), **enemies** (Gegner-Einkauf
  + Elite-Affix), **upgrades** (Angebote inkl. Rerolls), **scrap**, **doors**,
  **events**; dazu `hashSeed(seed, roomIndex, 'ai')` für den KI-Strom.
  Dadurch: Run allein aus Seed+Raumnummer reproduzierbar (Fortsetzen,
  geteilte Seeds, Replays), und eine Änderung an einem System verschiebt die
  anderen nicht mehr (getestet).
- **Arena-Weiche** in `generator.js`: Raumspec mit `fixedLayout: "<name>"`
  lädt das Layout aus `data/arenas.json` statt zu generieren; sonst
  unverändert der Kachelgenerator. Gleiches `grid`-Format → **Renderer
  unverändert**. Legende: `wall/breakable/hole/floor/spawn/enemy` +
  `mirror`/`generator` (blockieren vorerst wie Wand, werden als
  `room.markers` gemeldet — Boss-Elemente erst Phase 14).
- **`validateArenas()`** prüft alle Layouts **einmalig beim Laden**
  (`main.js`): 24×16, bekannte Zeichen, Spieler-/Gegner-Spawns, Flood-Fill.
  Fehler werfen mit klarer Meldung (Arena-Name + Position) statt zur Laufzeit.
  Testweg: **`?arena=test_arena`** in der URL.

### Phase 1 (Telemetrie, Lesbarkeit, Speicherung) — gemergt
Alle Werte in **`data/balance.json`** (keine hartkodierten Zahlen im Code):
`bullet.speed` 200, `bullet.maxDistance` 1200, `bullet.blinkFraction` 0.15,
`bullet.maxActive` 5, `bullet.maxActiveCap` 8, `bullet.selfImmunity` 0.35,
`enemyBullet.maxActive` 24, `shield.roomLifetime` 3; `mine.fuse` 3.0,
`mine.radius` 64, `mine.chainDelay` 0.15, `mine.warningTime` 0.5.
(Die alten Minen-Felder `selfDetonateS/explosionRadiusPx/chainDelayS` aus
`tanks.json` sind entfernt.)
- **Wegbudget statt Lebenszeit** (E4): `bullet.distance` zählt die tatsächlich
  geflogenen Pixel; bei `maxDistance` ist Schluss. Ein doppelt so schneller
  Schuss fliegt dadurch **schneller, nicht weiter**. In den letzten
  `blinkFraction` des Budgets blinkt die Kugel (Renderer).
- **Kugel wird erst nach dem ersten Abpraller** für den Spieler gefährlich
  (+ heller Glow + Tick-Sound); Selbst-Immunität 0,35 s nach Abschuss;
  harter Aktiv-Kugel-Cap (8) für den Spieler (**Feuersperre**, nie FIFO).
- **Gegner-Geschosse** werden dagegen FIFO auf `enemyBullet.maxActive`
  gedeckelt (Ende von `stepState`) — beim Spieler passiert das nie.
- **Minen lesbarer**: pulsierender Warnring im Explosionsradius in den
  letzten 0,5 s vor der Selbstzündung; Kettenreaktion mit 0,15 s Verzögerung.
- **Schildladungen altern einzeln** (E2): `run.shieldCharges` ist eine
  **Liste** von Restlaufzeiten (Anzahl noch geräumter Räume). Jeder geräumte
  Raum zieht 1 ab (`ageShieldCharges`), 0 verfällt. `killTank` verbraucht die
  **älteste** Ladung. Der Renderer blendet den Ring nach Restlaufzeit aus.
- **Run-Speicherung** `localStorage.currentRun`: `runSnapshot(run)` wird in
  `startRoom()` geschrieben — **nur beim Betreten** eines Raums, nie im
  Kampf. Enthält Seed, Raumindex/-typ, Leben, Schildladungen mit Restlaufzeit,
  Schrott, Upgrades, verbannte ids, tagCounts, Endlos-Flag, Spielzeit/Kills.
  Bei Run-Ende `clearCurrentRun()`. Im Startmenü erscheint der Knopf
  **„Run fortsetzen (Raum N, X ❤)"** (`#resumeBtn`), der über
  `createRun(..., { resume })` genau denselben Raum neu erzeugt (Seed +
  Raumnummer genügen). Abbruch mitten im Raum startet den Raum neu.
  (Noch nicht im Snapshot, weil es die Mechanik noch nicht gibt:
  Sekundärslot → Phase 6, Kartenpfad/Knoten → Phase 12.)
- **Telemetrie v2** (`src/core/telemetry.js`, `schemaVersion: 2`): pro Run
  `gameVersion`, Gerät, Auflösung, Seed, Zeitstempel, Modus, Sekundärwaffe,
  erreichter Raum, gewählte/abgelehnte Upgrades. Pro Raum: `roomType`, Dauer,
  Leben, `shieldCharges`, `scrapEarned`, `enemies` (Typ + Affix), `minFps`,
  `ricochetKills`/`directKills`, `secondaryUses` (+ Platzhalter `modifier`,
  `ghostKills`, `powershotsFired` für Phasen 10/7/5). Tod: `cause`,
  `bulletOwner`, `bulletRicochets`, `bulletDistanceTravelled`, Gegnertyp.
  **Die Debug-Ansicht rechnet selbst** (`computeMetrics`): Siegquote,
  Median-Todesraum, Abpraller-Anteil, minFps, nie gewählte und am häufigsten
  abgelehnte Karten. Verdrahtet rein beobachtend in `main.js`; die Spiellogik
  liest nie Telemetriedaten. **Nur bei `?debug=1`** sichtbar/aktiv.

### Phase 4 v2 (Gerichtete Panzerung) — gemergt
Stufe 1, der USP. Keine zusätzlichen Lebenspunkte — die **Trefferrichtung**
entscheidet. Logik in **`src/game/armor.js`** (`armorBlocks`, `reflectBullet`,
`hasWallBounced`, `isLive`), aufgerufen aus der Treffer-Schleife in `state.js`.
- **Gepanzerter** (`t_armored`, ab Raum 4, 5 Punkte): `armor.arc: 120`,
  `armor.reflects: true`. Treffer im Frontsektor (gemessen zur **Fahrtrichtung
  der Wanne**) prallen ab, Seite/Rücken töten — **auch ein Abpraller kommt
  vorn nicht durch**, beim Gepanzerten zählt nur die Richtung. Eigenes
  Fahrverhalten `armor_push` (wie `pursue`, aber `turnSpeed 1.1` statt 3.0):
  eng umkreisen bringt die Flanke, aus der Distanz nicht.
- **Prisma** (`t_prism`, ab Raum 6, 7 Punkte, `maxPerRoom: 1`):
  `requiresRicochet: true` — wirft **jeden** direkten Schuss zurück, stirbt nur
  an einer Kugel mit mindestens einem **Wand**-Abpraller.
- **`b.wallBounces`** zählt nur Wandabpraller (in `updateBullet`). Eine
  Reflexion zählt bewusst NICHT mit, sonst könnte man zwei Prismen
  gegeneinander ausspielen, ohne je eine Bande zu spielen. `isLive(b)` =
  wallBounces > 0 **oder** reflektiert → so wird die zurückgeworfene Kugel für
  den Schützen scharf.
- **E3** (`balance.reflect`): reflektierte Kugeln behalten den Schützen als
  Besitzer, verlieren alle Abpraller (`ricochetsLeft: 0` → sterben an der
  nächsten Wand), bekommen `graceS 0.15` Immunität gegen den reflektierenden
  Panzer und werden **cyan** gezeichnet.
- **Explosionen ignorieren die Panzerung** (bewusst): sonst wäre ein Prisma
  für Builds ohne Abpraller (Durchschlag, Streuschuss) gar nicht tötbar.
- **`maxPerRoom`** in `difficulty.json` deckelt einzelne Gegnertypen pro Raum
  (`buyEnemies` in `run.js`).
- **Darstellung**: Gepanzerter = dicker heller Balken im gepanzerten Sektor
  (dreht mit der Wanne, mit Endstegen); Prisma = rotierender Rautenkranz +
  Ring. Beide **ohne neue Asset-Dateien**: `sprites.js` hat einen
  `SPRITE_ALIAS` (`t_armored`→`t_grey`, `t_prism`→`t_teal`), die Identität
  trägt das Overlay.
- Frame-Budget: schlechtester Logikschritt mit 8 Gegnern **~1–3 ms** (Budget
  16,7 ms bei 60 Hz) — Phase 4 kostet nichts Messbares.

### Phase 5 v2 (Abprallen belohnen) — gemergt
Stufe 1, der USP wird lohnend statt nur notwendig.
- **Spiegelwände** (`data/tiles.json: mirror.min/maxPerRoom` 2–4): neuer
  Wandtyp intern `reflect` (Zeichen `r`, `WALL_TYPES.r` in `state.js`) —
  bewusst NICHT `mirror` genannt, das ist schon die Bezeichnung des
  Boss-Arena-Markers aus Phase 0b/14. `generator.js: placeReflectWalls()`
  ersetzt 2–4 Außenrand-Zellen nach dem Schließen des Rands (ändert weder
  Wandanteil noch Erreichbarkeit). `bullet.js: moveAxis()` gibt jetzt
  `{hit, mirror}` zurück; ein Treffer auf `reflect` prallt ab, **ohne**
  `ricochetsLeft` zu verringern, **aber** `wallBounces` zählt normal mit
  (Prisma-Kills bleiben möglich). Eine Kugel mit `ricochetsLeft <= 0` (z. B.
  eine E3-reflektierte) stirbt **auch** an einer Spiegelwand, sonst würde das
  E3-"stirbt am nächsten Wandkontakt" ausgehebelt. `traceTrajectory()`
  erkennt Abpraller jetzt über `wallBounces`-Delta statt `ricochetsLeft`-Delta
  (sonst unsichtbar in der Ziellinien-Vorschau an einer Spiegelwand).
  `isSolid()`/`hasLos()` behandeln `reflect` wie `solid` (blockiert
  Sichtlinie/KI-Raycast/Minenwurf). Darstellung immer prozedural (cyan
  Diagonalstreifen), auch wenn Sprites geladen sind — sonst identisch zur
  normalen Wandsprite.
- **Trickshot-Belohnung** (`balance.trickshot`): Kill mit Wandabpraller gibt
  Schrott (`scrap: 1`, ab `strongRicochets: 2` Wandabprallern `scrapStrong: 2`)
  + kurze Zeitlupe (`state.trickshotTimer`, `slowMoScale: 0.35`) + eigenen
  Sound. Ersetzt an derselben Stelle die reine "Abpraller!"-Textmeldung
  (Gold "Trickshot! +N Schrott" bei Spieler-Kills, weiterhin cyan
  "Abpraller!" bei allen anderen bounced Kills). Der Zeitlupen-Scale
  kombiniert sich in `run.js: stepRun()` mit der bestehenden
  Taktiker-Transformation (der stärkere/kleinere Wert gewinnt). Schrott
  läuft wie alle anderen Raum-Zähler über einen `seenTrickshotScrap`-Delta
  von `state.js` nach `run.scrap`.
- **Powershot** (Upgrade, Tag `reactive` — **nicht** `weapon`, siehe unten):
  `tank.powershotCharges` (frisch pro Raum, weil `createTank()` bei jedem
  Raumwechsel/Respawn ohnehin neu aufgerufen wird — kein eigener
  "Raum betreten"-Hook nötig). Jeder Abzug, solange Ladungen da sind, ist ein
  Powershot (`speedFactor: 2.0`, `bonusRicochets: 2`); Reichweite bleibt
  gleich, das folgt automatisch aus dem Wegbudget (E4). Heller Marker an der
  Rohrspitze, solange eine Ladung wartet. `powershotsFired` (Telemetrie-Feld
  aus Phase 1 schon vorbereitet) jetzt in `main.js` verdrahtet.
  **Umsetzungsfund:** `upgradepool.js` schließt Tag `weapon` explizit vom
  Pool aus (reserviert für Phase 18) — mit `weapon` wäre Powershot in dieser
  Phase unerreichbar gewesen (derselbe Fehler wie `doppelrohr`, siehe
  `PLAN.md` v3). Deshalb Tag `reactive`.

### Phase 6 (Sekundärslot) — gemergt
Die Mine ist jetzt eine von sechs gleichwertigen, per Upgrade austauschbaren
Sekundärwaffen (Tag `secondary`, `maxStacks: 1`, Werte in `data/secondaries.json`).
- **Ausrüsten ohne Level-Scan:** `run.equippedSecondary` (Start: `'mine'`,
  `run.upgrades = { mine: 1 }` als Startbelegung) wird in `chooseUpgrade()`
  bei `offer.tag === 'secondary'` gesetzt und bis `cfg.secondary`
  durchgereicht (`cfg.js: applyUpgrades()` bekommt dafür einen expliziten
  Parameter statt einen `l()`-Level-Scan — mehrere Sekundärkarten können
  gleichzeitig Level > 0 in `run.upgrades` stehen, da alte Karten beim
  Wechsel nicht zurückgesetzt werden). Ein Wechsel ist pro Karte einmalig
  (dieselbe `maxStacks: 1`-Regel wie bei `schild`/`dash`) — kein eigenes
  "Zurückwechseln"-UI.
- **`emp_mine`** teilt sich die Legemechanik 1:1 mit `mine`
  (`tank.js: layMine()`/`useSecondary()`, kein zweiter Button): jede 4.
  gelegte Mine (`tank.secondaryMineCount`) ist `isEmp`. `mine.js:
  explodeEmpAt()` betäubt statt zu töten (`stunTimer` **und** neues
  `turretStunTimer`), zerstört keine Wände, nimmt an Kettenreaktionen in
  beiden Richtungen nicht teil (`other.isEmp`-Ausschluss in `explodeAt()`s
  Kettenschleife).
- **`turretStunTimer` ist ein NEUES, von `stunTimer` getrenntes Feld** —
  Krallenfalle (`trap.js`) setzt bewusst nur `stunTimer` ("Turm bleibt
  nutzbar"); `stunTimer` generell die Turmdrehung sperren zu lassen hätte
  das gebrochen. Gate an der einzigen Stelle, die den Turm dreht:
  `ai.js: updateEnemy()` → Turmfunktion nur bei `turretStunTimer <= 0`
  (Phase 8: `TURRETS[...]`-Dispatch → direkter `roleTurret(...)`-Aufruf).
- **`hook`**: Raymarch in Blickrichtung (`tank.js: fireHook()`), trifft er
  eine Wand, zieht `moveTank()` den Panzer über `tank.hookTimer`/
  `hookTarget` dorthin — Bewegungseingabe wird währenddessen komplett
  ignoriert.
- **`deflector`**: `armor.js: reflectFromAim()` — eigene, zu `reflectBullet()`
  (E3) parallele Funktion, weil die Richtungsquelle unterschiedlich ist
  (Blickrichtung des Spielers statt "weg vom reflektierenden Panzer").
  Erhöht `b.wallBounces` (**nicht** `b.reflected`), damit der Treffer wie
  ein Wandabpraller gegen Prisma-Panzer zählt; `b.owner` bleibt unverändert
  (wie bei E3).
- **`trap_wall`**: `state.placeTrapWall()` legt eine Wand mit
  `wall.customDurability` an; `destroyWall()` (state.js) nutzt dafür
  dieselbe Zähllogik wie die Baumeister-Transformation
  (`wall.customDurability || state.transform.wallDurability`), statt eine
  zweite zu bauen. `bullet.js: moveAxis()` ruft bei jedem Treffer auf
  `wall.type === 'trap'` `destroyWall()` auf, bevor sie wie eine normale
  Wand abprallt ("eigene Bankshot-Winkel").
- **`smoke`**: legt am Spielerstandort eine Wolke (`state.smokeClouds`) ab,
  die nur `state.blocksSight()` (neu, für KI-Sichtprüfungen
  `clearLine()`/`playerInSight()` in `ai.js`) beeinflusst — Geschossphysik
  (`isSolid()`) und die eigene Ziellinie des Spielers bleiben unberührt.
- **Pool-Gating:** die 7 alten Minen-Karten (`kettenglied`, `sprengkraft`,
  `fernzuender`, `schockwelle`, `annaeherungsmine`, `klebemine`,
  `streumine`) erscheinen in `upgradepool.js` nur, solange `mine`/`emp_mine`
  ausgerüstet ist (`MINE_ONLY_IDS` + neue `equippedSecondary`-Option in
  `buildCandidates()`).
- Touch-Button-Beschriftung folgt der ausgerüsteten Waffe
  (`touchcontrols.js: setSecondaryLabel()`, von `main.js` nach jeder
  Kartenwahl/Run-Start aufgerufen). HUD zeigt bei `emp_mine` einen Zähler
  bis zur nächsten blauen Mine.

### Phase 7 (Geisterpanzer) — gemergt
Getötete Gegner kämpfen mit dem `ghost_crew`-Upgrade (Tag `reactive`,
legendary) als durchscheinender Verbündeter weiter, Werte in
`data/balance.json: ghost` (`duration: 3.0`, `killBonus: 1.0`,
`maxActive: 4`).
- **Neues Modul `src/game/ghost.js`** (Muster wie `mine.js`/`trap.js`):
  `createGhost(tank, balance)` übernimmt Position/Ausrichtung UND die
  aufgelöste `cfg` des gestorbenen Panzers per Referenz (Tempo,
  Geschossgeschwindigkeit, Abpraller, Waffenart — "kämpft weiter, wie er
  lebte", keine neuen Balance-Werte nötig). `updateGhosts()` sucht pro Tick
  den nächsten lebenden Gegner, dreht Rumpf+Turm dorthin, fährt in
  Zielrichtung (`resolveCircleWalls`, aber bewusst **ohne**
  `resolveTankBlocking` — Geister blockieren echte Panzer nicht und werden
  nicht von ihnen blockiert) und feuert bei ausreichender Ausrichtung +
  freier Sichtlinie (`clearLine()` aus `ai.js`, nutzt automatisch
  `state.blocksSight` — eine Rauchgranate aus Phase 6 blockiert also auch
  einen Geist).
- **Geister sind KEINE Einträge in `state.tanks`**, sondern ein eigenes
  `state.ghosts`-Array. Das erfüllt "blockieren keine Kugeln, sind nicht
  tötbar" automatisch durch Konstruktion — die Geschoss-vs-Panzer-Treffer-
  Schleife in `state.js` iteriert nur über `state.tanks`, ein Geist kann
  darin nie als Ziel vorkommen. `ai_turrets.js`/`ai_drives.js` bleiben
  unangetastet (die zielen strukturell fest auf `state.player`).
- **`killTank()` ist der einzige Erzeugungs-Hook** (nicht die Treffer-
  Schleife): jeder Gegnertod läuft durch `killTank()`, egal ob durch Kugel,
  Mine, Kamikaze oder Kettenblitz — passend zu "Kettenreaktionen sind das
  Ziel". Deckel `maxActive` per FIFO-Verdrängung (`state.ghosts.shift()`),
  nicht durch Verweigern neuer Geister — Muster wie die Krallenfalle-
  Obergrenze in `trap.js`.
- **Geister-Kugeln treffen den Spieler nie** (neuer Guard in der Treffer-
  Schleife: `t === state.player && b.owner?.isGhost` → `continue`, `friendly`
  reicht nicht, das schützt nur den Besitzer selbst). Geister-Kills zählen
  NICHT als Spieler-Trickshot/Ricochet (`b.owner` ist der Geist, nicht der
  Spieler — akzeptierter Nebeneffekt, dasselbe Muster wie beim Deflektor in
  Phase 6), stattdessen `state.ghostKills++` (Telemetrie-Feld seit Phase 1
  vorbereitet) und `b.owner.timeLeft += balance.ghost.killBonus`.
- **Darstellung**: neue lokale Funktion `drawGhosts()` direkt in
  `renderer.js` (Muster: `drawSmoke` aus Phase 6, bewusst nicht in
  `effects.js` — vermeidet einen zirkulären Import, weil `TANK_COLORS` in
  `renderer.js` liegt und `effects.js` bereits von `renderer.js` importiert
  wird). Einfache rotierte Wanne+Rohr-Form in `TANK_COLORS[typ]` bei fester
  Transparenz, keine der tankspezifischen Overlays (Schild/Panzerung/
  Powershot).

### Phase 8 (Gegner-Rollen statt Gegner-Typen) — gemergt
Statt neun eigener Fahr-/Turmfunktionen (eine pro Gegnertyp) gibt es jetzt
genau vier datengetriebene **Rollen** (`guardian`/`sapper`/`hunter`/
`sieger`), parametrisiert über `aggression`/`preferredRange`/`fireRate`/
`accuracy` in `data/tanks.json`. Rolle und Panzerung bleiben frei
kombinierbar (unverändert seit Phase 4).
- **`src/game/ai_drives.js`**: 4 statt 9 Funktionen. `guardian` bewegt sich
  nie (t_brown/t_green). `sapper` wandert ziellos, flieht bei Unterschreiten
  von `preferredRange` ("flieht vor dir" — aktuell von keinem Typ mit
  `preferredRange > 0` genutzt, t_grey/t_yellow/t_prism bleiben bei reinem
  Wandern wie bisher). `hunter` sucht Nähe + weicht Geschossen seitlich aus.
  `sieger` hält `preferredRange` als Abstandsband (orbitiert dazwischen).
  `aggression` (0–1) ersetzt die früheren, pro Verhalten fast identisch
  duplizierten `turnSpeed`-Werte durch einen einzigen Regler.
- **`src/game/ai_turrets.js`**: 1 statt 6 Funktionen (`roleTurret`).
  `accuracy` (0–1) ersetzt die vier diskreten Stufen
  `random_seek`/`weak_aim`/`aim`/`strong_aim`: `0` = rein zufälliger Schwenk
  ohne Spieler-Tracking (t_brown), `< 0.3` = zielt mit grobem Fehler und
  feuert auch ohne Sichtlinie, `≥ 0.3` = präzise, braucht Sichtlinie.
  Zwei orthogonale Sonderverhalten bleiben als eigene Mechanismen (keine
  Regler-Werte, echte Algorithmen): `leadAim` (Vorhaltezielen, früher
  `predict`, nur t_black) und `requiresBounceShot` (Abpraller-Rechner,
  früher `bounce_solver` — war in `ai_turrets.js` bereits gebaut, aber von
  KEINEM Typ referenziert; bleibt als Mechanismus erhalten, aber bewusst
  keinem aktuellen Typ zugewiesen, siehe `PLAN.md`-Umsetzungsfund).
- **`packFlank`** (Rudel-Flankierung ohne Sichtlinie, früher `purple_pack`,
  nur t_purple) lebt jetzt als Zweig direkt in `hunterDrive()`.
- **`phaseToggle`** (früher `white_phase`, nur t_white) wechselt generisch
  zwischen zwei ganzen ROLLEN (`{ roles: ["sieger","hunter"] }`) statt
  zwischen zwei hartkodierten Fahrfunktionen — Umschalt-Logik + Ton-Signal
  (`tone_high`/`tone_low`) unverändert, jetzt in `ai.js: activeRole()`.
- **`data/tanks.json`**: `ai.turret.*`/`ai.drive.*` (pro Verhalten
  dupliziert) → `ai.roles.*` (3 geteilte Konstanten-Blöcke) + `ai.escape`
  (Blockade-Freikommen, jetzt für alle Rollen gleich) + `ai.bounceShot`.
  Jeder Typ hat `role` + `aggression`/`preferredRange`/`accuracy` statt
  `turret`+`drive`-Namen; `fireCooldownS`-Override in `fireRate` umbenannt.
- Validiert über die bestehende 40-Seed-Regressionssuite: 40/40 Siege,
  0 Hänger — die Konsolidierung ändert die Gewinnbarkeit nicht.

### Phase 9 (Elite-Affixe, Wellen, additive Elite-Belohnung) — gemergt
- **Affixe gestaffelt nach Raumnummer** (`difficulty.json: elite.affixRules`):
  vor Raum 8 keiner, Raum 8–13 einer, ab Raum 14 zwei kombinierbar
  (`run.js: rollEliteAffixes()`). Zwei neue Affixe: `twinshot` (Gegner
  feuert zwei Kugeln gleichzeitig) und `regenerating_shield` (Ladung
  verfällt nicht, lädt sich nach `regenS` neu auf — nur beim günstigsten
  und teuersten Gegner der KI-Auswahl nach `difficulty.danger`-Punkten).
- **`twinshot` braucht keine neue Feuerlogik**: `tank.js: fireBullet()`
  liest `cfg.twinShot`/`cfg.twinSpreadRad` bereits generisch (Spieler-
  Upgrade "Doppelrohr") — der Affix setzt nur dieselben Felder auf dem
  Gegner, plus ein Magazin-Mindestwert von 2 (sonst wäre nach der ersten
  der beiden Kugeln kein Platz mehr für die zweite).
- **Affix-Rezeptur ist index-basiert, nicht Tank-basiert**: `run.js`
  würfelt Affixe + Index des günstigsten/teuersten Gegners VOR
  `createState()` über die reine Typliste und reicht sie als
  `eliteAffixes` durch. Grund: **Wellen** — `generateRoom()` erzeugt
  weiterhin die volle Spawnpunkt-Zahl, `createState()` instanziiert nur
  die erste Hälfte (`waveSplit`) und hält den Rest in `state.pendingWave`
  zurück (Typen + Spawnpunkte). `state.js: updateWave()` löst bei ≤50 %
  lebender Welle-1-Gegner eine 1-s-Vorwarnung aus (pulsierender Ring an den
  Spawnpunkten, Sound `'wave'`) und wendet beim Spawnen der zweiten Welle
  dieselbe `eliteAffixes`-Rezeptur erneut an (`applyAffixByIndex()`) — sonst
  hätte die zweite Welle keinen Affix bekommen.
- **`regenerating_shield`**: neues Feld `regenShieldTimer`, gestartet in
  `killTank()` beim Verbrauch der Ladung, heruntergezählt im bestehenden
  Tank-Tick-Loop — Gegenstück zum Schild-Verfall des Spielers (E2), keine
  zweite Ladungs-Verwaltung.
- **Elite-Belohnung additiv statt ersetzend**: `run.js: rollReward()` zieht
  jetzt IMMER die normale Dreierauswahl (Tag-Regel gilt) UND zusätzlich
  automatisch (ohne Schrottkosten) eine 4. Karte aus Tag `elite`
  (`upgradepool.drawOne()` wiederverwenden). Ist der Elite-Pool erschöpft
  (alle 3 Karten `maxStacks` erreicht), bleibt es bei 3 Karten statt eines
  zweiten Fallbacks.
- **Dritte Elite-Karte `kriegsbeute`** (sofort +5 Schrott): bewusst eine
  ökonomische Belohnung statt einer weiteren Kampfstat, um nicht mit
  bestehenden harten Obergrenzen (z. B. Abpraller-Deckel 2) zu kollidieren.
- **Darstellung**: Farbpunkte im Bogen über dem Panzer (ein Punkt je
  aktivem Affix) direkt in `renderer.js` (Muster `drawSmoke`/`drawGhosts`),
  plus pulsierender Warnring an Wellen-Spawnpunkten. Neuer Sound `'wave'`
  in `audio.js` (zwei kurze, drohende Töne) statt des bestehenden
  `'clear'`-Jingles, das am Ankunftspunkt einer zweiten Welle das falsche
  Signal wäre.
- Telemetrie sampelt `teleEnemies` jetzt jeden Tick statt einmalig pro
  Raum (`main.js`), da Wellen die Gegnerliste mitten im Raum verändern
  können; Feld `affix` (Singular) wurde zu `affixes` (Array).

### Phase 10 (Raum-Modifikatoren) — gemergt
Neu: **`data/modifiers.json`** (`minRoom: 3` + 9 Modifikatoren). Ab Raum 3
wird pro Kampf-/Eliteraum GENAU EINER geseedet gezogen (eigener RNG-Strom
`modifiers` in `makeRoomStreams()`), in der Vorschau sichtbar (`.pv-mod`,
analog zum Elite-Affix). Der Finalraum bleibt ausgenommen (wie Wellen in
Phase 9). `run.roomModifier` landet NICHT im `runSnapshot()` — Seed +
Raumnummer erzeugen ihn beim Fortsetzen deterministisch neu.
- **Neue, symmetrische Funktion `applyRoomModifier(cfg, modifier, isPlayer)`**
  in `cfg.js`: läuft nach `resolveCfg()`/`applyUpgrades()` in ALLEN drei
  Tank-Erzeugungsstellen (`createState()`, `respawnPlayer()`,
  `updateWave()` in `state.js`). `jammer` (`bulletSpeedMult`) und
  `overpressure` (`ricochetsBonus`) wirken auf Spieler UND Gegner gleich;
  `crowded` (`aggressionMult`) und `sniper_alley` (`roleOverride: 'sieger'`,
  nutzt Phase 8s Rollen-System) nur auf Gegner; `no_secondary` nur auf den
  Spieler (`cfg.secondaryDisabled = true`, geprüft ganz am Anfang von
  `useSecondary()` — bewusst NICHT `cfg.secondary = null`, sonst würde
  dessen `|| 'mine'`-Fallback die Sperre gleich wieder aufheben).
- **`crowded`** erhöht zusätzlich das Gefahrenbudget in `run.js:
  buildCombatRoom()` um `enemyBudgetMult` (50 %) — mehr/teurere Gegner,
  kompensiert durch die gesenkte Aggression.
- **`mirror_hall`**: `createState()` wandelt nach `buildWalls()` alle Wände
  vom Typ `solid` zu `reflect` (Phase-5-Mechanismus, `bullet.js`
  unverändert) — **`breakable` bleibt unangetastet**, sonst wäre die
  Wandzerstörung im ganzen Raum entwertet.
- **`slippery`**: echte Bewegungsphysik, nicht nur Kosmetik. `moveTank()`
  in `tank.js` gleicht bei `state.modifier?.slippery` die tatsächliche
  Geschwindigkeit (neue Felder `tank.iceVx/iceVy`) nur allmählich der
  Eingabe an (`gripPerSec` aus den Modifikator-Daten) statt sie pro Tick
  hart zu setzen — gilt dadurch automatisch für Spieler UND alle Gegner,
  ohne `ai_drives.js` anzufassen.
- **`fog`/`darkness`** sind rein optisch: neue Funktion `drawFog()` in
  `renderer.js` (Radialgradient um den interpolierten Spielerort,
  transparent im Kern → `fogColor` am Rand), ganz zuletzt in `render()`
  gezeichnet. Die KI-Sichtprüfungen (`clearLine()`/`blocksSight()`) und
  `accuracy` (Phase 8) bleiben unverändert — die beiden Modifikatoren
  schränken nur die Sicht des Spielers ein, nicht die KI-Zielgenauigkeit.
- Telemetrie-Feld `modifier` war seit Phase 3 als Platzhalter in
  `telemetry.js: recordRoom()` vorbereitet — `main.js` befüllt es jetzt
  (`teleModifier`, gleiches Muster wie `teleGhosts`).

### Phase 11 (Zerstörbare Wände) — gemergt
Neu: **`data/difficulty.json: destructibleWalls`** (`hits: 3`, `share:
0.25`). `generator.js: placeDestructibleWalls()` markiert nach
`placeReflectWalls()` in `buildGrid()` einen Anteil der INNEREN soliden
Zellen mit einem neuen Grid-Zeichen `'d'` (Aussenrand bleibt immer `'#'`).
- **`'d'` ist physisch identisch zu `solid`**: `state.js: isSolid()` und
  `generator.js: hasLos()` behandeln es genauso wie `'#'` — nur `buildWalls()`
  gibt dem Wandobjekt `type: 'destructible'` + `destructibleHits` mit, damit
  `bullet.js`/`mine.js` es gezielt ansprechen können, ohne jede normale Wand
  beschiessbar zu machen.
- **Kein zweiter Flood-Fill-Check nötig**: Die bestehende Erreichbarkeits-
  prüfung beim Raumbau (`placeSpawns()`) gilt bereits für den Zustand "alle
  zerstörbaren Wände intakt" (das ist ja physisch eine normale Wand). Da
  Zerstören eine Zelle immer nur in Boden verwandelt, kann die erreichbare
  Fläche dadurch nur gleich bleiben oder wachsen, nie schrumpfen — verifiziert
  in `phase11walls.mjs` (Fläche nach Abbau ALLER zerstörbaren Wände eines
  Raums ist immer ≥ vorher).
- **`state.destroyWall()` generalisiert** (schon für Baumeister-Transformation
  und Sperrmauer gebaut): liest die Haltbarkeit jetzt über
  `wall.customDurability || wall.destructibleHits || state.transform
  .wallDurability || 1` — kein drittes Parallelsystem.
- **Kugel UND Explosion zählen gleich** als ein Treffer: `bullet.js:
  moveAxis()` ruft bei `type === 'destructible'` `destroyWall()` auf und
  fällt (wie die Sperrmauer) in die generische Bounce-Behandlung durch —
  die Wand steht also noch und reflektiert normal, bis der letzte Treffer
  sie entfernt. `mine.js: explodeAt()` behandelt `destructible` genau wie
  `breakable` (ein `destroyWall()`-Aufruf pro Explosion, keine Sonderregel
  für mehr Schaden).
- **`run.js: buildCombatRoom()`** reicht `difficulty.destructibleWalls` als
  neuen `createState()`-Opt durch (Muster wie `modifier`/`eliteAffixes` aus
  Phase 9/10) — kein `isFinal`-Sonderfall nötig, `generateRoom()`s
  `fixedLayout`-Zweig und `buildFixedRoom()` für den Finalraum ignorieren
  den Parameter ohnehin (kein `buildGrid()`-Aufruf, keine `'d'`-Zellen).
- **Darstellung** (`renderer.js: drawWalls()`): eigener Riss-Overlay wie bei
  der Sperrmauer, aber schon unbeschädigt schwach sichtbar (kein
  `frac === 1`-Unsichtbarkeitsfall) — sonst wäre die Mechanik unentdeckbar,
  weil zerstörbare Wände sonst aussehen wie normale.

### Phase 11b (Performance-Budget) — gemergt
Neu: **`data/limits.json`** — enthält bewusst NUR die drei wirklich neuen
Deckel (`enemiesAlive: 12`, `mines: 8`, `particles: 300`). Drei der sechs
PLAN-Tabellenzeilen waren schon vorher durchgesetzt
(`balance.json: bullet.maxActiveCap` 8, `enemyBullet.maxActive` 24,
`ghost.maxActive` 4 aus Phase 1/7) — die Debug-Anzeige liest diese direkt
aus `balance.json` mit, statt sie zu duplizieren (jeder Cap-Wert hat genau
eine Quelle).
- **`particles`-Deckel war schon da, aber hartcodiert** (`280` inline in
  `state.js: spawnParticles()`) — jetzt `state.data.limits?.particles ?? 300`.
- **`enemiesAlive`** ist ein reines Sicherheitsnetz (Guard in `createState()`s
  Spawn-Schleife und `updateWave()`s Welle-2-Schleife), greift im normalen
  Spiel nie (Budget-Kauf max. 8, Finalraum max. 6 Spawns, beides < 12).
- **`mines`** ist EIN gemeinsames Budget für Spieler- UND Gegner-Minen
  zusammen (anders als der reine Gegner-Teilmengen-Deckel bei Geschossen,
  weil PLAN.md Minen als eine einzige Tabellenzeile führt) — verdrängt wird
  trotzdem nur von der ältesten GEGNER-Mine, eigene (Spieler-)Minen werden
  nie entfernt (dieselbe Asymmetrie wie beim Gegner-Geschoss-Deckel seit
  Phase 1, "Feuersperre statt Verdrängung").
- **Logik-/Render-Zeitmessung ohne Eingriff in `core/loop.js`**: `main.js`
  wickelt `update`/`render` in `timedUpdate`/`timedRender`
  (`performance.now()` um alle `update()`-Aufrufe eines echten Frames +
  einen `render()`-Aufruf), hält `worstLogicMs`/`worstRenderMs` als
  raumlokales Maximum (Reset in `resetRoomTelemetry()`, wie `teleMinFps`
  seit Phase 1). Bewusst NICHT in der Telemetrie — nur im F1-Debug-Overlay
  (`debug.js: drawPanel()`) sichtbar, zusammen mit der neuen Deckel-Tabelle
  (live/Cap je Zeile).
- FPS-Zähler + `minFps` in der Telemetrie existierten schon seit Phase 1 —
  unverändert.

### Phase 12 (Roguelike-Karte) — gemergt
Ersetzt die unsichtbare Raumtyp-Automatik (`rollNextType()`) durch einen
sichtbaren, wählbaren Kartengraphen. Die Raumlogik jedes Typs (`combat`/
`elite`/`treasure`/`workshop`/`event`) ist unverändert — nur wie der
nächste Raum bestimmt wird, ändert sich. Neuer Raumtyp: `cursed`.
- **`run.js: generateMap(seed, diff)`** baut den Graphen EINMAL bei
  `createRun()` (neuer Run-weiter RNG-Strom `rngForRun()` in `core/rng.js`,
  Gegenstück zu `rngFor()` ohne Raumnummer) — Reihe 1+2 je ein erzwungener
  `combat`-Knoten (`data/difficulty.json: map.forcedCombatLayers`), Reihen
  3–15 mit 2–3 Knoten (Typ aus `doors.weights`, jetzt inkl. `cursed`),
  letzte Reihe ein Boss-Knoten. `connectLayers()` verbindet 1-Knoten-Reihen
  mit ALLEN Nachbarn (Fächer, deckt auch "Zusammenläufe" vor dem Boss ab),
  sonst je Knoten eine Hauptkante + 40 % Chance auf eine Nebenkante, dann
  ein Nachreich-Pass gegen isolierte Zielknoten.
- **Sicherheitsnetz gegen Schatzkammer-Sackgassen**: führen alle Kanten
  eines Knotens zufällig nur zu `treasure` (bei ≤1 Leben nicht wählbar),
  färbt `generateMap()` die erste Alternative auf `combat` um — sonst wäre
  der Pfad dort blockierbar (fiel bei der 40-Seed-Gewinnbarkeitsprobe auf).
- **`chooseMapNode(run, nodeId)`** validiert Erreichbarkeit (`current.next`)
  + die alte Lebenregel für `treasure`; `afterRoomDone()` zeigt den
  Kartenscreen nur bei echter Verzweigung (`next.length > 1`), sonst
  automatischer Weiterzug wie der alte "erzwungene Kampf".
- **`cursed`** erzwingt über einen neuen dritten Parameter
  `rollEliteAffixes(run, enemyTypes, forceCount)` IMMER genau 1 Affix
  (bypasst `affixRules`s Raumstaffelung bewusst) und teilt sich sonst exakt
  den `treasure`-Belohnungszweig (nur Legendaries) — aber ohne dessen
  Lebenspreis.
- **`prevRoomType`** komplett entfernt: seine einzige Aufgabe (kein
  `event`/`workshop` zweimal hintereinander) lässt sich auf einem
  verzweigten Graphen nicht mehr sauber durchsetzen und wurde bewusst
  fallengelassen. `doors.firstDoorRoom` (4) ist durch `map
  .forcedCombatLayers` (2, PLAN.md: "Raum 1–2 immer combat") ersetzt.
- **`src/ui/mapscreen.js`** (neu): Knoten als Buttons (`ROOM_TYPE_INFO` aus
  `run.js` wiederverwendet, lag seit dem Türwahl-Rückbau ungenutzt im
  Code), Kanten als `<svg>`-Linien nach `offsetLeft`/`offsetTop` gezeichnet.
  Erreichbare Knoten hell + klickbar, aktueller Knoten grün, gesperrte
  Schatzkammern rot + deaktiviert, der Rest sichtbar, aber gedimmt.
- `mapCurrentId` (nicht der ganze Graph) landet in `runSnapshot()` — der
  Graph selbst ist aus Seed + `createRun()` deterministisch reproduzierbar.

### Phase 13 (Shop) — gemergt
Der Werkstatt-Raum aus Phase 4 wird zum Shop mit **fünf** Schrott-Aktionen:
Karte aus einem Fünferregal kaufen, Schildladung, Sekundärwaffe tauschen,
+1 Leben (einmal pro Besuch), Upgrade ablegen. Preise in
`data/balance.json: scrap.cost` (`shopCard: 5`, `shopSecondary: 6`,
`shopLife: 12`), Regalgröße in `balance.shop.cardChoices` (5).
- **Nur die Oberfläche heißt "Shop"** — Raumtyp-Schlüssel, `run.phase` und
  `leaveWorkshop()` bleiben `workshop`. Ein Durchbenennen hätte
  `doors.weights`, gespeicherte Zwischenstände, den Telemetrie-`roomType`
  (Bedeutungsänderung → `SCHEMA_VERSION`-Bump) und acht Regressionstests
  berührt. Umbenannt wurden nur Screen-Titel, `ROOM_TYPE_INFO.workshop`
  (jetzt „Shop" 🛒) und `createWorkshopScreen` → **`createShopScreen`**.
- **`applyUpgradeChoice(run, offer)`** (neu, aus `chooseUpgrade()`
  extrahiert) hält die Karten-Sonderfälle (Sekundärslot, Glaskanone,
  Notschild, Trophäe, Kriegsbeute, `tagCounts`) an genau EINER Stelle;
  Upgrade-Screen und `buyShopCard()` teilen sie sich. `chooseUpgrade()`
  hängt nur noch `afterRoomDone()` an, `buyShopCard()` nur die Kosten —
  **keine Shop-Aktion beendet den Raum**, erst „Verlassen".
- **`run.shopOffers` wird einmalig in `startNonCombatRoom()` gezogen**
  (nicht im Renderpfad — der Screen rendert nach jeder Aktion neu und
  würde das Regal sonst jedes Mal neu mischen). Gekaufte Karten bekommen
  `sold = true`, statt entfernt zu werden (stabile Slots); wer genug
  Schrott hat, kann alle fünf kaufen.
- **Nicht im `runSnapshot()`**: Seed + Raumnummer erzeugen denselben
  `upgrades`-Strom, das Regal entsteht beim Fortsetzen identisch neu
  (Muster wie `roomModifier` in Phase 10, per Test verifiziert).
- `buyShopSecondary()` setzt zusätzlich `run.upgrades[id] = 1`, damit die
  gekaufte Waffe nicht später nochmal als Karte im Pool auftaucht (gleiche
  Wirkung wie der Kartenwechsel aus Phase 6). `buyShopLife()` ist die
  einzige Aktion mit Besuchs-Gedächtnis (`run.shopLifeBought`).
- Telemetrie: neue `recordScrapSpend`-Typen `shopCard`/`shopSecondary`/
  `shopLife`; gekaufte Karten laufen zusätzlich durch `recordUpgrade()`
  (ohne abgelehnte Alternativen — im Shop lehnt man nichts ab).

### Phase 14 (Bosse) — gemergt
Ersetzt den alten handgebauten Finalraum (`data/tiles.json: finalRoom`,
jetzt entfernt) durch genau EINEN Boss-Raum am Run-Ende (Phase 12: letzte
Kartenreihe ist immer der Boss-Knoten) — `diff.finalRoom.bosses` (3 Namen)
wird deterministisch über `run.rng.enemies()` gewürfelt, die Arena kommt
über die Phase-0b-Weiche (`roomSpec.fixedLayout`) aus `data/arenas.json`.
PLAN.md nannte "alle 5 Räume" — veraltete Formulierung aus der Zeit vor
Phase 12, siehe Umsetzungsfund dort.
- **Der Reaktor** (`t_reactor`, `data/arenas.json: boss_reactor`):
  unverwundbar, solange mindestens einer von 4 Generatoren in den Ecken
  steht (`state.bossGeneratorsLeft`, Gate in `killTank()`, kein Verbrauch/
  Verfall). Generatoren sind ein neuer Wandtyp (`state.js:
  WALL_TYPES.g = 'generator'`, `data/balance.json: boss.generatorHits`),
  der wie eine zerstörbare Wand (Phase 11) über `destroyWall()` läuft,
  aber NUR Schaden nimmt, wenn die treffende Kugel schon `wallBounces > 0`
  hat (`bullet.js: moveAxis()` — ein direkter Treffer prallt wirkungslos
  ab). Explosionen (Minen, Kettenblitz) können Generatoren bewusst NICHT
  beschädigen (`mine.js: explodeAt()` nimmt sie nicht in den Zerstörungs-
  filter auf) — sonst wäre die Bankshot-Hürde umgehbar. Braucht sonst
  keine neue Logik: die Rolle bleibt `guardian` (steht fest, `roleTurret()`
  zielt/feuert normal).
- **Der Spiegel** (`t_mirror`, `boss_mirror`): Position + Fahrtrichtung
  sind jeden Tick die Punktspiegelung der Spielerposition durch die
  Raummitte (`WIDTH - p.x, HEIGHT - p.y`, neues Modul `src/game/bossai.js:
  stepMirrorBoss()`) — "kopiert deine Bewegungen gespiegelt". Die Arena ist
  bewusst punktsymmetrisch gebaut, damit jede erreichbare Spielerposition
  auf eine ebenso begehbare Bodenzelle spiegelt (keine eigene Kollisions-
  prüfung nötig). Stirbt nur an einer Kugel mit `wallBounces > 0` --
  wiederverwendet `requiresRicochet`/`armor.reflects` 1:1 vom Prisma
  (Phase 4), keine neue Trefferlogik.
- **Die Phalanx** (`t_phalanx` × 5, `boss_phalanx`): rotiert als starre
  Formation um die Raummitte (`bossai.js: stepPhalanxBoss()`,
  `tank.phalanxIndex` 0–4 einmalig in `createState()` vergeben,
  `data/balance.json: boss.phalanx.radiusPx/rotationSpeedRad`). Panzerung
  (`armor.arc: 60°`) ist absichtlich enger als die 72° Formationsabstand
  zum Nachbarn — die ungedeckte Lücke wandert dadurch kontinuierlich um
  die Formation und trifft jede Blickrichtung nur für Sekundenbruchteile.
  Auch hier keine neue Trefferlogik (wiederverwendetes `armor.arc`).
- **Zwei echte Sonderbewegungen bypassen `DRIVES`/`updateEnemy()` komplett**
  (`state.js: stepState()` prüft `t.cfg.mirrorBoss`/`t.cfg.phalanx` VOR dem
  normalen Rollen-Dispatch) — reine Funktionen von Zeit/Spielerposition,
  keine steer()-Physik. Turm/Feuerentscheidung bleibt trotzdem die normale
  `roleTurret()`-Logik, nur die Fahrfunktion ist ersetzt.
- **`resolveCfg()` ist eine explizite Whitelist** (Testfund): `cfg.js`
  musste `bossInvincible`/`mirrorBoss`/`phalanx` explizit wie
  `armor`/`requiresRicochet` durchreichen, sonst kommen sie nie im
  aufgelösten `cfg` an.
- **`arenaEnemySpawnCount()`** (neu, `generator.js`) lässt `run.js` vor
  `createState()` wissen, wie viele Panzer eine feste Arena aufnehmen kann
  (Boss-Typ(en) + gekaufte Unterstützung über `diff.finalRoom
  .supportBudget`, wie vorher, werden darauf gekürzt) — ohne die
  Grid-Scan-Logik zu duplizieren.
- **Darstellung ohne neue Asset-Dateien**: `sprites.js: SPRITE_ALIAS`
  bekommt drei neue Einträge (borgen sich vorhandene Wannen); Panzerungs-
  Overlay (`renderer.js: drawArmor()`) ist unverändert und zeichnet Spiegel/
  Phalanx automatisch korrekt (rotierender Rautenkranz bzw. Frontbalken,
  wie beim Prisma/Gepanzerten). Neu ist nur der Generator-Wand-Look
  (pulsierender Kern, Muster wie die Phase-11-Riss-Optik) und ein
  Warnring um den Reaktorkern, solange er unverwundbar ist.

### Phase 15 (Bewegliche Wände und Gefahren) — gemergt
Genau EIN Element pro Kampf-/Eliteraum ab Raum 3 (`data/tiles.json:
hazards.minRoom`), gewürfelt über einen eigenen RNG-Strom
(`run.rng.hazards`, Muster wie der Raum-Modifikator aus Phase 10).
- **Nachträglich aufgesetzt statt in den Generator eingewoben**:
  `generator.js: placeRoomHazard()` läuft NACH der schon validierten
  `buildGrid()`/`placeSpawns()`-Runde, deshalb ohne zweite
  Flood-Fill-Prüfung — Öl/Förderband/Laser etikettieren nur vorhandene
  Boden-Zellen um (keine Wandänderung), eine bewegliche Wand macht nur
  eine vorhandene solide Zelle reversibel (ihr offener Zustand kann die
  erreichbare Fläche nur vergrößern, derselbe Beweis wie bei zerstörbaren
  Wänden, Phase 11). Spieler-/Gegner-Spawns bleiben beim Würfeln
  ausgenommen.
- **Bewegliche Wand** (`state.js: tickMovingWalls()`): togglet alle
  `intervalS` Sekunden zwischen solid/offen — bleibt dabei eine ganz
  normale `'solid'`-Wand (kein neuer Grid-Charakter nötig), nur
  `state.walls` + das Grid-Zeichen werden periodisch aus-/eingehängt.
- **Ölpfütze**: teilt sich die Grip-Physik mit dem raumweiten
  Glatteis-Modifikator (Phase 10) — `tank.js: moveTank()` prüft jetzt
  `mod?.slippery || onOil` statt einer zweiten Implementierung.
- **Laserbarriere**: eigenes Array `state.laserWalls`, bewusst NICHT in
  `state.walls` — nur `bullet.js: moveAxis()` (und die Ziellinien-Vorschau)
  fragt es zusätzlich ab, `tank.js: resolveCircleWalls()` sieht es nie.
  So blockt sie Kugeln, aber keine Panzer, ohne Sonderfall in der
  Kollisionsroutine.
- **Förderband**: schiebt in `tank.js: moveTank()` nach der normalen
  Kollisionsauflösung unabhängig von der Eingabe, solange der Panzer auf
  einer Förderband-Kachel steht.
- **Zwei Whitelist-Fallen aus Phase 14 vorsorglich mitgeprüft**:
  `cfg.js: resolveCfg()` und `telemetry.js: recordRoom()` sind explizite
  Feld-Whitelists — das neue Telemetrie-Feld `hazard` (Muster `modifier`)
  wurde gleich mit explizitem Eintrag ergänzt.
- **Darstellung** (`renderer.js: drawHazards()`): Öl als dunkler
  glänzender Fleck, Förderband als scrollende Chevron-Pfeile in
  Schubrichtung, Laser als durchscheinender roter Streifen (Muster:
  Spiegelwand-Diagonalstreifen, aber halbtransparent — sonst wirkt "blockt
  nur Kugeln" wie ein Rendering-Bug), bewegliche Wand als Schienen-Rahmen,
  der auch geschlossen sichtbar bleibt.

### Phase 16 (Deckungs-KI) — gemergt
Gegner mit niedriger `aggression` versuchen, die Sichtlinie zum Spieler zu
brechen, sobald sie erkennen, dass gerade auf sie gezielt wird. Neuer Block
`data/tanks.json: ai.cover` (`aggressionThreshold: 0.3`, `checkHz: 15`,
`checksPerTick: 4`, `aimConeRad`, `aimRangePx`, `searchRadiusPx`,
`searchAngles`).
- **Dispatch-Override statt neuer Rolle**: `ai.js: updateEnemy()` ruft bei
  niedriger `aggression` UND erkanntem `tank.ai.threatened` statt
  `DRIVES[role]` die neue `ai_drives.js: coverDrive()` auf — Rolle,
  Panzerung, Minenlegen bleiben unangetastet, nur EIN Tick lang wird die
  Fahrfunktion ersetzt. Findet `coverDrive()` keinen Punkt, fällt es auf
  `DRIVES[role]` zurück (nie stehen bleiben).
- **"Im Ziel" bewusst grob**: `ai.js: isPlayerAiming()` prüft nur engen
  Kegel (`aimConeRad`) + Reichweite (`aimRangePx`) + freie Sichtlinie zum
  Spielerturm, kein exaktes Trefferbild — reicht als Auslöser zum Ducken.
- **15 Hz + Reihum-Verfahren wie im Plan gefordert**:
  `ai.js: updateCoverPerception()` läuft mit eigenem Timer
  (`state.coverTimer`, reset auf `1/checkHz`) und prüft pro Aufruf
  höchstens `checksPerTick` (4) Gegner ab einem wandernden
  `state.coverCursor` — bei mehr Gegnern dauert es mehrere Aufrufe, bis
  alle einmal geprüft wurden. `tank.ai.threatened` bleibt bis zum nächsten
  Check stehen (max. ~67 ms alt), für das Ausweichverhalten unmerklich.
- **`ai_drives.js: findCoverPoint()` ist bewusst kein Pathfinding**:
  samplet 8 Punkte im Ring (`searchRadiusPx`) um den Panzer, wählt den
  nächsten begehbaren, der die Sichtlinie zum Spieler bricht.
- **`guardian` bleibt explizit ausgenommen** (verlässt seine Zone laut
  Spec nie, Phase 8) — `aggression` ist für Guardian-Typen ohnehin nicht
  gesetzt und fällt in `cfg.js: resolveCfg()` auf 0.5 zurück (über der
  Schwelle), der Rollen-Ausschluss dokumentiert die Absicht aber explizit.
  `aggressionThreshold: 0.3` trifft aktuell `t_grey`/`t_yellow`/`t_prism`
  (Sapper, 0.17) und `t_armored` (Hunter, 0) — Sapper hatte laut Phase 8
  ohnehin schon ein dormantes Flucht-Feld (`preferredRange`), die
  Deckungssuche ist ihr erstes echtes defensives Verhalten.

### Phase 17 (Transformationen) — gemergt
Drei Karten desselben Tags schalten einen dauerhaften, immer aktiven Bonus
frei (`run.tagCounts[tag] >= TF.threshold`, `data/transformations.json`,
Freischaltung war seit dem v2-Rückbau E5 stillgelegt, `tagCounts` zählte
aber schon mit — reaktiviert statt neu gebaut).
- **`run.js: unlockTransformation(run, tag)`** wird ausschließlich aus
  `applyUpgradeChoice()` aufgerufen (dem gemeinsamen Kartenwahl-Hook aus
  Phase 13) — deckt damit automatisch sowohl den normalen Upgrade-Screen als
  auch im Shop gekaufte Karten ab, ohne einen zweiten Aufrufort zu brauchen.
  `run.newTransformation` trägt für genau einen Frame die ID der frisch
  freigeschalteten Transformation (Grundlage für den Freischalt-Text im
  Upgrade-Screen), danach wieder `null`.
- **Fünf Tags → fünf Transformationen**: `defense`→**Bollwerk**
  (Schildladungen altern nicht mehr, `ageShieldCharges(run)` in `run.js`
  bei aktiver Transformation übersprungen), `mobility`→**Kavallerie**
  (Dash-Cooldown halbiert + Unverwundbarkeit für die gesamte, halbierte
  Cooldown-Dauer statt nur des kurzen Basis-Iframes), `information`→
  **Taktiker** (Zeitlupe bei naher Kugel, unverändert seit E5),
  `terrain`→**Pionier** (Wände doppelt haltbar + eigene Sekundärwaffe
  schadet nicht mehr, unverändert seit E5), `control`→**Saboteur**
  (betäubte Gegner explodieren beim Aufwachen, unverändert seit E5).
- **Migration `baumeister`+`pionier` → `pionier`**: die beiden getrennten
  Alteinträge (`baumeister` mit gültigem Tag `terrain`, `pionier` mit dem
  seit dem v2-Umbau toten Tag `mine` — keine Karte trägt ihn mehr, der
  Eintrag war dadurch nie freischaltbar) sind zu einem Eintrag
  zusammengeführt: Tag `terrain`, beide Effekte (`wallDurability`,
  `ownMinesHarmless`) gleichzeitig.
- **Kavallerie komplett neu geschrieben**: der alte Effekt
  (`ramKillsNonElite`/`ramProtectS`) basierte auf der in E5 gestrichenen
  Rammmechanik und war seitdem tot. Neuer Effekt `dashCooldownMult: 0.5`,
  verdrahtet in `tank.js: dashTank()` gegen das bestehende
  `cfg.dash = {dist, iframe, cooldown}` — **kein neues `cfg.js`-Feld
  nötig**: wie alle anderen Transformationen liest `dashTank()` den Wert
  live aus `state.transform` an der einzigen Stelle, die ihn braucht.
  Wirkt nur mit der `dash`-Upgrade-Karte — der Upgrade-Screen zeigt dafür
  den Hinweis „(nur mit Dash-Karte)" an, solange `run.upgrades.dash` noch 0
  ist (sonst wäre eine freigeschaltete, aber wirkungslose Transformation
  unbemerkt nutzlos).
- **Effekte werden einmal pro Raumaufbau gebacken** (`state.transform` aus
  `transformEffects(run)`, `buildCombatRoom()`s `createState()`-Opt) —
  dasselbe Muster wie Raum-Modifikatoren (Phase 10) und Raum-Gefahren
  (Phase 15). Eine mitten im Raum frisch freigeschaltete Transformation
  wirkt daher erst im nächsten Raum.
- **`run.shieldCharges` ist zur Laufzeit nicht die Quelle der Wahrheit**:
  `stepRun()` synchronisiert jeden Tick `run.shieldCharges = st.shieldCharges`
  (Raum-Zustand → Run-Objekt) — Bollwerks Sperre für `ageShieldCharges()`
  muss deshalb am tatsächlich alternden `state.shieldCharges` ansetzen.
- **`src/ui/upgradescreen.js`**: neuer Block zeigt „Aktiv: …" (freigeschaltete
  Transformationen) und „Fortschritt: …" (`tagCounts[tag]/threshold` für
  Tags mit mindestens einer gewählten Karte, aber noch nicht freigeschaltet)
  direkt unter der Schrott-/Untertitelzeile — ohne sichtbaren Fortschritt
  würde die Mechanik unbemerkt verpuffen.

### Phase 18, Welle 1 (Kartenwellen) — gemergt
Erste von mehreren geplanten Wellen (Phase 18 läuft über mehrere Sessions).
Vier neue Karten in `data/upgrades.json` + Freigabe von `doppelrohr`, das seit
seiner Migration (Phase 2) nie erreichbar war.
- **`src/game/upgradepool.js: WEAPON_ALLOWLIST`**: der Tag `weapon` bleibt
  grundsätzlich gesperrt (spätere Waffenkarten bekommen laut Plan bewusst
  jeweils ihr eigenes Physikverhalten und werden einzeln freigeschaltet) —
  nur `doppelrohr` und das neue `flak` sind namentlich erlaubt.
- **`flak`** (Tag `weapon`, `rare`): eigene Physik statt eines weiteren
  `allExplosive`-Klons von Sprengmunition/Glaskanone. Neues Bullet-Feld
  `burstDistance` (`bullet.js`) lässt jeden Schuss nach einer kurzen, festen
  Reichweite (`burstRangePx`) in der Luft zünden — unabhängig von Wand- oder
  Zielkontakt, über denselben `explosive`-Sterbe-Mechanismus wie die
  bestehenden Explosiv-Karten (`state.js`, unverändert). `traceTrajectory()`
  übernimmt `cfg.burstRangePx` automatisch, damit die Ziellinie nicht länger
  wirkt als der echte Schuss.
- **`feuerleitzentrale`** (Tag `scaling`, `requires: ["doppelrohr"]`,
  `maxStacks: 2`): erste Karte, die den seit Phase 2 ungenutzten
  `requires`-Filter in `upgradepool.js` tatsächlich benutzt. Verengt den
  Doppelrohr-Spreizwinkel; Reihenfolge in `cfg.js` bewusst nach dem
  `doppelrohr`-Block, sonst wäre `twinSpreadRad` beim Verengen noch
  ungesetzt.
- **`ballistikrechner`** (Tag `information`): reine Anzeige, keine neue
  Physik. `effects.js: drawAimLine()` markiert jetzt ALLE Abpraller-Punkte
  der Vorschau statt nur den ersten und bekommt dafür ein längeres
  `tailSteps`-Fenster (90 statt 45 Schritte) — sonst reicht das kurze
  Standard-Tail nie bis zum zweiten Wandkontakt.
- **`pluenderer`** (Tag `resource`, erste Karte dieses Tags): flacher
  Schrott-Bonus pro geräumtem Raum, wirkt in `run.js` NACH dem
  Elite-Multiplikator — wie die einmalige Kriegsbeute-Belohnung auch kein
  Vielfaches ist.

### Phase 18, Welle 2 (Kartenwellen) — gemergt
Fünf neue Karten, gezielt gegen die nach Welle 1 dünnsten Tags
(`resource`/`information`/`defense`/`synergy` hatten je nur 1–2 Karten) statt
einer echten Nie-gewählt-Telemetrieauswertung (`localStorage.runs` ist in
dieser Umgebung leer — Tag-Verteilung war der verfügbare Ersatz).
- **`beutejagd`** (Tag `resource`): Bonus-Schrott für den ERSTEN Kill in
  jedem Raum. Eigener Raum-Zähler `state.bonusScrap` + `state.firstKillGiven`
  (Muster 1:1 wie `trickshotScrap`, Phase 5) — `run.js` synchronisiert beide
  Zähler identisch per Delta, `state.js` kennt weiterhin kein `run`-Objekt.
  `firstKillGiven` wird nur in `createState()` gesetzt (nicht in
  `respawnPlayer()`): der Bonus gilt pro Raum, nicht pro Leben.
- **`nachtsicht`** (Tag `information`): hebt die Nebel-/Dunkelheit-Sichtblende
  des Raum-Modifikators (Phase 10) für den Spieler auf — ein zusätzliches
  `return` in `renderer.js: drawFog()`, KI-Sichtlinien bleiben unverändert.
- **`nachladeschild`** (Tag `defense`, `requires: ["schild"]`): Schild lädt
  sich nach `regenS` von selbst neu. Wiederverwendet den
  `regenShieldTimer`-Tick 1:1, den das Elite-Affix "Regenerierschild"
  (Phase 9) in `stepState()`s Panzer-Schleife bereits generisch für JEDEN
  Panzer (nicht nur Gegner) gebaut hatte — nur der Timer-Start beim
  Schildverbrauch (`killTank()`s Spieler-Zweig) war neu.
- **`meisterschuetze`** (Tag `synergy`): verdoppelt die Trickshot-Belohnung
  (Phase 5) — reiner Multiplikator an der einzigen Stelle, an der
  `trickshotScrap` entsteht (`state.js`), auch der Floating-Text zeigt den
  bereits multiplizierten Wert.
- **`erschuetterungsdash`** (Tag `control`, `requires: ["dash"]`): Dash stößt
  nahe Gegner weg und betäubt sie kurz, unabhängig von der Sekundärwaffe.
  Zweite echte `requires`-Karte (nach `feuerleitzentrale`) und schließt eine
  echte Pool-Lücke: alle fünf bisherigen `control`-Karten sind über
  `MINE_ONLY_IDS` an die Minen-Sekundärwaffe gebunden (Phase 6) — mit
  Enterhaken/Sperrmauer/Rauch/Deflektor ausgerüstet gab es im Tag `control`
  bislang gar keine Karte. Eigene `dashShock*`-cfg-Felder statt Wiederver-
  wendung von `schockwelle`s Feldern, damit beide Karten gleichzeitig
  ausrüstbar bleiben, ohne sich gegenseitig zu überschreiben.

### Phase 2 (Upgrade-Schema) — gemergt
- **Neues Upgrade-Schema** in `data/upgrades.json`: jeder Eintrag hat `id`,
  `tag`, `rarity` (`common`/`rare`/`legendary`), `maxStacks`, `requires`,
  `minRoom`, `description`. Alle 39 Altupgrades migriert. (`desc`/`max`
  ersetzt durch `description`/`maxStacks`; Berserker-Effektfeld heißt jetzt
  `maxStacksEffect`, um mit dem Schema-`maxStacks` nicht zu kollidieren.)
- **Auswahllogik** `src/game/upgradepool.js`: 3 Karten, **nie zwei gleiche
  Tags**; Rarity-Gewichte + `legendary.minRoom` aus `balance.json`;
  `maxStacks`/`requires`/`minRoom` gefiltert; Tags `weapon`+`elite` vom
  Pool ausgeschlossen; zu wenige Karten → mit `stat`-Fallback aufgefüllt
  (kein Crash). `run.js` delegiert `rollOffers` daran (deterministisch über
  `genRng`).
- **`emergency_shield`** (Tag `defense`, `rare`, `maxStacks 3`): je Stufe
  +1 Schildladung (`chargesPerStack`, max. 3 gesamt), raumübergreifend
  (`run.shieldCharges` → `state.shieldCharges`), keine Regen. Jede Ladung
  absorbiert genau einen Treffer (in `killTank` vor der alten Schild-Logik).
  Anzeige als konzentrische Ringe um den Panzer.
- **Telemetrie** protokolliert gewählte/abgelehnte Karten jetzt als Objekte
  mit `id` + `tag` (+ name/rarity).
- Upgrade-Karten zeigen Tag + Seltenheit (Rahmenfarbe nach Rarity in `style.css`).

### Phase 3 (Schrott-Währung) — gemergt
- **Schrott** als Run-State (`run.scrap`), Werte in `data/balance.json`
  (`scrap.perRoom [1,3]`, `eliteBonus 3` (erst Phase 4), `cost.reroll 2`,
  `cost.ban 1`, `cost.fourthCard 3`, `cost.shieldCharge 4`). Pro geräumtem
  Raum 1–3 Schrott (deterministisch über `genRng`) + Floating-Text
  „+N Schrott". Permanent im HUD (`⚙ N`).
- **Vier Upgrade-Screen-Aktionen** (`src/game/run.js`: `rerollOffers`,
  `banOffer`, `buyFourthCard`, `buyShieldCharge`; UI in `upgradescreen.js`,
  verdrahtet in `main.js`): Neu würfeln, Verbannen (pro Karte, ✕-Knopf),
  Vierte Karte (Deckel 4), Schildladung (+1, auch ohne Schild-Upgrade). Preis
  sichtbar, ausgegraut bei zu wenig Schrott; Screen rendert nach jeder Aktion
  neu. Schrott nie negativ (jede Aktion prüft Kosten).
- **Verbannte ids** in `run.bannedUpgrades` (Set, nicht `localStorage`); der
  Pool filtert sie. Bei Run-Ende weg (frischer `createRun`). Ban ersetzt die
  Karte durch eine neue mit anderem Tag (`upgradepool.drawOne`).
- **Telemetrie**: `scrapEarned` pro Raum, `scrapSpends` (Typ+Raum),
  `bans` (id+Raum) im Run-Objekt; Debug-Tabelle zeigt Schrott/Verbannt.
- **Blutrausch** abgeschwächt: Unverwundbarkeit pro Kill nur noch
  `iframeS 0.35` (statt 1,4 s), Tempo-Schub bleibt. Text „nach jedem
  getöteten Gegner".
- **Endlosmodus-Fix**: nur ein NEU auf dem Endscreen begonnener Tipp führt
  ins Menü (der spielbeendende Tipp löste sonst sofort `backToStart`).

### Rückbau nach PLAN.md v2 (E5) — gemergt
`PLAN.md` v2 ersetzt v1 und verwirft mehrere bereits gebaute Mechaniken.
Zurückgebaut wurde:
- **Begleiter**: `kampfdrohne`, `klingenkranz`, `beutepanzer` entfernt
  (Karten + `cfg.drone`/`cfg.blades` + `updateDrone` + Rendering).
- **Rammen/Kontaktschaden**: `rammklinge` entfernt, `applyMelee` gelöscht.
- **Türwahl mit zwei Türen**: ersetzt durch geseedete automatische Wahl des
  nächsten Raumtyps (`rollNextType`). Die **Raumtypen bleiben** (combat,
  elite, treasure, workshop, event) — v2 nutzt sie als Knotentypen in
  Phase 12. `pickDoor`, `doorOffers` und das Tür-Overlay sind weg.
- **Transformationen**: auf Phase 17 verschoben und stillgelegt.
  `run.tagCounts` zählt weiter (Telemetrie), `data/transformations.json`
  bleibt als Definition für Phase 17. Freischaltung + Overlay + Tag-Zähler
  im Upgrade-Screen sind ausgebaut.
- **Tags auf das v2-Schema**: `pact`, `companion` und `mine` gestrichen.
  Umgehängt: sprengmunition/streumine→`reactive`, glaskanone→`scaling`,
  kettenglied/sprengkraft→`stat`, fernzuender/annaeherungsmine/klebemine→`control`.
  39 Karten, alle Tags gültig.

### Balance-Anpassungen (Nutzer-Feedback) — gemergt
- **Wurfweite −25 %**: `mine.throwPx` 96→72 (Tastatur/Gamepad),
  `MINE_MAX_THROW` 190→142 (Touch-Wurfstick, `touchcontrols.js`).
- **Notschild schwächer**: `chargesPerStack` 3→1 (max. 3 statt 9 Ladungen).
- **Radius-Prozente gesenkt**: Sprengkraft +40 %→+25 % pro Stufe (neues
  Datenfeld `sprengkraft.radiusMult`, statt hartkodierter 1.4 in `cfg.js`);
  Überladung +50 %→+30 % (`ueberladung.mult` 1.5→1.3).

### Bugfixes (Code-Review nach Phase 18 Welle 2) — gemergt
- **Regenerierschild-Affix zeigte sich auf dem falschen Gegner** (Phase 9):
  `state.js: applyAffixByIndex()` trug `t.affixes` pauschal aus der ganzen
  Rezeptur ein, obwohl `regenerating_shield` laut Design nur den billigsten
  und teuersten Gegner trifft (`cheapestIdx`/`priciestIdx`). Dadurch zeigte
  **jeder** Gegner im Raum den Schild-Farbpunkt (`renderer.js`) und landete
  mit dem Affix in der Telemetrie (`main.js: teleEnemies`), auch wenn er gar
  keine Ladung hatte. Jetzt wird `t.affixes` erst an der Stelle befüllt, an
  der ein Affix tatsächlich angewendet wird — Anzeige und Telemetrie stimmen
  wieder mit der echten Wirkung überein. Regressionstest ergänzt
  (`phase9elite.mjs`, Abschnitt 4).

### Code-Review-Pass 2 + Plan-Überarbeitung — gemergt
Vollständige Code-Durchsicht nach Phase 18 Welle 2. Zwei echte, behobene
Fehler + eine strukturelle Lücke geschlossen:
- **Ziellinien-Crash** (`bullet.js: moveAxis()`): `traceTrajectory()`s
  Schatten-State hat kein `destroyWall()` — zeigte die Ziellinie auf eine
  zerstörbare Wand (Phase 11, ~25 % der Innenwände!), Sperrmauer oder
  Generator-Wand (nach Abpraller), warf jeder Frame einen `TypeError`.
  Fix: `state.destroyWall?.(wall)` an beiden Aufrufstellen — die Vorschau
  prallt jetzt ab, ohne die Wand zu beschädigen. Headless-Tests konnten das
  nie sehen (kein Renderpfad).
- **Wellen-Freigabe-Race** (`run.js: stepRun()`): Starben die letzten
  Welle-1-Gegner während der 1-s-Vorwarnung, galt der Raum als geräumt und
  die zweite Welle wurde verschluckt. Fix: Freigabe zusätzlich an
  `!st.pendingWave` gebunden.
- **`tests/regression.mjs` eingecheckt** (NEU, `node tests/regression.mjs`):
  Die früheren Suiten (`phase4.mjs`, `phase11walls.mjs`, …) waren nur
  session-lokal und sind mit den Containern verloren gegangen. Die neue
  Suite: 5 Seeds deterministisch bis zum Sieg über alle 16 Räume (inkl.
  Karte/Shop/Event/Boss), Ziellinien-Trace gegen alle Wandtypen + in jedem
  echten Raum, Wellen-Freigabe-Guard, Determinismus-Probe. Schlägt gegen den
  ungefixten Stand nachweislich bei beiden Fehlern an.
- `telemetry.js: GAME_VERSION` war seit v39 eingefroren — jetzt an den
  sw.js-Cache-Namen gekoppelt (v56) und bei jedem SW-Bump mitziehen.
- `PLAN.md`: Review-Pass am Dateianfang dokumentiert (beide Bugs, Test-
  Struktur), Phase 7b explizit als nächste Session festgeschrieben,
  Phase-18-Welle-3-Reihenfolge entsprechend korrigiert.

### Phase 7b (Audio) — gemergt
Nachgeholt nach dem Code-Review-Pass 2. Alle Töne werden weiterhin
prozedural synthetisiert (kein Sound-Asset), aber **jede Zahl** liegt jetzt
in **`data/sounds.json`** statt in einer if/else-Kette in `audio.js`:
Wellenform, Frequenzverlauf (`slideTo`), Dauer, Lautstärke, Filter,
Mehrton-Folgen (`at`), Rauschanteil — plus der Musik-Loop (Bass/Lead-Noten,
Schrittdauer), der ebenfalls hartkodiert war.
- **Ortsgebundene Sounds werden gepannt**: `state.sounds` nimmt jetzt
  **beides** an — einen reinen Namensstring für globale Ereignisse
  (`clear`, `upgrade`, `fanfare`, `wave`, `combo`) und `{ name, x }` für
  ortsgebundene (Schuss, Abpraller, Explosion, Mine, Tod, Trickshot).
  `main.js` normalisiert beim Abspielen, `audio.setPanWidth(WIDTH)` liefert
  die Arenabreite (strukturelle Konstante aus `config.js`, deshalb NICHT in
  `sounds.json` — dort steht nur die Stereobreite `pan.maxAbs: 0.75`).
  Vorteil des Doppelformats: kein Umbau aller ~30 Push-Stellen und
  `bullet.js`s Schattenzustand (`traceTrajectory`, hat gar kein `sounds`)
  bleibt über `state.sounds?.push(...)` unangetastet.
- **`killTank()` trennt die Todesarten** (der offene Fehler aus PLAN.md):
  `'player_death'` (lang, tief, Rauschanteil, Lowpass) vs. `'kill'` (kurz,
  knackig) statt eines gemeinsamen `'death'`. Zusammen mit `'shield'` sind
  Leben-, Schild- und Gegnerverlust hörbar unterscheidbar.
- **`'reflect'` ist neu und löst eine Doppelbelegung auf**: Prisma-/
  Panzerungs-Reflexion (`armor.js`) und Schildverlust (`state.js`) spielten
  beide `'shield'` — genau die Verwechslung, die die Phase vermeiden soll.
  Der unverwundbare Reaktorkern (Phase 14) nutzt jetzt ebenfalls
  `'reflect'` (dort geht auch nichts verloren). Dazu ein **sichtbarer
  Blitz** (`state.flashes`, wiederverwendeter Mündungsblitz) — Plan-Auflage
  „jede Information per Ton braucht ein sichtbares Gegenstück".
- **Minen-Warnpuls** (`mine_warn`, Takt `sounds.json: mine.warnPulseS`):
  über einen Zähler `mine.warnPulses` statt eines Countdown-Timers
  gerechnet, sonst hätte die Trickshot-Zeitlupe (Phase 5 skaliert `dt`) den
  Takt hörbar verzogen. Sichtbares Gegenstück ist das bestehende schnelle
  rote Blinken.
- **`shoot_enemy`**: Gegnerschüsse klingen eine Oktave tiefer + Lowpass —
  erst Klangfarbe *und* Ort zusammen beantworten „wer schießt woher?".
  Geisterpanzer (Phase 7) benutzen bewusst den freundlichen `shoot`-Ton.
- **`upgrade`**: eigener Bestätigungston für die Kartenwahl (Upgrade-Screen
  wie Shop, über `applyUpgradeChoice()` — derselbe gemeinsame Hook wie
  Transformationen).
- **Stimmen-Deckel** `limits.maxVoicesPerName: 3` (20-ms-Fenster): eine
  Kettenreaktion aus acht Minen hätte achtmal `boom` gleichzeitig gestartet.
  Muster wie die Entitäten-Deckel aus Phase 11b; bewusst zeitfensterbasiert,
  damit `main.js` keinen `beginFrame()`-Vertrag mit dem Audio-Modul braucht.
- **Regressionstest gegen stumme Ereignisse**: `tests/regression.mjs`
  scannt alle `sounds.push(...)`-Aufrufe im Quellcode und prüft, dass jeder
  Name in `data/sounds.json` steht (ein Tippfehler macht ein Ereignis sonst
  lautlos, ohne Fehler). Dazu Formprüfung jeder Meldung im echten Lauf,
  Warnpuls-Takttest und die Zusicherung, dass `'death'` nicht zurückkehrt.

### Phase 18, Welle 3 (Kartenwellen) — gemergt
Sechs neue Karten. **Der eigentliche Fund war ein Bug, keine Kartenidee:**
`run.tagCounts` zählt Stacks, die Transformations-Schwelle ist 3 — der Tag
`terrain` hatte aber nur zwei Karten mit je `maxStacks: 1`. **Pionier war
mathematisch nie freischaltbar.** Dasselbe bei *Saboteur* (`control`):
vier der sechs Karten hängen an `MINE_ONLY_IDS` (Phase 6), mit einer
anderen Sekundärwaffe blieben ebenfalls nur 2 Punkte. *Taktiker*
(`information`) lag mit exakt 3 von 3 auf der Kippe. Welle 3 legt deshalb
gezielt auf diese drei Tags: `terrain` 2→6, `control` ohne Mine 2→4,
`information` 3→5.
- **`sappeur`** (terrain, `maxStacks 2`): rissige Wände (Phase 11) halten
  pro Stufe einen Treffer weniger aus. Wirkt in `state.js: destroyWall()`
  bewusst NUR auf `destructible` — nicht auf die eigene Sperrmauer
  (`customDurability`) und nicht gegen die Pionier-Transformation.
- **`steinbruch`** (terrain, `maxStacks 2`): eingerissene Wände lassen
  Schrott zurück, über den `state.bonusScrap`-Zähler aus Welle 2 (kein
  zweiter Sync-Mechanismus). Die eigene Sperrmauer ist ausgenommen — sonst
  wäre „Wand legen, kaputtschießen, wiederholen" eine Schrott-Druckmaschine.
- **`minenspuerer`** (information): Restzeit-/Radiusring auch für
  gegnerische Minen (`effects.js: drawMines`, eine Bedingung erweitert).
- **`gefahrensinn`** (information): Warnring um Gegner, die den Spieler im
  Rohr haben. **Kostet keinen zusätzlichen Raycast** — `updateEnemy()`
  berechnet die Feuerfreigabe ohnehin, `state.js` legt sie als
  `t.aimingAtPlayer` ab (auch in `bossai.js`), der Renderer liest nur.
  Phase 11b nennt die Sichtlinien-KI ausdrücklich als Frame-Budget-Risiko.
- **`abprallschock`** (control, `maxStacks 2`): erste Karte, die den
  Wandabpraller selbst zum Kontrollwerkzeug macht statt ihn nur zu
  belohnen. Wirkt auch an Spiegelwänden; betäubt bewusst nur die Bewegung
  (`stunTimer`), nicht den Turm — Turm-Einfrieren bleibt der EMP-Mine.
- **`doppelschlag`** (synergy): ein Trickshot-Kill lädt eine
  Powershot-Ladung nach (gedeckelt). **Brauchte einen NaN-Schutz:**
  `tank.js: fireBullet()` multipliziert bei vorhandenen Ladungen ungeprüft
  mit `cfg.powershotSpeedFactor` — ohne die Powershot-Karte wäre die
  Kugelgeschwindigkeit `NaN` gewesen. `cfg.js` übernimmt die Werte aus der
  `powershot`-Definition (eine Quelle).
- **Drei neue Struktur-Tests** in `tests/regression.mjs`, jeder mit
  bestandener Gegenprobe: (1) jede Transformation ist mit dem vorhandenen
  Pool freischaltbar — mit UND ohne Minen-Sekundärwaffe; (2) jede Karte ist
  überhaupt ziehbar (der `doppelrohr`-Fehler) plus die Prüfung, dass kein
  `requires` auf eine nicht existierende id zeigt; (3) der komplette
  Effekt-Renderpfad wird mit einem Fake-Canvas headless gezeichnet, alle
  Anzeige-Upgrades aktiv — **bis dahin führte die Suite nie eine einzige
  Zeichenfunktion aus**, genau der blinde Fleck hinter dem Ziellinien-Crash.
- Auswahl weiterhin per Pool-Analyse statt Telemetrie (`localStorage.runs`
  ist leer). Die Telemetrie-Auswertung ist im Plan als nachzuholende
  Balance-Anpassung festgehalten, nicht als Voraussetzung.

### USP-Prüfpunkte gemessen (PLAN.md „Prüfpunkte") — gemergt
Kein neues Feature, sondern die nie durchgeführte Abnahme des Kernversprechens.
- **Kennzahl 1 „Erzwungene Bankshots" war um fast die Hälfte verfehlt.**
  Der Plan notierte „Design-Kontrolle über den Generator, keine Messung" —
  tatsächlich hängt die Gegnerauswahl allein am Seed, die Zahl ist also ohne
  gespielte Runs bestimmbar. Neues Werkzeug **`tests/uspcheck.mjs`**
  (`node tests/uspcheck.mjs [seeds]`) spielt N Runs durch und zählt:
  **32,9 %** statt der geforderten 60 % (40 Runs, 328 Kampfräume ab Raum 5).
  Ursache: `buyEnemies()` zieht rein zufällig, ein Prisma kostet 7 Punkte
  und ist einer von elf Typen.
- **Behoben über `data/difficulty.json: bankshotGuarantee`** (`minRoom: 6`,
  `chance: 0.58`, `types: ["t_prism"]`): `run.js: ensureBankshotEnemy()`
  **tauscht** in einem Teil der Räume den teuersten gekauften Gegner gegen
  einen Bankshot-Typ — bewusst tauschen statt ergänzen, damit das
  Gefahrenbudget des Raums unverändert bleibt und der Raum nicht voller,
  sondern nur anders zusammengesetzt wird. Jetzt **61,9 %**.
  ⚠️ **Das macht das Spiel spürbar härter** (Prismen in ~62 % statt ~33 %
  der Räume ab Raum 5). Zurückdrehen = `chance` senken, sonst nichts.
- **Zwei Feststellungen aus der Messung:** (1) Raum 5 kann die Quote
  strukturell nie erfüllen, weil `t_prism` laut Phase 4 erst ab Raum 6
  freigeschaltet ist (0 von 26 Räumen) — die Chance ist entsprechend höher
  gewählt, statt die Kennzahl auf „ab Raum 6" schönzurechnen. (2) Ein
  gepanzerter Gegner steht ohnehin in 66–82 % der Räume, zählt hier aber
  bewusst nicht mit: `armor.arc` erzwingt eine Flanke, keinen Bankshot.
- **Kennzahl 3 „Freiwillige Bankshots" ist jetzt messbar** (der Plan nennt
  sie „die einzige Zahl, die wirklich misst, ob der USP trägt", das
  Instrument fehlte aber): `state.voluntaryRicochetKills` zählt Abpraller-
  Kills nur an Gegnern OHNE `requiresRicochet`. Die Debug-Ansicht zeigt
  Quote **und Verlauf über die Runs** — der Plan verlangt nicht einen
  Absolutwert, sondern dass die Zahl *steigt*.
- **Wächter in der Regressionssuite**: die Quote wird bei jedem Lauf
  deterministisch nachgemessen; fällt sie unter 60 %, wird die Suite rot.
  Gegenprobe bestanden (Garantie abgeschaltet → 32,9 %, Suite rot).

### Bugfix: Kartenscreen blockierte den Run (Nutzer-Meldung) — gemergt
**Symptom:** Einen Raum auf der Karte anklicken → „funktioniert nicht und
ich kann nichts mehr machen."
**Ursache:** `src/ui/mapscreen.js` war der EINZIGE der fünf Overlay-Screens,
der sich im Click-Handler nicht selbst versteckt hat. `hide()` existierte,
wurde aber nur von `hideRoomScreens()` (Run-Start/Menü) aufgerufen. Die
Knotenwahl selbst lief korrekt durch — der neue Raum wurde gebaut und die
Vorschau darunter eingeblendet —, aber das `#map`-Overlay blieb darüber
liegen und fing jeden weiteren Klick ab. Zu Fuß nicht mehr auflösbar.
**Fix:** `if (onChoose(node.id) !== false) el.classList.add('hidden')` —
dasselbe Muster wie `preview.js`, `upgradescreen.js`, `roomscreens.js`.
`main.js` gibt dafür jetzt den Rückgabewert von `chooseMapNode()` durch,
damit ein (theoretisch) abgelehnter Zug das Overlay offen lässt statt den
Run ohne sichtbare Karte hängen zu lassen.
- **Der eigentliche Befund ist der blinde Fleck:** kein Test hatte die
  UI-Schicht je berührt (dieselbe Lücke wie beim Ziellinien-Crash, wo der
  Renderpfad ungetestet war). Neu: **`tests/domstub.mjs`** — ein minimales
  DOM (~150 Zeilen, keine npm-Abhängigkeit, passt zur „kein Build-Schritt"-
  Regel) mit Elementbaum, `classList`, `dataset`, Attributen,
  `addEventListener`/`click` und den Layout-Feldern, die `mapscreen.js` zum
  Kantenzeichnen liest. Die Suite prüft damit: Overlay schließt bei gültiger
  Wahl, bleibt bei abgelehnter Wahl offen, gesperrte Schatzkammer löst keine
  Wahl aus. Gegenprobe bestanden (Fix ausgebaut → Test meldet den Blocker).
- Zusätzlich abgesichert: über 200 Seeds führt **kein** Kartenknoten
  ausschließlich zu Schatzkammern — sonst wäre der Run bei 1 Leben ebenfalls
  unbedienbar (das Sicherheitsnetz in `generateMap()` greift, war aber nie
  über viele Seeds nachgeprüft).

### Balancerunde nach Nutzer-Feedback (Karten + Gegner) — gemergt
Kein Phasenthema, sondern eine Liste konkreter Änderungswünsche. Reine
Datenänderungen sind hier nur kurz genannt, Code-Änderungen ausführlich.
- **Gegner**: Grüner bekommt 2 Abpraller + Vorhaltezielen (`leadAim`,
  `accuracy` 0.8→0.9); Gelber weniger aggressiv (0.17→0.08); Pinker zielt
  präziser (0.5→0.72).
- **Karten-Werte**: Streuschuss ohne Magazin-Bonus; Scharfschütze 3× Tempo
  und 2 statt 1 Kugel; Krallenfalle alle 300 statt 600 px; Annäherungsmine
  nach 0,1 s scharf; Nachbrenner nur noch 1 Stufe; Turbo und Schild sind
  jetzt `legendary`.
- **Minen global**: Explosionsradius 64→51 px und Wurfweite −20 % (72→58 px
  Tastatur/Gamepad, `MINE_MAX_THROW` 142→114 für den Touch-Wurfstick).
- **Zwei Karten entfernt**: `durchschlag` und `zielsucher` — samt ihrer
  `cfg.js`-Blöcke. Die Engine-Felder `phaseWalls`/`homing` bleiben in
  `bullet.js`/`tank.js` bestehen (generische Geschoss-Eigenschaften, aktuell
  von keiner Karte gesetzt). `terrain` hat dadurch 5 statt 6 Stacks —
  Pionier bleibt freischaltbar (Regressionstest wacht darüber).
- **Wolframkern** (`bullet.js: moveAxis()`): reißt die Wand ein und **fliegt
  weiter**, statt dabei zu verschwinden. `continue` statt `return`, also
  ohne Abpraller-Verbrauch und mit der Möglichkeit, im selben Schritt eine
  zweite Wand zu treffen; `destructible` (Phase 11) zählt jetzt mit.
- **Aasgeier** = „volles Magazin nach jedem Abschuss": neues Bullet-Feld
  `magFreed`. `killTank()` markiert alle eigenen fliegenden Kugeln, und
  `tank.js: liveBulletsOf()` überspringt markierte — sie fliegen und töten
  normal weiter, blockieren aber keinen Magazinplatz mehr.
- **Konterschild wirkt nur noch in Elite-/Verflucht-/Bossräumen**. Dafür
  neu: `cfg.js: applyRoomContext(cfg, { elite, boss })`, aufgerufen an
  denselben drei Stellen wie `applyRoomModifier()` (`createState`,
  `respawnPlayer`, `updateWave`); `run.js` reicht den Kontext als
  `createState`-Opt durch, `state.roomContext` hält ihn für den Respawn.
  In normalen Räumen fällt der ganze Schild weg, nicht nur der Kugelkranz
  (`createTank()` liest `cfg.counterShield` für `shieldReady`).
- **Klebemine** hatte praktisch nie gehaftet: der Haft-Test lief über den
  Minenradius (7 px). Jetzt eigener `stickRadiusPx: 42` (`mine.js`).
- **Raumvorschau zeigt die eigenen Upgrades als antippbare Chips** mit
  Wirkungstext (`preview.js`), genau wie die Gegnerliste darüber — vorher
  war es eine reine Namenszeile ohne Erklärung. `main.js` liefert dafür
  `{ name, level, description }` statt eines fertigen Strings.
- Drei neue Wirkungstests (Aasgeier, Konterschild-Gating, Wolframkern),
  jeder mit bestandener Gegenprobe.

### Grüner wird Bankshot-Gegner + Debug-Panel entschärft — gemergt
- **`t_green` nutzt jetzt `requiresBounceShot`** (`leadAim` entfernt, wird
  von `roleTurret()` ohnehin übersteuert). Damit ist der seit Phase 8
  gebaute, aber nie zugewiesene Abpraller-Rechner (`ai_turrets.js:
  solveBounce`) endlich im Spiel: der Grüne steht fest, rechnet Winkel und
  schießt fast nur Bankshots — passend zu seinen 2 Abprallern.
- **Der Solver ist die teuerste KI im Spiel** und wurde deshalb vermessen
  statt geschätzt: EIN Lauf kostete mit den ursprünglichen
  `angleSamples: 180` bis zu **4,8 ms** von 6 ms Frame-Budget (Phase 11b).
  Mit **120 Samples**: gleiche Lösungsquote (15/18 Gegner haben eine
  Lösung), aber nur noch ~2,2 ms. `solvesPerTick: 1` kam zusätzlich dazu,
  ist aber ehrlicherweise nur ein **Sicherheitsnetz** — die Solver-Timer
  staffeln sich von selbst (gemessen: 260 Läufe in 260 verschiedenen Ticks),
  er greift erst bei vielen Bankshot-Gegnern.
  ⚠️ Beim Messen zuerst falsch abgebogen: eine kaputte Schuss-Zählung
  (`st.bullets` wird jeden Tick von toten Kugeln bereinigt) ließ den Grünen
  wie einen Nicht-Schützen aussehen. Über die `shoot_enemy`-Sound-Ereignisse
  gezählt sind es 173 statt 34 Schüsse — die daraufhin geänderten Werte
  `fireConeRad`/`turnSpeed` wurden wieder zurückgenommen (enger Kegel =
  präziser Bankshot, Unterschied lag im Rauschen: 173 vs. 180 Schüsse).
- **Telemetrie sammelt IMMER, auch ohne `?debug=1`** — der Parameter
  schaltet nur die Anzeige ein (einzige `isDebugEnabled()`-Prüfung sitzt in
  `mountDebugView()`). Man kann also normal spielen und die Daten später
  ansehen/exportieren.
- **Das Debug-Panel startet jetzt eingeklappt** (34 px statt ~45 % der
  Bildschirmhöhe) — aufgeklappt verdeckte es beim Spielen die untere
  Arenahälfte. Ein Klick auf „▲ Daten zeigen" öffnet es.
- Neuer Regressionstest: der Bankshot-Gegner muss feuern UND das
  6-ms-Frame-Budget halten (misst den schlechtesten Logikschritt mit drei
  Grünen im Raum).

### Bugfix: „Weiter" außerhalb des Bildschirms (Nutzer-Meldung) — gemergt
**Symptom:** Mit einigen Upgrades war der „Weiter"-Knopf der Raumvorschau
nicht mehr erreichbar — der Run steckte fest.
**Ursache (zwei Schichten):** (1) `.overlay` hatte `justify-content: center`
und **kein** `overflow-y` — wuchs der Inhalt über die Bildschirmhöhe, ragten
Kopf UND Fuß aus dem sichtbaren Bereich, ohne Scrollmöglichkeit. Der Shop
hatte das seit Phase 13 einzeln gelöst, alle anderen Overlays nicht.
(2) Die Upgrade-Chips aus der letzten Balancerunde (ausgeschriebene Namen)
haben den Inhalt zusätzlich in die Höhe getrieben.
**Fix in drei Teilen:**
- `.overlay` ist jetzt generell scrollbar (`overflow-y: auto`) und nutzt
  `justify-content: safe center` — zentriert nur, solange Platz ist, und
  klemmt sonst oben an, statt oben abzuschneiden. Gilt für ALLE Overlays.
- `#previewGo` ist `position: sticky; bottom: 0` — der Knopf bleibt immer
  im Bild, unabhängig davon, wie lang die Listen werden.
- Neue Media Query `max-height: 500px` (Handy quer): kleinerer Titel,
  engere Abstände, kompaktere Upgrade-Karten. Ohne die lagen im
  Upgrade-Screen die drei Schrott-Aktionen außerhalb.
- **Chips sind jetzt kompakt**: jede Karte hat ein `symbol` in
  `data/upgrades.json` (61 Karten + Fallback), Gegner zeigen nur ihren
  Farbpunkt. Name und Wirkung stehen im Detailtext darunter (Hover/Tipp)
  und im `title`-Tooltip.
- **`tests/uilayout.mjs` (NEU, braucht Playwright)**: prüft über vier
  Viewports (inkl. 667×375 und „sehr flach" 740×360) mit 25 Upgrades auf
  Stufe 2, dass in Raumvorschau UND Upgrade-Screen kein Bedienelement
  außerhalb des Fensters liegt. Bewusst getrennt von `regression.mjs`, weil
  es eine echte Layout-Engine braucht — die Node-Suite bleibt
  abhängigkeitsfrei, der Test überspringt sich ohne Playwright selbst.
  Gegenprobe bestanden (sticky + Media Query ausgebaut → 4 Meldungen).

### Ergänzungsplan `PLAN-INPUT.md` (Input-Rework) — eingearbeitet
Vom Nutzer gelieferte Plan-Erweiterung: elf Phasen (P1–P11) für Input-
Abstraktion, Viewport, Gadget-Slot, Schild-Rework, Haken, Stats-Anzeige,
Zwischenraum-UI, Startbildschirm und Lichtquellen. **Regel: eine Phase pro
Session, strikt in Reihenfolge.** Die Steuerungsdoktrin (Tabelle der drei
Eingabeprofile) steht in **`SPEC.md`, Abschnitt 9**, nicht im Plan — dort
liegt die Steuerung schon beschrieben, es soll nur eine Quelle geben.

**Der Ist-Abgleich vor dem Bau war der eigentliche Ertrag** (Muster wie beim
`PLAN.md`-v3-Review): mehrere Phasen sind ganz oder überwiegend schon
gebaut, drei Angaben kollidieren mit bestehenden Festlegungen.
- **P1 (Input-Abstraktion) steht zu großen Teilen seit Phase 0a** —
  `getState()`, Gamepad-Polling, `data/input.json`, keine Events in
  `src/game/*`. Rest: Aktionsmodell um Gadget-/Menü-/Release-Felder
  erweitern und die drei Profile aus den if-Zweigen ziehen.
- **P2** Meta-Viewport ist bereits exakt wie gefordert; offen sind
  `visualViewport`, `devicePixelRatio`, `position: fixed`.
- **P3** Pointer-Events + `setPointerCapture` + `pointerId` gibt es schon.
  **Gefundener Bug:** `pointercancel` hängt an derselben Funktion wie
  `pointerup` und **wirft die Bombe trotzdem** — die Phase verlangt Abbruch
  ohne Auslösung. Das erklärt vermutlich das gemeldete Fehlverhalten.
- **P5 kollidiert mit E2, Bollwerk und drei Karten**: „kein Verfall, keine
  Regeneration, nicht nachkaufbar" nimmt E2 zurück, macht die
  Bollwerk-Transformation wirkungslos und streicht `nachladeschild`,
  `emergency_shield` und zwei Kaufwege. Vor der Phase zu entscheiden.
- **P6 würde den Haken halbieren**: `hookRange = bombThrowRange * 2` ergibt
  116 px, damals waren es 260 px (Bombenwurf 58 px). Die Absicht war bereits
  übererfüllt — inzwischen entschieden, siehe unten (222 px).
- **P10 (Grüner gefährlicher) ist bereits erledigt** (Session davor).
- Drei im Ausgangsdokument genannte Dateien existieren nicht:
  `data/weapons.json` → `secondaries.json`, `data/enemies.json` →
  `tanks.json`, `data/rooms.json` → `modifiers.json`.

**Konflikte A und B sind entschieden** (Nutzer): Schild bleibt wie es ist
→ **P5 ersatzlos gestrichen**; Haken bekommt **222 px**
(`data/secondaries.json: hook.maxRangePx`, war 260) → die Formel
`bombThrowRange * 2` ist verworfen. **Nächste Session: P2.**

### PLAN-INPUT.md P1 (Input-Abstraktionsschicht) — gemergt
Kein neues Spielgefühl, sondern die Struktur darunter: alle Eingaben laufen
jetzt über ein einziges, vollständiges Aktionsmodell.
- **`InputState` erweitert** um `aimActive`, `primaryFire`,
  `primaryPressed`, `secondaryHeld`, `secondaryRelease`, `secondaryAim`,
  `gadgetHeld`/`gadgetRelease`/`gadgetAim` (bis P4 immer `false`/`null`,
  Muster wie die Arena-Weiche aus Phase 0b), `detonate`, `menuDir`,
  `menuConfirm`. Alle Ein-Frame-Flags werden in `getState()` verbraucht.
- **Bewusst KEINE Verhaltensänderung**: die alten Namen `firing`,
  `secondary`, `secondaryThrow` bleiben als Aliase auf die neuen Felder
  bestehen, damit `main.js`/`stepRun()` unverändert bleiben. Sie fallen
  erst, wenn P4 diese Aufrufstellen ohnehin anfasst.
- **Drei Profilfunktionen statt einer if-Kette**: `profileTouch` /
  `profileGamepad` / `profileKeyboardMouse` schreiben alle nur in denselben
  `InputState`, Reihenfolge Touch < Gamepad < Tastatur/Maus. Jedes Profil
  schreibt **nur bei echtem Input** — deshalb überschreibt der immer
  vorhandene Mauszeiger ein aktives Stick-Ziel nicht mehr
  (`if (!st.aimActive)`, war beim ersten Entwurf falsch).
- **Belegungen komplett in `data/input.json`**: `keyboard.*` als Listen von
  `KeyboardEvent.code`, `gamepad.*` als Button-Indizes (RT = Primär,
  LT = Sekundär, RB = Gadget, LB = Zünden, D-Pad), `aim.reachPx`,
  `feedback.blockedShotCooldownS`. Vorher standen die Indizes im Code.
- **Umsetzungsfund — ein Knopf, zwei Aktionen**: `edge()` aktualisiert
  `gpPrev` beim Auslesen, ein zweiter `edge()`-Aufruf für denselben
  Button-Index im selben Poll lieferte deshalb immer `false`. Der A-Knopf
  belegt aber genau zwei Aktionen (Sekundärwaffe im Spiel, Bestätigen im
  Menü). Gelöst über einen Poll-lokalen Cache (`edgeSeen`) statt über ein
  Doppelbelegungsverbot.
- **Konflikt D gelöst — gesperrter Schuss meldet sich zurück**:
  `bullet.maxActive` sperrt das Feuern hart (E4, „Feuersperre statt
  Verdrängung"); auf Controller/PC wirkte ein wirkungsloser Abzug wie ein
  Defekt. `fireBullet(tank, state, pressed)` gibt jetzt Ton (`empty` in
  `data/sounds.json`, trockenes Klacken) **und** einen gedimmten grauen
  Blitz am Rohr (`state.flashes`-Eintrag mit `dim: true`,
  `effects.js: drawFlashes`) — aber **nur bei frischem Abzug**
  (`primaryPressed`) und höchstens alle 0,35 s, sonst würde es im
  Touch-Autofire pausenlos klicken. `main.js` hängt `data/input.json` dafür
  als `tanksData.input` an.
- **Rechte Maustaste** ist jetzt die Sekundärwaffe (`contextmenu` auf dem
  Canvas unterdrückt); `setProfile()`/`getProfile()` als manueller
  Profil-Override, den P9 an die Einstellungen hängt.
- Regressionstest deckt alle vier Fälle der Rückmeldung ab (gehalten =
  still, frisch = Ton + Blitz, Cooldown greift, Gegner nie) — Gegenprobe
  für jeden einzeln bestanden.
- **Nebenbefund: der Frame-Budget-Test war messtechnisch wacklig.** Er
  verglich den *rohen Maximalwert* aus 2160 Logikschritten mit 6 ms und
  fing prompt eine GC-Pause ein (6,39 ms in einem Lauf, 1,8–2,4 ms in fünf
  direkt danach). Gemessen liegen nur ~10 der 2160 Ticks über 1 ms — der
  Solver läuft dank `solvesPerTick` eben selten, ein Perzentil verdünnt
  daher genau das seltene Ereignis (p99,5 = 0,99 ms). Jetzt wird der
  **drittgrößte** Messwert bewertet: behält das Signal, verträgt zwei
  Ausreißer. Gegengeprüft über `angleSamples`: 120 → 1,1–2,1 ms (grün),
  600 → 3,9–5,4 ms (grün, und zwar zu Recht — das Budget ist knapp
  gehalten), 2400 → 7,5 ms (rot).

### PLAN-INPUT.md P2 (Viewport/Fullscreen + DPR) — gemergt
Neues Modul **`src/core/viewport.js`** — ab jetzt die einzige Stelle, die
Canvasgröße und Auflösung verwaltet.
- **Auflösung an `devicePixelRatio`**: Backing-Store `WIDTH*dpr ×
  HEIGHT*dpr`, der Kontext bekommt `setTransform(dpr, …)` als
  Grundtransformation. Alle Zeichenbefehle bleiben dadurch **unverändert**
  in Arena-Koordinaten — `renderer.js` und `debug.js` mussten nicht
  angefasst werden. Vorher wurde ein fester 768×512-Puffer vom Browser
  hochskaliert (auf einem DPR-3-Handy auf über 2000 px Breite).
- **DPR gedeckelt** (`data/options.json: maxPixelRatio: 2`): ungedeckelt
  wären es bei DPR 3 die neunfache Pixelmenge. Füllrate ist auf Handys der
  Engpass, und Phase 11b hält das Frame-Budget bewusst knapp.
- **`visualViewport` → `--vvh`/`--vvw`** als CSS-Variablen, im Stylesheet
  mit `100dvh` als Rückfall. `dvh` rechnet die eingeklappte Adressleiste
  heraus, kennt aber die eingeblendete **Bildschirmtastatur** nicht — genau
  der Fall beim Seed-Eingabefeld im Startmenü.
- **`position: fixed` + `overscroll-behavior: none`** global auf html/body
  (vorher nur `contain` auf den Overlays). Die Overlays scrollen weiterhin
  intern.
- **Vollbild-Knopf** im Startmenü, nur sichtbar, wenn der Browser
  Element-Vollbild kann (auf iOS wäre er eine Sackgasse). `fullscreenchange`
  zieht Beschriftung **und** Canvasgröße nach. P9 hängt ihn zusätzlich an
  die Einstellungen.
- **Falle 1 — Zielkoordinaten**: `input.js: toCanvas()` rechnete gegen
  `canvas.width`, das jetzt ein Vielfaches der Arenabreite ist. Ein Klick in
  der rechten Bildhälfte hätte auf **x = 1152** einer 768 px breiten Arena
  gezeigt. Jetzt gegen die festen Logikmaße aus `config.js`.
- **Falle 2 — Layoutgröße hing plötzlich am DPR**: ein Canvas leitet seine
  intrinsische Größe aus den `width`/`height`-**Attributen** ab, der größere
  Backing-Store ließ ihn also im Layout mitwachsen (gemessen: 768×512 bei
  DPR 1, aber 972×648 bei DPR 2). Gelöst über
  `max-width: min(100%, 768px)` / `max-height: min(90vh, 512px)`.
- **Falle 3 — der naheliegende Fix für Falle 2 war falsch**: feste
  CSS-Breite **und** -Höhe zu setzen macht beide Maße definit und setzt
  damit `aspect-ratio` außer Kraft. Sobald `max-height` im Handy-Querformat
  greift, wurde der Canvas **verzerrt** (768×390 statt 585×390, ein Drittel
  zu breit). `viewport.js` setzt deshalb bewusst **keine** CSS-Maße.
- **`tests/viewport.mjs` (NEU, braucht Playwright)**: prüft über DPR 1/2/3
  Backing-Store und Deckel, die DPR-Unabhängigkeit der Layoutgröße, das
  Seitenverhältnis in drei echten Handy-/Tablet-Querformaten und — der Kern
  — dass ein Mausereignis in Arena-Koordinaten ankommt (dafür wird
  `input.js` im echten Browser instanziiert, statt eine Sonde in den
  Spielcode zu legen). Gegenprobe für alle drei Fallen bestanden.

### PLAN-INPUT.md P3 (Touch-Bug Sekundärwaffe) — gemergt
Der gemeldete Fehler war real; beim Prüfen der laut Plan „schon erfüllten"
Teile kamen **zwei weitere** derselben Klasse dazu: eine Eingabe geht still
verloren. Alle drei in `src/ui/touchcontrols.js`.
- **`pointercancel` warf die Bombe trotzdem** (der bekannte Bug):
  `pointerup` und `pointercancel` hingen an derselben Funktion, die immer
  `pendingThrow` gesetzt hat. Bricht das System die Berührung ab (Anruf,
  System-Geste, zu viele Finger), flog die Bombe an eine nie bestätigte
  Position. Jetzt zwei Pfade — `endMineStick` (wirft) und `abortMineStick`
  (setzt nur zurück) — mit gemeinsamem `resetMineStick`, das zusätzlich das
  Pointer-Capture freigibt.
- **Ein zweiter Finger auf dem Bombenknopf übernahm den Zug**:
  `pointerdown` überschrieb `mineStick.id`, das Loslassen des **ersten**
  Fingers fiel danach durch die id-Prüfung und wurde stillschweigend
  verworfen („die Bombe kam nicht"). Der erste Finger behält den Stick jetzt
  bis zum Loslassen.
- **Die Sperrzone galt pro Ereignis statt pro Berührung**: `onStart` prüfte
  nur `e.target` — das ist die Berührung, die das Ereignis ausgelöst hat.
  Wer gleichzeitig den Bombenknopf und die Fahrfläche antippte, verlor
  **beide** Berührungen, der Fahrstick entstand gar nicht. Jetzt filtert
  `onStart` jede Berührung einzeln gegen `inBlockedZone()`.
- **Bewusst NICHT gebaut: ein `lostpointercapture`-Handler.** Er wäre nur
  richtig, wenn er *nach* `pointerup` feuert — feuert er davor, schluckt er
  jeden regulären Wurf und erzeugt genau den Fehler, den die Phase
  beseitigt. Die Reihenfolge ließ sich hier nicht verlässlich nachmessen
  (synthetisches `setPointerCapture` greift nicht), deshalb kein
  ungeprüfter Pfad.
- **`tests/domstub.mjs` erweitert**: generisches `emit()` für Pointer-/
  Touch-Ereignisse, `getBoundingClientRect`, Pointer-Capture-Buchführung,
  `closest()` und ein `window` mit echter Listener-Verwaltung
  (`innerWidth` für die Stick-Hälften). Damit liegen sechs P3-Fälle in der
  **schnellen Node-Suite** statt in einem Browsertest. Wichtig beim
  Schreiben: jeder Fall braucht ein **frisches DOM** — `createTouchControls()`
  hängt einen weiteren `#mineBtn` in den Body *und* weitere Listener an
  `window`, sonst bedient der nächste Fall die Instanz des vorigen.
- Gegenprobe für alle drei Fixes einzeln bestanden; zusätzlich im echten
  Browser mit echten `PointerEvent`s gegengeprüft.

### PLAN-INPUT.md P4 (Gadget-Split) — gemergt
Zwei Slots statt einem. Die **Bombe liegt im festen Sekundärslot** und ist
immer ausgerüstet; die fünf übrigen Einträge aus `data/secondaries.json`
(`category: "gadget"`) teilen sich den zweiten, tauschbaren Slot
(`run.equippedGadget`, Start: keines). Vorher lagen alle sechs in EINEM
Slot — wer eine Gadgetkarte nahm, verlor die Bombe.
- **`tank.js`**: `useSecondary()` ist nur noch die Bombe, `useGadget()` der
  zweite Dispatch mit eigener Abklingzeit (`tank.gadgetCooldown`). Die
  Slots sind vollständig unabhängig — die Gadget-Abklingzeit blockiert die
  Bombe nicht (in der Suite zugesichert, Gegenprobe bestanden).
- **`emp_mine` ist ein echtes Gadget** mit eigenem Auslöser statt „jede 4.
  Bombe ist EMP": `layMine()` bekommt `forceEmp`, der Zähler
  `secondaryMineCount` entfällt. Der **Fernzünder** bekommt mit
  `cmd.detonate` (aus P1 schon im Aktionsmodell) endlich einen eigenen
  Knopf — vorher löste er nur aus, wenn das Minen-Limit ohnehin erreicht
  war, also praktisch unauffindbar.
- **Konflikt C aufgelöst statt umschifft**: `MINE_ONLY_IDS` in
  `upgradepool.js` entfällt **ersatzlos**. Weil die Bombe nicht mehr
  abwählbar ist, können die sieben minenspezifischen Karten nie mehr
  wirkungslos werden, und der Tag `control` hängt nicht länger an der
  ausgerüsteten Waffe. Die **Minen-Karte ist aus `data/upgrades.json`
  entfernt** (60 statt 61 Karten) — eine Karte für einen festen Slot wäre
  wirkungslos. `run.upgrades` startet dadurch leer statt mit `{ mine: 1 }`.
- **Touch**: `makeThrowStick()` als **Fabrik** statt einer Kopie — Bombe und
  Gadget sind derselbe Bedienbaustein. Bewusst so, weil der
  `pointercancel`-Fix aus P3 sonst an zwei Stellen hätte stimmen müssen.
  Der Gadget-Knopf (`#gadgetBtn`, links neben der Bombe, eigener Farbton)
  erscheint nur, wenn eines ausgerüstet ist (`.slot-empty`).
- **HUD** zeigt den zweiten Slot mit Kürzel und Restsekunden — ohne das wäre
  der einzige Hinweis auf einen noch kalten Slot, dass der Knopf nichts tut.
- **Shop** tauscht Gadgets (nach `category` gefiltert), nicht mehr die
  Bombe; die Raum-Modifikator-„Ausrüstungssperre" sperrt jetzt **beide**
  Slots.
- **Gadgets backen pro Raum** (Muster wie Transformationen/Modifikatoren):
  eine mitten im Raum gewechselte Ausrüstung wirkt erst im nächsten Raum.
- Der Transformations-Test verliert seine Zusatzprüfung „auch ohne
  Minen-Sekundärwaffe" (die Bedingung gibt es nicht mehr) und bekommt
  stattdessen eine Zusicherung, dass die Sperre nicht zurückkommt.

### PLAN-INPUT.md P6 (Haken-Rework) — gemergt
Ist-Abgleich gegen die fünf Punkte der Phase: **zwei waren schon erfüllt**
(Auslösen beim Loslassen kam mit dem Gadget-Wurfstick aus P4; „steuerlos,
aber verwundbar" stimmt seit Phase 6 — `moveTank()` ignoriert die Eingabe
bei `hookTimer > 0`, ohne Unverwundbarkeit zu geben). Der **Zug an allen
Wandtypen** trug ebenfalls schon: `isSolid()` deckt feste, durchschießbare,
Spiegel-, zerstörbare und Generator-Wände ab, über das Grid auch die eigene
Sperrmauer und geschlossene bewegliche Wände. Löcher sind bewusst
ausgenommen — dort ist nichts zum Festhaken.
- **Die Zielrichtung wurde ignoriert**: `fireHook()` nutzte immer
  `tank.turret`, der Gadget-Wurfstick aus P4 war damit wirkungslos. Jetzt
  steuert die Zielvorgabe den Haken (auf PC/Controller weiter die
  Blickrichtung).
- **Ein Fehlschuss kostete gar nichts** (`return false` → keine
  Abklingzeit). Jetzt läuft sie in jedem Fall; der Griff ins Leere ist damit
  eine echte Fehlentscheidung. Quittiert mit `empty` + gedimmtem Blitz —
  dieselbe Auflage wie beim gesperrten Schuss aus P1, sonst wirkt die
  verbrauchte Abklingzeit wie ein Defekt.
- **Zielvorschau** (`effects.js: drawHookPreview`): Linie bis zum
  Ankerpunkt — durchgezogen mit Ankerkreuz bei Treffer, gestrichelt bei
  Fehlschuss, gedämpft während der Abklingzeit. Der Unterschied muss **vor**
  dem Auslösen erkennbar sein, weil ein Fehlschuss jetzt kostet.
- **Eine Quelle für „wo landet der Haken"**: neu `tank.js: traceHook()` —
  Vorschau und Schuss rufen dieselbe Funktion und können nicht auseinander
  laufen (Prinzip wie die Ziellinie aus Phase 0a mit der echten
  Geschossphysik). Die Suite prüft das über 16 Richtungen; Gegenprobe mit
  einem eigenen Raymarch im Schuss bestanden. **Wichtig beim Gegenprüfen:**
  eine Änderung an `traceHook` selbst kann der Test nicht sehen (beide
  Seiten verschieben sich gleich) — die Gegenprobe muss den Schuss auf eine
  eigene Rechnung umstellen.
- **Nebenbefund, in P4 selbst eingebaut**: `getMinePreview()` gab dort
  `mine.preview() || gadget.preview()` zurück — beim Zielen mit dem Gadget
  zeichnete das die **Bomben**-Wurfvorschau. Jetzt getrennte Abfragen
  (`getMinePreview` / `getGadgetPreview`).
- `drawHookPreview` ist im Fake-Canvas-Renderpfadtest mit beiden Zweigen
  verdrahtet (dafür muss `cfg.gadget = 'hook'` gesetzt sein, sonst steigt
  die Funktion sofort aus und der Zweig bliebe ungetestet — per Gegenprobe
  bestätigt).

### PLAN-INPUT.md P7 (Werte-Anzeige) — gemergt
`hud.js: drawStats()` zeigt die Werte des eigenen Panzers, **wie sie nach
allen Upgrades, Raum-Modifikatoren und Transformationen tatsächlich
gelten**. Bis dahin zeigte das Spiel nur Kartennamen — welche Zahl dabei
herauskommt, war nirgends ablesbar.
- **Reine Ableitung, kein neues Feld** (so im Ist-Abgleich vorhergesagt):
  alles kommt aus dem aufgelösten `cfg`, die Basis aus `resolveCfg()` ohne
  Upgrades. Angezeigt wird die **Abweichung** — interessant ist nicht
  „Tempo 84", sondern „Tempo 84 (+20 %)".
- **Zwei Wege, ein Panel**: Umschalter **Tab** (neue Aktion `stats` in
  `data/input.json`; `preventDefault`, sonst wandert der Fokus) und
  **immer während der Pause**. Dadurch ist die Anzeige auf dem Handy ohne
  zusätzlichen Knopf erreichbar — dort gibt es keine Tastatur, aber den
  Pausenknopf.
- Zeilen: Tempo, Geschosstempo, Nachladen, Abpraller, Magazin, Bomben,
  Bombenradius; dazu falls vorhanden Gadget samt Restabklingzeit, Dash,
  Schildladungen und der aktive Raum-Modifikator.
- Hinweiszeile unter dem Spielfeld auf die neuen Tasten aktualisiert
  (Q = Gadget, E = zünden, Tab = Werte).
- **Test mit mitschreibendem Fake-Canvas** (jeder `fillText` wird
  gesammelt): das Panel muss überhaupt Text ausgeben — eine leere Box wäre
  sonst grün —, alle Zeilen enthalten, bei einem Tempo-Upgrade eine
  Abweichung ausweisen, in der Pause erscheinen und im normalen Spiel
  **nicht** dauerhaft stehen. Gegenprobe für alle drei Kernpunkte bestanden.
  **Fallstrick beim Testaufbau:** ein frischer Run steht auf `preview` und
  zeichnet gar nichts, und ein nachträglich gesetztes `run.upgrades` wirkt
  erst im nächsten Raum — der Vergleichsraum muss über `createState()` mit
  `playerUpgrades` gebaut werden.

### PLAN-INPUT.md P8 (Mobile Zwischenraum-UI) — gemergt
Die Chipreihe der eigenen Ausrüstung ist aus dem Hauptbereich der
Raumvorschau verschwunden; dort steht jetzt **eine Zeile** — ein Knopf
„Deine Ausrüstung (N) ▸" auf eine eigene Vollbild-Seite
(`#previewUpgrades`).
- **Verstärkt den Bugfix der letzten Balancerunde, statt ihn
  zurückzunehmen**: der Hauptbereich wird kürzer, nicht länger — der
  „Weiter"-Knopf rückt weiter vom Bildschirmrand weg.
- **Auf der eigenen Seite ist Platz**: Symbol, Name, Stufe und Wirkung
  stehen direkt nebeneinander, der „Tippe für Details"-Umweg entfällt. Die
  Symbole aus `data/upgrades.json` werden weiterverwendet.
- **„Zurück" führt in die Vorschau, nicht in den Raum** — sonst wäre der
  Blick auf die Ausrüstung eine Einbahnstraße. `hide()` räumt **beide**
  Seiten weg (genau die Fehlerklasse, die schon einmal einen Run blockiert
  hat, als der Kartenscreen über dem Spielfeld liegen blieb).
- **`#previewUpBack` ist `sticky`** — Gegenprobe: ohne die Regel liegt der
  Knopf bei 12 Karten auf **1076 px** in einem 375-px-Fenster.
- Fünf Fälle in `tests/regression.mjs`, Gegenprobe für drei davon;
  `tests/uilayout.mjs` prüft die neue Seite über alle vier Viewports mit.
- **`tests/domstub.mjs` brauchte einen `Image`-Stub**: `preview.js` zieht
  über `renderer.js` die Sprite-Initialisierung mit, die als
  Modul-Seiteneffekt `new Image()` aufruft — ohne den Stub lässt sich das
  Modul headless gar nicht importieren. Wichtig dabei: das DOM muss schon
  beim **Import** stehen, nicht erst beim Testfall.

### PLAN-INPUT.md P9 (Startbildschirm) — gemergt
- **Neues Modul `src/ui/menunav.js`** (`createMenuNav`): generische
  Tastatur-/Gamepad-Fokusnavigation für Overlays (SPEC.md 9: „Menü
  navigieren"). Nur die Y-Achse bewegt den Fokus durch eine Liste (mit
  Anlauf-/Wiederholzeit); die X-Achse ist dem fokussierten Element
  vorbehalten, wenn es ein `<input type="range">` ist. Touch braucht das
  nie, dort wird direkt angetippt.
- **`input.js: getMenuState()`** (neu): schlanker Poll ohne Spieler-Objekt
  — `getState(player)` setzt eins voraus, Menünavigation nicht.
- **Lautstärkeregler** (`audio.js: setVolume/getVolume`): eigener Wert
  0..1, getrennt vom `muted`-Schalter, beide auf demselben Gain-Knoten.
  Stumm gewinnt immer, der Reglerwert bleibt aber erhalten und gilt
  wieder, sobald entstummt wird.
- **Eingabeprofil-Override**: Knopfreihe (Muster Schwierigkeitsauswahl)
  statt `<select>`, ruft `input.setProfile()`/`getProfile()` (seit P1).
- **„Spiel beenden"**: `window.confirm()` + `window.close()`, gleiches
  Muster wie „Bestwerte zurücksetzen". `close()` wirkt nur bei per Skript
  geöffneten Tabs/installierten PWAs; sonst passiert nach der Bestätigung
  bewusst nichts Sichtbares statt einer Fehlermeldung.
- **Umsetzungsfund — zu viel Inhalt für den Hauptbildschirm**: Vollbild,
  Lautstärke, Eingabeprofil-Reihe, Reset und Beenden zusätzlich auf den
  Startbildschirm gepackt ließ ihn im Handy-Querformat nicht mehr ohne
  Scrollen passen (`tests/uilayout.mjs` maß 6–7 Bedienelemente unterhalb
  des sichtbaren Bereichs bei 667×375). Gelöst nach dem **P8-Muster**:
  eigene Einstellungsseite (`#settings`), Knopf „Einstellungen ▸" auf dem
  Hauptbildschirm, sticky „Zurück". `tests/uilayout.mjs` prüft seither
  auch diese Seite mit.
- **Nebenfund**: die neue Eingabeprofil-Reihe erbte dieselbe
  Selektor-Spezifitäts-Gleichstand-Falle wie die bestehende
  Schwierigkeitsauswahl (`.overlay button` vs. `.modes button`, bei
  Gleichstand gewinnt die später im Stylesheet stehende Regel) — aktive
  und inaktive Knöpfe sahen gleich golden aus. Für `.profiles` behoben,
  die bestehende Schwierigkeitsauswahl bewusst unangetastet gelassen
  (separater Fund, nicht Teil von P9).
- Tests: `createMenuNav` isoliert geprüft (Fokus/Anlaufzeit, Regler,
  Bestätigen auf Knopf/Checkbox, `reset()`), `audio.js`-Lautstärke/Mute-
  Zusammenspiel, `getMenuState()` ohne Spieler — Gegenprobe für alle
  Kernpunkte bestanden. `tests/uilayout.mjs` prüft Start- und
  Einstellungsseite über alle vier Viewports.

### PLAN-INPUT.md P11 (Lichtquellen) — gemergt
Letzte Phase des Ergänzungsplans. Aus der einen Blende um den Spieler
(`fog`/`darkness`, Phase 10) wird eine **additive Lichtmaske**: Spieler,
lebende Gegner, aktive Minen und fliegende Geschosse leuchten jetzt
gemeinsam, statt dass nur der Spieler-Kreis zählt.
- **`renderer.js: drawFog()` komplett neu**: ein eigenes Offscreen-Canvas
  (`fogCanvas`) wird jeden Frame mit `fogColor` gefüllt, dann bekommt jede
  Lichtquelle per `destination-out` (`punchLight()`, weicher
  Radialgradient) ein Loch hineingestanzt — erst danach wandert die
  fertige Maske über ein einziges `drawImage()` auf den Hauptcanvas. Ein
  zweiter Canvas ist zwingend: `destination-out` direkt auf dem
  Hauptcanvas würde auch Boden/Wände/Panzer durchsichtig machen, nicht nur
  den Nebel.
- **Werte in `data/modifiers.json: lightSources`** (ein gemeinsamer Block
  für jeden Modifikator mit `visionRadiusPx`, keine Duplikate):
  `enemyRadiusPx` 90, `mineRadiusPx` 70, `bulletRadiusPx` 34 — bewusst
  kleiner als der Spieler-Radius, Nebenquellen ergänzen die Sicht, heben
  den Effekt nicht auf.
- **Render-Leistungsbudget `maxLightSources` (10)**: Worst Case sind bis zu
  44 gleichzeitige Kandidaten (`limits.json: enemiesAlive` 12 + `mines` 8 +
  `balance.json: enemyBullet.maxActive` 24) — ohne Deckel gemessen ~6,8 ms
  p90, über dem 6-ms-Budget aus Phase 11b. `drawFog()` sortiert alle
  Kandidaten nach Entfernung zum Spieler und puncht nur die
  `maxLightSources` nächsten (Muster wie die Entitäten-Deckel in
  `data/limits.json`, hier als Render- statt Simulationsbudget).
- **Umsetzungsfund — vorgebackene Lichtsprites waren LANGSAMER**: die
  naheliegende Optimierung (Radialgradient je Art einmalig backen, dann
  nur noch `drawImage()`) maß isoliert 10,3 ms statt 6,5 ms Median bei 44
  Quellen — vermutlich, weil `drawImage()` bei der nötigen
  Hoch-/Herunterskalierung selbst resamplen muss. Verworfen zugunsten von
  `createRadialGradient()+fillRect()` pro Aufruf.
- **`tests/fogperf.mjs` (neu, Playwright, selbstüberspringend)**: prüft
  Korrektheit (additive Aufhellung + Nachtsicht-Abschaltung) und Renderzeit
  im Worst Case.
- **Umsetzungsfund — der naheliegende Korrektheitstest hätte nie etwas
  geprüft**: eine erste Fassung maß die Helligkeit am nächsten Nachbarn
  einer 44-Quellen-Zufallsszene. Bei dieser Dichte liegt der nächste
  Nachbar im Mittel nur ~35 px vom Spieler entfernt (2D-Poisson-Schätzung)
  — also so gut wie immer schon innerhalb des Spieler-eigenen Lichtradius
  (150 px im härtesten Fall). Der Test hätte additive Fremdlicht-Quellen
  nie wirklich geprüft, selbst wenn nur der Spieler-Kreis gezeichnet würde
  (Gegenprobe bestätigt). Jetzt misst der Test an einer gezielt platzierten
  Test-Sonde außerhalb des Spieler-Lichtkreises. Zweiter Fund dabei: eine
  per `{...proto, x, y}` geklonte Test-Figur muss `prevX`/`prevY` explizit
  mitsetzen — `drawFog()` interpoliert Gegnerpositionen über
  `lerp(t.prevX, t.x, alpha)`, ein reiner Klon erbt sonst die alte Position
  des Prototyps.
- **Messmethode Renderzeit**: drei unabhängige 500-Frame-Durchläufe, Median
  der drei p90-Werte — ein einzelner Durchlauf reicht nicht, weil die
  Aussetzer dieser (sandboxed) Testumgebung gelegentlich so clustern, dass
  ein einzelner Durchlauf über 10 % verliert (Gegenprobe: 7,7 ms p90 statt
  der üblichen ~4-5 ms in einem einzelnen Lauf).
- **Helligkeitsvergleich über ein 12×12-Fenster gemittelt**, nicht einen
  Einzelpixel: das Boden-Sprite hat eigene Textur-Variation, ein
  Einzelpixel kann rein zufällig auf eine dunkle Stelle treffen, ganz ohne
  Nebel.

### UMBAUPLAN-LP Phase 1 (Schadensmodell im Code) — gemergt
Erste Phase des LP-Umbaus. **Reiner Umbau: das Spiel verhält sich exakt wie
vorher** — `maxHp` und `damage` stehen überall auf 1, jeder Treffer tötet
weiterhin sofort. Die Phase trennt bewusst den Umbau von der Balance.
- **`state.js: applyDamage(tank, amount, cause, meta)` neu**, `killTank()`
  bleibt daneben bestehen. Der Schnitt: **alles, was einen Treffer ABWEHRT**
  (Reaktorkern-Unverwundbarkeit, Schildladung, Gegnerschild, Spielerschild)
  ist von `killTank()` nach `applyDamage()` gewandert; danach wird abgezogen
  und erst bei `hp <= 0` die reine Todeslogik gerufen. Grund: die Gatter
  verhindern *Schaden*, nicht *den Tod*. Bei `maxHp`/`damage` = 1 ist das
  exakt dasselbe Verhalten, mit echten LP wäre die alte Platzierung falsch
  (ein Schild, das nur tödliche Treffer abfängt, wäre eine zweite
  Lebensleiste — genau das, was Plan-Phase 8 vermeiden will).
- **`killTank()` bleibt der Trichter für den Tod** (Kettenreaktionen,
  Statistik, Telemetrie, Geisterpanzer hängen daran) und ist weiterhin
  direkt aufrufbar — Tests/Cheats räumen damit Räume ab. Neu: Doppeltod-
  Schutz (`if (!tank.alive) return`), weil eine Kettenreaktion ihn sonst
  zweimal im selben Frame treffen kann.
- **Nur zwei echte Aufrufer** mussten umgestellt werden: die Geschoss-
  Treffer-Schleife in `state.js` und `explodeAt()` in `mine.js`. Beide
  prüfen `protect` schon vorher selbst — `applyDamage()` braucht deshalb
  keine eigene Spawnschutz-Prüfung.
- **Geschosse tragen ihren Schaden** (`createBullet({ damage })`, Standard 1)
  vom Erzeuger aus `cfg.damage`. Bewusst **beim Abschuss eingefroren** statt
  beim Treffer aus `b.owner` gelesen: sonst würde eine noch fliegende Kugel
  rückwirkend stärker, wenn ihr Besitzer zwischendurch ein Upgrade bekommt.
- **Explosionsschaden in `balance.json: damage.explosion`**, nicht bei einem
  Panzertyp — eine Mine hat keinen `cfg.damage`. `explodeAt()` bekam dafür
  einen optionalen letzten Parameter (Phase 3: Bossangriff), alle
  Bestandsaufrufe bleiben unverändert.
- **`createTank()` setzt `hp = cfg.maxHp`.** Weil es bei jedem Raumwechsel,
  Respawn und Wellen-Spawn ohnehin läuft, braucht die „volle LP je Raum"-
  Regel aus Plan-Phase 3 später **keinen eigenen Hook**.
- **Verhaltensbeweis statt „fühlt sich gleich an"**: ein Wegwerf-Werkzeug
  spielte 5 Seeds mit je 240 Ticks echter Simulation pro Raum durch und
  protokollierte **506 vollständige Zustandsproben** (Panzerpositionen auf
  3 Nachkommastellen, Kugel-/Minen-/Partikelzahlen, alle Zähler, Endstand).
  Alter und neuer Stand sind **zeilenweise identisch**. Gegenprobe: ein
  einziges `t_brown: maxHp 2` erzeugt sofort 15 abweichende Zeilen.
- **Neun neue Dauertests** (`regression.mjs` Abschnitt 9). Sie prüfen den
  **Mechanismus mit eigenen Zahlen**, nicht die aktuellen JSON-Werte — sonst
  wären sie schon durch Phase 2 rot, ohne dass etwas kaputt ist. Darunter ein
  Strukturwächter „jeder Typ hat `maxHp`/`damage`", der einen in Phase 2
  vergessenen Typ fängt (ein Gegner ohne `maxHp` fiele sonst still auf 1
  zurück und stürbe mitten im LP-Spiel weiter am ersten Treffer).
- **Gegenprobe für alle neun bestanden — und dabei ein blinder Test
  gefunden**: die erste Fassung von „Panzer starten mit vollen LP" prüfte
  `hp === cfg.maxHp` im echten Raum, was bei `maxHp: 1` überall **trivial
  wahr** ist; ein hartkodiertes `hp: 1` in `createTank()` rutschte glatt
  durch. Jetzt wird zusätzlich mit einem synthetischen `cfg.maxHp = 42`
  geprüft.

### UMBAUPLAN-LP Phase 2 (Gegner-LP, Skalierung, Lebensleiste) — gemergt
Erste Phase, die das Spielgefühl wirklich ändert: Gegner halten 2–5 Treffer
aus (Elite 10, Boss 50), Spielerschaden fest 10.
- **LP-Werte** in `tanks.json` wie in der Plantabelle. **Drei Typen fehlten
  dort** (`t_purple`/`t_white`/`t_black`) — nach ihren `danger`-Punkten ins
  selbe 2–5-Treffer-Band gelegt (30/30/40).
- **Die Phalanx musste von 500 abweichen**: sie besteht aus fünf Panzern
  (Phase 14), 500 je Stück wären 250 statt 50 Treffer. Jetzt 100 je Wache —
  in Summe die geplanten 500. Der Regressionstest rechnet über die
  Formation, nicht über den Einzelpanzer.
- **Skalierung** `difficulty.json: hpScaling.perRoom 0.05`,
  `gegnerLP = maxHp × (1 + 0,05 × (raum − 1))`. Angewendet in
  `cfg.js: applyHpScaling()` **vor** `createTank()` (das setzt
  `hp = cfg.maxHp`) — keine zweite Stelle muss die aktuellen LP nachziehen.
  Gilt für erste und zweite Welle (`state.hpScale` für `updateWave()`
  gemerkt), nie für den Spieler. **Gegnerschaden skaliert bewusst nicht.**
- **Bosse sind ausgenommen** (`hpScaling.skipBosses`): der Bossraum ist die
  letzte Kartenreihe, mitskaliert wären es ~87 statt 50 Treffer. Erkannt
  über die drei vorhandenen Boss-Schalter, gebündelt in
  `cfg.js: isBossCfg()` — kein viertes Datenfeld.
- **Elite verdoppelt die LP** (`difficulty.json: elite.hpMult 2`, neben
  `budgetMult` — beides „wie viel härter ist ein Eliteraum").
- **Explosionsschaden 1 → 40** (`balance.json: damage.explosion`). Nicht im
  Plan erwähnt, aber zwingend: mit Gegner-LP von 20–50 wäre eine Mine bei 1
  Schaden **wirkungslos** geworden, samt aller sieben Minen-Karten — und
  zwar lautlos. 40 räumt wie bisher fast alles aus (nur der Gepanzerte mit
  50 überlebt knapp) und ist schon der Wert, den Plan-Phase 3 für
  Minenschaden gegen den Spieler vorsieht.
- **Lebensleiste** in `renderer.js: drawTank()`, nur bei `hp < maxHp`, über
  den Affix-Punkten. Farbe folgt dem Panzer statt rot/grün — die Zuordnung
  Balken → Panzer muss im Getümmel ohne Nachdenken klappen, und rot/grün
  wäre für die häufigste Farbenblindheit die schlechteste Wahl.
- **Abweichung zum Plan bei Testschritt 4**: „Raum 12 braucht drei Treffer"
  passt nicht zur eigenen Formel — 20 × 1,55 = 31 LP sind bei 10 Schaden
  **vier** Treffer. Drei gelten in Raum 2–11. Die Formel ist maßgeblich (ihr
  zweites Rechenbeispiel „Raum 15 = 1,7×" geht exakt auf).
- **Gemessen statt geschätzt**: ein Bot mit Sichtlinienprüfung zeigt, dass
  die Räume **nicht länger** dauern (Median 21,9 s statt 36,7 s), der Spieler
  aber deutlich öfter stirbt — er ist länger exponiert und stirbt weiter am
  ersten Treffer. Erwartete Zwischenlage bis Phase 3.
- **Zwei Bestandstests mussten nachziehen**: sie bauten sich eine Kugel von
  Hand und setzten stillschweigend Ein-Treffer-Tode voraus (USP-Kennzahl 3).
  Sie bekommen jetzt ausdrücklich tödlichen Schaden mit, die geprüfte
  Aussage bleibt.
- **Neue Dauertests** (Abschnitt 10, Gegenprobe für jeden bestanden):
  Trefferzahl-Band 2–5 je Typ (der von Plan-Phase 28 verlangte Test),
  Elite 10, Boss 50, Skalierungsformel, Boss-Ausnahme, Panzerung blockt
  weiterhin **ganz** statt anteilig, Explosion tötet den schwächsten Gegner,
  Lebensleiste nur am angeschlagenen Panzer.
- **`tests/domstub.mjs` hat einen aufzeichnenden Canvas bekommen** — damit
  führt die abhängigkeitsfreie Node-Suite zum ersten Mal `renderer.js`
  wirklich aus und kann das Ergebnis *prüfen* statt nur „nicht abstürzen"
  festzustellen. Genau die Lücke, aus der seinerzeit der Ziellinien-Crash kam.

### UMBAUPLAN-LP Phase 3 (Spieler-LP, Heilung, Schadenszahlen) — gemergt
Der Spieler hat 100 LP und hält vier Gegnertreffer aus; jeder Raum startet
mit vollen LP. Damit ist die Zwischenlage aus Phase 2 aufgelöst.
- **Schadenswerte** (`tanks.json` + `balance.json: damage`): gegnerische
  Kugel 25, Bossangriff 34, Minenexplosion 40, eigene abgeprallte Kugel 15.
- **Die Heilung brauchte keine Zeile Code**: `createTank()` setzt seit
  Phase 1 `hp = cfg.maxHp` und läuft bei jedem Raumaufbau, Respawn und
  Wellen-Spawn ohnehin. Genau die Ersparnis, die Phase 1 angelegt hat — ein
  Test sichert beide Wege (Raumwechsel, Respawn) ab.
- **Die eigene Kugel hängt am ZIEL, nicht am Geschoss**: sie trägt
  `damage: 10` (Spielerschaden gegen Gegner), soll dem Spieler selbst aber
  15 zufügen. Deshalb `balance.json: damage.ownBullet`, angewandt in der
  Trefferschleife, wenn Ziel **und** Besitzer der Spieler sind — nicht in
  `b.damage`. Aus voller Gesundheit nie tödlich: der Bankschuss bleibt eine
  Entscheidung, kein Todesurteil.
- **`damage.explosion` (40) gilt in beide Richtungen** — Phase 2 hat den
  Wert für Gegner gesetzt, Phase 3 nennt für den Spieler dieselbe Zahl.
- **Die Lebensleiste des Spielers ist IMMER sichtbar**, die der Gegner
  weiterhin nur bei Schaden (bewusste Asymmetrie: acht Gegner gleichzeitig
  wären als Dauerbalken unlesbar, vom Spieler gibt es genau einen — und die
  eigene Gesundheit ist die Zahl, nach der man *während* des Zielens
  entscheidet).
- **Lesart „Schadenszahlen" im Phasentitel**: die Schadens*werte* aus der
  Tabelle, keine aufsteigenden Zahlen über getroffenen Panzern — der
  Abschnittstext listet nur Werte.
- **Gemessen**: gegenüber Phase 2 weniger Spielertode (15 → 8) bei mehr
  erreichten Kampfräumen (5 → 7). Die *Raumdauer* ist mit dem Bot **nicht**
  belastbar messbar (er bleibt bei freier Mitte-zu-Mitte-Sichtlinie stehen
  und verkantet sich, wenn die Kugel an einer Ecke stirbt — dieselben Seeds
  hingen schon im Ursprungscode). Raumdauer ist ohnehin erst in Plan-Phase 28
  als Test vorgesehen.
- **Neue Dauertests** (Abschnitt 11, Gegenprobe für jeden bestanden): vier
  Gegnertreffer töten (der vierte, nicht früher), eigene Kugel schwächer als
  ein Gegnerschuss und nie tödlich aus vollem Stand, Mine härter als ein
  Gegnerschuss und trotzdem nicht sofort tödlich, Boss tötet in 3 Treffern,
  volle LP nach Raumwechsel und Respawn, Spielerleiste immer sichtbar.
- **Ein Test war zuerst zu schwach**: die Minen-Prüfung verglich nur das
  Spielverhalten gegen den JSON-Wert und hätte jede Wertänderung mitgemacht
  (Gegenprobe „Minenschaden auf 25" blieb grün). Jetzt prüft sie zusätzlich
  die beiden zahlenunabhängigen Design-Aussagen des Plans.

### UMBAUPLAN-LP Phase 4 (Abprall-Bonus) — gemergt
Ein Geschoss mit Wandkontakt (`wallBounces > 0`) richtet **doppelten
Schaden** an (`balance.json: bullet.wallBounceDamageMult`). Kein Upgrade,
keine Klassenregel — der Abprall wird belohnt statt erzwungen.
- **Eine Zeile in der Trefferschleife** (`state.js`): `bounced` wurde dort
  ohnehin schon für die Trickshot-Belohnung berechnet.
- **Gilt ausdrücklich für BEIDE Seiten**, auch gegnerische Geschosse — sonst
  lernt der Spieler, dass gebandete Kugeln nur für ihn gefährlich sind. Ein
  gegnerischer Bankschuss macht damit 50 statt 25 (Spieler stirbt an zweien
  statt vieren). Ein eigener Test lässt eine einseitige Umsetzung auffliegen.
- **Nur der AUFSCHLAG wird verdoppelt, nicht die Explosion**: ein gebandetes
  Sprenggeschoss richtet doppelten Trefferschaden an, seine Explosion läuft
  unverändert über `damage.explosion` — sonst würde ein einziger Wandkontakt
  gleich zwei Schadensquellen verdoppeln.
- **Eine Reflexion (Prisma/Panzerung, E3) zählt bewusst NICHT als
  Wandkontakt.** Der Code zählt Reflexionen seit jeher nicht in
  `wallBounces` (sonst ließen sich zwei Prismen gegeneinander ausspielen,
  ohne je eine Bande zu spielen); diese Trennung gilt jetzt auch beim
  Schaden. Konkret: eine vom Prisma zurückgeworfene eigene Kugel trifft mit
  dem Grundwert 15, eine an der Wand gebandete mit 30.
- **Die Plan-Alternative (`perBounce: 1.5`, Deckel 3,0) ist bewusst NICHT als
  Datenfeld angelegt**, sondern im `_comment_`-Eintrag beschrieben — zwei
  Faktor-Felder, von denen nur eines wirkt, wären eine Stolperfalle. Der Plan
  verlangt, den Wert „vorzusehen", nicht ihn scharf zu schalten.
- **Gemessen**: Spielertode praktisch unverändert (8 → 9), Räume deutlich
  schneller geräumt (Median 125 s → 87 s). Die Symmetrie gleicht sich also
  weitgehend aus. Der Wert **unterschätzt den Spielervorteil eher** — der Bot
  zielt nie absichtlich über Bande, die Gegner banden dagegen systematisch.
- **Neue Dauertests** (Abschnitt 12, Gegenprobe für jeden bestanden):
  Verdopplung gegen Gegner, derselbe Bonus für gegnerische Geschosse,
  Reflexion verdoppelt nicht, Explosion wird nicht mitverdoppelt, Faktor
  stammt wirklich aus `balance.json`.
- **Angepasst**: der Testhelfer aus Phase 3 gab jeder Kugel einen
  Wandabpraller mit (damals nötig, damit die eigene Kugel scharf ist) — damit
  wären ab Phase 4 alle Grundwerte verdoppelt und nicht mehr messbar gewesen.
  Er setzt jetzt `wallBounces: 0` und für die eigene Kugel stattdessen
  `reflected`.

### UMBAUPLAN-LP Phase 5 (Statuseffekt-System) — gemergt
Gemeinsames Regelwerk für Effekte über Zeit, gebaut **bevor** es die Elemente
gibt. Neu: `src/game/status.js` + `data/status.json` (Feuer 4 Schaden/Takt für
3 s, Gift 2 für 6 s, Frost −40 % Tempo für 2 s; ein Takt für alles: 0,5 s).
- **Wie vom Plan verlangt hängt KEINE Quelle daran** — kein Geschoss, keine
  Mine, keine Karte. Erreichbar nur über `state.applyStatus()`, im Spiel über
  die Debugtasten **1/2/3** und die nur bei `?debug=1`. Phase 6 hängt dann die
  Schadenstypen an.
- **Ticks werden GEZÄHLT, nicht heruntergezählt.** Der erste Entwurf hatte
  zwei unabhängige Countdowns (Takt + Restdauer); die driften bei
  1/60-Schritten gegeneinander — der erste Tick fiel einen Frame zu spät, und
  bei 144 FPS gingen Ticks ganz verloren (20 statt 24 Schaden, per Gegenprobe
  bestätigt). Jetzt läuft `tickElapsed` gegen `floor(tickElapsed / tickS)`:
  bei 3 s Dauer und 0,5 s Takt **immer exakt 6 Ticks**, unabhängig von
  Bildrate und Zeitlupe. Dasselbe Muster wie der Minen-Warnpuls (Phase 7b).
- **Erneutes Auftragen erneuert nur die Dauer, nicht die Takt-Buchhaltung** —
  sonst könnte eine schnell feuernde Quelle den Tick endlos hinausschieben
  und der Effekt wäre schadlos.
- **Frost-Erstarrung löst nur beim ÜBERGANG auf den Deckel aus** (<3 → 3),
  nicht bei jedem weiteren Auftragen; sonst Stunlock. Der Plan sagt dazu
  nichts. Frost nutzt den vorhandenen `stunTimer` (Krallenfalle) und reiht
  die Verlangsamung als weiteren Multiplikator in `moveTank()` ein — gilt
  dadurch automatisch für Spieler und Gegner.
- **Schaden über Zeit umgeht auch die SCHILDE**, nicht nur Panzerung/Prisma
  (die ergeben sich von selbst, weil `armorBlocks()` nur in der
  Geschoss-Trefferschleife geprüft wird). Ein 4-Punkte-Brandtick würde sonst
  eine ganze Schildladung verbrauchen — sechs Ticks also drei Ladungen in
  anderthalb Sekunden. Umgesetzt über `meta.overTime` in `applyDamage()`.
  **Die Boss-Unverwundbarkeit gilt weiter** — sonst wäre das
  Generator-Rätsel des Reaktors mit einem Brandpfeil umgehbar.
- **Anzeige**: Farbkacheln unter der Lebensleiste, Breite = Stufenzahl
  (bewusst Flächen statt Emoji — bei 4 px wäre ein Emoji auf dem Handy
  Matsch). Die Elite-Affix-Punkte rücken dafür von `r+12` auf `r+26`; die
  drei Schichten stapeln sich jetzt von oben nach unten: **Affixe,
  Lebensleiste, Statuseffekte.**
- **Neue Dauertests** (Abschnitt 13, Gegenprobe für jeden bestanden): exakte
  Tickzahl bei 30/60/144 FPS, Stapelung/Deckel/Dauererneuerung, dauerhaft
  nachgelegter Effekt macht trotzdem Schaden, Frost verlangsamt ohne Schaden
  und erstarrt nur beim Übergang, Ticks umgehen Panzerung und Schilde aber
  nicht die Boss-Unverwundbarkeit, ein Effekt kann töten (durch `killTank()`),
  Anzeige-Deckel + Dominanz-Sortierung, frischer Raum ohne Alt-Status.
- **Zwei Tests waren zuerst wirkungslos**: (1) die Schadensmessung fing
  gegnerisches Eigenfeuer mit ein (eine Bildratenprobe sah 74 statt 24
  Schaden) — die Tests laufen jetzt in einem isolierten Raum mit nur zwei
  Panzern; (2) „höchstens 3 Symbole" ist bei genau drei Effekten trivial wahr,
  ein ausgebauter Deckel rutschte durch — jetzt mit temporärem Deckel 1
  geprüft.

### UMBAUPLAN-LP Phase 6 (die sechs Schadenstypen) — gemergt
Jedes Geschoss und jede Explosion trägt ein `damageType`
(`physical`/`explosive`/`fire`/`frost`/`poison`/`lightning`, Werte in
`data/status.json: damageTypes`). Feuer/Frost/Gift tragen ihren Statuseffekt
aus Phase 5 auf, Blitz springt auf drei Ziele mit −30 % je Sprung.
- **Neues Modul `src/game/damagetypes.js`** (Muster wie `armor.js`/`status.js`)
  statt weiterer Zeilen in `state.js`: Typtabelle, Statusauftrag und
  Blitzkette an einer Stelle. `state.js`/`mine.js` rufen nur
  `applyTypeEffects()` nach dem Trefferschaden.
- **Abweichung vom Plan bei den ids**: der Plan schreibt `"feuer"`, hier
  stehen englische ids (`fire`) — wie alle ids im Projekt und wie die
  Statuseffekte aus Phase 5. Der Gewinn: damageType-id und Statuseffekt-id
  sind **identisch**, es braucht also gar keine Zuordnungstabelle. Ein
  Strukturtest wacht darüber, dass kein `status`-Verweis ins Leere zeigt.
- **Die Blitzkette springt vom ZULETZT getroffenen Panzer weiter**, nicht vom
  Einschlagpunkt — sonst räumt der Blitz einen Kreis um den Einschlag ab
  statt eine Kette entlangzulaufen. Eigener Test mit einem Aufbau, in dem
  Ziel 3 nur über Ziel 2 erreichbar ist.
- **Kettenglieder umgehen die Panzerung** (Prinzip wie Explosionen): ein
  Übersprung hat keine Geschossrichtung, gegen die ein Frontsektor prüfbar
  wäre.
- **Statusstufen hängen am TREFFER, nicht am Schadensbetrag** — deshalb
  verdoppelt der Abprall-Bonus (Phase 4) den Aufschlag, aber nicht den Brand.
- **Sichtbares Gegenstück**: kurzer Blitzbogen zwischen den getroffenen
  Panzern (`renderer.js: drawLightning`) — ohne ihn wäre nicht
  nachvollziehbar, warum ein nie beschossener Gegner Schaden nimmt. Dazu
  färbt der Schadenstyp das Geschoss ein.
- **Neue Dauertests** (Abschnitt 14, Gegenprobe für jeden bestanden): alle
  sechs Typen vorhanden + `status`-Verweise gültig, jeder Typ trägt seinen
  Effekt auf (Sofort-Typen keinen), Blitzkette mit Zieldeckel und Abfall,
  Blitz einzeln ohne Sprung, Kette springt vom letzten Ziel, Abprall
  verdoppelt Aufschlag aber nicht Stufen, Standard ist physisch, Explosionen
  tragen ihren Typ.

### UMBAUPLAN-LP Phase 7 (Krit-Umbau) — gemergt
5 % auf doppelten Schaden wären +5 % Gesamtschaden und damit unsichtbar.
Deshalb ist ein Krit ein spürbares **Ereignis**: `balance.json: crit`
(`baseChance: 0.05`, `mult: 2.0`, `cap: 0.35`, `resetsReload: true`).
- **Krit macht 2× Schaden UND setzt das Nachladen sofort zurück** — man darf
  sofort wieder feuern (nur noch vom Magazin/aktiven Kugeln begrenzt). Das
  Nachlade-Reset ist der spürbare Tempo-Ausschlag und hängt am **Abschuss**
  (`tank.js: fireBullet()`), nicht am Treffer: „schießen → jeder Schuss lädt
  sofort nach" (Testschritt 1) verlangt keinen Kill. Die 2×-Verdopplung
  dagegen liegt am **Treffer** (`state.js`, Schadenszeile) — sie greift nur,
  wenn die Kugel wirklich einschlägt.
- **Der Krit wird EINMAL pro Abzug ausgewürfelt** (nicht je Kugel — alle
  Kugeln eines Streuschuss-/Doppelrohr-Abzugs teilen ihn) und am Geschoss
  eingefroren (`bullet.js: b.crit`, Muster wie `damage`/`damageType` aus
  Phase 1/6). Eine Kugel, die mehrere Ziele streift, bleibt kritisch oder
  nicht — kein Neu-Würfeln beim Treffer.
- **Faktoren multiplizieren sich**: ein gebandeter Krit macht
  `abprallMult × critMult = 2 × 2 = 4` (Phase-4-Abprall-Bonus × Krit,
  Testschritt 3). Nur der Aufschlag, nicht die Explosion eines
  Sprenggeschosses (die läuft weiter über `damage.explosion`).
- **Vorerst spielerseitig**: der Roll hängt an `tank === state.player`.
  Gegner-Krit ist im Plan nicht spezifiziert und würde über `resetsReload`
  zu erratischem Doppelfeuer führen — bewusst nicht gebaut. `cfg.critChance`
  wird für alle aufgelöst (`resolveCfg`: `t.crit ?? balance.crit.baseChance`,
  damit Phase 9 die klassenspezifischen Krit-Werte per `tanks.json: crit`
  ohne Code einhängen kann, Muster wie `maxHp`), ist bei Gegnern aber
  wirkungslos. Zufall über den Seed-RNG (`state.rng`) → Run bleibt
  deterministisch.
- **Der Deckel greift am Roll-Ort** (`Math.min(cap, critChance)`), nicht erst
  in `cfg.js` — so klemmt er auch, wenn spätere Karten/Klassen `critChance`
  über 35 % treiben (Testschritt 4). Krit-Karten gibt es in Phase 7 noch
  keine; der Cap-Mechanismus ist deshalb mit einer synthetischen Chance > cap
  geprüft (gleiches Muster wie der `maxHp = 42`-Test aus Phase 1).
- **Sicht-/Hörbares Gegenstück** (Testschritt 5, Auflage aus Phase 7b): der
  Krit spielt einen eigenen scharfen Ton (`sounds.json: crit`), rüttelt den
  Bildschirm (`state.addShake(6)`) und zeigt „KRITISCH!" am Panzer — der
  Normaltreffer nichts davon.
- **Neue Dauertests** (Abschnitt 15, Gegenprobe für jeden bestanden):
  garantierter Krit setzt `b.crit` + Nachladen 0, Chance 0 lässt beides
  normal, Deckel klemmt eine Chance > cap, Schadensmultiplikation
  (Krit / Bank / beide = 2 / 2 / 4), Krit-Feedback vorhanden und beim
  Normaltreffer abwesend, Gegnerschuss nie kritisch. Die Tests prüfen den
  **Mechanismus mit eigenen Zahlen** (gestellter RNG, synthetische Chance),
  nicht die aktuellen JSON-Werte.

### UMBAUPLAN-LP Phase 8 (Altlasten abbauen) — gemergt
Der LP-Umbau zieht mehrere gerade erst vermessene Systeme des Ein-Treffer-
Spiels bewusst zurück (im Plan so entschieden, kein Widerspruch).
- **Erzwungene Bankshots aus** (`difficulty.json: bankshotGuarantee.chance
  0.58 → 0`): einen Panzer in 58 % der Räume zu einem Gegner zu zwingen, den
  seine Klasse nicht spielt, ist im LP-Modell unfair. Der Tausch-Mechanismus
  `run.js: ensureBankshotEnemy()` bleibt erhalten (bei `chance 0` ein No-op),
  damit Phase 9 ihn als Eigenschaft des Abprallpanzers ohne Code-Neubau
  wieder scharf schalten kann. **RNG-Verbrauch unverändert** (Zeile
  `run.rng.enemies() >= chance` lief vorher wie nachher).
- **Prisma: Zwang → Anreiz.** `t_prism` verliert `armor` UND
  `requiresRicochet` und bekommt `bounceDamageTakenMult: 3`. Ein **direkter**
  Schuss trifft es jetzt ganz normal (nimmt Schaden), ein **gebandeter**
  dreifach statt doppelt. Der neue Faktor ist **ziel-seitig** in der
  Schadenszeile (`state.js`): `bounced ? t.cfg.bounceDamageTakenMult ??
  wallBounceDamageMult : 1` — er **ersetzt** den globalen 2×-Bonus (Phase 4),
  staffelt sich also nicht mit ihm (3×, nicht 6×). `cfg.js` reicht das Feld
  als Whitelist durch.
  - **Der `requiresRicochet`-Mechanismus bleibt im Code** (`armor.js`,
    `state.js`, Renderer): der **Spiegel-Boss** (`t_mirror`) nutzt ihn
    weiterhin 1:1. Nur die Zuweisung an `t_prism` fällt weg. Ein
    Struktur-Test bewacht, dass der Boss ihn behält.
  - **Visuelle Folge** (bewusst, Phase 9 macht Klassen-Optik): ohne
    `armor`/`requiresRicochet` zeichnet `renderer.js` den Prisma-Rautenkranz
    nicht mehr — das Prisma sieht über `SPRITE_ALIAS` aus wie ein schlichter
    türkiser Panzer.
- **Schild = Absorber statt Ein-Treffer-Block** (`balance.json: shield.absorb
  40`). Der **Spieler**-Schild (`schild`-Upgrade, Konterschild,
  Nachladeschild) fängt jetzt die nächsten 40 Punkte ab, Rest geht durch
  (60er-Treffer → 40 abgefangen, 20 durch) — drei gestapelte Ein-Treffer-
  Blöcke wären eine zweite Lebensleiste gewesen. `tank.shieldHp` ist der
  Pool (aus `cfg.shieldAbsorb`, in `createTank()` und beim Nachladen
  gefüllt); **kein `protect`-Fenster mehr, solange der Absorber Punkte hat**
  (sonst schluckte ein Treffer 0,6 s lang allen Folgeschaden). Bricht der
  Pool, greifen Konterschild-Kranz und Nachladeschild-Regen wie bisher.
  **Gegnerschilde** (Elite-Affix, Regenerierschild) und die **Notschild-
  Ladungen** (`emergency_shield`, `state.shieldCharges`) bleiben bewusst
  Ein-Treffer-Abwehr — der Plan meint mit „Schild aufnehmen" das
  `schild`-Upgrade.
- **`tests/uspcheck.mjs` gelöscht** und der USP-Kennzahl-1-Test (Abschnitt 7)
  aus `regression.mjs` entfernt — sie messen ein Spiel, das es nicht mehr
  gibt. Der Bankshot-**Gegner**-Test (Abschnitt 7c, `t_green`-Solver +
  Frame-Budget) bleibt: er misst die KI/Leistung, nicht die USP-Quote.
- **Telemetrie: USP-Kennzahlen → Schaden je Schadenstyp.**
  `state.damageByType` (physical/explosive/fire/frost/poison/lightning) zählt
  den vom **Spieler** an Gegnern angerichteten Aufschlag; `main.js` reicht es
  je Raum durch, `telemetry.js: computeMetrics` summiert und zeigt „Schaden/
  Typ pro Run" statt der freiwilligen Bankshots (`voluntaryRicochetKills`
  komplett entfernt). **Bekannte Untererfassung**: DOT-Ticks/Explosionen
  zählen (noch) nicht mit, nur der direkte Trefferwert.
- **Neue Dauertests** (Abschnitt 16, Gegenprobe für jeden Kernpunkt
  bestanden): Struktur (Prisma ohne Panzerung/`requiresRicochet`, mit 3×;
  Boss behält `requiresRicochet`; `chance` = 0), Prisma direkt = normal /
  gebandet = 3× vs. normaler Gegner 2×, Schild-Absorber 40/20, kleiner
  Treffer ganz abgefangen mit Rest-Pool, `damageByType`-Zählung. Mechanismus
  mit **eigenen Zahlen** geprüft.

### UMBAUPLAN-LP Phase 9 (Die zehn Klassen als Werte) — gemergt
Zehn spielbare Klassen mit eigenen Werten + je einem Passiv, wählbar über einen
neuen Auswahlbildschirm. Werte in `data/tanks.json` (alle mit `player: true`).
- **Blocker aufgelöst**: `cfg.js` zog Magazin/Deckel/Kugeltempo fest aus
  `balance.json`, sobald `type === 'player'` — die Typwerte wurden nie
  gelesen. Jetzt markiert `player: true` die Klasse, der Typ **darf** die Werte
  überschreiben, sonst greifen die Player-Defaults aus `balance.json`. Und der
  hart verdrahtete String `'player'` in `state.js` (createState + respawnPlayer)
  kommt jetzt aus **`run.starterTank`** (Default `'player'` = Standard-Klasse,
  damit Altpfade wie `resolveCfg(data, 'player')` gültig bleiben).
- **Die zehn Klassen** (`c_blast/c_frost/c_tesla/c_toxic/c_scrap/c_ricochet/
  c_necro/c_engineer/c_flame` + `player` = Standard): eigene `maxHp`/`damage`/
  `speedMult`/`crit`/`damageType`. Die fünf elementaren Klassen schießen ihr
  Element von Anfang an (Feuer/Frost/Gift/Blitz/Sprengstoff).
- **Passive** — jeweils an genau EINER Stelle ausgewertet, als Whitelist über
  `cfg.js: resolveCfg()` durchgereicht: Sprengpanzer `classMineRadiusMult 1.2`
  (in `applyUpgrades()` in `mineRadiusMult` gefaltet), Teslapanzer
  `lightningBonusTargets 1` (3→4 Blitzziele, über `meta.lightningBonus` in
  `damagetypes.js`), Flammen-/Radioaktiv-Panzer `fire-|poisonDurationMult 1.25`
  (über `applyStatus(…, opts.durationMult)`), Frostpanzer `frostSlowBonus 0.2`
  (stärkere Verlangsamung, als `eintrag.speedMult`-Override am Status), Abprall-
  panzer `bonusRicochets 1`, Nekromant `reviveChance 0.25` (neuer
  `state.tryRevive()` vor jedem tödlichen Spielertreffer — deterministisch über
  `state.rng`, **kein RNG-Verbrauch** ohne das Passiv), Schrottpanzer
  `scrapDamagePer100 0.05` (neuer `cfg.js: applyScrapDamage()`, **pro Raum
  gebacken** aus `run.scrap`), Ingenieur `builtHpMult 1.2` (Sperrmauer-
  Haltbarkeit in `tank.js: placeTrapWall()`).
- **`run.starterTank` gehört in die Seed-Wiedergabe**: im `runSnapshot()` und
  beim `resume`; `state.starterTank`/`state.starterScrap` gemerkt, damit
  `respawnPlayer()` dieselbe Klasse baut.
- **Auswahlbildschirm** (`index.html` `#classScreen`, verdrahtet in `main.js`,
  Muster wie die Einstellungsseite aus P9): Knopf „Klasse: … ▸" öffnet eine
  Seite mit allen zehn Klassen (Name/Werte/Beschreibung), Wahl in
  `getPref/setPref('starterTank')` persistiert. Auf flachen Handy-Querformaten
  verdichtet eine erweiterte `max-height: 500px`-Media-Query den
  Startbildschirm (sonst rutschte `settingsOpen` heraus, per `uilayout.mjs`
  gefangen).
- **Darstellung**: die Klassen teilen sich das Spieler-Sprite
  (`sprites.js: SPRITE_ALIAS` c_*→`player`); `renderer.js` erkennt den Spieler
  jetzt über `t === state.player` statt `t.type === 'player'` (sonst hätten die
  neun neuen Klassen Glow/Ziellinie verloren). `hud.js: drawStats()` bezieht
  die Werte-Abweichung auf die **gewählte** Klasse.
- **Bestandstests angepasst**: die Gegnerhärte-Bänder (Phase 1/2) schließen
  jetzt `player`-Klassen aus (`!t.player`); der Klassen-Kommentar liegt außerhalb
  von `types`, damit die Struktur-Iteration ihn nicht als Typ liest.
- **Neue Dauertests** (Abschnitt 17, Gegenprobe für die Kernpunkte bestanden):
  Struktur (10 Klassen, `player:true`), Blocker-Fix (Magazin/Deckel/Tempo aus
  balance, `speedMult`, `crit`/`damageType`), +1 Abpraller, Sprengradius,
  Tesla-Blitz auf 4 Ziele, Feuer-/Giftdauer + Frost-Verlangsamung, Nekromant-
  Revive (Wurf + Fehlwurf), Schrott-Schaden, Klasse im Snapshot + Fortsetzen.
  Zusätzlich ein Playwright-Smoke (Auswahl → Start → Snapshot-Klasse).

### UMBAUPLAN-LP Phase 10 (Kernpool + Verteilungs-Fix) — gemergt
30 klassenunabhängige Kernkarten + der Verteilungs-Fix aus `PLAN-UPGRADES.md`.
- **30 Kernkarten** in `data/upgrades.json` (Tag = Kategorie): 10 Kategorien
  (`damage`/`reload`/`speed`/`health`/`magazine`/`ricochet`/`crit`/`scavenge`/
  `mines`/`dodge`), je eine `common`/`rare`/`legendary` → **10/10/10**. **Jede
  Kategorie ein eigener Tag** — sonst würde die „kein doppelter Tag pro
  Angebot"-Regel den ganzen Kern auf **eine** Karte pro Angebot zusammenfalten.
- **Generischer `core`-Applier** (`cfg.js: applyUpgrades()`): jede Kernkarte
  trägt ein `core`-Effektobjekt (`damageAdd`/`reloadMult`/`speedMult`/`hpAdd`/
  `magAdd`/`ricochetAdd`/`critAdd`/`scrapAdd`/`mineAdd`/`dashGrant`+`dashCdMult`),
  **eine Schleife statt 30 Zweige** — eine neue Kernkarte braucht keine
  Codezeile. Die Ausweichen-Karten schalten den Dash frei (unabhängig von der
  alten `dash`-Karte) und verkürzen die Abklingzeit multiplikativ. Der
  Krit-Deckel greift bewusst weiter am Roll-Ort (`tank.js`), nicht im Applier.
- **`weightedPick`-Fix** (`upgradepool.js`): die alte Fassung summierte das
  Gewicht **pro Karte** → `P(Stufe) ∝ Poolgröße × Gewicht`, also verzerrt,
  sobald eine Seltenheit mehr Karten hat (gemessen: 88/11/1 statt 60/30/10).
  Neu: jede Karte bekommt `weight[rarity] / (Karten dieser Seltenheit)` → die
  Summe je Seltenheit ist wieder exakt das konfigurierte Gewicht,
  **größenunabhängig** (wichtig, weil die Element-Filter ab Phase 11
  zwangsläufig ungleiche Poolgrößen erzeugen). **Ein `rng()`-Aufruf** wie
  bisher — kein RNG-Drift. Der Plan nannte als Alternative „gleich große
  Stufen (10/10/10)"; die Normierung erfüllt dasselbe Ziel robuster.
- **Transitional**: die alten Karten bleiben (Sekundär/Gadget/Elite/Weapon +
  Transformations-Tags hängen daran) — der Kern kommt **additiv** dazu, nicht
  ersetzend. Die neuen Kategorien `damage`/`reload`/`health`/`crit` schließen
  echte Lücken (die gab es als Karte noch nicht), die übrigen sechs überlappen
  leicht mit Altkarten (bewusst hingenommen, spätere Phasen prunen).
- **Neue Dauertests** (Abschnitt 18, Gegenprobe für die Kernpunkte bestanden):
  Struktur (30, 10/10/10, 10 Tags), Verteilungs-Fix an einer **ungleichen**
  Liste (60/30/10 ±2 %, Gegenprobe zeigt 88/11/1), Schadenskarten-Arithmetik +
  Trefferzahl gegen den Braunen, Krit über den Deckel + Klemme, Ausweichen
  schaltet Dash frei, Ersatzeintrag bei erschöpftem Pool.

### UMBAUPLAN-LP Phase 11 (Physisch-Topf + Element-Filter) — gemergt
Erster von sechs Schadenstyp-Töpfen (je 12 Karten, 4/4/4). Baut zugleich die
**Angebotsfilterung nach `damageType`**, die alle Töpfe brauchen.
- **Element-Filter** (`upgradepool.js: buildCandidates()`): eine typgebundene
  Karte (`damageType`-Feld) erscheint nur, wenn ihr Typ im **Element-Set der
  Klasse** liegt (`opts.elements`). Karten OHNE `damageType` (Kernpool,
  Altkarten) bleiben universell. `run.js: elementsOf(run)` liefert vorerst nur
  das Primärelement (`data.types[starterTank].damageType`); Phase 17 mischt das
  Zweitelement bei. Elite-/Treasure-Belohnungen (`includeTag`/`onlyRarity`)
  lassen den Filter bewusst aus.
- **12 physische Karten** (`data/upgrades.json`, alle Tag **und** `damageType`
  `physical` → höchstens eine pro Angebot): 4 common (kleine Stat-Boosts über
  den generischen `core`-Applier), 4 rare (Regeländerungen), 4 legendär (zwei
  Richtungen: Scharfschütze/Abpraller).
- **Neue Effekt-Schlüssel im `core`-Applier** (`cfg.js`): `bulletSpeedMult`,
  `damageMult`, `magazineFixed` (multiplikative erst NACH den additiven, sonst
  reihenfolgeabhängig) plus die Trefferregel-Flags `executeThreshold`/
  `executeMult`, `critOnBounce`, `critMultBonus`, `critExecute`,
  `bounceDamageBonus`.
- **Trefferregeln im Schadensschritt** (`state.js`, aus `b.owner.cfg`):
  Kaltschütze macht **gebandete** Schüsse kritisch, Splittergeschoss erhöht den
  Krit-Faktor (+0,5×), Fangschuss trifft Ziele unter 30 % LP +40 %, Abprallkönig
  gibt gebandeten Schüssen Extra-Schaden (×2 zusätzlich zum Abprall-×2 = ×4),
  Kopfschuss lässt einen Krit einen Nicht-Boss sofort töten. `isBossCfg()` aus
  `cfg.js` importiert. Faktoren multiplizieren sich sauber mit Abprall/Krit.
- **Keine Karte schaltet einen anderen Typ ab** (Plan-Auflage): die
  physischen Karten setzen nur Schützen-cfg-Felder, kein Bullet-`damageType`.
- **Neue Dauertests** (Abschnitt 19, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (12, 4/4/4), Filter (physische Klasse sieht sie, Frostklasse nicht),
  Applier-Arithmetik + Railgun, Kaltschütze/Splittergeschoss/Fangschuss/
  Abprallkönig/Kopfschuss. Der Phase-10-Kerntest zählt jetzt „`core` **ohne**
  `damageType`", damit die Topf-Karten nicht als Kernkarten mitgezählt werden.

### UMBAUPLAN-LP Phase 12 (Sprengstoff-Topf) — gemergt
Zweiter Element-Topf (12 Karten, 4/4/4, Tag+`damageType` `explosive`). Nutzt
den Element-Filter und den `core`-Applier aus Phase 10/11; neu ist der
Explosionsschaden-Multiplikator im Zündpfad.
- **Neue `core`-Applier-Schlüssel** (`cfg.js`): `allExplosive` (schaltet
  zündende Schüsse frei, setzt sonst fehlenden Basisradius auf 50),
  `shotExplosionRadius`, `explosionRadiusMult` (wirkt auf **Schuss UND Mine** —
  `shotExplosionRadius` × und `mineRadiusMult` ×), `explosionDamageMult`,
  `schrapnellCount` (reuse des bestehenden Schrapnell-Mechanismus). Radius-/
  Schaden-Multiplikatoren werden gesammelt und nach der Applier-Schleife
  angewandt (reihenfolgeunabhängig).
- **`explosionDamageMult` im Zündpfad**: `explodeAt()` bekam den Schadenswert
  schon in Phase 1 als optionalen Parameter — jetzt reichen die beiden
  Aufrufstellen (`state.js` Sprenggeschoss, `mine.js` Minenzündung) ihn als
  `balance.damage.explosion × owner.cfg.explosionDamageMult` durch. Der
  **Abprall-Bonus verdoppelt bewusst nur den Aufschlag, nicht die Explosion**
  (Phase-4-Regel, per Test bewacht).
- **12 Karten**: 4 common (Radius/Schaden/Schaden/Minen), 4 rare
  (Sprengmunition = zündende Schüsse, Splitterbombe, Fassbombe, Minenfeld),
  4 legendär (Sprengkopf/Sperrfeuer = große-Knall-Richtung, Streubombe/
  Sprengarsenal = Ketten-/Splitter-Richtung). Die Legendaries schalten alle
  `allExplosive` frei.
- **Neue Dauertests** (Abschnitt 20, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (12, 4/4/4), Filter (Sprengpanzer sieht sie, physische Klasse
  nicht), Applier (allExplosive/Radius×Schuss+Mine/Schaden/Schrapnell), der
  **Zündpfad** (skalierter Explosionsschaden am Ziel gemessen, Abprall
  verdoppelt die Explosion nicht).

### UMBAUPLAN-LP Phase 13 (Feuer-Topf) — gemergt
Dritter Element-Topf (12 Karten, 4/4/4, Tag+`damageType` `fire`). Feuer trägt
den Brand-Statuseffekt (Phase 5/6) — die Karten skalieren ihn über **generische
Status-Boosts**, damit die Frost-/Gift-Töpfe (14/15) dieselben Hebel nutzen.
- **Generische Status-Boosts** (`damagetypes.js: applyTypeEffects()` reicht sie
  in die `applyStatus`-Optionen): `statusStackBonus` (+Stufen je Treffer),
  `statusMaxStacksBonus` (Stufen-Deckel anheben, `status.js`),
  `statusTickMult` (Tickschaden, am Eintrag gemerkt + in `updateStatus`
  verrechnet), `statusDurationMult` (Dauer, **mal** dem elementspezifischen
  Klassen-Passiv `fireDurationMult`). Generisch benannt, weil eine Klasse nur
  EIN Element schießt — der Boost trifft also immer den passenden Status.
- **Feuer-Ausbreitung** (`fireSpreadRadius`): ein Treffer entzündet nahe Gegner
  mit einer Grundstufe. Bewusst **kein** `applyTypeEffects`-Aufruf (nur
  `applyStatus`) → keine Rekursion/Kettenzündung ins Unendliche.
- **`core`-Applier-Schlüssel** (`cfg.js`): `statusDurationMult`/`statusTickMult`
  (multiplikativ, nach der Schleife), `statusStackBonus`/`statusMaxStacksBonus`
  (additiv), `fireDurationMult` (multipliziert das Klassen-Passiv),
  `fireSpreadRadius` (Max).
- **12 Karten**: 4 common (Dauer/Tick/Direktschaden/Krit), 4 rare (Napalm =
  +Stufe, Brandherd = Ausbreitung, Höllenglut = Deckel 3→5, Brandbombe = Tick),
  4 legendär (Inferno/Pyromane = Dauerbrand-Richtung, Feuersturm/Brandarsenal =
  Ausbreitungs-/Allrounder-Richtung).
- **Neue Dauertests** (Abschnitt 21, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (12, 4/4/4), Filter (Flammenpanzer sieht sie, physische Klasse
  nicht), Applier (Status-Boosts getrennt vom Klassen-Passiv), Brandstufen +
  Deckel + angehobener Deckel, Dauer/Tickschaden skaliert, Ausbreitung inner-/
  außerhalb der Reichweite.

### UMBAUPLAN-LP Phase 14 (Frost-Topf) — gemergt
Vierter Element-Topf (12 Karten, 4/4/4, Tag+`damageType` `frost`). Frost
verlangsamt statt zu ticken; die Karten nutzen die generischen Status-Boosts
(Stufen/Dauer/Deckel) aus Phase 13 plus frost-spezifische Hebel.
- **Stärkere Verlangsamung**: `frostSlowBonus` wird **additiv** zum
  Klassen-Passiv aufaddiert (`cfg.js`) und in `damagetypes.js` in den
  `speedMultOverride` gefaltet (den das Frostpanzer-Passiv seit Phase 9 nutzt).
- **Früheres/längeres Einfrieren**: `frostFreezeReduction` senkt die
  Freeze-Schwelle (`opts.freezeThreshold` in `status.js`),
  `frostFreezeDurationBonus` verlängert `freezeS`. Die „nur beim Übergang"-Regel
  bleibt (kein Stunlock).
- **Splittern** (`shatterMult`): Extra-Schaden gegen bereits **erstarrte**
  (`stunTimer > 0`) Ziele — die Frost-CC schlägt in Schaden um. Hook im
  Schadensschritt (`state.js`), multipliziert sich mit Abprall/Krit.
- **12 Karten**: 4 common (Verlangsamung/Dauer/Direktschaden/Krit), 4 rare
  (Tiefkühlung = Schwelle 3→2, Frostschock = +Stufe, Vereisung = +Freeze-Dauer,
  Splittern), 4 legendär (Blizzard/Absoluter Nullpunkt = CC-Richtung,
  Frostbrecher/Frostarsenal = Splitter-/Allrounder-Richtung).
- **Neue Dauertests** (Abschnitt 22, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (12, 4/4/4), Filter (Frostpanzer sieht sie, physische Klasse nicht),
  Applier (frostSlowBonus additiv zum Passiv), stärkere Verlangsamung,
  früheres Einfrieren (2 statt 3 Stufen), längeres Einfrieren, Splittern gegen
  erstarrte vs. freie Ziele.

### UMBAUPLAN-LP Phase 15 (Gift-Topf) — gemergt
Fünfter Element-Topf (12 Karten, 4/4/4, Tag+`damageType` `poison`). Gift tickt
wie Feuer (`damagePerTick 2`, `durationS 6`, Deckel 5) — die Karten nutzen die
**generischen Status-Boosts** aus Phase 13 (Stufen/Dauer/Tick/Deckel) plus eine
Gift-Ausbreitung.
- **Reine Reuse für die Stat-/Status-Skalierung**: `statusStackBonus`/
  `statusMaxStacksBonus` (5→7)/`statusTickMult`/`statusDurationMult` und das
  Klassen-Passiv `poisonDurationMult` (Phase 9) — keine neue Applier-Logik.
- **Gift-Ausbreitung (`poisonSpreadRadius`)**: der Feuer-Ausbreitungsblock in
  `damagetypes.js` ist zu einem **status-agnostischen** Zweig verallgemeinert
  (`spreadR` je nach `def.status` aus `fireSpreadRadius`/`poisonSpreadRadius`),
  der den jeweiligen Status auf nahe Gegner mit einer Grundstufe aufträgt —
  weiterhin per `applyStatus` statt `applyTypeEffects` (keine Rekursion). Neuer
  `core`-Schlüssel `poisonSpreadRadius` (Max) in `cfg.js`.
- **12 Karten**: 4 common (Dauer/Tick/Direktschaden/Krit), 4 rare (Nervengift =
  +Stufe, Überdosis = Deckel 5→7, Seuche = Ausbreitung, Konzentrat = Tick),
  4 legendär (Pandemie/Toxinbombe = Superstack-Richtung, Kontamination/
  Giftarsenal = Ausbreitungs-/Allrounder-Richtung).
- **Neue Dauertests** (Abschnitt 23, Gegenprobe für die neuen Bits bestanden):
  Struktur (12, 4/4/4), Filter (Radioaktiv sieht sie, physische Klasse nicht),
  Applier (Boosts + `poisonSpreadRadius`, Passiv getrennt), Deckel 5 + angehoben
  auf 7, Dauer/Tickschaden, Gift-Ausbreitung inner-/außerhalb der Reichweite.

### UMBAUPLAN-LP Phase 16 (Blitz-Topf) — gemergt
Sechster und letzter Element-Topf (12 Karten, 4/4/4, Tag+`damageType`
`lightning`). Blitz kettet (keine DOT) — die Karten steuern die Kette in
`damagetypes.js`.
- **Neue Owner-Overrides im Kettenpfad** (`damagetypes.js`, aus `meta.ownerCfg`):
  `lightningRangeBonus` (Sprungreichweite +px), `lightningFalloffBonus`
  (schwächerer Abfall, gedeckelt bei 0,95), `lightningStun` (Kettenglieder
  werden kurz betäubt). Die Zielzahl läuft weiter über `meta.lightningBonus`
  = `cfg.lightningBonusTargets` (Klassen-Passiv **+** Karten, additiv im
  Applier).
- **`core`-Applier-Schlüssel** (`cfg.js`): `lightningBonusTargets`/
  `lightningRangeBonus`/`lightningFalloffBonus` (additiv), `lightningStun`
  (Max). Reuse von `damageAdd`/`damageMult`/`critAdd`/`bulletSpeedMult`.
- **12 Karten**: 4 common (Schaden/Reichweite/Krit/Kugeltempo), 4 rare
  (Kettenreaktion = +Ziel, Verstärker = weniger Abfall, Überschlag = Betäubung,
  Starkstrom = ×Schaden), 4 legendär (Gewittersturm/Supraleiter =
  Ketten-Richtung, Donnerkeil/Blitzarsenal = Einschlag-/Allrounder-Richtung).
- **Neue Dauertests** (Abschnitt 24, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (12, 4/4/4), Filter (Teslapanzer sieht sie, physische Klasse nicht),
  Applier (Kettenziele additiv zum Passiv), mehr Kettenziele (+2 → 5/6),
  weitere Sprünge (fernes Ziel erst mit Bonus), schwächerer Abfall
  (Sprungschaden 14→18), Betäubung je Sprung. **Wichtig beim Testaufbau:**
  `applyTypeEffects` schädigt das EINSCHLAGZIEL selbst nicht (das macht die
  Trefferschleife) — der Test wendet den Aufschlag deshalb erst per
  `applyDamage` an, dann die Kette.

### UMBAUPLAN-LP Phase 17 (Zweitelement) — gemergt
Jede Klasse zieht ihr Primärelement voll; beim Runstart wird zusätzlich ein
zufälliges **Zweitelement** gezogen und mit halber Gewichtung beigemischt —
„fünfzig Spielgefühle aus sechs Töpfen, ohne eine einzige zusätzliche Karte".
- **Deterministische Ziehung** (`run.js`): `drawSecondElement(seed, primary,
  idx)` aus dem run-weiten Strom `rngForRun(seed, "element_<idx>")`, Pool = die
  sechs Elemente ohne das Primärelement. `idx` = `run.elementRerolls` (0 beim
  Start). `elementsOf(run)` liefert jetzt `[primär, zweit]`; der Element-Filter
  aus Phase 11 war schon auf ein **Array** ausgelegt.
- **Halbe Gewichtung** (`upgradepool.js`): `weightedPick` bekommt einen
  optionalen `elementWeight(def)` und normiert die Seltenheit jetzt über die
  **Summe der Element-Gewichte pro Stufe** statt der Kartenzahl — so bleibt die
  Rarity-Verteilung (60/30/10) exakt erhalten und nur INNERHALB einer Stufe
  erscheint das Zweitelement halb so oft (gemessen: `frost/fire ≈ 0,55` bei
  einem Flammenpanzer mit Frost). Ohne `elementWeight` (alle 1) ist die Summe
  gleich der Kartenzahl → identisch zum Phase-10-Verhalten (der
  Verteilungstest bleibt unverändert). `poolOpts` reicht `secondElement` +
  `balance.upgrades.secondElementWeight` (0,5) durch.
- **Shop-Reroll** (`run.js: rerollSecondElement()`, Preis
  `scrap.cost.rerollElement` 4): erhöht `elementRerolls` → neues Element aus dem
  nächsten Strom, ändert den Pool **sofort** fürs nächste Angebot. Knopf im
  Shop-Screen (`roomscreens.js`), zeigt das aktuelle Zweitelement.
- **Seed-Wiedergabe**: `secondElement` + `elementRerolls` stehen im
  `runSnapshot()` (nach Rerolls nicht mehr rein seed-ableitbar) und werden beim
  `resume` restauriert; ein Altstand ohne die Felder zieht sie deterministisch
  nach.
- **Anzeige**: die Raumvorschau (`preview.js`) zeigt „Elemente: Feuer + Frost"
  (Namen aus `status.json`), sichtbar vor dem Betreten wie der Modifikator.
- **Neue Dauertests** (Abschnitt 25, Gegenprobe für die Kernpunkte bestanden):
  Determinismus (gleicher Seed → gleiches Zweitelement) + Variation über Seeds,
  halbe Gewichtung + kein drittes Element, Shop-Reroll (Kosten/Index/Änderung),
  Snapshot-Fortsetzen. Playwright-Smoke: Element-Zeile in der Vorschau,
  `uilayout.mjs` über alle Viewports grün.

### UMBAUPLAN-LP Phase 18 (Signaturtopf Standard) — gemergt
Erster von zehn Signaturtöpfen (Phasen 18–27, je eine Klasse). Elementklassen
bekommen 6 Karten, Mechanikklassen 12. **Das eigentliche neue Stück ist der
`signatureClass`-Filter**, den alle zehn Töpfe teilen — die sechs
Standard-Karten selbst brauchen dank des generischen `core`-Appliers (Phase 10)
keine Codezeile.
- **`signatureClass`-Filter** (`upgradepool.js: buildCandidates()`): eine Karte
  mit `signatureClass` gehört genau EINER Klasse und erscheint nur, wenn
  `opts.starterTank` dieser Klasse entspricht. Karten OHNE `signatureClass`
  bleiben universell (unverändert). `run.js: poolOpts()` reicht
  `starterTank: run.starterTank` durch. Ohne gesetztes `starterTank` (z. B. eine
  Belohnung ohne Klassenkontext) fällt **jede** Signaturkarte durch — so kann
  eine fremde Klassensignatur nie in einer Elite-/Schatz-Belohnung auftauchen.
  Der Filter sitzt bewusst neben dem Element-Filter aus Phase 11 (dasselbe
  Muster, andere Achse: Element vs. Klasse).
- **Sechs Standard-Karten** (`data/upgrades.json`, alle Tag `signature` +
  `signatureClass: "player"`, Verteilung **2/2/2**): der gemeinsame Tag
  `signature` bedeutet — wie bei einem Element-Topf — höchstens EINE
  Signaturkarte pro Angebot. Die Standard-Klasse hat als einzige **kein**
  Element und **kein** Passiv („keine", Phase 9); ihre Signatur ist deshalb
  bewusst der beste reine **Grundlagen**-Topf: Mehrfach-Stat-Kombis, die kein
  einzelner Kern-/Element-Eintrag bietet (Grundausbildung, Manöver,
  Gefechtsdrill, Verstärkte Wanne, Alleskönner, Gardist) — alle über bestehende
  `core`-Schlüssel, kein neues Engine-Verhalten.
- **Zwei Bestandstests mussten den neuen Kartentyp kennen**: (1) der
  Phase-10-Kernzähler (`d.core && !d.damageType`) zählte die Signaturkarten
  mit — jetzt zusätzlich `&& !d.signatureClass`; (2) der „jede Karte ziehbar"-
  Strukturtest zog ohne `starterTank` und hielt die klassengebundenen Karten
  für tot — er zieht jetzt zusätzlich mit jeder vorkommenden `signatureClass`.
- **Neue Dauertests** (Abschnitt 26, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (6, 2/2/2, Tag+`signatureClass`), **Filter** (Standard sieht sie,
  `c_flame` nie, ohne `starterTank` keine), Applier-Arithmetik (Delta gegen eine
  upgradelose Basis mit den Zahlen der Karte selbst), höchstens eine Signatur
  pro Angebot. Gegenproben rot bestätigt: Filter aus → fremde Klasse sieht die
  Karten; `damageAdd`-Pfad genullt → Applier-Delta falsch; Rarität verdreht →
  Verteilung ≠ 2/2/2.

### UMBAUPLAN-LP Phase 19 (Signaturtopf Sprengpanzer) — gemergt
Zweiter Signaturtopf (6 Karten, 2/2/2, Tag `signature` + `signatureClass:
"c_blast"`). Nutzt den `signatureClass`-Filter aus Phase 18 und die
Explosiv-`core`-Schlüssel aus Phase 12 — **keine neue Engine-Zeile**.
- **Klassen-, nicht elementgebunden**: die Karten tragen bewusst **keinen**
  `damageType` (nur `signatureClass`). Sonst würde der Element-Filter aus
  Phase 11 sie zusätzlich einschränken — der `signatureClass`-Filter allein
  ist die richtige Achse. Ein Test wacht darüber.
- **Explosiv-Identität** über bestehende `core`-Schlüssel: `mineAdd`,
  `explosionRadiusMult` (wirkt auf Schuss **und** Mine über `mineRadiusMult`),
  `explosionDamageMult`, `schrapnellCount`, `allExplosive` (jeder Schuss
  zündet). Die Sprengpanzer-Schüsse zünden **nur** mit einer Karte, die
  `allExplosive`/`explosionEveryShots` setzt (der Klassen-`damageType
  explosive` färbt nur ein) — deshalb schaltet die Legendäre *Sprengmeister*
  genau das frei; die commons/rares skalieren Radius/Schaden/Splitter/Minen
  (wirken über die Minen auch ohne `allExplosive`).
- **Sechs Karten**: 2 common (Zünder = Bombe+Radius, Kompression =
  Explosionsschaden+Nachladen), 2 rare (Splittermantel = Schrapnell+Schaden,
  Druckwelle = Radius+Explosionsschaden), 2 legendär (Sprengmeister =
  `allExplosive`+Radius+Schaden, Sprengarsenal = Bomben+Schrapnell+
  Explosionsschaden).
- **Neue Dauertests** (Abschnitt 27, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (6, 2/2/2, kein `damageType`), Filter (`c_blast` sieht sie, `player`
  nie), Applier (`allExplosive` freigeschaltet, `mineAdd`, Radius-Faktor auf
  `mineRadiusMult`, `schrapnellCount`, `explosionDamageMult`), höchstens eine
  Signatur pro Angebot. Gegenproben rot bestätigt: `allExplosive`-Zweig aus →
  Sprengmeister schaltet nicht frei; Rarität verdreht → Verteilung ≠ 2/2/2;
  Filter aus → fremde Klasse sieht die Karten.

### UMBAUPLAN-LP Phase 20 (Signaturtopf Frostpanzer) — gemergt
Dritter Signaturtopf (6 Karten, 2/2/2, Tag `signature` + `signatureClass:
"c_frost"`). Nutzt den `signatureClass`-Filter aus Phase 18 und die
Frost-`core`-Schlüssel aus Phase 14 — **keine neue Engine-Zeile**.
- **Klassen-, nicht elementgebunden** (kein `damageType`) wie schon Phase 19.
- **Frost-Identität** über bestehende `core`-Schlüssel: `frostSlowBonus`
  (**additiv** zum Klassen-Passiv 0,2), `frostFreezeReduction` (Einfrieren
  früher, in `damagetypes.js` bei `Math.max(1, …)` gedeckelt),
  `frostFreezeDurationBonus` (längeres Einfrieren), `shatterMult` (Extra-
  Schaden gegen Erstarrte) plus die generischen Status-Boosts
  (`statusStackBonus`, `statusDurationMult`).
- **Sechs Karten**: 2 common (Kältekammer = Verlangsamung+Schaden, Raureif =
  Frostdauer+Geschosstempo), 2 rare (Tiefkühlung = frühere/längere Erstarrung,
  Splitterfrost = Splittern+Schaden), 2 legendär (Blizzard =
  Verlangsamung+Froststufe+Erstarrung, Absoluter Nullpunkt =
  Splittern+frühere Erstarrung+Schaden).
- **Neue Dauertests** (Abschnitt 28, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (6, 2/2/2, kein `damageType`), Filter (`c_frost` sieht sie, `player`
  nie), Applier (`frostSlowBonus` additiv zum Passiv, `statusStackBonus`,
  `frostFreezeDurationBonus`, `shatterMult`, `frostFreezeReduction`), höchstens
  eine Signatur pro Angebot. Gegenproben rot bestätigt: `frostSlowBonus`-Pfad
  genullt → nicht mehr additiv; Rarität verdreht → Verteilung ≠ 2/2/2;
  Filter aus → fremde Klasse sieht die Karten.

### UMBAUPLAN-LP Phase 21 (Signaturtopf Teslapanzer) — gemergt
Vierter Signaturtopf (6 Karten, 2/2/2, Tag `signature` + `signatureClass:
"c_tesla"`). Nutzt den `signatureClass`-Filter aus Phase 18 und die
Blitz-`core`-Schlüssel aus Phase 16 — **keine neue Engine-Zeile**.
- **Klassen-, nicht elementgebunden** (kein `damageType`) wie schon Phase 19/20.
- **Blitz-Identität** über bestehende `core`-Schlüssel: `lightningBonusTargets`
  (**additiv** zum Klassen-Passiv 1 → mehr Kettenziele), `lightningRangeBonus`
  (weitere Sprünge), `lightningFalloffBonus` (schwächerer Abfall, in
  `damagetypes.js` bei 0,95 gedeckelt), `lightningStun` (Betäubung je Sprung,
  `Math.max`).
- **Sechs Karten**: 2 common (Leitwerk = Reichweite+Schaden, Kondensator =
  schwächerer Abfall+Geschosstempo), 2 rare (Kettenreaktion = +Ziel+Reichweite,
  Überschlag = Betäubung+Schaden), 2 legendär (Gewittersturm =
  +2 Ziele+Reichweite+Abfall, Supraleiter = +Ziel+Betäubung+Schaden).
- **Neue Dauertests** (Abschnitt 29, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (6, 2/2/2, kein `damageType`), Filter (`c_tesla` sieht sie, `player`
  nie), Applier (`lightningBonusTargets` additiv zum Passiv, `lightningRangeBonus`,
  `lightningFalloffBonus`, `lightningStun`), höchstens eine Signatur pro Angebot.
  Gegenproben rot bestätigt: `lightningBonusTargets`-Pfad genullt → nicht mehr
  additiv; Rarität verdreht → Verteilung ≠ 2/2/2; Filter aus → fremde Klasse
  sieht die Karten.

### UMBAUPLAN-LP Phase 22 (Signaturtopf Radioaktiv) — gemergt
Fünfter Signaturtopf (6 Karten, 2/2/2, Tag `signature` + `signatureClass:
"c_toxic"`). Nutzt den `signatureClass`-Filter aus Phase 18 und die
Gift-`core`-Schlüssel aus Phase 15 — **keine neue Engine-Zeile**.
- **Klassen-, nicht elementgebunden** (kein `damageType`) wie schon Phase 19–21.
- **Gift-Identität** über bestehende `core`-Schlüssel: die generischen
  Status-Boosts `statusStackBonus` (+Giftstufe/Treffer), `statusMaxStacksBonus`
  (Deckel 5→7), `statusTickMult` (Tickschaden), `statusDurationMult` (Dauer) plus
  `poisonSpreadRadius` (Seuche/Ausbreitung). Die Boosts sind **getrennt** vom
  Klassen-Passiv `poisonDurationMult` (1,25) — ein Test wacht darüber, dass eine
  Karte das Passiv nicht anfasst.
- **Sechs Karten**: 2 common (Verseuchung = Dauer+Schaden, Konzentrat =
  Tickschaden+Krit), 2 rare (Nervengift = +Stufe+Schaden, Seuche =
  Ausbreitung+LP), 2 legendär (Pandemie = Deckel+Stufe+Tickschaden,
  Kontamination = Ausbreitung+Dauer+Schaden).
- **Neue Dauertests** (Abschnitt 30, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (6, 2/2/2, kein `damageType`), Filter (`c_toxic` sieht sie, `player`
  nie), Applier (Status-Boosts landen, Klassen-Passiv unberührt,
  `poisonSpreadRadius` per `Math.max`), höchstens eine Signatur pro Angebot.
  Gegenproben rot bestätigt: `statusStackBonus`-Pfad genullt → Delta falsch;
  Rarität verdreht → Verteilung ≠ 2/2/2; Filter aus → fremde Klasse sieht die
  Karten.

### UMBAUPLAN-LP Phase 23 (Signaturtopf Flammenpanzer) — gemergt
Sechster Signaturtopf (6 Karten, 2/2/2, Tag `signature` + `signatureClass:
"c_flame"`) und der letzte Element-Topf. Nutzt den `signatureClass`-Filter aus
Phase 18 und die Feuer-`core`-Schlüssel aus Phase 13 — **keine neue Engine-Zeile**.
- **Klassen-, nicht elementgebunden** (kein `damageType`) wie schon Phase 19–22.
- **Feuer-Identität** über bestehende `core`-Schlüssel: `fireDurationMult`
  **multipliziert** das Klassen-Passiv (1,25) — anders als der generische
  `statusDurationMult` (ein Test prüft genau diese Multiplikation) — plus
  `statusStackBonus` (+Brandstufe/Treffer), `statusMaxStacksBonus` (Deckel 3→5),
  `statusTickMult` (Tickschaden) und `fireSpreadRadius` (Ausbreitung).
- **Sechs Karten**: 2 common (Brandbeschleuniger = Dauer+Schaden, Glutkern =
  Tickschaden+Krit), 2 rare (Napalm = +Stufe+Schaden, Brandherd =
  Ausbreitung+LP), 2 legendär (Inferno = Deckel+Stufe+Dauer, Feuersturm =
  Ausbreitung+Tickschaden+Schaden).
- **Neue Dauertests** (Abschnitt 31, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (6, 2/2/2, kein `damageType`), Filter (`c_flame` sieht sie, `player`
  nie), Applier (`fireDurationMult` multipliziert das Passiv, `statusStackBonus`,
  `statusMaxStacksBonus`, `fireSpreadRadius` per `Math.max`), höchstens eine
  Signatur pro Angebot. Gegenproben rot bestätigt: `fireDurationMult`-Pfad
  genullt → Passiv nicht mehr multipliziert; Rarität verdreht → Verteilung ≠
  2/2/2; Filter aus → fremde Klasse sieht die Karten.

### UMBAUPLAN-LP Phase 24 (Signaturtopf Abprallpanzer) — gemergt
Erster **Mechanikklassen**-Topf: **12 Karten (4/4/4)** für den Abprallpanzer
(`c_ricochet`) statt der sechs eines Element-Topfs — Mechanikklassen haben
keinen eigenen Schadenstyp, ihr Charakter kommt aus einer eigenen Regel, daher
der doppelte Topf (Plan). Nutzt den `signatureClass`-Filter (Phase 18).
- **Klassen-, nicht elementgebunden** (kein `damageType`) wie schon Phase 19–23.
- **Bestehende Abprall-Schlüssel**: `ricochetAdd` (+Abpraller), `bounceDamageBonus`
  (mehr Schaden auf gebandete Schüsse, via `shooterBounceBonus` in `state.js`),
  `critOnBounce` (gebandete Schüsse kritisch), `critMultBonus` (größerer
  Kritfaktor) plus Basisstats.
- **Eine neue klassenexklusive Regel** `bounceRampPerBounce` (`cfg.js` +
  `state.js`): Schaden **je gezähltem Wandabpraller** (`b.wallBounces`), nicht
  nur der pauschale 2×-Bonus für ≥1 Abpraller. Das ist die in **Phase 4 bewusst
  zurückgestellte** `perBounce`-Alternative — hier als Signaturregel des
  Abprallpanzers, sodass ein Doppelbank-Schuss härter trifft als ein einfacher.
  Verrechnet im `shooterBounceBonus` (`1 + bounceDamageBonus +
  bounceRampPerBounce × wallBounces`).
- **Zwölf Karten**: 4 common (Kalibrierung, Bandenschlag, Schnellfeuer,
  Präzision), 4 rare (Konterschlag=critOnBounce, Wuchtgeschoss, Zusatzabpraller,
  Verstärker=critMultBonus), 4 legendär (Trickmeister, Kettenbank=`bounceRampPerBounce`,
  Querschläger, Kanonade).
- **Neue Dauertests** (Abschnitt 32, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (12, 4/4/4, kein `damageType`), Filter (`c_ricochet` sieht sie,
  `player` nie), Applier (`ricochetAdd` auf die Basis 2, `bounceDamageBonus`,
  `critOnBounce`, `critMultBonus`, `bounceRampPerBounce`) UND — der Kern —
  **auf Schadensebene**: die Rampe skaliert den gebandeten Schaden je
  Wandabpraller (Kontrolle ohne Rampe, dann 1 und 2 Abpraller). Gegenproben rot
  bestätigt: Rampe im Trefferpfad genullt → Schaden falsch; Rampe-Applier
  genullt → cfg-Wert fehlt; Rarität verdreht → Verteilung ≠ 4/4/4; Filter aus →
  fremde Klasse sieht die Karten.

### UMBAUPLAN-LP Phase 25 (Signaturtopf Schrottpanzer) — gemergt
Zweiter **Mechanikklassen**-Topf: **12 Karten (4/4/4)** für den Schrottpanzer
(`c_scrap`) über den `signatureClass`-Filter (Phase 18). Kein `damageType`
(nur klassengebunden) wie schon Phase 19–24.
- **Bestehender Schlüssel** `scrapAdd` (mehr Schrott je Raum, über
  `scrapBonusPerRoom` in `run.js`) plus Basisstats (Schaden/LP/Magazin/
  Nachladen/Krit/Geschosstempo).
- **Eine neue klassenexklusive Regel** `scrapDamageBonus` (`cfg.js`): addiert
  zum Klassen-Passiv `scrapDamagePer100` (0,05) und stärkt so die
  „reicher = stärker"-Skalierung. `applyScrapDamage()` läuft in `state.js`
  **nach** `applyUpgrades()`, liest also den erhöhten Faktor und skaliert den
  Schaden je 100 Schrott.
- **Zwölf Karten**: 4 common (Sammler, Verwerter, Recycling, Werkbank),
  4 rare (Kopfgeld, Investition, Schrottpanzerung, Nachschub), 4 legendär
  (Schrottmogul, Hochfinanz=`scrapDamageBonus`, Schrottjuggernaut, Goldrausch).
- **Neue Dauertests** (Abschnitt 33, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (12, 4/4/4, kein `damageType`), Filter (`c_scrap` sieht sie, `player`
  nie), Applier (`scrapAdd` → `scrapBonusPerRoom`, `scrapDamageBonus` additiv
  zum Passiv) UND — der Kern — **auf Schadensebene**: das erhöhte
  `scrapDamagePer100` skaliert den Schaden je 100 Schrott (Basis vs. Hochfinanz
  bei 200 Schrott; No-op bei 0 Schrott). Gegenproben rot bestätigt:
  `scrapDamageBonus`-Applier genullt → nicht mehr additiv; `applyScrapDamage`-
  Skalierung genullt → kein Mehrschaden; Rarität verdreht → Verteilung ≠ 4/4/4;
  Filter aus → fremde Klasse sieht die Karten.

### UMBAUPLAN-LP Phase 26 (Signaturtopf Nekromant) — gemergt
Dritter **Mechanikklassen**-Topf: **12 Karten (4/4/4)** für den Nekromanten
(`c_necro`) über den `signatureClass`-Filter (Phase 18). Kein `damageType`
(nur klassengebunden) wie schon Phase 19–25. Verstärkt die zwei gebauten
Nekromanten-Mechaniken: **Wiederbelebung** (`reviveChance`, Phase 9) und
**Geisterpanzer** (`ghost_crew`, Phase 7).
- **Drei neue klassenexklusive Regeln**: `reviveChanceBonus` (`cfg.js`, additiv
  zum Klassen-Passiv `reviveChance` 0,25 — `state.js: tryRevive` liest den Wert),
  `grantGhostCrew` (`cfg.js`, schaltet `ghostCrew` frei wie das
  `ghost_crew`-Upgrade → getötete Gegner kämpfen als Geist weiter) und
  `ghostDurationBonus` (`cfg.js` + `ghost.js` + `state.js`: die Geister halten
  länger — **Qualität statt Zahl**, der Deckel `balance.ghost.maxActive` bleibt,
  wie im Plan für Nekromant/Ingenieur gefordert). `createGhost()` nimmt einen
  optionalen `durationBonus`, den `killTank()` aus der Spieler-cfg durchreicht.
- **Zwölf Karten**: 4 common (Totenbeschwörung, Lebenskraft, Seelenernte,
  Verwesung), 4 rare (Wiedergänger=`reviveChanceBonus`,
  Geisterbeschwörung=`grantGhostCrew`, Knochenpanzer, Todesmal), 4 legendär
  (Lich, Geisterlegion=`grantGhostCrew`+`ghostDurationBonus`, Seelenfresser,
  Unsterblich). Die Wiederbelebungschance klettert gebaut höchstens auf ~0,80
  (Basis 0,25 + alle Revive-Karten) — bleibt also ein Glücksspiel, kein
  garantiertes Überleben (kein Deckel nötig).
- **Neue Dauertests** (Abschnitt 34, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (12, 4/4/4, kein `damageType`), Filter (`c_necro` sieht sie, `player`
  nie), Applier (`reviveChanceBonus` additiv, `grantGhostCrew` setzt `ghostCrew`,
  `ghostDurationBonus`) UND — der Kern — **zwei Mechanismus-Tests**: (1)
  Wiederbelebung — mit einem gestellten RNG-Wurf (0,30) belebt die Basis (0,25)
  nicht, die geboostete (0,45) schon, und stellt die vollen LP her; (2)
  Geisterdauer — `createGhost()` mit Bonus lebt länger als ohne. Gegenproben rot
  bestätigt: `reviveChanceBonus`-Applier genullt → keine Wiederbelebung;
  `ghostDurationBonus` im Geist genullt → keine längere Dauer; `grantGhostCrew`
  auf `false` → kein Geist; Rarität verdreht → Verteilung ≠ 4/4/4; Filter aus →
  fremde Klasse sieht die Karten.

### UMBAUPLAN-LP Phase 27 (Signaturtopf Ingenieur) — gemergt
Vierter und **letzter** Signaturtopf: **12 Karten (4/4/4)** für den Ingenieur
(`c_engineer`) über den `signatureClass`-Filter (Phase 18). Kein `damageType`
(nur klassengebunden) wie schon Phase 19–26. **Damit haben alle zehn Klassen
ihren Signaturtopf (Phasen 18–27).**
- **Bestehende Minen-/Explosiv-Schlüssel** (`mineAdd`, `explosionRadiusMult`,
  `explosionDamageMult`, `schrapnellCount`) plus Basisstats — die Mine liegt im
  festen Sekundärslot, wirkt also immer.
- **Eine neue klassenexklusive Regel** `builtHpBonus` (`cfg.js`): additiv zum
  Klassen-Passiv `builtHpMult` (1,2) — `tank.js: placeTrapWall()` liest den
  erhöhten Faktor und baut eine haltbarere Sperrmauer. Bei Grundhaltbarkeit 3
  hält die Mauer mit dem Passiv 4 Treffer, mit der legendären *Festung* (+0,5)
  5 Treffer.
- **Zwölf Karten**: 4 common (Werkzeugkasten, Verstärkung, Sprengfalle,
  Präzisionsbau), 4 rare (Bunker=`builtHpBonus`, Minenfeld, Splitterladung,
  Feldwerkstatt), 4 legendär (Festung=`builtHpBonus`, Großkaliber,
  Pionierarsenal, Chefingenieur).
- **Neue Dauertests** (Abschnitt 35, Gegenprobe für jeden Kernpunkt bestanden):
  Struktur (12, 4/4/4, kein `damageType`), Filter (`c_engineer` sieht sie,
  `player` nie), Applier (`builtHpBonus` additiv zum Passiv, `mineAdd`) UND —
  der Kern — **END-TO-END über `useGadget`**: eine echt gebaute Sperrmauer hält
  mit höherem `builtHpMult` mehr Treffer aus (Grund 4 vs. Festung 5, aus der
  gelesenen `customDurability` statt aus einer nachgerechneten Formel).
  Gegenproben rot bestätigt: `builtHpBonus`-Applier genullt → nicht mehr
  additiv; `placeTrapWall`-Multiplikation genullt → Mauer bleibt bei 3;
  Rarität verdreht → Verteilung ≠ 4/4/4; Filter aus → fremde Klasse sieht die
  Karten.

### UMBAUPLAN-LP Phase 28 (Balance + neue Tests) — gemergt
Die Schlussabnahme des LP-Umbaus. **Drei der fünf verlangten Dauertests waren
schon abgedeckt** und bleiben, wo sie sind: „Zeit bis zum Tod" (Trefferzahl je
Gegnertyp, Abschnitt 10a), „Rechenzeit" (Frame-Budget des Bankshot-Solvers,
Abschnitt 7c — heute ~2 ms gegen 6 ms; die 8,86-ms-Zahl im Plan war veraltet)
und die „gezogene Verteilung" an einer synthetischen Liste (Abschnitt 18b).
**Neu in Abschnitt 36:**
- **Gezogene Verteilung über den echten Pool**: 2.000 `rollOffers`-Angebote
  (je 3 Karten) einer echten Klasse im Raum 10, die Seltenheit der tatsächlich
  angebotenen Karten muss auf ≤ 5 Prozentpunkte an `balance.rarity` (60/30/10)
  liegen. Prüft `weightedPick` + Element-/Signatur-Filter im Zusammenspiel.
- **Keine leere Seltenheitsstufe**: der Plan wollte ursprünglich gleich große
  Stufen (Abweichung > 1 Karte → Fehler); der `weightedPick`-Fix (Phase 10) hat
  das **überholt** — die Verteilung ist größenunabhängig, die Töpfe ab Phase 11
  machen die Stufen bewusst ungleich. Die verbleibende harte Zusicherung: für
  jede der zehn Klassen ist im Raum 10 jede Seltenheitsstufe (common/rare/
  legendary) ziehbar (sonst teilte `weightedPick` durch 0 und die
  60/30/10-Garantie bräche).
- **Raumdauer als deterministische HP/DPS-Schranke**: „verhindert, dass Räume
  wieder lang statt schwer werden". Ein bewegungsfähiger Bot ist hier **nicht
  belastbar** (verkantet sich bei freier Mitte-zu-Mitte-Sichtlinie, s. Phase 3),
  deshalb eine deterministische Schranke: die minimale Zeit, alle Gegner eines
  Raums ≥ 10 mit dem **Standard-Schaden (10)** und der Grund-Feuerrate zu töten
  (Trefferzahl × Nachladeschritt, inkl. zweiter Welle). Gemessener schlimmster
  Raum: **24,0 s** (Budget **30 s**). Einseitige Schranke — fängt HP-Inflation
  (die eigentliche „lang statt schwer"-Regression des LP-Umbaus), nicht
  KI-Trägheit (die der Umbau nicht anfasst). Gegenproben rot bestätigt:
  Gegner-LP aufgebläht → Raumdauer 47 s > Budget; `weightedPick`-Normierung
  ausgebaut → gezogene Verteilung ≠ 60/30/10; `legendary.minRoom` = 99 →
  leere Legendary-Stufe.
- **Keine Balance-Werte geändert**: alle Tests sind am aktuellen Stand grün.
  Der im Plan genannte Bankshot-Faktor-Kalttest (2,0 → ggf. 2,5/3,0) ist ein
  manuelles Spielgefühl-Urteil, kein automatisierbarer Test, und bleibt offen.

### Controller-Steuerung „richtig gemacht" (Nutzer-Meldung) — gemergt
Meldung: Controller (Xbox) „reagiert gar nicht" + „Menü nicht bedienbar" (PC
und Handy). Diagnose mit einem **injizierten Standard-Gamepad** (Playwright +
Node-Isolationstest von `input.js`): In-Game (linker Stick fahren, RT feuern)
war korrekt — der Bug lag im Menü. Zwei echte Lücken:
- **`src/core/input.js`**: die Menü-Richtung kam NUR aus der D-Pad-**Flanke**.
  Der **linke Stick navigierte gar nicht** (das machen praktisch alle
  Controller-Nutzer), und ein gehaltenes D-Pad **wiederholte nicht**. Fix:
  `getMenuState()` liefert jetzt eine **gehaltene** Richtung `menuAxis` aus
  **Stick ODER D-Pad** (Schwelle `data/input.json: stick.menuThreshold` 0,5);
  die Wiederholung (erst ein Schritt, dann Auto-Repeat) macht `menunav.js` —
  genau wie bei der Tastatur. Die SPEC-Doktrin (Abschnitt 9) nennt fürs Menü
  das D-Pad; der Stick kommt bewusst als Zusatz dazu.
- **`src/main.js`**: die **In-Run-Overlays** (Upgrade, Karte, Shop, Event,
  Raumvorschau + Ausrüstungsseite) hatten **gar keine** Controller-Navigation —
  nur Maus/Touch. Neu: ein generischer `runOverlayNav` (dieselbe `menunav`)
  navigiert das jeweils sichtbare Overlay (`visibleRunOverlay()`), die
  Spiellogik pausiert dahinter — genau wie der Startbildschirm. Maus/Touch
  laufen parallel weiter. **Umsetzungsfund:** ein `offsetParent !== null`-Filter
  auf der Fokusliste verwarf in den fixed-positionierten Overlays fast alle
  Knöpfe (nur einer blieb → Fokus klebte); der bewährte `focusablesIn` filtert
  nur `hidden`/`disabled`, also tut das der Overlay-Nav jetzt auch.
- **`tests/gamepad.mjs` (NEU, dependency-frei)**: stubbt `navigator.getGamepads`
  und prüft `input.js` — Stick fährt, RT feuert (kein Autofire), Stick UND
  D-Pad liefern eine **gehaltene** Menü-Richtung, A bestätigt genau einmal
  (Flanke). Gegenprobe bestanden: alte edge-basierte `menuDir` → 4 Checks rot.
  End-to-end im Browser gegengeprüft (Fake-Xbox-Pad: Startmenü-Stick +
  Auto-Repeat, Vorschau per Stick + A → Raum startet).

### Neuer Plan: `PLAN-STARTMENU.md` (Startmenü, Klassen, Codex, Post-Run)
Vom Nutzer geliefert: 15-Phasen-Plan (Phase 0–14) für Hauptmenü,
Klassenwahl, Schwierigkeit, Einstellungen, **Codex-Galerie** und
Post-Run-Screen. Eine Phase pro Session. Maßgeblich ist die Ist-Referenz
**`STARTMENU-BESTAND.md`** (Phase-0-Deliverable) — der Plan nennt mehrere
Dateien falsch/„neu", obwohl sie existieren. **Entwicklungsbranch dieses
Plans: `claude/startmenu-phasenplan-o4n0d5`** (nicht der LP-Branch oben).

- **Phase 0 (Bestandsaufnahme) — erledigt.** `STARTMENU-BESTAND.md`:
  Save-Code (`storage.js`, kein `version`-Feld, kein Codex), kein
  Pause-Overlay, Panzer = Sprites+Fallback (alle Klassen aliasen auf
  `player` → Codex-Silhouette per Einfärbung, nicht Sprite-Kopie), vier
  Codex-Quellen in `tanks.json`/`upgrades.json` (10 Klassen, 246 Upgrades,
  11 Gegner, 3 Bosse). **Festlegung: Eliten sind Laufzeit-Affixe → KEINE
  eigene Codex-Kategorie** (4 Kategorien bleiben). Element-Karten haben
  eigene IDs → keine künstliche Aufspaltung.
- **Phase 1 (Screen-State-Machine + Browser-Zurück + Debug-Flags) —
  erledigt.** Das Fokus-System war schon da (`ui/menunav.js`), neu ist die
  **Screen-Verwaltung** darüber:
  - **`src/ui/menu.js`** (neu, `createMenu`): Registry benannter
    Menü-Overlays + Zurück-Stack + History. **Eine Quelle der Wahrheit:**
    Vorwärts pusht (`show`→`pushState`), JEDE Rückwärtsnavigation
    (Zurück-Knopf/ESC/Controller-B/Browser-Geste) läuft über
    `history.back()` → `popstate` → `onPopState()` macht die Anzeige. An
    der Wurzel wird ein Ersatz-Eintrag gepusht, damit die Geste nicht die
    Seite verlässt. `hideAll()` beim Run-Start, `root('main')` beim
    Zurückkehren. Die **In-Run-Overlays** (Upgrade/Karte/Shop/Event/
    Vorschau) bleiben bewusst getrennt (`runOverlayNav`, hängen an
    `run.phase`).
  - **`src/core/debug.js`** (neu): liest `?debug=1` + `skipToRun`/
    `unlockAll`/`codexRevealAll` aus der URL; Einzelflags wirken nur bei
    gesetztem `debug=1`. `main.js` startet bei `skipToRun` direkt einen Run.
  - **`input.js`/`input.json`**: neues `menuBack` (ESC/P oder Controller-B =
    Button 1) in `getMenuState()`. Verbraucht `queued.pause` — im Menü läuft
    `consumePause()` nicht, also keine Doppelentnahme; im Run konsumiert
    `consumePause()` zuerst.
  - **`main.js`**: die drei Menü-Screens (Start/Einstellungen/Klasse) laufen
    jetzt über `menu` statt der Ad-hoc-`activeMenuNav`-Umschaltung; neuer
    `popstate`-Handler (im Run → Pause + Ersatz-Push).
  - **Tests:** `regression.mjs` Abschnitt 8k (Stack/History mit Fake-History,
    `menuBack`, Wurzel-Verhalten, `hideAll`), `gamepad.mjs` Fall 6 (B→
    `menuBack`, Flanke). Gegenproben rot bestätigt (menuBack aus, `onPopState`
    ohne Stack-Pop). Echter Browser-Smoke: Menü-Wechsel, Browser-Zurück,
    `skipToRun` — fehlerfrei.

- **Phase 2 (Panzerklassenwahl-Screen) — erledigt.** Der Screen selbst
  existierte schon (`#classScreen`, `buildClassList`); neu ist die
  **Freischalt-Gating** und die Testbarkeit:
  - **`src/game/classes.js`** (neu): `playerClassEntries(data)` (die zehn
    `player:true`-Typen), `isClassUnlocked(def, {unlockAll})` (frei, wenn
    `unlocked !== false` oder `unlockAll`; fehlendes Feld = frei) und
    `createClassButton(doc, id, def, {selected, unlocked, fmtStats})` —
    bewusst aus `main.js` extrahiert, damit die drei Zustände (gewählt/frei/
    gesperrt) headless mit `domstub` prüfbar sind.
  - **`data/tanks.json`**: `"unlocked": true` an alle zehn Klassen (Testphase
    — alle frei; die Scharfschaltung kommt später, „Offene Punkte").
  - **Gesperrte Klasse = sichtbar, aber nicht wählbar**: `createClassButton`
    setzt `disabled` (die Fokus-Nav via `focusablesIn`-`!disabled` überspringt
    sie) + `.locked` (gedimmt, gestrichelt, 🔒 in `style.css`). `main.js`
    hängt den Klick-Handler nur bei freien Klassen an. `starterTank`-Guard
    fällt auf `player` zurück, wenn die gespeicherte Klasse nicht (mehr)
    spielbar/frei ist.
  - **Auswahl vs. Fokus optisch getrennt**: `.active` = goldener Rahmen +
    Hintergrund, `.menu-focus` = gelbe Outline (Testschritt 2).
  - **`?debug=1&unlockAll`** hebt die Sperre pauschal auf (`classOpts` in
    `main.js`).
  - **Tests:** `regression.mjs` Abschnitt 8l (Klassenliste, Freischalt-Regel
    mit **eigenen Zahlen**, drei Knopf-Zustände im Fake-DOM). Browser-Smoke
    (mit temporär gesperrter Klasse) bestätigt: 10 Klassen, Auswahl markiert,
    gesperrt = disabled/unklickbar, `unlockAll` macht wählbar.
  - **`seen`-Flag (Codex) bewusst aufgeschoben** auf Phase 7 — es ist ein
    Save-Konzept, kein statisches Datenfeld (siehe `STARTMENU-BESTAND.md`).

- **Phase 3 (Schwierigkeitsgrad-Auswahl) — erledigt.** Ist-Abgleich: die
  Auswahl (`#modeSelect`, `leicht`/`normal`/`schwer`) existierte schon auf dem
  Startbildschirm und ist per Tastatur/Gamepad navigierbar — ein **separater
  Screen war nicht nötig** (die Testschritte verlangen nur wählbar/beschrieben/
  persistiert/navigierbar/messbar). Neu ist die **Wirkung** und die Anzeige:
  - **`data/difficulty.json: modes`** je Stufe um `hpMult`/`damageMult`/`desc`
    ergänzt (leicht 0,7/0,7, normal 1/1, schwer 1,4/1,3). `budgetMult` (Gegner-
    Dichte) und `lives` bestehen weiter.
  - **`src/game/cfg.js: applyModeScaling(cfg, hpMult, damageMult)`** (neu):
    globaler Regler auf **Gegner** (nie den Spieler), **getrennt** von der
    Raumtiefen-`applyHpScaling` und **inkl. Bosse** (ein `schwer`-Boss ist
    zäher UND härter). Skaliert `maxHp` und `damage`.
  - **Verdrahtung:** `run.js` zieht `mode.hpMult`/`damageMult` (Default 1) und
    reicht sie als `enemyHpMult`/`enemyDamageMult` an `createState()`; `state.js`
    wendet `applyModeScaling` an **beiden** Gegner-Erzeugungsstellen an (erste
    Welle + `updateWave`, über `state.enemyHpMult`/`enemyDamageMult`). Der
    Spieler wird separat gebaut und bleibt unberührt.
  - **UI:** `#modeDesc` unter der Auswahl zeigt die Kurzbeschreibung der
    gewählten Stufe (`main.js: refreshModeDesc`), Auswahl persistiert wie bisher
    (`getPref('mode')`).
  - **Tests:** `regression.mjs` Abschnitt 8m — `applyModeScaling` mit **eigenen
    Zahlen** + Integration (gleicher Seed, jeder Gegner trägt exakt seinen
    Modus-Faktor auf die Basis-LP, Spieler unverändert). Gegenprobe rot
    bestätigt (Verdrahtung `run→state` gekappt → Gegner unskaliert). Browser-
    Smoke: Beschreibung sichtbar/aktualisiert, Auswahl übersteht Reload.

- **Phase 4 (Einstellungen — Grundgerüst + Sound) — erledigt.** Zwei neue
  Bausteine: die Settings als wiederverwendbare Komponente und ein **echtes
  Pause-Overlay** (bisher nur Canvas-Text + Tastatur-R/M).
  - **`src/ui/settings.js`** (neu, `createSettings`): verdrahtet den INHALT des
    `#settings`-Overlays an EINER Stelle (Sound Gesamt/Musik/Effekte,
    Eingabeprofil, Vollbild, Reset, Beenden) — derselbe Screen dient Haupt-
    UND Pause-Menü. **Der `from`-Zurückpfad kommt aus dem Menü-Stack**
    (`menu.show('settings')` → `menu.back()` landet automatisch beim
    Aufrufer), **kein manueller `from`-Parameter** — kann per Konstruktion
    nicht auseinanderlaufen (das ist die Ist-Abgleich-Abweichung zum Plan).
  - **`src/core/audio.js`**: Master/**Musik**/**SFX** getrennt. Zwei neue
    Zwischen-Gains (`musicGain`/`sfxGain`) unter dem `master`; Musik läuft
    über `musicGain`, alle `play()`-Ereignisse über `sfxGain`. Neue Setter
    `setMusicVolume`/`setSfxVolume` (+ Getter), getrennt auf 0 setzbar.
    `#settings` hat drei Regler (`#volMaster`/`#volMusic`/`#volSfx`,
    10%-Schritte), sofort persistiert (`volume`/`musicVolume`/`sfxVolume`).
  - **Pause-Overlay** (`#pauseMenu`): ein **Screen der Menü-Maschine**
    (Phase 1) — `openPause()` = `pause.set(true)` + `menu.root('pause')`,
    `resumeGame()` = `pause.set(false)` + `menu.hideAll()`. Knöpfe:
    Fortsetzen, Einstellungen (`menu.show('settings')` → Zurück führt zur
    **Pause**, nicht ins Hauptmenü — der `from:'pause'`-Pfad), Neustart,
    Hauptmenü. `update()` friert das Spiel ein, solange `menu.current()` in
    einem Run gesetzt ist; ESC/B an der Pause-Wurzel setzt fort, sonst einen
    Screen zurück. `popstate` im Run: Pause offen → fortsetzen, Einstellungen
    → zur Pause, sonst Pause öffnen. `launchRun` pusht einen Ersatz-Eintrag,
    damit die Zurück-Geste im Spiel einen `popstate` auslöst statt die Seite
    zu verlassen.
  - **Tests:** `regression.mjs` 8h (Musik/SFX getrennt, Gegenprobe rot
    bestätigt), 8k(g) (from-Zurückpfad via Stack: Pause→Einstellungen→Zurück
    landet bei Pause, aus dem Hauptmenü bei Hauptmenü). Browser-Smoke:
    Pause-Overlay, Einstellungen-aus-Pause → Zurück zur Pause, Musik auf 0
    persistiert, Browser-Zurück/Fortsetzen schließen die Pause.

- **Phase 5 (Einstellungen — Steuerung) — erledigt, Sensitivität auf
  Nutzerwunsch gestrichen.** Ist-Abgleich: der Turm zielt bei JEDEM Gerät
  **instant** (`state.js: p.turret = atan2(cmd.aim.y - p.y, cmd.aim.x - p.x)`,
  kein Turn-Speed-Wert im Code). Ein „spürbarer" Sensitivitäts-Regler hätte
  also eine komplett neue Dreh-Geschwindigkeitsbegrenzung gebraucht (Risiko:
  ändert das Kernzielgefühl für Maus/Stick/Gamepad gleichermaßen, berührt
  Ziellinie/Bankshot-Solver/Bosskämpfe). **Auf Nutzerentscheidung ersatzlos
  gestrichen** — dasselbe Muster wie `PLAN-INPUT.md` P5 (Schild). Phase 5
  bleibt bei der **Verifikation der bestehenden Profil-Wahl** (aus P1/P9,
  seit Phase 4 in `settings.js`) — die war bisher ungetestet:
  - **`setProfile()` überschreibt die Geräte-Auto-Erkennung dauerhaft**:
    `markSource(s)` schreibt `source` nur, wenn `manualProfile` NICHT gesetzt
    ist — eine Tastatur-/Touch-/Gamepad-Eingabe kann die erzwungene Quelle
    also nicht zurücksetzen. `setProfile(null)` stellt die Auto-Erkennung
    wieder her.
  - **`getMenuState()` ignoriert den Override bewusst** (liest Tastatur/
    Gamepad immer direkt) — ein erzwungenes „touch"-Profil auf einem
    Desktop ohne Touchscreen sperrt dadurch NICHT die Tastatur-Menünavigation
    (Testschritt 5).
  - **Tests:** `regression.mjs` Abschnitt 8n — Auto-Erkennung, dauerhafter
    Override, Reset auf `null`, Menü-Unabhängigkeit vom Override. Beide
    Gegenproben rot bestätigt (Override-Schutz ausgehebelt →
    „nicht dauerhaft"-Check rot; `getMenuState()` künstlich vom Profil
    abhängig gemacht → Menü-Check rot). Browser-Smoke (im echten Run):
    `touch-on`-Klasse erscheint bei erzwungenem „touch", Wahl übersteht
    Zurück/Reload, Menü bleibt danach bedienbar.
  - Keine Code-Änderung an Kern-Mechaniken, kein Service-Worker-Bump nötig
    (nur Tests + Doku).

- **Phase 6 (Einstellungen — Grafik & Fortschritt zurücksetzen) —
  erledigt.** Ist-Abgleich vor dem Bau ergab eine echte Determinismus-Falle:
  `state.js: spawnParticles()` verbraucht `state.rng()` — **denselben Strom
  wie KI-Entscheidungen** (`ai_drives.js: orbitDir`). Ein Performance-Modus,
  der die SPAWN-Anzahl ändert, würde den RNG-Verbrauch verschieben und Seeds
  geräteabhängig machen. Deshalb bewusst **rein render-seitig** gelöst:
  - **`effects.js: drawParticles(ctx, state, drawFraction)`** lässt nur die
    Zeichenschleife einen Teil der Partikel auslassen (`i % step !== 0`) —
    `state.particles` und der RNG-Verbrauch in `spawnParticles()` bleiben
    **komplett unangetastet**. `renderOpts` wird bewusst NICHT in `effects.js`
    importiert (zirkulärer Import, wie schon bei `drawGhosts`/Phase 7) —
    `renderer.js` reicht `renderOpts.particleDrawFraction` als Parameter durch.
  - **Struktur-Wächter** in der Suite: keine Datei in `src/game/*.js` darf
    `renderOpts` referenzieren (Gegenprobe bestanden: `state.js` künstlich
    verseucht → Test rot).
  - **`data/options.json: performance.particleDrawFraction`** (0,3) als
    Standardwert für den Modus, in `settings.js` gegen `getPref
    ('performanceMode')` verdrahtet (Checkbox „Performance-Modus").
  - **„Fortschritt zurücksetzen" zweistufig**: erster Klick zeigt nur die
    Bestätigungszeile (`#resetConfirm`), nichts wird gelöscht; erst „Ja, alles
    löschen" wirkt. Eigener Haken „auch Einstellungen zurücksetzen"
    (`src/core/storage.js: resetAllPrefs()`, neu) — optional, Default aus.
    Löscht immer Bestwerte + einen gespeicherten Zwischenstand
    (`clearCurrentRun`), lädt danach per `location.reload()` neu (Testschritt
    5: „lädt fehlerfrei mit frischem Save"). **Codex/Freischaltungen** aus
    der Plan-Formulierung existieren noch nicht (kommen erst Phase 7) — bis
    dahin ist „Fortschritt" faktisch die Bestwerte-Statistik.
  - **Echter CSS-Bug beim Testen gefunden** (kein Testartefakt): dieses
    Projekt hat **keine generische `.hidden`-Regel**, nur elementspezifische
    Kombinationen (`.overlay.hidden`, `#resumeBtn.hidden`, …). Ohne eigene
    `#resetBtn.hidden`/`.resetconfirm.hidden`-Regeln hätte `classList.add
    ('hidden')` keinerlei optische Wirkung gehabt — `#resetConfirm` wäre von
    Anfang an sichtbar gewesen. Per Playwright-Smoke gefunden, in `style.css`
    behoben.
  - **Testschritt 2 ehrlich gemessen, nicht behauptet**: bei der
    realistischen Kappung (300 Partikel, `limits.json`) liegt der reine
    Zeichenaufwand unter der Messschwelle (~0,1–0,2 ms; `fillRect` ist billig,
    deckt sich mit den Phase-11b-Messungen: schlimmster Logikschritt ~1–3 ms
    von 16,7 ms Budget). Bei 10× der Kappung zeigt sich der Mechanismus klar
    (13,8 ms → 0,4 ms, 97 % Ersparnis, Playwright-Diagnose) — der Hebel
    funktioniert nachweislich, ist im normalen Spiel aber ein kleiner, kein
    dramatischer Spareffekt. Keine flaky Timing-Assertion in die Suite
    aufgenommen (Muster: die deterministische `drawFraction`-Prüfung bewacht
    den Mechanismus zuverlässiger als eine Zeitmessung nahe der
    Timer-Auflösung).
  - **Tests:** `regression.mjs` Abschnitte 8o (drawFraction mit eigenen
    Partikelzahlen + Struktur-Wächter) und 8p (`resetAllPrefs`, löscht
    Prefs, lässt Flags unangetastet). Drei Gegenproben rot bestätigt.
    Browser-Smoke: Standard aus/persistiert/übersteht Reload, zweistufiger
    Reset (Abbrechen vs. bestätigen), Bestätigungsdialog passt auf kleine
    Viewports.

### Offene Punkte / To-do (nice-to-have, nicht dringend)
- [ ] **PLAN-STARTMENU nächste Phase:** Phase 7 (Codex — Grundgerüst &
      Datenstruktur: Save-`version`-Feld, Migrationsfunktion, gebündeltes
      Schreiben `markSeen()`/`flushCodex()`, Codex-Hauptscreen mit den vier
      in Phase 0 festgelegten Kategorien, `codexRevealAll`-Debug-Flag).
- [ ] **Klassen scharfschalten (nach PLAN-STARTMENU):** aktuell alle
      `unlocked: true`. Freischaltbedingungen definieren + `seen`/Codex in
      Phase 7 anbinden.
- [ ] **Controller-Feinschliff (optional)**: (1) Bomben-/Gadget-**Wurf** nutzt
      auf dem Gamepad nur die Turmrichtung (`secondaryAim`/`gadgetAim` werden in
      `profileGamepad` nicht gesetzt) — Richtung stimmt, aber die Wurfweite lässt
      sich nicht wie am Handy dosieren. (2) Der A-Knopf legt im Spiel zusätzlich
      eine Bombe (`secondaryAlt`), obwohl die Doktrin dafür LT vorsieht — bei
      Bedarf entkoppeln. Beides ist Komfort, kein „reagiert nicht"-Blocker.
- [ ] **Bankshot-Faktor (UMBAUPLAN-LP „Was dieser Umbau nicht löst")**: auf
      Nutzerwunsch von 2,0 auf **2,5** angehoben (`balance.json:
      bullet.wallBounceDamageMult`) — der freiwillige Bankshot fühlte sich zu
      flach an. Nächster Schritt laut Plan wäre **3,0**, falls 2,5 immer noch zu
      schwach wirkt (reine Datenänderung; die Regressionstests lesen den Faktor
      dynamisch, kein Testumbau nötig).
- [ ] **Nachzuholen (aufgeschoben, blockiert nichts)**: 15–20 Runs spielen
      und die Debug-Ansicht (`?debug=1`) auswerten — sie rechnet selbst
      (Median-Todesraum, Abpraller-Anteil, minFps, nie gewählte +
      meistabgelehnte Karten). Die Wellen 2 und 3 wurden mangels Daten per
      Pool-Analyse geplant; die Auswertung wird danach eine reine
      Balance-Anpassung an fertigen Karten (`data/upgrades.json`). Siehe
      `PLAN.md`, Phase 18.
- [ ] Sprite-Look für **feste Wand** (`tile_wall`) und **Loch** (`tile_hole`)
      im Spiel noch mit eigenem Auge prüfen — Code-Pfad identisch zu
      breakable (das rendert korrekt), aber nicht separat verifiziert.
- [ ] Geschoss-Sprites wirken recht hell/groß (weißer Glow-Blob). Ggf. Größe
      (`3.6 * b.radius` in `renderer.js`) oder Glow-Matte reduzieren.
- [ ] Noch **prozedural** (keine Sprites vorhanden): Minen, Fallen,
      Explosionen/Partikel, Sekundärwaffen-Overlays (Phase 6: Sperrmauer,
      Rauchwolke, Enterhaken-Linie, Deflektor-/EMP-Ringe). Bei Bedarf
      Grafiken liefern.

Wenn ein Punkt erledigt ist: Haken setzen bzw. Zeile entfernen.

## Tech / Architektur
- **ES-Module**, kein Bundler. Einstieg `src/main.js`, verdrahtet alles.
- **Fixed-Timestep-Loop** 60 Hz mit Akkumulator + Render-Interpolation (`alpha`).
  `src/core/loop.js`.
- **Deterministisch**: gesäter RNG (Mulberry32, `src/core/rng.js`). Kein
  laufender Zustand — pro Raum benannte Ströme aus `hash(seed, roomIndex,
  label)` (`rooms`/`enemies`/`upgrades`/`scrap`/`doors`/`events`/`modifiers`
  + `ai`). Gleicher Seed + Raumnummer → gleicher Raum, unabhängig vom
  Spielverlauf.
- **Datengetrieben**: ALLE Balance-Werte in `data/*.json`
  (`tanks.json`, `upgrades.json`, `tiles.json`, `difficulty.json`,
  `balance.json`, `events.json`, `input.json`, `options.json`, `arenas.json`,
  `transformations.json`, `secondaries.json`, `modifiers.json`,
  `limits.json`, `sounds.json`, `status.json`).
  `balance.json` enthält auch Rarity-Gewichte,
  `legendary.minRoom` + die `scrap`-Werte; `difficulty.json` die `doors`/
  `elite`/`treasure`-Konfiguration (Phase 4).
  `data/events.json` wird in `main.js` an `tanksData.events` gehängt.
  `src/game/cfg.js` löst Typen auf und wendet Upgrades an.
  `data/balance.json` wird in `main.js` an `tanksData.balance` gehängt und
  ist so über `state.data.balance` überall verfügbar.
- **Kollision**: Kreis-vs-AABB mit Gleiten; Panzer blockt Panzer; Abpraller-
  Physik mit Eckenfall (`src/game/bullet.js`, `collision.js`).
- **Dateien möglichst < ~300 Zeilen** halten (bei Bedarf aufsplitten, wie
  `effects.js`/`cfg.js`).

### Wichtige Dateien
- `src/ui/menu.js` — Screen-State-Machine der Menü-Overlays (PLAN-STARTMENU
  Phase 1): `createMenu` mit Zurück-Stack + Browser-History. Vorwärts pusht,
  jede Rückwärtsnavigation läuft über `history.back()` → `popstate` →
  `onPopState()`. Screens: `main`/`settings`/`class`/`pause`. Die In-Run-
  Overlays (Upgrade/Karte/Shop/Event/Vorschau) laufen bewusst NICHT hierüber
  (eigener `runOverlayNav` an `run.phase`).
- `src/ui/settings.js` — wiederverwendbarer Einstellungs-Inhalt (Phase 4):
  `createSettings` verdrahtet Sound (Master/Musik/SFX), Eingabeprofil,
  Vollbild, Reset, Beenden. Der `from`-Zurückpfad kommt aus dem Menü-Stack,
  nicht aus einem Parameter.
- `src/game/classes.js` — spielbare Klassen (PLAN-STARTMENU Phase 2):
  `playerClassEntries`, `isClassUnlocked` (Freischaltung + `unlockAll`),
  `createClassButton` (testbare Knopf-Erzeugung).
- `src/core/debug.js` — Debug-Flags aus der URL (`?debug=1` + `skipToRun`/
  `unlockAll`/`codexRevealAll`), eingefroren in `DEBUG`.
- `src/game/state.js` — `stepState`, Treffer, Minen, `killTank`.
- `src/game/armor.js` — gerichtete Panzerung (Phase 4): `armorBlocks`,
  `reflectBullet`, `hasWallBounced`, `isLive`.
- `src/game/tank.js` — Feuern, Minen legen/werfen, `useSecondary()`
  (Phase 6: generischer Sekundärwaffen-Dispatch inkl. Enterhaken/Sperrmauer).
- `src/game/damagetypes.js` — Schadenstypen (Phase 6): `applyTypeEffects`
  (Statusauftrag + Blitzkette), `statusOf`, `typeColor`. Die damageType-ids
  sind absichtlich identisch mit den Statuseffekt-ids, deshalb ohne
  Zuordnungstabelle. Werte in `data/status.json: damageTypes`.
- `src/game/status.js` — Statuseffekte ueber Zeit (UMBAUPLAN-LP Phase 5):
  `applyStatus`, `updateStatus`, `statusSpeedMult`, `visibleStatus`. Ticks
  werden gezaehlt, nicht heruntergezaehlt (bildratenunabhaengig). Werte in
  `data/status.json`. Haengt bis Phase 6 an keiner Quelle — nur
  `state.applyStatus()` (Debugtasten 1/2/3 bei `?debug=1`).
- `src/game/ghost.js` — Geisterpanzer (Phase 7): `createGhost`,
  `updateGhosts` (eigenes `state.ghosts`-Array, kein Eintrag in `state.tanks`).
- `src/game/bossai.js` — Boss-Sonderbewegungen (Phase 14): `stepMirrorBoss`
  (Punktspiegelung der Spielerposition), `stepPhalanxBoss` (rotierende
  5er-Formation); bypassen `DRIVES`/`updateEnemy()`, Turm/Feuern bleibt
  die normale `roleTurret()`-Logik.
- `src/game/cfg.js` — Panzer-cfg + alle ~39 Upgrade-Effekte.
- `src/game/upgradepool.js` — Auswahl-Pool (Tag-Regel, Rarity, maxStacks,
  requires, minRoom; Phase 4: includeTag/onlyRarity/bypassRoomGate/
  ignoreTagRule für Elite-/Treasure-Belohnungen); von `run.js` genutzt.
- `src/ui/roomscreens.js` — Event- und Shop-Overlay (`createShopScreen`,
  Phase 13: Kartenregal, Schild, Sekundärtausch, Leben, Ablegen).
- `src/ui/mapscreen.js` — Kartenscreen (Phase 12): zeigt den ganzen
  Kartengraphen, klickbar nur die von der aktuellen Position erreichbaren
  Knoten der nächsten Reihe.
- `src/render/renderer.js` — zeichnet alles (interpoliert). Nutzt Sprites,
  fällt auf prozedurale Formen zurück, falls Grafik fehlt/lädt.
- `src/render/sprites.js` — lädt die PNG-Sprites (async, mit Fallback).
- `src/ui/touchcontrols.js` — Touch: schwebende Twin-Sticks (DOM) + Minen-
  **Wurfstick** (Pointer Events + `setPointerCapture`).
- `src/core/viewport.js` — Canvasgröße/Auflösung (P2): Backing-Store an
  `devicePixelRatio` (gedeckelt über `options.json: maxPixelRatio`),
  `visualViewport` → CSS-Variablen `--vvh`/`--vvw`. Setzt bewusst KEINE
  CSS-Maße am Canvas (das würde `aspect-ratio` außer Kraft setzen).
- `src/core/audio.js` — prozedurale Synthese (Phase 7b): kennt nur noch
  Oszillator/Rauschen/Filter/Panner, ALLE Werte kommen aus
  `data/sounds.json`. `play(name, x)` — `x` optional, platziert den Ton im
  Stereobild.
- `src/core/telemetry.js` — Run-Telemetrie in `localStorage.runs` +
  Debug-Ansicht. **Die Aufzeichnung läuft IMMER**, `?debug=1` blendet nur
  die Ansicht ein (dort eingeklappt, aufklappbar). Reine Beobachtung,
  keine Spiellogik.
- `sw.js` — Service Worker (Offline-fähig). **Strategie: network-first für
  Code+Daten (HTML/JS/JSON), cache-first für Bilder/Fonts.** Cache-Version
  bumpen + `data/*`/`src/*` in `ASSETS` eintragen! (Aktuell `v107`; dabei
  auch `telemetry.js: GAME_VERSION` mitziehen.) So
  erscheinen Updates sofort beim Neuladen (online holt eine Seite ALLE
  Code-/Datendateien frisch → konsistent, nie alter Code + neue `data/*.json`
  → kein „+1 Leben"-Bug), offline läuft alles aus dem Cache. `skipWaiting()`
  JA (aktiviert beim Neuladen), `clients.claim()` NEIN (übernimmt die
  laufende Seite nicht mitten im Start → kein Skew). Alte Caches bleiben eine
  Version erhalten (`PREV_CACHE`). **Wechsel des SW selbst greift erst nach
  einmaligem vollständigem App-Neustart** (der bisher aktive `no-skip`-SW
  gibt erst dann ab); danach reichen normale Reloads.

## Grafik / Sprites
- Panzer je Typ: `assets/sprites/body_<typ>.png` (Front zeigt nach oben →
  Rotation `heading + PI/2`) + `turret_<typ>.png` (Rohr zeigt nach rechts =
  Winkel 0, Dom-Pivot zentriert → Rotation `turret`).
- Kacheln `tile_{floor,wall,breakable,hole}.png`, Geschosse
  `bullet_{normal,rocket,bounce,tungsten,explosive}.png`.
- Typen: `player`, `t_brown`, `t_grey`, `t_teal`, `t_yellow`, `t_pink`,
  `t_green`, `t_purple`, `t_white`, `t_black`. `t_armored` und `t_prism`
  haben **keine eigenen Sprites** — `sprites.js` mappt sie über
  `SPRITE_ALIAS` auf `t_grey`/`t_teal`; ihre Identität ist das
  Panzerungs-Overlay.
- Spieler-Glow, Schild-Ring, Ziellinie, Betäubungs-Ring und die
  Unsichtbarkeit des Weißen sind Renderer-Overlays (nicht im Sprite).

## Mobile / PWA
- PWA (`manifest.json`), Vollbild im Querformat: `100dvh` + `viewport-fit=cover`,
  Canvas füllt die Höhe, schwarze Flanken links/rechts für Sticks/Buttons.
- Portrait → pausiert; zurück ins Querformat → automatisch fortsetzen.
- iOS: echtes Element-Vollbild nicht unterstützt → „Zum Startbildschirm
  hinzufügen" für randlos. Android: `requestFullscreen`.

## Lokal testen
```
python3 -m http.server 8099        # dann http://localhost:8099/index.html
node --check src/<datei>.js         # Syntax
node tests/regression.mjs           # Regressionssuite (eingecheckt!)
node tests/gamepad.mjs              # Controller-Eingabe (dependency-frei, gestubbtes Gamepad)
node tests/uilayout.mjs             # Overlay-Layout (braucht Playwright)
node tests/viewport.mjs             # DPR/Viewport + Zielkoordinaten (Playwright, braucht eigenen Server auf :8099)
node tests/fogperf.mjs              # Additive Lichtmaske: Korrektheit + Renderzeit (Playwright, P11)
```
Playwright-Browser liegt unter `/opt/pw-browsers/chromium`
(`executablePath` setzen; NICHT `playwright install`).
Regressions-Standard: `tests/regression.mjs` muss grün sein (~1 s). Enthält:
5 Seeds über 16 Räume deterministisch bis zum Sieg, Ziellinien-Trace
crashfrei, Wellen-Freigabe-Guard, Determinismus-Probe, Sound-Namen gegen
`sounds.json`, Transformationen freischaltbar, jede Karte ziehbar,
Effekt-Renderpfad mit Fake-Canvas, **Overlay- und Touch-Verhalten mit
`tests/domstub.mjs`** (inkl. Wurfstick/`pointercancel`, P3) sowie die
LP-Umbau-Abschnitte 9–36 (Schadensmodell, LP, Statuseffekte, Schadenstypen,
Krit, Phase-8-Prisma/Schild, Phase-9-Klassen, Phase-10-Kernpool +
Verteilungs-Fix, Phase-11-Physisch-Topf + Element-Filter,
Phase-18–27-Signaturtöpfe (alle zehn Klassen) + `signatureClass`-Filter,
Phase-28-Schlussabnahme (gezogene Verteilung über den echten Pool, keine leere
Seltenheitsstufe, Raumdauer als HP/DPS-Schranke)). Die frühere
USP-Bankshot-Quote ist mit Phase 8 entfallen.
