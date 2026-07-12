-- 0045: §34(c) ご注文予定（事前オーダー）
-- ky_reservations.preorder 列追加 + ky_menu_items の anon SELECT + RPC v2 拡張
-- 2026-07-12 §51監査反映（本番適用前に改修＝AUD-1/AUD-2）:
--   AUD-1: anon は列レベルGRANTで公開列のみ（back_rate/back_amount＝バック単価を露出しない・SEC-15）
--          ＋停止テナント除外（0030 S7 と同型）
--   AUD-2: p_preorder はサーバー再解決（価格・名称・カテゴリをマスタから引き直し＝FIN-9）

-- ── ky_reservations.preorder 列（jsonb null） ──
ALTER TABLE public.ky_reservations
  ADD COLUMN IF NOT EXISTS preorder jsonb,
  ADD COLUMN IF NOT EXISTS menu_undecided boolean NOT NULL DEFAULT false;

-- ── ky_menu_items の公開読取り（客Web予約ページ用） ──
DROP POLICY IF EXISTS ky_menu_items_anon_select ON public.ky_menu_items;
CREATE POLICY ky_menu_items_anon_select ON public.ky_menu_items
  FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (SELECT is_suspended FROM public.ky_tenants t WHERE t.id = tenant_id) = false
  );

-- 列レベルGRANT（SEC-15）: バック設定（back_rate/back_amount）と作成日時は anon に見せない。
-- anon 面のクエリは select('*') 不可＝明示列必須（ReservationModal.tsx と対）。
REVOKE SELECT ON public.ky_menu_items FROM anon;
GRANT SELECT (id, tenant_id, category, name, price, needs_cast, sort_order, is_active, nomination_kind)
  ON public.ky_menu_items TO anon;

-- ── ky_make_reservation RPC v2（preorder + menu_undecided 追加） ──
DROP FUNCTION IF EXISTS public.ky_make_reservation(uuid, date, text, text, text, int, uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.ky_make_reservation(
  p_tenant_id      uuid,
  p_date           date,
  p_slot           text,
  p_customer_name  text,
  p_contact        text     default '',
  p_party_size     int      default 1,
  p_cast_id        uuid     default null,
  p_note           text     default '',
  p_pin            text     default null,
  p_seat_type_id   uuid     default null,
  p_preorder       jsonb    default null,
  p_menu_undecided boolean  default false
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
  -- preorder サーバー再解決用（AUD-2）
  v_preorder     jsonb := null;
  v_elem         jsonb;
  v_menu_id      uuid;
  v_qty          int;
  v_pre_cast     uuid;
  v_mi           record;
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

  -- ── §34(c) preorder サーバー再解決（AUD-2 / FIN-9） ──
  -- クライアントの price/name/category は信用せず捨てる。menu_item_id と qty だけ受け取り、
  -- 自テナントの有効メニューをマスタから引き直して保存スナップショットを組み立てる。
  -- （チェックイン時に伝票 ky_order_items へそのまま転記されるため＝金銭転記の源泉）
  if not p_menu_undecided and p_preorder is not null then
    if jsonb_typeof(p_preorder) <> 'array' or jsonb_array_length(p_preorder) > 20 then
      return json_build_object('error', 'bad_request');
    end if;
    v_preorder := '[]'::jsonb;
    for v_elem in select value from jsonb_array_elements(p_preorder) loop
      if jsonb_typeof(v_elem) <> 'object' then
        return json_build_object('error', 'bad_request');
      end if;
      begin
        v_menu_id  := (v_elem->>'menu_item_id')::uuid;
        v_qty      := (v_elem->>'qty')::int;
        v_pre_cast := nullif(v_elem->>'cast_id', '')::uuid;
      exception when others then
        return json_build_object('error', 'bad_request');
      end;
      if v_menu_id is null or v_qty is null or v_qty < 1 or v_qty > 99 then
        return json_build_object('error', 'bad_request');
      end if;
      select mi.id, mi.category, mi.name, mi.price, mi.needs_cast
        into v_mi
        from public.ky_menu_items mi
       where mi.id = v_menu_id
         and mi.tenant_id = p_tenant_id
         and mi.is_active = true;
      if not found then
        return json_build_object('error', 'bad_request');
      end if;
      -- 指名キャストは needs_cast のメニューのみ・自テナント所属のみ（不正値は黙って外す）
      if v_pre_cast is not null then
        if not v_mi.needs_cast or not exists (
          select 1 from public.ky_casts c
          where c.id = v_pre_cast and c.tenant_id = p_tenant_id
        ) then
          v_pre_cast := null;
        end if;
      end if;
      v_preorder := v_preorder || jsonb_build_array(jsonb_build_object(
        'menu_item_id', v_mi.id,
        'category',     v_mi.category,
        'name',         v_mi.name,
        'price',        v_mi.price,
        'qty',          v_qty,
        'cast_id',      v_pre_cast
      ));
    end loop;
    if jsonb_array_length(v_preorder) = 0 then
      v_preorder := null;
    end if;
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
    customer_name, contact, party_size, cast_id, seat_type_id, note,
    preorder, menu_undecided
  ) values (
    p_tenant_id, p_date, p_slot, v_set_minutes, v_seat_no,
    p_customer_name, p_contact, p_party_size, p_cast_id, p_seat_type_id, coalesce(p_note, ''),
    v_preorder, p_menu_undecided
  ) returning id into v_reservation_id;

  if p_pin is not null and p_pin ~ '^[0-9]{4}$' then
    insert into public.ky_reservation_pins (reservation_id, pin)
    values (v_reservation_id, p_pin);
  end if;

  return json_build_object('id', v_reservation_id, 'seat_no', v_seat_no);
end;
$$;

GRANT EXECUTE ON FUNCTION public.ky_make_reservation(uuid, date, text, text, text, int, uuid, text, text, uuid, jsonb, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.ky_make_reservation(uuid, date, text, text, text, int, uuid, text, text, uuid, jsonb, boolean) TO authenticated;
