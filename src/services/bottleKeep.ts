import { supabase } from '../config/supabase';
import type { BottleKeep } from '../types';

type Row = {
  id: string;
  tenant_id: string;
  customer_name: string;
  item_name: string;
  start_date: string;
  expiry_date: string | null;
  remaining: string;
  note: string;
  is_active: boolean;
  created_at: string;
};

function rowTo(r: Row): BottleKeep {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    customerName: r.customer_name,
    itemName: r.item_name,
    startDate: r.start_date,
    expiryDate: r.expiry_date,
    remaining: r.remaining,
    note: r.note,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

export async function fetchBottleKeeps(tenantId: string): Promise<BottleKeep[]> {
  const { data, error } = await supabase
    .from('ky_bottle_keeps')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as Row[] | null) ?? []).map(rowTo);
}

export async function addBottleKeep(
  tenantId: string,
  input: {
    customerName: string;
    itemName: string;
    startDate: string;
    expiryDate: string | null;
    remaining: string;
    note: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_bottle_keeps').insert({
    tenant_id: tenantId,
    customer_name: input.customerName,
    item_name: input.itemName,
    start_date: input.startDate,
    expiry_date: input.expiryDate || null,
    remaining: input.remaining,
    note: input.note,
  });
  if (error) throw error;
}

export async function updateBottleKeep(
  id: string,
  fields: Partial<{
    customerName: string;
    itemName: string;
    startDate: string;
    expiryDate: string | null;
    remaining: string;
    note: string;
    isActive: boolean;
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.customerName !== undefined) payload.customer_name = fields.customerName;
  if (fields.itemName !== undefined) payload.item_name = fields.itemName;
  if (fields.startDate !== undefined) payload.start_date = fields.startDate;
  if (fields.expiryDate !== undefined) payload.expiry_date = fields.expiryDate;
  if (fields.remaining !== undefined) payload.remaining = fields.remaining;
  if (fields.note !== undefined) payload.note = fields.note;
  if (fields.isActive !== undefined) payload.is_active = fields.isActive;
  const { error } = await supabase.from('ky_bottle_keeps').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteBottleKeep(id: string): Promise<void> {
  const { error } = await supabase.from('ky_bottle_keeps').delete().eq('id', id);
  if (error) throw error;
}
