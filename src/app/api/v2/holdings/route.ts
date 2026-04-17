import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Holding } from "@/models/Holding";
import { apiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const user = getCurrentUser();
    await connectDB();
    const holdings = await Holding.find({ userId: user._id })
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
