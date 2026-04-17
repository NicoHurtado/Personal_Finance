import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Category } from "@/models/Category";
import { apiError } from "@/lib/api-utils";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getCurrentUser();
    await connectDB();
    const { id } = await params;

    const deleted = await Category.findOneAndDelete({
      _id: id,
      userId: user._id,
    });
    if (!deleted) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    return apiError(error);
  }
}
