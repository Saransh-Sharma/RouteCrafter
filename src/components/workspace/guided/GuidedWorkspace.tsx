"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Loader2,
} from "lucide-react";
import type { Project } from "@/lib/types";
import {
  WORKFLOW_STAGE_ORDER,
  getProjectWorkflow,
  type WorkflowStageId,
} from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { DefineStage } from "./stages/DefineStage";
import { PlanStage } from "./stages/PlanStage";
import { BuildStage } from "./stages/BuildStage";
import { PackageStage } from "./stages/PackageStage";
import { PublishStage } from "./stages/PublishStage";

const VALID_STAGES = new Set<WorkflowStageId>(WORKFLOW_STAGE_ORDER);

export function GuidedWorkspace({ project }: { project: Project }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workflow = getProjectWorkflow(project);
  const requestedStage = searchParams.get("stage") as WorkflowStageId | null;
  const activeStage =
    requestedStage && VALID_STAGES.has(requestedStage)
      ? requestedStage
      : workflow.recommendedStage;
  const activeIndex = WORKFLOW_STAGE_ORDER.indexOf(activeStage);

  const navigate = React.useCallback(
    (
      stage: WorkflowStageId,
      params: Record<string, string | undefined> = {},
    ) => {
      const previousStage = searchParams.get("stage");
      const next = new URLSearchParams(searchParams.toString());
      next.set("stage", stage);
      for (const [key, value] of Object.entries(params)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // Real history entries so browser Back/Forward traverse stages.
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
      // Only jump to the top when the stage itself changes, not when
      // switching editions/tools within a stage.
      if (previousStage !== stage) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [pathname, router, searchParams],
  );

  const goNext = () =>
    navigate(WORKFLOW_STAGE_ORDER[Math.min(activeIndex + 1, 4)]);

  return (
    <div className="space-y-7">
      <StageRail
        activeStage={activeStage}
        project={project}
        onNavigate={navigate}
      />

      <div key={activeStage} className="animate-in fade-in slide-in-from-bottom-2">
        {activeStage === "define" ? (
          <DefineStage project={project} onNavigate={navigate} />
        ) : activeStage === "plan" ? (
          <PlanStage project={project} onNavigate={navigate} />
        ) : activeStage === "build" ? (
          <BuildStage
            project={project}
            editionId={searchParams.get("edition")}
            tool={searchParams.get("tool")}
            onNavigate={navigate}
          />
        ) : activeStage === "package" ? (
          <PackageStage
            project={project}
            tool={searchParams.get("tool")}
            onNavigate={navigate}
          />
        ) : (
          <PublishStage project={project} onNavigate={navigate} />
        )}
      </div>

      <div className="hidden items-center justify-between border-t border-border-soft pt-6 sm:flex">
        <button
          type="button"
          disabled={activeIndex === 0}
          onClick={() => navigate(WORKFLOW_STAGE_ORDER[activeIndex - 1])}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink disabled:invisible"
        >
          <ArrowLeft className="size-4" />
          Previous stage
        </button>
        <button
          type="button"
          disabled={activeIndex === 4}
          onClick={goNext}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-paper hover:bg-forest-deep disabled:opacity-40"
        >
          {activeIndex === 4 ? "Final stage" : "Continue"}
          <ArrowRight className="size-4" />
        </button>
      </div>

      <div className="sticky bottom-3 z-30 flex items-center justify-between rounded-2xl border border-border-strong bg-paper/95 p-2 shadow-[var(--shadow-lift)] backdrop-blur sm:hidden">
        <button
          type="button"
          disabled={activeIndex === 0}
          onClick={() => navigate(WORKFLOW_STAGE_ORDER[activeIndex - 1])}
          className="inline-flex size-10 items-center justify-center rounded-xl text-ink-soft disabled:opacity-30"
          aria-label="Previous stage"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() =>
            activeStage === workflow.recommendedStage
              ? navigate(workflow.recommendedStage)
              : goNext()
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-5 text-sm font-semibold text-paper"
        >
          {activeStage === workflow.recommendedStage
            ? workflow.recommendedAction
            : "Continue"}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function StageRail({
  project,
  activeStage,
  onNavigate,
}: {
  project: Project;
  activeStage: WorkflowStageId;
  onNavigate: (stage: WorkflowStageId) => void;
}) {
  const workflow = getProjectWorkflow(project);
  const activeIndex = WORKFLOW_STAGE_ORDER.indexOf(activeStage);
  const onRecommended = activeStage === workflow.recommendedStage;

  return (
    <div className="sticky top-0 z-30 -mx-5 border-b border-border-soft bg-ivory/85 px-5 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <div className="flex items-center gap-4 py-3">
        {/* Mobile: stage select */}
        <div className="flex-1 sm:hidden">
          <label htmlFor="workspace-stage" className="sr-only">
            Current stage
          </label>
          <select
            id="workspace-stage"
            value={activeStage}
            onChange={(event) =>
              onNavigate(event.target.value as WorkflowStageId)
            }
            className="h-10 w-full rounded-xl border border-border-strong bg-paper px-3 text-sm font-semibold text-ink outline-none focus:border-forest"
          >
            {workflow.stages.map((stage, index) => (
              <option key={stage.id} value={stage.id}>
                {index + 1}. {stage.label}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop: compact stepper */}
        <nav aria-label="Production stages" className="hidden flex-1 sm:block">
          <ol role="tablist" className="flex items-center">
            {workflow.stages.map((stage, index) => {
              const active = stage.id === activeStage;
              const complete = stage.status === "complete";
              const attention = stage.status === "needs-attention";
              return (
                <li key={stage.id} className="flex flex-1 items-center last:flex-none">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onNavigate(stage.id)}
                    className="group flex items-center gap-2 rounded-full px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                        active
                          ? "border-forest bg-forest text-paper"
                          : complete
                            ? "border-forest bg-sage-soft text-forest"
                            : attention
                              ? "border-terracotta/60 bg-terracotta-soft text-terracotta"
                              : "border-border-strong bg-paper text-ink-muted group-hover:border-forest/40",
                      )}
                    >
                      {complete ? (
                        <Check className="size-4" />
                      ) : attention ? (
                        <CircleAlert className="size-4" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        "hidden text-sm font-semibold lg:inline",
                        active ? "text-ink" : "text-ink-soft",
                      )}
                    >
                      {stage.shortLabel}
                    </span>
                  </button>
                  {index < workflow.stages.length - 1 ? (
                    <span
                      className={cn(
                        "mx-2 h-px flex-1",
                        complete ? "bg-forest/50" : "bg-border-strong",
                      )}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <SaveChip />
          {!onRecommended ? (
            <button
              type="button"
              onClick={() => onNavigate(workflow.recommendedStage)}
              className="hidden items-center gap-1.5 rounded-full bg-forest px-3.5 py-1.5 text-xs font-semibold text-paper transition-colors hover:bg-forest-deep lg:inline-flex"
            >
              Next: {workflow.recommendedAction}
              <ArrowRight className="size-3.5" />
            </button>
          ) : activeIndex < 4 ? (
            <span className="hidden text-xs font-medium text-ink-muted lg:inline">
              {workflow.progress}% to launch
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveChip() {
  const [status, setStatus] = React.useState<SaveStatus>("saved");

  React.useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<{ status: SaveStatus }>).detail;
      setStatus(detail?.status ?? "saved");
    };
    window.addEventListener("routecrafter:save-state", handle);
    return () =>
      window.removeEventListener("routecrafter:save-state", handle);
  }, []);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        status === "error" ? "text-terracotta" : "text-ink-muted",
      )}
      aria-live="polite"
    >
      {status === "saving" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : status === "error" ? (
        <AlertCircle className="size-3.5" />
      ) : (
        <Check className="size-3.5 text-forest" />
      )}
      <span className="hidden sm:inline">
        {status === "saving"
          ? "Saving"
          : status === "error"
            ? "Save failed"
            : "Saved"}
      </span>
    </span>
  );
}
