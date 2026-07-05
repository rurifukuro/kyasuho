import { supabase } from '../lib/supabase';
import type {
  KyCast,
  KyReservationFull,
  KyShift,
  KyTenant,
  KyUnlockWindow,
  MakeReservationResult,
} from '../lib/types';

/** ログイン中ユーザーが所有するテナントを1件取得する（無ければ null）。 */
export async function fetchOwnTenant(): Promise<KyTenant | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('ky_tenants')
    .select('id, slug, name, genre, business_info, is_suspended')
    .eq('owner_user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return (data as KyTenant | null) ?? null;
}

// ---- 予約台帳 ----

export async function fetchAllReservations(
  tenantId: string,
  date: string,
): Promise<KyReservationFull[]> {
  const { data, error } = await supabase
    .from('ky_reservations')
    .select(
      'id, tenant_id, date, slot, set_minutes, seat_no, customer_name, contact, party_size, cast_id, note, status, created_at',
    )
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .order('slot');
  if (error) throw error;
  return (data ?? []) as KyReservationFull[];
}

export async function updateReservationStatus(
  id: string,
  status: KyReservationFull['status'],
): Promise<void> {
  const { error } = await supabase.from('ky_reservations').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function removeReservation(id: string): Promise<void> {
  const { error } = await supabase.from('ky_reservations').delete().eq('id', id);
  if (error) throw error;
}

export async function adminMakeReservation(input: {
  tenantId: string;
  date: string;
  slot: string;
  customerName: string;
  contact: string;
  partySize: number;
  castId: string | null;
  note: string;
}): Promise<MakeReservationResult> {
  const { data, error } = await supabase.rpc('ky_make_reservation', {
    p_tenant_id: input.tenantId,
    p_date: input.date,
    p_slot: input.slot,
    p_customer_name: input.customerName,
    p_contact: input.contact,
    p_party_size: input.partySize,
    p_cast_id: input.castId,
    p_note: input.note,
    p_pin: null,
  });
  if (error) throw error;
  return data as MakeReservationResult;
}

// ---- 受付枠 ----

export async function fetchWindows(tenantId: string, date: string): Promise<KyUnlockWindow[]> {
  const { data, error } = await supabase
    .from('ky_unlock_windows')
    .select('id, tenant_id, date, open_from, close_at, seats, set_minutes')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .order('open_from');
  if (error) throw error;
  return (data ?? []) as KyUnlockWindow[];
}

export async function addWindow(input: {
  tenantId: string;
  date: string;
  openFrom: string;
  closeAt: string | null;
  seats: number;
  setMinutes: number;
}): Promise<void> {
  const { error } = await supabase.from('ky_unlock_windows').insert({
    tenant_id: input.tenantId,
    date: input.date,
    open_from: input.openFrom,
    close_at: input.closeAt,
    seats: input.seats,
    set_minutes: input.setMinutes,
  });
  if (error) throw error;
}

export async function removeWindow(id: string): Promise<void> {
  const { error } = await supabase.from('ky_unlock_windows').delete().eq('id', id);
  if (error) throw error;
}

// ---- キャスト ----

export async function fetchCastList(tenantId: string): Promise<KyCast[]> {
  const { data, error } = await supabase
    .from('ky_casts')
    .select('id, tenant_id, name, photo_url, bio, accepts_nomination, sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return (data ?? []) as KyCast[];
}

export async function addCast(input: {
  tenantId: string;
  name: string;
  bio: string;
  acceptsNomination: boolean;
}): Promise<void> {
  const { error } = await supabase.from('ky_casts').insert({
    tenant_id: input.tenantId,
    name: input.name,
    bio: input.bio,
    accepts_nomination: input.acceptsNomination,
    sns_links: [],
  });
  if (error) throw error;
}

export async function updateCast(
  id: string,
  fields: { name?: string; bio?: string; acceptsNomination?: boolean },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.bio !== undefined) update.bio = fields.bio;
  if (fields.acceptsNomination !== undefined) update.accepts_nomination = fields.acceptsNomination;
  const { error } = await supabase.from('ky_casts').update(update).eq('id', id);
  if (error) throw error;
}

export async function removeCast(id: string): Promise<void> {
  const { error } = await supabase.from('ky_casts').delete().eq('id', id);
  if (error) throw error;
}

// ---- シフト ----

export async function fetchShiftList(tenantId: string, date: string): Promise<KyShift[]> {
  const { data, error } = await supabase
    .from('ky_shifts')
    .select('id, cast_id, date, start_at, end_at')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .order('start_at');
  if (error) throw error;
  return (data ?? []) as KyShift[];
}

export async function addShift(input: {
  tenantId: string;
  castId: string;
  date: string;
  startAt: string;
  endAt: string;
}): Promise<void> {
  const { error } = await supabase.from('ky_shifts').insert({
    tenant_id: input.tenantId,
    cast_id: input.castId,
    date: input.date,
    start_at: input.startAt,
    end_at: input.endAt,
  });
  if (error) throw error;
}

export async function removeShift(id: string): Promise<void> {
  const { error } = await supabase.from('ky_shifts').delete().eq('id', id);
  if (error) throw error;
}
