// Strukturelle Konstanten. KEINE Balancing-Werte -- die leben in
// /data/*.json (Spec Abschnitt 3, harte Regel) und werden beim Start
// geladen und an createState() uebergeben.

export const STEP = 1 / 60; // Fixed-Timestep in Sekunden (60 Hz)

// Arena-Geometrie (Spec Abschnitt 4: Koordinaten)
export const CELL = 32; // Zellgroesse in px
export const COLS = 24; // 3x8 Kacheln breit
export const ROWS = 16; // 2x8 Kacheln hoch
export const WIDTH = COLS * CELL; // 768
export const HEIGHT = ROWS * CELL; // 512

// Phase-Behelf bis zur Run-Struktur (Phase 7): Tod -> Respawn-Pause.
export const RESPAWN_DELAY = 1.0; // s
