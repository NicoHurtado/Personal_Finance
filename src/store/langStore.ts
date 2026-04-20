import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "@/lib/i18n";

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "es",
      setLang: (lang) => set({ lang }),
      toggleLang: () => set({ lang: get().lang === "es" ? "en" : "es" }),
    }),
    {
      name: "finance-lang",
    }
  )
);
