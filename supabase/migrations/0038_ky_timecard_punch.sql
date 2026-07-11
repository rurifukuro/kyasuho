-- きゃすりん Rev95 migration 0038: タイムカード打刻（SPEC §49-3）
--
-- ① ky_attendance に edited_by_owner 列追加（キャスト申告値と店修正値の区別）
-- ② キャスト向け SELECT RLS 追加（自分の勤怠を閲覧可能に）
-- ③ ky_cast_punch RPC 新設（出勤/退勤打刻・SECURITY DEFINER）
--
-- ロールバック:
--   drop function if exists public.ky_cast_punch(text);
--   drop policy if exists ky_attendance_cast_select on public.ky_attendance;
--   alter table public.ky_attendance drop column if exists edited_by_owner;

-- ── ① edited_by_owner 列 ──
alter table public.ky_attendance
  add column if not exists edited_by_owner boolean not null default false;

-- ── ② キャスト向け SELECT RLS ──
drop policy if exists ky_attendance_cast_select on public.ky_attendance;
create policy ky_attendance_cast_select on public.ky_attendance
  for select
  to authenticated
  using (
    cast_id in (select id from public.ky_casts where user_id = auth.uid())
  );

-- ── ③ ky_cast_punch RPC ──
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
  -- 入力検証
  if p_direction not in ('in', 'out') then
    raise exception 'invalid_direction: must be "in" or "out"';
  end if;

  -- auth.uid() → cast_id を解決
  select c.id, c.tenant_id into v_cast_id, v_tenant_id
  from public.ky_casts c
  where c.user_id = auth.uid();

  if v_cast_id is null then
    raise exception 'cast_not_found';
  end if;

  -- 日本時間の今日 / 現在時刻
  v_today := (now() at time zone 'Asia/Tokyo')::date;
  v_now   := to_char(now() at time zone 'Asia/Tokyo', 'HH24:MI');

  -- 既存レコード確認
  select * into v_existing
  from public.ky_attendance
  where cast_id = v_cast_id and date = v_today;

  if p_direction = 'in' then
    if v_existing is not null and v_existing.check_in_at is not null then
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
    if v_existing is null or v_existing.check_in_at is null then
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

  -- 結果を返す
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

-- RPC 実行権限
revoke all on function public.ky_cast_punch(text) from public;
grant execute on function public.ky_cast_punch(text) to authenticated;
