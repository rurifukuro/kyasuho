-- §35-2: 指名キャストのサーバー側検証
-- 0030 S8（入力検証・停止テナント・他テナント参照防止）の上に
-- p_cast_id 非null時: ①テナント所属+指名受付ON ②当日シフトがスロット全体を覆う を追加
-- 違反時は error: 'cast_not_available' を返す

DROP FUNCTION IF EXISTS public.ky_make_reservation(uuid, date, text, text, text, int, uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.ky_make_reservation(
  p_tenant_id     uuid,
  p_date          date,
  p_slot          text,
  p_customer_name text,
  p_contact       text    default '',
  p_party_size    int     default 1,
  p_cast_id       uuid    default null,
  p_note          text    default '',
  p_pin           text    default null,
  p_seat_type_id  uuid    default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start_min    int;
  v_set_minutes  int;
  v_end_min      int;
  v_seats        int;
  v_seat_no      int;
  v_reservation_id uuid;
  v_suspended    boolean;
begin
  -- ── 入力検証（S8） ──
  if p_slot is null or p_slot !~ '^[0-9]{1,2}:[0-9]{2}$' then
    return json_build_object('error', 'bad_request');
  end if;
  p_customer_name := trim(coalesce(p_customer_name, ''));
  if p_customer_name = '' or length(p_customer_name) > 100 then
    return json_build_object('error', 'bad_request');
  end if;
  p_contact := trim(coalesce(p_contact, ''));
  if length(p_contact) > 200 or length(coalesce(p_note, '')) > 1000 then
    return json_build_object('error', 'bad_request');
  end if;
  if p_party_size is null or p_party_size < 1 or p_party_size > 99 then
    return json_build_object('error', 'bad_request');
  end if;

  -- 停止テナントは受付不可
  select is_suspended into v_suspended from public.ky_tenants where id = p_tenant_id;
  if not found or v_suspended then
    return json_build_object('error', 'not_unlocked');
  end if;

  -- §35-2: キャスト検証（テナント所属＋指名受付ON）
  if p_cast_id is not null and not exists (
    select 1 from public.ky_casts c
    where c.id = p_cast_id and c.tenant_id = p_tenant_id and c.accepts_nomination = true
  ) then
    return json_build_object('error', 'cast_not_available');
  end if;

  -- seat_type は同一テナント所属のみ許可（S8）
  if p_seat_type_id is not null and not exists (
    select 1 from public.ky_seat_types st
    where st.id = p_seat_type_id and st.tenant_id = p_tenant_id and st.is_active = true
  ) then
    return json_build_object('error', 'bad_request');
  end if;

  v_start_min := public.ky_slot_to_minutes(p_slot);

  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || p_date::text));

  select w.set_minutes into v_set_minutes
  from public.ky_unlock_windows w
  where w.tenant_id = p_tenant_id
    and w.date = p_date
    and public.ky_slot_to_minutes(w.open_from) <= v_start_min
    and (w.close_at is null or public.ky_slot_to_minutes(w.close_at) > v_start_min)
  limit 1;

  if not found then
    return json_build_object('error', 'not_unlocked');
  end if;

  v_end_min := v_start_min + v_set_minutes;

  -- §35-2: シフトカバレッジ検証（出勤がスロット全体を覆うか）
  if p_cast_id is not null then
    if not exists (
      select 1 from public.ky_shifts s
      where s.cast_id = p_cast_id
        and s.tenant_id = p_tenant_id
        and s.date = p_date
        and public.ky_slot_to_minutes(s.start_at) <= v_start_min
        and public.ky_slot_to_minutes(s.end_at) >= v_end_min
    ) then
      return json_build_object('error', 'cast_not_available');
    end if;
  end if;

  -- 同一連絡先の重複チェック（contact が空でない場合のみ・0028踏襲）
  if p_contact <> '' then
    if exists (
      select 1 from public.ky_reservations r
      where r.tenant_id = p_tenant_id
        and r.date = p_date
        and r.contact = p_contact
        and r.status in ('reserved', 'checked_in')
        and public.ky_slot_to_minutes(r.slot) < v_end_min
        and public.ky_slot_to_minutes(r.slot) + r.set_minutes > v_start_min
    ) then
      return json_build_object('error', 'duplicate_contact');
    end if;
  end if;

  -- 席数は有効な席種の capacity 合計から取得（0025踏襲）
  select coalesce(sum(capacity), 0) into v_seats
  from public.ky_seat_types
  where tenant_id = p_tenant_id
    and is_active = true;

  if v_seats < 1 then
    return json_build_object('error', 'no_seat_types');
  end if;

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
    customer_name, contact, party_size, cast_id, seat_type_id, note
  ) values (
    p_tenant_id, p_date, p_slot, v_set_minutes, v_seat_no,
    p_customer_name, p_contact, p_party_size, p_cast_id, p_seat_type_id, coalesce(p_note, '')
  ) returning id into v_reservation_id;

  if p_pin is not null and p_pin ~ '^[0-9]{4}$' then
    insert into public.ky_reservation_pins (reservation_id, pin)
    values (v_reservation_id, p_pin);
  end if;

  return json_build_object('id', v_reservation_id, 'seat_no', v_seat_no);
end;
$$;

GRANT EXECUTE ON FUNCTION public.ky_make_reservation(uuid, date, text, text, text, int, uuid, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.ky_make_reservation(uuid, date, text, text, text, int, uuid, text, text, uuid) TO authenticated;
