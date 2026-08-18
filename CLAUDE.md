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
**Neu eingegangen: „Upgrade-/Klassenpool-System v2 + Nekromant"** (eigener
Auftrag mit Anhang A: Upgrade-/Klassenpool-Spec, Anhang B: Geisterpanzer-Spec).
Ersetzt `UMBAUPLAN-LP.md` Phase 9 (Nekromanten-Passiv `reviveChance`), Phase 26
(Signaturtopf Nekromant) und `PLAN.md` Phase 7 (Geisterpanzer als 3-Sekunden-
Verbündeter) vollständig. Neun Phasen, eine pro Sitzung, Phase 0 (Ist-Abgleich)
und **Phase 1 (Seltenheiten 3→5) sind gebaut** — Details im eigenen Abschnitt
unten. **Phase 2 (Kategorie + Synergie-Tags) ist gebaut** — der in Phase 0
gefundene Blocker (Signaturkarten blockierten sich gegenseitig über den
gemeinsamen Tag `signature`) ist aufgelöst, ein Angebot mit drei
Signaturkarten derselben Klasse ist jetzt möglich. **Phase 3
(Synergiegewichtung) ist gebaut** — Karten mit passenden `tags[]` werden
anhand der bereits gewählten Karten höher gewichtet, gedeckelt, ohne je eine
Karte auszuschließen. **Phase 4 (Altes Geistersystem und `reviveChance`
abbauen) ist gebaut** — die `ghost_crew`-Karte, `cfg.ghostCrew`/
`grantGhostCrew`/`ghostDurationBonus`, `state.js: tryRevive()` und das
Nekromant-Passiv `reviveChance` sind vollständig entfernt; `src/game/ghost.js`
bleibt als vorerst unbenutztes Modul stehen (Neubau folgt in Phase 6/7).
**Phase 5 (Zielsystem der Gegner-KI) ist gebaut** — Gegner werten jetzt
periodisch aus, wen sie angreifen (Spieler oder ein Geist), statt hart auf
`state.player` zu zielen; Details im eigenen Abschnitt unten. **Phase 6
(Nekromant: Klassenidentität) ist gebaut** — die Geistermechanik ist ab
Klassenwahl aktiv (Spawnchance beim Kill, Geisterbombe statt Minenslot,
Kill-Zuordnung über `meta.killer`); Details im eigenen Abschnitt unten.
**Phase 7 (Geisterpanzer neu bauen) ist gebaut** — `src/game/ghost.js` ist
komplett ersetzt: ein eigener, fester Basiseinheiten-Typ `ghost_tank` statt
der geerbten cfg des getöteten Panzers; Details im eigenen Abschnitt unten.
**Phase 8 (Signaturpool Nekromant) ist gebaut** — die zwölf alten
`sig_necro_*`-Karten sind durch den 18-Karten-Pool aus Anhang A ersetzt, neue
`ghost*`-`core`-Schlüssel wirken auf die Geistereinheit statt auf den Spieler;
Details im eigenen Abschnitt unten. **Phase 9 (Abnahme) ist gebaut** — die
Schlussabnahme mit dem Bosskampf-Korridor (Geister ziehen 40 % der
Bossschüsse, der Spieler bleibt bei 60 %), den Pipeline-Invarianten und dem
`sw.js`-Bump auf `v111`. **Damit ist der komplette Auftrag
„Upgrade-/Klassenpool-System v2 + Nekromant" (Phasen 0–9) abgearbeitet.**
Verbleibend sonst nur noch manuelle/optionale Punkte (s. To-do-Liste unten):
der Bankshot-Faktor-Kalttest (2,0 → ggf. 2,5/3,0, nur nach echtem
Spielgefühl) und die Telemetrie-Auswertung echter Runs.
**Nutzerwunsch danach: Nekromant-Feinschliff** (eigener Abschnitt unten) —
Geisterbombe hat jetzt eine 10-s-Abklingzeit, der Gadget-Slot ist für den
Nekromanten komplett entfernt (Karten UND Shop-Kauf gesperrt).
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

### Controller: Overlay-Navigation + Bomben-Zielwurf (Nutzer-Meldung) — gebaut
Drei Beschwerden, alle behoben:
- **Upgrade-Screen: „nur den Reroll ansteuerbar, keine Karte".** Die Upgrade-
  und Shop-Karten sind **klickbare DIVs, keine `<button>`** (der Verbannen-
  Knopf liegt im Kartendiv — Button-in-Button wäre ungültiges HTML), fielen
  also aus der Fokusliste des `runOverlayNav` (`main.js`, Query war
  `button, input`). Fix: pickbare Karten bekommen `data-navcard="1"` +
  `tabindex=0` (`upgradescreen.js`, `roomscreens.js` — im Shop nur die
  wirklich kaufbaren, nicht verkaufte/zu teure), die Query ist
  `button, input, [data-navcard="1"]`. A bestätigt die fokussierte Karte
  (`menunav.activate()` → `el.click()` auf dem DIV) — das lief schon vorher
  über `menuConfirm`.
- **Karten/Kartenknoten liegen nebeneinander, sollen mit LINKS/RECHTS
  anwählbar sein, nicht nur hoch/runter.** `menunav.js` bekam eine Option
  `{ bothAxes: true }`, die `runOverlayNav` setzt: dort traversiert die
  X-Achse die (flache) Fokusliste genau wie die Y-Achse. Die Start-/
  Einstellungs-/Klassenseiten bleiben beim reinen Y-Durchlauf (X nur für den
  Lautstärkeregler), weil in den In-Run-Overlays kein Regler sitzt, mit dem
  sich X beißen könnte. Der Kartenscreen (`mapscreen.js`) ist unverändert —
  seine erreichbaren Knoten liegen ohnehin in einer Reihe, jetzt per
  Links/Rechts erreichbar.
- **Bombe „wird nur unter den Panzer gelegt, kein Radius/Richtung wählbar".**
  Auf dem Gamepad setzte `profileGamepad` **keine** `secondaryAim` — beim
  Loslassen von LT fehlte die Zielvorgabe, `layMine()` warf in Turmrichtung
  die kurze Standardweite (`mine.throwPx` 58). Jetzt: **LT halten zielt mit
  dem rechten Stick** (Richtung + Weite bis `input.json: aim.throwMaxPx` 114,
  genau wie der Handy-Wurfstick `MINE_MAX_THROW`), **Loslassen wirft dorthin.**
  Umsetzung in `input.js`: `padThrowAim(gp)` (Stickausschlag → `{angle, dist}`),
  gemerkt in `padSecondaryAim`/`padGadgetAim` — die Zielvorgabe muss über
  Frames gehalten werden, weil `secondaryHeld` auf der **fallenden Flanke**
  (dem Wurf-Frame) schon `false` ist. Dieselbe Mechanik für den Gadgetslot
  (RB): EMP-Wurf/Haken zielen jetzt ebenfalls über den rechten Stick.
  `getMinePreview()`/`getGadgetPreview()`/`isGadgetAiming()` liefern die
  Controller-Zielvorgabe für die **Live-Vorschau** (Wurflinie + Explosions-
  radius wie am Handy). Der A-Knopf (`secondaryAlt`) bleibt als Sofort-Ablage
  ohne Zielen erhalten (rückwärtskompatibel, siehe To-do).
- **Tests, jeweils mit bestandener Gegenprobe**: `tests/gamepad.mjs`
  (LT+Stick → Zielvorgabe/Vorschau, halber Ausschlag = halbe Weite, Wurf
  übernimmt die gemerkte Vorgabe, LT ohne Stick = kein Zielwurf) und
  `tests/regression.mjs` Abschnitt 8i-2 (Karten in der Fokusliste,
  bothAxes-Traversierung mit X, A wählt die Karte; Gegenprobe: ohne
  `data-navcard` 0 Karten, ohne bothAxes kein X-Durchlauf).

### Controller: freier Maus-Cursor + Bomben-Sichtlinie (Nutzer-Meldung) — gebaut
Nachfassung, weil die diskrete Fokus-Navigation den Nutzer nicht überzeugte
(„kann die einzelnen Upgrades immer noch nicht auswählen, nur den Reroll").
Statt weiter an der Fokusliste zu drehen, **ein freier Maus-Cursor** — das war
der ausdrückliche Wunsch („linker Stick als Maus, damit rumfahren wie ich
möchte") und löst das „Controller erreicht Element X nicht" universell.
- **`main.js: gamepadCursor(menuState, dt)`** + `#gpCursor`-DOM-Element
  (`style.css`): sobald der Controller die **Quelle** ist (`input.getSource()
  === 'gamepad'`) und ein Menü/Overlay offen ist, fährt der **linke Stick**
  einen frei beweglichen Zeiger (`CURSOR_SPEED` 900 px/s) über den Bildschirm,
  **A klickt** das Element darunter. Umsetzung bewusst über
  `document.elementFromPoint(x, y)?.click()` — der Cursor ist
  `pointer-events: none`, trifft also das Element darunter, und `click()`
  bubbelt zum Handler (Karten-DIV **oder** Knopf **oder** Kartenknoten, egal
  wie das DOM aussieht). Damit ist die frühere DOM-Fummelei (`data-navcard`,
  `bothAxes`) für den Controller obsolet, bleibt aber für die **Tastatur**
  (Pfeiltasten + Enter) als diskrete `menunav`-Navigation erhalten.
- **Verdrahtung in `update()`**: in ALLEN Menü-Kontexten (Startbildschirm +
  In-Run-Overlays) läuft zuerst `gamepadCursor()`; gibt es `true` zurück
  (Controller aktiv), wird die diskrete `menunav` NICHT zusätzlich gefahren
  (sonst leuchten Cursor UND Fokusrahmen). Im Spiel (`playing`) fährt der linke
  Stick weiter den Panzer — der Cursor wird dort ausgeblendet.
- **`input.js: getMenuState()`** liefert jetzt zusätzlich `stick` (den ROHEN,
  analogen linken Stick) für die Cursorbewegung; `menuDir` bleibt die
  quantisierte Richtung für die Tastatur-Navigation.
- **Bomben-Sichtlinie** (Punkt 1 der Meldung): `profileGamepad` setzt
  `padSecondaryAim` jetzt **immer, solange LT gehalten wird** — ohne
  Stickausschlag `{angle:0, dist:0}` (am Panzer), genau wie der Handy-Wurfstick
  beim bloßen Antippen. So zeigt `drawMinePreview` sofort beim Halten eine
  Wurflinie + Explosionsradius (vorher erst beim Auslenken sichtbar), und ein
  LT-Tipp ohne Ziel legt die Bombe am Panzer ab (dist 0) statt 58 px voraus.
- **Tests (je mit Gegenprobe)**: `tests/gamepadcursor.mjs` (**neu**,
  Playwright, eigener Static-Server, injiziertes Standard-Gamepad) fährt den
  Cursor per Stick end-to-end auf den Startknopf und weist nach, dass **A einen
  echten Klick** auf das Element darunter auslöst; `tests/gamepad.mjs`
  (`getMenuState.stick` analog + deadzone, LT-ohne-Stick → Sichtlinie/Wurf am
  Panzer mit `dist 0`). Gegenproben bestätigt: Cursor deaktiviert →
  4 Cursor-Checks rot; `stick` entfernt → Analog-/Cursor-Checks rot;
  Vorschau-Fallback entfernt → Sichtlinie-Checks rot.

### Echte Hintergrundmusik als Loop (Nutzerwunsch) — gebaut
Der Nutzer hat eine eigene Musikaufnahme geliefert (`assets/audio/theme.mp3`,
~2:35 min) mit dem Auftrag, sie als Endlosschleife laufen zu lassen. Das ist
die **einzige Ausnahme** vom sonst durchgehaltenen Grundsatz „kein
Sound-Asset" (Phase 7b) — bewusst nur für die Hintergrundmusik, alle
Sound-**Effekte** bleiben prozedurale Synthese ohne Asset.
- **`data/sounds.json: music.track`** (`"assets/audio/theme.mp3"`) +
  `music.trackVol` (0.35, eigener Lautstärke-Faktor für die Aufnahme,
  unabhängig vom Lautstärkeregler/Mute — die wirken zusätzlich über den
  Master-Gain). Der bisherige prozedurale 16-Step-Loop (`bass`/`lead`/
  `stepS`) bleibt unverändert in derselben Datei stehen — nicht mehr als
  Standard, sondern als **Fallback**.
- **`audio.js: startMusic()`** laedt den Track einmalig per `fetch()` +
  `decodeAudioData()` und spielt ihn danach über einen
  `AudioBufferSourceNode` mit `loop: true` — echtes, klickfreies Loopen
  (kein Timer, der Steps aneinanderreiht). Eigener Gain-Knoten für
  `trackVol`, dahinter der bestehende Master-Gain (Mute/Lautstärkeregler
  wirken also unverändert). **Fallback bei Ladefehler ODER fehlendem
  `music.track`**: `startProceduralMusic()` (der alte Loop) springt ein,
  damit ein Netzfehler oder ein fehlendes Asset das Spiel nicht stumm lässt.
  `decodeAudioDataCompat()` deckt sowohl die promise- als auch die
  callback-basierte `decodeAudioData()`-Fassung ab (ältere Browser).
- **Idempotent gegen wiederholte Aufrufe**: `main.js` ruft `startMusic()` bei
  **jeder** ersten Eingabe-Geste erneut auf (`unlockAll()` hängt an
  `pointerdown`/`keydown`, ohne sich selbst abzumelden) — ein `musicSource`-
  Guard verhindert eine zweite, überlagerte Wiedergabe.
- **SW-Cache**: `assets/audio/theme.mp3` in `sw.js: ASSETS` (Offline-Cache
  beim ersten Besuch) + `isAsset()`-Regex um `mp3` erweitert (cache-first wie
  Sprites/Icons, nicht network-first wie Code/Daten — die Datei ändert sich
  nicht bei jedem Deploy).
- **Neuer Test `tests/music.mjs`** (dependency-frei, gestubbtes
  `AudioContext`+`fetch`): Track lädt → `AudioBufferSourceNode` mit
  `loop: true`, korrektem Buffer, `trackVol`-Gain, `start()` aufgerufen;
  zweiter `startMusic()`-Aufruf startet keine zweite Wiedergabe; Netz- oder
  Dekodierfehler → prozeduraler Fallback erklingt tatsächlich (kein stummes
  Spiel); ohne `music.track` sofort Fallback, ohne überhaupt zu fetchen.
  Gegenproben bestätigt: `loop` nicht gesetzt → Loop-Check rot;
  Fallback-Aufruf im `.catch()` entfernt → beide Fallback-Checks rot.
  Zusätzlich end-to-end im echten Browser (Playwright) gegengeprüft: Seite
  lädt, Nutzergeste löst `startMusic()` aus, `fetch()` + `decodeAudioData()`
  der echten Datei laufen ohne Konsolenfehler durch.

### Neue Klassen-/Geister-Sprites (Nutzergrafik) — gebaut
Der Nutzer hat fünf gerenderte Panzergrafiken geliefert (je Wanne links,
Turm rechts in einem Bild): **Eispanzer** (`c_frost`), **Feuerpanzer**
(`c_flame`), **Nekromantenpanzer** (`c_necro`), **Geisterpanzer** (für ALLE
Panzer, die zum Geist werden) und **Sprengpanzer** (`c_blast`).
- **Verarbeitung** (einmaliges Skript, nicht eingecheckt): jedes Kombibild in
  Wanne/Turm getrennt (Spalten-Deckungslücke), Hintergrund per **randver-
  bundenem Flood-Fill** (scipy `label` + `binary_fill_holes`) transparent
  gemacht — so bleiben innere dunkle Ketten (Feuer-Schwarzhintergrund) bzw.
  helle Frost-/Schädel-Flächen (Weiß-/Schachbrett-Hintergrund) erhalten,
  reines Schwellwert-Stanzen hätte sie zerstört. Turm auf 90°-Schritt gedreht,
  bis **das Rohr nach rechts** zeigt (Bestandskonvention), Pivot (=Bildmitte)
  auf das **Kuppelzentrum** gelegt (gewichteter Spalten-Schwerpunkt `cov²`
  unterdrückt das dünne Rohr), Wanne auf 110 px Höhe skaliert. Ergebnis
  visuell gegen die Bestandssprites geprüft.
- **`sprites.js`**: `c_frost`/`c_flame`/`c_necro`/`c_blast` + `ghost` in
  `TANK_TYPES` (werden jetzt geladen), ihre `SPRITE_ALIAS`-Einträge auf
  `player` entfernt. Die anderen fünf Klassen borgen sich weiter `player`.
- **`renderer.js: drawGhosts()`** zeichnet jetzt das gemeinsame
  `body_ghost`/`turret_ghost`-Sprite (Front `heading + PI/2`, Rohr `turret`,
  `globalAlpha 0.55`) statt der prozeduralen Wanne+Rohr-Form — mit Fallback
  auf die alte Form, falls das Sprite (noch) nicht geladen ist. Bewusst
  **nicht** an den Ursprungstyp gebunden: jeder Geist sieht gleich aus.
- SW-Cache `v106` (10 neue PNG in `ASSETS`), `telemetry.js: GAME_VERSION`
  mitgezogen. Regressionssuite grün (der Fake-Canvas-Renderpfad zeichnet die
  neuen Sprites headless mit).
- **Nachtrag (Loch = Turmdrehpunkt, `v107`):** die Kanone drehte anfangs um
  die Wannenmitte, nicht um das runde Loch (den Turmring) — das Loch liegt in
  diesen Grafiken ~5–6 px oberhalb der Wannenmitte. Der Renderer dreht Wanne
  UND Turm um denselben Punkt (x,y) = Bildmitte, deshalb müssen Loch (Wanne)
  und Kuppelzentrum (Turm) beide in der jeweiligen Bildmitte sitzen. Das
  Aufbereitungsskript erkennt jetzt das Loch (grösste dunkle, zentrale Fläche,
  Gleise am Rand ausgeschlossen) und zentriert die Wanne darauf; die vier
  Klassen-Bodies + `body_ghost` wurden neu erzeugt (Türme unverändert). Jetzt
  sitzt die Kanone im Loch und schwenkt darum wie bei einem echten Panzer.
- **Nachtrag (Gegner-Sprites, `v109`):** vier gelieferte Grafiken ersetzen die
  bisherigen Gegner-Sprites `t_black`/`t_yellow`/`t_green`/`t_brown` (gleiche
  Pipeline: Hintergrund-Flood-Fill, Turm rechts, Loch = Turmdrehpunkt). Ein
  fünftes rotes Sprite wurde auf Nutzerwunsch **weggelassen** (kein passender
  `t_red`-Typ). Nur Asset-Austausch, kein Code (`t_*` sind längst in
  `TANK_TYPES`).
- **Nachtrag (Gegner-Sprites Rest, `v110`):** fünf weitere Grafiken ersetzen
  `t_white`/`t_pink`/`t_purple`/`t_teal`/`t_grey` — **damit haben alle neun
  Gegnertypen ein eigenes Sprite** (`t_armored`/`t_prism` teilen sich weiter
  `t_grey`/`t_teal` über `SPRITE_ALIAS` + Panzerungs-Overlay). Der **weisse**
  Panzer stand auf weissem Grund → der randverbundene Flood-Fill hätte den
  fast weissen Body mitgefressen; deshalb pro-Sprite-Schwelle `LIGHT_THRESH`
  (nur Min-Kanal > 250 = Hintergrund, statt 200), sodass nur Reinweiss
  entfernt wird und `binary_fill_holes` die inneren weissen Glanzpunkte
  schliesst. Sonst gleiche Pipeline (Loch = Turmdrehpunkt).

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 0 (Ist-Abgleich, keine Codeänderung)
Bericht vor Phase 1 abgeliefert und vom Nutzer freigegeben. Kernbefunde: alle
neun im Auftrag genannten Ist-Annahmen bestätigt (`upgradepool.js` hat schon
`rarity`/`maxStacks`/`requires`/`minRoom`/`signatureClass`/`damageType`-Filter/
Bannliste/tier-normierte `weightedPick`/Fallback; 246 Karten, 79/96/71 nach
Rarity; `ghost.js` erbt `cfg` per Referenz mit 3-s-Timer; `c_necro.reviveChance`
einziger Nutzer ist `state.js: tryRevive()`; `killTank()` kennt keinen
Verursacher; 11 harte `state.player`-Fundstellen in der Gegner-KI; kein Boss
fährt auf ein Ziel zu). **Blocker bestätigt**: alle 84 Signaturkarten tragen
`tag: "signature"` — die „nie zwei gleiche Tags"-Regel lässt deshalb nur eine
Signaturkarte pro Angebot zu, Anhang A §19 verlangt aber drei gleichzeitig
(Auflösung in Phase 2 vorgesehen: Dedupe-Schlüssel für Signaturkarten auf `id`
statt `tag` umstellen). **Kill-Zuordnung** lässt sich ohne zweiten Todes-
Trichter lösen: die drei `applyDamage()`-Aufrufer außerhalb der Kugel-Treffer-
Schleife (`damagetypes.js` Kettenblitz, `mine.js` Explosion) kennen bereits die
verursachende Einheit, nur `status.js`s DOT-Tick kennt sie strukturell nicht
(dokumentierte Untererfassung für Phase 6, kein Umbau von `status.js`).
**Ergänzender Fund**: `bossai.js` setzt `tank.aimingAtPlayer = fire`
unabhängig vom tatsächlichen Ziel — der im Auftrag für Phase 5 verlangte
Lesbarkeits-Fix ist damit als echter Bug bestätigt, nicht nur vermutet.

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 1 (Seltenheiten 3→5) — gemergt
Fünf statt drei Seltenheitsstufen (`common`/`rare`/`epic`/`unique`/
`legendary`), reiner Struktur- und Einstufungsumbau ohne neue Mechanik.
- **`data/balance.json`**: `rarity` jetzt mit fünf Gewichten
  (`45/25/15/10/5`); das frühere einzelne `legendary.minRoom` ist durch
  `rarityGates: {epic:{minRoom:3}, unique:{minRoom:6}, legendary:{minRoom:9}}`
  ersetzt — common/rare haben weiterhin keinen globalen Deckel (nur das
  per-Karte `minRoom` zählt, das bei allen 246 Karten explizit gesetzt ist).
- **`upgradepool.js: buildCandidates()`** generalisiert: statt eines fest
  verdrahteten `rarity==='legendary'`-Sonderfalls liest sie jetzt
  `rarityGates[def.rarity]?.minRoom` für beliebig viele Stufen — `weightedPick`
  brauchte keine Änderung (war bereits generisch über `weights[d.rarity]`).
- **Alle 246 Bestandskarten neu eingestuft** — `common` (79) und `rare` (96)
  bleiben unverändert (ihre Definitionen entsprachen bereits §18: Statboost
  bzw. „erste Synergie"); die 71 bisherigen `legendary`-Karten sind nach dem
  Muster jedes Kartentopfs neu verteilt: Karten, die mehrere Mechaniken zu
  einer Endform kombinieren (durchweg die „Arsenal"-benannten Karten je Topf,
  plus `glaskanone`/`sig_std_gardist` u. Ä.) bleiben `legendary`; Karten, die
  EINE Mechanik extrem ausprägen oder eine neue Mechanik freischalten (z. B.
  `phys_railgun`, `core_dodge_l`, `schild`, `sig_ric_trickmeister`,
  `sig_ric_kettenbank`) wurden zu `unique`; reine „größere Zahl ohne neue
  Interaktion"-Karten (die neun `core_*_l`-Statkapstones, `turbo`,
  `ueberladung`, `uebermacht`, `sig_ric_querschlaeger`) wurden zu `epic` —
  exakt die im Auftrag
  zitierte CLAUDE.md-eigene Leitplanke „Bestehende Legendaries, die nur
  größere Zahlen liefern, gehören meist nach epic oder rare". Ergebnis:
  common 79 / rare 96 / epic 18 / unique 36 / legendary 17 (Summe weiterhin
  246). Vollständige Umstufungstabelle im PR-Diff (`data/upgrades.json`).
  **Eine Karte mit bestehendem `maxStacks: 2`** (`sig_std_alleskoenner`)
  wurde bewusst auf `epic` statt `unique`/`legendary` eingestuft, weil die
  neue Validierung `unique`/`legendary` auf `maxStacks: 1` zwingt — ein
  Umbau ihres Stapel-Designs war nicht verlangt.
- **`upgradescreen.js: RARITY`** und **`style.css`** (beide `[data-rarity]`-
  Blöcke, Karten UND Shopkarten) um zwei neue Stufen erweitert: `epic` lila
  (`#a35fd8`), `unique` orange mit leichtem Glow (`#d8763a`), `legendary`
  unverändert Gold+Glow.
- **`run.js`**: die Treasure-/Verflucht-Belohnung (`onlyRarity: 'legendary'`,
  `bypassRoomGate: true`) bleibt unverändert funktionsfähig — sie filtert
  direkt auf die Rarity-Zeichenkette, unabhängig von der Stufenzahl.
- **17 bestehende Pool-Struktur-Tests** (`tests/regression.mjs`, Abschnitte
  10, 11–16, 18–27) auf die neue 5-Werte-Verteilung je Topf umgestellt (z. B.
  Kernpool jetzt `10/10/9/1/0`, jeder Element-Topf `4/4/0/3/1`, die kleinen
  Signaturtöpfe `2/2/1/0/1` bzw. `2/2/0/1/1`, die vier Mechanikklassen-Töpfe
  `4/4/1/2/1`). Der Phase-10(b)-Mechanismustest liest jetzt eigene
  synthetische Gewichte (60/30/10) statt `tanksData.balance.rarity` — sonst
  wäre er an die aktuelle Datenlage gekoppelt (CLAUDE.md-Grundregel). Die
  beiden Phase-28-Tests (Abschnitt 36, echte Poolziehung + Leere-Stufen-Check)
  auf alle fünf Stufen erweitert.
- **Neuer Abschnitt 37** (`tests/regression.mjs`): (a) jede Karte hat eine
  gültige Rarity aus den fünf Stufen, jede `unique`/`legendary`-Karte hat
  `maxStacks: 1`; (b) der `rarityGates`-Mechanismus selbst, geprüft mit einer
  SYNTHETISCHEN Ein-Karten-Pool + Gate-Wert (5) statt der echten
  `balance.json`-Zahlen (3/6/9) — deterministisch über `count: 1`: vor dem
  Gate bleibt nur der Fallback übrig, ab dem Gate erscheint die echte Karte.
  Gegenprobe für alle drei Kernpunkte bestanden (je einzeln absichtlich rot
  gemacht: ungültige Rarity, `maxStacks: 2` bei einer `legendary`-Karte,
  Gate-Check stillgelegt) — dabei ein Fallstrick gefunden: `git checkout --`
  auf `data/upgrades.json` während einer Gegenprobe verwirft nicht nur die
  Testverfälschung, sondern auch die noch uncommittete Reklassifizierung
  selbst; ab der zweiten Gegenprobe stattdessen gezielt per Skript
  zurückgesetzt.
- Playwright-Smoke bestätigt: `rollOffers()` liefert im echten Browser ein
  Angebot mit einer `unique`-Karte, alle fünf `[data-rarity]`-Farben rendern
  unterscheidbar, keine Konsolenfehler.

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 2 (Kategorie + Synergie-Tags) — gemergt
Die zweite Achse eingezogen, ohne die bestehende Tag-Logik zu brechen. `tag`
bleibt die Hauptkategorie (`data/transformations.json`/`run.tagCounts` hängen
unverändert daran) — neu ist ein optionales `tags: []` für Synergie-Tags plus
die Auflösung des in Phase 0 gefundenen Blockers.
- **Der Blocker-Fix** (`upgradepool.js: dedupeKey()`): die Angebotsregel „nie
  zwei Karten mit demselben Tag" dedupt Signaturkarten (`signatureClass`
  gesetzt) jetzt auf ihre eigene `id` statt auf den gemeinsamen Tag
  `signature` — der `signatureClass`-Filter in `buildCandidates()` sorgt
  ohnehin schon dafür, dass in einem Angebot nur Signaturkarten EINER Klasse
  vorkommen können, dedupen auf `id` blockiert sie also nur noch gegen sich
  selbst (was der bestehende `pool.filter(id !== pick.id)`-Schritt ohnehin
  separat erledigt). Kernpool-Karten (kein `signatureClass`) dedupen
  weiterhin auf den Tag — die alte Regel bleibt dort unverändert bestehen.
  Playwright-Smoke bestätigt ein echtes Angebot mit **drei** Nekromant-
  Signaturkarten gleichzeitig (`sig_necro_geisterlegion` +
  `sig_necro_totenbeschwoerung` + `sig_necro_seelenernte`) — genau der in
  Anhang A §19 geforderte Fall.
- **`tags: []`** (neues optionales Feld, Karten ohne `tags` verhalten sich
  exakt wie vorher): auf den fünf thematisch tragfähigen der zwölf aktuellen
  `sig_necro_*`-Karten gesetzt, mit den im Auftrag genannten Beispielwerten —
  `sig_necro_geisterbeschwoerung`/`sig_necro_geisterlegion` → `ghost`+`swarm`
  (`geisterlegion` zusätzlich `quantity`, exakt das Anhang-A-Beispiel),
  `sig_necro_wiedergaenger`/`sig_necro_lich`/`sig_necro_unsterblich` →
  `resurrection`. Die übrigen sieben (reine Stat-Kombis ohne Geist-/
  Wiederbelebungs-Mechanik) bleiben ohne `tags` — ein Synergie-Tag ohne
  mechanischen Bezug wäre nur Flavour und für die Gewichtung in Phase 3
  wertlos. Die zwölf `sig_necro_*`-Karten werden mit Phase 8 ohnehin komplett
  ersetzt; die neuen Karten dort bekommen ihre `tags[]` frisch nach demselben
  Schema.
- **Neue Struktur-Validierung** (`tests/regression.mjs`, Abschnitt 38):
  eindeutige ids (Objektschlüssel === `def.id`), gültige Kategorie (`tag` aus
  einer **fest definierten**, von den Daten unabhängigen Liste — sonst wäre
  der Test bei jedem neuen Tag automatisch grün und finge nie einen
  Tippfehler), `tags[]` ist ein Array aus Strings, `signatureClass` zeigt auf
  eine echte `player`-Klasse in `tanks.json`. Dazu ein DFS-Zyklendetektor für
  den `requires`-Graphen (ein Zyklus A→B→A wäre für beide Karten für immer
  unerreichbar). „`requires` zeigt auf existierende ids" war schon seit
  Phase-18-Welle-3 als Abschnitt 6b2 abgedeckt — nicht dupliziert.
- **Zehn bestehende Regressionstests korrigiert** (Phase-18–27-Abschnitte,
  Teil (d)/(e)): sie behaupteten bisher „höchstens eine Signaturkarte pro
  Angebot" — das war die alte, jetzt bewusst aufgehobene Regel. Umgestellt
  auf `maxProAngebot >= 2` (Stichprobe 500→3000 pro Klasse, damit die
  Zusicherung bei kleinen 6-Karten-Signaturtöpfen nicht zufällig unter der
  Nachweisschwelle bleibt).
- **Gegenprobe für jeden Kernpunkt bestanden**: unbekannte Kategorie,
  künstlicher `requires`-Zyklus (`doppelrohr`↔`feuerleitzentrale`
  temporär verdrahtet), `dedupeKey()` auf die alte Tag-Logik zurückgesetzt
  (lässt alle zehn Signaturtopf-Tests UND den neuen Mechanismus-Test in
  Abschnitt 38 rot werden), `dedupeKey()` auf reine `id`-Dedupe verschärft
  (lässt die Kernpool-Gegenstück-Prüfung in Abschnitt 38 rot werden — die
  alte Ein-Tag-Regel für Nicht-Signaturkarten bleibt bestehen).
- **Bewusst nicht angefasst** (nicht Teil der Phase-2-Dateiliste): `drawOne()`
  (Schrott-Aktionen „Verbannen"/„Vierte Karte" in `run.js`) baut sein
  `avoidTags` weiterhin rein aus `o.tag` der behaltenen Karten — ein Banning
  einer von mehreren gleichzeitig angebotenen Signaturkarten sperrt dadurch
  weiterhin den ganzen Tag `signature` für die Ersatzkarte, statt nur die
  gebannte id. Kleine Inkonsistenz zum neuen Verhalten der Erstauswahl, aber
  kein Blocker (Ersatzkarte kommt einfach aus einer anderen Kategorie) —
  bei Bedarf in einer späteren Aufräumrunde beheben.

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 3 (Synergiegewichtung) — gemergt
Angebote erkennen jetzt den begonnenen Build, ohne ihn zu erzwingen — die
zweite Hälfte von Anhang A §11.
- **`run.synergyTags`** (neu, analog `tagCounts`, aber über `tags[]` statt
  `tag`): laufende Bilanz der Synergie-Tags aller gewählten Karten, in
  `applyUpgradeChoice()` befüllt (derselbe gemeinsame Hook wie `tagCounts`/
  Transformationen), im `runSnapshot()` mitgeführt und beim Fortsetzen
  restauriert — eigenständig neben `tagCounts`, das weiterhin nur die
  Hauptkategorie für die Transformationen zählt.
- **`upgradepool.js: makeSynergyWeight()`**: eine Karte mit passenden `tags[]`
  bekommt einen Gewichtsfaktor `min(cap, 1 + Treffer × step)` — „Treffer"
  ist die Summe der `run.synergyTags`-Werte über alle `tags[]` der Karte.
  `cap`/`step` liegen in `data/balance.json: upgrades` (`synergyCap: 2.0`,
  `synergyStep: 0.5`) — bei 4 Treffern eines Tags ist der Faktor bereits
  gedeckelt (2×). Der Faktor ist immer ≥ 1, schließt also nie eine Karte aus.
- **Kein Eingriff in `weightedPick()` nötig**: Element- (Phase 17) und
  Synergiegewicht multiplizieren sich zu einem einzigen Faktor
  (`makeCombinedWeight()`), der wie zuvor nur `elementWeight` als vierten
  Parameter durchgereicht wird. Die Tier-Normierung (UMBAUPLAN-LP Phase 10)
  gilt dadurch automatisch auch für die Synergie — `weightedPick()` selbst
  weiß nichts von Synergie und musste nicht angefasst werden.
- **Determinismus unverändert**: weiterhin genau ein `rng()`-Aufruf je
  gezogener Karte (Testschritt, Gegenprobe mit einem absichtlich doppelten
  Aufruf bestanden).
- **Neue Dauertests** (Abschnitt 39, Gegenprobe für jeden Kernpunkt
  bestanden): Mechanismus (Synergiekarte ~2× häufiger bei 4 Treffern, echte
  `rollOffers()`-Pipeline statt einer isolierten Formel — der erste Entwurf
  von (c) prüfte nur eine selbstbestätigende Kontrollrechnung und hätte eine
  fehlende Kappung nie gefangen, jetzt end-to-end mit 1000 Treffern gegen-
  geprüft), keine Karte ausgeschlossen, Kappung, Tier-Normierung bleibt
  erhalten (deckte einen echten blinden Fleck der alten Phase-10-Tests auf:
  deren synthetische Listen hatten nie ein echtes Gewichtsgefälle *innerhalb*
  einer Stufe, der neue Test mit synergie-verzerrten Common-Karten schon),
  RNG-Verbrauch, Snapshot/Fortsetzen, Determinismus über einen ganzen Run.
  **Fallstrick beim Determinismus-Test**: mit „immer Karte 0" bleibt
  `run.synergyTags` über viele Seeds leer (nur 5 von 246 Karten tragen
  aktuell `tags[]`) — der Test wählt deshalb gezielt die erste
  `tags[]`-Karte im Angebot, sonst hätte die Gegenprobe (echte
  `Math.random()` im Gewichtungspfad) nichts zu fangen gehabt.

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 4 (Altes Geistersystem und reviveChance abbauen) — gemergt
Vor dem Nekromant-Neubau (Phase 6/7 dieses Auftrags) alle Reste des alten
Systems entfernt, damit nie zwei Geistersysteme gleichzeitig existieren.
- **`data/upgrades.json`**: Karte `ghost_crew` komplett entfernt. Die drei
  Karten mit `reviveChanceBonus` (`sig_necro_wiedergaenger`, `sig_necro_lich`,
  `sig_necro_unsterblich`) und die zwei mit `grantGhostCrew`
  (`sig_necro_geisterbeschwoerung`, `sig_necro_geisterlegion`) behalten ihre
  ids/Rarity/Tags — nur die abgebauten `core`-Schlüssel sind raus, die
  Beschreibungen an die verbleibenden Effekte angepasst.
  **`sig_necro_geisterlegion` hatte AUSSCHLIESSLICH diese beiden Schlüssel**
  und hat jetzt `core: {}` — eine Karte ohne Wirkung, bis Phase 8 den ganzen
  Signaturtopf ersetzt. Bewusst nicht vorzeitig gelöscht (hätte die
  Rarity-Verteilung 4/4/1/2/1 aus Phase 1 verschoben und wäre über die
  Auftrags-Dateiliste hinausgegangen); die Kartenbeschreibung sagt das
  Spielern ehrlich („Ohne aktuellen Effekt").
- **`cfg.js`**: `reviveChance` aus `resolveCfg()`, `cfg.ghostCrew`-Zuweisung
  aus `l('ghost_crew')`, sowie `reviveChanceBonus`/`grantGhostCrew`/
  `ghostDurationBonus` aus der generischen `core`-Schleife entfernt.
- **`state.js`**: `tryRevive()` samt aller drei Aufrufstellen in
  `applyDamage()` entfernt (jeder tödliche Treffer geht jetzt direkt zu
  `killTank()`); der `pc.ghostCrew`-Erzeugungsblock in `killTank()` entfernt;
  `state.ghostKills` bleibt als Telemetrie, verliert aber die
  `b.owner.timeLeft += balance.ghost.killBonus`-Verlängerung.
- **`data/balance.json`**: `ghost.duration`/`ghost.killBonus` entfernt,
  `ghost.maxActive` bleibt stehen (Phase 6/7 definiert Limit/Lebensdauer neu).
  `debug.js` brauchte **keine** Änderung — es liest nur `maxActive`, nie
  `duration`/`killBonus` (verifiziert, nicht nur angenommen).
- **`data/tanks.json`**: `c_necro.reviveChance` entfernt, `desc` auf „Ausgewogene
  Grundwerte, aktuell ohne eigenes Passiv" geändert (ehrlich statt eine
  entfernte Fähigkeit zu behaupten).
- **`ghost.js` bleibt unangetastet stehen, aber derzeit unbenutzt**: sein
  einziger Aufrufer (`killTank()`s `ghost_crew`-Zweig) ist weg, `createGhost()`
  wird von nirgendwo mehr gerufen. Kopfkommentar entsprechend ergänzt;
  `balance.ghost.duration` bekam trotzdem einen Fallback (`?? 3`), damit ein
  versehentlicher künftiger Aufruf kein `NaN` erzeugt, statt sich auf
  „wird ja eh nicht aufgerufen" zu verlassen.
- **`tests/regression.mjs`**: die alten Mechanismus-Tests für
  `reviveChanceBonus`/`grantGhostCrew`/`ghostDurationBonus` (Phase-26-Block
  (c)/(d1)/(d2) sowie der Phase-9-Block „(g) Nekromant: reviveChance") sind
  **ausgebaut, nicht auskommentiert** — die Fähigkeiten selbst gibt es nicht
  mehr. Struktur- und Filtertests (a)/(b) sowie der Blocker-Fix-Test (e) der
  Phase-26-Sektion blieben unverändert gültig.
- **Neuer Abschnitt 40** (Gegenprobe für jeden Kernpunkt bestanden): Struktur
  (`ghost_crew` weg, kein Kern-Effektschlüssel mehr referenziert, `tryRevive`
  weg, `cfg.reviveChance` weg), Verhalten (ein tödlicher Treffer auf den
  Nekromanten tötet immer, auch bei einem RNG-Wurf, der das alte 25 %-Passiv
  bestanden hätte), und ein kompletter Nekromant-Run bis zum Sieg ohne
  einen einzigen Geist und ohne Absturz (deckt Testschritt 5 „bis zum Boss
  spielen" ab). Playwright-Smoke im echten Browser bestätigt dasselbe.

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 5 (Zielsystem der Gegner-KI) — gemergt
Voraussetzung für den Nekromant-Neubau (Phase 6/7): Gegner werten jetzt
periodisch aus, WEN sie angreifen (Spieler oder ein Geist), statt hart auf
`state.player` zu zielen. Bewertung über eine **effektive Distanz** (kleiner
= attraktiver, keine echte Aggro-Tabelle), Werte in `data/balance.json:
aggro` + `boss.fixate`.
- **`src/game/ai.js`**: `resolveTarget(tank, state)` liest nur das zuletzt
  von `pickTarget()` gesetzte `tank.ai.target` (billig, jeden Frame lesbar);
  `pickTarget()` bewertet neu (Naehe, `ghostThreatMult` macht Geister bei
  gleicher Distanz unattraktiver, `damageThreatPx`/`damageThreatDecayS`
  ziehen das Ziel nach einem Treffer kurz an, `switchHysteresisPct`
  verhindert Zappeln zwischen fast gleich attraktiven Zielen);
  `updateTargeting(state, dt)` throttled das auf `reevaluateHz` je Panzer
  (eigener Timer, nicht synchron) und laesst mirrorBoss/phalanx bewusst aus.
  `registerThreat(tank, source, state)` (aus der Treffer-Schleife in
  `state.js`) ist ein No-op fuer den Spieler.
- **Sichtlinien-Fallback mit Gedaechtnis (`ai.avoidTarget`)**: verliert der
  Panzer laenger als `noTargetFallbackS` die Sichtlinie zu seinem Ziel,
  faellt er auf den Spieler zurueck. **Ohne Gedaechtnis waere das reine
  Zappeln**: die naechste Neubewertung haette den (weiterhin per Rohdistanz
  naeheren, nur eben unerreichbaren) alten Kandidaten sofort wieder gewaehlt
  — gemessen, kein hypothetischer Grenzfall. `avoidTarget` schliesst genau
  diesen einen Kandidaten aus der Bewertung aus, bis er (per live
  `clearLine()`-Check bei jeder Neubewertung) wieder sichtbar ist.
- **`ai_drives.js`/`ai_turrets.js`**: `sapperDrive`/`hunterDrive`/
  `siegerDrive`/`roleTurret`/`solveBounce` lesen jetzt `resolveTarget(tank,
  state)` statt `state.player` direkt. `targetInSight()` (früher
  `playerInSight`) nimmt das Ziel jetzt als Parameter. Deckungswahrnehmung
  (`isPlayerAiming`/`updateCoverPerception`, Phase 16) bleibt bewusst
  spielerbezogen (Auftrag: "kein Umbau ausserhalb des Zielsystems").
- **Bosse (`bossai.js`) ueberschreiben `tank.ai.target` selbst** und sind
  deshalb explizit von der generischen `updateTargeting()`-Schleife
  ausgenommen. `resolveBossTarget()`/`resolvePhalanxTarget()` wechseln
  zeitgesteuert (kein RNG, `state.time % cycle`) zwischen Fixierung auf den
  Spieler (`onPlayerS`, ignoriert Geister) und freier Zielwahl
  (`onGhostsS`). **Umsetzungsfund:** die freie Phase rief zunaechst nur
  `resolveTarget()` auf — das liest aber nur den *zuletzt gesetzten* Wert
  zurueck, ohne selbst neu zu bewerten. Da Bosse von der generischen
  Bewertungsschleife ausgenommen sind, haette „freie Zielwahl" nie einen
  Geist entdeckt und waere fuer immer beim initialen Spieler-Fallback
  haengengeblieben. Fix: `pickTarget()` (jetzt exportiert) wird in der
  freien Phase direkt aufgerufen, danach erst `resolveTarget()` gelesen.
  **Phalanx** erzwingt zusaetzlich raeumlich `minPlayerShare` der fuenf
  Panzer immer auf den Spieler (welche das sind wandert deterministisch
  ueber `phalanxIndex` + Rotationstakt). Der **Reaktorkern bekommt bewusst
  keine Sonderregel** (Geister koennen das Generator-Raetsel nicht lösen) —
  laeuft normal ueber `updateTargeting()`, per Test bewacht.
  `tank.fixatedOnPlayer` (neu, Renderer: pulsierendes rotes Turmgluehen)
  spiegelt die reine **Zeitfensterlage**, nicht ob `resolveTarget()` in der
  freien Phase zufaellig ebenfalls den Spieler waehlt — sonst waere das
  sichtbare Signal bei fehlenden Geistern dauerhaft (und damit bedeutungslos)
  an. `t.aimingAtPlayer` (Gefahrensinn, Phase 18 Welle 3) ist jetzt in
  `state.js` UND `bossai.js` nur noch wahr, wenn das aufgeloeste Ziel
  wirklich der Spieler ist.
- **`ghost.js` wird panzerkompatibel gemacht** (ohne die Geist-Erzeugung
  selbst wieder zu aktivieren — das bleibt Phase 6/7): `createGhost()`
  liefert jetzt `alive`/`vx`/`vy`/`hp` statt nur `dead`, `updateGhosts()`
  berechnet `vx`/`vy` wie `tank.js: moveTank()` (Vorhaltezielen kann einen
  Geist damit als Ziel behandeln) und entfernt einen Geist bei `hp<=0` oder
  Ablauf der Lebenszeit. `hp: tank.cfg.maxHp` ist ein **Interimswert** (Anhang
  B/Phase 7 will feste, vom getoeteten Gegner unabhaengige Basiswerte).
- **`state.js`**: neue, kleine, eigene Kollisionsschleife „Gegner-Geschosse
  gegen Geister" (bewusst NICHT in die grosse Panzer-Trefferschleife
  gepresst — deren Panzerungs-/Krit-/Kopfschuss-Logik ist auf echte Panzer
  zugeschnitten). Nur gegnerische Kugeln sind gefaehrlich (Spieler-/
  Geister-eigene Kugeln ignorieren Geister); minimal, kein `applyDamage()`/
  `killTank()` — der Nekromant-Neubau (Phase 7) baut die echten
  Todes-Hooks. `registerThreat(t, b.owner, state)` haengt in der
  bestehenden Treffer-Schleife.
- **Nebenfund (Datenort-Bug):** `aggro` wurde zunächst nach
  `state.data.ai.aggro` verdrahtet gelesen — das ist `tanks.json`s `ai`-Block,
  nicht `balance.json`. Die Werte aus `balance.json` wären dadurch nie
  gelesen worden (nur die Fallback-Defaults hätten gegriffen). Fix vor dem
  Testen entdeckt und behoben: `state.data.balance.aggro`.
- **Neue Dauertests** (Abschnitt 41, Gegenprobe für jeden Kernpunkt
  bestanden — inkl. des `avoidTarget`-Zappel-Fixes und des Datenort-Bugs):
  Grundmechanismus (kein Geist → Spieler; naher Geist gewinnt),
  `ghostThreatMult` (Geist real näher, aber effektiv weiter — bewusst KEINE
  exakte Distanzgleichheit, die wäre über Einfüge-Reihenfolge + „echt
  kleiner als" auch ohne Mult zufällig grün geblieben, per Gegenprobe
  gefunden), Hysterese (knapper Vorteil bleibt, deutlicher setzt sich
  durch), Bedrohungs-Anziehung + Abklingen, `registerThreat`-Spieler-No-op,
  Sichtlinien-Fallback (bleibt stabil auf dem Spieler statt zu zappeln),
  Integration (Fahr-/Turmverhalten steuert wirklich zum aufgelösten Ziel),
  `aimingAtPlayer` über die volle `stepState()`-Pipeline, Boss-Fixierung
  (Spiegel: Zeitfenster + echte Geist-Entdeckung in der freien Phase;
  Phalanx: räumliche Mindestquote + Rotation; Reaktor: keine Sonderregel),
  Geist-Objektform + Bewegung + hp-Entfernung, Geschoss-Kollision (Gegner
  trifft, Spieler/Geist nie, tödlicher Treffer entfernt), Determinismus
  (kein zusätzlicher `rng()`-Aufruf).

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 6 (Nekromant: Klassenidentität) — gemergt
Die Geistermechanik ist ab Klassenwahl aktiv, ohne Upgrade — „die Einheit
selbst" (Anhang B) baut erst Phase 7, dieses Modul reaktiviert nur den
bestehenden `ghost.js`-Mechanismus aus Phase 5 über zwei neue Ausloeser.
- **`c_necro`**: neues Datenfeld `necromancer: true` (`data/tanks.json`) →
  `cfg.necromancer` (`cfg.js: resolveCfg()`, Muster wie alle anderen
  Klassen-Passive). Beschreibung ersetzt („Getötete Gegner werden mit 50 %
  Chance zu kämpfenden Geisterpanzern …").
- **Kill-Zuordnung** (`meta.killer`): die Trefferschleife in `state.js`
  setzt `killer: b.owner` in `trefferMeta` — über `applyTypeEffects()`s
  `{...meta}`-Spread erbt eine daraus entstehende Blitzkette
  (`damagetypes.js`) denselben Wert **ohne Codeänderung dort**. Ergänzt an
  jeder weiteren Stelle, die `applyDamage`/`explodeAt` mit einem eigenen
  `meta` aufruft: `mine.js: explode()` (`killer: mine.owner`), die
  Sprengschuss-Detonation, Kamikaze, das Kettenblitz-Upgrade und die
  Saboteur-Transformation (alle drei `killer: state.player` bzw. `tank` beim
  Kamikaze). **Bewusste Lücke** (Phase 0 vorab dokumentiert): ein
  Statuseffekt-Tick (`status.js: updateStatus()`) kennt seinen Verursacher
  strukturell nicht — ein DOT-Kill löst deshalb nie einen Geist aus, kein
  Umbau von `status.js`.
- **Spawnwürfel** (`state.js: killTank()`, Werte in `data/balance.json:
  ghost.spawnChance`): Kill durch den Spieler als Nekromant 50 %, Kill durch
  einen Geist 33 %, alle anderen 0 % — über `state.rng()`, **nur wenn
  überhaupt eine Chance besteht** (sonst würde sich der RNG-Verbrauch jeder
  anderen Klasse verschieben und bestehende Seeds verschöben sich). Geistlimit
  auf **3** gesetzt (Festgelegte-Entscheidungen-Tabelle, vorher 4 aus dem alten
  System), **ohne Verdrängung** — am Deckel passiert nichts.
- **Geisterbombe** (`tank.js: useSecondary()`): bei `cfg.necromancer` ersetzt
  eine neue `spawnGhostBomb()` den kompletten `layMine()`-Aufruf — kein Wurf,
  keine Explosion, kein Fernzünder, sofort ein Geist gegen dasselbe Limit
  (dieselbe „am Limit passiert nichts"-Regel). Der Spieler selbst dient
  `createGhost()` als Vorlage (kein Leichnam vorhanden) — ein weiterer
  Interimswert, den Phase 7 durch feste Basiswerte ersetzt.
- **`exclusions`** (Anhang A §14, `upgradepool.js: buildCandidates()`): neuer
  Filter neben `signatureClass` — eine NEGATIVLISTE statt einer Zugehörigkeit
  (`def.exclusions.includes(starterTank)` sperrt die Karte für genau diese
  Klassen, alle anderen sehen sie normal weiter). Erste Nutzung: die sieben
  minenspezifischen Karten (`kettenglied`, `sprengkraft`, `fernzuender`,
  `schockwelle`, `annaeherungsmine`, `klebemine`, `streumine`) tragen
  `exclusions: ["c_necro"]`, weil der Bombenslot des Nekromanten keine Mine
  mehr ist.
- **`ghost.js` bleibt unangetastet** (Phase 6 ändert am Modul selbst nichts,
  nur Kopfkommentar aktualisiert) — `createGhost()` war seit Phase 5 bereits
  panzerkompatibel, die beiden neuen Erzeuger rufen sie unverändert auf.
- **Neue Dauertests** (Abschnitt 42, Gegenprobe für jeden Kernpunkt
  bestanden): Klassenidentität (`cfg.necromancer`, Beschreibungstext),
  Spawnwürfel an beiden Schwellen (49 %/51 %, 32 %/34 %), Nicht-Nekromant
  und „kein bekannter Killer" erzeugen nie einen Geist, Geistlimit ohne
  Verdrängung, Kill-Zuordnung über alle sieben Quellen (Kugel, Mine,
  Sprengschuss, Kamikaze, Kettenblitz-Upgrade, Saboteur, Blitzkette) sowie
  die akzeptierte DOT-Lücke, Geisterbombe (Spawn/kein Wurf/kein Verbrauch am
  Limit/Regressionscheck für andere Klassen), `exclusions`-Filter (Struktur +
  echte Poolziehung, Gegenprobe für andere Klassen), RNG-Determinismus
  (genau ein Zusatzaufruf nur bei echter Chance). **Zwei zunächst zu
  schwache Tests gefunden und korrigiert**: der Kettenblitz-Test nahm
  fälschlich zwei getrennte Kill-Ereignisse an, obwohl die Explosion
  synchron im selben `killTank()`-Aufruf läuft; der DOT-Test prüfte nach 4
  simulierten Sekunden — ein Geist verfällt aber nach dem alten
  `balance.ghost.duration ?? 3`-Fallback, ein absichtlich falsch
  zugeordneter Killer wäre dadurch unbemerkt geblieben (Ghost erzeugt, dann
  verfallen, am Ende trotzdem 0). Fix: sofort nach dem Tod prüfen.

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 7 (Geisterpanzer neu gebaut) — gemergt
`src/game/ghost.js` ist **komplett ersetzt**, nicht ergänzt (Anhang B): ab
jetzt haben ALLE Geister exakt dieselben, vom getöteten Panzer UNABHÄNGIGEN
Basiswerte statt der bisher geerbten cfg (Phase 5/6 hatten das ausdrücklich
als Interimswert dokumentiert).
- **Eigener, fester Unit-Typ `ghost_tank`** (`data/tanks.json: types`, ohne
  `player: true` und ohne Eintrag in `difficulty.json: danger` — sonst
  erschiene er im Klassen-Auswahlbildschirm bzw. wäre als Raum-Gegner
  kaufbar; beides per Gegenprobe als echter Absturz bestätigt, nicht nur
  behauptet). Feste Werte: 60 LP, 8 Schaden, 2,0 s Schussintervall, 0
  Abpraller, keine Rüstung. Drei **Prozentwerte** (`speedPct 0.7`,
  `bulletSpeedPct 0.8`, `rangePct 0.65`) beziehen sich ausdrücklich auf die
  **Standardklasse `player`**, nicht auf den aktuell gespielten Nekromanten.
- **`resolveGhostCfg(data)`** (neu, in `ghost.js` — bewusst NICHT in
  `cfg.js`): ruft die bestehende `resolveCfg(data, 'player')` als reine
  Baseline auf und multipliziert die drei Prozentfelder darauf. Das erfüllt
  „keine Parallelsysteme" (Anhang A §16), ohne `cfg.js` anzufassen oder
  `ghost_tank` fälschlich als Spielerklasse zu markieren.
- **`fireRangePx`** ist eine reine **Feuer-Schwelle** (65 % von
  `balance.bullet.maxDistance`), keine Bewegungsgrenze — das Verfolgen
  bleibt laut Anhang B ausdrücklich unbegrenzt. `updateGhosts()` bewegt sich
  immer auf das Ziel zu, feuert aber nur innerhalb der Schwelle (+ Feuerkegel
  + freie Sichtlinie).
- **Kein Lebensdauer-Timer mehr** (Anhang B §6, hartes Muss): die Felder
  `timeLeft`/`duration` sind aus `ghost.js` vollständig entfernt. Ein Geist
  lebt bis zum Tod (LP ≤ 0) oder bis der Raum endet — `state.ghosts` wird bei
  jedem `createState()`-Aufruf ohnehin frisch mit `[]` anglegt (kein
  separates `resetRoom()` nötig, das gibt es im Code nicht als eigene
  Funktion — `createState()` selbst IST dieser Reset).
- **`killGhost(g)`** (neu): einziger Tod-Trichter für Geister, analog
  `killTank()`. Aktuell reiner `alive=false`-Setter ohne Zusatzeffekt (Anhang
  B: „der Basistod hat keinen Zusatzeffekt") — existiert als fester
  Anschlusspunkt für Phase 8 (Wiederkehr-Karte).
- **Beide Erzeuger reichen nur noch Position/Ausrichtung durch**, keine cfg
  mehr: `state.js: killTank()`s Spawnwürfel ruft jetzt
  `createGhost(state, tank.x, tank.y, tank.heading)`, `tank.js:
  spawnGhostBomb()` entsprechend mit der Nekromanten-Position. Die
  Geschoss-vs-Geist-Kollisionsschleife in `state.js` nutzt bei `hp<=0` jetzt
  `killGhost(g)` statt eines direkten `g.alive=false`.
- **Darstellung**: neue, immer sichtbare Lebensleiste über dem Geist
  (`renderer.js: drawGhosts()`, Muster wie die Spieler-Leiste aus
  UMBAUPLAN-LP Phase 3 — bewusst IMMER an, nicht nur bei Schaden, sonst wäre
  die neue Sterblichkeit unlesbar), zusätzlich zum bestehenden
  durchscheinenden Sprite (`body_ghost`/`turret_ghost`, unverändert seit der
  Sprite-Lieferung). `sprites.js`/`debug.js` brauchten trotz Nennung in der
  Auftrags-Dateiliste **keine Änderung** (verifiziert, nicht angenommen):
  der Sprite-Lookup hängt schon an der literalen Zeichenkette `'ghost'`,
  nicht an `g.type`; das Debug-Panel liest bereits dasselbe
  `balance.ghost.maxActive`-Feld, das unverändert bleibt.
- **Testkorrekturen an Bestandstests, ausgelöst durch den neuen Registry-
  Eintrag** `ghost_tank`: die generische UMBAUPLAN-LP-Phase-2-Trefferzahl-
  Prüfung („jeder Typ 2–5 Treffer") und ein Minen-Wirkungstest iterierten
  bisher blind über `tanksData.types` und mussten `ghost_tank` (60 LP, kein
  purchasable Gegner) explizit ausschließen — sonst schlägt der ganze
  Regressionslauf fehl, ohne dass etwas kaputt ist.
- **Ein Testfund beim eigenen Testbau**: die erste Fassung von „Raumwechsel
  entfernt alle Geister" testete nur, dass der `necroRoom()`-Testhelfer
  selbst `st.ghosts.length = 0` setzt (redundant zu `bullets`/`mines`,
  kopiert) — das hätte den echten Mechanismus (frisches Array pro
  `createState()`) nie geprüft, trivial wahr durch den Helfer statt durch
  die Produktivlogik. Per Gegenprobe (Attrappe mit geteiltem Array über
  `state.js`) gefunden und die Zeile aus dem Helfer entfernt.
- **Neue Dauertests** (Abschnitt 43, Gegenprobe für jeden Kernpunkt
  bestanden, teils mit hartem Browser-Absturz statt nur einem Check-Fehler
  bestätigt — `ghost_tank` in `danger` bzw. ein Geist in `state.tanks` reißen
  `DRIVES[role]`/`ai.threatTimer` sofort um): einheitlicher Unit-Typ über
  beide Erzeuger, feste Basiswerte exakt gegen Anhang B, Mechanismus der
  Prozent-Multiplikation (synthetische `speedPct`/`bulletSpeedPct`/
  `rangePct`-Overrides), keine Stat-Übernahme (leichter vs. übermächtiger
  Testgegner ergeben identische Geister), kein Lebensdauer-Timer (20 s ohne
  Ziel simuliert), Feuer-Schwelle (schiesst nicht ausserhalb, verfolgt aber
  trotzdem; synthetischer `rangePct`-Override statt realer Arena-Distanzen,
  weil die echten 780 px in keiner Testarena Platz haben), `killGhost()` ohne
  Nebeneffekt + idempotent, neuer Geist nach dem Tod des alten (Deckel
  blockiert nicht dauerhaft), Raumwechsel entfernt alle Geister, `ghost_tank`
  weder als Raum-Gegner kaufbar noch je in `state.tanks`. Playwright-Smoke
  (Necromant wählen, Run starten, Snapshot bestätigt `starterTank: 'c_necro'`,
  keine Konsolenfehler) + ein separater Fake-Canvas-Renderlauf mit einem
  angeschlagenen Geist (Lebensleiste zeichnet, kein Absturz) bestanden.

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 8 (Signaturpool Nekromant) — gemergt
Die zwölf alten `sig_necro_*`-Karten (Phase 26, spielerseitige Statboni) sind
durch den **18-Karten-Pool aus Anhang A/B** ersetzt: Geisterkern,
Seelenkanone, Unruhige Seelen, Rastlose Geister, Seelenruf, Rudelgeist,
Seelensog, Seelenketten, Seelenkonzentration, Letzter Wille, Wiederkehr
(common/rare, 5/6), Geisterlegion, Geisterkommandant (epic, 2), Phylakterium,
Unsterbliche Seele, Lich-Panzer (unique, 3), Ewige Wiederkehr, Armee der
Toten (legendary, 2) — Verteilung 5/6/2/3/2 statt der alten 4/4/1/2/1.
**Der entscheidende Unterschied zur alten Generation**: keine der 18 Karten
gibt dem SPIELER Statwerte — jede wirkt über neue `ghost*`-`core`-Schlüssel
auf die Geistereinheit (Anhang A §14 „effect/effectValues" sind bewusst NICHT
eingeführt, das bestehende `core`-Objekt ist bereits die geforderte
datengetriebene Effektschicht, ein zweites Effektsystem wäre genau die in
§16 verbotene Parallelstruktur).
- **`cfg.js: applyUpgrades()`** bekommt 16 neue `core`-Schlüssel im
  generischen Loop (additiv: `ghostHpAdd`/`ghostDamageAdd`/`ghostMaxAdd`/
  `ghostPackDamagePerAlly`/`ghostLifestealPct`/`ghostStunOnHit`/
  `ghostDeathZoneRadius`/`ghostDeathZoneDamage`/`ghostReviveChance`/
  `ghostCommanderMultBonus`/`ghostReviveGrowth`; multiplikativ, gesammelt und
  nach der Schleife angewandt wie `damageMult`/`bulletSpeedMult`:
  `ghostSpeedMult`/`ghostFireMult`/`ghostDamageMult`/`ghostHpMult`; Max:
  `ghostReviveMaxUses`; Booleans: `ghostCommander`/`ghostCommanderShield`) —
  landen alle auf dem SPIELER-cfg, nicht auf einem zweiten Geister-cfg.
- **`ghost.js: resolveGhostCfg(data, playerCfg)`** liest diese Felder vom
  aufgelösten Nekromanten-cfg und legt sie additiv/multiplikativ auf die
  festen Anhang-B-Basiswerte (60 LP/8 Schaden/2,0 s/70 %/80 %/65 %) drauf —
  reine Erweiterung der Phase-7-Funktion, kein zweites Stat-System.
- **Deckel-Erhöhung an BEIDEN Erzeugern**: `ghostMaxAdd` muss sowohl in
  `state.js: killTank()`s Kill-Spawnwürfel als auch in `tank.js:
  spawnGhostBomb()` addiert werden (`(gcfg.maxActive ?? 3) +
  (pc.ghostMaxAdd || 0)`) — zwei getrennte Aufrufstellen seit Phase 6/7,
  beide vergessen hätten Seelenruf/Geisterlegion/Armee der Toten an einer
  Hälfte wirkungslos gemacht.
- **Rudelgeist/Armee der Toten (`ghostPackDamagePerAlly`) wird NICHT in die
  cfg gebacken**, sondern in `ghost.js: updateGhosts()` bei JEDEM Schuss neu
  aus der aktuellen Anzahl lebender Geister berechnet (`packMult`) — die
  Anzahl ändert sich laufend (Tod, neue Spawns), ein einmalig berechneter
  Wert wäre sofort veraltet.
- **Seelensog (Lebensraub) und Seelenketten (Betäubung) sitzen in `state.js`**,
  nicht in `ghost.js`: beide hängen an der bestehenden Geschoss-Trefferschleife
  (`b.owner?.isGhost`-Zweig, der schon `ghostKills` zählt) — Lebensraub nur
  beim KILL (Heilung = `ghostLifestealPct` × Kill-Schaden, gedeckelt auf
  `cfg.maxHp`), Betäubung bei JEDEM Treffer (`t.stunTimer = Math.max(...)`,
  eigenes Feld, unabhängig vom EMP-Minen-Turm-Stun).
- **`killGhost()` ist jetzt der zentrale Ort für alle drei Todes-Mechaniken**
  (genau wie in Phase 7 als Anschlusspunkt vorgesehen), in dieser Reihenfolge:
  Phylakterium (Kommandant übersteht EINEN tödlichen Treffer pro Raum, kein
  Wiederbelebungs-Verbrauch) → Wiederkehr-Familie (`tryReviveGhost()`) →
  erst wenn beides nicht greift: `alive = false` + Letzter Wille
  (`spawnDeathZone()`, reine Wiederverwendung von `mine.js: explodeAt()` mit
  `spare: state.player` — der eigene Nekromant bleibt von seiner eigenen
  Todeszone verschont, keine neue Explosionslogik nötig).
- **`tryReviveGhost()`**: `reviveUsesLeft` wird beim ERSTEN Tod aus
  `ghostReviveMaxUses` (Standard 1, Unsterbliche Seele erhöht ihn) initialisiert
  und zählt danach unabhängig vom cfg weiter. Ewige Wiederkehr skaliert
  **linear vom ursprünglichen Basiswert** (`reviveBaseMaxHp`/`reviveBaseDamage`,
  einmalig gemerkt), nicht kumulativ vom letzten Stand — sonst wäre es
  exponentielles statt lineares Wachstum je Wiedergeburt.
- **Geisterkommandant**: die Zuweisung passiert bei der ERZEUGUNG
  (`createGhost()`), nicht nachträglich — `!state.ghosts.some(g => g.alive &&
  g.isCommander)` garantiert genau einen gleichzeitig, ohne einen
  Verdrängungsmechanismus zu brauchen (der zweite Aufruf sieht den ersten
  Geist schon im Array, weil beide Erzeuger `push()` sofort nach `createGhost()`
  aufrufen). Die Multiplikatoren (`commanderHpMult`/`commanderDamageMult`,
  Vorschlagswerte 2,5×/2×ohne Anhang-B-Zahlen, `_comment_ghost` markiert) plus
  Lich-Panzers `ghostCommanderMultBonus` (additiv zum Basismultiplikator)
  wirken einmalig bei der Erzeugung, nicht laufend.
- **Sichtbares Gegenstück für den Kommandanten** (Auftrag-Testschritt 3
  „muss erkennbar sein"): ein goldener Ring (`renderer.js: drawGhosts()`,
  dieselbe Farbe wie legendäre Karten) um den einen Kommandanten — kein neues
  Sprite nötig. Per Fake-Canvas-Renderlauf verifiziert: genau ein
  zusätzlicher `stroke()`-Aufruf mit vs. ohne Kommandant.
- **`_todo: balance`** (wörtliche Auftragsvorgabe) auf jeder Karte, deren
  Zahlenwert nicht in Anhang A/B steht (13 der 18 — nur Seelenkanones „+2
  Schaden", Seelenrufs „+1"/Basis-3-Beispiel und Geisterlegions „+2" sind
  direkte Anhang-B/A-Zitate und bleiben unmarkiert).
- **Abschnitt 34 (ehemals „UMBAUPLAN-LP Phase 26") umgestellt** statt neu
  angelegt: Struktur/Filter/Mehrfachangebot-Tests gelten weiter, nur die
  Zahlen (18 statt 12, 5/6/2/3/2 statt 4/4/1/2/1) sind aktualisiert. Neuer
  Abschnitt 44 prüft ausschließlich die NEUEN Mechanismen.
- **Ein echter Testinfrastruktur-Fund**: der bestehende „jede Karte ist
  ziehbar"-Test (Abschnitt 6b2) zog Signaturklassen bisher nur OHNE erfüllte
  `requires` und erfüllte `requires` nur OHNE `starterTank` — die Nekromant-
  Karten sind die ERSTEN Signaturkarten mit `requires` auf eine andere Karte
  derselben Klasse (Geisterlegion→Seelenruf, Phylakterium/Lich-Panzer→
  Geisterkommandant, Unsterbliche Seele/Ewige Wiederkehr→Wiederkehr) und
  wären mit der alten Testlogik als „tot" durchgefallen. Fix: ein dritter Zug
  `drawAll(reqTargets, klass)` pro Signaturklasse.
- **Neue Dauertests** (Abschnitt 44, Gegenprobe für jeden Kernpunkt bestanden,
  mehrere davon kaskadieren korrekt über mehrere Tests hinweg, weil spätere
  Mechaniken auf früheren aufbauen — z. B. bricht das Abschalten der
  Kommandant-Zuweisung auch die Phylakterium- und Lich-Panzer-Tests):
  Applier-Arithmetik für alle 16 Schlüssel, `resolveGhostCfg()`-Mechanismus
  (vier Basis-Boosts wirklich multiplikativ/additiv, nicht nur im cfg
  vorhanden), `ghostMaxAdd` an beiden Erzeugern, Rudelbonus am echten
  abgeschossenen Geschoss gemessen, Seelensog nur bei echtem Kill, Seelenketten
  bei jedem Treffer, Letzter Wille verschont den eigenen Nekromanten,
  Wiederkehr-Grenzwertprobe (49 %/51 %), Unsterbliche-Seele-Deckel,
  Ewige-Wiederkehr-Linearität, Geisterkommandant-Einzigartigkeit +
  Multiplikator (gegen einen baugleichen Kontroll-Geist ohne Kommandant
  gemessen), Phylakterium einmal pro Raum, Lich-Panzer-Zusatzbonus,
  Lich-Panzer-`requires`-Gating (Testschritt 4 wörtlich), NaN/Infinity-Check
  über alle 18 Karten (das „Fertig, wenn"-Kriterium des Auftrags). Playwright-
  Smoke (Nekromant wählen, Run starten, keine Konsolenfehler) + zwei
  Fake-Canvas-Renderläufe (Kommandant-Ring-Differenz, Kommandant-Renderpfad
  crashfrei) bestanden.

### Upgrade-/Klassenpool-System v2 + Nekromant — Phase 9 (Abnahme) — gemergt
Die Schlussabnahme des ganzen Auftrags. **Keine Balance-Werte geändert** — alle
25 Abnahmepunkte sind am aktuellen Stand grün. Neuer Abschnitt 45 in
`tests/regression.mjs` deckt bewusst **nur die 13 noch offenen** Punkte ab;
die übrigen 12 sind in den Abschnitten 34/36/39/41–44 schon mit eigener
Gegenprobe gebaut und werden nicht dupliziert (die Zuordnung steht als Tabelle
im Kopfkommentar von Abschnitt 45).
- **Der Bosskampf-Korridor ist der eigentliche Ertrag** (Auftragspunkte
  12/13): ein 60-Sekunden-Bosskampf mit drei lebenden Geistern, die
  Bossschüsse nach Ziel gezählt. Zwei Schranken in BEIDE Richtungen —
  Untergrenze gegen Trivialisierung (**> 55 % der Schüsse gelten weiterhin
  dem Spieler**, gemessen 59,8 %) und Obergrenze gegen Wertlosigkeit (**die
  Geister ziehen ≥ 10 %**, gemessen 40,2 %). Das Fixierungsfenster wird
  zusätzlich mit **eigenen Zahlen** nachgerechnet (synthetische Fenster 6/2
  und 2/6 → gemessen 76,8 % vs. 25,6 %), statt die aktuellen
  `balance.json`-Werte gegen sich selbst zu prüfen.
  **Die Gegenprobe war hier besonders aussagekräftig**: eine reine
  Balance-Verschiebung (`boss.fixate` 4/3 → 1/6) bei völlig intaktem
  Mechanismus lässt die **gesamte übrige Suite grün** und wird ausschließlich
  von diesem Test gefangen (14,2 % statt > 55 %).
- **Ein echter Fund in einem Bestandsmechanismus** (Auftragspunkt 4): der
  Phase-6-Test prüfte am Geistlimit nur die **Anzahl** — eine FIFO-Verdrängung
  hält die Anzahl aber ebenfalls bei 3 und wäre unbemerkt durchgerutscht
  (Anhang B §5 verbietet sie ausdrücklich). Der neue Test vergleicht die
  **Geist-IDs** vor und nach einem weiteren Kill am Limit; per Gegenprobe
  bestätigt, dass eine eingebaute FIFO-Verdrängung nur von ihm rot gemacht wird.
- **Ein Fehler im eigenen neuen Test, vor dem Merge gefunden**: `createRun()`
  nimmt `modeKey` als 6. und `opts` erst als 7. Parameter — ein
  `{ starterTank: 'c_necro' }` an 6. Stelle landet still im `modeKey`, die
  Klasse bleibt `player`. Der Raum-geräumt-Test lief dadurch grün, **ohne je
  einen Nekromanten-Run gebaut zu haben**. Jetzt mit `'normal'` als 6.
  Argument und einer expliziten Vorbedingungs-Prüfung auf `run.starterTank`.
- **Weitere neue Tests** (alle mit bestandener Gegenprobe): statistische
  Spawnquote über 3.000 Kills mit festem Seed (49,3 % / 33,3 % gegen die
  Sollwerte 50 % / 33 %), Boss-Kill erzeugt denselben Basistyp ohne Stat-Erbe,
  Wiederbelebung **nur** mit aktivem Upgrade (44(h) prüfte nur den
  Erfolgsfall), Gegner wählt einen frei sichtbaren Geist **und trifft ihn**
  end-to-end über `stepState()`, ein Geist mit 0 LP gibt seinen Platz am Limit
  wieder frei, Geister blockieren die Raum-geräumt-Prüfung nicht (sonst wäre
  jeder Nekromanten-Raum unbeendbar), kein Zielflackern (0,00 Wechsel/s gegen
  1,60/s ohne Hysterese — in einem Szenario gemessen, das ohne Hysterese
  nachweislich flackert), und vier Pipeline-Invarianten über 2.560 echte
  Angebotsrunden mit 7.680 gezogenen Karten (`maxStacks` nie überschritten,
  kein unerfülltes `requires`, nie zwei gleiche Karten im selben Angebot,
  alle 251 Karten lösen sich ohne `NaN`/`undefined` auf).
- **Ein Testfallstrick beim NaN-Check**: `role` und `miner` sind bei **jeder**
  Spielerklasse von Haus aus `undefined` — ein pauschaler `undefined`-Test wäre
  dauerhaft rot gewesen und hätte nichts geprüft. Verglichen wird deshalb gegen
  die **upgradelose Basis derselben Klasse**: eine Karte darf kein Feld
  `undefined` machen, das die Basis noch hatte.
- **Die Spawnquoten-Messung ist bewusst an `balance.json` gekoppelt** (der
  Auftrag nennt „50 % / 33 %" ausdrücklich als Abnahmekriterium) — eine
  Balance-Änderung SOLL sie mitziehen. Die Gegenprobe musste deshalb den
  **Mechanismus** brechen (fester Wert im Code statt aus der JSON), nicht die
  Datenlage.
- **`sw.js` auf `v111` gebumpt** (+ `telemetry.js: GAME_VERSION`); die
  `ASSETS`-Liste wurde gegen den echten Dateibestand geprüft (keine fehlende,
  keine tote Datei).
- **Alle fünf Testschritte des Auftrags im echten Browser bestanden**:
  kompletter Nekromanten-Run bis zum Boss (Sieg nach 11 Räumen, bis zu 3
  gleichzeitige Geister), derselbe Seed mit der Standardklasse (Sieg, **0**
  Geister — „nichts fühlt sich anders an als vorher"), Abbrechen und
  Fortsetzen (Klasse, Karten, Tag-Bilanz und Schrott stimmen), Offline-Neuladen
  (`panzerknacker-v111` mit 101 Einträgen im Cache, App startet offline
  vollständig). Keine Konsolenfehler.
- **Laufzeit**: die Suite braucht jetzt ~7 s (nicht mehr ~1 s wie früher in
  dieser Datei angegeben) — davon lagen ~6,5 s schon vor dieser Phase an, der
  neue Abschnitt kostet ~0,6 s. Die teuerste neue Messung (3.000 Kills je
  Quote) läuft bewusst in EINEM Raum mit wiederbelebtem Gegner statt mit 3.000
  `createState()`-Aufrufen.

### Nekromant-Feinschliff (Nutzerwunsch) — gemergt
Drei Praezisierungen nach Abschluss des Nekromant-Auftrags: Bomben-Cooldown,
Bestaetigung der Unaustauschbarkeit, Gadget-Ausschluss.
- **Geisterbombe hat jetzt eine eigene Abklingzeit** (`data/balance.json:
  ghost.bombCooldownS`, 10 s) — vorher konnte sie beliebig oft hintereinander
  ausgeloest werden (nur das Geistlimit bremste). Neues Feld
  `tank.ghostBombCooldown`, tickt im selben Panzer-Loop wie `gadgetCooldown`
  (`state.js`). Ein Wurf am vollen Geistlimit startet bewusst KEINE
  Abklingzeit — passend zur bestehenden Regel „am Limit passiert nichts,
  kein Verbrauch". Rueckmeldung bei einem blockierten Wurf: derselbe Ton +
  gedimmter Blitz wie beim gesperrten Schuss/Enterhaken-Fehlschuss
  (`tank.js: signalBlockedShot` → umbenannt in `signalBlockedAction`, jetzt
  ein gemeinsamer Helfer statt eines rein schuss-spezifischen). HUD zeigt
  fuer den Nekromanten „Geisterbombe X.Xs"/„✓" statt der vorher toten
  „Minen X/Y"-Zeile (`cfg.mines` wird fuer ihn nie gelesen, war seit Phase 6
  eine irrefuehrende Anzeige).
- **Der Bombenslot ist bereits seit P4 architektonisch permanent** —
  `run.equippedSecondary` ist immer die Konstante `'mine'`, kein Upgrade
  traegt noch `tag: "secondary"`, und `useSecondary()` leitet beim
  Nekromanten unbedingt auf die Geisterbombe um. Kein Codeaenderung noetig,
  nur ein neuer Regressionstest, der das strukturell absichert (Karte mit
  `tag: "secondary"` verboten + ein echter `applyUpgradeChoice()`-Aufruf
  aendert `equippedSecondary` nicht).
- **Alle fuenf Gadget-Karten schliessen den Nekromanten aus**
  (`emp_mine`/`hook`/`deflector`/`smoke`/`trap_wall` bekommen `"exclusions":
  ["c_necro"]`) — der Nekromant hat dadurch gar keinen zweiten Slot mehr.
  **Fund dabei:** der Shop-Kauf (`run.js: buyShopSecondary()`) ist ein
  zweiter, von `exclusions` unabhaengiger Codepfad (er liest nur
  `data/secondaries.json`, nicht den `exclusions`-gefilterten Upgrade-Pool)
  — ohne eigene Sperre haette der Nekromant ein Gadget einfach mit Schrott
  kaufen koennen. Jetzt zusaetzlich in `buyShopSecondary()` gesperrt, und
  die ganze Sektion „Gadget tauschen" bleibt in `roomscreens.js` fuer ihn
  unsichtbar (`ctx.necromancer`, aus `main.js` durchgereicht) statt nur
  ausgegraut.
- **Neue Dauertests** (Abschnitt 46, Gegenprobe fuer jeden Kernpunkt
  bestanden): Cooldown-Mechanismus mit synthetischem Wert (nicht dem echten
  10s-Wert) inkl. Epsilon-Fix fuer Fliesskomma-Drift ueber 180 Tick-Schritte
  (dasselbe Muster wie `fireBullet()`s Cooldown), kein Cooldown-Start am
  Limit, Ton+Blitz-Rueckmeldung, `exclusions` auf allen fuenf Gadget-Karten,
  Pool-Ziehung ueber 800 Angebote sieht nie eine Gadget-Karte, Shop-Sperre
  mit Kontrolle gegen eine andere Klasse, HUD-Zeile, Struktur-Nachweis zum
  permanenten Bombenslot, und ein DOM-Test (`domstub.mjs`) fuer die
  unsichtbare Shop-Sektion. **Ein Testfund unterwegs:** die erste Fassung
  der DOM-Pruefung las `el.innerHTML`, das im Stub nur ein gespeicherter
  String ist und von `appendChild()` nie aktualisiert wird (immer leer nach
  dem initialen `el.innerHTML = ''`) — auf `el.textContent` umgestellt, das
  rekursiv aus den echten Kindknoten liest.

### Grundsteinumbau v3 — Phase 0 (Archiv anlegen) — gemergt
**Neu eingegangen: `AUFTRAG-GRUNDSTEINUMBAU.md` (v3).** Elf Sitzungen
(Phase 0–10), die **vor** dem überarbeiteten Nekromanten-Auftrag laufen:
Bandenschuss komplett raus (Spieler UND Gegner), Spielerkugel 200→450,
gerichteter Flanken-/Heckschaden statt Vorhaltefrust, Exekutionsschwelle,
der Grüne wird vom Bankshot- zum Mörserschützen, alle Upgrade-Karten ins
Archiv zugunsten eines 5-Karten-Sockels (künftig klassenspezifische Pools),
acht Klassen geparkt (nur `player`+`c_necro` aktiv), Run-Struktur auf drei
Akte à ~16 Räume mit fester Boss-Zuordnung (Reaktor/Spiegel/Phalanx)
umgebaut. **Eine Phase pro Sitzung, strikt in Reihenfolge.**

**Phase 0 (Archiv anlegen) ist gebaut**: `ARCHIV.md` (Index) + `archive/`
(`upgrades-v1.json`: Verbatim-Kopie aller aktuell 251 Karten;
`bandenschuss.md`: komplette Mechanikbeschreibung des Bandenschusses;
`klassen-v1.json`: die acht zu parkenden Klassen; `gegner-v1.json`:
`t_prism` vollständig + die Vor-Phase-3-Fassung von `t_green` als reine
Referenz; `systeme-v1.md`: Transformationen, Zweitelement, Element-Filter,
Schatzraum-Legendär-Belohnung, alter Extra-Leben-Mechanismus). Noch keine
Codeänderung am Spiel selbst — reine Ablage + Ist-Abgleich.
**Der Ist-Abgleich gegen den Code (Auftrag Abschnitt 3) hat zwei
Abweichungen mit echter Konsequenz für Phase 1 gefunden** (Details +
Fundstellen in `ARCHIV.md`, Abschnitt „Ist-Abgleich Phase 0"):
1. **Reaktor-Generatoren (Akt-1-Boss) brauchen HEUTE bereits einen
   Bankshot, nicht umgekehrt** — der Auftrag behauptet das Gegenteil
   ("Direkttreffer genügt"). `bullet.js:136`:
   `wall.type === 'generator' && b.wallBounces > 0` — ein Direkttreffer
   prallt wirkungslos ab, nur eine schon abgeprallte Kugel beschädigt den
   Generator. Ohne Wandabpraller (Phase 1) kann diese Bedingung nie mehr
   eintreten — der Reaktorkampf wird ohne eine gezielte Codeänderung genau
   an dieser Stelle unlösbar.
2. **`t_mirror` (Akt-2-Boss) hängt an `requiresRicochet`/`hasWallBounced()`**
   — Phase 1 will genau das "ersatzlos" entfernen. Mit `armor.arc: 360`
   blockt der Spiegel sonst JEDE Kugel für immer (nur Minen blieben
   wirksam, die Panzerung ignorieren Explosionen bewusst).
3. (Klarstellung, keine Handlungskonsequenz) `t_prism` nutzt entgegen der
   Ist-Stand-Prosa in Auftrag Abschnitt 3 **kein** `requiresRicochet` mehr
   (das ist seit UMBAUPLAN-LP Phase 8 durch `bounceDamageTakenMult: 3`
   ersetzt) — die "Festgelegte Entscheidung" in Auftrag Abschnitt 2 ist
   davon nicht betroffen und stimmt bereits mit dem Code überein.
4. Kartenzahl ist **251**, nicht 246 (Prosa-Zahl im Auftrag veraltet, keine
   Logik betroffen). `drawAimLine()` liegt in `src/render/effects.js:277`,
   nicht in `renderer.js` (das importiert/ruft nur auf). Alles Übrige aus
   Abschnitt 3 wurde ohne Abweichung bestätigt.

**Phase 1 (Bandenschuss vollständig entfernen) ist gebaut** — eigener
Abschnitt weiter unten. Beide oben genannten Blocker sind über den
Boss-Platzhalter aufgelöst (nicht über den vorgeschlagenen Direkttreffer-
Umbau), eine dritte, in Phase 0 übersehene Stelle (Spiegelwand-Erzeugung
war entgegen der ursprünglichen Annahme aktiv) ist mit gefunden und
mitentfernt. **Phase 2 (Kampfkern: Kugeltempo 200→450, Flanken-/
Heckschaden, Exekutionsschwelle, Treffer-Rückmeldung) ist gebaut** —
eigener Abschnitt weiter unten. **Phase 3 (Der Grüne wird Mörserschütze)
ist gebaut** — eigener Abschnitt weiter unten. **Phase 4 (Upgrades raus,
Sockel rein) ist gebaut** — eigener Abschnitt weiter unten. **Phase 5
(Klassen parken) ist gebaut** — eigener Abschnitt weiter unten. **Phase 6
(Drei Akte) ist gebaut** — eigener Abschnitt weiter unten. **Phase 7
(Rastplatz und Aufwertung) ist gebaut** — eigener Abschnitt weiter unten.
**Phase 8 (Shop überarbeiten) ist gebaut** — eigener Abschnitt weiter unten.
**Phase 9 (Kartenbelohnung neu verteilen) ist gebaut** — eigener Abschnitt
weiter unten. **Nächste Sitzung: Phase 10** (Abnahme, letzte Phase des
Grundsteinumbaus).

### Bosse (Platzhalter, Nutzerentscheidung) — gemergt
Reaktion auf die beiden Phase-0-Blocker oben: **die drei echten Bosse
(Reaktor/Spiegel/Phalanx) sind noch nicht ausgearbeitet und werden erst in
einer eigenen künftigen Aufgabe neu gebaut** — die alte Mechanik
(Generator-Rätsel, Spiegelbewegung, rotierende Formation) "hat keine
Bewandtnis mehr" (O-Ton Nutzer). Damit sind auch die beiden Phase-0-Blocker
gegenstandslos, bis die Bosse neu entstehen — nicht behoben, sondern nicht
mehr erreichbar.
- **`src/game/run.js: BOSS_ENEMY_TYPES`**: alle drei Boss-Arenen
  (`boss_reactor`/`boss_mirror`/`boss_phalanx`) spawnen jetzt **`t_black`**
  statt `t_reactor`/`t_mirror`/5×`t_phalanx` als Platzhalter-Gegner. Die
  restlichen Spawnpunkte der Arena (v. a. `boss_phalanx` mit 5 Slots)
  füllt weiterhin die normale Unterstützungs-Einkaufslogik
  (`buyEnemies()`, `diff.finalRoom.supportBudget`), unverändert.
- **Nichts gelöscht, nur nicht mehr erreicht**: `t_reactor`/`t_mirror`/
  `t_phalanx` (`data/tanks.json`), `bossai.js`
  (`stepMirrorBoss`/`stepPhalanxBoss`), die `boss_*`-Arenen
  (`data/arenas.json`), die Panzerungs-Sonderfälle (`armor.js`:
  `requiresRicochet`, `armor.arc:360`) und `data/balance.json: boss.*`
  bleiben unverändert im Code/in den Daten stehen — kein zweiter
  Archivpfad nötig, weil nichts aus dem aktiven Code entfernt wurde,
  nur die Auswahl in `run.js` umgebogen ist. Die dazugehörigen
  Bestandstests (`tests/regression.mjs`, u. a. Abschnitte zu
  `t_reactor`/`t_mirror`/`t_phalanx`-LP, Boss-Fixierung, Generator-Zähler)
  bauen ihre Test-Räume direkt über `createState()` mit expliziten
  `enemyTypes`/`roomSpec` — sie laufen an `run.js`/`BOSS_ENEMY_TYPES`
  vorbei und bleiben deshalb unverändert grün; die Boss-Mechanik ist also
  weiterhin bewacht, falls sie später wiederverwendet/überarbeitet wird.
- **`t_black`** ist ein regulärer, bereits vorhandener Spätspiel-Gegner
  (`unlockRoom: 11`, Vorhaltezielen, weicht aus, legt Minen, flieht vor
  Beschuss) — kein Boss-Ersatz im Sinne eines eigenen Kampfsystems, nur ein
  bekannter, funktionierender Platzhalter. `isBossCfg()` (`cfg.js`) erkennt
  ihn NICHT als Boss (kein `bossInvincible`/`mirrorBoss`/`phalanx`) —
  bewusst so, ein Platzhalter soll sich nicht wie ein echter Boss
  ausgeben (keine HP-Skalierungs-Ausnahme, kein Flanken-Schaden-Opt-out).
- **Blockiert Grundsteinumbau-Phase 1 nicht mehr**: die beiden Phase-0-Funde
  (Reaktor-Generatoren brauchen aktuell einen Bankshot, `t_mirror` hängt an
  `requiresRicochet`) betreffen jetzt keinen im Spiel erreichbaren Boss
  mehr — Phase 1 kann den Bandenschuss entfernen, ohne diese beiden Punkte
  vorher zu lösen. Sobald echte Bosse neu gebaut werden, müssen beide
  Punkte trotzdem irgendwann adressiert werden (Details weiterhin in
  `ARCHIV.md`, Abschnitt „Ist-Abgleich Phase 0" — dort stehengelassen, weil
  technisch weiterhin zutreffend, nur nicht mehr dringlich).

### Grundsteinumbau v3 — Phase 1 (Bandenschuss vollständig entfernen) — gemergt
Kein Geschoss prallt mehr von einer Wand ab — bei niemandem, Spieler wie
Gegner. Größte Einzelphase des Umbaus bisher: die Mechanik durchzog
Geschossphysik, KI, Panzerung, Telemetrie, Raum-Modifikatoren und den
Raumgenerator gleichermaßen.
- **`src/game/bullet.js`**: `createBullet()` verliert `ricochetsLeft`/
  `ricochetsStart`/`wallBounces`; jeder Wandkontakt tötet das Geschoss sofort
  (`moveAxis()`/`updateBullet()` radikal vereinfacht). Die Sonderfälle
  bleiben unverändert: Wolframkern reißt Wände ein und fliegt weiter,
  Sprengmunition zündet an der Wand, Sperrmauer/zerstörbare Wände nehmen
  weiter Schaden. Ein Wandtreffer spielt jetzt `'bounce'` (Bedeutung
  umgewidmet: reiner Wand-Einschlag-Ton, nicht mehr "erster Abpraller").
  **`traceTrajectory()`/`effects.js: drawAimLine()`** verlieren den
  Abpraller-Vorgriff — die Ziellinie zeigt nur noch die gerade Strecke bis
  zur ersten Wand. Eine **zweite, bis dahin unbemerkte** Aimline-Instanz
  direkt in `renderer.js: drawTank()` (kurze Vorschau am Rohr, unabhängig
  vom abschaltbaren `effects.js`-Overlay, "wichtig für Touch/Gamepad ohne
  Cursor") hatte ihre eigene, kleine Bounce-Simulation — ebenfalls auf
  reine Direktlinie vereinfacht.
- **`armor.js`**: `hasWallBounced()` entfernt, `isLive(b)` ist jetzt nur
  noch `!!b.reflected` (die einzige verbleibende Quelle einer für den
  Schützen gefährlichen eigenen Kugel ist die Frontpanzerung-Reflexion,
  E3). `armorBlocks()` verliert die `requiresRicochet`-Auswertung
  (Kill-Block ganz ohne Bandenschuss ergäbe einen Dauer-Block). Das
  **Datenfeld** `cfg.requiresRicochet`/`tanks.json: t_mirror.requiresRicochet`
  bleibt bewusst als reiner Boss-Platzhalter-Passthrough stehen (nur noch
  für die Renderer-Optik gebraucht) — siehe „Bosse (Platzhalter)" oben,
  der Spiegel wird ohnehin gerade nicht gespawnt.
- **`ai_turrets.js`**: `solveBounce()`/`bounceShot()` (Abpraller-Rechner,
  einziger Nutzer `t_green`) vollständig entfernt. `t_green` feuert seitdem
  über die normale, sichtlinienabhängige Turmlogik (`accuracy: 0.9`) —
  ein dokumentierter Übergangszustand, Phase 3 baut ihn zum Mörserschützen
  um. `tanks.json: ai.bounceShot`-Konfigurationsblock entfernt,
  `state.bounceSolveBudget` (Frame-Budget-Sicherheitsnetz) entfernt.
- **`t_prism` komplett aus dem Spiel** (`data/tanks.json:types`,
  `data/difficulty.json:danger`) — bestand nur noch aus
  `bounceDamageTakenMult`, ohne Bandenschuss bedeutungslos.
  `data/difficulty.json: bankshotGuarantee` (seit UMBAUPLAN-LP Phase 8
  ohnehin No-op) samt auswertendem Mechanismus `run.js:
  ensureBankshotEnemy()` restlos entfernt.
- **Spiegelwand-Erzeugung war AKTIV, nicht tot** — eine echte Korrektur des
  Phase-0-Ist-Abgleichs: `generator.js: placeReflectWalls()` platzierte bei
  **jedem** generierten Kampfraum 2–4 Spiegelwände am Außenrand
  (`data/tiles.json: mirror.min/maxPerRoom`); Phase 0 hatte nur die
  statischen Arena-Dateien auf das Zeichen `'r'` geprüft (0 Vorkommen dort,
  korrekt), nicht den Generator-Code, der es zur Laufzeit selbst einsetzt.
  Jetzt entfernt: `placeReflectWalls()`, der `mirror`-Config-Block aus
  `tiles.json`, der Wandtyp `'r'`/`'reflect'` aus `state.js: WALL_TYPES`/
  `isSolid()` und `generator.js: hasLos()`, das Legendenkürzel `mirror` aus
  `LEGEND_TO_CELL`/`arenaCells()`. `data/arenas.json: test_arena` hatte zwei
  `M`-Zellen (Entwickler-Testarena, keine der drei Boss-Arenen nutzte das
  Kürzel) — durch normale Wände (`#`) ersetzt, sonst hätte `validateArenas()`
  das Spiel beim Start abgeschossen.
- **Zwei Raum-Modifikatoren waren ebenfalls Bandenschuss-abhängig** (beim
  Umsetzen gefunden, nicht im Phase-0-Befund): `data/modifiers.json:
  overpressure` ("Überdruck", +1 Abpraller) und `mirror_hall`
  ("Spiegelsaal", wandelte alle festen Wände in den jetzt nicht mehr
  existierenden `'reflect'`-Typ um) — beide aus dem aktiven Modifikator-Pool
  entfernt, Archiv in `archive/bandenschuss.md`.
- **`wallBounceDamageMult`-Schadensbonus entfernt** (`data/balance.json:
  bullet`, samt `_comment`): die gesamte darauf aufbauende Schadensformel in
  `state.js`s Trefferschleife ist vereinfacht — kein `abprallMult`, kein
  `shooterBounceBonus` (Signaturkarten-Felder `bounceDamageBonus`/
  `bounceRampPerBounce`/`critOnBounce` werden nicht mehr ausgewertet, s. u.).
- **Trickshot-Belohnung (der einzige Belohnungsmoment des alten Spiels)
  vollständig entfernt**: `balance.json: trickshot`, `state.trickshotTimer`/
  `trickshotScrap`, der ganze Rückmeldungsblock in `state.js`s
  Trefferschleife, `run.js`s Zeitlupen-Kombination und Schrott-Sync. Sound
  `'trickshot'` (ohne "2") ohne verbleibende Push-Stelle entfernt,
  `'trickshot2'` bleibt (Generator-Zerstörungs-Feedback). **Phase 2 baut den
  Ersatz** (Flanken-/Heck-Treffer-Rückmeldung) in der nächsten Sitzung.
- **`cfg.ricochets` als Konzept vollständig entfernt** — aus `resolveCfg()`
  und aus jeder Karten-/Modifikator-Anwendungsstelle in `cfg.js`
  (`abpraller`, `streuschuss`, `scharfschuetze`, der generische
  `ricochetAdd`-Kern-Schlüssel, `overpressure`). Betroffene Karten
  (`data/upgrades.json` bleibt bis Phase 4 unangetastet, s. Auftrag) und die
  Klasse `c_ricochet` (Abprallpanzer) sind dadurch bis zu ihrem jeweiligen
  Neubau ohne Wirkung/Identität — akzeptierter Zwischenzustand.
- **Telemetrie**: `state.ricochetKills`/`directKills` und
  `trefferMeta.bulletRicochets` entfernt (wären für immer 0 bzw. bedeutungs­
  los gewesen) — `main.js`, `telemetry.js` (`recordRoom`/`computeMetrics`/
  Debug-Ansicht „Abpraller-Kills") entsprechend bereinigt. `hud.js`s
  Werte-Anzeige verliert die „Abpraller"-Zeile.
- **RNG-Determinismus bewusst NICHT rückwärtskompatibel**: `placeReflectWalls()`
  verbrauchte bei jedem Raumaufbau reichlich RNG aus dem `rooms`-Strom (ein
  Fisher-Yates-Shuffle über ~68 Randzellen); `ensureBankshotEnemy()` einen
  Wurf aus `enemies` ab Raum 6. Ihr Wegfall verschiebt nachfolgende Zufalls­
  ziehungen desselben Raums gegenüber alten Seeds — erwartet und vom Auftrag
  gedeckt (ein Run mit gleichem Seed bleibt weiterhin **in sich** deterministisch,
  nur nicht mehr identisch zum Vor-Phase-1-Stand).
- **Tests**: `tests/regression.mjs` — Abschnitt 12 ("Abprall-Bonus") komplett
  archiviert; die Bandenschuss-Teilprüfungen in den Abschnitten zu Phase 6
  (Schadenstypen), Phase 7 (Krit-Umbau), Phase 8 (Altlasten), Phase 9
  (Klassen), Phase 11 (Physisch-Topf), Phase 18 (Signaturtopf Standard) und
  Phase 24 (Signaturtopf Abprallpanzer) sind archiviert, die jeweils
  bandenschuss-**unabhängigen** Prüfungen derselben Abschnitte bleiben
  scharf. Abschnitt 7c (Bankshot-Gegner-Frame-Budget) ist zu einem
  schlichten „feuert t_green überhaupt"-Nachweis reduziert (Phase 3 baut
  ihn zum Mörser-Test um). Ein struktureller `t_prism`-Test wurde zu einem
  „existiert nicht mehr"-Nachweis umgedreht. **Kein Abschnitt umnummeriert**
  — archivierte Abschnitte behalten ihre alte Nummer mit Archivvermerk,
  passend zu Querverweisen in anderen Kommentaren/CLAUDE.md.
- **Kein `sw.js`-Bump**: reine Code-/Datenänderung ohne neue/geänderte
  Asset-Dateien, network-first liefert online sofort den neuen Stand
  (Konvention aus den LP-Umbau-Phasen, die ebenfalls nicht bumpten).
- Playwright-Smoke bestätigt: Raumvorschau und laufender Kampf rendern
  fehlerfrei, die Ziellinie ist eine gerade Linie bis zur ersten Wand, keine
  Konsolenfehler. `tests/uilayout.mjs`/`viewport.mjs`/`fogperf.mjs`/
  `gamepad.mjs`/`music.mjs` bleiben grün.

### Grundsteinumbau v3 — Phase 2 (Kampfkern: treffen, töten, spüren) — gemergt
Der eigentliche Ersatz-USP für den in Phase 1 entfernten Bandenschuss:
Flanken-/Heckschaden über die Wannen-Ausrichtung statt Vorhaltefrust, eine
Exekutionsschwelle für einen klaren Abschlussmoment, Treffer-Rückmeldung als
Ersatz für den alten Trickshot-Moment.
- **Kugeltempo 200→450** (`balance.bullet.speed`): senkt die nötige
  Vorhaltung gegen 40–140-px/s-Gegner von 12–44° auf 5–18°. **Gegnerraketen
  300→210** (`tanks.json: bulletSpeeds.rocket`) — schneller als eine
  Gegnerkugel (130), langsamer als die neue Spielerkugel: ausweichbar, aber
  drängend.
- **Flanken-/Heckschaden** (`data/balance.json: flank`, `sideArcDeg 110`/
  `rearArcDeg 70`/`sideMult 1.5`/`rearMult 2.5`): neue Funktion
  `armor.js: flankZone(tank, bx, by, flank)` misst den Einschlagwinkel
  relativ zur **Wannen-Ausrichtung** (`heading`, nicht Turm — Entscheidung
  B: am Turm gemessen wäre das Heck praktisch nie treffbar, weil Türme das
  Ziel verfolgen), über dieselbe `angleDelta()`-Hilfsfunktion wie
  `armorBlocks()` (jetzt exportiert statt dupliziert). Heck zählt zuerst
  (Priorität bei überlappenden Konfigurationswerten), dann je eine
  Seitenkeule links/rechts um die Querachse, der Rest ist Front (×1). Bei
  den Standardwerten deckt das den Kreis exakt ohne Lücke/Überlappung
  (70 + 2×110 + 70 = 360). Gilt **nur gegen normale Gegner + Elites**
  (Entscheidung C — Bosse behalten ihre eigene Panzerungslogik, der Spieler
  ist selbst nie Ziel). `t_armored` behält zusätzlich seine reflektierende
  Front — Panzerung und Flankenmultiplikator widersprechen sich nicht: von
  vorn prallt ab, von der Seite/hinten greift der neue Multiplikator.
- **Exekutionsschwelle** (`balance.json: execute`, `thresholdPct 0.35`/
  `slowMult 0.6`/`smokeIntervalS 0.35`): ein Gegner unter der Schwelle
  raucht sichtbar (`state.js`s Timer-Schleife spawnt Partikel im Takt),
  fährt mit `slowMult` (`tank.js: moveTank()`, neuer `execSlow`-Faktor), und
  **jeder** Treffer tötet ihn ab da garantiert — unabhängig vom Schaden.
  `t.executing` wird einmal pro Tick **vor** der Trefferverarbeitung
  gesetzt (Timer-Schleife in `stepState()`), `applyDamage()` liest das Flag
  nur noch an den beiden Stellen, an denen wirklich abgezogen wird (normaler
  Pfad + der `overTime`-Zweig für Statuseffekt-Ticks) — **nach** allen
  Abwehr-Gattern (Schilde/Boss-Unverwundbarkeit), nicht davor: ein Schild
  soll einen Gegner unter der Schwelle weiterhin retten können, wenn er den
  Treffer voll abfängt. Der Schaden wird dabei **immer** normal abgezogen
  (hp bleibt eine ehrliche Zahl, auch negativ/„Overkill" möglich) — nur der
  **Tod selbst** ist garantiert, unabhängig davon, ob der Abzug allein dafür
  gereicht hätte. Bosse und der Spieler sind ausgenommen (Entscheidung C).
  Die 35-%-Schwelle spart laut Entscheidung D bei den aktuellen LP-Werten
  mathematisch fast nie einen echten Treffer — ihr Wert ist die
  **Lesbarkeit** (ein rauchender Gegner ist ein sichtbares „noch ein
  Treffer").
- **Treffer-Rückmeldung** (Ersatz für den alten Trickshot-Moment):
  Seiten-/Heck-Treffer zeigen den Faktor als schwebenden Kurztext
  („Seite ×1.5"/„Heck ×2.5") am Einschlagpunkt (`state.texts`); ein
  **Heck-Kill** löst eine kurze Zeitlupe aus (`state.rearKillTimer`,
  `balance.json: killFeedback.slowMoS/slowMoScale`) — dieselbe
  dt-Skalierungstechnik wie der alte Trickshot, in `run.js: stepRun()`
  kombiniert mit der Taktiker-Transformations-Zeitlupe (stärkerer/kleinerer
  Faktor gewinnt); ein **Exekutions-Kill** löst stattdessen einen kräftigeren
  Einschlag aus (zusätzlicher Screenshake + eigener Partikelstoß in
  `killTank()`, gated auf `tank.executing`). Der Krit (Phase 7) hat seit
  jeher eigene Rückmeldung (Ton/Shake/Text am Schützen) und wurde nicht
  angefasst.
- **Vorhaltemarkierung** (`effects.js: drawLeadMarkers`, Schalter
  `data/options.json: leadMarker` + `#optLead`-Checkbox, Muster wie
  `aimLine`): auf jedem bewegten (`|v| > 4 px/s`), lebenden Gegner ein
  kleiner Ring+Kreuz an der Position, an der er beim Einschlag einer JETZT
  abgefeuerten Kugel wäre — eine iterative Näherung über drei Schritte
  (Distanz/Kugeltempo), keine Zielhilfe, kein Einrasten. Nutzt `t.vx/t.vy`
  (schon seit `moveTank()` gepflegt), keine neuen Felder nötig.
- **Telemetrie** (Entscheidung I: erst messen, dann an LP/Balance-Werte
  gehen — die schnellere Kugel + der Flankenbonus + die Exekution können die
  Gegner spürbar weicher machen): drei neue Felder pro Raum, `shotsFired`
  (= `state.playerShots`, gab es schon), **neu** `shotsHit`
  (`state.playerHits`, zählt nur Treffer auf Panzer, keine Fehlschüsse an
  die Wand) und `magBlockedTime` (Sekunden, in denen ein gehaltener
  Feuerbefehl **wirklich** am vollen Magazin scheiterte — bewusst NICHT das
  normale Nachladen, das ist übliche Kadenz, keine Blockade). Debug-Ansicht
  zeigt „Trefferquote X % · Magazin blockiert Ø Ys/Run" zusätzlich zur
  minFps-Zeile. `tank.js: liveBulletsOf()`/`magazineOf()` sind dafür
  exportiert statt ein zweites Mal dupliziert.
- **Entscheidung G bestätigt**: bei 450 px/s lebt eine verfehlte Kugel nur
  noch ~2,7 s statt ~6 s (`maxDistance` unverändert) — die 5er-
  Magazin-Sperre wird dadurch seltener, ohne dass `magBlockedTime`
  selbst als Test dafür gebraucht wird (das Feld misst nur, es steuert
  nichts).
- **Card-Auswirkung**: `data/upgrades.json` blieb unangetastet (Phase 4
  archiviert den ganzen Kartenpool ohnehin), zwei Karten mit eigenem
  Execute-artigen Mechanismus (`phys_fangschuss`: `executeThreshold`/
  `executeMult`, `phys_kopfschuss`: `critExecute`) bleiben als **separate,
  card-lokale** Multiplikatoren bestehen — sie kollidieren nicht mit der
  neuen globalen Exekutionsschwelle (unterschiedliche Variablen im Code),
  wirken bei Ziel unter Schwelle aber ohnehin nur noch als Nebeneffekt eines
  bereits garantierten Kills.
- **Neuer Testabschnitt 47** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt bestanden — je einzeln absichtlich rot gemacht: Flankenmultiplikator
  entfernt, Bossausnahme (Flanke UND Exekution) entfernt, hp-Abzug beim
  Exekutions-Kill wieder eingefroren, Exekutions-Verlangsamung entfernt,
  Heck-Kill-Timer-Zuweisung entfernt, `run.js`-dt-Skalierung entfernt,
  `magBlockedTime`-Zählung entfernt, Heck-vor-Seite-Priorität in `flankZone()`
  vertauscht): Struktur (neue Balance-Werte), `flankZone()`-Geometrie mit
  EIGENEN Zahlen (nicht 110/70/1,5/2,5) inkl. Prioritäts-Nachweis bei
  überlappenden Bögen, Schadensmultiplikation Ende-zu-Ende mit den ECHTEN
  balance.json-Werten (front/side/rear + Bossausnahme), Spieler nie Ziel des
  Flankenschadens, Exekutionsschwelle mit EIGENEM `thresholdPct` (über/unter
  der Schwelle, Bossausnahme, Spielerausnahme, hp bleibt korrekt abgezogen),
  Exekutions-Verlangsamung in `moveTank()` mit EIGENEM `slowMult`,
  Heck-Kill-Timer nur bei echtem Heck-Kill (nicht Front-Kill), `run.js`s
  dt-Skalierung mit EIGENEM `slowMoScale` (nachgewiesen über `run.playTime`),
  `playerHits` zählt keine Fehlschüsse, `magBlockedTime` zählt nur echte
  Blockade (nicht normales Nachladen). Ein Testfund unterwegs: die zahlreichen
  bestehenden „isolierter Treffer"-Testhelfer (Kritumbau, Schadenstypen,
  Physisch-/Frost-Topf, Seelensog) platzierten ihre Testkugel exakt auf der
  Zielposition (`toBullet = atan2(0,0) = 0`) — ohne festgehaltene
  `heading`/`role: 'guardian'` driftete die von der echten Gegner-KI gesetzte
  Ausrichtung zufällig in die Seiten-/Heckzone und verfälschte zwölf
  Bestandstests mit dem neuen Flankenmultiplikator (z. B. „Splittergeschoss
  63 statt 25"). Fix: `heading: 0` + `role: 'guardian'` (bewegt sich nie) an
  allen betroffenen Testhelfern.
- Playwright-Smoke bestätigt: Raum rendert fehlerfrei, die Vorhaltemarkierung
  erscheint sichtbar auf einem bewegten Gegner, keine Konsolenfehler.
  `tests/uilayout.mjs`/`viewport.mjs` bleiben grün; `tests/fogperf.mjs`
  bleibt im dokumentierten Sandbox-Rauschband um das 6-ms-Budget (mehrfach
  gemessen 4,2–6,2 ms p90, unverändert seit vor dieser Phase).
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  **Nächste Sitzung: Phase 3** (Der Grüne wird Mörserschütze).

### Grundsteinumbau v3 — Phase 3 (Der Grüne wird Mörserschütze) — gemergt
`t_green` bekommt seine Deckungsbrecher-Rolle zurück — mit Bogen statt
Bande. Neues Modul **`src/game/mortar.js`** (Muster wie `mine.js`/`trap.js`):
`fireMortar()`/`updateMortars()`, neues `state.mortars`-Array.
- **Keine physische Kugel**: `fireMortar()` legt einen Eintrag in
  `state.mortars` an (`x0/y0` Abschussort, `tx/ty` Zielort, `age`,
  `flightTimeS`) statt eine `createBullet()`-Kugel in `state.bullets` zu
  erzeugen. Dadurch greifen Deflektor und Frontpanzerung (die beide nur
  `state.bullets` lesen) **automatisch** nicht — kein Sonderfall im
  Trefferpfad nötig, „nicht reflektierbar" ergibt sich rein aus der
  Architektur.
- **Ziel = Spielerposition beim Abschuss + Vorhalteanteil**:
  `tx = p.x + p.vx * (flightTimeS * leadPct)` — bei `leadPct: 0.4`
  entkommt ein Teil der Spielerbewegung dem Wurf (kein perfektes
  Vorhaltezielen wie bei `t_black`). `resolveTarget()` (Upgradepool-v2
  Phase 5) liefert dasselbe Ziel wie die Turmausrichtung — kann auch ein
  Geist sein.
- **Magazin/Nachladen bleiben wie beim alten Raketenwerfer** (`magazine: 2`,
  `fireRate: 2`), aber `fireMortar()` muss sie **selbst** durchsetzen
  (`tank.cooldown > 0` blockt, `tank.cooldown = tank.cfg.fireCooldown` nach
  dem Schuss, ein eigenes `liveMortarsOf()` zählt gegen `state.mortars`
  statt `tank.js: liveBulletsOf()` gegen `state.bullets`) — `roleTurret()`
  entscheidet nur noch, OB gefeuert werden soll, nicht mehr WIE.
- **`minRangePx`-Gate in `ai_turrets.js: roleTurret()`**: eine einzelne neue
  Zeile ganz am Ende, nur für `cfg.weapon === 'mortar'` — unter der
  Mindestdistanz feuert der Grüne nicht (sonst bombt er sich selbst weg).
  Die bestehende Sichtlinien-/Kegel-Prüfung (`accuracy: 0.9` verlangt schon
  freie Sicht) bleibt unverändert die „Sichtlinie im Moment des Abschusses"-
  Bedingung aus dem Auftrag — kein zweiter Mechanismus nötig.
- **Einschlag über den vorhandenen Helfer** `mine.js: explodeAt()` (Radius/
  Schaden/Besitzer aus `balance.mortar`) — läuft nach Ablauf der Flugzeit in
  `updateMortars()`. Kennt keine Sichtlinien-/Wandprüfung für den
  Explosionsschaden selbst (wie bei Minen schon immer), die Granate wirkt
  dadurch automatisch **über jede Wand hinweg**, ohne dass Phase 3 daran
  etwas bauen musste. Explosionen ignorieren wie überall die Panzerung —
  der Mörser trifft auch den Gepanzerten von vorn, passend zur Rolle.
  Eigenbeschuss der KI-Seite ist erlaubt (`spare: null`).
- **Telegraf** (`effects.js: drawMortars()`, **immer sichtbar, kein
  Schalter** — Fairness-Regel des Auftrags): gestrichelter Umriss zeigt
  sofort den vollen Explosionsradius, eine gefüllte Fläche wächst mit der
  verstreichenden Flugzeit, ein kleiner dunkler Schatten deutet die Granate
  im Flug an (linear vom Abschuss- zum Zielort interpoliert — kein
  physischer Bogen, die Granate fliegt ohnehin „über" jede Wand, eine
  Höhensimulation wäre hier ohne Mehrwert).
- **Balance-Block `data/balance.json: mortar`** (`flightTimeS: 1.1`,
  `radiusPx: 44`, `damage: 25`, `leadPct: 0.4`, `minRangePx: 96`) — alle
  Werte laut Auftrag `_todo: balance`, noch nicht am Spielgefühl geprüft.
  Neuer Sound `mortar_launch` (tiefer, dumpfer Abschussknall statt
  `shoot_enemy`), der Einschlag läuft über den vorhandenen `boom`-Ton aus
  `explodeAt()`.
- **`data/tanks.json: t_green`**: `weapon: "rocket"` → `"mortar"`,
  Beschreibungstext aktualisiert. `magazine`/`fireRate`/`accuracy`
  unverändert.
- **Neuer Testabschnitt 48** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt bestanden — je einzeln absichtlich rot gemacht: `minRangePx`-
  Gate entfernt, Vorhalteberechnung entfernt, Magazin-Deckel entfernt,
  Cooldown-Zuweisung entfernt, Explosions-Auslöser künstlich verzögert,
  Filter für explodierte Granaten entfernt, Wandschutz künstlich eingebaut,
  ein echtes `createBullet()` künstlich in `state.bullets` eingeschleust):
  Struktur (`t_green.weapon`, Magazin/Nachladen unverändert,
  `balance.mortar` vollständig), `fireMortar()`-Mechanismus mit EIGENEN
  Zahlen (Vorhalteziel, Abschussort, Cooldown-Zuweisung, Sound),
  Cooldown-/Magazin-Sperre (inkl. der Falle „eine geblockte Anfrage legt
  trotzdem eine Granate an"), `updateMortars()` explodiert nicht vor Ablauf
  der Flugzeit und erst danach über den echten `explodeAt()`-Pfad (Radius/
  Schaden/Explosions-Anzeige), Einschlagschaden ignoriert eine dazwischen-
  liegende Wand, `minRangePx`-Gate in `roleTurret()` mit EIGENEM Wert, kein
  Eintrag in `state.bullets` entsteht. Abschnitt 7c (reiner „feuert
  überhaupt"-Nachweis, seit Phase 1 ein dokumentierter Platzhalter) ist auf
  den `mortar_launch`-Sound umgestellt statt archiviert. Der Fake-Canvas-
  Renderpfadtest (Abschnitt 6d) bekommt `drawMortars` **und** — als
  Nachtrag — das in Phase 2 vergessene `drawLeadMarkers` dazu.
- Playwright-Smoke (eigens konstruierte Szene über die echten Spielmodule,
  kein Durchspielen bis Raum 5 nötig): eine Granate fliegt, `render()`
  zeichnet den Telegraphen (gestrichelter Kreis + wachsende Füllung +
  Schatten) fehlerfrei, keine Konsolenfehler.
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  **Nächste Sitzung: Phase 4** (Upgrades raus, Sockel rein).

### Grundsteinumbau v3 — Phase 4 (Upgrades raus, Sockel rein) — gemergt
Alle 251 Karten sind aus `data/upgrades.json` entfernt (Archiv aus Phase 0:
`archive/upgrades-v1.json`) und durch **fünf** neutrale, klassenunabhängige
Sockelkarten ersetzt — bewusst mager, der saubere Nullpunkt für die
künftigen Klassenpools. Alle fünf nutzen bestehende `core`-Schlüssel aus der
generischen Kernpool-Schleife (UMBAUPLAN-LP Phase 10) und brauchten deshalb
**keine** `cfg.js`-Codeänderung: `sockel_panzerung` (+15 maximale LP, Stufen
5), `sockel_motor` (Tempo +8 %, Stufen 5), `sockel_magazin` (+1 Magazin,
Stufen 3), `sockel_ladeautomat` (Nachladezeit −10 %, Stufen 5),
`sockel_ersatzpanzer` (+1 maximales und aktuelles Leben, Stufen 2). Werte
sind Startvorschläge (`_todo: balance`).
- **`sockel_ersatzpanzer` ist die einzige Ausnahme**: `core.extraLifeAdd`
  wirkt auf `run.maxLives`/`run.lives`, nicht auf ein Panzer-cfg-Feld —
  gelesen in `run.js: applyUpgradeChoice()` direkt aus
  `upgradesData.upgrades[offer.id]?.core?.extraLifeAdd`, nicht in der
  generischen cfg.js-Schleife (die kennt nur Panzer-Felder).
- **Tags bewusst NICHT identisch mit den fünf Transformations-Tags**
  (`terrain`/`mobility`/`information`/`defense`/`control`): die Sockelkarten
  tragen `health`/`speed`/`magazine`/`reload`/`stat` — sonst würde die
  Fortschrittsanzeige im Upgrade-Screen einen nie einlösbaren „3/3"-Fortschritt
  zeigen. **Transformationen sind deaktiviert**: `run.js:
  applyUpgradeChoice()` ruft `unlockTransformation()` nicht mehr auf — die
  Funktion selbst UND `data/transformations.json` bleiben unangetastet
  stehen (Wiederanschlusspunkt, `archive/systeme-v1.md` Abschnitt 1).
- **Zweitelement-System und Element-Filter sind ersatzlos entfernt**
  (`run.js`: `ELEMENTS`/`primaryElementOf`/`drawSecondElement`/`elementsOf`/
  `rerollSecondElement` gelöscht, `run.secondElement`/`elementRerolls` aus
  `createRun()`/`runSnapshot()` entfernt; `upgradepool.js`:
  `makeElementWeight()` gelöscht, `makeCombinedWeight()` delegiert jetzt nur
  noch an `makeSynergyWeight()`; `main.js`: `elementLineFor()` zeigt nur noch
  die Primärelement-Zeile, `getSecondElement`/`onRerollElement` aus dem
  Shop-Kontext entfernt — `roomscreens.js` blendet die Reroll-Sektion ohne
  den Callback automatisch aus). Der `signatureClass`-Filter in
  `buildCandidates()` bleibt als Pipeline-Baustein bestehen (aktuell
  ungenutzt, keine Sockelkarte trägt `signatureClass`).
- **Schatzkammer/Verflucht geben ein Schrottpaket statt eines Legendärs**
  (neue Funktion `run.js: grantTreasureScrap()`, `balance.json: scrap.treasure`
  = 12, `_todo: balance`): der Sockel hat keine einzige `legendary`-Karte
  mehr. `rollReward()`s `onlyRarity: 'legendary'`-Zweig bleibt **unangetastet
  im Code** als Wiederanschlusspunkt (`archive/systeme-v1.md` Abschnitt 4,
  „nicht löschen, nur umleiten") — er wird nur nicht mehr aufgerufen. Beide
  Raumtypen überspringen den Kartenscreen jetzt komplett (`afterRoomDone()`
  direkt statt `run.phase = 'upgrade'`).
- **Kein Fallback-Karten-Auffüllen mehr**: `upgradepool.js: rollOffers()`
  gibt bei erschöpftem Pool sauber ein **kürzeres** Array zurück (statt mit
  einer „+1 Leben"-Platzhalterkarte aufzufüllen), `drawOne()` gibt `null`
  zurück statt eines Fallback-Objekts. Alle Aufrufer in `run.js`
  (`rerollOffers`, `banOffer`, `buyFourthCard`, `applyUpgradeChoice`) sind
  auf diese Semantik umgestellt; `data/upgrades.json` hat kein
  `fallback`-Feld mehr. Die verbliebenen `o.fallback`-Prüfungen in
  `upgradescreen.js`/`roomscreens.js`/`main.js` sind harmloser toter Code
  (immer `undefined`/falsy) und bewusst nicht angefasst.
- **Zwei proaktive Sicherheitsnetze, über den Auftragstext hinaus** (beide
  in `archive/systeme-v1.md` als Abweichung dokumentiert): (1) der 5-Karten-
  Sockel hat nur 20 Gesamtstufen — ein hinreichend langer Run (v. a. Endlos)
  kann ihn leerziehen. Ohne Netz bliebe `run.phase` bei einem leeren
  Kartenangebot auf `'upgrade'` hängen, ohne Weiter-Knopf — dieselbe
  Fehlerklasse wie „Bugfix: Kartenscreen blockierte den Run" (s. o.). Fix:
  `stepRun()`s Belohnungsblock und `rerollOffers()` prüfen `offers.length`
  und weichen bei 0 auf `afterRoomDone()` aus, statt in die leere Kartenwahl
  zu gehen. (2) `cursed`-Räume (garantierter Affix + garantiertes Legendär im
  alten System) bekommen aus demselben Grund wie `treasure` ein Schrottpaket
  statt eines 0-Karten-Screens — der Auftragstext erwähnt nur `treasure`
  namentlich, aber `cursed` hätte sonst denselben Blocker gehabt.
- **Testsuite**: die Sektionen 18–35 (Kernpool + sechs Element-Töpfe + zehn
  Signaturtöpfe, UMBAUPLAN-LP Phasen 10–27) und 44 (Signaturtopf Nekromant,
  18 Karten) sind archiviert — sie prüften ausschließlich Struktur/Filter/
  Applier-Arithmetik der jetzt archivierten Karten-ids. Abschnitt 36 (Phase
  28) behält nur noch die kartenunabhängige Raumdauer-Schranke, die beiden
  Rarity-Verteilungsprüfungen über den echten Pool sind archiviert (der
  Sockel ist zu 100 % `common`). Mehrere Mechanismus-Tests, die bisher über
  eine echte (jetzt archivierte) Karte liefen, sind auf direkte
  cfg-Feld-Injektion bzw. eine synthetische Testkarte umgestellt (Muster:
  Konterschild-Raumkontext in Abschnitt 7b, `exclusions`-Filter in Abschnitt
  42/46, Nekromanten-Wiederkehr in Abschnitt 45) — sie bewachen weiterhin den
  ENGINE-Mechanismus, nicht die entfernte Karte. Alle 5 Seeds spielen weiter
  deterministisch bis zum Sieg (inkl. Karte/Shop/Event/Boss); `tests/
  gamepad.mjs`, `tests/music.mjs`, `tests/uilayout.mjs`, `tests/viewport.mjs`
  bleiben grün.
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  **Nächste Sitzung: Phase 5** (Klassen parken).

### Grundsteinumbau v3 — Phase 5 (Klassen parken) — gemergt
Nur noch **zwei** Klassen sind wählbar: `player` (die Nulllinie) und
`c_necro` (laufender Nekromanten-Auftrag). Die acht übrigen (`c_blast`,
`c_frost`, `c_tesla`, `c_toxic`, `c_scrap`, `c_ricochet`, `c_engineer`,
`c_flame`) sind **geparkt, nicht gelöscht** — sie tragen jetzt zusätzlich
`"enabled": false` in `data/tanks.json` (Referenz-/Backup-Kopie seit Phase 0:
`archive/klassen-v1.json`).
- **`enabled` ist ein reiner UI-Auswahlfilter, keine Engine-Sperre**:
  einzige Auswertungsstelle ist `src/main.js: playerClasses` (`t.player &&
  t.enabled !== false`) für die Knopfliste im Klassenscreen, plus derselbe
  Ausdruck als Fallback-Guard für eine gespeicherte `starterTank`-Präferenz
  (`getPref('starterTank', ...)` — ein alter Pref-Wert auf eine jetzt
  geparkte Klasse fällt beim nächsten Start auf `'player'` zurück).
  `cfg.js: resolveCfg()` liest `enabled` **nicht** — eine geparkte Klasse
  löst weiterhin korrekt auf. Das ist Absicht (Testschritt 4 des Auftrags:
  ein laufender Spielstand mit einer inzwischen geparkten Klasse muss ohne
  Fehler weiterladen) und brauchte deshalb **keine** Änderung an `cfg.js`,
  obwohl der Auftrag die Datei in seiner Dateiliste nennt.
- **Ist-Abgleich-Fund**: der Auftrag warnt vor einem „Lochgitter" beim
  Übergang von zehn auf zwei Klassen — `.classlist` (`style.css`) ist aber
  bereits ein einfaches `display:flex; flex-direction:column`, keine
  Rastergrid mit fester Spaltenzahl. Mit zwei statt zehn Einträgen wird die
  Liste dadurch einfach kürzer, kein CSS-Fix nötig (Playwright-Smoke
  bestätigt: beide Knöpfe vollständig im Bild).
- **Nichts an `preview.js`/`roomscreens.js` geändert**: beide Dateien
  lesen `starterTank`/Klassenwerte nie über eine eigene Iteration aller
  Klassen (nur punktuelle Einzel-Lookups wie `tanksData.types[type]` für
  einen bereits feststehenden Panzer) — der Auftrag nennt sie vorsorglich in
  seiner Dateiliste, ein echter Änderungsbedarf bestand dort nicht.
- **Neuer Testabschnitt 49** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt bestanden — je einzeln absichtlich rot gemacht: `enabled: false`
  bei einer der acht Klassen entfernt, `c_necro` fälschlich geparkt, eine
  Klasse komplett aus `data/tanks.json` gelöscht statt geparkt): Struktur
  (genau die acht genannten Klassen tragen `enabled: false`, `player`/
  `c_necro` nicht), der Auswahlfilter-Mechanismus selbst (wortgleich zu
  `main.js` nachgebaut, liefert exakt `[c_necro, player]`), jede geparkte
  Klasse löst weiterhin fehlerfrei in ein Spieler-cfg auf (kein
  `NaN`/Absturz), `c_necro`s Passiv (`cfg.necromancer`) ist unangetastet.
  Playwright-Smoke bestätigt zusätzlich die drei UI-Testschritte des
  Auftrags: Klassenscreen zeigt genau `player`/`c_necro`, beide Knöpfe im
  Bild, ein Run mit jeder der beiden Klassen startet und trägt die
  richtige Klasse im Snapshot, keine Konsolenfehler.
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  **Nächste Sitzung: Phase 6** (Drei Akte).

### Grundsteinumbau v3 — Phase 6 (Drei Akte) — gemergt
Aus der 16-Raum-Karte werden **drei Akte** à 16 Räume + eigenem Bossraum
(≈ 51 Räume gesamt). Jeder Akt hat einen **festen** Boss (Reaktor→Akt 1,
Spiegel→Akt 2, Phalanx→Akt 3 — weiterhin über den `t_black`-Platzhalter aus
"Bosse (Platzhalter)", unverändert), eine eigene Kartengraph-Generierung und
ein eigenes Gefahrenbudget. `data/difficulty.json` bekommt dafür einen neuen
`acts[]`-Block (`boss`/`rooms`/`bossHpMult`/`lifeReward`/`budget.base+
perRoom`, alle `_todo: balance`) und `danger.<typ>.unlockAct`+
`unlockRoomInAct` statt des alten `unlockRoom`.
- **`run.roomIndex` bleibt AKT-LOKAL** (fängt in jedem Akt wieder bei 1 an,
  bewusste Design-Entscheidung): dadurch funktionieren `hpScaling.perRoom`,
  `elite.affixRules`, `modifiers.minRoom`, `hazards.minRoom` und die
  Rarity-`rarityGates` unverändert weiter — sie staffeln sich jetzt pro Akt
  neu, passend dazu, dass auch `acts[].budget` pro Akt bei `budget.base`
  neu anfängt statt einer einzigen 51-Raum-Kurve. Eine neue, akt-*globale*
  Statistik gibt es bewusst nicht (`run.roomsCleared` zählt weiterhin über
  den ganzen Run).
- **`actRoomKey(run)`** (`run.js`, neu): `(actIndex-1)*100 + roomIndex`.
  Reiner RNG-Streaming-Fix: `makeRoomStreams()`/die KI-Seed-Ableitung
  (`hashSeed(seed, roomIndex, 'ai')`) nutzten bisher `run.roomIndex` direkt
  als Hash-Index — da der jetzt pro Akt neu bei 1 anfängt, hätten Akt-1-
  Raum-1 und Akt-2-Raum-1 sonst exakt dieselben Ströme gezogen (identisches
  Layout, identische Gegner, identische Angebote). `actRoomKey()` hält Akt
  und Raumnummer auseinander, ohne `roomIndex` selbst umzudeuten.
- **Kartengenerierung pro Akt** (`run.js: generateMap(seed, diff, actIndex)`,
  jetzt exportiert wie `upgradepool.js: weightedPick` für direkte
  Mechanismus-Tests): eigener Strom je Akt (`rngForRun(seed, 'map_act'+
  actIndex)`), gebaut beim Akt-Eintritt (`enterAct()`) bzw. beim Fortsetzen
  (`buildActMap()`, ohne die Seiteneffekte von `enterAct()` — der Snapshot
  bringt `roomIndex`/`mapCurrentId` schon mit). `doors.weights` ist zu
  `map.nodeWeights` umgezogen (`workshop` statt `shop`, s. Phase-13-
  Namenskonvention) und um `treasure` verkürzt — die Schatzkammer ist kein
  gewichteter Zufallstyp mehr, sondern **genau ein** erzwungener Knoten pro
  Akt in der Mitteltiefe (`map.treasureLayerFraction`). Harte Constraints
  (Konstanten im Code, keine Balance-Zahlen): `EARLY_EXCLUDED_TYPES`
  (elite/cursed/workshop) für die ersten drei Ebenen, die letzte Ebene vor
  dem Boss ist komplett `'rest'` erzwungen (STS-Konvention), die Ebene davor
  darf selbst kein zufälliges `'rest'` ziehen (sonst wäre die Naht zur
  erzwungenen Rast-Ebene unvermeidbar "zwei in Folge"), eine Reparatur-Passage
  nach dem Kantenaufbau färbt jedes andere zufällig entstandene
  "Rastplatz→Rastplatz" um.
- **Echter Testfund beim Bau der Schatzkammer-Regel**: der alte
  Sackgassen-Schutz aus Phase 12 ("führen ALLE Kanten eines Knotens
  ausschließlich zu Schatzkammern, färbe die erste Alternative um") war für
  ein System mit *vielen* zufällig verteilten Schatzkammern geschrieben —
  dort war "die erste Alternative" fast nie die Schatzkammer selbst. Mit
  **genau einem** Schatz-Knoten pro Akt ist "die erste Alternative" eines
  Knotens mit nur einer Kante aber sehr oft GENAU der Schatz-Knoten, und der
  alte Schutz hat ihn dann auf `combat` umgefärbt — der Akt hatte danach
  **null** Schatzkammern. Gemessen: 47 von 75 Seed/Akt-Kombinationen
  betroffen (60er-Bereich), nicht "selten". Fix: der Sackgassen-Schutz färbt
  nicht mehr um, sondern gibt dem betroffenen Knoten eine zusätzliche Kante
  zu einem Geschwisterknoten derselben Ebene (Fluchtweg statt Farbwechsel) —
  der Schatz-Knoten bleibt garantiert bestehen. Ohne den neuen Testabschnitt
  50(e) (Gegenprobe siehe unten) wäre das unbemerkt geblieben.
- **Fester statt zufälliger Boss**: `buildCombatRoom()` liest `actCfg.boss`
  direkt (kein `run.rng.enemies()`-Wurf mehr) — `diff.finalRoom.bosses`
  (Array mit Zufallsauswahl) ist entfallen, `diff.finalRoom.supportBudget`
  bleibt global (gilt für alle drei Bossräume gleich).
- **`bossHpMult` wirkt bewusst auch auf den `t_black`-Platzhalter**: er trägt
  kein `isBossCfg()`-Flag (kein `bossInvincible`/`mirrorBoss`/`phalanx`),
  `hpSkipBosses` greift bei ihm also nicht — er würde sonst in jedem Akt
  gleich zäh sein. `hpScale` im Bossraum ist deshalb
  `normale Formel × (isFinal ? actCfg.bossHpMult : 1)`.
- **Der alte Lebensbonus ist abgebaut, nicht der neue "erfunden"**: Phase 0
  hatte `extraLifeEveryClearedRooms`-Entfernung schon vorab in
  `archive/systeme-v1.md` (Abschnitt 5) geplant — genau danach umgesetzt:
  das Feld bleibt unverändert in `data/difficulty.json` stehen
  (Wiederanschlusspunkt), nur der auswertende Codepfad in `run.js` ist raus.
  Ersetzt durch `acts[].lifeReward`, vergeben **nur** beim Bosskill
  (`run.isActBoss`), gedeckelt auf `run.maxLives`.
- **Akt-Übergang statt Rundenende**: `run.isActBoss` (in `startRoom()`
  gesetzt) ersetzt den alten `!run.endless && run.roomIndex >= totalRooms()`-
  Vergleich. Akt 1/2: `run.phase = 'actComplete'` (neuer Zwischenbildschirm,
  `roomscreens.js: createActCompleteScreen()`, "Akt X/3 geschafft" + Bonus),
  „Weiter" ruft `advanceAct()` → `enterAct(run, actIndex+1)`. Akt 3:
  `finishRun(run, true)` wie bisher (kein Bonus mehr, `lifeReward: 0`).
- **Rastplatz (`rest`) ist in dieser Phase bewusst ein reiner Platzhalter**
  (`roomscreens.js: createRestScreen()`, ein "Weiter"-Knopf, kein Inhalt) —
  der eigentliche Effekt (Leben zurück ODER Upgrade aufwerten) ist
  Phase 7. `startNonCombatRoom()`/`leaveRest()` sind trotzdem schon die
  vollständige Infrastruktur, Phase 7 muss nur noch den Inhalt einhängen.
- **Ist-Abgleich-Fund**: `src/core/storage.js` brauchte **keine** Änderung
  (war in der Auftrags-Dateiliste genannt) — es ist ein reiner generischer
  Key-Value-Wrapper (`saveCurrentRun`/`loadCurrentRun`), kennt keine
  Run-Feldstruktur. Der neue Snapshot-Schlüssel `actIndex` läuft einfach mit
  durch. `cfg.js` brauchte ebenfalls keine Änderung.
- **Anzeige**: HUD (`hud.js`) und Raumvorschau (`main.js`) zeigen jetzt
  „Akt X/3 · Raum N/17" statt nur „Raum N/16"; `mapscreen.js` zeigt „Karte —
  Akt X/3" in der Überschrift (der Bossknoten trägt sein Symbol bereits seit
  Phase 12/14, brauchte keine Änderung). Der „Run fortsetzen"-Knopf im
  Startmenü nennt jetzt ebenfalls den Akt.
- **Neuer Testabschnitt 50** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt bestanden — je einzeln absichtlich rot gemacht: `totalRooms()`-
  Offset, `buyEnemies()`-Freischaltungsfilter, erzwungene Rast-Ebene,
  Früh-Sperre in Ebene 3, `actRoomKey`-Trennung im Kartenlabel, Lebensbonus-
  Deckel, Akt-3-Grenze — die letzte Gegenprobe crasht sogar hart statt nur
  einen Check zu röten, das ist ebenfalls ein gültiges Rot): Struktur
  (`acts[]`, `danger.*` komplett auf unlockAct/unlockRoomInAct umgestellt),
  `totalRooms()`- und `buyEnemies()`-Mechanismus mit **synthetischen**
  Werten (nicht den echten `_todo: balance`-Zahlen), `generateMap()`-
  Graphregeln über 25 synthetische Seeds × 3 Akte (erzwungene Ebenen,
  Früh-Sperre, garantierter Rastplatz, genau ein Schatz-Knoten, keine zwei
  Rastplätze in Folge), `actRoomKey`-Stromtrennung (Akt 1 ≠ Akt 2 bei
  gleichem Seed), und ein instrumentierter End-to-End-Run: genau zwei
  Akt-Übergänge mit dem richtigen `lifeReward`-Betrag (gedeckelt auf
  `maxLives`), danach direkt `victory` ohne einen dritten Übergang.
  Playwright-Smoke bestätigt zusätzlich: die Raumvorschau zeigt „Akt 1/3 ·
  Raum 1/17", Fortsetzen über einen Reload trägt `actIndex` korrekt weiter,
  keine Konsolenfehler.
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).

### Grundsteinumbau v3 — Phase 7 (Rastplatz und Aufwertung) — gemergt
Der Rastplatz wird ein Raum mit echter Entscheidung, und ein neues
Stufen-System wertet vorhandene Karten auf, statt nur neue zu sammeln.
- **Zwei Optionen, eine Wahl** (`roomscreens.js: createRestScreen()` komplett
  neu, ersetzt den Phase-6-Platzhalter): **Reparaturtrupp** (+1 Leben,
  gedeckelt auf `run.maxLives`, bei vollem Stand ausgegraut statt versteckt
  — Auftrag: „der Spieler soll die Regel lernen") und **Werkbank** (eine
  besessene Karte eine Stufe aufwerten). Anders als der Shop gibt es **kein**
  drittes „Verlassen" — die gewählte Aktion (`run.js: repairAtRest()`/
  `upgradeCardAtRest()`) ruft selbst `afterRoomDone()` auf und beendet den
  Raum sofort (Testschritt 1). Beide Funktionen geben `false` zurück, wenn
  die Aktion ungültig ist (volle Leben bzw. Karte am Deckel/nicht besessen/
  `upgradable:false`) — der Screen bleibt dann offen (Muster: `mapscreen.js`,
  schliesst sich nur bei Erfolg).
- **Stufen-System** (`run.upgradeLevels`, {id: stufe ≥ 0}, im Snapshot):
  getrennt von `run.upgrades` (Stapelzahl) — eine Karte kann mehrfach
  gezogen UND separat aufgewertet sein. `data/balance.json: upgradeLevel`
  (`bonusPct: 0.5`, `maxLevel: 2`, `_todo: balance`).
- **`cfg.js: applyUpgrades()` skaliert die `core`-Effekte generisch**, ohne
  die ~100-zeilige Kernschleife selbst anzufassen: eine neue `scaleCore()`
  ersetzt `U[id].core` durch eine skalierte Kopie, BEVOR die bestehende
  Schleife sie liest (`const c = scaleCore(raw, stufeMultFor(id))` statt
  `const c = U[id].core`) — der Rest der Schleife (alle ~50 `if (c.xyz)`-
  Zweige) ist unverändert. Additive Schlüssel (Suffix `Add`/`Bonus`) werden
  direkt mit `1 + stufe*bonusPct` skaliert; multiplikative (Suffix `Mult`)
  skalieren nur die **Abweichung von 1** (`1 + (v-1)*sm`) — ein 1,08×-Effekt
  wird bei Stufe 1 zu 1,12×, nicht zu 1,62×, sonst wäre eine Stufe bei
  Prozentkarten unverhältnismässig stärker als bei Fixwert-Karten. Bekannte,
  bewusste Ausnahme: `shatterMult` (Frost-Topf, archiviert) endet auf
  „Mult", wird im Code aber **additiv** verrechnet — von der Namens-basierten
  Erkennung explizit ausgenommen. Schlüssel ohne Add/Bonus/Mult-Suffix
  (Schwellen/Maxima/Booleans wie `magazineFixed`, `executeThreshold`,
  `ghostCommander`) bleiben unskaliert — ein Stufen-Bonus auf einen
  Deckelwert bräuchte Karten-eigene Semantik, keine generische Regel.
  **Nur die vier aufwertbaren Sockelkarten sind aktuell erreichbar** (alle
  vier korrekt erfasst: `hpAdd`/`speedMult`/`magAdd`/`reloadMult`) — die
  ~50 übrigen, archivierten `core`-Schlüssel (Signaturtöpfe etc.) laufen
  durch dieselbe generische Regel, sobald sie dereinst zurückkehren, ohne
  dass Phase 7 sie einzeln geprüft hätte.
- **Magazin/Minenzahl werden nach der Skalierung gerundet**
  (`cfg.magazine = Math.round(cfg.magazine)`, ebenso `cfg.mines`) — ein
  `magAdd: 1` wird bei Stufe 1 (`bonusPct 0.5`) sonst zu `1.5`, ein
  fraktionales Magazin ergäbe keinen Sinn.
- **`sockel_ersatzpanzer` ist NICHT aufwertbar** (`"upgradable": false`,
  neues, generisches Opt-out-Feld) — „ein halbes Leben existiert nicht".
  `stufeMultFor()` liefert für eine solche Karte immer 1 (Stufe wird
  ignoriert), `workbenchOptions()`/`upgradeCardAtRest()` filtern/
  verweigern sie zusätzlich auf der Raum-Ebene.
- **„+"-Suffix je Stufe am Kartennamen**, „im Angebot wie in der
  Inventarliste" (Auftrag): `main.js` hängt beim Aufruf von
  `upgradeScreen.show()`/`workshopScreen.show()` ein `stufe`-Feld an jedes
  Angebotsobjekt (`o.stufe = run.upgradeLevels[o.id] || 0`, eine neue
  gemappte Kopie — `run.pendingOffers`/`run.shopOffers` selbst bleiben
  unangetastet, `onPick`/`onBan`/`onBuyCard` indizieren weiterhin direkt
  hinein) und ebenso in der `preview.js`-Ausrüstungsliste. Die drei
  Renderstellen (`upgradescreen.js`, `roomscreens.js: renderCards()`,
  `preview.js: showUpgradePage()`) hängen `'+'.repeat(stufe)` an den Namen
  — getrennt von der bestehenden „Stufe N"-Anzeige (die zählt Kartenstapel,
  nicht die Rastplatz-Aufwertung).
- **Sicherheitsnetz gegen eine ausweglose Wahl** (echter Testfund, nicht im
  Auftrag vorhergesehen): `rest` ist seit Phase 6 ein normal gewichteter
  Kartenknotentyp (`data/difficulty.json: map.nodeWeights`, nicht nur die
  erzwungene Vor-Boss-Ebene) und kann mehrfach pro Akt auftauchen, während
  `maxLevel × aufwertbare Kartenzahl` begrenzt ist (aktuell 2×4 = 8
  Stufen-Slots) — bei vollen Leben UND keiner aufwertbaren Karte (alle am
  Deckel oder noch keine besessen) wäre der Raum ein Screen ganz ohne
  mögliche Wahl gewesen. `startNonCombatRoom()`s `rest`-Zweig prüft das
  jetzt VOR dem Setzen von `run.phase = 'rest'` und zieht bei Bedarf über
  `afterRoomDone()` automatisch weiter — dieselbe Fehlerklasse wie der
  frühere Kartenscreen-Blocker (s. CLAUDE.md weiter unten). **Ohne dieses
  Netz hängt die 5-Seed-Regressionssuite nachweislich** (Seed 42 blieb in
  Phase „rest", Raum 14, fest — per Gegenprobe bestätigt, nicht nur
  behauptet).
- **`leaveRest()` ist ersatzlos entfernt** (keine dritte Aktion mehr) —
  `tests/regression.mjs`s Playthrough-Schleifen riefen es an sechs Stellen
  auf; ein neuer Testhelfer `passRest(run)` (Reparatur zuerst, sonst die
  erste aufwertbare Karte) ersetzt es dort einheitlich.
- **Neuer Testabschnitt 51** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt bestanden — je einzeln absichtlich rot gemacht: Mult-Skalierung
  entfernt, Add/Bonus-Skalierung entfernt, `upgradable:false`-Ausnahme
  entfernt, Stufen-Deckel in `stufeMultFor()` entfernt, `repairAtRest()`s
  Lebensdeckel entfernt, `workbenchOptions()`s Deckel-/upgradable-Filter
  entfernt, `upgradeCardAtRest()`s Deckel-Prüfung entfernt,
  `runSnapshot()`s `upgradeLevels`-Feld entfernt, das Sicherheitsnetz selbst
  entfernt): Struktur (`balance.upgradeLevel`, `upgradable`-Feld auf den
  fünf Sockelkarten), Skalierungsmechanismus mit **eigenen Zahlen**
  (synthetische Testkarte, `bonusPct 1.0` statt des echten 0,5 — Stufe 2
  verdreifacht den additiven Effekt, ein 1,1×-Multiplikator wird zu 1,3×
  nicht 1,331×, Deckel-Klemmung bei Stufe 99), Testschritte 1–5 wörtlich
  (Reparatur mit fehlendem/vollem Leben, `sockel_motor`-Aufwertung ist
  messbar schneller, Snapshot/Fortsetzen erhält Stufe UND Wirkung im
  aufgelösten cfg, Werkbank-Liste verliert eine Karte am Deckel und zeigt
  `sockel_ersatzpanzer` nie), plus das Sicherheitsnetz (ein Elternknoten
  eines garantiert erreichbaren `rest`-Knotens wird direkt angesteuert,
  ohne einen kompletten Kampf zu simulieren — `chooseMapNode()` prüft nur
  „ist die Ziel-id in `current.next`", nicht wie der Spieler dorthin kam).
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).

### Grundsteinumbau v3 — Phase 8 (Shop überarbeiten) — gemergt
Der Shop war auf 246 generische Karten und sechs Schadenstypen ausgelegt —
beides gibt es seit Phase 4/1 nicht mehr. Kleinere Auffrischung statt Umbau.
- **`shop.cardChoices` 5 → 4** (`data/balance.json`) — der 5-Karten-Sockel
  füllte ein 5er-Regal ohnehin fast immer komplett, vier Slots reichen.
- **Neue Werkbank-Aktion im Shop**: dieselbe Aufwertung wie am Rastplatz
  (Phase 7), hier gegen Schrott statt kostenlos, und **ohne** den Raum zu
  beenden (man bleibt im Shop wie bei jeder anderen Aktion dort). Der
  gemeinsame Kern ist jetzt **eine** Funktion: `run.js: raiseUpgradeLevel()`
  prüft Besitz/Deckel/`upgradable`, `upgradeCardAtRest()` (Rastplatz, Phase 7)
  und das neue `buyShopUpgradeLevel()` (Shop, gegen `scrap.cost.upgradeLevel`,
  Vorschlag 6) rufen sie beide auf — nur Kosten und Raumfluss unterscheiden
  sich. Die Karten-Vorschauliste selbst ist ebenfalls jetzt **eine**
  Funktion: `restWorkbenchOptions()` ist zu `workbenchOptions()`
  umbenannt (Rastplatz UND Shop nutzen dieselbe Filterliste — besessen,
  nicht `upgradable:false`, unter `maxLevel`).
- **Echter Fund beim Nachbau von Testschritt 4**: der Lebenskauf im Shop
  (`buyShopLife()`, seit Phase 13) kannte bisher **keinen** `maxLives`-Deckel
  — nur die Einmal-pro-Besuch-Sperre. Der Auftrag verlangt ausdrücklich
  „gedeckelt auf `maxLives`" (Abschnitt „Angebot neu") und Testschritt 4
  („Leben bei vollem Stand kaufen wollen — gesperrt") hätte das sofort
  aufgedeckt. Jetzt behält `buyShopLife()` denselben Deckel wie
  `repairAtRest()` am Rastplatz; die UI zeigt „+1 Leben (Leben bereits
  voll)" ausgegraut statt versteckt (`ctx.atFullLives()`, Muster wie der
  Reparaturtrupp-Knopf).
- **„Raus": Element neu würfeln.** Der Preis (`scrap.cost.rerollElement`)
  war bereits mit dem Zweitelement-System (Grundsteinumbau Phase 4)
  archiviert (`archive/systeme-v1.md`, Abschnitt 2) — ein **letztes totes
  Fragment** stand aber noch in `roomscreens.js: createShopScreen()` (ein
  `if (ctx.onRerollElement)`-Zweig, der seit Phase 4 nie mehr auslösen
  konnte, weil `main.js` diese Felder nicht mehr setzt). Jetzt entfernt,
  Archiv-Eintrag um einen Nachtrag ergänzt.
- **Entfernen/Schild/Gadget/Leben bleiben unverändert** (Auftrag: „wie
  bisher") — reine Bestandsfunktionen, keine Änderung nötig.
- **Neuer Testabschnitt 52** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt bestanden — je einzeln absichtlich rot gemacht:
  `buyShopUpgradeLevel()`s Kostenprüfung/-abzug entfernt, `buyShopLife()`s
  neuer `maxLives`-Deckel entfernt, `shop.cardChoices` probeweise auf 3
  gesetzt): Struktur (`cardChoices` 4, `cost.upgradeLevel` vorhanden),
  Testschritte 1–5 wörtlich über einen **echten** Shop-Besuch (Kartengraph
  direkt angesteuert, kein Kampf simuliert, Muster wie das
  Phase-7-Sicherheitsnetz) — genau `cardChoices` Karten im Regal, Werkbank
  hebt die Stufe und zieht exakt den Preis ab und lässt den Raum offen, 0
  Schrott lässt keine Aktion durch und stürzt nicht ab, ein Lebenskauf bei
  vollen Leben wird abgelehnt, zwei verschiedene Shop-Besuche im selben Run
  liefern unterschiedliche Regale (deterministisch aus Seed+Raumnummer,
  nicht dasselbe Array).
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).

### Grundsteinumbau v3 — Phase 9 (Kartenbelohnung neu verteilen) — gemergt
Karten nur dort, wo sie verdient sind: Kampf-, Elite- und Fluchräume geben
eine Kartenwahl, Ereignis/Shop/Rast/Schatz nicht — Ereignisse dürfen aber
eine Karte als eine Option unter mehreren anbieten.
- **Fluchräume (cursed) geben wieder eine echte Kartenwahl.** Phase 4 hatte
  `cursed` und `treasure` gemeinsam auf ein Schrottpaket umgeleitet
  (`grantTreasureScrap()`), weil der Sockel keine Legendäre mehr führte —
  eine Übergangslösung, die laut Auftrag ausdrücklich nur den Schatzraum
  betreffen sollte. `run.js`: der `if (roomType === 'cursed')`-Sonderzweig
  vor der eigentlichen Belohnungslogik ist entfernt; cursed läuft jetzt
  durch dieselbe `rollReward()`-Weiche wie ein Kampfraum (`rewardKind:
  'cursed'`, aber ohne `onlyRarity`/`bypassRoomGate`/`ignoreTagRule` — der
  legendäre Sonderpfad bleibt ausschließlich `treasure` vorbehalten, dort
  weiterhin als Wiederanschlusspunkt). `showActions` (Schrott-Aktionen im
  Upgrade-Screen) gilt jetzt auch für `cursed`, das Subtitle verliert die
  Behauptung „garantiertes Legendär" (`main.js`).
- **Ereignisse mit Kartenoption**: neuer Effekttyp `effects.card: true`
  (`data/events.json`) — zwei Bestandsereignisse erweitert
  („Feldwerkstatt"/„Wrackteile-Feld", je eine dritte Option neben den
  bestehenden zwei). `run.js: chooseEventOption()` öffnet bei dieser Option
  den normalen Angebotsbildschirm (`rewardKind: 'normal'`, dieselbe
  `rollReward()`) statt direkt weiterzuziehen — `chooseUpgrade()` beendet
  den Raum danach selbst. Läuft der Pool bei dieser Gelegenheit leer
  (Sicherheitsnetz wie beim normalen Belohnungspfad), zieht der Raum sofort
  weiter statt in einem leeren Screen hängenzubleiben. Die Event-UI
  (`roomscreens.js: createEventScreen()`) brauchte **keine** Änderung — sie
  iteriert bereits generisch über `event.options`, eine dritte Option ist
  für sie nur ein weiterer Knopf.
- **`everyNRooms` war bereits vor dieser Phase totes Datenfeld** (echter
  Fund, kein bloßes Aufräumen): `grep -rn` zeigt keine einzige Lesestelle in
  `src/`. Die tatsächliche Steuerung war schon immer strukturell — der
  `enemiesLeft === 0`-Block in `stepRun()`, der überhaupt ein Angebot
  auslöst, existiert nur für Räume, die einen echten Kampfzustand mit
  Panzern bauen (`combat`/`elite`/`cursed`, über `buildCombatRoom()`).
  Phase 9 macht diese Regel nur explizit und entfernt das nie gelesene Feld
  aus `data/upgrades.json` (Archiv: `archive/systeme-v1.md`, Abschnitt 6).
- **Die „Rechnung" aus dem Auftrag war ungefähr um den Akt-Faktor 3 zu
  niedrig** (echter Ist-Abgleich-Fund, im Testabschnitt und hier
  dokumentiert statt stillschweigend übernommen): der Auftrag schätzt „grob
  20 Kampf-, 6 Elite- und 4 Fluchknoten je Run — also 30 bis 35 Karten".
  Eine echte Messung über `generateMap()` (40 Seeds × 3 Akte, mit dem
  echten `map.nodeWeights`-Generator aus Phase 6) ergibt im Mittel
  **~51 Kampf-, ~11 Elite- und ~8 Fluchknoten — rund 70 garantierte
  Kartenräume pro vollständigem Run**, nicht 30–35. Die Auftragszahl passt
  eher zu **einem einzelnen Akt** (gemessen: ~17 Kampf-, ~4 Elite-, ~2
  Fluchknoten je Akt) — vermutlich fehlte beim Schätzen der Faktor „×3 Akte".
  Konsequenz: der 5-Karten-Sockel (20 Stufen-Slots gesamt) ist nicht erst
  „ab Mitte Akt 2", sondern schon **weit vor Ende von Akt 1** leergezogen —
  das bereits in Phase 4 proaktiv gebaute Sicherheitsnetz (leeres Angebot ⇒
  sofort weiterziehen) fängt das unverändert ab, nur der Zeitpunkt in der
  Auftrags-Beschreibung war falsch. Keine Balance-Änderung an
  `map.nodeWeights` — das war nicht Teil dieser Phase, nur die
  Angebots-**Routing**-Regel.
- **Neuer Testabschnitt 53** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt bestanden — je einzeln absichtlich rot gemacht: die
  `cursed`-Routing-Änderung auf den alten `grantTreasureScrap()`-Zweig
  zurückgesetzt, die `effects.card`-Auswertung in `chooseEventOption()`
  ausgebaut, deren Sicherheitsnetz-Zweig entfernt, `everyNRooms` probeweise
  wieder eingefügt): Struktur (`everyNRooms` entfernt, mindestens ein
  Ereignis mit Kartenoption als eine von mehreren Optionen), Testschritte
  1–5 wörtlich (Kampfraum → Angebot; Ereignis/Shop/Rast/Schatz → kein
  automatisches Angebot; Ereignis-Kartenoption → Angebotsbildschirm, danach
  normale Weiterfahrt; leergespielter Pool → Raum zieht trotzdem weiter,
  sowohl beim Kampfraum als auch bei der Ereignis-Kartenoption), dazu der
  Fluchraum-Mechanismus (`rewardKind: 'cursed'`, echte Karte) und eine grobe
  Größenordnungsprüfung der Kartenraum-Rechnung (40–100 garantierte
  Kartenräume je Run über 20 Seeds — Regressionsschutz gegen eine künftige,
  drastische Gewichtsänderung, keine exakte Zahl).
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  **Nächste Sitzung: Phase 10** (Abnahme, letzte Phase des
  Grundsteinumbaus).

### Offene Punkte / To-do (nice-to-have, nicht dringend)
- [ ] **Bosse neu ausarbeiten** (eigene künftige Aufgabe, kein Teil des
      laufenden Grundsteinumbaus): Reaktor/Spiegel/Phalanx durch `t_black`
      ersetzt (s. o.), bis ein neues Bosskonzept entsteht. Beim Neubau die
      beiden in `ARCHIV.md` dokumentierten Funde mitlösen (Reaktor-
      Generatoren brauchen aktuell einen Bankshot statt eines Direkttreffers;
      `t_mirror` hängt an `requiresRicochet`, das Grundsteinumbau-Phase 1
      entfernt).
- [ ] **`drawOne()`-Signaturkarten-Inkonsistenz (Upgradepool-v2 Phase 2)**:
      „Verbannen"/„Vierte Karte" (`run.js`) sperren beim Ersatzziehen weiterhin
      den ganzen Tag `signature` statt nur die gebannte id — banning einer von
      mehreren angebotenen Signaturkarten kann daher keine andere
      Signaturkarte als Ersatz ziehen. Kein Blocker, nur eine kleine
      Inkonsistenz zur Erstauswahl (die jetzt mehrere gleichzeitig erlaubt).
- [ ] **Controller-Feinschliff (optional)**: Der A-Knopf legt im Spiel
      weiterhin eine Bombe sofort ohne Zielen ab (`secondaryAlt`), obwohl die
      Doktrin dafür LT vorsieht — bei Bedarf entkoppeln. Kein Blocker mehr, der
      gezielte Wurf läuft jetzt über LT-Halten + rechten Stick.
- [ ] **Diskrete Overlay-Fokus-Navigation (`data-navcard`/`bothAxes`)** ist
      seit dem Gamepad-Cursor nur noch für die **Tastatur** relevant — der
      Controller nutzt den Cursor. Kann bleiben; bei einer Aufräumrunde prüfen,
      ob die `bothAxes`-Option für die Tastatur überhaupt gewollt ist.
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
- [ ] **Fünf Klassen ohne eigenes Sprite** (`c_tesla`/`c_toxic`/`c_scrap`/
      `c_ricochet`/`c_engineer`) borgen sich weiter `player` (`SPRITE_ALIAS`).
      Bei gelieferten Grafiken analog zu `c_frost` & Co. einhängen (in
      `TANK_TYPES` aufnehmen + Alias entfernen).

Wenn ein Punkt erledigt ist: Haken setzen bzw. Zeile entfernen.

## Tech / Architektur
- **ES-Module**, kein Bundler. Einstieg `src/main.js`, verdrahtet alles.
- **Fixed-Timestep-Loop** 60 Hz mit Akkumulator + Render-Interpolation (`alpha`).
  `src/core/loop.js`.
- **Deterministisch**: gesäter RNG (Mulberry32, `src/core/rng.js`). Kein
  laufender Zustand — pro Raum benannte Ströme aus `hash(seed, actRoomKey,
  label)` (`rooms`/`enemies`/`upgrades`/`scrap`/`events`/`modifiers`/
  `hazards` + `ai`). Grundsteinumbau Phase 6: `actRoomKey` (`run.js`)
  kombiniert Akt- und akt-lokale Raumnummer, weil `run.roomIndex` pro Akt bei
  1 neu anfängt — reines `roomIndex` allein würde Akt-1-Raum-1 und
  Akt-2-Raum-1 sonst identische Ströme geben. Gleicher Seed + Akt + Raumnummer
  → gleicher Raum, unabhängig vom Spielverlauf. Die Kartengraphen selbst
  kommen aus einem eigenen Strom **pro Akt** (`rngForRun(seed,
  'map_act'+actIndex)`, ersetzt den alten `doors`-Namensraum).
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
- `src/game/state.js` — `stepState`, Treffer, Minen, `killTank`.
- `src/game/armor.js` — gerichtete Panzerung (Phase 4): `armorBlocks`,
  `reflectBullet`, `isLive`. Seit Grundsteinumbau Phase 1 ist `isLive(b)`
  nur noch `!!b.reflected` (kein Bandenschuss mehr, `hasWallBounced()` ist
  entfernt). Grundsteinumbau Phase 2: `angleDelta` ist jetzt exportiert
  (gemeinsame Hilfsfunktion) und `flankZone(tank, bx, by, flank)`
  klassifiziert einen Einschlag als `'front'|'side'|'rear'` relativ zur
  Wannen-Ausrichtung — Grundlage des Flanken-/Heckschadens.
- `src/game/tank.js` — Feuern, Minen legen/werfen, `useSecondary()`
  (Phase 6: generischer Sekundärwaffen-Dispatch inkl. Enterhaken/Sperrmauer).
  `moveTank()` bremst seit Grundsteinumbau Phase 2 einen Panzer mit
  `tank.executing` (Exekutionsschwelle) über `balance.execute.slowMult`.
  `liveBulletsOf`/`magazineOf` sind seither exportiert (state.js braucht sie
  für die `magBlockedTime`-Telemetrie).
- `src/game/mortar.js` — Mörser-Waffe (Grundsteinumbau Phase 3, `t_green`):
  `fireMortar`/`updateMortars`. Kein physisches Geschoss (`state.mortars`
  statt `state.bullets`) — Deflektor/Frontpanzerung greifen dadurch
  automatisch nicht. Einschlag über den vorhandenen `mine.js: explodeAt()`.
- `src/game/ai_turrets.js` — `roleTurret()` (Phase 8: eine generische
  Funktion statt sechs benannter). Grundsteinumbau Phase 3: ein zusätzliches
  `minRangePx`-Gate ganz am Ende, nur für `cfg.weapon === 'mortar'`.
- `src/game/damagetypes.js` — Schadenstypen (Phase 6): `applyTypeEffects`
  (Statusauftrag + Blitzkette), `statusOf`, `typeColor`. Die damageType-ids
  sind absichtlich identisch mit den Statuseffekt-ids, deshalb ohne
  Zuordnungstabelle. Werte in `data/status.json: damageTypes`.
- `src/game/status.js` — Statuseffekte ueber Zeit (UMBAUPLAN-LP Phase 5):
  `applyStatus`, `updateStatus`, `statusSpeedMult`, `visibleStatus`. Ticks
  werden gezaehlt, nicht heruntergezaehlt (bildratenunabhaengig). Werte in
  `data/status.json`. Haengt bis Phase 6 an keiner Quelle — nur
  `state.applyStatus()` (Debugtasten 1/2/3 bei `?debug=1`).
- `src/game/ghost.js` — Geisterpanzer (Upgradepool-v2 Phase 7 komplett neu
  gebaut, ersetzt das Phase-5/6-Interimssystem): eigener, fester Unit-Typ
  `ghost_tank` (`data/tanks.json`) mit vom getöteten Panzer UNABHÄNGIGEN
  Basiswerten (`resolveGhostCfg()` skaliert Prozentfelder auf die
  Standardklasse `player`, nicht auf den Nekromanten selbst), kein
  Lebensdauer-Timer mehr, `killGhost()` als einziger Tod-Trichter. Zwei
  Erzeuger reichen nur noch Position/Ausrichtung durch: `state.js:
  killTank()`s Spawnwürfel und `tank.js: useSecondary()`s Geisterbombe.
  Eigenes `state.ghosts`-Array, kein Eintrag in `state.tanks` (blockiert
  keine Kugeln, zählt nicht gegen `limits.enemiesAlive`). Seit Phase 8:
  `resolveGhostCfg(data, playerCfg)` legt 16 neue `ghost*`-`core`-Schlüssel
  (aus den `sig_necro_*`-Signaturkarten, `cfg.js` sammelt sie auf dem
  Spieler-cfg) additiv/multiplikativ auf die Basiswerte; `killGhost(state, g)`
  ist der zentrale Ort für Phylakterium/Wiederkehr-Familie/Letzter Wille.
- `src/game/ai.js` — Gegner-KI-Dispatcher + Zielsystem (Upgradepool-v2
  Phase 5): `resolveTarget`/`pickTarget`/`updateTargeting`/`registerThreat`
  wählen zwischen Spieler und Geistern statt hart auf `state.player` zu
  zielen (Details im eigenen Phase-5-Abschnitt oben).
- `src/game/bossai.js` — Boss-Sonderbewegungen (Phase 14): `stepMirrorBoss`
  (Punktspiegelung der Spielerposition), `stepPhalanxBoss` (rotierende
  5er-Formation); bypassen `DRIVES`/`updateEnemy()`, Turm/Feuern bleibt
  die normale `roleTurret()`-Logik. Zielwahl (Upgradepool-v2 Phase 5):
  zeitgesteuerter Wechsel zwischen Spieler-Fixierung und `ai.js: pickTarget`.
- `src/game/cfg.js` — Panzer-cfg + alle Upgrade-Effekte. Der Kern ist seit
  UMBAUPLAN-LP Phase 10 EINE generische `core`-Schleife (eine neue Karte
  braucht keine Codezeile, nur ihren `core`-Eintrag in `upgrades.json`);
  Upgradepool-v2 Phase 8 hat sie um 16 `ghost*`-Schlüssel erweitert, die
  nicht auf den Spieler, sondern über `ghost.js: resolveGhostCfg()` auf die
  Geistereinheit wirken (`ghostHpAdd`/`ghostDamageAdd`/`ghostSpeedMult`/
  `ghostFireMult`/`ghostMaxAdd`/`ghostPackDamagePerAlly`/`ghostLifestealPct`/
  `ghostStunOnHit`/`ghostDamageMult`/`ghostHpMult`/`ghostDeathZoneRadius`/
  `ghostDeathZoneDamage`/`ghostReviveChance`/`ghostReviveMaxUses`/
  `ghostReviveGrowth`/`ghostCommander`+`ghostCommanderShield`+
  `ghostCommanderMultBonus`).
- `src/game/upgradepool.js` — Auswahl-Pool. Filter in `buildCandidates()`:
  `rarity` (fünf Stufen + `rarityGates`, Upgradepool-v2 Phase 1), `maxStacks`,
  `requires`, `minRoom`, Bannliste, `damageType` (Element der Klasse,
  LP-Phase 11), `signatureClass` (Klassenzugehörigkeit, LP-Phase 18),
  `exclusions` (Negativliste, Upgradepool-v2 Phase 6). Gewichtung:
  tier-normiertes `weightedPick` × Zweitelement × Synergie (`tags[]` gegen
  `run.synergyTags`, Phase 3). `dedupeKey()` dedupt Signaturkarten auf die
  eigene `id` statt auf den gemeinsamen Tag `signature` (Phase 2) — deshalb
  dürfen mehrere Signaturkarten derselben Klasse gleichzeitig im Angebot
  stehen. Elite-/Treasure-Belohnungen umgehen Teile davon über
  `includeTag`/`onlyRarity`/`bypassRoomGate`/`ignoreTagRule`.
- **Upgrade-Felder in `data/upgrades.json`** (Stand nach Upgradepool-v2):
  `id`, `name`, `description`, `tag` (Hauptkategorie, treibt die
  Transformationen über `run.tagCounts`), `tags[]` (Synergie-Tags, treiben die
  Angebotsgewichtung über `run.synergyTags`), `rarity` (common/rare/epic/
  unique/legendary), `maxStacks`, `requires[]`, `minRoom`, `symbol`,
  `core{}` (Effekte), optional `signatureClass`, `damageType`, `exclusions[]`
  und `_todo: "balance"` (Zahlenwert ohne Spec-Beleg, noch nicht am
  Spielgefühl geprüft).
- **Gestrichene Mechaniken** (nicht wiederbeleben): die Karte `ghost_crew`
  samt `cfg.ghostCrew`/`grantGhostCrew`/`ghostDurationBonus`, das
  Nekromant-Passiv `reviveChance` und `state.js: tryRevive()` sind mit
  Upgradepool-v2 Phase 4 vollständig entfernt. Damit sind auch
  **`UMBAUPLAN-LP.md` Phase 9 (Nekromanten-Passiv), Phase 26 (alter
  Signaturtopf Nekromant) und `PLAN.md` Phase 7 (Geisterpanzer als
  3-Sekunden-Verbündeter) überholt** — maßgeblich ist der Nekromant-Auftrag
  (Anhang A/B).
- `src/ui/roomscreens.js` — Event- und Shop-Overlay (`createShopScreen`,
  Phase 13: Kartenregal, Schild, Sekundärtausch, Leben, Ablegen; seit
  Grundsteinumbau Phase 8 zusätzlich die Werkbank gegen Schrott). Seit
  Grundsteinumbau Phase 6 auch `createRestScreen()` (Rastplatz: seit Phase 7
  Reparaturtrupp/Werkbank) und `createActCompleteScreen()` (Akt-Übergang).
- `src/ui/mapscreen.js` — Kartenscreen (Phase 12): zeigt den ganzen
  Kartengraphen **des aktuellen Akts** (Grundsteinumbau Phase 6: eine Karte
  pro Akt statt einer für den ganzen Run), klickbar nur die von der
  aktuellen Position erreichbaren Knoten der nächsten Reihe, Überschrift
  „Karte — Akt X/3".
- `src/render/renderer.js` — zeichnet alles (interpoliert). Nutzt Sprites,
  fällt auf prozedurale Formen zurück, falls Grafik fehlt/lädt.
- `src/render/sprites.js` — lädt die PNG-Sprites (async, mit Fallback).
- `src/ui/touchcontrols.js` — Touch: schwebende Twin-Sticks (DOM) + Minen-
  **Wurfstick** (Pointer Events + `setPointerCapture`).
- `src/core/viewport.js` — Canvasgröße/Auflösung (P2): Backing-Store an
  `devicePixelRatio` (gedeckelt über `options.json: maxPixelRatio`),
  `visualViewport` → CSS-Variablen `--vvh`/`--vvw`. Setzt bewusst KEINE
  CSS-Maße am Canvas (das würde `aspect-ratio` außer Kraft setzen).
- `src/core/audio.js` — Sound-**Effekte** prozedural (Phase 7b): kennt nur
  noch Oszillator/Rauschen/Filter/Panner, ALLE Werte kommen aus
  `data/sounds.json`. `play(name, x)` — `x` optional, platziert den Ton im
  Stereobild. **Hintergrundmusik ist die einzige Ausnahme** (Nutzerwunsch):
  echtes Asset `assets/audio/theme.mp3` (`data/sounds.json: music.track`)
  als `AudioBufferSourceNode`-Loop, mit prozeduralem Fallback bei
  Lade-/Dekodierfehler.
- `src/core/telemetry.js` — Run-Telemetrie in `localStorage.runs` +
  Debug-Ansicht. **Die Aufzeichnung läuft IMMER**, `?debug=1` blendet nur
  die Ansicht ein (dort eingeklappt, aufklappbar). Reine Beobachtung,
  keine Spiellogik.
- `sw.js` — Service Worker (Offline-fähig). **Strategie: network-first für
  Code+Daten (HTML/JS/JSON), cache-first für Bilder/Fonts.** Cache-Version
  bumpen + `data/*`/`src/*` in `ASSETS` eintragen! (Aktuell `v111`; dabei
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
- **Klassen-Sprites (Nutzergrafik):** `c_frost`, `c_flame`, `c_necro`,
  `c_blast` haben jetzt **eigene** `body_*/turret_*`-Sprites; die übrigen
  fünf Klassen (`c_tesla`/`c_toxic`/`c_scrap`/`c_ricochet`/`c_engineer`)
  borgen sich weiter `player` über `SPRITE_ALIAS`.
- **Geisterpanzer-Sprite** `body_ghost.png`/`turret_ghost.png`: EIN
  gemeinsames, durchscheinend gezeichnetes Sprite für **alle** Panzer, die
  zum Geist werden (`renderer.js: drawGhosts`, `globalAlpha 0.55`), mit
  Fallback auf die alte prozedurale Form. Nicht an einen Panzertyp gebunden.
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
node tests/music.mjs                # Hintergrundmusik-Loop + Fallback (dependency-frei, gestubbtes AudioContext/fetch)
node tests/gamepadcursor.mjs        # Gamepad-Cursor end-to-end (Playwright, eigener Server)
node tests/uilayout.mjs             # Overlay-Layout (braucht Playwright)
node tests/viewport.mjs             # DPR/Viewport + Zielkoordinaten (Playwright, braucht eigenen Server auf :8099)
node tests/fogperf.mjs              # Additive Lichtmaske: Korrektheit + Renderzeit (Playwright, P11)
```
Playwright-Browser liegt unter `/opt/pw-browsers/chromium`
(`executablePath` setzen; NICHT `playwright install`).
Regressions-Standard: `tests/regression.mjs` muss grün sein (~7 s). Enthält:
5 Seeds über 16 Räume deterministisch bis zum Sieg, Ziellinien-Trace
crashfrei, Wellen-Freigabe-Guard, Determinismus-Probe, Sound-Namen gegen
`sounds.json`, jede Karte ziehbar, Effekt-Renderpfad mit Fake-Canvas,
**Overlay- und Touch-Verhalten mit `tests/domstub.mjs`** (inkl.
Wurfstick/`pointercancel`, P3), die LP-Umbau-Abschnitte 9–17 (Schadensmodell,
LP, Statuseffekte, Schadenstypen, Krit, Phase-8-Prisma/Schild,
Phase-9-Klassen — reine Engine-Mechanismen mit synthetischen Werten, keine
Kartenabhängigkeit) sowie die **Upgradepool-v2-Abschnitte 37–45** (fünf
Seltenheiten, Kategorie/Synergie-Tag-Struktur, Synergiegewichtung,
Zielsystem der Gegner-KI, Nekromant-Klassenidentität,
Geisterpanzer-Basiseinheit und die Phase-9-Abnahme mit dem
**Bosskampf-Korridor**). Die frühere USP-Bankshot-Quote ist mit LP-Phase 8
entfallen. Mit **Grundsteinumbau Phase 1** ist der komplette Bandenschuss
(Abpraller, Bankshot-KI, Trickshot-Belohnung, Spiegelwand) entfernt —
Abschnitt 12 ("Abprall-Bonus") und mehrere Bandenschuss-Teilprüfungen in
anderen Abschnitten sind archiviert (`ARCHIV.md`/`archive/bandenschuss.md`),
nicht umnummeriert. **Abschnitt 47** bewacht den Ersatz-USP aus
**Grundsteinumbau Phase 2** (Flanken-/Heckschaden, Exekutionsschwelle,
Heck-Kill-Zeitlupe, Kampfkern-Telemetrie). **Abschnitt 48** bewacht
**Grundsteinumbau Phase 3** (t_green als Mörserschütze:
`fireMortar()`/`updateMortars()`, `minRangePx`-Gate, Telegraph). Mit
**Grundsteinumbau Phase 4** (Upgrades raus, Sockel rein) sind die Abschnitte
18–35 (Kernpool + sechs Element-Töpfe + zehn Signaturtöpfe) und 44
(Signaturtopf Nekromant) archiviert — sie prüften Struktur/Applier-Arithmetik
der jetzt archivierten 251-Karten-Pool-Inhalte; Abschnitt 36 behält nur noch
die kartenunabhängige Raumdauer-Schranke, Transformationen-Freischaltbarkeit
(vormals Abschnitt 6a) ist ebenfalls archiviert (`ARCHIV.md`/
`archive/upgrades-v1.json`/`archive/systeme-v1.md`). **Abschnitt 49** bewacht
**Grundsteinumbau Phase 5** (Klassen parken: acht Klassen `enabled: false`,
der Auswahlfilter-Mechanismus, geparkte Klassen lösen weiter fehlerfrei auf).
**Abschnitt 50** bewacht **Grundsteinumbau Phase 6** (drei Akte:
`generateMap()`/`buyEnemies()`/`totalRooms()`-Mechanismus mit synthetischen
Werten, Kartengraph-Regeln über 25 Seeds × 3 Akte, `actRoomKey`-
Stromtrennung, ein instrumentierter End-to-End-Run mit den Akt-Übergängen).
**Abschnitt 51** bewacht **Grundsteinumbau Phase 7** (Rastplatz und
Aufwertung: `cfg.js: applyUpgrades()`s generische Stufen-Skalierung mit
eigenen Zahlen, Reparaturtrupp/Werkbank-Mechanismus, Snapshot/Fortsetzen,
das Sicherheitsnetz gegen einen ausweglosen Rastplatz).
**Abschnitt 52** bewacht **Grundsteinumbau Phase 8** (Shop überarbeitet:
`cardChoices`, Werkbank im Shop gegen Schrott über einen echten Shop-Besuch,
der neu ergänzte `maxLives`-Deckel im Lebenskauf, unterschiedliche Regale
über zwei Shop-Besuche im selben Run).
**Abschnitt 53** bewacht **Grundsteinumbau Phase 9** (Kartenbelohnung neu
verteilt: Fluchräume geben wieder eine echte Kartenwahl statt eines
Schrottpakets, Ereignisse mit `effects.card` öffnen den Angebotsbildschirm,
`everyNRooms` ist entfernt, plus eine grobe Größenordnungsprüfung der
Kartenraum-Rechnung).
