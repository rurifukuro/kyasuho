-- Rev83: §38 キャストシフト提出リマインダー — DB基盤
-- ky_shift_requests（シフト希望枠）＋ky_shift_submissions（提出宣言）
-- ＋ky_cast_shift_defaults（基本出勤時間）＋ky_shift_reminder_settings（リマインダー設定）
-- ＋ky_notification_log（通知送信記録・冪等キー）
--
-- 適用先: concafe-yoyaku 本番 ref=rhmuitgbvilqwdevxxox
-- 非破壊: 新規テーブルのみ。既存オブジェクトに触れない。

-- ── ky_shift_requests（シフト希望枠・キャストが提出しオーナーが承認/却下） ──

create table if not exists public.ky_shift_requests (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.ky_tenants(id) on delete cascade,
  cast_id     uuid        not null references public.ky_casts(id) on delete cascade,
  date        date        not null,
  start_at    text        not null,
  end_at      text        not null,
  note        text        not null default '',
  time_source text        not null default 'default'
              check (time_source in ('default','custom')),
  status      text        not null default 'requested'
              check (status in ('requested','approved','rejected')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ky_shift_requests_tenant_cast_idx
  on public.ky_shift_requests(tenant_id, cast_id);

create index if not exists ky_shift_requests_tenant_date_idx
  on public.ky_shift_requests(tenant_id, date);

drop trigger if exists ky_shift_requests_set_updated_at on public.ky_shift_requests;
create trigger ky_shift_requests_set_updated_at
  before update on public.ky_shift_requests
  for each row execute function public.ky_set_updated_at();

alter table public.ky_shift_requests enable row level security;

-- キャスト本人: 自分の行をSELECT/INSERT（DELETE=再提出用）
drop policy if exists ky_shift_requests_cast_select on public.ky_shift_requests;
create policy ky_shift_requests_cast_select on public.ky_shift_requests
  for select
  to authenticated
  using (
    cast_id in (select id from public.ky_casts where user_id = auth.uid())
    or tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid())
  );

drop policy if exists ky_shift_requests_cast_insert on public.ky_shift_requests;
create policy ky_shift_requests_cast_insert on public.ky_shift_requests
  for insert
  to authenticated
  with check (
    cast_id in (select id from public.ky_casts where user_id = auth.uid())
  );

drop policy if exists ky_shift_requests_cast_delete on public.ky_shift_requests;
create policy ky_shift_requests_cast_delete on public.ky_shift_requests
  for delete
  to authenticated
  using (
    cast_id in (select id from public.ky_casts where user_id = auth.uid())
    and status = 'requested'
  );

-- オーナー: 自テナント全行のstatusをUPDATE（承認/却下）
drop policy if exists ky_shift_requests_owner_update on public.ky_shift_requests;
create policy ky_shift_requests_owner_update on public.ky_shift_requests
  for update
  to authenticated
  using (tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── ky_shift_submissions（提出宣言・キャスト×期間で1行） ──

create table if not exists public.ky_shift_submissions (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.ky_tenants(id) on delete cascade,
  cast_id       uuid        not null references public.ky_casts(id) on delete cascade,
  period_start  date        not null,
  period_end    date        not null,
  submitted_at  timestamptz not null default now(),

  constraint ky_shift_submissions_unique
    unique (tenant_id, cast_id, period_start)
);

create index if not exists ky_shift_submissions_tenant_idx
  on public.ky_shift_submissions(tenant_id);

alter table public.ky_shift_submissions enable row level security;

-- キャスト本人: 自分の行をSELECT/INSERT/UPDATE（再提出=submitted_at更新）
drop policy if exists ky_shift_submissions_cast_select on public.ky_shift_submissions;
create policy ky_shift_submissions_cast_select on public.ky_shift_submissions
  for select
  to authenticated
  using (
    cast_id in (select id from public.ky_casts where user_id = auth.uid())
    or tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid())
  );

drop policy if exists ky_shift_submissions_cast_insert on public.ky_shift_submissions;
create policy ky_shift_submissions_cast_insert on public.ky_shift_submissions
  for insert
  to authenticated
  with check (
    cast_id in (select id from public.ky_casts where user_id = auth.uid())
  );

drop policy if exists ky_shift_submissions_cast_update on public.ky_shift_submissions;
create policy ky_shift_submissions_cast_update on public.ky_shift_submissions
  for update
  to authenticated
  using (cast_id in (select id from public.ky_casts where user_id = auth.uid()))
  with check (cast_id in (select id from public.ky_casts where user_id = auth.uid()));

-- ── ky_cast_shift_defaults（キャスト本人の基本出勤時間） ──

create table if not exists public.ky_cast_shift_defaults (
  tenant_id  uuid  not null references public.ky_tenants(id) on delete cascade,
  cast_id    uuid  not null references public.ky_casts(id) on delete cascade,
  start_at   text  not null,
  end_at     text  not null,
  updated_at timestamptz not null default now(),

  primary key (tenant_id, cast_id)
);

drop trigger if exists ky_cast_shift_defaults_set_updated_at on public.ky_cast_shift_defaults;
create trigger ky_cast_shift_defaults_set_updated_at
  before update on public.ky_cast_shift_defaults
  for each row execute function public.ky_set_updated_at();

alter table public.ky_cast_shift_defaults enable row level security;

-- キャスト本人: 自分の行のSELECT/INSERT/UPDATE
drop policy if exists ky_cast_shift_defaults_cast_all on public.ky_cast_shift_defaults;
create policy ky_cast_shift_defaults_cast_all on public.ky_cast_shift_defaults
  for all
  to authenticated
  using (
    cast_id in (select id from public.ky_casts where user_id = auth.uid())
    or tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid())
  )
  with check (
    cast_id in (select id from public.ky_casts where user_id = auth.uid())
  );

-- ── ky_shift_reminder_settings（リマインダー設定・テナント単位1行） ──

create table if not exists public.ky_shift_reminder_settings (
  tenant_id          uuid    primary key references public.ky_tenants(id) on delete cascade,
  enabled            boolean not null default false,
  period_type        text    not null default 'monthly'
                     check (period_type in ('monthly')),
  deadline_day       int     not null default 20
                     check (deadline_day >= 1 and deadline_day <= 28),
  remind_days_before int     not null default 3
                     check (remind_days_before >= 0 and remind_days_before <= 27),
  repeat_daily       boolean not null default false,
  remind_hour        int     not null default 12
                     check (remind_hour >= 0 and remind_hour <= 23),
  updated_at         timestamptz not null default now()
);

drop trigger if exists ky_shift_reminder_settings_set_updated_at on public.ky_shift_reminder_settings;
create trigger ky_shift_reminder_settings_set_updated_at
  before update on public.ky_shift_reminder_settings
  for each row execute function public.ky_set_updated_at();

alter table public.ky_shift_reminder_settings enable row level security;

drop policy if exists ky_shift_reminder_settings_owner_all on public.ky_shift_reminder_settings;
create policy ky_shift_reminder_settings_owner_all on public.ky_shift_reminder_settings
  for all
  to authenticated
  using      (tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── ky_notification_log（通知送信記録・冪等キー付き） ──

create table if not exists public.ky_notification_log (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.ky_tenants(id) on delete cascade,
  cast_id       uuid        not null references public.ky_casts(id) on delete cascade,
  kind          text        not null
                check (kind in ('shift_reminder','shift_reminder_manual')),
  period_start  date        not null,
  remind_date   date        not null,
  sent_at       timestamptz not null default now(),
  status        text        not null default 'sent'
                check (status in ('sent','no_token','error')),
  error         text,

  constraint ky_notification_log_dedup
    unique (tenant_id, cast_id, kind, period_start, remind_date)
);

create index if not exists ky_notification_log_tenant_idx
  on public.ky_notification_log(tenant_id);

alter table public.ky_notification_log enable row level security;

-- オーナー: 自テナントの送信記録をSELECT
drop policy if exists ky_notification_log_owner_select on public.ky_notification_log;
create policy ky_notification_log_owner_select on public.ky_notification_log
  for select
  to authenticated
  using (tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid()));
