import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { TransactionV2 } from "@/models/TransactionV2";
import { apiError } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getCurrentUser();
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    if (body.amount !== undefined && body.type) {
      const absAmount = Math.abs(body.amount);
      body.amount = body.type === "Expense" ? -absAmount : absAmount;
    } else if (body.amount !== undefined) {
      const existing = await TransactionV2.findOne({ _id: id, userId: user._id });
      if (existing) {
        const type = body.type || existing.type;
        const absAmount = Math.abs(body.amount);
        body.amount = type === "Expense" ? -absAmount : absAmount;
      }
    }

    const updated = await TransactionV2.findOneAndUpdate(
      { _id: id, userId: user._id },
      body,
      { new: true, runValidators: true }
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getCurrentUser();
    await connectDB();
    const { id } = await params;

    const deleted = await TransactionV2.findOneAndDelete({
      _id: id,
      userId: user._id,
    });
    if (!deleted) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    return apiError(error);
  }
}
