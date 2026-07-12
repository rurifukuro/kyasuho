-- きゃすりん Rev117 migration 0046: anon 列レベルGRANT 横展開（§51監査 AUD-1 / SEC-15）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   GRANT/REVOKE のみ＝非破壊。テーブル定義・データ・行ポリシーは不変。
--
-- 背景: 0030 S1 で ky_reservations に確立した「行ポリシー＋列GRANT」パターンの横展開漏れ。
--   ky_tenants の anon 行ポリシー（0001）と ky_casts の anon 行ポリシー（0004）は行のみ制限で、
--   `?select=owner_user_id` / `?select=user_id` により全店舗のオーナーuid・キャスト個人uidが
--   匿名で収集できた。plan / sns_post_templates / timer設定等の内部運用列も同様に露出していた。
--
-- 注意（SEC-15）:
--   ・anon の行ポリシー内サブクエリ（`select is_suspended from ky_tenants ...`）は
--     クエリ実行ロールの列権限で評価される＝参照される id / is_suspended は GRANT に必ず含める。
--   ・この GRANT 下では anon の select('*') は permission denied になる＝客Web側は明示列必須
--     （useTenant.ts / useCasts.ts / ReservationModal.tsx と対で保守する）。
--
-- ロールバック:
--   GRANT SELECT ON public.ky_tenants TO anon;
--   GRANT SELECT ON public.ky_casts   TO anon;

-- ── ky_tenants: 公開ページ表示に必要な列のみ ──
-- 除外: owner_user_id / plan / sns_links / sns_post_templates / prefecture / area /
--       ranking_opt_in / enable_bottle_keep / enable_vouchers / timer_enabled /
--       timer_alert_minutes / nomination_kinds_enabled / created_at / updated_at
-- （将来 anon 面でランキング等を出す時は、その migration で列を追加 GRANT する）
REVOKE SELECT ON public.ky_tenants FROM anon;
GRANT SELECT (id, slug, name, genre, business_info, is_suspended)
  ON public.ky_tenants TO anon;

-- ── ky_casts: 公開プロフィール列のみ（user_id＝auth連携uidを遮断） ──
REVOKE SELECT ON public.ky_casts FROM anon;
GRANT SELECT (id, tenant_id, name, name_kana, photo_url, sns_links, bio, accepts_nomination, sort_order)
  ON public.ky_casts TO anon;
