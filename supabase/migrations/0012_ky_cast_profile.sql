-- きゃすりん T17+T18 migration 0012: キャスト人物像・遍歴＋個人情報
--
-- T17: オーナーがキャストの人物像・評価を記入 + 店舗遍歴（移籍時に新オーナーが参考にできる）
-- T18: キャスト本人が面接書類代替の個人情報を入力
--
-- 適用先: concafe-yoyaku ref=rhmuitgbvilqwdevxxox（非破壊・新規テーブルのみ）
-- ロールバック: drop table ky_cast_personal_info cascade; drop table ky_cast_work_history cascade; drop table ky_cast_evaluations cascade;

-- ── T17: ky_cast_evaluations（オーナーが記入するキャスト人物像・評価） ──

create table if not exists public.ky_cast_evaluations (
  id                        uuid        primary key default gen_random_uuid(),
  tenant_id                 uuid        not null references public.ky_tenants(id) on delete cascade,
  cast_id                   uuid        not null references public.ky_casts(id) on delete cascade,
  persona_notes             text        not null default '',
  strengths                 text        not null default '',
  areas_for_improvement     text        not null default '',
  customer_feedback_summary text        not null default '',
  internal_notes            text        not null default '',
  updated_at                timestamptz not null default now(),
  created_at                timestamptz not null default now(),
  unique (tenant_id, cast_id)
);

create index if not exists ky_cast_evaluations_cast_idx
  on public.ky_cast_evaluations(cast_id);

alter table public.ky_cast_evaluations enable row level security;

drop policy if exists ky_cast_evaluations_owner_all on public.ky_cast_evaluations;
create policy ky_cast_evaluations_owner_all on public.ky_cast_evaluations
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

drop policy if exists ky_cast_evaluations_cast_read on public.ky_cast_evaluations;
create policy ky_cast_evaluations_cast_read on public.ky_cast_evaluations
  for select
  to authenticated
  using (
    cast_id in (select id from public.ky_casts where user_id = auth.uid())
  );

-- ── T17: ky_cast_work_history（店舗遍歴・テナント横断・移籍引き継ぎ） ──

create table if not exists public.ky_cast_work_history (
  id              uuid        primary key default gen_random_uuid(),
  cast_user_id    uuid        not null references auth.users on delete cascade,
  tenant_name     text        not null default '',
  position        text        not null default '',
  start_date      date,
  end_date        date,
  notes           text        not null default '',
  visibility      text        not null default 'public' check (visibility in ('public', 'private')),
  created_by      uuid        references auth.users on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists ky_cast_work_history_user_idx
  on public.ky_cast_work_history(cast_user_id);

alter table public.ky_cast_work_history enable row level security;

drop policy if exists ky_cast_work_history_self_all on public.ky_cast_work_history;
create policy ky_cast_work_history_self_all on public.ky_cast_work_history
  for all
  to authenticated
  using      (cast_user_id = auth.uid())
  with check (cast_user_id = auth.uid());

drop policy if exists ky_cast_work_history_owner_read on public.ky_cast_work_history;
create policy ky_cast_work_history_owner_read on public.ky_cast_work_history
  for select
  to authenticated
  using (
    visibility = 'public'
    and cast_user_id in (
      select c.user_id from public.ky_casts c
      join public.ky_tenants t on c.tenant_id = t.id
      where t.owner_user_id = auth.uid()
        and c.user_id is not null
    )
  );

-- ── T18: ky_cast_personal_info（面接書類代替・キャスト本人入力） ──

create table if not exists public.ky_cast_personal_info (
  id                          uuid        primary key default gen_random_uuid(),
  cast_user_id                uuid        not null unique references auth.users on delete cascade,
  full_name                   text        not null default '',
  furigana                    text        not null default '',
  date_of_birth               date,
  gender                      text        not null default '',
  address                     text        not null default '',
  phone                       text        not null default '',
  email                       text        not null default '',
  emergency_contact_name      text        not null default '',
  emergency_contact_phone     text        not null default '',
  emergency_contact_relation  text        not null default '',
  nearest_station             text        not null default '',
  commute_method              text        not null default '',
  commute_minutes             int,
  bank_name                   text        not null default '',
  bank_branch                 text        not null default '',
  account_type                text        not null default '' check (account_type in ('', 'savings', 'checking')),
  account_number              text        not null default '',
  account_holder_name         text        not null default '',
  desired_work_days_per_week  int,
  desired_hours               text        not null default '',
  available_from              date,
  qualifications              text        not null default '',
  special_notes               text        not null default '',
  updated_at                  timestamptz not null default now(),
  created_at                  timestamptz not null default now()
);

alter table public.ky_cast_personal_info enable row level security;

drop policy if exists ky_cast_personal_info_self_all on public.ky_cast_personal_info;
create policy ky_cast_personal_info_self_all on public.ky_cast_personal_info
  for all
  to authenticated
  using      (cast_user_id = auth.uid())
  with check (cast_user_id = auth.uid());

drop policy if exists ky_cast_personal_info_owner_read on public.ky_cast_personal_info;
create policy ky_cast_personal_info_owner_read on public.ky_cast_personal_info
  for select
  to authenticated
  using (
    cast_user_id in (
      select c.user_id from public.ky_casts c
      join public.ky_tenants t on c.tenant_id = t.id
      where t.owner_user_id = auth.uid()
        and c.user_id is not null
    )
  );
