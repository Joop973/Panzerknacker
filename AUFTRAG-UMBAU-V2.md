# AUFTRAG-UMBAU-V2.md — Makel, Dungeon, Kulissen

Dieser Auftrag setzt drei Entscheidungen um, die nach `MACHTKURVE.md`
getroffen wurden. Er greift in `AUFTRAG-FERTIGSTELLUNG.md` ein und
verändert dort Stufe A und Stufe E.

**Maßgeblich bei Widersprüchen:** dieses Dokument.

---

## 0. Was sich gegenüber den bisherigen Dokumenten ändert

| Dokument | Was jetzt anders gilt |
|---|---|
| `AUFTRAG-FERTIGSTELLUNG.md` Stufe A | Jede Karte trägt einen Makel. Die 14 Kartenwellen brauchen ein erweitertes Schema und einen Makel-Pass. |
| `AUFTRAG-FERTIGSTELLUNG.md` A0 | Zusätzlich muss geprüft werden, welche `core`-Schlüssel negative Werte vertragen. |
| `AUFTRAG-FERTIGSTELLUNG.md` E1 | Der Grafikbedarf steigt erheblich: drei Kulissen statt einer. |
| `MACHTKURVE.md` Abschnitt 4 | Das Kartenbudget wird zweigeteilt: Bruttowert und Makelkosten. Der Nettowert bleibt bei ×13. |
| Sockelplätze | Verworfen. Ersetzt durch das Makel-System. |
| Knotenkarte | Wird durch Dungeons ersetzt, nicht ergänzt. |

---

## 1. Entscheidungen

| # | Entscheidung |
|---|---|
| 1 | **Jede Karte oberhalb von common trägt einen Makel.** Auch die 115 bestehenden Nekromanten-Karten. |
| 2 | Makel sind **umwandelbar** über vier Wege: Werkstatt, Umpolungs-Keystones, Härtung, Narben-Skalierung. |
| 3 | Die Knotenkarte wird durch **erkundbare Dungeons** ersetzt. |
| 4 | **Erkundung ist dunkel, die Kampfarena ist hell.** Begründung in Abschnitt 2.1 — das ist keine Stilfrage, sondern Schutz der Kernmechanik. |
| 5 | Drei Akte, drei Kulissen, **alle im Spielzeuguniversum**: Kinderzimmer, Dachboden, Sandkasten. |
| 6 | Grafiken werden KI-generiert, mit fester Palette und Nachbearbeitung. |

---

# TEIL 1 — Das Makel-System

## 1.1 Der Grundgedanke

Jede Karte oberhalb von common gibt mehr, als sie unter dem alten System
gegeben hätte, und nimmt dafür etwas auf einer **anderen Achse**.

Die zentrale Regel: **Der Makel trifft nie dieselbe Achse wie der
Vorteil.** „+25 % Schaden, −8 % Schaden" ist kein Handel, sondern eine
kleinere Zahl. „+25 % Schaden, −15 % Tempo" zwingt dich, anders zu
fahren.

Common-Karten bleiben makellos. Sonst wird jede einzelne Wahl zur
Rechenaufgabe und der Spielfluss stirbt.

## 1.2 Das Makel-Vokabular

Acht Makel, mehr nicht. Ein geschlossenes Vokabular ist Voraussetzung
dafür, dass die Umpolungs-Keystones überhaupt funktionieren können.

| Makel | Wirkung | `core`-Schlüssel | Status |
|---|---|---|---|
| **Schwerfällig** | Fahrtempo sinkt | `speedMult` < 1 | vorhanden |
| **Blechhaut** | Maximale Lebenspunkte sinken | `hpAdd` negativ | vorhanden |
| **Klemmender Lader** | Feuerabklingzeit steigt | `reloadMult` > 1 | vorhanden |
| **Enges Magazin** | Ein Geschossplatz weniger | `magAdd` negativ | vorhanden |
| **Kurzer Lauf** | Geschosstempo und Reichweite sinken | `bulletSpeedMult` < 1 | vorhanden |
| **Teuer** | Weniger Schrott pro Raum | `scrapAdd` negativ | vorhanden |
| **Dünne Platte** | Schadensresistenz sinkt | `resistAdd` negativ | vorhanden |
| **Heißer Lauf** | Eigene Explosionen und Minen treffen dich früher | neuer Schlüssel `selfImmunityMult` | **neu** |

Sieben von acht funktionieren mit bestehenden Schlüsseln. Nur
„Heißer Lauf" braucht Engine-Arbeit — er greift auf
`balance.bullet.selfImmunity` (aktuell 0.35 Sekunden).

**Achtung:** Nur `maxHp` ist im Code gegen negative Werte abgesichert
(`cfg.js:1140`). Tempo, Magazin und Feuerabklingzeit sind es nicht. Ohne
Untergrenzen erzeugt ein Makelstapel ein Magazin von null oder eine
negative Abklingzeit — das ist ein Absturz, kein Balanceproblem. Phase M1
baut diese Untergrenzen.

## 1.3 Welche Karte trägt welchen Makel

| Seltenheit | Bruttovorteil | Makel |
|---|---|---|
| common | +3 bis 5 % | keiner |
| uncommon | +9 bis 11 % | ein leichter Makel |
| rare | +14 bis 18 % | ein mittlerer Makel |
| epic | +22 bis 28 % | ein schwerer Makel oder zwei leichte |
| legendary | regelbrechend | schwerer Makel, teils zwei |

Leicht bedeutet rund 5 %, mittel rund 10 %, schwer rund 18 % auf der
betroffenen Achse.

Der Nettowert bleibt damit auf der Zielkurve aus `MACHTKURVE.md`
Abschnitt 3.1, also ×13 zum Runende. Die Bruttozahlen steigen um rund
ein Drittel. Das ist Absicht: Größere Zahlen auf den Karten fühlen sich
besser an, und der Makel macht die Entscheidung erst zu einer.

## 1.4 Die vier Auswege

Das Makel-System ist nur dann gut, wenn Makel **Material** sind und nicht
nur Strafe. Vier Wege, sie in Stärke zu verwandeln.

### Weg 1 — Die Werkstatt

Am Rastplatz und im Shop lässt sich gegen Schrott genau **ein** Makel
dauerhaft entfernen. Der Preis steigt mit jeder Entfernung im selben Run.

Das ist die einfachste Umwandlung und erzeugt sofort einen Wettbewerb um
Schrott, der heute fehlt: Karte kaufen oder Makel entfernen?

### Weg 2 — Umpolung (die Keystone-Karten)

Acht legendäre Karten, eine je Makel:

> **Umpolung: Fahrwerk** — Alle deine Makel der Art „Schwerfällig"
> wirken umgekehrt. Du kannst diese Karte nicht entfernen.

Das ist die Mechanik, die du im Sinn hattest. Sie ist aus Path of Exile
bekannt: Ein Keystone dreht eine ganze Regelkategorie um und definiert
dadurch einen Build. Ab dem Moment, in dem du „Umpolung: Fahrwerk" hast,
suchst du gezielt nach Karten mit genau diesem Makel — der Rest des Runs
bekommt eine Richtung.

Deshalb ist das geschlossene Achter-Vokabular Pflicht. Bei zwanzig
verschiedenen Makeln fände eine Umpolung nie genug Futter.

### Weg 3 — Härtung

Bei manchen Karten läuft der Makel nach einer festen Zahl geräumter Räume
aus und der Vorteil bleibt.

> **Notschweißung** — +30 % Schaden. „Blechhaut" für die nächsten drei
> Räume, danach verschwindet sie.

Das ist das Chaos-Modell aus Hades: kurzer Schmerz, dauerhafter Gewinn.
Es erzeugt Spannungsbögen innerhalb eines Runs statt nur einer
Gesamtbilanz. Gut geeignet für epic-Karten.

### Weg 4 — Narben

Eine Kartenfamilie, die pro **aktivem** Makel skaliert.

> **Narbengewebe** — +4 % Schaden je aktivem Makel.

Damit wird das Aufräumen über die Werkstatt zu einer echten
Entscheidung statt zu einer Selbstverständlichkeit. Wer Narben spielt,
sammelt Makel absichtlich.

**Wichtig fürs Balancing:** Ein Run, der alle Makel wegkauft, muss
schwächer sein als einer, der mit ihnen arbeitet. Sonst ist die Werkstatt
kein Weg, sondern der einzig richtige Zug.

## 1.5 Phasen

### Phase M1 — Engine: Makel tragfähig machen [ENGINE]

```
Phase M1 aus AUFTRAG-UMBAU-V2.md. Lies vorher CLAUDE.md, MACHTKURVE.md
und src/game/cfg.js: applyUpgrades().

Ziel: Negative core-Werte sind heute nicht abgesichert. Nur maxHp hat
eine Untergrenze (cfg.js:1140). Bevor eine einzige Makel-Karte
existiert, muss die Engine sie aushalten.

Aufgaben:
1. Prüfe für JEDEN core-Schlüssel aus der A0-Tabelle, was bei negativen
   oder unter 1 liegenden Werten passiert. Nenne mir pro Schlüssel das
   Ergebnis: harmlos, kaputte Physik, oder Absturz.
2. STOPP und warte auf meine Freigabe der Liste.
3. Danach: Untergrenzen für alle gefährdeten Kennwerte, vollständig in
   data/balance.json unter einem neuen Block "floors", nichts hardcoden.
   Startvorschläge, die du mir zur Prüfung vorlegst:
   Tempo mindestens 40 % des Basiswerts, Magazin mindestens 2,
   Feuerabklingzeit höchstens 200 % des Basiswerts, maximale
   Lebenspunkte mindestens 30, Resistenz mindestens −50 %.
4. Neuer core-Schlüssel selfImmunityMult, der balance.bullet
   .selfImmunity multipliziert (Makel "Heißer Lauf").
5. Die Untergrenzen greifen NACH allen Karten, nicht pro Karte.

Neue Tests: ein Panzer mit zehn gestapelten Makel-Karten bleibt
spielbar, alle Kennwerte über ihren Untergrenzen, kein NaN, kein
Absturz. Pflicht-Gegenprobe.

Danach: Suite grün, CLAUDE.md aktualisieren, sw.js bumpen, PR mergen.
```

### Phase M2 — Datenschema und Anzeige [ENGINE]

```
Phase M2 aus AUFTRAG-UMBAU-V2.md. Lies vorher CLAUDE.md und
AUFTRAG-UMBAU-V2.md Teil 1.

Ziel: Karten können Makel tragen, und der Spieler sieht sie sofort.

Aufgaben:
1. Erweitere das Kartenschema um ein Feld `makel`, das den Makel-Typ aus
   dem Achter-Vokabular und seine Schwere trägt. Schlage mir das genaue
   Format vor und warte auf Freigabe, bevor du es umsetzt.
2. Das Makel-Vokabular kommt in eine neue Datei data/makel.json:
   id, Name, betroffener core-Schlüssel, die drei Schweregrade als
   Zahlenwerte, Symbol. NICHT im Code.
3. Der Upgrade-Bildschirm zeigt den Vorteil in der bestehenden Farbe,
   den Makel darunter deutlich abgesetzt in einer Warnfarbe mit eigenem
   Symbol. Auf dem Handy muss beides ohne Antippen lesbar sein.
4. Eine Übersicht der aktiven Makel im Pausemenü, mit Herkunftskarte.
5. Der bestehende Kartentext-Test muss auch die Makel-Zahlen gegen die
   Beschreibung prüfen.

Pflicht-Gegenprobe für jeden neuen Test.

Danach: Suite grün, CLAUDE.md aktualisieren, sw.js bumpen, PR mergen.
```

### Phase M3 — Werkstatt [ENGINE]

```
Phase M3 aus AUFTRAG-UMBAU-V2.md. Lies vorher CLAUDE.md und
src/game/run.js: workbenchOptions().

Ziel: Makel gegen Schrott entfernen.

Aufgaben:
1. Neue Option am Rastplatz und im Shop: einen aktiven Makel dauerhaft
   entfernen. Der Spieler wählt, welchen.
2. Preis in data/balance.json unter scrap.cost.makel. Der Preis steigt
   mit jeder Entfernung im selben Run — Formel ebenfalls ins JSON.
3. Makel aus Karten mit dem Merkmal "nicht entfernbar" (Umpolungs-
   Keystones) erscheinen nicht in der Liste.
4. Ein entfernter Makel bleibt entfernt, auch wenn dieselbe Karte später
   eine Stufe aufsteigt.

Tests: Preis steigt korrekt, Kennwerte kehren nach der Entfernung exakt
auf den erwarteten Wert zurück, nicht entfernbare Makel tauchen nicht
auf. Pflicht-Gegenprobe.

Danach: Suite grün, CLAUDE.md aktualisieren, sw.js bumpen, PR mergen.
```

### Phase M4 — Umpolung, Härtung, Narben [ENGINE]

```
Phase M4 aus AUFTRAG-UMBAU-V2.md. Lies vorher CLAUDE.md und
AUFTRAG-UMBAU-V2.md Abschnitt 1.4.

Ziel: Die drei Mechaniken, die Makel in Stärke verwandeln.

Aufgaben:
1. UMPOLUNG: ein Kartenmerkmal, das alle Makel einer Art im Vorzeichen
   dreht. Acht legendäre Karten, eine je Makel, in den Kernpool. Sie
   sind isUnique und nicht entfernbar.
2. HÄRTUNG: ein Kartenmerkmal, das den Makel nach N geräumten Räumen
   verfallen lässt. N steht auf der Karte. Der Spieler sieht die
   Restzahl in der Makel-Übersicht.
3. NARBEN: ein core-Schlüssel, der je AKTIVEM Makel skaliert. Aktiv
   heißt: nicht entfernt, nicht verfallen, nicht umgepolt.
4. Die Reihenfolge der Auswertung muss eindeutig sein: erst Umpolung,
   dann Verfall, dann Narbenzählung. Schreib sie als Kommentar an die
   Auswertungsstelle.

Das ist die fehleranfälligste Phase des ganzen Auftrags. Baue für jede
Kombination aus je zwei der drei Mechaniken einen eigenen Test.
Pflicht-Gegenprobe für jeden.

Danach: Suite grün, CLAUDE.md aktualisieren, sw.js bumpen, PR mergen.
```

### Phase M5 — Makel-Pass über den Nekromanten [DATEN]

115 Karten. Das ist mengenmäßig wie zwei neue Pools und wird in vier
Sessions gemacht, nicht in einer.

```
Phase M5<a-d> aus AUFTRAG-UMBAU-V2.md. Lies vorher CLAUDE.md,
data/makel.json und AUFTRAG-UMBAU-V2.md Abschnitt 1.3.

Reine DATENPHASE. Kein Code.

Ziel: Der bestehende Nekromanten-Pool bekommt Makel, damit er sich nicht
anders anfühlt als die vier anderen Klassen.

Diese Session bearbeitet AUSSCHLIESSLICH die Karten der Seltenheit
<uncommon>. Die anderen Stufen sind eigene Sessions.

Regeln:
- common bleibt makellos.
- Der Makel trifft nie dieselbe Achse wie der Vorteil. Bei Geister-
  Karten (ghost*) gilt die Geisterachse als eigene Achse — ein Makel
  darf also den Spieler treffen, während der Vorteil die Geister stärkt.
- Der Bruttovorteil wird gemäß Abschnitt 1.3 angehoben, damit der
  Nettowert gleich bleibt. Rechne mir die Anhebung pro Karte vor.
- Höchstens zwei Karten je Seltenheitsstufe dürfen denselben Makel
  tragen, sonst wird die Umpolung einer Art zu stark.

Zeige mir alle Karten dieser Stufe als Tabelle: Name, alter Wert, neuer
Bruttowert, Makel, Schwere, Nettoveränderung. Warte auf Freigabe.

Danach schreiben, Suite grün, CLAUDE.md aktualisieren, PR mergen.
```

### Phase M6 — Makel in die 14 Kartenwellen einarbeiten

Keine eigene Session. Der Vorlage-Prompt in
`AUFTRAG-FERTIGSTELLUNG.md` bekommt drei zusätzliche Zeilen:

```
- Jede Karte oberhalb von common trägt genau einen Makel aus
  data/makel.json. Der Makel trifft NIE dieselbe Achse wie der Vorteil.
- Bruttowerte nach AUFTRAG-UMBAU-V2.md Abschnitt 1.3, nicht nach
  MACHTKURVE.md Abschnitt 4.
- Nenne mir pro Karte Bruttowert, Makelkosten und Nettowert.
```

---

# TEIL 2 — Der Dungeon-Umbau

## 2.1 Der Konflikt, den du kennen musst

**Das hier ist das größte Risiko im ganzen Projekt. Lies es, bevor du
Phase D1 startest.**

Deine Kernmechanik ist der Bandenschuss: Du zielst auf eine Wand, um
etwas zu treffen, das hinter einer Ecke steht. Das ist der Grund, warum
dein Spiel nicht wie jeder andere Top-Down-Shooter ist, und es ist die
Grundlage deiner gesamten Positionierung.

Bandenschüsse setzen voraus, dass du **die Wände siehst, von denen du
abprallen willst**. Ein Diablo-artiger Sichtkegel, der nur den
erkundeten Bereich zeigt, nimmt dir genau diese Information. Du kannst
nicht auf eine Wand zielen, die nicht gezeichnet ist. Dazu kommt, dass
Gegner aus dem Dunkeln auf dich schießen — bei 25 Schaden pro Treffer
und vier Treffern bis zum Tod ist das keine Spannung, sondern Willkür.

Zusätzlich technisch: **Es gibt heute keine Kamera.** Der Renderer
zeichnet ein festes Gitter von 24 mal 16 Zellen vollständig. Kamera,
Scrolling, Culling, Minimap und Sichtbarkeitsberechnung sind komplett
neu.

## 2.2 Die Lösung

Trenne Erkundung und Kampf.

- **Gänge und unbetretene Räume sind dunkel.** Hier bekommst du dein
  Diablo-Gefühl: Du fährst durch enge Verbindungen, siehst nur, was in
  Reichweite ist, und weißt nicht, was hinter der nächsten Ecke wartet.
- **Betrittst du einen Kampfraum, schließen sich die Türen und der Raum
  wird vollständig sichtbar.** Die Kamera fährt so weit heraus, dass
  die ganze Arena ins Bild passt. Ab hier ist es dein bisheriges Spiel,
  mit allen Wänden und allen Winkeln.
- Nach dem Räumen öffnen sich die Türen wieder, die Kamera fährt heran,
  und die Erkundung geht weiter.

Das ist das Modell von Binding of Isaac und Enter the Gungeon. Du
bekommst die Erkundung, ohne den Bandenschuss zu beschädigen — und der
Moment, in dem die Türen zuschlagen und der Raum aufgeht, ist ein
eigener dramatischer Beat, den die Knotenkarte nie hatte.

## 2.3 Aufbau eines Dungeons

Ein Akt besteht weiterhin aus 16 Räumen. Sie liegen jetzt als
verbundenes Gitter statt als Knotengraph.

- Startraum, 14 Räume, Bossraum.
- Jeder Raum hat ein bis vier Türen.
- Der Weg zum Boss ist nie der einzige Weg. Es muss Abzweige mit Rast,
  Shop und Schatz geben, die man bewusst ansteuert oder auslässt.
- Eine Minimap zeigt betretene und angrenzende Räume. Unbetretene Räume
  zeigen ihr Symbol, sobald man an einer ihrer Türen steht.

## 2.4 Was die Türen zeigen

**Nicht verhandelbar.** Die Knotenkarte ist heute die einzige Ebene, auf
der du ohne Reflexe entscheidest. Wenn Türen nicht anzeigen, was
dahinter liegt, löschst du diese Ebene ersatzlos und dein Spiel wird
reiner Reflex.

Jede Tür trägt das Symbol ihres Raumtyps: Kampf, Elite, Rast, Werkstatt,
Schatz, Ereignis, Verflucht, Boss. Elite-Türen zeigen zusätzlich an,
dass es dort bessere Beute gibt.

## 2.5 Phasen

### Phase D1 — Machbarkeitsprüfung [ENGINE]

```
Phase D1 aus AUFTRAG-UMBAU-V2.md. Lies vorher CLAUDE.md,
src/render/renderer.js und AUFTRAG-UMBAU-V2.md Teil 2.

Kein Produktivcode. Reine Prüfung, danach Stopp.

Ziel: Bevor der Dungeon-Umbau beginnt, muss klar sein, was er kostet.

Aufgaben:
1. Der Renderer zeichnet heute ein festes Arenagitter vollständig und
   kennt keine Kamera. Beschreibe mir genau, was für eine Kamera mit
   Scrolling und Zoom umgebaut werden müsste: welche Funktionen, welche
   Koordinatenumrechnungen, wo überall Bildschirmkoordinaten mit
   Weltkoordinaten verwechselt würden.
2. Prüfe dasselbe für die Eingabe: Touch-Zielen, Zwillingsstick,
   Mauszielen. Welche Stellen rechnen heute direkt in
   Bildschirmkoordinaten?
3. Prüfe die Gegner-KI: Sie nutzt Sichtlinien per Raycast mit
   raycastMaxPx 900. Was passiert bei einem Raum, der größer als der
   Bildschirm ist?
4. Prüfe den Determinismus: Welche Systeme würden von einem größeren,
   teilweise unsichtbaren Raum betroffen sein?
5. Schätze den Aufwand in Sessions für: Kamera, Türsystem, Minimap,
   Dungeon-Erzeugung, Sichtbarkeit in Gängen, Umbau der Arenadaten.

Sei ehrlich. Wenn du zu dem Schluss kommst, dass das mehr als fünfzehn
Sessions sind, sag es deutlich.

Danach zusammenfassen und stoppen.
```

### Phase D2 — Kamera [ENGINE]

```
Phase D2 aus AUFTRAG-UMBAU-V2.md. Lies vorher CLAUDE.md und das
Ergebnis von D1.

Ziel: Eine Kamera, ohne dass sich am Spiel etwas ändert.

Aufgaben:
1. Führe eine Kamera mit Position und Zoom ein. In diesem Schritt steht
   sie IMMER so, dass die komplette Arena ins Bild passt — also exakt
   das heutige Bild.
2. Alle Bildschirm-zu-Welt-Umrechnungen an EINER Stelle bündeln.
3. Danach muss das Spiel bis auf die Pixelgenauigkeit aussehen und sich
   anfühlen wie vorher, inklusive Zielen per Touch und Maus.
4. Die Regressionssuite muss exakt dieselben Zahlen liefern.

Das ist ein reines Refactoring. Kein Verhalten darf sich ändern.
Notiere vorher die Suite-Ausgabe als Vergleichswert.

Danach: Suite grün, CLAUDE.md aktualisieren, sw.js bumpen, PR mergen.
```

### Phase D3 — Türen und Raumsperre [ENGINE]

```
Phase D3 aus AUFTRAG-UMBAU-V2.md.

Ziel: Räume bekommen Türen, die sich im Kampf schließen.

Aufgaben:
1. Neuer Zellentyp "Tür" im Arenagitter, mit Zustand offen/geschlossen
   und einem Raumtyp-Symbol.
2. Beim Betreten eines Kampfraums schließen sich alle Türen, die Kamera
   fährt auf volle Arenasicht. Nach dem Räumen öffnen sie sich wieder.
3. Türsymbole für alle acht Raumtypen. Sie müssen auf dem Handy aus
   Entfernung erkennbar sein.
4. Durchfahren einer offenen Tür wechselt den Raum.
5. Geschlossene Türen blocken auch Geschosse.

Baue das zunächst OHNE Dungeon-Erzeugung: zwei fest verdrahtete
Testräume, zwischen denen man hin- und herfahren kann.

Tests: Türen blocken korrekt, Kamera-Wechsel funktioniert, kein Gegner
oder Geschoss verlässt den gesperrten Raum. Pflicht-Gegenprobe.
```

### Phase D4 — Dungeon-Erzeugung [ENGINE]

```
Phase D4 aus AUFTRAG-UMBAU-V2.md. Lies vorher src/game/run.js:
generateMap() — das ist der Code, den du ersetzt.

Ziel: Ein Akt erzeugt ein verbundenes Raumgitter statt eines
Knotengraphen.

Aufgaben:
1. Erzeugung aus dem bestehenden Seed-Strom run.rng.map. Die Anzahl der
   rng-Aufrufe darf sich ändern, aber die Erzeugung muss für denselben
   Seed reproduzierbar sein.
2. 16 Räume pro Akt: Start, 14 Räume, Boss. Raumtypen nach den
   bestehenden nodeWeights aus data/difficulty.json.
3. Garantien, die der Generator einhalten MUSS und die als Test
   abgesichert werden:
   - Jeder Raum ist vom Start aus erreichbar.
   - Der Bossraum liegt am Ende des längsten Pfades.
   - Mindestens ein Rastplatz und ein Shop existieren.
   - Es gibt mindestens eine echte Abzweigung, also einen Raum, den man
     auslassen kann.
4. Die Minimap zeigt betretene Räume, angrenzende Räume als Umriss mit
   Symbol.
5. Der alte Kartenbildschirm entfällt.

Tests: über 200 Seeds werden alle Garantien aus Punkt 3 eingehalten.
Pflicht-Gegenprobe.
```

### Phase D5 — Sichtbarkeit in Gängen [ENGINE]

```
Phase D5 aus AUFTRAG-UMBAU-V2.md. Lies vorher AUFTRAG-UMBAU-V2.md
Abschnitt 2.1 — besonders den Teil über den Bandenschuss.

Ziel: Erkundung ist dunkel, Kampfarenen sind hell.

HARTE REGEL: In einem Kampfraum ist IMMER die komplette Arena sichtbar.
Die Verdunkelung gilt ausschließlich für Gänge und noch nicht betretene
Räume. Wenn du an irgendeiner Stelle versucht bist, Sichtbarkeit in
einen aktiven Kampf hineinzuziehen, halte an und frag mich.

Aufgaben:
1. Ein Sichtradius um den Spieler in Gängen.
2. Bereits erkundete Bereiche bleiben gedämpft sichtbar.
3. Beim Betreten eines Kampfraums wird der ganze Raum voll sichtbar.
4. Die Verdunkelung ist ein reiner Rendereffekt und darf die Simulation
   nicht berühren. Gegner-KI und Physik arbeiten unverändert weiter.
5. Abschaltbar über die bestehende Barrierefreiheitsoption.

Tests: In einem aktiven Kampfraum ist kein Arenateil verdunkelt.
Die Verdunkelung verändert keinen Simulationswert. Pflicht-Gegenprobe.
```

### Phase D6 — Abnahme [ENGINE]

```
Phase D6 aus AUFTRAG-UMBAU-V2.md, Abnahme des Dungeon-Umbaus.

1. Bot spielt 100 Runs. Berichte: Siegquote, Runzeit, wie viele Räume
   pro Akt tatsächlich betreten werden, wie viele ausgelassen.
2. Vergleiche die Runzeit mit dem Wert vor dem Umbau. Wenn die
   Erkundung mehr als 20 Prozent Zeit hinzufügt, sag es.
3. Miss die Bildrate im größten Raum mit acht Gegnern.
4. Prüfe, ob der Bandenschuss-Anteil an den Kills gegenüber dem Wert
   vor dem Umbau gefallen ist. Das ist der Indikator dafür, ob die
   Kernmechanik gelitten hat.

Keine Änderungen. Nur Zahlen und eine ehrliche Bewertung.
```

---

# TEIL 3 — Kulissen und Assets

## 3.1 Die drei Akte

| Akt | Ort | Boden | Wände | Ton |
|---|---|---|---|---|
| 1 | Kinderzimmer | Teppich, Parkett | Bauklötze, Bücher | Noch spielerisch |
| 2 | Dachboden | Dielen, Staub | Umzugskartons, alte Koffer | Aussortiert, vergessen |
| 3 | Sandkasten | Sand, Kies | Eimer, Schaufeln, Randsteine | Draußen, keine Aufsicht mehr |

Der rote Faden: Die Spielzeuge entfernen sich Akt für Akt weiter von der
Sicherheit. Das trägt den Humor, statt ihn zu ersetzen. Ein Kriegsfeld
oder eine echte Höhle würden dein einziges Alleinstellungsmerkmal gegen
ein Allerweltsmerkmal tauschen.

## 3.2 Asset-Liste

| Was | Anzahl | Größe | Format |
|---|---|---|---|
| Bodenkacheln, 3 Varianten je Akt | 9 | 32×32 | PNG |
| Wandkacheln, 2 Varianten je Akt | 6 | 32×32 | PNG |
| Loch- und Grubenkachel je Akt | 3 | 32×32 | PNG |
| Tür geschlossen und offen je Akt | 6 | 32×32 | PNG mit Alpha |
| Türsymbole für 8 Raumtypen | 8 | 16×16 | PNG mit Alpha |
| Dekorobjekte je Akt | 12 | 32×32 | PNG mit Alpha |
| Zerstörbare Wand je Akt | 3 | 32×32 | PNG |
| Mine, Falle, Gadget-Overlays | 8 | 16×16 | PNG mit Alpha |

Rund 55 Dateien. Das ist mengenmäßig zu schaffen, aber nur mit einem
festen Vorgehen.

## 3.3 Vorgehen bei KI-Grafiken

Sei gewarnt: Bildmodelle sind bei Pixel-Art auf 32×32 unzuverlässig. Sie
erzeugen weiche Kanten, willkürliche Paletten und Details, die bei dieser
Auflösung verschwinden. Direkt generierte 32×32-Kacheln sehen fast immer
schlecht aus.

Das Vorgehen, das funktioniert:

1. **Palette zuerst festlegen.** Erzeuge einmal eine Palette von 16 bis
   24 Farben für das gesamte Spiel und leite alle drei Kulissen daraus
   ab. Sonst wirkt Akt 2 wie ein anderes Spiel als Akt 1.
2. **Groß generieren, klein rechnen.** Lass dir die Kachel bei 512×512
   erzeugen und skaliere sie mit Nächster-Nachbar-Interpolation auf
   32×32 herunter. Nicht bilinear — das erzeugt Matsch.
3. **Nachbearbeiten ist Pflicht.** Kanten hart ziehen, Palette
   erzwingen, Kachelgrenzen prüfen.
4. **Kachelbarkeit testen.** Jede Bodenkachel muss viermal
   nebeneinander gelegt nahtlos wirken. Das gelingt KI-Bildern selten
   von allein.
5. **Nie einzeln generieren.** Lass dir alle drei Varianten einer Kachel
   in einem Bild als Dreierreihe erzeugen, damit sie zueinander passen.

### Beispielauftrag für ein Bildmodell

> Ein Kachelblatt im Pixel-Art-Stil, 3 Kacheln nebeneinander, jede
> quadratisch und nahtlos kachelbar. Motiv: heller Holzdielenboden eines
> staubigen Dachbodens, von oben gesehen, leichte Gebrauchsspuren,
> vereinzelt Staubflocken. Begrenzte Farbpalette aus höchstens 6
> Brauntönen. Harte Pixelkanten, keine Weichzeichnung, keine
> Farbverläufe, kein Rauschen. Gleichmäßige Ausleuchtung ohne
> Schlagschatten. Auf weißem Hintergrund, keine Beschriftung, kein
> Rahmen.

Die entscheidenden Worte sind „nahtlos kachelbar", „harte Pixelkanten",
„begrenzte Farbpalette" und „gleichmäßige Ausleuchtung ohne
Schlagschatten". Ohne den letzten Punkt bekommst du Kacheln mit
eingebackenem Licht, die nebeneinander gelegt ein Schachbrettmuster
ergeben.

Für Objekte mit Alphakanal zusätzlich: „freigestellt auf einfarbigem
Magenta-Hintergrund" und das Magenta anschließend entfernen. Bildmodelle
liefern selten sauberes Alpha.

### Phase G1 — Kulissen einbauen [ENGINE]

```
Phase G1 aus AUFTRAG-UMBAU-V2.md. Lies vorher CLAUDE.md und
src/render/sprites.js.

Ziel: Der Akt bestimmt die Kulisse.

Aufgaben:
1. Ein Kulissen-Satz je Akt, vollständig in data/ definiert: welcher
   Kacheltyp welche Datei nutzt. Nichts im Code.
2. Fallback: Fehlt eine Datei, wird die bisherige prozedurale
   Zeichnung genutzt, damit das Spiel nie kaputtgeht.
3. Variantenwahl aus einem eigenen, seedbasierten Strom, damit dieselbe
   Kulisse für denselben Seed identisch aussieht.
4. Die Ladezeit darf nicht steigen: Kacheln als ein Blatt laden, nicht
   als 55 Einzeldateien.

Bevor ich Grafiken liefere: Baue den Einbau mit farbigen Platzhaltern,
damit ich sehe, wo welche Kachel landet.

Tests: fehlende Dateien führen nicht zum Absturz, Variantenwahl ist
deterministisch. Pflicht-Gegenprobe.
```

---

# TEIL 4 — Reihenfolge und Konsequenzen

## 4.1 Die Reihenfolge

| Reihenfolge | Was | Sessions, geschätzt |
|---|---|---|
| 1 | M1, M2 — Makel tragfähig und sichtbar | 2 |
| 2 | M3, M4 — Werkstatt, Umpolung, Härtung, Narben | 3 |
| 3 | Die 14 Kartenwellen aus `AUFTRAG-FERTIGSTELLUNG.md`, jetzt mit Makel | 14 |
| 4 | M5 — Nekromanten-Pass | 4 |
| 5 | D1 — Machbarkeitsprüfung Dungeon | 1 |
| 6 | D2 bis D6 — Dungeon-Umbau | 10 bis 15 |
| 7 | G1 plus Grafikproduktion | 3 plus deine Zeit |

**Die Makel kommen zuerst, weil sie das Kartenschema verändern.** Jede
Karte, die vorher geschrieben wird, muss nachbearbeitet werden — das sind
150 Karten doppelt.

**Der Dungeon kommt nach den Karten**, weil er das einzige Stück ist, das
sich auch später noch einbauen lässt, ohne bereits Gebautes zu entwerten.
Die Karten funktionieren in beiden Raumsystemen unverändert.

## 4.2 Was das insgesamt bedeutet

Etwa 40 Sessions bis zu dem Punkt, den `AUFTRAG-FERTIGSTELLUNG.md`
Stufe A und E beschreibt. Danach kommen Stufe B, C, D und F noch dazu.

Bei einer Session pro Woche ist das der größere Teil von zwei Jahren.
Das ist keine Warnung, die dich abhalten soll — es ist die Zahl, die du
kennen musst, bevor du D1 startest. Der Dungeon-Umbau allein ist rund
ein Drittel davon und liefert keine einzige neue Spielstunde, sondern
verändert, wie sich die vorhandenen anfühlen.

Wenn irgendwann gekürzt werden muss, kürze hier: Teil 2 streichen und
bei der Knotenkarte bleiben. Teil 1 ist nicht kürzbar — ohne
Entscheidungskosten bleibt das Kernproblem bestehen.
---

# TEIL 5 — Umsetzungsstand (vom Bau nachgetragen)

**Dieser Teil stammt nicht vom Auftraggeber.** Teil 0 bis 4 oben sind der
wortgetreue Auftragstext. Dieser Abschnitt wurde beim Einchecken des
Dokuments nachgetragen, damit ein späterer Chat nicht vom falschen Stand
ausgeht.

Das Dokument lag bis dahin **nur als Chat-Text** vor, nicht als
Repo-Datei — wie `MACHTKURVE.md` und `AUFTRAG-FERTIGSTELLUNG.md`, die
beide weiterhin fehlen (nicht rekonstruierbar, sie liegen in bereits
rotierten Gesprächsverläufen). Verweise auf diese beiden Dokumente in
Teil 0/1.3/4.2 laufen deshalb aktuell ins Leere; maßgeblich für den
Ist-Stand ist `CLAUDE.md`.

## 5.1 Phasenstand

| Phase | Stand | Deckungsgleich mit dem Auftragstext? |
|---|---|---|
| M1 — Engine: Makel tragfähig | gebaut, gemergt | ja |
| M2 — Datenschema und Anzeige | gebaut, gemergt | ja |
| M3 — Werkstatt | gebaut, gemergt | **nein, s. 5.3** |
| M4 — Umpolung, Härtung, Narben | gebaut, gemergt | **nein, s. 5.4** |
| 14 Kartenwellen (mit Makel, M6) | offen | — nächste Sitzung laut 4.1 |
| Narben-Nachtrag (5.5 Punkt 4) | gebaut, gemergt | ja (Kartenfamilie, s. 5.5) |
| M5a — Nekromanten-Pass uncommon | gebaut, gemergt | ja, mit einer Abweichung (s. 5.7) |
| M5b — Nekromanten-Pass rare | gebaut, gemergt | ja, gleiche Abweichung wie M5a (s. 5.8) |
| M5c–d — Nekromanten-Pass epic/legendary | gebaut, gemergt | ja, eigener Fund (Champion-HP-Kopplung, s. 5.9) |
| D1 — Machbarkeitsprüfung Dungeon | geprüft, kein Code (s. 5.10) | ja |
| D2–D6 — Dungeon-Umbau | offen | — |
| G1 — Kulissen einbauen | offen | — |

**Wichtig:** `data/makel.json` steht vollständig (alle acht Vokabeln aus
Abschnitt 1.2), aber **keine einzige Karte trägt bisher ein
`makel`-Feld** (0 von 21 Sockelkarten, 0 von 115 Nekromanten-Karten).
Die drei Makel-Sektionen im Shop sind dadurch in einem echten Run noch
unsichtbar. Das ändert sich mit den 14 Kartenwellen.

## 5.2 Eine Korrektur am Auftragstext (M1-Befund)

Abschnitt 1.2 schreibt: „Nur `maxHp` ist im Code gegen negative Werte
abgesichert (`cfg.js:1140`)." Das stimmt so nicht — diese Zeile liegt in
`applyHpScaling()`, die laut eigenem Kommentar **ausschließlich für
Gegner** läuft. Der **Spieler** hatte vor M1 gar keine `maxHp`-Untergrenze.
Die Schlussfolgerung des Auftrags (Untergrenzen sind Pflicht) stimmt also,
die Begründung war sogar zu optimistisch. M1 hat zusätzlich zwei im
Auftrag nicht genannte Absturzrisiken gefunden (`resistAdd ≤ -100` →
`Infinity`-Schaden; `hpAdd`-Stapel ohne Spieler-Untergrenze → Run beim
Raumstart lautlos unspielbar) und dafür zwei Werte über die
Startvorschlagsliste hinaus ergänzt (`bulletSpeedMinPct`,
`selfImmunityMinPct`).

## 5.3 Abweichungen in M3 (Werkstatt)

In der M3-Sitzung lag der Auftragstext nicht im Kontext vor; gebaut wurde
nach der Architekturvorgabe aus dem M2-Eintrag in `CLAUDE.md`.

| M3 Punkt | Auftragstext | Tatsächlich gebaut |
|---|---|---|
| 1 Ort | Rastplatz **und** Shop | **nur Shop** (`run.js: buyShopMakelRemoval()`); der Rastplatz hat weiterhin nur Reparaturtrupp + Werkbank |
| 2 Preis | `scrap.cost.makel`, **steigt mit jeder Entfernung im selben Run**, Formel im JSON | `scrap.cost.makelRemoval: 8`, **fest**, keine Steigerung, keine Formel |
| 3 „nicht entfernbar" | Makel von Umpolungs-Keystones erscheinen nicht in der Liste | **Merkmal existiert nicht** — es gibt auch keine Keystones (s. 5.4) |
| 4 Stufenaufstieg | ein entfernter Makel bleibt entfernt | **erfüllt** — `run.makelRemoved` ist karten- und indexbasiert, also stufenunabhängig |

## 5.4 Abweichungen in M4 (Umpolung, Härtung, Narben)

Auch hier lag der Auftragstext nicht im Kontext vor. Die drei Mechaniken
wurden stattdessen **direkt beim Nutzer erfragt** (`AskUserQuestion`) und
nach dessen Antworten gebaut. Die Antworten wichen ihrerseits vom
Auftragstext ab — die Abweichung ist also eine Nutzerentscheidung, kein
Versehen des Bauenden, und wird hier **nicht stillschweigend korrigiert**.

Nutzerantworten wortgetreu:
- Umpolung: „Es werden Makel positiv gepolt. Z.B für jede -2 Tempo bekommt
  er +1 Leben. Oder für jede minus feuerrate, steigt die Wiederbelebung um
  die Hälfte."
- Härtung: „Schweregrad senken."
- Narben: „Ausgleich fürs Ertragen."

| M4 Punkt | Auftragstext | Tatsächlich gebaut |
|---|---|---|
| 1 Umpolung | **Kartenmerkmal**: acht legendäre Keystone-Karten im Kernpool, je eine Makelart; dreht **alle** Makel dieser Art im **Vorzeichen** (gleiche Achse); `isUnique`, nicht entfernbar | **Shop-Aktion** gegen Schrott (`scrap.cost.makelUmpolung: 12`); polt **einen einzelnen** Makel-Eintrag **einer** Karte um, und zwar auf eine **andere Achse** (`data/makel.json: <makel>.umpolung`), nicht per Vorzeichenwechsel. Keine Karte, kein Keystone, kein Build-Sog. |
| 2 Härtung | **Kartenmerkmal**: der Makel **verfällt** nach N geräumten Räumen, N steht auf der Karte, Restzahl in der Makel-Übersicht | **Shop-Aktion** (`scrap.cost.makelHaertung: 5`); **senkt den Schweregrad** um eine Stufe (schwer→mittel→leicht). Kein Verfall, kein Raumzähler, keine Restzahl. |
| 3 Narben | **`core`-Schlüssel**, skaliert je **aktivem** Makel (aktiv = nicht entfernt, nicht verfallen, nicht umgepolt) — Kartenfamilie wie „Narbengewebe: +4 % Schaden je aktivem Makel" | **automatischer Run-Bonus ohne Karte**: ein **nie angefasster** Makel-Eintrag „reift" nach `balance.makel.narbeRooms` (5) geräumten Räumen und gibt dann dauerhaft `balance.makel.narbeHpBonus` (3) maximale LP. Kein `core`-Schlüssel, keine Karte. |
| 4 Auswertungsreihenfolge | erst Umpolung, dann Verfall, dann Narbenzählung; als Kommentar an der Auswertungsstelle | teilweise: es gibt keinen Verfall. `cfg.js: applyUpgrades()` wertet Entfernung → Härtung (effektive Schwere) → Umpolung aus; Narben laufen getrennt über `applyMakelNarben()` nach `applyUpgrades()`. |

## 5.5 Was dadurch offen bleibt

Vier Dinge aus dem Auftragstext existieren im Code **nicht** und brauchen
eine eigene Nachtragsphase, falls sie gewollt sind:

1. **Die acht Umpolungs-Keystone-Karten** (Abschnitt 1.4 Weg 2). Sie sind
   der eigentliche Build-Motor des Systems — „ab dem Moment suchst du
   gezielt nach Karten mit genau diesem Makel". Die gebaute Shop-Umpolung
   erzeugt diesen Sog nicht, weil sie je Einzelkarte gekauft wird.
2. **Das Merkmal „nicht entfernbar"** (M3 Punkt 3) — hängt an 1.
3. **Der Makel-Verfall** (Abschnitt 1.4 Weg 3, „Notschweißung"). Die
   gebaute Härtung ist eine Abschwächung, kein Spannungsbogen innerhalb
   eines Runs.
4. **Die Narben-Kartenfamilie** (Abschnitt 1.4 Weg 4). Ohne sie ist die
   Balance-Auflage aus Abschnitt 1.4 — „ein Run, der alle Makel wegkauft,
   muss schwächer sein als einer, der mit ihnen arbeitet" — mit dem
   gebauten Stand **nicht erfüllbar**: der Narben-LP-Bonus (3 LP je
   gereiftem Makel) ist der einzige Anreiz zum Behalten und steht gegen
   volle Makel-Entfernung praktisch immer hinten.

**Nachtrag:** Punkt 4 ist inzwischen gebaut (drei `narben*`-core-Schlüssel,
drei Karten `sockel_narbengewebe`/`sockel_wundpanzer`/`sockel_zornige_narben`,
Testabschnitt 88) — die Balance-Auflage aus 1.4 ist damit erfüllbar.

Punkt 4 war der einzige mit direkter Konsequenz für die **nächste**
Sitzung (die 14 Kartenwellen): solange keine Karte von aktiven Makeln
profitiert, ist die Werkstatt nicht ein Weg von vieren, sondern der
einzig richtige Zug.

## 5.6 Was M6 an den Kartenwellen-Prompt anhängt

Unverändert gültig (Abschnitt 1.5, Phase M6) — die drei Zeilen gehören in
jeden der 14 Kartenwellen-Prompts:

```
- Jede Karte oberhalb von common trägt genau einen Makel aus
  data/makel.json. Der Makel trifft NIE dieselbe Achse wie der Vorteil.
- Bruttowerte nach AUFTRAG-UMBAU-V2.md Abschnitt 1.3, nicht nach
  MACHTKURVE.md Abschnitt 4.
- Nenne mir pro Karte Bruttowert, Makelkosten und Nettowert.
```

Schemaform des Feldes (M2, freigegeben):
`"makel": [{ "id": "<vokabel-id>", "schwere": "leicht"|"mittel"|"schwer" }]`

## 5.7 M5a — Makel-Pass uncommon (Umsetzung)

Durchgezogen ohne Freigabestopp (Nutzerentscheidung). **Abweichung:** die
Regel „höchstens zwei Karten je Stufe mit demselben Makel“ ist bei 30
Karten und 8 Makeln nicht erfüllbar (8×2 = 16 < 30). Nutzerentscheidung:
höchstens `ceil(Kartenzahl/8)+1` je Makel und Stufe (uncommon: 5). Gebaut:
jeder Makel 3–4-mal. Bruttoanhebung je Karte rund +30 % auf den Hauptwert
(Abschnitt 1.3), der Nettowert ist **nicht gemessen**, nur geschätzt.
`ghost_092` ist ein reiner Schalter und bekam keine Anhebung, sein Netto
sinkt also. Nebenwirkung bis M5b: `ghost_109` (uncommon, 13 %) liegt über
`ghost_055` (rare, 12 %).

| Karte | Name | alter Wert | neuer Bruttowert | Makel (leicht) | Anhebung |
|---|---|---|---|---|---|
| ghost_008 | Schattenschild | ShieldOnSpawnPct 0,1 | 0,13 | Teuer (-1) | ~+30 % |
| ghost_009 | Ätherhülle | ResistAdd 4 | 5 | Schwerfällig (0,95) | ~+30 % |
| ghost_020 | Sterbeexplosion | ExplosionDamagePct 0,25 | 0,33 | Heißer Lauf (0,95) | ~+30 % |
| ghost_021 | Erbschaft des Starken | InheritHighPct 0,08, InheritLowPct 0,04 | 0,1, 0,05 | Enges Magazin (-1) | ~+30 % |
| ghost_022 | Härte aus Verlust | ResistAmount 8 | 10 | Kurzer Lauf (0,95) | ~+30 % |
| ghost_024 | Dunkler Treibstoff | FireBurstPct 0,15 | 0,2 | Blechhaut (-8) | ~+30 % |
| ghost_026 | Opferstoß | ShockDamagePct 0,4 | 0,52 | Heißer Lauf (0,95) | ~+30 % |
| ghost_027 | Kettenopfer | DoubleStackChance 0,2 | 0,26 | Teuer (-1) | ~+30 % |
| ghost_028 | Treues Ende | ExpireStackBonus 0,5 | 0,65 | Dünne Platte (-5) | ~+30 % |
| ghost_045 | Überzahl | OverwhelmBulletSizeMult 1,15, OverwhelmBulletSpeedMult 1,1 | 1,2, 1,13 | Schwerfällig (0,95) | ~+30 % |
| ghost_046 | Veteranen | VeteranDamageMult 1,2, VeteranHpMult 1,12 | 1,26, 1,16 | Enges Magazin (-1) | ~+30 % |
| ghost_047 | Sturmformation | StormApproachSpeedMult 1,15, StormApproachDamageMult 1,15 | 1,2, 1,2 | Blechhaut (-8) | ~+30 % |
| ghost_048 | Schildwall | WallShieldPct 0,12 | 0,16 | Kurzer Lauf (0,95) | ~+30 % |
| ghost_049 | Seelenoffizier | OfficerDamageMult 1,14, OfficerFireRateBonus 0,08 | 1,18, 0,1 | Teuer (-1) | ~+30 % |
| ghost_050 | Munitionsaustausch | AmmoExchangePerShot 0,01 | 0,013 | Dünne Platte (-5) | ~+30 % |
| ghost_051 | Erbmunition | ErbmunitionDamagePct 0,25 | 0,33 | Heißer Lauf (0,95) | ~+30 % |
| ghost_070 | Herrscheraura | CrownAuraDamageTakenReduction 0,1, CrownAuraGhostDamageBonus 0,1 | 0,13, 0,13 | Schwerfällig (0,95) | ~+30 % |
| ghost_072 | Seelenauslese | FusionHpPctBonus 0,08, FusionDamagePctBonus 0,08, FusionFireRatePctBonus 0,03 | 0,1, 0,1, 0,04 | Blechhaut (-8) | ~+30 % |
| ghost_073 | Endloser Anspruch | FusionShieldOnFusionPct 0,15 | 0,2 | Kurzer Lauf (0,95) | ~+30 % |
| ghost_074 | Verdichtete Geschosse | CrownBulletSizePct 0,08, CrownRangePct 0,06 | 0,1, 0,08 | Enges Magazin (-1) | ~+30 % |
| ghost_075 | Raubseele | CrownLifestealToPlayerPct 0,02 | 0,026 | Klemmender Lader (1,05) | ~+30 % |
| ghost_076 | Erbgeschütz | CrownExtraShotDamagePct 0,4 | 0,52 | Dünne Platte (-5) | ~+30 % |
| ghost_077 | Seelenverdichtung | CrownFusionDamagePer3 0,1 | 0,13 | Teuer (-1) | ~+30 % |
| ghost_086 | Totenmarsch | HybridDeathPlayerDmgPct 0,04, HybridDeathGhostDmgPct 0,06 | 0,05, 0,08 | Klemmender Lader (1,05) | ~+30 % |
| ghost_087 | Erben der Front | HybridRandomTransferPct 0,15 | 0,2 | Schwerfällig (0,95) | ~+30 % |
| ghost_092 | Blutiger Thron | — | — (Schalter, nicht skalierbar) | Heißer Lauf (0,95) | keine (netto −) |
| ghost_093 | Tribut des Königs | HybridChampionSpawnStatPct 0,25 | 0,33 | Dünne Platte (-5) | ~+30 % |
| ghost_098 | Auslese der Legion | CapFusionHpPct 1, CapFusionDamagePct 1, CapFusionFireRatePct 1 | 1,3, 1,3, 1,3 | Klemmender Lader (1,05) | ~+30 % |
| ghost_109 | Flüstern der Gefallenen | ReviveChanceAdd 0,1 | 0,13 | Kurzer Lauf (0,95) | ~+30 % |
| ghost_112 | Beständiger Regent | CrownLifetimeAdd 1 | 1,3 | Blechhaut (-8) | ~+30 % |

## 5.8 M5b — Makel-Pass rare (Umsetzung)

Wie M5a, eine Stufe höher: jede der 26 rare-Karten trägt genau einen
**mittleren** Makel, Limit `ceil(26/8)+1 = 5` je Makel (gebaut 3–4).
Hauptwerte brutto rund +30 %. `ghost_023` ist ein Schalter ohne Anhebung,
`ghost_053` wird durch eine **niedrigere** Schwelle stärker (30 → 23 %).
`ghost_055` liegt jetzt mit 16 % wieder über `ghost_109` (13 %).
Nebenwirkung bis M5c: `ghost_113` (rare, 2,0 s) ist gleichauf mit
`ghost_114` (epic, 2,0 s). Achsenregel erweitert: kein Blechhaut/Dünne
Platte auf Karten, die den Spieler schützen (Seelenband, Opfer-/Kronen-Schild,
Run-Leben). Nettowert **nicht gemessen**.

| Karte | Name | alter Wert | neuer Bruttowert | Makel (mittel) | Anhebung |
|---|---|---|---|---|---|
| ghost_010 | Jenseitsziel | FlankDamageBonus 0,15 | 0,2 | Teuer (-2) | ~+30 % |
| ghost_023 | Überlaufende Seele | — | — (Schalter, nicht skalierbar) | Schwerfällig (0,9) | keine (netto −) |
| ghost_029 | Seelenhunger | RunDmgPct 0,01 | 0,013 | Dünne Platte (-10) | ~+30 % |
| ghost_030 | Unsterbliche Maschine | RunHpPct 0,01 | 0,013 | Kurzer Lauf (0,9) | ~+30 % |
| ghost_032 | Totenkanone | HomingDamageMult 1,5 | 2,0 | Heißer Lauf (0,9) | ~+30 % |
| ghost_033 | Rückkehr aus Asche | StartGhostPct 0,3 | 0,4 | Enges Magazin (-1) | ~+30 % |
| ghost_052 | Mehrfachwiederbelebung | DoubleReviveChance 0,2 | 0,26 | Teuer (-2) | ~+30 % |
| ghost_053 | Verstärkte Hülle | HullThresholdPct 0,3 | 0,23 | Schwerfällig (0,9) | ~+30 % |
| ghost_054 | Legionskern | CoreHealPct 0,2, CoreDamageBonus 0,1 | 0,26, 0,13 | Blechhaut (-15) | ~+30 % |
| ghost_055 | Totenruf der Tiefe | ReviveChanceAdd 0,12 | 0,16 | Kurzer Lauf (0,9) | ~+30 % |
| ghost_056 | Elite-Reaktivierung | EliteReviveStatPct 0,9 | 1,0 | Dünne Platte (-10) | ~+30 % |
| ghost_078 | Alpha-Schuss | CrownAlphaShotDamageMult 2,0 | 2,3 | Enges Magazin (-1) | ~+30 % |
| ghost_079 | Unantastbarer | CrownUnassailableS 2,0 | 2,6 | Klemmender Lader (1,1) | ~+30 % |
| ghost_080 | Kronenerbe | CrownHeirPct 0,6 | 0,78 | Blechhaut (-15) | ~+30 % |
| ghost_081 | Seelenmonolith | CrownAnchorDamagePct 0,45, CrownAnchorRangePct 0,25, CrownAnchorResist 20 | 0,58, 0,33, 26 | Schwerfällig (0,9) | ~+30 % |
| ghost_082 | Kronjäger | ChampionExecThreshold 0,5 | 0,55 | Teuer (-2) | ~+30 % |
| ghost_088 | Blutige Formation | HybridPerAllyDmgPct 0,05, HybridFlankBonusPct 0,1, HybridReviveDeathBonusPct 0,08 | 0,065, 0,13, 0,1 | Blechhaut (-15) | ~+30 % |
| ghost_089 | Wechselopfer | SacrificeHealPct 0,2, SacrificeShieldPct 0,1 | 0,26, 0,13 | Kurzer Lauf (0,9) | ~+30 % |
| ghost_094 | Erbe des Herrschers | CrownDeathDmgTransferPct 0,25, CrownDeathHpShieldPct 0,25 | 0,33, 0,33 | Heißer Lauf (0,9) | ~+30 % |
| ghost_095 | Seelenband | SoulbondPct 0,25 | 0,33 | Klemmender Lader (1,1) | ~+30 % |
| ghost_099 | Krönungszug | CrownProcPerAllyPct 0,05 | 0,065 | Enges Magazin (-1) | ~+30 % |
| ghost_100 | Ersatzkörper | SuccessionPct 0,5 | 0,65 | Dünne Platte (-10) | ~+30 % |
| ghost_106 | Einziges Schwert | FusionDamagePctBonus 0,15 | 0,2 | Heißer Lauf (0,9) | ~+30 % |
| ghost_107 | Einziges Schild | FusionHpPctBonus 0,15 | 0,2 | Schwerfällig (0,9) | ~+30 % |
| ghost_108 | Einziger Bogen | FusionFireRatePctBonus 0,15 | 0,2 | Blechhaut (-15) | ~+30 % |
| ghost_113 | Verlängerte Herrschaft | CrownLifetimeAdd 1,5 | 2,0 | Klemmender Lader (1,1) | ~+30 % |

## 5.9 M5c+M5d — Makel-Pass epic+legendary (Umsetzung)

Beide letzten Stufen des Nekromanten-Makel-Passes in einer Sitzung gemacht
(Nutzerauftrag „Mache alle Seltenheiten" statt der ursprünglich in 4.1
vorgesehenen Trennung in zwei Sessions).

**epic** (16 Karten, ein schwerer Makel, Limit `ceil(16/8)+1 = 3`, gebaut 2
je Makel):

| Karte | Name | alter Wert | neuer Bruttowert | Makel (schwer) | Anhebung |
|---|---|---|---|---|---|
| ghost_025 | Letzte Deckung | LastStandHealPct 0,25 | 0,31 | Kurzer Lauf (0,82) | ~+24 % |
| ghost_031 | Märtyrerbefehl | ActiveDmgPct 0,08, ActiveFireRatePct 0,05, ActiveDurationS 10 | 0,10, 0,065, 13 | Dünne Platte (-18) | ~+25–30 % |
| ghost_035 | Vorbote des Endes | VirtualDeathsOnStart 4 | 5 | Enges Magazin (-2) | ~+25 % |
| ghost_057 | Gemeinsamer Wille | SharedWillResist 10 | 13 | Schwerfällig (0,82) | ~+30 % |
| ghost_058 | Chor der Toten | — | — (Schalter, nicht skalierbar) | Heißer Lauf (0,82) | keine (netto −) |
| ghost_059 | Grabfeld | GraveyardBonus 0,25 | 0,31 | Teuer (-3) | ~+24 % |
| ghost_071 | Einziger Thron | UniqueThronePerFusionPct 0,05 | 0,065 | Klemmender Lader (1,18) | ~+30 % |
| ghost_083 | Ewiger Thron | CrownDamagePct 0,25, CrownHpPct 0,25 | 0,31, 0,31 | Dünne Platte (-18) | ~+24 % |
| ghost_084 | Unsterblicher König | ImmortalKingHealPct 0,3, InvulnS 1,0, CooldownS 15 | 0,38, 1,3, 12 | Enges Magazin (-2) | ~+27–30 % |
| ghost_090 | Rückkehr im Zorn | ReplacementChance 0,25, StatPct 0,5, LifetimeS 6 | 0,31, 0,62, 7,5 | Dünne Platte (-18) | ~+24–25 % |
| ghost_096 | Königliches Opfer | SacrificeChampionStatPct 0,4 | 0,5 | Schwerfällig (0,82) | ~+25 % |
| ghost_101 | Seelenlieferanten | HybridGhostKillReviveChance 0,2 | 0,25 | Kurzer Lauf (0,82) | ~+25 % |
| ghost_102 | Kronengarde | GuardResistPerAlly 10, SoloShieldPct 0,1, SoloIntervalS 5 | 13, 0,13, 4 | Heißer Lauf (0,82) | ~+30 % |
| ghost_110 | Ruf der Legion | ReviveChanceAdd 0,18 | 0,23 | Teuer (-3) | ~+28 % |
| ghost_114 | Ungebrochener Schwur | CrownLifetimeAdd 2,0 | 2,5 | Blechhaut (-25) | ~+25 % |
| ghost_116 | Losgelöste Ketten | — | — (Schalter, nicht skalierbar) | Klemmender Lader (1,18) | keine (netto −) |

**Echter Fund, kein Testartefakt**: `ghost_083`/`ghost_103` (der zweiten
in der legendary-Tabelle) erhöhen den **Champion**-maxHp prozentual
(`necroCrownHpPct`/`necroCrownMassHpPerSlot`). Der Champion erbt seine
Basiswerte aber `championStatPct × Spieler-maxHp` (`ghost.js:
promoteToChampion()`, Champion-Nachschliff) — ein Blechhaut-Makel auf einer
solchen Karte untergräbt dadurch den eigenen Bonus. Am echten `ghost_083`
gemessen: mit Blechhaut sank das Champion-maxHp trotz +31 % Bonus auf 64
statt 67 ganz ohne Karte — netto **negativ**. Beide Karten haben deshalb
`duenne_platte` bzw. `kurzer_lauf` statt Blechhaut. Ein neuer Struktur-Test
(`tests/regression.mjs`, Abschnitt 91/92, `CHAMPION_HP_KEYS`-Regex) bewacht
diese Kopplung generisch für jede künftige Karte mit diesen beiden Feldern,
nicht nur die zwei Fundstellen.

**legendary** (10 Karten, ein schwerer Makel, **zwei Karten mit zwei
Makeln** — „teils zwei" —, Limit `ceil(10/8)+1 = 3`):

| Karte | Name | alter Wert | neuer Bruttowert | Makel (schwer) | Anhebung |
|---|---|---|---|---|---|
| ghost_034 | Unheiliger Höhepunkt | WindowS 4, DamagePct 0,35, FireRatePct 0,25, SpeedPct 0,15, DurationS 8, CooldownS 18 | 5, 0,47, 0,34, 0,20, 11, 14 | Dünne Platte (-18) + Teuer (-3) | ~+33–37 % |
| ghost_060 | Armee der Toten | ghostMaxAdd 2, GuaranteedReviveStatPct 0,5 | 3, 0,68 | Enges Magazin (-2) | +50 %/+36 % |
| ghost_085 | Seelenkoloss | FusionReplaceHpPct 1,5, DamagePct 1,5, FireRatePct 0,6 | 2,0, 2,0, 0,8 | Klemmender Lader (1,18) | ~+33 % |
| ghost_091 | Lawine der Toten | WindowS 5, Spawn 2, StatPct 0,6, DmgPct 0,2, FRPct 0,2, DurationS 8, CooldownS 20 | 6, 3, 0,8, 0,27, 0,27, 11, 16 | Kurzer Lauf (0,82) + Heißer Lauf (0,82) | ~+20–50 % |
| ghost_097 | Thron aus Gebein | ThroneDmgPct 0,03, ShieldPct 0,015 | 0,04, 0,02 | Dünne Platte (-18) | ~+33 % |
| ghost_103 | Massenkrone | MassDmgPerSlot 0,08, HpPerSlot 0,08, SlotThreshold 3, SoloFireRatePct 0,25 | 0,11, 0,11, 2, 0,35 | Kurzer Lauf (0,82) | ~+37–40 % |
| ghost_104 | Kreislauf der Verdammten | CircleThreshold 5, ReviveStatPct 0,5, DmgPct 0,15, DurationS 8 | 4, 0,68, 0,20, 11 | Schwerfällig (0,82) | ~+33–37 % |
| ghost_105 | Herrschaft über den Tod | LifetimeS 20, BuffDmgPct 0,15, BuffFRPct 0,15, BuffDurationS 10 | 27, 0,20, 0,20, 14 | Teuer (-3) | ~+33–40 % |
| ghost_111 | Unaufhaltsamer Totenruf | ReviveChanceAdd 0,25 | 0,34 | Enges Magazin (-2) | ~+36 % |
| ghost_115 | Vermächtnis der Krone | CrownLifetimeAdd 3,0 | 4,2 | Klemmender Lader (1,18) | ~+40 % |

Mehrere Werte sind bewusst als **Schwellen-/Cooldown-Senkung** statt reiner
Prozentanhebung umgesetzt (kürzere Fenster/Cooldowns, niedrigere
Auslöseschwellen = leichter/öfter auslösbar = stärker), analog zu M5b's
`ghost_053`-Muster — „regelbrechend" (Abschnitt 1.3) erlaubt das
ausdrücklich, anders als bei common/uncommon/rare.

**Stufenordnung nachgezogen**: `ghost_110` (epic) 0,23 > rare `ghost_055`
0,16; `ghost_111` (legendary) 0,34 > epic 0,23. `ghost_114` (epic) 2,5 s
löst die von M5b offengelassene Gleichstand-Nebenwirkung mit rare
`ghost_113` (2,0 s) auf; `ghost_115` (legendary) 4,2 s > epic 2,5 s.

Zwölf Bestandstests lasen alte Werte fest ein (Phase 6/7/8/9,
Abschnitt 65j/65n) — umgestellt auf `necroData.upgrades.<id>.core.<feld>`.
Neue Testabschnitte 91 (epic)/92 (legendary): Struktur, Achsenregel
(inkl. der neuen Champion-HP-Kopplungsprüfung), Stufenordnung, Doppel-
Makel-Zähler, Ende-zu-Ende (inkl. der Erkenntnis, dass `bulletSpeedMult`
über `cfg.bulletSpeed` wirkt, nicht über ein eigenes Feld). Sechs
Gegenproben am echten Quellcode bestanden. Nettowert **nicht gemessen** —
wie bei M5a/M5b eine offene Balance-Frage für eine spätere Session.

**Damit ist der komplette Nekromanten-Makel-Pass (M5a–d, 115 Karten)
abgeschlossen.** Nächste Sitzung laut 4.1: Phase D1 (Machbarkeitsprüfung
Dungeon).

## 5.10 D1 — Machbarkeitsprüfung Dungeon (Umsetzung)

Wortgetreu nach Phase D1: reine Prüfung, kein Produktivcode, Ergebnis in
CLAUDE.md dokumentiert (eigener Abschnitt „AUFTRAG-UMBAU-V2 — Phase D1"),
danach gestoppt.

**Kurzfassung** (Details/Zeilenverweise in CLAUDE.md): der Umbau ist
machbar und liegt bei geschätzt **6–11 Sessions für D2–D6** — innerhalb der
im Auftrag selbst schon genannten Spanne (10–15) und deutlich unter der
15-Session-Warnschwelle aus Abschnitt 2.5. Die Kamera-Kapselung ist
strukturell zur Hälfte schon da (`renderer.js`s Screenshake-Block +
`main.js` zeichnet HUD/Debug bereits außerhalb davon), die Eingabe hat
bereits genau EINE Umrechnungsstelle (`input.js: toCanvas()`), die
Gegner-KI-Raycasts sind kameraunabhängig und die Verdunkelung soll laut D5
ohnehin nie in die Simulation eingreifen. Der wichtigste Befund: **die
Dungeon-Erzeugung (D4) ist eine neue Schicht ÜBER dem bestehenden
Raum-Generator, kein Ersatz** — jeder einzelne Raum bleibt vermutlich bei
24×16 Zellen, nur die Verbindung der Räume untereinander wird zum Gitter.
Die riesige bestehende Testbasis (Kampfraum-Generierung, Kompositionen,
Bosse, 5-Seed-Playthroughs) bleibt dadurch zu weiten Teilen gültig; nur
`run.js: generateMap()`/`actRoomKey()` und ein paar auf `COLS×ROWS`
hartkodierte Systeme (`spidermine.js: rebuildFlowField()`,
`state_world.js: bfsReachable()`) sind von D4 betroffen.

Keine Codeänderung, kein `sw.js`-Bump. Nächste Sitzung: D2 (Kamera) — sofern
der Nutzer nach diesem Stopp grünes Licht gibt.
