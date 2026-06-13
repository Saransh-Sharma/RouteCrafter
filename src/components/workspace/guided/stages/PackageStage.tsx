"use client";

import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Images,
  PackageCheck,
  Sparkles,
} from "lucide-react";
import type { Project } from "@/lib/types";
import type { WorkflowStageId } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ListingPanel } from "../../listing/ListingPanel";
import { ImagePromptsPanel } from "../../image-prompts/ImagePromptsPanel";
import { PdfBuilderPanel } from "../../pdf/PdfBuilderPanel";
import { ExportPanel } from "../../export/ExportPanel";
import { PromptStudioPanel } from "../../prompts/PromptStudioPanel";
import { StageHeader } from "./StageHeader";

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

  const chooseTool = (next: PackageTool) =>
    onNavigate("package", { tool: next });

  return (
    <div className="space-y-8">
      <StageHeader
        eyebrow="Stage 4 · Package"
        title="Make the itinerary easy to understand and buy"
        description="Build the sales story and selected delivery files around your completed editions. Only outputs chosen in Define become publish requirements."
      />

      <div className="grid gap-7 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Package tools" className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Package tools
          </p>
          <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {TOOLS.map((item) => {
              const Icon = item.icon;
              const selected = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseTool(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 border-b px-3 py-3 text-left text-sm font-medium transition-colors lg:w-full",
                    selected
                      ? "border-forest bg-sage-soft/65 text-forest"
                      : "border-border-soft text-ink-soft hover:bg-paper/60 hover:text-ink",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0">
          {active === "listing" || active === "packages" ? (
            <div className="space-y-4">
              {active === "packages" ? (
                <p className="border-y border-border-soft py-3 text-sm leading-6 text-ink-soft">
                  Service and hybrid offers need at least one priced package,
                  buyer requirements, personalization questions, and clear
                  delivery notes. These fields live in the shared listing editor
                  below.
                </p>
              ) : null}
            <ListingPanel project={project} showReadyAction={false} />
            </div>
          ) : active === "visuals" ? (
            project.productionPlan.outputs.includes("portfolio-visuals") ? (
              <ImagePromptsPanel project={project} />
            ) : (
              <OptionalTool
                title="Portfolio visuals are not selected"
                description="Add them to the output package in Define if this offer needs listing graphics or portfolio images."
                onEnable={() => onNavigate("define")}
              />
            )
          ) : active === "pdf" ? (
            project.productionPlan.outputs.includes("pdf") ? (
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
              <OptionalTool
                title="PDF is not selected"
                description="Add PDF to the output package when buyers should receive a designed, print-ready document."
                onEnable={() => onNavigate("define")}
              />
            )
          ) : active === "exports" ? (
            <ExportPanel project={project} />
          ) : (
            <PromptStudioPanel project={project} />
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => onNavigate("publish")}>
          Review for publishing
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function OptionalTool({
  title,
  description,
  onEnable,
}: {
  title: string;
  description: string;
  onEnable: () => void;
}) {
  return (
    <div className="grid min-h-72 place-items-center border border-dashed border-border-strong px-6 text-center">
      <div className="max-w-md">
        <h3 className="text-2xl font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
        <Button className="mt-5" variant="outline" onClick={onEnable}>
          Edit output package
        </Button>
      </div>
    </div>
  );
}
