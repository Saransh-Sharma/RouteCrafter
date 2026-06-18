import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectableCardProps {
  title: string;
  description?: string;
  selected?: boolean;
  /** "radio" shows a circular indicator, "checkbox" a rounded square. */
  control?: "radio" | "checkbox";
  disabled?: boolean;
  onSelect?: () => void;
  className?: string;
  children?: React.ReactNode;
}

/**
 * A bordered, selectable option card with a title, optional description and a
 * single check indicator. Replaces the hand-rolled offer-model radio cards so
 * "pick one / pick from a set" shares one visual language across the app.
 */
export function SelectableCard({
  title,
  description,
  selected = false,
  control = "radio",
  disabled = false,
  onSelect,
  className,
  children,
}: SelectableCardProps) {
  return (
    <button
      type="button"
      role={control === "radio" ? "radio" : "checkbox"}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group flex min-h-36 flex-col rounded-2xl border px-5 py-5 text-left transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        disabled && "cursor-not-allowed opacity-60",
        selected
          ? "border-forest bg-sage-soft/70 shadow-[var(--shadow-soft)]"
          : "border-border-soft bg-paper/35 hover:border-forest/35 hover:bg-paper/70",
        className,
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="rc-label text-base">{title}</span>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center border transition-colors",
            control === "radio" ? "rounded-full" : "rounded-md",
            selected
              ? "border-forest bg-forest text-paper"
              : "border-border-strong bg-paper",
          )}
        >
          {selected ? <Check className="size-3" /> : null}
        </span>
      </span>
      {description ? (
        <span className="mt-3 block text-sm leading-6 text-ink-soft">
          {description}
        </span>
      ) : null}
      {children}
    </button>
  );
}
