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
  // 楕円トラックのジオメトリ（トラック実測サイズから算出）と、
  // 馬番ごとの内外レーンオフセット（重ならないよう固定で割り当てる）。
  let trackGeo = null;
  let wrapW = 0;
  let wrapH = 0;
  const laneOffsetByNumber = {};

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

      votingHeading: document.getElementById('voting-heading'),
      votingTimer: document.getElementById('voting-timer'),
      votingGrid: document.getElementById('voting-grid'),
      votingRaceInfo: document.getElementById('voting-race-info'),
      votingTicker: document.getElementById('voting-ticker'),

      countdownNumber: document.getElementById('countdown-number'),

      raceTrack: document.getElementById('race-track'),
      ovalHorses: document.getElementById('oval-horses'),
      ovalFinishLine: document.getElementById('oval-finish-line'),
      raceTrackWrap: document.querySelector('.race-track-wrap'),
      raceRanking: document.getElementById('race-ranking'),
      raceCourseInfo: document.getElementById('race-course-info'),
      raceRain: document.getElementById('race-rain'),
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
    AudioManager.playBgm('vote');
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
      <div class="race-info-row">コース：${course.surfaceLabel}</div>
      <div class="race-info-row">馬場：${course.conditionLabel}</div>
      <div class="race-info-row">天候：${weather.label}</div>
      <div class="race-info-rule"></div>
    `;
  }

  /**
   * レース画面上部に表示するコンパクトなコース情報バーを描画する。
   */
  function renderRaceCourseInfo(infoEl) {
    const { raceNumber, course, weather } = AppState.runtime;
    infoEl.innerHTML = `
      <span>第<b>${raceNumber}</b>レース</span>
      <span>コース：<b>${course.surfaceLabel}</b></span>
      <span>馬場：<b>${course.conditionLabel}</b></span>
      <span>天候：<b>${weather.label}</b></span>
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
      const heavyHighlight = course && course.condition === 'heavy' ? 'aptitude-active' : '';
      const condition = horse.condition || RaceConditions.CONDITION_TIERS[2];
      const favored = RaceConditions.getFavoredSurfaceLabel(horse);
      const style = horse.runningStyle || RaceConditions.RUNNING_STYLES[1];
      const compatComment = course ? RaceConditions.getCompatibilityComment(horse, course) : '';
      card.innerHTML = `
        <div class="horse-card-illust">
          <span class="horse-card-emoji">🐴</span>
          <img class="horse-card-img" alt="">
          <div class="horse-card-number">${horse.number}</div>
        </div>
        <div class="horse-card-name">${horse.name}</div>
        <div class="stat-row"><span>Speed</span><div class="stat-bar"><div class="stat-fill" style="width:${horse.speed}%"></div></div><span class="stat-val">${horse.speed}</span></div>
        <div class="stat-row"><span>Stamina</span><div class="stat-bar"><div class="stat-fill" style="width:${horse.stamina}%"></div></div><span class="stat-val">${horse.stamina}</span></div>
        <div class="stat-row"><span>Luck</span><div class="stat-bar"><div class="stat-fill" style="width:${horse.luck}%"></div></div><span class="stat-val">${horse.luck}</span></div>
        <div class="badge-row">
          <span class="condition-pill condition-${condition.id}">調子：${condition.label}</span>
          <span class="favored-pill">得意：${favored}</span>
          <span class="style-pill style-${style.id}">脚質：${style.label}</span>
        </div>
        <div class="aptitude-row">
          <div class="aptitude-item ${turfHighlight}"><span>芝</span><span class="aptitude-stars">${RaceConditions.starString(horse.turfAptitude)}</span></div>
          <div class="aptitude-item ${dirtHighlight}"><span>ダート</span><span class="aptitude-stars">${RaceConditions.starString(horse.dirtAptitude)}</span></div>
          <div class="aptitude-item ${heavyHighlight}"><span>重馬場</span><span class="aptitude-stars">${RaceConditions.starString(horse.heavyAptitude)}</span></div>
        </div>
        ${compatComment ? `<div class="compat-comment">${compatComment}</div>` : ''}
      `;
      gridEl.appendChild(card);

      const img = card.querySelector('.horse-card-img');
      img.addEventListener('load', () => card.classList.add('has-image'));
      img.addEventListener('error', () => img.removeAttribute('src'));
      img.src = `assets/images/horse${horse.number}.png`;
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
    el.votingHeading.textContent = '投票受付中';
    el.votingTicker.classList.add('hidden');

    let remaining = AppState.settings.votingDuration;
    el.votingTimer.textContent = remaining;

    // 残り10秒／0秒のアナウンスは、それぞれ一度だけ発生させる。
    let announced10 = false;
    let announcedEnd = false;

    const id = setInterval(() => {
      remaining -= 1;
      el.votingTimer.textContent = Math.max(0, remaining);

      if (remaining === 10 && !announced10) {
        announced10 = true;
        announceVotingEnd('まもなく投票終了です', 'まもなく投票終了です。投票券の記入を完了してください。');
      }

      if (remaining <= 0) {
        clearInterval(id);
        if (!announcedEnd) {
          announcedEnd = true;
          el.votingHeading.textContent = '投票終了！';
          announceVotingEnd('投票終了です', '投票終了です。');
        }
        AudioManager.fadeOutBgm(600);
        // 投票終了アナウンスが聞こえる猶予を置いてから、
        // 自動的にカウントダウンへ進み、そのままレースを開始する
        const toCountdown = setTimeout(runCountdownThenRace, 1200);
        AppState.registerTimer(toCountdown);
      }
    }, 1000);
    AppState.registerTimer(id);
  }

  /**
   * 投票終了間近のアナウンス。テロップは常に表示し、音声は「音声ON」が
   * 押されている場合のみ読み上げる（未押下時は無音のまま進行する）。
   */
  function announceVotingEnd(tickerText, speechText) {
    el.votingTicker.textContent = tickerText;
    el.votingTicker.classList.remove('hidden');
    if (AudioManager.isUnlocked()) {
      Commentary.speak(speechText);
    }
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

  /**
   * 楕円トラックの内外レーンオフセットを馬の頭数ぶん計算する。
   * offsetはRaceTrackGeometryの半径に加算する値（マイナス＝内側寄り）。
   *
   * 馬自体の見た目のサイズ(horseHeightPx)を考慮せずに余白を決めると、
   * 小さい画面（Rcが小さい）では馬の見た目がトラック外枠や内馬場に
   * はみ出して見切れてしまう。そのため馬の半径ぶんの余白(clearance)を
   * 必ず確保したうえで、外枠・内馬場の余白を決める。
   */
  function computeLaneOffsets(count, Rc, horseHeightPx) {
    // 馬シルエットは幅=高さの2倍で、コーナーでは進行方向に応じて
    // どの向きにも傾き得るため、中心から一番遠い角（半対角線）を
    // 基準に余白を確保する。半対角線 ≈ horseHeightPx×√1.25 に、
    // 最終直線の拡大演出(scale 1.02)の分の余裕も乗せておく。
    const clearance = horseHeightPx * 1.2;
    const outerMargin = Math.min(Rc * 0.5, Math.max(clearance + 6, Rc * 0.06));
    let innerMargin = Math.max(clearance + 20, Rc * 0.34);
    innerMargin = Math.min(innerMargin, Rc * 0.85); // 内馬場が潰れて負値化しないための安全上限
    const offsets = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      offsets.push(-innerMargin + (innerMargin - outerMargin) * t);
    }
    return { offsets, outerMargin, innerMargin };
  }

  function renderTrack(horses, course) {
    const isDirt = course && course.surface === 'dirt';
    el.raceTrack.className = `race-track surface-${course ? course.surface : 'turf'} condition-${course ? course.condition : 'good'}`;

    // トラックは表示済みの状態で実測する（display:noneのままだと0になるため）。
    wrapW = el.raceTrackWrap.clientWidth;
    wrapH = el.raceTrackWrap.clientHeight;
    trackGeo = RaceTrackGeometry.computeGeometry(wrapW, wrapH);

    const horseHeightPx = Math.max(16, Math.min(46, trackGeo.Rc * 0.3));
    el.raceTrack.style.setProperty('--horse-h', `${horseHeightPx}px`);

    const { offsets, outerMargin, innerMargin } = computeLaneOffsets(horses.length, trackGeo.Rc, horseHeightPx);
    horses.forEach((horse, i) => {
      laneOffsetByNumber[horse.number] = offsets[i];
    });
    // 内馬場は、一番内側のレーンよりさらに内側（余白ぶん引いた位置）に収める。
    el.raceTrack.style.setProperty('--infield-inset', `${Math.max(10, trackGeo.Rc - innerMargin + 10)}px`);

    el.ovalHorses.innerHTML = '';
    horses.forEach((horse) => {
      const slot = document.createElement('div');
      slot.className = 'horse-slot';
      slot.id = `horse-slot-${horse.number}`;
      slot.innerHTML = `
        <div class="horse${isDirt ? ' dust-active' : ''}" id="horse-${horse.number}" style="--jersey:${horse.color}">
          <div class="dust-puff dust-puff-1"></div>
          <div class="dust-puff dust-puff-2"></div>
          <div class="horse-tail"></div>
          <div class="horse-body"></div>
          <div class="horse-leg leg-front-1"></div>
          <div class="horse-leg leg-front-2"></div>
          <div class="horse-leg leg-back-1"></div>
          <div class="horse-leg leg-back-2"></div>
          <div class="horse-mane"></div>
          <div class="horse-neck-head"></div>
          <div class="horse-ear"></div>
          <div class="horse-eye"></div>
          <div class="horse-cheek"></div>
          <img class="horse-image" alt="">
        </div>
        <div class="horse-badge">${horse.number}</div>
      `;
      el.ovalHorses.appendChild(slot);
    });

    // 差し替え可能な馬イラスト（assets/images/horseN.png）。読み込めた
    // 場合だけ表示し、無い場合はCSSシルエットのまま表示を続ける。
    horses.forEach((horse) => {
      const img = document.querySelector(`#horse-${horse.number} .horse-image`);
      if (!img) return;
      img.addEventListener('load', () => {
        document.getElementById(`horse-${horse.number}`).classList.add('has-image');
      });
      img.addEventListener('error', () => {
        img.removeAttribute('src');
      });
      img.src = `assets/images/horse${horse.number}.png`;
    });

    // ゴール板：スタート＝ゴール地点に、進行方向と垂直な板を1本置く。
    // レーン帯の中央（内外オフセットの平均）に置くことで、外枠の外に
    // はみ出して見切れてしまわないようにする。
    const midOffset = offsets.reduce((sum, o) => sum + o, 0) / offsets.length;
    const finishPoint = RaceTrackGeometry.getPosition(0, trackGeo, midOffset);
    el.ovalFinishLine.style.left = `${wrapW / 2 + finishPoint.x}px`;
    el.ovalFinishLine.style.top = `${wrapH / 2 + finishPoint.y}px`;
    el.ovalFinishLine.style.height = `${(innerMargin - outerMargin) + horseHeightPx}px`;
    // このバーは幅5px・高さ大の「縦棒」として定義してあるため、進行方向
    // (angleDeg)に対してそのまま回転させれば進行方向と垂直（コースを
    // 横切る向き）になる（+90すると逆に進行方向と平行になってしまう）。
    el.ovalFinishLine.style.transform = `translate(-50%, -50%) rotate(${finishPoint.angleDeg}deg)`;

    // 雨の日は水しぶきで足元が見えにくくなるため、track-wrap全体に
    // 雨エフェクトを重ねる。
    el.raceRain.classList.toggle('hidden', !(AppState.runtime.weather && AppState.runtime.weather.id === 'rainy'));
  }

  function setHorsePosition(number, percent) {
    const slot = document.getElementById(`horse-slot-${number}`);
    const horseEl = document.getElementById(`horse-${number}`);
    if (!slot || !horseEl || !trackGeo) return;
    const offset = laneOffsetByNumber[number] || 0;
    const pos = RaceTrackGeometry.getPosition(percent / 100, trackGeo, offset);
    slot.style.left = `${wrapW / 2 + pos.x}px`;
    slot.style.top = `${wrapH / 2 + pos.y}px`;

    // サイドビューの馬シルエットを進行方向に合わせる：上下逆さまにならないよう
    // 左右反転(scaleX)で向きを変え、コーナーでは軽いバンク角(rotate)だけ加える。
    const angleRad = (pos.angleDeg * Math.PI) / 180;
    const facingLeft = Math.cos(angleRad) < 0;
    const flip = facingLeft ? -1 : 1;
    const bank = Math.sin(angleRad) * (facingLeft ? -10 : 10);
    horseEl.style.transform = `scaleX(${flip}) rotate(${bank}deg)`;
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
    renderRaceCourseInfo(el.raceCourseInfo);
    renderTrack(horses, course);
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

      // 最後の直線：トラックをわずかにズーム＆点滅させ、BGMもわずかに盛り上げる
      if (progress > 0.85 && !finalStretchStarted) {
        finalStretchStarted = true;
        el.raceTrackWrap.classList.add('final-stretch');
        AudioManager.raiseBgmForFinalStretch();
      }

      if (progress < 1) {
        AppState.runtime.animationFrameId = requestAnimationFrame(frame);
      } else {
        finishRace(result);
      }
    }
    AppState.runtime.animationFrameId = requestAnimationFrame(frame);
  }

  // 脚質ID → 実況カテゴリ名
  const STYLE_COMMENTARY_CATEGORY = {
    nige: 'styleNige',
    senko: 'styleSenko',
    sashi: 'styleSashi',
    oikomi: 'styleOikomi',
  };

  function speakForProgress(progress, currentFrame, horses) {
    const leaderIndex = RaceEngine.getLeaderIndex(currentFrame);
    const leader = horses[leaderIndex];
    const context = { number: leader.number, name: leader.name };
    const course = AppState.runtime.course;

    // 上位2頭の差が僅かなら「接戦」セリフを混ぜる
    const sorted = [...currentFrame].sort((a, b) => b - a);
    const gap = sorted[0] - sorted[1];
    let text;
    if (gap < 2.5 && Math.random() < 0.5) {
      text = Commentary.speakCategory('close', context);
    } else if (course && course.condition === 'heavy' && progress > 0.4 && Math.random() < 0.25) {
      // 重馬場では、展開とは別に「足元が重い」実況を時々混ぜる
      text = Commentary.speakCategory('heavyStruggle');
    } else if (leader.runningStyle && Math.random() < 0.5) {
      // 先頭馬の脚質に合わせた実況を優先的に混ぜる
      text = Commentary.speakCategory(STYLE_COMMENTARY_CATEGORY[leader.runningStyle.id], context);
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
    AudioManager.fadeOutBgm(400);
    AudioManager.playSe('goal');
    AudioManager.playSe('cheer');
    const finishText = Commentary.speakCategory('finishLine');
    showTicker(finishText);

    // 上位2頭の着差が僅かな場合だけ「PHOTO FINISH」演出を挟む。
    const top2 = result.ranking.slice(0, 2);
    const closeRace = top2.length === 2
      && (top2[0].rawDistance - top2[1].rawDistance) / top2[0].rawDistance < 0.02;

    el.photoFinishOverlay.classList.remove('hidden');
    el.pfText.textContent = 'GOAL!';
    el.pfText.classList.remove('show');
    el.pfFlash.classList.remove('flash');
    void el.pfFlash.offsetWidth;
    el.pfFlash.classList.add('flash');
    el.pfText.classList.add('show');

    if (closeRace) {
      const toPhotoFinish = setTimeout(() => {
        el.pfText.classList.remove('show');
        void el.pfText.offsetWidth;
        el.pfText.textContent = 'PHOTO FINISH';
        el.pfText.classList.add('show');
      }, 600);
      AppState.registerTimer(toPhotoFinish);
    }

    const toResult = setTimeout(() => {
      el.photoFinishOverlay.classList.add('hidden');
      showResult(result);
    }, closeRace ? 1600 : 1000);
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
    const course = AppState.runtime.course;
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
          <div class="podium-style">脚質：${r.horse.runningStyle.label} ／ コース：${course.surfaceLabel} ${course.conditionLabel}</div>
          <div class="podium-aptitude">${course.surfaceLabel}適性：${RaceConditions.starString(RaceConditions.getAptitude(r.horse, course))}</div>
          <div class="podium-comment">${RaceConditions.getCompatibilityComment(r.horse, course)}</div>
          <div class="podium-comment podium-winfactor">勝因：${RaceConditions.getResultComment(r.horse, r.place, course)}</div>
        </div>
      `).join('');

    el.resultList.innerHTML = ranking
      .filter((r) => r.place > 3)
      .map((r) => `
        <div class="result-row">
          <span class="result-place">${r.place}位</span>
          <span class="result-number" style="--jersey:${r.horse.color}">${r.horse.number}</span>
          <div class="result-info">
            <span class="result-name">${r.horse.name}</span>
            <span class="result-meta">脚質：${r.horse.runningStyle.label} ／ コース：${course.surfaceLabel} ${course.conditionLabel} ／ ${course.surfaceLabel}適性：${RaceConditions.starString(RaceConditions.getAptitude(r.horse, course))}</span>
            <span class="result-meta result-winfactor">${RaceConditions.getResultComment(r.horse, r.place, course)}</span>
          </div>
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
