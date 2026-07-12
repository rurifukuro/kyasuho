-- §47 在庫管理: 品目マスタ + 入出庫台帳（append-only）
-- stock_qty はキャッシュ＝真実の残高は Σ(ky_inventory_moves.qty)
-- 2026-07-12 本番適用前に是正（Rev118）: RLSポリシーの ky_tenants.user_id は実在しない列
-- （正: owner_user_id）＝CREATE POLICY が適用時に失敗するバグを修正

-- ── ky_inventory_items（品目マスタ） ──

create table if not exists public.ky_inventory_items (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.ky_tenants(id) on delete cascade,
  name          text        not null,
  unit          text        not null default '個',
  menu_item_id  uuid        null unique references public.ky_menu_items(id) on delete set null,
  stock_qty     numeric     not null default 0,
  alert_threshold numeric  null,
  is_active     boolean     not null default true,
  sort_order    int         not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ky_inventory_items_tenant_idx
  on public.ky_inventory_items(tenant_id, sort_order);

drop trigger if exists ky_inventory_items_set_updated_at on public.ky_inventory_items;
create trigger ky_inventory_items_set_updated_at
  before update on public.ky_inventory_items
  for each row execute function public.ky_set_updated_at();

alter table public.ky_inventory_items enable row level security;

drop policy if exists ky_inventory_items_owner_all on public.ky_inventory_items;
create policy ky_inventory_items_owner_all on public.ky_inventory_items
  for all using (
    tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid())
  );

-- ── ky_inventory_moves（入出庫台帳・append-only） ──

create table if not exists public.ky_inventory_moves (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.ky_tenants(id) on delete cascade,
  item_id       uuid        not null references public.ky_inventory_items(id) on delete cascade,
  kind          text        not null check (kind in ('in', 'sale', 'adjust', 'out')),
  qty           numeric     not null,
  order_id      uuid        null references public.ky_orders(id) on delete set null,
  memo          text        not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists ky_inventory_moves_item_idx
  on public.ky_inventory_moves(item_id, created_at);

create index if not exists ky_inventory_moves_tenant_idx
  on public.ky_inventory_moves(tenant_id, created_at);

alter table public.ky_inventory_moves enable row level security;

drop policy if exists ky_inventory_moves_owner_all on public.ky_inventory_moves;
create policy ky_inventory_moves_owner_all on public.ky_inventory_moves
  for all using (
    tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid())
  );

-- ── stock_qty 同期更新RPC ──
-- moves 挿入後に stock_qty を更新（RPCで一括＝ドリフト回避）

create or replace function public.ky_record_inventory_move(
  p_tenant_id uuid,
  p_item_id   uuid,
  p_kind      text,
  p_qty       numeric,
  p_order_id  uuid default null,
  p_memo      text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_move_id uuid;
  v_new_stock numeric;
begin
  if p_kind not in ('in', 'sale', 'adjust', 'out') then
    raise exception 'invalid_kind: %', p_kind;
  end if;

  insert into public.ky_inventory_moves (tenant_id, item_id, kind, qty, order_id, memo)
  values (p_tenant_id, p_item_id, p_kind, p_qty, p_order_id, p_memo)
  returning id into v_move_id;

  select coalesce(sum(qty), 0) into v_new_stock
  from public.ky_inventory_moves
  where item_id = p_item_id;

  update public.ky_inventory_items
  set stock_qty = v_new_stock, updated_at = now()
  where id = p_item_id and tenant_id = p_tenant_id;

  return v_move_id;
end;
$$;
