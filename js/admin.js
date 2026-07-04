/**
 * admin.js
 * ------------------------------------------------------------
 * 管理画面（スタッフ操作パネル）のロジック。
 * ・新しいレース / START / リセット
 * ・各種タイマーの変更
 * ・実況 / BGM / 効果音 の ON-OFF、音量、実況速度の調整
 * ------------------------------------------------------------
 */

const Admin = (() => {
  let el = {};

  function init() {
    el = {
      toggleBtn: document.getElementById('admin-toggle'),
      panel: document.getElementById('admin-panel'),
      closeBtn: document.getElementById('admin-close'),

      btnNewRace: document.getElementById('admin-new-race'),
      btnStart: document.getElementById('admin-start'),
      btnReset: document.getElementById('admin-reset'),

      lineupDuration: document.getElementById('admin-lineup-duration'),
      votingDuration: document.getElementById('admin-voting-duration'),
      raceDuration: document.getElementById('admin-race-duration'),

      commentaryToggle: document.getElementById('admin-commentary-toggle'),
      bgmToggle: document.getElementById('admin-bgm-toggle'),
      seToggle: document.getElementById('admin-se-toggle'),

      volume: document.getElementById('admin-volume'),
      speechRate: document.getElementById('admin-speech-rate'),
    };

    applySettingsToInputs();
    bindEvents();
  }

  function applySettingsToInputs() {
    const s = AppState.settings;
    el.lineupDuration.value = s.lineupDuration;
    el.votingDuration.value = s.votingDuration;
    el.raceDuration.value = s.raceDuration;
    el.commentaryToggle.checked = s.commentaryEnabled;
    el.bgmToggle.checked = s.bgmEnabled;
    el.seToggle.checked = s.seEnabled;
    el.volume.value = s.volume;
    el.speechRate.value = s.speechRate;
  }

  function bindEvents() {
    el.toggleBtn.addEventListener('click', () => {
      el.panel.classList.toggle('hidden');
    });
    el.closeBtn.addEventListener('click', () => {
      el.panel.classList.add('hidden');
    });

    el.btnNewRace.addEventListener('click', () => UI.startNewRace());
    el.btnStart.addEventListener('click', () => UI.adminStartRace());
    el.btnReset.addEventListener('click', () => UI.resetToTop());

    el.lineupDuration.addEventListener('change', (e) => {
      AppState.settings.lineupDuration = Math.max(5, Number(e.target.value) || 30);
    });
    el.votingDuration.addEventListener('change', (e) => {
      AppState.settings.votingDuration = Math.max(5, Number(e.target.value) || 90);
    });
    el.raceDuration.addEventListener('change', (e) => {
      AppState.settings.raceDuration = Math.max(10, Number(e.target.value) || 60);
    });

    el.commentaryToggle.addEventListener('change', (e) => {
      AppState.settings.commentaryEnabled = e.target.checked;
      Commentary.setEnabled(e.target.checked);
    });
    el.bgmToggle.addEventListener('change', (e) => {
      AppState.settings.bgmEnabled = e.target.checked;
      AudioManager.setBgmEnabled(e.target.checked);
    });
    el.seToggle.addEventListener('change', (e) => {
      AppState.settings.seEnabled = e.target.checked;
      AudioManager.setSeEnabled(e.target.checked);
    });

    el.volume.addEventListener('input', (e) => {
      const value = Number(e.target.value);
      AppState.settings.volume = value;
      AudioManager.setVolume(value);
    });
    el.speechRate.addEventListener('input', (e) => {
      const value = Number(e.target.value);
      AppState.settings.speechRate = value;
      Commentary.setRate(value);
    });
  }

  return { init };
})();
