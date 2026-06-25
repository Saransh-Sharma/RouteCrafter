"use client";

import * as React from "react";
import {
  Printer,
  Download,
  FileType,
  ArrowRight,
  Check,
  Pencil,
  MapPin,
} from "lucide-react";
import type { ItineraryOutput, Project } from "@/lib/types";
import type { AiTextRequest } from "@/lib/ai/types";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/field";
import { ItineraryDocument } from "./ItineraryDocument";
import { PdfTextControls } from "./PdfTextControls";
import { PdfThemeControls } from "./PdfThemeControls";
import { prepareDocumentForPdf } from "./pdf-assets";
import { captureAsset, recordAssetUsage } from "@/lib/assets/capture";
import { useAiSettingsStore } from "@/lib/store/ai-settings-store";
import { useAiConfig } from "@/components/ai/AiConfigProvider";
import { resolveClientAiRun } from "@/lib/ai/runtime";
import { webSearchSupported } from "@/lib/ai/providers";
import { requestDayDetails } from "@/lib/ai/day-details-client";
import { normalizeAiDayDetails } from "@/lib/ai/itinerary-normalization";
import { parseJsonObject } from "@/lib/ai/parse";

function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

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
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [capturing, setCapturing] = React.useState(false);
  const docRef = React.useRef<HTMLDivElement>(null);
  const patchItinerary = useProjectsStore((state) => state.patchItinerary);
  const textDefaults = useAiSettingsStore((state) => state.text);
  const getApiKey = useAiSettingsStore((state) => state.getApiKey);
  const { config } = useAiConfig();
  const [detailsRunning, setDetailsRunning] = React.useState(false);
  const [detailsProgress, setDetailsProgress] = React.useState({
    done: 0,
    total: 0,
  });
  const [detailsError, setDetailsError] = React.useState<string | null>(null);

  const aiSelection = resolveClientAiRun({
    mode: "text",
    defaults: textDefaults,
    personalKey: getApiKey(textDefaults.provider),
    serverConfig: config,
  });
  const canAddDetails =
    aiSelection.available && webSearchSupported(aiSelection.provider);

  const selected =
    itineraries.find((it) => it.id === selectedId) ?? itineraries[0] ?? null;
  const selectedDocId = selected?.id ?? "";
  const docEditor = React.useMemo(
    () => ({
      patch: (updater: (it: ItineraryOutput) => ItineraryOutput) => {
        if (selectedDocId) patchItinerary(project.id, selectedDocId, updater);
      },
    }),
    [patchItinerary, project.id, selectedDocId],
  );
  const assetKey = selected
    ? [selected.coverImage, ...selected.days.map((day) => day.image)].join("|")
    : "";
  const expectedAssets = selected
    ? Number(Boolean(selected.coverImage)) +
      selected.days.filter((day) => Boolean(day.image)).length
    : 0;
  const [assetState, setAssetState] = React.useState({
    key: assetKey,
    settled: 0,
  });
  if (assetState.key !== assetKey) {
    setAssetState({ key: assetKey, settled: 0 });
  }
  const assetsReady =
    expectedAssets === 0 || assetState.settled >= expectedAssets;

  async function downloadPdf() {
    if (!docRef.current || !selected) return;
    setDownloading(true);
    setDownloadError(null);
    // Render the clean (non-edit) document for capture so no edit chrome leaks
    // into the PDF.
    setCapturing(true);
    await nextFrame();
    try {
      const documentElement = docRef.current;
      if (!documentElement) return;
      await prepareDocumentForPdf(documentElement);
      const exportBounds = documentElement.getBoundingClientRect();
      const exportWidth = Math.ceil(
        Math.max(documentElement.scrollWidth, exportBounds.width),
      );
      const html2pdf = (await import("html2pdf.js")).default;
      const slug = (project.country || "project").toLowerCase();
      const filename = `${slug}-${selected.duration.replace(/\s+/g, "")}-itinerary.pdf`;
      const pdfBlob = await html2pdf()
        .set({
          margin: 0,
          filename,
          image: { type: "jpeg", quality: 0.96 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            windowWidth: exportWidth,
            ignoreElements: (element: Element) =>
              element.classList?.contains("rc-edit-only"),
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: {
            mode: ["css", "legacy"],
            before: ".rc-print-page:not(:first-child):not(.rc-doc-overview-page)",
            avoid: [".rc-doc-section", ".rc-day-row", ".rc-doc-block"],
          },
        })
        .from(documentElement)
        .output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      try {
        const asset = await captureAsset({
          projectId: project.id,
          assetType: "pdf",
          source: "pdf-export",
          file: pdfBlob,
          filename,
          usageType: "export",
          entityId: selected.id,
          fieldPath: "exports.pdf",
          editionLabel: selected.duration,
        });
        await recordAssetUsage({
          assetId: asset.id,
          usageType: "export",
          entityId: selected.id,
          fieldPath: "exports.pdf",
        }).catch(() => undefined);
      } catch {
        setDownloadError(
          "Downloaded PDF, but RouteCrafter could not save a cloud library copy.",
        );
      }
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Could not generate the PDF.",
      );
    } finally {
      setDownloading(false);
      setCapturing(false);
    }
  }

  async function addLocalDetails() {
    if (!selected || detailsRunning) return;
    if (!canAddDetails) {
      setDetailsError(
        "Local details need web search. Use the server OpenAI option or add a personal OpenAI key in Settings.",
      );
      return;
    }
    setDetailsRunning(true);
    setDetailsError(null);
    const days = selected.days;
    setDetailsProgress({ done: 0, total: days.length });
    const baseRequest: AiTextRequest = {
      provider: aiSelection.provider,
      apiKey: getApiKey(textDefaults.provider) || undefined,
      model: aiSelection.model,
      // Overridden per pass by the orchestrator; never sent verbatim.
      prompt: "Local details",
      taskType: "dayDetails",
      projectId: project.id,
      label: "Local details",
      source: "pdf-builder",
      temperature: textDefaults.temperature,
      topP: textDefaults.topP,
      maxOutputTokens: textDefaults.maxOutputTokens,
    };
    const controller = new AbortController();
    try {
      for (let i = 0; i < days.length; i += 1) {
        const day = days[i];
        const result = await requestDayDetails({
          request: baseRequest,
          signal: controller.signal,
          project,
          itinerary: selected,
          day,
        });
        const details = normalizeAiDayDetails(
          parseJsonObject(result.text ?? "{}"),
          day.base,
        );
        patchItinerary(project.id, selected.id, (it) => ({
          ...it,
          days: it.days.map((d) =>
            d.day === day.day ? { ...d, details } : d,
          ),
        }));
        setDetailsProgress({ done: i + 1, total: days.length });
      }
    } catch (error) {
      setDetailsError(
        error instanceof Error
          ? error.message
          : "Could not generate local details.",
      );
    } finally {
      setDetailsRunning(false);
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
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            variant={editing ? "primary" : "outline"}
            size="sm"
            onClick={() => setEditing((value) => !value)}
            disabled={downloading}
          >
            {editing ? (
              <>
                <Check className="size-4" />
                Done editing
              </>
            ) : (
              <>
                <Pencil className="size-4" />
                Edit
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={addLocalDetails}
            disabled={!canAddDetails || detailsRunning || downloading}
            title={
              canAddDetails
                ? "Generate web-search-grounded recommendations for every day"
                : "Needs server OpenAI or a personal OpenAI key for web search"
            }
          >
            <MapPin className="size-4" />
            {detailsRunning
              ? `Adding details ${detailsProgress.done}/${detailsProgress.total}...`
              : "Add local details"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={!assetsReady || downloading}
          >
            <Printer className="size-4" />
            Print / Save as PDF
          </Button>
          <Button
            size="sm"
            onClick={downloadPdf}
            disabled={!assetsReady || downloading}
          >
            <Download className="size-4" />
            {downloading ? "Preparing..." : "Download PDF"}
          </Button>
        </div>
      </div>
      {detailsError ? (
        <p className="rc-no-print text-sm text-terracotta">{detailsError}</p>
      ) : detailsRunning ? (
        <p className="rc-no-print text-sm text-ink-muted">
          Researching real, cited recommendations for each day —{" "}
          {detailsProgress.done}/{detailsProgress.total} done. This uses web
          search and may take a moment per day.
        </p>
      ) : null}
      {downloadError ? (
        <p className="rc-no-print text-sm text-terracotta">{downloadError}</p>
      ) : !assetsReady ? (
        <p className="rc-no-print text-sm text-ink-muted">
          Waiting for document images to load...
        </p>
      ) : editing ? (
        <p className="rc-no-print text-sm text-ink-muted">
          Click any text to edit it. Use the controls on each element to remove
          it, and the <span className="font-medium">+ Text / Image / Divider</span>{" "}
          bars to add new blocks. Removed elements can be restored.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <div
          role="region"
          aria-label="PDF presentation controls"
          className="rc-no-print space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.5rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-2"
        >
          <PdfTextControls project={project} itinerary={selected} />
          <PdfThemeControls project={project} itinerary={selected} />
        </div>
        <div
          role="region"
          aria-label="PDF preview"
          className="min-w-0 overflow-auto rounded-[var(--radius-card)] border border-border-soft bg-paper-2/30 p-4 sm:p-6 lg:max-h-[calc(100dvh-6.5rem)] lg:overscroll-contain"
        >
          <ItineraryDocument
            ref={docRef}
            itinerary={selected}
            project={project}
            editable={editing && !capturing}
            exportMode={capturing}
            editor={docEditor}
            onAssetSettled={() =>
              setAssetState((current) =>
                current.key === assetKey
                  ? {
                      ...current,
                      settled: Math.min(
                        expectedAssets,
                        current.settled + 1,
                      ),
                    }
                  : { key: assetKey, settled: 1 },
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
