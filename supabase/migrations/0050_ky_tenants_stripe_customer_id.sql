-- きゃすりん migration 0050: ky_tenants に stripe_customer_id 追加
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   ALTER TABLE ADD COLUMN のみ＝非破壊。既存行は NULL。
--
-- 用途: Stripe Checkout で Customer を自動作成した際の Stripe Customer ID を保存。
--   ky-checkout Edge Function が初回決済時に作成し UPDATE で書き込む（service_role経由）。
--   SEC-14 準拠＝クライアント直接書込禁止（service_roleのみ・0031で確立済みのplan列と同パターン）。
--
-- anon列GRANT: 0046で id/slug/name/genre/business_info/is_suspended のみ許可済み＝
--   stripe_customer_id は anon から自動的に不可視（追加GRANTしない）。
--
-- ロールバック: ALTER TABLE public.ky_tenants DROP COLUMN stripe_customer_id;

ALTER TABLE public.ky_tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT NULL;

COMMENT ON COLUMN public.ky_tenants.stripe_customer_id
  IS 'Stripe Customer ID (cus_xxx)。ky-checkout Edge Function が初回作成時に設定';
