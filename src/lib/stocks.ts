import YahooFinance from "yahoo-finance2";
import { cacheGet, cacheSet, FIVE_MINUTES } from "@/lib/cache";

const yahooFinance = new YahooFinance();

export interface StockQuote {
  ticker: string;
  price: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  name: string;
  error?: string;
}

export async function fetchStockQuotes(tickers: string[]): Promise<StockQuote[]> {
  if (tickers.length === 0) return [];

  const cacheKey = `stocks:${tickers.sort().join(",")}`;
  const cached = cacheGet<StockQuote[]>(cacheKey);
  if (cached) return cached;

  const results = await Promise.all(
    tickers.map(async (ticker) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const quote: any = await yahooFinance.quote(ticker);
          if (quote.regularMarketPrice != null) {
            return {
              ticker,
              price: quote.regularMarketPrice,
              dayChange: quote.regularMarketChange ?? null,
              dayChangePercent: quote.regularMarketChangePercent ?? null,
              name: quote.shortName ?? quote.longName ?? ticker,
            };
          }
        } catch {
          // retry
        }
      }
      return {
        ticker,
        price: null,
        dayChange: null,
        dayChangePercent: null,
        name: ticker,
        error: "Could not fetch price",
      };
    })
  );

  // Only cache if we got real prices (don't cache failures)
  if (results.some((r) => r.price !== null)) {
    cacheSet(cacheKey, results, FIVE_MINUTES);
  }
  return results;
}
