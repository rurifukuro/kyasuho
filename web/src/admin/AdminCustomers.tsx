import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyCustomer, KyStampSettings, KyTenant } from '../lib/types';
import {
  fetchCustomerList,
  addCustomerRecord,
  updateCustomerRecord,
  deleteCustomerRecord,
  fetchStampSettingsRecord,
  saveStampSettingsRecord,
} from './adminApi';

function formatDate(d: string | null): string {
  if (!d) return '—';
  return d.replace(/-/g, '/');
}

export function AdminCustomers({ tenant }: { tenant: KyTenant }) {
  const [customers, setCustomers] = useState<KyCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [stampSettings, setStampSettings] = useState<KyStampSettings | null>(null);
  const [stampActive, setStampActive] = useState(false);
  const [stampsPerVisit, setStampsPerVisit] = useState('1');
  const [rewardThreshold, setRewardThreshold] = useState('10');
  const [rewardDescription, setRewardDescription] = useState('');
  const [stampSaving, setStampSaving] = useState(false);
  const [showStampPanel, setShowStampPanel] = useState(false);

  const [editing, setEditing] = useState<KyCustomer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fName, setFName] = useState('');
  const [fKana, setFKana] = useState('');
  const [fContact, setFContact] = useState('');
  const [fPersona, setFPersona] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fBanned, setFBanned] = useState(false);
  const [fBanReason, setFBanReason] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, ss] = await Promise.all([
        fetchCustomerList(tenant.id),
        fetchStampSettingsRecord(tenant.id),
      ]);
      setCustomers(list);
      setStampSettings(ss);
      if (ss) {
        setStampActive(ss.is_active);
        setStampsPerVisit(String(ss.stamps_per_visit));
        setRewardThreshold(String(ss.reward_threshold));
        setRewardDescription(ss.reward_description);
      }
    } catch (e) {
      setError('データの取得に失敗しました。');
      console.warn('[kyasuho] AdminCustomers loadData:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.name_kana.toLowerCase().includes(q) ||
        c.contact.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const openNew = () => {
    setEditing(null);
    setFName('');
    setFKana('');
    setFContact('');
    setFPersona('');
    setFNotes('');
    setFBanned(false);
    setFBanReason('');
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (c: KyCustomer) => {
    setEditing(c);
    setFName(c.name);
    setFKana(c.name_kana);
    setFContact(c.contact);
    setFPersona(c.persona_notes);
    setFNotes(c.internal_notes);
    setFBanned(c.is_banned);
    setFBanReason(c.ban_reason);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fName.trim()) {
      setFormError('お名前を入力してください。');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await updateCustomerRecord(editing.id, {
          name: fName.trim(),
          name_kana: fKana.trim(),
          contact: fContact.trim(),
          persona_notes: fPersona.trim(),
          internal_notes: fNotes.trim(),
          is_banned: fBanned,
          ban_reason: fBanned ? fBanReason.trim() : '',
        });
      } else {
        await addCustomerRecord(tenant.id, {
          name: fName.trim(),
          name_kana: fKana.trim(),
          contact: fContact.trim(),
          persona_notes: fPersona.trim(),
          internal_notes: fNotes.trim(),
        });
      }
      setShowForm(false);
      await loadData();
    } catch (err) {
      setFormError('保存に失敗しました。');
      console.warn('[kyasuho] customer save:', err);
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (c: KyCustomer) => {
    if (!window.confirm(`「${c.name}」を削除しますか？`)) return;
    try {
      await deleteCustomerRecord(c.id);
      await loadData();
      if (editing?.id === c.id) setShowForm(false);
    } catch (err) {
      console.warn('[kyasuho] customer delete:', err);
    }
  };

  const handleStampSave = async () => {
    setStampSaving(true);
    try {
      await saveStampSettingsRecord(tenant.id, {
        stamps_per_visit: parseInt(stampsPerVisit, 10) || 1,
        reward_threshold: parseInt(rewardThreshold, 10) || 10,
        reward_description: rewardDescription.trim(),
        is_active: stampActive,
      });
      await loadData();
    } catch (err) {
      console.warn('[kyasuho] stamp save:', err);
    } finally {
      setStampSaving(false);
    }
  };

  if (loading) return <div className="loading">読み込み中…</div>;
  if (error) return <div className="admin-error">{error}</div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2>顧客管理</h2>
        <div className="admin-btn-row">
          <button
            type="button"
            className="admin-btn"
            onClick={() => setShowStampPanel(!showStampPanel)}
          >
            {showStampPanel ? 'スタンプ設定を閉じる' : 'スタンプ設定'}
          </button>
          <button type="button" className="admin-btn primary" onClick={openNew}>
            ＋ 顧客を追加
          </button>
        </div>
      </div>

      {showStampPanel && (
        <div className="admin-card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>スタンプ設定</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={stampActive}
                onChange={(e) => setStampActive(e.target.checked)}
              />
              スタンプ機能を有効にする
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>
                <span className="admin-form-label">1回あたりのスタンプ数</span>
                <input
                  type="number"
                  className="admin-input"
                  value={stampsPerVisit}
                  onChange={(e) => setStampsPerVisit(e.target.value)}
                  min="1"
                  max="100"
                />
              </label>
              <label>
                <span className="admin-form-label">特典に必要なスタンプ数</span>
                <input
                  type="number"
                  className="admin-input"
                  value={rewardThreshold}
                  onChange={(e) => setRewardThreshold(e.target.value)}
                  min="1"
                  max="1000"
                />
              </label>
            </div>
            <label>
              <span className="admin-form-label">特典内容</span>
              <input
                type="text"
                className="admin-input"
                value={rewardDescription}
                onChange={(e) => setRewardDescription(e.target.value)}
                placeholder="例：ドリンク1杯無料"
              />
            </label>
            <button
              type="button"
              className="admin-btn primary"
              onClick={() => void handleStampSave()}
              disabled={stampSaving}
              style={{ alignSelf: 'flex-start' }}
            >
              {stampSaving ? '保存中…' : 'スタンプ設定を保存'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          className="admin-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="名前・連絡先で検索"
          style={{ maxWidth: 320 }}
        />
        <span style={{ marginLeft: 12, color: '#666', fontSize: 14 }}>
          {filtered.length}件{search.trim() ? ` / ${customers.length}件` : ''}
        </span>
      </div>

      {showForm && (
        <div className="admin-card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>
            {editing ? '顧客編集' : '顧客追加'}
          </h3>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>
                <span className="admin-form-label">お名前 *</span>
                <input
                  type="text"
                  className="admin-input"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  required
                />
              </label>
              <label>
                <span className="admin-form-label">ふりがな</span>
                <input
                  type="text"
                  className="admin-input"
                  value={fKana}
                  onChange={(e) => setFKana(e.target.value)}
                  placeholder="おなまえ（ソート用）"
                />
              </label>
            </div>
            <label style={{ display: 'block', marginTop: 10 }}>
              <span className="admin-form-label">連絡先</span>
              <input
                type="text"
                className="admin-input"
                value={fContact}
                onChange={(e) => setFContact(e.target.value)}
                placeholder="電話番号・LINE等"
              />
            </label>
            <label style={{ display: 'block', marginTop: 10 }}>
              <span className="admin-form-label">人物像・特徴</span>
              <textarea
                className="admin-input"
                value={fPersona}
                onChange={(e) => setFPersona(e.target.value)}
                placeholder="性格、好み、雰囲気など"
                rows={2}
              />
            </label>
            <label style={{ display: 'block', marginTop: 10 }}>
              <span className="admin-form-label">社内メモ</span>
              <textarea
                className="admin-input"
                value={fNotes}
                onChange={(e) => setFNotes(e.target.value)}
                placeholder="接客時の注意点など"
                rows={2}
              />
            </label>
            {editing && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={fBanned}
                    onChange={(e) => setFBanned(e.target.checked)}
                  />
                  出禁
                </label>
                {fBanned && (
                  <label style={{ display: 'block', marginTop: 6 }}>
                    <span className="admin-form-label">出禁理由</span>
                    <input
                      type="text"
                      className="admin-input"
                      value={fBanReason}
                      onChange={(e) => setFBanReason(e.target.value)}
                      placeholder="理由を記録"
                    />
                  </label>
                )}
              </>
            )}
            {formError && <p className="admin-error">{formError}</p>}
            <div className="admin-btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="admin-btn primary" disabled={formBusy}>
                {formBusy ? '保存中…' : '保存'}
              </button>
              <button type="button" className="admin-btn" onClick={() => setShowForm(false)}>
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="admin-empty">顧客がまだ登録されていません</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>お名前</th>
              <th>ふりがな</th>
              <th>連絡先</th>
              <th>スタンプ</th>
              <th>来店数</th>
              <th>最終来店</th>
              <th>状態</th>
              <th style={{ width: 120 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  {c.persona_notes && (
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                      {c.persona_notes.length > 30
                        ? c.persona_notes.slice(0, 30) + '…'
                        : c.persona_notes}
                    </div>
                  )}
                </td>
                <td>{c.name_kana || '—'}</td>
                <td>{c.contact || '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {c.stamp_count}
                  {stampSettings?.is_active && stampSettings.reward_threshold > 0 &&
                    c.stamp_count >= stampSettings.reward_threshold && (
                    <span
                      style={{
                        display: 'inline-block',
                        background: '#FEF3C7',
                        color: '#D97706',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        marginLeft: 6,
                      }}
                    >
                      特典
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>{c.total_visits}回</td>
                <td>{formatDate(c.last_visit_date)}</td>
                <td>
                  {c.is_banned ? (
                    <span
                      style={{
                        background: '#FEE2E2',
                        color: '#DC2626',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      出禁
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <div className="admin-btn-row">
                    <button
                      type="button"
                      className="admin-btn small"
                      onClick={() => openEdit(c)}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="admin-btn small danger"
                      onClick={() => void handleDelete(c)}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
