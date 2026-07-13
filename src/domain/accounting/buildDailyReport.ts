export type ClosedOrderInput = {
  subtotal: number;
  paymentMethod: string;
  castIds: string[];
  guestCount: number;
};

export type DailyReportSummary = {
  totalRevenue: number;
  orderCount: number;
  guestCount: number;
  cashExpected: number;
  castSummary: { castId: string; orderCount: number; revenue: number }[];
};

export function buildDailyReport(
  closedOrders: ClosedOrderInput[],
): DailyReportSummary {
  let totalRevenue = 0;
  let cashExpected = 0;
  const castMap = new Map<string, { orderCount: number; revenue: number }>();

  for (const o of closedOrders) {
    totalRevenue += o.subtotal;
    if (o.paymentMethod === 'cash') cashExpected += o.subtotal;
    for (const cid of o.castIds) {
      const cur = castMap.get(cid) ?? { orderCount: 0, revenue: 0 };
      cur.orderCount += 1;
      cur.revenue += o.subtotal;
      castMap.set(cid, cur);
    }
  }

  const castSummary = Array.from(castMap.entries()).map(([castId, v]) => ({
    castId,
    orderCount: v.orderCount,
    revenue: v.revenue,
  }));

  return {
    totalRevenue,
    orderCount: closedOrders.length,
    guestCount: closedOrders.reduce((sum, o) => sum + o.guestCount, 0),
    cashExpected,
    castSummary,
  };
}
