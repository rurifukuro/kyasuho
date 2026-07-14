import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DevKpis, RevenueMonthly } from './devApi';
import { fetchDevKpis, fetchRevenueMonthly } from './devApi';
import { downloadCsv } from '../admin/csv';
import '../admin/admin.css';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y = 0, m = 0] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function yen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

const CHANNEL_LABELS: Record<string, string> = {
  apple_iap: 'Apple IAP',
  google_play: 'Google Play',
  stripe_card: 'Stripe（カード）',
  bank_transfer: '銀行振込',
};

export function DevDashboard() {
  const [kpis, setKpis] = useState<DevKpis | null>(null);
  const [revenue, setRevenue] = useState<RevenueMonthly[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [k, r] = await Promise.all([
        fetchDevKpis(),
        fetchRevenueMonthly(`${month}-01`, `${month}-31`),
      ]);
      setKpis(k);
      setRevenue(r);
    } catch (e) {
      console.warn('[kyasuho-dev] load error:', e);
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const monthlyTotal = useMemo(() => {
    const gross = revenue.reduce((s, r) => s + r.gross, 0);
    const fee = revenue.reduce((s, r) => s + r.fee, 0);
    const net = revenue.reduce((s, r) => s + r.net, 0);
    return { gross, fee, net };
  }, [revenue]);

  const handleExportCsv = () => {
    if (revenue.length === 0) return;
    const header = ['月', 'チャネル', 'グロス(¥)', '手数料見積(¥)', 'ネット見積(¥)', '見積含む'];
    const rows = revenue.map((r) => [
      r.month.slice(0, 7),
      CHANNEL_LABELS[r.channel] ?? r.channel,
      String(r.gross),
      String(r.fee),
      String(r.net),
      r.has_estimated ? 'はい' : 'いいえ',
    ]);
    downloadCsv(`revenue_${month}.csv`, [header, ...rows]);
  };

  if (loading) {
    return <div className="loading">読み込み中…</div>;
  }

  if (error) {
    return (
      <div className="admin-card">
        <p className="admin-error">{error}</p>
        <button type="button" className="admin-btn" onClick={() => void loadAll()}>再読み込み</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000 }}>
      <h2 className="admin-page-title">開発者ダッシュボード</h2>
      <p className="admin-note" style={{ marginBottom: 20 }}>
        本画面は経営把握用の<strong>見込み値</strong>です。確定額は App Store Connect／Stripe を参照してください。
      </p>

      {/* KPIカード */}
      <div className="dev-kpi-grid">
        <div className="dev-kpi-card">
          <span className="dev-kpi-label">登録店舗数</span>
          <span className="dev-kpi-value">{kpis?.total_tenants ?? 0}</span>
        </div>
        <div className="dev-kpi-card">
          <span className="dev-kpi-label">直近30日売上</span>
          <span className="dev-kpi-value">{yen(kpis?.revenue_30d ?? 0)}</span>
        </div>
        <div className="dev-kpi-card">
          <span className="dev-kpi-label">有効契約数</span>
          <span className="dev-kpi-value">
            {kpis?.active_subscriptions ?? 0}
            {(kpis?.trialing ?? 0) > 0 && (
              <span className="dev-kpi-sub">（＋トライアル {kpis!.trialing}）</span>
            )}
          </span>
        </div>
        <div className="dev-kpi-card">
          <span className="dev-kpi-label">MRR見込み</span>
          <span className="dev-kpi-value">{yen(kpis?.mrr_estimate ?? 0)}</span>
        </div>
      </div>

      {/* 月次売上 */}
      <div className="admin-card">
        <div className="dev-month-nav">
          <button type="button" className="admin-btn" style={{ padding: '4px 10px' }} onClick={() => setMonth((m) => shiftMonth(m, -1))}>◀</button>
          <h3>{month}</h3>
          <button type="button" className="admin-btn" style={{ padding: '4px 10px' }} onClick={() => setMonth((m) => shiftMonth(m, 1))}>▶</button>
        </div>

        {revenue.length === 0 ? (
          <p className="admin-empty">この月の売上データはありません。</p>
        ) : (
          <div className="admin-table-wrap"><table className="admin-table">
            <thead>
              <tr>
                <th>チャネル</th>
                <th className="num">グロス</th>
                <th className="num">手数料見積</th>
                <th className="num">ネット見積</th>
                <th>見積</th>
              </tr>
            </thead>
            <tbody>
              {revenue.map((r, i) => (
                <tr key={i}>
                  <td>{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
                  <td className="num">{yen(r.gross)}</td>
                  <td className="num">{yen(r.fee)}</td>
                  <td className="num">{yen(r.net)}</td>
                  <td>{r.has_estimated ? '⚠' : '✓'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>合計</strong></td>
                <td className="num"><strong>{yen(monthlyTotal.gross)}</strong></td>
                <td className="num"><strong>{yen(monthlyTotal.fee)}</strong></td>
                <td className="num"><strong>{yen(monthlyTotal.net)}</strong></td>
                <td />
              </tr>
            </tfoot>
          </table></div>
        )}

        <div className="admin-btn-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="admin-btn"
            onClick={handleExportCsv}
            disabled={revenue.length === 0}
          >
            CSV出力
          </button>
        </div>
      </div>

      {/* 契約一覧（課金テーブル実装後に有効化） */}
      <div className="admin-card">
        <h3>契約一覧</h3>
        <p className="admin-note">課金機能（BILL-1）の実装後に表示されます。</p>
      </div>
    </div>
  );
}
