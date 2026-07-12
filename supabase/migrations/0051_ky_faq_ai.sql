-- 0051_ky_faq_ai.sql — §46 Q&A AIアシスタントの基盤（ログ＋レート制限）
--
-- Edge Function `ky-faq-ai` が service_role で呼ぶ専用テーブル＋RPC。
-- ・ky_faq_logs: 質問/回答/使用層の記録（品質監視用）。INSERTはEdge Function（service_role）のみ。
--   ownerは自テナント分のみSELECT可（品質確認用途）。cast/customerは閲覧不可。
-- ・ky_faq_usage + reserve_ky_faq_slot: user_id毎 日次利用カウント（SEC-5同型・0010 ky_ai_usageと同パターン）。
--   '__global__' センチネル行で全体日次上限（コスト暴走サーキットブレーカー・レビューD対応）も同時に返す。
--
-- 非破壊（新規テーブル＋新規関数のみ）。既存 concafe / ky_* テーブルには非干渉。

-- ① Q&Aログ
create table if not exists public.ky_faq_logs (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        references public.ky_tenants(id) on delete cascade,  -- customer等テナント未確定はNULL
  user_id     uuid        not null,
  role        text        not null check (role in ('owner', 'cast', 'customer')),
  question    text        not null,
  answer      text        not null,
  layer_used  text        not null check (layer_used in ('faq', 'sonnet', 'web', 'refused')),
  created_at  timestamptz not null default now()
);

create index if not exists ky_faq_logs_tenant_created_idx
  on public.ky_faq_logs (tenant_id, created_at desc);

alter table public.ky_faq_logs enable row level security;
revoke all on table public.ky_faq_logs from anon, authenticated, public;

-- ownerは自テナントのログのみ閲覧可（品質監視用）。INSERT/UPDATE/DELETEポリシーは作らない
-- （書き込みはEdge Function＝service_roleのみ。service_roleはRLSバイパス）。
grant select on table public.ky_faq_logs to authenticated;
create policy ky_faq_logs_owner_select on public.ky_faq_logs
  for select using (
    tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid())
  );

-- ② 日次利用カウント（user_id単位＋全体センチネル）
create table if not exists public.ky_faq_usage (
  user_key   text        not null,  -- auth.users.id::text ／ 全体行は '__global__'
  usage_date date        not null,
  count      integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_key, usage_date)
);

alter table public.ky_faq_usage enable row level security;
revoke all on table public.ky_faq_usage from anon, authenticated, public;

-- 予約方式（先に +1 してから返す）: 同時リクエストでも上限を突き破らない
create or replace function public.reserve_ky_faq_slot(p_user_id uuid)
returns table (per_user integer, global integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user integer;
  v_global integer;
begin
  insert into public.ky_faq_usage as u (user_key, usage_date, count, updated_at)
  values (p_user_id::text, current_date, 1, now())
  on conflict (user_key, usage_date)
  do update set count = u.count + 1, updated_at = now()
  returning u.count into v_user;

  insert into public.ky_faq_usage as u (user_key, usage_date, count, updated_at)
  values ('__global__', current_date, 1, now())
  on conflict (user_key, usage_date)
  do update set count = u.count + 1, updated_at = now()
  returning u.count into v_global;

  return query select v_user, v_global;
end;
$$;

-- revoke from public は service_role の実行権も暗黙に落とすため、明示 GRANT が必須
-- （42501 対策・supabase_edge_function_rpc_grant の教訓）
revoke all on function public.reserve_ky_faq_slot(uuid) from anon, authenticated, public;
grant execute on function public.reserve_ky_faq_slot(uuid) to service_role;
