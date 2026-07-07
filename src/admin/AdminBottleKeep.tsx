import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyBottleKeep, KyTenant } from '../lib/types';
import { addBottleKeep, deleteBottleKeep, fetchBottleKeeps, updateBottleKeep } from './adminApi';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function AdminBottleKeep({ tenant }: { tenant: KyTenant }) {
  const [items, setItems] = useState<KyBottleKeep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fCustomer, setFCustomer] = useState('');
  const [fItem, setFItem] = useState('');
  const [fStart, setFStart] = useState(today);
  const [fExpiry, setFExpiry] = useState('');
  const [fRemaining, setFRemaining] = useState('');
  const [fNote, setFNote] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchBottleKeeps(tenant.id));
    } catch {
      setError('データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setFCustomer('');
    setFItem('');
    setFStart(today());
    setFExpiry('');
    setFRemaining('');
    setFNote('');
    setFormError(null);
  };

  const startEdit = (b: KyBottleKeep) => {
    setEditingId(b.id);
    setFCustomer(b.customer_name);
    setFItem(b.item_name);
    setFStart(b.start_date);
    setFExpiry(b.expiry_date ?? '');
    setFRemaining(b.remaining);
    setFNote(b.note);
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const customerName = fCustomer.trim();
    const itemName = fItem.trim();
    if (!customerName || !itemName) {
      setFormError('お客様名とボトル名は必須です。');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateBottleKeep(editingId, {
          customer_name: customerName,
          item_name: itemName,
          start_date: fStart,
          expiry_date: fExpiry || null,
          remaining: fRemaining,
          note: fNote,
        });
      } else {
        await addBottleKeep(tenant.id, {
          customerName,
          itemName,
          startDate: fStart,
          expiryDate: fExpiry || null,
          remaining: fRemaining,
          note: fNote,
        });
      }
      resetForm();
      await load();
    } catch {
      setFormError('保存に失敗しました。');
    } finally {
      setFormBusy(false);
    }
  };

  const toggleActive = async (b: KyBottleKeep) => {
    setBusyId(b.id);
    try {
      await updateBottleKeep(b.id, { is_active: !b.is_active });
      await load();
    } catch {
      window.alert('更新に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (b: KyBottleKeep) => {
    if (!window.confirm(`「${b.customer_name} - ${b.item_name}」を削除しますか？`)) return;
    setBusyId(b.id);
    try {
      await deleteBottleKeep(b.id);
      await load();
    } catch {
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h2 className="admin-page-title">ボトルキープ管理</h2>

      <form className="admin-card" onSubmit={handleSubmit}>
        <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
          {editingId ? 'ボトルキープを編集' : 'ボトルキープを登録'}
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="bk-customer">お客様名</label>
            <input id="bk-customer" type="text" className="w-md" value={fCustomer} onChange={(e) => setFCustomer(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label htmlFor="bk-item">ボトル名</label>
            <input id="bk-item" type="text" className="w-md" value={fItem} onChange={(e) => setFItem(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label htmlFor="bk-remaining">残量</label>
            <input id="bk-remaining" type="text" className="w-sm" placeholder="例: 1/3" value={fRemaining} onChange={(e) => setFRemaining(e.target.value)} />
          </div>
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="bk-start">預かり日</label>
            <input id="bk-start" type="date" className="w-md" value={fStart} onChange={(e) => setFStart(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label htmlFor="bk-expiry">期限（任意）</label>
            <input id="bk-expiry" type="date" className="w-md" value={fExpiry} onChange={(e) => setFExpiry(e.target.value)} />
          </div>
          <div className="admin-field" style={{ flex: 1 }}>
            <label htmlFor="bk-note">メモ（任意）</label>
            <input id="bk-note" type="text" style={{ width: '100%' }} value={fNote} onChange={(e) => setFNote(e.target.value)} />
          </div>
          <button type="submit" className="admin-btn primary" disabled={formBusy}>
            {formBusy ? '保存中…' : editingId ? '更新' : '登録'}
          </button>
          {editingId ? (
            <button type="button" className="admin-btn" onClick={resetForm}>キャンセル</button>
          ) : null}
        </div>
        {formError ? <p className="admin-error">{formError}</p> : null}
      </form>

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : items.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">登録されたボトルキープはありません。</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>お客様名</th>
                <th>ボトル名</th>
                <th>残量</th>
                <th>預かり日</th>
                <th>期限</th>
                <th>メモ</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => {
                const expired = b.expiry_date && b.expiry_date < today();
                return (
                  <tr key={b.id} style={!b.is_active || expired ? { opacity: 0.5 } : undefined}>
                    <td>{b.customer_name}</td>
                    <td>{b.item_name}</td>
                    <td>{b.remaining || '—'}</td>
                    <td>{fmtDate(b.start_date)}</td>
                    <td>{b.expiry_date ? fmtDate(b.expiry_date) : '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.note || '—'}</td>
                    <td>
                      <span className={`admin-badge${b.is_active ? '' : ' st-cancelled'}`}>
                        {b.is_active ? (expired ? '期限切れ' : '保管中') : '返却済'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-btn-row">
                        <button type="button" className="admin-btn" disabled={busyId === b.id} onClick={() => startEdit(b)}>編集</button>
                        <button type="button" className="admin-btn" disabled={busyId === b.id} onClick={() => void toggleActive(b)}>
                          {b.is_active ? '返却' : '復活'}
                        </button>
                        <button type="button" className="admin-btn danger" disabled={busyId === b.id} onClick={() => void handleDelete(b)}>削除</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
