// localStorage + IndexedDB 기반 설정/MP3 저장
'use strict';

(function () {
  const cfg = window.DharmaBell.config;

  // === localStorage: 설정 ===

  /** 설정 로드 (없으면 기본값) */
  function loadSettings() {
    try {
      const raw = localStorage.getItem(cfg.STORAGE_KEY);
      if (!raw) return Object.assign({}, cfg.DEFAULT_SETTINGS);
      const saved = JSON.parse(raw);
      return Object.assign({}, cfg.DEFAULT_SETTINGS, saved);
    } catch (e) {
      console.warn('설정 로드 실패, 기본값 사용:', e);
      return Object.assign({}, cfg.DEFAULT_SETTINGS);
    }
  }

  /** 설정 저장 */
  function saveSettings(settings) {
    try {
      localStorage.setItem(cfg.STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('설정 저장 실패:', e);
    }
  }

  /** 설정 부분 업데이트 */
  function updateSettings(partial) {
    const current = loadSettings();
    const updated = Object.assign({}, current, partial);
    saveSettings(updated);
    return updated;
  }

  // === IndexedDB: MP3 Blob 저장 ===

  /** DB 열기 */
  function openMp3DB() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(cfg.MP3_DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(cfg.MP3_STORE_NAME)) {
          db.createObjectStore(cfg.MP3_STORE_NAME);
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  /** MP3 Blob 저장 (hour: 0~23) */
  async function saveMp3Blob(hour, blob, fileName) {
    const db = await openMp3DB();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(cfg.MP3_STORE_NAME, 'readwrite');
      const store = tx.objectStore(cfg.MP3_STORE_NAME);
      store.put({ blob: blob, fileName: fileName }, hour);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  }

  /** MP3 Blob 로드 */
  async function loadMp3Blob(hour) {
    const db = await openMp3DB();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(cfg.MP3_STORE_NAME, 'readonly');
      const store = tx.objectStore(cfg.MP3_STORE_NAME);
      const req = store.get(hour);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  /** MP3 삭제 */
  async function deleteMp3(hour) {
    const db = await openMp3DB();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(cfg.MP3_STORE_NAME, 'readwrite');
      const store = tx.objectStore(cfg.MP3_STORE_NAME);
      store.delete(hour);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function (e) { reject(e.target.error); };
    });
  }

  /** 등록된 MP3 시간 목록 조회 */
  async function getAllMp3Hours() {
    const db = await openMp3DB();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(cfg.MP3_STORE_NAME, 'readonly');
      const store = tx.objectStore(cfg.MP3_STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  // 네임스페이스 등록
  window.DharmaBell.settings = {
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    updateSettings: updateSettings,
    saveMp3Blob: saveMp3Blob,
    loadMp3Blob: loadMp3Blob,
    deleteMp3: deleteMp3,
    getAllMp3Hours: getAllMp3Hours,
  };
})();
