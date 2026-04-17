import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Account } from "@/models/Account";
import { TransactionV2 } from "@/models/TransactionV2";
import { apiError } from "@/lib/api-utils";
import { computeFixedIncomeBalance } from "@/lib/fixedIncome";
import mongoose from "mongoose";

export async function GET() {
  try {
    const user = getCurrentUser();
    await connectDB();
    const userId = new mongoose.Types.ObjectId(String(user._id));

    const [accounts, balanceAgg, fixedIncomeTxns] = await Promise.all([
      Account.find({ userId: user._id, active: true })
        .sort({ sortOrder: 1 })
        .lean(),
      TransactionV2.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: "$accountId",
            balance: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      TransactionV2.find({ userId: user._id }).select("accountId amount type metadata date").lean(),
    ]);

    const balanceMap: Record<string, { balance: number; count: number }> = {};
    for (const b of balanceAgg) {
      balanceMap[String(b._id)] = { balance: b.balance, count: b.count };
    }

    // Group fixed income transactions by accountId for compound calculation
    const txnsByAccount: Record<string, typeof fixedIncomeTxns> = {};
    for (const t of fixedIncomeTxns) {
      const key = String(t.accountId);
      if (!txnsByAccount[key]) txnsByAccount[key] = [];
      txnsByAccount[key].push(t);
    }

    const result = accounts.map((acc: any) => {
      const stats = balanceMap[String(acc._id)] || { balance: 0, count: 0 };
      let balance = stats.balance;

      if (acc.type === "fixed_income" && acc.config?.annualRate) {
        const txns = txnsByAccount[String(acc._id)] || [];
        balance = computeFixedIncomeBalance(txns, acc.config.annualRate);
      }

      return {
        ...acc,
        balance,
        transactionCount: stats.count,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getCurrentUser();
    await connectDB();
    const body = await request.json();
    const account = await Account.create({ ...body, userId: user._id });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
