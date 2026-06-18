"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Trash2,
} from "lucide-react";
import type { DayPlan } from "@/lib/types";
import { enumValues } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { AiCostButton } from "@/components/ai/AiCostButton";
import { cn } from "@/lib/utils";

const TEXT_FIELDS: { key: keyof DayPlan; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "lunch", label: "Lunch" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "dinner", label: "Dinner area" },
  { key: "transportNotes", label: "Transport notes" },
  { key: "bookingNotes", label: "Booking notes" },
  { key: "walkingIntensity", label: "Walking intensity" },
  { key: "optionalUpgrade", label: "Optional upgrade" },
  { key: "lowEnergyAlternative", label: "Low-energy alternative" },
  { key: "rainyDayAlternative", label: "Rainy-day alternative" },
  { key: "whyThisWorks", label: "Why this day works" },
];

export function DayCard({
  day,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onAiImprove,
}: {
  day: DayPlan;
  onChange: (next: DayPlan) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAiImprove?: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  function set<K extends keyof DayPlan>(key: K, value: DayPlan[K]) {
    onChange({ ...day, [key]: value });
  }

  const complete = Boolean(
    day.title?.trim() &&
      day.base?.trim() &&
      [day.morning, day.lunch, day.afternoon, day.evening, day.dinner].some(
        (value) => value?.trim(),
      ),
  );
  const summary =
    [day.base, day.morning, day.afternoon, day.evening]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" · ") || "No activities yet";

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? `Collapse day ${day.day}` : `Expand day ${day.day}`}
            className={cn(
              "relative flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
              complete
                ? "bg-forest text-paper"
                : "bg-sage-soft text-forest hover:bg-sage-soft/70",
            )}
          >
            {complete ? <Check className="size-4" /> : day.day}
          </button>
          {open ? (
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                value={day.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Day title"
              />
              <Input
                value={day.base}
                onChange={(e) => set("base", e.target.value)}
                placeholder="Base / city"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate rc-label">
                {day.title?.trim() || `Day ${day.day}`}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{summary}</p>
            </button>
          )}
          <div className="flex flex-wrap items-center gap-1 sm:justify-end">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "Collapse day" : "Expand day"}
              className="rounded-lg p-1.5 text-ink-soft hover:bg-paper-2/70 hover:text-ink"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  open && "rotate-90",
                )}
              />
            </button>
            {onAiImprove ? (
              <AiCostButton
                size="sm"
                taskType="rewrite"
                onClick={onAiImprove}
                className="mr-1 min-h-8 px-2.5 py-1.5 text-xs"
              >
                AI improve
              </AiCostButton>
            ) : null}
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              aria-label="Move day up"
              className="rounded-lg p-1.5 text-ink-soft hover:bg-paper-2/70 hover:text-ink disabled:opacity-30"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              aria-label="Move day down"
              className="rounded-lg p-1.5 text-ink-soft hover:bg-paper-2/70 hover:text-ink disabled:opacity-30"
            >
              <ChevronDown className="size-4" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove day"
              className="rounded-lg p-1.5 text-ink-soft hover:bg-terracotta/10 hover:text-terracotta"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "grid grid-cols-1 items-start gap-3 sm:grid-cols-2",
            !open && "hidden",
          )}
        >
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {f.label}
              </label>
              <Textarea
                value={day[f.key] as string}
                rows={2}
                autoSize
                onChange={(e) => set(f.key, e.target.value)}
              />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Pace
            </label>
            <Select
              value={day.pace ?? ""}
              onChange={(e) =>
                set("pace", (e.target.value || undefined) as DayPlan["pace"])
              }
            >
              <option value="">Not set</option>
              {enumValues.pace.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
