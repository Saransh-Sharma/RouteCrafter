"use client";

import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import type { CountryGroup } from "@/lib/country-stats";
import { CountryProgressBar } from "@/components/countries/CountrySection";
import { cn } from "@/lib/utils";

const RAIL_LIMIT = 12;

/**
 * Horizontal rail of the most-active countries. Selecting a chip scrolls the
 * grouped explorer below to that country.
 */
export function CountryRail({
  groups,
  activeCountry,
  onSelect,
}: {
  groups: CountryGroup[];
  activeCountry?: string | null;
  onSelect?: (country: string) => void;
}) {
  if (groups.length === 0) return null;
  const rail = groups.slice(0, RAIL_LIMIT);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ink">Top countries</h2>
        <Link
          href="/countries"
          className="flex items-center gap-1 text-sm font-medium text-forest hover:text-forest-deep"
        >
          Explore map
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {rail.map((group) => {
          const isActive =
            activeCountry?.toLowerCase() === group.country.toLowerCase();
          return (
            <button
              key={group.country}
              type="button"
              onClick={() => onSelect?.(group.country)}
              className={cn(
                "rc-card flex w-44 shrink-0 flex-col gap-2.5 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
                isActive && "ring-2 ring-forest/40",
              )}
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <MapPin className="size-3.5 text-forest" />
                <span className="truncate">{group.country}</span>
              </div>
              <CountryProgressBar
                greenRatio={group.greenRatio}
                total={group.total}
              />
              <div className="flex items-center justify-between text-[11px] text-ink-muted">
                <span>
                  {group.finished.length} finished · {group.inProgress.length}{" "}
                  in progress
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
