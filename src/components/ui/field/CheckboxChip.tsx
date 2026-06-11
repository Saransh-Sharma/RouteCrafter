"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxChipProps {
  label: string;
  selected?: boolean;
  onToggle?: (selected: boolean) => void;
  className?: string;
}

/**
 * Chip-style multi-select toggle. Used extensively by the Phase 3 trip
 * configuration form (travel styles, interests, constraints, deliverables).
 */
export function CheckboxChip({
  label,
  selected = false,
  onToggle,
  className,
}: CheckboxChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle?.(!selected)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-150",
        selected
          ? "border-forest/40 bg-sage-soft text-forest"
          : "border-border-strong bg-paper/60 text-ink-soft hover:border-forest/30 hover:text-ink",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-forest bg-forest text-paper"
            : "border-border-strong bg-paper",
        )}
      >
        {selected ? <Check className="size-3" /> : null}
      </span>
      {label}
    </button>
  );
}
