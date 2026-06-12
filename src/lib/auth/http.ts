import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";

const MAX_AUTH_BODY_BYTES = 10_000;

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  error: string,
): Promise<ParsedBody<T>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Request body is too large" },
        { status: 413 },
      ),
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error }, { status: 400 }),
    };
  }

  return { ok: true, data: parsed.data };
}

export function getClientIp(request: Request | NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function authIdentifier(
  request: Request | NextRequest,
  username: string,
): string {
  return `${getClientIp(request)}:${username.trim().toLowerCase()}`;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
