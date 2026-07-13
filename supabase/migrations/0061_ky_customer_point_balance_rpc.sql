-- 0061: ky_customer_point_balance RPC（§45 批判的チェック C-2）
--
-- 背景: CustomerPointSection がクライアント側で limit(50) の履歴を SUM していた。
--   51件以上のポイント履歴があるお客様の残高が不正確になる。
--   サーバー側で全件 SUM した残高を返す RPC を追加。
--
-- 呼出し側: authenticated（お客様本人）のみ。
-- 自分に紐づく ky_customers.id → ky_point_transactions.customer_ref で SUM。

CREATE OR REPLACE FUNCTION public.ky_customer_point_balance(
  p_tenant_id uuid
)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
BEGIN
  SELECT coalesce(sum(pt.points), 0) INTO v_balance
  FROM ky_point_transactions pt
  JOIN ky_customers c ON c.id = pt.customer_ref
  JOIN ky_customer_accounts a ON a.id = c.account_id
  WHERE pt.tenant_id = p_tenant_id
    AND a.user_id = auth.uid();

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.ky_customer_point_balance(uuid) FROM public;
REVOKE ALL ON FUNCTION public.ky_customer_point_balance(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ky_customer_point_balance(uuid) TO authenticated;
