import { z } from "zod";
import {
  CURRENT_SCHEMA_VERSION,
  projectSchema,
  type Project,
} from "./schemas";

export const persistedProjectsSchema = z.object({
  projects: z.array(z.unknown()).default([]),
  initialized: z.boolean().default(true),
});

export interface PersistedProjects {
  projects: Project[];
  initialized: boolean;
}

/** Apply current nested defaults and stamp the current project schema version. */
export function normalizeProject(raw: unknown): Project {
  if (!raw || typeof raw !== "object") {
    throw new Error("Project data must be an object.");
  }

  return projectSchema.parse({
    ...raw,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

/** Normalize the persisted Zustand slice, including every nested project. */
export function normalizePersistedProjects(raw: unknown): PersistedProjects {
  const parsed = persistedProjectsSchema.parse(raw);
  return {
    initialized: parsed.initialized,
    projects: parsed.projects.map(normalizeProject),
  };
}
