import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyTenant, KyUnlockWindow, KySeatType } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import {
  addWindow,
  fetchWindows,
  removeWindow,
  fetchSeatTypes,
  addSeatType,
  updateSeatType,
  deleteSeatType,
} from './adminApi';

function fmtTime(value: string): string {
  return value.slice(0, 5);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function AdminSchedule({ tenant }: { tenant: KyTenant }) {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [windows, setWindows] = useState<KyUnlockWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [openFrom, setOpenFrom] = useState('18:00');
  const [closeAt, setCloseAt] = useState('22:00');
  const [setMinutes, setSetMinutes] = useState('60');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 席種管理
  const [seatTypes, setSeatTypes] = useState<KySeatType[]>([]);
  const [stName, setStName] = useState('');
  const [stFee, setStFee] = useState('0');
  const [stCapacity, setStCapacity] = useState('1');
  const [stEditId, setStEditId] = useState<string | null>(null);
  const [stBusy, setStBusy] = useState(false);
  const [stError, setStError] = useState<string | null>(null);

  const publicUrl = `${window.location.origin}${window.location.pathname}#/${tenant.slug}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchWindows(tenant.id, date);
      setWindows(rows);
    } catch (e) {
      console.warn('[kyasuho] fetchWindows failed:', e);
      setError('受付枠の取得に失敗しました。再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSeatTypes = useCallback(async () => {
    try {
      const data = await fetchSeatTypes(tenant.id);
      setSeatTypes(data);
    } catch (e) {
      console.warn('[kyasuho] fetchSeatTypes failed:', e);
    }
  }, [tenant.id]);

  useEffect(() => {
    void loadSeatTypes();
  }, [loadSeatTypes]);

  const handleStSave = async (e: FormEvent) => {
    e.preventDefault();
    const fee = parseInt(stFee, 10);
    const cap = parseInt(stCapacity, 10);
    if (!stName.trim()) {
      setStError('席種名を入力してください。');
      return;
    }
    if (isNaN(fee) || fee < 0) {
      setStError('席料は0以上で入力してください。');
      return;
    }
    if (isNaN(cap) || cap < 1) {
      setStError('席数は1以上で入力してください。');
      return;
    }
    setStBusy(true);
    setStError(null);
    try {
      if (stEditId) {
        await updateSeatType(stEditId, { name: stName.trim(), seat_fee: fee, capacity: cap });
      } else {
        await addSeatType(tenant.id, stName.trim(), fee, cap);
      }
      setStName('');
      setStFee('0');
      setStCapacity('1');
      setStEditId(null);
      await loadSeatTypes();
    } catch (err) {
      console.warn('[kyasuho] seatType save failed:', err);
      setStError('保存に失敗しました。');
    } finally {
      setStBusy(false);
    }
  };

  const handleStDelete = async (st: KySeatType) => {
    if (!window.confirm(`席種「${st.name}」を削除しますか？`)) return;
    try {
      await deleteSeatType(st.id);
      await loadSeatTypes();
    } catch (e) {
      console.warn('[kyasuho] deleteSeatType failed:', e);
      window.alert('削除に失敗しました。');
    }
  };

  const handleStToggle = async (st: KySeatType) => {
    try {
      await updateSeatType(st.id, { is_active: !st.is_active });
      await loadSeatTypes();
    } catch (e) {
      console.warn('[kyasuho] toggleSeatType failed:', e);
    }
  };

  const startStEdit = (st: KySeatType) => {
    setStEditId(st.id);
    setStName(st.name);
    setStFee(String(st.seat_fee));
    setStCapacity(String(st.capacity ?? 1));
    setStError(null);
  };

  const cancelStEdit = () => {
    setStEditId(null);
    setStName('');
    setStFee('0');
    setStCapacity('1');
    setStError(null);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (addBusy) return;
    const setMinNum = Number(setMinutes);
    if (!Number.isInteger(setMinNum) || setMinNum < 10) {
      setAddError('1セットの時間は10分以上で入力してください。');
      return;
    }
    if (closeAt && closeAt <= openFrom) {
      setAddError('受付〆切は開始時刻より後にしてください。');
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      await addWindow({
        tenantId: tenant.id,
        date,
        openFrom,
        closeAt: closeAt || null,
        setMinutes: setMinNum,
      });
      await load();
    } catch (err) {
      console.warn('[kyasuho] addWindow failed:', err);
      setAddError('受付枠の追加に失敗しました。');
    } finally {
      setAddBusy(false);
    }
  };

  const handleRemove = async (row: KyUnlockWindow) => {
    if (
      !window.confirm(
        `${fmtTime(row.open_from)} からの受付枠を削除しますか？（既に入っている予約は残ります）`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    try {
      await removeWindow(row.id);
      await load();
    } catch (e) {
      console.warn('[kyasuho] removeWindow failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('[kyasuho] clipboard write failed:', e);
      window.alert('コピーに失敗しました。URLを手動で選択してコピーしてください。');
    }
  };

  return (
    <div>
      <h2 className="admin-page-title">受付設定</h2>

      <div className="admin-card">
        <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
          お客様向け予約ページ
        </div>
        <div className="admin-url-box">
          <code>{publicUrl}</code>
          <button type="button" className="admin-btn" onClick={() => void handleCopy()}>
            {copied ? 'コピーしました' : 'URLをコピー'}
          </button>
          <a
            className="admin-btn"
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none' }}
          >
            開く
          </a>
        </div>
        <p className="admin-note">
          このURLをSNSプロフィールなどに載せると、お客様がスマホから予約できます。
        </p>
      </div>

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
      </div>

      <form className="admin-card" onSubmit={handleAdd}>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="win-open">受付開始</label>
            <input
              id="win-open"
              type="time"
              className="w-md"
              step={600}
              value={openFrom}
              onChange={(e) => setOpenFrom(e.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="win-close">受付〆切（空欄で開始+8時間）</label>
            <input
              id="win-close"
              type="time"
              className="w-md"
              step={600}
              value={closeAt}
              onChange={(e) => setCloseAt(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="win-set">1セット（分）</label>
            <input
              id="win-set"
              type="number"
              className="w-sm"
              min={10}
              step={10}
              value={setMinutes}
              onChange={(e) => setSetMinutes(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="admin-btn primary" disabled={addBusy}>
            {addBusy ? '追加中…' : '受付枠を追加'}
          </button>
        </div>
        {addError ? <p className="admin-error">{addError}</p> : null}
      </form>

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : windows.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">
            この日の受付枠はありません。受付枠がない日はお客様側に「受付時間外」と表示されます。
          </div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>受付開始</th>
                <th>受付〆切</th>
                <th className="num">1セット</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {windows.map((row) => (
                <tr key={row.id}>
                  <td>{fmtTime(row.open_from)}</td>
                  <td>{row.close_at ? fmtTime(row.close_at) : '（開始+8時間）'}</td>
                  <td className="num">{row.set_minutes}分</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn danger"
                      disabled={busyId === row.id}
                      onClick={() => void handleRemove(row)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 席種・席料管理 */}
      <h3 className="admin-section-title" style={{ marginTop: 32 }}>席種・席料</h3>

      <form className="admin-card" onSubmit={handleStSave}>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="st-name">席種名</label>
            <input
              id="st-name"
              type="text"
              className="w-md"
              value={stName}
              onChange={(e) => setStName(e.target.value)}
              placeholder="例：カウンター、VIP、テーブル"
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="st-fee">席料（円・0で無料）</label>
            <input
              id="st-fee"
              type="number"
              className="w-sm"
              min={0}
              value={stFee}
              onChange={(e) => setStFee(e.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="st-cap">席数</label>
            <input
              id="st-cap"
              type="number"
              className="w-sm"
              min={1}
              value={stCapacity}
              onChange={(e) => setStCapacity(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="admin-btn primary" disabled={stBusy}>
            {stBusy ? '保存中…' : stEditId ? '更新' : '席種を追加'}
          </button>
          {stEditId && (
            <button type="button" className="admin-btn" onClick={cancelStEdit}>
              キャンセル
            </button>
          )}
        </div>
        {stError ? <p className="admin-error">{stError}</p> : null}
      </form>

      {seatTypes.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>
          合計席数: {seatTypes.filter((st) => st.is_active).reduce((sum, st) => sum + (st.capacity ?? 1), 0)}席（有効な席種の合計）
        </p>
      )}

      {seatTypes.length === 0 ? (
        <div className="admin-empty">席種が登録されていません。席種を追加すると、予約時にお客様が選択できるようになります。</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>席種名</th>
                <th className="num">席数</th>
                <th className="num">席料</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {seatTypes.map((st) => (
                <tr key={st.id} style={st.is_active ? undefined : { opacity: 0.5 }}>
                  <td>{st.name}</td>
                  <td className="num">{st.capacity ?? 1}</td>
                  <td className="num">{st.seat_fee > 0 ? `¥${st.seat_fee.toLocaleString('ja-JP')}` : '無料'}</td>
                  <td>
                    <button
                      type="button"
                      className={`admin-btn ${st.is_active ? '' : 'danger'}`}
                      onClick={() => void handleStToggle(st)}
                    >
                      {st.is_active ? '有効' : '無効'}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => startStEdit(st)}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="admin-btn danger"
                      style={{ marginLeft: 4 }}
                      onClick={() => void handleStDelete(st)}
                    >
                      削除
                    </button>
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
