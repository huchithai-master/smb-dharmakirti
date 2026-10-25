// Service worker: menyimpan tampilan aplikasi agar cepat dibuka dan tetap tampil saat sinyal lemah.
// Data (/api/) selalu diambil dari server dan tidak disimpan.
const VERSI = 'smbh-v38';
const ASET = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/app.css',
  '/js/app.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/views/auth.js',
  '/js/views/pengajar.js',
  '/js/views/scan.js',
  '/js/views/petugas.js',
  '/js/views/admin.js',
  '/js/views/admin-data.js',
  '/js/views/honor.js',
  '/js/views/laporan.js',
  '/js/views/siswa.js',
  '/js/views/kepala.js',
  '/js/views/impor.js',
  '/vendor/qrcode.js',
  '/vendor/jszip.min.js',
  '/vendor/jsQR.js',
  '/icons/favicon-64.png',
  '/icons/icon-192.png',
  '/icons/logo-smb.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(ASET)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Network-first: versi terbaru dipakai saat online, cache saat offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const salinan = res.clone();
          caches.open(VERSI).then((c) => c.put(e.request, salinan));
        }
        return res;
      })
      .catch(async () => (await caches.match(e.request)) || (e.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())),
  );
});
