import { getSessionFromCookies, type SessionPayload } from "@/lib/session";
import { Types } from "mongoose";

export interface SessionUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
}

/**
 * Returns the authenticated user from the JWT session cookie.
 * Trusts the verified JWT payload — no DB roundtrip.
 * Throws "UNAUTHORIZED" if no valid session.
 */
export function getCurrentUser(): SessionUser {
  const session = getSessionFromCookies();
  if (!session) throw new Error("UNAUTHORIZED");

  return {
    _id: new Types.ObjectId(session.userId),
    name: session.name,
    email: session.email,
  };
}

/**
 * Returns the raw session payload without ObjectId conversion.
 */
export function getSession(): SessionPayload | null {
  return getSessionFromCookies();
}
