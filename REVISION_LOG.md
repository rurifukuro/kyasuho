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

## Rev39（2026-07-07）経費・確定申告補助（§27）

§19実装順序㉖。ky_expensesテーブル追加・アプリ分析タブに経費セグメント＋管理WebにAdminExpenses（月次収支・年次収支CSV・経費CSV）。人件費はky_cast_payrollから自動参照＝二重計上防止。

### DB: migration 0018
- **`supabase/migrations/0018_ky_expenses.sql`**: `ky_expenses`テーブル作成（id/tenant_id/date/category/amount/memo/created_at/updated_at）＋RLS（owner＝`auth.uid()`パターン）

### アプリ側
- **`src/types/index.ts`**: `ExpenseCategory`型（9カテゴリ固定リスト）＋`Expense`型追加
- **`src/services/expenses.ts`**: 新規作成。fetchExpenses/addExpense/updateExpense/deleteExpense CRUD
- **`src/screens/analytics/ExpensesView.tsx`**: 新規作成。月次経費一覧＋カテゴリ別集計＋経費追加モーダル（AnchoredDropdownでカテゴリ選択）＋CSV出力＋削除
- **`src/screens/AnalyticsScreen.tsx`**: セグメントに`expenses`追加（売上/給与/勤怠/経費の4タブ化）
- **`src/i18n/strings.json`**: expense系13キー＋`analytics.segment.expenses`追加

### 管理Web側
- **`web/src/lib/types.ts`**: `KyExpense` interface追加
- **`web/src/admin/adminApi.ts`**: fetchExpenses/addExpense/deleteExpense＋fetchMonthlySalesTotal/fetchMonthlyPayrollTotal追加
- **`web/src/admin/AdminExpenses.tsx`**: 新規作成。月次収支サマリ（売上−経費−人件費＝差引収支）＋経費CRUD＋カテゴリ別集計＋経費CSV＋年次収支CSV（1〜12月表・カテゴリ別列）
- **`web/src/admin/AdminApp.tsx`**: `expenses`ルート追加
- **`web/src/admin/AdminLayout.tsx`**: ナビに「経費・収支」追加

### 検証
- アプリ `npx tsc --noEmit` EXIT:0／web `npx tsc --noEmit` EXIT:0
- migration 0018 適用済み・`ky_expenses`テーブル確認

## Rev40（2026-07-07）シフト表SNS投稿（§31）

§19実装順序㉗。シフト表画像生成後にXで投稿・Instagramを開く・投稿文コピーのSNS投稿導線を追加。店舗設定にSNSリンク（X/Instagram/TikTok）の編集UI追加。

### DB: migration 0019
- **`supabase/migrations/0019_ky_tenants_sns_links.sql`**: `ky_tenants`に`sns_links JSONB NOT NULL DEFAULT '[]'`列追加

### アプリ側
- **`src/types/index.ts`**: `TenantSnsLink`型（platform/url）追加＋`Tenant`型に`snsLinks`フィールド追加
- **`src/context/TenantContext.tsx`**: `TenantSnsLink`インポート、loadで`sns_links`マッピング、`updateTenant`に`snsLinks`対応
- **`src/screens/ShiftImageScreen.tsx`**: SNS投稿セクション追加（Xで投稿=X intent URL / Instagramを開く=`instagram://`scheme+fallback / 投稿文コピー=Clipboard）。投稿テンプレート＝月ラベル＋出勤キャスト名＋予約URL。`expo-linking`→RN標準`Linking`へ修正
- **`src/components/StoreProfileModal.tsx`**: SNSリンク編集UI追加（X/Instagram/TikTokの3プラットフォーム×URL入力。空URLは保存時にフィルタ。MaterialCommunityIconsでプラットフォームアイコン表示）
- **`src/i18n/strings.json`**: `sns.*`系6キー＋`settings.snsLinks`追加

### 管理Web側
- **`web/src/lib/types.ts`**: `KyTenant`に`sns_links`フィールド追加
- **`web/src/admin/adminApi.ts`**: `fetchOwnTenant`のselect列に`sns_links`追加
- **`web/src/admin/AdminShiftImage.tsx`**: SNS投稿セクション追加（Xで投稿=X intent URL / 投稿文コピー=navigator.clipboard）。`buildWebPostText`ヘルパー（月ラベル＋出勤キャスト名＋予約URL）

### 検証
- アプリ `npx tsc --noEmit` EXIT:0／web `npx tsc --noEmit` EXIT:0
- migration 0019 適用済み・`ky_tenants.sns_links`（jsonb）カラム確認

## Rev41（2026-07-07）デイリー出勤表（§22-2）

§19実装順序㉘。「本日の出勤キャスト」日別画像の生成機能＝月間シフト表の1日版。管理Webに月間/デイリー切替UI追加、写真入り可変グリッドの`DailyLineup`レイアウト実装。

### 型定義（web/src + src 両面同期）
- **`shiftTemplates/definitions.ts`**: `ShiftLayout`に`'daily-lineup'`追加
- **`shiftTemplates/shiftData.ts`**: `ShiftFlatRow`と`ShiftCastEntry`に`photoUrl?: string | null`追加。`buildShiftDays`でphotoUrlを引き継ぎ

### Web レンダラー
- **`web/src/shiftTemplates/ShiftTableRenderer.tsx`**: 
  - `Props`に`dailyDate?: string`追加
  - ヘッダータイトル＝デイリー時は「M/D(曜) 出勤キャスト」表示
  - `DailyLineup`コンポーネント新規追加：写真入り可変グリッド（人数に応じてcols=1〜4自動調整）、写真未登録キャストはデフォルトアバター（♪アイコン）、名前＋出勤時間表示
  - `dailyDateLabel`ヘルパー追加

### 管理Web
- **`web/src/admin/AdminShiftImage.tsx`**:
  - `viewMode`（monthly/daily）＋`dailyDate` state追加
  - モード切替ボタン（月間シフト表/デイリー出勤表）
  - デイリー日付ナビ（前日/翌日/今日＋date input。日付変更時にyearMonthも同期）
  - `castById`マップに変更しflatRowsにphotoUrl注入
  - デイリーモード時はレイアウト切替を非表示（daily-lineup固定）
  - ダウンロードファイル名にデイリー日付反映
  - SNS投稿テキストをデイリー対応（`buildDailyPostText`＝「本日 M/D(曜) の出勤キャスト」）
  - `shiftDay`ヘルパー追加

### 検証
- アプリ `npx tsc --noEmit` EXIT:0／web `npx tsc --noEmit` EXIT:0

## Rev42（2026-07-07）店舗テンプレ取込＋プレビューsticky固定（§22-3/§22-4）

§19実装順序㉙㉚。店舗が持つオリジナル画像を背景に敷いてシフトデータを重ねる「店舗テンプレート」機能＋プレビュー常時固定表示。

### DB: migration 0020
- **`supabase/migrations/0020_ky_shift_backgrounds_storage.sql`**: `ky-shift-backgrounds`バケット（public=TRUE）＋4 RLS policies（tenant毎パス）

### Web レンダラー
- **`web/src/shiftTemplates/ShiftTableRenderer.tsx`**: `Props`に`bgImageUrl?: string | null`追加。背景画像がある場合はbg=transparent＋`background-image: url(...)` / cover

### 管理Web
- **`web/src/admin/adminApi.ts`**: `uploadShiftBackground`関数追加（File→Storage upload→publicUrl返却）
- **`web/src/admin/AdminShiftImage.tsx`**: 店舗テンプレカード（画像アップ＋解除）＋お気に入り保存/読込にbgImageUrl追加（template_key='shop'）
- **`web/src/admin/admin.css`**: `.shift-preview-col` sticky表示（§22-4: position:sticky/top:16px/max-height:calc(100vh-32px)）

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0
- migration 0020適用済み・Storage bucket `ky-shift-backgrounds` (public=true) 確認

## Rev43（2026-07-07）ランキング仕込み（§32の①②）

§19実装順序㉛。将来のランキング機能に向けて、テナントに都道府県・エリア・ランキング参加フラグの3列を追加し、店舗プロフィール編集UIから設定可能にした。

### DB: migration 0021
- **`supabase/migrations/0021_ky_tenants_ranking_columns.sql`**: `ky_tenants`に`prefecture TEXT NOT NULL DEFAULT ''`、`area TEXT NOT NULL DEFAULT ''`、`ranking_opt_in BOOLEAN NOT NULL DEFAULT FALSE`を追加

### アプリ（iOS）
- **`src/types/index.ts`**: `Tenant`型に`prefecture`/`area`/`rankingOptIn`追加
- **`src/context/TenantContext.tsx`**: load/updateTenantで3列を読み書き
- **`src/components/StoreProfileModal.tsx`**: 都道府県・エリア入力フィールドをScrollView内に追加（state/useEffect/handleSave）
- **`src/i18n/strings.json`**: `settings.storePrefecture`/`settings.storeArea`＋プレースホルダー4キー追加

### Web（管理）
- **`web/src/lib/types.ts`**: `KyTenant`に`prefecture`/`area`/`ranking_opt_in`追加
- **`web/src/admin/adminApi.ts`**: `fetchOwnTenant`のselectに3列追加

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0
- migration 0021適用済み・REST probe OK（prefecture/area/ranking_opt_in列存在確認）

## Rev44（2026-07-07）顧客名簿＋スタンプ設定基盤（§32-2仕込み）

ユーザー指示：顧客の名簿を残し、人物像・特徴・出禁を管理できるようにする。スタンプは店舗側で把握可能に（客側アプリは将来）。

### DB: migration 0022
- **`supabase/migrations/0022_ky_customers_and_stamp_settings.sql`**:
  - `ky_customers`テーブル（tenant_id/name/name_kana/contact/persona_notes/internal_notes/is_banned/ban_reason/stamp_count/total_visits/last_visit_date）＋RLS
  - `ky_stamp_settings`テーブル（tenant_id UNIQUE/stamps_per_visit/reward_threshold/reward_description/is_active）＋RLS
  - `ky_orders`に`customer_id`列追加（会計連携用・FK→ky_customers ON DELETE SET NULL）

### アプリ（iOS）
- **`src/types/index.ts`**: `Customer`/`StampSettings`型追加
- **`src/services/customers.ts`**: 顧客CRUD＋スタンプ設定の取得/保存（fetchCustomers/addCustomer/updateCustomer/deleteCustomer/fetchStampSettings/saveStampSettings）
- **`src/components/CustomerListModal.tsx`**: 顧客一覧（検索＋件数表示＋出禁バッジ＋スタンプ数＋最終来店日）＋スタンプ設定パネル（有効/無効トグル・1回あたり・特典閾値・特典内容）
- **`src/components/CustomerEditModal.tsx`**: 顧客編集（名前/ふりがな/連絡先/人物像/社内メモ/出禁トグル＋理由/来店統計の読取表示/削除）
- **`src/screens/SettingsScreen.tsx`**: 「顧客管理」セクション追加（店舗プロフィールの後）
- **`src/i18n/strings.json`**: `customer.*`系38キー追加

### Web（管理）
- **`web/src/lib/types.ts`**: `KyCustomer`/`KyStampSettings`インターフェース追加
- **`web/src/admin/adminApi.ts`**: fetchCustomerList/addCustomerRecord/updateCustomerRecord/deleteCustomerRecord/fetchStampSettingsRecord/saveStampSettingsRecord追加

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0
- migration 0022適用済み・REST probe OK（ky_customers/ky_stamp_settings存在確認）

---

## Rev45（2026-07-07）会計時の顧客紐付け＋スタンプ自動加算（§32-2連携）

ユーザー指示：「スタンプ機能については客側は把握できなくても、店舗側で把握できる（会計時に分かる）ような仕様にして」→ 会計フローに顧客選択＋スタンプ自動加算を組み込み。

### アプリ（iOS）
- **`src/types/index.ts`**: `Order`型に`customerId`追加
- **`src/services/orders.ts`**: `OrderRow`に`customer_id`追加、`closeOrder`が`StampResult`を返すように変更、`applyStamp()`内部関数追加（スタンプ設定に基づきstamp_count/total_visits/last_visit_dateを自動更新・特典到達判定）
- **`src/components/CustomerPickerModal.tsx`**: 新規。顧客選択モーダル（検索＋出禁バッジ＋スタンプ数表示・FormModalShell使用）
- **`src/screens/RegisterScreen.tsx`**: 伝票detailに「顧客の紐付け」セクション追加（顧客選択ボタン/選択後はスタンプ数・来店数・特典バッジ表示/クリアボタン）、会計確定後にスタンプ加算結果をAlert表示（特典到達時は特典内容も通知）
- **`src/components/CheckoutModal.tsx`**: 顧客情報表示（名前・スタンプ数/閾値・特典達成バッジ・残りスタンプ数）をpropsで受取り表示
- **`src/i18n/strings.json`**: `customer.pick`/`register.linkCustomer`/`register.selectCustomer`/`register.rewardReady`/`register.stampResult`/`register.stampAdded`/`register.stampRewardReached`/`checkout.rewardReady`/`checkout.stampRemaining` 追加

### Web（管理）
- **`web/src/lib/types.ts`**: `KyOrder`に`customer_id`追加

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0

---

## Rev46（2026-07-07）管理Web顧客管理ページ（AdminCustomers）

### Web（管理）
- **`web/src/admin/AdminCustomers.tsx`**: 新規。顧客一覧テーブル（検索・出禁バッジ・スタンプ数・特典バッジ・来店数・最終来店日）＋顧客追加/編集フォーム（名前/ふりがな/連絡先/人物像/社内メモ/出禁トグル＋理由）＋スタンプ設定パネル（有効/無効・1回あたり・閾値・特典内容）＋削除（confirm付き）
- **`web/src/admin/AdminApp.tsx`**: `/admin/customers` ルート追加
- **`web/src/admin/AdminLayout.tsx`**: サイドバーに「顧客管理」リンク追加（経費・収支の後）

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0

---

## Rev47（2026-07-07）ノーショー履歴活用（§19-㉛）

### アプリ（iOS）
- **`src/services/reservations.ts`**: `countNoShowByContact(tenantId, contact)` 追加。同一連絡先のno_show回数をexact countで集計
- **`src/screens/ReservationsScreen.tsx`**: 予約ロード時にcontact別no_show回数をMap一括取得。予約カードにバッジ表示（「無断N回」）＋詳細モーダルに赤い警告バナー
- **`src/i18n/strings.json`**: `reservation.noShowCount`/`reservation.noShowWarning` 追加

### Web（管理）
- **`web/src/admin/adminApi.ts`**: `countNoShowByContacts(tenantId, contacts[])` 追加。複数連絡先を一括で no_show 集計し Map 返却
- **`web/src/admin/AdminReservations.tsx`**: load 時にノーショー回数を一括取得＋テーブルのお名前セルに「無断N回」バッジ表示

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0

---

## Rev48（2026-07-07）人件費概算（§19-㉝）

### アプリ（iOS）
- **`src/screens/CastsScreen.tsx`**: キャスト詳細パネルのシフト一覧セクションに見込み人件費カードを追加。payroll settings の base_hourly_rate × シフト時間（calcMinutesWorked 流用）で算出
- **`src/i18n/strings.json`**: `cast.laborEstimate` 追加

### Web（管理）
- **`web/src/admin/AdminCasts.tsx`**: シフトテーブルの下に日別見込み人件費サマリ表示。payroll settings 取得を初期ロードに追加

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0

---

## Rev49（2026-07-07）キャスト成績ビュー（§19-㉜）

### Web（管理）
- **`web/src/admin/AdminCastPerformance.tsx`**: 新規。月次キャスト成績ランキング画面。ky_cast_payroll をキャスト別に集計し、指名数/ドリンク数/売上貢献/支給総額/出勤日数でソート可能なテーブル表示。月合計サマリカード付き
- **`web/src/admin/AdminApp.tsx`**: `/admin/cast-performance` ルート追加
- **`web/src/admin/AdminLayout.tsx`**: サイドバーに「キャスト成績」リンク追加（顧客管理の後）

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0

---

## Rev50（2026-07-07）イベントカレンダー（§19-㉞）

### DB
- **`supabase/migrations/0023_ky_events.sql`**: ky_eventsテーブル新設（tenant_id/title/description/event_date/start_time/end_time/event_type/is_public）。RLS: owner_all + anon_read(is_public=true)。Supabase SQL Editor適用済・RESTプローブ200確認

### Web（管理）
- **`web/src/admin/AdminEvents.tsx`**: 新規。イベントCRUD画面（追加/編集フォーム・種別6種＋テーブル一覧・過去イベント半透明・削除confirm）
- **`web/src/admin/adminApi.ts`**: fetchEvents/addEvent/updateEvent/deleteEvent/fetchPublicEvents 追加
- **`web/src/admin/AdminApp.tsx`**: `/admin/events` ルート追加
- **`web/src/admin/AdminLayout.tsx`**: サイドバーに「イベント」リンク追加

### Web（客側）
- **`web/src/hooks/usePublicEvents.ts`**: 新規。公開イベント（is_public=true・今日以降）を取得するフック
- **`web/src/components/TenantPage.tsx`**: カレンダー後にイベント情報セクション表示
- **`web/src/App.css`**: イベントカードのスタイル追加

### アプリ
- **`src/types/index.ts`**: `StoreEvent` 型追加

### Web型
- **`web/src/lib/types.ts`**: `KyEvent` インターフェース追加

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0
- migration 0023 Supabase適用済（RESTプローブ200）

---

## Rev51（2026-07-07）ボトルキープ管理＋回数券・チェキ券（§19-㊲）

ユーザー指示「店舗側でオンオフできるような機能にしてほしい」→ **ky_tenants に enable_bottle_keep / enable_vouchers フラグを追加し、機能設定ページから ON/OFF 切替。ON の場合のみサイドバーにナビリンクが表示される。**

### DB
- **`supabase/migrations/0024_ky_bottles_vouchers.sql`**: ky_tenants に enable_bottle_keep/enable_vouchers カラム追加（default false）。ky_bottle_keeps テーブル新設（customer_name/item_name/start_date/expiry_date/remaining/note/is_active）。ky_vouchers テーブル新設（voucher_type/name/customer_name/total_count/remaining_count/expiry_date/note/is_active）。両テーブル共 owner-only RLS。Supabase SQL Editor適用済・RESTプローブ200確認

### Web（管理）
- **`web/src/admin/AdminBottleKeep.tsx`**: 新規。ボトルキープCRUD画面（登録/編集フォーム・テーブル一覧・残量表示・期限切れ半透明・返却/復活トグル・削除confirm）
- **`web/src/admin/AdminVouchers.tsx`**: 新規。回数券・チェキ券CRUD画面（発行/編集フォーム・種別3種(回数券/チェキ券/その他)・1回使用ボタン・残り/合計表示・有効/無効トグル・削除confirm）
- **`web/src/admin/AdminSettings.tsx`**: 新規。機能設定ページ（ボトルキープ管理ON/OFF・回数券管理ON/OFF チェックボックス→ky_tenants更新）
- **`web/src/admin/adminApi.ts`**: updateTenantFlags / fetchBottleKeeps/addBottleKeep/updateBottleKeep/deleteBottleKeep / fetchVouchers/addVoucher/updateVoucher/useVoucher/deleteVoucher 追加。fetchOwnTenant の select に enable_bottle_keep/enable_vouchers 追加
- **`web/src/admin/AdminApp.tsx`**: `/admin/bottle-keep` `/admin/vouchers` `/admin/settings` ルート追加。handleTenantUpdate コールバックで設定変更を即反映
- **`web/src/admin/AdminLayout.tsx`**: NAV_ITEMS に flag プロパティ追加。フラグ ON の場合のみ「ボトルキープ」「回数券・チェキ券」ナビリンク表示。「機能設定」リンク常時表示

### Web型
- **`web/src/lib/types.ts`**: KyTenant に enable_bottle_keep/enable_vouchers 追加。KyBottleKeep/KyVoucherType/KyVoucher インターフェース追加

### アプリ
- **`src/types/index.ts`**: Tenant に enableBottleKeep/enableVouchers 追加。BottleKeep/VoucherType/Voucher 型追加
- **`src/context/TenantContext.tsx`**: テナント読込マッピングに enableBottleKeep/enableVouchers 追加

### 検証
- アプリ/Web両面 `npx tsc --noEmit` EXIT:0
- migration 0024 Supabase適用済（RESTプローブ200）

---

## Rev52（2026-07-07）アプリ側ボトルキープ＋回数券管理ビュー

ユーザー指示「アプリ側でもキャストが手軽に編集できるようにしたい」→ **分析タブに条件付きセグメント（ボトルキープ/回数券）を追加。テナント設定のフラグ ON 時のみ表示。月ナビゲーションはCRUDリストのため非表示。**

### アプリ
- **`src/services/bottleKeep.ts`**: 新規。ky_bottle_keeps の CRUD サービス（Row→BottleKeep camelCase変換・fetchBottleKeeps/addBottleKeep/updateBottleKeep/deleteBottleKeep）
- **`src/services/vouchers.ts`**: 新規。ky_vouchers の CRUD サービス（Row→Voucher camelCase変換・fetchVouchers/addVoucher/updateVoucher/useVoucher/deleteVoucher）
- **`src/screens/analytics/BottleKeepView.tsx`**: 新規。カード型FlatListビュー。FormModalShellでの追加/編集。状態バッジ（保管中/返却済/期限切れ）。アクション：編集・返却/復活トグル・削除
- **`src/screens/analytics/VouchersView.tsx`**: 新規。カード型FlatListビュー。FormModalShell＋AnchoredDropdown（種別選択：回数券/チェキ券/その他）。「1回使用」ボタン（残数確認付き）。状態バッジ（有効/使い切り/期限切れ/無効）。残数太字18pt表示
- **`src/screens/AnalyticsScreen.tsx`**: Segment型に `'bottle'|'voucher'` 追加。BASE_SEGMENTS＋テナントフラグ依存のdynamic segments memo。MONTH_FREE_SEGMENTS（bottle/voucher）→月ナビ条件非表示。ビュー描画ブロック追加
- **`src/i18n/strings.json`**: analytics.segment.bottle/voucher、bottle.*（約20キー）、voucher.*（約25キー）追加

### 検証
- `npx tsc --noEmit` EXIT:0

## Rev53（2026-07-07）UI §番号除去＋スモークデータ入力

ユーザー指示「経費収支に§27と表示される。他画面も横断確認・修正。スモークデータ入力も」→ **管理Web UIに残っていたSPEC節番号（§27/§22-3）を除去＋全画面横断grepで他に無いことを確認。スモークデータを複数画面に入力し客側→管理側の予約フロー完遂。**

### Web
- **`web/src/admin/AdminExpenses.tsx`**: 見出し `経費・収支（§27）` → `経費・収支` に修正
- **`web/src/admin/AdminShiftImage.tsx`**: 見出し `店舗テンプレート（§22-3）` → `店舗テンプレート` に修正
- 全Web tsx/アプリ tsx を `§\d+` で横断grep → 上記2箇所以外はすべてコードコメント内（UI非表示）であることを確認

---

## Rev54（2026-07-07）管理Web: 席種管理＋店舗プロフィール編集（アプリ側との機能パリティ）

ユーザー指示「アプリ側と管理Web側で設定できる/できないを分けないで。データ連携しつつ同じ設定ができるようにしてほしい」→ **アプリ側にはあるが管理Web側に無かった設定UIを追加。**

### Web
- **`web/src/admin/AdminSchedule.tsx`**: 席種・席料管理セクションを追加（受付枠管理の下に配置）
  - 席種の追加・編集・削除・有効/無効トグル
  - 席種名・席料（円）入力フォーム
  - アプリ側ScheduleScreenの席種管理と同等の操作が可能
- **`web/src/admin/AdminSettings.tsx`**: 設定画面を大幅拡張
  - 店舗プロフィール編集（店名・ジャンル・住所・営業時間・電話番号・都道府県・エリア・備考）
  - ランキング参加opt-inチェックボックス
  - SNSリンク管理（プラットフォーム選択＋URL・追加/削除）
  - 既存のオプション機能トグル（ボトルキープ/回数券）はそのまま維持
- **`web/src/admin/adminApi.ts`**: `updateTenantProfile()` 関数追加（name/genre/business_info/sns_links/prefecture/area/ranking_opt_in を一括更新）

### 検証
- `npx tsc --noEmit` EXIT:0
- Vite dev server: ビルドエラーなし・コンソールエラーなし
- デプロイリポジトリへpush済み（GitHub Actions自動デプロイ）

### スモークデータ入力（スモーク検証店・本番DB）
- 経費: 仕入（酒・食材）¥15,000 / 家賃 ¥80,000
- 売上: ¥45,000（8セット/15ドリンク/3指名/その他¥5,000）
- メニュー: 基本セット60分 ¥3,000 / キャストドリンク ¥1,000
- イベント: みさき生誕祭 7/12 19:00〜23:00
- 受付枠: 7/7 18:00〜22:00 8席 60分
- 客側予約: スモーク太郎 19:00 2名 → 管理側台帳に反映確認

### デプロイ
- deploy repo push → GitHub Actions ビルド
- `tsc -b` EXIT:0

### 検証
- `npx tsc -b` EXIT:0（Web側）

---

## Rev55（2026-07-07）席種に席数(capacity)追加＋受付枠から席数を分離

ユーザー指示「席種に席数を設定できるようにして、受付枠の席数は削除。席種の合計値を全体の席数にする。」

### DB
- **migration 0025**: `ky_seat_types.capacity` 列追加（NOT NULL DEFAULT 1・CHECK >= 1）
- `ky_make_reservation` RPC再作成: 席数を `ky_unlock_windows.seats` → `SUM(ky_seat_types.capacity WHERE is_active)` から取得
- `ky_unlock_windows.seats` はDB列として残存するが予約ロジックでは不使用

### アプリ
- **`src/types/index.ts`**: `SeatType` に `capacity: number` 追加
- **`src/services/seatTypes.ts`**: `addSeatType`/`updateSeatType` に capacity 対応
- **`src/services/schedule.ts`**: `addWindow` から seats パラメータ削除（固定0を挿入）、`updateWindow` から seats 削除
- **`src/screens/ScheduleScreen.tsx`**: AddWindowModal から席数Stepper削除、SeatTypeModal に席数入力欄追加、受付枠カードから席数表示削除、席種カードに席数表示追加、合計席数サマリ表示追加
- **`src/i18n/strings.json`**: `seatType.capacity`/`seatType.capacityInvalid`/`seatType.totalCapacity` 追加

### Web
- **`web/src/lib/types.ts`**: `KySeatType` に `capacity: number` 追加
- **`web/src/admin/AdminSchedule.tsx`**: 受付枠フォームから席数欄・テーブル列を削除、席種フォームに席数入力欄追加、席種テーブルに席数列追加、合計席数サマリ表示追加
- **`web/src/admin/adminApi.ts`**: `addWindow` の seats を固定0に、`addSeatType`/`updateSeatType` に capacity 追加
- **`web/src/lib/timeUtils.ts`**: `computeDayStatus`/`getAvailableSlots` に `totalSeats` パラメータ追加（w.seats 依存を廃止）
- **`web/src/components/TimeSlotList.tsx`**: `totalSeats` prop 追加
- **`web/src/components/TenantPage.tsx`**: `useSeatTypes` から totalSeats を計算して TimeSlotList に渡す
- **`web/src/hooks/useUnlockWindows.ts`**: `useMonthAvailability` で席種合計を取得し `computeDayStatus` に渡す

### 検証
- `npx tsc --noEmit` EXIT:0（アプリ側）
- `npx tsc -b` EXIT:0（Web側）

---

## Rev56（2026-07-07）経費ページ文字サイズ修正＋チェキ券→クーポン券表記変更

### アプリ
- **`src/screens/analytics/ExpensesView.tsx`**: SalesView/PayrollView とフォントサイズを統一
  - summaryLabel: fontSize 14/'600' → 12/'500'
  - summaryValue: fontSize 18 → 26 + marginTop:2
  - catLabel: fontSize 12 → 11
  - catValue: fontSize 13/'500' → 15/'600'
- **`src/i18n/strings.json`**: `voucher.title` → "回数券・クーポン券"、`voucher.typeCheki` → "クーポン券"
- **`src/types/index.ts`**: VoucherType/Voucher コメント「チェキ券」→「クーポン券」（内部キー 'cheki' は不変）

### Web
- **`web/src/admin/AdminVouchers.tsx`**: VOUCHER_TYPES label 'チェキ券'→'クーポン券'、ページタイトル「回数券・クーポン券管理」
- **`web/src/admin/AdminLayout.tsx`**: ナビラベル「回数券・クーポン券」（前Revで変更済み）
- **`web/src/admin/AdminSettings.tsx`**: 機能設定内の表記2箇所を「クーポン券」へ
- **`web/src/admin/adminApi.ts`**: セクションコメント「クーポン券」へ
- **`web/src/lib/types.ts`**: KyVoucher コメント「クーポン券」へ

### 変更しない箇所
- メニューカテゴリ `cheki`（チェキ写真サービス）は表示ラベルも「チェキ」のまま（券ではなくサービス種別）
- DB内の VoucherType キー 'cheki' は内部識別子として不変
- SPEC.md / REVISION_LOG.md / migration コメント内の歴史的記録

### 検証
- `npx tsc --noEmit` EXIT:0（アプリ側）
- `npx tsc -b` EXIT:0（Web側）
- 横断 grep で表示ラベルとしての「チェキ券」が残存しないことを確認

---

## Rev57（2026-07-07）領収書画像取込機能（楽楽精算参考）

ユーザー指示「領収書などを取り込んでまとめられるようにしてほしい。楽楽精算というSaaSを参考に。」

### DB
- **migration 0026**: `ky_expenses.receipt_url TEXT` カラム追加
- **Storage**: `ky-receipts` バケット作成（public=true・RLS認証制限）
- migration 適用済み＋REST プローブ確認済み

### アプリ
- **`src/types/index.ts`**: `Expense` に `receiptUrl: string | null` 追加
- **`src/services/expenses.ts`**: select/insert に `receipt_url` 追加、rowToExpense に receiptUrl マッピング
- **`src/services/receipts.ts`**: 新規。カメラ撮影(`takeReceiptPhoto`)・ギャラリー選択(`pickReceiptFromGallery`)→リサイズ(1200px)→Storage upload→DB更新。`deleteReceipt` でStorage＋DB両方クリア
- **`src/screens/analytics/ExpensesView.tsx`**: 経費カードに領収書ボタン追加（未添付=カメラアイコン・添付済=画像アイコン）。ActionSheet でカメラ/ギャラリー選択（iOS=ActionSheetIOS/Android=Alert）。領収書ビューワー（フルスクリーンModal・削除ボタン付き）
- **`src/i18n/strings.json`**: `expense.receipt`〜`expense.deleteReceiptConfirm` 8キー追加

### Web
- **`web/src/lib/types.ts`**: `KyExpense` に `receipt_url: string | null` 追加
- **`web/src/admin/adminApi.ts`**: fetchExpenses/addExpense の select に `receipt_url` 追加。`uploadReceipt`（File→Storage→DB）・`deleteReceipt`（Storage＋DB）関数追加
- **`web/src/admin/AdminExpenses.tsx`**: テーブルに「領収書」列追加（添付=表示/削除ボタン・未添付=ファイル選択ラベル）。領収書ビューワー（オーバーレイModal・✕で閉じる）

### 検証
- `npx tsc --noEmit` EXIT:0（アプリ側）
- `npx tsc -b` EXIT:0（Web側）
- migration 適用→REST `ky_expenses?select=id,receipt_url` 正常応答
- Storage `ky-receipts` バケット存在確認（storage.buckets テーブル直接クエリ）

---

## Rev58（2026-07-07）スモークデータ追加登録＋seats CHECK緩和

### DB
- **migration 0027**: `ky_unlock_windows_seats_check` を `seats >= 1` → `seats >= 0` に緩和（Rev55で seats は不使用化・アプリは 0 を送信するが旧制約で INSERT 不能だった）

### スモークデータ（本番DB・スモーク検証店テナント）
- **キャスト**: 3名追加（みさき/あやね/ゆうか）→ 計4名
- **シフト**: 7/7〜7/12の1週間分14件（花子週4・みさき週5含む生誕祭・あやね週3・ゆうか新人週2）
- **受付枠**: 7/8〜7/12の5日分追加 → 計7件（seats=0・席数は席種capacity合計で管理）
- **予約**: 5件追加（指名あり/なし/大人数/生誕祭混在）→ 計7件
- **勤怠**: 7/7分2件（花子=出勤/みさき=出勤）
- **給与**: 7/7分2件（花子¥6,267/みさき¥7,000）
- **顧客**: 3件追加（予約太郎/常連さんA/みさき推しC）

## Rev59（2026-07-07）批判的レビュー対応: 重複防止・通知拡張・月次レポート・経費カテゴリカスタム

批判的レビュー（Rev58後）で指摘されたC①⑤⑥＋D項目を一括実装。②③は確認の結果、既に実装済みだった。

### DB
- **migration 0028**: `ky_make_reservation` RPC改修 — 同一連絡先（contact）で同日・同時間帯に二重予約がある場合 `duplicate_contact` エラーを返す（contact が空の場合はチェックしない）
- **migration 0029**: `ky_expense_categories` テーブル新設 — テナント毎のカスタム経費カテゴリ（key/label）。RLS=SELECT公開・INSERT/UPDATE/DELETE はオーナーのみ
- **データ修正**: テストキャスト花子の `name_kana` を空文字→「テストキャストハナコ」に更新（⑥）

### ⑤ 予約重複防止
- `ky_make_reservation` RPC: 席割当の前に同一 contact×date×時間重複チェックを追加
- 客Web `ReservationModal.tsx`: `duplicate_contact` エラーメッセージ表示
- アプリ `ReservationsScreen.tsx`: 同上
- i18n: `reservation.errorDuplicateContact` キー追加

### ① 予約変更/キャンセル通知
- `NotificationContext.tsx`: INSERT に加え UPDATE イベントのリスナーを追加。ステータス変更時（キャンセル/その他）にプッシュ通知を発火
- i18n: `notification.reservationCancelled` / `reservationCancelledBody` / `reservationChanged` / `reservationChangedBody` 追加

### ④ 月次レポート（印刷対応）
- `AdminExpenses.tsx`: 「月次レポート印刷」ボタン追加。新しいウィンドウに印刷用HTMLを生成（収支サマリ＋経費明細テーブル＋自動 window.print()）

### D 経費カテゴリのカスタム追加UI
- **アプリ側**:
  - `types/index.ts`: `ExpenseCategory` を string 拡張＋`CustomExpenseCategory` 型追加
  - `services/expenses.ts`: `fetchCustomCategories` / `addCustomCategory` / `deleteCustomCategory` 追加
  - `ExpensesView.tsx`: カスタムカテゴリをfetch→ビルトイン9種とマージ→ドロップダウン/集計/カード表示に反映
- **管理Web側**:
  - `adminApi.ts`: `KyExpenseCategory` 型＋`fetchCustomExpenseCategories` / `addCustomExpenseCategory` / `deleteCustomExpenseCategory` 追加
  - `AdminExpenses.tsx`: カスタムカテゴリをfetch→マージ→フォーム/集計/CSV/年次CSVに反映。折りたたみ式「カテゴリを追加・管理」UIで追加/削除

### 確認済み（実装不要）
- **②客Web席種ドロップダウン**: `ReservationModal.tsx:143-155` で既に実装済み（席種選択＋席料表示）
- **③遅刻控除の給与自動反映**: `payroll.ts:253` / `adminApi.ts:509` で `a.status === 'late' ? 1 : 0` を calcPayroll に渡しており、自動生成時に正しく控除される

---

## Rev60（2026-07-07）DailyLineup大人数対応＋スモークキャスト10名追加

シフト表のDailyLineup（§22-2 出勤表）が大人数キャストで表示崩れを起こす問題を修正。MonthGrid/WeekRowsは既にオーバーフロー制御済みだったがDailyLineupのみ欠落していた。合わせてスモーク検証店にキャスト10名＋シフトデータを追加し大人数テストを可能にした。

### Web（web/src/shiftTemplates/ShiftTableRenderer.tsx）
- **DailyLineup関数**: cols計算を大人数対応へ変更（`count<=16→4列, それ以上→5列`）
- オーバーフロー計算追加: `maxVisible`（利用可能高さからの表示上限推定）・`safeMax`（最大25名キャップ）・`shown = casts.slice(0, safeMax)`
- レンダリングを `casts.map()` → `shown.map()` に変更
- `overflow > 0` の場合にセルサイズの `+N人` オーバーフローインジケータを表示（破線ボーダー・アクセントカラー）

### DB（スモークデータ・migration不要）
- スモーク検証店（tenant=419f654b）にキャスト10名追加: りな/さくら/ひなた/もえ/つばさ/ここあ/まりん/れいな/なつき/あおい（計14名）
- シフト追加: 7/8=13名, 7/10=8名, 7/14=12名, 7/15=14名（全員）

### 検証
- Web `npx tsc -b` EXIT:0
- アプリ側ShiftTableRendererにはDailyLineupなし（Web専用レイアウト）→同期不要

## Rev61（2026-07-07）§22-3 店舗テンプレート取り込み（AI構造解析＋カスタム配置レンダラー）

SPEC §22-3「店舗独自テンプレートの取り込み」を実装。店舗が既に使用している完成品シフト表画像をアップロードし、Claude Vision（Haiku 4.5）でグリッド構造・配色を自動検出。検出結果の配置情報に基づき、背景画像の上にシフトデータを不透明セルで重ねて描画する。

### Edge Function（supabase/functions/ky-shift-analyze/index.ts）新規
- Claude Vision APIで画像解析→ShiftPlacement相当のJSON返却
- 認証: JWT検証＋テナントオーナーチェック（ky-shift-designと同一パターン）
- レート制限: reserve_ky_ai_slot RPC共有（20/tenant/日, 400全体/日）
- モデル: claude-haiku-4-5-20251001（MAX_TOKENS=1024）
- Supabase CLIでデプロイ済み

### Web（web/src/shiftTemplates/ShiftTableRenderer.tsx）
- `CustomPlacement`コンポーネント追加: placement(AI検出結果)に基づくオーバーレイ描画
  - タイトル領域: 不透明セルで元テキストを覆い、店名＋月名or日付を描画
  - 月間モード: 7列カレンダーグリッド（曜日ヘッダー＋日別キャスト名＋時間）
  - デイリーモード: 写真カードグリッド（丸型アバター＋名前＋時間）
  - オーバーフロー対応: セル高さに収まらないキャストは`+N人`表示
- `renderMonthlyCells`/`renderDailyCells`ヘルパー関数
- Props に `placement?: ShiftPlacement | null` 追加

### Web（web/src/shiftTemplates/definitions.ts）
- `ShiftPlacement`型: gridArea/titleArea（相対座標0-1）、cols/rows、cellBg/textColor/timeColor/accentColor、cellInset

### Web（web/src/admin/AdminShiftImage.tsx）
- 「AIで解析」ボタン追加（bgImageUrl存在時に表示）
- `PlacementEditor`コンポーネント: グリッド/タイトル領域のスライダー微調整、行列数、余白、配色カラーピッカー
- 解析結果のバリデーション＋clamp処理（AIの不正値を安全な範囲に収める）
- お気に入り保存/読込にplacement情報を含める対応

### Web（web/src/admin/adminApi.ts）
- `analyzeShiftImage(imageUrl)` 関数追加（ky-shift-analyze Edge Function呼び出し）

### CSS（web/src/admin/admin.css）
- `.placement-editor`/`.placement-slider-grid`スタイル追加

### 検証
- `npx tsc -b` EXIT:0
- Edge Function デプロイ成功（ky-shift-analyze）
- ANTHROPIC_API_KEY をconcafe-yoyaku Supabaseプロジェクトに Secret 登録済み
- AI解析テスト実行→視覚検証（placement_test.html）でグリッド配置の一致を確認

---

## Rev62（2026-07-07）シフト表表示修正（簡略時間表記・全キャスト表示・1行形式）

参考シフト表に合わせた表示改善。コンカフェ業界標準の時間表記＋全キャスト完全表示。

### Web（web/src/shiftTemplates/ShiftTableRenderer.tsx）
- `shortTime()` ヘルパー追加: `18:00`→`18`、`18:30`→`18.5`（時間のみのシンプル表記）
- `shortRange()` ヘルパー追加: `shortTime(start)-shortTime(end)` で24時間超え対応（`00:00`終了→`24`、`01:00`終了→`25`＝深夜営業の業界標準）
- **MonthGrid**: `maxPerCell` 制限廃止→全キャスト表示。動的フォントサイズ（`maxCastCount` 基準で `lineH=max(12, min(22, availH/maxCastCount))`）。1行形式 `{名前} {時間-時間}`（2行分離を廃止）
- **WeekRows / DailyLineup / CustomPlacement（monthly/daily）**: 全レイアウトで `shortRange()` 統一適用
- 未使用変数 `headerRowIdx` 削除
- `JSX.Element[]` → `React.JSX.Element[]`（TS名前空間修正）

### 検証
- `npx tsc -b` EXIT:0
- ブラウザ検証: Day12「みさき 17-24」（旧「17-0」→修正済み）、Day15 全14名表示確認

---

## Rev63（2026-07-07）セキュリティ監査＋堅牢化（S1〜S12・migration 0030）

全設計横断監査（migration 0001〜0029・Edge Function 2本・アプリ/管理Web/客Webクライアント層）で発見した脆弱性12件の修正。

### DB（supabase/migrations/0030_security_hardening.sql・本番適用済み）
- **S1**: ky_reservations の anon 読取を列レベルGRANTで制限（id/tenant_id/date/slot/set_minutes/seat_no/status のみ・customer_name/contact のPII収集を遮断）
- **S2**: ky_reservation_pins_admin_delete を自テナント予約に限定（テナント越境削除の穴）
- **S3**: ky_pin_attempts 新設＋PIN総当たり対策（15分5回失敗ロック）を ky_verify_reservation_pin / ky_cancel_reservation に実装（reason/error に too_many_attempts 追加）
- **S4**: ky_casts_self_update_guard BEFORE UPDATE トリガー新設（キャスト本人は name/name_kana/bio/photo_url/sns_links/accepts_nomination のみ更新可・tenant_id/user_id/sort_order 改変を遮断）
- **S5**: ky-cast-photos の書込ポリシーを自テナントフォルダ限定に（他店フォルダへの書込穴）
- **S6**: ky-receipts の公開読取ポリシー廃止→オーナー限定＋書込フォルダスコープ（anon列挙を遮断。バケット自体は0026でpublic=TRUE＝URL直指定はUUID2つ必要で推測不能。本番分離時に private＋署名URL化＝SQL内コメント明記）
- **S7**: ky_seat_types / ky_events の anon 読取に is_suspended=false 条件追加
- **S8**: ky_make_reservation v4（slot形式regex・氏名必須/100字・contact200字・note1000字・party_size 1〜99・停止テナント拒否・cast_id/seat_type_id の自テナント所属チェック）
- **S9**: ky_redeem_cast_invite に set search_path=public（SECURITY DEFINER堅牢化）
- **S10**: ky_delete_account v2（ky_ai_usage＋Storage 3バケットの残骸削除を追加）
- 適用方法: `supabase migration repair`（0005〜0029を履歴登録）→ `supabase db push`（0030のみ・dry-run確認済み）

### Edge Function（supabase/functions/ky-shift-analyze/index.ts・再デプロイ済み）
- **S11**: SSRF防止＝取得先URLを自テナントの ky-shift-backgrounds 公開URLプレフィックスに限定＋8MB上限＋image/* content-type チェック

### 客Web
- **S12**: useReservations.ts の select から customer_name 除去（S1と対）
- types.ts: KyReservation から customer_name 分離（管理Web用は KyReservationFull）・too_many_attempts 型追加
- ReservationEditModal.tsx: 試行回数上限エラーの表示追加

### 検証（WEB7 RESTプローブ・全通過）
- P1: anon `select=customer_name` → 401/42501（遮断確認）／P2: 許可列 → 200
- P3: ky_pin_attempts anon → 401／P4・P5: seat_types/events anon → 200
- P6・P7: PIN照合/キャンセルRPC正常応答／P8: make_reservation 存在しないテナント → not_unlocked（挿入なし）
- P9: ky-receipts anon 列挙 → 空配列（遮断確認）
- `npx tsc -b`（web）EXIT:0／`npx tsc --noEmit`（アプリ）EXIT:0

## Rev64（2026-07-07）金融・セキュリティ強化設計＝SPEC §33新設（設計のみ・実装なし）

**ユーザー指示:** フェーブルが使えるうちに金融関係・セキュリティ関係を高める部分の設計をし、計画書・制作手順書へ反映。

### SPEC.md
- **§33新設**: 金融・セキュリティ強化設計（FIN-1〜8／SEC-11〜13・Phase A〜D）
  - 設計根拠4点（実コード調査で確認）: ①CSVインジェクション未対策（csv.ts×2の escapeCell が先頭=+-@未処理）②金銭テーブルにCHECK制約なし ③キャスト銀行口座が平文text（0012）④ky_tenants.plan がクライアント直UPDATE可＝IAP ON後の課金バイパス
  - Phase A（MVP前＝migration 0031候補）: FIN-1金銭CHECK／FIN-2確定伝票不変トリガー／FIN-3 ky_close_order RPCでsubtotalサーバー再計算／FIN-4 plan列クライアント更新禁止／SEC-11 CSV式インジェクション無害化／口座番号マスク先行
  - Phase B（IAP ON時）: FIN-5 ky-iap-verifyレシートサーバー検証／FIN-6 ky_audit_log
  - Phase C（本番分離時）: FIN-7口座暗号化(Vault/pgsodium)／SEC-12 Auth強化(Leaked Password Protection・MFA)／SEC-13 PITR＋日次エクスポート／ky-receipts private化
  - Phase D（将来決済）: FIN-8資金非預かり（Stripe Connect Direct charges型・弁護士確認❷ゲート）
- 冒頭改訂履歴を第6次へ更新

### 手順書反映（メモリ側・バックアップ .bak_20260707_fin）
- saas_init_playbook.md: SEC-11〜14追加＋💰FIN-1〜8金銭データ標準セクション新設＋本番分離チェックリストに強化回収項目
- app_init_playbook.md: 1-11「Supabase Auth直結アプリの基盤」新設＋マニフェストにAuth基盤/services層の2行追加＋1-9にFIN参照

**実装は未着手**（migration 0031・csv.ts修正・ky_close_order は次Rev以降の実装候補）。コード変更なし＝tsc対象なし。

## Rev65（2026-07-07）§33 Phase A 実装＝migration 0031 本番適用＋SEC-11 CSV修正＋closeOrder RPC化

**ユーザー指示:** 次に進めて（§33 Phase A の実装を承認）

### migration 0031（本番適用済み・db push）
- **FIN-1**: CHECK制約12本（not valid→validate で既存行安全）
  - ky_order_items: qty 1〜999 / price -9,999,999〜9,999,999
  - ky_orders: subtotal/deposit/change 0〜99,999,999
  - ky_sales: total_revenue/set_count/drink_count/nomination_count/other_revenue ≧ 0
  - ky_cast_payroll: 全金額・分数列 ≧ 0（9列複合制約）
  - ky_expenses: amount 0〜99,999,999
- **FIN-2**: 確定伝票不変トリガー
  - ky_orders_closed_immutable: closed/void行は変更禁止（唯一の例外＝closed→void）
  - ky_order_items_closed_immutable: 親伝票がclosed/voidなら明細の変更・削除を拒否
- **FIN-3**: ky_close_order RPC（SECURITY DEFINER＋search_path=public）
  - subtotalをsum(price*qty)でサーバー再計算（クライアント計算値は表示用のみ）
  - テナント所有権チェック＋ステータスチェック＋入力バリデーション
  - authenticated にのみ実行権付与
- **FIN-4**: ky_tenants_plan_protect トリガー
  - authenticated からの plan 列変更を拒否（service_role のみ許可＝IAP検証Edge Function用）

### SEC-11: CSVインジェクション対策（コード修正）
- web/src/admin/csv.ts: escapeCell で先頭 =+-@\t\r にシングルクォート前置
- src/utils/csv.ts: 同一修正（§24の同一仕様コピー維持）

### クライアント修正
- src/services/orders.ts: closeOrder() を直接UPDATE→ky_close_order RPC呼び出しへ切替

### 検証（WEB7 RESTプローブ・全通過）
- P1: anon ky_order_items INSERT → 401（RLS遮断＝CHECK制約到達前に拒否）
- P2: ky_close_order RPC（存在しないテナント） → {"ok":false,"error":"forbidden"}
- P3: anon ky_tenants plan UPDATE → 204（RLSで行不一致＝更新0行）
- `npx tsc --noEmit`（アプリ）EXIT:0 ／ `npx tsc -b`（Web）EXIT:0

## Rev67（2026-07-07）§22-5 モードA廃止＋モードB/C実装（空テンプレ決定論グリッド検出＋任意画像背景＋可読性ガード）

**ユーザー指示:** モード A はもう廃止しよう。B のテスト用のからのテンプレートの作成と、添付の画像を用いて C のテストを行ってみて

### モードA廃止
- `AdminShiftImage.tsx` から `analyzeShiftImage` のインポートと `handleAnalyze` を除去
- Edge Function `ky-shift-analyze` と `adminApi.ts` の `analyzeShiftImage` は未削除（将来の参考用として残置）
- 「AIで解析」ボタンを2択ボタン（モードB/C）に置き換え

### モードB: 空テンプレートのグリッド自動検出（新規ファイル）
- **`web/src/shiftTemplates/gridDetect.ts`** 新設：`detectGridFromImage(imageUrl) → ShiftPlacement | null`
  - 投影プロファイル方式: loadImage → 最大1200pxダウンスケール → グレースケール → 水平/垂直暗ピクセル密度ヒストグラム → ピーク検出(PEAK_RATIO=0.25) → inferGridBounds → ShiftPlacement
  - Canvas 2D APIのみ＝依存追加なし・Edge Function不要・APIコスト0
- テスト: 1080×1350px 空グリッドテンプレ（7列×6行）でcols=7, rows=5, hasHeaderRow=true を正確検出。gridArea座標の誤差 < 1%

### モードC: 任意画像を背景に（可読性ガード）
- **`definitions.ts`** 拡張: `ShiftPlacement` に `cellBgAlpha?: number` / `textOutline?: boolean` 追加。`defaultFreeformPlacement()` 新設（安全な既定配置）
- **`ShiftTableRenderer.tsx`** 拡張:
  - `cellBgWithAlpha(hex, alpha)`: hex色をrgbaに変換（セル背景の半透明化）
  - `outlineStyle(textColor)`: 文字色の輝度から白/黒を選び4方向text-shadow生成
  - CustomPlacement: タイトル/ヘッダー/セルの全テキストにtextShadow適用、セル背景にcellBgAlpha適用
- **`AdminShiftImage.tsx`** UI: PlacementEditor内に「可読性ガード」セクション追加（cellBgAlphaスライダー + textOutlineチェックボックス）
- テスト: カラフルグラデーション背景で文字の可読性を確認（4方向白text-shadow + rgba(255,255,255,0.82)セル背景）

### その他
- `ShiftTableRenderer.tsx`: ヘッダーの `padding` ↔ `paddingBottom` ショートハンド競合を個別プロパティに展開（React警告解消）

### SPEC.md更新
- §22-5タイトル/本文をモードA廃止・モードB/C実装済みに更新。参照箇所（§3-I・§19・§22）も連動更新。改訂履歴を第8次へ

### 検証
- `npx tsc -b` EXIT:0
- ブラウザプレビュー: モードB（空テンプレ→グリッド検出→正確配置）/ モードC（写真背景→freeform配置→可読性ガード描画）両方動作確認

---

## Rev66（2026-07-07）シフト表取込の改善仕様書＝SPEC §22-5新設（仕様のみ・実装なし）

**ユーザー指示:** シフト表の作成について店舗の持っている空テンプレート、特定の画像を背景にシフト表を作成できるように、今のうちに修正改善の仕様書を作成しておいて

### SPEC.md 加筆（コード変更なし）
- **§22-5 新設**「店舗テンプレート取込の改善＝取り込み3モード化＋セル個別微調整」
  - 現行課題4点の整理（空テンプレ解析精度／均等分割前提／任意画像不可／微調整手段不足）
  - **取り込み3モード**: A=記入済み（現行Vision解析維持）／B=空テンプレ（決定論グリッド検出が正・Vision補完は従）／C=任意画像背景（解析なし・A/B失敗時のフォールバック先に一本化）
  - **モードB**: クライアントCanvasの投影プロファイル方式（mapkit.py の決定論解析思想を移植・依存追加なし・APIコスト0）。ky-shift-analyze は mode ヒント追加のみ・既存SSRF/レート制限ガード不変
  - **ShiftPlacementV2**: colBounds/rowBounds 境界配列で不均等グリッド対応＋cellOverrides（日別セル個別オフセット）＋cellBgAlpha/textOutline（モードC可読性ガード）。v1→v2変換で保存済みお気に入り後方互換・**DB migration不要**（custom_settings jsonb）
  - **微調整UI 2段階**: 境界線ドラッグ（主・Excel列幅方式）→セル個別オフセット（仕上げ）。gridArea一括スライダーは全体調整として存置
  - 受け入れ基準5点（境界誤差±1%／不均等一致／縁取り可読／v1回帰／ガード再プローブ）
  - 実装順=C→V2+境界ドラッグ→B（着手はユーザー指示待ち）
- §22-3 末尾に§22-5へのポインタ追記／§3-I に◯項目追加／§19 に㊳追加／改訂履歴を第7次へ

### 検証
- 仕様書のみ＝tsc・プローブ対象なし。SPEC内の参照整合（§22-2/§22-3/§19㊳/WEB6）を目視確認

---

## Rev68（2026-07-10）課金・決済チャネル拡張の事前設計書＝docs/BILLING_DESIGN.md 新設（設計のみ・実装なし）

**ユーザー指示:** 将来的に従来のAppleでのサブスク販売の他、普通にキャッシュカードや振り込みでのサービス販売を想定しています。これを実現するための設計書を出来るだけ詳細に事前設計しておいて欲しい。金融に関する事なのでしっかり検討してね

### docs/BILLING_DESIGN.md 新設（全14章）
- **販売チャネル4種**（Apple IAP／Google Play／Stripeカード／銀行振込=年払い請求書のみ）＋3原則（エンティトルメント単一源泉・1テナント1アクティブ契約・資金非預かり/カード情報非保持）
- **法規制整理**: 資金決済法（自社役務対価=非該当の整理・弁護士確認❷にB2B直販1項目追加）／特商法（通販表記＋最終確認画面義務）／割販法（Stripe Checkout=非保持化・SAQ A）／消費税・インボイス（登録要否はユーザーゲート）／景表法／**スマホ新法（2025-12-18施行）**=リンクなしテキスト誘導0%・リンクアウト15%（Web検索で裏取り・実装時再確認ゲート付き）
- **決済プロバイダ=Stripe正式採用**（Billing/Checkout/Invoicing/Customer Portal。銀行振込は日本開発のバーチャル口座＋自動消込1.5%。§33-4 Connect と同一基盤）
- **DB設計**: ky_billing_subscriptions（チャネル横断契約台帳・部分ユニークで1テナント1契約強制）／ky_billing_customers／ky_payment_events（provider+event_id一意=Webhook冪等）／ky_billing_invoices＋RPC recompute_tenant_plan（service_roleのみ・FIN-4トリガーと整合）
- **統一状態機械**（trialing/active/past_due/canceled/expired/incomplete）＋チャネル別イベントマッピング（Apple Server Notifications V2／Stripe Webhook／振込invoice.paid）＋grace設計
- **Edge Function 7本の設計規約**（署名検証・冪等・順序逆転耐性=最新状態を引き直す・5xxリトライ委譲・金額はサーバー側Price ID固定）
- **二重課金防止3層**（DB制約/導線抑止/Webhook最終防衛）＋チャネル移行手順・返金/解約ポリシー・経理（前受収益は台帳期間から按分可能な構造）
- **実装フェーズ BILL-0〜4**＋未決事項一覧（価格/インボイス登録/特商法住所/Stripeアカウント開設=全てユーザー決定ゲート）

### SPEC.md 更新
- §14 三面共有: BILLING_DESIGN.md へのポインタ＋スマホ新法による「アプリ内からWeb決済誘導NG」記述の更新（テキスト誘導0%/リンクアウト15%で可）
- §33-4: B2B直販は Phase D（客側決済）と別論点である旨＋設計書ポインタ追記

### 検証
- 設計書のみ＝tsc・プローブ対象なし。SPEC §14/§33-4/FIN-1〜8・saas_init_playbook SEC/FIN標準・W19/R13/R30 との整合を目視確認。スマホ新法とStripe銀行振込はWeb検索で裏取り済み
- 既知の記録ドリフト: 本ファイル内で Rev67 が Rev66 より前に位置（内容は正・順序のみ）＝次の整理Revで並び替え可

---

## Rev69（2026-07-10）BILLING_DESIGN 第2部＝モジュール選択型課金・長期契約割引・クーポン設計＋GATE-1骨格実装

**ユーザー指示:** ①店舗側が利用したい機能を自由に選択できる ②選択した個数に応じて料金設定が変わる ③チラシ内コードでトライアル1ヶ月→2ヶ月延長（クーポンコードで決済できる仕組み）＝競合Dシステムとの明確な差別化。④半年・1年契約の割引も盛り込む。詳細設計＋必要なら現システム整備

### docs/BILLING_DESIGN.md 第2部（§15〜§18）追補
- **§15 モジュール選択型課金**: カタログ7種ドラフト（shift/sales/register/attendance/expense/analytics/limits・無料コア=予約基本）／料金=f(個数)の逓減カーブ＋全部入りキャップ／台帳に selected_modules・module_count・billing_interval 列追加／`ky_tenants.entitlements` jsonb 新設（FIN-4拡張=service_roleのみ書込）／recompute_tenant_entitlements へ発展／Stripe=quantity×graduated価格・IAP=個数×期間SKU（簡略9 SKU案を推奨）／入替=月1回・減=次回更新・増=即時（推奨案）
- **§16 契約期間と長期割引**: 月/半年（≒8%OFF目安）/年（≒17%OFF目安=§14踏襲）。振込は「年のみ」→「半年or年の一括前受け」に緩和。期間変更は次回更新時のみ。割引はPrice単価に織込み（クーポン表現しない）
- **§17 クーポンコード**: サーバーサイド・トライアル一本化（channel='promo'台帳行・全モジュール体験→終了時に必要分だけ選択=アラカルトの営業導線）／ky_coupon_campaigns＋ky_coupon_redemptions（shared/unique両対応・キャンペーン=チラシ版単位で効果測定）／ky-coupon-redeem（レート制限・ライフタイム1回・user_id照合で再トライアル防止・置換方式でスタック防止）／入力は管理Webのみ（アプリ内コード入力欄なし=3.1.1審査リスク回避）／トライアル終了後の自動課金なし（ダークパターン回避=チラシの安心材料）／⚠️ASC Introductory Offer決定（2026-07-06）の差し替え提案=**未承認の仕様分岐**
- **§18**: BILLフェーズ更新（クーポンはBILL-1で決済より先に単体稼働可=チラシ施策を課金ONより先に打てる）・未決事項7点追加・Dシステム対比表・第1部との差分一覧

### 現システム整備（挙動不変の骨格）
- `src/config/features.ts`: MODULE_KEYS カタログ＋ModuleKey型＋Entitlements型＋**isModuleEnabled() ゲート関数**（GATE-1集約・IAP_ENABLED=false の間は常にtrue=全機能無料のまま）。目的=今後の新機能コードが最初からモジュールゲートを通る構造にし、二値plan前提コードをこれ以上生まない（現時点でコード内にplan比較ゼロを確認済み=転換コスト最小）
- SPEC §14: Rev69追補注記（モジュール型への拡張・仕様分岐の明示）

### 検証
- `npx tsc --noEmit` EXIT:0。挙動変更なし（isModuleEnabled は未消費・IAP_ENABLED=false）。web側 plan/entitlement 参照ゼロを grep 確認

---

## Rev70（2026-07-10）トライアル方式のユーザー承認反映＋アプリ内誘導表現規定（QR/URL）の新設

### 経緯
- ユーザーがサーバーサイド・トライアル一本化（Rev69 §17-1 の仕様分岐）を**正式承認**。
- 併せて質問「テキスト誘導（実質0%）にQRコードは含まれるか？」＋「誘導画面にURLを貼れない理由をメモせよ」→ 一次ソース調査（Apple公式「Payment options on the App Store in Japan」＋解説記事）の結果を設計書へ規定化。

### 調査結果（要点）
- Apple公式・解説記事のいずれも**QRコードへの言及なし**＝0%のテキスト誘導に含まれると断定できない。
- iOSは画像内QRをテキスト認識でそのまま開ける＝**actionable link 同等と判定されるリスク**（無申請リンクアウト扱い→規約違反リスク）。
- 手数料の正確な仕組み: リンクアウトは「**リンクタップから7日以内**の売上」が対象・標準15%／**Small Business Programは10%**（きゃすりん該当）・リンクなし誘導はタップが存在しないため実質0%。
- → **保守判定: アプリ内はテキスト誘導のみ（「『きゃすりん Web』で検索」型）・QRはチラシ/POP/LP/管理Web等アプリ外でのみ全面活用**（アプリ外はAppleの管轄外＝従来から0%）。

### 変更
- **SPEC §14**: トライアル節を改定（2026-07-06決定→2026-07-10改定）。channel='promo' 台帳行・全チャネル同条件・ストア側 Introductory Offer / free trial を**設定しない**（スタック防止）・owner_user_id 照合で再トライアル防止・終了後の自動課金なし。
- **BILLING_DESIGN §17-1**: ⚠️仕様分岐 → ✅承認済み（実装時チェック項目=ストア側オファー未設定の確認）。
- **BILLING_DESIGN §17-5（新設）**: アプリ内誘導画面の表現規定。①QR不採用の4理由（公式言及なし/リンク同等判定リスク/エンタイトルメント・報告義務の迂回リスク/同一端末UXでQRの利点が薄い）②URL非設置の理由（リンクアウトはエンタイトルメント申請 iOS26.2+・開示モーダル・月次取引報告・手数料10%の4点セット義務が発生／プレーンテキストURLも dataDetectorTypes 自動リンク化で「リンク」判定リスク）③理由は誘導画面コンポーネントのコードコメント＋審査ノートに残す④リンクアウト採用の再検討は BILL-4 ゲート。旧§17-5（計測と法務）は§17-6へ繰下げ。
- **BILLING_DESIGN §2-6**: 手数料表を精緻化（リンクアウト=Small Business 10%・7日ルール・QR行の追加）。
- **BILLING_DESIGN §13(BILL-0)/§18-2/§18-4**: 承認待ち表記を承認済みへ更新。
- **AGENTS.md ゲート③**: 「ASC Introductory Offer／Play free trialを設定」→「サーバーサイド・トライアル＝ストア側オファーは設定しない」へ差し替え（旧記述のまま実装すると promo とスタックする事故を防止）。

### 検証
- ドキュメント＋AGENTS.mdのみの変更（コード変更なし・`features.ts` 不変）。tsc対象外。

---

## Rev71（2026-07-10）チャネル別価格差（Apple/Play上乗せ）＋料金案内はLPで行う方針のメモ

### 経緯
- ユーザー指示: ①料金の案内はLP作成時に行う ②Apple経由は手数料がかかる分、価格を高く設定する ③その価格差もLPで案内する——の3点を設計書へメモ。

### 変更（docs/BILLING_DESIGN.md）
- **§16-3（新設）チャネル別価格差と料金案内の場＝LP**:
  - 料金表・プラン説明の正式な案内場所は**LP（アプリ外）**に一元化（アプリ内に価格表を置かない=§17-5テキスト誘導と整合／ストア説明文に金額固定文字を書かない=R29／価格改定時の更新箇所もLP1箇所）。
  - **IAP/PlayのSKU価格はWeb基準価格より上乗せ**して手数料（Small Business 15%）を吸収（参考: ÷0.85≒×1.18・実額とTier丸めはBILL-0ユーザー決定ゲート）。R35地域別倍率は上乗せ後JP価格を基準に掛ける2段階。
  - **価格差の説明はLPで行う**（「Webからの申し込みが最もお得」）。アプリ内では価格差に言及しない（steering審査リスク=§17-5と同根）。景表法注意=Web価格を「割引」と表現せず各チャネル正価の併記型。
  - 実装影響: 価格テーブルはチャネル別2系統（web/store）。台帳・entitlementsはチャネル非依存のまま。
- **§13(BILL-0)/§18-2**: 未決事項に「Apple/Play上乗せ率の実額」「LPの料金表・価格差文言（LP1-8準拠）」を追加。

### 検証
- ドキュメントのみの変更（コード変更なし）。

## Rev72（2026-07-10）モードB グリッド検出の実画像耐性改良（Otsu適応二値化・極性反転・帯除外・二重線統合）

### 背景
「空のテンプレートから表を読み取れているか、とれはんっ！の画像読み取り経験を元に確認・修正」指示。
mapkit方式（グラウンドトゥルース付きテスト画像＋PASS/FAIL照合）で実測したところ、
Rev67実装（清書黒罫線1枚のみで検証）は現実的なコンカフェテンプレ8種中3種しか正解しなかった。

### 修正前ベースライン（8種中3PASS）
- ❌ T2パステル罫線（輝度~212）→ null（固定閾値DARK_THRESHOLD=128が拾えない。ヘッダコメントの「適応二値化」は未実装だった）
- ❌ T3ダーク背景×明色罫線 → cols=2の誤検出（極性反転なし・内蔵20テンプレ中6種がダーク系）
- ❌ T5ソリッドリボン → 帯を罫線と誤認しgridY=0.045（正解0.222）・行数+1
- ❌ T7角丸セルボックス式（内蔵テンプレと同形式）→ cols=13/rows=9（セル間ギャップの二重線を統合できず）
- ❌ T8パステルJPEG → null

### 修正内容（web/src/shiftTemplates/gridDetect.ts 全面改良）
1. **Otsu法の適応二値化**＋**背景極性自動判定**（多数派クラス=背景・少数派=インク。ダーク背景は反転）
2. **帯除外**: 幅が画像の1.5%超のセグメント（リボン・装飾帯）は罫線と数えない
3. **近接統合**: 2%以内の2線は強度加重中点へ統合（セルボックス式の境界2重線対策）
4. **間隔外れ値除去**: 中央値間隔の35%未満の間隔を作る弱い線（文字由来の偽ピーク）を除去
5. ピーク中心を(start+end)/2に修正（旧(start+maxPos)/2はプラトーで偏る）
6. 罫線判定をPEAK_RATIO 0.25→0.5＋絶対下限0.12（文字行の誤検出防止）

### 検証（全PASS）
- 8種全て期待どおり: T6のみnull・他7種 cols=7/rows=5+ヘッダー・外周誤差1%未満
- 数値照合: 等幅テンプレの罫線位置ズレ≤1px（1080px幅）・T7は6px内側（許容）
- 既知制約: T4不等幅列は本数・外周正確だが内部線は均等分割でズレ（ShiftPlacement v1仕様＝§22-5後半V2 colBounds/rowBoundsで解消予定）
- リグレッション資材: web/scripts/gridtest/（生成スクリプト＋手順README）を新設
- `npx tsc -b` EXIT:0

## Rev73（2026-07-10）§34新設＝客Web予約ページ再設計の詳細設計（concafe-yoyaku UI移植＋店舗テーマ設定・設計のみ）

### 背景
「コンカフェ予約にある機能・デザイン・UIをきゃすりん側にも持ってくる。既存機能は絶対に消さない。席ごとに縦に時間を並べるデザイン厳守・時間タップのポップアップ参考・店側でカラー/写真設定・修正依頼ではなく計画書への加筆/詳細設計のみ」指示。
調査でRev12はconcafe-yoyakuのロジックのみ移植・デザイン/UX未移植（スロットグリッド簡易UI・ピンク無地）と確認済み。

### 変更（SPEC.mdのみ・コード変更なし）
- **§34新設**（§33の後）:
  - 34-0 四原則（機能移植／既存機能削除禁止／台帳型タイムライン＋ポップアップ厳守／店舗テーマ設定）
  - 34-1 台帳型タイムライン＝CustomerTimeline移植仕様（席列×縦時間・PX_PER_MINUTE=1.5・解禁帯タップ→分変換スナップ・予約ブロックはキャンバス直下独立配置=WEB10対策）＋きゃすりん適合（営業帯は解禁窓から動的算出・窓ごとset_minutes・席数=Σky_seat_types.capacity・空き判定ロジック不変）
  - 34-2 予約ポップアップ＝ReservationModal移植（開始時刻/セット数範囲ラベル/席種/当日メニュー決めchk/ご注文予定=ky_menu_itemsカテゴリ別ステッパー/会計目安=席料×セット+注文+サービス料テナント設定/1セット1オーダー警告）＋RPC v2（p_orders/p_menu_undecided後方互換追加）＋ky_reservations.preorder(jsonb)スナップショット→チェックイン時§25伝票プリフィル。目安表示のみ=確定金額は伝票が正（FIN-3維持）
  - 34-3 店舗テーマ設定＝business_info.theme(jsonb)＋Storage ky-tenant-assets/{tenant_id}/（SEC-8）＋CSS変数上書き＋半透明白カード可読性担保＋AdminSettings「客ページデザイン」。未設定は現行ピンク=完全後方互換
  - 34-4 カレンダー塗り分け3色・次の予約可能日フォーカス・notice-banner
  - 34-5 既存機能保全チェックリスト（完了ゲート=実HTTP照合してREVISION_LOG明記）
  - 34-6 実装分割 (a)テーマ→(b)タイムライン＋ポップアップ→(c)注文予定＋RPC v2
- §19に㊴追加・§3-Dと§9-2に§34ポインタ追記

### 検証
- ドキュメントのみの変更（コード変更なし）。実装は別Rev（着手はユーザー指示待ち）

## Rev74（2026-07-10）§35新設＝出勤・シフト三面連携の監査結果と是正計画（設計のみ・コード変更なし）

### 背景
「アプリ側キャスト出勤スケジュール／管理Webおよびアプリのシフト／客Web予約ページの指名が連携できているか確認して」指示→実コード追跡で監査。
結果=**連携は健全**（正はky_shifts 1テーブル・アプリCastsScreen/CastHomeScreen・管理WebAdminCasts・客WebuseShifts・シフト表画像fetchShiftsByMonthが全て同一テーブル直結。指名は客Webでaccepts_nomination×出勤時間内包のフィルタが機能。RLS=anon read/self_select確認済み）。
「修正はせず計画書に盛り込む」指示によりSPECへ是正計画のみ記載。

### 変更（SPEC.mdのみ）
- **§35新設**: 35-0監査結果表／35-1是正①管理Web深夜時刻入力24+対応（AdminCasts・AdminScheduleのtype=time→00:00〜28:45セレクト・アプリのステッパー範囲と統一）／35-2是正②指名サーバー検証（ky_make_reservationにcast_not_available追加・§34RPC v2相乗り可・単独先行も可）／35-3是正③手動予約の出勤フィルタ=**要ユーザー判断（選択肢A現状維持/B出勤フィルタ+トグル）**／35-4実装順序と検証（実HTTP+RESTプローブWEB7）
- §19に㊵追加

### 検証
- ドキュメントのみの変更（コード変更なし）。①②は指示があれば独立着手可・③はユーザー決定待ち

## Rev75（2026-07-10）§36新設＝郵便番号→住所自動入力＋エリア自動選択（設計のみ）

- **背景**: ユーザー指示「アプリとウェブ側どちらも住所において郵便番号を入力すると自動である程度住所が入力される設計に。ウェブの管理側はエリアも自動選択。すぐに修正ではなく詳細設計に留めて計画書に盛り込む」
- **変更**: SPEC.md §36新設（36-0対象3欄の表／36-1 zipcloud API・住所検索ボタン方式・共通util・DB変更なし・プライバシー注意／36-2エリア辞書AREA_DICT初版／36-3実装順序・検証）。§19に㊶追加
- **検証**: ドキュメントのみ・コード変更なし（tsc/エミュ対象外）

## Rev76（2026-07-10）シフト表テンプレート倍増20種→40種＝デザイン語彙拡張・ゴスロリ/リボン系新設・色違い重複解消

### 背景
ユーザー指示「テンプレートの種類を今の少なくとも二倍に。一部のデザインが色変えただけで重複しているのが非常に気になる（例＝エレガントローズ／ゴシックローズ／和風桜）。ゴシック＝ゴスロリ系とリボン系は必ず入れる」。
根本原因＝デザイン語彙が小さすぎた（レイアウト3×見出し3×モチーフ5）ため配色以外の差が出せなかった。→ 語彙を先に拡張してから再構成・増設。

### 変更
- **デザイン語彙拡張**（web/src/shiftTemplates/definitions.ts＝正準・src/shiftTemplates/definitions.ts へコピー同期）
  - ShiftMotif +5: ribbon🎀 / cross✟ / moon☾ / crown♛ / snow❆
  - ShiftHeaderStyle +banner（両端切込みテール付き帯・帯高86px・borderトライアングル方式＝Web/RN同一幾何）
  - ShiftFrameStyle 新設（decorations.frame?）: double二重枠 / lace上下スカラップ / dashed破線枠 / corner-motif四隅モチーフ（省略時none＝既存・AI生成定義と後方互換）
  - カテゴリ +ribbon（リボン）
- **テンプレ20種→40種**（内訳: エレガント5・ポップ5・ゴシック5（**ゴスロリ・ノワール／ゴスロリ・ブラン**含む）・和風4・シンプル5・ネオン4・パステル5・シーズナル4・**リボン3＝カテゴリ新設**）
  - 指摘3種を構造差別化: エレガントローズ=ribbon見出し+lace枠 ／ ゴシックローズ=underline+corner-motif（✟） ／ 和風桜=plain+double枠。ポップ・ソーダはbanner化
  - **重複回避原則を明文化**（definitions.ts冒頭コメント＋SPEC §22）: 同カテゴリ内は layout×headerStyle×frame×motif の組合せを必ず変える（配色だけ違う同型を作らない）
- **両レンダラーに banner テール＋FrameLayer 実装**（web/src/shiftTemplates/ShiftTableRenderer.tsx ／ src/shiftTemplates/ShiftTableRenderer.tsx。Webは店舗テンプレ背景（bgImageUrl）時フレーム非描画＝背景側デザイン尊重）
- AdminShiftImage.tsx: 種数表示を `{SHIFT_TEMPLATES.length}種` の動的表示へ・MOTIF_OPTIONS に新5モチーフ追加（custom_settings バリデーションも自動追随）
- gridDetect.ts コメント（ダーク系背景=40種中13種）・SPEC §3/§19（㊷追加）/§22/AGENTS.md/docs/BILLING_DESIGN.md の種数と語彙を更新
- AI生成側（aiDesign.ts / ky-shift-design）は従来語彙のまま＝新語彙の部分集合として型互換・変更なし（プロンプト拡張は将来枠＝SPEC §22に明記）

### 検証
- `npx tsc -b`（web）EXIT:0 ／ `npx tsc --noEmit`（アプリ）EXIT:0
- 一意性の機械照合: 全40種で同カテゴリ内 layout×headerStyle×frame×motif の重複ゼロ（定義全数照合）・両definitions.tsともテンプレ数40で一致
- 視覚検証: 一時テストページ（全40種一括描画・検証後削除）で ①DOM自動チェック全PASS（帯bg=accent/白文字・バナーテール2個+透明切込み・下線5px・double 3px+1px二重・dashed・lace上下2列×25円・corner-motif四隅・フレーム無しテンプレに漂流要素なし・背景モチーフ描画） ②Edgeヘッドレスで全40種スクリーンショット目視確認（ダーク13種の白文字コントラスト含む） ③新モチーフ字形の豆腐化なし（canvas計測で全グリフ実幅）
- アプリ側レンダラーは静的QA＋型検査まで（エミュ視覚スモークは認証ゲートのため未実施＝次回エミュセッションで推奨）

## Rev77（2026-07-10）§37・§38新設＝開発者売上・契約集計＋キャストシフト提出リマインダー（設計のみ・コード変更なし）

### 背景
ユーザー指示2件（本Revで両方を詳細設計としてSPECへ盛り込み・実装は別Rev）:
1. 「リリース後、実店舗がどのプランに契約しているか・私（開発者）の売上がいくらかを集計するコードを仕込めるか。出来るなら詳細設計を計画書に」→ **回答=できる**。BILLING_DESIGNで全チャネル（IAP/Stripe/振込）の契約イベントが `ky_billing_subscriptions` に一本化済みのため、読み取り専用の集計層を足すだけで成立。
2. 「キャストが特定の日までにシフトを出していないと、管理側からアプリへ提出催促のプッシュ通知。何日前に通知するかは管理側で設定可能に」→ 前提の「シフト希望提出」概念が未実装（§26 #8＝◯）のため、最小の提出フローごと仕様化して包含。

### 変更（SPEC.mdのみ・コード変更なし）
- **§37新設**: プラットフォーム契約・開発者売上集計＝37-0目的（開発者専用・テナント非公開・見込み値建て付け）／37-1 `ky_revenue_events`（append-only・FIN-2同型不変トリガー・UNIQUE(channel,external_ref)冪等・service_roleのみ）＋`ky_platform_admins`（登録はSQL Editorのみ＝権限昇格経路なし）／37-2集計RPC3本（ky_dev_contract_list／ky_dev_revenue_monthly／ky_dev_kpis・全RPC冒頭で ky_assert_platform_admin()・SEC-3・revoke後grant明示）＋MRR定義=直近charge÷期間月数（価格カタログ二重管理なし）／37-3管理Web `#/dev`（slug予約語追加・React.lazy・SEC-11 CSV流用・WEB4）／37-4月次照合運用（ASC/Stripe/台帳3点突合・Apple入金約33日遅れ注記）／37-5セキュリティ整理表／37-6実装フェーズ（課金OFFの今でも先行実装可＝リリース初日から記帳開始が狙い）
- **§38新設**: キャストシフト提出リマインダー＝38-1提出フロー（`ky_shift_requests` approve→既存addShift経路でky_shifts作成＝§35三面連携不変／`ky_shift_submissions`＝提出完了宣言・**未提出判定=行の不存在**・全休でも提出可）／38-2設定 `ky_shift_reminder_settings`（deadline_day 1..28＝毎月N日〆切・**remind_days_before 0..27＝何日前通知の管理側設定**・repeat_daily・remind_hour・次回期限プレビューUI）／38-3配信（Scheduled Edge Function `ky-shift-remind`＝pg_cron毎時・BILLING §7-4同パターン・Expo Push API 100件チャンク・`ky_notification_log` UNIQUE=同日二重送信DB防止・DeviceNotRegistered掃除・W19=検証は自端末限定）／38-4手動催促ボタン（オーナーJWT検証・1時間スロットdedup）／38-5実装分割(a)(b)＋検証4点＋有料境界案（自動リマインダーはモジュール割当＝ユーザー決定ゲート）
- ポインタ加筆5箇所: §3-C（→§38）／§3-E（リマインダー行追加）／§14（→§37）／§19に㊸㊹追加／§26 #8（→§38で仕様化）

### 検証
- ドキュメントのみの変更（コード変更なし・tsc/エミュ対象外）。両節とも実装はユーザー指示があれば §19 ㊸㊹ として独立着手可（㊸はDB/RPC/画面のみ課金OFFでも先行可・㊹は(a)提出フロー→(b)リマインダー配信の順）

## Rev78（2026-07-10）郵便番号→住所自動入力＋エリア自動選択（§36実装）

### 背景
SPEC §36（Rev75設計）の実装。郵便番号入力→zipcloud API検索→都道府県・住所・エリアの自動入力で、3画面の住所入力を効率化する。

### 変更
- **共通util新設**（Web: `web/src/lib/postalLookup.ts`＋`areaDict.ts` ／ アプリ: `src/utils/postalLookup.ts`＋`areaDict.ts`）
  - `lookupPostalCode(raw)`: 7桁検証→zipcloud GET→`{prefecture, city, town}`を返却（ハイフン除去・失敗時throw＝BE-2）
  - `resolveArea(city, town)`: エリア辞書（秋葉原/歌舞伎町/池袋/中野/大須/日本橋（大阪）/天神/すすきの/国分町の9エリア初版）で部分一致→エリア名を提案。ヒットなしは市区町村名を整形して返却
- **管理Web AdminSettings.tsx**: 郵便番号欄＋「住所検索」ボタン追加。検索成功で都道府県セレクト・住所欄・**エリア欄を自動設定**（§36-2必須要件）。postalCodeはbusiness_info.postalCodeとして保存（jsonbキー追加＝非破壊）
- **アプリ StoreProfileModal.tsx**: 同様に郵便番号欄＋住所検索ボタン。エリア自動選択も対応（同一辞書流用）
- **アプリ CastPersonalInfoScreen.tsx**: 郵便番号欄＋住所検索ボタン。検索結果は`〒NNN-NNNN 都道府県市区町村町域`形式で住所欄にプリフィル（エリア欄は無し＝§36-0の設計通り）
- **型定義**: `BusinessInfo`にpostalCode追加（Web: `web/src/lib/types.ts` ／ アプリ: `src/types/index.ts`）
- **i18n**: `settings.postalCode`/`postalSearch`/`postalSearching`/`postalNotFound`/`postalError`＋`personalInfo.`同5キーを`strings.json`に追加
- **SPEC §19㊶・§36本体に実装済みRev78マーク**

### 検証
- `npx tsc -b`（web）EXIT:0 ／ `npx tsc --noEmit`（アプリ）EXIT:0
- zipcloud API実HTTP照合: 一時テストページ（検証後削除）で7ケース自動テスト ALL PASS（秋葉原/歌舞伎町/池袋/大須/日本橋（大阪）/天神のエリア辞書照合＋存在しない番号000-0000のnull返却）。手動検索ボタンも確認（101-0021→東京都千代田区外神田→エリア「秋葉原」）
- 管理Web/アプリのUI統合視覚検証は認証ゲートのため静的QA＋型検査まで（次回ログイン済みセッションで推奨）

## Rev79（2026-07-10）§38-1-2新設＝キャスト提出UI詳細化：カレンダータップ＋日別✎編集＋基本出勤時間（設計のみ・コード変更なし）

### 背景
ユーザー指示「キャストのシフト提出は①カレンダー表示・日付タップで出勤日確定 ②タップ済み日付に編集ボタン＝その日だけ好きな時間を設定 ③提出ページ内で基本の出勤時間（開始/終了）を設定でき、編集しない限り基本時間で提出扱い。詳細設計として計画書に盛り込む」（※原文の「出金」は「出勤」と解釈）。Rev77 §38-1のキャスト提出UI（1行記述）を詳細設計へ格上げ。

### 変更（SPEC.mdのみ・コード変更なし）
- **§38-1-2新設**: 画面構成3段（①基本出勤時間カード＝ky_cast_shift_defaults upsert・未設定中はカレンダータップ無効ガード ②月カレンダーグリッド＝タップでON/OFFトグル＋時間チップ・ON日の✎ボタン→FormModalShellで個別時間＋「基本時間に戻す」・DB書込は提出時一括 ③提出ボタン＝個別時間優先/なければ基本時間をその時点値で実体化＋submissions upsert＋選択日数の確認ダイアログ）／再提出=requested行のみ差替え・approved日はロック表示✅／基本時間をky_casts列追加にしない理由（列GRANT回避＝本人全権の専用テーブル分離）／◯time_source列（任意）／検証項目6点
- §38-1: テーブル表へ `ky_cast_shift_defaults`（tenant_id+cast_id複合PK・時刻表現はky_shifts同一＝0〜28:45）追加・RLS/UI行を38-1-2ポインタへ更新
- §38-5(a)・§19㊹: 新テーブルとカレンダータップ方式を反映

### 検証
- ドキュメントのみの変更（コード変更なし・tsc/エミュ対象外）

## Rev80（2026-07-10）管理Webの深夜時刻入力24+対応（§35-1是正①実装）

### 背景
§35-1（2026-07-10設計）の是正実装。アプリのステッパーは0〜29時で深夜入力可能だが、管理Webは`<input type="time">`（23:59上限）のため24時越えの出勤・受付枠を登録できなかった。深夜営業店が管理WebでもPC操作でシフト/受付を組めるようにする。

### 変更
- **`web/src/lib/timeOptions.ts`新設**: 00:00〜28:45の15分刻み116オプションを生成するユーティリティ（キャッシュ付き）
- **AdminCasts.tsx**: 出勤/退勤の`<input type="time">`を24+対応`<select>`へ差し替え。検証メッセージから「日をまたぐ場合はアプリから登録してください」を除去（24+で不要になったため）
- **AdminSchedule.tsx**: 受付開始/受付〆切の`<input type="time">`を24+対応`<select>`へ差し替え。〆切は空欄オプション（—）を維持（「空欄で開始+8時間」の既存仕様）
- 「終了>開始」検証は維持（24+表記の文字列比較で正常動作＝"26:00">"18:00"はtrue）
- **SPEC §35-1・§19㊵①に実装済みRev80マーク**。Rev78/79番号重複を是正（§38-1-2をRev79へ繰下げ）

### 検証
- `npx tsc -b`（web）EXIT:0
- 管理Web視覚検証は認証ゲートのため静的QA＋型検査まで（次回ログイン済みセッションで「26:00出勤→アプリ/客Web/シフト表画像に反映」の実HTTP照合を推奨＝§35-4）

## Rev81（2026-07-10）指名キャストのサーバー側検証（§35-2是正②実装）

### 背景
§35-2の是正実装。`ky_make_reservation`はp_cast_idを無検証で保存しており、API直叩きで非出勤キャストの指名が通っていた。サーバー側で3条件検証を追加する。

### 変更
- **migration 0032新設** `0032_ky_make_reservation_cast_validation.sql`: `ky_make_reservation` RPC v5。0030 S8の入力検証・停止テナント・他テナント参照防止を全て維持した上で、p_cast_id非null時に追加検証:
  - ① テナント所属＋`accepts_nomination=true`（0030 S8のテナント所属チェックを拡張・エラーを`bad_request`→`cast_not_available`へ変更）
  - ② シフトカバレッジ（`ky_shifts`に当日のスロット全体[start_min, end_min]を覆う出勤行が存在するか・v_end_min算出後に検証）
  - 違反時は `error: 'cast_not_available'` を返す
- **客Web ReservationModal.tsx**: `cast_not_available`のエラー文言追加
- **管理Web AdminReservations.tsx**: 同上
- **アプリ ReservationsScreen.tsx**: 同上（i18nキー `reservation.errorCastNotAvailable` 経由）
- **アプリ strings.json**: `reservation.errorCastNotAvailable`キー追加
- **Web型定義 types.ts**: `MakeReservationResult.error`に`cast_not_available`追加
- **SPEC §35-2・§19㊵②に実装済みRev81マーク**

### 検証
- 型検査: classifier回復待ち（`npx tsc -b`/`npx tsc --noEmit`）
- migration 0032はSQL構文として正（0030 S8全体を維持＋§35-2追加のみ）。本番適用後にRESTプローブで検証推奨:
  - 正常系: 出勤中+accepts_nomination=trueのcast_idで予約成功
  - 異常系①: 他テナントのcast_id → `cast_not_available`
  - 異常系②: accepts_nomination=falseのcast_id → `cast_not_available`
  - 異常系③: 出勤がない日のcast_id → `cast_not_available`
  - 異常系④: cast_id=nullは従来通りスキップ（指名なし予約）

## Rev82（2026-07-10）開発者売上・契約集計ダッシュボード基盤（§37先行実装）

### 背景
§37「リリース後に開発者（テイトさん）の売上・契約状況を集計するコード」を先行実装。課金機能OFF（IAPフラグ未有効化）の今でもDB基盤と画面を仕込み、リリース初日から記帳できる状態にする。契約一覧・MRR等のKPIは課金テーブル（ky_billing_subscriptions）実装時（BILL-1）に有効化。

### 変更
- **migration 0033新設** `0033_ky_dev_dashboard.sql`:
  - `ky_platform_admins`テーブル（開発者アカウント・PK=user_id・SQL Editorでのみ行追加可＝権限昇格経路を作らない・RLS=自分のSELECTのみ）
  - `ky_revenue_events`テーブル（入金イベント台帳・append-only・UNIQUE(channel, external_ref)で二重計上防止・amount_gross正負CHECK・UPDATE/DELETEトリガーで変更禁止＝FIN-2同型・RLS=service_roleのみ）
  - `ky_assert_platform_admin()`ガード関数（SECURITY DEFINER・全開発者RPCの冒頭で呼ぶ）
  - `ky_dev_revenue_monthly(p_from, p_to)` 集計RPC（月×チャネル別のgross/fee/net集計・開発者ガード付き）
  - `ky_dev_kpis()` 基本KPI RPC（登録店舗数・直近30日売上・契約系は課金テーブル実装後に拡張＝暫定0値）
  - 全RPCにrevoke from public/anon + grant to authenticated/service_role（42501の轍回避）
- **Web `#/dev` ルート追加**: App.tsxにReact.lazy DevApp（客・店舗バンドル非搭載）
- **DevApp.tsx新設**: Supabase認証＋ky_platform_admins存在確認ゲート（非管理者には「ページが見つかりません」表示＝開発者ページの存在を匂わせない・防御の本体はRPCガード）
- **DevDashboard.tsx新設**: KPIカード4枚（登録店舗数/直近30日売上/有効契約数/MRR見込み）＋月次売上テーブル（チャネル別gross/fee/net＋見積フラグ）＋月ナビ＋CSV出力（SEC-11無害化済みcsv.ts流用）＋契約一覧プレースホルダー（BILL-1後に有効化）
- **devApi.ts新設**: checkPlatformAdmin/fetchRevenueMonthly/fetchDevKpis
- **admin.css**: dev-kpi-grid/dev-kpi-card/dev-month-navスタイル追加
- **SPEC §37-6・§19-43に実装済みRev82マーク**

### 検証
- Web型検査: `npx tsc -b` EXIT:0
- migration 0033はSQL構文として正。本番適用後の検証推奨:
  - ky_platform_adminsにユーザー行追加（SQL Editor）→ `#/dev`アクセスでダッシュボード表示
  - 非管理者ログインで「ページが見つかりません」表示
  - ky_revenue_eventsへのUPDATE/DELETEがトリガーで拒否されること
  - ky_dev_revenue_monthly RPCがanonで403/authenticatedで結果（空配列）返却

## Rev83（2026-07-10）§38 シフト提出リマインダーDB基盤（5テーブル＋型定義）

### 背景
§38「キャストシフト提出リマインダー」のDB基盤を先行実装。テーブル5本＋RLS＋型定義を仕込み、UIとEdge Functionの実装に備える。

### 変更
- **migration 0034新設** `0034_ky_shift_submissions.sql`:
  - `ky_shift_requests`（シフト希望枠・キャスト提出→オーナー承認/却下。time_source='default'|'custom'。RLS=キャスト本人SELECT/INSERT/DELETE(requestedのみ)＋オーナーSELECT/UPDATE）
  - `ky_shift_submissions`（提出宣言・UNIQUE(tenant_id, cast_id, period_start)。全休=0日選択も提出可。RLS=キャスト本人SELECT/INSERT/UPDATE＋オーナーSELECT）
  - `ky_cast_shift_defaults`（基本出勤時間・複合PK(tenant_id, cast_id)。提出時にこの値を希望行へ実体化。RLS=キャスト本人all＋オーナーSELECT）
  - `ky_shift_reminder_settings`（リマインダー設定・テナント1行。enabled/deadline_day(1-28)/remind_days_before(0-27)/repeat_daily/remind_hour(0-23)。RLS=オーナーall）
  - `ky_notification_log`（通知送信記録・UNIQUE(tenant_id, cast_id, kind, period_start, remind_date)で二重送信防止。kind='shift_reminder'|'shift_reminder_manual'。RLS=オーナーSELECT）
- **アプリ型定義 types/index.ts**: ShiftRequest/ShiftSubmission/CastShiftDefault/ShiftReminderSettings型追加
- **Web型定義 lib/types.ts**: KyShiftRequest/KyShiftSubmission/KyShiftReminderSettings型追加
- **SPEC §38-5・§19-44にDB基盤実装済みRev83マーク**

### 検証
- Web型検査: `npx tsc -b` EXIT:0
- アプリ型検査: `npx tsc --noEmit` EXIT:0
- migration 0034はSQL構文として正。本番適用後の検証推奨:
  - RLS: キャストが他人分のshift_requestsをSELECT不可
  - RLS: オーナーがshift_requestsのstatusをUPDATE可
  - UNIQUE: 同一期間の重複提出がdedup
  - 次Rev以降: 設定UI＋Edge Function

---

## Rev85（2026-07-10）§38 キャスト提出UI＋オーナー承認UI（§38-1-2実装）

Rev83のDB基盤に対応するUI一式＝キャスト側のシフト提出画面（カレンダータップ＋基本出勤時間＋日別時間編集）＋オーナー側のシフト希望受信箱＋提出状況リスト。

### キャスト側（CastHomeScreen拡張）
- **シフト提出セクション**（画面先頭に追加）：
  - 基本出勤時間カード（0〜29時・15分刻みステッパー＋保存→ky_cast_shift_defaults upsert）
  - 未設定ガード（基本時間未設定中はカレンダータップ無効＋警告テキスト）
  - 翌月カレンダーグリッド（日付タップ＝出勤希望ON/OFFトグル・ON日はaccent色＋時間チップ）
  - ✎編集ボタン→ShiftTimeEditModal（FormModalShell＝MODAL-SAFE・個別時間設定＋基本時間に戻すボタン）
  - 承認済み日は✅ロック表示（タップ不可）
  - DB書込は提出ボタン時に一括（途中でやめても半端な希望が残らない）
  - 提出確認ダイアログ（日数・個別時間日数の要約）
  - 再提出＝status='requested'のみ差替え（approved/rejected不変）
- **`src/services/shiftRequests.ts`**（新規）：fetchShiftDefaults/upsertShiftDefaults/fetchShiftRequests/fetchSubmission/submitShiftRequests/fetchTenantShiftRequests/fetchTenantSubmissions/approveShiftRequest/rejectShiftRequest
- **`src/components/ShiftTimeEditModal.tsx`**（新規）：日別時間編集モーダル

### オーナー側（CastsScreen拡張）
- ヘッダーに「シフト希望」ボタン追加→ShiftRequestsView（サブ画面）
- **提出状況リスト**：キャスト×期間で 提出済み✅／未提出❌／アプリ未連携⚠️ の3値バッジ
- **未処理希望リスト**：キャスト名・日付・時間・基本/個別バッジ＋承認（✓→ky_shifts作成）／却下（✗）ボタン
- **処理済みリスト**：承認/却下のステータス表示

### 管理Web側（adminApi拡張）
- `fetchTenantShiftRequests`/`fetchTenantSubmissions`/`approveShiftRequest`/`rejectShiftRequest` 追加
- approveはky_shifts既存行をdelete→insertで上書き（UNIQUE制約なしのため）

### i18n
- `shiftSubmit.*` 13キー＋`shiftRequest.*` 14キー追加

### 検証
- アプリ `npx tsc --noEmit` EXIT:0（G1・G2）
- Web `npx tsc -b` EXIT:0

---

## Rev86（2026-07-10）§38 管理Web側シフト希望パネル（AdminCasts拡張）

Rev85のアプリ側オーナーUI（CastsScreen ShiftRequestsView）と同等の機能をWeb管理画面にも追加。

### AdminCasts.tsx
- **ShiftRequestPanelコンポーネント追加**（出勤スケジュールセクションと招待管理の間に配置）
  - 翌月期間を自動算出（getNextMonthPeriod）
  - **提出状況カード**: キャスト別に提出済み✅ / 未提出❌ / 未連携⚠️ のバッジ表示
  - **未処理テーブル**: 日付・時間・種別（基本/個別）・承認/却下ボタン
  - 承認→ky_shifts作成（delete→insert）＋出勤スケジュール再取得
  - **処理済みテーブル**: 承認/却下ステータスバッジ
- import追加: fetchTenantShiftRequests/fetchTenantSubmissions/approveShiftRequest/rejectShiftRequest

### 検証
- Web `npx tsc -b` EXIT:0
- アプリ `npx tsc --noEmit` EXIT:0

## Rev84（2026-07-10）§39〜§41新設＝メニュー別バック刷新・シフト表強化・ポイント景品設定（設計のみ）

### 背景
ユーザー指示（第11次・5項目パック）: ①キャストバック計算をメニュー毎の割合/固定入力に刷新（店全体ドリンクバック固定金額は廃止→基本バック割合を新設・未設定メニューはこれで計算） ②月間/デイリーシフト表でイベント日を強調表示 ③デイリーシフト表は9名以上で2枚目出力 ④シフト表X投稿ボタンにマンスリー/デイリー別の編集可能テンプレート（参考ポスト踏襲＝出勤時間毎にキャスト名＋アカウントを並べる） ⑤ポイント管理画面の有無確認→無いので「何円で何pt」「何ptで何の景品」の店側設定を新設。**設計のみ・実装はしない**セッション。

### 変更（SPEC.mdのみ・コード変更なし）
- **§39新設「キャストバック計算の刷新」**: ky_menu_items.back_rate/back_amount（相互排他CHECK）＋ky_payroll_settings.default_back_rate新設・drink_back_rate廃止（挙動不変の移行migration＝cast_drink全メニューへ旧値コピー）・優先順位=メニュー固定→メニュー割合→基本割合（nominationはフォールバック対象外＝指名バック二重取り防止）・ky_order_items.back_eachをcloseOrder RPCで確定時スナップショット（FIN-2/FIN-3思想）・給与drink_back→menu_back化
- **§40新設「シフト表強化パック」**: 40-1=ky_event_days＋palette.eventAccent拡張（既存40種は省略互換）・月間セル太枠＋ラベル帯/デイリーはヘッダー直下バナー／40-2=デイリー1枚最大8名・9名以上はceil(n/8)枚自動分割＋ページ表記・開始時刻→name_kana安定ソート／40-3=ky_tenants.sns_post_templates(jsonb)＝マンスリー/デイリー別プレースホルダテンプレ・既定は出勤時間毎グルーピング＋キャスト名＋@ハンドル自動抽出・編集モーダル（チップ挿入/ライブプレビュー/既定に戻す）＋字数カウンタ
- **§41新設「ポイント・景品（クーポン）設定」**: 現状ポイント管理画面は無い→新設。ky_point_settings（yen_per_point）/ky_point_rewards（景品カタログ）/ky_point_transactions（append-only台帳・FIN思想）。設定UI＋カタログCRUDは姉妹アプリ前でも実装可・会計連動の自動付与/使用はcustomer_ref導入（§32-2＝§19㊱）と同時。スタンプはポイント制に包含
- **ポインタ編集12件**: §3-F/§3-K/§3-I/§10（ky_menu_items・ky_payroll_settings）/§23計算式/§23給与CSV/§25-5/§31-2/§22-2/§19㊱/§19に㊺㊻㊼追加

### 検証
- ドキュメントのみの変更＝tsc/エミュ検証対象なし。§39-5/§40-4/§41-4に実装Rev時の検証手順を明記

---

## Rev87（2026-07-10）§38(b) シフト提出リマインダー設定UI（アプリ＋管理Web）

§38-2のリマインダー設定画面をアプリ・Web両面に追加。

### アプリ側
- **`src/components/ShiftReminderModal.tsx`（新規）**: FormModalShell準拠。ky_shift_reminder_settingsのCRUD
  - ON/OFFトグル＋有効時のみ詳細設定表示
  - 提出期限（毎月1〜28日ステッパー）、通知タイミング（0〜27日前）、毎日再通知、通知時刻（0〜23時）
  - プレビュー表示（次回の期限・通知予定日時）
- **SettingsScreen**: 「シフト」セクション追加（店舗プロフィールと顧客管理の間）→ShiftReminderModal起動行

### 管理Web側
- **AdminSettings**: ShiftReminderSectionコンポーネント追加。セレクト/チェックボックスUI＋次回通知プレビュー
- **adminApi**: fetchReminderSettings/upsertReminderSettings追加

### サービス層
- **shiftRequests.ts**: fetchReminderSettings/upsertReminderSettings追加（アプリ側サービス）

### i18n
- `shiftReminder.*` 16キー＋`settings.sectionShift`/`settings.shiftReminderSub`＋`common.saved` 追加

### 検証
- アプリ `npx tsc --noEmit` EXIT:0
- Web `npx tsc -b` EXIT:0
- **残**: pg_cron＋ky-shift-remind Edge Function＋手動催促ボタン（本番DB操作含む＝承認ゲート）

---

## Rev88（2026-07-10）§34(a) 店舗テーマ設定（カラー設定＋客ページCSS変数適用）

§34-3「お店側でカラーや写真の設定ができるようにする」の色設定部分を先行実装。migration不要（business_info jsonb内拡張）。

### 型定義
- **`src/types/index.ts`**: `TenantTheme`型新設（primaryColor/accentColor/bgImageUrl/cardOpacity）、`BusinessInfo`にthemeフィールド追加
- **`web/src/lib/types.ts`**: KyTenant.business_info にthemeフィールド追加（Web側型と一致）

### 管理Web: AdminSettings「客ページデザイン」セクション
- **ThemeDesignSection**コンポーネント新設（SNSリンクの後、シフトリマインダーの前に配置）
  - メインカラー: colorピッカー＋HEX入力（既定=#e55381ピンク）
  - アクセントカラー: colorピッカー＋HEX入力（既定=#c03868）
  - カード透過度: rangeスライダー 50%〜100%（既定=85%・背景画像使用時用）
  - ライブプレビュー: 店名・ジャンル・ボタン・リンク色を実際の設定値で表示
  - 「既定に戻す」ボタン（デフォルト値に戻す＝完全後方互換）
  - 「デザインを保存」ボタン
- **handleProfileSave修正**: プロフィール保存時にthemeを消さないようmerge処理追加
- **adminApi.ts**: updateTenantProfile型にpostalCode・theme追加

### 客Web: TenantPage テーマCSS変数適用
- tenant.business_info.theme がある場合、`--primary`/`--primary-dark` CSS変数を上書き
- テーマ未設定なら現行ピンクのまま（完全後方互換）
- cleanup関数でCSS変数を復元

### 検証
- アプリ `npx tsc --noEmit` EXIT:0
- Web `npx tsc -b` EXIT:0
- **後フェーズ**: 背景画像アップロード（Storageバケット`ky-tenant-assets`新設＝承認ゲート）、アプリ側テーマ設定UI

---

## Rev89（2026-07-10）§34(b) 台帳型タイムライン＋予約ポップアップUI（concafe-yoyaku移植）

§34-1「席ごとに縦に時間を並べる」台帳型タイムラインをconcafe-yoyakuから移植し、§34-2の予約ポップアップを開始時刻/セット数selectに拡張。

### CustomerTimeline.tsx（新規・concafe移植）
- 横軸＝席列（seatTypesから動的構築・「席種名＋番号」ヘッダー）、縦軸＝時間（PX_PER_MINUTE=1.5）
- 営業時間帯: 解禁ウィンドウのmin(open_from)〜max(close_at)から動的算出
- 1時間毎の水平グリッド線＋左端時刻ラベル
- 解禁帯＝タップ可能ゾーン（「＋タップで予約」表示・タップY→分変換→TIME_STEPスナップ→セット末端クランプ）
- 予約ブロック＝absolute配置（WEB10対応: キャンバス直下に独立配置）
- 他人の予約は匿名「予約済」表示
- 出勤キャストチップをタイムライン上部に維持（§34-5保全）

### ReservationModal.tsx（拡張）
- **開始時刻select**: タップした窓の全時刻をTIME_STEP(10分)刻みで列挙（タップ位置より前も選択可）
- **セット数select**: 各選択肢に時間範囲ラベル（例「2セット（19:00〜20:20）」）
- 空席数リアルタイム表示（countAvailableSeats利用）
- 既存フィールド全維持（名前/連絡先/人数/指名キャスト/席種/要望/PIN）

### TenantPage.tsx（更新）
- TimeSlotList → CustomerTimeline に切替（TimeSlotList.tsxは未使用ファイルとして残置）
- selectedSlot型を `{ slotMinutes, windowStartMin, windowEndMin, setMinutes }` に変更
- ReservationModalへwindow情報を渡す新プロップ体系

### App.css（追加・約130行）
- ledger-* クラス群をconcafe-yoyakuから移植（CSS変数はきゃすりんの `--primary`/`--border` 等に適合）
- unlock-zone hover、block reserved/mine/clickable のスタイル

### §34-5保全チェック
店名ヘッダー✅ イベント情報✅ 出勤キャストチップ✅ キャスト指名(あいうえお順)✅ 席種DD+席料✅ 予約確認・変更・キャンセル(PIN)✅ マルチテナントslug✅ Powered by きゃすりん✅

### 検証
- Web `npx tsc -b` EXIT:0
- アプリ `npx tsc --noEmit` EXIT:0
- **残**: §34(c) ご注文予定＋RPC v2（オーダー基盤完了が前提）

---

## Rev90 (2026-07-11) — §39 キャストバック計算の刷新（メニュー別バック設定）

SPEC §39 全面実装。旧「ドリンクバック（円/杯 固定）」→ 新「メニュー別バック設定（3階層優先度）」へ移行。

### 設計
- **3階層優先度**: ①固定額(back_amount) → ②メニュー割合%(back_rate) → ③基本割合%(default_back_rate, nomination除外)
- **back_each**: ky_order_items に追加。ky_close_order RPC が会計確定時に3階層を解決して書き込む（FIN-3パターン）
- **menu_back**: ky_cast_payroll の旧drink_back を改名。Σ(back_each×qty) の事前計算値を格納

### Migration 0035 (`supabase/migrations/0035_ky_menu_back_overhaul.sql`)
- ky_menu_items: `back_rate`/`back_amount` 追加（排他CHECK）
- ky_order_items: `back_each` 追加
- ky_payroll_settings: `drink_back_rate` → `default_back_rate`（既存値をデータ移行後にDROP）
- ky_cast_payroll: `drink_back` → `menu_back`（ALTER RENAME）
- ky_close_order RPC: 3階層バック解決ロジック組込み

### 型定義
- `src/types/index.ts`: MenuItem に backRate/backAmount、PayrollSettings に defaultBackRate、CastPayroll に menuBack
- `web/src/lib/types.ts`: KyMenuItem に back_rate/back_amount、KyPayrollSettings に default_back_rate、KyCastPayroll に menu_back、KyOrderItem に back_each

### payrollCalc（アプリ+Web同期）
- PayrollInput: drinkCount → menuBack（事前計算済み額）
- PayrollBreakdown: drinkBack → menuBack
- calcPayroll: settings から drinkBackRate 不要に（menuBack は入力値透過）

### Web管理画面
- **adminApi.ts**: savePayrollSettings→default_back_rate、upsertMenuItem→back_rate/back_amount、新sumMenuBackByMonth()、generatePayrollFromAttendance→menuBack使用
- **AdminPayroll.tsx**: 設定フォーム「基本バック割合（%）」、テーブル/CSV「メニューバック」
- **AdminMenu.tsx**: バック設定UI（基本割合/割合%/固定円セグメント＋値入力）、テーブルにバックバッジ列
- **AdminCastPerformance.tsx**: menu_back 参照

### アプリ側
- **services/menuItems.ts**: MenuItemRow/MenuItemInput に back_rate/back_amount 追加
- **services/payroll.ts**: drinkBackRate→defaultBackRate、新sumMenuBackByMonth、generatePayrollFromAttendance→menuBack使用
- **services/orders.ts**: 新sumMenuBackByMonth()（back_each×qty集計）
- **screens/analytics/PayrollView.tsx**: 設定カード・設定モーダル・編集モーダル・CSV全てmenuBack化
- **screens/CastHomeScreen.tsx**: PayrollRow drink_back→menu_back、表示「メニューバック」
- **screens/RegisterScreen.tsx**: handleMenuSave に backRate/backAmount 透過
- **i18n/strings.json**: payroll.drinkBackRate→defaultBackRate、payroll.drinkBack→menuBack、CSV headers更新

### 検証
- アプリ `npx tsc --noEmit` EXIT:0
- Web `npx tsc -b` EXIT:0
- **Migration 0035は本番未適用**（承認ゲート）
