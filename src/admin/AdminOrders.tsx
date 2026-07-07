import { useCallback, useEffect, useState } from 'react';
import type { KyCast, KyOrder, KyOrderItem, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import { fetchOrdersByDate, fetchOrderItems, fetchCastList } from './adminApi';

function yen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

const STATUS_LABEL: Record<string, string> = {
  open: '会計前',
  closed: '会計済',
  void: '取消',
};

const STATUS_CLASS: Record<string, string> = {
  open: 'blue',
  closed: 'green',
  void: 'gray',
};

const PAY_LABEL: Record<string, string> = {
  cash: '現金',
  card: 'カード',
  qr: 'QR',
  other: 'その他',
};

export function AdminOrders({ tenant }: { tenant: KyTenant }) {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [orders, setOrders] = useState<KyOrder[]>([]);
  const [casts, setCasts] = useState<KyCast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<KyOrderItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpandedId(null);
    try {
      const [o, c] = await Promise.all([
        fetchOrdersByDate(tenant.id, date),
        fetchCastList(tenant.id),
      ]);
      setOrders(o);
      setCasts(c);
    } catch (e) {
      console.warn('[kyasuho] fetchOrders failed:', e);
      setError('伝票の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const castNameById = new Map(casts.map((c) => [c.id, c.name]));

  const daySummary = orders
    .filter((o) => o.status === 'closed')
    .reduce(
      (acc, o) => ({ total: acc.total + o.subtotal, count: acc.count + 1 }),
      { total: 0, count: 0 },
    );

  const toggleExpand = async (orderId: string) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    setItemsLoading(true);
    try {
      const data = await fetchOrderItems(orderId);
      setItems(data);
    } catch (e) {
      console.warn('[kyasuho] fetchOrderItems failed:', e);
    } finally {
      setItemsLoading(false);
    }
  };

  const shiftDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(formatDate(d));
  };

  return (
    <div>
      <h2 className="admin-page-title">伝票履歴</h2>

      <div className="admin-date-nav">
        <button type="button" className="admin-btn" onClick={() => shiftDate(-1)}>
          ◀ 前日
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="admin-btn" onClick={() => shiftDate(1)}>
          翌日 ▶
        </button>
        <button type="button" className="admin-btn" onClick={() => setDate(formatDate(new Date()))}>
          今日
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-stat-row">
          <div className="admin-stat">
            <div className="admin-stat-label">当日会計済売上</div>
            <div className="admin-stat-value">{yen(daySummary.total)}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">会計済伝票</div>
            <div className="admin-stat-value">{daySummary.count}件</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">全伝票</div>
            <div className="admin-stat-value">{orders.length}件</div>
          </div>
        </div>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : orders.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">この日の伝票はありません。</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>状態</th>
                <th>お客様名</th>
                <th>席</th>
                <th className="num">小計</th>
                <th>支払</th>
                <th>開始</th>
                <th>会計</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <>
                  <tr key={order.id}>
                    <td>
                      <span className={`admin-badge ${STATUS_CLASS[order.status] ?? 'gray'}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </td>
                    <td>{order.customer_label || '—'}</td>
                    <td>{order.seat_no ?? '—'}</td>
                    <td className="num">{order.status === 'closed' ? yen(order.subtotal) : '—'}</td>
                    <td>{order.status === 'closed' ? PAY_LABEL[order.payment_method] ?? order.payment_method : '—'}</td>
                    <td>{order.opened_at ? new Date(order.opened_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{order.closed_at ? new Date(order.closed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => void toggleExpand(order.id)}
                      >
                        {expandedId === order.id ? '閉じる' : '明細'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === order.id && (
                    <tr key={`${order.id}-detail`}>
                      <td colSpan={8} style={{ padding: 0 }}>
                        {itemsLoading ? (
                          <div style={{ padding: '12px 20px', fontSize: 13, color: '#888' }}>読み込み中…</div>
                        ) : items.length === 0 ? (
                          <div style={{ padding: '12px 20px', fontSize: 13, color: '#888' }}>明細なし</div>
                        ) : (
                          <table className="admin-table" style={{ margin: '8px 20px', width: 'calc(100% - 40px)' }}>
                            <thead>
                              <tr>
                                <th>カテゴリ</th>
                                <th>品名</th>
                                <th className="num">単価</th>
                                <th className="num">数量</th>
                                <th className="num">小計</th>
                                <th>キャスト</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.id} style={item.price < 0 ? { color: '#dc2626' } : undefined}>
                                  <td>{item.category}</td>
                                  <td>{item.name}</td>
                                  <td className="num">{yen(item.price)}</td>
                                  <td className="num">{item.qty}</td>
                                  <td className="num">{yen(item.price * item.qty)}</td>
                                  <td>{item.cast_id ? castNameById.get(item.cast_id) ?? '—' : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {order.note && (
                          <div style={{ padding: '4px 20px 12px', fontSize: 13, color: '#666' }}>
                            メモ: {order.note}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
