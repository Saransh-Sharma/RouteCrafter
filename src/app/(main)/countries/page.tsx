"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { WorldMap } from "@/components/countries/WorldMap";
import {
  CountryProgressBar,
  CountryStatusGroups,
} from "@/components/countries/CountrySection";
import { useProjectsStore } from "@/lib/store/projects-store";
import { useMounted } from "@/lib/hooks";
import {
  groupProjectsByCountry,
  sortByActivity,
  sortByCompletion,
} from "@/lib/country-stats";

/** Turn an ISO 3166-1 alpha-2 code into its flag emoji (best effort). */
function isoToFlag(iso?: string): string {
  if (!iso || !/^[A-Z]{2}$/.test(iso)) return "🌍";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (iso.charCodeAt(0) - 65),
    base + (iso.charCodeAt(1) - 65),
  );
}

export default function CountriesPage() {
  const mounted = useMounted();
  const projects = useProjectsStore((s) => s.projects);
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);
  const cardRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  const allGroups = React.useMemo(
    () => groupProjectsByCountry(mounted ? projects : []),
    [mounted, projects],
  );
  // Map fills are order-independent; cards are ranked most-completed first.
  const mapGroups = React.useMemo(() => sortByActivity(allGroups), [allGroups]);
  const rankedGroups = React.useMemo(
    () => sortByCompletion(allGroups),
    [allGroups],
  );

  const handleSelectCountry = React.useCallback((iso: string) => {
    setSelectedIso(iso);
    requestAnimationFrame(() => {
      cardRefs.current
        .get(iso)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <div className="space-y-12">
      <SectionHeader
        eyebrow="Atlas"
        title="Countries"
        subtitle="Your whole catalog at a glance — a living map of where your itinerary products are finished, in progress, or waiting to be explored."
      />

      {/* World map hero */}
      <section className="rc-card rc-paper-texture overflow-hidden p-4 sm:p-6">
        <WorldMap
          groups={mapGroups}
          selectedIso={selectedIso}
          onSelectCountry={handleSelectCountry}
        />
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border-soft pt-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-forest" />
            Finished
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-gold" />
            In progress
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-3 rounded-sm"
              style={{ background: "#e7e1d3" }}
            />
            No projects yet
          </span>
          <span className="text-ink-muted/80">
            Deeper greens mean more of a country&rsquo;s work is complete.
          </span>
        </div>
      </section>

      {/* Catalog */}
      {rankedGroups.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-border-strong bg-paper/40 p-12 text-center">
          <p className="text-sm text-ink-soft">
            No country projects yet. Start one to put your first pin on the map.
          </p>
          <Link
            href="/projects/new"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-forest px-4 text-sm font-medium text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep"
          >
            <Plus className="size-4" />
            New project
          </Link>
        </section>
      ) : (
        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-ink">
            Catalog by country
            <span className="ml-2 text-sm font-normal text-ink-muted">
              {rankedGroups.length}{" "}
              {rankedGroups.length === 1 ? "country" : "countries"}
            </span>
          </h2>

          <div className="space-y-6">
            {rankedGroups.map((group) => {
              const refKey = group.iso;
              const isSelected = selectedIso && selectedIso === group.iso;
              return (
                <div
                  key={group.country.toLowerCase()}
                  ref={(el) => {
                    if (!refKey) return;
                    if (el) cardRefs.current.set(refKey, el);
                    else cardRefs.current.delete(refKey);
                  }}
                  className={`rc-card scroll-mt-24 p-6 transition-shadow ${
                    isSelected ? "ring-2 ring-forest/40" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 border-b border-border-soft pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-3xl leading-none"
                        aria-hidden="true"
                      >
                        {isoToFlag(group.iso)}
                      </span>
                      <div>
                        <h3 className="font-display text-2xl font-semibold text-ink">
                          {group.country}
                        </h3>
                        <p className="flex items-center gap-1 text-xs text-ink-muted">
                          <MapPin className="size-3" />
                          {group.finished.length} finished ·{" "}
                          {group.inProgress.length} in progress ·{" "}
                          {group.avgCompletion}% avg complete
                        </p>
                      </div>
                    </div>
                    <div className="w-full max-w-[14rem]">
                      <CountryProgressBar
                        greenRatio={group.greenRatio}
                        total={group.total}
                      />
                    </div>
                  </div>

                  <div className="pt-5">
                    <CountryStatusGroups group={group} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
