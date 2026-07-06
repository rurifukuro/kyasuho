-- §29: ky_make_reservation RPC に p_seat_type_id パラメータ追加

-- まず旧シグネチャの関数を削除（CREATE OR REPLACE はシグネチャ変更では使えない）
DROP FUNCTION IF EXISTS public.ky_make_reservation(uuid, date, text, text, text, int, uuid, text, text);

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

  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || p_date::text));

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
    p_customer_name, p_contact, p_party_size, p_cast_id, p_seat_type_id, p_note
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
