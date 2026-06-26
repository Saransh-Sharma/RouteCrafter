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
} from "@/lib/schemas";
import { normalizeProject } from "@/lib/project-normalization";
import { realignItineraryDurationText } from "@/lib/generation/itinerary";
import { syncItineraryToRoute } from "@/lib/generation/route-sync";
import { normalizeRoute, readinessFingerprint } from "@/lib/workflow";

const ACCENTS: Project["accent"][] = [
  "sage",
  "terracotta",
  "teal",
  "gold",
  "forest",
];

const resetPublishReview = () => ({
  liveDataVerified: false,
  presentationReviewed: false,
  backupConfirmed: false,
});

function now() {
  return new Date().toISOString();
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

export interface PersistedProjectsSlice {
  projects: Project[];
  initialized: boolean;
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

export function persistedStateSize(slice: PersistedProjectsSlice): number {
  return JSON.stringify({
    state: slice,
    version: CURRENT_SCHEMA_VERSION,
  }).length;
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
  const realigned = realignItineraryDurationText(cloned, itinerary.duration);
  return syncItineraryToRoute(realigned, edition.route).next;
}

export function createProjectCommand(input: CreateProjectInput, projectCount: number) {
  const timestamp = now();
  const accent = input.accent ?? ACCENTS[projectCount % ACCENTS.length];
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
      review: resetPublishReview(),
    },
    brandStyle: input.brandStyle,
    accent,
    sourceTemplateId: input.sourceTemplateId,
    sourceTemplateName: input.sourceTemplateName,
    status: "Draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return {
    project,
    activityDetail: `Created project "${project.name}"`,
  };
}

export function updateProjectCommand(
  project: Project,
  updater: (project: Project) => Project,
): Project {
  const updated = updater(project);
  const readinessChanged =
    readinessFingerprint(project) !== readinessFingerprint(updated);
  return normalizeProject({
    ...updated,
    productionPlan: readinessChanged
      ? {
          ...updated.productionPlan,
          review: resetPublishReview(),
        }
      : updated.productionPlan,
    status:
      readinessChanged && project.status === "Ready to sell"
        ? "In progress"
        : updated.status,
    id: project.id,
    updatedAt: now(),
  });
}

export function patchItineraryCommand(
  project: Project,
  itineraryId: string,
  patch:
    | Partial<ItineraryOutput>
    | ((itinerary: ItineraryOutput) => ItineraryOutput),
): Project {
  return updateProjectCommand(project, (current) => ({
    ...current,
    itineraries: current.itineraries.map((itinerary) => {
      if (itinerary.id !== itineraryId) return itinerary;
      const updated =
        typeof patch === "function"
          ? patch(itinerary)
          : { ...itinerary, ...patch };
      return { ...updated, updatedAt: now() };
    }),
  }));
}

export function duplicateProjectCommand(original: Project): {
  project: Project;
  activityDetail: string;
} {
  const timestamp = now();
  const project: Project = normalizeProject({
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} (Copy)`,
    status: "Draft",
    productionPlan: {
      ...original.productionPlan,
      review: resetPublishReview(),
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return {
    project,
    activityDetail: `Duplicated from "${original.name}"`,
  };
}

export function duplicateEditionCommand(
  project: Project,
  editionId: string,
  options: DuplicateEditionOptions = {},
): { project: Project; edition: PlannedEdition } | undefined {
  const source = project.productionPlan.editions.find(
    (edition) => edition.id === editionId,
  );
  if (!source) return undefined;

  const timestamp = now();
  const duration = options.duration ?? source.duration;
  const customDays =
    options.customDays === undefined ? source.customDays : options.customDays;
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

  return {
    edition: nextEdition,
    project: normalizeProject({
      ...project,
      productionPlan: {
        ...project.productionPlan,
        editions: project.productionPlan.editions.flatMap((item) =>
          item.id === source.id ? [item, nextEdition] : [item],
        ),
      },
      itineraries: clonedItinerary
        ? [...project.itineraries, clonedItinerary]
        : project.itineraries,
    }),
  };
}

export function removeDuplicatedEditionCommand(
  project: Project,
  editionId: string,
): MutationResult & { project?: Project } {
  const edition = project.productionPlan.editions.find(
    (item) => item.id === editionId,
  );
  if (!edition) {
    return { ok: false, error: "Edition not found." };
  }
  if (!edition.sourceEditionId) {
    return {
      ok: false,
      error: "Only duplicated editions can be removed with undo.",
    };
  }

  return {
    ok: true,
    project: normalizeProject({
      ...project,
      productionPlan: {
        ...project.productionPlan,
        editions: project.productionPlan.editions.filter(
          (item) => item.id !== editionId,
        ),
      },
      itineraries: edition.itineraryId
        ? project.itineraries.filter((item) => item.id !== edition.itineraryId)
        : project.itineraries,
    }),
  };
}

export function createProjectFromTemplateCommand(
  template: Template,
  input: CreateProjectFromTemplateInput,
) {
  const timestamp = now();
  const channels = input.channels ?? template.project.productionPlan.channels;
  const outputs = input.outputs ?? template.project.productionPlan.outputs;
  const project = projectSchema.parse({
    id: crypto.randomUUID(),
    name: input.name?.trim() || `${template.name} project`,
    country: input.country ?? template.project.country,
    regions: input.regions ?? template.project.regions,
    positioning: input.positioning ?? template.project.positioning,
    targetAudience: input.targetAudience ?? template.project.targetAudience,
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
      offerModel: input.offerModel ?? template.project.productionPlan.offerModel,
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
      review: resetPublishReview(),
    },
    accent: input.accent ?? template.accent,
    sourceTemplateId: template.id,
    sourceTemplateName: template.name,
    status: "Draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return {
    project,
    activityDetail: `Created project "${project.name}" from template "${template.name}"`,
  };
}

export function importProjectCommand(raw: unknown, existingProjects: Project[]) {
  const parsed = normalizeProject(raw);
  const existingIds = new Set(existingProjects.map((project) => project.id));
  const project: Project = existingIds.has(parsed.id)
    ? { ...parsed, id: crypto.randomUUID(), updatedAt: now() }
    : parsed;
  return {
    project,
    activityDetail: `Imported project "${project.name}"`,
  };
}
