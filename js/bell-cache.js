// 종소리 IndexedDB 캐시 - SW 캐시 실패 대비 이중 보험
'use strict';

(function () {
  var cfg = window.DharmaBell.config;
  var DB_NAME = 'dharma-bell-sounds';
  var STORE_NAME = 'bells';

  /** DB 열기 */
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

  /** 종소리 ArrayBuffer 저장 */
  async function saveBell(bellFile, arrayBuffer) {
    var db = await openDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(arrayBuffer, bellFile);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  }

  /** 종소리 ArrayBuffer 로드 */
  async function loadBell(bellFile) {
    var db = await openDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var req = tx.objectStore(STORE_NAME).get(bellFile);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { resolve(null); };
    });
  }

  /** 모든 내장 종소리를 IndexedDB에 프리로드 */
  async function preloadAllBells() {
    var loaded = 0;
    for (var i = 0; i < cfg.BUILT_IN_BELLS.length; i++) {
      var bell = cfg.BUILT_IN_BELLS[i];
      try {
        // 이미 캐시된 것은 스킵
        var existing = await loadBell(bell.file);
        if (existing) { loaded++; continue; }

        var url = cfg.SOUNDS_PATH + bell.file;
        var response = await fetch(url);
        if (!response.ok) continue;
        var ab = await response.arrayBuffer();
        await saveBell(bell.file, ab);
        loaded++;
      } catch (e) {
        console.warn('종소리 프리로드 실패:', bell.file, e);
      }
    }
    console.info('종소리 프리로드 완료:', loaded + '/' + cfg.BUILT_IN_BELLS.length);
    return loaded;
  }

  /**
   * 종소리 ArrayBuffer 가져오기 (이중 폴백)
   * 1) fetch (SW 캐시 또는 네트워크)
   * 2) IndexedDB 폴백
   */
  async function fetchBellBuffer(url, bellFile) {
    // 1차: fetch 시도 (SW 캐시 히트 또는 온라인)
    try {
      var response = await fetch(url);
      if (response.ok) return await response.arrayBuffer();
    } catch (e) { /* fetch 실패 → IndexedDB 폴백 */ }

    // 2차: IndexedDB 폴백
    if (bellFile) {
      var cached = await loadBell(bellFile);
      if (cached) return cached;
    }

    throw new Error('종소리 로드 실패 (오프라인): ' + url);
  }

  window.DharmaBell.bellCache = {
    preloadAllBells: preloadAllBells,
    fetchBellBuffer: fetchBellBuffer,
    saveBell: saveBell,
    loadBell: loadBell,
  };
})();
