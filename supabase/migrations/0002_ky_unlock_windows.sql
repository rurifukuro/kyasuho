-- きゃすほ！ Rev4 migration 0002: 受付解禁ウィンドウ（受付設定の基盤）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   新規テーブル追加のみ＝非破壊。既存 concafe テーブル・関数には触れない。
-- ロールバック: drop table public.ky_unlock_windows cascade;

create table if not exists public.ky_unlock_windows (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.ky_tenants(id) on delete cascade,
  date         date        not null,
  open_from    text        not null,   -- 'HH:MM' 形式
  close_at     text,                    -- 自動〆切時刻 'HH:MM' or null
  seats        int         not null default 3,
  set_minutes  int         not null default 60,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (seats >= 1),
  check (set_minutes >= 10)
);

create index if not exists ky_unlock_windows_tenant_date_idx
  on public.ky_unlock_windows(tenant_id, date);

-- updated_at 自動更新（ky_set_updated_at は 0001 で作成済み）
drop trigger if exists ky_unlock_windows_set_updated_at on public.ky_unlock_windows;
create trigger ky_unlock_windows_set_updated_at
  before update on public.ky_unlock_windows
  for each row execute function public.ky_set_updated_at();

-- RLS
alter table public.ky_unlock_windows enable row level security;

-- 提供者: 自テナントのみ全操作
drop policy if exists ky_unlock_windows_owner_all on public.ky_unlock_windows;
create policy ky_unlock_windows_owner_all on public.ky_unlock_windows
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- 客Web(anon): 未停止テナントの解禁ウィンドウを公開SELECT
drop policy if exists ky_unlock_windows_public_read on public.ky_unlock_windows;
create policy ky_unlock_windows_public_read on public.ky_unlock_windows
  for select
  to anon
  using ((select is_suspended from public.ky_tenants t where t.id = tenant_id) = false);
