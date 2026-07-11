import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KyCast, KyCastPayroll, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import { fetchCastList, fetchPayrollByMonth, fetchPayrollByRange } from './adminApi';

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

function metricFromRow(row: KyCastPayroll, key: SortKey): number {
  switch (key) {
    case 'nominationCount': return row.nomination_count;
    case 'drinkCount': return row.drink_count;
    case 'totalSales': return row.base_pay + row.nomination_back + row.menu_back + row.other_back;
    case 'totalPay': return row.total_pay;
    case 'daysWorked': return 1;
  }
}

function fmtMetric(value: number, key: SortKey): string {
  return key === 'totalSales' || key === 'totalPay'
    ? `¥${value.toLocaleString()}`
    : String(value);
}

export function AdminCastPerformance({ tenant }: { tenant: KyTenant }) {
  const [yearMonth, setYearMonth] = useState(currentMonth);
  const [payroll, setPayroll] = useState<KyCastPayroll[]>([]);
  const [casts, setCasts] = useState<KyCast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('totalSales');
  const [trendData, setTrendData] = useState<KyCastPayroll[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const trendStart = shiftMonth(yearMonth, -5);
      const [rows, castRows, trendRows] = await Promise.all([
        fetchPayrollByMonth(tenant.id, yearMonth),
        fetchCastList(tenant.id),
        fetchPayrollByRange(tenant.id, trendStart, yearMonth),
      ]);
      setPayroll(rows);
      setCasts(castRows);
      setTrendData(trendRows);
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

  const trendMonths = useMemo(() => {
    const yms: string[] = [];
    for (let i = -5; i <= 0; i++) yms.push(shiftMonth(yearMonth, i));
    return yms.map(ym => {
      let value = 0;
      for (const row of trendData) {
        if (row.date.startsWith(ym)) value += metricFromRow(row, sortKey);
      }
      return { ym, value };
    });
  }, [yearMonth, trendData, sortKey]);

  const castTrend = useMemo(() => {
    const yms = trendMonths.map(t => t.ym);
    const map = new Map<string, Map<string, number>>();
    for (const row of trendData) {
      const ym = row.date.substring(0, 7);
      if (!yms.includes(ym)) continue;
      let m = map.get(row.cast_id);
      if (!m) { m = new Map(); map.set(row.cast_id, m); }
      m.set(ym, (m.get(ym) ?? 0) + metricFromRow(row, sortKey));
    }
    const latestYm = yms[yms.length - 1] ?? '';
    return [...map.entries()]
      .map(([castId, monthMap]) => ({
        castId,
        name: castNameById.get(castId) ?? '—',
        values: yms.map(ym => monthMap.get(ym) ?? 0),
        latest: monthMap.get(latestYm) ?? 0,
      }))
      .sort((a, b) => b.latest - a.latest)
      .slice(0, 5);
  }, [trendData, trendMonths, sortKey, castNameById]);

  const hasTrend = trendMonths.some(t => t.value > 0);

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
      ) : (
        <>
          {summaries.length > 0 ? (
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
          ) : (
            <div className="admin-table-wrap">
              <div className="admin-empty">この月の給与データがありません。</div>
            </div>
          )}

          {hasTrend && (
            <>
              <div className="admin-card" style={{ marginTop: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  {SORT_LABELS[sortKey]}の推移（{monthLabel(trendMonths[0]?.ym ?? yearMonth)}〜）
                </h3>
                {(() => {
                  const maxVal = Math.max(...trendMonths.map(t => t.value), 1);
                  const slotW = 82;
                  const barW = 50;
                  const offsetX = 20;
                  const chartH = 130;
                  const baseY = chartH + 10;
                  const svgW = offsetX + slotW * 6 + 10;
                  return (
                    <svg viewBox={`0 0 ${svgW} ${baseY + 30}`} style={{ width: '100%', maxHeight: 200 }}>
                      <line x1={offsetX - 5} y1={baseY} x2={svgW - 5} y2={baseY} stroke="var(--border, #ddd)" strokeWidth={1} />
                      {trendMonths.map((t, i) => {
                        const barH = maxVal > 0 ? (t.value / maxVal) * chartH : 0;
                        const x = offsetX + i * slotW + (slotW - barW) / 2;
                        const yNum = Number(t.ym.split('-')[0] ?? 2026);
                        const mNum = Number(t.ym.split('-')[1] ?? 1);
                        const isCurrent = i === trendMonths.length - 1;
                        const prevY = i > 0 ? Number(trendMonths[i - 1]?.ym.split('-')[0] ?? 0) : 0;
                        const showYear = i === 0 || yNum !== prevY;
                        return (
                          <g key={t.ym}>
                            <rect
                              x={x}
                              y={baseY - barH}
                              width={barW}
                              height={Math.max(barH, 0)}
                              fill="var(--primary, #e91e63)"
                              opacity={isCurrent ? 1 : 0.45}
                              rx={3}
                            />
                            {t.value > 0 && (
                              <text
                                x={x + barW / 2}
                                y={baseY - barH - 4}
                                textAnchor="middle"
                                fontSize={9}
                                fill="var(--text-primary, #333)"
                              >
                                {fmtMetric(t.value, sortKey)}
                              </text>
                            )}
                            <text
                              x={x + barW / 2}
                              y={baseY + 14}
                              textAnchor="middle"
                              fontSize={11}
                              fill={isCurrent ? 'var(--text-primary, #333)' : 'var(--text-secondary, #888)'}
                              fontWeight={isCurrent ? 600 : 400}
                            >
                              {mNum}月
                            </text>
                            {showYear && (
                              <text
                                x={x + barW / 2}
                                y={baseY + 26}
                                textAnchor="middle"
                                fontSize={9}
                                fill="var(--text-secondary, #888)"
                              >
                                {yNum}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>

              {castTrend.length > 0 && (
                <div className="admin-table-wrap" style={{ marginTop: 8 }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>キャスト</th>
                        {trendMonths.map(t => {
                          const mNum = Number(t.ym.split('-')[1] ?? 1);
                          return <th key={t.ym} className="num">{mNum}月</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {castTrend.map(c => (
                        <tr key={c.castId}>
                          <td>{c.name}</td>
                          {c.values.map((v, i) => (
                            <td key={trendMonths[i]?.ym} className="num">
                              {fmtMetric(v, sortKey)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
