# PANZERKNACKER — Ausbauplan (Roguelike-Tiefe)

Fünf Phasen, **eine pro Session**. Nicht am Stück abarbeiten. Nach **Phase 2**
sollten 15–20 Runs gespielt und die Telemetrie (`localStorage.runs`, Export
über `?debug=1`) ausgewertet werden — sonst wird **Phase 6** blind gebaut.

Jede Phase endet mit: geänderte Dateien nennen + 5 manuelle Handy-Testschritte.
Arbeitsregeln siehe `CLAUDE.md` (Branch, Commit/PR/Merge, SW-Cache-Bump,
Testen vor dem Push, alle Zahlen datengetrieben).

---

## Phase 1 — Telemetrie + Lesbarkeit ✅ (gemergt, PR #15)
Balance-Datei `data/balance.json`, lesbarere Geschosse/Minen, Run-Telemetrie
in `localStorage.runs`, Debug-Ansicht nur bei `?debug=1`.

---

## Phase 2 — Upgrade-Schema (Prompt 3) ✅ gemergt

Keine neuen Upgrade-Effekte — nur Struktur.

**Schema.** Jeder Eintrag in `data/upgrades.json` bekommt: `id` (eindeutig),
`tag`, `rarity` (`common`/`rare`/`legendary`), `maxStacks`, `requires`
(Array von `id`s, leer = keine), `minRoom`, `description` (eine Zeile).
Erlaubte Tags: `stat`, `weapon`, `defense`, `mobility`, `mine`, `terrain`,
`control`, `information`, `companion`, `scaling`, `synergy`, `reactive`,
`resource`, `pact`, `elite`. Alle bestehenden Upgrades migrieren, Tags nach
bestem Ermessen, Mapping auflisten.

**Auswahllogik** (`src/game/upgradepool.js` + `src/ui/upgradescreen.js`):
- 3 Karten pro Auswahl, **nie zwei mit demselben Tag**
- Seltenheitsgewichte aus `balance.json`: common 60, rare 30, legendary 10
- `legendary.minRoom: 5` global
- Kein Upgrade mehr bei erreichtem `maxStacks`
- Kein Upgrade mit unerfüllten `requires`
- Tags `weapon` und `elite` vom normalen Pool ausgeschlossen (noch nicht gezogen)
- Zu wenige gültige Karten → mit `stat`-Karten auffüllen statt crashen

**Neues Upgrade** (einziger Zusatz): `emergency_shield`, Tag `defense`,
Rarity `rare`, `maxStacks 3`, 3 Schildladungen pro Stack. Raumübergreifend,
keine Regeneration. Anzeige als Ringe um den Panzer.

**DoD:** Telemetrie protokolliert gewählte + abgelehnte Karten mit `id` und
`tag`. Keine Auswahl zeigt zwei gleiche Tags. Schild absorbiert genau 3
Treffer, gestapelt 6 bzw. 9.

---

## Phase 3 — Schrott (Prompt 4) ✅ gemergt

**Währung** `scrap` (Run-State). `balance.json`: `scrap.perRoom [1,3]`,
`scrap.eliteBonus 3`, `scrap.cost.reroll 2`, `scrap.cost.ban 1`,
`scrap.cost.fourthCard 3`, `scrap.cost.shieldCharge 4`.

**Upgrade-Screen** bekommt 4 Aktionen mit Preis, ausgegraut bei zu wenig
Schrott: *Neu würfeln* (alle 3 neu, Tag-Regel gilt), *Verbannen* (Karte raus
für den Rest des Runs), *Vierte Karte* (Tag-Regel gilt), *Schildladung*
(+1 Ladung auch ohne Schild-Upgrade).
Verbannte `id`s im Run-State (nicht `localStorage`), bei Run-Ende zurücksetzen.

**Anzeige.** Schrottstand permanent im HUD, Zahl-Animation beim Aufsammeln.

**Telemetrie:** Schrott pro Raum, jede Ausgabe mit Typ + Raumnummer, alle
verbannten `id`s.

**DoD:** Schrott nie negativ. Reroll respektiert Tag-Regel. Verbannte Karte
im selben Run nie wieder, im nächsten Run wieder.

---

## Phase 4 — Türwahl (Prompt 5) ✅ gemergt

Riskant: ändert den Raumfluss. **Generator selbst nicht anfassen**, nur was
nach dem Räumen passiert.

**Türwahl.** Nach jedem geräumten Raum zwei Türen (Typ + Symbol sichtbar),
ersetzt den automatischen Übergang. Typverteilung aus `data/difficulty.json`.

**Raumtypen:** `combat` (Standard), `elite` (höheres Budget, 1 Elite-Affix,
doppelter Schrott, Belohnung aus Tag `elite`), `treasure` (keine Gegner, 1
Legendary, kostet 1 Leben), `workshop` (Schrott ausgeben + Upgrade ablegen),
`event` (Textentscheidung aus `data/events.json`, 5 Beispiel-Events).

**Regeln:** Nie zwei gleiche Typen zur Wahl. Raum 1–3 immer `combat`.
`treasure` nicht bei 1 Leben. Kein `event`/`workshop` zweimal hintereinander.

**Elite-Karten** (neuer Abschnitt, Tag `elite`, nur aus Eliteräumen):
`beutepanzer`, `trophaee` (+1 Schildladung dauerhaft), `kriegsmaschine`.

**Telemetrie:** gewählter + abgelehnter Türtyp pro Raum, Event-Entscheidungen.

**DoD:** Run ohne Sackgasse durchspielbar. Kein Raumtyp ohne weiterführende
Tür. Zurücksetzen bei Run-Ende sauber.

---

## Phase 5 — Transformationen (Prompt 6)

Zähle pro Run gewählte Upgrades je `tag`. Bei 3 eines Tags automatische
Transformation aus `data/transformations.json`:
- `mine` → *Pionier*: eigene Minen verletzen dich nicht mehr
- `mobility` → *Kavallerie*: Rammen tötet Gegner ohne Elite-Affix
- `information` → *Taktiker*: Zeit auf 40 %, solange eine Kugel näher als 64 px
- `terrain` → *Baumeister*: eigene Wände halten doppelt so lange
- `control` → *Saboteur*: betäubte Gegner explodieren beim Aufwachen

Fortschritt im Upgrade-Screen pro Tag als Zähler (z. B. 2/3). Freischaltung
mit deutlicher Einblendung (Name + Effekttext). Stacks zählen einzeln.

**Telemetrie:** freigeschaltete Transformationen pro Run mit Raumnummer.

**DoD:** Jede Transformation erreichbar. Keine verändert Werte im Code — alles
datengesteuert oder klar benannter Schalter.

---

## Phase 6 — Neue Karten in Wellen (Prompt 7 ff.)

**Nur Welle 1 pro Session.** Jede Welle beginnt mit Telemetrie-Auswertung
der angehängten Export-JSON: meistabgelehnte Upgrades + Raum, in dem die
meisten Runs enden. Danach genau die Wellen-Karten mit vollem Schema ergänzen.

**Welle 1:**
- Tag `weapon`, `maxStacks 1`, ersetzt den Standardschuss, `minRoom 3`:
  `doppelrohr` (2 Kugeln 12°, −1 Abpraller), `flak` (5 Kugeln Streuung,
  `lifetime 1.0`, keine Abpraller)
- Tag `control`: `emp_mine` (jede 4. Mine EMP: blau, kein Schaden,
  `stunRadius 96`, `stunDuration 1.5`, betäubte drehen Turm nicht, blockieren
  Geschosse, nehmen **nicht** an Ketten teil; HUD-Zähler),
  `stoersender` (Gegner im Radius 128 zielen 20 % ungenauer)
- Tag `information`: `ballistikrechner` (Flugbahn inkl. erstem Abpraller),
  `radar` (Warnpfeil am Rand für anfliegende Kugeln)
- Tag `resource`: `schrottsammler` (+1 Schrott/Raum, `maxStacks 2`)

**DoD:** Jede Karte erreichbar und tut, was ihr `description`-Text sagt.
Keine bricht Tag-Regel oder Schrott-Aktionen.

Weitere Wellen = Prompt 7 mit getauschter Kartenliste; der Telemetrie-Teil
bleibt jedes Mal (einziger Grund für die Trennung der Wellen).
