import "server-only";

import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { unauthorizedResponse } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";
import { ensureRequestUser } from "@/lib/db/request-user";
import type { User } from "@/lib/schemas/auth";
import { errorResponse } from "./errors";

export interface RouteUserContext {
  user: User;
  requestUser: User;
}

export type ParsedRouteBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export function withUser<Args extends unknown[]>(
  handler: (
    auth: RouteUserContext,
    ...args: Args
  ) => Response | Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      const user = await getSessionUser();
      if (!user) return unauthorizedResponse();
      const requestUser = await ensureRequestUser(user);
      return await handler({ user, requestUser }, ...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
  errorMessage: string,
): Promise<ParsedRouteBody<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonBadRequest(errorMessage) };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: jsonBadRequest(errorMessage) };
  }
  return { ok: true, data: parsed.data };
}

export function jsonNoStore(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export function jsonBadRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
