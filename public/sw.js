const CACHE = 'wordrun-v1-shell-1';
const BASE = new URL('./', self.location.href);
const ROOT = BASE.href;
const SHELL = [
  ROOT,
  new URL('manifest.webmanifest', BASE).href,
  new URL('apple-touch-icon.png', BASE).href,
  new URL('icons/wordrun-192.png', BASE).href,
  new URL('icons/wordrun-512.png', BASE).href,
  new URL('icons/wordrun-maskable-512.png', BASE).href,
  new URL('ui/wordrun-wordmark.svg', BASE).href
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation is network-first so a returning player gets the latest release
  // whenever connected, while an installed/offline player can still launch.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(ROOT, copy));
          return response;
        })
        .catch(() => caches.match(ROOT))
    );
    return;
  }

  // Same-origin static assets are stale-while-revalidate. Vite's hashed assets
  // remain safe to cache and update naturally when index.html points at a new hash.
  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || refresh;
    })
  );
});
