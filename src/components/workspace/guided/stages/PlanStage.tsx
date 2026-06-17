"use client";

import * as React from "react";
import { ArrowRight, Lightbulb, Plus, Route, Trash2 } from "lucide-react";
import type {
  Duration,
  PlannedEdition,
  Project,
  TravelerType,
} from "@/lib/types";
import { enumValues } from "@/lib/schemas";
import { buildContext, buildMatrix } from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import {
  editionLabel,
  getProjectWorkflow,
  type WorkflowStageId,
} from "@/lib/workflow";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select } from "@/components/ui/field";
import { StageHeader } from "./StageHeader";

export function PlanStage({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (
    stage: WorkflowStageId,
    params?: Record<string, string | undefined>,
  ) => void;
}) {
  const update = useProjectsStore((state) => state.update);
  const [duration, setDuration] = React.useState<Duration>(
    project.tripConfigs[0]?.duration ?? project.durations[0] ?? "7 days",
  );
  const [customDays, setCustomDays] = React.useState<number | undefined>(
    project.tripConfigs[0]?.customDays,
  );
  const [travelerType, setTravelerType] = React.useState<TravelerType>(
    project.tripConfigs[0]?.travelerType ??
      project.travelerTypes[0] ??
      "Couple",
  );
  const editions = project.productionPlan.editions;
  const workflow = getProjectWorkflow(project);
  const stage = workflow.stages.find((item) => item.id === "plan");
  const duplicate = editions.some(
    (edition) =>
      edition.duration === duration &&
      edition.customDays === customDays &&
      edition.travelerType === travelerType,
  );

  function setEditions(
    next: PlannedEdition[],
    candidate?: Pick<PlannedEdition, "duration" | "travelerType">,
  ) {
    update(project.id, {
      productionPlan: { ...project.productionPlan, editions: next },
      durations: candidate
        ? [...new Set([...project.durations, candidate.duration])]
        : project.durations,
      travelerTypes: candidate
        ? [...new Set([...project.travelerTypes, candidate.travelerType])]
        : project.travelerTypes,
    });
  }

  function addEdition() {
    if (duplicate) return;
    const edition = {
      id: crypto.randomUUID(),
      duration,
      customDays,
      travelerType,
      createdAt: new Date().toISOString(),
    } satisfies PlannedEdition;
    setEditions([...editions, edition], edition);
  }

  function removeEdition(edition: PlannedEdition) {
    if (
      edition.itineraryId &&
      !window.confirm(
        `Remove ${editionLabel(edition)} from the production plan? Its itinerary will remain in the project archive.`,
      )
    ) {
      return;
    }
    setEditions(editions.filter((item) => item.id !== edition.id));
  }

  function conceptsFor(edition: PlannedEdition) {
    const matrix = project.matrix ?? buildMatrix(buildContext(project));
    return (
      matrix.cells.find(
        (cell) =>
          cell.duration === edition.duration &&
          cell.travelerType === edition.travelerType,
      )?.variations ?? []
    );
  }

  return (
    <div className="space-y-9">
      <StageHeader
        eyebrow="Stage 2 · Plan"
        title="Commit to the editions you will ship"
        description="Possible durations and audiences are ideas. Planned editions are promises: each one needs a finished itinerary and the selected package assets."
        completed={stage?.completed}
        total={stage?.total}
        blockers={workflow.blockers.filter((issue) => issue.stage === "plan")}
        aside={
          <div className="min-w-40 border-l border-border-strong pl-5">
            <p className="text-2xl font-semibold text-ink">{editions.length}</p>
            <p className="text-xs text-ink-muted">
              {editions.length === 1 ? "committed edition" : "committed editions"}
            </p>
          </div>
        }
      />

      <section className="grid gap-7 lg:grid-cols-[340px_1fr]">
        <div className="border border-border-strong bg-paper/55 p-5">
          <p className="text-sm font-semibold text-ink">Add an edition</p>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Start with the combination most likely to sell. Add more only when
            you intend to complete them.
          </p>
          <div className="mt-5 space-y-4">
            <FormField label="Duration">
              <Select
                value={duration}
                onChange={(event) => {
                  setDuration(event.target.value as Duration);
                  setCustomDays(undefined);
                }}
              >
                {enumValues.duration.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Custom days"
              hint="Optional. Overrides the duration label."
            >
              <Input
                type="number"
                min={1}
                max={60}
                value={customDays ?? ""}
                onChange={(event) =>
                  setCustomDays(
                    event.target.value
                      ? Number.parseInt(event.target.value, 10)
                      : undefined,
                  )
                }
              />
            </FormField>
            <FormField label="Traveler type">
              <Select
                value={travelerType}
                onChange={(event) =>
                  setTravelerType(event.target.value as TravelerType)
                }
              >
                {enumValues.travelerType.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </FormField>
            <p className="border-y border-border-soft py-3 text-xs leading-5 text-ink-soft">
              Adding this creates another{" "}
              <strong className="text-ink">
                {customDays ? `${customDays}-day` : duration.replace(" days", "-day")}{" "}
                itinerary
              </strong>{" "}
              to write, package, and review.
            </p>
            <Button className="w-full" onClick={addEdition} disabled={duplicate}>
              <Plus className="size-4" />
              {duplicate ? "Already planned" : "Add to production plan"}
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          {editions.length ? (
            editions.map((edition, index) => {
              const concepts = conceptsFor(edition).slice(0, 4);
              return (
                <article
                  key={edition.id}
                  className="border-b border-border-strong pb-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <span className="mt-0.5 text-sm font-semibold text-terracotta">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="text-xl font-semibold text-ink">
                          {editionLabel(edition)}
                        </h3>
                        <p className="mt-1 text-sm text-ink-soft">
                          {edition.itineraryId
                            ? "Itinerary started"
                            : "Planned · itinerary not started"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEdition(edition)}
                      aria-label={`Remove ${editionLabel(edition)}`}
                      className="p-2 text-ink-muted hover:text-terracotta"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="ml-10 mt-5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                      <Lightbulb className="size-3.5 text-gold" />
                      Route concepts
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {concepts.map((concept) => (
                        <div
                          key={concept.label}
                          className="border-l border-forest/30 pl-3"
                        >
                          <p className="text-sm font-semibold text-ink">
                            {concept.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-ink-soft">
                            {concept.spine}
                          </p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate("build", {
                          edition: edition.id,
                          tool: "overview",
                        })
                      }
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-forest hover:text-forest-deep"
                    >
                      {edition.itineraryId
                        ? "Continue itinerary"
                        : "Start itinerary"}
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center border border-dashed border-border-strong px-8 text-center">
              <Route className="size-7 text-terracotta" />
              <h3 className="mt-4 text-xl font-semibold text-ink">
                Plan the first product edition
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
                A single strong edition is enough to launch. Additional
                combinations can be added after the core product is complete.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          disabled={!editions.length}
          onClick={() =>
            onNavigate("build", {
              edition: editions[0]?.id,
              tool: "overview",
            })
          }
        >
          Build the itineraries
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
