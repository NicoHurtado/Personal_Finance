"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import { AccountCard } from "@/components/CardVisuals";
import { CardSkeleton, TableSkeleton, ChartSkeleton, Skeleton } from "@/components/Skeleton";
import { formatCOP, formatUSD, formatDate } from "@/lib/format";
import { computeCajitaBalance, type CajitaConfig } from "@/lib/cajita";
import { useT } from "@/hooks/useT";
import { useLangStore } from "@/store/langStore";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
  Area,
  Bar,
  Line,
} from "recharts";

/* ---------- Types ---------- */

interface Account {
  _id: string;
  slug: string;
  name: string;
  type: string;
  currency: string;
  color: string;
  config?: Partial<CajitaConfig> & Record<string, unknown>;
  sortOrder: number;
  balance: number;
  transactionCount: number;
}

interface Transaction {
  _id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: string;
}

interface Holding {
  _id: string;
  ticker: string;
  companyName: string;
  shares: number;
  costBasisPerShare: number;
}

interface StockQuote {
  ticker: string;
  price: number | null;
}

type CashFlowMap = Record<string, Record<string, { income: number; expenses: number }>>;

interface DailyTx { description: string; amount: number; type: string }
interface DailyEntry {
  accounts: Record<string, { income: number; expenses: number }>;
  transactions: DailyTx[];
}
type DailyCashFlowMap = Record<string, Record<number, DailyEntry>>;

interface SummaryResponse {
  accounts: Account[];
  recentActivity: Transaction[];
  cashFlow: CashFlowMap;
  dailyCashFlow: DailyCashFlowMap;
  holdings: Holding[];
  stockQuotes: StockQuote[];
  trm: number;
}

/* ---------- Helpers ---------- */

function formatCompact(v: number): string {
  if (!isFinite(v)) return "$0";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/* ---------- Component ---------- */

export default function DashboardPage() {
  const t = useT();
  const { lang } = useLangStore();
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<"month" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(ymKey(new Date()));
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentActivityRaw, setRecentActivityRaw] = useState<Transaction[]>([]);
  const [serverCashFlow, setServerCashFlow] = useState<CashFlowMap>({});
  const [serverDailyCashFlow, setServerDailyCashFlow] = useState<DailyCashFlowMap>({});
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [stockPrices, setStockPrices] = useState<StockQuote[]>([]);
  const [trm, setTrm] = useState<number>(0);

  useEffect(() => {
    fetch("/api/v2/transactions/summary")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return r.json();
      })
      .then((data: SummaryResponse | null) => {
        if (!data) return;
        setAccounts(data.accounts);
        setRecentActivityRaw(data.recentActivity);
        setServerCashFlow(data.cashFlow);
        setServerDailyCashFlow(data.dailyCashFlow || {});
        setHoldings(data.holdings);
        setStockPrices(data.stockQuotes);
        setTrm(data.trm);
      })
      .catch((err) => console.error("Dashboard load error:", err))
      .finally(() => setLoading(false));
  }, []);

  /* ---------- Account lookups ---------- */

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a._id, a));
    return map;
  }, [accounts]);

  const accountBySlug = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.slug, a));
    return map;
  }, [accounts]);

  /* ---------- Derived balances ---------- */

  const debitAccounts = useMemo(() => accounts.filter((a) => a.type === "debit"), [accounts]);
  const creditAccounts = useMemo(() => accounts.filter((a) => a.type === "credit_card"), [accounts]);
  const fixedIncomeAccounts = useMemo(() => accounts.filter((a) => a.type === "fixed_income"), [accounts]);
  const brokerageAccount = useMemo(() => accounts.find((a) => a.type === "brokerage"), [accounts]);

  const liquidityCOP = useMemo(() => {
    return debitAccounts.reduce((sum, a) => {
      const bal = a.balance;
      return sum + (a.currency === "USD" ? bal * trm : bal);
    }, 0);
  }, [debitAccounts, trm]);

  const liquidityUSD = useMemo(() => {
    return debitAccounts.filter((a) => a.currency === "USD").reduce((sum, a) => sum + a.balance, 0);
  }, [debitAccounts]);

  const fixedIncomeCOP = useMemo(() => {
    return fixedIncomeAccounts.reduce((sum, a) => sum + a.balance, 0);
  }, [fixedIncomeAccounts]);

  const fixedIncomeGrowth = useMemo(() => {
    let totalGrowth = 0;
    for (const a of fixedIncomeAccounts) {
      if (a.config?.anchorBalance) {
        const { growth } = computeCajitaBalance(a.config as Partial<CajitaConfig>);
        totalGrowth += growth;
      }
    }
    return totalGrowth;
  }, [fixedIncomeAccounts]);

  const hapiUSD = useMemo(() => {
    if (holdings.length === 0) return 0;
    // If any quote has a real price, use live prices; otherwise use cost basis
    const hasLivePrices = stockPrices.some((q) => q.price !== null);
    return holdings.reduce((sum, inv) => {
      const quote = stockPrices.find((q) => q.ticker === inv.ticker);
      const price = hasLivePrices ? (quote?.price ?? inv.costBasisPerShare) : inv.costBasisPerShare;
      return sum + inv.shares * price;
    }, 0);
  }, [holdings, stockPrices]);

  const hapiCOP = hapiUSD * (trm || 0);
  const totalDebt = creditAccounts.reduce((sum, a) => sum + a.balance, 0);
  const debtAbs = Math.abs(totalDebt);
  const netCapital = (liquidityCOP || 0) + (fixedIncomeCOP || 0) + (hapiCOP || 0) + (totalDebt || 0);

  /* ---------- Cash Flow from server data ---------- */

  const availableMonths = useMemo(() => {
    const months = Object.keys(serverCashFlow).sort();
    if (months.length === 0) return [ymKey(new Date())];
    return months.reverse();
  }, [serverCashFlow]);

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    availableMonths.forEach((m) => ys.add(Number(m.split("-")[0])));
    return Array.from(ys).sort((a, b) => b - a);
  }, [availableMonths]);

  const cashFlow = useMemo(() => {
    const usdAccountIds = new Set<string>();
    accounts.forEach((a) => { if (a.currency === "USD") usdAccountIds.add(a._id); });

    const safeTrm = trm || 0;

    const getMonthExpenses = (ym: string): number => {
      const monthData = serverCashFlow[ym];
      if (!monthData) return 0;
      let total = 0;
      for (const [accId, vals] of Object.entries(monthData)) {
        const multiplier = usdAccountIds.has(accId) ? safeTrm : 1;
        total += vals.expenses * multiplier;
      }
      return total;
    };

    const getMonthIncome = (ym: string): number => {
      const monthData = serverCashFlow[ym];
      if (!monthData) return 0;
      let total = 0;
      for (const [accId, vals] of Object.entries(monthData)) {
        const multiplier = usdAccountIds.has(accId) ? safeTrm : 1;
        total += vals.income * multiplier;
      }
      return total;
    };

    const getDayExpenses = (ym: string, day: number): number => {
      const dayData = serverDailyCashFlow[ym]?.[day];
      if (!dayData) return 0;
      let total = 0;
      for (const [accId, vals] of Object.entries(dayData.accounts)) {
        const multiplier = usdAccountIds.has(accId) ? safeTrm : 1;
        total += vals.expenses * multiplier;
      }
      return total;
    };

    const getDayIncome = (ym: string, day: number): number => {
      const dayData = serverDailyCashFlow[ym]?.[day];
      if (!dayData) return 0;
      let total = 0;
      for (const [accId, vals] of Object.entries(dayData.accounts)) {
        const multiplier = usdAccountIds.has(accId) ? safeTrm : 1;
        total += vals.income * multiplier;
      }
      return total;
    };

    const getDayTransactions = (ym: string, day: number): DailyTx[] => {
      return serverDailyCashFlow[ym]?.[day]?.transactions || [];
    };

    const currentCapital = netCapital || 0;

    const getMonthNetFlow = (ym: string): number => {
      return getMonthIncome(ym) - getMonthExpenses(ym);
    };

    const allMonths = Object.keys(serverCashFlow).sort();

    const getCapitalAtEndOfMonth = (upToYm: string): number => {
      let futureFlow = 0;
      for (let i = allMonths.length - 1; i >= 0; i--) {
        const ym = allMonths[i];
        if (ym <= upToYm) break;
        futureFlow += getMonthNetFlow(ym);
      }
      return currentCapital - futureFlow;
    };

    let data: { label: string; capital: number; expense: number; expenseBar: number; transactions?: DailyTx[] }[] = [];
    let selectedPeriodExpense = 0;

    if (chartView === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const prevYm = m === 1
        ? `${y - 1}-12`
        : `${y}-${String(m - 1).padStart(2, "0")}`;
      const baseCapital = getCapitalAtEndOfMonth(prevYm);

      const now = new Date();
      const daysInMonth = new Date(y, m, 0).getDate();
      const lastDay = (now.getFullYear() === y && now.getMonth() === m - 1)
        ? now.getDate()
        : daysInMonth;

      let cumExp = 0;
      let cumNetFlow = 0;
      for (let day = 1; day <= lastDay; day++) {
        const dayExp = getDayExpenses(selectedMonth, day);
        const dayInc = getDayIncome(selectedMonth, day);
        cumExp += dayExp;
        cumNetFlow += (dayInc - dayExp);
        data.push({
          label: String(day),
          capital: baseCapital + cumNetFlow,
          expense: cumExp,
          expenseBar: dayExp,
          transactions: getDayTransactions(selectedMonth, day),
        });
      }

      selectedPeriodExpense = cumExp;
    } else {
      for (let mo = 1; mo <= 12; mo++) {
        const ym = `${selectedYear}-${String(mo).padStart(2, "0")}`;
        const capital = getCapitalAtEndOfMonth(ym);
        const expense = getMonthExpenses(ym);
        data.push({
          label: new Date(selectedYear, mo - 1, 1).toLocaleDateString("en-US", { month: "short" }),
          capital,
          expense,
          expenseBar: expense,
        });
      }
      const now = new Date();
      if (now.getFullYear() === selectedYear) {
        selectedPeriodExpense = data[now.getMonth()]?.expense ?? 0;
      } else {
        selectedPeriodExpense = data.reduce((s, d) => s + d.expense, 0);
      }
    }

    return { data, selectedPeriodExpense };
  }, [serverCashFlow, serverDailyCashFlow, accounts, trm, netCapital, chartView, selectedMonth, selectedYear]);

  /* ---------- Wallet cards ---------- */

  const walletCards = useMemo(() => {
    return accounts
      .filter((a) => a.type === "credit_card" || a.type === "debit")
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [accounts]);

  /* ---------- Recent Activity ---------- */

  const recentActivity = useMemo(() => {
    return recentActivityRaw.map((t) => {
      const account = accountById.get(t.accountId);
      const isUsd = account?.currency === "USD";
      return {
        date: t.date,
        product: account?.name ?? "Unknown",
        description: t.description,
        amount: t.amount,
        type: t.type,
        isUsd,
      };
    });
  }, [recentActivityRaw, accountById]);

  /* ---------- Loading ---------- */

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40 mb-1" />
        <Skeleton className="h-4 w-64" />
        <CardSkeleton />
        <ChartSkeleton />
        <div className="grid grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  /* ---------- Render ---------- */

  const today = new Date();
  const dateStr = today.toLocaleDateString(lang === "es" ? "es-CO" : "en-US", { weekday: "long", month: "long", day: "numeric" });
  const greetingHour = today.getHours();
  const greetingMap = lang === "es"
    ? { morning: "Buenos días", afternoon: "Buenas tardes", evening: "Buenas noches" }
    : { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" };
  const greeting = greetingHour < 12 ? greetingMap.morning : greetingHour < 19 ? greetingMap.afternoon : greetingMap.evening;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[13px] text-[var(--c-text-3)]">{dateStr}</p>
          <h1 className="text-heading text-[var(--c-text)] mt-1">{greeting}</h1>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-card border border-[var(--c-border)] rounded-lg text-[12px] text-[var(--c-text-2)]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            Last 30 days
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-card border border-[var(--c-border)] rounded-lg text-[12px] text-[var(--c-text-2)]">
            TRM <span className="font-medium text-[var(--c-text)] tabular-nums">{formatCOP(trm)}</span>
          </div>
        </div>
      </div>

      {/* Hero: Total Balance */}
      <section className="rounded-2xl bg-[var(--c-brand)] text-white p-7 md:p-9 relative overflow-hidden">
        <div aria-hidden className="absolute -top-24 -right-20 w-[340px] h-[340px] rounded-full opacity-[0.18]" style={{ background: "radial-gradient(closest-side, var(--c-grad2), transparent)" }} />
        <div aria-hidden className="absolute -bottom-32 -left-10 w-[280px] h-[280px] rounded-full opacity-[0.10]" style={{ background: "radial-gradient(closest-side, var(--c-grad1), transparent)" }} />

        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <p className="text-[12px] text-white/60 mb-2">{t.dashboard.totalCapital}</p>
            <p className="text-display tabular-nums">{formatCOP(netCapital)}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-2">
              {liquidityCOP !== 0 && (
                <div>
                  <p className="text-[11px] text-white/60">{t.nav.debit}</p>
                  <p className="text-[15px] font-medium tabular-nums text-white">{formatCOP(liquidityCOP)}</p>
                  {liquidityUSD !== 0 && <p className="text-[11px] text-white/60 tabular-nums">{formatUSD(liquidityUSD)} in USD</p>}
                </div>
              )}
              {fixedIncomeCOP !== 0 && (
                <div>
                  <p className="text-[11px] text-white/60">{t.nav.fixedIncome}</p>
                  <p className="text-[15px] font-medium tabular-nums text-white">{formatCOP(fixedIncomeCOP)}</p>
                </div>
              )}
              {hapiCOP !== 0 && (
                <div>
                  <p className="text-[11px] text-white/60">{t.nav.investments}</p>
                  <p className="text-[15px] font-medium tabular-nums text-white">{formatCOP(hapiCOP)}</p>
                  <p className="text-[11px] text-white/60 tabular-nums">{formatUSD(hapiUSD)}</p>
                </div>
              )}
              {debtAbs > 0 && (
                <div>
                  <p className="text-[11px] text-white/60">{t.dashboard.totalDebt}</p>
                  <p className="text-[15px] font-medium tabular-nums text-[var(--c-expense-text)]">{formatCOP(debtAbs)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/credit-cards" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/15 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
              {t.nav.cards}
            </Link>
            <Link href="/savings" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/15 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75l9-6 9 6M4.5 10.5v9.75a.75.75 0 00.75.75h3.75V15a1.5 1.5 0 013 0v6h3.75a.75.75 0 00.75-.75V10.5" /></svg>
              {t.nav.debit}
            </Link>
            <Link href="/fixed-income" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/15 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {t.nav.fixedIncome}
            </Link>
            <Link href="/stocks" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/15 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
              {t.nav.stocks}
            </Link>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" /></svg>}
          label={t.nav.debit}
          value={formatCOP(liquidityCOP)}
          secondary={liquidityUSD !== 0 ? `${formatUSD(liquidityUSD)} in USD` : undefined}
          period={t.savings.title}
        />
        <StatCard
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label={t.nav.fixedIncome}
          value={formatCOP(fixedIncomeCOP)}
          growthAmount={fixedIncomeGrowth}
          period={t.dashboard.hasGrown}
        />
        <StatCard
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
          label={t.dashboard.investments}
          value={formatCOP(hapiCOP)}
          secondary={formatUSD(hapiUSD)}
          period={t.nav.stocks}
        />
        <StatCard
          icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
          label={t.dashboard.totalDebt}
          value={formatCOP(debtAbs)}
          period={t.dashboard.creditCards}
          valueClassName="text-[var(--c-expense)]"
        />
      </section>

      {/* Cash Flow chart + side cards */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3" padding="lg">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="text-[13px] font-semibold text-[var(--c-text)] tracking-tight">{t.dashboard.cashFlow}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {chartView === "month" ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => { const idx = availableMonths.indexOf(selectedMonth); if (idx < availableMonths.length - 1) setSelectedMonth(availableMonths[idx + 1]); }} className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--c-text-4)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors disabled:opacity-30" disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1} aria-label="Previous month">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                  </button>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="text-[12px] font-medium text-[var(--c-text)] bg-transparent border-none outline-none cursor-pointer hover:text-[var(--c-brand)] transition-colors">
                    {availableMonths.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
                  </select>
                  <button onClick={() => { const idx = availableMonths.indexOf(selectedMonth); if (idx > 0) setSelectedMonth(availableMonths[idx - 1]); }} className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--c-text-4)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors disabled:opacity-30" disabled={availableMonths.indexOf(selectedMonth) <= 0} aria-label="Next month">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </button>
                </div>
              ) : (
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="text-[12px] font-medium text-[var(--c-text)] bg-transparent border-none outline-none cursor-pointer hover:text-[var(--c-brand)] transition-colors">
                  {availableYears.map((y) => (<option key={y} value={y}>{y}</option>))}
                </select>
              )}
              <div className="w-px h-3.5 bg-[var(--c-border)]" />
              <div className="flex items-center bg-[var(--c-surface-2)] rounded-lg p-0.5 gap-0.5">
                <button onClick={() => setChartView("month")} className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${chartView === "month" ? "bg-card text-[var(--c-text)] shadow-sm font-medium" : "text-[var(--c-text-4)] hover:text-[var(--c-text-2)]"}`}>{t.common.monthly}</button>
                <button onClick={() => setChartView("year")} className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${chartView === "year" ? "bg-card text-[var(--c-text)] shadow-sm font-medium" : "text-[var(--c-text-4)] hover:text-[var(--c-text-2)]"}`}>{t.common.yearly}</button>
              </div>
              <div className="w-px h-3.5 bg-[var(--c-border)]" />
              <div className="flex items-center gap-3">
                <span className="inline-flex text-[11px] text-[var(--c-text-4)] items-center gap-1.5"><span className="w-4 h-[2px] rounded-full bg-[var(--c-brand)]" /> {t.dashboard.capital}</span>
                <span className="inline-flex text-[11px] text-[var(--c-text-4)] items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--c-grad2)] opacity-80" /> {t.dashboard.expenses}</span>
              </div>
            </div>
          </div>
          {(() => {
            const maxExpense = Math.max(...cashFlow.data.map((d: any) => d.expenseBar ?? 0), 1);
            const expenseDomainMax = maxExpense * 4;
            return (
          <div className="h-[260px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashFlow.data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={chartView === "month" ? "30%" : "40%"}>
                <defs>
                  <linearGradient id="capitalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-brand)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="var(--c-brand)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseBarFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-grad2)" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="var(--c-grad2)" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--c-chart-grid)" strokeDasharray="0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--c-text-5)", fontWeight: 400 }} tickLine={false} axisLine={false} interval={chartView === "month" ? "preserveStartEnd" : 0} dy={6} />
                <YAxis yAxisId="capital" tick={{ fontSize: 10, fill: "var(--c-text-5)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCompact(v)} width={42} />
                <YAxis yAxisId="expense" orientation="right" domain={[0, expenseDomainMax]} tick={{ fontSize: 10, fill: "var(--c-text-5)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCompact(v)} width={42} />
                <Tooltip cursor={{ fill: "rgba(2,88,100,0.03)" }} content={<CashFlowTooltip chartView={chartView} />} />
                <Bar yAxisId="expense" dataKey="expenseBar" fill="url(#expenseBarFill)" radius={[4, 4, 0, 0]} name="expense" maxBarSize={28} />
                <Area yAxisId="capital" type="monotoneX" dataKey="capital" stroke="var(--c-brand)" strokeWidth={1.5} fill="url(#capitalFill)" name="capital" />
                <Line yAxisId="capital" type="monotoneX" dataKey="capital" stroke="var(--c-brand)" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: "var(--c-brand)", stroke: "var(--c-tooltip-bg)", strokeWidth: 2 }} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
            );
          })()}
        </Card>

        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card padding="md" className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--c-surface-4)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[var(--c-brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--c-text-4)] mb-0.5">{t.dashboard.capital}</p>
              <p className="text-[17px] font-semibold text-[var(--c-text)] tabular-nums truncate leading-tight">{formatCOP(netCapital)}</p>
              <p className="text-[10px] text-[var(--c-text-5)] mt-0.5">{t.dashboard.currentBalance}</p>
            </div>
          </Card>
          <Card padding="md" className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--c-income-bg)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[var(--c-income)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--c-text-4)] mb-0.5">{t.dashboard.expenses}</p>
              <p className="text-[17px] font-semibold text-[var(--c-text)] tabular-nums truncate leading-tight">{formatCOP(cashFlow.selectedPeriodExpense)}</p>
              <p className="text-[10px] text-[var(--c-text-5)] mt-0.5">{chartView === "month" ? monthLabel(selectedMonth) : `Year ${selectedYear}`}</p>
            </div>
          </Card>
        </div>
      </section>

      {/* Recent Activity + My Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--c-text-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM7.5 6.75h12M7.5 12h12M7.5 17.25h12" /></svg>
              <h2 className="text-title text-[var(--c-text)]">{t.dashboard.recentActivity}</h2>
            </div>
            <span className="text-[11px] text-[var(--c-text-3)]">{recentActivity.length}</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-[var(--c-text-3)] py-10 text-center">{t.dashboard.noRecentActivity}</p>
          ) : (
            <div className="divide-y divide-[var(--c-border-2)] max-h-[480px] overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
              {recentActivity.map((row, i) => (
                <div key={i} className="flex items-center gap-4 py-3.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${row.amount < 0 ? "bg-[var(--c-expense-bg2)] text-[var(--c-expense)]" : "bg-[var(--c-surface-5)] text-[var(--c-brand)]"}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {row.amount < 0 ? (<path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />) : (<path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />)}
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--c-text)] truncate">{row.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[var(--c-text-3)]">{formatDate(row.date)}</span>
                      <span className="w-1 h-1 rounded-full bg-[var(--c-sep)]" />
                      <span className="text-[11px] text-[var(--c-text-3)]">{row.product}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[13px] font-semibold tabular-nums ${row.amount < 0 ? "text-[var(--c-expense)]" : "text-[var(--c-text)]"}`}>
                      {row.amount > 0 ? "+" : ""}{row.isUsd ? formatUSD(row.amount) : formatCOP(row.amount)}
                    </p>
                    <p className="text-[10px] text-[var(--c-text-3)] mt-0.5">{row.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--c-text-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
              <h2 className="text-title text-[var(--c-text)]">My Cards</h2>
            </div>
          </div>

          {walletCards.length > 0 && (
            <div className="relative w-full mb-5" style={{ aspectRatio: `1.586 / ${1 + walletCards.length * 0.24}` }}>
              {walletCards.map((card, i) => {
                const href = card.type === "credit_card" ? `/credit-cards/${card.slug.replace(/-tc$/, "")}` : `/savings/${card.slug}`;
                return (
                  <Link key={card._id} href={href} aria-label={card.name} className="absolute inset-x-0 transition-transform duration-200 ease-out hover:-translate-y-1.5 hover:z-30" style={{ top: `${i * 14}%`, zIndex: walletCards.length - i }}>
                    <AccountCard color={card.color} colorGradientEnd={card.config?.colorGradientEnd as string | undefined} />
                  </Link>
                );
              })}
            </div>
          )}

          <div className="space-y-2 text-[12px] pt-2 border-t border-[var(--c-border-2)]">
            {walletCards.map((card) => {
              const isUsd = card.currency === "USD";
              const fmt = isUsd ? formatUSD : formatCOP;
              return (
                <div key={card._id} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[var(--c-text-2)]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} /> {card.name}
                  </span>
                  <span className={`tabular-nums font-medium ${card.balance < 0 ? "text-[var(--c-expense)]" : "text-[var(--c-text)]"}`}>{fmt(card.balance)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}

/* ---------- CashFlowTooltip ---------- */

function CashFlowTooltip({ active, payload, label, chartView }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const txs: DailyTx[] = row.transactions || [];
  const expenses = txs.filter((t) => t.type === "Expense");

  if (chartView === "month") {
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-[var(--c-border)] rounded-2xl shadow-xl shadow-black/5 px-4 py-3.5 max-w-[240px]">
        <p className="text-[11px] font-medium text-[var(--c-text-4)] mb-2.5 uppercase tracking-wider">Day {label}</p>
        <div className="flex items-center justify-between gap-4 mb-2.5 pb-2.5 border-b border-[var(--c-chart-grid)]">
          <span className="text-[11px] text-[var(--c-text-2)]">Capital</span>
          <span className="text-[12px] font-semibold text-[var(--c-brand)] tabular-nums">{formatCOP(row.capital)}</span>
        </div>
        {expenses.length > 0 ? (
          <div className="space-y-1">
            {expenses.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[var(--c-text-3)] truncate">{t.description}</span>
                <span className="text-[11px] font-medium text-[var(--c-expense)] tabular-nums whitespace-nowrap">{formatCOP(t.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--c-text-5)]">No expenses</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-[var(--c-border)] rounded-2xl shadow-xl shadow-black/5 px-4 py-3.5">
      <p className="text-[11px] font-medium text-[var(--c-text-4)] mb-2.5 uppercase tracking-wider">{label}</p>
      <div className="flex items-center justify-between gap-6 mb-1.5">
        <span className="text-[11px] text-[var(--c-text-2)]">Capital</span>
        <span className="text-[12px] font-semibold text-[var(--c-brand)] tabular-nums">{formatCOP(row.capital)}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-[11px] text-[var(--c-text-2)]">Expenses</span>
        <span className="text-[12px] font-semibold text-[var(--c-expense)] tabular-nums">{formatCOP(row.expenseBar)}</span>
      </div>
    </div>
  );
}

/* ---------- StatCard ---------- */

function StatCard({ icon, label, value, secondary, growthAmount, period, valueClassName = "text-[var(--c-text)]" }: {
  icon: React.ReactNode; label: string; value: string; secondary?: string; growthAmount?: number; period: string; valueClassName?: string;
}) {
  const hasGrowth = growthAmount !== undefined && isFinite(growthAmount) && growthAmount !== 0;
  return (
    <Card padding="md" hover>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[var(--c-text-2)]">
          <div className="w-7 h-7 rounded-lg bg-[var(--c-surface-2)] flex items-center justify-center">{icon}</div>
          <span className="text-[12px] font-medium text-[var(--c-text-2)]">{label}</span>
        </div>
        <span className="text-[10px] text-[var(--c-text-3)]">{period}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className={`text-[22px] font-semibold tabular-nums ${valueClassName}`}>{value}</p>
        {hasGrowth && (
          <span className={`text-[11px] font-medium tabular-nums ${growthAmount! > 0 ? "text-[var(--c-income)]" : "text-[var(--c-expense)]"}`}>
            {growthAmount! > 0 ? "+" : ""}{formatCOP(growthAmount!)}
          </span>
        )}
      </div>
      {secondary && <p className="text-[11px] text-[var(--c-text-3)] mt-1 tabular-nums">{secondary}</p>}
    </Card>
  );
}
