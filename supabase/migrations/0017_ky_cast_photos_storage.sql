-- §30: キャスト写真用Storageバケット＋証明写真URLカラム

-- Storageバケット作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('ky-cast-photos', 'ky-cast-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- お店写真: 認証済みユーザーがアップロード可、誰でも閲覧可（公開バケット）
CREATE POLICY ky_cast_photos_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ky-cast-photos');

CREATE POLICY ky_cast_photos_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ky-cast-photos');

CREATE POLICY ky_cast_photos_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ky-cast-photos');

CREATE POLICY ky_cast_photos_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ky-cast-photos');

-- 証明写真URL列はky_cast_profilesテーブル作成時に追加する（現段階ではテーブル未作成）
