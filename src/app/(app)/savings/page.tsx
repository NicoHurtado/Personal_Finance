"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCOP, formatUSD } from "@/lib/format";
import { CardSkeleton } from "@/components/Skeleton";
import { AccountCard } from "@/components/CardVisuals";
import { useT } from "@/hooks/useT";

interface Account {
  _id: string;
  slug: string;
  name: string;
  type: string;
  currency: string;
  color: string;
  config?: { colorGradientEnd?: string };
  balance: number;
}

export default function DebitHubPage() {
  const t = useT();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/v2/accounts");
        const all: Account[] = await res.json();
        setAccounts(all.filter((a) => a.type === "debit"));
      } catch (err) {
        console.error("Failed to fetch debit accounts", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-heading text-[var(--c-text)] mb-1">{t.savings.title}</h1>
        <p className="text-sm text-[var(--c-text-3)] mb-8">{t.savings.subtitle}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[900px]">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-heading text-[var(--c-text)] mb-1">{t.savings.title}</h1>
      <p className="text-sm text-[var(--c-text-3)] mb-6">{t.savings.subtitle}</p>

      {/* ── Desktop grid ── */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {accounts.map((acct) => {
          const fmt = acct.currency === "USD" ? formatUSD : formatCOP;
          return (
            <Link key={acct._id} href={`/savings/${acct.slug}`} className="block group">
              <div className="transition-transform duration-150 group-hover:-translate-y-[2px]">
                <AccountCard color={acct.color} colorGradientEnd={acct.config?.colorGradientEnd} name={acct.name} />
              </div>
              <div className="mt-4 px-1">
                <p className="text-[11px] text-[var(--c-text-3)] uppercase tracking-wider mb-1">
                  {acct.name} · {acct.currency}
                </p>
                <p className={`text-lg font-semibold tabular-nums ${acct.balance < 0 ? "text-[var(--c-expense)]" : "text-[var(--c-income)]"}`}>
                  {fmt(acct.balance)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Mobile layout: horizontal carousel + list ── */}
      <div className="md:hidden flex flex-col gap-6">
        {/* Horizontal scrollable card strip */}
        <div className="-mx-4 overflow-x-auto flex gap-3 pb-2 snap-x snap-mandatory scrollbar-none" style={{ paddingLeft: "1.25rem", paddingRight: "1.25rem", scrollPaddingLeft: "1.25rem" }}>
          {accounts.map((acct) => (
            <Link
              key={acct._id}
              href={`/savings/${acct.slug}`}
              className="shrink-0 w-[75vw] max-w-[300px] snap-start block group"
            >
              <div className="transition-transform duration-150 group-active:scale-[0.98] rounded-2xl overflow-hidden shadow-md">
                <AccountCard
                  color={acct.color}
                  colorGradientEnd={acct.config?.colorGradientEnd}
                  name={acct.name}
                />
              </div>
            </Link>
          ))}
          <div className="shrink-0 w-4" />
        </div>

        {/* Always-visible balance list */}
        <div className="flex flex-col divide-y divide-[var(--c-border)]">
          {accounts.map((acct) => {
            const fmt = acct.currency === "USD" ? formatUSD : formatCOP;
            return (
              <Link
                key={acct._id}
                href={`/savings/${acct.slug}`}
                className="flex items-center gap-3 py-3 group"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: `linear-gradient(135deg, ${acct.color} 0%, ${acct.config?.colorGradientEnd || acct.color} 100%)` }}
                />
                <span className="flex-1 text-[14px] text-[var(--c-text)] truncate group-hover:text-[var(--c-brand)] transition-colors">
                  {acct.name}
                </span>
                <span className={`text-[14px] font-semibold tabular-nums shrink-0 ${acct.balance < 0 ? "text-[var(--c-expense)]" : "text-[var(--c-income)]"}`}>
                  {fmt(acct.balance)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
