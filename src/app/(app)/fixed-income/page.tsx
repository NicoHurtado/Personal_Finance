"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import { CardSkeleton } from "@/components/Skeleton";
import { formatCOP } from "@/lib/format";
interface FixedIncomeAccount {
  _id: string;
  slug: string;
  name: string;
  type: string;
  color: string;
  balance: number;
  config?: {
    annualRate?: number;
    colorGradientEnd?: string;
  };
}

export default function FixedIncomePage() {
  const [accounts, setAccounts] = useState<FixedIncomeAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v2/accounts");
        const all: FixedIncomeAccount[] = await res.json();
        setAccounts(all.filter((a) => a.type === "fixed_income"));
      } catch {
        console.error("Failed to fetch accounts");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-heading text-[#0A1519] mb-1">Fixed Income</h1>
        <p className="text-sm text-[#7A8B90] mb-8">Your fixed income products</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-[900px]">
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-heading text-[#0A1519] mb-1">Fixed Income</h1>
      <p className="text-sm text-[#7A8B90] mb-8">Your fixed income products</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-[900px]">
        {accounts.map((acct) => {
          return (
            <Link key={acct._id} href={`/fixed-income/${acct.slug}`} className="block group">
              <Card hover padding="lg">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: acct.color }}>
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[15px] font-medium text-[#0A1519]">{acct.name}</p>
                    {acct.config?.annualRate && acct.config.annualRate > 0 && (
                      <p className="text-[11px] text-[#7A8B90]">{acct.config.annualRate}% EA</p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-medium text-[#7A8B90] uppercase tracking-wider mb-1">Balance</p>
                <p className="text-xl font-semibold text-[#00A85A] tabular-nums">
                  {formatCOP(acct.balance ?? 0)}
                </p>
                <div className="mt-4 flex items-center gap-1 text-[12px] text-[#7A8B90] group-hover:text-[#0A1519] transition-colors">
                  <span>View details</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
