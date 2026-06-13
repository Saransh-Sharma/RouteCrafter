"use client";

import { ArrowRight, Check, CircleAlert, Plus } from "lucide-react";
import type { PlannedEdition, Project } from "@/lib/types";
import { buildContext, buildItinerary } from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import {
  editionLabel,
  itineraryBlockers,
  itineraryForEdition,
  type WorkflowStageId,
} from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ExpandedItineraryPanel } from "../../itinerary/ExpandedItineraryPanel";
import { StageHeader } from "./StageHeader";

export function BuildStage({
  project,
  editionId,
  tool,
  onNavigate,
}: {
  project: Project;
  editionId: string | null;
  tool: string | null;
  onNavigate: (
    stage: WorkflowStageId,
    params?: Record<string, string | undefined>,
  ) => void;
}) {
  const update = useProjectsStore((state) => state.update);
  const editions = project.productionPlan.editions;
  const selected =
    editions.find((edition) => edition.id === editionId) ?? editions[0];

  function createEditionItinerary(edition: PlannedEdition) {
    const itinerary = buildItinerary(buildContext(project), {
      duration: edition.duration,
      customDays: edition.customDays,
      travelerType: edition.travelerType,
    });
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
    onNavigate("build", { edition: edition.id, tool: "overview" });
  }

  return (
    <div className="space-y-8">
      <StageHeader
        eyebrow="Stage 3 · Build"
        title="Turn each edition into a complete itinerary"
        description="Work one committed edition at a time. The checklist distinguishes launch blockers from quality improvements so you always know what matters next."
        aside={
          <div className="text-right">
            <p className="text-2xl font-semibold text-ink">
              {
                editions.filter(
                  (edition) => itineraryBlockers(project, edition).length === 0,
                ).length
              }
              <span className="text-base text-ink-muted"> / {editions.length}</span>
            </p>
            <p className="text-xs text-ink-muted">editions complete</p>
          </div>
        }
      />

      {editions.length ? (
        <>
          <div className="flex gap-2 overflow-x-auto border-b border-border-soft pb-3">
            {editions.map((edition) => {
              const blockers = itineraryBlockers(project, edition);
              const active = edition.id === selected?.id;
              return (
                <button
                  key={edition.id}
                  type="button"
                  onClick={() =>
                    onNavigate("build", {
                      edition: edition.id,
                      tool: tool ?? "overview",
                    })
                  }
                  className={cn(
                    "flex shrink-0 items-center gap-2 border px-4 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "border-forest bg-forest text-paper"
                      : "border-border-soft bg-paper/45 text-ink-soft hover:border-forest/35 hover:text-ink",
                  )}
                >
                  {blockers.length === 0 ? (
                    <Check className="size-3.5" />
                  ) : (
                    <CircleAlert className="size-3.5" />
                  )}
                  {editionLabel(edition)}
                </button>
              );
            })}
          </div>

          {selected ? (
            itineraryForEdition(project, selected) ? (
              <ExpandedItineraryPanel
                project={project}
                selectedEditionId={selected.id}
                activeSection={tool ?? "overview"}
                onSectionChange={(section) =>
                  onNavigate("build", {
                    edition: selected.id,
                    tool: section,
                  })
                }
              />
            ) : (
              <div className="grid min-h-96 place-items-center border border-dashed border-border-strong bg-paper/25 px-6 text-center">
                <div className="max-w-lg">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">
                    {editionLabel(selected)}
                  </p>
                  <h3 className="mt-3 text-3xl font-semibold text-ink">
                    Build the day-by-day foundation
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-ink-soft">
                    RouteCrafter will create the correct number of editable days
                    from your trip brief. It provides structure without inventing
                    live prices, hours, or availability.
                  </p>
                  <Button
                    className="mt-6"
                    onClick={() => createEditionItinerary(selected)}
                  >
                    <Plus className="size-4" />
                    Create this itinerary
                  </Button>
                </div>
              </div>
            )
          ) : null}

          <div className="flex justify-end">
            <Button onClick={() => onNavigate("package", { tool: "listing" })}>
              Package the offer
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </>
      ) : (
        <div className="grid min-h-80 place-items-center border border-dashed border-border-strong text-center">
          <div>
            <h3 className="text-xl font-semibold text-ink">
              No editions are planned yet
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              Commit to at least one duration and traveler combination first.
            </p>
            <Button className="mt-5" onClick={() => onNavigate("plan")}>
              Plan an edition
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
