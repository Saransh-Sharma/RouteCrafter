"use client";

import * as React from "react";
import { ChevronDown, ImageIcon, Palette, Trash2, Upload } from "lucide-react";
import type { ItineraryOutput, PdfTheme, Project } from "@/lib/types";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/field";
import { AiCostButton } from "@/components/ai/AiCostButton";
import { AiRunSheet } from "@/components/ai/AiRunSheet";
import { buildImageGenerationPrompt } from "@/lib/ai/tasks";
import { appendAiRun, createAiRunMetadata } from "@/lib/ai/metadata";
import { cn } from "@/lib/utils";
import { compressImageFile } from "./image-utils";
import { DOC_THEMES } from "./themes";

export function PdfThemeControls({
  project,
  itinerary,
}: {
  project: Project;
  itinerary: ItineraryOutput;
}) {
  const patchItinerary = useProjectsStore((state) => state.patchItinerary);
  const [error, setError] = React.useState<string | null>(null);
  const [daysOpen, setDaysOpen] = React.useState(false);
  const [aiImageTarget, setAiImageTarget] = React.useState<
    | { kind: "cover"; title: string; prompt: string }
    | { kind: "day"; title: string; index: number; prompt: string }
    | null
  >(null);

  function applyPatch(
    patch:
      | Partial<ItineraryOutput>
      | ((current: ItineraryOutput) => ItineraryOutput),
  ): boolean {
    const result = patchItinerary(project.id, itinerary.id, patch);
    setError(result.ok ? null : result.error);
    return result.ok;
  }

  function patchDay(index: number, image: string) {
    applyPatch((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) =>
        dayIndex === index ? { ...day, image } : day,
      ),
    }));
  }

  function recordImageRun(
    image: string,
    result: Parameters<typeof createAiRunMetadata>[0]["result"],
  ) {
    if (!aiImageTarget) return;
    if (aiImageTarget.kind === "cover") {
      applyPatch({ coverImage: image });
    } else {
      patchDay(aiImageTarget.index, image);
    }
    const mutation = useProjectsStore.getState().update(project.id, {
      aiRuns: appendAiRun(
        project,
        createAiRunMetadata({
          result,
          taskType: "imageGeneration",
          label: aiImageTarget.title,
          source: "pdf-builder",
        }),
      ),
    });
    if (!mutation.ok) setError(mutation.error);
  }

  async function handleUpload(
    file: File | undefined,
    apply: (dataUrl: string) => void,
  ) {
    if (!file) return;
    setError(null);
    try {
      apply(await compressImageFile(file));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not process the image.",
      );
    }
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Palette className="size-4 text-terracotta" />
            Color theme
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DOC_THEMES.map((theme) => {
              const active = (itinerary.pdfTheme ?? "beige") === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() =>
                    applyPatch({ pdfTheme: theme.id as PdfTheme })
                  }
                  aria-label={theme.label}
                  title={theme.label}
                  className={cn(
                    "group flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors",
                    active
                      ? "border-forest ring-2 ring-sage/50"
                      : "border-border-strong hover:border-forest/40",
                  )}
                >
                  <span
                    className="flex h-8 w-full overflow-hidden rounded-md"
                    style={{ background: theme.paper }}
                  >
                    <span
                      className="h-full w-1/3"
                      style={{ background: theme.accent }}
                    />
                    <span
                      className="h-full w-1/3"
                      style={{ background: theme.accentSoft }}
                    />
                  </span>
                  <span className="text-[10px] font-medium text-ink-soft">
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ImageIcon className="size-4 text-terracotta" />
            Cover image
          </div>
          <AiCostButton
            size="sm"
            icon="cost"
            mode="image"
            taskType="imageGeneration"
            prompt={JSON.stringify({
              title: itinerary.title,
              country: itinerary.country,
              overview: itinerary.overview,
              routeSummary: itinerary.routeSummary,
            })}
            className="w-full"
            onClick={() =>
              setAiImageTarget({
                kind: "cover",
                title: "AI create cover image",
                prompt: buildImageGenerationPrompt(
                  project,
                  JSON.stringify(
                    {
                      title: itinerary.title,
                      country: itinerary.country,
                      overview: itinerary.overview,
                      routeSummary: itinerary.routeSummary,
                    },
                    null,
                    2,
                  ),
                  "Premium itinerary PDF cover image",
                ),
              })
            }
          >
            AI create cover image
          </AiCostButton>
          <ImageField
            value={itinerary.coverImage ?? ""}
            onUpload={(file) =>
              handleUpload(file, (url) => applyPatch({ coverImage: url }))
            }
            onUrl={(url) => applyPatch({ coverImage: url })}
            onClear={() => applyPatch({ coverImage: "" })}
          />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setDaysOpen((value) => !value)}
            className="flex w-full items-center justify-between text-sm font-semibold text-ink"
          >
            <span className="flex items-center gap-2">
              <ImageIcon className="size-4 text-terracotta" />
              Day images (
              {itinerary.days.filter((day) => Boolean(day.image)).length}/
              {itinerary.days.length})
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-ink-muted transition-transform",
                daysOpen && "rotate-180",
              )}
            />
          </button>
          {daysOpen ? (
            <div className="space-y-3 pt-1">
              {itinerary.days.map((day, index) => (
                <div
                  key={`${itinerary.id}-${index}`}
                  className="rounded-xl border border-border-soft bg-paper-2/30 p-3"
                >
                  <p className="mb-2 text-xs font-semibold text-ink-soft">
                    Day {day.day} - {day.title || "Untitled"}
                  </p>
                  <AiCostButton
                    size="sm"
                    icon="cost"
                    mode="image"
                    taskType="imageGeneration"
                    prompt={JSON.stringify(day)}
                    className="mb-2 w-full"
                    onClick={() =>
                      setAiImageTarget({
                        kind: "day",
                        title: `AI create day ${day.day} image`,
                        index,
                        prompt: buildImageGenerationPrompt(
                          project,
                          JSON.stringify(day, null, 2),
                          `Day ${day.day} itinerary illustration`,
                        ),
                      })
                    }
                  >
                    AI create day image
                  </AiCostButton>
                  <ImageField
                    value={day.image ?? ""}
                    compact
                    onUpload={(file) =>
                      handleUpload(file, (url) => patchDay(index, url))
                    }
                    onUrl={(url) => patchDay(index, url)}
                    onClear={() => patchDay(index, "")}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="text-xs text-terracotta">{error}</p> : null}
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Uploaded images are compressed and stored in your browser. Remote URLs
          work in preview and native printing, but must allow cross-origin canvas
          access to appear in a downloaded PDF.
        </p>
        <AiRunSheet
          open={Boolean(aiImageTarget)}
          onOpenChange={(open) => {
            if (!open) setAiImageTarget(null);
          }}
          mode="image"
          title={aiImageTarget?.title ?? "AI create itinerary image"}
          description="Image models may be more expensive than text. Preview the generated visual before applying it to the PDF."
          taskType="imageGeneration"
          sourceLabel={aiImageTarget?.kind === "cover" ? "PDF cover" : "Day image"}
          prompt={aiImageTarget?.prompt ?? ""}
          onApplyImage={recordImageRun}
        />
      </CardContent>
    </Card>
  );
}

export function ImageField({
  value,
  onUpload,
  onUrl,
  onClear,
  compact,
}: {
  value: string;
  onUpload: (file: File | undefined) => void;
  onUrl: (url: string) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const inputId = React.useId();
  const isUpload = value.startsWith("data:");
  const incomingDraft = isUpload ? "" : value;
  const [draft, setDraft] = React.useState(incomingDraft);
  const [previousDraft, setPreviousDraft] = React.useState(incomingDraft);
  if (incomingDraft !== previousDraft) {
    setPreviousDraft(incomingDraft);
    setDraft(incomingDraft);
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-border-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="preview"
            className="w-full object-cover"
            style={{ height: compact ? "72px" : "120px" }}
          />
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove image"
            className="absolute right-1.5 top-1.5 inline-flex size-7 items-center justify-center rounded-full bg-ink/70 text-paper hover:bg-ink"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <label
          htmlFor={inputId}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-paper/60 px-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-forest/40 hover:text-ink"
        >
          <Upload className="size-4" />
          Upload
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              onUpload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <Input
          type="url"
          placeholder="or paste image URL"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const next = draft.trim();
            if (next !== value) onUrl(next);
          }}
          className="h-9"
        />
      </div>
    </div>
  );
}
