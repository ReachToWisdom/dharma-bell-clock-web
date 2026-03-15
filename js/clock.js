// 시계 갱신 + 정각 타이머 + 시간 포맷 유틸
'use strict';

(function () {
  var tickInterval = null;
  var hourTimer = null;
  var onHourCallback = null;

  // === 시간 포맷 유틸 ===

  /** 12시간 형식 TTS */
  function format12hTTS(hour, suffix) {
    var period = hour < 12 ? '오전' : '오후';
    var h = hour % 12 || 12;
    var base = period + ' ' + h + '시';
    return suffix ? base + '입니다' : base;
  }

  /** 24시간 형식 TTS */
  function format24hTTS(hour, suffix) {
    var base = hour + '시';
    return suffix ? base + '입니다' : base;
  }

  /** TTS용 시간 텍스트 */
  function getTTSText(hour, format, suffix) {
    return format === '12h' ? format12hTTS(hour, suffix) : format24hTTS(hour, suffix);
  }

  /** 디지털 시계 표시 */
  function getClockDisplay(date, format) {
    var h = date.getHours();
    var m = date.getMinutes();
    var mm = String(m).padStart(2, '0');

    if (format === '24h') {
      return { time: String(h).padStart(2, '0') + ':' + mm };
    }

    var period = h < 12 ? '오전' : '오후';
    var h12 = h % 12 || 12;
    return { time: h12 + ':' + mm, period: period };
  }

  /** 날짜 표시 */
  function getDateDisplay(date) {
    var days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();
    var day = days[date.getDay()];
    return y + '년 ' + m + '월 ' + d + '일 ' + day;
  }

  /** 다음 정각까지 남은 밀리초 */
  function msUntilNextHour() {
    var now = new Date();
    var next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    return next.getTime() - now.getTime();
  }

  /** 카운트다운 표시 */
  function getCountdown() {
    var ms = msUntilNextHour();
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min + '분 ' + sec + '초';
  }

  /** 알림 범위 안인지 확인 */
  function isInAlarmRange(hour, startHour, endHour) {
    if (startHour <= endHour) {
      return hour >= startHour && hour <= endHour;
    }
    // 야간 범위: startHour=22, endHour=6 → 22~23 또는 0~6
    return hour >= startHour || hour <= endHour;
  }

  // === 시계 갱신 + 정각 타이머 ===

  /** 화면 갱신 콜백 */
  var onTickCallback = null;

  /** 1초 간격 화면 갱신 시작 */
  function startClock(onTick) {
    onTickCallback = onTick;
    if (tickInterval) clearInterval(tickInterval);
    // 즉시 1회 갱신
    if (onTickCallback) onTickCallback(new Date());
    tickInterval = setInterval(function () {
      if (onTickCallback) onTickCallback(new Date());
    }, 1000);
  }

  /** 시계 중지 */
  function stopClock() {
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    if (hourTimer) { clearTimeout(hourTimer); hourTimer = null; }
  }

  /** 다음 정각 타이머 예약 */
  function scheduleNext(callback) {
    if (hourTimer) clearTimeout(hourTimer);
    onHourCallback = callback;
    var delay = msUntilNextHour();

    hourTimer = setTimeout(function () {
      if (onHourCallback) onHourCallback(new Date().getHours());
      scheduleNext(onHourCallback); // 다음 정각 예약
    }, delay);
  }

  window.DharmaBell.clock = {
    getTTSText: getTTSText,
    getClockDisplay: getClockDisplay,
    getDateDisplay: getDateDisplay,
    getCountdown: getCountdown,
    msUntilNextHour: msUntilNextHour,
    isInAlarmRange: isInAlarmRange,
    startClock: startClock,
    stopClock: stopClock,
    scheduleNext: scheduleNext,
  };
})();
