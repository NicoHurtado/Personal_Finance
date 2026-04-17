import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Holding } from "@/models/Holding";
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

    const holding = await Holding.findOneAndUpdate(
      { _id: id, userId: user._id },
      body,
      { new: true }
    );
    if (!holding) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(holding);
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

    const holding = await Holding.findOneAndDelete({
      _id: id,
      userId: user._id,
    });
    if (!holding) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
