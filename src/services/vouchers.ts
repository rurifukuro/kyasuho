import { supabase } from '../config/supabase';
import type { Voucher, VoucherType } from '../types';

type Row = {
  id: string;
  tenant_id: string;
  voucher_type: string;
  name: string;
  customer_name: string;
  total_count: number;
  remaining_count: number;
  expiry_date: string | null;
  note: string;
  is_active: boolean;
  created_at: string;
};

function rowTo(r: Row): Voucher {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    voucherType: r.voucher_type as VoucherType,
    name: r.name,
    customerName: r.customer_name,
    totalCount: r.total_count,
    remainingCount: r.remaining_count,
    expiryDate: r.expiry_date,
    note: r.note,
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

export async function fetchVouchers(tenantId: string): Promise<Voucher[]> {
  const { data, error } = await supabase
    .from('ky_vouchers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as Row[] | null) ?? []).map(rowTo);
}

export async function addVoucher(
  tenantId: string,
  input: {
    voucherType: VoucherType;
    name: string;
    customerName: string;
    totalCount: number;
    expiryDate: string | null;
    note: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_vouchers').insert({
    tenant_id: tenantId,
    voucher_type: input.voucherType,
    name: input.name,
    customer_name: input.customerName,
    total_count: input.totalCount,
    remaining_count: input.totalCount,
    expiry_date: input.expiryDate || null,
    note: input.note,
  });
  if (error) throw error;
}

export async function updateVoucher(
  id: string,
  fields: Partial<{
    voucherType: VoucherType;
    name: string;
    customerName: string;
    totalCount: number;
    remainingCount: number;
    expiryDate: string | null;
    note: string;
    isActive: boolean;
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.voucherType !== undefined) payload.voucher_type = fields.voucherType;
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.customerName !== undefined) payload.customer_name = fields.customerName;
  if (fields.totalCount !== undefined) payload.total_count = fields.totalCount;
  if (fields.remainingCount !== undefined) payload.remaining_count = fields.remainingCount;
  if (fields.expiryDate !== undefined) payload.expiry_date = fields.expiryDate;
  if (fields.note !== undefined) payload.note = fields.note;
  if (fields.isActive !== undefined) payload.is_active = fields.isActive;
  const { error } = await supabase.from('ky_vouchers').update(payload).eq('id', id);
  if (error) throw error;
}

export async function useVoucher(id: string, currentRemaining: number): Promise<void> {
  if (currentRemaining <= 0) return;
  const { error } = await supabase
    .from('ky_vouchers')
    .update({ remaining_count: currentRemaining - 1 })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteVoucher(id: string): Promise<void> {
  const { error } = await supabase.from('ky_vouchers').delete().eq('id', id);
  if (error) throw error;
}
