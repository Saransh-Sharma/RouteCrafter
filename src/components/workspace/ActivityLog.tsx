"use client";

import * as React from "react";
import { History, Clock, ChevronDown } from "lucide-react";
import { useActivityStore } from "@/lib/store/activity-store";
import { useMounted } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { ActivityAction } from "@/lib/schemas/activity";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VISIBLE_LIMIT = 20;

const ACTION_LABELS: Record<ActivityAction, string> = {
  created: "created this project",
  updated: "updated project details",
  deleted: "deleted this project",
  duplicated: "duplicated this project",
  imported: "imported this project",
  status_changed: "", // uses `detail` for specifics
  itinerary_updated: "updated an itinerary",
  config_updated: "updated trip configuration",
  listing_updated: "updated marketplace listing",
  image_prompts_updated: "updated image prompts",
};

function actionLabel(action: ActivityAction, detail: string): string {
  if (action === "status_changed" && detail) return detail;
  return ACTION_LABELS[action] || detail || action;
}

/** Map known user IDs to avatar accent colors (Tailwind classes). */
function avatarClasses(userId: string): { bg: string; text: string } {
  switch (userId) {
    case "user_admin":
      return { bg: "bg-forest", text: "text-white" };
    case "user_saransh":
      return { bg: "bg-terracotta", text: "text-white" };
    case "user_saumya":
      return { bg: "bg-teal", text: "text-white" };
    default:
      return { bg: "bg-sage", text: "text-forest-deep" };
  }
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;

  if (diff < 0) return "just now";

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      new Date(isoString).getFullYear() !== new Date().getFullYear()
        ? "numeric"
        : undefined,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityLog({ projectId }: { projectId: string }) {
  const mounted = useMounted();
  const entries = useActivityStore((s) => s.getByProject(projectId));
  const [expanded, setExpanded] = React.useState(false);

  // Hydration guard — render nothing on the server / first client render
  if (!mounted) {
    return (
      <div className="rc-card p-6">
        <div className="flex items-center gap-2.5">
          <History className="size-[18px] text-ink-muted" />
          <h3 className="font-display text-base font-semibold tracking-tight text-ink">
            Activity
          </h3>
        </div>
        {/* Skeleton pulse while hydrating */}
        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="size-8 animate-pulse rounded-full bg-paper-2" />
              <div className="flex-1 space-y-1.5 pt-0.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-paper-2" />
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-paper-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const visible = expanded ? entries : entries.slice(0, VISIBLE_LIMIT);
  const hasMore = entries.length > VISIBLE_LIMIT;

  return (
    <div className="rc-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border-soft px-6 py-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-sage-soft text-forest">
          <History className="size-4" />
        </span>
        <h3 className="font-display text-base font-semibold tracking-tight text-ink">
          Activity
        </h3>
        {entries.length > 0 && (
          <span className="ml-auto rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-muted">
            {entries.length}
          </span>
        )}
      </div>

      {/* Feed */}
      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative px-6 py-4">
          {/* Vertical connector line */}
          <div
            className="absolute top-4 bottom-4 left-[39px] w-px bg-border-soft"
            aria-hidden
          />

          <ul className="relative space-y-0.5">
            {visible.map((entry, index) => {
              const colors = avatarClasses(entry.userId);
              const initial = entry.userName.charAt(0).toUpperCase();
              const label = actionLabel(entry.action, entry.detail);

              return (
                <li
                  key={entry.id}
                  className="group relative flex gap-3 py-2.5"
                  style={{
                    animation: `rc-activity-fade-in 0.35s ease-out ${Math.min(index * 50, 600)}ms both`,
                  }}
                >
                  {/* Avatar */}
                  <span
                    className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ring-2 ring-paper",
                      colors.bg,
                      colors.text,
                    )}
                  >
                    {initial}
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm leading-snug text-ink-soft">
                      <span className="font-semibold text-ink">
                        {entry.userName}
                      </span>{" "}
                      {label}
                    </p>
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
                      <Clock className="size-3 opacity-60" />
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Show all toggle */}
          {hasMore && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="relative z-10 mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border-soft bg-paper-2/60 px-4 py-2 text-xs font-semibold text-ink-muted transition-colors hover:border-border-strong hover:bg-paper-2 hover:text-ink-soft"
            >
              Show all {entries.length} entries
              <ChevronDown className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Keyframe animation — injected once */}
      <style>{`
        @keyframes rc-activity-fade-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-paper-2 text-ink-muted">
        <History className="size-5" />
      </span>
      <div>
        <p className="text-sm font-medium text-ink-muted">No activity yet</p>
        <p className="mt-0.5 text-xs text-ink-muted/70">
          Changes and updates to this project will appear here.
        </p>
      </div>
    </div>
  );
}
