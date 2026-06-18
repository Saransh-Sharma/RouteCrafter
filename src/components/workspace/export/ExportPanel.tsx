"use client";

import * as React from "react";
import {
  FileJson,
  FileText,
  FileSpreadsheet,
  Package,
  Images,
  Megaphone,
  Grid3x3,
  Map,
  Sparkles,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useToast } from "@/components/ui";
import { downloadProjectJson } from "@/lib/io/project-io";
import {
  downloadMatrixCsv,
  downloadMatrixMarkdown,
} from "../matrix/export-matrix";
import { downloadItineraryMarkdown } from "../itinerary/export-itinerary";
import { downloadListingMarkdown } from "../listing/export-listing";
import { downloadImagePromptsMarkdown } from "../image-prompts/export-image-prompts";
import {
  buildAiUsageAppendix,
  buildMarkdownBundle,
  hasAnyContent,
  itineraryToCsv,
  downloadText,
  promptsToMarkdown,
  projectSlug,
} from "./export-bundle";

export function ExportPanel({ project }: { project: Project }) {
  const slug = projectSlug(project);
  const { toast } = useToast();
  const [includeAiUsage, setIncludeAiUsage] = React.useState(false);

  function exportBundle() {
    downloadText(
      `${slug}-bundle.md`,
      buildMarkdownBundle(project, { includeAiUsage }),
      "text/markdown",
    );
    toast("Markdown bundle downloaded");
  }

  function exportPrompts() {
    downloadText(`${slug}-prompts.md`, promptsToMarkdown(project), "text/markdown");
    toast("Prompts exported");
  }

  const promptCount = Object.keys(project.generated ?? {}).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Export"
        title="Export your work"
        subtitle="Download individual artifacts or the full project. Cloud storage remains the source of truth; exports are portable backups and delivery files."
      />

      {/* Export everything */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-forest text-paper">
              <Package className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-ink">
                Full project export
              </p>
              <p className="text-sm text-ink-soft">
                JSON re-imports anywhere; the Markdown bundle gathers every
                artifact into one document.
              </p>
              {(project.aiRuns ?? []).length ? (
                <label className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={includeAiUsage}
                    onChange={(event) =>
                      setIncludeAiUsage(event.target.checked)
                    }
                  />
                  Include AI usage appendix (no API keys or prompt payloads)
                </label>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadProjectJson(project)}
            >
              <FileJson className="size-4" />
              JSON
            </Button>
            <Button size="sm" onClick={exportBundle} disabled={!hasAnyContent(project)}>
              <FileText className="size-4" />
              Markdown bundle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Itinerary matrix */}
      <ArtifactRow
        icon={Grid3x3}
        title="Itinerary matrix"
        available={Boolean(project.matrix)}
        emptyHint="Generate it in the Itinerary Matrix tab."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => project.matrix && downloadMatrixCsv(project.matrix, project)}
        >
          <FileSpreadsheet className="size-4" />
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            project.matrix && downloadMatrixMarkdown(project.matrix, project)
          }
        >
          <FileText className="size-4" />
          Markdown
        </Button>
      </ArtifactRow>

      {/* Itineraries */}
      <ArtifactRow
        icon={Map}
        title="Itineraries"
        available={project.itineraries.length > 0}
        badge={project.itineraries.length || undefined}
        emptyHint="Build one in the Expanded Itinerary tab."
      >
        <div className="flex flex-col gap-2">
          {project.itineraries.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <span className="mr-1 text-xs text-ink-soft">
                {it.duration} - {it.travelerType}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadItineraryMarkdown(it, project)}
              >
                <FileText className="size-4" />
                MD
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadText(
                    `${slug}-${it.duration.replace(/\s+/g, "")}-itinerary.csv`,
                    itineraryToCsv(it),
                    "text/csv",
                  )
                }
              >
                <FileSpreadsheet className="size-4" />
                CSV
              </Button>
            </div>
          ))}
        </div>
      </ArtifactRow>

      {/* Listing */}
      <ArtifactRow
        icon={Megaphone}
        title="Listing copy"
        available={Boolean(project.listing)}
        emptyHint="Generate it in the Listing Copy tab."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            project.listing && downloadListingMarkdown(project.listing, project)
          }
        >
          <FileText className="size-4" />
          Markdown
        </Button>
      </ArtifactRow>

      {/* Image prompts */}
      <ArtifactRow
        icon={Images}
        title="Portfolio image prompts"
        available={project.imagePrompts.length > 0}
        badge={project.imagePrompts.length || undefined}
        emptyHint="Generate them in the Image Prompts tab."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadImagePromptsMarkdown(project)}
        >
          <FileText className="size-4" />
          Markdown
        </Button>
      </ArtifactRow>

      {/* Prompts */}
      <ArtifactRow
        icon={Sparkles}
        title="AI usage appendix"
        available={(project.aiRuns ?? []).length > 0}
        badge={(project.aiRuns ?? []).length || undefined}
        emptyHint="Accepted AI outputs will appear here."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadText(
              `${slug}-ai-usage.md`,
              buildAiUsageAppendix(project),
              "text/markdown",
            )
          }
        >
          <FileText className="size-4" />
          Markdown
        </Button>
      </ArtifactRow>

      {/* Prompts */}
      <ArtifactRow
        icon={Sparkles}
        title="Generated prompts"
        available={promptCount > 0}
        badge={promptCount || undefined}
        emptyHint="Generate them in the Prompt Studio tab."
      >
        <Button variant="outline" size="sm" onClick={exportPrompts}>
          <FileText className="size-4" />
          Markdown
        </Button>
      </ArtifactRow>
    </div>
  );
}

function ArtifactRow({
  icon: Icon,
  title,
  available,
  badge,
  emptyHint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  available: boolean;
  badge?: number;
  emptyHint: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-paper-2 text-ink-soft">
            <Icon className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-ink">{title}</p>
              {badge ? <Badge tone="sage">{badge}</Badge> : null}
            </div>
            {!available ? (
              <p className="text-xs text-ink-muted">{emptyHint}</p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">
          {available ? (
            <div className="flex items-center gap-2">{children}</div>
          ) : (
            <Badge tone="neutral">Not generated yet</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
