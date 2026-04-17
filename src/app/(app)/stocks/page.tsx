"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────
interface Holding {
  _id: string;
  ticker: string;
  companyName: string;
  shares: number;
  costBasisPerShare: number;
  accountId: string;
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
  dayChangePercent: number;
  dayChange: number;
}

interface Account {
  _id: string;
  slug: string;
  name: string;
  type: string;
}

const PIE_COLORS = [
  "#025864",
  "#00D47E",
  "#0A5A7A",
  "#4A5B60",
  "#4FB7C2",
  "#7A8B90",
  "#A7C4C9",
  "#CFD7D9",
];

const ROWS_PER_PAGE = 10;

// ── Component ──────────────────────────────────────────────────────────
export default function StocksPage() {
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [trm, setTrm] = useState<number>(0);
  const [priceTimestamp, setPriceTimestamp] = useState<string>("");
  const [hapiAccountId, setHapiAccountId] = useState<string>("");
  const [brokerageName, setBrokerageName] = useState<string>("Stocks");

  // Search & filter
  const [search, setSearch] = useState("");
  const [plFilter, setPlFilter] = useState("");

  const filteredHoldings = useMemo(() => {
    let filtered = [...holdings];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((h) =>
        h.ticker.toLowerCase().includes(q) || h.companyName.toLowerCase().includes(q)
      );
    }
    if (plFilter === "winners") {
      filtered = filtered.filter((h) => h.plUSD >= 0);
    } else if (plFilter === "losers") {
      filtered = filtered.filter((h) => h.plUSD < 0);
    }
    return filtered;
  }, [holdings, search, plFilter]);

  // Pagination
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filteredHoldings.length / ROWS_PER_PAGE);
  const pagedHoldings = filteredHoldings.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE
  );

  useEffect(() => { setPage(1); }, [search, plFilter]);

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
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [holdingsRes, accountsRes] = await Promise.all([
        fetch("/api/v2/holdings"),
        fetch("/api/v2/accounts"),
      ]);
      const rawHoldings: Holding[] = await holdingsRes.json();
      const accounts: Account[] = await accountsRes.json();

      const brokerage = accounts.find((a) => a.type === "brokerage");
      if (brokerage) {
        setHapiAccountId(brokerage._id);
        setBrokerageName(brokerage.name);
      }

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
          dayChangePercent: q?.dayChangePercent ?? 0,
          dayChange: q?.dayChange ?? 0,
        };
      });

      setHoldings(rows);
      setPriceTimestamp(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (err) {
      console.error("Failed to fetch stock data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived stats ────────────────────────────────────────────────────
  const portfolioUSD = holdings.reduce((s, h) => s + h.valueUSD, 0);
  const portfolioCOP = holdings.reduce((s, h) => s + h.valueCOP, 0);
  const todayPL = holdings.reduce((s, h) => s + h.shares * h.dayChange, 0);

  // ── Inline edit helpers ──────────────────────────────────────────────
  function startEdit(h: HoldingRow) {
    setEditingId(h._id);
    setEditShares(String(h.shares));
    setEditCost(String(h.costBasisPerShare));
  }

  function cancelEdit() {
    setEditingId(null);
  }

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
    setAddTicker("");
    setAddCompany("");
    setAddShares("");
    setAddCost("");
    setAddError("");
    setAddSaving(false);
  }

  async function handleAdd() {
    setAddError("");
    const ticker = addTicker.trim().toUpperCase();
    const companyName = addCompany.trim();
    const shares = parseFloat(addShares);
    const costBasisPerShare = parseFloat(addCost);

    if (!ticker || !companyName || isNaN(shares) || isNaN(costBasisPerShare) || shares <= 0 || costBasisPerShare <= 0) {
      setAddError("All fields are required and must be valid.");
      return;
    }

    setAddSaving(true);

    try {
      const res = await fetch(`/api/stocks?tickers=${ticker}`);
      const data: StockQuote[] = await res.json();
      if (!data.length || data[0].error) {
        setAddError("Invalid ticker");
        setAddSaving(false);
        return;
      }
    } catch {
      setAddError("Could not validate ticker");
      setAddSaving(false);
      return;
    }

    await fetch("/api/v2/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, companyName, shares, costBasisPerShare, accountId: hapiAccountId }),
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

  // ── Color helper ─────────────────────────────────────────────────────
  const plColor = (v: number) => (v >= 0 ? "text-[#00A85A]" : "text-[#E5484D]");

  const inputCls = "border border-[#E6EAEB] rounded-lg px-3 py-2 text-sm text-[#0A1519] focus:outline-none focus:ring-1 focus:ring-[#025864] bg-white";
  const inputSmCls = "border border-[#E6EAEB] rounded-lg px-2 py-1 text-sm text-[#0A1519] focus:outline-none focus:ring-1 focus:ring-[#025864] bg-white";

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-heading text-[#0A1519]">Stocks</h1>
        <p className="text-sm text-[#7A8B90] mt-1">{brokerageName}</p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <p className="text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider mb-2">Portfolio Value (USD)</p>
              <p className="text-xl font-semibold text-[#0A1519] tabular-nums">{formatUSD(portfolioUSD)}</p>
            </Card>
            <Card>
              <p className="text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider mb-2">Portfolio Value (COP)</p>
              <p className="text-xl font-semibold text-[#0A1519] tabular-nums">{formatCOP(portfolioCOP)}</p>
            </Card>
            <Card>
              <p className="text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider mb-2">TRM (COP/USD)</p>
              <p className="text-xl font-semibold text-[#0A1519] tabular-nums">{formatCOP(trm)}</p>
            </Card>
            <Card>
              <p className="text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider mb-2">Today&apos;s P&amp;L</p>
              <p className={`text-xl font-semibold tabular-nums ${plColor(todayPL)}`}>{formatUSD(todayPL)}</p>
            </Card>
          </div>
          {priceTimestamp && (
            <p className="text-[11px] text-[#7A8B90]">Prices as of {priceTimestamp}</p>
          )}
        </>
      )}

      {/* Holdings table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-medium text-[#0A1519]">My Holdings</h2>
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-[#025864] rounded-lg hover:bg-[#014750] transition-colors"
            >
              Add Holding
            </button>
          </div>

          <TableFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by ticker or company..."
            filterValue={plFilter}
            onFilterChange={setPlFilter}
            filterOptions={[
              { label: "Winners", value: "winners" },
              { label: "Losers", value: "losers" },
            ]}
            filterLabel="P&L"
          />

          <div className="overflow-x-auto -mx-5 md:-mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E6EAEB] text-left">
                  <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider">Ticker</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider">Company</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">Shares</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">Price</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">Value (USD)</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">Value (COP)</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">Cost Basis</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">P&amp;L</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">P&amp;L %</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">Day %</th>
                  <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedHoldings.map((h) => {
                  const isEditing = editingId === h._id;
                  const preview = isEditing ? editPreview(h) : null;

                  return (
                    <tr key={h._id} className="border-t border-[#EEF1F1] hover:bg-[#F4F9FA] transition-colors">
                      <td className="px-5 md:px-6 py-3.5 font-medium text-[#0A1519] text-[13px]">{h.ticker}</td>
                      <td className="px-3 py-3.5 text-[#4A5B60] text-[13px]">{h.companyName}</td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editShares}
                            onChange={(e) => setEditShares(e.target.value)}
                            className={`w-20 text-right ${inputSmCls}`}
                          />
                        ) : (
                          h.shares
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">{formatUSD(h.price)}</td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">
                        {formatUSD(isEditing ? preview!.valueUSD : h.valueUSD)}
                      </td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">
                        {formatCOP((isEditing ? preview!.valueUSD : h.valueUSD) * trm)}
                      </td>
                      <td className="px-3 py-3.5 text-right text-[13px] tabular-nums">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[#7A8B90] text-xs">$/sh</span>
                            <input
                              type="number"
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              className={`w-20 text-right ${inputSmCls}`}
                            />
                          </div>
                        ) : (
                          formatUSD(h.costBasisTotal)
                        )}
                      </td>
                      <td className={`px-3 py-3.5 text-right text-[13px] font-semibold tabular-nums ${plColor(isEditing ? preview!.plUSD : h.plUSD)}`}>
                        {formatUSD(isEditing ? preview!.plUSD : h.plUSD)}
                      </td>
                      <td className={`px-3 py-3.5 text-right text-[13px] tabular-nums ${plColor(isEditing ? preview!.plPct : h.plPercent)}`}>
                        {formatPercent(isEditing ? preview!.plPct : h.plPercent)}
                      </td>
                      <td className={`px-3 py-3.5 text-right text-[13px] tabular-nums ${plColor(h.dayChangePercent)}`}>
                        {formatPercent(h.dayChangePercent)}
                      </td>
                      <td className="px-5 md:px-6 py-3.5 text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => saveEdit(h._id)}
                              className="text-[13px] font-medium text-[#0A1519] hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-[13px] text-[#7A8B90] hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => startEdit(h)}
                              className="text-[13px] text-[#4A5B60] hover:text-[#0A1519] hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(h)}
                              className="text-[13px] text-[#E5484D] hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {pagedHoldings.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-[#7A8B90] text-sm">
                      {search || plFilter ? "No matching holdings." : "No holdings yet. Add one to get started."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </Card>
      )}

      {/* Portfolio Allocation Chart */}
      {!loading && holdings.length > 0 && (
        <Card>
          <h2 className="text-[15px] font-medium text-[#0A1519] mb-5">Portfolio Allocation</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {pieData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={PIE_COLORS[idx % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatUSD(Number(value))}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #E6EAEB",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const item = pieData.find((d) => d.name === value);
                    return <span className="text-xs text-[#4A5B60]">{value} - {item?.fullName ?? ""} ({formatPercent(item?.pct ?? 0)})</span>;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Holding"
      >
        <p className="text-sm text-[#4A5B60] mb-5">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-[#0A1519]">{deleteTarget?.ticker}</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 text-sm border border-[#E6EAEB] rounded-lg text-[#4A5B60] hover:bg-[#F2F5F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            className="px-4 py-2 text-sm text-white bg-[#E5484D] rounded-lg hover:bg-[#CC3B40] transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Add holding modal */}
      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          resetAddForm();
        }}
        title="Add Holding"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#4A5B60] mb-1.5">Ticker</label>
            <input
              type="text"
              value={addTicker}
              onChange={(e) => setAddTicker(e.target.value.toUpperCase())}
              placeholder="e.g. VOO"
              className={`w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#4A5B60] mb-1.5">Company Name</label>
            <input
              type="text"
              value={addCompany}
              onChange={(e) => setAddCompany(e.target.value)}
              placeholder="e.g. Vanguard S&P 500 ETF"
              className={`w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#4A5B60] mb-1.5">Shares</label>
            <input
              type="number"
              value={addShares}
              onChange={(e) => setAddShares(e.target.value)}
              placeholder="0"
              min="0"
              step="any"
              className={`w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#4A5B60] mb-1.5">Cost Basis per Share (USD)</label>
            <input
              type="number"
              value={addCost}
              onChange={(e) => setAddCost(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className={`w-full ${inputCls}`}
            />
          </div>

          {addError && <p className="text-sm text-[#E5484D]">{addError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setAddOpen(false);
                resetAddForm();
              }}
              className="px-4 py-2 text-sm border border-[#E6EAEB] rounded-lg text-[#4A5B60] hover:bg-[#F2F5F5] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={addSaving}
              className="px-4 py-2 text-sm text-white bg-[#025864] rounded-lg hover:bg-[#014750] transition-colors disabled:opacity-50"
            >
              {addSaving ? "Validating..." : "Add"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
