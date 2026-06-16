import { create as createZustand } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CURRENT_SCHEMA_VERSION,
  projectSchema,
  type Duration,
  type ItineraryOutput,
  type OfferModel,
  type OutputRequirement,
  type Project,
  type SalesChannel,
  type TravelerType,
} from "../schemas";
import {
  normalizePersistedProjects,
  normalizeProject,
} from "../project-normalization";
import { seedProjects } from "../seed-projects";
import { logActivity } from "./activity-store";
import { useAuthStore } from "./auth-store";
import { readinessFingerprint } from "../workflow";
import { isCloudPersistenceEnabled } from "../persistence/config";
import type { CloudProject } from "../persistence/types";

export const MAX_PERSISTED_STATE_CHARS = 4_000_000;
const PROJECTS_STORAGE_KEY = "routecrafter:v1";
const HYDRATION_ERROR_MESSAGE =
  "RouteCrafter reset your local project cache because the saved browser data could not be loaded.";
type ProjectSyncMethod = "POST" | "PUT";

interface ProjectSyncQueueItem {
  inFlight: boolean;
  pending:
    | {
        project: Project;
        activityDetail: string;
        method: ProjectSyncMethod;
      }
    | null;
}

const projectSyncQueue = new Map<string, ProjectSyncQueueItem>();

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
  offerModel?: OfferModel;
  channels?: SalesChannel[];
  outputs?: OutputRequirement[];
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
  productionPlan: "production plan",
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
  cloudHydrated: boolean;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  syncError: string | null;
  lastCloudRevisionByProject: Record<string, number>;
  persistenceError: string | null;
  setHasHydrated: (value: boolean) => void;
  hydrateCloudProjects: () => Promise<void>;
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

function dispatchSaveState(
  status: "saving" | "saved" | "error",
  error?: string | null,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("routecrafter:save-state", {
      detail: { status, error },
    }),
  );
}

function cloudProjectsToRevisionMap(projects: CloudProject[]): Record<string, number> {
  return Object.fromEntries(
    projects.map((item) => [item.project.id, item.revision]),
  );
}

function isSeedOnly(projects: Project[]): boolean {
  if (projects.length !== seedProjects.length) return false;
  const seedIds = new Set(seedProjects.map((project) => project.id));
  return projects.every((project) => seedIds.has(project.id));
}

async function readCloudResponse(response: Response): Promise<{
  error?: string;
  project?: CloudProject;
  projects?: CloudProject[];
}> {
  try {
    return await response.json();
  } catch {
    return {};
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
        cloudHydrated: false,
        syncStatus: "idle",
        syncError: null,
        lastCloudRevisionByProject: {},
        persistenceError: null,
        expandHint: null,

        setHasHydrated: (value) => set({ hasHydrated: value }),
        setExpandHint: (hint) => set({ expandHint: hint }),
        clearPersistenceError: () => set({ persistenceError: null }),

        hydrateCloudProjects: async () => {
          if (!isCloudPersistenceEnabled()) {
            set({ cloudHydrated: true, syncStatus: "idle", syncError: null });
            return;
          }
          const user = useAuthStore.getState().user;
          if (!user) {
            set({ cloudHydrated: true, syncStatus: "idle", syncError: null });
            return;
          }
          set({ syncStatus: "syncing", syncError: null });
          dispatchSaveState("saving");
          try {
            const response = await fetch("/api/projects", {
              credentials: "include",
              headers: { Accept: "application/json" },
            });
            const body = await readCloudResponse(response);
            if (!response.ok) throw new Error(body.error ?? "Could not load cloud projects.");
            const cloudProjects = body.projects ?? [];
            if (cloudProjects.length > 0) {
              set({
                projects: cloudProjects.map((item) => normalizeProject(item.project)),
                initialized: true,
                cloudHydrated: true,
                syncStatus: "synced",
                syncError: null,
                lastCloudRevisionByProject: cloudProjectsToRevisionMap(cloudProjects),
              });
              dispatchSaveState("saved");
              return;
            }

            const localProjects = get().projects;
            if (localProjects.length > 0 && !isSeedOnly(localProjects)) {
              const syncResponse = await fetch("/api/projects/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ projects: localProjects }),
              });
              const syncBody = await readCloudResponse(syncResponse);
              if (!syncResponse.ok) {
                throw new Error(syncBody.error ?? "Could not migrate local projects.");
              }
              const synced = syncBody.projects ?? [];
              set({
                projects: synced.map((item) => normalizeProject(item.project)),
                initialized: true,
                cloudHydrated: true,
                syncStatus: "synced",
                syncError: null,
                lastCloudRevisionByProject: cloudProjectsToRevisionMap(synced),
              });
              dispatchSaveState("saved");
              return;
            }

            set({
              cloudHydrated: true,
              syncStatus: "synced",
              syncError: null,
              lastCloudRevisionByProject: {},
            });
            dispatchSaveState("saved");
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Cloud sync failed.";
            set({
              cloudHydrated: true,
              syncStatus: "error",
              syncError: message,
              persistenceError: message,
            });
            dispatchSaveState("error", message);
          }
        },

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
            productionPlan: {
              offerModel: input.offerModel ?? "digital",
              channels: input.channels ?? ["etsy"],
              outputs: input.outputs ?? ["marketplace-listing", "pdf"],
              editions: [],
              review: {
                liveDataVerified: false,
                presentationReviewed: false,
                backupConfirmed: false,
              },
            },
            accent,
            status: "Draft",
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          const result = commitProjects([project, ...get().projects]);
          if (!result.ok) throw new Error(result.error);
          const user = useAuthStore.getState().user;
          logActivity(project.id, "created", `Created project "${project.name}"`, user);
          enqueueProjectSync(project.id, `Created project "${project.name}"`, "POST");
          return project;
        },

        update: (id, patch) =>
          get().updateProject(id, (project) => ({ ...project, ...patch })),

        updateProject: (id, updater) => {
          const previousProject = get().projects.find((project) => project.id === id);
          const projects = get().projects.map((project) =>
            project.id === id
              ? (() => {
                  const updated = updater(project);
                  const readinessChanged =
                    readinessFingerprint(project) !==
                    readinessFingerprint(updated);
                  return {
                    ...updated,
                    productionPlan: readinessChanged
                      ? {
                          ...updated.productionPlan,
                          review: {
                            liveDataVerified: false,
                            presentationReviewed: false,
                            backupConfirmed: false,
                          },
                        }
                      : updated.productionPlan,
                    status:
                      readinessChanged && project.status === "Ready to sell"
                        ? "In progress"
                        : updated.status,
                    id: project.id,
                    updatedAt: now(),
                  };
                })()
              : project,
          );
          const result = commitProjects(projects);
          if (result.ok) {
            const user = useAuthStore.getState().user;
            const project = get().projects.find((p) => p.id === id);
            const detail = projectUpdateDetail(previousProject, project);
            logActivity(id, "updated", detail, user);
            if (project) enqueueProjectSync(project.id, detail, "PUT");
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
            void syncDeleteProject(id);
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
            productionPlan: {
              ...original.productionPlan,
              review: {
                liveDataVerified: false,
                presentationReviewed: false,
                backupConfirmed: false,
              },
            },
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          const result = commitProjects([copy, ...get().projects]);
          if (result.ok) {
            const user = useAuthStore.getState().user;
            logActivity(copy.id, "duplicated", `Duplicated from "${original.name}"`, user);
            enqueueProjectSync(copy.id, `Duplicated from "${original.name}"`, "POST");
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
          enqueueProjectSync(project.id, `Imported project "${project.name}"`, "POST");
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

function enqueueProjectSync(
  projectId: string,
  activityDetail: string,
  method: ProjectSyncMethod,
): void {
  if (!isCloudPersistenceEnabled()) return;
  const project = useProjectsStore
    .getState()
    .projects.find((item) => item.id === projectId);
  if (!project) return;
  const item = projectSyncQueue.get(projectId) ?? {
    inFlight: false,
    pending: null,
  };
  item.pending = {
    project,
    activityDetail:
      activityDetail || item.pending?.activityDetail || "updated project details",
    method: method === "POST" || item.pending?.method === "POST" ? "POST" : "PUT",
  };
  projectSyncQueue.set(projectId, item);
  if (!item.inFlight) {
    void processProjectSyncQueue(projectId);
  }
}

async function processProjectSyncQueue(projectId: string): Promise<void> {
  const item = projectSyncQueue.get(projectId);
  if (!item || item.inFlight) return;
  item.inFlight = true;
  try {
    while (item.pending) {
      const next = item.pending;
      item.pending = null;
      await syncProjectSnapshot(next.project, next.activityDetail, next.method);
    }
  } catch {
    item.pending = null;
  } finally {
    item.inFlight = false;
    if (item.pending) {
      void processProjectSyncQueue(projectId);
    } else {
      projectSyncQueue.delete(projectId);
    }
  }
}

async function syncProjectSnapshot(
  project: Project,
  activityDetail: string,
  method: ProjectSyncMethod,
): Promise<void> {
  if (!isCloudPersistenceEnabled()) return;
  const user = useAuthStore.getState().user;
  if (!user || typeof fetch === "undefined") return;
  const state = useProjectsStore.getState();
  const expectedRevision = state.lastCloudRevisionByProject[project.id];
  useProjectsStore.setState({ syncStatus: "syncing", syncError: null });
  dispatchSaveState("saving");
  try {
    const url = method === "POST" ? "/api/projects" : `/api/projects/${project.id}`;
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ project, expectedRevision, activityDetail }),
    });
    const body = await readCloudResponse(response);
    if (response.status === 409) {
      await fetch(`/api/projects/${project.id}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      }).catch(() => undefined);
      throw new Error(
        "Cloud has newer changes for this project. Review the latest cloud version before saving again.",
      );
    }
    if (!response.ok || !body.project) {
      throw new Error(body.error ?? "Could not sync project to cloud.");
    }
    useProjectsStore.setState((current) => ({
      syncStatus: "synced",
      syncError: null,
      lastCloudRevisionByProject: {
        ...current.lastCloudRevisionByProject,
        [body.project!.project.id]: body.project!.revision,
      },
    }));
    dispatchSaveState("saved");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloud sync failed.";
    useProjectsStore.setState({
      syncStatus: "error",
      syncError: message,
      persistenceError: message,
    });
    dispatchSaveState("error", message);
    throw error;
  }
}

async function syncDeleteProject(projectId: string): Promise<void> {
  if (!isCloudPersistenceEnabled()) return;
  const user = useAuthStore.getState().user;
  if (!user || typeof fetch === "undefined") return;
  useProjectsStore.setState({ syncStatus: "syncing", syncError: null });
  dispatchSaveState("saving");
  try {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      const body = await readCloudResponse(response);
      throw new Error(body.error ?? "Could not delete cloud project.");
    }
    useProjectsStore.setState((current) => {
      const next = { ...current.lastCloudRevisionByProject };
      delete next[projectId];
      return {
        syncStatus: "synced",
        syncError: null,
        lastCloudRevisionByProject: next,
      };
    });
    dispatchSaveState("saved");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloud sync failed.";
    useProjectsStore.setState({
      syncStatus: "error",
      syncError: message,
      persistenceError: message,
    });
    dispatchSaveState("error", message);
  }
}
