// 오디오 코어: 종소리/TTS/MP3 재생 (HTMLAudioElement 기반, 최대 호환)
'use strict';

(function () {
  var cfg = window.DharmaBell.config;

  var audioCtx = null;
  var masterGainNode = null;
  var cancelled = false;
  var activeTimers = new Set();
  var ttsResolve = null;
  var currentAudio = null;

  /** AudioContext 초기화 (음성 강화 전용) */
  function initAudioContext() {
    if (audioCtx) return audioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
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
    // HTMLAudioElement 볼륨은 0~1, 설정은 0~30
    window._dharmaBellVolume = Math.min(1, Math.max(0, (parseFloat(vol) || 0) / 30));
    if (masterGainNode) masterGainNode.gain.value = (parseFloat(vol) || 0) / 20;
  }

  async function ensureResumed() {
    if (audioCtx && audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); } catch (e) { /* 무시 */ }
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

  /** HTMLAudioElement로 종소리 재생 + 페이드아웃 */
  function playBellWithFadeOut(url, bellFile) {
    checkCancelled();
    return new Promise(function (resolve) {
      var audio = new Audio(url);
      var vol = window._dharmaBellVolume || 0.5;
      audio.volume = vol;
      currentAudio = audio;

      audio.onerror = function () {
        console.warn('종소리 재생 실패, IndexedDB 폴백 시도:', url);
        currentAudio = null;
        // IndexedDB 폴백
        if (bellFile && window.DharmaBell.bellCache) {
          window.DharmaBell.bellCache.loadBell(bellFile).then(function (ab) {
            if (ab) {
              var blob = new Blob([ab], { type: 'audio/mpeg' });
              var blobUrl = URL.createObjectURL(blob);
              playSimpleAudio(blobUrl, vol).then(resolve);
            } else { resolve(); }
          }).catch(function () { resolve(); });
        } else { resolve(); }
      };

      audio.oncanplaythrough = function () {
        audio.play().then(function () {
          // 0.5초 정상 → 0.5초 페이드아웃
          safeTimeout(function () {
            var steps = 10;
            var step = 0;
            var fadeInterval = setInterval(function () {
              step++;
              audio.volume = Math.max(0, vol * (1 - step / steps));
              if (step >= steps || cancelled) {
                clearInterval(fadeInterval);
                audio.pause();
                currentAudio = null;
                resolve();
              }
            }, 50);
          }, 500);
        }).catch(function (e) {
          console.error('종소리 play() 실패:', e);
          currentAudio = null;
          resolve();
        });
      };

      // oncanplaythrough 안 오는 경우 대비
      audio.load();
    });
  }

  /** 단순 오디오 재생 (완료 대기) */
  function playSimpleAudio(url, vol) {
    return new Promise(function (resolve) {
      var audio = new Audio(url);
      audio.volume = vol || window._dharmaBellVolume || 0.5;
      currentAudio = audio;
      audio.onended = function () { currentAudio = null; resolve(); };
      audio.onerror = function () { currentAudio = null; resolve(); };
      audio.play().catch(function () { currentAudio = null; resolve(); });
    });
  }

  /** TTS (Web Speech API) */
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

  /** HTMLAudioElement 재생 (MP3용) */
  function playAudioElement(url) {
    return playSimpleAudio(url, window._dharmaBellVolume || 0.5);
  }

  function cancelSequence() {
    cancelled = true;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (ttsResolve) { ttsResolve(); ttsResolve = null; }
    clearAllTimers();
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.src = ''; } catch (e) { /* 무시 */ }
      currentAudio = null;
    }
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
