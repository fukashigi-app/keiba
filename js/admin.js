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

    // 要素が見つからない場合（IDの変更・削除など）は、無言で失敗せず
    // コンソールにはっきり出す。管理パネルは店舗運営に必須のため、
    // ここで気付けないと「設定ボタンが反応しない」原因調査が長引く。
    const missing = Object.entries(el).filter(([, node]) => !node).map(([key]) => key);
    if (missing.length > 0) {
      console.error('[Admin] 以下の要素が見つかりません（HTMLのID変更・削除の可能性）:', missing);
      if (!el.toggleBtn || !el.panel) return;
    }

    applySettingsToInputs();
    bindEvents();
  }

  function isPanelOpen() {
    return !el.panel.classList.contains('hidden');
  }

  function openPanel() {
    el.panel.classList.remove('hidden');
    // パネルを開くたびに現在の音声状態を表示する（本番中に音が出ない
    // 場合の原因調査は管理パネル内だけで完結させ、一般画面には出さない）。
    showAudioDiagnostics();
  }

  function closePanel() {
    el.panel.classList.add('hidden');
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
    el.toggleBtn.addEventListener('click', (e) => {
      // documentレベルの背景クリック判定より先にこのイベントが処理される
      // ため、開いた直後に背景クリック扱いで即座に閉じてしまわないよう
      // 伝播を止めておく。
      e.stopPropagation();
      if (isPanelOpen()) {
        closePanel();
      } else {
        openPanel();
      }
    });
    el.closeBtn.addEventListener('click', () => closePanel());

    // 背景（パネル・トグルボタン以外の場所）をクリックしたら閉じる。
    document.addEventListener('click', (e) => {
      if (!isPanelOpen()) return;
      if (el.panel.contains(e.target) || el.toggleBtn.contains(e.target)) return;
      closePanel();
    });

    // PC操作を前提に、Escapeキーでも閉じられるようにする。
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isPanelOpen()) {
        closePanel();
      }
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
