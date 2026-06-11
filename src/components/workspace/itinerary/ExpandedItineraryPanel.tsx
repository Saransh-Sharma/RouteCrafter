"use client";

import * as React from "react";
import { Plus, Trash2, FileDown, Map, CalendarPlus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { PromptHelper } from "../PromptHelper";
import { DayCard } from "./DayCard";
import { downloadItineraryMarkdown } from "./export-itinerary";

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

export function ExpandedItineraryPanel({ project }: { project: Project }) {
  const update = useProjectsStore((s) => s.update);
  const expandHint = useProjectsStore((s) => s.expandHint);
  const setExpandHint = useProjectsStore((s) => s.setExpandHint);

  const itineraries = project.itineraries;

  const [creator, setCreator] = React.useState<{
    open: boolean;
    duration: string;
    travelerType: string;
    style: string;
  }>(() => ({
    open: itineraries.length === 0 || Boolean(expandHint),
    duration: expandHint?.duration ?? project.tripConfigs[0]?.duration ?? "7 days",
    travelerType:
      expandHint?.travelerType ?? project.travelerTypes[0] ?? "Couple",
    style: "",
  }));
  const [selectedId, setSelectedId] = React.useState<string | null>(
    itineraries[0]?.id ?? null,
  );

  // Consume the cross-tab expand hint once.
  React.useEffect(() => {
    if (expandHint) setExpandHint(null);
  }, [expandHint, setExpandHint]);

  const selected =
    itineraries.find((it) => it.id === selectedId) ?? itineraries[0] ?? null;

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
    const itinerary = buildItinerary(buildContext(project), {
      duration: creator.duration as Duration,
      travelerType: creator.travelerType as TravelerType,
      style: creator.style ? (creator.style as TravelStyle) : undefined,
    });
    setItineraries([...itineraries, itinerary]);
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Sidebar: itinerary list + creator */}
      <aside className="space-y-3 lg:col-span-1">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() =>
            setCreator((c) => ({ ...c, open: !c.open }))
          }
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
                  onChange={(e) =>
                    setCreator((c) => ({ ...c, duration: e.target.value }))
                  }
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
              <span className="text-xs text-ink-muted">{it.travelerType}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Editor */}
      <div className="lg:col-span-3">
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
              <div className="flex shrink-0 items-center gap-2">
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

            <PromptHelper
              project={project}
              templateIds={[
                "expanded-itinerary",
                "food-guide",
                "transport-guide",
                "packing-list",
              ]}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {TOP_FIELDS.map((f) => (
                <FormField key={f.key} label={f.label}>
                  <Textarea
                    value={selected[f.key] as string}
                    rows={2}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </FormField>
              ))}
            </div>

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
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {GUIDE_FIELDS.map((f) => (
                <FormField key={f.key} label={f.label}>
                  <Textarea
                    value={selected[f.key] as string}
                    rows={3}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </FormField>
              ))}
            </div>
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
  );
}
