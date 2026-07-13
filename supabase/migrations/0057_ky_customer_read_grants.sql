-- きゃすりん migration 0057: お客様モード読取り権限（§45-8 RLS攻撃面準拠）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
-- ★本番適用はユーザー承認ゲート
--
-- 0046 で ky_tenants / ky_casts に列GRANT済み。本ファイルは残りのテーブルに横展開:
--   ・ky_shifts: 公開列のみ（SEC-15）
--   ・ky_events: 公開列のみ（SEC-15）
--   ・ky_casts: accepts_offschedule_nomination 列を追加GRANT（0053で追加された列）
-- 行ポリシー（anon SELECT）は 0004/0023 で既存＝追加不要。
-- 全文冪等（GRANT/REVOKE のみ＝非破壊）。
--
-- ロールバック:
--   GRANT SELECT ON public.ky_shifts TO anon;
--   GRANT SELECT ON public.ky_events TO anon;
--   -- ky_casts は 0046 状態に戻す:
--   REVOKE SELECT ON public.ky_casts FROM anon;
--   GRANT SELECT (id, tenant_id, name, name_kana, photo_url, sns_links, bio, accepts_nomination, sort_order)
--     ON public.ky_casts TO anon;

-- ── 0053のALTER TABLE補完（列が欠落していた場合のガード） ──
ALTER TABLE public.ky_casts
  ADD COLUMN IF NOT EXISTS accepts_offschedule_nomination boolean NOT NULL DEFAULT false;

ALTER TABLE public.ky_reservations
  ADD COLUMN IF NOT EXISTS nomination_type text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ky_reservations_nomination_type_check'
  ) THEN
    ALTER TABLE public.ky_reservations
      ADD CONSTRAINT ky_reservations_nomination_type_check
        CHECK (nomination_type IN ('standard','off_schedule'));
  END IF;
END $$;

-- ── ky_shifts: 公開列のみ（updated_at/created_at は不要） ──
REVOKE SELECT ON public.ky_shifts FROM anon;
GRANT SELECT (id, tenant_id, cast_id, date, start_at, end_at)
  ON public.ky_shifts TO anon;

-- ── ky_events: 公開イベントの列のみ ──
REVOKE SELECT ON public.ky_events FROM anon;
GRANT SELECT (id, tenant_id, title, description, event_date, start_time, end_time, event_type, is_public)
  ON public.ky_events TO anon;

-- ── ky_casts: 0053で追加された accepts_offschedule_nomination を追加GRANT ──
-- 0046 の列: id, tenant_id, name, name_kana, photo_url, sns_links, bio, accepts_nomination, sort_order
-- 追加: accepts_offschedule_nomination（§45-6 客側表示用）
REVOKE SELECT ON public.ky_casts FROM anon;
GRANT SELECT (id, tenant_id, name, name_kana, photo_url, sns_links, bio, accepts_nomination, sort_order, accepts_offschedule_nomination)
  ON public.ky_casts TO anon;
