"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert } from "lucide-react";
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
import { NextActionCard } from "./NextActionCard";

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
      const next = new URLSearchParams(searchParams.toString());
      next.set("stage", stage);
      for (const [key, value] of Object.entries(params)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [pathname, router, searchParams],
  );

  const goNext = () => {
    const nextStage =
      activeStage === workflow.recommendedStage
        ? workflow.recommendedStage
        : WORKFLOW_STAGE_ORDER[Math.min(activeIndex + 1, 4)];
    navigate(nextStage);
  };

  return (
    <div className="space-y-7">
      <RouteLine
        activeStage={activeStage}
        project={project}
        onNavigate={navigate}
      />

      <NextActionCard project={project} workflow={workflow} onNavigate={navigate} />

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
          onClick={goNext}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-paper hover:bg-forest-deep"
        >
          {activeIndex === 4 ? "Review readiness" : "Continue"}
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
          onClick={goNext}
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

function RouteLine({
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

  return (
    <>
      <div className="sm:hidden">
        <label
          htmlFor="workspace-stage"
          className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted"
        >
          Stage {activeIndex + 1} of 5
        </label>
        <select
          id="workspace-stage"
          value={activeStage}
          onChange={(event) =>
            onNavigate(event.target.value as WorkflowStageId)
          }
          className="h-12 w-full rounded-xl border border-border-strong bg-paper px-4 text-sm font-semibold text-ink outline-none focus:border-forest"
        >
          {workflow.stages.map((stage, index) => (
            <option key={stage.id} value={stage.id}>
              {index + 1}. {stage.label}
            </option>
          ))}
        </select>
      </div>

      <nav aria-label="Production stages" className="hidden sm:block">
        <ol className="grid grid-cols-5">
          {workflow.stages.map((stage, index) => {
            const active = stage.id === activeStage;
            const complete = stage.status === "complete";
            const attention = stage.status === "needs-attention";
            return (
              <li key={stage.id} className="relative">
                {index < workflow.stages.length - 1 ? (
                  <span
                    className={cn(
                      "absolute left-1/2 right-[-50%] top-5 h-px",
                      complete ? "bg-forest/60" : "bg-border-strong",
                    )}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => onNavigate(stage.id)}
                  className="group relative flex w-full flex-col items-center px-2 text-center"
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                      active
                        ? "border-forest bg-forest text-paper"
                        : complete
                          ? "border-forest bg-sage-soft text-forest"
                          : attention
                            ? "border-terracotta/60 bg-terracotta-soft text-terracotta"
                            : "border-border-strong bg-ivory text-ink-muted group-hover:border-forest/40",
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
                      "mt-2 text-xs font-semibold",
                      active ? "text-ink" : "text-ink-soft",
                    )}
                  >
                    {stage.shortLabel}
                  </span>
                  <span className="mt-0.5 text-[10px] capitalize text-ink-muted">
                    {stage.status.replace("-", " ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
