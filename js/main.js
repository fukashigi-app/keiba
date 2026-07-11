/**
 * main.js
 * ------------------------------------------------------------
 * アプリのエントリーポイント。DOM読み込み後に各モジュールを初期化する。
 * ------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
  Commentary.setEnabled(AppState.settings.commentaryEnabled);
  Commentary.setRate(AppState.settings.speechRate);
  Commentary.setVolume(AppState.settings.voiceVolume);

  UI.init();
  Admin.init();

  // 初期音量・BGM/SE設定を反映
  AudioManager.setBgmVolume(AppState.settings.bgmVolume);
  AudioManager.setSeVolume(AppState.settings.seVolume);
  AudioManager.setBgmEnabled(AppState.settings.bgmEnabled);
  AudioManager.setSeEnabled(AppState.settings.seEnabled);

  // ブラウザの自動再生制限に対応するため、ユーザーの最初のタップ／
  // クリックのタイミングで音声再生を「解錠」する（スマホ・PC共通）。
  // どのボタンを押しても解錠されるよう、documentレベルで一度だけ拾う。
  const unlockAudio = () => {
    AudioManager.unlock();
    Commentary.unlock();
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  document.addEventListener('pointerdown', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
});
