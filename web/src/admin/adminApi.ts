import { supabase } from '../lib/supabase';
import type {
  KyAttendance,
  KyCast,
  KyCastPayroll,
  KyPayrollSettings,
  KyReservationFull,
  KySales,
  KyShift,
  KyTenant,
  KyUnlockWindow,
  MakeReservationResult,
} from '../lib/types';
import { calcMinutesWorked, calcPayroll, monthRange } from './payrollCalc';
import type { PayrollCalcSettings } from './payrollCalc';

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

// ---- 売上（ky_sales・アプリ src/services/sales.ts と同クエリ） ----

export async function fetchSalesByMonth(tenantId: string, yearMonth: string): Promise<KySales[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_sales')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date');
  if (error) throw error;
  return (data ?? []) as KySales[];
}

export async function upsertSales(
  tenantId: string,
  date: string,
  input: {
    totalRevenue: number;
    setCount: number;
    drinkCount: number;
    nominationCount: number;
    otherRevenue: number;
    note: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_sales').upsert(
    {
      tenant_id: tenantId,
      date,
      total_revenue: input.totalRevenue,
      set_count: input.setCount,
      drink_count: input.drinkCount,
      nomination_count: input.nominationCount,
      other_revenue: input.otherRevenue,
      note: input.note,
    },
    { onConflict: 'tenant_id,date' },
  );
  if (error) throw error;
}

export async function deleteSales(id: string): Promise<void> {
  const { error } = await supabase.from('ky_sales').delete().eq('id', id);
  if (error) throw error;
}

// ---- 勤怠（ky_attendance・アプリ src/services/attendance.ts と同クエリ） ----

export async function fetchAttendanceByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<KyAttendance[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_attendance')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date');
  if (error) throw error;
  return (data ?? []) as KyAttendance[];
}

export async function upsertAttendance(
  tenantId: string,
  castId: string,
  date: string,
  input: {
    status: KyAttendance['status'];
    reasonCategory: KyAttendance['reason_category'];
    reasonNote: string;
    substituteCastId: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    note: string;
  },
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

export async function deleteAttendance(id: string): Promise<void> {
  const { error } = await supabase.from('ky_attendance').delete().eq('id', id);
  if (error) throw error;
}

// ---- 給与（ky_payroll_settings / ky_cast_payroll・アプリ src/services/payroll.ts と同クエリ） ----

/** migration 0009 の default と同じ値（設定未保存テナントの計算に使う）。 */
export const DEFAULT_PAYROLL_SETTINGS: PayrollCalcSettings = {
  baseHourlyRate: 1200,
  nominationBackRate: 300,
  drinkBackRate: 100,
  lateDeduction: 0,
};

export async function fetchPayrollSettings(tenantId: string): Promise<KyPayrollSettings | null> {
  const { data, error } = await supabase
    .from('ky_payroll_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return (data as KyPayrollSettings | null) ?? null;
}

export async function savePayrollSettings(
  tenantId: string,
  input: PayrollCalcSettings,
): Promise<void> {
  const { error } = await supabase.from('ky_payroll_settings').upsert(
    {
      tenant_id: tenantId,
      base_hourly_rate: input.baseHourlyRate,
      nomination_back_rate: input.nominationBackRate,
      drink_back_rate: input.drinkBackRate,
      late_deduction: input.lateDeduction,
    },
    { onConflict: 'tenant_id' },
  );
  if (error) throw error;
}

export async function fetchPayrollByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<KyCastPayroll[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_cast_payroll')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date');
  if (error) throw error;
  return (data ?? []) as KyCastPayroll[];
}

/** 給与明細1行を upsert（キャスト×日付で1行＝unique(cast_id, date)・手修正の保存に使う）。 */
export async function upsertPayroll(
  tenantId: string,
  castId: string,
  date: string,
  input: {
    minutesWorked: number;
    basePay: number;
    nominationCount: number;
    nominationBack: number;
    drinkCount: number;
    drinkBack: number;
    otherBack: number;
    deductions: number;
    totalPay: number;
    note: string;
  },
): Promise<void> {
  const { error } = await supabase.from('ky_cast_payroll').upsert(
    {
      tenant_id: tenantId,
      cast_id: castId,
      date,
      minutes_worked: input.minutesWorked,
      base_pay: input.basePay,
      nomination_count: input.nominationCount,
      nomination_back: input.nominationBack,
      drink_count: input.drinkCount,
      drink_back: input.drinkBack,
      other_back: input.otherBack,
      deductions: input.deductions,
      total_pay: input.totalPay,
      note: input.note,
    },
    { onConflict: 'cast_id,date' },
  );
  if (error) throw error;
}

export async function deletePayroll(id: string): Promise<void> {
  const { error } = await supabase.from('ky_cast_payroll').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 指定月の指名数を「castId|date」→件数 のマップで返す（§23）。
 * キャンセル済み予約は数えない（no_show は「予約は入っていた」ため数える）。
 */
export async function countNominationsByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<Map<string, number>> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_reservations')
    .select('cast_id, date')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .not('cast_id', 'is', null)
    .neq('status', 'cancelled');
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { cast_id: string; date: string }[]) {
    const key = `${row.cast_id}|${row.date}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** 給与行を生成する出勤扱いステータス（absent は生成しない）。 */
const WORKED_STATUSES: ReadonlySet<string> = new Set([
  'present',
  'late',
  'early_leave',
  'substitute',
]);

/**
 * 当月の勤怠実績から給与明細を自動生成する（アプリ側 generatePayrollFromAttendance と同ロジック）。
 * - 出勤扱い（present/late/early_leave/substitute）の勤怠だけが対象
 * - 勤務分数＝入退店時刻から算出（未入力は0＝あとで手修正）
 * - 指名数＝ky_reservations から自動集計
 * - **既に明細がある（castId×date）日はスキップ**＝手修正を上書きしない
 * 戻り値＝新規作成した行数。
 */
export async function generatePayrollFromAttendance(
  tenantId: string,
  yearMonth: string,
  attendance: KyAttendance[],
  settings: PayrollCalcSettings,
): Promise<number> {
  const existing = await fetchPayrollByMonth(tenantId, yearMonth);
  const existingKeys = new Set(existing.map((p) => `${p.cast_id}|${p.date}`));
  const nominations = await countNominationsByMonth(tenantId, yearMonth);

  const rows = attendance
    .filter((a) => WORKED_STATUSES.has(a.status))
    .filter((a) => !existingKeys.has(`${a.cast_id}|${a.date}`))
    .map((a) => {
      const minutesWorked = calcMinutesWorked(a.check_in_at, a.check_out_at);
      const nominationCount = nominations.get(`${a.cast_id}|${a.date}`) ?? 0;
      const breakdown = calcPayroll(settings, {
        minutesWorked,
        nominationCount,
        drinkCount: 0, // ドリンク数は日別手入力（§23）＝生成時は0
        otherBack: 0,
        lateCount: a.status === 'late' ? 1 : 0,
      });
      return {
        tenant_id: tenantId,
        cast_id: a.cast_id,
        date: a.date,
        minutes_worked: minutesWorked,
        base_pay: breakdown.basePay,
        nomination_count: nominationCount,
        nomination_back: breakdown.nominationBack,
        drink_count: 0,
        drink_back: breakdown.drinkBack,
        other_back: breakdown.otherBack,
        deductions: breakdown.deductions,
        total_pay: breakdown.totalPay,
        note: '',
      };
    });

  if (rows.length === 0) return 0;
  const { error } = await supabase
    .from('ky_cast_payroll')
    .upsert(rows, { onConflict: 'cast_id,date', ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}
