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

export type OrderItemForSale = {
  menuItemId: string | null;
  qty: number;
};

export type InventoryLink = {
  itemId: string;
  menuItemId: string;
};

export type SaleMove = {
  itemId: string;
  qty: number;
};

export function buildSaleMoves(
  orderItems: OrderItemForSale[],
  links: InventoryLink[],
): SaleMove[] {
  const menuToItem = new Map(links.map((l) => [l.menuItemId, l.itemId]));
  const merged = new Map<string, number>();
  for (const oi of orderItems) {
    if (!oi.menuItemId) continue;
    const itemId = menuToItem.get(oi.menuItemId);
    if (!itemId) continue;
    merged.set(itemId, (merged.get(itemId) ?? 0) + oi.qty);
  }
  return Array.from(merged.entries()).map(([itemId, qty]) => ({
    itemId,
    qty: -qty,
  }));
}
