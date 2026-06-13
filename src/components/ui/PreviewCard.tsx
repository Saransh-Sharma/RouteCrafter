import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { Project } from "@/lib/types";
import { Badge } from "./Badge";
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

export function PreviewCard({ project }: { project: Project }) {
  const workflow = getProjectWorkflow(project);
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group rc-card flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      {/* Document mockup band */}
      <div
        className={cn(
          "relative h-28 bg-gradient-to-br px-5 pt-5",
          accentBands[project.accent],
        )}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-forest-deep/80">
          <MapPin className="size-3.5" />
          {project.country}
        </div>
        {/* Faux PDF/page mockups */}
        <div className="absolute -bottom-3 right-5 flex gap-1.5">
          <div className="h-16 w-12 rotate-3 rounded-md border border-border-soft bg-paper shadow-[var(--shadow-soft)]" />
          <div className="h-16 w-12 -rotate-2 rounded-md border border-border-soft bg-paper shadow-[var(--shadow-soft)]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold leading-snug text-ink">
            {project.name}
          </h3>
          <ArrowUpRight className="mt-1 size-4 shrink-0 text-ink-muted transition-colors group-hover:text-forest" />
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-ink-soft">
          {project.positioning}
        </p>

        <div className="mt-auto space-y-3 pt-2">
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
            <Badge tone="neutral">
              {project.productionPlan.editions.length} planned editions
            </Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}
