-- 領収書画像: ky_expenses.receipt_url + ky-receipts Storage バケット

ALTER TABLE ky_expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Storage バケット（公開=URL直アクセス可、RLS で書込み制限）
INSERT INTO storage.buckets (id, name, public)
VALUES ('ky-receipts', 'ky-receipts', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY ky_receipts_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ky-receipts');

CREATE POLICY ky_receipts_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ky-receipts');

CREATE POLICY ky_receipts_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ky-receipts');

CREATE POLICY ky_receipts_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ky-receipts');
