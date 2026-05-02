import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const result = await yahooFinance.search(q, { quotesCount: 8, newsCount: 0 });
    const quotes = (result.quotes || [])
      .filter((r: any) => r.quoteType === "EQUITY" || r.quoteType === "ETF")
      .map((r: any) => ({
        ticker: r.symbol,
        name: r.shortname || r.longname || r.symbol,
        type: r.quoteType,
        exchange: r.exchDisp || r.exchange,
      }));
    return NextResponse.json(quotes);
  } catch {
    return NextResponse.json([]);
  }
}
