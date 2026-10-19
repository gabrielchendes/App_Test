// Service Worker PWA
const CACHE_NAME = 'pwa-app-cache-v3';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/favicon.svg'
];

const MEDIA_EXTENSIONS = /\.(mp4|webm|mov|m4v|mp3|m4a|ogg|wav)$/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset fetch warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && !key.startsWith('firebase-')) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Só intercepta GET.
  if (request.method !== 'GET') return;

  // Não intercepta requisições Range (o navegador negocia direto com o servidor).
  if (request.headers.has('range')) return;

  // Não intercepta vídeo e áudio.
  if (request.destination === 'video' || request.destination === 'audio') return;

  // Não intercepta recursos de outros domínios (Cloudflare R2, Google Fonts, analytics etc.).
  if (url.origin !== self.location.origin) return;

  // Não intercepta arquivos de mídia do próprio domínio.
  if (MEDIA_EXTENSIONS.test(url.pathname)) return;

  // Ignora endpoints e recursos de desenvolvimento.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@fs') ||
    url.pathname.startsWith('/@id') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('hot-update')
  ) {
    return;
  }

  // Network-first para navegação e páginas HTML.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match('/index.html')) ||
            Response.error()
          );
        })
    );
    return;
  }

  // Network-first para manifesto e ícones (mudanças no painel admin aparecem na hora).
  if (
    url.pathname.includes('/manifest.json') ||
    url.pathname.includes('/manifest.webmanifest') ||
    url.pathname.includes('/icon-') ||
    url.pathname.includes('/apple-touch-icon') ||
    url.pathname.includes('/favicon.')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || Response.error())
    );
    return;
  }

  // Stale-while-revalidate para os demais recursos do próprio domínio.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cachedResponse || Response.error());

      return cachedResponse || fetchPromise;
    })
  );
});