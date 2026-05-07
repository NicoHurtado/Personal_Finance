import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { IbkrCache } from "@/models/IbkrCache";
import { parseStringPromise } from "xml2js";

const FLEX_URL = "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService";
const IBKR_ALLOWED_EMAIL = process.env.IBKR_FLEX_USER_EMAIL!;
const IBKR_FLEX_TOKEN = process.env.IBKR_FLEX_TOKEN!;
const IBKR_FLEX_QUERY_ID = process.env.IBKR_FLEX_QUERY_ID!;

const IBKR_RETRY_CODES = new Set(["1001", "1018", "1019"]);

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function fetchIbkrBalance(): Promise<{ balance: number; unavailable?: boolean }> {
  const sendRes = await fetch(
    `${FLEX_URL}.SendRequest?v=3&t=${IBKR_FLEX_TOKEN}&q=${IBKR_FLEX_QUERY_ID}`,
    { cache: "no-store" }
  );
  const sendXml = await sendRes.text();
  const sendData = await parseStringPromise(sendXml, { explicitArray: false });
  const resp = sendData?.FlexStatementResponse;

  if (resp?.Status !== "Success") {
    const code = String(resp?.ErrorCode ?? "");
    if (IBKR_RETRY_CODES.has(code)) return { balance: 0, unavailable: true };
    throw new Error(`IBKR: ${resp?.ErrorMessage ?? resp?.Status ?? "Unknown error"}`);
  }

  const refCode: string = resp.ReferenceCode;

  for (let attempt = 0; attempt < 4; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const getRes = await fetch(
      `${FLEX_URL}.GetStatement?v=3&t=${IBKR_FLEX_TOKEN}&q=${refCode}`,
      { cache: "no-store" }
    );
    const getXml = await getRes.text();

    if (getXml.includes("<Status>")) {
      const errData = await parseStringPromise(getXml, { explicitArray: false });
      const errCode = String(errData?.FlexStatementResponse?.ErrorCode ?? "");
      if (IBKR_RETRY_CODES.has(errCode)) continue;
      throw new Error(`IBKR: ${errData?.FlexStatementResponse?.ErrorMessage}`);
    }

    const data = await parseStringPromise(getXml, { explicitArray: false });
    const raw = data?.FlexQueryResponse?.FlexStatements?.FlexStatement?.OpenPositions?.OpenPosition;

    if (!raw) return { balance: 0 };

    const posArr = Array.isArray(raw) ? raw : [raw];
    const total = posArr.reduce((sum: number, p: any) => {
      const val = parseFloat(p?.$?.positionValue ?? p?.positionValue ?? "0");
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    return { balance: total };
  }

  return { balance: 0, unavailable: true };
}

export async function GET(request: Request) {
  try {
    const user = getCurrentUser();
    if (user.email !== IBKR_ALLOWED_EMAIL) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "1";
    const dateKey = todayKey();

    // Check DB cache first (unless user explicitly forces refresh)
    if (!forceRefresh) {
      const cached = await IbkrCache.findOne({ dateKey }).lean();
      if (cached) {
        return NextResponse.json({
          balanceUSD: cached.balanceUSD,
          cached: true,
          fetchedAt: cached.fetchedAt,
        });
      }
    }

    // Call IBKR
    const { balance, unavailable } = await fetchIbkrBalance();

    if (unavailable) {
      // Rate limited — check if we have any previous value to show
      const latest = await IbkrCache.findOne().sort({ dateKey: -1 }).lean();
      return NextResponse.json({
        balanceUSD: latest?.balanceUSD ?? 0,
        cached: !!latest,
        fetchedAt: latest?.fetchedAt,
        unavailable: true,
      });
    }

    // Persist to DB (upsert so re-running today overwrites)
    await IbkrCache.findOneAndUpdate(
      { dateKey },
      { balanceUSD: balance, fetchedAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({ balanceUSD: balance, cached: false, fetchedAt: new Date() });
  } catch (err) {
    // On hard error return last known value from DB
    try {
      await connectDB();
      const latest = await IbkrCache.findOne().sort({ dateKey: -1 }).lean();
      if (latest) {
        return NextResponse.json({
          balanceUSD: latest.balanceUSD,
          cached: true,
          fetchedAt: latest.fetchedAt,
          stale: true,
        });
      }
    } catch {}
    const message = err instanceof Error ? err.message : "Error connecting to IBKR";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
