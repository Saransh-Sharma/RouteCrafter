import Link from "next/link";
import { Info, Sparkles } from "lucide-react";
import type { Project } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AiCostBadge } from "@/components/ai/AiCostButton";
import { configuredProviders, useAiSettingsStore } from "@/lib/store/ai-settings-store";
import { AI_PROVIDERS } from "@/lib/ai/providers";

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
        <AiReadinessCard project={project} />

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

function AiReadinessCard({ project }: { project: Project }) {
  const providers = useAiSettingsStore((state) => state.providers);
  const textProvider = useAiSettingsStore((state) => state.text.provider);
  const configured = configuredProviders(providers);
  const ready = configured.length > 0;
  const suggestion =
    project.itineraries.length === 0
      ? "AI Draft itinerary"
      : project.listing
        ? "AI Improve marketplace listing"
        : project.itineraries.some((itinerary) => !itinerary.coverImage)
          ? "AI Create cover image"
          : "Run prompt with AI";

  return (
    <Card className="border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--rc-ai-gold-soft)] text-[var(--rc-ai-brown)]">
            <Sparkles className="size-5" />
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink">
                AI assist mode
              </p>
              <AiCostBadge />
            </div>
            <p className="text-xs leading-relaxed text-ink-soft">
              {ready
                ? `${AI_PROVIDERS[textProvider].label} is ready for billable text requests.`
                : "Add a provider key to unlock paid AI drafting and polish."}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--rc-ai-border)] bg-paper/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rc-ai-brown)]">
            Suggested next action
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{suggestion}</p>
        </div>
        <Link
          href="/settings"
          className="inline-flex w-full items-center justify-center rounded-full border border-[var(--rc-ai-border)] bg-paper/70 px-4 py-2 text-sm font-medium text-[var(--rc-ai-brown)] hover:border-forest/40 hover:text-forest"
        >
          {ready ? "Review AI settings" : "Add AI provider key"}
        </Link>
      </CardContent>
    </Card>
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
