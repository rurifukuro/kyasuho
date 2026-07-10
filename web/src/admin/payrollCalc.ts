// web/src/admin/payrollCalc.ts — 給与計算の純関数（SPEC §23・§39改訂・アプリ src/utils/payrollCalc.ts と同式）
//
// §24連携仕様: アプリ・管理Webで同一の計算式を使う。アプリ側原本から型import部分だけ
// 自己完結化してコピーしたもの（関数本体は一字一句同じに保つ）。式を変える時は両方同時に変える。
// 金額は円（int）・勤務時間は分単位（int・小数回避）。

/** 給与計算に必要な設定値（アプリ側 PayrollSettings のサブセット・camelCase）。 */
export type PayrollCalcSettings = {
  baseHourlyRate: number; // 円/時
  nominationBackRate: number; // 円/件
  lateDeduction: number; // 円/回（遅刻控除）
};

/** 'HH:MM'（深夜0時起点・26:00表記なし）→ 分。不正形式は null。 */
export function hhmmToMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 29 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 入店・退店時刻（'HH:MM'）から勤務分数を算出（§23: 分単位・丸めなし）。
 * 退店が入店より小さい場合は日跨ぎ（例 22:00→02:00）とみなし +24h で解釈する。
 * どちらか欠けていれば 0。
 */
export function calcMinutesWorked(checkInAt: string | null, checkOutAt: string | null): number {
  const start = hhmmToMinutes(checkInAt);
  let end = hhmmToMinutes(checkOutAt);
  if (start === null || end === null) return 0;
  if (end < start) end += 24 * 60;
  return end - start;
}

/** 給与計算の入力（1キャスト×1日）。 */
export type PayrollInput = {
  minutesWorked: number;
  nominationCount: number;
  menuBack: number; // §39: Σ(back_each×qty) or 手入力額
  otherBack: number;
  lateCount: number;
};

/** 給与計算の結果（金額内訳）。 */
export type PayrollBreakdown = {
  basePay: number;
  nominationBack: number;
  menuBack: number;
  otherBack: number;
  deductions: number;
  totalPay: number;
};

/**
 * §23 の計算式（§39改訂）:
 *   base_pay        = minutes_worked × base_hourly_rate ÷ 60（円未満切り捨て）
 *   nomination_back = 指名数 × nomination_back_rate
 *   menu_back       = 入力値そのまま（close_order時にサーバーが解決済み or 手入力）
 *   deductions      = 遅刻回数 × late_deduction
 *   total_pay       = base_pay + nomination_back + menu_back + other_back − deductions
 */
export function calcPayroll(settings: PayrollCalcSettings, input: PayrollInput): PayrollBreakdown {
  const basePay = Math.floor((input.minutesWorked * settings.baseHourlyRate) / 60);
  const nominationBack = input.nominationCount * settings.nominationBackRate;
  const deductions = input.lateCount * settings.lateDeduction;
  const totalPay = basePay + nominationBack + input.menuBack + input.otherBack - deductions;
  return {
    basePay,
    nominationBack,
    menuBack: input.menuBack,
    otherBack: input.otherBack,
    deductions,
    totalPay,
  };
}

/** 分 → '8時間30分' 形式の表示文字列用の {hours, minutes} 分解。 */
export function splitMinutes(totalMinutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** 'YYYY-MM'（月キー）→ その月の初日・翌月初日（'YYYY-MM-DD'）。range クエリ用。 */
export function monthRange(yearMonth: string): { from: string; toExclusive: string } {
  const [y = 0, m = 0] = yearMonth.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { from: `${yearMonth}-01`, toExclusive: `${next}-01` };
}
