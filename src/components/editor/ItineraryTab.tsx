"use client";

import * as React from "react";
import { Loader2, Map, Plus, Route } from "lucide-react";
import type { PlannedEdition, Project } from "@/lib/types";
import { buildContext, buildItinerary } from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import {
  editionLabel,
  editionRoute,
  itineraryForEdition,
} from "@/lib/editions";
import { itineraryBlockers } from "@/lib/readiness";
import { Button } from "@/components/ui/Button";
import { EmptyState, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ExpandedItineraryPanel } from "@/components/workspace/itinerary/ExpandedItineraryPanel";

/**
 * The day-by-day product editor for one edition at a time, with a compact
 * edition switcher instead of the old stage sub-nav.
 */
export function ItineraryTab({
  project,
  editionId,
  section,
  onSelectEdition,
  onSectionChange,
  onOpenTrip,
}: {
  project: Project;
  editionId: string | null;
  section: string | null;
  onSelectEdition: (editionId: string) => void;
  onSectionChange: (section: string) => void;
  onOpenTrip: () => void;
}) {
  const update = useProjectsStore((state) => state.update);
  const { toast } = useToast();
  const [creating, setCreating] = React.useState(false);
  const editions = project.productionPlan.editions;
  const selected =
    editions.find((edition) => edition.id === editionId) ?? editions[0];

  function createEditionItinerary(edition: PlannedEdition) {
    setCreating(true);
    // Defer the synchronous build so the loading state paints first.
    requestAnimationFrame(() => {
      const itinerary = buildItinerary(
        buildContext(project, { extraCities: edition.cities }),
        {
          duration: edition.duration,
          customDays: edition.customDays,
          travelerType: edition.travelerType,
          route: editionRoute(project, edition),
        },
      );
      itinerary.plannedEditionId = edition.id;
      update(project.id, {
        itineraries: [...project.itineraries, itinerary],
        productionPlan: {
          ...project.productionPlan,
          editions: editions.map((item) =>
            item.id === edition.id
              ? { ...item, itineraryId: itinerary.id }
              : item,
          ),
        },
      });
      toast("Itinerary scaffolded");
      setCreating(false);
      onSelectEdition(edition.id);
    });
  }

  if (!editions.length) {
    return (
      <EmptyState
        icon={Route}
        title="No editions are planned yet"
        description="Commit to at least one duration and traveler combination in the Trip tab first."
        action={<Button onClick={onOpenTrip}>Plan an edition</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {editions.length > 1 ? (
        <div
          role="tablist"
          aria-label="Editions"
          className="flex flex-wrap gap-2"
        >
          {editions.map((edition) => {
            const active = edition.id === selected?.id;
            const complete =
              itineraryForEdition(project, edition) &&
              itineraryBlockers(project, edition).length === 0;
            return (
              <button
                key={edition.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectEdition(edition.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-caption font-semibold transition-colors",
                  active
                    ? "border-forest bg-forest text-paper"
                    : "border-border-strong bg-paper text-ink-soft hover:border-forest/40 hover:text-ink",
                )}
              >
                {editionLabel(edition)}
                {complete ? (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      active ? "bg-paper" : "bg-forest",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {selected ? (
        itineraryForEdition(project, selected) ? (
          <ExpandedItineraryPanel
            project={project}
            selectedEditionId={selected.id}
            activeSection={section ?? "overview"}
            onSectionChange={onSectionChange}
          />
        ) : (
          <EmptyState
            icon={Map}
            eyebrow={editionLabel(selected)}
            title="Build the day-by-day foundation"
            description="RouteCrafter will create the correct number of editable days from your trip brief. It provides structure without inventing live prices, hours, or availability."
            action={
              <Button
                disabled={creating}
                onClick={() => createEditionItinerary(selected)}
              >
                {creating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {creating ? "Creating…" : "Create this itinerary"}
              </Button>
            }
          />
        )
      ) : null}
    </div>
  );
}
