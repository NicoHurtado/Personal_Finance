"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
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
      <h1 className="text-heading text-[var(--c-text)] mb-1">Debit</h1>
      <p className="text-sm text-[var(--c-text-3)] mb-8">Your debit accounts</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[900px]">
        {accounts.map((acct) => {
          const fmt = acct.currency === "USD" ? formatUSD : formatCOP;
          return (
            <Link key={acct._id} href={`/savings/${acct.slug}`} className="block group">
              <div className="transition-transform duration-150 group-hover:-translate-y-[2px]">
                <AccountCard color={acct.color} colorGradientEnd={acct.config?.colorGradientEnd} />
              </div>
              <Card className="mt-4" padding="sm">
                <p className="text-[11px] text-[var(--c-text-3)] uppercase tracking-wider mb-1">
                  {acct.name} · {acct.currency}
                </p>
                <p className={`text-lg font-semibold tabular-nums ${acct.balance < 0 ? "text-[var(--c-expense)]" : "text-[var(--c-income)]"}`}>
                  {fmt(acct.balance)}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
