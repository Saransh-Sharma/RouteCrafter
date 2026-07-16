"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Info,
  Lightbulb,
  Plus,
  Route,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  Duration,
  ItineraryOutput,
  OfferModel,
  OutputRequirement,
  PlannedEdition,
  Project,
  RouteStop,
  SalesChannel,
  TravelerType,
} from "@/lib/types";
import { enumValues } from "@/lib/schemas";
import {
  buildContext,
  routeConcepts,
  syncItineraryToRoute,
} from "@/lib/generation";
import { useProjectsStore } from "@/lib/store/projects-store";
import {
  OUTPUT_LABELS,
  defaultRoute,
  editionDayCount,
  editionLabel,
  editionRoute,
  itineraryForEdition,
  routeToCities,
} from "@/lib/editions";
import { Button } from "@/components/ui/Button";
import { CheckRow, EmptyState, SelectableCard, useToast } from "@/components/ui";
import {
  CheckboxChip,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";
import { TagInput } from "@/components/workspace/trip-config/TagInput";
import { RoutePlanner } from "@/components/workspace/route/RoutePlanner";
import { TripConfigForm } from "@/components/workspace/trip-config/TripConfigForm";

const OFFER_MODELS: {
  id: OfferModel;
  label: string;
  description: string;
  channels: SalesChannel[];
}[] = [
  {
    id: "digital",
    label: "Digital download",
    description: "A polished, prebuilt itinerary buyers can use immediately.",
    channels: ["etsy", "gumroad"],
  },
  {
    id: "service",
    label: "Custom service",
    description: "A planning offer tailored after the buyer shares a brief.",
    channels: ["fiverr", "direct"],
  },
  {
    id: "hybrid",
    label: "Hybrid offer",
    description: "A ready-made base itinerary with paid personalization.",
    channels: ["etsy", "gumroad", "direct"],
  },
];

const CHANNEL_LABELS: Record<SalesChannel, string> = {
  fiverr: "Fiverr",
  etsy: "Etsy",
  gumroad: "Gumroad",
  direct: "Direct sales",
};

const OUTPUT_GROUPS: {
  label: string;
  description: string;
  outputs: OutputRequirement[];
}[] = [
  {
    label: "Core files",
    description: "Formats the buyer receives.",
    outputs: ["pdf", "spreadsheet"],
  },
  {
    label: "Included guides",
    description: "Useful additions inside every planned edition.",
    outputs: ["food-guide", "packing-list", "booking-checklist"],
  },
  {
    label: "Sales assets",
    description: "Materials used to present and sell the product.",
    outputs: ["marketplace-listing", "portfolio-visuals"],
  },
];

/**
 * The product's commercial definition and edition plan on one surface:
 * offer model, channels, brief, output package, then the editions strip
 * with per-edition route planning.
 */
export function TripTab({
  project,
  onOpenItinerary,
}: {
  project: Project;
  onOpenItinerary: (editionId: string) => void;
}) {
  const update = useProjectsStore((state) => state.update);
  const plan = project.productionPlan;

  function patchProject(patch: Partial<Project>) {
    update(project.id, patch);
  }

  function patchPlan(patch: Partial<Project["productionPlan"]>) {
    patchProject({ productionPlan: { ...plan, ...patch } });
  }

  function chooseOfferModel(offerModel: OfferModel) {
    const model = OFFER_MODELS.find((item) => item.id === offerModel)!;
    const channels = plan.channels.length ? plan.channels : [model.channels[0]];
    patchPlan({ offerModel, channels });
  }

  function toggleChannel(channel: SalesChannel) {
    patchPlan({
      channels: plan.channels.includes(channel)
        ? plan.channels.filter((item) => item !== channel)
        : [...plan.channels, channel],
    });
  }

  function toggleOutput(output: OutputRequirement) {
    if (output === "marketplace-listing") return;
    patchPlan({
      outputs: plan.outputs.includes(output)
        ? plan.outputs.filter((item) => item !== output)
        : [...plan.outputs, output],
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h3 className="rc-section-title">Offer model</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Pick the closest business model. You can change it later.
          </p>
        </div>
        <div
          className="grid gap-3 lg:grid-cols-3"
          role="radiogroup"
          aria-label="Offer model"
        >
          {OFFER_MODELS.map((model) => (
            <SelectableCard
              key={model.id}
              title={model.label}
              description={model.description}
              selected={plan.offerModel === model.id}
              onSelect={() => chooseOfferModel(model.id)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-8 border-y border-border-soft py-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h3 className="rc-section-title">Where it will sell</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
            Channel choices tune package and intake requirements without
            locking the product to one marketplace.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(CHANNEL_LABELS) as SalesChannel[]).map((channel) => (
              <CheckboxChip
                key={channel}
                label={CHANNEL_LABELS[channel]}
                selected={plan.channels.includes(channel)}
                onToggle={() => toggleChannel(channel)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Product name" htmlFor="product-name">
            <Input
              id="product-name"
              defaultValue={project.name}
              onBlur={(event) =>
                patchProject({ name: event.target.value.trim() || project.name })
              }
            />
          </FormField>
          <FormField label="Destination" htmlFor="product-country">
            <Input
              id="product-country"
              defaultValue={project.country}
              onBlur={(event) =>
                patchProject({ country: event.target.value.trim() })
              }
            />
          </FormField>
          <FormField label="Target buyer" htmlFor="product-audience">
            <Input
              id="product-audience"
              defaultValue={project.targetAudience}
              onBlur={(event) =>
                patchProject({ targetAudience: event.target.value.trim() })
              }
              placeholder="Who should immediately recognize this as useful?"
            />
          </FormField>
          <FormField label="Brand voice" htmlFor="product-voice">
            <Select
              id="product-voice"
              value={project.brandStyle.voice}
              onChange={(event) =>
                patchProject({
                  brandStyle: {
                    ...project.brandStyle,
                    voice: event.target.value as Project["brandStyle"]["voice"],
                  },
                })
              }
            >
              <option value="editorial">Editorial and warm</option>
              <option value="premium">Premium and understated</option>
              <option value="friendly">Friendly and practical</option>
              <option value="adventurous">Adventurous and energetic</option>
            </Select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField
              label="Product promise"
              htmlFor="product-positioning"
              hint="One sentence explaining why this itinerary is worth buying."
            >
              <Textarea
                id="product-positioning"
                defaultValue={project.positioning}
                onBlur={(event) =>
                  patchProject({ positioning: event.target.value.trim() })
                }
                rows={3}
              />
            </FormField>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h3 className="rc-section-title">Output package</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Select only what you intend to finish. Every selected output shows
            up in the readiness checklist.
          </p>
        </div>
        <div className="grid gap-x-10 gap-y-7 lg:grid-cols-3">
          {OUTPUT_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="rc-label">{group.label}</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                {group.description}
              </p>
              <div className="mt-3 space-y-2">
                {group.outputs.map((output) => {
                  const selected = plan.outputs.includes(output);
                  const required = output === "marketplace-listing";
                  return (
                    <CheckRow
                      key={output}
                      label={OUTPUT_LABELS[output]}
                      selected={selected}
                      disabled={required}
                      onToggle={() => toggleOutput(output)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {plan.outputs.includes("map-pins-legacy") ? (
          <p className="flex items-start gap-2 border border-gold/30 bg-gold-soft/35 p-3 text-xs leading-5 text-brown">
            <Info className="mt-0.5 size-4 shrink-0" />
            This imported product includes Map pins, but RouteCrafter does not
            generate a map-pin artifact yet. It will not block publishing.
          </p>
        ) : null}
      </section>

      <EditionsSection project={project} onOpenItinerary={onOpenItinerary} />

      <details className="group border-y border-border-soft py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-base font-semibold text-ink">
          Deep trip brief
          <span className="text-xs font-medium text-ink-muted group-open:hidden">
            Pace, budget, logistics, interests, and constraints
          </span>
          <span className="hidden text-xs font-medium text-forest group-open:inline">
            Collapse
          </span>
        </summary>
        <div className="pb-7 pt-3">
          <TripConfigForm project={project} showDeliverables={false} />
        </div>
      </details>
    </div>
  );
}

function EditionsSection({
  project,
  onOpenItinerary,
}: {
  project: Project;
  onOpenItinerary: (editionId: string) => void;
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
    project.tripConfigs[0]?.duration ??
      project.productionPlan.editions[0]?.duration ??
      "7 days",
  );
  const [customDays, setCustomDays] = React.useState<number | undefined>(
    project.tripConfigs[0]?.customDays,
  );
  const [travelerType, setTravelerType] = React.useState<TravelerType>(
    project.tripConfigs[0]?.travelerType ??
      project.productionPlan.editions[0]?.travelerType ??
      "Couple",
  );
  const [cities, setCities] = React.useState<string[]>([]);
  const [cloneSourceId, setCloneSourceId] = React.useState<string | null>(null);
  const [cloneDuration, setCloneDuration] = React.useState<Duration>(duration);
  const [cloneCustomDays, setCloneCustomDays] = React.useState<
    number | undefined
  >();
  const [keepGuides, setKeepGuides] = React.useState(true);
  const baseCities = project.tripConfigs[0]?.cities.length
    ? project.tripConfigs[0].cities
    : project.regions;
  const editions = project.productionPlan.editions;
  const duplicate = editions.some(
    (edition) =>
      edition.duration === duration &&
      edition.customDays === customDays &&
      edition.travelerType === travelerType,
  );

  function setEditions(next: PlannedEdition[]) {
    update(project.id, {
      productionPlan: { ...project.productionPlan, editions: next },
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
    setEditions([...editions, edition]);
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
    return routeConcepts(
      buildContext(project),
      edition.duration,
      edition.travelerType,
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h3 className="rc-section-title">Editions</h3>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Each edition is a committed duration and traveler combination with
          its own route and itinerary. One strong edition is enough to launch.
        </p>
      </div>
      <div className="grid gap-7 lg:grid-cols-[340px_1fr]">
        <div className="rounded-[var(--radius-card)] border border-border-strong bg-paper/55 p-5">
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
                {customDays
                  ? `${customDays}-day`
                  : duration.replace(" days", "-day")}{" "}
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
                        <h4 className="rc-section-title">
                          {editionLabel(edition)}
                        </h4>
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
                    <div className="ml-10 mt-4 rounded-[var(--radius-card)] border border-sage/40 bg-sage-soft/30 p-4">
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
                              onChange={(event) =>
                                setKeepGuides(event.target.checked)
                              }
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
                      <div className="mt-4 rounded-[var(--radius-card)] border border-gold/40 bg-gold-soft/30 p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">
                              This route no longer matches the itinerary
                            </p>
                            {showConfirm ? (
                              <ul className="mt-2 space-y-1 text-xs leading-5 text-ink-soft">
                                {linked.days.length !== sync.next.days.length ? (
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
                                    • Re-bases Day {sync.changedDays.join(", ")}{" "}
                                    to new cities
                                  </li>
                                ) : null}
                                <li>
                                  • Updates route summary and transport notes
                                </li>
                                <li className="text-ink-muted">
                                  Hand-written days you didn&apos;t move are
                                  kept.
                                </li>
                              </ul>
                            ) : (
                              <p className="mt-1 text-xs leading-5 text-ink-soft">
                                Apply the route to update day count, bases,
                                transport, and the route summary. Edited days
                                you didn&apos;t move are preserved.
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
                                  onClick={() =>
                                    setConfirmEditionId(edition.id)
                                  }
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
                      onClick={() => onOpenItinerary(edition.id)}
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
      </div>
    </section>
  );
}
