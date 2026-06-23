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

function templateValues(template: Template, userId: string) {
  const normalized = normalizeTemplate(template);
  return {
    id: normalized.id,
    userId,
    name: normalized.name,
    category: normalized.category,
    accent: normalized.accent,
    data: normalized,
    createdAt: new Date(normalized.createdAt),
    updatedAt: new Date(normalized.updatedAt),
    deletedAt: null,
    updatedByUserId: userId,
  };
}

export async function listTemplates(): Promise<Template[]> {
  const rows = await getDb()
    .select()
    .from(templates)
    .where(isNull(templates.deletedAt))
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
    where: eq(templates.id, normalized.id),
  });
  if (existing) {
    const [updated] = await getDb()
      .update(templates)
      .set({
        ...templateValues(normalized, user.id),
        userId: existing.userId,
        createdAt: existing.createdAt,
      })
      .where(eq(templates.id, normalized.id))
      .returning();
    return rowToTemplate(updated);
  }
  const [inserted] = await getDb()
    .insert(templates)
    .values(templateValues(normalized, user.id))
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
    .where(and(eq(templates.id, templateId), isNull(templates.deletedAt)));
}
