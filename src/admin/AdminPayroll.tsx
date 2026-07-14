import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KyCast, KyCastPayroll, KyHourlyRateTier, KySlideMetric, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import {
  DEFAULT_PAYROLL_SETTINGS,
  deletePayroll,
  deleteHourlyRateTier,
  fetchAttendanceByMonth,
  fetchCastList,
  fetchHourlyRateTiers,
  fetchPayrollByMonth,
  fetchPayrollSettings,
  generatePayrollFromAttendance,
  savePayrollSettings,
  upsertHourlyRateTier,
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
  const [rateDefaultBack, setRateDefaultBack] = useState('0');
  const [rateLate, setRateLate] = useState(String(DEFAULT_PAYROLL_SETTINGS.lateDeduction));
  const [slideEnabled, setSlideEnabled] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  // スライド時給tier
  const [tiers, setTiers] = useState<KyHourlyRateTier[]>([]);
  const [tierFormOpen, setTierFormOpen] = useState(false);
  const [tierEditId, setTierEditId] = useState<string | null>(null);
  const [tierMetric, setTierMetric] = useState<KySlideMetric>('monthly_sales');
  const [tierThreshold, setTierThreshold] = useState('0');
  const [tierRate, setTierRate] = useState('1200');
  const [tierBusy, setTierBusy] = useState(false);
  const [tierError, setTierError] = useState<string | null>(null);

  // 明細編集フォーム
  const [editing, setEditing] = useState<KyCastPayroll | null>(null);
  const [editHours, setEditHours] = useState('0');
  const [editMinutes, setEditMinutes] = useState('0');
  const [editNominations, setEditNominations] = useState('0');
  const [editMenuBack, setEditMenuBack] = useState('0');
  const [editOther, setEditOther] = useState('0');
  const [editDeductions, setEditDeductions] = useState('0');
  const [editNote, setEditNote] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /** 現在フォームに入っている設定値（保存済みかは問わない＝再計算・自動生成に使う）。 */
  const calcSettings: PayrollCalcSettings = useMemo(() => {
    const h = toNonNegativeInt(rateHourly);
    const n = toNonNegativeInt(rateNomination);
    const l = toNonNegativeInt(rateLate);
    return {
      baseHourlyRate: h ?? DEFAULT_PAYROLL_SETTINGS.baseHourlyRate,
      nominationBackRate: n ?? DEFAULT_PAYROLL_SETTINGS.nominationBackRate,
      lateDeduction: l ?? DEFAULT_PAYROLL_SETTINGS.lateDeduction,
    };
  }, [rateHourly, rateNomination, rateLate]);

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
        setRateDefaultBack(String(row.default_back_rate));
        setRateLate(String(row.late_deduction));
        setSlideEnabled(row.slide_enabled);
      })
      .catch((e) => {
        console.warn('[kyasuho] fetchPayrollSettings failed:', e);
      });
    fetchHourlyRateTiers(tenant.id)
      .then((rows) => {
        if (!cancelled) setTiers(rows);
      })
      .catch((e) => {
        console.warn('[kyasuho] fetchHourlyRateTiers failed:', e);
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
    const dbr = parseFloat(rateDefaultBack);
    const l = toNonNegativeInt(rateLate);
    if (h === null || n === null || isNaN(dbr) || dbr < 0 || dbr > 100 || l === null) {
      setSettingsMsg('数値を正しく入力してください（基本バック割合は0〜100%）。');
      return;
    }
    setSettingsBusy(true);
    setSettingsMsg(null);
    try {
      await savePayrollSettings(tenant.id, {
        baseHourlyRate: h,
        nominationBackRate: n,
        defaultBackRate: dbr,
        lateDeduction: l,
        slideEnabled,
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
    setEditMenuBack(String(row.menu_back));
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
    const menuBack = toNonNegativeInt(editMenuBack);
    const otherBack = toNonNegativeInt(editOther);
    const deductions = toNonNegativeInt(editDeductions);
    if (
      hours === null ||
      minutes === null ||
      minutes > 59 ||
      nominationCount === null ||
      menuBack === null ||
      otherBack === null ||
      deductions === null
    ) {
      setEditError('数値は0以上の整数で入力してください（分は0〜59）。');
      return;
    }
    const minutesWorked = hours * 60 + minutes;
    const bd = calcPayroll(calcSettings, {
      minutesWorked,
      nominationCount,
      menuBack,
      otherBack,
      lateCount: 0,
    });
    const totalPay = bd.basePay + bd.nominationBack + bd.menuBack + otherBack - deductions;
    setEditBusy(true);
    setEditError(null);
    try {
      await upsertPayroll(tenant.id, editing.cast_id, editing.date, {
        minutesWorked,
        basePay: bd.basePay,
        nominationCount,
        nominationBack: bd.nominationBack,
        drinkCount: editing.drink_count,
        menuBack: bd.menuBack,
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

  const loadTiers = useCallback(async () => {
    try {
      const rows = await fetchHourlyRateTiers(tenant.id);
      setTiers(rows);
    } catch (e) {
      console.warn('[kyasuho] fetchHourlyRateTiers failed:', e);
    }
  }, [tenant.id]);

  const openTierForm = (tier?: KyHourlyRateTier) => {
    if (tier) {
      setTierEditId(tier.id);
      setTierMetric(tier.metric as KySlideMetric);
      setTierThreshold(String(tier.threshold));
      setTierRate(String(tier.hourly_rate));
    } else {
      setTierEditId(null);
      setTierMetric('monthly_sales');
      setTierThreshold('0');
      setTierRate('1200');
    }
    setTierError(null);
    setTierFormOpen(true);
  };

  const handleSaveTier = async (e: FormEvent) => {
    e.preventDefault();
    if (tierBusy) return;
    const threshold = toNonNegativeInt(tierThreshold);
    const rate = toNonNegativeInt(tierRate);
    if (threshold === null || rate === null || rate <= 0) {
      setTierError('しきい値は0以上、時給は1以上で入力してください。');
      return;
    }
    setTierBusy(true);
    setTierError(null);
    try {
      const nextOrder = tierEditId ? undefined : tiers.length;
      await upsertHourlyRateTier(tenant.id, {
        id: tierEditId ?? undefined,
        metric: tierMetric,
        threshold,
        hourly_rate: rate,
        sort_order: nextOrder ?? tiers.find((t) => t.id === tierEditId)?.sort_order ?? 0,
      });
      setTierFormOpen(false);
      await loadTiers();
    } catch (err) {
      console.warn('[kyasuho] upsertHourlyRateTier failed:', err);
      setTierError('保存に失敗しました。');
    } finally {
      setTierBusy(false);
    }
  };

  const handleDeleteTier = async (tier: KyHourlyRateTier) => {
    if (!window.confirm(`しきい値 ${yen(tier.threshold)} のティアを削除しますか？`)) return;
    setTierBusy(true);
    try {
      await deleteHourlyRateTier(tier.id);
      await loadTiers();
    } catch (e) {
      console.warn('[kyasuho] deleteHourlyRateTier failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setTierBusy(false);
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
        'メニューバック',
        'その他',
        '控除',
        '支給額',
      ],
      ...perCast.map((agg) => {
        const basePay = agg.rows.reduce((s, p) => s + p.base_pay, 0);
        const nomBack = agg.rows.reduce((s, p) => s + p.nomination_back, 0);
        const menuBack = agg.rows.reduce((s, p) => s + p.menu_back, 0);
        const otherBack = agg.rows.reduce((s, p) => s + p.other_back, 0);
        const deductions = agg.rows.reduce((s, p) => s + p.deductions, 0);
        return [
          yearMonth,
          castNameById.get(agg.castId) ?? '退店キャスト',
          String(agg.days),
          fmtMinutes(agg.minutes),
          String(basePay),
          String(nomBack),
          String(menuBack),
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
        <button type="button" className="admin-btn" onClick={() => {
          if (perCast.length === 0) { window.alert('この月の給与明細がありません。'); return; }
          const w = window.open('', '_blank');
          if (!w) return;
          const [y, m] = yearMonth.split('-');
          const rows = perCast.map((agg) => {
            const basePay = agg.rows.reduce((s, p) => s + p.base_pay, 0);
            const nomBack = agg.rows.reduce((s, p) => s + p.nomination_back, 0);
            const menuBack = agg.rows.reduce((s, p) => s + p.menu_back, 0);
            const otherBack = agg.rows.reduce((s, p) => s + p.other_back, 0);
            const deductions = agg.rows.reduce((s, p) => s + p.deductions, 0);
            return `<tr><td>${castNameById.get(agg.castId) ?? '退店キャスト'}</td><td style="text-align:right">${agg.days}</td><td style="text-align:right">${fmtMinutes(agg.minutes)}</td><td style="text-align:right">${yen(basePay)}</td><td style="text-align:right">${yen(nomBack)}</td><td style="text-align:right">${yen(menuBack)}</td><td style="text-align:right">${yen(otherBack)}</td><td style="text-align:right">${yen(deductions)}</td><td style="text-align:right;font-weight:600">${yen(agg.total)}</td></tr>`;
          }).join('');
          w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>給与明細 ${y}年${Number(m)}月 - ${tenant.name}</title>
<style>body{font-family:sans-serif;padding:20px;max-width:900px;margin:0 auto}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px}th{background:#f3f4f6;text-align:left}h1{font-size:18px}.total{margin-top:12px;font-size:16px;font-weight:700}@media print{body{padding:0}}</style>
</head><body>
<h1>${tenant.name} 給与明細</h1><p>${y}年${Number(m)}月</p>
<table><thead><tr><th>キャスト</th><th>出勤日数</th><th>勤務時間</th><th>基本給</th><th>指名バック</th><th>メニューバック</th><th>その他</th><th>控除</th><th>支給額</th></tr></thead><tbody>${rows}</tbody></table>
<p class="total">合計支給額: ${yen(monthTotal)}</p>
<script>window.print()</script></body></html>`);
          w.document.close();
        }}>
          給与帳票印刷
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
            <label htmlFor="rate-default-back">基本バック割合（%）</label>
            <input
              id="rate-default-back"
              type="number"
              className="w-md"
              min={0}
              max={100}
              step="0.01"
              value={rateDefaultBack}
              onChange={(e) => setRateDefaultBack(e.target.value)}
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
        <div className="admin-form-row" style={{ marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={slideEnabled}
              onChange={(e) => setSlideEnabled(e.target.checked)}
            />
            スライド時給を有効にする
          </label>
        </div>
        <p className="admin-note">
          支給額 = 基本給（勤務時間×時給）+ 指名バック + メニューバック + その他 −
          控除。基本バック割合はメニュー個別の設定が無い商品に適用されます。保存済みの明細は自動では変わりません。
        </p>
        {settingsMsg ? <p className="admin-note">{settingsMsg}</p> : null}
      </form>

      {slideEnabled ? (
        <div className="admin-card">
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            スライド時給ティア
          </div>
          <p className="admin-note" style={{ marginBottom: 8 }}>
            月間売上や指名数が一定額を超えた場合に適用される時給を設定します。基本時給をベースとし、しきい値を超えた最も高いティアが適用されます。
          </p>
          {tiers.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>指標</th>
                    <th className="num">しきい値</th>
                    <th className="num">時給</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => (
                    <tr key={tier.id}>
                      <td>{tier.metric === 'monthly_sales' ? '月間売上' : '月間指名数'}</td>
                      <td className="num">{tier.metric === 'monthly_sales' ? yen(tier.threshold) : `${tier.threshold}件`}</td>
                      <td className="num">{yen(tier.hourly_rate)}</td>
                      <td>
                        <div className="admin-btn-row">
                          <button type="button" className="admin-btn" onClick={() => openTierForm(tier)}>
                            編集
                          </button>
                          <button
                            type="button"
                            className="admin-btn danger"
                            disabled={tierBusy}
                            onClick={() => void handleDeleteTier(tier)}
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
          ) : (
            <div className="admin-empty" style={{ padding: '12px 0' }}>
              ティアが設定されていません。基本時給がそのまま適用されます。
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="admin-btn primary" onClick={() => openTierForm()}>
              ティアを追加
            </button>
          </div>
          {tierFormOpen ? (
            <form onSubmit={handleSaveTier} style={{ marginTop: 12, padding: '12px', border: '1px solid var(--admin-border)', borderRadius: 8 }}>
              <div className="admin-form-row">
                <div className="admin-field">
                  <label htmlFor="tier-metric">指標</label>
                  <select
                    id="tier-metric"
                    value={tierMetric}
                    onChange={(e) => setTierMetric(e.target.value as KySlideMetric)}
                  >
                    <option value="monthly_sales">月間売上</option>
                    <option value="monthly_nominations">月間指名数</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label htmlFor="tier-threshold">しきい値{tierMetric === 'monthly_sales' ? '（円）' : '（件）'}</label>
                  <input
                    id="tier-threshold"
                    type="number"
                    className="w-md"
                    min={0}
                    value={tierThreshold}
                    onChange={(e) => setTierThreshold(e.target.value)}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="tier-rate">適用時給（円）</label>
                  <input
                    id="tier-rate"
                    type="number"
                    className="w-md"
                    min={1}
                    value={tierRate}
                    onChange={(e) => setTierRate(e.target.value)}
                  />
                </div>
              </div>
              <div className="admin-btn-row" style={{ marginTop: 8 }}>
                <button type="submit" className="admin-btn primary" disabled={tierBusy}>
                  {tierBusy ? '保存中…' : tierEditId ? '更新' : '追加'}
                </button>
                <button type="button" className="admin-btn" onClick={() => setTierFormOpen(false)}>
                  キャンセル
                </button>
              </div>
              {tierError ? <p className="admin-error">{tierError}</p> : null}
            </form>
          ) : null}
        </div>
      ) : null}

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
              <label htmlFor="edit-menu-back">メニューバック（円）</label>
              <input
                id="edit-menu-back"
                type="number"
                className="w-md"
                min={0}
                value={editMenuBack}
                onChange={(e) => setEditMenuBack(e.target.value)}
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
                <th className="num">メニューバック</th>
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
                  <td className="num">{yen(row.menu_back)}</td>
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
