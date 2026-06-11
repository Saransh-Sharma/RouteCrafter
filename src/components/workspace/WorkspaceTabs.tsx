"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import type { Project, WorkspaceModule } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { OverviewPanel } from "./OverviewPanel";
import { TripConfigForm } from "./trip-config/TripConfigForm";
import { PromptStudioPanel } from "./prompts/PromptStudioPanel";
import { ImagePromptsPanel } from "./image-prompts/ImagePromptsPanel";
import { MatrixPanel } from "./matrix/MatrixPanel";
import { ExpandedItineraryPanel } from "./itinerary/ExpandedItineraryPanel";
import { ListingPanel } from "./listing/ListingPanel";
import { PdfBuilderPanel } from "./pdf/PdfBuilderPanel";
import { ExportPanel } from "./export/ExportPanel";

/** Module ids that have a real, implemented panel (no "locked" badge). */
const IMPLEMENTED = new Set([
  "overview",
  "trip-config",
  "prompts",
  "image-prompts",
  "matrix",
  "expanded",
  "listing",
  "pdf",
  "export",
]);

export function WorkspaceTabs({
  project,
  modules,
}: {
  project: Project;
  modules: WorkspaceModule[];
}) {
  const [active, setActive] = React.useState(modules[0]?.id ?? "overview");
  const current = modules.find((m) => m.id === active) ?? modules[0];

  return (
    <div className="space-y-6">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {modules.map((m) => {
          const isActive = m.id === active;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(m.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-forest text-paper shadow-[var(--shadow-soft)]"
                  : "border border-border-soft bg-paper/60 text-ink-soft hover:border-forest/30 hover:text-ink",
              )}
            >
              {m.label}
              {!IMPLEMENTED.has(m.id) ? (
                <Lock
                  className={cn(
                    "size-3",
                    isActive ? "text-paper/70" : "text-ink-muted",
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {renderPanel(current, project, setActive)}
    </div>
  );
}

function renderPanel(
  current: WorkspaceModule | undefined,
  project: Project,
  onNavigate: (moduleId: string) => void,
) {
  if (!current) return null;
  switch (current.id) {
    case "overview":
      return <OverviewPanel project={project} />;
    case "trip-config":
      return <TripConfigForm project={project} />;
    case "prompts":
      return <PromptStudioPanel project={project} />;
    case "image-prompts":
      return <ImagePromptsPanel project={project} />;
    case "matrix":
      return <MatrixPanel project={project} onNavigate={onNavigate} />;
    case "expanded":
      return <ExpandedItineraryPanel project={project} />;
    case "listing":
      return <ListingPanel project={project} />;
    case "pdf":
      return <PdfBuilderPanel project={project} onNavigate={onNavigate} />;
    case "export":
      return <ExportPanel project={project} />;
    default:
      return <ModulePlaceholder module={current} />;
  }
}

function ModulePlaceholder({ module }: { module: WorkspaceModule }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-paper-2 text-ink-muted">
          <Lock className="size-6" />
        </span>
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-xl font-semibold text-ink">{module.label}</h3>
            <Badge tone="gold">Phase {module.phase}</Badge>
          </div>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-soft">
            {module.description}
          </p>
        </div>
        <p className="max-w-sm text-xs text-ink-muted">
          This module is part of the RouteCrafter roadmap and will light up in a
          later build phase. The shell, navigation, and data flow are ready for
          it now.
        </p>
      </CardContent>
    </Card>
  );
}
