// web/src/domain/payroll/estimateLaborCost.ts — §33 シフト表の見込み人件費概算（純関数）
//
// ★同期元: src/domain/payroll/estimateLaborCost.ts（手修正禁止・同期して更新）

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
