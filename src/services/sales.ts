// src/services/sales.ts — 日別売上の取得・保存（SPEC §3-F・§23／ky_sales）

import { supabase } from '../config/supabase';
import type { DailySales } from '../types';
import { monthRange } from '../utils/payrollCalc';

type SalesRow = {
  id: string;
  tenant_id: string;
  date: string;
  total_revenue: number;
  set_count: number;
  drink_count: number;
  nomination_count: number;
  other_revenue: number;
  note: string;
  entry_mode: 'manual' | 'auto';
};

function rowToSales(row: SalesRow): DailySales {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    date: row.date,
    totalRevenue: row.total_revenue,
    setCount: row.set_count,
    drinkCount: row.drink_count,
    nominationCount: row.nomination_count,
    otherRevenue: row.other_revenue,
    note: row.note,
    entryMode: row.entry_mode,
  };
}

/** 指定月（'YYYY-MM'）の日別売上を日付昇順で取得。 */
export async function fetchSalesByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<DailySales[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_sales')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date');
  if (error) throw error;
  return ((data ?? []) as SalesRow[]).map(rowToSales);
}

export type SalesInput = {
  totalRevenue: number;
  setCount: number;
  drinkCount: number;
  nominationCount: number;
  otherRevenue: number;
  note: string;
};

/** 日別売上を upsert（テナント×日付で1行＝unique(tenant_id, date)）。
 *  手入力時は entry_mode='manual' を明示的にセット（§25-4: auto行の手修正→以後自動更新停止）。 */
export async function upsertSales(
  tenantId: string,
  date: string,
  input: SalesInput,
): Promise<void> {
  const { error } = await supabase.from('ky_sales').upsert(
    {
      tenant_id: tenantId,
      date,
      total_revenue: input.totalRevenue,
      set_count: input.setCount,
      drink_count: input.drinkCount,
      nomination_count: input.nominationCount,
      other_revenue: input.otherRevenue,
      note: input.note,
      entry_mode: 'manual',
    },
    { onConflict: 'tenant_id,date' },
  );
  if (error) throw error;
}

/** 日別売上を削除。 */
export async function deleteSales(id: string): Promise<void> {
  const { error } = await supabase.from('ky_sales').delete().eq('id', id);
  if (error) throw error;
}
