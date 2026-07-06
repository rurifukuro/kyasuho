-- §29: 席種・席料テーブル＋予約への席種参照列追加

CREATE TABLE IF NOT EXISTS ky_seat_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES ky_tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  seat_fee INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_ky_seat_types_tenant ON ky_seat_types(tenant_id);

ALTER TABLE ky_seat_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY ky_seat_types_tenant_rw ON ky_seat_types
  FOR ALL
  USING (tenant_id = (SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid()));

-- 客Web用（anon）: 有効な席種を読める
CREATE POLICY ky_seat_types_anon_read ON ky_seat_types
  FOR SELECT TO anon USING (is_active = TRUE);

-- ky_reservationsに席種参照列追加（null可＝席種未指定の既存予約との後方互換）
ALTER TABLE ky_reservations ADD COLUMN IF NOT EXISTS seat_type_id UUID REFERENCES ky_seat_types(id) ON DELETE SET NULL;
