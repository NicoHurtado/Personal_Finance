import { NextResponse } from "next/server";
import { fetchTrm } from "@/lib/trm";

export async function GET() {
  try {
    const result = await fetchTrm();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
