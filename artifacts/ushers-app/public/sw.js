/**
 * sw.js — Unified Service Worker for INSIDERS.
 *
 * Handles PWA App Shell caching ("Add to Home Screen") AND Firebase Cloud Messaging.
 */

// 1. PWA App Shell Caching
const CACHE_NAME = "insiders-shell-v1";
const SHELL_ASSETS = ["/", "/insiders-logo.png", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only intercept GET requests for same-origin navigation
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached ?? caches.match("/"))
    )
  );
});

// 2. Firebase Cloud Messaging (FCM)
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

const params = new URL(self.location).searchParams;

if (params.get('apiKey')) {
  firebase.initializeApp({
    apiKey:            params.get('apiKey'),
    authDomain:        params.get('authDomain'),
    projectId:         params.get('projectId'),
    storageBucket:     params.get('storageBucket'),
    messagingSenderId: params.get('messagingSenderId'),
    appId:             params.get('appId'),
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log("[sw.js] Background message received:", payload);
    const title = payload.notification?.title ?? payload.data?.title ?? "INSIDERS";
    const body  = payload.notification?.body  ?? payload.data?.body  ?? "";

    self.registration.showNotification(title, {
      body,
      icon: "/insiders-logo.png",
      badge: "/insiders-logo.png",
      data: payload.data,
    });
  });
}
