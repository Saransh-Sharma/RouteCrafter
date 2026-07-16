"use client";

import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Megaphone,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { editionLabel, itineraryForEdition } from "@/lib/editions";
import { downloadProjectJson } from "@/lib/io/project-io";
import {
  buildMarkdownBundle,
  downloadText,
  hasAnyContent,
  itineraryToCsv,
  projectSlug,
} from "@/components/workspace/export/export-bundle";
import { downloadListingMarkdown } from "@/components/workspace/listing/export-listing";
import { useToast } from "@/components/ui";
import { Popover, usePopoverClose } from "@/components/ui/overlay/Popover";
import { cn } from "@/lib/utils";
import type { EditorTab } from "./tabs";

/**
 * Everything leaves the studio from here: PDF (designed in the PDF tab),
 * spreadsheet CSV per edition, listing copy, the full Markdown bundle, and
 * portable JSON. Never blocked by readiness.
 */
export function ExportMenu({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (tab: EditorTab) => void;
}) {
  return (
    <Popover
      align="end"
      className="w-72 p-2"
      trigger={(props) => (
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-full bg-forest px-4 text-caption font-semibold text-paper shadow-[var(--shadow-soft)] transition-colors hover:bg-forest-deep"
          {...props}
        >
          <Download className="size-4" aria-hidden />
          Export
        </button>
      )}
    >
      <ExportMenuItems project={project} onNavigate={onNavigate} />
    </Popover>
  );
}

function ExportMenuItems({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (tab: EditorTab) => void;
}) {
  const close = usePopoverClose();
  const { toast } = useToast();
  const slug = projectSlug(project);
  const editionsWithItineraries = project.productionPlan.editions.filter(
    (edition) => itineraryForEdition(project, edition),
  );
  const hasContent = hasAnyContent(project);

  function item(action: () => void, message?: string) {
    return () => {
      close();
      action();
      if (message) toast(message);
    };
  }

  const rows: {
    label: string;
    hint?: string;
    icon: typeof FileText;
    onSelect: () => void;
    disabled?: boolean;
  }[] = [
    {
      label: "PDF — design & download",
      hint: "PDF tab",
      icon: FileText,
      onSelect: item(() => onNavigate("pdf")),
      disabled: !project.productionPlan.outputs.includes("pdf"),
    },
    ...editionsWithItineraries.map((edition) => {
      const itinerary = itineraryForEdition(project, edition)!;
      return {
        label: `Spreadsheet CSV — ${editionLabel(edition)}`,
        icon: FileSpreadsheet,
        onSelect: item(
          () =>
            downloadText(
              `${slug}-${editionLabel(edition).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`,
              itineraryToCsv(itinerary),
              "text/csv",
            ),
          "CSV downloaded",
        ),
      };
    }),
    {
      label: "Listing copy (Markdown)",
      icon: Megaphone,
      onSelect: item(() => {
        if (project.listing) downloadListingMarkdown(project.listing, project);
      }, "Listing copy downloaded"),
      disabled: !project.listing,
    },
    {
      label: "Full Markdown bundle",
      icon: FileText,
      onSelect: item(
        () =>
          downloadText(
            `${slug}-bundle.md`,
            buildMarkdownBundle(project),
            "text/markdown",
          ),
        "Markdown bundle downloaded",
      ),
      disabled: !hasContent,
    },
    {
      label: "Portable JSON backup",
      icon: FileJson,
      onSelect: item(() => downloadProjectJson(project), "JSON downloaded"),
    },
  ];

  return (
    <div role="menu" className="flex flex-col">
      {rows.map((row, index) => {
        const Icon = row.icon;
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            disabled={row.disabled}
            onClick={row.onSelect}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-left text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage",
              row.disabled
                ? "pointer-events-none text-ink-muted opacity-60"
                : "text-ink-soft hover:bg-paper-2 hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {row.hint ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-forest">
                {row.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
