# きゃすりん REVISION_LOG

コンカフェ特化予約管理SaaS（マルチテナント・提供者iOSアプリ＋客側公開Web）。
**1指示=1Rev=1コミット**。流用元（concafe-yoyaku/とれはんっ！/レジさぽっ！）のRevコメントは無視し **Rev1から独自採番**（ルールINIT）。

---

## Rev1 (2026-07-03) — ベースライン初期化

- Expo プロジェクト初期化（`create-expo-app@latest kyasuho --template blank-typescript`）
- **SDK57 → SDK54 へダウングレード**（App Store版 Expo Go が対応する唯一のSDK。`expo~54.0.0` / `react 19.1.0` / `react-native 0.81.5` / `expo-status-bar~3.0.9` / `typescript~5.9.2` / `@types/react~19.1.10`＝デイポスと同一）
- `app.json` をきゃすほ化：name「きゃすほ！」／slug `kyasuho-app`／scheme `kyasuho`／Bundle ID `com.kyasuho.app`（iOS `bundleIdentifier`・Android `package`・R1ロック）／`supportsTablet:false`／`userInterfaceStyle:automatic`／`softwareKeyboardLayoutMode:resize`
- `tsconfig.json` strict=true（テンプレ既定・INIT準拠）
- `.gitignore` に `.env` 追加（鍵の混入防止）
- `SPEC.md`（仕様書ドラフト）配置／`AGENTS.md` 整備（SDK54固定・必読ルール・実装チェックリスト §3・横断ゲート §9/§11/§14/§15/§16）
- **git 初期コミット＝本Rev1がベースライン**（`create-expo-app` は `git init`+`git add` のみで commit 未実施だった＝urehanの「コミット忘れで蓄積」を回避）
- ポート割当=**8086**（expo-startスキル割当表へ追記予定）
- Supabase：MVPは concafe-yoyaku（ref=rhmuitgbvilqwdevxxox）に `ky_*` 相乗り→本番前に専用プロジェクト分離
- 検証ゲート：`npx tsc --noEmit` EXIT:0

**現状=Phase 0 初期化のベースラインのみ（App.tsxはテンプレ）。実装（Auth→受付設定→予約台帳→客Web…）はRev2以降。**

---

## Rev2 (2026-07-03) — アプリ基盤（型・テーマ・i18n・5タブナビ）

SPEC §19-#1「基盤」を実装。5タブが日本語で起動する土台まで。

- **依存追加（SDK54互換）**：`@react-navigation/native`^7.3.5／`@react-navigation/bottom-tabs`^7.18.5／`react-native-screens`~4.16.0／`react-native-safe-area-context`~5.6.0／`@react-native-async-storage/async-storage`2.2.0／`@expo/vector-icons`^15.0.3／`@supabase/supabase-js`^2.110.0
- **`src/types/index.ts`**：カラーテーマ（`ThemeColor`/`THEMES` 8色＝とれはんっ！流用）＋予約ドメイン型（`Tenant`/`Cast`/`UnlockWindow`/`Reservation`/`ReservationStatus`/`BusinessInfo`＝SPEC §10）
- **`src/i18n/`**：`translate` エンジン（とれはんっ！流用・ja フォールバック＋`{name}`補間）＋`strings.json`（ja のみ・タブ/プレースホルダ文言）。`TKey` で未定義キー参照を tsc が検知（I18N-2＝ハードコード日本語禁止の器）
- **`src/context/`**：`ThemeContext.tsx`（流用・キー`ky_themeKey`・既定`pink`）／`LanguageContext.tsx`（**最小版**＝language/setLanguage/t/isReady。初回同意・規約フローは §16 法務実装フェーズで後付け）
- **`src/config/features.ts`**：`IAP_ENABLED=false`＋`FREE_LIMITS`（§14 フラグ構造・GATE-1の器）
- **`src/components/common/PlaceholderScreen.tsx`**（共通の器）＋**`src/screens/` 5画面**（Reservations/Schedule/Casts/Analytics/Settings）
- **`App.tsx`**：`SafeAreaProvider`>`ThemeProvider`>`LanguageProvider`>`NavigationContainer`>`BottomTab`（5タブ）。**TAB-ICON準拠**（`calendar-check`/`clock-edit`/`account-star`/`chart-box`/`cog`・絵文字なし）・型付き`RootTabParamList`・`initialRouteName=Reservations`
- **Supabase方針の確定**：concafe-yoyaku の `src/lib/supabase.ts` は Vite（`import.meta.env`）＝**客Web専用**。提供者アプリ用は `EXPO_PUBLIC_`＋AsyncStorage セッションで**別途新規**（Rev3 認証で作成）
- **検証**：`npx tsc --noEmit` EXIT:0。**エミュレータ実機スモーク（G4）は次Rev（認証/受付設定の実装）でまとめて実施**（Rev2は状態を持たない静的なUI骨組みのみのため）

---

## Rev3 (2026-07-04) — 認証＋マルチテナント基盤（コード）

SPEC §19-#2「認証」を実装。**実DB適用・`.env` 設定・エミュスモークは承認後**（別アプリ本番＝concafe-yoyaku への相乗りのため、実適用の手前で停止）。

- **依存追加**：`react-native-url-polyfill`（Supabase Auth のURL処理・SDK54互換・`npx expo install`）
- **`src/config/supabase.ts`**：提供者アプリ用クライアント。**認証あり設定**＝`persistSession:true`/`autoRefreshToken:true`/`detectSessionInUrl:false`＋`storage:AsyncStorage`（とれはんっ！の匿名モデル `persistSession:false` とは逆）。URL/anon キーは `EXPO_PUBLIC_`（WEB4公開安全）・service_roleは埋め込まない。未設定検出 `hasSupabaseConfig`
- **相乗り先のキー種別を確認**：concafe-yoyaku の client は `VITE_SUPABASE_ANON_KEY`（＝**anon key** 種別）→提供者アプリも `EXPO_PUBLIC_SUPABASE_ANON_KEY`（同種別）。とれはんっ！/デイポスの `PUBLISHABLE_KEY` は別プロジェクトの事情で不採用
- **`src/services/tenants.ts`**：`ensureTenant(userId)`＝セッション確立後にテナントが無ければ仮テナント（`slug=shop-<短縮uid>`/`name=マイ店舗`）を1件作成。メール確認 ON/OFF 両対応・1アカウント1店舗（§12）。エラーは throw（BE-2）
- **`src/context/AuthContext.tsx`**：`session/user/isReady/configured`＋`signUp/signIn/signOut`。`getSession`＋`onAuthStateChange` 購読。`userId` 変化 useEffect で `ensureTenant`（失敗は握りつぶさず `console.warn`＝BE-2）
- **`src/components/KeyboardDoneBar.tsx`**：とれはんっ！流用。**背景 `#8E8E93`**（メモリ厳命の標準グレー＝とれはんっ！現物の `#888888` よりメモリを優先）・**KAVの外に置く鉄則**をコメント明記・`t('common.kbdDone')`
- **`src/components/common/LoadingScreen.tsx`**：全画面スピナー（テーマ背景）
- **`src/screens/AuthScreen.tsx`**：メール＋パスワードのサインアップ/ログイン切替。`KeyboardAvoidingView`＋`KeyboardDoneBar`（**KAVの外＝兄弟**）・テーマ/i18n対応・入力バリデーション・Supabase英語エラーの代表2ケース日本語化・確認メール案内・`.env` 未設定カード
- **`App.tsx`**：`AuthProvider` 追加＋`RootGate`（`isReady`→Loading／未`session`→`AuthScreen`／`session`→`NavigationContainer`>Tabs）
- **`src/i18n/strings.json`**：`auth.*` / `common.loading` / `common.kbdDone` 追加（`TKey` で網羅チェック・ハードコード日本語なし）
- **`supabase/migrations/0001_ky_tenants.sql`**：`ky_tenants`（slug/name/genre/owner_user_id/business_info/is_suspended/created_at/updated_at）＋`ky_set_updated_at` トリガ＋RLS（authenticated＝自テナント全操作 with check・anon＝`is_suspended=false` 公開SELECT）。**新規テーブル追加のみ＝非破壊**。関数名も `ky_` で相乗り先と衝突回避
- **`.env.example`**：`EXPO_PUBLIC_SUPABASE_URL`（rhmuitgbvilqwdevxxox）/`EXPO_PUBLIC_SUPABASE_ANON_KEY` 雛形（実値なし）
- **検証**：`npx tsc --noEmit` EXIT:0
- **実DB適用（2026-07-04・ユーザー承認のうえブラウザ自走で実施）**：
  - ①migration 実適用＝**完了**。concafe-yoyaku 本番 SQL Editor（Role postgres）で `0001_ky_tenants.sql` を実行→「Success. No rows returned」。適用後の検証SQLで `table_exists=ky_tenants` / `policy_count=2`（owner_all + public_read）/ `trigger_count=1`（ky_tenants_set_updated_at）/ `rls_enabled=true` / `row_count=0` を確認（WEB7＝適用後再検証）。**新規テーブル追加のみ・既存 concafe には非干渉**
  - ②`.env` に anon key 設定＝**完了**（concafe-yoyaku/.env から anon key を流用＝同一プロジェクト・公開安全キー・値は非出力。`.gitignore` 済み）
  - ③エミュ実機スモーク（サインアップ→テナント作成→タブ遷移）＝**残**（G4。実施すると本番 Supabase Auth にテスト用アカウントが1件作成される点に留意）

---

## Rev4 (2026-07-04) — 受付設定（ScheduleScreen・解禁ウィンドウCRUD）

SPEC §19-#3「受付設定」の提供者側UIを実装。日付別の解禁ウィンドウ（受付枠）の追加・削除・一覧表示＋客向け公開URL表示。

- **`src/components/common/FormModalShell.tsx`**：とれはんっ！流用コピー。`Modal(fullScreen)`＋`statusBarTranslucent`＋`KAV`＋`KeyboardDoneBar`統合シェル（ルールMODAL-SAFE）
- **`src/context/TenantContext.tsx`**：`TenantProvider`＝ログインユーザーのテナントを fetch→`tenant/loading/refresh/updateTenant` を提供。snake_case→camelCase変換。`useTenant()` フック
- **`src/services/schedule.ts`**：`fetchWindows(tenantId, date)`/`addWindow`/`removeWindow`/`updateWindow`。`rowToWindow` で snake_case→camelCase 変換
- **`supabase/migrations/0002_ky_unlock_windows.sql`**：`ky_unlock_windows`（id/tenant_id/date/open_from/close_at/seats/set_minutes/created_at/updated_at）＋CHECK制約(seats≥1, set_minutes≥10)＋複合INDEX(tenant_id, date)＋`ky_set_updated_at`トリガ＋RLS（authenticated=自テナント全操作・anon=未停止テナント公開SELECT）
- **`src/screens/ScheduleScreen.tsx`**：PlaceholderScreenを実UIに置き換え。60日分の日付ストリップ（横スクロール）＋選択日の受付枠一覧＋追加モーダル（FormModalShell使用・Stepperで時刻/席数/セット時間設定・自動〆切ON/OFF）＋削除確認Alert＋客向け公開URLカード
- **`src/i18n/strings.json`**：`schedule.*`/`common.cancel`/`common.delete`/`common.error` 追加（全15キー）
- **`App.tsx`**：`TenantProvider` 追加（RootGate内・NavigationContainerの外側＝全タブがuseTenant可能に）
- **実DB適用（2026-07-04・非破壊migration自走）**：
  - concafe-yoyaku 本番 SQL Editor で `0002_ky_unlock_windows.sql` を実行→「Success. No rows returned」
  - REST probe `GET /rest/v1/ky_unlock_windows?select=id&limit=0` → HTTP 200（テーブル実在確認）
- **検証**：`npx tsc --noEmit` EXIT:0
- **G4エミュスモーク＝次段階で実施**（Rev3のサインアップ→テナント作成と合わせてScheduleScreenの操作確認を行う）

---

## Rev5 (2026-07-04) — 予約台帳（ReservationsScreen・予約CRUD・make_reservation RPC）

SPEC §3-A / §19-#4「予約台帳」の提供者側UIを実装。日付別の予約一覧・詳細モーダル・手動予約追加・ステータス変更（来店/キャンセル/無断キャンセル/差戻し）・削除。

- **`supabase/migrations/0003_ky_reservations.sql`**：
  - `ky_reservations`テーブル（id/tenant_id/date/slot(HH:MM)/set_minutes/seat_no/customer_name/contact/party_size/cast_id/note/status/created_at/updated_at）＋CHECK制約（party_size≥1・set_minutes≥10・status∈4値）＋複合INDEX(tenant_id,date)＋`ky_set_updated_at`トリガ＋RLS（authenticated=自テナント全操作）
  - `ky_reservation_pins`テーブル（reservation_id FK CASCADE/pin 4桁CHECK/created_at）＋RLS（authenticated=delete）
  - `ky_slot_to_minutes(text)`ヘルパー関数（'HH:MM'→分変換・IMMUTABLE）
  - `ky_make_reservation` RPC（SECURITY DEFINER・advisory lock(hashtext(tenant_id||date))・解禁ウィンドウ照合・generate_seriesで空き席昇順自動割当・cancelled/no_showは空き扱い・4桁PIN挿入）＋anon/authenticatedへGRANT
- **`src/services/reservations.ts`**：`fetchReservations(tenantId, date)`/`updateStatus(id, status)`/`makeReservation`（RPC呼出し）/`deleteReservation`。`rowToReservation`でsnake_case→camelCase変換
- **`src/screens/ReservationsScreen.tsx`**：PlaceholderScreenを完全置き換え。
  - 日付ストリップ（過去7日+未来30日・initialScrollIndex=7で今日にスクロール）
  - 予約カード一覧（ステータスアイコン色分け: reserved=青/checked_in=緑/cancelled=灰/no_show=赤）＋アクティブ予約数バッジ
  - DetailModal（予約詳細表示＋ステータス変更アクション4種＋削除確認Alert）
  - AddReservationModal（名前/連絡先/時刻Stepper/人数/メモ・FormModalShell使用）
- **`src/i18n/strings.json`**：`reservation.*` 30キー追加（title/noReservations/addManual/detail/slot/customerName/contact/partySize/people/seats/seatNo/note/submit/close/changeStatus/deleteConfirm/namePlaceholder/contactPlaceholder/notePlaceholder/errorNameRequired/errorNoSeat/errorNotUnlocked/status.reserved/status.checked_in/status.cancelled/status.no_show/action.checkIn/action.noShow/action.cancel/action.revert）
- **実DB適用（2026-07-04・非破壊migration自走）**：
  - concafe-yoyaku 本番 SQL Editor（Role postgres）で `0003_ky_reservations.sql` を実行→「Success. No rows returned」
  - REST probe: `GET /rest/v1/ky_reservations?select=id&limit=0` → HTTP 200 / `GET /rest/v1/ky_reservation_pins?select=reservation_id&limit=0` → HTTP 200
- **検証**：`npx tsc --noEmit` EXIT:0（前セッションで確認済み）
- **G4エミュスモーク＝Rev3〜5まとめて次段階で実施**

---

## Rev6 (2026-07-04) — キャスト管理（CastsScreen・出勤スケジュール・指名ON/OFF）

SPEC §3-C / §19-#6「キャスト管理」を実装。キャストCRUD・出勤枠管理・指名受付ON/OFF・SNSリンク管理。

- **`src/types/index.ts`**：`Shift`型追加（id/tenantId/castId/date/startAt/endAt）
- **`supabase/migrations/0004_ky_casts_shifts.sql`**：
  - `ky_casts`テーブル（id/tenant_id/name/photo_url/sns_links(jsonb)/bio/accepts_nomination/sort_order/created_at/updated_at）＋INDEX(tenant_id)＋`ky_set_updated_at`トリガ＋RLS（authenticated=自テナント全操作・anon=未停止テナント公開SELECT）
  - `ky_shifts`テーブル（id/tenant_id/cast_id FK CASCADE/date/start_at/end_at/created_at/updated_at）＋INDEX(tenant_id,date)＋INDEX(cast_id,date)＋RLS（同上）
  - `ky_reservations.cast_id`にFK追加（→`ky_casts.id` ON DELETE SET NULL・0003で保留していた分）
- **`src/services/casts.ts`**：`fetchCasts`/`addCast`/`updateCast`/`deleteCast`/`fetchShifts`/`addShift`/`removeShift`。`rowToCast`/`rowToShift`でsnake_case→camelCase変換
- **`src/screens/CastsScreen.tsx`**：PlaceholderScreenを完全置き換え。
  - キャスト一覧（FlatList・アバター＋名前＋紹介文＋指名バッジ）＋FABで追加
  - CastCard（タップで詳細・編集/削除ボタン）
  - CastDetailView（プロフィールカード＋SNSリンクチップ＋出勤スケジュール）
    - 日付ストリップ（過去7日+未来30日）でシフト管理・追加/削除
  - CastEditModal（FormModalShell・名前/紹介文/指名ON-OFF/SNSリンク追加/削除）
  - AddShiftModal（FormModalShell・TimeStepper・出勤開始/終了時刻）
- **`src/i18n/strings.json`**：`cast.*` 27キー追加
- **実DB適用（2026-07-04・非破壊migration自走）**：
  - concafe-yoyaku 本番 SQL Editor（Role postgres）で `0004_ky_casts_shifts.sql` を実行→「Success. No rows returned」
  - REST probe: `GET /rest/v1/ky_casts?select=id&limit=0` → HTTP 200 / `GET /rest/v1/ky_shifts?select=id&limit=0` → HTTP 200
- **検証**：`npx tsc --noEmit` EXIT:0
- **G4エミュスモーク＝Rev3〜6まとめて次段階で実施**

---

## Rev7 (2026-07-04) — 通知基盤（プッシュトークン・Realtime購読・ローカル通知）

SPEC §3-E / §19-#7「通知」のMVP基盤を実装。予約INSERTをRealtimeで検知し提供者にローカル通知表示。

- **依存追加（SDK54互換）**：`expo-notifications`/`expo-device`/`expo-constants`（`npx expo install`）
- **`supabase/migrations/0005_ky_push_tokens_realtime.sql`**：
  - `ky_push_tokens`テーブル（id/tenant_id/user_id/token/platform/created_at/updated_at）＋UNIQUE(user_id,token)＋RLS（authenticated=自分のトークン全操作）
  - `supabase_realtime` publicationに`ky_reservations`を追加（新規予約のRealtime通知に必要）
- **`src/services/pushTokens.ts`**：
  - `setNotificationHandler`（フォアグラウンド通知表示設定・SDK54の`shouldShowBanner`/`shouldShowList`対応）
  - `registerForPushNotificationsAsync`（権限要求→Expo Push Token取得・実機のみ）
  - `savePushToken`/`removePushToken`（upsert/delete）
- **`src/context/NotificationContext.tsx`**：
  - ログイン＋テナント確定時にpush token登録
  - Supabase Realtimeで`ky_reservations` INSERTを購読（tenant_idフィルタ）
  - 新規予約検知→`scheduleNotificationAsync`でローカル通知（タイトル＋客名/日時）
- **`App.tsx`**：`NotificationProvider`追加（TenantProvider内・NavigationContainerの外）
- **`src/i18n/strings.json`**：`notification.*` 2キー追加
- **実DB適用（2026-07-04・非破壊migration自走）**：
  - concafe-yoyaku 本番 SQL Editor で `0005_ky_push_tokens_realtime.sql` を実行→「Success. No rows returned」
  - REST probe: `GET /rest/v1/ky_push_tokens?select=id&limit=0` → HTTP 200
- **検証**：`npx tsc --noEmit` EXIT:0
- **G4エミュスモーク＝Rev3〜7まとめて次段階で実施**
- **備考**：バックグラウンドpush送信（Expo Push API経由）は客Web（§19-#5）完成後にEdge Functionで実装予定。現時点はアプリ起動中のRealtime＋ローカル通知のみ

---

## Rev8 (2026-07-04) — UGC 4要件（投稿前フィルタ・通報・ブロック・連絡先）

SPEC §15 / §19-#8「UGC 4要件」を実装。App Store ガイドライン 1.2 / R28 準拠のコンテンツ安全基盤。

- **`src/config/contentFilter.ts`**：とれはんっ！流用（REUSE-TRIGGER）。NFKC正規化＋小文字化＋空白除去→BANNED_WORDS部分一致。差別語・脅迫語に限定（成人向け対象外＝コンカフェ文脈で正当）
- **`src/config/contact.ts`**：連絡先メール（④要件・`CONTACT_EMAIL=rurifukuro@gmail.com`＝R17）
- **`src/utils/contentGuard.ts`**：`guardFields()`＝保存前フィルタガード。NG検出→Alert→false（保存中止）
- **`supabase/migrations/0006_ky_reports_blocks.sql`**：
  - `ky_reports`テーブル（id/tenant_id/reporter_user_id/target_type(cast|reservation|tenant)/target_id/reason/status(pending|resolved|dismissed)/created_at/updated_at）＋INDEX(tenant_id)＋部分INDEX(status=pending)＋`ky_set_updated_at`トリガ＋RLS（authenticated=自分の通報のinsert/select）
  - `ky_blocks`テーブル（id/user_id/blocked_user_id/created_at）＋UNIQUE(user_id,blocked_user_id)＋INDEX(user_id)＋RLS（authenticated=自分のブロック全操作）
- **`src/services/reports.ts`**：`submitReport`/`fetchMyReports`
- **`src/services/blocks.ts`**：`fetchBlockedUsers`/`blockUser`/`unblockUser`（upsert/delete）
- **`src/screens/CastsScreen.tsx`**：CastEditModalの保存前に`guardFields({name, bio})`追加（①投稿前フィルタ）
- **`src/screens/ReservationsScreen.tsx`**：AddReservationModalの保存前に`guardFields({name, note})`追加（①投稿前フィルタ）
- **`src/i18n/strings.json`**：`filter.*`/`report.*`/`block.*`/`contact.*` 17キー追加
- **実DB適用（2026-07-04・非破壊migration自走）**：
  - concafe-yoyaku 本番 SQL Editor（Role postgres）で `0006_ky_reports_blocks.sql` を実行→「Success. No rows returned」
  - REST probe: `GET /rest/v1/ky_reports?select=id&limit=0` → HTTP 200 / `GET /rest/v1/ky_blocks?select=id&limit=0` → HTTP 200
- **検証**：`npx tsc --noEmit` EXIT:0
- **UGC §15 4要件チェック**：①投稿前フィルタ（contentFilter＋guardFields）✅ ②通報＋24h対応（ky_reports）✅ ③ブロック（ky_blocks）✅ ④連絡先公開（CONTACT_EMAIL）✅
- **G4エミュスモーク＝Rev3〜8まとめて次段階で実施**

---

## Rev9 (2026-07-04) — 法務（利用規約・PP・アカウント削除モーダル・ky_delete_account RPC）

SPEC §16 / §19-#9「法務」を実装。利用規約（表明保証条項含む）・プライバシーポリシー・アカウント削除機能。

- **`src/data/privacyPolicy.ts`**：`PolicySection`/`PolicyDoc`インターフェース定義＋きゃすほ用PP（7セクション：収集情報/利用目的/第三者提供/安全管理措置/データ保存削除/問い合わせ/改定）
- **`src/data/termsOfUse.ts`**：きゃすほ用利用規約（8セクション）。**§3「提供者の表明保証」が核心**＝風営法許認可の自主取得維持・情報正確性・法令違反不使用・違反時アカウント停止/削除権。§4投稿コンテンツ条項でUGC関連明記
- **`src/components/TermsOfUseModal.tsx`**：とれはんっ！流用パターン。fullScreen Modal＋StatusBar対応＋ScrollView内でPolicyDoc.sections.map表示。きゃすほ！は日本語のみ（多言語Record不要→PolicyDoc直接import）
- **`src/components/PrivacyPolicyModal.tsx`**：同上構造。PRIVACY_POLICY直接import
- **`src/components/DeleteAccountModal.tsx`**：確認ワード入力＋二段階確認Alert。`supabase.rpc('ky_delete_account')`→`signOut()`。KeyboardDoneBar統合（KAV外）
- **`src/components/KeyboardDoneBar.tsx`**：`theme` propをoptionalに変更（実際未使用・DeleteAccountModalから引数なし呼び出しに対応）
- **`supabase/migrations/0007_ky_delete_account.sql`**：
  - `ky_delete_account()` RPC（SECURITY DEFINER）＝auth.uid()のテナントに紐づくky_*全9テーブルをカスケード削除（shifts→reservation_pins→push_tokens→reports→reservations→casts→unlock_windows→tenants）＋blocks/reports(reporter)＋auth.users本体
  - `REVOKE ALL FROM public` / `GRANT EXECUTE TO authenticated, service_role`（anon不可・メモリsupabase_edge_function_rpc_grant準拠）
- **`src/i18n/strings.json`**：`common.close`/`settings.*`（terms/privacy/lastUpdated/deleteAccount/deleteAccountWarningTitle/deleteAccountWarningBody/deleteAccountConfirmLabel/deleteConfirmWord/deleteAccountConfirmTitle/deleteAccountConfirmBody/deleteAccountButton）13キー追加
- **実DB適用（2026-07-04・非破壊migration自走＝CREATE FUNCTION＋GRANT/REVOKEのみ）**：
  - concafe-yoyaku 本番 SQL Editor（Role postgres）で `0007_ky_delete_account.sql` を実行→「Success. No rows returned」
  - REST probe: `POST /rest/v1/rpc/ky_delete_account` → HTTP 400（未認証のため期待通り。404ではない＝関数実在確認）
- **検証**：`npx tsc --noEmit` EXIT:0
- **§16 法務チェック**：アカウント削除（5.1.1(v)）✅ PP（委託先記載・App Privacy対応）✅ 利用規約（表明保証条項＝風営法リスク切り離し）✅
- **G4エミュスモーク＝Rev3〜9まとめて次段階で実施**

---

## Rev10 (2026-07-04) — 設定画面（SettingsScreen・店舗プロフィール編集・テーマ・ログアウト）

SPEC §3-G / §19-#10「設定」を実装。PlaceholderScreenを完全置き換え。

- **`src/screens/SettingsScreen.tsx`**：PlaceholderScreenを完全置き換え。5セクション構成：
  - **店舗プロフィール**：テナント名/ジャンル表示→タップでStoreProfileModal
  - **法務**：利用規約/PP/お問い合わせ（mailto:rurifukuro@gmail.com）
  - **テーマカラー**：8色ドットグリッド（themeKey選択→AsyncStorage保存）
  - **アカウント**：ログアウト（確認Alert）/アカウント削除（DeleteAccountModal）
  - **アプリ情報**：バージョン（`app.json` 直読み＝ルールVER）
- **`src/components/StoreProfileModal.tsx`**：FormModalShell使用。店名/ジャンル/住所/営業時間/電話/メモの6フィールド編集→`updateTenant()`→Supabase更新。`guardFields()`で投稿前フィルタ（UGC §15）
- **`src/i18n/strings.json`**：`settings.*`（sectionStore/sectionLegal/sectionAppearance/sectionAccount/sectionAbout/theme/version/signOut/signOutConfirmTitle/signOutConfirmBody/storeProfile/storeName/storeGenre/storeGenrePlaceholder/storeAddress/storeOpenHours/storeTel/storeNote/storeNameRequired/save）20キー追加
- **検証**：`npx tsc --noEmit` EXIT:0
- **§3-G 設定チェック**：Auth✅（AuthScreen既存）/アカウント削除✅（Rev9 DeleteAccountModal）/店プロフィール✅/規約PP✅/通報ブロック✅（Rev8基盤・導線はSettingsからReportInbox後続）/IAP（OFF）✅/テーマ✅/バージョン✅
- **G4エミュスモーク＝Rev3〜10まとめて次段階で実施**

---

## Rev11 (2026-07-04) — アプリ名称変更「きゃすほ！」→「きゃすりん」

ユーザー決定に基づくアプリ名変更。理由＝4文字・人名風で覚えやすい・マスコットキャラ展開に好適・同人誌関係の「っ！」系統と差別化。J-PlatPat未衝突・Web衝突なし確認済み。

**変更対象**（Bundle ID `com.kyasuho.app` / slug `kyasuho-app` / scheme `kyasuho` / 内部プレフィックス `ky_*` はR1ロックのため不変）：
- **`app.json`**：`name` → `"きゃすりん"`（slug/scheme/bundleIdentifier/package は不変＝R1）
- **`src/i18n/strings.json`**：`app.name` → `"きゃすりん"`
- **`src/data/termsOfUse.ts`**：アプリ名参照を「きゃすりん」に更新
- **`src/data/privacyPolicy.ts`**：アプリ名参照を「きゃすりん」に更新
- **`SPEC.md`**：タイトル・§2確定方向性（語源説明更新）・§7ポート・§8競合分析・§11流用表・§14課金設計・§18 app.json参照を全て「きゃすりん」に更新
- **`AGENTS.md`**：仕様書参照を「きゃすりん」に更新
- **`.env.example`**：コメントを「きゃすりん」に更新
- **`src/types/index.ts`**：ファイルヘッダコメント更新
- **`src/config/supabase.ts`**：コメント更新
- **`REVISION_LOG.md`**：ヘッダを「きゃすりん」に更新（歴史的エントリは不変）
- **検証**：`npx tsc --noEmit` EXIT:0
- **注意**：supabase/migrations/*.sql のコメント内「きゃすほ！」は歴史的記録のため不変

---

## Rev12 (2026-07-04) — 客側公開Web（§19-#5・カレンダー→空き枠→予約→PIN編集）

SPEC §3-D / §19-#5「客Web予約」を実装。concafe-yoyaku の CustomerPage を流用し、マルチテナント化＋きゃすりん固有仕様（HH:MM時刻・窓毎席数/セット時間・キャスト指名）に適合。

- **`web/` プロジェクト新規作成**（Vite + React 19 + TypeScript strict + HashRouter）：
  - `package.json`：react ^19.1.0 / react-dom / react-router-dom ^7.6.3 / @supabase/supabase-js ^2.49.9 / vite ^6.3.5 / typescript ~5.8.3 / @vitejs/plugin-react
  - `vite.config.ts`：react plugin + VITE_BASE_PATH 対応（WEB3＝GitHub Pages サブパス対応）
  - `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`：composite TS config, strict=true
  - `index.html`：`<title>きゃすりん - 予約</title>`
  - `.env.example`：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_BASE_PATH
  - `.env`：実際のanon key設定（.gitignore済み・WEB4公開安全キー）

- **lib層**：
  - `supabase.ts`：createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
  - `types.ts`：KyTenant / KyUnlockWindow / KyCast / KyShift / KyReservation / DayStatus / MakeReservationResult / VerifyPinResult / CancelResult
  - `timeUtils.ts`：slotToMinutes('HH:MM'→int) / minutesToSlot / formatDate / getDaysInMonth / getFirstDayOfWeek / countAvailableSeats / computeDayStatus / getAvailableSlots（10分刻みスロット生成）

- **hooks層**：
  - `useTenant.ts`：URL slug → ky_tenants SELECT single → KyTenant
  - `useUnlockWindows.ts`：useUnlockWindows(tenantId, date) / useNextOpenDate(tenantId) / useMonthAvailability(tenantId, year, month)＝月単位で日毎DayStatus(available/low/full)算出
  - `useReservations.ts`：useReservations(tenantId, date) → active予約一覧 + refresh
  - `useCasts.ts`：useCasts(tenantId) / useShifts(tenantId, date)

- **コンポーネント**：
  - `Calendar.tsx`：月表示カレンダー。useMonthAvailabilityで日毎〇/▲/×色分け。前月/翌月ナビ＋凡例
  - `TimeSlotList.tsx`：選択日の空き枠グリッド。getAvailableSlotsで10分刻みスロット＋出勤キャストチップ表示。満席=disabled
  - `ReservationModal.tsx`：予約フォーム（名前*/連絡先/人数/指名キャスト/備考/PIN(4桁任意)）→ky_make_reservation RPC→完了画面（席番号＋PIN表示）。指名可キャストは出勤シフト照合で自動フィルタ
  - `ReservationEditModal.tsx`：PIN検証→予約キャンセルフロー（ky_verify_reservation_pin→ky_cancel_reservation RPC）
  - `TenantPage.tsx`：統合ページ（Calendar + TimeSlotList + ReservationModal + ReservationEditModal）。nextOpenDate自動誘導・予約一覧からPINキャンセル

- **エントリーポイント**：
  - `main.tsx`：createRoot + StrictMode
  - `App.tsx`：HashRouter + Routes（`/:slug` → TenantPage）
  - `App.css`：カレンダー/スロット/モーダル/フォーム/PIN表示のスタイル一式（モバイルファースト・max-width:480px）

- **concafe-yoyaku との設計差異**（マルチテナント化で変更した点）：
  | 項目 | concafe-yoyaku | きゃすりん客Web |
  |---|---|---|
  | テナント | シングル | マルチ（URL `/#/:slug`→slug解決） |
  | 時刻 | 整数(BUSINESS_START起点分) | 'HH:MM'文字列(0時起点) |
  | メニュー/注文 | あり | なし |
  | キャスト指名 | なし | あり（ky_casts/ky_shifts） |
  | テーブル名 | unlock_windows等 | ky_*プレフィックス |
  | 席数 | settings.seat_count(全体) | ky_unlock_windows.seats(窓毎) |
  | セット時間 | SET_DURATION=40固定 | ky_unlock_windows.set_minutes(窓毎) |

- **`supabase/migrations/0008_ky_customer_web_rpcs.sql`**：
  - `ky_reservations_public_read` anon SELECTポリシー（active予約＋未停止テナントのみ・客WebのUIは空き席数のみ表示で名前は非表示）
  - `ky_verify_reservation_pin(uuid, text)` RPC（SECURITY DEFINER・PIN照合→ok/no_pin/mismatch）
  - `ky_cancel_reservation(uuid, text)` RPC（SECURITY DEFINER・PIN照合→cancelled）
  - anon/authenticated へ GRANT EXECUTE
- **実DB適用（2026-07-04・非破壊migration自走・`supabase db query --linked`）**：
  - concafe-yoyaku 本番に `0008_ky_customer_web_rpcs.sql` を適用→「rows: []」（DDL成功）
  - 検証: `pg_policies` で `ky_reservations_public_read` 実在確認 / `pg_proc` で `ky_verify_reservation_pin` + `ky_cancel_reservation` 実在確認
- **検証**：`npx tsc --noEmit` EXIT:0（web側）
- **dev server動作確認**：Vite dev server（port 5175）起動→`/#/test-shop`でTenantPageレンダリング確認。Supabase REST API（`ky_tenants?slug=eq.test-shop`）への問い合わせ発行＋テナント不在時「店舗が見つかりません」エラーページ表示を確認。コンソールエラーなし

---

## Rev13（2026-07-05）仕様書を三面構成へ改訂（SPEC.md＋AGENTS.md・コミット223d7b2）

- **ユーザー指示**：「アプリ／PC作業用サイト／アプリとサイトの連携」の3点を必須要件として仕様書を練り直し
- **§1/§2**：二面→**三面構成**（提供者iOSアプリ＋提供者管理Web(PC)＋客側公開Web・同一Supabase Auth/DB/RLS共有）
- **§3-J新設**：提供者管理Web（#/admin・同一アカウント・予約台帳/受付設定/キャスト/売上給与勤怠/CSV/シフト表生成・PC優先UI）
- **§8-2新設**：ナイトレジャー業界POS価格調査（NIGHTCORE¥9,800/GROW¥10,000〜/夜レジ¥29,800/YONAREZI¥50,000〜/VENUS買切¥95,000等10サービス）→ボリュームゾーン月1〜3万円・予約管理主軸は空白・フリーミアム不在＝きゃすりん¥1,980〜2,980案の根拠
- **§9-3/§11/§17/§19/§21**：管理Web設計（客Webと同一Viteアプリ・React.lazyチャンク分離・既存RLSが自動適用でバックエンド追加ほぼ不要・AdminXxx 11コンポーネント）
- **§22新設**：シフト表画像生成エンジン＝「テンプレート=純データShiftTemplateDefinition＋共通レンダラー、AI=パラメータ生成器（画像を描かせない）」。Web正準=html-to-image/アプリ=view-shot。AIはEdge Function ky-shift-design（ANTHROPIC_API_KEY=Secret・R13準拠）・フォールバック設計
- **§23新設**：給与計算式（時給×時間＋指名バック＋ドリンクバック−控除）・勤怠5値・税金CSV 3種の列仕様（UTF-8 BOM・税務助言はしない=税理士法回避）
- **§24新設**：アプリ⇔Web連携7項目（Auth共有/データ共有/相互導線/Realtime/時刻表現/plan共有）
- **§10**：ky_tenants.plan列追加（三面共通エンティトルメント源泉）／**§14**：価格根拠＋Web課金論点
- **AGENTS.md**：チェックリストにJ/§24行追加

---

## Rev14（2026-07-05）売上・給与・勤怠（アプリ側＝§3-F/§3-H・§23）＋migration 0009

SPEC §5実装順序11＋12。分析タブを「売上／給与／勤怠」の実機能へ差し替え。

- **`supabase/migrations/0009_ky_sales_payroll_attendance.sql`**（順序11・前回作成→本Revでコミット）：`ky_daily_sales`（unique(tenant_id,date)）／`ky_attendance`（unique(cast_id,date)・status 5値CHECK）／`ky_cast_payroll`（unique(cast_id,date)・金額内訳列）／`ky_payroll_settings`（unique(tenant_id)・default 時給1200/指名300/ドリンク100/遅刻控除0）＋各RLS（authenticated=自テナントのみ）。**実DB適用・REST検証済み（非破壊・新規テーブル追加のみ）**
- **依存追加**：`expo-file-system`~19.0.23／`expo-sharing`~14.0.8（`npx expo install`＝SDK54互換）
- **`src/types/index.ts`**：`AttendanceStatus`/`AttendanceReasonCategory`/`Attendance`/`DailySales`/`CastPayroll`/`PayrollSettings` 追加
- **`src/utils/payrollCalc.ts`**：§23計算式の**純関数**（React/Supabase非依存＝§24で管理Webへ同式コピー共有前提）。`hhmmToMinutes`（0-29時）/`calcMinutesWorked`（日跨ぎ+24h）/`calcPayroll`（basePay=floor(分×時給/60)）/`splitMinutes`/`monthRange`
- **`src/utils/csv.ts`**：UTF-8 **BOM付き**（`String.fromCharCode(0xfeff)`＝不可視文字直書き回避）・CRLF・RFC4180エスケープ→`expo-file-system` File API（`Paths.cache`）＋`expo-sharing` で共有（§23税金CSV）
- **サービス3本**：`services/sales.ts`（upsert onConflict='tenant_id,date'）／`services/attendance.ts`（onConflict='cast_id,date'）／`services/payroll.ts`（設定upsert・明細upsert・**指名数自動集計**=ky_reservationsのstatus≠cancelled・**勤怠→給与自動生成**=出勤扱い4値のみ・既存明細スキップ＋ignoreDuplicates=手修正を上書きしない）
- **`src/screens/AnalyticsScreen.tsx`**：Placeholder→実装。月ナビ（'YYYY-MM'）＋セグメント3切替コンテナ
- **`src/screens/analytics/`**：`common.ts`（共有props/formatYen/monthDates等）／`NumberField.tsx`／`SalesView.tsx`（月次集計カード＋月の全日リスト入力＋売上CSV）／`PayrollView.tsx`（給与設定4値・勤怠から自動生成・キャスト別集計→日別明細→手修正モーダル＝内訳ライブプレビュー・給与CSV=対象月/キャスト名/出勤日数/総勤務時間h:mm/内訳/支給額）／`AttendanceView.tsx`（日付ストリップ→キャスト別記録・ステータス5値＋理由＋入退店時刻TimeStepper＋代打選択・月次集計＋出勤率・勤怠CSV）
- **`src/i18n/strings.json`**：`analytics.*`/`sales.*`/`payroll.*`/`attendance.*`/`csv.*`/`common.save` 追加（CSV列名も i18n キー＝§23列仕様と一致）
- **`tsconfig.json`**：`exclude: ["node_modules", "web"]` 追加（web/はVite独自tsconfig持ち＝アプリ側tscから分離。Rev12以降webがルートtscに巻き込まれていたのを是正）
- **検証**：`npx tsc --noEmit` EXIT:0（G1・TKeyでi18n網羅検査=G2）。エミュスモーク（G4）は順序12〜17完了後にまとめて実施予定

---

## Rev15（2026-07-05）提供者管理Web基盤（#/admin＝§3-J・§21）

SPEC §5実装順序13。客Webと同一Viteアプリ（`web/`）に管理Webを追加。i18nは§21の決定どおり日本語直書き。

- **`web/src/App.tsx`**：`/admin/*` ルート追加。`React.lazy(() => import('./admin/AdminApp'))`＋`Suspense`でチャンク分離（§21・客側バンドルに管理コードを混ぜない）
- **`web/src/lib/types.ts`**：`KyReservationFull` 追加（管理用全列＝contact/party_size/cast_id/note/created_at・seat_no null許容。客Web用 `KyReservation` は公開安全列のまま不変）
- **`web/src/admin/adminApi.ts`**：管理用データアクセス層（全てerror throw＝BE-2準拠）。`fetchOwnTenant`（`ky_tenants.owner_user_id=auth.uid()`でテナント解決）／予約=全status取得・status更新・削除・`ky_make_reservation` RPC手動追加（p_pin=null）／受付枠=取得・追加・削除／キャスト=取得・追加（sns_links:[]）・更新・削除／シフト=取得・追加・削除。既存RLSがそのまま効くためポリシー追加なし（§21）
- **`web/src/admin/AdminApp.tsx`**（default export＝lazy対象）：`supabase.auth.getSession`＋`onAuthStateChange`購読→未ログインは`AdminLogin`・ログイン済みはテナント解決→`AdminLayout`＋ネストRoutes。テナント無しアカウントには「アプリで店舗を作成してください」＋再読み込み/ログアウト
- **`web/src/admin/AdminLogin.tsx`**：`signInWithPassword`（Web版supabase-jsデフォルト=localStorage永続）。新規登録はアプリ側へ誘導する注記
- **`web/src/admin/AdminLayout.tsx`**：サイドバー7項目（予約台帳/受付設定/キャスト/売上管理/給与計算/勤怠管理/シフト表作成）＋店名ヘッダ＋ログアウト（confirm付き）＋`Outlet`
- **`web/src/admin/AdminReservations.tsx`**：日付ナビ（前日/翌日/今日）・全statusテーブル（時間/席/名前/人数/指名/連絡先/メモ/状態バッジ/操作）・状態遷移ボタン（来店/キャンセル/無断/戻す＝confirm付き・削除は2段confirm）・手動追加フォーム（RPC経由＝席自動割当。no_available_seat/not_unlockedのエラー文言表示）
- **`web/src/admin/AdminSchedule.tsx`**：公開URLカード（`#/<slug>`・コピー/開く）・日付ナビ・受付枠テーブル・追加（開始/〆切/席数/セット分・〆切>開始バリデーション）・削除
- **`web/src/admin/AdminCasts.tsx`**：キャストCRUD（追加/編集/削除2段confirm）・指名受付トグル・出勤スケジュール（日付ナビ＋シフト追加/削除。日跨ぎはアプリ側へ誘導）
- **`web/src/admin/AdminPlaceholder.tsx`**：売上/給与/勤怠/シフト表の4ルートは「準備中」（順序14/15で実装）
- **`web/src/admin/admin.css`**：PC優先スタイル一式（min-width:960px・サイドバー220px・テーブル/バッジ/フォーム。既存CSS変数流用）
- **`web/src/vite-env.d.ts`**：新規（`/// <reference types="vite/client" />`）。web単体`tsc -b`が`import.meta.env`型エラーになる欠落を是正（Rev12でVite標準ファイルが漏れていた）
- **検証**：`web`で`npx tsc -b` EXIT:0＋`npm run build`成功＝AdminAppが別チャンク（JS 30KB/CSS 5KB）に分離。dev server（5175）で `#/admin`ログイン画面表示・客側`#/<slug>`非破壊・コンソールエラーなしを確認。ログイン後画面の実操作はエミュスモーク時にテストアカウントで実施予定（Task #15）
- **既知の残確認**：preview toolsの合成クリックではフォームsubmit発火を確認できず（auth POST未観測）。コード配線はReact標準パターンのため実ブラウザでの動作をTask #15で要実証

---

## Rev16（2026-07-05）管理Web 売上・給与・勤怠＋税金CSV（§3-J残り3画面＝§23）

SPEC §5実装順序14。管理Webの「準備中」3ルートを実画面へ差し替え（残Placeholderはシフト表作成のみ＝順序15）。

- **`web/src/admin/payrollCalc.ts`**：アプリ側 `src/utils/payrollCalc.ts` のコピー（§24＝同一計算式の共有）。型importだけ自己完結化（`PayrollCalcSettings`=camelCase 4値）・関数本体は原本と同一
- **`web/src/admin/csv.ts`**：`toCsv`（UTF-8 BOM・CRLF・RFC4180エスケープ＝アプリ側 `src/utils/csv.ts` と同一）＋`downloadCsv`（Blob＋`<a download>`＝Web版はシェアシートでなくブラウザダウンロード）
- **`web/src/lib/types.ts`**：`KySales`/`KyAttendanceStatus`/`KyAttendanceReason`/`KyAttendance`/`KyPayrollSettings`/`KyCastPayroll` 追加（DB snake_caseそのまま＝Web側の既存流儀）
- **`web/src/admin/adminApi.ts`**：売上/勤怠/給与のCRUD追記（アプリ側 services 3本と同クエリ・同onConflict）＋`DEFAULT_PAYROLL_SETTINGS`＋`countNominationsByMonth`（status≠cancelled）＋`generatePayrollFromAttendance`（出勤扱い4値のみ・既存明細スキップ＋ignoreDuplicates＝手修正保護・アプリ側と同ロジック）
- **`web/src/admin/AdminSales.tsx`**：月ナビ＋月次集計カード（月間売上/営業日数/セット/ドリンク/指名/その他）＋入力フォーム（同日付はupsert上書き・別月保存時はその月へ移動）＋日別テーブル（編集/削除）＋売上CSV
- **`web/src/admin/AdminPayroll.tsx`**：給与設定4値フォーム（未保存テナントはdefault表示・保存はupsert(tenant_id)）＋「勤怠から自動生成」（勤怠0件/新規0件/N件作成の文言分岐）＋支給額合計・キャスト別集計カード（出勤日数・勤務h:mm）＋明細テーブル＋編集フォーム（時間/分・指名・ドリンク・その他・控除・メモ→`calcPayroll`で§23式再計算・控除は手入力値採用）＋給与CSV（§23列＝キャスト別月次集計行・総勤務時間h:mm）
- **`web/src/admin/AdminAttendance.tsx`**：月ナビ＋記録フォーム（ステータス5値・理由5値・代打キャストselect=substitute時のみ・入退店time未入力可・同キャスト×日付upsert上書き）＋記録テーブル（状態色分け）＋キャスト別月次集計（出勤/遅刻/欠勤/出勤率＝アプリ側AttendanceViewと同定義）＋勤怠CSV（理由=ラベル+詳細を': '結合＝アプリ側と同形式）
- **`web/src/admin/AdminApp.tsx`**：sales/payroll/attendance の3ルートを実コンポーネントへ差し替え
- **`web/src/admin/admin.css`**：`.admin-stat`系（集計カード）・`.admin-spacer`・`.att-*`（勤怠ステータス色分け）追加
- **CSV列名**：§23の3種（売上=日付,総売上,セット数,ドリンク数,指名数,その他収入,メモ／給与=対象月,キャスト名,出勤日数,総勤務時間,基本給,指名バック,ドリンクバック,その他,控除,支給額／勤怠=日付,キャスト名,状態,入店時刻,退店時刻,理由）＝アプリ側 `csv.*.headers` i18n値と同一の日本語直書き
- **`monthRange`のnoUncheckedIndexedAccess対応**：web側tsconfigで `const [y, m]` 分割代入がTS18048になるため `const [y = 0, m = 0]` へ（動作不変）。**アプリ側原本 `src/utils/payrollCalc.ts` も同表記に統一**（§24「同式を保つ」・アプリ側tsc EXIT:0のまま）
- **検証**：web `npx tsc -b` EXIT:0＋`npm run build`成功（AdminAppチャンク JS 65.20KB/CSS 5.37KBに成長・分離維持）・アプリ側 `npx tsc --noEmit` EXIT:0
- **Rev15残確認の解消**：dev server上で `form.requestSubmit()`→`auth/v1/token` POST発行（ダミー資格情報に400）→「メールアドレスまたはパスワードが違います。」表示まで確認＝**ログインフォーム配線は正常**。前回の未発火はpreview_clickの合成イベントがReactのonSubmitを起こさないツール側事象と確定。ログイン後3画面の実操作はTask #15（テストアカウント）で実施

---

## Rev17（2026-07-06）シフト表エンジン（§3-I・§22＝SPEC順序15）

テンプレート＝純データ・描画＝共通レンダラーの§22アーキテクチャを Web（正準）→アプリ（コピー同期）で実装。管理Web「シフト表作成」とアプリ「キャスト→シフト表」の両導線からPNG生成できる。

### Web側（正準）
- **`web/src/shiftTemplates/definitions.ts`**（**正準**・アプリへコピー同期＝冒頭コメント明記）：`ShiftTemplateDefinition`（size/palette/fonts/layout/deco）＋テンプレ20種（エレガント3・ポップ3・ゴシック2・和風2・シンプル3・ネオン2・パステル3・シーズナル2）＋`MOTIF_CHARS`＋`CATEGORY_LABELS`＋`findTemplate`
- **`web/src/shiftTemplates/shiftData.ts`**（正準）：`ShiftFlatRow`→`ShiftDay[]` 集計の純関数（`buildShiftDays`/`daysInMonth`/`firstDayOffset`/`weekdayOf`/`WEEKDAY_LABELS`/`yearMonthLabel`）
- **`web/src/shiftTemplates/ShiftTableRenderer.tsx`**（正準）：DOM+CSSレンダラー。1080×1350（4:5）/1080×1920（9:16）・`month-grid`（カレンダー型）と`week-rows`（日別リスト型）の2レイアウト・グラデ背景/モチーフ文字/ribbon/underlineヘッダー
- **`web/src/admin/AdminShiftImage.tsx`**：管理Web作成画面。カテゴリ別テンプレギャラリー・月ナビ・4:5/9:16切替・カスタマイズ（palette/motif上書き）・お気に入り保存/読込/削除（`ky_shift_templates.custom_settings`）・PNG出力（`html-to-image` `toPng()`・プレビューはCSS `transform:scale`）
- **`web/src/admin/adminApi.ts`**：`fetchShiftsByMonth`＋お気に入り3関数（list/add/remove）。`ky_shift_templates`はmigration 0009で適用済み（本Revで実DB存在をRESTプローブ200再確認）
- **`web/src/admin/AdminApp.tsx`**：shift-imageルートをPlaceholder→実画面へ差し替え／**`admin.css`**：ギャラリー/プレビュー/お気に入りスタイル追加／**`types.ts`**：`KyShiftTemplate`／**`package.json`**：`html-to-image`

### アプリ側（コピー同期＋RN移植）
- **`src/shiftTemplates/definitions.ts`・`shiftData.ts`**：正準から同一内容コピー
- **`src/shiftTemplates/ShiftTableRenderer.tsx`**：RN版レンダラー。RNのfontFamily非継承→全Text明示指定（iOS=Hiragino 3書体/Android=sans-serif系フォールバック）・lineHeight px固定・grid→週ごとrow＋セルflex:1・`expo-linear-gradient`で160deg近似（start{0.15,0}→end{0.85,1}）・ribbon=View包み・`numberOfLines`+ellipsis
- **`src/screens/ShiftImageScreen.tsx`**：月ナビ・4:5/9:16セグメント・テンプレ横スクロールギャラリー（スウォッチ3色＋カテゴリ）・プレビュー（transform scale＝中心基準をtranslate補正で左上合わせ）・**写真に保存**（`expo-media-library` writeOnly権限→`saveToLibraryAsync`）・**共有**（`expo-sharing`）。キャプチャはroot直下のオフスクリーン実寸ノード（`left:-20000`・`collapsable={false}`・ScrollView外）に`captureRef`
- **`src/screens/CastsScreen.tsx`**：ヘッダー右に「シフト表」pillボタン導線／**`src/services/casts.ts`**：`fetchShiftsByMonth`／**`strings.json`**：`cast.shiftImage`+`shiftImage.*` 11キー／**`app.json`**：`expo-media-library`プラグイン（保存権限文言）
- **依存追加**：`react-native-view-shot` 4.0.3／`expo-media-library` ~18.2.1／`expo-linear-gradient` ~15.0.8（`npx expo install`＝SDK54互換）

### week-rows 溢れゼロ保証（Web/RN同一式）
- 初版に**月後半切れバグ**（26出勤日月で13日までしか描画されない）を発見→全面書き換え：WR_ROOMY/WR_COMPACTの2段階サイズ→1カラム高さ見積もり→収まらなければ2カラム（累積チップ行数でバランス分割）→`maxChips`物理上限（超過は「+N人」チップ）＝どの月でもフレーム外に溢れない
- 視覚検証で4:5・26日月がmaxChips=2（1人+N人）に落ちる境界事象を確認（14/12分割でrowBudget=70px<チップ2行しきい値71px）→**WR_COMPACT微調整（rowPadV 5→4・chipGap 6→5）**で2行確保＝3人日全員・5人日3人+「+2人」。9:16は全員表示のまま
- **ヘッドレスChrome撮影3枚**（elegant-noir 4:5／pop-sunny 4:5／elegant-noir 9:16・一時ページ`#/shift-test`+ダミー26日データ）で全26日・溢れゼロ・装飾正常を目視確認→一時検証ページは削除済み

### 検証
- アプリ `npx tsc --noEmit` EXIT:0（G1）／web `npm run build` EXIT:0（`tsc -b`含む・客側チャンク非破壊）
- 実機系（view-shotキャプチャ・写真保存・共有シート）はTask #15エミュスモークで確認予定

---

## Rev18（2026-07-06）AIシフトデザイン（§3-I・§22＝SPEC順序16）

「お店の雰囲気」テキスト→AIが配色・書体・レイアウトのパラメータを生成→クライアント側で検証・完全定義化→Rev17共通レンダラーで描画。AI＝パラメータ生成器に限定し、レンダラーの溢れゼロ保証（cornerRadius/cellGapクランプ）を維持する構成。APIキーはEdge Function Secretのみ（R13）。

### サーバー側
- **`supabase/migrations/0010_ky_ai_usage.sql`**（**実DB適用済み**・`db query --linked` EXIT:0）：`ky_ai_usage`（tenant_key×usage_date PK・RLS有効＋**revoke all**＝service_role専用）＋`reserve_ky_ai_slot(p_tenant_id uuid)`（**予約方式レート制限**＝先にINSERT ON CONFLICTで+1してから判定→同時リクエストでも上限突破不可。テナント行と`__global__`行を同時+1し両カウント返却。uuid型引数で`__global__`センチネル偽装を型レベル遮断）。security definer＋revoke from public後に**`grant execute to service_role`明示**（42501対策＝supabase_edge_function_rpc_grantの教訓）
- **`supabase/functions/ky-shift-design/index.ts`**（**デプロイ済み**・verify_jwt有効=--no-verify-jwtなし）：OPTIONS→ENV3種チェック（**ANTHROPIC_API_KEY未設定は前段500 server_not_configured＝レート枠不消費**）→入力検証（mood必須≤500字・store_name≤100字）→`/auth/v1/user`でユーザー実在確認→`ky_tenants.owner_user_id`照合でtenant解決（オーナー以外403）→`reserve_ky_ai_slot` RPC（テナント毎日20回/全体日次400回・429 rate_limit/503 global_limit）→Anthropic API（claude-haiku-4-5・max_tokens 1024・日本語プロンプトでJSONスキーマ＋コントラスト4.5:1指示）→`extractJsonObject`→`{design}`返却。エラーは`{error:code}`形式でクライアントへ伝搬

### クライアント共通（sanitizer）
- **`web/src/shiftTemplates/aiDesign.ts`**（**正準**）＋**`src/shiftTemplates/aiDesign.ts`**（同一コピー）：`buildAiDefinition(raw, id)`＝AI出力を検証し完全な`ShiftTemplateDefinition`へ（hex 3形式regex・enum照合・cornerRadius 0-28/cellGap 4-12クランプ・name20字制御文字除去・不正値はFALLBACKへ）。`extractAiDesign(def)`＝お気に入り保存用の逆変換（**入出力同一構造＝ラウンドトリップ保証**）。id=`ai-<Date.now()>`クライアント採番・category='ai'・size 1080×1350固定・logoSlot=true固定

### Web側（管理Web）
- **`web/src/admin/adminApi.ts`**：`requestAiShiftDesign(mood, storeName)`＝`functions.invoke('ky-shift-design')`。FunctionsHttpError.context.json()からエラーコード抽出→`Error(code)`
- **`web/src/admin/AdminShiftImage.tsx`**：AIデザインカード（テンプレギャラリーの前・mood入力＋生成ボタン＋エラー3種日本語文言＋生成済みスウォッチ表示）。`base`計算をaiDef分岐に（`aiDef && templateId === aiDef.id ? aiDef : findTemplate(...)`）。お気に入り保存=`template_key='ai'`＋`custom_settings.ai=extractAiDesign(base)`／読込=`buildAiDefinition(fav.custom_settings['ai'], 新id)`で復元。一覧表示は「AIデザイン」

### アプリ側
- **`src/services/aiDesign.ts`**：adminApi版と同等（RN=DOM libなしのためcontextを構造型`{ json?: () => Promise<unknown> }`で扱う）
- **`src/screens/ShiftImageScreen.tsx`**：AIデザインセクション（比率切替の後・ギャラリーの前：説明文＋TextInput＋auto-fixアイコン生成ボタン＋生成済みカード）。def計算にaiDef分岐（useMemo deps: [templateId, tall, aiDef]）。エラーは`shiftImage.aiRateLimit/aiGlobalLimit/aiFailed`をAlert表示。**`KeyboardDoneBar`をルートView末尾にマウント**（本画面はKAVなし＝兄弟配置でZ-KBD充足・TextInput初追加のため本Revで必須化）
- **`src/i18n/strings.json`**：`shiftImage.ai*` 7キー追加（aiSection/aiHint/aiPlaceholder/aiGenerate/aiRateLimit/aiGlobalLimit/aiFailed）
- **`tsconfig.json`**：excludeに`supabase`追加（Deno関数コードをアプリtscから除外）

### 検証
- アプリ `npx tsc --noEmit` EXIT:0（G1）／web `npm run build` EXIT:0（vite 123 modules）
- migration 0010適用EXIT:0→**RESTプローブ**：anon直RPC→42501 permission denied（遮断○）・`ky_ai_usage` anon SELECT→42501（revoke効果○）・`routine_privileges`でservice_role EXECUTE存在確認○
- **Edge Functionデプロイ後3プローブ**：OPTIONS→200（CORS○）／無Authorization POST→401（ゲートウェイverify_jwt遮断○）／anon JWT POST→**500 server_not_configured**（Secret未設定の前段チェック動作○）→直後`ky_ai_usage`カウント0行＝**未設定期間はレート枠不消費を実証**
- **残（Secret登録待ち）**：concafe-yoyakuプロジェクトへ`ANTHROPIC_API_KEY`のSecret登録はユーザー作業（キー値はローカル非存在のため）。登録後の正常系200・実ユーザーJWT 200/非オーナー403はTask #15スモークで確認

---

## Rev19（2026-07-06）アプリ⇔管理Web連携仕上げ（§24＝SPEC順序17）

§24連携仕様の未実装3点（アプリ→Web導線・Web→アプリ導線・台帳リアルタイム）を実装。アカウント共有（Auth）・データ共有（ky_*）・時刻表現（timeUtils）・エンティトルメント（ky_tenants.plan）は既存実装で§24充足済み＝これで§24全項目完了。

### アプリ側（§24 アプリ→Web導線＋§3-B QR残債解消）
- **`src/components/QrLinkCard.tsx`**（新規・共通部品）：URL共有カード＝タイトル＋QR（白地×黒固定・読み取り性優先）＋URLテキスト（selectable）＋コピーボタン（`expo-clipboard`・押下で✓「コピーしました」2秒表示）＋ヒント。§3-B（公開URL）と§24（PCで作業）の共用
- **`src/components/PcWorkModal.tsx`**（新規）：設定「PCで作業」モーダル（FormModalShell＝MODAL-SAFE）。管理Web URL `https://rurifukuro.github.io/kyasuho/#/admin` をQR・コピー付きで提示＋「アプリと同じメール＋パスワードでログイン／データは自動同期」案内
- **`src/screens/SettingsScreen.tsx`**：店舗プロフィールの直後に「連携」セクション追加（monitorアイコン行→PcWorkModal起動）
- **`src/screens/ScheduleScreen.tsx`**：公開URLカード（Rev8以来URL表示のみ）を`QrLinkCard`へ置換＝**§3-B「公開URL発行・QR」のQR・コピー残債を解消**（客へのQR提示が可能に）
- **`src/i18n/strings.json`**：10キー追加（`common.copyUrl`/`common.copied`・`settings.sectionLink`/`pcWork`/`pcWorkSub`・`pcWork.title`/`desc`/`urlTitle`/`qrHint`/`loginHint`）
- **依存追加**：`react-native-svg` 15.12.1（`npx expo install`＝SDK54互換）／`expo-clipboard` ~8.0.8（同）／`react-native-qrcode-svg` ^6.3.21（純JS・svg依存）

### Web側（§24 リアルタイム＋Web→アプリ導線）
- **`web/src/admin/AdminReservations.tsx`**：**Supabase Realtime購読**＝`postgres_changes`（`ky_reservations`・`tenant_id=eq.<id>`フィルタ・event '*'＝アプリ/客Web/削除の全書き込みを拾い`load()`再取得）。チャンネルは`tenant.id`/`load`（=日付）変更時に張り替え・クリーンアップで`removeChannel`
- **`web/src/admin/AdminLayout.tsx`**：サイドバーフッターに「アプリで予約通知を受け取る」リンク（App Store製品ページ `apps.apple.com/jp/app/id6787006154`）。**`SHOW_APP_STORE_LINK=false`でOFF出荷**＝アプリ公開後にtrueへ（§24「公開後に有効化」）
- **`web/src/admin/admin.css`**：`.admin-appstore-link`（primary色・hover下線）

### DB確認
- `pg_publication_tables`で**`ky_reservations`がsupabase_realtime publicationに登録済み**を確認（migration 0005で追加済み）＝Realtime用の追加migration不要

### 検証
- アプリ `npx tsc --noEmit` EXIT:0（G1・TKey=keyof＝i18n全キー存在も同時保証=G2）／web `npm run build` EXIT:0（AdminApp 109.96KB・客側チャンク非破壊）
- Realtimeの実動（別クライアント書き込み→台帳自動反映）・QR読み取り・コピー動作はTask #15スモークで確認

---

## Rev20（2026-07-06）認証エラー文言＝メール未確認の判別（Task #15スモークで発見）

エミュスモーク（Pixel7_Play_API35・Expo Go・トンネル8086）で、メール確認ON環境の未確認ユーザーがログインすると汎用エラー「エラーが発生しました。時間をおいて再度お試しください。」に落ちる問題を発見・修正。

- **`src/screens/AuthScreen.tsx`**：`errorKey()` に `not confirmed` 分岐を追加 → `auth.error.emailNotConfirmed`
- **`src/i18n/strings.json`**：`auth.error.emailNotConfirmed`「メールアドレスの確認が完了していません。届いた確認メールのリンクを開いてからログインしてください。」

### 検証
- `npx tsc --noEmit` EXIT:0（G1・G2）
- エミュ実機（G4）：未確認アカウントでログイン→新文言表示を確認。サインアップ→「確認メールを送信しました」表示・空欄バリデーション・ログイン/新規登録切替も同スモークで確認済み
- スモーク時の確認事実：`ensureTenant`は設計どおり「セッション確立後に作成」＝confirm前に`ky_tenants` 0行は正常（tenants.tsコメントに明記済みの挙動）

---

## Rev21（2026-07-06）Web公開＝GitHub Pages（客側＋管理Web・ユーザー承認済み）

ユーザー承認「1と2を自走で行うことを承認します」に基づき、客側予約Web＋提供者管理Webを公開。

- **公開リポジトリ作成**：`rurifukuro/kyasuho`（public・GitHub API・rurifukuro垢を`/user`で確認してから作成。日本語入りJSONはbash curlで壊れたためPython urllib版で実行＝HTTP 201）
- **push＋Pages有効化**：web/一式＋`.github/workflows/deploy.yml`（eb776f8）→ `POST /repos/.../pages` `build_type=workflow`
- **CI失敗→修正**：`npm run build`（tsc -b）が `vite.config.ts(6,9) TS2580: Cannot find name 'process'` で失敗（CIは`npm ci`で@types/node無し・ローカルWindowsでは顕在化せず）→ **`web/vite.config.ts` を loadEnv 方式へ置換**（process参照除去。deploy repo側コミット f8c69a4）→ Actions success
- **実HTTP検証（WEB5）**：`https://rurifukuro.github.io/kyasuho/` → **HTTP 200**・title「きゃすりん - 予約」・アセット `/kyasuho/assets/`＝`VITE_BASE_PATH=/kyasuho/` 反映を確認
- **auth.users confirm（承認1）**：スモークアカウント `tiashe8730+kysmoke0706@gmail.com` の `email_confirmed_at` を単文SQLで更新（対象1行・`db query --linked`）→検証SELECTで `confirmed: true`
- **運用確定**：デプロイ用cloneは `..\kyasuho-web-deploy\`（ソースの正は本体 `web/`。更新フローは `WORK_PROGRESS.md` §2）
- **`WORK_PROGRESS.md` 新規作成**：Opus向け引き継ぎ指示書（W3形式・T1アイコン/T2通知/T3 IAP/T4客Web拡張/T5ストア準備/T6文言/T7 Supabase分離）
- **公開後スモークで管理Webルーティングバグ発見→修正**：受付設定クリックで URL が `#/admin/reservations/schedule/reservations/…` と無限連結し画面が空白化。原因は `/admin/*` スプラットルート配下では相対 `to` がスプラット消費分（現URL全体）基準で解決される React Router の仕様。ナビ7項目（`AdminLayout.tsx`）と index/catch-all リダイレクト（`AdminApp.tsx`）を絶対パス `/admin/<path>` へ変更（tsc PASS・deploy repo コミット 1656ab3）。ローカル開発時は予約台帳（index リダイレクト＝スプラット消費ゼロで正常解決）しか確認しておらず見逃した

### 検証
- Actions run（head=f8c69a4）：status=completed / conclusion=success
- 実HTTP：200（index.html取得・title/アセットパス確認）
- 管理Web実URLスモーク（2026-07-06）:
  - ログイン（kysmoke0706）→「スモーク検証店」・ナビ7項目・予約台帳表示 PASS
  - **公開後スモークでルーティングバグ発見→修正→再デプロイ（1656ab3・Actions success・ハードリロードで反映確認）**。修正後ナビ全7項目の href が絶対パス化
  - 受付設定: 受付枠追加（18:00〜22:00・8席・60分）→枠テーブル反映 PASS
  - 客Web `#/shop-kysmoke`: カレンダー〇→スロット19個（18:00〜21:00＝〆切−1セットの計算正常）→予約（スモーク太郎・PIN 0706）→「予約が完了しました・席番号: 1」PASS（`ky_make_reservation` RPC・席自動割当・PIN発行）
  - **Realtime実動 PASS（§24）**: 管理タブ無操作・リロード無しで台帳が「有効な予約 1 件／18:00 1番 スモーク太郎 予約中」へ自動更新
  - クリーンアップ: スモークテナント `is_suspended=true`（テナント・枠・予約の行はアプリ実機スモーク再利用のため残置）・一時SQL 2本削除
- エミュ実機スモーク（アプリ側 ensureTenant→5タブ）は未実施＝エミュはお品書きメーカー（別セッション）使用中のため **Opus 引き継ぎ**（WORK_PROGRESS.md §1）

## Rev22（2026-07-06）引き継ぎ指示書へ T8〜T12 追加（ユーザー指示5項目・ドキュメントのみ）

WORK_PROGRESS.md のみ修正（コード変更なし）。ユーザー提供の見本画像（Belle Étoile「本日のお給仕メイド」）に基づく機能追加指示を指示書化。

- **T8**: 出勤表画像「本日のお給仕メイド」＝当日出勤キャストを写真入りグリッド画像で生成（§3-I シフト表エンジン拡張・見本=黒ダマスク＋金枠の3×3・左上タイトルカード）
- **T9**: キャスト写真の**本人登録**（方式=リンク式/アカウント式の仕様分岐→着手前確認）＋**デフォルト黒髪ロングメイドイラスト**（未登録・体験入店用）
- **T10**: 予約画面の concafe-yoyaku 仕様化（メニュー選択・管理Webでのメニュー登録=ky_menus・生誕祭カレンダー表示）
- **T11**: キャスト毎の予約ビュー＋店全体の席埋まり状況（管理者向け）
- **T12**: 卓着席時間の割振り（キャスト×卓）＋**最低卓時間設定（デフォルト5分）**。**同修正を concafe-yoyaku 側にも実装→push・デプロイまで行う（ユーザー指示済み）**
- 正準実パスを調査し指示書へ明記: `concafe-yoyaku/src/components/admin/TimeAllocationSummary.tsx`（注文額比例の時間按分・現状下限なし）・`MenuManager.tsx`・`useMenu.ts`・`pricing.ts`・`CustomerTimeline.tsx`・`ReservationLedger.tsx`。「卓」「生誕」の機能語は concafe-yoyaku に未実装であることも確認（最低卓時間は両側とも新規実装になる）

---

## Rev23（2026-07-06）引き継ぎ指示書へ T13〜T16 追加＋見本画像ローカル保存（ドキュメント＋gitignoreのみ）

WORK_PROGRESS.md 追記＋.gitignore修正（コード変更なし）。ユーザー追加指示3回分（キャストアカウント基盤・パスワードリセット＋パスキー・給与閲覧・店舗独自テンプレ取込）を指示書化。

- **T13 キャストアカウント基盤（招待制＋ログイン2系統）**: 現状調査結果＝`ky_casts`にauth連携カラム（user_id）が存在しない・全RLSが`owner_user_id = auth.uid()`パターン→**キャスト個人のアカウント・ログインは全て新規実装**。ユーザー確定仕様: 管理側が招待（とれはんっ！グループ作成イメージ）→キャスト個人がアプリDL＋登録→ログイン画面は「店舗オーナー」と「キャスト個人」の2系統。migration設計（`ky_casts.user_id`追加＋`ky_cast_invites`新設）・RLS再設計方針を記載。**T9/T15の前提タスク**
- **T14 認証強化＝パスワードリセット＋パスキー（生体認証）推奨ログイン**: ① パスワードリセット＝Grepで `resetPasswordForEmail` がアプリ＋Web全体でゼロヒットを確認→**未実装確定**→タスク化（管理Web `#/admin/reset-password` は絶対パスで新設＝§2無限連結バグ再発防止）。② パスキー＝ユーザー指示「設定でFace ID等ログイン可能にし、基本的にはこちらを推奨する方向」。方式A（expo-local-authentication＋SecureStore・Expo Go検証可・推奨先行）と方式B（WebAuthn・Supabase Auth対応依存・管理Web本命）の2案を記載。技術選定は自走可
- **T15 キャスト個人の給与閲覧**: 年間・月別を管理側給与計算（migration 0009 `ky_payroll`）と同一データで連携。T13基盤前提。RLS=自分の給与行のみSELECT
- **T16 店舗独自テンプレートの取り込み**: 各店舗の自前テンプレデザインをアップロードし月間スケジュール表＋日次出勤表の生成に使える第3の選択肢。テスト用見本2枚をユーザー指示で`docs/shop_template_reference/`にローカル保存（gitignore追加・コミット/公開厳禁＝実在店舗・実在人物の写真）
- **T9 仕様分岐解消**: 写真登録方式をキャスト個人アカウント方式（T13上）で確定（旧・トークンリンク案は廃止）
- **§4 承認ゲート更新**: T13のRLS再設計（キャスト閲覧権限境界）は適用前にポリシー一覧をユーザーへ提示して確認
- **`.gitignore`**: `docs/shop_template_reference/`（実在店舗見本画像・ローカル専用）を除外対象に追加
- タスク合計=T8〜T16の9本体制に

---

## Rev24（2026-07-06）T13 キャストアカウント基盤＋T14 パスワードリセット＋T17/T18 仕様追加・DB基盤

キャストアカウント（招待制・2系統ログイン・ロール分岐）の実装と、パスワードリセット・キャスト人物像/個人情報のDB基盤を一括で実装。

### DB（migration 0011＋0012 適用済み・RESTプローブ全PASS）
- **migration 0011 `ky_cast_auth.sql`**: `ky_casts.user_id`カラム追加（nullable・UNIQUE部分インデックス）＋`ky_cast_invites`テーブル新設（招待コード管理）＋キャスト本人用RLS5ポリシー（casts self select/update・shifts self select・payroll self select・invites owner all）＋`ky_redeem_cast_invite` RPC（SECURITY DEFINER・コード消費→user_id紐付け）
- **migration 0012 `ky_cast_profile.sql`**: T17 `ky_cast_evaluations`（オーナー記入の人物像・internal_notesは社外秘）＋`ky_cast_work_history`（店舗遍歴・visibility=public/private・テナント横断参照）＋T18 `ky_cast_personal_info`（面接書類代替・基本情報/緊急連絡先/通勤/給与振込口座/勤務希望/経歴/資格/特記）。RLS: キャスト本人=全CRUD、現テナントオーナー=read（personal_infoはオーナーreadのみ・退店後は不可）

### アプリ側
- **`src/types/index.ts`**: `UserRole`/`CastInvite`/`CastEvaluation`/`CastWorkHistory`/`CastPersonalInfo`/`AccountType` 型追加
- **`src/services/roles.ts`**（新規）: `resolveUserRole(userId)` → owner/cast/none判定。`redeemCastInvite(code)` → 招待コード消費RPC呼び出し
- **`src/services/castInvites.ts`**（新規）: `listInvites`/`createInvite`/`deleteInvite` — 8文字英数コード自動生成（I/O/0/1除外で読み間違い防止）
- **`src/context/AuthContext.tsx`**: `role`/`roleResult`/`roleLoading`/`refreshRole`を追加。userId変更時に`resolveUserRole`→ownerなら`ensureTenant`も実行
- **`src/screens/AuthScreen.tsx`**: 2系統ログインUI（「店舗オーナー」/「キャスト」のアカウントタイプ選択→各系統のサインイン/サインアップ）＋パスワードリセット（`resetPasswordForEmail`・T14①）
- **`src/screens/RoleSelectScreen.tsx`**（新規）: role=noneユーザー向け。「店舗を登録する」（→ensureTenant→owner化）or「招待コードで参加」（→redeemCastInvite→cast化）
- **`src/screens/CastHomeScreen.tsx`**（新規）: role=castユーザー向け。今後の出勤予定（ky_shifts・10件）＋今月の給与サマリー（ky_cast_payroll・合計額＋出勤日数）＋ログアウト
- **`App.tsx`**: `RootGate`をロール分岐に改修（owner→TenantProvider+5タブ／cast→CastHomeScreen／none→RoleSelectScreen／roleLoading→LoadingScreen）
- **`src/i18n/strings.json`**: auth.role.*・auth.forgot*・auth.reset*・role.*・castHome.*・cast.invite* 計39キー追加

### WORK_PROGRESS.md
- T17（キャスト人物像・遍歴管理）＋T18（キャスト個人情報入力・面接書類代替）を仕様として追加。DB設計・RLS設計・UI方針を記載
- タスク合計=T8〜T18の11本体制に

### 検証
- `npx tsc --noEmit` EXIT:0（G1・G2）
- migration 0011: RESTプローブ `ky_cast_invites` 200・`ky_casts?select=user_id` 200・RPC `ky_redeem_cast_invite` anon→200 `not_authenticated`（正常）
- migration 0012: RESTプローブ `ky_cast_evaluations`/`ky_cast_work_history`/`ky_cast_personal_info` 全200
- RLSポリシー一覧はユーザーへ提示・承認済み（§4承認ゲート通過）

---

## Rev25（2026-07-06）T13招待管理UI＋T14①PW reset(Web)＋T15給与閲覧拡張＋T17人物像UI＋T18個人情報UI

Rev24で作成したDB基盤（migration 0011/0012）に対するUI全面実装。アプリ側・管理Web側の両方。

### アプリ側（src/screens/, src/services/）
- **CastsScreen.tsx — 招待管理UI（T13）**: キャスト詳細に`CastInviteSection`追加（招待コード発行・コピー・有効期限表示・使用済み/期限切れ状態・削除）。連携済みキャストには「アカウント連携済み」バッジ表示。CastCardにもuserIdの有無でバッジ表示
- **CastsScreen.tsx — 人物像・評価モーダル（T17）**: キャスト詳細に「人物像・評価」ボタン追加→`CastEvaluationModal`を開く。人物像/強み/改善点/お客様の声/社内メモの5フィールド入力・保存。下部に店舗遍歴一覧（publicのみ表示）
- **CastHomeScreen.tsx — 給与閲覧拡張（T15）**: 月別切替（◀ ▶ ナビ）・日別給与明細の展開UI（タップで基本給/指名バック/ドリンクバック/控除の内訳表示）・合計勤務時間表示。PayrollRow型を拡張してbase_pay〜deductionsの内訳列を取得
- **CastPersonalInfoScreen.tsx（新規・T18）**: キャストマイページから遷移する個人情報入力画面。面接書類代替の全項目（基本情報/緊急連絡先/通勤/振込口座/勤務希望/資格/特記）。セクション分け・KeyboardDoneBarマウント（KAVの外=兄弟）
- **src/services/castProfile.ts（新規）**: T17/T18のサービスレイヤー。`fetchEvaluation`/`upsertEvaluation`（テナント×キャスト）・`fetchWorkHistory`/`fetchPublicWorkHistory`・`fetchPersonalInfo`/`upsertPersonalInfo`（cast_user_id単位・upsert onConflict）
- **src/i18n/strings.json**: eval.*/personalInfo.* 計50キー追加

### 管理Web側（web/src/admin/）
- **AdminLogin.tsx — パスワードリセット（T14①）**: 「パスワードをお忘れですか？」リンク追加→resetMode画面でresetPasswordForEmail→送信成功メッセージ
- **AdminCasts.tsx — 招待管理パネル（T13）**: キャスト一覧テーブルに「アカウント」カラム追加（連携済み/未連携バッジ）。ページ下部に`CastInvitePanel`（キャスト選択→招待コード作成・テーブル表示・コピー・削除）
- **adminApi.ts**: `fetchInvites`/`createInvite`/`deleteInvite` 追加。`fetchCastList`のselectにuser_id追加
- **admin.css**: `.admin-success`/`.admin-link-btn`/`.admin-badge.green|gray|red|blue` スタイル追加
- **web/src/lib/types.ts**: `KyCast.user_id`追加・`KyCastInvite`型追加

### 検証
- `npx tsc --noEmit` EXIT:0（アプリ＋管理Web両方）

---

## Rev26（2026-07-06）SPEC改訂＝オーダー管理・レジ機能の設計追加（§3-K/§25）＋機能ギャップ棚卸し（§26）

コード変更なし・仕様書改訂のみ（ユーザー指示「不足機能の批判的検討→設計仕様書の加筆修正」「オーダー管理機能（レジさぽっ！のレジ画面参考）＋売上の管理側連携が欲しい」）。

### SPEC.md
- **§3-K新設**: オーダー管理・レジ★（メニュー登録/伝票/キャスト紐付け明細/売上自動集計連携/チェックイン→伝票オープン）
- **§25新設**: 詳細設計＝伝票ライフサイクル（open→明細→会計→closed）・ky_menu_items/ky_orders/ky_order_items・ky_sales.entry_mode（'auto'/'manual'）による二重計上防止・給与ドリンクバック自動プリフィル・AdminOrders/AdminMenu
- **§26新設**: 機能ギャップ棚卸し20項目（★仕様化5/★是正1/◯7/△6/✗1・アプリ/管理Web/客Web/連携の4軸）
- **既存改訂**: §3-C/§9-1/§12にキャストアカウント実装済み分を反映（逆ギャップ是正）・§3-E変更/キャンセル通知◯追加・§3-F自動集計行・§5 MVP第2弾・§6 TODO・§9-1レジタブ（6タブ化・cash-register）・§10テーブル3本＋型定義・§11流用表（RegisterScreen/CheckoutModal/ChangeResultModal）・§14境界1行・§19実装順序18〜21・§21対応表・§23給与式・§24連携表・ヘッダーRev25反映

### AGENTS.md
- 実装チェックリストに§3-K行追加・ゲート①タブアイコン固定名にレジ=cash-register追加

### 検証
- コード変更なし＝tsc/スモーク対象外。SPEC内参照整合（§3-K⇔§25⇔§10⇔§19⑱〜㉑）を目視確認

## Rev27（2026-07-06）SPEC第2次改訂＝ユーザー10項目指示の反映（§25-3改訂＋§26-2＋§27〜§31新設）

ユーザー指示（同日第2次・実装は次Rev以降）：①レジにお客様名入力欄＋会計までの一時保存ボタン ②経費処理・確定申告補助（レジさぽっ！TaxScreen参考） ③客予約のキャスト指名ドロップダウン（あいうえお順）＋他のドロップダウン候補検討 ④生年月日ダイヤル式＋手入力削減 ⑤キャスト写真2種（証明写真/お店写真・管理側差替え・離脱時自動削除） ⑥予約台帳の日付改行＋表示崩れ確認 ⑦「客」→「お客様」横断統一 ⑧席種・席料 ⑨シフト表SNS投稿ボタン ⑩お問い合わせルール違反のメモ。

### 調査で確定した現状（批判的検討の根拠）
- 日付チップ折返しの原因特定＝ReservationsScreen `dateChip` width:68固定＋paddingHorizontal:14（実効40px）に `10/29(水)` が入らない
- 生年月日・勤務開始可能日＝素のTextInput手入力（placeholder="1990-01-15"）＝ルールDATE-POPUP違反でもある
- 客Web指名は `<select>` 実装済みだが**並び順なし**（あいうえお順には ky_casts.name_kana 列が必要）
- アプリ手動予約追加に**指名キャスト欄自体が無い**（電話予約の指名を記録できない）
- キャスト写真＝photo_url列のみで**アップロード実装ゼロ**（Storage未使用）
- 「客」表記＝アプリstrings.jsonの3キーのみ（placeholder.schedule.desc/schedule.publicUrl/schedule.publicUrlHint。Web側は「お客様」準拠済）
- お問い合わせ＝SettingsScreen `Linking.openURL(mailto:)` の自前簡易版＝横断ゲート②（ContactFormModal流用）違反 → §28-5に是正メモ
- シフト表共有＝Sharing.shareAsync（OS共有シート）まで実装済み＝SNS直接導線が無い

### SPEC.md
- **§25-3改訂**: お客様名入力欄（customer_labelのUI化）＋「一時保存」ボタン（open保存の明示出口）を伝票UIに明記
- **§26-2新設**: 第2次棚卸し #21〜#34（★8/★是正4/◯2）
- **§27新設**: 経費・確定申告補助（ky_expenses・カテゴリ9種・人件費は給与から自動参照＝二重計上防止・AdminExpenses・月次収支/年次サマリ・経費/年次収支CSV・税務助言はしない）※ユーザー指示原文「個人的には」の続きは未取得＝要確認と明記
- **§28新設**: 入力UX・表示・用語の是正標準（28-1 AnchoredDropdown標準＋name_kana＋適用箇所一覧表／28-2 生年月日ホイールピッカー＋CalendarModal／28-3 日付チップ修正方針＋固定幅Text横断監査／28-4 用語規約「お客様」＋G2チェック組込み／28-5 お問い合わせ是正メモ）
- **§29新設**: 席種・席料（ky_seat_types・MVPは希望属性＝在庫管理は後フェーズ・客Webドロップダウン・伝票へ席料自動明細 category='seat'）
- **§30新設**: キャスト写真管理（Storage ky-cast-photos・証明写真=本人のみアップ/オーナー閲覧・お店写真=管理側差替え可・Edge Function ky-cast-leave で離脱時自動削除・FIX-7b縮小流用・PP改訂）
- **§31新設**: シフト表SNS投稿（ky_tenants.sns_links・X intent/Instagram起動/投稿文コピー・自動定期投稿はやらない・★予約URL/QR画像埋め込みオプション）
- **既存改訂**: §3-A（手動予約に指名欄）・§3-B（席種席料★）・§3-C（ふりがな・写真2種★）・§3-D（指名/席種ドロップダウン）・§3-F（経費◯→★昇格）・§3-I（SNS投稿★）・§3-K（お客様名・一時保存★）・§5実装順序18〜27・§10（ky_expenses/ky_seat_types追加・ky_castsにname_kana・ky_reservationsにseat_type_id・ky_tenantsにsns_links・ky_order_itemsにcategoryスナップショット＋menu_item_id null可・型定義ExpenseCategory/Expense/SeatType/MenuCategoryに'seat'）・§19実装順序22〜27・§21対応表にAdminExpenses・§23 CSV表に経費/年次収支・ヘッダー

### AGENTS.md
- 実装チェックリストに§27〜§31の5行追加・§3-K行にお客様名/一時保存を追記

### 検証
- コード変更なし＝tsc/スモーク対象外。SPEC内参照整合（§26-2⇔§27〜31⇔§10⇔§19㉒〜㉗）を目視確認

---

## Rev28（2026-07-06）SPEC第3次改訂＝シフト表拡張（§22-2〜22-4）＋SaaS機能ネット調査棚卸し（§26-3）

ユーザー指示（同日第3次・実装は次Rev以降）：①SaaSに必要そうな機能をインターネットで調査 ②シフト表作成のプレビューを常時固定表示（管理画面左側のタブのように） ③デイリー版シフト表作成画面の設計状況確認 ④サク品っ！の方式のような「既存のお店シフト表テンプレート取り込み」機能の実装検討。

### 調査で確定した現状
- **デイリー版＝T8「本日のお給仕」として引き継ぎ指示書（WORK_PROGRESS.md 3-B）に設計済み・実装未着手・SPEC本体には未統合**（§31-3で◯扱いのみ＝逆ギャップ）→ ユーザー質問「まだ設計に着手してないだけ？」への答え＝設計はT8に存在・SPEC統合と実装が未了だった
- **店舗テンプレ取込＝T16として同指示書に設計済み・SPEC未統合**（見本2枚は docs/shop_template_reference/ にローカル保存済み・コミット/公開厳禁）
- プレビュー流れの原因＝admin.css `.shift-preview-col` に sticky 未指定（`.shift-layout` は align-items:flex-start 済み＝sticky が効く土台はある）
- サク品っ！の実体確認＝背景テンプレ48種（パラメトリックSVG）＋レイアウトプリセット＋任意画像のキャンバス取込（imageStore/pickCanvasImage）＝「背景に画像を敷きデータを重ねる」方式はT16と同思想
- ネット調査（ナイトワークPOS：ボードマネージャー/VENUS/Dシステム/NIGHTCORE・予約SaaS：RESERVA/STORES・飲食シフトSaaS・コンカフェ運営実務）→ 第1次棚卸しの網羅性は妥当（卓タイマー#6/顧客カルテ#7/リマインド#11/キャンセル待ち#12は既出）。新規=ノーショー履歴活用・キャスト成績ビュー・人件費概算・ボトルキープ・回数券/スタンプ・売掛✗・イベントカレンダー

### SPEC.md
- **§22-2新設**: デイリー出勤表（T8統合・layout 'daily-lineup' 追加・写真入り可変グリッド・デフォルトイラスト同梱・既存テンプレ20種流用・§30写真基盤依存）
- **§22-3新設**: 店舗独自テンプレート取込（T16統合・第3の選択肢「店舗テンプレート」・矩形指定＋行列数の最小エディタ→AI推定は発展形・月間/デイリー両対応・Storage保存・見本2枚はローカル検証限定）
- **§22-4新設**: 作成画面UI標準（プレビュー sticky 常時固定・9:16時は PREVIEW_SCALE 可変・アプリ側も同思想）
- **§26-3新設**: 第3次棚卸し #35〜#45（★是正3/◯5/△2/✗1＋#12を△→◯へ格上げ）
- **既存改訂**: §3-I（デイリー★・店舗テンプレ取込★・プレビュー固定★の3行追加）・§9-3（シフト表作成の記述更新）・§22型定義（layout 3値化）・§19実装順序に28〜29追加・§31-3（デイリー◯→★格上げ）・ヘッダー

### AGENTS.md
- 実装チェックリストに§22-2〜22-4行を追加

### 検証
- コード変更なし＝tsc/スモーク対象外。SPEC内参照整合（§3-I⇔§22-2〜4⇔§26-3⇔§19㉘㉙⇔§31-3）を目視確認

---

## Rev29（2026-07-06）SPEC第4次改訂＝初月無料トライアル（§14）＋姉妹アプリ構想と仕込み（§32新設）＋◯/△の計画組込み（§19㉚〜㊲）

ユーザー指示（同日第4次・実装は次Rev以降）：①第3次棚卸しの◯と△を計画に入れる ②スタンプ機能は将来実装確定＝姉妹アプリ（お客様向けアプリ）作成時にきゃすりん側も対応。会計連動で自動的に貯まる・会計時に使用可能クーポン保有ならキャストへ確認ポップアップ・即時使用は強制しない ③姉妹アプリは店舗検索＋地域毎の店/キャストランキング（口コミ評価・売上）→今のうちにきゃすりん側へ売上のサーバー自動集計の仕込み ④プロの最初の1ヶ月は利用無料。

### SPEC.md
- **§14追加「初月無料トライアル」**（確定事項）: 実装はストア標準＝ASC Introductory Offer（Free Trial 1ヶ月）／Play free trial を両サブスク商品に設定。コード側分岐不要（トライアル中も plan='pro' の既存経路）・価格/期間の固定文字ハードコード禁止（R29同思想）・Web独自決済を置く場合も同条件
- **§32新設「姉妹アプリ構想と本体側の仕込み」**: 32-1構想（店舗検索/地域別ランキング/スタンプ・クーポン）・32-2スタンプ仕様（closeOrder() 1関数集約＝⑱〜⑳で先取り・customer_ref拡張ポイント=MVPでは列を作らない・値引き明細の構造メモ）・32-3ランキング仕込み（売上サーバー集計は§25-4で既に達成＝源泉データは揃う構造。追加=ky_tenants.prefecture/area/ranking_opt_in・公開層分離＝日次バッチで匿名化スコアテーブル生成・生売上額は公開しない・キャストランキングは本人同意の法務論点→§6弁護士確認❸へ追加）
- **§19実装順序に30〜37追加**: ㉚ランキング集計仕込み（migration＋プロフィール欄＝軽量・早め）・㉛〜㊲後フェーズ枠（#38ノーショー履歴/#39キャスト成績ビュー/#40人件費概算/#44イベントカレンダー/#11+#45客向け通知パック/#42スタンプ・クーポン/#41+#42残りボトルキープ・回数券）
- **§26-3改訂**: #42行を「スタンプは計画入り（ユーザー決定）・回数券/チェキ券は△継続」へ更新＋表下に計画化注記（◯/△は㉛〜㊲へ組込み済・#43売掛のみ✗のまま計画外）
- **§6改訂**: 初月無料を[x]確定として追記・弁護士確認に❸ランキング公開論点を追加
- ヘッダー最終改訂を第4次へ更新

### AGENTS.md
- 横断ゲート③（IAP）に「ON化時: 初月無料トライアル設定」行を追加

### 検証
- コード変更なし＝tsc/スモーク対象外。SPEC内参照整合（§6⇔§14⇔§32⇔§19㉚〜㊲⇔§26-3#42）を目視確認

---

## Rev30（2026-07-06）SPEC第5次改訂＝会計時の割引・クーポン（§25-7新設）＋キャスト個人ランキング不実装化（§32改訂）

ユーザー指示（同日第5次・実装は次Rev以降）：①会計時にクーポンや割引ができるようにする（店舗が独自にキャンペーンを行う場合があるため） ②女の子（キャスト）のランキングは実装をやめる。

### SPEC.md
- **§25-7新設「会計時の割引・クーポン」**: category='discount' のマイナス価格明細方式（スナップショット原則維持・純額が自然に出る）・入力UI＝会計フローの「割引」ボタン（金額¥／割合%＝小計から金額確定／名目入力／ky_menu_itemsのcategory='discount'定型割引を1タップ追加）・集計影響（ky_sales total_revenueに負数で乗る＝純売上自動・カウント系は影響なし）・給与影響（割引明細にcast_idを付けない＝バック誤減額防止）・ガード（割引合計≦割引前小計）・姉妹アプリクーポンも同一明細経路（§32-2と接続）
- **§25関連改訂**: §25-2（category 8種→9種）・§25-3会計手順に「割引」ボタン・§25-6スコープ★へ追加・§10 ky_menu_items行・§19⑲へ組込み・§26-3に#46追加（★）
- **§32改訂＝キャスト個人ランキング不実装**（ユーザー決定）: 32-1構想からキャストランキングを除外（店舗ランキングのみ）・32-3の法務論点4を「不実装決定・公開は店舗単位のみ」へ差替え・キャスト別集計（cast_id）は店内向け成績ビュー#39専用＝外部公開しないと明記・32-2値引き明細を§25-7方式で確定
- **§6改訂**: 弁護士確認❸を店舗ランキングに限定（キャスト個人ランキングは不実装決定を明記）
- **§19㉜改訂**: キャスト成績ビューは店の内部機能＝外部公開しないと明記
- ヘッダー最終改訂を第5次へ更新

### AGENTS.md
- §3-K行に「会計時割引（discount明細＝§25-7）」を追加

### 検証
- コード変更なし＝tsc/スモーク対象外。SPEC内参照整合（§10⇔§25-2/25-3/25-6/25-7⇔§19⑲㉜⇔§26-3#46⇔§32⇔§6❸）を目視確認

---

## Rev31（2026-07-07）オーダー管理DB＝migration 0013＋型定義＋サービス層（§25-2・§19の⑱）

§19実装順序⑱。ky_menu_items / ky_orders / ky_order_items の3テーブル新設＋ky_sales.entry_mode列追加＋アプリ/Web両側の型定義＋サービス層（メニューCRUD・伝票CRUD・明細CRUD・会計確定closeOrder＋売上自動集計autoUpsertSales）。

### DB（migration 0013・未適用＝無人実行のため適用は次回対話セッションで）
- **`supabase/migrations/0013_ky_orders.sql`**:
  - `ky_menu_items`（メニューマスタ）: category 9種CHECK・needs_cast・sort_order・is_active・tenant_id FK＋RLS(owner_all)＋updated_atトリガー
  - `ky_orders`（伝票）: status CHECK(open/closed/void)・biz_date・seat_no・reservation_id FK(SET NULL)・customer_label・payment_method CHECK(cash/card/qr/other)・deposit/change・note・RLS(owner_all)＋updated_atトリガー＋2インデックス(tenant_biz_date, tenant_status)
  - `ky_order_items`（明細）: order_id FK(CASCADE)・menu_item_id FK(SET NULL)・category/name/price＝スナップショット・qty・cast_id FK(SET NULL)・RLS(owner_all)＋2インデックス(order_id, tenant_id)
  - `ky_sales.entry_mode`列追加: 'manual'(既定)/'auto' CHECK＝§25-4二重計上防止

### アプリ型定義（src/types/index.ts）
- 新規: `MenuCategory`(9種union)・`MenuItem`・`OrderStatus`・`PaymentMethod`・`Order`・`OrderItem`
- 既存 `DailySales` に `entryMode` 追加

### サービス層
- **`src/services/menuItems.ts`**: fetchMenuItems・createMenuItem・updateMenuItem・deleteMenuItem（パターンは既存sales.tsと同一）
- **`src/services/orders.ts`**: fetchOrdersByDate・fetchOpenOrders・openOrder・updateOrderLabel・voidOrder・fetchOrderItems・addOrderItem・updateOrderItemQty・deleteOrderItem・**closeOrder**（§25-3ステップ6＝伝票closed→autoUpsertSales→§32-2 closeOrder()集約ポイント）・**autoUpsertSales**（§25-4＝その営業日のclosed伝票を再集計→ky_sales upsert(entry_mode='auto')・manual行は上書きしない）

### Web型定義（web/src/lib/types.ts）
- 新規: `KyMenuCategory`・`KyMenuItem`・`KyOrderStatus`・`KyPaymentMethod`・`KyOrder`・`KyOrderItem`
- 既存 `KySales` に `entry_mode` 追加

### 検証
- アプリ `npx tsc --noEmit` EXIT:0（G1）／web `npx tsc -b` EXIT:0
- migration未適用（適用はDB操作のため次回対話セッションでRESTプローブ付きで実施）

---

## Rev32（2026-07-07）アプリ：メニュー管理＋レジ画面（§25-3・§19⑲）

§19実装順序⑲。RegisterScreenを6番目のタブとして追加。伝票レーン／明細＋メニュー追加／メニュー管理の3モード切替UI。会計フロー（CheckoutModal→closeOrder→ChangeResultModal）・割引追加（DiscountModal＝§25-7）・メニュー項目編集（MenuEditModal）。i18n約80キー追加。migration 0013をリモートDBに適用。

### i18n（src/i18n/strings.json）
- レジ/会計/割引/メニュー管理の全キー約80個追加（tab.register, register.*, checkout.*, discount.*, menu.*, common.clear/ok/add/back）

### 新規コンポーネント
- **`src/components/ChangeResultModal.tsx`**: おつり大表示モーダル（レジさぽっ！流用）。fontSize:64のchangeAmt＋内訳表示＋OKボタン
- **`src/components/DiscountModal.tsx`**: §25-7 会計時割引追加。3タブ（金額¥/割合%/定型）＋ガード（割引>小計でAlert拒否）。定型はky_menu_items category='discount'から取得
- **`src/components/CheckoutModal.tsx`**: 会計モーダル（レジさぽっ！流用・4支払方法cash/card/qr/other）。Quick amounts＋DiscountModal内包＋negativeTotal無効化ガード
- **`src/components/MenuEditModal.tsx`**: メニュー項目の追加・編集フォーム。カテゴリ9種チップUI・needsCast/isActiveスイッチ・sortOrder入力・削除はAlert二段確認

### 新規画面
- **`src/screens/RegisterScreen.tsx`**（約400行）: 3モード切替（lane/detail/menu）
  - Lane: FlatList＜Order＞＋ FAB「新規伝票」＋ header「メニュー管理」
  - Detail: customerLabel TextInput(onBlur保存) ＋ orderItems(±stepper) ＋ menuByCategory(タップ追加) ＋ actionBar(一時保存＋会計)
  - Menu: allMenuByCategory ＋ 編集/追加(MenuEditModal)
  - needs_castアイテムはAlert.alertでキャスト選択
  - 会計フロー: CheckoutModal → closeOrder → ChangeResultModal → lane戻り

### App.tsx
- RegisterScreenインポート＋RootTabParamListにRegister追加（6タブ化）
- TAB_ICONSに'cash-register'・Tab.Screenを予約と受付の間に挿入

### DB適用
- migration 0013を `npx supabase db query --linked -f supabase/migrations/0013_ky_orders.sql` で適用
- RESTプローブ: ky_menu_items / ky_orders / ky_order_items 全HTTP 200 ＋ ky_sales.entry_mode列存在確認

### 検証
- アプリ `npx tsc --noEmit` EXIT:0
- DB 3テーブル＋entry_mode列 RESTプローブ全OK

---

## Rev33（2026-07-07）売上自動集計＋給与ドリンク数プリフィル（§25-4/25-5・§19⑳）

§19実装順序⑳。§25-4 entry_mode UI表示（アプリSalesView＋管理WebAdminSales）＋手入力時manual切替。§25-5 給与生成時のドリンク数をky_order_itemsから自動プリフィル。

### サービス層
- **`src/services/orders.ts`**: `countCastDrinksByMonth()` 追加＝指定月のky_order_items(category='cast_drink'・cast_id非null)をcastId|date別に集計→Map返却
- **`src/services/sales.ts`**: `upsertSales()` に `entry_mode: 'manual'` を明示セット（手入力→以後自動更新停止＝§25-4）
- **`src/services/payroll.ts`**: `generatePayrollFromAttendance()` で `countCastDrinksByMonth()` を並行取得し、ドリンク数を0ではなく実績値でプリフィル（§25-5）

### アプリUI（src/screens/analytics/SalesView.tsx）
- 日リスト行にentry_mode='auto'バッジ表示（「自動集計」ラベル）
- SalesEditModalにauto行の注意バナー（「手動で変更すると以後は自動更新されません」）

### 管理Web
- **`web/src/admin/AdminSales.tsx`**: テーブルに「種別」列追加（auto＝青バッジ「自動」/manual＝灰バッジ「手入力」）。フォームにauto注意バナー
- **`web/src/admin/adminApi.ts`**: `upsertSales()` に `entry_mode: 'manual'` 追加
- **`web/src/admin/admin.css`**: `.badge-auto`/`.badge-manual` スタイル追加

### i18n（src/i18n/strings.json）
- `sales.entryAuto`/`sales.entryManual`/`sales.autoBanner` の3キー追加

### 検証
- アプリ `npx tsc --noEmit` EXIT:0／web `npx tsc -b` EXIT:0

## Rev34（2026-07-07）管理Web：オーダー履歴＋メニュー管理（§25・§19㉑）

§19実装順序㉑。管理WebにAdminOrders（伝票履歴）とAdminMenu（メニューマスタCRUD）を追加。

### 新規ファイル
- **`web/src/admin/AdminOrders.tsx`**: 伝票履歴ページ＝日付ナビ→ky_orders一覧→展開で明細ドリルダウン。当日会計済売上・伝票件数サマリ。ステータスバッジ（会計前/会計済/取消）・支払方法・開始/会計時刻・キャスト名表示
- **`web/src/admin/AdminMenu.tsx`**: メニューマスタCRUDページ＝カテゴリフィルタ・追加/編集/削除。全9カテゴリ（set/extension/nomination/cast_drink/drink/food/cheki/discount/other）。有効/無効バッジ・表示順・キャスト紐付けフラグ

### 変更ファイル
- **`web/src/admin/AdminApp.tsx`**: AdminOrders/AdminMenuインポート＋Route(`path="orders"`, `path="menu"`)追加
- **`web/src/admin/AdminLayout.tsx`**: NAV_ITEMSに「オーダー履歴」「メニュー管理」追加（売上管理の上に配置）
- **`web/src/admin/adminApi.ts`**: Rev33で追加済みのオーダー関連API6関数（fetchOrdersByDate, fetchOrderItems, fetchMenuItems, upsertMenuItem, deleteMenuItem, countCastDrinksByMonth）を使用

### 検証
- アプリ `npx tsc --noEmit` EXIT:0／web `npx tsc --noEmit --project web/tsconfig.json` EXIT:0

## Rev35（2026-07-07）是正パック（§28）＝日付チップ幅修正・文言統一・ContactFormModal・CalendarModal

§19実装順序㉒。§28の是正5項目のうち4つを対応（残り1つ＝手動予約の指名ドロップダウンは㉓のname_kana側）。

### §28-3 日付チップ折返し修正
- **`src/screens/ReservationsScreen.tsx`**: dateChipの`width: 68`→`minWidth: 68`に変更。長い日付（「10/29(水)」等）が折返しせず自然に広がるように修正

### §28-4 「客」→「お客様」3キー修正
- **`src/i18n/strings.json`**: `placeholder.schedule.desc`/`schedule.publicUrl`/`schedule.publicUrlHint`の「客」を「お客様」に統一

### §28-5 ContactFormModal流用差替え
- **`src/components/ContactFormModal.tsx`**: 新規作成。とれはんっ！からの構造流用＝Google フォームをWebViewでアプリ内表示（横断ゲート②準拠）
- **`src/config/contact.ts`**: `CONTACT_FORM_URL`/`CONTACT_FORM_EMBED_URL`追加（とれはんっ！と同一フォーム共有）
- **`src/screens/SettingsScreen.tsx`**: mailto直リンク→ContactFormModalに差替え。`Linking`/`CONTACT_EMAIL`のimport削除

### §28-2 生年月日ホイールピッカー＋availableFromのCalendarModal化
- **`src/components/CalendarModal.tsx`**: 新規作成。@react-native-community/datetimepickerをラップしたモーダル（iOS=spinner＋完了/キャンセルボタン・Android=ネイティブダイアログ）
- **`src/screens/CastPersonalInfoScreen.tsx`**: 生年月日・勤務開始可能日の素TextInputをDatePickerField＋CalendarModalに差替え（DATE-POPUP準拠・半角全角混入リスク解消）

### パッケージ追加
- `react-native-webview`（ContactFormModal用）
- `@react-native-community/datetimepicker`（CalendarModal用）

### i18nキー追加
- `contact.loading`/`common.done`

### 検証
- アプリ `npx tsc --noEmit` EXIT:0／web `npx tsc --noEmit --project web/tsconfig.json` EXIT:0

## Rev36（2026-07-07）name_kana＋指名ドロップダウン統一（§28-1）

§19実装順序㉓。ky_castsにふりがな列を追加しあいうえお順ソートを実現＋アプリの手動予約モーダルに指名キャストドロップダウンを追加。

### DB: migration 0014
- **`supabase/migrations/0014_ky_casts_name_kana.sql`**: `ky_casts.name_kana TEXT DEFAULT ''`追加。SQL Editor適用済み・REST probe OK

### アプリ側
- **`src/types/index.ts`**: Cast型に`nameKana: string`追加
- **`src/services/casts.ts`**: CastRow/rowToCast/addCast/updateCastにname_kana対応
- **`src/screens/CastsScreen.tsx`**: CastEditModalにふりがなTextInput追加（名前の直後）
- **`src/components/AnchoredDropdown.tsx`**: 新規作成。レジさぽっ！ProductFormFieldsから流用＝measure()でアンカー位置計算→ボタン直下にリスト表示。DropOption型exportで汎用利用可
- **`src/screens/ReservationsScreen.tsx`**: AddReservationModalに指名キャストドロップダウン追加（AnchoredDropdown使用・nominatableCastsをnameKanaであいうえお順ソート）。handleAdd/onAddシグネチャにcastId追加→makeReservationに渡す
- **`src/i18n/strings.json`**: `cast.nameKana`/`cast.nameKanaPlaceholder`/`reservation.nominationCast`/`reservation.noNomination`追加

### 管理Web側
- **`web/src/lib/types.ts`**: KyCast interfaceに`name_kana: string`追加
- **`web/src/admin/adminApi.ts`**: addCast/updateCastにnameKana?追加
- **`web/src/admin/AdminCasts.tsx`**: テーブルにふりがな列追加＋フォームにふりがな入力欄追加＋startEdit/resetForm/handleSubmit対応

### 客Web
- **`web/src/components/ReservationModal.tsx`**: availableCastsをname_kanaであいうえお順（`localeCompare('ja')`）ソート

### 検証
- アプリ `npx tsc --noEmit` EXIT:0／web `npx tsc --noEmit` EXIT:0
- migration 0014 適用済み・REST probe `ky_casts?select=name,name_kana` 200 OK

## Rev37（2026-07-07）席種・席料（§29）

§19実装順序㉔。ky_seat_typesテーブル追加・三面（アプリ/管理Web/客Web）への席種CRUD＋予約フォームへの席種ドロップダウン。

### DB: migration 0015・0016
- **`supabase/migrations/0015_ky_seat_types.sql`**: `ky_seat_types`テーブル作成（id/tenant_id/name/seat_fee/sort_order/is_active）＋RLS（owner＋anon active読み取り）＋`ky_reservations.seat_type_id`列追加
- **`supabase/migrations/0016_ky_make_reservation_seat_type.sql`**: `ky_make_reservation` RPCにp_seat_type_idパラメータ追加（旧シグネチャDROP→新シグネチャCREATE＋GRANT anon/authenticated）

### アプリ側
- **`src/types/index.ts`**: `SeatType`型追加＋`Reservation`にseatTypeId追加
- **`src/services/seatTypes.ts`**: 新規作成。fetchSeatTypes/addSeatType/updateSeatType/deleteSeatType CRUD
- **`src/services/reservations.ts`**: ReservationRowにseat_type_id追加・rowToReservationにseatTypeIdマッピング・makeReservationにseatTypeId引数追加（→p_seat_type_id）
- **`src/screens/ScheduleScreen.tsx`**: 席種管理セクション追加（一覧表示・有効/無効トグル・編集・削除）＋SeatTypeModal（追加/編集フォーム）
- **`src/screens/ReservationsScreen.tsx`**: AddReservationModalに席種AnchoredDropdown追加（seatFee>0は金額表示）。handleAdd/onAddシグネチャにseatTypeId追加
- **`src/i18n/strings.json`**: seatType系14キー追加

### 管理Web側
- **`web/src/lib/types.ts`**: `KySeatType` interface追加＋KyReservationFullにseat_type_id追加
- **`web/src/admin/adminApi.ts`**: fetchSeatTypes/addSeatType/updateSeatType/deleteSeatType追加
- **`web/src/hooks/useCasts.ts`**: `useSeatTypes`フック追加＋useCastsのselect列にname_kana/user_id追加

### 客Web
- **`web/src/components/ReservationModal.tsx`**: seatTypes props追加＋席種ドロップダウン（席料>0は金額表示）＋RPC呼び出しにp_seat_type_id追加
- **`web/src/components/TenantPage.tsx`**: useSeatTypes hookインポート＋ReservationModalにseatTypes渡し

### 検証
- アプリ `npx tsc --noEmit` EXIT:0／web `npx tsc --noEmit` EXIT:0
- migration 0015・0016 適用済み・REST probe `ky_seat_types` 200 OK・`ky_reservations?select=seat_type_id` 200 OK

## Rev38（2026-07-07）キャスト写真（§30）

§19実装順序㉕。キャストのお店写真をStorageにアップロード・表示する機能。三面（アプリ/管理Web/客Web）対応。

### DB: migration 0017
- **`supabase/migrations/0017_ky_cast_photos_storage.sql`**: Storage `ky-cast-photos`バケット作成（public=TRUE）＋RLS 4ポリシー（anon/authenticated読み取り・authenticated書込み/更新/削除）
  - 証明写真URL列（ky_cast_profiles.id_photo_url）は`ky_cast_profiles`テーブル作成時に追加予定（現段階ではテーブル未作成）

### アプリ側
- **`src/services/castPhotos.ts`**: 新規作成。expo-image-picker→resizeImage(840px)→Storage upload(upsert)→getPublicUrl→DB更新
  - `pickAndUploadShopPhoto`: お店写真（1:1 aspect）→ky_casts.photo_url
  - `pickAndUploadIdPhoto`: 証明写真（3:4 aspect）→ky_cast_profiles.id_photo_url（将来使用）
  - `deleteShopPhoto` / `deleteIdPhoto`: Storage＋DB null化
- **`src/screens/CastsScreen.tsx`**: CastCard/CastDetailViewのアバター→photo_url存在時はImage表示。CastEditModalに写真アップロードUI追加（プレビュー＋「お店写真を変更」ボタン。新規追加時は非表示＝castId未確定のため）
- **`src/i18n/strings.json`**: `cast.changePhoto`キー追加
- **`app.json`**: expo-image-pickerのpluginエントリ追加
- **パッケージ**: expo-image-picker@~17.0.11 / expo-image-manipulator@~14.0.8 / base64-arraybuffer（SDK54互換）

### 管理Web側
- **`web/src/admin/adminApi.ts`**: `uploadCastShopPhoto`関数追加（File→Storage upload→photo_url更新）
- **`web/src/admin/AdminCasts.tsx`**: テーブルに「写真」列追加＋CastPhotoCellコンポーネント（写真表示・input[type=file]による差替えUI）

### 検証
- アプリ `npx tsc --noEmit` EXIT:0／web `npx tsc --noEmit` EXIT:0
- migration 0017 適用済み・Storage bucket `ky-cast-photos` (public=true) 確認・RLS 4ポリシー確認
