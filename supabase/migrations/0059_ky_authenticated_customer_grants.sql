-- 0059: authenticated ロールへの公開読取りポリシー＋列GRANT横展開（§45 批判的チェック S-1〜S-5）
--
-- 背景: お客様モード(§45)はログイン済み(authenticated)で動作するが、
--   公開読取りポリシーが全て TO anon のみだった。authenticated ユーザーが
--   SELECT すると全テーブルで 0件が返り、お客様モード全画面が非動作。
--   加えて列GRANT も anon にしか適用されておらず、authenticated に行ポリシーを
--   追加するだけでは PII 列（customer_name/contact）や内部列（back_rate）が露出する。
--
-- 対処:
--   (A) 各テーブルに FOR SELECT TO authenticated の公開読取りポリシーを追加
--   (B) 列GRANT を authenticated にも同一列で適用
--   (C) SEC-15 漏れの ky_unlock_windows / ky_seat_types に列GRANT 追加
--
-- 対象テーブル:
--   ky_tenants / ky_casts / ky_shifts / ky_events / ky_reservations /
--   ky_menu_items / ky_unlock_windows / ky_seat_types /
--   ky_point_settings / ky_point_rewards
--
-- 冪等（GRANT/REVOKE + DROP POLICY IF EXISTS のみ＝非破壊）。
-- ★本番適用はユーザー承認ゲート

-- ══════════════════════════════════════════════════════════════
-- (A) authenticated 向け公開読取りポリシー
-- ══════════════════════════════════════════════════════════════

-- ── ky_tenants ──
DROP POLICY IF EXISTS ky_tenants_customer_select ON public.ky_tenants;
CREATE POLICY ky_tenants_customer_select ON public.ky_tenants
  FOR SELECT TO authenticated
  USING (NOT is_suspended);

-- ── ky_casts ──（既存 ky_casts_anon_select は TO anon のみ）
DROP POLICY IF EXISTS ky_casts_customer_select ON public.ky_casts;
CREATE POLICY ky_casts_customer_select ON public.ky_casts
  FOR SELECT TO authenticated
  USING (
    (SELECT NOT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id)
  );

-- ── ky_shifts ──
DROP POLICY IF EXISTS ky_shifts_customer_select ON public.ky_shifts;
CREATE POLICY ky_shifts_customer_select ON public.ky_shifts
  FOR SELECT TO authenticated
  USING (
    (SELECT NOT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id)
  );

-- ── ky_events ──
DROP POLICY IF EXISTS ky_events_customer_select ON public.ky_events;
CREATE POLICY ky_events_customer_select ON public.ky_events
  FOR SELECT TO authenticated
  USING (
    (SELECT NOT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id)
    AND is_public = true
  );

-- ── ky_reservations ──
DROP POLICY IF EXISTS ky_reservations_customer_select ON public.ky_reservations;
CREATE POLICY ky_reservations_customer_select ON public.ky_reservations
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND (SELECT NOT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id)
  );

-- ── ky_menu_items ──
DROP POLICY IF EXISTS ky_menu_items_customer_select ON public.ky_menu_items;
CREATE POLICY ky_menu_items_customer_select ON public.ky_menu_items
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (SELECT NOT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id)
  );

-- ── ky_unlock_windows ──
DROP POLICY IF EXISTS ky_unlock_windows_customer_select ON public.ky_unlock_windows;
CREATE POLICY ky_unlock_windows_customer_select ON public.ky_unlock_windows
  FOR SELECT TO authenticated
  USING (
    (SELECT NOT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id)
  );

-- ── ky_seat_types ──
DROP POLICY IF EXISTS ky_seat_types_customer_select ON public.ky_seat_types;
CREATE POLICY ky_seat_types_customer_select ON public.ky_seat_types
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (SELECT NOT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id)
  );

-- ── ky_point_settings ──
DROP POLICY IF EXISTS ky_point_settings_customer_select ON public.ky_point_settings;
CREATE POLICY ky_point_settings_customer_select ON public.ky_point_settings
  FOR SELECT TO authenticated
  USING (
    (SELECT NOT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id)
  );

-- ── ky_point_rewards ──
DROP POLICY IF EXISTS ky_point_rewards_customer_select ON public.ky_point_rewards;
CREATE POLICY ky_point_rewards_customer_select ON public.ky_point_rewards
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (SELECT NOT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id)
  );

-- ══════════════════════════════════════════════════════════════
-- (B) authenticated 向け列GRANT（anon と同一列＝内部列を遮断）
-- ══════════════════════════════════════════════════════════════
-- 注意: Supabase の ALTER DEFAULT PRIVILEGES は authenticated に全テーブル
-- SELECT を付与するため、先に REVOKE で白紙にしてから列GRANTする。
-- ただし owner テーブルの全列ポリシー（_owner_all）は SECURITY DEFINER RPC
-- 内での操作で通るため影響なし。RLS で行が見えなければ列 GRANT は無意味。
-- owner_all ポリシーが authenticated+owner_user_id を見ている限り、
-- owner は引き続き全列アクセス可能。
--
-- ★ 但し cast 向け SELECT ポリシーがあるテーブル（ky_shifts 等）は
--    cast も authenticated なので同じ列制限を受ける。
--    cast に必要な列が足りない場合は別途 GRANT を追加する。
--    現状 cast が直接 SELECT するテーブルは CastHomeScreen で
--    自分の shift を取る程度で、id/tenant_id/cast_id/date/start_at/end_at で足りる。

-- ── ky_tenants ──
REVOKE SELECT ON public.ky_tenants FROM authenticated;
GRANT SELECT (id, slug, name, genre, business_info, is_suspended)
  ON public.ky_tenants TO authenticated;

-- ── ky_casts ──
REVOKE SELECT ON public.ky_casts FROM authenticated;
GRANT SELECT (id, tenant_id, name, name_kana, photo_url, sns_links, bio,
             accepts_nomination, sort_order, accepts_offschedule_nomination)
  ON public.ky_casts TO authenticated;

-- ── ky_shifts ──
REVOKE SELECT ON public.ky_shifts FROM authenticated;
GRANT SELECT (id, tenant_id, cast_id, date, start_at, end_at)
  ON public.ky_shifts TO authenticated;

-- ── ky_events ──
REVOKE SELECT ON public.ky_events FROM authenticated;
GRANT SELECT (id, tenant_id, title, description, event_date, start_time,
             end_time, event_type, is_public)
  ON public.ky_events TO authenticated;

-- ── ky_reservations ──（PII 列 customer_name/contact を遮断）
REVOKE SELECT ON public.ky_reservations FROM authenticated;
GRANT SELECT (id, tenant_id, date, slot, set_minutes, seat_no, status)
  ON public.ky_reservations TO authenticated;

-- ── ky_menu_items ──（back_rate/back_amount 等の報酬列を遮断）
REVOKE SELECT ON public.ky_menu_items FROM authenticated;
GRANT SELECT (id, tenant_id, category, name, price, needs_cast, sort_order,
             is_active, nomination_kind)
  ON public.ky_menu_items TO authenticated;

-- ── ky_unlock_windows ──（S-4: SEC-15 漏れ修正。anon にも列GRANT追加）
REVOKE SELECT ON public.ky_unlock_windows FROM anon;
GRANT SELECT (id, tenant_id, date, open_from, close_at, seats, set_minutes)
  ON public.ky_unlock_windows TO anon;

REVOKE SELECT ON public.ky_unlock_windows FROM authenticated;
GRANT SELECT (id, tenant_id, date, open_from, close_at, seats, set_minutes)
  ON public.ky_unlock_windows TO authenticated;

-- ── ky_seat_types ──（S-5: SEC-15 漏れ修正。anon にも列GRANT追加）
REVOKE SELECT ON public.ky_seat_types FROM anon;
GRANT SELECT (id, tenant_id, name, seat_fee, sort_order, is_active, capacity)
  ON public.ky_seat_types TO anon;

REVOKE SELECT ON public.ky_seat_types FROM authenticated;
GRANT SELECT (id, tenant_id, name, seat_fee, sort_order, is_active, capacity)
  ON public.ky_seat_types TO authenticated;

-- ── ky_point_settings ──
REVOKE SELECT ON public.ky_point_settings FROM authenticated;
GRANT SELECT (tenant_id, enabled, yen_per_point)
  ON public.ky_point_settings TO authenticated;

-- ── ky_point_rewards ──
REVOKE SELECT ON public.ky_point_rewards FROM authenticated;
GRANT SELECT (id, tenant_id, points_required, name, description, is_active, sort_order)
  ON public.ky_point_rewards TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- ロールバック手順
-- ══════════════════════════════════════════════════════════════
-- 全 _customer_select ポリシーを DROP
-- authenticated への REVOKE を取り消し → GRANT SELECT ON <table> TO authenticated;
-- ky_unlock_windows / ky_seat_types の anon 列GRANT を GRANT SELECT ON <table> TO anon; に戻す
