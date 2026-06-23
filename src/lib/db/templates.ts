import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import type { User } from "@/lib/schemas/auth";
import { templateSchema, type Template } from "@/lib/schemas";
import { ensureUser } from "./users";
import { getDb } from "./index";
import { templates } from "./schema";

function normalizeTemplate(raw: unknown): Template {
  return templateSchema.parse(raw);
}

function rowToTemplate(row: typeof templates.$inferSelect): Template {
  return normalizeTemplate(row.data);
}

function templateValues(
  template: Template,
  userId: string,
  timestamps: { createdAt: Date; updatedAt: Date },
) {
  const normalized = normalizeTemplate(template);
  const data = {
    ...normalized,
    createdAt: timestamps.createdAt.toISOString(),
    updatedAt: timestamps.updatedAt.toISOString(),
  };
  return {
    id: normalized.id,
    userId,
    name: normalized.name,
    category: normalized.category,
    accent: normalized.accent,
    data,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
    deletedAt: null,
    updatedByUserId: userId,
  };
}

export async function listTemplates(user: User): Promise<Template[]> {
  await ensureUser(user);
  const rows = await getDb()
    .select()
    .from(templates)
    .where(and(eq(templates.userId, user.id), isNull(templates.deletedAt)))
    .orderBy(desc(templates.updatedAt));
  return rows.map(rowToTemplate);
}

export async function upsertTemplateForUser({
  user,
  template,
}: {
  user: User;
  template: unknown;
}): Promise<Template> {
  await ensureUser(user);
  const normalized = normalizeTemplate(template);
  const existing = await getDb().query.templates.findFirst({
    where: and(eq(templates.id, normalized.id), eq(templates.userId, user.id)),
  });
  const updatedAt = new Date();
  if (existing) {
    const [updated] = await getDb()
      .update(templates)
      .set({
        ...templateValues(normalized, user.id, {
          createdAt: existing.createdAt,
          updatedAt,
        }),
      })
      .where(and(eq(templates.id, normalized.id), eq(templates.userId, user.id)))
      .returning();
    return rowToTemplate(updated);
  }
  const createdAt = new Date();
  const [inserted] = await getDb()
    .insert(templates)
    .values(templateValues(normalized, user.id, { createdAt, updatedAt: createdAt }))
    .returning();
  return rowToTemplate(inserted);
}

export async function deleteTemplateForUser({
  user,
  templateId,
}: {
  user: User;
  templateId: string;
}): Promise<void> {
  await ensureUser(user);
  await getDb()
    .update(templates)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedByUserId: user.id,
    })
    .where(
      and(
        eq(templates.id, templateId),
        eq(templates.userId, user.id),
        isNull(templates.deletedAt),
      ),
    );
}
