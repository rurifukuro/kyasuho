# きゃすりん WORK_PROGRESS（セッション間引き継ぎ）

## 修正指示 2026-07-06（きゃすりん今後の開発 — Opus引き継ぎ：アイコン/通知/IAP/客Web拡張/ストア準備）

Fable5セッション（Rev1〜Rev21・Web公開まで）からの引き継ぎ。以後の開発はこの指示書を起点に進める。

### 0. 最初に読むもの（順番どおり）

1. `AGENTS.md` — SDK54固定・必読ルール・実装チェックリスト・横断ゲート（**完了宣言の条件**）
2. `SPEC.md` — 仕様書（§番号は本指示書と共通）
3. `REVISION_LOG.md` — Rev1〜Rev21の実装履歴（何がどこまで動いているかの正）

### 1. 現状（2026-07-06時点・Fableセッション終了時）

- **アプリ（Expo SDK54・ポート8086）**: SPEC §3の★（MVP必須）は全て実装済み（Rev2基盤〜Rev20）。タブ5つ＝予約台帳/受付設定/キャスト/分析/設定。
- **Web公開済み（2026-07-06・ユーザー承認済み）**:
  - リポジトリ: `https://github.com/rurifukuro/kyasuho`（public・rurifukuro垢・GitHub Pages=workflow方式）
  - 客側: `https://rurifukuro.github.io/kyasuho/#/<slug>`／管理: `https://rurifukuro.github.io/kyasuho/#/admin`
  - 実HTTP 200・title「きゃすりん - 予約」・アセット `/kyasuho/assets/` を確認済み（WEB5）
- **Supabase**: concafe-yoyaku（ref=rhmuitgbvilqwdevxxox）に `ky_*` プレフィックスで相乗り。migration 0001〜0009適用済み。**本番前に専用プロジェクトへ分離必須**（T7）。
- **⚠️ ANTHROPIC_API_KEY Secret未登録**: AIシフトデザイン（Edge Function `ky-shift-design`）の実生成が動かない。ユーザーに登録依頼済み:
  `npx supabase secrets set ANTHROPIC_API_KEY=<値> --project-ref rhmuitgbvilqwdevxxox`（キー値はチャットに出さない）
- **スモーク用テストアカウント**: `tiashe8730+kysmoke0706@gmail.com`（メール確認はSQLで実施済み。テナント=`shop-kysmoke`「スモーク検証店」をSQLで作成済み）
- **公開スモーク完走（2026-07-06・Fable）**: 管理Webログイン→受付枠追加→客Web予約（席自動割当・PIN発行）→**Realtime台帳自動反映まで実URLで全PASS**。途中で管理Webのルーティングバグ（相対パス無限連結）を発見・修正済み（§2参照）。スモークテナントは `is_suspended=true` で客側非公開化済み→**アプリ実機スモーク時は `update public.ky_tenants set is_suspended=false where slug='shop-kysmoke';` で再公開して使う**
- **エミュ実機スモーク（アプリ側 ensureTenant→5タブ遷移）は未実施**＝当時エミュがお品書きメーカー（別セッション）使用中だったため。Opus側で最初に実施推奨
- 一時SQL 2本（`confirm_kysmoke_tmp.sql`・`smoke_tenant_tmp.sql`）は**削除済み**。スモークテナントの非公開化（`is_suspended=true`）も**実施・検証済み**（上記参照）

### 2. Web公開の運用（deploy repoの扱い — 重要）

- **ソースの正は本体リポジトリ `kyasuho/web/`**（Rev管理・REVISION_LOGはこちら）。
- デプロイは**別リポジトリ** `C:\Users\tiash\Desktop\Claude Code専用\kyasuho-web-deploy\`（= `rurifukuro/kyasuho` のclone）から行う。無ければ `git clone https://github.com/rurifukuro/kyasuho.git kyasuho-web-deploy` で再取得。
- **更新フロー**: ① `kyasuho/web/` を修正しRev記録 → ② deploy repoへ該当ファイルをコピー → ③ 日本語メッセージでcommit → ④ `git push origin main` → ⑤ Actions成功確認 → ⑥ 実URLでHTTP 200＋変更内容を確認（WEB5）。
- deploy repoに `.env` は無い（CIの `deploy.yml` が生成。anonキーはRLS前提の公開安全値=WEB4）。**publicリポジトリなので service_role 等の秘密は絶対に入れない**。
- `web/vite.config.ts` は **loadEnv方式**（process参照はCIのtscでTS2580になるため禁止・@types/nodeは入れていない）。
- **管理Webのルーティングは絶対パス固定**: `/admin/*` スプラットルート配下では相対 `to` がスプラット消費分基準で解決され URL が無限連結する（公開スモークで実バグ化→1656ab3で修正済み）。管理Webに Link/Navigate を追加する時は必ず `/admin/...` の絶対パスで書く。

### 3. タスク（優先順・T1〜T7）

#### T1. アプリアイコン作成
- 現状 `assets/icon.png` 等は**Expoテンプレのデフォルトのまま**（app.json確認済み）。
- きゃすりん用アイコン（iOS icon / Android adaptiveIcon 4点 / favicon）を作成して差し替える。
- 画像生成はメモリ `image_gen_gemini_rules.md`（IG1〜IG18）参照。レジさぽっ！アイコン作成の前例あり。
- ストア提出の前提物。完成後 `app.json` の名称・色との整合確認。

#### T2. 通知の実機対応（dev build / EASビルド）
- 実装済み（Rev7）: Realtime購読＋ローカル通知＋push token保存（`ky_push_tokens`）。
- **未実装**: バックグラウンドpush送信（Expo Push API を叩く Edge Function。予約INSERT→DBトリガorWebhook→送信）。
- **Expo Goの制限**: SDK53以降、Expo GoではリモートpushがAndroid非対応→**dev build（EASビルド）での実機検証が必要**。ビルド種別はユーザーとW21（3点すり合わせ）。

#### T3. IAPフラグON実装（価格はユーザー決定事項）
- 現状: `src/config/features.ts` `IAP_ENABLED=false`・`FREE_LIMITS`は叩き台（tenants:1/casts:3/reservationsPerMonth:100）。
- やること: ①購入UI（PlanCard/SubscriptionCard→SettingsScreen）②上限ゲート共通関数（GATE-1＝散在禁止）③`productsById[sku].localizedPrice`（配列順依存禁止＝PRICE）④R35地域別価格。
- **価格・フリー/有料境界の決定はユーザー承認必須**（勝手に決めない）。競合価格調査資料が前セッションにあり→ユーザーに提示して決めてもらう。

#### T4. 客Web機能拡張（SPEC §3-D の◯項目）
- 生誕祭特設枠・キャスト個人ページ・客向けメールリマインダー等。SPEC参照。
- 更新は §2 のフローで（web修正→deploy repoへコピー→push）。

#### T5. ストア提出準備
- スキル `app-store-release` が自動発火する（§B ビルド前ゲート→§C build/submit→§D メタデータ）。
- ASCアプリID: 6787006154／Bundle ID `com.kyasuho.app`（R1ロック）／表示名「きゃすりん」（ASC変更済み）。
- **R0: 公開操作（Release）はユーザー許可制**。build+submit+審査提出までは自走OK（R0-B）。
- 隠れ前提3点（R26）: 配信権・App Privacy・価格。App Privacy申告は「収集あり」（Auth/予約データ収集のため「収集なし」不可＝R4）。

#### T6. 情報ページ・文言整備
- 利用規約・PP実装済み（Rev9）。ストア審査向けにサポートURL/マーケティングURLが必要になったら `rurifukuro.github.io`（開発アプリ集約ポータル）にきゃすりんのAPP CARD追加＋`/kyasuho-support/` 等を検討（ポータル運用はメモリ `feedback_dev_app_hub_site.md`）。

#### T7. Supabase専用プロジェクト分離（本番前必須・着手時はFable推奨）
- concafe-yoyaku相乗りからの分離。migration 0001〜0009を新プロジェクトへ適用→データ移行→`.env`/EAS環境変数/Edge Function/Secret差し替え。
- **破壊・切替を伴うためミスの影響が大きい。着手時はモデルをFableに戻すことをユーザーへ推奨する。**

### 4. 承認ゲート（ユーザーに確認してから進めるもの）

- 価格・フリー/有料境界（T3）／ストア公開操作＝Release（R0）／破壊的DB変更・データ移行の実行（T7）／新規の外部公開・送信・課金・削除。
- Web「更新」のpushは公開済み資産の維持なので自走可。ただし**新しい情報の公開**（新ページ・新データ公開）は一声かける。

### 5. 既知の注意点・小ネタ

- メール確認ON環境: サインアップ後にconfirmしないとログイン不可（未確認時の専用文言はRev20で実装済み）。
- AIシフトデザインはSecret未登録の間 `aiFailed` 文言（1日20回制限も実装済み）。
- エミュ: `Pixel7_Play_API35`（emulator-5554・ja-JP・Expo Go導入済）。**BACKキー（keyevent 4）使用禁止**（メモリ厳命）。
- Metro起動: `npx expo start --tunnel --port 8086`（expo-startスキル参照）。
- KeyboardDoneBar: #8E8E93グレー・KAVの外＝兄弟（質問も禁止・メモリ厳命）。
- 1指示=1Rev=1コミット（日本語コミットメッセージ）＋REVISION_LOG追記。完了宣言はAGENTS.mdの横断ゲート通過後。
