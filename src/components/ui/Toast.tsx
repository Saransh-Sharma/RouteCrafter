"use client";

import * as React from "react";
import { Check, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/**
 * Lightweight toast provider. Mount once near the app root, then call
 * `useToast().toast("Saved")` from anywhere inside the tree.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = (idRef.current += 1);
      setToasts((current) => [...current, { id, message, tone }]);
      setTimeout(() => dismiss(id), 3600);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} toast={item} onDismiss={() => dismiss(item.id)} />
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

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { icon: Icon, ring, iconColor } = TONE_STYLES[toast.tone];
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
      <button
        type="button"
        onClick={onDismiss}
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
    return { toast: () => {} };
  }
  return ctx;
}
