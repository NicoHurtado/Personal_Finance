"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useT } from "@/hooks/useT";
import { useLangStore } from "@/store/langStore";
import { useThemeStore } from "@/store/themeStore";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
        active
          ? "bg-[var(--c-brand)] text-white font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <span className="shrink-0">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const { lang, toggleLang } = useLangStore();
  const { dark, toggleDark } = useThemeStore();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const generalItems: NavItem[] = [
    {
      href: "/dashboard",
      label: t.nav.dashboard,
      icon: (
        <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
        </svg>
      ),
    },
    {
      href: "/savings",
      label: t.nav.debit,
      icon: (
        <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18" />
        </svg>
      ),
    },
    {
      href: "/credit-cards",
      label: t.nav.cards,
      icon: (
        <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      ),
    },
  ];

  const investmentItems: NavItem[] = [
    {
      href: "/fixed-income",
      label: t.nav.fixedIncome,
      icon: (
        <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: "/stocks",
      label: t.nav.stocks,
      icon: (
        <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
  ];

  const spreadsheetItem: NavItem = {
    href: "/spreadsheet",
    label: t.nav.spreadsheet,
    icon: (
      <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125h-1.5m2.625-1.5v-1.5c0-.621-.504-1.125-1.125-1.125M6 18.375v-1.5c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v1.5M6 18.375c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125M6 18.375V7.875c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v10.5" />
      </svg>
    ),
  };

  // Bottom bar: only the 4 essential nav items
  const bottomBarItems: NavItem[] = [...generalItems, ...investmentItems];

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.name) {
          setUserName(data.user.name);
          const parts = data.user.name.split(" ");
          setUserInitials(
            parts.map((p: string) => p[0]).join("").toUpperCase().slice(0, 2)
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }, [router]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[220px] bg-sidebar border-r border-sidebar-border z-40">
        {/* Brand */}
        <div className="px-5 pt-7 pb-8 flex items-center justify-between">
          <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">Finance</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleDark}
              className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              title={dark ? t.nav.lightMode : t.nav.darkMode}
            >
              {dark ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 110 10A5 5 0 0112 7z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleLang}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              title={lang === "es" ? t.nav.switchToEnglish : t.nav.switchToSpanish}
            >
              {lang === "es" ? "EN" : "ES"}
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col px-3 gap-6 overflow-y-auto">
          <div>
            <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{t.nav.general}</p>
            <div className="flex flex-col gap-0.5">
              {generalItems.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
          <div>
            <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{t.nav.investments}</p>
            <div className="flex flex-col gap-0.5">
              {investmentItems.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
        </nav>

        {/* Spreadsheet shortcut */}
        <div className="px-3 pb-3">
          <Link
            href="/spreadsheet"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
              isActive("/spreadsheet")
                ? "bg-[var(--c-brand)] text-white font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <svg className="w-[17px] h-[17px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125h-1.5m2.625-1.5v-1.5c0-.621-.504-1.125-1.125-1.125M6 18.375v-1.5c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v1.5M6 18.375c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125M6 18.375V7.875c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v10.5" />
            </svg>
            <span className="truncate">{t.nav.spreadsheet}</span>
          </Link>
        </div>

        {/* Bottom user + logout */}
        <div className="px-3 py-5 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-[var(--c-brand)] flex items-center justify-center text-white text-[11px] font-medium shrink-0">
              {userInitials || "··"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-foreground truncate">{userName || t.common.loading}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t.nav.personal}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              title={t.nav.signOut}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 border-t border-sidebar-border z-40 flex justify-around pt-2"
        style={{
          backgroundColor: dark ? "oklch(0.205 0 0)" : "#ffffff",
          paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {bottomBarItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 text-[10px] font-medium transition-colors ${
                active ? "text-[var(--c-brand)]" : "text-muted-foreground"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
        {/* Menu button — opens drawer */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center gap-1 px-2 py-1.5 text-[10px] font-medium transition-colors text-muted-foreground"
        >
          <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          <span>{t.nav.more}</span>
        </button>
      </nav>

      {/* Mobile slide-out drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div
            className="relative ml-auto w-72 h-full flex flex-col border-l border-sidebar-border shadow-xl"
            style={{
              backgroundColor: dark ? "oklch(0.205 0 0)" : "#ffffff",
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-sidebar-border">
              <span className="text-[15px] font-semibold tracking-tight text-foreground">Finance</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer nav links */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
              {/* Spreadsheet */}
              <Link
                href="/spreadsheet"
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] transition-all duration-150 ${
                  isActive("/spreadsheet")
                    ? "bg-[var(--c-brand)] text-white font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125h-1.5m2.625-1.5v-1.5c0-.621-.504-1.125-1.125-1.125M6 18.375v-1.5c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v1.5M6 18.375c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125M6 18.375V7.875c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v10.5" />
                </svg>
                <span>{spreadsheetItem.label}</span>
              </Link>

              <div className="border-t border-sidebar-border my-3" />

              {/* Theme toggle */}
              <button
                onClick={() => { toggleDark(); setDrawerOpen(false); }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 w-full text-left"
              >
                {dark ? (
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 110 10A5 5 0 0112 7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                <span>{dark ? t.nav.lightMode : t.nav.darkMode}</span>
              </button>

              {/* Language toggle */}
              <button
                onClick={() => { toggleLang(); setDrawerOpen(false); }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 w-full text-left"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
                <span>{lang === "es" ? t.nav.switchToEnglish : t.nav.switchToSpanish}</span>
              </button>
            </div>

            {/* User + logout */}
            <div className="px-4 py-5 border-t border-sidebar-border">
              <div className="flex items-center gap-3 px-2 py-1.5">
                <div className="w-8 h-8 rounded-full bg-[var(--c-brand)] flex items-center justify-center text-white text-[11px] font-medium shrink-0">
                  {userInitials || "··"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground truncate">{userName || t.common.loading}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{t.nav.personal}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  title={t.nav.signOut}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
