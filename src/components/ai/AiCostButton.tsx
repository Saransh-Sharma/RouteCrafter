"use client";

import * as React from "react";
import { BadgeDollarSign, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiSettingsStore } from "@/lib/store/ai-settings-store";
import { estimateAiRunCost, formatCostEstimate } from "@/lib/ai/pricing";
import type { AiCostEstimate, AiTaskType } from "@/lib/ai/types";
import { useAiConfig } from "./AiConfigProvider";
import { resolveClientAiRun } from "@/lib/ai/runtime";

export function AiCostBadge({
  className,
  estimate,
}: {
  className?: string;
  estimate?: AiCostEstimate | null;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center justify-center rounded-full border border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)] px-2 py-0.5 text-center text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.12em] text-[var(--rc-ai-brown)]",
        className,
      )}
    >
      {estimate === undefined
        ? "Estimated cost"
        : estimate
          ? `Est. ${formatCostEstimate(estimate)}`
          : "Estimate unavailable"}
    </span>
  );
}

export interface AiCostButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md";
  icon?: "sparkles" | "cost";
  showBadge?: boolean;
  mode?: "text" | "image";
  taskType?: AiTaskType;
  prompt?: string;
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
      mode = "text",
      taskType = "prompt",
      prompt = "",
      ...props
    },
    ref,
  ) => {
    const Icon = icon === "cost" ? BadgeDollarSign : Sparkles;
    const textDefaults = useAiSettingsStore((state) => state.text);
    const imageDefaults = useAiSettingsStore((state) => state.image);
    const getApiKey = useAiSettingsStore((state) => state.getApiKey);
    const { config } = useAiConfig();
    const defaults = mode === "text" ? textDefaults : imageDefaults;
    const selection = resolveClientAiRun({
      mode,
      defaults,
      personalKey: getApiKey(defaults.provider),
      serverConfig: config,
    });
    const estimate =
      mode === "text"
        ? estimateAiRunCost({
            mode,
            provider: selection.provider,
            model: selection.model,
            prompt,
            taskType,
            maxOutputTokens: textDefaults.maxOutputTokens,
          })
        : estimateAiRunCost({
            mode,
            provider: selection.provider,
            model: selection.model,
            prompt,
            taskType,
            size: imageDefaults.size,
            quality: imageDefaults.quality,
          });
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[var(--rc-ai-border)] bg-[var(--rc-ai-surface)] text-center font-medium leading-snug text-[var(--rc-ai-brown)] shadow-[inset_0_0_0_1px_rgba(193,154,75,0.18),var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-forest/40 hover:text-forest active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
          size === "sm"
            ? "min-h-9 px-3.5 py-2 text-sm"
            : "min-h-11 px-5 py-2.5 text-sm",
          className,
        )}
        {...props}
      >
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 max-w-full text-balance">{children}</span>
        {showBadge ? <AiCostBadge estimate={estimate} /> : null}
      </button>
    );
  },
);
AiCostButton.displayName = "AiCostButton";
