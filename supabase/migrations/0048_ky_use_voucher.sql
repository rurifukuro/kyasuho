-- 0048: 回数券・チェキ券の使用をatomic decrement化（§51 AUD-5・BE-5）
-- 旧実装はクライアントが remaining_count を読んで -1 を書き戻す read-modify-write
-- （src/services/vouchers.ts / web/src/admin/adminApi.ts の useVoucher）＝2端末同時操作で
-- 片方の使用記録が消える（ロスト更新）。本RPCは WHERE remaining_count > 0 つきの
-- `remaining_count = remaining_count - 1` 1文で減算＝競合しても残数が負にならず更新も消えない。
-- ※有効期限チェックは従来どおりUI側の責務のまま（本Revは原子性のみの是正＝挙動不変）。
-- ※スタンプ側（applyStamp）のatomic化は 0047 の ky_close_order v3 に統合済み（Rev118）。

create or replace function public.ky_use_voucher(
  p_voucher_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
begin
  update ky_vouchers v
     set remaining_count = v.remaining_count - 1
   where v.id = p_voucher_id
     and v.is_active
     and v.remaining_count > 0
     and exists (
       select 1 from ky_tenants t
        where t.id = v.tenant_id
          and t.owner_user_id = auth.uid()
     )
  returning v.remaining_count into v_remaining;

  if not found then
    -- 存在しない／他テナント／無効化済み／残数0（同時操作の負け側もここ）
    return jsonb_build_object('ok', false, 'error', 'not_usable');
  end if;

  return jsonb_build_object('ok', true, 'remaining_count', v_remaining);
end;
$$;

revoke execute on function public.ky_use_voucher(uuid) from public, anon;
grant execute on function public.ky_use_voucher(uuid) to authenticated;
