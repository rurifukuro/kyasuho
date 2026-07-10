-- §39 キャストバック計算の刷新＝メニュー別（割合/固定）＋基本バック割合
--
-- 変更:
--   ky_menu_items      : back_rate / back_amount 列追加 (排他CHECK)
--   ky_order_items     : back_each 列追加 (会計確定時にスナップ)
--   ky_payroll_settings: default_back_rate 追加 → drink_back_rate 廃止
--   ky_cast_payroll    : drink_back → menu_back リネーム
--   ky_close_order RPC : back_each 計算ロジック追加
--
-- ロールバック:
--   ALTER TABLE ky_menu_items DROP CONSTRAINT ky_menu_items_back_exclusive;
--   ALTER TABLE ky_menu_items DROP COLUMN back_rate, DROP COLUMN back_amount;
--   ALTER TABLE ky_order_items DROP COLUMN back_each;
--   ALTER TABLE ky_cast_payroll RENAME COLUMN menu_back TO drink_back;
--   ALTER TABLE ky_payroll_settings ADD COLUMN drink_back_rate int NOT NULL DEFAULT 100;
--   -- drink_back_rate の値復元: UPDATE ... FROM ky_menu_items WHERE category='cast_drink'...
--   ALTER TABLE ky_payroll_settings DROP COLUMN default_back_rate;
--   -- ky_close_order は 0031 版に戻す

-- ================================================================
-- 1. ky_menu_items: メニュー別バック設定
-- ================================================================

ALTER TABLE public.ky_menu_items
  ADD COLUMN back_rate numeric(5,2) CHECK (back_rate IS NULL OR (back_rate >= 0 AND back_rate <= 100)),
  ADD COLUMN back_amount int CHECK (back_amount IS NULL OR back_amount >= 0);

ALTER TABLE public.ky_menu_items
  ADD CONSTRAINT ky_menu_items_back_exclusive
  CHECK (back_rate IS NULL OR back_amount IS NULL);

-- ================================================================
-- 2. ky_order_items: 確定バック額スナップショット
-- ================================================================

ALTER TABLE public.ky_order_items
  ADD COLUMN back_each int;

-- ================================================================
-- 3. ky_payroll_settings: 基本バック割合 追加
-- ================================================================

ALTER TABLE public.ky_payroll_settings
  ADD COLUMN default_back_rate numeric(5,2) NOT NULL DEFAULT 0
  CHECK (default_back_rate >= 0 AND default_back_rate <= 100);

-- ================================================================
-- 4. データ移行: 既存 drink_back_rate → cast_drink メニューの back_amount
--    (挙動不変: 移行前後で給与計算結果が変わらない)
-- ================================================================

UPDATE public.ky_menu_items mi
SET back_amount = ps.drink_back_rate
FROM public.ky_payroll_settings ps
WHERE mi.tenant_id = ps.tenant_id
  AND mi.category = 'cast_drink'
  AND ps.drink_back_rate > 0
  AND mi.back_amount IS NULL
  AND mi.back_rate IS NULL;

-- ================================================================
-- 5. drink_back_rate 列を廃止
-- ================================================================

ALTER TABLE public.ky_payroll_settings DROP COLUMN drink_back_rate;

-- ================================================================
-- 6. ky_cast_payroll: drink_back → menu_back リネーム
-- ================================================================

ALTER TABLE public.ky_cast_payroll RENAME COLUMN drink_back TO menu_back;

-- ================================================================
-- 7. ky_close_order RPC 更新: back_each 計算追加
--    (シグネチャ不変 = CREATE OR REPLACE)
-- ================================================================

CREATE OR REPLACE FUNCTION public.ky_close_order(
  p_order_id       uuid,
  p_tenant_id      uuid,
  p_deposit        int,
  p_change         int,
  p_payment_method text,
  p_note           text default '',
  p_customer_id    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal    int;
  v_owner_id    uuid;
  v_order_status text;
  v_default_back numeric(5,2);
begin
  select owner_user_id into v_owner_id
    from public.ky_tenants where id = p_tenant_id;
  if v_owner_id is null or v_owner_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select status into v_order_status
    from public.ky_orders
    where id = p_order_id and tenant_id = p_tenant_id;
  if v_order_status is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_order_status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;

  if p_deposit < 0 or p_change < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if p_payment_method not in ('cash', 'card', 'qr', 'other') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_method');
  end if;

  -- FIN-3: サーバー側で subtotal を再計算
  select coalesce(sum(price * qty), 0) into v_subtotal
    from public.ky_order_items
    where order_id = p_order_id;

  -- §39: back_each を解決して書き込む（cast_id 付き明細のみ）
  -- 取得: テナントの基本バック割合（設定未保存は 0）
  select coalesce(ps.default_back_rate, 0) into v_default_back
    from public.ky_payroll_settings ps
    where ps.tenant_id = p_tenant_id;
  if v_default_back is null then
    v_default_back := 0;
  end if;

  -- 優先順位: 1.固定額 → 2.メニュー割合% → 3.基本割合%(nomination除外)
  update public.ky_order_items oi set back_each =
    case
      when mi.back_amount is not null then mi.back_amount
      when mi.back_rate is not null then floor(oi.price * mi.back_rate / 100)
      when mi.category <> 'nomination' and v_default_back > 0
        then floor(oi.price * v_default_back / 100)
      else null
    end
  from public.ky_menu_items mi
  where oi.order_id = p_order_id
    and oi.cast_id is not null
    and oi.menu_item_id = mi.id;

  -- 伝票を確定
  update public.ky_orders set
    status         = 'closed',
    closed_at      = now(),
    subtotal       = v_subtotal,
    deposit        = p_deposit,
    change         = p_change,
    payment_method = p_payment_method,
    note           = p_note,
    customer_id    = p_customer_id
  where id = p_order_id;

  return jsonb_build_object('ok', true, 'subtotal', v_subtotal);
end $$;
