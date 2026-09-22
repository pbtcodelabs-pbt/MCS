/* =========================================================
   MAI CITY SHINES — Service Worker
   Cache-first app-shell strategy so the app opens and works
   fully offline once it has been loaded one time.
   Bump CACHE_NAME whenever index.html/sw.js content changes
   so users get the new version instead of a stale cache.
   ========================================================= */

const CACHE_NAME = 'mcs-cache-v7';
/* Font files (fonts/*.ttf) are intentionally NOT in APP_SHELL below —
   they are large (10-13MB each) and would slow down or risk failing the
   very first install. The generic fetch handler further down caches them
   automatically the first time the app actually loads/uses them, so they
   still work offline after that first run. */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

/* ---- Install: pre-cache the app shell ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---- Activate: clean up old cache versions ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---- Fetch: cache-first, fall back to network, then cache the result ----
   This guarantees the app boots even with zero connectivity, while still
   picking up newer files opportunistically when online. */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline and not cached: nothing more we can do

      return cached || networkFetch;
    })
  );
});
