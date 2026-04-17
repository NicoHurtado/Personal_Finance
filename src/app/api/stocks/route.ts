import { NextRequest, NextResponse } from "next/server";
import { fetchStockQuotes } from "@/lib/stocks";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const tickersParam = searchParams.get("tickers");

    if (!tickersParam) {
      return NextResponse.json(
        { error: "tickers query parameter is required" },
        { status: 400 }
      );
    }

    const tickers = tickersParam.split(",").map((t) => t.trim()).filter(Boolean);
    const results = await fetchStockQuotes(tickers);

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
