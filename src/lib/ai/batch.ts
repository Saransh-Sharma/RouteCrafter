import type {
  AiResult,
  AiTextRequest,
  BatchRunPlan,
  BatchRunStep,
} from "./types";
import { streamAiText } from "./client";

export interface BatchTextStep extends BatchRunStep {
  request: AiTextRequest;
}

export interface BatchRunProgress {
  step: BatchTextStep;
  index: number;
  result?: AiResult;
  error?: string;
  delta?: string;
}

export interface BatchRunCallbacks {
  onStepStart?: (progress: BatchRunProgress) => void;
  onStepDelta?: (progress: BatchRunProgress) => void;
  onStepComplete?: (progress: BatchRunProgress) => void;
  onStepError?: (progress: BatchRunProgress) => void;
}

export function createBatchRunPlan(input: {
  id: string;
  label: string;
  steps: BatchTextStep[];
  estimatedCostLabel?: string;
}): BatchRunPlan {
  return {
    id: input.id,
    label: input.label,
    estimatedCostLabel: input.estimatedCostLabel,
    steps: input.steps.map((step) => ({
      id: step.id,
      label: step.label,
      taskType: step.taskType,
      status: step.status,
      costLabel: step.costLabel,
      error: step.error,
    })),
  };
}

export async function runBatchTextSteps({
  steps,
  signal,
  onProgress,
  onStepStart,
  onStepDelta,
  onStepComplete,
  onStepError,
}: {
  steps: BatchTextStep[];
  signal?: AbortSignal;
  onProgress?: (progress: BatchRunProgress) => void;
} & BatchRunCallbacks): Promise<AiResult[]> {
  const results: AiResult[] = [];
  for (const [index, step] of steps.entries()) {
    if (signal?.aborted) break;
    const started = { step: { ...step, status: "running" as const }, index };
    onProgress?.(started);
    onStepStart?.(started);
    try {
      const result = await streamAiText(step.request, {
        signal,
        onToken: (delta) => {
          const progress = {
            step: { ...step, status: "running" as const },
            index,
            delta,
          };
          onProgress?.(progress);
          onStepDelta?.(progress);
        },
      });
      results.push(result);
      const completed = {
        step: { ...step, status: "completed" as const },
        index,
        result,
      };
      onProgress?.(completed);
      onStepComplete?.(completed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The batch step failed.";
      const failed = {
        step: { ...step, status: signal?.aborted ? "cancelled" : "error" },
        index,
        error: message,
      } satisfies BatchRunProgress;
      onProgress?.(failed);
      onStepError?.(failed);
      if (!signal?.aborted) throw error;
    }
  }
  return results;
}
