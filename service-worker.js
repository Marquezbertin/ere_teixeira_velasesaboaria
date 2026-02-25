const CACHE_NAME = 'erenice-velas-v3';

const ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './css/style.css',
  './js/auth.js',
  './js/app.js',
  './js/db.js',
  './js/utils/helpers.js',
  './js/modules/painel.js',
  './js/modules/fornecedores.js',
  './js/modules/insumos.js',
  './js/modules/receitas.js',
  './js/modules/producao.js',
  './js/modules/produtos.js',
  './js/modules/pedidos.js',
  './js/modules/financeiro.js',
  './js/modules/metas.js',
  './js/modules/perdas.js',
  './js/modules/backup.js',
  './js/modules/relatorios.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
