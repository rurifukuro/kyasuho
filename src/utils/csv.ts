// src/utils/csv.ts — 税金関連CSVの生成・共有（SPEC §23）
//
// 列仕様は §23（売上/給与/勤怠の3種・汎用形式）。**UTF-8 BOM付き**＝Excelで開いた時の
// 文字化け回避。アプリ側は expo-file-system で一時ファイルに書き、シェアシートで渡す。
// 税務助言はしない＝このアプリは記録・集計・出力のみ（§23）。

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** セルを CSV エスケープ（" 囲み＋式インジェクション無害化・SEC-11）。 */
function escapeCell(cell: string): string {
  let s = cell;
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** UTF-8 BOM（U+FEFF）。ソース中の不可視文字を避けるためコードポイント指定で生成。 */
const BOM = String.fromCharCode(0xfeff);

/** 2次元配列 → BOM付きCSV文字列（CRLF・Excel互換）。 */
export function toCsv(rows: string[][]): string {
  const body = rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
  return BOM + body + '\r\n';
}

/**
 * CSVを一時ファイルへ書き出しシェアシートで共有する。
 * 共有UIが使えない環境（一部エミュレータ等）は false を返す＝呼び出し側で案内を出す。
 */
export async function shareCsv(filename: string, rows: string[][]): Promise<boolean> {
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create({ intermediates: true });
  file.write(toCsv(rows));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: filename,
    UTI: 'public.comma-separated-values-text',
  });
  return true;
}
