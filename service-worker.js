  <!-- =========================
       FILE: service-worker.js
       (Create this file at project root)
       ========================= -->
  <!--
  const VERSION = 'pmatch-v1.0.0';
  const CORE_ASSETS = [
    new URL('./', self.location).pathname,
    new URL('./index.html', self.location).pathname,
    new URL('./manifest.webmanifest', self.location).pathname,
    new URL('./icons/icon-192.png', self.location).pathname,
    new URL('./icons/icon-512.png', self.location).pathname,
    new URL('./icons/icon-512-maskable.png', self.location).pathname,
  ];

  self.addEventListener('install', event => {
    event.waitUntil((async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(CORE_ASSETS);
      await self.skipWaiting();
    })());
  });

  self.addEventListener('activate', event => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
      await self.clients.claim();
    })());
  });

  // network handler: offline-first for core; stale-while-revalidate for others
  self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    // SPA nav requests → serve cached index.html
    if (req.mode === 'navigate') {
      event.respondWith((async () => {
        const cache = await caches.open(VERSION);
        const cached = await cache.match(new URL('./index.html', self.location).pathname);
        try {
          const fresh = await fetch(req);
          cache.put(new URL('./index.html', self.location).pathname, fresh.clone());
          return fresh;
        } catch (err) {
          return cached || new Response('<h1>Offline</h1>', {headers:{'Content-Type':'text/html'}});
        }
      })());
      return;
    }

    // same-origin static assets → try cache, then network
    const url = new URL(req.url);
    if (url.origin === location.origin) {
      event.respondWith((async () => {
        const cache = await caches.open(VERSION);
        const cached = await cache.match(req);
        if (cached) {
          // kick off a background refresh
          fetch(req).then(res => cache.put(req, res.clone())).catch(()=>{});
          return cached;
        }
        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          return cached || Response.error();
        }
      })());
    }
  });