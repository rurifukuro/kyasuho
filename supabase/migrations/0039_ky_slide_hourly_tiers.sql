-- きゃすりん Rev96 migration 0039: スライド時給（SPEC §49-4）
--
-- ① ky_payroll_settings に slide_enabled 列追加（既定OFF）
-- ② ky_hourly_rate_tiers テーブル新設（閾値テーブル方式）
--
-- ロールバック:
--   drop table if exists public.ky_hourly_rate_tiers;
--   alter table public.ky_payroll_settings drop column if exists slide_enabled;

-- ── ① slide_enabled ──
alter table public.ky_payroll_settings
  add column if not exists slide_enabled boolean not null default false;

-- ── ② ky_hourly_rate_tiers ──
create table if not exists public.ky_hourly_rate_tiers (
  id           uuid   primary key default gen_random_uuid(),
  tenant_id    uuid   not null references public.ky_tenants(id) on delete cascade,
  metric       text   not null check (metric in ('monthly_sales', 'monthly_nominations')),
  threshold    int    not null check (threshold >= 0),
  hourly_rate  int    not null check (hourly_rate > 0),
  sort_order   int    not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ky_hourly_rate_tiers_tenant_idx
  on public.ky_hourly_rate_tiers(tenant_id, sort_order);

drop trigger if exists ky_hourly_rate_tiers_set_updated_at on public.ky_hourly_rate_tiers;
create trigger ky_hourly_rate_tiers_set_updated_at
  before update on public.ky_hourly_rate_tiers
  for each row execute function public.ky_set_updated_at();

alter table public.ky_hourly_rate_tiers enable row level security;

drop policy if exists ky_hourly_rate_tiers_owner_all on public.ky_hourly_rate_tiers;
create policy ky_hourly_rate_tiers_owner_all on public.ky_hourly_rate_tiers
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));
