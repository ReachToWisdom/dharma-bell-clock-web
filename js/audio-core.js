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
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
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

  function getBellUrl(bellId) {
    var bell = cfg.BUILT_IN_BELLS.find(function (b) { return b.id === bellId; });
    return bell ? cfg.SOUNDS_PATH + bell.file : cfg.SOUNDS_PATH + 'singing_bowl.mp3';
  }

  async function playBellWithFadeOut(url) {
    checkCancelled(); await ensureResumed();
    var ctx = initAudioContext();
    var response = await fetch(url);
    var arrayBuffer = await response.arrayBuffer();
    var audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    var source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    var gainNode = ctx.createGain(); gainNode.gain.value = 1.0;
    source.connect(gainNode); gainNode.connect(masterGainNode);
    source.start(0);
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
    getBellUrl: getBellUrl, playBellWithFadeOut: playBellWithFadeOut,
    speakAndWait: speakAndWait, playAudioElement: playAudioElement,
    cancelSequence: cancelSequence,
  };
})();
