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
    title: 'assets/audio/bgm-title.mp3',
    entry: 'assets/audio/bgm-entry.mp3',
    vote: 'assets/audio/bgm-vote.mp3',
    race: 'assets/audio/bgm-race.mp3',
    result: 'assets/audio/bgm-result.mp3',
  };

  const SE_FILES = {
    click: 'assets/audio/click.mp3',
    decide: 'assets/audio/decide.mp3',
    countdown: 'assets/audio/countdown.mp3',
    tick: 'assets/audio/tick.mp3',
    start: 'assets/audio/start.mp3',
    gate: 'assets/audio/gate.mp3',
    running: 'assets/audio/running.mp3',
    cheer: 'assets/audio/cheer.mp3',
    goal: 'assets/audio/goal.mp3',
    fanfare: 'assets/audio/fanfare.mp3',
    rankup: 'assets/audio/rankup.mp3',
  };

  // 同じ効果音を連続再生できるよう、キーごとに複数のAudio要素を
  // あらかじめ用意しておく（順番に使い回す）。毎回cloneNode()で
  // 新規要素を作ると、スマホ（特にiOS Safari）ではユーザー操作と
  // 無関係に生成された要素とみなされ再生がブロックされるため。
  const SE_POOL_SIZE = 3;

  let bgmEnabled = true;
  let seEnabled = true;
  let bgmVolume = 0.7;
  let seVolume = 0.7;
  let unlocked = false;
  let audioContext = null;

  let currentBgm = null;
  let currentBgmKey = null;

  const bgmElements = {};
  const sePools = {};
  const sePoolIndex = {};

  // 各音源ファイルが実際に読み込めたかどうか（音声デバッグ表示用）。
  // 'unknown'（未確定）→ 'ok'（読み込めた）／'missing'（見つからない）。
  const fileStatus = {};

  /**
   * Audio要素を作成する。読み込みエラーが出ても例外を投げず、
   * 単に「使えない音源」として扱う（ゲーム進行には影響しない）。
   */
  function createAudio(src, loop, statusKey) {
    const audio = new Audio();
    fileStatus[statusKey] = 'unknown';
    audio.addEventListener('error', () => {
      audio.dataset.unavailable = 'true';
      fileStatus[statusKey] = 'missing';
      console.warn(`[AudioManager] 音源が見つかりません: ${src}（無音のまま進行します）`);
    });
    audio.addEventListener('canplaythrough', () => {
      fileStatus[statusKey] = 'ok';
    }, { once: true });
    audio.src = src;
    audio.loop = loop;
    audio.preload = 'auto';
    return audio;
  }

  function init() {
    Object.entries(BGM_FILES).forEach(([key, src]) => {
      bgmElements[key] = createAudio(src, true, `bgm:${key}`);
    });
    Object.entries(SE_FILES).forEach(([key, src]) => {
      sePools[key] = Array.from({ length: SE_POOL_SIZE }, () => createAudio(src, false, `se:${key}`));
      sePoolIndex[key] = 0;
    });
  }

  // 直近のplay()失敗理由（音声デバッグ表示用）。'NotAllowedError'なら
  // ブラウザの自動再生制限でブロックされた可能性が高い。
  let lastPlayError = null;

  function safePlay(audio) {
    if (!audio || audio.dataset.unavailable === 'true') return;
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise
          .then(() => { lastPlayError = null; })
          .catch((err) => {
            // 音源未配置・ブラウザのオートプレイ制限などで再生できない場合は無視する
            lastPlayError = (err && err.name) || 'unknown';
          });
      }
    } catch (e) {
      lastPlayError = (e && e.name) || 'unknown';
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

    // Web Audio の AudioContext もユーザー操作の中で明示的に生成・resume()
    // しておく（iOS Safari 等ではこれが「サスペンド状態」のまま残っていると
    // 音声全般が抑制されることがあるため）。
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audioContext) {
        audioContext = new Ctx();
      }
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
    } catch (e) {
      // AudioContext が使えない環境でもゲームは続行できるため無視する
    }

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
    audio.volume = bgmVolume;
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

  // フェード中のBGMを追跡し、フェード完了前に次のBGMが始まっても
  // 二重にフェードループが走らないようにする。
  let fadeToken = 0;

  /**
   * 再生中のBGMを指定時間かけてゆっくりフェードアウトしてから停止する。
   * 素のHTMLAudioElementにはフェード機能が無いため、
   * requestAnimationFrameで音量を毎フレーム下げていく。
   */
  function fadeOutBgm(durationMs = 600) {
    const audio = currentBgm;
    if (!audio) return;
    const myToken = ++fadeToken;
    currentBgm = null;
    currentBgmKey = null;
    const startVolume = audio.volume;
    const startTime = performance.now();

    function step(now) {
      if (myToken !== fadeToken) return;
      // requestAnimationFrame の最初のtimestampはstartTime取得より前の
      // 値になることがあるため、tが負にならないようクランプする
      // （そのままだと volume に負の値を代入して例外になる）。
      const t = Math.max(0, Math.min(1, (now - startTime) / durationMs));
      audio.volume = startVolume * (1 - t);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = bgmVolume;
      }
    }
    requestAnimationFrame(step);
  }

  /**
   * 最後の直線でBGMをわずかに盛り上げる（音量を一段階上げる）。
   */
  function raiseBgmForFinalStretch() {
    if (currentBgm) {
      currentBgm.volume = Math.min(1, bgmVolume * 1.2);
    }
  }

  /**
   * 店舗BGMとして、場面転換のたびに自然にクロスフェードで切り替える。
   * 再生中のBGMがあれば同時にフェードアウトさせながら、次のBGMを
   * フェードインする（無ければ単純なフェードインになる）。
   * トップ→馬紹介/投票→レース→結果、の各切り替えで共通して使う。
   */
  function fadeToBgm(key, durationMs = 900) {
    const outgoing = currentBgm;
    const outgoingStartVolume = outgoing ? outgoing.volume : 0;
    currentBgm = null;
    currentBgmKey = null;

    const incoming = bgmEnabled ? bgmElements[key] : null;
    if (incoming && incoming !== outgoing) {
      incoming.currentTime = 0;
      incoming.volume = 0;
      safePlay(incoming);
    }

    const myToken = ++fadeToken;
    const startTime = performance.now();

    function step(now) {
      if (myToken !== fadeToken) return;
      // requestAnimationFrame の最初のtimestampはstartTime取得より前の
      // 値になることがあるため、tが負にならないようクランプする
      // （そのままだと volume に負の値を代入して例外になる）。
      const t = Math.max(0, Math.min(1, (now - startTime) / durationMs));
      if (outgoing && outgoing !== incoming) {
        outgoing.volume = outgoingStartVolume * (1 - t);
      }
      if (incoming) {
        incoming.volume = bgmVolume * t;
      }
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (outgoing && outgoing !== incoming) {
          outgoing.pause();
          outgoing.currentTime = 0;
          outgoing.volume = bgmVolume;
        }
        if (incoming) {
          currentBgm = incoming;
          currentBgmKey = key;
        }
      }
    }
    requestAnimationFrame(step);
  }

  function playSe(key) {
    if (!seEnabled) return;
    const pool = sePools[key];
    if (!pool) return;
    const audio = pool[sePoolIndex[key]];
    sePoolIndex[key] = (sePoolIndex[key] + 1) % pool.length;
    audio.currentTime = 0;
    audio.volume = seVolume;
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

  function setBgmVolume(value) {
    bgmVolume = value;
    if (currentBgm) currentBgm.volume = bgmVolume;
  }

  function setSeVolume(value) {
    seVolume = value;
  }

  /**
   * 管理画面の音声デバッグ用に、現在の状態をまとめて返す。
   * 「音が出ない場合の原因候補」を判定するために使う。
   */
  function getDiagnostics() {
    return {
      unlocked,
      bgmEnabled,
      seEnabled,
      bgmVolume,
      seVolume,
      audioContextState: audioContext ? audioContext.state : 'none',
      fileStatus: { ...fileStatus },
      lastPlayError,
    };
  }

  /** 管理画面の音声デバッグボタンから呼ばれる（キーを指定してテスト再生）。 */
  function testBgm(key) {
    lastPlayError = null;
    playBgm(key || 'race');
  }

  function testSe(key) {
    lastPlayError = null;
    playSe(key || 'start');
  }

  return {
    init,
    unlock,
    playBgm,
    stopBgm,
    fadeOutBgm,
    fadeToBgm,
    raiseBgmForFinalStretch,
    playSe,
    setBgmEnabled,
    setSeEnabled,
    setBgmVolume,
    setSeVolume,
    getDiagnostics,
    testBgm,
    testSe,
    isUnlocked: () => unlocked,
  };
})();
