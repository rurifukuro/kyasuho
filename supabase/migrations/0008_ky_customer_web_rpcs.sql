-- きゃすりん Rev12 migration 0008: 客Web向け anon アクセス＋PIN検証/予約キャンセルRPC
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   ポリシー/関数追加のみ＝非破壊。
-- ロールバック: drop policy if exists ky_reservations_public_read on ky_reservations;
--   drop function ky_verify_reservation_pin(uuid, text);
--   drop function ky_cancel_reservation(uuid, text);

-- ── anon SELECT on ky_reservations（客Webカレンダーの空き状況計算用） ──
-- active(reserved/checked_in)かつ未停止テナントの予約のみ。
-- 客WebのUIは空き席数のみ表示（名前は表示しない）。
drop policy if exists ky_reservations_public_read on public.ky_reservations;
create policy ky_reservations_public_read on public.ky_reservations
  for select
  to anon
  using (
    status in ('reserved', 'checked_in')
    and (select is_suspended from public.ky_tenants t where t.id = tenant_id) = false
  );

-- ── RPC: ky_verify_reservation_pin ──
-- 予約のPIN照合。PIN未設定→no_pin、不一致→mismatch、一致→ok。
create or replace function public.ky_verify_reservation_pin(
  p_reservation_id uuid,
  p_pin            text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_stored text;
begin
  select pin into v_stored
  from ky_reservation_pins
  where reservation_id = p_reservation_id;

  if not found then
    return json_build_object('ok', false, 'reason', 'no_pin');
  end if;

  if v_stored <> p_pin then
    return json_build_object('ok', false, 'reason', 'mismatch');
  end if;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.ky_verify_reservation_pin(uuid, text) to anon;
grant execute on function public.ky_verify_reservation_pin(uuid, text) to authenticated;

-- ── RPC: ky_cancel_reservation ──
-- PIN照合後にステータスを cancelled に変更。
create or replace function public.ky_cancel_reservation(
  p_reservation_id uuid,
  p_pin            text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_stored text;
  v_status text;
begin
  select pin into v_stored
  from ky_reservation_pins
  where reservation_id = p_reservation_id;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_stored <> p_pin then
    return json_build_object('ok', false, 'error', 'pin_mismatch');
  end if;

  select status into v_status
  from ky_reservations
  where id = p_reservation_id;

  if v_status is null then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_status <> 'reserved' then
    return json_build_object('ok', false, 'error', 'not_cancellable');
  end if;

  update ky_reservations
  set status = 'cancelled', updated_at = now()
  where id = p_reservation_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.ky_cancel_reservation(uuid, text) to anon;
grant execute on function public.ky_cancel_reservation(uuid, text) to authenticated;
