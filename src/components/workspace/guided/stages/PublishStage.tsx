"use client";

import { ArrowRight, Check, CircleAlert, ShieldCheck } from "lucide-react";
import type { Project } from "@/lib/types";
import {
  extractLiveDataClaims,
  getProjectWorkflow,
  itineraryForEdition,
  lintProjectForPublish,
  type LintFinding,
  type WorkflowIssue,
  type WorkflowStageId,
} from "@/lib/workflow";
import { useProjectsStore } from "@/lib/store/projects-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { downloadProjectJson } from "@/lib/io/project-io";
import { StageShell } from "../StageShell";

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
  const { toast } = useToast();
  const undoable = useUndoableAction();
  const workflow = getProjectWorkflow(project);
  const lintFindings = lintProjectForPublish(project);
  const publishStage = workflow.stages.find((item) => item.id === "publish");
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
    toast("Marked ready to sell");
  }

  function applyMoveLiveClaimsFix() {
    const fixable = lintFindings.filter(
      (finding) => finding.fixId === "move-live-claims-to-verification-notes",
    );
    if (!fixable.length) return;
    const result = update(project.id, {
      itineraries: project.itineraries.map((itinerary) => {
        const edition = project.productionPlan.editions.find(
          (item) => item.id === itinerary.plannedEditionId,
        );
        const linked = edition
          ? itineraryForEdition(project, edition)?.id === itinerary.id
          : true;
        if (!linked) return itinerary;
        const notes: string[] = [];
        const days = itinerary.days.map((day, dayIndex) => {
          let next = day;
          for (const finding of fixable) {
            if (finding.editionId && finding.editionId !== edition?.id) continue;
            const match = finding.fieldPath.match(/^days\.(\d+)\.([A-Za-z]+)$/);
            if (!match || Number(match[1]) !== dayIndex) continue;
            const key = match[2] as keyof typeof day;
            const value = String(day[key] ?? "").trim();
            if (!value) continue;
            const { cleaned, claims } = extractLiveDataClaims(value);
            if (!claims.length) continue;
            notes.push(...claims.map((claim) => `Day ${day.day} ${key}: ${claim}`));
            next = {
              ...next,
              [key]: cleaned,
            };
          }
          return next;
        });
        if (!notes.length) return itinerary;
        const verificationNotes = [
          itinerary.verificationNotes.trim(),
          "Live details moved from itinerary text:",
          ...notes.map((note) => `- ${note}`),
        ]
          .filter(Boolean)
          .join("\n");
        return { ...itinerary, days, verificationNotes };
      }),
    });
    if (result.ok) {
      undoable({
        message: `Moved ${fixable.length} live detail claim${fixable.length === 1 ? "" : "s"}`,
        onUndo: () => {
          update(project.id, { itineraries: project.itineraries });
        },
      });
    } else toast(result.error, "error");
  }

  return (
    <StageShell
      eyebrow="Stage 5 · Publish"
      title="Review the launch package"
      description="RouteCrafter separates launch blockers from useful improvements. Resolve the essentials, make the final confirmations, then publish with confidence."
      progress={
        publishStage
          ? { completed: publishStage.completed, total: publishStage.total }
          : undefined
      }
      aside={
        <div className="min-w-44 text-right">
          <p className="rc-display text-4xl">{workflow.progress}%</p>
          <p className="text-xs text-ink-muted">launch checks complete</p>
        </div>
      }
    >
      <div className="grid gap-7 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <ReadinessReport
            findings={lintFindings}
            onNavigate={onNavigate}
            onMoveLiveClaims={applyMoveLiveClaimsFix}
          />
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
            <h3 className="rc-section-title text-lg">Final confirmations</h3>
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
              label="I reviewed the cloud-saved project and created a JSON backup if I need an offline copy."
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
    </StageShell>
  );
}

function ReadinessReport({
  findings,
  onNavigate,
  onMoveLiveClaims,
}: {
  findings: LintFinding[];
  onNavigate: (
    stage: WorkflowStageId,
    params?: Record<string, string | undefined>,
  ) => void;
  onMoveLiveClaims: () => void;
}) {
  const mustFix = findings.filter((finding) => finding.severity === "must-fix");
  const recommended = findings.filter(
    (finding) => finding.severity === "recommended",
  );
  const polish = findings.filter((finding) => finding.severity === "polish");
  const fixableCount = findings.filter(
    (finding) => finding.fixId === "move-live-claims-to-verification-notes",
  ).length;

  return (
    <section className="rounded-2xl border border-border-strong bg-paper/55 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="rc-label">Readiness report</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Proof mode catches live-data claims, thin days, and packaging gaps before the product is marked ready.
          </p>
        </div>
        {fixableCount ? (
          <Button size="sm" variant="outline" onClick={onMoveLiveClaims}>
            Move {fixableCount} live claim{fixableCount === 1 ? "" : "s"}
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-forest">
            <Check className="size-3.5" />
            No deterministic fixes
          </span>
        )}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <FindingGroup
          title="Must-fix"
          findings={mustFix}
          empty="No credibility blockers."
          tone="danger"
          onNavigate={onNavigate}
        />
        <FindingGroup
          title="Recommended"
          findings={recommended}
          empty="No recommended fixes."
          tone="warning"
          onNavigate={onNavigate}
        />
        <FindingGroup
          title="Polish"
          findings={polish}
          empty="No polish notes."
          tone="neutral"
          onNavigate={onNavigate}
        />
      </div>
    </section>
  );
}

function FindingGroup({
  title,
  findings,
  empty,
  tone,
  onNavigate,
}: {
  title: string;
  findings: LintFinding[];
  empty: string;
  tone: "danger" | "warning" | "neutral";
  onNavigate: (
    stage: WorkflowStageId,
    params?: Record<string, string | undefined>,
  ) => void;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border-soft bg-paper/70 p-3">
      <div className="flex items-center justify-between gap-2 border-b border-border-soft pb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {title}
        </p>
        <span className="text-xs font-semibold text-ink-muted">
          {findings.length}
        </span>
      </div>
      {findings.length ? (
        <div className="mt-2 space-y-1">
          {findings.slice(0, 5).map((finding) => (
            <button
              key={finding.id}
              type="button"
              onClick={() =>
                onNavigate(finding.stage, {
                  edition: finding.editionId,
                  tool: finding.tool,
                })
              }
              className="group flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-paper-2/70"
            >
              <CircleAlert
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  tone === "danger"
                    ? "text-terracotta"
                    : tone === "warning"
                      ? "text-gold"
                      : "text-ink-muted",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-ink">
                  {finding.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-ink-muted">
                  {finding.message}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-forest">
          <Check className="size-3.5" />
          {empty}
        </p>
      )}
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
        <h3 className="rc-section-title">{title}</h3>
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
