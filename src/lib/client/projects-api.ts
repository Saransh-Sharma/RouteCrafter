import type { CloudProject } from "@/lib/persistence/types";
import type { Project } from "@/lib/schemas";
import { requestJsonResult, type ClientApiResult } from "./http";

export interface ProjectRevisionSummary {
  id: string;
  revision: number;
  updatedAt: string;
}

export type ProjectApiResult<T> = ClientApiResult<T>;

export function listProjects(): Promise<
  ProjectApiResult<{ projects?: CloudProject[] }>
> {
  return requestJsonResult("/api/projects");
}

export function syncLocalProjects(
  projects: Project[],
): Promise<ProjectApiResult<{ projects?: CloudProject[] }>> {
  return requestJsonResult("/api/projects/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projects }),
  });
}

export function listProjectRevisions(): Promise<
  ProjectApiResult<{ revisions?: ProjectRevisionSummary[] }>
> {
  return requestJsonResult("/api/projects/revisions");
}

export function getProject(
  id: string,
): Promise<ProjectApiResult<{ project?: CloudProject }>> {
  return requestJsonResult(`/api/projects/${id}`);
}

export function postProject(input: {
  project: Project;
  expectedRevision?: number;
  activityDetail: string;
  restore?: boolean;
}): Promise<ProjectApiResult<{ project?: CloudProject }>> {
  return requestJsonResult("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function putProject(
  projectId: string,
  input: {
    project: Project;
    expectedRevision?: number;
    activityDetail: string;
    restore?: boolean;
  },
): Promise<ProjectApiResult<{ project?: CloudProject }>> {
  return requestJsonResult(`/api/projects/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteProject(
  projectId: string,
  expectedRevision: number,
): Promise<ProjectApiResult<{ ok?: boolean }>> {
  return requestJsonResult(`/api/projects/${projectId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision }),
  });
}
