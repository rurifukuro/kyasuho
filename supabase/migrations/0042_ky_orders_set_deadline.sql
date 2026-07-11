-- §49-1 卓タイマー・延長アラート
-- set_deadline_at = 今のセットの終了予定時刻（伝票オープン時に opened_at + 1セット時間で初期化）
-- 延長 = セット明細追加時に +セット数×set分 で更新（明細と締切が常に整合）
-- タイマーは運用補助＝会計金額には一切影響しない（FIN-3不変）

alter table public.ky_orders
  add column if not exists set_deadline_at timestamptz null;

-- テナント設定にタイマー関連を追加
alter table public.ky_tenants
  add column if not exists timer_enabled boolean not null default true;

alter table public.ky_tenants
  add column if not exists timer_alert_minutes int not null default 5;
