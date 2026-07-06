# Expo SDK 54（このプロジェクトの固定SDK）

このプロジェクトは **Expo SDK 54** で動かす（App Store版 Expo Go が対応する唯一のSDK）。
`create-expo-app@latest` は SDK57 を入れるが、標準 Expo Go で「requires a newer version of Expo Go」になり実機検証できないため **Rev1 で SDK54 へダウングレード済み**（expo~54.0.0 / react 19.1.0 / react-native 0.81.5 / typescript ~5.9.2）。**SDKを上げない。**
コードを書く前に正バージョンのドキュメントを読む： https://docs.expo.dev/versions/v54.0.0/

# 必読ルール（開発前・サーバ起動前に読む）

- **`SPEC.md`** — きゃすりん仕様書（コンセプト・機能一覧§3・画面§9・データモデル§10・流用源§11・マルチテナント§12・予約ロジック§13・課金境界§14・UGC§15・法務§16）
- `memory/app_dev_rules.md` — INIT / MODAL-SAFE / Z-KBD（KAVの外・#8E8E93）/ VER / FONT-JP / PRICE / GATE-1 / BE-1〜3 / TAB-ICON
- `memory/rules_workflow.md` — W1〜W22（W1日本語・W19 mutation試打禁止・W21ビルド種別3点）
- `memory/store_release_rules.md` — R1（Bundle IDロック）/ R13（APIキー埋め込み禁止）/ R17（連絡先=rurifukuro@gmail.com）/ R28（UGC 4要件）/ R35（地域別価格）
- `memory/web_dev_rules.md` — WEB1〜11（客側公開Web＝anon公開OK/service_role出荷禁止・実HTTP実証・公開はユーザー承認）
- **流用源の実コード（ルールREUSE-TRIGGER＝自前実装の前にgrep→Read→コピー）**：
  - `../concafe-yoyaku`（予約ロジック `make_reservation` RPC・席自動割当・PIN編集・解禁ウィンドウ・客側Web）
  - `../とれはんっ！`（UI共有部品・UGC 4要件・i18nエンジン・Terms/PP/Contactモーダル）
  - `../urehan`（レジさぽっ！＝自動〆切 close_at・情報ページ）

# プロジェクト基本情報

- Bundle ID: `com.kyasuho.app`（iOS/Android・R1ロック・変更不可）／ASCアプリID: 6787006154
- ポート: **8086**（`npx expo start --tunnel --port 8086`）
- Supabase: MVPは concafe-yoyaku（ref=rhmuitgbvilqwdevxxox）に `ky_*` プレフィックスで相乗り → **本番前に専用プロジェクトへ分離**
- 収益: フリーミアム。**MVPは IAPフラグOFF で全機能無料出荷**（課金コードは後付けできる構造）

# 実装チェックリスト（SPEC §3 → §5・完了宣言前に全項目をコードと突合）

★=MVP必須 ／ ◯=あると便利（後フェーズ可） ／ △=将来。★は実装必須。

- [ ] §3-A 予約台帳: 日付別タイムライン/受付・変更・キャンセル/チェックイン/予約詳細/手動追加 ★
- [ ] §3-B 受付設定: 営業日時・1セット時間/席数（自動割当）/解禁・〆切(close_at)/公開URL発行・QR ★
- [ ] §3-C キャスト管理: CRUD/出勤スケジュール(shifts)/指名ON-OFF ★（◯キャスト個人ページ）
- [ ] §3-D 客Web予約: カレンダー→空き枠→予約フォーム/PIN発行/PIN編集 ★（◯生誕祭特設枠）
- [ ] §3-E 通知: 予約が入ったら提供者へプッシュ(expo-notifications) ★（◯客向けメールリマインダー）
- [ ] §3-F 売上管理: 店舗売上入力・集計・キャスト給与計算・税金CSV出力 ★（計算式=§23）
- [ ] §3-H 勤怠管理: 欠勤/遅刻/早退/代打の記録・月次集計 ★（§23）
- [ ] §3-I シフト表生成: テンプレート20種＋AIデザイン→画像出力・共有 ★（エンジン=§22・Web正準）
- [ ] §3-J 提供者管理Web(PC): #/admin・同一Auth/RLS・予約/受付/キャスト/売上/給与/勤怠/CSV/シフト表 ★（§21）
- [ ] §3-K オーダー管理: メニューCRUD/伝票open→明細→会計→closed/**お客様名入力欄・一時保存ボタン**/ky_sales自動upsert(entry_mode)/給与ドリンクプリフィル/AdminOrders・AdminMenu ★（詳細=§25・レジさぽっ！RegisterScreen流用）
- [ ] §27 経費・確定申告補助: ky_expenses/カテゴリ別集計/月次収支/年次サマリ/経費CSV/AdminExpenses ★（税務助言はしない）
- [ ] §28 是正パック: 日付チップ折返し修正/「客」→「お客様」/ContactFormModal流用差替え/生年月日ホイールピッカー/手動予約追加に指名ドロップダウン/ky_casts.name_kana＋あいうえお順 ★
- [ ] §29 席種・席料: ky_seat_types CRUD＋席料入力/客Web席種ドロップダウン/伝票へ席料自動明細 ★
- [ ] §30 キャスト写真: 証明写真＋お店写真/Storage ky-cast-photos/管理側差替え/離脱時自動削除(ky-cast-leave)/PP改訂 ★
- [ ] §31 シフト表SNS投稿: ky_tenants.sns_links/X intent・Instagram起動/投稿文テンプレ＋予約URL差し込み ★
- [ ] §24 連携: アプリ「PCで作業」導線・Web台帳Realtime・plan共有 ★
- [ ] §3-G 設定: Auth(Supabase)/アカウント削除/店プロフィール/規約・PP/通報・ブロック/IAP(OFF)/言語/バージョン/ダークモード ★
- [ ] 基盤: マルチテナント(tenant_id+RLS)/TypeScript strict/i18n(t()経由)/FONT-JP

# 横断ゲート（完了宣言前に必ず・app_dev_rules SPEC-CROSS/REUSE-TRIGGER/SCREEN-COMPARE/TAB-ICON準拠）

**§3 の機能✅だけで完了と言わない。下記5ゲートを全て通してから REVISION_LOG.md に「§9/§11/§14/§15/§16 全ゲート通過」と明記する。**

## ゲート①: §9（タブUI／ナビ部品）
- [ ] BottomTab は `@expo/vector-icons` MaterialCommunityIcons（絵文字直書き禁止＝Android文字化け）
- [ ] 各タブ `tabBarIcon` 必須・固定名: 予約=`calendar-check` / レジ=`cash-register` / 受付=`clock-edit` / キャスト=`account-star` / 分析=`chart-box` / 設定=`cog`
- [ ] `tabBarLabel` は i18n 経由テキストのみ

## ゲート②: §11（流用 components の実体照合）
**完了宣言前に流用源で grep → 実体ファイルが新アプリにあり構造一致を1つずつ確認。**
- [ ] `FormModalShell`（MODAL-SAFE）で全モーダル上部inset統一
- [ ] `KeyboardDoneBar` を TextInput 含む全画面にマウント・**KAVの外＝兄弟**・#8E8E93グレー
- [ ] `TermsOfUseModal` / `PrivacyPolicyModal` / `ContactFormModal`（自前簡易版禁止・構造化データ）
- [ ] `CalendarModal`（DATE-POPUP・生TextInputで日付を打たせない）
- [ ] 客Web: concafe-yoyaku の `CustomerPage`/`Calendar`/`ReservationModal`/`make_reservation` RPC をマルチテナント化して流用

## ゲート③: §14（IAP プロダクト × UI 存在）
- [ ] **MVPは `features.ts` の `IAP_ENABLED=false` で購入UI非表示**（フラグ構造は実装）
- [ ] ON化時: `PlanCard`/`SubscriptionCard` の購入ボタンが SettingsScreen に描画
- [ ] 価格は `productsById[sku].localizedPrice`（配列順依存禁止＝ルールPRICE）・R35地域別倍率
- [ ] 上限ゲート（キャスト数/予約数）は共通関数に集約し全経路が通す（ルールGATE-1）

## ゲート④: §15（UGC 4要件・App Store 1.2・R28流用）
- [ ] ①投稿前フィルタ（店名/キャスト名/紹介文/予約メモ）②通報＋24時間以内対応(`ky_reports`)③ブロック(`ky_blocks`)④連絡先公開(rurifukuro@gmail.com)

## ゲート⑤: §16（法務・プライバシー）
- [ ] **アプリ内アカウント削除**（5.1.1(v)・`DeleteAccountModal`＋関連 `ky_*` カスケード削除）
- [ ] プライバシーポリシー（委託先としての安全管理措置・App Privacy申告＝収集ありで「収集なし」不可）
- [ ] 利用規約に**表明保証条項**（店側が必要な許認可を取得・接待目的外の健全カフェ予約）＝風営法リスク切り離し

## ゲート⑥: 同名画面の流用元との並べ比較（ルールSCREEN-COMPARE）
- [ ] SettingsScreen 等は流用元を Read で全文読み、セクション/部品を1つずつ照合（「描画＝動作」と混同しない・エミュで各セクションをタップ確認）

# 検証ゲート（毎修正の完了条件・INIT G1〜G4）
- [ ] G1: `npx tsc --noEmit` EXIT:0（any禁止）
- [ ] G2: i18nチェック（全キー存在・ハードコード日本語禁止）
- [ ] G4: エミュレータ/実機スモーク（変更箇所を操作して確認）
- [ ] 1指示=1Rev=1コミット＋REVISION_LOG追記（日本語コミットメッセージ＝W1）
