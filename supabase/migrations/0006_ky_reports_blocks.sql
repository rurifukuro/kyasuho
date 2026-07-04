-- Rev8: UGC 4要件 — 通報テーブル（②）＋ブロックテーブル（③）
-- 非破壊migration（テーブル追加のみ・既存テーブルへの変更なし）

-- ── ky_reports: 通報（②要件・24h以内対応） ──
create table if not exists public.ky_reports (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.ky_tenants(id) on delete cascade,
  reporter_user_id uuid not null,
  target_type text not null check (target_type in ('cast', 'reservation', 'tenant')),
  target_id   uuid not null,
  reason      text not null default '',
  status      text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_ky_reports_tenant on public.ky_reports(tenant_id);
create index if not exists idx_ky_reports_status on public.ky_reports(status) where status = 'pending';

create trigger ky_reports_set_updated_at
  before update on public.ky_reports
  for each row execute function public.ky_set_updated_at();

alter table public.ky_reports enable row level security;

create policy "ky_reports_authenticated_insert"
  on public.ky_reports for insert to authenticated
  with check (reporter_user_id = auth.uid());

create policy "ky_reports_authenticated_select"
  on public.ky_reports for select to authenticated
  using (reporter_user_id = auth.uid());

-- ── ky_blocks: ブロック（③要件） ──
create table if not exists public.ky_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  blocked_user_id uuid not null,
  created_at  timestamptz not null default now(),
  unique(user_id, blocked_user_id)
);

create index if not exists idx_ky_blocks_user on public.ky_blocks(user_id);

alter table public.ky_blocks enable row level security;

create policy "ky_blocks_authenticated_all"
  on public.ky_blocks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
