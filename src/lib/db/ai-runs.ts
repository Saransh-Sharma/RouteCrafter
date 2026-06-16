import "server-only";

import { and, eq } from "drizzle-orm";
import type { AiResult, AiTaskType, AiUsage } from "@/lib/ai/types";
import { getDb } from "./index";
import { aiRuns } from "./schema";

export async function createCompletedAiRun({
  userId,
  result,
  taskType,
  label,
  source,
  projectId,
}: {
  userId: string;
  result: AiResult;
  taskType: AiTaskType;
  label: string;
  source?: string;
  projectId?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();
  await getDb().insert(aiRuns).values({
    id,
    userId,
    projectId,
    provider: result.provider,
    model: result.model,
    taskType,
    label,
    source,
    credentialSource: result.credentialSource,
    status: "completed",
    usage: result.usage,
    createdAt: now,
    completedAt: now,
  });
  return id;
}

export async function createFailedAiRun({
  userId,
  provider,
  model,
  taskType,
  label,
  source,
  projectId,
  credentialSource,
  error,
}: {
  userId: string;
  provider: string;
  model: string;
  taskType: string;
  label: string;
  source?: string;
  projectId?: string;
  credentialSource: string;
  error: string;
}): Promise<void> {
  const now = new Date();
  await getDb().insert(aiRuns).values({
    id: crypto.randomUUID(),
    userId,
    projectId,
    provider,
    model,
    taskType,
    label,
    source,
    credentialSource,
    status: "failed",
    usage: undefined as AiUsage | undefined,
    createdAt: now,
    completedAt: now,
    error,
  });
}

export async function markAiRunApplied({
  userId,
  aiRunId,
  projectId,
  projectRevision,
  assetId,
}: {
  userId: string;
  aiRunId: string;
  projectId?: string;
  projectRevision?: number;
  assetId?: string;
}): Promise<void> {
  await getDb()
    .update(aiRuns)
    .set({
      projectId,
      projectRevision,
      assetId,
      appliedAt: new Date(),
    })
    .where(and(eq(aiRuns.userId, userId), eq(aiRuns.id, aiRunId)));
}
