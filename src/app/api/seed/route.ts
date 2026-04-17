import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Account, type AccountType } from "@/models/Account";
import { TransactionV2 } from "@/models/TransactionV2";
import { Holding } from "@/models/Holding";
import { Category } from "@/models/Category";
import { parseCOPAmount } from "@/lib/format";
import fs from "fs";
import path from "path";

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

function readDataFile(filename: string): any[] {
  const filePath = path.join(process.cwd(), "data", filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

interface AccountSeed {
  slug: string;
  name: string;
  type: AccountType;
  currency: "COP" | "USD";
  icon: string;
  color: string;
  colorGradientEnd?: string;
  sortOrder: number;
  config?: Record<string, unknown>;
}

const ACCOUNT_SEEDS: AccountSeed[] = [
  {
    slug: "nu-tc",
    name: "Nu Credit Card",
    type: "credit_card",
    currency: "COP",
    icon: "credit-card",
    color: "#820AD1",
    colorGradientEnd: "#5B0694",
    sortOrder: 1,
    config: { creditLimit: 3_500_000, billingCutoffDay: 3 },
  },
  {
    slug: "visa-tc",
    name: "Visa Bancolombia Platino",
    type: "credit_card",
    currency: "COP",
    icon: "credit-card",
    color: "#D9DCE0",
    colorGradientEnd: "#9EA5AC",
    sortOrder: 4,
    config: { creditLimit: 10_400_000, billingCutoffDay: 3 },
  },
  {
    slug: "bancolombia",
    name: "Bancolombia",
    type: "debit",
    currency: "COP",
    icon: "bank",
    color: "#FCDA3F",
    colorGradientEnd: "#E6B800",
    sortOrder: 2,
  },
  {
    slug: "arq-usd",
    name: "Arq USD",
    type: "debit",
    currency: "USD",
    icon: "bank",
    color: "#0F3B2E",
    colorGradientEnd: "#062016",
    sortOrder: 3,
  },
  {
    slug: "cajita",
    name: "Nu Cajita",
    type: "fixed_income",
    currency: "COP",
    icon: "piggy-bank",
    color: "#025864",
    colorGradientEnd: "#014750",
    sortOrder: 5,
    config: {
      annualRate: 9.25,
      anchorBalance: 4_331_075.74,
      anchorGrowth: 36_515,
      anchorDate: new Date(2026, 3, 16),
    },
  },
  {
    slug: "hapi",
    name: "HAPI Portfolio",
    type: "brokerage",
    currency: "USD",
    icon: "chart-bar",
    color: "#025864",
    colorGradientEnd: "#014750",
    sortOrder: 6,
  },
];

const CATEGORY_SEEDS = [
  { name: "Food", color: "#025864" },
  { name: "Stuff", color: "#0A5A7A" },
  { name: "Digital", color: "#4FB7C2" },
  { name: "Clothes", color: "#A7C4C9" },
  { name: "Education", color: "#4A5B60" },
  { name: "Tech", color: "#7A8B90" },
  { name: "Payment", color: "#00D47E" },
];

/**
 * POST /api/seed?force=true  — drops existing data and re-seeds from JSON files
 * POST /api/seed             — only seeds if collections are empty
 */
export async function POST(request: Request) {
  try {
    await connectDB();
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";
    const results: Record<string, string> = {};

    // 0. If force, wipe new collections
    if (force) {
      await Promise.all([
        TransactionV2.deleteMany({}),
        Holding.deleteMany({}),
        Account.deleteMany({}),
        Category.deleteMany({}),
        User.deleteMany({}),
      ]);
      results._reset = "All new collections cleared";
    }

    // 1. Ensure default user
    const defaultPassword = url.searchParams.get("password") || "finance2026";
    const seedLoginCode = url.searchParams.get("loginCode") || "nico-seed-26";
    const loginCodeHash = await bcrypt.hash(seedLoginCode, 12);
    let user = await User.findOne({ email: "nicolas@finance.app" });
    if (!user) {
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      user = await User.create({
        name: "Nicolás",
        email: "nicolas@finance.app",
        passwordHash,
        loginCodeHash,
      });
      results.user = "Created";
    } else {
      results.user = "Exists";
      if (!user.loginCodeHash || force) {
        user.loginCodeHash = loginCodeHash;
        await user.save();
        results.loginCode = force ? "Reset" : "Set";
      }
    }
    const userId = user._id;

    // 2. Create accounts
    const accountMap: Record<string, string> = {};
    for (const seed of ACCOUNT_SEEDS) {
      let account = await Account.findOne({ userId, slug: seed.slug });
      if (!account) {
        account = await Account.create({
          userId,
          slug: seed.slug,
          name: seed.name,
          type: seed.type,
          currency: seed.currency,
          icon: seed.icon,
          color: seed.color,
          config: {
            ...seed.config,
            colorGradientEnd: seed.colorGradientEnd,
          },
          sortOrder: seed.sortOrder,
        });
        results[`account_${seed.slug}`] = "Created";
      } else {
        results[`account_${seed.slug}`] = "Exists";
      }
      accountMap[seed.slug] = String(account._id);
    }

    // 3. Seed categories
    const existingCats = await Category.countDocuments({ userId });
    if (existingCats === 0) {
      await Category.insertMany(CATEGORY_SEEDS.map((c) => ({ ...c, userId })));
      results.categories = `Seeded ${CATEGORY_SEEDS.length}`;
    } else {
      results.categories = `Skipped (${existingCats} exist)`;
    }

    // 4. Seed transactions from JSON files
    const txCount = await TransactionV2.countDocuments({ userId });
    if (txCount > 0) {
      results.transactions = `Skipped (${txCount} exist)`;
    } else {
      let total = 0;

      // Nu TC
      const nuData = readDataFile("registros_nu_tc.json");
      const nuDocs = nuData.map((r: any) => {
        const amount = parseCOPAmount(r.monto);
        return {
          userId,
          accountId: accountMap["nu-tc"],
          date: parseDateDDMMYY(r.fecha),
          description: r.descripcion,
          amount,
          type: amount >= 0 ? "Payment" : "Expense",
          categoryId: null,
        };
      });
      await TransactionV2.insertMany(nuDocs);
      total += nuDocs.length;
      results.tx_nu_tc = `${nuDocs.length} records`;

      // Visa TC
      const visaData = readDataFile("registros_visa_platino_tc.json");
      const visaDocs = visaData.map((r: any) => {
        const amount = parseCOPAmount(r.monto);
        return {
          userId,
          accountId: accountMap["visa-tc"],
          date: parseDateDDMMYY(r.fecha),
          description: r.descripcion,
          amount,
          type: amount >= 0 ? "Payment" : "Expense",
          categoryId: null,
        };
      });
      await TransactionV2.insertMany(visaDocs);
      total += visaDocs.length;
      results.tx_visa_tc = `${visaDocs.length} records`;

      // Savings (Bancolombia)
      const savingsData = readDataFile("registros_cuenta_ahorros_bc.json");
      const savingsDocs = savingsData.map((r: any) => {
        const amount = parseCOPAmount(r.monto);
        return {
          userId,
          accountId: accountMap["bancolombia"],
          date: parseDateDDMMYY(r.fecha),
          description: r.descripcion,
          amount,
          type: amount >= 0 ? "Income" : "Expense",
          categoryId: null,
        };
      });
      await TransactionV2.insertMany(savingsDocs);
      total += savingsDocs.length;
      results.tx_bancolombia = `${savingsDocs.length} records`;

      // Cajita
      const cajitaData = readDataFile("registros_cuenta_nu_cajita.json");
      const cajitaDocs = cajitaData.map((r: any) => {
        const amount = parseCOPAmount(r.monto);
        return {
          userId,
          accountId: accountMap["cajita"],
          date: parseDateDDMMYY(r.fecha),
          description: "Deposit",
          amount: Math.abs(amount),
          type: "Deposit",
          categoryId: null,
          metadata: { amountDeposited: Math.abs(amount) },
        };
      });
      await TransactionV2.insertMany(cajitaDocs);
      total += cajitaDocs.length;
      results.tx_cajita = `${cajitaDocs.length} records`;

      results.transactions = `Seeded ${total} total transactions`;
    }

    // 5. Seed investments as holdings
    const holdingCount = await Holding.countDocuments({ userId });
    if (holdingCount > 0) {
      results.holdings = `Skipped (${holdingCount} exist)`;
    } else {
      const investData = readDataFile("registros_inversiones.json");
      const holdingDocs = investData.map((r: any) => {
        const parenMatch = r.asset.match(/\(([^)]+)\)/);
        let ticker = r.asset;
        let companyName = r.asset;
        if (parenMatch) {
          const exchange = parenMatch[1];
          const parts = exchange.split(":");
          ticker = parts.length > 1 ? parts[1] : parts[0];
          companyName = r.asset.substring(0, r.asset.indexOf("(")).trim();
          companyName = companyName.replace(/[;]/, " ").trim();
        }
        const shares = r.acciones;
        const totalInvested = parseUSDAmount(r.invertido);
        const costBasisPerShare = totalInvested / shares;
        return {
          userId,
          accountId: accountMap["hapi"],
          ticker,
          companyName,
          shares,
          costBasisPerShare,
        };
      });
      await Holding.insertMany(holdingDocs);
      results.holdings = `Seeded ${holdingDocs.length} holdings`;
    }

    return NextResponse.json({ message: "Seed complete", results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
