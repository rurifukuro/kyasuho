-- 0023: ky_events — 店舗イベントカレンダー（§19-㉞）
-- 生誕祭以外の店イベント告知。管理側 CRUD + 客側 Web 表示

create table if not exists public.ky_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.ky_tenants(id) on delete cascade,
  title       text not null,
  description text not null default '',
  event_date  date not null,
  start_time  time,
  end_time    time,
  event_type  text not null default 'other',
  is_public   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ky_events_tenant_date on public.ky_events(tenant_id, event_date);

-- RLS
alter table public.ky_events enable row level security;

create policy "ky_events_owner_all" on public.ky_events
  for all using (
    tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid())
  );

create policy "ky_events_anon_read" on public.ky_events
  for select using (is_public = true);
