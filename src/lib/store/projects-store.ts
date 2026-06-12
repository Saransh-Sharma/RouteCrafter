import { create as createZustand } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CURRENT_SCHEMA_VERSION,
  projectSchema,
  type Duration,
  type ItineraryOutput,
  type Project,
  type TravelerType,
} from "../schemas";
import {
  normalizePersistedProjects,
  normalizeProject,
} from "../project-normalization";
import { seedProjects } from "../seed-projects";
import { logActivity } from "./activity-store";
import { useAuthStore } from "./auth-store";

export const MAX_PERSISTED_STATE_CHARS = 4_000_000;

export type MutationResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
    };

export interface ExpandHint {
  duration: Duration;
  travelerType: TravelerType;
}

export interface CreateProjectInput {
  name: string;
  country?: string;
  regions?: string[];
  positioning?: string;
  targetAudience?: string;
  travelStyles?: Project["travelStyles"];
  travelerTypes?: Project["travelerTypes"];
  durations?: Project["durations"];
  deliverables?: Project["deliverables"];
  accent?: Project["accent"];
}

const ACCENTS: Project["accent"][] = [
  "sage",
  "terracotta",
  "teal",
  "gold",
  "forest",
];

interface PersistedSlice {
  projects: Project[];
  initialized: boolean;
}

interface ProjectsState extends PersistedSlice {
  hasHydrated: boolean;
  persistenceError: string | null;
  setHasHydrated: (value: boolean) => void;
  hydrateSeeds: () => void;
  create: (input: CreateProjectInput) => Project;
  update: (id: string, patch: Partial<Project>) => MutationResult;
  updateProject: (
    id: string,
    updater: (project: Project) => Project,
  ) => MutationResult;
  patchItinerary: (
    projectId: string,
    itineraryId: string,
    patch:
      | Partial<ItineraryOutput>
      | ((itinerary: ItineraryOutput) => ItineraryOutput),
  ) => MutationResult;
  remove: (id: string) => MutationResult;
  duplicate: (id: string) => Project | undefined;
  getById: (id: string) => Project | undefined;
  importProject: (project: unknown) => Project;
  expandHint: ExpandHint | null;
  setExpandHint: (hint: ExpandHint | null) => void;
  clearPersistenceError: () => void;
}

function now() {
  return new Date().toISOString();
}

export function persistedStateSize(slice: PersistedSlice): number {
  return JSON.stringify({
    state: slice,
    version: CURRENT_SCHEMA_VERSION,
  }).length;
}

function storageErrorMessage(error?: unknown): string {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  ) {
    return "Browser storage is full. Remove an uploaded image or export and delete an older project before trying again.";
  }
  return "RouteCrafter could not save to browser storage. Your last change was rolled back.";
}

export const useProjectsStore = createZustand<ProjectsState>()(
  persist(
    (set, get) => {
      function commitProjects(projects: Project[]): MutationResult {
        const previous = get().projects;
        const normalized = projects.map(normalizeProject);
        const nextSlice = { projects: normalized, initialized: true };

        if (persistedStateSize(nextSlice) > MAX_PERSISTED_STATE_CHARS) {
          const error =
            "This change would exceed RouteCrafter's browser-storage limit. Remove an uploaded image or export and delete an older project.";
          set({ persistenceError: error });
          return { ok: false, error };
        }

        try {
          set({
            projects: normalized,
            initialized: true,
            persistenceError: null,
          });
          return { ok: true };
        } catch (error) {
          const message = storageErrorMessage(error);
          try {
            set({
              projects: previous,
              initialized: true,
              persistenceError: message,
            });
          } catch {
            // The previous persisted state was already known to fit.
          }
          return { ok: false, error: message };
        }
      }

      return {
        projects: [],
        initialized: false,
        hasHydrated: false,
        persistenceError: null,
        expandHint: null,

        setHasHydrated: (value) => set({ hasHydrated: value }),
        setExpandHint: (hint) => set({ expandHint: hint }),
        clearPersistenceError: () => set({ persistenceError: null }),

        hydrateSeeds: () => {
          if (!get().initialized) {
            commitProjects(seedProjects);
          }
        },

        create: (input) => {
          const timestamp = now();
          const accent =
            input.accent ?? ACCENTS[get().projects.length % ACCENTS.length];
          const project = projectSchema.parse({
            id: crypto.randomUUID(),
            name: input.name,
            country: input.country ?? "",
            regions: input.regions ?? [],
            positioning: input.positioning ?? "",
            targetAudience: input.targetAudience ?? "",
            travelStyles: input.travelStyles ?? [],
            travelerTypes: input.travelerTypes ?? [],
            durations: input.durations ?? [],
            deliverables: input.deliverables ?? [],
            accent,
            status: "Draft",
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          const result = commitProjects([project, ...get().projects]);
          if (!result.ok) throw new Error(result.error);
          const user = useAuthStore.getState().user;
          logActivity(project.id, "created", `Created project "${project.name}"`, user);
          return project;
        },

        update: (id, patch) =>
          get().updateProject(id, (project) => ({ ...project, ...patch })),

        updateProject: (id, updater) => {
          const projects = get().projects.map((project) =>
            project.id === id
              ? {
                  ...updater(project),
                  id: project.id,
                  updatedAt: now(),
                }
              : project,
          );
          const result = commitProjects(projects);
          if (result.ok) {
            const user = useAuthStore.getState().user;
            const project = projects.find((p) => p.id === id);
            logActivity(id, "updated", `Updated project "${project?.name ?? id}"`, user);
          }
          return result;
        },

        patchItinerary: (projectId, itineraryId, patch) =>
          get().updateProject(projectId, (project) => ({
            ...project,
            itineraries: project.itineraries.map((itinerary) => {
              if (itinerary.id !== itineraryId) return itinerary;
              const updated =
                typeof patch === "function"
                  ? patch(itinerary)
                  : { ...itinerary, ...patch };
              return { ...updated, updatedAt: now() };
            }),
          })),

        remove: (id) => {
          const project = get().projects.find((p) => p.id === id);
          const result = commitProjects(get().projects.filter((p) => p.id !== id));
          if (result.ok) {
            const user = useAuthStore.getState().user;
            logActivity(id, "deleted", `Deleted project "${project?.name ?? id}"`, user);
          }
          return result;
        },

        duplicate: (id) => {
          const original = get().projects.find((project) => project.id === id);
          if (!original) return undefined;
          const timestamp = now();
          const copy: Project = {
            ...original,
            id: crypto.randomUUID(),
            name: `${original.name} (Copy)`,
            status: "Draft",
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          const result = commitProjects([copy, ...get().projects]);
          if (result.ok) {
            const user = useAuthStore.getState().user;
            logActivity(copy.id, "duplicated", `Duplicated from "${original.name}"`, user);
          }
          return result.ok ? copy : undefined;
        },

        getById: (id) =>
          get().projects.find((project) => project.id === id),

        importProject: (raw) => {
          const parsed = normalizeProject(raw);
          const existingIds = new Set(
            get().projects.map((project) => project.id),
          );
          const project: Project = existingIds.has(parsed.id)
            ? { ...parsed, id: crypto.randomUUID(), updatedAt: now() }
            : parsed;
          const result = commitProjects([project, ...get().projects]);
          if (!result.ok) throw new Error(result.error);
          const user = useAuthStore.getState().user;
          logActivity(project.id, "imported", `Imported project "${project.name}"`, user);
          return project;
        },
      };
    },
    {
      name: "routecrafter:v1",
      version: CURRENT_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedSlice => ({
        projects: state.projects,
        initialized: state.initialized,
      }),
      migrate: (persistedState) => normalizePersistedProjects(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizePersistedProjects(persistedState),
      }),
      onRehydrateStorage: () => (state, error) => {
        if (state) {
          state.hydrateSeeds();
          if (error) {
            queueMicrotask(() =>
              useProjectsStore.setState({
                persistenceError: storageErrorMessage(error),
              }),
            );
          }
          state.setHasHydrated(true);
          return;
        }

        queueMicrotask(() =>
          useProjectsStore.setState({
            projects: seedProjects,
            initialized: true,
            hasHydrated: true,
            persistenceError: storageErrorMessage(error),
          }),
        );
      },
    },
  ),
);
