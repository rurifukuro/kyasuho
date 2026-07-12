-- きゃすりん Rev131 migration 0052: 批判的検証（2026-07-12）監査是正パック
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
-- ★本番適用はユーザー承認ゲート（未適用のローカルドラフト）。全修正は非破壊＝
--   スキーマの列削除・データ削除なし。CREATE OR REPLACE と policy 再作成のみ。
--
-- 対象（docs/CRITICAL_REVIEW_2026-07-12.md の KA 番号に対応）:
--   KA-1 [Critical] 0040 ky_record_inventory_move: SECURITY DEFINER なのに
--        auth.uid() 照合なし・revoke/grant なし＝任意の authenticated ユーザーが
--        他店の在庫を改変可能だった。owner照合＋item-tenant一致＋qty検証＋権限整理。
--   KA-5 [Medium]  0038 ky_cast_punch: 「v_existing is not null」は PL/pgSQL の
--        record 比較＝全列 non-null のときだけ真（check_out_at が null の通常時は偽）
--        → already_punched_in ガードが一度も発火しない。列単位の null 判定へ修正。
--   KA-7 [Low]     0015 ky_seat_types_anon_read: is_suspended（運営停止テナント）
--        フィルタ欠落 → 停止店舗の席種が客Webから見え続ける。フィルタ追加。
--   KA-8 [Low]     0035/0047 ky_close_order の back_each UPDATE: ky_menu_items との
--        JOIN に mi.tenant_id 条件がない → 他テナントのメニューを指す明細が
--        混入した場合に他店のバック率が適用される。JOIN 条件へ tenant 一致を追加。
--        （0047 v3 が最新定義のため v3 全体を再CREATE。変更は JOIN 1行のみ）
--   KA-9 [Low]     0043 ky_menu_items.nomination_kind: CHECK 制約なし →
--        'honshimei'|'jounai'|null 以外が入り得る。既存不正値の無害化＋CHECK追加。
--
-- ロールバック:
--   ky_record_inventory_move / ky_cast_punch / ky_close_order は各元migration
--   （0040 / 0038 / 0047）の定義で再CREATE。
--   drop policy ky_seat_types_anon_read → 0015 の定義で再作成。
--   alter table ky_menu_items drop constraint ky_menu_items_nomination_kind_check;

-- ================================================================
-- KA-1: ky_record_inventory_move v2（owner照合＋整合性検証＋権限整理）
-- ================================================================

create or replace function public.ky_record_inventory_move(
  p_tenant_id uuid,
  p_item_id   uuid,
  p_kind      text,
  p_qty       numeric,
  p_order_id  uuid default null,
  p_memo      text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_move_id uuid;
  v_new_stock numeric;
  v_owner uuid;
begin
  -- SECURITY DEFINER は RLS 非適用＝関数内での権限照合が必須（SEC/KA-1）
  select owner_user_id into v_owner
  from public.ky_tenants where id = p_tenant_id;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'forbidden';
  end if;

  if p_kind not in ('in', 'sale', 'adjust', 'out') then
    raise exception 'invalid_kind: %', p_kind;
  end if;

  -- qty 検証（0 や null の無意味な move を拒否）
  if p_qty is null or p_qty = 0 then
    raise exception 'invalid_qty';
  end if;

  -- item-tenant 一致検証（他店の在庫品目 id を指せない）
  if not exists (
    select 1 from public.ky_inventory_items ii
    where ii.id = p_item_id and ii.tenant_id = p_tenant_id
  ) then
    raise exception 'item_not_found';
  end if;

  insert into public.ky_inventory_moves (tenant_id, item_id, kind, qty, order_id, memo)
  values (p_tenant_id, p_item_id, p_kind, p_qty, p_order_id, p_memo)
  returning id into v_move_id;

  select coalesce(sum(qty), 0) into v_new_stock
  from public.ky_inventory_moves
  where item_id = p_item_id and tenant_id = p_tenant_id;

  update public.ky_inventory_items
  set stock_qty = v_new_stock, updated_at = now()
  where id = p_item_id and tenant_id = p_tenant_id;

  return v_move_id;
end;
$$;

-- 権限整理（0040 は revoke/grant を一切しておらず public 実行可能だった）
revoke all on function public.ky_record_inventory_move(uuid, uuid, text, numeric, uuid, text) from public;
revoke all on function public.ky_record_inventory_move(uuid, uuid, text, numeric, uuid, text) from anon;
grant execute on function public.ky_record_inventory_move(uuid, uuid, text, numeric, uuid, text) to authenticated;
-- ky_close_order（SECURITY DEFINER）からの perform 呼び出しは auth.uid()=オーナー
-- のまま実行されるため owner 照合を通過する（回帰なし）。

-- ================================================================
-- KA-5: ky_cast_punch v2（record IS NOT NULL 罠の是正）
--   PL/pgSQL では「record is not null」＝全列 non-null 判定。SELECT INTO が
--   行を見つけなくても record の列参照は null を返すため、列単位で判定する。
-- ================================================================

create or replace function public.ky_cast_punch(p_direction text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cast_id uuid;
  v_tenant_id uuid;
  v_today date;
  v_now text;
  v_existing record;
  v_result jsonb;
begin
  if p_direction not in ('in', 'out') then
    raise exception 'invalid_direction: must be "in" or "out"';
  end if;

  select c.id, c.tenant_id into v_cast_id, v_tenant_id
  from public.ky_casts c
  where c.user_id = auth.uid();

  if v_cast_id is null then
    raise exception 'cast_not_found';
  end if;

  v_today := (now() at time zone 'Asia/Tokyo')::date;
  v_now   := to_char(now() at time zone 'Asia/Tokyo', 'HH24:MI');

  select * into v_existing
  from public.ky_attendance
  where cast_id = v_cast_id and date = v_today;

  if p_direction = 'in' then
    -- KA-5: 列単位の null 判定（行なし時も v_existing.check_in_at は null）
    if v_existing.check_in_at is not null then
      raise exception 'already_punched_in';
    end if;

    insert into public.ky_attendance
      (tenant_id, cast_id, date, status, check_in_at, edited_by_owner)
    values
      (v_tenant_id, v_cast_id, v_today, 'present', v_now, false)
    on conflict (cast_id, date)
    do update set
      check_in_at = v_now,
      edited_by_owner = false,
      updated_at = now();

  else -- 'out'
    if v_existing.check_in_at is null then
      raise exception 'not_punched_in';
    end if;
    if v_existing.check_out_at is not null then
      raise exception 'already_punched_out';
    end if;

    update public.ky_attendance
    set check_out_at = v_now,
        edited_by_owner = false,
        updated_at = now()
    where cast_id = v_cast_id and date = v_today;
  end if;

  select jsonb_build_object(
    'date', a.date,
    'check_in_at', a.check_in_at,
    'check_out_at', a.check_out_at,
    'status', a.status
  ) into v_result
  from public.ky_attendance a
  where a.cast_id = v_cast_id and a.date = v_today;

  return v_result;
end;
$$;

-- 権限は 0038 で revoke public ＋ grant authenticated 済み（CREATE OR REPLACE で維持される）。
-- 念のため anon を明示 revoke。
revoke all on function public.ky_cast_punch(text) from anon;

-- ================================================================
-- KA-7: ky_seat_types_anon_read に is_suspended フィルタ追加
--   （anon の ky_tenants 列GRANTは 0046 で id / is_suspended 許可済み＝SEC-15 充足）
-- ================================================================

drop policy if exists ky_seat_types_anon_read on public.ky_seat_types;
create policy ky_seat_types_anon_read on public.ky_seat_types
  for select to anon
  using (
    is_active = true
    and (select is_suspended from public.ky_tenants t where t.id = tenant_id) = false
  );

-- ================================================================
-- KA-8: ky_close_order v4（back_each JOIN に mi.tenant_id 一致を追加）
--   0047 v3 の全文コピー＋変更は back_each UPDATE の JOIN 条件 1 行のみ。
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
    and oi.menu_item_id = mi.id
    and mi.tenant_id = p_tenant_id;  -- KA-8: 他テナントメニュー参照の遮断

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

-- 権限整理（SECURITY DEFINER チェックリスト: revoke public/anon ＋ grant authenticated）
revoke all on function public.ky_close_order(uuid, uuid, int, int, text, text, uuid) from public;
revoke all on function public.ky_close_order(uuid, uuid, int, int, text, text, uuid) from anon;
grant execute on function public.ky_close_order(uuid, uuid, int, int, text, text, uuid) to authenticated;
revoke all on function public.ky_checkin_reservation(uuid, uuid) from public;
revoke all on function public.ky_checkin_reservation(uuid, uuid) from anon;
revoke all on function public.ky_revert_checkin(uuid, uuid) from public;
revoke all on function public.ky_revert_checkin(uuid, uuid) from anon;

-- ================================================================
-- KA-9: nomination_kind に CHECK 制約（既存不正値の無害化つき・冪等）
-- ================================================================

update public.ky_menu_items
   set nomination_kind = null
 where nomination_kind is not null
   and nomination_kind not in ('honshimei', 'jounai');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ky_menu_items_nomination_kind_check'
      and conrelid = 'public.ky_menu_items'::regclass
  ) then
    alter table public.ky_menu_items
      add constraint ky_menu_items_nomination_kind_check
      check (nomination_kind is null or nomination_kind in ('honshimei', 'jounai'));
  end if;
end $$;
