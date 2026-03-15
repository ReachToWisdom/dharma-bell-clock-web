// 음성 강화 필터 - 하이패스 + 피킹 + 로우패스 + 게인 (Web Audio API)
'use strict';

(function () {
  // 현재 재생 중인 소스 (취소용)
  let currentSource = null;

  /**
   * 음성 강화 필터를 적용하여 오디오 재생
   * @param {AudioContext} ctx - 공유 AudioContext
   * @param {AudioNode} destination - 연결할 출력 노드 (masterGain 등)
   * @param {ArrayBuffer} arrayBuffer - 오디오 데이터
   * @param {Function} [isCancelled] - 취소 확인 함수
   * @returns {Promise<boolean>} 성공 여부
   */
  async function playWithVoiceEnhance(ctx, destination, arrayBuffer, isCancelled) {
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      currentSource = source;

      // 1. 하이패스 필터 - 저주파 노이즈 제거
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 100;
      highpass.Q.value = 0.7;

      // 2. 피킹 필터 - 음성 대역 강화
      const peaking = ctx.createBiquadFilter();
      peaking.type = 'peaking';
      peaking.frequency.value = 2000;
      peaking.Q.value = 1.0;
      peaking.gain.value = 6;

      // 3. 로우패스 필터 - 고주파 노이즈 제거
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 8000;
      lowpass.Q.value = 0.7;

      // 4. 게인 노드 - 볼륨 부스트
      const gain = ctx.createGain();
      gain.gain.value = 1.3;

      // 체인 연결: source → highpass → peaking → lowpass → gain → destination
      source.connect(highpass);
      highpass.connect(peaking);
      peaking.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(destination);

      source.start(0);

      // 재생 완료 대기 (취소 가능)
      await new Promise(function (resolve) {
        var duration = audioBuffer.duration * 1000 + 200;
        var timer = setTimeout(function () {
          currentSource = null;
          resolve();
        }, duration);

        // 취소 감지 (100ms 간격)
        var check = setInterval(function () {
          if (isCancelled && isCancelled()) {
            clearTimeout(timer);
            clearInterval(check);
            try { source.stop(); } catch (e) { /* 무시 */ }
            currentSource = null;
            resolve();
          }
        }, 100);

        setTimeout(function () { clearInterval(check); }, duration + 50);
      });

      return true;
    } catch (e) {
      console.warn('음성 강화 재생 실패:', e);
      currentSource = null;
      return false;
    }
  }

  /** 현재 음성 강화 재생 중지 */
  function stopVoiceEnhance() {
    if (currentSource) {
      try { currentSource.stop(); } catch (e) { /* 무시 */ }
      currentSource = null;
    }
  }

  window.DharmaBell.voice = {
    playWithVoiceEnhance: playWithVoiceEnhance,
    stopVoiceEnhance: stopVoiceEnhance,
  };
})();
