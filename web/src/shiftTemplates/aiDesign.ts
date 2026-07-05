// web/src/shiftTemplates/aiDesign.ts — AI生成デザインの検証・完全定義化（SPEC §22）
//
// ★このファイルが正準（Web側）。アプリ側 src/shiftTemplates/aiDesign.ts へは
//   同一内容をコピー同期する（definitions.ts と同じ運用）。
//
// Edge Function `ky-shift-design` が返す raw JSON を安全な ShiftTemplateDefinition に
// 変換する。サーバー側プロンプトで制約済みだが、AIの出力は信用しない前提で
// 全フィールドを検証し、不正値は FALLBACK（シンプル基調）の値へ落とす（二重防御）。
// レンダラーの溢れゼロ保証は cornerRadius / cellGap のクランプでレイアウト安全を維持する。

import type {
  ShiftFontKey,
  ShiftHeaderStyle,
  ShiftLayout,
  ShiftMotif,
  ShiftPalette,
  ShiftTemplateDefinition,
} from './definitions';

/** hex色のみ許可（#rgb / #rrggbb / #rrggbbaa）。色名・rgb()・url()等は全て弾く */
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const FONT_KEYS: ShiftFontKey[] = ['sans-jp', 'serif-jp', 'rounded-jp'];
const LAYOUTS: ShiftLayout[] = ['month-grid', 'week-rows'];
const HEADER_STYLES: ShiftHeaderStyle[] = ['ribbon', 'plain', 'underline'];
const MOTIFS: ShiftMotif[] = ['stars', 'hearts', 'flowers', 'sakura', 'lightning', 'none'];

/** AI出力が全損でも成立する基底（シンプル基調・category='ai'） */
const FALLBACK: Omit<ShiftTemplateDefinition, 'id'> = {
  name: 'AIデザイン',
  category: 'ai',
  size: { w: 1080, h: 1350 },
  palette: {
    bg: '#F7F7F7',
    headerText: '#333333',
    dayLabel: '#888888',
    castName: '#222222',
    timeText: '#666666',
    accent: '#7A6FF0',
    cellBg: '#FFFFFF',
    cellBorder: '#E2E2E2',
  },
  fonts: { header: 'sans-jp', body: 'sans-jp' },
  layout: 'month-grid',
  decorations: { cornerRadius: 12, cellGap: 6, headerStyle: 'plain', motif: 'none' },
  logoSlot: true,
};

function pickHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim() : fallback;
}

function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pickName(v: unknown): string {
  if (typeof v !== 'string') return FALLBACK.name;
  // 制御文字を除去して20字まで（プロンプトは12字指定だが保険で広めに切る）
  // eslint-disable-next-line no-control-regex
  const cleaned = v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20);
  return cleaned || FALLBACK.name;
}

/**
 * Edge Function の raw 出力（unknown）→ 完全な ShiftTemplateDefinition。
 * id は呼び出し側で採番して渡す（例: `ai-${Date.now()}`）。
 * extractAiDesign の出力を渡せば同一定義に復元されるラウンドトリップを保証する。
 */
export function buildAiDefinition(raw: unknown, id: string): ShiftTemplateDefinition {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const p = (typeof r['palette'] === 'object' && r['palette'] !== null ? r['palette'] : {}) as Record<
    string,
    unknown
  >;
  const f = (typeof r['fonts'] === 'object' && r['fonts'] !== null ? r['fonts'] : {}) as Record<
    string,
    unknown
  >;

  const fb = FALLBACK.palette;
  const palette: ShiftPalette = {
    bg: pickHex(p['bg'], fb.bg),
    headerText: pickHex(p['headerText'], fb.headerText),
    dayLabel: pickHex(p['dayLabel'], fb.dayLabel),
    castName: pickHex(p['castName'], fb.castName),
    timeText: pickHex(p['timeText'], fb.timeText),
    accent: pickHex(p['accent'], fb.accent),
    cellBg: pickHex(p['cellBg'], fb.cellBg),
    cellBorder: pickHex(p['cellBorder'], fb.cellBorder),
  };
  const g = p['bgGradient'];
  if (
    Array.isArray(g) &&
    g.length === 2 &&
    typeof g[0] === 'string' &&
    HEX_RE.test(g[0].trim()) &&
    typeof g[1] === 'string' &&
    HEX_RE.test(g[1].trim())
  ) {
    palette.bgGradient = [g[0].trim(), g[1].trim()];
  }

  return {
    id,
    name: pickName(r['name']),
    category: 'ai',
    size: { ...FALLBACK.size },
    palette,
    fonts: {
      header: pickEnum(f['header'], FONT_KEYS, FALLBACK.fonts.header),
      body: pickEnum(f['body'], FONT_KEYS, FALLBACK.fonts.body),
    },
    layout: pickEnum(r['layout'], LAYOUTS, FALLBACK.layout),
    decorations: {
      cornerRadius: clampInt(r['cornerRadius'], 0, 28, FALLBACK.decorations.cornerRadius),
      cellGap: clampInt(r['cellGap'], 4, 12, FALLBACK.decorations.cellGap),
      headerStyle: pickEnum(r['headerStyle'], HEADER_STYLES, FALLBACK.decorations.headerStyle),
      motif: pickEnum(r['motif'], MOTIFS, 'none'),
    },
    logoSlot: true,
  };
}

/**
 * 確定済みAI定義 → 保存用デザイン部分（ky_shift_templates.custom_settings.ai へ格納）。
 * buildAiDefinition の入力形式と同一構造＝ buildAiDefinition(extractAiDesign(def), id) で復元可能。
 */
export function extractAiDesign(def: ShiftTemplateDefinition): Record<string, unknown> {
  const design: Record<string, unknown> = {
    name: def.name,
    palette: { ...def.palette },
    fonts: { ...def.fonts },
    layout: def.layout,
    headerStyle: def.decorations.headerStyle,
    motif: def.decorations.motif ?? 'none',
    cornerRadius: def.decorations.cornerRadius,
    cellGap: def.decorations.cellGap,
  };
  return design;
}
