import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyExpense, KyTenant } from '../lib/types';
import {
  addExpense,
  deleteExpense,
  fetchExpenses,
  fetchMonthlySalesTotal,
  fetchMonthlyPayrollTotal,
} from './adminApi';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'purchase', label: '仕入（酒・食材）' },
  { key: 'rent', label: '家賃' },
  { key: 'utilities', label: '水道光熱費' },
  { key: 'communication', label: '通信費' },
  { key: 'advertising', label: '広告宣伝費' },
  { key: 'costume', label: '衣装・美装費' },
  { key: 'supplies', label: '消耗品・備品' },
  { key: 'outsourcing', label: '外注・システム利用料' },
  { key: 'misc', label: '雑費' },
];

function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function shiftMonth(ym: string, delta: number): string {
  const parts = ym.split('-').map(Number) as [number, number];
  const d = new Date(parts[0], parts[1] - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function monthRange(ym: string): { start: string; end: string } {
  const parts = ym.split('-').map(Number) as [number, number];
  const lastDay = new Date(parts[0], parts[1], 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${pad2(lastDay)}` };
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

export function AdminExpenses({ tenant }: { tenant: KyTenant }) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [expenses, setExpenses] = useState<KyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesTotal, setSalesTotal] = useState(0);
  const [payrollTotal, setPayrollTotal] = useState(0);

  const [formDate, setFormDate] = useState('');
  const [formCategory, setFormCategory] = useState('purchase');
  const [formAmount, setFormAmount] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { start, end } = useMemo(() => monthRange(yearMonth), [yearMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [exp, sales, payroll] = await Promise.all([
        fetchExpenses(tenant.id, start, end),
        fetchMonthlySalesTotal(tenant.id, start, end),
        fetchMonthlyPayrollTotal(tenant.id, start, end),
      ]);
      setExpenses(exp);
      setSalesTotal(sales);
      setPayrollTotal(payroll);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [tenant.id, start, end]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const expenseTotal = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses],
  );

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return CATEGORIES.filter((c) => map.has(c.key)).map((c) => ({
      key: c.key,
      label: c.label,
      total: map.get(c.key)!,
    }));
  }, [expenses]);

  const netIncome = salesTotal - expenseTotal - payrollTotal;

  const handleAdd = useCallback(
    async (ev: FormEvent) => {
      ev.preventDefault();
      const amt = parseInt(formAmount, 10);
      if (!formDate || isNaN(amt) || amt <= 0) {
        setFormError('日付と金額を正しく入力してください。');
        return;
      }
      setFormBusy(true);
      setFormError(null);
      try {
        await addExpense(tenant.id, formDate, formCategory, amt, formMemo);
        setFormDate('');
        setFormAmount('');
        setFormMemo('');
        await loadData();
      } catch (e) {
        setFormError(String(e));
      } finally {
        setFormBusy(false);
      }
    },
    [tenant.id, formDate, formCategory, formAmount, formMemo, loadData],
  );

  const handleDelete = useCallback(
    async (exp: KyExpense) => {
      if (!confirm(`${exp.date} ${categoryLabel(exp.category)} ${formatYen(exp.amount)} を削除しますか？`))
        return;
      try {
        await deleteExpense(exp.id);
        await loadData();
      } catch (e) {
        alert(`削除失敗: ${String(e)}`);
      }
    },
    [loadData],
  );

  const handleCsvExport = useCallback(() => {
    const header = '日付,カテゴリ,金額,メモ';
    const rows = expenses.map(
      (e) =>
        `${e.date},${categoryLabel(e.category)},${e.amount},"${e.memo.replace(/"/g, '""')}"`,
    );
    const bom = '﻿';
    const csv = bom + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `経費_${yearMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [expenses, yearMonth]);

  const handleAnnualCsvExport = useCallback(async () => {
    const year = yearMonth.split('-')[0];
    const rows: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${pad2(m)}`;
      const r = monthRange(ym);
      const [exp, sales, payroll] = await Promise.all([
        fetchExpenses(tenant.id, r.start, r.end),
        fetchMonthlySalesTotal(tenant.id, r.start, r.end),
        fetchMonthlyPayrollTotal(tenant.id, r.start, r.end),
      ]);
      const expTotal = exp.reduce((s, e) => s + e.amount, 0);
      const catCols = CATEGORIES.map((c) =>
        exp.filter((e) => e.category === c.key).reduce((s, e) => s + e.amount, 0),
      );
      rows.push([m, sales, expTotal, ...catCols, payroll, sales - expTotal - payroll].join(','));
    }
    const header = [
      '月',
      '総売上',
      '経費計',
      ...CATEGORIES.map((c) => c.label),
      '人件費',
      '差引収支',
    ].join(',');
    const bom = '﻿';
    const csv = bom + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `年次収支_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tenant.id, yearMonth]);

  const [y, m] = yearMonth.split('-');

  return (
    <>
      <h3 className="admin-section-title">
        経費・収支（§27）
      </h3>

      <div className="admin-date-nav">
        <button
          type="button"
          className="admin-btn"
          onClick={() => setYearMonth(shiftMonth(yearMonth, -1))}
        >
          ◀ 前月
        </button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{y}年{Number(m)}月</span>
        <button
          type="button"
          className="admin-btn"
          onClick={() => setYearMonth(shiftMonth(yearMonth, 1))}
        >
          翌月 ▶
        </button>
      </div>

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : error ? (
        <div className="admin-error">{error}</div>
      ) : (
        <>
          {/* 月次収支サマリ */}
          <div
            style={{
              margin: '0 0 16px',
              padding: 16,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>売上</span>
              <strong>{formatYen(salesTotal)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>経費計</span>
              <strong style={{ color: '#dc2626' }}>−{formatYen(expenseTotal)}</strong>
            </div>
            {categoryTotals.map((ct) => (
              <div
                key={ct.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingLeft: 16,
                  fontSize: 13,
                  color: '#6b7280',
                }}
              >
                <span>{ct.label}</span>
                <span>{formatYen(ct.total)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span>人件費（給与計算より自動）</span>
              <strong style={{ color: '#dc2626' }}>−{formatYen(payrollTotal)}</strong>
            </div>
            <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #d1d5db' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>差引収支</strong>
              <strong style={{ color: netIncome >= 0 ? '#16a34a' : '#dc2626', fontSize: 18 }}>
                {netIncome >= 0 ? '' : '−'}{formatYen(Math.abs(netIncome))}
              </strong>
            </div>
          </div>

          {/* 経費入力フォーム */}
          <form className="admin-form" onSubmit={handleAdd}>
            <label>
              日付
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </label>
            <label>
              カテゴリ
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </label>
            <label>
              金額（円）
              <input
                type="number"
                min="1"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                required
              />
            </label>
            <label>
              メモ
              <input
                type="text"
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
                placeholder="仕入先・内容など"
              />
            </label>
            {formError && <div className="admin-error">{formError}</div>}
            <button type="submit" className="admin-btn primary" disabled={formBusy}>
              {formBusy ? '保存中…' : '経費を追加'}
            </button>
          </form>

          {/* CSV出力 */}
          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            <button
              type="button"
              className="admin-btn"
              onClick={handleCsvExport}
              disabled={expenses.length === 0}
            >
              経費CSV
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => void handleAnnualCsvExport()}
            >
              年次収支CSV
            </button>
          </div>

          {/* 経費一覧 */}
          {expenses.length === 0 ? (
            <div className="admin-empty">この月の経費はありません。</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>カテゴリ</th>
                    <th>金額</th>
                    <th>メモ</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>{exp.date}</td>
                      <td>{categoryLabel(exp.category)}</td>
                      <td style={{ textAlign: 'right' }}>{formatYen(exp.amount)}</td>
                      <td>{exp.memo || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn danger"
                          onClick={() => void handleDelete(exp)}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
