import type { ActivityLogEntry } from "@/lib/schemas/activity";
import { requestJson } from "./http";

export function listProjectActivity(
  projectId: string,
  limit = 100,
  signal?: AbortSignal,
): Promise<{ entries?: ActivityLogEntry[] }> {
  return requestJson<{ entries?: ActivityLogEntry[] }>(
    `/api/projects/${projectId}/activity?limit=${limit}`,
    { signal },
    "Activity unavailable.",
  );
}
