import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';
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

// Register the basic PWA service worker (makes the app installable on iOS/Android)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
}
