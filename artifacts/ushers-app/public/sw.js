/**
 * sw.js — Basic PWA service worker for INSIDERS.
 *
 * This worker makes the site installable ("Add to Home Screen") on iOS Safari
 * and Android Chrome. It caches the app shell on install and serves it from
 * cache when the network is unavailable.
 *
 * Note: FCM background messages are handled by the separate
 * firebase-messaging-sw.js — no need to duplicate that logic here.
 */

const CACHE_NAME = "insiders-shell-v1";

// App shell assets to pre-cache
const SHELL_ASSETS = [
  "/",
  "/insiders-logo.png",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete old caches from previous versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only intercept GET requests for same-origin navigation
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/api/")
  ) return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached ?? caches.match("/"))
    )
  );
});
