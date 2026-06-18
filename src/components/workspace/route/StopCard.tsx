"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import type { RouteStop } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { NightsStepper } from "./NightsStepper";

function dayLabel(start: number, end: number): string {
  return start === end ? `Day ${start}` : `Days ${start}–${end}`;
}

export function StopCard({
  stop,
  index,
  total,
  range,
  dragging,
  onNights,
  onRemove,
  onMoveLeft,
  onMoveRight,
  onHandlePointerDown,
}: {
  stop: RouteStop;
  index: number;
  total: number;
  range: { start: number; end: number };
  dragging: boolean;
  onNights: (next: number) => void;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onHandlePointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <article
      className={cn(
        "group/stop relative flex w-56 shrink-0 flex-col gap-3 rounded-2xl border bg-paper p-4 transition-all duration-150 max-sm:w-full",
        dragging
          ? "scale-[1.03] border-forest/40 shadow-[var(--shadow-lift)]"
          : "border-border-strong hover:-translate-y-px hover:shadow-[var(--shadow-soft)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onPointerDown={onHandlePointerDown}
            aria-label={`Drag to reorder ${stop.city}`}
            className="-ml-1 cursor-grab touch-none rounded-md p-1 text-ink-muted transition-colors hover:text-ink active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            <GripVertical className="size-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink" title={stop.city}>
              {stop.city}
            </p>
            <p className="text-[11px] font-medium text-terracotta">
              {dayLabel(range.start, range.end)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${stop.city} from the route`}
          className="rounded-lg p-1 text-ink-muted opacity-0 transition-all duration-150 hover:bg-terracotta/10 hover:text-terracotta focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage group-hover/stop:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <NightsStepper nights={stop.nights} onChange={onNights} city={stop.city} />

      {/* Keyboard / touch reorder fallback */}
      <div className="flex items-center justify-between border-t border-border-soft pt-2">
        <span className="rc-eyebrow text-ink-muted">
          Stop {index + 1} of {total}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveLeft}
            disabled={index === 0}
            aria-label={`Move ${stop.city} earlier`}
            className="rounded-md p-1 text-ink-soft transition-colors hover:bg-paper-2/70 hover:text-ink disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={index === total - 1}
            aria-label={`Move ${stop.city} later`}
            className="rounded-md p-1 text-ink-soft transition-colors hover:bg-paper-2/70 hover:text-ink disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
