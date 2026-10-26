const CACHE_NAME = 'proyecta-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => {}) // si algún asset falla, no truena la instalación
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Los datos en vivo (Supabase) y cualquier otro dominio NO se cachean aquí:
  // van directo a la red para que feed y directorio siempre sean los actuales.
  if (url.origin !== self.location.origin || req.method !== 'GET') return;

  // La página (index.html): primero la red, así cada actualización llega
  // a la primera. Si no hay internet, se abre la última copia guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      // cache: 'no-cache' obliga a revisar con GitHub si hay versión nueva
      // (si no, el navegador puede reutilizar su copia hasta ~10 minutos).
      fetch(req, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Lo demás (íconos, manifest, imágenes): primero lo guardado, y se refresca en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
