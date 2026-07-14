import { useCallback, useEffect, useState } from 'react';
import type { KyTenant } from '../lib/types';
import { fetchReports, updateReportStatus } from './adminApi';
import type { KyReport } from './adminApi';

const STATUS_LABEL: Record<string, string> = {
  pending: '未対応',
  resolved: '対応済み',
  dismissed: '却下',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'red',
  resolved: 'green',
  dismissed: 'gray',
};

const TARGET_LABEL: Record<string, string> = {
  cast: 'キャスト',
  reservation: '予約',
  tenant: '店舗',
};

export function AdminReports({ tenant }: { tenant: KyTenant }) {
  const [reports, setReports] = useState<KyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReports(tenant.id);
      setReports(data);
    } catch (e) {
      console.warn('[kyasuho] fetchReports failed:', e);
      setError('通報一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = async (reportId: string, status: 'resolved' | 'dismissed') => {
    if (actioningId) return;
    setActioningId(reportId);
    try {
      await updateReportStatus(reportId, status);
      await load();
    } catch (e) {
      console.warn('[kyasuho] updateReportStatus failed:', e);
      window.alert('ステータスの更新に失敗しました。');
    } finally {
      setActioningId(null);
    }
  };

  const filtered = filter === 'all' ? reports : reports.filter((r) => r.status === 'pending');
  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <h2 className="admin-page-title">通報管理</h2>

      <div className="admin-card">
        <div className="admin-stat-row">
          <div className="admin-stat">
            <div className="admin-stat-label">未対応</div>
            <div className="admin-stat-value" style={pendingCount > 0 ? { color: '#dc2626' } : undefined}>
              {pendingCount}件
            </div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">合計</div>
            <div className="admin-stat-value">{reports.length}件</div>
          </div>
        </div>
      </div>

      <div className="admin-btn-row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`admin-btn${filter === 'pending' ? ' primary' : ''}`}
          onClick={() => setFilter('pending')}
        >
          未対応のみ
        </button>
        <button
          type="button"
          className={`admin-btn${filter === 'all' ? ' primary' : ''}`}
          onClick={() => setFilter('all')}
        >
          すべて
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : filtered.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">
            {filter === 'pending' ? '未対応の通報はありません。' : '通報はありません。'}
          </div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>状態</th>
                <th>対象種別</th>
                <th>理由</th>
                <th>通報日時</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={`admin-badge ${STATUS_CLASS[r.status] ?? 'gray'}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>{TARGET_LABEL[r.target_type] ?? r.target_type}</td>
                  <td style={{ maxWidth: 400, wordBreak: 'break-word' }}>{r.reason || '—'}</td>
                  <td>{new Date(r.created_at).toLocaleString('ja-JP')}</td>
                  <td>
                    {r.status === 'pending' ? (
                      <div className="admin-btn-row">
                        <button
                          type="button"
                          className="admin-btn primary"
                          disabled={actioningId === r.id}
                          onClick={() => void handleAction(r.id, 'resolved')}
                        >
                          {actioningId === r.id ? '処理中…' : '対応済み'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn"
                          disabled={actioningId === r.id}
                          onClick={() => void handleAction(r.id, 'dismissed')}
                        >
                          却下
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: '#888' }}>
                        {new Date(r.updated_at).toLocaleString('ja-JP')}
                      </span>
                    )}
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
