"use client";

import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import type { DayPlan } from "@/lib/types";
import { enumValues } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/field";
import { AiCostButton } from "@/components/ai/AiCostButton";

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
  function set<K extends keyof DayPlan>(key: K, value: DayPlan[K]) {
    onChange({ ...day, [key]: value });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sm font-semibold text-forest">
            {day.day}
          </span>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
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
          <div className="flex shrink-0 items-center gap-1">
            {onAiImprove ? (
              <AiCostButton
                size="sm"
                showBadge={false}
                onClick={onAiImprove}
                className="mr-1 h-8 px-2.5 text-xs"
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {f.label}
              </label>
              <Textarea
                value={day[f.key] as string}
                rows={2}
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
