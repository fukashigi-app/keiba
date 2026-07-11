/**
 * raceEngine.js
 * ------------------------------------------------------------
 * レースシミュレーションのロジック本体。
 *
 * 順位決定ルール：「基本能力45% ＋ コース適性20% ＋ 脚質展開15% ＋ ランダム20%」
 *   - 毎ティック（コマ送りの1コマ）ごとに、各馬の能力値・コース適性・
 *     脚質による展開補正・ランダム値を 45:20:15:20 で合成した
 *     「進み幅」を積み上げていく。
 *   - 人気馬（能力値が高い馬）が毎回勝つことがないよう、ランダム性を
 *     しっかり効かせている。コース適性・脚質補正は「強すぎない」範囲に
 *     留めている。
 *   - Stamina が低い馬は後半にペースが落ちやすく、重馬場では重馬場適性が
 *     低い馬がさらに苦しくなる。
 *   - 脚質（逃げ／先行／差し／追込）ごとに「スタート／序盤／中盤／
 *     最後の直線」の4区間で有利不利が変わり、それぞれ違う走り方に見える。
 *   - 天候×コースの組み合わせにより、能力配分やコース適性の効き方が
 *     わずかに変化する（例：芝＋雨でスタミナ型がやや有利）。
 *
 * 画面表示用の位置（%）は、実際の順位決定に使う数値（rawDistance）とは
 * 別に「見た目の接戦感」を演出するための補正（圧縮）をかけている。
 * ------------------------------------------------------------
 */

const RaceEngine = (() => {
  const TICKS_PER_SECOND = 10;

  // 表示上、先頭と最後尾の差を詰めて「大接戦」に見せるための圧縮係数
  // (0に近いほど接戦、1にすると素の実力差がそのまま表示される)
  const VISUAL_COMPRESSION_FACTOR = 0.4;

  // レース進行の4区間の境界（進捗0〜1に対する割合）
  const PHASE_START_END = 0.10;
  const PHASE_EARLY_END = 0.45;
  const PHASE_MID_END = 0.75;

  function getPhase(progressFraction) {
    if (progressFraction <= PHASE_START_END) return 'start';
    if (progressFraction <= PHASE_EARLY_END) return 'early';
    if (progressFraction <= PHASE_MID_END) return 'mid';
    return 'final';
  }

  /**
   * 馬の総合能力値を 0〜1 のスコアに変換する。
   * Speed を重視しつつ、Stamina / Luck も反映する。
   * 芝＋雨の場合はスタミナ型がわずかに有利になるよう配分を調整する。
   * 「今日の調子」（horse.condition）による補正（±15%程度）も反映する。
   */
  function abilityScore(horse, course, weather) {
    let speedWeight = 0.5;
    let staminaWeight = 0.3;
    const luckWeight = 0.2;

    if (course.surface === 'turf' && weather.id === 'rainy') {
      speedWeight -= 0.05;
      staminaWeight += 0.05;
    }

    const base = (horse.speed * speedWeight + horse.stamina * staminaWeight + horse.luck * luckWeight) / 100;
    const conditionMultiplier = horse.condition ? horse.condition.abilityMultiplier : 1;
    return base * conditionMultiplier;
  }

  /**
   * コース適性を 0〜1 のスコアに変換する（芝／ダート適性＋重馬場適性の
   * ブレンドは RaceConditions 側で計算）。ダート＋雨の場合はさらに
   * ダート適性の効きをわずかに強める。
   */
  function aptitudeScore(horse, course, weather) {
    let score = RaceConditions.getCourseAptitudeScore(horse, course);
    if (course.surface === 'dirt' && weather.id === 'rainy') {
      score = Math.min(1, score * 1.2);
    }
    return score;
  }

  /**
   * 脚質（逃げ／先行／差し／追込）による、レース区間ごとの展開補正を
   * 0〜1のスコアで返す。0.5が中立、値が高いほどその区間で押し出せる。
   * 逃げの終盤はStaminaに応じて粘れるかどうかが変わる。
   */
  function runningStyleScore(horse, progressFraction) {
    const styleId = horse.runningStyle ? horse.runningStyle.id : 'senko';
    const phase = getPhase(progressFraction);
    const staminaFactor = horse.stamina / 100;

    switch (styleId) {
      case 'nige': // 逃げ：序盤は強いが、終盤はスタミナ次第で失速しやすい
        if (phase === 'start') return 0.85;
        if (phase === 'early') return 0.65;
        if (phase === 'mid') return 0.45;
        return 0.25 + staminaFactor * 0.35; // 終盤：0.25〜0.60
      case 'sashi': // 差し：序盤は中団、中盤から徐々に上がり直線で伸びる
        if (phase === 'start') return 0.42;
        if (phase === 'early') return 0.45;
        if (phase === 'mid') return 0.62;
        return 0.78;
      case 'oikomi': // 追込：後方待機からの終盤一気（ハマれば大きいがムラもある）
        if (phase === 'start') return 0.28;
        if (phase === 'early') return 0.32;
        if (phase === 'mid') return 0.5;
        return 0.88;
      case 'senko': // 先行：序盤から安定して前方を維持
      default:
        if (phase === 'start') return 0.62;
        if (phase === 'early') return 0.6;
        if (phase === 'mid') return 0.58;
        return 0.58;
    }
  }

  /**
   * レース全体をシミュレーションし、アニメーション再生用のフレーム列を作る。
   *
   * @param {Array} horses 出走馬の配列
   * @param {number} durationSeconds レース時間（秒）
   * @param {Object} course コース情報（RaceConditions.pickRandomCourse()の戻り値）
   * @param {Object} weather 天候情報（RaceConditions.pickRandomWeather()の戻り値）
   * @returns {{
   *   totalTicks:number,
   *   ticksPerSecond:number,
   *   displayFrames: number[][], // [tick][horseIndex] = 0-100(%)
   *   ranking: Array<{horse:Object, place:number, rawDistance:number}>
   * }}
   */
  function simulateRace(horses, durationSeconds, course, weather) {
    const totalTicks = Math.max(1, Math.round(durationSeconds * TICKS_PER_SECOND));
    const horseCount = horses.length;

    // 生の累積距離（順位決定の元になる数値）
    const rawFrames = [new Array(horseCount).fill(0)];

    // 各馬の「勢いの波（サージ）」の状態。ゴールまで数十回発生させることで、
    // レース中盤でも順位が頻繁に入れ替わる展開を作る。
    const surgeState = horses.map(() => ({ ticksRemaining: 0, multiplier: 1 }));

    for (let t = 1; t <= totalTicks; t++) {
      const progressFraction = t / totalTicks;
      const prev = rawFrames[t - 1];
      const current = new Array(horseCount);

      for (let i = 0; i < horseCount; i++) {
        const horse = horses[i];
        const ability = abilityScore(horse, course, weather);
        const aptitude = aptitudeScore(horse, course, weather);
        const style = runningStyleScore(horse, progressFraction);
        const randomComponent = Math.random();

        // 基本能力45% + コース適性20% + 脚質展開15% + ランダム20%
        let increment = ability * 0.45 + aptitude * 0.20 + style * 0.15 + randomComponent * 0.20;

        // Stamina が低い馬はレース後半（progress 0.5〜1.0）に失速しやすい
        if (progressFraction > 0.5) {
          const staminaFactor = horse.stamina / 100;
          const fatiguePenalty = (1 - staminaFactor) * (progressFraction - 0.5) * 0.6;
          increment -= fatiguePenalty;
        }

        // 重馬場では、重馬場適性が低い馬ほど中盤以降さらに苦しくなる
        // （「足元が重い」実況の裏付けとなる失速）
        if (course.condition === 'heavy' && progressFraction > 0.4) {
          const heavyFactor = horse.heavyAptitude / 5;
          const heavyPenalty = (1 - heavyFactor) * (progressFraction - 0.4) * 0.4;
          increment -= heavyPenalty;
        }

        // 勢いの波：一定確率で加速／失速が数ティック続く。Luckが高いほど
        // 加速側に振れやすく、大きく伸びる。誰にでも起こり得るため、
        // 終盤どころかレース全体を通じて先頭が入れ替わり続ける。
        // 「大穴気配」の馬、および終盤の「追込」馬は、この勢いの波が
        // 起きやすく・大きくなる（一発大逆転はあるが安定はしない）。
        const isWildcard = !!(horse.condition && horse.condition.wildcard);
        const isOikomiFinal = horse.runningStyle && horse.runningStyle.id === 'oikomi' && progressFraction > PHASE_MID_END;
        const surgeBoosted = isWildcard || isOikomiFinal;
        const surgeChance = surgeBoosted ? 0.06 : 0.035;
        const surge = surgeState[i];
        if (surge.ticksRemaining > 0) {
          increment *= surge.multiplier;
          surge.ticksRemaining -= 1;
        } else if (Math.random() < surgeChance) {
          const isSpurt = Math.random() < 0.4 + (horse.luck / 100) * 0.3;
          const spurtCeiling = surgeBoosted ? 0.9 : 0.7;
          surge.multiplier = isSpurt
            ? 1.5 + (horse.luck / 100) * spurtCeiling // 加速: 約1.5〜2.2倍（大穴・終盤追込は最大2.4倍）
            : 0.25 + Math.random() * 0.3; // 失速: 約0.25〜0.55倍
          surge.ticksRemaining = 8 + Math.floor(Math.random() * 10); // 0.8〜1.8秒持続
          increment *= surge.multiplier;
        }

        current[i] = prev[i] + Math.max(0.05, increment);
      }
      rawFrames.push(current);
    }

    // 最終順位を確定（最終ティックの累積距離が大きい順）
    const finalRaw = rawFrames[totalTicks];
    const ranking = horses
      .map((horse, i) => ({ horse, index: i, rawDistance: finalRaw[i] }))
      .sort((a, b) => b.rawDistance - a.rawDistance)
      .map((entry, order) => ({ ...entry, place: order + 1 }));

    const winnerDistance = ranking[0].rawDistance;

    // 表示用フレーム（%）を計算：先頭馬の生距離を100%として正規化しつつ、
    // 各ティックの先頭馬を基準に他馬を引き寄せて接戦に見せる。
    const displayFrames = rawFrames.map((frame) => {
      const rawPercents = frame.map((d) => Math.min(100, (d / winnerDistance) * 100));
      const leaderPercent = Math.max(...rawPercents);
      return rawPercents.map((p) => {
        const compressed = leaderPercent - (leaderPercent - p) * VISUAL_COMPRESSION_FACTOR;
        return Math.max(0, Math.min(100, compressed));
      });
    });

    return {
      totalTicks,
      ticksPerSecond: TICKS_PER_SECOND,
      displayFrames,
      ranking,
    };
  }

  /**
   * 指定フレームでの先頭馬（表示上のトップ）のインデックスを返す。
   */
  function getLeaderIndex(displayFrame) {
    let leaderIndex = 0;
    let maxVal = -Infinity;
    displayFrame.forEach((val, i) => {
      if (val > maxVal) {
        maxVal = val;
        leaderIndex = i;
      }
    });
    return leaderIndex;
  }

  return {
    simulateRace,
    getLeaderIndex,
  };
})();
