import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyCast, KyCastPayroll, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import {
  DEFAULT_PAYROLL_SETTINGS,
  deletePayroll,
  fetchAttendanceByMonth,
  fetchCastList,
  fetchPayrollByMonth,
  fetchPayrollSettings,
  generatePayrollFromAttendance,
  savePayrollSettings,
  upsertPayroll,
} from './adminApi';
import { calcPayroll, splitMinutes } from './payrollCalc';
import type { PayrollCalcSettings } from './payrollCalc';
import { downloadCsv } from './csv';

function currentMonth(): string {
  return formatDate(new Date()).slice(0, 7);
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y = 0, m = 0] = yearMonth.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function yen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 分 → '8:30' 形式（CSV・明細表示の総勤務時間）。 */
function fmtMinutes(totalMinutes: number): string {
  const { hours, minutes } = splitMinutes(totalMinutes);
  return `${hours}:${pad2(minutes)}`;
}

/** 数値input（空文字含む）→ 0以上の整数。不正は null。 */
function toNonNegativeInt(value: string): number | null {
  if (value.trim() === '') return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

type CastAgg = {
  castId: string;
  days: number;
  minutes: number;
  total: number;
  rows: KyCastPayroll[];
};

export function AdminPayroll({ tenant }: { tenant: KyTenant }) {
  const [yearMonth, setYearMonth] = useState(currentMonth);
  const [payroll, setPayroll] = useState<KyCastPayroll[]>([]);
  const [casts, setCasts] = useState<KyCast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

  // 給与設定（店一律）
  const [rateHourly, setRateHourly] = useState(String(DEFAULT_PAYROLL_SETTINGS.baseHourlyRate));
  const [rateNomination, setRateNomination] = useState(
    String(DEFAULT_PAYROLL_SETTINGS.nominationBackRate),
  );
  const [rateDrink, setRateDrink] = useState(String(DEFAULT_PAYROLL_SETTINGS.drinkBackRate));
  const [rateLate, setRateLate] = useState(String(DEFAULT_PAYROLL_SETTINGS.lateDeduction));
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  // 明細編集フォーム
  const [editing, setEditing] = useState<KyCastPayroll | null>(null);
  const [editHours, setEditHours] = useState('0');
  const [editMinutes, setEditMinutes] = useState('0');
  const [editNominations, setEditNominations] = useState('0');
  const [editDrinks, setEditDrinks] = useState('0');
  const [editOther, setEditOther] = useState('0');
  const [editDeductions, setEditDeductions] = useState('0');
  const [editNote, setEditNote] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /** 現在フォームに入っている設定値（保存済みかは問わない＝再計算・自動生成に使う）。 */
  const calcSettings: PayrollCalcSettings = useMemo(() => {
    const h = toNonNegativeInt(rateHourly);
    const n = toNonNegativeInt(rateNomination);
    const d = toNonNegativeInt(rateDrink);
    const l = toNonNegativeInt(rateLate);
    return {
      baseHourlyRate: h ?? DEFAULT_PAYROLL_SETTINGS.baseHourlyRate,
      nominationBackRate: n ?? DEFAULT_PAYROLL_SETTINGS.nominationBackRate,
      drinkBackRate: d ?? DEFAULT_PAYROLL_SETTINGS.drinkBackRate,
      lateDeduction: l ?? DEFAULT_PAYROLL_SETTINGS.lateDeduction,
    };
  }, [rateHourly, rateNomination, rateDrink, rateLate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [payrollRows, castRows] = await Promise.all([
        fetchPayrollByMonth(tenant.id, yearMonth),
        fetchCastList(tenant.id),
      ]);
      setPayroll(payrollRows);
      setCasts(castRows);
    } catch (e) {
      console.warn('[kyasuho] fetchPayrollByMonth failed:', e);
      setError('給与明細の取得に失敗しました。再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  // 給与設定はテナントごとに1回だけ読む
  useEffect(() => {
    let cancelled = false;
    fetchPayrollSettings(tenant.id)
      .then((row) => {
        if (cancelled || !row) return;
        setRateHourly(String(row.base_hourly_rate));
        setRateNomination(String(row.nomination_back_rate));
        setRateDrink(String(row.drink_back_rate));
        setRateLate(String(row.late_deduction));
      })
      .catch((e) => {
        console.warn('[kyasuho] fetchPayrollSettings failed:', e);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant.id]);

  const castNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of casts) map.set(c.id, c.name);
    return map;
  }, [casts]);

  // キャスト別集計（アプリ側 PayrollView と同じ集計）
  const perCast = useMemo(() => {
    const map = new Map<string, CastAgg>();
    for (const p of payroll) {
      let agg = map.get(p.cast_id);
      if (!agg) {
        agg = { castId: p.cast_id, days: 0, minutes: 0, total: 0, rows: [] };
        map.set(p.cast_id, agg);
      }
      agg.days += 1;
      agg.minutes += p.minutes_worked;
      agg.total += p.total_pay;
      agg.rows.push(p);
    }
    return Array.from(map.values());
  }, [payroll]);

  const monthTotal = useMemo(() => perCast.reduce((s, a) => s + a.total, 0), [perCast]);

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (settingsBusy) return;
    const h = toNonNegativeInt(rateHourly);
    const n = toNonNegativeInt(rateNomination);
    const d = toNonNegativeInt(rateDrink);
    const l = toNonNegativeInt(rateLate);
    if (h === null || n === null || d === null || l === null) {
      setSettingsMsg('レートは0以上の整数で入力してください。');
      return;
    }
    setSettingsBusy(true);
    setSettingsMsg(null);
    try {
      await savePayrollSettings(tenant.id, {
        baseHourlyRate: h,
        nominationBackRate: n,
        drinkBackRate: d,
        lateDeduction: l,
      });
      setSettingsMsg('給与設定を保存しました。');
    } catch (err) {
      console.warn('[kyasuho] savePayrollSettings failed:', err);
      setSettingsMsg('保存に失敗しました。');
    } finally {
      setSettingsBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const attendance = await fetchAttendanceByMonth(tenant.id, yearMonth);
      if (attendance.length === 0) {
        setGenerateMsg('この月の勤怠記録がありません。先に勤怠管理で出勤を記録してください。');
        return;
      }
      const count = await generatePayrollFromAttendance(
        tenant.id,
        yearMonth,
        attendance,
        calcSettings,
      );
      setGenerateMsg(
        count === 0
          ? '新しく作成された明細はありません（作成済みの明細はスキップされます）。'
          : `${count}件の給与明細を作成しました。`,
      );
      await load();
    } catch (e) {
      console.warn('[kyasuho] generatePayrollFromAttendance failed:', e);
      setGenerateMsg('自動生成に失敗しました。');
    } finally {
      setGenerating(false);
    }
  };

  const openEdit = (row: KyCastPayroll) => {
    const { hours, minutes } = splitMinutes(row.minutes_worked);
    setEditing(row);
    setEditHours(String(hours));
    setEditMinutes(String(minutes));
    setEditNominations(String(row.nomination_count));
    setEditDrinks(String(row.drink_count));
    setEditOther(String(row.other_back));
    setEditDeductions(String(row.deductions));
    setEditNote(row.note);
    setEditError(null);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || editBusy) return;
    const hours = toNonNegativeInt(editHours);
    const minutes = toNonNegativeInt(editMinutes);
    const nominationCount = toNonNegativeInt(editNominations);
    const drinkCount = toNonNegativeInt(editDrinks);
    const otherBack = toNonNegativeInt(editOther);
    const deductions = toNonNegativeInt(editDeductions);
    if (
      hours === null ||
      minutes === null ||
      minutes > 59 ||
      nominationCount === null ||
      drinkCount === null ||
      otherBack === null ||
      deductions === null
    ) {
      setEditError('数値は0以上の整数で入力してください（分は0〜59）。');
      return;
    }
    const minutesWorked = hours * 60 + minutes;
    // §23と同式で基本給・バックを再計算（控除だけ手入力値を採用）
    const bd = calcPayroll(calcSettings, {
      minutesWorked,
      nominationCount,
      drinkCount,
      otherBack,
      lateCount: 0,
    });
    const totalPay = bd.basePay + bd.nominationBack + bd.drinkBack + otherBack - deductions;
    setEditBusy(true);
    setEditError(null);
    try {
      await upsertPayroll(tenant.id, editing.cast_id, editing.date, {
        minutesWorked,
        basePay: bd.basePay,
        nominationCount,
        nominationBack: bd.nominationBack,
        drinkCount,
        drinkBack: bd.drinkBack,
        otherBack,
        deductions,
        totalPay,
        note: editNote.trim(),
      });
      setEditing(null);
      await load();
    } catch (err) {
      console.warn('[kyasuho] upsertPayroll failed:', err);
      setEditError('保存に失敗しました。');
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = async (row: KyCastPayroll) => {
    const name = castNameById.get(row.cast_id) ?? '退店キャスト';
    if (!window.confirm(`${row.date} ${name} の給与明細を削除しますか？`)) return;
    setBusyId(row.id);
    try {
      await deletePayroll(row.id);
      if (editing?.id === row.id) setEditing(null);
      await load();
    } catch (e) {
      console.warn('[kyasuho] deletePayroll failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  // 税金関連CSV（§23: 対象月,キャスト名,出勤日数,総勤務時間,基本給,指名バック,ドリンクバック,その他,控除,支給額）
  const handleCsv = () => {
    if (perCast.length === 0) {
      window.alert('この月の給与明細がありません。');
      return;
    }
    const rows: string[][] = [
      [
        '対象月',
        'キャスト名',
        '出勤日数',
        '総勤務時間',
        '基本給',
        '指名バック',
        'ドリンクバック',
        'その他',
        '控除',
        '支給額',
      ],
      ...perCast.map((agg) => {
        const basePay = agg.rows.reduce((s, p) => s + p.base_pay, 0);
        const nomBack = agg.rows.reduce((s, p) => s + p.nomination_back, 0);
        const drinkBack = agg.rows.reduce((s, p) => s + p.drink_back, 0);
        const otherBack = agg.rows.reduce((s, p) => s + p.other_back, 0);
        const deductions = agg.rows.reduce((s, p) => s + p.deductions, 0);
        return [
          yearMonth,
          castNameById.get(agg.castId) ?? '退店キャスト',
          String(agg.days),
          fmtMinutes(agg.minutes),
          String(basePay),
          String(nomBack),
          String(drinkBack),
          String(otherBack),
          String(deductions),
          String(agg.total),
        ];
      }),
    ];
    downloadCsv(`kyasuho_payroll_${yearMonth}.csv`, rows);
  };

  return (
    <div>
      <h2 className="admin-page-title">給与計算</h2>

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
        <button type="button" className="admin-btn primary" onClick={() => void handleGenerate()} disabled={generating}>
          {generating ? '生成中…' : '勤怠から自動生成'}
        </button>
      </div>

      {generateMsg ? <p className="admin-note">{generateMsg}</p> : null}

      <form className="admin-card" onSubmit={handleSaveSettings}>
        <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
          給与設定（店舗一律）
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label htmlFor="rate-hourly">基本時給（円）</label>
            <input
              id="rate-hourly"
              type="number"
              className="w-md"
              min={0}
              value={rateHourly}
              onChange={(e) => setRateHourly(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="rate-nomination">指名バック（円/件）</label>
            <input
              id="rate-nomination"
              type="number"
              className="w-md"
              min={0}
              value={rateNomination}
              onChange={(e) => setRateNomination(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="rate-drink">ドリンクバック（円/杯）</label>
            <input
              id="rate-drink"
              type="number"
              className="w-md"
              min={0}
              value={rateDrink}
              onChange={(e) => setRateDrink(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="rate-late">遅刻控除（円/回）</label>
            <input
              id="rate-late"
              type="number"
              className="w-md"
              min={0}
              value={rateLate}
              onChange={(e) => setRateLate(e.target.value)}
            />
          </div>
          <button type="submit" className="admin-btn primary" disabled={settingsBusy}>
            {settingsBusy ? '保存中…' : '設定を保存'}
          </button>
        </div>
        <p className="admin-note">
          支給額 = 基本給（勤務時間×時給）+ 指名バック + ドリンクバック + その他 −
          控除。レートは自動生成と明細編集の再計算に使われます（保存済みの明細は自動では変わりません）。
        </p>
        {settingsMsg ? <p className="admin-note">{settingsMsg}</p> : null}
      </form>

      <div className="admin-card">
        <div className="admin-stat-row">
          <div className="admin-stat">
            <div className="admin-stat-label">支給額合計</div>
            <div className="admin-stat-value">{yen(monthTotal)}</div>
          </div>
          {perCast.map((agg) => (
            <div className="admin-stat" key={agg.castId}>
              <div className="admin-stat-label">
                {castNameById.get(agg.castId) ?? '退店キャスト'}（出勤{agg.days}日・勤務
                {fmtMinutes(agg.minutes)}）
              </div>
              <div className="admin-stat-value">{yen(agg.total)}</div>
            </div>
          ))}
        </div>
      </div>

      {editing ? (
        <form className="admin-card" onSubmit={handleSaveEdit}>
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            {editing.date} {castNameById.get(editing.cast_id) ?? '退店キャスト'} の明細を編集
          </div>
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="edit-hours">勤務時間（時間）</label>
              <input
                id="edit-hours"
                type="number"
                className="w-sm"
                min={0}
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="edit-minutes">勤務時間（分）</label>
              <input
                id="edit-minutes"
                type="number"
                className="w-sm"
                min={0}
                max={59}
                value={editMinutes}
                onChange={(e) => setEditMinutes(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="edit-nominations">指名数</label>
              <input
                id="edit-nominations"
                type="number"
                className="w-sm"
                min={0}
                value={editNominations}
                onChange={(e) => setEditNominations(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="edit-drinks">ドリンク数</label>
              <input
                id="edit-drinks"
                type="number"
                className="w-sm"
                min={0}
                value={editDrinks}
                onChange={(e) => setEditDrinks(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="edit-other">その他バック（円）</label>
              <input
                id="edit-other"
                type="number"
                className="w-md"
                min={0}
                value={editOther}
                onChange={(e) => setEditOther(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="edit-deductions">控除（円）</label>
              <input
                id="edit-deductions"
                type="number"
                className="w-md"
                min={0}
                value={editDeductions}
                onChange={(e) => setEditDeductions(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-form-row">
            <div className="admin-field" style={{ flex: 1 }}>
              <label htmlFor="edit-note">メモ（調整理由など）</label>
              <input
                id="edit-note"
                type="text"
                style={{ width: '100%' }}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-btn-row">
            <button type="submit" className="admin-btn primary" disabled={editBusy}>
              {editBusy ? '保存中…' : '再計算して保存'}
            </button>
            <button type="button" className="admin-btn" onClick={() => setEditing(null)}>
              閉じる
            </button>
          </div>
          {editError ? <p className="admin-error">{editError}</p> : null}
        </form>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}

      {loading ? (
        <div className="admin-empty">読み込み中…</div>
      ) : payroll.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">
            給与明細がまだありません。勤怠を記録して「勤怠から自動生成」を押してください。
          </div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>キャスト</th>
                <th className="num">勤務時間</th>
                <th className="num">基本給</th>
                <th className="num">指名</th>
                <th className="num">ドリンク</th>
                <th className="num">その他</th>
                <th className="num">控除</th>
                <th className="num">支給額</th>
                <th>メモ</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {payroll.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{castNameById.get(row.cast_id) ?? '退店キャスト'}</td>
                  <td className="num">{fmtMinutes(row.minutes_worked)}</td>
                  <td className="num">{yen(row.base_pay)}</td>
                  <td className="num">
                    {row.nomination_count}件 {yen(row.nomination_back)}
                  </td>
                  <td className="num">
                    {row.drink_count}杯 {yen(row.drink_back)}
                  </td>
                  <td className="num">{yen(row.other_back)}</td>
                  <td className="num">{yen(row.deductions)}</td>
                  <td className="num">
                    <strong>{yen(row.total_pay)}</strong>
                  </td>
                  <td>{row.note || '—'}</td>
                  <td>
                    <div className="admin-btn-row">
                      <button type="button" className="admin-btn" onClick={() => openEdit(row)}>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
