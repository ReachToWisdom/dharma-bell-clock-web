// 오디오 코어: AudioContext, 볼륨, 타이머 관리, 기본 재생
'use strict';

(function () {
  var cfg = window.DharmaBell.config;

  var audioCtx = null;
  var masterGainNode = null;
  var cancelled = false;
  var activeTimers = new Set();
  var ttsResolve = null;
  var currentAudio = null;

  function initAudioContext() {
    if (audioCtx) return audioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    masterGainNode = audioCtx.createGain();
    masterGainNode.connect(audioCtx.destination);
    return audioCtx;
  }

  function getCtx() { return audioCtx; }
  function getMasterGain() { return masterGainNode; }
  function isCancelled() { return cancelled; }
  function setCancelled(v) { cancelled = v; }

  function setVolume(vol) {
    if (!masterGainNode) return;
    masterGainNode.gain.value = (parseFloat(vol) || 0) / 20;
  }

  async function ensureResumed() {
    if (audioCtx && audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); } catch (e) { console.warn('AudioContext resume 실패:', e); }
    }
  }

  function safeTimeout(fn, ms) {
    var id = setTimeout(function () { activeTimers.delete(id); fn(); }, ms);
    activeTimers.add(id);
    return id;
  }

  function clearAllTimers() {
    activeTimers.forEach(function (id) { clearTimeout(id); });
    activeTimers.clear();
  }

  function checkCancelled() { if (cancelled) throw new Error('CANCELLED'); }

  function wait(seconds) {
    if (seconds <= 0) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var timer = safeTimeout(resolve, seconds * 1000);
      var check = setInterval(function () {
        if (cancelled) {
          clearTimeout(timer); activeTimers.delete(timer);
          clearInterval(check); reject(new Error('CANCELLED'));
        }
      }, 100);
      safeTimeout(function () { clearInterval(check); }, seconds * 1000 + 50);
    });
  }

  function getBellInfo(bellId) {
    var bell = cfg.BUILT_IN_BELLS.find(function (b) { return b.id === bellId; });
    var file = bell ? bell.file : 'singing_bowl.mp3';
    return { url: cfg.SOUNDS_PATH + file, file: file };
  }

  function getBellUrl(bellId) { return getBellInfo(bellId).url; }

  /** decodeAudioData (Safari 콜백 호환) */
  function decodeAudio(ctx, arrayBuffer) {
    return new Promise(function (resolve, reject) {
      try {
        // Promise 기반 (Chrome, Firefox, 최신 Safari)
        var result = ctx.decodeAudioData(arrayBuffer, resolve, reject);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        }
      } catch (e) { reject(e); }
    });
  }

  /** 종소리 ArrayBuffer 로드 (fetch → IndexedDB 폴백) */
  async function loadBellBuffer(url, bellFile) {
    // 1차: 직접 fetch
    try {
      var response = await fetch(url);
      if (response.ok) {
        var ab = await response.arrayBuffer();
        return ab;
      }
    } catch (e) { console.warn('종소리 fetch 실패:', url, e); }

    // 2차: IndexedDB 폴백
    if (bellFile && window.DharmaBell.bellCache) {
      try {
        var cached = await window.DharmaBell.bellCache.loadBell(bellFile);
        if (cached) return cached;
      } catch (e) { console.warn('종소리 IndexedDB 폴백 실패:', e); }
    }

    throw new Error('종소리 로드 실패: ' + url);
  }

  async function playBellWithFadeOut(url, bellFile) {
    checkCancelled();
    var ctx = initAudioContext();
    await ensureResumed();
    var arrayBuffer = await loadBellBuffer(url, bellFile);
    var audioBuffer = await decodeAudio(ctx, arrayBuffer);
    var source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    var gainNode = ctx.createGain(); gainNode.gain.value = 1.0;
    source.connect(gainNode); gainNode.connect(masterGainNode);
    source.start(0);
    // 0.5초 정상 + 0.5초 페이드아웃
    await new Promise(function (resolve) {
      safeTimeout(function () {
        if (!cancelled) gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        safeTimeout(function () {
          try { source.stop(); } catch (e) { /* 무시 */ }
          resolve();
        }, 550);
      }, 500);
    });
  }

  function speakAndWait(text) {
    return new Promise(function (resolve) {
      if (cancelled || !window.speechSynthesis) { resolve(); return; }
      var resolved = false;
      var done = function () {
        if (resolved) return; resolved = true; ttsResolve = null; resolve();
      };
      ttsResolve = done;
      var utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'ko-KR'; utt.rate = 1.0;
      utt.onend = function () {
        if (cancelled) { done(); return; }
        safeTimeout(done, 200);
      };
      utt.onerror = function () { done(); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    });
  }

  function playAudioElement(url) {
    return new Promise(function (resolve) {
      checkCancelled();
      var audio = new Audio(url);
      currentAudio = audio;
      try {
        var ctx = initAudioContext();
        var src = ctx.createMediaElementSource(audio);
        src.connect(masterGainNode);
      } catch (e) { /* 이미 연결됨 */ }
      audio.onended = function () { currentAudio = null; resolve(); };
      audio.onerror = function () { currentAudio = null; resolve(); };
      audio.play().catch(function () { currentAudio = null; resolve(); });
    });
  }

  function cancelSequence() {
    cancelled = true;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (ttsResolve) { ttsResolve(); ttsResolve = null; }
    clearAllTimers();
    if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; }
    window.DharmaBell.voice.stopVoiceEnhance();
  }

  window.DharmaBell.audioCore = {
    initAudioContext: initAudioContext, getCtx: getCtx, getMasterGain: getMasterGain,
    setVolume: setVolume, ensureResumed: ensureResumed,
    isCancelled: isCancelled, setCancelled: setCancelled,
    checkCancelled: checkCancelled, wait: wait,
    getBellUrl: getBellUrl, getBellInfo: getBellInfo, playBellWithFadeOut: playBellWithFadeOut,
    speakAndWait: speakAndWait, playAudioElement: playAudioElement,
    cancelSequence: cancelSequence,
  };
})();
