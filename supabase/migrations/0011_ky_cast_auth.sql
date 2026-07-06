-- きゃすりん T13 migration 0011: キャストアカウント基盤（招待制＋auth連携）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   既存テーブルへのカラム追加＋新規テーブル追加のみ＝非破壊。
-- ロールバック: alter table ky_casts drop column if exists user_id; drop table ky_cast_invites cascade;

-- ── ky_casts に user_id（auth連携）を追加 ──
-- キャスト個人がアカウント作成後、招待コードで紐付けると user_id が入る。
-- NULLable: 招待前・旧データは null。1ユーザー＝1キャストを UNIQUE で保証。

alter table public.ky_casts
  add column if not exists user_id uuid null references auth.users on delete set null;

create unique index if not exists ky_casts_user_id_unique
  on public.ky_casts(user_id) where user_id is not null;

-- ── ky_cast_invites（招待テーブル） ──
-- 店オーナーが招待コードを発行→キャスト個人がコードを入力→紐付け。

create table if not exists public.ky_cast_invites (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   uuid        not null references public.ky_tenants(id) on delete cascade,
  cast_id     uuid        not null references public.ky_casts(id) on delete cascade,
  code        text        not null,
  expires_at  timestamptz not null default now() + interval '7 days',
  used_at     timestamptz,
  used_by     uuid        references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create unique index if not exists ky_cast_invites_code_unique
  on public.ky_cast_invites(code) where used_at is null;

create index if not exists ky_cast_invites_tenant_idx
  on public.ky_cast_invites(tenant_id);

-- ── RLS on ky_cast_invites ──

alter table public.ky_cast_invites enable row level security;

-- オーナーは自テナントの招待を全操作
drop policy if exists ky_cast_invites_owner_all on public.ky_cast_invites;
create policy ky_cast_invites_owner_all on public.ky_cast_invites
  for all
  to authenticated
  using      (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()))
  with check (tenant_id = (select id from public.ky_tenants where owner_user_id = auth.uid()));

-- ── キャスト本人のRLSポリシー on ky_casts ──
-- 自分の行（user_id = auth.uid()）の一部カラムのみ UPDATE できる。

drop policy if exists ky_casts_self_update on public.ky_casts;
create policy ky_casts_self_update on public.ky_casts
  for update
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

-- キャスト本人が自分の行を参照できるポリシー
drop policy if exists ky_casts_self_select on public.ky_casts;
create policy ky_casts_self_select on public.ky_casts
  for select
  to authenticated
  using (user_id = auth.uid());

-- ── キャスト本人のRLSポリシー on ky_shifts（自分のシフトをSELECT） ──

drop policy if exists ky_shifts_self_select on public.ky_shifts;
create policy ky_shifts_self_select on public.ky_shifts
  for select
  to authenticated
  using (cast_id in (select id from public.ky_casts where user_id = auth.uid()));

-- ── キャスト本人のRLSポリシー on ky_cast_payroll（自分の給与をSELECT） ──

drop policy if exists ky_cast_payroll_self_select on public.ky_cast_payroll;
create policy ky_cast_payroll_self_select on public.ky_cast_payroll
  for select
  to authenticated
  using (cast_id in (select id from public.ky_casts where user_id = auth.uid()));

-- ── 招待コード消費RPC（SECURITY DEFINER＝キャスト本人が呼ぶ） ──
-- キャストがコードを入力→有効期限内＋未使用を確認→ky_casts.user_idに紐付け

create or replace function public.ky_redeem_cast_invite(p_code text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_invite record;
  v_uid uuid := auth.uid();
  v_existing uuid;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  -- 既にキャストとして紐付済みか確認
  select id into v_existing from public.ky_casts where user_id = v_uid;
  if v_existing is not null then
    return jsonb_build_object('error', 'already_linked');
  end if;

  -- 招待コードを検索（未使用＋有効期限内）
  select * into v_invite
    from public.ky_cast_invites
    where code = p_code
      and used_at is null
      and expires_at > now()
    for update skip locked;

  if not found then
    return jsonb_build_object('error', 'invalid_or_expired');
  end if;

  -- 対象キャストが既に別ユーザーに紐付いていないか
  select user_id into v_existing from public.ky_casts where id = v_invite.cast_id;
  if v_existing is not null then
    return jsonb_build_object('error', 'cast_already_linked');
  end if;

  -- 紐付け実行
  update public.ky_casts set user_id = v_uid where id = v_invite.cast_id;
  update public.ky_cast_invites set used_at = now(), used_by = v_uid where id = v_invite.id;

  return jsonb_build_object(
    'ok', true,
    'cast_id', v_invite.cast_id,
    'tenant_id', v_invite.tenant_id
  );
end;
$$;

revoke all on function public.ky_redeem_cast_invite(text) from public;
grant execute on function public.ky_redeem_cast_invite(text) to authenticated;
grant execute on function public.ky_redeem_cast_invite(text) to service_role;
