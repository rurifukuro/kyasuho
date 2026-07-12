import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyTenant, KyVoucher } from '../lib/types';
import { addVoucher, deleteVoucher, fetchVouchers, updateVoucher, useVoucher } from './adminApi';

const VOUCHER_TYPES: { value: string; label: string }[] = [
  { value: 'ticket', label: '回数券' },
  { value: 'cheki', label: 'クーポン券' },
  { value: 'other', label: 'その他' },
];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function AdminVouchers({ tenant }: { tenant: KyTenant }) {
  const [items, setItems] = useState<KyVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fType, setFType] = useState('ticket');
  const [fName, setFName] = useState('');
  const [fCustomer, setFCustomer] = useState('');
  const [fTotal, setFTotal] = useState('5');
  const [fExpiry, setFExpiry] = useState('');
  const [fNote, setFNote] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchVouchers(tenant.id));
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
    setFType('ticket');
    setFName('');
    setFCustomer('');
    setFTotal('5');
    setFExpiry('');
    setFNote('');
    setFormError(null);
  };

  const startEdit = (v: KyVoucher) => {
    setEditingId(v.id);
    setFType(v.voucher_type);
    setFName(v.name);
    setFCustomer(v.customer_name);
    setFTotal(String(v.total_count));
    setFExpiry(v.expiry_date ?? '');
    setFNote(v.note);
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = fName.trim();
    const customerName = fCustomer.trim();
    if (!name || !customerName) {
      setFormError('券名とお客様名は必須です。');
      return;
    }
    const totalCount = parseInt(fTotal, 10);
    if (isNaN(totalCount) || totalCount < 1) {
      setFormError('枚数は1以上を指定してください。');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateVoucher(editingId, {
          voucher_type: fType,
          name,
          customer_name: customerName,
          total_count: totalCount,
          expiry_date: fExpiry || null,
          note: fNote,
        });
      } else {
        await addVoucher(tenant.id, {
          voucherType: fType,
          name,
          customerName,
          totalCount,
          expiryDate: fExpiry || null,
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

  const handleUse = async (v: KyVoucher) => {
    if (v.remaining_count <= 0) return;
    setBusyId(v.id);
    try {
      await useVoucher(v.id);
      await load();
    } catch {
      window.alert('使用記録に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (v: KyVoucher) => {
    setBusyId(v.id);
    try {
      await updateVoucher(v.id, { is_active: !v.is_active });
      await load();
    } catch {
      window.alert('更新に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (v: KyVoucher) => {
    if (!window.confirm(`「${v.customer_name} - ${v.name}」を削除しますか？`)) return;
    setBusyId(v.id);
    try {
      await deleteVoucher(v.id);
      await load();
    } catch {
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const typeLabelMap = new Map(VOUCHER_TYPES.map((t) => [t.value, t.label]));

  return (
    <div>
      <h2 className="admin-page-title">回数券・クーポン券管理</h2>

      <form className="admin-card" onSubmit={handleSubmit}>
        <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
          {editingId ? '券を編集' : '券を発行'}
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="vc-type">種別</label>
            <select id="vc-type" className="w-md" value={fType} onChange={(e) => setFType(e.target.value)}>
              {VOUCHER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="vc-name">券名</label>
            <input id="vc-name" type="text" className="w-md" placeholder="例: ドリンク回数券" value={fName} onChange={(e) => setFName(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label htmlFor="vc-customer">お客様名</label>
            <input id="vc-customer" type="text" className="w-md" value={fCustomer} onChange={(e) => setFCustomer(e.target.value)} required />
          </div>
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="vc-total">枚数</label>
            <input id="vc-total" type="number" className="w-sm" min={1} value={fTotal} onChange={(e) => setFTotal(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label htmlFor="vc-expiry">有効期限（任意）</label>
            <input id="vc-expiry" type="date" className="w-md" value={fExpiry} onChange={(e) => setFExpiry(e.target.value)} />
          </div>
          <div className="admin-field" style={{ flex: 1 }}>
            <label htmlFor="vc-note">メモ（任意）</label>
            <input id="vc-note" type="text" style={{ width: '100%' }} value={fNote} onChange={(e) => setFNote(e.target.value)} />
          </div>
          <button type="submit" className="admin-btn primary" disabled={formBusy}>
            {formBusy ? '保存中…' : editingId ? '更新' : '発行'}
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
          <div className="admin-empty">発行された券はありません。</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>種別</th>
                <th>券名</th>
                <th>お客様名</th>
                <th>残り / 合計</th>
                <th>有効期限</th>
                <th>メモ</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => {
                const expired = v.expiry_date && v.expiry_date < today();
                const used = v.remaining_count <= 0;
                return (
                  <tr key={v.id} style={!v.is_active || expired ? { opacity: 0.5 } : undefined}>
                    <td><span className="admin-badge">{typeLabelMap.get(v.voucher_type) ?? v.voucher_type}</span></td>
                    <td>{v.name}</td>
                    <td>{v.customer_name}</td>
                    <td style={{ fontWeight: 600 }}>{v.remaining_count} / {v.total_count}</td>
                    <td>{v.expiry_date ? fmtDate(v.expiry_date) : '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.note || '—'}</td>
                    <td>
                      <span className={`admin-badge${!v.is_active ? ' st-cancelled' : used ? ' st-no_show' : ''}`}>
                        {!v.is_active ? '無効' : expired ? '期限切れ' : used ? '使い切り' : '有効'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-btn-row">
                        {v.is_active && v.remaining_count > 0 && !expired ? (
                          <button type="button" className="admin-btn primary" disabled={busyId === v.id} onClick={() => void handleUse(v)}>
                            1回使用
                          </button>
                        ) : null}
                        <button type="button" className="admin-btn" disabled={busyId === v.id} onClick={() => startEdit(v)}>編集</button>
                        <button type="button" className="admin-btn" disabled={busyId === v.id} onClick={() => void toggleActive(v)}>
                          {v.is_active ? '無効化' : '復活'}
                        </button>
                        <button type="button" className="admin-btn danger" disabled={busyId === v.id} onClick={() => void handleDelete(v)}>削除</button>
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
