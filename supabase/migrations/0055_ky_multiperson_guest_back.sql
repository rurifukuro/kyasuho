-- 0055: §54-1 複数人会計 + §54-2 ゲストバック率
--
-- §54-1: ky_orders.guest_count（同卓人数）+ is_guest_order（インフルエンサー伝票）
-- §54-2: ky_menu_items.guest_back_rate / guest_back_amount（ゲスト来店時の特別バック）

-- ================================================================
-- 1. ky_orders: 複数人会計 + ゲスト伝票フラグ
-- ================================================================

ALTER TABLE public.ky_orders
  ADD COLUMN guest_count int NOT NULL DEFAULT 1
    CHECK (guest_count >= 1),
  ADD COLUMN is_guest_order bool NOT NULL DEFAULT false;

COMMENT ON COLUMN public.ky_orders.guest_count IS '同卓人数（均等分割の分母・日報のguest_count集計に使用）';
COMMENT ON COLUMN public.ky_orders.is_guest_order IS 'ゲスト（インフルエンサー）伝票＝trueの場合guest_back_rateでバック解決';

-- ================================================================
-- 2. ky_menu_items: ゲストバック率
-- ================================================================

ALTER TABLE public.ky_menu_items
  ADD COLUMN guest_back_rate numeric(5,2)
    CHECK (guest_back_rate IS NULL OR (guest_back_rate >= 0 AND guest_back_rate <= 100)),
  ADD COLUMN guest_back_amount int
    CHECK (guest_back_amount IS NULL OR guest_back_amount >= 0);

-- 通常バックと同じく排他制約（両方設定は禁止）
ALTER TABLE public.ky_menu_items
  ADD CONSTRAINT ky_menu_items_guest_back_exclusive
    CHECK (NOT (guest_back_rate IS NOT NULL AND guest_back_amount IS NOT NULL));

COMMENT ON COLUMN public.ky_menu_items.guest_back_rate IS 'ゲスト来店時のバック割合（%）。nullなら通常バックにフォールバック';
COMMENT ON COLUMN public.ky_menu_items.guest_back_amount IS 'ゲスト来店時のバック固定額（円）。nullなら通常バックにフォールバック';
