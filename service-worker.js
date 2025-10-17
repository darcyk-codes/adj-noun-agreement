/* service-worker.js — root-safe for GitHub Pages, with sub-app support */
const VERSION = 'v1.4.2';
const STATIC_CACHE  = `pmatch-static-${VERSION}`;
const RUNTIME_CACHE = `pmatch-runtime-${VERSION}`;

/* Resolve repo root even when navigated under /sl/ or /en/ */
const ROOT = self.location.pathname.replace(/\/(sl|en)\/.*/, '');

/** Build absolute URLs from the SW scope (GitHub Pages safe) */
const BASE = self.registration.scope; // e.g., https://user.github.io/repo/
const ABS  = (p) => new URL(p, BASE).toString();

/** App shell to pre-cache (keep small) */
const PRECACHE_ASSETS = [
  // Root shell
  ABS(''),                      // folder URL (GH Pages "index")
  ABS('index.html'),
  ABS('styles.css'),
  ABS('manifest.webmanifest'),
  ABS('icons/icon-192.png'),
  ABS('icons/icon-512.png'),

  // Sub-app entry points (so iframes work offline)
  ABS('sl/'),
  ABS('sl/index.html'),
  ABS('en/'),
  ABS('en/index.html'),

  // JS entry points (leave these even if the root one is absent; cache will skip)
  ABS('app.js'),
  ABS('sl/app.js'),
  ABS('en/app.js'),

  // Shared data index (keep small; CSVs themselves are fetched on demand)
  ABS('nouns/manifest.json'),
];

/* ---------- Install: pre-cache app shell ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activate: clean old caches ---------- */
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

/* ---------- Message: support SKIP_WAITING ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* ---------- Fetch strategies ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url  = new URL(req.url);
  const dest = req.destination;

  // Only handle same-origin requests (skip CDNs/external)
  if (url.origin !== self.location.origin) return;

  // --- Safety shim: if something still requests /sl/nouns/... or /en/nouns/..., redirect to /nouns/... ---
  if (url.pathname.includes('/sl/nouns/') || url.pathname.includes('/en/nouns/')) {
    const rel = (url.pathname.split('/nouns/')[1] || '').replace(/^\/+/, '');
    const fixedURL = ABS(`nouns/${rel}`);
    event.respondWith(networkFirst(new Request(fixedURL, { headers: req.headers, mode: req.mode, credentials: req.credentials })));
    return;
  }

  // 1) HTML/documents -> Network-first (so deploys show quickly)
  const isDoc = req.mode === 'navigate' || dest === 'document' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (isDoc) {
    event.respondWith(networkFirst(req, /*navFallback*/true));
    return;
  }

  // 2) Nouns data (manifest + CSVs) -> Network-first (avoids stale/404)
  const nounsRoot = new URL('nouns/', BASE).pathname; // "/repo/nouns/"
  const isNounsJSON = url.pathname === new URL('nouns/manifest.json', BASE).pathname;
  const isNounsCSV  = url.pathname.startsWith(nounsRoot) && url.pathname.endsWith('.csv');
  if (isNounsJSON || isNounsCSV) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 3) JS/CSS/Icons/Font -> Stale-while-revalidate
  if (['script', 'style', 'image', 'font', 'manifest'].includes(dest)) {
    event.respondWith(staleWhileRevalidate(event, req));
    return;
  }

  // 4) Default -> Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event, req));
});

/* ---------------- Strategy helpers ---------------- */
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

async function networkFirst(request, navFallback = false) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res && res.ok && (request.destination === 'document' || isHTMLResponse(res))) {
      runtime.put(request, res.clone());
    }
    return res;
  } catch (err) {
    // Try runtime, then any cache
    const cached = await runtime.match(request) || await caches.match(request);
    if (cached) return cached;

    // Friendly fallback for navigation into sub-apps
    if (navFallback && request.mode === 'navigate') {
      const p = new URL(request.url).pathname;
      const shell = await caches.open(STATIC_CACHE);
      if (p.includes('/sl/')) {
        const sl = await shell.match(ABS('sl/index.html'));
        if (sl) return sl;
      }
      if (p.includes('/en/')) {
        const en = await shell.match(ABS('en/index.html'));
        if (en) return en;
      }
      const root = await shell.match(ABS('index.html'));
      if (root) return root;
    }
    return Response.error();
  }
}

function staleWhileRevalidate(event, request) {
  return (async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    }).catch(() => null);

    // Refresh in background
    event.waitUntil(network.catch(() => {}));

    return cached || network || fetch(request);
  })();
}

function isHTMLResponse(res) {
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  return ctype.includes('text/html');
}
