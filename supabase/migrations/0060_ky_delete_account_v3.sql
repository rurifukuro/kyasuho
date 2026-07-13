-- 0060: ky_delete_account v3（§45 お客様モードテーブルのカスケード追加）
--
-- 背景（批判的チェック L-1）:
--   v2 (0030) は §45 テーブル追加前に書かれたまま未更新。
--   PP §5(2) / Terms §6(2) は「ポイント・注文履歴を即座に削除」と約束しているが、
--   ky_point_transactions / ky_faq_logs / ky_faq_usage は削除されなかった。
--
-- v3 の追加削除対象:
--   お客様アカウント削除パス（owner でない場合）:
--     - ky_point_transactions（customer_ref 経由で紐づく自分のポイント履歴）
--     - ky_faq_logs（自分の質問ログ）
--     - ky_faq_usage（自分の利用カウント）
--     - ky_customers.account_id は ON DELETE SET NULL（0053 設計＝店側台帳は残存）
--     - ky_customer_follows / ky_customer_accounts は ON DELETE CASCADE で自動削除
--   オーナー削除パス:
--     - 既存 v2 と同一＋上記テーブルのテナント紐づき分も削除
--
-- ★本番適用はユーザー承認ゲート

CREATE OR REPLACE FUNCTION ky_delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant_id uuid;
  v_customer_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- お客様として紐づく ky_customers.id を先に取得（ポイント履歴削除用）
  SELECT array_agg(c.id) INTO v_customer_ids
  FROM ky_customers c
  JOIN ky_customer_accounts a ON a.id = c.account_id
  WHERE a.user_id = v_uid;

  -- ── オーナーパス ──
  SELECT id INTO v_tenant_id FROM ky_tenants WHERE owner_user_id = v_uid;

  IF v_tenant_id IS NOT NULL THEN
    DELETE FROM ky_shifts WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_reservation_pins WHERE reservation_id IN (
      SELECT id FROM ky_reservations WHERE tenant_id = v_tenant_id
    );
    DELETE FROM ky_push_tokens WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_reports WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_reservations WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_casts WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_unlock_windows WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_ai_usage WHERE tenant_id = v_tenant_id;
    -- §45 テナント紐づきテーブル
    DELETE FROM ky_point_transactions WHERE tenant_id = v_tenant_id;
    DELETE FROM ky_faq_logs WHERE tenant_id = v_tenant_id;
    -- Storage
    BEGIN
      DELETE FROM storage.objects
      WHERE bucket_id IN ('ky-cast-photos', 'ky-receipts', 'ky-shift-backgrounds')
        AND (storage.foldername(name))[1] = v_tenant_id::text;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    DELETE FROM ky_tenants WHERE id = v_tenant_id;
  END IF;

  -- ── お客様パス（ポイント履歴） ──
  IF v_customer_ids IS NOT NULL AND array_length(v_customer_ids, 1) > 0 THEN
    DELETE FROM ky_point_transactions WHERE customer_ref = ANY(v_customer_ids);
  END IF;

  -- ── ユーザー共通 ──
  DELETE FROM ky_faq_logs WHERE user_id = v_uid;
  DELETE FROM ky_faq_usage WHERE user_key = v_uid::text;
  DELETE FROM ky_blocks WHERE user_id = v_uid OR blocked_user_id = v_uid;
  DELETE FROM ky_reports WHERE reporter_user_id = v_uid;

  -- ky_customer_accounts / ky_customer_follows は auth.users CASCADE で自動削除
  -- ky_customers.account_id は ON DELETE SET NULL（設計通り＝店側台帳は残る）
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
