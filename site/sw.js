/* Service worker: makes ʻIobot open instantly and keep working offline.
 *
 *   The app itself (HTML, CSS, JS, fonts, icons) is saved as one versioned set
 *   and served from that set, so it opens instantly even on slow school Wi-Fi
 *   and never mixes old and new files.
 *
 *   Updates: GitHub Actions stamps VERSION below with a fingerprint of the
 *   app's files on every deploy. When the code changes, this file changes, so
 *   browsers install the new version, download a fresh set (skipping their
 *   own HTTP cache), take over open pages, and app.js reloads them once.
 *
 *   Data (data/*.json) comes from the network first, so it's always current.
 *   If the network fails, the last saved copy is used, with a header that
 *   tells data.js to show the small "Offline" tag. The countdown keeps running
 *   from that saved schedule.
 *
 * Locally, VERSION stays 'dev'; that's fine for testing.
 */

const VERSION = 'dev';
const SHELL_CACHE = `iobot-shell-${VERSION}`;
const DATA_CACHE = 'iobot-data';

// Everything the app needs to start with no network. tests/test_offline.py
// checks that every file in site/js, site/css and site/fonts is listed here.
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/base.css',
  'css/today.css',
  'css/views.css',
  'js/alerts.js',
  'js/app.js',
  'js/countdown.js',
  'js/data.js',
  'js/dom.js',
  'js/format.js',
  'js/import-classes.js',
  'js/schedule.js',
  'js/search-clubs.js',
  'js/search-date.js',
  'js/search-text.js',
  'js/store.js',
  'js/time.js',
  'js/views/calendar.js',
  'js/views/club.js',
  'js/views/clubs.js',
  'js/views/day-parts.js',
  'js/views/daybar.js',
  'js/views/day.js',
  'js/views/grade.js',
  'js/views/me-extras.js',
  'js/views/me.js',
  'js/views/now.js',
  'js/views/search.js',
  'js/views/timeline.js',
  'js/views/today-extras.js',
  'js/views/today.js',
  'fonts/barlow-condensed-600.woff2',
  'fonts/barlow-condensed-700.woff2',
  'fonts/source-sans-3-latin.woff2',
  'fonts/source-sans-3-hawaiian.woff2',
  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache, so the new set is really new.
  const fresh = SHELL.map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/data/')) {
    event.respondWith(networkFirst(event.request, url));
  } else {
    event.respondWith(cacheFirst(event, url));
  }
});

async function networkFirst(request, url) {
  // The page adds ?t=<time> to dodge other caches; save under the plain address.
  const key = url.origin + url.pathname;
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch (err) {
    const saved = await cache.match(key);
    if (!saved) return new Response('Offline and no saved copy', { status: 503, statusText: 'Offline' });
    const headers = new Headers(saved.headers);
    headers.set('X-Iobot-Offline', '1');
    return new Response(await saved.blob(), { status: 200, headers });
  }
}

async function cacheFirst(event, url) {
  const cache = await caches.open(SHELL_CACHE);
  // Opening the app (with or without ?date= demo settings) always means index.html.
  const scope = new URL(self.registration.scope).pathname;
  const isApp = event.request.mode === 'navigate' && (url.pathname === scope || url.pathname === `${scope}index.html`);
  const key = isApp ? 'index.html' : event.request;
  const cached = await cache.match(key, { ignoreSearch: isApp });
  if (cached) return cached;
  // Not in the saved set (a 404 page, a new icon): ask the server, revalidating.
  return fetch(event.request.url, { cache: 'no-cache' });
}
