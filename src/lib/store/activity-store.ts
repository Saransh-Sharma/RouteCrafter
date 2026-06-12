import { create as createZustand } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ActivityLogEntry, ActivityAction } from "../schemas/activity";

const MAX_ENTRIES_PER_PROJECT = 100;

interface ActivityState {
  entries: ActivityLogEntry[];

  /** Log a new activity entry */
  log: (entry: Omit<ActivityLogEntry, "id" | "timestamp">) => void;

  /** Get entries for a specific project, most recent first */
  getByProject: (projectId: string) => ActivityLogEntry[];
}

export const useActivityStore = createZustand<ActivityState>()(
  persist(
    (set, get) => ({
      entries: [],

      log: (entry) => {
        const newEntry: ActivityLogEntry = {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        };

        set((state) => {
          const projectEntries = state.entries.filter(
            (e) => e.projectId === entry.projectId,
          );
          const otherEntries = state.entries.filter(
            (e) => e.projectId !== entry.projectId,
          );

          // Keep only the most recent entries per project
          const trimmed = [newEntry, ...projectEntries].slice(
            0,
            MAX_ENTRIES_PER_PROJECT,
          );

          return { entries: [...trimmed, ...otherEntries] };
        });
      },

      getByProject: (projectId) =>
        get()
          .entries.filter((e) => e.projectId === projectId)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() -
              new Date(a.timestamp).getTime(),
          ),
    }),
    {
      name: "routecrafter:activity:v1",
      storage: createJSONStorage(() => window.localStorage),
    },
  ),
);

/** Helper: log an activity for the current user */
export function logActivity(
  projectId: string,
  action: ActivityAction,
  detail: string,
  user: { id: string; displayName: string } | null,
) {
  if (!user) return;
  useActivityStore.getState().log({
    projectId,
    userId: user.id,
    userName: user.displayName,
    action,
    detail,
  });
}
