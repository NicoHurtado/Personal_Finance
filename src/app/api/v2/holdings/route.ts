import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Holding } from "@/models/Holding";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = getCurrentUser();
    await connectDB();
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const query: Record<string, unknown> = { userId: user._id };
    if (accountId) query.accountId = accountId;
    const holdings = await Holding.find(query)
      .sort({ ticker: 1 })
      .lean();
    return NextResponse.json(holdings);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getCurrentUser();
    await connectDB();
    const body = await request.json();
    const holding = await Holding.create({ ...body, userId: user._id });
    return NextResponse.json(holding, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
