// src/i18n/index.ts — 多言語翻訳の単一の真実源（とれはんっ！ i18n エンジンを流用）
//
// 翻訳文字列は src/i18n/strings.json に集約する。文言の追加・修正は strings.json で行う。
// MVP は日本語（ja）のみ。将来 en / zh / ko（訪日客のコンカフェ需要）を各エントリに足せば拡張できる。
// ハードコード日本語は禁止（ルールI18N-2）＝画面は必ず t('xxx') 経由で文言を取る。

import core from './strings.json';

// ── 言語コード（MVP は ja のみ。拡張時は 'ja' | 'en' | ... に広げる） ──
export type Language = 'ja';

// 全 JSON をマージした単一テーブル（画面追加で JSON を分けたらここに import を足す）
const STRINGS = { ...core };

// 全画面分のキー集合（tsc が未定義キー参照を検知する）
export type TKey = keyof typeof STRINGS;

type StringEntry = Record<Language, string>;
const TABLE = STRINGS as Record<string, StringEntry>;

// ── 言語オプション（設定画面で使用） ────────────────────────────────
export const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: 'ja', label: '🇯🇵 日本語' },
];

// ── 翻訳取得（ja フォールバック＋{name} パラメータ補間） ──────────────
export function translate(
  language: Language,
  key: TKey,
  params?: Record<string, string | number>
): string {
  const entry = TABLE[key as string];
  let s: string;
  if (!entry) {
    s = key as string; // 未定義キーはキー名をそのまま返す（フェイルセーフ）
  } else {
    s = entry[language] ?? entry.ja ?? (key as string);
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split('{' + k + '}').join(String(v));
    }
  }
  return s;
}
