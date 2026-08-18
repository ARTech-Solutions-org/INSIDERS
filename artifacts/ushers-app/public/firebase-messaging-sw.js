/**
 * firebase-messaging-sw.js — Firebase Cloud Messaging background service worker.
 *
 * This file MUST be in the public/ directory so it is served from the root of
 * the domain. Firebase registers it at the scope "/" automatically.
 *
 * IMPORTANT: Replace the firebaseConfig values below with your actual project
 * credentials (these are PUBLIC values — safe to include here).
 * TODO: Paste your firebaseConfig object from Firebase Console → Project Settings.
 */

// Firebase SDK via CDN (compat mode works inside service workers)
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyCUTcdOLIUvFi8RonyeoQUp6QkkXZGvTRc",
  authDomain:        "insider-1.firebaseapp.com",
  projectId:         "insider-1",
  storageBucket:     "insider-1.firebasestorage.app",
  messagingSenderId: "327367158157",
  appId:             "1:327367158157:web:573aec7b320ec05ff375c4",
});

const messaging = firebase.messaging();

/**
 * Handle background messages (tab closed or not focused).
 * The browser will display a native notification automatically when the
 * FCM payload includes a `notification` object. Use this handler for
 * custom logic or to show a notification from a `data`-only payload.
 */
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] Background message received:", payload);

  const title = payload.notification?.title ?? payload.data?.title ?? "INSIDERS";
  const body  = payload.notification?.body  ?? payload.data?.body  ?? "";

  self.registration.showNotification(title, {
    body,
    icon: "/insiders-logo.png",
    badge: "/insiders-logo.png",
    data: payload.data,
  });
});
