"use client";

import { FileText } from "lucide-react";
import type { Project } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui";
import { PdfBuilderPanel } from "@/components/workspace/pdf/PdfBuilderPanel";

export function PdfTab({
  project,
  onOpenTrip,
  onOpenItinerary,
}: {
  project: Project;
  onOpenTrip: () => void;
  onOpenItinerary: (editionId?: string) => void;
}) {
  if (!project.productionPlan.outputs.includes("pdf")) {
    return (
      <EmptyState
        icon={FileText}
        title="PDF is not selected"
        description="Add PDF to the output package in the Trip tab when buyers should receive a designed, print-ready document."
        action={
          <Button variant="outline" onClick={onOpenTrip}>
            Edit output package
          </Button>
        }
      />
    );
  }

  return (
    <PdfBuilderPanel
      project={project}
      onNavigate={() =>
        onOpenItinerary(project.productionPlan.editions[0]?.id)
      }
    />
  );
}
