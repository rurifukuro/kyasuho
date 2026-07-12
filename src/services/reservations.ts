import { supabase } from '../config/supabase';
import type { Reservation, ReservationStatus } from '../types';

import type { PreorderItem } from '../types';

type ReservationRow = {
  id: string;
  tenant_id: string;
  date: string;
  slot: string;
  set_minutes: number;
  seat_no: number | null;
  customer_name: string;
  contact: string;
  party_size: number;
  cast_id: string | null;
  seat_type_id: string | null;
  note: string;
  status: ReservationStatus;
  created_at: string;
  preorder: PreorderItem[] | null;
  menu_undecided: boolean;
};

function rowToReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    date: row.date,
    slot: row.slot,
    seatNo: row.seat_no,
    customerName: row.customer_name,
    contact: row.contact,
    partySize: row.party_size,
    castId: row.cast_id,
    seatTypeId: row.seat_type_id,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    preorder: row.preorder ?? null,
    menuUndecided: row.menu_undecided ?? false,
  };
}

export async function fetchReservations(tenantId: string, date: string): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('ky_reservations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .order('slot');
  if (error) throw error;
  return ((data ?? []) as ReservationRow[]).map(rowToReservation);
}

export async function updateStatus(id: string, status: ReservationStatus): Promise<void> {
  const { error } = await supabase
    .from('ky_reservations')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// AUD-8（0047）: checked_in / 取消は管理Webと同じRPCを通す＝伝票自動作成/voidを含むアトミック操作
export async function checkinReservation(reservationId: string, tenantId: string): Promise<{ orderId: string; reused: boolean }> {
  const { data, error } = await supabase.rpc('ky_checkin_reservation', {
    p_reservation_id: reservationId,
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  const result = data as { ok: boolean; error?: string; order_id?: string; reused?: boolean } | null;
  if (!result?.ok) throw new Error(result?.error ?? 'checkin_failed');
  return { orderId: result.order_id!, reused: result.reused ?? false };
}

export async function revertCheckin(reservationId: string, tenantId: string): Promise<{ voidedCount: number; closedCount: number }> {
  const { data, error } = await supabase.rpc('ky_revert_checkin', {
    p_reservation_id: reservationId,
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  const result = data as { ok: boolean; error?: string; voided_count?: number; closed_count?: number } | null;
  if (!result?.ok) throw new Error(result?.error ?? 'revert_failed');
  return { voidedCount: result.voided_count ?? 0, closedCount: result.closed_count ?? 0 };
}

export async function makeReservation(
  tenantId: string,
  date: string,
  slot: string,
  customerName: string,
  contact: string,
  partySize: number,
  castId: string | null,
  note: string,
  pin: string | null,
  seatTypeId?: string | null,
): Promise<{ id: string; seatNo: number }> {
  const { data, error } = await supabase.rpc('ky_make_reservation', {
    p_tenant_id: tenantId,
    p_date: date,
    p_slot: slot,
    p_customer_name: customerName,
    p_contact: contact,
    p_party_size: partySize,
    p_cast_id: castId,
    p_note: note,
    p_pin: pin,
    p_seat_type_id: seatTypeId ?? null,
  });
  if (error) throw error;
  const result = data as { id?: string; seat_no?: number; error?: string };
  if (result.error) throw new Error(result.error);
  return { id: result.id!, seatNo: result.seat_no! };
}

export async function deleteReservation(id: string): Promise<void> {
  const { error } = await supabase
    .from('ky_reservations')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function countNoShowByContact(
  tenantId: string,
  contact: string,
): Promise<number> {
  if (!contact.trim()) return 0;
  const { count, error } = await supabase
    .from('ky_reservations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('contact', contact)
    .eq('status', 'no_show');
  if (error) throw error;
  return count ?? 0;
}
