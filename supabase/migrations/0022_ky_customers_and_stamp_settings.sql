-- 顧客名簿 + スタンプ設定（§32-2仕込み）
CREATE TABLE ky_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ky_tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  name_kana TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  persona_notes TEXT NOT NULL DEFAULT '',
  internal_notes TEXT NOT NULL DEFAULT '',
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason TEXT NOT NULL DEFAULT '',
  stamp_count INTEGER NOT NULL DEFAULT 0,
  total_visits INTEGER NOT NULL DEFAULT 0,
  last_visit_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ky_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ky_customers_tenant" ON ky_customers
  FOR ALL USING (tenant_id = (SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid()));

CREATE TABLE ky_stamp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ky_tenants(id) ON DELETE CASCADE UNIQUE,
  stamps_per_visit INTEGER NOT NULL DEFAULT 1,
  reward_threshold INTEGER NOT NULL DEFAULT 10,
  reward_description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE ky_stamp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ky_stamp_settings_tenant" ON ky_stamp_settings
  FOR ALL USING (tenant_id = (SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid()));

ALTER TABLE ky_orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES ky_customers(id) ON DELETE SET NULL;
