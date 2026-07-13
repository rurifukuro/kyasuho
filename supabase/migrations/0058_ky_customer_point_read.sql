-- 0058: お客様モード ポイント設定・景品カタログの顧客向け読取り権限（§45）
--
-- ky_point_settings: ポイント制度ON/OFFを顧客が確認するため公開SELECT
-- ky_point_rewards: 景品カタログを顧客が閲覧するため公開SELECT（active＋未停止テナントのみ）
-- いずれも列GRANT（SEC-15準拠）で公開列のみに限定。
--
-- ロールバック:
--   drop policy if exists ky_point_settings_public_read on ky_point_settings;
--   drop policy if exists ky_point_rewards_public_read on ky_point_rewards;
--   REVOKE SELECT ON ky_point_settings FROM anon;
--   REVOKE SELECT ON ky_point_rewards FROM anon;

-- ── ky_point_settings: anon SELECT（ポイント制度の有無を客Web/アプリで確認） ──
DROP POLICY IF EXISTS ky_point_settings_public_read ON ky_point_settings;
CREATE POLICY ky_point_settings_public_read ON ky_point_settings
  FOR SELECT TO anon
  USING (
    (SELECT NOT is_suspended FROM ky_tenants t WHERE t.id = tenant_id)
  );

GRANT SELECT (tenant_id, enabled, yen_per_point) ON ky_point_settings TO anon;

-- ── ky_point_rewards: anon SELECT（景品カタログ公開・active限定） ──
DROP POLICY IF EXISTS ky_point_rewards_public_read ON ky_point_rewards;
CREATE POLICY ky_point_rewards_public_read ON ky_point_rewards
  FOR SELECT TO anon
  USING (
    is_active = true
    AND (SELECT NOT is_suspended FROM ky_tenants t WHERE t.id = tenant_id)
  );

GRANT SELECT (id, tenant_id, points_required, name, description, is_active, sort_order)
  ON ky_point_rewards TO anon;
