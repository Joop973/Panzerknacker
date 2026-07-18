// Phase-1-Konstanten.
//
// HINWEIS ZUR SPEC (Abschnitt 3): Balancing-Werte gehoeren langfristig in
// /data/*.json. Phase 1 laedt aber bewusst noch kein JSON. Bis das
// Daten-Laden (ab Phase 3/6) existiert, leben die wenigen benoetigten
// Werte hier zentral an EINER Stelle, damit spaeter genau ein Modul auf
// JSON umgestellt werden muss -- statt verstreuter Magic Numbers im Code.

export const STEP = 1 / 60; // Fixed-Timestep in Sekunden (60 Hz)

// Arena-Geometrie (Spec Abschnitt 4: Koordinaten)
export const CELL = 32; // Zellgroesse in px
export const COLS = 24; // 3x8 Kacheln breit
export const ROWS = 16; // 2x8 Kacheln hoch
export const WIDTH = COLS * CELL; // 768
export const HEIGHT = ROWS * CELL; // 512

// Spielerpanzer (Spec Abschnitt 4/5)
export const PLAYER_RADIUS = 12; // Kollisionskreis
export const PLAYER_SPEED = 70; // "normal", px/s

// Geschosse (Spec Abschnitt 4: Geschosse; Abschnitt 5: player-Zeile)
export const BULLET_RADIUS = 4; // Kollisionskreis
export const BULLET_SPEED = 130; // Spielerkugel, px/s
export const FIRE_COOLDOWN = 0.25; // s zwischen zwei Schuessen
export const PLAYER_MAGAZINE = 5; // max. gleichzeitige Geschosse
export const PLAYER_RICOCHETS = 1; // Abpraller pro Geschoss
export const SHOOTER_GRACE = 0.08; // s: Geschoss fuer Schuetzen ungefaehrlich

// Phase-2-Behelf: Tod ohne Run-Struktur -> Respawn nach kurzer Pause.
export const RESPAWN_DELAY = 1.0; // s
