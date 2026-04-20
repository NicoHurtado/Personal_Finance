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

export default function CreditCardsPage() {
  const t = useT();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/v2/accounts");
        const all: Account[] = await res.json();
        setAccounts(all.filter((a) => a.type === "credit_card"));
      } catch (err) {
        console.error("Failed to fetch credit card accounts", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-heading text-[#0A1519] mb-1">{t.creditCards.title}</h1>
        <p className="text-sm text-[#7A8B90] mb-8">{t.creditCards.subtitle}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-heading text-[#0A1519] mb-1">Credit Cards</h1>
      <p className="text-sm text-[#7A8B90] mb-8">Manage your credit cards</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[900px]">
        {accounts.map((acct) => {
          const fmt = acct.currency === "USD" ? formatUSD : formatCOP;
          const slugParam = acct.slug.replace(/-tc$/, "");
          return (
            <Link key={acct._id} href={`/credit-cards/${slugParam}`} className="block group">
              <div className="transition-transform duration-150 group-hover:-translate-y-[2px]">
                <AccountCard color={acct.color} colorGradientEnd={acct.config?.colorGradientEnd} />
              </div>
              <Card className="mt-4" padding="sm">
                <p className="text-[11px] text-[#7A8B90] uppercase tracking-wider mb-1">
                  {acct.name}
                </p>
                <p className={`text-lg font-semibold tabular-nums ${acct.balance < 0 ? "text-[#E5484D]" : "text-[#00A85A]"}`}>
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
