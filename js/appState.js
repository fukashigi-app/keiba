/**
 * appState.js
 * ------------------------------------------------------------
 * アプリ全体で共有する状態と設定値を保持するモジュール。
 * 管理画面（admin.js）からはここの settings を書き換え、
 * 進行ロジック（ui.js）はここを参照して動作する。
 * ------------------------------------------------------------
 */

const AppState = (() => {
  const settings = {
    lineupDuration: 30, // 馬紹介画面の表示秒数
    votingDuration: 90, // 投票受付の秒数
    raceDuration: 60, // レース演出の秒数
    resultDuration: 20, // 結果画面の目安表示秒数（自動遷移はしない）
    commentaryEnabled: true,
    bgmEnabled: true,
    seEnabled: true,
    volume: 0.7,
    speechRate: 1.0,
  };

  const runtime = {
    horses: [],
    raceResult: null, // RaceEngine.simulateRace() の戻り値
    currentScreen: 'top',
    timers: [], // setTimeout/setInterval のID一覧（リセット時に一括クリア）
    animationFrameId: null,
    readyForStart: false, // 投票終了後、STARTボタン待ちかどうか
  };

  function registerTimer(id) {
    runtime.timers.push(id);
    return id;
  }

  function clearAllTimers() {
    runtime.timers.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
    runtime.timers = [];
    if (runtime.animationFrameId !== null) {
      cancelAnimationFrame(runtime.animationFrameId);
      runtime.animationFrameId = null;
    }
  }

  return {
    settings,
    runtime,
    registerTimer,
    clearAllTimers,
  };
})();
