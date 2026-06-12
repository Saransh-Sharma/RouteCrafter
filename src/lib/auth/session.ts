import { cookies } from "next/headers";
import { verifyToken } from "./jwt";
import { findUserById } from "./users";
import type { User } from "../schemas/auth";

export const SESSION_COOKIE_NAME = "rc-session";

/**
 * Read the session cookie and return the authenticated user, or null.
 * Works in Server Components, Route Handlers, and Server Actions.
 */
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  return findUserById(payload.userId) ?? null;
}
