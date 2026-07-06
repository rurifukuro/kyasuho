-- §28-1: ky_casts にふりがな列追加（あいうえお順ソートキー）
ALTER TABLE ky_casts ADD COLUMN IF NOT EXISTS name_kana TEXT DEFAULT '';
