// web/src/admin/AdminShiftImage.tsx — シフト表画像生成（SPEC §3-I／§22・Web=主戦場）
//
// テンプレギャラリー（40種）→ プレビュー → カスタマイズ（色・モチーフ・レイアウト・サイズ）
// → PNGダウンロード（html-to-image・等倍オフスクリーンノードをキャプチャ）
// → お気に入り保存（ky_shift_templates.custom_settings に上書き差分を保存）

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import type { KyCast, KyShift, KyShiftTemplate, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import {
  addShiftTemplate,
  fetchCastList,
  fetchEvents,
  fetchPayrollSettings,
  fetchShiftTemplateList,
  fetchShiftsByMonth,
  removeShiftTemplate,
  requestAiShiftDesign,
  uploadShiftBackground,
} from './adminApi';
import type {
  ShiftLayout,
  ShiftMotif,
  ShiftPlacement,
  ShiftTemplateCategory,
  ShiftTemplateDefinition,
} from '../shiftTemplates/definitions';
import {
  CATEGORY_LABELS,
  MOTIF_CHARS,
  SHIFT_TEMPLATES,
  defaultFreeformPlacement,
  findTemplate,
} from '../shiftTemplates/definitions';
import { detectGridFromImage } from '../shiftTemplates/gridDetect';
import { buildShiftDays, splitDailyPages } from '../shiftTemplates/shiftData';
import type { ShiftEventDay } from '../shiftTemplates/shiftData';
import { buildAiDefinition, extractAiDesign } from '../shiftTemplates/aiDesign';
import {
  buildDailyPostText as buildDailyPost,
  buildMonthlyPostText,
  DEFAULT_DAILY_TEMPLATE,
  DEFAULT_MONTHLY_TEMPLATE,
  estimateXLength,
  extractXHandle,
} from '../domain/sns/buildPostText';
import type { PostCastEntry } from '../domain/sns/buildPostText';
import { updateSnsPostTemplates } from './adminApi';
import type { KyPayrollSettings, SnsPostTemplate, SnsPostTemplates } from '../lib/types';
import { estimateLaborCost } from '../domain/payroll/estimateLaborCost';
import { ShiftTableRenderer } from '../shiftTemplates/ShiftTableRenderer';

const DEFAULT_TEMPLATE: ShiftTemplateDefinition = SHIFT_TEMPLATES[0]!;

const PREVIEW_SCALE = 0.42;

/** ギャラリー表示用: カテゴリ→テンプレ一覧（定義順） */
const GROUPED: [ShiftTemplateCategory, ShiftTemplateDefinition[]][] = (() => {
  const g = new Map<ShiftTemplateCategory, ShiftTemplateDefinition[]>();
  for (const t of SHIFT_TEMPLATES) {
    const list = g.get(t.category) ?? [];
    list.push(t);
    g.set(t.category, list);
  }
  return [...g.entries()];
})();

type Aspect = '4:5' | '9:16';

/** カスタマイズ上書き（§22: palette/motif等の差分だけを保存する） */
type ShiftOverrides = {
  bg?: string;
  accent?: string;
  headerText?: string;
  castName?: string;
  motif?: ShiftMotif;
  layout?: ShiftLayout;
};

const MOTIF_OPTIONS: ShiftMotif[] = [
  'none',
  'stars',
  'hearts',
  'flowers',
  'sakura',
  'lightning',
  'ribbon',
  'cross',
  'moon',
  'crown',
  'snow',
];

function currentMonth(): string {
  return formatDate(new Date()).slice(0, 7);
}

function shiftDay(date: string, delta: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return formatDate(d);
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y = 0, m = 0] = yearMonth.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** custom_settings(jsonb) → 上書き＋サイズ（不正値は捨てて既定へ＝§22バリデーション方針） */
function parseCustomSettings(cs: Record<string, unknown>): { ov: ShiftOverrides; aspect: Aspect } {
  const ov: ShiftOverrides = {};
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
  const bg = str(cs['bg']);
  const accent = str(cs['accent']);
  const headerText = str(cs['headerText']);
  const castName = str(cs['castName']);
  if (bg) ov.bg = bg;
  if (accent) ov.accent = accent;
  if (headerText) ov.headerText = headerText;
  if (castName) ov.castName = castName;
  const motif = str(cs['motif']);
  if (motif && (MOTIF_OPTIONS as string[]).includes(motif)) ov.motif = motif as ShiftMotif;
  const layout = str(cs['layout']);
  if (layout === 'month-grid' || layout === 'week-rows') ov.layout = layout;
  const aspect: Aspect = cs['aspect'] === '9:16' ? '9:16' : '4:5';
  return { ov, aspect };
}

export function AdminShiftImage({ tenant }: { tenant: KyTenant }) {
  const [yearMonth, setYearMonth] = useState(currentMonth);
  const [shifts, setShifts] = useState<KyShift[]>([]);
  const [casts, setCasts] = useState<KyCast[]>([]);
  const [favorites, setFavorites] = useState<KyShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
  const [dailyDate, setDailyDate] = useState(formatDate(new Date()));
  const [dailyPageIdx, setDailyPageIdx] = useState(0);

  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [ov, setOv] = useState<ShiftOverrides>({});
  const [aspect, setAspect] = useState<Aspect>('4:5');
  const [exporting, setExporting] = useState(false);

  const [favName, setFavName] = useState('');
  const [favBusy, setFavBusy] = useState(false);

  // 店舗テンプレ背景＋AI配置解析（§22-3）
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [placement, setPlacement] = useState<ShiftPlacement | null>(null);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [eventDays, setEventDays] = useState<ShiftEventDay[]>([]);
  const [payrollSettings, setPayrollSettings] = useState<KyPayrollSettings | null>(null);

  // AIデザイン（§22: Edge Function ky-shift-design → buildAiDefinition で完全定義化）

  const [aiDef, setAiDef] = useState<ShiftTemplateDefinition | null>(null);
  const [aiMood, setAiMood] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [showTmplEditor, setShowTmplEditor] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shiftRows, castRows, favRows, evRows, ps] = await Promise.all([
        fetchShiftsByMonth(tenant.id, yearMonth),
        fetchCastList(tenant.id),
        fetchShiftTemplateList(tenant.id),
        fetchEvents(tenant.id),
        fetchPayrollSettings(tenant.id).catch(() => null),
      ]);
      setShifts(shiftRows);
      setCasts(castRows);
      setFavorites(favRows);
      setPayrollSettings(ps);
      const ym = yearMonth;
      setEventDays(
        evRows
          .filter(e => e.event_date.startsWith(`${ym}-`))
          .map(e => ({ date: e.event_date, label: e.title })),
      );
    } catch (e) {
      console.warn('[kyasuho] fetchShiftsByMonth failed:', e);
      setError('シフトデータの取得に失敗しました。再読み込みしてください。');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, yearMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const castById = useMemo(() => {
    const map = new Map<string, KyCast>();
    for (const c of casts) map.set(c.id, c);
    return map;
  }, [casts]);

  const days = useMemo(() => {
    const flatRows = shifts.map((s) => {
      const cast = castById.get(s.cast_id);
      return {
        date: s.date,
        castName: cast?.name ?? '？',
        start: s.start_at,
        end: s.end_at,
        photoUrl: cast?.photo_url ?? null,
      };
    });
    return buildShiftDays(flatRows, yearMonth);
  }, [shifts, castById, yearMonth]);

  const laborEstimate = useMemo(() => {
    if (!payrollSettings?.base_hourly_rate) return null;
    const allShifts = days.flatMap(d => d.casts.map(c => ({ start: c.start, end: c.end })));
    if (allShifts.length === 0) return null;
    return estimateLaborCost(allShifts, payrollSettings.base_hourly_rate);
  }, [days, payrollSettings]);

  const dailyPages = useMemo(() => {
    if (viewMode !== 'daily') return [];
    const dayData = days.find(d => d.date === dailyDate);
    if (!dayData) return [{ date: dailyDate, casts: [] as typeof days[0]['casts'] }];
    return splitDailyPages(dayData);
  }, [days, dailyDate, viewMode]);

  const dailyTotalPages = dailyPages.length;
  const safeDailyPage = Math.min(dailyPageIdx, dailyTotalPages - 1);
  const currentDailyPage = dailyPages[Math.max(0, safeDailyPage)];

  const dailyDaysForPage = useMemo(() => {
    if (!currentDailyPage) return days;
    return [currentDailyPage];
  }, [currentDailyPage, days]);

  const base =
    aiDef && templateId === aiDef.id ? aiDef : (findTemplate(templateId) ?? DEFAULT_TEMPLATE);

  // ベース定義＋上書き＋サイズ → 実際に描画する定義（§22: 不正値は既定値へマージ）
  const def = useMemo<ShiftTemplateDefinition>(() => {
    const size = aspect === '9:16' ? { w: 1080, h: 1920 } : base.size;
    const palette = { ...base.palette };
    if (ov.bg) {
      palette.bg = ov.bg;
      delete palette.bgGradient; // 背景を手動指定したらグラデは外す（単色）
    }
    if (ov.accent) palette.accent = ov.accent;
    if (ov.headerText) palette.headerText = ov.headerText;
    if (ov.castName) palette.castName = ov.castName;
    const layout = viewMode === 'daily' ? 'daily-lineup' as const : (ov.layout ?? base.layout);
    return {
      ...base,
      size,
      palette,
      layout,
      decorations: { ...base.decorations, motif: ov.motif ?? base.decorations.motif ?? 'none' },
    };
  }, [base, ov, aspect, viewMode]);

  const reserveUrl = `https://rurifukuro.github.io/kyasuho/#/${tenant.slug}`;
  const buildSnsText = useCallback(() => {
    const templates = tenant.sns_post_templates ?? {};
    if (viewMode === 'daily') {
      const tmpl = templates.daily ?? DEFAULT_DAILY_TEMPLATE;
      const dayData = days.find(d => d.date === dailyDate);
      const entries: PostCastEntry[] = (dayData?.casts ?? []).map(c => {
        const cast = casts.find(cc => cc.name === c.name);
        return {
          name: c.name,
          nameKana: cast?.name_kana ?? c.name,
          start: c.start,
          xHandle: extractXHandle(cast?.sns_links ?? []),
        };
      });
      return buildDailyPost(tmpl, tenant.name, dailyDate, entries, reserveUrl);
    }
    const tmpl = templates.monthly ?? DEFAULT_MONTHLY_TEMPLATE;
    return buildMonthlyPostText(tmpl, tenant.name, yearMonth, reserveUrl);
  }, [viewMode, tenant, days, dailyDate, casts, yearMonth, reserveUrl]);

  const hasCustom = Object.keys(ov).length > 0;

  const handleSelectTemplate = (id: string) => {
    setTemplateId(id);
    setOv({}); // テンプレを切り替えたらカスタマイズはリセット（そのテンプレ本来の姿を見せる）
  };

  const handleDownload = async () => {
    const node = exportRef.current;
    if (!node || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 1, cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      if (viewMode === 'daily' && dailyTotalPages > 1) {
        a.download = `kyasuho_daily_${dailyDate}_${safeDailyPage + 1}.png`;
      } else if (viewMode === 'daily') {
        a.download = `kyasuho_daily_${dailyDate}.png`;
      } else {
        a.download = `kyasuho_shift_${yearMonth}.png`;
      }
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.warn('[kyasuho] toPng failed:', e);
      window.alert('画像の生成に失敗しました。もう一度お試しください。');
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateAi = async () => {
    const mood = aiMood.trim();
    if (!mood || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const raw = await requestAiShiftDesign(mood, tenant.name);
      const def = buildAiDefinition(raw, `ai-${Date.now()}`);
      setAiDef(def);
      setTemplateId(def.id);
      setOv({});
    } catch (e) {
      console.warn('[kyasuho] requestAiShiftDesign failed:', e);
      const msg = e instanceof Error ? e.message : '';
      setAiError(
        msg === 'rate_limit'
          ? '本日のAI生成回数の上限に達しました。明日またお試しください。'
          : msg === 'global_limit'
            ? 'ただいま混み合っています。時間をおいてお試しください。'
            : 'AI生成に失敗しました。しばらくしてからもう一度お試しください。',
      );
    } finally {
      setAiBusy(false);
    }
  };

  const handleSaveFavorite = async () => {
    if (favBusy) return;
    setFavBusy(true);
    try {
      const isAi = base.category === 'ai';
      const cs = isAi ? { ...ov, aspect, ai: extractAiDesign(base) } : { ...ov, aspect };
      if (bgImageUrl) (cs as Record<string, unknown>)['bgImageUrl'] = bgImageUrl;
      if (placement) (cs as Record<string, unknown>)['placement'] = placement;
      const tplKey = bgImageUrl ? 'shop' : isAi ? 'ai' : base.id;
      await addShiftTemplate({
        tenantId: tenant.id,
        name: favName.trim() || (bgImageUrl ? '店舗テンプレート' : `${base.name}（${aspect}）`),
        templateKey: tplKey,
        customSettings: cs,
      });
      setFavName('');
      setFavorites(await fetchShiftTemplateList(tenant.id));
    } catch (e) {
      console.warn('[kyasuho] addShiftTemplate failed:', e);
      window.alert('お気に入りの保存に失敗しました。');
    } finally {
      setFavBusy(false);
    }
  };

  const handleLoadFavorite = (fav: KyShiftTemplate) => {
    const parsed = parseCustomSettings(fav.custom_settings);
    const savedBg = typeof fav.custom_settings['bgImageUrl'] === 'string' ? fav.custom_settings['bgImageUrl'] : null;
    setBgImageUrl(savedBg);
    setPlacement(
      savedBg && fav.custom_settings['placement'] && typeof fav.custom_settings['placement'] === 'object'
        ? fav.custom_settings['placement'] as ShiftPlacement
        : null,
    );
    if (fav.template_key === 'ai') {
      const def = buildAiDefinition(fav.custom_settings['ai'], `ai-${Date.now()}`);
      setAiDef(def);
      setTemplateId(def.id);
      setOv(parsed.ov);
      setAspect(parsed.aspect);
      return;
    }
    if (fav.template_key === 'shop') {
      setOv(parsed.ov);
      setAspect(parsed.aspect);
      return;
    }
    const baseDef = findTemplate(fav.template_key);
    if (!baseDef) {
      window.alert('このお気に入りの元テンプレートが見つかりませんでした。');
      return;
    }
    setTemplateId(baseDef.id);
    setOv(parsed.ov);
    setAspect(parsed.aspect);
  };

  const handleDetectGrid = async () => {
    if (!bgImageUrl || analyzeBusy) return;
    setAnalyzeBusy(true);
    setAnalyzeError(null);
    try {
      const result = await detectGridFromImage(bgImageUrl);
      if (!result) {
        setAnalyzeError('グリッド構造を検出できませんでした。「好きな画像を背景に」モードをお試しください。');
        return;
      }
      setPlacement(result);
    } catch (e) {
      console.warn('[kyasuho] detectGridFromImage failed:', e);
      setAnalyzeError('グリッド検出に失敗しました。「好きな画像を背景に」モードをお試しください。');
    } finally {
      setAnalyzeBusy(false);
    }
  };

  const handleFreeformMode = () => {
    if (!bgImageUrl) return;
    setAnalyzeError(null);
    setPlacement(defaultFreeformPlacement());
  };

  const handleDeleteFavorite = async (fav: KyShiftTemplate) => {
    if (!window.confirm(`お気に入り「${fav.name}」を削除しますか？`)) return;
    try {
      await removeShiftTemplate(fav.id);
      setFavorites(await fetchShiftTemplateList(tenant.id));
    } catch (e) {
      console.warn('[kyasuho] removeShiftTemplate failed:', e);
      window.alert('削除に失敗しました。');
    }
  };

  return (
    <div>
      <h2 className="admin-page-title">シフト表作成</h2>

      <div className="admin-btn-row" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className={`admin-btn${viewMode === 'monthly' ? ' primary' : ''}`}
          onClick={() => setViewMode('monthly')}
        >
          月間シフト表
        </button>
        <button
          type="button"
          className={`admin-btn${viewMode === 'daily' ? ' primary' : ''}`}
          onClick={() => setViewMode('daily')}
        >
          デイリー出勤表
        </button>
      </div>

      <div className="admin-date-nav">
        {viewMode === 'monthly' ? (
          <>
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
          </>
        ) : (
          <>
            <button type="button" className="admin-btn" onClick={() => {
              const nd = shiftDay(dailyDate, -1);
              setDailyDate(nd);
              setYearMonth(nd.slice(0, 7));
              setDailyPageIdx(0);
            }}>
              ◀ 前日
            </button>
            <input type="date" value={dailyDate} onChange={(e) => {
              setDailyDate(e.target.value);
              setYearMonth(e.target.value.slice(0, 7));
              setDailyPageIdx(0);
            }} />
            <button type="button" className="admin-btn" onClick={() => {
              const nd = shiftDay(dailyDate, 1);
              setDailyDate(nd);
              setYearMonth(nd.slice(0, 7));
              setDailyPageIdx(0);
            }}>
              翌日 ▶
            </button>
            <button type="button" className="admin-btn" onClick={() => {
              const today = formatDate(new Date());
              setDailyDate(today);
              setYearMonth(today.slice(0, 7));
              setDailyPageIdx(0);
            }}>
              今日
            </button>
            {dailyTotalPages > 1 ? (
              <>
                <span style={{ margin: '0 8px', color: '#888' }}>|</span>
                <button type="button" className="admin-btn" disabled={safeDailyPage <= 0} onClick={() => setDailyPageIdx(i => Math.max(0, i - 1))}>◀</button>
                <span style={{ margin: '0 6px', fontWeight: 600 }}>{safeDailyPage + 1}/{dailyTotalPages}</span>
                <button type="button" className="admin-btn" disabled={safeDailyPage >= dailyTotalPages - 1} onClick={() => setDailyPageIdx(i => i + 1)}>▶</button>
                {dailyTotalPages >= 5 ? <span style={{ margin: '0 6px', color: '#d97706', fontSize: 13 }}>⚠ 5枚以上（X投稿は4枚まで）</span> : null}
              </>
            ) : null}
          </>
        )}
        <span className="admin-spacer" />
        <button
          type="button"
          className="admin-btn primary"
          disabled={exporting || loading}
          onClick={() => void handleDownload()}
        >
          {exporting ? '生成中…' : 'PNGをダウンロード'}
        </button>
      </div>

      {laborEstimate && (
        <div style={{ padding: '8px 14px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, marginBottom: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span>💰 見込み人件費（時給 ¥{payrollSettings!.base_hourly_rate.toLocaleString()} × {Math.floor(laborEstimate.totalMinutes / 60)}時間{laborEstimate.totalMinutes % 60 > 0 ? `${laborEstimate.totalMinutes % 60}分` : ''}）</span>
          <strong style={{ color: '#15803d' }}>¥{laborEstimate.estimatedCost.toLocaleString()}</strong>
        </div>
      )}

      {error ? <p className="admin-error">{error}</p> : null}
      {!loading && days.length === 0 ? (
        <p className="admin-note">
          この月の出勤予定がありません。キャスト管理タブ（アプリまたは本Webのキャスト画面）で出勤枠を登録すると反映されます。
        </p>
      ) : null}

      <div className="shift-layout">
        {/* プレビュー（縮小表示） */}
        <div className="shift-preview-col">
          <div
            className="shift-preview-box"
            style={{ width: def.size.w * PREVIEW_SCALE, height: def.size.h * PREVIEW_SCALE }}
          >
            <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
              <ShiftTableRenderer def={def} days={viewMode === 'daily' ? dailyDaysForPage : days} yearMonth={yearMonth} storeName={tenant.name} dailyDate={viewMode === 'daily' ? dailyDate : undefined} bgImageUrl={bgImageUrl} placement={placement} eventDays={eventDays} pageInfo={viewMode === 'daily' && dailyTotalPages > 1 ? { page: safeDailyPage + 1, total: dailyTotalPages } : undefined} />
            </div>
          </div>
          <p className="admin-note">
            プレビュー（縮小表示）。ダウンロードは {def.size.w}×{def.size.h}px で出力されます。
          </p>
        </div>

        {/* 設定パネル */}
        <div className="shift-panel">
          <div className="admin-card" style={{ marginBottom: 0 }}>
            <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
              AIデザイン
            </div>
            <p className="admin-note" style={{ marginTop: 0 }}>
              お店の雰囲気を書くと、AIが配色デザインを提案します（1日20回まで）。
            </p>
            <div className="admin-form-row">
              <div className="admin-field" style={{ flex: 1 }}>
                <label htmlFor="ai-mood">雰囲気（例: 桜色でかわいい／大人シックな夜カフェ）</label>
                <input
                  id="ai-mood"
                  type="text"
                  style={{ width: '100%' }}
                  value={aiMood}
                  maxLength={200}
                  onChange={(e) => setAiMood(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="admin-btn primary"
                disabled={aiBusy || !aiMood.trim()}
                onClick={() => void handleGenerateAi()}
              >
                {aiBusy ? '生成中…' : 'AIで生成'}
              </button>
            </div>
            {aiError ? <p className="admin-error">{aiError}</p> : null}
            {aiDef ? (
              <div className="shift-gallery">
                <button
                  type="button"
                  className={`shift-swatch${templateId === aiDef.id ? ' selected' : ''}`}
                  style={{ background: aiDef.palette.bg }}
                  onClick={() => {
                    setTemplateId(aiDef.id);
                    setOv({});
                  }}
                >
                  <span className="shift-swatch-bar" style={{ background: aiDef.palette.accent }} />
                  <span className="shift-swatch-name" style={{ color: aiDef.palette.headerText }}>
                    {aiDef.name}
                  </span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="admin-card" style={{ marginBottom: 0 }}>
            <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
              テンプレート（{SHIFT_TEMPLATES.length}種）
            </div>
            {GROUPED.map(([cat, list]) => (
              <div key={cat}>
                <div className="shift-cat-label">{CATEGORY_LABELS[cat]}</div>
                <div className="shift-gallery">
                  {list.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`shift-swatch${t.id === templateId ? ' selected' : ''}`}
                      style={{ background: t.palette.bg }}
                      onClick={() => handleSelectTemplate(t.id)}
                    >
                      <span className="shift-swatch-bar" style={{ background: t.palette.accent }} />
                      <span className="shift-swatch-name" style={{ color: t.palette.headerText }}>
                        {t.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="admin-card" style={{ marginBottom: 0 }}>
            <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
              カスタマイズ
            </div>

            <div className="shift-control-row">
              <span className="shift-control-label">サイズ</span>
              <div className="admin-btn-row">
                <button
                  type="button"
                  className={`admin-btn${aspect === '4:5' ? ' primary' : ''}`}
                  onClick={() => setAspect('4:5')}
                >
                  4:5（SNS投稿）
                </button>
                <button
                  type="button"
                  className={`admin-btn${aspect === '9:16' ? ' primary' : ''}`}
                  onClick={() => setAspect('9:16')}
                >
                  9:16（ストーリー）
                </button>
              </div>
            </div>

            {viewMode === 'monthly' ? (
              <div className="shift-control-row">
                <span className="shift-control-label">レイアウト</span>
                <div className="admin-btn-row">
                  <button
                    type="button"
                    className={`admin-btn${def.layout === 'month-grid' ? ' primary' : ''}`}
                    onClick={() => setOv((o) => ({ ...o, layout: 'month-grid' }))}
                  >
                    月間カレンダー
                  </button>
                  <button
                    type="button"
                    className={`admin-btn${def.layout === 'week-rows' ? ' primary' : ''}`}
                    onClick={() => setOv((o) => ({ ...o, layout: 'week-rows' }))}
                  >
                    週別リスト
                  </button>
                </div>
              </div>
            ) : null}

            <div className="shift-control-row">
              <span className="shift-control-label">モチーフ</span>
              <div className="admin-btn-row">
                {MOTIF_OPTIONS.map((m) => {
                  const active = (def.decorations.motif ?? 'none') === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`admin-btn${active ? ' primary' : ''}`}
                      onClick={() => setOv((o) => ({ ...o, motif: m }))}
                    >
                      {m === 'none' ? 'なし' : MOTIF_CHARS[m]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="shift-control-row">
              <span className="shift-control-label">色</span>
              <div className="shift-color-row">
                <label className="shift-color-item">
                  背景
                  <input
                    type="color"
                    value={ov.bg ?? base.palette.bg}
                    onChange={(e) => setOv((o) => ({ ...o, bg: e.target.value }))}
                  />
                </label>
                <label className="shift-color-item">
                  アクセント
                  <input
                    type="color"
                    value={ov.accent ?? base.palette.accent}
                    onChange={(e) => setOv((o) => ({ ...o, accent: e.target.value }))}
                  />
                </label>
                <label className="shift-color-item">
                  見出し文字
                  <input
                    type="color"
                    value={ov.headerText ?? base.palette.headerText}
                    onChange={(e) => setOv((o) => ({ ...o, headerText: e.target.value }))}
                  />
                </label>
                <label className="shift-color-item">
                  キャスト名
                  <input
                    type="color"
                    value={ov.castName ?? base.palette.castName}
                    onChange={(e) => setOv((o) => ({ ...o, castName: e.target.value }))}
                  />
                </label>
              </div>
            </div>

            {hasCustom ? (
              <div className="admin-btn-row" style={{ marginTop: 10 }}>
                <button type="button" className="admin-btn" onClick={() => setOv({})}>
                  カスタマイズをリセット
                </button>
              </div>
            ) : null}
          </div>

          <div className="admin-card" style={{ marginBottom: 0 }}>
            <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
              背景画像
            </div>
            <p className="admin-note" style={{ marginTop: 0 }}>
              画像をアップロードして、シフトデータを重ねて表示します。
            </p>
            <div className="admin-form-row">
              <input
                type="file"
                accept="image/*"
                disabled={bgUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBgUploading(true);
                  setPlacement(null);
                  setAnalyzeError(null);
                  try {
                    const url = await uploadShiftBackground(tenant.id, file);
                    setBgImageUrl(url);
                  } catch (err) {
                    console.warn('[kyasuho] uploadShiftBackground failed:', err);
                    window.alert('背景画像のアップロードに失敗しました。');
                  } finally {
                    setBgUploading(false);
                  }
                }}
              />
              {bgImageUrl ? (
                <button type="button" className="admin-btn" onClick={() => { setBgImageUrl(null); setPlacement(null); setAnalyzeError(null); }}>
                  解除
                </button>
              ) : null}
            </div>
            {bgImageUrl && !placement ? (
              <div style={{ marginTop: 8 }}>
                <p className="admin-note" style={{ marginTop: 0 }}>
                  取り込みモードを選択してください。
                </p>
                <div className="admin-btn-row">
                  <button
                    type="button"
                    className="admin-btn primary"
                    disabled={analyzeBusy}
                    onClick={() => void handleDetectGrid()}
                  >
                    {analyzeBusy ? '検出中…' : '空テンプレート（グリッド自動検出）'}
                  </button>
                  <button
                    type="button"
                    className="admin-btn primary"
                    onClick={handleFreeformMode}
                  >
                    好きな画像を背景に
                  </button>
                </div>
              </div>
            ) : null}
            {analyzeError ? <p className="admin-error">{analyzeError}</p> : null}
            {placement ? (
              <div style={{ marginTop: 8 }}>
                <p className="admin-note" style={{ marginTop: 0 }}>
                  配置が設定されました。下のスライダーで微調整できます。
                </p>
                <PlacementEditor placement={placement} onChange={setPlacement} />
              </div>
            ) : null}
          </div>

          <div className="admin-card" style={{ marginBottom: 0 }}>
            <div className="admin-section-title" style={{ margin: '0 0 8px' }}>
              お気に入り
            </div>
            <div className="admin-form-row">
              <div className="admin-field" style={{ flex: 1 }}>
                <label htmlFor="fav-name">名前（空欄はテンプレ名で保存）</label>
                <input
                  id="fav-name"
                  type="text"
                  style={{ width: '100%' }}
                  value={favName}
                  onChange={(e) => setFavName(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="admin-btn primary"
                disabled={favBusy}
                onClick={() => void handleSaveFavorite()}
              >
                {favBusy ? '保存中…' : '現在の設定を保存'}
              </button>
            </div>
            {favorites.length === 0 ? (
              <p className="admin-note">保存済みのお気に入りはありません。</p>
            ) : (
              <div>
                {favorites.map((fav) => (
                  <div key={fav.id} className="shift-fav-item">
                    <span className="shift-fav-name">{fav.name}</span>
                    <span className="shift-fav-base">
                      {fav.template_key === 'ai'
                        ? 'AIデザイン'
                        : (findTemplate(fav.template_key)?.name ?? fav.template_key)}
                    </span>
                    <span className="admin-spacer" />
                    <button type="button" className="admin-btn" onClick={() => handleLoadFavorite(fav)}>
                      読み込む
                    </button>
                    <button
                      type="button"
                      className="admin-btn danger"
                      onClick={() => void handleDeleteFavorite(fav)}
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SNS投稿（§31＋§40-3） */}
      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-section-title" style={{ margin: '0 0 8px' }}>SNS投稿</div>
        <p className="admin-note" style={{ marginTop: 0 }}>
          シフト表画像をダウンロードした後、SNSで共有できます。投稿文をコピーしてご利用ください。
        </p>
        <div style={{ marginTop: 8, padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#333' }}>
          {buildSnsText()}
          {(() => { const len = estimateXLength(buildSnsText()); return len > 280 ? <div style={{ marginTop: 8, color: '#d97706', fontWeight: 600 }}>⚠ X字数目安: {len}/280（超過。投稿時に編集してください）</div> : null; })()}
        </div>
        <div className="admin-btn-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="admin-btn primary"
            onClick={() => {
              const text = buildSnsText();
              window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank');
            }}
          >
            Xで投稿
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              const text = buildSnsText();
              void navigator.clipboard.writeText(text).then(() => window.alert('投稿文をコピーしました'));
            }}
          >
            投稿文をコピー
          </button>
          <button type="button" className="admin-btn" onClick={() => setShowTmplEditor(true)}>
            テンプレ編集
          </button>
        </div>
      </div>

      {showTmplEditor ? (
        <SnsTemplateEditor
          templates={tenant.sns_post_templates ?? {}}
          tenantId={tenant.id}
          storeName={tenant.name}
          yearMonth={yearMonth}
          dailyDate={dailyDate}
          days={days}
          casts={casts}
          reserveUrl={reserveUrl}
          onClose={() => setShowTmplEditor(false)}
          onSave={(t) => {
            (tenant as unknown as Record<string, unknown>).sns_post_templates = t;
            setShowTmplEditor(false);
          }}
        />
      ) : null}

      {/* PNG出力用の等倍オフスクリーンノード（プレビューのscaleを避けて確実に実寸で撮る） */}
      <div style={{ position: 'fixed', left: -20000, top: 0 }} aria-hidden="true">
        <div ref={exportRef}>
          <ShiftTableRenderer def={def} days={viewMode === 'daily' ? dailyDaysForPage : days} yearMonth={yearMonth} storeName={tenant.name} dailyDate={viewMode === 'daily' ? dailyDate : undefined} bgImageUrl={bgImageUrl} eventDays={eventDays} pageInfo={viewMode === 'daily' && dailyTotalPages > 1 ? { page: safeDailyPage + 1, total: dailyTotalPages } : undefined} />
        </div>
      </div>
    </div>
  );
}


function PlacementEditor({
  placement: pl,
  onChange,
}: {
  placement: ShiftPlacement;
  onChange: (p: ShiftPlacement) => void;
}) {
  const setGrid = (key: keyof ShiftPlacement['gridArea'], v: number) =>
    onChange({ ...pl, gridArea: { ...pl.gridArea, [key]: v } });
  const setTitle = (key: keyof ShiftPlacement['titleArea'], v: number) =>
    onChange({ ...pl, titleArea: { ...pl.titleArea, [key]: v } });

  return (
    <div className="placement-editor">
      <div className="admin-section-title" style={{ margin: '0 0 6px', fontSize: 13 }}>
        グリッド領域
      </div>
      <div className="placement-slider-grid">
        <label>X <input type="range" min="0" max="100" value={Math.round(pl.gridArea.x * 100)} onChange={(e) => setGrid('x', Number(e.target.value) / 100)} /> {Math.round(pl.gridArea.x * 100)}%</label>
        <label>Y <input type="range" min="0" max="100" value={Math.round(pl.gridArea.y * 100)} onChange={(e) => setGrid('y', Number(e.target.value) / 100)} /> {Math.round(pl.gridArea.y * 100)}%</label>
        <label>幅 <input type="range" min="10" max="100" value={Math.round(pl.gridArea.w * 100)} onChange={(e) => setGrid('w', Number(e.target.value) / 100)} /> {Math.round(pl.gridArea.w * 100)}%</label>
        <label>高さ <input type="range" min="10" max="100" value={Math.round(pl.gridArea.h * 100)} onChange={(e) => setGrid('h', Number(e.target.value) / 100)} /> {Math.round(pl.gridArea.h * 100)}%</label>
      </div>
      <div className="admin-section-title" style={{ margin: '8px 0 6px', fontSize: 13 }}>
        タイトル領域
      </div>
      <div className="placement-slider-grid">
        <label>X <input type="range" min="0" max="100" value={Math.round(pl.titleArea.x * 100)} onChange={(e) => setTitle('x', Number(e.target.value) / 100)} /> {Math.round(pl.titleArea.x * 100)}%</label>
        <label>Y <input type="range" min="0" max="100" value={Math.round(pl.titleArea.y * 100)} onChange={(e) => setTitle('y', Number(e.target.value) / 100)} /> {Math.round(pl.titleArea.y * 100)}%</label>
        <label>幅 <input type="range" min="5" max="100" value={Math.round(pl.titleArea.w * 100)} onChange={(e) => setTitle('w', Number(e.target.value) / 100)} /> {Math.round(pl.titleArea.w * 100)}%</label>
        <label>高さ <input type="range" min="2" max="100" value={Math.round(pl.titleArea.h * 100)} onChange={(e) => setTitle('h', Number(e.target.value) / 100)} /> {Math.round(pl.titleArea.h * 100)}%</label>
      </div>
      <div className="admin-section-title" style={{ margin: '8px 0 6px', fontSize: 13 }}>
        行列・ヘッダー
      </div>
      <div className="placement-slider-grid">
        <label>列数 <input type="range" min="1" max="14" value={pl.cols} onChange={(e) => onChange({ ...pl, cols: Number(e.target.value) })} /> {pl.cols}</label>
        <label>行数 <input type="range" min="1" max="10" value={pl.rows} onChange={(e) => onChange({ ...pl, rows: Number(e.target.value) })} /> {pl.rows}</label>
        <label>余白 <input type="range" min="0" max="10" value={pl.cellInset} onChange={(e) => onChange({ ...pl, cellInset: Number(e.target.value) })} /> {pl.cellInset}px</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={pl.hasHeaderRow} onChange={(e) => onChange({ ...pl, hasHeaderRow: e.target.checked })} />
          ヘッダー行あり
        </label>
      </div>
      <div className="admin-section-title" style={{ margin: '8px 0 6px', fontSize: 13 }}>
        配色
      </div>
      <div className="shift-color-row">
        <label className="shift-color-item">
          セル背景
          <input type="color" value={pl.cellBg} onChange={(e) => onChange({ ...pl, cellBg: e.target.value })} />
        </label>
        <label className="shift-color-item">
          テキスト
          <input type="color" value={pl.textColor} onChange={(e) => onChange({ ...pl, textColor: e.target.value })} />
        </label>
        <label className="shift-color-item">
          時間
          <input type="color" value={pl.timeColor} onChange={(e) => onChange({ ...pl, timeColor: e.target.value })} />
        </label>
        <label className="shift-color-item">
          アクセント
          <input type="color" value={pl.accentColor} onChange={(e) => onChange({ ...pl, accentColor: e.target.value })} />
        </label>
      </div>
      <div className="admin-section-title" style={{ margin: '8px 0 6px', fontSize: 13 }}>
        可読性ガード
      </div>
      <div className="placement-slider-grid">
        <label>セル不透明度 <input type="range" min="0" max="100" value={Math.round((pl.cellBgAlpha ?? 1) * 100)} onChange={(e) => onChange({ ...pl, cellBgAlpha: Number(e.target.value) / 100 })} /> {Math.round((pl.cellBgAlpha ?? 1) * 100)}%</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={pl.textOutline ?? false} onChange={(e) => onChange({ ...pl, textOutline: e.target.checked })} />
          文字の縁取り（背景画像上で読みやすくする）
        </label>
      </div>
    </div>
  );
}

// ── SNS投稿テンプレート編集モーダル（§40-3） ──────────────────────────

const PLACEHOLDERS_DAILY = [
  { key: '{{store_name}}', label: '店名' },
  { key: '{{date}}', label: '日付' },
  { key: '{{time}}', label: '時間帯' },
  { key: '{{name}}', label: 'キャスト名' },
  { key: '{{account}}', label: 'Xアカウント' },
  { key: '{{reservation_url}}', label: '予約URL' },
];
const PLACEHOLDERS_MONTHLY = [
  { key: '{{store_name}}', label: '店名' },
  { key: '{{month}}', label: '月' },
  { key: '{{reservation_url}}', label: '予約URL' },
];

function SnsTemplateEditor({
  templates,
  tenantId,
  storeName,
  yearMonth,
  dailyDate,
  days,
  casts,
  reserveUrl,
  onClose,
  onSave,
}: {
  templates: SnsPostTemplates;
  tenantId: string;
  storeName: string;
  yearMonth: string;
  dailyDate: string;
  days: import('../shiftTemplates/shiftData').ShiftDayData[];
  casts: KyCast[];
  reserveUrl: string;
  onClose: () => void;
  onSave: (t: SnsPostTemplates) => void;
}) {
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily');
  const [daily, setDaily] = useState<SnsPostTemplate>(templates.daily ?? DEFAULT_DAILY_TEMPLATE);
  const [monthly, setMonthly] = useState<SnsPostTemplate>(templates.monthly ?? DEFAULT_MONTHLY_TEMPLATE);
  const [saving, setSaving] = useState(false);

  const cur = tab === 'daily' ? daily : monthly;
  const setCur = tab === 'daily' ? setDaily : setMonthly;
  const placeholders = tab === 'daily' ? PLACEHOLDERS_DAILY : PLACEHOLDERS_MONTHLY;

  const preview = useMemo(() => {
    if (tab === 'daily') {
      const dayData = days.find(d => d.date === dailyDate);
      const entries: PostCastEntry[] = (dayData?.casts ?? []).map(c => {
        const cast = casts.find(cc => cc.name === c.name);
        return { name: c.name, nameKana: cast?.name_kana ?? c.name, start: c.start, xHandle: extractXHandle(cast?.sns_links ?? []) };
      });
      return buildDailyPost(daily, storeName, dailyDate, entries, reserveUrl);
    }
    return buildMonthlyPostText(monthly, storeName, yearMonth, reserveUrl);
  }, [tab, daily, monthly, storeName, yearMonth, dailyDate, days, casts, reserveUrl]);

  const xLen = estimateXLength(preview);

  const handleSave = async () => {
    setSaving(true);
    try {
      const next: SnsPostTemplates = { daily, monthly };
      await updateSnsPostTemplates(tenantId, next);
      onSave(next);
    } catch (e) {
      console.warn('[kyasuho] updateSnsPostTemplates:', e);
      window.alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const insertPlaceholder = (ph: string) => {
    setCur(prev => ({ ...prev, footer: prev.footer + ph }));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 640, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>投稿テンプレート編集</h3>
          <span style={{ flex: 1 }} />
          <button type="button" className="admin-btn" onClick={onClose} style={{ fontSize: 16, padding: '2px 8px' }}>✕</button>
        </div>

        <div className="admin-btn-row" style={{ marginBottom: 12 }}>
          <button type="button" className={`admin-btn${tab === 'daily' ? ' primary' : ''}`} onClick={() => setTab('daily')}>デイリー</button>
          <button type="button" className={`admin-btn${tab === 'monthly' ? ' primary' : ''}`} onClick={() => setTab('monthly')}>マンスリー</button>
        </div>

        <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
          タップで末尾に挿入:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
          {placeholders.map(p => (
            <button key={p.key} type="button" onClick={() => insertPlaceholder(p.key)} style={{ padding: '3px 10px', background: '#e5e7eb', borderRadius: 4, fontSize: 12, cursor: 'pointer', border: '1px solid #d1d5db' }} title={`フッターに ${p.key} を挿入`}>
              {p.label} <code style={{ fontSize: 11 }}>{p.key}</code>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>ヘッダー
            <textarea value={cur.header} onChange={e => setCur(prev => ({ ...prev, header: e.target.value }))} rows={2} style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
          </label>
          {tab === 'daily' && (
            <>
              <label style={{ fontSize: 13, fontWeight: 600 }}>時間帯見出し
                <textarea value={cur.group_heading} onChange={e => setCur(prev => ({ ...prev, group_heading: e.target.value }))} rows={1} style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600 }}>キャスト1行
                <textarea value={cur.line} onChange={e => setCur(prev => ({ ...prev, line: e.target.value }))} rows={1} style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
              </label>
            </>
          )}
          <label style={{ fontSize: 13, fontWeight: 600 }}>フッター
            <textarea value={cur.footer} onChange={e => setCur(prev => ({ ...prev, footer: e.target.value }))} rows={2} style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, boxSizing: 'border-box' }} />
          </label>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          プレビュー{' '}
          {xLen > 280
            ? <span style={{ color: '#d97706', fontWeight: 400 }}>⚠ {xLen}/280文字</span>
            : <span style={{ color: '#6b7280', fontWeight: 400 }}>{xLen}/280文字</span>}
        </div>
        <div style={{ padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#333', marginBottom: 16, maxHeight: 200, overflow: 'auto', border: '1px solid #e5e7eb' }}>
          {preview}
        </div>

        <div className="admin-btn-row">
          <button type="button" className="admin-btn primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? '保存中…' : '保存'}
          </button>
          <button type="button" className="admin-btn" onClick={() => {
            if (tab === 'daily') setDaily(DEFAULT_DAILY_TEMPLATE);
            else setMonthly(DEFAULT_MONTHLY_TEMPLATE);
          }}>
            既定に戻す
          </button>
          <button type="button" className="admin-btn" onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

