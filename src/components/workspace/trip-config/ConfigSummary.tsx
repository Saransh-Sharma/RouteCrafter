"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Project, TripConfiguration } from "@/lib/types";

export function ConfigSummary({
  values,
  project,
}: {
  values: TripConfiguration;
  project: Project;
}) {
  const duration =
    values.duration === "14 days" && values.customDays
      ? `${values.customDays} days`
      : values.duration;

  return (
    <Card className="lg:sticky lg:top-6">
      <CardHeader>
        <CardTitle>Configuration summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row label="Country" value={project.country || "—"} />
        <Row
          label="Cities"
          value={values.cities.length ? values.cities.join(" · ") : "—"}
        />
        <Row label="Duration" value={duration} />
        <Row label="Traveler" value={values.travelerType} />
        <Row label="Pace" value={values.pace} />
        <Row label="Budget" value={values.budget} />

        <div className="rc-divider" />

        <ChipSummary label="Travel styles" items={values.travelStyles} tone="sage" />
        <ChipSummary label="Interests" items={values.interests} tone="teal" />
        <ChipSummary
          label="Constraints"
          items={values.constraints}
          tone="terracotta"
        />
        <ChipSummary
          label="Deliverables"
          items={values.deliverables}
          tone="forest"
        />
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <span className="text-right text-sm text-ink">{value}</span>
    </div>
  );
}

function ChipSummary({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "sage" | "teal" | "terracotta" | "forest";
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} tone={tone}>
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">—</p>
      )}
    </div>
  );
}
