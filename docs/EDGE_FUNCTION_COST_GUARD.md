# Edge Function コストガード設計（横断）

> 2026-07-12 批判的検証で新設。きゃすりんの全 Edge Function のコスト構造・レート制限・暴走防止策を横断で整理し、運用判断の根拠とする。

---

## 一覧

| Function | API呼び出し | 単価目安(/回) | レート制限 | 暴走時最大コスト(/日) |
|---|---|---|---|---|
| **ky-faq-ai** | Claude Sonnet 5 + web_search | ¥0-10 (Layer 1=¥0) | 20回/user/日 + 500回/global/日 | ¥5,000 (500×¥10) |
| **ky-menu-ocr** | Claude (Vision) | ¥5-15 | 月50回/tenant (plan別上限) | N/A (月次制限) |
| **ky-receipt-ocr** | Claude (Vision) via ocr-proxy | ¥3-8 | ocr-proxy 共有: 月次plan上限 | N/A |
| **ocr-proxy** | Claude (Vision) | ¥3-8 | とれはんっ！用: 月50/300/∞ (plan別) | N/A |
| **ky-shift-design** | Claude (テキスト生成) | ¥2-5 | 月20回/tenant (plan別) | N/A |
| **ky-checkout** | Stripe API (無課金) | ¥0 | なし（IAP_ENABLED=false） | ¥0 |

---

## コスト暴走防止の共通パターン

### 1. reserve-slot 方式（ky-faq-ai で実証済み）

```
-- テーブル: ky_faq_slots (user_id, date, used_count)
-- RPC: reserve_ky_faq_slot
--   increment-then-check: used_count += 1 → 超過なら raise exception
--   INSERT ON CONFLICT DO UPDATE = 行ロック不要で原子的
-- global行: user_id = '__global__' で全体上限を監視
```

**利点**: DB行ロック不要・並行安全・cron不要（日付キーで自然リセット）
**適用推奨**: 全 AI 系 Edge Function に同型を導入

### 2. plan別月次上限方式（ky-menu-ocr / ky-shift-design で使用中）

```
-- テーブル: ky_ai_usage (tenant_id, function_name, month_key, used_count)
-- Edge Function 内: SELECT → plan上限照合 → 超過なら 429 返却 → INSERT/UPDATE
```

**注意**: month_key は **JST基準** (`YYYY-MM` at Asia/Tokyo) で発行すること（KA-11: UTC だと月初数時間ズレる）

### 3. 未実装だが必要な制限

| Function | 現状 | 推奨 |
|---|---|---|
| ky-checkout | レート制限なし | IAP ON化時に Stripe session 作成を tenant毎 10回/時 に制限（create → webhook の間に abandon されたセッションの蓄積防止） |
| ky-faq-ai (customer) | owner と同一上限 | §45 お客様モード実装時に customer ロールは **10回/日** に引下げ（ownerより FAQ 依存度が低い＋abuse リスクが高い） |

---

## Supabase Free プラン制約

- **Edge Function 呼び出し**: 500,000回/月（Free）。きゃすりん単独では十分だが相乗り運用（concafe-yoyaku + とれはんっ！の ocr-proxy）を加味すると余裕は 2-3x 程度
- **DB接続**: 60同時接続（Free）。Edge Function は connection pooler (transaction mode) 経由のため 1 Function = 1 接続で短寿命＝問題なし
- **Secret**: 無制限。ANTHROPIC_API_KEY は全 AI 系 Function で共用（1つの Secret）
- **pg_cron**: Free プランでは**利用不可**。日次リセットや定期集計は Edge Function + cron ジョブ（外部: GitHub Actions or Supabase Management API の schedule）で代替する必要がある＝ §38 cron基盤の設計制約

---

## 監視・アラート（将来）

- `ky_faq_logs` / `ky_ai_usage` の日次集計で異常検知（例: 1テナントが上限の80%到達で Slack 通知）
- Supabase Dashboard の Function Invocations グラフで目視監視
- 本番分離（専用プロジェクト移行）後は Usage API で programmatic に取得可能

---

## Supabase 分離実行計画（レビュー E）

> 現在 concafe-yoyaku（ref=rhmuitgbvilqwdevxxox）に `ky_*` プレフィックスで相乗り中。本番リリース前に専用プロジェクトへ分離必須。

### 手順

1. Supabase Dashboard で新プロジェクト作成（Tokyo リージョン・Free → Pro アップグレード予定）
2. 全 migration (0001-0053) を新プロジェクトに `supabase db push` で適用
3. Edge Function 全5本をデプロイ（Secrets: ANTHROPIC_API_KEY 設定）
4. `.env` / `app.json` の SUPABASE_URL / SUPABASE_ANON_KEY を新プロジェクトに差替え
5. EAS 環境変数（EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY）を更新
6. 管理Web のデプロイ環境変数（GitHub Pages の .env 生成 Action）を更新
7. Storage バケット（ky-cast-photos / ky-receipts / ky-shift-backgrounds）を新プロジェクトに作成
8. Auth 設定（Email provider ON / Redirect URL / Rate limit）を移植
9. 動作検証: アプリ + 管理Web + 客Web の三面で予約→会計フロー通過確認
10. 旧プロジェクトの `ky_*` テーブル・Function は**削除しない**（とれはんっ！の ocr-proxy 等が同居しているため。ky_* のみ DROP するスクリプトを用意して凍結期間後に実行）

### タイミング

- App Store 初回審査提出**前**に完了必須（審査中に相乗り先の変更が入ると不整合リスク）
- Free プラン制約（pg_cron なし・Edge 500K/月）は初期運用で問題ないが、テナント数 10 超で Pro 検討

---

## レビュー F: §38 cron 基盤（Free プランの制約）

- **問題**: SPEC §38 で予定していた DB 内定期ジョブ（予約リマインダー送信・解禁時刻処理・日次集計）は pg_cron 依存＝Supabase Free プランでは利用不可
- **代替案**:
  1. **GitHub Actions cron** → Edge Function を HTTP 呼び出し（現行 keepalive.yml と同パターン）。課金なし・精度は分単位
  2. **Supabase Management API の scheduled function**（Beta・2026年現在 Pro 以上）
  3. **クライアント発火**: アプリ起動時/バックグラウンド復帰時に「自分の店の解禁処理」を呼ぶ（リアルタイム性不要なら十分）
- **推奨**: 解禁時刻処理 = クライアント発火（§2 unlock_windows は客Web アクセス時に評価＝既に実装済み）。リマインダー = GitHub Actions cron（1時間毎）→ Edge Function `ky-send-reminders`（未実装）。日次集計 = ky_close_order 内で完結（AUD-4 で解決済み）
