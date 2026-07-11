// src/domain/point/earnRedeem.ts — §41 ポイント付与・景品交換の計算（純関数）
//
// I/O非依存。会計連動の自動付与（§45 お客様モード統合時に有効化）の計算部分。
// ★正準（§50-3 D-3）。

/**
 * 会計金額からポイント付与数を計算する（切り捨て）。
 *
 * @param netAmount - 税込会計金額（円）
 * @param yenPerPoint - 何円で1ポイント（例: 500 = 500円で1pt）
 * @returns 付与ポイント数（0以上の整数）
 */
export function calcEarnPoints(netAmount: number, yenPerPoint: number): number {
  if (yenPerPoint <= 0 || netAmount <= 0) return 0;
  return Math.floor(netAmount / yenPerPoint);
}

/**
 * 景品交換が可能かどうかを判定する。
 *
 * @param balance - 現在のポイント残高
 * @param pointsRequired - 景品に必要なポイント数
 * @returns true = 交換可能
 */
export function canRedeem(balance: number, pointsRequired: number): boolean {
  return balance >= pointsRequired && pointsRequired > 0;
}
