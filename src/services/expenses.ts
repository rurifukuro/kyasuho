import { supabase } from '../config/supabase';
import type { Expense, ExpenseCategory } from '../types';

type ExpenseRow = {
  id: string;
  tenant_id: string;
  date: string;
  category: string;
  amount: number;
  memo: string;
};

function rowToExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    date: r.date,
    category: r.category as ExpenseCategory,
    amount: r.amount,
    memo: r.memo,
  };
}

export async function fetchExpenses(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('ky_expenses')
    .select('id, tenant_id, date, category, amount, memo')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  if (error) throw error;
  return ((data as ExpenseRow[] | null) ?? []).map(rowToExpense);
}

export async function addExpense(
  tenantId: string,
  date: string,
  category: ExpenseCategory,
  amount: number,
  memo: string,
): Promise<Expense> {
  const { data, error } = await supabase
    .from('ky_expenses')
    .insert({ tenant_id: tenantId, date, category, amount, memo })
    .select('id, tenant_id, date, category, amount, memo')
    .single();
  if (error) throw error;
  return rowToExpense(data as ExpenseRow);
}

export async function updateExpense(
  id: string,
  fields: { date?: string; category?: ExpenseCategory; amount?: number; memo?: string },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.date !== undefined) payload.date = fields.date;
  if (fields.category !== undefined) payload.category = fields.category;
  if (fields.amount !== undefined) payload.amount = fields.amount;
  if (fields.memo !== undefined) payload.memo = fields.memo;
  payload.updated_at = new Date().toISOString();
  const { error } = await supabase.from('ky_expenses').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('ky_expenses').delete().eq('id', id);
  if (error) throw error;
}
