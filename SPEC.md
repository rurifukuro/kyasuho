# きゃすほ！ 仕様書（SPEC）

- 作成日: 2026-07-03
- ステータス: **仕様検討中（実装未着手・Phase -1法務ゲート＝条件付きGo通過済み）**
- ベースアプリ: **concafe-yoyaku**（予約ロジック・客側Web）＋ **とれはんっ！/レジさぽっ！**（UI共有部品・UGC 4要件・i18n・IAP）を流用
- アプリID（ASC）: 6787006154 ／ Bundle ID: `com.kyasuho.app`（ロック済・R1で変更不可）

> このファイルは開発用リファレンス（設計の土台）。**価格・フリー/有料の具体ライン・MVPスコープの最終確定はユーザーと詰めてから**実装着手する（仕様分岐＝承認ゲート）。§6の要決定TODOを参照。

---

## 1. コンセプト

**コンカフェ（コンセプトカフェ）の予約を、店・キャスト・客の三者で1本化する予約管理SaaS。**
コンカフェ集客は今キャスト個人のX/LINE任せで予約がバラバラ。これを「店が登録するだけで客向けの公開予約ページが自動発行され、席・生誕祭・指名の予約が集約される」形にする。汎用予約SaaS（RESERVA/STORES）は無料巨人と丸かぶりなので、**コンカフェ特化**で回避する（とれはんっ！＝同人イベント特化と同じ勝ち筋）。

- **提供者側（店・キャスト）**＝iOSアプリ（Expo/RN）で予約台帳・受付設定・キャスト管理
- **客側**＝公開Webページ（GitHub Pages）で空き確認→予約（アプリ不要・URLを配るだけ）
- 両者は同一Supabaseバックエンドを共有（tenant_idで店ごとに分離）

---

## 2. 確定した方向性

| 項目 | 決定内容 |
|---|---|
| アプリ名 | **きゃすほ！**（キャストの予定を確保→キャス＋ほ。J-PlatPat称呼0件・Web衝突なし・ASC作成成功で名称予約完了） |
| Bundle ID | **`com.kyasuho.app`**（ロック済・以後変更不可） |
| ベース | concafe-yoyaku（予約ロジック・客Web）＋ とれはんっ！/レジさぽっ！（UI部品・UGC・i18n・IAP） |
| 構成 | **二面**＝提供者iOSアプリ ＋ 客側公開Web（GitHub Pages）。同一Supabaseを共有 |
| テナント | **セルフ登録マルチテナントSaaS**（店/キャストが登録→予約ページ自動発行。tenant_id＋RLS分離・Supabase Authセルフサインアップ） |
| 対応OS | **iOS主・Android後追い**（MVPはiOSのみ） |
| 収益 | **フリーミアム。MVPは全機能無料で出荷**（IAPフラグOFF・課金コードは後付けできる構造）。§14で「フリー/有料の境界」を設計 |
| 決済 | 予約の決済仲介はしない（月額のみApple IAP）。予約前金/店頭決済を入れる場合は資金決済法の別ゲート |
| Phase -1法務 | **条件付きGo**（No-Goブロッカー無し）。5必須要件（§15/§16）を設計に織り込む |

---

## 3. 機能一覧

優先度マーク: ★=MVP必須（予約SaaSの核） ／ ◯=あると便利 ／ △=将来・任意

### A. 提供者アプリ｜予約台帳（コア）★
- 予約一覧（日付別タイムライン・席/キャスト別表示）＝concafe-yoyaku `CustomerTimeline` 相当を提供者視点に
- 予約の受付/変更/キャンセル・来店チェックイン
- 予約詳細（客名・連絡先・人数・指名キャスト・メモ）
- 手動予約追加（電話/店頭客を店が代理登録）

### B. 提供者アプリ｜受付設定（コア）★
- 営業日・営業時間・1セット時間（concafe-yoyaku `UnlockManager`/`useUnlockWindows` 相当）
- 席数・卓数設定（自動割当＝concafe-yoyaku の席自動アサイン流用）
- 予約受付の解禁/〆切（レジさぽっ！取り置き `close_at` 自動〆切パターン流用）
- 公開ページURLの発行・コピー・QR表示（客へ配る導線）

### C. 提供者アプリ｜キャスト管理 ★
- キャスト登録（名前・写真・SNSリンク・紹介文）
- 出勤スケジュール登録（どのキャストがどの枠に出るか）
- 指名予約の受付ON/OFF（キャスト単位）
- ◯ キャスト個人の予約受付ページ（キャストのSNSから直接飛ばす用）

### D. 客側公開Web｜予約受付 ★
- 店の公開ページ（`kyasuho.pages/<店slug>`）で営業日カレンダー→空き枠表示→予約
- 予約フォーム（名前/連絡先/人数/指名キャスト選択/要望）
- 予約完了→予約番号＋PIN発行（concafe-yoyaku の4桁PIN流用＝アカウント不要で予約編集）
- PINで予約確認・変更・キャンセル
- ◯ 生誕祭/周年イベントの特設予約枠表示
- **アプリ不要**（客はWebだけ・提供者だけアプリ）

### E. 通知・リマインダー ◯（一部★）
- ★ 予約が入ったら提供者へプッシュ通知（expo-notifications）
- ◯ 予約前日/当日に客へリマインダー（メール or 公開ページ再訪促し。※MVPはアプリ内通知＝提供者向けのみ、客向けメールは有料機能候補）
- ◯ 〆切・満席の通知

### F. 分析・売上補助 ◯
- ◯ 来店実績・予約数の集計（concafe-yoyaku `SalesSummary`/`TimeAllocationSummary` 相当）
- ◯ キャスト別指名数ランキング
- △ CSV/売上エクスポート（有料機能候補）

### G. 設定・アカウント ★
- ★ アカウント作成/ログイン（Supabase Auth・メール＋パスワード）
- ★ **アプリ内アカウント削除**（5.1.1(v)必須＝§16）
- ★ 店舗プロフィール（店名・ジャンル・場所・営業情報）
- ★ 利用規約・プライバシーポリシー（§16の表明保証条項を含む）
- ★ 通報/ブロック導線（UGC 4要件＝§15）
- IAP（サブスク・§14）※MVPはフラグOFF
- 言語切替（i18n）
- バージョン表示（app.json直読み＝ルールVER）
- ダークモード（とれはん流用で標準装備）

---

## 4. 技術方針（各種ルール準拠）

- **ルールINIT**：git・TypeScript strict・`any`禁止・型付きナビゲーション・共有部品ファースト・検証ゲート（tsc/i18n/実機スモーク）を初日から。**流用/複製アプリもコピー直後Rev1コミット＋自前REVISION_LOG＋Rev1独自採番**
- **流用の一次ソース**（ルールREUSE-TRIGGER＝自前実装の前に流用源をgrep→Read→コピー）：
  - 予約ロジック・DBスキーマ・客Web ← **concafe-yoyaku**（`make_reservation` RPC＝advisory lockで二重予約防止／PIN編集／席自動割当／解禁ウィンドウ）
  - UI共有部品 ← **とれはんっ！**（FormModalShell・KeyboardDoneBar・PinchImageViewer・ChipBar・SearchField・ScreenHeader・ThemeContext・LanguageContext・i18nエンジン・TermsOfUseModal・PrivacyPolicyModal・ContactFormModal）
  - UGC 4要件（通報/ブロック/フィルタ/連絡先） ← **とれはんっ！**（R28実装）
  - 自動〆切（`close_at`） ← **レジさぽっ！**（取り置き予約Rev13）
  - 情報ページ ← **レジさぽっ！/とれはんっ！** InfoScreen
- **マルチテナント**：全業務テーブルに `tenant_id`（＝店舗ID）＋ RLS。提供者は自テナントのみ、客Webは公開読み取り＋予約INSERTのみ（§12）
- **認証**：Supabase Auth（メール＋パスワード・セルフサインアップ）。客側はアカウント不要（PIN方式）
- **ポート**：**8086**をきゃすほ！に固定割当（expo-startスキルの割当表＋references/port_assignment.md へ実装着手時に追記）
- **i18n**：MVPは `ja`（コンカフェは国内主）。将来 `en`/`zh-TW`/`ko`（訪日客のコンカフェ需要）。全文言`t()`経由
- **フォント**：日本語字形固定（ルールFONT-JP）
- **Supabase相乗り→分離**：MVPは concafe-yoyaku プロジェクト（ref=rhmuitgbvilqwdevxxox・Tokyo）に `ky_` プレフィックステーブルで相乗り。**本番前に専用プロジェクトへ分離**（kashikari/daiposの轍＝相乗りは分離計画必須）

---

## 5. スコープ（MVP＝最小で「予約が回る」まで）

**MVPの完成定義＝「店が登録→公開ページ発行→客がWebで席予約→店アプリで台帳確認」の1周が回る。**

- **MVP第1弾に含める（★）**：A（予約台帳）／B（受付設定・席・解禁/〆切・URL発行）／C（キャスト登録・出勤・指名ON/OFF）／D（客Web予約・PIN編集）／E-★（提供者への予約プッシュ）／G（Auth・アカウント削除・店プロフィール・規約/PP・通報/ブロック）
- **後フェーズ（◯）**：F（分析・売上）／E-◯（客向けメールリマインダー）／C-◯（キャスト個人ページ）／生誕祭特設枠
- **将来・任意（△）**：CSVエクスポート／多言語拡張／Android版
- **課金**：MVPはIAPフラグOFF（全無料）。§14の境界設計に沿って後付け

---

## 6. 未確定事項・要決定（TODO＝ユーザー承認ゲート）

- [ ] **フリー/有料の具体ライン**（§14に設計案。無料=規模制限＋基本予約／有料=規模無制限＋プロ機能。**どの機能を有料の壁の向こうに置くかの最終決定**）
- [ ] **月額サブスク価格**（§14に推奨レンジ。店舗向けSaaS＝個人向けより高め。競合コンカフェGoスタンダード¥4,800/月が参考。実額は課金前にユーザー承認＝価格判断ゲート）
- [ ] **MVPスコープの最終確定**（§5の★で回るか、Cのキャスト管理を後フェーズに回すか）
- [ ] **i18n範囲**（MVP日本語のみ確定でよいか／訪日客向けに最初からen入れるか）
- [ ] **弁護士確認**（❶個人情報の委託契約/規約の表明保証条項 ❷将来決済時の資金決済法＝§16）
- [x] アプリ名クリア（J-PlatPat称呼0件＋ASC作成成功＋Web衝突なし）
- [x] Bundle ID（com.kyasuho.app・ロック済）
- [x] Phase -1法務ゲート（条件付きGo・No-Goブロッカー無し）
- [x] 競合調査（§8）

---

## 7. 実現可能性メモ（制約・できないこと）

- ⚠️ **客側の予約決済**：MVPは決済仲介しない（資金決済法の論点回避）。「予約だけ受けて支払いは店頭」が既定。前金決済を入れる瞬間に資金移動業/収納代行のゲート発生→別途弁護士確認
- ⚠️ **客への自動メール/LINE**：メール送信基盤（Supabase Edge＋SendGrid等）が要る＝MVPは提供者アプリ内プッシュ優先。客向けメールは有料機能候補
- ⚠️ **風営法**：第三者アプリ提供者に直接義務は無いが、**接待を助長する作り（密着指名/シャンパンタワー煽り等）を避ける**設計方針＋規約で店側に必要許可の表明保証（§16）
- ❌ **成人向け/出会い系トーン**：App Store 1.1.4該当を避け、健全なカフェ予約として作る（§15）

---

## 8. 競合・差別化（2026-07-03 調査）

- **チェキチェキ**（App Store id6759213579）＝コンカフェ/地下アイドルのキャスト向け「チェキ写真整理・顧客・タスク管理」。端末内保存・サーバーなし。**予約・公開受付ページは無し**＝軸が別（手元記録 vs 予約導線）
- **コンカフェGo**（株式会社Code and DESIGN・2026-07-02）＝コンカフェ専門の**店舗向けCRM/MA**（出勤プッシュ・チェックインQR・ステップ配信・スタンプカード・分析）。店舗フリー0円/スタンダード月4,800円。**予約機能は無し**（再来店促進が軸）。**無料で店舗接点を持つ＝将来予約機能追加の可能性で要警戒**
- 汎用予約SaaS（RESERVA/STORES予約/tol等）＝無料でも高機能だが**コンカフェ特化ではない**（席×キャスト指名×生誕祭という業界固有の予約軸を持たない）
- **結論＝「客側の公開予約受付ページを自動発行するコンカフェ特化SaaS」は依然空白＝差別化成立**。チェキチェキ=手元記録／コンカフェGo=CRM／汎用SaaS=非特化。きゃすほ！の軸＝**予約受付導線 × コンカフェ特化（席・指名・生誕祭）× 客はWebだけ**

---
---

# 詳細設計（実装用リファレンス）

> 以下は§1〜§8の方向性に基づく実装レベルの設計。**必読ルール**: 実装前に必ず `memory/app_dev_rules.md`（INIT/MODAL-SAFE/Z-KBD/VER/FONT-JP/PRICE/BE系）と `memory/rules_workflow.md`（W1〜W22）と concafe-yoyaku の実コードを先読みすること。

---

## 9. 画面構成・ナビゲーション設計（二面）

### 9-1. 提供者iOSアプリ（BottomTabNavigator・React Navigation 7）

```
BottomTabNavigator
├─ Reservations  📋  予約台帳（§3-A・コア）
├─ Schedule      🗓️  受付設定・営業日/席/解禁〆切（§3-B）
├─ Casts         👤  キャスト管理（§3-C）
├─ Analytics     📊  分析（§3-F・後フェーズは空/簡易）
└─ Settings      ⚙️  設定・アカウント・IAP（§3-G）
```

- タブアイコンは `@expo/vector-icons` MaterialCommunityIcons（絵文字直書き禁止＝ルールTAB-ICON）
  - 予約=`calendar-check` / 受付=`clock-edit` / キャスト=`account-star` / 分析=`chart-box` / 設定=`cog`
- `initialRouteName = 'Reservations'`
- 未ログイン時は `AuthScreen`（サインアップ/ログイン）→ 完了後タブ
- 初回ログイン後は `StoreSetupScreen`（店プロフィール＋公開URL発行ウィザード）
- Android戻る：とれはんっ！同様のタブ訪問履歴スタック方式（ルールBACK-1）

| 画面 | 主な責務 | モーダル |
|---|---|---|
| **ReservationsScreen** | 日付別予約タイムライン・受付/変更/キャンセル・チェックイン・手動追加 | 予約詳細/編集（FormModalShell）、手動追加 |
| **ScheduleScreen** | 営業日/時間/席数/1セット時間・解禁/〆切・公開URL発行/QR | 営業設定、URL/QR表示 |
| **CastsScreen** | キャストCRUD・出勤登録・指名ON/OFF | キャスト編集（FormModalShell）、出勤カレンダー |
| **AnalyticsScreen** | 来店/予約集計・指名ランキング（後フェーズは簡易/プレースホルダ） | なし |
| **SettingsScreen** | 店プロフィール・アカウント削除・規約/PP・通報管理・IAP・言語・テーマ・バージョン | 各種モーダル |

### 9-2. 客側公開Web（concafe-yoyaku流用・React+Vite+HashRouter）

```
公開ページ  kyasuho.pages/<店slug>
├─ 店トップ（店名・ジャンル・営業案内・予約ボタン）
├─ 予約カレンダー（営業日→空き枠）
├─ 予約フォーム（名前/連絡先/人数/指名キャスト/要望）
├─ 予約完了（予約番号＋4桁PIN）
└─ 予約確認/変更（PIN入力→編集/キャンセル）
```

- concafe-yoyaku の `CustomerPage`/`Calendar`/`ReservationModal`/PIN編集をマルチテナント化（URLの `<店slug>` から tenant を解決）
- **アプリ不要**（客はWebのみ）。GitHub Pages（HashRouter・VITE_BASE_PATH）＝レジさぽっ！買い手Web/concafe-yoyakuと同じデプロイ形

---

## 10. データモデル（マルチテナント・Supabase/Postgres）

> concafe-yoyaku の単一テナントスキーマ（unlock_windows/reservations/menu_items/reservation_pins＋make_reservation RPC）に `tenant_id` を足してマルチテナント化する。相乗り期はテーブル名を `ky_` プレフィックスで衝突回避。

### テーブル（MVP）

| テーブル | 主なカラム | 備考 |
|---|---|---|
| `ky_tenants` | id, slug(公開URL用), name, genre, owner_user_id, business_info(jsonb), is_suspended | 店舗＝テナント。slugが公開ページのキー |
| `ky_casts` | id, tenant_id, name, photo_url, sns_links(jsonb), bio, accepts_nomination(bool), sort_order | キャスト |
| `ky_shifts` | id, tenant_id, cast_id, date, start_at, end_at | 出勤枠 |
| `ky_unlock_windows` | id, tenant_id, date, open_from, close_at, seats, set_minutes | 受付解禁ウィンドウ＋自動〆切（concafe＋レジさぽ流用） |
| `ky_reservations` | id, tenant_id, date, slot, seat_no, customer_name, contact, party_size, cast_id(指名), note, status, created_at | 予約本体 |
| `ky_reservation_pins` | reservation_id, pin_hash | 4桁PIN（客の予約編集・concafe流用） |
| `ky_reports` | id, tenant_id, target_type, target_id, reporter, reason, status, created_at, resolved_at | **UGC通報**（§15） |
| `ky_blocks` | id, tenant_id, blocker_user_id, blocked_key | **ブロック**（§15） |

### RLS方針（§12で詳述）

- 提供者：`tenant_id = 自分の所属テナント` の行のみ全操作
- 客Web（anonロール）：`ky_tenants`/`ky_casts`/`ky_unlock_windows` は公開SELECT（is_suspended=false）、`ky_reservations` はINSERTと自PIN行のSELECT/UPDATEのみ（RPC経由）
- 予約作成は `make_reservation` RPC（SECURITY DEFINER＋advisory lockで二重予約防止・concafe流用）を tenant_id 対応に拡張

### 型定義（TypeScript・提供者アプリ／客Web共通の一部）

```typescript
type ReservationStatus = 'reserved' | 'checked_in' | 'cancelled' | 'no_show';

type Tenant = {
  id: string; slug: string; name: string; genre: string;
  ownerUserId: string; businessInfo: BusinessInfo; isSuspended: boolean;
};
type Cast = {
  id: string; tenantId: string; name: string; photoUrl: string | null;
  snsLinks: { label: string; url: string }[]; bio: string;
  acceptsNomination: boolean; sortOrder: number;
};
type UnlockWindow = {
  id: string; tenantId: string; date: string; // YYYY-MM-DD
  openFrom: string; closeAt: string | null; seats: number; setMinutes: number;
};
type Reservation = {
  id: string; tenantId: string; date: string; slot: string; seatNo: number | null;
  customerName: string; contact: string; partySize: number;
  castId: string | null; note: string; status: ReservationStatus; createdAt: string;
};
```

---

## 11. コンポーネント設計（流用 vs 新規）

### 提供者アプリ｜流用（とれはんっ！/レジさぽっ！からコピー＋最小改変）

| コンポーネント | 流用元 | 改変 |
|---|---|---|
| FormModalShell | とれはんっ！ `src/components/circleForm/FormModalShell.tsx` | そのまま（ルールMODAL-SAFE） |
| KeyboardDoneBar | とれはんっ！ `src/components/KeyboardDoneBar.tsx` | そのまま・#8E8E93グレー・KAVの外（Z-KBD-OUT） |
| PinchImageViewer | とれはんっ！ `src/components/PinchImageViewer.tsx` | キャスト写真拡大に使用 |
| ChipBar / FilterChip | とれはんっ！ `src/components/common/ChipBar.tsx` | 日付/席/キャストのフィルタ |
| SearchField | とれはんっ！ `src/components/common/SearchField.tsx` | 予約/キャスト検索 |
| ScreenHeader | とれはんっ！ `src/components/common/ScreenHeader.tsx` | モーダルヘッダ |
| CalendarModal | とれはんっ！（DATE-POPUP正準） | 営業日/予約日選択 |
| ThemeContext | とれはんっ！ `src/context/ThemeContext.tsx` | AsyncStorageキーを `ky_theme` に |
| LanguageContext / i18n | とれはんっ！ `src/context/LanguageContext.tsx` / `src/i18n` | エンジン流用・翻訳JSON新規 |
| TermsOfUseModal / PrivacyPolicyModal / ContactFormModal | とれはんっ！ | 文面をきゃすほ用（§16の表明保証条項） |
| **通報/ブロックUI** | とれはんっ！（R28実装） | §15の4要件 |
| 自動〆切（close_at） | レジさぽっ！ 取り置きRev13 | ScheduleScreenの〆切設定 |

### 客Web｜流用（concafe-yoyakuからコピー＋マルチテナント化）

| コンポーネント | 流用元 | 改変 |
|---|---|---|
| CustomerPage | concafe-yoyaku `src/.../CustomerPage.tsx` | URL `<店slug>` から tenant 解決を追加 |
| Calendar | concafe-yoyaku `Calendar.tsx` | tenant_id フィルタ |
| CustomerTimeline | concafe-yoyaku `CustomerTimeline.tsx` | 空き枠表示 |
| ReservationModal | concafe-yoyaku `ReservationModal.tsx` | 指名キャスト選択を追加 |
| PIN編集 | concafe-yoyaku `reservation_pins` フロー | そのまま |
| make_reservation RPC | concafe-yoyaku `supabase/migrations/` | tenant_id 引数追加・advisory lockキーに tenant を含める |

### 新規コンポーネント（提供者アプリ）

| コンポーネント | 責務 |
|---|---|
| AuthScreen | サインアップ/ログイン（Supabase Auth） |
| StoreSetupScreen | 店プロフィール＋公開URL発行ウィザード |
| ReservationTimeline | 予約台帳（提供者視点の日別タイムライン） |
| ReservationEditModal | 予約の受付/変更/キャンセル/チェックイン |
| SeatConfigPanel | 席数・卓・1セット時間設定 |
| UnlockConfigPanel | 解禁/〆切（close_at）設定 |
| PublicUrlCard | 公開URL表示・コピー・QR |
| CastEditModal | キャストCRUD（写真・SNS・指名ON/OFF） |
| ShiftCalendar | 出勤枠登録 |
| ReportInbox | 通報一覧・24時間以内対応（§15） |
| DeleteAccountModal | アプリ内アカウント削除（§16・5.1.1(v)） |
| PlanCard / SubscriptionCard | IAP購入UI（§14・MVPはフラグOFFで非表示） |

---

## 12. マルチテナント・認証・RLS設計

### 認証（Supabase Auth）
- 提供者＝メール＋パスワードのセルフサインアップ。サインアップ直後に `ky_tenants` を1行作成し `owner_user_id` を紐付け（＝1アカウント1店舗MVP。複数店舗は有料/後フェーズ）
- 客＝**アカウント不要**。予約時に4桁PIN発行（concafe流用）＝ハッシュ保存し、確認/変更はPIN照合
- セッション：`@supabase/supabase-js` の永続セッション（AsyncStorage）

### RLS（行レベルセキュリティ）
```sql
-- 提供者は自テナントのみ（authのuidから所属tenantを引く）
create policy tenant_owner_all on ky_reservations
  for all using (tenant_id = (select id from ky_tenants where owner_user_id = auth.uid()));
-- 客Web(anon)は公開情報のみSELECT
create policy public_read_casts on ky_casts
  for select using (
    (select is_suspended from ky_tenants t where t.id = tenant_id) = false
  );
-- 予約作成はRPC(SECURITY DEFINER)経由のみ。直INSERTはRLSで拒否
```
- **BE-1/BE-3準拠**：後から足す列は `writeWithDriftRetry` で42703を自動degrade。migrationは本番SQL Editor適用→REST再検証（WEB7）
- **相乗り注意**：concafe-yoyaku本番プロジェクトに同居するので、既存 `reservations` 等とテーブル名衝突しないよう `ky_` プレフィックス必須。**本番前に専用プロジェクトへ分離**（pg_dumpで `ky_*` のみ移行）

---

## 13. 予約ロジック（concafe-yoyaku流用）

- **二重予約防止**：`make_reservation` RPC が `pg_advisory_xact_lock(hashtext(tenant_id || date || slot || seat))` で同一枠の同時予約を直列化（concafeの単一テナント版に tenant_id を追加）
- **席自動割当**：空き席番号を昇順で自動アサイン（concafe流用）
- **解禁ウィンドウ**：`ky_unlock_windows` で「この日のこの時間から受付」を制御。`close_at` 超過 or 手動〆切で受付停止（レジさぽ流用＝客Webは「受付終了」表示）
- **指名**：予約に `cast_id` を持たせ、そのキャストの `accepts_nomination` と出勤枠（`ky_shifts`）を突合して選択可否を出す
- **PIN編集**：予約番号＋4桁PINで客が変更/キャンセル（concafe `reservation_pins` フロー）

---

## 14. 課金設計（IAP）＝フリー/有料の境界【ユーザー要決定の核心】

> **MVPは全機能無料で出荷**（IAPフラグOFF）。以下は「後で有料化する時の境界の設計案」。SaaS定石＝**①規模で区切る（テナント/キャスト/予約数）＋②プロ機能で区切る（分析/エクスポート/通知/ブランディング除去）**。最終ラインはユーザー決定（§6 TODO）。

### 境界の設計案（叩き台）

| 機能 | 無料（Free） | 有料（きゃすほプロ・月額サブスク） |
|---|---|---|
| 店舗数 | 1店舗 | 複数店舗 |
| キャスト登録 | 〜3人 | 無制限 |
| 月間予約受付 | 〜100件 | 無制限 |
| 基本予約（席・日時・PIN編集） | ◯ | ◯ |
| 公開予約ページ | ◯（「きゃすほ！」バッジ付き） | ◯（バッジ非表示・独自ブランディング） |
| キャスト指名予約 | △（1キャストのみ or なし） | ◯ |
| 生誕祭/周年イベント枠 | ✗ | ◯ |
| 客向けメール/リマインダー | ✗ | ◯ |
| 分析ダッシュボード | ✗（当日集計のみ） | ◯（期間集計・指名ランキング） |
| CSV/売上エクスポート | ✗ | ◯ |

- **フラグ設計**：`config/features.ts` で `IAP_ENABLED=false`（MVP）。有料判定は `EntitlementContext.plan` を全ゲートが通す共通関数（ルールGATE-1＝上限は1関数に集約）
- **上限ゲート**：キャスト追加/予約受付は `canAddCast()` / `canAcceptReservation()` の共通ゲートを全経路（アプリ手動追加・客Web予約）が通す（散在禁止＝ルールGATE-1）

### 商品構成（案・価格は要決定＝§6 TODO）

| 商品ID | 種別 | 価格（案・要ユーザー承認） | 内容 |
|---|---|---|---|
| `kyasuho_pro_monthly` | 自動更新サブスク | **¥1,980〜¥2,980/月**（店舗SaaS・競合コンカフェGoは¥4,800/月） | プロ全機能 |
| `kyasuho_pro_yearly` | 自動更新サブスク | 月額×10ヶ月相当（2ヶ月分割引） | 年払い |

### PRICE/R35準拠
- 価格表示は `productsById[sku].localizedPrice`（配列順依存禁止＝ルールPRICE）
- 地域別倍率＝R35（JP基準・米×1.4/韓×1.2/他×1.0・下回り地域は手動底上げ）
- Expo Goでは storeUnavailable を Alert 案内（クラッシュさせない）

---

## 15. UGC 4要件（App Store 1.2＝Phase -1必須B・R28流用）

セルフ登録＝ユーザー生成コンテンツ（店名/キャスト名/写真/紹介文/客の予約メモ）。**とれはんっ！のR28実装を流用して4要件を満たす**：

1. **投稿前フィルタ**：店名/キャスト名/紹介文の登録時にNGワード・不適切コンテンツをフィルタ（クライアント＋サーバー）
2. **通報＋24時間以内対応**：`ky_reports` に通報を記録。`ReportInbox`（提供者）＋運営（開発者）宛て通報導線。24時間以内に対応する運用
3. **ブロック**：不適切ユーザー/客をブロック（`ky_blocks`）
4. **連絡先公開**：規約/設定に運営連絡先を明記（R17＝`rurifukuro@gmail.com`）

- 客の予約メモ（自由記述）もUGC＝フィルタ対象
- 通報対応フロー・EULA同意（「不適切コンテンツにゼロ寛容」明記）はとれはんっ！のEULA/通報UIを流用

---

## 16. プライバシー・法務設計（Phase -1必須D/E・表明保証）

### アカウント削除（5.1.1(v)・必須★）
- `DeleteAccountModal` で提供者が自分でアカウント＋テナントデータを削除できる（アプリ内完結）。Supabase Authユーザー削除＋関連 `ky_*` 行のカスケード削除

### プライバシーポリシー（必須★）
- 私（開発者）は客個人データ（氏名/連絡先/予約内容）の **委託先（データ処理者）**。店が委託元
- **安全管理措置**（法23条相当）＝RLS・暗号化・アクセス制御をPPに明記
- App Privacy申告：収集＝連絡先/氏名（予約）・利用目的＝予約管理。範囲は小さいが「収集なし」は不可（サーバー送信あり＝R4）

### 利用規約の表明保証条項（風営法リスク回避・弁護士確認推奨）
- 規約に「**店側は営業に必要な許認可（風営法の接待飲食等営業許可が必要な場合はそれを含む）を自ら取得・維持していることを表明保証する**」条項を入れる＝無許可店が原因のリスクを構造的に切り離す
- 併せて「接待を目的とした利用（本サービスは健全なカフェ予約管理を目的とする）」の範囲を規約で明示

### 資金決済法（E・現状範囲外）
- MVPは決済仲介なし＝範囲外。予約前金/店頭決済を入れる瞬間に資金移動業/収納代行の論点→**決済導入は別途弁護士ゲート**（§6 TODO）

---

## 17. 客側公開Web設計（concafe-yoyaku流用・詳細）

- **スタック**：React+Vite+TS strict+Supabase+GitHub Pages（HashRouter・VITE_BASE_PATH）＝concafe-yoyaku/レジさぽ買い手Webと同一
- **マルチテナント化の要点**：ルート `#/<店slug>` から `ky_tenants.slug` でテナント解決→そのテナントの公開データのみ表示
- **anonキー**：公開OK（WEB4＝anonは公開安全・service_roleは出荷禁止）。RLSで客は公開SELECT＋予約INSERT（RPC）のみ
- **デプロイ**：GitHub Actions（deploy.yml で `.env` をCI生成＝WEB2/WEB1）。公開は実HTTP実証（WEB5）＋**公開操作はユーザー承認（WEB9）**
- **配布**：提供者アプリの `PublicUrlCard` が `https://rurifukuro.github.io/kyasuho/#/<店slug>` を発行・QR化して客へ

---

## 18. i18n設計

- MVP＝`ja` のみ（コンカフェは国内主）。エンジンはとれはんっ！流用で最初から `t()` 経由（ハードコード日本語禁止＝ルールI18N-2）にしておき、将来 `en`/`zh-TW`/`ko`（訪日客コンカフェ需要）を足せる構造
- ビルド時 `scripts/check-i18n.js`（全キー存在チェック・漏れでビルド中断＝ルールI18N）

---

## 19. プロジェクト初期化手順

### 1. scaffold（実行中：blank-typescript）
```
cd "C:\Users\tiash\Desktop\Claude Code専用"
npx create-expo-app@latest kyasuho --template blank-typescript
```
### 2. git（ルールINIT＝コピー直後Rev1）
```
git init ; .gitignore（node_modules/.env/鍵類）; git add -A ; git commit -m "Rev1: Expo blank-typescript ベースライン"
```
＋自前 `REVISION_LOG.md` 作成・以降1指示=1Rev=1コミット。流用元のRevコメントは無視しRev1独自採番
### 3. TS strict＋any禁止（tsconfig `"strict": true`・tsc --noEmit を完了ゲート）
### 4. 依存パッケージ
```
# ナビ
npx expo install @react-navigation/native @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
# ジェスチャ/アニメ
npx expo install react-native-gesture-handler react-native-reanimated
# ストレージ・Supabase
npx expo install @react-native-async-storage/async-storage
npm i @supabase/supabase-js
# 画像・通知・課金
npx expo install expo-image-picker expo-image-manipulator expo-file-system expo-notifications react-native-iap
# その他
npx expo install expo-status-bar expo-web-browser expo-clipboard expo-build-properties @expo/vector-icons
```
### 5. ディレクトリ構造（提供者アプリ）
```
src/
├── components/{common, reservations, schedule, casts, settings}/
│   ├── FormModalShell.tsx  KeyboardDoneBar.tsx  PinchImageViewer.tsx（流用）
├── screens/ Auth/ StoreSetup/ Reservations/ Schedule/ Casts/ Analytics/ Settings/
├── context/ AuthContext ThemeContext LanguageContext EntitlementContext IAPContext
├── config/ features.ts（IAP_ENABLED=false）  supabase.ts
├── i18n/ index.ts strings.json ...
├── services/ supabase/（client, reservations, casts, tenants）  ugc/（reports, blocks）
├── types/ index.ts（§10）
└── App.tsx
```
（客Webは別リポ or `web/` サブディレクトリでconcafe-yoyakuを流用）
### 6. app.json
```json
{ "expo": {
  "name": "きゃすほ！", "slug": "kyasuho-app", "scheme": "kyasuho", "version": "1.0.0",
  "orientation": "portrait", "userInterfaceStyle": "automatic",
  "ios": { "supportsTablet": false, "bundleIdentifier": "com.kyasuho.app" },
  "android": { "package": "com.kyasuho.app", "softwareKeyboardLayoutMode": "resize" },
  "plugins": [ ["expo-build-properties", {"ios":{"deploymentTarget":"16.0"}}], ["expo-notifications"] ]
}}
```
### 7. ポート＝**8086**（`npx expo start --tunnel --port 8086`・expo-startスキル割当表へ追記）
### 8. Supabase相乗り（MVP）→ 本番前に専用プロジェクト分離
- MVP：concafe-yoyaku（ref=rhmuitgbvilqwdevxxox）に `ky_*` テーブルを migration で追加
- 本番：専用プロジェクト作成→同じmigration→pg_dumpで `ky_*` のみ移行（kashikari/daiposの分離手順に倣う）

### 9. 実装順序（推奨）
1. 基盤（scaffold・git Rev1・型定義・ThemeContext/LanguageContext/i18n流用・supabaseクライアント・AuthContext）
2. 認証（AuthScreen・サインアップ→テナント自動作成・RLS）
3. 受付設定（ScheduleScreen・席/解禁/〆切・公開URL発行）※予約の前提
4. 予約台帳（ReservationsScreen・タイムライン・手動追加・make_reservation RPC）
5. 客Web（concafe-yoyaku流用・マルチテナント化・予約INSERT→提供者へ反映）
6. キャスト管理（CastsScreen・指名）
7. 通知（提供者への予約プッシュ）
8. UGC 4要件（通報/ブロック/フィルタ/連絡先）
9. 法務（アカウント削除・規約/PP・表明保証条項）
10. 設定・IAP骨組み（フラグOFF）・仕上げ

---

## 20. ルール遵守チェックリスト（実装時に毎回）

- [ ] **INIT**：git・TS strict・any禁止・共有部品ファースト・コピー直後Rev1コミット＋自前REVISION_LOG
- [ ] **MODAL-SAFE**：モーダルは全てFormModalShell
- [ ] **Z-KBD**：TextInput画面にKeyboardDoneBar・KAVの外（兄弟）・#8E8E93グレー
- [ ] **TAB-ICON**：BottomTabは`@expo/vector-icons`・各タブ固有アイコン名（絵文字禁止）
- [ ] **VER**：バージョン表示はapp.json直読み
- [ ] **FONT-JP**：日本語フォント同梱で字形固定
- [ ] **PRICE/R35**：localizedPrice・配列順依存禁止・地域別倍率
- [ ] **GATE-1**：上限（キャスト/予約数）は共通ゲート関数に集約・全経路が通す
- [ ] **BE-1/2/3**：空catch禁止・schema driftはRESTプローブ・writeWithDriftRetry
- [ ] **UGC 4要件**（1.2）：フィルタ・通報24h・ブロック・連絡先
- [ ] **5.1.1(v)**：アプリ内アカウント削除
- [ ] **WEB系**（客Web）：anon公開/service_role出荷禁止・実HTTP実証・公開はユーザー承認
- [ ] **W1**：チャプター・コミットメッセージは日本語

---

## 横断ゲート（完了宣言前・app_dev_rules SPEC-CROSS/REUSE-TRIGGER/SCREEN-COMPARE/TAB-ICON）

**§3機能✅だけで完了と言わない。§9（タブUI）／§11（流用components実体照合）／§14（IAP×UI存在）／§15（UGC 4要件）／§16（アカウント削除・法務）を全ゲート通過してからREVISION_LOGに明記。**
