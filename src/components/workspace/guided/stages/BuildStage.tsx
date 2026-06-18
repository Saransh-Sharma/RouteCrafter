"use client";

import * as React from "react";
import { Loader2, Map, Plus, Route } from "lucide-react";
import type { PlannedEdition, Project } from "@/lib/types";
import { buildContext, buildItinerary } from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import {
  editionLabel,
  getProjectWorkflow,
  itineraryBlockers,
  itineraryForEdition,
  type WorkflowStageId,
} from "@/lib/workflow";
import { Button } from "@/components/ui/Button";
import { EmptyState, useToast } from "@/components/ui";
import { ExpandedItineraryPanel } from "../../itinerary/ExpandedItineraryPanel";
import { StageShell, type SubNavStatus } from "../StageShell";

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
  const { toast } = useToast();
  const [creating, setCreating] = React.useState(false);
  const editions = project.productionPlan.editions;
  const workflow = getProjectWorkflow(project);
  const stage = workflow.stages.find((item) => item.id === "build");
  const selected =
    editions.find((edition) => edition.id === editionId) ?? editions[0];
  const completeCount = editions.filter(
    (edition) => itineraryBlockers(project, edition).length === 0,
  ).length;

  function editionStatus(edition: PlannedEdition): SubNavStatus {
    if (!itineraryForEdition(project, edition)) return "empty";
    return itineraryBlockers(project, edition).length ? "attention" : "complete";
  }

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
      onNavigate("build", { edition: edition.id, tool: "overview" });
    });
  }

  if (!editions.length) {
    return (
      <StageShell
        eyebrow="Stage 3 · Build"
        title="Turn each edition into a complete itinerary"
        description="Work one committed edition at a time. The checklist distinguishes launch blockers from quality improvements so you always know what matters next."
      >
        <EmptyState
          icon={Route}
          title="No editions are planned yet"
          description="Commit to at least one duration and traveler combination first."
          action={
            <Button onClick={() => onNavigate("plan")}>Plan an edition</Button>
          }
        />
      </StageShell>
    );
  }

  return (
    <StageShell
      eyebrow="Stage 3 · Build"
      title="Turn each edition into a complete itinerary"
      description="Work one committed edition at a time. The checklist distinguishes launch blockers from quality improvements so you always know what matters next."
      progress={
        stage ? { completed: stage.completed, total: stage.total } : undefined
      }
      blockers={workflow.blockers.filter((issue) => issue.stage === "build")}
      onBlockerNavigate={(issue) =>
        onNavigate(issue.stage, { edition: issue.editionId, tool: issue.tool })
      }
      aside={
        <div className="text-right">
          <p className="rc-display text-3xl">
            {completeCount}
            <span className="text-base text-ink-muted"> / {editions.length}</span>
          </p>
          <p className="text-xs text-ink-muted">editions complete</p>
        </div>
      }
      subNav={{
        ariaLabel: "Editions",
        heading: "Editions",
        activeId: selected?.id ?? "",
        onSelect: (id) =>
          onNavigate("build", { edition: id, tool: tool ?? "overview" }),
        items: editions.map((edition) => ({
          id: edition.id,
          label: editionLabel(edition),
          status: editionStatus(edition),
        })),
      }}
    >
      {selected ? (
        itineraryForEdition(project, selected) ? (
          <ExpandedItineraryPanel
            project={project}
            selectedEditionId={selected.id}
            activeSection={tool ?? "overview"}
            onSectionChange={(section) =>
              onNavigate("build", { edition: selected.id, tool: section })
            }
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
    </StageShell>
  );
}
