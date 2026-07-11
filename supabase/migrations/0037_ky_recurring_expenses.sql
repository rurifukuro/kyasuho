-- 0037: §42 定期固定経費（毎月自動計上テンプレート）
-- ky_recurring_expenses  = テンプレ（名称・カテゴリ・金額・計上日・期間）
-- ky_recurring_expense_skips = 「この月だけスキップ」記録（物理削除後の再生成防止）
-- ky_expenses.source_recurring_id = 固定費テンプレから生成された行の出自

-- ── ky_recurring_expenses ─────────────────────────────
CREATE TABLE IF NOT EXISTS ky_recurring_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES ky_tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'misc',
  amount       INT NOT NULL DEFAULT 0 CHECK (amount >= 0),
  day_of_month INT NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  start_month  DATE NOT NULL,
  end_month    DATE,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ky_recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY ky_recurring_expenses_owner ON ky_recurring_expenses
  FOR ALL USING (
    tenant_id IN (SELECT id FROM ky_tenants WHERE owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_ky_recurring_expenses_tenant
  ON ky_recurring_expenses(tenant_id);

-- ── ky_recurring_expense_skips ────────────────────────
CREATE TABLE IF NOT EXISTS ky_recurring_expense_skips (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id UUID NOT NULL REFERENCES ky_recurring_expenses(id) ON DELETE CASCADE,
  month        DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recurring_id, month)
);

ALTER TABLE ky_recurring_expense_skips ENABLE ROW LEVEL SECURITY;

CREATE POLICY ky_recurring_expense_skips_owner ON ky_recurring_expense_skips
  FOR ALL USING (
    recurring_id IN (
      SELECT id FROM ky_recurring_expenses
      WHERE tenant_id IN (SELECT id FROM ky_tenants WHERE owner_id = auth.uid())
    )
  );

-- ── ky_expenses 列追加 ────────────────────────────────
ALTER TABLE ky_expenses
  ADD COLUMN IF NOT EXISTS source_recurring_id UUID REFERENCES ky_recurring_expenses(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ky_expenses_recurring_month
  ON ky_expenses (source_recurring_id, date_trunc('month', date))
  WHERE source_recurring_id IS NOT NULL;
