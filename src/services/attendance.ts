// src/services/attendance.ts — 勤怠記録の取得・保存（SPEC §3-H・§23／ky_attendance）
//
// ky_shifts（出勤予定）とは別テーブル＝こちらは実績。キャスト×日付で1行（unique(cast_id, date)）。

import { supabase } from '../config/supabase';
import type { Attendance, AttendanceReasonCategory, AttendanceStatus } from '../types';
import { monthRange } from '../utils/payrollCalc';

type AttendanceRow = {
  id: string;
  tenant_id: string;
  cast_id: string;
  date: string;
  status: AttendanceStatus;
  reason_category: AttendanceReasonCategory;
  reason_note: string;
  substitute_cast_id: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  note: string;
  edited_by_owner: boolean;
};

function rowToAttendance(row: AttendanceRow): Attendance {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    castId: row.cast_id,
    date: row.date,
    status: row.status,
    reasonCategory: row.reason_category,
    reasonNote: row.reason_note,
    substituteCastId: row.substitute_cast_id,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    note: row.note,
    editedByOwner: row.edited_by_owner,
  };
}

/** 指定月（'YYYY-MM'）の勤怠を日付昇順で取得。 */
export async function fetchAttendanceByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<Attendance[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_attendance')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date');
  if (error) throw error;
  return ((data ?? []) as AttendanceRow[]).map(rowToAttendance);
}

/** 指定日の勤怠を取得。 */
export async function fetchAttendanceByDate(
  tenantId: string,
  date: string,
): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('ky_attendance')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('date', date);
  if (error) throw error;
  return ((data ?? []) as AttendanceRow[]).map(rowToAttendance);
}

export type AttendanceInput = {
  status: AttendanceStatus;
  reasonCategory: AttendanceReasonCategory;
  reasonNote: string;
  substituteCastId: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string;
};

/** 勤怠を upsert（キャスト×日付で1行＝unique(cast_id, date)）。 */
export async function upsertAttendance(
  tenantId: string,
  castId: string,
  date: string,
  input: AttendanceInput,
): Promise<void> {
  const { error } = await supabase.from('ky_attendance').upsert(
    {
      tenant_id: tenantId,
      cast_id: castId,
      date,
      status: input.status,
      reason_category: input.reasonCategory,
      reason_note: input.reasonNote,
      substitute_cast_id: input.substituteCastId,
      check_in_at: input.checkInAt,
      check_out_at: input.checkOutAt,
      note: input.note,
    },
    { onConflict: 'cast_id,date' },
  );
  if (error) throw error;
}

/** 勤怠記録を削除（未記録状態に戻す）。 */
export async function deleteAttendance(id: string): Promise<void> {
  const { error } = await supabase.from('ky_attendance').delete().eq('id', id);
  if (error) throw error;
}
