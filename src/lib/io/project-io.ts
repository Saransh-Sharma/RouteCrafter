import type { Project } from "../schemas";
import { normalizeProject } from "../project-normalization";

export interface ImportResult {
  ok: boolean;
  project?: Project;
  error?: string;
}

/** Serialize a project to pretty-printed JSON for download/copy. */
export function exportProjectJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/** A safe filename slug for a project export. */
export function projectFileName(project: Project): string {
  const slug =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "routecrafter-project";
  return `${slug}.json`;
}

/** Trigger a browser download of the project JSON. */
export function downloadProjectJson(project: Project): void {
  const blob = new Blob([exportProjectJson(project)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = projectFileName(project);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parse + validate an imported JSON string against the project schema. */
export function importProjectJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }

  try {
    return { ok: true, project: normalizeProject(data) };
  } catch (error) {
    if (!(error instanceof Error) || !("issues" in error)) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid project file.",
      };
    }
    const issues = (
      error as Error & {
        issues: Array<{ path: PropertyKey[]; message: string }>;
      }
    ).issues;
    const first = issues[0];
    const path = first?.path.join(".") || "root";
    return {
      ok: false,
      error: `Invalid project file (${path}: ${first?.message ?? "unknown error"}).`,
    };
  }
}
