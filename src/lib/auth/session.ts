import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { verifyToken } from "./jwt";
import { findUserById } from "./users";
import type { User } from "../schemas/auth";

export const SESSION_COOKIE_NAME = "rc-session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/**
 * Read the session cookie and return the authenticated user, or null.
 * Works in Server Components, Route Handlers, and Server Actions.
 */
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionUserFromToken(token);
}

export async function getRequestUser(request: NextRequest): Promise<User | null> {
  return getSessionUserFromToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
}

export async function getSessionUserFromToken(
  token: string | undefined,
): Promise<User | null> {
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  return findUserById(payload.userId) ?? null;
}
