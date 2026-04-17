import { NextResponse } from "next/server";
import { buildLogoutCookie } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out" });
  response.headers.set("Set-Cookie", buildLogoutCookie());
  return response;
}
