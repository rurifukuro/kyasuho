import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyExpense, KyTenant } from '../lib/types';
import {
  addExpense,
  deleteExpense,
  deleteReceipt,
  fetchExpenses,
  fetchMonthlySalesTotal,
  fetchMonthlyPayrollTotal,
  uploadReceipt,
  fetchCustomExpenseCategories,
  addCustomExpenseCategory,
  deleteCustomExpenseCategory,
} from './adminApi';
import type { KyExpenseCategory } from './adminApi';

const BUILTIN_CATEGORIES: { key: string; label: string }[] = [
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

function mergeCategories(
  custom: KyExpenseCategory[],
): { key: string; label: string }[] {
  const merged = [...BUILTIN_CATEGORIES];
  for (const c of custom) {
    if (!merged.some((m) => m.key === c.key)) {
      merged.push({ key: c.key, label: c.label });
    }
  }
  return merged;
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
  const [receiptBusyId, setReceiptBusyId] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<KyExpenseCategory[]>([]);
  const [newCatKey, setNewCatKey] = useState('');
  const [newCatLabel, setNewCatLabel] = useState('');
  const [catBusy, setCatBusy] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);

  const allCategories = useMemo(() => mergeCategories(customCategories), [customCategories]);

  const categoryLabel = useCallback(
    (key: string) => allCategories.find((c) => c.key === key)?.label ?? key,
    [allCategories],
  );

  const { start, end } = useMemo(() => monthRange(yearMonth), [yearMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [exp, sales, payroll, cats] = await Promise.all([
        fetchExpenses(tenant.id, start, end),
        fetchMonthlySalesTotal(tenant.id, start, end),
        fetchMonthlyPayrollTotal(tenant.id, start, end),
        fetchCustomExpenseCategories(tenant.id),
      ]);
      setExpenses(exp);
      setSalesTotal(sales);
      setPayrollTotal(payroll);
      setCustomCategories(cats);
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
    return allCategories.filter((c) => map.has(c.key)).map((c) => ({
      key: c.key,
      label: c.label,
      total: map.get(c.key)!,
    }));
  }, [expenses, allCategories]);

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

  const handleReceiptUpload = useCallback(
    async (exp: KyExpense, file: File) => {
      setReceiptBusyId(exp.id);
      try {
        await uploadReceipt(tenant.id, exp.id, file);
        await loadData();
      } catch (e) {
        alert(`アップロード失敗: ${String(e)}`);
      } finally {
        setReceiptBusyId(null);
      }
    },
    [tenant.id, loadData],
  );

  const handleReceiptDelete = useCallback(
    async (exp: KyExpense) => {
      if (!confirm('この領収書画像を削除しますか？')) return;
      setReceiptBusyId(exp.id);
      try {
        await deleteReceipt(tenant.id, exp.id);
        await loadData();
      } catch (e) {
        alert(`削除失敗: ${String(e)}`);
      } finally {
        setReceiptBusyId(null);
      }
    },
    [tenant.id, loadData],
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
      const catCols = allCategories.map((c) =>
        exp.filter((e) => e.category === c.key).reduce((s, e) => s + e.amount, 0),
      );
      rows.push([m, sales, expTotal, ...catCols, payroll, sales - expTotal - payroll].join(','));
    }
    const header = [
      '月',
      '総売上',
      '経費計',
      ...allCategories.map((c) => c.label),
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
  }, [tenant.id, yearMonth, allCategories]);

  const handleAddCategory = useCallback(async () => {
    const key = newCatKey.trim().replace(/\s+/g, '_').toLowerCase();
    const label = newCatLabel.trim();
    if (!key || !label) return;
    if (allCategories.some((c) => c.key === key)) {
      alert('同じキーのカテゴリが既にあります。');
      return;
    }
    setCatBusy(true);
    try {
      await addCustomExpenseCategory(tenant.id, key, label);
      setNewCatKey('');
      setNewCatLabel('');
      await loadData();
    } catch (e) {
      alert(`追加失敗: ${String(e)}`);
    } finally {
      setCatBusy(false);
    }
  }, [tenant.id, newCatKey, newCatLabel, allCategories, loadData]);

  const handleDeleteCategory = useCallback(
    async (cat: KyExpenseCategory) => {
      if (!confirm(`カスタムカテゴリ「${cat.label}」を削除しますか？`)) return;
      setCatBusy(true);
      try {
        await deleteCustomExpenseCategory(cat.id);
        await loadData();
      } catch (e) {
        alert(`削除失敗: ${String(e)}`);
      } finally {
        setCatBusy(false);
      }
    },
    [loadData],
  );

  const [y, m] = yearMonth.split('-');

  return (
    <>
      <h3 className="admin-section-title">
        経費・収支
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
                {allCategories.map((c) => (
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

          {/* CSV出力・月次レポート */}
          <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
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
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                const w = window.open('', '_blank');
                if (!w) return;
                const catRows = categoryTotals
                  .map((ct) => `<tr><td style="padding:4px 16px 4px 24px">${ct.label}</td><td style="text-align:right;padding:4px 8px">${formatYen(ct.total)}</td></tr>`)
                  .join('');
                const expRows = expenses
                  .map((e) => `<tr><td>${e.date}</td><td>${categoryLabel(e.category)}</td><td style="text-align:right">${formatYen(e.amount)}</td><td>${e.memo || ''}</td></tr>`)
                  .join('');
                w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>月次レポート ${y}年${Number(m)}月 - ${tenant.name}</title>
<style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px}th{background:#f3f4f6;text-align:left}.summary td{border:none;font-size:14px}.summary .label{font-weight:600}h1{font-size:18px}h2{font-size:15px;margin-top:24px;border-bottom:2px solid #333;padding-bottom:4px}@media print{body{padding:0}}</style>
</head><body>
<h1>${tenant.name} 月次レポート</h1>
<p>${y}年${Number(m)}月</p>
<h2>収支サマリ</h2>
<table class="summary">
<tr><td class="label">売上</td><td style="text-align:right">${formatYen(salesTotal)}</td></tr>
<tr><td class="label">経費計</td><td style="text-align:right;color:#dc2626">−${formatYen(expenseTotal)}</td></tr>
${catRows}
<tr><td class="label">人件費</td><td style="text-align:right;color:#dc2626">−${formatYen(payrollTotal)}</td></tr>
<tr style="border-top:2px solid #333"><td class="label" style="padding-top:8px">差引収支</td><td style="text-align:right;padding-top:8px;font-size:18px;font-weight:700;color:${netIncome >= 0 ? '#16a34a' : '#dc2626'}">${netIncome >= 0 ? '' : '−'}${formatYen(Math.abs(netIncome))}</td></tr>
</table>
<h2>経費明細</h2>
<table><thead><tr><th>日付</th><th>カテゴリ</th><th>金額</th><th>メモ</th></tr></thead><tbody>${expRows || '<tr><td colspan="4" style="text-align:center;color:#888">この月の経費はありません</td></tr>'}</tbody></table>
<script>window.print()</script>
</body></html>`);
                w.document.close();
              }}
            >
              月次レポート印刷
            </button>
          </div>

          {/* カスタムカテゴリ管理 */}
          <div style={{ margin: '0 0 16px' }}>
            <button
              type="button"
              className="admin-btn"
              onClick={() => setShowCatManager(!showCatManager)}
              style={{ fontSize: 13 }}
            >
              {showCatManager ? '▲ カテゴリ管理を閉じる' : '▼ カテゴリを追加・管理'}
            </button>
            {showCatManager && (
              <div style={{ marginTop: 8, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 13 }}>
                    キー（英数字）
                    <input
                      type="text"
                      value={newCatKey}
                      onChange={(e) => setNewCatKey(e.target.value)}
                      placeholder="travel"
                      style={{ display: 'block', marginTop: 2, padding: '4px 8px', fontSize: 13, width: 120 }}
                    />
                  </label>
                  <label style={{ fontSize: 13 }}>
                    表示名
                    <input
                      type="text"
                      value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      placeholder="交通費"
                      style={{ display: 'block', marginTop: 2, padding: '4px 8px', fontSize: 13, width: 160 }}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-btn primary"
                    onClick={() => void handleAddCategory()}
                    disabled={catBusy || !newCatKey.trim() || !newCatLabel.trim()}
                    style={{ fontSize: 13, padding: '4px 12px' }}
                  >
                    追加
                  </button>
                </div>
                {customCategories.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>カスタムカテゴリ一覧</div>
                    {customCategories.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                        <span style={{ fontSize: 13 }}>{c.label}（{c.key}）</span>
                        <button
                          type="button"
                          className="admin-btn danger"
                          onClick={() => void handleDeleteCategory(c)}
                          disabled={catBusy}
                          style={{ fontSize: 11, padding: '1px 8px' }}
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
                    <th>領収書</th>
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
                        {receiptBusyId === exp.id ? (
                          <span style={{ fontSize: 12, color: '#6b7280' }}>処理中…</span>
                        ) : exp.receipt_url ? (
                          <div className="admin-btn-row">
                            <button
                              type="button"
                              className="admin-btn"
                              style={{ fontSize: 12, padding: '2px 8px' }}
                              onClick={() => setViewingReceipt(exp.receipt_url)}
                            >
                              表示
                            </button>
                            <button
                              type="button"
                              className="admin-btn danger"
                              style={{ fontSize: 12, padding: '2px 8px' }}
                              onClick={() => void handleReceiptDelete(exp)}
                            >
                              削除
                            </button>
                          </div>
                        ) : (
                          <label className="admin-btn" style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer' }}>
                            添付
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleReceiptUpload(exp, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </td>
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

      {viewingReceipt && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }}
          onClick={() => setViewingReceipt(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              type="button"
              onClick={() => setViewingReceipt(null)}
              style={{
                position: 'absolute', top: -12, right: -12, border: 'none', background: '#fff',
                borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 16, lineHeight: '28px',
              }}
            >
              ✕
            </button>
            <img
              src={viewingReceipt}
              alt="領収書"
              style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </>
  );
}
