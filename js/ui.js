/**
 * ui.js
 * ------------------------------------------------------------
 * 画面遷移・演出・レースアニメーションを担当するモジュール。
 * ゲーム進行の中心（ステートマシン）はここにまとまっている。
 *
 * 画面の流れ:
 *   トップ → 馬紹介 → 投票受付 → (STARTボタン) → カウントダウン
 *   → レース → 結果 → (もう一度レース) → 馬紹介 ...
 * ------------------------------------------------------------
 */

const UI = (() => {
  // 馬番ごとの実際の描画幅(px)。馬のサイズは画面幅に応じてCSSで
  // 自動的に伸縮するため、位置計算にはこの実測値を使う。
  const horseWidths = {};

  // DOM要素はinit()内でまとめて取得する
  let el = {};

  function init() {
    el = {
      screens: document.querySelectorAll('.screen'),
      screenTop: document.getElementById('screen-top'),
      screenLineup: document.getElementById('screen-lineup'),
      screenVoting: document.getElementById('screen-voting'),
      screenCountdown: document.getElementById('screen-countdown'),
      screenRace: document.getElementById('screen-race'),
      screenResult: document.getElementById('screen-result'),

      btnNewRace: document.getElementById('btn-new-race'),
      btnHowto: document.getElementById('btn-howto'),
      btnCloseHowto: document.getElementById('btn-close-howto'),
      modalHowto: document.getElementById('modal-howto'),
      btnSoundOn: document.getElementById('btn-sound-on'),

      lineupGrid: document.getElementById('lineup-grid'),
      lineupTimer: document.getElementById('lineup-timer'),
      lineupRaceInfo: document.getElementById('lineup-race-info'),
      btnSkipLineup: document.getElementById('btn-skip-lineup'),

      votingTimer: document.getElementById('voting-timer'),
      votingGrid: document.getElementById('voting-grid'),
      votingRaceInfo: document.getElementById('voting-race-info'),

      countdownNumber: document.getElementById('countdown-number'),

      raceTrack: document.getElementById('race-track'),
      raceTrackWrap: document.querySelector('.race-track-wrap'),
      raceRanking: document.getElementById('race-ranking'),
      commentaryTicker: document.getElementById('commentary-ticker'),
      raceDistanceFill: document.getElementById('race-distance-fill'),
      photoFinishOverlay: document.getElementById('photo-finish-overlay'),
      pfFlash: document.getElementById('pf-flash'),
      pfText: document.getElementById('pf-text'),

      resultWinner: document.getElementById('result-winner'),
      resultPodium: document.getElementById('result-podium'),
      resultList: document.getElementById('result-list'),
      btnRestart: document.getElementById('btn-restart'),
    };

    bindEvents();
    AudioManager.init();
    showScreen('top');
  }

  function bindEvents() {
    el.btnNewRace.addEventListener('click', startNewRace);
    el.btnHowto.addEventListener('click', () => el.modalHowto.classList.remove('hidden'));
    el.btnCloseHowto.addEventListener('click', () => el.modalHowto.classList.add('hidden'));
    el.btnSkipLineup.addEventListener('click', () => {
      AppState.clearAllTimers();
      startVotingPhase();
    });
    el.btnRestart.addEventListener('click', startNewRace);
    el.btnSoundOn.addEventListener('click', enableSound);
  }

  /**
   * トップ画面の「🔊 音声をONにする」ボタン。
   * ユーザー操作の中で明示的に音声再生を解錠し、確認のセリフを
   * 読み上げることで、音が出ているかその場で分かるようにする。
   */
  function enableSound() {
    AudioManager.unlock();
    Commentary.unlock();
    Commentary.speak('音声が有効になりました');
    el.btnSoundOn.textContent = '🔊 音声ON';
    el.btnSoundOn.classList.add('sound-on');
  }

  function showScreen(name) {
    el.screens.forEach((s) => s.classList.remove('active'));
    const target = document.getElementById(`screen-${name}`);
    if (target) target.classList.add('active');
    AppState.runtime.currentScreen = name;
    // レース中は管理ボタンが馬やゴールラインに被らないよう非表示にする
    document.body.classList.toggle('race-in-progress', name === 'race');
  }

  // ------------------------------------------------------------
  // 1. 新しいレース開始 → 馬紹介
  // ------------------------------------------------------------
  function startNewRace() {
    AppState.clearAllTimers();
    Commentary.speak('');
    el.photoFinishOverlay.classList.add('hidden');
    AppState.runtime.horses = HorseGenerator.generateHorses();
    // 「今日の調子」は毎レースごとに変わる一時的な状態のため、
    // 馬を生成した直後にここで割り当てる。
    AppState.runtime.horses.forEach((horse) => {
      horse.condition = RaceConditions.pickRandomCondition();
    });
    AppState.runtime.raceResult = null;
    AppState.runtime.raceNumber += 1;
    AppState.runtime.course = RaceConditions.pickRandomCourse();
    AppState.runtime.weather = RaceConditions.pickRandomWeather();

    renderRaceInfo(el.lineupRaceInfo);
    renderHorseGrid(el.lineupGrid, AppState.runtime.horses, AppState.runtime.course);
    showScreen('lineup');
    AudioManager.playBgm('pre');
    startLineupCountdown();
  }

  /**
   * 「第Nレース／コース／天候」の案内板を描画する。
   * 馬紹介画面・投票受付画面の両方から呼ばれる共通処理。
   */
  function renderRaceInfo(infoEl) {
    const { raceNumber, course, weather } = AppState.runtime;
    infoEl.innerHTML = `
      <div class="race-info-rule"></div>
      <div class="race-info-row race-info-title">第${raceNumber}レース</div>
      <div class="race-info-row">コース：${course.label}</div>
      <div class="race-info-row">天候：${weather.label}</div>
      <div class="race-info-rule"></div>
    `;
  }

  /**
   * 出走馬一覧のカードを指定のグリッド要素に描画する。
   * 馬紹介画面・投票受付画面の両方から呼ばれる共通処理。
   */
  function renderHorseGrid(gridEl, horses, course) {
    gridEl.innerHTML = '';
    horses.forEach((horse) => {
      const card = document.createElement('div');
      card.className = 'horse-card';
      card.style.setProperty('--jersey', horse.color);
      const turfHighlight = course && course.surface === 'turf' ? 'aptitude-active' : '';
      const dirtHighlight = course && course.surface === 'dirt' ? 'aptitude-active' : '';
      const condition = horse.condition || RaceConditions.CONDITION_TIERS[2];
      const favored = RaceConditions.getFavoredSurfaceLabel(horse);
      card.innerHTML = `
        <div class="horse-card-number">${horse.number}</div>
        <div class="horse-card-name">${horse.name}</div>
        <div class="stat-row"><span>Speed</span><div class="stat-bar"><div class="stat-fill" style="width:${horse.speed}%"></div></div><span class="stat-val">${horse.speed}</span></div>
        <div class="stat-row"><span>Stamina</span><div class="stat-bar"><div class="stat-fill" style="width:${horse.stamina}%"></div></div><span class="stat-val">${horse.stamina}</span></div>
        <div class="stat-row"><span>Luck</span><div class="stat-bar"><div class="stat-fill" style="width:${horse.luck}%"></div></div><span class="stat-val">${horse.luck}</span></div>
        <div class="badge-row">
          <span class="condition-pill condition-${condition.id}">調子：${condition.label}</span>
          <span class="favored-pill">得意：${favored}</span>
        </div>
        <div class="aptitude-row">
          <div class="aptitude-item ${turfHighlight}"><span>芝</span><span class="aptitude-stars">${RaceConditions.starString(horse.turfAptitude)}</span></div>
          <div class="aptitude-item ${dirtHighlight}"><span>ダート</span><span class="aptitude-stars">${RaceConditions.starString(horse.dirtAptitude)}</span></div>
        </div>
      `;
      gridEl.appendChild(card);
    });
  }

  function startLineupCountdown() {
    let remaining = AppState.settings.lineupDuration;
    el.lineupTimer.textContent = `投票開始まで ${remaining}秒`;
    const id = setInterval(() => {
      remaining -= 1;
      el.lineupTimer.textContent = `投票開始まで ${remaining}秒`;
      if (remaining <= 0) {
        clearInterval(id);
        startVotingPhase();
      }
    }, 1000);
    AppState.registerTimer(id);
  }

  // ------------------------------------------------------------
  // 2. 投票受付
  // ------------------------------------------------------------
  function startVotingPhase() {
    AppState.clearAllTimers();
    renderRaceInfo(el.votingRaceInfo);
    renderHorseGrid(el.votingGrid, AppState.runtime.horses, AppState.runtime.course);
    showScreen('voting');

    let remaining = AppState.settings.votingDuration;
    el.votingTimer.textContent = remaining;
    const id = setInterval(() => {
      remaining -= 1;
      el.votingTimer.textContent = Math.max(0, remaining);
      if (remaining <= 0) {
        clearInterval(id);
        // 投票終了 → 自動的にカウントダウンへ進み、そのままレースを開始する
        runCountdownThenRace();
      }
    }, 1000);
    AppState.registerTimer(id);
  }

  /**
   * 管理画面の「START」ボタンから呼ばれる。
   * 投票中でも呼ばれた時点で強制的にカウントダウンへ進む。
   */
  function adminStartRace() {
    if (AppState.runtime.currentScreen !== 'voting') return;
    AppState.clearAllTimers();
    runCountdownThenRace();
  }

  // ------------------------------------------------------------
  // 3. カウントダウン → レース
  // ------------------------------------------------------------
  function runCountdownThenRace() {
    showScreen('countdown');
    const sequence = ['3', '2', '1', 'GO!!'];
    let i = 0;

    function step() {
      el.countdownNumber.textContent = sequence[i];
      el.countdownNumber.classList.remove('pop');
      // reflow でアニメーションを再トリガー
      void el.countdownNumber.offsetWidth;
      el.countdownNumber.classList.add('pop');

      if (sequence[i] === 'GO!!') {
        AudioManager.playSe('gate');
        AudioManager.playSe('start');
        Commentary.speakCategory('start');
      }

      i += 1;
      if (i < sequence.length) {
        const id = setTimeout(step, 800);
        AppState.registerTimer(id);
      } else {
        const id = setTimeout(runRace, 800);
        AppState.registerTimer(id);
      }
    }
    step();
  }

  function renderTrack(horses) {
    el.raceTrack.innerHTML = '';
    horses.forEach((horse) => {
      const lane = document.createElement('div');
      lane.className = 'lane';
      lane.innerHTML = `
        <div class="lane-number">${horse.number}</div>
        <div class="lane-track">
          <div class="start-line"></div>
          <div class="finish-line"></div>
          <div class="horse" id="horse-${horse.number}" style="--jersey:${horse.color}">
            <div class="horse-tail"></div>
            <div class="horse-body"></div>
            <div class="horse-leg leg-front-1"></div>
            <div class="horse-leg leg-front-2"></div>
            <div class="horse-leg leg-back-1"></div>
            <div class="horse-leg leg-back-2"></div>
            <div class="horse-mane"></div>
            <div class="horse-neck-head"></div>
            <div class="horse-ear"></div>
            <div class="horse-badge">${horse.number}</div>
          </div>
        </div>
      `;
      el.raceTrack.appendChild(lane);
    });

    // 馬のサイズは画面幅に応じてCSSで自動的に伸縮するため、
    // 描画直後の実測幅を位置計算に使う（レーン単位の右端クランプ用）。
    horses.forEach((horse) => {
      const horseEl = document.getElementById(`horse-${horse.number}`);
      horseWidths[horse.number] = horseEl ? horseEl.offsetWidth : 0;
    });
  }

  function setHorsePosition(number, percent) {
    const horseEl = document.getElementById(`horse-${number}`);
    if (!horseEl) return;
    const width = horseWidths[number] || 0;
    horseEl.style.left = `calc((100% - ${width}px) * ${percent / 100})`;
  }

  /**
   * 現在の順位サイドバー（広い画面のみ表示）を更新する。
   */
  function updateRaceRanking(currentFrame, horses) {
    const ranked = horses
      .map((horse, i) => ({ horse, value: currentFrame[i] }))
      .sort((a, b) => b.value - a.value);

    el.raceRanking.innerHTML = `
      <div class="race-ranking-title">順位</div>
      ${ranked.map((entry, i) => `
        <div class="race-ranking-item">
          <span class="race-ranking-pos">${i + 1}</span>
          <span class="race-ranking-badge" style="--jersey:${entry.horse.color}">${entry.horse.number}</span>
        </div>
      `).join('')}
    `;
  }

  function runRace() {
    const horses = AppState.runtime.horses;
    const duration = AppState.settings.raceDuration;
    const { course, weather } = AppState.runtime;
    const result = RaceEngine.simulateRace(horses, duration, course, weather);
    AppState.runtime.raceResult = result;

    // 画面を表示してからDOMを構築する。非表示(display:none)のままだと
    // 馬要素の実測幅(offsetWidth)が0になってしまうため。
    showScreen('race');
    renderTrack(horses);
    document.querySelectorAll('.horse').forEach((h) => h.classList.add('running'));
    el.commentaryTicker.textContent = '';
    el.raceDistanceFill.style.width = '0%';
    el.raceTrackWrap.classList.remove('final-stretch');
    AudioManager.playBgm('race');
    AudioManager.playSe('running');

    const startTime = performance.now();
    let nextCommentaryAt = 1200; // ms
    let nextRankingUpdateAt = 0; // ms
    let hooveSePlayed = false;
    let cheerPlayed = false;
    let finalStretchStarted = false;

    function frame(now) {
      const elapsedMs = now - startTime;
      const elapsedSec = elapsedMs / 1000;
      // requestAnimationFrame の timestamp は startTime 取得より前の値になることがあるため、
      // 0未満にならないようクランプする（負のインデックス参照を防ぐ）
      const progress = Math.max(0, Math.min(1, elapsedSec / duration));

      const tickFloat = progress * result.totalTicks;
      const tickIndex = Math.min(result.totalTicks, Math.floor(tickFloat));
      const nextTickIndex = Math.min(result.totalTicks, tickIndex + 1);
      const lerpT = tickFloat - tickIndex;

      const currentFrame = result.displayFrames[tickIndex];
      const nextFrame = result.displayFrames[nextTickIndex];

      horses.forEach((horse, i) => {
        const value = currentFrame[i] + (nextFrame[i] - currentFrame[i]) * lerpT;
        setHorsePosition(horse.number, value);
      });

      el.raceDistanceFill.style.width = `${progress * 100}%`;

      if (elapsedMs >= nextRankingUpdateAt) {
        updateRaceRanking(currentFrame, horses);
        nextRankingUpdateAt = elapsedMs + 300;
      }

      if (elapsedMs >= nextCommentaryAt && progress < 1) {
        speakForProgress(progress, currentFrame, horses);
        nextCommentaryAt = elapsedMs + 1800 + Math.random() * 1800;
      }

      if (progress > 0.55 && !cheerPlayed) {
        cheerPlayed = true;
        AudioManager.playSe('cheer');
      }
      if (progress > 0.85 && !hooveSePlayed) {
        hooveSePlayed = true;
        AudioManager.playSe('running');
      }

      // 最後の直線：トラックをわずかにズーム＆点滅させて盛り上げる
      if (progress > 0.85 && !finalStretchStarted) {
        finalStretchStarted = true;
        el.raceTrackWrap.classList.add('final-stretch');
      }

      if (progress < 1) {
        AppState.runtime.animationFrameId = requestAnimationFrame(frame);
      } else {
        finishRace(result);
      }
    }
    AppState.runtime.animationFrameId = requestAnimationFrame(frame);
  }

  function speakForProgress(progress, currentFrame, horses) {
    const leaderIndex = RaceEngine.getLeaderIndex(currentFrame);
    const leader = horses[leaderIndex];
    const context = { number: leader.number, name: leader.name };

    // 上位2頭の差が僅かなら「接戦」セリフを混ぜる
    const sorted = [...currentFrame].sort((a, b) => b - a);
    const gap = sorted[0] - sorted[1];
    let text;
    if (gap < 2.5 && Math.random() < 0.5) {
      text = Commentary.speakCategory('close', context);
    } else if (progress < 0.35) {
      text = Commentary.speakCategory('early', context);
    } else if (progress < 0.75) {
      text = Commentary.speakCategory('middle', context);
    } else {
      text = Commentary.speakCategory('finalStretch', context);
    }
    showTicker(text);
  }

  /**
   * 実況テロップを更新する。音声実況と同じ内容を文字でも表示する。
   */
  function showTicker(text) {
    if (!text) return;
    el.commentaryTicker.textContent = text;
    el.commentaryTicker.classList.remove('pop');
    void el.commentaryTicker.offsetWidth; // アニメーション再トリガー用のreflow
    el.commentaryTicker.classList.add('pop');
  }

  /**
   * ゴール演出：GOAL! → PHOTO FINISH → 結果画面 の順に流す。
   */
  function finishRace(result) {
    document.querySelectorAll('.horse').forEach((h) => h.classList.remove('running'));
    AudioManager.playSe('goal');
    AudioManager.playSe('cheer');
    const finishText = Commentary.speakCategory('finishLine');
    showTicker(finishText);

    el.photoFinishOverlay.classList.remove('hidden');
    el.pfText.textContent = 'GOAL!';
    el.pfText.classList.remove('show');
    el.pfFlash.classList.remove('flash');
    void el.pfFlash.offsetWidth;
    el.pfFlash.classList.add('flash');
    el.pfText.classList.add('show');

    const toPhotoFinish = setTimeout(() => {
      el.pfText.classList.remove('show');
      void el.pfText.offsetWidth;
      el.pfText.textContent = 'PHOTO FINISH';
      el.pfText.classList.add('show');
    }, 600);
    AppState.registerTimer(toPhotoFinish);

    const toResult = setTimeout(() => {
      el.photoFinishOverlay.classList.add('hidden');
      showResult(result);
    }, 1600);
    AppState.registerTimer(toResult);
  }

  // ------------------------------------------------------------
  // 4. 結果発表
  // ------------------------------------------------------------
  function showResult(result) {
    AudioManager.stopBgm();
    AudioManager.playBgm('result');
    AudioManager.playSe('fanfare');
    showScreen('result');

    const ranking = result.ranking;
    const winner = ranking.find((r) => r.place === 1).horse;

    el.resultWinner.innerHTML = `
      <div class="winner-label">WINNER</div>
      <div class="winner-number">${winner.number}</div>
      <div class="winner-name">${winner.name}</div>
    `;

    const medal = { 1: '🥇', 2: '🥈', 3: '🥉' };
    el.resultPodium.innerHTML = ranking
      .filter((r) => r.place <= 3)
      .map((r) => `
        <div class="podium-item place-${r.place}">
          <div class="podium-medal">${medal[r.place]}</div>
          <div class="podium-number" style="--jersey:${r.horse.color}">${r.horse.number}</div>
          <div class="podium-name">${r.horse.name}</div>
        </div>
      `).join('');

    el.resultList.innerHTML = ranking
      .filter((r) => r.place > 3)
      .map((r) => `
        <div class="result-row">
          <span class="result-place">${r.place}位</span>
          <span class="result-number" style="--jersey:${r.horse.color}">${r.horse.number}</span>
          <span class="result-name">${r.horse.name}</span>
        </div>
      `).join('');

    Commentary.speakCategory('winnerAnnounce', { number: winner.number, name: winner.name });
  }

  // ------------------------------------------------------------
  // リセット
  // ------------------------------------------------------------
  function resetToTop() {
    AppState.clearAllTimers();
    AudioManager.stopBgm();
    Commentary.setEnabled(Commentary.isSupported() && AppState.settings.commentaryEnabled);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    AppState.runtime.horses = [];
    AppState.runtime.raceResult = null;
    el.photoFinishOverlay.classList.add('hidden');
    showScreen('top');
  }

  return {
    init,
    startNewRace,
    adminStartRace,
    resetToTop,
  };
})();
