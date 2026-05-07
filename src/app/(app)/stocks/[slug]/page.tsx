"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/Card";
import { CardSkeleton } from "@/components/Skeleton";
import { formatCOP, formatUSD } from "@/lib/format";
import { useT } from "@/hooks/useT";

interface Account {
  _id: string;
  slug: string;
  name: string;
  type: string;
  color: string;
  config?: { colorGradientEnd?: string };
}

export default function BrokerDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [balanceUSD, setBalanceUSD] = useState<number | null>(null);
  const [trm, setTrm] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isCached, setIsCached] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setUnavailable(false);

    try {
      const accountsRes = await fetch("/api/v2/accounts");
      const accounts: Account[] = await accountsRes.json();
      const found = accounts.find((a) => a.type === "brokerage" && a.slug === slug);
      if (!found) { router.push("/stocks"); return; }
      setAccount(found);

      const url = isRefresh ? "/api/ibkr/balance?refresh=1" : "/api/ibkr/balance";
      const [balanceRes, trmRes] = await Promise.all([fetch(url), fetch("/api/trm")]);

      if (!balanceRes.ok) {
        const err = await balanceRes.json();
        setError(err.error ?? "No se pudo obtener el balance de IBKR");
        return;
      }

      const { balanceUSD: usd, unavailable: unavail, cached, fetchedAt } = await balanceRes.json();
      const { rate } = await trmRes.json();
      setBalanceUSD(usd ?? null);
      setTrm(rate);
      setUnavailable(!!unavail);
      setIsCached(!!cached);
      if (fetchedAt) {
        setLastUpdated(new Date(fetchedAt).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }));
      }
    } catch {
      setError("Error de conexión con IBKR");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const balanceCOP = balanceUSD != null ? balanceUSD * trm : null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb + Header */}
      <div>
        <Link
          href="/stocks"
          className="text-xs text-[var(--c-text-3)] hover:text-[var(--c-brand)] transition-colors inline-flex items-center gap-1 mb-3"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t.stocks.title}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-heading text-[var(--c-text)]">{account?.name ?? "..."}</h1>
            {account && (
              <div
                className="h-1 w-16 rounded-full mt-2"
                style={{
                  background: `linear-gradient(to right, ${account.color}, ${account.config?.colorGradientEnd ?? account.color})`,
                }}
              />
            )}
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--c-text-2)] border border-[var(--c-border)] rounded-lg hover:bg-[var(--c-surface)] transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Balance cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : error ? (
        <Card>
          <div className="flex flex-col items-center py-6 gap-3">
            <svg className="w-8 h-8 text-[var(--c-expense)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-[var(--c-expense)]">{error}</p>
            <button onClick={() => fetchData()} className="text-xs text-[var(--c-brand)] underline">Reintentar</button>
          </div>
        </Card>
      ) : unavailable ? (
        <Card>
          <div className="flex flex-col items-center py-6 gap-3 text-center">
            <svg className="w-8 h-8 text-[var(--c-text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[var(--c-text-2)]">IBKR está procesando los datos del día.</p>
            <p className="text-xs text-[var(--c-text-3)]">El balance del día anterior estará disponible en unos minutos. Intenta de nuevo.</p>
            <button onClick={() => fetchData()} className="text-xs text-[var(--c-brand)] underline">Reintentar</button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <p className="text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-2">
                {t.stocks.portfolioValueUSD}
              </p>
              <p className="text-2xl font-semibold text-[var(--c-text)] tabular-nums">
                {balanceUSD != null ? formatUSD(balanceUSD) : "—"}
              </p>
            </Card>
            <Card>
              <p className="text-[11px] font-medium text-[var(--c-text-3)] uppercase tracking-wider mb-2">
                {t.stocks.portfolioValueCOP}
              </p>
              <p className="text-2xl font-semibold text-[var(--c-text)] tabular-nums">
                {balanceCOP != null ? formatCOP(balanceCOP) : "—"}
              </p>
            </Card>
          </div>

          {lastUpdated && (
            <p className="text-[11px] text-[var(--c-text-3)]">
              {isCached ? "Datos guardados del" : "Sincronizado con IBKR ·"} {lastUpdated}
              {isCached && <span className="ml-2 text-[var(--c-text-4)]">· Presiona Actualizar para consultar IBKR</span>}
            </p>
          )}

          <Card>
            <div className="flex items-center gap-3 py-2">
              <svg className="w-5 h-5 text-[var(--c-text-3)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--c-text)]">Ver posiciones detalladas</p>
                <p className="text-xs text-[var(--c-text-3)] mt-0.5">
                  Accede a tus posiciones, rendimiento y análisis directamente en IBKR
                </p>
              </div>
              <a
                href="https://www.interactivebrokers.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-[var(--c-brand)] rounded-lg hover:bg-[var(--c-brand-hov)] transition-colors"
              >
                Abrir IBKR
              </a>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
