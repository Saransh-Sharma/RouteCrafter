"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Lightbulb,
  Plus,
  Route,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  Duration,
  ItineraryOutput,
  PlannedEdition,
  Project,
  RouteStop,
  TravelerType,
} from "@/lib/types";
import { enumValues } from "@/lib/schemas";
import { buildContext, buildMatrix, syncItineraryToRoute } from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import {
  defaultRoute,
  editionDayCount,
  editionLabel,
  editionRoute,
  getProjectWorkflow,
  itineraryForEdition,
  routeToCities,
  type WorkflowStageId,
} from "@/lib/workflow";
import { Button } from "@/components/ui/Button";
import { EmptyState, useToast } from "@/components/ui";
import { FormField, Input, Select } from "@/components/ui/field";
import { TagInput } from "@/components/workspace/trip-config/TagInput";
import { RoutePlanner } from "@/components/workspace/route/RoutePlanner";
import { StageShell } from "../StageShell";

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
  const duplicateEdition = useProjectsStore((state) => state.duplicateEdition);
  const removeDuplicatedEdition = useProjectsStore(
    (state) => state.removeDuplicatedEdition,
  );
  const { toast } = useToast();
  const [confirmEditionId, setConfirmEditionId] = React.useState<string | null>(
    null,
  );
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
  const [cities, setCities] = React.useState<string[]>([]);
  const [cloneSourceId, setCloneSourceId] = React.useState<string | null>(null);
  const [cloneDuration, setCloneDuration] = React.useState<Duration>(duration);
  const [cloneCustomDays, setCloneCustomDays] = React.useState<number | undefined>();
  const [keepGuides, setKeepGuides] = React.useState(true);
  const baseCities = project.tripConfigs[0]?.cities.length
    ? project.tripConfigs[0].cities
    : project.regions;
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
    const dayCount = customDays ?? Number.parseInt(duration, 10);
    const edition = {
      id: crypto.randomUUID(),
      duration,
      customDays,
      travelerType,
      cities,
      route: defaultRoute(baseCities, cities, dayCount),
      createdAt: new Date().toISOString(),
    } satisfies PlannedEdition;
    setEditions([...editions, edition], edition);
    setCities([]);
  }

  function updateEditionRoute(edition: PlannedEdition, next: RouteStop[]) {
    setEditions(
      editions.map((item) =>
        item.id === edition.id
          ? { ...item, route: next, cities: routeToCities(next, baseCities) }
          : item,
      ),
    );
  }

  function applyRouteToItinerary(
    linked: ItineraryOutput,
    next: ItineraryOutput,
  ) {
    update(project.id, {
      itineraries: project.itineraries.map((item) =>
        item.id === linked.id ? next : item,
      ),
    });
    setConfirmEditionId(null);
    toast("Itinerary updated to match the route");
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

  function openCloneDrawer(edition: PlannedEdition) {
    setCloneSourceId(edition.id);
    setCloneDuration(edition.duration);
    setCloneCustomDays(edition.customDays);
    setKeepGuides(true);
  }

  function commitClone(source: PlannedEdition) {
    const created = duplicateEdition(project.id, source.id, {
      duration: cloneDuration,
      customDays: cloneCustomDays,
      keepGuides,
    });
    if (!created) {
      toast("Could not duplicate the edition", "error");
      return;
    }
    setCloneSourceId(null);
    toast({
      message: `Copied ${editionLabel(source)} to ${editionLabel(created)}`,
      tone: "success",
      actionLabel: "Undo",
      durationMs: 6000,
      onAction: () => {
        const result = removeDuplicatedEdition(project.id, created.id);
        if (!result.ok) toast(result.error, "error");
      },
    });
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
    <StageShell
      eyebrow="Stage 2 · Plan"
      title="Commit to the editions you will ship"
      description="Possible durations and audiences are ideas. Planned editions are promises: each one needs a finished itinerary and the selected package assets."
      progress={
        stage ? { completed: stage.completed, total: stage.total } : undefined
      }
      blockers={workflow.blockers.filter((issue) => issue.stage === "plan")}
      onBlockerNavigate={(issue) =>
        onNavigate(issue.stage, { tool: issue.tool })
      }
      aside={
        <div className="min-w-40 border-l border-border-strong pl-5">
          <p className="rc-display text-3xl">{editions.length}</p>
          <p className="text-xs text-ink-muted">
            {editions.length === 1 ? "committed edition" : "committed editions"}
          </p>
        </div>
      }
    >
      <section className="grid gap-7 lg:grid-cols-[340px_1fr]">
        <div className="rounded-2xl border border-border-strong bg-paper/55 p-5">
          <p className="rc-label">Add an edition</p>
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
            <FormField
              label="Add cities / regions (optional)"
              hint="Extra stops for this edition, on top of the brief cities."
            >
              <TagInput
                value={cities}
                onChange={setCities}
                placeholder="Type a city and press Enter"
              />
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
            {editions.length ? (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => openCloneDrawer(editions[0])}
              >
                <Copy className="size-4" />
                New from existing...
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-5">
          {editions.length ? (
            editions.map((edition, index) => {
              const concepts = conceptsFor(edition).slice(0, 4);
              const route = editionRoute(project, edition);
              const linked = itineraryForEdition(project, edition);
              const sync = linked ? syncItineraryToRoute(linked, route) : null;
              const outOfSync = Boolean(
                sync &&
                  linked &&
                  (sync.changedDays.length ||
                    sync.removedDays.length ||
                    sync.next.routeSummary !== linked.routeSummary ||
                    sync.next.duration !== linked.duration),
              );
              const refreshCount = linked
                ? linked.days.filter((day) => day.needsRefresh).length
                : 0;
              const showConfirm = confirmEditionId === edition.id;
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
                        <h3 className="rc-section-title">
                          {editionLabel(edition)}
                        </h3>
                        <p className="mt-1 text-sm text-ink-soft">
                          {edition.itineraryId
                            ? "Itinerary started"
                            : "Planned · itinerary not started"}
                        </p>
                        {edition.lineageNote ? (
                          <p className="mt-2 inline-flex rounded-full bg-sage-soft px-2.5 py-1 text-[11px] font-semibold text-forest">
                            {edition.lineageNote}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openCloneDrawer(edition)}
                        aria-label={`Duplicate ${editionLabel(edition)}`}
                        className="rounded-lg p-2 text-ink-muted hover:bg-paper-2/70 hover:text-forest"
                      >
                        <Copy className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEdition(edition)}
                        aria-label={`Remove ${editionLabel(edition)}`}
                        className="rounded-lg p-2 text-ink-muted hover:bg-terracotta/10 hover:text-terracotta"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {cloneSourceId === edition.id ? (
                    <div className="ml-10 mt-4 rounded-2xl border border-sage/40 bg-sage-soft/30 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                        <FormField label="Adapt duration">
                          <Select
                            value={cloneDuration}
                            onChange={(event) => {
                              setCloneDuration(event.target.value as Duration);
                              setCloneCustomDays(undefined);
                            }}
                          >
                            {enumValues.duration.map((item) => (
                              <option key={item}>{item}</option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField label="Custom days">
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            value={cloneCustomDays ?? ""}
                            onChange={(event) =>
                              setCloneCustomDays(
                                event.target.value
                                  ? Number.parseInt(event.target.value, 10)
                                  : undefined,
                              )
                            }
                          />
                        </FormField>
                        <div className="flex flex-wrap gap-2 pb-1">
                          <label className="inline-flex items-center gap-2 rounded-full bg-paper/70 px-3 py-1.5 text-xs font-medium text-ink-soft">
                            <input
                              type="checkbox"
                              checked={keepGuides}
                              onChange={(event) => setKeepGuides(event.target.checked)}
                              className="accent-[var(--rc-forest)]"
                            />
                            Keep guides
                          </label>
                          <span className="rounded-full bg-paper/70 px-3 py-1.5 text-xs font-medium text-ink-muted">
                            Listing and brand voice stay project-wide
                          </span>
                        </div>
                        <div className="ml-auto flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCloneSourceId(null)}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => commitClone(edition)}>
                            Duplicate
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}

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
                    <div className="mt-5">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                        <Route className="size-3.5 text-terracotta" />
                        Route &amp; nights per city
                      </div>
                      <div className="mt-2">
                        <RoutePlanner
                          baseCities={baseCities}
                          route={route}
                          dayCount={editionDayCount(edition)}
                          country={project.country}
                          onChange={(next) => updateEditionRoute(edition, next)}
                        />
                      </div>
                    </div>

                    {outOfSync && sync && linked ? (
                      <div className="mt-4 rounded-2xl border border-gold/40 bg-gold-soft/30 p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">
                              This route no longer matches the itinerary
                            </p>
                            {showConfirm ? (
                              <ul className="mt-2 space-y-1 text-xs leading-5 text-ink-soft">
                                {linked.days.length !==
                                sync.next.days.length ? (
                                  <li>
                                    • Day count {linked.days.length} →{" "}
                                    {sync.next.days.length}
                                    {sync.removedDays.length
                                      ? ` (removes Day ${sync.removedDays.join(", ")})`
                                      : ""}
                                  </li>
                                ) : null}
                                {sync.changedDays.length ? (
                                  <li>
                                    • Re-bases Day{" "}
                                    {sync.changedDays.join(", ")} to new cities
                                  </li>
                                ) : null}
                                <li>• Updates route summary and transport notes</li>
                                <li className="text-ink-muted">
                                  Hand-written days you didn&apos;t move are kept.
                                </li>
                              </ul>
                            ) : (
                              <p className="mt-1 text-xs leading-5 text-ink-soft">
                                Apply the route to update day count, bases,
                                transport, and the route summary. Edited days you
                                didn&apos;t move are preserved.
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {showConfirm ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      applyRouteToItinerary(linked, sync.next)
                                    }
                                  >
                                    Apply changes
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setConfirmEditionId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmEditionId(edition.id)}
                                >
                                  Apply to itinerary
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

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
                      {refreshCount ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-brown">
                          <Sparkles className="size-3" />
                          {refreshCount} to refresh
                        </span>
                      ) : null}
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              icon={Route}
              title="Plan the first product edition"
              description="A single strong edition is enough to launch. Additional combinations can be added after the core product is complete."
            />
          )}
        </div>
      </section>
    </StageShell>
  );
}
