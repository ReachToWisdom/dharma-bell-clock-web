// 종소리 캐시: IndexedDB 저장 + 메모리 Blob URL 준비
'use strict';

(function () {
  var cfg = window.DharmaBell.config;
  var DB_NAME = 'dharma-bell-sounds';
  var STORE_NAME = 'bells';

  // 메모리 캐시: { 'singing_bowl.mp3': 'blob:...' }
  var blobUrls = {};

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  async function saveBell(bellFile, arrayBuffer) {
    var db = await openDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(arrayBuffer, bellFile);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  }

  async function loadBell(bellFile) {
    var db = await openDB();
    return new Promise(function (resolve) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).get(bellFile);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { resolve(null); };
    });
  }

  /** IndexedDB에 저장 + Blob URL 생성 (메모리 캐시) */
  async function cacheBell(bellFile, arrayBuffer) {
    await saveBell(bellFile, arrayBuffer);
    var blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    blobUrls[bellFile] = URL.createObjectURL(blob);
  }

  /** 모든 종소리 프리로드: IndexedDB + Blob URL 준비 */
  async function preloadAllBells() {
    var loaded = 0;
    for (var i = 0; i < cfg.BUILT_IN_BELLS.length; i++) {
      var bell = cfg.BUILT_IN_BELLS[i];
      try {
        // IndexedDB에서 로드
        var existing = await loadBell(bell.file);
        if (existing) {
          // Blob URL 생성 (메모리 캐시)
          var blob = new Blob([existing], { type: 'audio/mpeg' });
          blobUrls[bell.file] = URL.createObjectURL(blob);
          loaded++;
          continue;
        }
        // 네트워크에서 다운로드
        var url = cfg.SOUNDS_PATH + bell.file;
        var response = await fetch(url);
        if (!response.ok) continue;
        var ab = await response.arrayBuffer();
        await cacheBell(bell.file, ab);
        loaded++;
      } catch (e) {
        console.warn('종소리 프리로드 실패:', bell.file, e);
      }
    }
    console.info('종소리 준비 완료:', loaded + '/' + cfg.BUILT_IN_BELLS.length);
    return loaded;
  }

  /** 종소리 Blob URL 가져오기 (오프라인에서도 즉시 사용 가능) */
  function getBlobUrl(bellFile) {
    return blobUrls[bellFile] || null;
  }

  window.DharmaBell.bellCache = {
    preloadAllBells: preloadAllBells,
    getBlobUrl: getBlobUrl,
    saveBell: saveBell,
    loadBell: loadBell,
  };
})();
