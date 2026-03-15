// Service Worker - 오프라인 캐시 (v6)
'use strict';

var CACHE_NAME = 'dharma-bell-v6';

var PRECACHE_URLS = [
  './',
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

// 설치: 개별 캐싱
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function (e) {
            console.warn('SW 캐시 실패:', url, e);
          });
        })
      );
    }).then(function () { return self.skipWaiting(); })
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
    }).then(function () { return self.clients.claim(); })
  );
});

// fetch: 쿼리스트링 무시 + Cache First
self.addEventListener('fetch', function (event) {
  var request = event.request;

  // 쿼리스트링 제거한 URL로 캐시 매칭
  var url = new URL(request.url);
  url.search = '';
  var cleanUrl = url.toString();

  event.respondWith(
    // 1차: 쿼리 없는 URL로 캐시 매칭
    caches.match(cleanUrl).then(function (cached) {
      if (cached) return cached;
      // 2차: 원본 요청으로 캐시 매칭
      return caches.match(request);
    }).then(function (cached) {
      if (cached) return cached;
      // 3차: 네트워크
      return fetch(request).then(function (response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(cleanUrl, clone);
          });
        }
        return response;
      });
    }).catch(function () {
      // 오프라인 폴백: index.html
      return caches.match('./index.html');
    })
  );
});
