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
- **Mobile (Landscape):** linker Stick fahren · rechter Stick zielen +
  Auto-Fire · Button unten rechts (oder Doppeltipp links) Mine

## Struktur

Verbindliche Referenz: [SPEC.md](SPEC.md). Balancing-Werte liegen
ausschließlich in `data/*.json`.
