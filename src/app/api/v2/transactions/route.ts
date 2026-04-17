import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Account } from "@/models/Account";
import { TransactionV2 } from "@/models/TransactionV2";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const user = getCurrentUser();
    await connectDB();
    const { searchParams } = request.nextUrl;

    const accountSlug = searchParams.get("account");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50", 10));
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "";
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { userId: user._id };

    if (accountSlug) {
      const account = await Account.findOne({
        userId: user._id,
        slug: accountSlug,
      }).lean();
      if (!account) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
      filter.accountId = account._id;
    }

    if (search) {
      filter.description = { $regex: search, $options: "i" };
    }
    if (type) {
      filter.type = type;
    }

    const [data, total] = await Promise.all([
      TransactionV2.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TransactionV2.countDocuments(filter),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getCurrentUser();
    await connectDB();
    const body = await request.json();

    const { accountSlug, date, description, amount, type, categoryId, metadata } =
      body;

    if (!accountSlug || !date || amount === undefined || !type) {
      return NextResponse.json(
        { error: "accountSlug, date, amount, and type are required" },
        { status: 400 }
      );
    }

    const account = await Account.findOne({
      userId: user._id,
      slug: accountSlug,
    });
    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const absAmount = Math.abs(amount);
    const signedAmount = (type === "Expense" || type === "Withdrawal") ? -absAmount : absAmount;

    const doc = await TransactionV2.create({
      userId: user._id,
      accountId: account._id,
      date,
      description: description || "Transaction",
      amount: signedAmount,
      type,
      categoryId: categoryId || null,
      metadata: metadata || {},
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
