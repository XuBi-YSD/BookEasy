/* BookEasy — service worker tối giản (cache-first cho asset tĩnh, cho phép dùng offline
 * sau lần mở đầu tiên). Không có backend nên không cần đồng bộ dữ liệu — dữ liệu vẫn nằm
 * trong localStorage của trình duyệt như bản chạy qua http.server/file:// thông thường. */

var CACHE_NAME = 'bookeasy-cache-v1';

var PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/admin-config.js',
  './js/booking-form.js',
  './js/admin-appointments.js',
  './js/upcoming-reminders.js',
  './js/export-excel.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll fail nếu 1 URL lỗi (vd CDN tạm thời không tới được) — dùng vòng lặp
      // add() riêng lẻ để 1 asset lỗi không chặn cache toàn bộ asset còn lại.
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] Không cache được (bỏ qua):', url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Cache-first, fallback network — phù hợp app tĩnh không có API động.
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.status === 200 && response.type !== 'opaque') {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
