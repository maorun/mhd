/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'mhd-cache-v1';
// self.__WB_MANIFEST is replaced by workbox-build with the list of precached assets
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PRECACHE_MANIFEST = (self as any).__WB_MANIFEST as Array<{ url: string; revision: string | null }> ?? [];
const STATIC_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];
const ASSETS_TO_CACHE = [
  ...STATIC_ASSETS,
  ...PRECACHE_MANIFEST.map((e) => e.url),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
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

// Periodic background check – triggered by the app via postMessage
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string })?.type === 'CHECK_MHD') {
    checkExpiringProducts();
  }
});

function checkExpiringProducts(): void {
  // When the app is closed, we can only signal clients via postMessage.
  // Actual notification logic runs in the main app on open.
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: 'CHECK_MHD' }));
  });
}

// Keep the service worker alive for periodic sync if supported
self.addEventListener('periodicsync', (event) => {
  const syncEvent = event as unknown as { tag: string; waitUntil: (p: Promise<unknown>) => void };
  if (syncEvent.tag === 'check-mhd') {
    syncEvent.waitUntil(Promise.resolve(checkExpiringProducts()));
  }
});
