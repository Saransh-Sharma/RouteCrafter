"use client";

import { AlertCircle, X } from "lucide-react";
import { useProjectsStore } from "@/lib/store/projects-store";

export function PersistenceNotice() {
  const error = useProjectsStore((state) => state.persistenceError);
  const clear = useProjectsStore((state) => state.clearPersistenceError);

  if (!error) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta-soft/60 p-4 text-sm text-terracotta">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{error}</p>
      <button
        type="button"
        onClick={clear}
        aria-label="Dismiss storage error"
        className="rounded-md p-0.5 hover:bg-terracotta/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
