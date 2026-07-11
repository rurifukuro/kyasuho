import { supabase } from '../config/supabase';

export type PunchResult = {
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
};

export async function castPunch(direction: 'in' | 'out'): Promise<PunchResult> {
  const { data, error } = await supabase.rpc('ky_cast_punch', {
    p_direction: direction,
  });
  if (error) throw error;
  const r = data as { date: string; check_in_at: string | null; check_out_at: string | null; status: string };
  return {
    date: r.date,
    checkInAt: r.check_in_at,
    checkOutAt: r.check_out_at,
    status: r.status,
  };
}

export type TodayAttendance = {
  checkInAt: string | null;
  checkOutAt: string | null;
} | null;

export async function fetchTodayAttendance(castId: string): Promise<TodayAttendance> {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  const { data, error } = await supabase
    .from('ky_attendance')
    .select('check_in_at, check_out_at')
    .eq('cast_id', castId)
    .eq('date', dateStr)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { check_in_at: string | null; check_out_at: string | null };
  return { checkInAt: row.check_in_at, checkOutAt: row.check_out_at };
}
