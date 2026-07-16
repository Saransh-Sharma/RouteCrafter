import { create as createZustand } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CURRENT_SCHEMA_VERSION,
  type ItineraryOutput,
  type PlannedEdition,
  type Project,
  type Template,
} from "../schemas";
import {
  normalizePersistedProjects,
  normalizeProject,
} from "../project-normalization";
import { seedProjects } from "../seed-projects";
import { logActivity } from "./activity-store";
import { useAuthStore } from "./auth-store";
import {
  createProjectCommand,
  createProjectFromTemplateCommand,
  duplicateEditionCommand,
  duplicateProjectCommand,
  importProjectCommand,
  patchItineraryCommand,
  persistedStateSize,
  removeDuplicatedEditionCommand,
  updateProjectCommand,
  type CreateProjectFromTemplateInput,
  type CreateProjectInput,
  type DuplicateEditionOptions,
  type ExpandHint,
  type MutationResult,
  type PersistedProjectsSlice,
} from "../projects/project-commands";
import { projectUpdateDetail } from "../projects/project-change-detail";
import {
  createProjectSyncController,
  type ProjectConflict,
} from "../projects/project-sync-controller";

export const MAX_PERSISTED_STATE_CHARS = 4_000_000;
const PROJECTS_STORAGE_KEY = "routecrafter:v1";
const HYDRATION_ERROR_MESSAGE =
  "RouteCrafter reset your local project cache because the saved browser data could not be loaded.";

export type {
  CreateProjectFromTemplateInput,
  CreateProjectInput,
  DuplicateEditionOptions,
  ExpandHint,
  MutationResult,
  ProjectConflict,
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SaveState {
  status: SaveStatus;
  error: string | null;
}

interface ProjectsState extends PersistedProjectsSlice {
  hasHydrated: boolean;
  cloudHydrated: boolean;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  syncError: string | null;
  saveState: SaveState;
  lastCloudRevisionByProject: Record<string, number>;
  conflictByProject: Record<string, ProjectConflict>;
  persistenceError: string | null;
  setHasHydrated: (value: boolean) => void;
  hydrateCloudProjects: () => Promise<void>;
  refreshFromCloud: () => Promise<void>;
  refreshProject: (id: string) => Promise<void>;
  resolveConflictReload: (id: string) => void;
  resolveConflictOverwrite: (id: string) => void;
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
  duplicateEdition: (
    projectId: string,
    editionId: string,
    options?: DuplicateEditionOptions,
  ) => PlannedEdition | undefined;
  removeDuplicatedEdition: (
    projectId: string,
    editionId: string,
  ) => MutationResult;
  createProjectFromTemplate: (
    template: Template,
    input: CreateProjectFromTemplateInput,
  ) => Project;
  createFromTemplate: (template: Template, name?: string) => Project;
  getById: (id: string) => Project | undefined;
  importProject: (project: unknown) => Project;
  expandHint: ExpandHint | null;
  setExpandHint: (hint: ExpandHint | null) => void;
  clearPersistenceError: () => void;
}

export { persistedStateSize };

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

function dispatchSaveState(status: SaveStatus, error?: string | null): void {
  useProjectsStore.setState({
    saveState: { status, error: error ?? null },
  });
  // Legacy window event, kept until all listeners move to useSyncStatus().
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("routecrafter:save-state", {
      detail: { status, error },
    }),
  );
}

/**
 * Save/sync indicator state for the current workspace. Preferred over
 * subscribing to the legacy "routecrafter:save-state" window event.
 */
export function useSyncStatus(): SaveState {
  return useProjectsStore((state) => state.saveState);
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

      const syncController = createProjectSyncController({
        getStateSnapshot: () => useProjectsStore.getState(),
        setSyncState: (update) => {
          if (typeof update === "function") {
            set((current) => update(current));
            return;
          }
          set(update);
        },
        commitProjects,
        hasUser: () => Boolean(useAuthStore.getState().user),
        dispatchSaveState,
      });

      return {
        projects: [],
        initialized: false,
        hasHydrated: false,
        cloudHydrated: false,
        syncStatus: "idle",
        syncError: null,
        saveState: { status: "idle", error: null },
        lastCloudRevisionByProject: {},
        conflictByProject: {},
        persistenceError: null,
        expandHint: null,

        setHasHydrated: (value) => set({ hasHydrated: value }),
        setExpandHint: (hint) => set({ expandHint: hint }),
        clearPersistenceError: () => set({ persistenceError: null }),

        hydrateCloudProjects: () => syncController.hydrateCloudProjects(),

        refreshFromCloud: () => syncController.refreshFromCloud(),

        refreshProject: (id) => syncController.refreshProject(id),

        resolveConflictReload: (id) => {
          const conflict = get().conflictByProject[id];
          if (!conflict) return;
          // Discard the stale local snapshot so it is not re-synced later.
          syncController.clearProjectQueue(id);
          if (conflict.kind === "deleted") {
            // "Discard": the project is gone in cloud, so drop the local copy and
            // stop tracking its revision.
            commitProjects(get().projects.filter((p) => p.id !== id));
            set((current) => {
              const conflicts = { ...current.conflictByProject };
              delete conflicts[id];
              const revisions = { ...current.lastCloudRevisionByProject };
              delete revisions[id];
              return {
                conflictByProject: conflicts,
                lastCloudRevisionByProject: revisions,
                syncStatus: "synced",
                syncError: null,
              };
            });
            return;
          }
          const exists = get().projects.some((p) => p.id === id);
          commitProjects(
            exists
              ? get().projects.map((p) =>
                  p.id === id ? conflict.cloudProject : p,
                )
              : [conflict.cloudProject, ...get().projects],
          );
          set((current) => {
            const conflicts = { ...current.conflictByProject };
            delete conflicts[id];
            return {
              conflictByProject: conflicts,
              lastCloudRevisionByProject: {
                ...current.lastCloudRevisionByProject,
                [id]: conflict.cloudRevision,
              },
              syncStatus: "synced",
              syncError: null,
            };
          });
        },

        resolveConflictOverwrite: (id) => {
          const conflict = get().conflictByProject[id];
          if (!conflict) return;
          const kind = conflict.kind;
          set((current) => {
            const conflicts = { ...current.conflictByProject };
            delete conflicts[id];
            return {
              conflictByProject: conflicts,
              // The 409 handler already set this to the latest cloud revision; the
              // next write uses it as expectedRevision to win the last-write race.
              lastCloudRevisionByProject: {
                ...current.lastCloudRevisionByProject,
                [id]: conflict.cloudRevision,
              },
            };
          });
          if (kind === "delete") {
            // User chose "Delete anyway": drop the reverted copy locally again and
            // retry the cloud delete at the latest revision.
            const project = get().projects.find((p) => p.id === id);
            const result = commitProjects(get().projects.filter((p) => p.id !== id));
            if (result.ok) {
              const user = useAuthStore.getState().user;
              logActivity(
                id,
                "deleted",
                `Deleted project "${project?.name ?? id}"`,
                user,
              );
              void syncController.syncDeleteProject(id);
            }
            return;
          }
          if (kind === "deleted") {
            // User chose "Restore": re-create the deleted project in cloud from the
            // local copy via the revive path (restore flag).
            const project = get().projects.find((p) => p.id === id);
            if (project) {
              void syncController.syncProjectSnapshot(
                project,
                "restored project",
                "PUT",
                true,
              );
            }
            return;
          }
          syncController.enqueueProjectSync(
            id,
            "overwrote cloud with local changes",
            "PUT",
          );
        },

        hydrateSeeds: () => {
          if (!get().initialized) {
            commitProjects(seedProjects);
          }
        },

        create: (input) => {
          const { project, activityDetail } = createProjectCommand(
            input,
            get().projects.length,
          );
          const result = commitProjects([project, ...get().projects]);
          if (!result.ok) throw new Error(result.error);
          const user = useAuthStore.getState().user;
          logActivity(project.id, "created", activityDetail, user);
          syncController.enqueueProjectSync(project.id, activityDetail, "POST");
          return project;
        },

        update: (id, patch) =>
          get().updateProject(id, (project) => ({ ...project, ...patch })),

        updateProject: (id, updater) => {
          const previousProject = get().projects.find((project) => project.id === id);
          const projects = get().projects.map((project) =>
            project.id === id ? updateProjectCommand(project, updater) : project,
          );
          const result = commitProjects(projects);
          if (result.ok) {
            const user = useAuthStore.getState().user;
            const project = get().projects.find((p) => p.id === id);
            const detail = projectUpdateDetail(previousProject, project);
            logActivity(id, "updated", detail, user);
            if (project) syncController.enqueueProjectSync(project.id, detail, "PUT");
          }
          return result;
        },

        patchItinerary: (projectId, itineraryId, patch) =>
          get().updateProject(projectId, (project) =>
            patchItineraryCommand(project, itineraryId, patch),
          ),

        remove: (id) => {
          const project = get().projects.find((p) => p.id === id);
          const result = commitProjects(get().projects.filter((p) => p.id !== id));
          if (result.ok) {
            const user = useAuthStore.getState().user;
            logActivity(id, "deleted", `Deleted project "${project?.name ?? id}"`, user);
            void syncController.syncDeleteProject(id);
          }
          return result;
        },

        duplicate: (id) => {
          const original = get().projects.find((project) => project.id === id);
          if (!original) return undefined;
          const { project: copy, activityDetail } = duplicateProjectCommand(original);
          const result = commitProjects([copy, ...get().projects]);
          if (result.ok) {
            const user = useAuthStore.getState().user;
            logActivity(copy.id, "duplicated", activityDetail, user);
            syncController.enqueueProjectSync(copy.id, activityDetail, "POST");
          }
          return result.ok ? copy : undefined;
        },

        duplicateEdition: (projectId, editionId, options = {}) => {
          const project = get().projects.find((item) => item.id === projectId);
          if (!project) return undefined;
          const duplicated = duplicateEditionCommand(project, editionId, options);
          if (!duplicated) return undefined;
          const result = get().updateProject(projectId, () => duplicated.project);
          return result.ok ? duplicated.edition : undefined;
        },

        removeDuplicatedEdition: (projectId, editionId) => {
          const project = get().projects.find((item) => item.id === projectId);
          if (!project) {
            return { ok: false, error: "Edition not found." };
          }
          const removed = removeDuplicatedEditionCommand(project, editionId);
          const nextProject = removed.project;
          if (!removed.ok || !nextProject) return removed;
          return get().updateProject(projectId, () => nextProject);
        },

        createProjectFromTemplate: (template, input) => {
          const { project, activityDetail } = createProjectFromTemplateCommand(
            template,
            input,
          );
          const result = commitProjects([project, ...get().projects]);
          if (!result.ok) throw new Error(result.error);
          const user = useAuthStore.getState().user;
          logActivity(project.id, "created", activityDetail, user);
          syncController.enqueueProjectSync(project.id, activityDetail, "POST");
          return project;
        },

        createFromTemplate: (template, name) =>
          get().createProjectFromTemplate(template, { name }),

        getById: (id) =>
          get().projects.find((project) => project.id === id),

        importProject: (raw) => {
          const { project, activityDetail } = importProjectCommand(
            raw,
            get().projects,
          );
          const result = commitProjects([project, ...get().projects]);
          if (!result.ok) throw new Error(result.error);
          const user = useAuthStore.getState().user;
          logActivity(project.id, "imported", activityDetail, user);
          syncController.enqueueProjectSync(project.id, activityDetail, "POST");
          return project;
        },
      };
    },
    {
      name: PROJECTS_STORAGE_KEY,
      version: CURRENT_SCHEMA_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state): PersistedProjectsSlice => ({
        projects: state.projects,
        initialized: state.initialized,
      }),
      migrate: (persistedState) => normalizePersistedProjects(persistedState),
      merge: (persistedState, currentState) => {
        if (persistedState == null) {
          return currentState;
        }

        return {
          ...currentState,
          ...normalizePersistedProjects(persistedState),
        };
      },
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
