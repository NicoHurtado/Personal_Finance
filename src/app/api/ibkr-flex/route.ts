import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const FLEX_TOKEN = process.env.IBKR_FLEX_TOKEN!;
const FLEX_QUERY_ID = process.env.IBKR_FLEX_QUERY_ID!;
const ALLOWED_EMAIL = process.env.IBKR_FLEX_USER_EMAIL!;

const SEND_URL = "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest";
const GET_URL = "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement";

function parseAttr(attrs: string, key: string): string {
  const m = attrs.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1] : "";
}

async function fetchFlexPositions() {
  // Step 1: request the statement
  const res1 = await fetch(`${SEND_URL}?v=3&t=${FLEX_TOKEN}&q=${FLEX_QUERY_ID}`, {
    cache: "no-store",
  });
  const xml1 = await res1.text();

  const refMatch = xml1.match(/<ReferenceCode>(.*?)<\/ReferenceCode>/);
  if (!refMatch) {
    const errMatch = xml1.match(/<ErrorMessage>(.*?)<\/ErrorMessage>/);
    throw new Error(errMatch ? errMatch[1] : "IBKR did not return a reference code");
  }
  const refCode = refMatch[1];

  // Step 2: poll until ready (max 30s)
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res2 = await fetch(`${GET_URL}?v=3&t=${FLEX_TOKEN}&q=${refCode}`, {
      cache: "no-store",
    });
    const xml2 = await res2.text();

    if (xml2.includes("<Status>Success</Status>") || xml2.includes("ErrorCode>1019")) {
      // still generating, keep waiting
      continue;
    }

    if (!xml2.includes("<OpenPositions>")) {
      // might be an error response
      const errMatch = xml2.match(/<ErrorMessage>(.*?)<\/ErrorMessage>/);
      if (errMatch) throw new Error(errMatch[1]);
    }

    const positions: object[] = [];
    const posRegex = /<OpenPosition\s([^>]*?)\/>/g;
    let match;
    while ((match = posRegex.exec(xml2)) !== null) {
      const a = match[1];
      positions.push({
        ticker: parseAttr(a, "symbol"),
        companyName: parseAttr(a, "description") || parseAttr(a, "symbol"),
        shares: parseFloat(parseAttr(a, "position") || "0"),
        price: parseFloat(parseAttr(a, "markPrice") || "0"),
        costBasisPerShare: parseFloat(parseAttr(a, "costBasisPrice") || "0"),
        positionValue: parseFloat(parseAttr(a, "positionValue") || "0"),
        unrealizedPL: parseFloat(parseAttr(a, "unrealizedPnl") || "0"),
        currency: parseAttr(a, "currency"),
        assetClass: parseAttr(a, "assetClass"),
        reportDate: parseAttr(a, "reportDate"),
      });
    }

    return positions;
  }

  throw new Error("IBKR statement timed out");
}

export async function GET() {
  try {
    const user = getCurrentUser();

    if (user.email !== ALLOWED_EMAIL) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const positions = await fetchFlexPositions();
    return NextResponse.json(positions);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
