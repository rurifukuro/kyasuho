-- きゃすほ！ Rev3 migration 0001: テナント基盤（認証＋マルチテナントの土台）
--
-- 適用先（MVP・相乗り）: concafe-yoyaku 本番プロジェクト ref=rhmuitgbvilqwdevxxox（Tokyo）
--   ⚠ 別アプリの稼働中DBへの相乗り。**新規テーブル ky_tenants の追加のみ＝非破壊**。
--   既存 concafe テーブル・関数には一切触れない。関数名も ky_ プレフィックスで衝突回避。
-- 本番前: 専用プロジェクトへ分離（同じ SQL を流す→pg_dump で ky_* のみ移行）＝SPEC §12/§19-8。
--
-- 適用手順（WEB7準拠）: Supabase SQL Editor で本ファイルを実行 → REST で再検証。
-- ロールバック: drop table public.ky_tenants cascade; drop function public.ky_set_updated_at();

create extension if not exists pgcrypto;

-- ── テナント（＝店舗）。slug が客側公開ページ（#/<slug>）のキー ──────────────
create table if not exists public.ky_tenants (
  id             uuid        primary key default gen_random_uuid(),
  slug           text        not null unique,                          -- 公開URL用（英数-）
  name           text        not null,                                 -- 店名
  genre          text        not null default '',                      -- ジャンル
  owner_user_id  uuid        not null references auth.users(id) on delete cascade,
  business_info  jsonb       not null default '{}'::jsonb,             -- 住所/営業時間/TEL/備考（§10 BusinessInfo）
  is_suspended   boolean     not null default false,                   -- 運営停止フラグ（UGC対応・§15）
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 1オーナー1店舗（MVP・SPEC §12「1アカウント1店舗」）。複数店舗は有料/後フェーズ。
create unique index if not exists ky_tenants_owner_uidx on public.ky_tenants(owner_user_id);
create index        if not exists ky_tenants_slug_idx  on public.ky_tenants(slug);

-- ── updated_at 自動更新（関数名も ky_ で相乗り先と衝突回避）─────────────────
create or replace function public.ky_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists ky_tenants_set_updated_at on public.ky_tenants;
create trigger ky_tenants_set_updated_at
  before update on public.ky_tenants
  for each row execute function public.ky_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.ky_tenants enable row level security;

-- 提供者（authenticated）: 自分が owner のテナントのみ全操作。
-- with check で INSERT/UPDATE 時も owner_user_id=auth.uid() を強制（他人テナントの詐称防止）。
drop policy if exists ky_tenants_owner_all on public.ky_tenants;
create policy ky_tenants_owner_all on public.ky_tenants
  for all
  to authenticated
  using      (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- 客側公開Web（anon）: 停止されていないテナントのみ公開SELECT（§12）。
drop policy if exists ky_tenants_public_read on public.ky_tenants;
create policy ky_tenants_public_read on public.ky_tenants
  for select
  to anon
  using (is_suspended = false);
