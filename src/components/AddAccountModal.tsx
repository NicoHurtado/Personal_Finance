"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { useT } from "@/hooks/useT";
import { useRouter } from "next/navigation";

type AccountType = "debit" | "credit_card" | "fixed_income" | "brokerage";

const COLORS = [
  "#025864", "#C8102E", "#820AD1", "#3B82F6",
  "#10B981", "#F59E0B", "#F97316", "#EC4899",
  "#6366F1", "#0F3B2E", "#FCDA3F", "#6B7280",
];

const TYPE_ICONS: Record<AccountType, React.ReactNode> = {
  debit: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
    </svg>
  ),
  credit_card: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  fixed_income: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  brokerage: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function AddAccountModal({ open, onClose, onCreated }: Props) {
  const t = useT();
  const ta = t.addAccount;
  const router = useRouter();

  const [step, setStep] = useState<"type" | "details">("type");
  const [selectedType, setSelectedType] = useState<AccountType>("debit");

  // Form fields
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<"COP" | "USD">("COP");
  const [color, setColor] = useState(COLORS[0]);
  const [creditLimit, setCreditLimit] = useState("");
  const [billingCutoff, setBillingCutoff] = useState("");
  const [annualRate, setAnnualRate] = useState("");
  const [anchorBalance, setAnchorBalance] = useState("");
  const [anchorDate, setAnchorDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function handleTypeSelect(type: AccountType) {
    setSelectedType(type);
    setCurrency(type === "brokerage" ? "USD" : "COP");
    setColor(
      type === "debit" ? "#025864" :
      type === "credit_card" ? "#820AD1" :
      type === "fixed_income" ? "#10B981" :
      "#3B82F6"
    );
  }

  function resetForm() {
    setStep("type");
    setSelectedType("debit");
    setName(""); setCurrency("COP"); setColor(COLORS[0]);
    setCreditLimit(""); setBillingCutoff(""); setAnnualRate("");
    setAnchorBalance(""); setAnchorDate("");
    setError(""); setSuccessMsg(""); setSaving(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSave() {
    if (!name.trim()) { setError(ta.nameRequired); return; }
    setSaving(true);
    setError("");

    const slugBase = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    let slug = slugBase;
    if (selectedType === "credit_card" && !slug.endsWith("-tc")) slug = `${slug}-tc`;

    const config: Record<string, unknown> = {};
    if (selectedType === "credit_card") {
      if (creditLimit) config.creditLimit = parseFloat(creditLimit);
      if (billingCutoff) config.billingCutoffDay = parseInt(billingCutoff);
    }
    if (selectedType === "fixed_income") {
      if (annualRate) config.annualRate = parseFloat(annualRate);
      if (anchorBalance) config.anchorBalance = parseFloat(anchorBalance);
      if (anchorDate) config.anchorDate = new Date(anchorDate);
    }

    const iconMap: Record<AccountType, string> = {
      credit_card: "credit-card",
      brokerage: "chart-bar",
      fixed_income: "piggy-bank",
      debit: "bank",
    };

    try {
      const res = await fetch("/api/v2/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          type: selectedType,
          currency,
          color,
          icon: iconMap[selectedType],
          config,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? ta.nameRequired);
        setSaving(false);
        return;
      }

      setSuccessMsg(ta.success);
      setTimeout(() => {
        handleClose();
        if (onCreated) onCreated();
        else router.refresh();
      }, 1000);
    } catch {
      setError(t.register.generalError);
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2.5 text-[13px] text-[var(--c-text)] bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] focus:border-[var(--c-brand)] transition-colors";
  const labelCls = "block text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wide mb-1.5";

  const typeOptions: { type: AccountType; label: string; sub: string }[] = [
    { type: "debit", label: ta.typeDebit, sub: ta.typeDebitSub },
    { type: "credit_card", label: ta.typeCredit, sub: ta.typeCreditSub },
    { type: "fixed_income", label: ta.typeFixed, sub: ta.typeFixedSub },
    { type: "brokerage", label: ta.typeBrokerage, sub: ta.typeBrokerageSub },
  ];

  return (
    <Modal open={open} onClose={handleClose} title={ta.title}>
      {successMsg ? (
        <div className="py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--c-income)]/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--c-income)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[var(--c-text)]">{successMsg}</p>
        </div>
      ) : step === "type" ? (
        /* ── Step 1: Type selector ──────────────────────────────── */
        <div>
          <p className="text-[12px] text-[var(--c-text-3)] mb-4">{ta.subtitle}</p>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {typeOptions.map(({ type, label, sub }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeSelect(type)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                  selectedType === type
                    ? "border-[var(--c-brand)] bg-[var(--c-brand)]/5"
                    : "border-[var(--c-border)] hover:border-[var(--c-brand)]/40 bg-card"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${
                    selectedType === type ? "bg-[var(--c-brand)] text-white" : "bg-[var(--c-surface-2)] text-[var(--c-text-2)]"
                  }`}
                >
                  {TYPE_ICONS[type]}
                </div>
                <p className={`text-[12px] font-semibold ${selectedType === type ? "text-[var(--c-brand)]" : "text-[var(--c-text)]"}`}>{label}</p>
                <p className="text-[10px] text-[var(--c-text-3)] mt-0.5 leading-tight">{sub}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep("details")}
            className="w-full py-2.5 bg-[var(--c-brand)] text-white text-[14px] font-medium rounded-xl hover:bg-[#01454F] transition-colors"
          >
            {t.register.next} →
          </button>
        </div>
      ) : (
        /* ── Step 2: Details form ────────────────────────────────── */
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>{ta.nameLabel}</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder={
                selectedType === "debit" ? t.register.debitNamePlaceholder :
                selectedType === "credit_card" ? t.register.creditNamePlaceholder :
                selectedType === "fixed_income" ? t.register.fixedNamePlaceholder :
                t.register.brokerNamePlaceholder
              }
              className={inputCls}
            />
          </div>

          {/* Currency (debit only) */}
          {selectedType === "debit" && (
            <div>
              <label className={labelCls}>{ta.currencyLabel}</label>
              <div className="flex gap-2">
                {(["COP", "USD"] as const).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => setCurrency(cur)}
                    className={`px-5 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                      currency === cur
                        ? "bg-[var(--c-brand)] text-white border-[var(--c-brand)]"
                        : "bg-card border-[var(--c-border)] text-[var(--c-text-2)] hover:border-[var(--c-brand)]/40"
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Credit card fields */}
          {selectedType === "credit_card" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{ta.creditLimitLabel}</label>
                <input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="ej. 5000000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{ta.billingCutoffLabel}</label>
                <input type="number" min="1" max="31" value={billingCutoff} onChange={(e) => setBillingCutoff(e.target.value)} placeholder="ej. 3" className={inputCls} />
              </div>
            </div>
          )}

          {/* Fixed income fields */}
          {selectedType === "fixed_income" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{ta.annualRateLabel}</label>
                  <input type="number" step="0.01" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} placeholder="ej. 9.25" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{ta.initialBalanceLabel}</label>
                  <input type="number" value={anchorBalance} onChange={(e) => setAnchorBalance(e.target.value)} placeholder="ej. 1000000" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>{ta.balanceDateLabel}</label>
                <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {/* Color */}
          <div>
            <label className={labelCls}>{ta.colorLabel}</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${color === c ? "ring-2 ring-offset-2 ring-[var(--c-brand)] scale-110" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview strip */}
          <div className="h-1.5 rounded-full" style={{ background: color }} />

          {error && (
            <div className="px-3 py-2 bg-[var(--c-error-bg)] border border-[var(--c-error-border)] rounded-lg">
              <p className="text-[12px] text-[var(--c-error-text)]">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setStep("type"); setError(""); }}
              className="flex-1 py-2.5 text-[13px] border border-[var(--c-border)] text-[var(--c-text-2)] rounded-xl hover:bg-[var(--c-surface)] transition-colors"
            >
              ← {t.register.back}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-[13px] font-medium text-white bg-[var(--c-brand)] rounded-xl hover:bg-[#01454F] disabled:opacity-60 transition-colors"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {ta.saving}
                </span>
              ) : ta.saveBtn}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
