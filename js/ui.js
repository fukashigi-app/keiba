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
  const HORSE_WIDTH_PX = 84;

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

      lineupGrid: document.getElementById('lineup-grid'),
      lineupTimer: document.getElementById('lineup-timer'),
      btnSkipLineup: document.getElementById('btn-skip-lineup'),

      votingTimer: document.getElementById('voting-timer'),
      votingGrid: document.getElementById('voting-grid'),

      countdownNumber: document.getElementById('countdown-number'),

      raceTrack: document.getElementById('race-track'),

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
  }

  function showScreen(name) {
    el.screens.forEach((s) => s.classList.remove('active'));
    const target = document.getElementById(`screen-${name}`);
    if (target) target.classList.add('active');
    AppState.runtime.currentScreen = name;
  }

  // ------------------------------------------------------------
  // 1. 新しいレース開始 → 馬紹介
  // ------------------------------------------------------------
  function startNewRace() {
    AppState.clearAllTimers();
    Commentary.speak('');
    AppState.runtime.horses = HorseGenerator.generateHorses();
    AppState.runtime.raceResult = null;

    renderHorseGrid(el.lineupGrid, AppState.runtime.horses);
    showScreen('lineup');
    AudioManager.playBgm('pre');
    startLineupCountdown();
  }

  /**
   * 出走馬一覧のカードを指定のグリッド要素に描画する。
   * 馬紹介画面・投票受付画面の両方から呼ばれる共通処理。
   */
  function renderHorseGrid(gridEl, horses) {
    gridEl.innerHTML = '';
    horses.forEach((horse) => {
      const card = document.createElement('div');
      card.className = 'horse-card';
      card.style.setProperty('--jersey', horse.color);
      card.innerHTML = `
        <div class="horse-card-number">${horse.number}</div>
        <div class="horse-card-name">${horse.name}</div>
        <div class="stat-row"><span>Speed</span><div class="stat-bar"><div class="stat-fill" style="width:${horse.speed}%"></div></div><span class="stat-val">${horse.speed}</span></div>
        <div class="stat-row"><span>Stamina</span><div class="stat-bar"><div class="stat-fill" style="width:${horse.stamina}%"></div></div><span class="stat-val">${horse.stamina}</span></div>
        <div class="stat-row"><span>Luck</span><div class="stat-bar"><div class="stat-fill" style="width:${horse.luck}%"></div></div><span class="stat-val">${horse.luck}</span></div>
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
    renderHorseGrid(el.votingGrid, AppState.runtime.horses);
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
          <div class="finish-line"></div>
          <div class="horse" id="horse-${horse.number}" style="--jersey:${horse.color}">
            <div class="horse-tail"></div>
            <div class="horse-body"></div>
            <div class="horse-leg leg-front-1"></div>
            <div class="horse-leg leg-front-2"></div>
            <div class="horse-leg leg-back-1"></div>
            <div class="horse-leg leg-back-2"></div>
            <div class="horse-neck"></div>
            <div class="horse-head"></div>
            <div class="horse-ear"></div>
            <div class="horse-badge">${horse.number}</div>
          </div>
        </div>
      `;
      el.raceTrack.appendChild(lane);
    });
  }

  function setHorsePosition(number, percent) {
    const horseEl = document.getElementById(`horse-${number}`);
    if (!horseEl) return;
    horseEl.style.left = `calc((100% - ${HORSE_WIDTH_PX}px) * ${percent / 100})`;
  }

  function runRace() {
    const horses = AppState.runtime.horses;
    const duration = AppState.settings.raceDuration;
    const result = RaceEngine.simulateRace(horses, duration);
    AppState.runtime.raceResult = result;

    renderTrack(horses);
    document.querySelectorAll('.horse').forEach((h) => h.classList.add('running'));
    showScreen('race');
    AudioManager.playBgm('race');
    AudioManager.playSe('hooves');

    const startTime = performance.now();
    let nextCommentaryAt = 1200; // ms
    let hooveSePlayed = false;
    let cheerPlayed = false;

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
        AudioManager.playSe('hooves');
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
    if (gap < 2.5 && Math.random() < 0.5) {
      Commentary.speakCategory('close', context);
      return;
    }

    if (progress < 0.35) {
      Commentary.speakCategory('early', context);
    } else if (progress < 0.75) {
      Commentary.speakCategory('middle', context);
    } else {
      Commentary.speakCategory('finalStretch', context);
    }
  }

  function finishRace(result) {
    document.querySelectorAll('.horse').forEach((h) => h.classList.remove('running'));
    AudioManager.playSe('goal');
    Commentary.speakCategory('finishLine');
    const id = setTimeout(() => showResult(result), 1200);
    AppState.registerTimer(id);
  }

  // ------------------------------------------------------------
  // 4. 結果発表
  // ------------------------------------------------------------
  function showResult(result) {
    AudioManager.stopBgm();
    AudioManager.playBgm('result');
    AudioManager.playSe('result');
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
    showScreen('top');
  }

  return {
    init,
    startNewRace,
    adminStartRace,
    resetToTop,
  };
})();
