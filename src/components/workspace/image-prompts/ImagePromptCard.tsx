"use client";

import { RefreshCw, Star } from "lucide-react";
import type { PortfolioImagePrompt } from "@/lib/types";
import { imagePromptToText } from "@/lib/generation";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const FIELDS: { label: string; key: keyof PortfolioImagePrompt; rows?: number }[] = [
  { label: "Goal", key: "goal", rows: 2 },
  { label: "Canvas", key: "canvas", rows: 1 },
  { label: "Layout", key: "layout", rows: 2 },
  { label: "Visual elements", key: "visualElements", rows: 3 },
  { label: "Text overlay", key: "textOverlay", rows: 2 },
  { label: "Style", key: "style", rows: 2 },
  { label: "Negative prompt", key: "negativePrompt", rows: 2 },
  { label: "Country accuracy notes", key: "countryAccuracyNotes", rows: 2 },
  { label: "Readability notes", key: "readabilityNotes", rows: 2 },
];

export function ImagePromptCard({
  prompt,
  index,
  onChange,
  onRegenerate,
  onToggleFinal,
}: {
  prompt: PortfolioImagePrompt;
  index: number;
  onChange: (next: PortfolioImagePrompt) => void;
  onRegenerate: () => void;
  onToggleFinal: () => void;
}) {
  function setField(key: keyof PortfolioImagePrompt, value: string) {
    onChange({ ...prompt, [key]: value });
  }

  return (
    <Card className={cn(prompt.isFinal && "border-forest/40")}>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sm font-semibold text-forest">
              {index + 1}
            </span>
            <div>
              <input
                value={prompt.title}
                onChange={(e) => setField("title", e.target.value)}
                className="w-full bg-transparent text-lg font-semibold text-ink outline-none"
              />
              {prompt.isFinal ? <Badge tone="forest">Final</Badge> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onToggleFinal}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                prompt.isFinal
                  ? "border-forest/40 bg-sage-soft text-forest"
                  : "border-border-strong bg-paper/60 text-ink-soft hover:text-ink",
              )}
            >
              <Star
                className={cn("size-3.5", prompt.isFinal && "fill-forest")}
              />
              {prompt.isFinal ? "Final" : "Mark final"}
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-paper/60 px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-forest/40 hover:text-ink"
            >
              <RefreshCw className="size-3.5" />
              Regenerate
            </button>
            <CopyButton value={imagePromptToText(prompt)} label="Copy all" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div
              key={f.key}
              className={cn(
                "space-y-1.5",
                (f.key === "visualElements" || f.key === "textOverlay") &&
                  "sm:col-span-2",
              )}
            >
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {f.label}
              </label>
              <Textarea
                value={prompt[f.key] as string}
                rows={f.rows ?? 2}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
