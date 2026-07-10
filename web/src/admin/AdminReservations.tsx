import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyCast, KyReservationFull, KyTenant } from '../lib/types';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/timeUtils';
import {
  adminMakeReservation,
  countNoShowByContacts,
  fetchAllReservations,
  fetchCastList,
  removeReservation,
  updateReservationStatus,
} from './adminApi';

const STATUS_LABELS: Record<KyReservationFull['status'], string> = {
  reserved: '予約中',
  checked_in: '来店済み',
  cancelled: 'キャンセル',
  no_show: '無断キャンセル',
};

/** DBのtime型は 'HH:MM:SS' で返ることがあるため表示は先頭5文字に揃える。 */
function fmtTime(value: string): string {
  return value.slice(0, 5);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function AdminReservations({ tenant }: { tenant: KyTenant }) {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [items, setItems] = useState<KyReservationFull[]>([]);
  const [casts, setCasts] = useState<KyCast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addSlot, setAddSlot] = useState('18:00');
  const [addName, setAddName] = useState('');
  const [addContact, setAddContact] = useState('');
  const [addParty, setAddParty] = useState('1');
  const [addCastId, setAddCastId] = useState('');
  const [addNote, setAddNote] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [noShowMap, setNoShowMap] = useState<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAllReservations(tenant.id, date);
      setItems(rows);
      const contacts = rows.map((r) => r.contact).filter(Boolean);
      if (contacts.length > 0) {
        const nsMap = await countNoShowByContacts(tenant.id, contacts);
        setNoShowMap(nsMap);
      } else {
        setNoShowMap(new Map());
      }
    } catch (e) {
      console.warn('[kyasuho] fetchAllReservations failed:', e);
      setError('予約の取得に失敗しました。再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, date]);

  useEffect(() => {
    void load();
  }, [load]);

  // §24: Supabase Realtime — 予約の追加・変更を台帳へ自動反映（アプリ/客Webからの書き込みも拾う）
  useEffect(() => {
    const channel = supabase
      .channel(`ky-reservations-admin-${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ky_reservations', filter: `tenant_id=eq.${tenant.id}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenant.id, load]);

  useEffect(() => {
    fetchCastList(tenant.id)
      .then(setCasts)
      .catch((e) => {
        console.warn('[kyasuho] fetchCastList failed:', e);
      });
  }, [tenant.id]);

  const castNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of casts) map.set(c.id, c.name);
    return map;
  }, [casts]);

  const activeCount = useMemo(
    () => items.filter((r) => r.status === 'reserved' || r.status === 'checked_in').length,
    [items],
  );

  const changeStatus = async (
    row: KyReservationFull,
    status: KyReservationFull['status'],
    confirmMessage?: string,
  ) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setBusyId(row.id);
    try {
      await updateReservationStatus(row.id, status);
      await load();
    } catch (e) {
      console.warn('[kyasuho] updateReservationStatus failed:', e);
      window.alert('ステータスの変更に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row: KyReservationFull) => {
    if (
      !window.confirm(
        `${fmtTime(row.slot)} ${row.customer_name} 様の予約記録を削除します。よろしいですか？`,
      )
    ) {
      return;
    }
    if (!window.confirm('削除すると元に戻せません。本当に削除しますか？')) return;
    setBusyId(row.id);
    try {
      await removeReservation(row.id);
      await load();
    } catch (e) {
      console.warn('[kyasuho] removeReservation failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (addBusy) return;
    const name = addName.trim();
    if (!name) {
      setAddError('お名前を入力してください。');
      return;
    }
    const party = Number(addParty);
    if (!Number.isInteger(party) || party < 1) {
      setAddError('人数は1以上で入力してください。');
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      const result = await adminMakeReservation({
        tenantId: tenant.id,
        date,
        slot: addSlot,
        customerName: name,
        contact: addContact.trim(),
        partySize: party,
        castId: addCastId || null,
        note: addNote.trim(),
      });
      if (result.error === 'no_available_seat') {
        setAddError('この時間は満席のため登録できません。');
        return;
      }
      if (result.error === 'not_unlocked') {
        setAddError('この日時に受付枠がありません。先に「受付設定」で枠を作成してください。');
        return;
      }
      if (result.error === 'cast_not_available') {
        setAddError('指名キャストはこの時間に出勤していないか、指名を受け付けていません。');
        return;
      }
      setAddName('');
      setAddContact('');
      setAddParty('1');
      setAddCastId('');
      setAddNote('');
      await load();
    } catch (err) {
      console.warn('[kyasuho] adminMakeReservation failed:', err);
      setAddError('予約の登録に失敗しました。');
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div>
      <h2 className="admin-page-title">予約台帳</h2>

      <div className="admin-date-nav">
        <button type="button" className="admin-btn" onClick={() => setDate(shiftDate(date, -1))}>
          ◀ 前日
        </button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="admin-btn" onClick={() => setDate(shiftDate(date, 1))}>
          翌日 ▶
        </button>
        <button type="button" className="admin-btn" onClick={() => setDate(formatDate(new Date()))}>
          今日
        </button>
        <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
          有効な予約 {activeCount} 件
        </span>
        <button
          type="button"
          className="admin-btn primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => setAddOpen((v) => !v)}
        >
          {addOpen ? '追加フォームを閉じる' : '＋ 予約を手動追加'}
        </button>
      </div>

      {addOpen ? (
        <form className="admin-card" onSubmit={handleAdd}>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="add-slot">開始時刻</label>
              <input
                id="add-slot"
                type="time"
                className="w-md"
                step={600}
                value={addSlot}
                onChange={(e) => setAddSlot(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="add-name">お名前</label>
              <input
                id="add-name"
                type="text"
                className="w-md"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="add-party">人数</label>
              <input
                id="add-party"
                type="number"
                className="w-sm"
                min={1}
                value={addParty}
                onChange={(e) => setAddParty(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="add-contact">連絡先（任意）</label>
              <input
                id="add-contact"
                type="text"
                className="w-md"
                value={addContact}
                onChange={(e) => setAddContact(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="add-cast">指名（任意）</label>
              <select
                id="add-cast"
                className="w-md"
                value={addCastId}
                onChange={(e) => setAddCastId(e.target.value)}
              >
                <option value="">指名なし</option>
                {casts
                  .filter((c) => c.accepts_nomination)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="add-note">メモ（任意）</label>
              <input
                id="add-note"
                type="text"
                className="w-lg"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
              />
            </div>
            <button type="submit" className="admin-btn primary" disabled={addBusy}>
              {addBusy ? '登録中…' : '登録'}
            </button>
          </div>
          {addError ? <p className="admin-error">{addError}</p> : null}
          <p className="admin-note">
            席は空き状況から自動で割り当てられます。電話予約などをその場で台帳に載せる用途です。
          </p>
        </form>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : items.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">この日の予約はありません。</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>時間</th>
                <th>席</th>
                <th>お名前</th>
                <th className="num">人数</th>
                <th>指名</th>
                <th>連絡先</th>
                <th>メモ</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const busy = busyId === row.id;
                return (
                  <tr key={row.id}>
                    <td>
                      {fmtTime(row.slot)}（{row.set_minutes}分）
                    </td>
                    <td>{row.seat_no != null ? `${row.seat_no}番` : '—'}</td>
                    <td>
                      {row.customer_name}
                      {row.contact && (noShowMap.get(row.contact) ?? 0) > 0 ? (
                        <span className="admin-badge st-no_show" style={{ marginLeft: 6, fontSize: 11 }}>
                          無断{noShowMap.get(row.contact)}回
                        </span>
                      ) : null}
                    </td>
                    <td className="num">{row.party_size}</td>
                    <td>{row.cast_id ? (castNameById.get(row.cast_id) ?? '—') : '—'}</td>
                    <td>{row.contact || '—'}</td>
                    <td>{row.note || '—'}</td>
                    <td>
                      <span className={`admin-badge st-${row.status}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td>
                      <div className="admin-btn-row">
                        {row.status === 'reserved' ? (
                          <>
                            <button
                              type="button"
                              className="admin-btn primary"
                              disabled={busy}
                              onClick={() => void changeStatus(row, 'checked_in')}
                            >
                              来店
                            </button>
                            <button
                              type="button"
                              className="admin-btn"
                              disabled={busy}
                              onClick={() =>
                                void changeStatus(
                                  row,
                                  'cancelled',
                                  `${row.customer_name} 様の予約をキャンセルにしますか？`,
                                )
                              }
                            >
                              キャンセル
                            </button>
                            <button
                              type="button"
                              className="admin-btn danger"
                              disabled={busy}
                              onClick={() =>
                                void changeStatus(
                                  row,
                                  'no_show',
                                  `${row.customer_name} 様を無断キャンセルにしますか？`,
                                )
                              }
                            >
                              無断
                            </button>
                          </>
                        ) : null}
                        {row.status === 'checked_in' ? (
                          <button
                            type="button"
                            className="admin-btn"
                            disabled={busy}
                            onClick={() => void changeStatus(row, 'reserved')}
                          >
                            予約中に戻す
                          </button>
                        ) : null}
                        {row.status === 'cancelled' || row.status === 'no_show' ? (
                          <>
                            <button
                              type="button"
                              className="admin-btn"
                              disabled={busy}
                              onClick={() => void changeStatus(row, 'reserved')}
                            >
                              予約中に戻す
                            </button>
                            <button
                              type="button"
                              className="admin-btn danger"
                              disabled={busy}
                              onClick={() => void handleDelete(row)}
                            >
                              削除
                            </button>
                          </>
                        ) : null}
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
