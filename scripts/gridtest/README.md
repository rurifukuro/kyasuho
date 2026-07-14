# モードB グリッド検出 リグレッションテスト（Rev72新設）

`src/shiftTemplates/gridDetect.ts`（空テンプレート画像→ShiftPlacement検出）の
正解照合テスト。とれはんっ！mapkit方式（決定論パイプライン＋グラウンドトゥルース照合）。
gridDetect.ts を変更したら必ずこのテストを再実行すること。

## テストセット（8種・1080×1350）

| ID | 内容 | 検証する弱点 |
|---|---|---|
| T1_plain | 白地×黒罫線＋タイトル/曜日文字 | 基本形 |
| T2_pastel | 薄ピンク罫線（輝度~212） | 固定閾値では検出不能→Otsu適応二値化 |
| T3_dark | ダーク背景×明色罫線 | 極性反転（内蔵20テンプレ中6種がダーク系） |
| T4_uneven | 不等幅列（時間列100px） | 本数・外周は正確（内部線の均等分割ズレは§22-5 V2の領域） |
| T5_banner | ソリッドリボン130px＋グリッド | 帯を罫線と誤認しない（幅フィルタ） |
| T6_nogrid | グラデ＋ブロブ（グリッド無し） | null を返す（モードCへ誘導） |
| T7_cellbox | 角丸セルボックス式（ギャップ10px） | 境界2重線の近接統合 |
| T8_jpeg | T2のJPEG q70 | 圧縮ノイズ耐性 |

## 実行手順

1. 画像生成（要Python+PIL）: `python gen_gridtest.py` → `gridtest/` に8枚＋ground_truth.json
2. `web/public/__gridtest/` へコピー（**一時フォルダ・コミット禁止・終了後削除**）
3. vite devサーバー起動 → ブラウザコンソールで:

```js
const mod = await import('/src/shiftTemplates/gridDetect.ts');
const gt = await (await fetch('/__gridtest/ground_truth.json')).json();
for (const t of gt) console.log(t.file, await mod.detectGridFromImage('/__gridtest/' + t.file));
```

## PASS基準（Rev72実測で全PASS）

- T6のみ null。他7種: cols=7・rawRows=6（rows=5+ヘッダー）・
  外周gridArea誤差 = 正解(x0.0556/y0.2222/w0.8889/h0.7333)に対し1%未満
- 等幅テンプレの縦線位置ズレ ≤1px／T7は約6px内側（セル枠がギャップ分内側＝許容）
- T4の内部縦線は均等分割のため最大37pxズレ＝**既知制約**（ShiftPlacement v1が
  均等分割仕様のため。§22-5後半のV2境界配列 colBounds/rowBounds で解消予定）
