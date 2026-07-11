import { supabase } from '../config/supabase';
import type { Expense, ExpenseCategory, CustomExpenseCategory } from '../types';

type ExpenseRow = {
  id: string;
  tenant_id: string;
  date: string;
  category: string;
  amount: number;
  memo: string;
  receipt_url: string | null;
  source_recurring_id: string | null;
};

function rowToExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    date: r.date,
    category: r.category as ExpenseCategory,
    amount: r.amount,
    memo: r.memo,
    receiptUrl: r.receipt_url,
    sourceRecurringId: r.source_recurring_id,
  };
}

export async function fetchExpenses(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('ky_expenses')
    .select('id, tenant_id, date, category, amount, memo, receipt_url, source_recurring_id')
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
    .select('id, tenant_id, date, category, amount, memo, receipt_url, source_recurring_id')
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

type CustomCategoryRow = {
  id: string;
  tenant_id: string;
  key: string;
  label: string;
  sort_order: number;
};

export async function fetchCustomCategories(tenantId: string): Promise<CustomExpenseCategory[]> {
  const { data, error } = await supabase
    .from('ky_expense_categories')
    .select('id, tenant_id, key, label, sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order');
  if (error) throw error;
  return ((data as CustomCategoryRow[] | null) ?? []).map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    key: r.key,
    label: r.label,
    sortOrder: r.sort_order,
  }));
}

export async function addCustomCategory(
  tenantId: string,
  key: string,
  label: string,
): Promise<void> {
  const { error } = await supabase
    .from('ky_expense_categories')
    .insert({ tenant_id: tenantId, key, label });
  if (error) throw error;
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const { error } = await supabase.from('ky_expense_categories').delete().eq('id', id);
  if (error) throw error;
}
