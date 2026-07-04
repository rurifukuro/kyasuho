import { supabase } from '../config/supabase';
import type { Reservation, ReservationStatus } from '../types';

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
  note: string;
  status: ReservationStatus;
  created_at: string;
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
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
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
