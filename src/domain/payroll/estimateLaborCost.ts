// src/domain/payroll/estimateLaborCost.ts — §33 シフト表の見込み人件費概算（純関数）
//
// I/O非依存。シフトデータ＋時給設定から月間の見込み人件費を計算。
// ★正準（§50-3 D-3）。

export type ShiftEntry = {
  start: string;
  end: string;
};

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function shiftMinutes(start: string, end: string): number {
  const s = hhmmToMinutes(start);
  let e = hhmmToMinutes(end);
  if (e <= s) e += 24 * 60;
  return e - s;
}

/**
 * シフト一覧から見込み人件費を概算する。
 *
 *   合計 = Σ(シフト時間分 × 時給 ÷ 60)  （円未満切り捨て）
 *
 * @param shifts - { start: 'HH:MM', end: 'HH:MM' } の配列
 * @param baseHourlyRate - 基本時給（円）
 * @returns { totalMinutes, estimatedCost }
 */
export function estimateLaborCost(
  shifts: ShiftEntry[],
  baseHourlyRate: number,
): { totalMinutes: number; estimatedCost: number } {
  let totalMinutes = 0;
  for (const s of shifts) {
    totalMinutes += shiftMinutes(s.start, s.end);
  }
  const estimatedCost = Math.floor(totalMinutes * baseHourlyRate / 60);
  return { totalMinutes, estimatedCost };
}
