import { setAuthTokenGetter } from '@workspace/api-client-react';
import { getMessagingToken } from './firebase';

export const TOKEN_KEY = 'artech_token';

// Set up the API client token getter
setAuthTokenGetter(() => {
  return localStorage.getItem(TOKEN_KEY);
});

export const setAuthToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Called after successful login to register the device's FCM token
 * with the backend. Silently skips if notifications are not supported or denied.
 */
export async function registerPushToken(): Promise<void> {
  try {
    const fcmToken = await getMessagingToken();
    if (!fcmToken) return;

    const authToken = getAuthToken();
    if (!authToken) return;

    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    await fetch(`${apiUrl}/api/my/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: fcmToken }),
    });
  } catch (err) {
    // Non-fatal — the app works fine without push notifications
    console.warn('[FCM] Could not register push token:', err);
  }
}

/**
 * Called on logout to unregister the FCM token so the device stops
 * receiving pushes after the session ends.
 */
export async function unregisterPushToken(fcmToken: string): Promise<void> {
  try {
    const authToken = getAuthToken();
    if (!authToken) return;

    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    await fetch(`${apiUrl}/api/my/push-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: fcmToken }),
    });
  } catch (err) {
    console.warn('[FCM] Could not unregister push token:', err);
  }
}
