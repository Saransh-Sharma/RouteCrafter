"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Check, CircleAlert } from "lucide-react";
import type { WorkflowIssue } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export type SubNavStatus = "complete" | "attention" | "in-progress" | "empty";

export interface SubNavItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  status?: SubNavStatus;
  /** Optional completion meter shown on the trailing edge (e.g. days done). */
  meter?: { completed: number; total: number };
}

export interface StageSubNav {
  ariaLabel: string;
  heading?: string;
  items: SubNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export interface StageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  aside?: React.ReactNode;
  progress?: { completed: number; total: number };
  blockers?: WorkflowIssue[];
  onBlockerNavigate?: (issue: WorkflowIssue) => void;
  subNav?: StageSubNav;
  children: React.ReactNode;
}

/**
 * Unified chrome for every workflow stage: a consistent header (eyebrow,
 * title, description, compact progress + clickable remaining tasks), an
 * optional left sub-navigation rail, and the stage body. Replaces the
 * per-stage hand-rolled headers and one-off sub-nav patterns.
 */
export function StageShell({
  eyebrow,
  title,
  description,
  aside,
  progress,
  blockers = [],
  onBlockerNavigate,
  subNav,
  children,
}: StageShellProps) {
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : null;

  return (
    <div className="space-y-7">
      <header className="grid gap-5 border-b border-border-soft pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <p className="rc-eyebrow">{eyebrow}</p>
          <h2 className="rc-stage-title mt-2">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            {description}
          </p>

          {pct !== null && progress ? (
            <div className="mt-5 max-w-2xl">
              <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
                <span>
                  {progress.completed} / {progress.total} checks complete
                </span>
                <span>{pct}%</span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-forest transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {blockers.length ? (
                <details className="mt-3 text-sm text-ink-soft">
                  <summary className="cursor-pointer font-semibold text-ink">
                    {blockers.length} remaining task
                    {blockers.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {blockers.map((blocker) => (
                      <li key={blocker.id}>
                        {onBlockerNavigate ? (
                          <button
                            type="button"
                            onClick={() => onBlockerNavigate(blocker)}
                            className="group flex w-full items-center gap-2 rounded-md py-1 text-left text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                          >
                            <CircleAlert className="size-3.5 shrink-0 text-terracotta" />
                            <span className="flex-1">{blocker.label}</span>
                            <span className="text-xs font-medium text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">
                              Fix →
                            </span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-2 py-1">
                            <CircleAlert className="size-3.5 shrink-0 text-terracotta" />
                            {blocker.label}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
        {aside}
      </header>

      {subNav ? (
        <div className="grid gap-7 lg:grid-cols-[230px_minmax(0,1fr)]">
          <StageSubNavRail {...subNav} />
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function StageSubNavRail({
  ariaLabel,
  heading,
  items,
  activeId,
  onSelect,
}: StageSubNav) {
  return (
    <nav
      aria-label={ariaLabel}
      className="lg:sticky lg:top-20 lg:self-start"
    >
      {heading ? (
        <p className="mb-3 rc-eyebrow text-ink-muted">{heading}</p>
      ) : null}
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label={ariaLabel}
        className="flex gap-2 overflow-x-auto lg:block lg:space-y-1"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl border-b px-3 py-3 text-left text-sm font-medium transition-colors lg:w-full lg:rounded-lg lg:border-b-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage",
                active
                  ? "border-forest bg-sage-soft/65 text-forest"
                  : "border-border-soft text-ink-soft hover:bg-paper/60 hover:text-ink",
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" /> : null}
              <span className="flex-1 truncate">{item.label}</span>
              <SubNavStatusIndicator status={item.status} meter={item.meter} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function SubNavStatusIndicator({
  status,
  meter,
}: {
  status?: SubNavStatus;
  meter?: SubNavItem["meter"];
}) {
  if (meter) {
    const done = meter.completed >= meter.total && meter.total > 0;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
          done ? "text-forest" : "text-ink-muted",
        )}
      >
        {done ? <Check className="size-3.5" /> : `${meter.completed}/${meter.total}`}
      </span>
    );
  }
  if (!status || status === "empty") {
    return (
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-border-strong"
      />
    );
  }
  if (status === "complete") {
    return <Check className="size-3.5 shrink-0 text-forest" aria-label="Complete" />;
  }
  if (status === "attention") {
    return (
      <CircleAlert
        className="size-3.5 shrink-0 text-terracotta"
        aria-label="Needs attention"
      />
    );
  }
  // in-progress
  return (
    <span
      aria-label="In progress"
      className="size-2 shrink-0 rounded-full bg-gold"
    />
  );
}
