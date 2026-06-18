import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckRowProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  className?: string;
}

/**
 * A single full-width selectable row with a trailing check box. Used for
 * compact lists of toggles (e.g. the output package in Define) where a chip or
 * card would be too heavy.
 */
export function CheckRow({
  label,
  selected = false,
  disabled = false,
  onToggle,
  className,
}: CheckRowProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between gap-3 border-b border-border-soft py-2 text-left text-sm transition-colors",
        "focus-visible:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-sage",
        disabled && "cursor-not-allowed",
        selected ? "text-ink" : "text-ink-muted hover:text-ink",
        className,
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          selected
            ? "border-forest bg-forest text-paper"
            : "border-border-strong",
        )}
      >
        {selected ? <Check className="size-3" /> : null}
      </span>
    </button>
  );
}
