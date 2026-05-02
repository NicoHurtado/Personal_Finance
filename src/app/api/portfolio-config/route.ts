import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { PortfolioConfig } from "@/models/PortfolioConfig";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = getCurrentUser();
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

    await connectDB();
    const config = await PortfolioConfig.findOne({ userId: user._id, accountId }).lean();
    return NextResponse.json(config || { assets: [], groups: [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getCurrentUser();
    const { accountId, assets, groups } = await request.json();
    if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

    await connectDB();
    const config = await PortfolioConfig.findOneAndUpdate(
      { userId: user._id, accountId },
      { assets, groups, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    return NextResponse.json(config);
  } catch (error) {
    return apiError(error);
  }
}
