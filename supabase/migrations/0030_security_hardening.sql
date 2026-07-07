-- きゃすりん Rev63 migration 0030: セキュリティ強化一括（2026-07-07 設計監査）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   ポリシー/権限/関数の差し替え＋補助テーブル1つ＝非破壊。既存データ・テーブル定義は不変。
--
-- 監査で発見した問題と対応:
--   S1  ky_reservations: anonが customer_name/contact を全件読めた（RLSは行のみ制限・列は制限しない）
--       → 列レベルGRANTで anon は空き計算に必要な列だけに限定
--   S2  ky_reservation_pins: authenticated全員が他テナントのPINを削除できた → オーナーのテナントに限定
--   S3  PIN照合RPCに総当たり対策なし（4桁=1万通り） → 失敗5回/15分でロック
--   S4  ky_casts_self_update: キャスト本人が tenant_id 等どの列でも変更できた → トリガーで列制限
--   S5  ky-cast-photos Storage: authenticated全員が他テナントの写真を上書き/削除できた → フォルダスコープ
--   S6  ky-receipts Storage: 同上＋anonが領収書一覧を列挙できた → 書込フォルダスコープ＋読取オーナー限定
--   S7  ky_seat_types / ky_events の anon 読取に停止テナント除外がなかった → 追加
--   S8  ky_make_reservation: 入力長・slot形式・停止テナント・cast/seat_typeの他テナント参照が未検証 → 検証追加
--   S9  SECURITY DEFINER関数の search_path 未固定（ky_redeem_cast_invite） → 固定
--   S10 ky_delete_account: ky_ai_usage（FK無し）とStorageオブジェクトが残存した → 削除追加
--
-- ロールバック: 本文末尾のコメント参照

-- ══════════════════════════════════════════════════════════════
-- S1: ky_reservations の anon 列レベル制限（最重要）
-- ══════════════════════════════════════════════════════════════
-- 0008 の行ポリシー（active＋未停止テナント）は維持。列を絞ることで
-- `?select=customer_name,contact` による全店舗の客名・連絡先収集を遮断する。

REVOKE SELECT ON public.ky_reservations FROM anon;
GRANT SELECT (id, tenant_id, date, slot, set_minutes, seat_no, status)
  ON public.ky_reservations TO anon;

-- ══════════════════════════════════════════════════════════════
-- S2: ky_reservation_pins の削除をオーナーの自テナントに限定
-- ══════════════════════════════════════════════════════════════

drop policy if exists ky_reservation_pins_admin_delete on public.ky_reservation_pins;
create policy ky_reservation_pins_admin_delete on public.ky_reservation_pins
  for delete
  to authenticated
  using (
    reservation_id in (
      select r.id from public.ky_reservations r
      where r.tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid())
    )
  );

-- ══════════════════════════════════════════════════════════════
-- S3: PIN総当たり対策（失敗5回/15分で予約単位ロック）
-- ══════════════════════════════════════════════════════════════

create table if not exists public.ky_pin_attempts (
  reservation_id uuid        not null references public.ky_reservations(id) on delete cascade,
  attempted_at   timestamptz not null default now()
);

create index if not exists ky_pin_attempts_res_time_idx
  on public.ky_pin_attempts(reservation_id, attempted_at);

alter table public.ky_pin_attempts enable row level security;
-- ポリシーなし＝クライアント直アクセス不可。SECURITY DEFINER関数のみが読み書きする。
revoke all on public.ky_pin_attempts from anon, authenticated;

create or replace function public.ky_verify_reservation_pin(
  p_reservation_id uuid,
  p_pin            text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_stored text;
  v_fails  int;
begin
  -- 総当たり対策: 直近15分の失敗が5回以上ならロック
  select count(*) into v_fails
  from ky_pin_attempts
  where reservation_id = p_reservation_id
    and attempted_at > now() - interval '15 minutes';
  if v_fails >= 5 then
    return json_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select pin into v_stored
  from ky_reservation_pins
  where reservation_id = p_reservation_id;

  if not found then
    return json_build_object('ok', false, 'reason', 'no_pin');
  end if;

  if v_stored <> p_pin then
    insert into ky_pin_attempts (reservation_id) values (p_reservation_id);
    return json_build_object('ok', false, 'reason', 'mismatch');
  end if;

  -- 成功したら失敗履歴をリセット
  delete from ky_pin_attempts where reservation_id = p_reservation_id;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.ky_cancel_reservation(
  p_reservation_id uuid,
  p_pin            text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_stored text;
  v_status text;
  v_fails  int;
begin
  select count(*) into v_fails
  from ky_pin_attempts
  where reservation_id = p_reservation_id
    and attempted_at > now() - interval '15 minutes';
  if v_fails >= 5 then
    return json_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  select pin into v_stored
  from ky_reservation_pins
  where reservation_id = p_reservation_id;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_stored <> p_pin then
    insert into ky_pin_attempts (reservation_id) values (p_reservation_id);
    return json_build_object('ok', false, 'error', 'pin_mismatch');
  end if;

  delete from ky_pin_attempts where reservation_id = p_reservation_id;

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

-- ══════════════════════════════════════════════════════════════
-- S4: ky_casts キャスト本人UPDATEの列制限トリガー
-- ══════════════════════════════════════════════════════════════
-- 0011 の ky_casts_self_update ポリシーは行のみ制限＝本人が tenant_id（店移動）や
-- user_id・sort_order も書き換えられた。RLSは列を制限できないためトリガーで防御。
-- 本人が変更できるのはプロフィール系（name/name_kana/bio/photo_url/sns_links/accepts_nomination）のみ。

create or replace function public.ky_casts_self_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
begin
  -- auth.uid() が無い文脈（service_role・SQLエディタ等）とオーナーは制限しない
  if auth.uid() is null then
    return new;
  end if;
  select exists (
    select 1 from public.ky_tenants t
    where t.id = old.tenant_id and t.owner_user_id = auth.uid()
  ) into v_is_owner;
  if v_is_owner then
    return new;
  end if;

  if new.tenant_id  is distinct from old.tenant_id
     or new.user_id    is distinct from old.user_id
     or new.sort_order is distinct from old.sort_order
     or new.created_at is distinct from old.created_at then
    raise exception 'cast self-update: column not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists ky_casts_self_update_guard on public.ky_casts;
create trigger ky_casts_self_update_guard
  before update on public.ky_casts
  for each row execute function public.ky_casts_self_update_guard();

-- ══════════════════════════════════════════════════════════════
-- S5: ky-cast-photos Storage 書込ポリシーをテナントフォルダにスコープ
-- ══════════════════════════════════════════════════════════════
-- パスは `${tenantId}/${castId}/shop.jpg` 形式（castPhotos.ts）＝0020と同型でスコープ可能。
-- 読取（公開）は客Web表示用に現状維持。

drop policy if exists ky_cast_photos_auth_insert on storage.objects;
create policy ky_cast_photos_auth_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ky-cast-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.ky_tenants where owner_user_id = auth.uid()
    )
  );

drop policy if exists ky_cast_photos_auth_update on storage.objects;
create policy ky_cast_photos_auth_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'ky-cast-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.ky_tenants where owner_user_id = auth.uid()
    )
  );

drop policy if exists ky_cast_photos_auth_delete on storage.objects;
create policy ky_cast_photos_auth_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ky-cast-photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.ky_tenants where owner_user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════
-- S6: ky-receipts Storage フォルダスコープ＋一覧列挙の遮断
-- ══════════════════════════════════════════════════════════════
-- パスは `${tenantId}/${expenseId}.jpg`（receipts.ts）。
-- 一覧(list API)をオーナー限定にして anon の領収書URL列挙を防ぐ。
-- 個別オブジェクトは公開バケットのため直URLで表示可能（URLは2つのUUIDで推測困難）。
-- ※将来課題: 本番分離時に非公開バケット＋署名付きURLへ移行するのが望ましい。

drop policy if exists ky_receipts_public_read on storage.objects;
create policy ky_receipts_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ky-receipts'
    and (storage.foldername(name))[1] in (
      select id::text from public.ky_tenants where owner_user_id = auth.uid()
    )
  );

drop policy if exists ky_receipts_auth_insert on storage.objects;
create policy ky_receipts_auth_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ky-receipts'
    and (storage.foldername(name))[1] in (
      select id::text from public.ky_tenants where owner_user_id = auth.uid()
    )
  );

drop policy if exists ky_receipts_auth_update on storage.objects;
create policy ky_receipts_auth_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'ky-receipts'
    and (storage.foldername(name))[1] in (
      select id::text from public.ky_tenants where owner_user_id = auth.uid()
    )
  );

drop policy if exists ky_receipts_auth_delete on storage.objects;
create policy ky_receipts_auth_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ky-receipts'
    and (storage.foldername(name))[1] in (
      select id::text from public.ky_tenants where owner_user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════
-- S7: anon 読取ポリシーに停止テナント除外を追加
-- ══════════════════════════════════════════════════════════════

drop policy if exists ky_seat_types_anon_read on public.ky_seat_types;
create policy ky_seat_types_anon_read on public.ky_seat_types
  for select to anon
  using (
    is_active = true
    and (select is_suspended from public.ky_tenants t where t.id = tenant_id) = false
  );

-- 0023 は TO 句なし（全ロール）だった。anon+authenticated に明示しつつ停止テナントを除外。
drop policy if exists ky_events_anon_read on public.ky_events;
create policy ky_events_anon_read on public.ky_events
  for select to anon, authenticated
  using (
    is_public = true
    and (select is_suspended from public.ky_tenants t where t.id = tenant_id) = false
  );

-- ══════════════════════════════════════════════════════════════
-- S8: ky_make_reservation v4（入力検証・停止テナント・他テナント参照防止）
-- ══════════════════════════════════════════════════════════════

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

  -- cast / seat_type は同一テナント所属のみ許可（他テナントID注入防止）
  if p_cast_id is not null and not exists (
    select 1 from public.ky_casts c where c.id = p_cast_id and c.tenant_id = p_tenant_id
  ) then
    return json_build_object('error', 'bad_request');
  end if;
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

-- ══════════════════════════════════════════════════════════════
-- S9: SECURITY DEFINER 関数の search_path 固定（漏れ分）
-- ══════════════════════════════════════════════════════════════

alter function public.ky_redeem_cast_invite(text) set search_path = public;

-- ══════════════════════════════════════════════════════════════
-- S10: ky_delete_account v2（ky_ai_usage＋Storageオブジェクトも削除）
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ky_delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_tenant_id FROM ky_tenants WHERE owner_user_id = v_uid;

  IF v_tenant_id IS NOT NULL THEN
    DELETE FROM ky_shifts WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_reservation_pins WHERE reservation_id IN (
      SELECT id FROM ky_reservations WHERE tenant_id = v_tenant_id
    );
    DELETE FROM ky_push_tokens WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_reports WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_reservations WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_casts WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_unlock_windows WHERE tenant_id = v_tenant_id;
    -- FK の無い集計テーブル（0010）は明示削除
    DELETE FROM ky_ai_usage WHERE tenant_id = v_tenant_id;
    -- Storage オブジェクト（cast写真/領収書/シフト背景）はFKカスケード外＝明示削除。
    -- 権限等で失敗してもアカウント削除自体は続行する。
    BEGIN
      DELETE FROM storage.objects
      WHERE bucket_id IN ('ky-cast-photos', 'ky-receipts', 'ky-shift-backgrounds')
        AND (storage.foldername(name))[1] = v_tenant_id::text;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    -- 残りのテナント紐付きテーブルは ky_tenants の FK ON DELETE CASCADE で削除される
    DELETE FROM ky_tenants WHERE id = v_tenant_id;
  END IF;

  DELETE FROM ky_blocks WHERE user_id = v_uid OR blocked_user_id = v_uid;
  DELETE FROM ky_reports WHERE reporter_user_id = v_uid;

  -- キャスト個人テーブル（ky_cast_personal_info / ky_cast_work_history）は
  -- auth.users への FK ON DELETE CASCADE、ky_casts.user_id は ON DELETE SET NULL で処理される
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- ロールバック手順（必要時）
-- ══════════════════════════════════════════════════════════════
-- S1: GRANT SELECT ON public.ky_reservations TO anon;
-- S2: 0003 の ky_reservation_pins_admin_delete を再作成
-- S3: drop table ky_pin_attempts cascade; 0008 の2関数を再作成
-- S4: drop trigger ky_casts_self_update_guard on ky_casts; drop function ky_casts_self_update_guard();
-- S5/S6: 0017/0026 のポリシーを再作成
-- S7: 0015/0023 のポリシーを再作成
-- S8: 0028 の ky_make_reservation を再作成
-- S9: alter function ky_redeem_cast_invite(text) reset search_path;
-- S10: 0007 の ky_delete_account を再作成
