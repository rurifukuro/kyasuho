import { supabase } from '../config/supabase';
import type { RecurringExpense, ExpenseCategory } from '../types';
import { computeMaterializations } from '../domain/expense/computeMaterializations';

type RecurringRow = {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  amount: number;
  day_of_month: number;
  start_month: string;
  end_month: string | null;
  is_active: boolean;
};

function rowToRecurring(r: RecurringRow): RecurringExpense {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    category: r.category as ExpenseCategory,
    amount: r.amount,
    dayOfMonth: r.day_of_month,
    startMonth: r.start_month,
    endMonth: r.end_month,
    isActive: r.is_active,
  };
}

export async function fetchRecurringExpenses(
  tenantId: string,
): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from('ky_recurring_expenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return ((data ?? []) as RecurringRow[]).map(rowToRecurring);
}

export type RecurringExpenseInput = {
  name: string;
  category: ExpenseCategory;
  amount: number;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  isActive: boolean;
};

export async function createRecurringExpense(
  tenantId: string,
  input: RecurringExpenseInput,
): Promise<RecurringExpense> {
  const { data, error } = await supabase
    .from('ky_recurring_expenses')
    .insert({
      tenant_id: tenantId,
      name: input.name,
      category: input.category,
      amount: input.amount,
      day_of_month: input.dayOfMonth,
      start_month: input.startMonth,
      end_month: input.endMonth,
      is_active: input.isActive,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToRecurring(data as RecurringRow);
}

export async function updateRecurringExpense(
  id: string,
  input: Partial<RecurringExpenseInput>,
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.category !== undefined) updates.category = input.category;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.dayOfMonth !== undefined) updates.day_of_month = input.dayOfMonth;
  if (input.startMonth !== undefined) updates.start_month = input.startMonth;
  if (input.endMonth !== undefined) updates.end_month = input.endMonth;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  const { error } = await supabase
    .from('ky_recurring_expenses')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('ky_recurring_expenses')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

function monthFirstDay(ym: string): string {
  return `${ym}-01`;
}

export async function materializeRecurringExpenses(
  tenantId: string,
  upToYm: string,
): Promise<number> {
  const templates = await fetchRecurringExpenses(tenantId);
  const active = templates.filter((t) => t.isActive);
  if (active.length === 0) return 0;

  const { data: existingRows, error: fetchErr } = await supabase
    .from('ky_expenses')
    .select('source_recurring_id, date')
    .eq('tenant_id', tenantId)
    .not('source_recurring_id', 'is', null);
  if (fetchErr) throw fetchErr;

  const existingSet = new Set(
    ((existingRows ?? []) as { source_recurring_id: string; date: string }[]).map(
      (r) => `${r.source_recurring_id}:${r.date.substring(0, 7)}`,
    ),
  );

  const { data: skipRows, error: skipErr } = await supabase
    .from('ky_recurring_expense_skips')
    .select('recurring_id, month');
  if (skipErr) throw skipErr;

  const skipSet = new Set(
    ((skipRows ?? []) as { recurring_id: string; month: string }[]).map(
      (r) => `${r.recurring_id}:${r.month.substring(0, 7)}`,
    ),
  );

  const rows = computeMaterializations(active, existingSet, skipSet, upToYm);
  if (rows.length === 0) return 0;

  const { error: insertErr } = await supabase
    .from('ky_expenses')
    .insert(rows.map(r => ({
      tenant_id: r.tenantId,
      date: r.date,
      category: r.category,
      amount: r.amount,
      memo: r.memo,
      source_recurring_id: r.sourceRecurringId,
    })));
  if (insertErr) throw insertErr;

  return rows.length;
}

export async function skipRecurringMonth(
  recurringId: string,
  expenseId: string,
  month: string,
): Promise<void> {
  const monthFirst = monthFirstDay(month);
  const { error: skipErr } = await supabase
    .from('ky_recurring_expense_skips')
    .upsert(
      { recurring_id: recurringId, month: monthFirst },
      { onConflict: 'recurring_id,month' },
    );
  if (skipErr) throw skipErr;

  const { error: delErr } = await supabase
    .from('ky_expenses')
    .delete()
    .eq('id', expenseId);
  if (delErr) throw delErr;
}
