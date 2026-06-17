import "server-only";

import { desc, eq, and } from "drizzle-orm";
import type { Project } from "@/lib/types";
import { getDb } from "./index";
import { projectVersions } from "./schema";

export type ProjectVersionReason =
  | "imported"
  | "before-cloud-migration"
  | "manual-backup"
  | "published"
  | "major-ai-apply"
  | "deleted";

export async function createProjectVersion({
  project,
  userId,
  revision,
  reason,
}: {
  project: Project;
  userId: string;
  revision: number;
  reason: ProjectVersionReason;
}): Promise<void> {
  await getDb().insert(projectVersions).values({
    id: crypto.randomUUID(),
    projectId: project.id,
    userId,
    revision,
    snapshot: project,
    reason,
    createdAt: new Date(),
  });
}

export async function listProjectVersions({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) {
  return getDb()
    .select()
    .from(projectVersions)
    .where(
      and(
        eq(projectVersions.userId, userId),
        eq(projectVersions.projectId, projectId),
      ),
    )
    .orderBy(desc(projectVersions.createdAt))
    .limit(50);
}
