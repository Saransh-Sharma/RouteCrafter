"use client";

import * as React from "react";
import { Download, FileText, FileSpreadsheet, FileJson, FileType } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

const options = [
  { id: "pdf", label: "Export PDF", icon: FileType, phase: "Phase 9" },
  { id: "markdown", label: "Export Markdown", icon: FileText, phase: "Phase 9" },
  { id: "csv", label: "Export CSV", icon: FileSpreadsheet, phase: "Phase 10" },
  { id: "json", label: "Export JSON", icon: FileJson, phase: "Phase 2" },
] as const;

/**
 * Export menu. Visual stub for Phase 1 — wiring lands with the export phases.
 */
export function ExportButton({ className }: { className?: string }) {
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
                disabled
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm text-ink-soft opacity-70"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="size-4" />
                  {opt.label}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-ink-muted">
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
