import { supabase } from '../config/supabase';
import type { Cast, Shift } from '../types';

type CastRow = {
  id: string;
  tenant_id: string;
  name: string;
  photo_url: string | null;
  sns_links: { label: string; url: string }[];
  bio: string;
  accepts_nomination: boolean;
  sort_order: number;
};

type ShiftRow = {
  id: string;
  tenant_id: string;
  cast_id: string;
  date: string;
  start_at: string;
  end_at: string;
};

function rowToCast(row: CastRow): Cast {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    photoUrl: row.photo_url,
    snsLinks: row.sns_links ?? [],
    bio: row.bio,
    acceptsNomination: row.accepts_nomination,
    sortOrder: row.sort_order,
  };
}

function rowToShift(row: ShiftRow): Shift {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    castId: row.cast_id,
    date: row.date,
    startAt: row.start_at,
    endAt: row.end_at,
  };
}

export async function fetchCasts(tenantId: string): Promise<Cast[]> {
  const { data, error } = await supabase
    .from('ky_casts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return ((data ?? []) as CastRow[]).map(rowToCast);
}

export async function addCast(
  tenantId: string,
  name: string,
  bio: string,
  acceptsNomination: boolean,
  snsLinks: { label: string; url: string }[],
): Promise<Cast> {
  const { data, error } = await supabase
    .from('ky_casts')
    .insert({
      tenant_id: tenantId,
      name,
      bio,
      accepts_nomination: acceptsNomination,
      sns_links: snsLinks,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToCast(data as CastRow);
}

export async function updateCast(
  id: string,
  fields: {
    name?: string;
    bio?: string;
    acceptsNomination?: boolean;
    snsLinks?: { label: string; url: string }[];
    sortOrder?: number;
  },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.bio !== undefined) update.bio = fields.bio;
  if (fields.acceptsNomination !== undefined) update.accepts_nomination = fields.acceptsNomination;
  if (fields.snsLinks !== undefined) update.sns_links = fields.snsLinks;
  if (fields.sortOrder !== undefined) update.sort_order = fields.sortOrder;
  const { error } = await supabase.from('ky_casts').update(update).eq('id', id);
  if (error) throw error;
}

export async function deleteCast(id: string): Promise<void> {
  const { error } = await supabase.from('ky_casts').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchShifts(tenantId: string, date: string): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('ky_shifts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .order('start_at');
  if (error) throw error;
  return ((data ?? []) as ShiftRow[]).map(rowToShift);
}

/** 月内の全出勤を取得（シフト表画像生成用・SPEC §22） */
export async function fetchShiftsByMonth(tenantId: string, yearMonth: string): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('ky_shifts')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', `${yearMonth}-01`)
    .lte('date', `${yearMonth}-31`)
    .order('date')
    .order('start_at');
  if (error) throw error;
  return ((data ?? []) as ShiftRow[]).map(rowToShift);
}

export async function addShift(
  tenantId: string,
  castId: string,
  date: string,
  startAt: string,
  endAt: string,
): Promise<Shift> {
  const { data, error } = await supabase
    .from('ky_shifts')
    .insert({ tenant_id: tenantId, cast_id: castId, date, start_at: startAt, end_at: endAt })
    .select()
    .single();
  if (error) throw error;
  return rowToShift(data as ShiftRow);
}

export async function removeShift(id: string): Promise<void> {
  const { error } = await supabase.from('ky_shifts').delete().eq('id', id);
  if (error) throw error;
}
