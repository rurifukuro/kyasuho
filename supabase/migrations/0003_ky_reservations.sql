-- きゃすほ！ Rev5 migration 0003: 予約テーブル・PIN・make_reservation RPC
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   新規テーブル/関数追加のみ＝非破壊。既存 concafe テーブル・関数には触れない。
-- ロールバック: drop function ky_make_reservation cascade; drop function ky_slot_to_minutes cascade; drop table ky_reservation_pins cascade; drop table ky_reservations cascade;

-- ── ky_reservations ──

create table if not exists public.ky_reservations (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.ky_tenants(id) on delete cascade,
  date          date        not null,
  slot          text        not null,   -- 'HH:MM' 予約開始時刻
  set_minutes   int         not null default 60,
  seat_no       int,
  customer_name text        not null,
  contact       text        not null default '',
  party_size    int         not null default 1,
  cast_id       uuid,                   -- FK to ky_casts は後のmigrationで追加
  note          text        not null default '',
  status        text        not null default 'reserved',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (party_size >= 1),
  check (set_minutes >= 10),
  check (status in ('reserved', 'checked_in', 'cancelled', 'no_show'))
);

create index if not exists ky_reservations_tenant_date_idx
  on public.ky_reservations(tenant_id, date);

drop trigger if exists ky_reservations_set_updated_at on public.ky_reservations;
create trigger ky_reservations_set_updated_at
  before update on public.ky_reservations
  for each row execute function public.ky_set_updated_at();

-- ── ky_reservation_pins ──

create table if not exists public.ky_reservation_pins (
  reservation_id uuid primary key references public.ky_reservations(id) on delete cascade,
  pin            text not null,
  created_at     timestamptz not null default now(),
  check (pin ~ '^[0-9]{4}$')
);

alter table public.ky_reservation_pins enable row level security;

drop policy if exists ky_reservation_pins_admin_delete on public.ky_reservation_pins;
create policy ky_reservation_pins_admin_delete on public.ky_reservation_pins
  for delete using (auth.role() = 'authenticated');

-- ── helper: 'HH:MM' → minutes from midnight ──

create or replace function public.ky_slot_to_minutes(slot text)
returns int
language sql immutable
as $$
  select split_part(slot, ':', 1)::int * 60 + split_part(slot, ':', 2)::int;
$$;

-- ── RLS on ky_reservations ──

alter table public.ky_reservations enable row level security;

drop policy if exists ky_reservations_owner_all on public.ky_reservations;
create policy ky_reservations_owner_all on public.ky_reservations
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- anon は RPC(SECURITY DEFINER)経由のみ操作。直SELECTは不要（PINで照合する）

-- ── RPC: ky_make_reservation（マルチテナント・席自動割当・PIN・advisory lock） ──
-- concafe-yoyaku make_reservation を tenant_id 対応＋メニュー削除＋status追加で簡略化。

create or replace function public.ky_make_reservation(
  p_tenant_id     uuid,
  p_date          date,
  p_slot          text,       -- 'HH:MM'
  p_customer_name text,
  p_contact       text    default '',
  p_party_size    int     default 1,
  p_cast_id       uuid    default null,
  p_note          text    default '',
  p_pin           text    default null
) returns json
language plpgsql
security definer
as $$
declare
  v_start_min    int;
  v_set_minutes  int;
  v_end_min      int;
  v_seats        int;
  v_seat_no      int;
  v_reservation_id uuid;
begin
  v_start_min := public.ky_slot_to_minutes(p_slot);

  -- テナント＋日付で同時予約を直列化
  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || p_date::text));

  -- スロットを含む解禁ウィンドウを特定
  select w.seats, w.set_minutes into v_seats, v_set_minutes
  from public.ky_unlock_windows w
  where w.tenant_id = p_tenant_id
    and w.date = p_date
    and public.ky_slot_to_minutes(w.open_from) <= v_start_min
    and (w.close_at is null or public.ky_slot_to_minutes(w.close_at) > v_start_min)
  order by w.seats desc
  limit 1;

  if not found then
    return json_build_object('error', 'not_unlocked');
  end if;

  v_end_min := v_start_min + v_set_minutes;

  -- 空き席を昇順で自動割当（cancelled/no_show は除外して空きとして扱う）
  select s.seat_no into v_seat_no
  from generate_series(1, v_seats) as s(seat_no)
  where not exists (
    select 1 from public.ky_reservations r
    where r.tenant_id = p_tenant_id
      and r.date = p_date
      and r.seat_no = s.seat_no
      and r.status in ('reserved', 'checked_in')
      and public.ky_slot_to_minutes(r.slot) < v_end_min
      and public.ky_slot_to_minutes(r.slot) + r.set_minutes > v_start_min
  )
  order by s.seat_no
  limit 1;

  if v_seat_no is null then
    return json_build_object('error', 'no_available_seat');
  end if;

  insert into public.ky_reservations (
    tenant_id, date, slot, set_minutes, seat_no,
    customer_name, contact, party_size, cast_id, note
  ) values (
    p_tenant_id, p_date, p_slot, v_set_minutes, v_seat_no,
    p_customer_name, p_contact, p_party_size, p_cast_id, p_note
  ) returning id into v_reservation_id;

  -- 4桁PIN（客の予約確認・編集用）
  if p_pin is not null and p_pin ~ '^[0-9]{4}$' then
    insert into public.ky_reservation_pins (reservation_id, pin)
    values (v_reservation_id, p_pin);
  end if;

  return json_build_object('id', v_reservation_id, 'seat_no', v_seat_no);
end;
$$;

grant execute on function public.ky_make_reservation(uuid, date, text, text, text, int, uuid, text, text) to anon;
grant execute on function public.ky_make_reservation(uuid, date, text, text, text, int, uuid, text, text) to authenticated;
