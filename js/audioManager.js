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
    pre: 'assets/audio/bgm_pre.mp3',
    race: 'assets/audio/bgm_race.mp3',
    result: 'assets/audio/bgm_result.mp3',
  };

  const SE_FILES = {
    start: 'assets/audio/se_start.mp3',
    gate: 'assets/audio/se_gate.mp3',
    hooves: 'assets/audio/se_hooves.mp3',
    cheer: 'assets/audio/se_cheer.mp3',
    goal: 'assets/audio/se_goal.mp3',
    result: 'assets/audio/se_result.mp3',
  };

  let bgmEnabled = true;
  let seEnabled = true;
  let masterVolume = 0.7;

  let currentBgm = null;
  let currentBgmKey = null;

  const bgmElements = {};
  const seElements = {};

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
      seElements[key] = createAudio(src, false);
    });
  }

  function safePlay(audio) {
    if (!audio || audio.dataset.unavailable === 'true') return;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // 音源未配置・ブラウザのオートプレイ制限などで再生できない場合は無視する
      });
    }
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
    const audio = seElements[key];
    if (!audio) return;
    // 同じ効果音が連続で鳴らせるよう複製して再生する
    const clone = audio.cloneNode();
    clone.volume = masterVolume;
    safePlay(clone);
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
    playBgm,
    stopBgm,
    playSe,
    setBgmEnabled,
    setSeEnabled,
    setVolume,
  };
})();
