// Imported into the generated service worker (see vite.config.js → workbox.importScripts).
// Shows push messages sent via Firebase Cloud Messaging and opens the app when one is tapped.

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { notification: { body: event.data ? event.data.text() : '' } }; }

  const n     = payload.notification || payload.data || {};
  const data  = payload.data || {};
  const title = n.title || 'MiAhorro';

  event.waitUntil(self.registration.showNotification(title, {
    body: n.body || '',
    icon: '/pwa-192x192.png',
    tag:  n.tag || data.tag,
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find(w => 'focus' in w);
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
