-- きゃすりん Rev14 migration 0009: 売上・給与・勤怠・シフト表テンプレ＋tenants.plan（SPEC §3-F/H/I・§10・§14）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   新規テーブル/列追加のみ＝非破壊。既存 concafe テーブル・関数には触れない。
-- ロールバック:
--   drop table ky_shift_templates; drop table ky_payroll_settings; drop table ky_cast_payroll;
--   drop table ky_sales; drop table ky_attendance;
--   alter table ky_tenants drop column if exists plan;

-- ── ky_tenants.plan（三面共通エンティトルメント源泉・§14） ──

alter table public.ky_tenants
  add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro'));

-- ── ky_attendance（勤怠記録・§3-H／§23） ──

create table if not exists public.ky_attendance (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           uuid        not null references public.ky_tenants(id) on delete cascade,
  cast_id             uuid        not null references public.ky_casts(id) on delete cascade,
  date                date        not null,
  status              text        not null default 'present'
                      check (status in ('present', 'late', 'early_leave', 'absent', 'substitute')),
  reason_category     text        not null default ''
                      check (reason_category in ('', 'sick', 'personal', 'no_show', 'other')),
  reason_note         text        not null default '',
  substitute_cast_id  uuid        references public.ky_casts(id) on delete set null,
  check_in_at         text,       -- 'HH:MM'（実入店・NULL=未入力）
  check_out_at        text,       -- 'HH:MM'（実退店・NULL=未入力）
  note                text        not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (cast_id, date)
);

create index if not exists ky_attendance_tenant_date_idx
  on public.ky_attendance(tenant_id, date);

drop trigger if exists ky_attendance_set_updated_at on public.ky_attendance;
create trigger ky_attendance_set_updated_at
  before update on public.ky_attendance
  for each row execute function public.ky_set_updated_at();

alter table public.ky_attendance enable row level security;

drop policy if exists ky_attendance_owner_all on public.ky_attendance;
create policy ky_attendance_owner_all on public.ky_attendance
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── ky_sales（日別売上・§3-F／§23） ──

create table if not exists public.ky_sales (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null references public.ky_tenants(id) on delete cascade,
  date              date        not null,
  total_revenue     int         not null default 0,  -- 円
  set_count         int         not null default 0,
  drink_count       int         not null default 0,
  nomination_count  int         not null default 0,
  other_revenue     int         not null default 0,  -- 円
  note              text        not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, date)
);

create index if not exists ky_sales_tenant_date_idx
  on public.ky_sales(tenant_id, date);

drop trigger if exists ky_sales_set_updated_at on public.ky_sales;
create trigger ky_sales_set_updated_at
  before update on public.ky_sales
  for each row execute function public.ky_set_updated_at();

alter table public.ky_sales enable row level security;

drop policy if exists ky_sales_owner_all on public.ky_sales;
create policy ky_sales_owner_all on public.ky_sales
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── ky_cast_payroll（キャスト日別給与・§3-F／§23） ──
-- hours_worked は分単位の実勤務時間（時間×60・小数回避）。金額列は円。

create table if not exists public.ky_cast_payroll (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references public.ky_tenants(id) on delete cascade,
  cast_id          uuid        not null references public.ky_casts(id) on delete cascade,
  date             date        not null,
  minutes_worked   int         not null default 0,  -- 分単位（§23: 分単位・丸めなし）
  base_pay         int         not null default 0,
  nomination_count int         not null default 0,
  nomination_back  int         not null default 0,
  drink_count      int         not null default 0,
  drink_back       int         not null default 0,
  other_back       int         not null default 0,
  deductions       int         not null default 0,
  total_pay        int         not null default 0,
  note             text        not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (cast_id, date)
);

create index if not exists ky_cast_payroll_tenant_date_idx
  on public.ky_cast_payroll(tenant_id, date);

drop trigger if exists ky_cast_payroll_set_updated_at on public.ky_cast_payroll;
create trigger ky_cast_payroll_set_updated_at
  before update on public.ky_cast_payroll
  for each row execute function public.ky_set_updated_at();

alter table public.ky_cast_payroll enable row level security;

drop policy if exists ky_cast_payroll_owner_all on public.ky_cast_payroll;
create policy ky_cast_payroll_owner_all on public.ky_cast_payroll
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── ky_payroll_settings（給与計算設定・店一律・§23） ──

create table if not exists public.ky_payroll_settings (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             uuid        not null references public.ky_tenants(id) on delete cascade,
  base_hourly_rate      int         not null default 1200,  -- 円/時
  nomination_back_rate  int         not null default 300,   -- 円/件
  drink_back_rate       int         not null default 100,   -- 円/杯
  late_deduction        int         not null default 0,     -- 円/回（遅刻控除）
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id)
);

drop trigger if exists ky_payroll_settings_set_updated_at on public.ky_payroll_settings;
create trigger ky_payroll_settings_set_updated_at
  before update on public.ky_payroll_settings
  for each row execute function public.ky_set_updated_at();

alter table public.ky_payroll_settings enable row level security;

drop policy if exists ky_payroll_settings_owner_all on public.ky_payroll_settings;
create policy ky_payroll_settings_owner_all on public.ky_payroll_settings
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── ky_shift_templates（シフト表テンプレ設定＝お気に入り/カスタム保存・§3-I／§22） ──

create table if not exists public.ky_shift_templates (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references public.ky_tenants(id) on delete cascade,
  name             text        not null,
  template_key     text        not null,  -- 定義ID（'elegant-rose' 等・AI生成は 'ai-<uuid>'）
  custom_settings  jsonb       not null default '{}'::jsonb,  -- palette/motif等の上書き（§22）
  logo_url         text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists ky_shift_templates_tenant_idx
  on public.ky_shift_templates(tenant_id);

drop trigger if exists ky_shift_templates_set_updated_at on public.ky_shift_templates;
create trigger ky_shift_templates_set_updated_at
  before update on public.ky_shift_templates
  for each row execute function public.ky_set_updated_at();

alter table public.ky_shift_templates enable row level security;

drop policy if exists ky_shift_templates_owner_all on public.ky_shift_templates;
create policy ky_shift_templates_owner_all on public.ky_shift_templates
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));
