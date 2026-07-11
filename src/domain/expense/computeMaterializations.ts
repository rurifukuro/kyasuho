// src/domain/expense/computeMaterializations.ts — §42 定期固定経費の実体化計算（純関数）
//
// I/O非依存。services層がDBから取得したデータを渡し、生成すべき行を受け取る。
// ★正準（§50-3 D-3）。web/src/domain/expense/ へのコピーは現時点不要（Web側は adminApi 経由）。

export type RecurringTemplate = {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  amount: number;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  isActive: boolean;
};

export type MaterializedRow = {
  tenantId: string;
  date: string;
  category: string;
  amount: number;
  memo: string;
  sourceRecurringId: string;
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function enumMonths(startYm: string, endYm: string): string[] {
  const result: string[] = [];
  const [sy, sm] = startYm.split('-').map(Number);
  const [ey, em] = endYm.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${pad2(m)}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

/**
 * 定期固定経費テンプレートから、まだ生成されていない月の経費行を計算する（冪等）。
 *
 * @param templates - 全テンプレート（is_active=true のみ渡すこと）
 * @param existingKeys - 既に実体化済みの `"recurringId:YYYY-MM"` のSet
 * @param skipKeys - スキップ済みの `"recurringId:YYYY-MM"` のSet
 * @param upToYm - 生成上限月（YYYY-MM）。この月以前のみ生成、未来月は生成しない
 * @returns 生成すべき経費行の配列
 */
export function computeMaterializations(
  templates: RecurringTemplate[],
  existingKeys: Set<string>,
  skipKeys: Set<string>,
  upToYm: string,
): MaterializedRow[] {
  const rows: MaterializedRow[] = [];

  for (const t of templates) {
    const startYm = t.startMonth.substring(0, 7);
    const templateEndYm = t.endMonth ? t.endMonth.substring(0, 7) : upToYm;
    const effectiveEnd = templateEndYm <= upToYm ? templateEndYm : upToYm;

    for (const ym of enumMonths(startYm, effectiveEnd)) {
      const key = `${t.id}:${ym}`;
      if (existingKeys.has(key) || skipKeys.has(key)) continue;

      const [yy, mm] = ym.split('-').map(Number);
      const lastDay = new Date(yy, mm, 0).getDate();
      const day = Math.min(t.dayOfMonth, lastDay);
      const dateStr = `${ym}-${pad2(day)}`;

      rows.push({
        tenantId: t.tenantId,
        date: dateStr,
        category: t.category,
        amount: t.amount,
        memo: t.name,
        sourceRecurringId: t.id,
      });
    }
  }

  return rows;
}
