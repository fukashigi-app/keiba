/**
 * commentary.js
 * ------------------------------------------------------------
 * ブラウザ標準の SpeechSynthesis API を使った実況システム。
 * 外部APIには一切依存せず、ローカルのみで動作する。
 *
 * 30種類以上の実況セリフをカテゴリ別に用意し、レースの局面
 * （スタート／序盤／中盤／終盤／接戦／ゴール）に応じてランダムに
 * 組み合わせて読み上げる。
 * ------------------------------------------------------------
 */

const Commentary = (() => {
  let enabled = true;
  let rate = 1.0;
  let volume = 1.0;
  const synth = window.speechSynthesis;
  const supported = !!synth;

  // {n} = 先頭馬の馬番, {name} = 先頭馬の馬名 に置換される
  const LINES = {
    start: [
      'スタートしました！',
      'ゲートが開きました！',
      '各馬一斉に飛び出しました！',
      '好スタートを切りました！',
      'さあ、レースの幕開けです！',
    ],
    early: [
      '{n}番が先頭に立ちました！',
      '{n}番、{name}がハナを切ります！',
      '序盤は{n}番のペースです！',
      '外から{n}番が上がってきました！',
      '内側を{n}番がうまく立ち回っています！',
      'まだまだ序盤、先頭は{n}番！',
      '集団はまとまったままレースが進みます！',
    ],
    middle: [
      '{n}番が先頭を守っています！',
      '{n}番が抜け出そうとしています！',
      '7番が外から追い上げる！',
      '中盤に差し掛かり、順位が入れ替わりました！',
      '{n}番、{name}が勢いに乗っています！',
      'ここで{n}番が先頭に躍り出た！',
      '馬群がぎゅっと固まっています！',
      'まだまだ分かりません、混戦模様です！',
    ],
    finalStretch: [
      '最後の直線に入りました！',
      '直線勝負です！',
      '{n}番が先頭で直線を迎えました！',
      'ここからが勝負どころです！',
      '{n}番、{name}が粘りを見せています！',
      '一気に加速した馬がいます！',
      '全馬、全力の走りを見せています！',
    ],
    close: [
      '大接戦です！',
      'これは分かりません、大混戦！',
      '横一線の戦いです！',
      '一瞬たりとも目が離せません！',
      '差はほとんどありません！',
      'まさに大接戦、ゴールまでもつれ込みます！',
    ],
    finishLine: [
      'ゴールイン！',
      'ゴールしました！',
      'フィニッシュです！',
      '着差はごくわずか、写真判定になるかもしれません！',
    ],
    winnerAnnounce: [
      '勝ったのは{n}番、{name}です！',
      '見事、{n}番の{name}がゴールを駆け抜けました！',
      '優勝は{n}番、{name}！おめでとうございます！',
    ],
  };

  function countTotalLines() {
    return Object.values(LINES).reduce((sum, arr) => sum + arr.length, 0);
  }

  function fillTemplate(template, context) {
    if (!context) return template;
    return template
      .replace(/{n}/g, context.number ?? '')
      .replace(/{name}/g, context.name ?? '');
  }

  let lastTemplate = null;

  function pickLine(category, context) {
    const pool = LINES[category];
    if (!pool || pool.length === 0) return '';
    let template = pool[Math.floor(Math.random() * pool.length)];
    // 同じセリフが連続しないよう、プールが2つ以上あれば選び直す
    if (pool.length > 1) {
      let attempts = 0;
      while (template === lastTemplate && attempts < 5) {
        template = pool[Math.floor(Math.random() * pool.length)];
        attempts += 1;
      }
    }
    lastTemplate = template;
    return fillTemplate(template, context);
  }

  /**
   * テキストを読み上げる。実況OFF、または未対応ブラウザの場合は何もしない。
   */
  function speak(text) {
    if (!enabled || !supported || !text) return;
    try {
      // 前のセリフが残っていると詰まってしまうため、話している途中の
      // ものはキャンセルしてから新しいセリフを話す。
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = rate;
      utterance.volume = volume;
      // Chromeではcancel()の直後にspeak()すると発話が無視されることが
      // あるため、1ティック遅らせてから読み上げる。
      setTimeout(() => {
        if (!enabled) return;
        synth.speak(utterance);
      }, 50);
    } catch (e) {
      // 実況が失敗してもゲーム進行には影響させない
      console.warn('[Commentary] speak failed', e);
    }
  }

  let unlocked = false;

  /**
   * ユーザーの最初のタップ／クリックのタイミングで一度だけ呼び出す。
   * 無音に近いセリフを一度読み上げておくことで、以降タイマー経由
   * （ユーザー操作の外）でのspeak()がブロックされないようにする
   * （スマホのブラウザで特に重要）。
   */
  function unlock() {
    if (unlocked || !supported) return;
    unlocked = true;
    try {
      const utterance = new SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      synth.speak(utterance);
    } catch (e) {
      // 無視してよい
    }
  }

  /**
   * カテゴリからセリフを選んで読み上げる。
   * 画面へのテロップ表示など、選ばれたテキストを呼び出し元でも
   * 使えるように返り値として返す。
   */
  function speakCategory(category, context) {
    const text = pickLine(category, context);
    speak(text);
    return text;
  }

  function setEnabled(value) {
    enabled = value;
    if (!enabled && supported) synth.cancel();
  }

  function setRate(value) {
    rate = value;
  }

  function setVolume(value) {
    volume = value;
  }

  return {
    speak,
    speakCategory,
    pickLine,
    unlock,
    setEnabled,
    setRate,
    setVolume,
    isSupported: () => supported,
    countTotalLines,
  };
})();
