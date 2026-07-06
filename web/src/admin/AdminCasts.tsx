import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyCast, KyCastInvite, KyShift, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import {
  addCast,
  addShift,
  createInvite,
  deleteInvite,
  fetchCastList,
  fetchInvites,
  fetchShiftList,
  removeCast,
  removeShift,
  updateCast,
} from './adminApi';

function fmtTime(value: string): string {
  return value.slice(0, 5);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function AdminCasts({ tenant }: { tenant: KyTenant }) {
  const [casts, setCasts] = useState<KyCast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 追加・編集フォーム（editingId が null なら新規追加）
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formNomination, setFormNomination] = useState(true);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // シフト
  const [shiftDateValue, setShiftDateValue] = useState(() => formatDate(new Date()));
  const [shifts, setShifts] = useState<KyShift[]>([]);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [shiftCastId, setShiftCastId] = useState('');
  const [shiftStart, setShiftStart] = useState('18:00');
  const [shiftEnd, setShiftEnd] = useState('23:00');
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftFormError, setShiftFormError] = useState<string | null>(null);

  const loadCasts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCastList(tenant.id);
      setCasts(rows);
    } catch (e) {
      console.warn('[kyasuho] fetchCastList failed:', e);
      setError('キャストの取得に失敗しました。再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void loadCasts();
  }, [loadCasts]);

  const loadShifts = useCallback(async () => {
    setShiftLoading(true);
    setShiftError(null);
    try {
      const rows = await fetchShiftList(tenant.id, shiftDateValue);
      setShifts(rows);
    } catch (e) {
      console.warn('[kyasuho] fetchShiftList failed:', e);
      setShiftError('出勤スケジュールの取得に失敗しました。');
    } finally {
      setShiftLoading(false);
    }
  }, [tenant.id, shiftDateValue]);

  useEffect(() => {
    void loadShifts();
  }, [loadShifts]);

  const castNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of casts) map.set(c.id, c.name);
    return map;
  }, [casts]);

  const startEdit = (cast: KyCast) => {
    setEditingId(cast.id);
    setFormName(cast.name);
    setFormBio(cast.bio);
    setFormNomination(cast.accepts_nomination);
    setFormError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormBio('');
    setFormNomination(true);
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formBusy) return;
    const name = formName.trim();
    if (!name) {
      setFormError('名前を入力してください。');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateCast(editingId, {
          name,
          bio: formBio.trim(),
          acceptsNomination: formNomination,
        });
      } else {
        await addCast({
          tenantId: tenant.id,
          name,
          bio: formBio.trim(),
          acceptsNomination: formNomination,
        });
      }
      resetForm();
      await loadCasts();
    } catch (err) {
      console.warn('[kyasuho] save cast failed:', err);
      setFormError('保存に失敗しました。');
    } finally {
      setFormBusy(false);
    }
  };

  const handleToggleNomination = async (cast: KyCast) => {
    setBusyId(cast.id);
    try {
      await updateCast(cast.id, { acceptsNomination: !cast.accepts_nomination });
      await loadCasts();
    } catch (e) {
      console.warn('[kyasuho] toggle nomination failed:', e);
      window.alert('指名設定の変更に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteCast = async (cast: KyCast) => {
    if (!window.confirm(`「${cast.name}」を削除しますか？出勤スケジュールも削除されます。`)) {
      return;
    }
    if (!window.confirm('削除すると元に戻せません。本当に削除しますか？')) return;
    setBusyId(cast.id);
    try {
      await removeCast(cast.id);
      if (editingId === cast.id) resetForm();
      await Promise.all([loadCasts(), loadShifts()]);
    } catch (e) {
      console.warn('[kyasuho] removeCast failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddShift = async (e: FormEvent) => {
    e.preventDefault();
    if (shiftBusy) return;
    if (!shiftCastId) {
      setShiftFormError('キャストを選択してください。');
      return;
    }
    if (shiftEnd <= shiftStart) {
      setShiftFormError('終了時刻は開始時刻より後にしてください（日をまたぐ場合はアプリから登録してください）。');
      return;
    }
    setShiftBusy(true);
    setShiftFormError(null);
    try {
      await addShift({
        tenantId: tenant.id,
        castId: shiftCastId,
        date: shiftDateValue,
        startAt: shiftStart,
        endAt: shiftEnd,
      });
      await loadShifts();
    } catch (err) {
      console.warn('[kyasuho] addShift failed:', err);
      setShiftFormError('出勤の追加に失敗しました。');
    } finally {
      setShiftBusy(false);
    }
  };

  const handleRemoveShift = async (row: KyShift) => {
    const name = castNameById.get(row.cast_id) ?? 'このキャスト';
    if (!window.confirm(`${name} の ${fmtTime(row.start_at)}〜${fmtTime(row.end_at)} の出勤を削除しますか？`)) {
      return;
    }
    setBusyId(row.id);
    try {
      await removeShift(row.id);
      await loadShifts();
    } catch (e) {
      console.warn('[kyasuho] removeShift failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h2 className="admin-page-title">キャスト管理</h2>

      <form className="admin-card" onSubmit={handleSubmit}>
        <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
          {editingId ? `「${castNameById.get(editingId) ?? ''}」を編集` : 'キャストを追加'}
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="cast-name">名前</label>
            <input
              id="cast-name"
              type="text"
              className="w-md"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="cast-bio">紹介文（任意）</label>
            <input
              id="cast-bio"
              type="text"
              className="w-lg"
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="cast-nomination">指名予約</label>
            <select
              id="cast-nomination"
              className="w-md"
              value={formNomination ? 'on' : 'off'}
              onChange={(e) => setFormNomination(e.target.value === 'on')}
            >
              <option value="on">受け付ける</option>
              <option value="off">受け付けない</option>
            </select>
          </div>
          <button type="submit" className="admin-btn primary" disabled={formBusy}>
            {formBusy ? '保存中…' : editingId ? '保存' : '追加'}
          </button>
          {editingId ? (
            <button type="button" className="admin-btn" onClick={resetForm}>
              編集をやめる
            </button>
          ) : null}
        </div>
        {formError ? <p className="admin-error">{formError}</p> : null}
        <p className="admin-note">写真やSNSリンクの設定はアプリから行えます。</p>
      </form>

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : casts.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">キャストが登録されていません。上のフォームから追加してください。</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>名前</th>
                <th>紹介文</th>
                <th>指名予約</th>
                <th>アカウント</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {casts.map((cast) => {
                const busy = busyId === cast.id;
                return (
                  <tr key={cast.id}>
                    <td>{cast.name}</td>
                    <td>{cast.bio || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className={`admin-btn${cast.accepts_nomination ? ' primary' : ''}`}
                        disabled={busy}
                        onClick={() => void handleToggleNomination(cast)}
                      >
                        {cast.accepts_nomination ? '受付中' : '停止中'}
                      </button>
                    </td>
                    <td>
                      {cast.user_id ? (
                        <span className="admin-badge green">連携済み</span>
                      ) : (
                        <span className="admin-badge gray">未連携</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-btn-row">
                        <button
                          type="button"
                          className="admin-btn"
                          disabled={busy}
                          onClick={() => startEdit(cast)}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="admin-btn danger"
                          disabled={busy}
                          onClick={() => void handleDeleteCast(cast)}
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

      <h3 className="admin-section-title">出勤スケジュール</h3>

      <div className="admin-date-nav">
        <button
          type="button"
          className="admin-btn"
          onClick={() => setShiftDateValue(shiftDate(shiftDateValue, -1))}
        >
          ◀ 前日
        </button>
        <input
          type="date"
          value={shiftDateValue}
          onChange={(e) => setShiftDateValue(e.target.value)}
        />
        <button
          type="button"
          className="admin-btn"
          onClick={() => setShiftDateValue(shiftDate(shiftDateValue, 1))}
        >
          翌日 ▶
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => setShiftDateValue(formatDate(new Date()))}
        >
          今日
        </button>
      </div>

      <form className="admin-card" onSubmit={handleAddShift}>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="shift-cast">キャスト</label>
            <select
              id="shift-cast"
              className="w-md"
              value={shiftCastId}
              onChange={(e) => setShiftCastId(e.target.value)}
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
            <label htmlFor="shift-start">出勤</label>
            <input
              id="shift-start"
              type="time"
              className="w-md"
              step={600}
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="shift-end">退勤</label>
            <input
              id="shift-end"
              type="time"
              className="w-md"
              step={600}
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="admin-btn primary" disabled={shiftBusy}>
            {shiftBusy ? '追加中…' : '出勤を追加'}
          </button>
        </div>
        {shiftFormError ? <p className="admin-error">{shiftFormError}</p> : null}
      </form>

      {shiftError ? <p className="admin-error">{shiftError}</p> : null}

      {shiftLoading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : shifts.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">この日の出勤予定はありません。</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>キャスト</th>
                <th>出勤</th>
                <th>退勤</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((row) => (
                <tr key={row.id}>
                  <td>{castNameById.get(row.cast_id) ?? '—'}</td>
                  <td>{fmtTime(row.start_at)}</td>
                  <td>{fmtTime(row.end_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn danger"
                      disabled={busyId === row.id}
                      onClick={() => void handleRemoveShift(row)}
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

      <CastInvitePanel tenant={tenant} casts={casts} />
    </div>
  );
}

// ── 招待管理パネル ──

function CastInvitePanel({ tenant, casts }: { tenant: KyTenant; casts: KyCast[] }) {
  const [invites, setInvites] = useState<KyCastInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCastId, setInviteCastId] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const castNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of casts) map.set(c.id, c.name);
    return map;
  }, [casts]);

  const unlinkedCasts = useMemo(() => casts.filter((c) => !c.user_id), [casts]);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchInvites(tenant.id);
      setInvites(rows);
    } catch (e) {
      console.warn('[kyasuho] fetchInvites failed:', e);
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteCastId || creating) return;
    setCreating(true);
    try {
      await createInvite(tenant.id, inviteCastId);
      await loadInvites();
      setInviteCastId('');
    } catch (err) {
      console.warn('[kyasuho] createInvite failed:', err);
      window.alert('招待コードの作成に失敗しました。');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      window.alert('コードをコピーしました');
    } catch {
      window.prompt('コードをコピーしてください:', code);
    }
  };

  const handleDelete = async (inv: KyCastInvite) => {
    if (!window.confirm(`招待コード「${inv.code}」を削除しますか？`)) return;
    setBusyId(inv.id);
    try {
      await deleteInvite(inv.id);
      await loadInvites();
    } catch (e) {
      console.warn('[kyasuho] deleteInvite failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ja-JP');
    } catch {
      return iso;
    }
  };

  return (
    <>
      <h3 className="admin-section-title">キャスト招待管理</h3>
      <p className="admin-note" style={{ marginBottom: 8 }}>
        招待コードを作成してキャストに渡すと、キャストが自分のアカウントでアプリにログインし、シフトや給与を確認できるようになります。コードの有効期限は7日間です。
      </p>

      {unlinkedCasts.length > 0 && (
        <form className="admin-card" onSubmit={handleCreate}>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="invite-cast">招待するキャスト</label>
              <select
                id="invite-cast"
                className="w-md"
                value={inviteCastId}
                onChange={(e) => setInviteCastId(e.target.value)}
              >
                <option value="">選択してください</option>
                {unlinkedCasts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="admin-btn primary" disabled={creating || !inviteCastId}>
              {creating ? '作成中…' : '招待コードを作成'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : invites.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">招待コードはまだ作成されていません。</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>キャスト</th>
                <th>招待コード</th>
                <th>有効期限</th>
                <th>ステータス</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const expired = new Date(inv.expires_at) < new Date();
                const used = !!inv.used_at;
                return (
                  <tr key={inv.id}>
                    <td>{castNameById.get(inv.cast_id) ?? '—'}</td>
                    <td style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{inv.code}</td>
                    <td>{fmtDate(inv.expires_at)}</td>
                    <td>
                      {used ? (
                        <span className="admin-badge green">使用済み</span>
                      ) : expired ? (
                        <span className="admin-badge red">期限切れ</span>
                      ) : (
                        <span className="admin-badge blue">有効</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-btn-row">
                        {!used && !expired && (
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={() => void handleCopy(inv.code)}
                          >
                            コピー
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-btn danger"
                          disabled={busyId === inv.id}
                          onClick={() => void handleDelete(inv)}
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
    </>
  );
}
