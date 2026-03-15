// 오디오 시퀀스: 정각 알림 + 미리듣기 (audio-core 의존)
'use strict';

(function () {
  var voice = window.DharmaBell.voice;
  var settingsModule = window.DharmaBell.settings;
  var core = window.DharmaBell.audioCore;

  /** MP3 Blob 재생 (IndexedDB에서 로드) */
  async function playMp3FromDB(hour, useVoiceEnhance) {
    core.checkCancelled();
    var record = await settingsModule.loadMp3Blob(hour);
    if (!record || !record.blob) return;

    await core.ensureResumed();
    core.initAudioContext();

    if (useVoiceEnhance) {
      var ab = await record.blob.arrayBuffer();
      var ok = await voice.playWithVoiceEnhance(
        core.getCtx(), core.getMasterGain(), ab, function () { return core.isCancelled(); }
      );
      if (ok) return;
    }

    var blobUrl = URL.createObjectURL(record.blob);
    try { await core.playAudioElement(blobUrl); }
    finally { URL.revokeObjectURL(blobUrl); }
  }

  /** 정각 알림 시퀀스 */
  async function playHourlySequence(hour, settings) {
    core.setCancelled(false);
    core.initAudioContext();
    core.setVolume(settings.speakerVolume);
    await core.ensureResumed();

    try {
      if (settings.bellEnabled) {
        core.checkCancelled();
        var bellInfo = core.getBellInfo(settings.bellId);
        var bellUrl = settings.bellId === 'custom' && settings.bellCustomUri
          ? settings.bellCustomUri : bellInfo.url;
        var bellFile = settings.bellId === 'custom' ? null : bellInfo.file;
        await core.playBellWithFadeOut(bellUrl, bellFile);
        await core.wait(settings.gapA);
      }

      core.checkCancelled();
      var clock = window.DharmaBell.clock;
      var ttsText = clock.getTTSText(hour, settings.timeFormat, settings.ttsSuffix);
      await core.speakAndWait(ttsText);
      core.checkCancelled();

      if (settings.mp3Enabled && settings.hourlyMp3[hour]) {
        await core.wait(settings.gapB);
        await playMp3FromDB(hour, settings.voiceEnhance);
      }
    } catch (e) {
      if (e.message === 'CANCELLED') return;
      throw e;
    }
  }

  /** 종소리 미리듣기 */
  async function previewBell(bellId, customBlobUrl) {
    core.setCancelled(false);
    core.initAudioContext();
    await core.ensureResumed();
    var info = core.getBellInfo(bellId);
    var url = bellId === 'custom' && customBlobUrl ? customBlobUrl : info.url;
    var file = bellId === 'custom' ? null : info.file;
    await core.playBellWithFadeOut(url, file);
  }

  /** MP3 미리듣기 */
  async function previewMp3(blobUrl, useVoiceEnhance) {
    core.setCancelled(false);
    core.initAudioContext();
    await core.ensureResumed();

    if (useVoiceEnhance) {
      var response = await fetch(blobUrl);
      var ab = await response.arrayBuffer();
      var ok = await voice.playWithVoiceEnhance(
        core.getCtx(), core.getMasterGain(), ab, function () { return core.isCancelled(); }
      );
      if (ok) return;
    }
    await core.playAudioElement(blobUrl);
  }

  window.DharmaBell.audio = {
    initAudioContext: core.initAudioContext,
    setVolume: core.setVolume,
    ensureResumed: core.ensureResumed,
    cancelSequence: core.cancelSequence,
    playHourlySequence: playHourlySequence,
    previewBell: previewBell,
    previewMp3: previewMp3,
  };
})();
