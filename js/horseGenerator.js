/**
 * horseGenerator.js
 * ------------------------------------------------------------
 * 出走馬（8頭）を生成するモジュール。
 * 各馬は 馬番 / 馬名 / Speed / Stamina / Luck（各100点満点）を持つ。
 * ------------------------------------------------------------
 */

const HorseGenerator = (() => {
  const HORSE_COUNT = 8;

  // ジョッキーの帽子や勝負服をイメージした8色（馬番ごとの識別色）
  const JERSEY_COLORS = [
    '#e63946', '#457b9d', '#2a9d8f', '#f4a300',
    '#8e44ad', '#e76f51', '#1d3557', '#c9a227',
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
