"use client";

import { ArrowRight, Check, CircleAlert, ShieldCheck } from "lucide-react";
import type { Project } from "@/lib/types";
import {
  getProjectWorkflow,
  type WorkflowIssue,
  type WorkflowStageId,
} from "@/lib/workflow";
import { useProjectsStore } from "@/lib/store/projects-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { downloadProjectJson } from "@/lib/io/project-io";
import { StageHeader } from "./StageHeader";

export function PublishStage({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (
    stage: WorkflowStageId,
    params?: Record<string, string | undefined>,
  ) => void;
}) {
  const update = useProjectsStore((state) => state.update);
  const workflow = getProjectWorkflow(project);
  const review = project.productionPlan.review;
  const confirmationsComplete =
    review.liveDataVerified &&
    review.presentationReviewed &&
    review.backupConfirmed;
  const canPublish =
    workflow.blockers.length === 0 && confirmationsComplete;

  function patchReview(patch: Partial<typeof review>) {
    update(project.id, {
      productionPlan: {
        ...project.productionPlan,
        review: { ...review, ...patch, confirmedAt: undefined },
      },
    });
  }

  function publish() {
    if (!canPublish) return;
    update(project.id, {
      status: "Ready to sell",
      productionPlan: {
        ...project.productionPlan,
        review: {
          ...review,
          confirmedAt: new Date().toISOString(),
        },
      },
    });
  }

  return (
    <div className="space-y-9">
      <StageHeader
        eyebrow="Stage 5 · Publish"
        title="Review the launch package"
        description="RouteCrafter separates launch blockers from useful improvements. Resolve the essentials, make the final confirmations, then publish with confidence."
        aside={
          <div className="min-w-44 text-right">
            <p className="text-3xl font-semibold text-ink">
              {workflow.progress}%
            </p>
            <p className="text-xs text-ink-muted">launch checks complete</p>
          </div>
        }
      />

      <div className="grid gap-7 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <ReviewSection
            title="Blockers"
            count={workflow.blockers.length}
            empty="No launch blockers remain."
            issues={workflow.blockers}
            tone="danger"
            onNavigate={onNavigate}
          />
          <ReviewSection
            title="Recommended improvements"
            count={workflow.warnings.length}
            empty="No additional quality recommendations."
            issues={workflow.warnings}
            tone="warning"
            onNavigate={onNavigate}
          />
        </div>

        <aside className="border border-border-strong bg-paper/55 p-5 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-forest" />
            <h3 className="text-lg font-semibold text-ink">Final confirmations</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            These checks are intentionally manual. RouteCrafter cannot verify live
            travel data or inspect files outside the browser.
          </p>

          <div className="mt-5 space-y-3">
            <ReviewCheck
              checked={review.liveDataVerified}
              onChange={(checked) =>
                patchReview({ liveDataVerified: checked })
              }
              label="Live prices, hours, tickets, and availability are presented as details to verify, not guarantees."
            />
            <ReviewCheck
              checked={review.presentationReviewed}
              onChange={(checked) =>
                patchReview({ presentationReviewed: checked })
              }
              label="I reviewed the final listing presentation and selected delivery files."
            />
            <ReviewCheck
              checked={review.backupConfirmed}
              onChange={(checked) => patchReview({ backupConfirmed: checked })}
              label="I understand this project is browser-local and created a JSON backup."
            />
          </div>

          <Button
            variant="outline"
            className="mt-5 w-full"
            onClick={() => downloadProjectJson(project)}
          >
            Download JSON backup
          </Button>
          <Button
            className="mt-2 w-full"
            disabled={!canPublish}
            onClick={publish}
          >
            <Check className="size-4" />
            {project.status === "Ready to sell"
              ? "Ready to sell"
              : "Mark ready to sell"}
          </Button>
          {!canPublish ? (
            <p className="mt-3 text-center text-xs leading-5 text-ink-muted">
              Resolve {workflow.blockers.length} blocker
              {workflow.blockers.length === 1 ? "" : "s"} and complete all
              confirmations.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  count,
  empty,
  issues,
  tone,
  onNavigate,
}: {
  title: string;
  count: number;
  empty: string;
  issues: WorkflowIssue[];
  tone: "danger" | "warning";
  onNavigate: (
    stage: WorkflowStageId,
    params?: Record<string, string | undefined>,
  ) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-border-strong pb-3">
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <span className="text-xs font-semibold text-ink-muted">{count}</span>
      </div>
      {issues.length ? (
        <div className="divide-y divide-border-soft">
          {issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() =>
                onNavigate(issue.stage, {
                  edition: issue.editionId,
                  tool: issue.tool,
                })
              }
              className="group flex w-full items-center gap-3 py-4 text-left"
            >
              <CircleAlert
                className={cn(
                  "size-4 shrink-0",
                  tone === "danger" ? "text-terracotta" : "text-gold",
                )}
              />
              <span className="flex-1 text-sm text-ink-soft group-hover:text-ink">
                {issue.label}
              </span>
              <ArrowRight className="size-4 text-ink-muted group-hover:text-forest" />
            </button>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 py-5 text-sm text-forest">
          <Check className="size-4" />
          {empty}
        </p>
      )}
    </section>
  );
}

function ReviewCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border-b border-border-soft pb-3 text-xs leading-5 text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-[var(--rc-forest)]"
      />
      <span>{label}</span>
    </label>
  );
}
