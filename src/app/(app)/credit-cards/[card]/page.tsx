"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import TableFilters from "@/components/TableFilters";
import { TableSkeleton, CardSkeleton } from "@/components/Skeleton";
import { formatCOP, formatDate } from "@/lib/format";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useT } from "@/hooks/useT";
import { useLangStore } from "@/store/langStore";

interface Transaction {
  _id: string;
  date: string;
  description: string;
  amount: number;
  type: "Expense" | "Payment";
  categoryId?: string;
}

interface Category {
  _id: string;
  name: string;
  color: string;
  key?: string;
}

interface Account {
  _id: string;
  slug: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  config?: {
    creditLimit?: number;
    billingCutoffDay?: number;
  };
}

function cardKeyToSlug(cardKey: string): string {
  return `${cardKey}-tc`;
}

function toInputDate(d: string) {
  return new Date(d).toISOString().slice(0, 10);
}

function monthOptions(locale = "en-US") {
  const now = new Date();
  const opts: { label: string; value: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString(locale, { month: "long", year: "numeric" });
    opts.push({ label, value });
  }
  return opts;
}

export default function CardDetailPage() {
  const t = useT();
  const { lang } = useLangStore();
  const locale = lang === "es" ? "es-CO" : "en-US";
  const params = useParams();
  const cardKey = params.card as string;
  const accountSlug = cardKeyToSlug(cardKey);

  const [account, setAccount] = useState<Account | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTxs, setAllTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", description: "", amount: "", type: "Expense" as "Expense" | "Payment" });

  const [addForm, setAddForm] = useState({ date: "", description: "", amount: "", type: "Expense" as "Expense" | "Payment", categoryId: "" });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c._id, c])), [categories]);

  const balance = allTxs.reduce((s, t) => s + t.amount, 0);
  const creditLimit = account?.config?.creditLimit ?? 0;
  const billingCutoffDay = account?.config?.billingCutoffDay ?? 3;
  const available = creditLimit + balance;

  const filteredTxs = useMemo(() => {
    let filtered = [...allTxs];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t) => t.description.toLowerCase().includes(q));
    }
    if (typeFilter) {
      filtered = filtered.filter((t) => t.type === typeFilter);
    }
    if (catFilter) {
      if (catFilter === "__uncategorized") {
        filtered = filtered.filter((t) => !t.categoryId);
      } else {
        filtered = filtered.filter((t) => t.categoryId === catFilter);
      }
    }
    return filtered;
  }, [allTxs, search, typeFilter, catFilter]);

  const ITEMS_PER_PAGE = 10;
  const [clientPage, setClientPage] = useState(1);
  const clientTotalPages = Math.max(1, Math.ceil(filteredTxs.length / ITEMS_PER_PAGE));
  const clientPaged = filteredTxs.slice((clientPage - 1) * ITEMS_PER_PAGE, clientPage * ITEMS_PER_PAGE);

  useEffect(() => { setClientPage(1); }, [search, typeFilter, catFilter]);

  const fetchAllTxs = useCallback(async () => {
    if (!accountSlug) return;
    try {
      const res = await fetch(`/api/v2/transactions?account=${accountSlug}&limit=1000`);
      const json = await res.json();
      setAllTxs(json.data || []);
    } catch (e) {
      console.error(e);
    }
  }, [accountSlug]);

  const fetchAccountAndCategories = useCallback(async () => {
    if (!accountSlug) return;
    try {
      const [accountsRes, catsRes] = await Promise.all([
        fetch("/api/v2/accounts"),
        fetch("/api/v2/categories"),
      ]);
      const accounts: Account[] = await accountsRes.json();
      const cats: Category[] = await catsRes.json();
      const found = accounts.find((a) => a.slug === accountSlug);
      setAccount(found || null);
      setCategories(cats);
    } catch (e) {
      console.error(e);
    }
  }, [accountSlug]);

  useEffect(() => {
    if (!accountSlug) return;
    (async () => {
      setLoading(true);
      await Promise.all([fetchAccountAndCategories(), fetchAllTxs()]);
      setLoading(false);
    })();
  }, [accountSlug, fetchAccountAndCategories, fetchAllTxs]);

  const refresh = () => { fetchAllTxs(); };

  const handleCategoryChange = async (txId: string, catId: string) => {
    try {
      await fetch(`/api/v2/transactions/${txId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: catId || null }),
      });
      await fetchAllTxs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!addForm.date) errs.date = t.creditCards.errorDateRequired;
    if (!addForm.description.trim()) errs.description = t.creditCards.errorDescriptionRequired;
    if (!addForm.amount || parseFloat(addForm.amount) <= 0) errs.amount = t.creditCards.errorAmountRequired;
    if (!addForm.type) errs.type = t.creditCards.errorDateRequired;
    setAddErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      await fetch("/api/v2/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountSlug,
          date: addForm.date,
          description: addForm.description,
          amount: parseFloat(addForm.amount),
          type: addForm.type,
          categoryId: addForm.categoryId || undefined,
        }),
      });
      setAddOpen(false);
      setAddForm({ date: "", description: "", amount: "", type: "Expense", categoryId: "" });
      setAddErrors({});
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/v2/transactions/${deleteTarget._id}`, { method: "DELETE" });
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (tx: Transaction) => {
    setEditingId(tx._id);
    setEditForm({
      date: toInputDate(tx.date),
      description: tx.description,
      amount: String(Math.abs(tx.amount)),
      type: tx.type,
    });
  };

  const saveEdit = async (txId: string) => {
    try {
      await fetch(`/api/v2/transactions/${txId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editForm.date,
          description: editForm.description,
          amount: parseFloat(editForm.amount),
          type: editForm.type,
        }),
      });
      setEditingId(null);
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const [selYear, selMo] = selectedMonth.split("-").map(Number);
  const pieExpenses = allTxs.filter((t) => {
    if (t.type !== "Expense") return false;
    const d = new Date(t.date);
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMo;
  });

  const catTotals: Record<string, number> = {};
  pieExpenses.forEach((t) => {
    const key = t.categoryId || "__uncategorized";
    catTotals[key] = (catTotals[key] || 0) + Math.abs(t.amount);
  });

  const catTranslations = t.categories as Record<string, string>;
  const pieData = Object.entries(catTotals).map(([key, value]) => {
    const cat = catMap[key];
    const name = key === "__uncategorized"
      ? t.creditCards.uncategorized
      : (cat?.key ? (catTranslations[cat.key] ?? cat.name) : (cat?.name || t.creditCards.uncategorized));
    return { name, value, color: key === "__uncategorized" ? "var(--c-uncat)" : (cat?.color || "var(--c-uncat)") };
  });

  const now = new Date();
  const cutoffMonth = now.getDate() >= billingCutoffDay ? now.getMonth() + 1 : now.getMonth();
  const cutoffYear = cutoffMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
  const nextCutoff = new Date(cutoffYear, cutoffMonth > 11 ? 0 : cutoffMonth, billingCutoffDay);
  const cutoffStr = nextCutoff.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });

  const title = account?.name || cardKey;

  if (loading) {
    return (
      <div>
        <h1 className="text-heading text-[var(--c-text)] mb-6">{title}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  const inputCls = "border border-[var(--c-border)] rounded-lg px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] bg-card";
  const inputSmCls = "border border-[var(--c-border)] rounded-lg px-2 py-1 text-sm text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] bg-card";

  return (
    <div className="space-y-8">
      <h1 className="text-heading text-[var(--c-text)]">{title}</h1>

      {/* Header info row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-2">{t.creditCards.currentBalance}</p>
          <p className={`text-2xl font-semibold tabular-nums ${balance < 0 ? "text-[var(--c-expense)]" : "text-[var(--c-income)]"}`}>
            {formatCOP(balance)}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-2">{t.creditCards.availableCredit}</p>
          <p className={`text-2xl font-semibold tabular-nums ${available >= 0 ? "text-[var(--c-income)]" : "text-[var(--c-expense)]"}`}>
            {formatCOP(available)}
          </p>
          <p className="text-[11px] text-[var(--c-text-3)] mt-1">
            {t.creditCards.limit}: {formatCOP(creditLimit)}
            <span className="mx-2 text-[var(--c-sep)]">·</span>
            {t.creditCards.billingCutoffDate}: {cutoffStr}
          </p>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-2">
          <h2 className="text-[15px] font-medium text-[var(--c-text)]">{t.creditCards.transactions}</h2>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-[var(--c-brand)] text-white rounded-lg hover:bg-[var(--c-brand-hov)] transition-colors"
          >
            {t.creditCards.addTransaction}
          </button>
        </div>

        <TableFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t.creditCards.searchPlaceholder}
          filterValue={typeFilter}
          onFilterChange={setTypeFilter}
          filterOptions={[
            { label: t.creditCards.expense, value: "Expense" },
            { label: t.creditCards.payment, value: "Payment" },
          ]}
          filterLabel={t.creditCards.allTypes}
        />
        <div className="flex items-center gap-2 mb-4">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="px-3 py-2 text-sm text-[var(--c-text)] bg-card border border-[var(--c-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)]"
          >
            <option value="">{t.creditCards.allCategories}</option>
            <option value="__uncategorized">{t.creditCards.uncategorized}</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.key ? (catTranslations[c.key] ?? c.name) : c.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto -mx-5 md:-mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--c-border)]">
                <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{t.creditCards.date}</th>
                <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{t.creditCards.description}</th>
                <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{t.creditCards.amount}</th>
                <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{t.creditCards.type}</th>
                <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{t.creditCards.category}</th>
                <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{t.creditCards.actions}</th>
              </tr>
            </thead>
            <tbody>
              {clientPaged.map((tx) => (
                <tr key={tx._id} className="border-t border-[var(--c-border-2)] hover:bg-[var(--c-surface-2)] transition-colors">
                  {editingId === tx._id ? (
                    <>
                      <td className="px-5 md:px-6 py-3">
                        <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          className={`${inputSmCls} w-32`} />
                      </td>
                      <td className="px-3 py-3">
                        <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className={`${inputSmCls} w-full`} />
                      </td>
                      <td className="px-3 py-3">
                        <input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                          className={`${inputSmCls} w-24`} />
                      </td>
                      <td className="px-3 py-3">
                        <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as "Expense" | "Payment" })}
                          className={inputSmCls}>
                          <option value="Expense">{t.creditCards.expense}</option>
                          <option value="Payment">{t.creditCards.payment}</option>
                        </select>
                      </td>
                      <td className="px-3 py-3" />
                      <td className="px-5 md:px-6 py-3 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => saveEdit(tx._id)} className="px-2.5 py-1 text-xs bg-[var(--c-brand)] text-white rounded-lg hover:bg-[var(--c-brand-hov)]">{t.common.save}</button>
                          <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-xs border border-[var(--c-border)] rounded-lg text-[var(--c-text-2)] hover:bg-[var(--c-surface)]">{t.common.cancel}</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 md:px-6 py-3.5 whitespace-nowrap text-[13px] text-[var(--c-text-2)] tabular-nums">{formatDate(tx.date)}</td>
                      <td className="px-3 py-3.5 text-[13px] text-[var(--c-text)]">{tx.description}</td>
                      <td className={`px-3 py-3.5 text-[13px] font-semibold tabular-nums ${tx.type === "Expense" ? "text-[var(--c-expense)]" : "text-[var(--c-income)]"}`}>
                        {tx.amount > 0 ? "+" : ""}{formatCOP(tx.amount)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-medium ${
                          tx.type === "Expense" ? "bg-[var(--c-expense-bg)] text-[var(--c-expense)]" : "bg-[var(--c-income-bg)] text-[var(--c-income)]"
                        }`}>
                          {tx.type === "Expense" ? t.creditCards.expense : t.creditCards.payment}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <select
                          value={tx.categoryId || ""}
                          onChange={(e) => handleCategoryChange(tx._id, e.target.value)}
                          className={`${inputSmCls} text-xs max-w-[130px]`}
                        >
                          <option value="">--</option>
                          {categories.map((c) => (
                            <option key={c._id} value={c._id}>{c.key ? (catTranslations[c.key] ?? c.name) : c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 md:px-6 py-3.5 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => startEdit(tx)} className="px-2.5 py-1 text-xs border border-[var(--c-border)] rounded-lg text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors">{t.common.edit}</button>
                          <button onClick={() => setDeleteTarget(tx)} className="px-2.5 py-1 text-xs text-[var(--c-expense)] border border-[var(--c-expense-bg)] rounded-lg hover:bg-[var(--c-expense-bg)] transition-colors">{t.common.delete}</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {clientPaged.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-[var(--c-text-3)] text-sm">{search || typeFilter || catFilter ? t.creditCards.noMatchingTransactions : t.creditCards.noTransactions}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination currentPage={clientPage} totalPages={clientTotalPages} onPageChange={setClientPage} />
      </Card>

      {/* Spending by Category */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-2">
          <h2 className="text-[15px] font-medium text-[var(--c-text)]">{t.creditCards.spendingByCategory}</h2>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={inputCls}
          >
            {monthOptions(locale).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {pieData.length === 0 ? (
          <p className="text-[var(--c-text-3)] text-sm text-center py-10">{t.creditCards.noExpensesThisMonth}</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatCOP(Number(value))} contentStyle={{ borderRadius: "10px", border: "1px solid var(--c-border)", fontSize: 12, boxShadow: "0 4px 16px rgba(10,21,25,0.06)" }} />
              <Legend formatter={(value: string) => <span className="text-xs text-[var(--c-text-2)]">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Add Transaction Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t.creditCards.addTransaction}>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.creditCards.date}</label>
            <input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
              className={`w-full ${inputCls}`} />
            {addErrors.date && <p className="text-[var(--c-expense)] text-xs mt-1">{addErrors.date}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.creditCards.description}</label>
            <input type="text" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              className={`w-full ${inputCls}`} />
            {addErrors.description && <p className="text-[var(--c-expense)] text-xs mt-1">{addErrors.description}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.creditCards.amount}</label>
            <input type="number" min="0.01" step="0.01" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
              className={`w-full ${inputCls}`} />
            {addErrors.amount && <p className="text-[var(--c-expense)] text-xs mt-1">{addErrors.amount}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.creditCards.type}</label>
            <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value as "Expense" | "Payment" })}
              className={`w-full ${inputCls}`}>
              <option value="Expense">{t.creditCards.expense}</option>
              <option value="Payment">{t.creditCards.payment}</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{t.creditCards.categoryOptional}</label>
            <select value={addForm.categoryId} onChange={(e) => setAddForm({ ...addForm, categoryId: e.target.value })}
              className={`w-full ${inputCls}`}>
              <option value="">{t.creditCards.noneCategory}</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.key ? (catTranslations[c.key] ?? c.name) : c.name}</option>
              ))}
            </select>
          </div>
          <button onClick={handleAddSubmit}
            className="w-full py-2.5 bg-[var(--c-brand)] text-white rounded-lg font-medium hover:bg-[var(--c-brand-hov)] transition-colors text-sm">
            {t.creditCards.addTransaction}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t.common.confirm}>
        <p className="text-sm text-[var(--c-text-2)] mb-5">
          {t.creditCards.deleteConfirmText} &ldquo;{deleteTarget?.description}&rdquo;?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 text-sm border border-[var(--c-border)] rounded-lg text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors">{t.common.cancel}</button>
          <button onClick={handleDelete}
            className="px-4 py-2 text-sm text-white bg-[var(--c-expense)] rounded-lg hover:bg-[var(--c-expense-hov)] transition-colors">{t.common.delete}</button>
        </div>
      </Modal>
    </div>
  );
}
