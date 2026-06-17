"use client";

import * as React from "react";
import { ChevronDown, Search, Globe2 } from "lucide-react";
import type { Project } from "@/lib/types";
import {
  groupProjectsByCountry,
  sortByActivity,
  type CountryGroup,
} from "@/lib/country-stats";
import {
  CountryProgressBar,
  CountryStatusGroups,
} from "@/components/countries/CountrySection";
import { CountryRail } from "@/components/dashboard/CountryRail";
import { RecentDrafts } from "@/components/dashboard/RecentDrafts";
import { cn } from "@/lib/utils";

const DEFAULT_OPEN = 3;

function matchesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query);
}

/** Narrow a group to the projects matching a search query, or null if none. */
function filterGroup(group: CountryGroup, query: string): CountryGroup | null {
  if (!query) return group;
  if (matchesQuery(group.country, query)) return group;

  const finished = group.finished.filter((p) => matchesQuery(p.name, query));
  const inProgress = group.inProgress.filter((p) =>
    matchesQuery(p.name, query),
  );
  const total = finished.length + inProgress.length;
  if (total === 0) return null;
  return {
    ...group,
    finished,
    inProgress,
    total,
    greenRatio: total > 0 ? finished.length / total : 0,
  };
}

export function CountryProjectExplorer({ projects }: { projects: Project[] }) {
  const [query, setQuery] = React.useState("");
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});
  const [activeCountry, setActiveCountry] = React.useState<string | null>(null);
  const sectionRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  const allGroups = React.useMemo(
    () => sortByActivity(groupProjectsByCountry(projects)),
    [projects],
  );

  const trimmedQuery = query.trim().toLowerCase();
  const visibleGroups = React.useMemo(() => {
    if (!trimmedQuery) return allGroups;
    return allGroups
      .map((group) => filterGroup(group, trimmedQuery))
      .filter((group): group is CountryGroup => group !== null);
  }, [allGroups, trimmedQuery]);

  const isSearching = trimmedQuery.length > 0;

  const isExpanded = React.useCallback(
    (key: string, index: number) => {
      if (isSearching) return true; // expand all matches while searching
      return overrides[key] ?? index < DEFAULT_OPEN;
    },
    [isSearching, overrides],
  );

  const handleSelectCountry = React.useCallback((country: string) => {
    const key = country.toLowerCase();
    setOverrides((prev) => ({ ...prev, [key]: true }));
    setActiveCountry(country);
    // Defer scroll until the section has rendered its expanded content.
    requestAnimationFrame(() => {
      sectionRefs.current
        .get(key)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  if (allGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-10">
      <CountryRail
        groups={allGroups}
        activeCountry={activeCountry}
        onSelect={handleSelectCountry}
      />

      <RecentDrafts projects={projects} />

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-ink">Projects by country</h2>
          <label className="relative flex w-full max-w-xs items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-ink-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries or projects"
              aria-label="Search countries or projects"
              className="h-9 w-full rounded-full border border-border-soft bg-paper/70 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-forest/40 focus:outline-none focus:ring-2 focus:ring-forest/15"
            />
          </label>
        </div>

        {visibleGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border-strong bg-paper/40 p-10 text-center">
            <Globe2 className="size-6 text-ink-muted" />
            <p className="text-sm text-ink-soft">
              No countries or projects match &ldquo;{query.trim()}&rdquo;.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleGroups.map((group, index) => {
              const key = group.country.toLowerCase();
              const expanded = isExpanded(key, index);
              return (
                <div
                  key={key}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(key, el);
                    else sectionRefs.current.delete(key);
                  }}
                  className={cn(
                    "rc-card scroll-mt-24 overflow-hidden p-0",
                    activeCountry?.toLowerCase() === key &&
                      "ring-2 ring-forest/30",
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOverrides((prev) => ({ ...prev, [key]: !expanded }))
                    }
                    disabled={isSearching}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-paper/50 disabled:cursor-default"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-ink-muted transition-transform duration-200",
                        expanded ? "rotate-0" : "-rotate-90",
                        isSearching && "opacity-30",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="font-display text-lg font-semibold text-ink">
                          {group.country}
                        </h3>
                        <span className="text-xs text-ink-muted">
                          {group.total}{" "}
                          {group.total === 1 ? "project" : "projects"}
                        </span>
                      </div>
                      <div className="mt-2 max-w-md">
                        <CountryProgressBar
                          greenRatio={group.greenRatio}
                          total={group.total}
                        />
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right text-xs text-ink-muted sm:block">
                      <div>{group.finished.length} finished</div>
                      <div>{group.inProgress.length} in progress</div>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-border-soft px-5 pb-6 pt-5">
                      <CountryStatusGroups group={group} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
