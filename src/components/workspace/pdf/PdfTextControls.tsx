"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  FileText,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import type { CustomBlock, ItineraryOutput, Project } from "@/lib/types";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FormField, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type StringItineraryField =
  | "country"
  | "title"
  | "subtitle"
  | "overview"
  | "whoFor"
  | "routeSummary"
  | "bestStayAreas"
  | "foodGuide"
  | "transportGuide"
  | "packingList"
  | "etiquetteSafety"
  | "bookingChecklist"
  | "verificationNotes";

type DayStringField =
  | "title"
  | "base"
  | "morning"
  | "lunch"
  | "afternoon"
  | "evening"
  | "dinner"
  | "transportNotes"
  | "bookingNotes"
  | "optionalUpgrade"
  | "lowEnergyAlternative"
  | "rainyDayAlternative"
  | "whyThisWorks";

const TOP_FIELDS: {
  key: StringItineraryField;
  label: string;
  rows: number;
}[] = [
  { key: "overview", label: "Trip overview", rows: 4 },
  { key: "whoFor", label: "Who it's for", rows: 3 },
  { key: "routeSummary", label: "Route", rows: 3 },
  { key: "bestStayAreas", label: "Best stay areas", rows: 3 },
];

const DAY_TEXT_FIELDS: {
  key: DayStringField;
  label: string;
  rows: number;
}[] = [
  { key: "morning", label: "Morning", rows: 3 },
  { key: "lunch", label: "Lunch", rows: 2 },
  { key: "afternoon", label: "Afternoon", rows: 3 },
  { key: "evening", label: "Evening", rows: 3 },
  { key: "dinner", label: "Dinner", rows: 2 },
  { key: "transportNotes", label: "Transport", rows: 2 },
  { key: "bookingNotes", label: "Booking", rows: 2 },
  { key: "optionalUpgrade", label: "Upgrade", rows: 2 },
  { key: "lowEnergyAlternative", label: "Low-energy", rows: 2 },
  { key: "rainyDayAlternative", label: "Rainy day", rows: 2 },
  { key: "whyThisWorks", label: "Why it works", rows: 2 },
];

const GUIDE_FIELDS: {
  key: StringItineraryField;
  label: string;
}[] = [
  { key: "foodGuide", label: "Food & cafe guide" },
  { key: "transportGuide", label: "Transport guide" },
  { key: "packingList", label: "Packing list" },
  { key: "etiquetteSafety", label: "Etiquette & safety" },
  { key: "bookingChecklist", label: "Booking checklist" },
];

const TEXT_VARIANTS = [
  { id: "heading", label: "Heading" },
  { id: "subheading", label: "Eyebrow" },
  { id: "body", label: "Body" },
  { id: "callout", label: "Callout" },
];

function makeId() {
  return `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function sortedBlocks(blocks: CustomBlock[] = []) {
  return [...blocks].sort((a, b) => a.order - b.order);
}

function anchorLabel(anchor: string, itinerary: ItineraryOutput) {
  if (anchor === "cover") return "Cover";
  if (anchor === "overview") return "Overview";
  if (anchor === "guides") return "Guides";
  if (anchor === "closing") return "Closing";
  if (anchor.startsWith("day:")) {
    const dayNumber = Number(anchor.slice(4));
    const day = itinerary.days.find((item) => item.day === dayNumber);
    return `Day ${dayNumber}${day?.title ? ` - ${day.title}` : ""}`;
  }
  return anchor;
}

export function PdfTextControls({
  project,
  itinerary,
}: {
  project: Project;
  itinerary: ItineraryOutput;
}) {
  const patchItinerary = useProjectsStore((state) => state.patchItinerary);
  const [error, setError] = React.useState<string | null>(null);
  const [newBlockAnchor, setNewBlockAnchor] = React.useState("overview");

  function applyPatch(
    patch:
      | Partial<ItineraryOutput>
      | ((current: ItineraryOutput) => ItineraryOutput),
  ) {
    const result = patchItinerary(project.id, itinerary.id, patch);
    setError(result.ok ? null : result.error);
    return result.ok;
  }

  function setField(key: StringItineraryField, value: string) {
    applyPatch({ [key]: value } as Partial<ItineraryOutput>);
  }

  function setDayField(index: number, key: DayStringField, value: string) {
    applyPatch((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) =>
        dayIndex === index ? { ...day, [key]: value } : day,
      ),
    }));
  }

  function addTextBlock(anchor: string) {
    applyPatch((current) => {
      const blocks = current.customBlocks ?? [];
      const maxOrder = blocks
        .filter((block) => block.anchor === anchor)
        .reduce((max, block) => Math.max(max, block.order), -1);
      return {
        ...current,
        customBlocks: [
          ...blocks,
          {
            id: makeId(),
            anchor,
            order: maxOrder + 1,
            type: "text",
            variant: "body",
            text: "",
            image: "",
          },
        ],
      };
    });
  }

  function updateTextBlock(id: string, value: Partial<CustomBlock>) {
    applyPatch((current) => ({
      ...current,
      customBlocks: (current.customBlocks ?? []).map((block) =>
        block.id === id ? { ...block, ...value } : block,
      ),
    }));
  }

  function removeTextBlock(id: string) {
    applyPatch((current) => ({
      ...current,
      customBlocks: (current.customBlocks ?? []).filter(
        (block) => block.id !== id,
      ),
    }));
  }

  function moveTextBlock(block: CustomBlock, direction: -1 | 1) {
    applyPatch((current) => {
      const siblings = sortedBlocks(
        (current.customBlocks ?? []).filter(
          (candidate) => candidate.anchor === block.anchor,
        ),
      );
      const index = siblings.findIndex((candidate) => candidate.id === block.id);
      const swapIndex = index + direction;
      if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length)
        return current;
      const a = siblings[index];
      const b = siblings[swapIndex];
      return {
        ...current,
        customBlocks: (current.customBlocks ?? []).map((candidate) => {
          if (candidate.id === a.id) return { ...candidate, order: b.order };
          if (candidate.id === b.id) return { ...candidate, order: a.order };
          return candidate;
        }),
      };
    });
  }

  const anchorOptions = [
    { id: "cover", label: "Cover" },
    { id: "overview", label: "Overview" },
    ...itinerary.days.map((day) => ({
      id: `day:${day.day}`,
      label: `Day ${day.day}`,
    })),
    { id: "guides", label: "Guides" },
    { id: "closing", label: "Closing" },
  ];
  const textBlocks = sortedBlocks(itinerary.customBlocks).filter(
    (block) => block.type === "text",
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Type className="size-4 text-terracotta" />
          Text content
        </div>

        <SidebarSection title="Cover" defaultOpen>
          <TextInputField
            label="Country"
            value={itinerary.country}
            onChange={(value) => setField("country", value)}
          />
          <TextInputField
            label="Title"
            value={itinerary.title}
            onChange={(value) => setField("title", value)}
          />
          <TextAreaField
            label="Subtitle"
            value={itinerary.subtitle}
            rows={2}
            placeholder="Subtitle"
            onChange={(value) => setField("subtitle", value)}
          />
        </SidebarSection>

        <SidebarSection title="Overview" defaultOpen>
          {TOP_FIELDS.map((field) => (
            <TextAreaField
              key={field.key}
              label={field.label}
              value={(itinerary[field.key] as string) ?? ""}
              rows={field.rows}
              onChange={(value) => setField(field.key, value)}
            />
          ))}
        </SidebarSection>

        <SidebarSection title={`Days (${itinerary.days.length})`}>
          <div className="space-y-3">
            {itinerary.days.map((day, index) => (
              <details
                key={`${itinerary.id}-text-day-${day.day}-${index}`}
                className="rounded-xl border border-border-soft bg-paper-2/25 p-3"
              >
                <summary className="cursor-pointer text-xs font-semibold text-ink-soft">
                  Day {day.day} - {day.title || "Untitled"}
                </summary>
                <div className="mt-3 space-y-3">
                  <TextInputField
                    label="Day title"
                    value={day.title}
                    onChange={(value) => setDayField(index, "title", value)}
                  />
                  <TextInputField
                    label="Base city"
                    value={day.base}
                    onChange={(value) => setDayField(index, "base", value)}
                  />
                  {DAY_TEXT_FIELDS.map((field) => (
                    <TextAreaField
                      key={field.key}
                      label={field.label}
                      value={(day[field.key] as string) ?? ""}
                      rows={field.rows}
                      onChange={(value) => setDayField(index, field.key, value)}
                    />
                  ))}
                </div>
              </details>
            ))}
          </div>
        </SidebarSection>

        <SidebarSection title="Guides">
          {GUIDE_FIELDS.map((field) => (
            <TextAreaField
              key={field.key}
              label={field.label}
              value={(itinerary[field.key] as string) ?? ""}
              rows={4}
              onChange={(value) => setField(field.key, value)}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Closing">
          <TextAreaField
            label="Verification note"
            value={itinerary.verificationNotes}
            rows={4}
            onChange={(value) => setField("verificationNotes", value)}
          />
        </SidebarSection>

        <SidebarSection title="Custom PDF sections">
          <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <SelectField
                label="Add text on page"
                value={newBlockAnchor}
                onChange={setNewBlockAnchor}
                options={anchorOptions}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addTextBlock(newBlockAnchor)}
                aria-label="Add custom PDF text"
              >
                <Plus className="size-4" />
              </Button>
            </div>

            {textBlocks.length ? (
              <div className="space-y-3">
                {textBlocks.map((block) => {
                  const siblings = sortedBlocks(
                    (itinerary.customBlocks ?? []).filter(
                      (candidate) => candidate.anchor === block.anchor,
                    ),
                  );
                  const index = siblings.findIndex(
                    (candidate) => candidate.id === block.id,
                  );
                  return (
                    <div
                      key={block.id}
                      className="space-y-3 rounded-xl border border-border-soft bg-paper-2/25 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-ink">
                            {anchorLabel(block.anchor, itinerary)}
                          </p>
                          <p className="text-[11px] text-ink-muted">
                            Custom text block
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <IconButton
                            label="Move custom text up"
                            disabled={index <= 0}
                            onClick={() => moveTextBlock(block, -1)}
                          >
                            <ArrowUp className="size-3.5" />
                          </IconButton>
                          <IconButton
                            label="Move custom text down"
                            disabled={index < 0 || index >= siblings.length - 1}
                            onClick={() => moveTextBlock(block, 1)}
                          >
                            <ArrowDown className="size-3.5" />
                          </IconButton>
                          <IconButton
                            label="Delete custom text"
                            onClick={() => removeTextBlock(block.id)}
                            danger
                          >
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        </div>
                      </div>
                      <SelectField
                        label="Style"
                        value={block.variant || "body"}
                        onChange={(value) =>
                          updateTextBlock(block.id, { variant: value })
                        }
                        options={TEXT_VARIANTS}
                      />
                      <TextAreaField
                        label="Text"
                        value={block.text}
                        rows={3}
                        placeholder="Type PDF text..."
                        onChange={(value) =>
                          updateTextBlock(block.id, { text: value })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border-strong p-3 text-xs leading-relaxed text-ink-muted">
                Add editable PDF-only text blocks to the cover, overview, day,
                guide, or closing pages.
              </p>
            )}
          </div>
        </SidebarSection>

        {error ? <p className="text-xs text-terracotta">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <FormField label={label} htmlFor={id}>
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function TextInputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <FormField label={label} htmlFor={id}>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

function TextAreaField({
  label,
  value,
  rows,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  rows: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <FormField label={label} htmlFor={id}>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        autoSize
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

function SidebarSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="border-t border-border-soft pt-4 first:border-t-0 first:pt-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-ink"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <FileText className="size-4 text-terracotta" />
          {title}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-ink-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? <div className="mt-3 space-y-3">{children}</div> : null}
    </section>
  );
}

function IconButton({
  label,
  danger = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border border-border-soft bg-paper/70 text-ink-soft transition-colors hover:border-forest/40 hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        danger && "hover:border-terracotta/50 hover:text-terracotta",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
