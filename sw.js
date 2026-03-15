// Service Worker - 오프라인 캐시 (개별 파일 캐싱으로 안정성 확보)
'use strict';

var CACHE_NAME = 'dharma-bell-v4';

var PRECACHE_URLS = [
  './index.html',
  './css/style.css',
  './css/modal.css',
  './js/config.js',
  './js/settings.js',
  './js/bell-cache.js',
  './js/voice.js',
  './js/audio-core.js',
  './js/audio.js',
  './js/clock.js',
  './js/watchdog.js',
  './js/ui.js',
  './js/ui-modals.js',
  './js/app.js',
  './assets/sounds/singing_bowl.mp3',
  './assets/sounds/temple_bell.mp3',
  './assets/sounds/moktak.mp3',
  './assets/sounds/gyeongsoe.mp3',
  './assets/sounds/hand_bell.mp3',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './icon-maskable.svg'
];

// 설치: 개별 파일 캐싱 (하나 실패해도 나머지 캐싱 계속)
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('SW: 캐시 실패 -', url, err);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// fetch: Cache First → 네트워크 → 오프라인 폴백
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function () {
      return caches.match('./index.html');
    })
  );
});
