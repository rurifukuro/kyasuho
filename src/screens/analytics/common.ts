// src/screens/analytics/common.ts — 分析タブ（売上/給与/勤怠）3ビューの共有型・ヘルパー

import type { Tenant, ThemeColor } from '../../types';
import type { TKey } from '../../i18n';

import { WEEKDAYS, pad2, dayLabel } from '../../utils/dateFormat';
export { WEEKDAYS, pad2, dayLabel };

export type TFunc = (key: TKey, params?: Record<string, string>) => string;

/** AnalyticsScreen（コンテナ）から各ビューへ渡す共通 props。 */
export type AnalyticsViewProps = {
  tenant: Tenant;
  theme: ThemeColor;
  t: TFunc;
  yearMonth: string; // 'YYYY-MM'
};

/** 円表示（¥12,345）。 */
export function formatYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

/** 'YYYY-MM' → その月の全日付（'YYYY-MM-DD'・1日〜末日）。 */
export function monthDates(yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const list: string[] = [];
  for (let d = 1; d <= days; d++) {
    list.push(`${yearMonth}-${pad2(d)}`);
  }
  return list;
}

/** 今日の 'YYYY-MM-DD'。 */
export function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** 今月の 'YYYY-MM'。 */
export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

/** 'YYYY-MM' を delta ヶ月ずらす。 */
export function shiftYearMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
