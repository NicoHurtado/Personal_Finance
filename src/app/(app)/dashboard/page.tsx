"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Card from "@/components/Card";
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

interface DailyNetPoint { _id: { year: number; month: number; day: number }; net: number }

interface SummaryResponse {
  accounts: Account[];
  recentActivity: Transaction[];
  cashFlow: CashFlowMap;
  dailyCashFlow: DailyCashFlowMap;
  allDailyNetFlow: DailyNetPoint[];
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

function monthLabel(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function ymCompare(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (ay !== by) return ay - by;
  return am - bm;
}

function addCalendarMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return ymKey(d);
}

/* ---------- Component ---------- */

export default function DashboardPage() {
  const t = useT();
  const { lang } = useLangStore();
  const monthLocale = lang === "es" ? "es-CO" : "en-US";
  const [loading, setLoading] = useState(true);
  /** Year first until the calendar month has cash-flow data (see init effect after summary load). */
  const [chartView, setChartView] = useState<"month" | "year">("year");
  const [selectedMonth, setSelectedMonth] = useState<string>(ymKey(new Date()));
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [chartPrefsReady, setChartPrefsReady] = useState(false);

  const [userName, setUserName] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentActivityRaw, setRecentActivityRaw] = useState<Transaction[]>([]);
  const [serverCashFlow, setServerCashFlow] = useState<CashFlowMap>({});
  const [serverDailyCashFlow, setServerDailyCashFlow] = useState<DailyCashFlowMap>({});
  const [allDailyNetFlow, setAllDailyNetFlow] = useState<DailyNetPoint[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [stockPrices, setStockPrices] = useState<StockQuote[]>([]);
  const [trm, setTrm] = useState<number>(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => { if (data.user?.name) setUserName(data.user.name.split(" ")[0]); })
      .catch(() => {});
  }, []);

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
        setAllDailyNetFlow(data.allDailyNetFlow || []);
        setHoldings(data.holdings);
        setStockPrices(data.stockQuotes);
        setTrm(data.trm);
      })
      .catch((err) => console.error("Dashboard load error:", err))
      .finally(() => setLoading(false));
  }, []);

  /* ---------- Cash-flow chart: default month/year from server data ---------- */

  useEffect(() => {
    if (loading || chartPrefsReady) return;
    const now = new Date();
    const currentYm = ymKey(now);
    const hasCurrentMonthData = Boolean(serverCashFlow[currentYm]);
    setSelectedMonth(currentYm);
    setSelectedYear(now.getFullYear());
    setChartView(hasCurrentMonthData ? "month" : "year");
    setChartPrefsReady(true);
  }, [loading, serverCashFlow, chartPrefsReady]);

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
  const brokerageAccounts = useMemo(() => accounts.filter((a) => a.type === "brokerage"), [accounts]);

  const liquidityCOP = useMemo(() => {
    return debitAccounts.reduce((sum, a) => {
      return sum + (a.currency === "USD" ? a.balance * (trm || 0) : a.balance);
    }, 0);
  }, [debitAccounts, trm]);

  const liquidityUSD = useMemo(() => {
    return debitAccounts.filter((a) => a.currency === "USD").reduce((sum, a) => sum + a.balance, 0);
  }, [debitAccounts]);

  const fixedIncomeCOP = useMemo(() => {
    return fixedIncomeAccounts.reduce((sum, a) => {
      return sum + (a.currency === "USD" ? a.balance * (trm || 0) : a.balance);
    }, 0);
  }, [fixedIncomeAccounts, trm]);

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

  // Dynamic: sums ALL account types so any new product is automatically included
  const netCapital = useMemo(() => {
    const safeTrm = trm || 0;
    const allAccountsSum = accounts
      .filter((a) => a.type !== "brokerage") // brokerage uses live prices via hapiCOP
      .reduce((sum, a) => sum + (a.currency === "USD" ? a.balance * safeTrm : a.balance), 0);
    return allAccountsSum + hapiCOP;
  }, [accounts, trm, hapiCOP]);

  /* ---------- Cash Flow from server data ---------- */

  const availableMonths = useMemo(() => {
    const dataMonths = Object.keys(serverCashFlow);
    const current = ymKey(new Date());
    if (dataMonths.length === 0) return [current];

    const sortedAsc = [...dataMonths].sort(ymCompare);
    const earliest = sortedAsc[0];
    const filled: string[] = [];
    let cursor = earliest;
    let guard = 0;
    while (ymCompare(cursor, current) <= 0 && guard++ < 600) {
      filled.push(cursor);
      cursor = addCalendarMonth(cursor, 1);
    }
    if (filled.length === 0) {
      return Array.from(new Set([...dataMonths, current])).sort(ymCompare).reverse();
    }
    return filled.reverse();
  }, [serverCashFlow]);

  useEffect(() => {
    if (availableMonths.length === 0) return;
    if (availableMonths.includes(selectedMonth)) return;
    const current = ymKey(new Date());
    setSelectedMonth(availableMonths.includes(current) ? current : availableMonths[0]);
  }, [availableMonths, selectedMonth]);

  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    availableMonths.forEach((m) => ys.add(Number(m.split("-")[0])));
    return Array.from(ys).sort((a, b) => b - a);
  }, [availableMonths]);

  // Build a sorted array of cumulative capital by date from all accounts (forward approach)
  const forwardCapitalByDate = useMemo(() => {
    if (allDailyNetFlow.length === 0) return { byDate: new Map<string, number>(), txBasedCurrent: 0 };
    let running = 0;
    const byDate = new Map<string, number>();
    for (const point of allDailyNetFlow) {
      running += point.net;
      const key = `${point._id.year}-${String(point._id.month).padStart(2, "0")}-${String(point._id.day).padStart(2, "0")}`;
      byDate.set(key, running);
    }
    return { byDate, txBasedCurrent: running };
  }, [allDailyNetFlow]);

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

    const getDayTransactions = (ym: string, day: number): DailyTx[] => {
      return serverDailyCashFlow[ym]?.[day]?.transactions || [];
    };

    // Forward capital: transaction-based running total + calibration offset so today matches stat cards
    const { byDate, txBasedCurrent } = forwardCapitalByDate;
    const realCurrentCapital = netCapital || 0;
    const calibrationOffset = realCurrentCapital - txBasedCurrent;

    // Get the transaction-based capital at end of a given day (last entry on or before that date)
    const getCapitalAtDate = (dateStr: string): number => {
      // Walk backwards from dateStr to find last known value
      const [y, m, d] = dateStr.split("-").map(Number);
      // Try the exact date and earlier dates within a reasonable range
      for (let delta = 0; delta <= 365; delta++) {
        const dt = new Date(y, m - 1, d - delta);
        if (dt.getFullYear() < 2020) break;
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        if (byDate.has(key)) return byDate.get(key)! + calibrationOffset;
      }
      return calibrationOffset;
    };

    const getCapitalAtEndOfMonth = (ym: string): number => {
      const [y, m] = ym.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return getCapitalAtDate(`${ym}-${String(lastDay).padStart(2, "0")}`);
    };

    let data: { label: string; capital: number; expense: number; expenseBar: number; transactions?: DailyTx[] }[] = [];
    let selectedPeriodExpense = 0;

    if (chartView === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const now = new Date();
      const daysInMonth = new Date(y, m, 0).getDate();
      const lastDay = (now.getFullYear() === y && now.getMonth() === m - 1)
        ? now.getDate()
        : daysInMonth;

      let cumExp = 0;
      for (let day = 1; day <= lastDay; day++) {
        const dayExp = getDayExpenses(selectedMonth, day);
        cumExp += dayExp;
        const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
        const capital = getCapitalAtDate(dateStr);
        data.push({
          label: String(day),
          capital,
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
  }, [serverCashFlow, serverDailyCashFlow, forwardCapitalByDate, accounts, trm, netCapital, chartView, selectedMonth, selectedYear]);

  /* ---------- Monthly income/expense stats ---------- */

  const monthlyStats = useMemo(() => {
    const usdAccountIds = new Set<string>();
    accounts.forEach((a) => { if (a.currency === "USD") usdAccountIds.add(a._id); });
    const safeTrm = trm || 0;

    const getMonthTotals = (ym: string) => {
      const monthData = serverCashFlow[ym];
      if (!monthData) return { income: 0, expenses: 0 };
      let income = 0, expenses = 0;
      for (const [accId, vals] of Object.entries(monthData)) {
        const mult = usdAccountIds.has(accId) ? safeTrm : 1;
        income += vals.income * mult;
        expenses += vals.expenses * mult;
      }
      return { income, expenses };
    };

    // "Selected period" income — mirrors how expenses work in cashFlow useMemo
    let selectedPeriodIncome = 0;
    if (chartView === "month") {
      selectedPeriodIncome = getMonthTotals(selectedMonth).income;
    } else {
      // year view: sum all months in the selected year
      for (let mo = 1; mo <= 12; mo++) {
        const ym = `${selectedYear}-${String(mo).padStart(2, "0")}`;
        selectedPeriodIncome += getMonthTotals(ym).income;
      }
    }

    const now = new Date();
    const currentYm = ymKey(now);
    const lastYm = ymKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const current = getMonthTotals(currentYm);
    const last = getMonthTotals(lastYm);

    const expenseDelta = last.expenses > 0
      ? ((current.expenses - last.expenses) / last.expenses) * 100
      : 0;

    const lastMonthDeficit = last.expenses > last.income && last.income > 0;
    const lastMonthSurplus = last.income > last.expenses && last.income > 0;

    return { current, last, expenseDelta, lastMonthDeficit, lastMonthSurplus, currentYm, lastYm, selectedPeriodIncome };
  }, [serverCashFlow, accounts, trm, chartView, selectedMonth, selectedYear]);

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
          <h1 className="text-heading text-[var(--c-text)] mt-1">{greeting}{userName ? `, ${userName}` : ""}</h1>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-card border border-[var(--c-border)] rounded-lg text-[12px] text-[var(--c-text-2)]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {t.dashboard.last30Days}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-card border border-[var(--c-border)] rounded-lg text-[12px] text-[var(--c-text-2)]">
            TRM <span className="font-medium text-[var(--c-text)] tabular-nums">{formatCOP(trm)}</span>
          </div>
        </div>
      </div>

      {/* Portfolio Overview */}
      <section className={`grid grid-cols-1 gap-3 ${hapiCOP !== 0 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {/* Débito */}
        <PillarCard
          href="/savings"
          label={t.nav.debit}
          mainValue={formatCOP(liquidityCOP)}
          secondary={liquidityUSD !== 0 ? `${formatUSD(liquidityUSD)} ${t.dashboard.inUSD}` : undefined}
          icon={
            <svg className="w-4 h-4 text-[var(--c-text-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
            </svg>
          }
          items={debitAccounts.map((a) => ({
            name: a.name,
            value: formatCOP(a.currency === "USD" ? a.balance * (trm || 0) : a.balance),
            secondary: a.currency === "USD" ? formatUSD(a.balance) : undefined,
          }))}
        />

        {/* Renta Fija */}
        <PillarCard
          href="/fixed-income"
          label={t.nav.fixedIncome}
          mainValue={formatCOP(fixedIncomeCOP)}
          secondary={fixedIncomeGrowth !== 0 ? `${fixedIncomeGrowth > 0 ? "+" : ""}${formatCOP(fixedIncomeGrowth)} ${t.dashboard.hasGrown}` : undefined}
          secondaryClassName={fixedIncomeGrowth > 0 ? "text-[var(--c-income)]" : "text-[var(--c-expense)]"}
          icon={
            <svg className="w-4 h-4 text-[var(--c-text-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          items={fixedIncomeAccounts.map((a) => ({
            name: a.name,
            value: formatCOP(a.currency === "USD" ? a.balance * (trm || 0) : a.balance),
            secondary: a.currency === "USD" ? formatUSD(a.balance) : undefined,
          }))}
        />

        {/* Acciones — solo si hay saldo */}
        {hapiCOP !== 0 && <PillarCard
          href="/stocks"
          label={t.nav.stocks}
          mainValue={hapiCOP !== 0 ? formatCOP(hapiCOP) : "—"}
          secondary={hapiUSD !== 0 ? formatUSD(hapiUSD) : undefined}
          icon={
            <svg className="w-4 h-4 text-[var(--c-text-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          }
          items={holdings.map((h) => {
            const quote = stockPrices.find((q) => q.ticker === h.ticker);
            const hasLive = stockPrices.some((q) => q.price !== null);
            const price = hasLive ? (quote?.price ?? h.costBasisPerShare) : h.costBasisPerShare;
            const valueUSD = h.shares * price;
            return {
              name: h.ticker,
              secondary: h.companyName,
              value: formatUSD(valueUSD),
            };
          })}
        />}

        {/* Capital Total — right side, secondary */}
        <div className="md:col-span-1 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-5 py-5 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-medium text-[var(--c-text-4)] uppercase tracking-wide mb-4">{t.dashboard.totalCapital}</p>
            <p className="text-[28px] font-bold tabular-nums text-[var(--c-text)] leading-none">{formatCOP(netCapital)}</p>
          </div>
          {debtAbs > 0 && (
            <div className="mt-5 pt-4 border-t border-[var(--c-border)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[var(--c-text-4)]">{t.dashboard.totalDebt}</p>
                <p className="text-[13px] font-semibold tabular-nums text-[var(--c-expense)]">{formatCOP(debtAbs)}</p>
              </div>
            </div>
          )}
        </div>
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
                    {availableMonths.map((m) => (<option key={m} value={m}>{monthLabel(m, monthLocale)}</option>))}
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
                <Tooltip cursor={{ fill: "rgba(2,88,100,0.03)" }} content={<CashFlowTooltip chartView={chartView} tDashboard={t.dashboard} />} />
                <Bar yAxisId="expense" dataKey="expenseBar" fill="url(#expenseBarFill)" radius={[4, 4, 0, 0]} name="expense" maxBarSize={28} />
                <Area yAxisId="capital" type="monotoneX" dataKey="capital" stroke="var(--c-brand)" strokeWidth={1.5} fill="url(#capitalFill)" name="capital" />
                <Line yAxisId="capital" type="monotoneX" dataKey="capital" stroke="var(--c-brand)" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: "var(--c-brand)", stroke: "var(--c-tooltip-bg)", strokeWidth: 2 }} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
            );
          })()}
        </Card>

        <div className="lg:col-span-1 flex flex-col gap-3">
          {/* Ingresos — dinámico según período del gráfico */}
          <Card padding="md" className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--c-income-bg)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[var(--c-income)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--c-text-4)] mb-0.5">{lang === "es" ? "Ingresos" : "Income"}</p>
              <p className="text-[17px] font-semibold text-[var(--c-text)] tabular-nums truncate leading-tight">{formatCOP(monthlyStats.selectedPeriodIncome)}</p>
              <p className="text-[10px] text-[var(--c-text-5)] mt-0.5">{chartView === "month" ? monthLabel(selectedMonth, monthLocale) : `${t.dashboard.yearLabel} ${selectedYear}`}</p>
            </div>
          </Card>

          {/* Gastos este mes */}
          <Card padding="md" className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--c-expense-bg2)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[var(--c-expense)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--c-text-4)] mb-0.5">{t.dashboard.expenses}</p>
              <p className="text-[17px] font-semibold text-[var(--c-text)] tabular-nums truncate leading-tight">{formatCOP(cashFlow.selectedPeriodExpense)}</p>
              <p className="text-[10px] text-[var(--c-text-5)] mt-0.5">{chartView === "month" ? monthLabel(selectedMonth, monthLocale) : `${t.dashboard.yearLabel} ${selectedYear}`}</p>
            </div>
          </Card>

          {/* Análisis mes anterior */}
          {monthlyStats.last.income > 0 && (
            <Card padding="md">
              <p className="text-[10px] font-medium text-[var(--c-text-4)] uppercase tracking-wide mb-2.5">
                {lang === "es" ? "Análisis — mes anterior" : "Analysis — last month"}
              </p>

              {/* Deficit / surplus badge */}
              <div className={`flex items-start gap-2 mb-3 rounded-lg px-3 py-2.5 ${
                monthlyStats.lastMonthDeficit
                  ? "bg-[var(--c-expense-bg2)]"
                  : "bg-[var(--c-income-bg)]"
              }`}>
                <span className="mt-0.5 shrink-0 text-[13px]">
                  {monthlyStats.lastMonthDeficit ? "⚠️" : "✓"}
                </span>
                <p className={`text-[11px] leading-snug font-medium ${
                  monthlyStats.lastMonthDeficit ? "text-[var(--c-expense)]" : "text-[var(--c-income)]"
                }`}>
                  {monthlyStats.lastMonthDeficit
                    ? (lang === "es" ? "El mes pasado gastaste más de lo que ingresó" : "Last month you spent more than you earned")
                    : (lang === "es" ? "El mes pasado cerraste en positivo" : "Last month you had a surplus")}
                </p>
              </div>

              {/* % change in expenses */}
              {monthlyStats.last.expenses > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[var(--c-text-4)]">
                    {lang === "es" ? "Gastos vs mes anterior" : "Expenses vs last month"}
                  </p>
                  <span className={`text-[12px] font-semibold tabular-nums ${
                    monthlyStats.expenseDelta <= 0 ? "text-[var(--c-income)]" : "text-[var(--c-expense)]"
                  }`}>
                    {monthlyStats.expenseDelta > 0 ? "+" : ""}{monthlyStats.expenseDelta.toFixed(1)}%
                  </span>
                </div>
              )}
            </Card>
          )}
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
              <h2 className="text-title text-[var(--c-text)]">{t.dashboard.myCards}</h2>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {walletCards.map((card) => {
              const isUsd = card.currency === "USD";
              const fmt = isUsd ? formatUSD : formatCOP;
              const href = card.type === "credit_card"
                ? `/credit-cards/${card.slug.replace(/-tc$/, "")}`
                : `/savings/${card.slug}`;
              const gradientEnd = card.config?.colorGradientEnd as string | undefined;
              return (
                <Link
                  key={card._id}
                  href={href}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--c-surface-2)] transition-colors group"
                >
                  <div
                    className="w-10 h-6 rounded-md shrink-0 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${card.color} 0%, ${gradientEnd || card.color} 100%)` }}
                  />
                  <span className="flex-1 text-[12px] text-[var(--c-text-2)] group-hover:text-[var(--c-text)] transition-colors truncate">
                    {card.name}
                  </span>
                  <span className={`text-[12px] tabular-nums font-medium shrink-0 ${card.balance < 0 ? "text-[var(--c-expense)]" : "text-[var(--c-text)]"}`}>
                    {fmt(card.balance)}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}

/* ---------- CashFlowTooltip ---------- */

function CashFlowTooltip({ active, payload, label, chartView, tDashboard }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const txs: DailyTx[] = row.transactions || [];
  const expenses = txs.filter((tx) => tx.type === "Expense" || tx.type === "Deposit" || tx.type === "Withdrawal");

  if (chartView === "month") {
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-[var(--c-border)] rounded-2xl shadow-xl shadow-black/5 px-4 py-3.5 max-w-[240px]">
        <p className="text-[11px] font-medium text-[var(--c-text-4)] mb-2.5 uppercase tracking-wider">{tDashboard.day} {label}</p>
        <div className="flex items-center justify-between gap-4 mb-2.5 pb-2.5 border-b border-[var(--c-chart-grid)]">
          <span className="text-[11px] text-[var(--c-text-2)]">{tDashboard.capital}</span>
          <span className="text-[12px] font-semibold text-[var(--c-brand)] tabular-nums">{formatCOP(row.capital)}</span>
        </div>
        {expenses.length > 0 ? (
          <div className="space-y-1">
            {expenses.map((tx: DailyTx, i: number) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[var(--c-text-3)] truncate">{tx.description}</span>
                <span className={`text-[11px] font-medium tabular-nums whitespace-nowrap ${tx.amount >= 0 ? "text-[var(--c-income)]" : "text-[var(--c-expense)]"}`}>
                  {tx.amount > 0 ? "+" : ""}{formatCOP(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--c-text-5)]">{tDashboard.noExpenses}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-[var(--c-border)] rounded-2xl shadow-xl shadow-black/5 px-4 py-3.5">
      <p className="text-[11px] font-medium text-[var(--c-text-4)] mb-2.5 uppercase tracking-wider">{label}</p>
      <div className="flex items-center justify-between gap-6 mb-1.5">
        <span className="text-[11px] text-[var(--c-text-2)]">{tDashboard.capital}</span>
        <span className="text-[12px] font-semibold text-[var(--c-brand)] tabular-nums">{formatCOP(row.capital)}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-[11px] text-[var(--c-text-2)]">{tDashboard.expenses}</span>
        <span className="text-[12px] font-semibold text-[var(--c-expense)] tabular-nums">{formatCOP(row.expenseBar)}</span>
      </div>
    </div>
  );
}

/* ---------- PillarCard ---------- */

interface PillarItem { name: string; value: string; secondary?: string }

function PillarCard({
  href, label, mainValue, secondary, secondaryClassName = "text-[var(--c-text-4)]",
  icon, items,
}: {
  href: string; label: string; mainValue: string; secondary?: string;
  secondaryClassName?: string; icon: React.ReactNode; items: PillarItem[];
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="md:col-span-1 relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={href}
        className={`group flex flex-col rounded-2xl border bg-card px-5 py-5 transition-all duration-200 ${
          hovered ? "border-[var(--c-brand)]/30 shadow-sm" : "border-[var(--c-border)]"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-8 h-8 rounded-xl bg-[var(--c-surface-2)] flex items-center justify-center">
            {icon}
          </div>
          <svg
            className={`w-3.5 h-3.5 transition-colors ${hovered ? "text-[var(--c-brand)]" : "text-[var(--c-text-5)]"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
        <p className="text-[11px] font-medium text-[var(--c-text-4)] uppercase tracking-wide mb-1.5">{label}</p>
        <p className="text-[24px] font-semibold tabular-nums text-[var(--c-text)] leading-none">{mainValue}</p>
        {secondary && (
          <p className={`text-[11px] mt-1.5 tabular-nums font-medium ${secondaryClassName}`}>{secondary}</p>
        )}
      </Link>

      {/* Breakdown tooltip */}
      {items.length > 0 && (
        <div
          className={`absolute top-full left-0 right-0 mt-2 z-50 transition-all duration-200 ${
            hovered ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="rounded-xl border border-[var(--c-border)] bg-card shadow-lg shadow-black/5 overflow-hidden">
            {/* small arrow */}
            <div className="absolute -top-1.5 left-6 w-3 h-3 rotate-45 border-l border-t border-[var(--c-border)] bg-card" />
            <div className="px-4 py-3 space-y-2.5">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[var(--c-text)] truncate">{item.name}</p>
                    {item.secondary && (
                      <p className="text-[10px] text-[var(--c-text-4)] truncate">{item.secondary}</p>
                    )}
                  </div>
                  <p className="text-[12px] font-semibold tabular-nums text-[var(--c-text)] shrink-0">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

