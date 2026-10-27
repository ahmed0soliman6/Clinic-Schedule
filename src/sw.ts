/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import firebaseAppletConfig from '../firebase-applet-config.json';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache Google Fonts stylesheets & font files
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    firebaseAppletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    firebaseAppletConfig.messagingSenderId,
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    firebaseAppletConfig.appId ||
    '1:771790865724:web:a9ca5db6f5e3a2de440a39',
};

try {
  const swFirebaseApp = initializeApp(firebaseConfig);
  const messaging = getMessaging(swFirebaseApp);

  // Handle data-only FCM messages in the background
  onBackgroundMessage(messaging, (payload) => {
    const data = payload.data || {};
    const title =
      data.title ||
      payload.notification?.title ||
      'تذكير جدول العيادات — مجمع ميت عزون الطبي';
    const body =
      data.body ||
      payload.notification?.body ||
      'يرجى مراجعة وتجهيز جدول العيادات ومشاركته.';
    const url = data.url || '/';

    return self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'clinic-schedule-daily-reminder',
      data: { url },
    });
  });
} catch {
  // Ignore initialization errors in unsupported contexts
}

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const rawUrl =
    (event.notification.data &&
      typeof event.notification.data.url === 'string' &&
      event.notification.data.url) ||
    '/';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if (
            client.url.startsWith(self.location.origin) &&
            'focus' in client
          ) {
            const windowClient = client as WindowClient;
            if ('navigate' in windowClient) {
              try {
                await windowClient.navigate(targetUrl);
              } catch {
                // Fallback to postMessage if navigate is restricted
              }
            }
            windowClient.postMessage({
              type: 'NOTIFICATION_CLICK_NAVIGATE',
              url: rawUrl,
            });
            return windowClient.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
