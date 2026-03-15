// 종소리 + MP3 모달 (ui.js 공통 컴포넌트 사용)
'use strict';

(function () {
  var cfg = window.DharmaBell.config;
  var settingsModule = window.DharmaBell.settings;
  var audio = window.DharmaBell.audio;
  var ui = window.DharmaBell.ui;

  // === 종소리 모달 ===
  function showBellModal() {
    var s = ui.getSettings();
    ui.openModal('🔔 종소리 선택');
    var body = ui.getBody();

    var sec = ui.createSection('');
    cfg.BUILT_IN_BELLS.forEach(function (bell) {
      var item = document.createElement('div');
      item.className = 'radio-item';
      var dot = document.createElement('div');
      dot.className = 'radio-dot' + (s.bellId === bell.id ? ' selected' : '');
      var label = document.createElement('span');
      label.className = 'radio-label'; label.textContent = bell.name;
      var preview = document.createElement('button');
      preview.className = 'preview-btn'; preview.textContent = '▶';
      preview.addEventListener('click', function (e) {
        e.stopPropagation();
        audio.previewBell(bell.id).catch(function (err) {
          console.error('종소리 미리듣기 실패:', err);
        });
      });
      item.addEventListener('click', function () {
        sec.querySelectorAll('.radio-dot').forEach(function (d) { d.classList.remove('selected'); });
        dot.classList.add('selected');
        settingsModule.updateSettings({ bellId: bell.id });
      });
      item.appendChild(dot); item.appendChild(label); item.appendChild(preview);
      sec.appendChild(item);
    });

    // 사용자 파일
    var ci = document.createElement('div'); ci.className = 'radio-item';
    var cd = document.createElement('div');
    cd.className = 'radio-dot' + (s.bellId === 'custom' ? ' selected' : '');
    var cl = document.createElement('span');
    cl.className = 'radio-label'; cl.textContent = '사용자 파일';
    var fb = document.createElement('button');
    fb.className = 'action-btn'; fb.textContent = '파일 선택';
    var fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'audio/*'; fi.className = 'file-input-hidden';

    fb.addEventListener('click', function (e) { e.stopPropagation(); fi.click(); });
    fi.addEventListener('change', function () {
      if (fi.files.length > 0) {
        var url = URL.createObjectURL(fi.files[0]);
        sec.querySelectorAll('.radio-dot').forEach(function (d) { d.classList.remove('selected'); });
        cd.classList.add('selected');
        settingsModule.updateSettings({ bellId: 'custom', bellCustomUri: url });
      }
    });
    ci.addEventListener('click', function () {
      sec.querySelectorAll('.radio-dot').forEach(function (d) { d.classList.remove('selected'); });
      cd.classList.add('selected');
      settingsModule.updateSettings({ bellId: 'custom' });
    });
    ci.appendChild(cd); ci.appendChild(cl); ci.appendChild(fb); ci.appendChild(fi);
    sec.appendChild(ci);
    body.appendChild(sec);
  }

  // === MP3 모달 ===
  async function showMp3Modal() {
    ui.openModal('🎵 시간별 MP3');
    var s = ui.getSettings();
    var registered = await settingsModule.getAllMp3Hours();
    var body = ui.getBody();
    var sec = ui.createSection('');

    for (var h = 0; h < 24; h++) {
      (function (hour) {
        var row = document.createElement('div'); row.className = 'mp3-row';
        var hl = document.createElement('span');
        hl.className = 'mp3-hour';
        hl.textContent = String(hour).padStart(2, '0') + '시';
        var ns = document.createElement('span'); ns.className = 'mp3-name';
        var has = registered.indexOf(hour) >= 0;
        ns.textContent = has ? (s.hourlyMp3[hour] || '등록됨') : '미등록';
        ns.style.color = has ? cfg.COLOR.TEXT_SUB : cfg.COLOR.TEXT_HINT;
        var acts = document.createElement('div'); acts.className = 'mp3-actions';

        if (has) {
          var pb = document.createElement('button');
          pb.className = 'preview-btn'; pb.textContent = '▶';
          pb.addEventListener('click', async function () {
            try {
              var rec = await settingsModule.loadMp3Blob(hour);
              if (rec && rec.blob) {
                var url = URL.createObjectURL(rec.blob);
                await audio.previewMp3(url, s.voiceEnhance);
              }
            } catch (err) { console.error('MP3 미리듣기 실패:', err); }
          });
          acts.appendChild(pb);
          var db = document.createElement('button');
          db.className = 'action-btn danger'; db.textContent = '✕';
          db.addEventListener('click', async function () {
            await settingsModule.deleteMp3(hour);
            var upd = Object.assign({}, s.hourlyMp3);
            delete upd[hour];
            settingsModule.updateSettings({ hourlyMp3: upd });
            showMp3Modal(); // 새로고침
          });
          acts.appendChild(db);
        } else {
          acts.appendChild(makeSelectBtn(hour));
        }
        row.appendChild(hl); row.appendChild(ns); row.appendChild(acts);
        sec.appendChild(row);
      })(h);
    }
    body.appendChild(sec);
  }

  /** 파일 선택 버튼 */
  function makeSelectBtn(hour) {
    var btn = document.createElement('button');
    btn.className = 'action-btn primary'; btn.textContent = '선택';
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'audio/*'; input.className = 'file-input-hidden';
    btn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', async function () {
      if (input.files.length > 0) {
        var file = input.files[0];
        await settingsModule.saveMp3Blob(hour, file, file.name);
        var s = ui.getSettings();
        var upd = Object.assign({}, s.hourlyMp3);
        upd[hour] = file.name;
        settingsModule.updateSettings({ hourlyMp3: upd });
        showMp3Modal();
      }
    });
    var frag = document.createDocumentFragment();
    frag.appendChild(btn); frag.appendChild(input);
    return frag;
  }

  // ui 네임스페이스에 추가
  ui.showBellModal = showBellModal;
  ui.showMp3Modal = showMp3Modal;
})();
