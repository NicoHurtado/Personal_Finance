/**
 * Shared fixed-income balance calculation using compound interest.
 *
 * Requires config from the accounts DB (anchorBalance, anchorGrowth,
 * annualRate, anchorDate). Returns { balance: 0, growth: 0 } if config
 * is missing required fields.
 */

export interface CajitaConfig {
  annualRate: number;
  anchorBalance: number;
  anchorGrowth: number;
  anchorDate: string | Date;
}

export function computeCajitaBalance(config?: Partial<CajitaConfig>): {
  balance: number;
  growth: number;
} {
  if (
    !config?.annualRate ||
    !config?.anchorBalance ||
    config?.anchorGrowth === undefined ||
    !config?.anchorDate
  ) {
    return { balance: 0, growth: 0 };
  }

  const dailyRate = Math.pow(1 + config.annualRate / 100, 1 / 365) - 1;
  const now = new Date();
  const anchor = new Date(config.anchorDate);
  anchor.setHours(0, 0, 0, 0);
  const daysDiff = Math.floor(
    (now.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24)
  );
  const balance = config.anchorBalance * Math.pow(1 + dailyRate, daysDiff);
  const growth = config.anchorGrowth + (balance - config.anchorBalance);
  return { balance, growth };
}
