import { z } from "zod";
import {
  CURRENT_SCHEMA_VERSION,
  durationEnum,
  projectSchema,
  type Deliverable,
  type Duration,
  type OutputRequirement,
  type Project,
} from "./schemas";
import { realignItineraryDurationText } from "./generation/itinerary";

export const persistedProjectsSchema = z.object({
  projects: z.array(z.unknown()).default([]),
  initialized: z.boolean().default(true),
});

export interface PersistedProjects {
  projects: Project[];
  initialized: boolean;
}

const LEGACY_TO_OUTPUT: Partial<Record<Deliverable, OutputRequirement>> = {
  PDF: "pdf",
  Spreadsheet: "spreadsheet",
  "Packing list": "packing-list",
  "Food guide": "food-guide",
  "Booking checklist": "booking-checklist",
  "Fiverr listing copy": "marketplace-listing",
  "Portfolio image prompts": "portfolio-visuals",
  "Map pins": "map-pins-legacy",
};

const OUTPUT_TO_LEGACY: Partial<Record<OutputRequirement, Deliverable>> = {
  pdf: "PDF",
  spreadsheet: "Spreadsheet",
  "packing-list": "Packing list",
  "food-guide": "Food guide",
  "booking-checklist": "Booking checklist",
  "marketplace-listing": "Fiverr listing copy",
  "portfolio-visuals": "Portfolio image prompts",
  "map-pins-legacy": "Map pins",
};

function legacyOutputs(project: Project): OutputRequirement[] {
  const deliverables = [
    ...project.deliverables,
    ...(project.tripConfigs[0]?.deliverables ?? []),
  ];
  return [
    "marketplace-listing",
    ...deliverables.flatMap((item) => {
      const output = LEGACY_TO_OUTPUT[item];
      return output ? [output] : [];
    }),
  ].filter(
    (output, index, outputs) => outputs.indexOf(output) === index,
  ) as OutputRequirement[];
}

function canonicalDuration(value: string, fallback: Duration): Duration {
  const parsed = durationEnum.safeParse(value);
  if (parsed.success) return parsed.data;
  const days = Number.parseInt(value, 10);
  if (!Number.isInteger(days)) return fallback;
  return [...durationEnum.options].sort(
    (left, right) =>
      Math.abs(Number.parseInt(left, 10) - days) -
      Math.abs(Number.parseInt(right, 10) - days),
  )[0];
}

function customDays(value: string): number | undefined {
  const days = Number.parseInt(value, 10);
  return durationEnum.safeParse(value).success ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 60
    ? undefined
    : days;
}

function migrateProductionPlan(project: Project, hadProductionPlan: boolean): Project {
  const primaryConfig = project.tripConfigs[0];
  const fallbackDuration = primaryConfig?.duration ?? project.durations[0] ?? "7 days";
  const outputs = hadProductionPlan
    ? [
        "marketplace-listing" as const,
        ...project.productionPlan.outputs,
      ].filter((item, index, items) => items.indexOf(item) === index)
    : legacyOutputs(project);

  const existingEditions = hadProductionPlan
    ? project.productionPlan.editions
    : project.itineraries.map((itinerary) => ({
        id: `legacy-edition-${itinerary.id}`,
        duration: canonicalDuration(itinerary.duration, fallbackDuration),
        customDays: customDays(itinerary.duration),
        travelerType: itinerary.travelerType,
        cities: [],
        route: [],
        itineraryId: itinerary.id,
        createdAt: itinerary.createdAt,
      }));

  const editions = hadProductionPlan
    ? existingEditions
    : existingEditions.filter(
        (edition, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.duration === edition.duration &&
              candidate.customDays === edition.customDays &&
              candidate.travelerType === edition.travelerType,
          ) === index,
      );

  const itineraries = project.itineraries.map((itinerary) => {
    const edition =
      editions.find((candidate) => candidate.id === itinerary.plannedEditionId) ??
      editions.find((candidate) => candidate.itineraryId === itinerary.id) ??
      editions.find(
        (candidate) =>
          candidate.duration ===
            canonicalDuration(itinerary.duration, fallbackDuration) &&
          candidate.customDays === customDays(itinerary.duration) &&
          candidate.travelerType === itinerary.travelerType,
      );
    // The edition is authoritative for duration; align the itinerary's label to
    // it, then repair any stale "N days" text left in the title/overview/etc.
    const duration = edition
      ? edition.customDays
        ? `${edition.customDays} days`
        : edition.duration
      : itinerary.duration;
    return realignItineraryDurationText({
      ...itinerary,
      plannedEditionId: itinerary.plannedEditionId ?? edition?.id,
      duration,
    });
  });

  const legacyDeliverables = outputs.flatMap((output) => {
    const deliverable = OUTPUT_TO_LEGACY[output];
    return deliverable ? [deliverable] : [];
  });
  const tripConfigs = project.tripConfigs.map((config, index) =>
    index === 0 ? { ...config, deliverables: legacyDeliverables } : config,
  );

  return {
    ...project,
    deliverables: legacyDeliverables,
    tripConfigs,
    itineraries,
    productionPlan: {
      ...project.productionPlan,
      offerModel: hadProductionPlan
        ? project.productionPlan.offerModel
        : project.deliverables.includes("Fiverr listing copy")
          ? "service"
          : "digital",
      channels: hadProductionPlan
        ? project.productionPlan.channels
        : project.deliverables.includes("Fiverr listing copy")
          ? ["fiverr"]
          : ["etsy"],
      outputs,
      editions,
    },
  };
}

/** Apply current nested defaults and stamp the current project schema version. */
export function normalizeProject(raw: unknown): Project {
  if (!raw || typeof raw !== "object") {
    throw new Error("Project data must be an object.");
  }

  const hadProductionPlan = Object.hasOwn(raw, "productionPlan");
  const parsed = projectSchema.parse({
    ...raw,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
  return projectSchema.parse(
    migrateProductionPlan(parsed, hadProductionPlan),
  );
}

/** Normalize the persisted Zustand slice, including every nested project. */
export function normalizePersistedProjects(raw: unknown): PersistedProjects {
  const parsed = persistedProjectsSchema.parse(raw);
  return {
    initialized: parsed.initialized,
    projects: parsed.projects.map(normalizeProject),
  };
}
