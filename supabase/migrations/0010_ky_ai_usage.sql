-- 0010_ky_ai_usage.sql — AIシフトデザイン生成の日次利用カウント（SPEC §22・レート制限）
--
-- Edge Function `ky-shift-design` が service_role で呼ぶ専用テーブル＋RPC。
-- デイポス daipos_usage / reserve_daipos_slot と同型（実証済みパターン）。
-- キーは ky_tenants.id（uuid）を text 化して保持。全体合計は '__global__' センチネル行。
-- p_tenant_id を uuid 型で受けるため、センチネル文字列の偽装衝突は型レベルで不可能。
--
-- 非破壊（新規テーブル＋新規関数のみ）。既存 concafe / ky_* テーブルには非干渉。

create table if not exists public.ky_ai_usage (
  tenant_key text not null,
  usage_date date not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_key, usage_date)
);

-- RLS 有効＋ポリシーなし＝anon / authenticated からは一切見えない（service_role 専用）
alter table public.ky_ai_usage enable row level security;
revoke all on table public.ky_ai_usage from anon, authenticated, public;

-- 予約方式（先に +1 してから返す）: 同時リクエストでも上限を突き破らない
create or replace function public.reserve_ky_ai_slot(p_tenant_id uuid)
returns table (per_tenant integer, global integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant integer;
  v_global integer;
begin
  insert into public.ky_ai_usage as u (tenant_key, usage_date, count, updated_at)
  values (p_tenant_id::text, current_date, 1, now())
  on conflict (tenant_key, usage_date)
  do update set count = u.count + 1, updated_at = now()
  returning u.count into v_tenant;

  insert into public.ky_ai_usage as u (tenant_key, usage_date, count, updated_at)
  values ('__global__', current_date, 1, now())
  on conflict (tenant_key, usage_date)
  do update set count = u.count + 1, updated_at = now()
  returning u.count into v_global;

  return query select v_tenant, v_global;
end;
$$;

-- revoke from public は service_role の実行権も暗黙に落とすため、明示 GRANT が必須
-- （42501 対策・supabase_edge_function_rpc_grant の教訓）
revoke all on function public.reserve_ky_ai_slot(uuid) from anon, authenticated, public;
grant execute on function public.reserve_ky_ai_slot(uuid) to service_role;
