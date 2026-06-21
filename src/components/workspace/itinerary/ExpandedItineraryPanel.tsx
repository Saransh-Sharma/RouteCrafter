"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  FileDown,
  Map,
  CalendarPlus,
  Check,
  CircleAlert,
} from "lucide-react";
import type {
  Duration,
  ItineraryOutput,
  Project,
  TravelStyle,
  TravelerType,
} from "@/lib/types";
import {
  buildContext,
  buildItinerary,
} from "@/lib/generation";
import { dayPlanSchema, enumValues } from "@/lib/schemas";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/field";
import { AiCostButton } from "@/components/ai/AiCostButton";
import { AiRunSheet } from "@/components/ai/AiRunSheet";
import {
  buildDayPrompt,
  buildItineraryPrompt,
} from "@/lib/ai/tasks";
import { isLikelyTruncatedJson, parseJsonObject } from "@/lib/ai/parse";
import {
  normalizeAiDayPlan,
  normalizeAiItinerary,
} from "@/lib/ai/itinerary-normalization";
import { requestStructuredItineraryDraft } from "@/lib/ai/itinerary-draft-client";
import { appendAiRun, createAiRunMetadata } from "@/lib/ai/metadata";
import { markAiRunApplied } from "@/lib/assets/capture";
import { cn } from "@/lib/utils";
import { PromptHelper } from "../PromptHelper";
import { DayCard } from "./DayCard";
import { downloadItineraryMarkdown } from "./export-itinerary";
import type { ExpandHint } from "@/lib/store/projects-store";
import { editionRoute, itineraryBlockers, itineraryForEdition } from "@/lib/workflow";

const TOP_FIELDS: { key: keyof ItineraryOutput; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "whoFor", label: "Who it's for" },
  { key: "routeSummary", label: "Route summary" },
  { key: "bestStayAreas", label: "Best stay areas" },
];

const GUIDE_FIELDS: { key: keyof ItineraryOutput; label: string }[] = [
  { key: "foodGuide", label: "Food & cafe guide" },
  { key: "transportGuide", label: "Transport guide" },
  { key: "packingList", label: "Packing list" },
  { key: "etiquetteSafety", label: "Etiquette & safety" },
  { key: "bookingChecklist", label: "Booking checklist" },
  { key: "personalizationQuestions", label: "Personalization questions" },
  { key: "verificationNotes", label: "Verification notes" },
];

type ItineraryAiTarget =
  | { kind: "itinerary"; title: string; focus: string }
  | { kind: "day"; title: string; index: number; focus: string };

export function ExpandedItineraryPanel({
  project,
  expandHint = null,
  selectedEditionId,
  activeSection = "overview",
  onSectionChange,
}: {
  project: Project;
  expandHint?: ExpandHint | null;
  selectedEditionId?: string;
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}) {
  const update = useProjectsStore((s) => s.update);

  const itineraries = project.itineraries;
  const selectedEdition = project.productionPlan.editions.find(
    (edition) => edition.id === selectedEditionId,
  );
  const editionItinerary = selectedEdition
    ? itineraryForEdition(project, selectedEdition)
    : undefined;

  const [creator, setCreator] = React.useState<{
    open: boolean;
    duration: string;
    customDays?: number;
    travelerType: string;
    style: string;
  }>(() => ({
    open: itineraries.length === 0 || Boolean(expandHint),
    duration: expandHint?.duration ?? project.tripConfigs[0]?.duration ?? "7 days",
    customDays: expandHint ? undefined : project.tripConfigs[0]?.customDays,
    travelerType:
      expandHint?.travelerType ?? project.travelerTypes[0] ?? "Couple",
    style: "",
  }));
  const [selectedId, setSelectedId] = React.useState<string | null>(
    editionItinerary?.id ?? itineraries[0]?.id ?? null,
  );
  const [aiTarget, setAiTarget] = React.useState<ItineraryAiTarget | null>(null);

  const selected =
    editionItinerary ??
    itineraries.find((it) => it.id === selectedId) ??
    itineraries[0] ??
    null;

  function setItineraries(next: ItineraryOutput[]) {
    update(project.id, { itineraries: next });
  }

  function updateItinerary(updated: ItineraryOutput) {
    setItineraries(
      itineraries.map((it) =>
        it.id === updated.id
          ? { ...updated, updatedAt: new Date().toISOString() }
          : it,
      ),
    );
  }

  function createItinerary() {
    const route = selectedEdition
      ? editionRoute(project, selectedEdition)
      : undefined;
    const itinerary = buildItinerary(
      buildContext(project, { extraCities: selectedEdition?.cities }),
      {
        duration: selectedEdition?.duration ?? (creator.duration as Duration),
        customDays: selectedEdition?.customDays ?? creator.customDays,
        travelerType:
          selectedEdition?.travelerType ??
          (creator.travelerType as TravelerType),
        style: creator.style ? (creator.style as TravelStyle) : undefined,
        route,
      },
    );
    itinerary.plannedEditionId = selectedEdition?.id;
    update(project.id, {
      itineraries: [...itineraries, itinerary],
      productionPlan: selectedEdition
        ? {
            ...project.productionPlan,
            editions: project.productionPlan.editions.map((edition) =>
              edition.id === selectedEdition.id
                ? { ...edition, itineraryId: itinerary.id }
                : edition,
            ),
          }
        : project.productionPlan,
    });
    setSelectedId(itinerary.id);
    setCreator((c) => ({ ...c, open: false }));
  }

  function setField<K extends keyof ItineraryOutput>(
    key: K,
    value: ItineraryOutput[K],
  ) {
    if (!selected) return;
    updateItinerary({ ...selected, [key]: value });
  }

  function renumber(days: ItineraryOutput["days"]) {
    return days.map((d, i) => ({ ...d, day: i + 1 }));
  }

  function addDay() {
    if (!selected) return;
    const next = dayPlanSchema.parse({
      day: selected.days.length + 1,
      title: `Day ${selected.days.length + 1}`,
    });
    setField("days", [...selected.days, next]);
  }

  function removeDay(index: number) {
    if (!selected) return;
    setField(
      "days",
      renumber(selected.days.filter((_, i) => i !== index)),
    );
  }

  function moveDay(index: number, dir: -1 | 1) {
    if (!selected) return;
    const target = index + dir;
    if (target < 0 || target >= selected.days.length) return;
    const days = [...selected.days];
    [days[index], days[target]] = [days[target], days[index]];
    setField("days", renumber(days));
  }

  function deleteItinerary(id: string) {
    const remaining = itineraries.filter((it) => it.id !== id);
    setItineraries(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  }

  function normalizeItinerary(raw: unknown): ItineraryOutput {
    return normalizeAiItinerary(raw, {
      project,
      current: selected,
      fallback: {
        id: crypto.randomUUID(),
        duration: creator.duration,
        travelerType: creator.travelerType,
        createdAt: new Date().toISOString(),
      },
    });
  }

  function validateItineraryAi(text: string): string | null {
    try {
      if (isLikelyTruncatedJson(text)) {
        return "The model response was cut off before the itinerary JSON finished. Retry the run; RouteCrafter did not apply anything.";
      }
      if (aiTarget?.kind === "day") {
        normalizeAiDayPlan(parseJsonObject(text), selected?.days[aiTarget.index]);
      } else {
        normalizeItinerary(parseJsonObject(text));
      }
      return null;
    } catch {
      return "The model returned itinerary JSON RouteCrafter could not safely apply.";
    }
  }

  function mergeText(current: string, incoming: string, mode: string): string {
    if (mode === "replace") return incoming;
    if (mode === "append") return [current, incoming].filter(Boolean).join("\n\n");
    return current || incoming;
  }

  function mergeDay(
    current: ItineraryOutput["days"][number],
    incoming: ItineraryOutput["days"][number],
    mode: "replace" | "fill-empty" | "append",
  ) {
    if (mode === "replace") return { ...incoming, day: current.day };
    const next = { ...current };
    for (const key of Object.keys(incoming) as (keyof typeof incoming)[]) {
      if (key === "day") continue;
      const currentValue = current[key];
      const incomingValue = incoming[key];
      if (typeof currentValue === "string" && typeof incomingValue === "string") {
        (next as Record<string, unknown>)[key] = mergeText(
          currentValue,
          incomingValue,
          mode,
        );
      } else if (!currentValue && incomingValue) {
        (next as Record<string, unknown>)[key] = incomingValue;
      }
    }
    return next;
  }

  function mergeItinerary(
    current: ItineraryOutput | null,
    incoming: ItineraryOutput,
    mode: "replace" | "fill-empty" | "append",
  ): ItineraryOutput {
    if (!current || mode === "replace") return incoming;
    return {
      ...current,
      title: mergeText(current.title, incoming.title, mode),
      subtitle: mergeText(current.subtitle, incoming.subtitle, mode),
      overview: mergeText(current.overview, incoming.overview, mode),
      whoFor: mergeText(current.whoFor, incoming.whoFor, mode),
      routeSummary: mergeText(current.routeSummary, incoming.routeSummary, mode),
      bestStayAreas: mergeText(current.bestStayAreas, incoming.bestStayAreas, mode),
      foodGuide: mergeText(current.foodGuide, incoming.foodGuide, mode),
      transportGuide: mergeText(current.transportGuide, incoming.transportGuide, mode),
      packingList: mergeText(current.packingList, incoming.packingList, mode),
      etiquetteSafety: mergeText(
        current.etiquetteSafety,
        incoming.etiquetteSafety,
        mode,
      ),
      bookingChecklist: mergeText(
        current.bookingChecklist,
        incoming.bookingChecklist,
        mode,
      ),
      personalizationQuestions: mergeText(
        current.personalizationQuestions,
        incoming.personalizationQuestions,
        mode,
      ),
      verificationNotes: mergeText(
        current.verificationNotes,
        incoming.verificationNotes,
        mode,
      ),
      days: current.days.map((day, index) =>
        incoming.days[index] ? mergeDay(day, incoming.days[index], mode) : day,
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  function applyItineraryAi(
    text: string,
    result: Parameters<typeof createAiRunMetadata>[0]["result"],
    mode: "replace" | "fill-empty" | "append",
  ) {
    if (!aiTarget) return;
    if (aiTarget.kind === "day" && selected) {
      const incoming = normalizeAiDayPlan(
        parseJsonObject(text),
        selected.days[aiTarget.index],
      );
      const nextDays = selected.days.map((day, index) =>
        index === aiTarget.index ? mergeDay(day, incoming, mode) : day,
      );
      updateItinerary({ ...selected, days: nextDays });
    } else {
      const incoming = normalizeItinerary(parseJsonObject(text));
      const next = mergeItinerary(selected, incoming, mode);
      const exists = itineraries.some((itinerary) => itinerary.id === next.id);
      setItineraries(
        exists
          ? itineraries.map((itinerary) =>
              itinerary.id === next.id ? next : itinerary,
            )
          : [...itineraries, next],
      );
      setSelectedId(next.id);
    }
    update(project.id, {
      aiRuns: appendAiRun(
        project,
        createAiRunMetadata({
          result,
          taskType: aiTarget.kind === "day" ? "rewrite" : "itinerary",
          label: aiTarget.title,
          source: "expanded-itinerary",
        }),
      ),
    });
    void markAiRunApplied({
      aiRunId: result.aiRunId,
      aiRunIds: result.aiRunIds,
      projectId: project.id,
    });
  }

  const aiPrompt =
    aiTarget?.kind === "day" && selected
      ? buildDayPrompt(
          project,
          selected,
          selected.days[aiTarget.index],
          aiTarget.focus,
        )
      : buildItineraryPrompt(project, selected, aiTarget?.focus);

  const SECTIONS: [string, string][] = [
    ["overview", "Overview"],
    ["days", "Daily plan"],
    ["guides", "Included guides"],
    ["quality", "Quality notes"],
  ];
  const editionBlockers = selectedEdition
    ? itineraryBlockers(project, selectedEdition)
    : [];

  return (
    <div className="space-y-6">
      {selectedEdition ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-border-soft bg-paper/90 p-2 backdrop-blur">
          <div
            role="tablist"
            aria-label="Itinerary sections"
            className="flex flex-1 flex-wrap gap-1"
          >
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeSection === id}
                onClick={() => onSectionChange?.(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage",
                  activeSection === id
                    ? "bg-sage-soft/80 text-forest"
                    : "text-ink-soft hover:bg-paper-2/60 hover:text-ink",
                )}
              >
                {label}
                {id === "quality" && editionBlockers.length ? (
                  <CircleAlert className="size-3.5 text-terracotta" />
                ) : null}
              </button>
            ))}
          </div>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-paper-2/60">
              {editionBlockers.length ? (
                <>
                  <CircleAlert className="size-3.5 text-terracotta" />
                  {editionBlockers.length} to finish
                </>
              ) : (
                <>
                  <Check className="size-3.5 text-forest" />
                  Edition complete
                </>
              )}
            </summary>
            <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-border-strong bg-paper p-4 shadow-[var(--shadow-lift)]">
              <p className="rc-eyebrow text-ink-muted">Launch checklist</p>
              <div className="mt-3 space-y-2">
                {editionBlockers.length ? (
                  editionBlockers.map((blocker) => (
                    <p
                      key={blocker}
                      className="flex items-start gap-2 text-xs leading-5 text-ink-soft"
                    >
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-terracotta" />
                      {blocker}
                    </p>
                  ))
                ) : (
                  <p className="flex items-center gap-2 text-xs text-forest">
                    <Check className="size-3.5" />
                    Edition is complete
                  </p>
                )}
              </div>
            </div>
          </details>
        </div>
      ) : null}

      <div
        className={cn(
          selectedEdition ? "" : "grid grid-cols-1 gap-6 lg:grid-cols-4",
        )}
      >
        {/* Standalone sidebar: itinerary list + creator (hidden in edition mode) */}
        {!selectedEdition ? (
          <aside className="space-y-3 lg:col-span-1">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setCreator((c) => ({ ...c, open: !c.open }))}
            >
              <Plus className="size-4" />
              New itinerary
            </Button>

            {creator.open ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <FormField label="Duration">
                <Select
                  value={creator.duration}
                  onChange={(e) => {
                    const duration = e.target.value;
                    setCreator((c) => ({
                      ...c,
                      duration,
                      customDays:
                        duration === project.tripConfigs[0]?.duration
                          ? project.tripConfigs[0]?.customDays
                          : undefined,
                    }));
                  }}
                >
                  {enumValues.duration.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Traveler type">
                <Select
                  value={creator.travelerType}
                  onChange={(e) =>
                    setCreator((c) => ({ ...c, travelerType: e.target.value }))
                  }
                >
                  {enumValues.travelerType.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Style (optional)">
                <Select
                  value={creator.style}
                  onChange={(e) =>
                    setCreator((c) => ({ ...c, style: e.target.value }))
                  }
                >
                  <option value="">Auto</option>
                  {enumValues.travelStyle.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FormField>
              <Button className="w-full" onClick={createItinerary}>
                <CalendarPlus className="size-4" />
                Create itinerary
              </Button>
            </CardContent>
          </Card>
            ) : null}

            <div className="space-y-1.5">
              {itineraries.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    it.id === selected?.id
                      ? "bg-sage-soft text-forest"
                      : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
                  )}
                >
                  <span className="font-medium">{it.duration}</span>
                  <span className="text-xs text-ink-muted">
                    {it.travelerType}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        {/* Editor */}
        <div className={cn(selectedEdition ? "" : "lg:col-span-3")}>
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 space-y-2">
                <Input
                  value={selected.title}
                  onChange={(e) => setField("title", e.target.value)}
                  className="text-base font-semibold"
                />
                <Input
                  value={selected.subtitle}
                  onChange={(e) => setField("subtitle", e.target.value)}
                  placeholder="Subtitle"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <AiCostButton
                  size="sm"
                  taskType="itinerary"
                  onClick={() =>
                    setAiTarget({
                      kind: "itinerary",
                      title: "AI draft full itinerary",
                      focus: "Build or improve the complete itinerary.",
                    })
                  }
                >
                  AI draft itinerary
                </AiCostButton>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadItineraryMarkdown(selected, project)}
                >
                  <FileDown className="size-4" />
                  Markdown
                </Button>
                <button
                  type="button"
                  onClick={() => deleteItinerary(selected.id)}
                  aria-label="Delete itinerary"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border-strong bg-paper/60 text-ink-soft transition-colors hover:border-terracotta/50 hover:text-terracotta"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            {activeSection === "overview" ? (
              <PromptHelper
                project={project}
                templateIds={["expanded-itinerary"]}
              />
            ) : null}

            {activeSection === "overview" ? <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["AI fill empty sections", "Fill only weak or empty itinerary fields."],
                ["AI add rainy-day alternatives", "Improve rainy-day alternatives for each day."],
                ["AI add booking notes", "Add practical booking notes without inventing availability."],
                ["AI add food & transport guides", "Improve food, cafe, and transport guide sections."],
              ].map(([title, focus]) => (
                <AiCostButton
                  key={title}
                  size="sm"
                  taskType="itinerary"
                  className="h-full w-full"
                  onClick={() =>
                    setAiTarget({ kind: "itinerary", title, focus })
                  }
                >
                  {title}
                </AiCostButton>
              ))}
            </div> : null}

            {activeSection === "overview" ? <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              {TOP_FIELDS.map((f) => (
                <FormField key={f.key} label={f.label}>
                  <Textarea
                    value={selected[f.key] as string}
                    rows={3}
                    autoSize
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </FormField>
              ))}
            </div> : null}

            {activeSection === "days" ? <>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Days ({selected.days.length})
              </h4>
              <Button variant="outline" size="sm" onClick={addDay}>
                <Plus className="size-4" />
                Add day
              </Button>
            </div>

            <div className="space-y-4">
              {selected.days.map((day, i) => (
                <DayCard
                  key={`${selected.id}-${i}`}
                  day={day}
                  onChange={(next) =>
                    setField(
                      "days",
                      selected.days.map((d, di) => (di === i ? next : d)),
                    )
                  }
                  onRemove={() => removeDay(i)}
                  onMoveUp={() => moveDay(i, -1)}
                  onMoveDown={() => moveDay(i, 1)}
                  canMoveUp={i > 0}
                  canMoveDown={i < selected.days.length - 1}
                  onAiImprove={() =>
                    setAiTarget({
                      kind: "day",
                      title: `AI improve day ${day.day}`,
                      index: i,
                      focus:
                        "Improve this day, fill weak fields, and preserve useful manual details.",
                    })
                  }
                />
              ))}
            </div>
            </> : null}

            {activeSection === "guides" || activeSection === "quality" ? (
            <div className="space-y-5">
              <PromptHelper
                project={project}
                templateIds={
                  activeSection === "guides"
                    ? ["food-guide", "transport-guide", "packing-list"]
                    : ["expanded-itinerary"]
                }
              />
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              {GUIDE_FIELDS.filter((field) =>
                activeSection === "quality"
                  ? ["etiquetteSafety", "verificationNotes"].includes(field.key)
                  : !["etiquetteSafety", "verificationNotes"].includes(field.key),
              ).map((f) => (
                <FormField key={f.key} label={f.label}>
                  <Textarea
                    value={selected[f.key] as string}
                    rows={4}
                    autoSize
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </FormField>
              ))}
              </div>
            </div>
            ) : null}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-sage-soft text-forest">
                <Map className="size-6" />
              </span>
              <div className="space-y-1">
                <p className="text-base font-semibold text-ink">
                  No itineraries yet
                </p>
                <p className="mx-auto max-w-sm text-sm text-ink-soft">
                  Create your first day-by-day itinerary using the panel on the
                  left. It scaffolds from this project&apos;s trip configuration.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
      <AiRunSheet
        open={Boolean(aiTarget)}
        onOpenChange={(open) => {
          if (!open) setAiTarget(null);
        }}
        mode="text"
        title={aiTarget?.title ?? "AI itinerary assist"}
        description="Creates structured itinerary JSON and previews it before applying. Existing edits are preserved unless you choose replace."
        taskType={aiTarget?.kind === "day" ? "rewrite" : "itinerary"}
        projectId={project.id}
        sourceLabel={
          aiTarget?.kind === "day"
            ? `Day ${selected?.days[aiTarget.index]?.day ?? ""}`
            : "Expanded itinerary"
        }
        prompt={aiPrompt}
        currentText={
          aiTarget?.kind === "day" && selected
            ? JSON.stringify(selected.days[aiTarget.index], null, 2)
            : selected
              ? JSON.stringify(selected, null, 2)
              : ""
        }
        responseFormat="json"
        validateText={validateItineraryAi}
        requestText={
          aiTarget?.kind === "itinerary" && selected
            ? (request, signal) =>
                requestStructuredItineraryDraft({
                  request,
                  signal,
                  project,
                  current: selected,
                  focus: aiTarget.focus,
                })
            : undefined
        }
        onApplyText={applyItineraryAi}
        applyLabel={aiTarget?.kind === "day" ? "Replace day" : "Replace itinerary"}
        fillEmptyLabel="Fill empty fields"
        appendLabel="Append to fields"
        instructionsPlaceholder={
          aiTarget?.kind === "day"
            ? "e.g. Make the afternoon less walking-heavy and add a vegetarian dinner option"
            : undefined
        }
        instructionsSuggestions={
          aiTarget?.kind === "day"
            ? [
                "Less walking",
                "More food spots",
                "Add a rainy-day backup",
                "More relaxed pace",
                "Family-friendly",
                "Lower budget",
              ]
            : undefined
        }
      />
    </div>
  );
}
