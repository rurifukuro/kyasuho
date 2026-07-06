-- §22-3: 店舗独自テンプレート背景画像用Storageバケット
INSERT INTO storage.buckets (id, name, public)
VALUES ('ky-shift-backgrounds', 'ky-shift-backgrounds', TRUE)
ON CONFLICT (id) DO NOTHING;

-- RLS: 同一テナントオーナーのみ書込み・誰でも読取
CREATE POLICY "shift_bg_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'ky-shift-backgrounds');

CREATE POLICY "shift_bg_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ky-shift-backgrounds'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.ky_tenants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "shift_bg_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'ky-shift-backgrounds'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.ky_tenants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "shift_bg_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'ky-shift-backgrounds'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.ky_tenants WHERE owner_user_id = auth.uid()
    )
  );
