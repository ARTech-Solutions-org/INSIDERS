/**
 * Firebase SDK initialisation for the INSIDERS usher app.
 *
 * All VITE_FIREBASE_* variables must be set in artifacts/ushers-app/.env
 * (and in your Vercel project environment variables for production).
 *
 * TODO: Fill in the values below from your Firebase project settings.
 * Go to Firebase Console → Project Settings → Your apps → Web app → firebaseConfig
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { toast } from "sonner";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? "YOUR_API_KEY",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? "YOUR_AUTH_DOMAIN",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? "YOUR_PROJECT_ID",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "YOUR_MESSAGING_SENDER_ID",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? "YOUR_APP_ID",
};

/** Vapid key from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? "YOUR_VAPID_KEY";

let app: FirebaseApp;
let messagingInstance: Messaging | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

function getFirebaseMessaging(): Messaging | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  if (messagingInstance) return messagingInstance;
  messagingInstance = getMessaging(getFirebaseApp());
  return messagingInstance;
}

/**
 * Requests notification permission and returns the FCM registration token.
 * Returns null if the browser doesn't support notifications or if the user denies.
 */
export async function getMessagingToken(): Promise<string | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    toast.error("المتصفح لا يدعم Service Worker");
    return null;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    toast.error(`Notification permission not granted: ${permission}`);
    return null;
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    toast.error("فشل في تهيئة Firebase Messaging (ربما جهازك لا يدعم الإشعارات)");
    return null;
  }

  try {
    // Pass config as query params so we don't hardcode the API key in the public JS file
    const swUrl = new URL("/sw.js", window.location.origin);
    swUrl.searchParams.set("apiKey", firebaseConfig.apiKey);
    swUrl.searchParams.set("authDomain", firebaseConfig.authDomain);
    swUrl.searchParams.set("projectId", firebaseConfig.projectId);
    swUrl.searchParams.set("storageBucket", firebaseConfig.storageBucket);
    swUrl.searchParams.set("messagingSenderId", firebaseConfig.messagingSenderId);
    swUrl.searchParams.set("appId", firebaseConfig.appId);

    const registration = await navigator.serviceWorker.register(
      swUrl.toString(),
      { scope: "/" }
    );

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (err: any) {
    console.warn("[FCM] Failed to get token:", err);
    toast.error("فشل في الحصول على التوكن: " + (err.message || String(err)));
    return null;
  }
}

/**
 * Listen for foreground messages (tab is open).
 * Calls the provided callback with the message payload.
 */
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};
  const unsubscribe = onMessage(messaging, callback);
  return unsubscribe;
}
