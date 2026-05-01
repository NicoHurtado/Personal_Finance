"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/hooks/useT";

// ── Types ──────────────────────────────────────────────────────────────
type AccountType = "debit" | "credit_card" | "fixed_income" | "brokerage";

interface AccountDraft {
  id: string;
  type: AccountType;
  name: string;
  currency: "COP" | "USD";
  color: string;
  config: {
    creditLimit?: string;
    billingCutoffDay?: string;
    annualRate?: string;
    anchorBalance?: string;
    anchorDate?: string;
  };
}

// ── Constants ──────────────────────────────────────────────────────────
const COLORS = [
  "#025864", "#C8102E", "#820AD1", "#3B82F6",
  "#10B981", "#F59E0B", "#F97316", "#EC4899",
  "#6366F1", "#0F3B2E", "#FCDA3F", "#6B7280",
];

const TYPE_ICONS: Record<AccountType, React.ReactNode> = {
  debit: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
    </svg>
  ),
  credit_card: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  fixed_income: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  brokerage: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
};

function newDraft(type: AccountType): AccountDraft {
  return {
    id: Math.random().toString(36).slice(2),
    type,
    name: "",
    currency: type === "brokerage" ? "USD" : "COP",
    color: type === "debit" ? "#025864" : type === "credit_card" ? "#820AD1" : type === "fixed_income" ? "#10B981" : "#3B82F6",
    config: {},
  };
}

// ── Step indicator ─────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < current
              ? "w-2 h-2 bg-[var(--c-brand)]"
              : i === current
              ? "w-6 h-2 bg-[var(--c-brand)]"
              : "w-2 h-2 bg-[var(--c-border)]"
          }`}
        />
      ))}
    </div>
  );
}

// ── Account type card ──────────────────────────────────────────────────
function TypeCard({
  type,
  label,
  sub,
  selected,
  onClick,
}: {
  type: AccountType;
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 ${
        selected
          ? "border-[var(--c-brand)] bg-[var(--c-brand)]/5"
          : "border-[var(--c-border)] hover:border-[var(--c-brand)]/40 bg-card"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            selected ? "bg-[var(--c-brand)] text-white" : "bg-[var(--c-surface-2)] text-[var(--c-text-2)]"
          }`}
        >
          {TYPE_ICONS[type]}
        </div>
        <div>
          <p className={`text-[13px] font-semibold ${selected ? "text-[var(--c-brand)]" : "text-[var(--c-text)]"}`}>{label}</p>
          <p className="text-[11px] text-[var(--c-text-3)]">{sub}</p>
        </div>
      </div>
    </button>
  );
}

// ── Account form (inline) ─────────────────────────────────────────────
function AccountForm({
  draft,
  onChange,
  onRemove,
  t,
}: {
  draft: AccountDraft;
  onChange: (updated: AccountDraft) => void;
  onRemove: () => void;
  t: ReturnType<typeof useT>;
}) {
  const tr = t.register;
  const inputCls = "w-full px-3 py-2 text-[13px] text-[var(--c-text)] bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--c-brand)] focus:border-[var(--c-brand)]";
  const labelCls = "block text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wide mb-1";

  const typeLabels: Record<AccountType, string> = {
    debit: tr.typeDebit,
    credit_card: tr.typeCredit,
    fixed_income: tr.typeFixed,
    brokerage: tr.typeBrokerage,
  };

  const namePlaceholder: Record<AccountType, string> = {
    debit: tr.debitNamePlaceholder,
    credit_card: tr.creditNamePlaceholder,
    fixed_income: tr.fixedNamePlaceholder,
    brokerage: tr.brokerNamePlaceholder,
  };

  return (
    <div className="border border-[var(--c-border)] rounded-xl p-4 space-y-3 bg-[var(--c-surface-2)]/40">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded text-[var(--c-text-2)]">{TYPE_ICONS[draft.type]}</div>
          <span className="text-[12px] font-semibold text-[var(--c-text-2)] uppercase tracking-wide">{typeLabels[draft.type]}</span>
        </div>
        <button type="button" onClick={onRemove} className="text-[11px] text-[var(--c-expense)] hover:underline">
          {tr.removeAccount}
        </button>
      </div>

      {/* Name */}
      <div>
        <label className={labelCls}>{tr.accountNameLabel}</label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder={namePlaceholder[draft.type]}
          className={inputCls}
        />
      </div>

      {/* Color */}
      <div>
        <label className={labelCls}>{tr.colorLabel}</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...draft, color: c })}
              className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${draft.color === c ? "ring-2 ring-offset-2 ring-[var(--c-brand)] scale-110" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Currency (debit only) */}
      {draft.type === "debit" && (
        <div>
          <label className={labelCls}>{tr.currencyLabel}</label>
          <div className="flex gap-2">
            {(["COP", "USD"] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => onChange({ ...draft, currency: cur })}
                className={`px-4 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                  draft.currency === cur
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

      {/* Credit card specific */}
      {draft.type === "credit_card" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{tr.creditLimitLabel}</label>
            <input
              type="number"
              value={draft.config.creditLimit ?? ""}
              onChange={(e) => onChange({ ...draft, config: { ...draft.config, creditLimit: e.target.value } })}
              placeholder="ej. 5000000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{tr.billingCutoffLabel}</label>
            <input
              type="number"
              min="1"
              max="31"
              value={draft.config.billingCutoffDay ?? ""}
              onChange={(e) => onChange({ ...draft, config: { ...draft.config, billingCutoffDay: e.target.value } })}
              placeholder="ej. 3"
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* Fixed income specific */}
      {draft.type === "fixed_income" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{tr.annualRateLabel}</label>
            <input
              type="number"
              step="0.01"
              value={draft.config.annualRate ?? ""}
              onChange={(e) => onChange({ ...draft, config: { ...draft.config, annualRate: e.target.value } })}
              placeholder="ej. 9.25"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{tr.initialBalanceLabel}</label>
            <input
              type="number"
              value={draft.config.anchorBalance ?? ""}
              onChange={(e) => onChange({ ...draft, config: { ...draft.config, anchorBalance: e.target.value } })}
              placeholder="ej. 1000000"
              className={inputCls}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>{tr.balanceDateLabel}</label>
            <input
              type="date"
              value={draft.config.anchorDate ?? ""}
              onChange={(e) => onChange({ ...draft, config: { ...draft.config, anchorDate: e.target.value } })}
              className={inputCls}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────
export default function RegisterPage() {
  const t = useT();
  const tr = t.register;
  const router = useRouter();

  const [step, setStep] = useState(0);

  // Step 1 state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step1Error, setStep1Error] = useState("");

  // Step 2 state
  const [accounts, setAccounts] = useState<AccountDraft[]>([]);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedType, setSelectedType] = useState<AccountType>("debit");

  // Step 3 / submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const inputCls =
    "w-full px-3.5 py-2.5 text-[14px] text-[var(--c-text)] bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--c-brand)]/20 focus:border-[var(--c-brand)] transition-colors placeholder:text-[var(--c-text-4)]";
  const labelCls = "block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5";

  // Step 1 → validate → go to step 2
  function handleNextStep1() {
    if (!name.trim()) { setStep1Error(tr.errorNameRequired); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStep1Error(tr.errorEmailInvalid); return; }
    if (password.length < 6) { setStep1Error(tr.errorPasswordMin); return; }
    if (password !== confirm) { setStep1Error(tr.errorPasswordMatch); return; }
    setStep1Error("");
    setStep(1);
  }

  // Add account draft
  function addAccount() {
    setAccounts((prev) => [...prev, newDraft(selectedType)]);
    setShowTypeSelector(false);
  }

  function updateAccount(id: string, updated: AccountDraft) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }

  function removeAccount(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  // Final submit
  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");

    try {
      // 1. Register
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          accounts: accounts.map((a, i) => {
            const slugBase = a.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "") || `account-${i + 1}`;
            const config: Record<string, unknown> = {};
            if (a.type === "credit_card") {
              if (a.config.creditLimit) config.creditLimit = parseFloat(a.config.creditLimit);
              if (a.config.billingCutoffDay) config.billingCutoffDay = parseInt(a.config.billingCutoffDay);
            }
            if (a.type === "fixed_income") {
              if (a.config.annualRate) config.annualRate = parseFloat(a.config.annualRate);
              if (a.config.anchorBalance) config.anchorBalance = parseFloat(a.config.anchorBalance);
              if (a.config.anchorDate) config.anchorDate = a.config.anchorDate;
            }
            return {
              slug: slugBase,
              name: a.name || slugBase,
              type: a.type,
              currency: a.currency,
              color: a.color,
              config,
            };
          }),
        }),
      });

      const regData = await regRes.json();

      if (!regRes.ok) {
        const errMap: Record<string, string> = {
          EMAIL_TAKEN: tr.errorEmailTaken,
          EMAIL_INVALID: tr.errorEmailInvalid,
          PASSWORD_TOO_SHORT: tr.errorPasswordMin,
          NAME_REQUIRED: tr.errorNameRequired,
        };
        setSubmitError(errMap[regData.error] ?? tr.generalError);
        setSubmitting(false);
        return;
      }

      // 2. Auto-login
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: password }),
      });

      if (!loginRes.ok) {
        setSubmitError(tr.generalError);
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.replace("/dashboard"), 1800);
    } catch {
      setSubmitError(tr.generalError);
      setSubmitting(false);
    }
  }

  const typeOptions: { type: AccountType; label: string; sub: string }[] = [
    { type: "debit", label: tr.typeDebit, sub: t.addAccount.typeDebitSub },
    { type: "credit_card", label: tr.typeCredit, sub: t.addAccount.typeCreditSub },
    { type: "fixed_income", label: tr.typeFixed, sub: t.addAccount.typeFixedSub },
    { type: "brokerage", label: tr.typeBrokerage, sub: t.addAccount.typeBrokerageSub },
  ];

  // ── Success screen ───────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-[var(--c-surface-2)] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--c-income)]/15 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-[var(--c-income)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-[22px] font-semibold text-[var(--c-text)] mb-2">{tr.successTitle}</h2>
          <p className="text-[13px] text-[var(--c-text-3)]">{tr.successSub}</p>
          <div className="mt-4 w-5 h-5 border-2 border-[var(--c-brand)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // ── Layout wrapper ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--c-surface-2)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[460px]">
        {/* Logo + title */}
        <div className="text-center mb-8">
          <h1 className="text-[22px] font-semibold text-[var(--c-text)]">{tr.title}</h1>
          <p className="text-[13px] text-[var(--c-text-3)] mt-1">{tr.subtitle}</p>
        </div>

        <StepDots current={step} total={3} />

        <div className="bg-card rounded-2xl border border-[var(--c-border)] p-6 shadow-[0_4px_24px_rgba(10,21,25,0.04)]">
          {/* ── Step 1: Personal info ──────────────────────────────── */}
          {step === 0 && (
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--c-text)] mb-1">{tr.step1Title}</h2>
              <p className="text-[12px] text-[var(--c-text-3)] mb-5">{tr.step1Sub}</p>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>{tr.nameLabel}</label>
                  <input
                    type="text"
                    value={name}
                    autoFocus
                    onChange={(e) => { setName(e.target.value); setStep1Error(""); }}
                    placeholder={tr.namePlaceholder}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{tr.emailLabel}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setStep1Error(""); }}
                    placeholder={tr.emailPlaceholder}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{tr.passwordLabel}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setStep1Error(""); }}
                    placeholder={tr.passwordPlaceholder}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{tr.confirmLabel}</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setStep1Error(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleNextStep1()}
                    placeholder={tr.confirmPlaceholder}
                    className={inputCls}
                  />
                </div>

                {step1Error && (
                  <div className="px-3.5 py-2.5 bg-[var(--c-error-bg)] border border-[var(--c-error-border)] rounded-xl">
                    <p className="text-[12px] text-[var(--c-error-text)] font-medium">{step1Error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleNextStep1}
                  className="w-full py-2.5 bg-[var(--c-brand)] text-white text-[14px] font-medium rounded-xl hover:bg-[#01454F] transition-colors mt-2"
                >
                  {tr.next} →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Accounts ──────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--c-text)] mb-1">{tr.step2Title}</h2>
              <p className="text-[12px] text-[var(--c-text-3)] mb-5">{tr.step2Sub}</p>

              <div className="space-y-3">
                {/* Existing account drafts */}
                {accounts.map((draft) => (
                  <AccountForm
                    key={draft.id}
                    draft={draft}
                    onChange={(updated) => updateAccount(draft.id, updated)}
                    onRemove={() => removeAccount(draft.id)}
                    t={t}
                  />
                ))}

                {/* Empty state */}
                {accounts.length === 0 && !showTypeSelector && (
                  <div className="text-center py-6 border-2 border-dashed border-[var(--c-border)] rounded-xl">
                    <p className="text-[13px] text-[var(--c-text-3)]">{tr.noAccountsYet}</p>
                    <p className="text-[11px] text-[var(--c-text-4)] mt-1">{tr.noAccountsHint}</p>
                  </div>
                )}

                {/* Type selector */}
                {showTypeSelector ? (
                  <div className="border border-[var(--c-border)] rounded-xl p-4 bg-[var(--c-surface-2)]/40">
                    <p className="text-[12px] font-medium text-[var(--c-text-2)] mb-3">{tr.selectType}</p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {typeOptions.map(({ type, label, sub }) => (
                        <TypeCard
                          key={type}
                          type={type}
                          label={label}
                          sub={sub}
                          selected={selectedType === type}
                          onClick={() => setSelectedType(type)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTypeSelector(false)}
                        className="flex-1 py-2 text-[13px] border border-[var(--c-border)] text-[var(--c-text-2)] rounded-lg hover:bg-[var(--c-surface)] transition-colors"
                      >
                        {t.common.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={addAccount}
                        className="flex-1 py-2 text-[13px] bg-[var(--c-brand)] text-white rounded-lg hover:bg-[#01454F] transition-colors"
                      >
                        {tr.addConfirm}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTypeSelector(true)}
                    className="w-full py-2.5 text-[13px] font-medium text-[var(--c-brand)] border-2 border-dashed border-[var(--c-brand)]/30 rounded-xl hover:border-[var(--c-brand)]/60 hover:bg-[var(--c-brand)]/5 transition-all"
                  >
                    {tr.addAccountBtn}
                  </button>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex-1 py-2.5 text-[14px] border border-[var(--c-border)] text-[var(--c-text-2)] rounded-xl hover:bg-[var(--c-surface)] transition-colors"
                >
                  ← {tr.back}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 bg-[var(--c-brand)] text-white text-[14px] font-medium rounded-xl hover:bg-[#01454F] transition-colors"
                >
                  {tr.next} →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Summary + Confirm ────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--c-text)] mb-1">{tr.step3Title}</h2>
              <p className="text-[12px] text-[var(--c-text-3)] mb-5">{tr.step3Sub}</p>

              <div className="space-y-3">
                {/* Summary card */}
                <div className="bg-[var(--c-surface-2)] rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--c-brand)] flex items-center justify-center text-white text-[14px] font-semibold shrink-0">
                      {name.trim().charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--c-text)]">{name.trim()}</p>
                      <p className="text-[12px] text-[var(--c-text-3)]">{email.trim()}</p>
                    </div>
                  </div>

                  <div className="border-t border-[var(--c-border)] pt-3">
                    <p className="text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wide mb-2">
                      {accounts.length > 0 ? `${accounts.length} ${tr.summaryAccounts}` : tr.noAccounts}
                    </p>
                    {accounts.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 py-1.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: a.color }}
                        />
                        <span className="text-[13px] text-[var(--c-text)]">{a.name || "—"}</span>
                        <span className="text-[11px] text-[var(--c-text-3)] ml-auto">
                          {a.type === "debit" ? tr.typeDebit : a.type === "credit_card" ? tr.typeCredit : a.type === "fixed_income" ? tr.typeFixed : tr.typeBrokerage}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {submitError && (
                  <div className="px-3.5 py-2.5 bg-[var(--c-error-bg)] border border-[var(--c-error-border)] rounded-xl">
                    <p className="text-[12px] text-[var(--c-error-text)] font-medium">{submitError}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 text-[14px] border border-[var(--c-border)] text-[var(--c-text-2)] rounded-xl hover:bg-[var(--c-surface)] transition-colors"
                >
                  ← {tr.back}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[var(--c-brand)] text-white text-[14px] font-medium rounded-xl hover:bg-[#01454F] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {tr.creating}
                    </span>
                  ) : (
                    tr.createBtn
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Link to login */}
        <p className="text-center text-[12px] text-[var(--c-text-3)] mt-5">
          {tr.loginInstead}{" "}
          <Link href="/login" className="text-[var(--c-brand)] hover:underline font-medium">
            {tr.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
