"use client";

/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { Copy, ImagePlus, Sparkles, Trash2, Upload } from "lucide-react";
import type { AssetType } from "@/lib/persistence/types";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MediaDrawer } from "./MediaDrawer";

/**
 * One image slot, three ways to fill it — in cost order:
 * ① Upload / pick from the media library (free),
 * ② Copy a ready-made prompt to run in any external image tool (free),
 * ③ Generate via API — only rendered when the caller wires it, always
 *    behind the existing cost-confirm flow, never a default.
 */
export function ImageSlot({
  value,
  onChange,
  copyPrompt,
  onGenerate,
  projectId,
  country,
  assetType = "cover-image",
  label = "Image",
  className,
}: {
  value?: string;
  onChange: (url: string) => void;
  /** Self-contained prompt for external generation; enables ②. */
  copyPrompt?: string;
  /** Opens the caller's billable generation flow; enables ③. */
  onGenerate?: () => void;
  projectId?: string;
  country?: string;
  assetType?: AssetType;
  label?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  async function copy() {
    if (!copyPrompt) return;
    await navigator.clipboard.writeText(copyPrompt);
    toast("Prompt copied — paste it into ChatGPT, Gemini, or Midjourney");
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-1.5">
      <SlotButton
        icon={Upload}
        label={value ? "Replace" : "Upload"}
        onClick={() => setDrawerOpen(true)}
      />
      {copyPrompt ? (
        <SlotButton icon={Copy} label="Copy prompt" onClick={() => void copy()} />
      ) : null}
      {onGenerate ? (
        <SlotButton
          icon={Sparkles}
          label="Generate (billable)"
          tone="ai"
          onClick={onGenerate}
        />
      ) : null}
      {value ? (
        <SlotButton
          icon={Trash2}
          label="Remove"
          tone="danger"
          onClick={() => onChange("")}
        />
      ) : null}
    </div>
  );

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className="group relative overflow-hidden rounded-[var(--radius-card)] border border-border-soft">
          <img
            src={value}
            alt={label}
            className="aspect-[3/2] w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-ink/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {actions}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border-strong p-6 text-center">
          <ImagePlus className="size-6 text-ink-muted" aria-hidden />
          <p className="text-caption text-ink-muted">
            No {label.toLowerCase()} yet
          </p>
          {actions}
        </div>
      )}

      <MediaDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onPick={(asset) => onChange(asset.blobUrl)}
        projectId={projectId}
        country={country}
        assetType={assetType}
      />
    </div>
  );
}

function SlotButton({
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  icon: typeof Upload;
  label: string;
  tone?: "ai" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage",
        tone === "ai"
          ? "border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] text-[var(--rc-ai-brown)] hover:brightness-95"
          : tone === "danger"
            ? "border-terracotta/40 bg-paper/90 text-terracotta hover:bg-terracotta-soft"
            : "border-border-strong bg-paper/90 text-ink-soft hover:text-ink",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
