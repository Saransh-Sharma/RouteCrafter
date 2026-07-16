"use client";

import * as React from "react";
import {
  Check,
  CircleAlert,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { getProjectWorkflow } from "@/lib/workflow";
import {
  extractLiveDataClaims,
  lintProjectForPublish,
  type WorkflowIssue,
} from "@/lib/readiness";
import { itineraryForEdition } from "@/lib/editions";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui";
import { Popover } from "@/components/ui/overlay/Popover";
import { tabForIssue, type EditorTab } from "./tabs";

/**
 * Launch readiness as a checklist, never a gate. Blockers and improvements
 * deep-link to the tab that owns them; the manual confirmations and
 * "Mark ready to sell" live at the bottom. Export is never blocked.
 */
export function ReadinessPopover({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (
    tab: EditorTab,
    params?: { edition?: string; section?: string },
  ) => void;
}) {
  const workflow = getProjectWorkflow(project);
  const blockerCount = workflow.blockers.length;

  return (
    <Popover
      align="end"
      className="w-[26rem] max-w-[calc(100vw-2rem)] p-0"
      trigger={(props) => (
        <button
          type="button"
          aria-label="Readiness checklist"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-caption font-semibold transition-colors",
            blockerCount
              ? "border-terracotta/40 bg-terracotta-soft/50 text-terracotta hover:bg-terracotta-soft"
              : "border-border-strong bg-paper text-forest hover:border-forest/40",
          )}
          {...props}
        >
          {blockerCount ? (
            <CircleAlert className="size-4" aria-hidden />
          ) : (
            <ClipboardCheck className="size-4" aria-hidden />
          )}
          Readiness
          <span
            className={cn(
              "rounded-full px-1.5 text-[11px] font-bold",
              blockerCount ? "bg-terracotta text-paper" : "bg-sage-soft",
            )}
          >
            {blockerCount ? blockerCount : `${workflow.progress}%`}
          </span>
        </button>
      )}
    >
      <ReadinessPanel project={project} onNavigate={onNavigate} />
    </Popover>
  );
}

function ReadinessPanel({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (
    tab: EditorTab,
    params?: { edition?: string; section?: string },
  ) => void;
}) {
  const update = useProjectsStore((state) => state.update);
  const { toast } = useToast();
  const undoable = useUndoableAction();
  const workflow = getProjectWorkflow(project);
  const lintFindings = lintProjectForPublish(project);
  const review = project.productionPlan.review;
  const fixableCount = lintFindings.filter(
    (finding) => finding.fixId === "move-live-claims-to-verification-notes",
  ).length;
  const confirmationsComplete =
    review.liveDataVerified &&
    review.presentationReviewed &&
    review.backupConfirmed;
  const canPublish = workflow.blockers.length === 0 && confirmationsComplete;

  function open(issue: WorkflowIssue) {
    onNavigate(tabForIssue(issue.stage, issue.tool), {
      edition: issue.editionId,
      section: issue.tool,
    });
  }

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
        review: { ...review, confirmedAt: new Date().toISOString() },
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
            notes.push(
              ...claims.map((claim) => `Day ${day.day} ${key}: ${claim}`),
            );
            next = { ...next, [key]: cleaned };
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
    <div className="max-h-[70dvh] overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="rc-label">Launch readiness</p>
          <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">
            A checklist, not a gate — you can always export.
          </p>
        </div>
        <span className="font-display text-title text-ink">
          {workflow.progress}%
        </span>
      </div>

      {fixableCount ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          onClick={applyMoveLiveClaimsFix}
        >
          Move {fixableCount} live claim{fixableCount === 1 ? "" : "s"} to
          verification notes
        </Button>
      ) : null}

      <IssueList
        title="Blockers"
        issues={workflow.blockers}
        empty="No launch blockers remain."
        tone="danger"
        onOpen={open}
      />
      <IssueList
        title="Improvements"
        issues={workflow.warnings}
        empty="No additional quality recommendations."
        tone="warning"
        onOpen={open}
      />

      <div className="mt-4 border-t border-border-soft pt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-forest" aria-hidden />
          <p className="text-caption font-semibold text-ink">
            Final confirmations
          </p>
        </div>
        <div className="mt-3 space-y-2.5">
          <ReviewCheck
            checked={review.liveDataVerified}
            onChange={(checked) => patchReview({ liveDataVerified: checked })}
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
          className="mt-4 w-full"
          size="sm"
          disabled={!canPublish}
          onClick={publish}
        >
          <Check className="size-4" />
          {project.status === "Ready to sell"
            ? "Ready to sell"
            : "Mark ready to sell"}
        </Button>
        {!canPublish ? (
          <p className="mt-2 text-center text-[11px] leading-4 text-ink-muted">
            Resolve {workflow.blockers.length} blocker
            {workflow.blockers.length === 1 ? "" : "s"} and complete all
            confirmations.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function IssueList({
  title,
  issues,
  empty,
  tone,
  onOpen,
}: {
  title: string;
  issues: WorkflowIssue[];
  empty: string;
  tone: "danger" | "warning";
  onOpen: (issue: WorkflowIssue) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between border-b border-border-soft pb-1.5">
        <p className="text-eyebrow font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {title}
        </p>
        <span className="text-[11px] font-semibold text-ink-muted">
          {issues.length}
        </span>
      </div>
      {issues.length ? (
        <div className="mt-1">
          {issues.slice(0, 8).map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => onOpen(issue)}
              className="group flex w-full items-start gap-2 rounded-[var(--radius-control)] px-1.5 py-2 text-left transition-colors hover:bg-paper-2/70"
            >
              <CircleAlert
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  tone === "danger" ? "text-terracotta" : "text-gold",
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 text-caption text-ink-soft group-hover:text-ink">
                {issue.label}
              </span>
            </button>
          ))}
          {issues.length > 8 ? (
            <p className="px-1.5 py-1 text-[11px] text-ink-muted">
              +{issues.length - 8} more
            </p>
          ) : null}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 py-2.5 text-caption text-forest">
          <Check className="size-3.5" aria-hidden />
          {empty}
        </p>
      )}
    </div>
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
    <label className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-4 text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-3.5 accent-[var(--rc-forest)]"
      />
      <span>{label}</span>
    </label>
  );
}
