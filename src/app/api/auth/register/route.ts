import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Account } from "@/models/Account";

const ICON_MAP: Record<string, string> = {
  credit_card: "credit-card",
  brokerage: "chart-bar",
  fixed_income: "piggy-bank",
  debit: "bank",
  savings: "bank",
};

interface AccountInput {
  slug: string;
  name: string;
  type: string;
  currency: "COP" | "USD";
  color: string;
  config?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const name: string = (body.name ?? "").trim();
    const email: string = (body.email ?? "").trim().toLowerCase();
    const password: string = body.password ?? "";
    const accounts: AccountInput[] = body.accounts ?? [];

    // Validation
    if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "EMAIL_INVALID" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "PASSWORD_TOO_SHORT" }, { status: 400 });
    }

    // Check if email already taken
    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    const userId = user._id;

    // Create accounts (categories are now global — no per-user creation)
    for (let i = 0; i < accounts.length; i++) {
      const acct = accounts[i];
      let slug = acct.slug || `${acct.type}-${i + 1}`;
      if (acct.type === "credit_card" && !slug.endsWith("-tc")) slug = `${slug}-tc`;

      const config: Record<string, unknown> = { ...(acct.config ?? {}) };
      if (config.anchorDate && typeof config.anchorDate === "string") {
        config.anchorDate = new Date(config.anchorDate);
      }

      await Account.create({
        userId,
        slug,
        name: acct.name,
        type: acct.type,
        currency: acct.currency,
        icon: ICON_MAP[acct.type] ?? "bank",
        color: acct.color,
        config,
        sortOrder: i + 1,
      });
    }

    return NextResponse.json({ message: "User created successfully" }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
