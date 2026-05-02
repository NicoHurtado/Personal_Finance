"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { formatUSD, formatCOP } from "@/lib/format";
import { useT } from "@/hooks/useT";

// ── Types ──────────────────────────────────────────────────────────────
interface Asset {
  ticker: string;
  name: string;
  percentage: number;
  groupId?: string;
}

interface GroupTicker {
  ticker: string;
  weight: number;
}

interface Group {
  id: string;
  name: string;
  percentage: number;
  tickers: GroupTicker[];
}

interface SearchResult {
  ticker: string;
  name: string;
  type: string;
  exchange: string;
}

interface Props {
  accountId: string;
}

const GROUP_COLORS = [
  "#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444",
  "#EC4899", "#6366F1", "#14B8A6", "#F97316", "#84CC16",
];

const PIE_COLORS = [
  "var(--c-brand)", "var(--c-grad2)", "#0A5A7A", "var(--c-text-2)",
  "var(--c-grad1)", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444",
  "#EC4899", "#6366F1", "#14B8A6",
];

// ── Component ──────────────────────────────────────────────────────────
export default function PortfolioCalculator({ accountId }: Props) {
  const t = useT();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [amount, setAmount] = useState("");
  const [trm, setTrm] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // ── Load saved config ────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`/api/portfolio-config?accountId=${accountId}`).then((r) => r.json()),
      fetch("/api/trm").then((r) => r.json()),
    ]).then(([config, trmData]) => {
      if (config.assets?.length) setAssets(config.assets);
      if (config.groups?.length) setGroups(config.groups);
      setTrm(trmData.rate || 4200);
      setLoaded(true);
    });
  }, [accountId]);

  // ── Auto-save ────────────────────────────────────────────────────────
  const saveTimeout = useRef<NodeJS.Timeout>();
  const save = useCallback(
    (a: Asset[], g: Group[]) => {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        fetch("/api/portfolio-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, assets: a, groups: g }),
        });
      }, 800);
    },
    [accountId]
  );

  // ── Search ticker ────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
  }, [searchQuery]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────
  const totalPct = useMemo(() => {
    const ungrouped = assets.filter((a) => !a.groupId).reduce((s, a) => s + a.percentage, 0);
    const grouped = groups.reduce((s, g) => s + g.percentage, 0);
    return Math.round((ungrouped + grouped) * 100) / 100;
  }, [assets, groups]);

  const pctDiff = Math.round((100 - totalPct) * 100) / 100;

  function addAsset(ticker: string, name: string) {
    if (assets.some((a) => a.ticker === ticker)) return;
    const next = [...assets, { ticker, name, percentage: 0 }];
    setAssets(next);
    save(next, groups);
    setSearchQuery("");
    setShowSearch(false);
  }

  function removeAsset(ticker: string) {
    const asset = assets.find((a) => a.ticker === ticker);
    let nextAssets = assets.filter((a) => a.ticker !== ticker);
    let nextGroups = [...groups];

    if (asset?.groupId) {
      nextGroups = nextGroups.map((g) => {
        if (g.id !== asset.groupId) return g;
        const remaining = g.tickers.filter((t) => t.ticker !== ticker);
        if (remaining.length === 0) return g;
        const totalWeight = remaining.reduce((s, t) => s + t.weight, 0);
        return {
          ...g,
          tickers: remaining.map((t) => ({ ...t, weight: (t.weight / totalWeight) * 100 })),
        };
      }).filter((g) => g.tickers.length > 0 || nextAssets.some((a) => a.groupId === g.id));
    } else {
      // Redistribute ungrouped proportionally
      const remainingUngrouped = nextAssets.filter((a) => !a.groupId);
      const removedPct = asset?.percentage || 0;
      if (remainingUngrouped.length > 0 && removedPct > 0) {
        const totalRemaining = remainingUngrouped.reduce((s, a) => s + a.percentage, 0);
        if (totalRemaining > 0) {
          nextAssets = nextAssets.map((a) => {
            if (a.groupId) return a;
            return { ...a, percentage: a.percentage + (a.percentage / totalRemaining) * removedPct };
          });
        } else {
          const share = removedPct / remainingUngrouped.length;
          nextAssets = nextAssets.map((a) => {
            if (a.groupId) return a;
            return { ...a, percentage: a.percentage + share };
          });
        }
      }
    }

    // Clean up empty groups
    nextGroups = nextGroups.filter((g) => {
      const groupAssets = nextAssets.filter((a) => a.groupId === g.id);
      return groupAssets.length > 0;
    });

    setAssets(nextAssets);
    setGroups(nextGroups);
    save(nextAssets, nextGroups);
  }

  function updateAssetPct(ticker: string, pct: number) {
    const next = assets.map((a) => (a.ticker === ticker ? { ...a, percentage: pct } : a));
    setAssets(next);
    save(next, groups);
  }

  function updateGroupPct(groupId: string, pct: number) {
    const next = groups.map((g) => (g.id === groupId ? { ...g, percentage: pct } : g));
    setGroups(next);
    save(assets, next);
  }

  function updateGroupTickerWeight(groupId: string, ticker: string, weight: number) {
    const next = groups.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, tickers: g.tickers.map((t) => (t.ticker === ticker ? { ...t, weight } : t)) };
    });
    setGroups(next);
    save(assets, next);
  }

  function createGroup(name: string) {
    const id = `grp_${Date.now()}`;
    const next = [...groups, { id, name, percentage: 0, tickers: [] }];
    setGroups(next);
    save(assets, next);
    setShowGroupModal(false);
    setNewGroupName("");
  }

  function deleteGroup(groupId: string) {
    const nextAssets = assets.map((a) => (a.groupId === groupId ? { ...a, groupId: undefined, percentage: 0 } : a));
    const nextGroups = groups.filter((g) => g.id !== groupId);
    setAssets(nextAssets);
    setGroups(nextGroups);
    save(nextAssets, nextGroups);
  }

  function moveToGroup(ticker: string, groupId: string) {
    const asset = assets.find((a) => a.ticker === ticker);
    if (!asset) return;

    // Remove from old group if any
    let nextGroups = groups.map((g) => {
      if (asset.groupId && g.id === asset.groupId) {
        const remaining = g.tickers.filter((t) => t.ticker !== ticker);
        const totalWeight = remaining.reduce((s, t) => s + t.weight, 0);
        return {
          ...g,
          tickers: remaining.length > 0
            ? remaining.map((t) => ({ ...t, weight: totalWeight > 0 ? (t.weight / totalWeight) * 100 : 100 / remaining.length }))
            : [],
        };
      }
      return g;
    });

    // Add to new group
    nextGroups = nextGroups.map((g) => {
      if (g.id !== groupId) return g;
      const newTickers = [...g.tickers, { ticker, weight: 0 }];
      const equalWeight = 100 / newTickers.length;
      return { ...g, tickers: newTickers.map((t) => ({ ...t, weight: equalWeight })) };
    });

    const nextAssets = assets.map((a) =>
      a.ticker === ticker ? { ...a, groupId, percentage: 0 } : a
    );

    // Clean empty groups
    nextGroups = nextGroups.filter((g) => g.tickers.length > 0 || nextAssets.some((a) => a.groupId === g.id));

    setAssets(nextAssets);
    setGroups(nextGroups);
    save(nextAssets, nextGroups);
  }

  function removeFromGroup(ticker: string) {
    const asset = assets.find((a) => a.ticker === ticker);
    if (!asset?.groupId) return;

    let nextGroups = groups.map((g) => {
      if (g.id !== asset.groupId) return g;
      const remaining = g.tickers.filter((t) => t.ticker !== ticker);
      const totalWeight = remaining.reduce((s, t) => s + t.weight, 0);
      return {
        ...g,
        tickers: remaining.length > 0
          ? remaining.map((t) => ({ ...t, weight: totalWeight > 0 ? (t.weight / totalWeight) * 100 : 100 / remaining.length }))
          : [],
      };
    });

    nextGroups = nextGroups.filter((g) => g.tickers.length > 0);

    const nextAssets = assets.map((a) =>
      a.ticker === ticker ? { ...a, groupId: undefined, percentage: 0 } : a
    );

    setAssets(nextAssets);
    setGroups(nextGroups);
    save(nextAssets, nextGroups);
  }

  // ── Build results table data ─────────────────────────────────────────
  const investAmount = parseFloat(amount) || 0;

  const tableRows = useMemo(() => {
    const rows: { ticker: string; name: string; pct: number; usd: number; cop: number; groupName?: string; groupColor?: string }[] = [];

    // Ungrouped assets
    for (const a of assets.filter((a) => !a.groupId)) {
      rows.push({
        ticker: a.ticker,
        name: a.name,
        pct: a.percentage,
        usd: (a.percentage / 100) * investAmount,
        cop: (a.percentage / 100) * investAmount * trm,
      });
    }

    // Grouped assets
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const groupAssets = assets.filter((a) => a.groupId === g.id);
      const groupColor = GROUP_COLORS[gi % GROUP_COLORS.length];

      for (const ga of groupAssets) {
        const gt = g.tickers.find((t) => t.ticker === ga.ticker);
        const weight = gt?.weight || 0;
        const effectivePct = (g.percentage * weight) / 100;
        rows.push({
          ticker: ga.ticker,
          name: ga.name,
          pct: Math.round(effectivePct * 100) / 100,
          usd: (effectivePct / 100) * investAmount,
          cop: (effectivePct / 100) * investAmount * trm,
          groupName: g.name,
          groupColor,
        });
      }
    }

    return rows;
  }, [assets, groups, investAmount, trm]);

  // ── Pie data ─────────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    return tableRows
      .filter((r) => r.pct > 0)
      .map((r) => ({
        name: r.ticker,
        fullName: r.name,
        value: r.pct,
        usd: r.usd,
        cop: r.cop,
        groupName: r.groupName,
        groupColor: r.groupColor,
      }));
  }, [tableRows]);

  const inputCls =
    "border border-[var(--c-border)] rounded-lg px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] bg-card w-full";

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[var(--c-brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const calc = (t as any).calculator || {};

  return (
    <div className="space-y-6">
      {/* Search + Add */}
      <div className="bg-card rounded-2xl border border-[var(--c-border)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-medium text-[var(--c-text)]">
            {calc.assets || "Portfolio Assets"}
          </h2>
          <button
            onClick={() => setShowGroupModal(true)}
            className="px-3 py-1.5 text-xs font-medium text-[var(--c-brand)] border border-[var(--c-brand)] rounded-lg hover:bg-[var(--c-brand)] hover:text-white transition-colors"
          >
            + {calc.newGroup || "New Group"}
          </button>
        </div>

        {/* Ticker search */}
        <div ref={searchRef} className="relative mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            placeholder={calc.searchTicker || "Search ticker (e.g. VOO, AAPL)..."}
            className={inputCls}
          />
          {showSearch && (searchResults.length > 0 || searching) && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-[var(--c-border)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searching && (
                <div className="px-4 py-3 text-sm text-[var(--c-text-3)]">{calc.searching || "Searching..."}</div>
              )}
              {searchResults.map((r) => {
                const alreadyAdded = assets.some((a) => a.ticker === r.ticker);
                return (
                  <button
                    key={r.ticker}
                    onClick={() => !alreadyAdded && addAsset(r.ticker, r.name)}
                    disabled={alreadyAdded}
                    className="w-full px-4 py-2.5 text-left hover:bg-[var(--c-surface)] transition-colors flex items-center justify-between disabled:opacity-40"
                  >
                    <div>
                      <span className="text-sm font-medium text-[var(--c-text)]">{r.ticker}</span>
                      <span className="text-xs text-[var(--c-text-3)] ml-2">{r.name}</span>
                    </div>
                    <span className="text-[10px] text-[var(--c-text-3)] uppercase">{r.type}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Percentage status */}
        <div className={`text-xs font-medium mb-4 px-1 ${totalPct === 100 ? "text-[var(--c-income)]" : "text-[var(--c-expense)]"}`}>
          {totalPct === 100
            ? (calc.perfectBalance || "100% — Balanced")
            : pctDiff > 0
              ? `${calc.remaining || "Remaining"}: ${pctDiff}%`
              : `${calc.excess || "Excess"}: ${Math.abs(pctDiff)}%`}
        </div>

        {/* Ungrouped assets */}
        {assets.filter((a) => !a.groupId).length > 0 && (
          <div className="space-y-2 mb-4">
            {assets
              .filter((a) => !a.groupId)
              .map((a) => (
                <div key={a.ticker} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--c-surface)] group">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[var(--c-text)]">{a.ticker}</span>
                    <span className="text-xs text-[var(--c-text-3)] ml-2 truncate">{a.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {groups.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => e.target.value && moveToGroup(a.ticker, e.target.value)}
                        className="text-[10px] bg-transparent border border-[var(--c-border)] rounded px-1 py-0.5 text-[var(--c-text-3)]"
                      >
                        <option value="">{calc.moveToGroup || "Move to group..."}</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="number"
                      value={a.percentage || ""}
                      onChange={(e) => updateAssetPct(a.ticker, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-16 text-right text-sm border border-[var(--c-border)] rounded-lg px-2 py-1 bg-card text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)]"
                    />
                    <span className="text-xs text-[var(--c-text-3)]">%</span>
                    <button
                      onClick={() => removeAsset(a.ticker)}
                      className="text-[var(--c-text-3)] hover:text-[var(--c-expense)] transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Groups */}
        {groups.map((g, gi) => {
          const groupAssets = assets.filter((a) => a.groupId === g.id);
          const color = GROUP_COLORS[gi % GROUP_COLORS.length];
          return (
            <div key={g.id} className="mb-4 rounded-xl border border-[var(--c-border)] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderLeft: `3px solid ${color}` }}>
                <div className="flex-1">
                  <span className="text-sm font-medium text-[var(--c-text)]">{g.name}</span>
                  <span className="text-xs text-[var(--c-text-3)] ml-2">({groupAssets.length} {calc.tickers || "tickers"})</span>
                </div>
                <input
                  type="number"
                  value={g.percentage || ""}
                  onChange={(e) => updateGroupPct(g.id, parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.5"
                  className="w-16 text-right text-sm border border-[var(--c-border)] rounded-lg px-2 py-1 bg-card text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)]"
                />
                <span className="text-xs text-[var(--c-text-3)]">%</span>
                <button
                  onClick={() => deleteGroup(g.id)}
                  className="text-[var(--c-text-3)] hover:text-[var(--c-expense)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {groupAssets.length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                  {groupAssets.map((a) => {
                    const gt = g.tickers.find((t) => t.ticker === a.ticker);
                    return (
                      <div key={a.ticker} className="flex items-center gap-3 py-1.5 pl-3 group">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-[var(--c-text)]">{a.ticker}</span>
                          <span className="text-[11px] text-[var(--c-text-3)] ml-1.5">{a.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[var(--c-text-3)]">{calc.weight || "Weight"}:</span>
                          <input
                            type="number"
                            value={gt?.weight ? Math.round(gt.weight * 100) / 100 : ""}
                            onChange={(e) => updateGroupTickerWeight(g.id, a.ticker, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            max="100"
                            step="0.5"
                            className="w-14 text-right text-xs border border-[var(--c-border)] rounded px-1.5 py-0.5 bg-card text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)]"
                          />
                          <span className="text-[10px] text-[var(--c-text-3)]">%</span>
                          <button
                            onClick={() => removeFromGroup(a.ticker)}
                            className="text-[var(--c-text-3)] hover:text-[var(--c-text)] transition-colors opacity-0 group-hover:opacity-100 text-[10px]"
                            title={calc.removeFromGroup || "Remove from group"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeAsset(a.ticker)}
                            className="text-[var(--c-text-3)] hover:text-[var(--c-expense)] transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {groupAssets.length === 0 && (
                <p className="px-4 pb-3 text-xs text-[var(--c-text-3)]">
                  {calc.emptyGroup || "No tickers in this group. Search and add tickers, then move them here."}
                </p>
              )}
            </div>
          );
        })}

        {assets.length === 0 && (
          <p className="text-sm text-[var(--c-text-3)] text-center py-6">
            {calc.noAssets || "No assets yet. Search for a ticker above to get started."}
          </p>
        )}
      </div>

      {/* Amount input */}
      <div className="bg-card rounded-2xl border border-[var(--c-border)] p-5">
        <h2 className="text-[15px] font-medium text-[var(--c-text)] mb-4">
          {calc.investmentAmount || "Investment Amount"}
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-1.5">
              {calc.amountUSD || "Amount (USD)"}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-1.5">
              {calc.equivalentCOP || "Equivalent (COP)"}
            </label>
            <p className="text-sm text-[var(--c-text)] py-2 px-3 bg-[var(--c-surface)] rounded-lg tabular-nums">
              {formatCOP(investAmount * trm)}
            </p>
          </div>
        </div>
        {trm > 0 && (
          <p className="text-[11px] text-[var(--c-text-3)] mt-2">
            TRM: {formatCOP(trm)} / 1 USD
          </p>
        )}
      </div>

      {/* Results table */}
      {assets.length > 0 && (
        <div className="bg-card rounded-2xl border border-[var(--c-border)] p-5">
          <h2 className="text-[15px] font-medium text-[var(--c-text)] mb-4">
            {calc.distribution || "Distribution"}
          </h2>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--c-border)] text-left">
                  <th className="px-5 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{calc.asset || "Asset"}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{calc.group || "Group"}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">%</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">USD</th>
                  <th className="px-5 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">COP</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.ticker} className="border-t border-[var(--c-border-2)] hover:bg-[var(--c-surface-2)] transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-medium text-[var(--c-text)] text-[13px]">{r.ticker}</span>
                      <span className="text-xs text-[var(--c-text-3)] ml-2">{r.name}</span>
                    </td>
                    <td className="px-3 py-3">
                      {r.groupName && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: `${r.groupColor}22`, color: r.groupColor }}
                        >
                          {r.groupName}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums text-[var(--c-text)]">{r.pct.toFixed(2)}%</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums text-[var(--c-text)]">{formatUSD(r.usd)}</td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums text-[var(--c-text)]">{formatCOP(r.cop)}</td>
                  </tr>
                ))}
                {tableRows.length > 0 && (
                  <tr className="border-t-2 border-[var(--c-border)] font-semibold">
                    <td className="px-5 py-3 text-[13px] text-[var(--c-text)]">Total</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums text-[var(--c-text)]">{totalPct.toFixed(2)}%</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums text-[var(--c-text)]">
                      {formatUSD(tableRows.reduce((s, r) => s + r.usd, 0))}
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums text-[var(--c-text)]">
                      {formatCOP(tableRows.reduce((s, r) => s + r.cop, 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div className="bg-card rounded-2xl border border-[var(--c-border)] p-5">
          <h2 className="text-[15px] font-medium text-[var(--c-text)] mb-5">
            {calc.chart || "Distribution Chart"}
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
                  {pieData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.groupColor || PIE_COLORS[idx % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: any, name: any) => {
                    const item = pieData.find((d) => d.name === name);
                    return [
                      `${Number(value).toFixed(2)}% — ${formatUSD(item?.usd || 0)}`,
                      item?.fullName || name,
                    ];
                  }) as any}
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
                        {value} ({item?.value.toFixed(1)}%)
                      </span>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Group creation modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center" onClick={() => setShowGroupModal(false)}>
          <div className="bg-card w-full max-w-sm rounded-xl border border-[var(--c-border)] p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-medium text-[var(--c-text)] mb-4">
              {calc.createGroup || "Create Group"}
            </h3>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={calc.groupNamePlaceholder || "e.g. Tech, Individual Stocks"}
              className={inputCls}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newGroupName.trim()) createGroup(newGroupName.trim());
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowGroupModal(false); setNewGroupName(""); }}
                className="px-4 py-2 text-sm border border-[var(--c-border)] rounded-lg text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors"
              >
                {(t as any).common?.cancel || "Cancel"}
              </button>
              <button
                onClick={() => newGroupName.trim() && createGroup(newGroupName.trim())}
                disabled={!newGroupName.trim()}
                className="px-4 py-2 text-sm text-white bg-[var(--c-brand)] rounded-lg hover:bg-[var(--c-brand-hov)] transition-colors disabled:opacity-50"
              >
                {calc.create || "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
