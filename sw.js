const CACHE_NAME = 'nomina-hamb-cache-v1';

function resolveUrl(path) {
  const basePath = self.registration.scope.replace(self.location.origin, '');
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  if (path === '.' || path === './') {
    return normalizedBase;
  }
  return `${normalizedBase}${path}`
    .replace(/\/+/g, '/');
}

const PRECACHE_URLS = [
  './',
  'index.html',
  'css/styles.css',
  'js/script.js',
  'manifest.json',
  'img/Logo.png'
].map(resolveUrl);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
    return;
  }
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        return cached;
      }
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        return response;
      }).catch(() => cached);
    })
  );
});
