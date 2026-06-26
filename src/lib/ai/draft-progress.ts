import type { DraftProgress } from "./types";

export function upsertProgress(
  prev: DraftProgress[],
  event: DraftProgress,
): DraftProgress[] {
  const index = prev.findIndex((step) => step.id === event.id);
  if (index === -1) return [...prev, event];
  const next = [...prev];
  next[index] = event;
  return next;
}

export function draftedDayCount(progress: DraftProgress[]): number {
  return progress
    .filter((step) => step.kind === "days" && step.status === "done")
    .reduce(
      (total, step) =>
        total +
        (step.dayRange ? step.dayRange[1] - step.dayRange[0] + 1 : 0),
      0,
    );
}

export function visibleDraftProgress(progress: DraftProgress[]): DraftProgress[] {
  return progress.length === 0
    ? [
        {
          id: "overview",
          kind: "overview",
          label: "Overview & guides",
          status: "start",
        },
      ]
    : progress;
}
