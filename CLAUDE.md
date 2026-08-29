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
**Neuester Stand** (dieser Abschnitt oben ist historisch, seither sind der
komplette `AUFTRAG-GRUNDSTEINUMBAU.md`, `AUFTRAG-NEKROMANT-V2.md` und zuletzt
der **Champion-Nachschliff** gemergt — Details in den jeweils eigenen
Abschnitten weiter unten, chronologisch sortiert): der Champion ist jetzt
STICKY (nie mehr durch Staerkevergleich ersetzt, Basiswerte aus
`championStatPct` × aktuellen Spielerwerten), die Fusions-„falscher Panzer"-
Rechnung ist korrigiert, `ghost_098` funktioniert jetzt an allen sechs
Erzeugungsstellen einschließlich der echten `killTank()`/Geisterbomben-Wege,
„Blutiger Thron" ist ueber ein neues generisches `requiresAnyOf`-Gate an
funktionierende Voraussetzungen gebunden, sieben zuvor kuenstliche Deckel in
Nekromanten-Karten sind entfernt. **Zuletzt gemergt: Kartenbelohnung/Shop-
Ueberarbeitung** — zwei eigenstaendige, raum- bzw. shopbesuchsabhaengige
Seltenheitstabellen (`run.totalRoomIndex` runweit, `run.shopsVisited`
zaehlt echte Shop-Eintritte) ersetzen `balance.rarity`+`rarityGates`,
Shop-Karten haben jetzt individuelle, nach Seltenheit gewuerfelte Preise
statt eines Einheitspreises. **Zuletzt gemergt: Champion-Sprite**
(Nutzergrafik) — der Champion hat jetzt ein eigenes goldenes
`body_champion.png`/`turret_champion.png` statt des geteilten
Geister-Sprites, plus eine 12-Frame-Aura-Loop-Animation
(`champion_aura_00..11.png`, dauerhaft im Loop bei 12 fps).
**Zuletzt gemergt: Champion-/Nekromant-Nachschliff v2** (24-Punkte-Auftrag,
eigener Abschnitt weiter unten „Champion-/Nekromant-Nachschliff v2 (24-Punkte-
Auftrag)") — Champion hat wieder eine begrenzte Lebensdauer (Basiswert wie ein
gewöhnlicher Untertan, per Karte verlängerbar, „Ewiger Thron" bleibt die
einzige Unendlich-Ausnahme), Fusion überträgt jetzt 100 % statt der alten
niedrigeren Anteile, der Rastplatz erlaubt das erneute Wählen besessener
wiederholbarer Karten statt eines Stufen-/Deckel-Systems, 14 Nekromant-Karten
sind überarbeitet + `ghost_068` „Langer Anspruch" ist entfernt, 11 neue Karten
(3 Fusionskarten, 5 Wiederbelebungschance-Karten je Seltenheit, 5 Champion-
Lebensdauer-Karten — eine davon `ghost_005` „Längerer Eid" ist eine
Überarbeitung statt neu, macht zusammen 3+5+4 neu + 1 überarbeitet = 11 neue
IDs), Elite-Gegner sind jetzt grundsätzlich wiederbelebbar (kein Karten-Gate
mehr), Eliteraum-Belohnungen garantieren mindestens eine epische/legendäre
Karte, jeder Bosskill zeigt einen garantierten Bildschirm mit drei
verschiedenen legendären Karten, ein zentrales Glossar (`data/glossary.json`,
`src/ui/glossary.js`) markiert Fachbegriffe in Kartentexten blau mit
Hover-/Tap-Erklärung, der pinke Panzer ist 10 % langsamer im Geschosstempo,
der Grüne (Mörser) hat 1,7 s statt 1,1 s Flug-/Warnzeit.
**Zuletzt gemergt: Spinnenboss (Akt 3)** — der `t_black`-Platzhalter aus
Akt 3 ist durch einen vollständigen, eigenständigen Bosstyp `t_spider`
ersetzt: acht einzeln zerstörbare, animierte Beine, ein normalerweise
geschützter Körper, drei Kampfphasen (Labyrinth → Labyrinth mit mehr Tempo
→ stationär mit Bullet-Hell), Spinnenminen (Erweiterung von `mine.js`) und
Spinnennetze (Erweiterung des Statuseffekt-Systems). Details, Balancewerte,
gefundene Bugs und die Testabdeckung im eigenen Abschnitt weiter unten
„Spinnenboss (Akt 3)".
Zwischenstand: Kinderzimmer-Reskin** (Nutzergrafik, rein optisch) — die
Arena zeigte einen ganzflächigen Kinderzimmer-Hintergrund statt der
gekachelten Bodentextur, normale Wände zeigen 20 verschiedene Bauklotz-
Varianten, beschädigte/zerstörbare Wände 7 angerissene Varianten, das Loch
einen Spielzeughaufen. Keine Gameplay-/Kollisions-/Balance-Änderung, alle
vier gelieferten Referenzbilder mussten erst per PIL/scipy zu den
tatsächlich benötigten Sprite-Dateien verarbeitet werden (Details im
eigenen Abschnitt weiter unten „Kinderzimmer-Reskin (Nutzergrafik, rein
optisch)"). Zwischenstand: Hintergrund ausgetauscht (Nutzergrafik, rein
optisch) — dieselbe Datei `arena_kinderzimmer_768x512.png` zeigt jetzt ein
anderes Nutzerbild (Holzboden mit rundem Sternteppich), kein Code
geändert, nur `sw.js`-Bump. Details im eigenen Abschnitt weiter unten
„Hintergrund ausgetauscht (Nutzergrafik, rein optisch)". **Zuletzt
gemergt: Amboss (Akt 2)** — der `t_black`-Platzhalter aus Akt 2 ist durch
einen vollständigen, eigenständigen Bosstyp `t_anvil` ersetzt: ein schwer
gepanzerter Rammboss, dessen Zorn nur durch echte Spielerangriffe steigt
und nur durch einen Rammstoss gegen die Aussenwand sinkt — drei Angriffe
(Rammstoss, Hammerschlag mit Schockwellen-Sicherheitslücken, Schleifspur),
eine Raserei bei 100 Zorn und ein Zusammenbruch mit offener Panzerung
danach. Details, Balancewerte, gefundene Bugs (u. a. ein echter
1050→2646-LP-Doppelscaling-Fund, verhindert über `isBossCfg()`) und die
Testabdeckung im eigenen Abschnitt weiter unten „Amboss (Akt 2)".
**Zuletzt gemergt: Bugfix „non-finite ab Mitte Akt 2"** — eine
Nutzermeldung (Absturz im Renderpfad, „immer ab Mitte Akt 2") führte auf
eine Datenlücke: `t_green` hat seit Grundsteinumbau Phase 3 die Waffe
`mortar`, für die `data/tanks.json: bulletSpeeds` keinen Eintrag hatte —
ein vom Nekromanten übernommener Untertan dieses Typs feuerte dadurch mit
`NaN`-Kugeltempo. Behoben auf Daten- UND Code-Ebene; zusätzlich wirft der
Fake-Canvas der Testsuite jetzt bei non-finite Werten wie ein echter
Browser (der blinde Fleck, an dem der Fehler vorbeilief). Details im
eigenen Abschnitt weiter unten „Bugfix: „non-finite ab Mitte Akt 2"".

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
  **behoben im „drawOne()-Signaturkarten-Fix" weiter unten.**

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
weiter unten. **Phase 10 (Abnahme) ist gebaut** — eigener Abschnitt weiter
unten. **Damit ist der komplette `AUFTRAG-GRUNDSTEINUMBAU.md` (Phasen 0–10)
abgearbeitet.** Laut Auftrag Abschnitt 6 „Danach" folgt als nächstes eine
Anpassung von `AUFTRAG-NEKROMANT-KOMPLETT.md` (Phase 1/2 gegen den 5-Karten-
Sockel statt der 246 archivierten Karten, Nekromanten-Signaturpool
18→~45 Karten, Reaktorkampf-Wortlaut veraltet, Schatzraum später wieder
„1 Legendär" sobald ein Klassenpool Legendaries führt) — ein separater,
noch nicht beauftragter Folgeauftrag, keine weitere Phase dieses Plans.
**Überholt:** `AUFTRAG-NEKROMANT-KOMPLETT.md` ist nie eingetroffen — an
seiner Stelle kam `AUFTRAG-NEKROMANT-V2.md` mit dem 105-Karten-Pool, zuerst
aus `Geisterpanzer_105_Upgrades_v2.xlsx`, **inzwischen korrigiert auf
Fassung v4** (s. eigener Abschnitt weiter unten, „Nachtrag — Korrektur auf
v4").

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

### Grundsteinumbau v3 — Phase 10 (Abnahme) — gemergt
Die Schlussabnahme des ganzen elf-Phasen-Umbaus. **Keine Balance-Werte
geändert** — alle 21 Prüfpunkte des Auftrags sind am aktuellen Stand grün.
Ganz überwiegend waren sie schon durch die Abschnitte 47–53 (Phasen 2/3/6)
sowie ältere UMBAUPLAN-LP-/Upgradepool-v2-Abschnitte gedeckt — **neuer
Testabschnitt 54** in `tests/regression.mjs` schließt nur die dabei
gefundenen echten neun Lücken, jede mit Gegenprobe:
- **(a)+(b) Punkt 16/17 — geschlossene Karten-/Gegnerwelt**: der Sockel hat
  exakt die fünf bekannten ids (nicht mehr, nicht weniger — schließt
  archivierte Karten strukturell aus, da `rollFromPool()`/`drawOne()` nur
  ids aus `upgradesData.upgrades` liefern können), `t_prism` existiert
  weder als Typ noch als kaufbarer Gegner.
- **(c) Punkt 1 — kein Abpraller, auch nicht intern**: ein frisches Geschoss
  trägt keine `wallBounces`/`ricochetsLeft`/`ricochetsStart`-Felder mehr,
  ein Wandkontakt tötet sofort UND eine tote Kugel bewegt sich in den
  Folge-Ticks nicht weiter (schließt eine überlebende interne
  Reflexionsrechnung aus, nicht nur das sichtbare Verhalten).
- **(d) Punkt 3 — Frontpanzerung reflektiert weiterhin, `ownBullet` greift**:
  ein isolierter Zwei-Panzer-Aufbau (Muster: Abschnitt 47) zeigt, dass ein
  Frontschuss abprallt (`b.reflected`, Besitzer bleibt der Schütze, Kugel
  lebt weiter), die reflektierte Kugel den Schützen nach `ownBullet` (15)
  schädigt, und danach am nächsten Wandkontakt stirbt wie jede andere Kugel
  — kein zweiter Abpraller-Sonderfall mehr.
- **(e) Punkt 6 — Vorhaltemarkierung geometrisch korrekt**: die von
  `drawLeadMarkers()` gezeichnete Position wird gegen die analytische
  Lösung derselben Abfang-Aufgabe (quadratische Gleichung) verglichen,
  Toleranz 15 px (empirisch: die 3-Schritt-Näherung weicht bei
  realistischen Zielgeschwindigkeiten höchstens ~8 px ab).
- **(f) Punkt 7 — `magBlockedTime` real, nicht nur mechanismushaft**: ein
  echter Raum mit den ECHTEN 450er-Kugeln und 8 s Dauerfeuer hält
  `magBlockedTime` unter 5 % der Spielzeit (gemessen: 0 %) — Ergänzung zum
  bereits synthetisch geprüften Mechanismus aus Abschnitt 47.
- **(g) Punkt 9 — Mörser-Explosionsradius, BEIDE Seiten**: außerhalb des
  Radius kein Schaden, innerhalb Schaden an Spieler UND Gegner gleichermaßen
  (Abschnitt 48 prüfte bisher nur die Spielerseite).
- **(h) Punkt 11 — `bossHpMult` real angewendet**: an zwei echten
  Bossräumen (Akt 1 `bossHpMult 1.0`, Akt 2 `1.4`) gemessen, nicht nur als
  vorhandenes Konfigurationsfeld (Abschnitt 50 prüfte bisher nur den Typ).
- **(i) Punkt 15 — Fortsetzen über eine Aktgrenze**: Akt, Karte, Leben,
  Schrott, Kartenstapel UND Aufwertungsstufe stimmen nach `runSnapshot()` +
  Wiederaufbau exakt mit dem Stand vor dem Speichern überein.
- **(j) Punkt 21 — Determinismus für Akt 2/3**: Abschnitt 4 prüfte bisher
  nur Akt 1 (baut beim `createRun()`); Akt-2/3-Karten entstehen erst später
  über `enterAct()`/`generateMap()` und brauchten eine eigene Probe.
- **(k) Punkt 20 — Schatzkammer exakter Preis/Ertrag**: kostet exakt
  `difficulty.treasure.lifeCost` (1) Leben und gibt exakt
  `balance.scrap.treasure` (12) Schrott, an einer echten angesteuerten
  Schatzkammer gemessen.
- **Ein dokumentierter, bewusst nicht behobener Nebenbefund**:
  `bullet.js: moveAxis()` enthält seit Phase 1 noch die alte
  Reflexions-Restrechnung (Geschwindigkeitsumkehr + Positions-Clamp an der
  Wandkante) im Wandkontakt-Zweig — sie ist nachweislich wirkungslos, weil
  `updateBullet()` direkt danach `b.dead = true` setzt und jeder weitere
  Aufruf durch das `if (b.dead) return;` am Funktionsanfang abgefangen wird
  (Testschritt (c) beweist das über die Positions-Stabilität nach dem Tod).
  Bewusst nicht aufgeräumt, um in der Abnahme-Phase kein Risiko an der
  Kernphysik einzugehen, ohne dass der Auftrag das verlangt.
- Alle Gegenproben aus (a)–(k) einzeln bestanden (Mechanismus jeweils
  deliberately gebrochen — u. a. Radius-Check auf `true` gesetzt,
  `bossHpMult` aus der Formel entfernt, `r.actIndex` beim Fortsetzen
  ignoriert, der Akt-Kartenstrom mit `Math.random()` verrauscht, der
  Schatzkammer-Schrottbetrag verfälscht —, Fehlermeldung geprüft, danach
  zurückgesetzt); volle Suite (~7 s) läuft anschließend wieder grün.
- `sw.js`-Cache auf `v112` erhöht (+ `telemetry.js: GAME_VERSION`
  mitgezogen) — reiner Meilenstein-Bump zum Abschluss des gesamten
  Grundsteinumbaus, keine neuen/geänderten Asset-Dateien in dieser Phase.
- `ARCHIV.md` auf Vollständigkeit geprüft: jeder in Phasen 0–9 entfernte
  Mechanismus (Bandenschuss, 251-Karten-Pool, Transformationen,
  Zweitelement-System, Element-Filter, Schatzraum-Legendär, acht Klassen,
  `t_prism`, alter Extra-Leben-Mechanismus, `everyNRooms`) hat einen
  Index-Eintrag mit Fundstelle + Rückholweg — keine Lücke gefunden, keine
  Änderung an `ARCHIV.md` nötig.
- `tests/gamepad.mjs`, `tests/music.mjs`, `tests/uilayout.mjs`,
  `tests/viewport.mjs` bleiben grün (keine funktionale Codeänderung in
  dieser Phase, nur neue Tests + der Versions-Bump).

### Nekromant-V2 — Phase 0 (Import, Validierung, Archivierung) — gemergt
**Neu eingegangen: `AUFTRAG-NEKROMANT-V2.md`** — vollständiger Neubau der
Nekromantenklasse mit dem Signaturpool aus `Geisterpanzer_105_Upgrades_v2.xlsx`
(Blatt „Upgrades", 105 Zeilen). Ersetzt `AUFTRAG-NEKROMANT-KOMPLETT.md` und
`AUFTRAG-NEKROMANT-105.md` vollständig (beide nie als Repo-Datei eingetroffen,
s. `ARCHIV.md`). **Voraussetzung des Auftrags — der Grundsteinumbau — ist
erfüllt** (alle 11 Phasen gemergt, s. o.); vor dem Start dieser Sitzung wurde
das gegen `git log`/den Repo-Stand verifiziert und dem Nutzer gemeldet, statt
stillschweigend Phase 0 des (bereits abgeschlossenen) Fundament-Auftrags
erneut zu bearbeiten.
- **`data/upgrades_necro.json` (neu, 105 Karten)**: aus der xlsx importiert
  (Spaltenzuordnung exakt nach Auftrag Phase 0 — `ID`→`id`, `Name`→`name`,
  `Pfad`+`Tags`→`tags[]` gemergt, `Typ`→`tag`, `Seltenheit`→`rarity`
  (`Gewöhnlich/Ungewöhnlich/Selten/Episch/Legendär` →
  `common/uncommon/rare/epic/legendary`), `Stapelgrenze`→`maxStacks`,
  `Angebotsgewicht`→`weight`, `Voraussetzung`→`requires[]` (Kartenname auf
  ID aufgelöst), `Exakter Effekt`→`description`, `Buildrolle`+
  `Balance-Hinweis`→`_note` (reine Dokumentation)). Alle Karten
  `signatureClass: "c_necro"`, `core: {"_todo": "effect"}` als Platzhalter —
  **noch keine Karte ist spielbar**, die Datei ist nirgends in
  `upgradepool.js`/`run.js` eingehängt (per `grep` verifiziert).
- **`tag`-Zuordnung** (Spalte „Typ", 31 deutsche Rohwerte): auf Kategorie-
  Slugs abgebildet, dokumentiert als `_comment_tag` in der Datei selbst.
  Fünf Kategorien wiederverwendet, weil inhaltlich deckungsgleich mit
  bestehenden `KNOWN_TAGS`-Werten (`crit`, `defense`, `scaling`, `elite`,
  `gadget`); der Rest ist neu (`keystone`, `hybrid`, `revival`, `shield`,
  `fusion`, `champion`, `aoe`, `runscaling` u. a.). Da die Datei getrennt von
  `data/upgrades.json` liegt, greift die bestehende `KNOWN_TAGS`-Prüfung
  (Abschnitt 38) hier nicht — die Phase-0-Checkliste des Auftrags verlangt
  auch keine solche Prüfung für diesen Pool.
- **`requires`-Struktur geprüft**: nur 4 der 105 Karten haben eine
  Voraussetzung (`ghost_023`→`ghost_014`, `ghost_072`/`ghost_073`/
  `ghost_085`→`ghost_071` „Einziger Thron"), keine Kette (beide Ziele haben
  selbst kein `requires`), höchstens 3 Karten hängen an derselben Karte
  („Einziger Thron", genau 3 — die Auftragsgrenze).
- **Ist-Abgleich „Was aus dem Pool an Engine gebraucht wird" (Auftrag
  Abschnitt 4)** gegen den Code geprüft, Details in `ARCHIV.md`: vorhanden
  bestätigt (Krit, `cfg.homing`, `cfg.bulletRadius`, `tank.gadgetCooldown`,
  `run.eliteAffixes`, `mine.js: explodeAt()`, Flanken-/Heckschaden und
  Exekutionsschwelle aus dem Grundsteinumbau); fehlend bestätigt wie im
  Auftrag angenommen (Schadensresistenz, Schildpunktepool getrennt von
  `run.shieldCharges`, Durchschlag) — keiner der drei existiert aktuell im
  Code, Phase 2 des Auftrags baut sie.
- **Neuer Testabschnitt 55** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt einzeln bestanden — je absichtlich rot gemacht: doppelte
  Objektschlüssel-ID, ungültige Seltenheit, `legendary` mit `maxStacks: 2`,
  unauflösbares `requires`, `requires`-Kette, ein 4. Abhängiger an einer
  Karte, verbotenes Wort „Meter" im Text, fehlendes Pfad-Tag, falsche
  `signatureClass`): 105 eindeutige IDs, gültige Seltenheit, `requires`
  löst auf, keine Ketten, höchstens 3 Abhängige je Karte, jede Karte hat
  `maxStacks` (legendär davon immer `1`), jede Karte trägt mindestens ein
  Pfad-Tag (`allgemein`/`opfer`/`legion`/`alpha`), kein Kartentext enthält
  „Meter" oder „Abprall" (Reste der überholten Fassung-1-Spec bzw. des
  entfernten Bandenschusses).
- `ARCHIV.md` um einen neuen Abschnitt „Nekromant-V2 — Phase 0" ergänzt: die
  drei ersetzten Dokumente (`docs/specs/geisterpanzer.md`,
  `AUFTRAG-NEKROMANT-KOMPLETT.md`, `AUFTRAG-NEKROMANT-105.md`) sind als nie
  eingecheckte Repo-Dateien vermerkt — nichts zu verschieben, nur die
  Ablösung dokumentiert.
- Kein `sw.js`-Bump (reine Datenänderung, kein Asset, keine live spielbare
  Änderung).

### Nekromant-V2 — Phase 0, Nachtrag (Korrektur auf `Geisterpanzer_105_Upgrades_v4.xlsx`) — gemergt
**Dieselben drei Auftragsdokumente kamen ein zweites Mal**, diesmal mit
`Geisterpanzer_105_Upgrades_v4.xlsx` statt v2. **Vor Sitzungsbeginn geprüft
statt der Startanweisung blind gefolgt**: `STARTHIER.md` verlangt wörtlich
„AUFTRAG-FUNDAMENT.md, Phase 0 abarbeiten" — laut `git log` war der
komplette Grundsteinumbau (alle 11 Phasen) da längst gemergt, und die
Nekromant-V2-Phase-0 (oben) ebenfalls schon abgeschlossen. Statt
Fundament-Phase-0 grundlos zu wiederholen, wurde die tatsächlich offene
Abweichung bearbeitet: v4 unterscheidet sich strukturell von v2 (eigenes
Blatt „Änderungen", 59 Zeilen Detailkorrekturen, plus ein sich selbst
validierendes Blatt „Prüfung") — und der v2-Import in `data/
upgrades_necro.json` widersprach an einer Stelle bereits der (unveränderten)
Auftragsvorgabe: er trug ein `maxStacks`-Feld je Karte, obwohl
`AUFTRAG-NEKROMANT-V2.md` Phase 0 ausdrücklich „Es gibt kein `maxStacks`"
verlangt (`isUnique` statt Stapelgrenze). Da noch keine Folgephase auf dem
alten Import aufbaute (Phase 0 war der aktuellste Merge), war eine Korrektur
ohne Kollateralschaden möglich.
- **`data/upgrades_necro.json` neu aus v4 importiert**, alte v2-Fassung nach
  `archive/upgrades_necro-v2-import.json`. Schema jetzt exakt wie im Auftrag:
  `Einzigartig` (Ja/Nein) → `isUnique` (Boolean) **statt** `Stapelgrenze` →
  `maxStacks` — das Feld `maxStacks` kommt in keiner der 105 Karten mehr vor.
  Seltenheitsverteilung 34/28/22/13/8 (v2: 36/33/24/1/11 — die episch-Stufe
  hatte dort genau eine Karte und war seltener als legendär). `requires` auf
  4 Karten gesenkt (v2: 12, davon 11 an `ghost_071` „Einziger Thron" — bei
  einer entzogenen Karte wären 44 % des Alpha-Pfades tot gewesen). Zwei neue
  Karten (`ghost_058`/`ghost_059`), `ghost_082` „Kronjäger" neu (Exekutions-
  bezug), mehrere Kartentexte präzisiert (v4-Blatt „Änderungen", vollständig
  in `ARCHIV.md` referenziert). `tags[]`/`tag`-Zuordnung, `signatureClass`,
  `core`-Platzhalter unverändert übernommen — die Spaltenzuordnung selbst
  hat sich zwischen v2 und v4 nicht geändert, nur der Inhalt.
- **`tests/regression.mjs` Abschnitt 55 umgestellt**: prüft jetzt `isUnique`
  als Pflicht-Boolean, dass legendäre UND Aktivkarten (Tag `gadget`, die
  drei Gadgetslot-Karten) immer `isUnique: true` sind, dass **kein**
  `maxStacks`-Feld mehr existiert, und dass höchstens 4 Karten insgesamt ein
  `requires` tragen (zusätzlich zur unveränderten „höchstens 3 Abhängige je
  Karte, keine Ketten, jedes `requires` löst auf"-Prüfung). Jeder geänderte/
  neue Kernpunkt einzeln mit Gegenprobe bestanden (`isUnique` entfernt,
  Legendär/Aktivkarte künstlich nicht-einzigartig gemacht, `maxStacks`
  künstlich wieder eingefügt, eine 5. Karte mit `requires` versehen).
- `ARCHIV.md` um den Abschnitt „Nachtrag — Korrektur auf v4" ergänzt
  (Rückholweg zur v2-Fassung dokumentiert, falls die Korrektur je verworfen
  werden soll).
- Kein `sw.js`-Bump (reine Datenänderung). **Nächste Sitzung: Phase 1**
  (Seltenheitsachse und Pool-Pipeline, `AUFTRAG-NEKROMANT-V2.md`).

### Nekromant-V2 — Phase 1 (Seltenheitsachse und Pool-Pipeline) — gemergt
**Ist-Abgleich vor Beginn (echter Fund):** `AUFTRAG-FUNDAMENT.md` Phase 4
verlangte, `maxStacks` global durch `isUnique` +
`run.selectedUniqueUpgradeIds` zu ersetzen ("Stapelregel gilt für beide
Aufträge", STARTHIER.md) — der tatsächlich gemergte Code tat das nie: der
5-Karten-Sockel trug weiterhin `maxStacks` (5/5/3/5/2), `isUnique` kam im
gesamten Code kein einziges Mal vor. Da Nekromant-V2 Phase 1 genau diese
Umstellung selbst als Änderungspunkt verlangt ("Kein `maxStacks` mehr"),
war das die richtige Stelle, die Lücke zu schließen, statt sie zu melden und
liegen zu lassen — betrifft den GESAMTEN Pool (aktuell nur der Sockel),
nicht nur künftige Nekromantenkarten.
- **Seltenheitsachse umbenannt**: `common/rare/epic/unique/legendary` →
  `common/uncommon/rare/epic/legendary` (`data/balance.json: rarity`,
  `rarityGates`). Reiner Namenstausch an gleicher Rang-Position — dieselben
  fünf Gewichte (45/25/15/10/5) und Gates (`rare`:3, `epic`:6, `legendary`:9,
  vorher an `epic`/`unique`/`legendary` gehängt) bleiben unverändert, nur
  die vierte Stufe heißt nicht mehr „unique" (das Wort gehört jetzt der
  GETRENNTEN `isUnique`-Karteneigenschaft) — passend zu
  `data/upgrades_necro.json` (Phase 0, aus v4 importiert, nutzt exakt diese
  fünf Namen). `style.css`/`src/ui/upgradescreen.js: RARITY` entsprechend
  umbenannt (Farben bleiben an derselben Rang-Position: grau→blau→lila→
  orange+Glow→gold+Glow).
- **`maxStacks` ist ERSATZLOS abgeschafft**, ersetzt durch `isUnique`
  (Boolean, auf jeder Karte in `data/upgrades.json` explizit gesetzt — alle
  fünf Sockelkarten `isUnique: false`, also **unbegrenzt stapelbar**, auch
  `sockel_ersatzpanzer` (+1 Leben) — das ist wörtliche Auftragsvorgabe
  ("steht über allen Balanceüberlegungen"), keine ungeprüfte Nebenwirkung.
  `src/game/upgradepool.js: buildCandidates()`: die alte Zeile
  `(chosen[id]||0) >= def.maxStacks` ist ersetzt durch
  `def.isUnique && ((chosen[id]||0) >= 1 || selectedUniqueUpgradeIds?.has(id))`
  — eine nicht-einzigartige Karte hat dadurch strukturell keine Obergrenze
  mehr, eine einzigartige verschwindet nach der ersten Wahl.
- **`run.selectedUniqueUpgradeIds`** (neuer Set, `src/game/run.js`):
  zentrale, im Snapshot persistierte Menge gewählter einzigartiger
  Karten-ids. `applyUpgradeChoice()` trägt sie ein, `poolOpts()` reicht sie
  an `buildCandidates()` als zusätzliche Filterquelle durch (deckt „auch aus
  bereits vorbereiteten Auswahlen" ab — die primäre Sperre bleibt
  `chosen[id]>=1`, das bei JEDER Kartenquelle über denselben `buildCandidates()`-
  Pfad läuft). Ältere Zwischenstände ohne das Feld rekonstruieren es beim
  Fortsetzen aus `run.upgrades` + dem aktuellen `isUnique`-Schema, statt es
  stillschweigend leer zu lassen.
- **Bereits vorher gebaut, nur verifiziert** (Upgradepool-v2 Phase 1–3):
  `tags[]` neben `tag`, die Dedupe-Regel für Signaturkarten (`dedupeKey()`
  auf `id` statt `tag`) und die Synergiegewichtung (`makeSynergyWeight()`,
  `run.synergyTags`) erfüllten die entsprechenden Phase-1-Änderungspunkte
  bereits vollständig — keine Codeänderung nötig, nur gegengeprüft.
- **UI**: `upgradescreen.js`/`roomscreens.js` zeigen bei nicht-einzigartigen
  Karten nur noch „(Stufe N)" (kein „/Y", kein „MAX"), bei einzigartigen gar
  keine Stufenzahl (die ist ohnehin immer 1).
- **Zwei bestehende Tests wären durch die `maxStacks`-Abschaffung STILL
  vakuum geworden, ohne rot zu werden** (echte Funde, nicht nur
  vorsorglich): (1) Abschnitt 6b's NaN-Sicherheitstest lief
  `for (let lvl=1; lvl<=def.maxStacks; lvl++)` — mit `def.maxStacks ===
  undefined` bricht die Schleife für JEDE Karte sofort ab, der Test hätte
  fortan 0 Stufenkombinationen geprüft und wäre bei jedem künftigen Fehler
  weiterhin grün geblieben. Ersetzt durch einen festen Stufensatz
  (`isUnique`: nur 1; sonst 1/2/5/20) + einen neuen Selbstschutz-Check
  (`geprueft >= Kartenzahl`). (2) Abschnitt 45 „Punkt 24" setzte
  `chosen[id] = def.maxStacks` (jetzt `undefined`) — `applyUpgrades()` liest
  eine Karte mit `chosen[id]===undefined` als „nicht gewählt", der Test hätte
  für jede Karte den reinen No-op-Fall geprüft, ohne das zu bemerken (per
  Gegenprobe bestätigt: kein einziger Check schlägt fehl). Ersetzt durch
  einen festen hohen Wert (20, bzw. 1 bei `isUnique`) + einen expliziten
  `chosen[id] > 0`-Selbstschutz-Check. Abschnitt 45 „Punkt 19" prüfte
  `chosen[o.id] >= d.maxStacks` (ebenfalls dauerhaft `false` gegen
  `undefined` gewesen) — ersetzt durch die tatsächlich aktuelle Invariante
  `d.isUnique && chosen[o.id] >= 1`.
- **Neuer Testabschnitt 37(a)/(c)/(d)** (`tests/regression.mjs`, Gegenprobe
  für jeden Kernpunkt einzeln bestanden — je absichtlich rot gemacht:
  `isUnique`-Filter in `buildCandidates()` deaktiviert, künstlicher
  5er-Deckel für nicht-einzigartige Karten wieder eingebaut,
  `applyUpgradeChoice()`s Eintrag in `selectedUniqueUpgradeIds` entfernt,
  `runSnapshot()`s Feld entfernt, die Fallback-Rekonstruktion beim
  Fortsetzen entfernt, `isUnique`-Feld auf einer Sockelkarte entfernt,
  `maxStacks`-Feld künstlich wieder eingefügt): Struktur (gültige Rarity,
  `isUnique`-Boolean auf jeder Karte, kein `maxStacks` mehr), Rarity-Gate-
  Mechanismus mit synthetischem Gate-Wert (unverändert vom Umbenennen),
  Stapelmechanismus mit EIGENEN großen Zahlen (1/10/100/1000 Wahlen bleibt
  eine nicht-einzigartige Karte im Pool; eine einzigartige verschwindet
  sowohl über `chosen` als auch über `selectedUniqueUpgradeIds` allein),
  End-to-End über die echten `run.js`-Funktionen (`createRun`/
  `chooseUpgrade`/`runSnapshot`) mit einer synthetischen einzigartigen
  Testkarte (der Sockel hat aktuell keine): Eintragung, Snapshot-Erhalt,
  Fortsetzen, Rekonstruktion bei einem älteren Zwischenstand ohne das Feld.
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).

### Nekromant-V2 — Phase 2 (Engine-Lücken: Resistenz, Schild, Durchschlag) — gemergt
**Widerspruch im Auftrag gefunden und nach der übergeordneten Regel
aufgelöst, nicht stillschweigend interpretiert:** Abschnitt 4a verlangt für
Schadensresistenz wörtlich „ohne Obergrenze … ein `Math.min(…, 0.6)` … ist
ausdrücklich verboten", Phase 2s eigener Testschritt 2 sagt aber „Resistenz
über den Deckel treiben — bleibt bei 60 %". Das sind zwei sich
widersprechende Vorgaben im selben Dokument. `STARTHIER.md` erklärt „Keine
Caps für nicht einzigartige Upgrades" zur Regel, die „über allen
Balanceüberlegungen steht" und wiederholt „keinen Ersatzdeckel einführen" —
diese Instanz ist damit eindeutig zugunsten von Abschnitt 4a entschieden:
**kein Deckel gebaut**, der Testschritt-Wortlaut ist vermutlich ein Rest
einer früheren Fassung, in der Resistenz noch eine feste Obergrenze hatte.
- **`cfg.resist`** (Punkte, additiv): `state.js: applyResistToAmount()` —
  `genommenerSchaden = max(1, round(Schaden / (1 + resistSumme/divisor)))`,
  `divisor` aus `data/balance.json: resist.divisor` (100, reine
  Formelkonstante, kein Balancewert im engeren Sinn, aber trotzdem in JSON
  statt im Code). Das `max(1, …)` ist eine bewusste, im Auftrag nicht
  explizit vorgeschriebene Ergänzung: ohne sie würde `Math.round()` bei
  astronomisch hoher Resistenzsumme rechnerisch auf 0 runden — „nie null"
  (Abschnitt 4a) wird damit auch bei extremen Werten wörtlich eingehalten,
  ohne die lineare Skalierung im normalen Wertebereich zu beeinträchtigen.
  Wirkt in `applyDamage()` **vor** der DOT-Weiche (Phase 5) — Resistenz
  reduziert ausdrücklich auch Schaden über Zeit, anders als alle
  Schild-Mechaniken darunter.
- **Schild als Punktepool** (`tank.shield`/`g.shield`, Obergrenze
  `cfg.shieldMax`, optionale Regeneration `cfg.shieldRegenPerS`): neue,
  eigenständige Funktionen `applyResistToAmount()`/`absorbWithShieldPool()`
  in `state.js` (Modulebene, nicht Methode auf `state` — gebraucht von
  `applyDamage()` UND der getrennten Geister-Kollisionsschleife, da
  Untertanen nicht durch `state.tanks`/`applyDamage()` laufen). Faengt
  Schaden **vor** hp ab, überspringt DOT (wie alle anderen Schild-Gatter,
  Phase 5), wird **vor** den beiden Notschild-Gattern geprüft (für Gegner
  aktuell die einzige Schild-Option). **Drei getrennte Schild-Konzepte
  bleiben nebeneinander bestehen** und sind im HUD/Renderer unterscheidbar:
  `state.shieldCharges` (Notschild, blockt einen ganzen Treffer),
  `tank.shieldHp`/`shieldReady` (älterer Nur-Spieler-Absorber der
  `schild`-Karte, UMBAUPLAN-LP Phase 8), `tank.shield`/`cfg.shieldMax`
  (neu). Regeneration tickt im bestehenden Panzer-Tick-Loop
  (`state.js`)/`ghost.js: updateGhosts()`.
- **Durchschlag** (`bullet.pierce`, `bullet.pierceHits`-Set): ein Treffer
  mit `b.pierce > 0` zählt herunter statt `b.dead` zu setzen; die
  Trefferliste verhindert, dass ein weiterfliegendes (oder an einem
  stehenden Ziel klebendes) Geschoss dasselbe Ziel zweimal trifft. Bewusst
  **nicht** dasselbe Feld wie das ältere, archivierte `phaseWalls`
  („Durchschlag" im alten Sinn — ignoriert Wände, nicht Ziele) — beide
  Mechaniken heißen im Deutschen zufällig gleich, sind aber getrennt.
  Armor-Block/Deflektor-Reflexion bleiben unverändert (stoppen/lenken das
  Geschoss immer, unabhängig von `pierce`).
- **`resolveCfg()`/`applyUpgrades()`**: vier neue, generische Basiswerte
  (`resist`/`pierce`/`shieldMax`/`shieldRegenPerS`, alle 0) + vier neue
  `core`-Schlüssel (`resistAdd`/`pierceAdd`/`shieldMaxAdd`/`shieldRegenAdd`,
  additiv wie Abschnitt 4a verlangt — nicht multiplikativ). Folgen dem
  bestehenden `*Add`-Namensmuster, die Rastplatz-Stufenskalierung
  (Grundsteinumbau Phase 7) erfasst sie deshalb automatisch mit, ohne
  Sonderfall in `scaleCore()`.
- **Noch keine echte Karte setzt diese Werte** (Phase 6+ des Auftrags baut
  die Karten) — alle drei Systeme sind vollständig verdrahtet, aber aktuell
  überall 0/inert. `data/tanks.json: types.ghost_tank` bekam ebenfalls die
  drei neuen Basisfelder (Default 0) in `ghost.js: resolveGhostCfg()`.
- **Sichtbarkeit** (Fertig-Kriterium „Debug-Overlay zeigt sie" +
  Testschritt 3/4 „HUD zeigt beides getrennt"): neue, andersfarbige
  (türkis) Schild-Leiste in `renderer.js: drawTank()`/dem Geister-Renderpfad
  — direkt über der Lebensleiste, zwischen ihr und den Affix-Punkten,
  sichtbar sobald `cfg.shieldMax > 0`. `hud.js: drawStats()` bekommt drei
  neue, bedingte Zeilen (Resistenz/Durchschlag/„Schildpool" — bewusst
  **nicht** „Schild" genannt, das Wort ist schon für die Notschild-Zeile
  vergeben). `debug.js: drawPanel()` zeigt alle drei Spielerwerte in einer
  Zeile.
- **Neuer Testabschnitt 56** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt einzeln bestanden — je absichtlich rot gemacht: Resist-Transform
  deaktiviert, ein 60-%-Deckel simuliert, Schildpool-Gate entfernt,
  Schildpool faelschlich auf DOT angewendet, Regen-Tick entfernt, Regen ohne
  `Math.min`-Deckel, die vier `core`-Schlüssel entfernt, Durchschlag
  deaktiviert, Trefferlisten-Prüfung entfernt, Geister-Resistenz/-Schildpool
  entfernt, Schild-Leiste im Renderer entfernt): Resistenz-Formel mit
  eigenen Zahlen (100→halbiert, 200→gedrittelt), explizite
  Kein-Deckel-Zusicherung (5000 Resistenz nimmt nachweislich weniger als 500,
  extreme Resistenz bleibt ≥1 Schaden), Resistenz wirkt auf DOT,
  Schildpool-Grundmechanik (voll/teilweise absorbiert), Schildpool
  überspringt DOT, Namenskollisions-Test (alle drei Schild-Konzepte
  gleichzeitig, bleiben unabhängig), Schild-Regeneration + ihr Deckel,
  `cfg.js`-Verdrahtung inkl. Rastplatz-Stufenskalierung, Durchschlag
  Ende-zu-Ende (zwei Ziele, keins doppelt, stirbt erst ohne verbleibende
  Ladung), Geister-Kollisionsschleife nutzt dieselbe Resistenz-/
  Schildpool-Logik, Renderer zeigt/versteckt die neue Leiste korrekt.
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  **Nächste Sitzung: Phase 3** (Geisterpanzer-Basis).

### Nekromant-V2 — Phase 3 (Geisterpanzer-Basis) — gemergt
Der Kern von Anhang B ("eigener, fester Basiseinheiten-Typ `ghost_tank`,
kein Stat-Erbe, kein Lebensdauer-Timer") ist **grundlegend umgekehrt**
worden (Auftrag Abschnitt 3, keine Inkonsistenz — der Auftrag selbst
verlangt das): ein Untertan erbt jetzt den vollen **Typ** des getöteten
Gegners, hat eine **Lebensdauer**, und ein **dynamischer Champion** ersetzt/
ergänzt den alten kartengebundenen Kommandanten. `ghost_tank` selbst und die
alte zweistufige `spawnChance` sind archiviert
(`archive/ghost-tank-v1.json`, `ARCHIV.md`).
- **Typ-Vererbung** (`ghost.js: resolveGhostCfg(data, sourceType, playerCfg)`):
  baut auf `resolveCfg(data, sourceType)` auf und spreadet das volle
  aufgelöste cfg des Quelltyps — Rolle, Waffe, Panzerung, Zielgenauigkeit,
  Geschosstempo, Magazin bleiben dadurch **unverändert** die des geerbten
  Typs. Nur `maxHp`/`damage` werden auf `data/balance.json: ghost
  .baseStatPct` (0,5) gestutzt ("ein Untertan ist eine geschwächte Kopie,
  kein Vollwert-Klon"). Die Instanzwerte des konkreten getöteten
  **Exemplars** (Raum-Skalierung, Elite-Multiplikator) werden bewusst NICHT
  übernommen — `resolveGhostCfg()` liest frisch aus `tanksData`, nie aus
  `tank.cfg`. `fireRangePx` (Feuer-Schwelle) ist jetzt ein einzelner
  geteilter Wert (`ghost.rangePct`) statt eines Feldes des archivierten
  Typs. Ein geerbter `t_armored`-Untertan trägt seine Panzerung sichtbar in
  der cfg, ist aber (noch) nicht dadurch geschützt — die Geister-eigene
  Kollisionsschleife (`state.js`, seit Upgradepool-v2 Phase 5) wertet Armor/
  Krit/Kopfschuss bewusst nicht aus, unverändert seit dem Vorgängermodul.
  Ein geerbter **Mörser** (`t_green`) feuert als Untertan bewusst **kein**
  echtes Geschoss über `fireMortar()` — der wirft ein volles KI-Zielobjekt
  voraus (`resolveTarget()` liest `tank.ai.target`) und würde bei einem
  Geist ohne `.ai` immer auf `state.player` zurückfallen, also den eigenen
  Nekromanten beschießen. Volle Waffen-Portierung ist bewusst nicht Teil
  dieser Phase (To-do).
- **ReviveChance vereinheitlicht** (`data/balance.json: ghost.reviveChance`
  0,35, ersetzt `spawnChance.necro/.ghost` 50 %/33 %): EIN Wert für jeden
  Kill auf Nekromanten-Seite, egal ob der Spieler selbst oder ein
  vorhandener Geist getötet hat. **Elite-/Boss-Ausnahme** (`state.js:
  killTank()`): ein Gegner mit Elite-Affix (`tank.affixes.length > 0`) oder
  ein Boss (`isBossCfg(tank.cfg)`, dasselbe Erkennungsmuster wie bei
  Flankenschaden/Exekutionsschwelle) wird nie wiederbelebt.
- **"Rechenweg statt Obergrenze"** (Auftrag Abschnitt 4a, neue Funktion
  `state.js: rollGhostSpawnCount(chance, rng)`): additiv ohne Deckel — der
  ganzzahlige Anteil von `reviveChance` erzeugt GARANTIERTE Zusatz-
  Untertanen (z. B. bei 1,4 sicher einen, plus 40 % Chance auf einen
  zweiten), der Rest bleibt eine reine Chance. Aktuell ohne Karte nie über
  0,35 hinaus getrieben, der Mechanismus selbst kennt aber keine Grenze. Das
  Geistlimit (`ghost.maxActive`, weiterhin 3, `ghostMaxAdd`-additiv) greift
  trotzdem — die Spawnschleife bricht am Deckel ab, ohne zu verdrängen.
- **Lebensdauer** (`ghost.lifetimeS` 12 s, `g.lifetime`/`g.lifetimeMax`):
  ein ANDERER Todes-Auslöser als Schaden. `killGhost(state, g, cause)` hat
  jetzt zwei Ursachen — `'damage'` (Standard, wie bisher) und `'expire'`
  (Ablauf) — ein Ablauf-Tod überspringt bewusst ALLE drei kartengebundenen
  Todes-Mechaniken (Phylakterium, Wiederkehr-Familie, Letzter Wille): eine
  Wiederkehr würde sonst die Lebensdauer selbst bedeutungslos machen.
- **Champion** (NEU, dynamisch): am Ende jedes `updateGhosts()`-Ticks wird
  über alle lebenden Untertanen der stärkste nach `ghost.strengthWeights`
  (`LIVE-hp*weights.hp + damage*weights.damage`) bestimmt und trägt
  `g.isChampion` — kein Kartengate, kann den Titel im selben Raum verlieren,
  wenn er schwächer wird. Gleichstand gewinnt der ÄLTERE (Array-/
  Erzeugungsreihenfolge, striktes `>`). Teilt sich mit dem älteren,
  kartengebundenen (aktuell toten) `isCommander` denselben goldenen Ring im
  Renderer (`renderer.js: drawGhosts()`), NICHT verwechseln — beide Flags
  bleiben getrennte Felder.
- **Geisterbombe** (`tank.js: spawnGhostBomb()`): erzeugt jetzt einen
  **zufälligen** Typ aus dem Gegnerpool des aktuellen Akts
  (`state.actEnemyPool`, neu über `run.js: buildCombatRoom()` →
  `createState()`-Opt durchgereicht, Muster wie `roomModifier`/
  `eliteAffixes`) statt eines festen Basistyps — "man weiß vorher nicht, was
  man bekommt". Ein leerer/fehlender Pool fällt auf `t_brown` zurück statt
  abzustürzen. `run.js: unlockedEnemyTypes(diff, actIndex, roomIndexInAct)`
  ist dafür aus `buyEnemies()` extrahiert (reine Funktion, kein Run-Objekt
  nötig) und wird jetzt an zwei Stellen genutzt.
- **Darstellung**: ein schrumpfender heller Ring um jeden Untertanen zeigt
  seine verbleibende Lebensdauer (`renderer.js: drawGhosts()`, Radius
  `(r+10) * lifetime/lifetimeMax`) — ohne dieses sichtbare Gegenstück wäre
  der neue Todes-Ausslöser unerklärlich.
- **Neue Dauertests** (Abschnitte 42/43/45 aktualisiert bzw. erweitert,
  Gegenprobe für jeden Kernpunkt einzeln bestanden — je absichtlich rot
  gemacht: Typ-Vererbung ausgebaut → `TypeError` statt Checkfehler;
  Elite-/Boss-Ausnahme entfernt → 5 Checks rot; Überlaufwurf auf reinen
  Boolean-Wurf zurückgebaut → 2 Checks rot; Lebensdauer-Countdown entfernt →
  1 Check rot; die `cause`-Weiche an BEIDEN betroffenen Stellen in
  `killGhost()` einzeln ausgebaut → je 1 Check rot; Champion-Neuberechnung
  ausgebaut → 3 Checks rot, Gleichstand-Striktheit auf `>=` gelockert →
  2 Checks rot; Geisterbombe auf einen festen Typ zurückgebaut → 3 Checks
  rot, der `t_brown`-Rückfall entfernt → 1 Check rot; der Champion-Ring im
  echten Renderpfad ausgebaut → 1 Check rot): Typ-Vererbung (Basiswerte,
  unveränderte Panzerung/Rolle/Zielgenauigkeit inkl. eines echten
  Panzerungsobjekts, Mechanismus mit synthetischem `baseStatPct`, Instanz-
  vs.-Typ-Trennung), vereinheitlichte Reviveschwelle + Elite-/Boss-Ausnahme
  (inkl. Kombination mit einem regulären zweiten Kill im selben Raum),
  Überlauf-Spawnanzahl mit synthetischer `reviveChance` > 1 inkl. Deckel-
  Klemmung, Lebensdauer vor/nach Ablauf mit synthetisch verkürztem Wert,
  Ablauf-Tod löst weder Letzter Wille noch Wiederkehr aus (echter
  Schadens-Tod als Kontrolle), Feuer-Schwelle (unverändert, jetzt über
  `balance.ghost.rangePct`), Basistod ohne Zusatzeffekt + Idempotenz,
  Geistlimit ohne Verdrängung, Raumwechsel, Champion-Neuberechnung +
  Gleichstand-Tiebreak, Geisterbombe zieht wirklich aus dem Akt-Gegnerpool
  (zwei erzwungene Pool-Einträge) + Rückfall bei leerem Pool, End-to-End-
  Renderpfad über `domstub.mjs` (Champion-Ring erscheint als zusätzlicher
  `stroke()`-Aufruf, kein Absturz). Playwright-Smoke (Nekromant wählen, Run
  starten, Snapshot bestätigt `starterTank: 'c_necro'`, keine
  Konsolenfehler) bestanden.
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  **Nächste Sitzung: Phase 4** (Gegner zielen auf Untertanen).

### Nekromant-V2 — Phase 4 (Gegner zielen auf Untertanen) — bereits erfüllt, keine Codeänderung
**Ist-Abgleich statt Bau**: der komplette Auftragsumfang dieser Phase war
schon vor diesem Auftrag fertig — gebaut in **Upgradepool-v2 Phase 5**
(„Zielsystem der Gegner-KI", s. eigener Abschnitt weiter oben), lange bevor
`AUFTRAG-NEKROMANT-V2.md` existierte. Jeder einzelne Änderungspunkt der
Phasenbeschreibung wurde gegen den echten Code geprüft, nicht nur behauptet:
- **`ai.js: resolveTarget(tank, state)`** ist bereits die zentrale Funktion;
  `ai_drives.js` (alle vier Rollen) und `ai_turrets.js: roleTurret()` lesen
  ausschließlich darüber (verifiziert per `grep` — die einzige verbliebene
  `state.player`-Stelle in `ai_drives.js` ist `findCoverPoint()`, die laut
  Auftrag ausdrücklich **spielerbezogen bleiben soll**).
- **`data/balance.json: aggro`** steht bereits **wortgleich** zur
  Auftragsvorgabe: `reevaluateHz: 4`, `ghostThreatMult: 0.7`,
  `damageThreatPx: 120`, `damageThreatDecayS: 3`, `switchHysteresisPct: 0.25`,
  `noTargetFallbackS: 3`. `data/balance.json: boss.fixate` ebenso:
  `onPlayerS: 4`, `onGhostsS: 3`, `minPlayerShare: 0.4`.
- **Bosse fixieren bereits zeitgesteuert** (`bossai.js:
  resolveBossTarget()`/`resolvePhalanxTarget()`, `state.time`-Modulo, kein
  RNG) — Spiegel zeitgesteuert allein, Phalanx zusätzlich räumlich über
  `phalanxIndex`. Der Reaktorkern hat bewusst **keine** Sonderregel (läuft
  über die normale `guardian`-Rolle + `updateTargeting()`), exakt wie
  gefordert.
- **`tank.aimingAtPlayer`** ist bereits überall auf `fire && target ===
  state.player` verengt — sowohl im generischen Pfad (`state.js: stepState()`
  Zeile mit `t.aimingAtPlayer = fire && resolveTarget(t, state) ===
  state.player`) als auch in beiden Bossfunktionen.
- **Die getrennte Geschoss-vs-Geister-Kollisionsschleife** (`state.js`, seit
  Upgradepool-v2 Phase 5, um Resistenz/Schildpool aus Nekromant-V2 Phase 2
  erweitert) lässt Gegnergeschosse Untertanen treffen, ohne dass Untertanen
  in `state.tanks` stehen — der Raum gilt weiterhin korrekt als geräumt,
  sobald alle `state.tanks`-Gegner tot sind (`state.ghosts` zählt nicht mit).
- **Alle fünf Testschritte** sind durch bestehende Tests abgedeckt (keine
  davon musste für diese Phase geändert werden, da sich am geprüften
  Mechanismus nichts ändert): Testschritt 1/2/3 → Abschnitt 41
  (Grundmechanismus, Integration Fahr-/Turmverhalten, Sichtlinien-Fallback,
  kein Zielflackern); Testschritt 4 → Abschnitt 45 „Bosskampf-Korridor"
  (Spieleranteil ≥ 55 %, Untertanen-Anteil ≥ 10 %, Fixierungsfenster mit
  eigenen Zahlen nachgerechnet); Testschritt 5 → Abschnitt 41
  „`aimingAtPlayer` über die volle `stepState()`-Pipeline".
- **Einzige Prüfung, die diese Sitzung neu lief**: die volle
  Regressionssuite (inkl. der in Phase 3 grundlegend umgebauten
  Geister-Erzeugung — Typ-Vererbung, Lebensdauer, Elite-/Boss-Ausnahme)
  bleibt mit dem unveränderten Zielsystem grün, weil `resolveTarget()`
  strukturell unabhängig davon ist, WIE ein Geist entstanden ist oder wie
  lange er lebt — es liest nur `state.ghosts` zur Laufzeit.
- Keine Codeänderung, kein neuer Testabschnitt (nichts Neues zu bewachen),
  kein `sw.js`-Bump. **Nächste Sitzung: Phase 5** (Ereignis- und
  Stapelschicht).

### Nekromant-V2 — Phase 5 (Ereignis- und Stapelschicht) — gemergt
Das Fundament, auf dem alle 105 Karten aus `data/upgrades_necro.json` stehen
("ohne diese Phase werden die Pfade zu Sonderfällen im Code") — reine
Engine-Infrastruktur, **noch keine Karte hört zu** (Phase 6-9 füllen
`state.necroListeners`), Muster wie UMBAUPLAN-LP Phase 5s Statuseffekt-
System ("gebaut, bevor es die Elemente gibt"). Neues Modul
**`src/game/necro.js`** (ghost.js war mit 377 Zeilen bereits über dem
~300-Zeilen-Richtwert, ein cohesive Subsystem verdient wie `mortar.js`/
`status.js`/`damagetypes.js` eine eigene Datei).
- **Vier Auslöser** (`NECRO_REASONS`: `death_damage`/`death_expire`/
  `fusion`/`sacrifice`) und die Tabelle "löst Todeseffekte aus?" aus dem
  Auftrag als `countsAsGhostDeath(reason)` — `fusion` zählt bewusst NICHT
  (eine künftige Karte kann trotzdem explizit auf `'fusion'` hören, das ist
  eine andere Prüfung als die automatische Buchführung).
- **Zentrales Ereignis `onGhostRemoved(state, ghost, reason)`**
  (`ghost.js: killGhost()` ruft es NACH den beiden „überlebt doch"-Zweigen
  auf — ein geretteter Untertan ist kein Geistertod). Kennt **keine
  Karten-ID**: iteriert nur `state.necroListeners` (`{reasons, scope, key,
  cooldownS?, fn}`), aktuell eine leere Liste. Bumpt automatisch einen
  reservierten Stapel-Schlüssel `'_deaths'` (raum- UND runweit), damit jede
  künftige Karte (z. B. ghost_029/030 "nach jeweils 10 Geistertoden") densel-
  ben generischen `getNecroStack()`/`countThresholdCrossings()`-Pfad nutzen
  kann, ohne dass die Engine ihretwegen eine neue Funktion braucht.
- **Vier Stapelbereiche auf drei Speicher + einen Rechenweg reduziert**
  (keine Verhaltensänderung, nur eine schlankere Umsetzung): raumweit
  (`state.necroStacks`, kein `reset()` nötig — `state` wird bei jedem
  Raumwechsel ohnehin frisch angelegt), runweit (`state.necroRunStackGain`
  als raumlokaler, monoton wachsender Zuwachs — `run.js: stepRun()` synchro-
  nisiert ihn per Delta in `run.necroStacks`, exakt das Muster von
  `bonusScrap`/`seenBonusScrap`; ein Lesezugriff mitten im Raum addiert
  `state.necroRunStacksBase` — eine **flache Kopie** von `run.necroStacks`
  bei Raumbeginn — auf den bisherigen Zuwachs), zeitlich
  (`state.necroTimedStacks`, eigene Restlaufzeit je Schlüssel, `tickNecro
  Timers()` im Haupt-Tick, erneutes Auftragen erneuert nur die Dauer) und
  „Zähler" als reiner Rechenweg (`countThresholdCrossings(before, after, n)`
  — Ganzzahlteilung auf dem Gesamtwert statt eines mitgeführten Rests, dadurch
  von Natur aus überlauf-/NaN-sicher bei beliebig großen Werten).
- **Interne Abklingzeiten je Effekt-Schlüssel** (nicht global): nutzt die
  ohnehin laufende `state.time`-Uhr (`readyAt = state.time + cooldownS`)
  statt eines eigenen Countdown-Felds — zwei Auslöser im selben Tick
  (`state.time` unverändert) können denselben Schlüssel dadurch nachweislich
  nur einmal auslösen.
- **Virtuelle Tode** (`applyVirtualNecroDeaths(state, count)`) — der im
  Auftrag genannte Prüfstein für `ghost_035` "Vorbote des Endes": ein
  bewusst SEPARATER Pfad, der NUR `scope:'room'`-Listener mit
  `death_damage`/`death_expire` aufruft, dabei die automatische
  `_deaths`-Buchführung, das Ereignisprotokoll UND die interne Abklingzeit
  komplett umgeht (bypasst, statt sie zu respektieren) — sonst wäre die
  Trennung von Stapel und Ereignis nur behauptet, nicht bewiesen.
- **`run.js`**: `run.necroStacks`/`run.seenNecroRunStackGain` neu (persistiert
  über `runSnapshot()`, Fallback `{}` beim Fortsetzen älterer Zwischenstände),
  `resetRoomCounters()` setzt `seenNecroRunStackGain` pro Raum zurück,
  `buildCombatRoom()` reicht `necroRunStacksBase: { ...run.necroStacks }`
  **als Kopie** durch (ein gefundener Fehlgriff beim ersten Entwurf: eine
  geteilte Referenz hätte den schon synchronisierten Zuwachs nach dem
  nächsten Sync-Tick doppelt gezählt — nur über einen echten, durch
  `run.js` selbst gefahrenen Raumwechsel nachweisbar, ein händisch
  nachgebauter `createState()`-Aufruf im Test hätte ihn NICHT gefangen).
- **`src/render/debug.js`** (Testschritt 1: "unterscheidbar im Debug-
  Overlay"): neue Zeile zählt `state.necroEventLog` (letzte 20 Ereignisse)
  nach Auslöser gruppiert — „Untertan-Ereignisse 2× Schaden, 1× Ablauf" statt
  nur einer gemeinsamen Zahl.
- **`cfg.js`/`src/core/storage.js` brauchten KEINE Änderung** (beide in der
  Auftrags-Dateiliste genannt): `storage.js` ist ein reiner generischer
  Key-Value-Wrapper (Muster wie schon bei Grundsteinumbau Phase 6 für
  `actIndex` festgestellt) — `run.necroStacks` fließt einfach mit durch
  `JSON.stringify()`. `cfg.js` bekommt erst dann etwas zu tun, wenn Phase 6+
  echte Karten definiert, die `state.necroListeners` aus dem aufgelösten
  Spieler-`cfg` befüllen — diese Übersetzung ohne reale Karten-Schemata
  vorwegzunehmen wäre reine Spekulation gewesen.
- **Neuer Testabschnitt 57** (Gegenprobe für jeden Kernpunkt einzeln
  bestanden — je absichtlich rot gemacht: Reason-Filter im Dispatcher
  entfernt, `fusion` faelschlich als Geistertod gezaehlt, die
  Referenz-statt-Kopie-Falle in `necroRunStacksBase` wieder eingebaut
  (nur vom END-TO-END-Test über den echten `buildCombatRoom()`-Pfad
  gefangen, nicht vom direkten Mechanismustest), Timer-Löschung nach
  Ablauf entfernt, Dauer-Erneuerung ausgebaut, `countThresholdCrossings()`
  auf eine ungenaue Rundungsformel zurückgebaut, die interne Abklingzeit
  auf einen globalen Schlüssel verengt, der `onGhostRemoved()`-Aufruf aus
  `killGhost()` entfernt, der Scope-Filter UND der Cooldown-Bypass in
  `applyVirtualNecroDeaths()` je einzeln ausgebaut, die Debug-Zeile entfernt,
  `necroStacks` aus `runSnapshot()` entfernt — mehrere davon crashen hart
  statt nur einen Check zu röten, auch das zählt als bestandene Gegenprobe):
  Struktur (vier Auslöser, Todeseffekt-Tabelle), zentrale Zustellung nach
  deklarierten `reasons[]` ohne Karten-ID, automatische `_deaths`-Buchführung
  raum- UND runweit, raumweiter Stapel-Reset bei Raumwechsel, runweiter
  Stapel-Sync über einen echten Run (Delta-Sync-Mechanismus UND — als
  eigener End-to-End-Test — über den tatsächlichen `run.js:
  buildCombatRoom()`-Pfad, der den Referenz-vs-Kopie-Fund erst zutage
  förderte), Speichern/Laden über echten Snapshot + `createRun({resume})`,
  zeitlich befristeter Stapel (Ablauf + Dauer-Erneuerung ohne Wert-
  Verdopplung), `countThresholdCrossings()` mit eigenen (teils sehr großen)
  Zahlen, interne Abklingzeit je Schlüssel (nicht global) + Ablauf-Verhalten,
  Testschritt 5 wörtlich (zwei Tode im selben Tick lösen den Effekt nur
  einmal aus), `killGhost()`-Verdrahtung (Schaden→death_damage, Ablauf→
  death_expire, ein geretteter Untertan löst nichts aus), virtuelle Tode
  (nur raumweite death-Listener, Bypass von Buchführung/Protokoll/
  Abklingzeit), Debug-Overlay über den echten Renderpfad (`domstub.mjs` +
  aufzeichnender Fake-Canvas).
- Kein `sw.js`-Bump (reine Code-Datei, kein neues Asset). Playwright-Smoke
  (Nekromant wählen, Run starten, Snapshot bestätigt `starterTank:
  'c_necro'`, keine Konsolenfehler) bestanden.

### Nekromant-V2 — Phase 6 (Allgemein und Opfer, 35 Karten) — gemergt
Die Brücke von Phase 5s reiner Infrastruktur zu echten Karten: `ghost_001`
bis `ghost_035` (`ghost_031` „Märtyrerbefehl" ausgenommen — Aktivkarte,
Phase 9) wirken jetzt alle über neue `ghost*`/`necro*`-`core`-Schlüssel.
**Kein separates Nekromanten-Effektsystem** — dieselbe generische
`core`-Applier-Schleife (`cfg.js: applyUpgrades()`) wie jede andere Phase
des Projekts, nur um ~35 neue, flache Skalarschlüssel erweitert (keine
verschachtelte „effect/effectValues"-Struktur — bewusst gegen Anhang A §14
entschieden, die bestehende flache Konvention ist bereits die geforderte
datengetriebene Effektschicht).
- **`necro.js: buildNecroListeners(state, cfg)`** (neu) ist die eigentliche
  Brücke: EINMAL pro Raumaufbau (`state.js: createState()`, direkt vor
  `return state`) liest sie die neuen `core`-Felder aus dem aufgelösten
  Spieler-`cfg` und trägt daraus `state.necroListeners`-Einträge ein — jede
  `if (cfg.xyz)`-Zeile spiegelt genau eine Karte, „kein switch über
  Karten-IDs" bleibt gewahrt (jede Bedingung prüft nur ein Feld, nie eine
  id). Reservierte Stapel-/Timed-Schlüssel (beginnen mit `_`, kollidieren
  nie mit einer Karten-id): raumweite Plain-Prozentsätze `_pctDamage`/
  `_pctFireRate`/`_pctSpeed` (ghost_011–013), zeitlich befristete Werte mit
  je EIGENEM Schlüssel `_timedDmgErbschaft`/`_timedFireRateFuel`/
  `_timedResistHaerte`/`_timedRequiemDmg`+`_timedRequiemFireRate`+
  `_timedRequiemSpeed` (021/024/022/034 — je eigener Schlüssel, damit zwei
  Karten sich nicht gegenseitig überschreiben statt zu addieren), runweite
  permanente `_runDmgBonus`/`_runHpBonus` (029/030). `tank.js`/`state.js`
  summieren am Ort der Verwendung über eine feste, bekannte Liste dieser
  Schlüssel (`necro.js: necroDamagePct/-FireRatePct/-SpeedPct/
  -ResistBonus()`), kein neuer API-Mechanismus nötig.
- **`pureStack` (NEU seit dieser Phase, Verschärfung von Phase 5s
  `applyVirtualNecroDeaths()`)**: markiert einen Listener, dessen EINZIGE
  Wirkung das Erhöhen eines raumweiten Spielerstapels ist — keine Heilung,
  keine Explosion, kein Zähler, keine Abklingzeit. Aktuell exakt
  `ghost_011`/`012`/`013`. Nur DAS ist die Klasse, auf die `ghost_035`s
  virtuelle Tode zielen dürfen (die alte Phase-5-Filterung „scope==='room'"
  allein wäre jetzt zu grob — es gibt echte Listener mit Seiteneffekten) UND
  auf die `ghost_027`/`028`s Stapel-Multiplikator wirkt. `onGhostRemoved()`
  berechnet den Multiplikator (`ghost_027` „Kettenopfer": 20 % Chance auf
  Verdopplung via `state.rng()`; `ghost_028` „Treues Ende": ×1,6 bei
  `death_expire`) und reicht ihn als 4. Parameter `mult` nur an
  `pureStack`-Listener durch — alle anderen bekommen immer `1`.
- **`ghost_010` „Jenseitsziel"** ist die einzige Karte, die laut Auftrag
  „eine Erweiterung der Fahrlogik, nicht nur einen Wert" braucht:
  `ghost.js: updateGhosts()` bekommt eine separate `moveAngle` (Ziel um
  ±70 px seitlich + 40 px zurückversetzt, fester Seitenwert je Geist über
  `g.id % 2`, damit er nicht jeden Tick wechselt), während `g.heading`/
  `g.turret` weiterhin exakt auf das Ziel ausgerichtet bleiben — Fahrkurs
  und Rohrausrichtung sind jetzt zwei getrennte Werte (`aimDx`/`aimDy` für
  den Mündungspunkt, `dx`/`dy` für die Bewegung). `ghostFlankDamageBonus`
  (der zweite Teil der Karte) liegt bewusst auf dem **Spieler**-cfg, nicht
  auf `b.owner.cfg` (der Geist-eigenen cfg) — `state.js`s Trefferschleife
  liest ihn deshalb explizit über `state.player?.cfg?.ghostFlankDamageBonus`
  bei `b.owner?.isGhost`, als zusätzlicher Faktor NEBEN dem normalen
  Flanken-/Heck-Multiplikator aus Grundsteinumbau Phase 2.
- **`ghost_007` „Totenpräzision"** (Krit für Geistergeschosse) und
  **`ghost_006`/`009`/`018`/`032`** (Geschosstempo/Reichweite/Resistenz/
  Durchschlag/Zielsucher) sind reine Wiederverwendung bestehender Felder:
  `bullet.js: createBullet()` bekommt ein neues `critMultBonus`-Feld
  (**eingefroren wie `damage`/`crit`**, weil `ghost_019`s Krit-Bonus eine
  EINMALIGE Schuss-Ladung ist, die nicht auf `tank.cfg` liegen kann — die
  gilt für JEDEN Schuss). `state.js`s `critMult`-Formel addiert jetzt
  `(oc?.critMultBonus||0) + (b.critMultBonus||0)` — **wichtiger
  Umsetzungsfund**: für einen geist-eigenen Schuss (`ghost_007`) liegt der
  Bonus schon in `g.cfg.critMultBonus` (also `oc?.critMultBonus`) — ein
  zusätzliches Kugel-Feld hätte ihn doppelt gezählt. `ghost.js`s eigener
  Krit-Wurf (`state.rng() < g.cfg.critChance`) setzt deshalb bewusst
  **kein** `critMultBonus` auf der Kugel, nur `crit`.
- **`player.necroBulletBuffs`** (neu, Array von `{shotsLeft, damageMult?,
  sizeMult?, pierceAdd?, bulletSpeedMult?, critChanceAdd?, critMultAdd?}`):
  generische „nächste(r) Schuss/Schüsse"-Warteschlange für `ghost_017`
  (Opferladung, alle 4 Tode)/`018` (Knochenmunition, jeder Tod)/`019`
  (Totenblick, jeder Tod — Vereinfachung „nächster SCHUSS" statt wörtlich
  „nächster TREFFER", dokumentiert im Code). `tank.js: fireBullet()`
  summiert alle aktiven Ladungen (multiplikativ bei Faktoren, additiv bei
  Bonuspunkten) EINMAL pro Abzug, bäckt sie in die erzeugte(n) Kugel(n) ein
  und dekrementiert `shotsLeft` **einmal pro Abzug**, nicht je Kugel eines
  Streu-/Doppelrohr-Schusses.
- **`ghost_025` „Letzte Deckung"** ist ein direkter Hook in
  `state.js: applyDamage()`s letztem Fallthrough-Zweig (NACH allen
  Abwehr-Gattern, VOR dem hp-Abzug) — kein `necroListeners`-Eintrag, weil
  „Ohne aktiven Untertanen wirkungslos" eine reine Rettung ohne
  Kaskadeneffekte sein soll: der geopferte Geist wird direkt auf
  `alive=false` gesetzt (kein `killGhost()`-Aufruf, löst also keine
  weiteren Karteneffekte wie Explosionen/Wiederkehr aus). `state.
  necroLastStandUsed` (neu, `false` bei jedem `createState()`) sperrt eine
  zweite Rettung im selben Raum, auch wenn ein zweiter Untertan verfügbar
  wäre.
- **`ghost_026` „Opferstoß"** (Druckwelle) senkt/hebt die Exekutionsschwelle
  (Grundsteinumbau Phase 2) für getroffene Gegner zeitlich befristet auf
  einen **absoluten** Wert (`t.necroExecUntil`/`t.necroExecThreshold`,
  `Math.max` gegen den globalen Grundwert in `stepState()`s
  Exekutions-Timer-Schleife) — „senkt sie auf 50 %" ist eine Ersetzung,
  kein Delta.
- **`ghost_015` „Aschenhaut"** (Schild-Stapel mit Deckel + Verfall) nutzt
  bewusst **keinen** `necroTimedStacks`-Eintrag, sondern zwei eigene Felder
  auf dem Spieler-Panzer (`tank.necroShieldStackAmount`/
  `-StackExpiresAt`) — ein generischer Timed-Stack kennt seinen Anteil am
  geteilten `tank.shield`-Pool nicht; beim Verfall (neue Zeile in
  `stepState()`s Haupttick, VOR der Exekutions-Schleife) wird GENAU der
  selbst gewährte Anteil abgezogen, nicht der ganze Pool (der auch aus
  anderen Quellen gespeist sein kann).
- **`ghost_029`/`030`** (permanente Run-Boni nach je 10 Toden) laufen über
  eine neue `cfg.js: applyNecroRunScaling(cfg, runDmgBonusPct,
  runHpBonusPct)` — `run.js: buildCombatRoom()` liest
  `run.necroStacks._runDmgBonus`/`_runHpBonus` (vom Delta-Sync aus
  vorherigen Räumen schon aktuell) und reicht sie als `necroRunDmgBonus`/
  `necroRunHpBonus`-Opts an `createState()`/`respawnPlayer()` durch — an
  derselben Stelle wie `applyScrapDamage()` (Phase 9), „einmal pro
  Raumaufbau gebacken".
- **`ghost_014`/`023`** (Heilung + Überlauf-in-Schild) sitzen in EINEM
  Listener: der Heilbetrag wird berechnet, der Überschuss über volles Leben
  hinaus geht bei gesetztem `necroOverflowShieldCapPct` (023, `requires:
  ["ghost_014"]`) in den Schild-Pool statt verloren zu gehen.
- **`ghost_034` „Unheiliger Höhepunkt"** (Requiem) ist die einzige Karte mit
  einer echten rollierenden Fensterlogik: `state.necroKeystoneDeathTimes`
  (neues, kleines Zeitstempel-Array, nur für diese Karte) wird bei jedem
  Tod gefiltert (nur Einträge innerhalb `necroKeystoneWindowS`) und geprüft
  — weder ein einfacher Stapel noch die interne Abklingzeit allein könnten
  „3 Tode innerhalb von 4 Sekunden" abbilden.
- **`data/upgrades_necro.json`**: alle 34 Karten (außer `ghost_031`) tragen
  jetzt echte `core`-Werte statt `{"_todo":"effect"}`. Drei Karten haben
  zusätzlich `_todo: "balance"` (Wert nicht aus der Kartenbeschreibung
  ableitbar, sondern selbst gewählt): `ghost_016`s interne
  Abklingzeit-Sperre (0,6 s hätte sonst gespammt werden können), `ghost_026`s
  Rückstoß-Distanz (40 px), `ghost_032`s Zielsucher-Lenkrate (3 rad/s).
- **Neuer Testabschnitt 58** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt einzeln bestanden — je absichtlich rot gemacht: `buildNecroListeners()`-
  Aufruf in `createState()` entfernt (röted b/c/d/f/g/i-Zielsucher/l auf
  einen Schlag), `ghost_025`s Last-Stand-Bedingung deaktiviert,
  `ghostFlankSeek`-Zweig deaktiviert, der Flanken-Bonus-Faktor aus der
  Schadensformel entfernt, `necroBulletBuffs`-Durchschlag aus dem
  Kugelaufruf entfernt, `applyNecroRunScaling()` zu einem No-op gemacht,
  die Timed-Resistenz-Anwendung in `applyDamage()` ausgebaut, die
  Schild-Verfall-Zeile ausgebaut, ein Kartenkern probeweise auf `_todo`
  zurückgesetzt): Struktur (35 Karten vorhanden, alle außer `ghost_031`
  mit echtem `core`, NaN-Sicherheitstest gegen die upgradelose
  Nekromanten-Basis), die fünf offiziellen Testschritte wörtlich
  (`ghost_011` Stapel steigt/fällt beim Raumwechsel, `ghost_014` heilt
  spürbar + interne Abklingzeit verhindert Doppelheilung, `ghost_020`
  explodiert bei BEIDEN Todesarten, `ghost_025` rettet UND ist ohne
  Untertan wirkungslos UND nur einmal pro Raum, `ghost_035` stellt die
  Stapel sofort ohne Heilung auszulösen), `ghost_027`/`028`s
  Stapel-Multiplikator (inkl. Gegenprobe für die verfehlte Chance und den
  falschen Auslöser), `ghost_010`s Fahrlogik (isoliert von Wandkollision
  über ein wandloses Testfeld — ein erster Entwurf mit Wänden hätte auch
  OHNE die Karte eine Kursabweichung gezeigt und die Gegenprobe nicht
  bestanden) + Flankenbonus, `ghost_018`/`032`s Bullet-Felder,
  `applyNecroRunScaling()` mit eigenen Zahlen + End-to-End über
  `createState()`, `ghost_022`s Timed-Resistenz am echten Treffer,
  `ghost_015`s Wachstum + Deckel + Verfall. Ein echter Testbau-Fund:
  `applyUpgrades()`/`createState()` erwarten als `upgradesData`-Parameter
  das GANZE geladene JSON-Objekt (mit `.upgrades`-Schlüssel), nicht den
  bereits entpackten Kartendict — `necroData.upgrades` statt `necroData`
  übergeben ließ jede Karte lautlos wirkungslos bleiben (kein Fehler, nur
  ein leerer Lookup), bis die erste echte Testausführung 15 Checks auf
  einen Schlag rot zeigte.
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  Playwright-Smoke (Nekromant wählen, Run starten, Snapshot bestätigt
  `starterTank: 'c_necro'`, keine Konsolenfehler) bestanden.

### Nekromant-V2 — Phase 7 (Legion, 25 Karten) — gemergt
`ghost_036` bis `ghost_060`: deutlich mehr Untertanen, stärker in der
Gruppe. Zwei neue architektonische Bausteine tragen den ganzen Topf: eine
Plätze- statt Anzahl-Buchführung (wegen `ghost_056`) und ein expliziter
Neuberechnungs-Cache für die reinen Zähler-Karten (Auftrags-Vorgabe „nicht
pro Frame").
- **`ghost.js: occupiedGhostSlots(state)`** (neu, exportiert): Summe
  `g.slotCost` über alle lebenden Untertanen statt der reinen Array-Länge —
  ein wiederbelebter Elite-Untertan (`ghost_056`) belegt 2. JEDE Stelle, die
  bisher gegen `state.ghosts.length` prüfte (`state.js: killTank()`s
  Wiederbelebungs-Block, `tank.js: spawnGhostBomb()`, der `ghost_033`-
  Raumstart-Hook), prüft jetzt dagegen.
- **`ghost.js: recomputeLegionCache(state)`** (neu, exportiert): die vom
  Auftrag verlangte „zählerbasierte Skalierung ... neu berechnen bei Spawn
  und Entfernen, NICHT pro Frame" — berechnet `necroActiveGhostCount`/
  `necroLegionResistBonus` (`ghost_038`)/`necroPackMult` (`ghost_039`, aus
  dem Bestand `ghostPackDamagePerAlly` von Upgradepool-v2 Phase 8, bisher
  fälschlich JEDEN Tick in `updateGhosts()` neu berechnet — jetzt hierher
  verschoben)/`necroLegionFireRatePct` (`ghost_040`)/`necroOverwhelmActive`
  (`ghost_045`)/`necroSharedWillActive` (`ghost_057`) — EINMAL, aufgerufen
  ausschließlich von den drei Erzeugungsstellen und `killGhost()` (der
  einzige Entfernungs-Trichter, Schaden UND Ablauf). **Bewusst NICHT
  hier**: die drei „Abstandsauren" (`ghost_042`/`048`/`049`) — die hängen
  von Positionen ab, die sich jeden Tick ändern, und werden deshalb
  weiterhin live in `updateGhosts()` bewertet (mit sichtbarem Ring je
  Karte, Auftrag: „sonst versteht niemand, warum Werte schwanken").
- **`state.js: killTank()`s Wiederbelebungs-Block komplett neu**, weil
  fünf Karten (`044`/`052`/`054`/`055`/`056`/`060`) alle an derselben
  Stelle greifen: `necroReviveChanceAdd` (`044`/`055`) ist additiv OHNE
  Deckel auf die Chance; `necroEliteRevive` (`056`) hebt die Elite-Ausnahme
  gezielt auf (Bosse bleiben in JEDEM Fall ausgeschlossen) und der
  wiederbelebte Elite-Untertan bekommt `slotCost: 2` + einen eigenen
  Basiswert-Anteil über `ghost.js: createGhost()`s neuen `overrides`-
  Parameter (`{baseStatPctOverride, slotCost}` — dieselbe Skalierungs-Ratio
  wie `ghost_033` aus Phase 6, kein zweiter `resolveGhostCfg()`-Zweig);
  `necroDoubleReviveChance` (`052`) und `necroGuaranteedReviveCopy` (`060`)
  hängen je einen weiteren, unabhängigen Spawn-Versuch an eine gelungene
  Probe; `necroCoreHealPct`/`necroCoreDamageBonus` (`054` „Legionskern")
  greift NUR, wenn die Probe gelingt, aber `occupiedGhostSlots(state) >=
  ghostCap` (kein Platz mehr) — heilt/stärkt dann die VORHANDENEN
  Untertanen bis Raumende statt eines wirkungslosen Spawnversuchs, mit
  eigener kleiner Abklingzeit (`state.necroCoreCooldownUntil`, kein
  `necro.js`-Umweg nötig).
- **`ghost_041` „Geteiltes Ziel" + `ghost_010`s Flankier-Bewegung
  zusammengelegt**: `updateGhosts()`s Zielwahl bevorzugt
  `state.necroLastPlayerHitTarget` (neu, in der Spieler-Trefferschleife in
  `state.js` gesetzt, sobald eine EIGENE Kugel einen Nicht-Spieler trifft),
  solange es lebt, sonst der normale nächstgelegene Gegner. Der
  Flankier-Bewegungspfad aus Phase 6 (`ghost_010`) ist jetzt eine
  gemeinsame Bedingung (`ghostFlankSeek || necroSharedTarget`) — beide
  Karten wollen dasselbe „umfährt das Ziel zur ungeschützten Seite".
- **`ghost_057` „Gemeinsamer Wille"**: die Geist-vs-Geschoss-Kollisions-
  schleife in `state.js` verteilt den Schaden ab der Schwelle GLEICHMÄSSIG
  auf ALLE lebenden Untertanen (VOR Resistenz/Schild — jeder Empfänger
  rechnet seine eigene Abwehr), statt nur den getroffenen zu treffen.
- **`ghost_053` „Verstärkte Hülle"**: ignoriert EINMAL je Leben einen
  Treffer über der Schwelle, gemessen am fertig berechneten Schaden (NACH
  Resistenz, VOR Schild) — ein neues `g.hullUsed`-Flag, das erst mit dem
  nächsten frisch erzeugten Untertan wieder `false` ist.
- **`ghost_058` „Chor der Toten"**: Untertanen-Treffer bekommen zusätzlich
  die HÄLFTE des GLOBALEN Flanken-/Heck-Faktors (`data/balance.json:
  flank`) als eigenen Bonus — „die Hälfte des Flankenbonus des
  Hauptpanzers" liest sich als der globale Wert, weil der Spieler selbst
  keinen individuellen Flankenbonus-Stat besitzt.
- **`ghost_059` „Grabfeld"**: `state.necroGraveyardSpots` (raumweit, FIFO
  auf 3, in `necro.js: buildNecroListeners()` bei jedem Untertanen-Tod
  befüllt) wird von `createGhost()` beim Spawnen gelesen — ein neuer
  Untertan nahe einem gemerkten Sterbeort ist stärker. Radius
  (`data/balance.json: ghost.graveyardRadiusPx`, 40) ist der einzige Wert
  dieses Kartentopfs ohne Beleg im Kartentext.
- **Echter Bugfund**: `ghostHpMult`/`ghostDamageMult` wurden seit
  Upgradepool-v2 Phase 8 in `cfg.js` gesammelt, aber `ghost.js:
  resolveGhostCfg()` hat sie NIE gelesen — ein reiner Blindgänger, unbemerkt,
  weil die einzigen Karten, die sie setzten (`sig_necro_*`), seit
  Grundsteinumbau Phase 4 archiviert sind. `ghost_060` „Armee der Toten"
  ist die erste seither wieder erreichbare Karte, die `ghostDamageMult`
  setzt (−15 % Schaden für alle Untertanen) — jetzt gefixt: additiv (Add)
  zuerst, danach multiplikativ (Mult), wie beim generischen Applier-Muster
  überall sonst im Projekt.
- **Sichtbare Ringe** (Auftrag: „sonst versteht niemand, warum Werte
  schwanken"): `renderer.js: drawGhosts()` bekommt drei neue Ringe —
  türkis (`ghost_042` Phalanx), gestrichelt hellblau (`ghost_048`
  Schildwall), lila (`ghost_049` Offizier) — auf unterschiedlichen Radien,
  damit sie gleichzeitig unterscheidbar bleiben.
- **Neuer Testabschnitt 59** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt einzeln bestanden — u. a.: der `ghostDamageMult`-Bugfix selbst
  zurückgebaut, die Elite-Ausnahme in `canRevive` wieder scharf gestellt,
  die Schadensverteilung von `ghost_057` auf `[g]` zurückgesetzt, `ghost_053`s
  Hüllen-Bedingung auf `false`, `ghost_054`s Deckel-Zweig deaktiviert, die
  Phalanx-/Offizier-/Schildwall-Auren einzeln stillgelegt, `ghost_041`s
  Zielüberschreibung ausgebaut, `ghost_046`s Veteranen-Zweig auf `false`,
  `ghost_050`s Deckel-Klemmung entfernt, `ghost_051`s Listener deaktiviert,
  `ghost_059`s Grabfeld-Zweig auf `false`): die fünf offiziellen
  Testschritte wörtlich (`ghost_036` ×10 → 13 gleichzeitige Untertanen ohne
  Sperre, `ghost_039` erhöht den Schaden mit mehr Untertanen, `ghost_049`s
  Offizier + Nähe-Bonus, „Totenruf" ×10 steigt linear und bleibt im Pool
  (`isUnique:false`), `ghost_056`s Elite-Untertan belegt 2 Plätze), dazu
  Mechanismus-Tests für `occupiedGhostSlots`/`recomputeLegionCache`
  („nicht pro Frame" explizit nachgewiesen: ein Geist, der ohne den
  Funktionsaufruf ins Array gelangt, ändert den Cache noch nicht), sowie
  je einen Test für die übrigen 18 Karten. **Fund beim Testbau**: direkt
  gewählte Testkoordinaten (z. B. `(0,0)`) liegen oft außerhalb des von
  `createState()` generierten Kartengrids — `isSolid()`/`blocksSight()`
  lesen aus dem GRID-Closure der Raumgenerierung, nicht aus `state.walls`
  (ein bloßes `state.walls=[]` reicht deshalb NICHT); `legionRoom()`
  überschreibt deshalb `st.isSolid`/`st.blocksSight` direkt. Ein zweiter
  Fund: ein echter, im generierten Raum vorhandener Gegnertank kann eine
  direkt injizierte Testkugel VOR der Geister-Kollisionsschleife abfangen
  (die Haupt-Trefferschleife läuft zuerst) — betroffene Tests (`ghost_053`/
  `057`) setzen `st.tanks = [st.player]`. Ein dritter Fund: eine nach
  Aufrufreihenfolge gezählte `state.rng()`-Stub-Sequenz ist fragil, weil
  `killTank()` für `spawnParticles()` selbst schon viele `rng()`-Aufrufe
  VOR dem Wiederbelebungswurf macht (`ghost_052`s Gegenprobe nutzt
  stattdessen einen festen Wert 0,25, der unabhängig von der Aufrufstelle
  „Basis-Chance trifft, Doppel-Chance verfehlt" ergibt).
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  Playwright-Smoke (Nekromant wählen, Run starten, Snapshot bestätigt
  `starterTank: 'c_necro'`, keine Konsolenfehler) bestanden.

### Nekromant-V2 — Phase 8 (Alpha und Verschmelzung, 25 Karten) — gemergt
Der laut Auftrag „aufwendigste Teil": Champion und Fusion. `ghost_061` bis
`ghost_085`. Zwei neue architektonische Bausteine tragen den ganzen Topf.
- **`ghost.js: pushGhost(state, g)`** (neu, exportiert) ist ab jetzt der
  EINZIGE Erzeugungs-Hook — alle sechs bisherigen `state.ghosts.push(
  createGhost(...))`-Aufrufstellen (`state.js: killTank()`s Wiederbelebungs-
  Block ×3, der `ghost_033`-Raumstart-Hook; `tank.js: spawnGhostBomb()`)
  rufen ihn jetzt auf, statt „Einziger Thron" sechsmal zu duplizieren. Ohne
  `necroUniqueThrone` unverändertes Verhalten (reiner Push +
  `recomputeLegionCache()`).
- **`ghost_071` „Einziger Thron"**: `pushGhost()` vergleicht bei gesetztem
  `necroUniqueThrone` den neu erzeugten Geist gegen den EINEN vorhandenen
  (Karte begrenzt die Population dadurch selbst auf 1) über dieselbe
  Stärkeformel wie die Champion-Bestimmung — der SCHWÄCHERE verschmilzt in
  den STÄRKEREN (`fuseGhost()`). Übertragen werden Anteile der **Basiswerte**
  des Verschmolzenen (`baseMaxHp`/`baseDamage`/`baseFireCooldown`, Phase 3),
  NICHT seiner aktuellen Werte (Auftrag: „sonst schaukelt sich das
  exponentiell auf") — ein gemeinsamer Helfer `applyFusionTransfer(g, hpFrac,
  dmgFrac, frFrac)` rechnet das für `fuseGhost()` UND die
  Kronenerbe-Übertragung (s. u.) identisch. Restlebenszeit steigt auf
  mindestens `necroFusionMinLifetimeS` (Standard 10s). „Verschmelzung ist
  KEIN Geistertod" — `onGhostRemoved(state, loser, 'fusion')` wird trotzdem
  aufgerufen (Phase 5s `countsAsGhostDeath()` schließt `'fusion'` weiterhin
  aus, ein künftiger, ausdrücklich lauschender Listener wäre also möglich).
- **„Getrennte Buchführung dreier Bonusarten"** (Auftrag): Basiswerte
  (unverändert seit Phase 3), **Fusionsboni** (`g.fusionHpFrac`/
  `-DamageFrac`/`-FireRateFrac`/`fusionCount`/`fusionBulletSizeBonus`, PRO
  GEIST-INSTANZ gespeichert — die einzigen, die ghost_080 tatsächlich
  übertragen muss), **Kronenboni** (`necroCrown*`, bewusst STATELESS — live
  gegen `g.isChampion` ausgewertet, jeder neue Champion liest sie automatisch
  selbst aus demselben Spieler-cfg, braucht also KEINE Übertragung).
- **`ghost_072`/`ghost_073`** (beide `requires: ["ghost_071"]`): zusätzliche
  Übertragungsrate je Verschmelzung bzw. Auffüllung+Verlängerung der
  Lebenszeit bei jeder Verschmelzung — beide reine `fuseGhost()`-Parameter,
  keine neue Logik.
- **`ghost_085` „Seelenkoloss" ERSETZT** die Übertragungswerte von 071/072,
  statt zu addieren — neues Datenfeld `core.necroFusionReplace` (+ eigene
  `necroFusionReplace*`-Werte), in `fuseGhost()` geprüft NACH den 071/072-
  Werten, überschreibt sie komplett statt sie aufzuaddieren (Testschritt 4).
- **`ghost_080` „Kronenerbe"**: `killGhost()` merkt beim Tod des Champions
  (Schaden ODER Ablauf, nicht Fusion — dort überlebt der Champion i. d. R.
  ohnehin) `state.necroCrownHeir` (60 % der Fusionsboni + ein
  10-Sekunden-Fenster, `balance.json: ghost.crownHeirWindowS`). `createGhost()`
  prüft das Fenster bei JEDER Neuerzeugung und wendet die Übertragung über
  denselben `applyFusionTransfer()` an — „einmal pro Raum"
  (`necroCrownHeirUsed`). Kronenboni brauchen keine Übertragung (s. o.).
- **Neun eigenständige Alpha-Karten** (061–070 minus 071, plus 074/077/078/
  081–084) wirken OHNE `requires` auf 071 — nur 072/073/085 haben eine
  Voraussetzung (Auftrag: „nur drei Karten haben eine Voraussetzung").
  Champion-Bestimmung ist dafür an den **ANFANG** von `updateGhosts()`
  gewandert (bis Phase 7 stand sie am Ende) — Kronen-/Anker-/Aura-Karten
  brauchen VOR dem restlichen Tick zu wissen, wer Champion ist.
- **Permanente vs. wiederholte Kronenboni**: `ghost_061`/`063` (Schaden/
  Leben/Resistenz) sind EINMALIGE Boni je Geist-Instanz (`g.crownBonusesApplied`,
  verhindert doppeltes Aufaddieren bei einem Titelwechsel — verliert/
  gewinnt dieselbe Instanz die Krone erneut, wird der Bonus NICHT
  wiederholt); `ghost_067`/`068` (Schild/Lebenszeit) gelten dagegen bei
  JEDER Krönung erneut (Kartentext: „Sobald ein Untertan zum Champion wird").
- **`ghost_066` „Vorrang des Stärkeren"**: der Champion zielt auf den Gegner
  mit dem höchsten MAXIMALEN Leben (`strongestEnemyByMaxHp()`, neu) statt des
  nächstgelegenen, umfährt ihn zur ungeschützten Seite (teilt sich den
  Flankier-Bewegungspfad aus Phase 6/7 mit `ghost_010`/`ghost_041`) und
  bekommt Projektiltempo-/Reichweitenboni.
- **`ghost_070` „Herrscheraura"**: `updateGhosts()` markiert Gegner im
  Champion-Radius als `t.necroAuraWeakened` (Muster wie `t.aimingAtPlayer`) —
  gelesen an ZWEI Stellen in `state.js`s Haupt-Trefferschleife: ein
  markierter Gegner richtet weniger Schaden gegen den SPIELER an, nimmt aber
  von UNTERTANEN mehr Schaden. Das Flag stammt vom VORHERIGEN
  `updateGhosts()`-Tick (Aufrufreihenfolge in `stepState()`), ein bekannter,
  harmloser Ein-Tick-Versatz wie bei der Champion-Bestimmung selbst.
- **`ghost_076`/`ghost_078`**: Schuss-Zähler `g.shotCount` je Untertan.
  `ghost_076` „Erbgeschütz" feuert jeden dritten Schuss ein ZUSÄTZLICHES
  Geschoss (reduzierter Schaden, keine eigenen Cooldown-Kosten); `ghost_078`
  „Alpha-Schuss" macht jeden fünften Schuss selbst stärker (+100 % Schaden,
  +1 Durchschlag).
- **`ghost_079` „Unantastbarer" / `ghost_084` „Unsterblicher König"**: beide
  fangen einen tödlichen Treffer VOR `killGhost()` ab, direkt in der
  Geist-vs-Geschoss-Kollisionsschleife (`state.js`) — 079 einmal pro Raum
  (`g.unassailableUsed`, kein Cooldown), 084 wiederholbar mit eigener
  Abklingzeit (`g.immortalKingReadyAt`). Ein neues `g.invulnUntil`-Fenster
  wird GANZ AM ANFANG der Schleife geprüft (`if (rg.invulnUntil > state.time)
  continue;`) — verhindert, dass ein zweiter Treffer im selben kurzen Fenster
  die Rettung sofort wieder aufhebt.
- **`ghost_081` „Seelenmonolith"**: `g.anchorTimer` läuft hoch, solange
  `|g.vx,vy| < 1` UND der Geist Champion ist; ab `necroCrownAnchorAfterS`
  gilt `g.anchored` — Schaden-/Reichweiten-/Resistenzbonus, bis er sich
  wieder bewegt (kein Kartengate nötig, reiner Live-Zustand).
- **`ghost_082` „Kronjäger"**: wiederverwendet 1:1 den `ghost_026`-Mechanismus
  aus Phase 6 (`t.necroExecUntil`/`t.necroExecThreshold`, Grundsteinumbau
  Phase 2s Exekutionsschwelle) — greift direkt in die Fundament-Mechanik ein,
  ohne einen zweiten Mechanismus zu bauen.
- **`ghost_075` „Raubseele"**: Heilung an genau der Stelle in der
  Trefferschleife, an der `schaden` fertig berechnet ist (nicht kill-basiert
  wie das ältere Seelensog aus Upgradepool-v2 Phase 8) — Überlauf über volles
  Leben hinaus geht in den Schild-Pool, gedeckelt auf einen Anteil des
  maximalen Lebens.
- **Echter Bugfund beim eigenen Testbau, per Gegenprobe entdeckt**: die
  erste Fassung von `ghost_061`s Test prüfte nach dem Umbau auf „nur einmal
  angewendet" nur noch `dmgAfterFirst === g.cfg.damage` (Vergleich mit sich
  selbst) — ohne jemals zu prüfen, dass der Bonus überhaupt einmal ankommt.
  Mit der Applier-Zeile stillgelegt blieb der Test **trivial grün** (beide
  Seiten blieben gleich dem unveränderten Basiswert). Fix: die ursprüngliche
  „Bonus > Basis"-Prüfung wieder ergänzt, zusätzlich zur „kein zweites Mal"-
  Prüfung — genau die Fehlerklasse, vor der die CLAUDE.md-Faustregel warnt
  („den Mechanismus prüfen, nicht nur, dass zwei Werte übereinstimmen").
- **Sichtbarkeit**: `renderer.js: drawGhosts()` bekommt einen vierten
  Auren-Ring (`ghost_081`, lila `#8a6ad8`, Radius `r+18`) neben den drei aus
  Phase 7; eine Verschmelzung löst einen kurzen Partikelstoß + Schwebetext
  „Verschmolzen!" + Ton aus (`fuseGhost()`, Wiederverwendung des
  bestehenden `'combo'`-Sounds statt eines neuen synthetisierten Tons).
- **Neuer Testabschnitt 60** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt einzeln bestanden — u. a.: Fusionsrichtung in `pushGhost()`
  umgedreht (schwächerer gewinnt statt stärkerer → kaskadiert korrekt über
  mehrere Folgetests, inkl. ghost_080/065), `ghost_085`s Ersetzungsflag
  stillgelegt, `ghost_061`s Einmal-Schutz entfernt (deckte den o. g. eigenen
  Testfund auf), beide Richtungen von `ghost_070`s Aura auf No-op gesetzt,
  `ghost_079`s Einmal-Gate UND `ghost_084`s Cooldown-Gate je einzeln
  aufgehoben, `ghost_066`s Zielwahl zurückgebaut, `ghost_076`s Zusatzschuss-
  Block deaktiviert): Struktur (25 Karten, echter `core`, NaN-Check), die
  fünf offiziellen Testschritte wörtlich, sowie ein Mechanismustest je
  übrige Karte (062/063/064/065 auf allen drei Todeswegen/067/068/069/072/
  073/074/075/076/077/078/079/081/082/084). **Testfallstricke, vor dem
  finalen Lauf gefunden und behoben**: (1) `ghost_065`s Heilungstest senkte
  die hp des Champions VOR der Champion-Bestimmung — der künstlich
  geschwächte „Champion" war dadurch per Definition der SCHWÄCHERE und
  wurde nie gekrönt; Fix: erst krönen (bei vollen, gleichen Werten gewinnt
  der zuerst erzeugte Geist den Gleichstand), dann schwächen. (2) derselbe
  Test brauchte für den Fusionsweg einen NOCH schwächeren neuen Geist, sonst
  hätte der (künstlich geschwächte) „Champion" selbst verschmolzen werden
  können, statt den anderen zu absorbieren. (3) `ghost_070`s erster Entwurf
  verglich die REINE `b.damage` eines gerade erzeugten Geschosses — der
  Aura-Multiplikator wirkt aber erst beim tatsächlichen TREFFER in der
  Trefferschleife; umgestellt auf eine echte `stepState()`-Kollision mit
  vorher gemessenem hp-Verlust. (4) mehrere Tests, die einen synthetischen
  Testgegner in `state.tanks` einreihen und `stepState()` aufrufen,
  brauchten zusätzliche Felder am Testobjekt (`cfg.role: 'guardian'`,
  `ai: {threatTimer, targetTimer, target}`) — sonst crasht `updateTargeting()`/
  `updateEnemy()` beim Verarbeiten des unvollständigen Fake-Panzers.
- Kein `sw.js`-Bump (reine Code-/Datenänderung, kein neues Asset).
  Playwright-Smoke (Nekromant wählen, Run starten, Snapshot bestätigt
  `starterTank: 'c_necro'`, keine Konsolenfehler) bestanden. **Nächste
  Sitzung: Phase 9** (Hybride und Aktivkarten, 20 Karten).

### Nekromant-V2 — Phase 9 (Hybride und Aktivkarten, 20 Karten) — gemergt
`ghost_086` bis `ghost_105` (+ `ghost_031`, seit Phase 6 als Aktivkarten-
Platzhalter mit `core: {"_todo":"effect"}` zurückgestellt) — 20 Hybridkarten,
die zwei oder drei Pfade (Opfer/Legion/Alpha) gleichzeitig bedienen, plus drei
Aktivkarten für den Gadgetslot.
- **Ist-Abgleich-Fund vor dem eigentlichen Kartenbau, nicht im Auftrag
  genannt, aber Voraussetzung für JEDEN der fünf Testschritte**:
  `data/upgrades_necro.json` war seit Phase 0 **nie in die aktive
  Angebots-Pipeline eingehängt** — `src/main.js: loadData()` kannte den
  Dateinamen nicht, `upgradesData.upgrades` (das `upgradepool.js`/`run.js`
  tatsächlich lesen) enthielt die 105 Karten nie. Keine einzige der in den
  Phasen 1–8 gebauten Karten konnte je in einem echten Run gezogen werden
  (per `grep` verifiziert: außerhalb von `tests/regression.mjs` gab es keine
  einzige Lesestelle). **Fix**: `main.js: loadData()` lädt `upgrades_necro`
  jetzt mit, `init()` mergt additiv
  `upgradesData.upgrades = {...upgradesData.upgrades, ...necroUpgradesData.upgrades}`
  — derselbe Objektschlüssel, den `upgradepool.js`/`run.js` ohnehin lesen.
  Der bestehende `signatureClass`-Filter (Phase 18 des LP-Umbaus) erledigt
  den Rest **ohne jede Änderung** an `upgradepool.js`/`run.js` — alle 105
  Karten tragen `signatureClass: "c_necro"` seit Phase 0. Testabschnitt
  61(b) prüft das End-to-End (echter `rollOffers()`-Aufruf mit einem
  gemergten Pool, c_necro zieht `ghost_0XX`, `player` nie) + eine Kontrolle
  gegen den ungemergten `upgradesData` (liefert nie eine `ghost_0XX`-id).
- **Hybride tragen alle beteiligten Pfad-Tags, KEIN `requires`**
  (Auftragsvorgabe: „ein Hybrid ist eine Einladung zum Mischen"): 6 O+L
  (`ghost_086`–`091`), 6 O+Alpha (`092`–`097`), 6 L+Alpha (`098`–`103`), 2
  Dreifach-Hybride O+L+Alpha (`104`/`105`, legendär, Gewicht 7). Die
  Synergiegewichtung selbst ist unverändert (Upgradepool-v2 Phase 3,
  `makeSynergyWeight()`) — Phase 9 baut daran nichts Neues, nutzt sie nur.
- **Drei Aktivkarten registrieren ein Gadget** (`ghost_031`/`089`/`096`,
  alle `tag: "gadget"`, `isUnique: true`): das Spiel hat **keinen dritten
  Knopf** — der bestehende, generische `run.js: applyUpgradeChoice()`-Hook
  (`if (offer.tag === 'gadget') run.equippedGadget = offer.id;`, seit P4)
  registriert sie **ohne jede Codeänderung** wie jedes andere Gadget; eine
  zweite Aktivkarte ersetzt die erste dadurch automatisch (Testschritt 4).
  `tank.js: useGadget()` bekommt drei neue `else if`-Zweige:
  `ghost_031` „Märtyrerbefehl" (opfert ALLE Untertanen, Bonus skaliert mit
  der Anzahl — die Timed-Stack-API erneuert nur die Dauer, deshalb wird die
  Gesamtstärke in EINEM Aufruf gesetzt statt N sich überschreibenden),
  `ghost_089` „Wechselopfer" (opfert nur den schwächsten, heilt+schildet die
  übrigen, garantiert die nächste Wiederbelebungsprobe), `ghost_096`
  „Königliches Opfer" (opfert ausschließlich den Champion). Alle drei folgen
  dem `layMine()`-Muster: `used` wird VOR dem Effekt anhand eines
  vorhandenen Ziels bestimmt — ohne Untertan passiert nichts, insbesondere
  **keine Abklingzeit** (Testschritt: „nichts zu opfern → keine Wirkung UND
  kein Verbrauch").
- **`killGhost()` bekommt eine dritte `cause`: `'sacrifice'`**
  (`state.js: 'damage'|'expire'|'sacrifice'`) — mappt auf `onGhostRemoved`s
  Grund `'sacrifice'` (seit Phase 5 in `NECRO_REASONS`/`countsAsGhostDeath()`
  vorbereitet, aber bis jetzt nie erzeugt). Wie `'expire'` überspringt
  `'sacrifice'` die drei kartengebundenen Todes-Mechaniken (Phylakterium,
  Wiederkehr-Familie, Letzter Wille) — „eine ABSICHTLICHE Opferung soll
  nicht durch Glück überleben". Gegenprobe bestanden: die alte Zuordnung
  (`'sacrifice'` fiel auf `'death_damage'` zurück) hätte einen geopferten
  Untertan mit `ghostReviveChance: 1` gerettet — der Test fängt das.
- **`necro_active` als dritte Gadget-Kategorie** (`data/secondaries.json`,
  NICHT `'gadget'`): `run.js: buyShopSecondary()` und `roomscreens.js`
  filtern den Shop-Tausch explizit auf `category === 'gadget'` — die drei
  Aktivkarten sollen dort **nie** auftauchen (zweites, von der ohnehin
  bestehenden Nekromant-Shop-Sperre unabhängiges Sicherheitsnetz).
  Abklingzeiten wie im Auftrag: 24 s/18 s/30 s.
- **Tausch-Warnung VOR der Wahl** (Testschritt 2, Ist-Abgleich-Fund über die
  Auftrags-Dateiliste hinaus — die nennt nur `hud.js`, ohne diese Datei ist
  „vor der Wahl sichtbar" aber technisch unerfüllbar): `upgradescreen.js`
  und `roomscreens.js` (Shop-Kartenregal) zeigen bei
  `o.tag === 'gadget' && ctx.equippedGadget && ctx.equippedGadget !== o.id`
  ein `.pv-warn`-Element „Ersetzt: <Name>" direkt in der Karte —
  `ctx.gadgetLabel(id)`/`ctx.secondariesData[id]?.label` lösen den Namen
  auf. `main.js` reicht `equippedGadget`/`gadgetLabel` neu an den
  Upgrade-Screen durch. `hud.js` brauchte dagegen **keine** Änderung
  (verifiziert, nicht angenommen): die bestehende, generische
  Abklingzeit-/Label-Anzeige (`run.data.secondaries?.[p.cfg.gadget]?.label`,
  `p.gadgetCooldown`) funktioniert für die drei neuen Einträge unverändert,
  weil sie demselben `label`/`cooldownS`-Schema folgen wie die fünf
  Basis-Gadgets (Testschritt 3).
- **`ghost_105` „Herrschaft über den Tod"** (Testschritt 5): der
  Raumstart-Untertan (`ghost_033`-Hook, `state.js`) zieht seinen Typ aus
  `state.actEnemyPool` (Akt-Gegnerpool, seit Phase 3 vorhanden — keine neue
  Aktzuordnung nötig, die „Fundament"-Anbindung war schon da) und trägt
  fortan `isAncestor: true`. Stirbt (Schaden/Ablauf, `killGhost()`) ODER
  verschmilzt (`fuseGhost()`, als Verlierer) **genau dieser eine** Untertan,
  löst er einen zeitlich befristeten Schaden-/Feuerraten-Buff für den
  Hauptpanzer aus — beide Pfade rufen denselben `addNecroTimedStack()`-Block,
  kein zweiter Mechanismus. Gegenprobe: ein NICHT-Urahn-Geist, der
  stattdessen verschmilzt, löst den Buff nicht aus (eigener Testblock (ac)).
- **`ghost_098` „Auslese der Legion"**: `pushGhost()` bekommt einen zweiten
  Sonderfall NACH `necroUniqueThrone` — ist das Geisterlimit VOLL, wird der
  neu ankommende Geist **verworfen** (erscheint nicht), stattdessen
  verschmilzt der bereits vorhandene SCHWÄCHSTE Nicht-Champion in den
  Champion (`fuseGhost(..., {hpFrac, dmgFrac, frFrac})` mit einem eigenen
  `overrideFrac`-Parameter, unabhängig von 071/072/085s Übertragungsraten —
  zwei unabhängige Verschmelzungs-Karten sollen sich nicht gegenseitig
  verzerren).
- **`ghost_092` „Blutiger Thron"**: eine Verschmelzung zählt für raumweite
  `pureStack`-Spielerstapel (011/012/013) als **halber** Geistertod, ohne
  Heilung/Explosion/Abklingzeit auszulösen — ein zweiter, auf `pureStack`
  gefilterter Durchlauf in `onGhostRemoved()` NACH dem normalen
  `reasons`-Durchlauf (unabhängig davon, ob ein Listener `'fusion'` selbst
  in seinen `reasons[]` hat — der neue Zweig filtert auf `l.pureStack`, ein
  Seiteneffekt-Listener wie `ghost_097` bekommt dadurch **kein** zweites
  Auslösen).
- **`ghost_099` „Krönungszug"**: stirbt ein ANDERER Untertan, wird die
  HÄLFTE des aktuellen Champion-Bonus (`necroCrownProcPerAllyPct × lebende
  ANDERE Untertanen`) **dauerhaft** (`state.necroCoronationPermDmgPct`,
  raumweit, überdauert einen Champion-Wechsel — bewusst NICHT in
  `necroDamagePct()` aufgenommen, das ist die Spieler-Formel; der Bonus
  wirkt nur auf den jeweils aktuellen Champion, live in `ghost.js:
  updateGhosts()`s Feuer-Multiplikatorkette).
- **`ghost_100` „Ersatzkörper"**: stirbt der Champion, während ein weiterer
  Untertan lebt, übernimmt der GESÜNDESTE Überlebende (nicht der nächste
  Neuling wie bei `ghost_080`) die Hälfte des angesammelten Bonus
  (Delta zum Basiswert, dieselbe Messung wie `ghost_094`) — „einmal pro
  Raum" (`state.necroSuccessionUsed`).
- **`ghost_087`/`ghost_094`**: zwei weitere „Transfer"-Karten, bewusst NICHT
  über `ghost.js: applyFusionTransfer()` (das rechnet relativ zum
  EMPFÄNGER-Basiswert) — `ghost_087` überträgt einen Anteil der Basiswerte
  DES STERBENDEN an einen zufälligen Überlebenden, `ghost_094` einen Anteil
  des Deltas DES CHAMPIONS an den Hauptpanzer. Zwei unterschiedliche
  Bezugsgrößen, deshalb zwei eigene, kleine Rechnungen statt einer
  geteilten Funktion mit widersprüchlicher Semantik.
- **`ghost_090`/`ghost_091` brauchen `state.js`-Umwege** (Zirkelimport-
  Vermeidung, `necro.js` kann `ghost.js` nicht importieren — das importiert
  bereits aus `necro.js`): zwei neue Methoden auf dem `state`-Objekt,
  `createReplacementGhost(gh, cfg)` (`ghost_090`, Ersatz mit reduziertem
  Basiswert-Anteil, `isReplacement`-Flag verhindert Kettenreaktionen) und
  `spawnFreeGhosts(count, statPct)` (`ghost_091`, kostenlose Untertanen ohne
  Wiederbelebungswurf) — Muster wie das bestehende `state.applyStatus`.
- **`ghost_091` „Lawine der Toten": echter Bug beim eigenen Testbau
  gefunden und in `necro.js` gefixt** (nicht nur der Test angepasst): der
  Listener trug ursprünglich `cooldownS: cfg.necroKeystoneAvalancheCooldownS`
  (20 s) als generisches `l.cooldownS`-Gate — das sperrt aber die reine
  Zähl-Buchführung selbst, nicht nur die Auslöse-Belohnung.
  `necroCooldownReady()` setzt die Abklingzeit beim ERSTEN erlaubten Aufruf
  sofort, lange bevor 3 Tode gezählt werden konnten — der 2./3. Tod
  innerhalb des 5-s-Fensters kam dadurch nie mehr durch (20 s > 5 s), die
  Lawine konnte praktisch nie auslösen. Fix: eine eigene, manuelle
  Abklingzeit (`state.necroAvalancheCooldownUntil`), erst gesetzt NACHDEM
  die Lawine wirklich ausgelöst hat — Muster wie `ghost_054`s
  `necroCoreCooldownUntil`.
- **Sieben gezielte Gegenproben am echten Quellcode** (temporär im Diff
  gebrochen, Suite lief rot, dann zurückgesetzt): Pipeline-Mechanismus,
  `killGhost()`s `'sacrifice'`-Zuordnung, `ghost_098`s Verdrängungs-Fusion,
  `ghost_092`s Halb-Zuschlag, `ghost_099`s permanenter Bonus, `ghost_100`s
  Nachfolge, `ghost_095`s Schadensumleitung — jede Gegenprobe hat genau die
  erwarteten, benannten Prüfpunkte rot gemacht, sonst nichts.
- **Neuer Testabschnitt 61** (`tests/regression.mjs`): Struktur (21 Karten,
  echter `core`, NaN-Check, `ghost_104`/`105` legendär+Gewicht 7+alle drei
  Tags), Pipeline-Verdrahtung mit Kontrolle gegen den ungemergten Pool,
  Testschritt 1 (O+L-Hybrid-Gewichtung an einem ISOLIERTEN Zwei-Karten-Pool
  — Muster wie Abschnitt 39: der echte 110-Karten-Pool hätte das Signal
  verwässert, weil ein zu hoher `synergyTags`-Wert praktisch jede Karte mit
  auch nur einem passenden Tag auf denselben Deckel treibt und O+L dadurch
  von O+Alpha/L+Alpha ununterscheidbar würde), `necro_active`-Kategorie +
  Abklingzeiten, alle drei Aktivkarten-Mechanismen (inkl. „nichts zu
  opfern" → kein Verbrauch), Testschritt 3 (Abklingzeitwert exakt), 4
  (zweite Aktivkarte ersetzt sichtbar die erste, über `run.js`), 2
  (Tausch-Warnung domstub-geprüft inkl. Gegenprobe „ohne Gadget keine
  Warnung"), `killGhost()`s `'sacrifice'`-Pfad, sowie ein Mechanismustest
  je der übrigen 17 Hybrid-/Keystone-/Engine-Karten (086–088, 090–105) —
  `ghost_088` bewusst über `necroDamagePct(st)` gemessen, NICHT über einen
  abgefeuerten Untertanen-Schuss (die Karte wirkt auf den SPIELER, ein
  erster, falscher Testentwurf hätte das Gegenteil geprüft und wäre
  trivial grün geblieben, weil der Untertanen-Schaden davon unberührt ist).
- Kein `sw.js`-Bump durch DIESE Phase allein nötig gewesen, aber **jetzt
  erforderlich**: `data/upgrades_necro.json` wird durch den Pipeline-Fix
  zum ersten Mal wirklich vom laufenden Spiel geladen (vorher nur von
  `tests/regression.mjs`). `sw.js` auf `v113` gebumpt (+
  `telemetry.js: GAME_VERSION` mitgezogen), `data/upgrades_necro.json` neu
  in `ASSETS` aufgenommen. **Zwei weitere, ältere Lücken beim
  Durchprüfen der `ASSETS`-Liste gefunden**: `src/game/necro.js` (seit
  Phase 5) und `src/game/mortar.js` (seit Grundsteinumbau Phase 3) fehlten
  dort ebenfalls — beide sind ES-Module-Importe und wurden dadurch bisher
  nur über den `network-first`-Fetch-Handler lazy nachgecacht, nie beim
  ersten Offline-Install; jetzt ergänzt.
- Playwright-Smoke (Nekromant wählen, Run starten, Snapshot bestätigt
  `starterTank: 'c_necro'`, keine Konsolenfehler) bestanden. **Nächste
  Sitzung: Phase 10** (Lesbarkeit und Telemetrie).

### Nekromant-V2 — Phase 10 (Lesbarkeit und Telemetrie) — gemergt
„Der Spieler muss sehen, was passiert" — bei bis zu acht autonomen
Untertanen mit Auren, Lebenszeiten und einem Champion die Grenze zwischen
„starker Build" und „unübersichtliches Flimmern". **Ist-Abgleich zuerst**:
Lebensleiste/Schildleiste/Lebenszeit-Ring der Untertanen, die
Champion-Markierung und drei der vier Auftrags-Auren (`ghost_042`/`048`/
`049`/`081`) waren bereits seit Phase 3/7/8 gebaut — kein doppelter
Testaufbau dafür. Echte Lücken: `ghost_070`s Aura-Radius war komplett
unsichtbar, „Wiederbelebung" hatte kein sichtbares/hörbares Gegenstück, und
die sechs verlangten Telemetriewerte existierten noch gar nicht.
- **`ghost_070` „Herrscheraura"**: neuer gestrichelter Ring im TATSÄCHLICHEN
  Wirkradius (`necroCrownAuraRadius`) um den Champion, rot (schwächt
  Gegner/stärkt Untertanen darin) — bewusst ein GROSSER, gestrichelter Kreis
  statt der kleinen panzergroßen Ringe (r+6..r+18) der Nahbereichs-Auren, um
  ihn klar unterscheidbar zu halten. **`ghost_102`/`103` bekommen bewusst
  KEINEN Ring**: beide skalieren rein mit Anzahl/Plätzeverbrauch, ohne
  räumlichen Wirkradius — ein Ring hätte dort keine geometrische Bedeutung
  (anders als 070/042/048/049, die echte Distanzen prüfen). Das ist auch die
  bewusste Antwort auf die Clutter-Sorge des Auftrags selbst: mehr Ringe ohne
  räumlichen Sinn wären reines Rauschen bei acht Einheiten.
- **„Wiederbelebung" (neuer Ton `ghost_rise` + heller Partikelstoß)**:
  `ghost.js: pushGhost()` bekommt einen neuen, gemeinsamen Helfer
  `spawnGhostAppearEffect()`, aufgerufen an den beiden ECHTEN
  Erscheinungs-Ausgängen (normaler Pfad + der Gewinner-Zweig von
  `necroUniqueThrone`) — NICHT im Verlierer-Zweig (der ankommende Geist wird
  absorbiert, existiert nie eigenständig) und NICHT bei `necroCapFusion` am
  vollen Limit (der Geist wird verworfen). Derselbe Helfer erhöht auch
  `state.necroGhostsCreated` — ein Ort für Effekt UND Telemetrie, kein
  zweiter Zähl-Pfad. Verschmelzung (`fuseGhost()`, Partikel+Text+`combo`-Ton)
  und Exekution (Grundsteinumbau Phase 2) waren bereits gebaut — Exekution
  ausdrücklich VERIFIZIERT statt angenommen: `t.executing` iteriert
  `state.tanks`, trifft also automatisch auch einen von einem Untertan
  getroffenen Gegner, ohne dass diese Phase dafür etwas anfassen musste
  (Testabschnitt 62i).
- **Sechs Telemetriewerte, alle als Rohzähler auf `state`** (Muster wie
  `state.ghostKills`, main.js liest sie unverändert, kein Delta-Sync nötig —
  `state` selbst ist pro Raum frisch): `necroGhostsCreated` (`pushGhost()`),
  `necroGhostsFused` (`fuseGhost()`, EINZIGER Ort, an dem eine Verschmelzung
  wirklich stattfindet — deckt beide Auslöser `necroUniqueThrone`/
  `necroCapFusion` gleich ab), `necroGhostsDiedByReason` (`{death_damage,
  death_expire, sacrifice}`, in `killGhost()` — derselbe `reason`-Wert, der
  gleich an `onGhostRemoved()` geht, EINMAL berechnet statt dupliziert),
  `necroReviveRolls`/`necroReviveHits` (`state.js: killTank()`s
  Revive-Block — „Quote" heißt „wie oft führte eine ECHTE Probe
  (`canRevive`) auch tatsächlich zu mindestens einem neuen Untertan
  (`spawnedAny`)", nicht nur „der Wurf war < chance", der am vollen Limit
  trotzdem ins Leere laufen kann), `necroChampionStrengthSum`/
  `necroChampionStrengthSamples` (jeden `updateGhosts()`-Tick MIT lebendem
  Champion — eine ZEITGEWICHTETE Stichprobe, kein einmaliger Schnappschuss
  am Raumende), `bossShotsAtPlayer`/`bossShotsAtGhost` (`bossai.js`).
- **Echter Bugfund beim eigenen Testbau: die Bossschuss-Zähler zählten
  PHANTOMSCHÜSSE.** `roleTurret()` (`ai_turrets.js`) gibt `true` zurück,
  sobald Zielkegel/Sichtlinie erfüllt sind — das ist nur die ABSICHT zu
  feuern, NICHT die Garantie, dass ein Geschoss entsteht. `fireBullet()`
  selbst gated nochmal auf `tank.cooldown`/Magazin und kann trotzdem
  `false` liefern, mehrere Ticks in Folge, solange der Cooldown noch läuft.
  Die ursprüngliche Fassung zählte bei `if (fire)` — ein eigener Test mit
  echten simulierten Sekunden maß **678 statt 46** tatsächliche Schüsse
  (Faktor ~14,7×). Fix: der Zähler hängt jetzt am RÜCKGABEWERT von
  `fireBullet()`, nicht am `fire`-Flag. **Weiterhin nur über isolierte
  Tests erreichbar**: Bossräume spawnen laut „Bosse (Platzhalter)"-
  Entscheidung `t_black` statt `t_mirror`/`t_phalanx` — dieser Codepfad
  läuft im echten Spiel derzeit nie, die Telemetrie wird also bis zum
  Bossneubau immer `0/0` zeigen. Kein Bug, sondern dieselbe akzeptierte
  Lücke wie beim Reaktor-Rätsel — hier explizit dokumentiert, damit ein
  „0 %"-Wert in echten Runs nicht als neuer Fehler missverstanden wird.
- **HUD**: `drawBar()` (`hud.js`) zeigt „Untertanen X/Y" (dieselbe
  Deckelformel wie überall sonst — `occupiedGhostSlots()` zählt PLÄTZE,
  nicht die reine Array-Länge) nur bei `p.cfg.necromancer`. `drawStats()`
  bekommt eine „Wiederbelebungschance"-Zeile (Grundchance +
  `necroReviveChanceAdd`, als %). Die „aktive Aktivkarte mit Abklingzeit"
  aus dem Auftrag ist bereits erreicht: `ghost_031`/`089`/`096` registrieren
  sich seit Phase 9 wie jedes andere Gadget (`p.cfg.gadget`), die
  bestehende generische Gadget-Zeile in `ammoLine`/`drawStats()` zeigt sie
  unverändert — keine Codeänderung nötig, nur verifiziert.
- **`telemetry.js`**: `recordRoom()` speichert ein neues `necro`-Feld
  (`null` bei jedem Nicht-Nekromanten-Raum), `computeMetrics()` aggregiert
  über ALLE Räume ALLER Runs (Muster wie `dmgByType`) — Quote/⌀
  Championstärke/Bossschuss-Anteil als gerundete Prozent-/Zahlenwerte, `null`
  ganz ohne Nekromanten-Daten (kein irreführender 0-Wert). Debug-Ansicht
  zeigt eine neue Zeile, nur wenn mindestens ein Nekromanten-Raum
  aufgezeichnet wurde.
- **Neuer Testabschnitt 62** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt einzeln bestanden — u. a. den o. g. Bossschuss-Fund selbst
  aufgedeckt): alle sechs Zähler mit ihren jeweiligen Abgrenzungen (erzeugt
  vs. verworfen, Grund-Aufschlüsselung, Rolls vs. Hits, zeitgewichtete
  Stichprobe), HUD-Zeilen vorhanden für den Nekromanten/abwesend für die
  Standard-Klasse, `ghost_rise` bei echtem Erscheinen aber nicht bei einem
  verworfenen Geist, Exekution über den echten `stepState()`-Pfad,
  `telemetry.js`-Aggregation mit SYNTHETISCHEN Werten (nicht über einen
  echten Spiellauf), der `ghost_070`-Ring über den echten, aufzeichnenden
  Fake-Canvas-Renderpfad (inkl. Gegenprobe ohne die Karte).
- Kein `sw.js`-Bump (reine Code-/Datenänderung — der neue `ghost_rise`-Sound
  ist ein JSON-Eintrag in der bereits gecachten `data/sounds.json`, kein
  neues Asset). Playwright-Smoke (Nekromant wählen, Run starten, Snapshot
  bestätigt `starterTank: 'c_necro'`, keine Konsolenfehler) bestanden.
  **Nächste Sitzung: Phase 11** (Balance und Abnahme, letzte Phase des
  Auftrags).

### Nekromant-V2 — Phase 11 (Balance und Abnahme) — gemergt
Die Schlussabnahme des **gesamten** `AUFTRAG-NEKROMANT-V2.md` (25 nummerierte
Punkte). **Keine Balance-Werte in `data/balance.json` geändert** — die vier
im Auftrag benannten Ausreißer-Kombinationen wurden programmatisch vermessen
(Details unten) und liegen in sinnvollen Grenzen. Ist-Abgleich zuerst (Muster
„Upgrade-/Klassenpool-System v2 + Nekromant — Phase 9 (Abnahme)"): eine
Mapping-Tabelle im Kopfkommentar von `tests/regression.mjs` Abschnitt 63
ordnet jeden der 25 Punkte einem bestehenden Test (Abschnitte 4/5/37/41-62)
zu — **19 der 25 Punkte waren bereits mit eigener Gegenprobe abgedeckt**,
nur 6 echte Lücken sind neu getestet.
- **(a) Punkt 5, ERSCHÖPFEND**: die bestehende Stichprobe (Abschnitt 61(b),
  60 Seeds) hätte eine seltene Karte theoretisch übersehen können. Neu:
  `buildCandidates()` (dafür aus `upgradepool.js` **exportiert**, reine
  Sichtbarkeitsänderung) direkt für **alle 105 Karten einzeln** aufgerufen —
  keine erscheint für die Standardklasse, jede erscheint für `c_necro`.
  **Zwei echte Testaufbau-Fallen dabei gefunden** (beide per Gegenprobe am
  eigenen Test bestätigt, nicht am Code): ein GLOBALES `chosen`-Objekt (alle
  requires-Ziele auf einmal vorbelegt) markierte `ghost_071` fälschlich als
  „schon gewählt" für sich selbst, weil es sowohl `isUnique` als auch
  requires-Ziel von `ghost_072/073/085` ist — behoben über ein pro Karte
  MINIMALES `chosen`. `ghost_056` trägt `tag: "elite"` (der reservierte
  Elite-Bonus-Tag aus UMBAUPLAN-LP Phase 9) und ist deshalb absichtlich
  **nie** über den normalen Pool ziehbar, nur über `includeTag: 'elite'` —
  kein Bug, sondern derselbe Mechanismus wie bei jeder anderen
  Elite-Bonus-Karte, im Test entsprechend beruecksichtigt.
- **(b) Punkt 6, am ECHTEN 105-Karten-Pool**: die bestehende Mechanismus-
  probe (Abschnitt 38(c)) nutzt einen synthetischen Drei-Karten-Pool;
  `rollOffers()` über 400 Seeds am realen gemergten Pool bestätigt, dass ein
  Angebot aus drei `ghost_0XX`-Karten gleichzeitig tatsächlich vorkommt.
- **(c) Punkt 9, auf LISTENER-Ebene verschärft**: Abschnitt 62 zählt bereits
  vier GETRENNTE Zähler hoch, beweist aber nicht, dass ein Listener, der nur
  auf EINEN Grund hört, wirklich nie für die anderen drei feuert. Neu: vier
  frische Test-Listener (`reasons: [reason]`), über echte Auslöser
  (`killGhost(cause='damage'/'expire'/'sacrifice')`, `pushGhost()`-Fusion via
  `necroUniqueThrone`) angesprochen — jeder feuert exakt einmal, nur für
  seinen eigenen Grund. **Zwei Testaufbau-Fehler beim ersten Anlauf**: (1)
  `killGhost()` entfernt ein totes Geistobjekt NICHT sofort aus
  `state.ghosts` (das macht erst `updateGhosts()`s Filter später) —
  `st.ghosts[0]` zeigte nach dem ersten Tod weiter auf die Leiche statt auf
  den nächsten frisch gepushten Geist, jede Erzeugung wird jetzt in einer
  eigenen Variablen gehalten. (2) `necroUniqueThrone` von Anfang an aktiv zu
  lassen hätte schon die death_expire/sacrifice-Vorbereitung selbst zu
  Fusionen gemacht (jeder zweite `pushGhost()` verschmilzt automatisch, wenn
  ein Untertan lebt) — der Flag wird jetzt erst kurz vor dem eigentlichen
  Fusions-Trigger gesetzt.
- **(d) Punkte 12+14, an der ECHTEN Skalierungsformel**: die bestehende
  Probe (Abschnitt 37(c)) zeigt nur, dass eine nicht-einzigartige Karte bei
  hoher Stufe im POOL bleibt — nicht, dass ihr `cfg`-Effekt weiter *nach
  ihrer Formel* wächst. Neu: `ghost_001` (`core.ghostHpMult`, ein
  MULTIPLIKATIVER core-Applier-Schlüssel) bei Stufe 1/10/100/1000 gegen
  `Math.pow(mult, Stufe)` geprüft — keine Klemmung. Dazu ein UI-Text-Nachweis
  (`upgradescreen.js` zeigt bei `isUnique:false` nur „(Stufe N)", kein
  „MAX"/„/Y").
- **(e) Punkt 13, Shop/Truhe/Ereignis/Reroll + „nur angezeigt bleibt
  verfügbar" + „neuer Run macht wieder verfügbar"**: `drawOne()` (der
  gemeinsame Choker für Shop-Kauf/Verbannen/Vierte-Karte/Ereignis-
  Kartenoption — alle vier rufen ihn über `run.js: poolOpts()` mit
  denselben Optionen auf) respektiert `isUnique`/`selectedUniqueUpgradeIds`
  — direkt gegen `buildCandidates()` geprüft, **nicht** nur über
  Zufallsstichproben aus `drawOne()` selbst (die erste Fassung sampelte 100
  Ziehungen aus ~40 gleich gewichteten Common-Karten und hätte die konkrete
  Testkarte nicht zuverlässig getroffen — reines Ziehungspech hätte einen
  echten Fehler unbemerkt gelassen, per Gegenprobe an der eigenen
  Testschwäche gefunden). Ein echter, über `createRun()`+`chooseUpgrade()`
  gefahrener Ablauf bestätigt: eine nur ANGEBOTENE (nicht gewählte) einzig-
  artige Karte bleibt verfügbar, eine wirklich gewählte verschwindet, ein
  neuer `createRun()`-Aufruf macht sie wieder verfügbar. **Testaufbau-Falle**:
  `chooseUpgrade()` prüft `run.phase === 'upgrade'` und setzt ihn über
  `afterRoomDone()` auf `'preview'` zurück — ein zweiter Aufruf ohne
  erneutes `run.phase = 'upgrade'` ist ein stiller No-op (per Gegenprobe am
  eigenen Testaufbau gefunden, nicht am Code).
- **(f) Punkt 17, neu verstanden statt nur neu formuliert**: „überträgt
  Basiswerte, nicht aktuelle Werte" bedeutet NICHT (wie ein erster
  Testentwurf annahm) „die Karte des Verlierers wird transferiert, nicht
  seine aktuelle" — `applyFusionTransfer()` liest beim Schaden/Feuerrate gar
  keinen Loser-Wert, sondern skaliert **des Gewinners eigenes**
  `baseDamage` mit der aufakkumulierten Rate (nur bei HP wird ein absoluter
  Anteil von `loser.baseMaxHp` addiert). Die eigentliche Regel: JEDE
  Verschmelzung rechnet vom UNVERÄNDERTEN `winner.baseDamage`, nie vom schon
  geboosteten `winner.cfg.damage` — das verhindert das im Code-Kommentar
  benannte „exponentielle Aufschaukeln". Neuer Test: zwei Verschmelzungen
  nacheinander ergeben LINEARES Wachstum (`baseDamage * (1+2*dmgFrac)`),
  nicht KOMPONDIERENDES (`(baseDamage*(1+dmgFrac))*(1+dmgFrac)`) — beide
  Werte sind als Testvoraussetzung explizit auf Unterscheidbarkeit geprüft,
  bevor der eigentliche Vergleich läuft.
- **Balance-Durchgang**: keine echte Mehrfach-Playtesting-Session möglich
  (`localStorage.runs` ist in dieser Umgebung durchgehend leer, wie schon
  in mehreren früheren Phasen dokumentiert) — stattdessen ein programmatisches
  Messskript (Muster: die zahlreichen Bot-/Simulationsmessungen früherer
  Phasen) für die vier im Auftrag benannten Ausreißer-Kombinationen:
  - **`ghost_036`+`ghost_060` (Limit)**: `ghost_036` auf Stufe 10 +
    `ghost_060` ergibt einen Deckel von 15 gleichzeitigen Untertanen.
    `updateGhosts()` bei vollem Deckel: **0,088 ms/Tick** — weit unter dem
    6-ms-Frame-Budget (Phase 11b). `ghostDamageMult` (060, −15 %) greift wie
    dokumentiert.
  - **`ghost_057`+`ghost_081`+`ghost_102` (Resistenzdeckel)**: bei 2/5/8
    gleichzeitig lebenden Untertanen sinkt der genommene Schaden auf
    83 %/67 %/56 % — spürbar, aber **nicht unverwundbar**, auch nahe am
    Geisterlimit. Punkt 14 verbietet ausdrücklich einen Deckel; die additive
    (nicht multiplikative) Resistenzformel hält die Kombination trotzdem in
    einem spielbaren Rahmen.
  - **`ghost_085`+`ghost_072` (Fusion)**: zehn Verschmelzungen mit beiden
    Karten aktiv ergeben exakt den erwarteten linearen Faktor **6,00×**
    (085 ERSETZT 071/072s Übertragungsrate vollständig, kein doppeltes
    Aufaddieren) — bestätigt denselben Mechanismus wie Testschritt (f), nur
    mit den echten Kartenwerten statt synthetischen.
  - **`ghost_104` (garantierte Probe)**: nach 5 Toden/Verschmelzungen löst
    `necroCircleGuaranteedRevive` zuverlässig aus, übersteht selbst einen
    fast sicher scheiternden Würfelwurf (`rng() = 0.999`), und wird nach
    einmaligem Verbrauch korrekt wieder auf `false` gesetzt — kein
    dauerhafter Freifahrtschein.
  - Ergebnis: **keine der vier Kombinationen musste angepasst werden.**
- **Sechs verbliebene `_todo: "balance"`-Marker finalisiert** (entfernt,
  keine Wertänderung): `ghost_016`/`026`/`032`/`079`/`082`/`084` — ihre
  Zahlenwerte standen bereits vollständig ausformuliert im `core`-Objekt
  (nicht als Platzhalter), der Marker bedeutete „noch nicht am Spielgefühl
  geprüft", nicht „noch unausgefüllt". Werte im Vergleich zu Topf-Geschwistern
  gleicher Seltenheit plausibel, keine der vier oben vermessenen Ausreißer-
  Kombinationen betrifft sie. Entfernung als gezielte Textersetzung (nicht
  über `JSON.stringify()` der ganzen Datei) — ein `JSON.parse`+`stringify`-
  Durchlauf hätte `2.0`→`2` normalisiert und unnötiges Diff-Rauschen über die
  ganze Datei erzeugt, per eigenem Testlauf gefunden und verworfen.
- **Neuer Testabschnitt 63** (`tests/regression.mjs`, Gegenprobe für jeden
  Kernpunkt einzeln bestanden — je absichtlich rot gemacht: `signatureClass`-
  Filter in `buildCandidates()` deaktiviert (röted (a) UND den bestehenden
  Abschnitt-61(b)-Test gemeinsam), `onGhostRemoved()`s Grund-Filter
  deaktiviert (röted (c) UND zwei bestehende Phase-5/9-Tests gemeinsam),
  `ghostHpMult`-Skalierung auf einen Deckel bei Stufe 3 zurückgebaut (röted
  (d) an allen drei höheren Stufen), `isUnique`-Gate in `buildCandidates()`
  komplett deaktiviert bzw. nur den `selectedUniqueUpgradeIds`-Zweig entfernt
  (röted (e) jeweils gemeinsam mit dem bestehenden Phase-1-Test),
  `applyFusionTransfer()` auf den bereits geboosteten AKTUELLEN Wert
  umgestellt (röted (f) an beiden Prüfungen). `dedupeKey()` probeweise auf
  die alte Ein-Tag-Regel zurückgesetzt röted zwar den bestehenden
  Phase-2-Test (b), nicht aber den neuen Punkt-6-Test selbst — die 105
  Nekromant-Karten haben 30 verschiedene `tag`-Werte, ein Tag-Kollisions-
  Bug wäre bei der realen Kartenvielfalt oft genug vermeidbar, um in einer
  400-Seed-Stichprobe nicht zuverlässig aufzufallen; die MECHANISMUS-Probe
  aus Abschnitt 38 bleibt deshalb die tragende Absicherung für Punkt 6, der
  neue Test bestätigt nur, dass der aktuelle 105-Karten-Bestand die Regel
  tatsächlich ausnutzt.
- `ARCHIV.md` bereits vollständig (Phase 0 hatte die alte Spec + beide
  ersetzten Aufträge schon eingetragen, verifiziert statt neu ergänzt).
  `CLAUDE.md`s technische Abschnitte dokumentieren `ghost.*`/`resist`/
  `pierce`/`aggro`/`boss.fixate`/die Seltenheitsstufe „Ungewöhnlich" bereits
  aus den jeweiligen Bauphasen (Phasen 1/2/5 dieses Auftrags) — keine
  Dopplung hier, nur verifiziert statt blind neu geschrieben.
- `sw.js`-Cache auf `v114` erhöht (+ `telemetry.js: GAME_VERSION`
  mitgezogen) — `data/upgrades_necro.json` (bereits in `ASSETS`) hat sich
  inhaltlich geändert (sechs `_todo`-Marker entfernt).
- Playwright-Smoke (Startseite lädt, keine Konsolenfehler) bestanden.
  **Damit ist der komplette `AUFTRAG-NEKROMANT-V2.md` (Phasen 0–11)
  abgearbeitet — der Nekromant hat seinen vollständigen 105-Karten-
  Signaturpool mit drei Build-Pfaden (Opfer/Legion/Alpha), einem
  dynamischen Champion-System, Verschmelzung, Ressourcen (Resistenz,
  Schildpool, Durchschlag) und einem ausbalancierten Bosskampf-Korridor.**

### Champion-Nachschliff (Nutzerauftrag, zehn Punkte) — gemergt
Vollstaendige Ueberarbeitung des Champion-/Verschmelzungs-/Upgrade-Systems
aus dem Nekromant-V2-Auftrag, ausgeloest durch zehn vom Nutzer nachgewiesene
Fehler und verbindliche Grundregeln. **Kein neues Ressourcensystem** (explizit
gefordert: „keine Seelenenergie") — alle Fixes bauen auf den bestehenden
`state.necroStacks`/`shield`/`hp`-Mechanismen auf.
- **Champion ist jetzt STICKY statt dynamisch neu bewertet.** Der Kern-
  Architekturwechsel, der die meisten der zehn Punkte gleichzeitig loest:
  `ghost.js: promoteToChampion(state, g)` (neu) setzt `isChampion` EINMALIG
  und berechnet die Champion-Basiswerte NICHT mehr aus dem geerbten Typ
  (Phase 3 des Nekromant-Auftrags), sondern aus `championStatPct` (0,7, neues
  `data/balance.json: ghost.championStatPct`) mal den AKTUELLEN Spielerwerten
  (`maxHp`/`damage`) — exakt das im Auftrag verlangte Beispiel (100/20 →
  70/14). `ghost.js: ensureChampion(state)` (neu, exportiert) befoerdert nur,
  wenn NOCH KEIN Champion lebt (`state.ghosts.some(g=>g.alive&&g.isChampion)`)
  — ein bereits lebender Champion wird NIE mehr durch einen Staerkevergleich
  ersetzt (Auftrag Abschnitt 2.1, wortgleiches Verbot). Aufgerufen an
  GENAU zwei Stellen: `pushGhost()` (nach jedem echten Spawn) und am Anfang
  von `updateGhosts()` (Sicherheitsnetz, idempotent — tut nichts, wenn schon
  ein Champion lebt). Der alte, komplett dynamische Neubewertungs-Block in
  `updateGhosts()` (jeden Tick `aliveGhosts.find(strongest)`, mit
  `becameChampion`-Sonderfall fuer einmalige Kroenungsboni) ist ersatzlos
  entfernt — die Kronenboni (`necroCrown*`) werden weiterhin live gegen
  `g.isChampion` ausgewertet, aber `g.isChampion` selbst aendert sich nicht
  mehr pro Tick.
- **Champion zaehlt strukturell NIE gegen das Geistlimit** (Auftrag 2.3):
  `occupiedGhostSlots()` schloss den Champion schon seit Upgradepool-v2
  Phase 7 aus — bestaetigt UND an allen sechs Erzeugungsstellen konsequent
  durchgezogen (`state.js: killTank()`s Revive-Schleife, `createReplacementGhost`,
  `spawnFreeGhosts`, der Raumstart-Ancestor-Hook; `tank.js: spawnGhostBomb()`),
  die vorher teils VOR `pushGhost()` schon abgebrochen haben, wenn das Limit
  (faelschlich ohne Champion-Ausnahme mitgezaehlt) voll schien.
- **Champion-Lebensdauer**: `promoteToChampion()` setzt `lifetime`/`lifetimeMax`
  auf `Infinity` — `updateGhosts()`s Ablauf-Schleife prueft jetzt `if
  (!g.isChampion) { g.lifetime -= dt; ... }`, ein Champion verfaellt nie mehr
  per Timer (Auftrag 2.4). Drei Karten, deren einziger Zweck die jetzt
  bedeutungslose Lebensdauer war, sind NEU BELEGT statt nutzlos angeboten zu
  werden (reine Wiederverwendung bestehender `necroCrown*`-Felder, kein neues
  Feld): `ghost_068` „Langer Anspruch" → dauerhaft +18 % maximales Leben
  (`necroCrownHpPct`), `ghost_083` „Ewiger Thron" → dauerhaft +25 %
  Schaden/+25 % maximales Leben (`necroCrownDamagePct`+`necroCrownHpPct`,
  hoehere Werte passend zur `epic`-Seltenheit), `ghost_073` „Endloser
  Anspruch" → jede Verschmelzung gewaehrt statt einer Lebensdauer-Verlaengerung
  einen Schild in Hoehe von 15 % des maximalen Lebens (neuer, minimaler
  `core`-Schluessel `necroFusionShieldOnFusionPct`, ausgewertet in
  `fuseGhost()`). `ghost_071`s Beschreibung/`core` verliert den Satz „Restlebenszeit
  steigt auf mindestens 10 Sekunden"/das Feld `necroFusionMinLifetimeS`.
- **„Einziger Thron" (ghost_071) neu ausgewertet** (Auftrag Abschnitt 3):
  `pushGhost()` prueft `necroUniqueThrone` VOR jedem anderen Zweig — existiert
  bereits ein Champion, verschmilzt der neu ankommende Geist SOFORT und
  bedingungslos in ihn (`fuseGhost()`), unabhaengig von dessen eigenen Werten
  (der Champion gewinnt „per Konstruktion"). Existiert noch keiner (allererster
  Spawn), faellt der Geist durch den normalen Pfad und wird selbst zum ersten
  Champion. `updateGhosts()` faengt zusaetzlich den Randfall „Karte wird
  aktiviert, waehrend schon mehrere gewoehnliche Geister existieren" ab
  (einmaliger Sweep, verschmilzt alle Nicht-Champions in den Champion).
- **FEHLER „Verschmelzungen rechnen aus dem falschen Panzer" behoben**
  (Auftrag Abschnitt 5, der schwerwiegendste der zehn Punkte): `applyFusionTransfer()`
  ist komplett neu geschrieben — jeder Uebertragungsbetrag wird IMMER aus den
  BASISWERTEN DES VERSCHMOLZENEN (`loser.baseMaxHp`/`baseDamage`) berechnet,
  nie aus denen des Champions. Neues additives Bonus-Modell statt des alten,
  selbstreferenziellen Raten-Modells: `g.fusionHpBonus`/`fusionDamageBonus`/
  `fusionFireRateBonus` (ersetzen `fusionHpFrac`/`fusionDamageFrac`/
  `fusionFireRateFrac`) sind Betraege, die sich bei jeder Verschmelzung per
  `grantFusionBonus()` UNGERUNDET aufaddieren; `champion.cfg.damage =
  champion.baseDamage + champion.fusionDamageBonus` wird bei jedem Zuwachs neu
  berechnet — dadurch ist Wachstum ueber mehrere Verschmelzungen linear
  (Auftragsbeispiel exakt nachgerechnet: Champion-Basis 25, verschmolzener
  Geist 10 Basis-LP, 30 % Rate → 25+3=28, nicht die alte fehlerhafte Rechnung
  vom Champion-Basiswert aus). Feuerrate wird dimensionsrichtig als Kehrwert
  (1/Nachladezeit) transferiert, nicht als Sekundenwert. `ghost_072`
  (Zusatzrate je Verschmelzung), `ghost_085` (ERSETZT statt addiert, ueber
  einen eigenen `overrideFrac`-Parameter) und `ghost_098` (s. u.) laufen alle
  ueber dieselbe korrigierte Funktion.
- **FEHLER „Auslese der Legion (ghost_098) funktioniert im normalen
  Spielablauf nicht" behoben** (Auftrag Abschnitt 4, der Kern-Bug): alle
  SECHS Erzeugungsstellen brachen am vollen Limit VOR `pushGhost()` fruehzeitig
  ab (`if (occupiedGhostSlots(state) >= ghostCap) break/return`), sodass
  `pushGhost()`s eigentliche Fusionslogik fuer `necroCapFusion` NIE erreicht
  wurde. Fix an allen sechs Stellen: die Vorab-Sperre gilt nur noch OHNE
  aktives `necroCapFusion` (`... && !pc.necroCapFusion`). Betroffen und
  gefixt: `state.js: killTank()`s Kill-Wiederbelebungs-Schleife (deckt
  Hauptpanzer-, Champion- UND Untertan-Kills gemeinsam ab — alle drei laufen
  durch dieselbe Schleife), `createReplacementGhost()`, `spawnFreeGhosts()`,
  der Raumstart-Ancestor-Hook (alle vier in `state.js`), sowie
  `tank.js: spawnGhostBomb()` (die Geisterbombe — ein durch sie ausgeloester
  Verschmelzungsvorgang zaehlt jetzt als Erfolg: `useSecondary()` liefert
  `true`, die Abklingzeit startet). `pushGhost()`s eigentliche
  `necroCapFusion`-Fusionslogik (schwaechsten GEWOEHNLICHEN Untertan in den
  Champion verschmelzen, Champion selbst nie als Ziel) war bereits korrekt
  gebaut und brauchte keine Aenderung — nur ihre Erreichbarkeit war der Bug.
  Mit `ghost_071` GLEICHZEITIG aktiv hat `necroUniqueThrone` in `pushGhost()`
  Vorrang (steht als erster Zweig vor dem `necroCapFusion`-Zweig).
- **Champion-Boni koennen strukturell nicht mehr auf gewoehnliche Geister
  „ueberspringen"** (Auftrag Abschnitt 6): eine direkte Folge der Sticky-
  Architektur — ein ehemaliger Champion behaelt seine Boni nur, solange er
  selbst noch lebt UND `isChampion` traegt; stirbt er, wird er entfernt
  (kein „Ex-Champion mit Restbonus" moeglich). Ein neuer Champion entsteht
  ausschliesslich ueber `promoteToChampion()` und liest seine `necroCrown*`-Boni
  danach LIVE aus dem Spieler-cfg — nie von einem Vorgaenger uebernommen
  (Fusionsboni sind die einzige Ausnahme und werden explizit ueber
  `state.necroCrownHeir` transferiert, nur mit `ghost_080`).
- **FEHLER „Blutiger Thron (ghost_092) ohne Nutzen anbietbar" behoben**
  (Auftrag Abschnitt 7): neues, generisches Gating-Schema `requiresAnyOf` in
  `upgradepool.js: buildCandidates()` — eine Liste von ODER-Gruppen, JEDE
  Gruppe braucht mindestens eine bereits gewaehlte id (UND ueber Gruppen, ODER
  innerhalb einer Gruppe), zusaetzlich zum bestehenden `requires` (reines UND
  ueber Einzel-ids). `ghost_092` bekommt
  `requiresAnyOf: [["ghost_071","ghost_098"], ["ghost_011","ghost_012","ghost_013"]]`
  — erscheint nur, wenn mindestens eine funktionierende Fusionsquelle UND
  mindestens eine der drei `pureStack`-Zaehlerkarten aktiv ist. Gilt
  automatisch fuer Angebot/Shop/Truhe/Reroll (alle vier laufen durch
  `buildCandidates()`). Die Karteneffekte selbst (Verschmelzung zaehlt als
  halber Geistertod fuer `ghost_011`/`012`/`013`, kein zweites Ausloesen von
  Heilung/Explosion/Abklingzeitreduktion) sind unveraendert.
- **FEHLER „falsche Nekromanten-Klassenbeschreibung" behoben** (Auftrag
  Abschnitt 8): `data/tanks.json: types.c_necro.desc` nannte noch die laengst
  archivierte zweistufige 50 %/33 %-Chance (Kills durch Spieler/Geist) —
  ersetzt durch den tatsaechlichen, seit Nekromant-V2 Phase 3 geltenden
  einheitlichen 35-%-Basiswert fuer Kills durch Hauptpanzer, Champion UND
  gewoehnlichen Untertan gleichermassen. **Der tatsaechliche Wert (`balance.json:
  ghost.reviveChance` 0,35) wurde NICHT geaendert** — nur der irrefuehrende
  Text korrigiert.
- **FEHLER „verbotene Obergrenzen in Upgrade-Effekten" behoben** (Auftrag
  Abschnitt 9, umfangreichster Einzelpunkt): ALLE genannten und beim
  Durchsuchen zusaetzlich gefundenen kuenstlichen Deckel entfernt, jeweils in
  Code UND Kartentext UND `cfg.js`-Applier-Kommentar:
  - `ghost_015` „Aschenhaut" (Schild-Stapel, war 20 %) — waechst jetzt
    unbegrenzt mit jedem Geistertod.
  - `ghost_023` „Ueberlaufende Seele" (war 25 %) — `necroOverflowShieldCapPct`
    (Zahl) ist durch `necroOverflowToShield` (reines Freischalt-Flag) ersetzt,
    verwandelt den GESAMTEN Ueberlauf in Schild.
  - `ghost_050` „Munitionsaustausch" (war 30 %) — der Feuerraten-Stapel
    waechst unbegrenzt.
  - `ghost_075` „Raubseele" (war 15 %) — der Ueberlauf-Schild ist unbegrenzt.
  - `ghost_088` „Blutige Formation" (war 80 %) — der Wiederkehr-Schadensbonus
    des naechsten wiederbelebten Untertanen ist unbegrenzt.
  - `ghost_097` „Thron aus Gebein" (war 60 % Schaden **plus** ein im
    Kartentext nie erwaehnter versteckter Schild-Deckel bei genau 1×maxHp) —
    BEIDE entfernt.
  - Zwei WEITERE, beim systematischen Durchsuchen auf „vergleichbare
    versteckte Obergrenzen" gefundene, im Kartentext nie erwaehnte
    Schild-Deckel (nicht in der Auftragsliste namentlich genannt, aber von
    Auftrag Abschnitt 9 explizit als Suchauftrag verlangt): `ghost_087`
    „Erben der Front" (Schild-Anteil war bei 1×maxHp gekappt) und `ghost_094`
    „Erbe des Herrschers" (derselbe versteckte 1×maxHp-Deckel) — beide
    entfernt, der generische Schild-Punktepool (`absorbWithShieldPool()`,
    Nekromant-V2 Phase 2) kannte ohnehin nie einen Speicherdeckel.
  - **Feuerrate ohne Obergrenze, mathematisch stabil**: die alte Formel
    `Math.max(0.1, 1 - pct)` deckelte die Feuerrate faktisch bei `pct ≥ 0.9`
    (10 % Mindest-Cooldown) — ersetzt durch `necro.js: fireRateFactor(pct) =
    1/(1+pct)` (Kehrwert-Modell, dieselbe Bauart wie die bestehende
    Resistenz-Formel `Schaden/(1+Resistenz/Divisor)`), verwendet an BEIDEN
    Stellen, die die alte Formel nutzten (`tank.js: fireBullet()` fuer den
    Hauptpanzer, `ghost.js: updateGhosts()` fuer Untertanen-Feuerraten-Stapel).
    Nie negativ, nie Division durch 0, waechst aber ohne Obergrenze weiter.
  - Sechs entsprechende `cfg.js`-Applier-Zeilen (`necroShieldCapPct`,
    `necroOverflowShieldCapPct`→umbenannt, `necroAmmoExchangeCap`,
    `necroCrownLifestealShieldCapPct`, `necroHybridReviveDeathBonusCap`,
    `necroKeystoneThroneDmgCap`) sind entfernt bzw. umbenannt — kein Ersatz-
    Deckel irgendeiner Form eingefuehrt.
  - **Bewusst NICHT angefasst**: die normale `hp ≤ maxHp`-Klammer (mehrfach
    per `Math.min(cfg.maxHp, ...)` bei Heilungen) — das ist keine kuenstliche
    Obergrenze auf einen Upgrade-Effekt, sondern die im Auftrag selbst
    ausdruecklich verlangte „normale aktuelle-LP ≤ maximale-LP"-Beziehung.
    Ebenso unangetastet: der generische Krit-Deckel (`balance.json: crit.cap`,
    UMBAUPLAN-LP Phase 7) — ein Klassen-/Kernsystem ausserhalb des
    Nekromanten-Signaturpools, nicht Teil dieses Auftrags.
- **Nekromant-V2 Phase 1 („Stapelregel gilt fuer beide Auftraege") bereits
  vollstaendig, keine Aenderung noetig**: `isUnique`/`maxStacks`-Abschaffung war
  schon gebaut — nicht-einzigartige Karten (`isUnique: false`, alle
  betroffenen Ghost-Karten dieses Nachschliffs eingeschlossen) waren schon vor
  diesem Auftrag unbegrenzt stapelbar, `isUnique: true`-Karten schon vorher
  nach einmaliger Wahl aus dem Pool verschwunden — verifiziert statt neu
  gebaut.
- **Geaenderte Dateien**: `src/game/ghost.js` (Kernumbau: `promoteToChampion`/
  `ensureChampion`/`grantFusionBonus` neu, `applyFusionTransfer`/`fuseGhost`/
  `pushGhost`/`killGhost`/`occupiedGhostSlots`/`updateGhosts` umgeschrieben,
  `fuseGhost` fuer Tests exportiert), `src/game/state.js` (drei Cap-Bypass-
  Fixes + zwei entfernte versteckte Schild-Deckel), `src/game/tank.js`
  (`spawnGhostBomb()`-Cap-Bypass, `fireRateFactor()` statt der alten Formel),
  `src/game/necro.js` (`fireRateFactor()` neu + vier entfernte Deckel:
  `ghost_015`/`023`/`097`/`087`), `src/game/cfg.js` (sechs entfernte/umbenannte
  Applier-Zeilen fuer Deckel-Felder), `src/game/upgradepool.js`
  (`requiresAnyOf`-Gating neu), `data/balance.json`
  (`ghost.championStatPct` neu + `_comment_ghost` aktualisiert),
  `data/tanks.json` (`c_necro.desc` korrigiert), `data/upgrades_necro.json`
  (elf Karten geaendert: 068/071/073/083 Champion-Neubelegung, 015/023/050/
  075/088/092/097 Cap-Entfernung bzw. `requiresAnyOf`), `sw.js`+`telemetry.js`
  (Version `v115`).
- **Tests**: `tests/regression.mjs` — die komplette Nekromant-V2-Testbasis
  (Abschnitte 42/43/45/58/59/60/61/62/63, mehrere hundert Einzelpruefungen)
  mediengerecht auf die neue Sticky-Architektur umgestellt. Zentrales
  wiederkehrendes Testmuster, an ueber zwanzig Stellen angewendet: ein solo
  gepushter Testgeist wuerde durch `ensureChampion()` SOFORT selbst befoerdert
  und dabei seine manuell gesetzten Werte verlieren — ein zuerst per
  `pushGhost()` gesetzter „Anker"-Geist haelt den Champion-Titel, damit der
  eigentlich zu pruefende Geist gewoehnlich bleibt (`push()`, der alte rohe
  Test-Helfer ohne Champion-Bestimmung, wird dadurch an vielen Stellen durch
  `pushGhost()` ersetzt bzw. um einen Anker ergaenzt). Zweites wiederkehrendes
  Muster: „Champion zaehlt nie gegen das Limit" bedeutet, dass Testschleifen,
  die vorher `cap`-mal spawnten, jetzt `cap + 1`-mal spawnen muessen (1
  Champion + `cap` Gewoehnliche), um das Limit wirklich zu fuellen — an sieben
  Stellen korrigiert. Fuenf NEUE Tests fuer Luecken, die beim Gegenprobe-Bau
  erst auffielen (keine davon war vorher indirekt mitgetestet): (1) der
  echte `killTank()`-Wiederbelebungsweg fuer `ghost_098` (Abschnitt 61(v2),
  vorher pruefte nur der direkte `pushGhost()`-Aufruf — Gegenprobe zeigte
  0 rote Tests trotz zurueckgenommenem Fix, bis dieser Test ergaenzt war),
  (2) derselbe Weg ueber die echte Geisterbombe (`useSecondary()`,
  Abschnitt 61(v3)), (3) `requiresAnyOf` direkt gegen `buildCandidates()`
  in allen vier Kombinationen (Abschnitt 63(a2)), (4)/(5) die Sticky-
  Champion-Regel selbst explizit als „ersetzt NIE durch Vergleich"
  (Abschnitt 43(m)/(m3), ersetzt die alte, jetzt explizit verbotene
  „Titel wechselt dynamisch"-Testaussage). Mehrere Tests mussten inhaltlich
  umgedacht werden, nicht nur umbenannt: die Basiswert-Uebertragung wird jetzt
  gegen einen SEPARATEN Kontroll-Geist gemessen (Champion-Basis ≠ Basis eines
  gewoehnlichen, nie befoerderten Geistes — beide Werte unterscheiden sich
  strukturell, ein Test, der beide gleichsetzt, misst den falschen
  Mechanismus). **Sieben gezielte Gegenproben am echten Quellcode** (Sticky-
  Champion-Ersetzung, Fusion-„falscher Panzer", `ghost_098` ueber `killTank()`,
  `ghost_098` ueber die Geisterbombe, `requiresAnyOf`-Filter, `ghost_015`s
  Deckel-Wiedereinbau) — jede hat genau die erwarteten, benannten Pruefpunkte
  rot gemacht, sonst nichts, danach zurueckgesetzt. `tests/gamepad.mjs`/
  `tests/music.mjs` bleiben gruen; Playwright-Smoke (Nekromant waehlen, Run
  starten, Raum betreten, 6 Sekunden echte Simulation, keine Konsolenfehler)
  bestanden.
- **Renderer/HUD brauchten KEINE Aenderung** (verifiziert, nicht nur
  angenommen): der bestehende goldene Ring (`renderer.js: drawGhosts()`,
  `if (g.isCommander || g.isChampion)`) erfuellt die Sichtbarkeits-Anforderung
  (Auftrag 2.5, „klar erkennbarer goldener Marker") bereits vollstaendig,
  jetzt zusaetzlich korrekt, weil `isChampion` nicht mehr pro Frame flackert.
  Kein dediziertes Champion-Sprite vorhanden — bleibt offen (s. To-do).

### Kartenbelohnung/Shop-Ueberarbeitung (Nutzerauftrag) — gemergt
Zwei EIGENSTAENDIGE, kontextabhaengige Seltenheitstabellen ersetzen die
bisherige globale `balance.rarity` + `balance.rarityGates`-Kombination;
dazu individuelle, nach Seltenheit gewuerfelte Shop-Kartenpreise statt des
fruehereren einheitlichen `scrap.cost.shopCard`.
- **Zwei neue Run-Zaehler** (`src/game/run.js`): `run.totalRoomIndex` ist
  RUNWEIT (faengt NIE pro Akt neu bei 1 an, anders als das akt-lokale
  `run.roomIndex` — s. `actRoomKey()`), inkrementiert an genau drei Stellen:
  `advanceToMapNode()` (jeder echte Raumwechsel innerhalb eines Akts),
  `advanceAct()` (Eintritt in Raum 1 des naechsten Akts) und dem
  Endlosmodus-Zweig in `afterRoomDone()`. `run.shopsVisited` zaehlt echte
  Shop-EINTRITTE (in `advanceToMapNode()`, wenn `node.type === 'workshop'`)
  — NICHT Neu-Rendern/Kaufaktionen innerhalb desselben Besuchs, die laufen
  nie durch diese Funktion. Ein Resume (`createRun({resume})`) laeuft NIE
  durch `advanceToMapNode()`, zaehlt also nie doppelt. Beide Felder stehen im
  `runSnapshot()`; ein aelterer Zwischenstand ohne die Felder rekonstruiert
  `totalRoomIndex` bestmoeglich aus den bekannten Akt-Raumzahlen
  (`estimateTotalRoomIndex()`), `shopsVisited` faellt neutral auf 0 zurueck.
- **`data/balance.json: rewardRarityBands`/`shopRarityBands`** (je 5 Zeilen,
  jede summiert exakt auf 100): normale Kartenbelohnungen (Kampf/Elite/
  Verflucht/Ereignis-Kartenoption) staffeln sich nach `run.totalRoomIndex`
  (Raum 1–4/5–9/10–14/15–20/21+), das Shop-Regal eigenstaendig nach
  `run.shopsVisited` (Besuch 1–2/3–4/5/6/7+). `balance.rarityGates` (das
  fruehere globale legendary-Mindestraum-Gate) ist ERSATZLOS ENTFERNT — alle
  fuenf Stufen sind ab Raum 1 grundsaetzlich ZIEHBAR, nur die
  WAHRSCHEINLICHKEIT staffelt sich noch. Der per-Karte `minRoom`-Gate bleibt
  (echte Kartenvoraussetzung, aktuell bei jeder Karte `minRoom:1` — ein No-op).
- **`src/game/upgradepool.js: rewardRarityWeights(balance, totalRoomIndex)`/
  `shopRarityWeights(balance, shopsVisited)`** (neu, exportiert) waehlen das
  passende Band; Fallback auf die flache `balance.rarity`, falls die Baender
  fehlen (aeltere/synthetische Balance-Objekte, v. a. Tests).
  `rollOffers()`/`drawOne()` lesen `opts.rarityWeights || balance.rarity`
  statt fest `balance.rarity` — `run.js: poolOpts()` setzt die Reward-Baender
  fuer ALLE normalen Kartenquellen (Angebot/Verbannen/Vierte Karte/Ereignis-
  Kartenoption), `startNonCombatRoom()`s Shop-Zweig ueberschreibt sie mit den
  Shop-Baendern. **`weightedPick()` selbst ist komplett UNVERAENDERT** — die
  bestehende Tier-Normierung verteilt eine an einer Stufe fehlende Karte
  bereits automatisch proportional auf die vorhandenen Stufen um (mathematisch
  bewiesen: die Summe der Gewichte je Stufe ist immer exakt `weights[stufe]`,
  unabhaengig von Kartenzahl UND Synergiegewichtung — deckt "Umverteilung bei
  fehlender Stufe" UND "Synergie verzerrt nie die Stufenwahrscheinlichkeit"
  ohne Codeaenderung ab).
- **Shop-Preise** (`data/balance.json: shop.cardPriceRanges`, fuenf sich
  NICHT ueberschneidende, streng steigende Intervalle: common 2–4, uncommon
  5–6, rare 7–10, epic 11–14, legendary 15–19): `run.js: rollShopPrice()`
  wuerfelt EINMAL je angebotener Karte beim Betreten des Shops
  (`startNonCombatRoom()`), aus demselben deterministischen
  `run.rng.upgrades`-Strom wie die Kartenauswahl selbst — Seed + Raumnummer
  reproduzieren dadurch automatisch dieselben Preise, KEIN eigener
  Snapshot-Eintrag noetig (dasselbe Prinzip wie das Regal selbst seit
  Phase 13). `buyShopCard()` liest `offer.price` statt des entfernten
  `scrap.cost.shopCard`. `src/ui/roomscreens.js: renderCards()` zeigt den
  individuellen Preis je Karte statt eines Abschnittstitels mit Einheitspreis.
- **Alle anderen Shop-Aktionen unveraendert** (Schildladung, Sekundaerwaffe/
  Gadget tauschen, Leben, Werkbank, Ablegen) — sie haengen nie am Kartenpreis.
- **Neuer Testabschnitt 64** (`tests/regression.mjs`, Gegenprobe fuer jeden
  Kernpunkt einzeln bestanden — je absichtlich rot gemacht: Bandgrenze in
  `pickBand()` um eins verschoben, `totalRoomIndex`-Inkrement in
  `advanceToMapNode()` entfernt, `shopsVisited`-Inkrement entfernt,
  Preiswuerfeln deaktiviert, `buyShopCard()` auf einen festen Preis
  zurueckgebaut, ein rarity-basiertes Eligibility-Gate probeweise wieder in
  `buildCandidates()` eingebaut, die Resume-Wiederherstellung von
  `totalRoomIndex`/`shopsVisited` ausgebaut): Struktur (beide Baender-
  Tabellen, Summe 100 je Zeile, `rarityGates`/`scrap.cost.shopCard` wirklich
  weg, Preisbaender ueberschneidungsfrei + streng steigend), exakte
  Bandwahl an allen acht Grenzen (Raum 4/5, 9/10, 14/15, 20/21; Shop 2/3,
  4/5, 5/6, 6/7) + Fallback ohne Baender, legendary deterministisch
  erreichbar in Raum 1 (gestellter `rng()`-Wert statt Statistik), Umverteilung
  bei fehlender Stufe (deterministisch ueber eine gleichmaessig verteilte
  `rng()`-Sequenz), ein kompletter Playthrough (eigener Seed) mit
  RAUMGENAUEM `totalRoomIndex`-Inkrement (**wichtiger Testfund**: eine erste
  Fassung pruefte nur "totalRoomIndex springt beim Akt-Uebergang um genau 1"
  — das haette einen komplett fehlenden Zaehler an der eigentlichen Stelle
  NICHT gefangen, weil `advanceAct()` selbst schon inkrementiert; jetzt wird
  JEDE Iteration gegen einen Akt+Raum-Schluessel geprueft, nicht nur die
  Akt-Grenze) + korrektem `shopsVisited`, Preise im richtigen Band, Preise
  stabil nach einer ANDEREN Shop-Aktion, Affordability/exakter Abzug/
  Verkauft-Sperre, Resume reproduziert Angebote UND Preise identisch, eine
  ueber den Shop gekaufte einzigartige Karte verschwindet aus allen Pools.
  Playwright-Smoke (echter Playthrough im Browser bis zum ersten Shop,
  Preise im richtigen Band, keine Konsolenfehler) bestanden.
- Kein `sw.js`-Bump (reine Code-/Datenaenderung, kein neues/geaendertes
  Asset — die Strategie ist network-first fuer Code+Daten, ein Online-Reload
  liefert `data/balance.json`/den neuen Code ohnehin sofort frisch).

### Champion-Sprite (Nutzergrafik, Nachtrag zum Champion-Nachschliff) — gemergt
Loest den letzten offenen To-do-Punkt aus dem Champion-Nachschliff ein: der
Champion teilt sich nicht mehr `body_ghost.png`/`turret_ghost.png` mit den
gewöhnlichen Untertanen, sondern hat ein eigenes goldenes Sprite-Paar PLUS
eine 12-Frame-Aura-Loop-Animation, die dauerhaft im Loop läuft.
- **Zwei gelieferte Nutzergrafiken**: ein Kombibild (Wanne links/Turm rechts,
  schwarzer Hintergrund — dieselbe Konvention wie alle bisherigen
  `body_X.png`/`turret_X.png`-Lieferungen) und ein 12-Frame-Animationssheet
  (6×2-Raster, hellgrauer Schachbrett-Hintergrund statt Alpha, da als JPEG
  geliefert) einer bereits fertig zusammengesetzten Wanne mit umherziehenden
  Flammenschädeln — die Wannen-Pose ist über alle 12 Frames FEST, nur die
  Schädel/der Glanz animieren (per Bildvergleich verifiziert).
- **Verarbeitung** (einmaliges Skript, nicht eingecheckt, PIL+scipy wie bei
  allen bisherigen Sprite-Lieferungen): Kombibild randverbunden vom
  schwarzen Hintergrund befreit (dieselbe Flood-Fill-Technik wie immer —
  Tracks/Loch bleiben erhalten, weil nicht randverbunden), Turm-Drehpunkt
  ("breitesten-Zeile"-Heuristik, liefert zuverlässig das Kuppelzentrum) VOR
  der 90°-Rotation ermittelt und die exakte PIL-Rotationsformel (empirisch
  gegen einen einzelnen Marker-Pixel verifiziert, nicht nur angenommen) auf
  den Punkt angewendet, damit Rohr-zeigt-nach-rechts UND der Drehpunkt in
  der Bildmitte beide stimmen. Wannen-Loch über eine randverbundene
  Flood-Fill-Suche nach dunklen, NICHT randverbundenen Flächen im
  Zentrumsbereich lokalisiert (dieselbe „Loch = Turmdrehpunkt"-Erkenntnis
  aus den früheren Klassen-Sprite-Lieferungen), Canvas darauf zentriert.
  Das Animationssheet nutzt eine ANDERE Freistellung (Erkennung über
  neutralgraue Pixel im Schachbrett-Helligkeitsbereich statt schwarzer
  Flood-Fill, weil JPEG-Checker statt echtem Alpha geliefert wurde) —
  Ergebnis in `assets/sprites/body_champion.png`/`turret_champion.png`
  (92×110/410×200) und `champion_aura_00.png`…`_11.png` (je 160×160).
- **`src/render/sprites.js`**: `'champion'` in `TANK_TYPES` (lädt
  body/turret automatisch über den bestehenden Mechanismus), neue Kategorie
  `SPRITES.championAura` (kein Rumpf/Turm-Paar, sondern 12 fertige,
  NICHT-rotierende Einzelbilder) + `CHAMPION_AURA_FRAME_COUNT` (12) +
  `championAuraFrame(index)` (Wraparound für Indizes außerhalb 0..11).
- **`src/render/renderer.js: drawGhosts()`**: für `g.isChampion` wird jetzt
  (a) EIN Aura-Loop-Frame ZUERST gezeichnet — screen-aligned, NICHT mit
  heading/turret rotiert (die Quellframes sind bereits fertig zusammengesetzt
  und lassen sich nicht in Rumpf/Turm trennen), größer skaliert + reduzierte
  Deckkraft, damit er wie ein weicher Nimbus HINTER dem korrekt rotierenden
  Vordergrund-Tank wirkt; (b) `body_champion`/`turret_champion` statt
  `body_ghost`/`turret_ghost`, mit voller Deckkraft (0,92 statt der
  Geister-Transparenz 0,55 — die Nutzergrafik ist deckendes Gold, keine
  durchscheinende Geister-Optik). **Der bestehende goldene Ring bleibt
  BEWUSST erhalten**, auch für den Champion (nicht durch das neue Sprite
  ersetzt): "fällt immer auf funktionierende prozedurale Formen zurück" ist
  eine durchgehende Regel dieses Renderers — lädt das Champion-Sprite (noch)
  nicht (langsames Netz, Ladefehler), wäre der Champion ohne den Ring optisch
  nicht mehr von einem gewöhnlichen Untertan zu unterscheiden.
- **12 Frames bei 12 fps = exakt 1 s pro Umlauf** (`CHAMPION_AURA_FPS`),
  über `state.time` (nicht `performance.now()`) — bleibt dadurch synchron
  mit Zeitlupe/Pause wie jede andere zeitgesteuerte Animation im Spiel.
- **Neuer Test `tests/championsprite.mjs`** (dependency-frei, NEUES eigenes
  Testfile statt eines Abschnitts in `regression.mjs`): `src/render/
  sprites.js` legt `initSprites()` als Modul-SEITENEFFEKT beim ersten Import
  von `renderer.js` an (danach stumm wegen eines internen Deckels) — die
  bestehende Suite importiert `renderer.js` längst mit `domstub.mjs`s
  ABSICHTLICH FEHLSCHLAGENDEM Image-Stub (kein Netz im Test), sodass echtes
  Sprite-Laden dort nie geprüft werden kann. Das neue Testfile installiert
  stattdessen einen EIGENEN, ERFOLGREICHEN Image-Stub VOR dem allerersten
  Import von `renderer.js`. Prüft: Struktur (genau 12 Aura-Frames + das
  Champion-Sprite-Paar geladen, erwartete Dateinamen angefordert),
  `championAuraFrame()`-Wraparound, der ECHTE Renderpfad zeichnet für
  `g.isChampion=true` tatsächlich `body_champion`/`turret_champion` + einen
  Aura-Frame und NICHT `body_ghost`/`turret_ghost` (und umgekehrt für
  `false`), und der Loop läuft wirklich (vier über eine Sekunde verteilte
  Zeitpunkte zeigen vier verschiedene Frames, nach einer vollen Sekunde
  exakt derselbe Frame wie zu Sekundenbeginn — Zeitpunkte bewusst auf
  Frame-MITTE statt Frame-Grenze gelegt, sonst hätte Gleitkomma-Rundung bei
  `11/12*12` den falschen Frame-Index treffen können). Gegenprobe für jeden
  Kernpunkt einzeln bestanden (`CHAMPION_AURA_FRAME_COUNT` verfälscht,
  `useChampionSprite` auf `false` erzwungen, Aura-Frame-Index eingefroren).
- **Playwright-Smoke**: alle 14 neuen PNG-Dateien laden im echten Browser
  fehlerfrei mit den erwarteten Abmessungen; ein echter, über die
  Spielmodule gebauter Champion-Untertan wird über den echten Renderpfad in
  einen echten Canvas gezeichnet und als Screenshot geprüft — Sprite, Ring
  und Aura erscheinen sichtbar und korrekt ausgerichtet, keine
  Konsolenfehler.
- `sw.js` auf `v116` gebumpt (14 neue PNG-Dateien in `ASSETS`, cache-first
  wie alle Bild-Assets) + `telemetry.js: GAME_VERSION` mitgezogen.

### Champion-/Nekromant-Nachschliff v2 (24-Punkte-Auftrag) — gemergt
Vollständige Überarbeitung des Champion-/Fusions-/Rastplatz-Systems, ausgelöst
durch eine 24-Punkte-Vorgabe des Nutzers (deutschsprachige Spezifikation).
Kein neues Ressourcensystem, keine neue Datei außer dem Glossar — alle Fixes
bauen auf den bestehenden Feldern (`state.necroStacks`/`shield`/`hp`/
`fusionHpBonus` usw.) auf.
- **Rastplatz komplett umgebaut**: das alte Stufen-/Deckel-System
  (`run.upgradeLevels`, „+"-Suffix, Rastplatz-Skalierung in `cfg.js`) ist
  ersatzlos entfernt. Der Rastplatz bietet jetzt **Reparaturtrupp** (+1 Leben,
  gedeckelt) oder **Werkbank**: eine bereits besessene WIEDERHOLBARE Karte
  erneut wählen — behandelt exakt wie ein frisches Angebot (derselbe
  Stapelzähler `run.upgrades[id]`, keine Obergrenze). Einzigartige
  (`isUnique: true`) Karten erscheinen dort strukturell nie (können nur 1×
  existieren). Der Shop übernimmt dieselbe `workbenchOptions()`/
  `upgradeCardAtRest()`-Logik für seine Werkbank-Aktion (gegen Schrott, ohne
  den Raum zu beenden).
- **Champion ist jetzt LIMITIERT statt unendlich lebendig**: `promoteToChampion()`
  setzt die Lebensdauer auf denselben Basiswert wie ein gewöhnlicher Untertan
  (`balance.ghost.lifetimeS`) + `ghostLifetimeAdd` (wirkt jetzt auf BEIDE,
  nicht mehr nur auf gewöhnliche Geister) + die vier neuen Champion-
  exklusiven Lebensdauer-Karten (`necroCrownLifetimeAdd`). „Ewiger Thron"
  (`ghost_083`, `necroCrownEternalLifetime`) bleibt die EINZIGE Ausnahme, die
  die Lebensdauer wieder auf `Infinity` setzt.
- **Champion-Nachfolge ist SOFORTIG**: `ensureChampion(state)` läuft sowohl
  in `pushGhost()` (nach jedem Spawn) als auch am Ende von `killGhost()`
  (nach jedem Tod) — stirbt der Champion und lebt noch ein gewöhnlicher
  Untertan, wird der stärkste SOFORT im selben `killGhost()`-Aufruf befördert.
  „Kronenerbe" (`ghost_080`) konsumiert sein Erbe-Fenster (`state.necroCrownHeir`,
  ohne Zeitfenster/`deadline` mehr) jetzt direkt in `promoteToChampion()` statt
  im alten, zeitfenstergebundenen `createGhost()`-Zweig — deckt damit sowohl
  einen bereits existierenden beförderten Geist als auch einen brandneuen Spawn.
- **Fusion überträgt jetzt 100 % (statt 30/30/12 %) der Basiswerte** des
  Verschmolzenen (`fuseGhost()`/`applyFusionTransfer()`, Standard-Fallback
  `?? 1.0` für `hpFrac`/`dmgFrac`/`frFrac`). Zusätzliche Karten-Boni addieren
  sich weiterhin OBEN AUF diese Baseline. „Einziger Thron" (`ghost_071`)
  gewährt zusätzlich `necroUniqueThronePerFusionPct` (+5 Prozentpunkte je
  bereits erfolgter Verschmelzung, ohne Obergrenze — additiv zur Basisrate,
  nicht kompondierend). „Seelenkoloss" (`ghost_085`) ERSETZT die Übertragung
  komplett auf 150 %/150 %/60 % statt sie zu addieren.
- **Elf neue Karten**: drei Fusionskarten „Einziges Schwert"/„Einziges
  Schild"/„Einziger Bogen" (`ghost_106`–`108`, je +15 Prozentpunkte auf
  Schaden/Leben/Feuerrate, wiederverwenden die bestehenden `necroFusion*PctBonus`-
  Felder, an `ghost_071` gebunden); fünf Wiederbelebungschance-Karten je
  Seltenheit (`ghost_044`/`055`/`109`/`110`/`111`, +7/+10/+12/+18/+25 Prozentpunkte,
  wirken auf Kills durch Hauptpanzer/Champion/Untertanen gleichermaßen, kein
  Deckel); vier neue Champion-Lebensdauer-Karten (`ghost_112`–`115`,
  +1/+1,5/+2/+3 s, dazu die überarbeitete `ghost_005` „Längerer Eid" mit
  +0,5 s statt +2 s, wirkt jetzt auf BEIDE Einheitentypen); `ghost_116`
  „Losgelöste Ketten" (episch, einzigartig, garantiert einen mobilen
  Panzertyp für die per Geisterbombe erzeugten Untertanen,
  `necroForceMobileBomb` in `spawnGhostBomb()`).
- **14 bestehende Karten überarbeitet** (exakte neue Werte laut Vorgabe):
  Kronenerbe (sofortige statt zeitfenstergebundene Nachfolge, 60 % Erbe),
  Elite-Reaktivierung (90 % statt 65 %), Blutiger Thron (Verschmelzung zählt
  jetzt VOLL statt halb für `pureStack`-Zähler), Seelenzorn/Totenrhythmus
  (2 %→5 %, dauerhaft statt 3 s-Fenster), Königliches Opfer (40 % von des
  Champions BASISwerten dauerhaft direkt auf die Spieler-cfg statt eines
  Zeitfenster-Stapels), Treues Ende (60 %→50 %), Dunkler Treibstoff
  (3 s→2 s, +15 % Feuerrate), Härte aus Verlust (dauerhaft statt 10 s),
  Seelenmonolith (Auslöser ist jetzt die Bewegung des HAUPTPANZERS, nicht
  mehr die des Champions selbst — `state.player.vx/vy` statt `g.vx/vy`),
  Seelenband (nur noch die Schadensumleitung, der Zusatzbonus ist entfernt),
  Erbschaft des Starken (dauerhaft statt 10 s). `ghost_068` „Langer
  Anspruch" ist VOLLSTÄNDIG ENTFERNT (war durch die begrenzte
  Champion-Lebensdauer wieder sinnvoll, aber als eigene Karte durch die vier
  neuen Lebensdauer-Karten ersetzt).
- **Gadget-Sperre und automatische Wiederbelebung entkoppelt**: eine
  Ausrüstungssperre (Raum-Modifikator) blockiert weiterhin den
  Gadget-/Geisterbomben-Weg, NICHT aber die kill-ausgelöste automatische
  Wiederbelebungschance (`canRevive` in `state.js` unabhängig davon geprüft).
- **Elite-Wiederbelebung ist jetzt grundsätzlich möglich** (nicht mehr hinter
  einer Karte versteckt): `canRevive` ist für Elite-Gegner strukturell erlaubt
  (Bosse bleiben ausgenommen), `slotCost: 2` gilt für einen wiederbelebten
  Elite-Untertan IMMER (unabhängig von Karten), nur der Statwert-Bonus
  (`baseStatPctOverride` 50 %→90 %) bleibt an „Elite-Reaktivierung" gebunden.
- **Zentrales Glossar** (`data/glossary.json` + neues Modul `src/ui/glossary.js`):
  12 Fachbegriffe (Champion, Geisterpanzer, Untertan, Verschmelzung,
  Geistertod, Wiederbelebungschance, Feuerrate, Schadensresistenz,
  Elitegegner, Einzigartig, Raumende, Geisterlimit) werden über
  `highlightTerms(text)` (Regex-basiert, HTML-escaped) in Kartentexten blau
  markiert — Desktop zeigt die Erklärung per `title`-Tooltip beim Hovern,
  Touch über einen delegierten Klick-Listener (`installGlossaryTooltips()`),
  der eine `.glossary-bubble` einblendet. Eingehängt in `upgradescreen.js`
  und `roomscreens.js` (Shop-Kartenregal), initialisiert einmalig in
  `main.js: init()`.
- **Pinker Panzer 10 % langsamer**: `t_pink.bulletSpeed` neu auf 117
  (`data/tanks.json`), NUR dieser Typ — `cfg.js` löst jetzt ein optionales
  Pro-Typ-`bulletSpeed`-Override für Gegner auf, statt ausschließlich aus
  `data/tanks.json: bulletSpeeds[weapon]` zu lesen. Der 3-aktive-Kugeln-Deckel
  bleibt unverändert.
- **Grüner (Mörser) langsamer**: `balance.mortar.flightTimeS` 1,1 s→1,7 s
  (Flug- UND Warnzeit sind derselbe Wert) — ein normal schnell laufender
  Panzer kann den Explosionsradius (unverändert 44 px) jetzt vollständig
  verlassen, bevor die Granate einschlägt; der Telegraph (`drawMortars()`)
  folgt automatisch derselben Zeit.
- **Eliteraum-Belohnung verbessert**: neue `eliteRarityWeights()`
  (`upgradepool.js`) + `data/balance.json: eliteRarityBands` garantieren
  mindestens eine epische/legendäre Karte im Angebot und gewichten
  epische/legendäre Karten insgesamt höher als bei einer normalen Belohnung
  — datengetrieben über dieselbe `pickBand()`-Tabellenlogik wie die
  bestehenden Reward-/Shop-Bänder (Part A dieser Auftragsreihe).
- **Bosskill garantiert drei verschiedene legendäre Karten**: neues
  `run.js: rollBossReward()`/`finishBossReward()`/`chooseBossReward()` +
  ein neuer Run-Phase-Zustand `bossReward` (zwischen Bosskill und
  Akt-Übergang/Run-Ende, verdrahtet in `stepRun()` und `main.js`, nutzt den
  bestehenden Upgrade-Screen als UI). Zieht dreimal über `drawOne(...,
  onlyRarity: 'legendary', bypassRoomGate: true)` mit wachsender Vermeidungs-
  liste (`avoidIds`), damit keine Karte doppelt erscheint. **Die
  Standardklasse (`player`) hatte dafür bisher gar keine legendäre Karte** —
  drei neue universelle Legendaries (`sockel_kriegsmeister`/
  `sockel_titanpanzerung`/`sockel_sturmantrieb`, `data/upgrades.json`) stellen
  sicher, dass jede spielbare Klasse mindestens drei ziehbare Legendaries hat.
  Bereits gewählte einzigartige Karten werden nicht erneut angeboten
  (dieselbe `isUnique`/`selectedUniqueUpgradeIds`-Prüfung wie überall sonst).
  Funktioniert unverändert über alle drei Akt-Bosskills und den finalen Sieg.
- **Datenkonsistenz-Durchgang**: alle bestehenden Karten mit sub-100%-
  Übertragungswerten (`ghost_071`/`072`/`085`/`098`) sind gegen die neue
  100%-Baseline geprüft/angepasst, sieben zuvor künstliche Prozent-Deckel in
  Nekromanten-Karten waren schon vom vorherigen Nachschliff entfernt worden
  (unverändert übernommen). Bestehende einzigartige Karten-IDs blieben beim
  Überarbeiten unverändert, alle elf neuen Karten haben frische, eindeutige
  IDs mit passender Seltenheit/`requires`.
- **Tests**: die riesige bestehende Nekromant-Testbasis
  (`tests/regression.mjs` Abschnitte 42/43/45/58–63) ist auf die neue
  Sticky-Champion-mit-begrenzter-Lebensdauer-Architektur, die 100%-
  Fusionsbaseline und die überarbeiteten Karten umgestellt (u. a.: Champion
  zählt strukturell nie gegen das Geisterlimit — Testschleifen brauchen jetzt
  `cap + 1` Spawns statt `cap`; ein solo gepushter Testgeist wird sofort
  selbst Champion — Tests, die einen GEWÖHNLICHEN Geist brauchen, halten
  jetzt einen separaten „Anker"-Champion). Neuer Abschnitt 65 deckt die
  meisten der 38 im Auftrag verlangten Testfälle ab (Rastplatz-Repick,
  Champion-Lebensdauer + Ewiger-Thron-Ausnahme, 100%-Fusion + Kartenzuschläge,
  sofortige Nachfolge, Elite-Wiederbelebung ohne Karte, Eliteraum-/
  Boss-Belohnungsgarantien, Speichern/Laden, Glossar-Mechanismus). Mehrere
  echte Testfunde beim eigenen Umbau (jeweils per Gegenprobe bestätigt,
  nicht nur behauptet): (1) ein Testfall mutierte das GETEILTE
  `upgradesData`-Objekt direkt statt es zu klonen und verfälschte dadurch
  eine spätere, unabhängige Struktur-Prüfung der Sockel-Kartenzahl; (2)
  „Einziger Thron" fusioniert JEDEN weiteren Geist sofort in den Champion —
  ein Testaufbau, der einen zweiten, getrennt lebenden gewöhnlichen Geist
  erwartete, war dadurch unmöglich und musste über den echten
  `pushGhost()`-Nachfolgepfad statt eines rohen `createGhost()`-Aufrufs neu
  gebaut werden; (3) `ghost_071`s eigener Eskalationsbonus
  (`necroUniqueThronePerFusionPct`, +5 Prozentpunkte je vorheriger Fusion)
  wurde in der ersten Fassung des Linearitäts-Tests übersehen (33 statt der
  erwarteten 32) — der Test rechnet jetzt die pro-Fusion steigende Rate
  explizit mit.
- Kein `sw.js`-Bump durch reine Nachschliff-Logik nötig gewesen, aber **jetzt
  erforderlich**: zwei neue Dateien (`data/glossary.json`, `src/ui/glossary.js`)
  waren nicht in `ASSETS` eingetragen — beide ergänzt, `sw.js` auf `v117`
  gebumpt (+ `telemetry.js: GAME_VERSION` mitgezogen).

### Spinnenboss (Akt 3) — gemergt
Vollständiger Ersatz des `t_black`-Platzhalters (s. „Bosse (Platzhalter,
Nutzerentscheidung)" weiter oben) durch einen eigenständigen, datengetriebenen
Bosstyp `t_spider` mit acht einzeln zerstörbaren Beinen, drei Kampfphasen,
Spinnenminen und Spinnennetzen. Umgesetzt nach einer 31-Abschnitte-
Spezifikation samt drei Referenzbildern (Boss/Mine mit acht nummerierten
Beinen, Spinnennetz).

**Sprite-Ehrlichkeit (Abschnitt 3 der Vorgabe):** die drei gelieferten
Referenzbilder sind Schachbrett-Hintergrund-JPEGs mit eingebrannten Text-
Labels ("Bein 1" …) — Spezifikations-Mockups, keine freigestellten
Transparent-PNGs. Sie wurden bewusst NICHT als Spiel-Sprites importiert (das
hätte Schachbrettmuster + Beschriftung mit ins Spiel gebracht). Stattdessen
zeichnet `src/render/spiderrender.js` eine erkennbare **prozedurale**
Darstellung, die Form/Uhr-Zuordnung/Ausrichtung der Referenzbilder nachbildet
(acht Beine im Uhr-Schema aus Abschnitt 4, Gelenkpunkt zeigt zur Körpermitte,
Radialnetz-Optik fürs Spinnennetz). **Es liegen keine echten
`body_t_spider.png`/`turret_t_spider.png`/`spider_boss_leg_0N.png`/
`body_spider_mine.png`/`spider_mine_leg_0N.png`/`spider_web.png` in
`assets/sprites/` — falls echte Grafiken geliefert werden, ist
`sprites.js: TANK_TYPES` + ein neuer Boss-Sprite-Zweig in
`spiderrender.js` der Anschlusspunkt (Muster: Champion-Sprite-Nachtrag).**

- **Datenmodell** (`data/tanks.json: types.t_spider`, `player: false`,
  `spiderBoss: true`, `maxHp: 1800`, `damage`/`fireRate`/… werden pro Phase
  in `stepSpiderBoss()` überschrieben): neue Geschwindigkeitsstufe
  `"spider": 48` in der `speeds`-Tabelle. `data/difficulty.json:
  acts[2].boss` zeigt jetzt auf `"boss_spider"` statt `"boss_phalanx"` —
  Akt 1/2 (`boss_reactor`/`boss_mirror`, weiterhin `t_black`-Platzhalter)
  bleiben unangetastet. Neue feste Arena `data/arenas.json: boss_spider`
  (24×16, ein `E`-Marker → `arenaEnemySpawnCount()` truncated die
  Unterstützungs-Einkaufsliste automatisch auf 0, der Boss ist der einzige
  Gegner) mit einem Labyrinth aus vier symmetrischen Wandinseln,
  durchgehend ≥2 Kacheln breiten Korridoren, keiner Sackgasse — von
  `validateArenas()` beim Laden mitgeprüft.
- **`data/balance.json: boss.spider`** ist die zentrale, einzige
  Zahlenquelle (keine hartkodierten Werte verstreut): `legCount: 8`,
  `legHp: 150` (8×150=1200 + 1800 Körper = 3000 Gesamt-LP), `legStunS: 3.5`,
  `legHitRadiusPx: 15`, `legReachPx: 46`, `legJointPx: 15`,
  `baseSpeedPxS: 48`, `phase2AtHpPct: 0.5`, `phase3ProtectHpPct: 0.3`,
  `transitionS: 2`, `stationaryPos: {x:384,y:96}`, `pillars` (zwei Zellen,
  `col:8/row:9` und `col:15/row:9`), `pillarCycleS: 6`/`pillarUpS: 3.6`/
  `pillarWarnS: 0.45`/`pillarOffsetS: 3`, `phases["1"/"2"/"3"]` (siehe
  unten), `mine: {spawnS:1.5, spawnDamage:12, spawnRadiusPx:36,
  activeDamage:34, activeRadiusPx:48, chaseDurationS:12, repathS:0.25}`,
  `web: {maxHp:20, maxLifeS:10, decayPerS:2, hitRadiusPx:26}`,
  `bulletHellMaxActive: 48`. Das 50%/1,5s-Netz-Verlangsamungspaar liegt
  bewusst NICHT hier, sondern in `data/status.json: effects.web`
  (`speedMult:0.5`, `durationS:1.5`) — dieselbe Datei, die auch Feuer/Frost/
  Gift trägt, kein zweiter Ort für Statuseffekt-Zahlen.
- **Phase 1** (`bossDamage:26`, `fireRateS:1.6`, `bulletSpeedPxS:130`,
  `mineEveryS:9`/`mineCount:1`/`maxMines:2`/`mineChaseSpeedPxS:80`,
  `webEveryS:8`): Labyrinth, langsame direkte Verfolgung, einzelne klare
  Schüsse.
- **Phase 2** (ab 50 % Boss-LP, `bossDamage:30`, `fireRateS:1.1`,
  `bulletSpeedPxS:145`, `mineEveryS:6.5`/`mineCount:2`/`maxMines:4`/
  `mineChaseSpeedPxS:90`, `webEveryS:5`): gleiches Labyrinth, gleiches
  Beintempo, aber häufigere Angriffe — die Mehrschwierigkeit kommt bewusst
  NICHT aus mehr Bewegungstempo (Abschnitt 8: "Phase 2 erhöht das Tempo
  nicht künstlich").
- **Phase 3** (nach allen 8 Beinen, `mineEveryS:9`/`maxMines:3`/
  `mineChaseSpeedPxS:85`, `webEveryS:7`, `bulletHellDamage:14`,
  `bulletHellSpeedMinPxS:110`/`bulletHellSpeedMaxPxS:135`, `warnS:0.7`,
  `waveS:5`, `pauseS:3.5`): stationärer Boss, offener Innenraum, zwei
  Säulen, rotierender Fünf-Speichen-Geschossfächer im Wellenrhythmus
  Pause→Warnung→Welle→Pause (Zyklus ~9,2 s) — während der Pause ist der
  (dauerhaft verwundbare) Körper ein verlässliches, sicheres Schadensfenster.
- **Acht Beine** (`src/game/spider.js: initSpiderLegs`): Uhr-Zuordnung exakt
  nach Abschnitt 4 (`JOINT_DEG`/`FOOT_DEG`-Tabellen, 1=1-Uhr…8=11-Uhr,
  1–4 rechts/5–8 links), die vier oberen Beine (1/2/7/8) zeigen mit der
  Fußspitze zusätzlich nach außen+oben, 3–6 bleiben rein radial. Jedes Bein
  ist ein eigenes Objekt auf der Tank-Instanz (`tank.spiderLegs[]`, KEIN
  Eintrag in `state.tanks` — dieselbe Architekturentscheidung wie bei
  Geisterpanzern: eine eigene, kleine Trefferschleife
  (`updateSpiderLegHits`) statt Beine in die generische Panzer-Kollision zu
  pressen), mit eigener HP/maxHp und eigenem, immer sichtbarem Lebensbalken
  (`spiderrender.js`).
- **Gangzyklus** (Abschnitt 5, `updateLegGeometry`): zwei diagonale
  Gruppen (`GAIT_GROUP_A = {8,6,2,4}`, `GAIT_GROUP_B = {1,3,7,5}`, ~halbe
  Phasenverschiebung + winzige, deterministische Streuung je Bein aus der
  Beinnummer). Jedes Bein durchläuft Aufsetzen→Standphase (Fuß bleibt fix
  auf `groundX/Y`, kein sichtbares Rutschen)→Abheben→Schwung (mit leichter
  "Anheben"-Andeutung Richtung Körpermitte, top-down-tauglich ohne
  Z-Achse)→erneutes Aufsetzen. Schrittgeschwindigkeit ist an die
  TATSÄCHLICHE Bewegung gekoppelt (`Math.hypot(vx,vy)`, nicht an die
  Zeit), Stillstand/Betäubung/Phase 3 ohne Beine hält die Animation
  komplett an ("endet in einer natürlichen Ruheposition"). Da kein
  segmentiertes Sprite vorliegt, wird die Bewegung über den korrekten
  inneren Drehpunkt (Gelenk bleibt starr am Körper) + versetzte
  Schwungphasen + plausible Standpositionen dargestellt (Abschnitt 5,
  expliziter Fallback für genau diesen Fall). Spinnenminen teilen sich
  dieselbe Uhr-Tabelle (`spiderrender.js: drawSpiderMines`, eine leichte,
  deterministische "Wiggle"-Bewegung statt des vollen Gangzyklus — eine
  Mine ist klein genug, dass ein vereinfachter Gang optisch ausreicht).
- **Geschwindigkeitsformel** (Abschnitt 8, `applySpiderSpeed`): **exakt**
  `48 × verbleibendeBeine / 8`, jeden Tick neu gesetzt, ohne Übergangs-
  Tween — 48/42/36/30/24/18/12/6/0 für 8→0 Beine.
- **Beinschaden/-verlust** (Abschnitt 10, `damageLeg`): ein zerstörtes Bein
  verschwindet dauerhaft, `applySpiderSpeed()` greift sofort, ein neuer
  Beinverlust setzt (nicht addiert) das Betäubungsfenster auf volle
  `legStunS`. Während der Betäubung: keine Bewegung, kein normaler Schuss,
  keine neuen Minen/Netze (die Timer werden bewusst NICHT dekrementiert —
  "kein unfaires Aufstauen"), UND der Körper ist genau in diesem Fenster
  verwundbar. Nach Ablauf ist der Körper wieder geschützt, SOFERN noch
  mindestens ein Bein lebt.
- **Körperschutz + 30%-Bodenklammer** (`state.js: applyDamage()`, ein
  einziges Gatter deckt Kugel/Explosion/Statuseffekt-Tick gleichermaßen ab;
  `applySpiderFloor()`): der Körper ist geschützt, solange
  `spiderLegsAlive > 0 && !(spiderVulnerableTimer > 0)`. Eine explizite
  Ausnahme (`meta.code === 'spider_spawn_mine'`) lässt eine frische
  Spinnenmine trotzdem durch (Abschnitt 15). Solange noch ein Bein lebt,
  wird `hp` nach jedem Treffer auf mindestens `maxHp × 0.3` (540)
  angehoben — reine Phasen-Gating-Logik für GENAU diesen Bosstyp, klemmt
  nie ein Spieler-Upgrade und ist auf der Lebensleiste als Strich sichtbar
  (`spiderrender.js`). Phase 2 beginnt strikt bei ≤50 % Boss-LP.
- **Bewegung** (Abschnitt 9, `stepSpiderBoss`, Muster
  `stepMirrorBoss`/`stepPhalanxBoss`): verfolgt in Phase 1/2 geradlinig den
  Hauptpanzer, ignoriert dabei innere Wände komplett (harte Pixel-Klammer
  nur gegen die Außenwand statt `resolveCircleWalls`) — Spieler/Geister/
  Champion/Spinnenminen bleiben normal an die Wandkollision gebunden.
  Feuern läuft weiterhin über die normale `roleTurret()`+`fireBullet()`-
  Logik (Sichtlinie/Kegel/`accuracy` unverändert), nur Schaden/Feuerrate/
  Geschosstempo kommen aus dem Phasenprofil.
- **Phase-3-Übergang** (Abschnitt 21, `beginTransition`/`finishTransition`,
  ~2 s): alle inneren Wände fallen (`state.setWallSolid()`, neue generische
  Methode, Muster `tickMovingWalls()`), vorhandene Bossgeschosse/-minen/
  -netze werden kontrolliert geräumt (keine unvermeidbaren Treffer während
  des Umbaus), der Boss springt auf `stationaryPos` (384,96), Tempo 0,
  zwei Säulen werden initialisiert. HP/Kampffortschritt bleiben
  unangetastet.
- **Zwei Säulen** (Abschnitt 22, `initPillars`/`updatePillars`): eigene,
  zeitversetzte Timer (`pillarOffsetS: 3`) auf demselben
  `setWallSolid()`-Mechanismus wie der Wandabriss — Zyklus ~6 s (3,6 s
  fest/2,4 s offen), mit 0,45 s Vorwarnfenster (`p.warned`) vor jedem
  Wechsel. Durch die Staffelung ist praktisch immer mindestens eine offen.
- **Spinnenminen** (Abschnitt 14–17, NEUES Modul `src/game/spidermine.js`,
  bewusst KEIN zweites Explosionssystem — baut auf `mine.js: createMine()`/
  `explodeAt()` auf): zwei Phasen. **Spawnphase** (1,5 s): hängt sichtbar
  am Boss (`m.x=owner.x/m.y=owner.y` jeden Tick), ist ab Frame 1
  beschießbar (keine normale Zündverzögerung), kann bei Explosion trotz
  geschütztem Körper Schaden anrichten (schwacher `spawnDamage:12`,
  `spawnRadiusPx:36` — verhindert, dass mehrere gleichzeitige Spawnminen
  das Gleichgewicht kippen), löst NICHT durch reine Berührung des eigenen
  Besitzers (Boss) oder durch einen eigenen Bossschuss aus. **Aktive
  Phase**: löst sich vom Boss, verfolgt über ein **gemeinsames
  Distanzfeld** (s. u.) den Hauptpanzer, `activeDamage:34`/
  `activeRadiusPx:48`, läuft nach `chaseDurationS:12` automatisch ab (KEIN
  3-Sekunden-Standard-Minen-Fuse — eine Spinnenmine braucht die längere
  Zeit, um das Labyrinth wirklich zu durchqueren). Kontakt/Explosion
  wirken auf Hauptpanzer, Geister UND Champion (`state.
  damageGhostsInRadius()`, neue Methode, dieselbe Resistenz-/Schildpool-
  Kette wie die bestehende Geist-Kollisionsschleife) sowie — nur im
  Spawnphasen-Sonderfall — auf den Bosskörper selbst
  (`damageSpiderLegsInRadius()` trifft dabei zusätzlich mehrere Beine auf
  einmal, Abschnitt 26).
- **Wegfindung** (Abschnitt 17, `spidermine.js: rebuildFlowField`): EIN
  gemeinsames 4-direktionales BFS-Distanzfeld vom Spieler aus (`Int16Array`
  über alle 24×16 Zellen), das sich ALLE Spinnenminen gleichzeitig teilen
  — genau der im Auftrag vorgeschlagene Ansatz. Neu gebaut höchstens alle
  `repathS` (0,25 s) ODER sofort, wenn der Spieler die Rasterzelle
  gewechselt hat (`ensureFlowField`). Eine Mine folgt dem Nachbarn mit dem
  kleinsten Feldwert (Zielzelle = deren Mittelpunkt, keine harten
  Zellsprünge → sichtbar weiche, leicht diagonale Bewegung), schneidet
  dadurch nie eine diagonal gesperrte Ecke. Beim Wechsel Spawn→aktiv sucht
  `nearestFreeCell()` die nächste ERREICHBARE freie Zelle (BFS-Distanz
  ≥ 0), falls der Boss beim Auslösen zufällig über einer inneren Wand
  stand — verhindert eine unerreichbare/feststeckende Mine.
- **Spinnennetze** (Abschnitt 18/19, `spider.js: updateSpiderWebs`, direkt
  ein Array `state.spiderWebs`, kein neues Rendermodul-übergreifendes
  System): max. 20 HP, zerfallen mit 2 HP/s, maximale Lebensdauer 10 s.
  **HP-basierte Zerstörung** (nicht "ein beliebiger Treffer zerstört
  sofort" — echter Bug, s. u.): ein Treffer von Spieler/Geist/Champion
  zieht `b.damage` von `w.hp` ab, das Netz verschwindet erst bei `hp<=0`.
  Bei Berührung durch Hauptpanzer/Geist/Champion verschwindet es SOFORT
  und trägt den neuen `web`-Statuseffekt auf (50 % Tempo, 1,5 s,
  `data/status.json`) — nutzt bewusst das bestehende Statuseffekt-System
  (`state.applyStatus`) statt einer zweiten Verlangsamungs-Mechanik.
- **Gegner-Geschoss-Deckel + Bullet-Hell-Budget** (Abschnitt 24,
  `state.js`): das erhöhte Phase-3-Budget (`bulletHellMaxActive: 48`) gilt
  NUR während `spiderPhase === 3` und nimmt das GRÖSSERE der beiden Werte
  (normale Räume bleiben unverändert bei `enemyBullet.maxActive`).
- **Ghosts/Champion greifen bevorzugt Beine an** (Abschnitt 25,
  `spider.js: spiderAimPoint`, in `ghost.js: updateGhosts()` eingehängt):
  solange der Körper geschützt ist, zielt ein Untertan auf das nächste
  lebende Bein statt wirkungslos auf den Körper.

**Fünf echte Bugs gefunden und behoben** (nicht nur behauptet — jeder mit
bestandener Gegenprobe, s. u.):
1. **Bein-vs-Körper-Trefferordnung**: `updateSpiderLegHits()` lief
   ursprünglich NACH der großen, generischen Panzer-Trefferschleife — ein
   Schuss, der zugleich ein Bein UND den (kleinen) Körper-Kollisionskreis
   überlappte, wurde dort schon verbraucht (0 Schaden am geschützten
   Körper, Kugel tot), bevor die Bein-Prüfung ihn je sah. Fix: die
   Bein-Trefferprüfung läuft jetzt VOR der generischen Schleife
   (`state.js`).
2. **`updateBulletHell()` griff auf `state.data.balance.physics
   .bulletRadius` zu** (existiert nicht — `physics` liegt direkt auf
   `state.data`, nicht unter `balance`) — hätte das Spiel beim ERSTEN
   Bullet-Hell-Schuss in Phase 3 mit einer `TypeError` abstürzen lassen.
   Fix: `state.data.physics.bulletRadius`.
3. **Gegner-Geschoss-Deckel zählte Geister-/Champion-Geschosse
   fälschlich als "gegnerisch"** (`owner !== state.player` traf auch auf
   Geister zu) — Abschnitt 24 hatte das explizit als bekanntes Problem
   benannt; behoben über `!b.owner.isGhost`.
4. **Spinnennetze wurden von JEDEM Treffer sofort zerstört**, unabhängig
   vom Schaden — widersprach den vorgerechneten Beispielen aus Abschnitt
   18 (ein frisches Netz braucht exakt 2 Treffer à 10 Spielerschaden bzw.
   3 à 8 Nekromant-Schaden). Fix: `b.damage` wird jetzt von `w.hp`
   abgezogen, das Netz stirbt erst bei `hp<=0`.
5. **Geisterpanzer/Champion lasen `statusSpeedMult()` nie** — `tank.js:
   moveTank()` wendet Statuseffekt-Verlangsamung seit jeher auf echte
   Panzer an, `ghost.js: updateGhosts()` bewegte Untertanen aber komplett
   unabhängig davon. Der neue `web`-Status hätte sie dadurch nie
   tatsächlich verlangsamt, obwohl `updateStatus()` (Phase 5 dieses
   Auftrags s. o.) sie längst mitzählte. Fix: `updateGhosts()` multipliziert
   die Bewegung jetzt zusätzlich mit `statusSpeedMult(state, g)`.

**Boss-Erkennung/Sonderfälle**: `t_spider` trägt `cfg.spiderBoss` (neues
Feld in `resolveCfg()`s Boss-Whitelist), `isBossCfg()` (`cfg.js`) prüft es
zusätzlich zu `mirrorBoss`/`phalanx`/`bossInvincible` — dadurch greifen
ALLE bestehenden Boss-Mechanismen automatisch: keine Nekromant-
Wiederbelebung, keine Exekutionsschwelle/Flankenschaden (Grundsteinumbau
Phase 2), korrekte Boss-Belohnung (drei garantierte, unterschiedliche
Legendäre) am Ende von Akt 3. Zusätzlich gefunden und gefixt: **`respawnPlayer()`
hätte den Spinnenboss bei jedem Spielertod auf seinen ursprünglichen
Raum-Spawnpunkt zurückgesetzt** (derselbe Fund/Fix wie schon im Ist-Abgleich
zu Beginn dieser Sitzung dokumentiert) — ein `if (t.cfg.spiderBoss)
continue;` in der Reset-Schleife verhindert das.

**Tests**: neuer Abschnitt 66 in `tests/regression.mjs` (~18 Prüfblöcke,
kein Anspruch auf alle 59 einzeln benannten Auftrags-Testfälle, aber eine
repräsentative, sicherheitskritische Abdeckung): Struktur/Balance-Werte,
der Bein-vs-Körper-Ordnungsfehler selbst (mit einem bewusst auf 20 px
vergrößerten Testgeschoss — ein normaler Spielerschuss, 4 px, ist zu klein,
um das Überlapp-Fenster überhaupt zu erreichen, siehe Kommentar im Test),
die Geschwindigkeitstabelle 8→4 Beine, das Betäubungsfenster (Erneuern
statt Addieren), die 30%-Bodenklammer, die Phase-2-Schwelle (kein
Rückfall), der komplette Weg bis Phase 3 (Position, zwei Säulen,
Dauerverwundbarkeit, geräumte Minen/Netze), die Säulenstaffelung, der
Gegner-Geschoss-Deckel-Fix, das erhöhte Bullet-Hell-Budget, Spinnenminen
(Spawnphase beschießbar/kein Selbstbeschuss/kein Bossschuss-Trigger,
aktive Phase trifft Spieler+Geist, kein 3s-Fuse — isoliert vom echten
Kontaktverhalten über ein kurzzeitig als "tot" markiertes `player.alive`),
Spinnennetze (HP-basierte Zerstörung mit den exakten Beispielrechnungen
aus Abschnitt 18, Zerfall, maximale Lebensdauer), die 50%/1,5s-
Verlangsamung für Spieler UND Geist (echte Bewegungsmessung, nicht nur der
Statuswert), `isBossCfg`, der Respawn-Fix. **Jeder der fünf echten Bugs
oben wurde per Gegenprobe am Quellcode bestätigt** (Fix temporär
zurückgenommen, genau der erwartete Check wurde rot, danach wieder
hergestellt) — inklusive zweier eigener Testfallen dabei gefunden: ein
erster Testentwurf für den Ordnungsfehler nutzte ein 50-px-Testgeschoss
(reines Testartefakt, hätte selbst mit intaktem Fix nichts geprüft) und
wurde auf 20 px korrigiert; ein Bewegungsvergleichstest für die Geist-
Verlangsamung nutzte anfangs `t_brown` (Rolle `guardian`, bewegt sich als
geerbter Untertanen-Typ grundsätzlich nie) und wurde auf `t_pink` (Rolle
`hunter`) korrigiert. Zusätzlich ein eigenständiger Playwright-Smoke im
ECHTEN Browser (nicht nur Node-Import): baut über die echten, per
`fetch()` geladenen `data/*.json` einen `boss_spider`-Raum, zerstört ein
Bein, fügt eine Spinnenmine + ein Spinnennetz hinzu und zeichnet über die
echten `spiderrender.js`-Funktionen auf einen echten Canvas — keine
Konsolenfehler, Screenshot bestätigt eine erkennbare Spinnensilhouette
(Körper + acht Beinstriche) und das Radialnetz-Icon.
`sw.js` auf `v118` gebumpt (drei neue Dateien `src/game/spider.js`/
`src/game/spidermine.js`/`src/render/spiderrender.js` in `ASSETS`, +
`telemetry.js: GAME_VERSION` mitgezogen) — keine neuen Bild-/Audio-Assets
(reine Prozedural-Darstellung).
**Nicht empirisch geprüft** (Abschnitt 27 der Vorgabe nennt Zielwerte,
keine harten Anforderungen): die vorgeschlagene Gesamt-Kampfdauer
(~3,5–4,5 Minuten für einen durchschnittlichen Build) wurde NICHT über
einen echten Spieldurchlauf/Bot vermessen — dafür fehlte in dieser Sitzung
die Zeit. Balance-Werte sind alle zentral in `data/balance.json`, eine
spätere Justierung braucht keine Code-Änderung.

### Kinderzimmer-Reskin (Nutzergrafik, rein optisch) — gemergt
Vier gelieferte Referenzbilder ersetzen die Arena-Optik: ein ganzflächiger
Kinderzimmer-Hintergrund statt der gekachelten Bodentextur, 20 Bauklotz-
Varianten für normale Wände, 7 angerissene Bauklotz-Varianten für
`breakable`/`destructible`-Wände, ein Spielzeughaufen statt des alten
Loch-Icons. **Reine Optik** — keine Kollisions-, Balance- oder
Gameplay-Änderung.
- **Ist-Abgleich der gelieferten Dateien (wichtig, weicht vom Auftragstext
  ab):** die vier beigefügten Bilder waren KEINE fertigen Sprite-Dateien in
  den geforderten Exakt-Maßen (768×512 / 1280×64 / 448×64 / 64×64), sondern
  Referenzfotos/-collagen in Rohauflösung: ein 1536×1024-Kinderzimmerfoto,
  ein 1237×1272-Rastergrid mit 20 Bauklötzen (5×4, schwarzer Hintergrund),
  ein 1448×1086-Rastergrid mit 7 angerissenen Blöcken (Schachbrett-
  "Transparenz", tatsächlich ein flaches JPEG ohne echten Alphakanal — die
  altbekannte Falle aus der Spinnenboss-Sitzung) und eine 1254×1254-
  Moodboard-Collage (Spielzeughaufen) als einzig plausible Quelle für das
  Loch-Icon. **Alle vier mussten deshalb erst per PIL/scipy zu den vier
  Zieldateien verarbeitet werden** (Grid-Zuschnitt, randverbundene Flood-
  Fill-Freistellung, Verwerfen kleiner Bleed-Reste aus Nachbarzellen über
  die größte zusammenhängende Vordergrundfläche, Zuschnitt auf die
  Inhalts-Bounding-Box, Skalierung in ein 64×64-Feld) — dasselbe Verfahren,
  das schon für die Klassen-/Champion-Sprites in früheren Sitzungen
  etabliert wurde. Glücklicher Zufallsfund: die Reihenfolge der Zellen in
  BEIDEN Rastergrids entspricht bereits exakt der im Auftrag verlangten
  Varianten-Reihenfolge (0=Rot, 1=Blau, … 19=Dreieck bzw. 0=Rot…6=Stern) —
  keine Umsortierung nötig.
- **`assets/sprites/arena_kinderzimmer_768x512.png`**: reiner Resize
  1536×1024 → 768×512 (exaktes 3:2-Seitenverhältnis, keine Verzerrung).
- **`assets/sprites/tile_wall_sheet_20x64.png`** (1280×64) /
  **`tile_breakable_sheet_7x64.png`** (448×64): je Zelle isoliert, größte
  zusammenhängende Fläche behalten (verwirft Bleed-Reste, die beim groben
  Rasterzuschnitt aus Nachbarzellen mit hineingerutscht waren — ein echter,
  beim Bauen gefundener und behobener Fehler, s. u.), auf 94 % der 64-px-
  Zielgröße skaliert und zentriert, transparenter Rand (absichtlich, s. u.).
- **`assets/sprites/tile_hole.png`** (64×64): aus der Moodboard-Collage
  abgeleitet (Rotes LEGO + Gummiente dominieren nach dem Downscale sichtbar,
  der Rest der Collage geht bei diesem Verkleinerungsfaktor unter — ehrlich
  benannter Kompromiss, kein eigens gebautes Icon).
- **Ein echter Bugfund beim Bauen**: die erste Fassung der Grid-Isolierung
  entfernte nur den (randverbundenen) Hintergrund je Zelle, ohne danach
  zusätzlich die größte zusammenhängende Vordergrundfläche zu isolieren —
  bei einem groben, nur proportional berechneten Rasterzuschnitt reichte
  ein Pixel Nachbarzellen-Bleed über die Zellgrenze, um als isolierte,
  NICHT randverbundene "Insel" fälschlich mit ins fertige Sprite zu
  rutschen (sichtbar an Kachel 9 „Holzklotz mit Stern" und 10 „5-Würfel":
  je ein Farbfleck der jeweils benachbarten Zelle hing am Rand). Fix: nach
  dem Freistellen zusätzlich `scipy.ndimage.label()` auf die verbleibende
  Vordergrundfläche anwenden und nur die GRÖSSTE Komponente behalten, alles
  andere verwerfen — per Vorher/Nachher-Kontaktabzug am eigenen
  Zwischenergebnis verifiziert, nicht nur behauptet.
- **`src/render/sprites.js`**: zwei neue Kategorien `SPRITES.arena`
  (ganzflächiges Hintergrundbild, keine Kachel) und `SPRITES.tileSheet`
  (die beiden Wand-Variantensheets) neben den unveränderten `body`/
  `turret`/`bullet`/`tile`-Kategorien. `tile.hole`/`tile.wall`/
  `tile.breakable`/`tile.floor` bleiben unverändert bestehen — sie sind
  jetzt der explizite Fallback, falls eines der neuen Sheets (noch) nicht
  geladen ist.
- **`src/render/renderer.js`**:
  - **Hintergrund**: `bakeFloorSprite()` bekommt statt eines einzelnen
    `floorBaked`-Booleans ein `floorBakedKind` (`null|'tile'|'arena'`) —
    prüft bei JEDEM Aufruf zuerst, ob `sprite('arena','kinderzimmer')`
    inzwischen verfügbar ist, und backt dann NEU (ersetzt eine zuvor mit
    der alten Bodenkachel gebackene Übergangslösung), statt für immer beim
    ersten Bake stehen zu bleiben. Das Bild wird GENAU EINMAL in voller
    Arenagröße (0,0,WIDTH,HEIGHT) in den bestehenden `floorCanvas`
    gezeichnet (kein Kacheln), danach wie gehabt frame-kostenlos nur noch
    geblittet — misst weiterhin komfortabel im Fogperf-Frame-Budget
    (2,2–2,9 ms Median, Budget 6 ms, unverändert zum Stand vor dieser
    Änderung).
  - **Wandvarianten**: neue `wallVariantHash(col,row,count)` (reiner
    Bit-Mix-Hash aus der Rasterposition, **kein** `Math.random()`, **kein**
    Verbrauch des Gameplay-RNG) + `drawWallVariant(sheet,index,x,y)`
    (schneidet ein 64×64-Sprite aus dem Sheet und zeichnet es auf die
    unveränderte Zellgröße `CELL`=32). Greift für `wall.type === 'wall'`
    (20 Varianten) und `'breakable'` (7 Varianten) VOR der bisherigen
    Einzelbild-Logik — ist das jeweilige Sheet nicht geladen, fällt der
    Code unverändert auf `sprite('tile', key)` bzw. die alte prozedurale
    Form zurück (keine Verhaltensänderung ohne die neuen Dateien).
    `wall.type === 'destructible'` bekam denselben Umbau (nutzt jetzt das
    `breakable`-Sheet statt `tile.wall` als Basis) — das bestehende orange
    Riss-Overlay (steigt mit `dmg`) bleibt UNVERÄNDERT obendrauf bestehen,
    real am Bildschirm mit einer künstlich beschädigten Wand gegengeprüft.
    `wall.type === 'hole'` bleibt bewusst außen vor (kein Sheet, nur ein
    einzelnes Ersatzbild) und läuft weiter über den alten Einzelbild-Pfad.
  - **Determinismus bewusst OHNE Seed-Parameter gelöst**: die Wandvariante
    ist eine reine Funktion von `(col,row)`, kein Raum-/Run-Seed wird durch
    die Render-Aufrufkette gereicht. Das reicht aus, weil das Raumlayout
    selbst (welche Zelle überhaupt eine Wand ist) bereits seed-gesteuert
    ist — dieselbe Zelle bekommt dadurch automatisch immer dieselbe
    Variante, ohne Frame-zu-Frame-Flackern, ohne eine der zahlreichen
    Aufrufstellen von `drawWalls()`/`createRenderer()` anzufassen. Zwei
    verschiedene Räume können sich zufällig dieselbe Variante an derselben
    relativen Position teilen — rein kosmetisch, keine Determinismus-
    Verletzung.
  - **Transparenz ist Absicht, kein Rest-Bug**: die isolierten Bauklötze
    füllen (bewusst wie im Referenzmaterial) nicht randlos die volle
    64×64-Fläche, sondern behalten ihre gerundeten Ecken mit kleinem
    transparentem Rand — angrenzende Wandzellen zeigen dadurch schmale
    Boden-Lücken zwischen den Blöcken (passend zum "Klötzchen"-Look der
    Referenzbilder, kein nahtloses Backstein-Muster).
- **Tests**: kein neuer Abschnitt in `tests/regression.mjs` (rein optische
  Änderung ohne neue Spiellogik, per Ist-Abgleich bewusst keine Fehlerklasse
  gefunden, die eine Logikprüfung bräuchte) — die volle Suite bleibt
  unverändert grün, inkl. aller 5 Seeds bis zum Sieg. Zusätzlich ein
  eigenständiger Playwright-Smoke im echten Browser: baut einen echten
  generierten Kampfraum (nicht nur eine feste Arena), rendert ihn über die
  echten `createRenderer()`/`createTracks()`-Funktionen, prüft **Determinismus**
  (zwei identisch aufgebaute Räume ergeben exakt dasselbe Wandmuster nach
  Typ UND Position) und liefert Screenshots — visuell bestätigt: der
  Hintergrund erscheint als ein einziges, nicht gekacheltes Bild, die 20
  Wandvarianten zeigen sichtbare Vielfalt ohne erkennbares Wiederholungs-
  muster, eine beschädigte `breakable`-Wand ist klar von unbeschädigten
  Nachbarzellen unterscheidbar, eine `destructible`-Wand zeigt das orange
  Riss-Overlay korrekt über der neuen Bauklotz-Basis, das Loch-Icon
  erscheint erkennbar als bunter Spielzeughaufen. `sw.js` auf `v119`
  gebumpt (drei neue Dateien in `ASSETS`, `tile_hole.png` bleibt unter
  gleichem Dateinamen, kein Listeneintrag nötig), `telemetry.js:
  GAME_VERSION` mitgezogen.

### Hintergrund ausgetauscht (Nutzergrafik, rein optisch) — gemergt
Der Nutzer hat ein neues Hintergrundbild geliefert (Holzboden mit rundem
blauem Teppich + gelbem Stern in der Mitte, bereits exakt 768×512 px) und
per `assets/sprites/arena_kinderzimmer_768x512.png` **dieselbe Datei**
ausgetauscht, die seit dem Kinderzimmer-Reskin geladen wird — kein Code
musste angefasst werden (`sprites.js: SPRITES.arena`, `renderer.js:
bakeFloorSprite()`, `sw.js: ASSETS` referenzieren weiterhin denselben
Dateinamen). Wände/Loch-Sprites sind unverändert. `sw.js` auf `v120`
gebumpt (Asset-Änderung, gleicher Dateiname wird sonst offline nicht neu
geladen), `telemetry.js: GAME_VERSION` mitgezogen. Playwright-Smoke
bestätigt: der neue Hintergrund rendert ganzflächig im Spielfeld, keine
Konsolenfehler.
### Amboss (Akt 2) — gemergt
Ersetzt den `t_black`-Platzhalter aus „Bosse (Platzhalter, Nutzerentscheidung)"
für **Akt 2** durch einen vollstaendigen, eigenstaendigen Bosstyp `t_anvil`
(„Der Amboss"): ein schwer gepanzerter Rammboss, dessen Aggressivitaet an
einem **Zorn**-Wert haengt, den nur echte Spielerangriffe erhoehen und den
nur ein Rammstoss gegen die Aussenwand senkt. Akt 1 (`boss_reactor`) und
Akt 3 (`boss_spider`) bleiben unangetastet — nur `diffData.acts[1].boss`
zeigt jetzt auf `"boss_anvil"` statt `"boss_mirror"`; die alte Spiegel-
Mechanik (`t_mirror`, `bossai.js: stepMirrorBoss`, `boss_mirror`-Arena)
bleibt vollstaendig im Code stehen, nur nicht mehr erreicht (Muster wie bei
Reaktor/Phalanx zuvor).
- **`data/tanks.json: t_anvil`**: `anvilBoss:true`, `flankable:true`,
  `radius:18`, `maxHp:1050`, `damage:34`, `armor:{arc:140,reflects:true}`,
  `weapon:"bullet"` (rein strukturelle Kompatibilitaet fuer `resolveCfg()` —
  der Amboss feuert **nie**, `roleTurret()`/`fireBullet()` werden in seinem
  gesamten Zustandsautomaten kein einziges Mal aufgerufen).
- **Boss-Erkennung ohne Sonderfall**: `cfg.js: isBossCfg()` erkennt
  `cfg.anvilBoss` als vierte Boss-Flagge (neben `mirrorBoss`/`phalanx`/
  `spiderBoss`). Dadurch greifen automatisch, OHNE eigenen Code: **kein
  HP-Doppelscaling** (`applyHpScaling()`s `hpScaling.skipBosses`-Zweig laesst
  die 1050 aus `tanks.json` unangetastet, auch in Akt 2 mit seinem eigenen
  `bossHpMult`), **keine Exekutionsschwelle** (Grundsteinumbau Phase 2s
  `!isBossCfg(t.cfg)`-Ausschluss), **keine Nekromant-Wiederbelebung**
  (Elite-/Boss-Ausnahme, Nekromant-V2 Phase 3), **korrekte Boss-Belohnung**
  (drei garantierte Legendaries am Akt-2-Ende). Per Gegenprobe verifiziert:
  ohne `anvilBoss` in `isBossCfg()`s Bedingung landet der Akt-2-Amboss bei
  2646 statt 1050 LP (Akt-1,55×-Raumskalierung UND `bossHpMult` greifen
  dann zusaetzlich) — genau der Fehler, den Abschnitt 5 des Auftrags
  ausdruecklich verhindern wollte.
- **`t.radius`-Override neu in `resolveCfg()`**: `radius: t.radius ??
  data.physics.tankRadius` (vorher fest `data.physics.tankRadius`) — noetig,
  weil der Amboss mit 18 px einen eigenen, vom globalen Standardradius
  abweichenden Wert braucht. Wirkt sich auf keinen anderen Typ aus (kein
  Bestandstyp setzt `radius` bisher).
- **Flanken-/Heckschaden gezielt wieder aktiviert**: `flankable:true`
  durchbricht die sonst geltende Bossausnahme (`!isBossCfg(t.cfg) ||
  t.cfg.flankable`, state.js-Trefferschleife) — Seiten-/Hecktreffer nehmen
  den normalen `balance.flank`-Multiplikator (×1,5/×2,5), waehrend die
  140-Grad-Frontpanzerung weiterhin reflektiert. Kein zweites
  Flankensystem, dieselbe `flankZone()`/`armorBlocks()`-Logik wie bei jedem
  normalen Gegner.
- **Zorn als Angriffspaket** (`state.js: registerAnvilRage(kind, eventId)`,
  eine neue state-Methode statt eines Moduls — vermeidet einen
  Zirkelimport, da `mine.js`/`tank.js`/`ghost.js` sie einfach ueber das
  ohnehin vorhandene `state`-Argument aufrufen): dedupliziert ueber
  `boss.processedRageEvents` (Set aus `"kind:eventId"`), liest die
  Zornbetraege ausschliesslich aus `data/balance.json: boss.anvil`
  (`directRage:7`/`explosionRage:11`/`ghostVolleyRage:2`). **Direkter
  Treffer** (+7): jeder Abzug (auch Doppelrohr/Streuschuss) traegt eine
  gemeinsame `b.rageEventId` (`state.nextRageEventId`, ein reiner Zaehler
  auf `state` — **kein** Verbrauch des Gameplay-RNG), erzeugt in
  `tank.js: fireBullet()` einmal pro Abzug und an alle Kugeln derselben
  Salve vergeben; `ghost.js`s Untertanen-/Champion-Schuss (inkl. der
  „Erbgeschuetz"-Zusatzkugel) teilt sich ebenso eine id pro Feuerstoss.
  Ein Fronttreffer registriert **vor** der Panzerungspruefung — auch ein
  komplett reflektierter Schuss heizt den Amboss auf. **Explosion** (+11,
  nicht +7 obendrauf): die Haupttrefferschleife registriert bei
  `b.explosive` bewusst **nichts** (`!b.explosive`-Bedingung), die
  Detonation im spaeteren Sprengschuss-Block registriert stattdessen
  `'explosion'` unter derselben `'shot:'+rageEventId` — eine explosive
  Kugel und ihre Explosion sind dadurch strukturell EIN Paket. **Mine**
  (+11): `mine.js: explode()` nutzt die ohnehin stabile Minen-`id`
  (`'mine:'+mine.id`) — Kettenreaktionen/Streuminen-Splitter sind automatisch
  eigene Ereignisse (andere Mine, andere id). **Geistersalve** (+2, mit
  Buendelung): `ghostBatchS` (0,25 s) fasst mehrere GETRENNTE Salven-ids
  innerhalb des Fensters zu einem Zornbetrag zusammen (die zweite Salve
  dedupt zwar ihre eigene id, traegt aber 0 zusaetzlichen Zorn bei) — die
  Karenz des passiven Abbaus (`lastRageEventAt`) wird trotzdem bei JEDEM
  angenommenen Ereignis neu gestartet, auch einem gebuendelten. **Kein
  Zorn** durch Statuseffekt-Ticks, Blitzketten, Kamikaze, Sabotage-Explosion
  oder Gegnertode — diese Quellen rufen `registerAnvilRage()` schlicht nie
  auf, kein Ausschlusscode noetig. `boss.rageLocked` (Raserei+Zusammenbruch)
  ist ein frueher Return in `registerAnvilRage()` selbst — Zornaufbau ist in
  dieser Zeit strukturell unmoeglich.
- **Zornabbau** (`data/balance.json: boss.anvil.coolingDelayS:2.0`/
  `coolingPerS:5.0`): passiv erst 2 s NACH dem letzten Ereignis, dann 5/s
  (`anvil.js: handleRageTicking()`, laeuft jeden Tick unabhaengig vom
  Modus, ausser waehrend der Raserei-Familie). Aktiv: ein
  **Aussenwand**-Aufprall zieht `outerImpactRageLoss` (15) ab, ein
  **Innenwand**(Block)-Aufprall **nichts** — dieselbe Substep-Bewegung
  (`moveChargeSubsteps()`, 4-px-Schritte gegen `state.walls` via
  `circleOverlapsAABB`) erkennt ueber `wall.col===0||row===0||col===COLS-1
  ||row===ROWS-1`, welche Wand getroffen wurde. Unter 25 % Boss-LP
  (`lowHpThresholdPct:0.25`) klemmt `lowHpMinRage` (60) sowohl den passiven
  als auch den aktiven Abbau — der Amboss wird gegen Ende des Kampfes nicht
  mehr ganz ruhig.
- **Zustandsautomat** (`src/game/anvil.js`, NEUES Modul — `bossai.js`
  exportiert `stepAnvilBoss`/`showAnvilHint` nur noch per Re-Export daraus,
  Muster wie `mine.js`/`mortar.js`/`spider.js`, haelt `bossai.js` unter der
  ~300-Zeilen-Konvention): 15 Zustaende
  (`between_attacks`/`charge_windup`/`charge`/`outer_crash`/`inner_crash`/
  `slam_windup`/`slam`/`trail_windup`/`trail`/`frenzy_warning`/`frenzy_aim`/
  `frenzy_charge`/`frenzy_turnaround`/`overheated`/`restart`). Deterministische
  Angriffsauswahl **ohne RNG**: `PATTERNS = [['ram'],['ram','hammer'],
  ['ram','trail','ram','hammer']]` nach Zornband (<40/<70/sonst), der
  Musterindex laeuft weiter, ein Bandwechsel setzt ihn auf 0 zurueck (nur
  beim naechsten Angriffswahl-Zeitpunkt geprueft, ein laufender Angriff wird
  nie mittendrin unterbrochen). Boss zielt strukturell IMMER auf
  `state.player` — kein Aufruf von `resolveTarget()`/der normalen
  Boss-Fixierung, damit er nie mitten in einer Rammbahn das Ziel wechselt.
- **Rammstoss**: Windup friert die Richtung auf die AKTUELLE Spielerposition
  ein (kein Nachdrehen), Telegraphzeit interpoliert 1,15→0,55 s nach
  Zornstufe. Fahrt ueber `moveChargeSubsteps()` (dieselbe Funktion wie beim
  Zornabbau-Wandkontakt), Tempo 175→280 px/s, Schaden 34→48, je linear nach
  `rage/rageMax`. Kontakt (`ramHitCheck()`): Spieler UND Geister/Champion
  koennen je Rammlauf **hoechstens einmal** getroffen werden
  (`tank.chargeHitTargets`-Set), 0,9 s Schutzfenster danach, seitlicher
  Rueckstoss ueber ein Kreuzprodukt (welche Seite) mit drei Ausweichkandidaten
  (Primaerseite → Gegenseite → geradewegs zurueck, jeder ueber
  `resolveCircleWalls()` aufgeloest — garantiert nie eine Position innerhalb
  einer Wand) + kleinem Vorwaertsschub. Der Sprint laeuft nach einem
  erfolgreichen Treffer normal weiter (kein Anhalten). Aussenwand-Aufprall:
  1,65 s Schadensfenster (`outerCrashS`), Zornverlust, Panzerung bleibt
  aktiv, kein eigener Schaden; Innenwand(block)-Aufprall: nur 0,45 s Stolper-
  Pause (`innerCrashS`), kein Zornverlust.
- **Hammerschlag** (ab Zorn 40): Boss friert Position UND Blickrichtung ein,
  0,7 s Windup, dann drei zeitversetzte Schockwellen (`shockwaveDelayS:0,55`,
  `state.anvilShockwaves[]`, eigenes von `state.mines` getrenntes Array).
  Jede Welle waechst mit `shockwaveSpeedPx` (170), Breite 12 px, maximal
  420 px Radius, 14 Schaden + 0,25 s Betaeubung bei Treffer, hoechstens EIN
  Treffer je Ziel je Welle (`wave.hitTargets`-Set). Drei sichere Luecken
  (80° breit) um `wave.heading + Math.PI + offset` (0°/±32°) — direkt hinter
  dem eingefrorenen Boss plus zwei seitlich versetzte. Innere solide Bloecke
  blocken einzelne Wellensegmente ueber einen manuellen Raymarch
  (`state.isSolid()`, dasselbe Muster wie die bestehende Sichtlinien-
  Vorhersage in `effects.js`). Ghosts/Champion werden ueber die vorhandene
  `state.damageGhostsInRadius()` getroffen — keine Duplikation der Resistenz-/
  Schildpool-/Todeslogik. Schockwellen ueberdauern das Angriffsende bewusst
  (`updateAnvilShockwaves()` laeuft JEDEN Tick, unabhaengig vom aktuellen
  Modus) — der Boss zieht schon weiter, die Ringe laufen unabhaengig aus.
- **Schleifspur** (ab Zorn 70): 0,7 s Warnung, 5,2 s Fahrt mit 45 px/s,
  Wendegeschwindigkeit auf 1,35 rad/s gedeckelt (kein sofortiges Einrasten
  auf die Spielerrichtung), normale `resolveCircleWalls()`-Kollision gegen
  innere Bloecke. Alle ~18 px ein neues Segment (`state.anvilTrails[]`,
  eigenes Array, Deckel 24 Segmente per FIFO), Radius 13 px, 6 Schaden mit
  0,5 s Kadenz je Ziel (`seg.hitAt`-Map, kein Dauerschaden), **keine
  Betaeubung**. Nach Angriffsende bekommen ALLE noch lebenden Segmente
  GEMEINSAM hoechstens 0,8 s Restzeit (`endTrailAttack()` setzt eine geteilte
  `expireAt`-Deadline statt individueller Segment-Alter) — sichtbar
  verblassend statt abrupt zu verschwinden. Wie bei den Schockwellen laeuft
  `updateAnvilTrails()` jeden Tick unabhaengig vom Modus.
- **Raserei bei 100 Zorn**: `handleRageTicking()` erkennt `rage>=rageMax`
  ausserhalb der Rasereifamilie, bricht den laufenden Angriff SOFORT ab
  (leert `anvilShockwaves`/`anvilTrails`, resettet `chargeHitTargets`),
  startet `frenzy_warning` (0,65 s, weisses Aufblitzen + Dampf, wiederver-
  wendeter `'wave'`-Ton statt eines neuen Audio-Assets) und sperrt
  `rageLocked`. Danach **exakt 5 s** (`frenzyDurationS`) mit wiederholten
  Rammsequenzen: je 0,45 s Zielaufnahme (`frenzy_aim`, neu ausgerichtet auf
  die aktuelle Spielerposition), Volltempo/Vollschaden-Sprint
  (`frenzy_charge`, dieselbe `moveChargeSubsteps()`), ein Wandkontakt fuehrt
  NUR zu 0,18 s Drehpause (`frenzy_turnaround`) — **kein** outer_crash/
  inner_crash-Unterschied, **kein** Zornverlust (per Gegenprobe verifiziert:
  ein kuenstlich wieder eingebauter Zornabzug bei Wandkontakt waehrend der
  Raserei faellt sofort auf, weil der Test genau das erwartet). Jede
  Sequenz kann jedes Ziel wieder nur einmal treffen (frisches
  `chargeHitTargets`-Set pro Sequenz), das 0,9-s-Schutzfenster gilt weiter.
- **Zusammenbruch** (`overheated`, `beginOverheated()`): sofort nach Ablauf
  der 5 s — `tank.armorDisabled=true` (ein neuer, generischer Schalter, den
  `armor.js: armorBlocks()` als ALLERERSTE Zeile prueft, `if
  (tank.armorDisabled) return false;` — automatisch normaler ×1-Schaden auf
  Fronttreffer, ohne die Renderer-Panzerungsanzeige selbst anzufassen), Boss
  bewegt/dreht sich nicht, macht keinen Kontaktschaden, exakt 3,5 s
  (`overheatedS`), Zorn ist waehrend der ganzen Zeit gesperrt (weder Aufbau
  noch Abbau — `boss.rageLocked` bleibt `true`). Danach: Panzerung reaktiviert,
  Zorn auf `rageAfterOverheat` (30) — oder `lowHpMinRage` (60), falls die
  Boss-LP weiterhin unter 25 % liegen —, 0,6 s sichtbarer Neustart
  (`restart`), dann normale Angriffsauswahl.
- **Externe Kontrolleffekte** (`anvil.js: externalControl()`): ausserhalb
  von Raserei/Zusammenbruch werden Betaeubung (Dauer ×
  `externalControlDurationMult:0.4`) und Verlangsamung (Staerke ×
  `slowEffectMult:0.5`, ueber `statusSpeedMult()` aus `status.js` gelesen)
  gedaempft, aber NICHT ignoriert — eine eigene, vom generischen `stunTimer`
  UNABHAENGIGE Buchfuehrung (`tank.extStunUntil`), damit ein EMP/eine
  Krallenfalle den Boss nicht komplett lahmlegt, ohne den `stunTimer` selbst
  fuer andere Systeme (Renderer-Anzeige) zu verfaelschen. Waehrend
  Raserei/Zusammenbruch ist die Funktion ein reiner No-op (`{stunned:false,
  slowMult:1}`) — die eigenen Modus-Timer treiben diese Zustaende, nie der
  allgemeine `stunTimer`.
- **Neue Arena `boss_anvil`** (`data/arenas.json`): 24×16, ein Gegner-Spawn,
  ein Spieler-Spawn, drei asymmetrisch platzierte 2×2-Wandbloecke, keine
  zerstoerbaren Waende/Loecher/Generatoren, geschlossener Aussenrahmen — nur
  der zaehlt als „kuehlende" Wand (`isOuterWall()`). `supportBudget` bleibt
  global konfiguriert, spawnt aber wegen des einzigen `E`-Markers
  strukturell keine Unterstuetzung (`arenaEnemySpawnCount()`, unveraendert
  seit Phase 14).
- **Darstellung** (kein eigenes Sprite — `t_anvil` aliast auf `t_black` in
  `sprites.js: SPRITE_ALIAS`, Anschlusspunkt fuer eine spaetere echte
  `body_t_anvil.png`/`turret_t_anvil.png` bleibt offen): Zornband-Farb-
  Overlay direkt in `renderer.js: drawTank()` (kalt/dunkel unter 40, orange
  Naehte/Puls 40–69, rot pulsierend 70–99, weissgluehend + blinkend ab 100
  bzw. waehrend der Raserei, dunkle aufgebrochene Panzerung + blauer
  Kuehldampf waehrend des Zusammenbruchs — bewusst NIE nur Farbe allein,
  jede Stufe hat ihr eigenes Puls-/Partikelmuster), ein pulsierender
  „Schaufel"-Streifen ueber der Frontpanzerung waehrend `charge_windup`.
  Neues `src/render/effects.js: drawAnvilHazards()` (Muster `drawMortars`):
  Rammwarnkorridor (Breite = Amboss- + Spielerradius, Laenge bis zur ersten
  Wand per Ray-March, verschwindet GENAU beim Sprintstart), Schockwellen-
  Ringe mit farblich klar abgesetzten sicheren Luecken, verblassende
  Schleifspur-Segmente. HUD (`hud.js: drawAnvilBoss()`, neu, im
  Kopfzeilenbereich unter der normalen Leiste, NIE ueber den Touch-
  Bedienelementen an den Bildschirmraendern): Boss-Lebensleiste + eine
  Zehner-Zornleiste „ZORN" (Segmentfarbe folgt demselben Zornband wie das
  Koerper-Overlay), Textzeile „PANZERUNG OFFEN" waehrend des Zusammenbruchs.
  Trefferindikatoren („+7/+11/+2 Zorn", „−15 Zorn") laufen ueber das
  bestehende `state.texts`-System — hoechstens einer je Angriffspaket, weil
  `registerAnvilRage()` den Text nur bei `applied>0` schreibt (Dedupe/
  Buendelung sorgen automatisch fuer „nie mehr als einer je Paket").
- **Einmalige Lernhinweise** (`anvil.js: showAnvilHint()`, ueber
  `storage.js: getFlag()`/`setFlag()` — dasselbe localStorage-Flag-System
  wie „Tutorial gesehen", ueberlebt Tod/Raumneustart/neue Runs): „Fronttreffer
  heizen den Amboss auf." (erster geblockter Fronttreffer, `state.js`s
  Panzerungs-Zweig), „Außenwände kühlen ihn ab." (erster Aussenwand-Aufprall,
  `finishCharge()`), „Überlebe die Raserei – danach bricht seine
  Panzerung." (erstes Erreichen von 100 Zorn, `handleRageTicking()`).
  `effects.js: drawTexts()` bekommt dafuer einen `tx.hint`-Sonderfall:
  deutlich groesserer Text, FEST ueber der Arena (keine Aufwaertsdrift wie
  ein normaler Schwebetext) + dunkler Kontrasthintergrund fuer Handydisplays.
- **Boss-Tod**: `killTank()`s bestehender `anvilBoss`-Zweig leert
  `state.anvilShockwaves`/`state.anvilTrails` sofort (kein weiterer
  `stepAnvilBoss()`-Tick raeumt sie sonst auf) und schreibt die Kampfdauer-/
  Durchschnittszorn-Telemetrie fest — der normale Boss-Belohnungsablauf
  (drei garantierte Legendaries) laeuft unveraendert, keine neue Belohnungs-
  mechanik in dieser Aufgabe.
- **Telemetrie** (Muster wie die Nekromant-V2-Phase-10-Vierschicht-Pipeline:
  Rohzaehler auf `state` → `main.js: teleAnvil` → `telemetry.js:
  recordRoom({anvil})` → `computeMetrics()`-Aggregation → Debug-Ansicht):
  `anvilFightDuration`, `anvilAverageRage`, `anvilMaxRage`,
  `anvilFrenzyCount`, `anvilFrontHits`/`-SideHits`/`-RearHits`,
  `anvilOuterCrashes`/`-InnerCrashes`, `anvilRamHitsPlayer`,
  `anvilDamageDuringOverheat`, `anvilGhostRageGenerated`,
  `anvilTimeWithoutRageHit`. Debug-Ansicht zeigt eine neue Zeile mit den
  Zielwerten aus dem Auftrag (kontrolliert 105–150 s, bewusster
  Ueberhitzungs-Rush 75–110 s) als Referenz — **nicht als harte Testgrenze**,
  reine Balance-Beobachtungshilfe wie beim Nekromanten auch.
- **Neuer Testabschnitt 67** (`tests/regression.mjs`, ~19 Pruefblocke,
  Gegenprobe fuer die zwoelf sicherheitskritischsten Mechanismen einzeln am
  echten Quellcode bestanden — je absichtlich rot gemacht und zurueckgesetzt:
  Zorn-Dedupe, Geistersalven-Buendelung, explosive Kugel registriert
  zusaetzlich direkt (+7 obendrauf statt nur +11), Minen-Zornregistrierung
  entfernt, passive Abbau-Karenz entfernt, Aussenwand-Zornverlust entfernt,
  Innenwand zieht faelschlich Zorn ab, Schockwellen-Sicherheitsluecke
  deaktiviert, Raserei-Wandkontakt senkt faelschlich Zorn,
  `armorDisabled`-Gate in `armorBlocks()` entfernt, `isBossCfg()` erkennt
  `anvilBoss` nicht mehr (deckte dabei zusaetzlich den echten
  1050→2646-LP-Doppelscaling-Fehler auf), rageEventId wird pro Kugel statt
  pro Abzug neu erzeugt): Struktur (`t_anvil`-Felder, Arena-Grid 24×16 mit
  genau einem `E`/`P`, `balance.boss.anvil` vollstaendig), ein ECHTER Spawn
  ueber den Kartengraphen (Akt 2 betreten → genau ein `t_anvil`, keine
  Unterstuetzung, **exakt 1050 LP**), `isBossCfg()`-Mechanismus isoliert,
  Exekution bleibt deaktiviert, Flanken-/Panzerungs-Gating (`flankable`
  schaltet die sonst ausgeschlossene Mechanik gezielt wieder ein,
  `armorDisabled` hebt den Frontblock generisch auf), das komplette
  Zorn-Ereignispaket-System (Dedupe/Betraege/Buendelung/Sperre) direkt ueber
  die echte `state.registerAnvilRage()`-Methode, `rageEventId`-Teilung bei
  einem echten Doppelrohr-Abzug (`fireBullet()`), explosive Kugel + ihre
  Explosion als EIN Paket ueber einen echten, hinten auftreffenden Schuss,
  eine echte Mine, Zornabbau-Karenz+Rate MIT DEN ECHTEN balance.json-Werten,
  die 25-%-LP-Zornuntergrenze ueber 10 simulierte Sekunden, Rammstoss
  Aussen- vs. Innenwand (beide ueber eine echte, substep-gefahrene
  Kollision), Hammerschlag sichere Luecke vs. Trefferzone (inkl.
  Betaeubung), Schleifspur-Kadenz/kein-Betaeuben/Verblassen, Rasereistart
  bei 100 Zorn (Angriffsabbruch, Gefahrenobjekte geleert, Sperre), die
  komplette Rasereidauer mit Wandkontakt UND unveraendertem Zorn, der
  Zusammenbruch (offene Panzerung genau `overheatedS` lang, Zorn
  eingefroren, Rueckkehr auf `rageAfterOverheat`/`lowHpMinRage`), „der
  Amboss feuert nie" ueber 400 simulierte Ticks, Boss-Tod raeumt Schockwellen/
  Schleifspuren restlos auf. **Drei echte Testkonstruktionsfehler beim
  eigenen Testbau gefunden und behoben** (kein Code-Bug, reine Testaufbau-
  Fallen — dokumentiert, weil sie sonst als falsche Positive durchgegangen
  waeren): (1) `armorBlocks()` braucht `tank.x`/`tank.y` fuer seine
  Winkelmathematik — ein Test-Tank-Objekt ohne diese Felder liefert `NaN`
  und damit immer `false`; (2) `createMine()`s Radiusparameter heisst in
  `tanksData.mine` `radiusPx`, nicht `radius` — ein `undefined`-Radius laesst
  `circlesOverlap()` nie ausloesen; (3) `boss.lastRageEventAt` blieb nach
  `initedAnvilRoom()`s einmaligem Init-Tick bei `-1e9` stehen — ohne einen
  expliziten Reset auf die aktuelle Zeit lief der passive Zornabbau schon
  waehrend der wenigen Ticks bis zum Wandkontakt mit und verfaelschte die
  gemessene Differenz um ein paar Hundertstel. **Ein weiterer Fund beim
  Schockwellen-Test**: der Spieler wurde anfangs 100 px NOERDLICH des
  originalen Boss-Spawns (Reihe 1, direkt unter der Aussenwand) platziert —
  das liegt AUSSERHALB der Arena und die Sichtlinienpruefung schlug aus dem
  falschen Grund fehl; behoben durch Umpositionieren des Bosses zur
  Arena-Mitte fuer diesen isolierten Test.
- Zusaetzlich ein eigenstaendiger Playwright-Smoke im echten Browser (nicht
  in die Suite eingecheckt, reine Vor-Merge-Verifikation): baut ueber die
  echten, per `fetch()` geladenen `data/*.json` + Spielmodule einen echten
  `boss_anvil`-Raum, laesst den Spieler 600 Ticks lang auf den Boss feuern —
  der Zorn steigt sichtbar (0→100), der Boss durchlaeuft dabei
  `between_attacks`/`charge_windup`/`charge`/`inner_crash`/`outer_crash`/
  `frenzy_warning`/`frenzy_aim`/`frenzy_charge`/`frenzy_turnaround` genau wie
  vorgesehen, Boss-LP bestaetigt exakt 1050 — und rendert einen echten Frame
  ueber `renderer.js`/`hud.js` (inkl. der neuen `drawAnvilHazards()`/
  Zornband-Overlay/HUD-Zornleiste) ohne einen einzigen Konsolenfehler.
- `sw.js` auf `v121` gebumpt (`src/game/anvil.js` neu in `ASSETS` — war
  beim ersten Anlegen der Datei versehentlich vergessen worden, erst beim
  finalen `ASSETS`-Abgleich aufgefallen und ergaenzt; `v120` war durch den
  parallel gemergten Hintergrundtausch bereits belegt, ein echter Code-
  aenderungs-Merge braucht eine eigene, frische Cache-Version), `telemetry.js:
  GAME_VERSION` mitgezogen. Keine neuen Bild-/Audio-Assets (Sprite-Alias +
  ausschliesslich wiederverwendete Sounds aus `data/sounds.json`).
- **Bewusst offen gelassen** (echtes Nutzer-Balancing braucht gespielte
  Runs, `localStorage.runs` ist in dieser Umgebung durchgehend leer, wie
  schon bei jeder frueheren Balance-Abnahme in diesem Projekt dokumentiert):
  alle ~40 Zahlenwerte in `data/balance.json: boss.anvil` sind exakt die im
  Auftrag vorgegebenen Werte, noch nicht am echten Spielgefuehl nachjustiert.
  Die Linien-Sicht-Blockade der Schockwellen durch innere Bloecke
  (`shockwaveBlocked()`) ist nicht als eigener isolierter Testfall geprueft
  (sie teilt sich die Raymarch-Technik mit der bestehenden, bereits an
  anderer Stelle bewachten Sichtlinien-KI) — bei Bedarf nachholen.

### Spinnenboss-Sprites (Nutzergrafik) — gemergt
Löst den im Spinnenboss-Abschnitt oben dokumentierten Platzhalterzustand
auf: der Nutzer hat drei Referenzbilder geliefert (Boss-Körper+Turm+acht
Beine auf echtem Alpha-Transparenz-Hintergrund; Spinnenmine mit acht
Bein-Positionen auf einem Schachbrett-Foto mit eingebrannten „Bein N"-
Labels; ein glänzendes weißes Spinnennetz-Icon auf Schachbrett-Foto) —
daraus sind fünf spielbare Sprite-Dateien entstanden:
`body_t_spider.png`/`turret_t_spider.png`/`spider_leg.png`/
`body_spider_mine.png`/`spider_web.png`.
- **Nur das erste Referenzbild war eine echte freigestellte Lieferung**
  (Schachbrettmuster = Transparenz-Indikator, kein Foto-Hintergrund) — Körper,
  Turm und alle acht Beine ließen sich daraus per randverbundener Flood-Fill-
  Freistellung (Muster wie bei jeder früheren Sprite-Lieferung) sauber
  isolieren. Die beiden anderen Referenzbilder sind wie schon beim ersten
  Spinnenboss-Auftrag dokumentiert **Foto-Mockups mit echtem Schachbrett-
  Hintergrund und eingebrannten Text-Labels** — daraus ließ sich kein
  Bild 1:1 direkt übernehmen, nur gezielt extrahieren (s. u.).
- **EIN gemeinsames Bein-Sprite (`spider_leg.png`) für Boss UND Minen**
  (bewusste Vereinfachung gegenüber der ursprünglich angenommenen „acht
  Bein-Sprites je Einheitentyp"): aus einem der acht isolierten Boss-Beine
  aufbereitet — der Gelenk-Ball (Pivot) sitzt exakt am LINKEN Bildrand
  (vertikal zentriert, `LEG_PIVOT_MARGIN_PX` in `spiderrender.js`), das
  Bein zeigt nach der Aufbereitung horizontal nach rechts zur Klaue.
  `spiderrender.js: drawLegSprite()` rotiert es wie einen Zeiger vom Gelenk
  zum Fuß und skaliert es auf die tatsächliche Gelenk-Fuß-Distanz — dieselbe
  Funktion zeichnet die acht Bein-Sprites des Boss UND (viel kleiner
  skaliert) die acht der Spinnenminen. Die Mine-Referenzbein-Grafiken aus
  dem zweiten Foto wurden dafür NICHT verwendet (Checkerboard-Extraktion
  eines einzelnen kleinen Beins aus einem Foto mit ähnlich dunklen
  Objektfarben wäre unzuverlässig gewesen) — ein optisch stimmiges,
  bereits sauberes Bein wiederzuverwenden war robuster als eine zweite,
  fehleranfällige Freistellung.
- **Body-/Turm-Zentrierung nach demselben „Loch = Drehpunkt"-Verfahren**
  wie bei den früheren Klassen-/Champion-Sprites: das runde weiße Loch im
  Körperbild (unterhalb des Spinnen-Icons) wurde per Helligkeits-
  Schwellenwert im richtigen Suchbereich lokalisiert und die Leinwand
  asymmetrisch darauf zentriert; beim Turm wurde zuerst der Lauf per
  Zeilen-/Spalten-Breitenprofil von der Kuppel getrennt (Kuppel breit,
  Lauf schmal), der Turm um 90° gedreht (**empirisch verifiziert**, nicht
  nur angenommen: Zielkoordinate des Laufs nach der Drehung geprüft, s.
  Kommentar in `spiderrender.js`) bis der Lauf nach rechts zeigt (Konvention
  „Rohr zeigt nach rechts = Winkel 0"), und die Leinwand auf den
  Kuppel-Schwerpunkt zentriert.
- **Body-Rotation ist bewusst `heading - PI/2`, nicht die sonst übliche
  `+ PI/2`**: die Mandibel/das „Gesicht" im Quellbild zeigt nach UNTEN statt
  nach oben wie bei der allgemeinen Panzer-Sprite-Konvention. Der Turm
  rotiert dagegen ganz normal mit `tank.turret` (keine Sonderrolle) — beide
  Werte sind über `tests/spidersprites.mjs` explizit gegen die exakten
  Rotationswinkel geprüft, nicht nur „irgendein Winkel".
- **Minenkörper (`body_spider_mine.png`) aus dem Foto extrahiert**: die
  Freistellung eines dunklen Objekts auf einem SCHWARZ/WEISS-Schachbrett
  (nicht dem hellen Transparenz-Indikator-Muster) brauchte einen eigenen
  Ansatz — Hough-Kreiserkennung (`cv2.HoughCircles`) fand den Minenkörper-
  Kreis zuverlässig, ein Grauwert-/Rotton-Schwellenwert (Minenkörper ist
  durchgehend dunkelgrau ~25–40, das Schachbrett strikt schwarz~7 oder
  weiß~246 — deutlich getrennte Wertebereiche) plus Verbindungskomponenten-
  Filterung + eine ROI-Kreisbegrenzung (schließt die eingebrannte
  Textbeschriftung und Bein-Hinweislinien aus) lieferten ein sauberes
  Ergebnis. Kleine Reste an den vier Bildecken (Textfragment-/Linien-Ticks)
  sind bei der kleinen In-Game-Größe der Mine nicht wahrnehmbar.
- **Spinnennetz (`spider_web.png`) war der mit Abstand aufwendigste Teil**:
  ein glänzendes weißes Objekt auf einem SCHWARZ/WEISS-Schachbrett lässt
  sich nicht per einfachem Farbschwellenwert trennen, weil JPEG-
  Kompressionsartefakte an JEDER Schachbrett-Kante genug Zwischenwerte
  erzeugen, um das gesamte Schachbrett zu einem einzigen verbundenen
  „Störungsnetz" zusammenzuschließen, sobald es die Objektmaske berührt.
  Gelöst über eine explizite Ausschlusszone (± 3 px) um jede einzelne
  Schachbrett-Gitterlinie (Rasterperiode + Phase per linearer Regression aus
  allen sauberen Rand-Zeilen/-Spalten bestimmt), gefolgt von einer
  Verbindungskomponenten-Filterung nach Form (fast perfekt quadratische,
  fast vollständig gefüllte Fragmente in der Größe einer einzelnen
  Schachbrett-Kachel werden verworfen — ein Anzeichen für eine durch
  Bildphasen-Drift komplett fehlklassifizierte Einzelkachel, kein echtes
  Netzfragment), einer begrenzten Rückverbindung über die ausgeschlossenen
  Gitterlinien-Bänder hinweg und einem SELEKTIVEN Lückenfüllen (nur kleine
  Löcher füllen, die großen Maschenlöcher des Netzes selbst müssen
  transparent bleiben — ein erster Versuch mit uneingeschränktem
  `binary_fill_holes` hat genau diese Maschenlöcher fälschlich zugefüllt).
  **Ergebnis ist kein pixelperfektes Netz** (ein paar sehr kleine
  Schachbrett-Reste bleiben in einzelnen Maschen sichtbar), aber bei der
  kleinen In-Game-Darstellungsgröße (`drawSpiderWebs()` skaliert auf
  `hitRadiusPx * 2.3`) praktisch nicht wahrnehmbar — ein bewusster
  Kompromiss angesichts der Fotoqualität der Quelle, kein weiterer
  Zeitaufwand für einen kaum sichtbaren Rest gerechtfertigt.
- **Alle vier Zeichenfunktionen in `spiderrender.js`
  (`drawSpiderBossBody`/`drawSpiderBossLegs`/`drawSpiderMines`/
  `drawSpiderWebs`) prüfen zuerst per `sprite()`, ob ihr Bild geladen ist**,
  und fallen sonst unverändert auf die alte PROZEDURALE Darstellung zurück
  (exakt das Muster aus dem Champion-Sprite-Nachtrag) — das Spiel bleibt
  dadurch auch ohne/während des Ladens der neuen Dateien spielbar, und die
  bestehende `tests/regression.mjs`-Abdeckung (Abschnitt 66, domstub mit
  fehlschlagendem Image-Stub) bewacht weiterhin genau diesen Fallback-Pfad.
- **Neuer, eigener Test `tests/spidersprites.mjs`** (dependency-frei, Muster
  `tests/championsprite.mjs` — ein EIGENER, ERFOLGREICHER Image-Stub VOR dem
  ersten Import von `renderer.js`, weil `initSprites()` sonst mit dem
  Standard-domstub-Stub liefe, der immer fehlschlägt): prüft Struktur (alle
  fünf Dateien werden mit den erwarteten Namen angefordert, `SPRITES.spider`
  hat genau 3 Einträge), dass `drawSpiderBossBody()`/`drawSpiderBossLegs()`/
  `drawSpiderMines()`/`drawSpiderWebs()` bei geladenem Sprite tatsächlich
  `drawImage(...)` aufrufen statt der alten `arc()`/`stroke()`-Aufrufe, die
  exakten Rotationswinkel (`heading-PI/2` für den Körper, `turret` für den
  Turm) und die korrekte Bein-/Minen-Anzahl (nur lebende Beine, acht
  Mine-Beine). Gegenprobe für jeden Kernpunkt einzeln bestanden (`'t_spider'`
  aus `TANK_TYPES` entfernt → Struktur- und Body/Turm-Checks rot; die drei
  `sprite('spider', …)`-Abfragen einzeln auf `null` gesetzt → die jeweiligen
  Bein-/Minen-/Netz-Checks rot, danach zurückgesetzt).
- Playwright-Smoke (echter Server, echte PNG-Dateien, kein Node-Stub): ein
  handgebauter Spinnenboss mit sechs lebenden + zwei toten Beinen, eine
  Mine und ein Netz werden über die echten `spiderrender.js`-Funktionen auf
  einen echten Canvas gezeichnet — Screenshot bestätigt ein visuell
  stimmiges Ergebnis (Körper+Turm mit sichtbarem Spinnen-Icon-Rand, acht
  radial angeordnete Beine mit Lebensbalken, Mine mit kleinen Beinen, klar
  erkennbares Spinnennetz-Icon), keine Konsolenfehler.
- `sw.js` auf `v121` gebumpt (5 neue Dateien in `ASSETS`),
  `telemetry.js: GAME_VERSION` mitgezogen.
### Bugfix: „non-finite ab Mitte Akt 2" (NaN-Kugeltempo) — gemergt
**Nutzermeldung (iPhone/Safari):** „TypeError: The provided value is
non-finite" aus `src/render/r…`, „passiert immer ab Mitte Akt 2".
**Es war kein Renderfehler, sondern eine Datenlücke** — der Renderer war nur
die Stelle, an der ein längst entstandenes NaN endlich aufflog.
- **Ursachenkette** (jeder Schritt reproduziert, nicht hergeleitet):
  `t_green` trägt seit Grundsteinumbau Phase 3 `weapon: "mortar"`, die
  Tabelle `data/tanks.json: bulletSpeeds` kannte aber nur `bullet`/`rocket`.
  `cfg.js: resolveCfg()` löste `cfg.bulletSpeed` damit still zu `undefined`
  auf. Für `t_green` als **Gegner** blieb das folgenlos (er feuert über
  `mortar.js: fireMortar()` und liest das Feld nie — deshalb fiel es nie
  auf). Ein vom **Nekromanten übernommener** `t_green`-Untertan feuert
  dagegen als NORMALER Schütze (`ghost.js: updateGhosts()`) und rechnete
  `undefined * Faktor` = **NaN** → NaN-Kugel → NaN-Position → Absturz in
  `state.js: isSolid()` (`grid[NaN]`) bzw. im Renderer
  (`drawSpriteRot()` → `ctx.drawImage(img, NaN, …)`).
- **„Ab Mitte Akt 2" ist exakt** `difficulty.json: danger.t_green`
  (`unlockAct: 2`, `unlockRoomInAct: 4`) — vorher kann der Typ gar nicht
  vorkommen. Messung über 9 Seeds × beide Klassen: **Nekromant 9/9 bricht in
  Akt 2 ab** (Räume 4/4/5/7/7/9/10/14/17), **Standardklasse 9/9 sauber bis
  Akt 3** — der Fehler war also nekromantenspezifisch.
- **Fix auf zwei Ebenen** (bewusste Arbeitsteilung, per Gegenprobe getrennt
  nachgewiesen): (1) **Datenlücke geschlossen** — `bulletSpeeds.mortar: 130`
  in `data/tanks.json`, mit Kommentar, warum der Eintrag existiert, obwohl
  der Mörser selbst ihn nie liest. (2) **Sicherheitsnetz im Code** —
  `resolveCfg()` fällt bei einem in der Tabelle unbekannten Waffenwert auf
  `bulletSpeeds.bullet` zurück, statt lautlos `undefined` zu liefern; ein
  künftiger neuer Waffenwert bleibt damit spielbar, statt still vergiftet zu
  werden. Der Strukturtest (a) deckt die Lücke trotzdem auf, damit der
  Rückfall sie nicht versteckt.
- **Der eigentliche blinde Fleck war die Testinfrastruktur**: der
  Fake-Canvas in `tests/domstub.mjs` schluckte **jedes** Argument
  stillschweigend. Die Suite führte den Renderpfad seit UMBAUPLAN-LP Phase 2
  zwar aus, konnte ein NaN darin aber **prinzipiell nicht sehen** — genau
  daran ist dieser Fehler vorbeigelaufen. Der Stub **wirft jetzt wie ein
  echter Browser** (`assertFinite()` über 20 zahlenverarbeitende
  Canvas-Funktionen, inkl. `drawImage`/`createRadialGradient`). Damit
  bewacht **jeder bestehende Renderpfad-Test** diese Fehlerklasse ab sofort
  automatisch mit, nicht nur der neue Abschnitt.
- **Browserverhalten (ehrlich abgegrenzt)**: **Chromium schluckt** sowohl
  `ctx.arc(NaN, …)` als auch `ctx.drawImage(img, NaN, …)` **still** — im
  Playwright-Browser ließ sich der Wurf deshalb NICHT nachstellen (mit
  geladenen Sprites geprüft, kein Fehler). **WebKit/Safari ist strenger** und
  meldet dort „TypeError: The provided value is non-finite" — der Wortlaut
  der Nutzermeldung. Der Safari-Wurf selbst ist hier also **nicht** direkt
  reproduziert worden; belegt sind die NaN-Kugel, ihr Weg in `renderer.js`
  und die exakte Übereinstimmung von Zeitpunkt („ab Mitte Akt 2"), Datei
  (`renderer.js`) und Fehlerklasse.
- **Neuer Testabschnitt 68** (`tests/regression.mjs`, drei Gegenproben am
  echten Quellcode einzeln bestanden und zurückgesetzt): (a) jeder
  `weapon`-Wert hat einen echten `bulletSpeeds`-Eintrag oder einen
  typeigenen Override; (b) `resolveCfg()` liefert für JEDEN Typ ein
  endliches `bulletSpeed`; (c) ein übernommener Untertan **jedes**
  Gegnertyps hat durchweg endliche cfg-Werte (nicht nur `t_green` — ein
  neuer Typ mit exotischer Waffe fällt sofort auf); (d) der cfg.js-Rückfall
  mit EIGENEN Zahlen (synthetischer Waffenwert, Tabelle 42/99); (e)
  End-zu-Ende über den echten Weg — ein `t_green`-Untertan feuert, alle
  Kugel- und Panzerwerte bleiben über 4 s endlich; (f) der Fake-Canvas
  wirft bei `arc(NaN)` und **nicht** bei gültigen Argumenten (sonst wäre
  der neue Schutz später unbemerkt wieder wirkungslos).
  **Gegenproben**: nur den `mortar`-Eintrag entfernt → genau (a) rot (Rest
  grün — der Code-Rückfall hält das Spiel spielbar, wie gewollt); **beide**
  Fixes entfernt → (a)–(e) rot mit der vollständigen Kette
  `undefined` → `NaN` → NaN-Kugelposition; strengen Canvas zurückgebaut →
  (f) rot.
- **Verifikation**: volle Suite grün; `gamepad`/`music`/`championsprite`
  grün; ein eigener NaN-Scanner über **18 vollständige Runs** (2 Klassen ×
  9 Seeds, Spieler unsterblich, damit Akt 3 wirklich erreicht wird) findet
  **kein einziges** nicht-endliches Feld mehr in Panzern, Untertanen,
  Kugeln, Minen, Mörsergranaten, Schockwellen und Schleifspuren — derselbe
  Scanner meldete gegen den ungefixten Stand 9/9 Nekromanten-Runs als
  fehlerhaft. Im echten Browser feuert ein `t_green`-Untertan jetzt mit
  Tempo 130 statt `NaN`, 300 gerenderte Frames ohne Konsolenfehler.
- `sw.js` auf `v122` gebumpt (`data/tanks.json` liegt im Offline-Cache, ein
  Bump ist für Offline-Nutzer nötig), `telemetry.js: GAME_VERSION`
  mitgezogen.

### Gegner-/Encounter-Design Akt 2 + Akt 3 (Designdokument + laufende Umsetzung)
**Neu eingegangen: `docs/AUFTRAG-GEGNERDESIGN.md`** (nach Nutzerwunsch aus
dem Repo-Wurzelverzeichnis nach `docs/` verschoben) — ein reines Designdokument
(kein Code, kein Bauauftrag) fuer **16 neue Gegner** (8 je Akt), 20
Encounter, 8 Akt-3-Kompositionen, Einfuehrungskurve, Build-Interaktionen,
Placeholder-Sprites, technische Einordnung und ein bewertetes Design-Audit.
Erstellt nach einem vollstaendigen Ist-Abgleich gegen den echten Repo-Stand
(nicht aus dem Gedaechtnis) — die dabei gefundenen Befunde sind wichtiger
als die Gegner selbst:
- **`run.js: buyEnemies()` ist eine rein zufaellige Einkaufsschleife.** Es
  gibt keine Rollenquote, keine Paarbildung, keinen Ausschluss; `maxPerRoom`
  existiert im Schema und wird ausgewertet, ist aber bei **keinem** Typ
  gesetzt. **Ohne Kompositionsregeln sind geplante Aufstellungen prinzipiell
  nicht erzeugbar** — das ist der wichtigste Einzelbefund des Dokuments
  (Vorschlag in dessen Abschnitt 17.3: `maxPerRoom` belegen, Mindestpunkt-
  zahl je Gegner, Rollenquote, `data/compositions.json` mit Rueckfall auf
  die heutige Zufallsschleife).
- **Sechs von zehn Gegnern haben dieselbe Funktion** (direkter Schussdruck);
  es gibt **keinen** Unterstuetzer, keinen Nahkaempfer, keinen Beschwoerer
  und keinen Gegner, dessen Wert von einem anderen Gegner abhaengt. Damit
  existiert im Spiel aktuell **keine Toetungsreihenfolge** als Entscheidung.
- **`t_brown` (1 Punkt) und `t_grey` (2) verstopfen Akt 3**: bei 61 Punkten
  Budget und `maxEnemiesPerRoom: 8` verbrauchen sie Gegner*plaetze*, nicht
  Budget.
- **Die Trefferschleife kennt kein Teamsystem** (`state.js`: nur
  `b.owner === t` wird uebersprungen) — Gegnergeschosse treffen Gegner. Das
  ist gelebter Ist-Stand (der Moerser nutzt ihn mit `spare: null`) und im
  Dokument bewusst als Designwerkzeug genutzt, nicht als Mangel behandelt.
- **`cfg.js: resolveCfg()` ist eine 44-Feld-Whitelist** — jedes neue
  Gegnerfeld muss dort eingetragen werden, sonst kommt es lautlos nie an
  (dieselbe Falle wie in Phase 14/15).
Alle 16 vorgeschlagenen Gegner bleiben im bestehenden **2-5-Treffer-Band**
(20-50 LP), sodass der Bestandstest in `tests/regression.mjs` Abschnitt 10a
nicht bricht; keiner braucht eine neue Architektur. Sechs weitere Entwuerfe
wurden ausdruecklich **verworfen** (Begruendungen in Abschnitt 19.1 des
Dokuments), damit sie in spaeteren Sitzungen nicht erneut auftauchen.
**Kein `sw.js`-Bump** (reine Markdown-Datei, kein Spiel-Asset).

**Umsetzungsauftrag eingegangen: `UMBAUPLAN-GEGNER.md`** (Repo-Wurzel) —
der Nutzer hat einen Neun-Phasen-Bauplan (G0-G9) fuer das Designdokument
geliefert, "eine Phase pro Session" nach dem `PLAN.md`-Muster. **Phase G0
(Ist-Abgleich) ist gebaut** — reiner Analyse-Ist-Abgleich, kein Produktivcode,
danach planmaessig angehalten und auf Freigabe gewartet. Kernergebnisse:
- **Alle elf Pflichtlektuere-Zeilenangaben aus dem Bauplan stimmen exakt**
  (`resolveCfg()` Z. 5, `applyDamage()` Z. 688, `killTank()` Z. 958,
  `resolveTarget()` Z. 78, `coverDrive()` Z. 175, `roleTurret()` Z. 35,
  `fireHook()`/`placeTrapWall()` Z. 772/792, `explodeAt()` Z. 45,
  `SPRITE_ALIAS` Z. 130, `drawAnvilHazards()` Z. 407, `drawLightning()`
  Z. 1080) — ein starkes Signal, dass das Designdokument tatsaechlich gegen
  den Code geschrieben wurde. `resolveCfg()` hat **exakt 44 Felder**
  (skriptausgezaehlt, deckt sich mit der Doku-Angabe).
- **Drei technische Praezisierungen, alle Richtung "einfacher als
  gedacht"**: `t_shotgun`s Kugelfaecher braucht **keinen** neuen Mechanismus
  — `tank.js: fireBullet()` hat mit `cfg.spreadCount`/`cfg.spreadRad` (Z.
  307-312) bereits einen generischen N-Kugel-Faecher, heute nur ueber die
  Spielerkarte `streuschuss` erreichbar (`cfg.js: applyUpgrades()`, NICHT
  `resolveCfg()`); seine kurze 210-px-Reichweite braucht ebenfalls kein
  neues Feld — `bullet.js: burstDistance` (bisher nur ueber die Karte
  `flak`) toetet ein Geschoss unexplosiv bei Erreichen der Distanz, exakt
  das gesuchte Verhalten. `t_lance`s Durchschlag (`pierce`) ist **bereits**
  in der `resolveCfg()`-Whitelist (Nekromant-V2 Phase 2) und braucht **gar
  keine** Codeaenderung. Fuer alle drei reicht ein direkter Whitelist-
  Durchgriff auf bestehende Feldnamen statt einer neuen verschachtelten
  `spread`/`charge`-Struktur.
- **Baustein C (Telegraph-Flaechen) war zu optimistisch als "null Aufwand"
  eingestuft**: `effects.js: drawAnvilHazards()`/`drawMortars()` sind hart
  an `state.anvilBoss`/`state.mortars` gebunden, keine parametrisierten
  Helfer — die Ray-March-Technik ist eine bewaehrte Vorlage, muss aber zu
  einer generischen Funktion generalisiert werden (kleiner bis mittlerer
  Aufwand, nicht null).
- **Baustein A (Aura-Flags) existiert nur als Einzelfall**
  (`ghost.js: necroAuraWeakened`, fest fuer die Nekromant-Champion-Aura) —
  ein generisches `tank.auraFlags`-Objekt fuer `t_anchor`/`t_marshal` muss
  neu geschrieben werden, nach demselben bewaehrten Reset-pro-Tick-Muster.
- **`t_mason`s Laufzeit-Erreichbarkeitspruefung**: `generator.js:
  reachableCells()` ist eine fertige BFS, arbeitet aber auf dem statischen
  Generierungs-Grid. `state.js` haelt ein eigenes, closure-lokales Grid
  (synchron gehalten von `placeTrapWall()`/`destroyWall()`/`setWallSolid()`)
  — der Algorithmus ist 1:1 uebertragbar, aber als neue `state`-Methode,
  nicht als Aufruf der Generator-Funktion.
- **Regressionsfolgen (O1)**: `tests/regression.mjs` hat **keine**
  Assertion, die eine exakte Raum-Gegnerzusammensetzung erwartet (nur
  Determinismus- und Sieg-Proben) — ein Datenschalter fuer neue Typen ist
  damit unnoetig, jeder Gegner wird direkt in seiner Bauphase scharf
  geschaltet.
- **Sechs offene Entscheidungen (O1-O6) beantwortet** (als Vorschlag, nicht
  Festlegung): O1 kein Schalter noetig, O2 Mindestpunktzahl nur ab Akt 2
  (sonst waeren `t_brown`/`t_grey` schon in spaeten Akt-1-Raeumen
  ausgeschlossen, wo sie den ganzen Bestand stellen), O3 optionales
  `affixDeny`-Feld erst in G8, O4 Nekromant-Exekutions-Frage auf G3
  verschoben (`killTank()`s Revive-Zweig haengt strukturell nicht an
  `tank.executing`, aber ein gezielter Kartendurchsuch folgt erst beim
  Bau von `t_anchor`), O5 Blindgaenger-Schrott zaehlt voll (konsistent zu
  jeder bestehenden Mehrfachkill-Quelle, kein Ersatzdeckel), O6 G0-G4
  (Akt 2 + Kompositionssystem) als sauberer erster Lieferumfang.
Details, vollstaendige Pruefliste und der Whitelist-Diff in
`UMBAUPLAN-GEGNER.md`. **Kein `sw.js`-Bump** (reine Analyse, kein
Produktivcode). Nutzer hat O1-O6 wie vorgeschlagen freigegeben.

**Phase G1 (Fundament) ist gebaut.** Fuenf Bausteine, **null neue Gegner** --
die Abnahme ist woertlich "im Spiel nichts sichtbar anders": alle 5
Regressions-Seeds raeumen exakt dieselbe Raumzahl wie vor der Phase
(31/32/29/38/38), `node tests/regression.mjs` unveraendert gruen.
- **Baustein A (Aura-Flags)**: `state.js` setzt jeden Tick
  `tank.auraFlags = { noFlank, noExecute, fireRateMult }` fuer JEDEN Panzer
  zurueck (Muster woertlich wie `ghost.js: necroAuraWeakened`), direkt in der
  bestehenden Tick-Schleife, die ohnehin schon `t.executing`/`t.cooldown`
  berechnet -- kein zweiter Durchlauf. Drei Lesepunkte: `noFlank` in der
  Flankenzonen-Pruefung (`state.js`, erzwingt `'front'`), `noExecute` direkt
  neben der `t.executing`-Berechnung (`state.js`), `fireRateMult` in
  `tank.js: fireBullet()` (multiplikativ auf `tank.cooldown`, **nicht** wie
  im Bauplan angenommen in `ai_turrets.js: roleTurret()` -- die Funktion
  berechnet gar keinen Cooldown, nur die Feuerentscheidung; Abweichung im
  Ist-Abgleich-Sinn dokumentiert). Aktuell erzeugt kein Gegner eine Aura
  (kommt mit `t_anchor`/`t_marshal` in G3/G6) -- alle drei Lesepunkte sind
  bis dahin wirkungslose No-ops.
- **Baustein B (Verbindungslinien)**: `state.tankLinks` (neues, pro Raum
  leeres Array, Muster wie `anvilShockwaves`/`anvilTrails`) +
  `effects.js: drawTankLinks(ctx, state)` -- EINE generische Funktion fuer
  alle fuenf Linienarten (Heilstrahl/Lichtfaden/Fahnenlinie/Kette/Leine,
  G2-G6), parametrisiert ueber `{x0,y0,x1,y1,color,width,dash,pulseHz,...}`.
  Aufruf in `renderer.js` neben `drawAnvilHazards()`. Aktuell leer, kein
  Erzeuger gebaut.
- **Baustein C (Telegraph-Flaechen)**: der G0-Fund "war zu optimistisch als
  null Aufwand eingestuft" ist behoben -- zwei neue generische Helfer in
  `effects.js`: `drawGrowingRingTelegraph()` (gestrichelter Aussenring +
  wachsende Fuellung, aus `drawMortars()` extrahiert) und
  `drawCorridorTelegraph()` (Ray-March-Warnkorridor mit Endkante, aus
  `drawAnvilHazards()` extrahiert, gibt die tatsaechliche Laenge zurueck).
  Beide bestehenden Aufrufstellen (Moerser, Amboss-Rammkorridor) sind auf die
  neuen Helfer umgestellt -- **pixelidentisch** (alle Vorgabewerte = die
  alten hartkodierten Farben/Breiten), reiner Refactor.
- **Baustein D (Mehrfachschuss)**: kein neuer Code noetig (G0-Fund bestaetigt)
  -- `spreadCount`/`spreadRad`/`burstRangePx` existierten in `tank.js:
  fireBullet()` bereits generisch (Streuschuss-Faecher, Flak-Kurzreichweite),
  nur ueber `applyUpgrades()` statt `resolveCfg()` erreichbar. Jetzt Teil der
  Whitelist (Baustein E).
- **Baustein E (Whitelist)**: `cfg.js: resolveCfg()` hat jetzt 16 neue
  Felder (`spreadCount`/`spreadRad`/`burstRangePx` + 13 strukturierte
  Neubauten `charge`/`heal`/`ram`/`suppressField`/`sightRelay`/`deathBlast`/
  `rally`/`stalk`/`tether`/`harvest`/`metronome`/`grapple`/`build`, alle
  `?? null`/`?? 0`/`?? 1`) -- reine Datenuebernahme wie `armor`/`miner`,
  gelesen wird davon vor G2 nichts.
- **Neuer Testabschnitt 69** (`tests/regression.mjs`, Gegenprobe fuer jeden
  Kernpunkt einzeln bestanden -- je einzeln absichtlich rot gemacht und
  zurueckgesetzt: ein Whitelist-Eintrag entfernt, der Aura-Reset-Block
  ausgebaut, `noFlank`/`noExecute`/`fireRateMult` je einzeln aus ihrem
  Lesepunkt entfernt, `tankLinks` aus `createState()` entfernt,
  `drawCorridorTelegraph()`s Rueckgabewert entfernt): Whitelist-Durchgriff
  mit EIGENEN synthetischen Werten (nicht der aktuellen `tanks.json`-
  Datenlage, die noch keins der Felder setzt) + Vorgabewerte an einem
  Bestandstyp, Aura-Reset-Mechanismus ueber einen echten `stepState()`-Tick,
  die drei Lesepunkte einzeln ueber einen **Proxy** um `t.auraFlags`
  (Schreibzugriffe des Tick-Resets landen normal im Backing-Objekt, ein
  gezielter Lesezugriff liefert einen von aussen steuerbaren Wert -- noetig,
  weil ohne echten Erzeuger ein manuell gesetztes Flag den Reset am
  Tickanfang nie ueberleben wuerde, s. u.), `state.tankLinks`-Struktur +
  `drawTankLinks()` crashfrei, die beiden neuen Telegraph-Helfer eigenstaendig
  aufrufbar (nicht mehr an `state.anvilBoss`/`state.mortars` gebunden).
- **Ein echter Fund beim Testbau, nicht im Code**: ein manuell auf einem
  Testpanzer gesetztes `auraFlags.noFlank = true` **ueberlebt den naechsten
  `stepState()`-Aufruf nicht** -- der Reset am Tickanfang setzt es noch
  VOR dem Lesepunkt (Flanke/Exekution) im selben Tick zurueck, weil G1
  bewusst keinen Erzeuger baut. Ein direkter End-to-End-Test ueber die
  oeffentliche API ist deshalb erst ab G3 (`t_anchor`) moeglich; bis dahin
  deckt ein Proxy um `t.auraFlags` (Schreibzugriffe normal, ein gezielter
  Lesezugriff von aussen steuerbar) denselben Mechanismus ab, ohne
  Produktivcode vorwegzunehmen.
- **Schlechtester Frame vorher/nachher** (Grundregel): 8-Gegner-Raum, 500
  Ticks, drittgroesster Wert je Lauf (Projektkonvention gegen GC-Ausreisser),
  schlechtester von 3 Laeufen: **1,203 ms vorher → 1,587 ms nachher** (Budget
  6 ms) -- der Aura-Reset kostet eine zusaetzliche kleine Objektzuweisung je
  Panzer und Tick, `drawTankLinks()` iteriert ein leeres Array.
Kein `sw.js`-Bump (reine Code-/Testaenderung, kein neues Asset, keine
sichtbare Spielaenderung).

**Phase G2 (Akt 2, Welle 1) ist gebaut.** Vier Gegner, alle vier ohne neue
Architektur -- sie heben, verallgemeinern oder aktivieren nur, was G0/G1
bereits gefunden bzw. gebaut hatten.
- **`t_rusher`** (Rammler, 3 Punkte, Raum 1): `ai_drives.js: ramDrive()`
  (neu, exportiert) verallgemeinert das Kontaktschaden-Muster aus `anvil.js`
  (`pushFromRam`/`ramHitCheck`/`moveChargeSubsteps`) auf ein einfaches,
  rage-freies Vier-Zustands-Modell (`seek`→`windup`→`charge`→`exhausted`).
  Ausloeser: aufgeloestes Ziel (Upgradepool-v2 Phase 5: kann ein Geist sein)
  innerhalb `triggerPx` (90) UND Sichtlinie. Windup (0,35 s) friert die
  Richtung EINMALIG ein (`tank.heading` folgt ab da nicht mehr dem Ziel,
  auch wenn es sich bewegt); der Sturm (0,6 s, `speedMult 2.0`) bewegt den
  Panzer per eigener Substep-Schleife (`RAM_STEP_PX 4`, Muster
  `CHARGE_STEP_PX` aus `anvil.js`) UNTER Umgehung von `moveTank()` (die
  Dispatch-Funktion in `ai.js: updateEnemy()` bekommt dafuer `{x:0,y:0}`
  zurueck) -- haelt an der ERSTEN beruehrten Wand sofort an. Hoechstens EIN
  Treffer je Ziel PRO Sturm (`ram.hitTargets`-Set, geleert bei Sturmbeginn),
  Rueckstoss ueber `ramPushback()` (Muster `pushFromRam`, probiert Seite →
  Gegenseite → geradewegs zurueck). 2,0 s Erschoepfung danach, dann zurueck
  zu `seek`. Dispatch-Vorrang in `ai.js: updateEnemy()`: `ramMove ||
  (seekCover && coverDrive(...)) || DRIVES[role](...)` -- `ramDrive()` gibt
  `null` zurueck, solange kein Sturm laeuft, die normale Rollen-Fahrfunktion
  (hier: `hunter`) behaelt bis dahin die Kontrolle. Telegraph: der
  Sturmkorridor waehrend des Windups ueber Baustein C
  (`drawRamTelegraphs()`, `effects.js`).
- **`t_dud`** (Blindgaenger, 3 Punkte, Raum 3): neues, eigenstaendiges
  Zeitverzoegerungs-Array `state.deathFuses` (Muster `state.mortars`) statt
  eines zweiten Explosionssystems. `state.js: killTank()`s Nicht-Spieler-
  Zweig legt bei `tank.cfg.deathBlast` GANZ AM ANFANG (vor dem uebrigen
  Kill-Bonus-Block, damit auch ein per Kettenreaktion sterbender Blindgaenger
  seine Zuendung behaelt) einen `{x,y,radiusPx,damage,age,fuseS}`-Eintrag an.
  Ein neuer, modulweiter `updateDeathFuses(state, dt)` (in `state.js`,
  eingehaengt in `stepState()`s Tick-Kette neben `updateMines`/
  `updateMortars`) zaehlt hoch und detoniert nach `fuseS` (1,2 s) ueber den
  bestehenden `mine.js: explodeAt(..., spare: null, ...)` -- `spare: null`
  ist bewusst gewaehlt: die Explosion trifft ausdruecklich AUCH andere
  Gegner (kein Team-System in der Trefferschleife, s. UMBAUPLAN-GEGNER.md
  Falle 2 -- hier gezielt genutzt, nicht umgangen). `weapon: null` +
  `damage: 0` -- der Blindgaenger wehrt sich nicht, sein gesamter Schaden
  kommt aus der Explosion. Telegraph: wachsender Ring an der Sterbeposition
  (`drawDeathFuses()`, Baustein C, giftgruen statt Moerser-Orange zur
  Unterscheidung).
- **`t_shotgun`** (Streuer, 4 Punkte, Raum 2): Baustein D
  (`spreadCount: 5`, `spreadRad: 0,1484` fuer einen 34°-Gesamtfaecher --
  `(i-(n-1)/2)*spreadRad` ueber 5 Kugeln spannt `4×spreadRad`, nicht
  `2×spreadRad`, eigener Rechenfehler beim Entwurf gefangen und korrigiert)
  + `burstRangePx: 210` (bestehendes `bullet.js: burstDistance`-Feld, sonst
  nur von der Spielerkarte `flak` genutzt) liefern Faecher und kurze
  Reichweite ohne neuen Code. Neu ist nur **eine** Sekunde Salven-Vorwarnung:
  `fireWindupS` (0,35 s), ein Feld, das im urspruenglichen 16-Felder-
  Whitelist-Diff aus G1 NICHT vorgesehen war (dort gemeldete Abweichung,
  nachtraeglich in `cfg.js: resolveCfg()` ergaenzt). `ai_turrets.js:
  roleTurret()` haelt am Ende (nach Kegel/Sichtlinien-/Moerser-Gates) einen
  `ai.windupTimer` an, der erst ab `fireWindupS` `true` zurueckgibt; JEDER
  vorherige `return false`-Zweig (Kegel verfehlt, Muendung blockiert, keine
  Sichtlinie, Moerser-Mindestreichweite) setzt ihn ueber einen neuen,
  gemeinsamen `resetFireWindup()`-Helfer zurueck -- kein "aufgestauter"
  Schuss aus einer laengst verlassenen Ausrichtung. Telegraph: derselbe
  `drawGrowingRingTelegraph()` zweckentfremdet als Reichweitenring
  (gestrichelter Aussenring bei `burstRangePx`, nur sichtbar wenn der
  Spieler nahe genug ist) UND als Windup-Fuellung (`drawFireWindups()`).
- **`t_lance`** (Speertraeger, 6 Punkte, Raum 4): eigener Zustandsautomat
  `chargeTurret()` in `ai_turrets.js` (nicht `ai_drives.js` -- es ist ein
  Feuerentscheidungs-Ersatz, keine Bewegung; Rolle bleibt `sieger`, haelt
  `preferredRange: 300` normal), ersetzt bei `cfg.charge` die GESAMTE
  generische Feuerlogik von `roleTurret()`. Vier Zustaende (`idle`→
  `charging`→`locked`→`pause`): `idle` verfolgt normal, bis Kegel+Sichtlinie
  passen; `charging` (die ersten `windupS-lockAtS` = 0,9 s) verfolgt
  weiter; `locked` (letzte `lockAtS` = 0,4 s) friert die Richtung ein
  (`tank.turret` wird nicht mehr aktualisiert -- Turmzeile explizit auf
  `lance.mode !== 'locked'` bedingt). Einzige Abbruchbedingung in JEDER
  Ladephase: Sichtlinienverlust (`!clearLine(...)`, wortgetreu laut Auftrag)
  -- kein Kegel-Zwang mehr waehrend des Ladens, ein Abbruch setzt sofort auf
  `idle`/`timer:0` zurueck (kein Teilfortschritt). Nach vollem Aufladen
  feuert es GENAU EINMAL ueber den normalen `fireBullet()`-Pfad (`pierce: 2`
  war schon seit Nekromant-V2 Phase 2 in der Whitelist, `bulletSpeed: 700`
  ebenso bestehend -- **keine** neue Munitionslogik) und pausiert `pauseS`
  (2,4 s). Telegraph: `drawLanceAim()` -- eine Linie in Turmrichtung, IMMER
  sichtbar (nicht ueber `data/options.json: aimLine` abschaltbar, dieselbe
  Regel wie der Moerser-Telegraph), gestrichelt waehrend `charging`,
  durchgezogen+kraeftiger ab `locked`.
- **Trap-1-Sicherheitsnetz `weapon: null`**: `t_rusher`/`t_dud` haben keine
  Waffe, waeren aber ueber den bestehenden `acc<=0`-Zufallsschwenk-Zweig
  (`targetInSight()` kennt kein Waffenfeld) trotzdem als "will feuern"
  durchgekommen -- `roleTurret()` hat jetzt an BEIDEN Stellen, an denen es
  `true` haette liefern koennen (der `acc<=0`-Zweig und der finale
  Erfolgspfad), ein `if (!cfg.weapon) return false;`-Gate. Turmdrehung
  bleibt in beiden Faellen kosmetisch erhalten, nur der Feuerwunsch wird
  unterdrueckt.
- **Ist-Abgleich-Korrektur waehrend des Baus**: der Plantext verlangt fuer
  die Raumvorschau-Beschreibung `data/glossary.json` -- direkte Pruefung von
  `src/ui/preview.js` zeigt, dass `label`/`desc` schon immer DIREKT aus
  `tanksData.types[type]` gelesen werden; `glossary.json` ist ein
  unabhaengiges, spaeteres Feature (Kartentext-Begriffs-Hervorhebung im
  Upgrade-Screen). Fix: die vier neuen `label`/`desc`-Felder in
  `data/tanks.json` reichen aus, kein `glossary.json`-Eintrag noetig
  (Regel 1 aus dem Bauplan: technische Fakten des Codes gewinnen).
- **Sprite-Aliase statt neuer Dateien** (Plan-Vorschlag uebernommen):
  `t_rusher→t_brown`, `t_dud→t_black`, `t_shotgun→t_pink`, `t_lance→t_teal`
  (`sprites.js: SPRITE_ALIAS`). Identitaet traegt vollstaendig Verhalten +
  die vier neuen Telegraphen.
- **Ein echter Mechanismus-Fund beim eigenen Testbau** (kein Code-Bug, aber
  ohne den Fund waere `ramDrive()` einen Tick "hinter" der Anzeige
  hergelaufen): der Ausloese-Tick (Uebergang `seek`→`windup`) fiel bei der
  ersten Fassung durch einen unbedingten `return null;` am Blockende --
  `ai.js` liess in genau diesem einen Tick noch die normale Rollen-
  Fahrfunktion (einen winzigen Schritt Richtung Ziel) durchlaufen, bevor der
  Windup-Stillstand erst ab dem naechsten Tick griff. Fix: der Trigger-Zweig
  gibt jetzt sofort `{x:0,y:0}` zurueck, sobald er auf `windup` umschaltet.
- **Zwei Gegenproben-Fallstricke im eigenen Testaufbau gefunden und
  behoben** (nicht im Code): (1) "hoechstens ein Treffer pro Sturm" blieb
  auch OHNE den `hitTargets`-Waechter gruen, weil der (unveraendert
  bleibende) Rueckstoss (`pushPx: 60`) den Spieler schon nach dem ersten
  Treffer aus dem Ueberlappungsradius schiebt -- der Test wurde blind
  gefuehrt, nicht der Mechanismus. Fix: der isolierte Testfall setzt
  `pushPx: 0` fuer diesen einen Fall, danach faengt die Gegenprobe den
  entfernten Waechter zuverlaessig (300 statt 20 Schaden). (2) "kehrt nach
  Erschoepfung/Pause zu seek/idle zurueck" schlug zunaechst fehl, weil der
  Spieler in Trefferreichweite blieb und der Zustand sofort wieder in
  `windup`/`charging` umschaltete -- kein Bug, sondern gewolltes Verhalten
  (`seek`/`idle` re-triggern sofort, wenn das Ziel weiter in Reichweite
  ist). Fix: der Testaufbau bewegt den Spieler fuer diesen Prüfschritt weit
  weg, um den Zwischenzustand ueberhaupt beobachten zu koennen.
- **Neuer Testabschnitt 70** (`tests/regression.mjs`, Gegenprobe fuer jeden
  Kernpunkt einzeln bestanden -- je einzeln absichtlich rot gemacht und
  zurueckgesetzt, Checkpoint-Commit VOR den Experimenten diesmal beachtet:
  beide `weapon:null`-Gates einzeln entfernt, `hitTargets`-Verfolgung
  entfernt, Wandkontakt-Abbruch in `moveRamSubsteps()` entfernt, Turm-
  Einfrieren waehrend `locked` entfernt, Sichtverlust-Abbruch in
  `chargeTurret()` entfernt, `fireWindupS`-Gate entfernt, `killTank()`s
  `deathBlast`-Hook deaktiviert, `updateDeathFuses()`-Tick-Aufruf entfernt):
  Struktur (alle vier Typen + Akt-2-Freischaltung), beide `weapon:null`-
  Gates einzeln, `ramDrive()`s volle Zustandskette (Trigger, eingefrorene
  Richtung trotz Zielbewegung, Einzeltreffer, Wandkontakt-Stop, Erschoepfung,
  Rueckkehr zu `seek`), `fireWindupS` mit exakter Tickzahl + Reset bei
  Sichtverlust, `chargeTurret()`s volle Zustandskette (Kegel-Start,
  `charging`→`locked`-Uebergang, eingefrorene Richtung, Schuss, Pause,
  Ruecksprung zu `idle`, LOS-Abbruch OHNE Kegel-Zwang) + End-zu-Ende-Beweis,
  dass der abgefeuerte Schuss wirklich `pierce`/`bulletSpeed` aus `cfg`
  traegt (`Math.hypot(vx,vy)`, Bullet-Objekte speichern kein rohes
  `speed`-Feld), `t_dud`s vollstaendige Kette (killTank()-Hook →
  `deathFuses`-Eintrag → Detonation exakt nach `fuseS` → Aufraeumen →
  Schaden an Spieler UND einem unbeteiligten Nachbargegner).
- **Schlechtester Frame** (Grundregel, G2 fuegt Entitaeten hinzu): Acht-
  Gegner-Raum (2× je neuer Typ) vs. eine gleich grosse Baseline aus acht
  Bestandstypen, 600 Ticks, drittgroesster Wert (Projektkonvention):
  Baseline **2,070 ms**, G2-Raum **1,122 ms** (Budget 6 ms) -- die vier
  neuen Verhalten sind nicht teurer als die ersetzten Bestandsverhalten.
Kein `sw.js`-Bump (reine Code-/Datenaenderung, keine neuen Asset-Dateien --
alle vier Typen aliasen auf vorhandene Sprites, alle vier Sounds sind
Wiederverwendungen aus `data/sounds.json`).

**Phase G3 (Akt 2, Welle 2) ist gebaut.** Zwei Gegner, beide ohne neue
Architektur -- sie aktivieren nur, was G1 bereits als Infrastruktur gebaut
hatte (Baustein A: `tank.auraFlags`; Baustein B: `state.tankLinks`), und
liefern den ersten ECHTEN Erzeuger fuer beide.
- **`t_relay`** (Horcher, 5 Punkte, Raum 5): `state.relaySight` -- EIN
  globaler, pro Tick berechneter Boolean (state.js, Vorberechnung ganz am
  Anfang von `stepState()`, vor der Panzer-Schleife), `true`, sobald
  IRGENDEIN lebender Horcher innerhalb `sightRelay.rangePx` (520) eine freie
  Sichtlinie (`clearLine()`) zu seinem eigenen aufgeloesten Ziel
  (`resolveTarget()`, meist der Spieler) hat. Gelesen an GENAU einer Stelle
  in `ai_turrets.js: roleTurret()`s LOS-Gate: statt bei fehlender eigener
  Sichtlinie sofort `false` zurueckzugeben, prueft die Funktion zuerst
  `state.relaySight` -- ist er wahr, feuert der Verbuendete trotzdem, mit
  seiner EIGENEN `accuracy`/seinem eigenen Kegel (die Pruefungen davor sind
  schon bestanden, nur die Sichtlinien-Pflicht selbst wird umgangen).
  `tank.relayAssisted` (neu, Reset-Muster wie `auraFlags`, in derselben
  Vorberechnungs-Schleife in state.js) markiert genau diesen Fall fuer den
  Renderer -- "der sieht mich" vs. "der wird eingewiesen" bleibt dadurch
  unterscheidbar. Bewegungsverhalten bleibt bewusst der normale `sapper`
  (kein eigenes "Sichtlinien-statt-Deckung-Suchen" gebaut -- dokumentierte
  Vereinfachung, s. u.).
- **`t_anchor`** (Anker, 7 Punkte, Raum 8): `suppressField: {radiusPx:160,
  noFlank:true, noExecute:true}` -- Baustein A bekommt seinen ersten echten
  Setzer. Eine neue Vorab-Sammlung `suppressors` (alle lebenden Panzer mit
  `cfg.suppressField`) wird VOR der bestehenden Aura-Reset-Schleife gebaut;
  innerhalb dieser Schleife markiert jeder Anker alle Panzer in seinem
  Radius **inklusive sich selbst** (Distanz 0 ≤ radiusPx trifft immer zu) --
  mehrere Anker OR-en sich zusammen. Wirkt STRUKTURELL nie auf Geister (die
  stehen nie in `state.tanks`, kein Ausschluss-Code noetig). Die beiden
  Lesepunkte (Flankenfaktor, Exekutionsflag) existierten bereits seit G1 als
  wirkungslose No-ops -- G3 musste dort nichts anfassen.
- **"geankert ×1.0" statt stummer Unterdrueckung**: die bestehende
  `flankZoneHit`-Berechnung klemmt bei `auraFlags.noFlank` schon auf
  `'front'` -- ein unterdrueckter Seiten-/Hecktreffer haette dadurch OHNE
  weitere Aenderung gar KEINE Rueckmeldung mehr gezeigt (der bestehende Text-
  Block feuert nur bei `flankZoneHit !== 'front'`). Neue, separate
  `rawFlankZone` haelt die ECHTE Einschlagsgeometrie fest (ungeklemmt); ein
  Treffer mit `rawFlankZone !== 'front' && auraFlags.noFlank` zeigt
  "geankert ×1.0" (violett) statt der normalen "Seite/Heck ×N"-Meldung --
  "die Regel wird im Moment ihrer Wirkung erklaert" (Designtabelle 7.5).
- **`state.tankLinks` bekommt seinen ersten Reset**: G1 hatte das Array nur
  bei Raumerstellung geleert, nie pro Tick -- ohne einen echten Erzeuger war
  das folgenlos. G3 fuegt `state.tankLinks.length = 0;` direkt vor der neuen
  `relaySight`-Vorberechnung ein (dieselbe Stelle, an der der Lichtfaden bei
  aktiver Sichtlinie gepusht wird) -- ein Fund, der ohne einen echten
  Erzeuger nie sichtbar geworden waere.
- **Zwei neue, sehr kleine Renderer-Marker** (`renderer.js: drawTank()`,
  eigener Radius `r+32`, kollidiert nie mit den Affix-Punkten bei `r+26`):
  eine kleine violette Raute ("Ankersymbol") fuer jeden Panzer mit
  `auraFlags.noFlank||noExecute`, ein pulsierender gelber Punkt fuer
  `relayAssisted`. Kein neues Sprite noetig. Der Anker-Bodenring
  (`effects.js: drawAnchorFields()`, NEU, bewusst KEINE Wiederverwendung von
  Baustein C -- "permanent, aendert sich nie" ist das Gegenteil von
  Baustein C's wachsender Gefahrenflaeche) wird ganz frueh im Renderpfad
  gezeichnet (direkt nach `drawFloor()`/`tracks.draw()`, unter allem
  anderen).
- **Bewusste Vereinfachung gegenueber der Designtabelle**: `t_relay` soll
  laut Designtext aktiv "Sichtlinien suchen, nicht Deckung" (Korridorenden,
  Freiflaechenraender) -- eine eigene, `coverDrive()`-inverse Fahrfunktion
  waere technisch machbar (dieselbe Ray-March-Technik, nur die Bedingung
  umgedreht), wurde aber in dieser Sitzung NICHT gebaut. Der normale
  `sapper` (niedrige Aggression, wandert) traegt das Kernversprechen (die
  `relaySight`-Mechanik selbst) bereits vollstaendig; das gezielte
  Positionierungsverhalten ist reine Verhaltens-Politur ohne eigenen
  Testwert und bleibt ein offener Punkt (s. To-do-Liste).
- **Sprite-Aliase statt neuer Dateien**: `t_relay→t_grey` ("helles
  Gelbgrau"), `t_anchor→t_purple` ("dunkles Violettgrau") -- naechstliegende
  Bestandsfarben.
- **Ein echter Testaufbau-Fallstrick gefunden und behoben** (kein Code-Bug):
  der erste Entwurf von Testschritt (f) verglich `state.tankLinks[0].x0`
  NACH `stepState()` gegen `relay.x` (ebenfalls NACH `stepState()` gelesen)
  -- da `t_relay` Rolle `sapper` ist und dadurch auch in einem einzigen Tick
  ein winziges Stueck wandert, lag die im PRE-PASS (Tickanfang) festgehaltene
  Linien-Position bereits ein Sub-Pixel-Stueck von der POST-TICK-Position des
  Panzers entfernt -- der Test schlug fehl, obwohl der Mechanismus korrekt
  arbeitete. Fix: gegen die literalen Startkoordinaten pruefen statt gegen
  den Panzer nach der Bewegungsphase.
- **Neuer Testabschnitt 71** (`tests/regression.mjs`, Gegenprobe fuer jeden
  Kernmechanismus einzeln bestanden -- je einzeln absichtlich rot gemacht und
  zurueckgesetzt: `relaySight`-Bypass in `roleTurret()` entfernt,
  `suppressField`-Anwendung in state.js entfernt, der "geankert"-Textzweig
  isoliert deaktiviert (bestaetigt: (d) bleibt gruen, nur (e) faellt --
  Mechanismus und Rueckmeldung sind unabhaengig geprueft), `tankLinks`-Reset
  entfernt, `rangePx`-Grenze aus der `relaySight`-Berechnung entfernt):
  Struktur (beide Typen + Akt-2-Freischaltung), `state.relaySight` mit
  Reichweiten-/Sichtlinien-Grenzfaellen, `roleTurret()`s Bypass +
  `relayAssisted`-Markierung (inkl. Kontrolle: echte eigene Sichtlinie setzt
  `relayAssisted` NICHT), `t_anchor`s Suppress-Feld (inkl. Selbstmarkierung
  und Geister-Ausschluss), die "geankert ×1.0"-Rueckmeldung End-zu-Ende ueber
  einen echten Treffer (Kontrolle: ohne Anker die normale Seiten-Meldung),
  `state.tankLinks`-Reset + Erzeugung ueber einen echten `stepState()`-Tick.
- **Schlechtester Frame** (Grundregel): Acht-Gegner-Raum (4× je neuer Typ)
  vs. Baseline aus acht Bestandstypen, 600 Ticks, drittgroesster Wert:
  Baseline **2,092 ms**, G3-Raum **0,792 ms** (Budget 6 ms).
Kein `sw.js`-Bump (reine Code-/Datenaenderung, keine neuen Asset-Dateien).

**Phase G4 (Kompositionssystem) ist gebaut.** Laut Auftrag "das eine
System, das das Projekt wirklich braucht" (UMBAUPLAN-GEGNER.md Abschnitt
17.3) -- ohne dieses System sind die in `docs/AUFTRAG-GEGNERDESIGN.md`
Abschnitt 11-13 entworfenen Kompositionen/Encounter nicht erzeugbar, weil
`buyEnemies()` bis dahin rein zufaellig aus allen freigeschalteten Typen
zog. Vier Bausteine, alle in `src/game/run.js: buyEnemies()`:
- **`maxPerRoom` tatsaechlich belegt**: `t_anchor`/`t_relay` (bereits G3)
  tragen jetzt `maxPerRoom: 1` in `data/difficulty.json`. Der Mechanismus
  selbst existierte seit Phase 4 im Code ("hoechstens ein Prisma pro Raum"),
  wurde aber nie von einem Typ GESETZT -- G4 ist der erste echte
  Mechanismus-Nachweis mit einem tatsaechlich gesetzten Wert.
- **Kompositionstabelle `data/compositions.json`** (neu, an `diffData
  .compositions` angehaengt -- main.js UND tests/regression.mjs laden sie
  identisch, Muster wie `upgrades_necro.json`/`glossary.json`):
  `buyEnemies()` versucht zuerst `pickComposition()` (neu, in `run.js`) --
  eine Komposition passt, wenn `actIndex`/`minRoom` stimmen, alle genannten
  Typen an dieser Stelle bereits freigeschaltet sind UND ihre Punktsumme
  zwischen der Haelfte und dem vollen Raumbudget liegt
  (`COMPOSITION_MIN_BUDGET_FRACTION: 0.5`, Struktur-Konstante wie
  `EARLY_LAYERS`, keine Balance-Zahl -- sonst wuerde ein fruehes
  Niedrigbudget-Rezept auch in einem spaeten, viel groesseren Raum feuern
  und ihn spuerbar leerer wirken lassen). Unter mehreren passenden
  Kompositionen entscheidet eine gewichtete Ziehung (`weight`-Feld,
  `pickWeighted()`). **Genau EIN zusaetzlicher `rng()`-Aufruf, NUR wenn
  wirklich eine Komposition feuert** -- ein Aufruf ohne `comps` (der
  Boss-Unterstuetzungskauf, aeltere Tests) bleibt dadurch bit-identisch zum
  Vor-G4-Stand. Fuenf Erst-Rezepte (`a1_erste_beruehrung`/`a2_freies_feld`/
  `a5_der_zeuge`/`a7_fundmunition`/`a8_standhaft`), den gleichnamigen A1/A2/
  A5/A7/A8-Encountern aus dem Designdokument nachgebaut -- bewusst nur
  Kompositionen, die ausschliesslich bereits gebaute Akt-2-Gegner nutzen
  (`t_medic`/`t_mason` folgen mit G5). **Ein Abgleich gegen die echte
  `acts[1].budget`-Formel war noetig**: A7 ("Fundmunition", Designtext
  nennt Raum 3/16 Punkte) passt beim echten `base:6/perRoom:2.6` erst ab
  Raum 4 (Budget 16,4) ins Fenster -- `minRoom` entsprechend gesetzt, statt
  den Designtext blind zu uebernehmen.
- **Mindestpunktzahl ab Akt 2** (O2): ein Typ mit `points < budget/12` wird
  im Zufalls-Rueckfall nicht mehr gekauft -- entfernt die
  `t_brown`/`t_grey`-Verstopfung bei grossen Budgets, OHNE die Typen zu
  loeschen (bleiben fuer Akt 1 und fuer Kompositionen, die sie ausdruecklich
  nennen). Bewusst NICHT in Akt 1 (dort sind sie das einzige Fuellmaterial,
  O2-Befund).
- **`acts[].minRoleQuota`** (optional, Abschnitt 17.3 Punkt 2): "mindestens
  1 Gegner mit Rolle X, wenn Budget >= N" -- wirkt nur auf den
  Zufalls-Rueckfall (Kompositionen sind bereits handkuratiert). Akt 3 traegt
  `{role: "hunter", minBudget: 30}` als erste Instanz (greift real erst ab
  G6, wenn `t_bulwark`/`t_stalker` existieren). `buyEnemies()` bekommt dafuer
  einen neuen, optionalen `typeDefs`-Parameter (`tanksData.types`, fuer die
  Rollenauflosung -- `diff.danger` kennt keine Rolle) -- ohne ihn (aeltere
  Aufrufe) bleibt die Quote wirkungslos, kein Absturz.
- **Boss-Unterstuetzungskauf bleibt bewusst aussen vor**: der `isFinal`-Zweig
  ruft `buyEnemies()` weiterhin mit der alten 5-Argument-Form auf -- der
  handgebaute Bosskampf soll nicht durch ein zufaellig treffendes Rezept
  veraendert werden.
- **Neuer Testabschnitt 72** (`tests/regression.mjs`, alle Mechanismen mit
  EIGENEN synthetischen Daten geprueft, nicht den echten `difficulty.json`-
  Werten -- Gegenprobe fuer jeden Kernpunkt einzeln bestanden, je absichtlich
  rot gemacht und zurueckgesetzt): Struktur (Kompositionsschema, `maxPerRoom`
  auf `t_anchor`/`t_relay`, `minRoleQuota` auf Akt 3), `pickComposition()`s
  volle Gate-Kette (actIndex/minRoom/Budgetfenster ober+unter/Freischaltung/
  `maxEnemiesPerRoom`-Deckel) inkl. RNG-Verbrauch (0 zusaetzliche Aufrufe
  ohne Treffer, genau 1 mit Treffer), Mindestpunktzahl (Akt 1 unveraendert,
  Akt 2 schliesst billige Typen bei grossem Budget aus), `minRoleQuota`
  (Pflichtrolle erscheint in JEDEM von 40 Seeds ab `minBudget`), `maxPerRoom`
  im Zufalls-Rueckfall, und ein Ende-zu-Ende-Nachweis mit den ECHTEN Daten
  (main.js-aequivalente Verdrahtung `diffData.compositions`) an Akt 2/Raum 8.
  **Zwei echte Testaufbau-Fallstricke gefunden und behoben** (kein Code-Bug):
  (1) der erste `maxEnemiesPerRoom`-Gegenprobentest scheiterte schon am
  Budgetfenster, bevor er den Deckel je erreichte (10 Einheiten a 2 Punkte
  bei Budget 100 lagen unter der 50%-Untergrenze) -- korrigiert auf Werte,
  die das Budgetfenster treffen UND den Deckel ueberschreiten; (2) die erste
  `minRoleQuota`-Pruefung nutzte nur zwei gleich wahrscheinliche Typen und
  blieb TROTZ ausgebauter Quote gruen (bei 5 Kaufslots trifft der reine
  Zufall "irgendein Seed von 40" ohnehin fast immer) -- auf drei Typen (nur
  einer traegt die Pflichtrolle) umgestellt und die Zusicherung von
  "kommt irgendwo vor" auf "kommt in JEDEM Seed vor" verschaerft, mit einem
  Kontrollfall unter `minBudget`, der beweist, dass reiner Zufall dort
  tatsaechlich manchmal fehlt (sonst waere auch die verschaerfte Zusicherung
  wertlos gewesen).
- **Kein schlechtester-Frame-Vergleich** (Grundregel gilt fuer neue
  Entitaeten/Tick-Kosten): `buyEnemies()` laeuft einmalig beim Raumaufbau,
  nicht pro Tick -- G4 aendert nichts an der Simulationsschleife.
- `sw.js` auf `v123` gebumpt (`data/compositions.json` neu in `ASSETS`),
  `telemetry.js: GAME_VERSION` mitgezogen.

**Phase G5 (Akt 2, Welle 3) ist gebaut.** Die letzten zwei der acht
Akt-2-Gegner -- damit ist Akt 2 vollstaendig.
- **`t_medic`** ("Der Zehrer", 6 Punkte, ab Raum 6): repariert dauerhaft
  GENAU EINEN Verbuendeten -- den am staerksten beschaedigten in
  `heal.rangePx` (220) mit freier Sichtlinie, 6 LP/s, gedeckelt auf
  `maxHp`. Kein neues System noetig: `heal` stand seit G1 bereits in der
  `resolveCfg()`-Whitelist, der Heilstrahl laeuft ueber Baustein B (G1,
  `state.tankLinks`, dasselbe generische `drawTankLinks()` wie beim
  Horcher-Lichtfaden). Neue Funktion `state.js: updateMedics()` (Muster
  `updateDeathFuses()` -- kein eigenes Modul, der ganze Mechanismus ist ein
  Blick auf `state.tanks` je Tick), in `stepState()`s Tick-Kette verdrahtet.
  "Heilt nur echte Panzer, keine Geister" ergibt sich strukturell (Geister
  stehen nie in `state.tanks`).
- **`t_mason`** ("Der Maurer", 6 Punkte, ab Raum 7, `maxPerRoom:1`): baut
  alle `build.everyS` (5 s) eine zerstoerbare Wand (3 Treffer) auf eine
  freie Bodenzelle ~120 px zwischen sich und seinem Ziel, 0,8 s sichtbarer
  Geruest-Telegraph davor, hoechstens `maxAlive` (6) eigene Waende
  gleichzeitig, jede verfaellt nach `decayS` (20 s) von selbst -- unabhaengig
  von Treffern (eine INSTANTANE Entfernung, kein `destroyWall()`-Aufruf,
  der zaehlt Treffer statt sofort zu entfernen). Wiederverwendet
  `state.placeTrapWall()` (Phase 6, bisher nur vom Spieler-Gadget genutzt)
  fuer die eigentliche Platzierung -- **dessen Rueckgabewert war bisher ein
  reiner Boolean (`true`/`false`)**, musste aber auf die WAND-REFERENZ
  selbst umgestellt werden (`return wall` statt `return true`), damit
  `t_mason` sie mit `masonExpiresAt` markieren kann; der einzige
  Bestandsaufrufer (`tank.js: placeTrapWall()`, reicht das Ergebnis nur als
  `used`-Wahrheitswert weiter) funktioniert mit einem Objekt statt `true`
  unveraendert, weil beide truthy sind.
- **"Sicherung gegen Frust"**: neue Methode `state.wouldIsolateArea(col,
  row)` -- eine kleine, freistehende BFS (`bfsReachable()`, Modul-Ebene,
  dasselbe Solid-Kriterium wie `isSolid()`) vergleicht die vom Spieler aus
  erreichbare Flaeche vor/nach einer hypothetischen Wand an `(col,row)`
  (Grid-Zeichen kurz auf `'#'` gesetzt, sofort zurueckgesetzt) -- **genau
  der in `UMBAUPLAN-GEGNER.md` Fund 15 vorhergesagte einzige echte Neubau**
  dieser Welle: `generator.js: reachableCells()` arbeitet auf dem
  STATISCHEN Generierungs-Grid, nicht auf `state.js`s Laufzeit-Grid. Dafuer
  ist `grid` (bis dahin rein Closure-lokal) jetzt zusaetzlich als
  `state.grid` exponiert (Muster wie `state.walls`) -- `t_mason`s
  Zellenwahl braucht Lesezugriff auf das EXAKTE Zeichen (`'.'` = frei),
  nicht nur einen Boolean.
- Weitere Sicherungen in `updateMasons()`: `minPlayerDistCells` (2, per
  Chebyshev-Distanz in Zellen) verhindert eine Wand zu nah am Spieler,
  Tank-Ueberlappung an der Zielzelle verhindert eine Wand auf einem
  besetzten Feld. Waehrend der 0,8-s-Bauzeit steht der Maurer still (neuer
  `masonMove`-Zweig in `ai.js: updateEnemy()`, Muster wie G2s `ramMove` --
  Vorrang vor Deckungssuche/Rollen-Fahrfunktion, Turm bleibt unangetastet).
- **Renderer**: `effects.js: drawMasonScaffolds()` (neu, in `renderer.js`
  nach `drawWalls()` eingehaengt) -- bewusst KEINE Wiederverwendung von
  Baustein C (`drawGrowingRingTelegraph`/`drawCorridorTelegraph`, das sind
  wachsende Kreis-/Korridor-Gefahrenflaechen): ein statisches, gestricheltes
  Quadrat auf genau einer Zelle ist eine andere Aussage ("hier entsteht
  bald eine feste Wand", keine Schadenszone).
- **Kompositionen nachgetragen** (`data/compositions.json`, G4 baute den
  Mechanismus bereits): vier weitere Rezepte (A4/A6/A9/A10 aus dem
  Designdokument), A10 als flache Vereinigung beider Wellen statt einer
  1:1-Nachbildung (der bestehende generische Wellen-Split greift von
  selbst). **Zwei echte, bislang stille Fehler in den G4-Kompositionen
  gefunden und behoben** (kein Test hatte das je geprueft -- der neue
  Testabschnitt unten deckt jetzt genau diese Fehlerklasse ab): `a5_der_zeuge`
  hatte 9 statt hoechstens 8 Einheiten (`maxEnemiesPerRoom`-Ueberschreitung,
  `pickComposition()` haette sie NIE gezogen), `a2_freies_feld` nannte
  `t_yellow` bei `minRoom:4`, obwohl der Typ dort erst ab Raum 5 freigeschaltet
  ist -- beide waren dadurch faktisch tote Daten, ohne dass ein Test das
  bemerkt haette.
- **Neuer Testabschnitt 73** (`tests/regression.mjs`, Gegenprobe fuer jeden
  Kernpunkt einzeln bestanden -- je absichtlich rot gemacht und
  zurueckgesetzt: Staerkevergleich/Heildeckel/Reichweite/Sichtlinie/
  Heilstrahl-Eintrag bei `t_medic`, `minPlayerDistCells`/die
  `wouldIsolateArea()`-VERDRAHTUNG in `updateMasons()` (nicht nur die
  freistehende Methode)/`maxAlive`/Verfall/Bewegungssperre/Wandhaltbarkeit
  bei `t_mason`): Struktur, `t_medic`s Zielauswahl+Deckel+Reichweite+
  Sichtlinie+Telegraph, `t_mason`s kompletter Baukreislauf (Geruest -> echte
  Wand mit korrekter Haltbarkeit -> Bewegungssperre waehrenddessen),
  `minPlayerDistCells`, die Engpass-Sicherung (isoliert UND end-to-end ueber
  einen echten Baukreislauf), `maxAlive` + Verfall (in ZWEI GETRENNTEN
  Szenarien, s. u.), und eine erweiterte G4-Struktur-Pruefung (s. u.).
  **Fuenf echte Testaufbau-Fallstricke gefunden und behoben** (kein
  Code-Bug, reine Testkonstruktion): (1) `t_medic`/`t_grey` sind Rolle
  "sapper" und wandern -- ueber viele Ticks laufen sie aus `heal.rangePx`
  heraus, der erste Testentwurf mass dadurch einen Heilstillstand, der
  nichts mit dem Code zu tun hatte; (2) die Trefferschleife kennt kein
  Teamsystem -- der Zehrer traf mit seiner EIGENEN Waffe (25 Schaden) einen
  nur 10 px entfernten "Verbuendeten" fast sofort; beide behoben ueber einen
  neuen `freeze()`-Testhelfer (`role:'guardian'`, `weapon:null`, laesst
  `heal` unangetastet); (3) `updateEnemy()` liefert `{move:{x,y}, fire,
  mine}`, nicht die Bewegung direkt -- ein erster Testentwurf griff auf
  `move.x` statt `move.move.x` zu und haette JEDE Bewegung als "still"
  gelesen; (4) die "am staerksten beschaedigt"-Auswahl-Pruefung blieb bei
  einer entfernten Vergleichsbedingung unbemerkt gruen, weil die Testtanks
  zufaellig in der richtigen Reihenfolge (`[medic, near, far]`) im Array
  standen und der letzte Kandidat ohnehin gewann -- auf `[medic, far,
  near]` umgestellt, damit die Auswahl wirklich nach Schadensbetrag
  entscheidet, nicht nach Listenposition; (5) `maxAlive` und Verfall
  (`decayS`) liessen sich im selben, mit kurzem `everyS` UND kurzem
  `decayS` beschleunigten Szenario nicht unabhaengig pruefen -- die erste
  Wand verfiel bereits von selbst, bevor der `maxAlive`-Check greifen
  konnte, ein entfernter Deckel fiel dadurch nie auf; in zwei komplett
  getrennte Szenarien aufgeteilt (g1: `decayS` unerreichbar gross, testet
  nur den Deckel; g2: hohes `maxAlive`, testet nur den Verfall).
  Die G4-Struktur-Pruefung (Abschnitt 72 (a)) ist um eine Nachrechnung der
  ECHTEN `acts[1].budget`-Formel + jedes Typ-`unlockRoomInAct` fuer JEDE
  Komposition erweitert -- genau der Mechanismus, der die beiden oben
  genannten G4-Fehler beim Bau von G5 aufgedeckt hat.
- **Schlechtester Frame** (Grundregel): Acht-Gegner-Raum (4x je neuer Typ)
  vs. Baseline aus acht Bestandstypen, 600 Ticks, drittgroesster Wert:
  Baseline **1,596 ms**, G5-Raum **1,042 ms** (Budget 6 ms).
- Kein `sw.js`-Bump (reine Code-/Datenaenderung, keine neuen Asset-Dateien).

**Phase G6 (Akt 3, Welle 1) ist gebaut.** Die vier "konservativen"
Akt-3-Gegner (Designdokument Abschnitt 8.1-8.4) -- keiner brauchte eine neue
Kernarchitektur, drei der vier sind praktisch reine Datenuebernahme.
- **`t_bulwark`** (Bollwerk, 8 Punkte, ab Raum 1): grosser Kollisionsradius
  (`radius: 22`, seit dem Amboss-Auftrag als generisches `cfg.js`-Feld
  moeglich) + eine nicht reflektierende 160°-Frontpanzerung
  (`armor: { arc: 160, reflects: false }`). **Beides war schon VOR G6
  vollstaendig implementiert** (`armor.js: armorBlocks()` +
  `state.js: if (t.cfg.armor?.reflects) reflectBullet(...); else b.dead =
  true;`, PLAN.md v2 Phase 4) -- nur kein einziger Bestandstyp hatte je
  `reflects: false` gesetzt, der Pfad war seit jeher ungetestet. G6 aktiviert
  ihn zum ersten Mal: ein Fronttreffer richtet keinen Schaden an UND die
  Kugel stirbt, OHNE zurueckzuprallen; von hinten (200° ungeschuetzt) gilt
  der normale Heckbonus (2,5x). **Null neuer Code** ausser dem `tanks.json`-
  Eintrag + Sprite-Alias.
- **`t_marshal`** (Feldwebel, 9 Punkte, ab Raum 3): Feuerraten-Aura --
  jeder Verbuendete mit freier Sichtlinie zu ihm feuert 30 % schneller
  (`rally: { fireRateMult: 0.7, needsLos: true, maxTargets: 6 }`). Aktiviert
  **Baustein A** (`tank.auraFlags.fireRateMult`, seit G1 in
  `tank.js: fireBullet()` verdrahtet, aber bis G6 ein wirkungsloser No-op
  ohne Setzer) zum ersten Mal wirklich. Neuer, eigener Durchlauf in
  `state.js` (NACH dem bestehenden Aura-Reset, nicht darin, weil der
  `maxTargets`-Deckel PRO FELDWEBEL zaehlt statt pro Ziel): fuer jeden
  lebenden Feldwebel werden bis zu `maxTargets` Verbuendete mit
  `clearLine()`-Sichtlinie markiert (`t !== m`, `t !== state.player` --
  weder Selbst- noch Spielerverstaerkung), mehrere Feldwebel kombinieren
  sich ueber `Math.min()` (der staerkste Multiplikator gewinnt). Fahnenlinien
  ueber **Baustein B** (`state.tankLinks`, orange, pulsierend). Renderer:
  ein duenner pulsierender "orangener Saum" (Ring bei `r+4`) um jeden
  verstaerkten Gegner.
- **`t_stalker`** (Pirscher, 8 Punkte, ab Raum 5): distanzbasierte Tarnung
  -- unsichtbar (~15-20 % Deckkraft mit leichtem Flimmern, NIE 0 % --
  Designauflage "nie vollstaendig weg") ausserhalb `stalk.cloakBeyondPx`
  (220 px) vom aufgeloesten Ziel, IMMER sichtbar darunter. Enttarnung
  wiederverwendet den bestehenden `fireWindupS`-Mechanismus aus G2
  (`t_shotgun`): `t_stalker.fireWindupS === stalk.revealBeforeShotS`
  (0,6 s), und `ai_turrets.js: roleTurret()` setzt beim WINDUP-START (erster
  Tick eines frischen Windups, `!ai.windupTimer`) `tank.stalkRevealUntil =
  state.time + revealBeforeShotS + revealedS` (2,6 s Gesamtfenster). Die
  eigentliche Sichtbarkeitsberechnung (`t.stalkCloaked`) ist eine neue,
  reine Vorberechnung in `state.js`s bestehendem Pro-Tick-Reset-Durchlauf
  (Muster wie `relayAssisted`) -- Distanz UND Reveal-Fenster kombiniert, der
  Renderer liest nur noch das fertige Flag (kein zweiter `resolveTarget()`-
  Aufruf dort). Kettenspuren im Boden (`tracks.js`, bereits generisch fuer
  jeden Typ) sind der bestehende zweite Hinweiskanal, ohne neuen Code.
- **`t_arclight`** (Lichtbogen, 9 Punkte, ab Raum 4): sein Geschoss traegt
  `damageType: "lightning"` -- ein seit UMBAUPLAN-LP Phase 6 komplett
  gebautes, bislang **ausschliesslich von Spielerklassen** genutztes System
  (Kettensprung auf bis zu 2 weitere Ziele, 30 % Abfall je Sprung -- exakt
  die vorhandenen `data/status.json`-Standardwerte `maxTargets: 3`/
  `falloff: 0.7`, keine Datenaenderung noetig). **Null neuer Code**: die
  einzige Zeile ist `"damageType": "lightning"` im `tanks.json`-Eintrag --
  `tank.js: fireBullet()` schreibt `damageType: tank.cfg.damageType` bereits
  fuer JEDEN Schuetzen, nicht nur den Spieler.
- **Bewusst NICHT gebaut** (Designtext nennt sie unter "Zielauswahl"/
  "Telegraph", nicht unter "Kernmechanik" -- dieselbe Kategorie von
  Vereinfachung wie `t_relay`s fehlende aktive Sichtlinien-Suchfahrt aus G3):
  `t_arclight`s weiche Praeferenz "feuert bevorzugt bei 2+ Zielen in
  Sprungreichweite" (gegen einen Solo-Spieler ohne Geister waere ein HARTES
  Gate strukturell nie erfuellbar -- ein Solo-Spieler-Gegner, der nie feuert,
  waere ein Bug, kein Feature) und die "Vorschau-Bogen"-Telegraphie vor dem
  Schuss (der Ketten-Blitzbogen selbst wird bereits NACH jedem Treffer
  gezeichnet, `drawLightning`, unveraendert).
- **Sprite-Aliase statt neuer Dateien**: `t_marshal→t_green` (olivgruen),
  `t_bulwark→t_grey` (dunkles Stahlgrau, teilt sich die Farbe mit
  `t_relay`/`t_mason`), `t_stalker→t_black` (dunkel/verborgen, teilt sich mit
  `t_dud`), `t_arclight→t_teal` (naechstliegendes Blau, teilt sich mit
  `t_lance`) -- Identitaet traegt vollstaendig Verhalten + die neuen
  Telegraphen (Fahnenlinien/Frontbalken/Tarnalpha/Blitzbogen).
- **Ein echter Testaufbau-Fund per Gegenprobe** (kein Code-Bug): der erste
  Entwurf von `t_marshal`s "Spieler wird nie verstaerkt"-Pruefung platzierte
  den Spieler bei `(9999,9999)` -- "ausserhalb jeder Reichweite". Die
  Gegenprobe (expliziten Spieler-Ausschluss aus dem Code entfernt) blieb
  **gruen**: der Test scheiterte schon an der LOS-Pflicht, unabhaengig vom
  eigentlich zu pruefenden `t === state.player`-Filter. Fix: der Spieler
  steht jetzt in echter Reichweite MIT freier Sicht (nur der explizite
  Filter verhindert die Verstaerkung) -- danach faengt dieselbe Gegenprobe
  den Fehler zuverlaessig.
- **Ein zweiter Testaufbau-Fund, kein Code-Bug**: der erste Entwurf des
  `t_arclight`-Kettentests platzierte beide Ziele auf `(200,200)` -- eine
  Zelle, die im gewaehlten Seed zufaellig auf einer Wand liegt. Die Kugel
  starb dort am Wandkontakt, bevor sie je ein Ziel erreichte (beide Pruefungen
  schlugen fehl, aber aus dem falschen Grund). Fix: dieselbe bekannte offene
  Zelle `(200,250)` wie im `flankTreffer()`-Helfer aus Abschnitt 47.
- **Neuer Testabschnitt 74** (`tests/regression.mjs`, Gegenprobe fuer jeden
  Kernpunkt einzeln bestanden -- je einzeln absichtlich rot gemacht und
  zurueckgesetzt: `armor.reflects:false`-Pfad auf immer-reflektieren
  umgestellt, die komplette Feldwebel-Schleife deaktiviert, nur den
  `maxTargets`-Deckel entfernt, nur die LOS-Pflicht entfernt, nur den
  Spieler-Ausschluss entfernt, `tank.auraFlags?.fireRateMult`-Multiplikation
  in `fireBullet()` entfernt (roetet zusaetzlich einen BESTEHENDEN G1-Test --
  Bestaetigung, dass beide Tests denselben Mechanismus aus unabhaengiger
  Warte pruefen), die Tarnungs-Distanzbedingung UND das Reveal-Fenster je
  einzeln neutralisiert, den Enttarnungs-Ausloeser in `roleTurret()`
  deaktiviert, `damageType` von `t_arclight` entfernt bzw. auf `reflects:
  true` zurueckgesetzt): Struktur (alle vier Typen, `rally`/`armor`/`stalk`+
  `fireWindupS`-Konsistenz/`damageType`, Akt-3-Freischaltung), `t_bulwark`
  Front- vs. Hecktreffer Ende-zu-Ende, `t_marshal`s komplette Aura-Kette
  (Setzer, LOS-Pflicht ueber eine echte Wand, `maxTargets`-Deckel, Spieler-/
  Selbstausschluss, Fahnenlinie, End-zu-Ende-Beweis ueber echtes
  `tank.cooldown`), `t_stalker`s volle Zustandskette (getarnt/sichtbar an
  beiden Distanzgrenzen, Windup-Ausloeser setzt `stalkRevealUntil`, Fenster
  haelt die Tarnung offen, Rueckkehr nach Ablauf -- Bewegung/Feuern fuer die
  Mehrfach-Tick-Zeitmessung eingefroren, Fehlerklasse aus G5), `t_arclight`s
  Ende-zu-Ende-Kette von einem NICHT-spieler-eigenen Geschoss aus (kein
  Team-System, s. o.).
- **Schlechtester Frame** (Grundregel): Acht-Gegner-Raum (2x je neuer Typ)
  vs. Baseline aus acht Bestandstypen, 600 Ticks, drittgroesster Wert:
  Baseline **1,653 ms**, G6-Raum **1,358 ms** (Budget 6 ms).
- Kein `sw.js`-Bump (reine Code-/Datenaenderung, keine neuen Asset-Dateien --
  alle vier Typen aliasen auf vorhandene Sprites).

Damit sind alle acht in `docs/AUFTRAG-GEGNERDESIGN.md` als "konservativ"
eingestuften Gegner gebaut (vier je Akt). Fuenf "alternative" Mechaniken
bleiben fuer Akt 3 (`t_tether`/`t_harvester`/`t_metronom`/`t_grabber`/
`t_mason` ist bereits Akt 2 aus G5) -- die ersten zwei davon sind mit
**Phase G7** gebaut.

**Phase G7 (Akt 3, die ersten zwei "alternativen" Mechaniken) ist gebaut.**
`t_tether` (Kettenhund) und `t_harvester` (Verwerter) sind die ersten
Gegner im Spiel, deren Wert von einem ANDEREN Ereignis abhaengt (ein
Partner-Panzer bzw. ein Tod in der Naehe), nicht nur von sich selbst wie
alle bisherigen Typen.
- **`t_tether`** (Kettenhund, 5 Punkte je Stueck, ab Raum 2): bindet sich
  beim Raumaufbau an den naechstgelegenen noch ungebundenen Verbuendeten
  (bevorzugt einen zweiten Kettenhund, `preferSameType`) -- **immer
  MUTUAL** (beide zeigen aufeinander). Neue Funktion `state.js:
  bondTethers(tanks)` (exportiert, fuer direkte Tests), aufgerufen einmalig
  am Ende der Welle-1-Spawnschleife UND erneut nach einem Welle-2-Spawn
  (`updateWave()`), jeweils ueber den VOLLEN Bestand (nicht nur die neu
  gespawnten) -- ein ueberlebender unverbundener Welle-1-Kettenhund kann
  sich so noch mit einem neuen Welle-2-Kettenhund binden.
  - **Schadensteilung 50/50**: `state.js: applyDamage()` bekommt einen neuen
    Zweig GANZ AM ANFANG (nach den Boss-/Spider-Unverwundbarkeitsgattern,
    vor Resistenz/Schild) -- bei einem gebundenen Ziel wird der Betrag
    HALBIERT und ZWEIMAL rekursiv ueber `state.applyDamage()` angewandt
    (einmal auf das Ziel selbst, einmal auf den Partner), sodass jede Seite
    ihre EIGENE Abwehr (Resistenz/Schild/Panzerung des Partners) unabhaengig
    darauf anwendet. `meta.tetherSplit` verhindert die Ping-Pong-Rekursion
    (der Partner hat selbst wieder einen `tetherPartner`, der auf DIESEN
    Panzer zeigt) -- eine Gegenprobe ohne das Flag endet folgerichtig in
    `RangeError: Maximum call stack size exceeded`. "Split, nicht
    verdoppelt": der GESAMTSCHADEN bleibt gleich, nur auf zwei LP-Pools
    verteilt (6 Treffer a 10 Schaden = 60 gesamt = 30/30 bei maxHp 30 --
    beide sterben gleichzeitig, exakt die Designdokument-Rechnung).
  - **Bindung bricht DAUERHAFT** (kein Wiederverbinden) bei Wandkontakt oder
    ueber `breakDistPx` (260) -- neue Funktion `updateTethers(state)`
    (Muster `updateMedics()`/`updateMasons()` aus G5, eigener Aufruf in
    `stepState()`), prueft das JEDEN Tick unabhaengig von Schaden (eine
    reine Bewegungstrennung ohne jeden Treffer muss die Bindung genauso
    brechen koennen).
  - **Immer sichtbare Kette** ueber Baustein B (`state.tankLinks`, dick,
    rostbraun, kurzzeitig heller/dicker bei einem echten Split-Ereignis ueber
    `tank.tetherFlashUntil`) -- nur EINMAL pro Paar gepusht (`t.id <
    partner.id`), nicht von beiden Seiten.
  - **Standoff-Bewegung** (100-200 px Zielband, `t_tether.tether.
    standoffMinPx/standoffMaxPx` -- zwei Datenfelder ueber die im
    Designdokument genannten vier hinaus, gleiches Muster wie `t_mason.
    build`s zusaetzliche Felder in G5): neue `ai_drives.js:
    tetherStandoffDrive(tank, partner, tc)`, geometrisch ohne eigenen
    Zustandsautomaten (der Zustand IST die aktuelle Distanz) -- zu nah
    bewegt weg, zu weit bewegt hin, dazwischen `null` (kein Vorrang, normales
    Rollenverhalten laeuft weiter). Dispatch-Vorrang in `ai.js:
    updateEnemy()` VOR Deckungssuche/Rolle (Muster `ramMove`/`masonMove`).
  - **Echter Bugfund beim eigenen Testbau**: die erste Fassung von
    `bondTethers()` filterte den Kandidatenpool auf `t.cfg.tether` VOR der
    Suche -- ein Kettenhund ohne gleichartigen Partner in der Naehe konnte
    sich dadurch NIE an einen normalen Verbuendeten binden (der "faellt
    zurueck auf den naechsten Verbuendeten"-Pfad war komplett tot, seit dem
    allerersten Entwurf). Gefunden durch den regulaeren Testlauf (nicht erst
    per Gegenprobe), gefixt: der Kandidatenpool ist jetzt der VOLLE
    Panzerbestand, nur die "wer braucht eine Bindung"-Liste bleibt auf
    Kettenhunde beschraenkt.
- **`t_harvester`** (Verwerter, 10 Punkte, ab Raum 8): "stirbt ein Panzer
  ODER Geist in `radiusPx` (200) Umkreis, waechst er dauerhaft" -- neue
  state-Methode `applyHarvestGrowth(x, y, excludeTank)` (Muster
  `damageGhostsInRadius`/`registerAnvilRage`: als state-Methode, damit
  sowohl `state.js: killTank()` als auch `ghost.js: killGhost()` sie ueber
  das ohnehin vorhandene `state`-Argument aufrufen koennen), erhoeht
  `tank.cfg.maxHp`/`tank.cfg.damage` DIREKT (jeder gespawnte Panzer hat sein
  EIGENES, frisches `resolveCfg()`-Objekt -- verifiziert vor dem Bau, keine
  Gefahr von geteilten cfg-Referenzen zwischen zwei Verwerter-Instanzen) --
  `healOnStack:false` in den Daten heisst: der Zuwachs auf `maxHp` heilt
  NICHT, er macht nur zaeher fuer KUENFTIGE Treffer. Zwei Aufrufstellen:
  `killTank()`s Nicht-Spieler-Zweig (bewusst NICHT der Spieler-Zweig -- "wo
  sterben MEINE GEGNER" meint Feindtode, nicht den eigenen Tod, derselbe
  Zweig-Entscheid wie beim `t_dud`-`deathBlast`-Hook aus G2) und
  `killGhost()` (jede Todesart -- Schaden/Ablauf/Opfer, keine Einschraenkung
  im Designtext). Telegraph: statischer dunkelroter Bodenring
  (`effects.js: drawHarvestFields()`, Muster `drawAnchorFields()` aus G3)
  + eine kleine Zahlen-Marke ueber dem Panzer (`t.harvestStacks`, EINE Marke
  mit Zahl statt eines Punkts je Stapel -- waere bei hohen Stapelzahlen
  unlesbar).
- **Bewusst NICHT gebaut** (Designtext-Kategorie "Telegraph", nicht
  "Kernmechanik", dieselbe Vereinfachungsklasse wie bei G3/G6): der
  "Saugeffekt vom Sterbeort zum Verwerter" -- `state.tankLinks` wird JEDEN
  Tick komplett neu aufgebaut, ein mehrere Frames sichtbarer Effekt braeuchte
  ein eigenes, separates Array; ein kurzer Partikelstoss am Sterbeort steht
  stattdessen (bereits vorhanden ueber `spawnParticles`).
- **Sprite-Aliase statt neuer Dateien**: `t_tether→t_brown` (rostbraun,
  geteilt mit `t_rusher`), `t_harvester→t_pink` (naechstliegender roter
  Bestandston) -- Identitaet traegt vollstaendig Verhalten + die sichtbare
  Kette bzw. den Fressradius-Bodenkreis.
- **Neuer Testabschnitt 75** (`tests/regression.mjs`, Gegenprobe fuer jeden
  Kernpunkt einzeln bestanden -- je einzeln absichtlich rot gemacht und
  zurueckgesetzt: `preferSameType`-Praeferenz entfernt, der Kandidatenpool
  probeweise wieder auf den urspruenglichen Fehler zurueckgesetzt (bestaetigt
  den Bugfund), der ganze Split-Hook deaktiviert, der `tetherSplit`-
  Rekursionsschutz entfernt (endet in einem `RangeError` -- gilt als
  bestandene Gegenprobe, Muster aus fruehreren Sessions), Abstands- bzw.
  Wand-Bruchbedingung je einzeln entfernt, der Ketten-Link-Push deaktiviert,
  beide `tetherStandoffDrive()`-Zweige je einzeln entfernt, das gesamte
  Verwerter-Wachstum deaktiviert, nur der Radius-Ausschluss entfernt, nur
  die `healOnStack`-Bedingung entfernt (heilt dann immer), der
  `killTank()`-Hook entfernt, der Hook probeweise auch in den
  Spieler-Zweig kopiert (bestaetigt die Zweig-Entscheidung), der
  `killGhost()`-Hook entfernt): Struktur (beide Typen + Akt-3-Freischaltung),
  `bondTethers()`-Mechanismus (Praeferenz + Fallback, inkl. der Gegenprobe
  fuer den echten Bugfund), Schadensteilung (50/50, Gesamtschaden bleibt
  gleich), die exakte 6-Treffer-Designrechnung, Bindungsbruch (Abstand UND
  Wand, DAUERHAFT -- kein Wiederverbinden nach Rueckkehr in Reichweite),
  die sichtbare Kette (genau ein Link je Paar, verschwindet nach dem Bruch),
  `tetherStandoffDrive()` isoliert mit eigenen Zahlen, Verwerter-Wachstum
  (maxHp/damage/Stapelzaehler, kein Heilen, Radius-Ausschluss), ein
  Geistertod waechst denselben Verwerter, der Spielertod NICHT.
  **Ein Fund beim eigenen Testbau (kein Code-Bug)**: die urspruengliche
  `check(near.x < 0, ...)`-Assertion in (g) crashte hart (statt einen
  Check zu roeten), wenn `tetherStandoffDrive()` `null` zurueckgibt -- auf
  `near?.x`/`far?.x` umgestellt, damit ein gebrochener Mechanismus als
  normale FEHLER-Zeile erscheint statt die ganze Suite abzubrechen.
- **Schlechtester Frame** (Grundregel): Acht-Gegner-Raum (4x je neuer Typ)
  vs. Baseline aus acht Bestandstypen, 600 Ticks, drittgroesster Wert:
  Baseline **1,600 ms**, G7-Raum **0,693 ms** (Budget 6 ms).
- Kein `sw.js`-Bump (reine Code-/Datenaenderung, keine neuen Asset-Dateien).

**Phase G8 (Akt 3, die letzten zwei "alternativen" Mechaniken) ist gebaut.**
`t_metronom` (Taktgeber) und `t_grabber` (Greifer) -- damit sind alle 16 in
`docs/AUFTRAG-GEGNERDESIGN.md` entworfenen Gegner gebaut (8 je Akt).
`t_metronom` ist der erste Gegner, der NICHT selbst kaempft, sondern das
Verhalten ALLER anderen Gegner im Raum veraendert; `t_grabber` der erste,
der dem Spieler Boden statt LP nimmt und dafuer eine Kugel als Gegenwehr
verlangt.
- **`t_metronom`** (11 Punkte, ab Raum 10, `role:"guardian"`, `weapon:null`,
  steht still, feuert nie selbst): schlaegt einen Takt
  (`metronome:{beatS:2.0, holdWindowS:1.6, needsLos:true}`). Neue Funktion
  `state.js: updateMetronomes(state, dt)` tickt pro Metronom einen
  zyklischen `t.metronomeState.elapsed` (0..beatS, simples Delta-Increment
  -- bewusst KEIN floor-division-basiertes Tick-Zaehlen wie `status.js`s
  Schadenstakt: die Halte-/Frei-Grenze ist ein reines Feuer-Gate, kein
  bilanzkritischer Schadenswert). Laeuft VOR der Gegner-Schleife (Muster
  `updateTargeting`/`updateCoverPerception`), damit `metronomeHolds(state,
  tank)` (neu, live pro Verbuendetem geprueft, kein Cache wie
  `state.relaySight`) mit dem frischen Beat-Zustand entscheidet: haelt
  MINDESTENS ein sichtbarer (`needsLos`, `clearLine()`) Taktgeber noch seine
  Haltephase (`elapsed < holdWindowS`), wird der Feuerwunsch unterdrueckt.
  **Der eigentliche Trick braucht keine Cooldown-Manipulation**: `tank
  .cooldown` tickt (Haupt-Panzer-Tick-Schleife) UNABHAENGIG von der
  Unterdrueckung weiter -- ein schnell feuernder Verbuendeter ist beim
  Schlag also laengst "bereit" und feuert sofort, statt einzeln ueber die
  Haltezeit verteilt zu sein (genau die im Design geforderte Buendelung).
  Gate sitzt an EINER Stelle im Haupt-Enemy-Loop
  (`t.metronomeHeld = fire && metronomeHolds(state, t); if (fire &&
  !t.metronomeHeld) { fireBullet/fireMortar }`) -- deckt Kugel- UND
  Moerserschuetzen gleichermassen ab, ohne `roleTurret()`/`fireMortar()`
  selbst anzufassen. `ms.justBeat` (Uebergang gehalten->frei) loest Ton +
  Blitz aus. Telegraph: `effects.js: drawMetronomeRings()` (NEU, bewusst
  KEINE Baustein-C-Wiederverwendung -- die bietet einen FESTEN Aussenring +
  wachsende FUELLFLAECHE, hier ist es das Gegenteil: ein Ring, der SELBST
  schrumpft und beim Schlag am vollen Radius aufblitzt), plus ein duenner
  pulsierender gelber Saum (`renderer.js`, eigener Radius r+7) um jeden
  gerade gehaltenen Verbuendeten ("verstaerkte Gegner pulsieren im selben
  Takt").
- **`t_grabber`** (8 Punkte, ab Raum 6, normaler `weapon:"bullet"`-Schuetze
  UND zusaetzlich ein eigener, komplett unabhaengiger Greif-Mechanismus mit
  eigenem 4,0-s-Cooldown): neue Funktion `state.js: updateGrapples(state,
  dt)`, Zustandsautomat `idle -> windup -> cooldown` (Muster `ramDrive()`
  aus G2, aber als reine state.js-Tick-Funktion statt einer
  `ai_drives.js`-Fahrfunktion, da der Greifer seine normale Bewegung/sein
  normales Feuern unveraendert behaelt). `idle` prueft Reichweite+Sichtlinie
  zum aufgeloesten Ziel (`resolveTarget()`, kann ein Geist sein) und friert
  bei Erfolg die Richtung EINMALIG ein (`gs.dir`); nach `windupS` (0,7 s)
  entscheidet eine ERNEUTE Zielaufloesung ueber Treffer/Fehlschlag --
  bleibt das Ziel innerhalb des gefrorenen Korridors
  (`angleDelta(gs.dir, ...) < aimToleranceRad`, `armor.js: angleDelta` aus
  G1/G2 wiederverwendet) UND weiterhin in Reichweite+Sichtlinie, ist es ein
  TREFFER (`target.grappledBy/grappleUntil/grappleRopeHp` gesetzt), sonst
  ein Fehlschlag ("Ausweichen kostet nur Bewegung", Ton+Blitz-Rueckmeldung
  wie `fireHook()`s Fehlschuss) -- BEIDES fuehrt in dieselbe `cooldown`-
  Phase.
  - **Additive Zug-Physik statt Ersetzung** (der Kernanforderung "volle
    Steuerung senkrecht zur Leine bleibt"): `tank.js: moveTank()` bekommt
    einen neuen Block NACH der normalen Bewegung/Kollision (Muster
    Foerderband, Phase 15) -- ein gegriffenes Ziel wird ADDITIV Richtung
    Schuetze genudged (`tank.x += ...`), NICHT wie der eigene `hookTimer`
    (ersetzt die Eingabe komplett). `ghost.js: updateGhosts()` bekommt
    denselben Block ("zieht auch Geister") -- bewusst VOR der
    Zielaufloesung/dem "kein Ziel -> continue"-Zweig platziert, sonst waere
    ein gegriffener Untertan OHNE eigenes Kampfziel im Raum unbemerkt
    wirkungslos (echter Entwurfs-Fallstrick, per Gegenprobe bestaetigt, s.
    u.).
  - **Die Leine ist beschiessbar** (`state.js: updateGrappleRopes(state)`,
    neu, laeuft NACH der Bullet-Bewegung): fuer jeden aktiven Griff (Panzer
    ODER Geist) eine Punkt-Strecke-Distanzpruefung (`pointSegmentDistSq()`,
    neu) gegen ALLE lebenden Kugeln, unabhaengig vom Besitzer (dasselbe
    teamlose Prinzip wie `t_dud`s Explosion/`t_arclight`s Kette) --
    innerhalb `ropeHitRadiusPx` sinkt `grappleRopeHp`, bei 0 loest sich das
    Ziel, die treffende Kugel wird VERBRAUCHT ("eine Kugel fuer die Leine
    ausgeben"). Dieselbe Funktion pusht auch die IMMER sichtbare, leicht
    flackernde Leine ueber Baustein B (`state.tankLinks`).
  - Telegraph: `effects.js: drawGrapples()` (NEU, Wiederverwendung von
    `drawCorridorTelegraph()`, Muster `t_rusher`/`t_lance`/Amboss) zeigt
    waehrend des Windups den Wurfkorridor.
- **Sprite-Aliase statt neuer Dateien**: `t_metronom→t_yellow`,
  `t_grabber→t_yellow` (beide Design-Placeholderfarben -- "Messinggelb"/
  "Industriegelb" -- liegen naeher an `t_yellow` als an jeder anderen
  bisher unbenutzten Bestandsfarbe in der Alias-Liste). Identitaet traegt
  vollstaendig Verhalten + die neuen Telegraphen (Taktring/Wurfkorridor+
  Leine).
- **Zwei echte Testkonstruktionsfehler beim eigenen Testbau gefunden und
  behoben** (kein Code-Bug): (1) die erste Fassung von Test (j) ("ein
  gegriffener Geist OHNE eigenes Kampfziel wird trotzdem gezogen") hatte den
  Greifer selbst in `st.tanks` -- `ghost.js: nearestEnemy()` schliesst nur
  den SPIELER aus, nicht andere Panzer, der Greifer zaehlte also faelschlich
  als "Kampfziel" fuer den Geist und der Test pruefte gar nicht die
  behauptete Ausnahme (blieb selbst mit einer bewusst kaputten Gegenprobe
  gruen). Fix: der Greifer ist im Testaufbau NICHT Teil von `st.tanks`
  (wird direkt referenziert, muss dafuer nicht mitlaufen) -- danach faengt
  dieselbe Gegenprobe (die urspruengliche, fehlerhafte Codeplatzierung
  innerhalb des zielabhaengigen Bewegungsblocks simuliert) den Fehler
  zuverlaessig. (2) `createBullet(x, y, angle, opts)` nimmt positionale
  Argumente, kein einzelnes Optionsobjekt -- ein erster Testentwurf fuer die
  beschiessbare Leine rief die falsche Signatur auf.
- **Perf-Messung fand einen dritten, reinen Testaufbau-Fallstrick** (kein
  Code-Bug): ein Wegwerf-Messskript liess `st.player` ueber 1800
  zusammenhaengende Ticks (3 Laeufe auf demselben Raum) ohne echten
  Respawn-Fluss (kein `run.js` involviert) sterben, was NaN-Positionen
  erzeugte -- reproduzierbar auch mit den acht BESTANDS-Gegnertypen, also
  unabhaengig von G8. Fix im Messskript: pro Lauf eine frische Arena UND ein
  unsterblicher Spieler (`maxHp/hp = 1e9`) fuer die reine Zeitmessung.
- **Neuer Testabschnitt 76** (`tests/regression.mjs`, elf gezielte
  Gegenproben am echten Quellcode einzeln bestanden und zurueckgesetzt --
  `justBeat`-Zuweisung deaktiviert, Zyklus-Wrap entfernt, `needsLos`-Gate in
  `metronomeHolds()` entfernt, das `!t.metronomeHeld`-Gate im Enemy-Loop
  entfernt, der Greif-Trigger deaktiviert, die Kegel-Pruefung beim
  Windup-Ausgang entfernt, der Cooldown-Uebergang nach Windup-Ausgang
  entfernt, die additive Zug-Nudge in `moveTank()` entfernt, die
  Geist-Zug-Nudge probeweise in die urspruenglich fehlerhafte
  zielabhaengige Position zurueckversetzt, der `tankLinks`-Push fuer die
  Leine entfernt, die Beschuss-Pruefung der Leine entfernt): Struktur (beide
  Typen + Akt-3-Freischaltung), Beat-Zyklus mit EIGENEN Zahlen (1,0s/0,6s
  statt der echten 2,0s/1,6s) inkl. exakter erster Schlag-Tick,
  `needsLos`-Gate ueber eine echte Wand zwischen Verbuendetem und Taktgeber,
  Ende-zu-Ende-Feuerbuendelung (kein Schuss waehrend der Haltephase, Schuss
  sofort nach dem Schlag, ueber echte `st.bullets`-Zaehlung), Griff-Trigger
  + eingefrorene Richtung, Treffer- und Fehlschlag-Ausgang des Windups
  (inkl. der Design-Auflage "Ausweichen kostet nur Bewegung"),
  Cooldown-Mindestdauer, additive Zug-Physik ueber `moveTank()` (SENKRECHTE
  Eingabe bleibt wirksam WAEHREND der Zug gleichzeitig wirkt -- das ist der
  Kernbeweis fuer "additiv, nicht ersetzend"), dieselbe Physik fuer Geister
  (inkl. der Ausnahme ohne eigenes Kampfziel), sichtbare Leine
  (`state.tankLinks`), beschiessbare Leine (Kugel wird verbraucht, Ziel
  loest sich bei `ropeHp` 0).
- **Schlechtester Frame** (Grundregel): Acht-Gegner-Raum (4x je neuer Typ)
  vs. Baseline aus acht Bestandstypen, 600 Ticks, drittgroesster Wert,
  schlechtester von 3 Laeufen: Baseline **4,329 ms**, G8-Raum **1,984 ms**
  (Budget 6 ms).
- Kein `sw.js`-Bump (reine Code-/Datenaenderung, keine neuen Asset-Dateien).

**Alle 16 in `docs/AUFTRAG-GEGNERDESIGN.md` entworfenen Gegner (8 je Akt)
sind gebaut, samt Kompositionssystem (G4) fuer kuratierte Begegnungen.**

⚠️ **KORREKTUR eines frueheren Abschlussvermerks** (aufgefallen bei der
Code-Durchsicht, s. eigener Abschnitt unten): hier stand zuvor, der
komplette `UMBAUPLAN-GEGNER.md` (G0-G8) sei abgearbeitet. Das war falsch --
die Phasennummer G8 war versehentlich fuer die letzte GEGNER-Welle vergeben
worden, obwohl der Neun-Phasen-Plan laut dem eigenen G0-Bericht (Zeilen
157/216) unter **G8 die "Difficulty Curve"** fuehrt (Encounter/Kompositionen
final verdrahten + `affixDeny`) und **G9 als Abnahme**. Die echte Phase G8
ist inzwischen gebaut, **ebenso die Abnahme G9** (beide Abschnitte weiter
unten) -- **damit ist der komplette `UMBAUPLAN-GEGNER.md` (G0-G9)
abgearbeitet.**

### Code-Durchsicht nach G8: fuenf Fehler behoben — gemergt
Systematische Durchsicht der Gegner-Umbau-Phasen auf Nutzerwunsch ("gehe
den Code durch und behebe Fehler"). Fuenf echte Fehler gefunden, jeder
einzeln per Wegwerf-Sonde reproduziert, behoben und mit Dauertest +
bestandener Gegenprobe abgesichert. **Allen fuenf ist gemeinsam, dass sie
ein Versprechen des Spiels an den Spieler gebrochen haben, ohne je zu
crashen** -- deshalb ist keiner davon in den Bauphasen aufgefallen.
- **`t_mason` (G5): der Tod des Maurers machte seine Waende DAUERHAFT.**
  `updateMasons()` sprang mit `if (!t.alive) continue;` aus der Schleife,
  bevor der Verfallsblock lief -- der Timer sitzt zwar auf der Wand
  (`masonExpiresAt`), ausgewertet wurde er aber nur ueber den lebenden
  Erbauer. Ergebnis: ausgerechnet die richtige Antwort des Spielers ("toete
  den Maurer") zementierte seine Sperren fuer den Rest des Raums, statt sie
  aufzuloesen. Der `t.alive`-Gate sitzt jetzt erst vor der BAULOGIK; Verfall
  und Listenabgleich laufen fuer jeden Maurer, auch fuer einen toten.
- **`t_mason`: ein mitten im Bau getoeteter Maurer hinterliess einen
  ewigen Geruest-Telegraphen.** `state.masonScaffolds` wurde nur im
  Fertigstellungs-Zweig gefiltert, den ein toter Maurer nie erreicht -- der
  Raum warnte danach bis zum Ende vor einer Wand, die nie kommt. Der neue
  Tot-Zweig raeumt `masonBuildState` + Geruest auf.
- **`t_grabber` (G8): der Greifer zerschoss seine eigene Leine mit dem
  eigenen Schuss.** Er zielt mit seiner normalen Waffe auf genau das Ziel,
  das er zieht -- seine Kugeln fliegen also praktisch ENTLANG der Leine und
  wurden von `updateGrappleRopes()` ausnahmslos im Erzeugungstick gefressen
  (per Sonde: eigene Kugel tot, Leine getrennt, `ropeHp` 0). Ein Greifer
  konnte ein gegriffenes Ziel damit **nie** beschiessen. Fix: `b.owner ===
  shooter` ueberspringen -- dieselbe Begruendung wie das `b.owner === t` der
  Panzer-Trefferschleife (die Leine ist Teil des Schuetzen). Fremdes Feuer
  trennt sie weiterhin: das ist die im Design gewollte Gegenwehr und
  dasselbe teamlose Prinzip wie bei `t_dud`/`t_arclight`.
  **Der bestehende Test 76(l) hatte das fehlerhafte Verhalten
  festgeschrieben** -- er zerschoss die Leine mit einer Greifer-eigenen
  Kugel und wurde beim Fix rot. Jetzt nutzt er die im Design gemeinte
  Spielerkugel, ein neuer Test 76(m) bewacht den Ausschluss.
- **`t_tether` (G7): die Schadensteilung galt nur von EINER Seite.** Ein
  Kettenhund bindet sich mangels zweitem Kettenhund auch an einen ganz
  normalen Verbuendeten -- der traegt dann selbst kein `cfg.tether`, und die
  Bedingung `tank.cfg.tether && ...` liess einen Treffer auf ihn voll
  durchgehen (gemessen: 10/10 auf den Kettenhund, aber 0/20 auf den
  Partner). Die Kette liess sich damit umgehen, indem man einfach die andere
  Seite erschoss -- entgegen dem eigenen Kartentext ("jeder Schaden an einem
  der beiden wird 50/50 geteilt"). Die Rezeptur kommt jetzt von der Seite,
  die sie hat (`tank.cfg.tether || tank.tetherPartner?.cfg?.tether`).
- **`t_tether`: eine tote Bindung sperrte den Ueberlebenden dauerhaft.**
  `updateTethers()` raeumt beim Tod nur die LEBENDE Seite auf; ein
  ueberlebender Partner behielt seinen Zeiger auf die Leiche und galt in
  `bondTethers()` fuer immer als "schon gebunden" -- fuer jeden spaeter
  erscheinenden Welle-2-Kettenhund unerreichbar (per Sonde bestaetigt: C
  findet keinen Partner). Beide Pruefungen gehen jetzt ueber `?.alive`.
- **`t_rusher` (G2): Betaeubung war gegen den Rammsturm wirkungslos.** Der
  Sturm bewegt den Panzer ueber eine EIGENE Substep-Schleife
  (`moveRamSubsteps()`) und umgeht damit `tank.js: moveTank()`, wo die
  `stunTimer`-Sperre fuer jeden anderen Panzer sitzt -- ein dauerhaft
  betaeubter Rammler legte im Test trotzdem 120 px zurueck und richtete
  vollen Kontaktschaden an, waehrend ein betaeubter `t_pink` bei 0 px bleibt.
  Krallenfalle, EMP-Mine und Frost-Erstarrung waren gegen genau den Gegner
  nutzlos, gegen den sie am meisten zaehlen. Der Sturmtimer laeuft bewusst
  weiter (die Betaeubung laesst den Angriff INS LEERE laufen, statt ihn nur
  aufzuschieben) -- nur Bewegung und Trefferpruefung entfallen.
**Vier Verbesserungen ohne Verhaltensaenderung** dazu: ein abgelaufener oder
verwaister Griff raeumt seinen `grappledBy`-Zeiger jetzt auf statt als
haengender Verweis stehenzubleiben (neuer Test 76(n)); `updateGrappleRopes()`
kopiert nicht mehr Tick fuer Tick zwei Arrays zusammen, wenn gar kein
Greifer im Raum ist; `metronomeHolds()` liest die einmal pro Tick
eingesammelte `state.metronomes` statt je feuerwilligem Verbuendeten neu
ueber alle Panzer zu scannen; Geister bekommen `grappleRopeHp` als
deklariertes Feld (wurde vorher implizit angelegt).
- **Neuer Testabschnitt 77** (fuenf Bloecke, plus 76(m)/(n)); sieben
  Gegenproben am echten Quellcode einzeln bestanden und zurueckgesetzt --
  jede roetete exakt die benannten Pruefungen und sonst nichts.
- **Zusaetzlich geprueft, ohne Befund**: NaN-/Invarianten-Lauf ueber fuenf
  vollstaendige Runs (beide Klassen) auf Panzer-/Geister-/Kugelpositionen,
  `hp <= maxHp`, verwaiste Zeiger und Array-Groessen; Datenkonsistenz aller
  31 Gegnertypen (`label`/`desc`/`maxHp`/`bulletSpeeds`-Eintrag, keine
  NaN-cfg-Felder); alle neun Kompositionen gegen Budgetformel und
  Freischaltung; alle Divisionen durch Distanzen auf fehlende Null-Guards.
- Kein `sw.js`-Bump (reine Code-Aenderung, keine neuen Asset-Dateien).

**Phase G8 (Difficulty Curve) ist gebaut** -- die eigentliche, im Plan so
benannte Phase (nicht die Gegnerwelle, die frueher faelschlich diese Nummer
trug, s. Korrekturvermerk oben). Drei Bausteine, davon zwei aus dem
Auftragstext und einer als echter Messbefund.
- **Acht Akt-3-Kompositionen** (`data/compositions.json`: 9 -> 17 Eintraege),
  K1-K8 aus `docs/AUFTRAG-GEGNERDESIGN.md` Abschnitt 11: `k1_der_chor`
  (Taktgeber + Rudel + Bollwerk), `k2_der_blutzoll` (Verwerter + viele
  billige Tode + Blindgaenger), `k3_die_kette` (zwei Kettenhunde + Zehrer),
  `k4_der_trichter` (Bollwerk + Greifer + zwei Streuer), `k5_die_blende`
  (Horcher + Feldwebel hinter Deckung), `k6_das_rudel` (Feldwebel + Rudel +
  Pirscher), `k7_der_kaefig` (Maurer + Greifer + Lichtbogen),
  `k8_der_ankerhof` (Anker + Bollwerk + Zehrer + Pirscher). Vorher enthielt
  die Datei **ausschliesslich Akt-2-Rezepte** -- alle elf Akt-3-Typen liefen
  nur ueber den Zufalls-Rueckfall, keine der entworfenen Synergien war
  verlaesslich erreichbar. Jede Komposition ist gegen die ECHTE
  `acts[2].budget`-Formel, `maxEnemiesPerRoom` und jedes `unlockRoomInAct`
  nachgerechnet (der Struktur-Test aus Abschnitt 72 (a) gilt automatisch
  mit). **Ein Fehler im Designdokument dabei gefunden**: K2 nennt "ab Raum
  6", dort wurde aber nur das Budget gerechnet -- `t_harvester` ist selbst
  erst ab Raum 8 freigeschaltet, `minRoom: 8` statt 6 (Regel 1: der Code
  gewinnt gegen den Prosatext). `k2_der_blutzoll` sitzt mit 8 Einheiten
  exakt auf dem `maxEnemiesPerRoom`-Deckel.
- **`affixDeny`** (`UMBAUPLAN-GEGNER.md` O3, dort als "optional, erst in G8"
  eingeplant): eine optionale Negativliste je Gegnertyp, ausgewertet in
  `state.js: applyAffixByIndex()` -- ein gesperrter Affix wird uebersprungen
  UND landet nicht in `t.affixes` (sonst zeigte der Renderer einen
  Farbpunkt fuer eine Wirkung, die es nicht gibt -- dieselbe Fehlerklasse
  wie der Regenerierschild-Bugfix). Durchgriff ueber die
  `cfg.js: resolveCfg()`-Whitelist. Gesetzt sind exakt die drei im
  Designdokument ausdruecklich begruendeten Ausschluesse:
  `t_shotgun: ["rasend"]`, `t_dud: ["gepanzert"]`, `t_harvester: ["rasend"]`.
- **`compositionChance`** (NEU, nicht im Auftragstext -- ein Messbefund
  beim Verdrahten): mit den acht neuen Rezepten feuerte ab Akt 2 Raum 2
  **in 100 % der Raeume** eine Komposition, sobald ueberhaupt eine ins
  Budgetfenster passte. Der Zufalls-Rueckfall, den das Designdokument in
  Abschnitt 17.3 ausdruecklich als wichtig bezeichnet, lief danach nie
  wieder. Zwei messbare Folgen: (1) Wiederholung -- fruehe Raeume lieferten
  immer dasselbe Rezept; (2) die Kurve knickte nach hinten ab, weil
  Kompositionen feste Punktkosten haben und nur im 50-100-%-Fenster gelten,
  spaete Raeume also im Schnitt deutlich unter Budget blieben, waehrend der
  Rueckfall es ausschoepft. `pickComposition()` (`run.js`) wuerfelt jetzt
  einmal (`acts[].compositionChance`, 1/0,6/0,6) -- **genau EIN
  zusaetzlicher `rng()`-Aufruf, und nur wenn ueberhaupt Kandidaten
  existieren**, der Determinismus-Vertrag aus G4 bleibt unberuehrt.
  Gemessen (200 Seeds je Raum, Punktschnitt gegen das Raumbudget):
  Akt 3 Raum 16 **35,9 -> 43,8 von 55** Punkten, Akt 2 Raum 16
  **29,7 -> 34,5 von 45**; kuratierter Anteil Akt 2 87,5 % -> 51,6 %,
  Akt 3 68,8 % -> 41,3 % (in den Raeumen, in denen ueberhaupt eine
  Komposition passt: rund 55-65 %).
- **Neuer Testabschnitt 78** (`tests/regression.mjs`, Gegenprobe fuer jeden
  Kernpunkt einzeln bestanden -- je absichtlich rot gemacht und
  zurueckgesetzt: Akt-3-Rezepte entfernt, `affixDeny`-Auswertung in
  `applyAffixByIndex()` entfernt, der `t.affixes`-Eintrag trotz Sperre
  gesetzt, `affixDeny` aus der `resolveCfg()`-Whitelist entfernt, der
  Chance-Wurf in `pickComposition()` entfernt, der Chance-WERT ignoriert
  (fest 1)): Struktur (acht Akt-3-Rezepte, alle acht namentlich, K2s
  Freischaltungs-Nachrechnung), **jede** der 17 Kompositionen feuert im
  echten `buyEnemies()`-Pfad wirklich (tote Datenlage waere sonst
  unsichtbar), `affixDeny`-Mechanismus mit EIGENEN Werten (synthetischer
  Affix, nicht der aktuellen Datenlage) inkl. der drei begruendeten
  Ausschluesse und einer Tippfehler-Pruefung gegen `diffData.elite.affixes`,
  `compositionChance` (1/undefined immer, 0 nie, 0,5 streut wirklich, genau
  ein zusaetzlicher `rng()`-Aufruf, kein Aufruf ohne Kandidaten).
- **Ein Testkonstruktionsfehler beim eigenen Bau gefunden und behoben**
  (kein Code-Bug, dieselbe Fehlerklasse wie schon zweimal in dieser
  Auftragsreihe): der erste Entwurf des `compositionChance`-Tests nutzte
  einen einzigen 5-Punkte-Typ bei Budget 10 -- der Zufalls-Rueckfall kaufte
  dann exakt dieselben zwei Einheiten wie die Komposition, kuratiert und
  Rueckfall waren am Ergebnis **nicht unterscheidbar** und der Test blieb
  auch mit ausgebautem Mechanismus gruen. Fix: ein zweiter Typ mit
  `maxPerRoom: 0`, den nur die Komposition kaufen kann (der Rueckfall prueft
  `maxPerRoom`, `pickComposition()` bewusst nicht), plus zwei explizite
  Vorbedingungs-Pruefungen, dass die beiden Wege wirklich verschiedene
  Ergebnisse liefern. Zweiter Fund im selben Block: die RNG-Vertragspruefung
  verglich `chance 1` gegen einen Lauf, dessen fehlgeschlagene Probe den
  Rueckfall ausloeste und dessen Aufrufe mitzaehlte (1 -> 3 statt 1 -> 2) --
  jetzt mit einer Probe gemessen, die GELINGT (`rng` liefert immer 0), also
  Gleiches mit Gleichem.
- **Schlechtester Frame** (Grundregel -- G8 kostet zwar keinen Tick, aendert
  aber die Raumzusammensetzung): jede der acht Akt-3-Kompositionen gegen
  eine Baseline aus acht Bestandstypen, 600 Ticks, drittgroesster Wert,
  schlechtester von 3 Laeufen: Baseline **2,489 ms**, teuerste Komposition
  (`k5_die_blende`) **1,788 ms**, alle uebrigen 0,57-1,17 ms (Budget 6 ms).
- Kein `sw.js`-Bump (reine Code-/Datenaenderung, keine neuen Asset-Dateien --
  `data/compositions.json` steht seit G4 in `ASSETS`, network-first liefert
  Daten online ohnehin frisch).

**Phase G9 (Abnahme) ist gebaut** -- die letzte Phase von
`UMBAUPLAN-GEGNER.md`. Kein Feature-Bau: Ist-Abgleich der 16 Gegner + des
Kompositionssystems (G4) + der Difficulty Curve (G8) gegen die in
`docs/AUFTRAG-GEGNERDESIGN.md` Abschnitt 14 ("Difficulty Curve") und 14.3
("Was bewusst NICHT passiert") ausformulierten Abnahmekriterien. Die
Sicherheitsnetze aus Abschnitt 19 (`t_mason`s vier Sicherungen, `t_grabber`s
drei Ausswege) und die reine Datenkonsistenz (kein `NaN`, jeder `weapon`-Wert
hat ein Kugeltempo) waren bereits aus den Bauphasen G2-G8 mit eigener
Gegenprobe abgedeckt (Abschnitte 68-77) -- **neuer Testabschnitt 79** deckt
nur die vier Luecken, die noch kein bestehender Test gegen den
Designdokument-**Wortlaut** selbst prueft.
- **(a) Einfuehrungskurve exakt gegen Abschnitt 14.1/14.2**: Raum,
  Freischaltungspunkte je der 16 neuen Typen gegen die Designdokument-
  Tabellen verglichen -- **alle 16 stimmen exakt** (bisherige Tests prueften
  nur, dass `unlockAct`/`unlockRoomInAct` ueberhaupt Zahlen sind, nie den
  Wortlaut selbst).
- **(b) Kein Raum fuehrt zwei neue Mechaniken gleichzeitig ein** (14.3,
  erster Punkt): programmatisch ueber alle `unlockRoomInAct`-Werte der 16
  neuen Typen geprueft, Bestandstypen (`t_pink`/`t_armored`/`t_green`/
  `t_purple`/`t_white`/`t_black`), die zufaellig dieselbe Raumnummer teilen,
  zaehlen bewusst nicht mit -- ihre Mechanik ist dem Spieler laengst bekannt.
  **Keine Kollision gefunden.**
- **(c) Keine Komposition mit >=3 neuen Gegnern vor Raum 7** (14.3, dritter
  Punkt): alle 17 Eintraege in `data/compositions.json` geprueft.
  **Keine Verletzung gefunden.**
- **(d) "Kein neuer Gegner debuetiert in einem Eliteraum"** (14.3, zweiter
  Punkt) — **echter, gemessener Befund statt bloss verifiziert:** die
  Garantie gilt strukturell nur fuer Raum 1-3 (Grundsteinumbau Phase 6:
  `EARLY_EXCLUDED_TYPES` schliesst elite/cursed/workshop aus den ersten drei
  Kartenebenen aus, per Gegenprobe bestaetigt -- Raum 1-3 zeigt 0/60 Seeds
  einen Elite-/Fluchknoten). Fuer Raum 4+ gibt es **keinen** Mechanismus:
  `unlockRoomInAct` steuert nur die Raum-**Nummer**, nicht den Raum-**Typ**,
  den der Kartengraph an dieser Ebene wuerfelt. Gemessen (200 Seeds je Typ,
  ueber `generateMap()`): die zehn Typen mit Debuet ab Raum 4
  (`t_lance`/`t_relay`/`t_medic`/`t_mason`/`t_anchor` in Akt 2,
  `t_arclight`/`t_stalker`/`t_grabber`/`t_harvester`/`t_metronom` in Akt 3)
  koennen ihre Debuet-Ebene mit **27-52 %** Wahrscheinlichkeit als Elite-
  oder Fluchraum ziehen -- ein echter Widerspruch zum Designdokument fuer
  diese zehn Typen. **Bewusst nicht behoben** (kein Abnahme-Umfang): eine
  echte Loesung braeuchte eine neue, laufzeitabhaengige "wurde dieser Typ in
  diesem Run schon gekauft"-Buchfuehrung, weil der Kartengraph VOR jedem
  Raumkauf entsteht und den spaeteren Spielerpfad nicht kennen kann --
  Architekturarbeit, kein Verifikationsschritt. Als To-do dokumentiert.
- **Vier Gegenproben bestanden** (je am echten Quellcode/Datenbestand
  ausgefuehrt, nicht nur an isolierten Funktionen): `t_rusher.unlockRoomInAct`
  real auf 5 verfaelscht (faengt sowohl (a) als auch (b), weil Raum 5 dann
  mit `t_relay` kollidiert), eine reale Komposition (`a9_die_rechnung`) auf
  `minRoom: 3` verfaelscht (faengt (c)), `EARLY_EXCLUDED_TYPES` geleert
  (faengt (d) an Raum-3-Typen wie `t_dud`/`t_marshal` mit realen
  Elite-Treffern). Alle drei Gegenproben nach der Pruefung zurueckgesetzt.
- Keine Balance-Werte geaendert -- alle Pruefungen sind am aktuellen Stand
  gruen. Kein `sw.js`-Bump (reine Testaenderung, keine neuen/geaenderten
  Asset-Dateien, keine Laufzeit-Codeaenderung). Volle Suite + die vier
  Nebensuiten (`gamepad`/`music`/`championsprite`/`spidersprites`) gruen.

**Damit ist der komplette `UMBAUPLAN-GEGNER.md` (Phasen G0-G9) abgearbeitet
-- alle 16 Gegner (8 je Akt), das Kompositionssystem und die Difficulty
Curve stehen und sind gegen den Designdokument-Wortlaut abgenommen.**

### Bugfix: drawOne()-Signaturkarten-Inkonsistenz (Upgradepool-v2 Phase 2) — gemergt
Behebt die seit Upgradepool-v2 Phase 2 dokumentierte, als To-do zurückgestellte
Inkonsistenz: `run.js: banOffer()`/`buyFourthCard()` bauten ihre
Vermeidungsmenge für den Ersatzzug bisher aus dem rohen `o.tag` der
verbleibenden Angebote — für Signaturkarten ist das immer der gemeinsame Tag
`signature`, egal welche Klasse/id. Das Verbannen EINER von mehreren
gleichzeitig angebotenen Signaturkarten sperrte dadurch den **ganzen** Tag
für die Ersatzkarte, obwohl die Erstauswahl (`rollOffers()`) seit
Upgradepool-v2 Phase 2 (`dedupeKey()`, dedupt Signaturkarten auf `"sig:"+id`
statt auf den Tag) ausdrücklich mehrere Signaturkarten derselben Klasse
gleichzeitig erlaubt — eine echte Verhaltensabweichung zwischen Erst- und
Ersatzauswahl, kein bloßer Stilbruch.
- **`upgradepool.js: dedupeKey()` ist jetzt exportiert** (vorher modulintern)
  — die eine Quelle für „wonach dedupt/vermeidet man diese Karte" bleibt
  erhalten, statt eine zweite Kopie der Regel in `run.js` zu pflegen.
- **`drawOne()` filtert jetzt über `dedupeKey(d)` statt über `d.tag`** — der
  Parameter heißt entsprechend `avoidKeys` statt `avoidTags` (rein interne
  Umbenennung, beide Aufrufer übergeben weiterhin positional). Für
  Kernpool-Karten (kein `signatureClass`) ist `dedupeKey(d) === d.tag` —
  ihr Verhalten ist dadurch **unverändert** tag-basiert (per Test 80(d)
  gegengeprüft).
- **`run.js: banOffer()`/`buyFourthCard()`** bauen ihre Vermeidungsmenge jetzt
  über `dedupeKey(o)` statt `o.tag` — ein Ersatzzug blockiert dadurch nur
  noch genau die gebannte/bereits angebotene Signaturkarte (ihre eigene id),
  nicht mehr die ganze Kategorie. Der dritte `drawOne()`-Aufrufer (die
  garantierte 4. Elite-Bonuskarte in `rollReward()`) ist unverändert
  geblieben — er zieht ausschließlich aus Tag `elite`, den aktuell keine
  Signaturkarte trägt, ist also von der Inkonsistenz nie betroffen gewesen.
- **Neuer Testabschnitt 80** (`tests/regression.mjs`): (a) der Mechanismus
  direkt in `drawOne()` mit drei synthetischen Signaturkarten derselben
  Klasse — nach dem Verbannen einer von zwei angebotenen liefert der Aufruf
  die dritte statt keiner; (b)/(c) End-to-End über die echten
  `banOffer()`/`buyFourthCard()`-Funktionen mit einem minimalen, direkt
  konstruierten `run`-Objekt (kein `createRun()` nötig — nur die von
  `poolOpts()` gelesenen Felder); (d) Kontrolle, dass zwei Kernpool-Karten
  mit demselben Tag (kein `signatureClass`) sich weiterhin gegenseitig
  blockieren, das Verhalten für Nicht-Signaturkarten also unverändert bleibt.
  **Gegenprobe in zwei Stufen bestanden**: nur `drawOne()`s Filter auf
  `d.tag` zurückgesetzt (bei sonst `dedupeKey()`-basierten Aufrufern) zeigt
  einen anderen, aber ebenfalls echten Fehler (liefert die bereits
  angebotene `sigB` statt der neuen `sigC` — der Mechanismus selbst greift
  nicht mehr); **beide** Dateien gemeinsam auf den alten Tag-basierten Stand
  zurückgesetzt reproduziert exakt den ursprünglich dokumentierten Fehler
  (`banOffer()` liefert ebenfalls `sigB` statt `sigC`, `buyFourthCard()`
  scheitert komplett, weil `avoidTags` dann den ganzen Tag `signature`
  enthält und keine einzige Signaturkarte mehr eligible ist) — beide
  Gegenproben danach zurückgesetzt.
- Kein `sw.js`-Bump (reine Code-Änderung, kein neues/geändertes Asset).
  Volle Suite + alle vier Nebensuiten (`gamepad`/`music`/`championsprite`/
  `spidersprites`) grün.

### Arena-Politur nach Nutzer-Feedback ("sieht ueberladen aus") — gemergt
Der Nutzer meldete, die Arena wirke "unprofessionell und ueberladen", wollte
aber die Kinderzimmer-Design-Idee (Kinderzimmer-Reskin, s. o.) behalten. Statt
blind loszubauen erst der Ist-Stand per Playwright-Screenshot in einem echten
laufenden Raum geprueft (nicht nur die Vorschau) -- das war der eigentliche
Befund: die 20 Bauklotz-Wandvarianten sind einzeln bunt und hoch gesaettigt,
gemeinsam auf JEDER Wandzelle wirken sie als eine geschlossene Reizwand, die
staerker um Aufmerksamkeit konkurriert als Panzer/Kugeln/HUD -- und die
HUD-Kopfzeile brach als hart abgeschnittenes Rechteck (`fillRect(0,0,WIDTH,
22)`) genau 10 px vor dem Ende der ersten Wandreihe (32 px hoch) ab, sodass
darunter ein Streifen ungedaempfter, greller Wand als sichtbare Kante
hervorblitzte. Reine Rendering-Politur, **keine Gameplay-/Logikaenderung,
keine neuen Assets** -- die Kinderzimmer-Bilder selbst bleiben unangetastet.
- **Wandton-Ueberzug** (`renderer.js: drawWallVariant()`): nach jedem
  gezeichneten Bauklotz-Sprite legt sich ein duenner, warmer Farbueberzug
  (`WALL_TINT = 'rgba(46,30,16,0.34)'`, an EINER Stelle fuer alle 20+7
  Varianten gleichzeitig) darueber -- zieht die Waende naeher an den
  Holzboden-Farbton heran und laesst sie als Hintergrund gelten statt als
  gleichrangigen Blickfang. Die Bauklotz-Silhouetten/Farben bleiben klar
  erkennbar, nur die Lautstaerke sinkt.
- **Permanente Vignette** (`renderer.js`, neuer `vignetteCanvas`, Muster wie
  `floorCanvas`: einmalig gebacken, danach frame-kostenlos geblittet): ein
  Radialgradient dunkelt die Ecken/Raender sanft ab (Innenradius 32 % der
  kuerzeren Kante, Aussenradius bis in die Ecke, `rgba(8,6,4,0)` bis
  `rgba(8,6,4,0.5)`). Zieht den Blick zur Mitte, wo das Geschehen ist, statt
  zur Wandreihe am Rand -- derselbe Trick, den praktisch jedes polierte
  Top-Down-Spiel benutzt, um flach nebeneinanderliegende Sprites als EINE
  Szene statt als Tabelle einzelner Bilder wirken zu lassen. Bewusst
  **getrennt von** der P11-Nebel-/Dunkelheit-Lichtmaske (`drawFog()`, gilt
  nur bei passendem Raum-Modifikator) -- die Vignette ist IMMER aktiv und
  wird direkt davor gezeichnet, sodass sich beide Effekte addieren statt zu
  kollidieren.
- **HUD-Kopfzeile ohne harte Kante** (`hud.js: drawBar()`): das feste
  `fillRect(0,0,WIDTH,22)` ist durch einen linearen Verlauf ersetzt
  (`rgba(0,0,0,0.72)` oben, ausklingend auf 0 bei y=28) -- eine echte
  HUD-Blende statt eines abgeschnittenen Balkens, klar unterhalb von
  `drawAnvilBoss()`s Inhalten (ab y=32, unangetastet).
- **Zwei echte Testkonstruktionsluecken beim eigenen Testlauf gefunden und
  behoben** (kein Code-Bug): drei identische, aeltere Ad-hoc-`fakeCtx`-Mocks
  in `tests/regression.mjs` (P7-Werte-Anzeige + zwei Nekromant-HUD-Tests)
  kannten `createLinearGradient`/`createRadialGradient` nicht (im Unterschied
  zu `tests/domstub.mjs`s vollstaendigerem Stub) und lieferten `undefined`
  statt eines Gradient-Objekts — `drawBar()` stuerzte dadurch beim Aufruf von
  `.addColorStop()` ab. Alle drei um denselben `{addColorStop(){}}`-Rueckgabe-
  zweig ergaenzt, den `domstub.mjs` bereits nutzt — kein zweites Stub-Muster
  eingefuehrt.
- Volle Suite + alle vier Nebensuiten (`gamepad`/`music`/`championsprite`/
  `spidersprites`) gruen. Vorher/Nachher per Playwright-Screenshot in einem
  echten laufenden Raum verglichen (nicht nur die Vorschau) — sichtbar
  ruhigere Wandreihe, kein harter HUD-Schnitt mehr, Blick zieht zur Mitte.
- Kein `sw.js`-Bump (reine Code-Aenderung an bestehenden `src/*.js`-Dateien,
  kein neues/geaendertes Asset — dieselbe Konvention wie bei jeder anderen
  reinen Rendering-/Logikaenderung in diesem Projekt).

### Offene Punkte / To-do (nice-to-have, nicht dringend)
- [ ] **Neue Gegner debuetieren ausserhalb der Raeume 1-3 nicht garantiert
      ausserhalb von Elite-/Fluchraeumen** (Gegner-Umbau G9-Befund,
      Designdokument Abschnitt 14.3): `unlockRoomInAct` steuert nur die
      Raum-NUMMER, nicht den Raum-TYP, den der Kartengraph an dieser Ebene
      wuerfelt. Gemessen (200 Seeds je Typ): zehn Typen mit Debuet ab Raum 4
      (`t_lance`/`t_relay`/`t_medic`/`t_mason`/`t_anchor`,
      `t_arclight`/`t_stalker`/`t_grabber`/`t_harvester`/`t_metronom`)
      koennen ihre Debuet-Ebene mit 27-52 % Wahrscheinlichkeit als Elite-
      oder Fluchraum ziehen. Fuer Raum 1-3 gilt die Garantie strukturell
      (`EARLY_EXCLUDED_TYPES`, per Test bewacht). Eine echte Behebung
      braeuchte eine laufzeitabhaengige "wurde dieser Typ in diesem Run
      schon gekauft"-Buchfuehrung (der Kartengraph entsteht VOR jedem
      Raumkauf und kennt den Spielerpfad nicht) -- Architekturarbeit.
- [ ] **`t_relay` (Horcher) hat noch keine eigene Sichtlinien-Suchfahrt**
      (Gegner-Umbau G3): Designtext will aktives Aufsuchen von Korridorenden/
      Freiflächenrändern statt normalem `sapper`-Wandern. Technisch machbar
      als `coverDrive()`-Gegenstück (dieselbe Ray-March-Technik, umgedrehte
      Bedingung), bewusst als reine Verhaltens-Politur zurückgestellt — die
      eigentliche Mechanik (`state.relaySight`) funktioniert bereits
      vollständig ohne sie.
- [ ] **Bosse neu ausarbeiten** (eigene künftige Aufgabe, kein Teil des
      laufenden Grundsteinumbaus): Reaktor/Spiegel/Phalanx durch `t_black`
      ersetzt (s. o.), bis ein neues Bosskonzept entsteht. Beim Neubau die
      beiden in `ARCHIV.md` dokumentierten Funde mitlösen (Reaktor-
      Generatoren brauchen aktuell einen Bankshot statt eines Direkttreffers;
      `t_mirror` hängt an `requiresRicochet`, das Grundsteinumbau-Phase 1
      entfernt).
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
- [ ] **Spinnennetz-Sprite hat sichtbare Restartefakte** (s. Abschnitt
      „Spinnenboss-Sprites"): ein paar sehr kleine Schachbrett-Reste aus der
      Foto-Freistellung bleiben in einzelnen Netzmaschen sichtbar, bei der
      kleinen In-Game-Größe kaum wahrnehmbar. Bei Bedarf ein sauberer
      freigestelltes Netzbild nachliefern lassen (echter Alpha-Hintergrund
      statt Schachbrett-Foto) statt weiter an der Foto-Extraktion zu feilen.
- [ ] **Spinnenboss-Kampfdauer nicht empirisch gemessen** (Zielwert laut
      Vorgabe ~3,5–4,5 Min. für einen Durchschnitts-Build) — bei Bedarf
      einen echten Durchlauf/Bot-Test nachholen und `data/balance.json:
      boss.spider` danach justieren.
- [ ] **Amboss ist komplett prozedural** (kein Sprite-Asset, `t_anvil`
      aliast auf `t_black`, s. eigener Abschnitt „Amboss (Akt 2)"). Bei
      echten, freigestellten Grafiken (`body_t_anvil.png`/
      `turret_t_anvil.png`) `sprites.js: TANK_TYPES` + den Sprite-Alias
      anpassen, analog zum Champion-Sprite-Nachtrag. Die ~40 Amboss-
      Balancewerte (`data/balance.json: boss.anvil`) sind ebenfalls noch
      nicht am echten Spielgefühl geprüft (kein gespielter Run verfügbar,
      s. Abschnitt-eigener Hinweis) — bei Bedarf nach echtem Testfeedback
      nachjustieren.

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
  `limits.json`, `sounds.json`, `status.json`). `data/upgrades_necro.json`
  liegt bewusst daneben, nicht darin — 115 Karten für den Nekromant-
  Signaturpool (105 aus Nekromant-V2 + 11 aus dem Champion-/Nekromant-
  Nachschliff v2, minus die entfernte `ghost_068`), seit Nekromant-V2
  Phase 9 additiv in `main.js: init()` in `upgradesData.upgrades` gemischt —
  voll in der Angebots-Pipeline. `data/glossary.json` (Champion-/Nekromant-
  Nachschliff v2) liegt ebenfalls daneben: reine Begriffs-/Erklärungspaare
  fürs Kartentext-Glossar (`src/ui/glossary.js`), keine Balance-Werte.
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
  Nekromant-V2 Phase 2: `applyResistToAmount()`/`absorbWithShieldPool()`
  (Modulebene, nicht Methoden auf `state`) — Schadensresistenz (additiv,
  `Schaden/(1+resistSumme/divisor)`, nie 0 dank `max(1,…)`) und der neue
  Schild-Punktepool (`tank.shield`/`cfg.shieldMax`, überspringt DOT wie alle
  anderen Schilde). Beide gebraucht von `applyDamage()` (Spieler/Gegner) UND
  der getrennten Geister-Kollisionsschleife (Untertanen sind ausdrücklich
  mitgemeint). `bullet.pierce`/`bullet.pierceHits`: Durchschlag statt
  `b.dead` bei verbleibender Ladung, Trefferliste verhindert Doppeltreffer.
  Nekromant-V2 Phase 8: `t.necroAuraWeakened` (`ghost_070`, in beiden
  Trefferschleifen-Richtungen gelesen), `ghost_075`/`082` direkt nach
  `applyTypeEffects()` in der Haupt-Trefferschleife, das
  `rg.invulnUntil`-Gate + `ghost_079`/`084`s Rettungsblock in der
  Geist-vs-Geschoss-Kollisionsschleife (VOR `killGhost()`). Nekromant-V2
  Phase 9: `killTank()`s Wiederbelebungsblock kennt jetzt eine GARANTIERTE
  nächste Probe (`state.necroGuaranteedReviveUntil`/`necroCircleGuaranteedRevive`,
  `ghost_089`/`104`, beide sofort nach Verbrauch zurückgesetzt) und
  `ghost_101`s eigenen Chance-Bonus bei Untertan-Kills; `ghost_088`s
  Bonus für den nächsten wiederbelebten Untertan (gedeckelt, VOR
  `pushGhost()` angewendet); `state.necroLastPlayerHitTarget`/`ghost_093`s
  Champion-Kill-Zähler + Spawn und `ghost_095`s Schadensumleitung auf den
  Champion (durch dieselbe Resistenz-/Schildpool-Kette) sitzen in der
  Haupt-Trefferschleife. Nekromant-V2 Phase 10: derselbe Revive-Block zählt
  jetzt `state.necroReviveRolls`/`necroReviveHits` — Rolls bei jeder ECHTEN
  Probe (`canRevive`), Hits nur wenn wirklich ein Untertan entstand
  (`spawnedAny`), nicht schon bei „Wurf < Chance" (kann am vollen Limit ins
  Leere laufen).
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
  für die `magBlockedTime`-Telemetrie). Nekromant-V2 Phase 9: `useGadget()`
  bekommt drei Opfer-Aktivkarten-Zweige (`ghost_031`/`089`/`096`, alle über
  `state.js: killGhost(..., 'sacrifice')` — die neue dritte `cause`) nach
  demselben "ohne Ziel keine Wirkung, kein Verbrauch"-Muster wie `layMine()`.
- `src/game/mortar.js` — Mörser-Waffe (Grundsteinumbau Phase 3, `t_green`):
  `fireMortar`/`updateMortars`. Kein physisches Geschoss (`state.mortars`
  statt `state.bullets`) — Deflektor/Frontpanzerung greifen dadurch
  automatisch nicht. Einschlag über den vorhandenen `mine.js: explodeAt()`.
- `src/game/spider.js` — Spinnenboss (Akt 3): `stepSpiderBoss`
  (Bewegung/Phasenlogik, Muster `bossai.js`), `updateSpiderLegHits` (MUSS
  vor der generischen Panzer-Trefferschleife laufen, s. eigener
  CLAUDE.md-Abschnitt), `damageSpiderLegsInRadius`, `updateSpiderWebs`
  (HP-basierte Zerstörung), `spiderAimPoint` (Geister/Champion zielen auf
  ein Bein statt den geschützten Körper). Exportiert außerdem die
  Uhr-Winkel-Tabellen (`LEG_SLOTS`/`JOINT_DEG`/`FOOT_DEG`/`deg2rad`) für
  `spidermine.js` und `spiderrender.js` — eine Quelle statt zwei Kopien.
- `src/game/spidermine.js` — Spinnenminen, Erweiterung von `mine.js`
  (`createMine`/`explodeAt` wiederverwendet, kein zweites Explosions-
  system): `spawnSpiderMine`/`updateSpiderMines`/`detonateSpiderMine`.
  Eigenes, geteiltes BFS-Distanzfeld vom Spieler aus (`rebuildFlowField`,
  höchstens alle `repathS` neu bzw. sofort bei Rasterzellenwechsel).
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
- `src/game/ghost.js` — Untertanen/Geisterpanzer. **Champion-Nachschliff**
  (aktuellster Umbau, s. eigener Abschnitt oben): `isChampion` ist STICKY
  (`promoteToChampion()`/`ensureChampion()`, nie mehr per-Tick neu bewertet),
  Champion-Basiswerte kommen aus `championStatPct` × den AKTUELLEN
  Spielerwerten (nicht mehr vom Typ geerbt), Fusionsboni sind additive Betraege
  (`fusionHpBonus`/`fusionDamageBonus`/`fusionFireRateBonus`) aus den
  Basiswerten DES VERSCHMOLZENEN, nie des Champions. Seit Nekromant-V2 Phase 3
  grundlegend neu (ersetzt den festen `ghost_tank`-Basistyp aus
  Upgradepool-v2 Phase 7, archiviert in `archive/ghost-tank-v1.json`):
  **Typ-Vererbung** — `resolveGhostCfg(data, sourceType, playerCfg)` baut
  auf `resolveCfg(data, sourceType)` auf (Rolle/Waffe/Panzerung/Tempo
  unverändert des Quelltyps), nur `maxHp`/`damage` gestutzt auf
  `balance.ghost.baseStatPct`. `createGhost(state, x, y, heading,
  sourceType)` braucht jetzt zwingend den Quelltyp; beide Erzeuger reichen
  ihn durch: `state.js: killTank()`s Spawnwürfel den Typ des getöteten
  Gegners, `tank.js: spawnGhostBomb()`s Geisterbombe einen zufälligen Typ
  aus `state.actEnemyPool` (Fallback `t_brown`). `g.lifetime`/`lifetimeMax`
  (NEU, `balance.ghost.lifetimeS`) — ein Ablauf ist ein ANDERER Todes-
  Auslöser als Schaden (`killGhost(state, g, 'expire')` überspringt die
  kartengebundenen Todes-Mechaniken). `g.isChampion` (NEU, dynamisch, jeden
  `updateGhosts()`-Tick neu über `balance.ghost.strengthWeights` bestimmt,
  kein Kartengate) — NICHT verwechseln mit dem älteren, kartengebundenen
  (aktuell toten) `isCommander`. Eigenes `state.ghosts`-Array, kein Eintrag
  in `state.tanks` (blockiert keine Kugeln, zählt nicht gegen
  `limits.enemiesAlive`). Seit Upgradepool-v2 Phase 8: dieselbe
  `resolveGhostCfg()` legt 16 `ghost*`-`core`-Schlüssel (aus den seit
  Grundsteinumbau Phase 4 archivierten `sig_necro_*`-Karten, aktuell also
  unerreichbar) additiv/multiplikativ oben drauf; `killGhost(state, g,
  cause)` ist bei `cause==='damage'` (Standard) weiterhin der zentrale Ort
  für Phylakterium/Wiederkehr-Familie/Letzter Wille — bei jedem ECHTEN Tod
  (nicht bei den beiden "überlebt doch"-Zweigen) ruft es zuletzt
  `necro.js: onGhostRemoved()` auf. Nekromant-V2 Phase 6: `resolveGhostCfg()`
  liest sechs weitere Felder (`ghostBulletSpeedMult`/`ghostRangeMult`
  gemeinsam auf `fireRangePx`, `ghostCritChanceAdd`/`ghostCritMultAdd`,
  `ghostResistAdd`); `createGhost()` addiert `ghostLifetimeAdd` auf
  `lifetimeMax` und `ghostShieldOnSpawnPct` als Einmal-Spawn-Schild
  (zusätzlich zu `shieldMax`, kann diesen Deckel überschreiten). In
  `updateGhosts()`: eigener Krit-Wurf für Geistergeschosse (`g.cfg.
  critChance`, setzt bewusst KEIN `critMultBonus`-Feld auf der Kugel — der
  Wert steckt schon in `g.cfg.critMultBonus`, ein zusätzliches Feld würde
  ihn doppelt zählen) und eine von der Turmrichtung ENTKOPPELTE
  Bewegungsrichtung (`moveAngle`/`aimDx`+`aimDy` getrennt von
  `dx`+`dy`) für `ghost_010`s Flankenanflug. Nekromant-V2 Phase 7 (Legion):
  `occupiedGhostSlots(state)` (Plätze statt Anzahl, `ghost_056`) und
  `recomputeLegionCache(state)` (die zähler-basierten Legion-Karten, „nicht
  pro Frame" — aufgerufen von `killGhost()` UND den beiden Erzeugungs-
  stellen in `state.js`/`tank.js`) sind neu und exportiert.
  `resolveGhostCfg()` liest jetzt auch `ghostHpMult`/`ghostDamageMult`
  (**Bugfix**: waren seit Upgradepool-v2 Phase 8 nie gelesen worden).
  `createGhost()`s neuer `overrides`-Parameter (`{baseStatPctOverride,
  slotCost}`) bedient `ghost_052`/`056`/`060`, sowie einen Grabfeld-Bonus
  (`ghost_059`, `state.necroGraveyardSpots`). `updateGhosts()` bewertet die
  drei Abstandsauren (`ghost_042`/`048`/`049`) live jeden Tick (position-
  sabhängig, bewusst NICHT im Cache) und konsolidiert Sturmformation
  (`047`)/Veteranen (`046`)/Munitionsaustausch (`050`)/Erbmunition (`051`)/
  Legionskern (`054`) am Feuerzeitpunkt. Nekromant-V2 Phase 8 (Alpha und
  Verschmelzung): `pushGhost(state, g)` (neu, exportiert) ist der EINZIGE
  Erzeugungs-Hook für alle sechs Aufrufstellen — wertet `necroUniqueThrone`
  (`ghost_071`) aus und delegiert an `fuseGhost()`/`applyFusionTransfer()`
  bei Bedarf. Champion-Bestimmung steht jetzt am ANFANG von `updateGhosts()`
  (vorher am Ende) — Kronen-/Anker-/Aura-Karten (`necroCrown*`) werden
  DANACH live gegen `g.isChampion` ausgewertet, „Getrennte Buchführung":
  Basiswerte (Phase 3), Fusionsboni (`g.fusionHpFrac`/`-DamageFrac`/
  `-FireRateFrac`/`fusionCount`, pro Instanz — die einzigen, die
  `state.necroCrownHeir`/`createGhost()`s Kronenerbe-Zweig übertragen),
  Kronenboni (stateless, kein Übertragungsbedarf). Nekromant-V2 Phase 9
  (Hybride und Aktivkarten): `pushGhost()` bekommt einen zweiten
  Sonderfall NACH `necroUniqueThrone` — `necroCapFusion` (`ghost_098`)
  verschmilzt bei VOLLEM Geisterlimit den vorhandenen SCHWÄCHSTEN
  Nicht-Champion in den Champion, statt den ankommenden Geist erscheinen
  zu lassen. `fuseGhost()` bekommt einen optionalen 4. Parameter
  `overrideFrac` (eigene, von 071/072/085 unabhängige Übertragungsrate) und
  einen `isAncestor`-Zweig (`ghost_105`, Buff beim Verschmelzen des
  Urahns). `killGhost(state, g, 'sacrifice')` (dritte `cause`, s. tank.js:
  `useGadget()`) überspringt wie `'expire'` die drei kartengebundenen
  Todes-Mechaniken; zusätzlich Delta-basierte Bonusübertragung an den
  Spieler (`ghost_094`, Champion-Tod) bzw. den gesündesten Überlebenden
  (`ghost_100`, `state.necroSuccessionUsed`) und der Urahn-Buff-Zweig
  (`ghost_105`, Schaden/Ablauf-Pfad). `updateGhosts()`s Live-Auren-
  Vorpass bekommt zwei weitere Champion-Karten (`ghost_102` „Kronengarde":
  Resistenz je anderem Untertan oder periodischer Solo-Schild;
  `ghost_103` „Massenkrone": delta-nachgeführter `maxHp`-Bonus je
  Geisterplatz über der Schwelle, plus Solo-Feuerrate) sowie zwei neue
  Faktoren in der Feuer-Schadenskette (`hybridMult` für `ghost_086`s
  zeitlich befristeten Untertanen-Bonus, `crownProcMult` für `ghost_099`s
  live Je-Verbündeten-Bonus PLUS den halb-permanenten Anteil aus
  `state.necroCoronationPermDmgPct`). Nekromant-V2 Phase 10 (Lesbarkeit und
  Telemetrie): `pushGhost()` ruft einen neuen Helfer `spawnGhostAppearEffect()`
  an den beiden ECHTEN Erscheinungs-Ausgängen (Ton `ghost_rise` + Partikel +
  `state.necroGhostsCreated`-Zähler) — nicht im Verlierer-Zweig von
  `necroUniqueThrone` oder bei `necroCapFusion` am Limit, da dort kein
  eigenständiger Geist entsteht. `fuseGhost()`/`killGhost()` zählen
  zusätzlich `state.necroGhostsFused`/`state.necroGhostsDiedByReason`.
  `updateGhosts()`s Champion-Bestimmung sampelt `state.necroChampionStrengthSum`/
  `-Samples` jeden Tick mit lebendem Champion (zeitgewichtete Stichprobe).
- `src/game/necro.js` (Nekromant-V2 Phase 5, seit Phase 6 angeschlossen) —
  Ereignis-/Stapelschicht für den 105-Karten-Pool `data/upgrades_necro.json`.
  `onGhostRemoved(state, ghost, reason)` ist das zentrale Ereignis (vier
  Auslöser: `death_damage`/`death_expire`/`fusion`/`sacrifice`,
  `countsAsGhostDeath()` = die "löst Todeseffekte aus"-Tabelle aus dem
  Auftrag, `fusion` bewusst ausgenommen) — kennt nie eine Karten-ID, iteriert
  nur `state.necroListeners`. Stapel: `addNecroStack`/`getNecroStack(state,
  'room'|'run', key)` (raumweit `state.necroStacks`, runweit über
  `state.necroRunStackGain` + `state.necroRunStacksBase`, s. `run.js`),
  `addNecroTimedStack`/`getNecroTimedStack`/`tickNecroTimers` (zeitlich
  befristet, eigene Restlaufzeit je Schlüssel), `countThresholdCrossings(
  before, after, n)` (reiner Rechenweg für "Zähler"-Karten, keine
  Obergrenze/kein NaN durch Ganzzahlteilung auf dem Gesamtwert). Interne
  Abklingzeiten sind je Effekt-Schlüssel über `state.time` gegated (nicht
  global). `applyVirtualNecroDeaths(state, count)` ist der im Auftrag
  verlangte Prüfstein für `ghost_035` — bypasst Buchführung/Protokoll/
  Abklingzeit bewusst, trifft seit Phase 6 nur noch `scope:'room'`-Listener
  MIT `pureStack:true` (verschärft gegenüber Phase 5, seit es echte
  Listener mit Seiteneffekten gibt). **Phase 6**: `buildNecroListeners(state,
  cfg)` (neu) trägt beim Raumaufbau aus dem aufgelösten Spieler-`cfg` echte
  Listener-Einträge ein (`ghost_011`–`035` außer der Aktivkarte
  `ghost_031`) — die Brücke von der reinen Infrastruktur zu spielbaren
  Karten. `pureStack` (neuer Listener-Flag) markiert einen Listener ohne
  jeden Seiteneffekt (aktuell nur `ghost_011`/`012`/`013`); `onGhostRemoved()`
  berechnet daraus einen Stapel-Multiplikator für `ghost_027`/`028` und
  reicht ihn als 4. Parameter `mult` an `fn(state, ghost, reason, mult)`
  durch. `necroDamagePct`/`necroFireRatePct`/`necroSpeedPct`/
  `necroResistBonus(state)` summieren am Ort der Verwendung (`tank.js`/
  `state.js`) über eine feste, bekannte Liste reservierter Schlüssel (s.
  eigener CLAUDE.md-Abschnitt „Phase 6" oben). **Phase 9** (Hybride und
  Aktivkarten): `onGhostRemoved()` bekommt einen zweiten, NACH dem
  normalen `reasons`-Durchlauf laufenden Zweig, der bei `reason ===
  'fusion' && cfg.necroFusionHalfDeathForStacks` (`ghost_092`) ALLE
  `pureStack`-Listener (unabhängig von deren eigenen `reasons[]`) mit
  `mult: 0.5` erneut aufruft — eine Verschmelzung zählt damit als halber
  Geistertod für raumweite Spielerstapel, ohne Seiteneffekt-Listener
  (Heilung/Explosion/Abklingzeit) ein zweites Mal auszulösen.
  `buildNecroListeners()` bekommt acht neue Einträge (`ghost_086`/`087`/
  `090`/`091`/`097`/`099`/`104`, alle mit `DEATH_REASONS`, `ghost_097`/`104`
  zusätzlich mit `'fusion'` in ihren eigenen `reasons[]`). `ghost_091`
  „Lawine der Toten" nutzt bewusst KEIN generisches `l.cooldownS` — das
  würde schon die reine Todes-Zählung sperren, bevor 3 Tode innerhalb des
  5-s-Fensters gezählt werden können (echter Bugfund beim eigenen Testbau,
  gefixt: eine manuelle `state.necroAvalancheCooldownUntil`, erst gesetzt
  NACH einem erfolgreichen Auslösen). `necroDamagePct()` bekommt sechs
  weitere Timed-Stack-Terme (`ghost_086`/`091`/`095`/`096`/`104`/`105`)
  plus `ghost_088`s LIVE Je-Untertan-Term (aus `state.necroActiveGhostCount`,
  NICHT `state.necroCoronationPermDmgPct` — das wirkt laut Kartentext nur
  auf den Champion, s. `ghost.js`).
- `src/game/ai.js` — Gegner-KI-Dispatcher + Zielsystem (Upgradepool-v2
  Phase 5): `resolveTarget`/`pickTarget`/`updateTargeting`/`registerThreat`
  wählen zwischen Spieler und Geistern statt hart auf `state.player` zu
  zielen (Details im eigenen Phase-5-Abschnitt oben).
- `src/game/bossai.js` — Boss-Sonderbewegungen (Phase 14): `stepMirrorBoss`
  (Punktspiegelung der Spielerposition), `stepPhalanxBoss` (rotierende
  5er-Formation); bypassen `DRIVES`/`updateEnemy()`, Turm/Feuern bleibt
  die normale `roleTurret()`-Logik. Zielwahl (Upgradepool-v2 Phase 5):
  zeitgesteuerter Wechsel zwischen Spieler-Fixierung und `ai.js: pickTarget`.
  Nekromant-V2 Phase 10: `state.bossShotsAtPlayer`/`bossShotsAtGhost` zählen
  NUR echte Treffer von `fireBullet()`s RÜCKGABEWERT, nicht `roleTurret()`s
  bloße Feuerabsicht (echter Bugfund, s. eigener Abschnitt oben — `if (fire)`
  allein zählte ein Vielfaches der echten Schüsse). `stepMirrorBoss`/
  `stepPhalanxBoss` laufen im echten Spiel aktuell nie (Akt 2 nutzt seit
  dem Amboss-Auftrag `t_anvil` statt `t_mirror`, Akt 1 bleibt der
  `t_black`-Platzhalter, s. u.) — `stepAnvilBoss` (Akt 2, s. u.) wird nur
  noch per Re-Export aus `anvil.js` durchgereicht.
- `src/game/anvil.js` — Amboss (Akt 2, Amboss-Auftrag): eigenständiger
  Zustandsautomat `stepAnvilBoss()` (15 Zustände, deterministische
  Angriffsauswahl nach Zornband, kein RNG). Bewegung/Kollision der drei
  Angriffe laufen komplett außerhalb von `moveTank()`/`DRIVES` (Muster wie
  `stepMirrorBoss`/`stepSpiderBoss`), inkl. einer eigenen substep-genauen
  Wandtreffer-Erkennung (`moveChargeSubsteps()`, unterscheidet Außen- von
  Innenwand). `showAnvilHint()` (einmalige Lernhinweise über
  `storage.js: getFlag/setFlag`) ist die einzige weitere Exportfunktion,
  beide werden ausschließlich über `bossai.js` re-exportiert (Auftrags-
  vorgabe: „Implementiere stepAnvilBoss() in src/game/bossai.js"). Kennt
  kein `fireBullet()`/`roleTurret()` — der Amboss feuert nie.
- **`data/tanks.json: bulletSpeeds`** — Kugeltempo je `weapon`-Wert. **Jeder
  in `types[].weapon` vorkommende Wert braucht hier einen Eintrag** (oder
  einen typeigenen `bulletSpeed`-Override), sonst löst `resolveCfg()` ihn zu
  `undefined` auf und jede Folgerechnung wird still `NaN` (Bugfix
  „non-finite ab Mitte Akt 2"). `resolveCfg()` hat dafür seit dem Fix einen
  Rückfall auf `bulletSpeeds.bullet`, ein Strukturtest (Abschnitt 68a)
  bewacht die Lücke trotzdem.
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
  `ghostCommanderMultBonus`). Nekromant-V2 Phase 6 fügt sechs weitere
  `ghost*`-Schlüssel (Lifetime/Bullet-Tempo/Reichweite/Krit/Schild-Spawn/
  Resistenz/Flankenverhalten, ebenfalls über `ghost.js` gelesen) und ~25
  neue `necro*`-Schlüssel hinzu, die NICHT auf den Spieler-cfg direkt
  wirken, sondern von `necro.js: buildNecroListeners()` beim Raumaufbau in
  echte `state.necroListeners`-Einträge übersetzt werden (Details im
  Phase-6-Abschnitt oben) — derselbe generische Muster-Bruch wie bei
  `ghost*`, nur eine Ebene weiter (Listener statt direkter cfg-Wert).
  Nekromant-V2 Phase 9 fügt ~40 weitere `if (c.xyz)`-Zweige für die
  20 Hybrid-/Keystone-Karten hinzu — keine neue Applier-Architektur, nur
  mehr Zeilen derselben Schleife.
- `src/game/upgradepool.js` — Auswahl-Pool. Filter in `buildCandidates()`:
  `rarity` (fünf Stufen), `isUnique` (Nekromant-V2 Phase 1: ersetzt
  `maxStacks` ersatzlos — eine nicht-einzigartige Karte hat KEINE Obergrenze
  mehr, eine einzigartige fällt raus, sobald `chosen[id]>=1` ODER sie in
  `opts.selectedUniqueUpgradeIds` steht), `requires`, `minRoom`, Bannliste,
  `damageType` (Element der Klasse, LP-Phase 11), `signatureClass`
  (Klassenzugehörigkeit, LP-Phase 18), `exclusions` (Negativliste,
  Upgradepool-v2 Phase 6). Kartenbelohnung/Shop-Ueberarbeitung: das frühere
  globale `rarityGates` (Seltenheit erst ab Raum X ÜBERHAUPT ziehbar) ist
  ERSATZLOS ENTFERNT — Seltenheit läuft seither ausschließlich über
  Gewichtung, nie mehr über Eligibility. Gewichtung: tier-normiertes
  `weightedPick` (unverändert seit LP Phase 10) × Synergie (`tags[]` gegen
  `run.synergyTags`, Phase 3), mit `weights` aus `opts.rarityWeights` —
  `rewardRarityWeights(balance, totalRoomIndex)`/`shopRarityWeights(balance,
  shopsVisited)` (neu, exportiert) wählen je nach Kontext das passende Band
  aus `data/balance.json: rewardRarityBands`/`shopRarityBands`, Fallback auf
  die flache `balance.rarity` ohne Baender. `dedupeKey()` dedupt
  Signaturkarten auf die eigene `id` statt auf den gemeinsamen Tag
  `signature` (Phase 2) — deshalb dürfen mehrere Signaturkarten derselben
  Klasse gleichzeitig im Angebot stehen. Elite-/Treasure-Belohnungen umgehen
  Teile davon über `includeTag`/`onlyRarity`/`bypassRoomGate`/
  `ignoreTagRule`.
- **Upgrade-Felder in `data/upgrades.json`** (Stand nach Nekromant-V2
  Phase 1): `id`, `name`, `description`, `tag` (Hauptkategorie, treibt die
  Transformationen über `run.tagCounts`), `tags[]` (Synergie-Tags, treiben die
  Angebotsgewichtung über `run.synergyTags`), `rarity` (common/uncommon/rare/
  epic/legendary — Nekromant-V2 Phase 1: umbenannt von common/rare/epic/
  unique/legendary, „unique" gehört jetzt dem GETRENNTEN `isUnique`-Feld),
  `isUnique` (Boolean, ersetzt `maxStacks` — `false`/fehlend heißt
  unbegrenzt stapelbar, `true` heißt genau einmal pro Run wählbar, verwaltet
  über `run.selectedUniqueUpgradeIds`), `requires[]`, `minRoom`, `symbol`,
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
  Kartenbelohnung/Shop-Ueberarbeitung: `renderCards()` zeigt den
  individuellen, pro Karte gewürfelten Preis (`o.price`) statt eines
  Abschnittstitels mit Einheitspreis.
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
  keine Spiellogik. Nekromant-V2 Phase 10: `recordRoom()` speichert ein
  neues `necro`-Feld (Untertanen erzeugt/gestorben-nach-Grund/verschmolzen,
  Wiederbelebungsquote-Rohdaten, Championstärke-Rohdaten, Bossschüsse),
  `null` bei jedem Nicht-Nekromanten-Raum; `computeMetrics()` aggregiert
  über alle Runs zu Quote/⌀ Championstärke/Bossschuss-Anteil in Prozent.
- `src/ui/glossary.js` (Champion-/Nekromant-Nachschliff v2, neu) —
  `initGlossary(data)`/`highlightTerms(text)` (markiert bekannte Begriffe aus
  `data/glossary.json` blau, HTML-escaped) / `installGlossaryTooltips(doc)`
  (ein delegierter Klick-Listener fürs mobile Antippen). Eingehängt in
  `upgradescreen.js`/`roomscreens.js`, einmalig initialisiert in `main.js`.
- `sw.js` — Service Worker (Offline-fähig). **Strategie: network-first für
  Code+Daten (HTML/JS/JSON), cache-first für Bilder/Fonts.** Cache-Version
  bumpen + `data/*`/`src/*` in `ASSETS` eintragen! (Aktuell `v117`; dabei
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
- Kacheln `tile_{floor,wall,breakable,hole}.png` (jetzt der Fallback, s. u.),
  Geschosse `bullet_{normal,rocket,bounce,tungsten,explosive}.png`.
- **Kinderzimmer-Reskin (Nutzergrafik):** der Boden ist kein Kachel-Tile mehr,
  sondern ein ganzflächiges Hintergrundbild `arena_kinderzimmer_768x512.png`
  (`SPRITES.arena`, EINMAL in voller Arenagröße gezeichnet). Normale und
  beschädigte/zerstörbare Wände ziehen ihr Sprite aus zwei horizontalen
  Variantensheets (`tile_wall_sheet_20x64.png`/`tile_breakable_sheet_7x64.png`,
  `SPRITES.tileSheet`, je 64×64 pro Variante), deterministisch nach
  Rasterposition gewählt (`renderer.js: wallVariantHash()`, kein RNG). Das
  Loch bleibt ein einzelnes Bild (`tile_hole.png`, jetzt ein Spielzeughaufen
  statt einer Grube). Alle alten `tile_*.png`-Einzelbilder bleiben als
  Fallback bestehen, falls das jeweilige neue Sheet/Hintergrundbild (noch)
  nicht geladen ist.
- Typen: `player`, `t_brown`, `t_grey`, `t_teal`, `t_yellow`, `t_pink`,
  `t_green`, `t_purple`, `t_white`, `t_black`. `t_armored` und `t_prism`
  haben **keine eigenen Sprites** — `sprites.js` mappt sie über
  `SPRITE_ALIAS` auf `t_grey`/`t_teal`; ihre Identität ist das
  Panzerungs-Overlay. `t_anvil` (Amboss, Akt 2) aliast ebenso auf `t_black`
  — seine Identität trägt vollständig das Zornband-Farb-Overlay in
  `renderer.js: drawTank()` (s. eigener Abschnitt „Amboss (Akt 2)").
- **Klassen-Sprites (Nutzergrafik):** `c_frost`, `c_flame`, `c_necro`,
  `c_blast` haben jetzt **eigene** `body_*/turret_*`-Sprites; die übrigen
  fünf Klassen (`c_tesla`/`c_toxic`/`c_scrap`/`c_ricochet`/`c_engineer`)
  borgen sich weiter `player` über `SPRITE_ALIAS`.
- **Geisterpanzer-Sprite** `body_ghost.png`/`turret_ghost.png`: EIN
  gemeinsames, durchscheinend gezeichnetes Sprite für **alle** Panzer, die
  zum Geist werden (`renderer.js: drawGhosts`, `globalAlpha 0.55`), mit
  Fallback auf die alte prozedurale Form. Nicht an einen Panzertyp gebunden.
- **Champion-Sprite** (Nutzergrafik): `body_champion.png`/
  `turret_champion.png` (dieselbe Rotationskonvention wie oben, aber
  volldeckend `globalAlpha 0.92` statt der Geister-Transparenz) NUR für
  `g.isChampion`, plus eine 12-Frame-Loop-Animation
  `champion_aura_00.png`…`_11.png` (`SPRITES.championAura`,
  `championAuraFrame(index)`), screen-aligned OHNE Rotation hinter dem Tank
  gezeichnet, dauerhaft im Loop bei 12 fps über `state.time`. Der
  bestehende goldene Ring bleibt zusätzlich bestehen (Fallback, falls das
  Sprite nicht lädt).
- Spieler-Glow, Schild-Ring, Ziellinie, Betäubungs-Ring und die
  Unsichtbarkeit des Weißen sind Renderer-Overlays (nicht im Sprite).
- **Spinnenboss (`t_spider`) hat jetzt echte Sprites** (Nutzergrafik-
  Nachtrag, s. eigener Abschnitt „Spinnenboss-Sprites"):
  `body_t_spider.png`/`turret_t_spider.png` (eigenes Modul
  `src/render/spiderrender.js` statt `renderer.js`/`effects.js` weiter
  wachsen zu lassen), `spider_leg.png` (EIN gemeinsames Bein-Sprite für Boss
  UND Minen, rotiert/skaliert als Zeiger vom Gelenk zum Fuß),
  `body_spider_mine.png`, `spider_web.png`. Jede Zeichenfunktion fällt ohne
  geladenes Sprite unverändert auf die alte prozedurale Form zurück.
  `drawTank()` in `renderer.js` überspringt `cfg.spiderBoss`-Panzer
  weiterhin explizit ganz am Anfang, damit kein doppelter (generischer +
  Spinnen-eigener) Körper gezeichnet wird.

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
node tests/championsprite.mjs       # Champion-Sprite/-Aura (dependency-frei, EIGENER erfolgreicher Image-Stub)
node tests/spidersprites.mjs        # Spinnenboss-Sprites (dependency-frei, EIGENER erfolgreicher Image-Stub)
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
**Overlay- und Touch-Verhalten mit `tests/domstub.mjs`** (dessen Fake-Canvas
**wirft seit dem Bugfix „non-finite ab Mitte Akt 2" bei nicht-endlichen
Zahlenargumenten wie ein echter Browser** — dadurch bewacht jeder
Renderpfad-Test diese Fehlerklasse automatisch mit; inkl.
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
Kartenraum-Rechnung). **Abschnitt 54** bewacht **Grundsteinumbau Phase 10**
(Abnahme, letzte Phase des Grundsteinumbaus: kein Abpraller auch strukturell
nicht mehr möglich, Frontpanzerung reflektiert weiterhin + `ownBullet`,
Vorhaltemarkierung gegen die analytische Abfanglösung, `magBlockedTime` real
bei 450er-Kugeln, Mörser-Radius auf beiden Seiten, `bossHpMult` an zwei
echten Bossräumen, Fortsetzen über eine Aktgrenze, Akt-2/3-Kartendeterminismus,
Schatzkammer-Preis/-Ertrag exakt) — damit ist der gesamte
`AUFTRAG-GRUNDSTEINUMBAU.md` (Phasen 0–10) abgenommen. **Abschnitt 64**
bewacht die Kartenbelohnung/Shop-Ueberarbeitung: exakte Bandwahl an allen
acht Grenzen (Raum/Shop-Besuch), legendary deterministisch erreichbar in
Raum 1, ein kompletter Playthrough mit raumgenauem `totalRoomIndex`-
Inkrement + korrektem `shopsVisited`, individuelle Shop-Preise im richtigen
Band/stabil/exakt abgezogen, Resume reproduziert Angebote und Preise
identisch.
