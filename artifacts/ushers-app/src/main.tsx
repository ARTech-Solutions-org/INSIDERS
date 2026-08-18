import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';
import { registerPushToken } from './lib/auth';
import './lib/auth';
import App from './App';
import './index.css';

// In production, API calls go to the deployed api-server URL.
// In development, Vite's proxy forwards /api/* to localhost:3000.
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

createRoot(document.getElementById('root')!).render(<App />);

// Register the basic PWA service worker with Firebase config for background notifications
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const swUrl = `/sw.js?apiKey=${import.meta.env.VITE_FIREBASE_API_KEY}&authDomain=${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}&projectId=${import.meta.env.VITE_FIREBASE_PROJECT_ID}&storageBucket=${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}&messagingSenderId=${import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID}&appId=${import.meta.env.VITE_FIREBASE_APP_ID}`;
  
  navigator.serviceWorker.register(swUrl, { scope: '/' })
    .then(() => registerPushToken())
    .catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
}
