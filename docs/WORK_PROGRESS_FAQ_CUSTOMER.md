# きゃすりん §46 Q&A AIアシスタント実装＋§45お客様モード事前設計

モデル指定: **Fable（claude-fable-5）** でセッション実行

## 先読み必須

- `SPEC.md` §45, §46
- `AGENTS.md`
- memory: `project_kyasuho.md`, `project_kyasuho_competitor_pricing.md`

---

## ① §46 Q&A AIアシスタント＝3層アーキテクチャで実装

### アーキテクチャ（2026-07-12ユーザー決定）

| 層 | 処理 | モデル/手段 | コスト |
|---|---|---|---|
| 第1層: 事前FAQ照合 | 高品質Q&Aペアに近い質問→そのまま返す | 類似度検索（埋め込みベクトル or キーワード） | ≈ ¥0 |
| 第2層: Sonnet生成 | 第1層ヒットなし→静的ナレッジから回答生成 | Claude Sonnet（最新・ランタイム） | ≈ ¥1〜3 |
| 第3層: Web検索 | きゃすりん関連だがナレッジ外→ネット検索して回答 | Sonnet + Web検索API（ランタイム） | ≈ ¥3〜10 |

**事前FAQ生成はFable（本セッション）で行う**。ランタイム（デプロイ後の実行時）はSonnet。

### 実装タスク

1. **事前FAQ生成（Fableで実行）**
   - SPEC.md全体 + 価格表(project_kyasuho_competitor_pricing.md) + 機能一覧を入力
   - ロール別（owner/cast/customer）で想定Q&A 150〜200問を生成
   - 出力形式: JSON `[{question, answer, role, tags}]`
   - カバー範囲: 機能の使い方 / 料金・プラン / トラブルシューティング / プリンター設定 / 確定申告補助の注意点 / お客様モードの使い方
   - 保存先: `docs/faq_knowledge.json`（Edge Functionにバンドル）
   - ★Fableの高い推論能力で、ユーザーが実際に聞きそうな自然な言い回し・曖昧な質問・言い換えバリエーションも含める

2. **Edge Function `ky-faq-ai` 新設**
   - 入力: `{question, role: 'owner'|'cast'|'customer', history: [{role,content}], context?: string}`
   - 第1層: FAQ JSONからコサイン類似度 or BM25で上位3件取得→閾値超えなら最適回答を返す
   - 第2層: ナレッジ（SPEC要約+FAQ全文）をsystemに入れてSonnet生成。プロンプトキャッシュ（cache_control）をナレッジ部に付与
   - 第3層: Sonnetが「知識外だがきゃすりん関連」と判断→Web検索→結果を元に回答生成
   - **ランタイムモデル: Claude Sonnet（claude-sonnet-5）**
   - スコープガード: §46-2の3層（プロンプト→モデル→サーバー）。無関係質問は定型拒否
   - レート制限: user_id毎 20回/日（SEC-5同型）
   - ログ: `ky_faq_logs`（question, answer, role, layer_used, created_at）
   - APIキー: ANTHROPIC_API_KEY = Edge Function Secret（既存ocr-proxyと同運用・R13）

3. **migration新設**
   - `ky_faq_logs` テーブル
   - RLS: service_role のみ INSERT（Edge Function経由）、owner は自テナントのログ閲覧可（品質監視用）

4. **UI: ヘルプチャットモーダル**
   - アプリ: 設定→ヘルプ「AIアシスタントに質問」＝FormModalShell + KeyboardDoneBar
   - 管理Web: ヘルプページに同型チャットUI
   - 文脈付き起動対応: `{context: string}` プロップで呼び出し元画面の情報を初回メッセージに添付
   - 回答フッター固定注記:「AIによる自動回答です。解決しない場合はお問い合わせへ」+ ContactFormModal導線
   - 履歴は端末セッション内のみ（サーバー保存しない）
   - お客様モード（§45実装後）にも同UI提供（customerナレッジ）

### 守るライン
- ANTHROPIC_API_KEYをチャットに出さない
- SEC-5レート制限パターン流用
- FIN思想: AI回答に金銭アドバイスを含めない（「税務助言はしません」注記）
- プロンプトインジェクション対策: user入力はuserロールのみ・system混入禁止

---

## ② §45 お客様モード＋モバイルオーダー 事前設計チェック（Fableで設計）

§45はMVP必須（2026-07-12ユーザー確定）。SPEC §45の設計で実装に入れる状態かをFableで検証し、不足があれば設計を補完する。

### 確認ポイント

1. **DB migration設計の十分性**
   - ky_customer_accounts / ky_customer_follows / ky_customers.account_id / ky_orders.mobile_order_token / ky_order_items.status の各列・制約・RLS
   - §41 ky_point_settings / ky_point_rewards / ky_point_transactions の結合

2. **RPC設計**
   - `ky_submit_mobile_order`（SECURITY DEFINER・token検証・search_path固定）
   - ポイント付与/使用のatomic RPC
   - 会員QR読取り→customer_id紐付けRPC

3. **ロール切替のナビゲーション構造**
   - RoleSelectScreen拡張（3択: オーナー/キャスト/お客様）
   - resolveUserRole拡張（owner→cast→customer→none）
   - お客様用BottomTab構成: ホーム(フォロー店一覧) / オーダー / ポイント / 予約 / マイページ
   - 開発用ロール切替（§45-5: __DEV__ && features.DEV_ROLE_SWITCHER）

4. **モバイルオーダーのUI/UXフロー**
   - 卓QR生成（伝票オープン時にtoken発行→QRコード表示）
   - お客様側: QRスキャン→メニュー閲覧→カート→送信→pending
   - 店側: 通知バッジ→承認/却下→confirmed/rejected→在庫連動(§47)

5. **出勤予定外キャストへの指名希望（2026-07-12新仕様）**
   - 客Webに予定外キャストも「出勤予定外」として表示
   - キャスト設定: `ky_casts.accepts_offschedule_nomination`（ON/OFF・本人制御・既定OFF）
   - フロー: 客が希望→キャストアプリへプッシュ通知→承諾でky_shifts自動追加 / 辞退でお客さんに通知（客Web予約確認ページ表示。§45実装後はプッシュも追加）
   - 予約テーブルに「確定指名 vs 出勤希望（pending_cast_confirmation）」の区別が必要

6. **サブ分割計画**（SPECに「大型＝サブ分割して実装」と記載あり）
   - 推奨分割案を出す: (a)ロール基盤+フォロー (b)モバイルオーダー (c)ポイント+会員証 (d)予約アカウント紐付け

### 成果物
- 不足があればSPEC §45へ追記（設計補完）
- migration SQLドラフト（`supabase/migrations/` に配置）
- サブ分割の実装順序案をSPEC §19へ追記提案
- 出勤予定外指名希望のDB/RPC/通知設計をSPECへ新節として追記

---

## ③ Fableによる批判的設計レビュー（各領域を検証し、穴があればSPECに補完追記）

### A. トライアル終了→ロックの移行UX（未設計の穴）

トライアル終了時に店がアクティブに使用中（予約あり・シフト登録済み・open伝票あり）の場合の挙動が未定義。

検証ポイント:
- open中の伝票（会計途中）はどうなるか？ 会計完了だけは許可すべきか？
- 既に入っている将来の予約はどうなるか？ 客側に見えるか？ キャンセル扱いか？
- シフト表（既に画像生成済み）の閲覧は？ SNS投稿済みのURLは？
- 「履歴閲覧のみ」の具体的な境界線をUI単位で定義（どのボタンがdisabledになるか）
- 復帰時のUX: 課金再開したら即座に全機能戻るか？ データロストはないか？
- チャーン防止: ロック前の猶予通知（残7日/3日/1日）の設計

### B. お客様モードのRLSセキュリティ（3ロール化の攻撃面）

既存2ロール（owner/cast）に customer を追加する際のセキュリティ検証:

- customer が他の customer のデータを読めないことの保証（ky_customer_follows / ky_point_transactions のRLS）
- customer → owner/cast へのロールエスカレーション不可の検証（resolveUserRole の判定順が鍵）
- `mobile_order_token` のブルートフォース耐性（トークン長・有効期限・試行レート制限）
- QRトークンのライフサイクル（生成→伝票クローズで失効）に隙間がないか
- customer が `ky_submit_mobile_order` 以外の経路でorder_itemsを操作できないことの検証
- アカウント削除（5.1.1(v)）のカスケードが customer にも正しく効くか

### C. 出勤予定外指名と既存サーバー検証（§35-2）の整合性

Rev81で実装済みの `cast_not_available` 検証との衝突確認:
- 現行: RPC内で「出勤枠にスロット全体が収まるか」検証→収まらなければエラー
- 新仕様: 出勤外キャストへの「希望」は通す必要がある
- 矛盾: 出勤外指名希望は既存検証に引っかかる→新しいフラグ or 別経路が必要
- 予約テーブルに `nomination_type: 'confirmed' | 'offschedule_request'` を持たせ、request は検証スキップにするか、別RPC（`ky_request_offschedule_nomination`）にするか
- キャスト承諾→shifts追加→その時点で予約の nomination_type を confirmed に昇格する流れの設計

### D. Edge Function コスト暴走防止（全体設計）

現在5本のEdge Functionが稼働予定（ocr-proxy / ky-receipt-ocr / ky-faq-ai / ky-menu-ocr / daipos-generate）。

検証ポイント:
- user_id単位のレート制限は各々にあるが、tenant単位の月間上限は？
- バグでループ呼出しした場合のサーキットブレーカーの有無
- 全Edge Function横断でのANTHROPIC_API_KEY利用量のモニタリング手段
- Supabase Edge Functionの実行時間制限（150秒）に対して、Web検索付きQ&A AIが収まるかの検証
- 月間APIコスト上限アラートの仕組み（Anthropic Usage APIまたは自前計測）

### E. Supabase専用プロジェクト分離の実行計画検証

「本番前に必ず分離」の具体的な移行手順のリスク確認:
- pg_dump で `ky_*` テーブルのみ抽出→新プロジェクトへ流し込みの手順
- Edge Function の再デプロイ（Secret含む）
- クライアント側 .env の切替（anonKey / URL 変更）
- ゼロダウンタイムは可能か？ テスト段階なので短時間停止で良いか？
- RLS ポリシー・pg_cron・Realtime subscription の移行漏れチェックリスト
- concafe-yoyaku側に残る不要な `ky_*` テーブルの掃除

### F. §38 シフトリマインダー通知のcron基盤

SPEC §38で「Scheduled Edge Function」が必要:
- Supabase Free プランに pg_cron はない（Pro以上）
- 代替手段: GitHub Actions cron / Supabase Edge Function + 外部cron (cron-job.org) / Supabase Database Webhooks
- 専用プロジェクト分離後の Pro 切替時期との兼ね合い
- 分離前でもリマインダーを動かせる設計にするか、分離後まで待つか

### ③の成果物
- 各領域で発見した穴・矛盾をSPECの該当§へ補完追記
- 特にC（出勤予定外×既存検証の矛盾）は実装設計として解決案をSPECに明記
- D（コスト暴走）は全Edge Function横断のレート制限設計をdocs/に新設
- 発見事項の一覧サマリをSPEC §6（未確定事項）に反映
