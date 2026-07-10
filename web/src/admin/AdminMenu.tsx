import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyMenuItem, KyMenuCategory, KyTenant } from '../lib/types';
import { fetchMenuItems, upsertMenuItem, deleteMenuItem } from './adminApi';

const CATEGORIES: { value: KyMenuCategory; label: string }[] = [
  { value: 'set', label: 'セット' },
  { value: 'extension', label: '延長' },
  { value: 'nomination', label: '指名' },
  { value: 'cast_drink', label: 'キャストドリンク' },
  { value: 'drink', label: 'ドリンク' },
  { value: 'food', label: 'フード' },
  { value: 'cheki', label: 'チェキ' },
  { value: 'discount', label: '割引' },
  { value: 'other', label: 'その他' },
];

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.value, c.label]));

function yen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

export function AdminMenu({ tenant }: { tenant: KyTenant }) {
  const [items, setItems] = useState<KyMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('');

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fCategory, setFCategory] = useState<KyMenuCategory>('drink');
  const [fName, setFName] = useState('');
  const [fPrice, setFPrice] = useState('');
  const [fNeedsCast, setFNeedsCast] = useState(false);
  const [fSortOrder, setFSortOrder] = useState('0');
  const [fIsActive, setFIsActive] = useState(true);
  const [fBackType, setFBackType] = useState<'default' | 'rate' | 'amount'>('default');
  const [fBackValue, setFBackValue] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMenuItems(tenant.id);
      setItems(data);
    } catch (e) {
      console.warn('[kyasuho] fetchMenuItems failed:', e);
      setError('メニューの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = filterCat ? items.filter((i) => i.category === filterCat) : items;

  const openForm = (item: KyMenuItem | null) => {
    if (item) {
      setEditId(item.id);
      setFCategory(item.category);
      setFName(item.name);
      setFPrice(String(item.price));
      setFNeedsCast(item.needs_cast);
      setFSortOrder(String(item.sort_order));
      setFIsActive(item.is_active);
      if (item.back_amount != null) {
        setFBackType('amount');
        setFBackValue(String(item.back_amount));
      } else if (item.back_rate != null) {
        setFBackType('rate');
        setFBackValue(String(item.back_rate));
      } else {
        setFBackType('default');
        setFBackValue('');
      }
    } else {
      setEditId(null);
      setFCategory('drink');
      setFName('');
      setFPrice('');
      setFNeedsCast(false);
      setFSortOrder('0');
      setFIsActive(true);
      setFBackType('default');
      setFBackValue('');
    }
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formBusy) return;
    const name = fName.trim();
    if (!name) {
      setFormError('品名を入力してください。');
      return;
    }
    const price = Number(fPrice);
    if (!Number.isInteger(price)) {
      setFormError('価格は整数で入力してください。');
      return;
    }
    const sortOrder = Number(fSortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError('表示順は0以上の整数で入力してください。');
      return;
    }
    let backRate: number | null = null;
    let backAmount: number | null = null;
    if (fBackType === 'rate') {
      const v = parseFloat(fBackValue);
      if (isNaN(v) || v < 0 || v > 100) {
        setFormError('バック割合は0〜100の数値で入力してください。');
        return;
      }
      backRate = v;
    } else if (fBackType === 'amount') {
      const v = Number(fBackValue);
      if (!Number.isInteger(v) || v < 0) {
        setFormError('バック固定額は0以上の整数で入力してください。');
        return;
      }
      backAmount = v;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      await upsertMenuItem(tenant.id, {
        id: editId ?? undefined,
        category: fCategory,
        name,
        price,
        needsCast: fNeedsCast,
        sortOrder,
        isActive: fIsActive,
        backRate,
        backAmount,
      });
      setFormOpen(false);
      await load();
    } catch (err) {
      console.warn('[kyasuho] upsertMenuItem failed:', err);
      setFormError('保存に失敗しました。');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (item: KyMenuItem) => {
    if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
    setBusyId(item.id);
    try {
      await deleteMenuItem(item.id);
      await load();
    } catch (e) {
      console.warn('[kyasuho] deleteMenuItem failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h2 className="admin-page-title">メニュー管理</h2>

      <div className="admin-date-nav">
        <div className="admin-field">
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">すべてのカテゴリ</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <span className="admin-spacer" />
        <button type="button" className="admin-btn primary" onClick={() => openForm(null)}>
          メニューを追加
        </button>
      </div>

      {formOpen ? (
        <form className="admin-card" onSubmit={handleSubmit}>
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            {editId ? 'メニューを編集' : '新しいメニューを追加'}
          </div>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="menu-cat">カテゴリ</label>
              <select id="menu-cat" value={fCategory} onChange={(e) => setFCategory(e.target.value as KyMenuCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="menu-name">品名</label>
              <input id="menu-name" type="text" className="w-lg" value={fName} onChange={(e) => setFName(e.target.value)} required />
            </div>
            <div className="admin-field">
              <label htmlFor="menu-price">価格（円）</label>
              <input id="menu-price" type="number" className="w-md" value={fPrice} onChange={(e) => setFPrice(e.target.value)} required />
            </div>
            <div className="admin-field">
              <label htmlFor="menu-sort">表示順</label>
              <input id="menu-sort" type="number" className="w-sm" min={0} value={fSortOrder} onChange={(e) => setFSortOrder(e.target.value)} />
            </div>
          </div>
          <div className="admin-form-row" style={{ marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={fNeedsCast} onChange={(e) => setFNeedsCast(e.target.checked)} />
              キャスト紐付け
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={fIsActive} onChange={(e) => setFIsActive(e.target.checked)} />
              有効
            </label>
          </div>
          <div className="admin-form-row" style={{ marginTop: 8 }}>
            <div className="admin-field">
              <label>キャストバック</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {([['default', '基本割合'], ['rate', '割合%'], ['amount', '固定円']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`admin-btn${fBackType === val ? ' primary' : ''}`}
                    style={{ fontSize: 13, padding: '4px 10px' }}
                    onClick={() => { setFBackType(val); setFBackValue(''); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {fBackType === 'rate' && (
              <div className="admin-field">
                <label htmlFor="menu-back-rate">割合（%）</label>
                <input id="menu-back-rate" type="number" className="w-sm" min={0} max={100} step={0.01} value={fBackValue} onChange={(e) => setFBackValue(e.target.value)} required />
              </div>
            )}
            {fBackType === 'amount' && (
              <div className="admin-field">
                <label htmlFor="menu-back-amount">固定額（円）</label>
                <input id="menu-back-amount" type="number" className="w-sm" min={0} step={1} value={fBackValue} onChange={(e) => setFBackValue(e.target.value)} required />
              </div>
            )}
          </div>
          <div className="admin-btn-row" style={{ marginTop: 12 }}>
            <button type="submit" className="admin-btn primary" disabled={formBusy}>
              {formBusy ? '保存中…' : '保存'}
            </button>
            <button type="button" className="admin-btn" onClick={() => setFormOpen(false)}>
              閉じる
            </button>
          </div>
          {formError ? <p className="admin-error">{formError}</p> : null}
        </form>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : filtered.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">
            {filterCat ? 'このカテゴリのメニューはありません。' : 'メニューが登録されていません。「メニューを追加」から登録してください。'}
          </div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>カテゴリ</th>
                <th>品名</th>
                <th className="num">価格</th>
                <th>キャスト</th>
                <th>バック</th>
                <th>状態</th>
                <th className="num">順序</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} style={!item.is_active ? { opacity: 0.5 } : undefined}>
                  <td>{CATEGORY_LABEL.get(item.category) ?? item.category}</td>
                  <td>{item.name}</td>
                  <td className="num">{yen(item.price)}</td>
                  <td>{item.needs_cast ? '要' : '—'}</td>
                  <td>
                    {item.back_amount != null ? (
                      <span className="admin-badge blue">{yen(item.back_amount)}</span>
                    ) : item.back_rate != null ? (
                      <span className="admin-badge blue">{item.back_rate}%</span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>基本</span>
                    )}
                  </td>
                  <td>
                    <span className={`admin-badge ${item.is_active ? 'green' : 'gray'}`}>
                      {item.is_active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="num">{item.sort_order}</td>
                  <td>
                    <div className="admin-btn-row">
                      <button type="button" className="admin-btn" onClick={() => openForm(item)}>
                        編集
                      </button>
                      <button
                        type="button"
                        className="admin-btn danger"
                        disabled={busyId === item.id}
                        onClick={() => void handleDelete(item)}
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
