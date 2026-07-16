"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  size?: Size;
  /** Hide the built-in close button (e.g. when the body renders its own). */
  hideClose?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Modal dialog on the native <dialog> element: focus trap, Esc, and focus
 * restore come from the platform. Closing is always routed through onClose
 * so React state stays the single source of truth.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  hideClose = false,
  className,
  children,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className={cn(
        "m-auto w-[calc(100vw-2.5rem)] rounded-[var(--radius-band)] border border-border-soft bg-paper p-0 text-ink shadow-[var(--shadow-lift)]",
        "backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]",
        "open:animate-in open:fade-in",
        sizes[size],
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          {(title || !hideClose) && (
            <header className="flex items-start justify-between gap-4 px-6 pt-6">
              <div className="min-w-0">
                {title ? (
                  <h2 className="text-heading font-display">{title}</h2>
                ) : null}
                {description ? (
                  <p className="mt-1 text-caption text-ink-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              {!hideClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="rounded-full p-2 text-ink-muted transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </header>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/** Right-aligned action row for dialog footers. */
export function DialogActions({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-wrap items-center justify-end gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
