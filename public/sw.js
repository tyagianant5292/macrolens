// Service worker. Its main job is to exist: Chrome will not offer "Install app" on Android
// without one that has a fetch handler. The secondary job is making the app open instantly
// from the home screen instead of staring at a black screen on gym wifi.
//
// WHAT IT DELIBERATELY DOES NOT CACHE, and why:
//
//   /api/*        — your food log, your goals, your meals. Cached responses would be served
//                   to whoever opens the app next on that device, and would go stale the
//                   moment you log anything.
//   /api/photos/* — pictures of your meals. Same, but worse.
//   documents     — the HTML carries the signed-in state. A cached page would show a
//                   logged-out shell to a signed-in user, or vice versa.
//
// So it caches exactly one thing: immutable static assets. Next fingerprints everything under
// /_next/static/ with a content hash, so a cached copy can never be wrong — a changed file
// gets a different URL. Icons are cached for the same reason.
//
// If you ever add offline meal logging, do NOT reach for a cache here. Queue the writes
// (IndexedDB + Background Sync) and keep reads on the network.

const CACHE = "macrolens-static-v1";

const isImmutable = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/apple-touch-icon.png");

self.addEventListener("install", (event) => {
  // Take over immediately rather than waiting for every tab to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions of this worker.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isImmutable(url)) return; // straight to the network, untouched

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      // Only store a clean, complete response — caching an opaque or error response would
      // pin a broken asset in place until the cache version is bumped.
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
