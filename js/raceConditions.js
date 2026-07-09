/**
 * raceConditions.js
 * ------------------------------------------------------------
 * コース（馬場）と天候を決めるモジュール。
 * 毎レース開始時にランダムで1つずつ選ばれ、レース結果の
 * 補正（コース適性・天候によるわずかな有利不利）に使われる。
 * ------------------------------------------------------------
 */

const RaceConditions = (() => {
  // surface: 'turf'（芝） or 'dirt'（ダート）
  const COURSE_TYPES = [
    { id: 'turf_good', label: '芝（良）', surface: 'turf' },
    { id: 'turf_yielding', label: '芝（稍重）', surface: 'turf' },
    { id: 'turf_heavy', label: '芝（重）', surface: 'turf' },
    { id: 'dirt_good', label: 'ダート（良）', surface: 'dirt' },
    { id: 'dirt_heavy', label: 'ダート（重）', surface: 'dirt' },
  ];

  const WEATHER_TYPES = [
    { id: 'sunny', label: '晴れ' },
    { id: 'cloudy', label: '曇り' },
    { id: 'rainy', label: '雨' },
  ];

  // 馬ごとの「今日の調子」。abilityMultiplier は能力値への補正
  // （強すぎないよう±15%程度に留めている）。大穴気配だけは素の能力は
  // 低めだが、レース中の「勢いの波（サージ）」が起きやすくなる
  // （raceEngine.js 側で参照）。weight は抽選の重み。
  const CONDITION_TIERS = [
    { id: 'peak', label: '絶好調', abilityMultiplier: 1.15, wildcard: false, weight: 10 },
    { id: 'good', label: '好調', abilityMultiplier: 1.07, wildcard: false, weight: 25 },
    { id: 'normal', label: '普通', abilityMultiplier: 1.0, wildcard: false, weight: 35 },
    { id: 'poor', label: '不調', abilityMultiplier: 0.90, wildcard: false, weight: 20 },
    { id: 'wildcard', label: '大穴気配', abilityMultiplier: 0.85, wildcard: true, weight: 10 },
  ];

  function pickRandomCourse() {
    return COURSE_TYPES[Math.floor(Math.random() * COURSE_TYPES.length)];
  }

  function pickRandomWeather() {
    return WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
  }

  /**
   * 重み付きで「今日の調子」を1つ選ぶ。
   */
  function pickRandomCondition() {
    const totalWeight = CONDITION_TIERS.reduce((sum, tier) => sum + tier.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const tier of CONDITION_TIERS) {
      roll -= tier.weight;
      if (roll <= 0) return tier;
    }
    return CONDITION_TIERS[CONDITION_TIERS.length - 1];
  }

  /**
   * 芝・ダートのうち適性が高い方を「得意コース」として返す。
   * 同値の場合は「オールラウンド」。
   */
  function getFavoredSurfaceLabel(horse) {
    if (horse.turfAptitude === horse.dirtAptitude) return 'オールラウンド';
    return horse.turfAptitude > horse.dirtAptitude ? '芝' : 'ダート';
  }

  /**
   * 馬の該当コース（芝／ダート）の適性値（1〜5）を返す。
   */
  function getAptitude(horse, course) {
    return course.surface === 'turf' ? horse.turfAptitude : horse.dirtAptitude;
  }

  /**
   * 星評価を "★★★☆☆" のような文字列に変換する。
   */
  function starString(value, max = 5) {
    return '★'.repeat(value) + '☆'.repeat(Math.max(0, max - value));
  }

  return {
    COURSE_TYPES,
    WEATHER_TYPES,
    CONDITION_TIERS,
    pickRandomCourse,
    pickRandomWeather,
    pickRandomCondition,
    getAptitude,
    getFavoredSurfaceLabel,
    starString,
  };
})();
