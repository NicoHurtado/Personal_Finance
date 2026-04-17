import { NextResponse } from "next/server";

/**
 * Standard API error response. Returns 401 for auth errors, 500 otherwise.
 */
export function apiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ error: message }, { status: 500 });
}
