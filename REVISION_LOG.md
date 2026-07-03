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
- **未実施（承認/情報待ち）**：①migration 実適用（concafe-yoyaku 本番 SQL Editor＝**別アプリ本番相乗りのため実行前にユーザー確認**）②`.env` に anon key 設定（キー取得が要る）③エミュ実機スモーク（サインアップ→テナント作成→タブ遷移）。①②が済むまで G4 は回せない
