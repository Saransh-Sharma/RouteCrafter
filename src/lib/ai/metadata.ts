import type { AiAcceptedRun, Project } from "@/lib/types";
import type { AiResult, AiTaskType } from "./types";

export function createAiRunMetadata({
  result,
  taskType,
  label,
  source,
}: {
  result: AiResult;
  taskType: AiTaskType;
  label: string;
  source?: string;
}): AiAcceptedRun {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    provider: result.provider,
    model: result.model,
    taskType,
    label,
    createdAt: now,
    appliedAt: now,
    usage: result.usage,
    source,
  };
}

export function appendAiRun(
  project: Project,
  run: AiAcceptedRun,
): AiAcceptedRun[] {
  return [...(project.aiRuns ?? []), run];
}
