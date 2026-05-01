import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Category } from "@/models/Category";
import { apiError } from "@/lib/api-utils";

export async function GET() {
  try {
    await connectDB();
    const categories = await Category.find({}).sort({ name: 1 }).lean();
    return NextResponse.json(categories);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { name, color, key } = await request.json();

    if (!name || !color) {
      return NextResponse.json(
        { error: "name and color are required" },
        { status: 400 }
      );
    }

    const category = await Category.create({ name, color, ...(key ? { key } : {}) });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
