import type {
  AssetDTO,
  AssetType,
  AssetUsageType,
} from "@/lib/persistence/types";
import { requestJson, requestJsonResult, type ClientApiResult } from "./http";

export interface ListAssetsParams {
  limit?: number;
  country?: string;
  assetType?: AssetType;
}

export interface ListAssetsBody {
  assets?: AssetDTO[];
  facets?: { countries?: string[]; assetTypes?: AssetType[] };
}

export type AssetsResult<T> = ClientApiResult<T>;

export function listAssets(
  params: ListAssetsParams = {},
  signal?: AbortSignal,
): Promise<ListAssetsBody> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.country) query.set("country", params.country);
  if (params.assetType) query.set("assetType", params.assetType);
  const suffix = query.size ? `?${query.toString()}` : "";
  return requestJson<ListAssetsBody>(
    `/api/assets${suffix}`,
    { signal },
    "Could not load assets.",
  );
}

export function deleteAsset(
  id: string,
): Promise<AssetsResult<{ ok?: boolean }>> {
  return requestJsonResult(`/api/assets/${id}`, { method: "DELETE" });
}

export function uploadAsset(form: FormData): Promise<{ asset?: AssetDTO }> {
  return requestJson<{ asset?: AssetDTO }>(
    "/api/assets/upload",
    {
      method: "POST",
      body: form,
    },
    "Could not save asset to the library.",
  );
}

export function recordAssetUsage(input: {
  assetId: string;
  usageType: AssetUsageType;
  entityId?: string;
  fieldPath: string;
  projectRevision?: number;
  replaceExisting?: boolean;
}): Promise<{ ok?: boolean }> {
  return requestJson<{ ok?: boolean }>(
    `/api/assets/${input.assetId}/usage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usageType: input.usageType,
        entityId: input.entityId,
        fieldPath: input.fieldPath,
        projectRevision: input.projectRevision,
        replaceExisting: input.replaceExisting,
      }),
    },
    "Could not record asset usage.",
  );
}

export function markAiRunApplied(
  id: string,
  input: {
    projectId?: string;
    projectRevision?: number;
    assetId?: string;
  },
): Promise<ClientApiResult<{ ok?: boolean }>> {
  return requestJsonResult(`/api/ai/runs/${id}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
