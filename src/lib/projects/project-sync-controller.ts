import { isCloudPersistenceEnabled } from "@/lib/persistence/config";
import type { CloudProject } from "@/lib/persistence/types";
import { normalizeProject } from "@/lib/project-normalization";
import type { Project } from "@/lib/schemas";
import { seedProjects } from "@/lib/seed-projects";
import {
  deleteProject as deleteCloudProject,
  getProject as getCloudProject,
  listProjectRevisions,
  listProjects as listCloudProjects,
  postProject as postCloudProject,
  putProject as putCloudProject,
  syncLocalProjects,
  type ProjectApiResult,
} from "@/lib/client/projects-api";
import type { MutationResult } from "./project-commands";

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
  retryCount: number;
}

export interface ProjectConflict {
  projectId: string;
  cloudProject: Project;
  cloudRevision: number;
  updatedByName: string | null;
  kind: "update" | "delete" | "deleted";
}

export interface ProjectSyncStateSnapshot {
  projects: Project[];
  initialized: boolean;
  cloudHydrated: boolean;
  syncStatus: "idle" | "syncing" | "synced" | "error";
  syncError: string | null;
  lastCloudRevisionByProject: Record<string, number>;
  conflictByProject: Record<string, ProjectConflict>;
  persistenceError: string | null;
}

type ProjectSyncStatePatch = Partial<ProjectSyncStateSnapshot>;
type ProjectSyncStateUpdate =
  | ProjectSyncStatePatch
  | ((current: ProjectSyncStateSnapshot) => ProjectSyncStatePatch);

export interface ProjectSyncControllerOptions {
  getStateSnapshot: () => ProjectSyncStateSnapshot;
  setSyncState: (update: ProjectSyncStateUpdate) => void;
  commitProjects: (projects: Project[]) => MutationResult;
  hasUser: () => boolean;
  dispatchSaveState: (
    status: "idle" | "saving" | "saved" | "error",
    error?: string | null,
  ) => void;
}

const MAX_SYNC_RETRIES = 4;

class ProjectSyncConflictError extends Error {}

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

function reconcileCloudChanges({
  localProjects,
  changedById,
  cloudIds,
  knownRevisions,
  isProjectDirty,
}: {
  localProjects: Project[];
  changedById: Map<string, CloudProject>;
  cloudIds: Set<string>;
  knownRevisions: Record<string, number>;
  isProjectDirty: (projectId: string) => boolean;
}): Project[] {
  const result: Project[] = [];
  for (const local of localProjects) {
    if (isProjectDirty(local.id)) {
      result.push(local);
      continue;
    }
    if (!cloudIds.has(local.id)) continue;
    const changed = changedById.get(local.id);
    if (!changed) {
      result.push(local);
      continue;
    }
    const known = knownRevisions[local.id];
    if (known !== undefined && changed.revision < known) {
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

export function createProjectSyncController({
  getStateSnapshot,
  setSyncState,
  commitProjects,
  hasUser,
  dispatchSaveState,
}: ProjectSyncControllerOptions) {
  const projectSyncQueue = new Map<string, ProjectSyncQueueItem>();
  let refreshFromCloudInFlight = false;
  let cloudUnavailable = false;

  function noteCloudStatus(status: number): void {
    if (status === 503) cloudUnavailable = true;
  }

  function noteProjectApiResult(result: ProjectApiResult<unknown>): void {
    noteCloudStatus(result.status);
  }

  function isProjectDirty(projectId: string): boolean {
    const item = projectSyncQueue.get(projectId);
    return Boolean(item && (item.inFlight || item.pending));
  }

  async function hydrateCloudProjects(): Promise<void> {
    if (!isCloudPersistenceEnabled()) {
      setSyncState({ cloudHydrated: true, syncStatus: "idle", syncError: null });
      return;
    }
    if (!hasUser()) {
      setSyncState({ cloudHydrated: true, syncStatus: "idle", syncError: null });
      return;
    }
    setSyncState({ syncStatus: "syncing", syncError: null });
    dispatchSaveState("saving");
    try {
      const response = await listCloudProjects();
      noteProjectApiResult(response);
      if (!response.ok) {
        throw new Error(response.body.error ?? "Could not load cloud projects.");
      }
      const localProjects = getStateSnapshot().projects;
      const cloudProjects = response.body.projects ?? [];
      if (localProjects.length > 0 && !isSeedOnly(localProjects)) {
        const syncResponse = await syncLocalProjects(localProjects);
        noteProjectApiResult(syncResponse);
        if (!syncResponse.ok) {
          throw new Error(
            syncResponse.body.error ?? "Could not migrate local projects.",
          );
        }
        const synced = syncResponse.body.projects ?? [];
        setSyncState({
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
        setSyncState({
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

      setSyncState({
        cloudHydrated: true,
        syncStatus: "synced",
        syncError: null,
        lastCloudRevisionByProject: {},
      });
      dispatchSaveState("saved");
    } catch (error) {
      if (cloudUnavailable) {
        setSyncState({
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
      setSyncState({
        cloudHydrated: true,
        syncStatus: "error",
        syncError: message,
        persistenceError: message,
      });
      dispatchSaveState("error", message);
    }
  }

  async function refreshFromCloud(): Promise<void> {
    if (!isCloudPersistenceEnabled() || cloudUnavailable) return;
    if (!hasUser() || typeof fetch === "undefined") return;
    if (refreshFromCloudInFlight) return;
    refreshFromCloudInFlight = true;
    try {
      const response = await listProjectRevisions();
      noteProjectApiResult(response);
      if (!response.ok) return;
      if (!response.body.revisions) return;
      const cloudRevisions = response.body.revisions;
      const cloudIds = new Set(cloudRevisions.map((item) => item.id));
      const known = getStateSnapshot().lastCloudRevisionByProject;
      const localProjects = getStateSnapshot().projects;
      const localIds = new Set(localProjects.map((p) => p.id));

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

      const deletedIds = localProjects
        .filter((p) => !isProjectDirty(p.id) && !cloudIds.has(p.id))
        .map((p) => p.id);

      if (changedIds.length === 0 && deletedIds.length === 0) {
        if (!getStateSnapshot().cloudHydrated) setSyncState({ cloudHydrated: true });
        return;
      }

      const fetched = await Promise.all(
        changedIds.map((id) =>
          getCloudProject(id)
            .then((cloud) => {
              noteProjectApiResult(cloud);
              return cloud.body.project ?? null;
            })
            .catch(() => null),
        ),
      );
      const changedById = new Map<string, CloudProject>();
      for (const cloud of fetched) {
        if (cloud) changedById.set(cloud.project.id, cloud);
      }

      commitProjects(
        reconcileCloudChanges({
          localProjects: getStateSnapshot().projects,
          changedById,
          cloudIds,
          knownRevisions: known,
          isProjectDirty,
        }),
      );
      setSyncState((current) => {
        const revisions = { ...current.lastCloudRevisionByProject };
        for (const cloud of changedById.values()) {
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
  }

  async function refreshProject(id: string): Promise<void> {
    if (!isCloudPersistenceEnabled() || cloudUnavailable) return;
    if (!hasUser() || typeof fetch === "undefined") return;
    if (isProjectDirty(id)) return;
    try {
      const response = await getCloudProject(id);
      noteProjectApiResult(response);
      if (response.status === 404) {
        const remaining = getStateSnapshot().projects.filter((p) => p.id !== id);
        if (remaining.length !== getStateSnapshot().projects.length) {
          commitProjects(remaining);
        }
        return;
      }
      if (!response.ok || !response.body.project) return;
      if (isProjectDirty(id)) return;
      const cloudRevision = response.body.project.revision;
      const known = getStateSnapshot().lastCloudRevisionByProject[id];
      if (known !== undefined && cloudRevision < known) return;
      const cloud = normalizeProject(response.body.project.project);
      const exists = getStateSnapshot().projects.some((p) => p.id === id);
      commitProjects(
        exists
          ? getStateSnapshot().projects.map((p) => (p.id === id ? cloud : p))
          : [cloud, ...getStateSnapshot().projects],
      );
      setSyncState((current) => ({
        lastCloudRevisionByProject: {
          ...current.lastCloudRevisionByProject,
          [id]: cloudRevision,
        },
      }));
    } catch {
      // Best-effort freshness on workspace open.
    }
  }

  function clearProjectQueue(projectId: string): void {
    projectSyncQueue.delete(projectId);
  }

  function enqueueProjectSync(
    projectId: string,
    activityDetail: string,
    method: ProjectSyncMethod,
  ): void {
    if (!isCloudPersistenceEnabled() || cloudUnavailable) return;
    const project = getStateSnapshot().projects.find((item) => item.id === projectId);
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
      item.pending = item.pending ?? activeSnapshot;
      failed = true;
      isConflict = error instanceof ProjectSyncConflictError;
    } finally {
      item.inFlight = false;
      if (item.pending && !failed) {
        void processProjectSyncQueue(projectId);
      } else if (failed && item.pending && !isConflict && !cloudUnavailable) {
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
    if (!hasUser() || typeof fetch === "undefined") return;
    const state = getStateSnapshot();
    const expectedRevision = state.lastCloudRevisionByProject[project.id];
    setSyncState({ syncStatus: "syncing", syncError: null });
    dispatchSaveState("saving");
    try {
      const response =
        method === "POST"
          ? await postCloudProject({
              project,
              expectedRevision,
              activityDetail,
              restore,
            })
          : await putCloudProject(project.id, {
              project,
              expectedRevision,
              activityDetail,
              restore,
            });
      noteProjectApiResult(response);
      if (response.status === 409) {
        const latest = await getCloudProject(project.id)
          .then((result) => {
            noteProjectApiResult(result);
            return result.body;
          })
          .catch(() => null);
        if (latest?.project) {
          const cloudProject = normalizeProject(latest.project.project);
          const cloudRevision = latest.project.revision;
          const updatedByName = latest.project.updatedByName ?? null;
          setSyncState((current) => ({
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
        const local = getStateSnapshot().projects.find((p) => p.id === project.id);
        if (local) {
          projectSyncQueue.delete(project.id);
          setSyncState((current) => ({
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
      if (!response.ok || !response.body.project) {
        throw new Error(response.body.error ?? "Could not sync project to cloud.");
      }
      setSyncState((current) => ({
        syncStatus: "synced",
        syncError: null,
        lastCloudRevisionByProject: {
          ...current.lastCloudRevisionByProject,
          [response.body.project!.project.id]: response.body.project!.revision,
        },
      }));
      dispatchSaveState("saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cloud sync failed.";
      const isConflict = error instanceof ProjectSyncConflictError;
      setSyncState((current) => ({
        syncStatus: "error",
        syncError: message,
        persistenceError: isConflict ? current.persistenceError : message,
      }));
      dispatchSaveState("error", message);
      throw error;
    }
  }

  async function syncDeleteProject(projectId: string): Promise<void> {
    if (!isCloudPersistenceEnabled() || cloudUnavailable) return;
    if (!hasUser() || typeof fetch === "undefined") return;
    setSyncState({ syncStatus: "syncing", syncError: null });
    dispatchSaveState("saving");
    try {
      const expectedRevision =
        getStateSnapshot().lastCloudRevisionByProject[projectId];
      if (expectedRevision === undefined) {
        throw new Error(
          "Cloud revision is unavailable for this project. Refresh before deleting.",
        );
      }
      const response = await deleteCloudProject(projectId, expectedRevision);
      noteProjectApiResult(response);
      if (response.status === 409) {
        await recordDeleteConflict(projectId);
        throw new ProjectSyncConflictError(
          "Cloud has newer changes for this project. Keep it or delete it again.",
        );
      }
      if (!response.ok) {
        throw new Error(response.body.error ?? "Could not delete cloud project.");
      }
      setSyncState((current) => {
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
      setSyncState((current) => ({
        syncStatus: "error",
        syncError: message,
        persistenceError: isConflict ? current.persistenceError : message,
      }));
      dispatchSaveState("error", message);
    }
  }

  async function recordDeleteConflict(projectId: string): Promise<void> {
    const latest = await getCloudProject(projectId)
      .then((result) => {
        noteProjectApiResult(result);
        return result.body;
      })
      .catch(() => null);

    if (!latest?.project) {
      setSyncState((current) => {
        const next = { ...current.lastCloudRevisionByProject };
        delete next[projectId];
        return { lastCloudRevisionByProject: next };
      });
      return;
    }

    const cloudProject = normalizeProject(latest.project.project);
    const cloudRevision = latest.project.revision;
    const updatedByName = latest.project.updatedByName ?? null;

    setSyncState((current) => {
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

  return {
    clearProjectQueue,
    enqueueProjectSync,
    hydrateCloudProjects,
    refreshFromCloud,
    refreshProject,
    syncDeleteProject,
    syncProjectSnapshot,
  };
}
