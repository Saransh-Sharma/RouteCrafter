"use client";

import * as React from "react";
import { BadgeDollarSign, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiCostBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--rc-ai-brown)]",
        className,
      )}
    >
      Billable
    </span>
  );
}

export interface AiCostButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md";
  icon?: "sparkles" | "cost";
  showBadge?: boolean;
}

export const AiCostButton = React.forwardRef<
  HTMLButtonElement,
  AiCostButtonProps
>(
  (
    {
      className,
      children,
      size = "md",
      icon = "sparkles",
      showBadge = true,
      ...props
    },
    ref,
  ) => {
    const Icon = icon === "cost" ? BadgeDollarSign : Sparkles;
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] font-medium text-[var(--rc-ai-brown)] shadow-[inset_0_0_0_1px_rgba(193,154,75,0.18),var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-forest/40 hover:text-forest active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
          size === "sm" ? "h-9 px-3.5 text-sm" : "h-11 px-5 text-sm",
          className,
        )}
        {...props}
      >
        <Icon className="size-4" />
        <span>{children}</span>
        {showBadge ? <AiCostBadge /> : null}
      </button>
    );
  },
);
AiCostButton.displayName = "AiCostButton";
