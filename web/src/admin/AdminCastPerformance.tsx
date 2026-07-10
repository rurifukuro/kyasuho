import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KyCast, KyCastPayroll, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import { fetchCastList, fetchPayrollByMonth } from './adminApi';

function currentMonth(): string {
  return formatDate(new Date()).slice(0, 7);
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y = 0, m = 0] = yearMonth.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${y}年${m}月`;
}

type CastSummary = {
  castId: string;
  name: string;
  nominationCount: number;
  drinkCount: number;
  totalSales: number;
  totalPay: number;
  daysWorked: number;
};

type SortKey = 'nominationCount' | 'drinkCount' | 'totalSales' | 'totalPay' | 'daysWorked';

const SORT_LABELS: Record<SortKey, string> = {
  nominationCount: '指名数',
  drinkCount: 'ドリンク数',
  totalSales: '売上貢献',
  totalPay: '支給総額',
  daysWorked: '出勤日数',
};

export function AdminCastPerformance({ tenant }: { tenant: KyTenant }) {
  const [yearMonth, setYearMonth] = useState(currentMonth);
  const [payroll, setPayroll] = useState<KyCastPayroll[]>([]);
  const [casts, setCasts] = useState<KyCast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('totalSales');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, castRows] = await Promise.all([
        fetchPayrollByMonth(tenant.id, yearMonth),
        fetchCastList(tenant.id),
      ]);
      setPayroll(rows);
      setCasts(castRows);
    } catch (e) {
      console.warn('[kyasuho] fetchPayrollByMonth/casts failed:', e);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const castNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of casts) map.set(c.id, c.name);
    return map;
  }, [casts]);

  const summaries = useMemo((): CastSummary[] => {
    const map = new Map<string, CastSummary>();
    for (const row of payroll) {
      let s = map.get(row.cast_id);
      if (!s) {
        s = {
          castId: row.cast_id,
          name: castNameById.get(row.cast_id) ?? '—',
          nominationCount: 0,
          drinkCount: 0,
          totalSales: 0,
          totalPay: 0,
          daysWorked: 0,
        };
        map.set(row.cast_id, s);
      }
      s.nominationCount += row.nomination_count;
      s.drinkCount += row.drink_count;
      s.totalSales += row.base_pay + row.nomination_back + row.menu_back + row.other_back;
      s.totalPay += row.total_pay;
      s.daysWorked += 1;
    }
    const list = [...map.values()];
    list.sort((a, b) => b[sortKey] - a[sortKey]);
    return list;
  }, [payroll, castNameById, sortKey]);

  const totals = useMemo(() => {
    let nominations = 0;
    let drinks = 0;
    let sales = 0;
    let pay = 0;
    for (const s of summaries) {
      nominations += s.nominationCount;
      drinks += s.drinkCount;
      sales += s.totalSales;
      pay += s.totalPay;
    }
    return { nominations, drinks, sales, pay };
  }, [summaries]);

  return (
    <div>
      <h2 className="admin-page-title">キャスト成績</h2>

      <div className="admin-date-nav">
        <button type="button" className="admin-btn" onClick={() => setYearMonth(shiftMonth(yearMonth, -1))}>
          ◀ 前月
        </button>
        <span style={{ fontWeight: 600, fontSize: 15, margin: '0 8px' }}>{monthLabel(yearMonth)}</span>
        <button type="button" className="admin-btn" onClick={() => setYearMonth(shiftMonth(yearMonth, 1))}>
          翌月 ▶
        </button>
        <button type="button" className="admin-btn" onClick={() => setYearMonth(currentMonth())}>
          今月
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <label htmlFor="sort-key" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>並び順:</label>
          <select
            id="sort-key"
            className="w-md"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : summaries.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">この月の給与データがありません。</div>
        </div>
      ) : (
        <>
          <div className="admin-card" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14, marginBottom: 8 }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', marginRight: 4 }}>指名合計:</span>
              <strong>{totals.nominations}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', marginRight: 4 }}>ドリンク合計:</span>
              <strong>{totals.drinks}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', marginRight: 4 }}>売上貢献合計:</span>
              <strong>¥{totals.sales.toLocaleString()}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', marginRight: 4 }}>支給合計:</span>
              <strong>¥{totals.pay.toLocaleString()}</strong>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>キャスト</th>
                  <th className="num">出勤日数</th>
                  <th className="num">指名数</th>
                  <th className="num">ドリンク数</th>
                  <th className="num">売上貢献</th>
                  <th className="num">支給総額</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => (
                  <tr key={s.castId}>
                    <td className="num">{i + 1}</td>
                    <td>{s.name}</td>
                    <td className="num">{s.daysWorked}</td>
                    <td className="num">{s.nominationCount}</td>
                    <td className="num">{s.drinkCount}</td>
                    <td className="num">¥{s.totalSales.toLocaleString()}</td>
                    <td className="num">¥{s.totalPay.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
