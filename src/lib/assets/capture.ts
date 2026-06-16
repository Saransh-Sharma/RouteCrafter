"use client";

import type {
  AssetDTO,
  AssetSource,
  AssetType,
  AssetUsageType,
} from "@/lib/persistence/types";

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

  const response = await fetch("/api/assets/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? "Could not save asset to the library.");
  }
  return body.asset as AssetDTO;
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
  const response = await fetch(`/api/assets/${assetId}/usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      usageType,
      entityId,
      fieldPath,
      projectRevision,
      replaceExisting,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not record asset usage.");
  }
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
      fetch(`/api/ai/runs/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, projectRevision, assetId }),
      }).catch(() => undefined),
    ),
  );
}
