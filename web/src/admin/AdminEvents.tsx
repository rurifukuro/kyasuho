import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyEvent, KyTenant } from '../lib/types';
import { addEvent, deleteEvent, fetchEvents, updateEvent } from './adminApi';

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'birthday', label: '生誕祭' },
  { value: 'anniversary', label: '周年記念' },
  { value: 'collab', label: 'コラボイベント' },
  { value: 'theme', label: 'テーマイベント' },
  { value: 'holiday', label: '季節・祝日' },
  { value: 'other', label: 'その他' },
];

function fmtDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtTime(t: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AdminEvents({ tenant }: { tenant: KyTenant }) {
  const [events, setEvents] = useState<KyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState(today);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formType, setFormType] = useState('other');
  const [formPublic, setFormPublic] = useState(true);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchEvents(tenant.id);
      setEvents(rows);
    } catch (e) {
      console.warn('[kyasuho] fetchEvents failed:', e);
      setError('イベントの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormDesc('');
    setFormDate(today());
    setFormStart('');
    setFormEnd('');
    setFormType('other');
    setFormPublic(true);
    setFormError(null);
  };

  const startEdit = (ev: KyEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormDesc(ev.description);
    setFormDate(ev.event_date);
    setFormStart(ev.start_time ? fmtTime(ev.start_time) : '');
    setFormEnd(ev.end_time ? fmtTime(ev.end_time) : '');
    setFormType(ev.event_type);
    setFormPublic(ev.is_public);
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) {
      setFormError('タイトルを入力してください。');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      const input = {
        title,
        description: formDesc.trim(),
        eventDate: formDate,
        startTime: formStart || null,
        endTime: formEnd || null,
        eventType: formType,
        isPublic: formPublic,
      };
      if (editingId) {
        await updateEvent(editingId, input);
      } else {
        await addEvent(tenant.id, input);
      }
      resetForm();
      await load();
    } catch (err) {
      console.warn('[kyasuho] event save failed:', err);
      setFormError('保存に失敗しました。');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (ev: KyEvent) => {
    if (!window.confirm(`「${ev.title}」を削除しますか？`)) return;
    setBusyId(ev.id);
    try {
      await deleteEvent(ev.id);
      await load();
    } catch (e) {
      console.warn('[kyasuho] deleteEvent failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const typeLabelMap = new Map(EVENT_TYPES.map((t) => [t.value, t.label]));

  return (
    <div>
      <h2 className="admin-page-title">イベントカレンダー</h2>

      <form className="admin-card" onSubmit={handleSubmit}>
        <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
          {editingId ? 'イベントを編集' : 'イベントを追加'}
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="ev-title">タイトル</label>
            <input id="ev-title" type="text" className="w-lg" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label htmlFor="ev-date">日付</label>
            <input id="ev-date" type="date" className="w-md" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
          </div>
          <div className="admin-field">
            <label htmlFor="ev-type">種別</label>
            <select id="ev-type" className="w-md" value={formType} onChange={(e) => setFormType(e.target.value)}>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="ev-start">開始時刻（任意）</label>
            <input id="ev-start" type="time" className="w-md" step={600} value={formStart} onChange={(e) => setFormStart(e.target.value)} />
          </div>
          <div className="admin-field">
            <label htmlFor="ev-end">終了時刻（任意）</label>
            <input id="ev-end" type="time" className="w-md" step={600} value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
          </div>
          <div className="admin-field">
            <label htmlFor="ev-public">公開</label>
            <select id="ev-public" className="w-md" value={formPublic ? 'yes' : 'no'} onChange={(e) => setFormPublic(e.target.value === 'yes')}>
              <option value="yes">公開する</option>
              <option value="no">非公開</option>
            </select>
          </div>
        </div>
        <div className="admin-form-row">
          <div className="admin-field" style={{ flex: 1 }}>
            <label htmlFor="ev-desc">説明（任意）</label>
            <input id="ev-desc" type="text" style={{ width: '100%' }} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          </div>
          <button type="submit" className="admin-btn primary" disabled={formBusy}>
            {formBusy ? '保存中…' : editingId ? '更新' : '追加'}
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
      ) : events.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">登録されたイベントはありません。</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>タイトル</th>
                <th>種別</th>
                <th>時間</th>
                <th>公開</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const isPast = ev.event_date < today();
                return (
                  <tr key={ev.id} style={isPast ? { opacity: 0.5 } : undefined}>
                    <td>{fmtDate(ev.event_date)}</td>
                    <td>
                      {ev.title}
                      {ev.description ? <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ev.description}</div> : null}
                    </td>
                    <td><span className="admin-badge">{typeLabelMap.get(ev.event_type) ?? ev.event_type}</span></td>
                    <td>{fmtTime(ev.start_time)}{ev.start_time && ev.end_time ? `〜${fmtTime(ev.end_time)}` : ''}</td>
                    <td>{ev.is_public ? '✓' : '—'}</td>
                    <td>
                      <div className="admin-btn-row">
                        <button type="button" className="admin-btn" disabled={busyId === ev.id} onClick={() => startEdit(ev)}>編集</button>
                        <button type="button" className="admin-btn danger" disabled={busyId === ev.id} onClick={() => void handleDelete(ev)}>削除</button>
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
