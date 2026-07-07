import { supabase } from '../config/supabase';
import type { UnlockWindow } from '../types';

type WindowRow = {
  id: string;
  tenant_id: string;
  date: string;
  open_from: string;
  close_at: string | null;
  seats: number;
  set_minutes: number;
};

function rowToWindow(row: WindowRow): UnlockWindow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    date: row.date,
    openFrom: row.open_from,
    closeAt: row.close_at,
    seats: row.seats,
    setMinutes: row.set_minutes,
  };
}

export async function fetchWindows(tenantId: string, date: string): Promise<UnlockWindow[]> {
  const { data, error } = await supabase
    .from('ky_unlock_windows')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .order('open_from');
  if (error) throw error;
  return ((data ?? []) as WindowRow[]).map(rowToWindow);
}

export async function addWindow(
  tenantId: string,
  date: string,
  openFrom: string,
  closeAt: string | null,
  setMinutes: number,
): Promise<void> {
  const { error } = await supabase.from('ky_unlock_windows').insert({
    tenant_id: tenantId,
    date,
    open_from: openFrom,
    close_at: closeAt,
    seats: 0,
    set_minutes: setMinutes,
  });
  if (error) throw error;
}

export async function removeWindow(id: string): Promise<void> {
  const { error } = await supabase.from('ky_unlock_windows').delete().eq('id', id);
  if (error) throw error;
}

export async function updateWindow(
  id: string,
  updates: Partial<Pick<UnlockWindow, 'setMinutes' | 'closeAt'>>,
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.setMinutes !== undefined) payload.set_minutes = updates.setMinutes;
  if (updates.closeAt !== undefined) payload.close_at = updates.closeAt;
  const { error } = await supabase.from('ky_unlock_windows').update(payload).eq('id', id);
  if (error) throw error;
}
