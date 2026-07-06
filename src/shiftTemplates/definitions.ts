// src/shiftTemplates/definitions.ts — シフト表テンプレート定義20種（SPEC §22・アプリ側コピー）
//
// ★正準は web/src/shiftTemplates/definitions.ts（Web側）。このファイルは同一内容のコピー同期。
//   変更する時は必ずWeb側を先に変えて、ここへ同じ内容を写す（§22）。
//
// 設計: テンプレート＝純データ（ShiftTemplateDefinition）。描画は各プラットフォームの
// 共通レンダラー（Web=DOM+CSS / アプリ=RN View）が行う。AI生成（§22）も同じ型を出す。
// fonts はプラットフォーム非依存の抽象キー（'sans-jp'|'serif-jp'|'rounded-jp'）で持ち、
// レンダラー側で実フォントスタックへ解決する。

export type ShiftTemplateCategory =
  | 'elegant'
  | 'pop'
  | 'gothic'
  | 'wafu'
  | 'simple'
  | 'neon'
  | 'pastel'
  | 'seasonal'
  | 'ai';

export type ShiftMotif = 'stars' | 'hearts' | 'flowers' | 'sakura' | 'lightning' | 'none';

/** 抽象フォントキー（Web=CSSスタック / RN=fontFamily へ各レンダラーが解決） */
export type ShiftFontKey = 'sans-jp' | 'serif-jp' | 'rounded-jp';

export type ShiftHeaderStyle = 'ribbon' | 'plain' | 'underline';

export type ShiftLayout = 'month-grid' | 'week-rows' | 'daily-lineup';

export type ShiftPalette = {
  bg: string;
  bgGradient?: [string, string];
  headerText: string;
  dayLabel: string;
  castName: string;
  timeText: string;
  accent: string;
  cellBg: string;
  cellBorder: string;
};

export type ShiftTemplateDefinition = {
  id: string; // 'elegant-rose' 等（AI生成は 'ai-<uuid>'）
  name: string; // 表示名
  category: ShiftTemplateCategory;
  size: { w: number; h: number }; // 1080x1350（4:5）基準・1080x1920（9:16）派生
  palette: ShiftPalette;
  fonts: { header: ShiftFontKey; body: ShiftFontKey };
  layout: ShiftLayout;
  decorations: {
    cornerRadius: number;
    cellGap: number;
    headerStyle: ShiftHeaderStyle;
    motif?: ShiftMotif;
  };
  logoSlot: boolean; // 店ロゴ挿入枠
};

/** モチーフ→描画文字（BMPテキスト記号・両プラットフォームで描画可能なもの） */
export const MOTIF_CHARS: Record<Exclude<ShiftMotif, 'none'>, string> = {
  stars: '★',
  hearts: '♥',
  flowers: '✿',
  sakura: '❀',
  lightning: '⚡',
};

const SIZE_45: { w: number; h: number } = { w: 1080, h: 1350 };

/**
 * テンプレート20種（§22内訳: エレガント3・ポップ3・ゴシック2・和風2・シンプル3・
 * ネオン2・パステル3・シーズナル2）
 */
export const SHIFT_TEMPLATES: ShiftTemplateDefinition[] = [
  // ── エレガント3 ──
  {
    id: 'elegant-rose',
    name: 'エレガント・ローズ',
    category: 'elegant',
    size: SIZE_45,
    palette: {
      bg: '#FDF6F7',
      bgGradient: ['#FDF6F0', '#F8E7EC'],
      headerText: '#8E3B5A',
      dayLabel: '#A3798B',
      castName: '#5A3A48',
      timeText: '#96707F',
      accent: '#C46A8A',
      cellBg: '#FFFFFF',
      cellBorder: '#EBD3DC',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 14, cellGap: 6, headerStyle: 'ribbon', motif: 'flowers' },
    logoSlot: true,
  },
  {
    id: 'elegant-noir',
    name: 'エレガント・ノワール',
    category: 'elegant',
    size: SIZE_45,
    palette: {
      bg: '#1D1A22',
      bgGradient: ['#241F2B', '#161219'],
      headerText: '#E8C9A0',
      dayLabel: '#A79B8C',
      castName: '#F2E9DC',
      timeText: '#C4B49E',
      accent: '#B58B54',
      cellBg: 'rgba(255,255,255,0.05)',
      cellBorder: 'rgba(232,201,160,0.25)',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 10, cellGap: 8, headerStyle: 'underline', motif: 'none' },
    logoSlot: true,
  },
  {
    id: 'elegant-pearl',
    name: 'エレガント・パール',
    category: 'elegant',
    size: SIZE_45,
    palette: {
      bg: '#F7F5F2',
      headerText: '#6C6257',
      dayLabel: '#9C948A',
      castName: '#4E463D',
      timeText: '#8B8378',
      accent: '#A99985',
      cellBg: '#FFFFFF',
      cellBorder: '#E5DFD6',
    },
    fonts: { header: 'serif-jp', body: 'sans-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 8, cellGap: 6, headerStyle: 'plain', motif: 'none' },
    logoSlot: true,
  },

  // ── ポップ3 ──
  {
    id: 'pop-candy',
    name: 'ポップ・キャンディ',
    category: 'pop',
    size: SIZE_45,
    palette: {
      bg: '#FFF4F9',
      bgGradient: ['#FFEFF7', '#E8F4FF'],
      headerText: '#FF5FA2',
      dayLabel: '#B58AA0',
      castName: '#69445A',
      timeText: '#A0788E',
      accent: '#FFB03A',
      cellBg: '#FFFFFF',
      cellBorder: '#FFD6E8',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 20, cellGap: 8, headerStyle: 'ribbon', motif: 'hearts' },
    logoSlot: true,
  },
  {
    id: 'pop-soda',
    name: 'ポップ・ソーダ',
    category: 'pop',
    size: SIZE_45,
    palette: {
      bg: '#EDFAFF',
      bgGradient: ['#EAF9FF', '#FFF8E8'],
      headerText: '#0FA3D9',
      dayLabel: '#7AA6B8',
      castName: '#2E5B6B',
      timeText: '#6E96A5',
      accent: '#FF7BAA',
      cellBg: '#FFFFFF',
      cellBorder: '#C9EBF7',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 20, cellGap: 8, headerStyle: 'ribbon', motif: 'stars' },
    logoSlot: true,
  },
  {
    id: 'pop-sunny',
    name: 'ポップ・サニー',
    category: 'pop',
    size: SIZE_45,
    palette: {
      bg: '#FFFBEA',
      headerText: '#F2A50C',
      dayLabel: '#B39A6B',
      castName: '#6B5326',
      timeText: '#9C8657',
      accent: '#FF6B6B',
      cellBg: '#FFFFFF',
      cellBorder: '#F5E4B8',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 16, cellGap: 8, headerStyle: 'ribbon', motif: 'stars' },
    logoSlot: true,
  },

  // ── ゴシック2 ──
  {
    id: 'gothic-rose',
    name: 'ゴシック・ローズ',
    category: 'gothic',
    size: SIZE_45,
    palette: {
      bg: '#14101A',
      bgGradient: ['#1B1424', '#0E0A12'],
      headerText: '#B01E48',
      dayLabel: '#8A7A96',
      castName: '#E6DDEB',
      timeText: '#B3A5BF',
      accent: '#7A2E8E',
      cellBg: 'rgba(255,255,255,0.04)',
      cellBorder: 'rgba(176,30,72,0.35)',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 6, cellGap: 6, headerStyle: 'underline', motif: 'flowers' },
    logoSlot: true,
  },
  {
    id: 'gothic-midnight',
    name: 'ゴシック・ミッドナイト',
    category: 'gothic',
    size: SIZE_45,
    palette: {
      bg: '#0D0D12',
      headerText: '#9AA7E0',
      dayLabel: '#6E7590',
      castName: '#D9DCEE',
      timeText: '#9BA2BE',
      accent: '#4A5AA8',
      cellBg: 'rgba(255,255,255,0.05)',
      cellBorder: 'rgba(154,167,224,0.25)',
    },
    fonts: { header: 'serif-jp', body: 'sans-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 6, cellGap: 8, headerStyle: 'plain', motif: 'none' },
    logoSlot: true,
  },

  // ── 和風2 ──
  {
    id: 'wafu-sakura',
    name: '和風・桜',
    category: 'wafu',
    size: SIZE_45,
    palette: {
      bg: '#FBF3F1',
      bgGradient: ['#FCF5EE', '#F6E4E4'],
      headerText: '#A63A50',
      dayLabel: '#A88A8A',
      castName: '#5C4040',
      timeText: '#8F7373',
      accent: '#D98E9C',
      cellBg: '#FFFDFB',
      cellBorder: '#E8D3D3',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 4, cellGap: 6, headerStyle: 'plain', motif: 'sakura' },
    logoSlot: true,
  },
  {
    id: 'wafu-kikyo',
    name: '和風・桔梗',
    category: 'wafu',
    size: SIZE_45,
    palette: {
      bg: '#F4F3EE',
      headerText: '#3A4A7A',
      dayLabel: '#8A8E9C',
      castName: '#3E4250',
      timeText: '#767B8C',
      accent: '#7A86B5',
      cellBg: '#FFFFFF',
      cellBorder: '#DCDDE2',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 4, cellGap: 8, headerStyle: 'underline', motif: 'none' },
    logoSlot: true,
  },

  // ── シンプル3 ──
  {
    id: 'simple-mono',
    name: 'シンプル・モノ',
    category: 'simple',
    size: SIZE_45,
    palette: {
      bg: '#FFFFFF',
      headerText: '#1F2933',
      dayLabel: '#7B8794',
      castName: '#323F4B',
      timeText: '#7B8794',
      accent: '#3E4C59',
      cellBg: '#F8F9FA',
      cellBorder: '#E4E7EB',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 8, cellGap: 6, headerStyle: 'plain', motif: 'none' },
    logoSlot: true,
  },
  {
    id: 'simple-navy',
    name: 'シンプル・ネイビー',
    category: 'simple',
    size: SIZE_45,
    palette: {
      bg: '#F7F9FC',
      headerText: '#1B3A6B',
      dayLabel: '#7C8AA5',
      castName: '#2A3B55',
      timeText: '#6C7C96',
      accent: '#2F6BB5',
      cellBg: '#FFFFFF',
      cellBorder: '#D8E2F0',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 8, cellGap: 6, headerStyle: 'underline', motif: 'none' },
    logoSlot: true,
  },
  {
    id: 'simple-warm',
    name: 'シンプル・ウォーム',
    category: 'simple',
    size: SIZE_45,
    palette: {
      bg: '#FAF7F2',
      headerText: '#6B4F3A',
      dayLabel: '#A08F7D',
      castName: '#54422F',
      timeText: '#8D7B66',
      accent: '#B0855F',
      cellBg: '#FFFFFF',
      cellBorder: '#E8DFD2',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 10, cellGap: 8, headerStyle: 'plain', motif: 'none' },
    logoSlot: true,
  },

  // ── ネオン2 ──
  {
    id: 'neon-pink',
    name: 'ネオン・ピンク',
    category: 'neon',
    size: SIZE_45,
    palette: {
      bg: '#0A0A14',
      bgGradient: ['#120F22', '#060610'],
      headerText: '#FF4FD8',
      dayLabel: '#8B84B8',
      castName: '#EAE6FF',
      timeText: '#A9A2D6',
      accent: '#00E5FF',
      cellBg: 'rgba(255,79,216,0.06)',
      cellBorder: 'rgba(0,229,255,0.35)',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 10, cellGap: 6, headerStyle: 'underline', motif: 'lightning' },
    logoSlot: true,
  },
  {
    id: 'neon-blue',
    name: 'ネオン・ブルー',
    category: 'neon',
    size: SIZE_45,
    palette: {
      bg: '#060A16',
      bgGradient: ['#0A1030', '#04060F'],
      headerText: '#38E6FF',
      dayLabel: '#7D8BB8',
      castName: '#E3EAFF',
      timeText: '#9FACD6',
      accent: '#7A5CFF',
      cellBg: 'rgba(56,230,255,0.05)',
      cellBorder: 'rgba(122,92,255,0.4)',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 10, cellGap: 8, headerStyle: 'underline', motif: 'stars' },
    logoSlot: true,
  },

  // ── パステル3 ──
  {
    id: 'pastel-lavender',
    name: 'パステル・ラベンダー',
    category: 'pastel',
    size: SIZE_45,
    palette: {
      bg: '#F6F2FC',
      bgGradient: ['#F7F1FD', '#EDF3FD'],
      headerText: '#7A5FA8',
      dayLabel: '#A195B8',
      castName: '#584A70',
      timeText: '#8D82A6',
      accent: '#A98BD8',
      cellBg: '#FFFFFF',
      cellBorder: '#E3DAF2',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 16, cellGap: 8, headerStyle: 'plain', motif: 'none' },
    logoSlot: true,
  },
  {
    id: 'pastel-mint',
    name: 'パステル・ミント',
    category: 'pastel',
    size: SIZE_45,
    palette: {
      bg: '#F0FAF5',
      headerText: '#2E8B6A',
      dayLabel: '#8AAE9E',
      castName: '#3C5C4F',
      timeText: '#749588',
      accent: '#7CCBA8',
      cellBg: '#FFFFFF',
      cellBorder: '#D4EDE1',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 16, cellGap: 8, headerStyle: 'ribbon', motif: 'none' },
    logoSlot: true,
  },
  {
    id: 'pastel-peach',
    name: 'パステル・ピーチ',
    category: 'pastel',
    size: SIZE_45,
    palette: {
      bg: '#FFF5F0',
      bgGradient: ['#FFF4EE', '#FFEDF4'],
      headerText: '#D96C57',
      dayLabel: '#BA9488',
      castName: '#6E4A3E',
      timeText: '#A17F72',
      accent: '#F5A88E',
      cellBg: '#FFFFFF',
      cellBorder: '#F7DACC',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 16, cellGap: 8, headerStyle: 'plain', motif: 'hearts' },
    logoSlot: true,
  },

  // ── シーズナル2 ──
  {
    id: 'seasonal-harugasumi',
    name: 'シーズナル・春霞',
    category: 'seasonal',
    size: SIZE_45,
    palette: {
      bg: '#FDF4F6',
      bgGradient: ['#FEF6F3', '#F9E8F0'],
      headerText: '#C25573',
      dayLabel: '#B08E9B',
      castName: '#644550',
      timeText: '#9A7784',
      accent: '#E8A0B4',
      cellBg: '#FFFFFF',
      cellBorder: '#F2D8E0',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 12, cellGap: 6, headerStyle: 'ribbon', motif: 'sakura' },
    logoSlot: true,
  },
  {
    id: 'seasonal-hoshiyo',
    name: 'シーズナル・星夜',
    category: 'seasonal',
    size: SIZE_45,
    palette: {
      bg: '#0E1430',
      bgGradient: ['#141B3E', '#090D20'],
      headerText: '#F5D76E',
      dayLabel: '#8A93B8',
      castName: '#E8ECFF',
      timeText: '#AAB2D6',
      accent: '#6E7FD8',
      cellBg: 'rgba(255,255,255,0.05)',
      cellBorder: 'rgba(245,215,110,0.28)',
    },
    fonts: { header: 'serif-jp', body: 'sans-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 12, cellGap: 6, headerStyle: 'plain', motif: 'stars' },
    logoSlot: true,
  },
];

/** カテゴリの表示名（ギャラリーUI用） */
export const CATEGORY_LABELS: Record<ShiftTemplateCategory, string> = {
  elegant: 'エレガント',
  pop: 'ポップ',
  gothic: 'ゴシック',
  wafu: '和風',
  simple: 'シンプル',
  neon: 'ネオン',
  pastel: 'パステル',
  seasonal: 'シーズナル',
  ai: 'AIデザイン',
};

export function findTemplate(id: string): ShiftTemplateDefinition | undefined {
  return SHIFT_TEMPLATES.find((t) => t.id === id);
}
