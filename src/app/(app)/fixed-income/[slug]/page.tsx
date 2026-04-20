"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { CardSkeleton, TableSkeleton } from "@/components/Skeleton";
import TableFilters from "@/components/TableFilters";
import { formatCOP, formatDate } from "@/lib/format";
import { computeCajitaBalance } from "@/lib/cajita";
import { useT } from "@/hooks/useT";

interface CajitaAccount {
  _id: string;
  slug: string;
  name: string;
  type: string;
  config: {
    annualRate: number;
    anchorBalance: number;
    anchorGrowth: number;
    anchorDate: string;
  };
}

interface Transaction {
  _id: string;
  date: string;
  amount: number;
  type: string;
  metadata: {
    amountDeposited?: number;
  };
  createdAt: string;
}

interface Deposit {
  _id: string;
  date: string;
  amountDeposited: number;
  isWithdrawal: boolean;
  createdAt: string;
}

const ITEMS_PER_PAGE = 10;

export default function CajitaPage() {
  const t = useT();
  const params = useParams();
  const slug = params.slug as string;
  const [account, setAccount] = useState<CajitaAccount | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [annualRate, setAnnualRate] = useState(0);
  const [page, setPage] = useState(1);

  // Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Deposit | null>(null);

  // Add form
  const [addDate, setAddDate] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addType, setAddType] = useState<"Deposit" | "Withdrawal">("Deposit");
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/accounts");
      const accounts: CajitaAccount[] = await res.json();
      const found = accounts.find((a) => a.slug === slug) ?? null;
      setAccount(found);
      if (found) setAnnualRate(found.config.annualRate);
      return found;
    } catch {
      console.error("Failed to fetch account");
      return null;
    }
  }, [slug]);

  const fetchDeposits = useCallback(async (slug?: string) => {
    const accountSlug = slug || account?.slug;
    if (!accountSlug) return;
    try {
      const res = await fetch(`/api/v2/transactions?account=${accountSlug}&limit=1000`);
      const json = await res.json();
      const transactions: Transaction[] = json.data || json;
      const mapped: Deposit[] = transactions.map((t) => ({
        _id: t._id,
        date: t.date,
        amountDeposited: Math.abs(t.metadata?.amountDeposited ?? t.amount),
        isWithdrawal: t.type === "Expense" || t.type === "Withdrawal" || (t.metadata?.amountDeposited ?? t.amount) < 0,
        createdAt: t.createdAt,
      }));
      setDeposits(mapped);
    } catch {
      console.error("Failed to fetch deposits");
    }
  }, [account?.slug]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const acct = await fetchAccount();
      if (acct) await fetchDeposits(acct.slug);
      setLoading(false);
    })();
  }, [fetchAccount, fetchDeposits]);

  const handleRateChange = async (value: string) => {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      setAnnualRate(parsed);
      if (account) {
        try {
          await fetch(`/api/v2/accounts/${account._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              config: { ...account.config, annualRate: parsed },
            }),
          });
          setAccount({
            ...account,
            config: { ...account.config, annualRate: parsed },
          });
        } catch {
          console.error("Failed to update rate");
        }
      }
    } else if (value === "") {
      setAnnualRate(0);
    }
  };

  const calculations = useMemo(() => {
    const dailyRate = Math.pow(1 + annualRate / 100, 1 / 365) - 1;
    const now = new Date();

    let totalPrincipal = 0;
    let totalBalance = 0;
    let totalInterest = 0; // solo interés de depósitos, retiros no lo afectan

    const enriched = deposits.map((d) => {
      const depositDate = new Date(d.date);
      const daysElapsed = Math.max(
        0,
        Math.floor(
          (now.getTime() - depositDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      if (d.isWithdrawal) {
        totalPrincipal -= d.amountDeposited;
        totalBalance -= d.amountDeposited;
        return { ...d, daysElapsed: 0, currentValue: -d.amountDeposited, accruedInterest: 0 };
      }

      const currentValue =
        d.amountDeposited * Math.pow(1 + dailyRate, daysElapsed);
      const accruedInterest = currentValue - d.amountDeposited;

      totalPrincipal += d.amountDeposited;
      totalBalance += currentValue;
      totalInterest += accruedInterest;

      return { ...d, daysElapsed, currentValue, accruedInterest };
    });

    return {
      enriched,
      totalPrincipal,
      totalBalance,
      totalInterest,
    };
  }, [deposits, annualRate]);

  const [search, setSearch] = useState("");

  const filteredDeposits = useMemo(() => {
    if (!search.trim()) return calculations.enriched;
    const q = search.toLowerCase();
    return calculations.enriched.filter((d) =>
      formatCOP(d.amountDeposited).toLowerCase().includes(q) ||
      formatDate(d.date).toLowerCase().includes(q)
    );
  }, [calculations.enriched, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDeposits.length / ITEMS_PER_PAGE));
  const paginatedDeposits = filteredDeposits.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  useEffect(() => { setPage(1); }, [search]);

  const handleAdd = async () => {
    setAddError("");
    if (!addDate) {
      setAddError("Date is required.");
      return;
    }
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      setAddError("Amount must be greater than 0.");
      return;
    }

    setAddSubmitting(true);
    try {
      const res = await fetch("/api/v2/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountSlug: account?.slug,
          date: addDate,
          description: addType === "Withdrawal" ? "Withdrawal" : "Deposit",
          amount,
          type: addType === "Withdrawal" ? "Expense" : "Deposit",
          metadata: { amountDeposited: addType === "Withdrawal" ? -amount : amount },
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      setAddModalOpen(false);
      setAddDate("");
      setAddAmount("");
      setAddType("Deposit");
      await fetchDeposits();
    } catch {
      setAddError("Failed to save. Please try again.");
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/v2/transactions/${deleteTarget._id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchDeposits();
    } catch {
      console.error("Failed to delete deposit");
    }
  };

  const startEdit = (d: Deposit) => {
    setEditingId(d._id);
    setEditDate(d.date.split("T")[0]);
    setEditAmount(String(d.amountDeposited));
  };

  const saveEdit = async (id: string) => {
    const amount = parseFloat(editAmount);
    if (!editDate || isNaN(amount) || amount <= 0) return;

    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/v2/transactions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editDate,
          amount,
          metadata: { amountDeposited: amount },
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingId(null);
      await fetchDeposits();
    } catch {
      console.error("Failed to update deposit");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Balance from transactions (reflects deposits/withdrawals), interest from anchor config (total growth)
  const anchorCalc = account
    ? computeCajitaBalance({
        annualRate: account.config.annualRate,
        anchorBalance: account.config.anchorBalance,
        anchorGrowth: account.config.anchorGrowth,
        anchorDate: account.config.anchorDate,
      })
    : { balance: 0, growth: 0 };

  const headerBalance = {
    balance: calculations.totalBalance,
    growth: anchorCalc.growth,
  };

  const inputCls = "border border-[#E6EAEB] rounded-lg px-3 py-2 text-sm text-[#0A1519] focus:outline-none focus:ring-1 focus:ring-[#025864] bg-white";
  const inputSmCls = "border border-[#E6EAEB] rounded-lg px-2 py-1 text-sm text-[#0A1519] focus:outline-none focus:ring-1 focus:ring-[#025864] bg-white";

  return (
    <div className="space-y-8">
      {/* Page Header with back link */}
      <div>
        <Link href="/fixed-income" className="inline-flex items-center gap-1 text-[13px] text-[#7A8B90] hover:text-[#0A1519] transition-colors mb-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t.fixedIncome.title}
        </Link>
        <h1 className="text-heading text-[#0A1519]">{account?.name || t.fixedIncome.title}</h1>
      </div>

      {/* Header Card Section */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Nu Branding Card */}
          <div className="rounded-xl border border-[#E6EAEB] p-6 flex flex-col items-center justify-center gap-3 bg-[#025864] text-white">
            <div className="w-10 h-10 border border-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-medium text-[15px]">{account?.name || t.fixedIncome.title}</span>
          </div>

          <Card>
            <p className="text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider mb-2">{t.fixedIncome.balance}</p>
            <p className="text-xl font-semibold text-[#0A1519] tabular-nums">
              {formatCOP(headerBalance.balance)}
            </p>
          </Card>

          <Card>
            <p className="text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider mb-2">{t.fixedIncome.totalAccrued}</p>
            <p className="text-xl font-semibold text-[#00A85A] tabular-nums">
              {formatCOP(headerBalance.growth)}
            </p>
          </Card>

          {/* Annual Rate */}
          <Card>
            <p className="text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider mb-2">Annual Rate (EA)</p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={annualRate}
                onChange={(e) => handleRateChange(e.target.value)}
                className={`w-20 text-xl font-semibold text-[#0A1519] ${inputSmCls} !py-1`}
              />
              <span className="text-xl font-semibold text-[#0A1519]">%</span>
            </div>
          </Card>
        </div>
      )}

      {/* Deposit History Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-medium text-[#0A1519]">
              {t.fixedIncome.deposit}
            </h2>
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-2 bg-[#025864] text-white text-sm font-medium rounded-lg hover:bg-[#014750] transition-colors"
            >
              {t.fixedIncome.addMovement}
            </button>
          </div>

          <TableFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t.fixedIncome.searchPlaceholder}
          />

          <div className="overflow-x-auto -mx-5 md:-mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E6EAEB] text-left">
                  <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider">{t.common.date}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider">{t.common.amount}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider">{t.fixedIncome.daysElapsed}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider">{t.fixedIncome.accruedInterest}</th>
                  <th className="px-3 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider">{t.fixedIncome.currentValue}</th>
                  <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#7A8B90] text-sm">
                      {search ? t.fixedIncome.noDeposits : t.fixedIncome.noDeposits}
                    </td>
                  </tr>
                ) : (
                  paginatedDeposits.map((d) => (
                    <tr
                      key={d._id}
                      className="border-t border-[#EEF1F1] hover:bg-[#F4F9FA] transition-colors"
                    >
                      {editingId === d._id ? (
                        <>
                          <td className="px-5 md:px-6 py-3">
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className={`${inputSmCls} w-full`}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="1"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className={`${inputSmCls} w-28`}
                            />
                          </td>
                          <td className="px-3 py-3 text-[#7A8B90] text-[13px] tabular-nums">
                            {d.daysElapsed}
                          </td>
                          <td className="px-3 py-3 text-[#00A85A] text-[13px] tabular-nums">
                            {formatCOP(d.accruedInterest)}
                          </td>
                          <td className="px-3 py-3 font-medium text-[13px] tabular-nums">
                            {formatCOP(d.currentValue)}
                          </td>
                          <td className="px-5 md:px-6 py-3 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => saveEdit(d._id)}
                                disabled={editSubmitting}
                                className="text-[13px] font-medium text-[#0A1519] hover:underline disabled:opacity-50"
                              >
                                {editSubmitting ? "..." : t.common.save}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-[13px] text-[#7A8B90] hover:underline"
                              >
                                {t.common.cancel}
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 md:px-6 py-3.5 text-[13px] text-[#4A5B60] tabular-nums">{formatDate(d.date)}</td>
                          <td className="px-3 py-3.5 text-[13px] tabular-nums">
                            <div className="flex items-center gap-2">
                              <span className={d.isWithdrawal ? "text-[#E5484D]" : "text-[#0A1519]"}>
                                {d.isWithdrawal ? "−" : "+"}{formatCOP(d.amountDeposited)}
                              </span>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${d.isWithdrawal ? "bg-[#FDEDEE] text-[#E5484D]" : "bg-[#E6FBF2] text-[#00A85A]"}`}>
                                {d.isWithdrawal ? t.fixedIncome.withdrawal : t.fixedIncome.deposit}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-[13px] text-[#7A8B90] tabular-nums">
                            {d.isWithdrawal ? "—" : d.daysElapsed}
                          </td>
                          <td className="px-3 py-3.5 text-[13px] text-[#00A85A] tabular-nums">
                            {d.isWithdrawal ? "—" : formatCOP(d.accruedInterest)}
                          </td>
                          <td className="px-3 py-3.5 text-[13px] font-medium tabular-nums">
                            {d.isWithdrawal ? <span className="text-[#E5484D]">−{formatCOP(d.amountDeposited)}</span> : formatCOP(d.currentValue)}
                          </td>
                          <td className="px-5 md:px-6 py-3.5 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => startEdit(d)}
                                className="text-[13px] text-[#4A5B60] hover:text-[#0A1519] hover:underline"
                              >
                                {t.common.edit}
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteTarget(d);
                                  setDeleteModalOpen(true);
                                }}
                                className="text-[13px] text-[#E5484D] hover:underline"
                              >
                                {t.common.delete}
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </Card>
      )}

      {/* Add Deposit / Withdrawal Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setAddError("");
          setAddType("Deposit");
        }}
        title={t.fixedIncome.addMovement}
      >
        <div className="space-y-4">
          {/* Type toggle */}
          <div className="flex rounded-lg border border-[#E6EAEB] overflow-hidden">
            <button
              onClick={() => setAddType("Deposit")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${addType === "Deposit" ? "bg-[#025864] text-white" : "text-[#4A5B60] hover:bg-[#F2F5F5]"}`}
            >
              {t.fixedIncome.deposit}
            </button>
            <button
              onClick={() => setAddType("Withdrawal")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${addType === "Withdrawal" ? "bg-[#E5484D] text-white" : "text-[#4A5B60] hover:bg-[#F2F5F5]"}`}
            >
              {t.fixedIncome.withdrawal}
            </button>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#4A5B60] mb-1.5">{t.common.date}</label>
            <input
              type="date"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
              className={`w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#4A5B60] mb-1.5">{t.common.amount}</label>
            <input
              type="number"
              min="1"
              placeholder="0"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              className={`w-full ${inputCls}`}
            />
          </div>
          {addError && <p className="text-[#E5484D] text-sm">{addError}</p>}
          <button
            onClick={handleAdd}
            disabled={addSubmitting}
            className={`w-full py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-sm ${addType === "Withdrawal" ? "bg-[#E5484D] hover:bg-[#CC3B40]" : "bg-[#025864] hover:bg-[#014750]"}`}
          >
            {addSubmitting ? t.common.saving : addType === "Withdrawal" ? t.fixedIncome.addWithdrawal : t.fixedIncome.addDeposit}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        title={t.fixedIncome.confirmDelete}
      >
        <div className="space-y-5">
          <p className="text-sm text-[#4A5B60]">
            {t.fixedIncome.deleteConfirmText}{" "}
            <span className="font-semibold text-[#0A1519]">
              {deleteTarget ? formatCOP(deleteTarget.amountDeposited) : ""}
            </span>{" "}
            {t.fixedIncome.deleteConfirmFrom}{" "}
            <span className="font-semibold text-[#0A1519]">
              {deleteTarget ? formatDate(deleteTarget.date) : ""}
            </span>
            ?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteTarget(null);
              }}
              className="px-4 py-2 border border-[#E6EAEB] rounded-lg text-sm font-medium text-[#4A5B60] hover:bg-[#F2F5F5] transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-[#E5484D] text-white rounded-lg text-sm font-medium hover:bg-[#CC3B40] transition-colors"
            >
              {t.common.delete}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
