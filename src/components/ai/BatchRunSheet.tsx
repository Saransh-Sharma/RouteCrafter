"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import type { BatchRunPlan } from "@/lib/ai/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { BatchRunCallbacks } from "@/lib/ai/batch";

export function BatchRunSheet({
  open,
  onOpenChange,
  plan,
  onRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: BatchRunPlan;
  onRun: (signal: AbortSignal, callbacks: BatchRunCallbacks) => Promise<void>;
}) {
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!open || !mounted) return null;
  return createPortal(
    <BatchRunSheetDialog
      plan={plan}
      onRun={onRun}
      onClose={() => onOpenChange(false)}
    />,
    document.body,
  );
}

function BatchRunSheetDialog({
  plan,
  onRun,
  onClose,
}: {
  plan: BatchRunPlan;
  onRun: (signal: AbortSignal, callbacks: BatchRunCallbacks) => Promise<void>;
  onClose: () => void;
}) {
  const [running, setRunning] = React.useState(false);
  const [statuses, setStatuses] = React.useState(
    () => new Map(plan.steps.map((step) => [step.id, step.status])),
  );
  const [completedResults, setCompletedResults] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const panelRef = useDialogFocus({
    open: true,
    onClose,
    onCancel: running ? () => abortRef.current?.abort() : undefined,
  });

  async function run() {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setCompletedResults(0);
    setStatuses(new Map(plan.steps.map((step) => [step.id, "pending"])));
    try {
      await onRun(controller.signal, {
        onStepStart: ({ step }) =>
          setStatuses((current) => new Map(current).set(step.id, "running")),
        onStepComplete: ({ step }) => {
          setStatuses((current) => new Map(current).set(step.id, "completed"));
          setCompletedResults((count) => count + 1);
        },
        onStepError: ({ step, error: stepError }) => {
          setStatuses((current) => new Map(current).set(step.id, step.status));
          if (stepError) setError(stepError);
        },
      });
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "The batch run did not complete.",
      );
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-ink/35 px-3 py-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-run-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl border border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] shadow-[var(--shadow-lift)] outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)]/50 px-5 py-4">
          <div>
            <h2 id="batch-run-title" className="text-lg font-semibold text-ink">
              {plan.label}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {plan.estimatedCostLabel
                ? `Estimated total ${plan.estimatedCostLabel}.`
                : "Review the playlist before running."}{" "}
              Results are still previewed before they overwrite content.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close batch run"
            className="rounded-full p-2 text-ink-soft hover:bg-paper/70 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            {plan.steps.map((step, index) => {
              const status = statuses.get(step.id) ?? step.status;
              const done = status === "completed";
              const active = status === "running";
              const failed = status === "error" || status === "cancelled";
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border-soft bg-paper/70 px-3 py-2.5",
                    active && "border-[var(--rc-ai-border)]",
                    failed && "border-terracotta/35",
                  )}
                >
                  <span className="grid size-7 place-items-center rounded-full bg-sage-soft text-forest">
                    {done ? (
                      <Check className="size-4" />
                    ) : active ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : failed ? (
                      <X className="size-4" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                    {step.label}
                  </span>
                  {step.costLabel ? (
                    <span className="text-xs text-ink-muted">{step.costLabel}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
          {error ? <p className="text-sm text-terracotta">{error}</p> : null}
          {completedResults ? (
            <p className="text-xs text-ink-muted">
              {completedResults} step{completedResults === 1 ? "" : "s"} completed.
              Review completed outputs before applying them.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {running ? (
              <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                Stop
              </Button>
            ) : (
              <Button onClick={() => void run()}>
                <Sparkles className="size-4" />
                Run playlist
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
