/**
 * raceConditions.js
 * ------------------------------------------------------------
 * コース（馬場）・天候・脚質・馬場適性まわりのデータと計算ロジック。
 * 毎レース開始時にコースと天候がランダムで選ばれ、レース結果の
 * 補正（コース適性・脚質展開・天候によるわずかな有利不利）に使われる。
 * ------------------------------------------------------------
 */

const RaceConditions = (() => {
  // surface: 'turf'（芝） or 'dirt'（ダート）
  // condition: 'good'（良） / 'yielding'（稍重） / 'heavy'（重）
  const COURSE_TYPES = [
    { id: 'turf_good', label: '芝（良）', surface: 'turf', surfaceLabel: '芝', condition: 'good', conditionLabel: '良' },
    { id: 'turf_yielding', label: '芝（稍重）', surface: 'turf', surfaceLabel: '芝', condition: 'yielding', conditionLabel: '稍重' },
    { id: 'turf_heavy', label: '芝（重）', surface: 'turf', surfaceLabel: '芝', condition: 'heavy', conditionLabel: '重' },
    { id: 'dirt_good', label: 'ダート（良）', surface: 'dirt', surfaceLabel: 'ダート', condition: 'good', conditionLabel: '良' },
    { id: 'dirt_yielding', label: 'ダート（稍重）', surface: 'dirt', surfaceLabel: 'ダート', condition: 'yielding', conditionLabel: '稍重' },
    { id: 'dirt_heavy', label: 'ダート（重）', surface: 'dirt', surfaceLabel: 'ダート', condition: 'heavy', conditionLabel: '重' },
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

  // 脚質（レーススタイル）。各馬に生成時から固定で割り当てる特性。
  const RUNNING_STYLES = [
    { id: 'nige', label: '逃げ' },
    { id: 'senko', label: '先行' },
    { id: 'sashi', label: '差し' },
    { id: 'oikomi', label: '追込' },
  ];

  function pickRandomCourse() {
    return COURSE_TYPES[Math.floor(Math.random() * COURSE_TYPES.length)];
  }

  function pickRandomWeather() {
    return WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
  }

  function pickRandomRunningStyle() {
    return RUNNING_STYLES[Math.floor(Math.random() * RUNNING_STYLES.length)];
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
   * コース適性を 0〜1 のスコアに変換する。馬場状態が悪くなるほど、
   * 表面適性（芝／ダート）に重馬場適性を混ぜる比率を上げる。
   */
  function getCourseAptitudeScore(horse, course) {
    const surfaceScore = getAptitude(horse, course) / 5;
    const heavyScore = horse.heavyAptitude / 5;
    const heavyBlend = { good: 0, yielding: 0.2, heavy: 0.4 }[course.condition] || 0;
    return surfaceScore * (1 - heavyBlend) + heavyScore * heavyBlend;
  }

  /**
   * 馬紹介画面などに表示する「今回のコースとの相性コメント」を作る。
   */
  function getCompatibilityComment(horse, course) {
    const surfaceStars = getAptitude(horse, course);
    const heavyStars = horse.heavyAptitude;
    const surfaceWord = course.surfaceLabel;

    if (course.condition === 'heavy' && heavyStars >= 4) {
      return `馬場が重くなるほど粘り強いタイプ。今回の重馬場は望むところ。`;
    }
    if (surfaceStars >= 4) {
      return `今回の${surfaceWord}コースは得意条件。期待できる。`;
    }
    if (surfaceStars <= 2) {
      return `今回の条件はやや苦手。展開次第。`;
    }
    return `${surfaceWord}適性は標準的。展開に左右されそう。`;
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
    RUNNING_STYLES,
    pickRandomCourse,
    pickRandomWeather,
    pickRandomCondition,
    pickRandomRunningStyle,
    getAptitude,
    getCourseAptitudeScore,
    getFavoredSurfaceLabel,
    getCompatibilityComment,
    starString,
  };
})();
