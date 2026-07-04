-- きゃすほ！ Rev6 migration 0004: キャスト＋出勤枠テーブル＋ky_reservations.cast_id FK追加
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   新規テーブル/列追加のみ＝非破壊。既存 concafe テーブル・関数には触れない。
-- ロールバック: alter table ky_reservations drop constraint if exists ky_reservations_cast_id_fk; drop table ky_shifts cascade; drop table ky_casts cascade;

-- ── ky_casts ──

create table if not exists public.ky_casts (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           uuid        not null references public.ky_tenants(id) on delete cascade,
  name                text        not null,
  photo_url           text,
  sns_links           jsonb       not null default '[]'::jsonb,
  bio                 text        not null default '',
  accepts_nomination  boolean     not null default true,
  sort_order          int         not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists ky_casts_tenant_idx
  on public.ky_casts(tenant_id);

drop trigger if exists ky_casts_set_updated_at on public.ky_casts;
create trigger ky_casts_set_updated_at
  before update on public.ky_casts
  for each row execute function public.ky_set_updated_at();

-- ── RLS on ky_casts ──

alter table public.ky_casts enable row level security;

drop policy if exists ky_casts_owner_all on public.ky_casts;
create policy ky_casts_owner_all on public.ky_casts
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

drop policy if exists ky_casts_public_read on public.ky_casts;
create policy ky_casts_public_read on public.ky_casts
  for select
  to anon
  using ((select is_suspended from public.ky_tenants t where t.id = tenant_id) = false);

-- ── ky_shifts（出勤枠） ──

create table if not exists public.ky_shifts (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.ky_tenants(id) on delete cascade,
  cast_id     uuid        not null references public.ky_casts(id) on delete cascade,
  date        date        not null,
  start_at    text        not null,  -- 'HH:MM'
  end_at      text        not null,  -- 'HH:MM'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ky_shifts_tenant_date_idx
  on public.ky_shifts(tenant_id, date);

create index if not exists ky_shifts_cast_date_idx
  on public.ky_shifts(cast_id, date);

drop trigger if exists ky_shifts_set_updated_at on public.ky_shifts;
create trigger ky_shifts_set_updated_at
  before update on public.ky_shifts
  for each row execute function public.ky_set_updated_at();

-- ── RLS on ky_shifts ──

alter table public.ky_shifts enable row level security;

drop policy if exists ky_shifts_owner_all on public.ky_shifts;
create policy ky_shifts_owner_all on public.ky_shifts
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

drop policy if exists ky_shifts_public_read on public.ky_shifts;
create policy ky_shifts_public_read on public.ky_shifts
  for select
  to anon
  using ((select is_suspended from public.ky_tenants t where t.id = tenant_id) = false);

-- ── ky_reservations.cast_id に FK 追加（0003 で保留していた分） ──

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'ky_reservations_cast_id_fk'
      and table_name = 'ky_reservations'
  ) then
    alter table public.ky_reservations
      add constraint ky_reservations_cast_id_fk
      foreign key (cast_id) references public.ky_casts(id) on delete set null;
  end if;
end $$;
