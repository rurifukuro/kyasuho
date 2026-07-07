-- 0024: ボトルキープ＋回数券・チェキ券（§19-㊲）
-- 店舗側でオンオフできる機能

-- 機能フラグ
alter table public.ky_tenants
  add column if not exists enable_bottle_keep boolean not null default false,
  add column if not exists enable_vouchers    boolean not null default false;

-- ボトルキープ
create table if not exists public.ky_bottle_keeps (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.ky_tenants(id) on delete cascade,
  customer_name text not null,
  item_name     text not null,
  start_date    date not null default current_date,
  expiry_date   date,
  remaining     text not null default '',
  note          text not null default '',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ky_bottle_keeps_tenant on public.ky_bottle_keeps(tenant_id);

alter table public.ky_bottle_keeps enable row level security;

create policy "ky_bottle_keeps_owner_all" on public.ky_bottle_keeps
  for all using (
    tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid())
  );

-- 回数券・チェキ券
create table if not exists public.ky_vouchers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.ky_tenants(id) on delete cascade,
  voucher_type    text not null default 'ticket',
  name            text not null,
  customer_name   text not null,
  total_count     int not null default 1,
  remaining_count int not null default 1,
  expiry_date     date,
  note            text not null default '',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ky_vouchers_tenant on public.ky_vouchers(tenant_id);

alter table public.ky_vouchers enable row level security;

create policy "ky_vouchers_owner_all" on public.ky_vouchers
  for all using (
    tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid())
  );
