"use client";

import * as React from "react";
import { MapPin, Plus, RotateCcw, X } from "lucide-react";
import type { RouteStop } from "@/lib/schemas";
import { dayRangeForStop, normalizeRoute, routeNights } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { StopCard } from "./StopCard";
import { LegConnector } from "./LegConnector";

function makeStop(city: string): RouteStop {
  return { id: crypto.randomUUID(), city, nights: 1 };
}

/**
 * Visual route builder: an ordered rail of city stops the user can drag to
 * reorder, set nights on (days are derived), and connect with a transport mode.
 * Cities are added/removed inline; a soft budget meter reconciles total nights
 * against the edition's day count without ever blocking.
 */
export function RoutePlanner({
  baseCities,
  route,
  dayCount,
  onChange,
}: {
  baseCities: string[];
  route: RouteStop[];
  dayCount: number;
  onChange: (next: RouteStop[]) => void;
}) {
  const cardRefs = React.useRef(new Map<string, HTMLElement>());
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [undo, setUndo] = React.useState<{ stop: RouteStop; index: number } | null>(
    null,
  );
  const undoTimer = React.useRef<number | undefined>(undefined);

  const placed = routeNights(route);
  const left = dayCount - placed;
  const balanced = dayCount > 0 && left === 0;
  const segments = Math.max(dayCount, placed, 1);

  const commit = React.useCallback(
    (next: RouteStop[]) => onChange(normalizeRoute(next)),
    [onChange],
  );

  function setNights(id: string, nights: number) {
    commit(route.map((stop) => (stop.id === id ? { ...stop, nights } : stop)));
  }

  function setTransport(id: string, mode: RouteStop["arriveBy"]) {
    commit(route.map((stop) => (stop.id === id ? { ...stop, arriveBy: mode } : stop)));
  }

  function moveStop(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= route.length) return;
    const next = [...route];
    [next[from], next[to]] = [next[to], next[from]];
    commit(next);
  }

  function addStop(city: string) {
    const name = city.trim().replace(/,$/, "").trim();
    if (!name || route.some((stop) => stop.city === name)) {
      setDraft("");
      return;
    }
    commit([...route, makeStop(name)]);
    setDraft("");
  }

  function removeStop(id: string) {
    const index = route.findIndex((stop) => stop.id === id);
    if (index < 0) return;
    const stop = route[index];
    commit(route.filter((item) => item.id !== id));
    window.clearTimeout(undoTimer.current);
    setUndo({ stop, index });
    undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
  }

  function restoreUndo() {
    if (!undo) return;
    const next = [...route];
    next.splice(Math.min(undo.index, next.length), 0, undo.stop);
    commit(next);
    setUndo(null);
  }

  /* ----- pointer drag-to-reorder (works for mouse and touch) ------------- */
  function computeDropIndex(clientX: number, clientY: number): number {
    const entries = route
      .map((stop) => cardRefs.current.get(stop.id))
      .filter((el): el is HTMLElement => Boolean(el))
      .map((el) => el.getBoundingClientRect());
    if (entries.length < 2) return route.length;
    const horizontal =
      Math.abs(entries[1].left - entries[0].left) >=
      Math.abs(entries[1].top - entries[0].top);
    for (let i = 0; i < entries.length; i += 1) {
      const rect = entries[i];
      const center = horizontal
        ? rect.left + rect.width / 2
        : rect.top + rect.height / 2;
      const pointer = horizontal ? clientX : clientY;
      if (pointer < center) return i;
    }
    return route.length;
  }

  React.useEffect(() => {
    if (!dragId) return;
    function onMove(event: PointerEvent) {
      setDropIndex(computeDropIndex(event.clientX, event.clientY));
    }
    function onUp() {
      setDragId((currentId) => {
        setDropIndex((target) => {
          if (currentId && target !== null) {
            const from = route.findIndex((stop) => stop.id === currentId);
            if (from >= 0) {
              let to = target;
              const without = route.filter((_, i) => i !== from);
              if (from < to) to -= 1;
              commit([
                ...without.slice(0, to),
                route[from],
                ...without.slice(to),
              ]);
            }
          }
          return null;
        });
        return null;
      });
    }
    function onCancel() {
      setDragId(null);
      setDropIndex(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, route]);

  React.useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  const unplacedBrief = baseCities.filter(
    (city) => !route.some((stop) => stop.city === city),
  );

  const dropMarker = (key: string) => (
    <span
      key={key}
      aria-hidden
      className="h-40 w-0.5 shrink-0 self-center rounded-full bg-sage max-sm:h-0.5 max-sm:w-full"
    />
  );

  return (
    <div className="rounded-2xl border border-border-strong bg-paper/55 p-4 sm:p-5">
      {/* Budget meter */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="rc-label">Route</span>
          <span className="text-xs text-ink-muted">
            {placed} of {dayCount} {dayCount === 1 ? "night" : "nights"} placed
            {left > 0 ? ` · ${left} left` : ""}
          </span>
        </div>
        <span
          className={cn(
            "text-xs font-medium",
            balanced
              ? "text-forest"
              : left < 0
                ? "text-terracotta"
                : "text-ink-muted",
          )}
        >
          {balanced
            ? "Route balanced ✓"
            : left < 0
              ? `${-left} night${left === -1 ? "" : "s"} over — trim a stay`
              : route.length
                ? `Add ${left} more night${left === 1 ? "" : "s"}, or trim a city`
                : ""}
        </span>
      </div>
      <div
        className={cn(
          "mt-2 flex gap-1 overflow-hidden rounded-full",
          balanced && "animate-pulse",
        )}
        role="presentation"
      >
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              i < placed
                ? i < dayCount
                  ? "bg-forest"
                  : "bg-terracotta"
                : "bg-border-strong/60",
            )}
          />
        ))}
      </div>

      {/* Rail */}
      {route.length ? (
        <div className="mt-5 flex items-stretch gap-2 overflow-x-auto pb-2 max-sm:flex-col max-sm:items-stretch max-sm:overflow-visible">
          {route.map((stop, index) => (
            <React.Fragment key={stop.id}>
              {dragId && dropIndex === index ? dropMarker(`m-${index}`) : null}
              {index > 0 ? (
                <LegConnector
                  mode={stop.arriveBy ?? "train"}
                  toCity={stop.city}
                  onChange={(mode) => setTransport(stop.id, mode)}
                />
              ) : null}
              <div
                ref={(el) => {
                  if (el) cardRefs.current.set(stop.id, el);
                  else cardRefs.current.delete(stop.id);
                }}
                className={cn("flex", dragId === stop.id && "opacity-80")}
              >
                <StopCard
                  stop={stop}
                  index={index}
                  total={route.length}
                  range={dayRangeForStop(route, index)}
                  dragging={dragId === stop.id}
                  onNights={(n) => setNights(stop.id, n)}
                  onRemove={() => removeStop(stop.id)}
                  onMoveLeft={() => moveStop(index, -1)}
                  onMoveRight={() => moveStop(index, 1)}
                  onHandlePointerDown={(event) => {
                    event.preventDefault();
                    setDragId(stop.id);
                    setDropIndex(index);
                  }}
                />
              </div>
            </React.Fragment>
          ))}
          {dragId && dropIndex === route.length ? dropMarker("m-end") : null}

          {/* Inline add-stop node */}
          <div className="flex shrink-0 items-center self-center max-sm:py-1">
            {adding ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addStop(draft);
                  } else if (e.key === "Escape") {
                    setAdding(false);
                    setDraft("");
                  }
                }}
                onBlur={() => {
                  if (draft.trim()) addStop(draft);
                  setAdding(false);
                }}
                placeholder="Add a city"
                className="h-10 w-36 rounded-xl border border-forest/40 bg-paper px-3 text-sm text-ink outline-none ring-2 ring-sage/40 placeholder:text-ink-muted"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                aria-label="Add a city to the route"
                className="flex size-10 items-center justify-center rounded-full border border-dashed border-border-strong text-ink-muted transition-all duration-150 hover:border-forest/50 hover:text-forest active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
              >
                <Plus className="size-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-border-strong bg-paper/60 p-6 text-center">
          <MapPin className="mx-auto size-5 text-terracotta" />
          <p className="mt-2 text-sm font-semibold text-ink">
            Chart the journey
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-ink-soft">
            Drop in the first city to start the route, then set how many nights
            the traveler stays.
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:text-forest-deep"
          >
            <Plus className="size-4" />
            Add the first city
          </button>
          {adding ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addStop(draft);
                } else if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              onBlur={() => {
                if (draft.trim()) addStop(draft);
                setAdding(false);
              }}
              placeholder="Add a city"
              className="mx-auto mt-3 block h-10 w-44 rounded-xl border border-forest/40 bg-paper px-3 text-sm text-ink outline-none ring-2 ring-sage/40 placeholder:text-ink-muted"
            />
          ) : null}
        </div>
      )}

      {/* Brief-city suggestions + undo */}
      {(unplacedBrief.length || undo) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {unplacedBrief.length ? (
            <>
              <span className="text-[11px] text-ink-muted">From the brief:</span>
              {unplacedBrief.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => addStop(city)}
                  className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-paper-2/60 px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-forest/40 hover:text-forest"
                >
                  <Plus className="size-3" />
                  {city}
                </button>
              ))}
            </>
          ) : null}
          {undo ? (
            <button
              type="button"
              onClick={restoreUndo}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-forest transition-colors hover:bg-sage-soft/70"
            >
              <RotateCcw className="size-3" />
              Undo remove “{undo.stop.city}”
              <X className="size-3 opacity-60" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
