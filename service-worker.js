/* service-worker.js — safe, no-loop, cache-busted by query (?v=...) */

/** Bump this when you deploy **/
const SW_VERSION = '2025-10-23-5';
const CACHE_PREFIX = 'prompter';
const CACHE_STATIC = `${CACHE_PREFIX}-static-${SW_VERSION}`;

const STATIC_ASSETS = [
  // Root shell; keep this small. Do NOT include /en/ or /sl/ HTML here
  // because those are iframe documents that we want to load fresh via ?v=...
  './',
  './index.html',
  './switcher.js',
  './styles.css',       // only if it exists at root
  './icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // IMPORTANT: do NOT call skipWaiting() here — we only activate early on explicit request
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_STATIC)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/**
 * Fetch strategy:
 * - JSON/CSV: network-first (fresh data), fallback to cache
 * - Everything else: stale-while-revalidate (quick + updates silently)
 * - Never use ignoreSearch:true so ?v= works
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== location.origin) return;

  const isData = /\.(json|csv)$/i.test(url.pathname) || /manifest\.json$/i.test(url.pathname);

  if (isData) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_STATIC);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    // only cache successful basic responses
    if (fresh && fresh.ok && fresh.type === 'basic') {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request, { ignoreSearch: false });
  const fetchPromise = fetch(request).then((network) => {
    if (network && network.ok && network.type === 'basic') {
      cache.put(request, network.clone());
    }
    return network;
  }).catch(() => cached || Promise.reject());
  return cached || fetchPromise;
}

/** Allow the page to explicitly apply a waiting SW (no auto-loops) */
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
