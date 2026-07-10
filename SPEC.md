# きゃすりん 仕様書（SPEC）

- 作成日: 2026-07-03 ／ 最終改訂: 2026-07-07 第8次（**§22-5モードA廃止・モードB/C実装済みRev67＝空テンプレ決定論グリッド検出(gridDetect.ts)＋任意画像背景(defaultFreeformPlacement＋cellBgAlpha/textOutline可読性ガード)**）。前回: 同日第7次（シフト表取込改善仕様§22-5新設＝3モード化・仕様のみ）。同日第6次（**金融・セキュリティ強化設計§33新設＝FIN-1〜8／SEC-11〜13・Phase A〜D・設計のみ実装は別Rev**）。2026-07-06 第5次（**会計時の割引・クーポン§25-7＝店舗独自キャンペーン対応＋姉妹アプリのキャスト個人ランキングを不実装へ§32**。同日第4次＝初月無料トライアル§14＋姉妹アプリ（お客様向け）構想とスタンプ/クーポン・ランキング集計の仕込み§32＋第3次棚卸しの◯/△を実装計画へ組込み§19の㉚〜㊲。同日第3次＝シフト表拡張＝デイリー出勤表§22-2・店舗テンプレ取込§22-3・プレビュー固定§22-4＋SaaS機能ネット調査棚卸し§26-3。同日第2次＝ユーザー10項目指示の反映＝レジお客様名/一時保存（§25-3）・経費/確定申告補助（§27）・入力UX/表示/用語是正（§28）・席種/席料（§29）・キャスト写真2種（§30）・シフト表SNS投稿（§31）・棚卸し§26-2追加。同日第1次＝オーダー管理§3-K/§25・§26新設）
- ステータス: **実装進行中（Rev25まで完了＝MVP実装順序1〜17全部＋キャストアカウント基盤（2系統ログイン・招待コード・ロール分岐・パスワードリセット・T13〜T18 UI）。次フェーズ＝§19の18〜27）**
- ベースアプリ: **concafe-yoyaku**（予約ロジック・客側Web）＋ **とれはんっ！/レジさぽっ！**（UI共有部品・UGC 4要件・i18n・IAP）を流用
- アプリID（ASC）: 6787006154 ／ Bundle ID: `com.kyasuho.app`（ロック済・R1で変更不可）

> このファイルは開発用リファレンス（設計の土台）。**価格・フリー/有料の具体ライン・MVPスコープの最終確定はユーザーと詰めてから**実装着手する（仕様分岐＝承認ゲート）。§6の要決定TODOを参照。

---

## 1. コンセプト

**コンカフェ（コンセプトカフェ）の予約を、店・キャスト・客の三者で1本化する予約管理SaaS。**
コンカフェ集客は今キャスト個人のX/LINE任せで予約がバラバラ。これを「店が登録するだけで客向けの公開予約ページが自動発行され、席・生誕祭・指名の予約が集約される」形にする。汎用予約SaaS（RESERVA/STORES）は無料巨人と丸かぶりなので、**コンカフェ特化**で回避する（とれはんっ！＝同人イベント特化と同じ勝ち筋）。

**三面構成（2026-07-05確定）**：

1. **提供者iOSアプリ**（Expo/RN）＝店・キャストの手元運用（予約台帳・受付設定・キャスト管理・通知受け）
2. **提供者管理Web（PC）**＝店のPC作業用サイト。アプリと同じアカウントでログインし、同じデータを大画面で操作（売上入力・給与計算・CSV出力・シフト表画像生成などPC向き作業の主戦場）
3. **客側公開Web**＝店ごとの公開予約ページ（アプリ不要・URLを配るだけ）

三面すべて同一Supabaseバックエンド（Auth＋DB＋RLS）を共有。tenant_idで店ごとに分離。**アプリ⇔管理Webは同一アカウント・同一データ＝どちらで操作しても即座に他方へ反映**（§22連携仕様）。

---

## 2. 確定した方向性

| 項目 | 決定内容 |
|---|---|
| アプリ名 | **きゃすりん**（キャスト＋りん＝人名風の4文字。覚えやすくマスコットキャラ展開に好適。J-PlatPat未衝突・Web衝突なし。旧名「きゃすほ！」から改名。Bundle IDは旧名 com.kyasuho.app をR1ロック済） |
| Bundle ID | **`com.kyasuho.app`**（ロック済・以後変更不可） |
| ベース | concafe-yoyaku（予約ロジック・客Web）＋ とれはんっ！/レジさぽっ！（UI部品・UGC・i18n・IAP） |
| 構成 | **三面**＝提供者iOSアプリ ＋ **提供者管理Web(PC・2026-07-05追加)** ＋ 客側公開Web（GitHub Pages）。同一Supabase（Auth/DB/RLS）を共有 |
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
- 予約詳細（お客様名・連絡先・人数・指名キャスト・メモ）
- 手動予約追加（電話/店頭のお客様を店が代理登録）★＋指名キャスト欄をドロップダウンで追加（現状は欄自体が無い＝§28-1・2026-07-06）

### B. 提供者アプリ｜受付設定（コア）★
- 営業日・営業時間・1セット時間（concafe-yoyaku `UnlockManager`/`useUnlockWindows` 相当）
- 席数・卓数設定（自動割当＝concafe-yoyaku の席自動アサイン流用）
- 予約受付の解禁/〆切（レジさぽっ！取り置き `close_at` 自動〆切パターン流用）
- 公開ページURLの発行・コピー・QR表示（お客様へ配る導線）
- ★ **席種・席料設定**（カウンター/ソファ等のCRUD＋席種ごとの席料金額入力＝§29・2026-07-06ユーザー指示）

### C. 提供者アプリ｜キャスト管理 ★
- キャスト登録（名前・**ふりがな（あいうえお順ソートキー＝§28-1）**・写真・SNSリンク・紹介文）
- ★ **キャスト写真2種**（証明写真＝本人確認・オーナーのみ閲覧／お店写真＝表示用・管理側でも差替え可・グループ離脱時に自動削除＝§30・2026-07-06ユーザー指示）
- ★ 生年月日等の個人情報入力はホイールピッカー/選択式（手入力の半角全角混入防止＝§28-2）
- 出勤スケジュール登録（どのキャストがどの枠に出るか）
- 指名予約の受付ON/OFF（キャスト単位）
- ★ **キャストアカウント（実装済Rev21〜）**：オーナーが招待コード発行→キャスト本人がログイン→キャスト側ホーム（自分のシフト・給与明細閲覧・個人情報登録）。オーナーと2系統ログイン（§12）
- ◯ キャストのシフト希望提出（キャストが希望枠を出す→店が確定。現状は店側登録のみ＝§26-8）
- ◯ キャスト個人の予約受付ページ（キャストのSNSから直接飛ばす用）

### D. 客側公開Web｜予約受付 ★
- 店の公開ページ（`kyasuho.pages/<店slug>`）で営業日カレンダー→空き枠表示→予約
- 予約フォーム（名前/連絡先/人数/**指名キャスト＝ドロップダウン・あいうえお順（§28-1）**/**席種＝ドロップダウン・席料表示（§29）**/要望）
- 予約完了→予約番号＋PIN発行（concafe-yoyaku の4桁PIN流用＝アカウント不要で予約編集）
- PINで予約確認・変更・キャンセル
- ◯ 生誕祭/周年イベントの特設予約枠表示
- **アプリ不要**（客はWebだけ・提供者だけアプリ）
- **【2026-07-10・§34】UI再設計＝concafe-yoyakuの台帳型タイムライン（席×縦時間・厳守）＋予約ポップアップ＋ご注文予定＋店舗テーマ設定（カラー/背景写真）。既存機能の削除禁止（§34-5）**

### E. 通知・リマインダー ◯（一部★）
- ★ 予約が入ったら提供者へプッシュ通知（expo-notifications）
- ◯ 予約前日/当日に客へリマインダー（メール or 公開ページ再訪促し。※MVPはアプリ内通知＝提供者向けのみ、客向けメールは有料機能候補）
- ◯ 予約の変更/キャンセル時の提供者プッシュ（現状は新規予約のみ＝§26-10）
- ◯ 〆切・満席の通知

### F. 分析・売上管理 ★（詳細設計＝§23）
- ★ 来店実績・予約数の集計（concafe-yoyaku `SalesSummary`/`TimeAllocationSummary` 相当）
- ★ キャスト別指名数ランキング
- ★ **店舗売上管理**（日別/月別の売上入力・集計ダッシュボード・グラフ表示）
- ★ **オーダー由来の自動集計**（§3-K/§25＝レジ会計→日別売上へ自動反映。手入力はオーダー未使用店/日の代替入力として併存＝2026-07-06追加）
- ★ **キャスト別給与計算**（時給×出勤時間＋指名バック＋ドリンクバック等の歩合→日/月の給与明細自動生成。計算式・設定は§23）
- ★ **税金関連CSV出力**（売上明細/給与明細を確定申告・会計ソフト取込用にエクスポート。形式は§23＝MVPは汎用CSV＋日付/科目/金額列）
- ◯ 売上目標設定・達成率表示
- ★ **経費管理・確定申告補助**（経費入力・カテゴリ別集計・月次収支・年次サマリ・経費CSV＝§27。◯→★昇格＝2026-07-06ユーザー指示）

### H. 勤怠管理 ★
- ★ **欠勤・遅刻・早退の記録**（キャスト×日付で出勤ステータス管理：出勤/遅刻/早退/欠勤/代打）
- ★ 欠勤理由メモ（体調不良/私用/無断等のカテゴリ＋自由入力）
- ★ 勤怠一覧（月次カレンダー表示＋集計：出勤率/遅刻率）
- ◯ 遅刻/欠勤のプッシュ通知（他キャストへの連絡）
- ◯ 代打リクエスト機能（欠勤時に空きキャストへ通知）

### I. シフト表生成（画像出力）★（エンジン詳細設計＝§22）
- ★ **全キャストの月間シフト一覧表を画像として自動生成**（提供者が添付画像のようなデザインの出勤表をSNS等で告知する用途）
- ★ **デザインテンプレート20種以上**（エレガント/ポップ/ゴシック/和風/シンプル/ネオン/パステル等・店の雰囲気に合わせて選択。**テンプレート＝パラメータ定義＋共通レンダラー方式**＝§22）
- ★ テンプレートのカスタマイズ（店ロゴ挿入・カラー変更・フォント選択・背景画像）
- ★ **AI独自デザイン生成**（Claude APIがテンプレート定義パラメータを生成→共通レンダラーが描画＝出力一貫性と文字品質を担保。APIキーはEdge Function側＝R13準拠。§22）
- ★ 生成画像の保存・共有（アプリ=カメラロール保存/シェアシート、管理Web=PNGダウンロード）
- ★ **SNS投稿ボタン**（生成後に店舗SNSを開いて投稿できる導線＝X intent/Instagram起動＋投稿文テンプレ・予約URL差し込み＝§31・2026-07-06ユーザー指示）
- ★ **主戦場は管理Web（PC・大画面プレビュー）**。アプリでも生成可（同一テンプレート定義を共有）
- ★ **デイリー出勤表**（「本日の出勤キャスト」の写真入り日別画像＝毎日のSNS告知はコンカフェ実務の定番。T8統合＝§22-2・2026-07-06第3次で★へ格上げ）
- ★ **店舗独自テンプレートの取り込み**（各店が既に使っている自前デザイン画像をアップロード→出勤情報を重ねて生成。内蔵20種・AIに並ぶ第3の選択肢。T16統合＝§22-3）
- ★ **作成画面はプレビュー常時固定表示**（設定をスクロールしてもプレビューが画面外に消えない＝§22-4・2026-07-06ユーザー指示）
- ◯ **店舗テンプレ取込の改善＝取り込み2モード化＋セル個別微調整**（モードA廃止・空テンプレの決定論グリッド検出(B)・任意画像背景(C)＝§22-5・モードB/C実装済みRev67。残=不均等グリッド対応V2＋境界線ドラッグ＋セル個別微調整）
- ◯ 週間/2週間表示バリエーション
- ◯ テンプレートのお気に入り保存

### G. 設定・アカウント ★
- ★ アカウント作成/ログイン（Supabase Auth・メール＋パスワード）
- ★ **アプリ内アカウント削除**（5.1.1(v)必須＝§16）
- ★ 店舗プロフィール（店名・ジャンル・場所・営業情報）
- ★ 利用規約・プライバシーポリシー（§16の表明保証条項を含む）
- ★ 通報/ブロック導線（UGC 4要件＝§15）
- ★ **「PCで作業」導線**（管理WebのURL表示・コピー・QR＝§3-J/§22）
- IAP（サブスク・§14）※MVPはフラグOFF
- 言語切替（i18n）
- バージョン表示（app.json直読み＝ルールVER）
- ダークモード（とれはん流用で標準装備）

### J. 提供者管理Web（PC作業サイト）★【2026-07-05追加】
**店のPCブラウザから、アプリと同じアカウント・同じデータで業務ができるサイト。** 忙しい営業前後にスマホで完結する作業（予約確認・チェックイン）はアプリ、腰を据えたPC作業（経理・シフト表作成・一括編集）は管理Web、と使い分ける。

- ★ **ログイン**（Supabase Auth＝アプリと同一のメール＋パスワード。アカウントは1つ）
- ★ **予約台帳**（日別一覧＋PC優位の週/月ビュー・受付/変更/キャンセル/チェックイン・手動追加＝アプリ§3-Aと同権限）
- ★ **受付設定**（営業日・席数・解禁/〆切・公開URL表示＝§3-B同等）
- ★ **キャスト管理**（CRUD・出勤スケジュール一括編集＝表形式でまとめて入力できるのがPC優位）
- ★ **売上・給与・勤怠**（§3-F/Hの全機能。CSV出力はブラウザダウンロード＝PCが主戦場）
- ★ **シフト表画像生成**（§3-I の主戦場。大画面プレビュー・テンプレート選択・AIデザイン・PNG保存）
- ★ 設定（店プロフィール・規約/PP閲覧・アカウント削除）
- ◯ 通報管理（ReportInbox相当）
- **やらないこと**：管理Webは提供者専用（客は§3-Dの公開ページのみ）。プッシュ通知はアプリ側の責務（Webはリアルタイム画面反映のみ）

### K. 提供者アプリ｜オーダー管理・レジ ★【2026-07-06ユーザー指示で追加】
**レジさぽっ！のレジ画面を参考にした店内オーダー（注文）管理。** 現状の売上管理（§3-F）は日別合計の手入力のみで**オーダー（注文）単位の記録が無い**＝このギャップを埋める（詳細設計＝§25）。

- ★ メニュー登録（セット/延長/指名料/キャストドリンク/ドリンク/フード/チェキ/その他・価格）
- ★ 伝票（来店グループ単位）＝開く→明細追加（±ステッパー）→会計（預かり金→おつり計算・支払方法記録）→締め
- ★ **お客様名入力欄＋会計までの一時保存ボタン**（伝票にお客様名を付け、会計せず open のまま保存できる明示ボタン＝§25-3・2026-07-06ユーザー指示）
- ★ キャスト紐付け明細（キャストドリンク・チェキ・指名料が「どのキャストに付いたか」を記録→給与バック自動集計＝§23）
- ★ **売上の管理側連携**（会計確定→日別売上 `ky_sales` へ自動集計upsert→管理Webの売上/給与/CSVへ波及＝§24・§25-4）
- ★ 予約チェックイン→伝票オープン連携（reservation_id 紐付け）
- ◯ 卓タイマー（セット開始→残り時間表示・延長アラート）／◯ 伝票履歴の検索・当日売上ダッシュボード（管理Web・Realtime）
- △ モバイルオーダー（客スマホからの注文）＝接客が価値のコンカフェとは相性を要検討・当面やらない

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
- **ポート**：**8086**をきゃすりんに固定割当（expo-startスキルの割当表＋references/port_assignment.md へ実装着手時に追記）
- **i18n**：MVPは `ja`（コンカフェは国内主）。将来 `en`/`zh-TW`/`ko`（訪日客のコンカフェ需要）。全文言`t()`経由
- **フォント**：日本語字形固定（ルールFONT-JP）
- **Supabase相乗り→分離**：MVPは concafe-yoyaku プロジェクト（ref=rhmuitgbvilqwdevxxox・Tokyo）に `ky_` プレフィックステーブルで相乗り。**本番前に専用プロジェクトへ分離**（kashikari/daiposの轍＝相乗りは分離計画必須）

---

## 5. スコープ（MVP＝最小で「予約が回る」まで）

**MVPの完成定義＝「店が登録→公開ページ発行→客がWebで席予約→店がアプリでもPCでも台帳確認・業務処理できる」の1周が回る。**

- **MVP第1弾に含める（★）**：A（予約台帳）／B（受付設定・席・解禁/〆切・URL発行）／C（キャスト登録・出勤・指名ON/OFF）／D（客Web予約・PIN編集）／E-★（提供者への予約プッシュ）／F（売上管理・給与計算・税金CSV）／G（Auth・アカウント削除・店プロフィール・規約/PP・通報/ブロック）／H（勤怠管理）／I（シフト表画像生成）／**J（提供者管理Web＝PC作業サイト・2026-07-05ユーザー指示で必須化）**
- **MVP第2弾（2026-07-06ユーザー指示で追加）**：**K（オーダー管理・レジ＝§25）**＝アプリのレジ＋メニュー管理＋管理Webのオーダー履歴/メニュー編集＋売上自動集計連携
- **実装順序（Rev26時点の残り＝§19の18〜27）**：⑱K-DB → ⑲アプリ：メニュー管理＋レジ画面（お客様名欄・一時保存含む） → ⑳売上自動集計＋給与ドリンク自動化 → ㉑管理Web：オーダー → ㉒是正パック（§28） → ㉓name_kana＋ドロップダウン統一 → ㉔席種・席料（§29） → ㉕キャスト写真（§30） → ㉖経費・確定申告補助（§27） → ㉗シフト表SNS投稿（§31）
- **後フェーズ（◯）**：E-◯（お客様向けメールリマインダー）／C-◯（キャスト個人ページ）／生誕祭特設枠／売上目標（※経費管理は㉖で★昇格済＝2026-07-06）
- **将来・任意（△）**：多言語拡張／Android版
- **課金**：MVPはIAPフラグOFF（全無料）。§14の境界設計に沿って後付け

---

## 6. 未確定事項・要決定（TODO＝ユーザー承認ゲート）

- [ ] **フリー/有料の具体ライン**（§14に設計案。無料=規模制限＋基本予約／有料=規模無制限＋プロ機能。**どの機能を有料の壁の向こうに置くかの最終決定**）
- [ ] **月額サブスク価格**（§14に推奨レンジ。店舗向けSaaS＝個人向けより高め。競合コンカフェGoスタンダード¥4,800/月が参考。実額は課金前にユーザー承認＝価格判断ゲート）
- [x] **MVPスコープの骨格**（2026-07-05ユーザー指示＝「アプリ＋PC作業サイト＋連携」の三面が必須。§5の★一式で確定。新機能F/H/I込み）
- [ ] **i18n範囲**（MVP日本語のみ確定でよいか／訪日客向けに最初からen入れるか）
- [ ] **オーダー機能のフリー/有料境界**（§14の表に案を1行追加済み＝基本レジは無料/全期間履歴・伝票CSVは有料。伝票履歴の保持期間・メニュー数上限をどこに置くか）
- [x] **初月無料**（2026-07-06ユーザー決定＝プロの最初の1ヶ月は利用無料。実装はストア標準の無料トライアル＝§14「初月無料トライアル」。月額の実額は引き続き要決定）
- [ ] **弁護士確認**（❶個人情報の委託契約/規約の表明保証条項 ❷将来決済時の資金決済法＝§16 ❸姉妹アプリの店舗ランキング公開＝売上データ外部利用の店舗同意・口コミUGC。キャスト個人ランキングは不実装決定＝§32-3）
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
- **結論＝「客側の公開予約受付ページを自動発行するコンカフェ特化SaaS」は依然空白＝差別化成立**。チェキチェキ=手元記録／コンカフェGo=CRM／汎用SaaS=非特化。きゃすりんの軸＝**予約受付導線 × コンカフェ特化（席・指名・生誕祭）× 客はWebだけ**

### 8-2. ナイトレジャー業界 管理システム価格調査（2026-07-05・売上/給与/勤怠機能の価格設計根拠）

きゃすりんの新機能群（売上・給与・勤怠）はナイトレジャーPOS/管理システムの領分と重なるため、同業界10サービスの価格帯を調査：

| サービス | 月額 | 初期費用 | 特徴 |
|---|---|---|---|
| NIGHTCORE | **¥9,800**（全機能込み） | 0円 | 最安帯。給与計算・指名管理・監査ログ |
| GROW | **¥10,000〜** | 0円 | クラウド型・デバイス不問・バック計算自動化 |
| 夜レジ | **¥29,800** | 0円 | コンカフェ対応明記。給与計算が源泉徴収まで対応 |
| YONAREZI | **¥50,000〜** | — | 最高価格帯・経営分析 |
| VENUS | 月額0円 | **¥95,000買い切り** | 唯一の買い切り型。無料版VENUS 5あり |
| Dシステム | 非公開 | ¥55,000 | 累計5,000店舗・コンカフェ対応明記 |
| TRUST | 非公開（3プラン） | — | 1,000店舗以上・コンカフェ導入事例あり |
| CLUB NAVI / ボードマネージャー / イロハ | 非公開〜¥35,000 | — | カスタム開発系 |

- キャスト個人向けアプリ：Melty（顧客10人まで無料→月¥980）等＝店舗向けとは別レイヤー
- **示唆**：①業界POSのボリュームゾーンは**月1〜3万円**＝きゃすりんの想定価格帯（¥1,980〜2,980）はその1/10で「個人経営コンカフェが手を出せる価格」として明確に下を取れる ②既存サービスはすべて**POS/会計が主軸で予約管理は空白**＝§8の差別化結論を補強 ③フリーミアムはほぼ存在しない（VENUS 5のみ）＝**無料プランから入れるSaaSはこの業界でそれ自体が差別化** ④給与計算（時給＋各種バック＋日払い）は業界標準機能＝きゃすりん§3-Fの給与計算はバック計算対応が必須ライン

---
---

# 詳細設計（実装用リファレンス）

> 以下は§1〜§8の方向性に基づく実装レベルの設計。**必読ルール**: 実装前に必ず `memory/app_dev_rules.md`（INIT/MODAL-SAFE/Z-KBD/VER/FONT-JP/PRICE/BE系）と `memory/rules_workflow.md`（W1〜W22）と concafe-yoyaku の実コードを先読みすること。

---

## 9. 画面構成・ナビゲーション設計（二面）

### 9-1. 提供者iOSアプリ（BottomTabNavigator・React Navigation 7）

```
BottomTabNavigator（オーナーロール・6タブ＝2026-07-06にレジ追加）
├─ Reservations  📋  予約台帳（§3-A・コア）
├─ Register      🧾  レジ・オーダー管理（§3-K/§25・2026-07-06追加）
├─ Schedule      🗓️  受付設定・営業日/席/解禁〆切（§3-B）
├─ Casts         👤  キャスト管理（§3-C）
├─ Analytics     📊  分析（§3-F・売上はオーダー自動集計＋手入力）
└─ Settings      ⚙️  設定・アカウント・IAP（§3-G）
```

- **ロール分岐（実装済Rev21〜）**：RootGate が role を解決し、owner→上記タブ／cast→`CastHomeScreen`（自分のシフト・給与・個人情報）／none→`RoleSelectScreen`（招待コード入力）
- タブアイコンは `@expo/vector-icons` MaterialCommunityIcons（絵文字直書き禁止＝ルールTAB-ICON）
  - 予約=`calendar-check` / レジ=`cash-register` / 受付=`clock-edit` / キャスト=`account-star` / 分析=`chart-box` / 設定=`cog`
- `initialRouteName = 'Reservations'`
- 未ログイン時は `AuthScreen`（サインアップ/ログイン）→ 完了後タブ
- 初回ログイン後は `StoreSetupScreen`（店プロフィール＋公開URL発行ウィザード）
- Android戻る：とれはんっ！同様のタブ訪問履歴スタック方式（ルールBACK-1）

| 画面 | 主な責務 | モーダル |
|---|---|---|
| **ReservationsScreen** | 日付別予約タイムライン・受付/変更/キャンセル・チェックイン・手動追加 | 予約詳細/編集（FormModalShell）、手動追加 |
| **RegisterScreen**【§25新設】 | 伝票レーン（open伝票一覧）・メニュー±ステッパーで明細追加・会計（預かり→おつり）・売上自動集計 | CheckoutModal、ChangeResultModal、メニュー編集（FormModalShell）、伝票操作 |
| **ScheduleScreen** | 営業日/時間/席数/1セット時間・解禁/〆切・公開URL発行/QR | 営業設定、URL/QR表示 |
| **CastsScreen** | キャストCRUD・出勤登録・指名ON/OFF | キャスト編集（FormModalShell）、出勤カレンダー |
| **AnalyticsScreen** | 売上入力・日/月別集計・グラフ・キャスト別給与計算・指名ランキング・CSV出力 | 売上入力モーダル、給与明細モーダル、CSV出力設定 |
| **AttendanceScreen**（Analyticsサブ or タブ長押し） | 勤怠管理・欠勤/遅刻/早退記録・月次カレンダー・出勤率集計 | 勤怠記録モーダル |
| **ShiftImageScreen**（Castsサブ or 長押し） | シフト表画像生成・テンプレート選択・AIデザイン・プレビュー・共有 | テンプレートギャラリー、AIプロンプト入力 |
| **SettingsScreen** | 店プロフィール・アカウント削除・規約/PP・通報管理・IAP・言語・テーマ・バージョン | 各種モーダル |
| **CastHomeScreen**（キャストロール・実装済Rev21〜） | キャスト本人ホーム＝自分のシフト・給与明細閲覧・個人情報登録 | 個人情報編集 |
| **RoleSelectScreen**（ロールnone・実装済Rev21〜） | 招待コード入力→キャスト紐付け（`ky_redeem_cast_invite` RPC） | — |

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
- **【2026-07-10・§34】デザイン/UXは concafe-yoyaku へ寄せる再設計を計画化（台帳型タイムライン厳守・ポップアップ・テーマ設定）。詳細＝§34・実装順序＝§19の㊴**

### 9-3. 提供者管理Web（PC・§3-J）【2026-07-05追加】

```
管理Web  kyasuho.pages/#/admin  （客Webと同一Viteアプリ・React.lazyで遅延ロード＝§21）
├─ ログイン（Supabase Auth・アプリと同一アカウント）
├─ サイドバーレイアウト（PC向け・左ナビ＋右コンテンツ）
│   ├─ 📋 予約台帳    （日別一覧＋週ビュー・受付/変更/キャンセル/チェックイン/手動追加）
│   ├─ 🗓️ 受付設定    （営業日・席数・解禁/〆切・公開URL/QR）
│   ├─ 👤 キャスト     （CRUD・出勤スケジュール表形式一括編集）
│   ├─ 📊 売上・給与   （売上入力・集計グラフ・給与計算・給与設定・CSV出力）
│   ├─ 🧾 オーダー     （伝票履歴・日別明細・検索・メニュー管理・当日ダッシュボード＝§25）
│   ├─ 🕐 勤怠        （月次カレンダー・欠勤/遅刻/早退/代打記録・出勤率）
│   ├─ 🎨 シフト表作成 （テンプレ選択→固定プレビュー→カスタマイズ→AI生成→PNG DL・月間/デイリー切替・店舗テンプレ＝§22-2〜22-4）
│   └─ ⚙️ 設定        （店プロフィール・規約/PP・アカウント削除）
└─ 未ログイン時は /#/admin → ログインフォームへ
```

- **slug衝突回避**：`admin` は店slugの予約語（テナント登録時にバリデーションで拒否）
- レスポンシブは「PC優先・タブレット可」（スマホ最適化はアプリの責務＝重複投資しない）
- 客Web（`#/<slug>`）とはルートで分岐。管理画面チャンクは React.lazy で客側バンドルに影響させない

---

## 10. データモデル（マルチテナント・Supabase/Postgres）

> concafe-yoyaku の単一テナントスキーマ（unlock_windows/reservations/menu_items/reservation_pins＋make_reservation RPC）に `tenant_id` を足してマルチテナント化する。相乗り期はテーブル名を `ky_` プレフィックスで衝突回避。

### テーブル（MVP）

| テーブル | 主なカラム | 備考 |
|---|---|---|
| `ky_tenants` | id, slug(公開URL用), name, genre, owner_user_id, business_info(jsonb), **sns_links(jsonb・店舗SNS＝§31)**, is_suspended, plan('free'/'pro'・default 'free') | 店舗＝テナント。slugが公開ページのキー。**planはアプリ/管理Web共通のエンティトルメント源泉**（§14・IAP購入→レシート検証→この列更新→三面が参照） |
| `ky_casts` | id, tenant_id, name, **name_kana(ふりがな・あいうえお順ソートキー＝§28-1)**, photo_url(お店写真＝§30), sns_links(jsonb), bio, accepts_nomination(bool), sort_order | キャスト |
| `ky_shifts` | id, tenant_id, cast_id, date, start_at, end_at | 出勤枠 |
| `ky_unlock_windows` | id, tenant_id, date, open_from, close_at, seats, set_minutes | 受付解禁ウィンドウ＋自動〆切（concafe＋レジさぽ流用） |
| `ky_reservations` | id, tenant_id, date, slot, seat_no, customer_name, contact, party_size, cast_id(指名), **seat_type_id(null可・§29)**, note, status, created_at | 予約本体 |
| `ky_reservation_pins` | reservation_id, pin_hash | 4桁PIN（客の予約編集・concafe流用） |
| `ky_attendance` | id, tenant_id, cast_id, date, status(present/late/early_leave/absent/substitute), reason, substitute_cast_id, check_in_at, check_out_at, note, created_at, updated_at | **勤怠記録**（§3-H） |
| `ky_sales` | id, tenant_id, date, total_revenue, set_count, drink_count, nomination_count, other_revenue, note, **entry_mode('manual'/'auto')**, created_at, updated_at | **日別売上**（§3-F）。entry_mode追加（§25-4）＝'auto'行はオーダー会計が自動upsert・'manual'行は手入力で自動上書きしない（二重計上防止）。tenant_id×date UNIQUE |
| `ky_menu_items` | id, tenant_id, category('set'/'extension'/'nomination'/'cast_drink'/'drink'/'food'/'cheki'/'other'/'discount'), name, price, needs_cast(bool), sort_order, is_active | **メニューマスタ**（§3-K/§25・オーダーの商品台帳。'discount'＝定型割引・負のprice＝§25-7） |
| `ky_orders` | id, tenant_id, biz_date, seat_no, reservation_id(null可), customer_label, status('open'/'closed'/'void'), opened_at, closed_at, subtotal, deposit, change, payment_method('cash'/'card'/'qr'/'other'), note | **伝票**（§25・来店グループ単位。予約チェックインと紐付け可） |
| `ky_order_items` | id, order_id, tenant_id, menu_item_id(null可＝席料自動明細は§29), **category**, name, price, qty, cast_id(null可), created_at | **オーダー明細**（§25・category/name/priceはスナップショット＝メニュー改定/削除後も過去伝票不変・集計がjoin不要。cast_id＝給与バック集計の源泉） |
| `ky_cast_payroll` | id, tenant_id, cast_id, date, hours_worked, base_pay, nomination_back, drink_back, other_back, deductions, total_pay, created_at, updated_at | **キャスト日別給与**（§3-F） |
| `ky_payroll_settings` | id, tenant_id, base_hourly_rate, nomination_back_rate, drink_back_rate, late_deduction, created_at, updated_at | **給与計算設定**（時給/バック率/遅刻控除等） |
| `ky_shift_templates` | id, tenant_id, name, template_key, custom_settings(jsonb), logo_url, created_at | **シフト表テンプレート設定**（§3-I） |
| `ky_reports` | id, tenant_id, target_type, target_id, reporter, reason, status, created_at, resolved_at | **UGC通報**（§15） |
| `ky_blocks` | id, tenant_id, blocker_user_id, blocked_key | **ブロック**（§15） |
| `ky_expenses` | id, tenant_id, date, category, amount, memo, created_at, updated_at | **経費**（§27・人件費は含めない＝ky_cast_payroll参照） |
| `ky_seat_types` | id, tenant_id, name, seat_fee, sort_order, is_active | **席種・席料**（§29・MVPは希望属性） |

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
  id: string; tenantId: string; name: string;
  nameKana: string | null; // §28-1 あいうえお順ソートキー（2026-07-06追加）
  photoUrl: string | null; // §30 お店写真
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

// §25 オーダー管理（2026-07-06追加）
// 'seat'＝席料の伝票明細カテゴリ（§29・ky_seat_types由来の自動明細専用。メニューマスタでは使わない）
type MenuCategory = 'set' | 'extension' | 'nomination' | 'cast_drink' | 'drink' | 'food' | 'cheki' | 'seat' | 'other';
type OrderStatus = 'open' | 'closed' | 'void';
type PaymentMethod = 'cash' | 'card' | 'qr' | 'other';

type MenuItem = {
  id: string; tenantId: string; category: MenuCategory; name: string;
  price: number; needsCast: boolean; sortOrder: number; isActive: boolean;
};
type Order = {
  id: string; tenantId: string; bizDate: string; seatNo: number | null;
  reservationId: string | null; customerLabel: string; status: OrderStatus;
  openedAt: string; closedAt: string | null; subtotal: number;
  deposit: number; change: number; paymentMethod: PaymentMethod; note: string;
};
type OrderItem = {
  id: string; orderId: string; tenantId: string; menuItemId: string | null;
  category: MenuCategory; name: string; price: number; qty: number;
  castId: string | null; createdAt: string;
};

// §27 経費・§29 席種（2026-07-06追加）
type ExpenseCategory =
  | 'purchase' | 'rent' | 'utilities' | 'communication' | 'advertising'
  | 'costume' | 'supplies' | 'outsourcing' | 'misc';
type Expense = {
  id: string; tenantId: string; date: string; category: ExpenseCategory;
  amount: number; memo: string; createdAt: string; updatedAt: string;
};
type SeatType = {
  id: string; tenantId: string; name: string; seatFee: number;
  sortOrder: number; isActive: boolean;
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
| TermsOfUseModal / PrivacyPolicyModal / ContactFormModal | とれはんっ！ | 文面をきゃすりん用（§16の表明保証条項） |
| **通報/ブロックUI** | とれはんっ！（R28実装） | §15の4要件 |
| 自動〆切（close_at） | レジさぽっ！ 取り置きRev13 | ScheduleScreenの〆切設定 |
| **レジ画面（±ステッパー/カート/会計バー）** | レジさぽっ！ `src/screens/RegisterScreen.tsx` | 頒布物→メニュー・SQLite→Supabase(ky_orders)・**伝票（open→締め）概念を追加**（§25） |
| **CheckoutModal（明細→預かり金→おつり）** | レジさぽっ！ `src/components/CheckoutModal.tsx` | 支払方法・明細UIは維持・記録先を ky_orders へ |
| **ChangeResultModal（おつり大表示）** | レジさぽっ！ `src/components/ChangeResultModal.tsx` | そのまま |

### 客Web｜流用（concafe-yoyakuからコピー＋マルチテナント化）

| コンポーネント | 流用元 | 改変 |
|---|---|---|
| CustomerPage | concafe-yoyaku `src/.../CustomerPage.tsx` | URL `<店slug>` から tenant 解決を追加 |
| Calendar | concafe-yoyaku `Calendar.tsx` | tenant_id フィルタ |
| CustomerTimeline | concafe-yoyaku `CustomerTimeline.tsx` | 空き枠表示 |
| ReservationModal | concafe-yoyaku `ReservationModal.tsx` | 指名キャスト選択を追加 |
| PIN編集 | concafe-yoyaku `reservation_pins` フロー | そのまま |
| make_reservation RPC | concafe-yoyaku `supabase/migrations/` | tenant_id 引数追加・advisory lockキーに tenant を含める |

### 管理Web｜新規（客Webの基盤＝supabaseクライアント/型/timeUtils/hooksを共有）【2026-07-05追加】

| コンポーネント | 責務 |
|---|---|
| AdminApp / AdminLayout | `#/admin` 配下のルーティング＋サイドバーレイアウト（React.lazy遅延ロード） |
| AdminLogin | Supabase Authログイン（signInWithPassword・アプリと同一アカウント） |
| AdminReservations | 予約台帳（日別一覧＋週ビュー・状態変更・手動追加） |
| AdminSchedule | 受付設定（unlock_windows CRUD・席数・close_at・公開URL/QR） |
| AdminCasts | キャストCRUD＋出勤スケジュール表形式一括編集 |
| AdminSales | 売上入力・月次集計・グラフ（軽量SVG自前描画＝外部chartライブラリ不要） |
| AdminPayroll | 給与計算・給与設定（ky_payroll_settings）・明細表示 |
| AdminAttendance | 勤怠月次カレンダー・記録編集・出勤率集計 |
| AdminCsvExport | 売上/給与CSV生成→ブラウザダウンロード（§23の列仕様） |
| AdminShiftImage | シフト表画像生成（テンプレギャラリー→プレビュー→カスタマイズ→AI→PNG DL＝§22） |
| AdminSettings | 店プロフィール編集・規約/PP・アカウント削除 |
| AdminOrders | 伝票履歴・日別明細ドリルダウン・検索・当日売上ダッシュボード（ky_orders Realtime購読＝§25-4） |
| AdminMenu | メニューマスタCRUD（PC優位の一括編集＝§25） |

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
| MenuEditModal | メニューマスタCRUD（FormModalShell・§25） |
| OrderTicketLane | open伝票のレーン表示・新規/再開/void（§25-3） |

---

## 12. マルチテナント・認証・RLS設計

### 認証（Supabase Auth）
- 提供者＝メール＋パスワードのセルフサインアップ。サインアップ直後に `ky_tenants` を1行作成し `owner_user_id` を紐付け（＝1アカウント1店舗MVP。複数店舗は有料/後フェーズ）
- キャスト＝**招待コード方式（実装済Rev21〜）**。オーナーが招待コード発行→キャスト本人がサインアップ→コード入力（`ky_redeem_cast_invite` RPC）→ `ky_casts.user_id` 紐付け。ロール解決＝ky_tenants.owner_user_id→owner／ky_casts.user_id→cast／どちらも無し→none（RoleSelectScreen）。キャストは自分の行（シフト・給与明細）のみ self_select
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
- **オーダー系（ky_menu_items/ky_orders/ky_order_items・§25）**：オーナーのみ全操作（他テーブルと同じtenantポリシー）。キャストのアクセスは当面なし（給与は ky_cast_payroll の self_select 経由）。客Web(anon)からは不可視
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

| 機能 | 無料（Free） | 有料（きゃすりんプロ・月額サブスク） |
|---|---|---|
| 店舗数 | 1店舗 | 複数店舗 |
| キャスト登録 | 〜3人 | 無制限 |
| 月間予約受付 | 〜100件 | 無制限 |
| 基本予約（席・日時・PIN編集） | ◯ | ◯ |
| 公開予約ページ | ◯（「きゃすりん」バッジ付き） | ◯（バッジ非表示・独自ブランディング） |
| キャスト指名予約 | △（1キャストのみ or なし） | ◯ |
| **勤怠管理（欠勤/遅刻/早退/代打）** | ◯（基本記録のみ） | ◯（集計・CSV・代打通知） |
| **売上管理（日別/月別入力・集計）** | △（当月のみ・グラフなし） | ◯（全期間・グラフ・比較分析） |
| **オーダー管理（レジ・伝票・メニュー＝§25）** | ◯（基本レジ・当月伝票履歴） | ◯（全期間履歴・伝票明細CSV） |
| **キャスト給与計算（時給×勤務＋歩合）** | ✗ | ◯ |
| **税金関連CSV出力（売上/給与/経費）** | ✗ | ◯（弥生/freee/MFクラウド互換） |
| **シフト表画像生成（テンプレート20種）** | ◯（透かし付き・月3回） | ◯（透かしなし・無制限） |
| **AIシフト表デザイン生成** | ✗ | ◯ |
| 生誕祭/周年イベント枠 | ✗ | ◯ |
| 客向けメール/リマインダー | ✗ | ◯ |
| 分析ダッシュボード | ✗（当日集計のみ） | ◯（期間集計・指名ランキング） |

- **フラグ設計**：`config/features.ts` で `IAP_ENABLED=false`（MVP）。有料判定は `EntitlementContext.plan` を全ゲートが通す共通関数（ルールGATE-1＝上限は1関数に集約）
- **上限ゲート**：キャスト追加/予約受付は `canAddCast()` / `canAcceptReservation()` の共通ゲートを全経路（アプリ手動追加・客Web予約）が通す（散在禁止＝ルールGATE-1）

### 商品構成（案・価格は要決定＝§6 TODO）

| 商品ID | 種別 | 価格（案・要ユーザー承認） | 内容 |
|---|---|---|---|
| `kyasuho_pro_monthly` | 自動更新サブスク | **¥1,980〜¥2,980/月** | プロ全機能 |
| `kyasuho_pro_yearly` | 自動更新サブスク | 月額×10ヶ月相当（2ヶ月分割引） | 年払い |

**価格根拠（§8-2の2026-07-05調査）**：ナイトレジャーPOSのボリュームゾーンは月1〜3万円（NIGHTCORE¥9,800／夜レジ¥29,800／YONAREZI¥50,000）、コンカフェ特化CRMのコンカフェGoが¥4,800。きゃすりん¥1,980〜2,980は**POSの1/10・コンカフェGoの半額前後**＝「個人経営コンカフェが月のドリンク数杯分で導入できる」ポジション。売上/給与/勤怠/シフト表というPOS領分の機能を持ちながらこの価格帯で下を取る。かつ**無料プランから始められる**のは業界でほぼ唯一（§8-2③）＝店舗獲得の入口。

### 初月無料トライアル（2026-07-06決定 → **2026-07-10 改定・Rev70＝サーバーサイド・トライアルへ一本化をユーザー承認**）

- **最初の1ヶ月（チラシ等のクーポンコード入力で2ヶ月）は全モジュール無料**。ストアのお試しオファー（ASC Introductory Offer／Play free trial）は**使わない**：
  - トライアルは `ky_billing_subscriptions` の **channel='promo' 行**（status='trialing'・selected_modules=全モジュール）として全チャネル統一でサーバーサイド管理＝BILLING_DESIGN §17
  - 改定理由：①カード登録・ストア操作なしで即体験（チラシ→QR→体験のCVR）②クーポンによる延長が自在③「ストア1ヶ月＋独自2ヶ月」の意図しないスタック防止④全部入り体験→終了時に必要モジュールだけ選ぶアラカルト営業導線
  - ストアの Introductory Offer / free trial は **ASC/Play側で設定しない**（設定すると promo とスタックする）
- 再取得防止は自前で持つ：redemptions を owner_user_id でも記録＋「過去に台帳行（promo含む）を持った owner のテナントはトライアル不可」をRPC判定（BILLING_DESIGN §17-4）
- 訴求面：無料プランが既にあるので、トライアルは**アップグレード導線**として見せる（価格・期間の固定文字ハードコード禁止＝R29と同思想は不変）
- **トライアル終了後に自動課金しない**（明示的な購入操作があって初めて課金＝ダークパターン回避・チラシ/LPの安心材料として明記可）
- Web/ストアどのチャネルでも同条件（プラットフォームで差をつけない＝下記「三面共有」の方針どおり）

### エンティトルメントの三面共有（アプリ⇔管理Web）【2026-07-05追加】

- 権利の源泉は **`ky_tenants.plan`**（DB1箇所）。IAP購入→レシート検証→plan更新→アプリ/管理Web/客Web(バッジ表示)の三面が同じ列を参照
- 管理Webの有料機能ゲートもアプリと同一境界（プラットフォームで差をつけない）。**購入導線はMVP後の設計論点**：Apple IAPで買った権利をWebで使うのは規約上問題なし。Web側にStripe等の独自決済を置くか（Appleアプリ内からWeb決済への誘導はNGなので、置く場合もアプリ内からはリンクしない）は課金ON化時に決定＝§6 TODOに含める
- **【2026-07-10 更新・Rev68】カード決済（Web直販）＋銀行振込（年払い請求書）の詳細事前設計を `docs/BILLING_DESIGN.md` に策定**（Stripe採用・チャネル横断契約台帳 ky_billing_subscriptions・plan導出一本化・法規制整理・BILL-0〜4フェーズ）。スマホ新法（2025-12-18施行）対応後の日本では上記「アプリ内からWeb決済への誘導はNG」は**「リンクなしテキスト誘導=手数料0%・リンクアウト=15%で可」に更新**（詳細は BILLING_DESIGN §2-6・実装時に最新規約を再確認）
- **【2026-07-10 追補・Rev69】課金の商品軸を「free/pro 2値」から「モジュール選択型（アラカルト）×契約期間（月/半年/年・長期割引）」へ拡張＝ユーザー決定（競合Dシステムの全部入り固定価格との差別化）**。①店舗が機能モジュール（shift/sales/register/attendance/expense/analytics/limits）を自由選択・**個数**で料金決定 ②半年≒8%OFF/年≒17%OFF目安（実額はユーザーゲート） ③チラシのクーポンコードでトライアル1ヶ月→2ヶ月延長（入力は管理Webのみ・アプリ内はテキスト誘導まで）。詳細= BILLING_DESIGN 第2部 §15〜§18。`ky_tenants.plan` は互換用の粗い値として残し**実体は entitlements（モジュール配列・service_roleのみ書込=FIN-4拡張）**。ゲート判定は `features.ts` の `isModuleEnabled()` 1関数に集約（GATE-1・Rev69で骨格実装済み・IAP_ENABLED=false の間は全モジュール有効=挙動不変）。⚠️本追補のトライアル方式（サーバーサイド一本化）は 2026-07-06 の「ASC Introductory Offer採用」決定の**差し替え提案＝未承認の仕様分岐**（BILLING_DESIGN §17-1）

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

## 17. Web設計（客側公開Web＋提供者管理Web＝1つのViteアプリ）

- **スタック**：React+Vite+TS strict+Supabase+GitHub Pages（HashRouter・VITE_BASE_PATH）＝concafe-yoyaku/レジさぽ買い手Webと同一。**客Webと管理Webは同一リポ・同一Viteアプリ**（`kyasuho/web/`）でルート分岐（§21）
- **マルチテナント化の要点**：ルート `#/<店slug>` から `ky_tenants.slug` でテナント解決→そのテナントの公開データのみ表示。`#/admin` は管理Web（slug予約語）
- **anonキー**：公開OK（WEB4＝anonは公開安全・service_roleは出荷禁止）。客＝公開SELECT＋予約INSERT（RPC）のみ。**提供者＝anonキー＋Authセッションで、既存RLS（owner_user_id=auth.uid()）がアプリと同一の権限を管理Webにも自動適用**＝バックエンド追加実装ほぼ不要が三面構成の利点
- **デプロイ**：GitHub Actions（deploy.yml で `.env` をCI生成＝WEB2/WEB1）。公開は実HTTP実証（WEB5）＋**公開操作はユーザー承認（WEB9・2026-07-05セッションで承認済み）**
- **配布**：提供者アプリの `PublicUrlCard` が `https://rurifukuro.github.io/kyasuho/#/<店slug>` を発行・QR化して客へ。設定画面の「PCで作業」導線が `#/admin` URLを提示（§24）

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
（Webは `web/` サブディレクトリ＝客Web＋管理Webの1 Viteアプリ。構成は§21）
```
web/src/
├── components/   … 客Web（TenantPage/Calendar/TimeSlotList/ReservationModal 等・Rev12実装済）
├── admin/        … 管理Web（AdminApp/AdminLayout/pages/ … React.lazyで遅延ロード）
├── shiftTemplates/ … シフト表テンプレート定義＋レンダラー（正準＝§22。アプリへ定義を同期）
├── hooks/ lib/   … supabase.ts/types.ts/timeUtils.ts（客・管理で共有）
└── App.tsx       … HashRouter（#/admin → AdminApp ／ #/<slug> → TenantPage）
```
### 6. app.json
```json
{ "expo": {
  "name": "きゃすりん", "slug": "kyasuho-app", "scheme": "kyasuho", "version": "1.0.0",
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

### 9. 実装順序（1〜17は Rev24 までに完了。18〜21＝オーダー管理／22〜27＝第2次検討分＝2026-07-06追加）
1. ✅ 基盤（scaffold・git Rev1・型定義・Theme/Language/i18n・supabase・AuthContext）
2. ✅ 認証（AuthScreen・サインアップ→テナント自動作成・RLS）
3. ✅ 受付設定（ScheduleScreen・席/解禁/〆切・公開URL発行）
4. ✅ 予約台帳（ReservationsScreen・タイムライン・手動追加・make_reservation RPC）
5. ✅ 客Web（Rev12・マルチテナント化・PIN編集）
6. ✅ キャスト管理（CastsScreen・指名）
7. ✅ 通知基盤（提供者への予約プッシュ）
8. ✅ UGC 4要件 ／ 9. ✅ 法務（アカウント削除・規約/PP） ／ 10. ✅ 設定
11. ✅ **新機能DB**（migration: ky_attendance/ky_sales/ky_cast_payroll/ky_payroll_settings/ky_shift_templates＋tenants.plan）
12. ✅ **アプリ：売上・給与・勤怠**（AnalyticsScreen拡張＋AttendanceScreen＝§23）
13. ✅ **管理Web基盤**（`#/admin` ルート・AdminLayout・ログイン・予約台帳/受付設定/キャスト＝既存hooksの管理版）
14. ✅ **管理Web：売上・給与・勤怠・CSV**（PC主戦場機能＝§23）
15. ✅ **シフト表エンジン**（テンプレ定義20種＋Webレンダラー＋PNG出力→アプリ移植＝§22）
16. ✅ **AIデザイン生成**（Edge Function `ky-shift-design`＝§22）
17. ✅ **連携仕上げ**（アプリ「PCで作業」導線・リアルタイム反映＝§24）・公開・スモーク

（＋Rev21〜24でキャストアカウント基盤＝2系統ログイン・招待コード・キャスト側ホーム・パスワードリセット・ロール分岐を追加実装済）

18. **オーダーDB**（migration: ky_menu_items/ky_orders/ky_order_items＋ky_sales.entry_mode＝§25-2）
19. **アプリ：メニュー管理＋レジ**（RegisterScreenタブ・レジさぽっ！流用・伝票open→明細→会計→closed・**お客様名入力欄＋一時保存ボタン**＝§25-3・**会計時割引＝金額/％/定型クーポン＝§25-7**）
20. **売上自動集計＋給与連携**（ky_sales自動upsert・給与ドリンク数プリフィル＝§25-4/25-5）
21. **管理Web：オーダー**（AdminOrders/AdminMenu・当日Realtimeダッシュボード＝§25-4）
22. **是正パック**（§28＝日付チップ折返し修正・「客」→「お客様」3キー・ContactFormModal流用差替え・生年月日ホイールピッカー＋availableFromのCalendarModal化・手動予約追加に指名ドロップダウン）
23. **name_kana＋ドロップダウン統一**（migration: ky_casts.name_kana・キャスト登録ふりがな欄・客Web指名のkana順ソート・AnchoredDropdown移植＝§28-1）
24. **席種・席料**（migration: ky_seat_types＋ky_reservations.seat_type_id・受付設定CRUD・客Web席種選択・伝票への席料自動明細＝§29）
25. **キャスト写真**（Storage `ky-cast-photos`・証明写真＋お店写真UI・管理側差替え・Edge Function `ky-cast-leave`＝離脱時自動削除・PP改訂＝§30）
26. **経費・確定申告補助**（migration: ky_expenses・AdminExpenses・アプリ経費入力・月次収支/年次サマリ・経費CSV＝§27）
27. **シフト表SNS投稿**（ky_tenants.sns_links・X intent/Instagram起動・投稿文テンプレ・予約QR埋め込みオプション＝§31）
28. **シフト表拡張パック**（プレビューsticky固定＝§22-4・デイリー出勤表 daily-lineup＋デフォルトイラスト同梱＝§22-2。写真表示は㉕の§30基盤に依存）
29. **店舗独自テンプレート取込**（Storageアップロード・配置領域エディタ・第3の選択肢「店舗テンプレート」＝§22-3。検証はユーザー提供見本2枚＝ローカル限定）
30. **ランキング集計の仕込み**（migration: ky_tenants.prefecture/area/ranking_opt_in＋店舗プロフィール編集に欄追加＝§32-3。会計確定の closeOrder() 集約は⑱〜⑳実装時に先取り＝§32-2）

（以下31〜37は後フェーズ枠＝第3次棚卸し§26-3の◯/△を計画化＝2026-07-06ユーザー指示「◯と△は計画に入れる」。着手順・着手時期は都度ユーザーと合意）

31. **ノーショー履歴活用**（#38＝同一連絡先の過去no_show回数を予約詳細にバッジ表示＋月次集計）
32. **キャスト成績ビュー**（#39＝管理Webに指名/ドリンク/売上貢献の月次ランキング・推移グラフ。**店の内部機能＝外部公開はしない**。姉妹アプリのキャスト個人ランキングは不実装＝§32-1）
33. **人件費概算**（#40＝シフト作成画面に時給×シフト時間の見込み人件費を表示）
34. **イベントカレンダー**（#44＝生誕祭以外の店イベント告知・T10生誕祭カレンダーの拡張）
35. **客向け通知パック**（#11リマインダー＋#45キャンセル待ち＝メール送信基盤とセット・有料機能候補）
36. **スタンプ・クーポン**（#42のスタンプ部分＝2026-07-06ユーザー決定で計画入り。姉妹アプリと同時期に実装＝§32-2。会計連動自動加算・クーポン確認ポップアップ）
37. **ボトルキープ管理／回数券・チェキ券**（#41・#42残り＝△のまま将来枠。回数券系の参入判断はユーザー相談継続）
38. **シフト表取込2モード化＋セル個別微調整**（モードA廃止・空テンプレ(B)決定論グリッド検出・任意画像背景(C)可読性ガード＝§22-5。**モードB/C実装済みRev67**。残=ShiftPlacementV2境界配列＋境界線ドラッグ/セル個別オフセット）
39. **客Web予約ページ再設計**（concafe-yoyaku UI移植＝台帳型タイムライン厳守＋予約ポップアップ＋ご注文予定＋店舗テーマ設定（カラー/背景写真）＝§34。**既存機能の削除禁止＝§34-5保全ゲート必須**。分割=(a)テーマ→(b)タイムライン＋ポップアップ→(c)注文予定＋RPC v2）

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

## 21. 提供者管理Web 詳細設計（§3-J／2026-07-05新設）

### アーキテクチャ＝「客Webに同居・別チャンク」

- **同一Viteアプリ**（`kyasuho/web/`）に `#/admin` ルートを追加。理由：supabase.ts/types.ts/timeUtils.ts/hooks を複製せず共有でき、デプロイも1本（GitHub Pages＋deploy.yml）
- **チャンク分離**：`const AdminApp = React.lazy(() => import('./admin/AdminApp'))` ＝客ページのバンドルサイズに管理コードが乗らない
- **認証**：`supabase.auth.signInWithPassword`（Web版supabase-jsはlocalStorageにセッション永続）。ログイン後 `ky_tenants where owner_user_id = auth.uid()` で自テナント解決（アプリのAuthContextと同じ流れ）
- **権限**：既存RLS（owner_user_id = auth.uid()）がそのまま効く＝**管理Web用のポリシー追加は原則不要**。書き込みもアプリと同一テーブル/RPC
- **UI方針**：PC優先（サイドバー＋テーブル中心・最小幅960px想定）。タブレット可。スマホ最適化はしない（アプリの責務・重複投資回避）。ダーク/ライトはprefers-color-scheme追従
- **i18n**：MVPは日本語直書きでよい（客Web同様）。アプリのt()体系とは独立（Web側は将来必要になったら導入）

### 画面と既存資産の対応

| 管理Web画面 | 再利用する既存資産（客Web/アプリ） |
|---|---|
| AdminReservations | useReservations/useCasts hooks・types.ts・timeUtils |
| AdminSchedule | useUnlockWindows・（アプリScheduleScreenのロジック参照） |
| AdminCasts | useCasts/useShifts |
| AdminSales/Payroll/Attendance | 新規（§23のサービス層をWeb版で書く・計算ロジックはアプリと同式） |
| AdminShiftImage | §22エンジン（Web側が正準） |
| AdminOrders/AdminMenu | 新規（§25。アプリのレジと同一テーブル ky_orders/ky_order_items/ky_menu_items を参照・当日はRealtime購読） |
| AdminExpenses | 新規（§27。経費CRUD・カテゴリ別集計・月次収支・年次サマリ・経費CSV＝2026-07-06追加） |

---

## 22. シフト表画像生成エンジン（§3-I／2026-07-05新設）

### 核心設計＝「テンプレート＝純データ、AI＝パラメータ生成器、描画＝共通レンダラー」

AIに画像そのものを描かせない。**AIもテンプレートも `ShiftTemplateDefinition`（純データ）を出すだけ**で、描画は自前レンダラーが行う。→ 日本語文字の品質担保・出力の一貫性・生成コスト極小（テキスト1回分）・オフライン動作（テンプレ20種はAI不要）。

```typescript
type ShiftTemplateDefinition = {
  id: string;               // 'elegant-rose' 等（AI生成は 'ai-<uuid>'）
  name: string;             // 表示名
  category: 'elegant' | 'pop' | 'gothic' | 'wafu' | 'simple' | 'neon' | 'pastel' | 'seasonal' | 'ai';
  size: { w: number; h: number };          // 1080x1350（4:5）基準・1080x1920（9:16）派生
  palette: { bg: string; bgGradient?: [string, string]; headerText: string; dayLabel: string;
             castName: string; timeText: string; accent: string; cellBg: string; cellBorder: string };
  fonts: { header: string; body: string }; // 同梱・システムフォントから指定（FONT-JP準拠）
  layout: 'month-grid' | 'week-rows' | 'daily-lineup'; // 月間カレンダー格子 ／ 週別行 ／ 日別出勤（§22-2）
  decorations: { cornerRadius: number; cellGap: number; headerStyle: 'ribbon' | 'plain' | 'underline';
                 motif?: 'stars' | 'hearts' | 'flowers' | 'sakura' | 'lightning' | 'none' };
  logoSlot: boolean;        // 店ロゴ挿入枠
};
```

- **入力データ**：`ky_shifts`（対象月）＋ `ky_casts` → `{ date, casts: [{name, start, end}] }[]` に集計（両プラットフォーム共通の純関数）
- **Webレンダラー（正準）**：DOM＋CSSで組んで `html-to-image` の `toPng()` でPNG化。プレビューはCSS `transform: scale()`。フォントはCSS `@font-face`（アプリ同梱と同系の日本語フォント）
- **アプリレンダラー**：同じ定義を RN View で描画→ `react-native-view-shot` でPNG→ `expo-media-library` 保存＋シェアシート。**定義20種の正準は `web/src/shiftTemplates/definitions.ts`・アプリへは同一内容をコピー同期**（ファイル冒頭コメントで正準明記）
- **テンプレ20種内訳**：エレガント3・ポップ3・ゴシック2・和風2・シンプル3・ネオン2・パステル3・シーズナル2
- **カスタマイズ**：選択テンプレの palette/motif/logoSlot をUI上で上書き→ `ky_shift_templates.custom_settings(jsonb)` に保存（お気に入り）

### AI独自デザイン生成（Edge Function `ky-shift-design`）

- **キーの置き場**：ANTHROPIC_API_KEY は Supabase Edge Function Secret（**R13＝クライアント埋め込み禁止**。daipos-generate と同パターン）
- **フロー**：ユーザーの雰囲気テキスト（例「紫基調のゴシックで薔薇モチーフ」）＋店名 → Edge Function → Claude（JSONスキーマをプロンプト指定）→ `ShiftTemplateDefinition` JSON → クライアントでバリデーション（不正値は既定値マージ）→ 共通レンダラー描画
- **ガード**：レート制限（テナント毎に日N回・`ky_ai_usage` 相当のカウンタ or 当面クライアント制限）。課金ON後は有料専用（§14）
- **フォールバック**：AI応答不正/タイムアウト時は「シンプル」テンプレに雰囲気パレットだけ反映して返す（空振りにしない）

### 22-2. デイリー出勤表（「本日の出勤キャスト」日別画像＝T8統合／2026-07-06第3次）

> **経緯**：T8として引き継ぎ指示書（WORK_PROGRESS.md 3-B）に設計済みだったがSPEC本体に未統合だった（#35是正）。以後この節が正・実装は§19-㉘。

- `ky_shifts` から**当日出勤のキャストを抽出し、写真入りの出勤一覧画像**を生成（月間シフト表の1日版。毎日のSNS告知はコンカフェ実務の定番）
- レイアウト：`ShiftTemplateDefinition.layout` に **`daily-lineup`** を追加（月間/週別と同じ共通レンダラーで描画＝別エンジンを作らない）
- **写真グリッド**：キャスト写真（§30のお店写真）＋名前＋出勤時間。**出勤人数に応じた可変グリッド**（人数がグリッド数を超える/足りない日でも崩れない）
- 写真未登録キャスト・体験入店用に**デフォルトイラスト1枚を同梱**（黒髪ロングのメイドの女の子・特定店舗に寄らないシンプルな可愛いイラスト調。生成はメモリ image_gen_gemini_rules IG系）
- テンプレは既存20種の palette/decorations をそのまま流用（デイリー専用テンプレを増やさない＝カテゴリ毎の見た目一貫性・保守1系統）
- 日付ナビ（前日/翌日/今日）＋月間と同じ導線（SNS投稿ボタン§31・予約QR埋め込み#34）
- キャスト写真は§30依存＝実装順序は㉕（写真基盤）の後

### 22-3. 店舗独自テンプレートの取り込み（T16統合／2026-07-06第3次）

> **経緯**：T16として引き継ぎ指示書に設計済み・SPEC未統合だった（#36是正）。**サク品っ！のキャンバス方式（背景に任意画像を敷きデータを重ねる）と同思想**。

- 各店舗が**既に持っている自前のテンプレートデザイン画像をアップロード**→背景・飾り枠として使い、その上に出勤キャスト（写真/名前/時間）を重ねる。内蔵テンプレ20種・AIデザインに並ぶ**第3の選択肢「店舗テンプレート」**
- **配置領域指定**：矩形指定＋行列数入力の最小UIから開始（グリッド範囲・タイトル位置の簡易エディタ）。発展形＝`ky-shift-design` を拡張しアップロード画像から配置領域をAIが推定して初期値を自動セット
- **月間スケジュール表と デイリー出勤表（§22-2）の両方**で使える（T16要件）。可変グリッド要件も同様に適用
- 保存先：Supabase Storage（tenant毎パス＋RLS。§30 `ky-cast-photos` のバケット設計と揃える）
- 保存後はテンプレ一覧に「うちの店のテンプレ」として並ぶ（`ky_shift_templates.template_key='shop'`＋画像URL・配置定義を custom_settings に保存）
- **取り込みテストはユーザー提供の見本2枚を必ず使う**（`docs/shop_template_reference/` の月間・日次サンプル。**実在店舗・実在人物の写真＝gitignore済み・コミット/公開/SNS出力厳禁**＝ローカル検証専用）
- **改善仕様（取り込み2モード化＝モードA廃止・空テンプレ決定論検出(B)・任意画像背景(C)＋セル個別微調整）＝§22-5**（2026-07-07ユーザー指示。モードB/C実装済みRev67。本節Rev61実装の後継設計）

### 22-4. 作成画面のUI標準（プレビュー常時固定＝2026-07-06ユーザー指示）

- **プレビューは常に画面内に固定表示する**（管理画面左側のナビタブと同じ発想＝スクロールで消えない）。設定パネル（AI/テンプレ20種/カスタマイズ/お気に入り）は縦に長く、現状はプレビューごと画面外へ流れる（#37）
- 管理Web実装：`.shift-preview-col { position: sticky; top: 16px; }`（`.shift-layout` は `align-items: flex-start` 済み＝sticky が効く前提は整っている）
- プレビュー高がビューポートを超える場合（9:16選択時）：`max-height: calc(100vh - 32px)` を目安に PREVIEW_SCALE を可変化して収める（固定 0.42 をやめる）
- アプリ側 ShiftImageScreen も同思想（プレビュー上部固定・設定エリアのみ下部スクロール）

### 22-5. 店舗テンプレート取込の改善＝取り込み2モード化＋セル個別微調整（2026-07-07ユーザー指示・モードB/C実装済みRev67・§19の㊳）

> **経緯**：§22-3の初期実装（Rev61＝`ky-shift-analyze` によるClaude Vision解析＋`CustomPlacement` 均等グリッドレンダラー＋gridArea一括スライダー）に対する修正改善。ユーザー指示＝「店舗の持っている**空テンプレート**、**特定の画像を背景に**シフト表を作成できるように」＋同日ユーザーメモ（①空/記入済みの取り込みモード分離 ②日別セルの個別微調整）の正式仕様化。

#### 現行実装の課題（改善の動機）

| # | 課題 | 原因 |
|---|---|---|
| 1 | 空テンプレート（文字未記入）の解析精度が出ない | `ky-shift-analyze` のプロンプトが「記入済みシフト表」前提＝日付・キャスト名の記載位置を手がかりにグリッドを推定するため、空画像では手がかり不足 |
| 2 | 手書き風・不均等グリッドに追従できない | `ShiftPlacement` が cols/rows の**均等分割**前提（cellW=gridW/cols）＝列幅・行高が1本ズレると以降の全セルがずれる |
| 3 | グリッドを持たない任意画像を背景にできない | 取り込み＝「AI解析必須」の単一フロー。解析が失敗・無意味な画像（内装写真・イラスト等）では使えない |
| 4 | 微調整手段が gridArea 全体の x/y/w/h スライダーのみ | セル単位・境界線単位の補正手段がない |

#### 取り込み2モード（アップロード直後にモード選択UIを置く）

> **モードA廃止（2026-07-07ユーザー指示）**：Rev61の`ky-shift-analyze`（Claude Vision）によるAI解析は廃止。Edge Function `ky-shift-analyze` と `adminApi.ts` の `analyzeShiftImage` は未削除だが**AdminShiftImageからのimport/呼び出しは除去済み**。

現行の「AIで解析」単独ボタンを、アップロード直後の2択に置き換え済み（Rev67）：

- **モードB「空のテンプレート（グリッド自動検出）」**：文字/データ未記入のテンプレート画像。**決定論グリッド検出**（`gridDetect.ts`・後述）→初期配置。Canvas 2D APIのみ＝APIコスト0・依存なし。
- **モードC「好きな画像を背景に」**：解析なし。任意の写真/イラスト（店内装・キャライラスト・季節素材等）を背景に敷き、既定の安全配置（`defaultFreeformPlacement()`）でタイトル＋グリッドを重ねる→手動調整。**グリッドを持たない画像でも確実に使える保険モード**＝Bの検出失敗時のフォールバック先も「モードCに切り替えて手動配置」に一本化（「解析失敗＝行き止まり」を解消・WEB6思想）。

#### モードB：空テンプレートの決定論グリッド検出（実装済み＝`gridDetect.ts`）

とれはんっ！画像解析（map-analysisスキル／mapkit.py）の核心思想＝**「構造検出は決定論アルゴリズム」**をシフト表に移植。

1. **決定論検出（クライアント側Canvas・`detectGridFromImage()`）**：画像読込→最大1200pxにダウンスケール→グレースケール化→**水平/垂直の投影プロファイル**（行方向・列方向の暗ピクセル密度ヒストグラム・`DARK_THRESHOLD=128`）→ピーク検出（`PEAK_RATIO=0.25`）で罫線位置を抽出→`inferGridBounds`で開始/終了/分割数を算出→`ShiftPlacement`を返す。Canvas 2D APIのみ＝**依存パッケージ追加なし・Edge Function往復なし・APIコスト0円**。
2. **検出失敗時**：`null`を返す→UIで「モードCに切り替えてください」メッセージ表示（Vision AI へのフォールバックは廃止）。
3. ヘッダ行（曜日行）の有無は水平線数≧2で自動判定（`hasHeaderRow = rawRows >= 2`）。

#### 不均等グリッド対応＝ShiftPlacementV2（境界配列方式）

```typescript
type ShiftPlacementV2 = {
  version: 2;
  mode: 'filled' | 'empty' | 'freeform';   // A / B / C（解析来歴の記録）
  titleArea: { x: number; y: number; w: number; h: number }; // 相対 0-1（現行同様）
  colBounds: number[];   // 列境界の相対x（cols+1 個・昇順・0〜1）＝均等分割の cellW を置換
  rowBounds: number[];   // 行境界の相対y（データrows＋ヘッダ行＋1 個・昇順・0〜1）
  hasHeaderRow: boolean;
  cellOverrides?: Record<number, { dx: number; dy: number; dw: number; dh: number }>;
                         // 日番号(1〜31)→セル個別オフセット（相対値・未指定は0）＝手書き風の例外セル救済
  cellBg: string;
  cellBgAlpha: number;   // セル背景の不透明度 0〜1（モードCの可読性ガード・新設）
  cellInset: number;
  textColor: string; timeColor: string; accentColor: string;
  textOutline: boolean;  // 文字縁取り（text-shadow 4方向・モードCの可読性ガード・新設）
};
```

- 現行 `ShiftPlacement`（v1＝gridArea＋cols/rows均等分割）は**境界配列が等間隔になる特殊形**。読み込み時の v1→v2 変換純関数で吸収＝**保存済みお気に入り（`ky_shift_templates.custom_settings.placement`）の後方互換を保証・DB migrationは不要**（custom_settings は jsonb のまま）。
- レンダラー：`CustomPlacement` を colBounds/rowBounds 参照へ拡張（cellW/cellH の均等計算を境界差分 `bounds[i+1]-bounds[i]` に置換）。**正準はWeb**（§22原則）＝`web/src/shiftTemplates/` を先に改修しアプリ側へ同期。
- 月間（month-grid）と**デイリー出勤表（§22-2 daily-lineup）の両方**に適用（§22-3のT16要件を継承）。

#### セル個別微調整UI（モードA/B/C共通・ユーザーメモ②の正式仕様化）

2段階の調整系を置く（一括→境界→セルの順で粗→細）：

1. **境界線ドラッグ（主経路）**：プレビュー上へ列/行の境界線をオーバーレイ表示し、**線単位でドラッグ**（Excelの列幅調整と同じ操作感）＝`colBounds`/`rowBounds` を直接編集。1本動かすとその線を共有する縦/横一列の全セルが同時に揃う＝31セルを個別に触らずに済む。
2. **セル個別オフセット（仕上げ）**：調整モードで特定の日セルをタップ選択→そのセルだけ位置・サイズを微調整（ドラッグ＋微動スライダー）＝`cellOverrides[日番号]` へ保存。手書き風テンプレで1〜2セルだけズレる場合の最終手段。
- 現行の gridArea 一括スライダーは「全体調整」として存置（全境界を一括で平行移動・スケール＝V2では colBounds/rowBounds 全体への線形変換として実装）。

#### モードC：任意画像背景の可読性ガード（実装済み）

- `cellBgAlpha` スライダー（0〜100%・`PlacementEditor`内「可読性ガード」セクション）＝セル下敷きの半透明白（`cellBgWithAlpha()`で`rgba()`変換・写真の上でも文字が読める）。既定値0.82。
- `textOutline` チェックボックス（「文字の縁取り」）＝4方向text-shadow（`outlineStyle()`が文字色の輝度から白/黒を自動選択）。既定値true。
- 初期配置は安全既定値（`defaultFreeformPlacement()`＝titleArea上部中央15%〜85%・gridArea 5%/20%/90%/72%）→手動スライダーで調整。
- 背景画像の保存先・公開URL・ガードは§22-3と完全共通（`ky-shift-backgrounds` バケット・tenantIdフォルダスコープ）＝**新規バケット・新規Edge Function不要**。

#### 検証・受け入れ基準

- 検証素材：記入済み＝`docs/shop_template_reference/` 見本2枚（**ローカル限定・コミット/公開/SNS出力厳禁**）。空テンプレ＝一般的な格子テンプレをCanvasで自作生成＋可能ならユーザー提供の空テンプレ実物。任意背景＝フリー素材写真。
- 受け入れ基準：
  1. 空テンプレの決定論検出でセル境界誤差が全境界 ±1%（1080px基準 ±11px）以内
  2. 不均等グリッド見本に対し境界ドラッグ＋セルオフセットで全セルを目視一致させられる
  3. 任意写真背景で `textOutline` ON時に文字が読める（目視）
  4. **v1保存済みお気に入りが変換後も従来と同一描画**（回帰・後方互換）
  5. `ky-shift-analyze` の既存ガード（SSRF/レート制限/サイズ）が `mode` 追加後も全通過（RESTプローブ再実施）

#### 実装状況

- **✅ Rev67（2026-07-07）**：モードA廃止・モードB（`gridDetect.ts`）＋モードC（`defaultFreeformPlacement`＋可読性ガード`cellBgAlpha`/`textOutline`）実装済み。`AdminShiftImage.tsx` UIを2択ボタンに改修。`ShiftTableRenderer.tsx` に `cellBgWithAlpha()`/`outlineStyle()` 追加。
- **残（後Rev）**：ShiftPlacementV2（境界配列方式＋不均等グリッド対応）＋境界線ドラッグ＋セル個別オフセット。

---

## 23. 売上・給与・勤怠・税金CSV 詳細設計（§3-F/H／2026-07-05新設）

### 給与計算式（1キャスト×1日＝ky_cast_payroll 1行）

```
hours_worked   = ky_attendance の check_in/out から自動算出（手修正可・15分丸めなし＝分単位）
base_pay       = hours_worked × base_hourly_rate（ky_payroll_settings の店既定時給）
nomination_back = 当日そのキャストの指名数 × nomination_back_rate（円/件）
drink_back     = ドリンク数 × drink_back_rate（円/杯・オーダー明細から自動集計＝§25-5。オーダー未使用日は手入力）
deductions     = 遅刻控除（late_deduction 円/回・ky_attendance.status=late と連動）等
total_pay      = base_pay + nomination_back + drink_back + other_back − deductions
```

- 指名数は `ky_reservations`（cast_id・当日・status≠cancelled）から自動集計、手修正可
- **ドリンク数のオーダー連携（§25-5・2026-07-06追加）**：当日 `ky_order_items`（cast_id=本人・category='cast_drink'）の qty 合計を自動プリフィル・手修正可。オーダー未使用日は従来通り手入力（後方互換）
- MVPは**店一律時給**（ky_payroll_settings）。キャスト個別時給は後フェーズ（ky_castsに列追加で対応できる構造）
- 月次給与明細＝日別行の集計。画面は「月×キャスト」の明細ビュー（アプリ=AnalyticsScreen内・Web=AdminPayroll）

### 勤怠（ky_attendance）

- ステータス5値：`present / late / early_leave / absent / substitute`（代打は substitute_cast_id 必須）
- 月次カレンダー表示＋集計（出勤率・遅刻率）。理由はカテゴリ（体調不良/私用/無断/その他）＋自由入力
- `ky_shifts`（予定）と `ky_attendance`（実績）は別テーブル＝「予定 vs 実績」の突合が集計の基礎

### 税金関連CSV（MVP＝汎用形式・**UTF-8 BOM付き**＝Excel文字化け回避）

| CSV | 列 |
|---|---|
| 売上CSV | 日付, 総売上, セット数, ドリンク数, 指名数, その他収入, メモ |
| 給与CSV | 対象月, キャスト名, 出勤日数, 総勤務時間, 基本給, 指名バック, ドリンクバック, その他, 控除, 支給額 |
| 勤怠CSV | 日付, キャスト名, 状態, 入店時刻, 退店時刻, 理由 |
| 経費CSV | 日付, カテゴリ, 金額, メモ（§27・2026-07-06追加） |
| 年次収支CSV | 月, 総売上, 経費計(カテゴリ別列), 人件費, 差引収支（§27・2026-07-06追加） |

- 出力：管理Web＝Blobダウンロード（PC主戦場）／アプリ＝expo-file-system＋シェアシート
- 弥生/freee/MFの個別仕訳形式は**後フェーズ**（各社で列仕様が異なるため、MVPは汎用CSV＋「会計ソフトへの取込手順」説明で開始。§3-Fの表記もこれに合わせ「会計ソフト取込用汎用CSV」と読む）
- ⚠️ 税務助言はしない（アプリは記録・集計・出力のみ。税額計算・申告代行機能は入れない＝税理士法リスク回避）

---

## 24. アプリ⇔管理Web 連携仕様（2026-07-05新設）

| 連携面 | 実装 |
|---|---|
| **アカウント** | Supabase Auth共有＝同一メール＋パスワードで両方ログイン（アプリ=AsyncStorage/Web=localStorageセッション。アカウントは1つ） |
| **データ** | 全 `ky_*` テーブル・RPC・RLS共有＝どちらで書いても他方に反映（真実は常にDB1箇所） |
| **アプリ→Web導線** | 設定画面「PCで作業」＝管理WebのURL表示・コピー・QR（PCブラウザで読み取り用） |
| **Web→アプリ導線** | 管理Webフッターに「アプリで予約通知を受け取る」（App Storeリンク・公開後に有効化） |
| **リアルタイム** | 管理Web予約台帳＝Supabase Realtime（postgres_changes・ky_reservations INSERT/UPDATE購読）で自動反映。他画面は画面遷移時再取得で十分。アプリ＝既存プッシュ通知（E-★） |
| **時刻表現** | 'HH:MM'文字列（深夜0時起点・26:00表記なし）＝両面共通timeUtilsで統一（既にアプリ/客Webで共通） |
| **エンティトルメント** | `ky_tenants.plan` 1箇所（§14）＝両面のゲートが同じ列を参照 |
| **オーダー→売上（§25・2026-07-06追加）** | アプリのレジ会計確定→`ky_sales` へ日別自動upsert（entry_mode='auto'）→管理Webの売上/給与/CSVは**既存の ky_sales 参照のまま**同値連携（実装影響最小）。管理Web当日ダッシュボードは `ky_orders` のRealtime購読 |

---

## 25. オーダー管理・レジ機能 詳細設計（§3-K／2026-07-06新設・ユーザー指示）

> **動機**：現状の売上管理（§3-F/§23）は「日別合計の手入力」のみで、**オーダー（注文）単位の記録が存在しない**。ユーザー指示＝「アプリ側にオーダーを管理する機能（レジさぽっ！のレジ画面を参考）と、その売上を管理側と連携する機能」。

### 25-1. コンカフェの会計フローとレジさぽっ！との差分

- レジさぽっ！＝即売会：**その場で1回会計**（カート→会計→完了）
- コンカフェ＝**滞在型**：来店→席でセット開始→ドリンク/チェキを追加注文→退店時にまとめて会計
- → レジさぽっ！のUI部品（±ステッパー・CheckoutModal・おつり大表示）を流用しつつ、**「開いた伝票（open）に明細をためて最後に締める（closed）」伝票ライフサイクル**を足すのが核心差分

### 25-2. データモデル（§10に追加済み）

- `ky_menu_items`（メニューマスタ）：category 9種＝set/extension/nomination/cast_drink/drink/food/cheki/other/**discount（定型割引＝負のprice・§25-7）**。`needs_cast=true` のカテゴリ（nomination/cast_drink/cheki）は明細追加時にキャスト選択チップを出す
- `ky_orders`（伝票）：status＝open（滞在中）/closed（会計済）/void（取消）。`biz_date`＝営業日（MVPは opened_at のローカル日付。深夜跨ぎの「営業日切替時刻」設定は△後フェーズ）。`reservation_id` で予約とひも付け
- `ky_order_items`（明細）：category/name/price はメニューからのスナップショット（後からメニュー価格を変えても過去伝票が不変・集計はjoin不要で明細のcategory直接参照）。`cast_id` が給与バック自動集計の源泉。席料の自動明細（§29）は menu_item_id=null・category='seat'

### 25-3. アプリUI（RegisterScreenタブ＝§9-1）

1. **伝票レーン**：open伝票をカードで一覧（席番号＋お客様名ラベル）。「＋新規伝票」／予約台帳のチェックイン→伝票自動オープン（reservation_id・お客様名・指名キャストを引き継ぎ）
2. **お客様名入力欄（2026-07-06ユーザー指示）**：伝票に `customer_label` の入力欄を設ける（手動オープン時に入力・チェックイン由来は予約者名を自動セット・後から編集可）。伝票レーンのカード表示名になる
3. **明細追加**：レジさぽっ！式のメニュー一覧＋±ステッパー（カテゴリ見出し・needs_cast はキャスト選択チップ＝name_kana順・§28-1）
4. **一時保存ボタン（2026-07-06ユーザー指示）**：明細編集ビューに「一時保存」＝伝票を open のまま保存して伝票レーンへ戻る明示ボタン（会計せず離脱しても入力が失われないことをUIで保証。※データは即時DB書込みだが、ユーザーが安心して中断できる明示的な出口を置く）
5. **会計**：CheckoutModal流用＝明細一覧→**「割引」ボタン（金額/％/定型＝§25-7）**→預かり金入力→おつり計算→支払方法（現金/カード/QR/その他）→確定→ChangeResultModal でおつり大表示
6. 確定処理＝ky_orders を closed に→**ky_sales へ日別自動集計upsert**（§25-4）→給与のドリンク数プリフィル（§25-5）

- ◯ 卓タイマー（open伝票にセット開始時刻→残り時間表示・延長アラート）＝コンカフェ実務の核だが後フェーズ（まず記録が回ってから）
- ◯ サービス（¥0）モード＝レジさぽっ！の exchangeMode パターンを流用検討
- ❌ **決済はしない**：現金/カード等の「記録」だけ（決済端末連携・オンライン決済は資金決済法ゲート＝§7/§16）

### 25-4. 売上の管理側連携（二重計上防止の核心設計）

- **真実は ky_orders**（伝票・明細）。`ky_sales` は「日別サマリのキャッシュ＋オーダー未使用店の手入力先」として併存
- `ky_sales.entry_mode`：
  - `'auto'`＝会計確定のたび、その営業日の closed 伝票を再集計して upsert（total_revenue/set_count/drink_count/nomination_count を category 集計から算出）
  - `'manual'`＝従来の手入力行。**auto集計は manual 行を上書きしない**（オーダー併用店が手入力済みの日を自動で壊さない＝二重計上防止。切替は明示操作）
  - auto行をユーザーが手修正したら `'manual'` に落とし以後自動更新を停止（画面バナーで明示）
- `tenant_id×date` UNIQUE（1日1行）＝upsert衝突キー
- 管理Web（AdminSales/AdminPayroll/AdminCsvExport）は**既存どおり ky_sales を参照するだけで自動連携が成立**（実装影響最小）。AdminOrders が伝票明細のドリルダウンを担当
- Realtime：管理Webの当日ダッシュボードは ky_orders（INSERT/UPDATE）購読＝予約台帳と同パターン（§24）

### 25-5. 給与連携（§23改訂）

- drink_back のドリンク数＝当日 ky_order_items（cast_id=本人・category='cast_drink'）の qty 合計を自動プリフィル・手修正可
- 指名数＝従来通り予約（ky_reservations）由来を維持（オーダーの nomination 明細は売上側にのみ計上。給与の指名数との統合は後フェーズ検討＝二重定義を避ける）
- チェキバック＝MVPは other_back に手入力（cheki明細×レートの自動化は◯後フェーズ）

### 25-6. スコープ

- ★MVP第2弾（§19の18〜21）：メニューCRUD／伝票open→明細→会計→closed／**会計時割引（§25-7）**／ky_sales自動upsert／給与ドリンクプリフィル／AdminOrders・AdminMenu
- ◯：卓タイマー・当日Realtimeダッシュボード・伝票検索・サービスモード・チェキバック自動化
- △：モバイルオーダー・レシート印刷・在庫管理・営業日切替時刻・多端末同時レジ

### 25-7. 会計時の割引・クーポン（店舗独自キャンペーン＝2026-07-06ユーザー指示第5次）

> 店舗が独自にキャンペーン（雨の日割・SNSフォロー割・イベント割等）を行う場合があるため、姉妹アプリのクーポン（§32-2）を待たずに**レジ単体で割引を完結できる**ようにする。

- **明細方式**：割引は `ky_order_items` に **category='discount' のマイナス価格明細**として追加（スナップショット原則そのまま・伝票合計が自然に純額になる・後から「何の割引か」が明細に残る）
- **入力UI**＝会計フローの「割引」ボタン：
  1. **金額割引**（¥指定）／**割合割引**（%指定→その時点の伝票小計から金額を算出してマイナス明細に確定＝保存後に%の再計算はしない）
  2. **名目入力**（例「雨の日キャンペーン」「SNSフォロー割」）＝明細 name に入る
  3. **定型割引**：毎回使うキャンペーンは `ky_menu_items` に category='discount'（負のprice）で登録→メニュー一覧から1タップ追加（needs_cast=false）
- **集計・給与への影響**：
  - ky_sales 自動集計（§25-4）＝total_revenue に負数として乗る→**純売上が自動で正しくなる**。set_count/drink_count/nomination_count はcategory別カウントのため影響なし
  - 給与バック（§25-5）＝cast_drink の qty ベースで割引と独立。**割引明細には cast_id を付けない**（バック誤減額防止）
- **ガード**：会計確定時に「割引合計≦割引前小計」をチェック＝伝票合計を負にしない
- **姉妹アプリ連携（§32-2）との関係**：将来のクーポン使用も**この discount 明細と同じ経路へ自動追加**＝手動割引とクーポンで集計経路を分けない

---

## 26. 機能ギャップ棚卸し（2026-07-06批判的検討・アプリ/管理Web/客Web/連携の4軸）

> ユーザー指示「現時点の機能から不足してるものがないか批判的に検討」の結果一覧。★=今回仕様化／◯=価値ありと判断・後フェーズ／△=将来検討／✗=やらない（理由付き）

| # | ギャップ | 面 | 判定 | 対応 |
|---|---|---|---|---|
| 1 | **オーダー（注文）単位の記録が無い**（ky_salesは日別手入力合計のみ） | アプリ＋連携 | ★ | §25で仕様化（ユーザー指示） |
| 2 | オーダー売上が管理Webへ流れない | 連携 | ★ | §25-4 自動upsert |
| 3 | ドリンクバックのドリンク数が手入力 | 連携 | ★ | §25-5 自動プリフィル |
| 4 | メニューマスタが無い | アプリ＋管理Web | ★ | ky_menu_items（§25-2） |
| 5 | チェックイン後の店内業務が空白（チェックインで台帳の仕事が終わる） | アプリ | ★ | チェックイン→伝票オープン（§25-3） |
| 6 | 卓のセット時間管理（残り時間・延長アラート）が無い | アプリ | ◯ | §25-3 卓タイマー（後フェーズ） |
| 7 | 顧客台帳（リピーター・来店/指名履歴の蓄積）が無い＝予約は都度使い捨て | アプリ＋Web | ◯ | コンカフェは常連ビジネスで価値大。ただし競合コンカフェGo（CRM）の主戦場と重なる＋個人情報の保持が増える（PP改訂・保持期間設計が必要）＝**参入判断はユーザーと要相談** |
| 8 | キャストのシフト希望提出が無い（店側登録のみ） | アプリ | ◯ | §3-C追記。キャストアカウント基盤（実装済）の上に載せられる |
| 9 | キャスト本人の出退勤打刻が無い（勤怠は店が記録） | アプリ | ◯ | ky_attendance.check_in_at/out_at は既存＝キャスト側UIを足すだけの構造 |
| 10 | 予約変更/キャンセル時の提供者プッシュが無い（新規予約のみ） | アプリ | ◯ | §3-E追記。通知基盤は既存＝イベント追加のみ |
| 11 | 客向けリマインダー（前日/当日）が無い | 客Web | ◯ | 既存§3-E ◯のまま（メール送信基盤が前提＝有料機能候補） |
| 12 | 満席時のキャンセル待ちが無い | 客Web | △ | 客向け通知基盤が前提＝#11とセットで検討 |
| 13 | 当日売上のリアルタイムダッシュボードが無い | 管理Web | ◯ | §25-4（ky_orders購読＝既存Realtimeパターン流用） |
| 14 | 複数端末での同時レジ操作 | アプリ | △ | MVPは1店1レジ端末想定。伝票がDB上にあるため構造的には多端末可＝競合制御は後フェーズ |
| 15 | モバイルオーダー（客が自分のスマホで注文） | 客Web | △ | 接客が価値のコンカフェとは相性を要検討（§25-6） |
| 16 | レシート/領収書印刷 | アプリ | △ | Bluetoothプリンタ連携は重い。MVPは画面提示＋手書き領収書運用 |
| 17 | ドリンク等の在庫管理 | アプリ | △ | コンカフェの在庫は軽い（即売会と違い枯渇が会計を止めない）＝優先度低 |
| 18 | 客Web予約フォームの多言語（訪日客） | 客Web | △ | §18の既存方針どおり（将来 en/zh-TW/ko） |
| 19 | **キャストアカウント機能がSPEC未記載**（Rev21〜実装済なのに仕様書に無い＝逆ギャップ） | 仕様書 | ★是正 | §3-C/§9-1/§12へ反映済（本改訂） |
| 20 | 決済仲介・前金 | 客Web | ✗ | 資金決済法ゲート（§7/§16）＝方針不変 |

**客Web側の結論**：予約受付の1周（カレンダー→予約→PIN編集）に大穴は無し。残ギャップは「客向け通知」系（#11/#12）に集中しており、メール基盤導入（有料機能候補）とセットで後フェーズが妥当。

### 26-2. 第2次棚卸し（2026-07-06ユーザー10項目指示＋批判的検討）

| # | ギャップ | 面 | 判定 | 対応 |
|---|---|---|---|---|
| 21 | **レジ伝票にお客様名入力欄・会計までの一時保存ボタン**（ユーザー指示） | アプリ | ★ | §25-3改訂＝customer_label のUI化＋open保存の明示ボタン |
| 22 | **経費処理・確定申告補助が無い**（レジさぽっ！TaxScreen相当の管理側機能） | 管理Web＋アプリ | ★ | §27で仕様化（ky_expenses・月次収支・年次サマリ・経費CSV） |
| 23 | 客Webの指名ドロップダウンに**並び順が無い**（あいうえお順にはふりがな列が必要＝漢字名はlocaleCompareで読み順にならない） | 客Web＋アプリ | ★ | §28-1（ky_casts.name_kana 追加・キャスト登録にふりがな欄） |
| 24 | アプリの手動予約追加に**指名キャスト欄自体が無い**（電話予約の「〇〇ちゃん指名で」を記録できない） | アプリ | ★ | §28-1（AnchoredDropdown＝レジさぽっ！Rev20流用） |
| 25 | 生年月日・勤務開始可能日が**素のTextInput手入力**（半角/全角混入リスク・ルールDATE-POPUP違反でもある） | アプリ | ★是正 | §28-2（生年月日=ホイールピッカー・日付=CalendarModal） |
| 26 | 予約台帳の日付チップが**折返し改行**（dateChip width:68固定＋padding左右28→実効40pxに `10/29(水)` が入らない） | アプリ | ★是正 | §28-3（原因特定済み・修正方針＋固定幅Textの横断監査） |
| 27 | UI文言に単独の**「客」表記**（strings.json 3キー。Web側は「お客様」で準拠済） | アプリ | ★是正 | §28-4（用語規約「お客様」統一・G2チェックへ組込み） |
| 28 | **席種（カウンター/ソファ等）・席種別席料が無い** | 三面 | ★ | §29（ky_seat_types・客Web席種選択・伝票への席料自動明細） |
| 29 | **キャスト写真のアップロードが未実装**（ky_casts.photo_url 列だけ存在・Supabase Storage未使用・UIなし） | アプリ＋管理Web | ★ | §30（証明写真＋お店写真の2種・管理側差替え・離脱時自動削除） |
| 30 | シフト表画像から**SNS投稿への直接導線が無い**（現状は `Sharing.shareAsync`＝OS共有シートのみ） | アプリ＋管理Web | ★ | §31（X/Instagram起動ボタン・投稿文テンプレ・店舗SNS登録） |
| 31 | **お問い合わせが ContactFormModal 不在の mailto 直リンク**（SettingsScreen＝自前簡易版・横断ゲート②違反） | アプリ | ★是正 | §28-5（とれはんっ！ContactFormModal 流用へ差替え・要修正メモ） |
| 32 | 性別など選択式にできる自由入力が個人情報欄に残る | アプリ | ◯ | §28-1適用箇所一覧で実装時に監査 |
| 33 | 客Webのキャスト写真表示（指名選択に顔が見えない） | 客Web | ◯ | §30のお店写真を客Webキャスト欄へ表示（写真基盤ができてから） |
| 34 | シフト画像への予約URL/QR埋め込み（画像自体を集客導線化） | 連携 | ◯ | §31-3（§22テンプレにQRオプション追加） |

### 26-3. 第3次棚卸し（2026-07-06 SaaS機能ネット調査＋ユーザー指摘3点）

> 調査範囲：ナイトワーク特化POS（ボードマネージャー/VENUS/Dシステム/NIGHTCORE等）・汎用予約SaaS（RESERVA/STORES予約等）・飲食店シフト管理SaaS・コンカフェ運営実務（生誕祭/チェキ/リピーター施策）。
> **確認結果**：予約SaaS標準機能の主要どころ（リマインド#11・顧客カルテ#7・キャンセル待ち#12・卓タイマー#6）は第1次棚卸しで既出＝第1次の網羅性は妥当。新規は以下。

| # | ギャップ | 面 | 判定 | 対応 |
|---|---|---|---|---|
| 35 | **デイリー出勤表（T8）がSPEC本体に未統合**（引き継ぎ指示書のみ・§31-3で◯扱いのままだった＝逆ギャップ） | 仕様書 | ★是正 | §22-2で仕様化（★へ格上げ・ユーザー指摘） |
| 36 | **店舗独自テンプレ取込（T16）がSPEC本体に未統合**（ユーザー再指摘＝サク品っ！のキャンバス方式と同思想） | 仕様書 | ★是正 | §22-3で仕様化 |
| 37 | シフト表作成のプレビューが設定スクロールで画面外へ流れる（sticky未指定） | 管理Web＋アプリ | ★是正 | §22-4（ユーザー指示＝常時固定表示） |
| 38 | **ノーショー履歴の活用が無い**（status='no_show' は記録できるが集計・予約詳細での過去回数表示なし。無断キャンセル対策は予約SaaSの標準機能） | アプリ＋管理Web | ◯ | 同一連絡先の過去no_show回数を予約詳細にバッジ表示＋月次集計。事前決済型の対策は✗（資金決済法＝#20と同じ壁） |
| 39 | **キャスト成績ビューが無い**（ナイトワークPOS標準の成績集計。指名数/ドリンク数/売上貢献の月次ランキング・推移グラフ） | 管理Web | ◯ | §23の既存集計データの見せ方追加＝新テーブル不要 |
| 40 | シフト作成時の人件費概算が無い（飲食シフトSaaS標準＝時給×シフト時間の見込み表示） | アプリ＋管理Web | ◯ | ky_payroll_settings × ky_shifts で算出可＝構造は既存 |
| 41 | ボトルキープ管理 | アプリ | △ | コンカフェにも文化はあるがMVP外。ky_menu_items 拡張（キープ期限・お客様名）で将来対応可 |
| 42 | 回数券・チェキ券・スタンプカード | アプリ | △（スタンプは計画入り） | **スタンプは2026-07-06ユーザー決定で実装確定**＝姉妹アプリ連動・会計連動の自動加算＋クーポン確認ポップアップ（§32-2・§19の㊱）。回数券・チェキ券は△継続＝競合コンカフェGo（CRM）の主戦場＝#7と同判断・参入はユーザーと要相談 |
| 43 | 売掛（未収金）管理 | アプリ | ✗ | キャバクラ文化。健全カフェのトーン（Phase-1ゲートA・App Store 1.1.4対策）を崩す＋ツケ払い助長はトラブル源＝入れない |
| 44 | 生誕祭以外のイベントカレンダー（客ページに店イベント告知） | 客Web | ◯ | T10生誕祭カレンダーの拡張として設計（イベント種別列の追加） |
| 45 | キャンセル待ち（#12）の再評価：生誕祭は満席が常態＝コンカフェでは平均的予約業種より価値が高い | 客Web | △→◯ | 判定を◯へ格上げ。実装は#11メール基盤とセット（有料機能候補） |
| 46 | **会計時の割引・クーポンが無い**（店舗独自キャンペーン＝雨の日割・SNSフォロー割等を伝票に反映できない） | アプリ | ★ | §25-7で仕様化（2026-07-06ユーザー指示第5次＝discount明細方式・§19の⑲へ組込み） |

**計画化（2026-07-06ユーザー指示「◯と△は計画に入れる」）**：本表の◯/△は §19 の㉛〜㊲へ実装計画として組込み済み（#43売掛のみ✗のまま計画外）。

---

## 27. 経費・確定申告補助 詳細設計（§3-F拡張／2026-07-06ユーザー指示）

> レジさぽっ！ `TaxScreen`（売上−経費＝収支・カテゴリ別経費・申告用レポート）を参考に、**イベント単位→月次/年次**へ置き換えたもの。コンカフェは常設店＝会計期間は暦月・暦年。

### 27-1. データモデル

- `ky_expenses`: id, tenant_id, date, category, amount, memo, created_at, updated_at（§10へ追加）
- カテゴリ（固定リスト）: `purchase`(仕入=酒・食材)/`rent`(家賃)/`utilities`(水道光熱)/`communication`(通信)/`advertising`(広告宣伝)/`costume`(衣装・美装)/`supplies`(消耗品・備品)/`outsourcing`(外注・システム利用料)/`misc`(雑費)
- **人件費は経費に手入力させない**：`ky_cast_payroll` の月次合計を収支表示で自動参照（「人件費（給与計算より自動）」行）＝二重計上防止。レジさぽっ！の「日別按分せず全体で1回」思想と同型

### 27-2. 画面

- **管理Web `AdminExpenses`（主戦場）**：月切替→経費の追加/一覧/削除・カテゴリ別集計・**月次収支（売上 ky_sales − 経費 − 人件費）**・年次サマリ（1〜12月表＝確定申告の元資料）
- アプリ：AnalyticsScreen 内に経費セクション（外出先レシート入力用の最小フォーム＝日付・カテゴリ・金額・メモ）
- 経費入力フォームは §28 準拠（カテゴリ=ドロップダウン・日付=CalendarModal・金額=numeric）

### 27-3. 出力（§23のCSV表へ追加）

| CSV | 列 |
|---|---|
| 経費CSV | 日付, カテゴリ, 金額, メモ |
| 年次収支CSV | 月, 総売上, 経費計(カテゴリ別列), 人件費, 差引収支 |

### 27-4. 守るライン

- ⚠️ **税務助言はしない**（§23と同一方針＝記録・集計・出力まで。税額計算・申告代行・仕訳の自動判定は入れない＝税理士法リスク回避）
- 弥生/freee/MF個別形式は後フェーズ（§23と同判断）
- ※ユーザー指示原文はこの項目が「個人的には」で途切れており続きが未取得＝**続きの意図は要確認**（本設計は「レジさぽっ！でいう確定申告関係の補助機能」の確定部分のみを仕様化）

---

## 28. 入力UX・表示・用語の是正標準（2026-07-06ユーザー指示 b/c/e/f/i）

### 28-1. ドロップダウン標準（手入力→選択式）

- **正準部品**：アプリ＝`AnchoredDropdown`（レジさぽっ！Rev20実装のアンカー型＝開いた場所に出る）を流用。Web＝ネイティブ `<select>`（実装済みの形式を維持）
- **キャスト並び順＝あいうえお順**：`ky_casts.name_kana`（ふりがな・ひらがな）列を追加し `order by name_kana nulls last, name`。キャスト登録/編集フォームにふりがな欄（ひらがな正規化バリデーション・カタカナは自動変換）。※漢字名の `localeCompare('ja')` は読み順にならないため列が必須
- **適用箇所一覧**：
  | 箇所 | 現状 | 対応 |
  |---|---|---|
  | 客Web予約フォーム・指名キャスト | `<select>` 済み・**ソート無し** | name_kana順に ★ |
  | 客Web予約フォーム・人数 | `<select>` 済み | 維持 |
  | 客Web予約フォーム・席種 | 無し | §29で新設 ★ |
  | アプリ手動予約追加・指名キャスト | **欄自体が無い** | AnchoredDropdown新設 ★ |
  | 管理Web手動予約追加・指名キャスト | 実装時監査 | `<select>`＋kana順 |
  | 給与/勤怠のキャスト選択（両面） | 実装時監査 | kana順統一 |
  | 個人情報・性別 | 自由入力なら | 選択式（男性/女性/その他/回答しない）◯ |
  | レジ明細のキャスト選択チップ（§25-3） | 未実装 | kana順で並べる |

### 28-2. 手入力削減（ピッカー標準）

- **生年月日＝ホイール（ダイヤル）式ピッカー**：`WheelDatePicker` 共有部品を新設（`@react-native-community/datetimepicker` の `display="spinner"` を第一候補・Expo Go/SDK54互換を実装時確認、不可なら自前3列ホイール）。テキスト入力を完全排除＝**半角/全角混入を構造的に防止**（ユーザー指示の目的）。年レンジは現在−70〜現在−15
- 勤務開始可能日（availableFrom）等の**未来日付＝`CalendarModal`**（ルールDATE-POPUP準拠＝生TextInputで日付を打たせない）
- 時刻・数値＝`Stepper`（受付設定・手動予約追加は既に全面Stepper＝準拠済み・維持）
- keyboardType は指定済み（phone-pad/email-address/numeric）＝維持
- **是正対象の現状**：`CastPersonalInfoScreen` の生年月日（placeholder="1990-01-15" の素TextInput）と availableFrom（同 "2026-08-01"）の2箇所

### 28-3. 表示崩れ是正（予約台帳ほか）

- **予約台帳の日付チップ折返し（原因特定済み）**：`ReservationsScreen` の `dateChip`＝`width: 68` 固定＋`paddingHorizontal: 14`（左右計28px）→テキスト実効幅40pxに `10/29(水)`（fontSize13で約60px）が収まらず改行。**修正＝width: 76（getItemLayout の length: 76 と一致させる）＋paddingHorizontal: 4＋`numberOfLines={1}`**
- **横断監査（実装時チェック項目）**：①固定 `width:` を持つスタイル×日本語Text の組合せを grep 監査 ②長い店名/キャスト名でのヘッダー・カード折返し ③iPhone SE(375pt)幅での全画面確認 ④G4実機スモークの確認観点に「表示崩れ」を常設

### 28-4. 用語規約（「客」→「お客様」）

- **UI文言（strings.json・Web表示文言）で単独の「客」は禁止＝「お客様」に統一**（ユーザー指示「絶対にやめて」）。複合語（接客・集客・来客数・客席など）は対象外
- 是正対象（アプリ strings.json の3キー）：`placeholder.schedule.desc`／`schedule.publicUrl`／`schedule.publicUrlHint`。管理Web/客Webは「お客様向け予約ページ」表記で準拠済み
- **G2 i18nチェックに組込み**：全言語値から「客」を含む文言を抽出→許可リスト（お客様・接客・集客・来客・客席）以外を検出したらFAIL
- コード内識別子（customer_name 等）・SPEC/開発文書は対象外（ユーザー向け表示文言のみ）

### 28-5. お問い合わせ是正メモ（ユーザー指示「後で治すようにメモ」）

- **違反の実体**：`SettingsScreen.tsx` の `handleContact`＝`Linking.openURL('mailto:...')` の自前簡易版。横断ゲート②「`ContactFormModal`（自前簡易版禁止・構造化データ）」に違反
- **是正**：とれはんっ！ `src/components/ContactFormModal.tsx`（実在確認済み）を流用し、カテゴリ選択＋本文＋アプリ情報（バージョン/OS）自動付与の構造化フォームへ差替え。設定画面の行はモーダル起動に変更
- 実装順序 ㉒是正パック（§19）に含める＝**次の実装Revで最優先**

---

## 29. 席種・席料設計（§3-B/D拡張／2026-07-06ユーザー指示）

### 29-1. データモデル

- `ky_seat_types`: id, tenant_id, name(例:カウンター/ソファ/VIP), seat_fee(円・0可), sort_order, is_active（§10へ追加）
- `ky_reservations.seat_type_id`(null可) を追加＝お客様が予約時に選んだ席種
- `MenuCategory` に `'seat'` を追加（席料の伝票明細カテゴリ）

### 29-2. 席種は「希望属性」から始める（設計判断）

- **MVP＝席種は予約の希望属性**：空き計算は現行どおり総席数（ky_unlock_windows.seats）で行い、席種はお客様の指定＋店側の割当参考情報とする
- 席種別の在庫管理（席種ごとの数で空きを絞る）は**後フェーズ**（ky_seat_types に stock 列を足せば拡張できる構造。席自動割当ロジック＝make_reservation RPC の改修が大きいため段階を分ける）

### 29-3. 三面の反映

- **管理側（アプリ受付設定＋管理Web AdminSchedule）**：席種CRUD＋**席料の金額入力**（ユーザー指示）・並び順・有効/無効
- **客Web予約フォーム**：席種ドロップダウン（表示形式「席種名（席料 ¥N）」・席料¥0は名前のみ）。席種未登録の店では欄ごと非表示（後方互換）
- **伝票連動（§25接続）**：チェックイン→伝票オープン時、予約の席種に席料があれば `name=席種名/price=席料` の明細を自動追加（menu_item_id=null・スナップショット方式は§25-2と同じ）→席料が会計・売上集計（total_revenue）に自然に乗る

---

## 30. キャスト写真管理（§3-C拡張／2026-07-06ユーザー指示）

### 30-1. 現状と要件

- 現状：`ky_casts.photo_url` 列だけ存在し**アップロード実装ゼロ**（Supabase Storage未使用・UIなし＝casts.ts確認済み）
- 要件（ユーザー指示）：①証明写真（本人確認用）②お店で使う写真（表示用）の2種アップロード ③お店写真は管理側でも差替え可 ④**お店のグループから抜けたら管理側からそのキャストのお店写真を自動削除**

### 30-2. 設計

| 項目 | お店写真 | 証明写真 |
|---|---|---|
| 保存先 | Storage `ky-cast-photos/{tenant_id}/{cast_id}/shop.jpg` | 同 `/{tenant_id}/{cast_id}/id.jpg` |
| 参照列 | `ky_casts.photo_url`（既存） | キャスト個人情報テーブルに `id_photo_url` 追加 |
| 公開範囲 | シフト表・客Webキャスト欄に表示＝公開読み | **オーナー＋本人のみ**（非公開・Storageポリシー） |
| アップロード | 本人（キャストアカウント）＋**オーナー（アプリCastsScreen/管理Web AdminCastsから差替え可）** | 本人のみ（オーナーは閲覧のみ） |

- 画像処理：expo-image-picker→クライアント縮小（とれはんっ！FIX-7b パターン流用＝長辺840/サムネ336）→Storageアップロード
- **離脱時自動削除**：キャスト脱退（アカウント連携解除・キャスト削除）を Edge Function `ky-cast-leave` に集約し、DB更新（cast行/連携解除）と **Storage画像削除（お店写真＋証明写真）＋photo_url/id_photo_url のnull化を同一処理で実行**（service_role＝クライアント側の削除漏れを構造的に防止）。§15アカウント削除カスケードにも画像削除を追加
- **法務（§16連動）**：証明写真=本人確認情報→プライバシーポリシーに「取得目的（在籍確認）・閲覧範囲（店舗管理者のみ）・退店時削除」を明記。App Privacy申告に「写真」追加

---

## 31. シフト表SNS投稿・販促導線（§3-I拡張／2026-07-06ユーザー指示）

### 31-1. 現状

- シフト表画像の保存＋`Sharing.shareAsync`（OS共有シート）までは実装済み（ShiftImageScreen）＝SNSへの**直接導線・投稿文の用意が無い**

### 31-2. 投稿ボタン（アプリ・管理Web両方）

- `ky_tenants.sns_links`(jsonb) に店舗SNS（X/Instagram/TikTok URL）を登録（設定画面＝店舗プロフィール内）
- シフト表生成完了画面に：
  1. **「Xで投稿」**＝intent URL（`https://x.com/intent/post?text=...`）で投稿文を事前充填して起動（画像は直前に保存済み→Xの画像添付で選択。アプリではX appへディープリンク）
  2. **「Instagramを開く」**＝`instagram://` スキーム起動（外部から画像付き直接投稿はAPI非対応→「保存済みのシフト画像を選んで投稿してください」の1行ガイドを添える）
  3. **「投稿文をコピー」**＝テンプレ（対象週/月・出勤キャスト名・**予約ページURL**を自動差し込み・編集可）
- 管理Web＝PNGダウンロード後に同じ3ボタン（PCブラウザではX intentが最も確実）
- ✗ **自動定期投稿はやらない**：X APIの有料化・自動投稿によるアカウント制限リスク＝「手動投稿の補助」に徹する

### 31-3. 同種の必要機能（批判的検討の結果）

- ★ **予約ページURL/QRのシフト画像への埋め込みオプション**（§22テンプレのパラメータに追加）＝SNSに流れた画像がそのまま予約導線になる（#34）
- ★ 「本日の出勤キャスト」日別画像（シフト表の1日版＝毎日のSNS投稿はコンカフェ実務の定番）＝**§22-2で仕様化・★へ格上げ**（2026-07-06第3次・#35）
- △ 生誕祭・イベント告知画像テンプレート
- ◯ 客Webキャスト欄にお店写真＋SNSリンク表示（§30の写真基盤ができてから＝#33）

---

## 32. 姉妹アプリ（お客様向けアプリ）構想と本体側の仕込み（2026-07-06ユーザー指示）

### 32-1. 構想の全体像（別アプリ・本SPEC範囲外／ここは「きゃすりん側に仕込む事項」の定義）

- コンカフェの**お客様向けアプリ**を姉妹アプリとして作る予定（名称・時期未定・別プロジェクト）
- 機能構想：❶**店舗検索**（地域別） ❷**ランキング**＝各地域ごとの「お店ランキング」（口コミ評価・売上ベース）。**キャスト（女の子）個人のランキングは実装しない**（2026-07-06ユーザー決定＝個人の評価・順位公開はリスクが大きい） ❸**スタンプ・クーポン**（会計連動）
- きゃすりん側は姉妹アプリ着手時に対応改修する前提だが、**データの土台（売上集計・地域・同意）は今のうちに仕込む**＝本節

### 32-2. スタンプ・クーポン仕様（#42スタンプ部分の格上げ＝ユーザー決定）

- スタンプは**会計に連動して自動的にお客様側アプリに貯まる**（紙台紙・手動押印の置き換え。店側の追加操作なしが理想）
- 会計時、そのお客様が**使用可能なクーポンを保有していたら、レジ画面にキャストへ確認を促すポップアップ**を出す（「このお客様はクーポンをお持ちです。使用するか確認してください」→使用なら伝票へ値引き明細を追加）
- クーポンは**即時使用を強制しない**（使わずに貯めておける。有効期限・種類は姉妹アプリ設計時に決定）
- **きゃすりん側の仕込み（§19の⑱〜⑳オーダー実装時に先取りする構造）**：
  1. **会計確定処理を `closeOrder()` 1関数に集約**＝スタンプ付与・クーポン照会のフックを将来1箇所に足せる（散在させると姉妹アプリ対応時に会計経路の総点検になる）
  2. `ky_orders` に**お客様識別子の拡張ポイント**を想定（将来 `customer_ref` 列＝姉妹アプリアカウントとの紐付け。**MVPでは列を作らない**＝匿名会計が既定のまま）
  3. 値引き明細＝**category='discount' のマイナス価格明細で確定（§25-7・2026-07-06第5次）**。将来のクーポン使用は店舗手動割引と同じ明細経路へ自動追加される＝集計・給与への影響も§25-7と共通

### 32-3. ランキングと売上サーバー集計の仕込み（「今のうちに」の実体）

- **売上のサーバー自動集計そのものは既に設計済み**：§25-4のとおり ky_orders（伝票明細）→ ky_sales（日別サマリ）が Supabase 上へ自動upsertされる。オーダー未使用店も手入力で ky_sales に入る＝**ランキングの源泉データはこの構造で店舗別・日別に揃う**（キャスト別集計＝ky_order_items.cast_id は店内向け成績ビュー#39にのみ使い、外部公開はしない）
- 追加で仕込む事項（§19の㉚）：
  1. **地域列**：`ky_tenants` に `prefecture`（都道府県）＋ `area`（エリア名・任意テキスト）を追加し、店舗プロフィール編集（アプリ・管理Web）に入力欄を追加＝店舗検索・地域別ランキングのキー
  2. **ランキング参加opt-in**：`ky_tenants.ranking_opt_in`（boolean・default false）。**売上データを外部ランキングに使うのは店の明示同意が前提**（営業秘密。PP・利用規約の改訂も必要＝§16）
  3. **公開層の分離**：姉妹アプリに他店の生データを見せるRLS穴は作らない。**日次バッチ（Edge Function）が opt-in 店だけを集計した公開スコアテーブル（例 `ky_ranking_scores`）を生成**し、姉妹アプリはそれだけを読む＝**生の売上額は公開しない**（順位・正規化スコアのみ）
  4. **キャスト（女の子）ランキングは実装しない**（2026-07-06ユーザー決定）：個人の評価・売上順位の公開は誹謗中傷・本人同意の論点が重いため、公開ランキングは**店舗単位のみ**。弁護士確認❸は店舗ランキング（売上データ外部利用の店舗同意・口コミUGC）に限定
- 実装タイミング：①②は migration 1本＋プロフィール欄追加＝軽量なので㉚として早めに実施可。③④は姉妹アプリ着手時（バッチと公開スキーマは姉妹アプリの要件が固まってから）

---

## §33 金融・セキュリティ強化設計（2026-07-07 第6次・設計のみ＝実装は別Rev）

> Rev63 セキュリティ監査（S1〜S12＝migration 0030 適用済）の続編。**お金と信用に関わる層**を対象に、
> 実コード調査で確認した4つの弱点を根拠として、フェーズ別の強化設計を定める。
> **本節は設計であり未実装**。実装候補は migration 0031 以降＋コード修正としてフェーズ順に着手する。

### 33-0. 設計根拠（2026-07-07 実コード調査で確認した事実）

| # | 事実 | 場所 | リスク |
|---|---|---|---|
| 根拠1 | CSV出力の `escapeCell` が先頭 `= + - @` を無害化していない（`"` 囲みのみ） | `web/src/admin/csv.ts`／`src/utils/csv.ts`（同一仕様） | **CSVインジェクション**＝客名・メモ等に `=HYPERLINK(...)` 等を仕込まれると、店がExcelで開いた瞬間に式が実行される（税金/経費/伝票CSVすべて） |
| 根拠2 | 金銭テーブル（ky_orders / ky_order_items / ky_sales / ky_cast_payroll / ky_expenses）に金額・数量の CHECK 制約が無い | migrations 0009/0013 ほか | 不正・バグ由来の**負数や桁違い金額がDBに入る**＝集計・給与・税務CSVが静かに壊れる |
| 根拠3 | キャスト銀行口座情報が平文 text（bank_name / bank_branch / account_type / account_number / account_holder_name） | `0012_ky_cast_profile.sql` ky_cast_personal_info | 漏えい時の被害が最大級のPII。現状はRLS（本人＋オーナーread）のみで**保存時暗号化・マスキングなし** |
| 根拠4 | `ky_tenants.plan` がオーナーの RLS 全操作ポリシー配下＝クライアントから直 UPDATE 可能 | 0001（RLS）＋0009（plan列） | IAP ON 後は**自称 'pro' 化＝課金バイパス**が anon キー＋自分の JWT だけで成立する |

### 33-1. Phase A（MVP前に実装＝migration 0031 候補＋コード修正）

- **FIN-1 金銭CHECK制約**（migration 0031）：
  - `ky_order_items`: `qty between 1 and 999`／`price between -9999999 and 9999999`（**discount は負が正規**＝§25-7。負を許すのは category='discount' のみとする CHECK が理想形）
  - `ky_orders`: `subtotal >= 0`／`deposit >= 0`／`change >= 0`（上限 99,999,999）
  - `ky_sales`: 各金額・件数列 `>= 0`／`ky_cast_payroll`: 各金額・分数列 `>= 0`（deductions は正の控除額）／`ky_expenses.amount between 0 and 99999999`
  - 適用は `alter table ... add constraint ... check ... not valid` → `validate constraint`（既存行を壊さず段階適用）
- **FIN-2 確定伝票の不変性**（migration 0031）：
  - `ky_orders` BEFORE UPDATE トリガー：`closed`/`void` の行は原則変更禁止。許可する遷移は **closed → void（会計取消）のみ**（S4 の `ky_casts_self_update_guard` と同型の列ガード方式）
  - `ky_order_items` BEFORE UPDATE/DELETE トリガー：親伝票が `closed`/`void` なら明細の変更・削除を拒否（void 化は親の状態変更で表現し、明細は監査のため残す）
- **FIN-3 会計確定のサーバー再計算**：`closeOrder()`（§32-2 で単一関数化済みの経路）を RPC `ky_close_order` 化し、**subtotal はサーバーが `sum(price*qty)` で再計算**。クライアント計算値は表示用のみ（改ざんクライアント対策）
- **FIN-4 plan列のクライアント更新禁止**（migration 0031）：`ky_tenants` BEFORE UPDATE トリガーで authenticated からの `plan` 変更を拒否（**service_role のみ変更可**）。IAP ON 前に入れておくことで、課金導線実装時の抜け穴を構造的に塞ぐ
- **SEC-11 CSVインジェクション対策**（コード修正・両CSVモジュール同時）：`escapeCell` で**セル先頭が `= + - @ \t \r` の場合はシングルクォート `'` を前置**（Excel/Google Sheets 共通の式実行防止定石）→ その上で従来の `"` 囲み。`web/src/admin/csv.ts` と `src/utils/csv.ts` は同一仕様コピーを維持（§24）
- **FIN-7先行分（軽量）**：`account_number` は UI で**下4桁以外マスク表示**・**CSV/エクスポートに含めない**（暗号化本体は Phase C）

### 33-2. Phase B（IAP課金ON時・フラグONの前提条件）

- **FIN-5 レシートのサーバー検証**：Edge Function `ky-iap-verify`（App Store Server API / Google Play Developer API で購入を検証）→ **service_role が `ky_tenants.plan` を更新**する唯一の経路とする。クライアント自己申告での plan 更新は FIN-4 が恒久的に拒否
- **FIN-6 監査ログ `ky_audit_log`**：金銭テーブル（ky_orders / ky_sales / ky_cast_payroll / ky_payroll_settings / ky_expenses）＋ plan 変更の UPDATE/DELETE をトリガーが `old/new` JSONB で自動記録。**オーナーは read のみ・UPDATE/DELETE 不可**（RLSで書込はトリガー経由に限定）＝店内の記録改ざん抑止と紛争時の証跡

### 33-3. Phase C（本番Supabase分離時＝相乗り解消と同時）

- **FIN-7 銀行口座情報の保存時暗号化**：Supabase Vault／pgsodium で `account_number`（最低限）を暗号化列へ移行。復号はオーナーの給与振込画面のみ。列レベルGRANTの棚卸し（S1方式）も同時に実施
- **SEC-12 Auth強化**：Leaked Password Protection を ON（Auth設定）・パスワード最低長引き上げ・**オーナーアカウントの MFA（TOTP）** を任意→推奨導線で提供
- **SEC-13 バックアップ/PITR**：本番プロジェクトは Pro プラン＋ **PITR 有効化**。金銭データ（ky_sales / ky_cast_payroll / ky_expenses）は日次エクスポートを別系統で保全
- ky-receipts バケット private 化＋署名URL移行（Rev63 監査の残債・SEC-5 準拠）

### 33-4. Phase D（将来・客側決済導入時＝弁護士確認❷がゲート）

- **FIN-8 資金非預かり原則**：客側決済を入れる場合も**きゃすりんは資金を預からない**構造（Stripe Connect の Direct charges 型＝店舗アカウントへ直接決済・プラットフォームは手数料のみ）を第一候補とする＝資金決済法（前受金・為替取引）の適用回避方針。**導入判断そのものが弁護士確認❷通過後**（§7・§16）
- カード情報はきゃすりんのサーバー・DBに一切触れさせない（Stripe Elements 等のトークン化＝PCI DSS SAQ-A 範囲に留める）
- **【2026-07-10 追加・Rev68】店舗向けサブスクの直販（カード/銀行振込）は Phase D（客側決済）とは別論点＝自社役務対価の直接受領で資金決済法の枠外**（の整理・弁護士確認❷にB2B直販1項目を追加）。詳細設計は **`docs/BILLING_DESIGN.md`**（Stripe Billing/Checkout/Invoicing・銀行振込は年払いのみ・契約台帳＋recompute_tenant_plan で FIN-4/5/6 と接続）

### 33-5. 実装順序と完了条件

1. Phase A＝migration 0031＋csv.ts×2＋`ky_close_order` RPC → WEB7 準拠（適用→RESTプローブ再検証）→ 1Rev1コミット
2. Phase B＝IAP_ENABLED=true にする Rev の**前提ゲート**として §14 横断ゲートに組込み
3. Phase C＝本番分離チェックリスト（saas_init_playbook）に組込み済み
4. 各 Phase 完了時に REVISION_LOG へ「§33 Phase X 通過」と明記

---

## §34 客Web予約ページ再設計＝concafe-yoyaku UI移植＋店舗テーマ設定（2026-07-10 第7次・設計のみ＝実装は別Rev）

### 34-0. 経緯と原則（2026-07-10ユーザー指示）

Rev12は concafe-yoyaku の「予約ロジック」だけを移植し、デザイン/UX（台帳型タイムライン・リッチな予約ポップアップ・背景写真テーマ）は未移植だったことを確認（現行客Web＝スロットグリッド簡易UI・ピンク無地）。本章はその是正の詳細設計。

- **原則①**: concafe-yoyaku 客ページ（https://rurifukuro.github.io/concafe-yoyaku/#/）の機能・デザイン・UIをきゃすりん客Webへ持ってくる
- **原則②（絶対）**: きゃすりん側に元からある機能は**絶対に削除しない**（保全リスト＝§34-5）
- **原則③（厳守）**: 「**席ごとに縦に時間を並べる**」台帳型タイムラインのデザインを厳守。時間をタップすると表示されるポップアップも参考にする
- **原則④**: お店側でカラーや写真の設定ができるようにする（テーマ設定＝§34-3）

### 34-1. 台帳型タイムライン（CustomerTimeline 移植・厳守）

移植元: `concafe-yoyaku/src/components/customer/CustomerTimeline.tsx`

**移植する構造（concafe実装そのまま）**:
- 横軸＝席列（席 1〜N。各列 `width: 100/N %`・`left: idx/N×100%`）、縦軸＝時間（`PX_PER_MINUTE=1.5`・`TOTAL_HEIGHT=営業分数×1.5`）
- 1時間毎の水平グリッド線＋左端に時刻ラベル
- **解禁帯＝タップ可能ゾーン**（「＋タップで予約」表示）。タップY→分変換 `minute = windowStart + y/PX_PER_MINUTE` → TIME_STEPへスナップ → `windowEnd − setMinutes` へクランプ（1セットが必ず収まる位置に丸める）
- **予約ブロック＝absolute配置**（`top = start×PPM`・`height = sets×setMinutes×PPM`）。**レーンの子ではなくキャンバス直下に独立配置**＝iOS Safariのpointer-events継承バグ回避（WEB10・concafe実装と同じ構造を踏襲）
- 自分の予約ブロックはタップ→変更/キャンセル（既存ReservationEditModal）。**他人の予約は匿名ブロック（「予約済み」のみ・名前等は非表示）**

**きゃすりん適合（concafeの固定値→動的化）**:
- 営業時間帯: concafeは17:00〜25:00固定 → 当日の解禁ウィンドウの `min(start)〜max(end)` から動的算出（HH:MM→分変換はtimeUtils・日跨ぎは24時超の分オフセットで表現）
- セット長: 窓ごとの `set_minutes`（40分固定にしない）。クランプ・ブロック高さ計算は該当窓の値を使う
- 席数N: Σ `ky_seat_types.capacity`（席種未設定テナントは受付設定の席数）。列ヘッダーは「席種名＋番号」（例: カウンター1）
- TIME_STEP: 現行 `getAvailableSlots` のスロット刻みと同一＝**空き判定ロジックは不変・見せ方を座標化するだけ**
- 現行スロットグリッド（TimeSlotList）は台帳型に**置換**（機能としての「空き枠一覧」は台帳型自体が全枠可視のため喪失なし）。**出勤キャストチップはタイムライン上部に維持**

### 34-2. 時間タップポップアップ（ReservationModal 移植）

移植元: `concafe-yoyaku/src/components/customer/ReservationModal.tsx`。きゃすりん既存ReservationModalへ統合する（**既存項目＝名前/連絡先/人数/指名キャスト/席種/要望/PINは全て維持**）。

- 開始時刻select: タップした窓の**全時刻**を列挙（タップ位置より前の時刻も選択可）
- セット数select: 各選択肢に時間範囲ラベル（例「2セット（19:00〜20:20）」）
- 席種select: 席料/セット表示（§29）＋席種note
- 「**当日にメニューを決める**」チェックボックス
- **ご注文予定（事前オーダー）**: `ky_menu_items` をカテゴリ別セクション＋数量ステッパーで表示。対象カテゴリ＝ `nomination`（指名）/`cast_drink`（キャストドリンク♥）/`drink`/`food`/`cheki`/`other`。`set`/`extension`/`discount` は対象外（セット料金は席種×セット数・延長は店内・割引は会計時＝§25-7）。`needs_cast` カテゴリは出勤キャストから対象キャストを選択
- **会計目安カード**: セット料金（席料×セット数）＋ご注文予定合計＝小計、サービス料別合計（現金x%／現金以外y%＝テナント設定 `business_info.serviceCharge`・未設定なら小計まで）。「※目安です。当日のご会計と異なる場合があります」注記。**目安はクライアント表示のみ＝確定金額は伝票（サーバー）が正**（FIN-3の建て付けを崩さない）
- 1セット1オーダー警告: `business_info.orderPolicy.minOrdersPerSet`（任意設定・未設定なら非表示）
- 排他: 既存 `ky_make_reservation` のadvisory lock維持

**データ設計（非破壊・後方互換）**:
- RPC v2: `p_orders(jsonb)`・`p_menu_undecided(boolean)` を**null可の追加引数**として拡張
- 予約への注文予定スナップショット: `ky_reservations.preorder (jsonb null)` ＝ `[{menu_item_id, category, name, price, qty, cast_id?}]`（名称・価格をコピー保存＝価格改定に耐えるスナップショット原則）
- チェックイン時に§25伝票へ**プリフィル**（open時にpreorder明細を初期投入・needs_castはキャスト紐付け済み）。preorderは「予定」であり確定注文ではない＝会計は伝票が唯一の正

### 34-3. 店舗テーマ設定（お店側でカラー・写真を設定＝原則④）

- 設定値: `ky_tenants.business_info.theme (jsonb・migration不要)` ＝ `{ primaryColor, accentColor, bgImageUrl, cardOpacity }`
- 背景写真: Storageバケット **`ky-tenant-assets`（新設）** の `{tenant_id}/bg.jpg`。RLS＝公開read・書込はテナントオーナーのみ（SEC-8フォルダスコープ）。アップロード時に長辺1600px・品質80へ縮小
- 客ページ適用: TenantPage mount時にCSS変数（`--primary`/`--accent`等）をテナント値で上書き。背景は `cover/fixed`、コンテンツは**半透明白カード**（rgba白 0.75〜0.9＝concafeのbg.jpg方式を店舗別に一般化）で写真上でも可読性を担保。**テーマ未設定なら現行きゃすりんピンクのまま＝完全後方互換**
- 管理UI: AdminSettingsに「**客ページデザイン**」セクション＝カラーピッカー2種＋背景画像アップロード/削除＋ライブプレビュー＋「既定に戻す」（アプリ側設定は後フェーズ可・管理Web先行）

### 34-4. カレンダー・導線のconcafe化

- 空き塗り分け（空きあり/残少/満席の3色）を既存Calendarへ適用・凡例表示
- 次の予約可能日への自動フォーカス（ユーザーが日付を触ったら自動遷移しない＝userPicked ref方式）
- notice-banner（店からのお知らせ帯・theme連動）
- 既存の営業日判定・解禁前表示は不変

### 34-5. 既存機能の保全チェックリスト（原則②＝絶対に削除しない）

店名ヘッダー（ジャンル・営業案内）／イベント情報セクション（usePublicEvents）／出勤キャストチップ／キャスト指名（あいうえお順＝§28-1）／席種ドロップダウン＋席料表示（§29）／予約の確認・変更・キャンセル（PIN）／マルチテナントslug解決／HH:MM・窓ごとset_minutes・席数設定／Powered by きゃすりん／i18n

**完了ゲート**: 実装Revで本リストを実HTTPで1項目ずつ照合し、REVISION_LOGに「§34保全リスト通過」と明記（WEB5）。

### 34-6. 実装順序・検証

- §19の**㊴**。推奨分割: (a) テーマ設定（独立・先行可）→ (b) 台帳タイムライン＋ポップアップUI → (c) ご注文予定＋RPC v2＋伝票プリフィル（⑱〜⑳オーダー基盤の完了が前提）
- 検証: `npx tsc -b`／実HTTP実証（WEB5）／iPhone Safari実機タッチ（WEB10）／モバイル幅でモーダル収まり＋スクロール（WEB11）／§34-5保全ゲート

---

## 横断ゲート（完了宣言前・app_dev_rules SPEC-CROSS/REUSE-TRIGGER/SCREEN-COMPARE/TAB-ICON）

**§3機能✅だけで完了と言わない。§9（タブUI）／§11（流用components実体照合）／§14（IAP×UI存在）／§15（UGC 4要件）／§16（アカウント削除・法務）を全ゲート通過してからREVISION_LOGに明記。**
