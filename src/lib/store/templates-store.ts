"use client";

import { create as createZustand } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Template } from "@/lib/types";
import { seedTemplates } from "@/lib/templates";
import { templateSchema } from "@/lib/schemas";
import { isCloudPersistenceEnabled } from "@/lib/persistence/config";
import { useAuthStore } from "./auth-store";

const TEMPLATES_STORAGE_KEY = "routecrafter:templates:v1";
const CLOUD_UNAVAILABLE_COOLDOWN_MS = 5000;

interface TemplatesState {
  templates: Template[];
  hasHydrated: boolean;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  syncError: string | null;
  setHasHydrated: (value: boolean) => void;
  hydrateCloudTemplates: () => Promise<void>;
  saveTemplate: (template: Template) => Promise<Template>;
  removeTemplate: (id: string) => Promise<void>;
  getById: (id: string) => Template | undefined;
}

let cloudUnavailableAt = 0;

function isCloudTemporarilyUnavailable(): boolean {
  return (
    cloudUnavailableAt > 0 &&
    Date.now() - cloudUnavailableAt < CLOUD_UNAVAILABLE_COOLDOWN_MS
  );
}

function noteCloudUnavailable(): void {
  cloudUnavailableAt = Date.now();
}

function mergeTemplates(local: Template[], incoming: Template[]): Template[] {
  const byId = new Map<string, Template>();
  for (const item of [...seedTemplates, ...local, ...incoming]) {
    byId.set(item.id, templateSchema.parse(item));
  }
  return [...byId.values()].sort((left, right) => {
    const leftSeed = seedTemplates.some((item) => item.id === left.id);
    const rightSeed = seedTemplates.some((item) => item.id === right.id);
    if (leftSeed !== rightSeed) return leftSeed ? -1 : 1;
    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
}

export const useTemplatesStore = createZustand<TemplatesState>()(
  persist(
    (set, get) => ({
      templates: seedTemplates,
      hasHydrated: false,
      syncStatus: "idle",
      syncError: null,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      hydrateCloudTemplates: async () => {
        if (!isCloudPersistenceEnabled() || isCloudTemporarilyUnavailable()) return;
        const user = useAuthStore.getState().user;
        if (!user || typeof fetch === "undefined") return;
        set({ syncStatus: "syncing", syncError: null });
        try {
          const response = await fetch("/api/templates", {
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          if (response.status === 503) {
            noteCloudUnavailable();
            set({ syncStatus: "idle", syncError: null });
            return;
          }
          if (!response.ok) throw new Error("Template sync failed.");
          const body = (await response.json()) as { templates?: Template[] };
          set({
            templates: mergeTemplates(get().templates, body.templates ?? []),
            syncStatus: "synced",
            syncError: null,
          });
        } catch (error) {
          set({
            syncStatus: "error",
            syncError:
              error instanceof Error ? error.message : "Template sync failed.",
          });
        }
      },
      saveTemplate: async (template) => {
        const parsed = templateSchema.parse(template);
        set({ templates: mergeTemplates(get().templates, [parsed]) });
        if (!isCloudPersistenceEnabled() || isCloudTemporarilyUnavailable()) {
          return parsed;
        }
        const user = useAuthStore.getState().user;
        if (!user || typeof fetch === "undefined") return parsed;
        const response = await fetch("/api/templates", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });
        if (response.status === 503) {
          noteCloudUnavailable();
          return parsed;
        }
        if (!response.ok) throw new Error("Could not save the template.");
        const body = (await response.json()) as { template?: Template };
        const saved = templateSchema.parse(body.template ?? parsed);
        set({ templates: mergeTemplates(get().templates, [saved]) });
        return saved;
      },
      removeTemplate: async (id) => {
        if (seedTemplates.some((template) => template.id === id)) return;
        set({
          templates: get().templates.filter((template) => template.id !== id),
        });
        if (!isCloudPersistenceEnabled() || isCloudTemporarilyUnavailable()) return;
        const user = useAuthStore.getState().user;
        if (!user || typeof fetch === "undefined") return;
        const response = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (response.status === 503) {
          noteCloudUnavailable();
          return;
        }
        if (!response.ok) throw new Error("Could not delete the template.");
      },
      getById: (id) => get().templates.find((template) => template.id === id),
    }),
    {
      name: TEMPLATES_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        templates: state.templates.filter(
          (template) => !seedTemplates.some((seed) => seed.id === template.id),
        ),
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { templates?: Template[] } | null;
        return {
          ...currentState,
          templates: mergeTemplates(
            currentState.templates,
            persisted?.templates ?? [],
          ),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
