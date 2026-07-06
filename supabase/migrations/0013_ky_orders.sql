-- きゃすりん Rev31 migration 0013: オーダー管理DB（SPEC §25-2・§19の⑱）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   新規テーブル追加＋既存 ky_sales に列追加＝非破壊。既存 concafe テーブル・関数には触れない。
-- ロールバック:
--   drop table ky_order_items; drop table ky_orders; drop table ky_menu_items;
--   alter table ky_sales drop column if exists entry_mode;

-- ── ky_menu_items（メニューマスタ・§25-2） ──

create table if not exists public.ky_menu_items (
  id          uuid    primary key default gen_random_uuid(),
  tenant_id   uuid    not null references public.ky_tenants(id) on delete cascade,
  category    text    not null
              check (category in ('set','extension','nomination','cast_drink','drink','food','cheki','other','discount')),
  name        text    not null,
  price       int     not null,  -- 円（discount は負）
  needs_cast  boolean not null default false,
  sort_order  int     not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ky_menu_items_tenant_idx
  on public.ky_menu_items(tenant_id);

drop trigger if exists ky_menu_items_set_updated_at on public.ky_menu_items;
create trigger ky_menu_items_set_updated_at
  before update on public.ky_menu_items
  for each row execute function public.ky_set_updated_at();

alter table public.ky_menu_items enable row level security;

drop policy if exists ky_menu_items_owner_all on public.ky_menu_items;
create policy ky_menu_items_owner_all on public.ky_menu_items
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── ky_orders（伝票・§25-2） ──

create table if not exists public.ky_orders (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.ky_tenants(id) on delete cascade,
  biz_date        date        not null,
  seat_no         int,
  reservation_id  uuid        references public.ky_reservations(id) on delete set null,
  customer_label  text        not null default '',
  status          text        not null default 'open'
                  check (status in ('open','closed','void')),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  subtotal        int         not null default 0,
  deposit         int         not null default 0,
  change          int         not null default 0,
  payment_method  text        not null default 'cash'
                  check (payment_method in ('cash','card','qr','other')),
  note            text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ky_orders_tenant_biz_date_idx
  on public.ky_orders(tenant_id, biz_date);

create index if not exists ky_orders_tenant_status_idx
  on public.ky_orders(tenant_id, status);

drop trigger if exists ky_orders_set_updated_at on public.ky_orders;
create trigger ky_orders_set_updated_at
  before update on public.ky_orders
  for each row execute function public.ky_set_updated_at();

alter table public.ky_orders enable row level security;

drop policy if exists ky_orders_owner_all on public.ky_orders;
create policy ky_orders_owner_all on public.ky_orders
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── ky_order_items（オーダー明細・§25-2） ──

create table if not exists public.ky_order_items (
  id            uuid        primary key default gen_random_uuid(),
  order_id      uuid        not null references public.ky_orders(id) on delete cascade,
  tenant_id     uuid        not null references public.ky_tenants(id) on delete cascade,
  menu_item_id  uuid        references public.ky_menu_items(id) on delete set null,
  category      text        not null,
  name          text        not null,
  price         int         not null,  -- スナップショット（discount は負）
  qty           int         not null default 1,
  cast_id       uuid        references public.ky_casts(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists ky_order_items_order_idx
  on public.ky_order_items(order_id);

create index if not exists ky_order_items_tenant_idx
  on public.ky_order_items(tenant_id);

alter table public.ky_order_items enable row level security;

drop policy if exists ky_order_items_owner_all on public.ky_order_items;
create policy ky_order_items_owner_all on public.ky_order_items
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── ky_sales.entry_mode（§25-4・二重計上防止） ──

alter table public.ky_sales
  add column if not exists entry_mode text not null default 'manual'
  check (entry_mode in ('manual','auto'));
