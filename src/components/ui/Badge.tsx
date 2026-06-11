import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "sage"
  | "terracotta"
  | "teal"
  | "gold"
  | "forest"
  | "neutral";

const tones: Record<Tone, string> = {
  sage: "bg-sage-soft text-forest border-sage/40",
  terracotta: "bg-terracotta-soft text-terracotta border-terracotta/30",
  teal: "bg-teal-soft text-teal border-teal/30",
  gold: "bg-gold-soft text-brown border-gold/40",
  forest: "bg-forest text-paper border-forest",
  neutral: "bg-paper-2 text-ink-soft border-border-strong",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
