"use client";

import type {
  AssetDTO,
  AssetSource,
  AssetType,
  AssetUsageType,
} from "@/lib/persistence/types";
import {
  markAiRunApplied as markAiRunAppliedRequest,
  recordAssetUsage as recordAssetUsageRequest,
  uploadAsset,
} from "@/lib/client/assets-api";

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(",");
  if (!header || !payload) throw new Error("Invalid data URL.");
  const mime = header.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

export function isDataUrl(value: string): boolean {
  return value.startsWith("data:");
}

export async function captureAsset({
  projectId,
  assetType,
  source,
  file,
  filename,
  usageType,
  entityId,
  fieldPath,
  editionLabel,
}: {
  projectId: string;
  assetType: AssetType;
  source: AssetSource;
  file: File | Blob;
  filename: string;
  usageType?: AssetUsageType;
  entityId?: string;
  fieldPath?: string;
  editionLabel?: string;
}): Promise<AssetDTO> {
  const form = new FormData();
  form.set("projectId", projectId);
  form.set("assetType", assetType);
  form.set("source", source);
  form.set("filename", filename);
  form.set("file", file, filename);
  void usageType;
  void entityId;
  void fieldPath;
  if (editionLabel) form.set("editionLabel", editionLabel);

  const body = await uploadAsset(form);
  if (!body.asset) throw new Error("Could not save asset to the library.");
  return body.asset;
}

export async function recordAssetUsage({
  assetId,
  usageType,
  entityId,
  fieldPath,
  projectRevision,
  replaceExisting = true,
}: {
  assetId: string;
  usageType: AssetUsageType;
  entityId?: string;
  fieldPath: string;
  projectRevision?: number;
  replaceExisting?: boolean;
}): Promise<void> {
  await recordAssetUsageRequest({
    assetId,
    usageType,
    entityId,
    fieldPath,
    projectRevision,
    replaceExisting,
  });
}

export async function markAiRunApplied({
  aiRunId,
  aiRunIds,
  projectId,
  projectRevision,
  assetId,
}: {
  aiRunId?: string;
  aiRunIds?: string[];
  projectId?: string;
  projectRevision?: number;
  assetId?: string;
}): Promise<void> {
  const ids = Array.from(
    new Set(
      [aiRunId, ...(aiRunIds ?? [])].filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  );
  await Promise.all(
    ids.map((id) =>
      markAiRunAppliedRequest(id, {
        projectId,
        projectRevision,
        assetId,
      }).catch(() => undefined),
    ),
  );
}
