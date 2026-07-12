# きゃすりん 批判的検証レポート（2026-07-12）

> Fable 5 による監査エージェント（KA-1〜12）+ 手動確認の統合レポート。
> 是正 migration = 0052（KA-1/5/7/8/9 の SQL 修正）。

---

## 1. 是正済み（migration 0052 で修正・本番適用は承認ゲート）

### KA-1 [Critical] ky_record_inventory_move: SECURITY DEFINER 無防備

- **場所**: `0040_ky_inventory.sql` L68-103
- **問題**: SECURITY DEFINER（RLS非適用）なのに auth.uid() 照合なし＋ revoke/grant 未設定＝**任意の authenticated ユーザーが他店の在庫を改変可能**。また qty=0 許容・item-tenant 一致未検証
- **是正（0052）**: owner 照合 + qty!=0 検証 + item-tenant 存在確認 + revoke public/anon + grant authenticated
- **回帰リスク**: ky_close_order 内の `perform ky_record_inventory_move(...)` は auth.uid()=オーナーのまま実行されるため通過（手動確認済み）

### KA-5 [Medium] ky_cast_punch: PL/pgSQL record IS NOT NULL 罠

- **場所**: `0038_ky_timecard_punch.sql` L64
- **問題**: `if v_existing is not null and v_existing.check_in_at is not null` — PL/pgSQL では record 変数の `is not null` は**全列が non-null のときのみ真**。check_out_at が null の通常ケースでは record 自体が「not null ではない」と評価される → `already_punched_in` ガードが**一度も発火しない**（同日出勤を二重打刻すると ON CONFLICT で上書き＝意図しない打刻時刻リセット）
- **是正（0052）**: `if v_existing.check_in_at is not null`（列単位判定）に変更。SELECT INTO が行を見つけなかった場合も v_existing.check_in_at は null → ガード通過（insert の ON CONFLICT で正常動作）
- **一般化知見**: → SaaS 手順書 SEC ルールへ追記予定（`record IS NOT NULL` の罠）

### KA-7 [Low] ky_seat_types_anon_read: is_suspended フィルタ欠落

- **場所**: `0015_ky_seat_types.sql` L22-23
- **問題**: 運営停止テナント（is_suspended=true）の席種が客 Web から見え続ける
- **是正（0052）**: `and (select is_suspended from public.ky_tenants t where t.id = tenant_id) = false` 追加。anon 列 GRANT（0046）に is_suspended 含む＝SEC-15 充足確認済み

### KA-8 [Low] ky_close_order back_each UPDATE: テナント境界不備

- **場所**: `0035_ky_menu_back_overhaul.sql` L136-147 / `0047_ky_checkin_close_rpc.sql` L251-262
- **問題**: ky_order_items ↔ ky_menu_items の JOIN に `mi.tenant_id = p_tenant_id` がない → 理論上、他テナントのメニュー ID が明細に混入した場合に他店のバック率が適用される
- **是正（0052）**: JOIN 条件に `and mi.tenant_id = p_tenant_id` 追加（ky_close_order v4 全文再CREATE）
- **実害リスク**: menu_item_id は INSERT 時に存在検証されるため実運用では発生しづらいが、FK が異テナントの品目を拒否しないため理論上可能＝防御的に塞ぐ

### KA-9 [Low] nomination_kind: CHECK 制約なし

- **場所**: `0043_ky_nomination_kinds.sql` L9
- **問題**: nomination_kind は 'honshimei'|'jounai'|null の想定だが CHECK なし → 任意文字列が入り得る（クライアント検証のみ＝bypass可）
- **是正（0052）**: 既存不正値を null に無害化 + `ky_menu_items_nomination_kind_check` CHECK 追加（冪等 DO ブロック）

---

## 2. 設計上の課題（要対応・実装Revで個別対処）

### KA-2 [High] ky-checkout Edge Function: 孤児 Stripe セッション

- **場所**: `supabase/functions/ky-checkout/index.ts`
- **問題**: Stripe `checkout.sessions.create` に無条件で `subscription_data.trial_period_days: 30` が付く（全テナントに毎回30日トライアル発行）。Webhook（checkout.session.completed）が未実装＝支払い完了の反映経路なし → 契約状態がクライアント依存
- **対処方針**: §14 BILLING_DESIGN §17-1 確定済み＝サーバーサイドトライアル（channel='promo'）。ky-checkout は課金ON化時に全面改修（Webhook ky-stripe-webhook 新設 → ky_subscriptions upsert → plan 列サーバー更新）。現在は IAP_ENABLED=false のため未到達経路

### KA-3 [High] §49-1 卓タイマー set_deadline_at: 死に機能

- **場所**: `0042_ky_orders_set_deadline.sql` / `src/features/orders/components/OrderCard.tsx`（存在しないが REVISION_LOG に Rev99/102 で言及）
- **問題**: migration で `ky_orders.set_deadline_at` 列を追加し AdminOrders.tsx に「卓タイマー」として表示する設計だが、**書き込み経路が一切存在しない**（set_deadline_at は常に null）。UI が存在しても機能しないゴースト状態
- **対処方針**: 「孤児実装ゲート」＝実装宣言した機能は呼び出し元 grep で到達確認を必須化。卓タイマーは §49-1 実装Rev で正式に write 経路を実装するか、不要なら列と UI を削除

### KA-4 [Medium] スライド時給 resolveTierRate: 参照ゼロ

- **場所**: `src/features/payroll/` 配下想定（SPEC §49-2）
- **問題**: 0039 で `ky_slide_hourly_tiers` テーブルと `resolveTierRate` 計算ロジックの設計を入れたが、給与計算の呼び出し元（AdminPayroll/payrollCalc）からの参照が0。ky_close_order 等にも組み込まれていない
- **対処方針**: §49-2 実装Rev で payroll 計算に正式統合。現時点では空テーブル＝無害

### KA-6 [Medium] 日報（ky_daily_reports）: 複数問題

- **場所**: `0041_ky_daily_reports.sql` / AdminDailyReports.tsx
- **問題群**:
  1. **FIN-2 違反**: 確定済み日報の事後編集を禁止する仕組みなし（伝票 closed 後に数字を書き換え可能）
  2. **guestCount=伝票数**: 実来客数ではなく closed 伝票数で算出＝グループ来店で過少カウント（仕様か要確認）
  3. **WEB13 違反**: app の autoSales と web の AdminDailyReports で同一データを独立更新する経路が並存＝片方の更新が他方に反映されない可能性
  4. **0041 に金銭 CHECK なし**: total_revenue 等に >=0 制約なし（FIN-1）
- **対処方針**: 日報は「当日の自動集計 snapshot＋オーナーメモ」に役割を再定義し、自動集計部分は ky_close_order v5 の売上 upsert に一本化。事後編集は memo のみ許可。CHECK 制約は次の hardening migration で追加

### KA-10 [Low] skipRecurringMonth: 2ステップクライアント mutation

- **場所**: AdminExpenses.tsx（recurring_expenses の skip 操作）
- **問題**: 月スキップが「flag UPDATE → 当月 expense DELETE」の2ステップをクライアントから逐次実行＝途中失敗で不整合（BE-4 違反）
- **対処方針**: ky_skip_recurring_month RPC 化（1トランザクション）。低優先＝金銭レコードだが実害は「スキップ表示がズレる」程度

### KA-11 [Low] ky-menu-ocr Edge Function: UTC 月キーと画像タイプ固定

- **場所**: `supabase/functions/ky-menu-ocr/index.ts`
- **問題**: 月別使用量キーが UTC 月（JST だと月初数時間ズレ）。Content-Type を `image/png` 固定で送信（JPEG でも png と偽る）
- **対処方針**: JST 月キー化 + request の Content-Type ヘッダから動的取得。低優先（現状実害なし＝ API 側は MIME 無視で判定）

### KA-12 [Low] kinds.ts 死コード + 曜日ハードコード

- **場所**: `src/config/kinds.ts` / シフト表示周り
- **問題**: kinds.ts に未使用 export が複数。曜日表示が i18n(t()) 経由でなく日本語ハードコード（多言語化時に漏れる）
- **対処方針**: dead code 削除 + t('weekdays.mon') 等への置換。G2 i18n ゲートで将来的に検出されるはずだが、現時点は許容

---

## 3. §45 事前設計検証 6 チェックポイント結果

| CP | 項目 | 結果 |
|---|---|---|
| ① | DB migration 十分性 | ✅ 0053 ドラフト作成（ky_customer_accounts / follows / account_id / point_transactions / mobile_order_token / order_items.status / offschedule_nomination / 4 RPC）。§41(b) ky_point_transactions は customer_ref=ky_customers.id で確定。SPEC 記載との乖離なし |
| ② | RPC 設計 | ✅ ky_submit_mobile_order（token検証＋FIN-9サーバー再解決＋レート制限100pending）/ ky_redeem_point_reward（advisory_lock＋残高原子検証）/ ky_attach_customer_by_account（find-or-create＋owner照合）/ ky_issue_mobile_order_token（owner限定） |
| ③ | ロールナビ | ✅ 設計確認: customer BottomTab = ホーム（フォロー店一覧）・オーダー（モバイルオーダー履歴）・ポイント（残高/履歴/景品）・予約（予約一覧・変更）・マイページ（QR会員証/ニックネーム編集/ログアウト/削除）。DEV_ROLE_SWITCHER 開発スイッチで3ロール検証可能（§45-5） |
| ④ | モバイルオーダー UX | ✅ 設計確認: 入口=卓QR(mobile_order_token) → メニュー閲覧 → カート → ky_submit_mobile_order → pending → 店承認 → confirmed → 会計。needs_cast は出勤中キャストから選択。決済なし（FIN-8=資金非預かり維持） |
| ⑤ | 出勤予定外指名 | ✅ SPEC §45-6 新設。accepts_offschedule_nomination＋nomination_type で3段階判定。既存 ky_make_reservation のシフトカバレッジチェックを条件分岐に拡張する設計 |
| ⑥ | サブ分割提案 | ✅ 下記 §19 追記案参照 |

---

## 4. §19 実装順提案（§45 サブ分割）

> SPEC §19 item 51「お客様モード＝大型＝サブ分割して実装」の具体案。

| Sub | 内容 | 依存 | 想定 Rev 数 |
|---|---|---|---|
| **(a) DB 基盤** | migration 0053 適用 + ky_customer_accounts/follows/account_id/point_transactions + mobile_order_token/status 列 + offschedule 列 | 0052 適用済み | 1 |
| **(b) ロール判定＋ナビ** | resolveUserRole に customer 追加 + RoleSelectScreen 3択 + customer BottomTabNavigator 骨格 + DEV_ROLE_SWITCHER | (a) | 2-3 |
| **(c) モバイルオーダー** | ky_issue_mobile_order_token UI（レジ画面卓QR表示）+ お客様側メニュー閲覧→カート→submit + 店側 pending バッジ＋承認/却下 + ky_close_order v5 統合 | (a)(b) | 3-4 |
| **(d) ポイント＋会員QR** | ky_attach_customer_by_account UI（レジQRリーダー）+ ky_close_order のポイント自動付与連携 + お客様側残高/履歴/景品閲覧 + ky_redeem_point_reward UI | (a)(b) | 2-3 |
| **(e) アプリ内予約** | 客 Web 予約ロジック（ky_make_reservation v3）の §45-6 対応 + お客様モード予約画面（PIN不要・アカウント紐付け）+ 予約履歴一覧 | (a)(b) | 2-3 |
| **(f) 出勤シフト閲覧** | フォロー店のシフト公開ビュー＋イベント日表示 | (a)(b) | 1 |

推奨実施順: (a) → (b) → (c) → (d) → (e) → (f)。(c)(d)(e) は相互非依存のため並行可能だが、1人開発のためシリアルが安全。

---

## 5. モジュールカタログ矛盾ノート

- **SPEC §52-2 vs §52-2b vs features.ts**: モジュール名と含まれる機能の境界定義が SPEC 内で揺れている。features.ts の plan 判定は `resolveTierRate`（§50）の `modules` 配列に依存するが、対応表が SPEC に不在
- **対処**: §52 実装Rev で `MODULE_CATALOG` 定数を SPEC §52-2 の表と 1:1 で定義し、features.ts / resolveTierRate / BILLING_DESIGN を三点照合する。現時点は IAP_ENABLED=false のため未影響

---

## 6. §44-3 プリンターウィザード

- **状態**: 未実装（Edge Function `ky-printer-discover` も未作成）
- **§46 との連携ポイント**: HelpChatModal の `context` prop が用意済み＝ウィザード実装時に `context: 'printer-setup: step 3, error: ECONNREFUSED'` 等を渡すだけで FAQ AI に文脈が伝わる
- **実装時の注意**: Expo SDK 54 ではネイティブ TCP 通信に `expo-modules-core` カスタムモジュールが必要（ESC/POS over WiFi）。react-native-thermal-receipt-printer は SDK 54 互換未検証＝事前に pod install テスト推奨
