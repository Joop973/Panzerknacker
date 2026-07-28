// Sprite-Lader: lädt die PNG-Grafiken (Panzer-Rümpfe + -Türme, Kacheln,
// Geschosse) einmalig und stellt sie dem Renderer bereit. Solange noch
// nicht alles geladen ist (oder etwas fehlschlägt), zeichnet der Renderer
// weiter die prozeduralen Formen -- das Spiel läuft also immer.

const BASE = 'assets/sprites/';

const TANK_TYPES = [
  'player',
  't_brown',
  't_grey',
  't_teal',
  't_yellow',
  't_pink',
  't_green',
  't_purple',
  't_white',
  't_black',
];

// Geschoss-Sprite je Sorte (siehe renderer.js für die Zuordnung).
const BULLET_KEYS = ['normal', 'rocket', 'bounce', 'tungsten', 'explosive'];
const TILE_KEYS = ['floor', 'wall', 'breakable', 'hole'];

export const SPRITES = { body: {}, turret: {}, bullet: {}, tile: {} };

let total = 0;
let loaded = 0;
let ready = false;

function load(cat, key, file) {
  const img = new Image();
  total++;
  img.onload = () => {
    loaded++;
    if (loaded === total) ready = true;
  };
  img.onerror = () => {
    // Fehlt ein Sprite, bleibt der Slot leer -> prozeduraler Fallback.
    total--;
    if (loaded === total) ready = true;
  };
  img.src = BASE + file;
  SPRITES[cat][key] = img;
}

let started = false;
export function initSprites() {
  if (started) return;
  started = true;
  for (const t of TANK_TYPES) {
    load('body', t, `body_${t}.png`);
    load('turret', t, `turret_${t}.png`);
  }
  for (const k of BULLET_KEYS) load('bullet', k, `bullet_${k}.png`);
  for (const k of TILE_KEYS) load('tile', k, `tile_${k}.png`);
}

// true, sobald alle Sprites bereit sind (dann Sprite- statt Vektor-Look).
export function spritesReady() {
  return ready;
}

// Panzertypen ohne eigene Grafik borgen sich eine vorhandene Wanne
// (Phase 4: keine neuen Asset-Dateien). Ihre Identitaet traegt das
// Panzerungs-Overlay im Renderer -- dicker Frontbalken bzw. Rautenkranz.
// Phase 14: die drei Bosse borgen sich aus demselben Grund eine Wanne --
// Der Spiegel bekommt (wie das Prisma) den rotierenden Rautenkranz ueber
// requiresRicochet, die Phalanx den Frontbalken ueber armor.arc, beide
// automatisch aus tanks.json, ohne Renderer-Sonderfall.
const SPRITE_ALIAS = {
  t_armored: 't_grey',
  t_prism: 't_teal',
  t_reactor: 't_green',
  t_mirror: 't_teal',
  t_phalanx: 't_grey',
};

// Einzelnes Sprite, oder null wenn (noch) nicht ladbar.
export function sprite(cat, key) {
  const img = SPRITES[cat][SPRITE_ALIAS[key] || key];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}
