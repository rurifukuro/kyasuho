-- きゃすりん migration 0053: §45 お客様モード基盤＋§41(b) ポイント台帳（設計ドラフト・2026-07-12）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
-- ★本番適用はユーザー承認ゲート。§45実装Revと同時適用が本線だが、**早期適用しても無害**な設計:
--   ・新テーブルは空のまま（アプリ側 features ゲートで機能未露出＝トークン発行経路がない）
--   ・既存テーブルへの追加列は全て null 可 or 現行挙動と同値の既定値
--     （ky_order_items.status default 'confirmed' ＝ 既存レジ明細は全て confirmed 扱い）
--   ・全文冪等（IF NOT EXISTS / CREATE OR REPLACE / DO ブロック）
--
-- 依存: 0052（ky_close_order v4）適用済みであること。本ファイルの ky_close_order v5 は
--       v4 に status='confirmed' フィルタ＋トークン失効＋pending自動却下を加えたもの。
--
-- 含まれるもの（SPEC §45-1〜45-3・§41(b)）:
--   1. ky_customer_accounts（お客様アカウント・PII最小）
--   2. ky_customer_follows（店舗フォロー）
--   3. ky_customers.account_id（店側台帳⇄本人アカウント紐付け）
--   4. ky_point_transactions（§41(b) ポイント台帳・append-only）
--   5. ky_orders.mobile_order_token ＋ ky_order_items.status
--   6. ky_casts.accepts_offschedule_nomination ＋ ky_reservations.nomination_type（§45-6）
--   7. RPC: ky_issue_mobile_order_token / ky_submit_mobile_order /
--           ky_attach_customer_by_account / ky_redeem_point_reward
--   8. ky_close_order v5（confirmed のみ集計＋クローズ時トークン失効・pending却下）
--
-- 含まれないもの（実装Revで別途）:
--   ・ky_make_reservation v3（出勤予定外指名リクエスト対応＝SPEC §45-6 の設計に従い改修）
--   ・ky_announcements（お知らせ配信＝§45-2 ◯後続）
--   ・スタンプ→ポイント片寄せのデータ移行（§45-2 来店スタンプ行＝二重制度解消は§41実装時）
--
-- ロールバック:
--   drop function if exists public.ky_redeem_point_reward(uuid, uuid, uuid);
--   drop function if exists public.ky_attach_customer_by_account(uuid, uuid, uuid);
--   drop function if exists public.ky_submit_mobile_order(text, jsonb);
--   drop function if exists public.ky_issue_mobile_order_token(uuid, uuid);
--   -- ky_close_order は 0052 版で再CREATE
--   alter table public.ky_reservations drop column if exists nomination_type;
--   alter table public.ky_casts drop column if exists accepts_offschedule_nomination;
--   alter table public.ky_order_items drop column if exists status;
--   alter table public.ky_orders drop column if exists mobile_order_token;
--   drop table if exists public.ky_point_transactions;
--   alter table public.ky_customers drop column if exists account_id;
--   drop table if exists public.ky_customer_follows;
--   drop table if exists public.ky_customer_accounts;

-- ================================================================
-- 1. ky_customer_accounts（§45-1・PII最小＝nickname のみ）
-- ================================================================

create table if not exists public.ky_customer_accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  nickname   text not null default '' check (char_length(nickname) <= 30),
  created_at timestamptz not null default now()
);

alter table public.ky_customer_accounts enable row level security;

-- 本人のみ（owner/cast からお客様アカウント一覧は見えない＝PII最小原則）
drop policy if exists ky_customer_accounts_self on public.ky_customer_accounts;
create policy ky_customer_accounts_self on public.ky_customer_accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ================================================================
-- 2. ky_customer_follows（§45-1・マルチ店フォロー）
-- ================================================================

create table if not exists public.ky_customer_follows (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ky_customer_accounts(id) on delete cascade,
  tenant_id  uuid not null references public.ky_tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (account_id, tenant_id)
);

create index if not exists idx_ky_customer_follows_account
  on public.ky_customer_follows(account_id);

alter table public.ky_customer_follows enable row level security;

drop policy if exists ky_customer_follows_self on public.ky_customer_follows;
create policy ky_customer_follows_self on public.ky_customer_follows
  for all to authenticated
  using (
    account_id in (select id from public.ky_customer_accounts where user_id = auth.uid())
  )
  with check (
    account_id in (select id from public.ky_customer_accounts where user_id = auth.uid())
    -- 停止テナントはフォロー不可（§15）
    and (select is_suspended from public.ky_tenants t where t.id = tenant_id) = false
  );

-- ================================================================
-- 3. ky_customers.account_id（§45-1・店側台帳との紐付け）
--    アカウント削除時は SET NULL＝店側台帳は残る（§45-4・PP明記事項）
--    ★注意: ky_customers には internal_notes（店内メモ）があるため、
--    お客様ロールへ ky_customers の SELECT を開けてはならない（本migrationでも開けない）。
--    お客様が読めるのは ky_point_transactions（下記）のみ。
-- ================================================================

alter table public.ky_customers
  add column if not exists account_id uuid null
    references public.ky_customer_accounts(id) on delete set null;

-- 同一店×同一アカウントの台帳行は1つ（QR紐付けの find-or-create 前提）
create unique index if not exists idx_ky_customers_tenant_account
  on public.ky_customers(tenant_id, account_id) where account_id is not null;

-- ================================================================
-- 4. ky_point_transactions（§41(b)・append-only 台帳）
--    customer_ref = ky_customers.id（§45-1で確定）。残高＝sum(points)。
--    points: 正=付与(earn/adjust) / 負=使用(redeem/adjust)
-- ================================================================

create table if not exists public.ky_point_transactions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.ky_tenants(id) on delete cascade,
  customer_ref uuid not null references public.ky_customers(id) on delete cascade,
  kind         text not null check (kind in ('earn', 'redeem', 'adjust')),
  points       int  not null check (points <> 0),
  reward_id    uuid null references public.ky_point_rewards(id) on delete set null,
  order_id     uuid null references public.ky_orders(id) on delete set null,
  memo         text not null default '' check (char_length(memo) <= 200),
  created_at   timestamptz not null default now()
);

-- 種別と符号の整合（earn=正 / redeem=負。adjust は両方向可）
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ky_point_transactions_sign_check'
      and conrelid = 'public.ky_point_transactions'::regclass
  ) then
    alter table public.ky_point_transactions
      add constraint ky_point_transactions_sign_check
      check (
        (kind = 'earn'   and points > 0) or
        (kind = 'redeem' and points < 0) or
        (kind = 'adjust')
      );
  end if;
end $$;

create index if not exists idx_ky_point_transactions_customer
  on public.ky_point_transactions(customer_ref, created_at desc);
create index if not exists idx_ky_point_transactions_tenant
  on public.ky_point_transactions(tenant_id, created_at desc);

alter table public.ky_point_transactions enable row level security;

-- append-only: SELECT / INSERT ポリシーのみ定義＝UPDATE/DELETE は誰にも許可しない（FIN-2）
drop policy if exists ky_point_transactions_owner_select on public.ky_point_transactions;
create policy ky_point_transactions_owner_select on public.ky_point_transactions
  for select to authenticated
  using (tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid()));

drop policy if exists ky_point_transactions_owner_insert on public.ky_point_transactions;
create policy ky_point_transactions_owner_insert on public.ky_point_transactions
  for insert to authenticated
  with check (
    tenant_id in (select id from public.ky_tenants where owner_user_id = auth.uid())
    -- customer-tenant 一致（他店の顧客IDへ付与できない）
    and customer_ref in (select id from public.ky_customers c where c.tenant_id = ky_point_transactions.tenant_id)
    -- redeem は残高検証つきRPC（ky_redeem_point_reward）経由のみ＝直接INSERT不可
    and kind in ('earn', 'adjust')
  );

-- お客様本人: 自分の台帳のみ閲覧（memo は店が書く欄＝お客様に見える前提で運用する旨をUI注記）
drop policy if exists ky_point_transactions_customer_select on public.ky_point_transactions;
create policy ky_point_transactions_customer_select on public.ky_point_transactions
  for select to authenticated
  using (
    customer_ref in (
      select c.id from public.ky_customers c
      join public.ky_customer_accounts a on a.id = c.account_id
      where a.user_id = auth.uid()
    )
  );

-- ================================================================
-- 5. モバイルオーダー列（§45-3）
-- ================================================================

-- 卓QRトークン（伝票オープン中のみ有効・クローズで失効＝ky_close_order v5 が null 化）
alter table public.ky_orders
  add column if not exists mobile_order_token text null;

create unique index if not exists idx_ky_orders_mobile_order_token
  on public.ky_orders(mobile_order_token) where mobile_order_token is not null;

-- 明細ステータス（既定 'confirmed' ＝ 既存レジ経路の挙動不変）
alter table public.ky_order_items
  add column if not exists status text not null default 'confirmed';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ky_order_items_status_check'
      and conrelid = 'public.ky_order_items'::regclass
  ) then
    alter table public.ky_order_items
      add constraint ky_order_items_status_check
      check (status in ('pending', 'confirmed', 'rejected'));
  end if;
end $$;

-- ================================================================
-- 6. 出勤予定外指名（§45-6）の列
--    ky_make_reservation v3 の改修は実装Rev（SPEC §45-6 の設計に従う）
-- ================================================================

alter table public.ky_casts
  add column if not exists accepts_offschedule_nomination boolean not null default false;

alter table public.ky_reservations
  add column if not exists nomination_type text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ky_reservations_nomination_type_check'
      and conrelid = 'public.ky_reservations'::regclass
  ) then
    alter table public.ky_reservations
      add constraint ky_reservations_nomination_type_check
      check (nomination_type is null or nomination_type in ('confirmed', 'offschedule_request'));
  end if;
end $$;

-- ================================================================
-- 7-1. ky_issue_mobile_order_token: 卓QRトークン発行（店側操作）
-- ================================================================

create or replace function public.ky_issue_mobile_order_token(
  p_tenant_id uuid,
  p_order_id  uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner  uuid;
  v_status text;
  v_token  text;
begin
  select owner_user_id into v_owner from public.ky_tenants where id = p_tenant_id;
  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select status into v_status
    from public.ky_orders
   where id = p_order_id and tenant_id = p_tenant_id
   for update;
  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;

  -- 244bit エントロピー（uuid×2連結）＝推測不能・伝票クローズで失効
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  update public.ky_orders
     set mobile_order_token = v_token
   where id = p_order_id;

  return jsonb_build_object('ok', true, 'token', v_token);
end $$;

revoke all on function public.ky_issue_mobile_order_token(uuid, uuid) from public;
revoke all on function public.ky_issue_mobile_order_token(uuid, uuid) from anon;
grant execute on function public.ky_issue_mobile_order_token(uuid, uuid) to authenticated;

-- ================================================================
-- 7-2. ky_submit_mobile_order: お客様の注文送信（§45-3）
--    ・token を知る人だけがその伝票へ pending を積める（客に ky_orders/ky_order_items
--      の直接権限は与えない＝RLSポリシー追加なし）
--    ・FIN-9: 価格・名称はサーバー側で ky_menu_items から再解決（客入力値を信用しない）
--    ・レート制限: 1回20品目まで・伝票あたり pending 累計100まで
-- ================================================================

create or replace function public.ky_submit_mobile_order(
  p_token text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    record;
  v_elem     jsonb;
  v_menu     record;
  v_menu_id  uuid;
  v_qty      int;
  v_cast     uuid;
  v_pending  int;
  v_inserted int := 0;
begin
  -- お客様アカウント必須（匿名からの叩きを遮断。トークンはQR由来＝店内の人のみ知る）
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_token is null or char_length(p_token) < 32 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  -- 存在しない/クローズ済みは同一エラー（トークン総当たりに情報を返さない）
  select id, tenant_id, status into v_order
    from public.ky_orders
   where mobile_order_token = p_token
   for update;
  if not found or v_order.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid_items');
  end if;

  select count(*) into v_pending
    from public.ky_order_items
   where order_id = v_order.id and status = 'pending';
  if v_pending + jsonb_array_length(p_items) > 100 then
    return jsonb_build_object('ok', false, 'error', 'too_many_pending');
  end if;

  for v_elem in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_elem) <> 'object' then
      continue;
    end if;
    begin
      v_menu_id := (v_elem->>'menu_item_id')::uuid;
      v_qty     := (v_elem->>'qty')::int;
      v_cast    := nullif(v_elem->>'cast_id', '')::uuid;
    exception when others then
      continue;  -- 型不正の要素はスキップ
    end;
    if v_menu_id is null or v_qty is null or v_qty < 1 or v_qty > 99 then
      continue;
    end if;

    -- FIN-9: サーバー再解決（tenant一致＋is_active のみ・価格/名称はDB値）
    select id, category, name, price into v_menu
      from public.ky_menu_items
     where id = v_menu_id and tenant_id = v_order.tenant_id and is_active = true;
    if not found then
      continue;
    end if;

    -- cast はテナント所属のみ許可（不一致は cast なしで通す）
    if v_cast is not null and not exists (
      select 1 from public.ky_casts c where c.id = v_cast and c.tenant_id = v_order.tenant_id
    ) then
      v_cast := null;
    end if;

    insert into public.ky_order_items
      (order_id, tenant_id, menu_item_id, category, name, price, qty, cast_id, status)
    values
      (v_order.id, v_order.tenant_id, v_menu.id, v_menu.category, v_menu.name,
       v_menu.price, v_qty, v_cast, 'pending');
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('ok', true, 'inserted', v_inserted);
end $$;

revoke all on function public.ky_submit_mobile_order(text, jsonb) from public;
revoke all on function public.ky_submit_mobile_order(text, jsonb) from anon;
grant execute on function public.ky_submit_mobile_order(text, jsonb) to authenticated;

-- ================================================================
-- 7-3. ky_attach_customer_by_account: 会員QR→伝票紐付け（§45-2 デジタル会員証）
--    店がレジで会員QR（account_id）を読み取り→店側台帳の find-or-create→伝票へ紐付け
-- ================================================================

create or replace function public.ky_attach_customer_by_account(
  p_tenant_id  uuid,
  p_order_id   uuid,
  p_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner       uuid;
  v_status      text;
  v_customer_id uuid;
  v_nickname    text;
begin
  select owner_user_id into v_owner from public.ky_tenants where id = p_tenant_id;
  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select status into v_status
    from public.ky_orders
   where id = p_order_id and tenant_id = p_tenant_id
   for update;
  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v_status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;

  select nickname into v_nickname
    from public.ky_customer_accounts where id = p_account_id;
  if v_nickname is null then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  -- find-or-create（tenant×account はユニーク＝idx_ky_customers_tenant_account）
  select id into v_customer_id
    from public.ky_customers
   where tenant_id = p_tenant_id and account_id = p_account_id;
  if v_customer_id is null then
    insert into public.ky_customers (tenant_id, name, account_id)
    values (p_tenant_id, coalesce(nullif(v_nickname, ''), '会員'), p_account_id)
    returning id into v_customer_id;
  end if;

  update public.ky_orders set customer_id = v_customer_id where id = p_order_id;

  return jsonb_build_object('ok', true, 'customer_id', v_customer_id);
end $$;

revoke all on function public.ky_attach_customer_by_account(uuid, uuid, uuid) from public;
revoke all on function public.ky_attach_customer_by_account(uuid, uuid, uuid) from anon;
grant execute on function public.ky_attach_customer_by_account(uuid, uuid, uuid) to authenticated;

-- ================================================================
-- 7-4. ky_redeem_point_reward: 景品交換の確定（店レジ操作・残高原子検証）
--    redeem は本RPC経由のみ（owner INSERT ポリシーは earn/adjust に限定済み）
-- ================================================================

create or replace function public.ky_redeem_point_reward(
  p_tenant_id   uuid,
  p_customer_id uuid,
  p_reward_id   uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner   uuid;
  v_reward  record;
  v_balance int;
begin
  select owner_user_id into v_owner from public.ky_tenants where id = p_tenant_id;
  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if not exists (
    select 1 from public.ky_customers c
    where c.id = p_customer_id and c.tenant_id = p_tenant_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  select id, points_required, name into v_reward
    from public.ky_point_rewards
   where id = p_reward_id and tenant_id = p_tenant_id and is_active = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'reward_not_found');
  end if;

  -- 同一顧客の並行交換を直列化（残高の二重消費防止＝BE-5思想）
  perform pg_advisory_xact_lock(hashtext('ky_points:' || p_customer_id::text));

  select coalesce(sum(points), 0) into v_balance
    from public.ky_point_transactions
   where customer_ref = p_customer_id;

  if v_balance < v_reward.points_required then
    return jsonb_build_object('ok', false, 'error', 'insufficient_points',
                              'balance', v_balance, 'required', v_reward.points_required);
  end if;

  insert into public.ky_point_transactions
    (tenant_id, customer_ref, kind, points, reward_id, memo)
  values
    (p_tenant_id, p_customer_id, 'redeem', -v_reward.points_required, p_reward_id, v_reward.name);

  return jsonb_build_object('ok', true, 'balance', v_balance - v_reward.points_required);
end $$;

revoke all on function public.ky_redeem_point_reward(uuid, uuid, uuid) from public;
revoke all on function public.ky_redeem_point_reward(uuid, uuid, uuid) from anon;
grant execute on function public.ky_redeem_point_reward(uuid, uuid, uuid) to authenticated;

-- ================================================================
-- 8. ky_close_order v5: confirmed のみ集計＋クローズ時のトークン失効・pending自動却下
--    （0052 v4 との差分は「-- §45:」コメントの4行＋冒頭のpending却下＋トークンnull化のみ）
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

  -- §45: 会計時に残っている pending は自動却下（UIで承認/却下してから会計が本線・これは防御）
  update public.ky_order_items set status = 'rejected'
   where order_id = p_order_id and status = 'pending';

  -- FIN-3: サーバー側で subtotal を再計算（§45: confirmed のみ）
  select coalesce(sum(price * qty), 0) into v_subtotal
    from public.ky_order_items
    where order_id = p_order_id
      and status = 'confirmed';

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
    and mi.tenant_id = p_tenant_id  -- KA-8: 他テナントメニュー参照の遮断
    and oi.status = 'confirmed';    -- §45: confirmed のみ

  -- 伝票を確定（§45: モバイルオーダートークンはクローズで失効）
  update public.ky_orders set
    status             = 'closed',
    closed_at          = now(),
    subtotal           = v_subtotal,
    deposit            = p_deposit,
    change             = p_change,
    payment_method     = p_payment_method,
    note               = p_note,
    customer_id        = p_customer_id,
    mobile_order_token = null
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
      and oi.status = 'confirmed'  -- §45: confirmed のみ
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
       and oi.status = 'confirmed'  -- §45: confirmed のみ
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
