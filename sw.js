const CACHE_NAME = 'proyecta-v5';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png'
];   // solo lo esencial: los íconos grandes se guardan cuando se piden (no compiten con la red al abrir)

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
  // Con señal débil la red no "falla": se queda colgada. Por eso, si en 4 segundos
  // no respondió, se abre la copia guardada (la versión nueva queda lista para la próxima vez).
  if (req.mode === 'navigate') {
    // cache: 'no-cache' obliga a revisar con GitHub si hay versión nueva
    // (si no, el navegador puede reutilizar su copia hasta ~10 minutos).
    const network = fetch(req, { cache: 'no-cache' }).then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
      }
      return response;
    });
    const slow = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
    const fromCache = () => caches.match(req).then((c) => c || caches.match('./index.html'));
    event.waitUntil(network.catch(() => {}));   // que la descarga termine y se guarde aunque se haya abierto la copia
    event.respondWith(
      Promise.race([network, slow])
        .then((r) => r || fromCache().then((c) => c || network))
        .catch(() => fromCache().then((c) => c || network))
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
