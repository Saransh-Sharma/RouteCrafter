"use client";

import {
  FileSpreadsheet,
  FileText,
  Images,
  PackageCheck,
  Sparkles,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { getProjectWorkflow, type WorkflowStageId } from "@/lib/workflow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui";
import { ListingPanel } from "../../listing/ListingPanel";
import { ImagePromptsPanel } from "../../image-prompts/ImagePromptsPanel";
import { PdfBuilderPanel } from "../../pdf/PdfBuilderPanel";
import { ExportPanel } from "../../export/ExportPanel";
import { PromptStudioPanel } from "../../prompts/PromptStudioPanel";
import { StageShell, type SubNavStatus } from "../StageShell";

const TOOLS = [
  { id: "listing", label: "Marketplace listing", icon: PackageCheck },
  { id: "packages", label: "Packages and intake", icon: PackageCheck },
  { id: "visuals", label: "Portfolio visuals", icon: Images },
  { id: "pdf", label: "PDF presentation", icon: FileText },
  { id: "exports", label: "Files and spreadsheet", icon: FileSpreadsheet },
  { id: "prompts", label: "Production tools", icon: Sparkles },
] as const;

type PackageTool = (typeof TOOLS)[number]["id"];

export function PackageStage({
  project,
  tool,
  onNavigate,
}: {
  project: Project;
  tool: string | null;
  onNavigate: (
    stage: WorkflowStageId,
    params?: Record<string, string | undefined>,
  ) => void;
}) {
  const active = TOOLS.some((item) => item.id === tool)
    ? (tool as PackageTool)
    : "listing";
  const workflow = getProjectWorkflow(project);
  const stage = workflow.stages.find((item) => item.id === "package");
  const packageBlockers = workflow.blockers.filter(
    (issue) => issue.stage === "package",
  );
  const outputs = project.productionPlan.outputs;

  function toolStatus(id: PackageTool): SubNavStatus {
    switch (id) {
      case "listing":
      case "packages":
        return packageBlockers.some((b) => b.tool === "listing")
          ? "attention"
          : "complete";
      case "visuals":
        if (!outputs.includes("portfolio-visuals")) return "empty";
        return packageBlockers.some((b) => b.tool === "visuals")
          ? "attention"
          : "complete";
      case "pdf":
        return outputs.includes("pdf") ? "in-progress" : "empty";
      default:
        return "empty";
    }
  }

  const chooseTool = (next: string) => onNavigate("package", { tool: next });

  return (
    <StageShell
      eyebrow="Stage 4 · Package"
      title="Make the itinerary easy to understand and buy"
      description="Build the sales story and selected delivery files around your completed editions. Only outputs chosen in Define become publish requirements."
      progress={
        stage ? { completed: stage.completed, total: stage.total } : undefined
      }
      blockers={packageBlockers}
      onBlockerNavigate={(issue) =>
        onNavigate(issue.stage, { tool: issue.tool })
      }
      subNav={{
        ariaLabel: "Package tools",
        heading: "Package tools",
        activeId: active,
        onSelect: chooseTool,
        items: TOOLS.map((item) => ({
          id: item.id,
          label: item.label,
          icon: item.icon,
          status: toolStatus(item.id),
        })),
      }}
    >
      {active === "listing" || active === "packages" ? (
        <div className="space-y-4">
          {active === "packages" ? (
            <p className="border-y border-border-soft py-3 text-sm leading-6 text-ink-soft">
              Service and hybrid offers need at least one priced package, buyer
              requirements, personalization questions, and clear delivery notes.
              These fields live in the shared listing editor below.
            </p>
          ) : null}
          <ListingPanel project={project} showReadyAction={false} />
        </div>
      ) : active === "visuals" ? (
        outputs.includes("portfolio-visuals") ? (
          <ImagePromptsPanel project={project} />
        ) : (
          <EmptyState
            icon={Images}
            title="Portfolio visuals are not selected"
            description="Add them to the output package in Define if this offer needs listing graphics or portfolio images."
            action={
              <Button variant="outline" onClick={() => onNavigate("define")}>
                Edit output package
              </Button>
            }
          />
        )
      ) : active === "pdf" ? (
        outputs.includes("pdf") ? (
          <PdfBuilderPanel
            project={project}
            onNavigate={() =>
              onNavigate("build", {
                edition: project.productionPlan.editions[0]?.id,
                tool: "overview",
              })
            }
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="PDF is not selected"
            description="Add PDF to the output package when buyers should receive a designed, print-ready document."
            action={
              <Button variant="outline" onClick={() => onNavigate("define")}>
                Edit output package
              </Button>
            }
          />
        )
      ) : active === "exports" ? (
        <ExportPanel project={project} />
      ) : (
        <PromptStudioPanel project={project} />
      )}
    </StageShell>
  );
}
