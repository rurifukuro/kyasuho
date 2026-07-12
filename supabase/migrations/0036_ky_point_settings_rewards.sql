-- 0036: §41(a) ポイント・景品設定テーブル
-- ky_point_settings（テナント×1行・ポイント制度ON/OFF＋円/pt単価）
-- ky_point_rewards（景品カタログ＝必要ポイント・名称・説明のCRUD）
-- ※ ky_point_transactions（付与・使用台帳）は §41(b) customer_ref 導入と同時

-- ── ky_point_settings ─────────────────────────────
CREATE TABLE IF NOT EXISTS ky_point_settings (
  tenant_id UUID PRIMARY KEY REFERENCES ky_tenants(id) ON DELETE CASCADE,
  enabled   BOOLEAN NOT NULL DEFAULT false,
  yen_per_point INT NOT NULL DEFAULT 500 CHECK (yen_per_point > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ky_point_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ky_point_settings_owner ON ky_point_settings
  FOR ALL USING (
    tenant_id IN (SELECT id FROM ky_tenants WHERE owner_user_id = auth.uid())
  );

-- ── ky_point_rewards ──────────────────────────────
CREATE TABLE IF NOT EXISTS ky_point_rewards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES ky_tenants(id) ON DELETE CASCADE,
  points_required INT NOT NULL CHECK (points_required > 0),
  name            TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ky_point_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY ky_point_rewards_owner ON ky_point_rewards
  FOR ALL USING (
    tenant_id IN (SELECT id FROM ky_tenants WHERE owner_user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_ky_point_rewards_tenant
  ON ky_point_rewards(tenant_id, sort_order);
