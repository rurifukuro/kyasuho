-- §40-3: X投稿テンプレート（マンスリー/デイリー別・編集可）
ALTER TABLE ky_tenants
  ADD COLUMN IF NOT EXISTS sns_post_templates JSONB NOT NULL DEFAULT '{}'::jsonb;
