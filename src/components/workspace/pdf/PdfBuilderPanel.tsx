"use client";

import * as React from "react";
import { Printer, Download, FileType, ArrowRight } from "lucide-react";
import type { Project } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/field";
import { ItineraryDocument } from "./ItineraryDocument";
import { PdfThemeControls } from "./PdfThemeControls";

export function PdfBuilderPanel({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (moduleId: string) => void;
}) {
  const itineraries = project.itineraries;
  const [selectedId, setSelectedId] = React.useState(
    itineraries[0]?.id ?? "",
  );
  const [downloading, setDownloading] = React.useState(false);
  const docRef = React.useRef<HTMLDivElement>(null);

  const selected =
    itineraries.find((it) => it.id === selectedId) ?? itineraries[0] ?? null;

  async function downloadPdf() {
    if (!docRef.current || !selected) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const slug = (project.country || "project").toLowerCase();
      await html2pdf()
        .set({
          margin: 10,
          filename: `${slug}-${selected.duration.replace(/\s+/g, "")}-itinerary.pdf`,
          image: { type: "jpeg", quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(docRef.current)
        .save();
    } finally {
      setDownloading(false);
    }
  }

  if (!selected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-gold-soft text-brown">
            <FileType className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-base font-semibold text-ink">
              No itinerary to print yet
            </p>
            <p className="mx-auto max-w-sm text-sm text-ink-soft">
              Build a day-by-day itinerary first, then come back to generate a
              premium print-ready PDF.
            </p>
          </div>
          <Button onClick={() => onNavigate("expanded")}>
            Go to Expanded Itinerary
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rc-no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-ink">PDF builder</h3>
          {itineraries.length > 1 ? (
            <Select
              value={selected.id}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-auto"
            >
              {itineraries.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.duration} - {it.travelerType}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print / Save as PDF
          </Button>
          <Button size="sm" onClick={downloadPdf} disabled={downloading}>
            <Download className="size-4" />
            {downloading ? "Preparing..." : "Download PDF"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="rc-no-print lg:sticky lg:top-6 lg:self-start">
          <PdfThemeControls project={project} itinerary={selected} />
        </div>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border-soft bg-paper-2/30 p-4 sm:p-6">
          <ItineraryDocument
            ref={docRef}
            itinerary={selected}
            project={project}
          />
        </div>
      </div>
    </div>
  );
}
