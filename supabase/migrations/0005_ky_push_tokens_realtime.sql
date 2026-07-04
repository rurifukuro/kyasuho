-- きゃすほ！ Rev7 migration 0005: プッシュトークン＋Realtime有効化
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   新規テーブル追加＋既存テーブルのRealtime有効化のみ＝非破壊。
-- ロールバック: alter publication supabase_realtime drop table public.ky_reservations; drop table ky_push_tokens cascade;

-- ── ky_push_tokens（Expo Push Token 保存） ──

create table if not exists public.ky_push_tokens (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.ky_tenants(id) on delete cascade,
  user_id     uuid        not null,
  token       text        not null,
  platform    text        not null default 'ios',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists ky_push_tokens_user_token_idx
  on public.ky_push_tokens(user_id, token);

drop trigger if exists ky_push_tokens_set_updated_at on public.ky_push_tokens;
create trigger ky_push_tokens_set_updated_at
  before update on public.ky_push_tokens
  for each row execute function public.ky_set_updated_at();

-- ── RLS ──

alter table public.ky_push_tokens enable row level security;

drop policy if exists ky_push_tokens_owner_all on public.ky_push_tokens;
create policy ky_push_tokens_owner_all on public.ky_push_tokens
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Realtime有効化（ky_reservations を Realtime で購読可能にする） ──
-- 提供者アプリが新規予約をリアルタイム検知し、ローカル通知を表示する
-- ※supabase_realtime publication が存在しない場合はダッシュボードから有効化する

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ky_reservations;
  end if;
end $$;
