-- きゃすりん Rev118 migration 0047: チェックイン／会計後続処理のRPC化（§51監査 AUD-3 / AUD-4）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--
-- 背景:
--   AUD-3: 管理Webの checkinReservation / revertCheckin が「status更新→伝票INSERT→明細INSERT」等を
--          クライアントから逐次実行＝途中失敗で「checked_inなのに伝票なし」等の不整合が起きえた。
--   AUD-4: closeOrder の後続（売上集計 ky_sales / 在庫減算 / スタンプ）がクライアント逐次実行＝
--          会計確定後の通信断で集計・在庫・スタンプが無音欠落し、リトライ導線がなかった。
--   → 3つとも SECURITY DEFINER RPC の1トランザクションへ集約（BE-4）。
--
-- 設計メモ:
--   ・preorder→明細の転記は「予約時スナップショット」を尊重（Rev113原則＝価格変更耐性）。
--     0045（Rev117）で preorder はRPC内サーバー再解決＝サーバー著者値のため、ここでの再解決は
--     繰り返さず、型・範囲の防御的検証のみ行う。不正要素は転記スキップ（チェックイン自体は成立）。
--   ・スタンプ／来店実績は read-modify-write をやめ atomic increment（BE-5・AUD-5のうち顧客系を前倒し）。
--   ・last_visit_date は Asia/Tokyo の日付（旧クライアント実装のUTC日付から是正）。
--
-- ロールバック:
--   DROP FUNCTION public.ky_checkin_reservation(uuid, uuid);
--   DROP FUNCTION public.ky_revert_checkin(uuid, uuid);
--   ky_close_order は 0035 版に戻す（本ファイル末尾の関数を 0035 の定義で再CREATE）。

-- ================================================================
-- 1. ky_checkin_reservation: 来店チェックイン（1トランザクション）
--    status更新＋伝票作成＋preorder明細転記＋二重チェックイン防止
-- ================================================================

create or replace function public.ky_checkin_reservation(
  p_reservation_id uuid,
  p_tenant_id      uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner    uuid;
  v_r        record;
  v_existing uuid;
  v_order_id uuid;
  v_elem     jsonb;
  v_menu_id  uuid;
  v_qty      int;
  v_price    int;
  v_cast     uuid;
begin
  select owner_user_id into v_owner from public.ky_tenants where id = p_tenant_id;
  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select id, date, seat_no, customer_name, status, preorder
    into v_r
    from public.ky_reservations
   where id = p_reservation_id and tenant_id = p_tenant_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  -- cancelled / no_show からの直接チェックインは不可（UIも出さないが防御）
  if v_r.status not in ('reserved', 'checked_in') then
    return jsonb_build_object('ok', false, 'error', 'not_checkinable');
  end if;

  update public.ky_reservations set status = 'checked_in' where id = p_reservation_id;

  -- 二重チェックイン防止: 既存open伝票があればそれを再利用（明細は再投入しない）
  select id into v_existing
    from public.ky_orders
   where reservation_id = p_reservation_id
     and tenant_id = p_tenant_id
     and status = 'open'
   limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'order_id', v_existing, 'reused', true);
  end if;

  insert into public.ky_orders (tenant_id, biz_date, seat_no, reservation_id, customer_label, status)
  values (p_tenant_id, v_r.date, v_r.seat_no, p_reservation_id, v_r.customer_name, 'open')
  returning id into v_order_id;

  -- preorder → 明細転記（スナップショット値を採用・型/範囲のみ防御検証）
  if v_r.preorder is not null and jsonb_typeof(v_r.preorder) = 'array' then
    for v_elem in select value from jsonb_array_elements(v_r.preorder) loop
      if jsonb_typeof(v_elem) <> 'object' then
        continue;
      end if;
      begin
        v_menu_id := (v_elem->>'menu_item_id')::uuid;
        v_qty     := (v_elem->>'qty')::int;
        v_price   := (v_elem->>'price')::int;
        v_cast    := nullif(v_elem->>'cast_id', '')::uuid;
      exception when others then
        continue;  -- 型不正の要素は転記スキップ（チェックイン自体は成立させる）
      end;
      if v_menu_id is null or v_qty is null or v_qty < 1 or v_qty > 99
         or v_price is null or v_price < 0 then
        continue;
      end if;
      -- 予約後にメニューが削除されていたら FK違反回避のため menu_item_id=null で転記
      -- （名前・価格はスナップショットが持っているので明細としては成立する）
      if not exists (select 1 from public.ky_menu_items mi where mi.id = v_menu_id) then
        v_menu_id := null;
      end if;
      -- キャストが離脱済みなら cast_id=null で転記（FK違反回避）
      if v_cast is not null and not exists (
        select 1 from public.ky_casts c where c.id = v_cast and c.tenant_id = p_tenant_id
      ) then
        v_cast := null;
      end if;
      insert into public.ky_order_items (order_id, tenant_id, menu_item_id, category, name, price, qty, cast_id)
      values (
        v_order_id, p_tenant_id, v_menu_id,
        coalesce(v_elem->>'category', 'other'),
        coalesce(v_elem->>'name', ''),
        v_price, v_qty, v_cast
      );
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'order_id', v_order_id, 'reused', false);
end $$;

grant execute on function public.ky_checkin_reservation(uuid, uuid) to authenticated;

-- ================================================================
-- 2. ky_revert_checkin: 来店取消（1トランザクション）
--    status復帰＋紐付きopen伝票のvoid。closed伝票（会計済み）は触らない
-- ================================================================

create or replace function public.ky_revert_checkin(
  p_reservation_id uuid,
  p_tenant_id      uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_status text;
  v_voided int;
  v_closed int;
begin
  select owner_user_id into v_owner from public.ky_tenants where id = p_tenant_id;
  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select status into v_status
    from public.ky_reservations
   where id = p_reservation_id and tenant_id = p_tenant_id
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.ky_reservations set status = 'reserved' where id = p_reservation_id;

  update public.ky_orders set status = 'void'
   where reservation_id = p_reservation_id
     and tenant_id = p_tenant_id
     and status = 'open';
  get diagnostics v_voided = row_count;

  select count(*) into v_closed
    from public.ky_orders
   where reservation_id = p_reservation_id
     and tenant_id = p_tenant_id
     and status = 'closed';

  return jsonb_build_object('ok', true, 'voided_count', v_voided, 'closed_count', v_closed);
end $$;

grant execute on function public.ky_revert_checkin(uuid, uuid) to authenticated;

-- ================================================================
-- 3. ky_close_order v3: 会計確定＋後続処理を同一トランザクションへ（AUD-4）
--    （シグネチャ不変＝CREATE OR REPLACE。0035版に §25-4売上集計・§47在庫減算・
--     §31スタンプを追加。返却jsonbに biz_date / stamp を追加）
-- ================================================================

create or replace function public.ky_close_order(
  p_order_id       uuid,
  p_tenant_id      uuid,
  p_deposit        int,
  p_change         int,
  p_payment_method text,
  p_note           text default '',
  p_customer_id    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal     int;
  v_owner_id     uuid;
  v_order_status text;
  v_default_back numeric(5,2);
  v_biz_date     date;
  v_entry_mode   text;
  v_inv          record;
  v_ss           record;
  v_new_stamp    int;
  v_reward       boolean;
  v_stamp        jsonb := null;
  v_jst_today    date := (now() at time zone 'Asia/Tokyo')::date;
begin
  select owner_user_id into v_owner_id
    from public.ky_tenants where id = p_tenant_id;
  if v_owner_id is null or v_owner_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select status, biz_date into v_order_status, v_biz_date
    from public.ky_orders
    where id = p_order_id and tenant_id = p_tenant_id;
  if v_order_status is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_order_status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;

  if p_deposit < 0 or p_change < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if p_payment_method not in ('cash', 'card', 'qr', 'other') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_method');
  end if;

  -- FIN-3: サーバー側で subtotal を再計算
  select coalesce(sum(price * qty), 0) into v_subtotal
    from public.ky_order_items
    where order_id = p_order_id;

  -- §39: back_each を解決して書き込む（cast_id 付き明細のみ）
  select coalesce(ps.default_back_rate, 0) into v_default_back
    from public.ky_payroll_settings ps
    where ps.tenant_id = p_tenant_id;
  if v_default_back is null then
    v_default_back := 0;
  end if;

  -- 優先順位: 1.固定額 → 2.メニュー割合% → 3.基本割合%(nomination除外)
  update public.ky_order_items oi set back_each =
    case
      when mi.back_amount is not null then mi.back_amount
      when mi.back_rate is not null then floor(oi.price * mi.back_rate / 100)
      when mi.category <> 'nomination' and v_default_back > 0
        then floor(oi.price * v_default_back / 100)
      else null
    end
  from public.ky_menu_items mi
  where oi.order_id = p_order_id
    and oi.cast_id is not null
    and oi.menu_item_id = mi.id;

  -- 伝票を確定
  update public.ky_orders set
    status         = 'closed',
    closed_at      = now(),
    subtotal       = v_subtotal,
    deposit        = p_deposit,
    change         = p_change,
    payment_method = p_payment_method,
    note           = p_note,
    customer_id    = p_customer_id
  where id = p_order_id;

  -- ── §25-4: 売上自動集計（AUD-4・旧クライアント autoUpsertSales と同一集計仕様） ──
  -- manual入力がある日は上書きしない
  select entry_mode into v_entry_mode
    from public.ky_sales
   where tenant_id = p_tenant_id and date = v_biz_date;
  if v_entry_mode is distinct from 'manual' then
    insert into public.ky_sales
      (tenant_id, date, total_revenue, set_count, drink_count, nomination_count, other_revenue, entry_mode)
    select
      p_tenant_id, v_biz_date,
      coalesce(sum(oi.price * oi.qty), 0),
      coalesce(sum(oi.qty) filter (where oi.category in ('set', 'extension')), 0),
      coalesce(sum(oi.qty) filter (where oi.category in ('drink', 'cast_drink')), 0),
      coalesce(sum(oi.qty) filter (where oi.category = 'nomination'), 0),
      coalesce(sum(oi.price * oi.qty) filter (where oi.category not in
        ('set', 'extension', 'drink', 'cast_drink', 'nomination', 'discount')), 0),
      'auto'
    from public.ky_order_items oi
    join public.ky_orders o on o.id = oi.order_id
    where o.tenant_id = p_tenant_id
      and o.biz_date = v_biz_date
      and o.status = 'closed'
    on conflict (tenant_id, date) do update set
      total_revenue    = excluded.total_revenue,
      set_count        = excluded.set_count,
      drink_count      = excluded.drink_count,
      nomination_count = excluded.nomination_count,
      other_revenue    = excluded.other_revenue,
      entry_mode       = 'auto';
  end if;

  -- ── §47: 在庫自動sale減算（AUD-4・DB明細から算出＝クライアントstate非依存） ──
  for v_inv in
    select ii.id as item_id, sum(oi.qty) as total_qty
      from public.ky_order_items oi
      join public.ky_inventory_items ii
        on ii.menu_item_id = oi.menu_item_id
       and ii.tenant_id = p_tenant_id
       and ii.is_active = true
     where oi.order_id = p_order_id
       and oi.menu_item_id is not null
     group by ii.id
  loop
    perform public.ky_record_inventory_move(
      p_tenant_id, v_inv.item_id, 'sale', -v_inv.total_qty, p_order_id, '');
  end loop;

  -- ── §31: スタンプ／来店実績（atomic increment＝BE-5。JST日付） ──
  if p_customer_id is not null then
    select stamps_per_visit, reward_threshold, reward_description, is_active
      into v_ss
      from public.ky_stamp_settings
     where tenant_id = p_tenant_id;
    if found and v_ss.is_active then
      update public.ky_customers
         set stamp_count     = stamp_count + v_ss.stamps_per_visit,
             total_visits    = total_visits + 1,
             last_visit_date = v_jst_today
       where id = p_customer_id and tenant_id = p_tenant_id
       returning stamp_count into v_new_stamp;
      if v_new_stamp is not null then
        v_reward := v_ss.reward_threshold > 0
          and (v_new_stamp - v_ss.stamps_per_visit) < v_ss.reward_threshold
          and v_new_stamp >= v_ss.reward_threshold;
        v_stamp := jsonb_build_object(
          'new_stamp_count',    v_new_stamp,
          'added',              v_ss.stamps_per_visit,
          'reward_reached',     v_reward,
          'reward_description', v_ss.reward_description
        );
      end if;
    else
      -- スタンプ設定なし/OFFでも来店実績は刻む（旧クライアント実装と同じ）
      update public.ky_customers
         set total_visits    = total_visits + 1,
             last_visit_date = v_jst_today
       where id = p_customer_id and tenant_id = p_tenant_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'subtotal', v_subtotal, 'biz_date', v_biz_date, 'stamp', v_stamp);
end $$;
