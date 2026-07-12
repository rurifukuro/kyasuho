-- 0049_ky_menu_remote_price.sql
-- §53: 遠隔価格欄の追加＋お品書きOCR月次使用量テーブル

-- ① メニューに遠隔価格列を追加（NULL＝遠隔対応なし）
alter table public.ky_menu_items
  add column if not exists remote_price int default null;

comment on column public.ky_menu_items.remote_price is '遠隔接客時の価格（円）。NULLの場合は遠隔対応なし。';

-- ② お品書きOCR読取り月次使用量（月20回制限）
create table if not exists public.ky_menu_ocr_usage (
  id          uuid    primary key default gen_random_uuid(),
  tenant_id   uuid    not null references public.ky_tenants(id) on delete cascade,
  year_month  text    not null,  -- 'YYYY-MM'
  usage_count int     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint ky_menu_ocr_usage_tenant_month unique (tenant_id, year_month)
);

alter table public.ky_menu_ocr_usage enable row level security;

create policy ky_menu_ocr_usage_owner_all on public.ky_menu_ocr_usage
  for all using (
    tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid())
  );

-- ③ OCR使用量をatomicにインクリメントするRPC（service_role専用）
create or replace function public.ky_menu_ocr_increment(
  p_tenant_id uuid,
  p_year_month text,
  p_limit int default 20
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into ky_menu_ocr_usage (tenant_id, year_month, usage_count)
  values (p_tenant_id, p_year_month, 1)
  on conflict (tenant_id, year_month)
  do update set usage_count = ky_menu_ocr_usage.usage_count + 1, updated_at = now()
  returning usage_count into v_count;

  if v_count > p_limit then
    raise exception 'limit_exceeded: monthly OCR limit reached';
  end if;
end;
$$;

revoke execute on function public.ky_menu_ocr_increment(uuid, text, int) from public;
revoke execute on function public.ky_menu_ocr_increment(uuid, text, int) from anon;
grant execute on function public.ky_menu_ocr_increment(uuid, text, int) to service_role;
