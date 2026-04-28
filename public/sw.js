const CACHE_VERSION = 'ce-pwa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const DEFAULT_NOTIFICATION_URL = '/habitos';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/pwa-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve();
        }),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const {request} = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          event.waitUntil(
            caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', responseClone)),
          );
          return response;
        })
        .catch(async () => {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) {
            return cachedIndex;
          }

          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) {
            return offlinePage;
          }

          return new Response('Offline', {
            headers: {'Content-Type': 'text/plain; charset=utf-8'},
            status: 503,
            statusText: 'Service Unavailable',
          });
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          event.waitUntil(
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone)),
          );
        }
        return networkResponse;
      });

      return (
        cachedResponse ||
        fetchPromise.catch(() => cachedResponse || Response.error())
      );
    }),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {body: event.data.text()};
    }
  }

  const title = payload.title || 'Lembrete de hábitos';
  const body = payload.body || 'Abra Hábitos e faça o check-in de hoje.';
  const url = payload.url || DEFAULT_NOTIFICATION_URL;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-icon.svg',
      badge: '/pwa-icon.svg',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || DEFAULT_NOTIFICATION_URL;

  event.waitUntil(
    clients.matchAll({type: 'window', includeUncontrolled: true}).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client && client.url.includes(targetUrl)) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
