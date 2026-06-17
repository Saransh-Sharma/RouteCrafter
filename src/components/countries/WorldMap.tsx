"use client";

import * as React from "react";
import {
  WORLD_COUNTRIES,
  WORLD_VIEWBOX,
} from "@/lib/data/world-countries";
import {
  countryFillColor,
  EMPTY_COUNTRY_FILL,
  type CountryGroup,
} from "@/lib/country-stats";
import { cn } from "@/lib/utils";

interface HoverState {
  iso: string;
  name: string;
  x: number;
  y: number;
}

export function WorldMap({
  groups,
  selectedIso,
  onSelectCountry,
}: {
  groups: CountryGroup[];
  selectedIso?: string | null;
  onSelectCountry?: (iso: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = React.useState<HoverState | null>(null);

  // Group lookup + precomputed fills keyed by ISO. Only recomputed when the
  // underlying project stats change.
  const { byIso, fills } = React.useMemo(() => {
    const byIso = new Map<string, CountryGroup>();
    for (const group of groups) {
      if (group.iso) byIso.set(group.iso, group);
    }
    const fills: Record<string, string> = {};
    for (const shape of WORLD_COUNTRIES) {
      const group = byIso.get(shape.id);
      fills[shape.id] = group ? countryFillColor(group) : EMPTY_COUNTRY_FILL;
    }
    return { byIso, fills };
  }, [groups]);

  const hoveredGroup = hover ? byIso.get(hover.iso) : undefined;

  const updateHoverFromTarget = React.useCallback(
    (target: EventTarget | null, clientX: number, clientY: number) => {
      const el = target as Element | null;
      const iso = el?.getAttribute?.("data-iso");
      const name = el?.getAttribute?.("data-name");
      const container = containerRef.current;
      if (!iso || !name || !container) {
        setHover(null);
        return;
      }
      const rect = container.getBoundingClientRect();
      setHover({ iso, name, x: clientX - rect.left, y: clientY - rect.top });
    },
    [],
  );

  const handleSelect = React.useCallback(
    (iso: string | null) => {
      if (iso && onSelectCountry) onSelectCountry(iso);
    },
    [onSelectCountry],
  );

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={WORLD_VIEWBOX}
        role="img"
        aria-label="World map showing project coverage by country"
        className="h-auto w-full"
        onPointerMove={(e) =>
          updateHoverFromTarget(e.target, e.clientX, e.clientY)
        }
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const iso = (e.target as Element).getAttribute?.("data-iso");
          handleSelect(iso ?? null);
        }}
      >
        <g>
          {WORLD_COUNTRIES.map((shape) => {
            const group = byIso.get(shape.id);
            const interactive = Boolean(group);
            const isSelected = selectedIso === shape.id;
            return (
              <path
                key={shape.id}
                d={shape.d}
                data-iso={shape.id}
                data-name={shape.name}
                fill={fills[shape.id]}
                className={cn(
                  "[vector-effect:non-scaling-stroke] transition-[stroke,opacity] duration-200",
                  interactive
                    ? "cursor-pointer stroke-paper hover:stroke-forest hover:[stroke-width:1.2]"
                    : "stroke-border-soft/60",
                  isSelected && "stroke-forest [stroke-width:1.4]",
                )}
                strokeWidth={isSelected ? 1.4 : 0.4}
                tabIndex={interactive ? 0 : -1}
                role={interactive ? "button" : undefined}
                aria-label={
                  group
                    ? `${shape.name}: ${group.finished.length} finished, ${group.inProgress.length} in progress`
                    : undefined
                }
                onKeyDown={(e) => {
                  if (!interactive) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(shape.id);
                  }
                }}
              >
                <title>{shape.name}</title>
              </path>
            );
          })}
        </g>
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-border-strong bg-paper/95 px-3 py-2 text-xs shadow-[var(--shadow-lift)] backdrop-blur"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          <div className="font-display text-sm font-semibold text-ink">
            {hover.name}
          </div>
          {hoveredGroup ? (
            <div className="mt-1 space-y-0.5 text-ink-soft">
              <div className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-forest" />
                {hoveredGroup.finished.length} finished
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-gold" />
                {hoveredGroup.inProgress.length} in progress
              </div>
              <div className="pt-0.5 text-ink-muted">
                {hoveredGroup.avgCompletion}% avg complete
              </div>
            </div>
          ) : (
            <div className="mt-0.5 text-ink-muted">No projects yet</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
