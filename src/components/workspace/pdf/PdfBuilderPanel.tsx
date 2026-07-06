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
import {
  PDF_PRINT_PAYLOAD_KEY,
  createPdfPrintPayload,
  pdfFilename,
} from "./pdf-print-payload";
import {
  captureAsset,
  markAiRunApplied,
  recordAssetUsage,
} from "@/lib/assets/capture";
import { useAiSettingsStore } from "@/lib/store/ai-settings-store";
import { useAiConfig } from "@/components/ai/AiConfigProvider";
import { AiCostBadge } from "@/components/ai/AiCostButton";
import { resolveClientAiRun } from "@/lib/ai/runtime";
import { webSearchSupported } from "@/lib/ai/providers";
import { estimateAiRunCost } from "@/lib/ai/pricing";
import { requestDayDetails } from "@/lib/ai/day-details-client";
import {
  buildDayDetailsFormatPrompt,
  buildDayDetailsResearchPrompt,
} from "@/lib/ai/tasks";
import { createAiRunMetadata } from "@/lib/ai/metadata";
import { normalizeAiDayDetails } from "@/lib/ai/itinerary-normalization";
import { parseJsonObject } from "@/lib/ai/parse";
import type { AiAcceptedRun } from "@/lib/ai/types";

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
  const docRef = React.useRef<HTMLDivElement>(null);
  const patchItinerary = useProjectsStore((state) => state.patchItinerary);
  const update = useProjectsStore((state) => state.update);
  const textDefaults = useAiSettingsStore((state) => state.text);
  const getApiKey = useAiSettingsStore((state) => state.getApiKey);
  const { config } = useAiConfig();
  const [detailsRunning, setDetailsRunning] = React.useState(false);
  const [detailsConfirm, setDetailsConfirm] = React.useState(false);
  const [detailsProgress, setDetailsProgress] = React.useState({
    done: 0,
    total: 0,
  });
  const [detailsError, setDetailsError] = React.useState<string | null>(null);
  const [detailsNotice, setDetailsNotice] = React.useState<string | null>(null);
  const detailsAbortRef = React.useRef<AbortController | null>(null);

  // Abort any in-flight batch when the panel unmounts so paid calls stop.
  React.useEffect(
    () => () => detailsAbortRef.current?.abort(),
    [],
  );

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

  // Whole-batch estimate: (research + format) per day, with the web-search
  // surcharge on the research pass. Two paid calls per day.
  const detailsEstimate = React.useMemo(() => {
    const days = selected?.days.length ?? 0;
    if (!selected || !days) return null;
    const research = estimateAiRunCost({
      mode: "text",
      provider: aiSelection.provider,
      model: aiSelection.model,
      prompt: buildDayDetailsResearchPrompt({
        project,
        itinerary: selected,
        day: selected.days[0],
      }),
      taskType: "dayDetails",
      maxOutputTokens: textDefaults.maxOutputTokens,
      enableWebSearch: true,
    });
    const format = estimateAiRunCost({
      mode: "text",
      provider: aiSelection.provider,
      model: aiSelection.model,
      prompt: buildDayDetailsFormatPrompt(""),
      taskType: "dayDetails",
      maxOutputTokens: textDefaults.maxOutputTokens,
    });
    if (!research || !format) return null;
    return {
      currency: "USD" as const,
      lowUsd: (research.lowUsd + format.lowUsd) * days,
      highUsd: (research.highUsd + format.highUsd) * days,
      basis: `${days} day${days === 1 ? "" : "s"} × 2 grounded calls`,
    };
  }, [
    selected,
    aiSelection.provider,
    aiSelection.model,
    project,
    textDefaults.maxOutputTokens,
  ]);

  // Stop the batch (and surface a neutral notice) if the user switches edition
  // mid-run.
  React.useEffect(() => {
    detailsAbortRef.current?.abort();
  }, [selectedId]);
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
    if (!selected) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const filename = pdfFilename(project, selected.id);
      const response = await fetch("/api/pdf/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, itineraryId: selected.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "Could not generate the PDF.",
        );
      }
      const pdfBlob = await response.blob();
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
      const message =
        error instanceof Error ? error.message : "Could not generate the PDF.";
      setDownloadError(
        `${message} Use Print / Save as PDF as a fallback.`,
      );
    } finally {
      setDownloading(false);
    }
  }

  function openPrintPdf() {
    if (!selected) return;
    try {
      window.localStorage.setItem(
        PDF_PRINT_PAYLOAD_KEY,
        JSON.stringify(createPdfPrintPayload(project, selected.id)),
      );
      window.open("/pdf/print?autoprint=1", "_blank", "noopener,noreferrer");
    } catch {
      setDownloadError(
        "Could not prepare the print preview. Remove a large uploaded image and try again.",
      );
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
    setDetailsConfirm(false);
    setDetailsRunning(true);
    setDetailsError(null);
    setDetailsNotice(null);
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
    detailsAbortRef.current = controller;
    const runs: AiAcceptedRun[] = [];
    let completed = 0;
    let ungrounded = 0;
    try {
      for (let i = 0; i < days.length; i += 1) {
        if (controller.signal.aborted) break;
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
        if (result.grounded === false) ungrounded += 1;
        runs.push(
          createAiRunMetadata({
            result,
            taskType: "dayDetails",
            label: `Local details day ${day.day}`,
            source: "pdf-builder",
          }),
        );
        void markAiRunApplied({
          aiRunId: result.aiRunId,
          aiRunIds: result.aiRunIds,
          projectId: project.id,
        });
        completed += 1;
        setDetailsProgress({ done: completed, total: days.length });
      }
      const ungroundedNote =
        ungrounded > 0
          ? ` ${ungrounded} had no web sources — review before selling.`
          : "";
      setDetailsNotice(
        controller.signal.aborted
          ? `Stopped — ${completed}/${days.length} days done.${ungroundedNote}`
          : `Added local details to ${completed} day${
              completed === 1 ? "" : "s"
            }.${ungroundedNote}`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setDetailsNotice(`Stopped — ${completed}/${days.length} days done.`);
      } else {
        setDetailsError(
          error instanceof Error
            ? error.message
            : "Could not generate local details.",
        );
      }
    } finally {
      // Append all accepted runs in one update so loop iterations don't clobber
      // each other (appendAiRun reads a single project snapshot).
      if (runs.length) {
        update(project.id, {
          aiRuns: [...(project.aiRuns ?? []), ...runs],
        });
      }
      if (detailsAbortRef.current === controller) detailsAbortRef.current = null;
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
          {detailsRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => detailsAbortRef.current?.abort()}
            >
              <MapPin className="size-4" />
              Cancel ({detailsProgress.done}/{detailsProgress.total})
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsNotice(null);
                setDetailsError(null);
                setDetailsConfirm((open) => !open);
              }}
              disabled={!canAddDetails || downloading}
              title={
                canAddDetails
                  ? "Generate web-search-grounded recommendations for every day"
                  : "Needs server OpenAI or a personal OpenAI key for web search"
              }
            >
              <MapPin className="size-4" />
              Add local details
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={openPrintPdf}
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
      {detailsConfirm && !detailsRunning ? (
        <div className="rc-no-print flex flex-col gap-3 rounded-2xl border border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)]/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-ink-soft">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--rc-ai-brown)]" />
            <p>
              Research real, web-cited recommendations for all{" "}
              <span className="font-semibold text-ink">
                {selected.days.length}
              </span>{" "}
              days. This makes{" "}
              <span className="font-semibold text-ink">
                {selected.days.length * 2}
              </span>{" "}
              paid AI calls (research + format per day) and uses web search.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AiCostBadge estimate={detailsEstimate} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDetailsConfirm(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={addLocalDetails}>
              Confirm &amp; run
            </Button>
          </div>
        </div>
      ) : null}
      {detailsError ? (
        <p className="rc-no-print text-sm text-terracotta">{detailsError}</p>
      ) : detailsRunning ? (
        <p className="rc-no-print text-sm text-ink-muted">
          Researching real, cited recommendations for each day —{" "}
          {detailsProgress.done}/{detailsProgress.total} done. This uses web
          search and may take a moment per day.
        </p>
      ) : detailsNotice ? (
        <p className="rc-no-print text-sm text-ink-muted">{detailsNotice}</p>
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
            editable={editing}
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
