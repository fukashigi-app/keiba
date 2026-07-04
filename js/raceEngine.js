/**
 * raceEngine.js
 * ------------------------------------------------------------
 * レースシミュレーションのロジック本体。
 *
 * 順位決定ルール：「能力60% ＋ ランダム40%」
 *   - 毎ティック（コマ送りの1コマ）ごとに、各馬の能力値とランダム値を
 *     60:40 で合成した「進み幅」を積み上げていく。
 *   - 人気馬（能力値が高い馬）が毎回勝つことがないよう、ランダム性を
 *     しっかり効かせている。
 *   - Stamina が低い馬は後半にペースが落ちやすく、Luck が高い馬は
 *     終盤に「一気に加速するスパート」が発生しやすい。
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

  /**
   * 馬の総合能力値を 0〜1 のスコアに変換する。
   * Speed を重視しつつ、Stamina / Luck も反映する。
   */
  function abilityScore(horse) {
    return (horse.speed * 0.5 + horse.stamina * 0.3 + horse.luck * 0.2) / 100;
  }

  /**
   * レース全体をシミュレーションし、アニメーション再生用のフレーム列を作る。
   *
   * @param {Array} horses 出走馬の配列
   * @param {number} durationSeconds レース時間（秒）
   * @returns {{
   *   totalTicks:number,
   *   ticksPerSecond:number,
   *   displayFrames: number[][], // [tick][horseIndex] = 0-100(%)
   *   ranking: Array<{horse:Object, place:number, rawDistance:number}>
   * }}
   */
  function simulateRace(horses, durationSeconds) {
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
        const ability = abilityScore(horse);
        const randomComponent = Math.random();

        // 能力60% + ランダム40%
        let increment = ability * 0.6 + randomComponent * 0.4;

        // Stamina が低い馬はレース後半（progress 0.5〜1.0）に失速しやすい
        if (progressFraction > 0.5) {
          const staminaFactor = horse.stamina / 100;
          const fatiguePenalty = (1 - staminaFactor) * (progressFraction - 0.5) * 0.6;
          increment -= fatiguePenalty;
        }

        // 勢いの波：一定確率で加速／失速が数ティック続く。Luckが高いほど
        // 加速側に振れやすく、大きく伸びる。誰にでも起こり得るため、
        // 終盤どころかレース全体を通じて先頭が入れ替わり続ける。
        const surge = surgeState[i];
        if (surge.ticksRemaining > 0) {
          increment *= surge.multiplier;
          surge.ticksRemaining -= 1;
        } else if (Math.random() < 0.035) {
          const isSpurt = Math.random() < 0.4 + (horse.luck / 100) * 0.3;
          surge.multiplier = isSpurt
            ? 1.5 + (horse.luck / 100) * 0.7 // 加速: 約1.5〜2.2倍
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
