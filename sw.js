const CACHE_PREFIX = 'tarumt-study-dashboard-';
const CACHE = CACHE_PREFIX + 'v3';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './schedule.json',
  './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './TAR_UMT_202609_Calendar.ics'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(ASSETS))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() =>
      caches.match(event.request, { ignoreSearch: true })
        .then(cached => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
