/**
 * raceTrackGeometry.js
 * ------------------------------------------------------------
 * 楕円（スタジアム型）トラックの座標計算。
 *
 * トラック形状は「直線＋半円コーナー×2」で構成される、いわゆる
 * 陸上競技場と同じ「スタジアム型（角丸長方形）」。CSSの
 * border-radius を大きくした角丸長方形と全く同じ形なので、
 * トラック描画自体はCSSに任せ、ここでは馬の座標だけを計算する。
 *
 * レースは1周（進捗0〜1）で、スタート＝ゴール地点はホームストレート
 * （手前の直線）の終盤寄りに置くことで、ゴール前に十分な長さの
 * 「最後の直線」が生まれるようにしてある。
 * ------------------------------------------------------------
 */

const RaceTrackGeometry = (() => {
  // ゴール地点をホームストレートのどのあたりに置くか（0〜1、0=直線の
  // 始まり寄り、1=直線の終わり寄り）。大きくするほど最後の直線が長くなる。
  const FINISH_POSITION_IN_HOME_STRAIGHT = 0.85;

  /**
   * トラック外枠（幅・高さ）から、直線の長さ(Ls)とコーナー半径(Rc)を求める。
   * CSSのborder-radiusでスタジアム型を描く場合と同じ考え方：
   * 短い方の辺の半分がコーナー半径、長い方の辺との差が直線部分になる。
   *
   * スマホの縦長画面（高さ＞幅）では、横長前提の計算のままだと直線が
   * 消えて円になってしまい、実際にCSSで描かれる縦長スタジアム型と
   * 形が食い違ってしまう。そのため縦長／横長のどちらでも正しく
   * 対応できるよう、短辺を基準に半径を、長辺との差を直線の長さとする。
   */
  function computeGeometry(wrapWidth, wrapHeight) {
    const vertical = wrapHeight > wrapWidth;
    const Rc = Math.min(wrapWidth, wrapHeight) / 2;
    const Ls = Math.max(0, Math.abs(wrapWidth - wrapHeight));
    const total = 2 * Ls + 2 * Math.PI * Rc;
    const f1 = Ls / total; // 上ストレート終端
    const f2 = f1 + (Math.PI * Rc) / total; // 左コーナー終端
    const f3 = f2 + Ls / total; // 下ストレート（ホームストレート）終端
    const uFinish = f2 + FINISH_POSITION_IN_HOME_STRAIGHT * (f3 - f2);
    return { Rc, Ls, total, f1, f2, f3, uFinish, vertical };
  }

  /**
   * 生の周回パラメータ u（0〜1、0=右上の角）における座標を返す。
   * offset は内外方向のレーンずらし量（プラスで外側＝半径が大きくなる方向）。
   * 原点(0,0)はトラック中心。
   *
   * ここでは常に「横長スタジアム型」として計算し、縦長画面(geo.vertical)の
   * 場合だけ最後にx/yを入れ替える（＝90度分の転置）。CSSのborder-radius
   * も短辺基準で自動的に縦長スタジアム型になるため、この転置で一致する。
   */
  function rawPoint(u, geo, offset) {
    const { Rc, Ls, f1, f2, f3 } = geo;
    const R = Rc + offset;
    let x;
    let y;
    if (u < f1) {
      // 上ストレート：右→左
      const local = u / f1;
      x = Ls / 2 - local * Ls;
      y = -R;
    } else if (u < f2) {
      // 左コーナー：上→下（左に張り出す半円）
      const local = (u - f1) / (f2 - f1);
      const theta = ((-90 - local * 180) * Math.PI) / 180;
      x = -Ls / 2 + R * Math.cos(theta);
      y = R * Math.sin(theta);
    } else if (u < f3) {
      // 下ストレート（ホームストレート）：左→右
      const local = (u - f2) / (f3 - f2);
      x = -Ls / 2 + local * Ls;
      y = R;
    } else {
      // 右コーナー：下→上（右に張り出す半円）
      const local = (u - f3) / (1 - f3);
      const theta = ((90 - local * 180) * Math.PI) / 180;
      x = Ls / 2 + R * Math.cos(theta);
      y = R * Math.sin(theta);
    }
    return geo.vertical ? { x: y, y: x } : { x, y };
  }

  /**
   * レース進捗 t（0=スタート、1=ゴール）における座標と進行方向（角度・度）を返す。
   * スタート／ゴールはホームストレート終盤に固定してあるため、
   * t=1直前は必ず「最後の直線」を走っている状態になる。
   */
  function getPosition(t, geo, offset) {
    const u = ((geo.uFinish + t) % 1 + 1) % 1;
    const eps = 0.0015;
    const p0 = rawPoint(u, geo, offset);
    const p1 = rawPoint(((u + eps) % 1 + 1) % 1, geo, offset);
    const angleDeg = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI);
    return { x: p0.x, y: p0.y, angleDeg };
  }

  return {
    computeGeometry,
    getPosition,
  };
})();
