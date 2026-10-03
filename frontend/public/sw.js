/* App service worker: offline shell + push.
 *
 * Plain browser JS, served from /public as-is — it is not bundled, so no
 * imports, no TypeScript, and no import.meta.env in here.
 *
 * Two jobs:
 *   1. Make the app installable and start offline. The HTML shell is
 *      network-first (a deploy is picked up on the next load, never pinned to a
 *      stale build); Vite's hashed /assets/* are cache-first because a hashed
 *      URL never changes content.
 *   2. Push — the case the socket cannot cover: the tab is closed, so there is
 *      no app running to show an in-app toast. Everything it renders comes from
 *      the push payload; it never calls the API.
 *
 * The API is never cached. /api/* and /socket.io/* go straight to the network:
 * they carry the session cookie, and serving a cached balance would be worse
 * than an honest network error.
 */

// Bump CACHE_VERSION only when the caching strategy itself changes; app deploys
// don't need it (see the shell strategy above).
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE, STATIC_CACHE];

// Every route is a client-side route rewritten to index.html, so one cached
// copy under '/' serves any navigation when offline.
const SHELL_URL = '/';
const STATIC_PRECACHE = [
  '/manifest.webmanifest',
  '/mini-logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
// Old hashed bundles pile up across deploys; keep the newest N.
const MAX_ASSET_ENTRIES = 120;
const STATIC_FILE = /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|webmanifest)$/i;

/**
 * Caches the shell and the bundles it references, so the very first install is
 * already offline-capable — the page that registered us loaded those bundles
 * before we existed, so we would otherwise only see them on the next visit.
 */
async function precacheShell() {
  const shell = await caches.open(SHELL_CACHE);
  const res = await fetch(SHELL_URL, { cache: 'no-cache' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await shell.put(SHELL_URL, res);

  const assetUrls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  if (assetUrls.length) {
    const assets = await caches.open(ASSET_CACHE);
    await assets.addAll(assetUrls);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // A failed shell precache must not fail the install — push still works,
      // and the shell is re-cached on the next successful navigation.
      precacheShell().catch(() => {}),
      caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_PRECACHE)).catch(() => {}),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  // keys() is in insertion order, so the oldest bundles go first.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function networkFirstShell(event) {
  try {
    const res = await fetch(event.request);
    const type = res.headers.get('content-type') || '';
    if (res.ok && type.includes('text/html')) {
      const copy = res.clone();
      event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put(SHELL_URL, copy)));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(event, cacheName) {
  const cached = await caches.match(event.request, { cacheName });
  if (cached) return cached;
  const res = await fetch(event.request);
  if (res.ok) {
    const copy = res.clone();
    event.waitUntil(
      caches
        .open(cacheName)
        .then((c) => c.put(event.request, copy))
        .then(() => trimCache(cacheName, MAX_ASSET_ENTRIES))
    );
  }
  return res;
}

async function staleWhileRevalidate(event, cacheName) {
  const cached = await caches.match(event.request, { cacheName });
  const network = fetch(event.request).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(event.request, copy));
    }
    return res;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Cross-origin (Razorpay, Google sign-in, analytics) is not ours to cache.
  if (url.origin !== self.location.origin) return;
  // Checked before navigations: the OAuth start/callback are top-level
  // navigations to /api and must reach the server untouched.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(event));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event, ASSET_CACHE));
  } else if (STATIC_FILE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, STATIC_CACHE));
  }
  // Anything else (incl. Vite dev-server modules) falls through to the network.
});

/* ── Push ─────────────────────────────────────────────────────────────── */

const DEFAULT_TITLE = 'Arkalyn Kitty';
const NOTIFICATION_ICON = '/mini-logo.png';
const FALLBACK_URL = '/notifications';

/**
 * A push can legitimately arrive with no body, and `event.data.json()` throws on
 * malformed JSON — either would reject the handler and, because the
 * subscription is userVisibleOnly, cost us a browser-generated "site updated in
 * the background" notice instead of ours.
 */
function readPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const data = readPayload(event);

  event.waitUntil(
    self.registration.showNotification(data.title || DEFAULT_TITLE, {
      body: data.body || 'You have a new notification',
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      // Collapses repeat notifications from the same group rather than stacking
      // one per event; the server sets this per group.
      tag: data.tag,
      // With a tag set, renotify tells the OS to alert again on replacement
      // instead of swapping the banner silently.
      renotify: Boolean(data.tag),
      data: { url: data.url || FALLBACK_URL },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || FALLBACK_URL;

  // Prefer an open tab over a new window: openWindow unconditionally would
  // leave the user with a second copy of the app while the first sits behind
  // it. Only same-origin clients are ours to focus.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).origin !== self.location.origin) continue;
          if ('focus' in client) {
            // navigate() is not implemented everywhere; focusing is the part
            // that must not be lost if it is missing.
            if ('navigate' in client) client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
