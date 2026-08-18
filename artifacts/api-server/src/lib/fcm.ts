import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { db, usherPushTokensTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

/**
 * Firebase Admin SDK singleton.
 *
 * Credentials are read from the FIREBASE_SERVICE_ACCOUNT_JSON environment
 * variable, which must contain the full service-account JSON string.
 *
 * TODO: Set FIREBASE_SERVICE_ACCOUNT_JSON in your .env (api-server) and on
 *       Vercel's environment-variable settings.
 */

let _app: App | null = null;
let _messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  if (_messaging) return _messaging;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn("[FCM] FIREBASE_SERVICE_ACCOUNT_JSON is not set. Push notifications are disabled.");
    return null;
  }

  try {
    const credential = JSON.parse(raw);
    
    // Vercel environment variables often escape \n as literal string "\\n"
    if (credential.private_key && credential.private_key.includes('\\n')) {
      credential.private_key = credential.private_key.replace(/\\n/g, '\n');
    }

    if (!_app) {
      _app = getApps().length === 0
        ? initializeApp({ credential: cert(credential) })
        : getApps()[0];
    }
    _messaging = getMessaging(_app);
    return _messaging;
  } catch (err) {
    console.error("[FCM] Failed to initialise Firebase Admin SDK:", err);
    return null;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  /** Optional extra data forwarded to the service worker */
  data?: Record<string, string>;
}

/**
 * Sends a push notification to all registered FCM tokens for a given usher.
 * Invalid / expired tokens are automatically removed from the database.
 */
export async function sendPushToUsher(usherId: number, payload: PushPayload): Promise<void> {
  const messaging = getFirebaseMessaging();
  if (!messaging) return;

  // Fetch all stored tokens for this usher
  const rows = await db
    .select({ id: usherPushTokensTable.id, token: usherPushTokensTable.token })
    .from(usherPushTokensTable)
    .where(eq(usherPushTokensTable.usherId, usherId));

  if (rows.length === 0) return;

  const tokens = rows.map((r) => r.token);

  try {
    const baseUrl = process.env.FRONTEND_URL || "https://insider-mu.vercel.app";
    // Target link is handled entirely by the frontend sw.js via notificationclick.
    // We send data so the frontend knows where to navigate.
    
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      webpush: {
        notification: { title: payload.title, body: payload.body, icon: "/insiders-logo.png" },
      },
    });

    // Collect tokens that FCM reports as invalid / unregistered
    const invalidIds: number[] = [];
    response.responses.forEach((r, idx) => {
      if (!r.success && r.error) {
        const code = (r.error as any).code as string | undefined;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalidIds.push(rows[idx].id);
        }
      }
    });

    if (invalidIds.length > 0) {
      await db.delete(usherPushTokensTable).where(inArray(usherPushTokensTable.id, invalidIds));
    }
  } catch (err) {
    console.error("[FCM] sendEachForMulticast error:", err);
  }
}

/**
 * Sends a push notification to multiple ushers at once.
 * This is a convenience wrapper that runs sendPushToUsher in parallel.
 */
export async function sendPushToUshers(usherIds: number[], payload: PushPayload): Promise<void> {
  await Promise.all(usherIds.map((id) => sendPushToUsher(id, payload)));
}
