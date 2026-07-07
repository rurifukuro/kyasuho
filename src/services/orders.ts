// src/services/orders.ts — 伝票・明細CRUD＋会計確定（SPEC §25・ky_orders/ky_order_items）

import { supabase } from '../config/supabase';
import type { Order, OrderItem, OrderStatus, PaymentMethod, StampSettings } from '../types';

// ── row → domain 変換 ──

type OrderRow = {
  id: string;
  tenant_id: string;
  biz_date: string;
  seat_no: number | null;
  reservation_id: string | null;
  customer_label: string;
  customer_id: string | null;
  status: OrderStatus;
  opened_at: string;
  closed_at: string | null;
  subtotal: number;
  deposit: number;
  change: number;
  payment_method: PaymentMethod;
  note: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  tenant_id: string;
  menu_item_id: string | null;
  category: string;
  name: string;
  price: number;
  qty: number;
  cast_id: string | null;
};

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    bizDate: row.biz_date,
    seatNo: row.seat_no,
    reservationId: row.reservation_id,
    customerLabel: row.customer_label,
    customerId: row.customer_id,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    subtotal: row.subtotal,
    deposit: row.deposit,
    change: row.change,
    paymentMethod: row.payment_method,
    note: row.note,
  };
}

function rowToOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    tenantId: row.tenant_id,
    menuItemId: row.menu_item_id,
    category: row.category,
    name: row.name,
    price: row.price,
    qty: row.qty,
    castId: row.cast_id,
  };
}

// ── 伝票 ──

export async function fetchOrdersByDate(
  tenantId: string,
  bizDate: string,
): Promise<Order[]> {
  const { data, error } = await supabase
    .from('ky_orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('biz_date', bizDate)
    .order('opened_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as OrderRow[]).map(rowToOrder);
}

export async function fetchOpenOrders(tenantId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('ky_orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as OrderRow[]).map(rowToOrder);
}

export type OpenOrderInput = {
  bizDate: string;
  seatNo?: number | null;
  reservationId?: string | null;
  customerLabel?: string;
};

export async function openOrder(
  tenantId: string,
  input: OpenOrderInput,
): Promise<Order> {
  const { data, error } = await supabase
    .from('ky_orders')
    .insert({
      tenant_id: tenantId,
      biz_date: input.bizDate,
      seat_no: input.seatNo ?? null,
      reservation_id: input.reservationId ?? null,
      customer_label: input.customerLabel ?? '',
      status: 'open',
    })
    .select()
    .single();
  if (error) throw error;
  return rowToOrder(data as OrderRow);
}

export async function updateOrderLabel(
  orderId: string,
  customerLabel: string,
): Promise<void> {
  const { error } = await supabase
    .from('ky_orders')
    .update({ customer_label: customerLabel })
    .eq('id', orderId);
  if (error) throw error;
}

export async function voidOrder(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('ky_orders')
    .update({ status: 'void' })
    .eq('id', orderId);
  if (error) throw error;
}

// ── 明細 ──

export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('ky_order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at');
  if (error) throw error;
  return ((data ?? []) as OrderItemRow[]).map(rowToOrderItem);
}

export type AddItemInput = {
  tenantId: string;
  menuItemId: string | null;
  category: string;
  name: string;
  price: number;
  qty: number;
  castId: string | null;
};

export async function addOrderItem(
  orderId: string,
  input: AddItemInput,
): Promise<OrderItem> {
  const { data, error } = await supabase
    .from('ky_order_items')
    .insert({
      order_id: orderId,
      tenant_id: input.tenantId,
      menu_item_id: input.menuItemId,
      category: input.category,
      name: input.name,
      price: input.price,
      qty: input.qty,
      cast_id: input.castId,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToOrderItem(data as OrderItemRow);
}

export async function updateOrderItemQty(
  itemId: string,
  qty: number,
): Promise<void> {
  const { error } = await supabase
    .from('ky_order_items')
    .update({ qty })
    .eq('id', itemId);
  if (error) throw error;
}

export async function deleteOrderItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('ky_order_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

// ── 会計確定（closeOrder）＝§25-3 ステップ6・§25-4 売上自動集計・§32-2 集約ポイント ──
// FIN-3（§33-1）: subtotal はサーバー RPC ky_close_order が sum(price*qty) で再計算。
// クライアント計算値は表示用のみ＝改ざんクライアント対策。

export type CloseOrderInput = {
  subtotal: number;
  deposit: number;
  change: number;
  paymentMethod: PaymentMethod;
  note?: string;
  customerId?: string | null;
};

export type StampResult = {
  newStampCount: number;
  added: number;
  rewardReached: boolean;
  rewardDescription: string;
} | null;

export async function closeOrder(
  orderId: string,
  tenantId: string,
  input: CloseOrderInput,
  _items: OrderItem[],
): Promise<StampResult> {
  const { data, error: rpcErr } = await supabase.rpc('ky_close_order', {
    p_order_id: orderId,
    p_tenant_id: tenantId,
    p_deposit: input.deposit,
    p_change: input.change,
    p_payment_method: input.paymentMethod,
    p_note: input.note ?? '',
    p_customer_id: input.customerId ?? null,
  });
  if (rpcErr) throw rpcErr;
  const result = data as { ok: boolean; error?: string; subtotal?: number } | null;
  if (!result?.ok) {
    throw new Error(result?.error ?? 'close_order_failed');
  }

  const bizDateRes = await supabase
    .from('ky_orders')
    .select('biz_date')
    .eq('id', orderId)
    .single();
  if (bizDateRes.error) throw bizDateRes.error;
  const bizDate = (bizDateRes.data as { biz_date: string }).biz_date;

  await autoUpsertSales(tenantId, bizDate);

  const stampResult = await applyStamp(tenantId, input.customerId ?? null);
  return stampResult;
}

async function applyStamp(
  tenantId: string,
  customerId: string | null,
): Promise<StampResult> {
  if (!customerId) return null;

  const { data: settingsRow } = await supabase
    .from('ky_stamp_settings')
    .select('stamps_per_visit, reward_threshold, reward_description, is_active')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settings = settingsRow as {
    stamps_per_visit: number;
    reward_threshold: number;
    reward_description: string;
    is_active: boolean;
  } | null;

  if (!settings || !settings.is_active) {
    const { data: cRow } = await supabase
      .from('ky_customers')
      .select('total_visits')
      .eq('id', customerId)
      .single();
    const currentVisits = (cRow as { total_visits: number } | null)?.total_visits ?? 0;
    await supabase
      .from('ky_customers')
      .update({
        total_visits: currentVisits + 1,
        last_visit_date: new Date().toISOString().slice(0, 10),
      })
      .eq('id', customerId);
    return null;
  }

  const { data: cRow } = await supabase
    .from('ky_customers')
    .select('stamp_count, total_visits')
    .eq('id', customerId)
    .single();
  if (!cRow) return null;

  const prev = (cRow as { stamp_count: number; total_visits: number });
  const added = settings.stamps_per_visit;
  const newCount = prev.stamp_count + added;
  const rewardReached = settings.reward_threshold > 0 &&
    prev.stamp_count < settings.reward_threshold &&
    newCount >= settings.reward_threshold;

  await supabase
    .from('ky_customers')
    .update({
      stamp_count: newCount,
      total_visits: prev.total_visits + 1,
      last_visit_date: new Date().toISOString().slice(0, 10),
    })
    .eq('id', customerId);

  return {
    newStampCount: newCount,
    added,
    rewardReached,
    rewardDescription: settings.reward_description,
  };
}

// §25-5: 指定月のキャストドリンク数を「castId|date」→杯数 のマップで返す
export async function countCastDrinksByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<Map<string, number>> {
  const [y, m] = yearMonth.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const toExclusive = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

  const { data: orders, error: ordErr } = await supabase
    .from('ky_orders')
    .select('id, biz_date')
    .eq('tenant_id', tenantId)
    .gte('biz_date', from)
    .lt('biz_date', toExclusive)
    .eq('status', 'closed');
  if (ordErr) throw ordErr;
  if (!orders || orders.length === 0) return new Map();

  const orderIds = (orders as { id: string; biz_date: string }[]).map((o) => o.id);
  const dateById = new Map((orders as { id: string; biz_date: string }[]).map((o) => [o.id, o.biz_date]));

  const { data: items, error: itemErr } = await supabase
    .from('ky_order_items')
    .select('order_id, cast_id, qty')
    .in('order_id', orderIds)
    .eq('category', 'cast_drink')
    .not('cast_id', 'is', null);
  if (itemErr) throw itemErr;

  const counts = new Map<string, number>();
  for (const row of (items ?? []) as { order_id: string; cast_id: string; qty: number }[]) {
    const bizDate = dateById.get(row.order_id);
    if (!bizDate) continue;
    const key = `${row.cast_id}|${bizDate}`;
    counts.set(key, (counts.get(key) ?? 0) + row.qty);
  }
  return counts;
}

// §25-4: その営業日の closed 伝票を再集計して ky_sales に upsert（entry_mode='auto'）
async function autoUpsertSales(
  tenantId: string,
  bizDate: string,
): Promise<void> {
  const existing = await supabase
    .from('ky_sales')
    .select('entry_mode')
    .eq('tenant_id', tenantId)
    .eq('date', bizDate)
    .maybeSingle();
  if (existing.data && (existing.data as { entry_mode: string }).entry_mode === 'manual') {
    return;
  }

  const { data: closedOrders, error: ordErr } = await supabase
    .from('ky_orders')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('biz_date', bizDate)
    .eq('status', 'closed');
  if (ordErr) throw ordErr;

  const orderIds = ((closedOrders ?? []) as { id: string }[]).map((o) => o.id);
  if (orderIds.length === 0) return;

  const { data: allItems, error: itemErr } = await supabase
    .from('ky_order_items')
    .select('category, price, qty')
    .in('order_id', orderIds);
  if (itemErr) throw itemErr;

  let totalRevenue = 0;
  let setCount = 0;
  let drinkCount = 0;
  let nominationCount = 0;
  let otherRevenue = 0;

  for (const item of (allItems ?? []) as { category: string; price: number; qty: number }[]) {
    const lineTotal = item.price * item.qty;
    totalRevenue += lineTotal;
    switch (item.category) {
      case 'set':
      case 'extension':
        setCount += item.qty;
        break;
      case 'drink':
      case 'cast_drink':
        drinkCount += item.qty;
        break;
      case 'nomination':
        nominationCount += item.qty;
        break;
      case 'discount':
        break;
      default:
        otherRevenue += lineTotal;
        break;
    }
  }

  const { error: upsertErr } = await supabase.from('ky_sales').upsert(
    {
      tenant_id: tenantId,
      date: bizDate,
      total_revenue: totalRevenue,
      set_count: setCount,
      drink_count: drinkCount,
      nomination_count: nominationCount,
      other_revenue: otherRevenue,
      entry_mode: 'auto',
    },
    { onConflict: 'tenant_id,date' },
  );
  if (upsertErr) throw upsertErr;
}
