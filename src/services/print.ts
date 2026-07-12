// src/services/print.ts — 帳票印刷（SPEC §44-1(a)）
//
// expo-print（iOS=AirPrint／Android=Mopria）経由でOS標準印刷ダイアログを表示。
// 各ビューから呼び出し、HTML帳票をレンダリングして印刷する。

import * as Print from 'expo-print';
import type { CastPayroll, DailySales, Expense, Attendance } from '../types';

type PrintOptions = {
  title: string;
  storeName: string;
  yearMonth: string;
};

function baseHtml(title: string, storeName: string, yearMonth: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: sans-serif; font-size: 11px; margin: 12mm; color: #222; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: right; }
  th { background: #f5f5f5; font-weight: bold; text-align: center; }
  td.left { text-align: left; }
  .total-row { font-weight: bold; background: #fafafa; }
  .footer { margin-top: 16px; font-size: 10px; color: #888; }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="meta">${storeName} — ${yearMonth}</div>
${body}
<div class="footer">${storeName} — ${new Date().toLocaleDateString('ja-JP')}</div>
</body>
</html>`;
}

function yen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

/** 給与帳票（月次・キャスト別集計）。 */
export async function printPayroll(
  opts: PrintOptions,
  rows: CastPayroll[],
  castNameById: Map<string, string>,
): Promise<void> {
  type Agg = { name: string; days: number; minutes: number; total: number };
  const map = new Map<string, Agg>();
  for (const r of rows) {
    const agg = map.get(r.castId) ?? { name: castNameById.get(r.castId) ?? r.castId, days: 0, minutes: 0, total: 0 };
    agg.days += 1;
    agg.minutes += r.minutesWorked;
    agg.total += r.totalPay;
    map.set(r.castId, agg);
  }

  const entries = [...map.values()];
  const grandTotal = entries.reduce((s, e) => s + e.total, 0);

  let body = `<table>
<tr><th>キャスト名</th><th>出勤日数</th><th>勤務時間</th><th>月次合計</th></tr>`;
  for (const e of entries) {
    const h = Math.floor(e.minutes / 60);
    const m = e.minutes % 60;
    body += `<tr><td class="left">${e.name}</td><td>${e.days}日</td><td>${h}時間${m}分</td><td>${yen(e.total)}</td></tr>`;
  }
  body += `<tr class="total-row"><td class="left">合計</td><td>${entries.length}名</td><td></td><td>${yen(grandTotal)}</td></tr>`;
  body += `</table>`;

  await Print.printAsync({ html: baseHtml(opts.title, opts.storeName, opts.yearMonth, body) });
}

/** 経費帳票（月次・カテゴリ別集計＋明細）。 */
export async function printExpenses(
  opts: PrintOptions,
  expenses: Expense[],
  categoryLabel: (key: string) => string,
): Promise<void> {
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const byCat = new Map<string, number>();
  for (const e of expenses) {
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  }

  let body = `<h2 style="font-size:13px;margin:8px 0 4px;">カテゴリ別集計</h2>`;
  body += `<table><tr><th>カテゴリ</th><th>金額</th></tr>`;
  for (const [cat, amt] of byCat) {
    body += `<tr><td class="left">${categoryLabel(cat)}</td><td>${yen(amt)}</td></tr>`;
  }
  body += `<tr class="total-row"><td class="left">合計</td><td>${yen(total)}</td></tr></table>`;

  body += `<h2 style="font-size:13px;margin:12px 0 4px;">明細</h2>`;
  body += `<table><tr><th>日付</th><th>カテゴリ</th><th>金額</th><th>摘要</th></tr>`;
  for (const e of expenses) {
    body += `<tr><td>${e.date}</td><td class="left">${categoryLabel(e.category)}</td><td>${yen(e.amount)}</td><td class="left">${e.memo}</td></tr>`;
  }
  body += `</table>`;

  await Print.printAsync({ html: baseHtml(opts.title, opts.storeName, opts.yearMonth, body) });
}

/** 売上帳票（月次・日別一覧）。 */
export async function printSales(
  opts: PrintOptions,
  salesList: DailySales[],
): Promise<void> {
  const total = salesList.reduce((s, d) => s + d.totalRevenue, 0);

  let body = `<table>
<tr><th>日付</th><th>売上</th><th>セット数</th><th>ドリンク</th><th>指名</th><th>その他</th></tr>`;
  for (const d of salesList) {
    body += `<tr><td>${d.date}</td><td>${yen(d.totalRevenue)}</td><td>${d.setCount}</td><td>${d.drinkCount}</td><td>${d.nominationCount}</td><td>${yen(d.otherRevenue)}</td></tr>`;
  }
  body += `<tr class="total-row"><td class="left">合計</td><td>${yen(total)}</td><td></td><td></td><td></td><td></td></tr>`;
  body += `</table>`;

  await Print.printAsync({ html: baseHtml(opts.title, opts.storeName, opts.yearMonth, body) });
}

/** 勤怠帳票（月次・キャスト別集計）。 */
export async function printAttendance(
  opts: PrintOptions,
  records: Attendance[],
  castNameById: Map<string, string>,
): Promise<void> {
  type Agg = { name: string; present: number; late: number; earlyLeave: number; absent: number; substitute: number };
  const map = new Map<string, Agg>();
  for (const r of records) {
    const agg = map.get(r.castId) ?? { name: castNameById.get(r.castId) ?? r.castId, present: 0, late: 0, earlyLeave: 0, absent: 0, substitute: 0 };
    if (r.status === 'present') agg.present++;
    else if (r.status === 'late') agg.late++;
    else if (r.status === 'early_leave') agg.earlyLeave++;
    else if (r.status === 'absent') agg.absent++;
    else if (r.status === 'substitute') agg.substitute++;
    map.set(r.castId, agg);
  }

  const entries = [...map.values()];
  let body = `<table>
<tr><th>キャスト名</th><th>出勤</th><th>遅刻</th><th>早退</th><th>欠勤</th><th>代打</th></tr>`;
  for (const e of entries) {
    body += `<tr><td class="left">${e.name}</td><td>${e.present}</td><td>${e.late}</td><td>${e.earlyLeave}</td><td>${e.absent}</td><td>${e.substitute}</td></tr>`;
  }
  body += `</table>`;

  await Print.printAsync({ html: baseHtml(opts.title, opts.storeName, opts.yearMonth, body) });
}
