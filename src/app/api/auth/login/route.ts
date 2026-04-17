import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { signToken, buildSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!code) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
    }

    await connectDB();
    const users = await User.find().select("_id name email passwordHash").lean();
    if (users.length === 0) {
      return NextResponse.json({ error: "No hay usuarios registrados" }, { status: 500 });
    }

    let user: (typeof users)[number] | null = null;
    for (const u of users) {
      if (await bcrypt.compare(code, u.passwordHash)) {
        user = u;
        break;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
    }

    const sessionUser = { userId: String(user._id), email: user.email, name: user.name };
    const token = signToken(sessionUser);
    const response = NextResponse.json({ user: { name: user.name } });
    response.headers.set("Set-Cookie", buildSessionCookie(token));
    return response;
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
