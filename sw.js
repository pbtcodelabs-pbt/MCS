/* =========================================================
   MAI CITY SHINES — Service Worker
   Cache-first app-shell strategy so the app opens and works
   fully offline once it has been loaded one time.
   Bump CACHE_NAME whenever index.html/sw.js content changes
   so users get the new version instead of a stale cache.
   ========================================================= */

/* Same version string as index.html's APP_VERSION and the release zip
   filename (MCS+DDMON+DAYLETTERS+HHMMAM/PM) — keep these three in sync
   on every release so it's always clear which files go together. */
const CACHE_NAME = 'mcs-cache-MCS510MO008';
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
      /* MCS29SEPTU0352AM: cache:'reload' — براؤزر کی پرانی کاپی کے بجائے سرور سے تازہ فائل لے،
         ورنہ نئے ورژن کے کیش میں پرانی index.html محفوظ ہو سکتی تھی۔ */
      .then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
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

  /* MCS29SEPTU0352AM: صرف اپنی سائٹ کی فائلیں اور گوگل کے فونٹ/فائربیس SDK کیش ہوں۔
     فائربیس کے لائیو ڈیٹا (firestore.googleapis.com)، واٹس ایپ وغیرہ کو ہاتھ نہ لگائیں —
     پہلے یہ بھی کیش ہو رہے تھے جس سے میموری بھرتی اور sync میں رکاوٹ کا خطرہ تھا۔ */
  const url = new URL(event.request.url);
  const allowed = url.origin === self.location.origin ||
                  url.hostname === 'www.gstatic.com' ||
                  url.hostname === 'fonts.googleapis.com' ||
                  url.hostname === 'fonts.gstatic.com';
  if (!allowed) return;

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
