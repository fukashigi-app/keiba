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

      bgmVolume: document.getElementById('admin-bgm-volume'),
      seVolume: document.getElementById('admin-se-volume'),
      voiceVolume: document.getElementById('admin-voice-volume'),
      speechRate: document.getElementById('admin-speech-rate'),

      testBgmTitleBtn: document.getElementById('admin-test-bgm-title'),
      testBgmEntryBtn: document.getElementById('admin-test-bgm-entry'),
      testBgmVoteBtn: document.getElementById('admin-test-bgm-vote'),
      testBgmRaceBtn: document.getElementById('admin-test-bgm-race'),
      testBgmResultBtn: document.getElementById('admin-test-bgm-result'),
      testSeStartBtn: document.getElementById('admin-test-se-start'),
      testSeGoalBtn: document.getElementById('admin-test-se-goal'),
      testVoiceBtn: document.getElementById('admin-test-voice'),
      audioStatus: document.getElementById('admin-audio-status'),
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
    el.bgmVolume.value = s.bgmVolume;
    el.seVolume.value = s.seVolume;
    el.voiceVolume.value = s.voiceVolume;
    el.speechRate.value = s.speechRate;
  }

  function bindEvents() {
    el.toggleBtn.addEventListener('click', () => {
      el.panel.classList.toggle('hidden');
      // パネルを開くたびに現在の音声状態を表示する（本番中に音が出ない
      // 場合の原因調査は管理パネル内だけで完結させ、一般画面には出さない）。
      if (!el.panel.classList.contains('hidden')) {
        showAudioDiagnostics();
      }
    });
    el.closeBtn.addEventListener('click', () => {
      el.panel.classList.add('hidden');
    });

    el.btnNewRace.addEventListener('click', () => { AudioManager.playSe('decide'); UI.startNewRace(); });
    el.btnStart.addEventListener('click', () => { AudioManager.playSe('decide'); UI.adminStartRace(); });
    el.btnReset.addEventListener('click', () => { AudioManager.playSe('click'); UI.resetToTop(); });

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

    el.bgmVolume.addEventListener('input', (e) => {
      const value = Number(e.target.value);
      AppState.settings.bgmVolume = value;
      AudioManager.setBgmVolume(value);
    });
    el.seVolume.addEventListener('input', (e) => {
      const value = Number(e.target.value);
      AppState.settings.seVolume = value;
      AudioManager.setSeVolume(value);
    });
    el.voiceVolume.addEventListener('input', (e) => {
      const value = Number(e.target.value);
      AppState.settings.voiceVolume = value;
      Commentary.setVolume(value);
    });
    el.speechRate.addEventListener('input', (e) => {
      const value = Number(e.target.value);
      AppState.settings.speechRate = value;
      Commentary.setRate(value);
    });

    el.testBgmTitleBtn.addEventListener('click', () => {
      AudioManager.unlock();
      AudioManager.testBgm('title');
      window.setTimeout(showAudioDiagnostics, 400);
    });
    el.testBgmEntryBtn.addEventListener('click', () => {
      AudioManager.unlock();
      AudioManager.testBgm('entry');
      window.setTimeout(showAudioDiagnostics, 400);
    });
    el.testBgmVoteBtn.addEventListener('click', () => {
      AudioManager.unlock();
      AudioManager.testBgm('vote');
      window.setTimeout(showAudioDiagnostics, 400);
    });
    el.testBgmRaceBtn.addEventListener('click', () => {
      AudioManager.unlock();
      AudioManager.testBgm('race');
      window.setTimeout(showAudioDiagnostics, 400);
    });
    el.testBgmResultBtn.addEventListener('click', () => {
      AudioManager.unlock();
      AudioManager.testBgm('result');
      window.setTimeout(showAudioDiagnostics, 400);
    });
    el.testSeStartBtn.addEventListener('click', () => {
      AudioManager.unlock();
      AudioManager.testSe('start');
      window.setTimeout(showAudioDiagnostics, 400);
    });
    el.testSeGoalBtn.addEventListener('click', () => {
      AudioManager.unlock();
      AudioManager.testSe('goal');
      window.setTimeout(showAudioDiagnostics, 400);
    });
    el.testVoiceBtn.addEventListener('click', () => {
      Commentary.unlock();
      Commentary.speak('実況テストです。聞こえていますか？');
      window.setTimeout(showAudioDiagnostics, 400);
    });
  }

  /**
   * 「音が出ない」場合の原因候補を管理画面に表示する。
   * AudioManager / Commentary の現在の状態から機械的に判定する。
   */
  function showAudioDiagnostics() {
    const diag = AudioManager.getDiagnostics();
    const reasons = [];

    if (!diag.unlocked) {
      reasons.push('音声ONボタンを押してください');
    }
    if (diag.lastPlayError === 'NotAllowedError') {
      reasons.push('ブラウザの自動再生制限により停止中です');
    }
    if (!Commentary.isSupported()) {
      reasons.push('この端末・ブラウザは実況の読み上げ（SpeechSynthesis）に対応していません');
    }
    const missingFiles = Object.entries(diag.fileStatus)
      .filter(([, status]) => status === 'missing')
      .map(([key]) => key);
    if (missingFiles.length > 0) {
      reasons.push(`音声ファイルが見つかりません（${missingFiles.join(', ')}）`);
    }
    if (diag.bgmVolume <= 0 && diag.seVolume <= 0) {
      reasons.push('BGM・効果音の音量が0に設定されています');
    }
    if (!diag.bgmEnabled && !diag.seEnabled) {
      reasons.push('BGM・効果音がOFFになっています');
    }
    reasons.push('端末本体の音量もあわせてご確認ください');

    el.audioStatus.textContent = reasons.join('\n');
    el.audioStatus.classList.toggle('status-warn', reasons.length > 1);
  }

  return { init };
})();
