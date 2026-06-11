"use client";

import * as React from "react";
import { Upload, Trash2, ImageIcon, Palette, ChevronDown } from "lucide-react";
import type { ItineraryOutput, PdfTheme, Project } from "@/lib/types";
import { useProjectsStore } from "@/lib/store/projects-store";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { DOC_THEMES } from "./themes";
import { compressImageFile } from "./image-utils";

export function PdfThemeControls({
  project,
  itinerary,
}: {
  project: Project;
  itinerary: ItineraryOutput;
}) {
  const update = useProjectsStore((s) => s.update);
  const [error, setError] = React.useState<string | null>(null);
  const [daysOpen, setDaysOpen] = React.useState(false);

  function patchItinerary(patch: Partial<ItineraryOutput>) {
    update(project.id, {
      itineraries: project.itineraries.map((it) =>
        it.id === itinerary.id
          ? { ...it, ...patch, updatedAt: new Date().toISOString() }
          : it,
      ),
    });
  }

  function patchDay(index: number, image: string) {
    patchItinerary({
      days: itinerary.days.map((d, i) => (i === index ? { ...d, image } : d)),
    });
  }

  async function handleUpload(
    file: File | undefined,
    apply: (dataUrl: string) => void,
  ) {
    if (!file) return;
    setError(null);
    try {
      apply(await compressImageFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process the image.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-5">
        {/* Theme */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Palette className="size-4 text-terracotta" />
            Color theme
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DOC_THEMES.map((t) => {
              const active = (itinerary.pdfTheme ?? "beige") === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => patchItinerary({ pdfTheme: t.id as PdfTheme })}
                  aria-label={t.label}
                  title={t.label}
                  className={cn(
                    "group flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors",
                    active
                      ? "border-forest ring-2 ring-sage/50"
                      : "border-border-strong hover:border-forest/40",
                  )}
                >
                  <span
                    className="flex h-8 w-full overflow-hidden rounded-md"
                    style={{ background: t.paper }}
                  >
                    <span
                      className="h-full w-1/3"
                      style={{ background: t.accent }}
                    />
                    <span
                      className="h-full w-1/3"
                      style={{ background: t.accentSoft }}
                    />
                  </span>
                  <span className="text-[10px] font-medium text-ink-soft">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cover image */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ImageIcon className="size-4 text-terracotta" />
            Cover image
          </div>
          <ImageField
            value={itinerary.coverImage}
            onUpload={(file) =>
              handleUpload(file, (url) => patchItinerary({ coverImage: url }))
            }
            onUrl={(url) => patchItinerary({ coverImage: url })}
            onClear={() => patchItinerary({ coverImage: "" })}
          />
        </div>

        {/* Per-day images */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setDaysOpen((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-semibold text-ink"
          >
            <span className="flex items-center gap-2">
              <ImageIcon className="size-4 text-terracotta" />
              Day images ({itinerary.days.filter((d) => d.image).length}/
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
              {itinerary.days.map((day, i) => (
                <div
                  key={`${itinerary.id}-${i}`}
                  className="rounded-xl border border-border-soft bg-paper-2/30 p-3"
                >
                  <p className="mb-2 text-xs font-semibold text-ink-soft">
                    Day {day.day} - {day.title || "Untitled"}
                  </p>
                  <ImageField
                    value={day.image}
                    compact
                    onUpload={(file) =>
                      handleUpload(file, (url) => patchDay(i, url))
                    }
                    onUrl={(url) => patchDay(i, url)}
                    onClear={() => patchDay(i, "")}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="text-xs text-terracotta">{error}</p> : null}
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Uploaded images are compressed and stored in your browser, and always
          embed in the downloaded PDF. Pasted URLs work in the preview and
          print, but may appear blank in the downloaded PDF (cross-origin).
        </p>
      </CardContent>
    </Card>
  );
}

function ImageField({
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
            onChange={(e) => {
              onUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <Input
          type="url"
          placeholder="or paste image URL"
          defaultValue={isUpload ? "" : value}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== value) onUrl(v);
          }}
          className="h-9"
        />
      </div>
    </div>
  );
}
