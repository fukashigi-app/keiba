/**
 * horseGenerator.js
 * ------------------------------------------------------------
 * 出走馬（8頭）を生成するモジュール。
 * 各馬は 馬番 / 馬名 / Speed / Stamina / Luck（各100点満点）に加えて、
 * 芝・ダート・重馬場それぞれの適性（1〜5の星評価）と、脚質
 * （逃げ／先行／差し／追込）を持つ。これらは馬固有の特性のため、
 * ここで生成時に一度だけ割り当てる（「調子」は毎レース変わる一時的な
 * 状態なので raceConditions.js 側で別途扱う）。
 * ------------------------------------------------------------
 */

const HorseGenerator = (() => {
  const HORSE_COUNT = 8;

  // カラフルなゼッケン色（馬番ごとに固定の識別色）。1番=赤、2番=青…と
  // 馬番だけで見分けられるよう固定の対応にしてある。
  const JERSEY_COLORS = [
    '#e6402c', // 1: 赤
    '#2f7fe6', // 2: 青
    '#f2c50f', // 3: 黄
    '#3ba84a', // 4: 緑
    '#9a4fd6', // 5: 紫
    '#ee8b1e', // 6: オレンジ
    '#f5f5f0', // 7: 白
    '#2b2b2b', // 8: 黒
  ];

  /**
   * 40〜99の範囲で能力値を生成する。
   * 極端に低い能力（1桁など）を避け、どの馬にも見せ場が
   * 生まれるようにするための範囲設定。
   */
  function randomStat() {
    return Math.floor(Math.random() * 60) + 40; // 40 - 99
  }

  /**
   * コース適性（1〜5の星）をランダムに生成する。
   */
  function randomAptitude() {
    return Math.floor(Math.random() * 5) + 1; // 1 - 5
  }

  /**
   * 新しい8頭の出走馬を生成する。
   */
  function generateHorses() {
    const names = HorseNames.pickRandomNames(HORSE_COUNT);

    const horses = [];
    for (let i = 0; i < HORSE_COUNT; i++) {
      horses.push({
        number: i + 1,
        name: names[i],
        speed: randomStat(),
        stamina: randomStat(),
        luck: randomStat(),
        turfAptitude: randomAptitude(),
        dirtAptitude: randomAptitude(),
        heavyAptitude: randomAptitude(),
        runningStyle: RaceConditions.pickRandomRunningStyle(),
        color: JERSEY_COLORS[i % JERSEY_COLORS.length],
      });
    }
    return horses;
  }

  return {
    HORSE_COUNT,
    generateHorses,
  };
})();
