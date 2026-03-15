// 초기화 + 이벤트 바인딩 + Wake Lock
'use strict';

(function () {
  var cfg = window.DharmaBell.config;
  var settingsModule = window.DharmaBell.settings;
  var clockModule = window.DharmaBell.clock;
  var audioModule = window.DharmaBell.audio;
  var watchdogModule = window.DharmaBell.watchdog;
  var ui = window.DharmaBell.ui;

  var alarmEnabled = true;
  var playing = false;
  var menuHideTimer = null;
  var wakeLock = null;

  var clockScreen, dateDisplay, periodDisplay, timeDisplay;
  var countdownDisplay, watchdogBadge, menu, btnAlarm;

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

  async function onHour(hour) {
    watchdogModule.heartbeat();
    if (!alarmEnabled || playing) return;
    var s = settingsModule.loadSettings();
    if (!clockModule.isInAlarmRange(hour, s.startHour, s.endHour)) return;
    playing = true;
    try { await audioModule.playHourlySequence(hour, s); }
    catch (e) { console.warn('알림 재생 오류:', e); }
    playing = false;
  }

  function showMenu() {
    menu.classList.remove('hidden', 'fade-out');
    clearTimeout(menuHideTimer);
    menuHideTimer = setTimeout(function () {
      menu.classList.add('fade-out');
      setTimeout(function () {
        if (menu.classList.contains('fade-out')) menu.classList.add('hidden');
      }, 500);
    }, cfg.MENU_HIDE_DELAY);
  }

  function toggleAlarm() {
    alarmEnabled = !alarmEnabled;
    btnAlarm.textContent = alarmEnabled ? '🔊 알림 ON' : '🔇 알림 OFF';
    btnAlarm.classList.toggle('active', alarmEnabled);
    if (alarmEnabled) {
      clockModule.scheduleNext(onHour);
      watchdogModule.start(
        function () { clockModule.scheduleNext(onHour); },
        function (st) { updateWatchdogBadge(st); }
      );
    } else {
      audioModule.cancelSequence();
      watchdogModule.stop();
    }
  }

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

  /** iOS AudioContext unlock: 무음 버퍼 재생으로 완전 해제 */
  function setupAudioUnlock() {
    var unlocked = false;
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      try {
        var ctx = audioModule.initAudioContext();
        // 무음 버퍼 재생 → iOS AudioContext 완전 unlock
        var buf = ctx.createBuffer(1, 1, 22050);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        if (ctx.state === 'suspended') ctx.resume();
        requestWakeLock();
        console.info('AudioContext unlocked:', ctx.state);
      } catch (e) { console.warn('AudioContext unlock 실패:', e); }
    }
    // capture:true → stopPropagation 우회
    document.addEventListener('click', unlock, true);
    document.addEventListener('touchstart', unlock, true);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !wakeLock) requestWakeLock();
  });

  /** PWA standalone 모드 감지 */
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  document.addEventListener('DOMContentLoaded', function () {
    clockScreen = document.getElementById('clock-screen');
    dateDisplay = document.getElementById('date-display');
    periodDisplay = document.getElementById('period-display');
    timeDisplay = document.getElementById('time-display');
    countdownDisplay = document.getElementById('countdown-display');
    watchdogBadge = document.getElementById('watchdog-badge');
    menu = document.getElementById('menu');
    btnAlarm = document.getElementById('btn-alarm');

    ui.init();
    clockModule.startClock(onTick);
    clockModule.scheduleNext(onHour);
    watchdogModule.start(
      function () { clockModule.scheduleNext(onHour); },
      function (st) { updateWatchdogBadge(st); }
    );

    setupAudioUnlock();
    btnAlarm.classList.add('active');
    clockScreen.addEventListener('click', showMenu);

    // 메뉴 버튼 이벤트
    document.getElementById('btn-bell').addEventListener('click', function (e) {
      e.stopPropagation(); ui.showBellModal();
    });
    document.getElementById('btn-mp3').addEventListener('click', function (e) {
      e.stopPropagation(); ui.showMp3Modal();
    });
    document.getElementById('btn-settings').addEventListener('click', function (e) {
      e.stopPropagation(); ui.showSettingsModal();
    });
    document.getElementById('btn-alarm').addEventListener('click', function (e) {
      e.stopPropagation(); toggleAlarm();
    });

    // 종료 버튼: standalone PWA는 홈으로 안내
    var btnExit = document.getElementById('btn-exit');
    if (isStandalone()) {
      btnExit.textContent = '⏻ 홈으로';
      btnExit.addEventListener('click', function (e) {
        e.stopPropagation();
        // iOS standalone: 홈 화면으로 돌아가기 안내
        if (confirm('홈 화면으로 나가시겠습니까?\n(위로 스와이프하여 앱을 닫으세요)')) {
          // 최소화 효과: 빈 페이지로 이동
          window.location.href = 'about:blank';
        }
      });
    } else {
      btnExit.addEventListener('click', function (e) {
        e.stopPropagation(); window.close();
      });
    }

    // 화면 방향 잠금
    try {
      if (screen.orientation && screen.orientation.lock)
        screen.orientation.lock('landscape').catch(function () {});
    } catch (e) { /* 무시 */ }

    // 종소리 프리로드
    window.DharmaBell.bellCache.preloadAllBells();

    // Service Worker: 강제 업데이트 + 이전 캐시 정리
    if ('serviceWorker' in navigator) {
      // 이전 SW 캐시 모두 삭제
      if (window.caches) {
        caches.keys().then(function (names) {
          names.forEach(function (n) {
            if (n !== 'dharma-bell-v6') caches.delete(n);
          });
        });
      }
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.update();
      }).catch(function (e) { console.warn('SW 등록 실패:', e); });
    }
  });
})();
