// src/shiftTemplates/definitions.ts — シフト表テンプレート定義40種（SPEC §22・アプリ側コピー）
//
// ★正準は web/src/shiftTemplates/definitions.ts（Web側）。このファイルは同一内容のコピー同期。
//   変更する時は必ずWeb側を先に変えて、ここへ同じ内容を写す（§22）。
//   ※Web専用の ShiftPlacement / defaultFreeformPlacement（§22-3/§22-5）はアプリ側には持たない。
//
// 重複回避原則（Rev76）: 同カテゴリ内のテンプレートは layout / headerStyle / frame / motif
// の組合せが必ず異なること（「色を変えただけ」の複製を作らない）。
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
  | 'ribbon'
  | 'ai';

export type ShiftMotif =
  | 'stars'
  | 'hearts'
  | 'flowers'
  | 'sakura'
  | 'lightning'
  | 'ribbon'
  | 'cross'
  | 'moon'
  | 'crown'
  | 'snow'
  | 'none';

/** 抽象フォントキー（Web=CSSスタック / RN=fontFamily へ各レンダラーが解決） */
export type ShiftFontKey = 'sans-jp' | 'serif-jp' | 'rounded-jp';

/** banner = ribbonの派生ではなく別形状（両端に切込みテールが付く帯・Rev76追加） */
export type ShiftHeaderStyle = 'ribbon' | 'plain' | 'underline' | 'banner';

/**
 * 外周フレーム装飾（Rev76追加）。テンプレ間の「色違いだけ」重複を避ける構造差の語彙。
 * - double: 二重線フレーム
 * - lace: 上下端のスカラップ（半円連続＝レース風）
 * - dashed: 破線フレーム
 * - corner-motif: 四隅にモチーフ文字を配置
 */
export type ShiftFrameStyle = 'none' | 'double' | 'lace' | 'dashed' | 'corner-motif';

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
  eventAccent?: string;
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
    frame?: ShiftFrameStyle; // 省略時 'none'（AI生成・保存済み定義との後方互換）
  };
  logoSlot: boolean; // 店ロゴ挿入枠
};

/** モチーフ→描画文字（両プラットフォームで描画可能なもの。⚡🎀は絵文字＝固定色で描画される） */
export const MOTIF_CHARS: Record<Exclude<ShiftMotif, 'none'>, string> = {
  stars: '★',
  hearts: '♥',
  flowers: '✿',
  sakura: '❀',
  lightning: '⚡',
  ribbon: '🎀',
  cross: '✟',
  moon: '☾',
  crown: '♛',
  snow: '❆',
};

const SIZE_45: { w: number; h: number } = { w: 1080, h: 1350 };

/**
 * テンプレート40種（§22内訳: エレガント5・ポップ5・ゴシック5・和風4・シンプル5・
 * ネオン4・パステル5・シーズナル4・リボン3）
 */
export const SHIFT_TEMPLATES: ShiftTemplateDefinition[] = [
  // ── エレガント5 ──
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
    decorations: {
      cornerRadius: 14,
      cellGap: 6,
      headerStyle: 'ribbon',
      motif: 'flowers',
      frame: 'lace',
    },
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
    decorations: { cornerRadius: 8, cellGap: 6, headerStyle: 'plain', motif: 'none', frame: 'double' },
    logoSlot: true,
  },
  {
    id: 'elegant-lace',
    name: 'エレガント・レース',
    category: 'elegant',
    size: SIZE_45,
    palette: {
      bg: '#FBF8F4',
      bgGradient: ['#FCF9F5', '#F4EDE4'],
      headerText: '#9C7C3C',
      dayLabel: '#A79B82',
      castName: '#57503F',
      timeText: '#8C816A',
      accent: '#C2A25E',
      cellBg: '#FFFFFF',
      cellBorder: '#E9DFC8',
    },
    fonts: { header: 'serif-jp', body: 'sans-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 10, cellGap: 8, headerStyle: 'banner', motif: 'none', frame: 'lace' },
    logoSlot: true,
  },
  {
    id: 'elegant-wine',
    name: 'エレガント・ワイン',
    category: 'elegant',
    size: SIZE_45,
    palette: {
      bg: '#241016',
      bgGradient: ['#2C1219', '#180A0F'],
      headerText: '#E8B4C4',
      dayLabel: '#A48792',
      castName: '#F4E4EA',
      timeText: '#C7A9B4',
      accent: '#B84A6E',
      cellBg: 'rgba(255,255,255,0.05)',
      cellBorder: 'rgba(232,180,196,0.25)',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'month-grid',
    decorations: {
      cornerRadius: 10,
      cellGap: 6,
      headerStyle: 'underline',
      motif: 'crown',
      frame: 'corner-motif',
    },
    logoSlot: true,
  },

  // ── ポップ5 ──
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
    decorations: { cornerRadius: 20, cellGap: 8, headerStyle: 'banner', motif: 'stars' },
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
  {
    id: 'pop-carnival',
    name: 'ポップ・カーニバル',
    category: 'pop',
    size: SIZE_45,
    palette: {
      bg: '#FFF8EE',
      bgGradient: ['#FFF6E8', '#EEF7FF'],
      headerText: '#F2611A',
      dayLabel: '#B09678',
      castName: '#5E4A30',
      timeText: '#99835F',
      accent: '#22B6C8',
      cellBg: '#FFFFFF',
      cellBorder: '#FFE0B8',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'month-grid',
    decorations: {
      cornerRadius: 20,
      cellGap: 8,
      headerStyle: 'ribbon',
      motif: 'stars',
      frame: 'dashed',
    },
    logoSlot: true,
  },
  {
    id: 'pop-chocomint',
    name: 'ポップ・チョコミント',
    category: 'pop',
    size: SIZE_45,
    palette: {
      bg: '#F0FBF7',
      bgGradient: ['#EDFAF5', '#F7F0E8'],
      headerText: '#1FA98B',
      dayLabel: '#8FA89E',
      castName: '#4E3A2E',
      timeText: '#7D9188',
      accent: '#6B4A36',
      cellBg: '#FFFFFF',
      cellBorder: '#CFEBDF',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'week-rows',
    decorations: {
      cornerRadius: 14,
      cellGap: 8,
      headerStyle: 'plain',
      motif: 'hearts',
      frame: 'dashed',
    },
    logoSlot: true,
  },

  // ── ゴシック5（ゴスロリ系を含む） ──
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
    decorations: {
      cornerRadius: 6,
      cellGap: 6,
      headerStyle: 'underline',
      motif: 'cross',
      frame: 'corner-motif',
    },
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
  {
    id: 'gothic-lolita-noir',
    name: 'ゴスロリ・ノワール',
    category: 'gothic',
    size: SIZE_45,
    palette: {
      bg: '#171219',
      bgGradient: ['#1E1620', '#100B12'],
      headerText: '#F2D7E4',
      dayLabel: '#9A8FA3',
      castName: '#F0E8F2',
      timeText: '#C0B2C8',
      accent: '#D96A9E',
      cellBg: 'rgba(255,255,255,0.05)',
      cellBorder: 'rgba(217,106,158,0.35)',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'month-grid',
    decorations: {
      cornerRadius: 8,
      cellGap: 6,
      headerStyle: 'banner',
      motif: 'ribbon',
      frame: 'lace',
    },
    logoSlot: true,
  },
  {
    id: 'gothic-lolita-blanc',
    name: 'ゴスロリ・ブラン',
    category: 'gothic',
    size: SIZE_45,
    palette: {
      bg: '#FBFAF8',
      headerText: '#2A2226',
      dayLabel: '#8E8288',
      castName: '#3A3036',
      timeText: '#7A6E74',
      accent: '#8C2438',
      cellBg: '#FFFFFF',
      cellBorder: '#E2D8DC',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'week-rows',
    decorations: {
      cornerRadius: 10,
      cellGap: 8,
      headerStyle: 'plain',
      motif: 'cross',
      frame: 'lace',
    },
    logoSlot: true,
  },
  {
    id: 'gothic-crimson',
    name: 'ゴシック・クリムゾン',
    category: 'gothic',
    size: SIZE_45,
    palette: {
      bg: '#1A0D10',
      bgGradient: ['#220F13', '#12080A'],
      headerText: '#E04358',
      dayLabel: '#A08088',
      castName: '#F2DEE2',
      timeText: '#C4A4AC',
      accent: '#8E1E30',
      cellBg: 'rgba(255,255,255,0.04)',
      cellBorder: 'rgba(224,67,88,0.3)',
    },
    fonts: { header: 'serif-jp', body: 'sans-jp' },
    layout: 'week-rows',
    decorations: {
      cornerRadius: 6,
      cellGap: 8,
      headerStyle: 'underline',
      motif: 'moon',
      frame: 'double',
    },
    logoSlot: true,
  },

  // ── 和風4 ──
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
    decorations: { cornerRadius: 4, cellGap: 6, headerStyle: 'plain', motif: 'sakura', frame: 'double' },
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
  {
    id: 'wafu-sumi',
    name: '和風・墨',
    category: 'wafu',
    size: SIZE_45,
    palette: {
      bg: '#F7F6F2',
      headerText: '#26241F',
      dayLabel: '#8C8880',
      castName: '#33302A',
      timeText: '#6E6A62',
      accent: '#A03A28',
      cellBg: '#FFFFFF',
      cellBorder: '#D8D5CC',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 2, cellGap: 8, headerStyle: 'plain', motif: 'none', frame: 'double' },
    logoSlot: true,
  },
  {
    id: 'wafu-koharu',
    name: '和風・小春',
    category: 'wafu',
    size: SIZE_45,
    palette: {
      bg: '#FBF4EA',
      bgGradient: ['#FCF6EC', '#F6E7D6'],
      headerText: '#B0562A',
      dayLabel: '#AC9074',
      castName: '#5C4630',
      timeText: '#927A5E',
      accent: '#D08A3E',
      cellBg: '#FFFEF9',
      cellBorder: '#EAD9C0',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'month-grid',
    decorations: {
      cornerRadius: 6,
      cellGap: 6,
      headerStyle: 'ribbon',
      motif: 'flowers',
      frame: 'corner-motif',
    },
    logoSlot: true,
  },

  // ── シンプル5 ──
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
  {
    id: 'simple-line',
    name: 'シンプル・ライン',
    category: 'simple',
    size: SIZE_45,
    palette: {
      bg: '#FFFFFF',
      headerText: '#202830',
      dayLabel: '#8A94A0',
      castName: '#303A46',
      timeText: '#78828E',
      accent: '#1F7A68',
      cellBg: '#FFFFFF',
      cellBorder: '#E2E6EA',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'week-rows',
    decorations: { cornerRadius: 4, cellGap: 8, headerStyle: 'underline', motif: 'none' },
    logoSlot: true,
  },
  {
    id: 'simple-dark',
    name: 'シンプル・ダーク',
    category: 'simple',
    size: SIZE_45,
    palette: {
      bg: '#1C1F24',
      headerText: '#E8EBF0',
      dayLabel: '#8A929E',
      castName: '#DDE2E8',
      timeText: '#A6AEBA',
      accent: '#5B8DEF',
      cellBg: 'rgba(255,255,255,0.05)',
      cellBorder: 'rgba(255,255,255,0.14)',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 8, cellGap: 6, headerStyle: 'plain', motif: 'none', frame: 'double' },
    logoSlot: true,
  },

  // ── ネオン4 ──
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
  {
    id: 'neon-violet',
    name: 'ネオン・バイオレット',
    category: 'neon',
    size: SIZE_45,
    palette: {
      bg: '#0C0716',
      bgGradient: ['#150C26', '#07040E'],
      headerText: '#C9A2FF',
      dayLabel: '#8A7FAF',
      castName: '#EFE6FF',
      timeText: '#B2A6D8',
      accent: '#8B48E8',
      cellBg: 'rgba(139,72,232,0.07)',
      cellBorder: 'rgba(139,72,232,0.4)',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'month-grid',
    decorations: {
      cornerRadius: 10,
      cellGap: 6,
      headerStyle: 'banner',
      motif: 'lightning',
      frame: 'dashed',
    },
    logoSlot: true,
  },
  {
    id: 'neon-sunset',
    name: 'ネオン・サンセット',
    category: 'neon',
    size: SIZE_45,
    palette: {
      bg: '#140A0E',
      bgGradient: ['#1E0D12', '#0C0508'],
      headerText: '#FF8A3D',
      dayLabel: '#A98A80',
      castName: '#FFE9DC',
      timeText: '#D6AC9C',
      accent: '#FF4F87',
      cellBg: 'rgba(255,138,61,0.06)',
      cellBorder: 'rgba(255,79,135,0.35)',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'week-rows',
    decorations: {
      cornerRadius: 10,
      cellGap: 8,
      headerStyle: 'plain',
      motif: 'stars',
      frame: 'corner-motif',
    },
    logoSlot: true,
  },

  // ── パステル5 ──
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
  {
    id: 'pastel-sky',
    name: 'パステル・スカイ',
    category: 'pastel',
    size: SIZE_45,
    palette: {
      bg: '#F0F7FF',
      bgGradient: ['#EEF6FF', '#F6F1FF'],
      headerText: '#4A82C4',
      dayLabel: '#90A6C0',
      castName: '#3E566E',
      timeText: '#7690AC',
      accent: '#85B4E8',
      cellBg: '#FFFFFF',
      cellBorder: '#D6E6F7',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 16, cellGap: 8, headerStyle: 'banner', motif: 'none', frame: 'lace' },
    logoSlot: true,
  },
  {
    id: 'pastel-lemon',
    name: 'パステル・レモン',
    category: 'pastel',
    size: SIZE_45,
    palette: {
      bg: '#FDFBEC',
      headerText: '#C29A18',
      dayLabel: '#ABA377',
      castName: '#5E5730',
      timeText: '#948C60',
      accent: '#E8C93E',
      cellBg: '#FFFFFF',
      cellBorder: '#EFE7BD',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'week-rows',
    decorations: {
      cornerRadius: 14,
      cellGap: 8,
      headerStyle: 'underline',
      motif: 'flowers',
      frame: 'dashed',
    },
    logoSlot: true,
  },

  // ── シーズナル4 ──
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
  {
    id: 'seasonal-natsumatsuri',
    name: 'シーズナル・夏祭り',
    category: 'seasonal',
    size: SIZE_45,
    palette: {
      bg: '#131A3E',
      bgGradient: ['#182050', '#0C102A'],
      headerText: '#FFD166',
      dayLabel: '#8C93B8',
      castName: '#EEF1FF',
      timeText: '#ACB4D8',
      accent: '#E85A71',
      cellBg: 'rgba(255,255,255,0.06)',
      cellBorder: 'rgba(255,209,102,0.3)',
    },
    fonts: { header: 'serif-jp', body: 'sans-jp' },
    layout: 'month-grid',
    decorations: {
      cornerRadius: 8,
      cellGap: 6,
      headerStyle: 'banner',
      motif: 'stars',
      frame: 'corner-motif',
    },
    logoSlot: true,
  },
  {
    id: 'seasonal-yukige',
    name: 'シーズナル・雪華',
    category: 'seasonal',
    size: SIZE_45,
    palette: {
      bg: '#F4F8FB',
      bgGradient: ['#F6FAFD', '#EAF1F8'],
      headerText: '#4A7296',
      dayLabel: '#92A6B8',
      castName: '#3C5468',
      timeText: '#7A92A6',
      accent: '#7FA8CC',
      cellBg: '#FFFFFF',
      cellBorder: '#D9E6F0',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 12, cellGap: 6, headerStyle: 'plain', motif: 'snow', frame: 'lace' },
    logoSlot: true,
  },

  // ── リボン3（Rev76新設カテゴリ） ──
  {
    id: 'ribbon-sweet',
    name: 'リボン・スイート',
    category: 'ribbon',
    size: SIZE_45,
    palette: {
      bg: '#FFF2F7',
      bgGradient: ['#FFF0F6', '#FFE8F0'],
      headerText: '#E5518D',
      dayLabel: '#B98CA2',
      castName: '#6E4258',
      timeText: '#A5798F',
      accent: '#FF7FB2',
      cellBg: '#FFFFFF',
      cellBorder: '#FFD1E4',
    },
    fonts: { header: 'rounded-jp', body: 'rounded-jp' },
    layout: 'month-grid',
    decorations: { cornerRadius: 18, cellGap: 8, headerStyle: 'banner', motif: 'ribbon' },
    logoSlot: true,
  },
  {
    id: 'ribbon-marine',
    name: 'リボン・マリン',
    category: 'ribbon',
    size: SIZE_45,
    palette: {
      bg: '#F4F8FD',
      headerText: '#1F4E8C',
      dayLabel: '#7C93B5',
      castName: '#2C4058',
      timeText: '#66809F',
      accent: '#D6455D',
      cellBg: '#FFFFFF',
      cellBorder: '#CFE0F2',
    },
    fonts: { header: 'sans-jp', body: 'sans-jp' },
    layout: 'week-rows',
    decorations: {
      cornerRadius: 8,
      cellGap: 8,
      headerStyle: 'banner',
      motif: 'ribbon',
      frame: 'double',
    },
    logoSlot: true,
  },
  {
    id: 'ribbon-antique',
    name: 'リボン・アンティーク',
    category: 'ribbon',
    size: SIZE_45,
    palette: {
      bg: '#F8F3EA',
      bgGradient: ['#FAF5EC', '#F1E7D8'],
      headerText: '#7A5A38',
      dayLabel: '#A6937C',
      castName: '#55412C',
      timeText: '#8F7C64',
      accent: '#B0805A',
      cellBg: '#FFFFFF',
      cellBorder: '#E5D8C2',
    },
    fonts: { header: 'serif-jp', body: 'serif-jp' },
    layout: 'month-grid',
    decorations: {
      cornerRadius: 12,
      cellGap: 6,
      headerStyle: 'ribbon',
      motif: 'ribbon',
      frame: 'lace',
    },
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
  ribbon: 'リボン',
  ai: 'AIデザイン',
};

export function findTemplate(id: string): ShiftTemplateDefinition | undefined {
  return SHIFT_TEMPLATES.find((t) => t.id === id);
}
