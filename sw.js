// Service Worker - Cache First 오프라인 캐시
'use strict';

var CACHE_NAME = 'dharma-bell-v1';

var PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/settings.js',
  './js/voice.js',
  './js/audio-core.js',
  './js/audio.js',
  './js/clock.js',
  './js/watchdog.js',
  './js/ui.js',
  './js/ui-modals.js',
  './js/app.js',
  './css/modal.css',
  './assets/sounds/singing_bowl.mp3',
  './assets/sounds/temple_bell.mp3',
  './assets/sounds/moktak.mp3',
  './assets/sounds/gyeongsoe.mp3',
  './assets/sounds/hand_bell.mp3',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './icon-maskable.svg',
];

// 설치: 프리캐시
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
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

// fetch: Cache First, 네트워크 폴백
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        // 성공한 응답을 캐시에 추가
        if (response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function () {
      // 오프라인 폴백
      return caches.match('./index.html');
    })
  );
});
