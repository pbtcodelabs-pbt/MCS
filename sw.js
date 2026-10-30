/* =========================================================
   MAI CITY SHINES — Service Worker
   Cache-first app-shell strategy so the app opens and works
   fully offline once it has been loaded one time.
   Bump CACHE_NAME whenever index.html/sw.js content changes
   so users get the new version instead of a stale cache.
   ========================================================= */

/* Same version string as index.html's APP_VERSION and the release zip
   filename (MCS+DD+MM+DAYLETTERS+3-digit serial, e.g. MCS1110SU001) — keep these three in sync
   on every release so it's always clear which files go together. */
const CACHE_NAME = 'mcs-cache-MCS3010FR080';
/* MCS2310FR047: فونٹ (10-13MB) الگ مستقل کیش میں — ہر ورژن پر مٹتے نہیں تھے تو ہر اپڈیٹ کے بعد دوبارہ
   ڈاؤن لوڈ ہوتے اور تب تک نوری نستعلیق/کشیدہ نظر نہیں آتا تھا۔ */
const FONT_CACHE = 'mcs-fonts-v1';
const isFontReq = (url) => /\.(ttf|otf|woff2?)$/i.test(url.pathname);
/* Font files (fonts/*.ttf) are intentionally NOT in APP_SHELL below —
   they are large (10-13MB each) and would slow down or risk failing the
   very first install. The generic fetch handler further down caches them
   automatically the first time the app actually loads/uses them, so they
   still work offline after that first run. */
const APP_SHELL = [
  './',
  './index.html',
  './list.html',
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
        keys.filter((key) => (key.startsWith('mcs-cache-') || key.startsWith('mcs-fonts-')) && key !== CACHE_NAME && key !== FONT_CACHE) /* 🛡️ صرف اپنے پرانے کیش */
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
                  url.hostname === 'fonts.gstatic.com' ||
                  /* MCS11OCTSU0913AM: بورڈ اسکین والی پڑھائی کی فائلیں ایک بار آ کر فون میں رہیں */
                  url.hostname === 'cdn.jsdelivr.net';
  if (!allowed) return;

  if (isFontReq(url)) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(event.request).then((hit) => hit || fetch(event.request).then((response) => {
          if (response && response.status === 200) cache.put(event.request, response.clone());
          return response;
        }))
      )
    );
    return;
  }

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
