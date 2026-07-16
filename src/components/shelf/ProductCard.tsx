/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Layers, MapPin } from "lucide-react";
import type { Project } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { getProjectWorkflow } from "@/lib/workflow";

const accentBands: Record<Project["accent"], string> = {
  sage: "from-sage/35 to-sage-soft",
  terracotta: "from-terracotta/30 to-terracotta-soft",
  teal: "from-teal/30 to-teal-soft",
  gold: "from-gold/35 to-gold-soft",
  forest: "from-forest/45 to-sage-soft",
};

const statusTone = {
  Draft: "neutral",
  "In progress": "gold",
  "Ready to sell": "sage",
} as const;

/** Image-forward shelf card: 3:2 cover, country, title, status, progress. */
export function ProductCard({ project }: { project: Project }) {
  const workflow = getProjectWorkflow(project);
  const cover =
    project.coverImage ||
    project.itineraries.find((itinerary) => itinerary.coverImage)?.coverImage;

  return (
    <Link
      href={`/products/${project.id}`}
      className="group rc-card flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      <div
        className={cn(
          "relative aspect-[3/2] overflow-hidden bg-gradient-to-br",
          accentBands[project.accent],
        )}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          /* Faux PDF pages so empty products still feel like artifacts */
          <div className="absolute bottom-4 right-5 flex gap-1.5">
            <div className="h-20 w-14 rotate-3 rounded-md border border-border-soft bg-paper shadow-[var(--shadow-soft)]" />
            <div className="h-20 w-14 -rotate-2 rounded-md border border-border-soft bg-paper shadow-[var(--shadow-soft)]" />
          </div>
        )}
        <div
          className={cn(
            "absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm",
            cover ? "bg-ink/40 text-paper" : "bg-paper/70 text-forest-deep",
          )}
        >
          <MapPin className="size-3" aria-hidden />
          {project.country || "No country"}
        </div>
        {project.series ? (
          <div
            className={cn(
              "absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm",
              cover ? "bg-ink/40 text-paper" : "bg-paper/70 text-ink-soft",
            )}
            title={project.series.seriesName || "Series"}
          >
            <Layers className="size-3" aria-hidden />
            Series
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <h3 className="text-heading font-display leading-snug text-ink">
          {project.name}
        </h3>
        <p className="line-clamp-2 text-caption leading-relaxed text-ink-soft">
          {project.positioning}
        </p>
        <div className="mt-auto space-y-3 pt-1">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-ink-muted">
              <span>{workflow.recommendedAction}</span>
              <span>{workflow.progress}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-paper-2">
              <div
                className="h-full rounded-full bg-forest transition-[width]"
                style={{ width: `${workflow.progress}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={statusTone[project.status]}>{project.status}</Badge>
            {project.productionPlan.editions.length ? (
              <Badge tone="neutral">
                {project.productionPlan.editions.length} edition
                {project.productionPlan.editions.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
