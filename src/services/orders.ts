// src/services/orders.ts — 伝票・明細CRUD＋会計確定（SPEC §25・ky_orders/ky_order_items）

import { supabase } from '../config/supabase';
import type { Order, OrderItem, OrderStatus, PaymentMethod } from '../types';

// ── row → domain 変換 ──

type OrderRow = {
  id: string;
  tenant_id: string;
  biz_date: string;
  seat_no: number | null;
  reservation_id: string | null;
  customer_label: string;
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

export type CloseOrderInput = {
  subtotal: number;
  deposit: number;
  change: number;
  paymentMethod: PaymentMethod;
  note?: string;
};

export async function closeOrder(
  orderId: string,
  tenantId: string,
  input: CloseOrderInput,
  items: OrderItem[],
): Promise<void> {
  const { error: closeErr } = await supabase
    .from('ky_orders')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      subtotal: input.subtotal,
      deposit: input.deposit,
      change: input.change,
      payment_method: input.paymentMethod,
      note: input.note ?? '',
    })
    .eq('id', orderId);
  if (closeErr) throw closeErr;

  const bizDateRes = await supabase
    .from('ky_orders')
    .select('biz_date')
    .eq('id', orderId)
    .single();
  if (bizDateRes.error) throw bizDateRes.error;
  const bizDate = (bizDateRes.data as { biz_date: string }).biz_date;

  await autoUpsertSales(tenantId, bizDate);
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
