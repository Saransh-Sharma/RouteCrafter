"use client";

import { AlertTriangle } from "lucide-react";
import { useProjectsStore } from "@/lib/store/projects-store";

/**
 * Surfaces last-write-wins conflicts in the shared workspace. When another user
 * saves newer changes to a project the current user is also editing, the cloud
 * write is rejected (409) and we offer an explicit resolution: reload the latest
 * cloud copy, or overwrite it with the local changes.
 */
export function ConflictBanner() {
  const conflicts = useProjectsStore((state) => state.conflictByProject);
  const reload = useProjectsStore((state) => state.resolveConflictReload);
  const overwrite = useProjectsStore((state) => state.resolveConflictOverwrite);
  const projects = useProjectsStore((state) => state.projects);

  const entries = Object.values(conflicts);
  if (entries.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {entries.map((conflict) => {
        const name =
          projects.find((p) => p.id === conflict.projectId)?.name ??
          conflict.cloudProject.name;
        const by = conflict.updatedByName
          ? ` by ${conflict.updatedByName}`
          : "";
        const isDelete = conflict.kind === "delete";
        return (
          <div
            key={conflict.projectId}
            className="flex flex-col gap-3 rounded-2xl border border-gold/40 bg-gold-soft/50 p-4 text-sm text-ink sm:flex-row sm:items-center"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />
            <p className="flex-1">
              <span className="font-medium">{name}</span> was updated{by} in the
              shared workspace while you were{" "}
              {isDelete ? "deleting it" : "editing"}. Choose what to do.
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => reload(conflict.projectId)}
                className="inline-flex h-9 items-center rounded-full border border-border-strong bg-paper px-4 text-sm font-medium text-ink-soft hover:border-forest/40 hover:text-ink"
              >
                {isDelete ? "Keep it" : "Reload latest"}
              </button>
              <button
                type="button"
                onClick={() => overwrite(conflict.projectId)}
                className="inline-flex h-9 items-center rounded-full bg-terracotta px-4 text-sm font-medium text-paper hover:bg-terracotta/90"
              >
                {isDelete ? "Delete anyway" : "Overwrite"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
