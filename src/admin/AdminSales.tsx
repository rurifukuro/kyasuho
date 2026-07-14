import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { KySales, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import { deleteSales, fetchSalesByMonth, upsertSales } from './adminApi';
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

/** 数値input（空文字含む）→ 0以上の整数。不正は null。 */
function toNonNegativeInt(value: string): number | null {
  if (value.trim() === '') return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function AdminSales({ tenant }: { tenant: KyTenant }) {
  const [yearMonth, setYearMonth] = useState(currentMonth);
  const [sales, setSales] = useState<KySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 入力フォーム（開いている時だけ表示・editingDate は上書き対象の日付）
  const [formOpen, setFormOpen] = useState(false);
  const [formDate, setFormDate] = useState(() => formatDate(new Date()));
  const [formRevenue, setFormRevenue] = useState('');
  const [formSets, setFormSets] = useState('');
  const [formDrinks, setFormDrinks] = useState('');
  const [formNominations, setFormNominations] = useState('');
  const [formOther, setFormOther] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSalesByMonth(tenant.id, yearMonth);
      setSales(rows);
    } catch (e) {
      console.warn('[kyasuho] fetchSalesByMonth failed:', e);
      setError('売上の取得に失敗しました。再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  // 月次集計（アプリ側 SalesView と同じ reduce）
  const summary = useMemo(
    () =>
      sales.reduce(
        (acc, s) => ({
          total: acc.total + s.total_revenue,
          days: acc.days + 1,
          sets: acc.sets + s.set_count,
          drinks: acc.drinks + s.drink_count,
          nominations: acc.nominations + s.nomination_count,
          other: acc.other + s.other_revenue,
        }),
        { total: 0, days: 0, sets: 0, drinks: 0, nominations: 0, other: 0 },
      ),
    [sales],
  );

  const [editingEntryMode, setEditingEntryMode] = useState<string | null>(null);

  const openForm = (row: KySales | null) => {
    if (row) {
      setFormDate(row.date);
      setFormRevenue(String(row.total_revenue));
      setFormSets(String(row.set_count));
      setFormDrinks(String(row.drink_count));
      setFormNominations(String(row.nomination_count));
      setFormOther(String(row.other_revenue));
      setFormNote(row.note);
      setEditingEntryMode(row.entry_mode);
    } else {
      setFormDate(`${yearMonth}-01` <= formatDate(new Date()) ? formatDate(new Date()) : `${yearMonth}-01`);
      setFormRevenue('');
      setFormSets('');
      setFormDrinks('');
      setFormNominations('');
      setFormOther('');
      setFormNote('');
      setEditingEntryMode(null);
    }
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formBusy) return;
    const totalRevenue = toNonNegativeInt(formRevenue);
    const setCount = toNonNegativeInt(formSets);
    const drinkCount = toNonNegativeInt(formDrinks);
    const nominationCount = toNonNegativeInt(formNominations);
    const otherRevenue = toNonNegativeInt(formOther);
    if (
      totalRevenue === null ||
      setCount === null ||
      drinkCount === null ||
      nominationCount === null ||
      otherRevenue === null
    ) {
      setFormError('金額・件数は0以上の整数で入力してください。');
      return;
    }
    setFormBusy(true);
    setFormError(null);
    try {
      await upsertSales(tenant.id, formDate, {
        totalRevenue,
        setCount,
        drinkCount,
        nominationCount,
        otherRevenue,
        note: formNote.trim(),
      });
      setFormOpen(false);
      // 別の月の日付を保存した場合はその月に移動して見せる
      const savedMonth = formDate.slice(0, 7);
      if (savedMonth !== yearMonth) setYearMonth(savedMonth);
      else await load();
    } catch (err) {
      console.warn('[kyasuho] upsertSales failed:', err);
      setFormError('保存に失敗しました。');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (row: KySales) => {
    if (!window.confirm(`${row.date} の売上記録を削除しますか？`)) return;
    setBusyId(row.id);
    try {
      await deleteSales(row.id);
      await load();
    } catch (e) {
      console.warn('[kyasuho] deleteSales failed:', e);
      window.alert('削除に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  // 税金関連CSV（§23: 日付,総売上,セット数,ドリンク数,指名数,その他収入,メモ）
  const handleCsv = () => {
    if (sales.length === 0) {
      window.alert('この月の売上記録がありません。');
      return;
    }
    const rows: string[][] = [
      ['日付', '総売上', 'セット数', 'ドリンク数', '指名数', 'その他収入', 'メモ'],
      ...sales.map((s) => [
        s.date,
        String(s.total_revenue),
        String(s.set_count),
        String(s.drink_count),
        String(s.nomination_count),
        String(s.other_revenue),
        s.note,
      ]),
    ];
    downloadCsv(`kyasuho_sales_${yearMonth}.csv`, rows);
  };

  return (
    <div>
      <h2 className="admin-page-title">売上管理</h2>

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
          if (sales.length === 0) { window.alert('この月の売上記録がありません。'); return; }
          const w = window.open('', '_blank');
          if (!w) return;
          const [y, m] = yearMonth.split('-');
          const rows = sales.map((s) =>
            `<tr><td>${s.date}</td><td style="text-align:right">${yen(s.total_revenue)}</td><td style="text-align:right">${s.set_count}</td><td style="text-align:right">${s.drink_count}</td><td style="text-align:right">${s.nomination_count}</td><td style="text-align:right">${yen(s.other_revenue)}</td><td>${s.note || ''}</td></tr>`
          ).join('');
          w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>売上帳票 ${y}年${Number(m)}月 - ${tenant.name}</title>
<style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px}th{background:#f3f4f6;text-align:left}h1{font-size:18px}.summary{margin:12px 0;font-size:14px}.summary b{font-size:16px}@media print{body{padding:0}}</style>
</head><body>
<h1>${tenant.name} 売上帳票</h1><p>${y}年${Number(m)}月</p>
<div class="summary">月間売上合計: <b>${yen(summary.total)}</b>（${summary.days}日営業 / セット${summary.sets} / ドリンク${summary.drinks} / 指名${summary.nominations}）</div>
<table><thead><tr><th>日付</th><th>総売上</th><th>セット</th><th>ドリンク</th><th>指名</th><th>その他</th><th>メモ</th></tr></thead><tbody>${rows}</tbody></table>
<script>window.print()</script></body></html>`);
          w.document.close();
        }}>
          売上帳票印刷
        </button>
        <button type="button" className="admin-btn primary" onClick={() => openForm(null)}>
          売上を入力
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-stat-row">
          <div className="admin-stat">
            <div className="admin-stat-label">月間売上</div>
            <div className="admin-stat-value">{yen(summary.total)}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">営業日数</div>
            <div className="admin-stat-value">{summary.days}日</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">セット</div>
            <div className="admin-stat-value">{summary.sets}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">ドリンク</div>
            <div className="admin-stat-value">{summary.drinks}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">指名</div>
            <div className="admin-stat-value">{summary.nominations}</div>
          </div>
          <div className="admin-stat">
            <div className="admin-stat-label">その他収入</div>
            <div className="admin-stat-value">{yen(summary.other)}</div>
          </div>
        </div>
      </div>

      {formOpen ? (
        <form className="admin-card" onSubmit={handleSubmit}>
          <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
            売上の入力（同じ日付は上書き保存されます）
          </div>
          {editingEntryMode === 'auto' && (
            <div className="admin-info-banner" style={{ marginBottom: 12, padding: '10px 14px', background: '#dbeafe', borderRadius: 8, fontSize: 13, color: '#2563eb' }}>
              ⚡ レジの会計確定から自動集計されたデータです。手動で変更すると以後は自動更新されません。
            </div>
          )}
          <div className="admin-form-row">
            <div className="admin-field">
              <label htmlFor="sales-date">日付</label>
              <input
                id="sales-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
            <div className="admin-field">
              <label htmlFor="sales-revenue">総売上（円）</label>
              <input
                id="sales-revenue"
                type="number"
                className="w-md"
                min={0}
                value={formRevenue}
                onChange={(e) => setFormRevenue(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="sales-sets">セット数</label>
              <input
                id="sales-sets"
                type="number"
                className="w-sm"
                min={0}
                value={formSets}
                onChange={(e) => setFormSets(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="sales-drinks">ドリンク数</label>
              <input
                id="sales-drinks"
                type="number"
                className="w-sm"
                min={0}
                value={formDrinks}
                onChange={(e) => setFormDrinks(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="sales-nominations">指名数</label>
              <input
                id="sales-nominations"
                type="number"
                className="w-sm"
                min={0}
                value={formNominations}
                onChange={(e) => setFormNominations(e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label htmlFor="sales-other">その他収入（円）</label>
              <input
                id="sales-other"
                type="number"
                className="w-md"
                min={0}
                value={formOther}
                onChange={(e) => setFormOther(e.target.value)}
              />
            </div>
          </div>
          <div className="admin-form-row">
            <div className="admin-field" style={{ flex: 1 }}>
              <label htmlFor="sales-note">メモ（イベント・特記事項など）</label>
              <input
                id="sales-note"
                type="text"
                style={{ width: '100%' }}
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
      ) : sales.length === 0 ? (
        <div className="admin-table-wrap">
          <div className="admin-empty">この月の売上記録はありません。「売上を入力」から追加してください。</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>種別</th>
                <th className="num">総売上</th>
                <th className="num">セット</th>
                <th className="num">ドリンク</th>
                <th className="num">指名</th>
                <th className="num">その他</th>
                <th>メモ</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>
                    <span className={`admin-badge ${row.entry_mode === 'auto' ? 'badge-auto' : 'badge-manual'}`}>
                      {row.entry_mode === 'auto' ? '自動' : '手入力'}
                    </span>
                  </td>
                  <td className="num">{yen(row.total_revenue)}</td>
                  <td className="num">{row.set_count}</td>
                  <td className="num">{row.drink_count}</td>
                  <td className="num">{row.nomination_count}</td>
                  <td className="num">{yen(row.other_revenue)}</td>
                  <td>{row.note || '—'}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
