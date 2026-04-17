import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Account } from "@/models/Account";
import { TransactionV2 } from "@/models/TransactionV2";
import { Holding } from "@/models/Holding";
import { Category } from "@/models/Category";
import { parseCOPAmount } from "@/lib/format";

function parseDateDDMMYY(fecha: string): Date {
  const parts = fecha.split("/");
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const yearShort = parseInt(parts[2], 10);
  const year = 2000 + yearShort;
  return new Date(year, month, day);
}

function parseUSDAmount(value: string): number {
  let cleaned = value.replace("$", "").trim();
  cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned);
}

interface OnboardPayload {
  user: { name: string; email: string; password: string; loginCode?: string };
  accounts: {
    slug: string;
    name: string;
    type: string;
    currency: "COP" | "USD";
    color: string;
    colorGradientEnd?: string;
    sortOrder: number;
    config?: Record<string, unknown>;
  }[];
  categories: { name: string; color: string }[];
  transactions: Record<string, { fecha: string; descripcion?: string; monto: string }[]>;
  holdings: Record<string, { asset: string; valor: string; invertido: string; acciones: number }[]>;
}

/**
 * POST /api/onboard
 *
 * Accepts a full user onboarding JSON and creates:
 *   - user document
 *   - all accounts with colors and config
 *   - categories
 *   - transactions (mapped to correct accountIds)
 *   - holdings (for brokerage accounts)
 *
 * Idempotent: skips user/accounts that already exist.
 */
export async function POST(request: Request) {
  try {
    await connectDB();
    const payload: OnboardPayload = await request.json();
    const results: Record<string, string> = {};

    if (!payload.user?.password || payload.user.password.length < 4) {
      return NextResponse.json(
        { error: "Password is required (min 4 characters)" },
        { status: 400 }
      );
    }

    // 1. Create or find user
    let user = await User.findOne({ email: payload.user.email });
    const loginCode = typeof payload.user.loginCode === "string" ? payload.user.loginCode.trim() : "";
    const loginCodeHash =
      loginCode.length >= 4 ? await bcrypt.hash(loginCode, 12) : null;

    if (!user) {
      const passwordHash = await bcrypt.hash(payload.user.password, 12);
      user = await User.create({
        name: payload.user.name,
        email: payload.user.email,
        passwordHash,
        ...(loginCodeHash ? { loginCodeHash } : {}),
      });
      results.user = "Created";
    } else {
      results.user = "Exists";
      user.passwordHash = await bcrypt.hash(payload.user.password, 12);
      if (loginCodeHash) {
        user.loginCodeHash = loginCodeHash;
        results.loginCode = "Updated";
      }
      await user.save();
      results.password = "Updated";
    }
    const userId = user._id;

    // 2. Create accounts
    const accountMap: Record<string, string> = {};
    for (const acct of payload.accounts) {
      let existing = await Account.findOne({ userId, slug: acct.slug });
      if (!existing) {
        const config: Record<string, unknown> = { ...acct.config };
        if (acct.colorGradientEnd) config.colorGradientEnd = acct.colorGradientEnd;
        if (acct.config?.anchorDate && typeof acct.config.anchorDate === "string") {
          config.anchorDate = new Date(acct.config.anchorDate);
        }

        existing = await Account.create({
          userId,
          slug: acct.slug,
          name: acct.name,
          type: acct.type,
          currency: acct.currency,
          icon: acct.type === "credit_card" ? "credit-card" : acct.type === "brokerage" ? "chart-bar" : acct.type === "fixed_income" ? "piggy-bank" : "bank",
          color: acct.color,
          config,
          sortOrder: acct.sortOrder,
        });
        results[`account_${acct.slug}`] = "Created";
      } else {
        results[`account_${acct.slug}`] = "Exists";
      }
      accountMap[acct.slug] = String(existing._id);
    }

    // 3. Categories
    const existingCats = await Category.countDocuments({ userId });
    if (existingCats === 0 && payload.categories.length > 0) {
      await Category.insertMany(payload.categories.map((c) => ({ ...c, userId })));
      results.categories = `Created ${payload.categories.length}`;
    } else {
      results.categories = `Skipped (${existingCats} exist)`;
    }

    // 4. Transactions — keyed by account slug
    let totalTx = 0;
    for (const [slug, txns] of Object.entries(payload.transactions)) {
      const accountId = accountMap[slug];
      if (!accountId) {
        results[`tx_${slug}`] = "Skipped — account not found";
        continue;
      }

      const existingCount = await TransactionV2.countDocuments({ userId, accountId });
      if (existingCount > 0) {
        results[`tx_${slug}`] = `Skipped (${existingCount} exist)`;
        continue;
      }

      const account = payload.accounts.find((a) => a.slug === slug);
      const isFixedIncome = account?.type === "fixed_income";
      const isCreditCard = account?.type === "credit_card";

      const docs = txns.map((r) => {
        const amount = parseCOPAmount(r.monto);
        let type: string;
        if (isFixedIncome) {
          type = "Deposit";
        } else if (isCreditCard) {
          type = amount >= 0 ? "Payment" : "Expense";
        } else {
          type = amount >= 0 ? "Income" : "Expense";
        }

        return {
          userId,
          accountId,
          date: parseDateDDMMYY(r.fecha),
          description: r.descripcion || "Deposit",
          amount: isFixedIncome ? Math.abs(amount) : amount,
          type,
          categoryId: null,
          ...(isFixedIncome ? { metadata: { amountDeposited: Math.abs(amount) } } : {}),
        };
      });

      if (docs.length > 0) {
        await TransactionV2.insertMany(docs);
        totalTx += docs.length;
        results[`tx_${slug}`] = `${docs.length} records`;
      }
    }
    results.transactions_total = `${totalTx}`;

    // 5. Holdings — keyed by brokerage account slug
    let totalHoldings = 0;
    for (const [slug, items] of Object.entries(payload.holdings)) {
      const accountId = accountMap[slug];
      if (!accountId || !items || items.length === 0) continue;

      const existingCount = await Holding.countDocuments({ userId, accountId });
      if (existingCount > 0) {
        results[`holdings_${slug}`] = `Skipped (${existingCount} exist)`;
        continue;
      }

      const docs = items.map((r) => {
        const parenMatch = r.asset.match(/\(([^)]+)\)/);
        let ticker = r.asset;
        let companyName = r.asset;
        if (parenMatch) {
          const parts = parenMatch[1].split(":");
          ticker = parts.length > 1 ? parts[1] : parts[0];
          companyName = r.asset.substring(0, r.asset.indexOf("(")).trim().replace(/[;]/, " ").trim();
        }
        const totalInvested = parseUSDAmount(r.invertido);
        return {
          userId,
          accountId,
          ticker,
          companyName,
          shares: r.acciones,
          costBasisPerShare: totalInvested / r.acciones,
        };
      });

      await Holding.insertMany(docs);
      totalHoldings += docs.length;
      results[`holdings_${slug}`] = `${docs.length} records`;
    }
    results.holdings_total = `${totalHoldings}`;

    return NextResponse.json({ message: "Onboard complete", results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
