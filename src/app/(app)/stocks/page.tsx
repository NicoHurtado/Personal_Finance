"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import { CardSkeleton } from "@/components/Skeleton";
import { formatUSD } from "@/lib/format";
import { useT } from "@/hooks/useT";

interface Account {
  _id: string;
  slug: string;
  name: string;
  type: string;
  color: string;
  balance?: number;
  transactionCount?: number;
  config?: { colorGradientEnd?: string };
}

const BROKER_ICONS: Record<string, React.ReactNode> = {
  ibkr: (
    <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
};

export default function StocksBrokersPage() {
  const t = useT();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v2/accounts")
      .then((r) => r.json())
      .then((data: Account[]) => {
        setAccounts(data.filter((a) => a.type === "brokerage"));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-heading text-[var(--c-text)]">{t.stocks.title}</h1>
        <p className="text-sm text-[var(--c-text-3)] mt-1">
          {t.stocks.selectBrokerSubtitle}
        </p>
      </div>

      {/* Broker cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <p className="text-center text-[var(--c-text-3)] py-8 text-sm">
            {t.stocks.noBrokers}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => {
            const icon = BROKER_ICONS[acc.slug] ?? BROKER_ICONS.default;
            const gradientEnd = acc.config?.colorGradientEnd ?? acc.color;
            return (
              <Link key={acc._id} href={`/stocks/${acc.slug}`} className="block group">
                <div className="relative overflow-hidden rounded-2xl border border-[var(--c-border)] bg-card transition-all duration-200 group-hover:shadow-lg group-hover:-translate-y-0.5">
                  {/* Color bar top */}
                  <div
                    className="h-1 w-full"
                    style={{
                      background: `linear-gradient(to right, ${acc.color}, ${gradientEnd})`,
                    }}
                  />

                  <div className="p-5">
                    {/* Icon + badge */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `${acc.color}22`, color: acc.color }}
                      >
                        {icon}
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--c-text-3)] bg-[var(--c-surface)] px-2 py-1 rounded-full">
                        {t.stocks.brokerage}
                      </span>
                    </div>

                    {/* Name */}
                    <h3 className="text-[15px] font-semibold text-[var(--c-text)] group-hover:text-[var(--c-brand)] transition-colors leading-snug">
                      {acc.name}
                    </h3>

                    {/* CTA */}
                    <div className="mt-4 flex items-center gap-1 text-xs font-medium text-[var(--c-brand)]">
                      <span>{t.common.viewDetails}</span>
                      <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
