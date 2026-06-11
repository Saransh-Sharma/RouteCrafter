import { Info } from "lucide-react";
import type { Project } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function OverviewPanel({ project }: { project: Project }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Positioning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-base leading-relaxed text-ink-soft">
              {project.positioning}
            </p>
            <div className="rc-divider" />
            <DetailRow label="Target audience" value={project.targetAudience} />
            <DetailRow
              label="Cities / regions"
              value={project.regions.join(" · ")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supported configurations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ChipRow label="Durations" items={project.durations} tone="teal" />
            <ChipRow
              label="Traveler types"
              items={project.travelerTypes}
              tone="sage"
            />
            <ChipRow
              label="Travel styles"
              items={project.travelStyles}
              tone="gold"
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Deliverables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {project.deliverables.map((d) => (
                <Badge key={d} tone="forest">
                  {d}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gold/30 bg-gold-soft/40">
          <CardContent className="flex gap-3 p-5">
            <Info className="mt-0.5 size-5 shrink-0 text-brown" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-brown">
                Verify before delivery
              </p>
              <p className="text-xs leading-relaxed text-brown/80">
                Every generated itinerary reminds buyers to verify live opening
                hours, prices, tickets, and hotel availability. RouteCrafter
                never fabricates real-time data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

function ChipRow({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "sage" | "teal" | "gold";
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} tone={tone}>
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
