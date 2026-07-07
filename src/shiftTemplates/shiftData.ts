// web/src/shiftTemplates/shiftData.ts — シフト表描画用データ集計の純関数（SPEC §22）
//
// ★このファイルはアプリ側 src/shiftTemplates/shiftData.ts と同一内容を保つ（Web側が正準）。
//   Supabase・React 非依存の純関数のみ。入力はプラットフォーム側でフラット行に写してから渡す。

/** 1件の出勤（プラットフォーム非依存のフラット行） */
export type ShiftFlatRow = {
  date: string; // 'YYYY-MM-DD'
  castName: string;
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  photoUrl?: string | null;
};

export type ShiftCastEntry = { name: string; start: string; end: string; photoUrl?: string | null };

/** 1日ぶんの出勤リスト */
export type ShiftDayData = { date: string; casts: ShiftCastEntry[] };

/**
 * フラット行 → 日別データへ集計（対象月のみ・date昇順・同日内は start→name 順）。
 * 出勤が1件もない日は含めない（レンダラー側で空日を描く）。
 */
export function buildShiftDays(rows: ShiftFlatRow[], yearMonth: string): ShiftDayData[] {
  const byDate = new Map<string, ShiftCastEntry[]>();
  for (const r of rows) {
    if (!r.date.startsWith(`${yearMonth}-`)) continue;
    const list = byDate.get(r.date) ?? [];
    list.push({ name: r.castName, start: r.start, end: r.end, photoUrl: r.photoUrl });
    byDate.set(r.date, list);
  }
  const days: ShiftDayData[] = [];
  for (const [date, casts] of byDate) {
    casts.sort((a, b) => (a.start === b.start ? a.name.localeCompare(b.name, 'ja') : a.start < b.start ? -1 : 1));
    days.push({ date, casts });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return days;
}

/** 'YYYY-MM' → 月の日数 */
export function daysInMonth(yearMonth: string): number {
  const [y = 0, m = 0] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** 'YYYY-MM' → 月初の曜日（0=日曜） */
export function firstDayOffset(yearMonth: string): number {
  const [y = 0, m = 0] = yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).getDay();
}

/** 'YYYY-MM-DD' → 曜日（0=日曜） */
export function weekdayOf(date: string): number {
  const [y = 0, m = 0, d = 0] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 'YYYY-MM' → 'YYYY年M月' */
export function yearMonthLabel(yearMonth: string): string {
  const [y = 0, m = 0] = yearMonth.split('-').map(Number);
  return `${y}年${m}月`;
}
