import { useLangStore } from "@/store/langStore";
import { translations } from "@/lib/i18n";

export function useT() {
  const lang = useLangStore((s) => s.lang);
  return translations[lang];
}
