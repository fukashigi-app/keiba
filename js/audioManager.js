/**
 * audioManager.js
 * ------------------------------------------------------------
 * BGM・効果音の再生を担当するモジュール。
 *
 * 音源ファイルは assets/audio/ に配置する想定（README参照）。
 * 音源が存在しない場合でもエラーにせず、無音のまま正常に
 * ゲームが進行するようにフォールバックしてある。
 *
 * 商用利用可能 or CC0 素材のみを assets/audio/ に配置すること。
 * ------------------------------------------------------------
 */

const AudioManager = (() => {
  const BGM_FILES = {
    pre: 'assets/audio/bgm-pre.mp3',
    race: 'assets/audio/bgm-race.mp3',
    result: 'assets/audio/bgm-result.mp3',
  };

  const SE_FILES = {
    start: 'assets/audio/start.mp3',
    gate: 'assets/audio/gate.mp3',
    running: 'assets/audio/running.mp3',
    cheer: 'assets/audio/cheer.mp3',
    goal: 'assets/audio/goal.mp3',
    fanfare: 'assets/audio/fanfare.mp3',
  };

  // 同じ効果音を連続再生できるよう、キーごとに複数のAudio要素を
  // あらかじめ用意しておく（順番に使い回す）。毎回cloneNode()で
  // 新規要素を作ると、スマホ（特にiOS Safari）ではユーザー操作と
  // 無関係に生成された要素とみなされ再生がブロックされるため。
  const SE_POOL_SIZE = 3;

  let bgmEnabled = true;
  let seEnabled = true;
  let masterVolume = 0.7;
  let unlocked = false;

  let currentBgm = null;
  let currentBgmKey = null;

  const bgmElements = {};
  const sePools = {};
  const sePoolIndex = {};

  /**
   * Audio要素を作成する。読み込みエラーが出ても例外を投げず、
   * 単に「使えない音源」として扱う（ゲーム進行には影響しない）。
   */
  function createAudio(src, loop) {
    const audio = new Audio();
    audio.src = src;
    audio.loop = loop;
    audio.preload = 'auto';
    audio.addEventListener('error', () => {
      audio.dataset.unavailable = 'true';
    });
    return audio;
  }

  function init() {
    Object.entries(BGM_FILES).forEach(([key, src]) => {
      bgmElements[key] = createAudio(src, true);
    });
    Object.entries(SE_FILES).forEach(([key, src]) => {
      sePools[key] = Array.from({ length: SE_POOL_SIZE }, () => createAudio(src, false));
      sePoolIndex[key] = 0;
    });
  }

  function safePlay(audio) {
    if (!audio || audio.dataset.unavailable === 'true') return;
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // 音源未配置・ブラウザのオートプレイ制限などで再生できない場合は無視する
        });
      }
    } catch (e) {
      // 一部ブラウザでは無効な音源に対しplay()が同期的に例外を投げるため捕捉する
    }
  }

  /**
   * ユーザーの最初のタップ／クリックのタイミングで一度だけ呼び出す。
   * すべてのAudio要素を一度再生→即停止しておくことで、以降タイマー
   * 経由（ユーザー操作の外）で play() してもブラウザの自動再生制限に
   * ブロックされないようにする（スマホ対応）。
   */
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    const allAudios = [
      ...Object.values(bgmElements),
      ...Object.values(sePools).flat(),
    ];
    allAudios.forEach((audio) => {
      const originalVolume = audio.volume;
      audio.volume = 0;
      safePlay(audio);
      audio.pause();
      audio.currentTime = 0;
      audio.volume = originalVolume;
    });
  }

  function playBgm(key) {
    stopBgm();
    if (!bgmEnabled) return;
    const audio = bgmElements[key];
    if (!audio) return;
    audio.volume = masterVolume;
    audio.currentTime = 0;
    currentBgm = audio;
    currentBgmKey = key;
    safePlay(audio);
  }

  function stopBgm() {
    if (currentBgm) {
      currentBgm.pause();
      currentBgm.currentTime = 0;
    }
    currentBgm = null;
    currentBgmKey = null;
  }

  function playSe(key) {
    if (!seEnabled) return;
    const pool = sePools[key];
    if (!pool) return;
    const audio = pool[sePoolIndex[key]];
    sePoolIndex[key] = (sePoolIndex[key] + 1) % pool.length;
    audio.currentTime = 0;
    audio.volume = masterVolume;
    safePlay(audio);
  }

  function setBgmEnabled(value) {
    bgmEnabled = value;
    if (!bgmEnabled) stopBgm();
    else if (currentBgmKey) playBgm(currentBgmKey);
  }

  function setSeEnabled(value) {
    seEnabled = value;
  }

  function setVolume(value) {
    masterVolume = value;
    if (currentBgm) currentBgm.volume = masterVolume;
  }

  return {
    init,
    unlock,
    playBgm,
    stopBgm,
    playSe,
    setBgmEnabled,
    setSeEnabled,
    setVolume,
  };
})();
