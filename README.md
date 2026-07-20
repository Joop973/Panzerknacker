# PANZERKNACKER

Top-Down-Panzer-Roguelike im Browser. Spielgefühl inspiriert von
klassischen Arcade-Panzerspielen: abprallende Geschosse, One-Hit-Kills,
Minen — erweitert um Run-Struktur (15 Räume + Finalraum), prozedurale
Räume und Upgrades.

## Spielen

Reines HTML/CSS/JS ohne Build-Step. Wegen ES-Modulen und JSON-Laden wird
ein simpler HTTP-Server gebraucht:

```
npx serve .        # oder: python3 -m http.server
```

Dann `http://localhost:…` öffnen. Seed-Eingabe auf dem Startscreen —
derselbe Seed erzeugt exakt denselben Run.

## Steuerung

- **Desktop:** WASD/Pfeile fahren · Maus zielen · Klick schießen ·
  Leertaste Mine · Esc/P Pause · F1 Debug-Overlay
- **Mobile (Landscape):** linker Stick fahren (überall aufsetzen) ·
  rechter Stick zielen + Auto-Fire · MINE-Button unten rechts oder
  Doppeltipp links · als PWA installierbar, läuft nach dem ersten
  Besuch offline
- **Gamepad:** linker Stick fahren · rechter Stick zielen + Auto-Fire ·
  rechter Trigger schießen · A/X Mine · Start Pause

Nach jedem Raum gibt es ein Upgrade; „Tages-Seed spielen" startet den
für alle gleichen Tagesrun.

## Modi & Extras

- **Schwierigkeit:** Leicht / Normal / Schwer (Gegner-Budget und
  Startleben) — Auswahl auf dem Startbildschirm.
- **Endlos-Modus:** nach dem Sieg weiterspielen mit stetig wachsendem
  Budget, bis der letzte Panzer fällt.
- **Combos:** schnelle Kills hintereinander bauen einen Multiplikator
  auf; Bestwert wird gespeichert.
- **Raumvorschau** mit Gegnerliste, Gefahrenpunkten und Kurzinfos.
- **Spawn-Schutz** nach jedem Respawn, **Bedrohungslinien** von
  Gegnern mit Sicht auf dich (abschaltbar), Option **Reduzierte
  Bewegung**.
- **Pause** (Esc/P): weiter, `R` Neustart mit gleichem Seed,
  `M` Hauptmenü.
- Alle Balancing-Werte liegen in `data/*.json` — kein Code-Eingriff
  fürs Tuning nötig.

## Struktur

Verbindliche Referenz: [SPEC.md](SPEC.md). Balancing-Werte liegen
ausschließlich in `data/*.json`.
