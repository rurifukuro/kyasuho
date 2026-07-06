import { supabase } from '../config/supabase';
import type { SeatType } from '../types';

type SeatTypeRow = {
  id: string;
  tenant_id: string;
  name: string;
  seat_fee: number;
  sort_order: number;
  is_active: boolean;
};

function rowToSeatType(r: SeatTypeRow): SeatType {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    seatFee: r.seat_fee,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  };
}

export async function fetchSeatTypes(tenantId: string): Promise<SeatType[]> {
  const { data, error } = await supabase
    .from('ky_seat_types')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return ((data ?? []) as SeatTypeRow[]).map(rowToSeatType);
}

export async function addSeatType(
  tenantId: string,
  name: string,
  seatFee: number,
): Promise<SeatType> {
  const { data: maxRow } = await supabase
    .from('ky_seat_types')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('ky_seat_types')
    .insert({ tenant_id: tenantId, name, seat_fee: seatFee, sort_order: nextOrder })
    .select()
    .single();
  if (error) throw error;
  return rowToSeatType(data as SeatTypeRow);
}

export async function updateSeatType(
  id: string,
  fields: Partial<{ name: string; seatFee: number; sortOrder: number; isActive: boolean }>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (fields.name !== undefined) updates.name = fields.name;
  if (fields.seatFee !== undefined) updates.seat_fee = fields.seatFee;
  if (fields.sortOrder !== undefined) updates.sort_order = fields.sortOrder;
  if (fields.isActive !== undefined) updates.is_active = fields.isActive;
  const { error } = await supabase.from('ky_seat_types').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteSeatType(id: string): Promise<void> {
  const { error } = await supabase.from('ky_seat_types').delete().eq('id', id);
  if (error) throw error;
}
