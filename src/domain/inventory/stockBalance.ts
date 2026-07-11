export type MoveInput = {
  kind: string;
  qty: number;
};

export function sumStockBalance(moves: MoveInput[]): number {
  return moves.reduce((sum, m) => sum + m.qty, 0);
}

export function isAlertTriggered(
  stockQty: number,
  alertThreshold: number | null,
): boolean {
  if (alertThreshold === null) return false;
  return stockQty <= alertThreshold;
}
