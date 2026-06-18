"use client";

import * as React from "react";
import { Minus, Moon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact – [☾ N nights] + control. Nights are the editable lever per city. */
export function NightsStepper({
  nights,
  onChange,
  city,
}: {
  nights: number;
  onChange: (next: number) => void;
  city: string;
}) {
  const [bump, setBump] = React.useState(false);

  function step(delta: number) {
    const next = Math.max(0, Math.min(60, nights + delta));
    if (next === nights) return;
    onChange(next);
    setBump(true);
    window.setTimeout(() => setBump(false), 200);
  }

  const btn =
    "flex size-7 items-center justify-center rounded-full border border-border-strong bg-paper text-ink-soft transition-all duration-150 hover:border-forest/40 hover:text-forest active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div
      role="group"
      aria-label={`Nights in ${city}`}
      className="inline-flex items-center gap-2"
    >
      <button
        type="button"
        className={btn}
        onClick={() => step(-1)}
        disabled={nights <= 0}
        aria-label={`One fewer night in ${city}`}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="inline-flex min-w-[5.5rem] items-center justify-center gap-1.5 text-sm font-semibold text-ink">
        <Moon
          className={cn(
            "size-3.5 text-teal transition-transform duration-150",
            bump && "-translate-y-px scale-110",
          )}
        />
        {nights} {nights === 1 ? "night" : "nights"}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => step(1)}
        disabled={nights >= 60}
        aria-label={`One more night in ${city}`}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
