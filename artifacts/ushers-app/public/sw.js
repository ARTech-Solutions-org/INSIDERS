/**
 * sw.js — Unified Service Worker for INSIDERS.
 *
 * Handles PWA App Shell caching ("Add to Home Screen") AND Firebase Cloud Messaging.
 */

// 1. PWA App Shell Caching
const CACHE_NAME = "insiders-shell-v4";
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

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    
    // Determine the URL to open
    let targetUrl = "/";
    if (event.notification.data?.type === "broadcast") {
      targetUrl = "/notifications";
    } else if (event.notification.data?.type === "event_reminder" && event.notification.data?.eventId) {
      targetUrl = `/event/${event.notification.data.eventId}`;
    }

    const urlToOpen = new URL(targetUrl, self.location.origin).href;

    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        // If a window is already open, focus it and navigate
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        
        // If no window is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
  });
}
