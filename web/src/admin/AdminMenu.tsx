import { useCallback, useEffect, useState, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import type { KyMenuItem, KyMenuCategory, KyTenant } from '../lib/types';
import { fetchMenuItems, upsertMenuItem, deleteMenuItem, fetchMenuOcrUsage, ocrMenuImage } from './adminApi';

const NOMINATION_KINDS: { value: string; label: string }[] = [
  { value: '', label: '種別なし' },
  { value: 'honshimei', label: '本指名' },
  { value: 'jounai', label: '場内指名' },
];

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
  const [fRemotePrice, setFRemotePrice] = useState('');
  const [fBackType, setFBackType] = useState<'default' | 'rate' | 'amount'>('default');
  const [fBackValue, setFBackValue] = useState('');
  const [fNominationKind, setFNominationKind] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [ocrUsage, setOcrUsage] = useState(0);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrResults, setOcrResults] = useState<{ name: string; price: number; remotePrice: number | null; category: string; selected: boolean }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, usage] = await Promise.all([
        fetchMenuItems(tenant.id),
        fetchMenuOcrUsage(tenant.id),
      ]);
      setItems(data);
      setOcrUsage(usage);
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
      setFRemotePrice(item.remote_price != null ? String(item.remote_price) : '');
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
      setFNominationKind(item.nomination_kind ?? '');
    } else {
      setEditId(null);
      setFCategory('drink');
      setFName('');
      setFPrice('');
      setFRemotePrice('');
      setFNeedsCast(false);
      setFSortOrder('0');
      setFIsActive(true);
      setFBackType('default');
      setFBackValue('');
      setFNominationKind('');
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
      const remotePrice = fRemotePrice.trim() ? Number(fRemotePrice) : null;
      await upsertMenuItem(tenant.id, {
        id: editId ?? undefined,
        category: fCategory,
        name,
        price,
        remotePrice: (remotePrice != null && Number.isInteger(remotePrice)) ? remotePrice : null,
        needsCast: fNeedsCast,
        sortOrder,
        isActive: fIsActive,
        backRate,
        backAmount,
        nominationKind: (fCategory === 'nomination' && tenant.nomination_kinds_enabled && fNominationKind) ? fNominationKind : null,
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

  const handleOcrFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (ocrUsage >= 20) {
      window.alert('今月の読取り回数上限（20回）に達しています。');
      return;
    }
    setOcrBusy(true);
    setOcrResults([]);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string | null;
          if (!result) { reject(new Error('empty')); return; }
          resolve(result.split(',')[1] ?? '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const results = await ocrMenuImage(tenant.id, base64);
      setOcrResults(results.map((r) => ({ name: r.name, price: r.price, remotePrice: r.remotePrice, category: r.category, selected: true })));
      setOcrUsage((prev) => prev + 1);
    } catch (err) {
      console.warn('[kyasuho] ocrMenuImage failed:', err);
      window.alert('読取りに失敗しました。');
    } finally {
      setOcrBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOcrImport = async () => {
    const selected = ocrResults.filter((r) => r.selected);
    if (selected.length === 0) return;
    setFormBusy(true);
    try {
      for (const item of selected) {
        await upsertMenuItem(tenant.id, {
          category: item.category as KyMenuCategory,
          name: item.name,
          price: item.price,
          remotePrice: item.remotePrice,
          needsCast: false,
          sortOrder: 0,
          isActive: true,
          backRate: null,
          backAmount: null,
          nominationKind: null,
        });
      }
      setOcrResults([]);
      await load();
    } catch (err) {
      console.warn('[kyasuho] ocrImport failed:', err);
      window.alert('一括追加に失敗しました。');
    } finally {
      setFormBusy(false);
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
        <button type="button" className="admin-btn" onClick={() => fileInputRef.current?.click()} disabled={ocrBusy || ocrUsage >= 20}>
          {ocrBusy ? '読取り中…' : `お品書き読取り (${ocrUsage}/20)`}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleOcrFile} />
        <button type="button" className="admin-btn primary" onClick={() => openForm(null)}>
          メニューを追加
        </button>
      </div>

      {ocrResults.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 12 }}>
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            読取り結果（{ocrResults.filter((r) => r.selected).length}/{ocrResults.length}件選択中）
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>品名</th>
                  <th className="num">価格</th>
                  <th className="num">遠隔</th>
                  <th>カテゴリ</th>
                </tr>
              </thead>
              <tbody>
                {ocrResults.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={(e) => {
                          setOcrResults((prev) => prev.map((item, idx) =>
                            idx === i ? { name: item.name, price: item.price, remotePrice: item.remotePrice, category: item.category, selected: e.target.checked } : item
                          ));
                        }}
                      />
                    </td>
                    <td>{r.name}</td>
                    <td className="num">{yen(r.price)}</td>
                    <td className="num">{r.remotePrice != null ? yen(r.remotePrice) : '—'}</td>
                    <td>{CATEGORY_LABEL.get(r.category as KyMenuCategory) ?? r.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="admin-btn primary" onClick={handleOcrImport} disabled={formBusy}>
              {formBusy ? '追加中…' : '選択したメニューを一括追加'}
            </button>
            <button type="button" className="admin-btn" onClick={() => setOcrResults([])}>
              閉じる
            </button>
          </div>
        </div>
      )}

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
              <label htmlFor="menu-remote-price">遠隔価格（円・空欄＝対応なし）</label>
              <input id="menu-remote-price" type="number" className="w-md" value={fRemotePrice} onChange={(e) => setFRemotePrice(e.target.value)} placeholder="遠隔時の価格" />
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
          {fCategory === 'nomination' && tenant.nomination_kinds_enabled && (
            <div className="admin-form-row" style={{ marginTop: 8 }}>
              <div className="admin-field">
                <label htmlFor="menu-nom-kind">指名種別</label>
                <select id="menu-nom-kind" value={fNominationKind} onChange={(e) => setFNominationKind(e.target.value)}>
                  {NOMINATION_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  本指名・場内指名ごとに別メニューを作成すると、料金やバック率を個別に設定できます。
                </span>
              </div>
            </div>
          )}
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
                <th className="num">遠隔</th>
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
                  <td>
                    {item.name}
                    {item.nomination_kind && (
                      <span className="admin-badge blue" style={{ marginLeft: 6, fontSize: 11 }}>
                        {item.nomination_kind === 'honshimei' ? '本指名' : item.nomination_kind === 'jounai' ? '場内指名' : item.nomination_kind}
                      </span>
                    )}
                  </td>
                  <td className="num">{yen(item.price)}</td>
                  <td className="num">{item.remote_price != null ? yen(item.remote_price) : '—'}</td>
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
