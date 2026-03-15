// 모달 코어: 공통 컴포넌트 + 설정 모달
'use strict';

(function () {
  var settingsModule = window.DharmaBell.settings;
  var audio = window.DharmaBell.audio;

  var overlay, modalTitle, modalBody;

  function init() {
    overlay = document.getElementById('modal-overlay');
    modalTitle = document.getElementById('modal-title');
    modalBody = document.getElementById('modal-body');
    document.getElementById('modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  }

  function openModal(title) {
    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    overlay.classList.remove('hidden');
  }

  function closeModal() {
    overlay.classList.add('hidden');
    modalBody.innerHTML = '';
    audio.cancelSequence();
  }

  function getBody() { return modalBody; }
  function getSettings() { return settingsModule.loadSettings(); }

  // === 공통 컴포넌트 빌더 ===

  function createToggle(value, onChange) {
    var btn = document.createElement('button');
    btn.className = 'toggle' + (value ? ' on' : '');
    btn.addEventListener('click', function () {
      var next = !btn.classList.contains('on');
      btn.classList.toggle('on', next);
      onChange(next);
    });
    return btn;
  }

  function createSlider(value, min, max, unit, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'slider-control';
    var btnMinus = document.createElement('button');
    btnMinus.className = 'slider-btn'; btnMinus.textContent = '−';
    var valSpan = document.createElement('span');
    valSpan.className = 'slider-value'; valSpan.textContent = value + unit;
    var btnPlus = document.createElement('button');
    btnPlus.className = 'slider-btn'; btnPlus.textContent = '+';
    var current = value;
    function update(v) {
      current = Math.max(min, Math.min(max, v));
      valSpan.textContent = current + unit;
      onChange(current);
    }
    btnMinus.addEventListener('click', function () { update(current - 1); });
    btnPlus.addEventListener('click', function () { update(current + 1); });
    wrap.appendChild(btnMinus);
    wrap.appendChild(valSpan);
    wrap.appendChild(btnPlus);
    return wrap;
  }

  function createSegment(options, selected, onChange) {
    var group = document.createElement('div');
    group.className = 'segment-group';
    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.className = 'segment-btn' + (opt.value === selected ? ' active' : '');
      btn.textContent = opt.label;
      btn.addEventListener('click', function () {
        group.querySelectorAll('.segment-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        onChange(opt.value);
      });
      group.appendChild(btn);
    });
    return group;
  }

  function createRow(label, control) {
    var row = document.createElement('div');
    row.className = 'setting-row';
    var lbl = document.createElement('span');
    lbl.className = 'setting-label'; lbl.textContent = label;
    row.appendChild(lbl); row.appendChild(control);
    return row;
  }

  function createSection(title) {
    var sec = document.createElement('div');
    sec.className = 'modal-section';
    if (title) {
      var lbl = document.createElement('div');
      lbl.className = 'section-label'; lbl.textContent = title;
      sec.appendChild(lbl);
    }
    return sec;
  }

  // === 설정 모달 ===
  function showSettingsModal() {
    var s = getSettings();
    openModal('⚙️ 설정');
    var body = getBody();

    var sec1 = createSection('시간 표시');
    sec1.appendChild(createRow('시간 형식',
      createSegment([{ label: '12시간', value: '12h' }, { label: '24시간', value: '24h' }],
        s.timeFormat, function (v) { settingsModule.updateSettings({ timeFormat: v }); })
    ));
    sec1.appendChild(createRow('날짜 표시',
      createToggle(s.showDate, function (v) { settingsModule.updateSettings({ showDate: v }); })
    ));
    body.appendChild(sec1);

    var sec2 = createSection('TTS');
    sec2.appendChild(createRow('"입니다" 접미사',
      createToggle(s.ttsSuffix, function (v) { settingsModule.updateSettings({ ttsSuffix: v }); })
    ));
    body.appendChild(sec2);

    var sec3 = createSection('종소리');
    sec3.appendChild(createRow('종소리 사용',
      createToggle(s.bellEnabled, function (v) { settingsModule.updateSettings({ bellEnabled: v }); })
    ));
    sec3.appendChild(createRow('공백 A',
      createSlider(s.gapA, 0, 10, '초', function (v) { settingsModule.updateSettings({ gapA: v }); })
    ));
    body.appendChild(sec3);

    var sec4 = createSection('MP3');
    sec4.appendChild(createRow('MP3 재생',
      createToggle(s.mp3Enabled, function (v) { settingsModule.updateSettings({ mp3Enabled: v }); })
    ));
    sec4.appendChild(createRow('음성 강화',
      createToggle(s.voiceEnhance, function (v) { settingsModule.updateSettings({ voiceEnhance: v }); })
    ));
    sec4.appendChild(createRow('공백 B',
      createSlider(s.gapB, 0, 10, '초', function (v) { settingsModule.updateSettings({ gapB: v }); })
    ));
    body.appendChild(sec4);

    var sec5 = createSection('스피커 볼륨');
    sec5.appendChild(createRow('볼륨',
      createSlider(s.speakerVolume, 0, 30, '', function (v) {
        settingsModule.updateSettings({ speakerVolume: v }); audio.setVolume(v);
      })
    ));
    body.appendChild(sec5);

    var sec6 = createSection('알림 범위');
    sec6.appendChild(createRow('시작 시간',
      createSlider(s.startHour, 0, 23, '시', function (v) { settingsModule.updateSettings({ startHour: v }); })
    ));
    sec6.appendChild(createRow('종료 시간',
      createSlider(s.endHour, 0, 23, '시', function (v) { settingsModule.updateSettings({ endHour: v }); })
    ));
    body.appendChild(sec6);

    var sec7 = createSection('');
    var testBtn = document.createElement('button');
    testBtn.className = 'test-btn';
    testBtn.textContent = '▶ 현재 설정으로 테스트 재생';
    var playing = false;
    testBtn.addEventListener('click', async function () {
      if (playing) {
        audio.cancelSequence();
        testBtn.textContent = '▶ 현재 설정으로 테스트 재생';
        testBtn.classList.remove('playing'); playing = false; return;
      }
      playing = true;
      testBtn.textContent = '■ 재생 중지';
      testBtn.classList.add('playing');
      try { await audio.playHourlySequence(new Date().getHours(), getSettings()); } catch (e) { /* 무시 */ }
      testBtn.textContent = '▶ 현재 설정으로 테스트 재생';
      testBtn.classList.remove('playing'); playing = false;
    });
    sec7.appendChild(testBtn);
    body.appendChild(sec7);
  }

  window.DharmaBell.ui = {
    init: init, openModal: openModal, closeModal: closeModal,
    getBody: getBody, getSettings: getSettings,
    createToggle: createToggle, createSlider: createSlider,
    createSegment: createSegment, createRow: createRow, createSection: createSection,
    showSettingsModal: showSettingsModal,
    showBellModal: null, showMp3Modal: null,
  };
})();
