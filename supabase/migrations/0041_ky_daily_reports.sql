-- §49-2 日報＝営業日クローズ
-- 売上/組数/客数/キャスト実績/レジ現金/メモを確定＝日報一覧・CSV・月次レポート連携の土台
-- 2026-07-12 本番適用前に是正（Rev118）: RLSポリシーの ky_tenants.user_id は実在しない列
-- （正: owner_user_id）＝CREATE POLICY が適用時に失敗するバグを修正

create table if not exists public.ky_daily_reports (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        uuid          not null references public.ky_tenants(id) on delete cascade,
  business_date    date          not null,
  total_revenue    numeric       not null default 0,
  order_count      int           not null default 0,
  guest_count      int           not null default 0,
  cast_summary     jsonb         not null default '[]',
  cash_expected    numeric       not null default 0,
  cash_actual      numeric       null,
  cash_diff        numeric       generated always as (cash_actual - cash_expected) stored,
  memo             text          not null default '',
  closed_at        timestamptz   null,
  closed_by        uuid          null references auth.users(id) on delete set null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  constraint ky_daily_reports_tenant_date_uq unique (tenant_id, business_date)
);

create index if not exists ky_daily_reports_tenant_date_idx
  on public.ky_daily_reports(tenant_id, business_date);

drop trigger if exists ky_daily_reports_set_updated_at on public.ky_daily_reports;
create trigger ky_daily_reports_set_updated_at
  before update on public.ky_daily_reports
  for each row execute function public.ky_set_updated_at();

alter table public.ky_daily_reports enable row level security;

drop policy if exists ky_daily_reports_owner_all on public.ky_daily_reports;
create policy ky_daily_reports_owner_all on public.ky_daily_reports
  for all using (
    tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid())
  );
