# Gegner- und Encounter-Design für Akt 2 und Akt 3

Designdokument, kein Auftrag zum sofortigen Bau. Es beschreibt **16 neue
Gegner** (8 für Akt 2, 8 für Akt 3), ihre Synergien, 20 Encounter, den
Einführungsplan und die technische Machbarkeit — jeweils gegen den **echten
Stand des Repos**, nicht gegen eine erinnerte Fassung.

**Grundlage der Analyse (gelesen, nicht rekonstruiert):** `data/tanks.json`,
`data/difficulty.json`, `data/balance.json`, `data/status.json`,
`data/modifiers.json`, `data/tiles.json`, `data/upgrades.json`,
`data/upgrades_necro.json`, `src/game/ai.js`, `ai_drives.js`,
`ai_turrets.js`, `cfg.js`, `run.js`, `state.js`, `mine.js`, `mortar.js`,
`spider.js`, `anvil.js`, `ghost.js`.

**Alle Zahlenwerte, die nicht direkt aus dem Projekt ableitbar sind, sind
als Vorschlag markiert** (`_todo: balance`). Sie sind aus den vorhandenen
Werten hergeleitet, nicht frei erfunden — die Herleitung steht jeweils dabei.

---

## 1. Analyse des bestehenden Spiels

### 1.1 Kampfkern (Ist-Werte)

| Größe | Wert | Quelle |
|---|---|---|
| Arena | 768 × 512 px, 24 × 16 Zellen à 32 px | `config.js` / Grid |
| Spieler-LP | 100 | `tanks.json: player.maxHp` |
| Spieler-Schaden | 10 | `tanks.json: player.damage` |
| Spieler-Magazin | 5 aktive Kugeln, Deckel 8 | `balance.json: bullet.maxActive/Cap` |
| Kugeltempo (Spieler) | 450 px/s, Wegbudget 1200 px (≈ 2,7 s) | `balance.json: bullet` |
| Gegnerschaden | **exakt 25 bei jedem** normalen Typ | `tanks.json` |
| Gegner-LP | 20 – 50 (= 2 – 5 Treffer) | `tanks.json` |
| Gegnergeschosse | Deckel 24 gleichzeitig | `balance.json: enemyBullet.maxActive` |
| Flanke / Heck | ×1,5 (110°) / ×2,5 (70°), gemessen zur **Wanne** | `balance.json: flank` |
| Exekution | ab 35 % LP garantierter Kill, Ziel wird 40 % langsamer und raucht | `balance.json: execute` |
| Krit | 5 % Grundchance, ×2,0, Deckel 35 %, **setzt Nachladen zurück** | `balance.json: crit` |
| Abpraller | **existiert nicht mehr** (Grundsteinumbau Phase 1) | `bullet.js` |
| Explosion | 40 Schaden, ignoriert Panzerung | `balance.json: damage.explosion` |
| Gegner pro Raum | max. 8 | `difficulty.json: maxEnemiesPerRoom` |

Der Kampf ist damit **kurz und tödlich in beide Richtungen**: der Spieler
stirbt an 4 Treffern, ein Standardgegner an 2–5. Zeit-zu-Tod ist auf beiden
Seiten niedrig — das ist die wichtigste Randbedingung für alles Folgende.
Ein Gegner, der den Kampf um 20 Sekunden verlängert, ohne eine Entscheidung
zu erzeugen, ist in diesem Spiel besonders schädlich.

### 1.2 Systemmatrix

| System | Vorhanden | Häufigkeit im Spiel | Bedeutung | Erweiterbar |
|---|---|---|---|---|
| Vier KI-Rollen (`guardian`/`sapper`/`hunter`/`sieger`) | ja | jeder Gegner | **hoch** | ja, datengetrieben |
| `aggression` / `accuracy` / `preferredRange` als Regler | ja | jeder Gegner | hoch | ja |
| Zielsystem (Spieler **oder** Geist), 4 Hz, Hysterese | ja | jeder Gegner | hoch | ja |
| Deckungs-KI (`coverDrive`, bricht Sichtlinie beim Anvisiertwerden) | ja | nur `aggression < 0.3` | mittel | ja |
| Gerichtete Panzerung (`armor.arc`, reflektierend) | ja | nur `t_armored` | mittel | ja |
| Flanken-/Heckschaden | ja | jeder Gegner | **hoch** | ja |
| Exekutionsschwelle | ja | jeder Gegner | hoch | ja |
| Minenlegen (`miner`) | ja | 4 Typen | mittel | ja |
| Mörser (zielpunktbasiert, keine Kugel) | ja | nur `t_green` | mittel | **ja, ideale Vorlage** |
| Statuseffekte (Feuer/Frost/Gift/Netz) | ja | nur Boss + Spielerklassen | niedrig **beim Gegner** | ja |
| Schadenstypen inkl. Blitzkette | ja | nur Spielerklassen | niedrig beim Gegner | ja |
| Schild als Punktepool (`cfg.shieldMax`) | ja | keine Nutzung beim Gegner | niedrig | ja |
| Schadensresistenz (`cfg.resist`, additiv, kein Deckel) | ja | keine Nutzung beim Gegner | niedrig | ja |
| Elite-Affixe (5 Stück) | ja | Eliteräume ab Raum 8 | mittel | ja |
| Zweite Welle (ab 6 Gegnern, bei 50 %) | ja | große Räume | mittel | ja |
| Raum-Modifikatoren (7) | ja | ab Raum 3, einer pro Raum | mittel | ja |
| Raum-Gefahren (Ölpfütze/Laser/Förderband/bewegliche Wand) | ja | ab Raum 3, eine pro Raum | mittel | ja |
| Wände zur Laufzeit setzen/entfernen (`setWallSolid`, `placeTrapWall`) | ja | Spieler-Gadget, Spinnenboss | niedrig | **ja** |
| Sichtblockade unabhängig von Geschossen (`blocksSight`, Rauch) | ja | Spieler-Gadget | niedrig | ja |
| Radiusschaden mit Aussparung (`explodeAt(..., spare)`) | ja | Minen, Mörser, Boss | hoch | ja |
| Schockwellen mit sicheren Lücken | ja | nur Amboss | — | ja |
| **Gegner-Zusammensetzung / Komposition** | **nein** | — | — | muss neu |
| **Gegner-Gegner-Interaktion (Buff/Heilung/Schutz)** | **nein** | — | — | muss neu |
| **Gegner, die Gegner erzeugen** | **nein** | — | — | muss neu |
| **Kontaktschaden** | **nur Boss** (`anvil.js: ramHitCheck`) | — | — | Vorlage vorhanden |

### 1.3 Wie ein Raum heute entsteht

`run.js: buyEnemies()` ist eine **rein zufällige Einkaufsschleife**: solange
Budget und Platz reichen, wird gleichverteilt aus allen freigeschalteten
Typen gezogen. `maxPerRoom` existiert im Schema, wird aber von **keinem**
Typ gesetzt. Es gibt keine Rollenquote, keine Paarbildung, keine
Mindestbesetzung, keinen Ausschluss.

Budget: `(acts[i].budget.base + roomIndex × perRoom) × Modus × Elite × Überfüllt`

| Akt | Raum 1 | Raum 9 | Raum 17 | Elite (×1,6) |
|---|---|---|---|---|
| 1 | 4,2 | 21,8 | 41,4 | — |
| 2 | 8,6 | 29,4 | 50,2 | 13,8 / 47,0 / 80,3 |
| 3 | 13,0 | 37,0 | 61,0 | 20,8 / 59,2 / 97,6 |

Ein Akt-3-Raum kauft also gegen Ende **61 Punkte** ein, bei maximal 8
Gegnern — der Durchschnittsgegner muss dort ≥ 7,6 Punkte kosten, sonst wird
das Budget gar nicht ausgegeben. Genau deshalb hat Akt 3 heute drei teure
Typen (9/8/12) und der Rest bleibt Füllmaterial.

### 1.4 Was der Spieler heute mitbringt

- **Zwei spielbare Klassen** (`player`, `c_necro`), acht sind geparkt.
- **Kartenpool für `player`: 8 Karten** (5 Sockel + 3 Legendäre). Für
  `c_necro`: 115 Karten mit drei Pfaden (Opfer / Legion / Alpha).
- Ein fester Bombenslot, ein tauschbarer Gadgetslot (beim Nekromanten
  gesperrt), Schrott, Rastplatz, Shop.

**Konsequenz für das Gegnerdesign:** Der Spieler hat als Standardklasse
kaum Buildvarianz. Gegner dürfen deshalb **nicht** voraussetzen, dass der
Spieler eine bestimmte Karte besitzt. Jede Antwort auf jeden neuen Gegner
muss mit dem **Grundpanzer** möglich sein — Karten dürfen sie leichter
machen, nie erst ermöglichen.

---

## 2. Bestehende Gegnerrollen (nach tatsächlicher Funktion, nicht nach Rollennamen)

| Gegner | Punkte | Akt | Technische Rolle | **Tatsächliche Funktion im Kampf** |
|---|---|---|---|---|
| `t_brown` | 1 | 1.1 | guardian, `accuracy 0` | **Zufallsdruck.** Steht, schwenkt blind, feuert. Erzeugt Hintergrundrauschen, keine Entscheidung. |
| `t_grey` | 2 | 1.1 | sapper, `aggression 0.17` | **Deckungssucher.** Wandert, bricht Sichtlinie beim Anvisiertwerden. Kostet Zeit, kein Druck. |
| `t_teal` | 4 | 1.3 | sieger, `preferredRange 220`, Rakete | **Abstandsdruck.** Hält Distanz, zielt gut (0.8). Erster Gegner, der Positionierung erzwingt. |
| `t_yellow` | 3 | 1.5 | sapper schnell, Minenleger | **Raumverknappung.** Bewegt sich viel, legt alle 2,5–6 s Minen. Verändert den Boden. |
| `t_pink` | 5 | 2.1 | hunter, `accuracy 0.72`, Magazin 3 | **Direktdruck.** Sucht Nähe, weicht Geschossen aus, feuert Salven. Der erste "echte" Kämpfer. |
| `t_armored` | 5 | 2.1 | hunter, `aggression 0`, Panzerung 120° reflektierend | **Winkelaufgabe.** Front reflektiert; man muss um ihn herum. Der einzige echte Positionsgegner. |
| `t_green` | 6 | 2.4 | guardian, Mörser, 1,7 s Flugzeit | **Flächenverweigerung.** Steht fest, bombardiert über Wände. Zwingt zum Weiterlaufen. |
| `t_purple` | 9 | 3.1 | hunter + `packFlank`, Magazin 5 | **Rudeldruck.** Flankiert ohne Sichtlinie, in Gruppen erdrückend. |
| `t_white` | 8 | 3.3 | hunter + `phaseToggle` (unsichtbar) | **Informationsverlust.** Wechselt zwischen zwei Rollen, ist zeitweise unsichtbar. |
| `t_black` | 12 | 3.6 | sieger, `leadAim`, `veryfast`, Minen | **Alleskönner.** Vorhaltezielen, schnell, Raketen, Minen. Der teuerste Einzelgegner. |

### 2.1 Verteilung nach Funktion

| Funktion | Anzahl | Gegner |
|---|---|---|
| Direkter Schussdruck | **6** | brown, grey, teal, pink, purple, black |
| Flächen-/Raumverweigerung | 2 | yellow, green |
| Positions-/Winkelaufgabe | 1 | armored |
| Informationsspiel | 1 | white |
| Unterstützung / Gegner-Gegner-Interaktion | **0** | — |
| Nahkampf / Kontakt | **0** | — |
| Beschwörer / Erzeuger | **0** | — |
| Zielprioritäts-Verzerrer | **0** | — |

Sechs von zehn Gegnern machen dasselbe: sie schießen auf den Spieler. Sie
unterscheiden sich in *Tempo*, *Genauigkeit* und *Kadenz* — also in Zahlen,
nicht in Funktion.

---

## 3. Designlücken

### 3.1 Redundanzen

- **`t_brown` und `t_grey`** sind Akt-1-Füllmaterial und in Akt 2/3
  bedeutungslos (1–2 Punkte bei 50 Budget). Sie werden trotzdem gekauft,
  weil die Einkaufsschleife gleichverteilt zieht — sie verbrauchen
  **Gegnerplätze** (max. 8), nicht Budget. Das ist ein aktiver Schaden am
  Encounter-Design: ein Akt-3-Raum kann aus 8 Gegnern bestehen, von denen 5
  irrelevant sind.
- **`t_pink`, `t_purple`, `t_white`** sind funktional dieselbe Rolle
  (`hunter`) mit unterschiedlichen Zusatzflags. `t_purple` und `t_white`
  unterscheiden sich in Magazin und Minenintervall überhaupt nicht.
- **`t_teal` und `t_black`** sind beide `sieger` mit `preferredRange 220`
  und Rakete. `t_black` ist `t_teal` mit besseren Zahlen plus `leadAim`.

### 3.2 Fehlende Spielerentscheidungen

Der Brief nennt 14 mögliche Entscheidungsachsen. Ist-Stand:

| Entscheidung | Existiert heute? | Wodurch |
|---|---|---|
| Zielpriorität ("wen zuerst?") | **fast nicht** | Alle Gegner sind gleich wichtig; man tötet den nächstbesten. |
| Positionierung | teilweise | `t_armored` (Winkel), `t_teal` (Distanz) |
| Distanzhaltung | teilweise | `t_teal`, `t_green` |
| Bewegung erzwungen | ja | `t_green` (Mörser), Minen |
| Timing | schwach | nur Mörser-Flugzeit |
| Ressourcen (Magazin/Bombe) | schwach | 5-Kugel-Sperre, aber selten spürbar |
| Raumkontrolle | teilweise | Minen |
| Sichtlinien | ja | `coverDrive`, `t_green` über Wände |
| Risiko/Belohnung | **nein** | Kein Gegner belohnt riskantes Verhalten |
| **Tötungsreihenfolge** | **nein** | — |
| Build-Anpassung | **nein** | Kartenpool zu dünn |
| Gegner-Zusammensetzung lesen | **nein** | Zusammensetzung ist Zufall |
| Kurz- vs. langfristig | **nein** | — |
| Schutz vs. Angriff | schwach | Schild/Dash, aber keine Zwangslage |

**Die drei größten Lücken:**

1. **Es gibt keine Tötungsreihenfolge.** Kein Gegner macht einen anderen
   Gegner gefährlicher, haltbarer oder wertvoller. Das ist die zentrale
   Akt-2-Aufgabe des Briefs — und sie ist heute technisch gar nicht
   ausdrückbar.
2. **Es gibt keine Komposition.** `buyEnemies()` würfelt. Zwei Räume mit
   identischem Budget können völlig unterschiedlich sein — aber zufällig,
   nicht absichtlich. Ohne ein Kompositionssystem sind "8 Akt-3-
   Kompositionen" nicht umsetzbar, egal wie gut die Gegner sind.
3. **Der Raum ist statisch.** Nach dem Betreten ändert sich die Geometrie
   nur durch die eine gewürfelte Gefahr. Nichts, was der Spieler tut oder
   was die Gegner tun, verändert den Raum dauerhaft.

### 3.3 Was daraus für den Auftrag folgt

Das wichtigste Ergebnis dieser Analyse ist **kein Gegner**, sondern ein
System: ohne **Kompositionsregeln in `buyEnemies()`** bleibt jeder neue
Gegner ein Zufallsfund. Abschnitt 17 und 20 nehmen das auf.

---

## 4. Akt-2-Designphilosophie

**Leitsatz:** Akt 2 führt vom *"Was macht dieser Gegner?"* zum *"Welchen
Gegner töte ich zuerst?"*

Akt 1 bringt dem Spieler das Grundvokabular bei: schießen, ausweichen,
flankieren, Deckung nutzen. Akt 2 darf das nicht wiederholen, sondern muss
**eine zweite Ebene** einziehen — und zwar genau eine, nicht drei.

### Regeln für Akt 2

1. **Jeder neue Akt-2-Gegner beantwortet für sich allein eine einzige
   Frage.** Wer ihn einmal isoliert gesehen hat, versteht ihn.
2. **Höchstens eine Interaktionsregel pro Gegner.** Der Anker entzieht
   Flanken- und Exekutionsbonus — das ist *eine* Regel mit zwei Wirkungen,
   nicht zwei Regeln.
3. **Unterstützer sind erlaubt, aber immer mit sichtbarem Faden.** Heilung,
   Schutz und geteilte Sicht werden gezeichnet. Wer die Linie sieht, kennt
   die Antwort.
4. **Kein Akt-2-Gegner darf den Spieler zwingen, einen Raum zu verlassen
   oder zu warten.** Druck ja, Wartezeit nein.
5. **Der Raum darf sich verändern — aber nur langsam und sichtbar.** Der
   Maurer baut, er löscht nicht.
6. **Alle vier "innovativen" Akt-2-Gegner greifen eine *bestehende*
   Spielerregel an**, statt eine neue einzuführen: Flanke, Deckung,
   Raumgeometrie, Kill-Zeitpunkt. Der Spieler lernt so, dass seine
   Werkzeuge situativ sind — das ist die eigentliche Akt-2-Lektion.

### Was Akt 2 bewusst NICHT tut

- Keine Gegner, die andere Gegner erzeugen (das ist Akt-3-Komplexität).
- Keine ketten- oder gruppenweiten Effekte (nur Radius oder 1:1-Bindung).
- Keine Effekte, die den Spieler dauerhaft beeinträchtigen.
- Keine unsichtbaren Gegner (das gehört `t_white` in Akt 3).

---

## 5. Akt-3-Designphilosophie

**Leitsatz:** Akt 3 führt vom *"Welchen Gegner töte ich zuerst?"* zum
*"Was ist das hier für eine Aufstellung?"*

Der Spieler kennt in Akt 3 alle Einzelrollen. Die Schwierigkeit darf
deshalb **nicht** aus höheren Zahlen kommen — sie kommt daraus, dass
bekannte Gegner in Kombination etwas Neues tun.

### Regeln für Akt 3

1. **Ein Akt-3-Gegner darf einfach sein.** Seine Gefahr entsteht daraus,
   *mit wem* er steht. Der Kettenhund allein ist ein schwacher Schütze.
2. **Keine Schwierigkeit durch absurde Werte.** LP bleiben im
   2–5-Treffer-Band (20–50), Schaden bleibt bei 25 (Ausnahmen begründet),
   Tempo bleibt in den vorhandenen Stufen.
3. **Jede Komposition hat einen Schlüsselgegner.** Es gibt immer einen Zug,
   der die Aufstellung entschärft. Er ist nicht immer der offensichtliche.
4. **Der Spieler muss mitten im Kampf umdenken dürfen.** Kompositionen
   verändern sich beim Sterben ihrer Teile (Verwerter wird stärker,
   Taktgeber-Rhythmus fällt weg, Kettenhund-Bindung reißt).
5. **Mindestens eine Antwort pro Aufstellung ist positional, nicht
   ballistisch.** Nicht jede Lösung darf "schieß es schneller kaputt" sein.
6. **Nichts wird dem Spieler weggenommen, was er nicht zurückholen kann.**
   Der Greifer zieht, aber die Leine ist zerschießbar. Der Verwerter wird
   stärker, aber sichtbar und rückwirkungsfrei tötbar.

### Verhältnis zu Akt 2

Akt 2 bringt 8 neue Gegner. Akt 3 erbt sie **alle** und stellt sie in neue
Zusammenhänge. Die 8 neuen Akt-3-Gegner sind deshalb überwiegend
*Verstärker fremder Rollen*, keine neuen Solo-Bedrohungen — genau umgekehrt
zu Akt 2.

---

## 6. Gegnerportfolio

### Akt 2 — 8 Gegner

| # | Name | ID | Kategorie | Rolle | Kernentscheidung | Punkte |
|---|---|---|---|---|---|---|
| 1 | Der Streuer | `t_shotgun` | konservativ | Nahkampf-Schrot | Distanz halten | 4 |
| 2 | Der Speerträger | `t_lance` | konservativ | Ladeschuss-Scharfschütze | Sichtlinie brechen, Timing | 6 |
| 3 | Der Zehrer | `t_medic` | konservativ | Reparatur-Unterstützer | Tötungsreihenfolge | 6 |
| 4 | Der Rammler | `t_rusher` | konservativ | Sturm/Kontakt | Raum verlassen, Timing | 3 |
| 5 | **Der Anker** | `t_anchor` | **alternativ** | Regelbrecher (Aura) | Lohnt Flankieren hier überhaupt? | 7 |
| 6 | **Der Horcher** | `t_relay` | **alternativ** | Geteilte Sicht | Deckung wirkt nicht mehr — wen ausschalten? | 5 |
| 7 | **Der Maurer** | `t_mason` | **alternativ** | Raumbauer | Raum zurückerobern oder umgehen | 6 |
| 8 | **Der Blindgänger** | `t_dud` | **alternativ** | Wandelnde Bombe | **Wo** und **wann** töte ich ihn? | 3 |

### Akt 3 — 8 Gegner

| # | Name | ID | Kategorie | Rolle | Kernentscheidung | Punkte |
|---|---|---|---|---|---|---|
| 1 | Der Feldwebel | `t_marshal` | konservativ | Kadenz-Unterstützer (sichtgebunden) | Töten oder Sicht brechen? | 9 |
| 2 | Das Bollwerk | `t_bulwark` | konservativ | Mobile Deckung | Umgehen oder durchbrechen? | 8 |
| 3 | Der Pirscher | `t_stalker` | konservativ | Hinterhalt | Wo ist er gerade? | 8 |
| 4 | Der Lichtbogen | `t_arclight` | konservativ | Kettenblitz-Artillerie | Auseinandergehen (auch die Geister) | 9 |
| 5 | **Der Kettenhund** | `t_tether` | **alternativ** | Schadensteilung über Kette | Kette lösen oder Partner zuerst? | 5 |
| 6 | **Der Verwerter** | `t_harvester` | **alternativ** | Leichenfresser | **Wo** sterben meine Gegner? | 10 |
| 7 | **Der Taktgeber** | `t_metronom` | **alternativ** | Synchronisierte Salven | Rhythmus lernen — oder ihn zerstören? | 11 |
| 8 | **Der Greifer** | `t_grabber` | **alternativ** | Positionsdiebstahl | Kugel für die Leine ausgeben? | 8 |

Je Akt **4 von 8** mit alternativer Mechanik (Anforderung: mindestens 4).

---

## 7. Die 8 neuen Akt-2-Gegner

> Alle Werte in den Blöcken folgen dem realen Schema aus `data/tanks.json`.
> Felder, die es noch nicht gibt, sind mit `//neu` markiert und in
> Abschnitt 17 technisch eingeordnet. Zahlen ohne direkte Ableitung tragen
> `_todo: balance` und eine Begründung.

### 7.1 Der Streuer

| Feld | Inhalt |
|---|---|
| **Name** | Der Streuer |
| **Interne ID** | `t_shotgun` |
| **Akt** | 2, ab Raum 2 |
| **Kategorie** | konservativ |
| **Rolle** | Nahkampfdruck / Zonenverbot auf kurze Distanz |
| **Designziel** | Der erste Gegner, gegen den **Nähe die falsche Antwort** ist. Der Spieler hat in Akt 1 gelernt, dass Flankieren belohnt wird (×1,5 / ×2,5) — der Streuer macht das Heranlaufen teuer, ohne es zu verbieten. |
| **Kernmechanik** | Feuert eine **Salve aus 5 Schrotkugeln** in einem 34°-Kegel. Jede Kugel macht 8 Schaden und stirbt nach 210 px Flugstrecke. Auf Tuchfühlung treffen fast alle (bis 40 Schaden), auf 200 px meist eine (8). |
| **Verhalten** | `hunter` mit hoher `aggression` — sucht aktiv Nähe, weicht Geschossen seitlich aus (bestehendes `hunterDrive`-Verhalten). Nach jeder Salve 1,4 s Nachladen, in denen er **weiter heranfährt**. |
| **Zielauswahl** | Standard `resolveTarget()`. Greift Geister genauso an wie den Spieler — auf kurze Distanz ist er der beste Geistertöter im Spiel. |
| **Werte** | `maxHp: 30`, `damage: 8` *(pro Schrotkugel, `_todo: balance` — hergeleitet: 5 × 8 = 40 auf Tuchfühlung, also unter den 40 einer Mine, aber deutlich über den 25 eines Normalschusses)*, `speed: "normal"` (70), `role: "hunter"`, `aggression: 0.9`, `accuracy: 0.6`, `magazine: 5`, `fireRate: 1.4`, `weapon: "bullet"`, `spread: { count: 5, coneDeg: 34, rangePx: 210, windupS: 0.35 }` //neu |
| **Danger Cost** | **4** — zwischen `t_yellow` (3) und `t_pink` (5). Er ist gefährlicher als der Gelbe, aber trivial zu vermeiden, sobald man ihn kennt. |
| **Telegraph** | 0,35 s vor der Salve klappt der breite Lauf hörbar auf (Sprite-Overlay: heller Trichterrand) **und** der Kegel wird als kurz aufblitzende Fläche gezeichnet. Zusätzlich zeigt ein dünner Ring bei 210 px seine tatsächliche Reichweite an, solange er in Reichweite ist. |
| **Counterplay** | Abstand halten. Auf > 210 px ist er **völlig ungefährlich** und kann nur heranfahren. Die 1,4 s Nachladen sind das Fenster für den Konter. |
| **Schwäche** | 30 LP (3 Treffer), keine Reichweite, keine Panzerung. Wer rückwärts läuft und schießt, gewinnt immer. |
| **Spielerentscheidung** | „Gehe ich für den Heckbonus (×2,5) heran und riskiere 40 Schaden, oder bleibe ich auf Abstand und gebe drei ganze Kugeln aus?" — die erste echte Risiko/Belohnung-Abwägung des Spiels. |
| **Synergien (bestehend)** | `t_green` (Mörser zwingt zum Weiterlaufen — genau in den Streuer hinein), `t_yellow` (Minen verengen die Fluchtwege) |
| **Synergien (neu)** | `t_mason` (baut Wände, die den Rückzug abschneiden), `t_grabber`/Akt 3 (zieht den Spieler in Streuer-Reichweite) |
| **Schlechte/neutrale Kombination** | `t_lance` — beide wollen das Spielerverhalten in **entgegengesetzte** Richtungen drücken (der Speerträger belohnt Nähe, weil er auf Distanz tödlich ist; der Streuer bestraft sie). Zusammen heben sie sich weitgehend auf und erzeugen ein zähes Mittelabstands-Patt. |
| **Beispielbegegnung** | Enger Raum („eng"-Charakter), 2 Streuer + 1 `t_brown`. Der Braune hält die Mitte unter Zufallsfeuer, die Streuer drängen. Der Spieler muss die Kammer verlassen, statt sich einzugraben. |
| **Elite-Variante** | `brandstifter` (Minen beim Tod) — passt, weil der Streuer ohnehin auf Nähe zwingt. **Nicht** `rasend`: 140 px/s + Schrot wäre kaum noch ausweichbar. |
| **Placeholder-Sprite** | Kurze, sehr **breite** Wanne (24 × 20 px), extrem kurzer, trichterförmiger Lauf. Farbe: kräftiges Orange. Erkennungsmerkmal: der Lauf ist breiter als lang. |
| **Warum gebraucht** | Das Spiel belohnt seit dem Grundsteinumbau Nähe (Flanke/Heck) ohne jeden Gegendruck. Ohne einen Nahdistanz-Bestrafer ist „immer heranfahren" die dominante Strategie. |

### 7.2 Der Speerträger

| Feld | Inhalt |
|---|---|
| **Name** | Der Speerträger |
| **Interne ID** | `t_lance` |
| **Akt** | 2, ab Raum 4 |
| **Kategorie** | konservativ |
| **Rolle** | Scharfschütze mit Ladeschuss / Sichtlinien-Bestrafer |
| **Designziel** | Bestraft **Stillstehen und offene Flächen**. Der Gegenpol zum Streuer: er macht große Distanz gefährlich. |
| **Kernmechanik** | Lädt 1,3 s lang auf. Währenddessen wird eine dünne Ziellinie vom Lauf zum Spieler gezeichnet, die den letzten 0,4 s **einrastet** (danach bewegt sie sich nicht mehr). Dann ein sehr schneller Durchschlagsschuss: 700 px/s, 35 Schaden, `pierce: 2` (durchschlägt bis zu drei Ziele). **Verliert er während des Ladens die Sichtlinie, bricht der Schuss ersatzlos ab.** |
| **Verhalten** | `sieger` mit `preferredRange: 300` — hält großen Abstand, orbitiert langsam. Nach dem Schuss 2,4 s Zwangspause ohne Zielen. |
| **Zielauswahl** | Standard `resolveTarget()`. Bevorzugt bewusst **nicht** Geister; da er auf Sichtlinie zielt, trifft er in der Praxis, wer zwischen ihm und dem Ziel steht — Durchschlag macht ihn zu einem Gegner, der eigene Verbündete durchschießt (sie nehmen keinen Schaden, aber er wählt Linien, die den Spieler treffen). |
| **Werte** | `maxHp: 30`, `damage: 35` *(`_todo: balance` — hergeleitet aus `boss.damage 34`: ein voll telegrafierter, komplett vermeidbarer Treffer darf wehtun; drei Treffer töten trotzdem nicht)*, `speed: "slow"` (40), `role: "sieger"`, `aggression: 0.4`, `accuracy: 0.95`, `preferredRange: 300`, `magazine: 1`, `fireRate: 2.4`, `weapon: "bullet"`, `charge: { windupS: 1.3, lockAtS: 0.4, bulletSpeed: 700, pierce: 2, abortOnLosLoss: true }` //neu |
| **Danger Cost** | **6** — gleich `t_green`. Beide sind stationäre Fernkämpfer, beide vollständig durch Bewegung konterbar. |
| **Telegraph** | Ziellinie über die volle Ladezeit (1,3 s), Farbe wechselt beim Einrasten von gelb auf rot. Zusätzlich glüht der Lauf auf. **Immer sichtbar, nicht abschaltbar** (gleiche Regel wie beim Mörser-Telegraphen). |
| **Counterplay** | Hinter eine Wand treten (der Schuss bricht ab), oder in den letzten 0,4 s **seitlich** aus der eingerasteten Linie laufen. Beides kostet nur Bewegung, keine Ressourcen. |
| **Schwäche** | 30 LP, `slow`, 2,4 s hilflos nach dem Schuss. In der Zwangspause ist er das leichteste Ziel im Raum. |
| **Spielerentscheidung** | Timing: „Nutze ich seine Pause zum Vorrücken — oder bleibt der Raum in dieser Sekunde zu gefährlich?" |
| **Synergien (bestehend)** | `t_grey`/`t_armored` (drängen den Spieler ins Offene), `t_green` (Mörser verbietet das Stehenbleiben hinter Deckung) |
| **Synergien (neu)** | `t_relay` (**stark**: der Horcher liefert die Sichtlinie, der Speerträger braucht sie — Deckung schützt nicht mehr), `t_mason` (baut Schusskorridore) |
| **Schlechte/neutrale Kombination** | `t_rusher` — der Rammler treibt den Spieler in schnelle, unvorhersehbare Ausweichbewegungen, was den Ladeschuss fast automatisch verfehlen lässt. Zwei teure Gegner, die einander die Arbeit kaputt machen. |
| **Beispielbegegnung** | Offener Raum, 1 Speerträger auf einer Seite, 2 `t_pink` in der Mitte. Die Jäger zwingen zur Bewegung, der Speerträger bestraft jeden Moment, in dem der Spieler zum Zielen anhält. |
| **Elite-Variante** | `twinshot` (zwei Ladeschüsse leicht versetzt) — verbreitert die tödliche Linie, bleibt aber vollständig telegrafiert. |
| **Placeholder-Sprite** | Schmale, lange Wanne (16 × 26 px), **sehr langer dünner Lauf** (fast so lang wie die Wanne). Farbe: kaltes Stahlblau. Erkennungsmerkmal: die Silhouette ist die längste im Spiel. |
| **Warum gebraucht** | `t_teal` und `t_black` sind Distanzgegner ohne Timing-Fenster. Der Speerträger ist der erste Gegner, dessen Schuss man **aktiv vermeiden** statt nur überleben kann — er macht Deckung zu einem Werkzeug statt zu einem Aufenthaltsort. |

### 7.3 Der Zehrer

| Feld | Inhalt |
|---|---|
| **Name** | Der Zehrer |
| **Interne ID** | `t_medic` |
| **Akt** | 2, ab Raum 6 |
| **Kategorie** | konservativ |
| **Rolle** | Unterstützer (Reparatur) |
| **Designziel** | Der Gegner, der **Tötungsreihenfolge** einführt — die größte Lücke des Ist-Stands. Er tut selbst nichts Bedrohliches; er macht andere länger lebendig. |
| **Kernmechanik** | Repariert dauerhaft **genau einen** Verbündeten: den am stärksten beschädigten in 220 px mit freier Sichtlinie, 6 LP/s. Ein sichtbarer Strahl verbindet beide. Er kann sich **nicht selbst** heilen und nicht über `maxHp` hinaus. Bricht die Sichtlinie, reißt der Strahl sofort. |
| **Verhalten** | `sapper` mit `aggression: 0.1` — er flieht vor dem Spieler und hält sich hinter seinen Verbündeten. Nutzt das vorhandene `coverDrive` (Sichtlinie brechen, sobald er anvisiert wird). |
| **Zielauswahl** | Heilt nur echte Panzer, **keine Geister** (die gehören dem Spieler). Schießt selbst nur schwach und ungenau. |
| **Werte** | `maxHp: 30`, `damage: 25`, `speed: "normal"` (70), `role: "sapper"`, `aggression: 0.1`, `accuracy: 0.2`, `magazine: 1`, `fireRate: 3.0`, `weapon: "bullet"`, `heal: { ratePerS: 6, rangePx: 220, needsLos: true, targets: 1 }` //neu *(`_todo: balance` — hergeleitet: 6 LP/s gegen 10 Schaden pro Spielertreffer. Bei der realistischen Feuerrate von ~1,5 Treffern/s verliert der Zehrer das Rennen deutlich; er verlängert einen Kill um ca. 60 %, macht ihn nie unmöglich.)* |
| **Danger Cost** | **6** — teuer für 30 LP, weil sein Wert vollständig aus dem Raum um ihn herum kommt. |
| **Telegraph** | Der Heilstrahl ist **immer** sichtbar (dicke grüne Linie, pulsierend) und das geheilte Ziel bekommt einen grünen Saum. Der Spieler sieht auf einen Blick, wer geheilt wird und von wem. |
| **Counterplay** | Drei Möglichkeiten, alle ohne Karten möglich: (1) den Zehrer töten (3 Treffer), (2) den Strahl durch eigene Positionierung unterbrechen (er braucht Sichtlinie), (3) das geheilte Ziel schneller unter 35 % drücken als 6 LP/s heilen — die **Exekutionsschwelle schlägt Heilung**, weil sie den Kill garantiert. |
| **Schwäche** | 30 LP, kein nennenswerter eigener Schaden, flieht — dabei zeigt er regelmäßig das Heck (×2,5). |
| **Spielerentscheidung** | Die klassische Prioritätsfrage: „Zuerst der Bedrohliche oder zuerst der, der den Bedrohlichen am Leben hält?" |
| **Synergien (bestehend)** | `t_armored` (**stark**: 50 LP + Frontreflexion + Heilung = der erste Gegner, den man wirklich nicht frontal töten kann), `t_green` (stationär, immer in Reichweite) |
| **Synergien (neu)** | `t_anchor` (**stark**: Anker verbietet Flanke und Exekution, Zehrer heilt — zusammen die härteste Akt-2-Prioritätsaufgabe), `t_bulwark`/Akt 3 (deckt den Zehrer körperlich) |
| **Schlechte/neutrale Kombination** | `t_rusher` — der Rammler stirbt in 2 Treffern und stürmt aus der Heilreichweite heraus. Der Zehrer hat schlicht nichts zu tun. |
| **Beispielbegegnung** | 1 Zehrer + 1 `t_armored` + 1 `t_teal`, verwinkelter Raum. Der Gepanzerte hält frontal stand, der Zehrer steht dahinter in Deckung. Der Spieler muss den Weg um die Ecke finden — dann fällt beides. |
| **Elite-Variante** | `regenerating_shield` — der Heiler, den man zweimal töten muss. Passt thematisch, verlängert aber nicht endlos, da der Schild eine feste Ladung ist. |
| **Placeholder-Sprite** | Runde, gedrungene Wanne (20 × 20 px) mit **Aufbau statt Turm**: ein kurzer, dicker Ausleger mit Ringende. Farbe: gedämpftes Weißgrün mit grünem Kreuzmuster. Erkennungsmerkmal: kein echter Lauf. |
| **Warum gebraucht** | Ohne Unterstützer ist jede Zielwahl im Spiel gleichwertig. Er ist der einfachste denkbare Einstieg in Prioritätsdenken und braucht keine neue Spielerfähigkeit. |

### 7.4 Der Rammler

| Feld | Inhalt |
|---|---|
| **Name** | Der Rammler |
| **Interne ID** | `t_rusher` |
| **Akt** | 2, ab Raum 1 |
| **Kategorie** | konservativ |
| **Rolle** | Sturm / Kontaktschaden / Raumverdrängung |
| **Designziel** | Bewegung erzwingen, ohne den Raum zu verkleinern. Der billigste Gegner Akt 2 — Füllmaterial, das im Gegensatz zu `t_brown` tatsächlich eine Reaktion verlangt. |
| **Kernmechanik** | **Keine Schusswaffe.** Fährt auf sein Ziel zu; unter 90 px setzt er 0,35 s lang die Schaufel an (sichtbar) und stürmt dann 0,6 s mit doppeltem Tempo geradeaus. Kontakt: 20 Schaden + Rückstoß, **höchstens ein Treffer pro Sturm**. Danach 2,0 s Erschöpfung mit halbem Tempo. |
| **Verhalten** | `hunter`, `aggression: 1.0`. Der Sturm fährt eine **eingefrorene** Richtung — er dreht während des Sturms nicht nach. Wandkontakt beendet den Sturm sofort. |
| **Zielauswahl** | Standard. Stürmt genauso auf Geister zu — für den Nekromanten ein billiger Ablenker. |
| **Werte** | `maxHp: 20`, `damage: 20` *(Kontakt, `_todo: balance` — bewusst **unter** 25: ein Gegner, der keine Ausweichmöglichkeit auf Distanz erlaubt, darf nicht dieselbe Schadenszahl haben wie ein vermeidbarer Schuss)*, `speed: "fast"` (100), `role: "hunter"`, `aggression: 1.0`, `accuracy: 0`, `weapon: null`, `ram: { triggerPx: 90, windupS: 0.35, chargeS: 0.6, speedMult: 2.0, exhaustS: 2.0, pushPx: 60 }` //neu |
| **Danger Cost** | **3** — wie `t_yellow`. Beide sind schnell, weich und lästig, nicht tödlich. |
| **Telegraph** | Die Schaufel klappt sichtbar herunter (heller Balken an der Front) und der Sturmkorridor wird 0,35 s als schmaler Streifen gezeichnet — dieselbe Darstellung wie beim Amboss (`effects.js: drawAnvilHazards`). |
| **Counterplay** | Seitwärts ausweichen: der Sturm dreht nicht nach. 2 Treffer töten ihn. Während der Erschöpfung zeigt er meist die Flanke. |
| **Schwäche** | 20 LP, keine Reichweite, kein Nachdrehen, lange Erschöpfung. Gegen einen ruhig zielenden Spieler stirbt er vor dem ersten Kontakt. |
| **Spielerentscheidung** | Ressourcen: „Zwei Kugeln für einen 3-Punkte-Gegner ausgeben, während vier andere schießen — oder ihn einfach weiter umlaufen?" |
| **Synergien (bestehend)** | `t_teal`/`t_green` (der Rammler verbietet Stillstand, die Artillerie bestraft Bewegung in die falsche Richtung), `t_yellow` (Minen im Ausweichkorridor) |
| **Synergien (neu)** | `t_shotgun` (der Rückstoß schiebt den Spieler in den Kegel), `t_lance` — **Achtung:** siehe unten. |
| **Schlechte/neutrale Kombination** | `t_lance` — dieselbe Kombination wie in 7.2, aus der Gegenrichtung: Rammler verhindert ruhiges Stehen, der Speerträger braucht genau das, um zu treffen. Beide zusammen kosten 9 Punkte und erzeugen weniger Druck als 9 Punkte Jäger. |
| **Beispielbegegnung** | 3 Rammler + 1 `t_green`, offener Raum. Der Mörser hält die Mitte, die Rammler treiben den Spieler dorthin zurück. |
| **Elite-Variante** | `gepanzert` (Frontpanzerung) — der Sturm wird zur echten Winkelaufgabe: man muss ihm ausweichen **und** von der Seite treffen. |
| **Placeholder-Sprite** | Keilförmige Wanne (22 × 16 px), Spitze vorn, **kein Turm** — nur ein breiter Schild-/Schaufelbalken. Farbe: rostiges Rot. Erkennungsmerkmal: die einzige Silhouette ohne Rohr. |
| **Warum gebraucht** | Akt 2 kauft mit 8–50 Punkten Budget zwangsläufig billige Gegner mit. Heute sind das `t_brown` (1) und `t_grey` (2), die in Akt 2 nichts mehr bedeuten. Der Rammler ist billiges Füllmaterial, das den Spieler **trotzdem** bewegt. |

### 7.5 Der Anker · alternative Mechanik

| Feld | Inhalt |
|---|---|
| **Name** | Der Anker |
| **Interne ID** | `t_anchor` |
| **Akt** | 2, ab Raum 8 |
| **Kategorie** | **alternativ** |
| **Rolle** | Regelbrecher (Aura) — hebt die positionellen Spielerregeln lokal auf |
| **Designziel** | Die stärkste Einzelentscheidung des Akts. Der Anker greift **nicht** den Spieler an — er greift die **Werkzeuge** des Spielers an: Flankenbonus und Exekutionsschwelle. |
| **Kernmechanik** | Ein 160-px-Feld, permanent auf den Boden gezeichnet. Für **jeden** Gegner darin (inkl. ihm selbst) gilt: (a) jeder Spielertreffer zählt als **Fronttreffer** (kein ×1,5, kein ×2,5), (b) die **Exekutionsschwelle greift nicht** — Gegner unter 35 % sterben nicht garantiert, rauchen nicht und werden nicht langsamer. Eine Regel („im Feld gelten deine Positionsvorteile nicht"), zwei sichtbare Auswirkungen. |
| **Verhalten** | `guardian` — **steht immer still**. Er ist bewusst der unbeweglichste und am leichtesten zu treffende Gegner im Spiel. Feuert langsam und ungenau. |
| **Zielauswahl** | Standard, aber irrelevant — sein Schaden ist nebensächlich. Die Aura wirkt **nicht** auf Geister (die gehören dem Spieler und unterliegen ohnehin keiner Flankenregel). |
| **Werte** | `maxHp: 50`, `damage: 25`, `speed: "fix"` (0), `role: "guardian"`, `accuracy: 0.4`, `magazine: 1`, `fireRate: 2.2`, `weapon: "bullet"`, `suppressField: { radiusPx: 160, noFlank: true, noExecute: true }` //neu |
| **Danger Cost** | **7** — der teuerste neue Akt-2-Gegner. Begründung: er erhöht die effektive Lebenszeit **aller** anderen Gegner im Feld um grob 30–60 % (Wegfall von ×1,5/×2,5) und nimmt zusätzlich den garantierten Abschluss. |
| **Telegraph** | Ein permanent gezeichneter, deutlich abgesetzter Bodenring (nicht pulsierend — er ändert sich nie). Gegner **innerhalb** des Rings tragen ein kleines Ankersymbol über der Lebensleiste. Trifft man einen von der Seite, erscheint statt „Seite ×1.5" der Text **„geankert ×1.0"** — die Regel wird also im Moment ihrer Wirkung erklärt. |
| **Counterplay** | Drei Wege: (1) Anker töten — er steht still, 50 LP = 5 Treffer, das ist die schnellste Fünf-Kugeln-Salve des Spiels; (2) Gegner aus dem Ring locken — sie verfolgen den Spieler ohnehin; (3) Explosionen (Bombe, `t_dud`) ignorieren Flanke ohnehin und verlieren durch die Aura fast nichts. |
| **Schwäche** | Unbeweglich, groß, keine Panzerung, kein Ausweichen. Er ist der einzige Gegner, der **garantiert** an derselben Stelle steht wie beim Betreten des Raums. |
| **Spielerentscheidung** | „Ist Flankieren hier überhaupt noch die Mühe wert — oder investiere ich zuerst ein ganzes Magazin in den, der gar nicht schießt?" Der Anker verändert damit die **Bewertung jeder anderen Entscheidung** im Raum. |
| **Synergien (bestehend)** | `t_armored` (**sehr stark**: Front reflektiert, Flanke ohne Bonus — das teuerste Ziel im Spiel), `t_green`/`t_brown` (stationäre Gegner bleiben zuverlässig im Feld) |
| **Synergien (neu)** | `t_medic` (**sehr stark**: keine Exekution + Heilung = Kills müssen ausgerechnet werden), `t_bulwark`/Akt 3 (schirmt den Anker körperlich ab) |
| **Schlechte/neutrale Kombination** | `t_rusher` und `t_stalker` — beide verlassen das Feld sofort (der eine stürmt, der andere pirscht). Der Anker zahlt 7 Punkte für Gegner, die nie in seinem Radius stehen. |
| **Beispielbegegnung** | 1 Anker in der Raummitte, 2 `t_pink` + 1 `t_armored` darum. Die Jäger folgen dem Spieler nach draußen (dort wieder normal tötbar), der Gepanzerte bleibt. Der Raum lehrt: **Gegner herauslocken** ist eine Antwort. |
| **Elite-Variante** | `gepanzert` — der Anker bekommt eine Frontpanzerung, sodass man ihn umlaufen muss, ohne dabei vom Flankenbonus zu profitieren. Konsequente Zuspitzung seiner eigenen Regel. |
| **Placeholder-Sprite** | Sehr breite, niedrige Wanne (28 × 18 px) mit vier sichtbaren Bodenstützen, **stummeliger Turm**. Farbe: dunkles Violettgrau. Erkennungsmerkmal: die Stützen — die Silhouette sagt „steht fest". |
| **Warum gebraucht** | Er ist der einzige vorgeschlagene Gegner, der die **Kernregeln des Grundsteinumbaus** (Flanke, Exekution) situativ außer Kraft setzt. Genau dadurch macht er sie dem Spieler bewusst — ein Werkzeug, das man nie verliert, wird nie geschätzt. |

### 7.6 Der Horcher · alternative Mechanik

| Feld | Inhalt |
|---|---|
| **Name** | Der Horcher |
| **Interne ID** | `t_relay` |
| **Akt** | 2, ab Raum 5 |
| **Kategorie** | **alternativ** |
| **Rolle** | Geteilte Sichtlinie / Aufhebung der Deckung |
| **Designziel** | Deckung ist im Ist-Stand eine Dauerlösung: `roleTurret()` verlangt bei `accuracy ≥ 0.3` eine freie Sichtlinie, und `coverDrive` lässt sogar Gegner selbst Deckung suchen. Der Horcher macht Deckung **temporär** — man muss sie sich zurückverdienen. |
| **Kernmechanik** | Solange **er** freie Sicht auf den Spieler hat, dürfen **alle** Verbündeten im Raum feuern, als hätten sie selbst Sicht — auf die echte Spielerposition, mit ihrer eigenen `accuracy`. Ein dünner Lichtfaden verbindet ihn dauerhaft mit dem Spieler, solange er ihn sieht. |
| **Verhalten** | `sapper` mit `aggression: 0.05` — flieht vor dem Spieler, sucht aber aktiv **Sichtlinien**, nicht Deckung: er stellt sich in Korridorenden und auf Freiflächenränder. Eigener Schaden minimal. |
| **Zielauswahl** | Er „markiert" nur das Ziel, das die Mehrheit gerade verfolgt (Standard `resolveTarget()`); markiert er einen Geist, profitieren die Verbündeten entsprechend gegen den Geist. |
| **Werte** | `maxHp: 20`, `damage: 25`, `speed: "slow"` (40), `role: "sapper"`, `aggression: 0.05`, `accuracy: 0.2`, `magazine: 1`, `fireRate: 2.5`, `weapon: "bullet"`, `sightRelay: { rangePx: 520, shareWithAllies: true }` //neu |
| **Danger Cost** | **5** — wie `t_pink`. Er verwandelt jeden billigen Gegner im Raum in einen aktiven Schützen; sein Wert skaliert mit der Raumbesetzung, deshalb kein höherer Preis (sonst wird er in kleinen Räumen zum Fehlkauf). |
| **Telegraph** | Der Lichtfaden Horcher → Spieler ist **immer** sichtbar (dünn, gelb, leicht flackernd). Zusätzlich pulsiert bei jedem Gegner, der gerade **nur wegen** des Horchers schießt, ein kleiner gelber Punkt an der Lebensleiste. Der Spieler kann also unterscheiden: „der sieht mich" vs. „der wird eingewiesen". |
| **Counterplay** | Nicht die Schützen ausschalten, sondern **die Sichtlinie des Horchers** brechen — meist eine ganz andere Wand als die eigene Deckung. Oder ihn töten: 20 LP = 2 Treffer. |
| **Schwäche** | 2 Treffer. Sein eigenes Verhalten verrät ihn: Wer Sichtlinien sucht, steht im Offenen. Er ist damit fast immer flankierbar. |
| **Spielerentscheidung** | Räumliches Umdenken: „Meine Deckung schützt nicht mehr gegen den, der schießt — sondern nur gegen den, der zusieht. Welche Wand brauche ich jetzt?" |
| **Synergien (bestehend)** | `t_brown`/`t_grey` (**sehr stark**: aus wertlosem Akt-1-Füllmaterial werden plötzlich Schützen, die durch Wände zielen), `t_green` (Mörser über Wände + Einweisung = keine sichere Ecke) |
| **Synergien (neu)** | `t_lance` (**sehr stark**: der Ladeschuss bricht bei Sichtlinienverlust ab — mit Horcher bricht er nicht mehr ab), `t_marshal`/Akt 3 |
| **Schlechte/neutrale Kombination** | `t_shotgun` und `t_rusher` — beide fahren dem Spieler ohnehin ins Gesicht und brauchen keine geteilte Sicht. 5 Punkte für nichts. |
| **Beispielbegegnung** | Verwinkelter Raum, 1 Horcher + 3 `t_brown` (Gesamtkosten 8). Alleine wären die Braunen belanglos; mit Horcher wird jede Ecke beschossen. Die Lösung ist ein einziger, gut gewählter Schuss. |
| **Elite-Variante** | `regenerating_shield` — man muss ihn zweimal treffen, um die Sicht zu kappen. Kurze, faire Verlängerung ohne neue Regel. |
| **Placeholder-Sprite** | Kleine, schmale Wanne (14 × 18 px) mit **Schüssel-/Antennenaufbau statt Turm** (halbrunder Bogen). Farbe: helles Gelbgrau. Erkennungsmerkmal: die Antenne dreht sich sichtbar zum Spieler. |
| **Warum gebraucht** | Er ist der einzige Gegner, dessen Antwort **kein Schuss auf die Bedrohung** ist. Genau das ist die Akt-2-Lektion in Reinform. |

### 7.7 Der Maurer · alternative Mechanik

| Feld | Inhalt |
|---|---|
| **Name** | Der Maurer |
| **Interne ID** | `t_mason` |
| **Akt** | 2, ab Raum 7 |
| **Kategorie** | **alternativ** |
| **Rolle** | Raumbauer / Geometrieveränderung |
| **Designziel** | Der Raum ist im Ist-Stand nach dem Betreten statisch. Der Maurer macht die Arena zu einer **umkämpften Ressource**, ohne dem Spieler Kontrolle wegzunehmen — er kann jede Wand wieder abreißen. |
| **Kernmechanik** | Alle 5 s baut er eine zerstörbare Wand (3 Treffer, wie `destructibleWalls`) auf eine freie Bodenzelle **zwischen sich und seinem Ziel**, etwa 120 px von sich entfernt. Bauzeit 0,8 s, in denen er still steht. Höchstens 6 eigene Wände gleichzeitig; jede zerfällt nach 20 s von selbst. |
| **Verhalten** | `sapper`, `aggression: 0.2` — hält Abstand, baut sich Sichtschutz, feuert nur schwach. |
| **Zielauswahl** | Baut immer in Richtung des aktuellen `resolveTarget()`-Ziels — auch gegen Geister, was den Nekromanten aktiv behindert. |
| **Werte** | `maxHp: 30`, `damage: 25`, `speed: "slow"` (40), `role: "sapper"`, `aggression: 0.2`, `accuracy: 0.3`, `magazine: 1`, `fireRate: 2.4`, `weapon: "bullet"`, `build: { everyS: 5.0, buildS: 0.8, distancePx: 120, hits: 3, maxAlive: 6, decayS: 20, minPlayerDistCells: 2 }` //neu |
| **Danger Cost** | **6** — wie `t_green`. Beide verweigern Fläche; der Maurer tut es dauerhafter, aber ohne direkten Schaden. |
| **Telegraph** | 0,8 s lang steht auf der Zielzelle ein durchscheinendes Gerüst (gestrichelte Kontur), erst danach ist die Zelle solide. Wer den Maurer währenddessen tötet, verhindert die Wand. |
| **Counterplay** | (1) Die Wand einreißen — 3 Treffer, und sie hinterlässt bei der Karte „Steinbruch"-Logik nichts, kostet also nur Zeit; (2) die Wand **nutzen**: sie blockt Gegnergeschosse genauso; (3) den Maurer töten (3 Treffer) — er baut während des Bauens nicht weg. |
| **Schwäche** | 0,8 s völlig bewegungslos pro Wand, `slow`, 30 LP. Sein eigenes Bauverhalten liefert dem Spieler regelmäßige Freischussfenster. |
| **Spielerentscheidung** | Ressourcen gegen Raum: „Gebe ich drei Kugeln für eine Wand aus, oder ändere ich meinen Weg?" — die erste Entscheidung im Spiel, bei der die Antwort *nicht* ein Gegner ist. |
| **Sicherung gegen Frust** | Er darf **nie** auf eine Zelle bauen, die weniger als 2 Zellen vom Spieler entfernt ist, nie auf eine besetzte Zelle, und nie, wenn dadurch die erreichbare Fläche des Spielers zerfiele (Flood-Fill wie im Generator). Einmauern ist strukturell unmöglich. |
| **Synergien (bestehend)** | `t_green` (**stark**: Mörser fliegt über Wände, der Spieler nicht), `t_teal` (Wände formen Schusskorridore) |
| **Synergien (neu)** | `t_shotgun` (schneidet Fluchtwege ab), `t_harvester`/Akt 3 (Wände halten Kämpfe lokal) |
| **Schlechte/neutrale Kombination** | `t_relay` — der Horcher lebt von Sichtlinien, der Maurer zerstört sie. Sie arbeiten wörtlich gegeneinander; 11 Punkte für zwei Gegner, die sich neutralisieren. |
| **Beispielbegegnung** | Offener Raum („offen"-Charakter), 1 Maurer + 2 `t_teal`. Der ursprünglich übersichtliche Raum wird binnen 20 s zu einem Korridorsystem, in dem die Raketenwerfer plötzlich Deckung haben. |
| **Elite-Variante** | `brandstifter` — beim Tod bleiben Minen, die den Spieler zwingen, die gebauten Engstellen zu meiden. Passt zur Raumkontroll-Identität. |
| **Placeholder-Sprite** | Kastenförmige Wanne (22 × 22 px) mit **Kranausleger statt Turm** (rechteckiger Arm mit Greiferende). Farbe: Betongrau mit gelber Warnstreifenkante. Erkennungsmerkmal: der eckige Ausleger. |
| **Warum gebraucht** | Er ist der einzige Gegner, der die **Raumcharaktere** (`difficulty.json: roomCharacters` — offen/eng/verwinkelt) zur Laufzeit ineinander überführt. Damit wird ein bereits vorhandenes, aber statisches System dynamisch. |

### 7.8 Der Blindgänger · alternative Mechanik

| Feld | Inhalt |
|---|---|
| **Name** | Der Blindgänger |
| **Interne ID** | `t_dud` |
| **Akt** | 2, ab Raum 3 |
| **Kategorie** | **alternativ** |
| **Rolle** | Wandelnde Bombe / Werkzeug für beide Seiten |
| **Designziel** | Der einzige Gegner, bei dem **der Tötungszeitpunkt und der Tötungsort** die eigentliche Entscheidung sind — und der erste, der dem Spieler eine echte **Chance** bietet statt nur einer Bedrohung. |
| **Kernmechanik** | Er hat keine Waffe. Er fährt langsam auf sein Ziel zu. **Wenn er stirbt**, beginnt eine 1,2-s-Zündschnur mit sofort sichtbarem 110-px-Radius; danach explodiert er über den vorhandenen `explodeAt()`-Pfad mit 40 Schaden — **für alle im Radius, Gegner eingeschlossen**. |
| **Verhalten** | `sapper` mit `aggression: 0.4`. Er weicht nicht aus und sucht keine Deckung; er tickt hörbar und wandert stur heran. |
| **Zielauswahl** | Standard. Er läuft auch auf Geister zu — der Nekromant kann ihn damit gezielt in eine Gegnergruppe **lotsen**. |
| **Werte** | `maxHp: 20`, `damage: 0` (kein direkter Angriff), `speed: "slow"` (40), `role: "sapper"`, `aggression: 0.4`, `accuracy: 0`, `weapon: null`, `deathBlast: { fuseS: 1.2, radiusPx: 110, damage: 40, friendlyFire: true }` //neu *(40 = `balance.json: damage.explosion`, kein neuer Wert)* |
| **Danger Cost** | **3** — wie `t_yellow`. Er ist billig, weil er ebenso oft dem Spieler nützt wie schadet. |
| **Telegraph** | Dauerndes rotes Blinken am Rumpf (Takt wie der Minen-Warnpuls) plus ein Tickgeräusch. Beim Tod erscheint der volle Explosionsradius **sofort** als gestrichelter Ring und füllt sich über 1,2 s — dieselbe Darstellung wie der Mörser-Telegraph. |
| **Counterplay** | Wegfahren. 1,2 s reichen bei 70+ px/s Spielertempo mühelos, um 110 px zurückzulegen. Oder ihn aus der Ferne töten. |
| **Schwäche** | 20 LP, langsam, wehrlos. Und er ist **Munition**: wer ihn in eine Gruppe laufen lässt und dann abschießt, räumt bis zu vier Gegner gleichzeitig ab. |
| **Spielerentscheidung** | „Töte ich ihn jetzt, wo er allein ist — oder warte ich, bis er in der Gruppe steht, und riskiere dabei, dass ich selbst zu nah bin?" Reines Risiko/Belohnung, ohne Ressourceneinsatz. |
| **Synergien (bestehend)** | `t_armored` (**stark, in beide Richtungen**: die Explosion ignoriert Panzerung — der Blindgänger ist die Antwort auf den Gepanzerten, wenn der Spieler ihn richtig platziert), `t_brown`/`t_green` (stationäre Gegner sind perfekte Explosionsopfer — für den Spieler) |
| **Synergien (neu)** | `t_anchor` (**stark**: Anker steht fest, Explosion ignoriert die Aura vollständig — der elegante Konter), `t_mason` (Wände verhindern das Wegfahren) |
| **Schlechte/neutrale Kombination** | `t_medic` — der Zehrer heilt den Blindgänger, dessen Wert aber ausschließlich in seinem **Tod** liegt. Sechs Punkte, die drei Punkte Nutzen verzögern. |
| **Beispielbegegnung** | 2 Blindgänger + 3 `t_pink` im engen Raum. Der Spieler kann die Jäger nicht einzeln bekämpfen — aber ein Schuss auf den richtigen Blindgänger im richtigen Moment entscheidet den Raum. |
| **Elite-Variante** | `rasend` (schneller) — die Zündschnur wird zur echten Fluchtaufgabe, ohne dass die Regel sich ändert. **Nicht** `gepanzert`: er soll leicht tötbar bleiben, sonst verliert er seine Werkzeugfunktion. |
| **Placeholder-Sprite** | Kugelrunde Wanne (20 × 20 px) mit **Zündschnur statt Turm** (kurzer gebogener Stiel mit Punkt am Ende). Farbe: mattschwarz mit rotem Ringblinken. Erkennungsmerkmal: das einzige runde Chassis im Spiel. |
| **Warum gebraucht** | Alle bisherigen Gegner sind Bedrohungen. Er ist die erste **Gelegenheit** — und damit der einzige Gegner, dessen Anwesenheit der Spieler sich manchmal wünscht. Das ist ein spielpsychologisch anderer Reiz als alles Vorhandene. |

---

## 8. Die 8 neuen Akt-3-Gegner

> **Technische Randbedingung, die für mehrere dieser Gegner zählt:** Die
> Trefferschleife in `state.js` kennt **kein Teamsystem** — sie überspringt
> nur den eigenen Schützen (`b.owner === t`). Gegnergeschosse treffen also
> **andere Gegner**. Das ist kein Fehler, sondern gelebter Ist-Stand (der
> Mörser nutzt ihn bewusst mit `spare: null`). Zwei der folgenden Gegner
> bauen ausdrücklich darauf auf.

### 8.1 Der Feldwebel

| Feld | Inhalt |
|---|---|
| **Name** | Der Feldwebel |
| **Interne ID** | `t_marshal` |
| **Akt** | 3, ab Raum 3 |
| **Kategorie** | konservativ |
| **Rolle** | Kadenz-Unterstützer mit **positionellem** Konter |
| **Designziel** | Der Zehrer aus Akt 2 lehrt „töte den Unterstützer". Der Feldwebel lehrt die nächste Stufe: „**oder** stell dich so, dass er nutzlos wird." |
| **Kernmechanik** | Alle Verbündeten, zu denen er **freie Sichtlinie** hat, feuern 30 % schneller (`fireCooldown × 0.7`). Von ihm gehen sichtbare kurze Fahnenlinien zu jedem gerade verstärkten Gegner. Der Effekt ist an die Sichtlinie **Feldwebel → Verbündeter** gebunden, nicht an einen Radius. |
| **Verhalten** | `sieger` mit `preferredRange: 260`, `aggression: 0.15` — er hält sich hinter der Linie, sucht aber Sichtachsen auf möglichst viele Verbündete. Schießt selbst selten. |
| **Zielauswahl** | Verstärkt nur echte Panzer. Sein eigener Beschuss folgt Standard-`resolveTarget()`. |
| **Werte** | `maxHp: 40`, `damage: 25`, `speed: "normal"` (70), `role: "sieger"`, `aggression: 0.15`, `accuracy: 0.5`, `preferredRange: 260`, `magazine: 1`, `fireRate: 2.0`, `weapon: "bullet"`, `rally: { fireRateMult: 0.7, needsLos: true, maxTargets: 6 }` //neu |
| **Danger Cost** | **9** — wie `t_purple`. Er erhöht den Gesamtschadensausstoß eines vollen Akt-3-Raums um grob ein Drittel. |
| **Telegraph** | Fahnenlinien vom Feldwebel zu jedem verstärkten Gegner (kurz, orange, pulsierend im Takt der beschleunigten Kadenz). Verstärkte Gegner tragen einen orangen Saum. |
| **Counterplay** | Zwei gleichwertige Wege: (1) 4 Treffer und er fällt; (2) **die Position wechseln, bis Wände zwischen ihm und seinen Leuten stehen** — der Buff erlischt sofort und sichtbar. Weg 2 kostet keine Munition, aber Raum. |
| **Schwäche** | Sein eigenes Verhalten stellt ihn in Sichtachsen, also ins Offene. 40 LP, kein Schutz, mittelmäßiger Schütze. |
| **Spielerentscheidung** | „Vier Kugeln oder zehn Meter?" — die erste Entscheidung im Spiel, bei der Munition und Position direkt gegeneinander stehen. |
| **Synergien (bestehend)** | `t_purple` (**stark**: Rudelflankierer mit +30 % Kadenz sind der härteste Dauerdruck im Spiel), `t_teal` (Raketen im Zweiertakt) |
| **Synergien (neu)** | `t_metronom` (**sehr stark**: Taktgeber synchronisiert, Feldwebel verdichtet — die Salven werden massiv), `t_bulwark` (deckt den Feldwebel körperlich) |
| **Schlechte/neutrale Kombination** | `t_stalker` — der Pirscher ist die meiste Zeit versteckt und außerhalb jeder Sichtachse; der Feldwebel verstärkt ihn faktisch nie. |
| **Beispielbegegnung** | Offener Raum, 1 Feldwebel weit hinten, 3 `t_purple`. Die Antwort ist nicht, sich durch das Rudel zu schießen, sondern hinter die Säule zu gehen, hinter der der Feldwebel nichts mehr sieht. |
| **Elite-Variante** | `regenerating_shield` — zwingt zum zweiten Anlauf oder zum endgültigen Positionswechsel. |
| **Placeholder-Sprite** | Normale Wanne (18 × 22 px) mit **Fahnenmast statt Lauf** (dünner Stab mit rechteckigem Wimpel). Farbe: Olivgrün mit orangem Wimpel. Erkennungsmerkmal: der Wimpel flattert und ist auch aus der Ferne sichtbar. |
| **Warum gebraucht** | Akt 3 braucht einen Unterstützer, dessen Antwort **nicht** „töte ihn" ist. Sonst bleibt jede Komposition eine reine Prioritätsliste. |

### 8.2 Das Bollwerk

| Feld | Inhalt |
|---|---|
| **Name** | Das Bollwerk |
| **Interne ID** | `t_bulwark` |
| **Akt** | 3, ab Raum 1 |
| **Kategorie** | konservativ |
| **Rolle** | Mobile Deckung / Formationskern |
| **Designziel** | Deckung, die **sich bewegt**. Die Arena verändert sich dadurch nicht, aber die nutzbaren Schusslinien tun es ständig. |
| **Kernmechanik** | Sehr großer Kollisionsradius (22 px statt 12 — das `radius`-Override existiert seit dem Amboss) und eine **nicht reflektierende** 160°-Frontpanzerung: Treffer von vorn richten **keinen** Schaden an und die Kugel stirbt. Sein Körper blockt Geschosse physisch — **auch die seiner eigenen Verbündeten**, weil die Trefferschleife kein Teamsystem kennt. Er fährt deshalb bewusst voran, seine Verbündeten weichen an die Flanken aus. |
| **Verhalten** | `hunter` mit `aggression: 0.25` und `speed: "slow"` — er drängt langsam und stetig vor, dreht die Front immer zum Ziel. |
| **Zielauswahl** | Standard. Gegen Geister ist er besonders wirksam, weil Geister keine Flankenlogik nutzen (siehe `state.js`, getrennte Geist-Kollisionsschleife). |
| **Werte** | `maxHp: 50`, `damage: 25`, `speed: "slow"` (40), `radius: 22`, `role: "hunter"`, `aggression: 0.25`, `accuracy: 0.55`, `magazine: 2`, `fireRate: 1.8`, `weapon: "bullet"`, `armor: { arc: 160, reflects: false }` |
| **Danger Cost** | **8** — wie `t_white`. Er erzeugt selbst wenig Schaden, verlängert aber die Lebenszeit aller hinter ihm. |
| **Telegraph** | Die Frontpanzerung ist als dicker heller Balken gezeichnet (bestehendes `drawArmor()`-Overlay, unverändert). Ein blockierter Treffer erzeugt den vorhandenen `reflect`-Blitz und -Ton — der Spieler merkt sofort, dass diese Richtung nichts bringt. |
| **Counterplay** | Umlaufen (die 200° hinten sind völlig ungeschützt, dort greift zusätzlich der Heckbonus ×2,5 → 4 Treffer statt unendlich), oder Explosionen (Bombe, Mine, `t_dud`) — die ignorieren Panzerung grundsätzlich. |
| **Schwäche** | `slow` und riesig — der am leichtesten zu umlaufende Gegner im Spiel. Und er behindert seine eigenen Leute. |
| **Spielerentscheidung** | Positionierung unter Zeitdruck: „Ich muss um ihn herum — aber dahinter stehen drei Schützen. Nehme ich den Weg trotzdem?" |
| **Synergien (bestehend)** | `t_green` (**stark**: der Mörser bestraft genau die Position, in die das Bollwerk drängt), `t_teal` |
| **Synergien (neu)** | `t_medic` (**sehr stark**: geheiltes Bollwerk mit 50 LP und Frontpanzerung ist frontal praktisch untötbar), `t_anchor` (kein Heckbonus mehr — dann ist auch das Umlaufen keine Lösung mehr; **bewusst als härteste legale Kombination**) |
| **Schlechte/neutrale Kombination** | `t_purple` — die Rudelflankierer laufen ständig um den Spieler herum und damit aus der Deckung des Bollwerks heraus; zusätzlich blockiert dessen Körper regelmäßig ihre Schüsse. 17 Punkte, die einander im Weg stehen. |
| **Beispielbegegnung** | Enger Korridorraum, 1 Bollwerk vorn, 1 `t_teal` + 1 `t_marshal` dahinter. Der Korridor lässt kein Umlaufen zu — der Spieler muss den Raum verlassen und den Kampf im offenen Teil führen. |
| **Elite-Variante** | `rasend` — ein schnelles Bollwerk ist deutlich bedrohlicher, ohne unfair zu werden (die ungeschützten 200° bleiben). |
| **Placeholder-Sprite** | Die **breiteste** Silhouette im Spiel (34 × 26 px), massiver Frontschild als eigenes Rechteck vor der Wanne, sehr kurzer Lauf. Farbe: dunkles Stahlgrau mit hellem Frontbalken. |
| **Warum gebraucht** | `t_armored` ist heute der einzige Positionsgegner und kostet nur 5 Punkte. Akt 3 braucht eine teure, kompositionsfähige Version davon, um die Schusslinien einer ganzen Gruppe zu formen. |

### 8.3 Der Pirscher

| Feld | Inhalt |
|---|---|
| **Name** | Der Pirscher |
| **Interne ID** | `t_stalker` |
| **Akt** | 3, ab Raum 5 |
| **Kategorie** | konservativ |
| **Rolle** | Hinterhalt / Informationsdruck |
| **Designziel** | Ausbau von `t_white` zu einem lesbaren Gegner. `t_white` ist heute zufällig unsichtbar; der Pirscher ist **regelhaft** unsichtbar — der Spieler kann seinen Zustand aus der Situation ableiten. |
| **Kernmechanik** | Unsichtbar (nur ein schwaches Flimmern und die Kettenspuren, `trackStampPx` existiert bereits), **solange** er weiter als 220 px vom Ziel entfernt ist **und** nicht feuert. 0,6 s vor jedem Schuss wird er vollständig sichtbar und bleibt es 2 s. Innerhalb 220 px ist er immer sichtbar. |
| **Verhalten** | `hunter`, `aggression: 0.7`, `speed: "fast"` — er umkreist weiträumig und sucht das Heck des Spielers. |
| **Zielauswahl** | Bevorzugt bewusst das Ziel, das ihm gerade den **Rücken zuwendet** (er nutzt dieselbe `flankZone()`-Mathematik wie der Spieler — nur umgekehrt). |
| **Werte** | `maxHp: 30`, `damage: 25`, `speed: "fast"` (100), `role: "hunter"`, `aggression: 0.7`, `accuracy: 0.75`, `magazine: 2`, `fireRate: 1.5`, `weapon: "bullet"`, `stalk: { cloakBeyondPx: 220, revealBeforeShotS: 0.6, revealedS: 2.0 }` //neu |
| **Danger Cost** | **8** — wie `t_white`, dessen Rolle er präzisiert. |
| **Telegraph** | Sichtbare Kettenspuren im Boden (bestehendes `tracks.js`-System!), ein leichtes Flimmern der Luft, und die volle Enttarnung 0,6 s vor dem Schuss mit einem eigenen kurzen Ton. Er ist damit **nie** ohne Vorwarnung tödlich. |
| **Counterplay** | Nicht stillstehen mit dem Rücken zur offenen Fläche. Enttarnt ist er ein 30-LP-Gegner ohne Schutz — die 2 s Sichtbarkeit reichen für 3 Treffer. Wer die Kettenspuren liest, weiß, wo er ist. |
| **Schwäche** | Er verrät seine Position durch Spuren und muss sich für jeden Schuss zeigen. Ein Spieler, der ihn zuerst abarbeitet, verliert nur Zeit, nie Leben. |
| **Spielerentscheidung** | Aufmerksamkeitsverteilung: „Behalte ich den Rücken frei — oder konzentriere ich mich auf die Gruppe vorn?" |
| **Synergien (bestehend)** | `t_pink`/`t_purple` (**stark**: sie binden die Aufmerksamkeit vorn), `t_green` (Mörser verhindert Stillstand mit Rückendeckung) |
| **Synergien (neu)** | `t_bulwark` (**stark**: zwingt den Spieler, um eine Ecke zu gehen — dort wartet der Pirscher), `t_grabber` (zieht den Spieler aus der Deckung) |
| **Schlechte/neutrale Kombination** | `t_relay` — der Horcher gibt allen geteilte Sicht, ausgerechnet der Pirscher braucht das Gegenteil (Unsichtbarkeit als Vorteil). Der Horcher enttarnt ihn zwar nicht, macht seine Rolle aber überflüssig, weil alle anderen ohnehin schon durch Wände zielen. |
| **Beispielbegegnung** | Verwinkelter Raum, 2 Pirscher + 1 `t_green`. Der Mörser hält den Spieler in Bewegung; die Pirscher kommen aus zwei Richtungen. Die Lösung ist eine Ecke im Rücken. |
| **Elite-Variante** | `twinshot` — beim Enttarnen zwei Schüsse statt einem. Erhöht den Preis für Unaufmerksamkeit, ohne die Enttarnungsregel anzutasten. |
| **Placeholder-Sprite** | Schlanke, gepfeilte Wanne (16 × 24 px), Lauf mit sichtbarem Schalldämpfer-Wulst. Farbe: Dunkelgrün, im getarnten Zustand mit 20 % Deckkraft gezeichnet (nicht 0 % — er ist nie vollständig weg). |
| **Warum gebraucht** | `t_white`s Unsichtbarkeit ist heute reines Pech. Der Pirscher wandelt dieselbe Idee in eine **lesbare Regel** um — Überraschung ja, Betrug nein. |

### 8.4 Der Lichtbogen

| Feld | Inhalt |
|---|---|
| **Name** | Der Lichtbogen |
| **Interne ID** | `t_arclight` |
| **Akt** | 3, ab Raum 4 |
| **Kategorie** | konservativ |
| **Rolle** | Kettenblitz-Artillerie / Anti-Gruppierung |
| **Designziel** | Der erste Gegner, der **Schadenstypen** benutzt — ein vollständig gebautes System (`damagetypes.js`), das bisher nur der Spieler nutzt. Er bestraft dichte Aufstellungen: beim Nekromanten die eigenen Untertanen, beim Standardpanzer das Zusammendrängen mit der Umgebung. |
| **Kernmechanik** | Sein Geschoss trägt `damageType: "lightning"` — es springt beim Treffer auf bis zu **2 weitere** Ziele in Reichweite über, mit 30 % Abfall je Sprung (exakt die vorhandenen Werte aus `data/status.json`). Trifft er den Spieler, springt der Blitz auf dessen Geister; trifft er einen Geist, springt er auf den Spieler. |
| **Verhalten** | `sieger`, `preferredRange: 260`, hält Abstand und sucht Momente, in denen mehrere Ziele nah beieinander stehen. |
| **Zielauswahl** | Standard `resolveTarget()`, aber mit einer zusätzlichen Feuerbedingung: er feuert bevorzugt, wenn **mindestens zwei** Ziele innerhalb der Sprungreichweite stehen. |
| **Werte** | `maxHp: 30`, `damage: 25`, `speed: "normal"` (70), `role: "sieger"`, `aggression: 0.35`, `accuracy: 0.8`, `preferredRange: 260`, `magazine: 1`, `fireRate: 2.0`, `weapon: "bullet"`, `damageType: "lightning"` *(bereits vorhandenes Feld, bislang nur bei Spielerklassen gesetzt)* |
| **Danger Cost** | **9** — wie `t_purple`. Gegen einen Standardpanzer ohne Geister ist er ein normaler Schütze; gegen einen Nekromanten mit drei Untertanen ist er der gefährlichste Gegner im Spiel. Der Preis mittelt das. |
| **Telegraph** | Der Blitzbogen wird bereits heute gezeichnet (`renderer.js: drawLightning`) — er zeigt **nach** dem Treffer exakt, wohin gesprungen wurde. Zusätzlich: der Lauf lädt sichtbar auf und der Gegner zeichnet dünne Vorschau-Bögen zu den Zielen, die beim nächsten Treffer erfasst würden. |
| **Counterplay** | Auseinandergehen. Für den Nekromanten: Untertanen wegschicken (er kontrolliert ihre Position über sein eigenes Ziel). Der Grundpanzer kann ihn schlicht töten (3 Treffer). |
| **Schwäche** | 30 LP, kein Schutz, und gegen ein **einzelnes** Ziel ist er nicht stärker als `t_teal` für 4 Punkte. |
| **Spielerentscheidung** | Für den Nekromanten die härteste Frage seines Kartensystems: „Zahlt sich meine Legion hier überhaupt aus?" — ein Gegner, der einen ganzen Buildpfad **situativ** infrage stellt, ohne ihn zu verbieten. |
| **Synergien (bestehend)** | `t_yellow` (Minen treiben Spieler und Geister zusammen), `t_armored` (bindet die Untertanen im Nahkampf) |
| **Synergien (neu)** | `t_grabber` (**stark**: zieht den Spieler zu seinen eigenen Untertanen), `t_harvester` (profitiert von Blitz-Massenkills) |
| **Schlechte/neutrale Kombination** | `t_shotgun` — der Streuer treibt den Spieler weg von allem, der Lichtbogen braucht Ballung. |
| **Beispielbegegnung** | 1 Lichtbogen + 2 `t_armored`, offener Raum. Die Gepanzerten binden die Untertanen des Nekromanten, der Lichtbogen erntet die Ballung. Für den Standardpanzer derselbe Raum: eine unauffällige Schießübung — **derselbe Encounter, zwei völlig verschiedene Kämpfe je nach Klasse.** |
| **Elite-Variante** | `twinshot` — zwei Blitzgeschosse, also bis zu sechs betroffene Ziele. Passt, ohne neue Regel. |
| **Placeholder-Sprite** | Schmale Wanne (16 × 20 px) mit **Spulenaufbau statt Turm**: zwei Ringe übereinander, dazwischen ein flackernder Funke. Farbe: Tiefblau mit hellblauem Funkeln. |
| **Warum gebraucht** | Er aktiviert ein komplett gebautes, aber gegnerseitig ungenutztes System — mit nahezu null technischem Aufwand — und ist zugleich der einzige Gegner, der den Nekromanten-Buildpfad direkt herausfordert. |

### 8.5 Der Kettenhund · alternative Mechanik

| Feld | Inhalt |
|---|---|
| **Name** | Der Kettenhund |
| **Interne ID** | `t_tether` |
| **Akt** | 3, ab Raum 2 |
| **Kategorie** | **alternativ** |
| **Rolle** | Schadensteilung über eine sichtbare Bindung |
| **Designziel** | Zielpriorität als **Rechenaufgabe** statt als Rangliste. Der Spieler muss abwägen, ob er zwei Gegner gleichzeitig halb oder einen ganz tötet. |
| **Kernmechanik** | Beim Raumaufbau bindet er sich an den nächstgelegenen Verbündeten (bevorzugt einen anderen Kettenhund). **Jeder Schaden an einem der beiden wird 50 / 50 geteilt.** Die Bindung ist eine dicke, sichtbare Kette und reißt dauerhaft, sobald (a) eine Wand dazwischen liegt oder (b) der Abstand 260 px überschreitet. |
| **Verhalten** | `hunter`, `aggression: 0.6`. Ein gebundenes Paar hält aktiv Abstand von 100–200 px zueinander (weit genug für Fläche, nah genug für die Kette). |
| **Zielauswahl** | Standard. Die Bindung gilt nur zwischen echten Panzern. |
| **Werte** | `maxHp: 30`, `damage: 25`, `speed: "normal"` (70), `role: "hunter"`, `aggression: 0.6`, `accuracy: 0.6`, `magazine: 2`, `fireRate: 1.6`, `weapon: "bullet"`, `tether: { splitPct: 0.5, breakDistPx: 260, breakOnWall: true, preferSameType: true }` //neu |
| **Danger Cost** | **5** je Stück — bewusst niedrig, weil er praktisch immer paarweise gekauft wird (10 Punkte für das Paar). Ein einzelner, ungebundener Kettenhund ist nur ein durchschnittlicher Jäger. |
| **Telegraph** | Die Kette ist immer sichtbar und **zuckt bei jedem geteilten Treffer** an beiden Enden auf. Beide Lebensleisten sinken gleichzeitig — der Spieler versteht die Regel beim ersten Treffer ohne Text. |
| **Counterplay** | Zwei gleichwertige Wege, einer ballistisch, einer positional: (1) **durchziehen** — 6 Treffer töten beide gleichzeitig, weil sie zusammen die Exekutionsschwelle unterschreiten; (2) **die Kette reißen** — hinter eine Wand ziehen oder einen der beiden weglocken, dann 3 Treffer für einen einzelnen. |
| **Schwäche** | 30 LP je Stück und eine Bindung, die an jeder Wand zerbricht. In verwinkelten Räumen ist das Paar praktisch nie gebunden. |
| **Spielerentscheidung** | „Sechs Kugeln für zwei Kills oder drei Kugeln für einen — und was macht der andere in der Zwischenzeit?" Reine Ressourcen- und Reihenfolgerechnung. |
| **Synergien (bestehend)** | `t_armored` (**stark**: die Kette an einen Gepanzerten macht die Teilung zur Falle — die Hälfte des Schadens verpufft an der Front des Partners), `t_purple` |
| **Synergien (neu)** | `t_medic` (**sehr stark**: Heilung auf einen von beiden hält faktisch beide oben), `t_bulwark` (Partner hinter dem Schild) |
| **Schlechte/neutrale Kombination** | `t_mason` — der Maurer baut Wände zwischen die eigenen Leute und **zerreißt die eigenen Ketten**. Ein sich selbst sabotierendes Paar. |
| **Beispielbegegnung** | Offener Raum, 2 Kettenhunde + 1 `t_medic`. Solange der Zehrer lebt, ist Weg (1) unmöglich; also erst der Zehrer, dann rechnen. |
| **Elite-Variante** | `gepanzert` — ein Fronttreffer auf den Gepanzerten teilt keinen Schaden, weil gar keiner entsteht. Der Spieler muss dann zwingend den ungepanzerten Partner treffen. Schöne Zuspitzung. |
| **Placeholder-Sprite** | Kompakte Wanne (18 × 18 px) mit **Hakenaufbau** an der Rückseite (kleines Ringsymbol, an dem die Kette ansetzt). Farbe: Rostbraun. Erkennungsmerkmal: die Kette selbst — der Gegner ist nur zusammen mit ihr lesbar. |
| **Warum gebraucht** | Es gibt heute **keinen** Gegner, dessen Wert von einem anderen Gegner abhängt. Der Kettenhund ist die einfachste denkbare Form davon und die technische Vorlage für alle weiteren Paar-Mechaniken. |

### 8.6 Der Verwerter · alternative Mechanik

| Feld | Inhalt |
|---|---|
| **Name** | Der Verwerter |
| **Interne ID** | `t_harvester` |
| **Akt** | 3, ab Raum 8 |
| **Kategorie** | **alternativ** |
| **Rolle** | Leichenfresser / Bestrafer der Standardtaktik |
| **Designziel** | Der Gegner, der die Frage **„wo sterben meine Gegner?"** erfindet. Bisher ist der Ort eines Kills völlig bedeutungslos. |
| **Kernmechanik** | Stirbt ein Panzer **oder Geist** innerhalb von 200 px um ihn herum, wächst er dauerhaft: **+8 maximale LP und +3 Schaden je Stapel**, sichtbar als kleine Marken über der Lebensleiste. Der Zuwachs auf `maxHp` heilt ihn **nicht** — er wird zäher für die Zukunft, nicht für den laufenden Treffer. |
| **Verhalten** | `sieger` mit `preferredRange: 200`, `speed: "slow"` — er hält sich bewusst in der Nähe des Getümmels auf, ohne selbst vorzupreschen. |
| **Zielauswahl** | Standard. Er frisst **auch die eigenen** Verbündeten und die Untertanen des Nekromanten. |
| **Werte** | `maxHp: 40` (Start), `damage: 25` (Start), `speed: "slow"` (40), `role: "sieger"`, `aggression: 0.3`, `accuracy: 0.7`, `preferredRange: 200`, `magazine: 2`, `fireRate: 1.7`, `weapon: "bullet"`, `harvest: { radiusPx: 200, hpPerStack: 8, damagePerStack: 3, healOnStack: false }` //neu *(`_todo: balance` — 8 LP ≈ 0,8 Spielertreffer je Stapel; nach 5 Kills in seiner Nähe braucht er 8 statt 4 Treffer. Bewusst spürbar, aber nie außerhalb des 2–5-Treffer-Bands zum Zeitpunkt des Raumbeginns.)* |
| **Danger Cost** | **10** — der zweitteuerste neue Gegner. Begründung: er ist der einzige, dessen Gefahr im Verlauf eines Raums **wächst**, und zwar genau dann, wenn der Spieler gut spielt. |
| **Telegraph** | Ein deutlich gezeichneter Fressradius auf dem Boden (dunkelrot, halbtransparent). Jeder Stapel löst einen sichtbaren Saugeffekt vom Sterbeort zu ihm aus, plus einen eigenen Ton. Die Stapelzahl steht als Marken über ihm. |
| **Counterplay** | (1) Ihn **zuerst** töten (4 Treffer am Raumbeginn — er ist am Anfang der schwächste teure Gegner im Spiel), (2) den Kampf aus seinem Radius herausziehen; er ist `slow` und kann nicht folgen. Für den Nekromanten zusätzlich: Untertanen nicht in seinem Radius sterben lassen. |
| **Schwäche** | Zu Beginn 40 LP und `slow`. Sein ganzes Konzept fällt in sich zusammen, wenn er der **erste** Kill ist — was er dem Spieler durch den sichtbaren Radius auch selbst mitteilt. |
| **Spielerentscheidung** | Kurzfristig gegen langfristig: „Der billige Gegner vor mir ist gerade gefährlicher — aber jeder Kill, den ich hier mache, macht den Verwerter stärker." Der einzige Gegner mit echtem Zeithorizont. |
| **Synergien (bestehend)** | `t_brown`/`t_grey` (**stark**: billiges Füllmaterial wird zur Nahrung — genau das, was der Spieler zuerst abräumt), `t_yellow` (Minen töten Verbündete in seiner Nähe) |
| **Synergien (neu)** | `t_dud` (**sehr stark**: der Blindgänger tötet beim Explodieren die halbe Gruppe — direkt in den Fressradius hinein; das beste Werkzeug des Spielers wird zur Falle), `t_arclight` (Massenkills) |
| **Schlechte/neutrale Kombination** | `t_bulwark` — das Bollwerk verhindert Kills in seiner Nähe (es hält alles am Leben) und ist selbst zu zäh, um schnell verwertet zu werden. 18 Punkte für zwei Gegner, die beide „langsam" spielen wollen. |
| **Beispielbegegnung** | 1 Verwerter + 4 `t_brown` + 1 `t_dud`, enger Raum. Die vier Braunen laden zum schnellen Abräumen ein — genau das füttert ihn. Wer den Blindgänger in die Braunen schießt, macht den Verwerter auf einen Schlag doppelt so stark. |
| **Elite-Variante** | `regenerating_shield` — er wird zäh **und** wachsend. Bewusst **nicht** `rasend`: ein schneller Verwerter könnte dem Kampf folgen und würde seine positionale Schwäche verlieren. |
| **Placeholder-Sprite** | Gedrungene Wanne (22 × 20 px) mit **Trichteraufbau** (nach vorn offener Kegel) und sichtbaren Rippen an den Seiten, die mit jedem Stapel heller werden. Farbe: Dunkelrot, Rippenglühen als Stapelanzeige. |
| **Warum gebraucht** | Er ist der einzige vorgeschlagene Gegner, der die **Reihenfolge über den ganzen Raum hinweg** bewertet statt nur im Moment. Damit erfüllt er die Akt-3-Vorgabe „mitten im Kampf neu bewerten" wörtlich. |

### 8.7 Der Taktgeber · alternative Mechanik

| Feld | Inhalt |
|---|---|
| **Name** | Der Taktgeber |
| **Interne ID** | `t_metronom` |
| **Akt** | 3, ab Raum 10 |
| **Kategorie** | **alternativ** |
| **Rolle** | Synchronisierer / Umbau von Chaos in Rhythmus |
| **Designziel** | Der spielpsychologisch interessanteste Gegner des Vorschlags: Er macht den Raum **gefährlicher und gleichzeitig lesbarer**. Zum ersten Mal ist „diesen Gegner töten" nicht selbstverständlich die richtige Antwort. |
| **Kernmechanik** | Er schlägt einen Takt von 2,0 s. Alle Verbündeten mit Sichtlinie zu ihm **halten ihr Feuer zurück** und geben es geschlossen auf dem Schlag frei. Ergebnis: 1,6 s Ruhe, dann eine massive Salve. Der Gesamtschaden pro Zeit steigt dabei nur leicht (~15 %), aber er kommt gebündelt. |
| **Verhalten** | `guardian` — er steht still, mitten in seiner Gruppe, und dreht sich nicht. Er feuert selbst überhaupt nicht. |
| **Zielauswahl** | Er wählt keine Ziele. Die Verbündeten behalten ihre eigene Zielwahl. |
| **Werte** | `maxHp: 40`, `damage: 0`, `speed: "fix"` (0), `role: "guardian"`, `accuracy: 0`, `weapon: null`, `metronome: { beatS: 2.0, holdWindowS: 1.6, needsLos: true }` //neu *(`_todo: balance` — 2,0 s gewählt, weil der Spieler bei 450 px/s Kugeltempo und 5 Kugeln Magazin in dieser Zeit ziemlich genau eine volle Salve setzen kann. Der Rhythmus des Gegners und der des Spielers sind damit vergleichbar lang.)* |
| **Danger Cost** | **11** — knapp unter `t_black` (12). Begründung: er verändert das Verhalten **aller** anderen Gegner im Raum. |
| **Telegraph** | Ein Ring, der sich über 2,0 s sichtbar zusammenzieht und auf dem Schlag aufblitzt (dieselbe Darstellung wie der Wellen-Vorwarnring aus Phase 9), plus ein Metronom-Tick als Ton. Verstärkte Gegner pulsieren im selben Takt. Der Spieler hat also **zwei** unabhängige Sinneskanäle für dieselbe Information. |
| **Counterplay** | Drei Wege, und die Wahl ist selbst die Entscheidung: (1) den Rhythmus **nutzen** — in den 1,6 s Ruhe vorrücken, auf dem Schlag in Deckung; (2) die Sichtlinie zwischen ihm und seiner Gruppe brechen; (3) ihn töten (4 Treffer) — dann feuern alle wieder unregelmäßig, was **weniger** Schaden, aber auch weniger Vorhersagbarkeit bedeutet. |
| **Schwäche** | Er richtet keinen Schaden an, steht still, hat 40 LP und ist damit jederzeit tötbar. Seine ganze Existenz ist ein Angebot. |
| **Spielerentscheidung** | Die seltenste Entscheidung in Spielen dieser Art: **„Soll ich diesen Gegner überhaupt töten?"** Ein geübter Spieler lässt ihn absichtlich leben. |
| **Synergien (bestehend)** | `t_purple` (**sehr stark**: ein Rudel, das geschlossen feuert, ist auf dem Schlag tödlich), `t_teal`/`t_green` |
| **Synergien (neu)** | `t_marshal` (**sehr stark**: Kadenz plus Bündelung — die härteste Salve, die das Spiel erzeugen kann; bewusst als Spitze des Akts gedacht), `t_bulwark` (Deckung während der Salve) |
| **Schlechte/neutrale Kombination** | `t_rusher` und `t_stalker` — beide haben keine Schusskadenz zum Synchronisieren. 11 Punkte ohne Wirkung. |
| **Beispielbegegnung** | 1 Taktgeber + 3 `t_purple` + 1 `t_bulwark`. Die Salve auf dem Schlag ist praktisch nicht überlebbar, wenn man im Offenen steht — der Raum ist ein reines Rhythmusspiel. |
| **Elite-Variante** | `gepanzert` — er ist frontal geschützt, sodass die Entscheidung „töten oder behalten" zusätzlich einen Positionspreis bekommt. |
| **Placeholder-Sprite** | Schmale, hohe Wanne (16 × 22 px) mit **Pendelaufbau statt Turm**: ein Stab mit Gewicht, der **sichtbar im Takt hin- und herschwingt**. Farbe: Messinggelb. Erkennungsmerkmal: die einzige Silhouette mit Eigenbewegung im Ruhezustand. |
| **Warum gebraucht** | Er beweist, dass Schwierigkeit und Lesbarkeit nicht gegeneinanderstehen. Für Spieler, die den Akt schon kennen, verwandelt er einen bekannten Raum in eine völlig andere Aufgabe — genau das Replayability-Ziel des Briefs. |

### 8.8 Der Greifer · alternative Mechanik

| Feld | Inhalt |
|---|---|
| **Name** | Der Greifer |
| **Interne ID** | `t_grabber` |
| **Akt** | 3, ab Raum 6 |
| **Kategorie** | **alternativ** |
| **Rolle** | Positionsdiebstahl / erzwungener Munitionsverbrauch |
| **Designziel** | Der einzige Gegner, der dem Spieler **seine Position streitig macht** — mit einem Konter, der ausgerechnet die knappste Ressource des Spiels kostet: eine der fünf aktiven Kugeln. |
| **Kernmechanik** | Feuert nach 0,7 s Vorwarnung einen Enterhaken (Wiederverwendung des `hook`-Gadgets). Trifft er, wird das Ziel 1,2 s lang mit 90 px/s **zu ihm gezogen** — der Spieler behält dabei die volle Steuerung senkrecht zur Leine, verliert also Boden, nicht Kontrolle. **Ein einziger Treffer auf die gespannte Leine trennt sie sofort.** |
| **Verhalten** | `sieger` mit `preferredRange: 240`. Nach jedem Haken 4,0 s Abklingzeit. |
| **Zielauswahl** | Standard. Zieht auch Geister — für den Nekromanten heißt das, dass seine Untertanen aus der Formation gerissen werden. |
| **Werte** | `maxHp: 30`, `damage: 25`, `speed: "normal"` (70), `role: "sieger"`, `aggression: 0.45`, `accuracy: 0.6`, `preferredRange: 240`, `magazine: 1`, `fireRate: 2.0`, `weapon: "bullet"`, `grapple: { windupS: 0.7, pullSpeedPxS: 90, pullS: 1.2, cooldownS: 4.0, ropeHp: 1, maxRangePx: 300 }` //neu |
| **Danger Cost** | **8** — wie `t_white`. Er macht selbst wenig Schaden, aber er liefert den Spieler an alles andere aus. |
| **Telegraph** | 0,7 s vorher schwingt der Hakenarm sichtbar zurück und ein gestrichelter Korridor zeigt die Wurfrichtung (dieselbe Darstellung wie der Rammkorridor des Amboss). Die gespannte Leine ist danach dick und deutlich gezeichnet und **flackert**, um zu sagen: „schieß hier drauf". |
| **Counterplay** | (1) Dem 0,7-s-Korridor ausweichen (kostet nur Bewegung), (2) die Leine zerschießen (kostet **eine Kugel**), (3) den Zug einfach akzeptieren und die Distanz zum eigenen Vorteil nutzen — er zieht schließlich in **seine** Reichweite, und er hat nur 30 LP. |
| **Schwäche** | 4 s Abklingzeit, 30 LP, und Weg (3) macht ihn zum Selbstmörder, wenn keine Gruppe hinter ihm steht. Er ist allein praktisch harmlos. |
| **Spielerentscheidung** | Ressourcen unter Zeitdruck: „Ist mir die Leine eine Kugel wert — oder brauche ich die fünfte Kugel gleich für den Gepanzerten?" Die erste Situation im Spiel, in der Munition wirklich knapp **wirkt**. |
| **Synergien (bestehend)** | `t_green` (**sehr stark**: der Mörser hat 1,7 s Flugzeit, der Zug dauert 1,2 s — er zieht den Spieler in eine bereits fliegende Granate), `t_yellow` (in ein Minenfeld ziehen) |
| **Synergien (neu)** | `t_shotgun` (**sehr stark**: der Zug endet in Schrotreichweite), `t_dud` (in den Explosionsradius ziehen) |
| **Schlechte/neutrale Kombination** | `t_lance` — der Zug bewegt den Spieler zuverlässig **aus** der eingerasteten Ziellinie heraus. Der Greifer rettet den Spieler vor dem Speerträger. |
| **Beispielbegegnung** | 1 Greifer + 1 `t_green` + 2 `t_yellow`, verwinkelter Raum. Die Minen und der Mörser bestimmen, wohin man **nicht** darf — der Greifer zieht genau dorthin. |
| **Elite-Variante** | `rasend` — er zieht und flieht anschließend, was Weg (3) entwertet und den Spieler zwingt, sich für Ausweichen oder Leinenschuss zu entscheiden. |
| **Placeholder-Sprite** | Kompakte Wanne (18 × 20 px) mit **Kranarm und Haken statt Lauf** (deutlich sichtbarer, nach hinten gebogener Haken). Farbe: Industriegelb mit schwarzen Streifen. |
| **Warum gebraucht** | Das Magazin (5 Kugeln) ist mechanisch die interessanteste Ressource des Spiels, wird aber im Kampf fast nie spürbar. Der Greifer ist der erste Gegner, der eine Kugel für etwas **anderes als einen Kill** verlangt. |

---

## 9. Akt-2-Synergien

Je Gegner zwei starke Synergien mit **bestehenden** Gegnern, zwei mit
**neuen**, und eine ausdrücklich **schlechte oder neutrale** Kombination.

| Neuer Gegner | Stark mit bestehend | Stark mit neu | **Schlecht / neutral** | Warum die schlechte Kombination schlecht ist |
|---|---|---|---|---|
| `t_shotgun` Streuer | `t_green`, `t_yellow` | `t_mason`, `t_grabber` | **`t_lance`** | Drückt den Spieler auf mittlere Distanz — genau dorthin, wo beide wirkungslos sind. |
| `t_lance` Speerträger | `t_grey`, `t_green` | `t_relay`, `t_mason` | **`t_rusher`** | Der Rammler erzwingt hektische Bewegung; der Ladeschuss braucht Vorhersagbarkeit. |
| `t_medic` Zehrer | `t_armored`, `t_green` | `t_anchor`, `t_bulwark` | **`t_rusher`** | Der Rammler stirbt in 2 Treffern und verlässt die Heilreichweite sofort. |
| `t_rusher` Rammler | `t_teal`, `t_yellow` | `t_shotgun`, `t_anchor` | **`t_lance`** | Spiegelbild zu oben — 9 Punkte, die einander die Wirkung nehmen. |
| `t_anchor` Anker | `t_armored`, `t_brown` | `t_medic`, `t_bulwark` | **`t_stalker` / `t_rusher`** | Beide verlassen den Aura-Radius sofort; die Aura zahlt für Gegner, die nie darin stehen. |
| `t_relay` Horcher | `t_brown`, `t_grey` | `t_lance`, `t_marshal` | **`t_shotgun` / `t_rusher`** | Nahkämpfer brauchen keine geteilte Sicht. |
| `t_mason` Maurer | `t_green`, `t_teal` | `t_shotgun`, `t_harvester` | **`t_relay`** | Der Maurer zerstört genau die Sichtlinien, von denen der Horcher lebt. |
| `t_dud` Blindgänger | `t_armored`, `t_brown` | `t_anchor`, `t_mason` | **`t_medic`** | Der Zehrer hält einen Gegner am Leben, dessen einziger Wert in seinem Tod liegt. |

### 9.1 Die drei wichtigsten Akt-2-Synergien im Detail

**A · Anker + Zehrer („die Rechenaufgabe").** Der Anker nimmt Flankenbonus
und Exekution, der Zehrer heilt 6 LP/s. Ein `t_armored` (50 LP) dazwischen
braucht plötzlich nicht 5, sondern rund 9 Treffer bei voller Trefferquote.
Die Lösung ist **nicht** mehr Feuerkraft, sondern eine Reihenfolge — und
zwar eine, die der Spieler selbst herleiten muss: Zehrer (3 Treffer) →
Anker (5) → Rest normal.
*Warum das gut ist:* zwei billige Gegner ändern die Bewertung eines dritten,
ohne dass irgendein Wert erhöht wurde.

**B · Horcher + Speerträger („Deckung ist keine Antwort").** Der Ladeschuss
bricht bei Sichtlinienverlust ab — das ist sein einziger Konter. Der Horcher
hebt genau diese Bedingung auf. Der Spieler muss den Konter **verlagern**:
weg vom eigenen Deckungsplatz, hin zur Sichtlinie eines dritten Gegners.
*Warum das gut ist:* der Spieler lernt, dass eine Antwort nicht am Gegner
klebt, sondern an einer Bedingung.

**C · Blindgänger + Anker („der elegante Ausweg").** Der Anker macht
Positionsspiel wertlos — aber Explosionen ignorieren Panzerung und
Flankenlogik ohnehin. Ein Blindgänger, in den Ankerradius gelockt und dort
abgeschossen, räumt die halbe Gruppe.
*Warum das gut ist:* die härteste Aufstellung des Akts hat eine **billige,
elegante** Lösung, die der Spieler selbst finden kann. Das ist der
Unterschied zwischen „schwer" und „ärgerlich".

---

## 10. Akt-3-Synergien

| Neuer Gegner | Stark mit bestehend | Stark mit neu | **Schlecht / neutral** | Warum |
|---|---|---|---|---|
| `t_marshal` Feldwebel | `t_purple`, `t_teal` | `t_metronom`, `t_bulwark` | **`t_stalker`** | Der Pirscher ist meist getarnt und außer Sicht — der Buff greift nie. |
| `t_bulwark` Bollwerk | `t_green`, `t_teal` | `t_medic`, `t_anchor` | **`t_purple`** | Rudelflankierer laufen aus der Deckung heraus und werden von seinem Körper blockiert. |
| `t_stalker` Pirscher | `t_pink`, `t_green` | `t_bulwark`, `t_grabber` | **`t_relay`** | Geteilte Sicht macht die Tarnrolle überflüssig. |
| `t_arclight` Lichtbogen | `t_yellow`, `t_armored` | `t_grabber`, `t_harvester` | **`t_shotgun`** | Der Streuer treibt Ziele auseinander, der Lichtbogen braucht Ballung. |
| `t_tether` Kettenhund | `t_armored`, `t_purple` | `t_medic`, `t_bulwark` | **`t_mason`** | Der Maurer zerreißt mit seinen Wänden die eigenen Ketten. |
| `t_harvester` Verwerter | `t_brown`, `t_yellow` | `t_dud`, `t_arclight` | **`t_bulwark`** | Das Bollwerk verhindert genau die schnellen Kills, von denen er lebt. |
| `t_metronom` Taktgeber | `t_purple`, `t_green` | `t_marshal`, `t_bulwark` | **`t_rusher` / `t_stalker`** | Beide haben keine Schusskadenz zum Synchronisieren. |
| `t_grabber` Greifer | `t_green`, `t_yellow` | `t_shotgun`, `t_dud` | **`t_lance`** | Der Zug reißt den Spieler aus der eingerasteten Ziellinie — er *rettet* ihn. |

### 10.1 Die drei wichtigsten Akt-3-Synergien im Detail

**A · Taktgeber + Feldwebel („die Salve").** Der Feldwebel erhöht die
Kadenz um 30 %, der Taktgeber bündelt sie. Ergebnis: 1,6 s völlige Ruhe,
dann die dichteste Geschosswand, die die Engine erzeugen kann (der Deckel
liegt bei 24 gleichzeitigen Gegnergeschossen — diese Kombination erreicht
ihn tatsächlich).
*Warum das nicht unfair ist:* die 1,6 s Ruhe sind **echt**. Der Raum ist
nicht schwerer geworden, er ist **anders getaktet**. Ein Spieler, der den
Takt liest, hat mehr Handlungsspielraum als in einem Raum ohne Taktgeber.

**B · Verwerter + Blindgänger („die vergiftete Belohnung").** Der
Blindgänger ist in Akt 2 das beste Werkzeug des Spielers. In Akt 3 steht ein
Verwerter daneben — und jede Massenexplosion füttert ihn. Der Spieler muss
ein Werkzeug, das er zu lieben gelernt hat, situativ **nicht** benutzen.
*Warum das gut ist:* es widerlegt eine gelernte Regel, ohne sie zu
verbieten. Wer den Blindgänger weit weg vom Verwerter zündet, bekommt beides.

**C · Greifer + Mörser (`t_green`) („die geschlossene Falle").** Die
Mörsergranate hat 1,7 s Flugzeit, der Zug dauert 1,2 s. Ein Greifer, der
nach dem Abschuss der Granate hakt, zieht den Spieler in einen bereits
sichtbaren, bereits fliegenden Einschlag.
*Warum das nicht unfair ist:* beide Telegraphen sind gleichzeitig sichtbar
(Einschlagring + Leine), und **eine einzige Kugel** auf die Leine löst
beides auf. Die Falle hat einen Preis, keinen Zwang.

---

## 11. Acht Akt-3-Kompositionen

> Budgetprüfung: Akt 3 kauft `10 + Raum × 3,0` Punkte ein (Raum 1 = 13,
> Raum 9 = 37, Raum 17 = 61), Elite ×1,6, maximal 8 Gegner. Alle
> Kompositionen liegen innerhalb dieses Rahmens; die genannte Raumnummer ist
> die früheste, in der sie bezahlbar ist.

### K1 · „Der Chor" — Rhythmus statt Chaos
- **Rollen:** Synchronisierer · Rudel · mobile Deckung
- **Gegner:** 1 `t_metronom` (11) + 3 `t_purple` (27) + 1 `t_bulwark` (8)
- **Budget:** 46 → ab Raum 12
- **Zentrale Synergie:** Der Taktgeber bündelt das Rudel zu einer Salve, das
  Bollwerk nimmt dem Spieler den einfachsten Ausweichweg.
- **Schwäche:** In den 1,6 s Ruhe ist die Gruppe völlig wehrlos.
- **Spielerantwort:** Rhythmus lernen. Auf dem Schlag hinter das Bollwerk
  oder eine Wand, in der Ruhe vorstoßen und töten.
- **Gewünschte Tötungsreihenfolge:** `t_purple` einzeln in den Ruhephasen —
  der Taktgeber wird **absichtlich am Leben gelassen**, weil er die Salven
  vorhersagbar hält.
- **Positionsprinzip:** Immer eine Wand in Schlagreichweite haben.
- **Erfüllt:** „erzwingt eine andere Lösung" (Nicht-Töten als optimale Wahl)

### K2 · „Der Blutzoll" — der Preis des Aufräumens
- **Rollen:** Wachsender Verwerter · Füllmaterial · Werkzeug
- **Gegner:** 1 `t_harvester` (10) + 4 `t_brown` (4) + 1 `t_dud` (3) + 1 `t_green` (6) + 1 `t_pink` (5)
- **Budget:** 28 → ab Raum 6
- **Zentrale Synergie:** Der Verwerter steht in der Mitte, das billige
  Füllmaterial lädt zum schnellen Abräumen ein — und jeder dieser Kills
  macht ihn dauerhaft stärker.
- **Schwäche:** Am Raumbeginn ist der Verwerter mit 40 LP der schwächste
  teure Gegner im Spiel und `slow`.
- **Spielerantwort:** Die Instinktreihenfolge umdrehen — zuerst den, der
  gerade gar nicht bedrohlich ist.
- **Gewünschte Tötungsreihenfolge:** `t_harvester` → `t_green` → Rest. Der
  Blindgänger wird **weit weg** vom Verwerter gezündet, oder gar nicht.
- **Positionsprinzip:** Kämpfe an den Rand ziehen; der Verwerter kann nicht folgen.
- **Erfüllt:** **stark reihenfolgeabhängig**

### K3 · „Die Kette" — die Rechenaufgabe
- **Rollen:** Gebundenes Paar · Heiler · Frontpanzerung
- **Gegner:** 2 `t_tether` (10) + 1 `t_medic` (6) + 1 `t_armored` (5) + 1 `t_teal` (4)
- **Budget:** 25 → ab Raum 5
- **Zentrale Synergie:** Geteilter Schaden **plus** Heilung: solange beides
  läuft, ist das Paar rechnerisch nicht tötbar.
- **Schwäche:** Der Zehrer hat 30 LP und flieht — er zeigt ständig das Heck.
  Die Kette reißt an jeder Wand.
- **Spielerantwort:** Erst die Heilung abstellen, dann entscheiden:
  durchziehen (6 Treffer, beide fallen gleichzeitig) oder Kette reißen
  (hinter eine Wand ziehen, dann 3 Treffer).
- **Gewünschte Tötungsreihenfolge:** `t_medic` → **Entscheidung** → Paar → Rest.
- **Positionsprinzip:** Eine Wand zwischen die beiden Kettenhunde bringen.
- **Erfüllt:** **stark reihenfolgeabhängig**

### K4 · „Der Trichter" — nach vorn gezwungen
- **Rollen:** Mobile Deckung · Positionsdieb · Nahkämpfer · Artillerie
- **Gegner:** 1 `t_bulwark` (8) + 1 `t_grabber` (8) + 2 `t_shotgun` (8) + 1 `t_green` (6)
- **Budget:** 30 → ab Raum 7
- **Zentrale Synergie:** Das Bollwerk versperrt den Rückzug nach vorn, der
  Mörser den Rückzug nach hinten, der Greifer zieht in die Streuer.
- **Schwäche:** Alle vier Rollen sind langsam oder stationär — der Raum ist
  gewinnbar, sobald der Spieler die Flanke findet.
- **Spielerantwort:** Nicht rückwärts. Seitlich am Bollwerk vorbei, dann
  sind Streuer und Greifer nur noch weiche 30-LP-Ziele.
- **Gewünschte Tötungsreihenfolge:** `t_shotgun` (die einzige echte
  Schadensquelle) → `t_grabber` → Rest.
- **Positionsprinzip:** Sich nie zwischen Bollwerk und Wand drängen lassen.
- **Erfüllt:** **primär positionell**

### K5 · „Die Blende" — Deckung schützt nicht
- **Rollen:** Sichtgeber · Kadenzgeber · Füllmaterial · Scharfschütze
- **Gegner:** 1 `t_relay` (5) + 1 `t_marshal` (9) + 3 `t_brown` (3) + 1 `t_lance` (6) + 1 `t_grey` (2)
- **Budget:** 25 → ab Raum 5
- **Zentrale Synergie:** Der Horcher gibt Sicht, der Feldwebel gibt Kadenz —
  aus fünf belanglosen Gegnern wird eine Feuerwand, die durch Wände zielt
  und deren Ladeschuss nicht mehr abbricht.
- **Schwäche:** Beide Unterstützer haben zusammen 60 LP und keinerlei Schutz.
- **Spielerantwort:** Nicht auf die Schützen reagieren, sondern die zwei
  Gegner suchen, die gar nicht schießen.
- **Gewünschte Tötungsreihenfolge:** `t_relay` (2 Treffer) → `t_marshal`
  (4) → der Rest zerfällt zu Akt-1-Füllmaterial.
- **Positionsprinzip:** Sichtlinie **des Horchers** brechen, nicht die eigene.
- **Erfüllt:** **starke Unterstützer-/Carry-Struktur**

### K6 · „Das Rudel" — reiner Druck
- **Rollen:** Kadenzgeber · drei Flankierer · Tarnung
- **Gegner:** 1 `t_marshal` (9) + 3 `t_purple` (27) + 1 `t_stalker` (8)
- **Budget:** 44 → ab Raum 12
- **Zentrale Synergie:** `packFlank` umkreist ohne Sichtlinie, +30 % Kadenz
  macht daraus Dauerfeuer aus allen Richtungen; der Pirscher besetzt den Rücken.
- **Schwäche:** Der Feldwebel steht per Verhalten in einer Sichtachse — also
  im Offenen. Und der Pirscher wird vom Feldwebel faktisch nie verstärkt
  (bewusst eingebaute schwache Kombination innerhalb einer starken
  Aufstellung).
- **Spielerantwort:** Eine Ecke suchen, die den Rücken deckt, und den
  Feldwebel durch Positionswechsel abschalten statt ihn zu jagen.
- **Gewünschte Tötungsreihenfolge:** Sichtlinie zum `t_marshal` brechen →
  `t_purple` einzeln → `t_stalker` beim Enttarnen.
- **Positionsprinzip:** Rücken an die Wand, Feldwebel hinter die Ecke.
- **Erfüllt:** **starke Unterstützer-/Carry-Struktur**

### K7 · „Der Käfig" — der Raum wird kleiner
- **Rollen:** Raumbauer · Positionsdieb · Kettenblitz · Minenleger
- **Gegner:** 1 `t_mason` (6) + 1 `t_grabber` (8) + 1 `t_arclight` (9) + 2 `t_yellow` (6) + 1 `t_dud` (3)
- **Budget:** 32 → ab Raum 8
- **Zentrale Synergie:** Der Maurer verkleinert die nutzbare Fläche, die
  Minen sperren weitere Teile, der Greifer zieht in den Rest — und der
  Lichtbogen belohnt jede erzwungene Ballung.
- **Schwäche:** Alle vier sind weich (30 LP oder weniger) und `slow`. Der
  Maurer steht für jede Wand 0,8 s bewegungslos.
- **Spielerantwort:** Aktiv Fläche zurückerobern — Wände einreißen, bevor
  der Raum zu ist, statt Gegner zu jagen.
- **Gewünschte Tötungsreihenfolge:** `t_mason` → `t_grabber` → `t_arclight`.
- **Positionsprinzip:** Immer zwei Fluchtrichtungen offenhalten; niemals in
  eine frisch gebaute Nische.
- **Erfüllt:** **primär positionell**

### K8 · „Der Ankerhof" — wenn Positionsspiel nicht mehr zahlt
- **Rollen:** Regelbrecher · Deckung · Heiler · Frontpanzerung · Tarnung
- **Gegner:** 1 `t_anchor` (7) + 1 `t_bulwark` (8) + 1 `t_medic` (6) + 1 `t_armored` (5) + 1 `t_stalker` (8)
- **Budget:** 34 → ab Raum 8
- **Zentrale Synergie:** Der Anker nimmt Flanke und Exekution, das Bollwerk
  schützt frontal, der Zehrer heilt. Alle drei Standardantworten des
  Spielers — flankieren, exekutieren, ausbrennen — sind gleichzeitig
  abgeschaltet.
- **Schwäche:** Die ganze Aufstellung ist **stationär und langsam**, und der
  Anker steht garantiert dort, wo er beim Betreten stand. Explosionen
  ignorieren jede ihrer Verteidigungen.
- **Spielerantwort:** Die vierte Antwort finden: Bombe, Mine oder ein
  hereingelockter `t_dud`. Alternativ: den Pirscher als einzigen beweglichen
  Gegner abarbeiten und die Gruppe stehen lassen — der Raum verfolgt nicht.
- **Gewünschte Tötungsreihenfolge:** `t_medic` → `t_anchor` → dann sind
  Flanke und Exekution zurück und der Rest fällt normal.
- **Positionsprinzip:** Außerhalb des Ankerrings bleiben; alles, was folgt,
  wird draußen getötet.
- **Erfüllt:** **erzwingt eine andere Lösung** (Explosion statt Positionsspiel)

### 11.1 Abdeckung der Anforderungen

| Anforderung | Erfüllt durch |
|---|---|
| ≥ 2 stark reihenfolgeabhängig | **K2**, **K3** |
| ≥ 2 primär positionell | **K4**, **K7** |
| ≥ 2 mit starker Unterstützer-/Carry-Struktur | **K5**, **K6** |
| ≥ 2, die eine andere Lösung erzwingen | **K1** (nicht töten), **K8** (Explosion) |

---

## 12. Zehn Akt-2-Encounter

> Raumcharaktere („offen" / „eng" / „verwinkelt") existieren bereits in
> `difficulty.json: roomCharacters`. **A2 und A3 sowie A7 und A8 nutzen
> bewusst dieselben oder fast dieselben Gegner in unterschiedlichen Räumen
> bzw. Spawnreihenfolgen** und spielen sich dadurch völlig verschieden.

### A1 · „Erste Berührung" — Raum 2, offen · 11 Punkte
- **Gegner:** 2 `t_rusher` (6) + 1 `t_shotgun` (4)
- **Raumidee:** Weite Fläche, zwei Einzelblöcke in der Mitte.
- **Spawnreihenfolge:** beide Rammler zuerst (fernab), der Streuer erst,
  wenn der Spieler sich der Mitte nähert.
- **Gewünschte Reaktion:** rückwärts laufen und schießen.
- **Zentrale Synergie:** keine — das ist Absicht. Beide Mechaniken werden
  getrennt gelernt.
- **Counterplay:** Der Sturm dreht nicht nach; die Schrotreichweite endet
  bei 210 px.
- **Schwierigkeit:** 2/10
- **Warum interessant:** Der erste Raum, in dem Rückwärtslaufen richtig ist.
  Das widerspricht der in Akt 1 gelernten Flankenregel — genau der
  gewünschte kleine Bruch.

### A2 · „Freies Feld" — Raum 4, **offen** · 17 Punkte
- **Gegner:** 1 `t_lance` (6) + 3 `t_brown` (3) + 2 `t_grey` (4) + 1 `t_yellow` (3)
- **Raumidee:** Große offene Fläche, nur zwei kleine Deckungen.
- **Spawnreihenfolge:** Speerträger am gegenüberliegenden Rand zuerst
  sichtbar, Rest verteilt.
- **Gewünschte Reaktion:** Von Deckung zu Deckung springen, in den 2,4 s
  Zwangspause vorrücken.
- **Zentrale Synergie:** Die Minen des Gelben verengen die zwei Deckungen.
- **Counterplay:** Timing. Der Ladeschuss ist 1,3 s lang sichtbar.
- **Schwierigkeit:** 5/10
- **Warum interessant:** Deckung ist knapp, also wird sie wertvoll.

### A3 · „Enge Gasse" — Raum 4, **eng** · 17 Punkte, **gleiche Gegner wie A2**
- **Gegner:** identisch zu A2.
- **Raumidee:** Korridorsystem, kaum Sichtachsen länger als 250 px.
- **Spawnreihenfolge:** Speerträger **hinten in einer Sackgasse**, die
  Braunen und Grauen vorn.
- **Gewünschte Reaktion:** Vorrücken statt Ausweichen — der Speerträger
  bekommt in diesem Raum fast nie eine Sichtlinie.
- **Zentrale Synergie:** Die Minen werden zur eigentlichen Bedrohung, weil
  die Gassen keine Ausweichbreite haben.
- **Counterplay:** Ecken nutzen; die Sichtlinie des Speerträgers geht von
  selbst verloren.
- **Schwierigkeit:** 4/10
- **Warum interessant:** **Dieselben 17 Punkte, ein völlig anderer Kampf.**
  In A2 ist der Speerträger der Chef, in A3 ist er Statist und die 3 Punkte
  Minen entscheiden. Das ist der Beweis, dass Raumstruktur eine
  Designvariable ist und nicht Dekoration.

### A4 · „Der Schutzherr" — Raum 6, verwinkelt · 22 Punkte
- **Gegner:** 1 `t_medic` (6) + 1 `t_armored` (5) + 1 `t_teal` (4) + 1 `t_pink` (5) + 1 `t_yellow` (3)
- **Raumidee:** Ein zentraler Block; der Zehrer hält sich dahinter.
- **Spawnreihenfolge:** Gepanzerter vorn, Zehrer bewusst **erst sichtbar**,
  wenn der Spieler den Block umrundet.
- **Gewünschte Reaktion:** Erkennen, dass der Gepanzerte nicht sterben will,
  und die Ursache suchen.
- **Zentrale Synergie:** Heilung auf 50 LP + Frontreflexion.
- **Counterplay:** Heilstrahl per Positionswechsel unterbrechen, oder den
  Zehrer töten (3 Treffer).
- **Schwierigkeit:** 5/10
- **Warum interessant:** Der erste Raum des Spiels, in dem der offensichtlich
  gefährlichste Gegner **nicht** das richtige Ziel ist.

### A5 · „Der Zeuge" — Raum 5, verwinkelt · 19 Punkte
- **Gegner:** 1 `t_relay` (5) + 4 `t_brown` (4) + 2 `t_grey` (4) + 2 `t_rusher` (6)
- **Raumidee:** Viele kurze Wände, viele scheinbar sichere Ecken.
- **Spawnreihenfolge:** Alle gleichzeitig — der Horcher am Rand, in einer
  Sichtachse über den halben Raum.
- **Gewünschte Reaktion:** Erst Deckung suchen (funktioniert nicht), dann
  den Lichtfaden verfolgen.
- **Zentrale Synergie:** Sechs wertlose Akt-1-Gegner werden zu Schützen.
- **Counterplay:** Ein einziger gut gewählter Schuss (20 LP).
- **Schwierigkeit:** 4/10
- **Warum interessant:** Ein Raum, der sich beim ersten Mal unfair anfühlt
  und beim zweiten Mal trivial ist — ohne dass sich irgendein Wert ändert.
  Genau der gewünschte Lernsprung.

### A6 · „Baustelle" — Raum 7, offen · 25 Punkte
- **Gegner:** 1 `t_mason` (6) + 2 `t_teal` (8) + 2 `t_yellow` (6) + 1 `t_grey` (2) + 1 `t_brown` (1)
- **Raumidee:** Beginnt als der offenste Raum des Akts.
- **Spawnreihenfolge:** Alle gleichzeitig; der Maurer baut ab Sekunde 5.
- **Gewünschte Reaktion:** Zuerst freuen (viel Platz), dann merken, dass der
  Platz verschwindet.
- **Zentrale Synergie:** Die Raketenwerfer bekommen nach 20 s Deckung, die
  sie zu Beginn nicht hatten.
- **Counterplay:** Den Maurer früh töten oder die ersten zwei Wände
  einreißen — beides kostet Kugeln, die dann für die Raketen fehlen.
- **Schwierigkeit:** 6/10
- **Warum interessant:** Der einzige Raum, dessen Schwierigkeit **mit der
  Zeit steigt**, ohne dass Gegner nachkommen.

### A7 · „Fundmunition" — Raum 3, eng · 16 Punkte
- **Gegner:** 2 `t_dud` (6) + 2 `t_pink` (10)
- **Raumidee:** Zwei schmale Kammern mit einem Durchgang.
- **Spawnreihenfolge:** Beide Blindgänger vorn, die Jäger dahinter.
- **Gewünschte Reaktion:** Beim ersten Versuch zu nah stehen. Beim zweiten
  begreifen, dass der Blindgänger eine Waffe ist.
- **Zentrale Synergie:** Der enge Durchgang bringt die Jäger zwangsläufig in
  den Explosionsradius.
- **Counterplay:** 1,2 s Zündschnur, 110 px Radius, beides sichtbar.
- **Schwierigkeit:** 4/10
- **Warum interessant:** Der erste Raum, der eine **Belohnung** für gutes
  Timing gibt statt einer Bestrafung für schlechtes.

### A8 · „Standhaft" — Raum 8, offen · 27 Punkte, **fast dieselben Gegner wie A7**
- **Gegner:** 1 `t_anchor` (7) + 2 `t_dud` (6) + 2 `t_pink` (10) + 1 `t_yellow` (3)
- **Raumidee:** Weite Fläche, der Anker exakt in der Mitte.
- **Spawnreihenfolge:** Anker zuerst und allein sichtbar (er schießt kaum —
  der Spieler ignoriert ihn wahrscheinlich), Jäger und Blindgänger danach.
- **Gewünschte Reaktion:** Erst wie in A7 spielen, dann feststellen, dass
  Flankieren nichts mehr bringt.
- **Zentrale Synergie:** Anker + Jäger; die Lösung sind ausgerechnet die
  Blindgänger, weil Explosionen die Aura ignorieren.
- **Counterplay:** Anker töten (5 Treffer, er steht still) **oder** die
  bereits gelernte Blindgänger-Taktik anwenden.
- **Schwierigkeit:** 7/10
- **Warum interessant:** Er baut direkt auf A7 auf. Die Lösung ist das
  Werkzeug, das der Spieler zwei Räume vorher gelernt hat — das ist
  Kompetenzwachstum statt neuer Information.

### A9 · „Die Rechnung" — Raum 11, verwinkelt · 34 Punkte
- **Gegner:** 1 `t_anchor` (7) + 1 `t_medic` (6) + 1 `t_armored` (5) + 2 `t_shotgun` (8) + 1 `t_green` (6) + 1 `t_grey` (2)
- **Raumidee:** Mehrere Kammern; Anker und Zehrer in der hintersten.
- **Spawnreihenfolge:** Streuer zuerst (sie kommen dem Spieler entgegen),
  die Kammer dahinter erst danach sichtbar.
- **Gewünschte Reaktion:** Die Streuer auf Distanz erledigen, dann die
  Kammer bewerten, statt hineinzulaufen.
- **Zentrale Synergie:** Anker + Zehrer + Gepanzerter — die drei Antworten
  des Spielers (Flanke, Exekution, Ausbrennen) sind gleichzeitig blockiert.
- **Counterplay:** Reihenfolge Zehrer → Anker → Rest. Oder die Bombe.
- **Schwierigkeit:** 8/10 — die härteste **reguläre** Akt-2-Aufgabe.
- **Warum interessant:** Der Raum ist eine Prüfung über den ganzen Akt: er
  verlangt genau die drei Lektionen, die Akt 2 vermittelt hat.

### A10 · „Zweiter Anlauf" — Raum 15, offen, **mit zweiter Welle** · 45 Punkte
- **Gegner Welle 1:** 1 `t_relay` (5) + 1 `t_lance` (6) + 2 `t_pink` (10) + 1 `t_rusher` (3)
- **Gegner Welle 2:** 1 `t_mason` (6) + 1 `t_medic` (6) + 1 `t_green` (6) + 1 `t_shotgun` (4)
- **Raumidee:** Offen, mit vier Deckungssäulen.
- **Spawnreihenfolge:** Welle 2 löst bei 50 % Verlusten aus (bestehendes
  System, 1 s Vorwarnung).
- **Gewünschte Reaktion:** Welle 1 schnell abarbeiten und dabei Position für
  Welle 2 aufbauen.
- **Zentrale Synergie:** Welle 2 ändert den Raumtyp — der Maurer verwandelt
  die offene Fläche in ein Korridorsystem, während der Zehrer die Reste von
  Welle 1 wieder hochheilt.
- **Counterplay:** Welle 1 restlos töten, bevor Welle 2 kommt.
- **Schwierigkeit:** 8/10
- **Warum interessant:** Belohnt Tempo. Wer Welle 1 zügig räumt, kämpft
  gegen 4 Gegner statt gegen 7.

---

## 13. Zehn Akt-3-Encounter

### B1 · „Vorhut" — Raum 1, eng · 13 Punkte
- **Gegner:** 1 `t_bulwark` (8) + 1 `t_pink` (5)
- **Raumidee:** Ein einziger breiter Korridor.
- **Spawnreihenfolge:** Bollwerk vorn, Jäger dahinter.
- **Gewünschte Reaktion:** Frontal schießen, nichts erreichen, umlaufen.
- **Zentrale Synergie:** Keine — Einführungsraum.
- **Counterplay:** 200° ungeschützte Rückseite plus Heckbonus.
- **Schwierigkeit:** 3/10
- **Warum interessant:** Lehrt in 15 Sekunden, dass Akt 3 mit
  Positionsproblemen beginnt, nicht mit Zahlen.

### B2 · „Zwei Hunde" — Raum 2, offen · 15 Punkte
- **Gegner:** 2 `t_tether` (10) + 1 `t_grey` (2) + 1 `t_yellow` (3)
- **Raumidee:** Offen, damit die Kette nie von selbst reißt.
- **Spawnreihenfolge:** Beide Kettenhunde gleichzeitig, weit auseinander.
- **Gewünschte Reaktion:** Auf einen schießen, beide Leisten sinken sehen,
  die Regel ohne Text verstehen.
- **Zentrale Synergie:** Kettenbindung.
- **Counterplay:** Durchziehen (6 Treffer) oder Kette reißen.
- **Schwierigkeit:** 4/10
- **Warum interessant:** Vermittelt eine völlig neue Regel ohne ein einziges
  Wort Erklärung.

### B3 · „Zwei Hunde, enge Gasse" — Raum 2, **verwinkelt** · 15 Punkte, **gleiche Gegner wie B2**
- **Gegner:** identisch zu B2.
- **Raumidee:** Korridorsystem mit vielen Wänden.
- **Spawnreihenfolge:** Kettenhunde in **getrennten** Gassen.
- **Gewünschte Reaktion:** Die Kette ist beim Betreten schon gerissen; der
  Spieler bekämpft zwei gewöhnliche Jäger.
- **Zentrale Synergie:** Keine — die Raumstruktur hat sie ausgeschaltet.
- **Counterplay:** Je 3 Treffer.
- **Schwierigkeit:** 2/10
- **Warum interessant:** Zeigt dem Spieler (und dem Designer), dass die
  Kettenregel **an den Raum gebunden** ist. Ein Spieler, der B2 kennt und
  B3 betritt, erkennt sofort: „hier ist die Kette nichts wert" — das ist
  gelesene Kompetenz.

### B4 · „Funkenflug" — Raum 4, offen · 22 Punkte
- **Gegner:** 1 `t_arclight` (9) + 2 `t_yellow` (6) + 1 `t_pink` (5)
- **Raumidee:** Offen, mit einer Engstelle in der Mitte.
- **Spawnreihenfolge:** Minenleger zuerst (sie verengen die Wege), Lichtbogen
  danach am Rand.
- **Gewünschte Reaktion:** Standardpanzer: ein normaler Raum. Nekromant:
  sofortiger Verlust der halben Legion.
- **Zentrale Synergie:** Minen erzwingen Ballung, Blitz erntet sie.
- **Counterplay:** Auseinandergehen; für den Nekromanten: Untertanen über
  die eigene Zielwahl wegschicken.
- **Schwierigkeit:** 4/10 (Standard) bzw. 8/10 (Nekromant)
- **Warum interessant:** **Derselbe Raum, zwei Schwierigkeitsgrade je nach
  Klasse** — ohne eine einzige klassenspezifische Regel.

### B5 · „Der Schatten" — Raum 5, verwinkelt · 24 Punkte
- **Gegner:** 2 `t_stalker` (16) + 1 `t_green` (6) + 1 `t_brown` (1)
- **Raumidee:** Viele Ecken, wenige lange Sichtachsen.
- **Spawnreihenfolge:** Mörser und Brauner sichtbar, die Pirscher getarnt am
  Rand.
- **Gewünschte Reaktion:** Auf den offensichtlichen Gegner zielen, von hinten
  getroffen werden, danach die Kettenspuren lesen.
- **Zentrale Synergie:** Der Mörser verbietet Stillstand, die Pirscher
  bestrafen den ungeschützten Rücken.
- **Counterplay:** Rücken zur Wand; 2 s Sichtbarkeit reichen für 3 Treffer.
- **Schwierigkeit:** 6/10
- **Warum interessant:** Belohnt Aufmerksamkeit auf ein bereits existierendes,
  bisher rein dekoratives System (Kettenspuren).

### B6 · „Das Netz" — Raum 7, offen · 29 Punkte
- **Gegner:** 1 `t_grabber` (8) + 1 `t_green` (6) + 2 `t_shotgun` (8) + 2 `t_yellow` (6)
- **Raumidee:** Offen, damit Haken und Mörser freie Bahn haben.
- **Spawnreihenfolge:** Streuer und Minen zuerst, der Greifer erst nach
  ~8 s (er kommt vom Rand).
- **Gewünschte Reaktion:** Nach dem ersten Zug in eine Explosion begreifen,
  dass die Leine ein Ziel ist.
- **Zentrale Synergie:** Mörserflugzeit 1,7 s vs. Zugdauer 1,2 s — die
  geschlossene Falle.
- **Counterplay:** Eine Kugel für die Leine, oder dem 0,7-s-Korridor ausweichen.
- **Schwierigkeit:** 7/10
- **Warum interessant:** Der erste Raum, in dem eine Kugel für etwas anderes
  als einen Kill ausgegeben wird — und das spürbar wehtut.

### B7 · „Der Hunger" — Raum 8, eng · 32 Punkte
- **Gegner:** 1 `t_harvester` (10) + 4 `t_brown` (4) + 2 `t_grey` (4) + 1 `t_dud` (3) + 1 `t_teal` (4)
- **Raumidee:** Enge Kammern; der Verwerter in der größten.
- **Spawnreihenfolge:** Alles gleichzeitig; das Füllmaterial drängt in die
  Kammer des Verwerters.
- **Gewünschte Reaktion:** Aufräumen wollen — und dabei zusehen, wie der
  Verwerter Marke um Marke sammelt.
- **Zentrale Synergie:** Billiges Füllmaterial als Nahrung; der Blindgänger
  als vergiftete Belohnung.
- **Counterplay:** Verwerter zuerst (4 Treffer), oder den Kampf in die
  Nachbarkammer ziehen — er ist `slow`.
- **Schwierigkeit:** 7/10
- **Warum interessant:** Bestraft die Gewohnheit, die der Spieler seit Akt 1
  aufgebaut hat („billige zuerst"), und gibt ihm gleichzeitig zwei klare
  Auswege.

### B8 · „Im Takt" — Raum 10, offen · 38 Punkte
- **Gegner:** 1 `t_metronom` (11) + 1 `t_marshal` (9) + 3 `t_purple` (27 → zu teuer) → **1 `t_metronom` (11) + 1 `t_marshal` (9) + 2 `t_purple` (18)**
- **Budget:** 38
- **Raumidee:** Offen mit vier gleichmäßig verteilten Säulen — genug
  Deckung, um den Takt zu nutzen.
- **Spawnreihenfolge:** Taktgeber zuerst und deutlich sichtbar (sein
  Pendel schwingt bereits, bevor gekämpft wird).
- **Gewünschte Reaktion:** Die erste Salve fressen, dann den Takt zählen.
- **Zentrale Synergie:** Kadenz × Bündelung = die dichteste Salve des Spiels.
- **Counterplay:** Auf dem Schlag hinter eine Säule, in der Ruhe vorstoßen.
  Oder den Feldwebel abschalten (Sichtlinie) und den Taktgeber **behalten**.
- **Schwierigkeit:** 8/10
- **Warum interessant:** Die optimale Lösung ist, den auffälligsten Gegner
  **am Leben zu lassen** — eine Entscheidung, die das Spiel bis dahin nie
  angeboten hat.

### B9 · „Die Festung" — Raum 13, verwinkelt · 46 Punkte
- **Gegner:** 1 `t_anchor` (7) + 1 `t_bulwark` (8) + 1 `t_medic` (6) + 2 `t_tether` (10) + 1 `t_armored` (5) + 1 `t_marshal` (9)
- **Raumidee:** Eine große Endkammer mit einem einzigen breiten Zugang.
- **Spawnreihenfolge:** Alles steht bereits, wenn der Spieler eintritt —
  eine sichtbare Aufstellung, kein Hinterhalt.
- **Gewünschte Reaktion:** Stehenbleiben und lesen, bevor geschossen wird.
- **Zentrale Synergie:** Anker (keine Flanke/Exekution) + Zehrer (Heilung) +
  Kette (Schadensteilung) + Bollwerk (Frontblock) — vier
  Verteidigungsschichten übereinander.
- **Counterplay:** Die Aufstellung ist **komplett stationär**. Der Spieler
  darf sich Zeit nehmen, von außen einzelne Gegner herauslocken oder
  Explosionen einsetzen.
- **Schwierigkeit:** 9/10 — die härteste reguläre Aufstellung des Spiels.
- **Warum interessant:** Sie ist bewusst **langsam**. Ihre Härte kommt aus
  Schichtung, nicht aus Druck — der Spieler wird nie gehetzt, nur gefordert.

### B10 · „Alles auf einmal" — Raum 16, offen, **mit zweiter Welle** · 58 Punkte
- **Gegner Welle 1:** 1 `t_metronom` (11) + 1 `t_bulwark` (8) + 2 `t_purple` (18)
- **Gegner Welle 2:** 1 `t_harvester` (10) + 1 `t_grabber` (8) + 1 `t_stalker` (8)
- **Raumidee:** Große offene Arena mit zwei Säulenpaaren.
- **Spawnreihenfolge:** Welle 2 bei 50 % Verlusten. Der Verwerter erscheint
  also **genau dann**, wenn die Hälfte der ersten Welle schon gestorben ist —
  er startet ungefüttert, wächst aber am Rest.
- **Gewünschte Reaktion:** Welle 1 möglichst weit **weg** vom künftigen
  Verwerter-Spawn töten (die Spawnpunkte sind während der 1-s-Vorwarnung
  sichtbar).
- **Zentrale Synergie:** Welle 2 verändert die Regeln von Welle 1: Rhythmus
  war ausreichend, plötzlich kommt Rückendruck und Positionsdiebstahl dazu.
- **Counterplay:** Tempo in Welle 1, Position vor der Vorwarnung wählen.
- **Schwierigkeit:** 9/10
- **Warum interessant:** Die 1-s-Wellenvorwarnung wird von einer reinen
  Warnung zu einer **taktischen Information** — der einzige Raum, in dem sie
  eine Entscheidung auslöst.

---

## 14. Difficulty Curve

**Grundregel:** In jedem Raum wird **höchstens eine** neue Mechanik zum
ersten Mal freigeschaltet. Das ist über `difficulty.json:
danger.<typ>.unlockRoomInAct` direkt ausdrückbar — es braucht keinen neuen
Mechanismus, nur eine bewusste Belegung.

### 14.1 Akt 2 — Einführungsplan

| Raum | Neu freigeschaltet | Erster Kontakt | Erste einfache Kombination | Komplexe Kombination |
|---|---|---|---|---|
| 1 | `t_rusher` (3) | allein oder mit `t_brown` | — | — |
| 2 | `t_shotgun` (4) | **A1** (Rammler + Streuer) | — | — |
| 3 | `t_dud` (3) | **A7** (Blindgänger + Jäger) | — | — |
| 4 | `t_lance` (6) | **A2 / A3** | Lance + Minen | — |
| 5 | `t_relay` (5) | **A5** | Horcher + Füllmaterial | — |
| 6 | `t_medic` (6) | **A4** | Zehrer + `t_armored` | — |
| 7 | `t_mason` (6) | **A6** | Maurer + Raketen | — |
| 8 | `t_anchor` (7) | **A8** (baut auf A7 auf) | Anker + Jäger | — |
| 9–12 | — | — | Horcher + Speerträger; Maurer + Streuer | **A9** (Anker + Zehrer + Gepanzert) |
| 13–17 | — | — | — | **A10** (zwei Wellen), Eliteräume |

**Lesart der Kurve:** Räume 1–8 sind Vokabelunterricht — je ein neuer
Gegner, jeweils in einer Umgebung, die seine Regel deutlich macht. Ab Raum 9
wird nichts Neues mehr eingeführt; die Schwierigkeit kommt ausschließlich
aus Kombinationen bereits bekannter Teile. Der letzte harte Raum (A9)
verlangt **genau** die drei Lektionen des Akts.

### 14.2 Akt 3 — Einführungsplan

| Raum | Neu freigeschaltet | Einführung | Erste Komposition | Synergie-Komposition | Hochschwierige Komposition |
|---|---|---|---|---|---|
| 1 | `t_bulwark` (8) | **B1** | — | — | — |
| 2 | `t_tether` (5) | **B2 / B3** | — | — | — |
| 3 | `t_marshal` (9) | mit `t_purple` | — | — | — |
| 4 | `t_arclight` (9) | **B4** | K3 „Die Kette" (25) | — | — |
| 5 | `t_stalker` (8) | **B5** | — | — | — |
| 6 | `t_grabber` (8) | — | K2 „Der Blutzoll" (28) | — | — |
| 7 | — | — | **B6** „Das Netz" (29) | K4 „Der Trichter" (30) | — |
| 8 | `t_harvester` (10) | **B7** | — | K7 „Der Käfig" (32), K8 „Der Ankerhof" (34) | — |
| 9 | — | — | — | K5 „Die Blende" (25) | — |
| 10 | `t_metronom` (11) | **B8** | — | — | — |
| 11–13 | — | — | — | K6 „Das Rudel" (44) | **B9 „Die Festung"** (46) |
| 14–17 | — | — | — | K1 „Der Chor" (46) | **B10** (zwei Wellen, 58) |

**Lesart der Kurve:** Der Taktgeber kommt bewusst **spät** (Raum 10). Er ist
der einzige Gegner, dessen Regel „töte ihn vielleicht nicht" lautet — das
setzt voraus, dass der Spieler die Standardregel („töte Unterstützer zuerst",
gelernt an Zehrer und Feldwebel) bereits verinnerlicht hat. Eine Regel kann
man nur brechen, wenn sie steht.

Der Verwerter kommt in Raum 8, weil er die Akt-1-Gewohnheit „billige zuerst"
angreift — dafür muss der Spieler in Akt 3 schon wieder in Routine verfallen
sein.

### 14.3 Was bewusst NICHT passiert

- Kein Raum führt zwei neue Gegner gleichzeitig ein.
- Kein neuer Gegner debütiert in einem Eliteraum (Affixe wären eine
  zusätzliche unbekannte Variable).
- Keine Komposition mit ≥ 3 neuen Gegnern vor Raum 7 des jeweiligen Akts.
- Zweite Wellen (ab 6 Gegnern) treten in der zweiten Akthälfte auf, wenn die
  Einzelrollen sitzen.

---

## 15. Build-Interaktionen

**Ausgangslage, die alles bestimmt:** Der Standardpanzer hat **8 Karten**
(5 Sockel + 3 Legendäre), der Nekromant **115**. Kein neuer Gegner darf
deshalb Kartenbesitz voraussetzen. Die folgende Tabelle beschreibt, welche
*Spielweisen* profitieren — nicht welche Karten man braucht.

| Neuer Gegner | Profitiert davon | Wird herausgefordert | Kontert ihn gut | Ist der Konter Belohnung oder Zwang? |
|---|---|---|---|---|
| `t_shotgun` | Fernkampf, Ausweichen (`sockel_motor`) | Flankenspiel, Nahkampf-Nekromant | Tempo + Rückwärtsfeuer | **Belohnung** — wer Abstand hält, gewinnt gratis |
| `t_lance` | Deckungsnutzung, hohe Mobilität | Stehendes Zielen, langsame Builds | Bewegung, Timing | **Belohnung** |
| `t_medic` | Hoher Einzelschaden (`sockel_ladeautomat`) | Dauerfeuer mit niedrigem Schaden | Burst über 6 LP/s | **Belohnung** (Exekution schlägt Heilung) |
| `t_rusher` | Alles | Nichts wirklich | Zwei Kugeln | **weder noch** — bewusst neutral |
| `t_anchor` | **Explosionen** (Bombe, Minen), hoher Rohschaden | **Flankenspiel** und **Krit-Exekution** | Bombe / Blindgänger / 5-Kugel-Salve | **Belohnung** für ein zweites Werkzeug |
| `t_relay` | Aggressives Vorrücken | Deckungsspiel, passive Builds | Positionswechsel, ein Schuss | **Belohnung** |
| `t_mason` | Hoher Schaden pro Schuss, Explosionen | Reines Kiten über lange Wege | Wände einreißen oder umgehen | **Belohnung** |
| `t_dud` | **Jeder Build** | Nichts | Abstand, Zielwahl | **reine Belohnung** — er hilft dem Spieler öfter, als er schadet |
| `t_marshal` | Positionsspiel | Reines Kill-Priority-Denken | Sichtlinie brechen | **Belohnung** für räumliches Denken |
| `t_bulwark` | Explosionen, Beweglichkeit | Statische Feuerpositionen | Umlaufen, Bombe | **Belohnung** |
| `t_stalker` | Aufmerksamkeit, Raumbewusstsein | Tunnelblick-Builds | Rücken decken, Spuren lesen | **Belohnung** |
| `t_arclight` | Standardpanzer, Einzelkämpfer-Builds | **Nekromant-Legion** (Pfad „Legion") | Auseinandergehen | **Belohnung, mit Vorbehalt** — siehe unten |
| `t_tether` | Hoher Schaden pro Schuss | Chipdamage-Builds | Durchziehen oder Kette reißen | **Belohnung** |
| `t_harvester` | Diszipliniertes Zielen | „Alles abräumen"-Spielweise | Zuerst töten, Kampf wegziehen | **Belohnung** |
| `t_metronom` | Rhythmusgefühl, Deckungsnutzung | Dauerfeuer-Builds ohne Pause | Takt lesen — oder ihn behalten | **Belohnung** (mit echter Wahl) |
| `t_grabber` | Munitionsökonomie | Builds mit sehr wenigen aktiven Kugeln | Eine Kugel für die Leine | **Zwang mit Ausweg** — siehe unten |

### 15.1 Die zwei kritischen Fälle

**`t_arclight` gegen den Nekromanten-Pfad „Legion".** Der Legion-Pfad
(42 Karten) belohnt viele gleichzeitige Untertanen. Der Lichtbogen bestraft
genau das. **Prüfung: macht er den Build unspielbar?** Nein —
(a) er springt auf **maximal 2** weitere Ziele mit 30 % Abfall, tötet also
nie eine ganze Legion; (b) das Geisterlimit liegt ohnehin bei 3 (+ Karten),
also ist der Schaden gedeckelt; (c) der Nekromant kontrolliert die
Untertanenposition indirekt über seine eigene Zielwahl; (d) er ist mit
30 LP der weichste teure Gegner in Akt 3. **Ergebnis: erschwert, verbietet
nicht** — genau das vom Brief verlangte Verhältnis. Er ist zugleich der
einzige Gegner, der dem Legion-Pfad überhaupt eine Grenze setzt, und damit
balancetechnisch **wertvoll**, nicht nur thematisch.

**`t_grabber` gegen munitionsarme Builds.** Wer nur wenige aktive Kugeln
hat, empfindet „gib eine Kugel für die Leine aus" als Zwang. Deshalb hat er
**drei** Ausgänge statt zwei: ausweichen (kostet nichts), Leine zerschießen
(kostet eine Kugel), oder den Zug annehmen (kostet nichts und bringt einen
30-LP-Gegner in Reichweite). Die dritte Option ist ausdrücklich als
Ventil eingebaut — ohne sie wäre er ein Zwangsgegner.

### 15.2 Kein Build wird dauerhaft unspielbar

| Spielweise | Härtester Gegner dagegen | Warum sie trotzdem funktioniert |
|---|---|---|
| Nahkampf / Flankenspiel | `t_anchor`, `t_shotgun` | Beide sind räumlich begrenzt (160 px Aura, 210 px Reichweite) — außerhalb gilt alles wie vorher. |
| Deckungsspiel | `t_relay`, `t_marshal` | Beide sind 2–4 Treffer wert und heben Deckung nur auf, solange sie leben. |
| Nekromant „Legion" | `t_arclight` | Gedeckelter Sprungschaden, weichster teurer Gegner. |
| Nekromant „Alpha" (ein starker Champion) | `t_tether`, `t_bulwark` | Der Champion ignoriert Ketten (nur Panzer werden gebunden) und umläuft Panzerung. |
| Explosivspiel (Bombe/Minen) | `t_harvester` | Er wächst an Massenkills — aber Explosionen sind zugleich die einzige Antwort auf `t_anchor`/`t_bulwark`. Ein echter Zielkonflikt, kein Ausschluss. |
| Langsames, ruhiges Zielen | `t_rusher`, `t_metronom` | Der Taktgeber gibt sogar **mehr** ruhige Zeit als ein Raum ohne ihn. |

---

## 16. Placeholder-Sprites

Regel: **Die Funktion muss in der Silhouette erkennbar sein.** Das Projekt
hat dafür bereits die technische Grundlage — `sprites.js: SPRITE_ALIAS`
erlaubt, einen neuen Typ auf eine vorhandene Wanne zu legen, und
`renderer.js` zeichnet Overlays (Panzerung, Affixpunkte, Lebensleiste)
unabhängig vom Sprite. Alle 16 Gegner sind deshalb **ohne eine einzige neue
PNG-Datei** spielbar; die folgenden Beschreibungen sind die Zielsilhouette
für spätere echte Grafiken bzw. die prozedurale Zwischenlösung.

| Gegner | Silhouette | Wanne | Turm/Aufbau | Größe (px) | Optische Besonderheit | Farbe | Fähigkeitssignal |
|---|---|---|---|---|---|---|---|
| `t_shotgun` | breit und stumpf | 24 × 20 | sehr kurzer Trichter | groß, flach | Lauf **breiter als lang** | kräftiges Orange | Kegel blitzt beim Feuern, Reichweitenring bei 210 px |
| `t_lance` | lang und dünn | 16 × 26 | extrem langer dünner Lauf | längste Silhouette | Lauf ≈ Wannenlänge | kaltes Stahlblau | Ziellinie gelb → rot beim Einrasten, Laufglühen |
| `t_medic` | rund, kein Rohr | 20 × 20 | kurzer Ausleger mit Ring | mittel | **kein Lauf** | weißgrün, grünes Kreuz | dicker grüner Heilstrahl zum Ziel |
| `t_rusher` | Keil | 22 × 16 | **keiner** | klein | einzige Silhouette ohne Rohr | rostiges Rot | Schaufel klappt herunter, Sturmkorridor |
| `t_anchor` | breit mit Stützen | 28 × 18 | Stummelturm | sehr breit, flach | vier sichtbare Bodenstützen | dunkles Violettgrau | permanenter Bodenring (160 px), Ankersymbol an betroffenen Gegnern |
| `t_relay` | klein mit Schüssel | 14 × 18 | Antennenbogen | kleinste Silhouette | Antenne dreht sichtbar mit | helles Gelbgrau | gelber Lichtfaden zum Spieler |
| `t_mason` | Kasten mit Arm | 22 × 22 | eckiger Kranausleger | mittel | rechtwinkliger Arm | Betongrau, gelbe Warnkante | durchscheinendes Gerüst auf der Bauzelle |
| `t_dud` | Kugel | 20 × 20 | Zündschnur-Stiel | mittel | **einziges rundes Chassis** | mattschwarz | rotes Ringblinken, beim Tod gefüllter 110-px-Ring |
| `t_marshal` | normal mit Wimpel | 18 × 22 | Fahnenmast statt Lauf | mittel | Wimpel flattert | Olivgrün, oranger Wimpel | orange Fahnenlinien zu jedem verstärkten Gegner |
| `t_bulwark` | massiv | 34 × 26 | sehr kurzer Lauf + Frontschild | **größte Silhouette** | Schild als eigenes Rechteck | Stahlgrau, heller Frontbalken | bestehendes Panzerungs-Overlay + `reflect`-Blitz |
| `t_stalker` | schlank, gepfeilt | 16 × 24 | Lauf mit Dämpferwulst | schmal | im Tarnzustand 20 % Deckkraft | Dunkelgrün | Kettenspuren im Boden, volle Sichtbarkeit 0,6 s vor Schuss |
| `t_arclight` | schmal mit Spulen | 16 × 20 | zwei Ringe übereinander | schmal | Funke zwischen den Ringen | Tiefblau | Vorschau-Bögen zu Sprungzielen, bestehender `drawLightning` |
| `t_tether` | kompakt mit Haken | 18 × 18 | normaler kurzer Lauf, Ring hinten | klein | **nur mit der Kette lesbar** | Rostbraun | dicke Kette, zuckt bei jedem geteilten Treffer |
| `t_harvester` | gedrungen mit Trichter | 22 × 20 | offener Kegel nach vorn | mittel | seitliche Rippen glühen je Stapel | Dunkelrot | Bodenradius 200 px, Saugeffekt vom Sterbeort |
| `t_metronom` | hoch und schmal | 16 × 22 | **schwingendes Pendel** | schmal | einzige Silhouette mit Eigenbewegung im Ruhezustand | Messinggelb | zusammenziehender Ring + Tick-Ton, Gruppe pulsiert im Takt |
| `t_grabber` | kompakt mit Haken | 18 × 20 | Kranarm mit gebogenem Haken | mittel | Haken zeigt nach hinten (Wurfvorbereitung) | Industriegelb/schwarz | Wurfkorridor 0,7 s, danach flackernde Leine |

### 16.1 Silhouetten-Unterscheidbarkeit

Die 16 Silhouetten sind bewusst über **vier** Achsen gestreut, damit sie
sich auch bei 32 px und in Bewegung unterscheiden:

- **kein Rohr:** `t_rusher`, `t_medic`, `t_metronom` (Pendel), `t_dud` (Schnur)
- **überlanges Rohr:** `t_lance`
- **Aufbau statt Turm:** `t_relay` (Schüssel), `t_mason` (Kran),
  `t_marshal` (Fahne), `t_arclight` (Spulen), `t_grabber` (Haken)
- **Chassisform:** `t_dud` (rund), `t_rusher` (Keil), `t_bulwark` (sehr breit),
  `t_anchor` (breit + Stützen), `t_stalker` (schmal + gepfeilt)

---

## 17. Technische Umsetzung

Einordnung nach dem im Brief geforderten Vier-Stufen-Schema.

### 17.1 Einstufung je Gegner

| Gegner | Einstufung | Konkret nötig |
|---|---|---|
| `t_rusher` | **kleine Erweiterung** | `anvil.js: ramHitCheck()` / `pushFromRam()` sind fertige Vorlagen; als generisches `ram`-Verhalten in `ai_drives.js` heben. |
| `t_dud` | **bestehende Systeme reichen** | Hook in `killTank()` + `explodeAt()` mit `spare: null`. Telegraph = Mörser-Ring-Renderer. **Kein neues System.** |
| `t_arclight` | **bestehende Systeme reichen** | `damageType: "lightning"` an einem Gegnertyp setzen. `damagetypes.js` funktioniert bereits für beliebige Schützen. |
| `t_bulwark` | **bestehende Systeme reichen** | `radius`-Override (seit Amboss vorhanden) + `armor: {arc:160, reflects:false}` (seit Phase 4 vorhanden). **Reine Datenänderung.** |
| `t_shotgun` | **kleine Erweiterung** | `fireBullet()` kennt bereits `twinShot`/`twinSpreadRad`. Auf N Kugeln verallgemeinern + eine per-Kugel-`maxDistance`. |
| `t_lance` | **kleine Erweiterung** | Ladezustand am Panzer + Ziellinie. `pierce` existiert bereits (`bullet.pierce`), Sichtlinie über `clearLine()`. |
| `t_medic` | **kleine Erweiterung** | Heil-Tick + Strahl-Renderer. Kein neues Zustandssystem — `hp` mit `Math.min(maxHp, …)`. |
| `t_relay` | **kleine Erweiterung** | Ein Boolean je Tick (`state.relaySight`), gelesen an genau einer Stelle in `ai_turrets.js: roleTurret()`. |
| `t_anchor` | **kleine Erweiterung** | Aura-Markierung je Panzer (Muster `t.necroAuraWeakened`, existiert), gelesen an **zwei** Stellen in `state.js` (Flankenfaktor, Exekutionsflag). |
| `t_marshal` | **kleine Erweiterung** | Wie `t_anchor`, aber Wirkung auf `fireCooldown`. Sichtlinie über vorhandenes `clearLine()`. |
| `t_stalker` | **kleine Erweiterung** | `t_white: phaseToggle` ist die Vorlage; Sichtbarkeit ist bereits ein Renderer-Zustand. Neu nur die Regel (Distanz + Schussfenster). |
| `t_tether` | **kleine Erweiterung** | Ein Feld `tank.tetherPartner` + eine Zeile in `applyDamage()` (halber Schaden, Rest an den Partner) + Kettenrenderer + Bruchprüfung über `blocksSight()`/Distanz. |
| `t_grabber` | **kleine Erweiterung** | Der Haken existiert als **Spieler-Gadget** (`tank.js: fireHook()`, `traceHook()`, `hookTimer`) — nur die Richtung umdrehen (Ziel wird gezogen, nicht der Schütze) und die Leine beschießbar machen. |
| `t_harvester` | **kleine Erweiterung** | Hook in `killTank()` und `killGhost()` + Stapelzähler + Marken-Renderer. |
| `t_mason` | **größere Systemänderung** | `state.placeTrapWall()` existiert, aber es fehlt eine **Erreichbarkeitsprüfung zur Laufzeit** (Flood-Fill wie im Generator), damit der Spieler nie eingemauert wird. Das ist der einzige echte Neubau unter den Akt-2-Gegnern. |
| `t_metronom` | **größere Systemänderung** | Braucht einen **Feuerfreigabe-Zwischenschritt**: `roleTurret()` gibt heute direkt `fire: true` zurück. Es braucht eine Instanz, die diesen Wunsch zurückhält und gebündelt freigibt. Kein neues Modul, aber ein echter Eingriff in die KI-Schleife. |

**Keiner der 16 Gegner braucht eine neue Architektur.** Das ist kein Zufall,
sondern Auswahlkriterium: Vorschläge, die eine neue Architektur gebraucht
hätten (z. B. ein Gegner, der Gegner beschwört, oder echte Formationsbewegung
für Gruppen), wurden in Abschnitt 19 verworfen.

### 17.2 Gemeinsame technische Grundlagen

Fünf Bausteine tragen jeweils mehrere Gegner. Wer sie einmal baut, bekommt
den Rest fast geschenkt:

| Baustein | Bedient | Aufwand |
|---|---|---|
| **A · Aura-Markierung** (`tank.auraFlags`, einmal pro Tick gesetzt, an definierten Stellen gelesen) | `t_anchor`, `t_marshal`, `t_harvester`-Radius | klein — das Muster `t.necroAuraWeakened` existiert wörtlich |
| **B · Sichtbare Verbindungslinie** (Renderer + Sichtlinien-/Distanzbruch) | `t_medic` (Heilstrahl), `t_relay` (Lichtfaden), `t_marshal` (Fahne), `t_tether` (Kette), `t_grabber` (Leine) | klein — ein gemeinsamer Renderer für alle fünf |
| **C · Vorwarnkorridor / Telegraph-Fläche** | `t_rusher`, `t_lance`, `t_shotgun`, `t_grabber`, `t_dud` | **null** — `effects.js: drawAnvilHazards()` und der Mörser-Telegraph decken beide Formen bereits ab |
| **D · Verallgemeinerter Mehrfachschuss** (N Kugeln, Streuwinkel, eigene Reichweite) | `t_shotgun`, künftige Salvengegner | klein — `twinShot` ist die halbe Miete |
| **E · Kompositionsregeln in `buyEnemies()`** | **alle** | mittel — siehe 17.3 |

### 17.3 Das eine System, das das Projekt wirklich braucht

`buyEnemies()` würfelt heute gleichverteilt aus allen freigeschalteten
Typen. Damit sind **keine** der 8 Kompositionen aus Abschnitt 11 erzeugbar —
sie könnten nur zufällig entstehen.

**Vorschlag (minimal-invasiv, kein neues Modul):**

1. **`maxPerRoom` tatsächlich belegen.** Das Feld existiert bereits in
   `difficulty.json: danger` und wird in `buyEnemies()` bereits ausgewertet
   — es setzt nur niemand. Sofort nutzbar für: `t_anchor` 1, `t_metronom` 1,
   `t_marshal` 1, `t_harvester` 1, `t_relay` 1, `t_mason` 1.
2. **`minRole`-Quote.** Ein optionaler Block je Akt:
   „mindestens 1 Gegner mit Rolle X, wenn Budget ≥ N". Damit ist
   „jeder Akt-3-Raum hat mindestens einen Druckgegner" ausdrückbar.
3. **Kompositionstabelle** (`data/compositions.json`): benannte Rezepte mit
   `minRoom`, `budget`, `enemies[]`, `weight`. `buyEnemies()` versucht
   zuerst, eine bezahlbare Komposition zu ziehen; gelingt das nicht, fällt
   es auf die heutige Zufallsschleife zurück. **Der Rückfall ist wichtig** —
   er hält die Änderung risikoarm und den Determinismus intakt (ein
   `rng()`-Aufruf mehr, an einer klar definierten Stelle).
4. **Mindestpunktzahl je Gegner.** Ein Gegner, dessen Punkte unter
   `budget / 12` liegen, wird nicht mehr gekauft — das entfernt die
   `t_brown`/`t_grey`-Verstopfung in Akt 3 automatisch, ohne die Typen zu
   löschen (sie bleiben für Akt 1 und für Kompositionen, die sie
   ausdrücklich nennen — z. B. K2 „Der Blutzoll" und K5 „Die Blende", wo sie
   Nahrung bzw. Feuerkraft sind).

**Ohne Punkt 3 sind die Abschnitte 11–13 dieses Dokuments nicht umsetzbar.**
Das ist die wichtigste technische Erkenntnis des gesamten Auftrags.

### 17.4 Zwei Fallen, die beim Bau garantiert zuschlagen

1. **`cfg.js: resolveCfg()` ist eine explizite Whitelist** (44 Felder).
   Jedes neue Gegnerfeld (`spread`, `charge`, `heal`, `ram`,
   `suppressField`, `sightRelay`, `build`, `deathBlast`, `rally`, `stalk`,
   `tether`, `harvest`, `metronome`, `grapple`) muss dort eingetragen
   werden, sonst kommt es **lautlos** nie im aufgelösten `cfg` an. Diese
   Falle hat das Projekt schon zweimal getroffen (Phase 14, Phase 15).
2. **Die Trefferschleife kennt kein Teamsystem.** Gegnergeschosse treffen
   Gegner. `t_bulwark` blockt die Schüsse der eigenen Leute, `t_dud` tötet
   Verbündete, der Verwerter frisst sie. Das ist hier bewusst genutzt —
   aber wer einen Gegner baut, der das *nicht* will, muss es explizit
   ausschließen (`friendly`-Flag am Geschoss, existiert bereits).

---

## 18. Danger-Budget

### 18.1 Herleitung der Punktwerte

Alle Werte sind gegen die **bestehende** Skala geeicht (`t_brown` 1 …
`t_black` 12), nicht frei gesetzt. Eichpunkte:

- **1–3 Punkte** = Füllmaterial, einzeln keine Bedrohung (`t_brown` 1,
  `t_grey` 2, `t_yellow` 3)
- **4–6 Punkte** = eine klare Aufgabe, einzeln lösbar (`t_teal` 4,
  `t_pink`/`t_armored` 5, `t_green` 6)
- **8–12 Punkte** = ganze Kampfsituation für sich (`t_white` 8,
  `t_purple` 9, `t_black` 12)

| Gegner | Punkte | Vergleichsanker | Begründung |
|---|---|---|---|
| `t_rusher` | **3** | `t_yellow` (3) | schnell, weich, lästig; keine Reichweite |
| `t_dud` | **3** | `t_yellow` (3) | kein eigener Schaden; hilft dem Spieler etwa so oft wie er schadet |
| `t_shotgun` | **4** | `t_teal` (4) | hoher Schaden in exakt einer Situation, sonst wirkungslos |
| `t_relay` | **5** | `t_pink` (5) | eigener Beitrag gering, Wirkung skaliert mit der Raumbesetzung |
| `t_tether` | **5** je Stück | `t_pink` (5) | einzeln ein Durchschnittsjäger; der Wert entsteht im Paar (10) |
| `t_lance` | **6** | `t_green` (6) | stationärer Fernkämpfer, vollständig durch Bewegung konterbar |
| `t_medic` | **6** | `t_green` (6) | verlängert die Lebenszeit eines Gegners um ~60 % |
| `t_mason` | **6** | `t_green` (6) | Flächenverweigerung, kein direkter Schaden |
| `t_anchor` | **7** | zwischen `t_green` (6) und `t_white` (8) | hebt zwei Kernregeln auf; wirkt auf **alle** im Radius |
| `t_bulwark` | **8** | `t_white` (8) | wenig eigener Schaden, verlängert die Gruppe |
| `t_stalker` | **8** | `t_white` (8) | präzisierte Version derselben Rolle |
| `t_grabber` | **8** | `t_white` (8) | wenig Schaden, liefert den Spieler an alles andere aus |
| `t_marshal` | **9** | `t_purple` (9) | +30 % Gesamtschadensausstoß eines vollen Raums |
| `t_arclight` | **9** | `t_purple` (9) | Mittelwert aus „harmlos gegen Einzelziel" und „dominant gegen Legion" |
| `t_harvester` | **10** | zwischen `t_purple` (9) und `t_black` (12) | einziger Gegner, dessen Gefahr im Raum **wächst** |
| `t_metronom` | **11** | knapp unter `t_black` (12) | verändert das Verhalten aller anderen Gegner |

### 18.2 Vollständige Wertetabelle

| Gegner | maxHp | Treffer¹ | damage | speed | role | agg | acc | prefRange | mag | fireRate | Punkte |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `t_rusher` | 20 | 2 | 20 (Kontakt) | fast (100) | hunter | 1.0 | — | — | — | — | 3 |
| `t_dud` | 20 | 2 | 0 (+40 Explosion) | slow (40) | sapper | 0.4 | — | — | — | — | 3 |
| `t_shotgun` | 30 | 3 | 8 × 5 | normal (70) | hunter | 0.9 | 0.6 | — | 5 | 1.4 | 4 |
| `t_relay` | 20 | 2 | 25 | slow (40) | sapper | 0.05 | 0.2 | — | 1 | 2.5 | 5 |
| `t_tether` | 30 | 3 | 25 | normal (70) | hunter | 0.6 | 0.6 | — | 2 | 1.6 | 5 |
| `t_lance` | 30 | 3 | 35 | slow (40) | sieger | 0.4 | 0.95 | 300 | 1 | 2.4 | 6 |
| `t_medic` | 30 | 3 | 25 | normal (70) | sapper | 0.1 | 0.2 | — | 1 | 3.0 | 6 |
| `t_mason` | 30 | 3 | 25 | slow (40) | sapper | 0.2 | 0.3 | — | 1 | 2.4 | 6 |
| `t_anchor` | 50 | 5 | 25 | fix (0) | guardian | — | 0.4 | — | 1 | 2.2 | 7 |
| `t_bulwark` | 50 | 5² | 25 | slow (40) | hunter | 0.25 | 0.55 | — | 2 | 1.8 | 8 |
| `t_stalker` | 30 | 3 | 25 | fast (100) | hunter | 0.7 | 0.75 | — | 2 | 1.5 | 8 |
| `t_grabber` | 30 | 3 | 25 | normal (70) | sieger | 0.45 | 0.6 | 240 | 1 | 2.0 | 8 |
| `t_marshal` | 40 | 4 | 25 | normal (70) | sieger | 0.15 | 0.5 | 260 | 1 | 2.0 | 9 |
| `t_arclight` | 30 | 3 | 25 (Blitz) | normal (70) | sieger | 0.35 | 0.8 | 260 | 1 | 2.0 | 9 |
| `t_harvester` | 40 (+8/Stapel) | 4 | 25 (+3/Stapel) | slow (40) | sieger | 0.3 | 0.7 | 200 | 2 | 1.7 | 10 |
| `t_metronom` | 40 | 4 | 0 | fix (0) | guardian | — | — | — | — | — | 11 |

¹ Treffer bei 10 Spielerschaden, ohne Flanke/Krit — **alle 16 liegen im
bestehenden 2–5-Treffer-Band**, das `tests/regression.mjs` Abschnitt 10a
für jeden Nicht-Boss-Typ prüft. Kein Vorschlag bricht diesen Test.
² frontal unbegrenzt (Panzerung), von hinten 4 Treffer mit Heckbonus.

### 18.3 Budgetprobe

| Akt/Raum | Budget | Beispielbesetzung | Summe |
|---|---|---|---|
| 2 / 2 | 11,2 | 2 `t_rusher` + 1 `t_shotgun` | 10 |
| 2 / 8 | 26,8 | `t_anchor` + 2 `t_pink` + 2 `t_dud` + `t_yellow` | 26 |
| 2 / 17 | 50,2 | `t_anchor` + `t_medic` + `t_mason` + `t_lance` + 2 `t_shotgun` + `t_green` + `t_relay` | 48 |
| 3 / 4 | 22,0 | `t_arclight` + 2 `t_yellow` + `t_pink` | 20 |
| 3 / 10 | 40,0 | `t_metronom` + `t_marshal` + 2 `t_purple` | 38 |
| 3 / 17 | 61,0 | `t_metronom` + `t_harvester` + `t_marshal` + `t_bulwark` + 2 `t_tether` + `t_stalker` + `t_grabber` | 63 → 8-Gegner-Deckel greift zuerst |

**Beobachtung:** In Akt 3 ist ab etwa Raum 15 nicht mehr das Budget die
Grenze, sondern `maxEnemiesPerRoom: 8`. Das ist gesund — es zwingt teure,
interessante Gegner in die Räume statt vieler billiger. Mit den neuen
Punktwerten (bis 11) wird dieser Punkt früher und verlässlicher erreicht als
heute.

---

## 19. Kritische Qualitätsprüfung

### 19.1 Was verworfen wurde — und warum

Sechs Entwürfe haben die Prüfung **nicht** bestanden und stehen deshalb
nicht in diesem Dokument. Sie werden hier genannt, weil die Begründung für
spätere Sitzungen wertvoller ist als die Idee selbst.

| Verworfene Idee | Was sie tun sollte | Warum verworfen |
|---|---|---|
| **Der Zöllner** — absorbiert Spielergeschosse und feuert die gesammelte Energie zurück | Munitionsökonomie erzwingen | Die einzige richtige Antwort wäre „hör auf zu schießen". Ein Gegner, der die Kernhandlung des Spiels bestraft, hat genau **eine** Lösung — Verstoß gegen „keine Situation mit nur einer richtigen Lösung" (§8). |
| **Der Kerkermeister** — erzeugt einen Ring, den der Spieler nicht verlassen kann | Raumkontrolle | Nimmt Bewegungskontrolle ohne Gegenwehr. Verstoß gegen „keine unvermeidbaren Effekte" und gegen die Grundregel „nichts wegnehmen, was der Spieler nicht zurückholen kann". |
| **Der Brutkasten** — erzeugt fortlaufend neue Gegner | Zeitdruck | Braucht eine **neue Architektur** (Spawn zur Laufzeit gegen `maxEnemiesPerRoom` und das Wellensystem) und erzeugt fast zwangsläufig „Gegner, die nur Zeit kosten" (§8). Der Verwerter erreicht dasselbe Designziel (Zeit als Faktor) ohne Neubau. |
| **Der Störsender** — sperrt Bombe und Gadget in seiner Nähe | Ressourcenentzug | Es gibt bereits einen Raum-Modifikator `no_secondary`, der das als **angekündigte Raumeigenschaft** tut. Als Gegner wäre es eine unangekündigte Wegnahme mitten im Kampf. |
| **Frosthauch-Aura** — dauerhafte Verlangsamung im Radius | Positionsdruck | „Keine permanenten Verlangsamungen" (§8), wortwörtlich. |
| **Die Phalanx-Wache** — drei Gegner bewegen sich als starre Formation | Gruppenlesbarkeit | Braucht echte Formationsbewegung (neue Architektur, vgl. `stepPhalanxBoss`) und erzeugt keine Entscheidung, die `t_bulwark` nicht billiger erzeugt. |

### 19.2 Was überarbeitet wurde

| Gegner | Ursprünglicher Entwurf | Problem | Endfassung |
|---|---|---|---|
| `t_grabber` | Zug ohne Steuerung, keine Leine | Kontrollverlust ohne Gegenwehr | Steuerung senkrecht zur Leine bleibt; Leine mit **einem** Schuss trennbar; dritte Option „Zug annehmen" als Ventil |
| `t_mason` | baut überall | Einmauern möglich → Totalfrust | Flood-Fill-Prüfung, Mindestabstand 2 Zellen, Deckel 6 Wände, Zerfall nach 20 s |
| `t_anchor` | blockte zusätzlich Krit | Drei Regeln in einem Gegner | Krit-Sperre gestrichen; nur noch Flanke + Exekution (**eine** Regel, zwei Wirkungen) |
| `t_stalker` | dauerhaft unsichtbar | „Betrogen fühlen" (§10) | Regelbasiert: sichtbar unter 220 px, 0,6 s vor jedem Schuss, 2 s danach; Kettenspuren bleiben immer |
| `t_harvester` | heilte sich bei jedem Stapel | Mitten im Kampf untötbar | `healOnStack: false` — er wird zäher für die Zukunft, nicht im laufenden Treffer |
| `t_metronom` | verdoppelte den Schaden der Gruppe | Reine Zahlensteigerung | Schadensausstoß steigt nur ~15 %; der Effekt ist die **Bündelung**, also mehr Lesbarkeit gegen mehr Spitze |
| `t_medic` | heilte mehrere Ziele | Unklar, wer geheilt wird | Genau **ein** Ziel, sichtbarer Strahl |

### 19.3 Prüfung der 16 Endfassungen

Die 13 Prüffragen des Briefs, komprimiert auf die vier, bei denen Gegner
tatsächlich durchfallen können. „Nervpotenzial" ist die Frage
„zu nervig oder unfair?", „nach 20 Runs" die Frage nach Replayability.

| Gegner | Erzeugt echte Entscheidung? | Counterplay ohne Karten? | Nervpotenzial (1 = harmlos) | Nach 20 Runs noch interessant? | Ergebnis |
|---|---|---|---|---|---|
| `t_shotgun` | ja (Distanz) | ja (rückwärts laufen) | 2 | ja (Risiko/Belohnung bleibt) | **bestanden** |
| `t_lance` | ja (Timing) | ja (Deckung, Seitwärts) | 3 | ja | **bestanden** |
| `t_medic` | ja (Priorität) | ja (3 Treffer) | 3 | mittel — die Antwort ist nach 3 Runs Routine | **bestanden, mit Vorbehalt** |
| `t_rusher` | schwach (Ressourcen) | ja (2 Treffer) | 2 | nein, aber er ist Füllmaterial | **bestanden als Füllmaterial** |
| `t_anchor` | ja (Bewertung aller Entscheidungen) | ja (er steht still) | 4 | ja | **bestanden** |
| `t_relay` | ja (räumlich) | ja (2 Treffer) | 4 — kann sich beim ersten Mal unfair anfühlen | ja | **bestanden** (Telegraph entscheidet) |
| `t_mason` | ja (Ressourcen ↔ Raum) | ja (3 Treffer/Wand) | **6** — höchster Wert im Vorschlag | ja | **bestanden nur mit den Sicherungen aus 19.2** |
| `t_dud` | ja (Ort und Zeitpunkt) | ja (weglaufen) | 1 | ja (er bleibt Werkzeug) | **bestanden** |
| `t_marshal` | ja (Munition ↔ Position) | ja (beide Wege) | 2 | ja | **bestanden** |
| `t_bulwark` | ja (Positionierung) | ja (umlaufen) | 3 | mittel | **bestanden** |
| `t_stalker` | ja (Aufmerksamkeit) | ja (Spuren, Enttarnung) | 5 | ja | **bestanden** (nur regelbasiert) |
| `t_arclight` | ja (Ballung) | ja (auseinandergehen) | 3 | ja | **bestanden** |
| `t_tether` | ja (Rechnung) | ja (beide Wege) | 2 | ja | **bestanden** |
| `t_harvester` | ja (Zeithorizont) | ja (zuerst töten) | 3 | ja | **bestanden** |
| `t_metronom` | ja (töten oder behalten) | ja (drei Wege) | 2 | **sehr** — der Effekt ändert sich mit dem Können | **bestanden** |
| `t_grabber` | ja (Munition) | ja (drei Wege) | **5** | ja | **bestanden** (dritte Option ist Pflicht) |

### 19.4 Die drei Gegner mit dem größten Restrisiko

1. **`t_mason` (Nervpotenzial 6).** Wenn eine der vier Sicherungen
   (Flood-Fill, Mindestabstand, Wanddeckel, Zerfall) fehlt oder falsch
   parametriert ist, kippt er sofort von „interessant" zu „unfair". Er ist
   der einzige Gegner im Vorschlag, dessen Sicherheitsmechanik komplexer ist
   als seine Kernmechanik. **Empfehlung: zuletzt bauen, zuerst streichen,
   falls Zeit fehlt.**
2. **`t_grabber` (Nervpotenzial 5).** Erzwungene Bewegung ist die
   frustanfälligste Kategorie überhaupt. Er ist nur tragbar, weil er drei
   Auswege hat. Fällt einer davon im Bau weg, wird er zum Problemgegner.
3. **`t_medic` (Replayability mittel).** Seine Antwort ist nach wenigen Runs
   Routine. Er bleibt trotzdem im Vorschlag, weil er die **Lehrfunktion** für
   Tötungsreihenfolge hat — ein Gegner darf ein Lehrer sein und danach
   unauffällig werden.

### 19.5 Was der Vorschlag NICHT enthält (und das ist Absicht)

- Keinen Gegner ohne Schwäche.
- Keinen Gegner, dessen Effekt unsichtbar ist.
- Keine dauerhafte Kontrollwegnahme (längste Beeinträchtigung: 1,2 s Zug
  beim Greifer, mit sofortigem Ausweg).
- Keinen Unterstützer, der „alles verstärkt" — `t_marshal` verstärkt nur
  bei Sichtlinie, `t_medic` nur ein Ziel, `t_anchor` nur im Radius.
- Keine Synergie, die nur „+Schaden" ist. Die einzige reine Zahlensynergie
  (`t_marshal` + Rudel) ist ausdrücklich mit einem positionellen Konter
  versehen.

---

## 20. Finales Design-Audit

### 20.1 Bewertungstabelle (je 1–10)

| Gegner | Innovation | Schwierigkeit | Synergie | Counterplay | Nervpotenzial¹ | Replayability | Umsetzungsaufwand¹ |
|---|---|---|---|---|---|---|---|
| `t_shotgun` Streuer | 4 | 4 | 6 | 9 | 2 | 6 | 3 |
| `t_lance` Speerträger | 5 | 6 | 8 | 9 | 3 | 7 | 4 |
| `t_medic` Zehrer | 4 | 5 | 9 | 9 | 3 | 5 | 3 |
| `t_rusher` Rammler | 2 | 3 | 5 | 10 | 2 | 3 | 3 |
| `t_anchor` **Anker** | **9** | 7 | 9 | 8 | 4 | 8 | 3 |
| `t_relay` **Horcher** | **9** | 6 | **10** | 8 | 4 | 8 | 2 |
| `t_mason` **Maurer** | 8 | 6 | 7 | 7 | **6** | 8 | **7** |
| `t_dud` **Blindgänger** | 8 | 3 | 9 | **10** | **1** | 9 | **1** |
| `t_marshal` Feldwebel | 6 | 6 | 9 | 9 | 2 | 7 | 3 |
| `t_bulwark` Bollwerk | 4 | 6 | 8 | 8 | 3 | 5 | **1** |
| `t_stalker` Pirscher | 5 | 7 | 7 | 7 | 5 | 7 | 4 |
| `t_arclight` Lichtbogen | 6 | 6 | 7 | 8 | 3 | 8 | **1** |
| `t_tether` **Kettenhund** | **9** | 6 | 8 | 9 | 2 | 8 | 4 |
| `t_harvester` **Verwerter** | **9** | 7 | 8 | 8 | 3 | **9** | 3 |
| `t_metronom` **Taktgeber** | **10** | 8 | 9 | 9 | 2 | **10** | **7** |
| `t_grabber` **Greifer** | 7 | 7 | **10** | 7 | 5 | 7 | 4 |

¹ Bei **Nervpotenzial** und **Umsetzungsaufwand** ist **niedrig besser**.

### 20.2 Die sieben Auswertungsfragen

**Welche drei Designs sind am stärksten?**

1. **`t_metronom` (Der Taktgeber).** Der einzige Gegner im Vorschlag, bei
   dem „töten" nachweislich die schlechtere Option sein kann. Er erhöht
   Schwierigkeit und Lesbarkeit **gleichzeitig** — das ist die seltenste
   Eigenschaft in Gegnerdesign überhaupt. Sein Wert wächst mit dem Können
   des Spielers, also genau in die Richtung, in die Replayability zeigt.
2. **`t_anchor` (Der Anker).** Er greift nicht den Spieler an, sondern
   dessen Werkzeugkasten — und macht dadurch zwei Systeme (Flanke,
   Exekution) bewusst, die der Spieler sonst nie hinterfragt. Dabei kostet
   er drei Datenfelder und zwei Codezeilen.
3. **`t_dud` (Der Blindgänger).** Bestes Verhältnis von Wirkung zu Aufwand
   im gesamten Vorschlag: null neue Systeme, und trotzdem der einzige
   Gegner, über dessen Anwesenheit sich der Spieler **freut**. Er erzeugt
   die „das hätte ich anders machen können"-Momente, die der Brief in §9
   ausdrücklich als Ziel nennt.

**Welche drei Designs sind am riskantesten?**

1. **`t_mason`** — höchstes Frustpotenzial und höchster Aufwand
   (Laufzeit-Flood-Fill). Sein Nutzen hängt vollständig an vier korrekt
   parametrierten Sicherungen.
2. **`t_grabber`** — erzwungene Bewegung ist die frustanfälligste Kategorie.
   Nur durch drei Auswege tragbar; jeder verlorene Ausweg kippt ihn.
3. **`t_metronom`** — inhaltlich stark, technisch der einzige Gegner, der in
   die KI-Feuerentscheidung selbst eingreift (`roleTurret()` muss einen
   Rückhalt bekommen). Wenn das schiefgeht, feuert der halbe Raum gar nicht
   mehr.

**Welche drei Synergien sind am besten?**

1. **`t_relay` + `t_lance`** — der Horcher hebt exakt die Bedingung auf, die
   den Ladeschuss konterbar macht. Zwei Gegner, eine gemeinsame Regel, eine
   klar benennbare neue Aufgabe.
2. **`t_harvester` + `t_dud`** — das beste Werkzeug des Spielers wird zur
   Falle. Er muss eine gelernte Gewohnheit situativ unterdrücken, ohne sie
   zu verlieren.
3. **`t_anchor` + `t_medic`** — verwandelt Zielpriorität von einer Rangliste
   in eine Rechenaufgabe, ohne einen einzigen Wert zu erhöhen.

**Welche drei Gegner verändern das Spielgefühl am stärksten?**

1. **`t_anchor`** — verändert die Bewertung *jeder* anderen Entscheidung im
   Raum, weil Flanke und Exekution die beiden Grundpfeiler des Kampfsystems
   seit dem Grundsteinumbau sind.
2. **`t_metronom`** — verwandelt ein Dauerfeuergefecht in ein Rhythmusspiel.
   Derselbe Raum spielt sich mit und ohne ihn völlig anders an.
3. **`t_harvester`** — führt zum ersten Mal einen **Zeithorizont** ein.
   Bisher war jede Entscheidung im Spiel rein momentan.

**Welchen Gegner könnte man am ehesten streichen?**

**`t_rusher` (Der Rammler).** Er ist der einzige Gegner mit
Innovationswert 2 und Replayability 3. Sein Zweck ist rein ökonomisch:
Akt 2 kauft zwangsläufig billige Gegner, und heute sind das die in Akt 2
bedeutungslosen `t_brown`/`t_grey`. **Wird jedoch die Mindestpunktzahl aus
17.3 eingeführt** (Gegner unter `budget/12` werden nicht gekauft), löst sich
dieses Problem systemisch — und der Rammler wird entbehrlich. Er ist damit
ausdrücklich der Streichkandidat Nummer 1.

Zweitkandidat: **`t_medic`**, aber nur, wenn die Prioritätslektion
anderweitig vermittelt wird (z. B. durch `t_anchor` allein). Er hat den
klarsten Lehrwert des Vorschlags.

**Welche zwei könnten später als Bossgrundlage dienen?**

1. **`t_metronom` → „Der Dirigent".** Ein Boss, der nicht selbst kämpft,
   sondern den ganzen Raum taktet und in Phasen den Takt **verändert**
   (langsam → schnell → unregelmäßig). Der Kampf wäre ein reines
   Rhythmusduell, in dem der Spieler zwischen Anpassung und Unterbrechung
   wählt. Technisch baut das auf demselben Feuerrückhalt auf, den der
   Taktgeber ohnehin braucht, und passt zur bestehenden Bossarchitektur
   (eigenes Modul, eigener Zustandsautomat — wie `spider.js`/`anvil.js`).
2. **`t_harvester` → „Der Schlund".** Ein Boss, der mit jeder getöteten
   Begleitung sichtbar wächst und dessen Phasen an Stapelschwellen hängen.
   Der Spieler entscheidet, ob er die Begleiter überhaupt tötet — die
   Bossvariante von „töte ich diesen Gegner?", spiegelbildlich zum
   Taktgeber. Der Zorn-Mechanismus des Amboss (`anvil.js`) ist die fertige
   technische Vorlage für einen bossweiten, spielergetriebenen Zähler.

**Welche Systeme sollte das Projekt generell bekommen?**

In Reihenfolge des Nutzens:

1. **Kompositionsregeln in `buyEnemies()`** (Abschnitt 17.3). Ohne sie ist
   dieses Dokument ab Abschnitt 11 nicht umsetzbar. Vier Teile, davon zwei
   trivial: `maxPerRoom` belegen (existiert bereits), Mindestpunktzahl,
   Rollenquote, `data/compositions.json` mit Rückfall auf die heutige
   Zufallsschleife.
2. **Generische Aura-Markierung** (`tank.auraFlags`, Baustein A). Bedient
   `t_anchor`, `t_marshal`, `t_harvester` und jeden künftigen
   Gruppeneffekt. Das Muster existiert wörtlich als `t.necroAuraWeakened`.
3. **Gemeinsamer Verbindungslinien-Renderer** (Baustein B). Fünf der 16
   Gegner brauchen exakt dieselbe Darstellung: Linie zwischen zwei
   Entitäten, die bei Sichtlinien- oder Distanzbruch reißt. Einmal bauen,
   fünfmal nutzen — und es ist zugleich die Grundlage für die vom Brief
   geforderte Lesbarkeit.
4. **Feuerfreigabe-Zwischenschritt in der KI** (`roleTurret()` gibt einen
   *Wunsch* zurück, eine Instanz entscheidet über die Freigabe). Bedient
   `t_metronom` und eröffnet die ganze Kategorie „koordiniertes Feuern".
5. **Verallgemeinerter Mehrfachschuss** (Baustein D). `twinShot` ist schon
   da; auf N Kugeln mit Streuwinkel und eigener Reichweite zu heben, kostet
   wenig und öffnet eine ganze Waffenklasse.

**Nicht empfohlen:** ein Beschwörungssystem, echte Formationsbewegung für
Normalgegner und ein Teamsystem in der Trefferschleife. Alle drei sind
Architekturänderungen, deren Nutzen kleiner ist als ihr Risiko — und die
Abwesenheit des Teamsystems ist inzwischen ein **Designwerkzeug** (siehe
`t_dud`, `t_bulwark`, `t_harvester`), kein Mangel.

---

## Zusammenfassung in drei Sätzen

Akt 2 bekommt acht Gegner, von denen vier eine bestehende Spielerregel
(Flanke, Deckung, Raumgeometrie, Kill-Zeitpunkt) situativ außer Kraft
setzen — der Spieler lernt dadurch, dass seine Werkzeuge Bedingungen haben.
Akt 3 bekommt acht Gegner, deren Gefahr überwiegend aus der Aufstellung
kommt, in der sie stehen, nicht aus ihren Werten; alle 16 bleiben im
bestehenden 2–5-Treffer-Band und brauchen keine neue Architektur.
Der wichtigste Vorschlag dieses Dokuments ist trotzdem kein Gegner, sondern
**Kompositionsregeln für `buyEnemies()`** — ohne sie bleibt jede noch so
gute Aufstellung ein Zufallsfund.
