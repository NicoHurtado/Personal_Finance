import { cacheGet, cacheSet, ONE_HOUR } from "@/lib/cache";

export interface TrmResult {
  rate: number;
  source: string;
  timestamp: string;
}

const CACHE_KEY = "trm";

export async function fetchTrm(): Promise<TrmResult> {
  const cached = cacheGet<TrmResult>(CACHE_KEY);
  if (cached) return cached;

  const today = new Date().toISOString().split("T")[0];
  const trmUrl = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=vigenciadesde%20%3E=%20%27${today}%27&$limit=1&$order=vigenciadesde%20DESC`;

  try {
    const trmResponse = await fetch(trmUrl, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });

    if (trmResponse.ok) {
      const trmData = await trmResponse.json();
      if (trmData.length > 0 && trmData[0].valor) {
        const result: TrmResult = {
          rate: parseFloat(trmData[0].valor),
          source: "datos.gov.co (TRM oficial)",
          timestamp: trmData[0].vigenciadesde || new Date().toISOString(),
        };
        cacheSet(CACHE_KEY, result, ONE_HOUR);
        return result;
      }
    }

    const recentUrl = `https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC`;
    const recentResponse = await fetch(recentUrl, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });

    if (recentResponse.ok) {
      const recentData = await recentResponse.json();
      if (recentData.length > 0 && recentData[0].valor) {
        const result: TrmResult = {
          rate: parseFloat(recentData[0].valor),
          source: "datos.gov.co (TRM oficial)",
          timestamp: recentData[0].vigenciadesde || new Date().toISOString(),
        };
        cacheSet(CACHE_KEY, result, ONE_HOUR);
        return result;
      }
    }

    const fallbackResponse = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD",
      { next: { revalidate: 3600 } }
    );

    if (!fallbackResponse.ok) throw new Error(`Fallback API returned ${fallbackResponse.status}`);

    const fallbackData = await fallbackResponse.json();
    const rate = fallbackData.rates?.COP;
    if (!rate) throw new Error("COP rate not found");

    const result: TrmResult = {
      rate,
      source: "exchangerate-api.com (fallback)",
      timestamp: new Date().toISOString(),
    };
    cacheSet(CACHE_KEY, result, ONE_HOUR);
    return result;
  } catch {
    return { rate: 4200, source: "fallback-hardcoded", timestamp: new Date().toISOString() };
  }
}
