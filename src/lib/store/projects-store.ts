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
const PROJECTS_STORAGE_KEY = "routecrafter:v1";
const HYDRATION_ERROR_MESSAGE =
  "RouteCrafter reset your local project cache because the saved browser data could not be loaded.";

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

const PROJECT_UPDATE_FIELD_LABELS = {
  name: "name",
  country: "country",
  regions: "regions",
  positioning: "positioning",
  targetAudience: "target audience",
  travelStyles: "travel styles",
  travelerTypes: "traveler types",
  durations: "durations",
  deliverables: "deliverables",
  brandStyle: "brand style",
  tripConfigs: "trip configuration",
  imagePrompts: "image prompts",
  matrix: "itinerary matrix",
  itineraries: "itineraries",
  listing: "marketplace listing",
  generated: "generated prompts",
  aiRuns: "AI runs",
  status: "status",
  accent: "accent",
} satisfies Partial<Record<keyof Project, string>>;

function valuesDiffer(previous: unknown, next: unknown): boolean {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

function formatFieldList(fields: string[]): string {
  if (fields.length === 0) return "project details";
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields.at(-1)}`;
}

function projectUpdateDetail(
  previous: Project | undefined,
  next: Project | undefined,
): string {
  if (!previous || !next) return "updated project details";

  const changedFields = Object.entries(PROJECT_UPDATE_FIELD_LABELS)
    .filter(([field]) =>
      valuesDiffer(
        previous[field as keyof Project],
        next[field as keyof Project],
      ),
    )
    .map(([, label]) => label);

  return `updated ${formatFieldList(changedFields)}`;
}

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

function hydrationErrorMessage(error?: unknown): string {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  ) {
    return "Browser storage is full. RouteCrafter loaded seed projects, but your local project cache could not be saved.";
  }
  return HYDRATION_ERROR_MESSAGE;
}

function clearPersistedProjectsStorage(): void {
  try {
    window.localStorage.removeItem(PROJECTS_STORAGE_KEY);
  } catch {
    // If browser storage is blocked, keep the in-memory recovery state.
  }
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
          const previousProject = get().projects.find((project) => project.id === id);
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
            const project = get().projects.find((p) => p.id === id);
            logActivity(id, "updated", projectUpdateDetail(previousProject, project), user);
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
      name: PROJECTS_STORAGE_KEY,
      version: CURRENT_SCHEMA_VERSION,
      storage: createJSONStorage(() => window.localStorage),
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
            clearPersistedProjectsStorage();
            queueMicrotask(() =>
              useProjectsStore.setState({
                persistenceError: hydrationErrorMessage(error),
              }),
            );
          }
          state.setHasHydrated(true);
          return;
        }

        clearPersistedProjectsStorage();
        queueMicrotask(() =>
          useProjectsStore.setState({
            projects: seedProjects,
            initialized: true,
            hasHydrated: true,
            persistenceError: hydrationErrorMessage(error),
          }),
        );
      },
    },
  ),
);
