// web/src/admin/AdminShiftImage.tsx — シフト表画像生成（SPEC §3-I／§22・Web=主戦場）
//
// テンプレギャラリー（20種）→ プレビュー → カスタマイズ（色・モチーフ・レイアウト・サイズ）
// → PNGダウンロード（html-to-image・等倍オフスクリーンノードをキャプチャ）
// → お気に入り保存（ky_shift_templates.custom_settings に上書き差分を保存）

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import type { KyCast, KyShift, KyShiftTemplate, KyTenant } from '../lib/types';
import { formatDate } from '../lib/timeUtils';
import {
  addShiftTemplate,
  fetchCastList,
  fetchShiftTemplateList,
  fetchShiftsByMonth,
  removeShiftTemplate,
  requestAiShiftDesign,
} from './adminApi';
import type {
  ShiftLayout,
  ShiftMotif,
  ShiftTemplateCategory,
  ShiftTemplateDefinition,
} from '../shiftTemplates/definitions';
import {
  CATEGORY_LABELS,
  MOTIF_CHARS,
  SHIFT_TEMPLATES,
  findTemplate,
} from '../shiftTemplates/definitions';
import { buildShiftDays } from '../shiftTemplates/shiftData';
import { buildAiDefinition, extractAiDesign } from '../shiftTemplates/aiDesign';
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

const MOTIF_OPTIONS: ShiftMotif[] = ['none', 'stars', 'hearts', 'flowers', 'sakura', 'lightning'];

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

  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE.id);
  const [ov, setOv] = useState<ShiftOverrides>({});
  const [aspect, setAspect] = useState<Aspect>('4:5');
  const [exporting, setExporting] = useState(false);

  const [favName, setFavName] = useState('');
  const [favBusy, setFavBusy] = useState(false);

  // AIデザイン（§22: Edge Function ky-shift-design → buildAiDefinition で完全定義化）
  const [aiDef, setAiDef] = useState<ShiftTemplateDefinition | null>(null);
  const [aiMood, setAiMood] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const exportRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [shiftRows, castRows, favRows] = await Promise.all([
        fetchShiftsByMonth(tenant.id, yearMonth),
        fetchCastList(tenant.id),
        fetchShiftTemplateList(tenant.id),
      ]);
      setShifts(shiftRows);
      setCasts(castRows);
      setFavorites(favRows);
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
      a.download = viewMode === 'daily'
        ? `kyasuho_daily_${dailyDate}.png`
        : `kyasuho_shift_${yearMonth}.png`;
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
      await addShiftTemplate({
        tenantId: tenant.id,
        name: favName.trim() || `${base.name}（${aspect}）`,
        templateKey: isAi ? 'ai' : base.id,
        customSettings: isAi ? { ...ov, aspect, ai: extractAiDesign(base) } : { ...ov, aspect },
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
    if (fav.template_key === 'ai') {
      // AI生成デザインの復元（custom_settings.ai → buildAiDefinition＝保存時とラウンドトリップ）
      const def = buildAiDefinition(fav.custom_settings['ai'], `ai-${Date.now()}`);
      setAiDef(def);
      setTemplateId(def.id);
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
            }}>
              ◀ 前日
            </button>
            <input type="date" value={dailyDate} onChange={(e) => {
              setDailyDate(e.target.value);
              setYearMonth(e.target.value.slice(0, 7));
            }} />
            <button type="button" className="admin-btn" onClick={() => {
              const nd = shiftDay(dailyDate, 1);
              setDailyDate(nd);
              setYearMonth(nd.slice(0, 7));
            }}>
              翌日 ▶
            </button>
            <button type="button" className="admin-btn" onClick={() => {
              const today = formatDate(new Date());
              setDailyDate(today);
              setYearMonth(today.slice(0, 7));
            }}>
              今日
            </button>
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
              <ShiftTableRenderer def={def} days={days} yearMonth={yearMonth} storeName={tenant.name} dailyDate={viewMode === 'daily' ? dailyDate : undefined} />
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
              テンプレート（20種）
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

      {/* SNS投稿（§31） */}
      <div className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-section-title" style={{ margin: '0 0 8px' }}>SNS投稿</div>
        <p className="admin-note" style={{ marginTop: 0 }}>
          シフト表画像をダウンロードした後、SNSで共有できます。投稿文をコピーしてご利用ください。
        </p>
        <div className="admin-btn-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="admin-btn primary"
            onClick={() => {
              const text = viewMode === 'daily'
                ? buildDailyPostText(dailyDate, days, tenant.slug)
                : buildWebPostText(yearMonth, casts, shifts, tenant.slug);
              window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank');
            }}
          >
            Xで投稿
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              const text = viewMode === 'daily'
                ? buildDailyPostText(dailyDate, days, tenant.slug)
                : buildWebPostText(yearMonth, casts, shifts, tenant.slug);
              void navigator.clipboard.writeText(text).then(() => window.alert('投稿文をコピーしました'));
            }}
          >
            投稿文をコピー
          </button>
        </div>
      </div>

      {/* PNG出力用の等倍オフスクリーンノード（プレビューのscaleを避けて確実に実寸で撮る） */}
      <div style={{ position: 'fixed', left: -20000, top: 0 }} aria-hidden="true">
        <div ref={exportRef}>
          <ShiftTableRenderer def={def} days={days} yearMonth={yearMonth} storeName={tenant.name} dailyDate={viewMode === 'daily' ? dailyDate : undefined} />
        </div>
      </div>
    </div>
  );
}

function buildWebPostText(
  yearMonth: string,
  casts: KyCast[],
  shifts: KyShift[],
  slug: string,
): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const monthLabel = `${y}年${m}月`;
  const castIds = [...new Set(shifts.map(s => s.cast_id))];
  const names = castIds
    .map(id => casts.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join('・');
  const reserveUrl = `https://rurifukuro.github.io/kyasuho/#/${slug}`;
  const lines = [`${monthLabel}のシフトが出ました！`];
  if (names) lines.push(`出勤キャスト: ${names}`);
  lines.push('');
  lines.push(`ご予約はこちら ▼\n${reserveUrl}`);
  return lines.join('\n');
}

function buildDailyPostText(
  date: string,
  days: import('../shiftTemplates/shiftData').ShiftDayData[],
  slug: string,
): string {
  const [, m, d] = date.split('-').map(Number);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][new Date(date).getDay()]!;
  const dayData = days.find(dd => dd.date === date);
  const names = dayData?.casts.map(c => c.name).join('・') ?? '';
  const reserveUrl = `https://rurifukuro.github.io/kyasuho/#/${slug}`;
  const lines = [`本日 ${m}/${d}(${wd}) の出勤キャスト`];
  if (names) lines.push(names);
  lines.push('');
  lines.push(`ご予約はこちら ▼\n${reserveUrl}`);
  return lines.join('\n');
}
