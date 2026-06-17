import "server-only";

import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { ActivityAction, ActivityLogEntry } from "@/lib/schemas/activity";
import type { User } from "@/lib/schemas/auth";
import { getDb } from "./index";
import { activityLogs } from "./schema";

export interface CreateActivityInput {
  projectId: string;
  ownerUserId: string;
  actor: Pick<User, "id" | "displayName">;
  action: ActivityAction;
  detail: string;
  entityType?: string;
  entityId?: string;
  metadata?: unknown;
  clientEventId?: string;
}

export async function createActivity(input: CreateActivityInput): Promise<void> {
  const metadata =
    input.clientEventId && input.metadata && typeof input.metadata === "object"
      ? { ...(input.metadata as Record<string, unknown>), clientEventId: input.clientEventId }
      : input.clientEventId
        ? { clientEventId: input.clientEventId }
        : input.metadata;
  if (input.clientEventId) {
    const existing = await getDb()
      .select({ id: activityLogs.id })
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.userId, input.ownerUserId),
          eq(activityLogs.projectId, input.projectId),
          sql`${activityLogs.metadata} @> ${JSON.stringify({
            clientEventId: input.clientEventId,
          })}::jsonb`,
        ),
      )
      .limit(1);
    if (existing.length > 0) return;
  }
  await getDb().insert(activityLogs).values({
    id: crypto.randomUUID(),
    projectId: input.projectId,
    userId: input.ownerUserId,
    actorUserId: input.actor.id,
    actorName: input.actor.displayName,
    action: input.action,
    detail: input.detail,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata,
    createdAt: new Date(),
  });
}

export async function listProjectActivity({
  userId,
  projectId,
  limit = 50,
  cursor,
}: {
  userId: string;
  projectId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<ActivityLogEntry[]> {
  const createdBefore = cursor ? new Date(cursor) : null;
  const rows = await getDb()
    .select()
    .from(activityLogs)
    .where(
      createdBefore
        ? and(
            eq(activityLogs.userId, userId),
            eq(activityLogs.projectId, projectId),
            lt(activityLogs.createdAt, createdBefore),
          )
        : and(
            eq(activityLogs.userId, userId),
            eq(activityLogs.projectId, projectId),
          ),
    )
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
  return rows
    .map((row) => ({
      id: row.id,
      projectId: row.projectId,
      userId: row.actorUserId,
      userName: row.actorName,
      action: row.action as ActivityAction,
      detail: row.detail,
      timestamp: row.createdAt.toISOString(),
    }));
}
