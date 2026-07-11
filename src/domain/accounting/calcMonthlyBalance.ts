// src/domain/accounting/calcMonthlyBalance.ts — §27 月次収支計算（純関数）
//
// I/O非依存。AdminExpenses等が保持する月次集計値を受け取り、損益を計算する。
// ★正準（§50-3 D-3）。

export type MonthlyBalanceInput = {
  salesTotal: number;
  expenseTotal: number;
  payrollTotal: number;
};

export type MonthlyBalance = {
  salesTotal: number;
  expenseTotal: number;
  payrollTotal: number;
  netIncome: number;
};

/**
 * 月次収支を計算する。
 *
 *   netIncome = salesTotal − expenseTotal − payrollTotal
 *
 * 全金額は円単位の整数。
 */
export function calcMonthlyBalance(input: MonthlyBalanceInput): MonthlyBalance {
  return {
    salesTotal: input.salesTotal,
    expenseTotal: input.expenseTotal,
    payrollTotal: input.payrollTotal,
    netIncome: input.salesTotal - input.expenseTotal - input.payrollTotal,
  };
}

/**
 * 年次サマリ用：月別の MonthlyBalance 配列から年合計を計算する。
 */
export function calcAnnualBalance(months: MonthlyBalance[]): MonthlyBalance {
  let salesTotal = 0;
  let expenseTotal = 0;
  let payrollTotal = 0;
  for (const m of months) {
    salesTotal += m.salesTotal;
    expenseTotal += m.expenseTotal;
    payrollTotal += m.payrollTotal;
  }
  return {
    salesTotal,
    expenseTotal,
    payrollTotal,
    netIncome: salesTotal - expenseTotal - payrollTotal,
  };
}
