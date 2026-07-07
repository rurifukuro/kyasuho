-- きゃすりん Rev65 migration 0031: 金融・セキュリティ強化 Phase A（SPEC §33-1）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   CHECK制約追加＋トリガー追加のみ＝非破壊。既存データは壊さない（not valid→validate）。
--
-- ロールバック（末尾にも記載）:
--   alter table ky_order_items drop constraint if exists ky_order_items_qty_range;
--   alter table ky_order_items drop constraint if exists ky_order_items_price_range;
--   alter table ky_orders drop constraint if exists ky_orders_subtotal_range;
--   alter table ky_orders drop constraint if exists ky_orders_deposit_range;
--   alter table ky_orders drop constraint if exists ky_orders_change_range;
--   alter table ky_sales drop constraint if exists ky_sales_total_revenue_nonneg;
--   alter table ky_sales drop constraint if exists ky_sales_set_count_nonneg;
--   alter table ky_sales drop constraint if exists ky_sales_drink_count_nonneg;
--   alter table ky_sales drop constraint if exists ky_sales_nomination_count_nonneg;
--   alter table ky_sales drop constraint if exists ky_sales_other_revenue_nonneg;
--   alter table ky_cast_payroll drop constraint if exists ky_cast_payroll_amounts_nonneg;
--   alter table ky_expenses drop constraint if exists ky_expenses_amount_range;
--   drop trigger if exists ky_orders_closed_immutable on ky_orders;
--   drop function if exists ky_orders_closed_immutable_guard();
--   drop trigger if exists ky_order_items_closed_immutable on ky_order_items;
--   drop function if exists ky_order_items_closed_immutable_guard();
--   drop trigger if exists ky_tenants_plan_protect on ky_tenants;
--   drop function if exists ky_tenants_plan_protect_guard();
--   drop function if exists ky_close_order(uuid, uuid, int, int, text, text, uuid);

-- ================================================================
-- FIN-1: 金銭CHECK制約（§33-1）
-- ================================================================

-- ── ky_order_items: qty 1〜999 / price -9,999,999〜9,999,999（discount は負が正規＝§25-7）──
alter table public.ky_order_items
  add constraint ky_order_items_qty_range
  check (qty between 1 and 999) not valid;
alter table public.ky_order_items validate constraint ky_order_items_qty_range;

alter table public.ky_order_items
  add constraint ky_order_items_price_range
  check (price between -9999999 and 9999999) not valid;
alter table public.ky_order_items validate constraint ky_order_items_price_range;

-- ── ky_orders: subtotal/deposit/change は非負＋現実的上限 ──
alter table public.ky_orders
  add constraint ky_orders_subtotal_range
  check (subtotal between 0 and 99999999) not valid;
alter table public.ky_orders validate constraint ky_orders_subtotal_range;

alter table public.ky_orders
  add constraint ky_orders_deposit_range
  check (deposit between 0 and 99999999) not valid;
alter table public.ky_orders validate constraint ky_orders_deposit_range;

alter table public.ky_orders
  add constraint ky_orders_change_range
  check (change between 0 and 99999999) not valid;
alter table public.ky_orders validate constraint ky_orders_change_range;

-- ── ky_sales: 全金額・件数列は非負 ──
alter table public.ky_sales
  add constraint ky_sales_total_revenue_nonneg
  check (total_revenue >= 0) not valid;
alter table public.ky_sales validate constraint ky_sales_total_revenue_nonneg;

alter table public.ky_sales
  add constraint ky_sales_set_count_nonneg
  check (set_count >= 0) not valid;
alter table public.ky_sales validate constraint ky_sales_set_count_nonneg;

alter table public.ky_sales
  add constraint ky_sales_drink_count_nonneg
  check (drink_count >= 0) not valid;
alter table public.ky_sales validate constraint ky_sales_drink_count_nonneg;

alter table public.ky_sales
  add constraint ky_sales_nomination_count_nonneg
  check (nomination_count >= 0) not valid;
alter table public.ky_sales validate constraint ky_sales_nomination_count_nonneg;

alter table public.ky_sales
  add constraint ky_sales_other_revenue_nonneg
  check (other_revenue >= 0) not valid;
alter table public.ky_sales validate constraint ky_sales_other_revenue_nonneg;

-- ── ky_cast_payroll: 金額・分数列は非負（deductions は正の控除額） ──
alter table public.ky_cast_payroll
  add constraint ky_cast_payroll_amounts_nonneg
  check (
    minutes_worked >= 0
    and base_pay >= 0
    and nomination_count >= 0
    and nomination_back >= 0
    and drink_count >= 0
    and drink_back >= 0
    and other_back >= 0
    and deductions >= 0
    and total_pay >= 0
  ) not valid;
alter table public.ky_cast_payroll validate constraint ky_cast_payroll_amounts_nonneg;

-- ── ky_expenses: amount 0〜99,999,999 ──
alter table public.ky_expenses
  add constraint ky_expenses_amount_range
  check (amount between 0 and 99999999) not valid;
alter table public.ky_expenses validate constraint ky_expenses_amount_range;


-- ================================================================
-- FIN-2: 確定伝票の不変性（§33-1）
-- ================================================================

-- ── ky_orders: closed/void の行は原則変更禁止。許す遷移は closed→void のみ ──
create or replace function public.ky_orders_closed_immutable_guard()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if OLD.status in ('closed', 'void') then
    -- closed → void（会計取消）は唯一の許可遷移
    if OLD.status = 'closed' and NEW.status = 'void' then
      -- void 化時は status と updated_at のみ変更を許可
      NEW.tenant_id       := OLD.tenant_id;
      NEW.biz_date        := OLD.biz_date;
      NEW.seat_no         := OLD.seat_no;
      NEW.reservation_id  := OLD.reservation_id;
      NEW.customer_label  := OLD.customer_label;
      NEW.customer_id     := OLD.customer_id;
      NEW.opened_at       := OLD.opened_at;
      NEW.closed_at       := OLD.closed_at;
      NEW.subtotal        := OLD.subtotal;
      NEW.deposit         := OLD.deposit;
      NEW.change          := OLD.change;
      NEW.payment_method  := OLD.payment_method;
      NEW.note            := OLD.note;
      NEW.created_at      := OLD.created_at;
      return NEW;
    end if;
    raise exception 'confirmed order (status=%) cannot be modified', OLD.status
      using errcode = 'P0001';
  end if;
  return NEW;
end $$;

drop trigger if exists ky_orders_closed_immutable on public.ky_orders;
create trigger ky_orders_closed_immutable
  before update on public.ky_orders
  for each row execute function public.ky_orders_closed_immutable_guard();

-- ── ky_order_items: 親伝票が closed/void なら明細の変更・削除を拒否 ──
create or replace function public.ky_order_items_closed_immutable_guard()
returns trigger language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  if TG_OP = 'DELETE' then
    select status into v_status from public.ky_orders where id = OLD.order_id;
  else
    select status into v_status from public.ky_orders where id = NEW.order_id;
  end if;

  if v_status in ('closed', 'void') then
    raise exception 'cannot modify items of a confirmed order (status=%)', v_status
      using errcode = 'P0001';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end $$;

drop trigger if exists ky_order_items_closed_immutable on public.ky_order_items;
create trigger ky_order_items_closed_immutable
  before update or delete on public.ky_order_items
  for each row execute function public.ky_order_items_closed_immutable_guard();


-- ================================================================
-- FIN-3: 会計確定RPC ky_close_order（§33-1・subtotalサーバー再計算）
-- ================================================================

create or replace function public.ky_close_order(
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
begin
  -- テナント所有権チェック
  select owner_user_id into v_owner_id
    from public.ky_tenants where id = p_tenant_id;
  if v_owner_id is null or v_owner_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- 伝票存在＋ステータスチェック
  select status into v_order_status
    from public.ky_orders
    where id = p_order_id and tenant_id = p_tenant_id;
  if v_order_status is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_order_status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;

  -- 入力バリデーション
  if p_deposit < 0 or p_change < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if p_payment_method not in ('cash', 'card', 'qr', 'other') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_method');
  end if;

  -- サーバー側で subtotal を再計算（FIN-3 の核心）
  select coalesce(sum(price * qty), 0) into v_subtotal
    from public.ky_order_items
    where order_id = p_order_id;

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

-- authenticated に実行権を付与（anon には付けない）
grant execute on function public.ky_close_order(uuid, uuid, int, int, text, text, uuid) to authenticated;


-- ================================================================
-- FIN-4: plan列のクライアント更新禁止（§33-1）
-- ================================================================

create or replace function public.ky_tenants_plan_protect_guard()
returns trigger language plpgsql
set search_path = public
as $$
begin
  -- service_role（Edge Function等）からの更新は許可
  if current_setting('role', true) = 'service_role' then
    return NEW;
  end if;
  -- authenticated からの plan 変更を拒否
  if NEW.plan is distinct from OLD.plan then
    raise exception 'plan column can only be updated via service_role'
      using errcode = 'P0001';
  end if;
  return NEW;
end $$;

drop trigger if exists ky_tenants_plan_protect on public.ky_tenants;
create trigger ky_tenants_plan_protect
  before update on public.ky_tenants
  for each row execute function public.ky_tenants_plan_protect_guard();


-- ================================================================
-- ロールバックSQL（参考・このファイル末尾にまとめて記載）
-- ================================================================
-- alter table ky_order_items drop constraint if exists ky_order_items_qty_range;
-- alter table ky_order_items drop constraint if exists ky_order_items_price_range;
-- alter table ky_orders drop constraint if exists ky_orders_subtotal_range;
-- alter table ky_orders drop constraint if exists ky_orders_deposit_range;
-- alter table ky_orders drop constraint if exists ky_orders_change_range;
-- alter table ky_sales drop constraint if exists ky_sales_total_revenue_nonneg;
-- alter table ky_sales drop constraint if exists ky_sales_set_count_nonneg;
-- alter table ky_sales drop constraint if exists ky_sales_drink_count_nonneg;
-- alter table ky_sales drop constraint if exists ky_sales_nomination_count_nonneg;
-- alter table ky_sales drop constraint if exists ky_sales_other_revenue_nonneg;
-- alter table ky_cast_payroll drop constraint if exists ky_cast_payroll_amounts_nonneg;
-- alter table ky_expenses drop constraint if exists ky_expenses_amount_range;
-- drop trigger if exists ky_orders_closed_immutable on ky_orders;
-- drop function if exists ky_orders_closed_immutable_guard();
-- drop trigger if exists ky_order_items_closed_immutable on ky_order_items;
-- drop function if exists ky_order_items_closed_immutable_guard();
-- drop trigger if exists ky_tenants_plan_protect on ky_tenants;
-- drop function if exists ky_tenants_plan_protect_guard();
-- drop function if exists ky_close_order(uuid, uuid, int, int, text, text, uuid);
