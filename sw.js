/* Generated for this deployment. Only public, explicitly listed site files are cached. */
const CACHE_PREFIX = "flowpass-c6949393-";
const CACHE_NAME = "flowpass-c6949393-31c2a951efae0a7c";
const BASE = "/vlad/";
const PRECACHE = ["/vlad/", "/vlad/vpn/iphone/", "/vlad/vpn/android/", "/vlad/smart-routing/", "/vlad/favicon.svg", "/vlad/manifest.webmanifest", "/vlad/offline.html", "/vlad/assets/icons/icon-192.png", "/vlad/assets/icons/icon-512.png", "/vlad/assets/icons/maskable-512.png", "/vlad/assets/icons/apple-touch-icon.png", "/vlad/assets/site.css?v=0a3135edefc5", "/vlad/assets/seo.css?v=0420ef50e229", "/vlad/assets/pwa.css?v=f11a0b5beb15", "/vlad/assets/site.js?v=4292654c3fdf", "/vlad/assets/pwa.js?v=f8d155fa6c8e"];
const PAGES = new Set(["/vlad/", "/vlad/vpn/iphone/", "/vlad/vpn/android/", "/vlad/smart-routing/"]);
const ASSETS = new Set(PRECACHE.filter(path => !PAGES.has(path)));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(PRECACHE.map(path => new Request(path, {cache: 'reload'})))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const path = url.pathname.endsWith('/index.html') ? url.pathname.slice(0, -10) : url.pathname;
      const cache = await caches.open(CACHE_NAME);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(request, {signal: controller.signal});
        // Serve fresh HTML without mixing a newer page with this worker's older
        // asset cache. Each worker precaches one complete release during install.
        return response;
      } catch {
        if (PAGES.has(path)) {
          const saved = await cache.match(path);
          if (saved) return saved;
        }
        const offline = await cache.match(BASE + 'offline.html');
        return new Response(await offline.text(), {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}});
      } finally {
        clearTimeout(timeout);
      }
    })());
  } else if (ASSETS.has(url.pathname + url.search)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache =>
      (await cache.match(request)) || fetch(request)));
  }
});
