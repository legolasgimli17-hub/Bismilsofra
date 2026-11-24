/* Cache only approved static assets and the impersonal offline fallback. */
const CACHE_PREFIX = 'bismil-sofra-static-';
const CACHE = CACHE_PREFIX + 'v10';
const OFFLINE = '/offline.html';
const STATIC = ['/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest', OFFLINE];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(STATIC))
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
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const offline = await caches.match(OFFLINE, {cacheName: CACHE});
      return offline || Response.error();
    }));
    return;
  }

  if (STATIC.includes(url.pathname)) {
    event.respondWith(caches.match(request, {cacheName: CACHE})
      .then(hit => hit || fetch(request)));
  }
});
