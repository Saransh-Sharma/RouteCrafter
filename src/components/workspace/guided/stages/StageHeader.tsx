import type { ReactNode } from "react";
import type { WorkflowIssue } from "@/lib/workflow";

export function StageHeader({
  eyebrow,
  title,
  description,
  aside,
  completed,
  total,
  blockers = [],
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
  completed?: number;
  total?: number;
  blockers?: WorkflowIssue[];
}) {
  const progress =
    typeof completed === "number" && typeof total === "number" && total > 0
      ? Math.round((completed / total) * 100)
      : null;
  return (
    <header className="grid gap-5 border-b border-border-soft pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          {description}
        </p>
        {progress !== null ? (
          <div className="mt-5 max-w-2xl">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
              <span>
                {completed} / {total} checks complete
              </span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2">
              <div
                className="h-full rounded-full bg-forest"
                style={{ width: `${progress}%` }}
              />
            </div>
            {blockers.length ? (
              <details className="mt-3 text-sm text-ink-soft">
                <summary className="cursor-pointer font-semibold text-ink">
                  Remaining tasks
                </summary>
                <ul className="mt-2 space-y-1">
                  {blockers.map((blocker) => (
                    <li key={blocker.id}>{blocker.label}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
      {aside}
    </header>
  );
}
