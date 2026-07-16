"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Align = "start" | "end";

const PopoverContext = React.createContext<{ close: () => void } | null>(null);

/** Close the nearest Popover (e.g. after an action inside the panel). */
export function usePopoverClose(): () => void {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("usePopoverClose must be used inside a Popover panel");
  }
  return context.close;
}

export interface PopoverProps {
  /** The always-visible trigger. Receives open state for styling. */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": true;
  }) => React.ReactNode;
  align?: Align;
  className?: string;
  children: React.ReactNode;
}

/**
 * Anchored, dismissable panel: closes on outside click and Escape, returns
 * focus to the trigger. Panel content can close it via usePopoverClose().
 * For lists of actions use Menu, which adds arrow-key focus on top of this.
 */
export function Popover({
  trigger,
  align = "start",
  className,
  children,
}: PopoverProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const restoreFocusRef = React.useRef(false);

  const close = React.useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  }, []);

  const contextValue = React.useMemo(
    () => ({ close: () => close() }),
    [close],
  );

  React.useEffect(() => {
    if (open) return;
    if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative inline-block">
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-haspopup": true,
      })}
      {open ? (
        <div
          role="dialog"
          className={cn(
            "absolute z-50 mt-2 min-w-56 rounded-[var(--radius-card)] border border-border-soft bg-paper p-2 shadow-[var(--shadow-lift)] animate-in fade-in",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          <PopoverContext.Provider value={contextValue}>
            {children}
          </PopoverContext.Provider>
        </div>
      ) : null}
    </div>
  );
}
