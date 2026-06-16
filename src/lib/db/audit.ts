import "server-only";

import { createHash } from "node:crypto";
import { getClientIp } from "@/lib/auth/http";
import type { NextRequest } from "next/server";
import { getDb } from "./index";
import { auditEvents } from "./schema";

function hashIp(value: string): string {
  return createHash("sha256")
    .update(`${process.env.NEXTAUTH_SECRET ?? "routecrafter"}:${value}`)
    .digest("hex");
}

export async function createAuditEvent({
  request,
  userId,
  eventType,
  metadata,
}: {
  request?: Request | NextRequest;
  userId?: string | null;
  eventType: string;
  metadata?: unknown;
}): Promise<void> {
  await getDb().insert(auditEvents).values({
    id: crypto.randomUUID(),
    userId,
    eventType,
    ipHash: request ? hashIp(getClientIp(request)) : null,
    userAgent: request?.headers.get("user-agent") ?? null,
    metadata,
    createdAt: new Date(),
  });
}
