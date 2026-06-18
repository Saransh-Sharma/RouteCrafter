"use client";

import * as React from "react";
import { TRANSPORT_META, type TransportMode } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { TRANSPORT_ICON, TRANSPORT_OPTIONS } from "./transport-meta";

/**
 * The subtle transport indicator drawn on the route line between two stops.
 * Dashed line for flights, solid otherwise. Click the chip to change the mode.
 */
export function LegConnector({
  mode,
  toCity,
  onChange,
}: {
  mode: TransportMode;
  toCity: string;
  onChange: (mode: TransportMode) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const Icon = TRANSPORT_ICON[mode];
  const dashed = TRANSPORT_META[mode].line === "dashed";

  React.useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative flex shrink-0 items-center justify-center self-center max-sm:py-1"
    >
      {/* Route line — horizontal on wide screens, vertical when the rail stacks */}
      <span
        aria-hidden
        className={cn(
          "absolute border-forest/30 max-sm:h-full max-sm:border-l sm:w-full sm:border-t",
          dashed ? "border-dashed" : "border-solid",
        )}
      />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Travel to ${toCity} by ${TRANSPORT_META[mode].label.toLowerCase()} — change`}
        className={cn(
          "relative z-10 flex size-7 items-center justify-center rounded-full border bg-paper text-ink-muted transition-all duration-150 hover:scale-105 hover:border-teal/50 hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage",
          open ? "border-teal/50 text-teal" : "border-border-strong",
        )}
        title={`${TRANSPORT_META[mode].label} to ${toCity}`}
      >
        <Icon className="size-3.5" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={`Transport to ${toCity}`}
          className="animate-in fade-in slide-in-from-bottom-2 absolute top-full left-1/2 z-30 mt-2 w-40 -translate-x-1/2 rounded-2xl border border-border-strong bg-paper p-1.5 shadow-[var(--shadow-lift)]"
        >
          {TRANSPORT_OPTIONS.map(({ mode: option, label, Icon: OptionIcon }) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === mode}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm transition-colors",
                option === mode
                  ? "bg-teal-soft/70 text-forest"
                  : "text-ink-soft hover:bg-paper-2/70 hover:text-ink",
              )}
            >
              <OptionIcon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
