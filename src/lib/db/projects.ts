import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { User } from "@/lib/schemas/auth";
import {
  CURRENT_SCHEMA_VERSION,
  projectSchema,
  type Project,
} from "@/lib/schemas";
import { normalizeProject } from "@/lib/project-normalization";
import type { CloudProject } from "@/lib/persistence/types";
import { ensureUser } from "./users";
import { createActivity } from "./activity";
import { createProjectVersion } from "./project-versions";
import { getDb } from "./index";
import { projects } from "./schema";

export class ProjectConflictError extends Error {
  status = 409;
}

export class ProjectNotFoundError extends Error {
  status = 404;
}

export class ProjectRevisionRequiredError extends Error {
  status = 409;
}

function rowToCloudProject(row: typeof projects.$inferSelect): CloudProject {
  return {
    project: normalizeProject(row.data),
    revision: row.revision,
  };
}

function projectValues(project: Project, userId: string, revision: number) {
  const normalized = normalizeProject(project);
  return {
    id: normalized.id,
    userId,
    name: normalized.name,
    country: normalized.country,
    status: normalized.status,
    schemaVersion: normalized.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    revision,
    data: normalized,
    createdAt: new Date(normalized.createdAt),
    updatedAt: new Date(normalized.updatedAt),
    deletedAt: null,
    updatedByUserId: userId,
  };
}

export async function listProjectsForUser(userId: string): Promise<CloudProject[]> {
  const rows = await getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.updatedAt));
  return rows.map(rowToCloudProject);
}

export async function getProjectForUser({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<CloudProject | null> {
  const row = await getDb().query.projects.findFirst({
    where: and(
      eq(projects.userId, userId),
      eq(projects.id, projectId),
      isNull(projects.deletedAt),
    ),
  });
  return row ? rowToCloudProject(row) : null;
}

export async function upsertProjectForUser({
  user,
  project,
  expectedRevision,
  activityDetail,
  activityAction = "updated",
}: {
  user: User;
  project: unknown;
  expectedRevision?: number;
  activityDetail?: string;
  activityAction?: "created" | "updated" | "imported" | "duplicated";
}): Promise<CloudProject> {
  await ensureUser(user);
  const normalized = projectSchema.parse(normalizeProject(project));
  const existing = await getDb().query.projects.findFirst({
    where: and(eq(projects.userId, user.id), eq(projects.id, normalized.id)),
  });

  if (existing?.deletedAt) {
    throw new ProjectNotFoundError("Project was deleted.");
  }
  if (existing) {
    if (expectedRevision === undefined) {
      throw new ProjectRevisionRequiredError(
        "Project revision is required when updating an existing cloud project.",
      );
    }
    const updateValues = projectValues(normalized, user.id, existing.revision + 1);
    const [updated] = await getDb()
      .update(projects)
      .set({
        ...updateValues,
        createdAt: existing.createdAt,
        revision: sql`${projects.revision} + 1`,
      })
      .where(
        and(
          eq(projects.userId, user.id),
          eq(projects.id, normalized.id),
          eq(projects.revision, expectedRevision),
          isNull(projects.deletedAt),
        ),
      )
      .returning();
    if (!updated) {
      const latest = await getDb().query.projects.findFirst({
        where: and(eq(projects.userId, user.id), eq(projects.id, normalized.id)),
      });
      if (!latest || latest.deletedAt) {
        throw new ProjectNotFoundError("Project not found.");
      }
      throw new ProjectConflictError("Project has newer cloud changes.");
    }
    if (activityDetail) {
      await createActivity({
        projectId: normalized.id,
        ownerUserId: user.id,
        actor: user,
        action: activityAction,
        detail: activityDetail,
      });
    }
    return rowToCloudProject(updated);
  } else {
    const [inserted] = await getDb()
      .insert(projects)
      .values(projectValues(normalized, user.id, 1))
      .returning();
    if (activityDetail) {
      await createActivity({
        projectId: normalized.id,
        ownerUserId: user.id,
        actor: user,
        action: "created",
        detail: activityDetail,
      });
    }
    return rowToCloudProject(inserted);
  }
}

export async function bulkSyncProjectsForUser({
  user,
  incoming,
}: {
  user: User;
  incoming: unknown[];
}): Promise<CloudProject[]> {
  await ensureUser(user);
  const existing = await listProjectsForUser(user.id);
  const existingIds = new Set(existing.map((item) => item.project.id));

  const synced: CloudProject[] = [];
  for (const raw of incoming) {
    const normalized = normalizeProject(raw);
    if (existingIds.has(normalized.id)) continue;
    const syncedProject = await upsertProjectForUser({
      user,
      project: normalized,
      activityAction: "imported",
      activityDetail: `Migrated project "${normalized.name}" to cloud storage`,
    });
    await createProjectVersion({
      project: normalized,
      userId: user.id,
      revision: syncedProject.revision,
      reason: "before-cloud-migration",
    });
    synced.push(syncedProject);
  }
  return listProjectsForUser(user.id);
}

export async function softDeleteProjectForUser({
  user,
  projectId,
  expectedRevision,
}: {
  user: User;
  projectId: string;
  expectedRevision?: number;
}): Promise<void> {
  const existing = await getProjectForUser({ userId: user.id, projectId });
  if (!existing) throw new ProjectNotFoundError("Project not found.");
  if (expectedRevision === undefined) {
    throw new ProjectRevisionRequiredError(
      "Project revision is required when deleting a cloud project.",
    );
  }
  const [deleted] = await getDb()
    .update(projects)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      revision: sql`${projects.revision} + 1`,
      updatedByUserId: user.id,
    })
    .where(
      and(
        eq(projects.userId, user.id),
        eq(projects.id, projectId),
        eq(projects.revision, expectedRevision),
        isNull(projects.deletedAt),
      ),
    )
    .returning({ id: projects.id });
  if (!deleted) {
    throw new ProjectConflictError("Project has newer cloud changes.");
  }
  await createProjectVersion({
    project: existing.project,
    userId: user.id,
    revision: existing.revision,
    reason: "deleted",
  });
  await createActivity({
    projectId,
    ownerUserId: user.id,
    actor: user,
    action: "deleted",
    detail: `Deleted project "${existing.project.name}"`,
  });
}
