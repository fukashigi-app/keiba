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

  // 差し替え可能な馬イラスト（assets/images/horse_<色名>.png）のファイル名に
  // 使う色名。JERSEY_COLORSと同じ並び順（馬番=インデックス+1）。
  const JERSEY_COLOR_NAMES = [
    'red', 'blue', 'yellow', 'green', 'purple', 'orange', 'white', 'black',
  ];

  // 馬体そのものの毛色（栗毛・芦毛など）。ゼッケン色はあくまで頭絡と
  // ゼッケン（アクセント）に使う色で、馬体色とは別に持たせることで
  // 「馬番ごとに違う毛色のポニー」に見えるようにする。JERSEY_COLORSと
  // 同じ並び順（馬番=インデックス+1）。
  const COAT_COLORS = [
    '#a9713f', // 1: 栗毛
    '#cfcfd2', // 2: 芦毛（グレー）
    '#c99a52', // 3: 栃栗毛
    '#8a5a34', // 4: 黒鹿毛
    '#4a3b3a', // 5: 黒褐色
    '#bf8c56', // 6: 栗毛（明るめ）
    '#f7f2e7', // 7: 白毛
    '#2b2b2b', // 8: 黒毛
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
        colorName: JERSEY_COLOR_NAMES[i % JERSEY_COLOR_NAMES.length],
        coat: COAT_COLORS[i % COAT_COLORS.length],
      });
    }
    return horses;
  }

  return {
    HORSE_COUNT,
    generateHorses,
  };
})();
