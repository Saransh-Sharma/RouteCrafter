import { create as createZustand } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  projectSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
} from "../schemas";
import { seedProjects } from "../seed-projects";

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

interface ProjectsState {
  projects: Project[];
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  hydrateSeeds: () => void;
  create: (input: CreateProjectInput) => Project;
  update: (id: string, patch: Partial<Project>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => Project | undefined;
  getById: (id: string) => Project | undefined;
  importProject: (project: unknown) => Project;
}

function now() {
  return new Date().toISOString();
}

export const useProjectsStore = createZustand<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],
      hasHydrated: false,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      hydrateSeeds: () => {
        if (get().projects.length === 0) {
          set({ projects: seedProjects });
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
        set((state) => ({ projects: [project, ...state.projects] }));
        return project;
      },

      update: (id, patch) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: now() } : p,
          ),
        }));
      },

      remove: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        }));
      },

      duplicate: (id) => {
        const original = get().projects.find((p) => p.id === id);
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
        set((state) => ({ projects: [copy, ...state.projects] }));
        return copy;
      },

      getById: (id) => get().projects.find((p) => p.id === id),

      importProject: (raw) => {
        const parsed = projectSchema.parse(raw);
        const existingIds = new Set(get().projects.map((p) => p.id));
        const project: Project = existingIds.has(parsed.id)
          ? { ...parsed, id: crypto.randomUUID(), updatedAt: now() }
          : parsed;
        set((state) => ({ projects: [project, ...state.projects] }));
        return project;
      },
    }),
    {
      name: "routecrafter:v1",
      version: CURRENT_SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ projects: state.projects }),
      onRehydrateStorage: () => (state) => {
        state?.hydrateSeeds();
        state?.setHasHydrated(true);
      },
    },
  ),
);
