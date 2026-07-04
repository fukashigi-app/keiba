/**
 * main.js
 * ------------------------------------------------------------
 * アプリのエントリーポイント。DOM読み込み後に各モジュールを初期化する。
 * ------------------------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
  Commentary.setEnabled(AppState.settings.commentaryEnabled);
  Commentary.setRate(AppState.settings.speechRate);
  Commentary.setVolume(AppState.settings.volume);

  UI.init();
  Admin.init();

  // 初期音量・BGM/SE設定を反映
  AudioManager.setVolume(AppState.settings.volume);
  AudioManager.setBgmEnabled(AppState.settings.bgmEnabled);
  AudioManager.setSeEnabled(AppState.settings.seEnabled);
});
