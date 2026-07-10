# きゃすりん 課金・決済チャネル拡張 事前設計書（BILLING_DESIGN）

**作成日**: 2026-07-10（Rev68・設計のみ＝実装なし）／**追補**: 2026-07-10（Rev69・第2部 §15〜§18＝モジュール選択型課金・長期契約割引・クーポン）
**目的**: 従来の Apple IAP サブスクに加え、**クレジットカード決済（Web直販）** と **銀行振込（請求書払い）** でのサービス販売を実現するための事前設計。
**第2部（§15〜§18）**: ①店舗が機能（モジュール）を自由に選択し個数で料金が決まるアラカルト課金 ②半年/年契約の長期割引 ③チラシ配布用クーポンコードによるトライアル延長（1ヶ月→2ヶ月）——競合（Dシステム等の全部入り固定価格）との明確な差別化戦略（2026-07-10 ユーザー決定）。
**位置づけ**: SPEC §14（課金境界・IAP）と §33（金融・セキュリティ FIN-1〜8）の**下位詳細設計**。矛盾したら SPEC が勝つ。saas_init_playbook の FIN-1〜8／SEC-1〜14 に準拠。

> ⚠️ 本書は「金融に関わる設計」のため、実装時は各節の【実装時ゲート】を必ず通すこと。
> ⚠️ 価格の実額・料率はすべて**ユーザー決定ゲート**（§13 未決事項一覧）。本書は構造のみ確定する。

---

## 1. 販売チャネル全体像

| チャネル | 対象 | 決済手段 | 課金周期 | 手数料（実測/公表） | 導入フェーズ |
|---|---|---|---|---|---|
| **A. Apple IAP** | iOSアプリ利用者 | App Store 決済 | 月/半年/年（自動更新・§16） | 15%（Small Business Program） | §14 既定・IAP ON 時 |
| **B. Google Play Billing** | Androidアプリ利用者 | Play 決済 | 月/半年/年（自動更新・§16） | 15%（同上） | Android 出荷時 |
| **C. Stripe カード決済** | 管理Web（PC）利用者 | クレジットカード | 月/半年/年（自動更新・§16） | 3.6% | BILL-2 |
| **D. 銀行振込（請求書払い）** | 法人・振込希望店舗 | 銀行振込（Stripe バーチャル口座） | **半年 or 年払いの一括前受けのみ**（§16で月払い除外を維持） | 1.5% | BILL-3 |

> 【Rev69 追補】料金は「固定プラン」ではなく**選択モジュール個数×契約期間**で決まる（§15・§16）。

### チャネル設計の3原則

1. **エンティトルメント単一源泉**: どのチャネルで買っても権利は `ky_tenants.plan` 1箇所（SPEC §14「三面共有」不変）。チャネルは「入口」であり「権利」ではない。
2. **1テナント1アクティブサブスク**: 同時に課金される販売契約は常に1つ（§8 二重課金防止）。
3. **資金非預かり・カード情報非保持**: きゃすりんのサーバー/DBはカード番号・口座番号に一切触れない（§33-4・割販法改正のカード情報非保持化義務・PCI DSS SAQ A 範囲）。

### 銀行振込を「年払いのみ」とする理由

- 月払い×振込は店舗側の毎月振込負担＋未入金リスク＋消込コストが月次で発生し、SaaSの少額月額（¥2,000前後想定）に対して割に合わない。
- 年払い一括なら「入金確認 → 1年分の権利付与」の単純な前受けモデルになり、与信リスクがゼロになる（未入金＝未提供）。
- 業界定石（freee/マネーフォワード等の請求書払いも年払い前提）。

---

## 2. 法規制・コンプライアンス整理

### 2-1. 資金決済法 — **非該当（の整理）だが弁護士確認に追加**

- 本設計は**自社役務（きゃすりんプロ）の対価を直接受領する**だけ＝第三者間の資金移動・収納代行・前払式支払手段の発行のいずれにも該当しない、というのが一般的な整理。
- 年払いの前受けも「役務提供対価の前受金」であり、前払式支払手段（汎用的に代価弁済へ充当できる記録）には当たらない。
- **ただし将来「ポイント」「クレジット（AI利用回数チャージ等）」を発行した瞬間に前払式支払手段の再判定が必要**。本設計ではポイント制を採用しない。
- 【実装時ゲート】弁護士確認❷（SPEC §6）のスコープに「B2B直販（カード/振込）の建て付け確認」を1項目追加する。客側決済（§33-4 Phase D）とは別論点なので混同しない。

### 2-2. 特定商取引法 — 通信販売表記が必要

- Web直販は「通信販売」に該当。**特商法に基づく表記ページ**を管理Web（購入導線のあるサイト）に設置する:
  事業者名／所在地／電話番号／代金（税込）／支払時期・方法／役務提供時期／解約条件（自動更新の明示・更新前解約方法）／返品特約。
- 販売先は事業者（店舗）だが、個人事業主の店舗オーナーが混在しうるため**消費者向け表記と同水準で整備する**のが安全。
- 個人開発者の住所・電話公開の負担 → 「請求があったら遅滞なく開示する」方式の可否や、バーチャルオフィス利用は**ユーザー決定ゲート**（§13）。連絡先メールは R17（rurifukuro@gmail.com）。
- **自動更新サブスクの申込最終確認画面**に、①分量（プラン内容）②期間（更新周期）③金額（更新後含む）④解約方法 を明示（2022年改正特商法の最終確認画面義務）。Stripe Checkout の標準画面＋独自の確認文言で満たす。

### 2-3. 割賦販売法 — カード情報非保持化

- 2018年改正でカード番号等の**非保持化**（または PCI DSS 準拠）が加盟店義務。
- 対応方針: **Stripe Checkout（Stripeホスト画面）を第一候補**とし、カード情報はきゃすりんのフロント/サーバー/DBを一切経由させない → PCI DSS **SAQ A** 範囲に収まる。自前フォーム＋Elements 直埋めは採らない（SAQ A-EP に格上がりするため）。

### 2-4. 消費税・インボイス制度

- 販売先は事業者（店舗）＝**適格請求書（インボイス）を求められる可能性が高い**。
- ユーザー（テイトさん）は個人事業主登録がこれから（[[project_subsidy_roadmap]]）→ **インボイス発行事業者登録の要否はユーザー決定ゲート**。免税事業者のまま売る場合、店舗側は仕入税額控除が制限される（2026年10月以降は経過措置50%）＝営業上の不利になりうる点を判断材料として明記。
- 登録する場合: Stripe Invoicing / 領収書に**登録番号・税率・税額**を記載（Stripe の請求書設定でフッター/フィールド対応可）。
- 価格表示は税込を基本とする（総額表示義務は消費者向けだが統一する）。

### 2-5. 景品表示法

- 無料トライアル・年払い割引の表示は有利誤認に注意: 「初月無料（2ヶ月目から¥X,XXX/月・いつでも解約可）」のように条件を近接表示。
- 二重価格（「通常¥X→今だけ¥Y」）は根拠のある比照価格以外使わない。

### 2-6. スマホ新法（2025-12-18 全面施行）と Apple 規約 — Web販売との併存

2026-07-10 時点の調査結果（実装時に最新版を必ず再確認＝【実装時ゲート】）:

| 手段 | Apple手数料 | 備考 |
|---|---|---|
| アプリ内 IAP | 15%（Small Business） | 従来どおり |
| アプリ内から**外部リンク**（リンクアウト）でWeb決済へ誘導 | 標準15%・**Small Business は10%**（＝きゃすりんは10%）。対象は**リンクタップから7日以内**の売上 | スマホ新法対応で日本では可能に。iOS 26.2+ ターゲット＋最新ライセンス同意（2026-03-17 期限）＋エンタイトルメント申請＋開示モーダル＋月次取引報告が必要 |
| アプリ内の**リンクなしテキスト誘導**（「『きゃすりん Web』で検索」と書くだけ） | **実質0%** | タップが存在しない＝追跡対象売上が発生しない。out-of-app offer は「actionable link の有無にかかわらず」許可（Apple公式・2026-07-10確認） |
| アプリ内に**QRコード**を表示 | **不明確＝採用しない**（保守判定） | 公式文書にQR言及なし。iOSは画像内QRをリンクとして開ける＝actionable link 同等判定→無申請リンクアウト扱いのリスク。詳細と代替＝**§17-5** |
| アプリ外（Webで完結する販売・チラシ/POP/LPのQRコード） | 0% | 従来から適法。Webで買った権利をアプリで使うのは規約上問題なし（Slack/Netflix型）。**QRコードはアプリ外でのみ全面活用** |

**設計方針**:
1. **第一段階はリンクアウトを使わない**。アプリ内には「テキスト誘導（0%）」のみ置き、Web直販は管理Web上の導線で完結させる。手数料ゼロで併存でき、エンタイトルメント申請・警告シート実装等の追加コストも不要。
2. リンクアウト（15%）は「テキスト誘導では発見性が足りない」と分かってから費用対効果で後決め（ユーザー判断）。
3. IAP は iOS ユーザーの購入体験として**廃止しない**（併売）。
4. SPEC §14 の旧記述「Appleアプリ内からWeb決済への誘導はNG」は、スマホ新法対応後の日本では**テキスト誘導0%・リンクアウト15%で可**に更新される（本書が最新の整理）。

### 2-7. 契約・規約

- 利用規約に課金条項を追加: 料金・支払方法（IAP/カード/振込）・自動更新と解約・未入金時のサービス停止・返金ポリシー（原則日割返金なし、チャネル元の規定に従う）・プラン変更の適用時期。
- B2B前提の表明保証（SPEC §16）と整合させる。

---

## 3. 決済プロバイダ選定 — **Stripe を正式採用（推奨）**

| 観点 | Stripe | PAY.JP | GMOペイメントゲートウェイ | Square |
|---|---|---|---|---|
| カードサブスク | ◎ Billing 完備 | ◯ 定期課金あり | ◯（審査重め） | △ |
| **銀行振込＋自動消込** | ◎ **日本開発のバーチャル口座機能・顧客別口座・自動消込・過不足繰越** | ✗ | ◯（別サービス） | ✗ |
| 請求書発行（Invoicing） | ◎ hosted invoice・適格請求書対応 | ✗ | △ | △ |
| 将来の客側決済（§33-4 Connect Direct charges） | ◎ 同一基盤で拡張可 | ✗ | △ | △ |
| Webhook/API 品質・冪等サポート | ◎ | ◯ | △ | ◯ |
| 手数料 | カード3.6%／振込1.5% | 3.0%〜 | 個別見積 | 3.6% |

**決定理由**: 本件の要件「カード＋銀行振込＋請求書＋将来の Connect」を1プラットフォームで満たすのは Stripe のみ。SPEC §33-4 が既に Stripe Connect を第一候補に指名しており基盤が統一できる。PAY.JP のカード手数料は安いが振込・請求書がなく、2プロバイダ運用は消込・監査・鍵管理が二重になるため不採用。

- 利用プロダクト: **Stripe Billing**（サブスク管理）＋ **Stripe Checkout**（カード入力画面・非保持化）＋ **Stripe Invoicing**（請求書・銀行振込）＋ **Customer Portal**（カード変更・解約セルフサービス）＋（任意）**Stripe Tax**。
- 【実装時ゲート】Stripe アカウント開設・本人確認・銀行口座登録は**ユーザー本人の操作**（アカウント作成・金融情報入力は私は実施できない）。名義は開業届後の屋号/個人名義で、メールは瑠璃フクロウ（rurifukuro@gmail.com）を推奨（[[ref_developer_accounts]] 準拠・最終決定はユーザー）。

---

## 4. エンティトルメント・アーキテクチャ

```
[Apple IAP]──App Store Server Notifications V2──▶ ky-apple-notify ─┐
[Apple IAP]──アプリ内購入→レシート──────────────▶ ky-iap-verify ──┤
[Google Play]──RTDN(Pub/Sub→HTTPS)※Android時───▶ ky-play-notify ──┤        service_role のみ
[Stripe カード/振込]──Webhook──────────────────▶ ky-stripe-webhook ┼─▶ ky_billing_subscriptions
                                                                    │      （チャネル横断の契約台帳）
                                                                    └─▶ recompute_tenant_plan(tenant_id)
                                                                              │ service_role UPDATE
                                                                              ▼
                                                                     ky_tenants.plan ('free'/'pro')
                                                                              │ 参照のみ
                                                       ┌──────────┬──────────┴─────────┐
                                                     アプリ      管理Web              客Web(バッジ)
```

**核心ルール（既存 FIN-4 の上に成立）**:
- `ky_tenants.plan` を書けるのは **service_role のみ**（migration 0031 の BEFORE UPDATE トリガーで既に強制済み・Rev65）。
- plan は**手で書く値ではなく、`ky_billing_subscriptions` から導出される計算結果**。全チャネルのイベントは「契約台帳を更新 → `recompute_tenant_plan()` を呼ぶ」の2段構成に統一し、チャネル固有ロジックが plan を直接触らない。
- クライアント（アプリ/管理Web）は plan を**読むだけ**。購入完了画面も「plan が 'pro' に変わったこと」をポーリング/Realtimeで確認して表示する（自己申告での即時アンロックをしない）。

---

## 5. DB設計（migration 追加分・全テーブル `ky_` プレフィックス）

### 5-1. `ky_billing_subscriptions` — チャネル横断の契約台帳（本設計の中心）

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK→ky_tenants | |
| channel | text CHECK IN ('apple_iap','google_play','stripe_card','bank_transfer') | 販売チャネル |
| external_id | text | Apple=originalTransactionId／Stripe=subscription id（`sub_…`）／振込=Stripe subscription id または invoice id |
| product_id | text | 'kyasuho_pro_monthly'／'kyasuho_pro_yearly'（IAP SKU と Stripe Price をこの論理IDに正規化） |
| status | text CHECK IN ('trialing','active','past_due','canceled','expired','incomplete') | §6 状態機械 |
| current_period_start / current_period_end | timestamptz | 権利の有効期間。**plan導出はこの期間と status だけを見る** |
| cancel_at_period_end | boolean | 期間末解約予約 |
| trial_end | timestamptz null | |
| grace_until | timestamptz null | 決済失敗時の猶予期限（§6-3） |
| metadata | jsonb | チャネル固有情報（stripe_customer_id, latest_invoice 等） |
| created_at / updated_at | timestamptz | |

**制約**:
- `UNIQUE (channel, external_id)` — 同一外部契約の二重登録防止。
- **部分ユニーク**: `CREATE UNIQUE INDEX ... ON ky_billing_subscriptions (tenant_id) WHERE status IN ('trialing','active','past_due','incomplete')` — **1テナント1アクティブ契約**をDBレベルで強制（§8）。
- 金銭・期間の整合: `current_period_end > current_period_start` CHECK（FIN-1 金銭CHECK制約の流儀）。

**RLS**: オーナーは自テナント行の **SELECT のみ**。INSERT/UPDATE/DELETE は **service_role のみ**（Webhook/検証 Edge Function 経由に限定）。FIN-6 監査ログトリガー対象に追加。

### 5-2. `ky_billing_customers` — Stripe 顧客の対応表

| 列 | 型 | 説明 |
|---|---|---|
| tenant_id | uuid PK FK | 1テナント1 Stripe Customer |
| stripe_customer_id | text UNIQUE | `cus_…` |
| billing_email / billing_name | text | 請求書宛先（店舗の請求先情報） |
| invoice_registration_no | text null | 先方から求められた場合の当方適格請求書番号の記載制御用フラグ等 |

RLS: オーナー SELECT＋請求先情報のみ UPDATE 可（stripe_customer_id は service_role のみ）。

### 5-3. `ky_payment_events` — Webhook 冪等台帳（全プロバイダ共通）

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| provider | text CHECK IN ('stripe','apple','google') | |
| event_id | text | Stripe=event.id／Apple=notificationUUID／Google=messageId |
| event_type | text | 例: invoice.paid, DID_RENEW |
| payload | jsonb | 生イベント（検証済のもの） |
| status | text CHECK IN ('processed','skipped','error') | |
| error | text null | |
| created_at | timestamptz | |

**制約**: `UNIQUE (provider, event_id)` — **INSERT が衝突したら処理済み＝即200を返して終了**（冪等の要）。RLS: service_role のみ（オーナーにも見せない）。

### 5-4. `ky_billing_invoices` — 請求書（振込・年払い）のローカル写し

Stripe Invoicing が正だが、監査・画面表示・未入金督促のためローカルに同期する。

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | |
| stripe_invoice_id | text UNIQUE | `in_…` |
| subscription_id | uuid FK→ky_billing_subscriptions null | |
| amount_total / currency | integer, text('jpy') | **金額はStripeからの同期値のみ**（クライアント入力禁止） |
| due_date | timestamptz | 支払期限 |
| status | text CHECK IN ('open','paid','void','uncollectible') | |
| paid_at | timestamptz null | |
| hosted_invoice_url | text | 店舗に渡す請求書URL（振込先バーチャル口座記載） |

RLS: オーナー SELECT のみ。書込は service_role のみ。`amount_total >= 0` CHECK（FIN-1）。

### 5-5. RPC: `recompute_tenant_plan(p_tenant_id uuid)`

- SECURITY DEFINER・`SET search_path = public, pg_temp` 固定（SEC-3）・**EXECUTE 権限は service_role のみ**（anon/authenticated には付与しない＝[[supabase_edge_function_rpc_grant]] の逆パターンに注意: `revoke from public` 後に service_role へ明示 grant）。
- ロジック: `ky_billing_subscriptions` に `status IN ('trialing','active') OR (status='past_due' AND grace_until > now())` かつ `current_period_end > now()` の行が1つでもあれば `plan='pro'`、なければ `plan='free'`。
- FIN-4 トリガーとの整合: plan トリガーは「service_role 以外の変更を拒否」なので、この RPC（service_role 実行）は通る。
- 呼び出し元: 各 Webhook 処理の末尾＋日次バッチ（§7-4 期限切れ掃除）。

### 5-6. 既存テーブルへの影響

- `ky_tenants.plan` — 変更なし（'free'/'pro' の2値のまま）。
- FIN-6 `ky_audit_log` の対象に `ky_billing_subscriptions` / `ky_billing_invoices` / plan 変更を追加。
- migration は saas_init_playbook の運用（repair→db push・WEB7 本番適用は SQL Editor→REST再検証）。

---

## 6. サブスク統一状態機械

### 6-1. 状態遷移図

```
（申込）
   │  カード: Checkout完了          振込: 請求書発行
   ▼                                    ▼
trialing ──trial満了・決済成功──▶ active ◀──入金確認(invoice.paid)── incomplete(open請求書)
   │                                │ ▲                                   │
   │trial中に解約                    │ │更新決済成功(DID_RENEW/invoice.paid) │期限超過→void
   ▼                                ▼ │                                   ▼
canceled(期間末まで権利あり)      past_due(grace_until まで権利維持)      expired(権利なし)
   │期間満了                         │grace超過・回収不能
   ▼                                ▼
expired ──────────────────▶ plan='free' へ降格（recompute）
```

### 6-2. チャネル別イベント → 統一状態マッピング

| 統一状態 | Apple（Server Notifications V2） | Stripe カード | 銀行振込（Stripe Invoicing） |
|---|---|---|---|
| trialing | SUBSCRIBED (offerType=trial) | customer.subscription.updated (status=trialing) | （振込にトライアルは設けない） |
| active | SUBSCRIBED / DID_RENEW | invoice.paid / subscription.updated (active) | invoice.paid（自動消込） |
| past_due | DID_FAIL_TO_RENEW (+GRACE_PERIOD) | invoice.payment_failed (Smart Retries中) | （なし・incomplete→expired 直行） |
| canceled | DID_CHANGE_RENEWAL_STATUS (autoRenew=off) | subscription.updated (cancel_at_period_end=true) | 次年度請求書を発行しない |
| expired | EXPIRED | customer.subscription.deleted | 請求書 void / uncollectible |
| 返金 | REFUND → 即時 expired ＋監査ログ | charge.refunded → 運用判断（§11） | refund（¥250/件）→ 同左 |

### 6-3. 猶予期間（grace）ポリシー

- **Apple**: ASC の Billing Grace Period を **ON（16日）** に設定。grace 中は `grace_until` を立てて権利維持（解約率対策の定石）。
- **Stripe カード**: Smart Retries（自動リトライ・既定は約3週間）を有効化し、リトライ中は past_due で権利維持。全滅で `subscription.deleted` → expired。
- **銀行振込**: 前受けモデルのため grace 概念なし。**入金確認まで権利を付与しない**（新規）。更新時は期限14日前に請求書送付→期限超過7日でリマインド→30日で void（数値はユーザー決定ゲート）。更新入金が遅れた場合のみ、旧期間末から最大7日の猶予を運用で許容（設定値化）。

---

## 7. チャネル別詳細フロー

### 7-1. Apple IAP（既存 §14 + FIN-5 の具体化）

1. アプリ内 `PlanCard` → StoreKit 購入 → クライアントは **signedTransaction を `ky-iap-verify` へ送るだけ**。
2. `ky-iap-verify`（Edge Function・FIN-5）: App Store Server API で検証（JWS 署名チェーン検証・bundleId=com.kyasuho.app 照合・環境 Sandbox/Production 照合）→ `ky_billing_subscriptions` upsert（channel='apple_iap', external_id=originalTransactionId）→ `recompute_tenant_plan()`。
3. **App Store Server Notifications V2** のエンドポイント `ky-apple-notify` を新設: 更新・失敗・解約・返金をサーバー主導で反映（クライアントが起動されなくても plan が正しく落ちる）。notificationUUID で冪等（§5-3）。
4. 【注意】同一 Apple ID が別テナントで restore した場合: external_id 一致で既存行が見つかり tenant_id が異なる → **エラーとして拒否し、サポート導線へ**（乗っ取り/共有アカウント対策）。

### 7-2. Stripe カード決済（BILL-2）

**購入（管理Webのみに導線を置く・アプリ内はテキスト誘導0%のみ）**:
1. 管理Web「プラン」画面 → `ky-billing-checkout`（Edge Function・要 Auth JWT・オーナー検証）→ Stripe Checkout Session 作成:
   - `mode: 'subscription'`、`line_items: [{ price: <サーバー側固定の Price ID>, quantity: 1 }]` — **金額・Price をクライアントから受け取らない**（改ざん防止）。
   - `customer`: `ky_billing_customers` から取得 or 新規作成して保存。
   - `client_reference_id: tenant_id`、`subscription_data.metadata.tenant_id` — Webhook 側でテナント特定に使う。
   - 初月無料を揃える場合 `trial_period_days`（§14「プラットフォームで差をつけない」）。
   - **既にアクティブ契約があるテナントは Session を作らず 409 を返す**（§8）。
2. Checkout 完了 → `ky-stripe-webhook` が `checkout.session.completed` → 契約台帳 upsert → recompute。
3. 完了画面は plan 反映を Realtime/ポーリングで確認して表示（楽観アンロック禁止）。

**運用（セルフサービス）**:
- カード変更・解約・領収書は **Stripe Customer Portal**（`ky-billing-portal` が Portal Session URL を発行）。自前でカード管理画面を作らない（非保持化・工数の両面）。

### 7-3. 銀行振込・請求書払い（BILL-3・年払いのみ）

1. 管理Web「プラン」→「請求書払い（年払い）を申し込む」→ 請求先情報（社名/宛名・メール）入力 → `ky-billing-invoice`:
   - Stripe Subscription を `collection_method: 'send_invoice'`, `days_until_due: 14`, 年額 Price で作成。
   - `payment_settings.payment_method_types: ['customer_balance']`（銀行振込）＋ `bank_transfer.type: 'jp_bank_transfer'` → **顧客専用バーチャル口座**が請求書に記載される。
2. Stripe が請求書メール＋ hosted invoice URL を送付（当方の実口座は店舗に露出しない）。
3. 店舗が振込 → **Stripe が自動消込** → `invoice.paid` Webhook → 契約台帳 active（期間=1年）→ recompute → **ここで初めて plan='pro'**。過不足入金は customer balance に自動繰越。
4. 未入金: `invoice.overdue` 相当をバッチ検知（§7-4）→ 期限+7日でリマインドメール → +30日で invoice void・契約 expired（数値はユーザーゲート）。
5. 更新: 期間末14日前に翌年度の請求書を自動発行（Stripe Billing が subscription cycle で自動）。入金なければ §6-3 のとおり失効。
- **Stripe を介さない手動振込（実口座直伝え）は採用しない**: 消込の人手・振込名義不一致・監査証跡・口座番号露出（FIN-7 の趣旨）のリスクに対して利点がない。Stripe 障害時の一時fallbackとしてのみ検討余地を残す。

### 7-4. 日次バッチ（`ky-billing-sweep`・Scheduled Edge Function）

- `current_period_end < now()` なのに status が生きている行の掃除（Webhook 欠落への防御線）→ expired 化 → recompute。
- 振込請求書の期限超過検知→リマインド。
- Webhook は「至上のイベント源」ではなく**最速の通知**にすぎない、という設計（欠落・順序逆転前提）。

---

## 8. 二重課金防止・チャネル移行

### 8-1. 防止（3層）

1. **DB**: 部分ユニークインデックス（§5-1）＝アクティブ契約は1テナント1件。2本目の INSERT は失敗する。
2. **導線**: アクティブ契約があるテナントには他チャネルの購入UIを出さない（`PlanCard` / 管理Webプラン画面とも「現在のご契約: Apple サブスク」等の表示に切替）。
3. **Webhook 側最終防衛**: それでも二重契約イベントが届いた場合（例: 導線抑止をすり抜けた IAP restore）、台帳 INSERT が一意制約で弾かれる → `ky_payment_events` に status='error' で記録 → **権利は既存契約のまま・新契約は反映しない**。オーナーへ「二重のご契約が検出されました」画面通知＋どちらかの解約を案内。返金はチャネル元の窓口（Apple 分は Apple、Stripe 分は当方の refund 判断＝承認ゲート）。

### 8-2. チャネル移行手順（例: IAP → 振込年払い）

1. 現契約を `cancel_at_period_end`（期間末解約）にする。
2. **期間満了後**に新チャネルで申込（満了前の申込は §8-1 の制約でブロック）。
3. 例外として「満了日と同日に切替」したい場合のみ、管理Webの移行ウィザードが旧期間末日を `billing_cycle_anchor` に指定した新契約を予約作成する（BILL-3 の後続改善・MVPでは「満了後に申込」の案内で足りる）。

---

## 9. Edge Function・Webhook 設計規約

| Function | トリガー | 認証 | 主処理 |
|---|---|---|---|
| `ky-stripe-webhook` | Stripe Webhook | **署名検証**（`stripe.webhooks.constructEvent`・STRIPE_WEBHOOK_SECRET・timestamp tolerance 5分） | イベント別ハンドラ→台帳→recompute |
| `ky-apple-notify` | App Store Server Notifications V2 | **JWS 署名チェーン検証**（Apple Root CA まで）＋ bundleId 照合 | 同上 |
| `ky-iap-verify` | アプリから（購入直後） | Auth JWT＋テナント所有検証＋App Store Server API 照会 | 台帳 upsert→recompute |
| `ky-billing-checkout` | 管理Webから | Auth JWT＋オーナー検証＋アクティブ契約チェック | Checkout Session URL 返却 |
| `ky-billing-portal` | 管理Webから | 同上 | Portal Session URL 返却 |
| `ky-billing-invoice` | 管理Webから | 同上 | 年払い請求書サブスク作成 |
| `ky-billing-sweep` | Cron（日次） | service_role 内部 | §7-4 |

**共通規約**:
- 冪等: 受信イベントはまず `ky_payment_events` に INSERT（一意制約衝突＝処理済→即 200）。処理成功後に status='processed'。**Stripe/Apple は同一イベントを再送する前提で書く**。
- 順序逆転耐性: ハンドラは「イベントの内容」ではなく**受信時点の最新状態を API で引き直して**台帳を上書きする（Stripe なら `subscriptions.retrieve`、Apple なら Get All Subscription Statuses）。イベントは「何かが変わった」という合図としてだけ使う。
- 失敗時: 5xx を返して Stripe/Apple のリトライに任せる（自前リトライキューを作らない）。
- SSRF/入力検証: 外部URLへは一切 fetch しない（SEC の Edge 規約）。tenant_id は必ず metadata/検証済トークンから取り、リクエストボディの自己申告を信用しない。
- レート制限: checkout/portal/invoice 系はテナント毎に分あたり回数制限（SEC の秘密照合レート制限と同じ仕組み）。

---

## 10. セキュリティ・鍵管理・開発検証規約

- **鍵の保管**: `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / Apple `.p8`（In-App Purchase Key）は **Supabase Edge Function Secrets のみ**。クライアントに置くのは Stripe **publishable key のみ**（R13/R30: EXPO_PUBLIC/Vite env に secret を入れない）。キー値はチャット・ログ・コミットに出さない。
- **テストモード徹底（W19 整合)**: 開発・検証は Stripe **テストモード（sk_test/テストカード 4242…）** と Apple **Sandbox** のみで行う。本番鍵の設定・本番モード切替・本番での購入テストは**ユーザー承認ゲート**（課金 mutation の試打禁止）。テスト用 Webhook は Stripe CLI の `stripe listen` かテストモード Webhook エンドポイントを使い、本番エンドポイントと分離する。
- **金額の改ざん防止**: 金額・商品は常にサーバー側の Price ID / SKU 定義から。クライアントが金額・期間・プラン名を送ってくる API を1本も作らない（FIN-3 合計サーバー再計算と同思想）。
- **監査**: 台帳・請求書・plan の全変更を FIN-6 `ky_audit_log` に記録。返金・手動操作（Stripe ダッシュボードでの操作含む）も Webhook 経由で台帳に反映されるため証跡が残る。
- **本番分離**: 課金 ON は Supabase 専用プロジェクト分離（Phase C/SEC-13 PITR）後が前提。相乗り中の concafe-yoyaku プロジェクトに本番課金データを置かない。

---

## 11. 返金・解約・プラン変更ポリシー（規約に落とす内容）

| 事象 | 方針 |
|---|---|
| 解約 | いつでも可・**期間末まで利用可・日割返金なし**（SaaS標準）。IAP=OSの購読管理／カード=Customer Portal／振込=次年度請求書を発行しない |
| 返金（カード/振込） | 原則なし。障害・二重課金等の当方起因のみ個別対応。**refund 実行は都度ユーザー承認**（課金系不可逆操作） |
| 返金（IAP） | Apple 管轄（開発者は実行できない）。REFUND 通知を受けたら権利を即時剥奪し台帳へ記録 |
| 月→年変更 | カード: Stripe の proration（差額調整）に任せる／IAP: Apple のアップグレード規則に任せる／振込: 期間末で切替のみ |
| 未入金（振込） | 権利未付与のまま請求書失効（新規）／更新は §6-3 の猶予後に free 降格。**データは消さない**（降格＝機能ゲートが閉まるだけ。最上位安全ルール: 課金状態を理由にユーザーデータを削除しない） |

---

## 12. 経理・請求書運用

- **売上の突合**: Stripe ダッシュボード月次エクスポート（入金・手数料・返金）＋ ASC の Financial Reports を月次で保存。`ky_billing_invoices`/台帳と3点突合できる構造。
- **前受収益（年払い）**: 青色申告（発生主義）の場合、期末の未経過分は前受金計上が必要になりうる → 台帳が `current_period_start/end` を持つので按分計算はデータから機械的に出せる（会計処理自体は税理士/会計ソフト判断・アプリは税務助言をしない＝§27 と同スタンス）。
- **領収書・請求書**: カード=Stripe レシート＋Portal から取得／振込=hosted invoice（インボイス対応は §2-4）。Apple 分は Apple が発行し当方は関与しない。

---

## 13. 実装フェーズ計画とゲート

| Phase | 内容 | 前提ゲート |
|---|---|---|
| **BILL-0 準備** | 価格決定（IAP/Web 同額か・年払い割引率）／インボイス登録判断／特商法表記ページ／規約の課金条項／弁護士確認❷へ B2B直販1項目追加／**Stripe アカウント開設（ユーザー本人）** | すべてユーザー決定・本人操作 |
| **BILL-1 台帳基盤** | migration（§5 の4テーブル＋recompute RPC＋監査対象追加）／`ky-iap-verify`＋`ky-apple-notify`（FIN-5 を台帳経由で実装） | §33 Phase B と同 Rev 群・専用プロジェクト分離後 |
| **BILL-2 カード** | `ky-billing-checkout`/`ky-billing-portal`/`ky-stripe-webhook`／管理Webプラン画面／**テストモード E2E**（購入→plan反映→解約→降格） | 本番鍵切替は承認ゲート |
| **BILL-3 銀行振込** | `ky-billing-invoice`／年払い請求書フロー／`ky-billing-sweep`／未入金督促 | 同上 |
| **BILL-4 アプリ内誘導** | テキスト誘導（0%）文言追加。リンクアウト（15%）は費用対効果でユーザー判断 | Apple 最新規約の再確認 |

- 各 Phase は 1指示=1Rev=1コミット。検証は tsc＋テストモード E2E＋WEB7（migration は SQL Editor 適用→REST 再検証）。
- **IAP ON（§14 横断ゲート）より BILL-1 を先行または同時にする**: IAP を旧来の「直接 plan 更新」で実装してから台帳へ移行すると二度手間＋移行リスクなので、最初から台帳経由で作る。

## 13-2. 未決事項一覧（ユーザー決定ゲート）

- [ ] 価格実額（§14 の ¥1,980〜¥2,980 案・IAP と Web直販を同額にするか、手数料差で Web を安くするか）
- [ ] 年払い額（月額×10ヶ月相当案）と振込払いの最低単位（年のみ、で確定か）
- [ ] 無料トライアルの Web 側扱い（カード登録必須トライアルにするか・振込はトライアルなしで確定か）
- [ ] インボイス発行事業者登録の要否（開業届とセットで判断・[[project_subsidy_roadmap]]）
- [ ] 特商法表記の住所・電話の公開方法（自宅/バーチャルオフィス）
- [ ] 未入金時の督促日数（リマインド+7日/失効+30日 の案）
- [ ] Stripe アカウント名義・開設（本人操作）
- [ ] リンクアウト（15%）を使うか（BILL-4 時点で判断）

---

## 14. SPEC との対応表

| 本書 | SPEC |
|---|---|
| §1 チャネル原則 | §14 三面共有・エンティトルメント単一源泉 |
| §2 法規制 | §7/§16 法務・§6 弁護士確認 TODO |
| §4-5 台帳・plan 導出 | §33 FIN-4（plan保護・実装済 0031）・FIN-5（レシート検証） |
| §5 監査 | §33 FIN-6（ky_audit_log） |
| §7-3 振込・§3 Stripe | §33-4 FIN-8（資金非預かり・Connect 将来）と同一基盤 |
| §10 鍵・テストモード | R13/R30・W19 |
| §13 フェーズ | §33-5 実装順序・§14 横断ゲート |

---
---

# 第2部（2026-07-10 追補・Rev69）モジュール選択型課金・長期契約割引・クーポン

> 第1部の「決済チャネル・台帳・法規制」の骨格はそのまま。第2部は**商品（何をいくらで売るか）の軸**を「free/pro の2値」から「モジュール個数×契約期間」へ拡張する。第1部と競合する箇所は本部が勝つ（§18-4 に差分一覧）。

## 15. モジュール選択型課金（アラカルト）

### 15-1. コンセプトと差別化

- 店舗は**使いたい機能（モジュール）だけを選択**し、料金は**選択した個数**で決まる。
- 競合（Dシステム等）は「全部入り固定価格」が主流 → 「シフト表だけ欲しい小規模店」が最安で入れる価格構造が明確な差別化になる。
- 無料コア（予約が回る最小限）は残す＝フリーミアムの入口は不変。

### 15-2. モジュールカタログ（ドラフト・境界の確定はユーザー決定ゲート）

| キー | モジュール名 | 含まれる機能（SPEC対応） |
|---|---|---|
| （無料コア） | 予約基本 | 予約台帳§3-A／受付設定§3-B／キャスト管理基本§3-C／客Web予約§3-D／プッシュ通知§3-E／設定§3-G（＋FREE_LIMITSの上限内） |
| `shift` | シフト表スタジオ | シフト表生成・テンプレ20種・AIデザイン・店舗テンプレ取込・SNS投稿（§22・§31） |
| `sales` | 売上・給与 | 売上管理・キャスト給与計算・税金CSV（§3-F・§23） |
| `register` | オーダー・レジ | メニュー・伝票・会計・割引・ky_sales自動連携（§25） |
| `attendance` | 勤怠 | 欠勤/遅刻/早退/代打・月次集計（§3-H） |
| `expense` | 経費・申告補助 | 経費管理・月次収支・年次サマリ・経費CSV（§27） |
| `analytics` | 分析・エクスポート | 集計ダッシュボード強化・各種CSV一括（§14の「分析/エクスポート」枠） |
| `limits` | 上限拡張 | キャスト数・月間予約数の上限解放（FREE_LIMITS超え） |

- 設計上の注意: `register` と `sales` のように**データが連携するモジュール**は、片方のみ契約でも壊れない縮退動作を定義する（例: register だけ契約→ky_sales へのupsertは行うが売上画面はロック。ロック画面に「売上・給与モジュールを追加」導線）。
- モジュール数は将来増やせる（通知パック㉟・AI機能等）。**キーは一度公開したら改名しない**（台帳・レシートに残るため＝Bundle IDと同じ不変原則）。

### 15-3. 料金構造 = f(個数, 期間)

- **月額基準価格を「個数→金額」のテーブルで定義**（単価一律×個数ではなく、個数が増えるほど1個あたりが安くなる逓減カーブを推奨。全選択には上限キャップ＝実質「全部入りパック」）。
- 例（**構造例であり実額はユーザー決定**）: 1個¥980／2個¥1,760／3個¥2,400／4個¥2,940／5個以上（全部入り）¥3,280 のような形。
- 個数だけが価格を決め、**「どのモジュールか」は価格に影響しない**（＝SKU爆発の防止・§15-5）。将来モジュール別価格差をつけたくなったら Stripe 側は対応可能だが IAP 側が破綻するので、差をつけるなら「対象モジュールを2個分としてカウント」方式に留める。

### 15-4. エンティトルメントのデータ設計（第1部 §4-5 の拡張）

- `ky_billing_subscriptions` に列追加:
  - `selected_modules text[]` — 契約中モジュールキー配列
  - `module_count integer` — 課金個数（`array_length(selected_modules,1)` と一致するCHECK）
  - `billing_interval text CHECK IN ('month','half_year','year')` — §16
- `ky_tenants` に **`entitlements jsonb` 列を追加**（例: `{"modules":["shift","sales"],"until":"2027-07-10T00:00:00Z"}`）。
  - `plan` 列は残す（'free'/'pro' の粗い互換＝客Webバッジ等）。**pro = モジュール1個以上有効** と再定義。
  - **FIN-4 トリガーを拡張**: `entitlements` 列も service_role 以外の変更を拒否（migration 0031 と同型）。
- RPC は `recompute_tenant_plan` → **`recompute_tenant_entitlements`** に発展: アクティブ契約行の `selected_modules` ∪ promo行（§17）から entitlements と plan を同時導出。
- **ゲート関数（ルールGATE-1）**: アプリ/管理Webとも判定は `hasModule(moduleKey)` 1関数に集約（EntitlementContext）。`IAP_ENABLED=false` の間は常に true（現状の全機能無料と同義）。散在した `plan==='pro'` 比較は書かない（現時点でコード内に plan 比較は存在しないことを確認済み＝転換コスト最小の今のうちにカタログを固定する）。

### 15-5. チャネル別の実装方式

| チャネル | 実装 |
|---|---|
| **Stripe（カード/振込）** | 「モジュール枠」という1つの Product に **期間別3つの Price**（§16）を作り、**quantity=個数 × graduated（段階）料金**で逓減カーブを表現。選択内容は `subscription.metadata.selected_modules` に保存し Webhook で台帳へ同期 |
| **Apple IAP** | SKU は**個数×期間**のマトリクス（例: `kyasuho_m2_halfyear`＝2モジュール半年）。**どのモジュールを選んだかはサーバー側（台帳）にのみ保存**し、購入SKUは「n個の枠」を表す。モジュール7種なら 7個数×3期間=21 SKU になるため、**iOS は簡略ラインナップ（例: 1個/3個/全部入り × 3期間 = 9 SKU）に丸め、細かい個数指定は管理Web（テキスト誘導0%）へ案内する案を推奨**＝ユーザー決定ゲート |
| **Google Play** | Base plan/offer 構造で IAP と同じ方針 |

- **選択変更ルール（推奨案・ユーザー決定ゲート）**:
  - 個数を増やす＝アップグレード: 即時反映（Stripe=proration差額請求／IAP=Appleのアップグレード規則）
  - 個数を減らす＝ダウングレード: **次回更新時に反映**（期間途中の返金を発生させない＝§11と整合）
  - 同数での入れ替え（shift→sales 等）: **月1回まで即時**（毎日入れ替えて実質全部使う悪用の防止。変更履歴は FIN-6 監査ログへ）

## 16. 契約期間と長期割引（月/半年/年）

### 16-1. 期間ラインナップ

| 期間 | 割引の考え方（実額・率はユーザー決定） | 対応チャネル |
|---|---|---|
| 月契約 | 基準価格（§15-3 のテーブル） | IAP／Play／カード |
| **半年契約** | 月額×約5.5ヶ月相当（≒8%OFF）目安 | IAP／Play／カード／**振込** |
| **年契約** | 月額×約10ヶ月相当（≒17%OFF）目安＝SPEC §14 の既存案を踏襲 | IAP／Play／カード／**振込** |

- 長期契約の一括前受け＝解約率の構造的低下＋キャッシュフロー前倒し。**「モジュール選択×長期割引」の掛け算が競合の固定価格に対する二重の差別化**になる。
- 第1部 §1「振込は年払いのみ」を**「半年 or 年の一括前受け」に緩和**（半年でも消込は1回/期・与信リスクゼロの前受け構造は不変）。月払い振込は引き続き不採用。

### 16-2. 実装

- **Stripe**: 期間別に3 Price（`interval: month×1`／`month×6`／`year×1`）。割引は期間別 Price の単価テーブルに直接織り込む（クーポンで表現しない＝表示がシンプル・景表法の二重価格問題も回避しやすい）。
- **IAP/Play**: duration 1ヶ月/6ヶ月/1年 のサブスクを同一サブスクリプショングループに配置（グループ内は自動的に相互アップグレード/ダウングレード）。
- **期間の変更**（月→年 等）: **次回更新時のみ**（期間途中の切替は proration が複雑化しトラブル源。シンプル運用を優先）。
- 前受収益の按分（§12）は期間が伸びるほど重要になる: 台帳の `current_period_start/end` から機械的に月割できる構造は第1部のまま有効。

## 17. クーポンコード（チラシ施策・トライアル延長）

### 17-1. 要件と全体方針

- 通常: **初回トライアル1ヶ月**。チラシ（ポスティング）記載のコードを入力すると**2ヶ月に延長**。
- **方針: トライアルを全チャネル統一の「サーバーサイド・トライアル」に一本化する**（ストア機構に依存しない）:
  - `ky_billing_subscriptions` に **channel='promo'** の行（status='trialing'・期間=30日 or クーポンで60日・selected_modules=**全モジュール**）を作る＝課金ゼロで entitlements が立つ。
  - トライアル終了が近づいたら購入導線へ誘導 → どのチャネルで買っても継続。
- この方式の利点:
  1. **クーポンによる延長が自在**（ストアのオファー設定に縛られない）
  2. **カード登録なしでトライアル開始できる**（コンバージョン率が高い・チラシ→QR→即体験の動線に必須）
  3. モジュール選択型と相性が良い（トライアル中は全部入りを体験→終了時に「使った機能だけ選ぶ」＝アラカルトの営業導線そのもの）
  4. **スタック（重複）防止**: ASC Introductory Offer を併用すると「サーバー2ヶ月＋Apple 1ヶ月＝実質3ヶ月」の意図しない重複が起きる。サーバー側一本化なら起きない
- ✅ **2026-07-10 ユーザー承認済み**: サーバーサイド・トライアルへの一本化（ストア側オファーは設定しない）を正式採用。SPEC §14 の該当記述も改定済み（Rev70）。ASC/Play 側で Introductory Offer / free trial を**設定しないこと**が実装時チェック項目（設定すると promo とスタックする）。

### 17-2. DB設計

**`ky_coupon_campaigns`** — キャンペーン（チラシの「版」単位で作る＝配布エリア別の効果測定）

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| name | text | 例: 「2026秋ポスティング・大阪ミナミ」 |
| code_type | text CHECK IN ('shared','unique') | shared=チラシ共通コード／unique=1枚ごと個別コード |
| shared_code | text UNIQUE null | shared時の共通コード（正規化: 大文字・紛らわしい文字 O/0/I/1 を使わない8文字以上英数） |
| benefit_type | text CHECK IN ('trial_extension','discount') | 当面は trial_extension。将来の金額割引（Stripe Promotion Code 連携）も同じ台帳で管理 |
| trial_days | integer | 例: 60（通常30の代わりに適用する総日数） |
| valid_from / valid_until | timestamptz | 配布期間＋余裕 |
| max_redemptions / redeemed_count | integer | 上限と実績 |
| is_active | boolean | 緊急停止スイッチ |

**`ky_coupon_redemptions`** — 引き換え記録

| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK | |
| code | text | 実際に入力されたコード（unique型なら個別コード） |
| tenant_id | uuid FK | |
| redeemed_by_user_id | uuid | **Auth ユーザー単位でも記録**（テナント作り直しによる再取得の検知に使う） |
| redeemed_at | timestamptz | |

**制約**: `UNIQUE (campaign_id, tenant_id)`＋**テナントのライフタイムでトライアル系クーポンは1回**（部分ユニーク）。unique型コードは `UNIQUE (code)` で1回使い切り。RLS: 全て service_role のみ（campaign 内容もコード列挙攻撃の材料になるためオーナーにも見せない。自分の redemption の有無だけ RPC で返す）。

### 17-3. 引き換えフロー

1. **入力場所は管理Web（とテナント作成直後のオンボーディング画面）のみ。iOSアプリ内にはコード入力欄を置かない**（IAP以外の解錠機構と誤認される審査リスク 3.1.1 の回避。アプリ内は「Webでコードを入力できます」のテキスト誘導0%まで）。
2. `ky-coupon-redeem`（Edge Function・Auth JWT＋オーナー検証）:
   - 正規化（trim・大文字化）→ campaign 照合（is_active・期間・上限）→ 既往チェック（tenant/ユーザーのライフタイム1回・既にトライアル消費済みなら拒否）
   - **レート制限: テナント毎 5回/時・IP毎 20回/時**（総当たり対策・SEC の秘密照合レート制限と同基盤）。失敗応答は「コードが無効です」の1種類（存在有無を漏らさない）
   - 成立 → promo 台帳行を作成 or 既存トライアル行の `current_period_end` を延長 → `recompute_tenant_entitlements` → redemptions 記録＋FIN-6 監査ログ
3. 画面は即時に「トライアル残り60日・全機能が使えます」表示（entitlements 反映を確認して表示＝楽観アンロック禁止の原則どおり）。

### 17-4. 不正・悪用対策

| 脅威 | 対策 |
|---|---|
| コード総当たり | 8文字以上英数＋レート制限＋失敗ログ監視。shared_code はキャンペーン毎に変える |
| テナント削除→再作成で再トライアル | redemptions を **user_id でも照合**＋「過去に台帳行（promoを含む）を持ったことがある owner_user_id のテナントはトライアル不可」をRPCで判定 |
| クーポンの転売・SNS拡散 | shared型は仕様上拡散しうる前提で max_redemptions と valid_until で total exposure を上限化。拡散されたら is_active=false で即時停止 |
| トライアル中の再適用スタック | benefit_type=trial_extension は「総日数を trial_days に置き換え」（加算ではない）＝二重入力しても60日を超えない |
| 内部不正（コード台帳の改ざん） | campaigns/redemptions とも service_role のみ書込＋FIN-6 監査ログ対象 |

### 17-5. アプリ内誘導画面の表現規定（QRコード・URLの扱い）【2026-07-10 追記・Rev70】

Apple 公式「Payment options on the App Store in Japan」の一次確認結果（2026-07-10）に基づく整理。

**手数料の仕組み（正確な理解）**:
- 手数料の対象は「**actionable link（ブラウザで開くリンク）のタップから7日以内**の外部サイト売上」。料率は標準15%・**Small Business Program 参加者は10%**（きゃすりんは Small Business ⇒ リンクアウトするなら10%）。
- アプリ外への誘導（out-of-app offer）自体は「**actionable link を使うかどうかにかかわらず**」許可されている。リンクを置かない誘導にはタップが存在しない＝追跡対象の売上が発生しない＝**実質0%**。

**QRコードの扱い＝「0%のテキスト誘導に含まれるとは断定できない」（保守判定・アプリ内には置かない）**:
1. Apple の公式文書（日本向けページ・External Purchase Link エンタイトルメント）に**QRコードへの言及が一切ない**＝明文で許可されていない。
2. QRコードは実質的に「URLを画像化したもの」であり、iOS はカメラ/画像長押しでQRを検出してそのままリンクとして開ける（テキスト認識表示）＝**審査で actionable link 同等と判定されるリスク**がある。
3. リンク同等と判定された場合、外部購入リンクのエンタイトルメント・開示シート・月次報告義務を**迂回した形**になり、0%どころか規約違反（リジェクト/アカウント措置）のリスクを負う。
4. そもそも同じ iPhone の画面に出した QR は同一端末でスキャンできず UX としても弱い。
⇒ **結論: アプリ内の誘導は「文字列のみ」（例:「詳しくは『きゃすりん Web』で検索」）に限定。QRコードは印刷物・アプリ外でのみ全面活用する**（チラシ・店頭POP・LP・メール・管理Web画面はAppleの管轄外＝QR自由・手数料0%。クーポン導線「チラシのQR→管理Web→コード入力」は全てアプリ外なので影響なし）。

**誘導画面にURLを貼らない（貼れない）理由＝画面内コメント・レビューノートにも残す**:
- タップ可能なURL/ボタンを置く＝「リンクアウト」＝①外部購入リンクエンタイトルメント申請（iOS 26.2+・最新ライセンス同意）②遷移前の開示モーダル表示③全取引の月次報告義務④手数料10%（Small Business）——の4点セットが発生するため。
- タップ不可のプレーンテキストでURLを書く方式も不採用: iOS の Text/UI 部品は URL 文字列を自動でリンク化することがあり（dataDetectorTypes 等）、実装ミス1つで「無申請のリンクアウト」になる。**URL文字列そのものを画面に置かず「検索してください」型の文言にするのが最も安全**。
- この理由は誘導画面コンポーネントのコード内コメントとして残し（将来の実装者が「なぜURLを貼らないのか」で迷って改悪しないため）、審査提出時のレビューノートにも「アプリ内に外部購入リンクは存在しない（リンクなしテキスト誘導のみ）」と明記する。
- 【実装時ゲート】リンクアウト（10%）採用可否は BILL-4 のユーザー判断（§13）。採用するならこの規定を上書きし、エンタイトルメント4点セットを正規実装する。

### 17-6. 計測と法務

- **効果測定**: campaign 単位の redeemed_count → チラシ配布数に対する転換率。配布エリア別に campaign を分けて刷る（QRコードの遷移先パラメータ `?cp=<campaign略号>` とコードを対で刷ると、Web来訪→コード入力の2段階で漏斗が見える）。
- **景表法**: 「2ヶ月無料」の表示には条件（対象: 新規店舗のみ・期間・コード入力が必要・自動更新の有無）を近接表示。チラシ原稿も §2-5 と同じ基準でチェック。
- **特商法**: トライアルから自動で課金が始まる設計には**しない**（トライアル終了＝free 降格。課金開始は必ず明示的な購入操作）→ 「解約し忘れ課金」クレームとダークパターン規制の回避。この「終了しても勝手に課金されない」はチラシ・LPの安心材料として明記してよい。

## 18. 第2部の実装計画・差分

### 18-1. フェーズ更新（第1部 §13 への追記）

| Phase | 追加内容 |
|---|---|
| BILL-0 | モジュール境界の確定・個数→価格テーブル・半年/年割引率・iOS SKUラインナップ（フル21か簡略9か）。~~トライアル方式変更（§17-1 仕様分岐）の承認~~ → ✅ **2026-07-10 承認済み（Rev70）** |
| BILL-1 | 台帳列追加（selected_modules/module_count/billing_interval）・`ky_tenants.entitlements`＋FIN-4拡張・`recompute_tenant_entitlements`・**ky_coupon_* 2表＋ky-coupon-redeem**（クーポンは決済より先に単体で動く＝チラシ施策を課金ONより先に打てる） |
| BILL-2 | Checkout に quantity＋期間別Price＋metadata.selected_modules。プラン画面=モジュール選択UI（チェックボックス＋動的料金表示） |
| BILL-3 | 振込を半年/年の2種に |
| BILL-4 | 変更なし |

**現システムの先行整備（課金ONを待たず実施可能・Rev69で着手）**:
- `src/config/features.ts` にモジュールカタログ（キー・型）と GATE-1 ゲート関数の骨格を定義（IAP_ENABLED=false の間は全モジュール有効＝挙動不変）。**目的: 今後書く新機能コードが最初から `hasModule()` を通る構造にし、二値 plan 前提のコードをこれ以上生まない**。

### 18-2. 未決事項の追加（第1部 §13-2 へ追加）

- [ ] モジュール境界の確定（§15-2 ドラフトの採否・特に `limits` の扱い）
- [ ] 個数→価格テーブルの実額（逓減カーブ・全部入りキャップ）
- [ ] 半年/年の割引率（8%/17% 目安の採否）
- [ ] iOS の SKU ラインナップ（フルマトリクス21 か 簡略9＋Web誘導 か）
- [x] トライアルのサーバーサイド一本化（2026-07-06 のストアオファー決定の差し替え・§17-1）→ ✅ **2026-07-10 ユーザー承認済み（Rev70）**
- [ ] モジュール入替ルール（月1回案）・ダウングレード反映タイミング（次回更新案）
- [ ] チラシの共通コード方式（shared）か個別コード方式（unique）か（印刷コストと計測精度のトレード）

### 18-3. 競合差別化の整理（Dシステム対比）

| 観点 | Dシステム（想定: 全部入り固定） | きゃすりん |
|---|---|---|
| 価格の入口 | 固定価格（使わない機能も込み） | **1モジュールから**（最安入口） |
| 拡張 | なし | 使い始めてから1個ずつ追加（アップセル動線が製品内にある） |
| 長期契約 | — | 半年/年で割引（解約率・CF改善） |
| 導入体験 | — | コードなしでも1ヶ月・チラシコードで2ヶ月**全部入り**体験→終了時に必要な分だけ選択 |

### 18-4. 第1部との差分一覧（本部が優先）

| 第1部の記述 | 第2部での変更 |
|---|---|
| product_id = 'kyasuho_pro_monthly'/'kyasuho_pro_yearly' の2値 | 個数×期間の論理ID（例: `kyasuho_m3_half_year`）へ拡張 |
| 振込は年払いのみ | **半年 or 年**の一括前受け |
| トライアル=ASC Introductory Offer / Stripe trial_period_days | **サーバーサイド・トライアル（channel='promo' 行）へ一本化**（✅ 2026-07-10 ユーザー承認済み・Rev70。ストア側オファーは設定しない） |
| plan='free'/'pro' が権利のすべて | plan は互換用の粗い値・**実体は entitlements（モジュール配列）** |
| §6 状態機械 | 不変（promo 行も同じ状態機械に乗る。trialing→期限切れ→expired→recompute で降格） |
| 二重課金防止・Webhook・法規制・鍵管理（§8〜§12） | 不変 |
