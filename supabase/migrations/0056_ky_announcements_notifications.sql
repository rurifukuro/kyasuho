-- 0056: 開発者お知らせ＋内部通知
--
-- 1. ky_dev_announcements — 開発者（アプリ運営）からのお知らせ。対象層を指定可能
-- 2. ky_notifications — テナント内の内部通知（キャスト→管理者、管理者→キャスト）

-- ================================================================
-- 1. 開発者お知らせ（全テナント共通・RLSなし＝anonで読める）
-- ================================================================

CREATE TABLE public.ky_dev_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  audience text[] NOT NULL DEFAULT '{admin,cast,customer}',
  is_active bool NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ky_dev_announcements IS '開発者からのお知らせ。audience配列でどの層に表示するか制御';
COMMENT ON COLUMN public.ky_dev_announcements.audience IS '表示対象: admin / cast / customer の組み合わせ';
COMMENT ON COLUMN public.ky_dev_announcements.priority IS '表示順（大きいほど上）';
COMMENT ON COLUMN public.ky_dev_announcements.expires_at IS 'NULLなら無期限。期限切れはクライアントでフィルタ';

-- RLS: 読み取りは全員OK（公開情報）。書き込みはservice_roleのみ
ALTER TABLE public.ky_dev_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_announcements_read" ON public.ky_dev_announcements
  FOR SELECT USING (true);

-- ================================================================
-- 2. テナント内通知
-- ================================================================

CREATE TABLE public.ky_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.ky_tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  sender_role text NOT NULL CHECK (sender_role IN ('admin', 'cast', 'system')),
  target_role text NOT NULL CHECK (target_role IN ('admin', 'cast')),
  sender_id uuid,
  is_read bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ky_notifications_tenant_target
  ON public.ky_notifications(tenant_id, target_role, created_at DESC);

COMMENT ON TABLE public.ky_notifications IS 'テナント内通知。キャスト→管理者、管理者→キャスト、システム自動通知';
COMMENT ON COLUMN public.ky_notifications.type IS '通知種別: shift_submitted / admin_message / schedule_change 等';
COMMENT ON COLUMN public.ky_notifications.sender_role IS '送信者ロール: admin=管理者、cast=キャスト、system=自動';
COMMENT ON COLUMN public.ky_notifications.target_role IS '受信者ロール: admin=管理者画面に表示、cast=キャスト画面に表示';
COMMENT ON COLUMN public.ky_notifications.sender_id IS '送信者のuser_idまたはcast_id（system通知時はNULL可）';

-- RLS: 自テナントの通知のみ
ALTER TABLE public.ky_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_tenant_read" ON public.ky_notifications
  FOR SELECT USING (
    tenant_id IN (
      SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid()
    )
    OR
    tenant_id IN (
      SELECT tenant_id FROM public.ky_casts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "notifications_tenant_insert" ON public.ky_notifications
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid()
    )
    OR
    tenant_id IN (
      SELECT tenant_id FROM public.ky_casts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "notifications_tenant_update" ON public.ky_notifications
  FOR UPDATE USING (
    tenant_id IN (
      SELECT id FROM public.ky_tenants WHERE owner_user_id = auth.uid()
    )
    OR
    tenant_id IN (
      SELECT tenant_id FROM public.ky_casts WHERE user_id = auth.uid()
    )
  );
