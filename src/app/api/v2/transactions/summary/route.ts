import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Account } from "@/models/Account";
import { TransactionV2 } from "@/models/TransactionV2";
import { Holding } from "@/models/Holding";
import mongoose from "mongoose";
import { apiError } from "@/lib/api-utils";
import { fetchStockQuotes } from "@/lib/stocks";
import { fetchTrm } from "@/lib/trm";

import { computeFixedIncomeBalance } from "@/lib/fixedIncome";

/**
 * GET /api/v2/transactions/summary
 *
 * Single "dashboard bundle" endpoint. Returns everything the dashboard needs
 * in one HTTP call: accounts with balances, recent activity, monthly cash flow,
 * holdings with live prices, and TRM.
 */
export async function GET() {
  try {
    const user = getCurrentUser();
    await connectDB();
    const userId = new mongoose.Types.ObjectId(String(user._id));

    // Fetch accounts first so we can filter cashFlow to debit+credit_card only
    const accounts = await Account.find({ userId: user._id, active: true })
      .sort({ sortOrder: 1 })
      .lean();

    const cashFlowAccountIds = accounts
      .filter((a: any) => a.type === "debit" || a.type === "credit_card")
      .map((a: any) => a._id);

    // All remaining DB queries + external data in parallel
    const fixedIncomeAccountIds = accounts
      .filter((a: any) => a.type === "fixed_income")
      .map((a: any) => a._id);

    const [balanceAgg, recentActivity, cashFlowAgg, dailyCashFlowAgg, dailyFixedFlowAgg, allDailyNetFlow, holdings, trmResult, allTxnsForFixed] =
      await Promise.all([
        TransactionV2.aggregate([
          { $match: { userId } },
          {
            $group: {
              _id: "$accountId",
              balance: { $sum: "$amount" },
              count: { $sum: 1 },
              lastDate: { $max: "$date" },
            },
          },
        ]),

        TransactionV2.find({ userId: user._id })
          .sort({ date: -1 })
          .limit(30)
          .lean(),

        TransactionV2.aggregate([
          { $match: { userId, "metadata.isCardPayment": { $ne: true }, accountId: { $in: cashFlowAccountIds } } },
          {
            $group: {
              _id: {
                accountId: "$accountId",
                year: { $year: "$date" },
                month: { $month: "$date" },
                type: "$type",
              },
              total: {
                $sum: {
                  $cond: [
                    { $eq: ["$metadata.excludeFromIncome", true] },
                    0,
                    "$amount",
                  ],
                },
              },
            },
          },
          { $sort: { "_id.year": -1, "_id.month": -1 } },
        ]),

        TransactionV2.aggregate([
          { $match: { userId, "metadata.isCardPayment": { $ne: true }, accountId: { $in: cashFlowAccountIds } } },
          {
            $group: {
              _id: {
                accountId: "$accountId",
                year: { $year: "$date" },
                month: { $month: "$date" },
                day: { $dayOfMonth: "$date" },
                type: "$type",
              },
              total: {
                $sum: {
                  $cond: [
                    { $eq: ["$metadata.excludeFromIncome", true] },
                    0,
                    "$amount",
                  ],
                },
              },
              transactions: {
                $push: {
                  description: "$description",
                  amount: "$amount",
                  type: "$type",
                },
              },
            },
          },
        ]),

        // Fixed income accounts — withdrawals and deposits for tooltip display
        fixedIncomeAccountIds.length > 0 ? TransactionV2.aggregate([
          { $match: { userId, accountId: { $in: fixedIncomeAccountIds }, "metadata.isCardPayment": { $ne: true } } },
          {
            $group: {
              _id: {
                year: { $year: "$date" },
                month: { $month: "$date" },
                day: { $dayOfMonth: "$date" },
              },
              transactions: {
                $push: {
                  description: "$description",
                  amount: "$amount",
                  type: "$type",
                },
              },
            },
          },
        ]) : Promise.resolve([]),

        // All accounts, all transactions — used for forward capital line reconstruction
        TransactionV2.aggregate([
          { $match: { userId } },
          {
            $group: {
              _id: {
                year: { $year: "$date" },
                month: { $month: "$date" },
                day: { $dayOfMonth: "$date" },
              },
              net: { $sum: "$amount" },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
        ]),

        Holding.find({ userId: user._id }).lean(),

        fetchTrm(),

        TransactionV2.find({ userId: user._id }).select("accountId amount type metadata date").lean(),
      ]);

    // Fetch stock quotes (cached) — runs after holdings are known
    const tickers = Array.from(new Set(holdings.map((h: any) => h.ticker)));
    const stockQuotes = await fetchStockQuotes(tickers as string[]);

    // Build account summaries with balances
    const balanceMap: Record<string, { balance: number; count: number; lastDate: Date | null }> = {};
    for (const b of balanceAgg) {
      balanceMap[String(b._id)] = { balance: b.balance, count: b.count, lastDate: b.lastDate };
    }

    // Group transactions by accountId for fixed income compound calculation
    const txnsByAccount: Record<string, typeof allTxnsForFixed> = {};
    for (const t of allTxnsForFixed) {
      const key = String(t.accountId);
      if (!txnsByAccount[key]) txnsByAccount[key] = [];
      txnsByAccount[key].push(t);
    }

    const accountSummaries = accounts.map((acc: any) => {
      const stats = balanceMap[String(acc._id)] || { balance: 0, count: 0, lastDate: null };
      let balance = stats.balance;

      if (acc.type === "fixed_income" && (acc.config as any)?.annualRate) {
        const txns = txnsByAccount[String(acc._id)] || [];
        balance = computeFixedIncomeBalance(txns, (acc.config as any).annualRate);
      }

      return {
        ...acc,
        balance,
        transactionCount: stats.count,
        lastTransactionDate: stats.lastDate,
      };
    });

    // Build cash flow map
    const cashFlow: Record<string, Record<string, { income: number; expenses: number }>> = {};
    for (const c of cashFlowAgg) {
      const key = `${c._id.year}-${String(c._id.month).padStart(2, "0")}`;
      const accId = String(c._id.accountId);
      if (!cashFlow[key]) cashFlow[key] = {};
      if (!cashFlow[key][accId]) cashFlow[key][accId] = { income: 0, expenses: 0 };

      if (c._id.type === "Expense") {
        cashFlow[key][accId].expenses += Math.abs(c.total);
      } else if (c._id.type === "Income") {
        cashFlow[key][accId].income += c.total;
      }
    }

    // Build daily cash flow map: "YYYY-MM" -> day -> accounts + transaction details
    const dailyCashFlow: Record<string, Record<number, {
      accounts: Record<string, { income: number; expenses: number }>;
      transactions: { description: string; amount: number; type: string }[];
    }>> = {};
    for (const d of dailyCashFlowAgg) {
      const key = `${d._id.year}-${String(d._id.month).padStart(2, "0")}`;
      const day = d._id.day;
      const accId = String(d._id.accountId);
      if (!dailyCashFlow[key]) dailyCashFlow[key] = {};
      if (!dailyCashFlow[key][day]) dailyCashFlow[key][day] = { accounts: {}, transactions: [] };
      if (!dailyCashFlow[key][day].accounts[accId]) dailyCashFlow[key][day].accounts[accId] = { income: 0, expenses: 0 };

      if (d._id.type === "Expense") {
        dailyCashFlow[key][day].accounts[accId].expenses += Math.abs(d.total);
      } else if (d._id.type === "Income") {
        dailyCashFlow[key][day].accounts[accId].income += d.total;
      }
      dailyCashFlow[key][day].transactions.push(...(d.transactions || []));
    }

    // Merge fixed income transactions into the tooltip (no effect on bars/totals)
    for (const d of dailyFixedFlowAgg) {
      const key = `${d._id.year}-${String(d._id.month).padStart(2, "0")}`;
      const day = d._id.day;
      if (!dailyCashFlow[key]) dailyCashFlow[key] = {};
      if (!dailyCashFlow[key][day]) dailyCashFlow[key][day] = { accounts: {}, transactions: [] };
      dailyCashFlow[key][day].transactions.push(...(d.transactions || []));
    }

    return NextResponse.json({
      accounts: accountSummaries,
      recentActivity,
      cashFlow,
      dailyCashFlow,
      allDailyNetFlow,
      holdings,
      stockQuotes,
      trm: trmResult.rate,
    });
  } catch (error) {
    return apiError(error);
  }
}
