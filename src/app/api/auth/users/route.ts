import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";

/**
 * GET /api/auth/users — returns id + name (legacy / admin).
 * Login uses codes only; this endpoint is not required for sign-in.
 */
export async function GET() {
  try {
    await connectDB();
    const users = await User.find({}, { name: 1 }).sort({ name: 1 }).lean();
    return NextResponse.json(
      users.map((u) => ({ id: String(u._id), name: u.name }))
    );
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
