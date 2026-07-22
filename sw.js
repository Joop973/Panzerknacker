// Service Worker: cached beim ersten Besuch alle Spieldateien, danach
// laeuft PANZERKNACKER komplett offline (Flugmodus). Cache-first mit
// Netz-Fallback; neue Versionen ueber den CACHE-Namen ausrollen.

const CACHE = 'panzerknacker-v22';

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
  'src/config.js',
  'src/main.js',
  'src/core/audio.js',
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
  'src/game/state.js',
  'src/game/tank.js',
  'src/game/trap.js',
  'src/render/debug.js',
  'src/render/effects.js',
  'src/render/renderer.js',
  'src/render/tracks.js',
  'src/ui/hud.js',
  'src/ui/pause.js',
  'src/ui/preview.js',
  'src/ui/touchcontrols.js',
  'src/ui/upgradescreen.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
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
