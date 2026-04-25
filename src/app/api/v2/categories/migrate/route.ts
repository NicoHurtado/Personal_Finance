import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { Category } from "@/models/Category";
import { User } from "@/models/User";
import { apiError } from "@/lib/api-utils";

const UNIFIED_CATEGORIES = [
  { name: "Pago", key: "pago", color: "#00D47E" },
  { name: "Retiro", key: "retiro", color: "#4A9B8E" },
  { name: "Salud", key: "salud", color: "#E85D75" },
  { name: "Comida", key: "comida", color: "#F59E0B" },
  { name: "Tecnologia", key: "tecnologia", color: "#4FB7C2" },
  { name: "Servicio", key: "servicio", color: "#7A8B90" },
  { name: "Entretenimiento", key: "entretenimiento", color: "#8B5CF6" },
  { name: "Antojo", key: "antojo", color: "#F97316" },
  { name: "Transporte", key: "transporte", color: "#3B82F6" },
];

export async function POST(request: NextRequest) {
  try {
    const user = getCurrentUser();
    await connectDB();

    const url = new URL(request.url);
    const all = url.searchParams.get("all") === "true";

    if (all) {
      const users = await User.find().select("_id").lean();
      const userIds = users.map((u) => u._id);
      await Category.deleteMany({ userId: { $in: userIds } });
      await Category.insertMany(
        userIds.flatMap((uid) => UNIFIED_CATEGORIES.map((c) => ({ ...c, userId: uid })))
      );
      return NextResponse.json({ message: "Categories migrated for all users", users: users.length, count: UNIFIED_CATEGORIES.length });
    }

    await Category.deleteMany({ userId: user._id });
    await Category.insertMany(UNIFIED_CATEGORIES.map((c) => ({ ...c, userId: user._id })));
    return NextResponse.json({ message: "Categories migrated", count: UNIFIED_CATEGORIES.length });
  } catch (error) {
    return apiError(error);
  }
}
