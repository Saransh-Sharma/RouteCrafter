"use client";

import { ArrowRight, CircleAlert } from "lucide-react";
import type { Project } from "@/lib/types";
import type { ProjectWorkflow, WorkflowStageId } from "@/lib/workflow";
import { Input } from "@/components/ui/field";
import { useProjectsStore } from "@/lib/store/projects-store";

export function NextActionCard({
  project,
  workflow,
  onNavigate,
}: {
  project: Project;
  workflow: ProjectWorkflow;
  onNavigate: (stage: WorkflowStageId, params?: Record<string, string | undefined>) => void;
}) {
  const update = useProjectsStore((state) => state.update);
  const stageBlockers = workflow.blockers.filter(
    (issue) => issue.stage === workflow.recommendedStage,
  );
  const firstBlocker = stageBlockers[0];

  return (
    <section className="relative overflow-hidden border-y border-border-strong bg-paper/55 px-5 py-5 sm:px-7">
      <div className="absolute inset-y-0 left-0 w-1 bg-terracotta" />
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-terracotta">
            Recommended next move
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">
            {workflow.recommendedAction}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {firstBlocker?.label ?? workflow.recommendedReason}
          </p>
          {workflow.recommendedStage === "define" && !project.country.trim() ? (
            <div className="mt-4 max-w-sm">
              <Input
                placeholder="Destination country"
                defaultValue={project.country}
                onBlur={(event) =>
                  update(project.id, { country: event.target.value.trim() })
                }
              />
            </div>
          ) : stageBlockers.length ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
              <CircleAlert className="size-3.5 text-terracotta" />
              {stageBlockers.length} task{stageBlockers.length === 1 ? "" : "s"} in this stage
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() =>
            onNavigate(workflow.recommendedStage, {
              edition: firstBlocker?.editionId,
              tool: firstBlocker?.tool,
            })
          }
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-paper transition-colors hover:bg-forest-deep"
        >
          Open recommended stage
          <ArrowRight className="size-4" />
        </button>
      </div>
    </section>
  );
}
