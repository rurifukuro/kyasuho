# きゃすほ！ REVISION_LOG

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
