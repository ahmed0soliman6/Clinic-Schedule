/* Firebase Cloud Messaging Service Worker for مجمع ميت عزون الطبي */
self.addEventListener('push', function (event) {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      notification: {
        title: 'مجمع ميت عزون الطبي',
        body: event.data ? event.data.text() : 'تم تحديث جدول العيادات',
      },
    };
  }

  const notification = payload.notification || {};
  const title = notification.title || 'مجمع ميت عزون الطبي';
  const options = {
    body:
      notification.body ||
      'تم تحديث مواعيد عيادات مجمع ميت عزون الطبي. اضغط لعرض الجدول.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'ar',
    data: payload.data || { url: '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
