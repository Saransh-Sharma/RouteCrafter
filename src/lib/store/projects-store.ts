import { create as createZustand } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  CURRENT_SCHEMA_VERSION,
  projectSchema,
  type Duration,
  type ItineraryOutput,
  type OfferModel,
  type OutputRequirement,
  type PlannedEdition,
  type Project,
  type RouteStop,
  type SalesChannel,
  type Template,
  type TravelerType,
} from "../schemas";
import {
  normalizePersistedProjects,
  normalizeProject,
} from "../project-normalization";
import { seedProjects } from "../seed-projects";
import { logActivity } from "./activity-store";
import { useAuthStore } from "./auth-store";
import { normalizeRoute, readinessFingerprint } from "../workflow";
import { syncItineraryToRoute } from "../generation/route-sync";
import { realignItineraryDurationText } from "../generation/itinerary";
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
  /** Consecutive transient (non-conflict) sync failures, used for backoff. */
  retryCount: number;
}

const projectSyncQueue = new Map<string, ProjectSyncQueueItem>();

/** Max automatic retries for a transient sync failure before giving up. */
const MAX_SYNC_RETRIES = 4;

/**
 * Guards against overlapping background refreshes. A slow poll must not stack on
 * the next interval/focus tick, which would multiply request load and risk
 * out-of-order merges.
 */
let refreshFromCloudInFlight = false;

/**
 * Set for the rest of the session when a cloud call returns 503 (no DATABASE_URL).
 * The shared workspace defaults cloud-on, so a DB-less environment (local dev,
 * preview, CI) must degrade to local-only instead of hammering the backend and
 * surfacing a scary persistence error on every interaction.
 */
let cloudUnavailable = false;

/** Flip to local-only mode when a cloud response signals the DB is unconfigured. */
function noteCloudResponse(response: Response): void {
  if (response.status === 503) cloudUnavailable = true;
}

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
  brandStyle?: Partial<Project["brandStyle"]>;
  offerModel?: OfferModel;
  channels?: SalesChannel[];
  outputs?: OutputRequirement[];
  accent?: Project["accent"];
  sourceTemplateId?: string;
  sourceTemplateName?: string;
}

export interface CreateProjectFromTemplateInput
  extends Omit<CreateProjectInput, "name"> {
  name?: string;
  voice?: Project["brandStyle"]["voice"];
}

export interface DuplicateEditionOptions {
  duration?: Duration;
  customDays?: number;
  keepGuides?: boolean;
  /** Deprecated: listing copy is project-scoped and must not be mutated by edition cloning. */
  keepListingCopy?: boolean;
  /** Deprecated: brand voice is project-scoped and must not be mutated by edition cloning. */
  keepBrandVoice?: boolean;
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

function now() {
  return new Date().toISOString();
}

function dayCountForDuration(duration: Duration, customDays?: number): number {
  return customDays ?? Number.parseInt(duration, 10);
}

function resizeRoute(route: RouteStop[], dayCount: number): RouteStop[] {
  if (!route.length || dayCount < 1) return route;
  const total = route.reduce((sum, stop) => sum + Math.max(stop.nights, 0), 0);
  if (total <= 0) {
    return normalizeRoute(
      route.map((stop, index) => ({
        ...stop,
        nights: index === 0 ? dayCount : 0,
      })),
    );
  }
  let placed = 0;
  const resized = route.map((stop, index) => {
    const isLast = index === route.length - 1;
    const nights = isLast
      ? Math.max(0, dayCount - placed)
      : Math.max(0, Math.round((stop.nights / total) * dayCount));
    placed += nights;
    return { ...stop, nights };
  });
  if (placed === 0 && resized[0]) resized[0] = { ...resized[0], nights: dayCount };
  let remaining = dayCount - resized.reduce((sum, stop) => sum + stop.nights, 0);
  if (remaining > 0 && resized[resized.length - 1]) {
    const last = resized[resized.length - 1];
    resized[resized.length - 1] = { ...last, nights: last.nights + remaining };
    remaining = 0;
  }
  if (remaining < 0) {
    for (let index = resized.length - 1; index >= 0 && remaining < 0; index -= 1) {
      const stop = resized[index];
      const reduction = Math.min(stop.nights, Math.abs(remaining));
      resized[index] = { ...stop, nights: stop.nights - reduction };
      remaining += reduction;
    }
  }
  return normalizeRoute(resized);
}

function cloneItineraryForEdition({
  itinerary,
  edition,
  timestamp,
  keepGuides,
}: {
  itinerary: ItineraryOutput;
  edition: PlannedEdition;
  timestamp: string;
  keepGuides: boolean;
}): ItineraryOutput {
  const duration = edition.customDays
    ? `${edition.customDays} days`
    : edition.duration;
  const cloned: ItineraryOutput = {
    ...itinerary,
    id: crypto.randomUUID(),
    plannedEditionId: edition.id,
    duration,
    travelerType: edition.travelerType,
    subtitle: `${edition.travelerType} - ${itinerary.style ?? "Custom"} - ${itinerary.budget}`,
    foodGuide: keepGuides ? itinerary.foodGuide : "",
    transportGuide: keepGuides ? itinerary.transportGuide : "",
    packingList: keepGuides ? itinerary.packingList : "",
    etiquetteSafety: keepGuides ? itinerary.etiquetteSafety : "",
    bookingChecklist: keepGuides ? itinerary.bookingChecklist : "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  // The source label (e.g. "7 days") is still embedded in the copied title and
  // overview prose; rewrite those occurrences to the new edition's duration.
  const realigned = realignItineraryDurationText(cloned, itinerary.duration);
  return syncItineraryToRoute(realigned, edition.route).next;
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
  status: "idle" | "saving" | "saved" | "error",
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

function mergeLocalAndCloudProjects({
  localProjects,
  cloudProjects,
}: {
  localProjects: Project[];
  cloudProjects: CloudProject[];
}): Project[] {
  const cloudById = new Map(
    cloudProjects.map((item) => [item.project.id, normalizeProject(item.project)]),
  );
  const merged = localProjects.map((local) => cloudById.get(local.id) ?? local);
  const localIds = new Set(localProjects.map((project) => project.id));
  for (const cloud of cloudProjects) {
    if (!localIds.has(cloud.project.id)) {
      merged.push(normalizeProject(cloud.project));
    }
  }
  return merged.sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function isSeedOnly(projects: Project[]): boolean {
  if (projects.length !== seedProjects.length) return false;
  const seedIds = new Set(seedProjects.map((project) => project.id));
  return projects.every((project) => seedIds.has(project.id));
}

/**
 * A project is "dirty" when it has a pending or in-flight cloud sync. Background
 * refetches must never clobber dirty projects, otherwise local edits are lost.
 */
function isProjectDirty(projectId: string): boolean {
  const item = projectSyncQueue.get(projectId);
  return Boolean(item && (item.inFlight || item.pending));
}

/**
 * Reconcile a set of changed cloud projects into the local cache. Used by the
 * cheap poll, which only fetches the full bodies that actually changed:
 * - dirty projects keep their local copy (pending edits win until synced),
 * - clean projects adopt a fetched cloud copy, but only when its revision did
 *   not regress below the last known revision (guards read-replica lag and
 *   in-flight writes from overwriting fresher local state),
 * - clean projects whose id is absent from the cloud revision set were deleted
 *   by another user and are dropped,
 * - fetched cloud projects not present locally are added.
 */
function reconcileCloudChanges({
  localProjects,
  changedById,
  cloudIds,
  knownRevisions,
}: {
  localProjects: Project[];
  changedById: Map<string, CloudProject>;
  cloudIds: Set<string>;
  knownRevisions: Record<string, number>;
}): Project[] {
  const result: Project[] = [];
  for (const local of localProjects) {
    if (isProjectDirty(local.id)) {
      result.push(local);
      continue;
    }
    if (!cloudIds.has(local.id)) {
      // Clean and absent from cloud => deleted elsewhere; drop it.
      continue;
    }
    const changed = changedById.get(local.id);
    if (!changed) {
      // Present in cloud but unchanged (not refetched); keep the local copy.
      result.push(local);
      continue;
    }
    const known = knownRevisions[local.id];
    if (known !== undefined && changed.revision < known) {
      // Stale read: keep the locally known (newer) copy.
      result.push(local);
      continue;
    }
    result.push(normalizeProject(changed.project));
  }
  const localIds = new Set(localProjects.map((project) => project.id));
  for (const [id, cloud] of changedById) {
    if (!localIds.has(id)) {
      result.push(normalizeProject(cloud.project));
    }
  }
  return result.sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export interface ProjectConflict {
  projectId: string;
  cloudProject: Project;
  cloudRevision: number;
  updatedByName: string | null;
  /**
   * "update": a local edit lost the last-write race.
   * "delete": a local delete was rejected because the project changed in cloud.
   * "deleted": the project was deleted by another user while we were editing it.
   */
  kind: "update" | "delete" | "deleted";
}

/** Lightweight shape returned by `GET /api/projects/revisions` for cheap polling. */
interface ProjectRevisionSummary {
  id: string;
  revision: number;
  updatedAt: string;
}

/** Thrown when a cloud write is rejected because the project has newer changes. */
class ProjectSyncConflictError extends Error {}

async function readCloudResponse(response: Response): Promise<{
  error?: string;
  project?: CloudProject;
  projects?: CloudProject[];
}> {
  noteCloudResponse(response);
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
        conflictByProject: {},
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
            const localProjects = get().projects;
            const cloudProjects = body.projects ?? [];
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
                projects: mergeLocalAndCloudProjects({
                  localProjects,
                  cloudProjects: synced,
                }),
                initialized: true,
                cloudHydrated: true,
                syncStatus: "synced",
                syncError: null,
                lastCloudRevisionByProject: cloudProjectsToRevisionMap(synced),
              });
              dispatchSaveState("saved");
              return;
            }

            if (cloudProjects.length > 0) {
              set({
                projects: mergeLocalAndCloudProjects({
                  localProjects,
                  cloudProjects,
                }),
                initialized: true,
                cloudHydrated: true,
                syncStatus: "synced",
                syncError: null,
                lastCloudRevisionByProject: cloudProjectsToRevisionMap(cloudProjects),
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
            if (cloudUnavailable) {
              // No DATABASE_URL: degrade to local-only instead of surfacing an
              // error. The cached local projects remain fully usable.
              set({
                cloudHydrated: true,
                syncStatus: "idle",
                syncError: null,
                persistenceError: null,
              });
              dispatchSaveState("idle");
              return;
            }
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

        refreshFromCloud: async () => {
          if (!isCloudPersistenceEnabled() || cloudUnavailable) return;
          const user = useAuthStore.getState().user;
          if (!user || typeof fetch === "undefined") return;
          if (refreshFromCloudInFlight) return;
          refreshFromCloudInFlight = true;
          try {
            // 1. Cheap revisions probe: tells us which ids actually changed
            // without transferring every project body on each poll.
            const response = await fetch("/api/projects/revisions", {
              credentials: "include",
              headers: { Accept: "application/json" },
            });
            if (!response.ok) return;
            const body = (await response.json().catch(() => null)) as {
              revisions?: ProjectRevisionSummary[];
            } | null;
            if (!body?.revisions) return;
            const cloudRevisions = body.revisions;
            const cloudIds = new Set(cloudRevisions.map((item) => item.id));
            const known = get().lastCloudRevisionByProject;
            const localProjects = get().projects;
            const localIds = new Set(localProjects.map((p) => p.id));

            // Ids that need a full fetch: new in cloud, or revision advanced.
            const changedIds = cloudRevisions
              .filter((item) => {
                if (isProjectDirty(item.id)) return false;
                const knownRevision = known[item.id];
                return (
                  !localIds.has(item.id) ||
                  knownRevision === undefined ||
                  item.revision > knownRevision
                );
              })
              .map((item) => item.id);

            // Clean local projects absent from cloud were deleted elsewhere.
            const deletedIds = localProjects
              .filter((p) => !isProjectDirty(p.id) && !cloudIds.has(p.id))
              .map((p) => p.id);

            if (changedIds.length === 0 && deletedIds.length === 0) {
              // Nothing changed: skip the body fetch, the merge, and the
              // localStorage rewrite + re-render entirely.
              if (!get().cloudHydrated) set({ cloudHydrated: true });
              return;
            }

            // 2. Only fetch the full bodies that changed.
            const fetched = await Promise.all(
              changedIds.map((id) =>
                fetch(`/api/projects/${id}`, {
                  credentials: "include",
                  headers: { Accept: "application/json" },
                })
                  .then(readCloudResponse)
                  .then((cloud) => cloud.project ?? null)
                  .catch(() => null),
              ),
            );
            const changedById = new Map<string, CloudProject>();
            for (const cloud of fetched) {
              if (cloud) changedById.set(cloud.project.id, cloud);
            }

            commitProjects(
              reconcileCloudChanges({
                localProjects: get().projects,
                changedById,
                cloudIds,
                knownRevisions: known,
              }),
            );
            set((current) => {
              const revisions = { ...current.lastCloudRevisionByProject };
              for (const cloud of changedById.values()) {
                // Never advance a dirty project's expected revision, and never
                // lower a known revision (stale read-replica responses).
                if (isProjectDirty(cloud.project.id)) continue;
                const knownRevision = revisions[cloud.project.id];
                if (knownRevision === undefined || cloud.revision >= knownRevision) {
                  revisions[cloud.project.id] = cloud.revision;
                }
              }
              for (const id of deletedIds) {
                delete revisions[id];
              }
              return {
                cloudHydrated: true,
                lastCloudRevisionByProject: revisions,
              };
            });
          } catch {
            // Background refresh is best-effort; keep the cached copy on failure.
          } finally {
            refreshFromCloudInFlight = false;
          }
        },

        refreshProject: async (id) => {
          if (!isCloudPersistenceEnabled() || cloudUnavailable) return;
          const user = useAuthStore.getState().user;
          if (!user || typeof fetch === "undefined") return;
          if (isProjectDirty(id)) return;
          try {
            const response = await fetch(`/api/projects/${id}`, {
              credentials: "include",
              headers: { Accept: "application/json" },
            });
            if (response.status === 404) {
              const remaining = get().projects.filter((p) => p.id !== id);
              if (remaining.length !== get().projects.length) {
                commitProjects(remaining);
              }
              return;
            }
            const body = await readCloudResponse(response);
            if (!response.ok || !body.project) return;
            if (isProjectDirty(id)) return;
            const cloudRevision = body.project.revision;
            const known = get().lastCloudRevisionByProject[id];
            // Guard against a stale read-replica response lowering fresh state.
            if (known !== undefined && cloudRevision < known) return;
            const cloud = normalizeProject(body.project.project);
            const exists = get().projects.some((p) => p.id === id);
            commitProjects(
              exists
                ? get().projects.map((p) => (p.id === id ? cloud : p))
                : [cloud, ...get().projects],
            );
            set((current) => ({
              lastCloudRevisionByProject: {
                ...current.lastCloudRevisionByProject,
                [id]: cloudRevision,
              },
            }));
          } catch {
            // Best-effort freshness on workspace open.
          }
        },

        resolveConflictReload: (id) => {
          const conflict = get().conflictByProject[id];
          if (!conflict) return;
          // Discard the stale local snapshot so it is not re-synced later.
          projectSyncQueue.delete(id);
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
              void syncDeleteProject(id);
            }
            return;
          }
          if (kind === "deleted") {
            // User chose "Restore": re-create the deleted project in cloud from the
            // local copy via the revive path (restore flag).
            const project = get().projects.find((p) => p.id === id);
            if (project) {
              void syncProjectSnapshot(project, "restored project", "PUT", true);
            }
            return;
          }
          enqueueProjectSync(id, "overwrote cloud with local changes", "PUT");
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
            brandStyle: input.brandStyle,
            accent,
            sourceTemplateId: input.sourceTemplateId,
            sourceTemplateName: input.sourceTemplateName,
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

        duplicateEdition: (projectId, editionId, options = {}) => {
          const project = get().projects.find((item) => item.id === projectId);
          const source = project?.productionPlan.editions.find(
            (edition) => edition.id === editionId,
          );
          if (!project || !source) return undefined;

          const timestamp = now();
          const duration = options.duration ?? source.duration;
          const customDays =
            options.customDays === undefined
              ? source.customDays
              : options.customDays;
          const dayCount = dayCountForDuration(duration, customDays);
          const edition: PlannedEdition = {
            ...source,
            id: crypto.randomUUID(),
            duration,
            customDays,
            route: resizeRoute(source.route, dayCount),
            itineraryId: undefined,
            sourceEditionId: source.id,
            lineageNote: `Copied from ${source.customDays ? `${source.customDays} days` : source.duration} · ${source.travelerType}`,
            createdAt: timestamp,
          };

          const linked = source.itineraryId
            ? project.itineraries.find((item) => item.id === source.itineraryId)
            : undefined;
          const clonedItinerary = linked
            ? cloneItineraryForEdition({
                itinerary: linked,
                edition,
                timestamp,
                keepGuides: options.keepGuides ?? true,
              })
            : undefined;
          const nextEdition = clonedItinerary
            ? { ...edition, itineraryId: clonedItinerary.id }
            : edition;

          const result = get().updateProject(projectId, (current) => ({
            ...current,
            productionPlan: {
              ...current.productionPlan,
              editions: current.productionPlan.editions.flatMap((item) =>
                item.id === source.id ? [item, nextEdition] : [item],
              ),
            },
            itineraries: clonedItinerary
              ? [...current.itineraries, clonedItinerary]
              : current.itineraries,
          }));
          return result.ok ? nextEdition : undefined;
        },

        removeDuplicatedEdition: (projectId, editionId) => {
          const project = get().projects.find((item) => item.id === projectId);
          const edition = project?.productionPlan.editions.find(
            (item) => item.id === editionId,
          );
          if (!project || !edition) {
            return { ok: false, error: "Edition not found." };
          }
          if (!edition.sourceEditionId) {
            return {
              ok: false,
              error: "Only duplicated editions can be removed with undo.",
            };
          }

          return get().updateProject(projectId, (current) => {
            const currentEdition = current.productionPlan.editions.find(
              (item) => item.id === editionId,
            );
            if (!currentEdition?.sourceEditionId) return current;
            return {
              ...current,
              productionPlan: {
                ...current.productionPlan,
                editions: current.productionPlan.editions.filter(
                  (item) => item.id !== editionId,
                ),
              },
              itineraries: currentEdition.itineraryId
                ? current.itineraries.filter(
                    (item) => item.id !== currentEdition.itineraryId,
                  )
                : current.itineraries,
            };
          });
        },

        createProjectFromTemplate: (template, input) => {
          const timestamp = now();
          const channels =
            input.channels ?? template.project.productionPlan.channels;
          const outputs = input.outputs ?? template.project.productionPlan.outputs;
          const project = projectSchema.parse({
            id: crypto.randomUUID(),
            name: input.name?.trim() || `${template.name} project`,
            country: input.country ?? template.project.country,
            regions: input.regions ?? template.project.regions,
            positioning: input.positioning ?? template.project.positioning,
            targetAudience:
              input.targetAudience ?? template.project.targetAudience,
            travelStyles: input.travelStyles ?? template.project.travelStyles,
            travelerTypes: input.travelerTypes ?? template.project.travelerTypes,
            durations: input.durations ?? template.project.durations,
            deliverables: input.deliverables ?? [],
            brandStyle: {
              ...template.project.brandStyle,
              ...input.brandStyle,
              voice:
                input.voice ??
                input.brandStyle?.voice ??
                template.project.brandStyle.voice,
            },
            tripConfigs: template.project.tripConfigs.map((config) => ({
              ...config,
              id: crypto.randomUUID(),
              updatedAt: timestamp,
            })),
            productionPlan: {
              ...template.project.productionPlan,
              offerModel:
                input.offerModel ?? template.project.productionPlan.offerModel,
              channels,
              outputs,
              editions: template.project.productionPlan.editions.map((edition) => ({
                ...edition,
                id: crypto.randomUUID(),
                route: edition.route.map((stop) => ({
                  ...stop,
                  id: crypto.randomUUID(),
                })),
                itineraryId: undefined,
                sourceEditionId: undefined,
                createdAt: timestamp,
              })),
              review: {
                liveDataVerified: false,
                presentationReviewed: false,
                backupConfirmed: false,
              },
            },
            accent: input.accent ?? template.accent,
            sourceTemplateId: template.id,
            sourceTemplateName: template.name,
            status: "Draft",
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          const result = commitProjects([project, ...get().projects]);
          if (!result.ok) throw new Error(result.error);
          const user = useAuthStore.getState().user;
          logActivity(
            project.id,
            "created",
            `Created project "${project.name}" from template "${template.name}"`,
            user,
          );
          enqueueProjectSync(
            project.id,
            `Created project "${project.name}" from template "${template.name}"`,
            "POST",
          );
          return project;
        },

        createFromTemplate: (template, name) =>
          get().createProjectFromTemplate(template, { name }),

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
  if (!isCloudPersistenceEnabled() || cloudUnavailable) return;
  const project = useProjectsStore
    .getState()
    .projects.find((item) => item.id === projectId);
  if (!project) return;
  const item = projectSyncQueue.get(projectId) ?? {
    inFlight: false,
    pending: null,
    retryCount: 0,
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
  let activeSnapshot: ProjectSyncQueueItem["pending"] = null;
  let failed = false;
  // Conflicts are resolved by the user via the banner, never auto-retried.
  let isConflict = false;
  try {
    while (item.pending) {
      const next = item.pending;
      activeSnapshot = next;
      item.pending = null;
      await syncProjectSnapshot(next.project, next.activityDetail, next.method);
      activeSnapshot = null;
    }
    item.retryCount = 0;
  } catch (error) {
    // Keep the latest pending snapshot queued so a later edit or retry can sync it.
    item.pending = item.pending ?? activeSnapshot;
    failed = true;
    isConflict = error instanceof ProjectSyncConflictError;
  } finally {
    item.inFlight = false;
    if (item.pending && !failed) {
      void processProjectSyncQueue(projectId);
    } else if (failed && item.pending && !isConflict && !cloudUnavailable) {
      // Transient failure: retry with bounded exponential backoff so a network
      // blip does not strand the project (background refresh skips dirty ids).
      if (item.retryCount < MAX_SYNC_RETRIES) {
        const delay = 1000 * 2 ** item.retryCount;
        item.retryCount += 1;
        setTimeout(() => void processProjectSyncQueue(projectId), delay);
      }
    } else if (!item.pending) {
      projectSyncQueue.delete(projectId);
    }
  }
}

async function syncProjectSnapshot(
  project: Project,
  activityDetail: string,
  method: ProjectSyncMethod,
  restore = false,
): Promise<void> {
  if (!isCloudPersistenceEnabled() || cloudUnavailable) return;
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
      body: JSON.stringify({ project, expectedRevision, activityDetail, restore }),
    });
    const body = await readCloudResponse(response);
    if (response.status === 409) {
      const latest = await fetch(`/api/projects/${project.id}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
        .then(readCloudResponse)
        .catch(() => null);
      if (latest?.project) {
        const cloudProject = normalizeProject(latest.project.project);
        const cloudRevision = latest.project.revision;
        const updatedByName = latest.project.updatedByName ?? null;
        useProjectsStore.setState((current) => ({
          conflictByProject: {
            ...current.conflictByProject,
            [project.id]: {
              projectId: project.id,
              cloudProject,
              cloudRevision,
              updatedByName,
              kind: "update",
            },
          },
          lastCloudRevisionByProject: {
            ...current.lastCloudRevisionByProject,
            [project.id]: cloudRevision,
          },
        }));
      }
      throw new ProjectSyncConflictError(
        "Cloud has newer changes for this project. Reload the latest version or overwrite it with your changes.",
      );
    }
    if (response.status === 404) {
      // The project was deleted in the shared workspace while we were editing it.
      // Surface it via the conflict banner (discard the local copy, or restore it)
      // instead of a generic persistence error. Cloud has no body to show, so the
      // local snapshot stands in as the conflict's project.
      const local = useProjectsStore
        .getState()
        .projects.find((p) => p.id === project.id);
      if (local) {
        projectSyncQueue.delete(project.id);
        useProjectsStore.setState((current) => ({
          conflictByProject: {
            ...current.conflictByProject,
            [project.id]: {
              projectId: project.id,
              cloudProject: local,
              cloudRevision: expectedRevision ?? 0,
              updatedByName: null,
              kind: "deleted",
            },
          },
        }));
      }
      throw new ProjectSyncConflictError(
        "This project was deleted by someone else. Discard your copy or restore the project.",
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
    const isConflict = error instanceof ProjectSyncConflictError;
    useProjectsStore.setState((current) => ({
      syncStatus: "error",
      syncError: message,
      // Conflicts surface via the dedicated conflict banner, so leave the generic
      // persistence error untouched to avoid a duplicate scary notice.
      persistenceError: isConflict ? current.persistenceError : message,
    }));
    dispatchSaveState("error", message);
    throw error;
  }
}

async function syncDeleteProject(projectId: string): Promise<void> {
  if (!isCloudPersistenceEnabled() || cloudUnavailable) return;
  const user = useAuthStore.getState().user;
  if (!user || typeof fetch === "undefined") return;
  useProjectsStore.setState({ syncStatus: "syncing", syncError: null });
  dispatchSaveState("saving");
  try {
    const expectedRevision =
      useProjectsStore.getState().lastCloudRevisionByProject[projectId];
    if (expectedRevision === undefined) {
      throw new Error(
        "Cloud revision is unavailable for this project. Refresh before deleting.",
      );
    }
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ expectedRevision }),
    });
    if (response.status === 409) {
      // The project changed in the shared workspace after we read it. Revert the
      // optimistic delete and let the user decide (keep it, or delete again).
      await recordDeleteConflict(projectId);
      throw new ProjectSyncConflictError(
        "Cloud has newer changes for this project. Keep it or delete it again.",
      );
    }
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
    const isConflict = error instanceof ProjectSyncConflictError;
    useProjectsStore.setState((current) => ({
      syncStatus: "error",
      syncError: message,
      // Delete conflicts surface via the conflict banner, so leave the generic
      // persistence error untouched to avoid a duplicate scary notice.
      persistenceError: isConflict ? current.persistenceError : message,
    }));
    dispatchSaveState("error", message);
  }
}

/**
 * On a delete 409, refetch the latest cloud copy, revert the optimistic delete
 * by re-adding it locally, record a delete-kind conflict, and resync the
 * expected revision. If the project is already gone in cloud, the delete
 * effectively succeeded, so just drop its tracked revision.
 */
async function recordDeleteConflict(projectId: string): Promise<void> {
  const latest = await fetch(`/api/projects/${projectId}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
    .then(readCloudResponse)
    .catch(() => null);

  if (!latest?.project) {
    useProjectsStore.setState((current) => {
      const next = { ...current.lastCloudRevisionByProject };
      delete next[projectId];
      return { lastCloudRevisionByProject: next };
    });
    return;
  }

  const cloudProject = normalizeProject(latest.project.project);
  const cloudRevision = latest.project.revision;
  const updatedByName = latest.project.updatedByName ?? null;

  useProjectsStore.setState((current) => {
    const exists = current.projects.some((p) => p.id === projectId);
    const projects = exists
      ? current.projects.map((p) => (p.id === projectId ? cloudProject : p))
      : [cloudProject, ...current.projects];
    return {
      projects,
      conflictByProject: {
        ...current.conflictByProject,
        [projectId]: {
          projectId,
          cloudProject,
          cloudRevision,
          updatedByName,
          kind: "delete",
        },
      },
      lastCloudRevisionByProject: {
        ...current.lastCloudRevisionByProject,
        [projectId]: cloudRevision,
      },
    };
  });
}
