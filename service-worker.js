/* service-worker.js */
const VERSION = 'v1.3.7';
const STATIC_CACHE = `pmatch-static-${VERSION}`;
const RUNTIME_CACHE = `pmatch-runtime-${VERSION}`;

/** Build absolute URLs from the SW scope (GitHub Pages safe) */
const BASE = self.registration.scope; // e.g., https://user.github.io/repo/
const ABS = (p) => new URL(p, BASE).toString();

/** App shell to pre-cache (keep small) */
const PRECACHE_ASSETS = [
  ABS(''),                      // folder URL (GH Pages "index")
  ABS('index.html'),
  ABS('styles.css'),
  ABS('app.js'),
  ABS('manifest.webmanifest'),
  ABS('icons/icon-192.png'),
  ABS('icons/icon-512.png'),
];

/** Install: pre-cache app shell */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/** Activate: clean old caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('pmatch-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/** Fetch strategies:
 * - Documents: NetworkFirst (fallback to cache)
 * - Static assets (script/style/image/font/manifest): CacheFirst
 * - Provided lists (nouns/manifest.json & nouns/*.csv): Stale-While-Revalidate
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET is cacheable
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle same-origin requests (skip CDNs/external)
  if (url.origin !== self.location.origin) return;

  const dest = req.destination;

  // Provided lists: nouns manifest + CSVs
  const isProvidedJSON = url.pathname.endsWith('/nouns/manifest.json');
  const isProvidedCSV = url.pathname.startsWith(new URL('nouns/', BASE).pathname) && url.pathname.endsWith('.csv');

  if (isProvidedJSON || isProvidedCSV) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Documents (HTML)
  if (dest === 'document' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Static assets
  if (['script', 'style', 'image', 'font', 'manifest'].includes(dest)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Default: try network, fall back to cache
  event.respondWith(networkFirst(req));
});

/* ------- Strategies ------- */
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreVary: true, ignoreSearch: true });
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkFirst(request) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(request);
    // Cache successful navigations and HTML
    if (res && res.ok && (request.destination === 'document' || isHTMLResponse(res))) {
      runtime.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await runtime.match(request) || await caches.match(request);
    // Fallback to cached index.html for navigation if available
    if (!cached && request.mode === 'navigate') {
      const shell = await caches.match(ABS('index.html'));
      if (shell) return shell;
    }
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const runtime = await caches.open(RUNTIME_CACHE);
  const cachedPromise = runtime.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) runtime.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  const cached = await cachedPromise;
  if (cached) {
    // Kick off network update but return cached immediately
    eventWaitUntil(networkPromise);
    return cached;
  }
  // No cache—use network result
  const res = await networkPromise;
  return res || Response.error();
}

/* Helpers */
function isHTMLResponse(res) {
  const ctype = res.headers.get('content-type') || '';
  return ctype.includes('text/html');
}

/** Allow pages to trigger skipWaiting (optional) */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/** In SW, event.waitUntil is only available in handlers; provide a safe no-op outside */
function eventWaitUntil(promise) {
  // Best-effort: no-op if not in a fetch event context.
  try { self.addEventListener('dummy', () => {}); } catch (e) {}
  // There’s no global waitUntil, but we can still run the promise in background.
}
