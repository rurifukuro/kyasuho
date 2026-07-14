import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyInventoryItem, KyInventoryMove, KyInventoryMoveKind, KyTenant } from '../lib/types';
import {
  deleteInventoryItem,
  fetchInventoryItems,
  fetchInventoryMoves,
  recordInventoryMove,
  upsertInventoryItem,
} from './adminApi';
import { downloadCsv } from './csv';

const MOVE_LABELS: Record<KyInventoryMoveKind, string> = {
  in: '仕入',
  sale: '会計連動',
  adjust: '棚卸調整',
  out: '廃棄・出庫',
};

function fmtDate(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

export function AdminInventory({ tenant }: { tenant: KyTenant }) {
  const [items, setItems] = useState<KyInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 品目フォーム
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('個');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 入出庫フォーム
  const [moveItemId, setMoveItemId] = useState<string | null>(null);
  const [moveKind, setMoveKind] = useState<KyInventoryMoveKind>('in');
  const [moveQty, setMoveQty] = useState('1');
  const [moveMemo, setMoveMemo] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // 履歴表示
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [moves, setMoves] = useState<KyInventoryMove[]>([]);
  const [movesLoading, setMovesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchInventoryItems(tenant.id);
      setItems(rows);
    } catch (e) {
      console.warn('[kyasuho] fetchInventoryItems failed:', e);
      setError('品目の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const alertItems = useMemo(
    () => items.filter((i) => i.is_active && i.alert_threshold !== null && i.stock_qty <= i.alert_threshold),
    [items],
  );

  const openItemForm = (item?: KyInventoryItem) => {
    if (item) {
      setEditId(item.id);
      setName(item.name);
      setUnit(item.unit);
      setAlertThreshold(item.alert_threshold !== null ? String(item.alert_threshold) : '');
    } else {
      setEditId(null);
      setName('');
      setUnit('個');
      setAlertThreshold('');
    }
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveItem = async (e: FormEvent) => {
    e.preventDefault();
    if (formBusy || !name.trim()) return;
    const threshold = alertThreshold.trim() === '' ? null : Number(alertThreshold);
    if (threshold !== null && (isNaN(threshold) || threshold < 0)) {
      setFormError('アラートしきい値は0以上の数値で入力してください。');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      await upsertInventoryItem(tenant.id, {
        id: editId ?? undefined,
        name: name.trim(),
        unit: unit.trim() || '個',
        alert_threshold: threshold,
        sort_order: editId ? items.find((i) => i.id === editId)?.sort_order ?? 0 : items.length,
      } as KyInventoryItem & { name: string; unit: string });
      setFormOpen(false);
      await load();
    } catch (err) {
      console.warn('[kyasuho] upsertInventoryItem failed:', err);
      setFormError('保存に失敗しました。');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeleteItem = async (item: KyInventoryItem) => {
    if (!window.confirm(`「${item.name}」を削除しますか？入出庫履歴も全て削除されます。`)) return;
    try {
      await deleteInventoryItem(item.id);
      await load();
    } catch (e) {
      console.warn('[kyasuho] deleteInventoryItem failed:', e);
      window.alert('削除に失敗しました。');
    }
  };

  const openMoveForm = (itemId: string) => {
    setMoveItemId(itemId);
    setMoveKind('in');
    setMoveQty('1');
    setMoveMemo('');
    setMoveError(null);
  };

  const handleRecordMove = async (e: FormEvent) => {
    e.preventDefault();
    if (moveBusy || !moveItemId) return;
    const qty = Number(moveQty);
    if (isNaN(qty) || qty === 0) {
      setMoveError('数量は0以外の数値で入力してください。');
      return;
    }
    const actualQty = moveKind === 'out' || moveKind === 'sale' ? -Math.abs(qty) : moveKind === 'adjust' ? qty : Math.abs(qty);
    setMoveBusy(true);
    setMoveError(null);
    try {
      await recordInventoryMove(tenant.id, moveItemId, moveKind, actualQty, moveMemo.trim());
      setMoveItemId(null);
      await load();
      if (historyItemId) {
        await loadHistory(historyItemId);
      }
    } catch (err) {
      console.warn('[kyasuho] recordInventoryMove failed:', err);
      setMoveError('記録に失敗しました。');
    } finally {
      setMoveBusy(false);
    }
  };

  const loadHistory = async (itemId: string) => {
    setMovesLoading(true);
    try {
      const rows = await fetchInventoryMoves(tenant.id, itemId);
      setMoves(rows);
      setHistoryItemId(itemId);
    } catch (e) {
      console.warn('[kyasuho] fetchInventoryMoves failed:', e);
    } finally {
      setMovesLoading(false);
    }
  };

  const handleCsv = () => {
    if (items.length === 0) {
      window.alert('品目がありません。');
      return;
    }
    const rows: string[][] = [
      ['品目名', '単位', '現在庫', 'アラートしきい値', '状態'],
      ...items.map((i) => [
        i.name,
        i.unit,
        String(i.stock_qty),
        i.alert_threshold !== null ? String(i.alert_threshold) : '',
        i.is_active ? '有効' : '無効',
      ]),
    ];
    downloadCsv('kyasuho_inventory.csv', rows);
  };

  const handleOrderListCsv = () => {
    if (alertItems.length === 0) {
      window.alert('しきい値割れの品目がありません。');
      return;
    }
    const rows: string[][] = [
      ['品目名', '単位', '現在庫', 'しきい値', '不足数'],
      ...alertItems.map((i) => [
        i.name,
        i.unit,
        String(i.stock_qty),
        String(i.alert_threshold),
        String(Math.max(0, (i.alert_threshold ?? 0) - i.stock_qty)),
      ]),
    ];
    downloadCsv('kyasuho_order_list.csv', rows);
  };

  const historyItemName = historyItemId ? items.find((i) => i.id === historyItemId)?.name ?? '' : '';

  return (
    <div>
      <h2 className="admin-page-title">在庫管理</h2>

      {alertItems.length > 0 ? (
        <div className="admin-card" style={{ borderLeft: '4px solid #e53935' }}>
          <div className="admin-section-title" style={{ margin: '0 0 8px', color: '#e53935' }}>
            在庫アラート（しきい値割れ）
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>品目</th>
                  <th className="num">現在庫</th>
                  <th className="num">しきい値</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {alertItems.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong></td>
                    <td className="num" style={{ color: '#e53935' }}>{item.stock_qty} {item.unit}</td>
                    <td className="num">{item.alert_threshold} {item.unit}</td>
                    <td>
                      <button type="button" className="admin-btn primary" onClick={() => openMoveForm(item.id)}>
                        仕入登録
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="admin-btn" onClick={handleOrderListCsv}>
              発注候補CSVダウンロード
            </button>
          </div>
        </div>
      ) : null}

      <div className="admin-date-nav">
        <button type="button" className="admin-btn primary" onClick={() => openItemForm()}>
          品目を追加
        </button>
        <span className="admin-spacer" />
        <button type="button" className="admin-btn" onClick={handleCsv}>
          在庫一覧CSV
        </button>
      </div>

      {formOpen ? (
        <form className="admin-card" onSubmit={handleSaveItem}>
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            {editId ? '品目を編集' : '品目を追加'}
          </div>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="inv-name">品目名</label>
              <input
                id="inv-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="inv-unit">単位</label>
              <input
                id="inv-unit"
                type="text"
                className="w-sm"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="inv-alert">アラートしきい値（空欄=通知なし）</label>
              <input
                id="inv-alert"
                type="number"
                className="w-md"
                min={0}
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-btn-row" style={{ marginTop: 8 }}>
            <button type="submit" className="admin-btn primary" disabled={formBusy}>
              {formBusy ? '保存中…' : editId ? '更新' : '追加'}
            </button>
            <button type="button" className="admin-btn" onClick={() => setFormOpen(false)}>
              キャンセル
            </button>
          </div>
          {formError ? <p className="admin-error">{formError}</p> : null}
        </form>
      ) : null}

      {moveItemId ? (
        <form className="admin-card" onSubmit={handleRecordMove}>
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            入出庫を記録 — {items.find((i) => i.id === moveItemId)?.name}
          </div>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="move-kind">種別</label>
              <select id="move-kind" value={moveKind} onChange={(e) => setMoveKind(e.target.value as KyInventoryMoveKind)}>
                <option value="in">仕入</option>
                <option value="out">廃棄・出庫</option>
                <option value="adjust">棚卸調整</option>
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="move-qty">
                {moveKind === 'adjust' ? '差異数量（正=増・負=減）' : '数量'}
              </label>
              <input
                id="move-qty"
                type="number"
                className="w-md"
                value={moveQty}
                onChange={(e) => setMoveQty(e.target.value)}
              />
            </div>
            <div className="admin-field" style={{ flex: 1 }}>
              <label htmlFor="move-memo">メモ</label>
              <input
                id="move-memo"
                type="text"
                style={{ width: '100%' }}
                value={moveMemo}
                onChange={(e) => setMoveMemo(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-btn-row" style={{ marginTop: 8 }}>
            <button type="submit" className="admin-btn primary" disabled={moveBusy}>
              {moveBusy ? '記録中…' : '記録'}
            </button>
            <button type="button" className="admin-btn" onClick={() => setMoveItemId(null)}>
              キャンセル
            </button>
          </div>
          {moveError ? <p className="admin-error">{moveError}</p> : null}
        </form>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : items.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">
            品目がまだ登録されていません。「品目を追加」ボタンから追加してください。
          </div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>品目名</th>
                <th className="num">現在庫</th>
                <th>単位</th>
                <th className="num">アラート</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const alert = item.is_active && item.alert_threshold !== null && item.stock_qty <= item.alert_threshold;
                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td className="num" style={alert ? { color: '#e53935', fontWeight: 'bold' } : undefined}>
                      {item.stock_qty}
                    </td>
                    <td>{item.unit}</td>
                    <td className="num">{item.alert_threshold ?? '—'}</td>
                    <td>{item.is_active ? '有効' : '無効'}</td>
                    <td>
                      <div className="admin-btn-row">
                        <button type="button" className="admin-btn" onClick={() => openMoveForm(item.id)}>
                          入出庫
                        </button>
                        <button type="button" className="admin-btn" onClick={() => void loadHistory(item.id)}>
                          履歴
                        </button>
                        <button type="button" className="admin-btn" onClick={() => openItemForm(item)}>
                          編集
                        </button>
                        <button
                          type="button"
                          className="admin-btn danger"
                          onClick={() => void handleDeleteItem(item)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {historyItemId ? (
        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            入出庫履歴 — {historyItemName}
          </div>
          {movesLoading ? (
            <div className="admin-empty">読み込み中…</div>
          ) : moves.length === 0 ? (
            <div className="admin-empty">履歴がありません。</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>種別</th>
                    <th className="num">数量</th>
                    <th>メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id}>
                      <td>{fmtDate(m.created_at)}</td>
                      <td>
                        <span className={`admin-badge ${m.kind === 'in' ? 'green' : m.kind === 'out' || m.kind === 'sale' ? 'red' : 'grey'}`}>
                          {MOVE_LABELS[m.kind] ?? m.kind}
                        </span>
                      </td>
                      <td className="num" style={{ color: m.qty < 0 ? '#e53935' : '#43a047' }}>
                        {m.qty > 0 ? '+' : ''}{m.qty}
                      </td>
                      <td>{m.memo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="admin-btn" onClick={() => setHistoryItemId(null)}>
              履歴を閉じる
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
