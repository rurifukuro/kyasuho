// src/domain/payroll/resolveBackEach.ts — §39 キャストバック解決（純関数）
//
// RPC ky_close_order のSQL (0035_ky_menu_back_overhaul.sql) と同一仕様の写し。
// 用途: プレビュー・事前計算・テスト用（§50-3 D-4: SQLが正・ここは写し）。
// 数式を変えるRevは SQL＋domain＋SPEC表の3点を必ず同時更新すること。
// ★正準（§50-3 D-3）。

/**
 * 明細1行のバック額を解決する（3階層優先度）。
 *
 * 優先順位:
 *   1. メニューに固定額(backAmount)が設定されている → その額
 *   2. メニューに割合%(backRate)が設定されている → floor(price * backRate / 100)
 *   3. nomination以外 かつ defaultBackRate > 0 → floor(price * defaultBackRate / 100)
 *   4. 上記いずれにも該当しない → null（バックなし）
 *
 * @param item - { price, category, backAmount, backRate } メニュー項目の情報
 * @param defaultBackRate - テナントの基本バック割合（%、0〜100）
 * @returns バック額（円）or null
 */
export function resolveBackEach(
  item: {
    price: number;
    category: string;
    backAmount: number | null;
    backRate: number | null;
  },
  defaultBackRate: number,
): number | null {
  if (item.backAmount != null) return item.backAmount;
  if (item.backRate != null) return Math.floor(item.price * item.backRate / 100);
  if (item.category !== 'nomination' && defaultBackRate > 0) {
    return Math.floor(item.price * defaultBackRate / 100);
  }
  return null;
}
