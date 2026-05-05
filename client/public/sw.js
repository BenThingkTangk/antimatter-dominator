/**
 * ATOM service worker — minimal offline shell + cache-first for static
 * assets. Network-first for everything else (API + HTML).
 */
const VERSION = "atom-mobile-v1";
const STATIC_CACHE = `atom-static-${VERSION}`;

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("atom-") && k !== STATIC_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache API responses
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first for hashed Vite assets
  if (url.pathname.startsWith("/assets/") || /\.(?:png|svg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Network-first for HTML; fall back to root shell
  if (req.mode === "navigate" || (req.headers.get("Accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((c) => c || caches.match(req)))
    );
  }
});
