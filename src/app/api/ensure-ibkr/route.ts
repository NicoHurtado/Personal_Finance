import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Account } from "@/models/Account";

export async function POST() {
  try {
    const user = getCurrentUser();
    await connectDB();

    const existing = await Account.findOne({ userId: user._id, slug: "ibkr" });
    if (existing) {
      return NextResponse.json({ message: "IBKR account already exists", account: existing });
    }

    const maxOrder = await Account.findOne({ userId: user._id }).sort({ sortOrder: -1 }).lean() as { sortOrder?: number } | null;
    const sortOrder = (maxOrder?.sortOrder ?? 6) + 1;

    const account = await Account.create({
      userId: user._id,
      slug: "ibkr",
      name: "IBKR Interactive Brokers",
      type: "brokerage",
      currency: "USD",
      icon: "chart-bar",
      color: "#C8102E",
      config: { colorGradientEnd: "#8B0000" },
      sortOrder,
    });

    return NextResponse.json({ message: "IBKR account created", account }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
