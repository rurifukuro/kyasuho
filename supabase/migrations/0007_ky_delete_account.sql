-- ky_delete_account: 認証ユーザー自身のアカウントと全ky_*データをカスケード削除
CREATE OR REPLACE FUNCTION ky_delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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
    DELETE FROM ky_tenants WHERE id = v_tenant_id;
  END IF;

  DELETE FROM ky_blocks WHERE user_id = v_uid OR blocked_user_id = v_uid;
  DELETE FROM ky_reports WHERE reporter_user_id = v_uid;

  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION ky_delete_account() FROM public;
GRANT EXECUTE ON FUNCTION ky_delete_account() TO authenticated;
GRANT EXECUTE ON FUNCTION ky_delete_account() TO service_role;
