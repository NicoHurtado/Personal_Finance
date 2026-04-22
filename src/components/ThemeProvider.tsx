"use client";

import { useLayoutEffect } from "react";
import { useThemeStore } from "@/store/themeStore";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const dark = useThemeStore((s) => s.dark);

  // useLayoutEffect runs synchronously before browser paint, preventing any flash.
  // We also read directly from localStorage as a fallback in case Zustand hasn't
  // rehydrated yet on the first render cycle.
  useLayoutEffect(() => {
    let isDark = dark;
    try {
      const stored = JSON.parse(localStorage.getItem("finance-theme") || "{}");
      if (stored?.state?.dark !== undefined) isDark = stored.state.dark;
    } catch { /* ignore */ }

    document.documentElement.classList.toggle("dark", isDark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark ? "#0f1a1c" : "#ffffff");
  }, [dark]);

  return <>{children}</>;
}
