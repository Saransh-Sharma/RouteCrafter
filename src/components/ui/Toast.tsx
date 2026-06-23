"use client";

import * as React from "react";
import { Check, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
type ToastDismissReason = "timeout" | "manual" | "action";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: (reason: ToastDismissReason) => void;
  durationMs: number;
}

interface ToastContextValue {
  toast: (
    message:
      | string
      | {
          message: string;
          tone?: ToastTone;
          actionLabel?: string;
          onAction?: () => void;
          onDismiss?: (reason: ToastDismissReason) => void;
          durationMs?: number;
        },
    tone?: ToastTone,
  ) => number;
  dismiss: (id: number) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/**
 * Lightweight toast provider. Mount once near the app root, then call
 * `useToast().toast("Saved")` from anywhere inside the tree.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissWithReason = React.useCallback((id: number, reason: ToastDismissReason) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => {
      const toast = current.find((item) => item.id === id);
      toast?.onDismiss?.(reason);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const dismiss = React.useCallback(
    (id: number) => dismissWithReason(id, "manual"),
    [dismissWithReason],
  );

  const toast = React.useCallback<ToastContextValue["toast"]>(
    (input, tone: ToastTone = "success") => {
      const id = (idRef.current += 1);
      const toast =
        typeof input === "string"
          ? { message: input, tone, durationMs: 3600 }
          : {
              message: input.message,
              tone: input.tone ?? "success",
              actionLabel: input.actionLabel,
              onAction: input.onAction,
              onDismiss: input.onDismiss,
              durationMs: input.durationMs ?? 3600,
            };
      setToasts((current) => [...current, { id, ...toast }]);
      if (toast.durationMs > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismissWithReason(id, "timeout"), toast.durationMs),
        );
      }
      return id;
    },
    [dismissWithReason],
  );

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((item) => (
          <ToastCard
            key={item.id}
            toast={item}
            onDismiss={(reason) => dismissWithReason(item.id, reason)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONE_STYLES: Record<ToastTone, { icon: typeof Check; ring: string; iconColor: string }> = {
  success: { icon: Check, ring: "border-forest/30", iconColor: "text-forest" },
  error: { icon: CircleAlert, ring: "border-terracotta/40", iconColor: "text-terracotta" },
  info: { icon: Info, ring: "border-border-strong", iconColor: "text-ink-soft" },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (reason: ToastDismissReason) => void;
}) {
  const { icon: Icon, ring, iconColor } = TONE_STYLES[toast.tone];
  function runAction() {
    toast.onAction?.();
    onDismiss("action");
  }
  return (
    <div
      role="status"
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-paper/95 px-4 py-3 shadow-[var(--shadow-lift)] backdrop-blur",
        ring,
      )}
    >
      <Icon className={cn("size-4 shrink-0", iconColor)} />
      <p className="min-w-0 flex-1 text-sm font-medium text-ink">{toast.message}</p>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          onClick={runAction}
          className="shrink-0 rounded-full bg-sage-soft px-2.5 py-1 text-xs font-semibold text-forest transition-colors hover:bg-sage-soft/70"
        >
          {toast.actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onDismiss("manual")}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-full p-1 text-ink-muted transition-colors hover:bg-paper-2 hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback so callers never crash if the provider is missing.
    return { toast: () => 0, dismiss: () => {} };
  }
  return ctx;
}
