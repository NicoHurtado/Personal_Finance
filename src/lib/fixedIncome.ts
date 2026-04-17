/**
 * Calculates the current balance of a fixed income account
 * by compounding each deposit individually from its date,
 * and subtracting withdrawals directly (no compounding).
 */
export function computeFixedIncomeBalance(
  transactions: { amount: number; type: string; metadata: any; date: Date | string }[],
  annualRate: number
): number {
  const dailyRate = Math.pow(1 + annualRate / 100, 1 / 365) - 1;
  const now = new Date();
  let total = 0;
  for (const t of transactions) {
    const isWithdrawal = t.type === "Expense" || t.type === "Withdrawal";
    const amountDeposited = Math.abs(t.metadata?.amountDeposited ?? t.amount);
    if (isWithdrawal) {
      total -= amountDeposited;
    } else {
      const depositDate = new Date(t.date);
      const days = Math.max(0, Math.floor((now.getTime() - depositDate.getTime()) / 86400000));
      total += amountDeposited * Math.pow(1 + dailyRate, days);
    }
  }
  return total;
}
