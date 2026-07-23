// Service Worker: cached beim ersten Besuch alle Spieldateien, danach
// laeuft PANZERKNACKER komplett offline (Flugmodus). Cache-first mit
// Netz-Fallback; neue Versionen ueber den CACHE-Namen ausrollen.

const CACHE = 'panzerknacker-v31';

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
  'src/config.js',
  'src/main.js',
  'src/core/audio.js',
  'src/core/telemetry.js',
  'src/core/input.js',
  'src/core/loop.js',
  'src/core/rng.js',
  'src/core/storage.js',
  'src/game/ai.js',
  'src/game/cfg.js',
  'src/game/ai_drives.js',
  'src/game/ai_turrets.js',
  'src/game/bullet.js',
  'src/game/collision.js',
  'src/game/generator.js',
  'src/game/mine.js',
  'src/game/run.js',
  'src/game/upgradepool.js',
  'src/game/state.js',
  'src/game/tank.js',
  'src/game/trap.js',
  'src/render/debug.js',
  'src/render/effects.js',
  'src/render/renderer.js',
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
  'assets/sprites/tile_floor.png',
  'assets/sprites/tile_wall.png',
  'assets/sprites/tile_breakable.png',
  'assets/sprites/tile_hole.png',
  'assets/sprites/bullet_normal.png',
  'assets/sprites/bullet_rocket.png',
  'assets/sprites/bullet_bounce.png',
  'assets/sprites/bullet_tungsten.png',
  'assets/sprites/bullet_explosive.png',
  'src/ui/hud.js',
  'src/ui/pause.js',
  'src/ui/preview.js',
  'src/ui/touchcontrols.js',
  'src/ui/upgradescreen.js',
  'src/ui/roomscreens.js',
];

// WICHTIG: KEIN skipWaiting() und KEIN clients.claim().
// Beides zusammen (oder einzeln mit Alt-Cache-Loeschung) kann eine bereits
// mit alter Version geladene Seite dazu bringen, mitten im Start neue
// Dateien nachzuladen -> alter Code + neue data/*.json = kaputte Auswahl
// (z. B. Upgrade-Screen zeigt nur "+1 Leben"). Ohne die beiden behaelt jede
// laufende Seite bis zum vollstaendigen Schliessen ihre konsistente Version;
// die neue Version greift beim naechsten frischen Start (Tab/App schliessen
// und neu oeffnen).
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  // Alte Caches erst hier loeschen -- der activate-Handler laeuft (ohne
  // skipWaiting) erst, wenn keine Seite mehr die alte Version nutzt.
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          // Erfolgreiche Antworten nachcachen (z. B. nach Updates).
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        }),
    ),
  );
});
