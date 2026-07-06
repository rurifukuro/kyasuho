-- §27: 経費テーブル

CREATE TABLE IF NOT EXISTS ky_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ky_tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL DEFAULT 'misc',
  amount INTEGER NOT NULL DEFAULT 0,
  memo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ky_expenses_tenant_date ON ky_expenses(tenant_id, date);

ALTER TABLE ky_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY ky_expenses_tenant_rw ON ky_expenses
  FOR ALL
  USING (tenant_id = (SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid()));
