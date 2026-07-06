-- §31: 店舗SNSリンク列追加
ALTER TABLE ky_tenants ADD COLUMN IF NOT EXISTS sns_links JSONB NOT NULL DEFAULT '[]'::jsonb;
