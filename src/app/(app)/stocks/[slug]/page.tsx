"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import TableFilters from "@/components/TableFilters";
import { CardSkeleton, TableSkeleton } from "@/components/Skeleton";
import { formatCOP, formatUSD, formatPercent } from "@/lib/format";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useT } from "@/hooks/useT";
import PortfolioCalculator from "@/components/PortfolioCalculator";

// ── Types ──────────────────────────────────────────────────────────────
interface RawHolding {
  _id: string;
  ticker: string;
  companyName: string;
  shares: number;
  costBasisPerShare: number;
  accountId: string;
  purchaseDate?: string;
  createdAt: string;
}

interface StockQuote {
  ticker: string;
  price: number;
  dayChange: number;
  dayChangePercent: number;
  name: string;
  error?: string;
}

interface HoldingRow {
  _id: string;
  ticker: string;
  companyName: string;
  shares: number;
  costBasisPerShare: number;
  price: number;
  valueUSD: number;
  valueCOP: number;
  costBasisTotal: number;
  plUSD: number;
  plPercent: number;
  purchaseDate?: string;
  createdAt: string;
}

interface Account {
  _id: string;
  slug: string;
  name: string;
  type: string;
  color: string;
  config?: { colorGradientEnd?: string };
}

interface MonthlyPoint {
  month: string;
  invested: number;
  value: number;
}

const PIE_COLORS = [
  "var(--c-brand)",
  "var(--c-grad2)",
  "#0A5A7A",
  "var(--c-text-2)",
  "var(--c-grad1)",
  "var(--c-text-3)",
  "#A7C4C9",
  "var(--c-sep)",
];

const ROWS_PER_PAGE = 10;

// ── Component ──────────────────────────────────────────────────────────
export default function BrokerDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [trm, setTrm] = useState<number>(0);
  const [priceTimestamp, setPriceTimestamp] = useState<string>("");

  // Tab
  const [activeTab, setActiveTab] = useState<"holdings" | "calculator">("holdings");

  // Search & filter
  const [search, setSearch] = useState("");
  const [plFilter, setPlFilter] = useState("");

  const filteredHoldings = useMemo(() => {
    let filtered = [...holdings];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (h) =>
          h.ticker.toLowerCase().includes(q) ||
          h.companyName.toLowerCase().includes(q)
      );
    }
    if (plFilter === "winners") filtered = filtered.filter((h) => h.plUSD >= 0);
    else if (plFilter === "losers") filtered = filtered.filter((h) => h.plUSD < 0);
    return filtered;
  }, [holdings, search, plFilter]);

  // Pagination
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filteredHoldings.length / ROWS_PER_PAGE);
  const pagedHoldings = filteredHoldings.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE
  );
  useEffect(() => setPage(1), [search, plFilter]);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShares, setEditShares] = useState("");
  const [editCost, setEditCost] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<HoldingRow | null>(null);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addTicker, setAddTicker] = useState("");
  const [addCompany, setAddCompany] = useState("");
  const [addShares, setAddShares] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addPurchaseDate, setAddPurchaseDate] = useState("");
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const accountsRes = await fetch("/api/v2/accounts");
      const accounts: Account[] = await accountsRes.json();
      const found = accounts.find((a) => a.type === "brokerage" && a.slug === slug);
      if (!found) {
        router.push("/stocks");
        return;
      }
      setAccount(found);

      const holdingsRes = await fetch(`/api/v2/holdings?accountId=${found._id}`);
      const rawHoldings: RawHolding[] = await holdingsRes.json();

      if (rawHoldings.length === 0) {
        setHoldings([]);
        setLoading(false);
        return;
      }

      const tickers = rawHoldings.map((i) => i.ticker).join(",");
      const [stockRes, trmRes] = await Promise.all([
        fetch(`/api/stocks?tickers=${tickers}`),
        fetch("/api/trm"),
      ]);
      const quotes: StockQuote[] = await stockRes.json();
      const { rate } = await trmRes.json();
      setTrm(rate);

      const quoteMap = new Map<string, StockQuote>();
      for (const q of quotes) {
        if (!q.error) quoteMap.set(q.ticker, q);
      }

      const rows: HoldingRow[] = rawHoldings.map((inv) => {
        const q = quoteMap.get(inv.ticker);
        const price = q?.price ?? 0;
        const valueUSD = inv.shares * price;
        const costBasisTotal = inv.shares * inv.costBasisPerShare;
        const plUSD = valueUSD - costBasisTotal;
        const plPercent = costBasisTotal !== 0 ? (plUSD / costBasisTotal) * 100 : 0;
        return {
          _id: inv._id,
          ticker: inv.ticker,
          companyName: inv.companyName,
          shares: inv.shares,
          costBasisPerShare: inv.costBasisPerShare,
          price,
          valueUSD,
          valueCOP: valueUSD * rate,
          costBasisTotal,
          plUSD,
          plPercent,
          purchaseDate: inv.purchaseDate,
          createdAt: inv.createdAt,
        };
      });

      setHoldings(rows);
      setPriceTimestamp(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (err) {
      console.error("Failed to fetch broker data", err);
    } finally {
      setLoading(false);
    }
  }, [slug, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived stats ────────────────────────────────────────────────────
  const portfolioUSD = holdings.reduce((s, h) => s + h.valueUSD, 0);
  const portfolioCOP = holdings.reduce((s, h) => s + h.valueCOP, 0);
  const totalInvested = holdings.reduce((s, h) => s + h.costBasisTotal, 0);
  const totalPL = portfolioUSD - totalInvested;
  const totalPLPercent = totalInvested !== 0 ? (totalPL / totalInvested) * 100 : 0;

  // ── Monthly line chart data ──────────────────────────────────────────
  const monthlyData = useMemo((): MonthlyPoint[] => {
    if (holdings.length === 0) return [];

    const monthMap = new Map<string, { invested: number; value: number }>();

    for (const h of holdings) {
      const rawDate = h.purchaseDate || h.createdAt;
      const d = new Date(rawDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { invested: 0, value: 0 };
      monthMap.set(key, {
        invested: existing.invested + h.costBasisTotal,
        value: existing.value + h.valueUSD,
      });
    }

    const sorted = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));

    let cumInvested = 0;
    let cumValue = 0;
    return sorted.map(([month, data]) => {
      cumInvested += data.invested;
      cumValue += data.value;
      const [year, mon] = month.split("-");
      const label = new Date(parseInt(year), parseInt(mon) - 1).toLocaleString(
        "default",
        { month: "short", year: "2-digit" }
      );
      return { month: label, invested: Math.round(cumInvested * 100) / 100, value: Math.round(cumValue * 100) / 100 };
    });
  }, [holdings]);

  // ── Inline edit helpers ──────────────────────────────────────────────
  function startEdit(h: HoldingRow) {
    setEditingId(h._id);
    setEditShares(String(h.shares));
    setEditCost(String(h.costBasisPerShare));
  }
  function cancelEdit() { setEditingId(null); }

  async function saveEdit(id: string) {
    const shares = parseFloat(editShares);
    const costBasisPerShare = parseFloat(editCost);
    if (isNaN(shares) || isNaN(costBasisPerShare) || shares <= 0 || costBasisPerShare <= 0) return;
    await fetch(`/api/v2/holdings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shares, costBasisPerShare }),
    });
    setEditingId(null);
    fetchData();
  }

  function editPreview(h: HoldingRow) {
    const shares = parseFloat(editShares) || 0;
    const cost = parseFloat(editCost) || 0;
    const valueUSD = shares * h.price;
    const costTotal = shares * cost;
    const plUSD = valueUSD - costTotal;
    const plPct = costTotal !== 0 ? (plUSD / costTotal) * 100 : 0;
    return { valueUSD, costTotal, plUSD, plPct };
  }

  // ── Delete ───────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/v2/holdings/${deleteTarget._id}`, { method: "DELETE" });
    setDeleteTarget(null);
    fetchData();
  }

  // ── Add holding ──────────────────────────────────────────────────────
  function resetAddForm() {
    setAddTicker(""); setAddCompany(""); setAddShares("");
    setAddCost(""); setAddPurchaseDate(""); setAddError(""); setAddSaving(false);
  }

  async function handleAdd() {
    setAddError("");
    const ticker = addTicker.trim().toUpperCase();
    const companyName = addCompany.trim();
    const shares = parseFloat(addShares);
    const costBasisPerShare = parseFloat(addCost);

    if (!ticker || !companyName || isNaN(shares) || isNaN(costBasisPerShare) || shares <= 0 || costBasisPerShare <= 0) {
      setAddError(t.stocks.allFieldsRequired);
      return;
    }

    setAddSaving(true);
    try {
      const res = await fetch(`/api/stocks?tickers=${ticker}`);
      const data: StockQuote[] = await res.json();
      if (!data.length || data[0].error) {
        setAddError(t.stocks.invalidTicker);
        setAddSaving(false);
        return;
      }
    } catch {
      setAddError(t.stocks.couldNotValidate);
      setAddSaving(false);
      return;
    }

    const body: Record<string, unknown> = {
      ticker, companyName, shares, costBasisPerShare,
      accountId: account!._id,
    };
    if (addPurchaseDate) body.purchaseDate = addPurchaseDate;

    await fetch("/api/v2/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setAddOpen(false);
    resetAddForm();
    fetchData();
  }

  // ── Pie data ─────────────────────────────────────────────────────────
  const pieData = holdings.map((h) => ({
    name: h.ticker,
    fullName: h.companyName,
    value: h.valueUSD,
    pct: portfolioUSD > 0 ? (h.valueUSD / portfolioUSD) * 100 : 0,
  }));

  const plColor = (v: number) =>
    v >= 0 ? "text-[var(--c-income)]" : "text-[var(--c-expense)]";

  const inputCls =
    "border border-[var(--c-border)] rounded-lg px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] bg-card";
  const inputSmCls =
    "border border-[var(--c-border)] rounded-lg px-2 py-1 text-sm text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] bg-card";

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href="/stocks"
          className="text-xs text-[var(--c-text-3)] hover:text-[var(--c-brand)] transition-colors inline-flex items-center gap-1 mb-3"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t.stocks.title}
        </Link>
        <h1 className="text-heading text-[var(--c-text)]">
          {account?.name ?? "..."}
        </h1>
        {account && (
          <div
            className="h-1 w-16 rounded-full mt-2"
            style={{
              background: `linear-gradient(to right, ${account.color}, ${account.config?.colorGradientEnd ?? account.color})`,
            }}
          />
        )}

        {/* Tabs */}
        {account && (
          <div className="flex gap-1 mt-4 bg-[var(--c-surface)] rounded-lg p-1 w-fit">
            {(["holdings", "calculator"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? "bg-card text-[var(--c-text)] shadow-sm"
                    : "text-[var(--c-text-3)] hover:text-[var(--c-text)]"
                }`}
              >
                {tab === "holdings" ? ((t as any).calculator?.holdings || t.stocks.myHoldings) : ((t as any).calculator?.tab || "Calculator")}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === "calculator" && account ? (
        <PortfolioCalculator accountId={account._id} />
      ) : (
      <>
      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <p className="text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-2">
                {t.stocks.portfolioValueUSD}
              </p>
              <p className="text-xl font-semibold text-[var(--c-text)] tabular-nums">
                {formatUSD(portfolioUSD)}
              </p>
            </Card>
            <Card>
              <p className="text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-2">
                {t.stocks.portfolioValueCOP}
              </p>
              <p className="text-xl font-semibold text-[var(--c-text)] tabular-nums">
                {formatCOP(portfolioCOP)}
              </p>
            </Card>
            <Card>
              <p className="text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-2">
                {t.stocks.pl} Total
              </p>
              <p className={`text-xl font-semibold tabular-nums ${plColor(totalPL)}`}>
                {formatUSD(totalPL)}
                <span className="text-sm ml-2">{formatPercent(totalPLPercent)}</span>
              </p>
            </Card>
          </div>
          {priceTimestamp && (
            <p className="text-[11px] text-[var(--c-text-3)]">
              {t.stocks.pricesAsOf} {priceTimestamp}
            </p>
          )}
        </>
      )}

      {/* Holdings table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-medium text-[var(--c-text)]">
              {t.stocks.myHoldings}
            </h2>
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--c-brand)] rounded-lg hover:bg-[var(--c-brand-hov)] transition-colors"
            >
              {t.stocks.addHolding}
            </button>
          </div>

          <TableFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.stocks.searchPlaceholder}
            filterValue={plFilter}
            onFilterChange={setPlFilter}
            filterOptions={[
              { label: t.stocks.winners, value: "winners" },
              { label: t.stocks.losers, value: "losers" },
            ]}
            filterLabel={t.stocks.filterLabel}
          />

          <div className="overflow-x-auto -mx-5 md:-mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-left">
                  <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{t.stocks.ticker}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{t.stocks.company}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{t.stocks.shares}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{t.stocks.price}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{t.stocks.valueUSD}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{t.stocks.valueCOP}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{t.stocks.costBasis}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{t.stocks.pl}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{t.stocks.plPercent}</th>
                  <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{t.stocks.actions}</th>
                </tr>
              </thead>
              <tbody>
                {pagedHoldings.map((h) => {
                  const isEditing = editingId === h._id;
                  const preview = isEditing ? editPreview(h) : null;
                  return (
                    <tr
                      key={h._id}
                      className="border-t border-[var(--c-border-2)] hover:bg-[var(--c-surface-2)] transition-colors"
                    >
                      <td className="px-5 md:px-6 py-3.5 font-medium text-[var(--c-text)] text-[13px]">{h.ticker}</td>
                      <td className="px-3 py-3.5 text-[var(--c-text-2)] text-[13px]">{h.companyName}</td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">
                        {isEditing ? (
                          <input type="number" value={editShares} onChange={(e) => setEditShares(e.target.value)} className={`w-20 text-right ${inputSmCls}`} />
                        ) : h.shares}
                      </td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">{formatUSD(h.price)}</td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">{formatUSD(isEditing ? preview!.valueUSD : h.valueUSD)}</td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">{formatCOP((isEditing ? preview!.valueUSD : h.valueUSD) * trm)}</td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[var(--c-text-3)] text-xs">$/sh</span>
                            <input type="number" value={editCost} onChange={(e) => setEditCost(e.target.value)} className={`w-20 text-right ${inputSmCls}`} />
                          </div>
                        ) : formatUSD(h.costBasisTotal)}
                      </td>
                      <td className={`px-3 py-3.5 text-right text-[13px] font-semibold tabular-nums ${plColor(isEditing ? preview!.plUSD : h.plUSD)}`}>
                        {formatUSD(isEditing ? preview!.plUSD : h.plUSD)}
                      </td>
                      <td className={`px-3 py-3.5 text-right text-[13px] tabular-nums ${plColor(isEditing ? preview!.plPct : h.plPercent)}`}>
                        {formatPercent(isEditing ? preview!.plPct : h.plPercent)}
                      </td>
                      <td className="px-5 md:px-6 py-3.5 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => saveEdit(h._id)} className="text-[13px] font-medium text-[var(--c-text)] hover:underline">{t.common.save}</button>
                            <button onClick={cancelEdit} className="text-[13px] text-[var(--c-text-3)] hover:underline">{t.common.cancel}</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => startEdit(h)} className="text-[13px] text-[var(--c-text-2)] hover:text-[var(--c-text)] hover:underline">{t.common.edit}</button>
                            <button onClick={() => setDeleteTarget(h)} className="text-[13px] text-[var(--c-expense)] hover:underline">{t.common.delete}</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {pagedHoldings.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-[var(--c-text-3)] text-sm">
                      {search || plFilter ? t.stocks.noMatchingHoldings : t.stocks.noHoldings}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </Card>
      )}

      {/* Charts */}
      {!loading && holdings.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Pie chart */}
          <Card>
            <h2 className="text-[15px] font-medium text-[var(--c-text)] mb-5">
              {t.stocks.portfolioAllocation}
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => formatUSD(Number(value))}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--c-border)",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const item = pieData.find((d) => d.name === value);
                      return (
                        <span className="text-xs text-[var(--c-text-2)]">
                          {value} ({formatPercent(item?.pct ?? 0)})
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Line chart */}
          <Card>
            <h2 className="text-[15px] font-medium text-[var(--c-text)] mb-5">
              {t.stocks.investmentTimeline}
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--c-text-3)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--c-text-3)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      formatUSD(Number(value)),
                      name === "invested" ? t.stocks.cumulativeInvested : t.stocks.currentValueLine,
                    ]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--c-border)",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                    }}
                  />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs text-[var(--c-text-2)]">
                        {value === "invested" ? t.stocks.cumulativeInvested : t.stocks.currentValueLine}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="invested"
                    stroke="var(--c-text-3)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--c-text-3)" }}
                    strokeDasharray="4 2"
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--c-brand)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--c-brand)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      </>
      )}

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t.stocks.deleteHolding}>
        <p className="text-sm text-[var(--c-text-2)] mb-5">
          {t.stocks.deleteConfirmText}{" "}
          <span className="font-semibold text-[var(--c-text)]">{deleteTarget?.ticker}</span>?{" "}
          {t.common.thisActionCannotBeUndone}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm border border-[var(--c-border)] rounded-lg text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors">
            {t.common.cancel}
          </button>
          <button onClick={confirmDelete} className="px-4 py-2 text-sm text-white bg-[var(--c-expense)] rounded-lg hover:bg-[var(--c-expense-hov)] transition-colors">
            {t.common.delete}
          </button>
        </div>
      </Modal>

      {/* Add holding modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); resetAddForm(); }}
        title={t.stocks.addHolding}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.stocks.ticker}</label>
            <input type="text" value={addTicker} onChange={(e) => setAddTicker(e.target.value.toUpperCase())} placeholder="e.g. VOO" className={`w-full ${inputCls}`} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.stocks.companyName}</label>
            <input type="text" value={addCompany} onChange={(e) => setAddCompany(e.target.value)} placeholder="e.g. Vanguard S&P 500 ETF" className={`w-full ${inputCls}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.stocks.shares}</label>
              <input type="number" value={addShares} onChange={(e) => setAddShares(e.target.value)} placeholder="0" min="0" step="any" className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.stocks.costPerShare}</label>
              <input type="number" value={addCost} onChange={(e) => setAddCost(e.target.value)} placeholder="0.00" min="0" step="any" className={`w-full ${inputCls}`} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.stocks.purchaseDateOptional}</label>
            <input type="date" value={addPurchaseDate} onChange={(e) => setAddPurchaseDate(e.target.value)} className={`w-full ${inputCls}`} />
          </div>

          {addError && <p className="text-sm text-[var(--c-expense)]">{addError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setAddOpen(false); resetAddForm(); }} className="px-4 py-2 text-sm border border-[var(--c-border)] rounded-lg text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors">
              {t.common.cancel}
            </button>
            <button onClick={handleAdd} disabled={addSaving} className="px-4 py-2 text-sm text-white bg-[var(--c-brand)] rounded-lg hover:bg-[var(--c-brand-hov)] transition-colors disabled:opacity-50">
              {addSaving ? t.common.validating : t.common.add}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
