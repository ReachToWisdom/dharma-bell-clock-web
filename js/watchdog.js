// 워치독: 타이머 정상 동작 감시 + visibilitychange
'use strict';

(function () {
  var cfg = window.DharmaBell.config;

  var intervalId = null;
  var lastHeartbeat = 0;
  var onRestart = null;
  var onStatusChange = null;
  var status = 'stopped'; // 'running' | 'warning' | 'stopped'

  function setStatus(newStatus) {
    if (status !== newStatus) {
      status = newStatus;
      if (onStatusChange) onStatusChange(status);
    }
  }

  /** 하트비트 갱신 */
  function heartbeat() {
    lastHeartbeat = Date.now();
    if (status === 'warning') setStatus('running');
  }

  /** 타이머 상태 점검 */
  function check() {
    var elapsed = Date.now() - lastHeartbeat;
    if (elapsed > cfg.WATCHDOG.TOLERANCE) {
      console.warn('워치독: 타이머 응답 없음 (' + Math.round(elapsed / 1000) + '초). 재시작.');
      setStatus('warning');
      if (onRestart) onRestart();
    }
  }

  /** 워치독 시작 */
  function start(restartCb, statusCb) {
    stop();
    onRestart = restartCb;
    onStatusChange = statusCb || null;
    heartbeat();
    setStatus('running');
    intervalId = setInterval(check, cfg.WATCHDOG.INTERVAL);
  }

  /** 워치독 중지 */
  function stop() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    setStatus('stopped');
  }

  /** visibilitychange: 탭 복귀 시 정각 놓침 감지 */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && status !== 'stopped') {
      var elapsed = Date.now() - lastHeartbeat;
      if (elapsed > cfg.WATCHDOG.TOLERANCE) {
        console.warn('워치독: 탭 복귀, 정각 놓침 감지. 재시작.');
        setStatus('warning');
        if (onRestart) onRestart();
      }
      heartbeat();
    }
  });

  window.DharmaBell.watchdog = {
    start: start,
    stop: stop,
    heartbeat: heartbeat,
    getStatus: function () { return status; },
  };
})();
