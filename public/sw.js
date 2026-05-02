const CACHE_VERSION = 'ce-pwa-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const API_CACHE = `${CACHE_VERSION}-api`;
const DEFAULT_NOTIFICATION_URL = '/habitos';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/pwa-icon.svg',
];

// Caminhos GET que respondem stale-while-revalidate (read-only).
// Apenas leitura: nunca cachear POST/PATCH/DELETE.
const API_CACHE_PATTERNS = [
  /\/rest\/v1\/(habits|habit_checkins|tasks|task_checkins|cycles|goals|tactics|weekly_scores|badges|user_badges|notification_log|notification_preferences|messages|profiles|enrollments|turmas|programs)/,
  /\/rest\/v1\/rpc\/(get_team_achievements|get_unread_messages_count|get_roi_access_count_for_user)/,
];

function isApiCacheable(url) {
  return API_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

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
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE && key !== API_CACHE) {
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

  // M11 - Stale-while-revalidate para chamadas read-only ao Supabase REST
  if (url.origin !== self.location.origin && isApiCacheable(url)) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      }),
    );
    return;
  }

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
