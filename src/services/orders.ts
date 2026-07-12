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
  set_deadline_at: string | null;
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
    setDeadlineAt: row.set_deadline_at,
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
// AUD-4（0047）: 後続処理（売上集計・在庫sale減算・スタンプ）もRPC内の同一トランザクション。
// クライアントは結果のstampを受け取るだけ＝途中失敗による無音欠落が構造的に起きない。

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

type CloseOrderRpcResult = {
  ok: boolean;
  error?: string;
  subtotal?: number;
  biz_date?: string;
  stamp?: {
    new_stamp_count: number;
    added: number;
    reward_reached: boolean;
    reward_description: string;
  } | null;
} | null;

export async function closeOrder(
  orderId: string,
  tenantId: string,
  input: CloseOrderInput,
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
  const result = data as CloseOrderRpcResult;
  if (!result?.ok) {
    throw new Error(result?.error ?? 'close_order_failed');
  }

  const stamp = result.stamp;
  if (!stamp) return null;
  return {
    newStampCount: stamp.new_stamp_count,
    added: stamp.added,
    rewardReached: stamp.reward_reached,
    rewardDescription: stamp.reward_description,
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

// §39: 指定月のメニューバック合計を「castId|date」→円 のマップで返す
export async function sumMenuBackByMonth(
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
    .select('order_id, cast_id, back_each, qty')
    .in('order_id', orderIds)
    .not('cast_id', 'is', null)
    .not('back_each', 'is', null);
  if (itemErr) throw itemErr;

  const sums = new Map<string, number>();
  for (const row of (items ?? []) as { order_id: string; cast_id: string; back_each: number; qty: number }[]) {
    const bizDate = dateById.get(row.order_id);
    if (!bizDate) continue;
    const key = `${row.cast_id}|${bizDate}`;
    sums.set(key, (sums.get(key) ?? 0) + row.back_each * row.qty);
  }
  return sums;
}

// §25-4 売上自動集計・§47 在庫自動sale減算・§31 スタンプは 0047 で ky_close_order RPC 内へ
// 移設済み（AUD-4）。クライアント側の autoUpsertSales / autoDeductInventory / applyStamp は廃止。
