# FUKASHIGI HORSE RACE

店内イベント用のオリジナル競馬演出システムです。
現金・ポイント・チップ・参加者・配当などの管理は一切行わず、
**レースの演出・実況・結果表示のみ**を担当します。

投票は紙の投票券、賭けは実物のチップを使用する前提です。

## 使い方

サーバー不要・データ保存なし。`index.html` をブラウザで開くだけで動作します。

```
open index.html
```

または簡易サーバーで確認する場合：

```
python3 -m http.server 8000
# http://localhost:8000 にアクセス
```

## 画面の流れ

トップ → 馬紹介（約30秒）→ 投票受付（約90秒）→ カウントダウン → レース（約60秒）→ 結果 → もう一度レース

各所要時間は右下の ⚙ ボタンから開く管理パネルで変更できます。

## 管理パネル（⚙ ボタン）

- 新しいレース / START / リセット
- 各画面のタイマー変更
- 実況・BGM・効果音 のON/OFF
- 音量・実況速度の調整

STARTボタンは投票受付中に押すと、その場でカウントダウンへ進みます。

## ファイル構成

```
index.html          画面のHTML構造
css/style.css        黒×ゴールドの高級感デザイン
js/horseNames.js      馬名生成（接頭語×接尾語で100種類以上）
js/horseGenerator.js  出走馬（8頭）の生成
js/raceEngine.js      レースシミュレーション（能力60%+ランダム40%）
js/commentary.js      SpeechSynthesisによる実況（30種類以上のセリフ）
js/audioManager.js    BGM・効果音の再生（音源が無くても正常動作）
js/appState.js        設定値・状態の一元管理
js/ui.js              画面遷移・レース演出のメインロジック
js/admin.js           管理パネルの操作
js/main.js            起動処理
assets/audio/         BGM・効果音を配置する場所（README参照）
```

## 機能拡張のヒント

- **馬名を増やす**: `js/horseNames.js` の `PREFIXES` / `SUFFIXES` に単語を追加するだけで組み合わせが増えます。
- **実況セリフを増やす**: `js/commentary.js` の `LINES` オブジェクトに文言を追加してください。
- **レースバランスの調整**: `js/raceEngine.js` の `abilityScore()` や `VISUAL_COMPRESSION_FACTOR` を調整すると、接戦具合や能力の影響度を変更できます。
- **音源を追加する**: `assets/audio/README.md` を参照してください。

## 使用技術

HTML / CSS / JavaScript（フレームワーク不使用）。外部API・サーバー・Firebase・データ保存は使用していません。
