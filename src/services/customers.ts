import { supabase } from '../config/supabase';
import type { Customer, StampSettings } from '../types';

type CustomerRow = {
  id: string;
  tenant_id: string;
  name: string;
  name_kana: string;
  contact: string;
  persona_notes: string;
  internal_notes: string;
  is_banned: boolean;
  ban_reason: string;
  stamp_count: number;
  total_visits: number;
  last_visit_date: string | null;
  created_at: string;
};

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    nameKana: row.name_kana,
    contact: row.contact,
    personaNotes: row.persona_notes,
    internalNotes: row.internal_notes,
    isBanned: row.is_banned,
    banReason: row.ban_reason,
    stampCount: row.stamp_count,
    totalVisits: row.total_visits,
    lastVisitDate: row.last_visit_date,
    createdAt: row.created_at,
  };
}

const SELECT_COLS =
  'id, tenant_id, name, name_kana, contact, persona_notes, internal_notes, is_banned, ban_reason, stamp_count, total_visits, last_visit_date, created_at';

export async function fetchCustomers(tenantId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('ky_customers')
    .select(SELECT_COLS)
    .eq('tenant_id', tenantId)
    .order('name_kana')
    .order('name');
  if (error) throw error;
  return ((data ?? []) as CustomerRow[]).map(rowToCustomer);
}

export async function addCustomer(
  tenantId: string,
  input: {
    name: string;
    nameKana: string;
    contact: string;
    personaNotes: string;
    internalNotes: string;
  },
): Promise<Customer> {
  const { data, error } = await supabase
    .from('ky_customers')
    .insert({
      tenant_id: tenantId,
      name: input.name,
      name_kana: input.nameKana,
      contact: input.contact,
      persona_notes: input.personaNotes,
      internal_notes: input.internalNotes,
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw error;
  return rowToCustomer(data as CustomerRow);
}

export async function updateCustomer(
  id: string,
  fields: Partial<{
    name: string;
    nameKana: string;
    contact: string;
    personaNotes: string;
    internalNotes: string;
    isBanned: boolean;
    banReason: string;
    stampCount: number;
    totalVisits: number;
    lastVisitDate: string | null;
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.nameKana !== undefined) payload.name_kana = fields.nameKana;
  if (fields.contact !== undefined) payload.contact = fields.contact;
  if (fields.personaNotes !== undefined) payload.persona_notes = fields.personaNotes;
  if (fields.internalNotes !== undefined) payload.internal_notes = fields.internalNotes;
  if (fields.isBanned !== undefined) payload.is_banned = fields.isBanned;
  if (fields.banReason !== undefined) payload.ban_reason = fields.banReason;
  if (fields.stampCount !== undefined) payload.stamp_count = fields.stampCount;
  if (fields.totalVisits !== undefined) payload.total_visits = fields.totalVisits;
  if (fields.lastVisitDate !== undefined) payload.last_visit_date = fields.lastVisitDate;
  const { error } = await supabase.from('ky_customers').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('ky_customers').delete().eq('id', id);
  if (error) throw error;
}

// ── スタンプ設定 ──

type StampRow = {
  id: string;
  tenant_id: string;
  stamps_per_visit: number;
  reward_threshold: number;
  reward_description: string;
  is_active: boolean;
};

function rowToStamp(row: StampRow): StampSettings {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    stampsPerVisit: row.stamps_per_visit,
    rewardThreshold: row.reward_threshold,
    rewardDescription: row.reward_description,
    isActive: row.is_active,
  };
}

export async function fetchStampSettings(tenantId: string): Promise<StampSettings | null> {
  const { data, error } = await supabase
    .from('ky_stamp_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToStamp(data as StampRow) : null;
}

export async function saveStampSettings(
  tenantId: string,
  input: {
    stampsPerVisit: number;
    rewardThreshold: number;
    rewardDescription: string;
    isActive: boolean;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_stamp_settings').upsert(
    {
      tenant_id: tenantId,
      stamps_per_visit: input.stampsPerVisit,
      reward_threshold: input.rewardThreshold,
      reward_description: input.rewardDescription,
      is_active: input.isActive,
    },
    { onConflict: 'tenant_id' },
  );
  if (error) throw error;
}
