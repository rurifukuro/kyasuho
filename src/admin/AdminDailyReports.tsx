import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyDailyReport, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import {
  deleteDailyReport,
  fetchDailyReports,
  upsertDailyReport,
} from './adminApi';
import { downloadCsv } from './csv';

function currentMonth(): string {
  return formatDate(new Date()).slice(0, 7);
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y = 0, m = 0] = yearMonth.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function yen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

export function AdminDailyReports({ tenant }: { tenant: KyTenant }) {
  const [yearMonth, setYearMonth] = useState(currentMonth);
  const [reports, setReports] = useState<KyDailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 日報入力フォーム
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [bizDate, setBizDate] = useState('');
  const [totalRevenue, setTotalRevenue] = useState('0');
  const [orderCount, setOrderCount] = useState('0');
  const [guestCount, setGuestCount] = useState('0');
  const [cashExpected, setCashExpected] = useState('0');
  const [cashActual, setCashActual] = useState('');
  const [memo, setMemo] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchDailyReports(tenant.id, yearMonth);
      setReports(rows);
    } catch (e) {
      console.warn('[kyasuho] fetchDailyReports failed:', e);
      setError('日報の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthTotals = useMemo(() => {
    let revenue = 0;
    let orders = 0;
    let guests = 0;
    for (const r of reports) {
      revenue += r.total_revenue;
      orders += r.order_count;
      guests += r.guest_count;
    }
    return { revenue, orders, guests, days: reports.length };
  }, [reports]);

  const openForm = (report?: KyDailyReport) => {
    if (report) {
      setEditId(report.id);
      setBizDate(report.business_date);
      setTotalRevenue(String(report.total_revenue));
      setOrderCount(String(report.order_count));
      setGuestCount(String(report.guest_count));
      setCashExpected(String(report.cash_expected));
      setCashActual(report.cash_actual !== null ? String(report.cash_actual) : '');
      setMemo(report.memo);
    } else {
      setEditId(null);
      setBizDate(formatDate(new Date()));
      setTotalRevenue('0');
      setOrderCount('0');
      setGuestCount('0');
      setCashExpected('0');
      setCashActual('');
      setMemo('');
    }
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (formBusy || !bizDate) return;
    const rev = Number(totalRevenue);
    const oc = Number(orderCount);
    const gc = Number(guestCount);
    const ce = Number(cashExpected);
    const ca = cashActual.trim() === '' ? null : Number(cashActual);
    if (isNaN(rev) || isNaN(oc) || isNaN(gc) || isNaN(ce) || (ca !== null && isNaN(ca))) {
      setFormError('数値を正しく入力してください。');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      await upsertDailyReport(tenant.id, {
        id: editId ?? undefined,
        business_date: bizDate,
        total_revenue: rev,
        order_count: oc,
        guest_count: gc,
        cash_expected: ce,
        cash_actual: ca,
        memo: memo.trim(),
        closed_at: new Date().toISOString(),
      });
      setFormOpen(false);
      await load();
    } catch (err) {
      console.warn('[kyasuho] upsertDailyReport failed:', err);
      setFormError('保存に失敗しました。');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (report: KyDailyReport) => {
    if (!window.confirm(`${report.business_date} の日報を削除しますか？`)) return;
    try {
      await deleteDailyReport(report.id);
      await load();
    } catch (e) {
      console.warn('[kyasuho] deleteDailyReport failed:', e);
      window.alert('削除に失敗しました。');
    }
  };

  const handleCsv = () => {
    if (reports.length === 0) {
      window.alert('この月の日報がありません。');
      return;
    }
    const rows: string[][] = [
      ['営業日', '売上', '組数', '客数', '現金予定', '現金実査', '差異', 'メモ'],
      ...reports.map((r) => [
        r.business_date,
        String(r.total_revenue),
        String(r.order_count),
        String(r.guest_count),
        String(r.cash_expected),
        r.cash_actual !== null ? String(r.cash_actual) : '',
        r.cash_diff !== null ? String(r.cash_diff) : '',
        r.memo,
      ]),
    ];
    downloadCsv(`kyasuho_daily_reports_${yearMonth}.csv`, rows);
  };

  return (
    <div>
      <h2 className="admin-page-title">日報</h2>

      <div className="admin-date-nav">
        <button type="button" className="admin-btn" onClick={() => setYearMonth(shiftMonth(yearMonth, -1))}>
          ◀ 前月
        </button>
        <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
        <button type="button" className="admin-btn" onClick={() => setYearMonth(shiftMonth(yearMonth, 1))}>
          翌月 ▶
        </button>
        <button type="button" className="admin-btn" onClick={() => setYearMonth(currentMonth())}>
          今月
        </button>
        <span className="admin-spacer" />
        <button type="button" className="admin-btn" onClick={handleCsv}>
          CSVダウンロード
        </button>
        <button type="button" className="admin-btn primary" onClick={() => openForm()}>
          日報を作成
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-stat-row">
          <div className="admin-stat">
            <div className="admin-stat-label">月間売上</div>
            <div className="admin-stat-value">{yen(monthTotals.revenue)}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">営業日数</div>
            <div className="admin-stat-value">{monthTotals.days}日</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">組数合計</div>
            <div className="admin-stat-value">{monthTotals.orders}組</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">客数合計</div>
            <div className="admin-stat-value">{monthTotals.guests}人</div>
          </div>
        </div>
      </div>

      {formOpen ? (
        <form className="admin-card" onSubmit={handleSave}>
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            {editId ? '日報を編集（締め直し）' : '日報を作成'}
          </div>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="dr-date">営業日</label>
              <input
                id="dr-date"
                type="date"
                value={bizDate}
                onChange={(e) => setBizDate(e.target.value)}
                required
                disabled={!!editId}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="dr-revenue">売上（円）</label>
              <input
                id="dr-revenue"
                type="number"
                className="w-md"
                value={totalRevenue}
                onChange={(e) => setTotalRevenue(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="dr-orders">組数</label>
              <input
                id="dr-orders"
                type="number"
                className="w-sm"
                min={0}
                value={orderCount}
                onChange={(e) => setOrderCount(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="dr-guests">客数</label>
              <input
                id="dr-guests"
                type="number"
                className="w-sm"
                min={0}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="dr-cash-expected">現金予定（円）</label>
              <input
                id="dr-cash-expected"
                type="number"
                className="w-md"
                value={cashExpected}
                onChange={(e) => setCashExpected(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="dr-cash-actual">現金実査額（円・空欄=未実査）</label>
              <input
                id="dr-cash-actual"
                type="number"
                className="w-md"
                value={cashActual}
                onChange={(e) => setCashActual(e.target.value)}
              />
            </div>
            {cashActual.trim() !== '' && !isNaN(Number(cashActual)) ? (
              <div className="admin-field">
                <label>過不足</label>
                <div style={{ padding: '8px 0', fontWeight: 'bold', color: Number(cashActual) - Number(cashExpected) === 0 ? '#43a047' : '#e53935' }}>
                  {yen(Number(cashActual) - Number(cashExpected))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="admin-form-row">
            <div className="admin-field" style={{ flex: 1 }}>
              <label htmlFor="dr-memo">メモ（引き継ぎ・気づき）</label>
              <input
                id="dr-memo"
                type="text"
                style={{ width: '100%' }}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-btn-row" style={{ marginTop: 8 }}>
            <button type="submit" className="admin-btn primary" disabled={formBusy}>
              {formBusy ? '保存中…' : editId ? '締め直し' : '営業日を締める'}
            </button>
            <button type="button" className="admin-btn" onClick={() => setFormOpen(false)}>
              キャンセル
            </button>
          </div>
          {formError ? <p className="admin-error">{formError}</p> : null}
        </form>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : reports.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">
            この月の日報がまだありません。「日報を作成」ボタンから営業日を締めてください。
          </div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>営業日</th>
                <th className="num">売上</th>
                <th className="num">組数</th>
                <th className="num">客数</th>
                <th className="num">現金予定</th>
                <th className="num">実査</th>
                <th className="num">過不足</th>
                <th>メモ</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.business_date}</td>
                  <td className="num">{yen(r.total_revenue)}</td>
                  <td className="num">{r.order_count}</td>
                  <td className="num">{r.guest_count}</td>
                  <td className="num">{yen(r.cash_expected)}</td>
                  <td className="num">{r.cash_actual !== null ? yen(r.cash_actual) : '—'}</td>
                  <td className="num" style={r.cash_diff !== null && r.cash_diff !== 0 ? { color: '#e53935', fontWeight: 'bold' } : undefined}>
                    {r.cash_diff !== null ? yen(r.cash_diff) : '—'}
                  </td>
                  <td>{r.memo || '—'}</td>
                  <td>
                    <div className="admin-btn-row">
                      <button type="button" className="admin-btn" onClick={() => openForm(r)}>
                        締め直し
                      </button>
                      <button
                        type="button"
                        className="admin-btn danger"
                        onClick={() => void handleDelete(r)}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
