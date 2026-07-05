// web/src/admin/csv.ts — 税金関連CSVの生成・ダウンロード（SPEC §23・Web版）
//
// 列仕様・エスケープ・BOM・CRLF はアプリ側 src/utils/csv.ts と同一（§24）。
// アプリはシェアシートで渡すが、Web は Blob + <a download> でブラウザダウンロードする点だけが違う。

/** セルを CSV エスケープ（" 囲み・内部の " は "" へ）。 */
function escapeCell(cell: string): string {
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/** UTF-8 BOM（U+FEFF）。ソース中の不可視文字を避けるためコードポイント指定で生成。 */
const BOM = String.fromCharCode(0xfeff);

/** 2次元配列 → BOM付きCSV文字列（CRLF・Excel互換）。 */
export function toCsv(rows: string[][]): string {
  const body = rows.map((r) => r.map(escapeCell).join(',')).join('\r\n');
  return BOM + body + '\r\n';
}

/** CSV をブラウザにダウンロードさせる。 */
export function downloadCsv(filename: string, rows: string[][]): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
