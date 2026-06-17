import "server-only";

import { and, desc, eq, isNull, lt } from "drizzle-orm";
import type { AssetDTO, AssetSource, AssetType, AssetUsageType } from "@/lib/persistence/types";
import { getDb } from "./index";
import { assets, assetUsages } from "./schema";

function toAssetDTO(row: typeof assets.$inferSelect): AssetDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    country: row.country,
    editionLabel: row.editionLabel,
    assetType: row.assetType as AssetType,
    source: row.source as AssetSource,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    blobUrl: row.blobUrl,
    blobPathname: row.blobPathname,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createAsset(input: {
  projectId: string;
  userId: string;
  country: string;
  editionLabel?: string | null;
  assetType: AssetType;
  source: AssetSource;
  filename: string;
  mimeType: string;
  sizeBytes?: number | null;
  blobUrl: string;
  blobPathname: string;
  width?: number | null;
  height?: number | null;
  checksum?: string | null;
}): Promise<AssetDTO> {
  const id = crypto.randomUUID();
  const [row] = await getDb()
    .insert(assets)
    .values({
      id,
      projectId: input.projectId,
      userId: input.userId,
      country: input.country,
      editionLabel: input.editionLabel,
      assetType: input.assetType,
      source: input.source,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      blobUrl: input.blobUrl,
      blobPathname: input.blobPathname,
      width: input.width,
      height: input.height,
      checksum: input.checksum,
      createdAt: new Date(),
    })
    .returning();
  return toAssetDTO(row);
}

export async function listAssets({
  userId,
  limit = 60,
  cursor,
  projectId,
  country,
  assetType,
}: {
  userId: string;
  limit?: number;
  cursor?: string | null;
  projectId?: string | null;
  country?: string | null;
  assetType?: AssetType | null;
}): Promise<AssetDTO[]> {
  const createdBefore = cursor ? new Date(cursor) : null;
  const filters = [
    eq(assets.userId, userId),
    isNull(assets.deletedAt),
    createdBefore ? lt(assets.createdAt, createdBefore) : undefined,
    projectId ? eq(assets.projectId, projectId) : undefined,
    country ? eq(assets.country, country) : undefined,
    assetType ? eq(assets.assetType, assetType) : undefined,
  ].filter(Boolean);
  const rows = await getDb()
    .select()
    .from(assets)
    .where(and(...filters))
    .orderBy(desc(assets.createdAt))
    .limit(limit);
  return rows.map(toAssetDTO);
}

export async function getAssetForUser({
  userId,
  assetId,
}: {
  userId: string;
  assetId: string;
}) {
  const row = await getDb().query.assets.findFirst({
    where: and(
      eq(assets.userId, userId),
      eq(assets.id, assetId),
      isNull(assets.deletedAt),
    ),
  });
  return row ? toAssetDTO(row) : null;
}

export async function createAssetUsage(input: {
  assetId: string;
  projectId: string;
  userId: string;
  usageType: AssetUsageType;
  entityId?: string | null;
  fieldPath: string;
  projectRevision?: number | null;
  replaceExisting?: boolean;
}) {
  if (input.replaceExisting) {
    await clearProjectAssetUsage({
      userId: input.userId,
      projectId: input.projectId,
      usageType: input.usageType,
      entityId: input.entityId,
      fieldPath: input.fieldPath,
    });
  }
  await getDb().insert(assetUsages).values({
    id: crypto.randomUUID(),
    assetId: input.assetId,
    projectId: input.projectId,
    userId: input.userId,
    usageType: input.usageType,
    entityId: input.entityId,
    fieldPath: input.fieldPath,
    projectRevision: input.projectRevision,
    createdAt: new Date(),
  });
}

export async function clearProjectAssetUsage({
  userId,
  projectId,
  usageType,
  entityId,
  fieldPath,
}: {
  userId: string;
  projectId: string;
  usageType: AssetUsageType;
  entityId?: string | null;
  fieldPath: string;
}) {
  await getDb()
    .update(assetUsages)
    .set({ clearedAt: new Date() })
    .where(
      and(
        eq(assetUsages.userId, userId),
        eq(assetUsages.projectId, projectId),
        eq(assetUsages.usageType, usageType),
        eq(assetUsages.fieldPath, fieldPath),
        entityId ? eq(assetUsages.entityId, entityId) : isNull(assetUsages.entityId),
        isNull(assetUsages.clearedAt),
      ),
    );
}

export async function getAssetFacets(userId: string): Promise<{
  countries: string[];
  assetTypes: AssetType[];
}> {
  const rows = await getDb()
    .select({
      country: assets.country,
      assetType: assets.assetType,
    })
    .from(assets)
    .where(and(eq(assets.userId, userId), isNull(assets.deletedAt)));
  return {
    countries: Array.from(
      new Set(rows.map((row) => row.country).filter(Boolean)),
    ).sort(),
    assetTypes: Array.from(
      new Set(rows.map((row) => row.assetType as AssetType).filter(Boolean)),
    ).sort(),
  };
}

export async function clearAssetUsage({
  userId,
  assetId,
  fieldPath,
}: {
  userId: string;
  assetId: string;
  fieldPath?: string;
}) {
  await getDb()
    .update(assetUsages)
    .set({ clearedAt: new Date() })
    .where(
      and(
        eq(assetUsages.userId, userId),
        eq(assetUsages.assetId, assetId),
        isNull(assetUsages.clearedAt),
        fieldPath ? eq(assetUsages.fieldPath, fieldPath) : undefined,
      ),
    );
}

export async function countActiveAssetUsages({
  userId,
  assetId,
}: {
  userId: string;
  assetId: string;
}): Promise<number> {
  const rows = await getDb()
    .select({ id: assetUsages.id })
    .from(assetUsages)
    .where(
      and(
        eq(assetUsages.userId, userId),
        eq(assetUsages.assetId, assetId),
        isNull(assetUsages.clearedAt),
      ),
    );
  return rows.length;
}

export async function softDeleteAsset({
  userId,
  assetId,
}: {
  userId: string;
  assetId: string;
}) {
  await getDb()
    .update(assets)
    .set({ deletedAt: new Date() })
    .where(and(eq(assets.userId, userId), eq(assets.id, assetId)));
}
