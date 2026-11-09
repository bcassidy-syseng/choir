/* Choir service worker: one cache for the front page and both features.
 * App files: network first (a new version shows on the next open), with the
 * last copy kept for offline use. Commander art and fonts: cache first.
 * Calls to the Google Apps Script servers are POSTs and are never cached. */
const APP_CACHE = 'choir-app-v7';
const ART_CACHE = 'choir-art-v3';
const APP_FILES = [
  './', './index.html', './choir.js', './privacy.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/splash.png',
  './grimoire/', './grimoire/index.html', './grimoire/engine.js',
  './magiccon/', './magiccon/index.html'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_FILES)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== APP_CACHE && k !== ART_CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  const isArt = /(^|\.)scryfall\.(io|com)$/.test(url.hostname) || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (isArt) {
    event.respondWith(caches.open(ART_CACHE).then(async cache => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        cache.put(request, response.clone());
        trimArt(cache);
      }
      return response;
    }));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(response => {
          if (response.ok) { const copy = response.clone(); caches.open(APP_CACHE).then(cache => cache.put(request, copy)); }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then(hit => {
          if (hit) return hit;
          // Offline and never cached: open that section's page, or the front page.
          const section = /\/(grimoire|magiccon)\//.exec(url.pathname);
          return caches.match(section ? './' + section[1] + '/index.html' : './index.html');
        }))
    );
  }
});

async function trimArt(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - 300; i++) await cache.delete(keys[i]);
}
