"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/useT";

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me?.user) {
          router.replace("/dashboard");
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError(t.login.errorMin);
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t.login.errorWrong);
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
    } catch {
      setError(t.login.errorConnection);
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--c-surface-2)] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--c-brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--c-surface-2)] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <h1 className="text-[22px] font-semibold text-[var(--c-text)]">{t.login.title}</h1>
          <p className="text-[13px] text-[var(--c-text-3)] mt-1">{t.login.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-[var(--c-border)] p-6 shadow-[0_4px_24px_rgba(10,21,25,0.04)]">
          <div className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-[12px] font-medium text-[var(--c-text-2)] mb-1.5">
                {t.login.passwordLabel}
              </label>
              <input
                id="code"
                type="password"
                inputMode="text"
                autoComplete="current-password"
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                className="w-full px-3.5 py-2.5 text-[14px] text-[var(--c-text)] bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--c-brand)]/20 focus:border-[var(--c-brand)] transition-colors placeholder:text-[var(--c-text-4)]"
                placeholder={t.login.passwordPlaceholder}
              />
            </div>

            {error && (
              <div className="px-3.5 py-2.5 bg-[var(--c-error-bg)] border border-[var(--c-error-border)] rounded-xl">
                <p className="text-[12px] text-[var(--c-error-text)] font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[var(--c-brand)] text-white text-[14px] font-medium rounded-xl hover:bg-[#01454F] focus:outline-none focus:ring-2 focus:ring-[var(--c-brand)]/30 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t.login.submitting}
                </span>
              ) : (
                t.login.submit
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
