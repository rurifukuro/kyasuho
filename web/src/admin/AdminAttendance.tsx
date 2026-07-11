import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyAttendance, KyAttendanceReason, KyAttendanceStatus, KyCast, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import { deleteAttendance, fetchAttendanceByMonth, fetchCastList, upsertAttendance } from './adminApi';
import { downloadCsv } from './csv';

const STATUS_LABELS: Record<KyAttendanceStatus, string> = {
  present: '出勤',
  late: '遅刻',
  early_leave: '早退',
  absent: '欠勤',
  substitute: '代打',
};

const REASON_LABELS: Record<KyAttendanceReason, string> = {
  '': '理由なし',
  sick: '体調不良',
  personal: '私用',
  no_show: '無断',
  other: 'その他',
};

const STATUS_ORDER: KyAttendanceStatus[] = ['present', 'late', 'early_leave', 'absent', 'substitute'];
const REASON_ORDER: KyAttendanceReason[] = ['', 'sick', 'personal', 'no_show', 'other'];

function currentMonth(): string {
  return formatDate(new Date()).slice(0, 7);
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y = 0, m = 0] = yearMonth.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function AdminAttendance({ tenant }: { tenant: KyTenant }) {
  const [yearMonth, setYearMonth] = useState(currentMonth);
  const [attendance, setAttendance] = useState<KyAttendance[]>([]);
  const [casts, setCasts] = useState<KyCast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 記録フォーム
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState(() => formatDate(new Date()));
  const [formCastId, setFormCastId] = useState('');
  const [formStatus, setFormStatus] = useState<KyAttendanceStatus>('present');
  const [formCheckIn, setFormCheckIn] = useState('');
  const [formCheckOut, setFormCheckOut] = useState('');
  const [formReason, setFormReason] = useState<KyAttendanceReason>('');
  const [formReasonNote, setFormReasonNote] = useState('');
  const [formSubstituteId, setFormSubstituteId] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [attRows, castRows] = await Promise.all([
        fetchAttendanceByMonth(tenant.id, yearMonth),
        fetchCastList(tenant.id),
      ]);
      setAttendance(attRows);
      setCasts(castRows);
    } catch (e) {
      console.warn('[kyasuho] fetchAttendanceByMonth failed:', e);
      setError('勤怠記録の取得に失敗しました。再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const castNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of casts) map.set(c.id, c.name);
    return map;
  }, [casts]);

  // キャスト別月次集計（アプリ側 AttendanceView と同じ定義）
  const monthlySummary = useMemo(
    () =>
      casts.map((c) => {
        const records = attendance.filter((a) => a.cast_id === c.id);
        const worked = records.filter((a) => a.status !== 'absent').length;
        const late = records.filter((a) => a.status === 'late').length;
        const absent = records.filter((a) => a.status === 'absent').length;
        const rate = records.length > 0 ? Math.round((worked / records.length) * 100) : null;
        return { cast: c, worked, late, absent, rate };
      }),
    [casts, attendance],
  );

  const openForm = (row: KyAttendance | null) => {
    if (row) {
      setFormDate(row.date);
      setFormCastId(row.cast_id);
      setFormStatus(row.status);
      setFormCheckIn(row.check_in_at ?? '');
      setFormCheckOut(row.check_out_at ?? '');
      setFormReason(row.reason_category);
      setFormReasonNote(row.reason_note);
      setFormSubstituteId(row.substitute_cast_id ?? '');
      setFormNote(row.note);
    } else {
      setFormDate(formatDate(new Date()));
      setFormCastId(casts[0]?.id ?? '');
      setFormStatus('present');
      setFormCheckIn('');
      setFormCheckOut('');
      setFormReason('');
      setFormReasonNote('');
      setFormSubstituteId('');
      setFormNote('');
    }
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formBusy) return;
    if (!formCastId) {
      setFormError('キャストを選択してください。');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      await upsertAttendance(tenant.id, formCastId, formDate, {
        status: formStatus,
        reasonCategory: formReason,
        reasonNote: formReasonNote.trim(),
        substituteCastId: formStatus === 'substitute' && formSubstituteId ? formSubstituteId : null,
        checkInAt: formCheckIn || null,
        checkOutAt: formCheckOut || null,
        note: formNote.trim(),
        editedByOwner: true,
      });
      setFormOpen(false);
      const savedMonth = formDate.slice(0, 7);
      if (savedMonth !== yearMonth) setYearMonth(savedMonth);
      else await load();
    } catch (err) {
      console.warn('[kyasuho] upsertAttendance failed:', err);
      setFormError('保存に失敗しました。');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (row: KyAttendance) => {
    const name = castNameById.get(row.cast_id) ?? 'このキャスト';
    if (!window.confirm(`${row.date} ${name} の勤怠記録を削除しますか？`)) return;
    setBusyId(row.id);
    try {
      await deleteAttendance(row.id);
      await load();
    } catch (e) {
      console.warn('[kyasuho] deleteAttendance failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  // 税金関連CSV（§23: 日付,キャスト名,状態,入店時刻,退店時刻,理由）
  const handleCsv = () => {
    if (attendance.length === 0) {
      window.alert('この月の勤怠記録がありません。');
      return;
    }
    const rows: string[][] = [
      ['日付', 'キャスト名', '状態', '入店時刻', '退店時刻', '理由', '入力元'],
      ...attendance.map((a) => {
        const reasonLabel = a.reason_category ? REASON_LABELS[a.reason_category] : '';
        const reason = [reasonLabel, a.reason_note].filter(Boolean).join(': ');
        return [
          a.date,
          castNameById.get(a.cast_id) ?? '',
          STATUS_LABELS[a.status],
          a.check_in_at ?? '',
          a.check_out_at ?? '',
          reason,
          a.edited_by_owner ? '店舗修正' : (a.check_in_at ? '本人打刻' : ''),
        ];
      }),
    ];
    downloadCsv(`kyasuho_attendance_${yearMonth}.csv`, rows);
  };

  return (
    <div>
      <h2 className="admin-page-title">勤怠管理</h2>

      <div className="admin-date-nav">
        <button type="button" className="admin-btn" onClick={() => setYearMonth(shiftMonth(yearMonth, -1))}>
          ◀ 前月
        </button>
        <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
        <button type="button" className="admin-btn" onClick={() => setYearMonth(shiftMonth(yearMonth, 1))}>
          翌月 ▶
        </button>
        <button type="button" className="admin-btn" onClick={() => setYearMonth(currentMonth())}>
          今月
        </button>
        <span className="admin-spacer" />
        <button type="button" className="admin-btn" onClick={handleCsv}>
          CSVダウンロード
        </button>
        <button type="button" className="admin-btn primary" onClick={() => openForm(null)}>
          勤怠を記録
        </button>
      </div>

      {formOpen ? (
        <form className="admin-card" onSubmit={handleSubmit}>
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            勤怠の記録（同じキャスト×日付は上書き保存されます）
          </div>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="att-date">日付</label>
              <input
                id="att-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="att-cast">キャスト</label>
              <select
                id="att-cast"
                className="w-md"
                value={formCastId}
                onChange={(e) => setFormCastId(e.target.value)}
              >
                <option value="">選択してください</option>
                {casts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="att-status">ステータス</label>
              <select
                id="att-status"
                className="w-md"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as KyAttendanceStatus)}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            {formStatus === 'substitute' ? (
              <div className="admin-field">
                <label htmlFor="att-substitute">代打キャスト</label>
                <select
                  id="att-substitute"
                  className="w-md"
                  value={formSubstituteId}
                  onChange={(e) => setFormSubstituteId(e.target.value)}
                >
                  <option value="">未選択</option>
                  {casts
                    .filter((c) => c.id !== formCastId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}
            <div className="admin-field">
              <label htmlFor="att-in">入店（未入力可）</label>
              <input
                id="att-in"
                type="time"
                className="w-md"
                value={formCheckIn}
                onChange={(e) => setFormCheckIn(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="att-out">退店（未入力可）</label>
              <input
                id="att-out"
                type="time"
                className="w-md"
                value={formCheckOut}
                onChange={(e) => setFormCheckOut(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="att-reason">理由</label>
              <select
                id="att-reason"
                className="w-md"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value as KyAttendanceReason)}
              >
                {REASON_ORDER.map((r) => (
                  <option key={r || 'none'} value={r}>
                    {REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="att-reason-note">理由の詳細（任意）</label>
              <input
                id="att-reason-note"
                type="text"
                className="w-lg"
                value={formReasonNote}
                onChange={(e) => setFormReasonNote(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="att-note">メモ</label>
              <input
                id="att-note"
                type="text"
                className="w-lg"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-btn-row">
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
      ) : (
        <>
          {attendance.length === 0 ? (
            <div className="admin-table-wrap">
              <div className="admin-empty">この月の勤怠記録はありません。「勤怠を記録」から追加してください。</div>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>キャスト</th>
                    <th>状態</th>
                    <th>入店</th>
                    <th>退店</th>
                    <th>理由</th>
                    <th>メモ</th>
                    <th>入力元</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((row) => {
                    const reasonLabel = row.reason_category ? REASON_LABELS[row.reason_category] : '';
                    const reason = [reasonLabel, row.reason_note].filter(Boolean).join(': ');
                    return (
                      <tr key={row.id}>
                        <td>{row.date}</td>
                        <td>{castNameById.get(row.cast_id) ?? '—'}</td>
                        <td>
                          <span className={`att-status att-${row.status}`}>{STATUS_LABELS[row.status]}</span>
                        </td>
                        <td>{row.check_in_at ?? '—'}</td>
                        <td>{row.check_out_at ?? '—'}</td>
                        <td>{reason || '—'}</td>
                        <td>{row.note || '—'}</td>
                        <td>
                          {row.edited_by_owner
                            ? <span className="att-status att-late">店舗修正</span>
                            : (row.check_in_at ? <span className="att-status att-present">本人打刻</span> : '—')}
                        </td>
                        <td>
                          <div className="admin-btn-row">
                            <button type="button" className="admin-btn" onClick={() => openForm(row)}>
                              編集
                            </button>
                            <button
                              type="button"
                              className="admin-btn danger"
                              disabled={busyId === row.id}
                              onClick={() => void handleDelete(row)}
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

          <h3 className="admin-section-title">キャスト別 月次集計</h3>
          {casts.length === 0 ? (
            <div className="admin-table-wrap">
              <div className="admin-empty">キャストが登録されていません。</div>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>キャスト</th>
                    <th className="num">出勤</th>
                    <th className="num">遅刻</th>
                    <th className="num">欠勤</th>
                    <th className="num">出勤率</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.map(({ cast, worked, late, absent, rate }) => (
                    <tr key={cast.id}>
                      <td>{cast.name}</td>
                      <td className="num">{worked}日</td>
                      <td className="num">{late}回</td>
                      <td className="num">{absent}回</td>
                      <td className="num">{rate === null ? '—' : `${rate}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
