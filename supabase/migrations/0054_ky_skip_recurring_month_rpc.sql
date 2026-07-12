-- 0054: KA-10 skipRecurringMonth RPC化
-- 2ステップのクライアントmutation（skip INSERT + expense DELETE）を
-- 単一トランザクションに統合し中間不整合を防止する。

create or replace function public.ky_skip_recurring_month(
  p_recurring_id uuid,
  p_expense_id uuid,
  p_month text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_month_first date;
begin
  -- 月文字列→月初日付に正規化
  v_month_first := (p_month || '-01')::date;

  -- オーナー照合: recurring_expenses のテナントが呼び出し元のものか確認
  select re.tenant_id into v_tenant_id
  from ky_recurring_expenses re
  inner join ky_tenants t on t.id = re.tenant_id
  where re.id = p_recurring_id
    and t.owner_user_id = auth.uid();

  if v_tenant_id is null then
    raise exception 'forbidden: not owner of this recurring expense';
  end if;

  -- 経費レコードが同テナントに属することを確認
  if not exists (
    select 1 from ky_expenses
    where id = p_expense_id and tenant_id = v_tenant_id
  ) then
    raise exception 'not_found: expense does not belong to tenant';
  end if;

  -- 1. スキップ記録を upsert
  insert into ky_recurring_expense_skips (recurring_id, month)
  values (p_recurring_id, v_month_first)
  on conflict (recurring_id, month) do nothing;

  -- 2. 具象化された経費レコードを削除
  delete from ky_expenses
  where id = p_expense_id and tenant_id = v_tenant_id;
end;
$$;

revoke execute on function public.ky_skip_recurring_month(uuid, uuid, text) from public;
revoke execute on function public.ky_skip_recurring_month(uuid, uuid, text) from anon;
grant execute on function public.ky_skip_recurring_month(uuid, uuid, text) to authenticated;
