import { CheckCircle2, Loader2 } from "lucide-react";
import type { Project } from "@/lib/types";
import type { CountryGroup } from "@/lib/country-stats";
import { PreviewCard } from "@/components/ui/PreviewCard";
import { cn } from "@/lib/utils";

/**
 * A thin bar that splits its width between finished (green) and in-progress
 * (amber) work, mirroring the world-map blend. Renders subtle grey when empty.
 */
export function CountryProgressBar({
  greenRatio,
  total,
  className,
}: {
  greenRatio: number;
  total: number;
  className?: string;
}) {
  const greenPct = Math.round(greenRatio * 100);
  return (
    <div
      className={cn(
        "flex h-1.5 w-full overflow-hidden rounded-full bg-paper-2",
        className,
      )}
      role="presentation"
    >
      {total > 0 ? (
        <>
          <span
            className="h-full bg-forest transition-[width] duration-500"
            style={{ width: `${greenPct}%` }}
          />
          <span
            className="h-full bg-gold transition-[width] duration-500"
            style={{ width: `${100 - greenPct}%` }}
          />
        </>
      ) : null}
    </div>
  );
}

function StatusGroup({
  label,
  icon: Icon,
  iconClass,
  projects,
}: {
  label: string;
  icon: typeof CheckCircle2;
  iconClass: string;
  projects: Project[];
}) {
  if (projects.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
        <Icon className={cn("size-3.5", iconClass)} />
        {label}
        <span className="text-ink-muted/70">· {projects.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <PreviewCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

/**
 * Renders a country's projects split into Finished and In progress subgroups.
 * Shared by the dashboard explorer and the catalog page.
 */
export function CountryStatusGroups({ group }: { group: CountryGroup }) {
  return (
    <div className="space-y-6">
      <StatusGroup
        label="Finished"
        icon={CheckCircle2}
        iconClass="text-forest"
        projects={group.finished}
      />
      <StatusGroup
        label="In progress"
        icon={Loader2}
        iconClass="text-gold"
        projects={group.inProgress}
      />
    </div>
  );
}
