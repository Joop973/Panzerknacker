// Service Worker: cached beim ersten Besuch alle Spieldateien, danach
// laeuft PANZERKNACKER komplett offline (Flugmodus). Cache-first mit
// Netz-Fallback; neue Versionen ueber den CACHE-Namen ausrollen.

const CACHE = 'panzerknacker-v119';
const PREV_CACHE = 'panzerknacker-v118'; // bleibt fuer eine evtl. offene Alt-Seite intakt

const ASSETS = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'data/difficulty.json',
  'data/tanks.json',
  'data/tiles.json',
  'data/upgrades.json',
  'data/balance.json',
  'data/events.json',
  'data/input.json',
  'data/options.json',
  'data/arenas.json',
  'data/transformations.json',
  'data/secondaries.json',
  'data/modifiers.json',
  'data/limits.json',
  'data/sounds.json',
  'data/status.json',
  'data/upgrades_necro.json',
  'data/glossary.json',
  'src/config.js',
  'src/main.js',
  'src/core/audio.js',
  'src/core/telemetry.js',
  'src/core/input.js',
  'src/core/viewport.js',
  'src/core/loop.js',
  'src/core/rng.js',
  'src/core/storage.js',
  'src/game/ai.js',
  'src/game/armor.js',
  'src/game/bossai.js',
  'src/game/cfg.js',
  'src/game/ai_drives.js',
  'src/game/ai_turrets.js',
  'src/game/bullet.js',
  'src/game/collision.js',
  'src/game/generator.js',
  'src/game/mine.js',
  'src/game/mortar.js',
  'src/game/ghost.js',
  'src/game/necro.js',
  'src/game/run.js',
  'src/game/upgradepool.js',
  'src/game/state.js',
  'src/game/status.js',
  'src/game/damagetypes.js',
  'src/game/tank.js',
  'src/game/trap.js',
  'src/game/spider.js',
  'src/game/spidermine.js',
  'src/render/debug.js',
  'src/render/effects.js',
  'src/render/renderer.js',
  'src/render/spiderrender.js',
  'src/render/sprites.js',
  'src/render/tracks.js',
  // Sprite-Grafiken (Rümpfe + Türme je Panzertyp, Kacheln, Geschosse)
  'assets/sprites/body_player.png',
  'assets/sprites/body_t_brown.png',
  'assets/sprites/body_t_grey.png',
  'assets/sprites/body_t_teal.png',
  'assets/sprites/body_t_yellow.png',
  'assets/sprites/body_t_pink.png',
  'assets/sprites/body_t_green.png',
  'assets/sprites/body_t_purple.png',
  'assets/sprites/body_t_white.png',
  'assets/sprites/body_t_black.png',
  'assets/sprites/body_c_frost.png',
  'assets/sprites/body_c_flame.png',
  'assets/sprites/body_c_necro.png',
  'assets/sprites/body_c_blast.png',
  'assets/sprites/body_ghost.png',
  'assets/sprites/body_champion.png',
  'assets/sprites/champion_aura_00.png',
  'assets/sprites/champion_aura_01.png',
  'assets/sprites/champion_aura_02.png',
  'assets/sprites/champion_aura_03.png',
  'assets/sprites/champion_aura_04.png',
  'assets/sprites/champion_aura_05.png',
  'assets/sprites/champion_aura_06.png',
  'assets/sprites/champion_aura_07.png',
  'assets/sprites/champion_aura_08.png',
  'assets/sprites/champion_aura_09.png',
  'assets/sprites/champion_aura_10.png',
  'assets/sprites/champion_aura_11.png',
  'assets/sprites/turret_player.png',
  'assets/sprites/turret_t_brown.png',
  'assets/sprites/turret_t_grey.png',
  'assets/sprites/turret_t_teal.png',
  'assets/sprites/turret_t_yellow.png',
  'assets/sprites/turret_t_pink.png',
  'assets/sprites/turret_t_green.png',
  'assets/sprites/turret_t_purple.png',
  'assets/sprites/turret_t_white.png',
  'assets/sprites/turret_t_black.png',
  'assets/sprites/turret_c_frost.png',
  'assets/sprites/turret_c_flame.png',
  'assets/sprites/turret_c_necro.png',
  'assets/sprites/turret_c_blast.png',
  'assets/sprites/turret_ghost.png',
  'assets/sprites/turret_champion.png',
  'assets/sprites/tile_floor.png',
  'assets/sprites/tile_wall.png',
  'assets/sprites/tile_breakable.png',
  'assets/sprites/tile_hole.png',
  // Kinderzimmer-Reskin (Nutzergrafik): ganzflaechiger Arena-Hintergrund +
  // zwei Wand-Variantensheets (20 bzw. 7 Bauklotz-Looks je 64x64, horizontal
  // aneinandergereiht). tile_wall.png/tile_breakable.png oben bleiben als
  // Fallback bestehen, falls eines der beiden Sheets fehlt/noch nicht laedt.
  'assets/sprites/arena_kinderzimmer_768x512.png',
  'assets/sprites/tile_wall_sheet_20x64.png',
  'assets/sprites/tile_breakable_sheet_7x64.png',
  'assets/sprites/bullet_normal.png',
  'assets/sprites/bullet_rocket.png',
  'assets/sprites/bullet_bounce.png',
  'assets/sprites/bullet_tungsten.png',
  'assets/sprites/bullet_explosive.png',
  'assets/audio/theme.mp3',
  'src/ui/hud.js',
  'src/ui/menunav.js',
  'src/ui/pause.js',
  'src/ui/preview.js',
  'src/ui/touchcontrols.js',
  'src/ui/upgradescreen.js',
  'src/ui/roomscreens.js',
  'src/ui/mapscreen.js',
  'src/ui/glossary.js',
];

// Strategie (ueberarbeitet): NETWORK-FIRST fuer Code + Daten (HTML/JS/JSON),
// CACHE-FIRST fuer Bilder/Fonts. So erscheinen Updates sofort beim Neuladen
// (online holt eine Seite ALLE Code-/Datendateien frisch -> immer konsistent,
// nie alter Code + neue data/*.json), waehrend das Spiel offline aus dem
// Cache laeuft.
//
// skipWaiting() JA, clients.claim() NEIN: Der neue SW aktiviert sich beim
// naechsten Neuladen (kein Warten aufs vollstaendige App-Schliessen), uebernimmt
// aber NICHT die schon laufende Seite mitten im Start (das war die Skew-Quelle
// der "+1 Leben"-Panne). Alte Caches werden hier bewusst NICHT geloescht: eine
// evtl. noch mit alter Version laufende Seite braucht ihren Cache bis zum
// naechsten Neuladen; ein spaeteres Update raeumt sie auf.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Nur Caches loeschen, die zwei oder mehr Versionen zurueckliegen -- die
  // unmittelbar vorige bleibt fuer eine evtl. noch offene Alt-Seite intakt.
  e.waitUntil(
    caches.keys().then((keys) => {
      const keep = new Set([CACHE, PREV_CACHE]);
      return Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
    }),
  );
});

const isAsset = (url) => /\.(png|jpe?g|gif|webp|svg|ico|woff2?|mp3)$/i.test(url.pathname);

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (isAsset(url)) {
    // Bilder/Fonts: cache-first (gross, stabil, schnell + offline).
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // HTML/JS/JSON: network-first, Cache als Offline-Fallback.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
