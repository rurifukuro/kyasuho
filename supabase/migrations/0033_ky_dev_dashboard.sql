-- Rev82: §37 開発者売上・契約集計ダッシュボード
-- ky_platform_admins（開発者アカウント）+ ky_revenue_events（入金イベント台帳・append-only）
-- + ky_assert_platform_admin() ガード + ky_dev_revenue_monthly() 集計RPC
--
-- 適用先: concafe-yoyaku 本番 ref=rhmuitgbvilqwdevxxox
-- 非破壊: 新規テーブル・関数のみ。既存オブジェクトに触れない。

-- ── ky_platform_admins（開発者登録・SQL Editorのみで行追加＝権限昇格経路を作らない） ──

create table if not exists public.ky_platform_admins (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  note       text        not null default '',
  created_at timestamptz not null default now()
);

alter table public.ky_platform_admins enable row level security;

drop policy if exists ky_platform_admins_self_select on public.ky_platform_admins;
create policy ky_platform_admins_self_select on public.ky_platform_admins
  for select
  to authenticated
  using (user_id = auth.uid());

-- ── ky_revenue_events（開発者売上の入金イベント台帳・append-only） ──

create table if not exists public.ky_revenue_events (
  id                  uuid        primary key default gen_random_uuid(),
  occurred_at         timestamptz not null,
  tenant_id           uuid        not null references public.ky_tenants(id) on delete cascade,
  channel             text        not null
                      check (channel in ('apple_iap','google_play','stripe_card','bank_transfer')),
  event_type          text        not null
                      check (event_type in ('charge','refund','chargeback')),
  product_id          text,
  module_count        int,
  billing_interval    text,
  currency            text        not null default 'jpy',
  amount_gross        int         not null,
  fee_estimate        int         not null default 0,
  amount_net_estimate int         not null default 0,
  is_estimated        boolean     not null default true,
  external_ref        text,
  created_at          timestamptz not null default now(),

  constraint ky_revenue_events_charge_positive
    check (event_type = 'charge' and amount_gross > 0
        or event_type in ('refund','chargeback') and amount_gross < 0),
  constraint ky_revenue_events_channel_ref_unique
    unique (channel, external_ref)
);

create index if not exists ky_revenue_events_tenant_idx
  on public.ky_revenue_events(tenant_id);

create index if not exists ky_revenue_events_occurred_at_idx
  on public.ky_revenue_events(occurred_at);

-- append-only: UPDATE/DELETE を禁止（FIN-2同型・訂正は打消し行で行う）
create or replace function public.ky_revenue_events_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'ky_revenue_events is append-only. Use a compensating row instead.';
end;
$$;

drop trigger if exists ky_revenue_events_no_update on public.ky_revenue_events;
create trigger ky_revenue_events_no_update
  before update on public.ky_revenue_events
  for each row execute function public.ky_revenue_events_immutable();

drop trigger if exists ky_revenue_events_no_delete on public.ky_revenue_events;
create trigger ky_revenue_events_no_delete
  before delete on public.ky_revenue_events
  for each row execute function public.ky_revenue_events_immutable();

-- RLS: service_role のみ（テナントオーナー・キャスト・anonから不可視）
alter table public.ky_revenue_events enable row level security;

-- ── ky_assert_platform_admin() ガード関数 ──

create or replace function public.ky_assert_platform_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ky_platform_admins where user_id = auth.uid()
  ) then
    raise exception 'not_platform_admin';
  end if;
end;
$$;

revoke execute on function public.ky_assert_platform_admin() from public;
revoke execute on function public.ky_assert_platform_admin() from anon;
grant execute on function public.ky_assert_platform_admin() to authenticated;
grant execute on function public.ky_assert_platform_admin() to service_role;

-- ── ky_dev_revenue_monthly(p_from, p_to) 集計RPC ──

create or replace function public.ky_dev_revenue_monthly(
  p_from date,
  p_to   date
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  perform public.ky_assert_platform_admin();

  select coalesce(json_agg(row_to_json(r)), '[]'::json) into v_result
  from (
    select
      date_trunc('month', occurred_at)::date as month,
      channel,
      sum(amount_gross) as gross,
      sum(fee_estimate) as fee,
      sum(amount_net_estimate) as net,
      bool_or(is_estimated) as has_estimated
    from public.ky_revenue_events
    where occurred_at >= p_from
      and occurred_at < (p_to + interval '1 day')
    group by date_trunc('month', occurred_at), channel
    order by month, channel
  ) r;

  return v_result;
end;
$$;

revoke execute on function public.ky_dev_revenue_monthly(date, date) from public;
revoke execute on function public.ky_dev_revenue_monthly(date, date) from anon;
grant execute on function public.ky_dev_revenue_monthly(date, date) to authenticated;
grant execute on function public.ky_dev_revenue_monthly(date, date) to service_role;

-- ── ky_dev_kpis() 基本KPI（課金テーブル未実装のため最小版） ──

create or replace function public.ky_dev_kpis()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_tenants int;
  v_revenue_30d int;
  v_result json;
begin
  perform public.ky_assert_platform_admin();

  select count(*) into v_total_tenants from public.ky_tenants;

  select coalesce(sum(amount_gross), 0) into v_revenue_30d
  from public.ky_revenue_events
  where occurred_at >= (now() - interval '30 days')
    and event_type = 'charge';

  v_result := json_build_object(
    'total_tenants', v_total_tenants,
    'revenue_30d', v_revenue_30d,
    'active_subscriptions', 0,
    'trialing', 0,
    'mrr_estimate', 0,
    'churn_30d', 0
  );

  return v_result;
end;
$$;

revoke execute on function public.ky_dev_kpis() from public;
revoke execute on function public.ky_dev_kpis() from anon;
grant execute on function public.ky_dev_kpis() to authenticated;
grant execute on function public.ky_dev_kpis() to service_role;
