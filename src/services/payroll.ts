// src/services/payroll.ts — 給与設定・キャスト日別給与（SPEC §3-F・§23／ky_payroll_settings・ky_cast_payroll）
//
// 計算式は utils/payrollCalc.ts（純関数・管理Webと同式＝§24）。ここはDB入出力と
// 「勤怠→給与行の自動生成」（§23: 指名数は ky_reservations から自動集計・手修正可）を担う。

import { supabase } from '../config/supabase';
import type { Attendance, CastPayroll, PayrollSettings } from '../types';
import { calcMinutesWorked, calcPayroll, monthRange } from '../utils/payrollCalc';
import { countCastDrinksByMonth } from './orders';

// ── 給与設定（店一律・テナントで1行） ──────────────────────────────

type PayrollSettingsRow = {
  id: string;
  tenant_id: string;
  base_hourly_rate: number;
  nomination_back_rate: number;
  drink_back_rate: number;
  late_deduction: number;
};

/** migration 0009 の default と同じ値（設定未保存テナントの計算に使う）。 */
export const DEFAULT_PAYROLL_SETTINGS: Omit<PayrollSettings, 'id' | 'tenantId'> = {
  baseHourlyRate: 1200,
  nominationBackRate: 300,
  drinkBackRate: 100,
  lateDeduction: 0,
};

function rowToSettings(row: PayrollSettingsRow): PayrollSettings {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    baseHourlyRate: row.base_hourly_rate,
    nominationBackRate: row.nomination_back_rate,
    drinkBackRate: row.drink_back_rate,
    lateDeduction: row.late_deduction,
  };
}

/** 給与設定を取得（未保存なら null）。 */
export async function fetchPayrollSettings(tenantId: string): Promise<PayrollSettings | null> {
  const { data, error } = await supabase
    .from('ky_payroll_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSettings(data as PayrollSettingsRow) : null;
}

export type PayrollSettingsInput = {
  baseHourlyRate: number;
  nominationBackRate: number;
  drinkBackRate: number;
  lateDeduction: number;
};

/** 給与設定を upsert（unique(tenant_id)）。 */
export async function savePayrollSettings(
  tenantId: string,
  input: PayrollSettingsInput,
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

// ── キャスト日別給与 ─────────────────────────────────────────────

type CastPayrollRow = {
  id: string;
  tenant_id: string;
  cast_id: string;
  date: string;
  minutes_worked: number;
  base_pay: number;
  nomination_count: number;
  nomination_back: number;
  drink_count: number;
  drink_back: number;
  other_back: number;
  deductions: number;
  total_pay: number;
  note: string;
};

function rowToPayroll(row: CastPayrollRow): CastPayroll {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    castId: row.cast_id,
    date: row.date,
    minutesWorked: row.minutes_worked,
    basePay: row.base_pay,
    nominationCount: row.nomination_count,
    nominationBack: row.nomination_back,
    drinkCount: row.drink_count,
    drinkBack: row.drink_back,
    otherBack: row.other_back,
    deductions: row.deductions,
    totalPay: row.total_pay,
    note: row.note,
  };
}

/** 指定月（'YYYY-MM'）の給与明細を日付昇順で取得。 */
export async function fetchPayrollByMonth(
  tenantId: string,
  yearMonth: string,
): Promise<CastPayroll[]> {
  const { from, toExclusive } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from('ky_cast_payroll')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', from)
    .lt('date', toExclusive)
    .order('date');
  if (error) throw error;
  return ((data ?? []) as CastPayrollRow[]).map(rowToPayroll);
}

export type PayrollUpsertInput = {
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
};

/** 給与明細1行を upsert（キャスト×日付で1行＝unique(cast_id, date)・手修正の保存に使う）。 */
export async function upsertPayroll(
  tenantId: string,
  castId: string,
  date: string,
  input: PayrollUpsertInput,
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

/** 給与明細1行を削除。 */
export async function deletePayroll(id: string): Promise<void> {
  const { error } = await supabase.from('ky_cast_payroll').delete().eq('id', id);
  if (error) throw error;
}

// ── 指名数の自動集計（§23: ky_reservations・status≠cancelled） ──────

/**
 * 指定月の指名数を「castId|date」→件数 のマップで返す。
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

// ── 勤怠 → 給与行の自動生成（§23） ────────────────────────────────

/** 給与行を生成する出勤扱いステータス（absent は生成しない）。 */
const WORKED_STATUSES: ReadonlySet<string> = new Set([
  'present',
  'late',
  'early_leave',
  'substitute',
]);

/**
 * 当月の勤怠実績から給与明細を自動生成する。
 * - 出勤扱い（present/late/early_leave/substitute）の勤怠だけが対象
 * - 勤務分数＝入退店時刻から算出（未入力は0＝あとで手修正）
 * - 指名数＝ky_reservations から自動集計
 * - **既に明細がある（castId×date）日はスキップ**＝手修正を上書きしない
 * 戻り値＝新規作成した行数。
 */
export async function generatePayrollFromAttendance(
  tenantId: string,
  yearMonth: string,
  attendance: Attendance[],
  settings: Pick<
    PayrollSettings,
    'baseHourlyRate' | 'nominationBackRate' | 'drinkBackRate' | 'lateDeduction'
  >,
): Promise<number> {
  const existing = await fetchPayrollByMonth(tenantId, yearMonth);
  const existingKeys = new Set(existing.map((p) => `${p.castId}|${p.date}`));
  const [nominations, castDrinks] = await Promise.all([
    countNominationsByMonth(tenantId, yearMonth),
    countCastDrinksByMonth(tenantId, yearMonth),
  ]);

  const rows = attendance
    .filter((a) => WORKED_STATUSES.has(a.status))
    .filter((a) => !existingKeys.has(`${a.castId}|${a.date}`))
    .map((a) => {
      const minutesWorked = calcMinutesWorked(a.checkInAt, a.checkOutAt);
      const nominationCount = nominations.get(`${a.castId}|${a.date}`) ?? 0;
      const drinkCount = castDrinks.get(`${a.castId}|${a.date}`) ?? 0;
      const breakdown = calcPayroll(settings, {
        minutesWorked,
        nominationCount,
        drinkCount,
        otherBack: 0,
        lateCount: a.status === 'late' ? 1 : 0,
      });
      return {
        tenant_id: tenantId,
        cast_id: a.castId,
        date: a.date,
        minutes_worked: minutesWorked,
        base_pay: breakdown.basePay,
        nomination_count: nominationCount,
        nomination_back: breakdown.nominationBack,
        drink_count: drinkCount,
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
