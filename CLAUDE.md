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
39 Upgrades, 6 Raumtypen, Schrott-Währung, sichtbare Roguelike-Karte statt
unsichtbarer Raumtyp-Automatik. Maßgeblich ist **`PLAN.md` v2**
(ersetzt v1 vollständig). Erledigt: **Phase 0** (Eingabe/Ziellinie/RNG/Arena-
Weiche) und **Phase 1** (Telemetrie v2, Lesbarkeit, Run-Speicherung).
v2-**Phase 2** (Upgrade-Schema) und **Phase 3** (Schrott) sind inhaltlich schon
durch die gleichnamigen v1-Phasen abgedeckt (Abweichungen auf Nutzerwunsch:
`emergency_shield` gibt 1 statt 3 Ladungen je Stufe, Elite-Schrott ist
`eliteMult: 2` statt `eliteBonus: 3`). **Phase 4** (gerichtete Panzerung),
**Phase 5** (Abprallen belohnen: Trickshot, Spiegelwände, Powershot),
**Phase 6** (Sekundärslot: Mine wird zu einer von sechs austauschbaren
Sekundärwaffen), **Phase 7** (Geisterpanzer: getötete Gegner kämpfen kurz
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
**Phase 7b — Audio ist weiterhin NICHT gebaut** (in `PLAN.md` ohne ✅,
zwischen Phase 7 und 8 einsortiert — die Phasen wurden bislang in der
Reihenfolge 0…7, 8…18 gebaut und diese eine ausgelassen). Bekannter,
noch offener Fehler daraus: `killTank()` in `src/game/state.js` spielt für
JEDEN Tod denselben `'death'`-Sound — ein Gegner-Kill klingt identisch zum
eigenen Tod.
**Nächste Phase: Phase 7b — Audio (nachholen!), danach Phase 18, Welle 3**
— so seit dem Code-Review-Pass 2 auch in `PLAN.md` festgeschrieben.
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

### Offene Punkte / To-do (nice-to-have, nicht dringend)
- [ ] **Vor Phase 18**: 15–20 Runs spielen und die Debug-Ansicht (`?debug=1`)
      auswerten — sie rechnet jetzt selbst (Median-Todesraum, Abpraller-Anteil,
      minFps, nie gewählte + meistabgelehnte Karten). Siehe `PLAN.md`.
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
  `transformations.json`, `secondaries.json`, `modifiers.json`).
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
  `reflectBullet`, `hasWallBounced`, `isLive`.
- `src/game/tank.js` — Feuern, Minen legen/werfen, `useSecondary()`
  (Phase 6: generischer Sekundärwaffen-Dispatch inkl. Enterhaken/Sperrmauer).
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
- `src/core/telemetry.js` — Run-Telemetrie in `localStorage.runs` +
  Debug-Ansicht (nur `?debug=1`). Reine Beobachtung, keine Spiellogik.
- `sw.js` — Service Worker (Offline-fähig). **Strategie: network-first für
  Code+Daten (HTML/JS/JSON), cache-first für Bilder/Fonts.** Cache-Version
  bumpen + `data/*`/`src/*` in `ASSETS` eintragen! (Aktuell `v56`; dabei
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
```
Playwright-Browser liegt unter `/opt/pw-browsers/chromium`
(`executablePath` setzen; NICHT `playwright install`).
Regressions-Standard: `tests/regression.mjs` muss grün sein — 5 Seeds über
16 Räume deterministisch bis zum Sieg, Ziellinien-Trace crashfrei,
Wellen-Freigabe-Guard, Determinismus-Probe.
