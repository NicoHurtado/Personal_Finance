"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { CardSkeleton, TableSkeleton } from "@/components/Skeleton";
import TableFilters from "@/components/TableFilters";
import { formatCOP, formatUSD, formatDate } from "@/lib/format";
import { useT } from "@/hooks/useT";
import { useLangStore } from "@/store/langStore";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Account {
  _id: string;
  slug: string;
  name: string;
  currency: "COP" | "USD";
}

interface Transaction {
  _id: string;
  date: string;
  description: string;
  amount: number;
  type: "Income" | "Expense";
}

interface FormData {
  date: string;
  description: string;
  amount: string;
  type: "Income" | "Expense";
}

interface FormErrors {
  date?: string;
  description?: string;
  amount?: string;
}

const emptyForm: FormData = { date: "", description: "", amount: "", type: "Income" };

function validateForm(form: FormData, msgs: { dateRequired: string; descRequired: string; amountRequired: string; amountPositive: string }): FormErrors {
  const errors: FormErrors = {};
  if (!form.date) errors.date = msgs.dateRequired;
  if (!form.description.trim()) errors.description = msgs.descRequired;
  if (!form.amount) errors.amount = msgs.amountRequired;
  else if (Number(form.amount) <= 0) errors.amount = msgs.amountPositive;
  return errors;
}

function formatCompact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export default function DebitAccountPage() {
  const tr = useT();
  const { lang } = useLangStore();
  const params = useParams();
  const accountSlug = params.slug as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allLoading, setAllLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<FormData>({ ...emptyForm });
  const [addErrors, setAddErrors] = useState<FormErrors>({});
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addIsCardPayment, setAddIsCardPayment] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormData>({ ...emptyForm });
  const [editErrors, setEditErrors] = useState<FormErrors>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [chartView, setChartView] = useState<"month" | "year">("month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fmt = account?.currency === "USD" ? formatUSD : formatCOP;

  const fetchAll = useCallback(async () => {
    if (!accountSlug) return;
    setAllLoading(true);
    try {
      const [txRes, accRes] = await Promise.all([
        fetch(`/api/v2/transactions?account=${accountSlug}&limit=1000`),
        fetch("/api/v2/accounts"),
      ]);
      const json = await txRes.json();
      setAllTransactions(json.data ?? []);
      const accounts: Account[] = await accRes.json();
      const found = accounts.find((a) => a.slug === accountSlug);
      if (found) setAccount(found);
    } catch { /* silent */ } finally {
      setAllLoading(false);
    }
  }, [accountSlug]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const balance = allTransactions.reduce((sum, t) => sum + t.amount, 0);

  const filteredTransactions = useMemo(() => {
    let filtered = [...allTransactions];
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t) => t.description.toLowerCase().includes(q));
    }
    if (typeFilter) filtered = filtered.filter((t) => t.type === typeFilter);
    return filtered;
  }, [allTransactions, search, typeFilter]);

  const ITEMS_PER_PAGE = 10;
  const [clientPage, setClientPage] = useState(1);
  const clientTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const clientPaged = filteredTransactions.slice((clientPage - 1) * ITEMS_PER_PAGE, clientPage * ITEMS_PER_PAGE);

  useEffect(() => { setClientPage(1); }, [search, typeFilter]);

  const locale = lang === "es" ? "es-CO" : "en-US";

  const monthOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString(locale, { month: "long", year: "numeric" });
      opts.push({ label, value });
    }
    return opts;
  }, [locale]);

  const chartData = useMemo(() => {
    const sorted = [...allTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (chartView === "year") {
      const monthlyBalances: Record<string, number> = {};
      let running = 0;
      sorted.forEach((t) => {
        running += t.amount;
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyBalances[key] = running;
      });
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return Object.entries(monthlyBalances)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, bal]) => {
          const [, m] = key.split("-");
          return { date: months[parseInt(m) - 1], balance: bal };
        });
    } else {
      const [selYear, selMo] = selectedMonth.split("-").map(Number);
      let runningBefore = 0;
      sorted.forEach((t) => {
        const d = new Date(t.date);
        if (d.getFullYear() < selYear || (d.getFullYear() === selYear && d.getMonth() + 1 < selMo)) {
          runningBefore += t.amount;
        }
      });
      const monthTxns = sorted.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === selYear && d.getMonth() + 1 === selMo;
      });
      if (monthTxns.length === 0) return [];
      let running = runningBefore;
      const points: { date: string; balance: number }[] = [];
      monthTxns.forEach((t) => {
        running += t.amount;
        const d = new Date(t.date);
        const label = `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (points.length > 0 && points[points.length - 1].date === label) {
          points[points.length - 1].balance = running;
        } else {
          points.push({ date: label, balance: running });
        }
      });
      return points;
    }
  }, [allTransactions, chartView, selectedMonth]);

  const validationMsgs = { dateRequired: tr.savings.errorDateRequired, descRequired: tr.savings.errorDescriptionRequired, amountRequired: tr.savings.errorAmountRequired, amountPositive: tr.savings.errorAmountPositive };

  const handleAdd = async () => {
    const errors = validateForm(addForm, validationMsgs);
    setAddErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setAddSubmitting(true);
    try {
      await fetch("/api/v2/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountSlug,
          date: addForm.date,
          description: addForm.description,
          amount: Number(addForm.amount),
          type: addForm.type,
          metadata: addIsCardPayment ? { isCardPayment: true } : {},
        }),
      });
      setAddOpen(false);
      setAddForm({ ...emptyForm });
      setAddIsCardPayment(false);
      setAddErrors({});
      fetchAll();
    } catch { /* silent */ } finally {
      setAddSubmitting(false);
    }
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t._id);
    setEditForm({ date: t.date.slice(0, 10), description: t.description, amount: String(Math.abs(t.amount)), type: t.type });
    setEditErrors({});
  };

  const handleEdit = async () => {
    const errors = validateForm(editForm, validationMsgs);
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setEditSubmitting(true);
    try {
      await fetch(`/api/v2/transactions/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editForm.date, description: editForm.description, amount: Number(editForm.amount), type: editForm.type }),
      });
      setEditingId(null);
      setEditErrors({});
      fetchAll();
    } catch { /* silent */ } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteSubmitting(true);
    try {
      await fetch(`/api/v2/transactions/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      fetchAll();
    } catch { /* silent */ } finally {
      setDeleteSubmitting(false);
    }
  };

  const inputCls = "border border-[var(--c-border)] rounded-lg px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] bg-card";
  const inputSmCls = "border border-[var(--c-border)] rounded-lg px-2 py-1 text-sm text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] bg-card";

  if (allLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-heading text-[var(--c-text)]">{tr.savings.title}</h1>
          <p className="text-[var(--c-text-3)] text-sm mt-1">{account?.name || accountSlug}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <CardSkeleton /><CardSkeleton />
        </div>
        <TableSkeleton rows={10} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-heading text-[var(--c-text)]">{tr.savings.title}</h1>
        <p className="text-[var(--c-text-3)] text-sm mt-1">{account?.name || accountSlug} {account?.currency ? `· ${account.currency}` : ""}</p>
      </div>

      <Card className="max-w-[440px] flex flex-col items-center justify-center">
        <p className="text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-2">{tr.savings.currentBalance}</p>
        <p className={`text-3xl font-semibold tabular-nums ${balance >= 0 ? "text-[var(--c-income)]" : "text-[var(--c-expense)]"}`}>
          {fmt(balance)}
        </p>
        <p className="text-[11px] text-[var(--c-text-3)] mt-2">
          {allTransactions.length} {allTransactions.length !== 1 ? tr.savings.transactionPlural : tr.savings.transactionSingular}
        </p>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-2">
          <h2 className="text-[15px] font-medium text-[var(--c-text)]">{tr.savings.transactionHistory}</h2>
          <button
            onClick={() => { setAddForm({ ...emptyForm }); setAddErrors({}); setAddOpen(true); }}
            className="px-4 py-2 text-sm font-medium bg-[var(--c-brand)] text-white rounded-lg hover:bg-[var(--c-brand-hov)] transition-colors"
          >
            {tr.savings.addTransaction}
          </button>
        </div>

        <TableFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={tr.savings.searchPlaceholder}
          filterValue={typeFilter}
          onFilterChange={setTypeFilter}
          filterOptions={[
            { label: tr.savings.income, value: "Income" },
            { label: tr.savings.expense, value: "Expense" },
          ]}
          filterLabel={tr.savings.filterLabel}
        />

        <div className="overflow-x-auto -mx-5 md:-mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--c-border)]">
                <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{tr.savings.date}</th>
                <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{tr.savings.description}</th>
                <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{tr.savings.amount}</th>
                <th className="px-3 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider">{tr.savings.type}</th>
                <th className="px-5 md:px-6 pb-3 text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider text-right">{tr.savings.actions}</th>
              </tr>
            </thead>
            <tbody>
              {clientPaged.map((t) =>
                editingId === t._id ? (
                  <tr key={t._id} className="border-t border-[var(--c-border-2)]">
                    <td className="px-5 md:px-6 py-3">
                      <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        className={`${inputSmCls} w-32`} />
                      {editErrors.date && <p className="text-[var(--c-expense)] text-xs mt-1">{editErrors.date}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className={`${inputSmCls} w-full`} />
                      {editErrors.description && <p className="text-[var(--c-expense)] text-xs mt-1">{editErrors.description}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        className={`${inputSmCls} w-24`} min="0" step="any" />
                      {editErrors.amount && <p className="text-[var(--c-expense)] text-xs mt-1">{editErrors.amount}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as "Income" | "Expense" })}
                        className={inputSmCls}>
                        <option value="Income">{tr.savings.income}</option>
                        <option value="Expense">{tr.savings.expense}</option>
                      </select>
                    </td>
                    <td className="px-5 md:px-6 py-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={handleEdit} disabled={editSubmitting}
                          className="px-2.5 py-1 text-xs bg-[var(--c-brand)] text-white rounded-lg hover:bg-[var(--c-brand-hov)] disabled:opacity-50">
                          {editSubmitting ? "..." : tr.common.save}
                        </button>
                        <button onClick={() => { setEditingId(null); setEditErrors({}); }}
                          className="px-2.5 py-1 text-xs border border-[var(--c-border)] rounded-lg text-[var(--c-text-2)] hover:bg-[var(--c-surface)]">{tr.common.cancel}</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={t._id} className="border-t border-[var(--c-border-2)] hover:bg-[var(--c-surface-2)] transition-colors">
                    <td className="px-5 md:px-6 py-3.5 whitespace-nowrap text-[13px] text-[var(--c-text-2)] tabular-nums">{formatDate(t.date)}</td>
                    <td className="px-3 py-3.5 text-[13px] text-[var(--c-text)]">{t.description}</td>
                    <td className={`px-3 py-3.5 text-[13px] font-semibold tabular-nums ${t.amount >= 0 ? "text-[var(--c-income)]" : "text-[var(--c-expense)]"}`}>
                      {t.amount > 0 ? "+" : ""}{fmt(t.amount)}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-medium ${
                        t.type === "Income" ? "bg-[var(--c-income-bg)] text-[var(--c-income)]" : "bg-[var(--c-expense-bg)] text-[var(--c-expense)]"
                      }`}>
                        {t.type === "Income" ? tr.savings.income : tr.savings.expense}
                      </span>
                    </td>
                    <td className="px-5 md:px-6 py-3.5 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => startEdit(t)}
                          className="px-2.5 py-1 text-xs border border-[var(--c-border)] rounded-lg text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors">{tr.common.edit}</button>
                        <button onClick={() => setDeleteId(t._id)}
                          className="px-2.5 py-1 text-xs text-[var(--c-expense)] border border-[var(--c-expense-bg)] rounded-lg hover:bg-[var(--c-expense-bg)] transition-colors">{tr.common.delete}</button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              {clientPaged.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-[var(--c-text-3)] text-sm">
                  {search || typeFilter ? tr.savings.noMatchingTransactions : tr.savings.noTransactions}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={clientPage} totalPages={clientTotalPages} onPageChange={setClientPage} />
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
          <h2 className="text-[15px] font-medium text-[var(--c-text)]">{tr.savings.balanceOverTime}</h2>
          <div className="flex items-center gap-2">
            {chartView === "month" && (
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={inputCls}>
                {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            <div className="flex rounded-lg border border-[var(--c-border)] overflow-hidden">
              <button onClick={() => setChartView("month")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartView === "month" ? "bg-[var(--c-brand)] text-white" : "text-[var(--c-text-2)] hover:bg-[var(--c-surface)]"}`}>
                {tr.savings.monthly}
              </button>
              <button onClick={() => setChartView("year")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${chartView === "year" ? "bg-[var(--c-brand)] text-white" : "text-[var(--c-text-2)] hover:bg-[var(--c-surface)]"}`}>
                {tr.savings.yearly}
              </button>
            </div>
          </div>
        </div>
        {chartData.length > 0 ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-brand)" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="var(--c-brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--c-border-2)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--c-text-3)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--c-text-3)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCompact(v)} />
                <Tooltip
                  formatter={(value: any) => [fmt(Number(value)), tr.savings.balance]}
                  contentStyle={{ backgroundColor: "var(--c-tooltip-bg)", border: "1px solid var(--c-border)", borderRadius: "10px", fontSize: 12, padding: "8px 14px", boxShadow: "0 4px 16px rgba(10,21,25,0.06)" }}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--c-brand)" strokeWidth={1.5} fill="url(#balGrad)" dot={false}
                  activeDot={{ r: 3, fill: "var(--c-brand)", stroke: "var(--c-tooltip-bg)", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-[var(--c-text-3)] text-sm">{tr.common.noData}</div>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={tr.savings.addTransaction}>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{tr.savings.date}</label>
            <input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
              className={`w-full ${inputCls}`} />
            {addErrors.date && <p className="text-[var(--c-expense)] text-xs mt-1">{addErrors.date}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{tr.savings.description}</label>
            <input type="text" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              placeholder="" className={`w-full ${inputCls}`} />
            {addErrors.description && <p className="text-[var(--c-expense)] text-xs mt-1">{addErrors.description}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{tr.savings.amount}</label>
            <input type="number" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
              placeholder="0" min="0" step="any" className={`w-full ${inputCls}`} />
            {addErrors.amount && <p className="text-[var(--c-expense)] text-xs mt-1">{addErrors.amount}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">{tr.savings.type}</label>
            <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value as "Income" | "Expense" })}
              className={`w-full ${inputCls}`}>
              <option value="Income">{tr.savings.income}</option>
              <option value="Expense">{tr.savings.expense}</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={addIsCardPayment}
              onChange={(e) => setAddIsCardPayment(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-[var(--c-brand)]"
            />
            <span className="text-[11px] text-[var(--c-text-3)]">{tr.savings.doNotCountAsExpense}</span>
          </label>
          <button onClick={handleAdd} disabled={addSubmitting}
            className="w-full py-2.5 bg-[var(--c-brand)] text-white font-medium rounded-lg hover:bg-[var(--c-brand-hov)] transition-colors disabled:opacity-50 text-sm">
            {addSubmitting ? tr.savings.adding : tr.savings.addTransaction}
          </button>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title={tr.savings.deleteTransaction}>
        <p className="text-sm text-[var(--c-text-2)] mb-5">{tr.savings.deleteConfirmText}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setDeleteId(null)}
            className="px-4 py-2 text-sm border border-[var(--c-border)] rounded-lg text-[var(--c-text-2)] hover:bg-[var(--c-surface)] transition-colors">{tr.common.cancel}</button>
          <button onClick={handleDelete} disabled={deleteSubmitting}
            className="px-4 py-2 text-sm bg-[var(--c-expense)] text-white rounded-lg hover:bg-[var(--c-expense-hov)] disabled:opacity-50 transition-colors">
            {deleteSubmitting ? "..." : tr.common.delete}
          </button>
        </div>
      </Modal>
    </div>
  );
}
