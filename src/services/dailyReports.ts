import { supabase } from '../config/supabase';
import type { DailyReport, Order } from '../types';
import { buildDailyReport } from '../domain/accounting/buildDailyReport';

type DailyReportRow = {
  id: string;
  tenant_id: string;
  business_date: string;
  total_revenue: number;
  order_count: number;
  guest_count: number;
  cast_summary: unknown[];
  cash_expected: number;
  cash_actual: number | null;
  cash_diff: number | null;
  memo: string;
  closed_at: string | null;
  closed_by: string | null;
};

function rowToReport(row: DailyReportRow): DailyReport {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    businessDate: row.business_date,
    totalRevenue: row.total_revenue,
    orderCount: row.order_count,
    guestCount: row.guest_count,
    castSummary: row.cast_summary,
    cashExpected: row.cash_expected,
    cashActual: row.cash_actual,
    cashDiff: row.cash_diff,
    memo: row.memo,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
  };
}

export async function fetchDailyReport(
  tenantId: string,
  bizDate: string,
): Promise<DailyReport | null> {
  const { data, error } = await supabase
    .from('ky_daily_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('business_date', bizDate)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToReport(data as DailyReportRow);
}

export async function generateReportSummary(
  tenantId: string,
  bizDate: string,
): Promise<{ totalRevenue: number; orderCount: number; guestCount: number; cashExpected: number; castSummary: { castId: string; orderCount: number; revenue: number }[] }> {
  const { data: ordersData, error: ordErr } = await supabase
    .from('ky_orders')
    .select('id, subtotal, payment_method, guest_count')
    .eq('tenant_id', tenantId)
    .eq('biz_date', bizDate)
    .eq('status', 'closed');
  if (ordErr) throw ordErr;
  const closedOrders = (ordersData ?? []) as { id: string; subtotal: number; payment_method: string; guest_count: number }[];

  const orderIds = closedOrders.map((o) => o.id);
  let castIdsByOrder = new Map<string, string[]>();
  if (orderIds.length > 0) {
    const { data: itemsData, error: itemsErr } = await supabase
      .from('ky_order_items')
      .select('order_id, cast_id')
      .in('order_id', orderIds)
      .not('cast_id', 'is', null);
    if (itemsErr) throw itemsErr;
    for (const row of (itemsData ?? []) as { order_id: string; cast_id: string }[]) {
      const cur = castIdsByOrder.get(row.order_id) ?? [];
      if (!cur.includes(row.cast_id)) cur.push(row.cast_id);
      castIdsByOrder.set(row.order_id, cur);
    }
  }

  const inputs = closedOrders.map((o) => ({
    subtotal: o.subtotal,
    paymentMethod: o.payment_method,
    castIds: castIdsByOrder.get(o.id) ?? [],
    guestCount: o.guest_count ?? 1,
  }));

  return buildDailyReport(inputs);
}

export async function upsertDailyReport(
  tenantId: string,
  bizDate: string,
  summary: {
    totalRevenue: number;
    orderCount: number;
    guestCount: number;
    cashExpected: number;
    castSummary: unknown[];
  },
  cashActual: number,
  memo: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('ky_daily_reports')
    .upsert(
      {
        tenant_id: tenantId,
        business_date: bizDate,
        total_revenue: summary.totalRevenue,
        order_count: summary.orderCount,
        guest_count: summary.guestCount,
        cast_summary: summary.castSummary,
        cash_expected: summary.cashExpected,
        cash_actual: cashActual,
        memo,
        closed_at: new Date().toISOString(),
        closed_by: userId,
      },
      { onConflict: 'tenant_id,business_date' },
    );
  if (error) throw error;
}
