import { supabase } from '../config/supabase';
import type { RecurringExpense, ExpenseCategory } from '../types';

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

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function monthFirstDay(ym: string): string {
  return `${ym}-01`;
}

function enumMonths(startYm: string, endYm: string): string[] {
  const result: string[] = [];
  const [sy, sm] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${pad2(m)}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
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

  const toInsert: {
    tenant_id: string;
    date: string;
    category: string;
    amount: number;
    memo: string;
    source_recurring_id: string;
  }[] = [];

  for (const t of active) {
    const startYm = t.startMonth.substring(0, 7);
    const endYm = t.endMonth ? t.endMonth.substring(0, 7) : upToYm;
    const effectiveEnd = endYm <= upToYm ? endYm : upToYm;

    for (const ym of enumMonths(startYm, effectiveEnd)) {
      const key = `${t.id}:${ym}`;
      if (existingSet.has(key) || skipSet.has(key)) continue;

      const [yy, mm] = ym.split('-').map(Number);
      const lastDay = new Date(yy, mm, 0).getDate();
      const day = Math.min(t.dayOfMonth, lastDay);
      const dateStr = `${ym}-${pad2(day)}`;

      toInsert.push({
        tenant_id: tenantId,
        date: dateStr,
        category: t.category,
        amount: t.amount,
        memo: t.name,
        source_recurring_id: t.id,
      });
    }
  }

  if (toInsert.length === 0) return 0;

  const { error: insertErr } = await supabase
    .from('ky_expenses')
    .insert(toInsert);
  if (insertErr) throw insertErr;

  return toInsert.length;
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
