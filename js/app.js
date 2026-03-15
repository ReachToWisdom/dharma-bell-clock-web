// 초기화 + 이벤트 바인딩 + Wake Lock
'use strict';

(function () {
  var cfg = window.DharmaBell.config;
  var settingsModule = window.DharmaBell.settings;
  var clockModule = window.DharmaBell.clock;
  var audioModule = window.DharmaBell.audio;
  var watchdogModule = window.DharmaBell.watchdog;
  var ui = window.DharmaBell.ui;

  // 상태
  var alarmEnabled = true;
  var playing = false;
  var menuHideTimer = null;
  var wakeLock = null;

  // DOM 참조
  var clockScreen, dateDisplay, periodDisplay, timeDisplay;
  var countdownDisplay, watchdogBadge;
  var menu, btnAlarm;

  /** 시계 화면 갱신 콜백 */
  function onTick(now) {
    var s = settingsModule.loadSettings();
    var display = clockModule.getClockDisplay(now, s.timeFormat);

    timeDisplay.textContent = display.time;
    periodDisplay.textContent = display.period || '';

    if (s.showDate) {
      dateDisplay.textContent = clockModule.getDateDisplay(now);
      dateDisplay.classList.remove('hidden');
    } else {
      dateDisplay.classList.add('hidden');
    }

    countdownDisplay.textContent = '다음 정각까지 ' + clockModule.getCountdown();
  }

  /** 정각 알림 콜백 */
  async function onHour(hour) {
    watchdogModule.heartbeat();
    if (!alarmEnabled || playing) return;

    var s = settingsModule.loadSettings();
    if (!clockModule.isInAlarmRange(hour, s.startHour, s.endHour)) return;

    playing = true;
    try {
      await audioModule.playHourlySequence(hour, s);
    } catch (e) {
      console.warn('알림 재생 오류:', e);
    }
    playing = false;
  }

  /** 메뉴 표시/숨김 */
  function showMenu() {
    menu.classList.remove('hidden', 'fade-out');
    clearTimeout(menuHideTimer);
    menuHideTimer = setTimeout(function () {
      menu.classList.add('fade-out');
      setTimeout(function () {
        if (menu.classList.contains('fade-out')) {
          menu.classList.add('hidden');
        }
      }, 500);
    }, cfg.MENU_HIDE_DELAY);
  }

  /** 알림 ON/OFF 토글 */
  function toggleAlarm() {
    alarmEnabled = !alarmEnabled;
    btnAlarm.textContent = alarmEnabled ? '🔊 알림 ON' : '🔇 알림 OFF';
    btnAlarm.classList.toggle('active', alarmEnabled);

    if (alarmEnabled) {
      clockModule.scheduleNext(onHour);
      watchdogModule.start(
        function () { clockModule.scheduleNext(onHour); },
        function (status) { updateWatchdogBadge(status); }
      );
    } else {
      audioModule.cancelSequence();
      watchdogModule.stop();
    }
  }

  /** 워치독 상태 뱃지 */
  function updateWatchdogBadge(status) {
    if (status === 'warning') {
      watchdogBadge.textContent = '⚠ 타이머 재시작';
      watchdogBadge.classList.remove('hidden');
      setTimeout(function () { watchdogBadge.classList.add('hidden'); }, 3000);
    } else {
      watchdogBadge.classList.add('hidden');
    }
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', function () { wakeLock = null; });
      }
    } catch (e) { /* 무시 */ }
  }

  function lockOrientation() {
    try {
      if (screen.orientation && screen.orientation.lock)
        screen.orientation.lock('landscape').catch(function () {});
    } catch (e) { /* 무시 */ }
  }

  function setupAudioUnlock() {
    var unlocked = false;
    function unlock() {
      if (unlocked) return; unlocked = true;
      audioModule.initAudioContext(); audioModule.ensureResumed(); requestWakeLock();
    }
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !wakeLock) requestWakeLock();
  });

  /** 초기화 */
  document.addEventListener('DOMContentLoaded', function () {
    // DOM 참조
    clockScreen = document.getElementById('clock-screen');
    dateDisplay = document.getElementById('date-display');
    periodDisplay = document.getElementById('period-display');
    timeDisplay = document.getElementById('time-display');
    countdownDisplay = document.getElementById('countdown-display');
    watchdogBadge = document.getElementById('watchdog-badge');
    menu = document.getElementById('menu');
    btnAlarm = document.getElementById('btn-alarm');

    // UI 모듈 초기화
    ui.init();

    // 시계 시작
    clockModule.startClock(onTick);

    // 정각 타이머 + 워치독
    clockModule.scheduleNext(onHour);
    watchdogModule.start(
      function () { clockModule.scheduleNext(onHour); },
      function (status) { updateWatchdogBadge(status); }
    );

    // AudioContext unlock 준비
    setupAudioUnlock();

    // 화면 방향 잠금
    lockOrientation();

    // 알림 버튼 초기 상태
    btnAlarm.classList.add('active');

    // 화면 클릭 → 메뉴 표시
    clockScreen.addEventListener('click', showMenu);

    // 메뉴 버튼 이벤트
    document.getElementById('btn-bell').addEventListener('click', function (e) {
      e.stopPropagation();
      ui.showBellModal();
    });
    document.getElementById('btn-mp3').addEventListener('click', function (e) {
      e.stopPropagation();
      ui.showMp3Modal();
    });
    document.getElementById('btn-settings').addEventListener('click', function (e) {
      e.stopPropagation();
      ui.showSettingsModal();
    });
    document.getElementById('btn-alarm').addEventListener('click', function (e) {
      e.stopPropagation();
      toggleAlarm();
    });
    document.getElementById('btn-exit').addEventListener('click', function (e) {
      e.stopPropagation();
      // 종료: PWA는 window.close, 브라우저는 안내
      if (window.close) window.close();
    });

    // Service Worker 등록
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 무시 */ });
    }
  });
})();
