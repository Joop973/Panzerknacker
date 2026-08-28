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
  // Klassen mit eigenem Sprite (die uebrigen borgen sich 'player', s. u.)
  'c_frost',
  'c_flame',
  'c_necro',
  'c_blast',
  // Geisterpanzer: EINE gemeinsame Grafik fuer alle Panzer, die zum Geist
  // werden (Renderer: drawGhosts).
  'ghost',
  // Champion (Nutzergrafik, Nachtrag zum Champion-Nachschliff): eigenes
  // goldenes body_champion.png/turret_champion.png, NUR fuer g.isChampion
  // in drawGhosts() -- ersetzt dort body_ghost/turret_ghost, alle anderen
  // Untertanen bleiben beim gemeinsamen 'ghost'-Sprite.
  'champion',
  // Spinnenboss (Nutzergrafik, Akt 3): eigenes body_t_spider.png/
  // turret_t_spider.png -- laedt ueber denselben body/turret-Mechanismus,
  // gezeichnet aber NICHT von renderer.js: drawTank() (das ueberspringt
  // spiderBoss-Panzer explizit), sondern von spiderrender.js.
  't_spider',
];

// Champion-Aura (Nutzergrafik): 12-Frame-Loop-Animation (champion_aura_00..11.png),
// dauerhaft im Loop hinter dem Champion gezeichnet (renderer.js: drawGhosts()).
// Eigene Kategorie statt body/turret, weil es KEIN Rumpf/Turm-Paar ist, das
// separat rotiert -- ein bereits fertig zusammengesetztes, nicht rotierendes
// Aura-Bild pro Frame.
export const CHAMPION_AURA_FRAME_COUNT = 12;

// Geschoss-Sprite je Sorte (siehe renderer.js für die Zuordnung).
const BULLET_KEYS = ['normal', 'rocket', 'bounce', 'tungsten', 'explosive'];
const TILE_KEYS = ['floor', 'wall', 'breakable', 'hole'];

// Kinderzimmer-Reskin (Nutzergrafik): 'arena' ist ein ganzflächiger
// Hintergrund (kein Kachel-Tile), 'tileSheet' sind horizontale Sprite-Sheets
// mit mehreren 64x64-Varianten pro Wandtyp (renderer.js schneidet daraus je
// Zelle EIN Sprite aus, s. dortiger Kommentar). Eigene Kategorien statt
// TILE_KEYS, weil beide ein anderes Zeichen-Verfahren brauchen als eine
// einzelne, wiederholbare Kachel.
// Spinnenboss (Nutzergrafik): 'leg' ist EIN gemeinsames, rotierbares
// Bein-Sprite fuer Boss UND Minen (Boss zieht es groesser, Minen kleiner --
// eine reine Skalierungsfrage in spiderrender.js, kein zweites Bein-Sprite
// noetig, s. dortiger Kommentar), 'mineBody' die kleine Minen-Huelle
// (t_spider selbst nutzt body/turret ueber TANK_TYPES oben), 'web' das
// Spinnennetz-Sprite. Eigene Kategorie statt tile/body, weil keins der drei
// in das bestehende Kachel- oder Rumpf/Turm-Schema passt.
export const SPRITES = { body: {}, turret: {}, bullet: {}, tile: {}, championAura: {}, arena: {}, tileSheet: {}, spider: {} };

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
  // Kinderzimmer-Reskin: ganzflächiger Arena-Hintergrund + zwei Wand-
  // Variantensheets. Fehlen sie (noch), bleiben die TILE_KEYS-Fallbacks
  // oben aktiv -- renderer.js prüft `sprite('arena', …)`/`sprite('tileSheet',
  // …)` und fällt sonst auf `sprite('tile', …)` bzw. die prozedurale Form
  // zurück (dasselbe Ladefehler-Verhalten wie jedes andere Sprite hier).
  load('arena', 'kinderzimmer', 'arena_kinderzimmer_768x512.png');
  load('tileSheet', 'wall', 'tile_wall_sheet_20x64.png');
  load('tileSheet', 'breakable', 'tile_breakable_sheet_7x64.png');
  for (let i = 0; i < CHAMPION_AURA_FRAME_COUNT; i++) {
    const key = String(i).padStart(2, '0');
    load('championAura', key, `champion_aura_${key}.png`);
  }
  // Spinnenboss (Nutzergrafik): body_t_spider/turret_t_spider laufen schon
  // ueber die TANK_TYPES-Schleife oben mit. 'leg' hat den Gelenkpunkt am
  // LINKEN Bildrand (statt Bildmitte wie bei body/turret) -- spiderrender.js
  // rotiert/skaliert es wie einen Zeiger vom Gelenk zum Fuss, s. dortiger
  // Kommentar.
  load('spider', 'leg', 'spider_leg.png');
  load('spider', 'mineBody', 'body_spider_mine.png');
  load('spider', 'web', 'spider_web.png');
}

// true, sobald alle Sprites bereit sind (dann Sprite- statt Vektor-Look).
export function spritesReady() {
  return ready;
}

// Panzertypen ohne eigene Grafik borgen sich eine vorhandene Wanne
// (Phase 4: keine neuen Asset-Dateien). Ihre Identitaet traegt das
// Panzerungs-Overlay im Renderer -- dicker Frontbalken bzw. Rautenkranz.
// Phase 14: die drei Bosse borgen sich aus demselben Grund eine Wanne --
// Der Spiegel bekommt den rotierenden Rautenkranz ueber requiresRicochet,
// die Phalanx den Frontbalken ueber armor.arc, beide automatisch aus
// tanks.json, ohne Renderer-Sonderfall. (Aktuell beide Platzhalter-Bosse,
// s. CLAUDE.md -- die Aliase bleiben als Referenz fuer einen Bossneubau.)
const SPRITE_ALIAS = {
  t_armored: 't_grey',
  t_reactor: 't_green',
  t_mirror: 't_teal',
  t_phalanx: 't_grey',
  // Amboss-Auftrag (Abschnitt 17): "existiert noch kein eigenes Sprite ->
  // t_anvil vorlaeufig auf ein vorhandenes dunkles Boss-/Panzerbild aliasen,
  // keine neue Grafik erzeugen" -- t_black ist der naechstliegende dunkle
  // Bestandstyp. Anschlusspunkt fuer eine spaetere echte body_t_anvil.png/
  // turret_t_anvil.png bleibt offen (einfach hier entfernen).
  t_anvil: 't_black',
  // G2 (UMBAUPLAN-GEGNER.md): "keine neuen Asset-Dateien" -- die vier neuen
  // Typen aliasen auf vorhandene Huellen, ihre Identitaet traegt Verhalten +
  // die neuen Telegraphen (Sturmkorridor/Zuendring/Reichweitenring/
  // Ziellinie), kein eigenes Sprite.
  t_rusher: 't_brown',
  t_dud: 't_black',
  t_shotgun: 't_pink',
  t_lance: 't_teal',
  // G3: "helles Gelbgrau" (t_relay) -> t_grey, "dunkles Violettgrau"
  // (t_anchor) -> t_purple -- naechstliegende Bestandsfarben, Identitaet
  // traegt vollstaendig Verhalten + die neuen Marker/Telegraphen.
  t_relay: 't_grey',
  t_anchor: 't_purple',
  // G5: "gedaempftes Weissgruen" (t_medic) -> t_white, "Betongrau"
  // (t_mason) -> t_grey -- naechstliegende Bestandsfarben, gleiches Prinzip.
  t_medic: 't_white',
  t_mason: 't_grey',
  // G6: "olivgruen" (t_marshal) -> t_green, "dunkles Stahlgrau"
  // (t_bulwark) -> t_grey, "dunkelgruen/verborgen" (t_stalker) -> t_black
  // (thematisch: verschwindet im Schatten), "tiefblau" (t_arclight) ->
  // t_teal -- naechstliegende Bestandsfarben, Identitaet traegt vollstaendig
  // Verhalten + die neuen Telegraphen (Fahnenlinien/Frontbalken/Tarnalpha/
  // Blitzbogen), kein eigenes Sprite.
  t_marshal: 't_green',
  t_bulwark: 't_grey',
  t_stalker: 't_black',
  t_arclight: 't_teal',
  // UMBAUPLAN-LP Phase 9: die zehn Klassen teilen sich das Spieler-Sprite --
  // ihre Identitaet traegt (vorerst) die Elementfarbe/der Wert, kein eigenes
  // Asset. 'player' selbst ist die Standard-Klasse und braucht keinen Alias.
  // c_frost/c_flame/c_necro/c_blast haben jetzt EIGENE Sprites (s. TANK_TYPES).
  c_tesla: 'player',
  c_toxic: 'player',
  c_scrap: 'player',
  c_ricochet: 'player',
  c_engineer: 'player',
};

// Einzelnes Sprite, oder null wenn (noch) nicht ladbar.
export function sprite(cat, key) {
  const img = SPRITES[cat][SPRITE_ALIAS[key] || key];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

// Champion-Aura-Frame nach Index (wraparound, falls je ein Index ausserhalb
// 0..11 hereinkommt) -- oder null, solange (noch) nicht geladen.
export function championAuraFrame(index) {
  const key = String(((index % CHAMPION_AURA_FRAME_COUNT) + CHAMPION_AURA_FRAME_COUNT) % CHAMPION_AURA_FRAME_COUNT).padStart(2, '0');
  const img = SPRITES.championAura[key];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}
