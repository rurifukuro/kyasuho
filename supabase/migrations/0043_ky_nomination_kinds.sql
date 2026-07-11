-- §49-5: 本指名/場内指名の区別（設定制・既定OFF）
-- Phase 1 = メニュー分割方式（nomination カテゴリの品目を種別ラベル付きで登録）
-- nomination_kind は 'honshimei' | 'jounai' | null（null = 種別なし＝従来通り）

ALTER TABLE ky_tenants
  ADD COLUMN nomination_kinds_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE ky_menu_items
  ADD COLUMN nomination_kind text NULL;
