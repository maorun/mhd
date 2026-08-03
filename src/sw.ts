/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'mhd-cache-v1';
const DATA_CACHE = 'mhd-data-v1';
// self.__WB_MANIFEST is replaced by workbox-build with the list of precached assets
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRECACHE_MANIFEST = (self as any).__WB_MANIFEST as Array<{ url: string; revision: string | null }> ?? [];
const STATIC_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];
const ASSETS_TO_CACHE = [
  ...STATIC_ASSETS,
  ...PRECACHE_MANIFEST.map((e) => e.url),
];

// Mirrors src/types.ts – kept here so the SW bundle stays self-contained
interface Product {
  id: string;
  name: string;
  expiryDate: string;
  notifyDaysBefore: number;
  notified: boolean;
}

function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + 'T00:00:00');
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keepCaches = [CACHE_NAME, DATA_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keepCaches.includes(k)).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first for navigation, cache-first for assets
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then((r) => r ?? new Response('Offline', { status: 503 })),
      ),
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ?? fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        }),
      ),
    );
  }
});

/**
 * Reads the product list from Cache Storage, sends due notifications via the
 * Service Worker registration (works even when the app window is closed), and
 * persists the newly-notified IDs back to the cache so the app can sync state
 * when it next opens.
 */
async function checkExpiringProducts(): Promise<void> {
  const cache = await caches.open(DATA_CACHE);

  const productsResponse = await cache.match('/mhd-data');
  if (!productsResponse) return;
  const products: Product[] = await productsResponse.json() as Product[];

  const notifiedResponse = await cache.match('/mhd-notified');
  const swNotifiedIds: string[] = notifiedResponse ? (await notifiedResponse.json() as string[]) : [];

  const newlyNotified: string[] = [];

  for (const product of products) {
    if (product.notified || swNotifiedIds.includes(product.id)) continue;
    const daysLeft = getDaysUntilExpiry(product.expiryDate);
    if (daysLeft > product.notifyDaysBefore) continue;

    const title =
      daysLeft <= 0
        ? `⚠️ MHD abgelaufen: ${product.name}`
        : `🔔 MHD bald erreicht: ${product.name}`;
    const body =
      daysLeft <= 0
        ? `Das MHD von "${product.name}" ist abgelaufen!`
        : daysLeft === 1
          ? `Das MHD von "${product.name}" läuft morgen ab.`
          : `Das MHD von "${product.name}" läuft in ${daysLeft} Tagen ab.`;

    await self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: product.id,
    });

    newlyNotified.push(product.id);
  }

  if (newlyNotified.length > 0) {
    const updatedIds = [...swNotifiedIds, ...newlyNotified];
    await cache.put(
      '/mhd-notified',
      new Response(JSON.stringify(updatedIds), { headers: { 'Content-Type': 'application/json' } }),
    );

    // Tell any open windows to sync the notified state from cache to localStorage
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.postMessage({ type: 'SW_NOTIFIED', ids: newlyNotified }));
  }
}

// Triggered by the Periodic Background Sync API (Chrome/Android)
self.addEventListener('periodicsync', (event) => {
  const syncEvent = event as unknown as { tag: string; waitUntil: (p: Promise<unknown>) => void };
  if (syncEvent.tag === 'check-mhd') {
    syncEvent.waitUntil(checkExpiringProducts());
  }
});

// Triggered manually by the app (e.g. as a fallback when periodicsync is unsupported)
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string })?.type === 'CHECK_MHD') {
    event.waitUntil(checkExpiringProducts());
  }
});

// Focus or open the app when the user taps a notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});
