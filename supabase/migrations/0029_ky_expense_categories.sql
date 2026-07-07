-- D: 経費カテゴリのカスタム追加（テナント毎に独自カテゴリを追加可能にする）

CREATE TABLE IF NOT EXISTS public.ky_expense_categories (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.ky_tenants(id) on delete cascade,
  key        text not null,
  label      text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

ALTER TABLE public.ky_expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ky_expense_categories_select" ON public.ky_expense_categories
  FOR SELECT USING (true);

CREATE POLICY "ky_expense_categories_insert" ON public.ky_expense_categories
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "ky_expense_categories_update" ON public.ky_expense_categories
  FOR UPDATE USING (
    tenant_id = (SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "ky_expense_categories_delete" ON public.ky_expense_categories
  FOR DELETE USING (
    tenant_id = (SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid())
  );
