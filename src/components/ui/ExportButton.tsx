"use client";

import * as React from "react";
import { Download, FileText, FileSpreadsheet, FileJson } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";
import { downloadProjectJson } from "@/lib/io/project-io";
import {
  buildMarkdownBundle,
  downloadText,
  hasAnyContent,
  projectSlug,
} from "@/components/workspace/export/export-bundle";

/**
 * Export menu. JSON export is live (Phase 2); PDF/Markdown/CSV are enabled in
 * their respective later phases.
 */
export function ExportButton({
  className,
  project,
}: {
  className?: string;
  project?: Project;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const hasContent = project ? hasAnyContent(project) : false;

  const options = [
    {
      id: "markdown",
      label: "Export Markdown",
      icon: FileText,
      phase: hasContent ? "Ready" : "Empty",
      enabled: Boolean(project) && hasContent,
    },
    {
      id: "json",
      label: "Export JSON",
      icon: FileJson,
      phase: "Ready",
      enabled: Boolean(project),
    },
    {
      id: "more",
      label: "More in Export tab",
      icon: FileSpreadsheet,
      phase: "PDF / CSV",
      enabled: false,
    },
  ] as const;

  function handle(id: string) {
    if (!project) return;
    if (id === "json") {
      downloadProjectJson(project);
      setOpen(false);
    } else if (id === "markdown") {
      downloadText(
        `${projectSlug(project)}-bundle.md`,
        buildMarkdownBundle(project),
        "text/markdown",
      );
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="size-4" />
        Export
      </Button>
      {open ? (
        <div
          role="menu"
          className="rc-card absolute right-0 z-20 mt-2 w-56 overflow-hidden p-1.5"
        >
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                role="menuitem"
                disabled={!opt.enabled}
                onClick={() => handle(opt.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                  opt.enabled
                    ? "text-ink hover:bg-paper-2/70"
                    : "text-ink-soft opacity-70",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="size-4" />
                  {opt.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wide",
                    opt.enabled ? "text-forest" : "text-ink-muted",
                  )}
                >
                  {opt.phase}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
